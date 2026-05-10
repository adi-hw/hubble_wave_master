# Platform W1 Data Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the entire `apps/svc-data` Nest application (12 sub-directories + 7 top-level files + 1 types file = ~17,700 LoC across ~66 files) into `apps/api/src/app/data/`, sub-module by sub-module, using `git mv` to preserve history and keeping `apps/svc-data` runnable in parallel via a thin adapter at the end.

**Architecture:** svc-data's cross-module dependency graph is a clean DAG (no cycles). 5 of its 12 sub-directories have zero cross-module dependencies. 2 are dependent on other sub-modules (`computed` → `formula`, `integration` → `events`). 3 depend on top-level files (`work` and `offerings` need `collection-data.service`; `grid` needs `model-registry.service`); these migrate after a mid-stream top-level service-file move. Sub-directory pattern split: 8 are standard `*.module.ts`-wrapped (ava, computed, defaults, formula, grid, integration, validation, workflow); 4 are service-only flat folders whose providers register directly in `app.module.ts` (automation, events, offerings, work) — analogous to metadata's `InsightsIngestService`/`AvaIngestService` pattern.

**Tech Stack:** TypeScript 5.9, NestJS 11, TypeORM 0.3, Postgres, Nx 22 monorepo, Jest 30. Existing platform deps: `@hubblewave/auth-guard`, `@hubblewave/authorization`, `@hubblewave/instance-db`, `@hubblewave/redis`. svc-data also uses `@nestjs/cache-manager` and `@nestjs/schedule`.

