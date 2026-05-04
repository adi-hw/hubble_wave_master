import { CollectionDataService } from './collection-data.service';

/**
 * W2.D — Verifies the partial-failure paths in bulkUpdate/bulkDelete record
 * a runtime anomaly when individual outbox publishes throw, while still
 * draining the rest of the batch.
 */
describe('CollectionDataService — bulk partial-failure anomaly recording (W2.D)', () => {
  const collection = {
    id: 'col-1',
    code: 'work_orders',
    tableName: 'work_orders',
  };

  const properties: any[] = [
    { code: 'status', columnName: 'status', name: 'Status' },
  ];

  function buildService() {
    const dataSource: any = {
      getRepository: jest.fn(() => ({
        create: jest.fn((e: any) => e),
        save: jest.fn(async () => undefined),
      })),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        whereInIds: jest.fn().mockReturnThis(),
        execute: jest.fn(async () => ({ affected: 3 })),
      })),
      query: jest.fn(),
    };

    const authz: any = {
      ensureTableAccess: jest.fn(async () => undefined),
      getAuthorizedFields: jest.fn(async () => [
        { code: 'status', canRead: true, canWrite: true },
      ]),
    };

    const validationService: any = {};
    const defaultValueService: any = {};

    const enqueued: string[] = [];
    const outboxService: any = {
      enqueueRecordEvent: jest.fn(async (payload: any) => {
        enqueued.push(payload.recordId);
        // Simulate the second row failing to publish.
        if (payload.recordId === 'rec-2') {
          throw new Error('outbox transport down');
        }
      }),
    };

    const recorded: any[] = [];
    const runtimeAnomaly: any = {
      record: jest.fn(async (event: any) => {
        recorded.push(event);
      }),
    };

    const service = new CollectionDataService(
      dataSource,
      authz,
      validationService,
      defaultValueService,
      outboxService,
      runtimeAnomaly,
    );

    // Stub the private methods that bulkUpdate touches.
    (service as any).getCollection = jest.fn(async () => collection);
    (service as any).getProperties = jest.fn(async () => properties);
    (service as any).fetchRecordsByIds = jest.fn(async () => [
      { id: 'rec-1', status: 'open' },
      { id: 'rec-2', status: 'open' },
      { id: 'rec-3', status: 'open' },
    ]);
    (service as any).writeAuditLog = jest.fn(async () => undefined);

    return { service, recorded, outboxService, runtimeAnomaly, enqueued };
  }

  it('bulk update with one failed event publish records a runtime_anomaly and continues', async () => {
    const { service, recorded, outboxService, runtimeAnomaly } = buildService();

    const result = await service.bulkUpdate(
      { userId: 'user-9' } as any,
      'work_orders',
      ['rec-1', 'rec-2', 'rec-3'],
      { status: 'closed' },
    );

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(3);

    // All three IDs should have been attempted.
    expect(outboxService.enqueueRecordEvent).toHaveBeenCalledTimes(3);

    // Exactly one anomaly should have been recorded for rec-2.
    expect(runtimeAnomaly.record).toHaveBeenCalledTimes(1);
    expect(recorded[0].kind).toBe('bulk_partial_failure');
    expect(recorded[0].serviceCode).toBe('svc-data');
    expect(recorded[0].recordId).toBe('rec-2');
    expect(recorded[0].collectionCode).toBe('work_orders');
    expect(recorded[0].context).toEqual({ operation: 'bulk_update', userId: 'user-9' });
    expect(recorded[0].error).toBeInstanceOf(Error);
    expect((recorded[0].error as Error).message).toBe('outbox transport down');
  });

  it('bulk delete with one failed event publish records a runtime_anomaly and continues', async () => {
    const { service, recorded, outboxService, runtimeAnomaly } = buildService();

    const result = await service.bulkDelete(
      { userId: 'user-9' } as any,
      'work_orders',
      ['rec-1', 'rec-2', 'rec-3'],
    );

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(3);
    expect(outboxService.enqueueRecordEvent).toHaveBeenCalledTimes(3);

    expect(runtimeAnomaly.record).toHaveBeenCalledTimes(1);
    expect(recorded[0].kind).toBe('bulk_partial_failure');
    expect(recorded[0].serviceCode).toBe('svc-data');
    expect(recorded[0].recordId).toBe('rec-2');
    expect(recorded[0].context).toEqual({ operation: 'bulk_delete', userId: 'user-9' });
  });
});
