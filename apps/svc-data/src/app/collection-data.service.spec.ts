import { DataSource, EntityManager } from 'typeorm';
import { CollectionDataService } from './collection-data.service';
import { ValidationService } from './validation/validation.service';
import { DefaultValueService } from '../../../api/src/app/data/defaults/default-value.service';
import { EventOutboxService } from '../../../api/src/app/data/events/event-outbox.service';

/**
 * Chaos test for the audit-rollback contract on the svc-data CRUD path.
 *
 * Simulates TypeORM's transactional semantics:
 *   - dataSource.transaction(fn) runs fn
 *   - if fn (or anything inside it, including audit save) throws, all writes
 *     made through the transactional EntityManager are discarded
 *   - if fn resolves, all writes are flushed
 *
 * The contract under test: when audit save fails AFTER a record mutation has
 * been issued, neither the record nor the audit row is persisted.
 */
type CommittedWrite = { kind: 'record-update' | 'audit'; payload: unknown };

function buildFakeDataSource(opts: { failAuditSave?: boolean }) {
  const committed: CommittedWrite[] = [];
  const auditSaveSpy = jest.fn();

  const buildMgr = (pending: CommittedWrite[]): EntityManager => {
    const updateExecute = jest.fn(async () => {
      pending.push({ kind: 'record-update', payload: {} });
      return { affected: 1 };
    });
    const deleteExecute = jest.fn(async () => {
      pending.push({ kind: 'record-update', payload: {} });
      return { affected: 1 };
    });
    const insertExecute = jest.fn(async () => {
      pending.push({ kind: 'record-update', payload: {} });
      return { identifiers: [{ id: 'rec-1' }] };
    });

    const mgr: Partial<EntityManager> = {
      getRepository: jest.fn((entity: any) => {
        const name = entity?.name || String(entity);
        if (name === 'AuditLog') {
          return {
            create: (e: any) => e,
            save: jest.fn(async (entries: any) => {
              auditSaveSpy(entries);
              if (opts.failAuditSave) {
                throw new Error('audit save failed');
              }
              const list = Array.isArray(entries) ? entries : [entries];
              list.forEach((entry: any) => pending.push({ kind: 'audit', payload: entry }));
              return list;
            }),
          } as any;
        }
        if (name === 'InstanceEventOutbox') {
          return {
            create: (e: any) => e,
            save: jest.fn(async (e: any) => e),
          } as any;
        }
        return {
          create: (e: any) => e,
          save: jest.fn(async (e: any) => e),
        } as any;
      }),
      query: jest.fn(async () => [{ id: 'rec-1', status: 'open' }]) as any,
    };

    (mgr as any).createQueryBuilder = jest.fn(() => ({
      insert: () => ({
        into: () => ({
          values: () => ({ returning: () => ({ execute: insertExecute }) }),
        }),
      }),
      update: () => ({
        set: () => ({ where: () => ({ execute: updateExecute }) }),
      }),
      delete: () => ({
        from: () => ({ where: () => ({ execute: deleteExecute }) }),
      }),
    }));

    return mgr as EntityManager;
  };

  const dataSource = {
    transaction: jest.fn(async <T,>(fn: (m: EntityManager) => Promise<T>): Promise<T> => {
      const pending: CommittedWrite[] = [];
      const mgr = buildMgr(pending);
      const result = await fn(mgr); // throw propagates → pending discarded
      committed.push(...pending);
      return result;
    }),
    getRepository: jest.fn(() => ({
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: () => ({}),
        where: () => ({}),
        andWhere: () => ({}),
        orderBy: () => ({}),
        addOrderBy: () => ({}),
        getOne: jest.fn(async () => null),
        getMany: jest.fn(async () => []),
      })),
    })),
  } as unknown as DataSource;

  return { dataSource, committed, auditSaveSpy };
}

