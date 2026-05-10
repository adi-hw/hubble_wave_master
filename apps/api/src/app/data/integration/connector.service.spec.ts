import { DataSource, EntityManager } from 'typeorm';
import { ConnectorService } from './connector.service';

/**
 * Chaos tests for the audit-rollback contract on the connector sync path.
 *
 * Mirrors the collection-data.service.spec.ts approach: simulate the
 * transactional semantics of `dataSource.transaction(fn)` so that an audit
 * save failure after a record write rolls back both the record write and
 * the audit row.
 */

type CommittedWrite = {
  kind: 'sync-run' | 'sync-config' | 'record-insert' | 'record-update' | 'audit';
  payload: unknown;
};

function buildFakeDataSource(opts: { failAuditSave?: boolean }) {
  const committed: CommittedWrite[] = [];
  const auditSaveSpy = jest.fn();

  const buildMgr = (pending: CommittedWrite[]): EntityManager => {
    const insertExecute = jest.fn(async () => {
      pending.push({ kind: 'record-insert', payload: {} });
      return { identifiers: [{ id: 'rec-1' }] };
    });
    const updateExecute = jest.fn(async () => {
      pending.push({ kind: 'record-update', payload: {} });
      return { affected: 1 };
    });

    const mgr: any = {
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
              list.forEach((entry: any) =>
                pending.push({ kind: 'audit', payload: entry }),
              );
              return list;
            }),
          };
        }
        if (name === 'SyncRun') {
          return {
            create: (e: any) => e,
            save: jest.fn(async (e: any) => {
              const persisted = { ...e, id: e.id ?? 'run-1' };
              pending.push({ kind: 'sync-run', payload: persisted });
              return persisted;
            }),
          };
        }
        if (name === 'SyncConfiguration') {
          return {
            create: (e: any) => e,
            save: jest.fn(async (e: any) => {
              pending.push({ kind: 'sync-config', payload: e });
              return e;
            }),
          };
        }
        if (name === 'InstanceEventOutbox') {
          return {
            create: (e: any) => e,
            save: jest.fn(async (e: any) => e),
          };
        }
        return {
          create: (e: any) => e,
          save: jest.fn(async (e: any) => e),
        };
      }),
      query: jest.fn(async () => [{ id: 'rec-1', name: 'rec' }]),
      createQueryBuilder: jest.fn(() => ({
        insert: () => ({
          into: () => ({
            values: () => ({ returning: () => ({ execute: insertExecute }) }),
          }),
        }),
        update: () => ({
          set: () => ({ where: () => ({ execute: updateExecute }) }),
        }),
      })),
    };

    return mgr as EntityManager;
  };

  const dataSource = {
    transaction: jest.fn(
      async <T,>(fn: (m: EntityManager) => Promise<T>): Promise<T> => {
        const pending: CommittedWrite[] = [];
        const mgr = buildMgr(pending);
        const result = await fn(mgr); // throw propagates → pending discarded
        committed.push(...pending);
        return result;
      },
    ),
    manager: {} as EntityManager,
  } as unknown as DataSource;

  return { dataSource, committed, auditSaveSpy };
}

function buildService(dataSource: DataSource): ConnectorService {
  const noopRepo: any = {
    findOne: jest.fn(async () => null),
    findAndCount: jest.fn(async () => [[], 0]),
    find: jest.fn(async () => []),
    save: jest.fn(async (e: any) => e),
    delete: jest.fn(async () => undefined),
    update: jest.fn(async () => undefined),
    create: jest.fn((e: any) => e),
  };

  const eventEmitter: any = { emit: jest.fn() };
  const authz: any = {
    ensureCollectionAccess: jest.fn(async () => undefined),
  };
  const outbox: any = {
    enqueueRecordEvent: jest.fn(async () => undefined),
  };
  const credentials: any = {
    resolveCredentials: jest.fn(async () => ({})),
  };

  return new ConnectorService(
    noopRepo,
    noopRepo,
    noopRepo,
    noopRepo,
    noopRepo,
    noopRepo,
    noopRepo,
    eventEmitter,
    dataSource,
    authz,
    outbox,
    credentials,
  );
}

describe('ConnectorService — transactional audit', () => {
  it('rolls back sync-run write when audit save fails on runSync', async () => {
    const { dataSource, committed, auditSaveSpy } = buildFakeDataSource({
      failAuditSave: true,
    });
    const service = buildService(dataSource);

    // Stub the lookup so runSync proceeds into the withAudit block.
    (service as any).findSyncConfigById = jest.fn(async () => ({
      id: 'cfg-1',
      connectionId: 'conn-1',
      direction: 'inbound',
      schedule: undefined,
      mapping: null,
      mappingId: null,
    }));

    await expect(service.runSync('cfg-1')).rejects.toThrow(
      'audit save failed',
    );

    // Critical: the SyncRun write must be discarded along with the audit row.
    expect(committed.filter((w) => w.kind === 'sync-run')).toHaveLength(0);
    expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(0);
    // The audit save was attempted (proves we reached the audit flush).
    expect(auditSaveSpy).toHaveBeenCalled();
  });

  it('commits sync-run + audit together when runSync succeeds', async () => {
    const { dataSource, committed } = buildFakeDataSource({});
    const service = buildService(dataSource);

    (service as any).findSyncConfigById = jest.fn(async () => ({
      id: 'cfg-1',
      connectionId: 'conn-1',
      direction: 'inbound',
      schedule: undefined,
      mapping: null,
      mappingId: null,
    }));

    // Detach the fire-and-forget executeSyncRun side effect; we only care
    // about the synchronous withAudit block.
    (service as any).executeSyncRun = jest.fn(async () => undefined);

    await service.runSync('cfg-1');

    expect(committed.filter((w) => w.kind === 'sync-run')).toHaveLength(1);
    expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(1);
  });

  it('rolls back createRecord insert when audit save fails', async () => {
    const { dataSource, committed, auditSaveSpy } = buildFakeDataSource({
      failAuditSave: true,
    });
    const service = buildService(dataSource);

    const collection: any = {
      id: 'col-1',
      code: 'incidents',
      tableName: 'incidents',
      isActive: true,
    };
    const properties: any[] = [
      {
        id: 'p-1',
        code: 'name',
        columnName: 'name',
        isRequired: false,
      },
    ];

    await expect(
      (service as any).createRecord(collection, properties, { name: 'Acme' }),
    ).rejects.toThrow('audit save failed');

    expect(committed.filter((w) => w.kind === 'record-insert')).toHaveLength(0);
    expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(0);
    expect(auditSaveSpy).toHaveBeenCalled();
  });

  it('commits createRecord insert + audit together on success', async () => {
    const { dataSource, committed } = buildFakeDataSource({});
    const service = buildService(dataSource);

    const collection: any = {
      id: 'col-1',
      code: 'incidents',
      tableName: 'incidents',
      isActive: true,
    };
    const properties: any[] = [
      {
        id: 'p-1',
        code: 'name',
        columnName: 'name',
        isRequired: false,
      },
    ];

    await (service as any).createRecord(collection, properties, {
      name: 'Acme',
    });

    expect(committed.filter((w) => w.kind === 'record-insert')).toHaveLength(1);
    expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(1);
  });
});