**Spec reference:** `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §2 (target architecture) + §9 (canon delta).

**Predecessor plans:**
- `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md` (status `arc-w1-foundation-partial`)
- `docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md` (status `arc-w1-identity-complete`)
- `docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md` (status `arc-w1-metadata-complete`)

This plan continues by migrating data. It is **structurally similar to the metadata plan** (clean DAG, no cyclic-core bundle) with one twist: a mid-stream top-level service-file move (Task 12) so that the three sub-modules with top-level dependencies can build cleanly.

**Solo founder, ~3 weeks of work.** ~17 bite-sized tasks. Each task is independently reversible.

---

## Sub-module inventory (measured 2026-05-10)

The migration order respects the cross-module dependency graph. Independent leaves first (any order, smallest first); then sub-modules that depend on already-migrated leaves; then top-level service files; then sub-modules that depend on those; then final composition.

| Sub-module | Files | LoC | Specs | Pattern | Cross-deps | Migration order |
|---|---|---|---|---|---|---|
| `workflow` | 3 | 182 | 0 | Standard module (`WorkflowModule`) | none | independent leaf |
| `events` | 1 | 151 | 0 | Service-only (`EventOutboxService`) | none (but consumed by integration + offerings) | independent leaf — do early |
| `automation` | 1 | 212 | 1 | Service-only (`SyncTriggerClientService`) | `src/types/automation.types` (relocates with this task) | independent leaf |
| `defaults` | 5 | 980 | 0 | Standard module (`DefaultsModule`) | none | independent leaf |
| `validation` | 5 | 1,249 | 1 | Standard module (`ValidationModule`) | none | independent leaf |
| `ava` | 5 | 1,350 | 0 | Standard module (`AVAModule` — note all-caps) | none | independent leaf |
| `formula` | 9 | 1,803 | 0 | Standard module (`FormulaModule`) | none (but consumed by computed) | independent leaf — do before computed |
| **`computed`** | **3** | **704** | **2** | **Standard module (`ComputedModule`)** | **formula** | dependent — after formula |
| **`integration`** | **13** | **4,627** | **1** | **Standard module (`IntegrationModule`)** | **events** | dependent — after events; biggest single sub-module |
| **Top-level service files** | 3 | 2,933 | 1 | n/a | — | mid-stream — see Task 12 |
| **`work`** | **2** | **192** | **0** | **Service-only (`WorkController`, `WorkService`)** | **top-level `collection-data.service`** | dependent — after Task 12 |
| **`offerings`** | **2** | **245** | **0** | **Service-only (`OfferingsController`, `OfferingsService`)** | **events, top-level `collection-data.service`** | dependent — after Task 12 |
| **`grid`** | **3** | **1,149** | **0** | **Standard module (`GridModule`)** | **top-level `model-registry.service`** | dependent — after Task 12 |
| Final top-level files (4) | 4 | ~1,060 | 1 | controllers + DataService + thin adapter | varies | last (after all sub-modules + the 3 mid-stream service files) |
| **Total** | **~66** | **~17,700** | **7** | | | |

### File-pattern split

- **Standard sub-modules** (8): each has its own `*.module.ts` with a `@Module` decorator. Migration registers `<X>Module` in `imports: []` and `exports: []` of the destination `data.module.ts`.
- **Service-only sub-directories** (4): no `*.module.ts`. Their controllers/services register directly in svc-data's `app.module.ts` via `controllers: []` / `providers: []`. Migration moves the directory and re-registers the same controllers/providers in `data.module.ts` — no module-class registration needed.
- **Top-level files** (7): 3 controllers (`data.controller`, `health.controller`, `collection-data.controller`), 3 services (`data.service`, `model-registry.service`, `collection-data.service`), 1 `app.module.ts`. The 3 services include the 2 (`collection-data.service`, `model-registry.service`) that sub-modules depend on, hence the mid-stream split.
- **`src/types/automation.types.ts`** (1 file, 223 LoC): only consumed by `automation/sync-trigger-client.service.ts`. Colocate with automation in destination (`apps/api/src/app/data/automation/automation.types.ts`) and rewrite the one import.

### Migration order (concrete)

1. **Skeleton + register** — empty DataModule
2. **`workflow`** (3 files, 182 LoC) — smallest standard module
3. **`events`** (1 file, 151 LoC) — service-only; needed early (consumed by integration + offerings)
4. **`automation`** (1 file, 212 LoC + 1 types file, 223 LoC) — service-only; types file colocated
5. **`defaults`** (5 files, 980 LoC) — standard module
6. **`validation`** (5 files, 1,249 LoC) — standard module
7. **`ava`** (5 files, 1,350 LoC) — standard module (all-caps `AVAModule`)
8. **`formula`** (9 files, 1,803 LoC) — standard module; needed before computed
9. **`computed`** (3 files, 704 LoC) — standard module; depends on formula (now satisfied)
10. **`integration`** (13 files, 4,627 LoC) — standard module; depends on events (now satisfied); biggest
11. _(no task — see Task 12)_
12. **Mid-stream top-level service files** — `collection-data.service.ts` + spec + `model-registry.service.ts`. Move only these 3 files, NOT controllers, NOT app.module. svc-data app.module's import paths for these update to apps/api.
13. **`work`** (2 files, 192 LoC) — service-only; depends on top-level `collection-data.service` (now in apps/api)
14. **`offerings`** (2 files, 245 LoC) — service-only; depends on top-level `collection-data.service` + events (both ready)
15. **`grid`** (3 files, 1,149 LoC) — standard module; depends on top-level `model-registry.service` (now ready)
16. **Final top-level migration** — `data.controller.ts`, `health.controller.ts`, `collection-data.controller.ts`, `data.service.ts` + spec; rewrite `data.module.ts` final composition; replace svc-data `app.module.ts` with thin adapter
17. **Verification gate** (build, scanners, tag `arc-w1-data-complete`)

### Pre-flight checks per task

For every sub-module migration task, the prompt MUST include these checks (lessons from identity + metadata migrations):

1. **Working directory** — verify pwd + branch + expected HEAD before any edit
2. **Empty-directory check** — `find apps/api/src/app/data -type d -empty` to catch residual empty dirs from prior failed attempts (Windows/OneDrive quirk that causes `git mv` to nest source inside destination)
3. **No `.vscode`, `nx.json`, `package.json`, `package-lock.json`, `.gitignore`, `tsconfig.base.json`, `tools/`, `docs/` modifications** — explicit forbidden file list
4. **`git mv` only** — no copies, no creating new files in svc-data
5. **Authorized recovery path** — `git reset --hard <previous-commit>` if state is broken

These constraints repeat in every task body; do not skip them.

---

## Files Created/Modified Overview

### Per task (template — applies to every standard sub-module migration task)

**Modified:**
- `apps/svc-data/src/app/app.module.ts` — change `from './<sub>/<sub>.module'` to `from '../../../api/src/app/data/<sub>/<sub>.module'` for the migrating sub-module
- `apps/api/src/app/data/data.module.ts` — add the migrated sub-module to its imports + exports arrays
- (possibly) other files in svc-data that imported from the migrating sub-module — paths updated similarly

**Moved (`git mv`):**
- `apps/svc-data/src/app/<sub>/` → `apps/api/src/app/data/<sub>/`

### Per task (template — applies to every service-only sub-module migration task)

**Modified:**
- `apps/svc-data/src/app/app.module.ts` — change `from './<sub>/<file>'` to `from '../../../api/src/app/data/<sub>/<file>'` for each migrating file (no module-class change since these are flat folders)
- `apps/api/src/app/data/data.module.ts` — add the controllers/services to its `controllers: []` / `providers: []` arrays directly (no module-class wrapper)

**Moved (`git mv`):**
- `apps/svc-data/src/app/<sub>/` → `apps/api/src/app/data/<sub>/`

### Plan-end state

- `apps/api/src/app/data/` contains all 12 sub-directories + 6 top-level files (DataController, HealthController, CollectionDataController, DataService, ModelRegistryService, CollectionDataService) + `data.module.ts` (the full composition) + `automation/automation.types.ts` (relocated from `apps/svc-data/src/types/`)
- `apps/api/src/app/app.module.ts` registers `DataModule` after `MetadataModule`
- `apps/svc-data/src/app/app.module.ts` is a thin wrapper that imports DataModule from apps/api (one substantive line of code)
- `apps/svc-data/src/main.ts` and `project.json` remain unchanged; legacy service stays runnable
- `apps/svc-data/src/types/` directory is deleted (its only file relocated in Task 4)
- Legacy service deletion is deferred to the W1 final-cutover plan (not this one)

---

## Task 1: Create apps/api/src/app/data skeleton

**Files:**
- Create: `apps/api/src/app/data/data.module.ts` (empty composition)
- Modify: `apps/api/src/app/app.module.ts` (register DataModule)

**Why this matters:** Establishes the destination module. Subsequent sub-module migrations register themselves into this skeleton's imports/providers/controllers arrays.

- [ ] **Step 1: Verify working directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD && git log --oneline -1
```
Expected: `pwd` ends with `nervous-volhard-f9abc2`; branch `claude/nervous-volhard-f9abc2`; HEAD `0b2f0d9` (the metadata-complete commit) or later.

- [ ] **Step 2: Empty-directory pre-flight check**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && find apps/api/src/app/data -type d -empty 2>&1
```

If the output shows `apps/api/src/app/data` (directory exists empty), remove it before creating the skeleton:
```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && rmdir apps/api/src/app/data 2>/dev/null
```

- [ ] **Step 3: Create the directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && mkdir -p apps/api/src/app/data
```

- [ ] **Step 4: Create data.module.ts skeleton**

Write `apps/api/src/app/data/data.module.ts`:

```typescript
import { Module } from '@nestjs/common';

/**
 * DataModule consolidates everything from apps/svc-data into the apps/api
 * modular monolith. Sub-modules migrate one at a time via git mv; each
 * migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-data-migration.md):
 *   Standard modules:
 *     [ ] workflow
 *     [ ] defaults
 *     [ ] validation
 *     [ ] ava
 *     [ ] formula
 *     [ ] computed
 *     [ ] integration
 *     [ ] grid
 *   Service-only sub-directories:
 *     [ ] events
 *     [ ] automation
 *     [ ] work
 *     [ ] offerings
 *   Top-level service files (mid-stream):
 *     [ ] collection-data.service + spec
 *     [ ] model-registry.service
 *   Final top-level (controllers, data.service, app.module thin adapter):
 *     [ ] data.controller, health.controller, collection-data.controller
 *     [ ] data.service + spec
 *     [ ] data.module final composition
 *     [ ] svc-data app.module thin adapter
 *
 * DataModule re-exports each migrated sub-module so that:
 * - apps/api consumers (automation, ava, etc.) can inject data services
 *   without explicit sub-module imports
 * - apps/svc-data's thin adapter (post-migration) can import DataModule
 *   wholesale to keep the legacy service serving the same endpoints
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class DataModule {}
```