describe('CollectionDataService — transactional audit', () => {
  function buildService(dataSource: DataSource): CollectionDataService {
    // W1.5 renamed the AuthorizationService methods from `*Table` to
    // `*Collection`. The CRUD path resolves access by collection id; the
    // mock mirrors every variant the SUT touches so a future rename does
    // not silently re-break the chaos test.
    const authz: any = {
      ensureCollectionAccess: jest.fn(async () => undefined),
      getAuthorizedFieldsForCollection: jest.fn(
        async (_ctx: any, _id: string, fields: any[]) =>
          fields.map((f: any) => ({ ...f, canRead: true, canWrite: true })),
      ),
      buildCollectionRowLevelClause: jest.fn(async () => null),
      buildRowLevelClause: jest.fn(async () => null),
    };
    const validation: any = {
      validateRecord: jest.fn(async () => ({ isValid: true, properties: [] })),
      getErrorMessages: jest.fn(() => []),
    };
    const defaultValue: any = {
      applyDefaults: jest.fn(async (data: any) => data),
    };
    const outbox = {
      enqueueRecordEvent: jest.fn(async () => undefined),
    } as unknown as EventOutboxService;
    // After Plan Fix 1 PR 4, the chaos test no longer mocks the
    // local automation executor — collection-data calls
    // SyncTriggerClientService.executeSyncTrigger directly. A no-op
    // mock returning the record unchanged keeps the chaos test
    // focused on the audit-rollback contract.
    const syncTriggerClient: any = {
      executeSyncTrigger: jest.fn(async (
        _ctx: unknown,
        args: { record: Record<string, unknown> },
      ) => ({
        modifiedRecord: args.record ?? {},
        errors: [],
        warnings: [],
        asyncQueue: [],
        aborted: false,
      })),
    };
    // runComputedDispatch calls applyOnSave (returns merged record).
    // applyOnDelete is the per-row hook used by single-record delete.
    const computedDispatcher: any = {
      applyOnSave: jest.fn(async ({ record }: { record: Record<string, unknown> }) => record ?? {}),
      applyOnDelete: jest.fn(async () => undefined),
    };
    const runtimeAnomaly: any = {
      record: jest.fn(async () => undefined),
    };

    return new CollectionDataService(
      dataSource,
      authz,
      validation as ValidationService,
      defaultValue as DefaultValueService,
      outbox,
      syncTriggerClient,
      computedDispatcher,
      runtimeAnomaly,
    );
  }

  it('rolls back update mutation when audit save fails', async () => {
    const { dataSource, committed, auditSaveSpy } = buildFakeDataSource({ failAuditSave: true });
    const service = buildService(dataSource);

    const collection = {
      id: 'c-1',
      code: 'incidents',
      tableName: 'incidents',
      isActive: true,
    } as any;
    (service as any).getCollection = jest.fn(async () => collection);
    (service as any).getProperties = jest.fn(async () => [
      { id: 'p-1', code: 'status', columnName: 'status', name: 'Status', isSystem: false },
    ]);
    (service as any).getOne = jest.fn(async () => ({
      record: { id: 'rec-1', status: 'open' },
      fields: [],
    }));
    (service as any).validateUniqueConstraints = jest.fn(async () => []);

    const ctx = { userId: 'u-1', roles: [], permissions: [], isAdmin: false } as any;

    await expect(
      service.update(ctx, 'incidents', 'rec-1', { status: 'closed' }),
    ).rejects.toThrow('audit save failed');

    // Critical: zero record updates AND zero audit rows committed.
    expect(committed.filter((w) => w.kind === 'record-update')).toHaveLength(0);
    expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(0);
    expect(auditSaveSpy).toHaveBeenCalled(); // it was attempted
  });

  it('commits both record mutation and audit on update success', async () => {
    const { dataSource, committed } = buildFakeDataSource({});
    const service = buildService(dataSource);

    const collection = {
      id: 'c-1',
      code: 'incidents',
      tableName: 'incidents',
      isActive: true,
    } as any;
    (service as any).getCollection = jest.fn(async () => collection);
    (service as any).getProperties = jest.fn(async () => [
      { id: 'p-1', code: 'status', columnName: 'status', name: 'Status', isSystem: false },
    ]);
    (service as any).getOne = jest.fn(async () => ({
      record: { id: 'rec-1', status: 'open' },
      fields: [],
    }));
    (service as any).validateUniqueConstraints = jest.fn(async () => []);

    const ctx = { userId: 'u-1', roles: [], permissions: [], isAdmin: false } as any;

    await service.update(ctx, 'incidents', 'rec-1', { status: 'closed' });

    expect(committed.filter((w) => w.kind === 'record-update')).toHaveLength(1);
    expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(1);
  });

  it('rolls back delete mutation when audit save fails', async () => {
    const { dataSource, committed } = buildFakeDataSource({ failAuditSave: true });
    const service = buildService(dataSource);

    const collection = {
      id: 'c-1',
      code: 'incidents',
      tableName: 'incidents',
      isActive: true,
    } as any;
    (service as any).getCollection = jest.fn(async () => collection);
    (service as any).getOne = jest.fn(async () => ({
      record: { id: 'rec-1' },
      fields: [],
    }));

    const ctx = { userId: 'u-1', roles: [], permissions: [], isAdmin: false } as any;

    await expect(service.delete(ctx, 'incidents', 'rec-1')).rejects.toThrow('audit save failed');

    expect(committed.filter((w) => w.kind === 'record-update')).toHaveLength(0);
    expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(0);
  });
});

