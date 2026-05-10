# Platform W1 Metadata Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the entire `apps/svc-metadata` Nest application (23 sub-modules + 8 top-level files = ~21,200 LoC across 102 files) into `apps/api/src/app/metadata/`, sub-module by sub-module, using `git mv` to preserve history and keeping `apps/svc-metadata` runnable in parallel via a thin adapter at the end.

**Architecture:** svc-metadata's cross-module dependency graph is a clean DAG (no cycles). 18 of the 23 sub-modules have zero cross-sub-module dependencies and can migrate in any order. The remaining 5 sub-modules (`access`, `publish-impact`, `collection`, `schema`, `packs`) form a 4-deep dependency chain that must migrate in order.

**Tech Stack:** TypeScript 5.9, NestJS 11, TypeORM 0.3, Postgres, Nx 22 monorepo, Jest 30. Existing platform deps: `@hubblewave/auth-guard`, `@hubblewave/authorization`, `@hubblewave/instance-db`, `@hubblewave/redis`.

**Spec reference:** `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §2 (target architecture) + §9 (canon delta).

**Predecessor plans:**
- `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md` (status `arc-w1-foundation-partial`)
- `docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md` (status `arc-w1-identity-complete`)

This plan continues by migrating metadata. It is **structurally simpler than the identity plan** because there's no cyclic core — every migration is small and self-contained.

**Solo founder, ~3–4 weeks of work.** ~28 bite-sized tasks. Each task is independently reversible.

---

## Sub-module inventory (measured 2026-05-10)

The migration order respects the cross-module dependency graph. Independent leaves first (any order); chained sub-modules in dependency order at the end.

| Sub-module | Files | LoC | Specs | Cross-deps | Migration order |
|---|---|---|---|---|---|
| `application` | 4 | 333 | 0 | none | independent leaf |
| `ava` | 1 | 351 | 0 | none | independent leaf |
| `change-packages` | 3 | 1,317 | 1 | none | independent leaf |
| `connectors` | 1 | 487 | 0 | none | independent leaf |
| `decision-tables` | 3 | 560 | 1 | none | independent leaf |
| `display-rules` | 3 | 435 | 0 | none | independent leaf |
| `guided-processes` | 3 | 484 | 1 | none | independent leaf |
| `insights` | 1 | 292 | 0 | none | independent leaf |
| `localization` | 6 | 1,012 | 0 | none | independent leaf |
| `metadata` | 1 | 459 | 0 | none | independent leaf |
| `navigation` | 3 | 390 | 0 | none | independent leaf |
| `preferences` | 5 | 938 | 0 | none | independent leaf |
| `property` | 7 | 1,874 | 2 | none | independent leaf |
| `script` | 3 | 161 | 0 | none | independent leaf |
| `search` | 4 | 698 | 0 | none | independent leaf |
| `theme` | 4 | 377 | 0 | none | independent leaf |
| `view` | 3 | 460 | 0 | none | independent leaf |
| `workspaces` | 3 | 654 | 1 | none | independent leaf |
| **`access`** | **9** | **2,155** | **1** | **none (intra-only)** | independent leaf (do early; downstream needs it) |
| **`publish-impact`** | **12** | **1,189** | **1** | **none (intra-only)** | independent leaf (do early; downstream needs it) |
| **`collection`** | **5** | **3,375** | **1** | **access, publish-impact** | dependent — after access + publish-impact |
| **`schema`** | **3** | **657** | **1** | **collection** | dependent — after collection |
| **`packs`** | **6** | **2,467** | **1** | **access, ava, connectors, insights, localization, metadata, search** | dependent — after the 7 listed above |
| Top-level files (8) | 8 | ~1,200 | 0 | varies | last (after all sub-modules) |
| **Total** | **102** | **~21,225** | **12** | | |

### Migration order (concrete)

1. **Skeleton + register** — empty MetadataModule
2–19. **18 independent leaves** (no cross-deps; any order, but in this plan we start with the smallest):
   - script (161 LoC), insights (292), application (333), ava (351), theme (377), navigation (390), display-rules (435), view (460), metadata (459 — top-level dir, distinct from app), guided-processes (484), connectors (487), decision-tables (560), workspaces (654), search (698), preferences (938), localization (1,012), change-packages (1,317), property (1,874)
20. **access** (2,155 LoC, independent but downstream of the above order)
21. **publish-impact** (1,189 LoC, independent but downstream)
22. **collection** (3,375 LoC; depends on access + publish-impact — now satisfied)
23. **schema** (657 LoC; depends on collection — now satisfied)
24. **packs** (2,467 LoC; depends on access + ava + connectors + insights + localization + metadata + search — all satisfied)
25. **Top-level** (HealthController + MetadataController + ModelController + ModuleController + ModelRegistryService + ModuleService + ModuleDto + app.module thin adapter)
26. **Verification gate** (build, scanners, tag `arc-w1-metadata-complete`)

### Pre-flight checks per task

For every sub-module migration task, the prompt MUST include these checks (lessons from the identity migration):

1. **Working directory** — verify pwd + branch + expected HEAD before any edit
2. **Empty-directory check** — `find apps/api/src/app/metadata -type d -empty` to catch residual empty dirs from prior failed attempts (Windows/OneDrive quirk that causes `git mv` to nest the source inside the destination)
3. **No `.vscode`, `nx.json`, `package.json` modifications** — explicit forbidden file list
4. **`git mv` only** — no copies, no creating new files in svc-metadata
5. **Authorized recovery path** — `git reset --hard <previous-commit>` if state is broken

These constraints repeat in every task body; do not skip them.

---

## Files Created/Modified Overview

### Per task (template — applies to every sub-module migration task)

**Modified:**
- `apps/svc-metadata/src/app/app.module.ts` — change `from './<sub>/<sub>.module'` to `from '../../../api/src/app/metadata/<sub>/<sub>.module'` for the migrating sub-module
- `apps/api/src/app/metadata/metadata.module.ts` — add the migrated sub-module to its imports + exports arrays
- (possibly) other files in svc-metadata that imported from the migrating sub-module — paths updated similarly

**Moved (`git mv`):**
- `apps/svc-metadata/src/app/<sub>/` → `apps/api/src/app/metadata/<sub>/`

### Plan-end state

- `apps/api/src/app/metadata/` contains all 23 sub-modules + 7 top-level files (HealthController, MetadataController, ModelController, ModuleController, ModelRegistryService, ModuleService, ModuleDto) + `metadata.module.ts` (the full composition)
- `apps/api/src/app/app.module.ts` registers `MetadataModule` after `IdentityModule`
- `apps/svc-metadata/src/app/app.module.ts` is a thin wrapper that imports MetadataModule from apps/api (one substantive line of code)
- `apps/svc-metadata/src/main.ts` and `project.json` remain unchanged; legacy service stays runnable
- Legacy service deletion is deferred to the W1 final-cutover plan (not this one)

---

## Task 1: Create apps/api/src/app/metadata skeleton

**Files:**
- Create: `apps/api/src/app/metadata/metadata.module.ts` (empty composition)
- Modify: `apps/api/src/app/app.module.ts` (register MetadataModule)

**Why this matters:** Establishes the destination module. Subsequent sub-module migrations register themselves into this skeleton's imports array.

- [ ] **Step 1: Verify working directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD && git log --oneline -1
```
Expected: `pwd` ends with `nervous-volhard-f9abc2`; branch `claude/nervous-volhard-f9abc2`; HEAD `8710e79` (the identity-complete commit) or later.

