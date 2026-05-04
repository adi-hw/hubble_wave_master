import { AutomationRuntimeService } from './automation-runtime.service';

/**
 * W2.D — Verifies automation-runtime emits a runtime_anomaly when an
 * after-automation execution failure is swallowed by the per-rule
 * try/catch, and when a record/collection lookup fails.
 */
describe('AutomationRuntimeService — anomaly recording for swallowed failures (W2.D)', () => {
  function buildService(opts: {
    collection?: any;
    automations?: any[];
    executeShouldThrow?: boolean;
  } = {}) {
    const dataSource: any = {
      getRepository: jest.fn((target: any) => {
        const name = target?.name ?? '';
        if (name === 'CollectionDefinition') {
          return {
            findOne: jest.fn(async () => opts.collection ?? null),
          };
        }
        if (name === 'AutomationRule') {
          return {
            find: jest.fn(async () => opts.automations ?? []),
            update: jest.fn(async () => undefined),
            increment: jest.fn(async () => undefined),
            findOne: jest.fn(async () => null),
          };
        }
        if (name === 'AuditLog') {
          return {
            create: jest.fn((e: any) => e),
            save: jest.fn(async () => undefined),
          };
        }
        return { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
      }),
    };

    const conditionEvaluator: any = { evaluate: jest.fn(() => ({ result: true, trace: {} })) };
    const actionHandler: any = { execute: jest.fn() };
    const scriptSandbox: any = { execute: jest.fn() };
    const executionLog: any = { log: jest.fn(async () => undefined) };
    const recordMutation: any = {
      getRecordById: jest.fn(async () => null),
    };
    const outboxPublisher: any = { publishEvent: jest.fn() };

    const recorded: any[] = [];
    const runtimeAnomaly: any = {
      record: jest.fn(async (event: any) => {
        recorded.push(event);
      }),
    };

    const service = new AutomationRuntimeService(
      dataSource,
      conditionEvaluator,
      actionHandler,
      scriptSandbox,
      executionLog,
      recordMutation,
      outboxPublisher,
      runtimeAnomaly,
    );

    if (opts.executeShouldThrow) {
      (service as any).executeAutomation = jest.fn(async () => {
        throw new Error('boom in action handler');
      });
    }

    return { service, recorded, runtimeAnomaly };
  }

  it('records an anomaly when collection lookup fails', async () => {
    const { service, recorded } = buildService({ collection: null });

    await service.processRecordEvent({
      eventType: 'record.created',
      collectionCode: 'missing_collection',
      recordId: 'rec-1',
      record: { id: 'rec-1' },
      previousRecord: null,
      changedProperties: [],
      userId: 'user-1',
      occurredAt: new Date().toISOString(),
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0].kind).toBe('record_lookup_missing');
    expect(recorded[0].serviceCode).toBe('svc-automation');
    expect(recorded[0].collectionCode).toBe('missing_collection');
    expect((recorded[0].context as Record<string, unknown>).missing).toBe('collection');
  });

  it('records an after_automation_swallowed anomaly when execution throws', async () => {
    const collection = { id: 'col-1', code: 'work_orders', isActive: true };
    const automation = {
      id: 'auto-1',
      name: 'Notify on close',
      collectionId: 'col-1',
      isActive: true,
      executionOrder: 0,
      triggerTiming: 'after',
      triggerOperations: ['update'],
      conditionType: 'always',
      actionType: 'no_code',
      actions: [],
      abortOnError: true,
      consecutiveErrors: 0,
      watchProperties: [],
    };

    const { service, recorded, runtimeAnomaly } = buildService({
      collection,
      automations: [automation],
      executeShouldThrow: true,
    });

    await service.processRecordEvent({
      eventType: 'record.updated',
      collectionCode: 'work_orders',
      recordId: 'rec-9',
      record: { id: 'rec-9', status: 'closed' },
      previousRecord: { id: 'rec-9', status: 'open' },
      changedProperties: ['status'],
      userId: 'user-9',
      occurredAt: new Date().toISOString(),
    });

    // Exactly one anomaly should have been recorded for the swallowed failure.
    expect(runtimeAnomaly.record).toHaveBeenCalledTimes(1);
    expect(recorded[0].kind).toBe('after_automation_swallowed');
    expect(recorded[0].serviceCode).toBe('svc-automation');
    expect(recorded[0].collectionCode).toBe('work_orders');
    expect(recorded[0].recordId).toBe('rec-9');
    expect(recorded[0].error).toBeInstanceOf(Error);
    expect((recorded[0].error as Error).message).toBe('boom in action handler');
    expect((recorded[0].context as Record<string, unknown>).automationId).toBe('auto-1');
    expect((recorded[0].context as Record<string, unknown>).automationName).toBe('Notify on close');
  });
});
