import { DataSource, EntityManager } from 'typeorm';
import { DataService } from './data.service';

/**
 * Chaos test for the audit-rollback contract on the DataService CRUD path
 * (W3.C). Covers create / update / delete / bulkUpdate / bulkDelete.
 *
 * Mirrors the W1.6 collection-data.service.spec pattern: a fake DataSource
 * that simulates TypeORM transactional semantics — pending writes only
 * commit if the wrapped function resolves; throwing inside (including from
 * the audit save) discards the pending writes.
 *
 * The contract under test: when audit save fails AFTER the data mutation
 * has been issued, neither the data write nor the audit row is persisted.
 */

type CommittedWrite = { kind: 'record-mutation' | 'audit'; payload: unknown };

function buildFakeDataSource(opts: { failAuditSave?: boolean }) {
  const committed: CommittedWrite[] = [];
  const auditSaveSpy = jest.fn();

  const buildMgr = (pending: CommittedWrite[]): EntityManager => {
    const updateExecute = jest.fn(async () => {
      pending.push({ kind: 'record-mutation', payload: { op: 'update' } });
      return { affected: 1 };
    });
    const deleteExecute = jest.fn(async () => {
      pending.push({ kind: 'record-mutation', payload: { op: 'delete' } });
      return { affected: 1 };
    });
    const bulkUpdateExecute = jest.fn(async () => {
      pending.push({ kind: 'record-mutation', payload: { op: 'bulk-update' } });
      return { affected: 3 };
    });
    const bulkDeleteExecute = jest.fn(async () => {
      pending.push({ kind: 'record-mutation', payload: { op: 'bulk-delete' } });
      return { affected: 3 };
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
        return {
          create: (e: any) => e,
          save: jest.fn(async (e: any) => e),
        } as any;
      }),
      // For raw INSERTs in create()
      query: jest.fn(async (sql: string) => {
        if (/INSERT\s+INTO/i.test(sql)) {
          pending.push({ kind: 'record-mutation', payload: { op: 'insert' } });
          return [{ id: 'rec-1' }];
        }
        return [];
      }) as any,
    };

    // Chained query-builder mocks per operation type. The chain shape
    // mirrors what data.service.ts builds:
    //   single update: .update(table).set(values).where(...)
    //   single delete: .delete().from(table).where(...)
    //   bulk update:   .update(table).set(values).whereInIds(ids)
    //   bulk delete:   .delete().from(table).whereInIds(ids)
    (mgr as any).createQueryBuilder = jest.fn(() => {
      const updateChain: any = {
        set: jest.fn(() => updateChain),
        where: jest.fn(() => updateChain),
        whereInIds: jest.fn(() => bulkUpdateChain),
        andWhere: jest.fn(() => updateChain),
        setParameters: jest.fn(() => updateChain),
        execute: updateExecute,
      };
      const bulkUpdateChain: any = {
        andWhere: jest.fn(() => bulkUpdateChain),
        setParameters: jest.fn(() => bulkUpdateChain),
        execute: bulkUpdateExecute,
      };
      const deleteChain: any = {
        where: jest.fn(() => deleteChain),
        whereInIds: jest.fn(() => bulkDeleteChain),
        andWhere: jest.fn(() => deleteChain),
        setParameters: jest.fn(() => deleteChain),
        execute: deleteExecute,
      };
      const bulkDeleteChain: any = {
        andWhere: jest.fn(() => bulkDeleteChain),
        setParameters: jest.fn(() => bulkDeleteChain),
        execute: bulkDeleteExecute,
      };
      return {
        update: jest.fn(() => updateChain),
        delete: jest.fn(() => ({
          from: jest.fn(() => deleteChain),
        })),
      };
    });

    return mgr as EntityManager;
  };

  const dataSource = {
    transaction: jest.fn(async <T,>(fn: (m: EntityManager) => Promise<T>): Promise<T> => {
      const pending: CommittedWrite[] = [];
      const mgr = buildMgr(pending);
      const result = await fn(mgr); // throw propagates -> pending discarded
      committed.push(...pending);
      return result;
    }),
    // Outside-transaction queries (e.g. hierarchical post-commit) are
    // tracked separately; tests below don't exercise them.
    query: jest.fn(async () => []),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => ({ total: '1' })),
      getRawMany: jest.fn(async () => [{ id: 'rec-1' }]),
    })),
  } as unknown as DataSource;

  return { dataSource, committed, auditSaveSpy };
}

function buildService(dataSource: DataSource): DataService {
  const modelRegistry: any = {
    getCollection: jest.fn(async () => ({
      collectionId: 'col-1',
      storageSchema: 'public',
      storageTable: 'incidents',
    })),
    getProperties: jest.fn(async () => [
      { code: 'status', storagePath: 'status', typeCode: 'text' },
    ]),
  };
  const authz: any = {
    ensureCollectionAccess: jest.fn(async () => undefined),
    filterReadableFieldsForCollection: jest.fn(async (_ctx: any, _c: any, p: any) => p),
    filterWritableFieldsForCollection: jest.fn(async (_ctx: any, _c: any, p: any) => p),
    buildCollectionRowLevelClause: jest.fn(async () => ({ clauses: [], params: {} })),
    maskCollectionRecord: jest.fn(async (_ctx: any, row: any) => row),
  };
  const hierarchical: any = {
    computePath: jest.fn(async () => 'rec-1'),
    assertNoCycle: jest.fn(async () => undefined),
    reparent: jest.fn(async () => undefined),
  };
  return new DataService(modelRegistry, dataSource, authz, hierarchical);
}