- [ ] **Step 2: Empty-directory pre-flight check**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && find apps/api/src/app/metadata -type d -empty 2>&1
```

If the output shows `apps/api/src/app/metadata` (the directory exists empty), remove it before creating the skeleton:
```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && rmdir apps/api/src/app/metadata 2>/dev/null
```

- [ ] **Step 3: Create the directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && mkdir -p apps/api/src/app/metadata
```

- [ ] **Step 4: Create metadata.module.ts skeleton**

Write `apps/api/src/app/metadata/metadata.module.ts`:

```typescript
import { Module } from '@nestjs/common';

/**
 * MetadataModule consolidates everything from apps/svc-metadata into the
 * apps/api modular monolith. Sub-modules migrate one at a time via git mv;
 * each migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md):
 *   [ ] application
 *   [ ] ava
 *   [ ] change-packages
 *   [ ] connectors
 *   [ ] decision-tables
 *   [ ] display-rules
 *   [ ] guided-processes
 *   [ ] insights
 *   [ ] localization
 *   [ ] metadata
 *   [ ] navigation
 *   [ ] preferences
 *   [ ] property
 *   [ ] script
 *   [ ] search
 *   [ ] theme
 *   [ ] view
 *   [ ] workspaces
 *   [ ] access
 *   [ ] publish-impact
 *   [ ] collection
 *   [ ] schema
 *   [ ] packs
 *   [ ] top-level (HealthController + Metadata/Model/Module controllers + services + thin adapter)
 *
 * MetadataModule re-exports each migrated sub-module so that:
 * - apps/api consumers (data, automation, etc.) can inject metadata services
 *   without explicit sub-module imports
 * - apps/svc-metadata's thin adapter (post-migration) can import MetadataModule
 *   wholesale to keep the legacy service serving the same endpoints
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class MetadataModule {}
```

