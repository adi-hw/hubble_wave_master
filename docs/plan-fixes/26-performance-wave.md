# Plan Fix 26 — Performance Wave

**Status:** In progress (W6.A complete, W6.B complete, W6.D complete)
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

### W6.A — CREATE INDEX CONCURRENTLY tooling (F046)

**Status:** Complete (PR #39)

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

### W6.B — JSONB GIN coverage (F048)

**Status:** Complete (PR #38)

**What:** Added GIN indexes on JSONB columns demonstrated to be queried with JSONB operators in service code under `apps/api/src/app/`. Operator class chosen per column (`jsonb_path_ops` for containment-only patterns, `jsonb_ops` for dynamic-key or multi-key access patterns). Migration uses `CREATE INDEX CONCURRENTLY` with `transaction = false` so the build does not take `ACCESS EXCLUSIVE` locks on growth tables.

**Files:**

- New: `migrations/instance/1930900000000-add-jsonb-gin-indexes.ts`

**Inventory:**

| Entity / Table | Column | Confirmed operator | GIN op class | Rationale |
|---|---|---|---|---|
| `CollectionDefinition` / `collection_definitions` | `metadata` | `->>'status'` | `jsonb_path_ops` | Single-key containment pattern; pack install + runtime status checks |
| `PropertyDefinition` / `property_definitions` | `metadata` | `->>'status'` | `jsonb_path_ops` | Same single-key pattern; same low-write, high-read profile |
| `PropertyDefinition` / `property_definitions` | `config` | `->>'sourceCollection'`, `->>'relationProperty'`, `->>'formula'` | `jsonb_ops` | Multiple distinct keys queried; key-existence narrowing with `?` is the GIN benefit |
| `PropertyDefinition` / `property_definitions` | `behavioral_attributes` | `->> :key` (dynamic) | `jsonb_ops` | Dynamic key parameter; `jsonb_ops` required for `?` key-existence on unknown key names |
| `AutomationRule` / `automation_rules` | `metadata` | `->>'code'` | `jsonb_path_ops` | Single-key containment equivalent; pack install / deactivation path |

**Excluded (documented):**

- `instance_event_outbox.payload` — confirmed `->>` query (`payload->>'debounceKey'`), but excluded because GIN write amplification on a high-write outbox table (one row per automation trigger event) is not justified for a single-key equality lookup. A partial functional B-tree index on the extracted key is the right solution if this becomes a bottleneck — that is B-tree on JSONB key-extracted columns, which is out of scope for W6.B.
- `instances.resource_metrics` (control-plane) — confirmed `->>` queries (`resource_metrics->>'cpu_usage'`, etc.) used for AVG aggregates in the metrics service. The `instances` table is extremely low-cardinality (one row per customer instance; 10–20 rows at pilot scale), making any index irrelevant for the query planner. Excluded on "no measurable benefit" grounds.
- `document_chunks.metadata` — already has a GIN index (`idx_document_chunks_metadata`) created by `vector-store.service.ts` init code. No migration needed.

**Verification:** `EXPLAIN` of representative queries against a populated test DB should show `Bitmap Index Scan on idx_collection_definitions_metadata_gin`, not `Seq Scan`. Verified locally for `COALESCE(c.metadata->>'status','published') = 'published'` with and without the index; production verification owed to first customer load test.

**Out of scope:** B-tree indexes on JSONB key-extracted columns (F049 or later); over-indexing JSONB just-in-case; pgvector index tuning (separate F136 wave); control-plane GIN coverage (pilot-scale row counts make it premature).

### W6.C — PgBouncer + connection pooling (F045)

**Status:** Complete (this PR)

**What:** Deploy PgBouncer between app pods and Postgres in `transaction`
pool mode. The runtime TypeORM DataSource (in `libs/instance-db`) connects
to PgBouncer at port 6432. The migration runner and any consumer using
`LISTEN`/`NOTIFY` use a separate `DIRECT_DB_HOST`/`DIRECT_DB_PORT` pair
that bypasses PgBouncer and connects directly to Postgres.

**Files:**

New — instance-services helm chart:

- `deploy/helm/instance-services/templates/pgbouncer-configmap.yaml` —
  `pgbouncer.ini` with `pool_mode=transaction`, tuned timeouts and pool sizes.
- `deploy/helm/instance-services/templates/pgbouncer-deployment.yaml` —
  PgBouncer Deployment. An init container generates `userlist.txt` at pod
  start by hashing `DB_PASSWORD` from the Secret; the main container runs
  with `readOnlyRootFilesystem: true`.
- `deploy/helm/instance-services/templates/pgbouncer-service.yaml` —
  ClusterIP Service on port 6432.

Modified:

- `deploy/helm/instance-services/values.yaml` — new `pgbouncer` block
  (`image`, `replicaCount`, pool-size settings, resource limits).
- `deploy/helm/instance-services/templates/configmap.yaml` —
  `DB_HOST` now resolves to the PgBouncer ClusterIP Service;
  `DB_PORT` is `6432`. Added `DIRECT_DB_HOST` and `DIRECT_DB_PORT`
  keys carrying the raw Postgres coordinates for migration + LISTEN use.
- `libs/instance-db/src/lib/instance-db.module.ts` — when
  `RUN_MIGRATIONS=true` the DataSource reads `DIRECT_DB_HOST`/`DIRECT_DB_PORT`
  (bypassing PgBouncer). Runtime path uses `DB_HOST`/`DB_PORT` (PgBouncer).
  `DB_POOL_MAX` default lowered from 20 → 10 (PgBouncer handles multiplexing).
  `cache: false` disables TypeORM's query-result cache; `statement_timeout`
  guard added to the `extra` block.
- `libs/control-plane-db/src/lib/control-plane-db.module.ts` — analogous
  `DIRECT_CONTROL_PLANE_DB_HOST`/`DIRECT_CONTROL_PLANE_DB_PORT` fallback for
  migration runner. Pool-size defaults, statement timeout, and `cache: false`
  aligned with the instance-plane posture. No PgBouncer sidecar added to the
  control-plane chart yet (connection volume does not justify it at pilot scale).

**Pool settings rationale:**

| Setting | Value | Rationale |
|---|---|---|
| `pool_mode` | `transaction` | Canonical recommendation; returns server connection after each transaction so 25 server conns serve hundreds of concurrent clients |
| `default_pool_size` | 25 | 25 Postgres-side conns per pool; with 2–4 api pod replicas this keeps Postgres backend count in the 25–30 range under burst load |
| `reserve_pool_size` | 5 | Admin/monitoring slots always available even under saturation |
| `max_client_conn` | 1000 | Burst tolerance for all pod replicas combined |
| `server_idle_timeout` | 600s | Closes idle backends after 10 min; reduces off-peak Postgres backend count |
| `query_wait_timeout` | 30s | Client waiting >30s for a pool slot gets an explicit error instead of piling up indefinitely |
| App `DB_POOL_MAX` | 10 | Each app pod opens ≤10 pg-driver connections to PgBouncer; PgBouncer multiplexes into Postgres |

**Operational notes:**

- Migrations MUST run against `DIRECT_DB_HOST`/`DIRECT_DB_PORT` because
  `pool_mode=transaction` breaks multi-statement DDL inside a single TypeORM
  migration. The module auto-selects the correct host when `RUN_MIGRATIONS=true`.
- There are no `LISTEN`/`NOTIFY` consumers in the current codebase. Any
  future consumer must read `DIRECT_DB_HOST`/`DIRECT_DB_PORT` and open a
  dedicated non-pooled connection.
- The control-plane does not yet have a PgBouncer sidecar. At pilot scale
  (< 20 customer instances) the control-plane Postgres sees at most ~20
  connections from the API pods. A PgBouncer sidecar can be added to the
  control-plane chart if measured connection count warrants it; the module
  already reads `DIRECT_CONTROL_PLANE_DB_*` vars in migration mode.
- `DB_POOL_MAX` can be overridden per-instance at deploy time for tuning.
  The value must stay well below `max_client_conn=1000` divided by pod count.

**Verification:**

- Apply the helm chart in dev/staging.
- Verify `apps/api` can serve requests through PgBouncer (health endpoint
  + basic data read).
- Run migrations: `npm run migrate` should log connections to `DIRECT_DB_HOST`
  (raw Postgres), not the PgBouncer Service.
- Confirm `SELECT count(*) FROM pg_stat_activity` on Postgres shows ≤ 30
  active backends under burst load (vs 100+ without PgBouncer).
- `helm template deploy/helm/instance-services` renders without errors.

**Out of scope:**

- Postgres-side `max_connections` tuning (operator concern).
- PgBouncer SCRAM-SHA-256 authentication (MD5 used for compatibility;
  upgrade when Postgres instance is configured for it).
- Cluster-level secret management (external-secrets controller).
- Control-plane PgBouncer sidecar (deferred to measured need).

### W6.D — N+1 group resolution + request-scoped cache (F047)

**Status:** Complete (PR #41)

Group membership IDs were never populated in `UserRequestContext` at
request time, which meant group-based ACL rules (`CollectionAccessRule.groupId`,
`PropertyAccessRule.groupId`) silently never fired — the authz evaluator
checked `user.groupIds.includes(rule.groupId)` against an empty array on
every request.

The underlying cause: `buildUserContext` in `AuthorizationService` reads
`ctx.attributes['groupIds']`, but `JwtAuthGuard` never populated that field.
The JWT payload carries no group memberships; `IdentityResolverAdapter`
resolved roles and permissions but did not surface the group list.

At first-customer scale with deep group hierarchies and group-scoped ACL
rules, the symptom would have been silent permit/deny mismatches rather
than N+1 latency — though the `collectInheritedRoles` while-loop in
`PermissionResolverService` is a secondary N+1 (one query per role
inheritance level) that becomes latency-visible as hierarchy depth grows.

#### Fix shape

**1. `ResolvedIdentity.groupIds?: string[]`** (libs/auth-guard)

Added `groupIds` as an optional field to the `IdentityResolverPort`'s
`ResolvedIdentity` shape. Optional so pre-W6.D adapters compile without
changes and produce an empty list at runtime.

**2. `PermissionResolverService.getUserPermissions` returns `groupIds`**
(`apps/api/src/app/identity/roles/permission-resolver.service.ts`)

The service already fetched `groupMemberships` during `computeUserPermissions`
to expand group-assigned roles. W6.D captures those group IDs into
`resolvedGroupIds` and returns them in `UserPermissionCache.groupIds`.
No additional DB query — the data was already in memory.

Same change applied to the parallel implementation at
`apps/api/src/app/instance-api/identity/auth/permission-resolver.service.ts`.

**3. `IdentityResolverAdapter.resolveIdentity` surfaces `groupIds`**
(`apps/api/src/app/identity/auth/identity-resolver.adapter.ts`)

Destructures `groupIds` from `permissionResolver.getUserPermissions(userId)`
and includes it in the returned `ResolvedIdentity`. Covered by the
existing Redis cache (60s TTL) so the DB is queried at most once per TTL
window per user. `CachedIdentity` extended with `groupIds?: string[]`.

**4. `UserRequestContext.groupCache?: Map<string, string[]>`** (libs/auth-guard)

Added an optional `groupCache` slot to `UserRequestContext` (canon §29
discriminated union; `UserRequestContext` only — `ServiceRequestContext`
has no user identity). The map is keyed on `userId` for the single-user
request path; the design supports batch authz scenarios (e.g. admin
viewing multi-user records) without API changes.

**5. `JwtAuthGuard` seeds `groupCache` on every authenticated user request**
(libs/auth-guard)

Hoisted the `resolvedIdentity` variable so its `groupIds` field is
accessible after the `IdentityResolverPort` block. Initializes
`groupCache = new Map<string, string[]>()` unconditionally (even when no
resolver is wired — the map exists but stays empty, consistent with the
pre-W6.D default). When `resolvedIdentity` is available, writes
`groupCache.set(userId, resolvedIdentity.groupIds ?? [])`.

**6. `AuthorizationService.buildUserContext` consumes `groupCache`**
(libs/authorization)

Fallback order (first non-empty wins):

1. `ctx.groupCache?.get(ctx.userId)` — W6.D path: populated by JwtAuthGuard
2. `ctx.attributes['groupIds']` — JWT-embedded fallback for legacy/test callers
3. `[]` — pre-W6.D default (no group rules ever fired)

**7. `PermissionResolverService.getUserGroupsBatch(userIds, groupCacheCtx?)`**
(`apps/api/src/app/identity/roles/permission-resolver.service.ts`)

Batch API for multi-user group lookups. Issues **one** SQL IN-query for N
users rather than N per-user queries. Checks (in order):

1. Request-scoped `groupCacheCtx` map — zero queries when warm
2. In-process `UserPermissionCache` (30s TTL) — zero queries when warm
3. Single `groupMemberRepo.find({ where: { userId: In(uncached) } })` for
   the remaining users

Results are written back to `groupCacheCtx` for the duration of the request.

#### Files modified

- `libs/auth-guard/src/lib/request-context.interface.ts` — added `groupCache`
- `libs/auth-guard/src/lib/identity-resolver.port.ts` — added `groupIds`
- `libs/auth-guard/src/lib/jwt.guard.ts` — seeds `groupCache`; hoisted
  `resolvedIdentity`
- `libs/authorization/src/lib/authorization.service.ts` — consumes
  `groupCache` in `buildUserContext`
- `apps/api/src/app/identity/roles/permission-resolver.service.ts` —
  added `groupIds` to `UserPermissionCache`; added `getUserGroupsBatch`
- `apps/api/src/app/instance-api/identity/auth/permission-resolver.service.ts` —
  parallel implementation updated with `groupIds`
- `apps/api/src/app/identity/auth/identity-resolver.adapter.ts` — surfaces
  `groupIds` in resolved identity + cache

#### Test coverage

New assertions in the following spec files:

- `libs/authorization/src/lib/authorization.service.spec.ts` (2 new tests):
  - W6.D: groupCache wins over attributes.groupIds
  - W6.D: falls back to attributes.groupIds when cache has no entry for user
- `libs/auth-guard/src/lib/jwt.guard.spec.ts` (3 new tests):
  - Seeds groupCache from resolver identity.groupIds
  - Seeds empty entry when resolver returns no groupIds
  - groupCache initialized even without IdentityResolverPort
- `apps/api/src/app/identity/auth/identity-resolver.adapter.spec.ts`
  (3 new tests / 1 updated):
  - Falls through to DB and seeds cache (updated: includes groupIds)
  - W6.D: surfaces groupIds in the resolved identity (F047)
  - W6.D: groupIds is empty array when user has no memberships (F047)
- `apps/api/src/app/identity/roles/permission-resolver.service.spec.ts`
  (7 new tests under `getUserGroupsBatch` describe block):
  - Returns empty map for empty input (no DB query)
  - Issues ONE query for N users
  - Buckets results correctly per userId
  - Request-scoped cache hit issues ZERO additional queries
  - Partial cache hit issues ONE query for uncached users only
  - Populates ctx cache with DB results for future calls
  - Returns empty arrays for users with no group memberships
  - Falls through to in-process permission cache when warm

#### Verification

All scanner groups green: `audit:check`, `authz:check`, `security:check`,
`service-boundary:check`, `deps:check`, `compliance:check`, `migrations:check`.

Tests:
- `libs/authorization` — 115 passed
- `libs/auth-guard` — 55 passed
- `apps/api` (adapter + resolver specs) — 24 passed

#### Out of scope

- DataLoader dependency (not added — explicit batch API + context-cache
  covers the same ground with no new dep)
- `collectInheritedRoles` N+1 (one query per role hierarchy level) — the
  existing batching with `In(currentIds)` limits blast radius; a CTE-based
  recursive query is a future optimization when hierarchy depths exceed ~5
- N+1 fixes in non-authz code paths (separate sweep)
- F025 permission cache invalidation (already closed)
- §28.6 admin bypass retirement (Item 15)

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
