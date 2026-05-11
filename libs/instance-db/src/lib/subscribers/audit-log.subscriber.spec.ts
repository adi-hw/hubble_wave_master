import { InsertEvent, QueryRunner, EntityManager, Repository } from 'typeorm';
import { AuditLogSubscriber, AUDIT_LOG_CHAIN_LOCK_KEY } from './audit-log.subscriber';
import { AuditLog } from '../entities/settings.entity';
import { buildAuditLogHash, buildAuditLogHashPayload } from '../audit-log-hash';

/**
 * Coverage for the audit-log chain subscriber (canon §10, finding F042).
 *
 * The bug fixed here is a read-then-write race: under concurrent audit
 * inserts two transactions can both read the same predecessor hash, then
 * both insert rows pointing to it — forking the chain.
 *
 * The fix is `SELECT pg_advisory_xact_lock(hashtext('audit_log_hash_chain'))`
 * inside the same transaction as the chain read + insert. The lock releases
 * automatically on commit/rollback, so concurrent inserters serialize on a
 * single key and produce one linear chain.
 *
 * These specs assert:
 *   1. Sequential writes produce a continuous chain (pins existing behaviour).
 *   2. The advisory lock SQL is issued before the predecessor read on every
 *      insert (the F042 regression guard — if a future refactor drops the
 *      lock, this test fails).
 *   3. Lock SQL is parameterised with the exact key consumers depend on.
 *   4. Concurrent inserts (simulated by interleaving two beforeInsert calls
 *      against the same repository state) still produce a continuous chain
 *      once each acquires the lock in turn. We exercise this against a
 *      fake-DB where `pg_advisory_xact_lock` queues callers, mirroring the
 *      Postgres semantic that documents the fix.
 *
 * A true two-process Postgres concurrency test would require a live database
 * and is owned by the integration-test suite (out of scope for this
 * single-process jest config). The lock-acquisition assertion below is the
 * unit-level regression guard called out in the F042 brief.
 */

