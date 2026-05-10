# Platform W1 Control-Plane Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate `apps/svc-control-plane` (~6,202 LoC across ~67 files, 12 sub-modules) into a NEW `apps/control-plane` Nest application (per spec §2 — apps/control-plane is a separate Nest app, distinct from apps/api). svc-control-plane becomes a thin adapter wrapping the new ControlPlaneModule.

**Architecture differences from prior W1 migrations:**

1. **Destination is a NEW Nest app, not a sub-area of apps/api.** Per spec §2: "Modular monolith — apps/api + apps/worker + apps/control-plane + apps/web-client + apps/mobile." apps/control-plane has its own port, its own deployment, its own multi-tenant DB (`@hubblewave/control-plane-db`).

2. **Multi-tenant by design.** Canon §18 explicitly carves out the control plane: it manages customers + instances + licensing across all tenants. It uses `customerId` in business logic intentionally (unlike the instance plane which forbids tenant IDs in business logic).

3. **TWO cyclic-core bundles + 67 files.** The biggest cyclic-core scope of any W1 migration. Two cycles to handle as atomic moves: `audit ↔ auth` (foundational) and `instances ↔ terraform`.

**Tech Stack:** TypeScript 5.9, NestJS 11, TypeORM 0.3, Postgres (separate control-plane DB), Nx 22 monorepo. Existing svc-control-plane deps: `@hubblewave/control-plane-db`, `@nestjs/event-emitter`, `@nestjs/schedule`, `@nestjs/throttler`.

**Spec reference:** Canon §18 (Control Plane Architecture). PLATFORM-ROADMAP.md Phase 1 #4. Spec §2 (Modular monolith topology).