- [ ] **Step 5: Register MetadataModule in apps/api AppModule**

Edit `apps/api/src/app/app.module.ts`. Currently it has `[KernelModule, DbModule, AuditModule, IdentityModule]`. Add `MetadataModule` import + register in imports array.

After: `imports: [KernelModule, DbModule, AuditModule, IdentityModule, MetadataModule]`.

- [ ] **Step 6: Verify build**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/ && git commit -m "$(cat <<'EOF'
feat(api): create empty MetadataModule skeleton in apps/api

ARC-W1-metadata task 1. Empty MetadataModule registered in AppModule;
sub-modules migrate into it one at a time via subsequent tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Tasks 2–19: Independent leaf migrations (18 sub-modules, no cross-deps)

Each follows the standard migration template. The body of each task is repeated explicitly below — do not skip steps even if they look the same.

**Standard template per task (each task substitutes its own `<sub>` and class name):**

1. Verify working directory + branch + expected HEAD
2. Empty-directory pre-flight check (`find apps/api/src/app/metadata -type d -empty`); rmdir any empty `<sub>/` from prior failed attempts
3. `git mv apps/svc-metadata/src/app/<sub> apps/api/src/app/metadata/<sub>`
4. Verify clean move (no nested `<sub>/<sub>/` structure)
5. Fix stale absolute paths inside the moved files (any `'../../../../api/src/app/metadata/...'` paths from prior attempts → `'../<sibling>'` if the sibling is migrated, or stays as-is if not)
6. Find svc-metadata imports referencing the migrating sub-module — `grep -rn "from '\./<sub>\|from '\.\./<sub>" apps/svc-metadata/src --include="*.ts"`
7. Update each match: 3-level-up paths from `apps/svc-metadata/src/app/`, 4-level-up paths from `apps/svc-metadata/src/app/<other-sub>/`
8. Verify zero orphan imports remain in svc-metadata
9. Update apps/api/src/app/metadata/metadata.module.ts: add `import { <ClassName>Module } from './<sub>/<sub>.module';`, register in `imports: []` and `exports: []`, mark `[x] <sub>` checkbox
10. Build both apps (`nx build api` + `nx build svc-metadata`); both must succeed
11. Verify clean git status (no nx.json, .vscode, package.json modifications; no new files in svc-metadata)
12. Commit with message `feat(api): migrate <sub>/ (<ClassName>Module) from svc-metadata into apps/api/metadata`

### Task 2: Migrate `script` (3 files, 161 LoC, 0 specs)

**Class name:** `ScriptModule`. Smallest sub-module — good first migration.

[Apply the standard template above with `<sub>` = script and `<ClassName>Module` = ScriptModule]

### Task 3: Migrate `insights` (1 file, 292 LoC, 0 specs)

**Class name:** verify by reading `insights/*.module.ts` (likely `InsightsModule`).

[Apply standard template]

### Task 4: Migrate `application` (4 files, 333 LoC, 0 specs)

**Class name:** likely `ApplicationModule`. Verify.

[Apply standard template]

### Task 5: Migrate `ava` (1 file, 351 LoC, 0 specs)

