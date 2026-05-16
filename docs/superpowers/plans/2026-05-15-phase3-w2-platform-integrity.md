# Phase 3 W2: Platform Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a trustworthy boundary model across HubbleWave. Authorization, identity, session, audit, search, service-to-service, and frontend surfaces all derive from one consistent contract. No warn-and-allow, no runtime allowlists, no default-allow paths, no plane auth divergence.

**Architecture:** Pre-W2 baseline gate (fresh-DB squash) followed by four streams. Stream 1 (Principal & Session Integrity) and Stream 4a (audit/AVA-txn/dashboard) execute in parallel — disjoint code paths. Stream 2 (Authorization Model & Permission Registry) follows Stream 1's principal contract. Stream 3 (Route Boundary Hardening) follows Stream 2's registry. Stream 4b (Cross-Surface Consistency) closes the wave once Streams 1-3 stabilize. W2 Freeze rule holds for the entire wave.

**Tech Stack:** TypeScript, NestJS (`apps/api`, `apps/control-plane`), TypeORM, PostgreSQL with domain schemas (instance plane) + `public` schema (control plane), Nx workspace, Vite + React (`apps/web-client`, `apps/web-control-plane`), AWS KMS (production) + local ES256 file-based provider (dev), Redis (pub/sub + cache), GitHub Actions (CI). Scanners are tsx-executed TypeScript files under `tools/scanners/`.

**Governing spec:** `docs/superpowers/specs/2026-05-15-phase3-w2-platform-integrity-design.md` (commit `a1446c8`).

**W2 Freeze Rule (binding):** No non-W2 PRs land on master during the wave. Non-W2 PRs are labeled `w2-freeze-queued` and held until exit gates pass. Exception: production-breaking hotfixes unrelated to W2.

**Cross-wave rules (per Phase 3 spec):** Platform Reduction (deletion ledger per stream + aggregate); Learning-Revises-Plan (completed stream can revise downstream); Estimates are internal anchors (5-6 weeks).

**Commit prefix:** every commit uses `phase3-w2:` prefix for archaeology. Per-stream prefixes also acceptable: `phase3-w2-pregate:`, `phase3-w2-stream1:`, `phase3-w2-stream2:`, `phase3-w2-stream3:`, `phase3-w2-stream4a:`, `phase3-w2-stream4b:`.

**Canon amendments:** land stream-local with the PR that implements the behavior + a summary W2 close PR. Affected sections: §9, §21, §28.6, §29.6, §29.7.

---

## Pre-Flight: Worktree + dependency sanity

### Task 0: Verify baseline state + scanners green

**Files:** none (read-only).

- [ ] **Step 1: Confirm starting commit + clean tree**

```
git rev-parse HEAD
git status --short
```
Expected: HEAD at `a1446c8` or later (spec commit); only `.claude/settings.local.json` and untracked `AGENTS.md` in working tree (founder-known noise).

- [ ] **Step 2: Confirm Prelude scanners + tests green**

Each scanner on its own line; PowerShell 5.1 doesn't support `&&` chaining. If any throws or returns non-zero `$LASTEXITCODE`, STOP — Prelude regression must be resolved before W2 starts.

```
npm run authz:check
if ($LASTEXITCODE -ne 0) { throw 'authz:check failed' }
npm run audit:check
if ($LASTEXITCODE -ne 0) { throw 'audit:check failed' }
npm run security:check
if ($LASTEXITCODE -ne 0) { throw 'security:check failed' }
npm run service-boundary:check
if ($LASTEXITCODE -ne 0) { throw 'service-boundary:check failed' }
npm run deps:check
if ($LASTEXITCODE -ne 0) { throw 'deps:check failed' }
npm run dead-code:check
if ($LASTEXITCODE -ne 0) { throw 'dead-code:check failed' }
```

- [ ] **Step 3: Confirm prelude-validate.ts happy + negative paths**

Run:
```
npm run prelude:validate
```
Expected: 11 assertions pass.

No commit. Read-only verification.

---

## Pre-W2 Gate — Fresh-DB Baseline Squash

**Goal:** replace the 98 instance migrations and 8 control-plane migrations with one canonical baseline per plane. Baseline reflects end-state for known W2 reshapes: `identity.platform_permissions` (code-keyed), `permission_code text` FK on `identity.role_permissions`, `CollectionDefinition.secure_fields_by_default DEFAULT TRUE`.

**Exit gate:** fresh DB rebuild via `docker-compose down -v` + `docker-compose up -d postgres redis` + `npm run migration:run:instance` + `npm run migration:run:control-plane` + bootstrap scripts succeeds with zero errors; schema manifest committed; `prelude-validate.ts` green; old migration files deleted from tree; `pre-w2-migration-archive` tag pushed.

**Spec reference:** §"Pre-W2 gate — Fresh-DB Baseline Squash".

### Task 1: Generate baseline DDL from current schema

**Files:**
- Create: `migrations/instance/1000000000000-baseline.ts` (DDL embedded inline via template literals)
- Create: `migrations/control-plane/1000000000000-baseline.ts` (same shape; public schema)
- Create: `tools/schema-manifest.ts` (top-level path matching existing scanner convention)
- Create: `docs/superpowers/plans/2026-05-15-baseline-schema-manifest.md`
- Modify: `.gitignore` — add `.dev/baseline/` to the gitignored workspace-local paths (only `.dev/keys/` is currently ignored)

- [ ] **Step 1: Boot a fresh DB stack and run existing migrations to capture canonical end-state**

Powershell:
```
docker-compose down -v
docker-compose up -d postgres redis
Start-Sleep -Seconds 5
npm run migration:run:instance
npm run migration:run:control-plane
```
Expected: both migration runs exit 0. (`migration:run:instance` and `migration:run:control-plane` are the real package.json scripts; `db:reset` / `migrate` / `seed` are NOT defined.) This is the schema we squash.

- [ ] **Step 2: Create the workspace-local baseline scratch directory + gitignore**

```
New-Item -ItemType Directory -Force .dev/baseline | Out-Null
Add-Content -Path .gitignore -Value '.dev/baseline/'
```
(`.gitignore` currently lists only `.dev/keys/`; this step adds the new path. Run `git status --short .gitignore` after to verify the line was added once, not duplicated.)

- [ ] **Step 3: Generate baseline DDL via pg_dump --schema-only**

The Docker container name from `docker-compose.yml:6` is `hw_postgres` (underscore, not hyphen). Use `Out-File -Encoding utf8` rather than Unix-style `>`:
```
$pgUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'hubblewave' }
$instanceDb = if ($env:DB_NAME) { $env:DB_NAME } else { 'hubblewave' }
$cpDb = if ($env:CONTROL_PLANE_DB_NAME) { $env:CONTROL_PLANE_DB_NAME } else { 'hubblewave_control_plane' }

# Confirm both databases exist before dumping. setup.ts creates them; if you skipped setup, create them manually:
#   docker exec hw_postgres psql -U $pgUser -c "CREATE DATABASE $cpDb;" -d postgres
# Use a SQL existence check via psql -tAc (tuples-only, unaligned, command). Select-String does NOT set
# $LASTEXITCODE on no-match, so a missing DB would silently pass. Capture the SQL result and test emptiness.
$instanceExists = docker exec hw_postgres psql -U $pgUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$instanceDb'"
if (-not $instanceExists) { throw "instance DB '$instanceDb' missing — run npm run setup first" }
$cpExists = docker exec hw_postgres psql -U $pgUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$cpDb'"
if (-not $cpExists) { throw "control-plane DB '$cpDb' missing — run npm run setup first" }

docker exec hw_postgres pg_dump --schema-only --no-owner --no-privileges -U $pgUser -d $instanceDb | Out-File -Encoding utf8 .dev/baseline/instance-schema.sql
if ($LASTEXITCODE -ne 0) { throw 'instance pg_dump failed' }
docker exec hw_postgres pg_dump --schema-only --no-owner --no-privileges -U $pgUser -d $cpDb | Out-File -Encoding utf8 .dev/baseline/control-plane-schema.sql
if ($LASTEXITCODE -ne 0) { throw 'control-plane pg_dump failed' }
```
Expected: two SQL files written; both exit checks pass.

- [ ] **Step 4: Apply known intentional deltas to the captured schema**

Edit `.dev/baseline/instance-schema.sql`:
- Drop `identity.permissions` table definition.
- Drop any `permission_id uuid` column on `identity.role_permissions`.
- Add: `CREATE TABLE identity.platform_permissions (code text PRIMARY KEY, plane text NOT NULL CHECK (plane IN ('instance', 'control-plane')), domain text NOT NULL, resource text NULL, action text NOT NULL, dangerous boolean NOT NULL DEFAULT false, description text NOT NULL);`
- Replace `identity.role_permissions` definition with: `CREATE TABLE identity.role_permissions (role_id uuid NOT NULL REFERENCES identity.roles(id) ON DELETE CASCADE, permission_code text NOT NULL REFERENCES identity.platform_permissions(code) ON DELETE RESTRICT, granted_at timestamptz NOT NULL DEFAULT now(), granted_by uuid NULL, PRIMARY KEY (role_id, permission_code));`
- Change `metadata.collection_definitions.secure_fields_by_default boolean NOT NULL DEFAULT false` → `DEFAULT true`.

- [ ] **Step 5: Embed the baseline DDL directly in the MigrationInterface class**

Per spec §Pre-W2 gate "MigrationInterface classes containing schema-qualified DDL only" — do NOT use a sidecar `.sql` file (that would require additional packaging support in the K8s migration runner and risks runtime failures if the file isn't copied). Embed the DDL inline via template literal.

Create `migrations/instance/1000000000000-baseline.ts`:
```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline1000000000000 implements MigrationInterface {
  name = 'Baseline1000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- Paste the full edited DDL from .dev/baseline/instance-schema.sql here.
      -- Schemas first, then tables, then indexes, then triggers, then materialized views.
      CREATE SCHEMA IF NOT EXISTS identity;
      CREATE SCHEMA IF NOT EXISTS metadata;
      -- ... (full DDL)
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Baseline migration is forward-only');
  }
}
```

For large baselines (likely ~3000-6000 lines of DDL), split the `await queryRunner.query(...)` into a sequence of statements grouped logically (schemas, identity tables, metadata tables, etc.) — each as its own `await queryRunner.query()` call. This keeps the file readable and isolates failures.

Same shape for `migrations/control-plane/1000000000000-baseline.ts` (the control-plane baseline uses `public` schema per spec §"Control-plane schema policy"; no domain schemas).

- [ ] **Step 6: Generate schema manifest**

Create the manifest script as a new W2 deliverable. The migration-blocking-index scanner already lives at `tools/migration-blocking-index-check.ts` (not under `tools/scanners/`), so add new manifest tooling at `tools/schema-manifest.ts` to match the existing top-level convention.

Run:
```
npx tsx tools/schema-manifest.ts | Out-File -Encoding utf8 docs/superpowers/plans/2026-05-15-baseline-schema-manifest.md
```
The manifest is a deterministic listing of every table + column + index in baseline, with the three intentional-deltas explicitly annotated.

The script:
- Connects to the running DB.
- Runs `pg_dump --schema-only` or equivalent introspection queries.
- Normalizes output (sorts tables, sorts columns within tables, strips noise).
- Pipes through a SHA-256 hash function; emits both the listing and the hash.

Self-test: running the script twice against the same DB produces identical output (deterministic).

- [ ] **Step 7: Commit**

```
git add .gitignore migrations/instance/1000000000000-baseline.ts migrations/control-plane/1000000000000-baseline.ts docs/superpowers/plans/2026-05-15-baseline-schema-manifest.md tools/schema-manifest.ts
git commit -m "phase3-w2-pregate: capture baseline DDL + schema manifest"
```

Note: no `.sql` files are staged — the DDL is embedded inline in the migration `.ts` classes per Step 5. The `.dev/baseline/` scratch directory is now gitignored and untracked.

### Task 2: Structural seed migrations + bootstrap scripts

**Files:**
- Create: `migrations/instance/1000000000001-seed-system-roles.ts`
- Create: `migrations/instance/1000000000002-seed-system-collections.ts`
- Create: `migrations/instance/1000000000003-seed-admin-policies.ts`
- Create: `migrations/instance/1000000000004-seed-service-principals.ts`
- Create: `migrations/instance/1000000000005-seed-default-navigation.ts`
- Modify: `scripts/seed-admin-user.ts` (gut the permission-seeding logic — see Step 4)

Filenames use the same `1e12` sentinel prefixes as the baseline (`1000000000000-baseline.ts`). TypeORM's runtime sorts by the `name` property, which uses the same sentinel suffix as the filename + class name — all three coherent. Filename order also matches FK-dependency order: roles → system-collections → admin-policies (resolves collection UUIDs by code) → service-principals → default-navigation.

Pre-W2 does NOT create or invoke instance/control-plane key bootstrap scripts. Canon §29.9's `LocalEs256KeySigningService` auto-generates `.dev/keys/` on first `npm run dev:api` for the instance plane today; control-plane joins that pattern via Stream 1 PR3 (new `scripts/seed-control-plane-key-bootstrap.ts` and the control-plane `key_metadata` migration both ship in Stream 1).

- [ ] **Step 1: Extract structural seed SQL from current state**

For each seed (system_roles, admin_policies, service_principals, system_collections, default_navigation), query the migrated DB and capture the canonical INSERT statements via `pg_dump --data-only --table=<schema>.<table>`. Strip ephemeral data.

- [ ] **Step 2: Wrap each as a deterministic TypeORM MigrationInterface**

Pattern (for `seed-system-roles`):
```ts
export class SeedSystemRoles1000000000001 implements MigrationInterface {
  name = 'SeedSystemRoles1000000000001';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO identity.roles (id, code, name, description, is_system, is_active, is_default, scope, hierarchy_level, weight, metadata) VALUES
        ('936009c6-677a-4740-a202-ea00f3fa93c6', 'admin',         'Administrator',       'Bootstrap operator / platform administrator', true, true, false, 'global', 0, 0, '{}'),
        ('b9c54a3e-7d2f-4f8a-9c5e-8f1a2b3c4d5e', 'platform_user', 'Platform User',       'Baseline authenticated platform member',      true, true, true,  'global', 0, 0, '{}')
      ON CONFLICT (code) DO NOTHING;
    `);
  }
  public async down(): Promise<void> { throw new Error('Seed migration is forward-only'); }
}
```

**Role seed scope (locked at Pre-W2 rework, 2026-05-16):** Only two structural roles ship in this seed — `admin` and `platform_user`. Application personas (`auditor`, `manager`, `technician`, `viewer`) are NOT seeded here; they imply persona models that don't exist in the platform yet. `platform_user` (not `authenticated`) is the canonical name because it is an authorization role assignable to a `user_roles` row, not an auth-state label — `@AuthenticatedOnly()` already covers "logged-in identity is sufficient." Future bootstrap/test users can receive `platform_user`; Stream 2 grants registry-backed permissions to both roles via the TS-constant-driven sync.

**Permission seed scope (locked at Pre-W2 rework, 2026-05-16):** Pre-W2 seeds ZERO rows into `identity.platform_permissions` and ZERO rows into `identity.role_permissions`. Baseline creates the tables + FKs only. Per spec §2.3, the `PERMISSION_REGISTRY` TS constant in `libs/permission-registry` is the single source of truth, materialized into the DB by `scripts/seed-permission-registry-sync.ts` in Stream 2 PR3. No handwritten seed migration for these rows in Pre-W2. Admin authority during the Pre-W2 → Stream 2 window lives entirely in `CollectionAccessRule` + `PropertyAccessRule` (Step 2 of `seed-admin-policies`).

Same shape (deterministic `MigrationInterface` with `name` property matching the filename + class suffix; forward-only `down()`) for the other four seeds.

- [ ] **Step 3: Verify bootstrap scripts are env-dependent only**

`scripts/seed-admin-user.ts` reads `DEFAULT_ADMIN_PASSWORD`; this stays a script (not a migration). No other bootstrap scripts are added in Pre-W2 — the instance plane's `LocalEs256KeySigningService` per canon §29.9 auto-generates `.dev/keys/` on first run of `npm run dev:api`, so no explicit instance key bootstrap script is needed at this gate. (Stream 1 PR3 adds the control-plane analog script and the control-plane `key_metadata` migration as part of the HS256→ES256 migration.)

- [ ] **Step 4: Gut `seed-admin-user.ts` permission-seeding logic**

The pre-Pre-W2 script (a) embedded an inline `DEFAULT_PERMISSIONS` constant of ~50 dot-style codes (`users.view`, `metadata.collections.spreadsheet.write`, etc.) — the exact vocabulary the W2 registry contract retires — and (b) inserted those rows into `identity.permissions`, the UUID-keyed table the baseline drops. Post-baseline the script throws on the first INSERT.

Strip these blocks from the script:
- The entire `DEFAULT_PERMISSIONS` array (top-of-file constant).
- The `console.log('\n📋 Seeding permissions...')` loop (writes to `identity.permissions`).
- The `Assign all permissions to admin` loop (writes `permission_id` to `identity.role_permissions`).

The remaining script (admin role lookup + admin user upsert + admin role binding via `identity.user_roles`) is the only piece needed for fresh-install bootstrap. Permission registry materialization is Stream 2 PR3's job via `scripts/seed-permission-registry-sync.ts` reading the TS constant — keeping the dual code path here was the source of the W2 vocabulary drift in the first place.

- [ ] **Step 5: Confirm no demo/sample seed scripts exist**

Run:
```
git grep -l "demo\|sample" scripts/
```
Expected: no files in `scripts/` create non-structural seed data. (Pre-Pre-W2 verification on `2e71849` confirmed `scripts/` already had no demo scripts to delete; the per-PR check above stays in the plan as a guard for future demo-script accretion.)

- [ ] **Step 6: Commit**

```
git add migrations/instance/1000000000001-* migrations/instance/1000000000002-* migrations/instance/1000000000003-* migrations/instance/1000000000004-* migrations/instance/1000000000005-* scripts/seed-admin-user.ts
git commit -m "phase3-w2-pregate: structural seed migrations + gut seed-admin-user permission block"
```

### Task 3: Update migration-blocking-index scanner for baseline exception

**Files:**
- Modify: `tools/migration-blocking-index-check.ts`

- [ ] **Step 1: Read current scanner**

```
cat tools/migration-blocking-index-check.ts
```
Understand the current rule: blocks `CREATE INDEX` (non-CONCURRENTLY) on growth tables in any migration.

- [ ] **Step 2: Add same-migration-table-creation exception**

The exception: if a migration creates a table (`CREATE TABLE`) in its own DDL AND creates an index on that table in the same migration, the index need not be `CONCURRENTLY`. Reason: on an empty table just created, blocking index is correct (transactional, faster).

Implementation: parse each migration's SQL; build a set of tables created in this migration; allow blocking indexes only on those tables.

- [ ] **Step 3: Self-test the exception**

Add a test fixture: a migration that creates a table and a blocking index on it → scanner passes. A migration that creates a blocking index on a pre-existing growth table → scanner fails (existing rule).

- [ ] **Step 4: Run scanner on the new baseline**

```
npm run migrations:check
```
Expected: passes. Baseline has blocking indexes on tables it creates in the same migration; growth-table migrations elsewhere still require CONCURRENTLY.

- [ ] **Step 5: Commit**

```
git add tools/migration-blocking-index-check.ts tools/scanners/__tests__/migration-blocking-index-check.test.ts
git commit -m "phase3-w2-pregate: blocking-index scanner gains same-migration-table-creation exception"
```

### Task 4: Tag pre-W2 archive + delete old migration files

**Files:**
- Delete: `migrations/instance/{1xxxxxxxxxxxx-*}.ts` (all 98 incremental migrations)
- Delete: `migrations/control-plane/{1xxxxxxxxxxxx-*}.ts` (all 8 incremental migrations)

- [ ] **Step 1: Tag the current HEAD before deletion**

Run:
```
git tag -a pre-w2-migration-archive -m "Pre-W2 archaeology: 98 instance + 8 control-plane incremental migrations preserved here before squash to baseline."
git push origin pre-w2-migration-archive
```
Expected: tag pushed to origin.

- [ ] **Step 2: Compute the list of files to delete (PowerShell — single block, fail-safe)**

Steps 2 and 3 share `$keepPrefixes` and the computed file lists. Run as ONE block so the variables stay in scope; do not split this into two PowerShell sessions. If you must run Step 3 independently, re-declare `$keepPrefixes` and recompute the lists first — running Step 3 with `$keepPrefixes = $null` would treat the keep-filter as always-false and delete the baseline + seed migrations.

The Pre-W2 keep-list contains only baseline + deterministic seed migrations. Stream 1 migrations do not yet exist and will be added by Stream 1 PRs; they don't need to be in the Pre-W2 keep-list.

```
$keepPrefixes = @('1000000000000','1000000000001','1000000000002','1000000000003','1000000000004','1000000000005')

