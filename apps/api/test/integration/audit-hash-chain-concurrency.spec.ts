/**
 * F042 — Audit hash-chain concurrency stress test.
 *
 * Canon §10 ("every action must be explainable") requires the audit log
 * to remain a single linear hash-linked chain. F042 surfaced a read-then-
 * write race in the chain-extension path: under concurrent audit inserts
 * two transactions could read the same predecessor `hash` and both write
 * rows pointing back to it — forking the chain.
 *
 * Subscriber fix:
 *   libs/instance-db/src/lib/subscribers/audit-log.subscriber.ts:46 calls
 *   `SELECT pg_advisory_xact_lock(hashtext('audit_log_hash_chain'))`
 *   inside the same transaction as the chain read + insert. The lock
 *   releases automatically on commit/rollback, so concurrent inserters
 *   serialize on a single key and produce one linear chain.
 *
 * Unit-level regression guards live alongside the subscriber. This file
 * is the live-database verification called out in those specs ("a true
 * two-process Postgres concurrency test would require a live database
 * and is owned by the integration-test suite").
 *
 * Stress scenario: 50 concurrent transactions, 10 audit rows each,
 * interleaved across 5 session-ids → 500 rows total. After all
 * transactions commit we assert:
 *   1. exactly 500 rows present (chain length).
 *   2. exactly one row has `previousHash IS NULL` (single genesis).
 *   3. every non-genesis row's `previousHash` resolves to an existing
 *      row whose `hash` equals that `previousHash` (no gaps, no forks).
 *   4. every row's `hash` recomputes deterministically from
 *      `(previousHash || canonical_payload)` via the same hashing helper
 *      the subscriber uses.
 *
 * Non-flakiness: the assertions run in a 5-iteration outer loop so a
 * single `nx test` invocation exercises the stress pattern five times.
 *
 * The AuditLog entity has no `sessionId` column — the chain is platform-
 * wide. "5 distinct sessions" in the plan is exercised by tagging each
 * row's `permissionCode` with `session-<n>` so the work units interleave
 * across the chain. Test-tagged rows isolate via a per-suite
 * `recordId` UUID, allowing the test to filter its own writes without
 * disturbing unrelated audit data — though `createTestDataSource()`
 * provisions a fresh database per run anyway.
 */

import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  AuditLog,
  AuditLogSubscriber,
  User,
  buildAuditLogHash,
  buildAuditLogHashPayload,
  withAudit,
} from '@hubblewave/instance-db';
import { createTestDataSource } from '../helpers/test-database';

const TRANSACTIONS = 50;
const ROWS_PER_TRANSACTION = 10;
const SESSION_COUNT = 5;
const EXPECTED_ROW_COUNT = TRANSACTIONS * ROWS_PER_TRANSACTION;
const STRESS_RUNS = 5;

