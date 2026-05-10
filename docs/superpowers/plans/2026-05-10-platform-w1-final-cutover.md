# Platform W1 Final Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Delete the 11 thin-adapter `apps/svc-*` directories. Trim CI/CD, helm, and package.json scripts to reference only `apps/api`, `apps/control-plane`, `apps/worker`, `apps/web-client`, `apps/web-control-plane`, and `apps/svc-migrations` (the latter is a single-shot migration job, not a thin adapter — kept). Remove now-obsolete `MIGRATED_AREAS` / `KNOWN_VIOLATIONS` / `PUBLIC_ALLOWLIST` entries that referenced the deleted dirs. Mark Phase 1 ✅ in `PLATFORM-ROADMAP.md` and `RESUME-CONTEXT.md`.

**Architecture:** This is mechanical cleanup. The runtime semantics already live in `apps/api` + `apps/control-plane` (after PR #11). The thin adapters were only kept for graceful parallel-deployment overlap during the migration. The Helm chart for instance services is collapsed to a single deployment of `api`.

**Tech Stack:** Nx 22, GitHub Actions, Helm, TypeScript scanners.

**Spec reference:** Spec §2 (target topology: `apps/api` + `apps/control-plane`). PLATFORM-ROADMAP.md Phase 1 final.

**Predecessor:** arc-w1-foldins-complete (master HEAD post-PR-#11).

**Solo founder, ~half-day of work.** 5 tasks, no source-code changes; only deletions, CI/helm/scanner config updates, and docs.

---

## Inventory of changes

### Directories to delete (11 total)

| Directory | Migrated to | Tag when migrated |
|---|---|---|
| `apps/svc-identity/` | `apps/api/src/app/identity/` | arc-w1-identity-complete |
| `apps/svc-metadata/` | `apps/api/src/app/metadata/` | arc-w1-metadata-complete |
| `apps/svc-data/` | `apps/api/src/app/data/` | arc-w1-data-complete |
| `apps/svc-automation/` | `apps/api/src/app/automation/` | arc-w1-automation-complete |
| `apps/svc-ava/` | `apps/api/src/app/ava/` | arc-w1-ava-complete |
| `apps/svc-workflow/` | `apps/api/src/app/automation/workflow/` (§8 INVERT) | arc-w1-workflow-complete |
| `apps/svc-control-plane/` | `apps/control-plane/src/app/` | arc-w1-control-plane-complete |
| `apps/svc-view-engine/` | `apps/api/src/app/views/` | arc-w1-foldins-complete |
| `apps/svc-notify/` | `apps/api/src/app/notifications/` | arc-w1-foldins-complete |
| `apps/svc-instance-api/` | `apps/api/src/app/instance-api/` | arc-w1-foldins-complete |
| `apps/svc-insights/` | `apps/api/src/app/analytics/` | arc-w1-foldins-complete |

`apps/svc-migrations/` is **NOT** deleted (it is a single-shot K8s Job for running TypeORM migrations against the instance DB, not a service).

### Scanner files to update

- `tools/service-boundary-check.ts` — remove all 5 thin-adapter `KNOWN_VIOLATIONS` entries (svc-workflow, svc-view-engine, svc-notify, svc-instance-api, svc-insights). `ENTITY_OWNERSHIP` ownership labels (`svc-automation` etc.) stay — those are logical service identities, not pre-migration directory references.
- `tools/authz-bypass-check.ts` — `INSTANCE_SERVICES` list collapses: remove the 11 deleted entries; keep `svc-migrations` if applicable (it has no controllers though, so optional). Resulting list is just `apps/api` + `apps/control-plane`. `MIGRATED_AREAS` becomes empty / removed entirely.
- `tools/security-bypass-check.ts` — remove `PUBLIC_ALLOWLIST` entries that point at the deleted svc-* paths. Keep the `apps/api/...` and `apps/control-plane/...` entries (these are the canonical paths now). Same for `eval` and `spawn` allowlists.
- `tools/audit-bypass-check.ts` — remove any svc-* path references (likely none — audit scanner is content-driven).

### CI/CD files to update

- `.github/workflows/cd.yml` lines 88-95: matrix `service:` list. Replace `svc-identity / svc-data / svc-metadata / svc-ai / svc-control-plane / web-client / web-control-plane` with `api / control-plane / web-client / web-control-plane / svc-migrations`. (`svc-ai` was never a real service — predates the W0 fold-in inventory.)
- `.github/workflows/cd.yml` lines 251-254: `kubectl rollout status deployment/svc-X` checks. Replace with `deployment/api` and `deployment/control-plane`.
- `.github/workflows/release.yml` lines 115-119: same matrix update as cd.yml.
- `infrastructure/helm/instance-services/values.yaml`: `services:` list collapses to a single `api` entry. (Optional: rename the chart from `instance-services` to `instance-api` for accuracy.)
- `package.json` scripts: drop `dev:identity, dev:metadata, dev:data, dev:ava, dev:view-engine`; rewrite `dev:all` to `nx run-many --target=serve --projects=api,worker,web-client`. Keep `dev:api`, `dev:worker`, `dev:web`, `dev:platform`. Keep `migrate:run:instance:job` (references svc-migrations build, which still exists).

### Docs to update

- `docs/superpowers/PLATFORM-ROADMAP.md` — mark Phase 1 ✅. Add Phase 2 open.
- `docs/superpowers/RESUME-CONTEXT.md` — update "where we are" pickup section.

---

## Task 1: Delete 11 thin-adapter svc-* directories

**Files:**
- Delete: `apps/svc-identity/` (entire tree)
- Delete: `apps/svc-metadata/` (entire tree)
- Delete: `apps/svc-data/` (entire tree)
- Delete: `apps/svc-automation/` (entire tree)
- Delete: `apps/svc-ava/` (entire tree)
- Delete: `apps/svc-workflow/` (entire tree)
- Delete: `apps/svc-control-plane/` (entire tree)
- Delete: `apps/svc-view-engine/` (entire tree)
- Delete: `apps/svc-notify/` (entire tree)
- Delete: `apps/svc-instance-api/` (entire tree)
- Delete: `apps/svc-insights/` (entire tree)

- [ ] **Step 1: Delete all 11 directories in a single commit**

```bash
git rm -rf apps/svc-identity apps/svc-metadata apps/svc-data \
           apps/svc-automation apps/svc-ava apps/svc-workflow \
           apps/svc-control-plane apps/svc-view-engine apps/svc-notify \
           apps/svc-instance-api apps/svc-insights
```

- [ ] **Step 2: Verify svc-migrations is intact**

```bash
ls apps/svc-migrations/src/main.ts
```

Expected: file exists. svc-migrations stays — it is a single-shot K8s Job.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(svc-cleanup): delete 11 thin-adapter svc-* apps after W1 fold-ins

Per W1 final cutover. All 11 services migrated into apps/api or
apps/control-plane during arc-w1-identity-complete through
arc-w1-foldins-complete. The thin adapters served only graceful
parallel-deployment overlap; deleting them now."
```

---

## Task 2: Update scanners to drop svc-* references

**Files:**
- Modify: `tools/service-boundary-check.ts` (remove 5 KNOWN_VIOLATIONS entries; trim banner)
- Modify: `tools/authz-bypass-check.ts` (collapse INSTANCE_SERVICES, drop MIGRATED_AREAS)
- Modify: `tools/security-bypass-check.ts` (remove svc-* paths from PUBLIC_ALLOWLIST, eval allowlist, spawn allowlist)
- Modify: `tools/audit-bypass-check.ts` (only if svc-* paths exist)

- [ ] **Step 1: Update `tools/service-boundary-check.ts`**

Remove all 5 thin-adapter KNOWN_VIOLATIONS entries (svc-workflow, svc-view-engine, svc-notify, svc-instance-api, svc-insights). The corresponding apps/svc-* paths no longer exist, so leaving the allowlist entries would be dead code, and the scanner's `ENTITY_OWNERSHIP` rule still works because it keys on logical service names (`svc-automation`) which are decoupled from directory layout.

The scanner's `SERVICE_DIR_RE = /^svc-[a-z0-9-]+$/` and `getOwningService()` logic still runs against `apps/svc-migrations` (the surviving service) and `apps/api` / `apps/control-plane` (via the unified-app path translation).

- [ ] **Step 2: Update `tools/authz-bypass-check.ts`**

The `INSTANCE_SERVICES` list at lines 25-37 currently has 11 svc-* names. After cutover, only `apps/api`, `apps/control-plane`, and `apps/worker` (no controllers, but tracked for completeness) need scanning. Replace `INSTANCE_SERVICES` with the new monolith roots. Remove `MIGRATED_AREAS` (now empty — there are no legacy svc-* areas left).

The `getServiceContexts()` function that constructed per-area roots for migrated services needs to be simplified — it now returns a single context per monolith app.

- [ ] **Step 3: Update `tools/security-bypass-check.ts`**

`PUBLIC_ALLOWLIST` contains entries for `apps/svc-*/src/app/health.controller.ts` and `apps/svc-*/src/app/.../auth.controller.ts`. Remove all entries whose path starts with `apps/svc-` EXCEPT those under `apps/svc-migrations/`. The `apps/api/...` and `apps/control-plane/...` equivalents already exist and stay.

Same removal for `eval` allowlist and `spawn` allowlist.

- [ ] **Step 4: Update `tools/audit-bypass-check.ts`**

Inspect for svc-* references. The scanner is content-driven (looks for save-then-audit patterns outside transactions) and likely has no path-specific allowlists. If KNOWN_DEFERRED_OFFENDERS contains svc-* entries, path-translate them.

- [ ] **Step 5: Update selftest fixture paths if needed**

`tools/authz-bypass-check-selftest.ts` Test 4 plants a bypass in `apps/svc-workflow/src/app/__selftest_fixture__/`. After Task 1, that directory is gone. Test 4 should be retargeted to a directory that does exist (e.g., `apps/api/src/app/automation/workflow/__selftest_fixture__/`) OR removed if Test 2 and Test 3 (svc-insights and svc-ava bypasses, both already at apps/api paths) cover the equivalent coverage.

The selftest also has Test 6 (svc-control-plane carve-out) that plants a bypass at `apps/svc-control-plane/src/app/__selftest_fixture__/`. After Task 1, the path becomes `apps/control-plane/src/app/__selftest_fixture__/`. The intent (canon §18 carve-out of the multi-tenant control plane from authz scanning) survives — `apps/control-plane/` should not be scanned for the same reason.

- [ ] **Step 6: Run scanners + selftests**

```bash
npm run authz:check
npm run audit:check
npm run security:check
npm run service-boundary:check
npm run dead-code:check
npm run deps:check
npx ts-node tools/authz-bypass-check-selftest.ts
npx ts-node tools/service-boundary-check-selftest.ts
npx ts-node tools/security-bypass-check-selftest.ts
npx ts-node tools/dead-code-check-selftest.ts
```

Expected: all green; selftest assertions pass.

- [ ] **Step 7: Commit**

```bash
git commit -m "chore(scanners): drop svc-* references after W1 final cutover

Removes thin-adapter KNOWN_VIOLATIONS, MIGRATED_AREAS, and PUBLIC_ALLOWLIST
entries pointing at deleted svc-* paths. Scanners now reason about
apps/api + apps/control-plane as the canonical instance/control monoliths.

Selftest fixture paths retargeted: Test 4 (workflow bypass) moved to
apps/api/src/app/automation/workflow/. Test 6 (control-plane carve-out)
moved to apps/control-plane/src/app/."
```

---

## Task 3: Update CI/CD, helm, and package.json

**Files:**
- Modify: `.github/workflows/cd.yml` (matrix at lines 88-95, rollout checks at lines 251-254)
- Modify: `.github/workflows/release.yml` (matrix at lines 115-119)
- Modify: `infrastructure/helm/instance-services/values.yaml` (collapse services list)
- Modify: `package.json` (`dev:*` scripts)

- [ ] **Step 1: Update `.github/workflows/cd.yml`**

Replace the build-images matrix:

```yaml
strategy:
  matrix:
    service:
      - api
      - control-plane
      - web-client
      - web-control-plane
      - svc-migrations
```

Replace the rollout-status checks (lines 251-254):

```yaml
kubectl rollout status deployment/api -n hubblewave-system --timeout=300s
kubectl rollout status deployment/control-plane -n hubblewave-control-plane --timeout=300s
kubectl rollout status deployment/web-client -n hubblewave-system --timeout=300s
```

- [ ] **Step 2: Update `.github/workflows/release.yml`** similarly.

- [ ] **Step 3: Update `infrastructure/helm/instance-services/values.yaml`**

Collapse `services:` to a single entry:

```yaml
services:
  - name: api
    image: api
    port: 3000
```

(Preserve any tenant-tier / replica / resource configuration that was on the existing entries; collapse them onto the single `api` entry.)

- [ ] **Step 4: Update `package.json` scripts**

Remove:
- `dev:identity`
- `dev:metadata`
- `dev:data`
- `dev:ava`
- `dev:view-engine`

Update `dev:all`:

```json
"dev:all": "nx run-many --target=serve --projects=api,worker,web-client,web-control-plane"
```

Keep: `dev:api`, `dev:worker`, `dev:web`, `dev:platform`, `migrate:run:instance:job`.

- [ ] **Step 5: Verify Dockerfiles exist for build matrix targets**

```bash
ls apps/api/Dockerfile apps/control-plane/Dockerfile apps/web-client/Dockerfile apps/web-control-plane/Dockerfile apps/svc-migrations/Dockerfile 2>&1
```

If any Dockerfile is missing, create it via a sub-task (model it on the now-deleted svc-* Dockerfiles before removal — they had a stable structure).

- [ ] **Step 6: Run builds for the new CI matrix targets**

```bash
npx nx run-many --target=build --projects=api,control-plane,web-client,web-control-plane,svc-migrations --parallel=2
```

Expected: all builds succeed.

- [ ] **Step 7: Commit**

```bash
git commit -m "chore(ci-helm): point CI/CD + helm at apps/api + apps/control-plane after W1 cutover

- cd.yml build matrix now: api, control-plane, web-client, web-control-plane, svc-migrations
- cd.yml rollout-status checks now target deployment/api + deployment/control-plane
- release.yml matrix updated to mirror cd.yml
- helm instance-services chart collapsed to a single 'api' deployment
- package.json: dropped dev:identity/metadata/data/ava/view-engine scripts;
  dev:all now runs api+worker+web-client+web-control-plane"
```

---

## Task 4: Update docs to mark Phase 1 ✅

**Files:**
- Modify: `docs/superpowers/PLATFORM-ROADMAP.md`
- Modify: `docs/superpowers/RESUME-CONTEXT.md`

- [ ] **Step 1: Mark Phase 1 complete in PLATFORM-ROADMAP.md**

Update the Phase 1 section: change all 11 service status indicators to ✅, add a "PHASE 1 COMPLETE" header and date (2026-05-10), append a "Phase 2 Open" section listing W2/W3 remediation waves as the immediate next focus (or whatever is canonical per the project's planning hierarchy).

- [ ] **Step 2: Update RESUME-CONTEXT.md to reflect new state**

Change the "where we are" pickup section to:
- Phase 0: ✅ (W0 + W1 security cherry-picks)
- Phase 1: ✅ (11/11 instance/control services migrated; thin adapters deleted; CI/helm trimmed)
- Phase 2: open (next focus is W2 remediation wave per master-remediation-roadmap)

Update the "Active branch" section.
Update the "Latest tag" reference.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs(roadmap): mark Phase 1 ✅; W1 final cutover complete

All 11 instance/control-plane services migrated into apps/api +
apps/control-plane. Thin adapters deleted. CI/helm/package.json
trimmed. Phase 2 (W2 remediation wave) now open."
```

---

## Task 5: Verification gate

- [ ] **Step 1: Scanners + selftests pass**

```bash
npm run authz:check
npm run audit:check
npm run security:check
npm run service-boundary:check
npm run dead-code:check
npm run deps:check
npx ts-node tools/authz-bypass-check-selftest.ts
npx ts-node tools/service-boundary-check-selftest.ts
npx ts-node tools/security-bypass-check-selftest.ts
npx ts-node tools/dead-code-check-selftest.ts
```

Expected: all green.

- [ ] **Step 2: Production builds green**

```bash
npx nx run-many --target=build --projects=api,control-plane,worker,web-client,web-control-plane,svc-migrations --parallel=2
```

Expected: all 6 builds succeed.

- [ ] **Step 3: Tests green**

```bash
npx nx test api
```

Expected: same suite count as before cutover (34 suites / 457 pass / 2 skipped).

- [ ] **Step 4: Verify svc-* directories gone**

```bash
ls apps/ | grep '^svc-'
```

Expected: only `svc-migrations` remains.

- [ ] **Step 5: Tag `arc-w1-complete`**

```bash
git tag arc-w1-complete HEAD
```

- [ ] **Step 6: Append completion note to plan**

- [ ] **Step 7: Commit completion note + push tag with branch**

---

## Self-review

**1. Spec coverage:** All 11 services in inventory accounted for. CI/helm/package.json updates correspond to the directory deletions. Docs updates close Phase 1.

**2. Placeholder scan:** Each task has explicit deletion lists, file paths, and exact commands. No "TBD" markers.

**3. Type consistency:** No TypeScript type changes in this PR (cleanup-only).

**4. Scope check:** Single coherent change (delete adapters, update references). ~half-day. 5 substantive tasks.

**5. Dependency graph correctness:** Task 1 must precede Task 2 (scanners reference svc-* paths). Task 2 must precede Task 3 (CI runs scanners). Task 4 can run in parallel with Task 3 but for clarity is sequential. Task 5 is final gate.

**6. svc-migrations:** Explicitly preserved in every step. It is NOT a thin adapter.

**7. svc-ai in cd.yml/release.yml:** Was never a real service (predates W0 inventory). Removed by virtue of replacing the matrix entirely with the new list.

No issues found.

---

**End of W1 final cutover plan.**