$instanceFilesToDelete = git ls-files migrations/instance/ | Where-Object {
  $name = Split-Path $_ -Leaf
  -not ($keepPrefixes | Where-Object { $name.StartsWith($_) })
}
$controlPlaneFilesToDelete = git ls-files migrations/control-plane/ | Where-Object {
  -not ((Split-Path $_ -Leaf).StartsWith('1000000000000'))
}

Write-Host "instance files to delete:"
$instanceFilesToDelete
Write-Host "control-plane files to delete:"
$controlPlaneFilesToDelete
```

Expected output lists ~98 instance files + ~8 control-plane files. Sanity-check that the baseline + 5 seed migrations are NOT in either list before proceeding to Step 3.

- [ ] **Step 3: Delete the listed files (uses the same variables from Step 2)**

```
$instanceFilesToDelete | ForEach-Object { git rm $_ }
$controlPlaneFilesToDelete | ForEach-Object { git rm $_ }
```

Run this in the same PowerShell session as Step 2. Confirm via `git status --short migrations/` before commit: only the ~106 files listed in Step 2 should appear as deletions, no baseline/seed files.

- [ ] **Step 4: Verify migration runner still works (fail-fast)**

Each command on its own line with explicit exit-status check; a semicolon-chained one-liner would let a mid-chain failure silently mask under a later command's success.

Pre-W2 does NOT invoke `seed-instance-key-bootstrap.ts` or `seed-control-plane-key-bootstrap.ts`. Those scripts and the control-plane `key_metadata` table are Stream 1 deliverables — they don't exist at the Pre-W2 gate. The instance plane's `LocalEs256KeySigningService` auto-generates `.dev/keys/` on first `npm run dev:api` per canon §29.9; control-plane still runs on HS256 (`JWT_SECRET`) until Stream 1 PR3 lands. Pre-W2 verifies migrations + admin seed only.

```
docker-compose down -v
if ($LASTEXITCODE -ne 0) { throw 'docker-compose down failed' }
docker-compose up -d postgres redis
if ($LASTEXITCODE -ne 0) { throw 'docker-compose up failed' }
Start-Sleep -Seconds 5
npm run setup:skip-docker      # ensures both DBs are created; idempotent
if ($LASTEXITCODE -ne 0) { throw 'setup:skip-docker failed' }
npm run migration:run:instance
if ($LASTEXITCODE -ne 0) { throw 'instance migration failed' }
npm run migration:run:control-plane
if ($LASTEXITCODE -ne 0) { throw 'control-plane migration failed' }
npx tsx scripts/seed-admin-user.ts
if ($LASTEXITCODE -ne 0) { throw 'seed-admin-user failed' }
```
Expected: all 5 commands succeed; baseline + structural seeds produce a fully-migrated DB ready for Stream 1 work to extend.

- [ ] **Step 5: Commit**

```
git add migrations/instance migrations/control-plane
git commit -m "phase3-w2-pregate: delete 98+8 incremental migrations (archived at pre-w2-migration-archive)"
```

Step 5 used to run `npm run prelude:validate` here, but that step is now Task 4.5 (TypeScript entity-model alignment): the baseline reshape (`identity.permissions` UUID-keyed → `identity.platform_permissions` code-keyed; `permission_id` UUID FK → `permission_code` text FK) requires matching changes in the entity layer, otherwise `nx serve api` boots but login throws 500 because TypeORM emits SQL against columns that no longer exist. The plan originally placed entity-model alignment in Stream 1 / Stream 2, but that left master broken in the foundation layer the wave is trying to make trustworthy. Founder direction (2026-05-16): fix the plan, not the standard.

### Task 4.5: TypeScript entity-model alignment with baseline

**Files:**
- Create: `libs/instance-db/src/lib/entities/platform-permission.entity.ts`
- Delete: `libs/instance-db/src/lib/entities/permission.entity.ts`
- Modify: `libs/instance-db/src/lib/entities/role-permission.entity.ts` (permissionId UUID → permissionCode text; composite PK; PlatformPermission relation)
- Modify: `libs/instance-db/src/lib/entities/identity.ts` (barrel export)
- Modify: `libs/instance-db/src/lib/entities/index.ts` (barrel + `instanceEntities` array)
- Delete: `apps/api/src/app/identity/roles/permission-seeder.service.ts` (W2 spec §2.3 — registry is materialized from the `PERMISSION_REGISTRY` TS constant in Stream 2 PR3, not from an in-app seeder; pre-Pre-W2 seeder wrote dot-style codes to the now-dropped `identity.permissions` table)
- Delete: `apps/api/src/app/identity/roles/permissions.controller.ts` (CRUD against the dropped table; replaced by Stream 2 PR3's registry-backed controller)
- Modify: `apps/api/src/app/identity/roles/roles.module.ts` (remove seeder DI binding + controller registration)
- Modify: `apps/api/src/app/identity/roles/role.service.ts` (`permissionId` → `permissionCode`; `Permission` type → `PlatformPermission`; `perm.id` → `perm.code`)
- Modify: `apps/api/src/app/identity/roles/permission-resolver.service.ts` (type updates only — `Map<string, Permission>` → `Map<string, PlatformPermission>`)
- Modify: `apps/api/src/app/identity/roles/index.ts` (remove deleted seeder re-export)

Scope discipline: **only** changes needed for compile + boot + admin seed + login/profile resolution to stop querying `identity.permissions` / `permission_id`. NO registry rows seeded (path ii from Task 2 holds). NO Stream 2 registry scanner / bootstrap / codegen work in this task — that lands when Stream 2 PR3 ships.

- [ ] **Step 1: Add `PlatformPermission` entity**

Create `platform-permission.entity.ts` mapping `identity.platform_permissions` exactly as the baseline DDL defines it (PK on `code`, NOT a UUID; `plane`/`domain`/`resource`/`action`/`dangerous`/`description` columns).

- [ ] **Step 2: Rewrite `RolePermission` entity**

Switch the FK from `permissionId` UUID (referencing the dropped `permissions.id`) to `permissionCode` text (referencing `platform_permissions.code`). The baseline uses a composite primary key on `(role_id, permission_code)` — drop the standalone UUID `id` column. Rename `createdAt`/`createdBy` → `grantedAt`/`grantedBy` to match the baseline column names.

- [ ] **Step 3: Delete `permission.entity.ts` + `PermissionSeederService` + `PermissionsController`**

The seeder ran in `RolesModule.onModuleInit` and pre-populated the now-dropped table with ~50 dot-style codes (the exact vocabulary W2 spec §2.1 retires). The controller exposed CRUD on the same table. Both are dead post-baseline; Stream 2 PR3 replaces them with the registry-backed equivalents.

- [ ] **Step 4: Translate `role.service.ts`**

Replace every `permissionId: perm.id` with `permissionCode: perm.code`, every `Repository<Permission>` with `Repository<PlatformPermission>`, every `Permission[]` return type with `PlatformPermission[]`. The methods (`setRolePermissions`, `addRolePermissions`, `removeRolePermissions`, `getRoleEffectivePermissions`) remain functionally equivalent against the new schema.

- [ ] **Step 5: Translate `permission-resolver.service.ts`**

Only type updates — the runtime logic is unchanged because `RolePermission.permission` (now a `PlatformPermission` ManyToOne via `permission_code`) exposes the same `.code` property the resolver already reads.

- [ ] **Step 6: Update barrels + roles module**

`identity.ts` and `index.ts` swap `Permission` for `PlatformPermission`. The `instanceEntities` array (TypeORM registration list) likewise. `roles.module.ts` removes the `PermissionSeederService` DI binding and the `PermissionsController` registration; the `onModuleInit` shrinks to just the cross-service publisher binding (no more seeding step).

- [ ] **Step 7: Build typecheck**

```
npx nx build instance-db
if ($LASTEXITCODE -ne 0) { throw 'instance-db build failed' }
npx nx build api
if ($LASTEXITCODE -ne 0) { throw 'api build failed' }
```

- [ ] **Step 8: Swap prelude-validate assertion 5 to `/api/auth/me`**

The pre-Pre-W2 assertion 5 was `GET /api/users returns 200 with admin token`. That endpoint is gated by `@RequirePermission('users.view')`. Path (ii) from Task 2 leaves `identity.platform_permissions` and `identity.role_permissions` empty until Stream 2 PR3 materializes the registry from `PERMISSION_REGISTRY`, so the admin has no `users.view` grant — every `@RequirePermission`-gated endpoint returns 403 by design during the Pre-W2 → Stream 2 PR3 window. Asserting 200 against that endpoint amounts to testing whether the gate works against a deliberately-empty registry, which is not what Pre-W2 promises.

Swap assertion 5 to `GET /api/auth/me returns 200 with admin token`. `/api/auth/me` uses `@AuthenticatedOnly() + JwtAuthGuard` — no `@RequirePermission`. The assertion tests the same trust chain (token issuance → JWT validation → admin identity resolution → request-context hydration) without depending on the registry being non-empty. The W2 spec admin-can-list-users assertion is the right shape for Stream 2 PR3's exit gate; re-add `GET /api/users 200` there once `PERMISSION_REGISTRY` has materialized.

Document the rationale inline (comment in `scripts/prelude-validate.ts` above the assertion) so the swap survives readers without git archaeology.

- [ ] **Step 9: Run prelude-validate end-to-end**

```
npm run prelude:validate
```
Expected: 11 assertions pass against the freshly-baselined DB — including the three login assertions that broke after Task 4 because of the entity-vs-baseline drift, and the swapped assertion 5 (`/api/auth/me` instead of `/api/users`). Task 5 adds 3 more for 14/14.

- [ ] **Step 10: Commit**

```
git add libs/instance-db/src/lib/entities/ apps/api/src/app/identity/roles/ scripts/prelude-validate.ts
git commit -m "phase3-w2-pregate: TypeScript entity-model alignment with baseline + prelude-validate assertion 5 swap"
```

### Task 5: Pre-W2 gate validation harness extension

**Files:**
- Modify: `scripts/prelude-validate.ts` — add baseline-specific assertions

- [ ] **Step 1: Add intentional-deltas assertion**

In `scripts/prelude-validate.ts`, add three new assertions:

Concrete shape (no extracted-helper API needed — query directly via the same dual-path docker / CI-fallback pattern the nav-seed assertion uses; a small `runDbScalar(query)` helper at the top of the file lets the three new assertions stay 5-line bodies):

```ts
assert('identity.platform_permissions table present', async () => {
  const v = runDbScalar("SELECT count(*) FROM information_schema.tables WHERE table_schema='identity' AND table_name='platform_permissions'");
  return v === '1' ? { ok: true } : { ok: false, detail: `expected count=1, got ${v}` };
});
assert('old identity.permissions table absent', async () => { /* count = 0 */ });
assert('metadata.collection_definitions.secure_fields_by_default default = true', async () => { /* column_default === 'true' */ });
```

- [ ] **Step 2: Fix the harness's `spawn` hang on Windows**

The pre-Pre-W2 harness spawned apps/api with `stdio: ['ignore', 'pipe', 'pipe']` + `shell: true`. nx serve emits volumes of output during cold compile; the OS pipe buffer fills (~4KB) and cmd.exe-wrapped pipes block the child on the next write because the JS-side `.on('data', …)` drain doesn't keep up. The result: `npm run prelude:validate` hangs reliably on Windows.

Switch to `stdio: 'ignore'`. Health is the primary readiness signal — and the only one, since there's no longer a startup-log buffer to scan. The pre-existing forbidden-pattern check (`UnhandledPromiseRejection`, `FATAL`, `unannotated endpoint passed through`) was already documented as "best-effort — buffer may be empty"; deleting it removes dead code per canon §1 + §14 rather than keeping a no-op with a "future PR will wire this" comment. The assertion description also tightens from `apps/api boots without ERROR/UnhandledPromiseRejection in startup log` to `apps/api boots and reports healthy within 180s` so the description matches the actual check.

- [ ] **Step 3: Run extended harness**

```
npm run prelude:validate
```
Expected: 14 assertions pass (11 from Prelude including the assertion 5 swap from Task 4.5 + 3 new baseline-state). End-to-end with full rebuild + spawn — no `--skip-rebuild`.

- [ ] **Step 4: Commit**

```
git add scripts/prelude-validate.ts
git commit -m "phase3-w2-pregate: prelude-validate baseline-reshape assertions + Windows spawn fix"
```

### Task 6: Open Pre-W2 Gate PR

**Files:** none (PR creation).

- [ ] **Step 1: Push to a feature branch + open PR**

```
git push origin HEAD:w2/pre-gate-baseline
gh pr create --title "phase3-w2-pre-gate: fresh-DB baseline squash" --body @'
## Summary
- Replaces 98 instance + 8 control-plane incremental migrations with one canonical baseline per plane
- Baseline reflects end-state for known W2 reshapes (platform_permissions code-keyed, permission_code FK, secureFieldsByDefault=true)
- Structural seed migrations + env-dependent bootstrap scripts kept; demo seeds deleted
- Migration-blocking-index scanner gains same-migration-table-creation exception
- Old migration files archived at `pre-w2-migration-archive` tag and deleted from tree

## Spec reference
docs/superpowers/specs/2026-05-15-phase3-w2-platform-integrity-design.md §Pre-W2 gate

## Validation
- `prelude-validate.ts` 14 assertions green (11 Prelude + 3 baseline)
- Fresh DB rebuild → baseline → seeds → bootstrap → boot → login all green
- All Prelude scanners remain green

