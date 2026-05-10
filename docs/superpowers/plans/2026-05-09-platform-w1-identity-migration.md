# Platform W1 Identity Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the entire `apps/svc-identity` Nest application (15 sub-modules + 3 top-level files = ~17k LoC across 105 files) into `apps/api/src/app/identity/`, sub-module by sub-module, using `git mv` to preserve history and keeping `apps/svc-identity` runnable in parallel via a thin adapter at the end.

**Architecture:** Each sub-module migrates as its own commit using the template `git mv apps/svc-identity/src/app/<sub> apps/api/src/app/identity/<sub>` + update both apps' module composition + verify both apps still build. After all 15 sub-modules + the 3 top-level files migrate, `apps/svc-identity/src/app/app.module.ts` becomes a one-line wrapper that imports `IdentityModule` from `apps/api`. The legacy service stays runnable for parallel-deployment until full W1 cutover.

**Tech Stack:** TypeScript 5.9, NestJS 11 (modules + global guards + interceptors + middleware), TypeORM 0.3, Postgres, Nx 22 monorepo, Jest 30. Existing platform deps: `@hubblewave/auth-guard`, `@hubblewave/authorization`, `@hubblewave/instance-db`.

**Spec reference:** `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §2 (target architecture) + §9 (canon delta).

**Predecessor plan:** `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md` (status `arc-w1-foundation-partial` at HEAD `bffef2f`). That plan landed kernel + db + audit module wrappers; this plan continues by migrating identity.

**Solo founder, ~2–3 weeks of work.** ~20 bite-sized tasks. Each task is independently reversible; you can pause at any commit boundary and resume later.

---

## Sub-module inventory (measured 2026-05-09)

The migration order respects the cross-module dependency graph: leaf sub-modules first, integrators last.

| Sub-module | Files | LoC | Specs | Migration order | Notes |
|---|---|---|---|---|---|
| `common` | 1 | 62 | 0 | 1 | LoggingInterceptor + utilities; smallest, used everywhere |
| `config` | 3 | 215 | 0 | 2 | SettingsModule (per-instance config) |
| `email` | 2 | 216 | 0 | 3 | Email sending used by auth invites, password reset |
| `auth` | 50 | 8974 | 3 | 4 | The big one — JWT/OIDC/SAML/MFA/API-key strategies + global guards + CsrfMiddleware |
| `abac` | 3 | 181 | 0 | 5 | Attribute-based access control evaluator + AbacGuard |
| `policies` | 3 | 528 | 0 | 6 | Policy engine used by ABAC |
| `users` | 3 | 677 | 0 | 7 | User CRUD |
| `roles` | 10 | 2266 | 2 | 8 | Role CRUD with hierarchy |
| `groups` | 6 | 1689 | 0 | 9 | Group CRUD |
| `iam` | 2 | 80 | 0 | 10 | Combined users/roles/groups facade |
| `ldap` | 3 | 137 | 0 | 11 | LDAP integration |
| `oidc` | 4 | 506 | 0 | 12 | OIDC integration |
| `navigation` | 9 | 929 | 0 | 13 | Per-role navigation/menu |
| `ui` | 3 | 215 | 0 | 14 | Theme + branding |
| `audit` | 3 | 421 | 0 | 15 | Audit READ controllers (audit-events + audit-logs) |
| **Top-level: health.controller.ts** | 1 | ~30 | 0 | 16 | `/health` endpoint |
| **Top-level: identity.service.ts** | 1 | ~50 | 0 | 16 | Top-level coordinating service |
| **Top-level: app.module.ts** | 1 | 99 | 0 | 17 | Module composition + global guards + middleware |
| **Total** | **105** | **~17,196** | **5** | | |

---

## Files Created/Modified Overview

### Per task (template — applies to every sub-module migration task)

**Modified:**
- `apps/svc-identity/src/app/app.module.ts` — change `from './<sub>/<sub>.module'` to `from '../../../api/src/app/identity/<sub>/<sub>.module'` for the sub-module being migrated
- `apps/api/src/app/identity/identity.module.ts` — add the migrated sub-module to its imports array

**Moved (`git mv`):**
- `apps/svc-identity/src/app/<sub>/` → `apps/api/src/app/identity/<sub>/`

### Plan-end state

- `apps/api/src/app/identity/` contains all 15 sub-modules + identity.module.ts + identity-level controllers/services
- `apps/api/src/app/app.module.ts` registers `IdentityModule` after `AuditModule`
- `apps/svc-identity/src/app/app.module.ts` is a thin wrapper that imports IdentityModule from apps/api (one line of substantive code)
- `apps/svc-identity/src/main.ts` and `project.json` remain unchanged; legacy service stays runnable
- Legacy service deletion is deferred to the W1 final-cutover plan (not this one)

---

## Task 1: Create apps/api/src/app/identity skeleton

**Files:**
- Create: `apps/api/src/app/identity/identity.module.ts` (empty composition)
- Modify: `apps/api/src/app/app.module.ts` (register IdentityModule)

**Why this matters:** Establishes the destination module. All subsequent sub-module migrations register themselves into this skeleton's imports array.

- [ ] **Step 1: Verify working directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD && git log --oneline -1
```
Expected: `pwd` ends with `nervous-volhard-f9abc2`; branch `claude/nervous-volhard-f9abc2`; HEAD `bffef2f` (audit module commit).