describe('audit hash-chain concurrency (F042)', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const created = await createTestDataSource({
      entities: [AuditLog, User],
      subscribers: [AuditLogSubscriber],
    });
    dataSource = created.dataSource;
    cleanup = created.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  // Reset between iterations so each run faces an empty chain (genesis
  // assertion requires it). TRUNCATE is faster than DELETE for a 500-row
  // table; both reset sequence-like state that the chain doesn't use.
  async function truncateAuditLogs(): Promise<void> {
    await dataSource.query('TRUNCATE TABLE "audit_logs"');
  }

  // Drive one transaction's worth of audit events. Each transaction
  // contributes ROWS_PER_TRANSACTION rows; sessions interleave so the
  // global chain mixes rows from different sessions row-by-row.
  async function runOneTransaction(transactionIndex: number): Promise<void> {
    await withAudit(dataSource, async (_mgr, recordAudit) => {
      for (let i = 0; i < ROWS_PER_TRANSACTION; i++) {
        const sessionIndex =
          (transactionIndex + i) % SESSION_COUNT;
        recordAudit({
          action: 'create',
          collectionCode: 'audit_chain_stress',
          recordId: randomUUID(),
          permissionCode: `session-${sessionIndex}`,
          newValues: {
            transactionIndex,
            innerIndex: i,
            session: sessionIndex,
          },
        });
      }
    });
  }

  // Replay a row's hash from the helper used by the subscriber. The
  // helper takes the entity + the predecessor hash and serializes
  // canonically (sorted keys, ISO-8601 createdAt). Any drift between
  // this re-hash and the stored `hash` fails the chain-integrity
  // assertion.
  function recomputeHash(row: AuditLog): string {
    return buildAuditLogHash(buildAuditLogHashPayload(row, row.previousHash ?? null));
  }

  // The full per-run check: spawn the parallel transactions, then walk
  // the resulting rows and assert chain integrity.
  async function runStressIteration(iteration: number): Promise<void> {
    await truncateAuditLogs();

    const transactions = Array.from({ length: TRANSACTIONS }, (_, idx) =>
      runOneTransaction(idx),
    );
    await Promise.all(transactions);

    const rows = await dataSource
      .getRepository(AuditLog)
      .createQueryBuilder('audit')
      .orderBy('audit.createdAt', 'ASC')
      .addOrderBy('audit.id', 'ASC')
      .getMany();

    // ── Assertion 1: chain length ─────────────────────────────────────
    expect(rows).toHaveLength(EXPECTED_ROW_COUNT);

    // ── Assertion 2: exactly one genesis row ──────────────────────────
    const genesisRows = rows.filter((r) => r.previousHash === null);
    expect(genesisRows).toHaveLength(1);

    // ── Assertion 3: no gaps + no forks ───────────────────────────────
    // Build hash → row index. Every row's `hash` must be unique
    // (collisions would let a fork hide); every non-genesis row's
    // `previousHash` must resolve to exactly one row whose `hash`
    // equals it. We additionally assert the predecessor map is a
    // bijection (each predecessor referenced by at most one successor)
    // — that's how forks would manifest if the lock failed.
    const hashIndex = new Map<string, AuditLog>();
    for (const row of rows) {
      expect(row.hash).toBeTruthy();
      expect(hashIndex.has(row.hash!)).toBe(false); // no hash collisions
      hashIndex.set(row.hash!, row);
    }

    const successorCount = new Map<string, number>();
    for (const row of rows) {
      const prev = row.previousHash;
      if (prev === null || prev === undefined) continue;
      const predecessor = hashIndex.get(prev);
      expect(predecessor).toBeDefined();
      successorCount.set(prev, (successorCount.get(prev) ?? 0) + 1);
    }

    // Each row except the chain tip has exactly one successor; tip has
    // zero. Any predecessor with two successors is a fork — the F042
    // signature.
    for (const count of successorCount.values()) {
      expect(count).toBe(1);
    }

    // The total successor count must equal rows-minus-genesis: 499.
    const totalSuccessors = Array.from(successorCount.values()).reduce(
      (a, b) => a + b,
      0,
    );
    expect(totalSuccessors).toBe(EXPECTED_ROW_COUNT - 1);

    // ── Assertion 4: hash continuity ─────────────────────────────────
    // Recompute every row's hash from (previousHash || canonical_payload).
    // The subscriber uses buildAuditLogHash(buildAuditLogHashPayload(...)).
    for (const row of rows) {
      const recomputed = recomputeHash(row);
      if (recomputed !== row.hash) {
        // Surface a useful failure message: which row, which session.
        throw new Error(
          `Hash mismatch at iteration ${iteration} row id=${row.id} ` +
            `session=${row.permissionCode}: stored=${row.hash} ` +
            `recomputed=${recomputed}`,
        );
      }
    }

    // ── Bonus assertion: session diversity ────────────────────────────
    // All 5 sessions must be present (cheap sanity that the test
    // actually drove the planned interleave pattern). This catches
    // accidental refactors that collapse sessions into one.
    const sessions = new Set(rows.map((r) => r.permissionCode));
    expect(sessions.size).toBe(SESSION_COUNT);
  }

  // Run the stress scenario STRESS_RUNS times in a single test. A single
  // failing iteration fails the suite — and `--repeat` style flakiness
  // would surface as one of the 5 iterations breaking. 30s timeout per
  // iteration matches the plan's expected runtime.
  it(
    `holds the chain over ${STRESS_RUNS} consecutive runs of ` +
      `${TRANSACTIONS} concurrent transactions × ${ROWS_PER_TRANSACTION} rows`,
    async () => {
      for (let i = 0; i < STRESS_RUNS; i++) {
        await runStressIteration(i);
      }
    },
    STRESS_RUNS * 30_000,
  );
});
