# Phase 3 W2: Platform Integrity — Detailed Design

**Status:** Approved baseline, ready for implementation planning.
**Date:** 2026-05-15
**Audience:** Founder, core engineers, AI coding agents working on Phase 3 W2.
**Scope:** Boundary consistency across authorization, identity, audit, search, service-to-service, and frontend surfaces. Spans `apps/api`, `apps/control-plane`, `apps/web-client`, `apps/web-control-plane`, and supporting libs.

---

## Context

Phase 3 Prelude landed on master 2026-05-15 at tag `phase3-prelude-complete` (HEAD `13b55a9`). The Prelude was a FOUNDATION milestone only — schema split finalized, runtime `search_path` bridge removed, obsolete product surfaces deleted via founder-approved deletion ledger, validation harness wired. The post-merge audit explicitly flagged four W2-scope correctness gaps that the Prelude did not address:

1. **Role-code vs role-id mismatch.** `IdentityResolverAdapter.getUserContext` returns role codes; `AuthorizationService.toAbacPrincipal` falls back to `ctx.roles` as if they were role IDs. Production JWT path mismatches role-based ACL rules; tests injecting `attributes.roleIds` hide the regression.
2. **`PermissionsGuard` warn-and-allow on unannotated handlers.** Coverage at 207/804 (25.7%) at Prelude close. Flipping to deny-by-default is W2's milestone.
3. **Search authz admin `allow_all` short-circuit** in `apps/api/src/app/ava/search/search-query.service.ts:179`. Canon §28.6 retired the `AuthorizationService` admin bypass via Plan Fix 33; the search-side retirement has not shipped.
4. **Full default-deny not enabled.** `secureFieldsByDefault` defaults `false` on `CollectionDefinition`. Spec §28.9 deferred platform-wide default-deny to W3+ — W2 contests that deferral and lands it now.

W2 closes these and the broader set of audit-listed findings (F001, F002, F003-F006, F013, F022, F025, F042, F052, F091, F102, F136, F146) under one boundary-consistency wave.

Phase 3 governing spec: `docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md`. This document elaborates W2's wave-level scope. Per the Phase 3 cross-wave rule, each wave gets its own brainstorm → spec → plan cycle. Implementation plan lands separately via `writing-plans`.

---

## Wave goal

Establish a **trustworthy boundary** model across the platform. After W2, the user's effective permission set, role identity, session lifetime, audit trail, search visibility, and frontend rendering are derived from one consistent contract enforced uniformly across `apps/api`, `apps/control-plane`, and both web clients. No surface defaults to allow. No surface short-circuits an admin. No plane diverges in auth architecture.

W2 is strict greenfield. No warn-and-allow posture, no runtime allowlists, no default-allow authorization paths, no silent auth divergence between planes.

---

## Exit criterion

Operationalized as a checklist enforced by `scripts/w2-validate.ts` (extends `scripts/prelude-validate.ts`):

1. Empty DB → baseline → all W2 migrations → bootstrap scripts → boot → login passes for both planes. (The pre-W2 baseline is a one-time jump from the 98-migration archaeology to a clean starting point; Stream 1/2/3/4 migrations apply forward as normal evolution. There is no W2-close re-squash.)
2. Every `@Controller()` handler in `apps/api` + `apps/control-plane` carries **exactly one effective primary boundary decision** after resolving class + method metadata. The four primary decorators are `@RequirePermission`, `@RequireCollectionAccess`, `@AuthenticatedOnly`, and `@Public`. `@Roles(...)` is auxiliary and never satisfies the boundary scanner alone. Mutual exclusion rules:
   - `@Public` MUST NOT combine with any other primary.
   - `@RequirePermission` MUST NOT combine with `@RequireCollectionAccess` on the same handler.
   - `@AuthenticatedOnly` MUST NOT combine with `@Roles`, `@RequirePermission`, or `@RequireCollectionAccess`.
   - Bare `@Roles` (without one of the four primaries) is a scanner fail.
3. Every `@RequirePermission` code in source ∈ `PERMISSION_REGISTRY`; every registry entry has ≥1 source reference; registry-sync scanner green.
4. No `JWT_SECRET` / HS256 / `jsonwebtoken` references in `apps/api`, `apps/control-plane`, `libs/**`. Scanner-enforced.
5. `secureFieldsByDefault = true` by DB default on `CollectionDefinition`.
6. `roleIds` (UUID) and `roleCodes` (string) are explicit on `ResolvedIdentity` + `UserRequestContext`; ACL rules match by UUID only.
7. Search authz: `buildAuthzAst(principal, collection)` produces a `FilterAst` from §28 output; `emitTypesenseFilterBy` and `emitPgvectorWhere` emit engine-specific filters from that AST (the existing `libs/search-authz` library from Plan Fix 30 PR-1/2/3); admin no longer short-circuits to `allow_all`; corpus-accurate facets + pagination proven by test on both engines.
8. Audit subscriber's `pg_advisory_xact_lock` chain proven under concurrent inserts (50 concurrent transactions × 10 inserts; chain length 500, no gaps).
9. AVA `chat` orchestration writes inside one transaction.
10. Frontend (both clients) honors `permissions.canCreate/canUpdate/canDelete` + `permissions.fields[*]` (including masking) on list, detail, form, dashboard, and search surfaces. 401/403 UX shipped.
11. `w2-validate.ts` happy + negative paths green; required CI status check.

---

## Cross-wave rules

W2 is bound by all Phase 3 cross-wave rules from the governing spec:

- **Platform Reduction Rule.** Every stream ships a deletion ledger. The aggregate ledger appears in this document.
- **Learning-Revises-Plan Rule.** A completed stream can revise downstream stream assumptions. Document the revision in the spec + the implementation plan when it happens.
- **Estimates are internal anchors.** Calendar estimate appears in the Calendar section below; the wave is gated by exit criteria.
- **W2 Freeze Rule** (analog of Prelude Freeze). No non-W2 PRs land on master during the wave. PRs touching W2 concerns outside the wave's stream PRs get labeled `w2-freeze-queued`. Exception: production-breaking hotfixes unrelated to W2.

---

## Pre-W2 gate — Fresh-DB Baseline Squash

**Not a W2 stream — a precondition.** Runs before Stream 1 starts.

### Scope

Replace the 98 instance migrations in `migrations/instance/*` with one canonical baseline `migrations/instance/1000000000000-baseline.ts` plus the structural seed migrations listed below. Same for the 8 control-plane migrations. Filenames use `1e12` sentinel prefixes (`1000000000000`–`1000000000005`) so the filename's trailing digits, the TypeScript class suffix, and the migration's runtime `name` property all match — TypeORM rejects the literal `0` timestamp, so a non-zero sentinel is required.

Baseline files are TypeORM `MigrationInterface` classes containing schema-qualified DDL only: `CREATE SCHEMA` per the 10 domain schemas; `CREATE TABLE` with all columns, FKs, constraints; `CREATE INDEX` (transactional — see indexing policy below); triggers; materialized views; GIN indexes from W6.B.

### Structural seed migrations (deterministic, post-baseline)

- `seed-system-roles` — `admin` (bootstrap operator / platform administrator) + `platform_user` (baseline authenticated platform member). The four application personas — `auditor`, `manager`, `technician`, `viewer` — are NOT seeded here. They imply persona models the platform has not built; ship them with the wave that introduces those personas. `platform_user` rather than `authenticated` because the latter is an auth-state label (`@AuthenticatedOnly()` already expresses that), while `platform_user` is an actual authorization role assignable to `user_roles`. NO rows are written to `identity.platform_permissions` or `identity.role_permissions` — per §2.3 the TS-constant-driven `seed-permission-registry-sync` script in Stream 2 PR3 is the single source for those tables, and admin's authority during the Pre-W2 → Stream 2 window comes from the `CollectionAccessRule` + wildcard `PropertyAccessRule` seed below.
- `seed-system-collections` — the default application + 3 system collections (`audit_logs`, `schema_change_log`, `schema_sync_state`) with `secureFieldsByDefault = true`. Runs before `seed-admin-policies` so the latter resolves collection UUIDs by code.
- `seed-admin-policies` — Plan Fix 33's `CollectionAccessRule` + wildcard `PropertyAccessRule` seed granting the `admin` role full access to system collections. FK-depends on the `admin` role's UUID from `seed-system-roles` and on collection UUIDs from `seed-system-collections`.
- `seed-service-principals` — canon §29 PR-D's `svc-worker → svc-api` row (the only currently-seeded principal).
- `seed-default-navigation` — deduped post-Prelude nav state.

### Bootstrap scripts (post-migration, env/filesystem-dependent)

Migrations are deterministic. Anything depending on environment variables or filesystem state is a bootstrap script run after migrations:

- `seed-admin-user` — uses `DEFAULT_ADMIN_PASSWORD`
- `seed-instance-key-bootstrap` — generates ES256 keypair in `.dev/keys/` if missing (canon §29.9 `LocalEs256KeySigningService` pattern)
- `seed-control-plane-key-bootstrap` — added by Stream 1
- `seed-permission-registry-sync` — added by Stream 2

### Deleted

- Demo / sample data seed scripts (work order samples, dashboard samples, demo workspaces). Greenfield = no compat constraint.

### Indexing policy