- [ ] **Step 2: Create the directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && mkdir -p apps/api/src/app/identity
```

- [ ] **Step 3: Create identity.module.ts skeleton**

Write `apps/api/src/app/identity/identity.module.ts`:

```typescript
import { Module } from '@nestjs/common';

/**
 * IdentityModule consolidates everything from apps/svc-identity into the
 * apps/api modular monolith. Sub-modules migrate one at a time via git mv;
 * each migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md):
 *   [ ] common
 *   [ ] config
 *   [ ] email
 *   [ ] auth
 *   [ ] abac
 *   [ ] policies
 *   [ ] users
 *   [ ] roles
 *   [ ] groups
 *   [ ] iam
 *   [ ] ldap
 *   [ ] oidc
 *   [ ] navigation
 *   [ ] ui
 *   [ ] audit
 *   [ ] top-level (health controller + IdentityService + global guards/middleware)
 *
 * IdentityModule re-exports each migrated sub-module so that:
 * - apps/api consumers (data, automation, etc.) can inject identity services
 *   like UsersService, RolesService, AuthService without explicit sub-module imports
 * - apps/svc-identity's thin adapter (post-migration) can import IdentityModule
 *   wholesale to keep the legacy service serving the same endpoints
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class IdentityModule {}
```

- [ ] **Step 4: Register IdentityModule in apps/api AppModule**

Edit `apps/api/src/app/app.module.ts`. Currently:

```typescript
import { Module } from '@nestjs/common';
import { KernelModule } from './kernel/kernel.module';
import { DbModule } from './db/db.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [KernelModule, DbModule, AuditModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

Add `import { IdentityModule } from './identity/identity.module';` after the AuditModule import; change the imports array to `[KernelModule, DbModule, AuditModule, IdentityModule]`.

- [ ] **Step 5: Verify build**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api
```
Expected: build succeeds (the empty IdentityModule has no providers; pure scaffolding).

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/src/app/identity/ apps/api/src/app/app.module.ts && git commit -m "$(cat <<'EOF'
feat(api): create empty IdentityModule skeleton in apps/api

ARC-W1-identity task 1. Empty IdentityModule registered in AppModule;
sub-modules migrate into it one at a time via subsequent tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Per-sub-module migration template

Tasks 2–16 follow this exact pattern. The pattern is repeated explicitly in each task body — do not skip steps even if they look the same.

**For each sub-module `<sub>` (where `<sub>` ∈ {common, config, email, auth, abac, policies, users, roles, groups, iam, ldap, oidc, navigation, ui, audit}):**

1. Verify working directory
2. `git mv apps/svc-identity/src/app/<sub> apps/api/src/app/identity/<sub>`
3. Update svc-identity's app.module.ts: replace `from './<sub>/<sub>.module'` with `from '../../../api/src/app/identity/<sub>/<sub>.module'`
4. Update apps/api's identity.module.ts: add the sub-module to the imports array; uncheck the migration progress checkbox
5. Run `nx build api` and `nx build svc-identity` — both must succeed
6. If sub-module has spec files: run `nx test api` (will run the moved specs in their new home) — all must pass
7. Commit

The task bodies below provide sub-module-specific details, but the pattern is the same.

---

## Task 2: Migrate `common` (LoggingInterceptor + utilities)

**Sub-module size:** 1 file, 62 LoC, 0 specs. Smallest sub-module — good first migration to validate the pattern.

**Why this matters:** `common` is imported by app.module.ts (LoggingInterceptor for APP_INTERCEPTOR) and used as the catch-all for shared decorators/utilities. Migrating first means subsequent sub-modules can already reference the new location.

- [ ] **Step 1: Verify**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD
```

- [ ] **Step 2: Move the directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-identity/src/app/common apps/api/src/app/identity/common
```

- [ ] **Step 3: Identify svc-identity imports referencing common**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -rn "from './common" apps/svc-identity/src --include="*.ts"
```
Expected: matches in `apps/svc-identity/src/app/app.module.ts` (LoggingInterceptor import) and possibly other files.

- [ ] **Step 4: Update svc-identity import paths**

Use the Edit tool to update each match found in step 3. Replace `from './common/<rest>'` with `from '../../../api/src/app/identity/common/<rest>'`. (No CommonModule exists — common provides individual classes/utilities; the import path update is per-file.)

If the only consumer is `app.module.ts` line `import { LoggingInterceptor } from './common/interceptors/logging.interceptor';`, the new import is `from '../../../api/src/app/identity/common/interceptors/logging.interceptor'`.

- [ ] **Step 5: Update apps/api/src/app/identity/identity.module.ts**

Edit identity.module.ts to:
- Mark the common checkbox in the migration-progress comment as `[x]`
- (No module to import — common doesn't have a Nest module; consumers import its classes directly)

The imports array stays empty after this task; common is a non-Nest-module sub-directory.

- [ ] **Step 6: Verify both apps build**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api && npx nx build svc-identity
```
Both must succeed.

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/src/app/identity/common/ apps/api/src/app/identity/identity.module.ts apps/svc-identity/src/app/ && git commit -m "$(cat <<'EOF'
feat(api): migrate common/ from svc-identity into apps/api/identity

ARC-W1-identity task 2. LoggingInterceptor + utilities moved via git mv.
svc-identity's app.module.ts now references common via the new path;
apps/api consumers can also import from the new location. Both apps build.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migrate `config` (SettingsModule)

**Sub-module size:** 3 files, 215 LoC, 0 specs.

**Why this matters:** SettingsModule provides per-instance configuration (theme defaults, branding, feature flags). Used by several other sub-modules (ui, navigation, etc.). Migrating early prevents downstream cascade.

- [ ] **Step 1: Verify**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD
```

- [ ] **Step 2: Move the directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-identity/src/app/config apps/api/src/app/identity/config
```

- [ ] **Step 3: Identify svc-identity imports referencing config**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -rn "from './config" apps/svc-identity/src --include="*.ts"
```
Expected: at least one match in app.module.ts (`import { SettingsModule } from './config/config.module';`).

- [ ] **Step 4: Update svc-identity import paths**

Replace `from './config/config.module'` with `from '../../../api/src/app/identity/config/config.module'`. Also update any other matches.

- [ ] **Step 5: Update apps/api identity.module.ts**

Add `import { SettingsModule } from './config/config.module';` and add `SettingsModule` to the imports array. Mark config checkbox as `[x]`.

- [ ] **Step 6: Verify both apps build**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api && npx nx build svc-identity
```

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/ apps/svc-identity/ && git commit -m "$(cat <<'EOF'
feat(api): migrate config/ (SettingsModule) from svc-identity into apps/api/identity

ARC-W1-identity task 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Migrate `email` (EmailModule)

**Sub-module size:** 2 files, 216 LoC, 0 specs.

**Why this matters:** EmailModule sends emails for password reset, MFA verification, user invites. Used by auth (next migration). Migrate before auth.

- [ ] **Step 1–7: Apply the migration template**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-identity/src/app/email apps/api/src/app/identity/email
```

Update svc-identity imports of `./email/email.module` to point at `../../../api/src/app/identity/email/email.module`. In apps/api identity.module.ts, add `import { EmailModule } from './email/email.module';` and register in imports. Mark email checkbox `[x]`. Build both apps. Commit:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate email/ (EmailModule) from svc-identity into apps/api/identity

ARC-W1-identity task 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Migrate `auth` (the big one — 50 files, 8,974 LoC)

**Sub-module size:** 50 files, 8,974 LoC, 3 specs. Contains JWT/OIDC/SAML/MFA/API-key strategies, global guards (JwtAuthGuard, RolesGuard, PermissionsGuard, ApiKeyGuard, AbacGuard hooks), CsrfMiddleware, password reset, refresh tokens, sessions.

**Why this matters:** auth is the largest single migration. Many imports across svc-identity reference `./auth/...` — they all need updating. Take your time on this task; verify carefully.

**Special considerations:**
- The `@Inject` patterns inside auth/ may use string tokens; preserve them.
- `apps/svc-identity/src/app/app.module.ts` has APP_GUARD providers (JwtAuthGuard, RolesGuard, PermissionsGuard, ApiKeyGuard, AbacGuard) — these stay in svc-identity's app.module.ts FOR NOW (the global guards activate when svc-identity bootstraps). They migrate in Task 17 (top-level migration).
- CsrfMiddleware is referenced in svc-identity's app.module.ts via `consumer.apply(CsrfMiddleware).forRoutes('*')` — CsrfMiddleware itself moves with auth/, but the `apply` call stays in svc-identity's app.module.ts and now imports CsrfMiddleware from the new location.

- [ ] **Step 1: Verify**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD
```

- [ ] **Step 2: Move the directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-identity/src/app/auth apps/api/src/app/identity/auth
```

- [ ] **Step 3: Identify ALL svc-identity imports referencing auth**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -rn "from './auth" apps/svc-identity/src --include="*.ts"
```
Expected: many matches in app.module.ts (CsrfMiddleware, JwtAuthGuard, RolesGuard, PermissionsGuard, ApiKeyGuard, AuthModule) plus any other sub-modules that reference auth (likely groups, roles, navigation).

For each match, the replacement is `from '../../../api/src/app/identity/auth/<rest>'` (preserving the path segment after `./auth/`).

- [ ] **Step 4: Update svc-identity import paths**

For each file with matches, use the Edit tool to update the relative paths. There may be ~10–20 files to touch. Work through them systematically.

To find files needing updates:
```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -rln "from './auth" apps/svc-identity/src --include="*.ts"
```

For each file in that list, use Edit to replace `'./auth` with `'../../../api/src/app/identity/auth` (preserving the rest of the path).

- [ ] **Step 5: Verify no orphan auth imports remain in svc-identity**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -rn "from './auth" apps/svc-identity/src --include="*.ts"
```
Expected: zero matches. If any remain, fix them.

- [ ] **Step 6: Update apps/api identity.module.ts**

Add `import { AuthModule } from './auth/auth.module';` and register `AuthModule` in imports. Mark auth checkbox `[x]`.

If the migrated auth sub-module references `@hubblewave/auth-guard`'s `AuthGuardModule`, that import keeps working (libs are unchanged). If app.module.ts of svc-identity also imports AuthGuardModule directly, that stays — it's a libs import.

- [ ] **Step 7: Verify both apps build**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api && npx nx build svc-identity
```

If build fails with "Module not found" for an auth/* path, return to step 5 and find the missing import update.

- [ ] **Step 8: Run tests**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx test api
```
Expected: 7 tests still pass (kernel + db + audit) plus 3 new auth tests pass — 10 total.

- [ ] **Step 9: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/ apps/svc-identity/ && git commit -m "$(cat <<'EOF'
feat(api): migrate auth/ from svc-identity into apps/api/identity

ARC-W1-identity task 5. Largest single migration: 50 files, ~9k LoC,
3 specs. JWT/OIDC/SAML/MFA/API-key strategies + CsrfMiddleware + global
guard classes relocated. svc-identity's app.module.ts updated to import
guards/middleware from the new path; APP_GUARD provider declarations stay
in svc-identity for now (migrate to apps/api in task 17 top-level).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Tasks 6–15: Remaining sub-modules

The remaining 10 sub-modules (`abac`, `policies`, `users`, `roles`, `groups`, `iam`, `ldap`, `oidc`, `navigation`, `ui`) follow the same template as tasks 2–5. Each task body is repeated explicitly below.

### Task 6: Migrate `abac` (3 files, 181 LoC)

**Why this matters:** AbacModule provides ABAC evaluator + AbacGuard. Used as a global guard via APP_GUARD in app.module.ts.

- [ ] **Step 1: Verify**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD
```

- [ ] **Step 2: Move**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-identity/src/app/abac apps/api/src/app/identity/abac
```

- [ ] **Step 3: Find imports**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -rln "from './abac" apps/svc-identity/src --include="*.ts"
```

- [ ] **Step 4: Update svc-identity imports** — replace `'./abac` with `'../../../api/src/app/identity/abac` in each matching file.

- [ ] **Step 5: Update apps/api identity.module.ts** — add `import { AbacModule } from './abac/abac.module';`, register in imports, mark abac checkbox `[x]`.

- [ ] **Step 6: Build both apps**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api && npx nx build svc-identity
```

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate abac/ from svc-identity into apps/api/identity

ARC-W1-identity task 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7: Migrate `policies` (3 files, 528 LoC)

- [ ] **Verify** working directory.
- [ ] **Move**: `git mv apps/svc-identity/src/app/policies apps/api/src/app/identity/policies`
- [ ] **Find imports**: `grep -rln "from './policies" apps/svc-identity/src --include="*.ts"`
- [ ] **Update svc-identity imports** — replace `'./policies` with `'../../../api/src/app/identity/policies` in each file.
- [ ] **Update identity.module.ts** — add `import { PoliciesModule } from './policies/policies.module';`, register, mark `[x]`.
- [ ] **Build both apps**: `npx nx build api && npx nx build svc-identity`
- [ ] **Commit**:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate policies/ from svc-identity into apps/api/identity

ARC-W1-identity task 7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 8: Migrate `users` (3 files, 677 LoC)

- [ ] **Verify** working directory.
- [ ] **Move**: `git mv apps/svc-identity/src/app/users apps/api/src/app/identity/users`
- [ ] **Find imports**: `grep -rln "from './users" apps/svc-identity/src --include="*.ts"`
- [ ] **Update svc-identity imports** — replace `'./users` with `'../../../api/src/app/identity/users` in each file. (Note: app.module.ts has `import { UsersModule } from './users/users.module';` — this is one match.)
- [ ] **Update identity.module.ts** — add `import { UsersModule } from './users/users.module';`, register, mark `[x]`.
- [ ] **Build both apps**: `npx nx build api && npx nx build svc-identity`
- [ ] **Commit**:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate users/ from svc-identity into apps/api/identity

ARC-W1-identity task 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 9: Migrate `roles` (10 files, 2,266 LoC, 2 specs)

**Why this matters:** RolesModule has role hierarchy + RolesGuard binding (referenced in app.module.ts APP_GUARD). Has 2 specs that need to keep passing after the move.

- [ ] **Verify** working directory.
- [ ] **Move**: `git mv apps/svc-identity/src/app/roles apps/api/src/app/identity/roles`
- [ ] **Find imports**: `grep -rln "from './roles" apps/svc-identity/src --include="*.ts"`
- [ ] **Update svc-identity imports** — replace `'./roles` with `'../../../api/src/app/identity/roles` in each file.
- [ ] **Update identity.module.ts** — add `import { RolesModule } from './roles/roles.module';`, register, mark `[x]`.
- [ ] **Build both apps**: `npx nx build api && npx nx build svc-identity`
- [ ] **Run tests**: `npx nx test api` — expected: 9+ tests passing (3 kernel + 2 db + 2 audit + 2 roles after move).
- [ ] **Commit**:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate roles/ from svc-identity into apps/api/identity

ARC-W1-identity task 9. 2 specs migrate with the source files; verified passing in apps/api.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10: Migrate `groups` (6 files, 1,689 LoC)

- [ ] **Verify** working directory.
- [ ] **Move**: `git mv apps/svc-identity/src/app/groups apps/api/src/app/identity/groups`
- [ ] **Find imports**: `grep -rln "from './groups" apps/svc-identity/src --include="*.ts"`
- [ ] **Update svc-identity imports** — replace `'./groups` with `'../../../api/src/app/identity/groups` in each file.
- [ ] **Update identity.module.ts** — add `import { GroupsModule } from './groups/groups.module';`, register, mark `[x]`.
- [ ] **Build both apps**: `npx nx build api && npx nx build svc-identity`
- [ ] **Commit**:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate groups/ from svc-identity into apps/api/identity

ARC-W1-identity task 10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 11: Migrate `iam` (2 files, 80 LoC)

- [ ] **Verify** working directory.
- [ ] **Move**: `git mv apps/svc-identity/src/app/iam apps/api/src/app/identity/iam`
- [ ] **Find imports**: `grep -rln "from './iam" apps/svc-identity/src --include="*.ts"`
- [ ] **Update svc-identity imports** — replace `'./iam` with `'../../../api/src/app/identity/iam` in each file.
- [ ] **Update identity.module.ts** — add `import { IamModule } from './iam/iam.module';`, register, mark `[x]`.
- [ ] **Build both apps**: `npx nx build api && npx nx build svc-identity`
- [ ] **Commit**:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate iam/ from svc-identity into apps/api/identity

ARC-W1-identity task 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 12: Migrate `ldap` (3 files, 137 LoC)

- [ ] **Verify** working directory.
- [ ] **Move**: `git mv apps/svc-identity/src/app/ldap apps/api/src/app/identity/ldap`
- [ ] **Find imports**: `grep -rln "from './ldap" apps/svc-identity/src --include="*.ts"`
- [ ] **Update svc-identity imports** — replace `'./ldap` with `'../../../api/src/app/identity/ldap` in each file.
- [ ] **Update identity.module.ts** — add `import { LdapModule } from './ldap/ldap.module';` (verify the module class name in the moved files; if it's exported under a different name, use that), register, mark `[x]`.
- [ ] **Build both apps**: `npx nx build api && npx nx build svc-identity`
- [ ] **Commit**:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate ldap/ from svc-identity into apps/api/identity

ARC-W1-identity task 12.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 13: Migrate `oidc` (4 files, 506 LoC)

- [ ] **Verify** working directory.
- [ ] **Move**: `git mv apps/svc-identity/src/app/oidc apps/api/src/app/identity/oidc`
- [ ] **Find imports**: `grep -rln "from './oidc" apps/svc-identity/src --include="*.ts"`
- [ ] **Update svc-identity imports** — replace `'./oidc` with `'../../../api/src/app/identity/oidc` in each file.
- [ ] **Update identity.module.ts** — add `import { OidcModule } from './oidc/oidc.module';`, register, mark `[x]`.
- [ ] **Build both apps**: `npx nx build api && npx nx build svc-identity`
- [ ] **Commit**:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate oidc/ from svc-identity into apps/api/identity

ARC-W1-identity task 13.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 14: Migrate `navigation` (9 files, 929 LoC)

- [ ] **Verify** working directory.
- [ ] **Move**: `git mv apps/svc-identity/src/app/navigation apps/api/src/app/identity/navigation`
- [ ] **Find imports**: `grep -rln "from './navigation" apps/svc-identity/src --include="*.ts"`
- [ ] **Update svc-identity imports** — replace `'./navigation` with `'../../../api/src/app/identity/navigation` in each file.
- [ ] **Update identity.module.ts** — add `import { NavigationModule } from './navigation/navigation.module';`, register, mark `[x]`.
- [ ] **Build both apps**: `npx nx build api && npx nx build svc-identity`
- [ ] **Commit**:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate navigation/ from svc-identity into apps/api/identity

ARC-W1-identity task 14.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 15: Migrate `ui` (3 files, 215 LoC)

- [ ] **Verify** working directory.
- [ ] **Move**: `git mv apps/svc-identity/src/app/ui apps/api/src/app/identity/ui`
- [ ] **Find imports**: `grep -rln "from './ui" apps/svc-identity/src --include="*.ts"`
- [ ] **Update svc-identity imports** — replace `'./ui` with `'../../../api/src/app/identity/ui` in each file.
- [ ] **Update identity.module.ts** — add `import { UiModule } from './ui/ui.module';`, register, mark `[x]`.
- [ ] **Build both apps**: `npx nx build api && npx nx build svc-identity`
- [ ] **Commit**:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate ui/ from svc-identity into apps/api/identity

ARC-W1-identity task 15.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 16: Migrate `audit` (3 files, 421 LoC)

**Why this matters:** This is the audit READ controllers (audit-events.controller.ts, audit-logs.controller.ts) that were deferred from the foundation slice's audit task. They depend on InstanceDbModule (queries audit_log table for the UI).

- [ ] **Verify** working directory.
- [ ] **Move**: `git mv apps/svc-identity/src/app/audit apps/api/src/app/identity/audit`

(Note: this directory is named `audit` and will go inside `apps/api/src/app/identity/audit/`. The TOP-LEVEL audit module — `apps/api/src/app/audit/` — is for the AuditModule wrapper around RuntimeAnomalyModule from the foundation slice. They're different namespaces.)

- [ ] **Find imports**: `grep -rln "from './audit" apps/svc-identity/src --include="*.ts"`
- [ ] **Update svc-identity imports** — replace `'./audit` with `'../../../api/src/app/identity/audit` in each file.
- [ ] **Update identity.module.ts** — add `import { AuditModule as IdentityAuditModule } from './audit/audit.module';` (alias to avoid conflict with the top-level AuditModule), register `IdentityAuditModule` in imports, mark `[x]`.

To prevent confusion, also add a comment in identity.module.ts:

```typescript
// IdentityAuditModule provides the audit READ controllers (audit-events,
// audit-logs). Distinct from the top-level apps/api/src/app/audit/AuditModule
// which is the wrapper around RuntimeAnomalyModule for runtime anomaly tracking.
import { AuditModule as IdentityAuditModule } from './audit/audit.module';
```

- [ ] **Build both apps**: `npx nx build api && npx nx build svc-identity`
- [ ] **Commit**:

```bash
git add apps/api/ apps/svc-identity/ && git commit -m "feat(api): migrate audit/ READ controllers from svc-identity into apps/api/identity

ARC-W1-identity task 16. The audit-events + audit-logs REST controllers
relocate; the top-level apps/api/src/app/audit/AuditModule (RuntimeAnomaly
wrapper from foundation slice) is unchanged. Aliased as IdentityAuditModule
in identity.module.ts to avoid name collision.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Migrate top-level files + svc-identity thin adapter

**Files:**
- Move: `apps/svc-identity/src/app/health.controller.ts` → `apps/api/src/app/identity/health.controller.ts`
- Move: `apps/svc-identity/src/app/identity.service.ts` → `apps/api/src/app/identity/identity.service.ts`
- Modify: `apps/api/src/app/identity/identity.module.ts` (final composition: register HealthController, IdentityService, all global guards/interceptors/middleware)
- Replace: `apps/svc-identity/src/app/app.module.ts` (becomes thin wrapper)

**Why this matters:** The 15 sub-modules are migrated; the top-level files (HealthController, IdentityService) and global wiring (guards, throttler, CSRF middleware, ConfigModule) need to relocate to apps/api/identity. After this task, svc-identity's app.module.ts is one-line trivial — just imports IdentityModule from apps/api.

- [ ] **Step 1: Verify**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD && ls apps/svc-identity/src/app/
```
Expected: `app.module.ts`, `health.controller.ts`, `identity.service.ts` are the only files left at the top level (sub-directories all migrated).

- [ ] **Step 2: Move HealthController and IdentityService**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-identity/src/app/health.controller.ts apps/api/src/app/identity/health.controller.ts && git mv apps/svc-identity/src/app/identity.service.ts apps/api/src/app/identity/identity.service.ts
```

- [ ] **Step 3: Rewrite apps/api/src/app/identity/identity.module.ts as the final composition**

Read the current `apps/svc-identity/src/app/app.module.ts` (it should still have the @Module decorator with all the global wiring). Now overwrite `apps/api/src/app/identity/identity.module.ts` with a version that absorbs:

- All sub-module imports (already present from tasks 2–16)
- ConfigModule.forRoot
- ThrottlerModule.forRootAsync
- InstanceDbModule, AuthGuardModule (lib imports — keep)
- HealthController as controller
- All APP_GUARD providers (ThrottlerGuard, ApiKeyGuard, JwtAuthGuard, RolesGuard, PermissionsGuard, AbacGuard)
- APP_INTERCEPTOR provider (LoggingInterceptor)
- IdentityService and CsrfMiddleware as providers
- The `configure(consumer: MiddlewareConsumer)` method applying CsrfMiddleware to `*`

The structure should mirror the original svc-identity app.module.ts but with import paths adjusted to `./` (relative to identity/) instead of `./<sub>/...`.

A reference for what the file should look like (adjust to match the actual current content of svc-identity's app.module.ts):

```typescript
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AuthGuardModule } from '@hubblewave/auth-guard';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OidcModule } from './oidc/oidc.module';
import { EmailModule } from './email/email.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ApiKeyGuard } from './auth/api-key/api-key.guard';
import { AbacModule } from './abac/abac.module';
import { SettingsModule } from './config/config.module';
import { AbacGuard } from './abac/abac.guard';
import { UiModule } from './ui/ui.module';
import { HealthController } from './health.controller';
import { IamModule } from './iam/iam.module';
import { NavigationModule } from './navigation/navigation.module';
import { GroupsModule } from './groups/groups.module';
import { RolesModule } from './roles/roles.module';
import { AuditModule as IdentityAuditModule } from './audit/audit.module';
import { PoliciesModule } from './policies/policies.module';
import { LdapModule } from './ldap/ldap.module';
import { CsrfMiddleware } from './auth/middleware/csrf.middleware';
import { IdentityService } from './identity.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: config.get<number>('RATE_LIMIT_TTL', 60000),
        limit: config.get<number>('RATE_LIMIT_MAX', 100),
      }]),
    }),
    InstanceDbModule,
    AuthGuardModule,
    UsersModule,
    AuthModule,
    OidcModule,
    EmailModule,
    AbacModule,
    SettingsModule,
    UiModule,
    IamModule,
    NavigationModule,
    GroupsModule,
    RolesModule,
    IdentityAuditModule,
    PoliciesModule,
    LdapModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: AbacGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    IdentityService,
    CsrfMiddleware,
  ],
  exports: [
    UsersModule, AuthModule, OidcModule, EmailModule, AbacModule, SettingsModule,
    UiModule, IamModule, NavigationModule, GroupsModule, RolesModule,
    IdentityAuditModule, PoliciesModule, LdapModule, AuthGuardModule,
    InstanceDbModule, IdentityService,
  ],
})
export class IdentityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
```

(If your actual svc-identity app.module.ts differs — different sub-module list, different guards — adjust this template to match. Use the actual file as the source of truth, not this template.)

- [ ] **Step 4: Replace svc-identity's app.module.ts with thin adapter**

Overwrite `apps/svc-identity/src/app/app.module.ts` (use Write tool) with:

```typescript
import { Module } from '@nestjs/common';
import { IdentityModule } from '../../../api/src/app/identity/identity.module';

/**
 * apps/svc-identity is being kept alive in parallel during the ARC-W1
 * foundation+identity slice. The actual module logic now lives in
 * apps/api/src/app/identity. This thin adapter keeps the legacy service
 * callable at the old port until full W1 cutover (a separate plan).
 */
