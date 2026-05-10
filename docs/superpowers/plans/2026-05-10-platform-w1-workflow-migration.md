# Platform W1 Workflow Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate `apps/svc-workflow/src/app/workflow/` (~3,592 LoC across 17 files) into `apps/api/src/app/automation/workflow/`, **folded under automation per canon §8 INVERT** (automation+workflow merger). svc-workflow becomes a thin adapter that imports `AutomationModule` (which now includes workflow as a 6th sub-area).

**Architecture:** Per canon §8 INVERT amendment ("merge automation+workflow into one engine"), svc-workflow's `workflow/` sub-module nests INSIDE `apps/api/src/app/automation/` rather than getting its own top-level area like the prior 5 services. This is the first ARC-W1 migration that doesn't create a new top-level apps/api/<area>/.

**Tech Stack:** TypeScript 5.9, NestJS 11, TypeORM 0.3, Postgres, Nx 22 monorepo. Same lib deps as svc-automation: `@hubblewave/auth-guard`, `@hubblewave/automation` (lib), `@hubblewave/authorization`, `@hubblewave/instance-db`, `@hubblewave/redis`. Plus `@nestjs/schedule` (svc-workflow uses ScheduleModule.forRoot for SLA timers).

**Spec reference:** Canon §8 amended via commit `99487c4`. PLATFORM-ROADMAP.md Phase 1 #3.

**Predecessor plans (all merged into master):**
- arc-w1-foundation-partial / identity / metadata / data / automation / ava
- arc-reconciled-with-w1-security

**Solo founder, ~3–4 days of work.** ~3 substantive tasks plus verification gate. Smaller than every prior W1 migration because:
- 1 sub-module (vs ava's 4, automation's 5)
- No cycles, no top-level service-file deps, no naming collisions
- No new apps/api top-level area to create — it nests inside existing automation
- HealthController stays in svc-workflow's thin adapter (k8s probe at `/health` on svc-workflow's own port)

---

## Sub-module inventory (measured 2026-05-10)

| Element | Files | LoC | Pattern |
|---|---|---|---|
| `workflow/` sub-module | 17 | 3,592 | Standard module (`WorkflowModule`); 4 controllers + 13 services + module + types |
| Top-level health.controller.ts | 1 | ~19 | Stays in svc-workflow thin adapter for k8s probe at `/health` |
| Top-level app.module.ts | 1 | ~30 | Becomes thin adapter |
| **Total** | **19** | **~3,641** | |

### Cross-deps

- workflow/ has NO cross-area deps (verified — only imports from `@hubblewave/*` libs, `@nestjs/*`, and intra-workflow siblings)
- workflow.module.ts references many entities (ProcessFlowDefinition, ProcessFlowInstance, etc.) from `@hubblewave/instance-db` — no ownership conflict (workflow entities are not in `ENTITY_OWNERSHIP`)

### Why fold into automation, not a new top-level area

Canon §8 INVERT: "Automation and workflow merge into a single engine." Three architectural reasons:

1. **Domain unity:** Workflow rules and automation rules are kinds of "deterministic record-driven behaviors" per canon §8. The split between "automation" (record-scoped) and "workflow" (long-running, stateful, human-aware) is a feature-set distinction within ONE engine, not separate engines.
2. **Shared dependencies:** workflow uses entities (Approval, ProcessFlow*) that align with automation's domain (rules, scheduled jobs, execution logs). Co-location makes cross-cutting changes safer.
3. **Future apps/api shape:** apps/api should have N top-level areas, not 14. Folding workflow under automation reduces the eventual top-level count from ~9 to ~8 instance areas.

**Tag at completion:** `arc-w1-workflow-complete`. Migrated under `apps/api/src/app/automation/workflow/`. svc-workflow becomes thin adapter that imports `AutomationModule` (NOT a new `WorkflowModule` at top level).

---

## Migration order (concrete)

1. **Migrate workflow sub-module** — single move; register WorkflowModule in `apps/api/src/app/automation/automation.module.ts`
2. **Replace svc-workflow app.module.ts** as thin adapter; keep HealthController in place at apps/svc-workflow/src/app/health.controller.ts (k8s probe)
3. **Verification + tag**

### Pre-flight checks (each task)

1. Working directory + branch + HEAD
2. Empty-directory pre-flight (`find apps/api/src/app/automation/workflow -type d -empty`)
3. Forbidden file list: nx.json, package.json, package-lock.json, .vscode, .gitignore, tsconfig.base.json, tools/, docs/
4. `git mv` only
5. Recovery: `git reset --hard <previous-commit>`

---

## Task 1: Migrate workflow/ sub-module into apps/api/automation/workflow/

