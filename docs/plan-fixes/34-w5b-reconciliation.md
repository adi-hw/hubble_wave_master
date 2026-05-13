# Plan Fix 34 — W5.B Reconciliation to Master

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR
**Related canon clauses:** §10
**Triggering audit:** W5.B (Plan Fix 25 identity sweep) merged to claude/optimistic-heisenberg-a86f1f worktree branch but never to master

## Context

PR #37 (W5.B) was merged into the worktree branch `claude/optimistic-heisenberg-a86f1f`
as part of a stacked-PR workflow, but the master branch never received the W5.B commits.
As a result, master's `KNOWN_DEFERRED_OFFENDERS` in `tools/audit-bypass-check.ts` has
been carrying 4 entries that should have been removed when W5.B landed.

The 4 entries pointed to the identity/auth services:
- `apps/api/src/app/identity/auth/behavioral-analytics.service.ts`
- `apps/api/src/app/identity/auth/delegation.service.ts`
- `apps/api/src/app/identity/auth/device-trust.service.ts`
- `apps/api/src/app/identity/auth/impersonation.service.ts`

Each had save-then-audit-outside-transaction patterns that violate canon §10
("both commit or both roll back").

## What landed

**Approach:** cherry-pick of commit `1e5578e` from the worktree branch.

**Conflicts encountered:**
- `CLAUDE.md` — the HEAD §24 amendments list contained many entries added after
  W5.B was authored (Plan Fix 27-31, §29 PR-D, etc.). The conflict was a simple
  insertion-point conflict. Resolved by keeping all HEAD amendments and inserting
  the W5.B §24 entry (reworded as "Plan Fix 34 — W5.B reconciliation") in the
  correct chronological position.
- `tools/audit-bypass-check-selftest.ts` — the Integration-1 comment description
  said "W5.A allowlist is populated" on HEAD vs "W5.B (KNOWN_DEFERRED_OFFENDERS
  empty)" in the cherry-pick. Resolved by taking the W5.B description (correct —
  the array is now empty) while also preserving the Negative-7 W5.G test entry
  that HEAD had added.

All 4 service files and `tools/audit-bypass-check.ts` applied without conflict.

## Files modified

- `apps/api/src/app/identity/auth/behavioral-analytics.service.ts`
  — `updateAlertStatus` wrapped in `withAudit`
- `apps/api/src/app/identity/auth/delegation.service.ts`
  — `createDelegation`, `approveDelegation`, `revokeDelegation` wrapped in `withAudit`
- `apps/api/src/app/identity/auth/device-trust.service.ts`
  — `trustDevice`, `revokeDevice`, `revokeAllDevices` wrapped in `withAudit`
- `apps/api/src/app/identity/auth/impersonation.service.ts`
  — `startImpersonation`, `endImpersonation` wrapped in `withAudit`
- `apps/api/src/app/identity/auth/impersonation.service.spec.ts` (new)
  — atomic rollback integration test
- `tools/audit-bypass-check.ts`
  — 4 entries removed from `KNOWN_DEFERRED_OFFENDERS` (array is now `[]`)
- `tools/audit-bypass-check-selftest.ts`
  — Integration-1 comment updated to reflect W5.B completion
- `docs/plan-fixes/25-audit-transaction-sweep.md`
  — W5.B section updated to COMPLETE with implementation details
- `CLAUDE.md`
  — §24 amendment entry added for Plan Fix 34

## Acceptance

- `KNOWN_DEFERRED_OFFENDERS` is empty `[]` on master
- All 4 services use `withAudit()` per canon §10
- Atomic rollback integration test in `impersonation.service.spec.ts` passes
- `npm run audit:check` reports `audit bypass check: ok` with zero deferred sites
- All scanners green

## Out of scope

- The W5.B commit history preservation — the reconciliation produces a new commit
  on master; the worktree branch's history is correct where it is
- Plan Fix 25's "Status: Complete" header on master — already true via prior PRs;
  this PR adds the code that matches the doc
