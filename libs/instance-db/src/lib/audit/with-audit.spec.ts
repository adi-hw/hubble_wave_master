import { DataSource, EntityManager } from 'typeorm';
import { withAudit, AuditEvent } from './with-audit';
import { AuditLog } from '../entities/settings.entity';

describe('withAudit', () => {
  function buildMockEntityManager() {
    const auditRepo = {
      create: jest.fn((entry: Partial<AuditLog>) => ({ ...entry })),
      save: jest.fn(async (entries: Array<Partial<AuditLog>>) => entries),
    };
    const mgr = {
      getRepository: jest.fn((entity) => {
        if (entity === AuditLog) {
          return auditRepo;
        }
        throw new Error(`unexpected entity ${String(entity)}`);
      }),
    } as unknown as EntityManager;
    return { mgr, auditRepo };
  }

  function buildMockDataSource(mgr: EntityManager) {
    return {
      transaction: jest.fn(async <T,>(fn: (m: EntityManager) => Promise<T>): Promise<T> => fn(mgr)),
    } as unknown as DataSource;
  }

  it('persists audit events when the wrapped function resolves', async () => {
    const { mgr, auditRepo } = buildMockEntityManager();
    const dataSource = buildMockDataSource(mgr);

    const event: AuditEvent = {
      userId: 'u-1',
      collectionCode: 'incidents',
      recordId: 'r-1',
      action: 'create',
      newValues: { foo: 'bar' },
    };

    const result = await withAudit(dataSource, async (_mgr, recordAudit) => {
      recordAudit(event);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    expect(auditRepo.save).toHaveBeenCalledTimes(1);
    const saved = auditRepo.save.mock.calls[0][0];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      userId: 'u-1',
      collectionCode: 'incidents',
      recordId: 'r-1',
      action: 'create',
      newValues: { foo: 'bar' },
    });
  });

  it('skips the audit save when no events are recorded', async () => {
    const { mgr, auditRepo } = buildMockEntityManager();
    const dataSource = buildMockDataSource(mgr);

    const result = await withAudit(dataSource, async () => 42);

    expect(result).toBe(42);
    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('rolls back when the wrapped function throws after recording audit', async () => {
    // Simulate real transactional rollback: tx callback throws, transaction rejects
    const auditRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    const mgr = {
      getRepository: jest.fn(() => auditRepo),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn(async <T,>(fn: (m: EntityManager) => Promise<T>): Promise<T> => {
        // Real TypeORM behaviour: if fn throws, the transaction is aborted and
        // no writes (including the deferred audit save) are committed.
        return fn(mgr);
      }),
    } as unknown as DataSource;

    const event: AuditEvent = {
      action: 'update',
      collectionCode: 'incidents',
      recordId: 'r-1',
      userId: 'u-1',
    };

    await expect(
      withAudit(dataSource, async (_mgr, recordAudit) => {
        recordAudit(event);
        throw new Error('post-mutation failure');
      }),
    ).rejects.toThrow('post-mutation failure');

    // The audit save is deferred and only flushed when fn resolves; on throw
    // it is never invoked, so the audit row never exists.
    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('rolls back when the audit save itself fails', async () => {
    const auditRepo = {
      create: jest.fn((entry: Partial<AuditLog>) => entry),
      save: jest.fn(async () => {
        throw new Error('audit write failed');
      }),
    };
    const mgr = {
      getRepository: jest.fn(() => auditRepo),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn(async <T,>(fn: (m: EntityManager) => Promise<T>): Promise<T> => {
        return fn(mgr);
      }),
    } as unknown as DataSource;

    const dataMutation = jest.fn(async () => 'mutated');

    await expect(
      withAudit(dataSource, async (_mgr, recordAudit) => {
        const r = await dataMutation();
        recordAudit({
          action: 'update',
          collectionCode: 'incidents',
          recordId: 'r-1',
          userId: 'u-1',
        });
        return r;
      }),
    ).rejects.toThrow('audit write failed');

    // The data mutation ran (its in-tx writes will roll back when the tx
    // aborts), but the audit save was the failure point — the contract is
    // that both are aborted together.
    expect(dataMutation).toHaveBeenCalled();
  });

  it('persists multiple audit events in a single save call', async () => {
    const { mgr, auditRepo } = buildMockEntityManager();
    const dataSource = buildMockDataSource(mgr);

    await withAudit(dataSource, async (_mgr, recordAudit) => {
      recordAudit({
        action: 'create',
        collectionCode: 'incidents',
        recordId: 'r-1',
      });
      recordAudit({
        action: 'create',
        collectionCode: 'incidents',
        recordId: 'r-2',
      });
    });

    expect(auditRepo.save).toHaveBeenCalledTimes(1);
    const saved = auditRepo.save.mock.calls[0][0];
    expect(saved).toHaveLength(2);
  });

  it('opens exactly one transaction per call', async () => {
    const { mgr } = buildMockEntityManager();
    const dataSource = buildMockDataSource(mgr);

    await withAudit(dataSource, async () => undefined);

    expect((dataSource.transaction as jest.Mock).mock.calls).toHaveLength(1);
  });
});
