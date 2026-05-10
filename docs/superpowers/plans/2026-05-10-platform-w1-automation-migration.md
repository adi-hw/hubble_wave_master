# Platform W1 Automation Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the entire `apps/svc-automation` Nest application (5 sub-modules + 1 top-level controller + 1 app.module = ~9,865 LoC across ~32 files including specs) into `apps/api/src/app/automation/`, sub-module by sub-module, using `git mv` to preserve history and keeping `apps/svc-automation` runnable in parallel via a thin adapter at the end.

**Architecture:** svc-automation's cross-module dependency graph is **NOT a clean DAG** — there's a `ava ↔ rules` cycle (same shape as identity's auth+abac+ldap+roles cyclic-core). Migration order: `runtime` (leaf) → `scheduling` (depends on runtime) → `sync-trigger` (depends on runtime) → `ava + rules` cyclic bundle (atomic single commit; both depend on runtime + rules also on scheduling, all satisfied) → final top-level. The cycle is small (5 files, ~1,516 LoC) compared to identity's (66 files, ~10,000 LoC) so the atomic commit is a single subagent dispatch.

**Tech Stack:** TypeScript 5.9, NestJS 11, TypeORM 0.3, Postgres, Nx 22 monorepo, Jest 30. Existing platform deps: `@hubblewave/auth-guard`, `@hubblewave/authorization`, `@hubblewave/automation` (note: this is a lib, distinct from the apps/svc-automation we're migrating), `@hubblewave/redis`. Plan Fix 1 (2026-05-10) already consolidated the runtime + sync-trigger from svc-data into svc-automation; this migration moves everything from svc-automation into apps/api.

**Spec reference:** `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §2 (target architecture) + §9 (canon delta).

**Predecessor plans:**
- `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md` (status `arc-w1-foundation-partial`)
- `docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md` (status `arc-w1-identity-complete`)
- `docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md` (status `arc-w1-metadata-complete`)
- `docs/superpowers/plans/2026-05-10-platform-w1-data-migration.md` (status `arc-w1-data-complete`)
- `docs/superpowers/plans/2026-05-10-phase0-branch-reconciliation.md` (status `arc-reconciled-with-w1-security`)

This plan continues by migrating automation. **Mixed pattern: clean DAG for 3 sub-modules + cyclic bundle for `ava + rules`.**

**Solo founder, ~1.5 weeks of work.** ~7 substantive tasks plus verification gate. Each task is independently reversible.

---

## Sub-module inventory (measured 2026-05-10)

| Sub-module | Files (incl spec) | LoC | Pattern | Cross-deps | Migration order |
|---|---|---|---|---|---|
| `runtime` | 14 | 5,807 | Standard module (`AutomationRuntimeModule` — file: `automation-runtime.module.ts`) | none | independent leaf — do FIRST |
| `scheduling` | 6 | 1,722 | Standard module (`SchedulingModule`) | runtime | dependent — after runtime |
| `sync-trigger` | 5 | 766 | Standard module (`SyncTriggerModule`) | runtime | dependent — after runtime |
| **`ava`** | **2** | **600** | **Standard module (`AvaModule`)** | **rules, runtime** | cyclic-core (with rules) |
| **`rules`** | **3** | **916** | **Standard module (`RulesModule`)** | **ava, runtime, scheduling** | cyclic-core (with ava) |
| Top-level files (2) | 2 | ~54 | controller + app.module | varies | last (after all sub-modules) |
| **Total** | **~32** | **~9,865** | | | |

### Cycle structure

```
              runtime (leaf)
             ↑    ↑    ↑
             |    |    |
        scheduling sync-trigger ava ⇄ rules
                                 |     |
                                 +-→ runtime
                                       ↑
                                 rules → scheduling
```

**Cycle:** `ava → rules → ava` (verified by grep: `ava/ava.module.ts:3` imports `RulesModule`; `rules/rules.module.ts:9` imports `AvaModule`). Plus deeper file-level imports — `ava/ava-automation.service.ts:10` imports `AutomationService` from rules; `rules/rules.controller.ts:40` imports `AvaAutomationService` from ava.

**Bundle scope:** ava (2 files, 600 LoC) + rules (3 files, 916 LoC) = 5 files, 1,516 LoC. Atomic single commit via `git mv` of both directories together, with the data.module.ts equivalent (the destination automation.module.ts) registering both at the same time. Same approach as identity's cyclic-core.

### File-pattern split

- **Standard sub-modules (5):** all 5 sub-modules have a `*.module.ts` with a `@Module` decorator. `runtime`'s file is named `automation-runtime.module.ts` (not `runtime.module.ts`); the others follow `<sub>.module.ts` convention. Migration registers `<X>Module` in `imports: []` and `exports: []` of the destination `automation.module.ts`.
- **Top-level files (2):** `app.module.ts` (35 lines, the composition) and `health.controller.ts` (19 lines, k8s probe). NO top-level service files (unlike data which had collection-data.service + model-registry.service). No mid-stream service-file move needed.
- **`__selftest_fixture__/`:** empty directory in `apps/svc-automation/src/app/__selftest_fixture__/`. Leave in place during migration (it's selftest infrastructure scaffolding, not user code). The thin adapter `app.module.ts` post-migration won't reference it.

### Migration order (concrete)

1. **Skeleton + register** — empty AutomationModule
2. **`runtime`** (14 files, 5,807 LoC) — leaf, biggest sub-module; do first since 3 others depend on it
3. **`scheduling`** (6 files, 1,722 LoC) — depends on runtime (now satisfied)
4. **`sync-trigger`** (5 files, 766 LoC) — depends on runtime (now satisfied)
5. **`ava + rules` cyclic-core bundle** (5 files, 1,516 LoC) — atomic single commit; both depend on runtime + rules also on scheduling (all now satisfied; the cycle between ava and rules is internal to the bundle)
6. **Final top-level migration** — `health.controller.ts` (rename to `automation-health.controller.ts`, class `AutomationHealthController`, route `/automation/health`); rewrite `automation.module.ts` final composition; replace svc-automation `app.module.ts` with thin adapter
7. **Verification gate** (build, scanners, tag `arc-w1-automation-complete`)

### Pre-flight checks per task

For every sub-module migration task, the prompt MUST include these checks (lessons from identity + metadata + data migrations):

1. **Working directory** — verify pwd + branch + expected HEAD before any edit
2. **Empty-directory check** — `find apps/api/src/app/automation -type d -empty` to catch residual empty dirs from prior failed attempts (Windows/OneDrive quirk)
3. **No forbidden file modifications** — explicit list: `nx.json`, `package.json`, `package-lock.json`, `.vscode/`, `.gitignore`, `tsconfig.base.json`, `tools/`, `docs/`
4. **`git mv` only** — no copies, no creating new files in svc-automation
5. **Authorized recovery path** — `git reset --hard <previous-commit>` if state is broken

These constraints repeat in every task body; do not skip them.

---

## Files Created/Modified Overview

### Per task (template — applies to every standard sub-module migration task)

**Modified:**
- `apps/svc-automation/src/app/app.module.ts` — change `from './<sub>/<sub>.module'` to `from '../../../api/src/app/automation/<sub>/<sub>.module'` for the migrating sub-module
- `apps/api/src/app/automation/automation.module.ts` — add the migrated sub-module to its imports + exports arrays
- (possibly) other files in svc-automation that imported from the migrating sub-module — paths updated similarly

**Moved (`git mv`):**
- `apps/svc-automation/src/app/<sub>/` → `apps/api/src/app/automation/<sub>/`

### Plan-end state

- `apps/api/src/app/automation/` contains all 5 sub-directories + `automation-health.controller.ts` (renamed) + `automation.module.ts` (full composition)
- `apps/api/src/app/app.module.ts` registers `AutomationModule` after `DataModule`
- `apps/svc-automation/src/app/app.module.ts` is a thin wrapper that imports AutomationModule from apps/api (one substantive line)
- `apps/svc-automation/src/main.ts` and `project.json` remain unchanged; legacy service stays runnable
- `apps/svc-automation/src/app/__selftest_fixture__/` remains in place (selftest scaffolding)
- Legacy service deletion is deferred to the W1 final-cutover plan (not this one)

---

## Task 1: Create apps/api/src/app/automation skeleton

**Files:**
- Create: `apps/api/src/app/automation/automation.module.ts` (empty composition)
- Modify: `apps/api/src/app/app.module.ts` (register AutomationModule)

**Why this matters:** Establishes the destination module. Subsequent sub-module migrations register themselves into this skeleton's imports + exports arrays.

- [ ] **Step 1: Verify working directory + branch + HEAD**

```bash
cd "<worktree-path>" && pwd && git rev-parse --abbrev-ref HEAD && git log --oneline -1
```

Expected: clean status; branch is the spawning session's branch; HEAD is the most recent commit on master (post-PR-#6) or whatever the spawning session's HEAD is.

- [ ] **Step 2: Empty-directory pre-flight check**

```bash
cd "<worktree-path>" && find apps/api/src/app/automation -type d -empty 2>&1
```

If `apps/api/src/app/automation` exists empty, `rmdir` it first.

- [ ] **Step 3: Create the directory + skeleton**

```bash
cd "<worktree-path>" && mkdir -p apps/api/src/app/automation
```

Write `apps/api/src/app/automation/automation.module.ts` with this exact content:

```typescript
import { Module } from '@nestjs/common';

/**
 * AutomationModule consolidates everything from apps/svc-automation into the
 * apps/api modular monolith. Sub-modules migrate one at a time via git mv;
 * each migration registers its module here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-automation-migration.md):
 *   Standard modules (clean-DAG order):
 *     [ ] runtime (AutomationRuntimeModule — leaf)
 *     [ ] scheduling (depends on runtime)
 *     [ ] sync-trigger (depends on runtime)
 *   Cyclic-core bundle (atomic single-commit, ava ↔ rules):
 *     [ ] ava + rules
 *   Final top-level (controller, app.module thin adapter):
 *     [ ] automation-health.controller (renamed from health.controller)
 *     [ ] automation.module final composition
 *     [ ] svc-automation app.module thin adapter
 *
 * AutomationModule re-exports each migrated sub-module so that:
 * - apps/api consumers (data, ava, etc.) can inject automation services
 *   without explicit sub-module imports
 * - apps/svc-automation's thin adapter (post-migration) can import
 *   AutomationModule wholesale to keep the legacy service serving the same
 *   endpoints
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class AutomationModule {}
```

- [ ] **Step 4: Register AutomationModule in apps/api AppModule**

Edit `apps/api/src/app/app.module.ts`. Currently has `imports: [KernelModule, DbModule, AuditModule, IdentityModule, MetadataModule, DataModule]`. Add `AutomationModule` import + register in imports array. After: `imports: [KernelModule, DbModule, AuditModule, IdentityModule, MetadataModule, DataModule, AutomationModule]`.

- [ ] **Step 5: Verify build**

```bash
cd "<worktree-path>" && npx nx build api 2>&1 | tail -10
```

Build must succeed.

- [ ] **Step 6: Commit**

```bash
cd "<worktree-path>" && git add apps/api/ && git commit -m "$(cat <<'EOF'
feat(api): create empty AutomationModule skeleton in apps/api

ARC-W1-automation task 1. Empty AutomationModule registered in AppModule;
sub-modules migrate into it one at a time via subsequent tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Standard Template A — applied 3x for runtime / scheduling / sync-trigger

For each clean-DAG sub-module `<sub>` with class name `<ClassName>Module`:

1. Verify working directory + branch + expected HEAD
2. Empty-directory pre-flight check (`find apps/api/src/app/automation -type d -empty`); rmdir any empty `<sub>/` from prior failed attempts
3. `git mv apps/svc-automation/src/app/<sub> apps/api/src/app/automation/<sub>`
4. Verify clean move (no nested `<sub>/<sub>/`): `ls apps/api/src/app/automation/<sub>/`
5. Stale-path scan inside moved files: `grep -rn "from '\.\./\.\./\.\./\.\./api" apps/api/src/app/automation/<sub>/`. Fix any matches. Sibling references that were `'../<other-sub>'` from the source location need handling — see per-task notes.
6. Find consumer imports in svc-automation: `grep -rn "from '\./<sub>\|from '\.\./<sub>" apps/svc-automation/src --include="*.ts"`. Update each path:
   - From app.module level (3 levels up): `'./<sub>/<file>'` → `'../../../api/src/app/automation/<sub>/<file>'`
   - From sibling sub-directory level (4 levels up): `'../<sub>/<file>'` → `'../../../../api/src/app/automation/<sub>/<file>'`
7. Verify zero orphans (all paths point to apps/api now)
8. Update `apps/api/src/app/automation/automation.module.ts`: import + add to imports + add to exports + check `[x] <sub>`
9. Build both apps; both must succeed
10. Verify clean status (no forbidden files; no `*.rej`; no nesting bug)
11. Commit with message `feat(api): migrate <sub>/ (<ClassName>Module) from svc-automation into apps/api/automation`

---

## Task 2: Migrate `runtime` (14 files, 5,807 LoC including 3 specs) — leaf, biggest

**Class name:** `AutomationRuntimeModule`. **File:** `automation-runtime.module.ts` (NOT `runtime.module.ts` — note the prefix).
**Cross-deps:** none. Leaf node; biggest sub-module by far.

**Files in `runtime/`:**
- `automation-runtime.module.ts` — module class
- `automation-runtime.service.ts` — orchestrator
- `automation-runtime.types.ts` — types
- `condition-evaluator.service.ts`
- `action-handler.service.ts`
- `script-sandbox.service.ts` (+ spec)
- `execution-log.service.ts` (+ spec)
- `record-mutation.service.ts` (+ spec)
- `outbox-publisher.service.ts`

After moving, internal imports inside runtime/ files reference each other via `'./<sibling>'` paths — those resolve correctly in the new location (siblings preserved).

**Standard Template A** with `<sub>` = runtime and `<ClassName>Module` = AutomationRuntimeModule. Note the module file rename: import line in `automation.module.ts` should be `import { AutomationRuntimeModule } from './runtime/automation-runtime.module';`. Use Sonnet for this task — biggest sub-module + the prefix-named module file warrants careful handling.

[Apply Standard Template A]

---

## Task 3: Migrate `scheduling` (6 files, 1,722 LoC, 2 specs) — depends on runtime

**Class name:** `SchedulingModule`. **File:** `scheduling.module.ts`.
**Cross-deps:** runtime (Task 2 — now satisfied).

**Internal imports:**
- `scheduling/scheduling.module.ts:7` imports `AutomationRuntimeModule` from `'../runtime/automation-runtime.module'`
- `scheduling/scheduler.service.ts:13-15` imports `ActionHandlerService`, `ScriptSandboxService`, `ExecutionLogService` from `'../runtime/...'`
- `scheduling/scheduler.service.spec.ts:8-10` imports the same trio for testing

After scheduling migrates to `apps/api/src/app/automation/scheduling/`, these `'../runtime/...'` paths resolve to `apps/api/src/app/automation/runtime/` — which exists (Task 2). No path rewrite needed inside scheduling's files.

**Standard Template A** with `<sub>` = scheduling and `<ClassName>Module` = SchedulingModule.

[Apply Standard Template A]

---

## Task 4: Migrate `sync-trigger` (5 files, 766 LoC, 1 spec) — depends on runtime

**Class name:** `SyncTriggerModule`. **File:** `sync-trigger.module.ts`.
**Cross-deps:** runtime (Task 2 — now satisfied).

**Internal imports:**
- `sync-trigger/sync-trigger.module.ts:2` imports `AutomationRuntimeModule` from `'../runtime/automation-runtime.module'`
- `sync-trigger/sync-trigger.service.ts:3` imports `AutomationRuntimeService` from `'../runtime/automation-runtime.service'`
- `sync-trigger/contract.spec.ts:12-22` imports many runtime services + types

After sync-trigger migrates, all `'../runtime/...'` paths resolve correctly because runtime is a sibling in `apps/api/src/app/automation/`.

**Standard Template A** with `<sub>` = sync-trigger and `<ClassName>Module` = SyncTriggerModule.

[Apply Standard Template A]

---

## Task 5: Migrate `ava + rules` cyclic-core bundle (5 files, 1,516 LoC, 0 specs) — atomic single commit

**Class names:** `AvaModule`, `RulesModule`. **Files:** `ava/ava.module.ts`, `rules/rules.module.ts`.
**Cross-deps:**
- ava → rules, runtime (Task 2 satisfied)
- rules → ava, runtime (Task 2 satisfied), scheduling (Task 3 satisfied)
- The `ava ↔ rules` cycle is INTERNAL to this bundle.

**Why a bundle:** `git mv` of just `ava/` would leave `rules/` with a broken import to `'../ava/...'`. `git mv` of just `rules/` would leave `ava/` with a broken import to `'../rules/...'`. Migrating both together in a single atomic commit avoids ever having a broken intermediate state. Same pattern as identity's cyclic-core (auth+abac+ldap+roles, 66 files, atomic).

**Bundle scope (5 files):**
- `ava/ava.module.ts` (`AvaModule`, 16 lines)
- `ava/ava-automation.service.ts` (~584 lines)
- `rules/rules.module.ts` (`RulesModule`)
- `rules/rules.controller.ts`
- `rules/rules.service.ts`

**Internal imports (verified):**
- `ava/ava.module.ts:2` imports `AutomationRuntimeModule` from `'../runtime/automation-runtime.module'` (runtime — already migrated)
- `ava/ava.module.ts:3` imports `RulesModule` from `'../rules/rules.module'` (rules — sibling in this bundle)
- `ava/ava-automation.service.ts:10` imports `AutomationService` from `'../rules/rules.service'` (rules)
- `ava/ava-automation.service.ts:11` imports `ConditionEvaluatorService` from `'../runtime/condition-evaluator.service'` (runtime)
- `rules/rules.module.ts:7` imports `AutomationRuntimeModule` from `'../runtime/automation-runtime.module'` (runtime)
- `rules/rules.module.ts:8` imports `SchedulingModule` from `'../scheduling/scheduling.module'` (scheduling — already migrated)
- `rules/rules.module.ts:9` imports `AvaModule` from `'../ava/ava.module'` (ava — sibling in this bundle)
- `rules/rules.controller.ts:38` imports `?` from `'../scheduling/scheduled-job.service'` (scheduling)
- `rules/rules.controller.ts:39` imports `ExecutionLogService, ExecutionStatus` from `'../runtime/execution-log.service'` (runtime)
- `rules/rules.controller.ts:40` imports `AvaAutomationService, AvaAutomationRequest` from `'../ava/ava-automation.service'` (ava)

After the atomic move, all `'../<sibling>/...'` paths resolve correctly because all 5 sibling sub-directories (ava, rules, runtime, scheduling, sync-trigger) are now siblings under `apps/api/src/app/automation/`.

### Steps for Task 5

- [ ] **Step 1: Verify working directory + state**

Confirm Tasks 1-4 are complete: `apps/api/src/app/automation/` contains `runtime/`, `scheduling/`, `sync-trigger/`, `automation.module.ts`. svc-automation still has `ava/`, `rules/`, `app.module.ts`, `health.controller.ts`, `__selftest_fixture__/`.

- [ ] **Step 2: Empty-dir pre-flight + atomic move**

```bash
cd "<worktree-path>" && find apps/api/src/app/automation -type d -empty 2>&1
```

(rmdir any empty `ava/` or `rules/` if present — Windows/OneDrive quirk)

```bash
cd "<worktree-path>" && git mv apps/svc-automation/src/app/ava apps/api/src/app/automation/ava && git mv apps/svc-automation/src/app/rules apps/api/src/app/automation/rules
```

- [ ] **Step 3: Verify clean atomic move**

```bash
cd "<worktree-path>" && ls apps/api/src/app/automation/ava/ && echo "---" && ls apps/api/src/app/automation/rules/
```

Both should show their files. NO nested `ava/ava/` or `rules/rules/`.

- [ ] **Step 4: Stale-path scan**

```bash
cd "<worktree-path>" && grep -rn "from '\.\./\.\./\.\./\.\./api" apps/api/src/app/automation/ava/ apps/api/src/app/automation/rules/
```

Should return nothing (the cyclic-core bundle's internal imports are sibling-relative, not absolute).

- [ ] **Step 5: Find svc-automation consumer imports + update**

```bash
cd "<worktree-path>" && grep -rn "from '\./ava\|from '\.\./ava\|from '\./rules\|from '\.\./rules" apps/svc-automation/src --include="*.ts"
```

Expected matches:
- `apps/svc-automation/src/app/app.module.ts` imports `RulesModule` from `'./rules/rules.module'` and `AvaModule` from `'./ava/ava.module'`. Update both to `'../../../api/src/app/automation/<sub>/<sub>.module'`.

- [ ] **Step 6: Verify zero orphans**

Re-run the grep; expected to find only `apps/svc-automation/src/app/app.module.ts` with the updated `'../../../api/src/app/automation/'` paths.

- [ ] **Step 7: Update apps/api/src/app/automation/automation.module.ts**

- Add `import { AvaModule } from './ava/ava.module';`
- Add `import { RulesModule } from './rules/rules.module';`
- Add both to `imports: []` array
- Add both to `exports: []` array
- Mark `[x] ava + rules` in the checklist (the cyclic-core bundle line)

- [ ] **Step 8: Build both apps**

```bash
cd "<worktree-path>" && npx nx build api 2>&1 | tail -5 && npx nx build svc-automation 2>&1 | tail -5
```

Both must succeed. The cycle is intra-bundle and TypeScript handles ES-module cycles fine for non-immediate-eval imports.

- [ ] **Step 9: Verify clean status**

Expected: 2 directory renames (ava/, rules/), modifications to: apps/svc-automation/src/app/app.module.ts (import path updates) + apps/api/src/app/automation/automation.module.ts (import/imports/exports/checklist).

- [ ] **Step 10: Commit (atomic, single commit for the bundle)**

```bash
cd "<worktree-path>" && git add apps/api/ apps/svc-automation/ && git commit -m "$(cat <<'EOF'
feat(api): migrate ava+rules cyclic-core bundle (AvaModule + RulesModule) from svc-automation into apps/api/automation

ARC-W1-automation task 5. Atomic single-commit migration of the
ava ⇄ rules cycle (5 files, 1,516 LoC). Both depend on runtime
(Task 2, satisfied) and rules also on scheduling (Task 3, satisfied).
The ava ↔ rules import cycle (verified: ava/ava.module imports
RulesModule; rules/rules.module imports AvaModule) is internal to
the bundle and survives the move because both directories become
siblings under apps/api/src/app/automation/ in this single commit.

Same approach as identity's auth+abac+ldap+roles cyclic-core (66
files, atomic). Smaller scope here (5 files) but identical pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Use Sonnet for this task** — judgment-heavy atomic move with cycle awareness.

---

## Task 6: Final top-level migration (controller + app.module thin adapter)

**Files:**
- Move: `apps/svc-automation/src/app/health.controller.ts` → `apps/api/src/app/automation/automation-health.controller.ts` (RENAMED)
- Modify: `apps/api/src/app/automation/automation.module.ts` (final composition)
- Replace: `apps/svc-automation/src/app/app.module.ts` (becomes thin wrapper)

**Why this matters:** All 5 sub-modules are migrated; the top-level health controller + global wiring need to relocate. After this task, svc-automation's app.module.ts is one substantive line — just imports AutomationModule from apps/api.

**Special considerations:**
- **HealthController** has the same class name as the ones in apps/api/src/app/identity/, apps/api/src/app/metadata/ (renamed `MetadataHealthController`), and apps/api/src/app/data/ (renamed `DataHealthController`). When svc-automation's `HealthController` moves, **rename file + class to `AutomationHealthController`** with route prefix `'automation/health'` (matching the precedent set in metadata + data migrations).
- **app.module.ts wiring** — read svc-automation's app.module.ts to identify all the global imports (ConfigModule.forRoot, AuthGuardModule, GlobalGuardsModule, RedisModule.forRoot, MaintenanceModeModule, AuthorizationModule.forInstance, AutomationModule from `@hubblewave/automation` lib). Note the `@hubblewave/automation` lib is DIFFERENT from the local svc-automation we're migrating; the lib import stays.

[Use Sonnet model for this task — judgment-heavy rewrite combining 5 sub-modules + 1 controller + global wiring.]

### Steps for Task 6

- [ ] **Step 1: Verify state**

```bash
cd "<worktree-path>" && ls apps/svc-automation/src/app/
```

Expected: `app.module.ts`, `health.controller.ts`, `__selftest_fixture__/`. NO sub-directories (ava/, rules/, runtime/, scheduling/, sync-trigger/ all gone).

- [ ] **Step 2: Empty-dir pre-flight**

- [ ] **Step 3: Move health.controller.ts WITH rename**

```bash
cd "<worktree-path>" && git mv apps/svc-automation/src/app/health.controller.ts apps/api/src/app/automation/automation-health.controller.ts
```

- [ ] **Step 4: Rename `HealthController` class to `AutomationHealthController`**

Edit `apps/api/src/app/automation/automation-health.controller.ts`:
- Change `export class HealthController` to `export class AutomationHealthController`
- Update the `@Controller('...')` decorator to `@Controller('automation/health')` (or whatever disambiguates from identity's `/health`, metadata's `/metadata/health`, data's `/data/health`)

- [ ] **Step 5: Read svc-automation's app.module.ts**

```bash
cd "<worktree-path>" && cat apps/svc-automation/src/app/app.module.ts
```

Note all imports + their order.

- [ ] **Step 6: Rewrite apps/api/src/app/automation/automation.module.ts as final composition**

Use Write tool to overwrite. The new file combines:
- 5 sub-module imports (`AutomationRuntimeModule`, `SchedulingModule`, `SyncTriggerModule`, `AvaModule`, `RulesModule`)
- Top-level controller: `AutomationHealthController`
- Lib imports preserved verbatim from svc-automation's app.module.ts:
  - `ConfigModule.forRoot({ isGlobal: true })` (or whatever the actual call was — read source to confirm)
  - `AuthGuardModule`
  - `GlobalGuardsModule`
  - `RedisModule.forRoot()`
  - `MaintenanceModeModule`
  - `AutomationModule` from `@hubblewave/automation` (the LIB, not our migrating sub-module)
  - `AuthorizationModule.forInstance()`

Aim for ~50 lines. Mark all checklist items `[x]`.

Reference: `apps/api/src/app/data/data.module.ts` for layout precedent — same shape, different sub-modules.

- [ ] **Step 7: Replace svc-automation's app.module.ts with thin adapter**

```typescript
import { Module } from '@nestjs/common';
import { AutomationModule } from '../../../api/src/app/automation/automation.module';

/**
 * apps/svc-automation is kept alive in parallel during the ARC-W1 migration
 * for parallel-deployment safety. The actual module logic now lives in
 * apps/api/src/app/automation/AutomationModule. This thin adapter re-imports
 * AutomationModule wholesale so the legacy service serves the same endpoints
 * at its old port.
 *
 * Legacy service deletion is deferred to the W1 final-cutover plan.
 */
@Module({
  imports: [AutomationModule],
})
export class AppModule {}
```

- [ ] **Step 8: Build both apps**

```bash
cd "<worktree-path>" && npx nx build api 2>&1 | tail -10 && npx nx build svc-automation 2>&1 | tail -10
```

Both must succeed.

- [ ] **Step 9: Verify svc-automation directory state**

```bash
cd "<worktree-path>" && ls apps/svc-automation/src/app/
```

Expected: `app.module.ts` + `__selftest_fixture__/` only. NO health.controller.ts, NO sub-directories.

- [ ] **Step 10: Verify clean git status**

Expected: 1 file rename (health.controller.ts → automation-health.controller.ts), 2 modifications (apps/api/src/app/automation/automation.module.ts rewrite, apps/svc-automation/src/app/app.module.ts replace).

- [ ] **Step 11: Commit**

```bash
cd "<worktree-path>" && git add apps/api/ apps/svc-automation/ && git commit -m "$(cat <<'EOF'
feat(api): migrate automation top-level — controller + globals; svc-automation becomes thin adapter

ARC-W1-automation FINAL TASK. apps/api/src/app/automation/automation.module.ts
is now the canonical AutomationModule with all 5 sub-modules + AutomationHealthController
+ global wiring (ConfigModule, AuthGuardModule, GlobalGuardsModule, RedisModule,
MaintenanceModeModule, AutomationModule lib import, AuthorizationModule.forInstance).

HealthController renamed to AutomationHealthController (file: automation-health.controller.ts;
route prefix: 'automation/health') to disambiguate from identity's HealthController,
metadata's MetadataHealthController, and data's DataHealthController in the same monolith.

apps/svc-automation/src/app/app.module.ts is now a one-line wrapper. Legacy service
stays runnable for parallel deployment until W1 final cutover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification + tag

**Files:** None modified; verification only.

- [ ] **Step 1: Run all architectural scanners**

```bash
cd "<worktree-path>" && npm run authz:check && npm run audit:check && npm run security:check && npm run service-boundary:check && npm run deps:check && npm run dead-code:check && npm run compliance:check
```

All must exit 0. Note: the scanners now include apps/api/<area> coverage (PR #6) — scanning includes the newly-migrated automation/ directory automatically.

- [ ] **Step 2: Selftest scanners**

```bash
cd "<worktree-path>" && npm run selftest:scanners
```

All selftest suites green.

- [ ] **Step 3: Lint apps/api and svc-automation**

```bash
cd "<worktree-path>" && npx nx lint api 2>&1 | tail -10 && npx nx lint svc-automation 2>&1 | tail -10
```

Pre-existing lint errors are tolerated; flag any NEW errors.

- [ ] **Step 4: Build all monolith-state apps**

```bash
cd "<worktree-path>" && npx nx build api && npx nx build svc-identity && npx nx build svc-metadata && npx nx build svc-data && npx nx build svc-automation
```

All five must succeed.

- [ ] **Step 5: Run apps/api tests**

```bash
cd "<worktree-path>" && npx nx test api 2>&1 | tail -10
```

Pre-existing tests pass. New tests from migrated specs (runtime: 3, scheduling: 2, sync-trigger: 1 = 6 spec files) may now run under apps/api's test config.

- [ ] **Step 6: Verify svc-automation directory state**

```bash
cd "<worktree-path>" && ls apps/svc-automation/src/app/ && echo "---" && ls apps/svc-automation/src/
```

Expected in `apps/svc-automation/src/app/`: `app.module.ts` + `__selftest_fixture__/` only.
Expected in `apps/svc-automation/src/`: `app/`, `main.ts`.

- [ ] **Step 7: Verify apps/api/src/app/automation has all expected contents**

```bash
cd "<worktree-path>" && ls apps/api/src/app/automation/
```

Expected:
- 5 sub-directories: `ava/`, `rules/`, `runtime/`, `scheduling/`, `sync-trigger/`
- 2 .ts files: `automation-health.controller.ts`, `automation.module.ts`

- [ ] **Step 8: Verify checklist 100% checked**

```bash
cd "<worktree-path>" && grep -E "^\s*\*\s+\[" apps/api/src/app/automation/automation.module.ts
```

Every line must be `[x]`. No `[ ]` remaining.

- [ ] **Step 9: Tag the milestone**

```bash
cd "<worktree-path>" && git tag arc-w1-automation-complete && git log --oneline arc-reconciled-with-w1-security..arc-w1-automation-complete
```

Expected: ~7 commits (skeleton + 3 leaves + cyclic bundle + final + verification doc).

- [ ] **Step 10: Append completion note to this plan**

Append after `**End of automation migration plan.**`:

```markdown


---

## Status: Complete (target: <fill in completion date>)

ARC-W1 automation migration complete. apps/api/src/app/automation/ now contains
all 5 sub-directories (runtime, scheduling, sync-trigger, ava, rules) +
AutomationHealthController + automation.module.ts (full composition).
apps/svc-automation is reduced to a thin adapter; legacy service stays runnable
for parallel deployment until full W1 cutover.

Cyclic-core bundle pattern applied to ava + rules (5 files, 1,516 LoC,
single atomic commit) — same shape as identity's auth+abac+ldap+roles bundle
but smaller. Build + scanners + tests all green.

Tag: arc-w1-automation-complete at HEAD <fill SHA>.

### Next steps in W1

The remaining svc-* services need migration plans of similar shape:
- svc-ava (~8,000 LoC; AVA runtime; F072+F074 proposal state machine overlap)
- svc-workflow (~3,000 LoC; per canon §8 INVERT may merge with automation)
- svc-control-plane (~6,000 LoC; multi-tenant by design; different shape)
- Fold-ins: svc-view-engine, svc-insights, svc-notify, svc-instance-api
- W1 final cutover: delete legacy svc-* directories, delete service-boundary scanner, route 100% traffic to apps/api, tag arc-w1-complete
```

- [ ] **Step 11: Commit completion note**

```bash
cd "<worktree-path>" && git add docs/superpowers/plans/2026-05-10-platform-w1-automation-migration.md && git commit -m "docs(plan): mark ARC-W1 automation migration complete"
```

---

## Self-review

**1. Spec coverage:** This plan covers svc-automation migration in full — 5 sub-modules + 1 top-level controller + 1 app.module thin adapter. The legacy service stays runnable post-migration; deletion deferred to W1 final cutover (separate plan).

**2. Placeholder scan:** Tasks 2-4 use "Apply Standard Template A" reference. The standard template is defined explicitly and in full at the head of "Standard Template A" section. Each task's specifics (`<sub>` name, class name, internal imports listed) are listed in its own task body. Task 5 (cyclic bundle) is fully spelled out — no template reference. Task 6 + 7 are also fully spelled out.

**3. Type consistency:**
- `AutomationModule` named consistently across all tasks (the destination)
- `AutomationModule` from `@hubblewave/automation` lib distinguished from our migrating module via call sites
- Sub-module class names listed per task: `AutomationRuntimeModule` (Task 2 — note module file is `automation-runtime.module.ts` not `runtime.module.ts`), `SchedulingModule` (Task 3), `SyncTriggerModule` (Task 4), `AvaModule` + `RulesModule` (Task 5 cyclic bundle), `AutomationHealthController` (Task 6 rename target)
- `git mv` paths consistent (`apps/svc-automation/src/app/<sub>` → `apps/api/src/app/automation/<sub>`)
- Import path replacement pattern consistent (`'./<sub>/<file>'` → `'../../../api/src/app/automation/<sub>/<file>'` from app.module level; 4-level-up from sub-directory level)

**4. Scope check:** Plan covers exactly automation migration — not other svc-* services, not full W1 cutover. ~1.5 weeks of solo work. ~7 substantive tasks plus verification. Single plan size is appropriate.

**5. Dependency graph correctness:** Re-verified the cross-dep listing against actual grep output:
- 1 cycle: ava ↔ rules (both module files import each other; both also depend on runtime; rules also on scheduling)
- 4 sub-module-to-sub-module non-cycle edges: scheduling→runtime, sync-trigger→runtime, ava→runtime, rules→runtime + rules→scheduling
- runtime is a clean leaf (no sub-module deps)
- Migration order respects all edges:
  - runtime BEFORE all dependents (Task 2)
  - scheduling BEFORE rules (Task 3 before Task 5)
  - ava + rules atomic (Task 5)

**6. Cyclic-core handling:** ava + rules bundle migrated atomically (Task 5) — same pattern as identity's larger cyclic bundle. The atomic commit avoids any intermediate state where one half is broken because its sibling moved away.

**7. Selftest fixture:** The `__selftest_fixture__/` directory in svc-automation is empty/scaffolding. NOT migrated; stays in svc-automation for the legacy thin adapter. This is consistent with how the selftest framework expects fixtures to live in their native svc-* directories.

**8. No mid-stream service-file move needed:** Unlike data (which had collection-data.service + model-registry.service consumed by sub-modules), svc-automation has no top-level service files — only health.controller.ts which moves in Task 6. The dep graph survey confirmed no top-level → sub-module edges.

No issues found.

---

**End of automation migration plan.**

---

## Status: Complete (2026-05-10)

ARC-W1 automation migration complete. apps/api/src/app/automation/ now contains
all 5 sub-directories (runtime, scheduling, sync-trigger, ava, rules) +
AutomationHealthController + automation.module.ts (full composition).
apps/svc-automation is reduced to a thin adapter (only `app.module.ts` +
`__selftest_fixture__/`); legacy service stays runnable for parallel deployment
until full W1 cutover.

### Tasks executed

| Task | Commit | Note |
|---|---|---|
| 1. Skeleton | `282f655` | Empty AutomationModule registered in apps/api AppModule |
| 2. runtime (leaf, biggest 14 files) | `22bbfa9` | All 4 dependent sub-modules' import paths updated to point at apps/api during this commit |
| 3. scheduling | `328d2ae` | 4-level-up runtime paths inside scheduling/ rewritten to sibling-relative |
| 4. sync-trigger | `aac7bd3` | Same pattern as scheduling |
| 5. ava+rules cyclic bundle (atomic) | `e510a44` | 5 files in single commit; sibling cycle imports preserved unchanged; runtime/scheduling 4-level-up paths corrected to siblings |
| 6. Final composition + thin adapter | `6af73bc` | HealthController → AutomationHealthController (route `/automation/health`); `@hubblewave/automation` lib aliased on import as `AutomationLibModule` to avoid name collision |
| 7. Verification + tag | `3df09fc` | + scanner allowlist entries for the 2 new apps/api/automation files (health controller + script-sandbox spec) |

### Verification at tag

| Check | Result |
|---|---|
| `authz:check` | PASS (1 deferred entry tracked) |
| `audit:check` | PASS |
| `security:check` | PASS (after Task 7 allowlist fixup) |
| `service-boundary:check` | PASS |
| `deps:check` | PASS |
| `dead-code:check` | PASS |
| `selftest:scanners` | PASS — security 7, authz 7, service-boundary 12, dead-code 11, eslint-rules 14+7 |
| nx build api | PASS |
| nx build svc-identity | PASS |
| nx build svc-metadata | PASS |
| nx build svc-data | PASS |
| nx build svc-automation | PASS |
| nx test api | PASS (283 tests) |

**Tag:** `arc-w1-automation-complete` at HEAD `3df09fc`. 8 commits since `arc-reconciled-with-w1-security` (skeleton + 5 sub-module migrations + final composition + allowlist fixup).

### Cumulative migration state

| Service | Status | LoC |
|---|---|---|
| svc-identity | ✓ migrated to apps/api/identity | ~17,200 |
| svc-metadata | ✓ migrated to apps/api/metadata | ~21,200 |
| svc-data | ✓ migrated to apps/api/data | ~17,700 |
| svc-automation | ✓ migrated to apps/api/automation | ~9,865 |
| **Total** | **4 services** | **~65,965** |

### Next steps in W1

The remaining svc-* services need migration plans of similar shape:
- svc-ava (~8,000 LoC; AVA runtime; F072+F074 proposal state machine overlap)
- svc-workflow (~3,000 LoC; per canon §8 INVERT may merge with automation)
- svc-control-plane (~6,000 LoC; multi-tenant by design; different shape)
- Fold-ins: svc-view-engine, svc-insights, svc-notify, svc-instance-api
- W1 final cutover: delete legacy svc-* directories, delete service-boundary scanner per canon §21 TRIM, route 100% traffic to apps/api, tag arc-w1-complete
