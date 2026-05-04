import { ActionHandlerService } from './action-handler.service';
import type { AutomationAction, ExecutionContext } from '../../types/automation.types';

const buildContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  user: { id: 'user-1' },
  record: {},
  previousRecord: undefined,
  changes: [],
  automation: {
    id: 'auto-1',
    name: 'Test rule',
    triggerTiming: 'before',
    abortOnError: false,
  },
  depth: 1,
  maxDepth: 5,
  executionChain: [],
  recordsModified: new Map(),
  outputs: {},
  asyncQueue: [],
  errors: [],
  warnings: [],
  ...overrides,
});

const action = (type: string, config: Record<string, unknown>): AutomationAction => ({
  id: 'act-1',
  type,
  config,
});

describe('ActionHandlerService — Phase 4 §9.4 verification gate', () => {
  let handler: ActionHandlerService;

  beforeEach(() => {
    handler = new ActionHandlerService();
  });

  it("SetField (set_value) on insert produces a modify_record change for status=Active", async () => {
    const ctx = buildContext({ record: { id: 'rec-1', status: null } });
    const result = await handler.execute(
      action('set_value', { property: 'status', value: 'Active' }),
      ctx,
    );
    expect(result.type).toBe('modify_record');
    expect(result.changes).toEqual({ status: 'Active' });
  });

  it('SetField with onlyIfEmpty=true skips when the property already has a value', async () => {
    const ctx = buildContext({ record: { id: 'rec-1', status: 'Closed' } });
    const result = await handler.execute(
      action('set_value', { property: 'status', value: 'Active', onlyIfEmpty: true }),
      ctx,
    );
    expect(result.type).toBe('none');
  });

  it('Abort returns an abort result with the operator-visible message', async () => {
    const ctx = buildContext();
    const result = await handler.execute(
      action('abort', { message: 'Cannot transition to closed without approval', code: 'NEEDS_APPROVAL' }),
      ctx,
    );
    expect(result.type).toBe('abort');
    expect(result.message).toBe('Cannot transition to closed without approval');
  });

  it('CreateRecord queues a deferred insert until the parent commits', async () => {
    const ctx = buildContext();
    const result = await handler.execute(
      action('create_record', { collection: 'audit_log', values: { event: 'status_changed' } }),
      ctx,
    );
    expect(result.type).toBe('queue_after_commit');
  });

  it('Unknown action types fall through to none — runtime never crashes on legacy data', async () => {
    const ctx = buildContext();
    const result = await handler.execute(action('unknown_type', {}), ctx);
    expect(result.type).toBe('none');
  });

  it('Canonical PascalCase SetField dispatches to the legacy set_value handler', async () => {
    const ctx = buildContext({ record: { id: 'rec-1' } });
    const result = await handler.execute(
      action('SetField', { property: 'status', value: 'Active' }),
      ctx,
    );
    expect(result.type).toBe('modify_record');
    expect(result.changes).toEqual({ status: 'Active' });
  });

  it('Canonical Abort dispatches to the legacy abort handler', async () => {
    const ctx = buildContext();
    const result = await handler.execute(
      action('Abort', { message: 'Halt by canonical action' }),
      ctx,
    );
    expect(result.type).toBe('abort');
    expect(result.message).toBe('Halt by canonical action');
  });

  it('CreateRecord accepts canonical collectionCode field', async () => {
    const ctx = buildContext();
    const result = await handler.execute(
      action('CreateRecord', { collectionCode: 'audit_log', values: { event: 'x' } }),
      ctx,
    );
    expect(result.type).toBe('queue_after_commit');
    expect((result.output as { collection?: string }).collection).toBe('audit_log');
  });

  it('trigger_flow / CallFlow resolves inputs into the queued output', async () => {
    // Without the dedicated handler, drainQueuedActions sees raw
    // config.inputs with literal @-bindings and the Process Flow
    // receives placeholder strings instead of evaluated values.
    const ctx = buildContext({ record: { id: 'rec-7', tier: 'platinum' } });
    const result = await handler.execute(
      action('trigger_flow', {
        flowCode: 'onboarding_flow',
        inputs: { recordId: '@record.id', tier: '@record.tier', literal: 42 },
      }),
      ctx,
    );
    expect(result.type).toBe('queue_async');
    const out = result.output as { workflowId?: string; inputs?: Record<string, unknown> };
    expect(out.workflowId).toBe('onboarding_flow');
    expect(out.inputs?.recordId).toBe('rec-7');
    expect(out.inputs?.tier).toBe('platinum');
    expect(out.inputs?.literal).toBe(42);
  });
});