@Module({
  imports: [IdentityModule],
})
export class AppModule {}
```

The `imports: [IdentityModule]` activates all the global guards, interceptors, middleware, and sub-modules. svc-identity's bootstrap (apps/svc-identity/src/main.ts) is unchanged; it imports AppModule and starts the Nest app — and gets full identity functionality via IdentityModule.

- [ ] **Step 5: Build both apps**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api && npx nx build svc-identity
```

- [ ] **Step 6: Run apps/api tests**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx test api
```
Expected: 12+ tests pass total. (Original 7 + 3 auth + 2 roles = 12 minimum.)

- [ ] **Step 7: Verify svc-identity still serves health endpoint**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npm run docker:up
```

In a separate terminal:

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx serve svc-identity
```

Wait for the service to start. From a third terminal:

```bash
curl -i http://localhost:<svc-identity-port>/health
```

(The port is defined in svc-identity's main.ts or its env file. Default may be 3001 or similar.)

Expected: 200 OK with health payload. If 404, the migration is missing the HealthController registration.

Stop the server with Ctrl+C. Run `npm run docker:down`.

- [ ] **Step 8: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/ apps/svc-identity/ && git commit -m "$(cat <<'EOF'
feat(api): migrate identity top-level (HealthController + IdentityService + globals); svc-identity becomes thin adapter

ARC-W1-identity task 17. apps/api/src/app/identity/identity.module.ts is
now the canonical IdentityModule with all 15 sub-modules + HealthController
+ IdentityService + 6 APP_GUARD providers + APP_INTERCEPTOR + CsrfMiddleware.

apps/svc-identity/src/app/app.module.ts becomes a one-line wrapper
importing IdentityModule from apps/api. Legacy service stays runnable
for parallel deployment until full W1 cutover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Final verification + tag

**Files:** None modified; verification only.

**Why this matters:** Identity migration is the largest single piece of W1. Confirm everything works end-to-end before tagging the milestone.

- [ ] **Step 1: Run all 4 architectural scanners**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npm run authz:check && npm run audit:check && npm run security:check && npm run deps:check
```
Expected: all 4 exit 0. (compliance:check and service-boundary:check are intentionally not run; service-boundary is being deleted in a later W1 task and compliance has known pre-existing warnings.)

