# Platform W1 Fold-Ins Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the four remaining instance-plane services into `apps/api` per spec §2 (each gets its own top-level area). All four are small, clean DAGs (no cycles), making this the smoothest W1 batch:

- `svc-view-engine` (~1,736 LoC, 3 sub-modules) → `apps/api/src/app/views/` (spec §2 `views`)
- `svc-insights` (~2,275 LoC, 5 sub-modules) → `apps/api/src/app/analytics/` (spec §2 `analytics`)
- `svc-notify` (~1,310 LoC, 1 sub-module) → `apps/api/src/app/notifications/` (spec §2 `notifications`)
- `svc-instance-api` (~1,197 LoC, 2 sub-modules) → `apps/api/src/app/instance-api/` (preserve namespace; the roadmap framed this as "aggregator/proxy that folds into apps/api wholesale" — putting it in its own area is the smallest-step interpretation; future PRs can dissolve it into apps/api/identity etc. if useful)

**Total: 59 files / ~6,518 LoC across 4 services.**

**Architecture:** All 4 are clean DAGs with NO cross-sub-module dependencies. Each service's sub-modules are independent leaves. No cyclic-core bundles needed. Largest single sub-module is svc-insights/dashboards.

**Tech Stack:** TypeScript 5.9, NestJS 11, TypeORM 0.3, Postgres, Nx 22.

**Spec reference:** Spec §2 (fold-ins into apps/api). PLATFORM-ROADMAP.md Phase 1 #5-8 + final cutover prep.

