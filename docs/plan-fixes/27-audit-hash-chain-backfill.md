# Plan Fix 27 — Audit Hash Chain Backfill

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR
**Related canon clauses:** §10 (auditability mandatory)
**Triggering audit:** F054 — "subscriber-based audit hash means migrations can't backfill"

## Context

The audit-log hash chain (`AuditLogSubscriber` per canon §10 / F042) is computed by a TypeORM subscriber on `beforeInsert`. Rows inserted before the subscriber landed — or via raw-SQL data migrations that bypass TypeORM subscribers — have `hash IS NULL` or a `previousHash` that doesn't connect to the predecessor. The chain integrity guarantee is broken at those rows.

## What this fixes

A one-shot, idempotent backfill migration that walks audit_logs in canonical order (createdAt ASC, id ASC), recomputes hash + previousHash for any row that's missing or inconsistent, and skips rows that are already correct.

Properties:
- **Idempotent:** safe to re-run. Rows with already-correct hashes are not re-written.
- **Lock-safe:** acquires `pg_advisory_xact_lock(hashtext(AUDIT_LOG_CHAIN_LOCK_KEY))` per the subscriber's lock convention — concurrent inserts cannot fork the chain while backfill runs.
- **Forward-only:** the `down()` migration is a no-op. Reversing the backfill would re-introduce the integrity gap.

## Files

- New: `migrations/instance/1930900000001-backfill-audit-log-hash-chain.ts`
- New: `migrations/instance/1930900000001-backfill-audit-log-hash-chain.spec.ts` (in-memory determinism test)

## Acceptance

- Backfill migration runs cleanly on test fixtures
- Determinism test passes (backfill computes same hashes as subscriber for identical entities)
- Scanner gate green
- CLAUDE.md §24 amendment line landed

## Out of scope

- Detecting / repairing rows whose ORIGINAL `hash` was computed incorrectly (would require a separate validation pass + integrity report)
- Backfilling control-plane audit logs (separate concern; control-plane has its own audit infra)
- Re-running on a live customer instance (deployment concern; this PR ships the migration only)