**Files:**
- Move: `apps/svc-workflow/src/app/workflow/` (17 files) → `apps/api/src/app/automation/workflow/`
- Modify: `apps/api/src/app/automation/automation.module.ts` (register WorkflowModule + checklist update)
- Modify: `apps/svc-workflow/src/app/app.module.ts` (update WorkflowModule import path)

**Why this matters:** Lands the bulk of svc-workflow's logic into apps/api. Automation gains a 6th sub-area. svc-workflow can still serve workflow endpoints via the thin adapter.

### Steps

- [ ] **Step 1: Verify state**

```bash
cd "<worktree-path>" && pwd && git rev-parse --abbrev-ref HEAD && git log --oneline -1 && ls apps/svc-workflow/src/app/ && ls apps/svc-workflow/src/app/workflow/
```

Expected: HEAD post-PR-#8 (master tip with arc-w1-ava-complete in history). svc-workflow has app.module.ts + health.controller.ts + workflow/ + __selftest_fixture__/. workflow/ has 17 files.

- [ ] **Step 2: Empty-dir pre-flight**

```bash
find apps/api/src/app/automation/workflow -type d -empty 2>&1
```

Rmdir if empty.

- [ ] **Step 3: Move workflow directory into automation/**

```bash
git mv apps/svc-workflow/src/app/workflow apps/api/src/app/automation/workflow
```

- [ ] **Step 4: Verify clean move**

```bash
ls apps/api/src/app/automation/workflow/
```

Should show all 17 files. NO `automation/workflow/workflow/` (nesting bug).

- [ ] **Step 5: Stale-path scan inside the moved files**

```bash
grep -rn "from '\.\./\.\./\.\./\.\./api" apps/api/src/app/automation/workflow/
```

Should return nothing. workflow's internal imports are sibling-relative; no apps/api absolute paths.

Verify also: workflow's imports of `RuntimeAnomalyModule` etc. via `@hubblewave/instance-db` (not relative paths) survive unchanged.

- [ ] **Step 6: Find consumer imports in svc-workflow**

```bash
grep -rn "from '\./workflow\|from '\.\./workflow" apps/svc-workflow/src --include="*.ts"
```

Expected: ONE match in `apps/svc-workflow/src/app/app.module.ts`: `import { WorkflowModule } from './workflow/workflow.module';`. Update path:
- `'./workflow/workflow.module'` → `'../../../api/src/app/automation/workflow/workflow.module'`

- [ ] **Step 7: Update apps/api/src/app/automation/automation.module.ts**

- Add `import { WorkflowModule } from './workflow/workflow.module';` after the existing module imports (alongside AutomationRuntimeModule, SchedulingModule, etc.)
- Add `WorkflowModule` to `imports: []` array
- Add `WorkflowModule` to `exports: []` array

Update the migration progress comment to mention workflow folded in. Add a section under "Standard modules":
```
 *     [x] workflow (WorkflowModule — folded under automation per canon §8 INVERT;
 *         migrated 2026-05-10 via arc-w1-workflow-complete)
```

- [ ] **Step 8: Build both apps**

```bash
npx nx build api 2>&1 | tail -10 && npx nx build svc-workflow 2>&1 | tail -10
```

Both must succeed.

- [ ] **Step 9: Verify clean status**

Expected: 17 file renames (the workflow/ directory contents) + 2 modifications (apps/svc-workflow/src/app/app.module.ts import path; apps/api/src/app/automation/automation.module.ts registration).

- [ ] **Step 10: Commit**

```
feat(api): migrate workflow/ (WorkflowModule) from svc-workflow into apps/api/automation per canon §8 INVERT

ARC-W1-workflow task 1. Folds workflow into the automation engine per
canon §8 amendment (automation+workflow merger). 17 files / ~3,592 LoC
land at apps/api/src/app/automation/workflow/ alongside automation's
other sub-areas (runtime, scheduling, sync-trigger, ava, rules).

WorkflowModule registered in automation.module.ts imports + exports;
svc-workflow's app.module.ts import path updated to point at apps/api.

No cycles, no cross-area deps, no naming collisions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Task 2: Replace svc-workflow app.module.ts with thin adapter

**Files:**
- Modify: `apps/svc-workflow/src/app/app.module.ts` (replace with thin adapter)

**Why this matters:** Final reduction of svc-workflow to a 1-line wrapper. Keeps health.controller.ts in place for the k8s probe at `/health` on svc-workflow's port.

### Steps

- [ ] **Step 1: Verify state**

```bash
ls apps/svc-workflow/src/app/
```

Expected: `app.module.ts`, `health.controller.ts`, `__selftest_fixture__/`. NO `workflow/` (gone in Task 1).

- [ ] **Step 2: Read current app.module.ts** to inventory imports/wiring (should match svc-workflow's pre-migration state minus the moved workflow imports)

- [ ] **Step 3: Replace app.module.ts**

Use Write tool to overwrite `apps/svc-workflow/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AutomationModule } from '../../../api/src/app/automation/automation.module';
import { HealthController } from './health.controller';

/**
 * apps/svc-workflow is a thin adapter that imports AutomationModule from
 * apps/api. AutomationModule includes workflow as a sub-area (per canon §8
 * INVERT: automation + workflow merge into one engine), so svc-workflow's
 * port serves the same workflow + automation endpoints.
 *
 * HealthController stays here to serve /health on svc-workflow's port for
 * the k8s probe (AutomationHealthController in apps/api serves /automation/health).
 */