## Required CI gates
- baseline DDL diff manifest committed
- prelude-validate.ts happy + negative paths green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
'@
```

Wait for review + merge. Pre-W2 Gate must land before any Stream 1 PR opens.

---

## Stream 1 — Principal & Session Integrity

**Goal:** Identity, session, and inter-process auth contract is uniform across both planes. JWT carries no roles/permissions. ResolvedIdentity supplies authority per request. Control-plane uses ES256.

**Stream exit gate:** All 6 PRs merged; four new scanners green (`no-hs256-signing-check`, `service-token-default-deny-check`, `no-untyped-req-check`, role-code immutability test); control-plane fresh-DB → boot → login validates ES256 JWT via JWKS; service-token scope enforcement proven; role permission change → cache invalidation within 1s; canon §29.6 + §29.7 amendments landed.

**Spec reference:** §"Stream 1 — Principal & Session Integrity".

**Stream 1 + Stream 4a may execute in parallel** (disjoint code paths). Master merges follow dependency order.

### Task 7: Stream 1 PR1 — Principal/context contract + JWT cleanup + consumer migration (fused)

**Files:**
- Modify: `libs/auth-guard/src/lib/request-context.ts` — add `roleIds`, `roleCodes`, `permissionCodes`, `groupIds`, `securityStamp`; delete `roles`; rename `permissions` → `permissionCodes`
- Modify: `libs/auth-guard/src/lib/identity-resolver.port.ts` — `ResolvedIdentity` shape matches new `UserRequestContext`
- Modify: `apps/api/src/app/identity/auth/identity-resolver.adapter.ts` — populate new fields from DB
- Modify: `libs/authorization/src/lib/authorization.service.ts:1369` — `toAbacPrincipal` asserts `ctx.roleIds`, removes `ctx.roles` fallback
- Modify: `libs/auth-guard/src/lib/jwt.guard.ts` — remove any JWT-embedded-roles fallback; fail-closed on missing `IdentityResolverPort`
- Modify: `apps/api/src/app/identity/auth/jwt.strategy.ts` — JWT claims to encode (no roles/permissions)
- Modify: ~30 controllers + ~10 services consuming `ctx.roles` or `ctx.permissions` — migrate to `ctx.roleIds` / `ctx.roleCodes` / `ctx.permissionCodes`
- Modify: test fixtures across `apps/api/**/*.spec.ts` and `libs/authorization/**/*.spec.ts` — use `IdentityResolverAdapter`-shaped fixtures, not raw `attributes.roleIds` injection

- [ ] **Step 1: Inventory consumers of `ctx.roles` and `ctx.permissions`**

Run `git grep -n "ctx\.roles\|ctx\.permissions\|context\.roles\|context\.permissions" -- apps/ libs/` and capture the list (~40-60 hits across controllers, services, guards, tests).

- [ ] **Step 2: Update `UserRequestContext` type definition**

Edit `libs/auth-guard/src/lib/request-context.ts` so `UserRequestContext` carries `kind: 'user'`, `userId`, `roleIds: string[]` (UUIDs for ACL match), `roleCodes: string[]` (stable codes for @Roles + audit), `permissionCodes: string[]` (resolved platform capabilities), `groupIds: string[]`, `securityStamp: string`, optional `groupCache`. Delete the old `roles` and `permissions` fields. Same shape for `ResolvedIdentity` in `identity-resolver.port.ts`.

- [ ] **Step 3: Update IdentityResolverAdapter to populate new fields**

Edit `apps/api/src/app/identity/auth/identity-resolver.adapter.ts`: query `roles` table for user's role assignments to collect both IDs and codes; query `role_permissions` join for distinct `permission_code` values; query `groups` for memberships; populate `securityStamp` from `users.security_stamp`. Return `ResolvedIdentity` with all six fields. Cache the result in Redis keyed by `userId`.

- [ ] **Step 4: Update JWT claim contract**

Edit `apps/api/src/app/identity/auth/token-issuer.service.ts` (or wherever JWTs are signed). JWT payload includes: `sub`, `session_id`, `jti`, `token_version` (security_stamp), `iss`, `aud`, `iat`, `exp`, `kid`, `instance_id` (instance plane only; omitted on control-plane). NO `roles`, `permissions`, `role_codes`, or `permission_codes` claims. For control-plane (after Stream 1 PR3 lands ES256), use `iss = hubblewave-control-plane`, `aud = hubblewave-control-plane`, no `instance_id` claim.

- [ ] **Step 5: Update JwtAuthGuard to fail-closed on missing resolver**

Edit `libs/auth-guard/src/lib/jwt.guard.ts`. In the constructor (or `OnModuleInit`), assert the `IDENTITY_RESOLVER_PORT` binding exists; throw at module init if missing. No runtime fallback. Remove any JWT-embedded-roles fallback path.

- [ ] **Step 6: Update AuthorizationService.toAbacPrincipal**

Edit `libs/authorization/src/lib/authorization.service.ts` around line 1369. Remove the `ctx.roles`-as-UUIDs fallback branch. Assert `ctx.roleIds` is populated (throw `InternalServerErrorException` if empty AND user is not anonymous). All ACL rule matching: `ctx.roleIds[]` against `rule.roleId`, `ctx.groupIds[]` against `rule.groupId`, `ctx.userId` against `rule.userId`. UUID-only.

- [ ] **Step 7: Migrate consumer call sites**

For each file in the Step 1 inventory, rewrite: `ctx.roles` → `ctx.roleCodes` (display/audit context) OR `ctx.roleIds` (ACL match context) — domain-judge per call site. `ctx.permissions` → `ctx.permissionCodes`. For test fixtures, replace direct `attributes.roleIds` injection with a fixture builder that goes through a mock `IdentityResolverAdapter` populating both `roleIds` + `roleCodes` together.

- [ ] **Step 8: Run lib + app builds**

Run each on its own line (PowerShell 5.1 has no `&&`):
```
npx nx build authorization
if ($LASTEXITCODE -ne 0) { throw 'authorization build failed' }
npx nx build auth-guard
if ($LASTEXITCODE -ne 0) { throw 'auth-guard build failed' }
npx nx build api
if ($LASTEXITCODE -ne 0) { throw 'api build failed' }
npx nx build control-plane
if ($LASTEXITCODE -ne 0) { throw 'control-plane build failed' }
```
Expected: all four green.

- [ ] **Step 9: Run lib + app tests**

Run each on its own line:
```
npx nx test authorization
if ($LASTEXITCODE -ne 0) { throw 'authorization tests failed' }
npx nx test auth-guard
if ($LASTEXITCODE -ne 0) { throw 'auth-guard tests failed' }
npx nx test api
if ($LASTEXITCODE -ne 0) { throw 'api tests failed' }
```
Expected: all green (~115 authorization tests, ~50 auth-guard tests, ~600 api tests).

- [ ] **Step 10: Commit + PR**

```
git add libs/auth-guard/ libs/authorization/ apps/api/src/app/identity/ apps/api/
git commit -m "phase3-w2-stream1: principal/context contract + JWT cleanup + consumer migration"
git push origin HEAD:w2/stream1-principal-contract
gh pr create --title "phase3-w2-stream1: principal/context contract + JWT cleanup" --body "Closes part of Stream 1. Replaces UserRequestContext.roles/permissions with roleIds/roleCodes/permissionCodes/groupIds/securityStamp. JWT carries no roles/permissions; IdentityResolverAdapter supplies live authority per request. Spec §Stream 1 §1.1-1.2."
```

### Task 8: Stream 1 PR2 — IdentityResolverAdapter + cache invalidation wiring (F025)

**Files:**
- Modify: `libs/instance-db/src/lib/subscribers/identity-cache-invalidation.subscriber.ts` — extend to observe Role, RolePermission, CollectionAccessRule, PropertyAccessRule
- Modify: `apps/api/src/app/identity/auth/identity-resolver.adapter.ts` — subscribe to invalidation channel; evict Redis cache entries
- Modify: `apps/api/src/app/identity/services/permission-resolver.service.ts` — subscribe + evict (identity domain)
- Modify: `libs/authorization/src/lib/authorization.service.ts` — subscribe + evict ACL rule cache
- Create: `apps/api/test/integration/permission-cache-invalidation.spec.ts`

- [ ] **Step 1: Read existing subscriber + identify the F025 hook**

Inspect `libs/instance-db/src/lib/subscribers/identity-cache-invalidation.subscriber.ts`. Confirm it already observes some user-level mutations.

- [ ] **Step 2: Add observers for Role, RolePermission, CollectionAccessRule, PropertyAccessRule**

In the subscriber, add `afterInsert`, `afterUpdate`, `afterRemove` hooks for each entity. On `afterTransactionCommit`, publish to Redis channel `hw:permission-invalidate` with payload describing `{ userId?, roleId?, scope: identity | permissions | acl }`. The publication is AFTER commit, not mid-transaction (closes F043 pre-commit publish bug).

- [ ] **Step 3: Wire IdentityResolverAdapter to subscribe**

In `apps/api/src/app/identity/auth/identity-resolver.adapter.ts`, on module init subscribe to Redis channel `hw:permission-invalidate`. On message: evict the affected user's cache entry (or invalidate all entries if scope=acl since ACL changes can affect any user).

- [ ] **Step 4: Wire PermissionResolverService**

Same pattern — subscribe + evict. PermissionResolverService lives in identity domain (per spec correction, NOT in libs/authorization).

- [ ] **Step 5: Wire AuthorizationService ACL rule cache**

Same pattern — subscribe + evict. The cache lives in libs/authorization.

- [ ] **Step 6: Integration test — role permission change propagates in ≤1s**

Create `apps/api/test/integration/permission-cache-invalidation.spec.ts`. Test: seed a user with the admin role; resolve identity (cache populated); delete a RolePermission row; wait up to 1s; resolve identity again; assert the affected permissionCode is absent.

- [ ] **Step 7: Run integration test**

Run `npx nx test api --testPathPattern=permission-cache-invalidation`. Expected: green within 1s.

- [ ] **Step 8: Commit + PR**

```
git add libs/instance-db/src/lib/subscribers/ apps/api/src/app/identity/ libs/authorization/ apps/api/test/integration/
git commit -m "phase3-w2-stream1: F025 cache invalidation across identity + resolver + ACL caches"
gh pr create --title "phase3-w2-stream1: F025 cache invalidation" --body "Extends libs/instance-db subscribers to evict identity Redis cache + PermissionResolverService cache + AuthorizationService rule caches on RolePermission/CollectionAccessRule/PropertyAccessRule commits. afterTransactionCommit hook to avoid F043 pre-commit publish. Integration test asserts <=1s propagation."
```

### Task 9: Stream 1 PR3 — Control-plane ES256/JWKS migration

**Files:**
- Modify: `apps/control-plane/src/app/auth/auth.module.ts` — remove `JwtModule.registerAsync({ secret })`
- Rewrite: `apps/control-plane/src/app/auth/jwt.strategy.ts` — ES256 verification via JWKS
- Create: `apps/control-plane/src/app/auth/control-plane-key-signing.module.ts`
- Create: `apps/control-plane/src/app/auth/jwks.controller.ts`
- Create: `migrations/control-plane/0000000000010-add-key-metadata.ts`
- Create: `scripts/seed-control-plane-key-bootstrap.ts`
- Modify: erroneous `schema: 'identity'` on a refresh-token entity (verify which lib carries it)
- Delete: `JWT_SECRET` references in `scripts/setup.ts`, `.env.example`, `apps/control-plane/**`

- [ ] **Step 1: Add control-plane key_metadata table migration**

Create `migrations/control-plane/0000000000010-add-key-metadata.ts`. DDL creates table `key_metadata(kid text PK, provider, kms_alias, kms_arn, algorithm DEFAULT 'ES256', state CHECK pending|active|retiring|retired|compromised, created_at, activated_at, retiring_at, retired_at, compromised_at, public_jwk jsonb)` with index on state. Note: control-plane uses `public` schema per spec; no `control_plane.` prefix.

- [ ] **Step 2: Create ControlPlaneKeySigningModule**

Create `apps/control-plane/src/app/auth/control-plane-key-signing.module.ts`. Factory provider for `KEY_SIGNING_SERVICE`: if `NODE_ENV === 'production'` and `JWT_KEY_PROVIDER !== 'aws-kms'`, throw at module init. Otherwise instantiate `AwsKmsEs256KeySigningService` (prod) or `LocalEs256KeySigningService` (dev). KMS alias defaults to `alias/hubblewave/control-plane/jwt-signing`. Local provider reads/writes `.dev/keys/control-plane/`.

- [ ] **Step 3: Rewrite JwtStrategy to ES256 + JWKS**

Edit `apps/control-plane/src/app/auth/jwt.strategy.ts`. Use `passport-jwt` with `algorithms: ['ES256']`, `issuer: 'hubblewave-control-plane'`, `audience: 'hubblewave-control-plane'`. Use `secretOrKeyProvider` callback that decodes the kid from the token header, looks up the public JWK via `KeySigningService.getPublicJwk(kid)`, converts JWK to PEM, and passes to passport-jwt. The `validate()` body still checks `RevokedToken` table.

- [ ] **Step 4: Add JWKS endpoint**

Create `apps/control-plane/src/app/auth/jwks.controller.ts`. `@Controller('.well-known/jwks.json')` with `@Get()` returning `{ keys: <list of public JWKs in active + retiring state> }`. Decorate with `@Public()`.

- [ ] **Step 5: Update auth.module.ts**

Edit `apps/control-plane/src/app/auth/auth.module.ts`. DELETE the `JwtModule.registerAsync({ secret })` block. Import `ControlPlaneKeySigningModule`. Add `JwksController` to controllers list.

- [ ] **Step 6: Bootstrap script for control-plane keys**

Create `scripts/seed-control-plane-key-bootstrap.ts`. Reads/writes `.dev/keys/control-plane/`: if no keypair exists, generates an ES256 keypair, persists to `0600`-permissioned files, inserts a `key_metadata` row with `state='active'`. Idempotent on subsequent runs. Production path fails fast: keys must be provisioned via IaC.

- [ ] **Step 7: Fix refresh-token.entity.ts schema bug**

The buggy entity is `libs/control-plane-db/src/lib/entities/refresh-token.entity.ts`. (Investigation confirmed: `libs/control-plane-db/src/lib/entities/` contains the refresh-token entity used by control-plane; `libs/instance-db` has its own separate refresh-token entity used by the instance plane where `schema: 'identity'` IS correct.) Remove the `schema: 'identity'` declaration from the control-plane entity's `@Entity()` decorator (either delete the schema field, or replace with `schema: 'public'` to be explicit). Verify with `git grep -n "schema:" libs/control-plane-db/src/lib/entities/` after the edit — control-plane entities should have no `schema:` declarations (or only `schema: 'public'`).

- [ ] **Step 8: Delete JWT_SECRET references**

For each file matched by `git grep -nl "JWT_SECRET" apps/control-plane/ scripts/setup.ts .env.example`: delete the env var declaration, any `process.env.JWT_SECRET` read, any related documentation. Replace `.env.example` `JWT_SECRET=...` with `JWT_KEY_PROVIDER=local-es256`.

- [ ] **Step 9: Run control-plane fresh boot + login**

`npm run dev:control-plane` blocks until killed, so split this verification across two PowerShell terminals (or use `Start-Process` to background the API).

**Terminal A — bring up DB + run migrations + seeds + start the API (blocks):**
```
docker-compose down -v
if ($LASTEXITCODE -ne 0) { throw 'docker-compose down failed' }
docker-compose up -d postgres redis
if ($LASTEXITCODE -ne 0) { throw 'docker-compose up failed' }
Start-Sleep -Seconds 5
npm run migration:run:control-plane
if ($LASTEXITCODE -ne 0) { throw 'control-plane migration failed' }
npx tsx scripts/seed-admin-user.ts
if ($LASTEXITCODE -ne 0) { throw 'seed-admin-user failed' }
npx tsx scripts/seed-control-plane-key-bootstrap.ts
if ($LASTEXITCODE -ne 0) { throw 'control-plane key bootstrap failed' }
npm run dev:control-plane   # blocks; the API listens on http://localhost:3001
```

**Terminal B — once Terminal A reports "apps/control-plane listening", run the login + JWKS checks:**
```
$body = @{ email = 'admin@hubblewave.dev'; password = $env:DEFAULT_ADMIN_PASSWORD } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/login' -Method Post -Body $body -ContentType 'application/json'
$resp.accessToken    # decode any JWT decoder; verify header alg = ES256 and kid = hwk_*
Invoke-RestMethod -Uri 'http://localhost:3001/.well-known/jwks.json'
```

Expected (Terminal B): login response carries a valid `accessToken`; decoded header shows `alg: ES256` and `kid: hwk_*`. JWKS endpoint returns a `keys` array containing one entry whose `kid` matches the token's.

**Alternative (single terminal):** use `Start-Process` to background the API:
```
$api = Start-Process -FilePath 'npm' -ArgumentList 'run','dev:control-plane' -NoNewWindow -PassThru
Start-Sleep -Seconds 10
# ... login + JWKS checks here ...
Stop-Process -Id $api.Id
```

- [ ] **Step 10: Commit + PR**

```
git add apps/control-plane/ migrations/control-plane/ scripts/ libs/instance-db/src/lib/entities/ .env.example
git commit -m "phase3-w2-stream1: control-plane HS256 to ES256 + JWKS"
gh pr create --title "phase3-w2-stream1: control-plane ES256/JWKS migration" --body "Removes HS256/JWT_SECRET from control-plane. Adds key_metadata table (public schema), ControlPlaneKeySigningModule wiring AwsKmsEs256/LocalEs256 providers per JWT_KEY_PROVIDER. JWKS endpoint at /.well-known/jwks.json. Fixes erroneous schema:'identity' declaration if present. Production startup fails fast if KMS alias not resolvable."
```

### Task 10: Stream 1 PR4 — @RequireServiceScope enforcement + 2 scanners + canon §29.7

**Files:**
- Create: `libs/auth-guard/src/lib/decorators/require-service-scope.decorator.ts`
- Modify: `libs/auth-guard/src/lib/jwt.guard.ts` — enforce `@AllowServiceToken` + `@RequireServiceScope` pair
- Create: `tools/scanners/service-token-default-deny-check.ts`
- Create: `tools/scanners/no-hs256-signing-check.ts`
- Create: `tools/scanners/no-hs256-allowlist.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json` — scripts for new scanners
- Update: `CLAUDE.md` §29.7 — service scopes use platform capability codes

- [ ] **Step 1: Create the decorator**

Create `libs/auth-guard/src/lib/decorators/require-service-scope.decorator.ts` exporting `REQUIRE_SERVICE_SCOPE_KEY = 'requireServiceScope'` and `RequireServiceScope(code: string)` decorator that calls `SetMetadata(REQUIRE_SERVICE_SCOPE_KEY, code)`.

- [ ] **Step 2: Enforce in JwtAuthGuard**

In `libs/auth-guard/src/lib/jwt.guard.ts`, after JWT validation: if the token sub starts with `service:`, then (a) check the handler/class has `@AllowServiceToken` — if not, throw `UnauthorizedException('Service tokens not accepted on this endpoint')` returning 401; (b) check the handler/class has `@RequireServiceScope(code)` — if not, throw `InternalServerErrorException` (programmer error); (c) check `payload.scope?.includes(code)` — if not, throw `ForbiddenException` with the minimal `{ statusCode: 403, message: 'Permission denied', code: 'PERMISSION_DENIED' }` shape.

- [ ] **Step 3: Create service-token-default-deny scanner**

Create `tools/scanners/service-token-default-deny-check.ts`. Walk all `@Controller` classes; for each `@AllowServiceToken()` annotation, verify a matching `@RequireServiceScope(code)` exists at the same handler or class level. Fail otherwise. Self-test: a fixture controller with `@AllowServiceToken` but no `@RequireServiceScope` triggers a scanner fail.

- [ ] **Step 4: Create no-hs256 scanner**

Create `tools/scanners/no-hs256-signing-check.ts`. Greps `apps/api/`, `apps/control-plane/`, `libs/` for patterns: `JWT_SECRET`, `from 'jsonwebtoken'`, `secretOrKey:`, `algorithm: 'HS256'`, `JwtModule.register(`. Fail on any match outside the test-fixture allowlist. Allowlist file: `tools/scanners/no-hs256-allowlist.json` with `{ path, rationale, addedBy, addedAt }` schema.

- [ ] **Step 5: Wire scanners as CI gates**

Edit `.github/workflows/ci.yml` adding two jobs invoking `npm run service-token:check` and `npm run no-hs256:check`. Add corresponding `package.json` scripts.

- [ ] **Step 6: Canon §29.7 amendment**

Edit `CLAUDE.md` §29.7. Replace the `<collection>:<action>` shape description with platform capability codes from `PERMISSION_REGISTRY`. Update the seed manifest example: `svc-worker → svc-api` row `allowed_scopes` shifts from collection-action shape to platform capability codes (the actual values get filled in coordination with Stream 2 PR3 once the registry is populated; for this PR, document the contract change).

- [ ] **Step 7: Update existing service_principals.allowed_scopes**

Query control-plane DB for current `service_principals` rows; if any use collection-action shape, write a migration to rewrite them to platform capability codes. (Currently only `svc-worker → svc-api` seeded.) If Stream 2 PR1 has landed, registry codes are available; otherwise document the follow-up in this PR and close it in Stream 2 PR3.

- [ ] **Step 8: Commit + PR**

```
git add libs/auth-guard/ tools/scanners/service-token-default-deny-check.ts tools/scanners/no-hs256-signing-check.ts tools/scanners/no-hs256-allowlist.json .github/workflows/ci.yml package.json CLAUDE.md
git commit -m "phase3-w2-stream1: @RequireServiceScope + service-token + no-HS256 scanners + canon §29.7"
gh pr create --title "phase3-w2-stream1: @RequireServiceScope enforcement + 2 scanners + canon §29.7" --body "Adds @RequireServiceScope(code) decorator. JwtAuthGuard rejects service tokens without @AllowServiceToken (401) and without @RequireServiceScope claim (403). Two new scanners wired as required CI gates. Canon §29.7 amended: service scopes use platform capability codes from PERMISSION_REGISTRY."
```

### Task 11: Stream 1 PR5 — Session lifecycle verification tests + Role.code immutability

**Files:**
- Create: `apps/api/test/integration/session-lifecycle.spec.ts`
- Create: `apps/control-plane/test/integration/session-lifecycle.spec.ts`
- Create: `migrations/instance/0000000000020-role-code-immutable-trigger.ts`
- Modify: `libs/instance-db/src/lib/entities/role.entity.ts` — add `update: false` on `code` column

- [ ] **Step 1: F001 reuse-detection integration test (instance plane)**

In `apps/api/test/integration/session-lifecycle.spec.ts`: issue token pair, rotate once, then present the OLD refresh token. Assertions: response status 401; response body message is the bland `'Your session has expired. Please sign in again.'`; the entire token family is revoked with `revoked_reason = 'reuse_detected'`; a security event row is written via `AccessAuditPort.logSecurityEvent`.

- [ ] **Step 2: Same test on control-plane plane**

Mirror against `apps/control-plane/test/integration/session-lifecycle.spec.ts`. Control-plane uses its own RefreshToken table; assert equivalent family-revocation behavior.

- [ ] **Step 3: F002 revocation test**

In the same instance-plane spec file: issue an access token; add its jti to `JwtRevocationPort`; immediately request a protected endpoint; expect 401.

- [ ] **Step 4: F013 stale-authority via cache test**

Seed a user with the editor role (which has metadata:schema:manage). Issue an access token. First call to a metadata-schema-manage endpoint succeeds. Delete the role-permission row. Wait up to 1s for cache invalidation. Same JWT, next call to the same endpoint returns 403 (NOT a 401 — token is still valid; authority changed).

- [ ] **Step 5: Role.code immutability migration**

Create `migrations/instance/0000000000020-role-code-immutable-trigger.ts`. DDL: `CREATE FUNCTION identity.role_code_immutable() RETURNS TRIGGER AS ... IF OLD.code IS DISTINCT FROM NEW.code THEN RAISE EXCEPTION 'role code immutable'; END IF; ...` plus `CREATE TRIGGER tg_role_code_immutable BEFORE UPDATE OF code ON identity.roles FOR EACH ROW EXECUTE FUNCTION identity.role_code_immutable();`. Down migration drops both.

- [ ] **Step 6: Entity-level defense**

Edit `libs/instance-db/src/lib/entities/role.entity.ts`: add `update: false` to the `code` column decorator.

- [ ] **Step 7: Trigger test**

In the spec file: load an existing role, attempt a raw SQL UPDATE of its code. Expect a thrown error matching `/role code immutable/`.

- [ ] **Step 8: Run all tests**

```
npx nx test api --testPathPattern=session-lifecycle
npx nx test control-plane --testPathPattern=session-lifecycle
```
Expected: all green.

- [ ] **Step 9: Commit + PR**

```
git add apps/api/test/ apps/control-plane/test/ migrations/instance/0000000000020-* libs/instance-db/src/lib/entities/role.entity.ts
git commit -m "phase3-w2-stream1: session lifecycle tests (F001/F002/F013) + Role.code immutability trigger"
gh pr create --title "phase3-w2-stream1: session lifecycle verification + Role.code immutability" --body "Closes F001/F002/F013 verification gap. Adds DB trigger enforcing Role.code immutability post-creation. Entity-level update:false as defense-in-depth."
```

### Task 12: Stream 1 PR6 — RequestContext narrowing scanner + canon §29.6

**Files:**
- Create: `tools/scanners/no-untyped-req-check.ts`
- Create: `tools/scanners/no-untyped-req-allowlist.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Update: `CLAUDE.md` §29.6 — restate role changes do NOT bump security_stamp

- [ ] **Step 1: Create the scanner**

Create `tools/scanners/no-untyped-req-check.ts`. Uses `ts-morph` (or raw TS compiler API). Walks `@Controller` classes; for each method, find the parameter decorated with `@Req()` or `@Request()`. Fail if the parameter type is `any`, raw `Request` from Express, or omits a `RequestContext` discriminated union type. Self-test fixtures: bad fixture using `@Req() req: any` triggers fail; good fixture using `@Req() req: TypedRequest` passes.

- [ ] **Step 2: Run scanner on apps/api + apps/control-plane**

Run `npm run no-untyped-req:check`. List handlers that need fixing or allowlisting.

- [ ] **Step 3: Fix or document each handler**

Most handlers should already use typed `InstanceRequest` or similar. The scanner catches future drift. If existing violations surface, fix them in this PR (small set expected).

- [ ] **Step 4: Wire as CI gate**

Add `no-untyped-req:check` job to `.github/workflows/ci.yml` and corresponding `package.json` script.

- [ ] **Step 5: Canon §29.6 amendment**

Edit `CLAUDE.md` §29.6: add an explicit paragraph stating role-grant changes (gain or loss) do NOT bump `security_stamp`. Cache invalidation propagates the change; sessions persist. The 8-event bump list remains unchanged.

- [ ] **Step 6: Commit + PR**

```
git add tools/scanners/no-untyped-req-check.ts tools/scanners/no-untyped-req-allowlist.json .github/workflows/ci.yml package.json CLAUDE.md
git commit -m "phase3-w2-stream1: no-untyped-req scanner + canon §29.6 clarification"
gh pr create --title "phase3-w2-stream1: no-untyped-req scanner + canon §29.6" --body "Catches controller drift to @Req() req: any. Required CI gate. Canon §29.6 explicitly restates role changes do NOT bump security_stamp."
```

### Stream 1 exit gate

After all 6 PRs (Tasks 7-12) merged:
- [ ] All four new scanners green in CI: `no-hs256-signing-check`, `service-token-default-deny-check`, `no-untyped-req-check`, Role.code immutability test.
- [ ] Control-plane fresh-DB → boot → login validates ES256 JWT via JWKS; rejects HS256 tokens.
- [ ] Service-token scope enforcement integration test green: opt-in with scope → 200; missing scope → 403; non-opt-in → 401.
- [ ] Role permission change → ≤1s cache propagation across identity / resolver / ACL caches.
- [ ] Canon §29.6 + §29.7 amendments landed.

Per Phase 3 cross-wave Learning-Revises-Plan: if Stream 1 reveals downstream stream assumptions need revision, update this plan + the spec before Stream 2 starts.

---

## Stream 2 — Authorization Model & Permission Registry

**Goal:** §28 contract is exactly what the platform executes. Cross-cutting platform capabilities governed by typed registry with CI-enforced sync. Four primary boundary decorators (`@RequirePermission`, `@RequireCollectionAccess`, `@AuthenticatedOnly`, `@Public`).

**Stream exit gate:** `permission-registry-sync-check` green; all `@RequirePermission` sites use registered codes; `secureFieldsByDefault=true` confirmed; `search-query.service.ts` admin short-circuit deleted; `/authorization/explain` returns valid provenance; canon §28.6 amendment landed.

**Spec reference:** §"Stream 2 — Authorization Model & Permission Registry".

**Stream 2 depends on Stream 1's principal contract** (`ctx.permissionCodes`, `ctx.roleIds`). Master merges follow dependency order.

### Task 13: Stream 2 PR1 — Permission registry library + scanner (reporting-only)

**Files:**
- Create: `libs/permission-registry/src/lib/registry.ts` — `PERMISSION_REGISTRY` const, types
- Create: `libs/permission-registry/src/lib/index.ts` — public API
- Create: `libs/permission-registry/project.json` — Nx project config
- Create: `libs/permission-registry/tsconfig*.json`
- Create: `tools/scanners/permission-registry-sync-check.ts`
- Create: `tools/scanners/permission-registry-sync-allowlist.json`
- Modify: `tsconfig.base.json` — path mapping `@hubblewave/permission-registry`
- Modify: `.github/workflows/ci.yml` — reporting-only job
- Modify: `package.json`

- [ ] **Step 1: Generate Nx lib scaffolding**

Run `npx nx generate @nx/js:library permission-registry --directory=libs/permission-registry`. Accept defaults. Verify `tsconfig.base.json` gets a `@hubblewave/permission-registry` path mapping.

- [ ] **Step 2: Define types + initial registry**

Edit `libs/permission-registry/src/lib/registry.ts`:
```ts
export type PermissionPlane = 'instance' | 'control-plane';
export type PermissionAction =
  | 'read' | 'manage' | 'export' | 'configure'
  | 'admin' | 'invoke' | 'approve';

export interface PlatformPermission {
  readonly code: string;
  readonly plane: PermissionPlane;
  readonly domain: string;
  readonly resource?: string;
  readonly action: PermissionAction;
  readonly dangerous: boolean;
  readonly description: string;
}

export const PERMISSION_REGISTRY: ReadonlyArray<PlatformPermission> = [
  // Initial seed entries — expanded during the Stream 3 sweep.
  // Examples covering known capability families:
  { code: 'audit:read', plane: 'instance', domain: 'audit', action: 'read', dangerous: false, description: 'Read audit log entries.' },
  { code: 'audit:export', plane: 'instance', domain: 'audit', action: 'export', dangerous: true, description: 'Export audit log entries to external systems.' },
  { code: 'identity:user:manage', plane: 'instance', domain: 'identity', resource: 'user', action: 'manage', dangerous: true, description: 'Create, update, and delete platform users.' },
  { code: 'identity:role:manage', plane: 'instance', domain: 'identity', resource: 'role', action: 'manage', dangerous: true, description: 'Create, update, and delete platform roles.' },
  { code: 'metadata:schema:manage', plane: 'instance', domain: 'metadata', resource: 'schema', action: 'manage', dangerous: true, description: 'Create and modify collection schemas.' },
  { code: 'automation:invoke', plane: 'instance', domain: 'automation', action: 'invoke', dangerous: false, description: 'Invoke automation rules and workflows.' },
  { code: 'system:admin', plane: 'instance', domain: 'system', action: 'admin', dangerous: true, description: 'Platform-wide administrative capability.' },
  { code: 'authorization:explain:read', plane: 'instance', domain: 'authorization', resource: 'explain', action: 'read', dangerous: true, description: 'Read authorization decisions for arbitrary users — exposes ACL reasoning.' },
  { code: 'data:record:read', plane: 'instance', domain: 'data', resource: 'record', action: 'read', dangerous: false, description: 'Read records from collections (per-collection access via §28 ACL).' },
  { code: 'data:record:manage', plane: 'instance', domain: 'data', resource: 'record', action: 'manage', dangerous: false, description: 'Create, update, delete records (per-collection access via §28 ACL).' },
];
```

- [ ] **Step 3: Export public API**

Edit `libs/permission-registry/src/lib/index.ts`:
```ts
export { PERMISSION_REGISTRY, type PermissionPlane, type PermissionAction, type PlatformPermission } from './registry';
export const PERMISSION_CODE_REGEX = /^[a-z][a-z_]*(:[a-z_]+){1,2}$/;
export function isRegistered(code: string): boolean {
  return PERMISSION_REGISTRY.some(p => p.code === code);
}
```

- [ ] **Step 4: Self-test the registry shape**

Add `libs/permission-registry/src/lib/registry.spec.ts`. Assertions: every code matches `PERMISSION_CODE_REGEX`; every action is in the `PermissionAction` enum; no duplicate codes; `dangerous: true` entries include the word "dangerous", "admin", "delete", "manage", "export", or "configure" in description (informal sanity check).

- [ ] **Step 5: Create the scanner**

Create `tools/scanners/permission-registry-sync-check.ts`. Greps `apps/api/**`, `apps/control-plane/**`, `apps/web-client/**`, `apps/web-control-plane/**` for: `@RequirePermission('...')`, `@RequireServiceScope('...')`, `<RequirePermission permission="..." />`. Validates each extracted code is in `PERMISSION_REGISTRY`. Validates every registry entry has ≥1 source reference. In Stream 2 PR1, mode is **reporting-only** — outputs a list of mismatches but exits 0.

- [ ] **Step 6: Wire reporting-only CI job**

Add `package.json` script `permission-registry:check` and a non-blocking CI job that runs it.

- [ ] **Step 7: Run scanner**

```
npm run permission-registry:check
```
Expected: lists mismatches between current 213 `@RequirePermission` sites and the (small) initial registry. The list informs the Stream 3 sweep + Stream 2 PR3 registry population.

- [ ] **Step 8: Commit + PR**

```
git add libs/permission-registry/ tools/scanners/permission-registry-sync-check.ts tools/scanners/permission-registry-sync-allowlist.json tsconfig.base.json .github/workflows/ci.yml package.json
git commit -m "phase3-w2-stream2: permission registry library + scanner (reporting-only)"
gh pr create --title "phase3-w2-stream2: permission registry library + scanner reporting-only" --body "Establishes the canonical PERMISSION_REGISTRY contract per spec §2.1. Scanner outputs mismatches but does not yet fail CI (Stream 2 PR3 flips to hard gate after the sweep). Initial registry seeds known capability families; long-tail capabilities added during Stream 3 sweep."
```

### Task 14: Stream 2 PR2 — @RequireCollectionAccess + CollectionAccessGuard

**Files:**
- Create: `libs/auth-guard/src/lib/decorators/require-collection-access.decorator.ts`
- Create: `libs/auth-guard/src/lib/collection-access.guard.ts`
- Create: `libs/auth-guard/src/lib/__tests__/collection-access.guard.spec.ts`
- Modify: `libs/auth-guard/src/lib/index.ts` — export new decorator + guard

- [ ] **Step 1: Define the decorator with always-explicit metadata**

Create `libs/auth-guard/src/lib/decorators/require-collection-access.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_COLLECTION_ACCESS_KEY = 'requireCollectionAccess';

export type CollectionAccessVerb = 'read' | 'create' | 'update' | 'delete';
export type AccessLocation = 'param' | 'query' | 'body' | 'fixed';
export type CollectionKind = 'id' | 'code';

export interface CollectionTarget {
  from: AccessLocation;
  name: string;     // param/query/body key, or fixed value
  kind: CollectionKind;
}

export interface RecordTarget {
  from: 'param' | 'query' | 'body';
  name: string;
}

export interface RequireCollectionAccessOptions {
  verb: CollectionAccessVerb;
  collection: CollectionTarget;
  record?: RecordTarget;
}

export const RequireCollectionAccess = (opts: RequireCollectionAccessOptions) =>
  SetMetadata(REQUIRE_COLLECTION_ACCESS_KEY, opts);
```

No defaults — caller must provide full metadata.

- [ ] **Step 2: Implement the guard**

Create `libs/auth-guard/src/lib/collection-access.guard.ts`. The guard:
- Reads `REQUIRE_COLLECTION_ACCESS_KEY` metadata.
- If missing → defer (let `PermissionsGuard` handle).
- If present: resolve collection identifier from `req[opts.collection.from][opts.collection.name]`. Throw `InternalServerErrorException` if missing (programmer error — decorator misapplied).
- Look up the collection by id or code. Throw `NotFoundException` if not found.
- Call `AuthorizationService.canPerformOperation(ctx, collectionId, opts.verb)`. On deny, throw `ForbiddenException` with minimal `{ statusCode: 403, message: 'Permission denied', code: 'PERMISSION_DENIED' }` shape. (Audit row writing on 403 lands in Task 18 (Stream 2 PR6) once `AccessAuditPort.logAccessDenied` is added — the guard returns 403 from PR2; the audit wiring follows in PR6.)
- On allow, attach the §28 row-conditions to `req` for the data service to apply to lists/searches/details.

- [ ] **Step 3: Self-test fixtures**

In `libs/auth-guard/src/lib/__tests__/collection-access.guard.spec.ts`: test verb match, collection-from-param/query/body, missing identifier (500), unknown collection (404), denied (403 with provenance), allowed (200 with row-conditions attached). Use mock `AuthorizationService`.

- [ ] **Step 4: Run tests**

```
npx nx test auth-guard
```
Expected: all green.

- [ ] **Step 5: Export from lib**

Edit `libs/auth-guard/src/lib/index.ts`: re-export `RequireCollectionAccess`, `REQUIRE_COLLECTION_ACCESS_KEY`, type aliases, `CollectionAccessGuard`.

- [ ] **Step 6: Commit + PR**

```
git add libs/auth-guard/
git commit -m "phase3-w2-stream2: @RequireCollectionAccess decorator + CollectionAccessGuard"
gh pr create --title "phase3-w2-stream2: @RequireCollectionAccess + CollectionAccessGuard" --body "Adds always-explicit @RequireCollectionAccess({verb, collection, record?}) decorator and CollectionAccessGuard routing into §28 evaluator. No consumers yet — Stream 3 sweep wires data-ACL routes."
```

### Task 15: Stream 2 PR3 — Migrate @RequirePermission call sites + populate registry + scanner hard gate

**Files:**
- Modify: all ~213 existing `@RequirePermission(...)` call sites — verify or convert
- Modify: `libs/permission-registry/src/lib/registry.ts` — populate to ~40-80 entries
- Modify: `apps/web-client/src/lib/permissions.ts` (or wherever frontend constants live) — regen from registry
- Modify: `tools/scanners/permission-registry-sync-check.ts` — flip to hard CI gate
- Modify: `.github/workflows/ci.yml` — required status check

- [ ] **Step 1: Inventory current 213 @RequirePermission call sites**

```
git grep -n "@RequirePermission(" -- apps/
```
Expected: 213 hits across ~28 controllers (per investigation).

- [ ] **Step 2: For each call site, decide registry mapping**

For each existing `@RequirePermission('some.code')`:
- If `some.code` follows registry format AND describes a cross-cutting capability → add it (if missing) to `PERMISSION_REGISTRY` with appropriate plane/domain/action/dangerous fields.
- If `some.code` is actually a data-ACL operation (e.g., reading work_order records) → convert to `@RequireCollectionAccess({verb, collection: ...})` and remove the `@RequirePermission`.
- If `some.code` is essentially "authenticated" → convert to `@AuthenticatedOnly()`.

Domain judgment per call site. Expect ~70% stay as `@RequirePermission` with new registry entries, ~20% convert to `@RequireCollectionAccess`, ~10% to `@AuthenticatedOnly`.

- [ ] **Step 3: Populate PERMISSION_REGISTRY to final shape**

Update `libs/permission-registry/src/lib/registry.ts` to include all needed capability codes (~40-80 entries). Keep "coarse families" — collapse create/update/delete verbs into `manage` where the role grant doesn't legitimately distinguish them.

- [ ] **Step 4: Frontend codegen**

Either: (a) write a codegen step in `libs/permission-registry` that generates a TypeScript const enum consumed by `apps/web-client` and `apps/web-control-plane`; or (b) re-export the same constants and let frontend `import { PERMISSION_REGISTRY } from '@hubblewave/permission-registry';`.

Option (b) is simpler and avoids a build step. Use it unless tree-shaking concerns force codegen.

Update `apps/web-client/src/lib/permissions.ts` (or wherever local constants lived) to delete hand-typed strings and re-export from `@hubblewave/permission-registry`. Same for `apps/web-control-plane`.

- [ ] **Step 5: Update scanner to fail CI**

Edit `tools/scanners/permission-registry-sync-check.ts`: change exit code from 0-on-mismatch to 1-on-mismatch. Run:
```
npm run permission-registry:check
```
Expected: exit 0 (all references registered; all entries used).

- [ ] **Step 6: Update CI gate**

Edit `.github/workflows/ci.yml`: mark the `permission-registry:check` job as a required status check (blocks merge).

- [ ] **Step 7: Run lib + app build + test**

```
npx nx run-many --target=build --projects=permission-registry,api,control-plane,web-client,web-control-plane
npx nx test api
```
Expected: all green.

- [ ] **Step 8: Commit + PR**

```
git add apps/ libs/permission-registry/ tools/scanners/ .github/workflows/
git commit -m "phase3-w2-stream2: migrate 213 @RequirePermission sites + populate registry + scanner hard gate"
gh pr create --title "phase3-w2-stream2: registry sweep + scanner hard gate" --body "All 213 @RequirePermission sites use registered codes. Registry populated to ~40-80 coarse capability families. Frontend constants re-export from @hubblewave/permission-registry. Scanner flips to hard CI gate (required status check)."
```

### Task 16: Stream 2 PR4 — secureFieldsByDefault = true app-side flip + test sweep

**Files:**
- Modify: `apps/api/src/app/metadata/collections/collections.service.ts` — default `secureFieldsByDefault = true` on create
- Modify: `libs/instance-db/src/lib/entities/collection-definition.entity.ts` — `@Column({ default: true })`
- Modify: existing authorization tests asserting the explicit opt-out default-allow branch — rewrite to assert deny path (except the 2 tests protecting that branch itself)

Note: the DB default flip lands in the Pre-W2 baseline. This task closes the app side.

- [ ] **Step 1: Update CollectionsService.create**

Edit `apps/api/src/app/metadata/collections/collections.service.ts`. The create method should default `secureFieldsByDefault: true` when caller omits the field. Find any explicit `false` passes; review each (greenfield expectation: zero legitimate cases).

- [ ] **Step 2: Update entity default**

Edit `libs/instance-db/src/lib/entities/collection-definition.entity.ts`: `@Column({ type: 'boolean', default: true })` for `secure_fields_by_default`.

- [ ] **Step 3: Test sweep — identify tests relying on the explicit opt-out default-allow branch**

```
git grep -n "secureFieldsByDefault" -- libs/authorization/**/*.spec.ts apps/api/**/*.spec.ts
```
For each test asserting `secureFieldsByDefault: false` → explicit opt-out default-allow: rewrite to assert the deny path under the new default. Exception: keep exactly the two tests that protect the explicit opt-out default-allow branch in the §28 evaluator (which remains in the code for customer-facing per-collection opt-out).

- [ ] **Step 4: New test — secureFieldsByDefault=true + no rules → field denied + level-7 provenance**

Add to `libs/authorization/src/lib/authorization.service.spec.ts`:
```ts
it('new default-deny: secureFieldsByDefault=true + no rules → field denied + provenance level-7', async () => {
  const result = await authzService.evaluateFieldAccess(ctxWithNoRules, COLLECTION_ID, 'salary');
  expect(result.effect).toBe('deny');
  expect(result.matchedLevel).toBe(7);
  expect(result.fallbackChain).toContain('level-7: default deny (secureFieldsByDefault=true)');
});
```

- [ ] **Step 5: Run authorization + api tests**

```
npx nx test authorization
if ($LASTEXITCODE -ne 0) { throw 'authorization tests failed' }
npx nx test api
if ($LASTEXITCODE -ne 0) { throw 'api tests failed' }
```
Expected: all green.

- [ ] **Step 6: Commit + PR**

```
git add apps/api/src/app/metadata/collections/ libs/instance-db/src/lib/entities/collection-definition.entity.ts libs/authorization/src/lib/authorization.service.spec.ts apps/api/
git commit -m "phase3-w2-stream2: secureFieldsByDefault=true app-side flip + test sweep"
gh pr create --title "phase3-w2-stream2: secureFieldsByDefault=true flip" --body "App-side companion to the Pre-W2 baseline DB-default flip. CollectionsService.create defaults true. Test sweep rewrites explicit-opt-out default-allow assertions to test deny path; 2 tests protecting the explicit opt-out branch retained."
```

### Task 17: Stream 2 PR5 — Search §28.6 admin short-circuit retirement + canon §28.6 amendment

**Files:**
- Modify: `apps/api/src/app/ava/search/search-query.service.ts` — delete the `if (ctx.isAdmin) return 'allow_all'` branch around line 179
- Update: `CLAUDE.md` §28.6 — note search admin short-circuit retirement mirrors AuthorizationService

- [ ] **Step 1: Identify the short-circuit branch**

Read `apps/api/src/app/ava/search/search-query.service.ts:179` and the surrounding `buildAuthzAst` (or equivalent) function. Locate the admin allow_all short-circuit.

- [ ] **Step 2: Delete the branch**

Remove the `if (ctx.isAdmin) return 'allow_all'` (or equivalent) block. The function now flows uniformly through `AuthorizationService.compileSearchAuthorization(ctx, collection)` for all roles. Admin's authorization filter is produced by the §28 evaluator via Plan Fix 33's seeded admin policies (wildcard allows on system collections) — an equivalent allow-all corpus access, but as §28 output, not a special case.

- [ ] **Step 3: Integration test — admin search corpus accuracy + provenance**

Add to `apps/api/test/integration/search-authz.spec.ts`: seed admin + non-admin users; both query search; assertions: admin sees full corpus (matches the seeded admin policies' wildcard scope); non-admin sees only authorized collections; both queries produce provenance audit rows on any 403 outcomes; admin's filter compilation goes through `compileSearchAuthorization`, not a special-case branch.

- [ ] **Step 4: Canon §28.6 amendment**

Edit `CLAUDE.md` §28.6: add note that search admin short-circuit retirement mirrors the AuthorizationService Plan Fix 33 retirement. Admin authority flows uniformly through §28 across all evaluators (collection, field, search).

- [ ] **Step 5: Commit + PR**

```
git add apps/api/src/app/ava/search/ apps/api/test/integration/ CLAUDE.md
git commit -m "phase3-w2-stream2: search §28.6 admin short-circuit retired + canon §28.6 amendment"
gh pr create --title "phase3-w2-stream2: search admin short-circuit retirement" --body "Deletes search-query.service.ts:179 admin allow_all branch. Admin search authority flows through §28 evaluator with Plan Fix 33 seeded policies producing equivalent corpus access. Canon §28.6 amended to record the retirement mirrors AuthorizationService."
```

### Task 18: Stream 2 PR6 — Audit provenance write path + port relocation + explain capability registration

**Files:**
- Move: `libs/authorization/src/lib/audit-port.ts` → `libs/auth-guard/src/lib/audit-port.ts`
- Modify: `libs/authorization/` — update import paths from local `./audit-port` to `@hubblewave/auth-guard`
- Modify: `apps/api/src/app/identity/auth/token-issuer.service.ts` — update import paths
- Modify: `libs/auth-guard/src/lib/audit-port.ts` — add `logAccessDenied({ provenance, principal, resource })` method
- Modify: `libs/auth-guard/src/lib/permissions.guard.ts` — call `logAccessDenied` on 403
- Modify: `libs/auth-guard/src/lib/collection-access.guard.ts` — call `logAccessDenied` on 403
- Modify: `apps/api/src/app/identity/audit/access-audit.adapter.ts` (or wherever the AccessAuditPort adapter lives) — implement `logAccessDenied` writing `AuditLog` row with provenance in `context.additionalData`
- Modify: `libs/permission-registry/src/lib/registry.ts` — confirm `authorization:explain:read` entry present with `dangerous: true`

- [ ] **Step 1: Move the port file**

```
git mv libs/authorization/src/lib/audit-port.ts libs/auth-guard/src/lib/audit-port.ts
```

- [ ] **Step 2: Update libs/auth-guard's index to export the port**

Edit `libs/auth-guard/src/lib/index.ts`: add `export { AccessAuditPort, ACCESS_AUDIT_PORT, ... } from './audit-port';`.

- [ ] **Step 3: Update libs/authorization to consume from auth-guard**

In `libs/authorization/src/lib/authorization.service.ts` and any other file importing `./audit-port`: change to `import { AccessAuditPort, ACCESS_AUDIT_PORT } from '@hubblewave/auth-guard';`. Also update `libs/authorization/src/index.ts` — remove the `AccessAuditPort` re-export (it lives in auth-guard now).

- [ ] **Step 4: Update existing callers in apps/**

```
git grep -nl "from.*libs/authorization.*audit-port\|from '@hubblewave/authorization'" -- apps/
```
For each match using `AccessAuditPort`, update import to `@hubblewave/auth-guard`. The main known caller is `apps/api/src/app/identity/auth/token-issuer.service.ts` (`logSecurityEvent` for refresh-token reuse).

- [ ] **Step 5: Extend the port with logAccessDenied**

Edit `libs/auth-guard/src/lib/audit-port.ts`:
```ts
export interface AccessAuditPort {
  logSecurityEvent(event: { severity: 'low' | 'medium' | 'high'; userId: string; kind: SecurityEventKind; context: Record<string, unknown> }): Promise<void>;
  logAdminBypass(...): Promise<void>;
  logAccessDenied(event: {
    userId: string;
    resource: { kind: 'collection' | 'field' | 'route'; identifier: string };
    provenance: DecisionProvenance;
    requestContext?: Record<string, unknown>;
  }): Promise<void>;
}
```

- [ ] **Step 6: Wire guards to call logAccessDenied**

Edit `libs/auth-guard/src/lib/permissions.guard.ts`: on 403, call `this.accessAudit?.logAccessDenied({ userId, resource: { kind: 'route', identifier: handlerName }, provenance: { effect: 'deny', reason: 'missing_capability', requiredCode } })` before throwing the `ForbiddenException` with minimal shape.

Same in `libs/auth-guard/src/lib/collection-access.guard.ts`: pass through the §28 evaluator's provenance object on deny.

- [ ] **Step 7: Implement adapter**

In `apps/api/src/app/identity/audit/access-audit.adapter.ts` (or wherever the AccessAuditPort adapter lives — verify path during implementation), implement `logAccessDenied`. The implementation creates an `AuditLog` row with the provenance payload inside `context.additionalData`. The existing `AuditLogSubscriber` continues to hash on insert — no subscriber change.

- [ ] **Step 8: Confirm registry has the explain capability**

Verify `libs/permission-registry/src/lib/registry.ts` includes:
```ts
{ code: 'authorization:explain:read', plane: 'instance', domain: 'authorization', resource: 'explain', action: 'read', dangerous: true, description: 'Read authorization decisions for arbitrary users — exposes ACL reasoning.' },
```
If missing, add. (Stream 3 identity-area sweep migrates the existing `ExplainController` class-level `@Roles('admin')` to `@RequirePermission('authorization:explain:read')` — not this PR.)

- [ ] **Step 9: Integration test — 403 audit row carries provenance**

Add to `apps/api/test/integration/audit-provenance.spec.ts`: hit a `@RequirePermission`-decorated endpoint without the capability. Assertions: 403 with minimal body; an `AuditLog` row is written with `kind = 'access_denied'`, `context.additionalData.authzProvenance.effect = 'deny'`, the row is hashed by the subscriber (`hash` column non-null).

- [ ] **Step 10: Run tests + builds**

```
npx nx run-many --target=build --projects=auth-guard,authorization,api,control-plane
npx nx test auth-guard
if ($LASTEXITCODE -ne 0) { throw 'auth-guard tests failed' }
npx nx test authorization
if ($LASTEXITCODE -ne 0) { throw 'authorization tests failed' }
npx nx test api
```
Expected: all green.

- [ ] **Step 11: Commit + PR**

```
git add libs/auth-guard/ libs/authorization/ apps/api/ libs/permission-registry/
git commit -m "phase3-w2-stream2: audit provenance write path + AccessAuditPort relocation + explain capability"
gh pr create --title "phase3-w2-stream2: audit provenance + port relocation" --body "Moves AccessAuditPort from libs/authorization to libs/auth-guard (avoids cycle since libs/authorization imports UserRequestContext from libs/auth-guard). Extends port with logAccessDenied. PermissionsGuard + CollectionAccessGuard call it on 403. Adapter writes AuditLog row with provenance in context.additionalData; AuditLogSubscriber continues to hash on insert (no subscriber change). Registers authorization:explain:read in PERMISSION_REGISTRY (dangerous:true). The existing POST /authorization/explain/{collection,field} endpoints stay; Stream 3 identity-area sweep migrates their @Roles('admin') to @RequirePermission('authorization:explain:read')."
```

### Stream 2 exit gate

After all 6 PRs (Tasks 13-18) merged:
- [ ] `permission-registry-sync-check` green as required CI gate.
- [ ] All `@RequirePermission` sites use registered codes; every registry entry has ≥1 source reference.
- [ ] `frontend-permission-string-check` green (frontend uses only registered codes from `@hubblewave/permission-registry`).
- [ ] `search-query.service.ts:179` admin short-circuit deleted; integration test green.
- [ ] `secureFieldsByDefault=true` confirmed at entity + DB.
- [ ] `/authorization/explain/{collection,field}` returns valid provenance at every §28 level (parameterized integration test).
- [ ] Canon §28.6 amendment landed.

---

## Stream 3 — Route Boundary Hardening

**Goal:** Every handler in `apps/api` + `apps/control-plane` carries exactly one effective primary boundary decision. `PermissionsGuard` runtime is hard deny.

**Stream exit gate:** AST coverage scanner green at 100% on both planes; warn-and-allow branch deleted; bare-`@Roles` migrated; controller-prefix hygiene applied; canon §9 + §21 amendments landed.

**Spec reference:** §"Stream 3 — Route Boundary Hardening".

**Stream 3 depends on Stream 2's registry + decorators.** Master merges follow dependency order. Within Stream 3, area-sweep PRs can run in parallel (disjoint controllers).

### Task 19: Stream 3 PR1 — AST-aware coverage scanner (reporting-only)

**Files:**
- Create: `tools/scanners/route-boundary-coverage-check.ts`
- Create: `tools/scanners/__tests__/route-boundary-coverage-check.test.ts`
- Modify: `.github/workflows/ci.yml` — reporting-only job (does NOT yet replace regex scanner)
- Modify: `package.json`

- [ ] **Step 1: Install ts-morph if not already a dep**

```
npm list ts-morph
```
If absent: `npm install --save-dev ts-morph`.

- [ ] **Step 2: Implement the scanner**

Create `tools/scanners/route-boundary-coverage-check.ts`. Pseudocode:
```ts
import { Project, ClassDeclaration, MethodDeclaration } from 'ts-morph';

