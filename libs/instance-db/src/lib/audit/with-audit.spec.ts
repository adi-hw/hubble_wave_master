import { DataSource, EntityManager } from 'typeorm';
import { withAudit, AuditEvent } from './with-audit';
import { AuditLog } from '../entities/settings.entity';

describe('withAudit', () => {
  function buildMockEntityManager() {
    const auditRepo = {
      create: jest.fn((entry: Partial<AuditLog>) => ({ ...entry })),
      // Per Plan Fix 41 / F042 the production code now saves entries one
      // at a time, so the mock signature accepts a single entity. The
      // assertions below check `save.mock.calls.length` against the
      // number of recorded events.
      save: jest.fn(async (entry: Partial<AuditLog>) => entry),
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
    // Plan Fix 41 / F042: each event is saved individually (not in an array).
    expect(Array.isArray(saved)).toBe(false);
    expect(saved).toMatchObject({
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

  it('persists multiple audit events as sequential individual saves (Plan Fix 41 / F042)', async () => {
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

    // F042: each recorded event must produce its own save call so the
    // AuditLogSubscriber's hash-chain extension hook fires per row.
    // Array saves batch the beforeInsert hooks → fork the chain.
    expect(auditRepo.save).toHaveBeenCalledTimes(2);
    const firstSaved = auditRepo.save.mock.calls[0][0];
    const secondSaved = auditRepo.save.mock.calls[1][0];
    expect(Array.isArray(firstSaved)).toBe(false);
    expect(Array.isArray(secondSaved)).toBe(false);
    expect(firstSaved).toMatchObject({ recordId: 'r-1' });
    expect(secondSaved).toMatchObject({ recordId: 'r-2' });
  });

  it('rolls back when a per-row audit save fails mid-flush (Plan Fix 41 / F042)', async () => {
    // Two events recorded; first save succeeds, second fails. The
    // transaction-callback rejects on the second save's throw, and the
    // wrapping `dataSource.transaction` aborts both the data mutation
    // and the first audit row.
    const calls: Array<Partial<AuditLog>> = [];
    const auditRepo = {
      create: jest.fn((entry: Partial<AuditLog>) => entry),
      save: jest.fn(async (entry: Partial<AuditLog>) => {
        calls.push(entry);
        if (calls.length === 2) {
          throw new Error('second audit save failed');
        }
        return entry;
      }),
    };
    const mgr = {
      getRepository: jest.fn(() => auditRepo),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        async <T,>(fn: (m: EntityManager) => Promise<T>): Promise<T> => fn(mgr),
      ),
    } as unknown as DataSource;

    await expect(
      withAudit(dataSource, async (_mgr, recordAudit) => {
        recordAudit({ action: 'create', collectionCode: 'a', recordId: 'r-1' });
        recordAudit({ action: 'create', collectionCode: 'a', recordId: 'r-2' });
      }),
    ).rejects.toThrow('second audit save failed');

    // First save fired; the second's throw rejected the transaction
    // callback, which would unwind the surrounding tx in production.
    expect(auditRepo.save).toHaveBeenCalledTimes(2);
    expect(calls[0]).toMatchObject({ recordId: 'r-1' });
  });

  it('opens exactly one transaction per call', async () => {
    const { mgr } = buildMockEntityManager();
    const dataSource = buildMockDataSource(mgr);

    await withAudit(dataSource, async () => undefined);

    expect((dataSource.transaction as jest.Mock).mock.calls).toHaveLength(1);
  });
});
