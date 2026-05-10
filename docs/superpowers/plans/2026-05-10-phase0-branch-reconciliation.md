# Phase 0 — Branch Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cherry-pick 27 W0+W1 security/correctness commits from `claude/condescending-shamir-92422b` into `claude/amazing-yalow-0f9c37`, applying path translation where files moved during the architectural migration (svc-identity → apps/api/identity, svc-metadata → apps/api/metadata, svc-data → apps/api/data). Tag the result `arc-reconciled-with-w1-security`.

**Architecture:** Of the 27 commits, 21 cherry-pick CLEAN (paths unchanged on our branch — libs/, tools/ scanners we haven't modified, .github/, web-client, svc-* services that haven't migrated, plus all-new files). 3 require PATH-TRANSLATION (touch files now in apps/api/{identity,metadata,data}/). 2 modify CLAUDE.md (additive amendment-log + §21 status — manual merge). 1 modifies eslint.config.mjs + package.json (additive). The clean ones go first; the merge-needed ones are paired with explicit conflict-resolution notes.

**Tech Stack:** Git (cherry-pick), nx, Jest. No new tools introduced by reconciliation.

**Spec reference:** [PLATFORM-ROADMAP.md](../PLATFORM-ROADMAP.md) Phase 0 (recommended next move after `arc-w1-metadata-complete`).

**Predecessor work:**
- W0+W1 audit remediation lives at `claude/condescending-shamir-92422b` (27 commits, ~6,500 LoC additions / ~50 LoC deletions across 5 new scanners + custom ESLint rule + 7 new security primitives + 8 new spec files / 148 W1-specific assertions + CI/CD config)
- Architectural migration progressed independently on `claude/amazing-yalow-0f9c37`: identity → metadata → data complete. apps/api now hosts ~38,400 + ~17,700 = ~56,100 LoC reshaped into the modular monolith.

**Solo founder, ~3–5 days of focused work.** ~10 substantive tasks (mostly cherry-pick batches) + 1 verification gate.

---

## Commit inventory + classification

The 27 commits in topological order (oldest → newest), with classification.

### Group A — Clean cherry-picks (21 commits, no conflicts expected)

These touch paths unchanged on our branch (libs/, tools/ scanner files we haven't modified since master, .github/, web-client/, web-control-plane/, svc-* services that haven't migrated, plus all-new files):

| # | SHA | Subject |
|---|---|---|
| 1 | `4fa9d53` | docs(plan-fixes): master remediation roadmap + W0 plan + baseline (W0 task 1) |
| 2 | `a2ee9dc` | fix(tools): replace glob dep with native fs walk in terminology-scanner (F151, W0 task 1.5) |
| 3 | `4b3377e` | fix(ci): CD requires CI success via workflow_run trigger (F106, W0 task 7) |
| 4 | `fc4c440` | feat(ci): add gitleaks secret-scanning to CI (F119 partial, W0 task 8) |
| 5 | `b676344` | docs(plan-fixes): runbook for required-status-check configuration (W0 task 11) |
| 6 | `85240ed` | feat(tools): scanner self-test framework + CI gate (W0 task 2) |
| 7 | `e4aeb71` | feat(ci): SBOM generation + license audit (F119, W0 task 9) |
| 8 | `e4cee2b` | fix(security): reconcile PUBLIC_ALLOWLIST + cross-platform path bug + selftest (F105, W0 task 3) |
| 9 | `5204617` | fix(authz): scan all 11 instance services + selftest (F018, W0 task 4) |
| 10 | `def8b15` | feat(service-boundary): detect entity-write bypasses (F056, W0 task 5) |
| 11 | `8c11160` | feat(tools): dead-code-check anti-resurrection scanner (§D.6, W0 task 10) |
| 12 | `32cac31` | fix(secrets): redact PACK_SIGNING_PRIVATE_KEY + install-token (F111, W1 task 1) + W1 plan |
| 13 | `c542a19` | fix(svc-migrations): require explicit DB credentials (F053, W1 task 3) |
| 14 | `c6dc9d1` | fix(analytics): remove dataSource.type='query' raw-SQL path (F124, W1 task 5) |
| 15 | `ac972f3` | fix(svc-notify): remove triple-brace raw-HTML escape (F127, W1 task 7) |
| 16 | `abf4f2e` | fix(automation): SafeExpressionEvaluator wraps expr-eval (F027, W1 task 8) |
| 17 | `f2438a4` | chore(security): allowlist safe-expression-evaluator.spec.ts eval() literals (W1 task 8 follow-up) |
| 18 | `e41a59c` | fix(ai): vector search requires principal + accepts authzCheck filter (F073, W1 task 9) |
| 19 | `c11a5be` | fix(control-plane): in-memory access token + HttpOnly refresh cookie (F089, W1 task 10) |
| 20 | `2a24936` | fix(web-client): shared sanitizeHtml helper (F093, W1 task 11) |
| 21 | `9cd0936` | fix(sso): SAML signature affirmation + email_verified + XML escape (F139 + F141, W1 tasks 12-13) |

**Verification:** None of these touch files in `apps/api/src/app/{identity,metadata,data}/` (the post-migration paths). The tools/ scanner files (`security-bypass-check.ts`, `authz-bypass-check.ts`, `service-boundary-check.ts`) are unchanged on our branch since the merge-base `96c92c2`. `eslint.config.mjs` is unchanged. The only `package.json` change on our branch is `d3dede3` (add `dev:api`/`dev:worker`/`dev:platform` scripts) — additive, separate from the W0 commits' `npm run` registrations for scanners.