Baseline uses normal `CREATE INDEX` (transactional, correct on empty tables). The migration-blocking-index scanner gains a "same-migration table creation → blocking index OK" exception. Future growth-table migrations still require `CREATE INDEX CONCURRENTLY` per W6.A.

### Validation

- `npm run db:reset:instance && npm run migrate:instance && npm run seed:instance` succeeds with zero errors.
- Compact **schema manifest + hash** committed for archaeology. The manifest captures the baseline's intended end-state schema. A separate "intentional deltas" note enumerates places where baseline differs from master-state-after-98-migrations (the known list: `identity.platform_permissions` replaces `identity.permissions`; `identity.role_permissions.permission_code` replaces `permission_id`; `CollectionDefinition.secure_fields_by_default DEFAULT TRUE` replaces `DEFAULT FALSE`). Cosmetic differences also surface in the manifest and are reviewed but not blocking. Raw `pg_dump` diff only if it stays small.
- `prelude-validate.ts` happy + negative paths green.

### Archival

- Annotated git tag `pre-w2-migration-archive` on the commit immediately before the baseline lands; old migration files preserved in tag history.
- Old migration files **deleted from tree**. No `migrations/_archive/` directory — that would preserve dead history in product surface.

### Baseline is the foundation, not the end state

The Pre-W2 baseline is a one-time jump from the 98-migration archaeology to a clean starting point. The baseline reflects the **end-state schema for known W2 reshapes**:

- `identity.platform_permissions` (code-keyed PK) is in the baseline. The old `identity.permissions` table does not exist.
- `identity.role_permissions` is created with `permission_code text` FK in the baseline. No UUID `permission_id` ever exists post-baseline.
- `CollectionDefinition.secure_fields_by_default DEFAULT TRUE` is in the baseline DDL.

Subsequent W2 streams ADD schema changes forward on top of the baseline as normal evolution. The known forward migration:

- Stream 1 adds the control-plane `key_metadata` table (control-plane ES256 migration). See "Control-plane schema policy" below for placement.

**There is no W2-close re-squash.** The baseline ships as-is and remains the foundation; W2 migrations are normal forward evolution. The final fresh-DB validation in `scripts/w2-validate.ts` runs the full chain: **baseline → all W2 migrations → bootstrap scripts → assertions**.

### Control-plane schema policy

**Control-plane baseline tables stay in the `public` schema.** The control-plane is a small bounded domain (admin users, refresh tokens, revoked tokens, customers, instances, packs, licenses, telemetry). Domain schemas add ceremony without operational benefit there.

This means:
- Stream 1's new control-plane `key_metadata` table is created in `public` (no `control_plane.` prefix in the DDL — the database is itself the control-plane DB).
- The current `refresh-token.entity.ts:26` `schema: 'identity'` declaration is a bug — control-plane has no `identity` schema. Stream 1's control-plane ES256 PR also fixes this entity declaration to either `schema: 'public'` or no `schema` field (TypeORM default).
- Spec references to "`control_plane.key_metadata`" elsewhere in this document should be read as the control-plane DB's `key_metadata` table, not as a schema-qualified name.

The instance plane retains its 10 domain schemas from the Prelude.

### Deliverable

PR titled `phase3-w2-pre-gate: fresh-DB baseline squash`. Lands before any Stream 1 PR. Required CI gates: baseline DDL diff manifest committed and green, `prelude-validate.ts` happy + negative paths green.

---

## Stream 1 — Principal & Session Integrity

**Goal:** the platform's identity, session, and inter-process auth contract is uniform across both planes. Every authorization decision starts from a typed principal whose authority is resolved per request, not embedded in the bearer token.

### 1.1 Principal contract

**JWT claim contract** (instance plane and control plane both):

| Claim | Value | Notes |
|---|---|---|
| `alg` | `ES256` | Per canon §29.1 |
| `typ` | `JWT` | |
| `kid` | Per canon §29.2 `hwk_YYYY_MM_DD_<8-hex>` | |
| `iss` | Instance plane: `hubblewave-{instance_id}`. Control plane: `hubblewave-control-plane`. | |
| `aud` | Instance plane: instance audience. Control plane: `hubblewave-control-plane`. | |
| `iat`, `exp` | Per canon §29.4 TTLs | |
| `sub` | `user:{user_id}` or `service:{service_id}` | Discriminator |
| `instance_id` | UUID | **Omitted entirely on control-plane tokens.** `iss` / `aud` differentiate planes; no JSON null on a typed UUID claim. |
| `session_id` | UUID | Persisted session row |
| `token_version` | User's `security_stamp` | Per canon §29.6 |
| `scope` | Service-token only; array of platform capability codes | Per §29.7 amendment in this wave |

**JWT carries no roles, no permissions.** Authority resolves per request via `IdentityResolverAdapter`.

**`ResolvedIdentity`** (returned by `IdentityResolverAdapter`):

```ts
type ResolvedIdentity = {
  userId: string;
  roleIds: string[];          // UUIDs — what ACL rules match against
  roleCodes: string[];        // stable string codes — for @Roles() decorator + audit log readability
  permissionCodes: string[];  // resolved platform capabilities from RolePermission joins
  groupIds: string[];
  securityStamp: string;
};
```

**`UserRequestContext`** mirrors `ResolvedIdentity` plus the discriminator from canon §29 PR-D:

```ts
type UserRequestContext = {
  kind: 'user';
  userId: string;
  roleIds: string[];
  roleCodes: string[];
  permissionCodes: string[];
  groupIds: string[];
  securityStamp: string;
  groupCache?: Map<string, string[]>;
};
```

The ambiguous `roles: string[]` field is **deleted**. The ambiguous `permissions: string[]` field is **renamed to `permissionCodes`**.

**`JwtAuthGuard` posture:** no JWT-embedded-roles fallback. Missing `IdentityResolverPort` binding fails closed at module init — not a runtime fallback. The guard expects the resolver to populate `roleIds`, `roleCodes`, `permissionCodes` from DB (with cache). Cache lookups are typically ≤1ms warm.

### 1.2 ACL evaluator hardening

**File:** `libs/authorization/src/lib/authorization.service.ts:1369` and call sites.

- `toAbacPrincipal` asserts `ctx.roleIds` populated; throws on absence. No `ctx.roles`-as-UUIDs fallback branch.
- ACL rule matching is UUID-only across all three principal-kind columns: `CollectionAccessRule.roleId` / `groupId` / `userId` (and same on `PropertyAccessRule`) are matched against the principal's `roleIds[]` / `groupIds[]` / `userId` respectively. No code-based fallback at any principal-kind column.
- Tests that inject `attributes.roleIds` directly are rewritten to use a fixture that goes through `IdentityResolverAdapter` to populate `roleIds` + `roleCodes` together.

### 1.3 Control-plane HS256 → ES256 migration

Today, `apps/control-plane/src/app/auth/*` is on `JWT_SECRET` symmetric signing. W2 brings it onto canon §29 ES256.

**Files:**
- DELETE: `JwtModule.registerAsync({ secret })` block in `apps/control-plane/src/app/auth/auth.module.ts`.
- REWRITE: `apps/control-plane/src/app/auth/jwt.strategy.ts` — extends a `KeySigningService`-backed strategy. Verification via JWKS public-key lookup.
- NEW: `apps/control-plane/src/app/auth/control-plane-key-signing.module.ts` — wires `AwsKmsEs256KeySigningService` (prod) or `LocalEs256KeySigningService` (dev) with a control-plane-scoped KMS alias `alias/hubblewave/control-plane/jwt-signing`.
- NEW: `migrations/control-plane/<timestamp>-add-control-plane-key-metadata.ts` — adds `key_metadata` table to control-plane DB (mirrors instance-plane schema).
- NEW: `scripts/seed-control-plane-key-bootstrap.ts` — generates initial ES256 keypair, persists to `.dev/keys/control-plane-*.pem` in dev (gitignored, `0600` perms enforced).
- NEW: `apps/control-plane/src/app/auth/jwks.controller.ts` — exposes `GET /.well-known/jwks.json` per canon §29.2.
- DELETE: every `JWT_SECRET` env reference in `scripts/setup.ts`, `.env.example`, `apps/control-plane/**`.

**KMS alias provisioning** is an IaC/ops dependency. Production startup MUST fail fast if `JWT_KEY_PROVIDER !== 'aws-kms'` OR the configured KMS alias doesn't resolve in AWS. No automatic provisioning in prod. Dev bootstrap generates persistent local ES256 keys on first run; production must not.

**Control-plane refresh-token family + revocation tables** (`RefreshToken`, `RevokedToken`) are preserved. Only the access-token signing/verification layer changes.

### 1.4 Session lifecycle verification (F001, F002, F013)

These largely verify Phase 2 work rather than build anew.

- **F001 (refresh token reuse):** canon §29 PR-C landed family chains. Stream 1 adds end-to-end tests covering both planes: presenting a used refresh token → family revoked + security audit event via `AccessAuditPort.logSecurityEvent` + client receives the bland 401 from canon §29.5.
- **F002 (JWT revocation):** instance plane uses `JwtRevocationPort` (Redis-backed); control-plane uses the existing `RevokedToken` table. Stream 1 adds a coverage assertion: revoked `jti` → next request 401 within < 1 second across both planes.
- **F013 (stale roles in JWT):** with the JWT-carries-no-roles contract from §1.1, F013 is closed at the contract level. `IdentityResolverAdapter` always returns fresh authority on every request. Role changes propagate via cache invalidation (§1.5). Tests verify: token issued before a role grant change → next request after the change resolves with the new permissionCodes.