@Module({
  imports: [AutomationModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 4: Build both apps**

```bash
npx nx build api 2>&1 | tail -3 && npx nx build svc-workflow 2>&1 | tail -3
```

Both must succeed.

- [ ] **Step 5: Verify directory state**

```bash
ls apps/svc-workflow/src/app/
```

Expected: `app.module.ts` (thin adapter), `health.controller.ts` (k8s probe), `__selftest_fixture__/` only.

- [ ] **Step 6: Commit**

```
feat(workflow): svc-workflow becomes thin adapter wrapping AutomationModule

ARC-W1-workflow FINAL TASK. apps/svc-workflow/src/app/app.module.ts now
imports AutomationModule from apps/api (which includes the workflow
sub-area folded in via Task 1). HealthController stays in place to
serve /health on svc-workflow's port for the k8s probe.

Per canon §8 INVERT, automation and workflow are one engine; svc-workflow
remains as a deployment vehicle (its own port, its own k8s pod) but its
business logic now lives at apps/api/src/app/automation/workflow/.

Legacy service deletion deferred to W1 final cutover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Task 3: Final verification + tag

**No scanner MIGRATED_AREAS update needed** — workflow nests under `automation`, which is already in MIGRATED_AREAS (added during arc-w1-automation-complete). The scanner walks `apps/api/src/app/automation/` recursively, so workflow code is automatically covered.

**Possible PUBLIC_ALLOWLIST update:** if any workflow controller has `@Public()` endpoints, add them. From the file list (workflow-definitions.controller, workflow-instances.controller, workflow-approvals.controller, workflow-webhook.controller), the webhook controller is the most likely candidate for public access. Run `npm run security:check` after Task 1+2 land and add allowlist entries as needed.

### Steps

- [ ] **Step 1: Run all 6 architectural scanners** — all must pass
- [ ] **Step 2: Selftests** — all suites green
- [ ] **Step 3: Build all 7 monolith-state apps** — api, svc-identity, svc-metadata, svc-data, svc-automation, svc-ava, svc-workflow
- [ ] **Step 4: Run apps/api tests**
- [ ] **Step 5: Verify svc-workflow state** — only `app.module.ts` + `health.controller.ts` + `__selftest_fixture__/`
- [ ] **Step 6: Verify apps/api/src/app/automation/workflow state** — 17 files
- [ ] **Step 7: Update automation.module.ts checklist** to mention workflow as the 6th sub-area (already done in Task 1 step 7)
- [ ] **Step 8: Add PUBLIC_ALLOWLIST entries if security:check flags any workflow public endpoints** — likely workflow-webhook.controller.ts (webhook receivers are typically public)
- [ ] **Step 9: Tag `arc-w1-workflow-complete`**
- [ ] **Step 10: Append completion note to plan**
- [ ] **Step 11: Commit completion note**

---

## Self-review

**1. Spec coverage:** Plan covers svc-workflow migration in full — 17-file workflow/ sub-module folded under automation/, health.controller.ts kept in svc-workflow thin adapter for k8s probe.

**2. Placeholder scan:** All 3 tasks have explicit steps. No "TBD" markers.

**3. Type consistency:**
- `WorkflowModule` named consistently
- No HealthController rename (it stays at svc-workflow; apps/api's automation already has AutomationHealthController for /automation/health)
- `git mv` paths consistent
- Import path replacement: 3-level-up from app.module level

**4. Scope check:** Plan covers exactly workflow folding into automation. ~3–4 days. ~3 substantive tasks.

**5. Dependency graph correctness:** workflow has no cross-area deps. Folding under automation introduces no new edges (workflow doesn't import from runtime/scheduling/sync-trigger/ava/rules).

**6. Canon §8 INVERT alignment:** Migration realizes the canon's automation+workflow merger architecturally. apps/api/src/app/automation/ has 6 sub-areas after this lands.

**7. Scanner MIGRATED_AREAS:** No update needed — workflow nests under existing automation MIGRATED_AREA.

**8. svc-workflow health:** Kept in thin adapter so k8s probe at /health on svc-workflow's port continues working during parallel deployment. Canonical AutomationHealthController serves /automation/health on apps/api's port.

No issues found.

---

**End of workflow migration plan.**
