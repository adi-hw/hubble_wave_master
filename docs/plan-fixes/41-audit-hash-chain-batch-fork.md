# Plan Fix 41 — Audit hash-chain batch fork (F042)

**Status:** Proposed (PR in flight)
**Owner:** W2 Stream 4a follow-up
**Effort:** 1 PR
**Related canon clauses:** §10 (auditability is mandatory)
**Triggering audit:** F042 stress test surfaced during W2 Stream 4a Task 32 — 50 concurrent transactions × 10 audit rows × 5 sessions consistently produced 10/500 rows with `previousHash = NULL` instead of the expected 1, all from one transaction forking off the same predecessor.

## Context

`AuditLogSubscriber` extends the hash chain via a Postgres advisory transaction lock at `beforeInsert`:

```ts
await queryRunner.query(
  `SELECT pg_advisory_xact_lock(hashtext('audit_log_hash_chain'))`,
);
const predecessor = await queryRunner.manager
  .getRepository(AuditLog)
  .createQueryBuilder('a')
  .orderBy('a.createdAt', 'DESC')
  .addOrderBy('a.id', 'DESC')
  .getOne();
```

The lock is correct for **inter-transaction** concurrency: two concurrent transactions serialize on the same advisory key and produce a single linear chain.

The lock is **useless intra-transaction**: it is re-entrant on the same backend connection. When `withAudit` calls `repo.save(arrayOfEntries)`, TypeORM's `SubjectExecutor.broadcastBeforeEventsForAll()` (`node_modules/typeorm/persistence/SubjectExecutor.js:160-173`) fires `beforeInsert` for **every subject before running any INSERT**. All N entries in the batch read the same predecessor row, compute the same `previousHash`, and the resulting rows fork off one ancestor.

Symptom in the F042 reproducer: of 500 rows from 50 concurrent batched transactions, 10 rows shared `previousHash = NULL` (the batch from the first transaction to commit) and the other 49 transactions' batches each had one row branching off a sibling rather than chaining linearly.

The bug is a `withAudit` implementation detail, not a subscriber bug. The subscriber's contract is "linearize at insert boundary"; `withAudit` violated it by collecting N events and flushing them in a single batched `save([...])`.

## Target end state

1. `withAudit` flushes audit events as **individually chained inserts**: a `for...of` loop over the collected events, `await repo.save(event)` one row at a time, inside the same transaction. Each `save` triggers a separate `beforeInsert` cycle, the advisory lock holds per-row, and the chain stays linear.
2. The contract is encoded in:
   - The fixed `withAudit` source — sequential per-row saves.
   - A spec assertion that observes `auditRepo.save` is called N times (not once with an array of N).
   - A live-Postgres integration stress test that fails on the pre-fix code and passes on the fixed code.
   - A scanner rule (`audit:check`) flagging any `AuditLog`-repo `save([...])` / `insert([...])` pattern outside an explicitly approved DB-native chain writer.
3. Canon §10 amended with a behavioral clause: audit hash-chain writes must be linearized at the insert boundary; TypeORM array saves of `AuditLog` are forbidden unless a future DB-native chain writer computes both `previous_hash` and `hash` atomically.

## What this fix is NOT

- Not a Postgres-trigger / head-table redesign. Moving hash-chain ownership into the database is out of scope for W2; it would duplicate or relocate the canonical hash payload logic and turn a localized helper bug into a schema/trigger design project. Reconsider only if measured audit volume makes sequential inserts a real bottleneck.
- Not a change to `AuditLogSubscriber`. The subscriber's advisory-lock pattern is correct and remains unchanged.
- Not a change to direct single-row `AuditLog` saves elsewhere in the codebase. The subscriber serializes them correctly inter-transaction; only batched array saves are the bug.

## PR sequence

### PR 1 — F042 fix (this PR)
**What:** Per-row sequential saves in `withAudit`. Spec + integration test updates. Scanner rule. Canon amendment.

**Files:**
- Modify: `libs/instance-db/src/lib/audit/with-audit.ts` — sequential save loop.
- Modify: `libs/instance-db/src/lib/audit/with-audit.spec.ts` — assertion update + add rollback-on-audit-save-failure test.
- Add: `apps/api/test/integration/audit-hash-chain-concurrency.spec.ts` — live-Postgres stress test (50 tx × 10 rows × 5 sessions × 5 iterations).
- Modify: `apps/api/test/helpers/test-database.ts` — add `subscribers` option so the stress test can attach `AuditLogSubscriber` to the per-test datasource.
- Modify: `tools/audit-bypass-check.ts` — add the AuditLog-array-save rule + an explicit allowlist for any future approved DB-native chain writer (currently empty).
- Modify: `tools/audit-bypass-check-selftest.ts` — self-test the new rule.
- Modify: `CLAUDE.md` — §10 behavioral clause + §24 amendment entry.

**Authz:** No DI / no controllers changed.

**Edge cases to test:**
- Single event still flushes — one `save` call, one row.
- Many events flush sequentially — N `save` calls, N rows, monotonic predecessor chain.
- Rollback on wrapped-function failure — no audit rows persisted.
- Rollback on audit save failure — wrapped data mutation also rolls back.
- Live-Postgres stress: 50 concurrent transactions × 10 events × 5 sessions × 5 iterations all green (no forks, no gaps, hash continuity).

**Verification:**
- `npx nx test instance-db` — 7 suites, 74+ tests pass.
- `npx nx test api --testPathPatterns=audit-hash-chain-concurrency` — 5/5 iterations pass within 30s each.
- `npx nx test api` — 53 suites pass (no regressions).
- `npm run selftest:audit` — scanner self-test green, new bulk-save assertion fires on a synthetic violating fixture.
- `npm run audit:check` — clean on the current tree.

**Out of scope:**
- Postgres-side chain extension (trigger / generated columns / stored procedure).
- Any optimization of `AuditLogSubscriber` (e.g. precomputed bulk hash).
- Any reorganization of `audit_logs` columns or indexes.

## Acceptance

- `withAudit` no longer calls `repo.save([...])` with an array.
- Stress test passes 5/5 iterations.
- `audit:check` scanner has the new rule + self-test entry.
- Canon §10 carries the behavioral clause.
- All 8 architectural scanners stay green.