### Group B — Path-translation required (3 commits)

Touch files that moved during identity, metadata, or data migration. Each requires inspecting the change at the OLD path, locating the file at its NEW path, and applying the same edit there.

| # | SHA | Subject | Old path | New path |
|---|---|---|---|---|
| B1 | `a05e26a` | fix(ldap): RFC 4515 escape for username interpolation (F011, W1 task 4) | `apps/svc-identity/src/app/ldap/` | `apps/api/src/app/identity/ldap/` |
| B2 | `4d09db1` | fix(svc-metadata): SSRF guard on pack artifact download (F125 + F126, W1 task 6) | `apps/svc-metadata/src/app/packs/` | `apps/api/src/app/metadata/packs/` |
| B3 | `bdbe876` | feat(lint): canon §21 ESLint enforcement (F104, W0 task 6) | mixed | mixed (see B3 detail below) |

**B1 — `a05e26a` LDAP filter escape**

Three files in this commit:
- `apps/svc-identity/src/app/ldap/ldap-filter-escape.spec.ts` (NEW file — 58 lines)
- `apps/svc-identity/src/app/ldap/ldap-filter-escape.ts` (NEW file — 34 lines)
- `apps/svc-identity/src/app/ldap/ldap.service.ts` (MODIFIED — 16 lines changed)

All three relocate to `apps/api/src/app/identity/ldap/` post-migration. Cherry-picking with `git cherry-pick` would FAIL because the old paths don't exist. Approach: extract the diff, rewrite paths, apply at new locations.

**B2 — `4d09db1` Pack SSRF guard**

Two files:
- `apps/svc-metadata/src/app/packs/packs.service.spec.ts` (NEW file — 90 lines)
- `apps/svc-metadata/src/app/packs/packs.service.ts` (MODIFIED — 30 lines changed)

Both relocate to `apps/api/src/app/metadata/packs/`.

**B3 — `bdbe876` ESLint enforcement**

13 files. **Mixed clean + migrated:**

Clean (apply normally):
- `apps/svc-automation/src/app/runtime/script-sandbox.service.spec.ts` (svc-automation NOT migrated — path unchanged)
- `apps/web-client/src/features/admin/properties/PropertiesPage.tsx` (unchanged)
- `eslint.config.mjs` (unchanged on our branch — 127 line additions)
- `package.json` (unchanged section — selftest:eslint-rules registration)
- `tools/dead-code-check.ts` (NEW file from `8c11160`, applied earlier in this plan)
- `tools/eslint-rules/index.js`, `no-versioned-identifier.cjs`, `no-versioned-identifier.spec.cjs`, `tsconfig.json` (NEW files)
- `tools/security-bypass-check.ts` (2-line `no-useless-escape` fix; unchanged on our branch — should apply cleanly)

Migrated (apply at new path):
- `apps/svc-data/src/app/integration/connector-credentials.service.ts` (line 54: rename `error` → `_error`) → `apps/api/src/app/data/integration/connector-credentials.service.ts`
- `apps/svc-data/src/app/integration/oauth2.service.ts` (line 379: rename `error` → `_error`) → `apps/api/src/app/data/integration/oauth2.service.ts`
- `apps/svc-data/src/app/computed/computed-property-dispatcher.service.ts` (line 87: `prefer-const` fix) → `apps/api/src/app/data/computed/computed-property-dispatcher.service.ts`

### Group C — CLAUDE.md additive merges (2 commits)

| # | SHA | Subject |
|---|---|---|
| C1 | `c4f3d73` | docs(canon): W0 acceptance + §21 enforcement-status amendment (W0 task 12) |
| C2 | `99b3d18` | docs(canon): W1 acceptance + amendment-log entry (W1 tasks 14-16) |

Our branch already has 6 amendments on CLAUDE.md (specifically commit `9f17262` modified §21 with `UPDATE topology + TRIM scanner list for monolith`). The security branch's c4f3d73 modifies §21 differently (`Replaces W6.A status block with W0 reality. Lists every scanner with its W0 task reference and current allowlist state.`). **These are different intents touching the same section** — manual merge needed.

The other change in c4f3d73 is `docs/plan-fixes/W00-acceptance.md` (new file) and an entry in the §24 amendment log — those are clean adds.

99b3d18 adds `docs/plan-fixes/W01-acceptance.md` (new file) plus another amendment-log entry — clean additive.

### Group D — Web-client + eslint-config additive merge (1 commit)

| # | SHA | Subject |
|---|---|---|
| D1 | `4ccae79` | fix(web-client): always-call hooks in ProtectedRoute + PermissionGate; add react-hooks gate (F088, W1 task 2) |

Touches `apps/web-client/src/auth/PermissionGate.tsx`, `apps/web-client/src/routing/ProtectedRoute.tsx`, `eslint.config.mjs`, `package.json`, `tools/approved-deps.json`. The web-client and tools/ paths are unchanged. eslint.config.mjs and package.json may need additive merge since `bdbe876` (Group B3) also modified them.

**Sequencing:** Do `4ccae79` BEFORE `bdbe876`. Both modify eslint.config.mjs but at different sections (D1 adds react-hooks plugin + rule; B3 adds canon §21 rules). Sequential apply should work.

---

## Migration order (concrete)

Follow the topological order of the security branch, but group by classification for efficient batched cherry-picks. The order respects in-branch dependencies (e.g., `bdbe876` references `tools/dead-code-check.ts` which `8c11160` introduces).