- [ ] **Step 2: Lint apps/api and svc-identity**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx lint api && npx nx lint svc-identity
```

- [ ] **Step 3: Build both**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api && npx nx build svc-identity
```

- [ ] **Step 4: Run tests**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx test api
```
Expected: 12+ tests passing.

- [ ] **Step 5: Verify svc-identity directory is empty of moved sub-modules**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && ls apps/svc-identity/src/app/
```
Expected output: only `app.module.ts` remains at the root. All sub-directories are gone (moved to apps/api).

- [ ] **Step 6: Verify apps/api/src/app/identity has all 15 sub-modules + top-level files**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && ls apps/api/src/app/identity/
```
Expected: 15 sub-directories (abac, audit, auth, common, config, email, groups, iam, ldap, navigation, oidc, policies, roles, ui, users) + `health.controller.ts` + `identity.service.ts` + `identity.module.ts`.

- [ ] **Step 7: Tag the milestone**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git tag arc-w1-identity-complete && git log --oneline arc-w1-foundation-partial..arc-w1-identity-complete
```
Expected: 17 commits visible (tasks 1–17).

- [ ] **Step 8: Append completion note to this plan**

Append to the bottom of `docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md`:

```markdown
---

## Status: Complete (target: <fill in completion date>)

ARC-W1 identity migration complete. apps/api/src/app/identity/ now contains
all 15 sub-modules + HealthController + IdentityService + global guards
+ CsrfMiddleware. apps/svc-identity is reduced to a thin adapter; legacy
service stays runnable for parallel deployment until full W1 cutover.

### Next plan: ARC-W1 metadata migration

`docs/superpowers/plans/<date>-platform-w1-metadata-migration.md` covers
the same shape for apps/svc-metadata (22k LoC, 23 sub-modules).

After identity + metadata complete, the remaining W1 modules are:
data, automation, views, forms, dashboards, notifications, integrations,
ai, packs, plugins, upgrade, storage, search.

Then full W1 cutover deletes the legacy svc-* directories, the
service-boundary scanner, and migrates traffic fully to apps/api.
```