- [ ] **Step 5: Register DataModule in apps/api AppModule**

Edit `apps/api/src/app/app.module.ts`. It currently has `[KernelModule, DbModule, AuditModule, IdentityModule, MetadataModule]`. Add `DataModule` import + register in imports array.

After: `imports: [KernelModule, DbModule, AuditModule, IdentityModule, MetadataModule, DataModule]`.

- [ ] **Step 6: Verify build**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/ && git commit -m "$(cat <<'EOF'
feat(api): create empty DataModule skeleton in apps/api

ARC-W1-data task 1. Empty DataModule registered in AppModule;
sub-modules migrate into it one at a time via subsequent tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Tasks 2–10: Sub-module migrations (8 standard + 2 service-only, in dependency order)

Each follows one of two standard templates. The bodies are repeated explicitly below — do not skip steps even if they look the same.

### Standard template A: standard sub-module (has `*.module.ts` with `@Module`)

1. Verify working directory + branch + expected HEAD
2. Empty-directory pre-flight check (`find apps/api/src/app/data -type d -empty`); rmdir any empty `<sub>/` from prior failed attempts
3. `git mv apps/svc-data/src/app/<sub> apps/api/src/app/data/<sub>`
4. Verify clean move (no nested `<sub>/<sub>/` structure): `ls apps/api/src/app/data/<sub>/`
5. Fix stale absolute paths inside the moved files (any `'../../../../api/src/app/data/...'` paths from prior attempts → `'./<sibling>'` if the sibling is migrated). Use grep:
   `grep -rn "from '\.\./\.\./\.\./\.\./api" apps/api/src/app/data/<sub>/`
6. Find svc-data imports referencing the migrating sub-module — `grep -rn "from '\./<sub>\|from '\.\./<sub>" apps/svc-data/src --include="*.ts"`
7. Update each match: 3-level-up paths from `apps/svc-data/src/app/`, 4-level-up from `apps/svc-data/src/app/<other-sub>/`. Pattern: `'./<sub>/<sub>.module'` → `'../../../api/src/app/data/<sub>/<sub>.module'`
8. Verify zero orphan imports remain in svc-data: `grep -rn "from '\./<sub>\|from '\.\./<sub>" apps/svc-data/src --include="*.ts"` should return nothing for the migrating sub-module
9. Update `apps/api/src/app/data/data.module.ts`: add `import { <ClassName>Module } from './<sub>/<sub>.module';`, register in `imports: []` and `exports: []`, mark `[x] <sub>` checkbox
10. Build both apps (`nx build api` + `nx build svc-data`); both must succeed
11. Verify clean git status (no nx.json, .vscode, package.json modifications; no new files in svc-data)
12. Commit with message `feat(api): migrate <sub>/ (<ClassName>Module) from svc-data into apps/api/data`

### Standard template B: service-only sub-directory (no `*.module.ts`)

1. Verify working directory + branch + expected HEAD
2. Empty-directory pre-flight check
3. `git mv apps/svc-data/src/app/<sub> apps/api/src/app/data/<sub>`
4. Verify clean move
5. Fix stale absolute paths inside the moved files
6. Find svc-data imports referencing the migrating sub-directory — `grep -rn "from '\./<sub>\|from '\.\./<sub>" apps/svc-data/src --include="*.ts"`
7. Update each match
8. Verify zero orphan imports remain in svc-data
9. Update `apps/api/src/app/data/data.module.ts`: directly add the controllers to `controllers: []` and services to `providers: []` (no module-class wrapper). Mark `[x] <sub>` checkbox.
10. Build both apps
11. Verify clean git status
12. Commit with message `feat(api): migrate <sub>/ (service-only) from svc-data into apps/api/data`

---

### Task 2: Migrate `workflow` (3 files, 182 LoC, 0 specs)

**Pattern:** Standard template A. **Class name:** `WorkflowModule`. **Cross-deps:** none. Smallest standard sub-module — good first migration.

[Apply standard template A with `<sub>` = workflow and `<ClassName>Module` = WorkflowModule]

### Task 3: Migrate `events` (1 file, 151 LoC, 0 specs)

**Pattern:** Standard template B. **Service:** `EventOutboxService`. **Cross-deps:** none (but consumed by integration + offerings later).

After moving the directory, in the destination `data.module.ts`:
- Add `import { EventOutboxService } from './events/event-outbox.service';`
- Add `EventOutboxService` to `providers: []` and `exports: []` (so integration + offerings can inject it after they migrate)
- Mark `[x] events`

[Apply standard template B; verify the file is `event-outbox.service.ts`]

### Task 4: Migrate `automation` (1 file, 212 LoC, 1 spec) — colocated types

**Pattern:** Standard template B with extra step. **Service:** `SyncTriggerClientService`. **Cross-deps:** imports from `'../../types/automation.types'` (which lives at `apps/svc-data/src/types/automation.types.ts`, 223 LoC).

**Reason for colocation:** the types file is consumed only by automation. Move it inside automation's destination to keep coupling tight and make svc-data's `src/types/` directory completely empty (deletable in the final task).

- [ ] **Step 1: Verify working directory + empty-dir check**

(Standard pre-flight)

- [ ] **Step 2: Move automation directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-data/src/app/automation apps/api/src/app/data/automation
```

- [ ] **Step 3: Move types/automation.types.ts (colocate inside automation)**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-data/src/types/automation.types.ts apps/api/src/app/data/automation/automation.types.ts
```

- [ ] **Step 4: Update the import in sync-trigger-client.service.ts**

Edit `apps/api/src/app/data/automation/sync-trigger-client.service.ts`:
- Change `import { ExecutionContext, QueuedAction } from '../../types/automation.types';`
- To `import { ExecutionContext, QueuedAction } from './automation.types';`