/**
 * W2.D — Verifies the partial-failure paths in bulkUpdate/bulkDelete record
 * a runtime anomaly when individual rows fail, while still draining the rest
 * of the batch. After W1.6, bulkUpdate routes each row through the
 * single-record `update()` pipeline (so the per-row anomaly hook lives in
 * the catch around `this.update`), and bulkDelete emits outbox events
 * inside the withAudit transaction with the rollup recompute happening
 * post-commit (so the per-row anomaly hook lives around `applyOnDelete`).
 */
describe('CollectionDataService — bulk partial-failure anomaly recording (W2.D)', () => {
  const collection = {
    id: 'col-1',
    code: 'work_orders',
    tableName: 'work_orders',
  } as any;

  function buildBulkService(opts: {
    updateFailures?: Set<string>;
    rollupFailures?: Set<string>;
  } = {}) {
    const dataSource: any = {
      getRepository: jest.fn(() => ({
        create: jest.fn((e: any) => e),
        save: jest.fn(async () => undefined),
        findOne: jest.fn(async () => null),
        find: jest.fn(async () => []),
      })),
      // bulkDelete uses withAudit (transaction) and bulkUpdate uses
      // dataSource.createQueryBuilder for nothing meaningful here because
      // we stub `this.update` and `fetchRecordsByIdsWithManager` directly.
      transaction: jest.fn(async <T,>(fn: (m: EntityManager) => Promise<T>): Promise<T> => {
        const mgr = {
          getRepository: jest.fn(() => ({
            create: (e: any) => e,
            save: jest.fn(async () => undefined),
          })),
          createQueryBuilder: jest.fn(() => ({
            delete: () => ({
              from: () => ({
                whereInIds: () => ({ execute: jest.fn(async () => ({ affected: 3 })) }),
              }),
            }),
          })),
          query: jest.fn(async () => []),
        } as unknown as EntityManager;
        return fn(mgr);
      }),
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
      ensureCollectionAccess: jest.fn(async () => undefined),
      getAuthorizedFieldsForCollection: jest.fn(async () => [
        { code: 'status', canRead: true, canWrite: true },
      ]),
      filterWritableFieldsForCollection: jest.fn(async (_ctx: any, _c: any, p: any) => p),
    };

    const validationService: any = {};
    const defaultValueService: any = {};
    const outboxService: any = {
      enqueueRecordEvent: jest.fn(async () => undefined),
    };
    const computedDispatcher: any = {
      applyOnInsert: jest.fn(async () => ({})),
      applyOnUpdate: jest.fn(async () => ({})),
      applyOnDelete: jest.fn(async ({ deletedRecord }: any) => {
        const id = deletedRecord.id as string;
        if (opts.rollupFailures?.has(id)) {
          throw new Error(`rollup recompute failed for ${id}`);
        }
      }),
    };

    const recorded: any[] = [];
    const runtimeAnomaly: any = {
      record: jest.fn(async (event: any) => {
        recorded.push(event);
      }),
    };

    const syncTriggerClient: any = {
      executeSyncTrigger: jest.fn(async (_ctx: unknown, args: { record: Record<string, unknown> }) => ({
        modifiedRecord: args.record ?? {},
        errors: [],
        warnings: [],
        asyncQueue: [],
        aborted: false,
      })),
    };

    const service = new CollectionDataService(
      dataSource,
      authz,
      validationService,
      defaultValueService,
      outboxService,
      syncTriggerClient,
      computedDispatcher,
      runtimeAnomaly,
    );

    // Stubs for the private/public methods that bulkUpdate / bulkDelete
    // touch. bulkUpdate routes each row through `this.update`, so we stub
    // that to fail for rows in updateFailures.
    (service as any).getCollection = jest.fn(async () => collection);
    (service as any).getProperties = jest.fn(async () => [
      { code: 'status', columnName: 'status', name: 'Status' },
    ]);
    (service as any).filterIdsByRowLevel = jest.fn(async (_c: any, _t: any, ids: string[]) => ids);
    (service as any).fetchRecordsByIdsWithManager = jest.fn(async (_m: any, _t: any, ids: string[]) =>
      ids.map((id) => ({ id, status: 'open' })),
    );
    (service as any).ensureSafeIdentifier = jest.fn((s: string) => s);

    if (opts.updateFailures) {
      (service as any).update = jest.fn(async (_ctx: any, _c: any, id: string) => {
        if (opts.updateFailures!.has(id)) {
          throw new Error(`row ${id} update failed`);
        }
        return { id, status: 'closed' };
      });
    } else {
      (service as any).update = jest.fn(async (_ctx: any, _c: any, id: string) => ({ id, status: 'closed' }));
    }

    return { service, recorded, runtimeAnomaly, computedDispatcher, outboxService };
  }

  it('bulk update with one failing row records a runtime_anomaly and continues', async () => {
    const { service, recorded, runtimeAnomaly } = buildBulkService({
      updateFailures: new Set(['rec-2']),
    });

    const result = await service.bulkUpdate(
      { userId: 'user-9', roles: [], permissions: [], isAdmin: false } as any,
      'work_orders',
      ['rec-1', 'rec-2', 'rec-3'],
      { status: 'closed' },
    );

    // 2 successful updates, 1 skipped → success=false (failureSkippedIds.length > 0)
    expect(result.updatedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.skippedIds).toContain('rec-2');

    // Exactly one anomaly should have been recorded for rec-2.
    expect(runtimeAnomaly.record).toHaveBeenCalledTimes(1);
    expect(recorded[0].kind).toBe('bulk_partial_failure');
    expect(recorded[0].serviceCode).toBe('svc-data');
    expect(recorded[0].recordId).toBe('rec-2');
    expect(recorded[0].collectionCode).toBe('work_orders');
    expect(recorded[0].context).toEqual({ operation: 'bulk_update', userId: 'user-9' });
    expect(recorded[0].error).toBeInstanceOf(Error);
    expect((recorded[0].error as Error).message).toBe('row rec-2 update failed');
  });

  it('bulk delete with one failing rollup records a runtime_anomaly and continues', async () => {
    const { service, recorded, runtimeAnomaly } = buildBulkService({
      rollupFailures: new Set(['rec-2']),
    });

    const result = await service.bulkDelete(
      { userId: 'user-9', roles: [], permissions: [], isAdmin: false } as any,
      'work_orders',
      ['rec-1', 'rec-2', 'rec-3'],
    );

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(3);

    // Exactly one anomaly should have been recorded for rec-2's rollup recompute.
    expect(runtimeAnomaly.record).toHaveBeenCalledTimes(1);
    expect(recorded[0].kind).toBe('bulk_partial_failure');
    expect(recorded[0].serviceCode).toBe('svc-data');
    expect(recorded[0].recordId).toBe('rec-2');
    expect(recorded[0].context).toEqual({ operation: 'bulk_delete', userId: 'user-9' });
  });
});