const ctx: any = { userId: 'u-1', roles: [], permissions: [], isAdmin: false };

describe('DataService — transactional audit (W3.C)', () => {
  describe('create', () => {
    it('rolls back insert when audit save fails', async () => {
      const { dataSource, committed, auditSaveSpy } = buildFakeDataSource({ failAuditSave: true });
      const service = buildService(dataSource);

      await expect(
        service.create(ctx, 'incidents', { status: 'open' }),
      ).rejects.toThrow('audit save failed');

      expect(committed.filter((w) => w.kind === 'record-mutation')).toHaveLength(0);
      expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(0);
      expect(auditSaveSpy).toHaveBeenCalled();
    });

    it('commits insert and audit together on success', async () => {
      const { dataSource, committed } = buildFakeDataSource({});
      const service = buildService(dataSource);

      await service.create(ctx, 'incidents', { status: 'open' });

      expect(committed.filter((w) => w.kind === 'record-mutation')).toHaveLength(1);
      expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('rolls back update when audit save fails', async () => {
      const { dataSource, committed, auditSaveSpy } = buildFakeDataSource({ failAuditSave: true });
      const service = buildService(dataSource);

      await expect(
        service.update(ctx, 'incidents', 'rec-1', { status: 'closed' }),
      ).rejects.toThrow('audit save failed');

      expect(committed.filter((w) => w.kind === 'record-mutation')).toHaveLength(0);
      expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(0);
      expect(auditSaveSpy).toHaveBeenCalled();
    });

    it('commits update and audit together on success', async () => {
      const { dataSource, committed } = buildFakeDataSource({});
      const service = buildService(dataSource);

      await service.update(ctx, 'incidents', 'rec-1', { status: 'closed' });

      expect(committed.filter((w) => w.kind === 'record-mutation')).toHaveLength(1);
      expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('rolls back delete when audit save fails', async () => {
      const { dataSource, committed, auditSaveSpy } = buildFakeDataSource({ failAuditSave: true });
      const service = buildService(dataSource);

      await expect(service.delete(ctx, 'incidents', 'rec-1')).rejects.toThrow('audit save failed');

      expect(committed.filter((w) => w.kind === 'record-mutation')).toHaveLength(0);
      expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(0);
      expect(auditSaveSpy).toHaveBeenCalled();
    });

    it('commits delete and audit together on success', async () => {
      const { dataSource, committed } = buildFakeDataSource({});
      const service = buildService(dataSource);

      await service.delete(ctx, 'incidents', 'rec-1');

      expect(committed.filter((w) => w.kind === 'record-mutation')).toHaveLength(1);
      expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(1);
    });
  });

  describe('bulkUpdate', () => {
    it('rolls back bulk update when audit save fails', async () => {
      const { dataSource, committed, auditSaveSpy } = buildFakeDataSource({ failAuditSave: true });
      const service = buildService(dataSource);

      await expect(
        service.bulkUpdate(ctx, 'incidents', ['a', 'b', 'c'], { status: 'closed' }),
      ).rejects.toThrow('audit save failed');

      expect(committed.filter((w) => w.kind === 'record-mutation')).toHaveLength(0);
      expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(0);
      expect(auditSaveSpy).toHaveBeenCalled();
    });

    it('commits bulk update and audit together on success', async () => {
      const { dataSource, committed } = buildFakeDataSource({});
      const service = buildService(dataSource);

      const result = await service.bulkUpdate(ctx, 'incidents', ['a', 'b', 'c'], { status: 'closed' });

      expect(committed.filter((w) => w.kind === 'record-mutation')).toHaveLength(1);
      expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(1);
      expect(result.updatedCount).toBe(3);
    });
  });

  describe('bulkDelete', () => {
    it('rolls back bulk delete when audit save fails', async () => {
      const { dataSource, committed, auditSaveSpy } = buildFakeDataSource({ failAuditSave: true });
      const service = buildService(dataSource);

      await expect(
        service.bulkDelete(ctx, 'incidents', ['a', 'b', 'c']),
      ).rejects.toThrow('audit save failed');

      expect(committed.filter((w) => w.kind === 'record-mutation')).toHaveLength(0);
      expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(0);
      expect(auditSaveSpy).toHaveBeenCalled();
    });

    it('commits bulk delete and audit together on success', async () => {
      const { dataSource, committed } = buildFakeDataSource({});
      const service = buildService(dataSource);

      const result = await service.bulkDelete(ctx, 'incidents', ['a', 'b', 'c']);

      expect(committed.filter((w) => w.kind === 'record-mutation')).toHaveLength(1);
      expect(committed.filter((w) => w.kind === 'audit')).toHaveLength(1);
      expect(result.deletedCount).toBe(3);
    });
  });
});
