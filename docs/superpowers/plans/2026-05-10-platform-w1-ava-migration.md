# Platform W1 AVA Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the entire `apps/svc-ava` Nest application (4 top-level sub-directories with internal modules + 9 top-level files = ~8,731 LoC across ~46 files) into `apps/api/src/app/ava/`, leaving `apps/svc-ava` runnable in parallel via a thin adapter.

**Architecture:** svc-ava's cross-area dependency graph is a **clean DAG with no cycles** — easier than svc-automation (which had `ava ↔ rules` cycle) and easier than identity (which had a 4-module cyclic-core bundle). All 4 sub-directories (`search`, `ava-tools`, `modelops`, `phase7`) are independent leaves; the 5 modules inside `modelops/` are also independent of each other. Top-level files don't have cross-area-internal deps from sub-modules either. Standard topological migration order: skeleton → 4 sub-area migrations (any order, smallest first) → final top-level + thin adapter.

**Tech Stack:** TypeScript 5.9, NestJS 11, TypeORM 0.3, Postgres, Nx 22 monorepo, Jest 30. svc-ava additionally uses `@nestjs/event-emitter` and `@hubblewave/ai` (the AVA AI/RAG library).

**Spec reference:** `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §2 (target architecture). Canon §11 (AVA is reasoning layer over platform state).

**Predecessor plans:**
- `docs/superpowers/plans/2026-05-10-platform-w1-data-migration.md` (status `arc-w1-data-complete`)
- `docs/superpowers/plans/2026-05-10-phase0-branch-reconciliation.md` (status `arc-reconciled-with-w1-security`)
- `docs/superpowers/plans/2026-05-10-platform-w1-automation-migration.md` (status `arc-w1-automation-complete`)

This plan continues by migrating ava. **Clean DAG, no cyclic-core bundle needed.**

**Solo founder, ~1.5–2 weeks of work.** ~7 substantive tasks plus verification gate.

---

## Naming wrinkle — two `AvaModule` classes

**`apps/api/src/app/automation/ava/`** already exists from the svc-automation migration. It exports a class called `AvaModule` (the AVA-driven automation-rule generator — small, 2 files, ~600 LoC, depends on rules + runtime).

**`apps/api/src/app/ava/`** is svc-ava's destination. It will also export `AvaModule` (the canonical AVA service — the AI/RAG/chat reasoning layer). Different file, different namespace, different class.

These are distinct concepts: the existing `automation/ava` is automation's natural-language rule-creation feature, while the new `ava/` is the platform's AVA reasoning layer per canon §11. Both keep their `AvaModule` class name (consistent with their respective contexts). Where they meet (e.g. if a single file imports both), use import-time aliasing:

```typescript
import { AvaModule } from './ava/ava.module'; // svc-ava destination
import { AvaModule as AutomationAvaModule } from './automation/automation.module'; // automation's nested ava (re-exported)
```

In practice, the apps/api root app.module.ts only needs to import `AvaModule` from `./ava/ava.module` — `AutomationModule` already re-exports the automation-side `AvaModule` internally. No alias needed at the root unless explicitly importing the nested one.

---

## Sub-area inventory (measured 2026-05-10)

| Area | Files (incl spec) | LoC | Pattern | Cross-deps | Migration order |
|---|---|---|---|---|---|
| `ava-tools` | 3 | 166 | Standard module (`AvaToolsModule`) | none | independent leaf — smallest, do first |
| `search` | 10 | 1,655 | Standard module (`SearchModule`) | none | independent leaf |
| `phase7` | 12 | 2,430 | 11 standalone controllers + barrel `index.ts` (no module wrapper at sub-area level — controllers register directly in apps/api/ava/ava.module.ts) | none | independent leaf |
| **`modelops`** | **22** | **2,280** | **5 separate standard modules in flat dir** (DatasetModule, ModelRegistryModule, ModelEvaluationModule, TrainingModule, ModelDeploymentModule) | **none (between modelops modules or to other areas)** | **independent — can migrate as one bundled move** |
| Top-level files (9) | 9 | ~2,200 | 7 controllers + 1 service + app.module.ts | none from top-level → sub-area | last (after all sub-areas) |
| **Total** | **~46** | **~8,731** | | | |

### Sub-module patterns to handle

1. **Standard modules** (search, ava-tools, all 5 modelops sub-modules): each has a `*.module.ts` with `@Module`. Register `<X>Module` in `imports: []` and `exports: []` of the destination `ava.module.ts`.
2. **Phase7 standalone controllers**: 11 files (`nl-query.controller.ts`, `ai-reports.controller.ts`, etc.) plus `index.ts` barrel that re-exports them. No `phase7.module.ts`. The migration moves the directory; the destination `ava.module.ts` registers each controller directly in `controllers: []`. Same pattern as data's service-only sub-directories (work, offerings) but with controllers only.
3. **Modelops 5-in-1 directory**: `apps/svc-ava/src/app/modelops/` contains 5 modules in a single flat directory (each module's controller + service + types + module file). They have no inter-dependencies. Move the whole `modelops/` directory in one task; register all 5 modules in destination `ava.module.ts`.

### Migration order (concrete)

1. **Skeleton + register** — empty AvaModule class at `apps/api/src/app/ava/ava.module.ts`, registered in apps/api root app.module.ts after `AutomationModule`
2. **`ava-tools`** (3 files, 166 LoC) — smallest standalone sub-area, good first migration
3. **`search`** (10 files, 1,655 LoC) — standalone standard module
4. **`modelops`** (22 files, 2,280 LoC, 5 internal modules) — single move; destination ava.module.ts registers all 5 sub-modules
5. **`phase7`** (12 files, 2,430 LoC, 11 controllers + barrel) — standalone barrel; destination ava.module.ts registers all 11 controllers
6. **Final top-level migration** — 7 controllers + 1 service + app.module thin adapter; HealthController → AvaHealthController (route `/ava/health`)
7. **Verification gate** — build, scanners, selftests, tag `arc-w1-ava-complete`

### Pre-flight checks per task

For every sub-area migration task, the prompt MUST include these checks:

1. **Working directory** — verify pwd + branch + expected HEAD
2. **Empty-directory check** — `find apps/api/src/app/ava -type d -empty`; rmdir any residual
3. **No forbidden file modifications** — explicit list: `nx.json`, `package.json`, `package-lock.json`, `.vscode/`, `.gitignore`, `tsconfig.base.json`, `tools/`, `docs/`
4. **`git mv` only** — no copies, no creating new files in svc-ava
5. **Authorized recovery path** — `git reset --hard <previous-commit>` if state is broken

---

## Files Created/Modified Overview

### Per task (template — applies to standard sub-area migration)

**Modified:**
- `apps/svc-ava/src/app/app.module.ts` — change `from './<sub>/<sub>.module'` to `from '../../../api/src/app/ava/<sub>/<sub>.module'` for the migrating sub-area
- `apps/api/src/app/ava/ava.module.ts` — add the migrated module(s) to imports + exports arrays
- (possibly) other svc-ava files that imported from the migrating area — paths updated similarly (likely none for svc-ava since cross-area deps are clean)

**Moved (`git mv`):**
- `apps/svc-ava/src/app/<sub>/` → `apps/api/src/app/ava/<sub>/`

### Plan-end state

- `apps/api/src/app/ava/` contains 4 sub-directories (search, ava-tools, modelops, phase7) + 8 top-level files (7 controllers + 1 service + ava.module.ts; HealthController renamed to AvaHealthController)
- `apps/api/src/app/app.module.ts` registers `AvaModule` after `AutomationModule`
- `apps/svc-ava/src/app/app.module.ts` is a thin wrapper that imports AvaModule from apps/api
- `apps/svc-ava/src/main.ts` and `project.json` remain unchanged
- Selftest fixture at `apps/svc-ava/src/app/__selftest_fixture__/` remains in place (selftest scaffolding)
- Legacy service deletion deferred to W1 final-cutover plan

---

## Task 1: Create apps/api/src/app/ava skeleton

**Files:**
- Create: `apps/api/src/app/ava/ava.module.ts` (empty composition)
- Modify: `apps/api/src/app/app.module.ts` (register AvaModule)

- [ ] **Step 1: Verify state** (pwd, branch, HEAD)

- [ ] **Step 2: Empty-dir pre-flight**

```bash
cd "<worktree-path>" && find apps/api/src/app/ava -type d -empty 2>&1
```

If `apps/api/src/app/ava` exists empty, `rmdir` it.

- [ ] **Step 3: Create directory + skeleton**

Write `apps/api/src/app/ava/ava.module.ts`:

```typescript
import { Module } from '@nestjs/common';