Verify with:
```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -n "automation.types" apps/api/src/app/data/automation/sync-trigger-client.service.ts
```

- [ ] **Step 5: Update svc-data app.module.ts SyncTriggerClientService import**

Edit `apps/svc-data/src/app/app.module.ts`:
- Change `import { SyncTriggerClientService } from './automation/sync-trigger-client.service';`
- To `import { SyncTriggerClientService } from '../../../api/src/app/data/automation/sync-trigger-client.service';`

- [ ] **Step 6: Check whether `apps/svc-data/src/types/` is now empty**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && ls apps/svc-data/src/types/
```

If empty, remove the directory:
```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && rmdir apps/svc-data/src/types
```

- [ ] **Step 7: Update apps/api/src/app/data/data.module.ts**

Add:
- `import { SyncTriggerClientService } from './automation/sync-trigger-client.service';`
- `SyncTriggerClientService` in `providers: []` and `exports: []`
- Mark `[x] automation`

- [ ] **Step 8: Build both apps**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api 2>&1 | tail -10 && npx nx build svc-data 2>&1 | tail -10
```

- [ ] **Step 9: Verify clean git status**

Expected: 1 directory rename (`automation/`), 1 file rename (`automation.types.ts` to its new path), 1 modification (`apps/svc-data/src/app/app.module.ts`), 1 modification (`apps/api/src/app/data/data.module.ts`), 1 modification (`apps/api/src/app/data/automation/sync-trigger-client.service.ts`), 1 directory removal (`apps/svc-data/src/types/`).

- [ ] **Step 10: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/ apps/svc-data/ && git commit -m "$(cat <<'EOF'
feat(api): migrate automation/ (service-only + colocated types) from svc-data into apps/api/data

ARC-W1-data task 4. SyncTriggerClientService relocates from svc-data into
apps/api/data/automation. The types file at apps/svc-data/src/types/automation.types.ts
colocates inside the new automation/ directory and the one consumer's import
changes from '../../types/automation.types' to './automation.types'.

The empty apps/svc-data/src/types/ directory is removed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5: Migrate `defaults` (5 files, 980 LoC, 0 specs)

**Pattern:** Standard template A. **Class name:** `DefaultsModule`. **Cross-deps:** none.

[Apply standard template A with `<sub>` = defaults and `<ClassName>Module` = DefaultsModule]

### Task 6: Migrate `validation` (5 files, 1,249 LoC, 1 spec)

**Pattern:** Standard template A. **Class name:** `ValidationModule`. **Cross-deps:** none.

[Apply standard template A with `<sub>` = validation and `<ClassName>Module` = ValidationModule]

### Task 7: Migrate `ava` (5 files, 1,350 LoC, 0 specs) — note all-caps class name