const HTTP_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Options', 'Head', 'Sse']);
const PRIMARY_BOUNDARY = new Set(['RequirePermission', 'RequireCollectionAccess', 'AuthenticatedOnly', 'Public']);
const AUXILIARY = new Set(['Roles']);

function effectiveBoundary(klass: ClassDeclaration, method: MethodDeclaration): string[] {
  const classDecs = klass.getDecorators().map(d => d.getName()).filter(n => PRIMARY_BOUNDARY.has(n));
  const methodDecs = method.getDecorators().map(d => d.getName()).filter(n => PRIMARY_BOUNDARY.has(n));
  return methodDecs.length > 0 ? methodDecs : classDecs;
}

// For each @Controller in apps/api/src/** and apps/control-plane/src/**:
//   For each method with an HTTP_DECORATORS decorator:
//     Compute effective primary boundary.
//     Apply mutual-exclusion rules:
//       - exactly one primary (zero or multiple → fail)
//       - @Public alone (combination with other primary → fail)
//       - no @RequirePermission + @RequireCollectionAccess together
//       - no @AuthenticatedOnly + @Roles/@RequirePermission/@RequireCollectionAccess
//       - bare @Roles without one of the four primaries → fail
//     If @RequirePermission(code): verify code in PERMISSION_REGISTRY.
//     If @RequireCollectionAccess(opts): verify opts has all required fields.
//     If @Req() parameter type is `any` or untyped Request → fail.
//
// Output: human-readable summary + JSON to dist/route-boundary-report.json.
// Mode: reporting-only (exit 0) at Stream 3 PR1; hard CI gate at Stream 3 PR final.
```

- [ ] **Step 3: Self-test fixtures**

Create fixtures under `tools/scanners/__tests__/fixtures/route-boundary/`:
- `good-permission.ts` — `@Get() @RequirePermission('audit:read')` → pass
- `good-collection.ts` — `@Get() @RequireCollectionAccess({...})` → pass
- `good-authenticated.ts` — `@Get() @AuthenticatedOnly()` → pass
- `good-public.ts` — `@Get() @Public()` → pass
- `bad-unannotated.ts` — `@Get() ` with no boundary → fail
- `bad-double-primary.ts` — `@Get() @RequirePermission('audit:read') @RequireCollectionAccess({...})` → fail
- `bad-public-combo.ts` — `@Get() @Public() @RequirePermission('audit:read')` → fail
- `bare-roles.ts` — `@Get() @Roles('admin')` (no primary) → fail
- `roles-plus-permission.ts` — `@Get() @Roles('admin') @RequirePermission('audit:read')` → pass (Roles is auxiliary)
- `unregistered-permission.ts` — `@Get() @RequirePermission('not.in.registry')` → fail
- `untyped-req.ts` — `@Get() handler(@Req() req: any)` → fail
- `sse-handler.ts` — `@Sse() @AuthenticatedOnly()` → pass (Sse in scanner scope)

Self-test runs scanner against each fixture and asserts expected outcome.

- [ ] **Step 4: Run scanner against current apps/**

```
npm run route-boundary:check
```
Expected: outputs a list of ~597 unannotated handlers + a small number of mutual-exclusion violations. Reporting-only — exit 0.

- [ ] **Step 5: Wire reporting-only CI job**

Edit `.github/workflows/ci.yml`: add `route-boundary:check` as a non-blocking job. (The old regex scanner `permissions-annotation-coverage.ts` remains active for now; Stream 3 final flip retires it.)

- [ ] **Step 6: Commit + PR**

```
git add tools/scanners/route-boundary-coverage-check.ts tools/scanners/__tests__/ .github/workflows/ci.yml package.json
git commit -m "phase3-w2-stream3: AST-aware route-boundary coverage scanner (reporting-only)"
gh pr create --title "phase3-w2-stream3: route-boundary coverage scanner reporting-only" --body "ts-morph-based scanner walking @Controller classes. Detects unannotated handlers, mutual-exclusion violations, bare-@Roles, unregistered permission strings, untyped @Req(). Sse handlers in scope. Reporting-only at this PR; sweeps follow; final flip switches to hard CI gate and retires the regex scanner."
```

### Task 20: Stream 3 — Identity area annotation sweep

**Files (controllers in scope):**
- `apps/api/src/app/identity/users/users.controller.ts`
- `apps/api/src/app/identity/roles/roles.controller.ts`
- `apps/api/src/app/identity/roles/permissions.controller.ts`
- `apps/api/src/app/identity/groups/groups.controller.ts`
- `apps/api/src/app/identity/policies/policies.controller.ts`
- `apps/api/src/app/identity/ui/ui.controller.ts`
- `apps/api/src/app/identity/config/config.controller.ts`
- `apps/api/src/app/identity/audit/audit-logs.controller.ts`
- `apps/api/src/app/identity/audit/audit-events.controller.ts`
- `apps/api/src/app/identity/auth/behavioral-analytics.controller.ts`
- `apps/api/src/app/identity/auth/impersonation.controller.ts`
- `apps/api/src/app/identity/auth/delegation.controller.ts`
- `apps/api/src/app/metadata/access/explain.controller.ts` — class-level `@Roles('admin')` migrates to `@RequirePermission('authorization:explain:read')`
- Other identity-domain controllers surfaced by the scanner

- [ ] **Step 1: Run scanner to list this area's unannotated handlers**

```
npm run route-boundary:check -- --area=identity
```
(If the scanner doesn't yet support area filtering, filter the output with grep.)

- [ ] **Step 2: For each handler, pick the primary decorator**

Per spec §"Stream 3 §3.2" decision tree:
- Cross-cutting capability → `@RequirePermission(<registered-code>)`. Add code to `PERMISSION_REGISTRY` if not present.
- Data ACL → `@RequireCollectionAccess({verb, collection, record?})`.
- User identity (e.g., `/users/me`) → `@AuthenticatedOnly()`.
- Public (e.g., `/auth/login`) → `@Public()` with rationale comment.

For the explain controller specifically: move from class-level `@Roles('admin')` to class-level `@RequirePermission('authorization:explain:read')`.

- [ ] **Step 3: Audit controller paths for double-api/ prefix**

For every controller touched, check the `@Controller(...)` argument. If it starts with `api/`, remove the prefix (global prefix from `main.ts:15` already adds `/api`). Examples in this area unlikely; check anyway.

- [ ] **Step 4: Delete redundant @Roles**

For each handler where the migrated `@RequirePermission(code)` is granted by exactly one role (admin), the bare `@Roles('admin')` is redundant — delete it. If multiple roles can hold the capability, the role check is also redundant by the capability model. Delete unless documented control-plane role hierarchy applies (rare in identity area).

- [ ] **Step 5: Run scanner against this area**

```
npm run route-boundary:check
```
Expected: this area's handlers now report 0 issues.

- [ ] **Step 6: Run identity area tests**

```
npx nx test api --testPathPattern=identity
```
Expected: all green.

- [ ] **Step 7: Commit + PR**

```
git add apps/api/src/app/identity/ apps/api/src/app/metadata/access/
git commit -m "phase3-w2-stream3: identity area annotation sweep"
gh pr create --title "phase3-w2-stream3: identity area annotation sweep" --body "Annotates all identity-area handlers with primary boundary decorator. Migrates ExplainController from @Roles('admin') to @RequirePermission('authorization:explain:read'). Deletes redundant @Roles where capability expresses authority. No controller-prefix bugs found in this area."
```

### Task 21: Stream 3 — Metadata schema/collections/properties annotation sweep

**Files (controllers in scope):**
- `apps/api/src/app/metadata/property/property.controller.ts`
- `apps/api/src/app/metadata/decision-tables/decision-table.controller.ts`
- `apps/api/src/app/metadata/display-rules/display-rule.controller.ts`
- `apps/api/src/app/metadata/change-packages/change-package.controller.ts`
- `apps/api/src/app/metadata/application/application.controller.ts`
- `apps/api/src/app/metadata/publish-impact/dependent-review-queue.controller.ts`
- Other metadata-domain controllers surfaced by the scanner

- [ ] **Step 1: Run scanner against metadata area**

```
npm run route-boundary:check
```
Filter output for `apps/api/src/app/metadata/`.

- [ ] **Step 2: For each handler, pick the primary decorator**

Most metadata routes are platform-admin operations → `@RequirePermission('metadata:schema:manage')` or finer (e.g., `metadata:workspace:manage`). Some are user-facing reads of their own collection definitions → `@AuthenticatedOnly`.

- [ ] **Step 3-7: Apply the per-area pattern from Task 20**

Path audit, scanner re-run, tests, commit + PR.

PR title: `phase3-w2-stream3: metadata schema/collections/properties annotation sweep`.

### Task 22: Stream 3 — Metadata views/dashboards/navigation/applications annotation sweep

**Files (controllers in scope):**
- `apps/api/src/app/metadata/view/view.controller.ts`
- `apps/api/src/app/metadata/workspaces/workspace.controller.ts`
- `apps/api/src/app/metadata/guided-processes/guided-process.controller.ts`
- Other metadata-side controllers (nav, dashboards) surfaced by the scanner

Apply the same pattern. Most views/workspaces routes are user-facing reads of their accessible collections → `@RequireCollectionAccess({verb: 'read', ...})` where appropriate. Dashboard authoring → `@RequirePermission('metadata:workspace:manage')`.

PR title: `phase3-w2-stream3: metadata views/dashboards annotation sweep`.

### Task 23: Stream 3 — Data CRUD + grid annotation sweep

**Files (controllers in scope):**
- `apps/api/src/app/data/collection-data.controller.ts` — `data/collections/:collectionCode/data` → `@RequireCollectionAccess({verb, collection: { from: 'param', name: 'collectionCode', kind: 'code' }})` per HTTP verb
- Other data-domain controllers (offerings, work, grid, etc.) surfaced by the scanner

Most handlers are data-ACL → `@RequireCollectionAccess(verb, ...)`. A few admin operations on data definitions → `@RequirePermission('data:record:manage')`.

PR title: `phase3-w2-stream3: data CRUD + grid annotation sweep`.

### Task 24: Stream 3 — Automation/workflow/scheduling annotation sweep

**Files (controllers in scope):**
- `apps/api/src/app/automation/rules/rules.controller.ts`
- `apps/api/src/app/automation/sync-trigger/sync-trigger.controller.ts` — **path bug**: `@Controller('api/automation/sync-trigger')` → `@Controller('automation/sync-trigger')` (delete the redundant `api/`)
- `apps/api/src/app/automation/runtime/ava-automation.controller.ts` — **path bug**: `@Controller('api/automation/ava')` → `@Controller('automation/ava')`
- `apps/api/src/app/automation/automation-health.controller.ts`
- `apps/api/src/app/automation/workflow/workflow-instances.controller.ts`
- `apps/api/src/app/automation/workflow/workflow-approvals.controller.ts`
- `apps/api/src/app/automation/workflow/workflow-definitions.controller.ts`
- `apps/api/src/app/automation/workflow/workflow-webhook.controller.ts`

- [ ] **Step 1: Fix the prefix bugs**

In `sync-trigger.controller.ts:43` and `ava-automation.controller.ts:36`: change the `@Controller(...)` argument from `'api/automation/sync-trigger'` and `'api/automation/ava'` respectively to `'automation/sync-trigger'` and `'automation/ava'`. The global prefix from `main.ts:15` already adds `/api`.

- [ ] **Step 2: Update any tests + clients that hardcode the broken paths**

Search:
```
git grep -n "api/api/automation\|/api/automation/sync-trigger\|/api/automation/ava" -- apps/ test/ e2e/
```
Update any test or client expecting the double-prefixed path to use the corrected single-prefix path.

- [ ] **Step 3: Annotate handlers**

Sync-trigger explicitly stays user-JWT-only (`@AuthenticatedOnly()`) per its controller header docs. Workflow approvals → `@RequirePermission('automation:approve')` or similar. Rules CRUD → `@RequirePermission('automation:manage')`.

- [ ] **Step 4-7: Per-area pattern (scanner, tests, commit, PR)**

PR title: `phase3-w2-stream3: automation/workflow annotation sweep + prefix bug fix`.

### Task 25: Stream 3 — AVA (chat/governance/search/reasoning) annotation sweep

**Files (controllers in scope):**
- `apps/api/src/app/ava/ava-governance.controller.ts`
- AVA chat controller (path varies; surfaced by scanner)
- AVA search controller (`apps/api/src/app/ava/search/`)
- Other AVA controllers

Annotate per the pattern. AVA chat → `@AuthenticatedOnly()` (user IS the authorization). Governance → `@RequirePermission('ava:governance:manage')` (add code to registry). Search → `@AuthenticatedOnly()` for end-user search; `@RequirePermission('search:admin')` for admin reindex actions.

PR title: `phase3-w2-stream3: AVA annotation sweep`.

### Task 26: Stream 3 — Analytics/audit annotation sweep

**Files (controllers in scope):**
- `apps/api/src/app/analytics/audit/audit-logs.controller.ts` (if separate from identity audit)
- `apps/api/src/app/analytics/dashboards/dashboards.controller.ts`
- Other analytics controllers

Annotate: audit log reads → `@RequirePermission('audit:read')`. Audit exports → `@RequirePermission('audit:export')` (`dangerous: true`). Dashboards → `@RequireCollectionAccess` if they target customer collections; `@RequirePermission` if they're platform-level.

PR title: `phase3-w2-stream3: analytics/audit annotation sweep`.

### Task 27: Stream 3 — Notifications annotation sweep

**Files (controllers in scope):**
- `apps/api/src/app/notifications/notifications.controller.ts`
- Other notification-related controllers

Annotate per the pattern. Most notification routes → `@AuthenticatedOnly()` (user sees their own notifications). Notification configuration → `@RequirePermission('notifications:configure')` (add to registry).

PR title: `phase3-w2-stream3: notifications annotation sweep`.

### Task 28: Stream 3 — Control-plane auth/customers/instances annotation sweep

**Files (controllers in scope):**
- `apps/control-plane/src/app/auth/auth.controller.ts`
- `apps/control-plane/src/app/customers/customers.controller.ts`
- `apps/control-plane/src/app/instances/instances.controller.ts`
- Other control-plane controllers in this area

Annotate per the pattern. Auth login → `@Public()`. Auth/me → `@AuthenticatedOnly()`. Customer/instance management → `@RequirePermission` with control-plane registry codes (`tenant:provision`, `instance:lifecycle:manage`, etc.; add to registry with `plane: 'control-plane'`).

PR title: `phase3-w2-stream3: control-plane auth/customers/instances annotation sweep`.

### Task 29: Stream 3 — Control-plane ops/metrics/packs/subscriptions annotation sweep

**Files (controllers in scope):**
- `apps/control-plane/src/app/packs/packs.controller.ts`
- `apps/control-plane/src/app/subscriptions/subscriptions.controller.ts`
- `apps/control-plane/src/app/metrics/metrics.controller.ts`
- `apps/control-plane/src/app/health-aggregator/health.controller.ts`
- Other control-plane operational controllers

Annotate per the pattern. Add control-plane registry codes (`packs:manage`, `billing:read`, `metrics:read`, `system:admin` for health). Health → `@Public()` if it's the K8s liveness probe.

PR title: `phase3-w2-stream3: control-plane ops/metrics/packs annotation sweep`.

### Task 30: Stream 3 — Remaining-controllers sweep (catch-all)

Re-run `npm run route-boundary:check`. Any handlers still unannotated after Tasks 20-29 belong to areas not yet covered. Annotate them per the pattern. Likely candidates: instance-api controllers, internal service-token controllers, debug/health endpoints.

Once this PR merges, the scanner reports 0 unannotated handlers.

PR title: `phase3-w2-stream3: remaining handlers catch-all sweep`.

### Task 31: Stream 3 PR-final — Coverage-flip + retire regex scanner + delete warn-and-allow

**Files:**
- Modify: `tools/scanners/route-boundary-coverage-check.ts` — flip to hard CI gate (exit 1 on violations)
- Modify: `.github/workflows/ci.yml` — `route-boundary:check` becomes required status check
- Delete: `tools/scanners/permissions-annotation-coverage.ts` (regex version)
- Delete: `docs/permissions-rollout-coverage.md`
- Modify: `libs/auth-guard/src/lib/permissions.guard.ts` — delete warn-and-allow branch; add HW_LOUD_AUTH_MISCONFIG-gated 500 fallback
- Update: `CLAUDE.md` §9 + §21 — amendments

- [ ] **Step 1: Verify scanner at 100% coverage**

```
npm run route-boundary:check
```
Expected: exit 0; no violations across apps/api + apps/control-plane.

- [ ] **Step 2: Flip scanner to hard CI gate**

Edit `tools/scanners/route-boundary-coverage-check.ts`: change `process.exit(0)` to `process.exit(violations > 0 ? 1 : 0)`. In CI workflow, mark the job as required.

- [ ] **Step 3: Delete the regex scanner**

```
git rm tools/scanners/permissions-annotation-coverage.ts
git rm tools/scanners/__tests__/permissions-annotation-coverage.test.ts (if present)
```
Remove the script from `package.json` and the CI job from `.github/workflows/ci.yml`.

- [ ] **Step 4: Delete the rollout coverage doc**

```
git rm docs/permissions-rollout-coverage.md
```

- [ ] **Step 5: Delete PermissionsGuard warn-and-allow branch**

Edit `libs/auth-guard/src/lib/permissions.guard.ts`. Remove the `if (!effectiveBoundary) { logger.warn(...); return true; }` branch. Replace with:
```ts
if (!effectiveBoundary) {
  const loud = process.env.HW_LOUD_AUTH_MISCONFIG === 'true';
  if (loud) {
    throw new InternalServerErrorException(`Handler missing boundary decision: ${context.handlerName}`);
  }
  this.logger.error(`Handler missing boundary decision: ${context.handlerName} (route ${context.routePath}). Returning 403 — scanner should have caught this.`);
  this.runtimeAnomalies.record({ kind: 'handler_missing_boundary', handler: context.handlerName });
  throw new ForbiddenException({ statusCode: 403, message: 'Permission denied', code: 'PERMISSION_DENIED' });
}
```

- [ ] **Step 6: Canon §9 amendment**

Edit `CLAUDE.md` §9: append a paragraph naming the four primary boundary decorators (`@RequirePermission`, `@RequireCollectionAccess`, `@AuthenticatedOnly`, `@Public`) as the contract for endpoint authorization. `@Roles` is auxiliary, never primary.

- [ ] **Step 7: Canon §21 amendment**

Edit `CLAUDE.md` §21: extend the scanner inventory list with `no-hs256-signing-check`, `route-boundary-coverage-check`, `permission-registry-sync-check`, `service-token-default-deny-check`, `no-untyped-req-check`. Each ships with a self-test.

- [ ] **Step 8: Integration test — unannotated handler at runtime**

Add `apps/api/test/integration/route-boundary-runtime.spec.ts`:
- Inject a test-only controller into the app module with `@Get('/__test__/unannotated')` and no boundary decorator (test-only setup, NOT a real controller in source).
- With `HW_LOUD_AUTH_MISCONFIG=true`: expect 500.
- Without the env flag: expect 403 with minimal body; assert `RuntimeAnomalyService` recorded a `handler_missing_boundary` event.

- [ ] **Step 9: Commit + PR**

```
git add tools/scanners/ .github/workflows/ libs/auth-guard/src/lib/permissions.guard.ts apps/api/test/ CLAUDE.md
git rm tools/scanners/permissions-annotation-coverage.ts docs/permissions-rollout-coverage.md
git commit -m "phase3-w2-stream3: coverage-flip + delete regex scanner + retire warn-and-allow + canon §9/§21"
gh pr create --title "phase3-w2-stream3: coverage flip + retire warn-and-allow" --body "Flips route-boundary-coverage-check to hard CI gate. Deletes regex permissions-annotation-coverage scanner + docs/permissions-rollout-coverage.md. Deletes PermissionsGuard warn-and-allow branch. Production unannotated → closed 403 + RuntimeAnomaly. Test/local-dev with HW_LOUD_AUTH_MISCONFIG=true → 500. Canon §9 + §21 amendments landed."
```

### Stream 3 exit gate

After all 13 PRs (Tasks 19-31) merged:
- [ ] AST coverage scanner green at 100% on both planes (required CI gate).
- [ ] `permissions-annotation-coverage.ts` regex version deleted.
- [ ] `permissions.guard.ts` warn-and-allow branch deleted.
- [ ] `docs/permissions-rollout-coverage.md` deleted.
- [ ] No `KNOWN_DEFERRED_OFFENDERS` entries for unannotated handlers.
- [ ] Integration test: production unannotated → closed 403 + RuntimeAnomaly; test/local-dev → 500.
- [ ] Canon §9 + §21 amendments landed.

---

## Stream 4 — Cross-Surface Consistency

**Goal:** Streams 1-3 contracts honored uniformly across search engines, audit pipeline, AVA writes, dashboard reads, and both frontend clients. W2 exit criterion provable end-to-end.

**Stream 4a (parallel with Stream 1)** — disjoint code paths. Tasks 32-34.
**Stream 4b (sequential after Streams 1-3)** — depends on contracts. Tasks 35-40.

**Stream exit gate:** F042 stress green; F052 transactionality green; F146 verified; F136 search accuracy green on both engines; F091 + F102 frontend tests green on both clients; SSE invalidation green; `w2-validate.ts` happy + negative paths green.

**Spec reference:** §"Stream 4 — Cross-Surface Consistency".

### Task 32: Stream 4a — F042 audit hash-chain concurrency stress test

**Files:**
- Create: `apps/api/test/integration/audit-hash-chain-concurrency.spec.ts`

- [ ] **Step 1: Review existing subscriber**

Read `libs/instance-db/src/lib/subscribers/audit-log.subscriber.ts:46`. Confirm `SELECT pg_advisory_xact_lock(hashtext($1))` is called before reading the predecessor row.

- [ ] **Step 2: Write the stress test**

Create the integration test. Set up: a fresh DB. Spawn 50 parallel async transactions; each transaction inserts 10 audit rows in 5 distinct sessions (mix of sessions per transaction to exercise the chain). Use `Promise.all` to drive concurrency.

Assertions:
- Chain length = 500 (50 × 10).
- For every row r where `r.previousHash IS NOT NULL`: the row with `r.previousHash` exists and that row's `hash` matches `r.previousHash`.
- The first row has `previousHash = NULL`.
- The full set of hashes is internally consistent — recomputing each row's hash from `(previousHash || payload)` yields the stored `hash`.

- [ ] **Step 3: Run the test**

```
npx nx test api --testPathPattern=audit-hash-chain-concurrency
```
Expected: green within 30s. Non-flaky over 5 consecutive runs.

- [ ] **Step 4: If a concurrency bug surfaces, expand scope per Learning-Revises-Plan**

If the stress test fails, the subscriber's locking is incomplete. Add scope: redesign the locking mechanism. Update this plan + the spec.

- [ ] **Step 5: Commit + PR**

```
git add apps/api/test/integration/audit-hash-chain-concurrency.spec.ts
git commit -m "phase3-w2-stream4a: F042 audit hash-chain concurrency stress test"
gh pr create --title "phase3-w2-stream4a: F042 hash-chain stress test" --body "50 concurrent transactions × 10 inserts × 5 sessions. Asserts chain length, no gaps, hash continuity. Non-flaky over 5 runs. F042 verified closed (no code change needed)."
```

### Task 33: Stream 4a — F052 AVA chat transactionality

**Files:**
- Modify: `apps/api/src/app/ava/chat/chat-orchestrator.service.ts` (verify path during implementation)
- Modify: `libs/instance-db/src/lib/audit-helpers/with-audit.ts` (extend if needed to accept EntityManager)
- Create: `apps/api/test/integration/ava-chat-transactionality.spec.ts`

- [ ] **Step 1: Identify the 7-write sequence**

Read the AVA chat orchestrator. Identify the seven sequential writes (chat message insert, conversation update, assistant message insert, tool call insert, conversation state update, tool result insert, conversation metadata update). Confirm count + verify-against-the-spec sequence.

- [ ] **Step 2: Wrap in dataSource.transaction**

Replace the sequential writes with:
```ts
return this.dataSource.transaction(async (tx) => {
  // All 7 operations use tx.getRepository(...) or tx.manager directly.
  // Audit writes use the transactional audit helper from canon §10.
});
```

- [ ] **Step 3: Extend withAudit helper if needed**

If `withAudit(dataSource, fn)` doesn't accept an `EntityManager`, extend its signature to accept either. Implementation: if first arg is `DataSource`, use its `transaction(...)` wrapper; if it's `EntityManager`, use it directly (caller is already inside a transaction).

- [ ] **Step 4: Write the failure-injection test**

Create the integration test. For each of the 7 steps, simulate a failure (e.g., by mocking the repository's save method to throw on that specific call). Assert:
- The transaction rolls back.
- Post-failure DB state matches pre-call state (no chat message, no conversation update, no orphan rows).

- [ ] **Step 5: Run the test**

```
npx nx test api --testPathPattern=ava-chat-transactionality
```
Expected: 7 parameterized failure points all assert clean rollback. Green.

- [ ] **Step 6: Commit + PR**

```
git add apps/api/src/app/ava/chat/ libs/instance-db/src/lib/audit-helpers/ apps/api/test/integration/
git commit -m "phase3-w2-stream4a: F052 AVA chat orchestrator transactionality"
gh pr create --title "phase3-w2-stream4a: F052 AVA chat transactionality" --body "Wraps 7-write AVA chat orchestration in dataSource.transaction. Extends withAudit helper to accept EntityManager. Parameterized failure-injection test asserts clean rollback at each of the 7 steps."
```

### Task 34: Stream 4a — F146 dashboard widget authz (verify + complete)

**Files:**
- Modify: `apps/api/src/app/analytics/dashboards/dashboards.service.ts` — verify + complete widget filtering
- Modify: `libs/authorization/src/lib/authorization.service.ts` — add `filterDashboardLayout(layout, principal)` method if not present
- Create: `apps/api/test/integration/dashboard-widget-authz.spec.ts`
- Modify: `tools/authz-bypass-check.ts` `KNOWN_BYPASSES` — delete F146 entry

- [ ] **Step 1: Read the existing dashboard service**

Read `apps/api/src/app/analytics/dashboards/dashboards.service.ts:122-142`. Determine if widget filtering is partially implemented or absent entirely.

- [ ] **Step 2: Implement filterDashboardLayout in AuthorizationService**

In `libs/authorization/src/lib/authorization.service.ts`, add (or complete) the method:
```ts
async filterDashboardLayout(layout: DashboardLayout, principal: UserRequestContext): Promise<{ layout: DashboardLayout; droppedWidgetCount: number; droppedWidgets: Array<{ widgetId: string; reason: string }> }> {
  // Walk layout.widgets tree.
  // For each widget with dataSource.collectionId: call this.canPerformOperation(principal, collectionId, 'read').
  // If denied, drop the widget. Track in droppedWidgets array.
  // Return filtered layout + drop count + provenance summary.
}
```

- [ ] **Step 3: Wire DashboardsService**

Edit `apps/api/src/app/analytics/dashboards/dashboards.service.ts`. `getDashboard()` and `getDashboardLayout()` now call `filterDashboardLayout` before returning. On drops, write ONE audit row per dashboard read with `droppedWidgetCount` + compact provenance summary (NOT one row per stripped widget).

- [ ] **Step 4: Integration test**

Create `apps/api/test/integration/dashboard-widget-authz.spec.ts`. Seed: a dashboard with 5 widgets, each targeting different collections. Two collections the user can `read`, three the user cannot. Call `GET /api/dashboards/:id`.

Assertions:
- Response layout contains 2 widgets (the readable ones).
- One audit log row written with `droppedWidgetCount: 3` + provenance summary mentioning the 3 dropped widget IDs/collection IDs.

- [ ] **Step 5: Delete F146 KNOWN_BYPASSES entry**

Edit `tools/authz-bypass-check.ts`: remove the F146 entry from `KNOWN_BYPASSES`.

- [ ] **Step 6: Run scanner + test**

```
npm run authz:check
if ($LASTEXITCODE -ne 0) { throw 'authz:check failed' }
npx nx test api --testPathPattern=dashboard-widget-authz
```
Expected: both green.

- [ ] **Step 7: Commit + PR**

```
git add apps/api/src/app/analytics/dashboards/ libs/authorization/ apps/api/test/integration/ tools/authz-bypass-check.ts
git commit -m "phase3-w2-stream4a: F146 dashboard widget authz filtering"
gh pr create --title "phase3-w2-stream4a: F146 dashboard widget authz" --body "AuthorizationService.filterDashboardLayout walks widget tree, drops widgets user cannot read. Single audit row per dashboard read with droppedWidgetCount + compact provenance. KNOWN_BYPASSES F146 entry deleted."
```

### Task 35: Stream 4b — Unified search authz emitter verification

**Files:**
- Modify: `apps/api/src/app/ava/search/search-query.service.ts` — verify §28 output flow post-Stream 2 PR5
- Modify: `libs/search-authz/src/lib/build-authz-ast.ts` — ensure uses `principal.roleIds` (UUIDs)
- Create: `apps/api/test/integration/search-authz-corpus-accuracy.spec.ts`
- Create: `apps/api/test/integration/search-authz-facet-accuracy.spec.ts`
- Create: `apps/api/test/integration/search-authz-pagination-accuracy.spec.ts`

- [ ] **Step 1: Verify §28-output flow**

Inspect `apps/api/src/app/ava/search/search-query.service.ts` (post-Stream 2 PR5). Confirm `buildAuthzAst(principal, collection)` calls into §28 directly, no admin special-case branch.

- [ ] **Step 2: Verify principal.roleIds used (not roleCodes or roles)**

In `libs/search-authz/src/lib/build-authz-ast.ts`: ABAC predicates use `principal.roleIds` (UUIDs) per Stream 1 contract. Update any lingering `principal.roles` references.

- [ ] **Step 3: Verify ACL projection in indexer**

`SearchIndexingService.buildAclFields()` attaches `_collection_id` + `_attribute_*` fields on every Typesense document write. Pgvector tables carry `_collection_id` + `_attribute_*` columns. Confirm both.

- [ ] **Step 4: Corpus accuracy test**

Create `apps/api/test/integration/search-authz-corpus-accuracy.spec.ts`. Seed: 100 records across 3 collections. User has `read` on 1 collection, level-1 deny on a specific record. Query search; assert results include only records from the readable collection AND exclude the denied record.

Parameterize over both engines (Typesense + pgvector).

- [ ] **Step 5: Facet accuracy test**

Create `apps/api/test/integration/search-authz-facet-accuracy.spec.ts`. Same seed. Query search with facets; assert facet counts match visible corpus, not total corpus.

- [ ] **Step 6: Pagination accuracy test**

Create `apps/api/test/integration/search-authz-pagination-accuracy.spec.ts`. Seed 25 records authorized + 75 unauthorized. Query `?page=2&pageSize=10`. Assert returns records 11-20 of the AUTHORIZED set (not 11-20 of total with post-filtering).

- [ ] **Step 7: Run all three tests on both engines**

```
npx nx test api --testPathPattern=search-authz
```
Expected: green on both Typesense and pgvector paths.

- [ ] **Step 8: Commit + PR**

```
git add apps/api/src/app/ava/search/ libs/search-authz/ apps/api/test/integration/
git commit -m "phase3-w2-stream4b: search authz emitter verification + corpus/facet/pagination tests"
gh pr create --title "phase3-w2-stream4b: search authz emitter verification" --body "Verifies §28 output flows through buildAuthzAst → emitTypesenseFilterBy + emitPgvectorWhere without admin special-case (Stream 2 PR5 retired it). Confirms principal.roleIds drives ABAC predicates. Three integration tests prove corpus accuracy, facet accuracy, pagination accuracy on both engines."
```

### Task 36: Stream 4b — API contract: permissions.fields payload

**Files:**
- Modify: data response shapes in `apps/api/src/app/data/collection-data.service.ts` and related
- Modify: list/search/detail/dashboard response shapes
- Modify: response DTOs

- [ ] **Step 1: Define the permissions payload shape**

Create a shared type (e.g., in `libs/authorization` or a shared DTO lib):
```ts
export interface ResponsePermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  fields: {
    [fieldName: string]: {
      canRead: boolean;
      canWrite?: boolean;
      maskStrategy?: 'NONE' | 'PARTIAL' | 'FULL';
    };
  };
}
```

- [ ] **Step 2: Compute permissions in the data service**

In `apps/api/src/app/data/collection-data.service.ts` (and other data services): after computing record results, call `AuthorizationService.evaluateRecordPermissions(principal, collectionId)` to compute the per-field permission map. Apply it to ALL records in the response (per-field permissions are uniform across records in the same query, computed once).

- [ ] **Step 3: Attach permissions to response**

Response shape for `GET /api/data/collections/:collectionCode/data` (and equivalents):
```json
{
  "records": [...],
  "permissions": { ... ResponsePermissions ... }
}
```
Same shape for single-record reads, list reads, search results, dashboard widget data.

- [ ] **Step 4: Handle `canRead: false` server-side**

Server omits the field from each record's `record` object entirely. Client doesn't need to mask `canRead: false` — it's just absent.

- [ ] **Step 5: Apply masking server-side**

`canRead: true, maskStrategy: 'PARTIAL'` or `'FULL'` → server returns the masked value (via `maskCollectionRecord`). Client renders as-is.

- [ ] **Step 6: Integration test — payload shape + masking**

Add `apps/api/test/integration/permissions-payload.spec.ts`. Seed: a collection with 3 fields (visible, masked, denied) for the test user. Query the data route. Assert: `record.visible` returns the raw value; `record.masked` returns the masked value; `record.denied` is absent from `record`; `permissions.fields.{visible,masked,denied}` reflects the per-field shape.

- [ ] **Step 7: Run tests**

```
npx nx test api --testPathPattern=permissions-payload
```
Expected: green.

- [ ] **Step 8: Commit + PR**

```
git add apps/api/src/app/data/ libs/authorization/ apps/api/test/integration/
git commit -m "phase3-w2-stream4b: API contract — permissions.fields payload on UI-facing data responses"
gh pr create --title "phase3-w2-stream4b: permissions.fields payload" --body "Adds permissions: { canCreate, canUpdate, canDelete, fields: { ... } } to every UI-facing data/list/search/dashboard response. Server omits denied fields from record body; server applies masking. Frontend renders per-permissions. Internal/non-UI endpoints stay explicit per endpoint."
```

### Task 37: Stream 4b — Frontend field-permission wiring (web-client + web-control-plane)

**Files:**
- Modify: `apps/web-client/src/components/form/FieldRegistry.tsx`
- Modify: `apps/web-client/src/components/form/FormLayout.tsx`
- Modify: list/grid components in `apps/web-client/src/components/`
- Modify: search result rendering
- Modify: dashboard widget rendering
- Modify: `apps/web-control-plane/src/components/` — analogous changes
- Modify: `apps/web-client/src/api/services/api.ts` — type the response shape with `permissions` payload

- [ ] **Step 1: Update API client types**

Update `apps/web-client/src/api/services/api.ts` (and analogous in web-control-plane) to include `permissions` payload in response types.

- [ ] **Step 2: Update FieldRegistry to consult fieldPermissions**

Edit `apps/web-client/src/components/form/FieldRegistry.tsx`:
- Read `permissions.fields[fieldName]` from the response.
- `!canRead` → hide the field entirely (no DOM).
- `canRead && maskStrategy === 'PARTIAL'` or `'FULL'` → render the masked value (which backend already returned).
- `!canWrite` → render as read-only.

- [ ] **Step 3: Update FormLayout same way**

Edit `apps/web-client/src/components/form/FormLayout.tsx`. Same per-field treatment.

- [ ] **Step 4: Update list/grid components**

For each list/grid view component: when rendering columns, consult `permissions.fields[columnName]`. Hide column entirely if no record has read access (uniform across response); render as read-only for write-denied.

- [ ] **Step 5: Update search result renderers**

Same pattern. Search result response carries its own `permissions` payload.

- [ ] **Step 6: Update dashboard widget rendering**

After F146 server-side filter, widgets still arrive with their `permissions` payload. Render per the same per-field treatment.

- [ ] **Step 7: Mirror on web-control-plane**

Same pattern for any control-plane UI that displays customer-collection-like data (rare).

- [ ] **Step 8: Frontend tests**

Add component tests (Vitest/React Testing Library) that pass fixture responses with various permission shapes; assert correct rendering: hidden, masked, read-only.

- [ ] **Step 9: Manual browser verification** (per CLAUDE.md frontend rule)

Start the dev stack:
```
npm run dev:platform
```
Navigate to a record detail view. Verify:
- A field the user cannot read is absent from the form.
- A field the user can read but not write renders as read-only.
- A masked field renders the mask value (e.g., `***-**-1234`).

Capture screenshots or note observations.

- [ ] **Step 10: Commit + PR**

```
git add apps/web-client/ apps/web-control-plane/
git commit -m "phase3-w2-stream4b: frontend field-permission wiring (F091)"
gh pr create --title "phase3-w2-stream4b: frontend field-permission wiring" --body "FieldRegistry + FormLayout + list/grid + search/dashboard renderers consult permissions.fields. canRead:false hides; canWrite:false read-only; maskStrategy renders masked value. Same pattern on web-control-plane. Component tests + manual browser verification both green."
```

### Task 38: Stream 4b — Frontend 401/403 UX (F102) — both clients

**Files:**
- Modify: `apps/web-client/src/api/services/api.ts` — error interceptor
- Modify: `apps/web-control-plane/src/api/services/api.ts` — same
- Modify: route definitions in both clients to declare `requires` capability
- Create: `apps/web-client/src/pages/PermissionNeeded.tsx` (and equivalent on control-plane)

- [ ] **Step 1: Update API error interceptor — instance plane**

Edit `apps/web-client/src/api/services/api.ts`. Classify response errors:
- **401**: trigger silent-refresh; on refresh failure, redirect to login.
- **403 with `code: 'PERMISSION_DENIED'`**: display toast "You don't have permission to perform this action." If the failure was route navigation (not in-page action), redirect to `/permission-needed`.
- **403 with other `code` values** (`RATE_LIMITED`, `ACCOUNT_SUSPENDED`): mapped friendly messages.

- [ ] **Step 2: Mirror on control-plane**

Edit `apps/web-control-plane/src/api/services/api.ts` same shape.

- [ ] **Step 3: Add /permission-needed page**

Create `apps/web-client/src/pages/PermissionNeeded.tsx`. Simple page showing "You don't have permission to access this section. Contact your administrator." Add route entry pointing to this page. Same on control-plane.

- [ ] **Step 4: Add route-level guard**

In the router config (likely `apps/web-client/src/router.tsx` or similar): route definitions declare required capability:
```ts
route({ path: '/admin/settings', requires: 'system:admin', component: AdminSettingsPage })
```
Router guard checks `permissionCodes` cache (populated by `GET /users/me` on app boot) before navigation. If missing capability: navigate to `/permission-needed` rather than the target page. **UX-only — backend is authoritative.** Stale cache → still hits backend 403 on actual API calls.

- [ ] **Step 5: Mirror on control-plane**

Same guard pattern; uses `GET /auth/me` instead of `/users/me`.

- [ ] **Step 6: Frontend tests**

Add tests verifying:
- 403 from API → toast renders with friendly message; navigation guarded.
- Route-level guard prevents navigation to `requires`-protected route when cache lacks capability.
- Even with tampered cache claiming `system:admin`, backend 403 on actual API call still surfaces the 403 toast.

- [ ] **Step 7: Manual browser verification**

Start dev stack. As a non-admin user, attempt to navigate to an admin-only route → expect `/permission-needed`. Attempt an admin-only API call → expect toast.

- [ ] **Step 8: Commit + PR**

```
git add apps/web-client/ apps/web-control-plane/
git commit -m "phase3-w2-stream4b: frontend 401/403 UX (F102) on both clients"
gh pr create --title "phase3-w2-stream4b: frontend 401/403 UX" --body "Error interceptor classifies 401 vs 403. PERMISSION_DENIED renders toast; route navigation redirects to /permission-needed. Route guard checks cached permissionCodes (UX only — backend authoritative). Same pattern on both clients. Manual browser verification green."
```

### Task 39: Stream 4b — SSE invalidation channels + frontend subscribers

**Files:**
- Create: `apps/api/src/app/identity/sse/identity-me-events.controller.ts`
- Create: `apps/control-plane/src/app/auth/auth-me-events.controller.ts`
- Modify: `apps/web-client/src/api/services/identity-events.ts` — SSE subscriber
- Modify: `apps/web-control-plane/src/api/services/auth-events.ts` — SSE subscriber
- Modify: F025 subscriber in `libs/instance-db` to also publish to the SSE channel

- [ ] **Step 1: Instance-plane SSE endpoint**

Create `apps/api/src/app/identity/sse/identity-me-events.controller.ts`. `@Controller('identity/me/events')` with `@Sse()` `@AuthenticatedOnly()` method returning an `Observable<MessageEvent>`. The endpoint subscribes to the per-user Redis pub/sub channel and emits events to the connected client.

Three event kinds: `permissionCodesChanged`, `roleCodesChanged`, `sessionRevoked`.

- [ ] **Step 2: Control-plane SSE endpoint**

Mirror at `apps/control-plane/src/app/auth/auth-me-events.controller.ts` — `@Controller('auth/me/events')` with same shape.

- [ ] **Step 3: F025 subscriber publishes to per-user channel**

Edit the F025 subscriber added in Stream 1 PR2: on relevant commits, ALSO publish to per-user Redis channel `hw:identity-events:{userId}`. The SSE controller subscribes to this channel for the connected user.

- [ ] **Step 4: Frontend subscriber — instance plane**

Create `apps/web-client/src/api/services/identity-events.ts`. On user login (or app boot if already authenticated): open EventSource to `/api/identity/me/events`. On each event: refetch `GET /users/me` → update auth context cache.

Fallbacks:
- On `visibilitychange` (tab focus): refetch `GET /users/me`.
- After any 403 response: refetch `GET /users/me`.
- On SSE disconnect: attempt reconnect with backoff.

- [ ] **Step 5: Frontend subscriber — control-plane**

Mirror at `apps/web-control-plane/src/api/services/auth-events.ts`. Endpoint `/api/auth/me/events`. Refetch `/auth/me` on event.

- [ ] **Step 6: Integration test**

Add `apps/api/test/integration/sse-invalidation.spec.ts`. Open SSE connection as user; trigger a RolePermission delete; assert event arrives within 1s; assert event payload kind is `permissionCodesChanged`.

- [ ] **Step 7: Manual browser test**

Start dev stack. As an authenticated user, open browser devtools → Network tab → confirm EventSource connection to `/api/identity/me/events`. Trigger a permission change via the admin UI (or directly in DB); observe the SSE event arrive; confirm the page refetches `/users/me` and UI reflects the updated permissions.

- [ ] **Step 8: Commit + PR**

```
git add apps/api/src/app/identity/sse/ apps/control-plane/src/app/auth/auth-me-events.controller.ts apps/web-client/src/api/services/ apps/web-control-plane/src/api/services/ libs/instance-db/src/lib/subscribers/ apps/api/test/integration/sse-invalidation.spec.ts
git commit -m "phase3-w2-stream4b: SSE invalidation channels + frontend subscribers"
gh pr create --title "phase3-w2-stream4b: SSE invalidation channels" --body "Per-plane SSE endpoints (/identity/me/events instance, /auth/me/events control-plane) push auth-relevant events (permissionCodesChanged, roleCodesChanged, sessionRevoked). Frontend subscribers refetch identity-self on event. Fallbacks: tab focus refetch, post-403 refetch. Narrow channel — NOT a general realtime framework. Integration test asserts ≤1s propagation."
```

### Task 40: Stream 4b — w2-validate.ts harness + required CI gate

**Files:**
- Create: `scripts/w2-validate.ts` — extends `scripts/prelude-validate.ts`
- Modify: `.github/workflows/ci.yml` — `w2:validate` as required status check

- [ ] **Step 1: Extend prelude-validate.ts shape**

`scripts/w2-validate.ts` imports and runs all `prelude-validate.ts` assertions PLUS the W2-specific additions.

- [ ] **Step 2: Add W2 happy-path assertions**

Per spec §"4.2.6 Boundary-consistency validation harness":
- Login as admin → `GET /api/users` → 200.
- Login as non-admin without `identity:user:manage` → `GET /api/users` → 403 with body matching `{ statusCode: 403, message: "Permission denied", code: "PERMISSION_DENIED" }` exactly.
- Admin with `authorization:explain:read` → `POST /api/authorization/explain/collection` with body `{ userId, collectionId, operation: 'read' }` → 200 with `DecisionProvenance`.
- Same admin → `POST /api/authorization/explain/field` with body `{ userId, collectionId, field: { code, isSystem } }` → 200 with `FieldDecisionProvenance`.
- `GET /api/data/collections/:collectionCode/data` → response carries `permissions.fields` map.
- Service-token scope test: token with `automation:invoke` scope hits the chosen automation endpoint annotated `@AllowServiceToken + @RequireServiceScope('automation:invoke')` → 200. Without scope claim → 403. Without `@AllowServiceToken` → 401.
- Service-token data-access test: token with `data:record:read` scope + ACL grant on the collection → 200. With scope but no ACL → 403. Without scope → 403. Without `@AllowServiceToken` → 401.
- Admin role retired → `permissionCodes` cache invalidates within 1s → next request to admin-only endpoint → 403.

- [ ] **Step 3: Add W2 negative-case assertions**

- HS256-style token (signed with old `JWT_SECRET`) presented to any endpoint on either plane → 401.
- Non-admin search → response excludes records the user lacks `read` on; facet counts match visible corpus; pagination has no skipped indexes.
- Dashboard fetch as user lacking widget collection access → layout returns with denied widget stripped; one audit row with `droppedWidgetCount` > 0.
- AVA chat orchestration with simulated step-5 failure → conversation state = pre-call state.
- Audit chain after 50 concurrent transactions × 10 inserts → length 500, no gaps.
- Bare `@Roles('admin')` handler artificially injected → AST coverage scanner fails CI.
- Unannotated handler artificially injected: with `HW_LOUD_AUTH_MISCONFIG=true` → 500; without → 403 + RuntimeAnomaly recorded.

- [ ] **Step 4: Wire as required CI gate**

Edit `.github/workflows/ci.yml`: add `w2:validate` job. Triggers on PRs touching `apps/api/**`, `apps/control-plane/**`, `libs/authorization/**`, `libs/auth-guard/**`, `libs/permission-registry/**`, or either web client. Required status check.

- [ ] **Step 5: Run harness end-to-end**

```
npm run w2:validate
```
Expected: all assertions pass.

- [ ] **Step 6: Commit + PR**

```
git add scripts/w2-validate.ts .github/workflows/ci.yml package.json
git commit -m "phase3-w2-stream4b: w2-validate.ts boundary-consistency harness + required CI gate"
gh pr create --title "phase3-w2-stream4b: w2-validate.ts harness" --body "Extends prelude-validate.ts with W2-specific assertions: 401/403 shapes, /authorization/explain provenance, permissions.fields payload, service-token scope+ACL layers, cache invalidation propagation, HS256 rejection, search corpus/facet/pagination accuracy, dashboard widget drop count, AVA chat rollback, audit chain integrity, scanner enforcement, unannotated-handler runtime behavior. Required CI status check."
```

### Stream 4 exit gate

After all 9 PRs (Tasks 32-40) merged:
- [ ] F042 stress test green (50 concurrent × 10 inserts, no gaps).
- [ ] F052 transactionality rollback test green at every failure injection point.
- [ ] F146 dashboard widget authz integration test green; `KNOWN_BYPASSES` F146 entry deleted.
- [ ] F136 search corpus/facet/pagination accuracy green on both Typesense and pgvector.
- [ ] F091 frontend tests green: hidden field, masked value, read-only field, denied widget on dashboard.
- [ ] F102 frontend 401/403 UX tests green on both clients.
- [ ] SSE invalidation: backend permission change → frontend refresh within 1s.
- [ ] Audit provenance present on every 403 outcome (sampled integration test).
- [ ] `w2-validate.ts` happy + negative paths all green.

---

## Task 41: W2 close PR — canon §24 summary amendment + freeze release

**Files:**
- Update: `CLAUDE.md` §24 — amendment-log entry summarizing W2

- [ ] **Step 1: Confirm all stream exit gates green**

Run all scanners + harness:
```
$checks = @(
  'authz:check', 'audit:check', 'security:check', 'service-boundary:check',
  'deps:check', 'dead-code:check', 'permission-registry:check',
  'route-boundary:check', 'no-hs256:check', 'service-token:check',
  'no-untyped-req:check', 'prelude:validate', 'w2:validate'
)
foreach ($c in $checks) {
  npm run $c
  if ($LASTEXITCODE -ne 0) { throw "$c failed — W2 close blocked" }
}
```
Expected: all green.

- [ ] **Step 2: Confirm all per-stream canon amendments landed**

```
git log --grep="canon §9\|canon §21\|canon §28.6\|canon §29.6\|canon §29.7" --since="2 months ago"
```
Expected: 5+ commits across the streams matching the per-stream amendment list.

- [ ] **Step 3: Add W2 close summary to CLAUDE.md §24**

Edit `CLAUDE.md` §24 amendment log. Add a new top-most entry (chronological — most recent first per existing convention):

```
- 2026-XX-XX (Phase 3 W2 — Platform Integrity complete): boundary-
  consistency wave delivered. Principal contract (roleIds + roleCodes
  + permissionCodes; JWT carries no roles/permissions; IdentityResolver
  per-request authority). Control-plane on ES256/JWKS (canon §29.9
  uniform across planes). Permission registry as canonical source-
  of-truth with materialized DB projection. Four primary boundary
  decorators (@RequirePermission, @RequireCollectionAccess,
  @AuthenticatedOnly, @Public) at 100% coverage; @Roles auxiliary
  only. PermissionsGuard hard deny (warn-and-allow retired).
  secureFieldsByDefault=TRUE; full default-deny landed (supersedes
  §28.9 W3+ deferral). Search admin allow_all retired; §28 evaluator
  produces unified Typesense + pgvector authz AST. F042/F052/F146
  verified or closed. Frontend field-permission wiring + 401/403 UX
  on both web clients. SSE invalidation channels per plane. Audit
  provenance written by guards through AccessAuditPort.logAccessDenied
  (port relocated to libs/auth-guard to avoid lib cycle). New scanners
  (no-hs256, service-token-default-deny, no-untyped-req, route-
  boundary-coverage AST, permission-registry-sync) wired as required
  CI gates. Refs Phase 3 governing spec + W2 design at
  docs/superpowers/specs/2026-05-15-phase3-w2-platform-integrity-
  design.md.
```

Per-stream amendment entries already landed individually; this entry summarizes.

- [ ] **Step 4: Release W2 Freeze**

Open a GitHub Project board update or PR description noting: W2 Freeze rule released. Any PRs labeled `w2-freeze-queued` can now merge. Notify any contributors who queued non-W2 work.

- [ ] **Step 5: Tag W2 complete**

```
git tag -a phase3-w2-complete -m "Phase 3 W2 — Platform Integrity complete. Boundary consistency across authz/identity/audit/search/service-to-service/frontend. All exit gates green. Canon §9, §21, §28.6, §29.6, §29.7 amended. Ready for W3 — Shared Platform Runtime + SDK Foundation."
git push origin phase3-w2-complete
```

- [ ] **Step 6: Commit + PR**

```
git add CLAUDE.md
git commit -m "phase3-w2: close — canon §24 summary amendment + release W2 freeze"
gh pr create --title "phase3-w2: close PR" --body "All four streams' exit gates verified green. Canon §24 amendment-log entry summarizes W2 deliverables. W2 Freeze rule released. Tag phase3-w2-complete pushed. Ready for W3 brainstorm cycle."
```

- [ ] **Step 7: Update PLATFORM-ROADMAP.md + RESUME-CONTEXT.md**

In a follow-up commit (or same PR), update the two roadmap docs to reflect W2 completion. List W2 in "What's done" sections.

---

## Plan completion checklist

- [ ] Pre-W2 Gate (Tasks 1-6) merged to master.
- [ ] Stream 1 (Tasks 7-12) merged, exit gate green.
- [ ] Stream 2 (Tasks 13-18) merged, exit gate green.
- [ ] Stream 3 (Tasks 19-31) merged, exit gate green; AST coverage at 100%.
- [ ] Stream 4 (Tasks 32-40) merged, exit gate green; w2-validate green.
- [ ] W2 close (Task 41) merged.
- [ ] `phase3-w2-complete` tag pushed.
- [ ] PLATFORM-ROADMAP.md + RESUME-CONTEXT.md updated.

---

## Notes for executing agents

**Subagent-driven recommended for Tasks 20-30 (annotation sweeps)** — each per-area sweep is independent, mechanical work suited to fresh-subagent dispatches with the spec + this plan in scope.

**Inline execution preferable for cross-stream tasks** (Tasks 7, 9, 18, 31, 40, 41) — these touch multiple files across libs + apps + canon and benefit from a session-level review at each step.

**Stream 4a tasks 32-34 can be dispatched in parallel** with Stream 1 work — disjoint code paths, no contract dependency.

**Cache awareness across the session:** when a task says "wait up to 1s for cache invalidation," set CI test timeouts accordingly to avoid false flakes.

**Verification before completion:** every task ends with running specific scanners or tests. Do NOT claim completion without running them; do NOT claim completion if any fail. Per CLAUDE.md superpowers `verification-before-completion`: evidence before assertions, always.

---

**End of W2 implementation plan.**