**Predecessor:** arc-w1-control-plane-complete (master HEAD post-PR-#10).

**Solo founder, ~1 week of work.** ~6 substantive tasks plus verification gate. Smallest cumulative scope of any W1 batch.

---

## Inventory

| Service | Sub-modules | Files | LoC | Destination |
|---|---|---|---|---|
| svc-view-engine | navigation, transform, view | 17 | 1,736 | apps/api/src/app/views |
| svc-insights | alerts, audit-integrity, backup, dashboards, metrics | 18 | 2,275 | apps/api/src/app/analytics |
| svc-notify | notifications | 11 | 1,310 | apps/api/src/app/notifications |
| svc-instance-api | identity, packs | 13 | 1,197 | apps/api/src/app/instance-api |
| **Total** | **11 sub-modules** | **~59** | **~6,518** | |

Each service has:
- Its own top-level `app.module.ts` (becomes thin adapter post-migration)
- A `health.controller.ts` (renames to `<area>-health.controller.ts` with route `/<area>/health` matching the precedent)
- Each sub-module has a standard `*.module.ts` with `@Module` decorator

### Cross-deps within each service

All 11 sub-modules verified to have NO cross-sub-module deps. Clean parallel-leaf migrations within each service.

### Cross-service deps

None expected (verified by inspection — no service imports from another). svc-instance-api has a `packs/` sub-dir with DTOs/guards but no apparent cross-app importers (might be dead-ish but preserved in migration).

---

## Migration order

1. **svc-view-engine → apps/api/src/app/views/** (smallest cross-cuts, do first to validate pattern)
2. **svc-notify → apps/api/src/app/notifications/** (smallest by sub-module count)
3. **svc-instance-api → apps/api/src/app/instance-api/** (2 sub-modules, similar shape)
4. **svc-insights → apps/api/src/app/analytics/** (biggest, 5 sub-modules, last)
5. **Verification gate + tag** `arc-w1-foldins-complete`

Each per-service migration includes:
- Skeleton: create destination directory + empty `<area>.module.ts` + register in apps/api `app.module.ts`
- Sub-modules: `git mv` each into the destination namespace; update consumer imports in svc-X app.module.ts
- Top-level: move health.controller.ts (with rename + route disambiguation), move app.service.ts if any; rewrite destination `<area>.module.ts` as final composition; replace svc-X app.module.ts as thin adapter
- Scanner updates: add `<area>` to MIGRATED_AREAS in both scanners; add health controller to PUBLIC_ALLOWLIST

### Pre-flight checks per task

1. Working directory + branch + HEAD
2. Empty-directory pre-flight (`find apps/api/src/app/<destination> -type d -empty`)
3. Forbidden files: nx.json, package.json, package-lock.json, .vscode, .gitignore, tsconfig.base.json, tools/, docs/
4. `git mv` only
5. Recovery: `git reset --hard <previous-commit>`

---

## Task 1: svc-view-engine → apps/api/src/app/views

**Scope:** 17 files / 1,736 LoC. 3 sub-modules (navigation, transform, view) — all independent.

### Sub-tasks

1a. **Create apps/api/src/app/views/views.module.ts** skeleton (empty), register in apps/api app.module.ts after AvaModule.

1b. **Migrate 3 sub-modules** (any order; can batch in one subagent dispatch with atomic per-sub-module commits):
   - navigation/ — standard module (verify class name with `grep "export class.*Module" apps/svc-view-engine/src/app/navigation/navigation.module.ts`)
   - transform/ — standard module
   - view/ — standard module

   Standard Template A for each: git mv, stale-path check, consumer-import update in svc-view-engine/app.module.ts (3 levels up; `'./<sub>/<sub>.module'` → `'../../../api/src/app/views/<sub>/<sub>.module'`), register in apps/api views.module.ts.

1c. **Top-level + thin adapter**:
   - Move health.controller.ts → views/views-health.controller.ts (rename class to `ViewsHealthController`, route `'views/health'`)
   - Move any other top-level service files (verify with `ls apps/svc-view-engine/src/app/`)
   - Rewrite apps/api/src/app/views/views.module.ts as final composition with all 3 sub-modules + global wiring from svc-view-engine/app.module.ts
   - Replace svc-view-engine app.module.ts as thin adapter (imports ViewsModule from apps/api)

1d. **Scanner updates**:
   - Add `'views'` to MIGRATED_AREAS in both tools/service-boundary-check.ts and tools/authz-bypass-check.ts
   - Add apps/api/src/app/views/views-health.controller.ts to PUBLIC_ALLOWLIST
   - Run `npm run security:check` after migration to catch any other public endpoints; add allowlist entries as needed.

1e. **Build + verify**: both `nx build api` and `nx build svc-view-engine` must succeed.

[Use Sonnet for the full per-service migration; ~17 files + global wiring rewrite is judgment-heavy.]

---

## Task 2: svc-notify → apps/api/src/app/notifications

**Scope:** 11 files / 1,310 LoC. 1 sub-module (notifications).

### Sub-tasks

Same pattern as Task 1 but simpler (only 1 sub-module to migrate):
- Create apps/api/src/app/notifications/notifications.module.ts skeleton
- Migrate notifications/ sub-module (Standard Template A)
- Move health.controller.ts → notifications-health.controller.ts (route `'notifications/health'`)
- Rewrite notifications.module.ts as final composition + replace svc-notify app.module.ts as thin adapter
- Add `'notifications'` to MIGRATED_AREAS + PUBLIC_ALLOWLIST entries

[Haiku for sub-module migration; Sonnet for the final composition.]

---

## Task 3: svc-instance-api → apps/api/src/app/instance-api

**Scope:** 13 files / 1,197 LoC. 2 sub-modules (identity, packs).

**Naming wrinkle:** svc-instance-api has its OWN IdentityModule (different from svc-identity's IdentityModule that was migrated in arc-w1-identity-complete). The instance-api/identity is an instance-api-specific wrapper around auth/login flows. Two distinct classes in different namespaces.

Resolution: keep svc-instance-api's IdentityModule class as `IdentityModule` at `apps/api/src/app/instance-api/identity/identity.module.ts`. When apps/api app.module.ts needs to import both, alias:

```typescript
import { IdentityModule } from './identity/identity.module'; // svc-identity → apps/api/identity
import { IdentityModule as InstanceApiIdentityModule } from './instance-api/identity/identity.module'; // svc-instance-api → apps/api/instance-api/identity
```

But: the apps/api/app.module.ts doesn't import `InstanceApiIdentityModule` directly — it imports the `InstanceApiModule` wrapper which imports the inner one. So aliasing happens INSIDE instance-api.module.ts, not at the root.

### Sub-tasks

- Create apps/api/src/app/instance-api/instance-api.module.ts skeleton (export class `InstanceApiModule`)
- Migrate identity/ and packs/ sub-modules (Standard Template A, atomic per-sub-module commits)
- Move health.controller.ts → instance-api-health.controller.ts (route `'instance-api/health'`)
- Rewrite instance-api.module.ts: imports the inner identity.module (renamed `InstanceApiInternalIdentityModule` if collision concern; else just `IdentityModule`) + packs guards/dtos. The `packs/` sub-dir has only DTOs and guards (no module wrapper) — register the DTOs/guards as needed or note they're exported.
- Replace svc-instance-api app.module.ts as thin adapter
- Add `'instance-api'` to MIGRATED_AREAS + scanner allowlists

[Sonnet for final composition; Haiku for sub-module migrations.]

---

## Task 4: svc-insights → apps/api/src/app/analytics

**Scope:** 18 files / 2,275 LoC. 5 sub-modules (alerts, audit-integrity, backup, dashboards, metrics).

### Sub-tasks

Same pattern. Biggest of the 4 by file count but still all clean leaves:
- Create apps/api/src/app/analytics/analytics.module.ts skeleton
- Migrate 5 sub-modules in any order (single subagent dispatch with 5 atomic per-sub-module commits)
- Move health.controller.ts → analytics-health.controller.ts (route `'analytics/health'`)
- Rewrite analytics.module.ts as final composition; replace svc-insights app.module.ts as thin adapter
- Add `'analytics'` to MIGRATED_AREAS + PUBLIC_ALLOWLIST entries
- Note: svc-insights has a `dashboards/dashboards.service.ts` allowlist entry in `authz-bypass-check.ts` KNOWN_BYPASSES — update the path from `apps/svc-insights/.../dashboards.service.ts` to `apps/api/src/app/analytics/dashboards/dashboards.service.ts`.

[Sonnet for final composition; Haiku for the 5 sub-module migrations.]

---

## Task 5: Verification + tag

- [ ] All 6 scanners pass
- [ ] All selftests pass (with MIGRATED_AREAS now including views, notifications, instance-api, analytics in addition to identity, metadata, data, automation, ava)
- [ ] Build all 9 monolith-state apps + 4 newly-thinned apps: api, control-plane, svc-identity, svc-metadata, svc-data, svc-automation, svc-ava, svc-workflow, svc-control-plane, svc-view-engine, svc-insights, svc-notify, svc-instance-api
- [ ] apps/api tests pass
- [ ] Verify all 4 svc-* directories have only `app.module.ts` (+ `__selftest_fixture__/` if present)
- [ ] Verify apps/api/src/app/{views,analytics,notifications,instance-api}/ all populated
- [ ] Tag `arc-w1-foldins-complete`
- [ ] Append completion note to plan
- [ ] Commit completion note

After this PR merges: **all 11 instance/control-plane services migrated.** Only W1 final cutover remains.

---

## Self-review

**1. Spec coverage:** Plan covers all 4 remaining fold-in services per spec §2 (views, analytics, notifications, instance-api).

**2. Placeholder scan:** Each task has explicit steps + sub-tasks. No "TBD" markers.

**3. Type consistency:**
- Each service's health controller renamed to `<Area>HealthController` with route `'<area>/health'` (matching the established W1 precedent)
- IdentityModule namespace collision (instance-api/identity vs apps/api/identity) handled via aliased imports
- Class names per existing svc-* modules

**4. Scope check:** Plan covers exactly 4 fold-ins. ~1 week. ~5 substantive tasks.

**5. Dependency graph correctness:** All 11 sub-modules have no cross-sub-module deps. No cyclic-core bundles. Each per-service migration is purely topological (skeleton → leaves → top-level + thin adapter).

**6. Scanner MIGRATED_AREAS:** 4 new entries to add (views, analytics, notifications, instance-api) in the same PR as the migrations.

**7. PUBLIC_ALLOWLIST:** 4 new <area>-health.controller.ts entries. Plus possibly more for instance-api/identity/auth.controller (it has `@Public` on login endpoints).

**8. Existing svc-insights dashboards.service.ts entry in authz-bypass KNOWN_BYPASSES:** path must be translated when svc-insights migrates.

No issues found.

---

**End of fold-ins migration plan.**