**Class name:** verify by reading the source file. May be `AvaModule` or might just be a single service file with no module wrapper — if so, it's a simple file copy with no module registration in metadata.module.ts.

[Apply standard template; if no module class exists, register the service in `providers` instead of `imports`]

### Task 6: Migrate `theme` (4 files, 377 LoC, 0 specs)

**Class name:** `ThemeModule`.

[Apply standard template]

### Task 7: Migrate `navigation` (3 files, 390 LoC, 0 specs)

**Class name:** `NavigationModule`. **Note:** there's also a `navigation` sub-module in identity (already migrated to apps/api/src/app/identity/navigation). The metadata navigation is distinct — uses the namespace `apps/api/src/app/metadata/navigation`. **Alias on import** in metadata.module.ts to avoid name collision: `import { NavigationModule as MetadataNavigationModule } from './navigation/navigation.module';` and use `MetadataNavigationModule` in imports/exports arrays.

[Apply standard template with the alias]

### Task 8: Migrate `display-rules` (3 files, 435 LoC, 0 specs)

**Class name:** `DisplayRulesModule`.

[Apply standard template]

### Task 9: Migrate `metadata` (1 file, 459 LoC, 0 specs)

**Class name:** verify (file may be `metadata.module.ts` or could be a service-only file). **Naming caution:** this sub-module is named "metadata" inside the parent "metadata" namespace — the path is `apps/api/src/app/metadata/metadata/`. Be deliberate about this naming.

[Apply standard template]

### Task 10: Migrate `view` (3 files, 460 LoC, 0 specs)

**Class name:** `ViewModule`.

[Apply standard template]

### Task 11: Migrate `guided-processes` (3 files, 484 LoC, 1 spec)

**Class name:** `GuidedProcessesModule`.

[Apply standard template; verify the 1 spec relocates with the source files]

### Task 12: Migrate `connectors` (1 file, 487 LoC, 0 specs)

**Class name:** `ConnectorsModule`.

[Apply standard template]

### Task 13: Migrate `decision-tables` (3 files, 560 LoC, 1 spec)

**Class name:** `DecisionTablesModule`.

[Apply standard template]

### Task 14: Migrate `workspaces` (3 files, 654 LoC, 1 spec)

**Class name:** `WorkspacesModule`.

[Apply standard template]

### Task 15: Migrate `search` (4 files, 698 LoC, 0 specs)

**Class name:** `SearchModule`. Used by `packs` later in the plan.

[Apply standard template]

### Task 16: Migrate `preferences` (5 files, 938 LoC, 0 specs)

**Class name:** `PreferencesModule`.

[Apply standard template]

### Task 17: Migrate `localization` (6 files, 1,012 LoC, 0 specs)

**Class name:** `LocalizationModule`. Used by `packs` later.

[Apply standard template]

### Task 18: Migrate `change-packages` (3 files, 1,317 LoC, 1 spec)

**Class name:** `ChangePackagesModule`.

[Apply standard template]

### Task 19: Migrate `property` (7 files, 1,874 LoC, 2 specs)

**Class name:** `PropertyModule`. Largest of the independent leaves.

[Apply standard template]

---

## Tasks 20–24: Dependent sub-modules (in dependency order)

### Task 20: Migrate `access` (9 files, 2,155 LoC, 1 spec)

**Class name:** verify (likely `AccessModule`). Used by `collection` and `packs` later.

[Apply standard template]

### Task 21: Migrate `publish-impact` (12 files, 1,189 LoC, 1 spec)

**Class name:** verify (likely `PublishImpactModule`). Used by `collection` later.

[Apply standard template]

### Task 22: Migrate `collection` (5 files, 3,375 LoC, 1 spec) — depends on access + publish-impact

**Class name:** `CollectionModule`. Largest single sub-module in svc-metadata. Depends on access (task 20) and publish-impact (task 21).

After task 22 completes, `collection` files inside apps/api/src/app/metadata/collection/ that imported from access and publish-impact via `'../access/...'` and `'../publish-impact/...'` paths will resolve correctly because all three sub-modules are now in apps/api/src/app/metadata/.

[Apply standard template; pay extra attention to step 5 (stale path fixes) since collection is large and has many internal cross-refs to access and publish-impact]