**No change to canon §29.6 `security_stamp` bump list.** Role grant changes (gain or loss) do NOT bump `security_stamp`. Stamp bumps remain reserved for hostile / identity-changing events (force-logout, password change, MFA enrollment/disable, suspend, account status change to non-active). Operator-triggered `logout-all-devices` remains the global kill-switch.

### 1.5 Permission cache invalidation (F025)

**Implementation:** extend existing F025 subscribers in `libs/instance-db/src/lib/subscribers/`. Do NOT create a duplicate subscriber in `libs/authorization`.

The subscribers observe inserts/updates/deletes on `Role`, `RolePermission`, `CollectionAccessRule`, `PropertyAccessRule`. On commit, the subscriber publishes an invalidation event to Redis pub/sub channel `hw:permission-invalidate`. Three server-side caches subscribe and evict on event:

1. `IdentityResolverAdapter` Redis cache (identity domain).
2. `PermissionResolverService` cache (identity domain).
3. `AuthorizationService` rule caches (in `libs/authorization`).

The frontend cache (per-tab in-memory) is invalidated via the SSE channel established in Stream 4b (`/identity/me/events`).

Short cache TTL (≤30s) is retained as a backstop for pub/sub delivery failures.

### 1.6 Service-to-service authentication (F022 verify + scope enforcement)

Canon §29 PR-D landed `service_principals` + `TokenIssuerService.issueServiceToken()` + `@AllowServiceToken()`. Stream 1 closes the contract:

- **New decorator `@RequireServiceScope(code: string)`.** Mandatory companion to `@AllowServiceToken()`. The scanner fails any `@AllowServiceToken()` endpoint without an explicit `@RequireServiceScope(...)`.
- **Scope values are platform capability codes** from `PERMISSION_REGISTRY` (Stream 2). Example: `@RequireServiceScope('automation:invoke')`, not `@RequireServiceScope('work_order:read')`. This forces a canon §29.7 amendment (see §6 below). Service principals needing customer-collection access have `CollectionAccessRule` grants alongside; the §28 evaluator handles the collection check.
- **401 (not 403) for service token at non-service endpoint.** Token-not-accepted-here is an authentication outcome, not an authorization outcome. `JwtAuthGuard` rejects service tokens on endpoints lacking `@AllowServiceToken`.
- **End-to-end test:** mint a service token for `svc-worker → svc-api` audience; present to a non-`@AllowServiceToken` endpoint → 401. Present to an opted-in endpoint without the required scope claim → 403. Present with the required scope → 200.

### 1.7 RequestContext narrowing scanner

`Section 2.7 refinement`: TypeScript handles narrowing at compile time via the discriminated union. The scanner exists to catch handlers that escape the typed surface.

**New scanner `tools/scanners/no-untyped-req-check.ts`:**
- AST-aware; walks all `@Controller()` classes.
- Fails if any `@Req()` parameter is typed `any`, `Request` (raw Express), or otherwise omits the `RequestContext` discriminated union.
- The discriminated union is the type contract; narrowing helpers (`assertUserContext`, `assertServiceContext`, `isUserContext`, `isServiceContext`) from canon §29 PR-D remain available but aren't required if the handler uses kind-check narrowing directly.

### 1.8 No-HS256 signing-path scanner

**New scanner `tools/scanners/no-hs256-signing-check.ts`:**
- Greps `apps/api/**`, `apps/control-plane/**`, `libs/**` for: `JWT_SECRET`, `jsonwebtoken` imports, `secretOrKey:`, `algorithm: 'HS256'`, `JwtModule.register*({ secret:` patterns.
- Allowlist: test fixtures that mock JWT signing (with `rationale` / `addedBy` / `addedAt` per Prelude scanner convention).
- No canon exception for any production code path.

### 1.9 Role.code immutability

**Migration:** adds DB trigger `tg_role_code_immutable BEFORE UPDATE OF code ON identity.roles` raising exception if `OLD.code <> NEW.code`. Message: `'role code immutable'`.

**Entity-level defense-in-depth:** `Role.code` column declared `update: false` in TypeORM entity metadata.

Test: raw SQL `UPDATE roles SET code = ... WHERE id = ...` → exception.

### 1.10 Stream 1 deliverables (PR sequence — 6 PRs, all green at HEAD)

1. **Principal/context contract cleanup + full consumer migration** (fused). Add `roleIds`, `roleCodes`, `permissionCodes`, `groupIds` to `ResolvedIdentity` + `UserRequestContext`. Delete `roles`. Rename `permissions` → `permissionCodes`. Migrate all consumers in one atomic PR. JWT claim contract updated (no roles/permissions).
2. **IdentityResolverAdapter + cache invalidation wiring.** Resolver populates the new fields; extends existing `libs/instance-db` F025 subscribers to evict identity / resolver / ACL caches on commit.
3. **Control-plane ES256 + JWKS migration.** All file changes from §1.3.
4. **`@RequireServiceScope` enforcement + scanner.** New decorator; new scanner; canon §29.7 amendment commits as part of this PR.
5. **Session lifecycle verification tests.** F001 reuse-detection end-to-end; F002 revocation end-to-end; F013 stale-authority-via-cache end-to-end. Role.code immutability migration + tests.
6. **Required scanner wiring.** `no-hs256-signing-check`, `service-token-default-deny-check`, `no-untyped-req-check`, `role-code-immutability` (or fold into existing scanner). All wired as required CI gates.

### 1.11 Stream 1 exit gate

- All 6 PRs merged.
- Four new scanners green: `no-hs256-signing-check`, `service-token-default-deny-check`, `no-untyped-req-check`, role.code immutability.
- Control-plane fresh-DB → boot → login validates ES256 JWT via JWKS; rejects HS256 tokens.
- Service token at non-service endpoint → 401; opted-in endpoint without scope → 403; opted-in endpoint with scope → 200.
- Role permission change → identity cache + resolver cache + ACL cache all invalidate within 1s of commit (integration test).
- Canon §29.6 + §29.7 amendments landed.

### 1.12 Stream 1 deletion ledger

- `apps/control-plane/src/app/auth/auth.module.ts` `JwtModule.registerAsync({ secret })` block.
- `apps/control-plane/src/app/auth/jwt.strategy.ts` HS256 body — rewritten to ES256/JWKS.
- All `JWT_SECRET` env references in `scripts/setup.ts`, `.env.example`, `apps/control-plane/**`.
- `UserRequestContext.roles` ambiguous field.
- `UserRequestContext.permissions` (renamed `permissionCodes`).
- `AuthorizationService.toAbacPrincipal` `ctx.roles`-as-UUIDs fallback branch.
- `JwtAuthGuard` JWT-embedded-roles fallback (if present).
- Test fixtures injecting `attributes.roleIds` to bypass `IdentityResolverAdapter`.
- `tools/security-bypass-check.ts` PUBLIC_ALLOWLIST entries for pre-ES256 control-plane auth controller paths.

---

## Stream 2 — Authorization Model & Permission Registry

**Goal:** the §28 contract is exactly what the platform executes. Authorization decisions are deterministic, explainable, and uniform across the API surface. Cross-cutting platform capabilities are governed by a typed registry with CI-enforced sync.

### 2.1 Permission registry

**Source of truth: `PERMISSION_REGISTRY` TypeScript constant** at `libs/permission-registry/src/lib/registry.ts`. The DB table is a materialized projection of this constant, kept in sync by a bootstrap script.

**Types:**

```ts
export type PermissionPlane = 'instance' | 'control-plane';
export type PermissionAction =
  | 'read' | 'manage' | 'export' | 'configure'
  | 'admin' | 'invoke' | 'approve';

export interface PlatformPermission {
  readonly code: string;       // e.g. 'metadata:schema:manage'
  readonly plane: PermissionPlane;
  readonly domain: string;     // e.g. 'metadata'
  readonly resource?: string;  // e.g. 'schema' (for 3-segment codes)
  readonly action: PermissionAction;
  readonly dangerous: boolean;
  readonly description: string;
}

export const PERMISSION_REGISTRY: ReadonlyArray<PlatformPermission> = [
  // ~40-80 entries — populated during Stream 2 PR #3 sweep
];
```

**Code format constraint:** regex `^[a-z][a-z_]*(:[a-z_]+){1,2}$`. Two or three colon-separated segments. Lowercase, underscores allowed in segments, no digits, no dots, no wildcards. Action must be in the fixed `PermissionAction` enum.

**`system:admin` is just another grant.** Not a bypass. Not an implied grant for other codes. The §28 evaluator handles admin uniformly per Plan Fix 33.

### 2.2 Baseline schema for platform permissions

Pre-W2 baseline drops the existing `identity.permissions` table and creates `identity.platform_permissions`:

```sql
CREATE TABLE identity.platform_permissions (
  code        text PRIMARY KEY,
  plane       text NOT NULL CHECK (plane IN ('instance', 'control-plane')),
  domain      text NOT NULL,
  resource    text NULL,
  action      text NOT NULL,
  dangerous   boolean NOT NULL DEFAULT false,
  description text NOT NULL
);
```