**Predecessor:** arc-w1-workflow-complete (master HEAD post-PR-#9).

**Solo founder, ~2 weeks of work.** ~9 substantive tasks plus verification gate. Most complex W1 migration so far.

---

## Sub-module inventory (measured 2026-05-10)

| Sub-module | Files | LoC | Pattern | Cross-deps | Migration order |
|---|---|---|---|---|---|
| `audit` | 5 | 439 | Standard module (`AuditModule`) | auth (cycle) | atomic bundle (Task 3) |
| `auth` | 12 | 1,184 | Standard module (`AuthModule`) | audit (cycle) | atomic bundle (Task 3) |
| `licenses` | 4 | 272 | Standard module (`LicensesModule`) | audit, auth | after Task 3 |
| `customers` | 6 | 542 | Standard module (`CustomersModule`) | audit, auth | after Task 3 |
| `health-aggregator` | 4 | 678 | Standard module (`HealthAggregatorModule`) | audit, auth | after Task 3 |
| `packs` | 6 | 886 | Standard module (`PacksModule`) | audit, auth | after Task 3 |
| `recovery` | 4 | 162 | Standard module (`RecoveryModule`) | audit, auth | after Task 3 |
| `settings` | 5 | 155 | Standard module (`SettingsModule`) | audit, auth | after Task 3 |
| `subscriptions` | 4 | 224 | Standard module (`SubscriptionsModule`) | audit, auth | after Task 3 |
| **`instances`** | **5** | **605** | **Standard module (`InstancesModule`)** | **audit, auth, licenses, terraform (cycle)** | **atomic bundle (Task 6)** |
| **`terraform`** | **7** | **796** | **Standard module (`TerraformModule`)** | **auth, instances (cycle)** | **atomic bundle (Task 6)** |
| `metrics` | 5 | 259 | Standard module (`MetricsModule`) | instances | after Task 6 |
| Top-level files (3) | 3 | ~218 | app.controller + app.service + app.module | varies | Task 8 |
| **Total** | **~70** | **~6,420** | | | |

### Cycle structure

```
                    audit ⇄ auth (cycle 1, foundational)
                      ↑      ↑
                      |      |
            licenses, customers, health-aggregator, packs,
            recovery, settings, subscriptions
                              ↓
                         instances ⇄ terraform (cycle 2, infra)
                              ↑
                              |
                           metrics
```

**Cycle 1 (audit ↔ auth):** Both must migrate as one atomic commit. 17 files, ~1,623 LoC. Same shape as identity's auth+abac+ldap+roles bundle (~66 files atomic), smaller scope.

**Cycle 2 (instances ↔ terraform):** Both must migrate as one atomic commit. 12 files, ~1,401 LoC. Same shape as svc-automation's ava ↔ rules bundle (5 files), bigger scope.

---

## Migration order (concrete)

1. **Scaffold apps/control-plane Nest app** — new project.json, tsconfig.*, jest config, eslint config, webpack config, main.ts, empty ControlPlaneModule. Verify `npx nx build control-plane` succeeds.
2. _(reserved — sub-module migrations start at Task 3)_
3. **`audit + auth` cyclic-core bundle** (atomic single commit; 17 files)
4. **`licenses`** (depends on audit+auth, now satisfied)
5. **Batched leaves group A**: customers, health-aggregator, packs (3 single-dep modules)
6. **`instances + terraform` cyclic-core bundle** (atomic; 12 files; both depend on audit+auth+licenses, all satisfied)
7. **Batched leaves group B**: recovery, settings, subscriptions, metrics (4 single-dep modules; metrics depends on instances which is now satisfied)
8. **Top-level + thin adapter** — move app.controller.ts + app.service.ts; rewrite ControlPlaneModule as final composition with all 12 sub-modules + global wiring (TypeOrmModule for control-plane DB, ThrottlerModule, ScheduleModule, EventEmitterModule, APP_GUARD/APP_INTERCEPTOR providers). Replace apps/svc-control-plane/src/app/app.module.ts with thin adapter.
9. **Verification + tag** `arc-w1-control-plane-complete`. No MIGRATED_AREAS update needed (apps/control-plane is a different Nest app, not a sub-area of apps/api).

### Pre-flight checks per task

1. Working directory + branch + HEAD
2. Empty-directory pre-flight (`find apps/control-plane/src/app -type d -empty`)
3. Forbidden file list: nx.json, package.json, package-lock.json, .vscode, .gitignore, tsconfig.base.json, tools/, docs/
4. `git mv` only
5. Recovery: `git reset --hard <previous-commit>`

---

## Task 1: Scaffold apps/control-plane Nest app

**Files to create (all NEW, no `git mv`):**
- `apps/control-plane/project.json` — Nx project config (build/serve/test/lint targets, modeled on apps/api)
- `apps/control-plane/tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`
- `apps/control-plane/jest.config.cts`
- `apps/control-plane/eslint.config.mjs`
- `apps/control-plane/webpack.config.js`
- `apps/control-plane/src/main.ts` (entry point, basic Nest bootstrap)
- `apps/control-plane/src/app/app.module.ts` (empty ControlPlaneModule)

**Why this matters:** Establishes the destination as a real Nest app. Subsequent sub-module migrations land here.

### Steps

- [ ] **Step 1: Verify state**

```bash
cd "<worktree-path>" && pwd && git rev-parse --abbrev-ref HEAD && git log --oneline -1 && ls apps/api/   # reference scaffold
```

- [ ] **Step 2: Read apps/api scaffold files as template**

```bash
cat apps/api/project.json
cat apps/api/tsconfig.app.json
cat apps/api/jest.config.cts
cat apps/api/eslint.config.mjs
cat apps/api/webpack.config.js
cat apps/api/src/main.ts
```

- [ ] **Step 3: Create apps/control-plane scaffold mirroring apps/api**

Create all 7 scaffold files. For project.json, rename "api" → "control-plane" in source paths and targets. For main.ts, mirror apps/api's bootstrap but use the ControlPlaneModule. The DB config + ThrottlerModule + other lib-level wiring will land in Task 8 (we don't duplicate it in Task 1 — Task 1 creates the empty shell).

Empty ControlPlaneModule:

```typescript
import { Module } from '@nestjs/common';

/**
 * ControlPlaneModule — canonical home for the platform's control plane
 * (formerly apps/svc-control-plane). Per canon §18, the control plane:
 *   - manages customers + instances + subscriptions + licenses
 *   - is multi-tenant by design (customerId in business logic, intentional)
 *   - has its own DB (@hubblewave/control-plane-db), distinct from instance-plane
 *   - is excluded from instance-plane authz scanners (canon §18 carve-out)
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-control-plane-migration.md):
 *   Foundation cyclic-core:
 *     [ ] audit + auth (atomic bundle)
 *   Standard modules:
 *     [ ] licenses (depends on audit+auth)
 *     [ ] customers, health-aggregator, packs (single-dep on audit+auth)
 *     [ ] recovery, settings, subscriptions (single-dep)
 *   Infrastructure cyclic-core:
 *     [ ] instances + terraform (atomic bundle)
 *   Final standard module:
 *     [ ] metrics (depends on instances)
 *   Final top-level (controller + service + app.module thin adapter):
 *     [ ] app.controller, app.service
 *     [ ] control-plane.module final composition
 *     [ ] svc-control-plane app.module thin adapter
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class ControlPlaneModule {}
```

- [ ] **Step 4: Verify build**

```bash
npx nx build control-plane 2>&1 | tail -10
```

Build must succeed (even with empty module).

- [ ] **Step 5: Commit**

```
feat(control-plane): scaffold apps/control-plane Nest app

ARC-W1-control-plane task 1. New Nest app per spec §2 (apps/control-plane
is a distinct app from apps/api). Empty ControlPlaneModule registered;
sub-modules migrate into it one at a time via subsequent tasks.

Per canon §18, control plane is multi-tenant by design — its own DB,
its own port, its own deployment vehicle. Distinct from the instance
plane consolidated in apps/api.
```

---

## Task 3: `audit + auth` cyclic-core bundle (atomic single commit, 17 files)

**Class names:** `AuditModule`, `AuthModule`.
**Cross-deps:** audit ↔ auth (cycle). Both must migrate together.

After the atomic move, the `'../audit/...'` and `'../auth/...'` imports within these two directories resolve correctly because they remain siblings under apps/control-plane/src/app/.

Standard cyclic-core handling (same as identity's auth+abac+ldap+roles, svc-automation's ava+rules):
- `git mv` both directories in one command
- 4-level-up apps/api paths inside the bundle → sibling-relative (no apps/api paths in this case because the cycle members reference EACH OTHER, not the apps/api home of another service)
- Update consumer imports in svc-control-plane app.module.ts
- Register both modules in apps/control-plane/src/app/app.module.ts (ControlPlaneModule)

Commit message: `feat(control-plane): migrate audit+auth cyclic-core bundle from svc-control-plane into apps/control-plane`

---

## Task 4: `licenses` (4 files, 272 LoC, depends on audit+auth)

Standard Template A. After move, internal `'../audit/...'` and `'../auth/...'` paths in licenses files resolve correctly because audit + auth are now siblings under apps/control-plane.

---

## Task 5 (batched): customers, health-aggregator, packs (3 single-dep leaves)

Each depends only on audit+auth (Task 3 satisfied). Apply Standard Template A 3x with atomic per-task commits.

---

## Task 6: `instances + terraform` cyclic-core bundle (atomic, 12 files)

Same pattern as Task 3. Both depend on audit+auth (Task 3) and instances also on licenses (Task 4). All satisfied.

Inside the bundle, the cycle imports are sibling-relative `'../instances/...'` and `'../terraform/...'` — they remain valid post-move since both directories become siblings under apps/control-plane.

Commit message: `feat(control-plane): migrate instances+terraform cyclic-core bundle from svc-control-plane into apps/control-plane`

---

## Task 7 (batched): recovery, settings, subscriptions, metrics

- recovery, settings, subscriptions: each depend only on audit+auth (Task 3 satisfied)
- metrics: depends on instances (Task 6 satisfied)

Apply Standard Template A 4x with atomic per-task commits.

---

## Task 8: Final top-level migration + thin adapter

**Files:**
- Move: `apps/svc-control-plane/src/app/app.controller.ts` → `apps/control-plane/src/app/app.controller.ts`
- Move: `apps/svc-control-plane/src/app/app.service.ts` → `apps/control-plane/src/app/app.service.ts`
- Rewrite: `apps/control-plane/src/app/app.module.ts` as final ControlPlaneModule composition
- Replace: `apps/svc-control-plane/src/app/app.module.ts` as thin adapter

**Special considerations:**