**Pattern:** Standard template A. **Class name:** `AVAModule` (verify by reading `ava/ava.module.ts`; the class is conventionally all-caps in svc-data even though the directory is lowercase). **Naming caution:** there is also an `ava` sub-module in metadata (`apps/api/src/app/metadata/ava`, an `AvaIngestService`). The data ava is distinct — the path `apps/api/src/app/data/ava` keeps it separate. The class names also differ (`AVAModule` here vs metadata's service-only `AvaIngestService`), so no alias is needed. Verify before migration.

[Apply standard template A with `<sub>` = ava and `<ClassName>Module` = AVAModule]

### Task 8: Migrate `formula` (9 files, 1,803 LoC, 0 specs)

**Pattern:** Standard template A. **Class name:** `FormulaModule`. **Cross-deps:** none (but `computed` depends on it — must migrate before Task 9).

[Apply standard template A with `<sub>` = formula and `<ClassName>Module` = FormulaModule]

### Task 9: Migrate `computed` (3 files, 704 LoC, 2 specs) — depends on formula

**Pattern:** Standard template A. **Class name:** `ComputedModule`. **Cross-deps:** formula (Task 8 — now satisfied).

The internal imports in computed reference formula via:
- `computed.module.ts: import { FormulaModule } from '../formula/formula.module';`
- `computed-outbox-processor.service.ts: import { RollupService } from '../formula/rollup.service';`
- `computed-property-dispatcher.service.ts: import { FormulaService } from '../formula/formula.service';`
- `computed-property-dispatcher.service.ts: import { LookupService } from '../formula/lookup.service';`
- `computed-property-dispatcher.service.ts: import { HierarchicalService } from '../formula/hierarchical.service';`

After computed migrates, these `'../formula/...'` paths resolve correctly because both `computed/` and `formula/` are now siblings in `apps/api/src/app/data/`. No path rewriting needed inside computed's files.

[Apply standard template A with `<sub>` = computed and `<ClassName>Module` = ComputedModule; pay attention to step 5 (no path rewrites needed if formula already migrated correctly)]

### Task 10: Migrate `integration` (13 files, 4,627 LoC, 1 spec) — depends on events; biggest

**Pattern:** Standard template A. **Class name:** `IntegrationModule`. **Cross-deps:** events (Task 3 — now satisfied). Largest single sub-module in svc-data.

The internal imports in integration reference events via:
- `integration.module.ts: import { EventOutboxService } from '../events/event-outbox.service';`
- `connector.service.ts: import { EventOutboxService } from '../events/event-outbox.service';`

After migration, both paths resolve correctly because integration and events are siblings in `apps/api/src/app/data/`.

[Apply standard template A with `<sub>` = integration and `<ClassName>Module` = IntegrationModule; this is the largest sub-module so allocate extra time and verify the build carefully]

---

## Task 11: _(reserved — see Task 12)_

Numbering preserved for clarity; the inventory table reserves slot 11 for narrative continuity but the actual mid-stream service-file move is Task 12.

---

## Task 12: Mid-stream top-level service files (3 files)

**Files:**
- Move: `apps/svc-data/src/app/collection-data.service.ts` → `apps/api/src/app/data/collection-data.service.ts`
- Move: `apps/svc-data/src/app/collection-data.service.spec.ts` → `apps/api/src/app/data/collection-data.service.spec.ts`
- Move: `apps/svc-data/src/app/model-registry.service.ts` → `apps/api/src/app/data/model-registry.service.ts`
- Modify: `apps/svc-data/src/app/app.module.ts` — update imports of these 3 files to point to apps/api
- Modify: `apps/api/src/app/data/data.module.ts` — register the 3 services in providers + exports

**Why this matters:** The 3 remaining sub-directories (`work`, `offerings`, `grid`) depend on these top-level services. Migrating them mid-stream means each of those sub-modules can do a clean `'./../<service>'` resolution after they migrate (because `'..'` from `apps/api/src/app/data/<sub>/` is `apps/api/src/app/data/`, where the services now live).

**This task does NOT touch:**
- The 3 controllers (data.controller, health.controller, collection-data.controller) — they migrate in Task 16
- `data.service.ts` + spec — also Task 16 (data.service is consumed only by data.controller and DataController, which themselves migrate as a group)
- `app.module.ts` rewrite — Task 16

- [ ] **Step 1: Verify working directory + that Tasks 2–10 are complete**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD && ls apps/svc-data/src/app/
```

Expected: directories that remain in svc-data are `work/`, `offerings/`, `grid/`. Top-level files remain. If other sub-modules still exist as directories under svc-data (other than work/offerings/grid), prior tasks aren't complete; STOP and report BLOCKED.

- [ ] **Step 2: Empty-dir pre-flight**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && find apps/api/src/app/data -type d -empty
```

- [ ] **Step 3: Move the 3 top-level service files**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-data/src/app/collection-data.service.ts apps/api/src/app/data/collection-data.service.ts && git mv apps/svc-data/src/app/collection-data.service.spec.ts apps/api/src/app/data/collection-data.service.spec.ts && git mv apps/svc-data/src/app/model-registry.service.ts apps/api/src/app/data/model-registry.service.ts
```

- [ ] **Step 4: Verify the moved files have no broken imports**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -n "from '\." apps/api/src/app/data/collection-data.service.ts apps/api/src/app/data/model-registry.service.ts apps/api/src/app/data/collection-data.service.spec.ts | head -30
```

The imports should reference `@hubblewave/*` libs and absolute paths to other services. If any `'./...'` or `'../...'` paths exist that won't resolve in apps/api, fix them. Specifically check for `'./events/event-outbox.service'` — if present, it's now sibling-correct since events already migrated; no rewrite needed.

- [ ] **Step 5: Update svc-data app.module.ts to import these from apps/api**

Edit `apps/svc-data/src/app/app.module.ts`. Change:
```typescript
import { ModelRegistryService } from './model-registry.service';
import { CollectionDataService } from './collection-data.service';
```

To:
```typescript
import { ModelRegistryService } from '../../../api/src/app/data/model-registry.service';
import { CollectionDataService } from '../../../api/src/app/data/collection-data.service';
```

- [ ] **Step 6: Update apps/api/src/app/data/data.module.ts**

Add:
```typescript
import { ModelRegistryService } from './model-registry.service';
import { CollectionDataService } from './collection-data.service';
```

Register in `providers: []` and `exports: []`. Mark these checkboxes:
```
[x] collection-data.service + spec
[x] model-registry.service
```

- [ ] **Step 7: Build both apps**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api 2>&1 | tail -15 && npx nx build svc-data 2>&1 | tail -15
```

Both must succeed.

- [ ] **Step 8: Verify clean git status**

Expected: 3 file renames, 2 modifications (svc-data app.module.ts, apps/api data.module.ts).

- [ ] **Step 9: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/ apps/svc-data/ && git commit -m "$(cat <<'EOF'
feat(api): migrate top-level service files (collection-data.service, model-registry.service) mid-stream

ARC-W1-data task 12. The 3 sub-directories that remain (work, offerings,
grid) depend on these top-level services. Moving the services first lets
those sub-modules migrate with clean sibling-relative imports
('../collection-data.service' resolves correctly from apps/api/src/app/data/<sub>/).

Top-level controllers, data.service, and the app.module rewrite remain in
the final composition task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Tasks 13–15: Sub-modules dependent on top-level service files

### Task 13: Migrate `work` (2 files, 192 LoC, 0 specs)

**Pattern:** Standard template B (service-only). **Files:** `work.controller.ts`, `work.service.ts`. **Cross-deps:** top-level `collection-data.service` (now in apps/api after Task 12).

The internal imports in work reference top-level via:
- `work.service.ts: import { CollectionDataService, QueryOptions } from '../collection-data.service';`
- `work.controller.ts: import { QueryOptions } from '../collection-data.service';`

After work migrates to `apps/api/src/app/data/work/`, the path `'../collection-data.service'` resolves to `apps/api/src/app/data/collection-data.service` — which now exists thanks to Task 12. ✓

[Apply standard template B with `<sub>` = work; the destination data.module.ts gains `WorkController` in `controllers: []` and `WorkService` in `providers: []` + `exports: []`]

### Task 14: Migrate `offerings` (2 files, 245 LoC, 0 specs)

**Pattern:** Standard template B (service-only). **Files:** `offerings.controller.ts`, `offerings.service.ts`. **Cross-deps:** top-level `collection-data.service` (Task 12) + events (Task 3) — both satisfied.

The internal imports in offerings reference these via:
- `offerings.service.ts: import { CollectionDataService, QueryOptions } from '../collection-data.service';`
- `offerings.service.ts: import { EventOutboxService } from '../events/event-outbox.service';`
- `offerings.controller.ts: import { QueryOptions } from '../collection-data.service';`

After offerings migrates, both paths resolve correctly because top-level service files and events sub-directory are all siblings in `apps/api/src/app/data/`.

[Apply standard template B with `<sub>` = offerings; destination data.module.ts gains `OfferingsController` in `controllers: []` and `OfferingsService` in `providers: []` + `exports: []`]

### Task 15: Migrate `grid` (3 files, 1,149 LoC, 0 specs)

**Pattern:** Standard template A (standard module). **Class name:** `GridModule`. **Cross-deps:** top-level `model-registry.service` (Task 12 — now satisfied).

The internal imports in grid reference top-level via:
- `grid.module.ts: import { ModelRegistryService } from '../model-registry.service';`
- `grid-query.service.ts: import { ModelRegistryService } from '../model-registry.service';`

After grid migrates to `apps/api/src/app/data/grid/`, `'../model-registry.service'` resolves to `apps/api/src/app/data/model-registry.service` — which exists. ✓

[Apply standard template A with `<sub>` = grid and `<ClassName>Module` = GridModule]

---

## Task 16: Final top-level migration (controllers + data.service + thin adapter)

**Files:**
- Move: `apps/svc-data/src/app/data.controller.ts` → `apps/api/src/app/data/data.controller.ts`
- Move: `apps/svc-data/src/app/health.controller.ts` → `apps/api/src/app/data/data-health.controller.ts` (RENAMED — see special considerations)
- Move: `apps/svc-data/src/app/collection-data.controller.ts` → `apps/api/src/app/data/collection-data.controller.ts`
- Move: `apps/svc-data/src/app/data.service.ts` → `apps/api/src/app/data/data.service.ts`
- Move: `apps/svc-data/src/app/data.service.spec.ts` → `apps/api/src/app/data/data.service.spec.ts`
- Modify: `apps/api/src/app/data/data.module.ts` (final composition: register all controllers + top-level services + sub-modules + global lib imports)
- Replace: `apps/svc-data/src/app/app.module.ts` (becomes thin wrapper)

**Why this matters:** The 12 sub-directories are migrated; 2 of the 3 top-level services were already moved in Task 12; the 3 controllers + data.service + global wiring need to relocate. After this task, svc-data's `app.module.ts` is one substantive line — just imports DataModule from apps/api.

**Special considerations:**
- **HealthController** has the same class name as the ones in `apps/api/src/app/identity/health.controller.ts` (already migrated) and `apps/api/src/app/metadata/metadata-health.controller.ts` (already migrated and renamed `MetadataHealthController` for the same reason). When svc-data's `HealthController` moves to `apps/api/src/app/data/`, **rename file + class to `DataHealthController`** and change the route prefix to `'data/health'` (or whatever the existing prefix becomes after disambiguation — verify by reading the original `@Controller(...)` decorator). This matches the precedent set in the metadata migration.
- **DataController** — class name `DataController` is unique (no collision with identity's or metadata's controllers). No rename needed.
- **CollectionDataController** — also unique. No rename.
- **DataService** — verify it doesn't depend on anything not yet migrated. It is consumed only by `DataController`, which migrates in this same task.
- **app.module.ts wiring** — read `apps/svc-data/src/app/app.module.ts` to identify all the global imports + providers + middleware + interceptors that need to relocate to DataModule's `@Module` decorator. Specifically (from the survey, lines 1–46 of svc-data app.module.ts):
  - `CacheModule.register({ ttl: 30_000, max: 1000 })` — backs ModelRegistryService cache
  - `TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule])`
  - `AuthorizationModule.forRoot({ enableCaching: true })`
  - `RedisModule.forRoot()`
  - `MaintenanceModeModule`
  - `ConfigModule`
  - `ScheduleModule.forRoot()`
  - `InstanceDbModule`, `RuntimeAnomalyModule`, `AuthGuardModule`, `GlobalGuardsModule`
  - The two `useFactory` providers for `COLLECTION_ACL_REPOSITORY` and `PROPERTY_ACL_REPOSITORY`

[This is a Sonnet-level task — judgment-heavy rewrite. Use Sonnet model.]

- [ ] **Step 1: Verify working directory + that all 12 sub-directories are migrated and the mid-stream service files moved**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD && ls apps/svc-data/src/app/
```

