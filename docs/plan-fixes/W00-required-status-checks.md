# W0 — Required Status Checks Runbook

**For:** Repository admin
**Status:** Pending admin execution after W0 PR merges
**Refs:** F106, F119, W0 task 11, master roadmap §W0 step 8

This runbook configures GitHub branch protection on `master` to require every architectural and CI gate as a status check before merge. Without this configuration, the gates exist in CI but can be bypassed via admin-merge.

---

## Context

W0 ships **9 architectural CI gates** plus the standard build/test/lint/typecheck checks. Each must be a required status check on `master` (and `main` if used) so that:

1. A PR cannot merge without all gates green.
2. A direct push to `master` is impossible (the workflow protects merges).
3. The `cd.yml` workflow is gated on a successful CI run via `workflow_run`, but that gate is only meaningful if CI itself is required for merging.

---

## Required Status Checks

In **GitHub → Settings → Branches → Branch protection rules → master** (and `main` if used):

### Section: "Require a pull request before merging"
- ✅ Require a pull request before merging
- ✅ Require approvals: **1 minimum** (raise to 2 once CODEOWNERS lands in W10)
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners *(once W10 lands; for now, leave unchecked)*
- ✅ Require approval of the most recent reviewable push

### Section: "Require status checks to pass before merging"
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging

**Required checks (search and add each):**

| # | Check name (as it appears in CI) | Source | Wave / Finding |
|---|---|---|---|
| 1 | `Lint & Format` | ci.yml — `lint` job | existing |
| 2 | `TypeScript Check` | ci.yml — `typecheck` job | existing |
| 3 | `Architectural CI gates` | ci.yml — `scanners` job (runs all 7 sub-checks) | F018, F056, F104, F105, F106 (W0) |
| 4 | `Unit Tests` | ci.yml — `unit-tests` job | existing |
| 5 | `Secret scan (gitleaks)` | ci.yml — `gitleaks` job | F119 / W0 task 8 |

The `Architectural CI gates` job is one GitHub-Actions job that runs seven sub-scripts:
- `npm run authz:check` (W0 task 4 will extend its scope)
- `npm run audit:check`
- `npm run security:check` (W0 task 3 will reconcile its allowlist)
- `npm run compliance:check:strict` (F151 fixed in W0 task 1.5; F152 separately tracked)
- `npm run service-boundary:check` (W0 task 5 will add entity-write detection)
- `npm run deps:check`
- `npm run cicd:check` (W0 task 7)

Future W0 additions will extend this list:
- `dead-code:check` (W0 task 10)

W9–W10 will add:
- `bundle-size:check`
- `coverage:check`

### Section: "Restrict who can push to matching branches"
- ✅ Restrict pushes that create matching branches
- (No specific user/team restriction required at this stage; CODEOWNERS in W10 will tighten this.)

### Section: "Rules applied to everyone"
- ✅ Require linear history *(recommended; matches the merge-commit pattern in recent history)*
- ✅ Require deployments to succeed before merging *(if a `staging` GitHub Environment exists)*
- ✅ Require conversation resolution before merging
- ❌ Allow force pushes (off, except per the bypass procedure)
- ❌ Allow deletions (off)
- ✅ **Do not allow bypassing the above settings** — this is the critical box. Without it, repository admins can merge over a failing check.

---

## Verification Steps

After enabling:

1. **Open a draft PR with a deliberately failing scanner.** E.g., add a `// TODO: test` comment to a tracked file and push. The PR's "Architectural CI gates" check should turn red, the merge button should be disabled, and the disabled state must persist even when logged in as an admin.

2. **Try to push directly to `master`.** It must be rejected with the "Branch is protected" message.

3. **Open a PR that adds a new `@Public()` to a controller without updating `tools/security-bypass-check.ts` allowlist.** The "Architectural CI gates" check must fail at the security step (after W0 task 3 reconciles the scanner's drift detection).

If any of the above pass: the protection rule is misconfigured. Re-check.

---

## Bypass Procedure (Emergency Use Only)

Required for: production hot-fixes when CI is broken for reasons external to the change (e.g., upstream provider outage breaking a scanner's network call).

1. Open a GitHub Issue titled `[BYPASS] <reason>` documenting:
   - The CI failure (link to the failing run).
   - The PR or commit that needs to ship.
   - The proposed remediation timeline (max 24h).
2. Get sign-off from a security reviewer (CODEOWNERS-defined; today, founder + ops lead).
3. Use the GitHub admin override.
4. **Within 24 hours**, open a follow-up PR that:
   - Restores the failing CI gate to green (fix the underlying issue).
   - Adds an audit row to `bypass_audit` (a control-plane table; introduced in W10).
   - References the bypass issue in the commit body.
5. The bypass issue cannot be closed until the follow-up PR merges.

The intent: bypass is possible but visible, time-bounded, and audited. It is not a regular workflow.

---

## Revision History

- **2026-05-09 (W0 task 11):** Initial runbook. Pending admin configuration after W0 PR merges.
