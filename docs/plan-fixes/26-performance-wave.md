# Plan Fix 26 — Performance Wave

**Status:** In progress (W6.A — CREATE INDEX CONCURRENTLY tooling)
**Owner:** adi-hw
**Effort:** ~5 PRs (W6.A-E covering F045-F050)
**Related canon clauses:** §1 (greenfield discipline), §15 (speed never justifies decay), §17 (modular monolith)
**Triggering audit:** F045-F050 — performance posture for pilot customer load

## Context

Pilot-scale performance gaps identified in the audit:
- F045: no PgBouncer in front of per-instance Postgres
- F046: blocking `CREATE INDEX` in migrations would take ACCESS EXCLUSIVE locks on growth tables
- F047: N+1 query patterns in RBAC group resolution
- F048: JSONB columns queried with predicates lack GIN indexes
- F049/F050: dashboards aggregations recomputed per request, no materialized rollups + refresh strategy

Each is a separate PR; this plan-fix doc tracks the wave.

## PR sequence

### W6.A — CREATE INDEX CONCURRENTLY tooling (this PR / F046)

**Files landed:**
- `libs/instance-db/src/lib/migrations/utils/concurrent-index.ts` —
  `createIndexConcurrent` and `dropIndexConcurrent` helper functions.
  Exported from `@hubblewave/instance-db` barrel.
- `tools/migration-blocking-index-check.ts` — scanner that blocks new
  migrations from creating indexes on growth tables without `CREATE INDEX
  CONCURRENTLY` + `static transaction = false`.
- `tools/migration-blocking-index-check-selftest.ts` — 7-assertion self-test.
- `package.json` — `migrations:check` and `selftest:migrations` scripts added.
  `selftest:scanners` extended to include `selftest:migrations`.
- `.github/workflows/ci.yml` — new `Migration blocking-index check` step
  in the `scanners` job.
- `docs/plan-fixes/26-performance-wave.md` — this file.
- `CLAUDE.md` — §24 amendment entry.

**Scanner output (at landing):** `migrations:check: ok` — no violations in
the current migration tree.

**Legacy migration inventory:**

The following migrations create blocking indexes on growth tables. These
are pre-canon migrations that cannot be retroactively modified (they have
already run against any instance created before W6.A). The convention
applies going forward; existing indexes remain as-is.

| Migration file | Growth table | Indexes | Verdict |
|---|---|---|---|
| `migrations/instance/1766696011515-InitialSchema.ts` | `audit_logs` | 5 indexes: `created_at`, `action`, `record_id`, `collection_code`, `user_id` | Legacy — blocking acceptable (pre-pilot; these indexes were created before any customer data exists) |
| `migrations/instance/1766696011515-InitialSchema.ts` | `refresh_tokens` | 3 indexes: `is_revoked`, `expires_at`, `user_id` | Legacy — table rebuilt by `1930600000000-add-refresh-token-families.ts` |
| `migrations/instance/1803000000000-phase3-automation-tables.ts` | `automation_execution_logs` | 3 indexes: `automation_rule_id+created_at`, `record_id+created_at`, `status+created_at` | Legacy — blocking acceptable (pre-pilot) |
| `migrations/instance/1820000000001-audit-log-hash-chain.ts` | `audit_logs` | 2 indexes: `hash`, `previous_hash` | Legacy — blocking acceptable (pre-pilot) |
| `migrations/instance/1830000000000-audit-log-permission.ts` | `audit_logs` | 1 index: `permission_code+created_at` | Legacy — blocking acceptable (pre-pilot) |
| `migrations/instance/1930600000000-add-refresh-token-families.ts` | `refresh_tokens` | 4 indexes: `family_id`, `family_not_revoked`, `user_session`, `expires_at` | Legacy — pre-W6.A; no `transaction = false`. Table is new (not multi-GB yet). No retroactive fix required. |
| `migrations/control-plane/1824000000000-refresh-tokens.ts` | `refresh_tokens` | 3 indexes: `family`, `user_id`, `expires_at` | Legacy — control-plane refresh tokens; bounded growth. |

**Rationale for no retroactive fix:** All identified legacy blocking indexes
were created when the platform was pre-pilot (no customer production data).
No multi-GB tables existed when these migrations ran, so no ACCESS EXCLUSIVE
lock contention was possible. The convention is binding going forward.

A "rebuild indexes concurrently" migration is NOT required at this time
because all legacy indexes were built on empty or near-empty tables at
migration time. If a future operator audit identifies a customer instance
where a legacy index caused a long lock hold (post-pilot only), a targeted
`CREATE INDEX CONCURRENTLY ... CONCURRENTLY` rebuild can be issued as a
maintenance script rather than a TypeORM migration.

### W6.B — JSONB GIN coverage (F048, separate PR landing in parallel)

Pending. Will add GIN indexes on JSONB columns that carry predicate queries
(`collection_records.data`, `automation_rules.conditions`, etc.) using the
`createIndexConcurrent` helper from W6.A with `using: 'gin'`.

### W6.C — PgBouncer + connection pooling (F045)

Pending. Infrastructure-level change; adds PgBouncer as a sidecar in the
per-instance container spec. No migration changes.

### W6.D — N+1 group resolution (F047)

Pending. RBAC group membership resolution currently issues one query per
group per user; will batch via a single recursive CTE.

### W6.E — Materialized rollups + refresh strategy (F049/F050)

Pending. Dashboard aggregations will move to incrementally-refreshed
materialized views. Refresh triggered by BullMQ job on data change events.

## Acceptance

- `migrations:check` scanner green (verified at W6.A landing)
- All future migrations on growth tables use CONCURRENTLY + `transaction = false`
- No regression in existing scanners (audit:check, authz:check, security:check,
  service-boundary:check, deps:check, compliance:check)
- CLAUDE.md §24 amendment line landed

## Out of scope

- Re-running migrations against existing customer instances (operator concern,
  not greenfield discipline)
- pgvector index tuning (separate from B-tree/GIN; tracked under F136 search wave)
- Retroactive CONCURRENTLY rebuild for legacy indexes (all were built on
  empty tables; no production impact)