Expected: only top-level files remain (no sub-directories): `app.module.ts`, `data.controller.ts`, `data.service.ts`, `data.service.spec.ts`, `health.controller.ts`, `collection-data.controller.ts`. The sub-directories `automation`, `ava`, `computed`, `defaults`, `events`, `formula`, `grid`, `integration`, `offerings`, `validation`, `work`, `workflow` should all be gone. The mid-stream service files (`collection-data.service.ts` + spec, `model-registry.service.ts`) should also be gone (moved in Task 12). If any of these still exist, prior tasks aren't complete; STOP and report BLOCKED.

- [ ] **Step 2: Move the 5 remaining top-level files via git mv**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-data/src/app/health.controller.ts apps/api/src/app/data/data-health.controller.ts
```

(Note: file rename to disambiguate from identity's HealthController and metadata's MetadataHealthController. The class inside also needs renaming — see Step 3.)

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git mv apps/svc-data/src/app/data.controller.ts apps/api/src/app/data/data.controller.ts && git mv apps/svc-data/src/app/collection-data.controller.ts apps/api/src/app/data/collection-data.controller.ts && git mv apps/svc-data/src/app/data.service.ts apps/api/src/app/data/data.service.ts && git mv apps/svc-data/src/app/data.service.spec.ts apps/api/src/app/data/data.service.spec.ts
```

- [ ] **Step 3: Rename `HealthController` class to `DataHealthController`**

Edit `apps/api/src/app/data/data-health.controller.ts`:
1. Change `export class HealthController` to `export class DataHealthController`.
2. Update the `@Controller('...')` decorator if it references `'health'` — change to `'data/health'` to disambiguate the route from identity's `/health` and metadata's `/metadata/health`.

Verify with:
```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -n "DataHealthController\|@Controller" apps/api/src/app/data/data-health.controller.ts
```