/**
 * AvaModule consolidates everything from apps/svc-ava into the apps/api
 * modular monolith. Sub-areas migrate one at a time via git mv; each
 * migration registers its module(s) here.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-ava-migration.md):
 *   Sub-areas:
 *     [ ] ava-tools (AvaToolsModule)
 *     [ ] search (SearchModule)
 *     [ ] modelops (5 modules: Dataset/ModelRegistry/ModelEvaluation/Training/ModelDeployment)
 *     [ ] phase7 (11 standalone controllers + barrel; no module wrapper)
 *   Final top-level (7 controllers + 1 service + app.module thin adapter):
 *     [ ] ava-health.controller (renamed from health.controller)
 *     [ ] chat, embedding, AVA, AVAGovernance, AVASchema, AvaProposal controllers
 *     [ ] AvaPreviewService
 *     [ ] ava.module final composition
 *     [ ] svc-ava app.module thin adapter
 *
 * Note: there is also an AvaModule at apps/api/src/app/automation/ava/ava.module.ts
 * (svc-automation's natural-language automation-rule generator). The two are
 * distinct: this AvaModule is the platform's canonical AVA reasoning layer
 * (canon §11). Both keep the AvaModule class name in their respective
 * namespaces; consumers that need both alias one on import.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class AvaModule {}
```

- [ ] **Step 4: Register AvaModule in apps/api AppModule**

Edit `apps/api/src/app/app.module.ts`. Add `import { AvaModule } from './ava/ava.module';` and append `AvaModule` to the imports array (after `AutomationModule`).

After: `imports: [KernelModule, DbModule, AuditModule, IdentityModule, MetadataModule, DataModule, AutomationModule, AvaModule]`.

- [ ] **Step 5: Build verify**

```bash
cd "<worktree-path>" && npx nx build api 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(api): create empty AvaModule skeleton in apps/api"
```

---

## Standard Template A — applied 4x for ava-tools / search / modelops / phase7

For each sub-area `<sub>`:

1. Verify state + empty-dir pre-flight
2. `git mv apps/svc-ava/src/app/<sub> apps/api/src/app/ava/<sub>`
3. Verify clean move (no nesting)
4. Stale-path scan inside moved files (handle 4-level-up apps/api paths if any)
5. Find consumer imports in svc-ava + update paths
6. Verify zero orphans
7. Update `apps/api/src/app/ava/ava.module.ts` with import + register
8. Build both apps; both must succeed
9. Verify clean status
10. Commit

---

## Task 2: Migrate `ava-tools` (3 files, 166 LoC) — smallest, first

**Class name:** `AvaToolsModule`. **File:** `ava-tools.module.ts`.
**Cross-deps:** none.

[Apply Standard Template A with `<sub>` = `ava-tools` and `<ClassName>Module` = `AvaToolsModule`]

---

## Task 3: Migrate `search` (10 files, 1,655 LoC) — standalone standard module

**Class name:** `SearchModule`. **File:** `search.module.ts`.
**Cross-deps:** none.

[Apply Standard Template A with `<sub>` = `search` and `<ClassName>Module` = `SearchModule`]

---

## Task 4: Migrate `modelops` (22 files, 2,280 LoC, 5 standard modules in one flat dir)

**Class names:** `DatasetModule`, `ModelRegistryModule`, `ModelEvaluationModule`, `TrainingModule`, `ModelDeploymentModule`.
**Files:** `modelops/{dataset,model-registry,model-evaluation,training,model-deployment}.module.ts`.
**Cross-deps:** none (verified — no inter-modelops deps; no cross-area deps).

**Special handling:** modelops/ is a single directory with 5 modules. Move the whole directory in one `git mv`. Then in destination `ava.module.ts`, add 5 imports + register all 5 in `imports: []` and `exports: []`:

```typescript
import { DatasetModule } from './modelops/dataset.module';
import { ModelRegistryModule } from './modelops/model-registry.module';
import { ModelEvaluationModule } from './modelops/model-evaluation.module';
import { TrainingModule } from './modelops/training.module';
import { ModelDeploymentModule } from './modelops/model-deployment.module';
```

[Apply Standard Template A with `<sub>` = `modelops`. Step 7 registers 5 modules instead of 1.]

---

## Task 5: Migrate `phase7` (12 files, 2,430 LoC, 11 controllers + barrel)

**Pattern:** Service-only-equivalent (no module wrapper); 11 controllers register directly in `ava.module.ts`'s `controllers: []` array.

**Files:** 11 `*.controller.ts` files (nl-query, ai-reports, voice-control, predictive-ui, agile-development, living-docs, predictive-ops, digital-twin, self-healing, app-builder, upgrade-assistant) + 1 `index.ts` barrel.

**Special handling:** the destination `ava.module.ts` has to register all 11 controllers individually. Use the barrel for the import:

```typescript
import {
  NLQueryController,
  AIReportsController,
  VoiceControlController,
  PredictiveUIController,
  AgileDevelopmentController,
  LivingDocsController,
  PredictiveOpsController,
  DigitalTwinController,
  SelfHealingController,
  AppBuilderController,
  UpgradeAssistantController,
} from './phase7';
```

Then add all 11 to `controllers: []` array.

[Apply Standard Template A with `<sub>` = `phase7`. Step 7 registers 11 controllers in `controllers: []` array (no module-class registration since phase7 has no module wrapper).]

---

## Task 6: Final top-level migration (7 controllers + 1 service + thin adapter)

**Files:**
- Move: 7 top-level controllers (ava, ava-governance, ava-schema, ava-proposal, chat, embedding, **health → renamed to ava-health**)
- Move: 1 top-level service (ava-preview.service.ts)
- Modify: `apps/api/src/app/ava/ava.module.ts` (final composition)
- Replace: `apps/svc-ava/src/app/app.module.ts` (becomes thin wrapper)

**Special considerations:**

1. **HealthController** has the same class name as identity's, metadata's (`MetadataHealthController`), data's (`DataHealthController`), and automation's (`AutomationHealthController`). When svc-ava's `HealthController` moves, **rename file + class to `AvaHealthController`** with route prefix `'ava/health'`.

2. **AVAController class name** uses all-caps (similar to `AVAModule` in data — different from svc-automation's `AvaModule`). Verify: `grep "export class AVA" apps/svc-ava/src/app/*.ts`.

3. **app.module.ts wiring** — the original svc-ava app.module.ts has lib-level imports: `ConfigModule.forRoot({ isGlobal: true })`, `EventEmitterModule.forRoot()`, `InstanceDbModule`, `AIModule` (from `@hubblewave/ai`), `AuthGuardModule`, `GlobalGuardsModule`, `AuthorizationModule.forInstance()`, `RedisModule.forRoot()`. All preserved verbatim in the destination ava.module.ts.

[Use Sonnet model for this task — judgment-heavy rewrite combining 4 sub-areas + 7 controllers + 1 service + global wiring.]

### Steps for Task 6

- [ ] **Step 1: Verify state** — Tasks 1-5 complete; svc-ava/app/ has only top-level files + selftest fixture
- [ ] **Step 2: Empty-dir pre-flight**
- [ ] **Step 3: Move 7 controllers** (with health.controller.ts → ava-health.controller.ts rename)
- [ ] **Step 4: Move ava-preview.service.ts**
- [ ] **Step 5: Rename HealthController → AvaHealthController + route → '/ava/health'**
- [ ] **Step 6: Stale-path scan inside moved files**
- [ ] **Step 7: Read svc-ava's app.module.ts FIRST to enumerate global wiring**
- [ ] **Step 8: Rewrite apps/api/src/app/ava/ava.module.ts as final composition**
- [ ] **Step 9: Replace svc-ava's app.module.ts with thin adapter**
- [ ] **Step 10: Build both apps**
- [ ] **Step 11: Verify clean status**
- [ ] **Step 12: Commit**

---

## Task 7: Final verification + tag

- [ ] **Step 1: Run all 6 architectural scanners** — all must pass
- [ ] **Step 2: Selftests** — all suites must pass
- [ ] **Step 3: Lint apps/api and svc-ava** — pre-existing tolerable; no NEW errors
- [ ] **Step 4: Build all 6 monolith-state apps** — api, svc-identity, svc-metadata, svc-data, svc-automation, svc-ava
- [ ] **Step 5: Run apps/api tests**
- [ ] **Step 6: Verify svc-ava state** — only `app.module.ts` + `__selftest_fixture__/` remaining
- [ ] **Step 7: Verify apps/api/src/app/ava state** — 4 sub-dirs + 9 top-level files
- [ ] **Step 8: Verify checklist 100% checked**
- [ ] **Step 9: Update MIGRATED_AREAS scanner sets** — add `'ava'` to MIGRATED_AREAS in both `tools/service-boundary-check.ts` and `tools/authz-bypass-check.ts` (lesson learned from svc-automation: do this in the same migration, not the next prerequisite PR)
- [ ] **Step 10: Update PUBLIC_ALLOWLIST in `tools/security-bypass-check.ts`** — add `apps/api/src/app/ava/ava-health.controller.ts` (k8s probe) and any other newly-migrated public endpoints (chat? embedding? — verify with `npm run security:check` after move and add as needed)
- [ ] **Step 11: Tag `arc-w1-ava-complete`**
- [ ] **Step 12: Append completion note to plan**
- [ ] **Step 13: Commit completion note**

---

## Self-review

**1. Spec coverage:** Plan covers svc-ava migration in full — 4 sub-areas + 9 top-level files + thin adapter. Legacy service stays runnable.

**2. Placeholder scan:** Tasks 2-5 use "Apply Standard Template A". Template defined explicitly. Each task's specifics (class names, cross-deps) listed in its body. Tasks 6 and 7 fully spelled out.

**3. Type consistency:**
- `AvaModule` in this plan = svc-ava's destination (canon §11 reasoning layer)
- Distinct from `AvaModule` at apps/api/src/app/automation/ava/ — two distinct classes, both keep their name
- `AvaHealthController` rename in Task 6 disambiguates routes from /health (identity), /metadata/health, /data/health, /automation/health
- `AVAController` (all-caps) is the existing class in svc-ava — verify name post-move

**4. Scope check:** Plan covers exactly ava migration — not other svc-* services, not full W1 cutover. ~1.5–2 weeks. ~7 substantive tasks.

**5. Dependency graph correctness:** Re-verified with grep:
- 4 top-level sub-dirs all independent
- 5 modelops sub-modules all independent of each other
- No cross-area deps from sub-modules
- Top-level files don't import from sub-areas
- Clean DAG; no cyclic-core bundle needed; no mid-stream service-file move

**6. Scanner MIGRATED_AREAS in same migration:** Per lesson from svc-automation review (Issue 3 there), add `'ava'` to MIGRATED_AREAS in this PR rather than the next migration's prerequisites. Same applies to PUBLIC_ALLOWLIST entries — add ava-health.controller.ts allowlist entry as part of this migration, not a follow-up.

**7. Selftest fixture:** `apps/svc-ava/src/app/__selftest_fixture__/` is referenced by `tools/authz-bypass-check-selftest.ts:190`. Leave in place during migration; selftest framework expects it at the apps/svc-* path.

**8. AVA proposal state machine overlap:** Per PLATFORM-ROADMAP.md, F072+F074 are findings about AVA proposal state machine that overlap with W6.C / Plan Fix 16. Those landed before svc-ava migration started (commit `ca16e40`); the proposal state machine logic IS in svc-ava's `ava-proposal.controller.ts`. The migration moves it as-is; further security tightening per F072/F074 is a Phase 2 follow-up, not part of this plan.

No issues found.

---

**End of ava migration plan.**

---

## Status: Complete (2026-05-10)

ARC-W1 ava migration complete. apps/api/src/app/ava/ now contains all 4
sub-areas (search, ava-tools, modelops, phase7) + 7 top-level controllers +
AvaPreviewService + ava.module.ts (full composition). apps/svc-ava reduced
to a thin adapter; legacy service stays runnable for parallel deployment.

### Tasks executed

| Task | Commit | Note |
|---|---|---|
| 1. Skeleton | `cf9b8e9` | Empty AvaModule registered in apps/api AppModule (after AutomationModule) |
| 2. ava-tools | `09c49f9` | Smallest standalone leaf (3 files) |
| 3. search | `70391fc` | Standalone leaf (10 files) |
| 4. modelops | `6b7d6db` | 5 modules in flat dir; single move; all 5 registered together |
| 5. phase7 | `09a03cc` | 11 standalone controllers + barrel; no module wrapper |
| 6. Final composition + thin adapter | `2f25476` | HealthController → AvaHealthController (route `/ava/health`) |
| 7. Scanner allowlists + MIGRATED_AREAS + selftest fixture path | `d5317ac` | PUBLIC_ALLOWLIST entries + 'ava' added to MIGRATED_AREAS in both scanners + Test 3 fixture path updated to apps/api/ava |

### Verification at tag

| Check | Result |
|---|---|
| `authz:check` | PASS |
| `audit:check` | PASS |
| `security:check` | PASS |
| `service-boundary:check` | PASS |
| `deps:check` | PASS |
| `dead-code:check` | PASS |
| `selftest:scanners` | PASS — security 7, authz 7, service-boundary 12, dead-code 11, eslint-rules 14+7 |
| nx build api / svc-identity / svc-metadata / svc-data / svc-automation / svc-ava | PASS (all 6) |
| nx test api | PASS |

**Tag:** `arc-w1-ava-complete` at HEAD `d5317ac`. 8 commits since `arc-w1-automation-complete`.

### Cumulative migration state

| Service | Status | LoC |
|---|---|---|
| svc-identity | ✓ migrated to apps/api/identity | ~17,200 |
| svc-metadata | ✓ migrated to apps/api/metadata | ~21,200 |
| svc-data | ✓ migrated to apps/api/data | ~17,700 |
| svc-automation | ✓ migrated to apps/api/automation | ~9,865 |
| svc-ava | ✓ migrated to apps/api/ava | ~8,731 |
| **Total** | **5 services** | **~74,696** |

### Next steps in W1

- svc-workflow (~3,000 LoC; per canon §8 INVERT may merge with apps/api/automation)
- svc-control-plane (~6,000 LoC; multi-tenant by design — different shape)
- Fold-ins: svc-view-engine, svc-insights, svc-notify, svc-instance-api
- W1 final cutover: delete legacy svc-* directories, delete service-boundary scanner per canon §21 TRIM, route 100% traffic to apps/api, tag arc-w1-complete