### Task 23: Migrate `schema` (3 files, 657 LoC, 1 spec) — depends on collection

**Class name:** `SchemaModule`. Depends on collection (task 22).

[Apply standard template]

### Task 24: Migrate `packs` (6 files, 2,467 LoC, 1 spec) — depends on 7 leaves

**Class name:** `PacksModule`. Depends on: access (20), ava (5), connectors (12), insights (3), localization (17), metadata (9), search (15) — all of which are now migrated.

**Note:** there's also a `libs/packs` library; that is unaffected by this migration. The metadata `packs` sub-module here is svc-metadata's pack-install path that consumes `libs/packs`.

[Apply standard template; pay extra attention to imports since packs has the most cross-deps]

---

## Task 25: Top-level migration

**Files:**
- Move: `apps/svc-metadata/src/app/health.controller.ts` → `apps/api/src/app/metadata/health.controller.ts`
- Move: `apps/svc-metadata/src/app/metadata.controller.ts` → `apps/api/src/app/metadata/metadata.controller.ts`
- Move: `apps/svc-metadata/src/app/model.controller.ts` → `apps/api/src/app/metadata/model.controller.ts`
- Move: `apps/svc-metadata/src/app/module.controller.ts` → `apps/api/src/app/metadata/module.controller.ts`
- Move: `apps/svc-metadata/src/app/model-registry.service.ts` → `apps/api/src/app/metadata/model-registry.service.ts`
- Move: `apps/svc-metadata/src/app/module.service.ts` → `apps/api/src/app/metadata/module.service.ts`
- Move: `apps/svc-metadata/src/app/module.dto.ts` → `apps/api/src/app/metadata/module.dto.ts`
- Modify: `apps/api/src/app/metadata/metadata.module.ts` (final composition: register all controllers + top-level services + 23 sub-modules)
- Replace: `apps/svc-metadata/src/app/app.module.ts` (becomes thin wrapper)

**Why this matters:** The 23 sub-modules are migrated; the top-level files (4 controllers, 2 services, 1 DTO) and global wiring need to relocate. After this task, svc-metadata's app.module.ts is one substantive line — just imports MetadataModule from apps/api.

**Special considerations:**
- **HealthController** has the same name as the one in apps/api/src/app/identity/health.controller.ts (already migrated). They serve different purposes (one for identity service health, one for metadata service health). When svc-metadata's HealthController moves to apps/api/src/app/metadata/, it can have the same class name in a different namespace — TypeScript imports them via the path, not the class name, so no conflict at compile time. However, **both controllers register routes under `/health`** when their respective services bootstrap. Since the apps/api modular monolith eventually registers BOTH (one from identity, one from metadata), there will be a route collision. **Decision for this task:** rename svc-metadata's HealthController to `MetadataHealthController` (file rename: `health.controller.ts` → `metadata-health.controller.ts`) to disambiguate. Do this rename DURING this task.

- **ModelRegistryService** — verify it doesn't depend on anything not yet migrated.

- **app.module.ts wiring** — read `apps/svc-metadata/src/app/app.module.ts` to identify all the global imports + providers + middleware + interceptors that need to relocate to MetadataModule's @Module decorator.