- [ ] **Step 4: Fix stale absolute paths in moved files**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -rn "from '\.\./\.\./\.\./\.\./api" apps/api/src/app/data/*.ts
```

For each match, replace `'../../../../api/src/app/data/<sub>'` with `'./<sub>'` (sibling of the top-level files).

Also check imports like `'./data.service'` and `'./model-registry.service'` from the moved controllers — these now resolve correctly because controller and service are siblings in `apps/api/src/app/data/`. No rewrite needed.

- [ ] **Step 5: Read svc-data's app.module.ts FIRST to enumerate global wiring**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && cat apps/svc-data/src/app/app.module.ts
```

Note all imports + the `useFactory` providers + the order of registrations.

- [ ] **Step 6: Rewrite apps/api/src/app/data/data.module.ts as the final composition**

Use the Write tool to overwrite `apps/api/src/app/data/data.module.ts`. The new file combines:
- All 8 standard sub-module imports (`AVAModule`, `ComputedModule`, `DefaultsModule`, `FormulaModule`, `GridModule`, `IntegrationModule`, `ValidationModule`, `WorkflowModule`)
- All service-only sub-directory direct registrations (services from `events`, `automation`, `work`, `offerings`)
- Top-level controllers: `DataController`, `CollectionDataController`, `DataHealthController` (renamed)
- Top-level providers: `DataService`, `ModelRegistryService`, `CollectionDataService`
- Lib imports from svc-data's app.module: `CacheModule.register({ ttl: 30_000, max: 1000 })`, `TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule])`, `AuthorizationModule.forRoot({ enableCaching: true })`, `RedisModule.forRoot()`, `MaintenanceModeModule`, `ConfigModule`, `ScheduleModule.forRoot()`, `InstanceDbModule`, `RuntimeAnomalyModule`, `AuthGuardModule`, `GlobalGuardsModule`
- The two `useFactory` providers for `COLLECTION_ACL_REPOSITORY` and `PROPERTY_ACL_REPOSITORY` (preserved verbatim from svc-data's app.module)

Aim for ~140 lines. Mark all migration-progress checkboxes as `[x]`.

Reference the structure of `apps/api/src/app/metadata/metadata.module.ts` for layout precedent — same shape, different sub-modules.

- [ ] **Step 7: Replace svc-data's app.module.ts with thin adapter**

Use the Write tool to overwrite `apps/svc-data/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DataModule } from '../../../api/src/app/data/data.module';

/**
 * apps/svc-data is kept alive in parallel during the ARC-W1 migration
 * for parallel-deployment safety. The actual module logic now lives in
 * apps/api/src/app/data/DataModule. This thin adapter re-imports
 * DataModule wholesale so the legacy service serves the same endpoints
 * at its old port.
 *
 * Legacy service deletion is deferred to the W1 final-cutover plan.
 */
@Module({
  imports: [DataModule],
})
export class AppModule {}
```

- [ ] **Step 8: Build both apps**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api 2>&1 | tail -15 && npx nx build svc-data 2>&1 | tail -15
```

- [ ] **Step 9: Verify svc-data directory state**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && ls apps/svc-data/src/app/ && echo "---src root---" && ls apps/svc-data/src/
```

Expected in `apps/svc-data/src/app/`: only `app.module.ts` (~17 lines).
Expected in `apps/svc-data/src/`: `app/`, `assets/`, `main.ts` — no `types/` (removed in Task 4).

- [ ] **Step 10: Verify clean git status**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git status --short
```

Expected: 5 renames + ~3 modifications (data-health.controller.ts class rename, data.module.ts rewrite, svc-data app.module.ts replace). Nothing else.

- [ ] **Step 11: Commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git add apps/api/ apps/svc-data/ && git commit -m "$(cat <<'EOF'
feat(api): migrate data top-level — controllers + DataService + globals; svc-data becomes thin adapter

ARC-W1-data FINAL TASK. apps/api/src/app/data/data.module.ts is now the
canonical DataModule with all 12 sub-directories + Data/Health/CollectionData
controllers + DataService + ModelRegistryService + CollectionDataService +
global wiring (CacheModule, TypeOrmModule for CollectionAccessRule/
PropertyAccessRule, AuthorizationModule, RedisModule, MaintenanceModeModule,
ConfigModule, ScheduleModule, InstanceDbModule, RuntimeAnomalyModule,
AuthGuardModule, GlobalGuardsModule + the two ACL repository useFactory
providers).

HealthController renamed to DataHealthController (and route prefix changed
from '/health' to '/data/health') to disambiguate from identity's
HealthController and metadata's MetadataHealthController in the same
monolith.

apps/svc-data/src/app/app.module.ts is now a one-line wrapper. Legacy
service stays runnable for parallel deployment until W1 final cutover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Final verification + tag

**Files:** None modified; verification only.

- [ ] **Step 1: Run all 4 architectural scanners**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npm run authz:check && npm run audit:check && npm run security:check && npm run deps:check
```

All must exit 0.

- [ ] **Step 2: Run service-boundary scanner (CLAUDE.md §21)**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npm run service-boundary:check
```

Must exit 0. The Plan Fix 1 rule (no service other than svc-automation may write to `AutomationRule` or `AutomationExecutionLog`) should still pass since this migration moves data into apps/api but doesn't change which entities each service writes — the rule is enforced via the `*_OFFENDERS` allowlist in `tools/service-boundary-check.ts`.

- [ ] **Step 3: Lint apps/api and svc-data**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx lint api && npx nx lint svc-data
```

- [ ] **Step 4: Build all four monolith-state apps**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx build api && npx nx build svc-identity && npx nx build svc-metadata && npx nx build svc-data
```

All four must succeed.

- [ ] **Step 5: Run apps/api tests**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && npx nx test api
```

Expected: at least 7 passing (kernel + db + audit foundation tests, plus the migrated specs from data — 7 specs total: automation:1, computed:2, integration:1, validation:1, collection-data.service:1, data.service:1).

- [ ] **Step 6: Verify svc-data directory state**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && ls apps/svc-data/src/app/ && echo "---" && ls apps/svc-data/src/
```

Expected in `apps/svc-data/src/app/`: only `app.module.ts`.
Expected in `apps/svc-data/src/`: `app/`, `assets/`, `main.ts` — no `types/`.