`identity.role_permissions` becomes:

```sql
CREATE TABLE identity.role_permissions (
  role_id          uuid NOT NULL REFERENCES identity.roles(id) ON DELETE CASCADE,
  permission_code  text NOT NULL REFERENCES identity.platform_permissions(code) ON DELETE RESTRICT,
  granted_at       timestamptz NOT NULL DEFAULT now(),
  granted_by       uuid NULL,
  PRIMARY KEY (role_id, permission_code)
);
```

No UUID `permission_id`. The code is the stable key. DB enforces referential integrity — orphaned grants impossible.

### 2.3 Registry sync mechanism

- **Table created in baseline** (empty).
- **Bootstrap script `scripts/seed-permission-registry-sync.ts`** reads the TS constant, idempotently upserts rows via `INSERT ... ON CONFLICT (code) DO UPDATE`. Runs on every deploy.
- **`--prune` flag** marks orphan rows (in DB but not in registry) for review. Manual confirmation removes them.
- **No handwritten seed migration** for permission registry rows. The TS constant is the single source.

### 2.4 Scanner — `permission-registry-sync-check`

**File:** `tools/scanners/permission-registry-sync-check.ts`

- Greps `apps/api/**`, `apps/control-plane/**`, `apps/web-client/**`, `apps/web-control-plane/**` for `@RequirePermission('...')`, `@RequireServiceScope('...')`, and `<RequirePermission permission="..." />`.
- Validates each extracted code is in `PERMISSION_REGISTRY`.
- Validates every registry entry has ≥1 source reference.
- Mode transition: **reporting-only at Stream 2 PR #1** (existing 213 sites still unaligned); **hard CI gate at Stream 2 PR #3** when migration sweep completes.

### 2.5 Three primary boundary decorators

| Decorator | Purpose | Guard | Notes |
|---|---|---|---|
| `@RequirePermission(code)` | Cross-cutting platform capability | `PermissionsGuard` | Single string. Multiple permissions or arrays forbidden. Code must be in registry. |
| `@RequireCollectionAccess({ verb, collection, record? })` | Data-ACL route | `CollectionAccessGuard` (new) | Always-explicit collection target. Routes into §28 evaluator. |
| `@AuthenticatedOnly()` | Auth required, no capability/collection check | `JwtAuthGuard` only | For endpoints where identity IS the authorization (e.g., `/users/me`). |

`@Public()` (existing) is the fourth primary; `@Roles(...)` (existing) is auxiliary — never satisfies the boundary scanner alone.

### 2.6 `@RequireCollectionAccess` shape

Always-explicit metadata. No defaults:

```ts
@RequireCollectionAccess({
  verb: 'read' | 'create' | 'update' | 'delete',
  collection: {
    from: 'param' | 'query' | 'body' | 'fixed',
    name: string,                    // param/query/body key, or fixed value
    kind: 'id' | 'code',
  },
  record?: {
    from: 'param' | 'query' | 'body',
    name: string,
  },
})
```

The `CollectionAccessGuard` resolves the collection from the route, calls §28 evaluator with principal + collection + verb. Collection-level gating happens at the guard; record/field filtering happens in the data service for list/search/detail responses (the guard returns row-conditions; the service applies them).

403 response on guard deny: minimal shape (see §3.3).

### 2.7 §28 close — verification + admin short-circuit retirement

**Verification tests** added to `libs/authorization/authorization.service.spec.ts`:
- Deny wins at same specificity (levels 1+2, 3+4, 5+6).
- Specificity ranks beat effect (wildcard allow does not override explicit deny).
- Field overrides collection within visible records (record visibility from §28.1 gates field evaluation).
- Missing policy = deny when `secureFieldsByDefault=true`.
- Field masking takes MAX of severity across matching rules (§28.5).
- No admin short-circuit in `AuthorizationService` (Plan Fix 33 verified clean).

**Search admin short-circuit retirement (file: `apps/api/src/app/ava/search/search-query.service.ts:179`):**
- The `if (ctx.isAdmin) return 'allow_all'` branch is deleted.
- Admin's authorization filter compiles through the same §28 evaluator. Plan Fix 33's seeded admin policies (wildcard allows for system collections) produce an equivalent corpus-wide allow as a §28 output — not a special-case bypass.
- Provenance recorded for admin queries identically to non-admin queries.

This is the upstream change Stream 4 depends on: the unified Typesense + pgvector authz emitter consumes the §28 output directly, with no per-engine admin special-case.

### 2.8 `secureFieldsByDefault = true` flip

**DB-level (in pre-W2 baseline):**
- `CollectionDefinition.secure_fields_by_default` column declares `DEFAULT TRUE`. Greenfield baseline = no `UPDATE` migration needed.

**App-level:**
- `CollectionsService.create()` defaults `secureFieldsByDefault = true`.
- TypeORM entity: `@Column({ default: true })`.
- Any code site explicitly passing `false` is reviewed. Greenfield expectation: zero legitimate cases.

**Test sweep:**
- Existing tests relying on `secureFieldsByDefault=false`'s explicit opt-out default-allow branch are rewritten to test the deny path.
- The two tests protecting the explicit opt-out default-allow branch itself stay (the branch remains in the evaluator for explicit per-collection opt-out, which is a customer-facing capability for low-sensitivity collections).
- New test: `secureFieldsByDefault=true` + no rules → field denied + provenance level-7.

### 2.9 `/authorization/explain` endpoint + audit provenance integration

**Existing endpoints (preserved):**
- `POST /authorization/explain/collection` — body carries `{ userId, collectionId, operation }`; returns `DecisionProvenance`.
- `POST /authorization/explain/field` — body carries `{ userId, collectionId, field: { code, isSystem } }`; returns `FieldDecisionProvenance`.

Both live on `apps/api/src/app/metadata/access/explain.controller.ts`. W2 keeps the URL shape + DTO contract; the POST/body shape matches the existing controller and is correct for an admin-only diagnostic call.