---

## Self-review

**1. Spec coverage:** This plan covers svc-identity migration in full — all 15 sub-modules + 3 top-level files. The legacy service stays runnable post-migration via thin adapter, deferring deletion to full W1 cutover (separate plan). Task 16 explicitly handles the audit READ controllers that were deferred from the foundation slice.

**2. Placeholder scan:** No "TBD", "implement later", "fill in details", or "Similar to Task N" without the code repeated. Each sub-module task has its own complete steps. Task 17's reference template explicitly says "If your actual svc-identity app.module.ts differs — adjust this template to match" which is an instruction to read the source file (acceptable, not a placeholder).

**3. Type consistency:**
- `IdentityModule` named consistently across all tasks
- `IdentityAuditModule` aliased explicitly in task 16 to disambiguate from foundation slice's top-level `AuditModule`
- All sub-module class names (UsersModule, AuthModule, etc.) match what the existing svc-identity app.module.ts imports them as
- `git mv` paths are consistent (apps/svc-identity/src/app/<sub> → apps/api/src/app/identity/<sub>)
- Import path replacement pattern is consistent (`'./<sub>` → `'../../../api/src/app/identity/<sub>`)

**4. Scope check:** Plan covers exactly identity migration — not metadata, not other W1 modules, not full W1 cutover. Three weeks of solo work. ~17 substantive tasks plus verification. Single plan size is appropriate.

No issues found.

---

**End of identity migration plan.**
