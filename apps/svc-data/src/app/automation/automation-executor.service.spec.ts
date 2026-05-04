import { EventEmitter2 } from '@nestjs/event-emitter';
import { AutomationExecutorService } from './automation-executor.service';
import { ActionHandlerService } from './action-handler.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import type { Automation } from './automation.service';

const buildAutomation = (overrides: Partial<Automation>): Automation => ({
  id: 'auto-1',
  name: 'Test rule',
  collectionId: 'col-1',
  triggerTiming: 'before',
  triggerOperations: ['insert'],
  conditionType: 'always',
  actionType: 'no_code',
  actions: [],
  abortOnError: false,
  isActive: true,
  isSystem: false,
  executionOrder: 100,
  consecutiveErrors: 0,
  metadata: {},
  status: 'published',
  ...overrides,
});

const buildExecutor = (automations: Automation[]) => {
  const automationService = {
    getAutomationsForTrigger: jest.fn().mockResolvedValue(automations),
  };
  const executionLog = {
    log: jest.fn().mockResolvedValue(undefined),
  };
  const scriptSandbox = {};
  const eventEmitter = new EventEmitter2();
  return new AutomationExecutorService(
    automationService as never,
    new ConditionEvaluatorService(),
    new ActionHandlerService(),
    executionLog as never,
    scriptSandbox as never,
    eventEmitter,
  );
};