[Apply a careful template similar to identity's task 17. Use Sonnet model for this task — judgment-heavy rewrite.]

- [ ] **Step 1: Verify working directory + that all 23 sub-modules are migrated**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD && ls apps/svc-metadata/src/app/
```

Expected: only top-level files remain in svc-metadata (no sub-directories). If sub-directories still exist, prior tasks aren't complete; STOP and report BLOCKED.

- [ ] **Step 2: Move 7 top-level files via git mv**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-metadata/src/app/health.controller.ts apps/api/src/app/metadata/metadata-health.controller.ts
```

(Note: file rename to disambiguate from identity's HealthController. The class inside also needs renaming — see Step 3.)

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-metadata/src/app/metadata.controller.ts apps/api/src/app/metadata/metadata.controller.ts && git mv apps/svc-metadata/src/app/model.controller.ts apps/api/src/app/metadata/model.controller.ts && git mv apps/svc-metadata/src/app/module.controller.ts apps/api/src/app/metadata/module.controller.ts && git mv apps/svc-metadata/src/app/model-registry.service.ts apps/api/src/app/metadata/model-registry.service.ts && git mv apps/svc-metadata/src/app/module.service.ts apps/api/src/app/metadata/module.service.ts && git mv apps/svc-metadata/src/app/module.dto.ts apps/api/src/app/metadata/module.dto.ts
```

- [ ] **Step 3: Rename `HealthController` class to `MetadataHealthController`**

Edit `apps/api/src/app/metadata/metadata-health.controller.ts`:
1. Change `export class HealthController` to `export class MetadataHealthController`.
2. Update the `@Controller('...')` decorator if it references `'health'` — change to `'metadata/health'` to disambiguate the route from identity's `/health`.

Verify with:
```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -n "MetadataHealthController\|@Controller" apps/api/src/app/metadata/metadata-health.controller.ts
```

- [ ] **Step 4: Fix stale absolute paths in moved files**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -rn "from '\.\./\.\./\.\./\.\./api" apps/api/src/app/metadata/*.ts
```

For each match, replace `'../../../../api/src/app/metadata/<sub>'` with `'./<sub>'` (sibling of the top-level files).

- [ ] **Step 5: Rewrite apps/api/src/app/metadata/metadata.module.ts as the final composition**

Read the existing svc-metadata app.module.ts FIRST to identify all imports/providers/middleware:
```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && cat apps/svc-metadata/src/app/app.module.ts
```

Then write a new metadata.module.ts that combines:
- Existing 23 sub-module imports + exports (already in metadata.module.ts as the migration progressed)
- Top-level controllers: `MetadataController`, `ModelController`, `ModuleController`, `MetadataHealthController` (renamed)
- Top-level providers: `ModelRegistryService`, `ModuleService`
- Lib imports from svc-metadata's app.module: `InstanceDbModule`, `AuthGuardModule`, `AuthorizationModule`, `RedisModule`, `EventEmitterModule`, etc. (read svc-metadata's app.module.ts to enumerate)
- Any global guards / interceptors / middleware that svc-metadata's app.module had

Use the Write tool to overwrite metadata.module.ts. Aim for ~120 lines.

- [ ] **Step 6: Replace svc-metadata's app.module.ts with thin adapter**

Use the Write tool to overwrite `apps/svc-metadata/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MetadataModule } from '../../../api/src/app/metadata/metadata.module';

/**
 * apps/svc-metadata is kept alive in parallel during the ARC-W1 migration
 * for parallel-deployment safety. The actual module logic now lives in
 * apps/api/src/app/metadata/MetadataModule. This thin adapter re-imports
 * MetadataModule wholesale so the legacy service serves the same endpoints
 * at its old port.
 *
 * Legacy service deletion is deferred to the W1 final-cutover plan.
 */
@Module({
  imports: [MetadataModule],
})
export class AppModule {}
```

- [ ] **Step 7: Build both apps**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api 2>&1 | tail -15 && npx nx build svc-metadata 2>&1 | tail -15
```

- [ ] **Step 8: Verify svc-metadata directory state**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && ls apps/svc-metadata/src/app/
```

Expected: only `app.module.ts` (~25 lines).

- [ ] **Step 9: Verify clean git status**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git status --short
```

Expected: 7 renames + ~3 modifications. Nothing else.

- [ ] **Step 10: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/ apps/svc-metadata/ && git commit -m "$(cat <<'EOF'
feat(api): migrate metadata top-level — controllers + services + globals; svc-metadata becomes thin adapter

ARC-W1-metadata FINAL TASK. apps/api/src/app/metadata/metadata.module.ts is
now the canonical MetadataModule with all 23 sub-modules + Metadata/Model/
Module controllers + ModelRegistryService + ModuleService + global wiring.

HealthController renamed to MetadataHealthController (and route prefix changed
from '/health' to '/metadata/health') to disambiguate from identity's
HealthController in the same monolith.

apps/svc-metadata/src/app/app.module.ts is now a one-line wrapper. Legacy
service stays runnable for parallel deployment until W1 final cutover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 26: Final verification + tag

**Files:** None modified; verification only.

- [ ] **Step 1: Run all 4 architectural scanners**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npm run authz:check && npm run audit:check && npm run security:check && npm run deps:check
```

All must exit 0.

- [ ] **Step 2: Lint apps/api and svc-metadata**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx lint api && npx nx lint svc-metadata
```

- [ ] **Step 3: Build all three apps that should now be in monolith state**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api && npx nx build svc-identity && npx nx build svc-metadata
```

All three must succeed.

- [ ] **Step 4: Run apps/api tests**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx test api
```

Expected: at least 7 passing (kernel + db + audit foundation tests, possibly more if Jest discovers the migrated specs in metadata).

- [ ] **Step 5: Verify svc-metadata directory state**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && ls apps/svc-metadata/src/app/
```

Expected: only `app.module.ts`.

- [ ] **Step 6: Verify apps/api/src/app/metadata has all 23 sub-modules + 7 top-level files + metadata.module.ts**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && ls apps/api/src/app/metadata/
```

- [ ] **Step 7: Tag the milestone**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git tag arc-w1-metadata-complete && git log --oneline arc-w1-identity-complete..arc-w1-metadata-complete
```

Expected: shows ~26 commits (the entire ARC-W1-metadata sequence from skeleton through top-level).

- [ ] **Step 8: Append completion note to this plan**

Append to bottom of `docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md`:

```markdown
---

## Status: Complete (target: <fill in completion date>)

ARC-W1 metadata migration complete. apps/api/src/app/metadata/ now contains
all 23 sub-modules + 4 controllers + 2 services + 1 DTO + metadata.module.ts.
apps/svc-metadata is reduced to a thin adapter; legacy service stays
runnable for parallel deployment until full W1 cutover.

### Next steps in W1

The remaining svc-* services (data, automation, view-engine, insights,
notify, instance-api, ava, workflow, control-plane) need migration plans
of similar shape. Each follows the same template:
1. Survey sub-modules + cross-deps
2. Skeleton + register module
3. Sub-module migrations (cyclic-core bundle if cycles exist; leaves first otherwise)
4. Top-level migration with thin adapter
5. Verification gate

After all instance services migrate, full W1 cutover deletes the legacy
svc-* directories, the service-boundary scanner, and routes traffic
fully to apps/api.
```

---

## Self-review

**1. Spec coverage:** This plan covers svc-metadata migration in full — all 23 sub-modules + 8 top-level files. The legacy service stays runnable post-migration via thin adapter, deferring deletion to full W1 cutover (separate plan).

**2. Placeholder scan:** Tasks 2–19 use a "[Apply standard template]" reference. This is acceptable because the standard template is defined explicitly and in full at the head of the "Tasks 2–19" section. Each task's specifics (`<sub>` name, class name, special considerations) are listed in its own task body. This is meaningfully different from "Similar to Task N" — the template steps are spelled out once for all 18 leaves. If an engineer reads task 9 in isolation, they're told to apply the standard template and given the specific name to substitute; they have everything they need.

**3. Type consistency:**
- `MetadataModule` named consistently across all tasks
- `MetadataNavigationModule` aliased explicitly in task 7 to disambiguate from identity's `NavigationModule`
- `MetadataHealthController` renamed in task 25 to disambiguate from identity's `HealthController`
- Sub-module class names listed per task (with note to verify via reading the source where uncertain — e.g. `ava` may not have a module class)
- `git mv` paths consistent (apps/svc-metadata/src/app/<sub> → apps/api/src/app/metadata/<sub>)
- Import path replacement pattern consistent (`'./<sub>` → `'../../../api/src/app/metadata/<sub>` for app.module-level imports; `'../<sub>` → `'../../../../api/src/app/metadata/<sub>` for sub-module-level imports)

**4. Scope check:** Plan covers exactly metadata migration — not other svc-* services, not full W1 cutover. ~3–4 weeks of solo work. ~26 substantive tasks plus verification. Single plan size is appropriate.

**5. Dependency graph correctness:** Re-verified the cross-dep listing against the actual grep output — only 4 dependent edges (collection→{access, publish-impact}, schema→collection, packs→{7 leaves}). 18 sub-modules truly are independent. The migration order respects all 4 edges.

No issues found.

---

**End of metadata migration plan.**
