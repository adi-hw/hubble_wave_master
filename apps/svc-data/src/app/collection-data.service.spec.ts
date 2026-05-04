import { DataSource, EntityManager } from 'typeorm';
import { CollectionDataService } from './collection-data.service';
import { ValidationService } from './validation/validation.service';
import { DefaultValueService } from './defaults/default-value.service';
import { EventOutboxService } from './events/event-outbox.service';

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
    const authz: any = {
      ensureTableAccess: jest.fn(async () => undefined),
      getAuthorizedFields: jest.fn(async (_ctx: any, _t: any, fields: any[]) =>
        fields.map((f: any) => ({ ...f, canRead: true, canWrite: true })),
      ),
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

    return new CollectionDataService(
      dataSource,
      authz,
      validation as ValidationService,
      defaultValue as DefaultValueService,
      outbox,
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