describe('AutomationExecutorService — Phase 4 wiring contract', () => {
  it('SetField rule on insert produces a modifiedRecord that includes the set value', async () => {
    const setField = buildAutomation({
      actions: [
        {
          id: 'a1',
          type: 'set_value',
          config: { property: 'status', value: 'Active' },
        },
      ],
    });
    const executor = buildExecutor([setField]);
    const result = await executor.executeAutomations(
      'col-1',
      'before',
      'insert',
      { id: 'rec-1', name: 'work order' },
      undefined,
      { id: 'user-1' },
    );
    expect(result.aborted).toBe(false);
    expect(result.modifiedRecord.status).toBe('Active');
    expect(result.modifiedRecord.name).toBe('work order');
  });

  it('Abort rule sets aborted=true and surfaces the operator-visible message', async () => {
    const abort = buildAutomation({
      abortOnError: false, // abort action is independent of error abort
      actions: [
        {
          id: 'a1',
          type: 'abort',
          config: {
            message: 'Cannot create with status=Closed without approval',
            code: 'NEEDS_APPROVAL',
          },
        },
      ],
    });
    const executor = buildExecutor([abort]);
    const result = await executor.executeAutomations(
      'col-1',
      'before',
      'insert',
      { id: 'rec-1' },
      undefined,
      { id: 'user-1' },
    );
    expect(result.aborted).toBe(true);
    expect(result.abortMessage).toContain('Cannot create with status=Closed');
  });

  it('Multiple SetField rules in execution order layer their changes', async () => {
    const ruleA = buildAutomation({
      id: 'auto-a',
      executionOrder: 10,
      actions: [
        { id: 'a1', type: 'set_value', config: { property: 'priority', value: 'P3' } },
      ],
    });
    const ruleB = buildAutomation({
      id: 'auto-b',
      executionOrder: 20,
      actions: [
        { id: 'b1', type: 'set_value', config: { property: 'status', value: 'Active' } },
      ],
    });
    const executor = buildExecutor([ruleA, ruleB]);
    const result = await executor.executeAutomations(
      'col-1',
      'before',
      'insert',
      { id: 'rec-1' },
      undefined,
      { id: 'user-1' },
    );
    expect(result.modifiedRecord.priority).toBe('P3');
    expect(result.modifiedRecord.status).toBe('Active');
  });

  it('After a rule aborts, subsequent rules in the chain do not run', async () => {
    const aborter = buildAutomation({
      id: 'auto-stop',
      executionOrder: 10,
      actions: [
        { id: 'a1', type: 'abort', config: { message: 'Halt' } },
      ],
    });
    const wouldFire = buildAutomation({
      id: 'auto-after',
      executionOrder: 20,
      actions: [
        { id: 'b1', type: 'set_value', config: { property: 'status', value: 'WouldRun' } },
      ],
    });
    const executor = buildExecutor([aborter, wouldFire]);
    const result = await executor.executeAutomations(
      'col-1',
      'before',
      'insert',
      { id: 'rec-1' },
      undefined,
      { id: 'user-1' },
    );
    expect(result.aborted).toBe(true);
    expect(result.modifiedRecord.status).toBeUndefined();
  });

  it('Queued actions carry resolved output — bindings evaluate at queue time, not at drain time', async () => {
    // FireEvent's @record / @output bindings resolve in the action
    // handler's `result.output`. The executor must preserve that
    // output on the QueuedAction so drainQueuedActions sees evaluated
    // values, not literal placeholder strings.
    const ruleWithBinding = buildAutomation({
      actions: [
        {
          id: 'a1',
          type: 'log_event',
          config: { event: 'order.created', data: { id: '@record.id', tier: '@record.tier' } },
        },
      ],
    });
    const executor = buildExecutor([ruleWithBinding]);
    const result = await executor.executeAutomations(
      'col-1',
      'before',
      'insert',
      { id: 'rec-42', tier: 'gold' },
      undefined,
      { id: 'user-1' },
    );
    expect(result.asyncQueue).toHaveLength(1);
    const queued = result.asyncQueue[0];
    expect(queued.output).toBeDefined();
    const out = queued.output as { event: string; data: Record<string, unknown> };
    expect(out.event).toBe('order.created');
    expect(out.data.id).toBe('rec-42');
    expect(out.data.tier).toBe('gold');
  });

  it('Side-effect actions on before-trigger rules surface in asyncQueue for the caller to drain', async () => {
    // CollectionDataService.runBeforeAutomations forwards asyncQueue
    // back to the caller, which drains it post-commit. Verify the
    // executor populates asyncQueue with create_record / log_event /
    // trigger_flow even when they fire on before-triggers (not just
    // after-triggers).
    const ruleWithSideEffects = buildAutomation({
      actions: [
        { id: 'a1', type: 'set_value', config: { property: 'status', value: 'Active' } },
        {
          id: 'a2',
          type: 'create_record',
          config: { collectionCode: 'audit_log', values: { event: 'created' } },
        },
        { id: 'a3', type: 'log_event', config: { event: 'parent_created', data: {} } },
      ],
    });
    const executor = buildExecutor([ruleWithSideEffects]);
    const result = await executor.executeAutomations(
      'col-1',
      'before',
      'insert',
      { id: 'rec-1' },
      undefined,
      { id: 'user-1' },
    );
    expect(result.modifiedRecord.status).toBe('Active');
    expect(result.asyncQueue).toHaveLength(2);
    const queuedTypes = result.asyncQueue.map((q) => q.action.type).sort();
    expect(queuedTypes).toEqual(['create_record', 'log_event']);
    // CreateRecord queues for after-commit; FireEvent queues async.
    const createQueued = result.asyncQueue.find((q) => q.action.type === 'create_record');
    expect(createQueued?.executeAfterCommit).toBe(true);
    const eventQueued = result.asyncQueue.find((q) => q.action.type === 'log_event');
    expect(eventQueued?.executeAsync).toBe(true);
  });

  it('Update rules respect watchProperties — only fire when a watched property changed', async () => {
    const rule = buildAutomation({
      triggerOperations: ['update'],
      watchProperties: ['priority'],
      actions: [
        { id: 'a1', type: 'set_value', config: { property: 'updated_by_rule', value: true } },
      ],
    });
    const executor = buildExecutor([rule]);

    const noChange = await executor.executeAutomations(
      'col-1',
      'before',
      'update',
      { id: 'rec-1', priority: 'P3', status: 'Active' },
      { id: 'rec-1', priority: 'P3', status: 'New' },
      { id: 'user-1' },
    );
    expect(noChange.modifiedRecord.updated_by_rule).toBeUndefined();

    const watchedChange = await executor.executeAutomations(
      'col-1',
      'before',
      'update',
      { id: 'rec-1', priority: 'P1', status: 'Active' },
      { id: 'rec-1', priority: 'P3', status: 'Active' },
      { id: 'user-1' },
    );
    expect(watchedChange.modifiedRecord.updated_by_rule).toBe(true);
  });
});