1. **Phase 0.A: Clean W0 batch (10 commits, oldest first).** Group A items 1–11 except 12 which is W1.
2. **Phase 0.B: CLAUDE.md merge for W0 (1 commit).** Group C item C1 (`c4f3d73`).
3. **Phase 0.C: Clean W1 batch — pre-bdbe876.** None — bdbe876 is part of W0; the order is W0 → W0 acceptance → W1.
4. **Phase 0.D: Clean W1 batch — Group A items 12–21 (10 commits).**
5. **Phase 0.E: Web-client + eslint additive merge (1 commit).** Group D item D1 (`4ccae79`).
6. **Phase 0.F: Path-translation B1 — LDAP (1 commit, 3-file rewrite).**
7. **Phase 0.G: Path-translation B2 — Packs SSRF (1 commit, 2-file rewrite).**
8. **Phase 0.H: Path-translation B3 — ESLint enforcement (1 commit, 9 clean + 3 path-translated files).**
9. **Phase 0.I: CLAUDE.md merge for W1 (1 commit).** Group C item C2 (`99b3d18`).
10. **Phase 0.J: Verification gate + tag.**

That's 9 implementation tasks + 1 verification = 10 substantive task slots.

### Pre-flight checks per task

Every task MUST verify:

1. **Working directory** — pwd + branch + expected HEAD (the previous task's commit)
2. **No forbidden files modified outside the cherry-pick scope** — exclude package.json, .vscode, .gitignore, tsconfig.base.json, tools/ outside the cherry-pick's intent
3. **Clean repo state before starting** — `git status` should be clean before each cherry-pick
4. **Authorized recovery path** — if `git cherry-pick` fails irrecoverably, may run `git cherry-pick --abort` and report BLOCKED. Last-resort: `git reset --hard <previous-commit>`.

---

## Files Created/Modified Overview

### Plan-end state

After all 10 tasks land:

- `tools/` gains 8 new scanner-related files (license validator, scanner self-test framework, dead-code-check + allowlist + selftest, eslint-rules directory)
- `tools/security-bypass-check.ts`, `authz-bypass-check.ts`, `service-boundary-check.ts` gain selftest companion files + scope expansions
- `.github/workflows/{ci,cd}.yml` gain gitleaks, SBOM generation, license audit, scanner self-test, workflow_run gating
- `.gitleaks.toml` (new)
- `eslint.config.mjs` gains canon §21 rules + react-hooks plugin
- `tools/eslint-rules/no-versioned-identifier.cjs` (new custom ESLint rule)
- `apps/api/src/app/identity/ldap/` gains `ldap-filter-escape.ts` + `ldap-filter-escape.spec.ts` and ldap.service.ts is fixed for RFC 4515 escape
- `apps/api/src/app/metadata/packs/packs.service.ts` gains SSRF guard + spec
- `apps/api/src/app/data/{integration,computed}/` get small lint fixes (rename `error` → `_error`, `prefer-const`)
- `libs/automation/src/lib/safe-expression-evaluator.ts` (new — SafeExpressionEvaluator)
- `libs/analytics/src/lib/reporting.service.ts` — raw-SQL branch removed
- `libs/ai/src/lib/{ava,rag,vector-store}.service.ts` — vector search authz
- `libs/enterprise/src/lib/saml-assertion-gate.ts` (new — SAML signature affirmation)
- `apps/svc-control-plane/src/app/auth/auth.controller.ts` + main.ts — in-memory token + HttpOnly cookie
- `apps/svc-notify/.../template-engine.service.ts` — XSS fix
- `apps/svc-migrations/src/main.ts` — explicit DB credentials
- `apps/svc-ava/src/app/{chat,embedding}.controller.ts` — vector authz wiring (will need ANOTHER path translation when svc-ava migrates later)
- `apps/web-client/src/{auth,routing,lib,components,features}/...` — sanitizeHtml + PermissionGate fixes
- `apps/web-control-plane/src/app/...` — auth client fixes
- `CLAUDE.md` — §21 status block updated with W0 reality, two new amendment-log entries
- `SECRETS_ROTATION.md` — PEM key + install-token redacted
- `docs/plan-fixes/` — master remediation roadmap, W00-foundation, W00-baseline, W00-acceptance, W00-required-status-checks, W01-stop-the-bleeding, W01-acceptance (7 new docs)
- New tag: `arc-reconciled-with-w1-security`

---

## Task 1: Phase 0.A — Cherry-pick W0 clean batch (11 commits)

**Files (cherry-pick range):**
- 11 commits applied as-is via `git cherry-pick`
- Commits: `4fa9d53 a2ee9dc 4b3377e fc4c440 b676344 85240ed e4aeb71 e4cee2b 5204617 def8b15 8c11160`

**Why this matters:** Establishes W0 foundation — scanner self-test framework, SBOM/license audit, dead-code anti-resurrection, gitleaks, expanded authz/security/service-boundary scanners, plus the master remediation roadmap doc. None of these touch migrated files. They land cleanly first because they have no conflicts and they're prerequisites for `bdbe876` (which references `tools/dead-code-check.ts` introduced by `8c11160`).

- [ ] **Step 1: Verify working directory + state**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && pwd && git rev-parse --abbrev-ref HEAD && git log --oneline -1 && git status --short
```

Expected: HEAD `a27d5ef` (post-data-migration cleanup commit). Branch `claude/amazing-yalow-0f9c37`. `git status` clean. STOP and report BLOCKED if any differs.

- [ ] **Step 2: Cherry-pick the 11 W0 commits in topological order**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git cherry-pick 4fa9d53 a2ee9dc 4b3377e fc4c440 b676344 85240ed e4aeb71 e4cee2b 5204617 def8b15 8c11160 2>&1 | tail -30
```

If any commit produces a conflict, `git cherry-pick --abort` and report which commit failed. The expectation is ZERO conflicts since all 11 paths are unmodified on our branch.

- [ ] **Step 3: Verify clean state and 11 new commits**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git status --short && git log --oneline a27d5ef..HEAD | wc -l
```

Expected: status clean, 11 new commits.

- [ ] **Step 4: Run scanner self-tests + new scanners**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npm run selftest:scanners 2>&1 | tail -20
```

If `selftest:scanners` is the new combined npm script, all sub-scanner self-tests must pass. If it doesn't exist as a single entry-point, run individually: `selftest:authz-bypass-check`, `selftest:security-bypass-check`, `selftest:service-boundary-check`, `selftest:dead-code-check`.

- [ ] **Step 5: Build api + svc-data to confirm nothing broke**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npx nx build api 2>&1 | tail -5 && npx nx build svc-data 2>&1 | tail -5
```

Both must succeed.

- [ ] **Step 6: Record HEAD SHA for next task**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git rev-parse HEAD
```

This SHA is the expected HEAD for Task 2.

---

## Task 2: Phase 0.B — Cherry-pick W0 acceptance docs (c4f3d73, with CLAUDE.md merge)

**Files:**
- Cherry-pick `c4f3d73` (CLAUDE.md + docs/plan-fixes/W00-acceptance.md)
- CLAUDE.md will conflict in §21 because our branch's `9f17262` already modified that section with monolith-era topology updates.

**Why this matters:** W0 closure documentation. The amendment-log entries are valuable history. The §21 conflict needs human-judgment resolution: the security branch's intent was "list every scanner with its W0 task reference and current allowlist state"; our branch's intent was "TRIM scanner list for monolith." Both intents need to coexist.

- [ ] **Step 1: Verify HEAD matches Task 1's recorded SHA**

- [ ] **Step 2: Attempt clean cherry-pick first**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git cherry-pick c4f3d73 2>&1 | tail -20
```

Expected outcome: CONFLICT in CLAUDE.md (§21 section). The new docs/plan-fixes/W00-acceptance.md will apply cleanly.

- [ ] **Step 3: Inspect the conflict**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git diff CLAUDE.md
```

Look for `<<<<<<<` markers in §21 (around line 420 per the security branch's diff). The conflict markers will show:
- `<<<<<<< HEAD`: our branch's §21 (monolith topology, TRIM scanner list, W6.A status block from earlier)
- `=======`: separator
- `>>>>>>> c4f3d7353e87…`: security branch's replacement (W0 reality scanner list)

- [ ] **Step 4: Manually resolve the §21 conflict**

The merge intent: keep our branch's monolith-aware structure AND incorporate the security branch's scanner-by-scanner enumeration. Specifically:

1. Keep our branch's §21 section structure (the TRIM-for-monolith framing).
2. INSIDE that structure, REPLACE the older W6.A status block with the W0 reality block from the security branch's diff (the one that lists each scanner with its W0 task reference and current allowlist state).
3. Keep our branch's amendment-log entries in §24.
4. APPEND the security branch's new §24 amendment-log entry below ours (chronological order — the security branch's entry is dated 2026-05-09 W0).

If the conflict is genuinely unresolvable in <15 minutes of inspection, STOP and report BLOCKED with the diff content; the human will resolve manually.

Use the Edit tool to apply the resolution. After editing, verify:

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && grep -c "^<<<<<<<\|^=======\|^>>>>>>>" CLAUDE.md
```

Should return `0` (no conflict markers remain).

- [ ] **Step 5: Add the resolved file + the new W00-acceptance.md and complete the cherry-pick**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git add CLAUDE.md docs/plan-fixes/W00-acceptance.md && git cherry-pick --continue
```

If the editor opens, accept the existing commit message (the security branch's original commit message is fine — it documents W0 acceptance accurately).

- [ ] **Step 6: Record HEAD SHA**

---

## Task 3: Phase 0.C — Cherry-pick W1 clean batch (10 commits)

**Files (cherry-pick range):**
- Commits: `32cac31 c542a19 c6dc9d1 ac972f3 abf4f2e f2438a4 e41a59c c11a5be 2a24936 9cd0936`

**Why this matters:** All 14 W1 critical-security findings except F011, F088, F104, F125+F126 (which need path translation or eslint merge). These hit libs/, svc-control-plane, svc-notify, svc-migrations, svc-ava, web-client, web-control-plane — all paths unchanged on our branch.

Note: `4ccae79` (F088, web-client + eslint) is intentionally deferred to Task 4. `a05e26a` (F011, LDAP) and `4d09db1` (F125+F126, packs) are deferred to Tasks 5–6 (path-translation). `bdbe876` (F104, ESLint enforcement) is deferred to Task 7.

- [ ] **Step 1: Verify HEAD matches Task 2's recorded SHA**

- [ ] **Step 2: Cherry-pick the 10 W1 commits**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git cherry-pick 32cac31 c542a19 c6dc9d1 ac972f3 abf4f2e f2438a4 e41a59c c11a5be 2a24936 9cd0936 2>&1 | tail -30
```

Expected: ZERO conflicts. Each path is unmodified on our branch.

If a conflict appears (it shouldn't), `git cherry-pick --abort` and report which commit failed.

- [ ] **Step 3: Verify clean state**

- [ ] **Step 4: Build affected apps to confirm**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npx nx build api 2>&1 | tail -3 && npx nx build svc-control-plane 2>&1 | tail -3 && npx nx build svc-notify 2>&1 | tail -3 && npx nx build svc-ava 2>&1 | tail -3
```

All four must succeed.

- [ ] **Step 5: Run scanner suite to confirm no regression**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npm run authz:check && npm run audit:check && npm run security:check 2>&1 | tail -10
```

- [ ] **Step 6: Record HEAD SHA**

---

## Task 4: Phase 0.D — Cherry-pick web-client + eslint react-hooks (4ccae79)

**Files:**
- Cherry-pick `4ccae79`. Touches `apps/web-client/src/auth/PermissionGate.tsx`, `apps/web-client/src/routing/ProtectedRoute.tsx`, `eslint.config.mjs`, `package.json`, `tools/approved-deps.json`.

**Why this matters:** F088 React Rules-of-Hooks fix + the lint gate that prevents reintroduction. The eslint.config.mjs and package.json portions are additive (different rule namespaces). Web-client paths are unchanged.

- [ ] **Step 1: Verify HEAD matches Task 3's recorded SHA**

- [ ] **Step 2: Cherry-pick**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git cherry-pick 4ccae79 2>&1 | tail -20
```

Expected: ZERO conflicts. eslint.config.mjs unchanged on our branch. package.json had only the `dev:api` etc. scripts added on our branch (different lines). approved-deps.json may not exist yet — if it doesn't, the cherry-pick creates it.

If conflict appears in package.json, manually merge the additive lines (both branches add scripts to different sections; preserve both).

- [ ] **Step 3: Verify clean state**

- [ ] **Step 4: Build web-client**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npx nx build web-client 2>&1 | tail -5
```

Must succeed.

- [ ] **Step 5: Lint web-client to confirm react-hooks rule active**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npx nx lint web-client 2>&1 | tail -10
```

Pre-existing lint errors are tolerated; no NEW errors from this commit.

- [ ] **Step 6: Record HEAD SHA**

---

## Task 5: Phase 0.E — Path-translation B1: LDAP filter escape (a05e26a)

**Files:**
- Source paths in commit: `apps/svc-identity/src/app/ldap/{ldap-filter-escape.ts, ldap-filter-escape.spec.ts, ldap.service.ts}`
- Target paths on our branch: `apps/api/src/app/identity/ldap/{ldap-filter-escape.ts, ldap-filter-escape.spec.ts, ldap.service.ts}`

**Why this matters:** F011 LDAP filter injection — RFC 4515 escape required for LDAP credential injection prevention. The fix lives at the new apps/api path post-identity-migration.

**Approach:** `git cherry-pick a05e26a` will FAIL because `apps/svc-identity/src/app/ldap/` was deleted during the identity migration. Instead, use `git format-patch` + `git apply` with sed-rewritten paths.

- [ ] **Step 1: Verify HEAD matches Task 4's recorded SHA**

- [ ] **Step 2: Verify target directory exists**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && ls apps/api/src/app/identity/ldap/
```

Expected: `ldap.module.ts`, `ldap.service.ts` (and other ldap files from identity migration). If `apps/api/src/app/identity/ldap/` doesn't exist, identity migration is incomplete; STOP and report BLOCKED.

- [ ] **Step 3: Generate the patch + rewrite paths**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git format-patch -1 a05e26a --stdout | sed 's|apps/svc-identity/src/app/ldap/|apps/api/src/app/identity/ldap/|g' > /tmp/a05e26a-translated.patch && head -20 /tmp/a05e26a-translated.patch
```

Verify `head` output shows the rewritten paths.

- [ ] **Step 4: Apply the patch**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git apply --check /tmp/a05e26a-translated.patch 2>&1
```

If `--check` passes, apply for real:

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git apply /tmp/a05e26a-translated.patch
```

If `--check` fails (likely cause: `ldap.service.ts` evolved on our branch in ways that conflict with the security branch's edits), STOP and report BLOCKED with the apply-check error output. Manual three-way merge would be needed.

- [ ] **Step 5: Verify the new files + modified file**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && ls apps/api/src/app/identity/ldap/ && grep -n "ldap-filter-escape" apps/api/src/app/identity/ldap/ldap.service.ts
```

Expected: `ldap-filter-escape.ts` and `ldap-filter-escape.spec.ts` are NEW files; `ldap.service.ts` imports `escapeLdapFilter` from it.

- [ ] **Step 6: Build identity + run identity tests**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npx nx build api 2>&1 | tail -3 && npx nx build svc-identity 2>&1 | tail -3
```

Both must succeed.

- [ ] **Step 7: Stage + commit with adjusted message**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git add apps/api/src/app/identity/ldap/ && git commit -m "$(cat <<'EOF'
fix(ldap): RFC 4515 escape for username interpolation (F011, W1 task 4)

Cherry-picked from claude/condescending-shamir-92422b commit a05e26a with
path-translation: source was apps/svc-identity/src/app/ldap/, target is
apps/api/src/app/identity/ldap/ post-arc-w1-identity-complete migration.

RFC 4515 escape for username interpolation prevents LDAP filter
injection. New ldap-filter-escape.ts module + 58-line spec; ldap.service.ts
calls escapeLdapFilter() at the search-base interpolation site.

Original-commit: a05e26a
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Record HEAD SHA**

---

## Task 6: Phase 0.F — Path-translation B2: Pack SSRF guard (4d09db1)

**Files:**
- Source paths: `apps/svc-metadata/src/app/packs/{packs.service.spec.ts, packs.service.ts}`
- Target paths: `apps/api/src/app/metadata/packs/{packs.service.spec.ts, packs.service.ts}`

**Why this matters:** F125+F126 — pack artifact download SSRF guard. The `validateOutboundUrl()` helper prevents pack-install endpoints from being weaponized to scan internal network. Plus pack install controller `@Public()` reconciliation (`PackInstallGuard` handles auth instead).

- [ ] **Step 1: Verify HEAD matches Task 5's recorded SHA**

- [ ] **Step 2: Verify target directory**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && ls apps/api/src/app/metadata/packs/
```

Expected: `packs.module.ts`, `packs.service.ts`, etc. (from metadata migration).

- [ ] **Step 3: Generate translated patch**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git format-patch -1 4d09db1 --stdout | sed 's|apps/svc-metadata/src/app/packs/|apps/api/src/app/metadata/packs/|g' > /tmp/4d09db1-translated.patch
```

- [ ] **Step 4: Apply with check**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git apply --check /tmp/4d09db1-translated.patch 2>&1 && git apply /tmp/4d09db1-translated.patch
```

If `--check` fails, STOP and report BLOCKED.

- [ ] **Step 5: Build api + svc-metadata**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npx nx build api 2>&1 | tail -3 && npx nx build svc-metadata 2>&1 | tail -3
```

- [ ] **Step 6: Stage + commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git add apps/api/src/app/metadata/packs/ && git commit -m "$(cat <<'EOF'
fix(metadata): SSRF guard on pack artifact download (F125 + F126, W1 task 6)

Cherry-picked from claude/condescending-shamir-92422b commit 4d09db1 with
path-translation: source was apps/svc-metadata/src/app/packs/, target is
apps/api/src/app/metadata/packs/ post-arc-w1-metadata-complete migration.

Adds validateOutboundUrl() guard on pack artifact download to prevent
SSRF (F125). Reconciles pack install controller @Public() since
PackInstallGuard handles auth (F126).

Original-commit: 4d09db1
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Record HEAD SHA**

---

## Task 7: Phase 0.G — Path-translation B3: ESLint enforcement (bdbe876)

**Files:**
- Mixed: clean files for eslint.config.mjs, tools/, web-client, svc-automation, package.json (apply normally) + 3 migrated svc-data files (apply at apps/api/data paths).

**Why this matters:** F104 canon §21 ESLint enforcement (no-warning-comments, no-unused-vars, custom hw/no-versioned-identifier). The clean portion is large (eslint.config.mjs +127 lines, custom rule + selftest). The 3 migrated portions are tiny line-level fixes.

**Approach:** Two-step application.

- [ ] **Step 1: Verify HEAD matches Task 6's recorded SHA**

- [ ] **Step 2: Generate the FULL patch**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git format-patch -1 bdbe876 --stdout > /tmp/bdbe876-original.patch && head -3 /tmp/bdbe876-original.patch
```

- [ ] **Step 3: Build the path-translation map**

The original patch references three migrated paths:
- `apps/svc-data/src/app/integration/connector-credentials.service.ts`
- `apps/svc-data/src/app/integration/oauth2.service.ts`
- `apps/svc-data/src/app/computed/computed-property-dispatcher.service.ts`

Translate to `apps/api/src/app/data/` versions:

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && sed 's|apps/svc-data/src/app/integration/|apps/api/src/app/data/integration/|g; s|apps/svc-data/src/app/computed/|apps/api/src/app/data/computed/|g' /tmp/bdbe876-original.patch > /tmp/bdbe876-translated.patch
```

- [ ] **Step 4: Apply with check**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git apply --check /tmp/bdbe876-translated.patch 2>&1
```

The trickiest part: `apps/api/src/app/data/computed/computed-property-dispatcher.service.ts` was edited in our session at commit `a27d5ef` (stale comment fix at line 13–14). The security branch's `prefer-const` fix at line 87 is in a different region, so should NOT conflict. But if the line numbers shifted (because we added/removed lines), the `--check` may fail.

If `--check` fails on computed-property-dispatcher.service.ts, fall back to manual application of just the `prefer-const` fix:
1. `git apply --reject /tmp/bdbe876-translated.patch` to apply what can be applied
2. Inspect any `*.rej` files generated; manually port the rejected hunks
3. Verify with `grep -n 'let \|const ' apps/api/src/app/data/computed/computed-property-dispatcher.service.ts` and identify line 87's `let` vs `const` semantics

- [ ] **Step 5: Stage + commit**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git add -A && git commit -m "$(cat <<'EOF'
feat(lint): canon §21 ESLint enforcement (F104, W0 task 6)

Cherry-picked from claude/condescending-shamir-92422b commit bdbe876.
The 3 lint-fix files in svc-data paths were path-translated to
apps/api/src/app/data/ post-arc-w1-data-complete migration:
- integration/connector-credentials.service.ts (line 54: error→_error)
- integration/oauth2.service.ts (line 379: error→_error)
- computed/computed-property-dispatcher.service.ts (line 87: prefer-const)

The eslint.config.mjs + custom rule + selftest + package.json + svc-automation
script-sandbox.spec + web-client PropertiesPage portions applied without
translation.

Original-commit: bdbe876
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Run all scanners + lint**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npm run selftest:scanners 2>&1 | tail -5 && npm run authz:check && npm run security:check && npm run service-boundary:check && npx nx build api 2>&1 | tail -3
```

All must pass. If selftest:eslint-rules is the new selftest, it should pass.

- [ ] **Step 7: Record HEAD SHA**

---

## Task 8: Phase 0.H — Cherry-pick W1 acceptance docs (99b3d18, with CLAUDE.md merge)

**Files:**
- Cherry-pick `99b3d18` (CLAUDE.md amendment-log entry + docs/plan-fixes/W01-acceptance.md)

**Why this matters:** W1 closure documentation. Mostly additive amendment-log entry. Minor risk of CLAUDE.md conflict (the security branch's amendment-log entry adds below-existing entries; our branch has §24 entries that don't directly overlap).

- [ ] **Step 1: Verify HEAD matches Task 7's recorded SHA**

- [ ] **Step 2: Cherry-pick**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git cherry-pick 99b3d18 2>&1 | tail -10
```

Expected: clean apply (the security branch's entries land below, our branch's entries are at the top — chronological order).

If a conflict appears in CLAUDE.md, manually order the amendment-log entries chronologically: 2026-05-08 (W0), 2026-05-09 (W1) BEFORE our 2026-05-10 (Plan Fix 1, etc.). Use Edit tool. Then `git add CLAUDE.md && git cherry-pick --continue`.

- [ ] **Step 3: Verify clean state**

- [ ] **Step 4: Record HEAD SHA**

---

## Task 9: Phase 0.I — Final verification gate

**Files:** None modified; verification only.

- [ ] **Step 1: Run all scanners**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npm run selftest:scanners && npm run authz:check && npm run audit:check && npm run security:check && npm run service-boundary:check && npm run deps:check && npm run compliance:check
```

All must exit 0.

- [ ] **Step 2: Build all 4 monolith-state apps + worker + control-plane**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npx nx build api && npx nx build svc-identity && npx nx build svc-metadata && npx nx build svc-data && npx nx build worker && npx nx build svc-control-plane && npx nx build web-client && npx nx build web-control-plane
```

All 8 builds must succeed.

- [ ] **Step 3: Run apps/api tests**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npx nx test api 2>&1 | tail -10
```

Pre-existing 233/233 expected. Plus any new tests from cherry-picked specs that landed in libs/ai or libs/automation.

- [ ] **Step 4: Run W1-specific spec assertions (148 from W1 acceptance doc)**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && npx nx test ai 2>&1 | tail -5 && npx nx test automation 2>&1 | tail -5 && npx nx test enterprise 2>&1 | tail -5
```

If lib-level tests aren't separately runnable (depends on Nx project config), confirm with `npx nx run-many --target=test --all 2>&1 | tail -20`.

- [ ] **Step 5: Verify apps/svc-* shapes (post-migration sanity check)**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && ls apps/svc-identity/src/app/ && echo "---" && ls apps/svc-metadata/src/app/ && echo "---" && ls apps/svc-data/src/app/
```

Expected: each shows only `app.module.ts` (thin adapter shape preserved by reconciliation).

- [ ] **Step 6: Check arc-w1-data-complete tag still points where expected**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git rev-parse arc-w1-data-complete && git log --oneline arc-w1-data-complete
```

Expected: tag still at `d10f0d9` (the data top-level commit). The reconciliation builds on top of this.

- [ ] **Step 7: Tag the milestone**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git tag arc-reconciled-with-w1-security && git log --oneline arc-w1-data-complete..arc-reconciled-with-w1-security
```

Expected: ~27 commits (the cherry-picked range, plus path-translation commits, plus the cleanup commits).

- [ ] **Step 8: Append completion note to this plan**

Append after `**End of Phase 0 reconciliation plan.**`:

```markdown
---

## Status: Complete (target: <fill in completion date>)

Phase 0 branch reconciliation complete. 27 W0+W1 security/correctness commits
landed on claude/amazing-yalow-0f9c37. 21 cherry-picked clean; 3 required
path-translation (LDAP F011, packs SSRF F125+F126, ESLint enforcement F104);
2 needed CLAUDE.md additive merge (W0 + W1 acceptance docs). Tag
`arc-reconciled-with-w1-security` at HEAD <SHA>.

Master roadmap §Phase 1 unblocked: continue W1 architectural migration
(svc-automation → svc-ava → svc-workflow → svc-control-plane → fold-ins → cutover).
```

- [ ] **Step 9: Commit the completion note**

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/amazing-yalow-0f9c37" && git add docs/superpowers/plans/2026-05-10-phase0-branch-reconciliation.md && git commit -m "docs(plan): mark Phase 0 reconciliation complete"
```

---

## Self-review

**1. Spec coverage:** This plan covers all 27 W0+W1 commits identified by the master roadmap. Each commit is classified (clean / path-translation / merge-needed) with a justification. The cherry-pick order respects in-branch dependencies (e.g., `8c11160` introduces `tools/dead-code-check.ts` BEFORE `bdbe876` modifies it).

**2. Placeholder scan:** Tasks include exact commands. Conflict-resolution sections include explicit fall-back paths (apply --reject, manual edit, BLOCKED escalation). No "TBD" or "fill in details" placeholders.

**3. Type consistency:** Cherry-pick targets named consistently. Path translations are explicit (`apps/svc-identity/src/app/ldap/` → `apps/api/src/app/identity/ldap/`; same for metadata/packs and data/{integration,computed}). Commit message format consistent (Original-commit: <SHA> + co-author trailer).

**4. Scope check:** Plan covers Phase 0 only — branch reconciliation. NOT Phase 1 (next migration), NOT Phase 2 (next security wave). Single plan size is appropriate for ~3–5 days of careful work.

**5. Conflict-handling realism:** Three categories of conflict identified:
- §21 in CLAUDE.md (Task 2): genuine conflict, manual merge with explicit intent guidance
- ldap.service.ts (Task 5): possible if file evolved on our branch in ways not predicted; fall-back is `--reject` + manual port
- computed-property-dispatcher.service.ts (Task 7): line-87 fix in a region different from my a27d5ef edit at line 13–14; should apply, but `--reject` fall-back documented

**6. Authorization recovery:** Each task documents `git cherry-pick --abort` as the soft-recovery + `git reset --hard <previous>` as the hard-recovery for irrecoverable state.

No issues found.

---

**End of Phase 0 reconciliation plan.**

---

## Status: Complete (2026-05-10)

Phase 0 branch reconciliation complete. 27 W0+W1 security/correctness commits
landed on `claude/amazing-yalow-0f9c37` across 9 implementation tasks plus
auxiliary follow-ups:

- **21 cherry-picked clean** (Tasks 1, 3 batches: 11 W0 + 10 W1)
- **1 CLAUDE.md additive merge** for §21 + amendment-log (Task 2: c4f3d73; the
  reviewer recognized our branch's earlier "TRIM scanner list" framing was
  outdated — W0 actually expanded service-boundary:check rather than removing
  it — and resolved by accepting the security branch's W0 reality block while
  preserving our amendment-log entries)
- **1 web-client + eslint additive** (Task 4: 4ccae79) — pragmatic forward-pull
  of bdbe876's eslint.config.mjs content because 4ccae79's diff context assumed
  bdbe876 was already applied in the source-branch order; resolved with an
  inline conditional loader for the custom rule file
- **2 path-translated** for migrated services:
  - Task 5: F011 LDAP filter escape, `apps/svc-identity/src/app/ldap/` → `apps/api/src/app/identity/ldap/`
  - Task 6: F125+F126 packs SSRF, `apps/svc-metadata/src/app/packs/` → `apps/api/src/app/metadata/packs/`
- **1 mixed apply** for bdbe876 (Task 7: F104 ESLint enforcement) — path-translated
  3 svc-data lint fixes to apps/api/data, created remaining tools/eslint-rules/
  files (index.js, no-versioned-identifier.spec.cjs, tsconfig.json), confirmed
  the eslint.config.mjs and no-versioned-identifier.cjs content from Task 4 was
  redundant; selftest:eslint-rules passes (14 valid + 7 invalid cases)
- **1 W1 acceptance docs + amendment-log** (Task 8: 99b3d18) — chronologically-ordered
  amendment-log entries in CLAUDE.md
- **Auxiliary 1**: package-lock.json follow-up after Task 4's npm install
- **Auxiliary 2 (Task 8.5)**: PUBLIC_ALLOWLIST entries for the 13 migrated
  apps/api endpoints (the W0 baseline's allowlist referenced apps/svc-* paths
  that no longer exist on this branch post-migration; security:check now passes)
- **Auxiliary 3**: svc-notify tsconfig.app.json spec-exclude (the F127 cherry-pick
  added a spec file but svc-notify's tsconfig didn't exclude *.spec.ts from the
  production build — added the same exclude pattern present in svc-data's tsconfig)

**Tag:** `arc-reconciled-with-w1-security` at HEAD `9135f53`. 33 commits since
`arc-w1-data-complete`.

### Verification at tag

| Check | Result |
|---|---|
| `authz:check` | PASS (1 deferred entry tracked) |
| `audit:check` | PASS |
| `security:check` | PASS (after Task 8.5 allowlist update) |
| `service-boundary:check` | PASS (7 allowlisted crossings) |
| `deps:check` | PASS (1 legacy carve-out) |
| `dead-code:check` | PASS |
| `compliance:check` | PASS |
| `selftest:scanners` | PASS (eslint-rules 14+7, others 7+12+11) |
| nx build api | PASS |
| nx build svc-identity | PASS |
| nx build svc-metadata | PASS |
| nx build svc-data | PASS |
| nx build svc-notify | PASS (after auxiliary 3) |
| nx build svc-control-plane | PASS |
| nx build svc-ava | PASS |
| nx build svc-migrations | PASS |
| nx build web-client | PASS |
| nx build web-control-plane | PASS |
| nx test api | PASS (255 tests) |

### Next steps unblocked

Master roadmap §Phase 1 unblocked: continue W1 architectural migration in this
order per PLATFORM-ROADMAP.md:
1. svc-automation (~6,000 LoC, partly consolidated by Plan Fix 1)
2. svc-ava (~8,000 LoC; AVA runtime, may have F072+F074 proposal state machine concerns)
3. svc-workflow (~3,000 LoC; per canon §8 INVERT may merge with automation)
4. svc-control-plane (~6,000 LoC; multi-tenant by design, different shape)
5. svc-view-engine, svc-insights, svc-notify, svc-instance-api fold-ins
6. Final cutover: delete legacy svc-* directories, delete service-boundary scanner
   per canon §21 TRIM, route 100% traffic to apps/api, tag `arc-w1-complete`.

The remaining svc-* services migrate against a baseline that already includes
W0+W1 security work, so future migrations don't accumulate files needing
post-hoc security re-fixes at new locations.