**What W2 changes:**
- The class-level `@Roles('admin')` (bare; currently scanner-fail under Stream 3's bare-`@Roles` rule) is migrated to `@RequirePermission('authorization:explain:read')`. The registry entry is `dangerous: true` because the endpoint exposes authorization reasoning about users and records. Migration lands in Stream 3's annotation sweep alongside other identity-area handlers (NOT as a Stream-2 PR — separating registry definition from the per-handler annotation work).
- Response shape unchanged: returns the provenance object `{ effect, matchedLevel, matchedRuleId?, matchedPrincipal?, maskStrategy?, fallbackChain: string[] }`.

**Audit provenance shape:** standardized inside existing `AuditLog.context.additionalData` JSONB. No parallel top-level `authzProvenance` column added.

**Audit write path (corrected):** `PermissionsGuard` and `CollectionAccessGuard` write 403-outcome audit rows by calling a guard-facing audit service. The interface is `AccessAuditPort`, extended with a new `logAccessDenied({ provenance, principal, resource, ... })` method. **Port location:** the interface MOVES from `libs/authorization/src/lib/audit-port.ts` to `libs/auth-guard/src/lib/audit-port.ts` — `libs/authorization` already imports `UserRequestContext` from `libs/auth-guard` (see `authorization.service.ts:2`), so keeping the port in `libs/authorization` and importing from there into `libs/auth-guard`'s guards would create a cycle. Auth-guard is the more foundational lib; the port lives there. `libs/authorization` updates its import to consume from `@hubblewave/auth-guard`. Existing callers (e.g., `TokenIssuerService.logSecurityEvent` in `apps/api/...`) update import paths but their behavior is unchanged.

The adapter implementation (in `apps/api` / `apps/control-plane`) creates the `AuditLog` row with the provenance payload inside `context.additionalData`. The existing `AuditLogSubscriber` continues to hash inserted audit rows on its `beforeInsert` hook — no subscriber change. Subscriber's role is integrity (hash chain), not write triggering.

### 2.10 Stream 2 deliverables (PR sequence — 6 PRs)

1. **Permission registry library + scanner (reporting-only)** — `libs/permission-registry` package; registry seed empty/minimal; `tools/scanners/permission-registry-sync-check.ts` reports but doesn't fail CI.
2. **`@RequireCollectionAccess` + `CollectionAccessGuard`** — new decorator + guard wiring into §28 evaluator. No consumers yet.
3. **Migrate 213 `@RequirePermission` call sites + populate registry + flip scanner to hard CI gate.** Each existing call site gets a registered code OR converts to `@RequireCollectionAccess` for data-ACL routes OR converts to `@AuthenticatedOnly`. Registry populated. Scanner flips at end of this PR. Frontend permission constants reconciled to registry codegen.
4. **`secureFieldsByDefault = true` baseline flip (app-side).** DB default rolled into pre-W2 baseline; this PR closes collection-creation default + test sweep.
5. **§28.6 search short-circuit retirement.** Delete `search-query.service.ts:179` admin `allow_all` branch. Canon §28.6 amendment commits with this PR.
6. **Audit provenance write path + port relocation + `/authorization/explain` capability registration.** Moves `AccessAuditPort` from `libs/authorization` to `libs/auth-guard` (avoids a cycle since `libs/authorization` already imports `UserRequestContext` from `libs/auth-guard`). Existing callers (`TokenIssuerService`, `AuthorizationService` consumers) update import paths; their behavior is unchanged. Extends the port with `logAccessDenied(...)`; wires `PermissionsGuard` + `CollectionAccessGuard` to call it on 403. Adapter writes the `AuditLog` row with provenance in `context.additionalData`; existing `AuditLogSubscriber` continues to hash on insert (no subscriber change). Registers `authorization:explain:read` in `PERMISSION_REGISTRY` (`dangerous: true`). The existing `POST /authorization/explain/{collection,field}` endpoints stay; their class-level `@Roles('admin')` migrates to `@RequirePermission('authorization:explain:read')` as part of Stream 3's identity-area annotation sweep, not in this PR.

All PRs green at HEAD. PR #3 depends on #1 + #2.

### 2.11 Stream 2 exit gate

- `permission-registry-sync-check` green as required CI gate.
- All 213 + new `@RequirePermission` call sites use registered codes.
- `frontend-permission-string-check` green (frontend uses only registered codes from codegen).
- `search-query.service.ts` admin short-circuit deleted; integration test proves admin search flow uses §28 with provenance.
- `secureFieldsByDefault=true` confirmed at entity + DB.
- `/authorization/explain` returns valid provenance for ALLOW, DENY, MASK at every §28 level (parameterized integration test).
- Canon §28.6 amendment landed.

### 2.12 Stream 2 deletion ledger

- `apps/api/src/app/ava/search/search-query.service.ts:179` admin `allow_all` branch.
- Ad-hoc permission strings in controllers not aligned to registry.
- Stale frontend permission constants in `apps/web-client/**` and `apps/web-control-plane/**` — replaced by registry codegen typed enum.
- `secureFieldsByDefault: false` defaults in entity definitions / DTOs (excluding the two tests protecting the explicit opt-out default-allow branch).
- Any wildcard-style permission expansion logic in `PermissionsGuard` (canon §28.6 forbids; verify deleted).

(The `identity.permissions` table and UUID `permission_id` columns on `role_permissions` are not Stream-2 deletions — they are absent from the Pre-W2 baseline. See Pre-W2 gate ledger in §6.4.)

---

## Stream 3 — Route Boundary Hardening

**Goal:** every handler in `apps/api` + `apps/control-plane` carries exactly one effective primary boundary decision after class + method metadata resolution. `PermissionsGuard` runtime is hard deny — unannotated reaches no production code path with user-visible "server error" messages.

### 3.1 AST-aware coverage scanner

**File:** `tools/scanners/route-boundary-coverage-check.ts` — replaces the regex `tools/scanners/permissions-annotation-coverage.ts`.

Uses TypeScript compiler API (`ts-morph` or raw `typescript.createProgram`) to walk:
- Every class decorated with `@Controller(...)` in `apps/api/src/**` AND `apps/control-plane/src/**`.
- Every method on that class decorated with an HTTP-handler decorator: `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@All`, `@Options`, `@Head`, **`@Sse`**. SSE endpoints (Stream 4's `/identity/me/events` and `/auth/me/events`) are within scanner scope and require a primary boundary decision like any other endpoint.

For each handler, the scanner:
1. Collects class-level + method-level decorators.
2. Resolves effective primary boundary decision (method overrides class).
3. Applies scanner rules per the exit-criterion mutual-exclusion list.

Scanner emits human-readable summary + machine-readable JSON. CI mode: nonzero exit on any violation.

### 3.2 Annotation sweep — 597 unannotated handlers

Inventory at Prelude close: 207/804 annotated (25.7%). Stream 3 closes all 597 unannotated handlers + migrates bare-`@Roles` handlers to `@RequirePermission(...)`.

Per handler, the primary decorator is selected by route shape:

- **Cross-cutting platform capability** (admin endpoint, audit, system config, integration secrets, schema authoring) → `@RequirePermission(<registered-code>)`. Add the code to `PERMISSION_REGISTRY` if not present (typical for the long-tail capabilities surfaced during the sweep).
- **Data ACL** (e.g., `/collections/:collectionId/records`, `/views/:viewId/data`) → `@RequireCollectionAccess({ verb, collection: { from: 'param', name: 'collectionId', kind: 'id' }, record?: { from: 'param', name: 'recordId' } })`.
- **User identity** (e.g., `/users/me`, `/auth/profile`, `/sessions/me`) → `@AuthenticatedOnly()`.
- **Public** (e.g., `/health`, `/.well-known/jwks.json`, `/api/auth/login`) → `@Public()` with one-line rationale comment.

**Redundant `@Roles`** (where `@RequirePermission` already expresses the capability) is **deleted**. Capability is the contract; role is one way a user receives it. Exception: routes that genuinely depend on a control-plane role hierarchy or rare class-level narrowing not expressible as a platform capability. Such cases are scanner-visible as auxiliary, never primary.

### 3.3 `PermissionsGuard` runtime flip

After all 597 handlers are annotated and the AST coverage scanner is at 100%, the guard's warn-and-allow branch is deleted.

**Runtime behavior:**
- `@Public()` → guard skipped via existing `IS_PUBLIC_KEY` reflector check.
- `@AuthenticatedOnly()` → `JwtAuthGuard` validates; `PermissionsGuard` returns allow.
- `@RequirePermission(code)` → `ctx.permissionCodes` must contain `code`; else `ForbiddenException` with minimal shape.
- `@RequireCollectionAccess(opts)` → handled by `CollectionAccessGuard` (Stream 2); `PermissionsGuard` defers.

**Unannotated handler fallback** (should be unreachable due to scanner CI gate):
- **Test + local dev:** throws `InternalServerErrorException('Handler missing boundary decision: <name>')` for loud config failure. Developers see the error immediately.
- **All other environments (staging, prod, demo, sandbox, any shared deploy):** returns minimal closed 403, logs `ERROR` level with route + handler name, records `RuntimeAnomalyService.record(...)` event. Users never see "server error" for an authorization misconfiguration.

The trigger is an explicit env flag `HW_LOUD_AUTH_MISCONFIG=true`, set only in test/local-dev profiles. Defaults to false. `NODE_ENV` is not used for this decision because staging is `NODE_ENV=production` but should not surface 500s to operators or users.

**403 response shape:**

```json
{
  "statusCode": 403,
  "message": "Permission denied",
  "code": "PERMISSION_DENIED"
}
```

No provenance in response. Full detail in audit log + `/authorization/explain`.

### 3.4 AbacGuard direction in W2 (no change)

Per Prelude: `AbacGuard` stays opt-in via `@UseGuards(AbacGuard)` at the controller level. Not in `APP_GUARD`. The route-boundary scanner does NOT require AbacGuard application; it's an orthogonal attribute layer. Re-globalizing AbacGuard is W3+ scope.

### 3.5 Control-plane parity

The AST scanner walks `apps/control-plane/src/**` identically. Expected handler distribution:

- ~80% → `@RequirePermission` (HubbleWave admin capabilities: `tenant:provision`, `instance:lifecycle:manage`, `license:configure`, `billing:read`, `system:admin`). Registry entries tagged `plane: 'control-plane'`.
- ~10% → `@AuthenticatedOnly` (admin's own profile/session).
- ~10% → `@Public` (`/health`, `/api/auth/login`).
- `@RequireCollectionAccess` is not expected on control-plane (no customer-collection ACL there).

### 3.6 Stream 3 deliverables (PR sequence)

1. **AST-aware coverage scanner in reporting-only mode.** New `tools/scanners/route-boundary-coverage-check.ts`; inventory output; CI runs but doesn't yet fail.
2. **Annotation sweep — 10-15 per-area PRs.** Grouped by boundary/domain:
   - identity (auth, users, roles, groups, policies)
   - metadata (schema, collections, properties)
   - metadata (views, dashboards, navigation, applications)
   - data (CRUD, grid, work, offerings)
   - automation (rules, workflow, scheduling)
   - AVA (chat, governance, search, reasoning)
   - analytics (audit, dashboards, insights)
   - notifications
   - control-plane (auth, customers, instances)
   - control-plane (ops, metrics, packs, subscriptions)

   Each PR closes its area's handlers, leaves master green, scanner stays reporting-only.

3. **Final coverage-flip PR.** When all areas at 100%: flip scanner to hard CI gate, delete `permissions-annotation-coverage.ts` (regex version), delete `PermissionsGuard` warn-and-allow branch, delete `docs/permissions-rollout-coverage.md`.

### 3.7 Stream 3 exit gate

- AST coverage scanner green at 100% on both planes.
- `permissions-annotation-coverage.ts` regex version deleted.
- `permissions.guard.ts` warn-and-allow branch deleted; runtime is hard deny.
- `docs/permissions-rollout-coverage.md` deleted.
- No `KNOWN_DEFERRED_OFFENDERS` entries for unannotated handlers.
- Integration test: artificially unannotated handler → scanner CI fail. Same handler in production runtime → closed 403 + RuntimeAnomaly record. Same in non-production → 500.
- Bare `@Roles('admin')` handlers all migrated or kept as documented auxiliary-only exceptions.

### 3.8 Stream 3 deletion ledger

- `tools/scanners/permissions-annotation-coverage.ts` (regex version).
- `libs/auth-guard/src/lib/permissions.guard.ts` warn-and-allow branch.
- `docs/permissions-rollout-coverage.md` rollout tracking artifact.
- All `KNOWN_DEFERRED_OFFENDERS` entries for unannotated handlers.
- Bare `@Roles('admin')` decorators where the role is already implied by a registered capability.
- `apps/api/src/app/identity/roles/decorators/permission.decorator.ts` if it duplicates `libs/auth-guard`'s `@RequirePermission` (consolidate to the lib).

---

## Stream 4 — Cross-Surface Consistency

**Goal:** the contracts established by Streams 1-3 are honored uniformly across search engines, the audit pipeline, AVA writes, the dashboard read path, and both frontend clients. The W2 exit criterion is provable end-to-end.

**Sequencing:** Stream 4 splits into 4a (parallel with Stream 1 — disjoint code paths) and 4b (after Streams 1-3 — depends on contracts).

### 4.1 Stream 4a — independent work

#### 4.1.1 Audit hash-chain concurrency (F042) — verify

`libs/instance-db/src/lib/subscribers/audit-log.subscriber.ts:46` already issues `SELECT pg_advisory_xact_lock(hashtext($1))` before reading the predecessor. Existing spec covers queueing semantics with a fake DB.

Stream 4a adds an **integration stress test against a real Postgres**: 50 concurrent transactions each inserting 10 audit rows in 5 different sessions. Assertions: chain length 500, no gaps, every `previousHash` matches prior row's `hash`. Non-flaky in CI.

If the stress test passes, F042 is closed (no code change). If it reveals a real bug, that's net-new work and gets surfaced via the Learning-Revises-Plan rule.

#### 4.1.2 AVA chat transactionality (F052)

**File:** `apps/api/src/app/ava/chat/chat-orchestrator.service.ts` (verify path during implementation).

Wrap the 7-write orchestration in `this.dataSource.transaction(async (tx) => { ... })`. All operations use the transactional `EntityManager`. Audit writes go through the existing transactional audit helper from canon §10 (`withAudit(dataSource, fn)`). If the helper's current signature only accepts a `DataSource`, extend it to also accept an `EntityManager` from an open transaction — this avoids requiring a nested transaction inside the orchestration's transaction.

**Test plan:** parameterized failure injection at each of the 7 steps; assert post-failure DB state matches pre-call state. No orphan messages, no inconsistent conversation state.

#### 4.1.3 Dashboard widget authz (F146)

**File:** `apps/api/src/app/analytics/dashboards/dashboards.service.ts:122-142`

F146 work is **verify + complete + remove bypass tracking**, not build-from-zero (the service may already have partial filtering logic — confirm during implementation).

Fix:
- New method `AuthorizationService.filterDashboardLayout(layout, principal): FilteredLayout` — walks layout tree, drops widgets where principal lacks `read` on widget's data source. Returns provenance for drops.
- `DashboardsService.getDashboard()` and `getDashboardLayout()` call `filterDashboardLayout` before returning.
- **Audit volume**: one audit event per dashboard read with `droppedWidgetCount` + compact provenance summary when drops occurred. NOT one event per stripped widget.
- `tools/authz-bypass-check.ts` `KNOWN_BYPASSES` F146 entry removed.

### 4.2 Stream 4b — depends on Streams 1-3

#### 4.2.1 Unified search authz emitter — verify

After Stream 2 retires the `search-query.service.ts:179` admin short-circuit, `buildAuthzAst(principal, collection)` calls §28 directly and produces `FilterAst`. The existing `libs/search-authz` library (from Plan Fix 30 PR-1/2/3) compiles to both Typesense and pgvector engine outputs.

Stream 4b verifies the §28-output flow + adds engine-parity tests:

- `buildAuthzAst` uses `principal.roleIds` (UUIDs) per Stream 1 contract; no code-vs-id ambiguity in the emitter.
- `extractRequiredAttributes(ast)` walker emits `_collection_id` + per-attribute ACL projection fields correctly.
- `SearchIndexingService.buildAclFields()` attaches projections on every Typesense document write; pgvector tables carry `_collection_id` + `_attribute_*` columns.

**Integration tests** (parameterized over both engines):
- **Corpus accuracy:** index 100 records across 3 collections. User has `read` on 1 collection, `deny` (level 1) on a specific record in that collection. Search → returns only records the user can read; deny record absent.
- **Facet accuracy:** facet counts match visible corpus, not total corpus.
- **Pagination accuracy:** `?page=2&pageSize=10` returns records 11-20 of the AUTHORIZED set; no skipped indexes from post-filtering.

#### 4.2.2 Frontend field-level permission wiring (F091)

**API contract for UI-facing record/list/search/dashboard responses:**

```json
{
  "record": {
    "id": "uuid",
    "name": "WO-1234",
    "assignee": "***-**-4521",
    "salary": null
  },
  "permissions": {
    "canCreate": true,
    "canUpdate": true,
    "canDelete": false,
    "fields": {
      "name":     { "canRead": true,  "canWrite": true },
      "assignee": { "canRead": true,  "canWrite": false, "maskStrategy": "PARTIAL" },
      "salary":   { "canRead": false }
    }
  }
}
```

Notes:
- Backend `maskCollectionRecord` already masks values per §28.5 (most-restrictive severity after Stream 2). Frontend renders what it gets.
- `canRead: false` → backend omits the field from `record`; frontend hides the column.
- `canWrite: false` → frontend renders read-only; submitting with denied field present → backend 403.
- Per-field permissions are uniform across records in the same query response — computed once from the collection-level evaluator output, applied to all records.
- **`permissions` payload is always included** on UI-facing record/list/search/dashboard data responses. Non-UI / internal service endpoints declare their response contract explicitly per endpoint.

**Frontend changes:**
- `apps/web-client/src/components/form/FieldRegistry.tsx` reads `permissions.fields[name]`; hide / mask / disable accordingly.
- `apps/web-client/src/components/form/FormLayout.tsx` same.
- List/grid components: same per-column treatment.
- Search result rendering: same.
- Dashboard widget rendering: same (after F146 filter, widgets still carry `permissions`).
- `apps/web-control-plane` mirrors the pattern with its own components.

#### 4.2.3 Frontend 401/403 UX (F102)

**File:** `apps/web-client/src/api/services/api.ts` error interceptor.

Classifications:
- **401** → silent-refresh flow; on refresh failure, redirect to login.
- **403 with `code: 'PERMISSION_DENIED'`** → toast "You don't have permission to perform this action." If failure was route navigation, redirect to `/permission-needed` rather than render 403.
- **403 with other `code` values** (`RATE_LIMITED`, `ACCOUNT_SUSPENDED`) → mapped friendly messages.

**Route-level guard (UX only):**
- On app boot, fetch the plane's identity-self endpoint → cache `permissionCodes` + `roleCodes` in tab memory.
  - `apps/web-client` (instance plane): `GET /users/me`.
  - `apps/web-control-plane` (control plane): `GET /auth/me`.
- Route definitions declare required capability: `route('/admin/settings', { requires: 'system:admin' })`.
- Router guard checks cache pre-navigation; navigates to `/permission-needed` if missing.
- **Backend remains authoritative.** Stale frontend cache is never a security boundary. Any tampered or stale cache claiming a capability the user lacks → backend 403 on the actual call.

`apps/web-control-plane` uses the same interceptor + route-guard pattern with its own API client and self endpoint.

#### 4.2.4 SSE invalidation channel

**Endpoints (per plane):**
- Instance plane: SSE at `GET /identity/me/events`; refetch on event: `GET /users/me`.
- Control plane: SSE at `GET /auth/me/events`; refetch on event: `GET /auth/me`.

Narrow auth-event channel. Only three event kinds:
- `permissionCodesChanged`
- `roleCodesChanged`
- `sessionRevoked`

On event, frontend refetches the plane's identity-self endpoint; cache repopulates.

**Fallbacks for SSE disconnect:**
- Refetch on tab focus.
- Refetch after any 403 response.

This is a narrow identity/session invalidation channel, NOT a general realtime framework.

#### 4.2.5 Audit provenance integration

`AuditLog.context.additionalData` JSONB gains a standardized `authzProvenance` payload on 403 outcomes:

```json
{
  "authzProvenance": {
    "effect": "deny",
    "matchedLevel": 7,
    "matchedRuleId": null,
    "matchedPrincipal": null,
    "fallbackChain": [
      "level-1: no match",
      "...",
      "level-7: default deny (secureFieldsByDefault=true)"
    ]
  }
}
```

Written by `PermissionsGuard` and `CollectionAccessGuard` on every 403, through the guard-facing audit service (`AccessAuditPort.logAccessDenied(...)` per §2.9). The adapter saves the row; `AuditLogSubscriber` hashes it on insert as it does today — no subscriber change. Read via `/authorization/explain/{collection,field}` (Stream 2) or direct audit-log queries with `authorization:explain:read` capability.

No new top-level audit column. Standardized shape inside existing `additionalData`.

#### 4.2.6 Boundary-consistency validation harness

**File:** `scripts/w2-validate.ts` — extends `scripts/prelude-validate.ts`.

**Additional happy-path assertions:**
- Login as admin → `GET /api/users` → 200.
- Login as non-admin (no `identity:user:manage`) → `GET /api/users` → 403 with body matching `{ statusCode: 403, message: "Permission denied", code: "PERMISSION_DENIED" }` exactly.
- Admin (with `authorization:explain:read` capability) → `POST /authorization/explain/collection` with body `{ userId, collectionId, operation: 'read' }` → 200 with `DecisionProvenance`. Same admin → `POST /authorization/explain/field` with body `{ userId, collectionId, field: { code, isSystem } }` → 200 with `FieldDecisionProvenance`.
- `GET /collections/:id/records/:recordId` → response carries `permissions.fields` map.
- Service-token scope test: svc-worker → svc-api audience hits an automation endpoint that W2 has annotated with `@AllowServiceToken + @RequireServiceScope('automation:invoke')`. The specific endpoint is named by the implementation plan after the Stream 3 sweep audits which automation routes are legitimately service-invokable. `SyncTriggerController` is NOT a candidate — its current documentation at `apps/api/src/app/automation/sync-trigger/sync-trigger.controller.ts:33-39` explicitly commits to user-JWT-only semantics; W2 preserves that contract. With the chosen endpoint annotated: token with scope claim → 200. Without the scope claim → 403. Without `@AllowServiceToken` on the endpoint → 401.
- Service-token data-access test (separate API surface from automation; tests the two-layer model): every service-accepted data route carries its own data-surface scope. The data-record read surface uses capability `data:record:read` (registered in `PERMISSION_REGISTRY`, coarse family — create/update/delete verbs collapse to a single `data:record:manage` family code, staying within the fixed `PermissionAction` enum at §2.1). svc-worker presents a token bearing `data:record:read` scope and hits `GET /api/data/collections/:collectionCode/data` (runtime path — `CollectionDataController` declares `@Controller('data/collections')` and `main.ts:15` applies the global `api` prefix). The route is annotated `@AllowServiceToken + @RequireServiceScope('data:record:read') + @RequireCollectionAccess({ verb: 'read', collection: { from: 'param', name: 'collectionCode', kind: 'code' } })`. Two layers apply independently: (1) scope claim says "this service can call the data-record-read API surface"; (2) §28 `CollectionAccessRule` grants on the service principal decide which specific collections the call may read. Test assertions: token with `data:record:read` scope + service principal with `read` grant on the requested collection → 200; same token, no grant on the requested collection → 403 via §28; token without the scope claim → 403 via `@RequireServiceScope`; without `@AllowServiceToken` on the endpoint → 401.

**Controller prefix hygiene (Stream 3 sub-task):** the AST coverage sweep audits every `@Controller(...)` path for accidental `api/` doubling. `apps/api/src/app/automation/sync-trigger/sync-trigger.controller.ts:43` (`@Controller('api/automation/sync-trigger')`) and `apps/api/src/app/automation/runtime/ava-automation.controller.ts:36` (`@Controller('api/automation/ava')`) currently resolve as `/api/api/automation/...` at runtime under the global prefix. The sweep fixes these to `automation/sync-trigger` and `automation/ava` respectively. Any other doubled-prefix controllers surfaced by the audit get the same treatment in the per-area annotation PR that touches them.
- Admin role retired → `permissionCodes` cache invalidates within 1s → next request to admin-only endpoint → 403.

**Additional negative-case assertions:**
- HS256-style token (signed with old `JWT_SECRET`) presented to any endpoint → 401. No path accepts it.
- Non-admin search → response excludes records the user lacks `read` on; facet counts reflect visible corpus; pagination has no skipped indexes.
- Dashboard fetch as user lacking widget collection access → layout returns with denied widget stripped; one audit row with `droppedWidgetCount` written.
- AVA chat orchestration with simulated step-5 failure → conversation state = pre-call state.
- Audit chain after 50 concurrent transactions × 10 inserts → length 500, no gaps.

**CI hook:** runs on every PR touching `apps/api/**`, `apps/control-plane/**`, `libs/authorization/**`, `libs/auth-guard/**`, `libs/permission-registry/**`, or either web client. Required status check.

### 4.3 Stream 4 deliverables

**Stream 4a (parallel with Stream 1):**
1. F042 hash-chain stress test (verification + integration test).
2. F052 AVA chat transactionality wrap + failure-injection tests.
3. F146 dashboard widget authz filter (verify + complete) + integration tests + audit volume reduction.

**Stream 4b (after Streams 1-3):**
4. Unified search authz emitter verification + corpus/facet/pagination accuracy tests (both engines).
5. API contract extension: `permissions.fields` payload on UI-facing reads.
6. Frontend field-permission wiring (FieldRegistry + FormLayout + list/grid + search/dashboard renderers, both clients).
7. Frontend 401/403 UX (both clients).
8. SSE invalidation channels (instance: `/identity/me/events`; control: `/auth/me/events`) + frontend subscribers + per-plane refetch (`/users/me` vs `/auth/me`) + fallback refetch logic (tab focus, post-403).
9. Audit provenance extension inside `additionalData` (`authzProvenance` payload written by guards on 403).
10. `scripts/w2-validate.ts` harness + required CI gate wiring.

10 PRs total. Stream 4a's 3 PRs land any time during the wave; Stream 4b's 7 PRs land after Streams 1-3 stabilize.

### 4.4 Stream 4 exit gate

- F042 stress test green.
- F052 transactionality rollback test green at every failure injection point.
- F146 dashboard widget authz integration test green; `authz-bypass-check.ts` `KNOWN_BYPASSES` F146 entry deleted.
- F136 search corpus/facet/pagination accuracy tests green on both Typesense and pgvector.
- F091 frontend tests green: hidden field, masked value, read-only field, denied widget on dashboard.
- F102 frontend 401/403 UX tests green on both clients.
- SSE invalidation test green: backend permission change → frontend cache refreshes within 1s.
- Audit provenance present on every 403 outcome (sampled integration test).
- `w2-validate.ts` happy + negative paths all green.

### 4.5 Stream 4 deletion ledger

- `apps/api/src/app/analytics/dashboards/dashboards.service.ts` unfiltered-layout branch (if present after F146 verification).
- `apps/web-client/src/api/services/api.ts` silent-fail-on-403 path.
- `tools/authz-bypass-check.ts` `KNOWN_BYPASSES` F146 entry.
- `FieldRegistry.tsx` + `FormLayout.tsx` raw-render branches that don't consult `fieldPermissions`.
- Frontend permission string constants — replaced by registry codegen typed enum.
- AVA chat orchestrator's non-transactional 7-write sequence.
- `apps/web-control-plane` analogous unfiltered / silent / non-typed paths.

---

## Cross-stream invariants

Properties that must hold across more than one stream. Verified by integration tests in `w2-validate.ts` and by code-level scanners.

| Invariant | Streams that establish | Verified by |
|---|---|---|
| Every authorization decision starts from `RequestContext` narrowed to `UserRequestContext` or `ServiceRequestContext` | S1 contract; S3 scanner | `no-untyped-req-check` + compile-time discriminated union |
| `@RequireServiceScope(code)` uses platform capability codes from `PERMISSION_REGISTRY` | S1 enforcement + S2 registry | `permission-registry-sync-check` (extended) |
| No HS256 / `JWT_SECRET` / `jsonwebtoken` signing paths anywhere | S1 control-plane migration + scanner | `no-hs256-signing-check` |
| Audit writes occur in same transaction as audited action | Existing canon §10 (W5); S4a AVA chat fix extends | `audit-bypass-check` (extended) |
| Permission cache invalidation is uniform across identity / resolver / ACL / frontend caches | S1 cache wiring; S4b SSE channel | Integration test: edit role permission → assert ≤1s cache mismatch on all four surfaces |
| Provenance JSON shape is identical across `/authorization/explain`, 403-outcome audit log entries, and search authz emitter inputs | S2 §28; S4b emitter verification | Schema test: provenance JSON validates against same JSON Schema in all three surfaces |
| Frontend cache + route guards are UX-only, never authoritative | S4b interceptor + guard design | Test: tampered frontend cache claiming `system:admin` → backend 403 on actual call |
| `Role.code` immutable after creation | S1 DB trigger + entity `update: false` | DB trigger test |
| Service tokens default-deny on all endpoints; opt-in via `@AllowServiceToken` + scope via `@RequireServiceScope` | S1 enforcement + scanner | `service-token-default-deny-check` + integration test |
| Frontend permission strings come from registry codegen, never hand-typed | S2 registry codegen; S4b consumer migration | `permission-registry-sync-check` (extended to frontend) |

---

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Annotation sweep judgment errors (Stream 3) — 597 handlers, each requires a domain decision; wrong choice = false 403 or over-permissive route | Per-area PRs reviewable by domain owner; integration tests for high-risk capabilities (admin, audit, identity, service-to-service); provenance logging on 403 surfaces false denies fast |
| 2 | Permission cache invalidation race (F025) — Redis pub/sub delivery isn't transactional | Short cache TTL (≤30s) as backstop; stress-test worst-case stale window in Stream 1 verification |
| 3 | Control-plane ES256 ops dependency — KMS alias must exist before prod deploy | Dev/staging uses `LocalEs256KeySigningService`; prod deploy gated on KMS alias resolution check at startup |
| 4 | `secureFieldsByDefault=true` flip breaks existing call sites | Greenfield = test sweep + explicit seed of expected grants in baseline; W2 timing absorbs the fix |
| 5 | Permission registry growth beyond "coarse families" goal | Review at Stream 2 PR #3; consolidate where capabilities overlap without losing precision |
| 6 | F042 stress test surfaces a real concurrency bug | Run stress test EARLY in Stream 4a (week 1); if bug surfaces, expand scope and resequence streams per Learning-Revises-Plan |
| 7 | Frontend SSE connection scaling — per-user persistent connection | Auth-only events = low message volume per connection; load-test at expected pilot concurrency |
| 8 | Canon §29.7 service-scope amendment surfaces existing service code relying on collection-action scopes | Audit `service_principals.allowed_scopes` rows (currently only `svc-worker → svc-api`) for collection-shape entries; rewrite to capability codes in Stream 1 PR #4 |
| 9 | `@RequireCollectionAccess` always-explicit shape forgets a field on one of many data-ACL routes during sweep | Scanner validates required metadata shape; CI fails on missing fields at PR time |
| 10 | Frontend `permissions.fields` payload size on large records → bandwidth concern | Per-field permissions computed ONCE per query, applied to all records in response; bandwidth O(field count) not O(record count × field count) |

---

## Aggregate deletion ledger

Single accounting across all streams.

**Pre-W2 baseline (absent from the squashed baseline DDL — these don't exist post-baseline):** 98 instance migrations + 8 control-plane migrations from the pre-baseline archaeology; demo/sample seed scripts; `identity.permissions` UUID-keyed table (replaced by `identity.platform_permissions` code-keyed); UUID `permission_id` columns on `identity.role_permissions` (replaced by `permission_code text` FK); `CollectionDefinition.secure_fields_by_default DEFAULT FALSE` (replaced by `DEFAULT TRUE`).

**Stream 1:** control-plane HS256 / `JWT_SECRET` paths; `UserRequestContext.roles` ambiguous field; `UserRequestContext.permissions` renamed; `AuthorizationService.toAbacPrincipal` `ctx.roles`-as-UUIDs fallback; `JwtAuthGuard` JWT-embedded-roles fallback; test fixtures injecting `attributes.roleIds`; security-bypass PUBLIC_ALLOWLIST entries for pre-ES256 control-plane paths; `refresh-token.entity.ts:26` erroneous `schema: 'identity'` declaration (control-plane has no `identity` schema).

**Stream 2:** `search-query.service.ts:179` admin `allow_all` branch; ad-hoc permission strings not aligned to registry; stale frontend permission constants; `secureFieldsByDefault: false` defaults in entity/DTO definitions; wildcard-style permission expansion logic (if present).

**Stream 3:** `tools/scanners/permissions-annotation-coverage.ts` (regex); `permissions.guard.ts` warn-and-allow branch; `docs/permissions-rollout-coverage.md`; `KNOWN_DEFERRED_OFFENDERS` entries for unannotated handlers; bare `@Roles('admin')` decorators where permission expresses the capability; duplicate `@RequirePermission` decorator at `apps/api/src/app/identity/roles/decorators/permission.decorator.ts` (if duplicate).

**Stream 4:** dashboard `getDashboard` unfiltered branch (if present); API silent-fail-on-403 path; `tools/authz-bypass-check.ts` F146 `KNOWN_BYPASSES` entry; `FieldRegistry.tsx` + `FormLayout.tsx` raw-render branches; hand-typed frontend permission constants; AVA chat non-transactional 7-write sequence; `apps/web-control-plane` analogous paths.

---

## Canon amendments

**Amendment timing:** stream-local landing + summary close PR.

Behavior-changing canon updates land with the PR that implements the behavior, so the canon does not knowingly describe the old system after the new code lands. A short W2 close PR summarizes the final state.

**Amendments by stream:**

- **Stream 1 PR #4** (`@RequireServiceScope` enforcement): amends canon §29.7 — service scopes use platform capability codes from `PERMISSION_REGISTRY`, not `<collection>:<action>` shape. Service principals needing customer-collection access have `CollectionAccessRule` grants alongside; the §28 evaluator handles the collection check. Same primitives, same provenance, no parallel service-only authz vocabulary. Updates the seed manifest example to use a capability code.
- **Stream 1 PR #5** (session lifecycle): amends canon §29.6 — restates explicitly that role-grant changes (gain or loss) do NOT bump `security_stamp`. Caches invalidate; sessions persist. Adds clarifying example.
- **Stream 2 PR #5** (§28.6 search short-circuit retirement): amends canon §28.6 — notes that search admin short-circuit retirement mirrors AuthorizationService Plan Fix 33. Admin authority flows uniformly through §28 across all evaluators.
- **Stream 2 PR #3** (registry sweep + scanner hard gate): amends canon §9 — the four primary boundary decorators (`@RequirePermission`, `@RequireCollectionAccess`, `@AuthenticatedOnly`, `@Public`) are the contract for endpoint authorization. `@Roles` is auxiliary, never primary.
- **Stream 3 final coverage-flip PR**: amends canon §21 — scanner inventory extended with `no-hs256-signing-check`, `route-boundary-coverage-check` (AST), `permission-registry-sync-check`, `service-token-default-deny-check`, `no-untyped-req-check`. Each ships with a self-test.

**W2 close PR:** summarizes the final state in a single canon §24 amendment-log entry. Does not re-amend the individual sections; just records the wave's overall completion and the surfaces that were touched.

---

## Definition of done

W2 is done when ALL are true:

1. **Pre-W2 gate** lands: fresh-DB baseline + bootstrap scripts + updated index scanner; schema manifest/hash committed; `prelude-validate.ts` happy + negative paths green.
2. **Stream 1** (6 PRs) merged; exit gate green: principal contract clean; control-plane ES256 + JWKS live; service-scope enforcement green; session lifecycle tests green; 4 new scanners green.
3. **Stream 2** (6 PRs) merged; exit gate green: registry library + sync scanner green; `@RequireCollectionAccess` + guard wired; all `@RequirePermission` sites use registered codes; `secureFieldsByDefault=true` confirmed; §28.6 search short-circuit deleted; `/authorization/explain` returns valid provenance at every §28 level.
4. **Stream 3** (10-15 per-area annotation PRs + final coverage-flip PR) merged; exit gate green: AST coverage scanner green at 100% on both planes; warn-and-allow branch deleted; bare-`@Roles` migrated or auxiliary-marked.
5. **Stream 4** (10 PRs — 3 from 4a parallel + 7 from 4b sequential) merged; exit gate green: F042 stress test green; F052 transactionality green; F146 verified; F136 search accuracy green on both engines; F091 frontend tests green; F102 frontend 401/403 UX green; SSE invalidation works; `w2-validate.ts` happy + negative paths all green.
6. **Canon amendments** landed per stream + W2 close summary in §24 amendment log.
7. **Scanners**: all W2-scope `KNOWN_DEFERRED_OFFENDERS` / `KNOWN_BYPASSES` empty. New scanners wired as required CI gates.
8. **No bridges**: no warn-and-allow paths, no runtime allowlists, no default-allow authorization, no plane auth divergence.
9. **Boundary-consistency exit criterion verifiably holds**: every authorization decision (user OR service, instance OR control plane, API OR search OR frontend OR audit) is derived from one consistent contract.

---

## Deferred to W3+

Per Phase 3 spec preservation boundary:

- Globalize `AbacGuard` (remains opt-in via `@UseGuards(AbacGuard)`).
- Pre-compiled effective permission graphs (canon §28.8 defers).
- Application-layer authorization scope / pack-level trust grants (canon §28.9).
- Materialized permissions table for ultra-low-latency reads (canon §28.9).
- Plugin SDK contract authority (W3 scope per Phase 3 spec).

---

## Calendar estimate

**Internal anchor only; W2 is gated by exit criteria, not calendar.**

- Pre-W2 gate: 3-4 days
- Stream 1: 1.5-2 weeks
- Stream 2: 1.5-2 weeks (overlaps with end of Stream 1)
- Stream 3 per-area sweep: 1.5-2 weeks (overlaps with end of Stream 2)
- Stream 3 final coverage-flip + scanner deletion: 1-2 days
- Stream 4a: 1 week (runs parallel with Stream 1)
- Stream 4b: 1.5-2 weeks (after Streams 1-3)
- Canon amendments per stream + W2 close PR: 1-2 days

**Total wall-clock: ~5-6 weeks with parallelism.** The Phase 3 spec's earlier 4-5 week anchor was set before full greenfield strictness, control-plane ES256, full default-deny, and baseline squash were pulled into scope.

---

## References

- `CLAUDE.md` — HubbleWave Master Canon
- `docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md` — Phase 3 governing spec
- `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` — approved architectural spec
- `docs/superpowers/PLATFORM-ROADMAP.md` — master roadmap
- `docs/superpowers/RESUME-CONTEXT.md` — Phase 1/2 completion summary + Prelude close
- `docs/superpowers/plans/2026-05-14-phase3-prelude-implementation.md` — Prelude implementation plan (executed)
- Memory: `phase1_2_smoke_bridges.md`, `engineering_discipline_refactors_vs_perf.md`

---

**Document status:** Approved baseline. Section 1 (wave goal + exit criterion) is frozen. Sections 2-6 (stream designs + invariants + DoD) are the execution scope. Next step: invoke `writing-plans` skill to produce the W2 implementation plan.