describe('AuditLogSubscriber', () => {
  type AuditRow = {
    id: string;
    hash: string | null;
    previousHash: string | null;
    createdAt: Date;
  };

  function buildFakeChainStore() {
    const rows: AuditRow[] = [];
    return {
      rows,
      latest(): AuditRow | undefined {
        if (rows.length === 0) {
          return undefined;
        }
        // Mirror the subscriber's ORDER BY: createdAt DESC, id DESC.
        return [...rows].sort((a, b) => {
          if (a.createdAt.getTime() !== b.createdAt.getTime()) {
            return b.createdAt.getTime() - a.createdAt.getTime();
          }
          return b.id.localeCompare(a.id);
        })[0];
      },
      commit(row: AuditRow) {
        rows.push(row);
      },
    };
  }

  function buildInsertEvent(
    entity: AuditLog,
    store: ReturnType<typeof buildFakeChainStore>,
    options: {
      queryLog?: Array<{ sql: string; parameters?: unknown[] }>;
      lockWaiter?: () => Promise<void>;
    } = {},
  ): InsertEvent<AuditLog> {
    const queryLog = options.queryLog ?? [];
    const queryRunner = {
      query: jest.fn(async (sql: string, parameters?: unknown[]) => {
        queryLog.push({ sql, parameters });
        if (typeof sql === 'string' && sql.includes('pg_advisory_xact_lock')) {
          if (options.lockWaiter) {
            await options.lockWaiter();
          }
          return undefined;
        }
        return undefined;
      }),
    } as unknown as QueryRunner;

    const repository = {
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => {
          const last = store.latest();
          if (!last) {
            return null;
          }
          // The query selects only `audit.hash`; mirror that contract so the
          // subscriber cannot accidentally rely on other columns.
          return { hash: last.hash };
        }),
      })),
    } as unknown as Repository<AuditLog>;

    const manager = {
      getRepository: jest.fn((token: unknown) => {
        if (token === AuditLog) {
          return repository;
        }
        throw new Error(`unexpected entity ${String(token)}`);
      }),
    } as unknown as EntityManager;

    return {
      connection: {} as InsertEvent<AuditLog>['connection'],
      queryRunner,
      manager,
      entity,
      metadata: {} as InsertEvent<AuditLog>['metadata'],
    };
  }

  /**
   * Convenience helper: drive a full beforeInsert + commit cycle against the
   * fake store, returning the resulting row.
   */
  async function insertOne(
    subscriber: AuditLogSubscriber,
    seed: Partial<AuditLog>,
    store: ReturnType<typeof buildFakeChainStore>,
    options: {
      queryLog?: Array<{ sql: string; parameters?: unknown[] }>;
      lockWaiter?: () => Promise<void>;
    } = {},
  ): Promise<AuditRow> {
    const entity = { ...seed } as unknown as AuditLog;
    const event = buildInsertEvent(entity, store, options);
    await subscriber.beforeInsert(event);
    const row: AuditRow = {
      id: entity.id ?? `row-${store.rows.length + 1}`,
      hash: entity.hash ?? null,
      previousHash: entity.previousHash ?? null,
      createdAt: entity.createdAt,
    };
    store.commit(row);
    return row;
  }

  it('issues pg_advisory_xact_lock with the canonical key before reading the predecessor', async () => {
    const subscriber = new AuditLogSubscriber();
    const store = buildFakeChainStore();
    const queryLog: Array<{ sql: string; parameters?: unknown[] }> = [];

    const entity = {
      action: 'create',
      collectionCode: 'incidents',
      recordId: '00000000-0000-0000-0000-000000000001',
    } as unknown as AuditLog;
    const event = buildInsertEvent(entity, store, { queryLog });

    await subscriber.beforeInsert(event);

    expect(queryLog).toHaveLength(1);
    expect(queryLog[0].sql).toBe('SELECT pg_advisory_xact_lock(hashtext($1))');
    expect(queryLog[0].parameters).toEqual([AUDIT_LOG_CHAIN_LOCK_KEY]);

    // The lock query must be issued before the predecessor select. The
    // mocked queryBuilder is exercised by the subscriber's chain read; we
    // assert ordering via the QueryRunner mock's invocation order.
    const lockMock = event.queryRunner.query as jest.Mock;
    const repoMock = event.manager.getRepository(AuditLog).createQueryBuilder as jest.Mock;
    expect(lockMock.mock.invocationCallOrder[0]).toBeLessThan(
      repoMock.mock.invocationCallOrder[0],
    );
  });

  it('produces a continuous chain for sequential writes', async () => {
    const subscriber = new AuditLogSubscriber();
    const store = buildFakeChainStore();

    const first = await insertOne(
      subscriber,
      { id: 'r-1', action: 'create', collectionCode: 'incidents', recordId: 'rec-1' },
      store,
    );
    const second = await insertOne(
      subscriber,
      {
        id: 'r-2',
        action: 'update',
        collectionCode: 'incidents',
        recordId: 'rec-1',
        // Advance the clock so the predecessor sort is unambiguous.
        createdAt: new Date(first.createdAt.getTime() + 1000),
      },
      store,
    );
    const third = await insertOne(
      subscriber,
      {
        id: 'r-3',
        action: 'delete',
        collectionCode: 'incidents',
        recordId: 'rec-1',
        createdAt: new Date(first.createdAt.getTime() + 2000),
      },
      store,
    );

    expect(first.previousHash).toBeNull();
    expect(first.hash).toBeTruthy();
    expect(second.previousHash).toBe(first.hash);
    expect(third.previousHash).toBe(second.hash);

    // Every row's hash must reproduce from its payload + previousHash.
    const replay = (row: AuditRow, entitySeed: Partial<AuditLog>) =>
      buildAuditLogHash(
        buildAuditLogHashPayload(
          { ...(entitySeed as unknown as AuditLog), createdAt: row.createdAt },
          row.previousHash,
        ),
      );

    expect(replay(first, {
      id: 'r-1', action: 'create', collectionCode: 'incidents', recordId: 'rec-1',
    })).toBe(first.hash);
  });

  it('serializes concurrent inserts so the chain has no fork', async () => {
    const subscriber = new AuditLogSubscriber();
    const store = buildFakeChainStore();

    // Build a single-slot mutex that the fake lock query will respect. The
    // first insert to call the lock proceeds immediately; the second waits
    // until the first finishes committing. This mirrors what
    // `pg_advisory_xact_lock` does in Postgres: callers queue until the
    // holding transaction commits/rolls back.
    let holderReleased: (() => void) | null = null;
    let holderInFlight: Promise<void> | null = null;
    const acquireLock = async (): Promise<void> => {
      if (holderInFlight) {
        await holderInFlight;
      }
      let release!: () => void;
      const next = new Promise<void>((resolve) => {
        release = () => resolve();
      });
      holderInFlight = next;
      holderReleased = release;
    };
    const releaseLock = (): void => {
      const r = holderReleased;
      holderInFlight = null;
      holderReleased = null;
      if (r) r();
    };

    const runInsert = async (seed: Partial<AuditLog>): Promise<AuditRow> => {
      const entity = { ...seed } as unknown as AuditLog;
      const event = buildInsertEvent(entity, store, { lockWaiter: acquireLock });
      await subscriber.beforeInsert(event);
      // Atomic-with-lock: commit the row + release the lock together,
      // mirroring `pg_advisory_xact_lock` releasing at transaction end.
      const row: AuditRow = {
        id: entity.id!,
        hash: entity.hash ?? null,
        previousHash: entity.previousHash ?? null,
        createdAt: entity.createdAt,
      };
      store.commit(row);
      releaseLock();
      return row;
    };

    const base = new Date('2026-05-10T12:00:00.000Z');
    const [a, b] = await Promise.all([
      runInsert({
        id: 'r-a',
        action: 'create',
        collectionCode: 'incidents',
        recordId: 'rec-1',
        createdAt: base,
      }),
      runInsert({
        id: 'r-b',
        action: 'create',
        collectionCode: 'incidents',
        recordId: 'rec-2',
        createdAt: new Date(base.getTime() + 1),
      }),
    ]);

    // Exactly one row must point to null (the head); the other must point
    // to the head's hash. No forks — both pointing to null would mean two
    // chain heads, which is the F042 bug.
    const heads = [a, b].filter((r) => r.previousHash === null);
    expect(heads).toHaveLength(1);
    const head = heads[0];
    const tail = a === head ? b : a;
    expect(tail.previousHash).toBe(head.hash);
  });

  it('initialises createdAt when the entity has no timestamp', async () => {
    const subscriber = new AuditLogSubscriber();
    const store = buildFakeChainStore();

    const entity = {
      action: 'create',
      collectionCode: 'incidents',
      recordId: 'rec-1',
    } as unknown as AuditLog;
    const event = buildInsertEvent(entity, store);
    await subscriber.beforeInsert(event);

    expect(entity.createdAt).toBeInstanceOf(Date);
    expect(entity.hash).toBeTruthy();
    expect(entity.previousHash).toBeNull();
  });

  it('preserves a pre-populated createdAt', async () => {
    const subscriber = new AuditLogSubscriber();
    const store = buildFakeChainStore();

    const fixed = new Date('2026-01-01T00:00:00.000Z');
    const entity = {
      action: 'create',
      collectionCode: 'incidents',
      recordId: 'rec-1',
      createdAt: fixed,
    } as unknown as AuditLog;
    const event = buildInsertEvent(entity, store);
    await subscriber.beforeInsert(event);

    expect(entity.createdAt).toBe(fixed);
  });

  it('hashes payloads deterministically (round-trip vs. helper)', async () => {
    const subscriber = new AuditLogSubscriber();
    const store = buildFakeChainStore();

    const fixed = new Date('2026-01-01T00:00:00.000Z');
    const entity = {
      action: 'update',
      collectionCode: 'incidents',
      recordId: '00000000-0000-0000-0000-000000000001',
      userId: 'u-1',
      newValues: { status: 'closed' },
      createdAt: fixed,
    } as unknown as AuditLog;
    const event = buildInsertEvent(entity, store);
    await subscriber.beforeInsert(event);

    const expected = buildAuditLogHash(
      buildAuditLogHashPayload(entity, null),
    );
    expect(entity.hash).toBe(expected);
  });
});