- [ ] **Step 7: Verify apps/api/src/app/data has all expected contents**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && ls apps/api/src/app/data/
```

Expected (alphabetical):
- 12 sub-directories: `automation/`, `ava/`, `computed/`, `defaults/`, `events/`, `formula/`, `grid/`, `integration/`, `offerings/`, `validation/`, `work/`, `workflow/`
- 8 top-level files: `collection-data.controller.ts`, `collection-data.service.spec.ts`, `collection-data.service.ts`, `data-health.controller.ts`, `data.controller.ts`, `data.module.ts`, `data.service.spec.ts`, `data.service.ts`, `model-registry.service.ts`

(That's 9 .ts files + 12 directories = 21 entries.)

- [ ] **Step 8: Verify the migration progress checklist in data.module.ts is fully checked**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && grep -E "^\s*\*\s+\[" apps/api/src/app/data/data.module.ts
```

Every `[ ]` must be `[x]` (no unchecked items).

- [ ] **Step 9: Tag the milestone**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && git tag arc-w1-data-complete && git log --oneline arc-w1-metadata-complete..arc-w1-data-complete
```

Expected: shows ~17 commits (the entire ARC-W1-data sequence from skeleton through final).

- [ ] **Step 10: Append completion note to this plan**

Append to bottom of `docs/superpowers/plans/2026-05-10-platform-w1-data-migration.md`:

```markdown
---

## Status: Complete (target: <fill in completion date>)

ARC-W1 data migration complete. apps/api/src/app/data/ now contains all 12
sub-directories + 3 controllers + 3 services (DataService, ModelRegistryService,
CollectionDataService) + data.module.ts. The types file from
apps/svc-data/src/types/automation.types.ts colocated with automation/.
apps/svc-data is reduced to a thin adapter; legacy service stays runnable for
parallel deployment until full W1 cutover.

### Next steps in W1

The remaining svc-* services (ava, automation, control-plane, workflow,
view-engine, insights, notify, instance-api) need migration plans of similar
shape. Each follows the same template:
1. Survey sub-modules + cross-deps
2. Skeleton + register module
3. Sub-module migrations (cyclic-core bundle if cycles exist; leaves first otherwise)
4. Mid-stream top-level service-file move if any sub-module depends on top-level files
5. Sub-modules dependent on top-level files
6. Final composition with thin adapter
7. Verification gate

After all instance services migrate, full W1 cutover deletes the legacy
svc-* directories, the service-boundary scanner, and routes traffic
fully to apps/api.
```

---

## Self-review

**1. Spec coverage:** This plan covers svc-data migration in full — all 12 sub-directories + 7 top-level files + 1 types file. The legacy service stays runnable post-migration via thin adapter, deferring deletion to full W1 cutover (separate plan).

**2. Placeholder scan:** Tasks 2, 5, 6, 7, 8, 13, 14, 15 use `[Apply standard template A]` or `[Apply standard template B]` references. This is acceptable because both standard templates are defined explicitly and in full at the head of the "Tasks 2–10" section. Each task's specifics (`<sub>` name, class name, special considerations, dependency notes) are listed in its own task body. This is meaningfully different from "Similar to Task N" — the template steps are spelled out twice (once per pattern) and substituted by name in each task. If an engineer reads task 8 in isolation, they're told to apply template A and given the specific name to substitute; they have everything they need.

**3. Type consistency:**
- `DataModule` named consistently across all tasks
- `DataHealthController` (Task 16) renamed explicitly to disambiguate from identity's `HealthController` and metadata's `MetadataHealthController`. File rename: `health.controller.ts` → `data-health.controller.ts`. Route prefix: `/data/health`.
- Sub-module class names listed per task with the all-caps `AVAModule` (Task 7) flagged because it deviates from CamelCase convention
- Service-only registrations distinguished from standard-module registrations via two templates (A vs B)
- `git mv` paths consistent (`apps/svc-data/src/app/<sub>` → `apps/api/src/app/data/<sub>`)
- Import path replacement pattern consistent (`'./<sub>` → `'../../../api/src/app/data/<sub>` for app.module-level imports)
- Mid-stream service-file move (Task 12) uses 3-level-up paths from svc-data's app.module to apps/api/src/app/data/
- Types file colocation in Task 4: `'../../types/automation.types'` becomes `'./automation.types'` after moving the types file inside automation/

**4. Scope check:** Plan covers exactly svc-data migration — not other svc-* services, not full W1 cutover. ~3 weeks of solo work. ~17 substantive tasks plus verification. Single plan size is appropriate.

**5. Dependency graph correctness:** Re-verified the cross-dep listing against the actual grep output:
- 3 sub-module-to-sub-module edges: computed→formula, integration→events, offerings→events
- 4 sub-module-to-top-level edges: automation→types/automation.types, grid→model-registry.service, offerings→collection-data.service, work→collection-data.service
- 7 sub-modules are independent of any other sub-module: workflow, events, automation, defaults, validation, ava, formula
- 2 sub-modules depend on other sub-modules: computed (formula), integration (events)
- 3 sub-modules depend on top-level files: work (collection-data.service), offerings (collection-data.service + events), grid (model-registry.service)
- Total: 12 sub-modules accounted for
- The migration order respects all 7 edges:
  - formula before computed ✓ (Task 8 before Task 9)
  - events before integration ✓ (Task 3 before Task 10)
  - events before offerings ✓ (Task 3 before Task 14)
  - top-level service files (Task 12) before work, offerings, grid (Tasks 13, 14, 15) ✓
  - automation.types before automation's import update ✓ (handled in Task 4)
- automation.types relocation is handled within Task 4 by colocating with automation/

**6. Mid-stream top-level move (Task 12) rationale:** Without it, work/offerings/grid would either fail to build (if `'../<service>'` paths stay literal) or require temporary patches to import paths that get reverted later. Moving the 3 service files mid-stream lets all three dependent sub-modules migrate cleanly. The 3 controllers + data.service are NOT moved mid-stream because no sub-module depends on them; they migrate together in Task 16 with the @Module composition rewrite and the svc-data thin adapter replacement.

**7. svc-data/src/types/ cleanup:** The directory contains exactly one file (`automation.types.ts`); after Task 4 moves it, the empty directory is removed in the same task. Final verification (Task 17 Step 6) confirms the `types/` directory is gone.

No issues found.

---

**End of data migration plan.**