1. **Global wiring to preserve from svc-control-plane app.module.ts:**
   - `ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] })`
   - `ScheduleModule.forRoot()`
   - `EventEmitterModule.forRoot()`
   - `ThrottlerModule.forRootAsync({ ... CONTROL_PLANE_RATE_LIMIT ... })`
   - `TypeOrmModule.forRootAsync({ ... CONTROL_PLANE_DB_PASSWORD ... controlPlaneEntities ... })`
   - APP_GUARD provider with ThrottlerGuard
   - APP_INTERCEPTOR provider with AuditInterceptor

2. **app.controller.ts + app.service.ts** stay as standard top-level files (no class rename needed — these aren't health controllers; there are no naming collisions with apps/api because apps/control-plane is a separate app).

3. **Thin adapter at svc-control-plane:**

```typescript
import { Module } from '@nestjs/common';
import { ControlPlaneModule } from '../../../control-plane/src/app/app.module';

@Module({
  imports: [ControlPlaneModule],
})
export class AppModule {}
```

[Use Sonnet for this task — judgment-heavy rewrite combining 12 sub-modules + 2 top-level files + extensive global wiring.]

---

## Task 9: Verification + tag

- [ ] All 6 scanners pass
- [ ] All selftests pass
- [ ] Build 8 monolith-state apps: api, control-plane, svc-identity, svc-metadata, svc-data, svc-automation, svc-ava, svc-workflow, svc-control-plane
- [ ] apps/api tests pass
- [ ] apps/control-plane tests pass (if any spec migrated)
- [ ] Verify svc-control-plane has only app.module.ts + __selftest_fixture__/
- [ ] Verify apps/control-plane/src/app has 12 sub-dirs + 3 top-level .ts files
- [ ] **PUBLIC_ALLOWLIST extension** — health-aggregator.controller and auth.controller (public auth endpoints on the control plane). Add apps/control-plane/src/app/health-aggregator/health-aggregator.controller.ts and apps/control-plane/src/app/auth/auth.controller.ts to PUBLIC_ALLOWLIST as needed. **NO MIGRATED_AREAS update** because the destination is apps/control-plane, not apps/api/src/app/<area>.
- [ ] Tag `arc-w1-control-plane-complete`
- [ ] Append completion note to plan
- [ ] Commit completion note

---

## Self-review

**1. Spec coverage:** Plan covers svc-control-plane → apps/control-plane in full. New Nest app scaffolded; 12 sub-modules migrated with two cyclic-core bundles; thin adapter at svc-control-plane.

**2. Placeholder scan:** All 9 tasks have explicit steps. The 2 cyclic-bundle tasks follow the established pattern from identity's auth+abac+ldap+roles and svc-automation's ava+rules.

**3. Type consistency:** Class names per existing svc-control-plane modules (AuditModule, AuthModule, etc.). No class renames needed (apps/control-plane is a separate Nest app — no collision with apps/api class names like IdentityModule's AuditModule).

**4. Scope check:** Plan covers exactly control-plane migration — not other svc-* services, not full W1 cutover. ~2 weeks. ~9 substantive tasks. Largest W1 migration but tractable.

**5. Dependency graph correctness:** Re-verified with grep:
- Cycle 1 (audit ↔ auth): bidirectional file-level imports
- Cycle 2 (instances ↔ terraform): bidirectional file-level imports
- 7 single-dep leaves (licenses + 6 others) depend only on audit+auth
- metrics depends on instances (which is in cycle 2)
- No other cycles or cross-deps

**6. Scanner behavior:** apps/control-plane is NOT in apps/svc-* nor under apps/api/src/app/. The service-boundary-check.ts and authz-bypass-check.ts scanners walk only those locations. apps/control-plane is naturally excluded — which is correct per canon §18 (control plane has its own auth model and multi-tenancy). No MIGRATED_AREAS extension needed.

**7. Class name collision check:** AuditModule in apps/control-plane vs apps/api/src/app/identity/audit (identity has AuditModule too). Two distinct classes in different namespaces — no collision at compile time (different files). At runtime, apps/control-plane and apps/api are separate processes/contexts, so no NestJS DI collision either.

**8. PUBLIC_ALLOWLIST scope:** The security-bypass-check scanner walks all of apps/. Control-plane's @Public() endpoints (auth, health-aggregator) will need allowlist entries with rationale.

No issues found.

---

**End of control-plane migration plan.**
