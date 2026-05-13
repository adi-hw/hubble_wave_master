# Plan Fix 25 — Audit Transaction Sweep

**Status:** In progress (W5.A — scanner widening + baseline inventory)
**Owner:** adi-hw
**Effort:** ~6-7 PRs (W5.A scanner widening + W5.B-G per-area sweeps)
**Related canon clauses:** §1 (greenfield discipline), §10 (auditability mandatory), §24 (canon maintenance)
**Triggering audit:** F044 — "audit log writes outside transactions in 30+ services"

## Context

Canon §10 requires every state-changing action to record an audit row in the same DB transaction as the data write: "A failed action cannot leave a successful audit row, and a failed audit cannot leave a successful action. Both commit or both roll back."

The platform ships a canonical helper: `withAudit(dataSource, fn)` at `libs/instance-db/src/lib/audit/with-audit.ts`. It wraps `dataSource.transaction(...)`, accumulates audit events via a callback, and flushes audit rows on commit. Either all writes succeed or none persist.

CI scanner `tools/audit-bypass-check.ts` (`npm run audit:check`) flags service methods that perform a record-write AND a separate audit-log write outside `withAudit(...)` / `dataSource.transaction(...)`. Wired into `.github/workflows/ci.yml` as a required status check.

### Scanner bug discovered 2026-05-13

`RECORD_WRITE_PATTERNS[0]` regex used a leading `\b` word boundary on `(?:Repo|Repository|repo|repository)`. In identifiers like `sessionRepo.save(...)`, `userRepo.save(...)`, `auditLogRepo.save(...)` the substring `Repo` is mid-identifier — not at a word boundary — so the pattern silently missed the most common service patterns. The scanner gave a false-green signal.

Confirmed example: `apps/api/src/app/identity/auth/impersonation.service.ts:131-159` writes `sessionRepo.save()` → `authEventsService.record()` → `auditLogRepo.save()` in `startImpersonation` with no transaction wrapper. Process crash between writes leaves the session persisted with no audit row — textbook §10 violation. Same pattern in `endImpersonation` at lines 188-214.

W5.A fixes the regex, adds self-test coverage for the missed patterns, runs the improved scanner, and captures the baseline inventory in `KNOWN_DEFERRED_OFFENDERS` with per-area `followUp` tags. Subsequent PRs (W5.B-F) refactor area-by-area and shrink the allowlist toward empty.

## Target end state

1. Scanner regex catches `<varName>Repo.save()` and `<varName>Repository.save()` identifiers regardless of prefix.
2. Scanner self-test (`tools/audit-bypass-check-selftest.ts`) covers the previously-missed patterns with assertions.
3. Every state-changing service in `apps/api/src/app/*` uses `withAudit(...)` when the operation requires audit attribution.
4. `KNOWN_DEFERRED_OFFENDERS` reaches empty (canon §21 ratchet).
5. CLAUDE.md §24 amendment line records the wave.

## PR sequence

### W5.A — Scanner widening + baseline inventory (this PR)

**What:** Fix the regex bug, add self-test for previously-missed patterns, run scanner, allowlist newly-flagged sites with per-area `followUp`. Land this plan-fix doc.

**Files:**
- New: `docs/plan-fixes/25-audit-transaction-sweep.md`
- Modified: `tools/audit-bypass-check.ts`
- Modified: `tools/audit-bypass-check-selftest.ts` (or new if absent)
- Modified: `CLAUDE.md` (§24 amendment line)

**Out of scope:** Fixing the actual save-then-audit violations in service files. That is W5.B-G work. W5.A ONLY widens the scanner and captures inventory.

**Verification:**
- `npm run audit:check` → green with N deferred sites listed
- `npx ts-node tools/audit-bypass-check-selftest.ts` → all assertions pass
- `npm run authz:check && npm run security:check && npm run service-boundary:check && npm run deps:check && npm run compliance:check` → all green
- `npx nx build api && npx nx build control-plane` → green

### W5.B — identity area sweep

Refactor every `apps/api/src/app/identity/**/*.service.ts` site captured in W5.A's allowlist to use `withAudit(...)`. Remove identity entries from `KNOWN_DEFERRED_OFFENDERS`. Add at least one integration test asserting atomic rollback (audit-write failure rolls back data-write).

### W5.C — metadata area sweep

Same shape, area = `apps/api/src/app/metadata/**`.

### W5.D — data area sweep

Same shape, area = `apps/api/src/app/data/**`.

### W5.E — automation + ava area sweep

Same shape, areas = `apps/api/src/app/automation/**` + `apps/api/src/app/ava/**`. Combined — both areas already use `withAudit` per `arc-w1-automation-complete` + `arc-w1-ava-complete`, so the sweep is narrow.

### W5.F — fold-in areas sweep

Same shape, areas = `apps/api/src/app/{views,notifications,instance-api,analytics}/**` + `apps/control-plane/**` for any flagged files.

### W5.G — scanner precision improvements + silent-skip scanner (this PR)

Two scanner gaps closed:

**Gap 1 — `REPO_SAVE_PATTERN` was save-only.** W5.B's agent caught `deviceRepo.update(...)` + `auditLogRepo.save(...)` in `revokeAllDevices` via manual inspection. TypeORM's `Repository` exposes multiple mutation methods beyond `.save()`: `.update()`, `.delete()`, `.insert()`, `.softDelete()`, `.softRemove()`, `.remove()`, `.upsert()`. The previous regex silently missed all of them.

Fix: new `REPO_MUTATE_PATTERN` exported from `tools/audit-bypass-check.ts`:
```ts
export const REPO_MUTATE_PATTERN =
  /[A-Za-z_$][\w$]*[Rr]epo(?:sitory)?\s*\.\s*(?:save|insert|update|delete|softDelete|softRemove|remove|upsert)\s*\(/g;
```
`hasNonAuditRepoSave` renamed to `hasNonAuditRepoMutate`, using the wider pattern. Self-test updated: 17 assertions (up from 11, adding Positive-3/4 for `.update`/`.delete` cases and Negative-7 for wrapped `.update`).

Result: N=0 new audit-mutation violations discovered beyond the existing 4 deferred W5.B sites — the wider pattern does not trigger false positives against the current codebase.

**Gap 2 — Silent-skip scanner.** Canon §10 amendment: "Silent skips (`logger.warn` followed by `continue`) are also auditability violations. They MUST also write a `runtime_anomaly` row via `RuntimeAnomalyService` so operators can query and alert on them."

New scanner: `tools/silent-skip-check.ts` (`npm run silent-skip:check`).

Patterns:
```ts
export const LOGGER_WARN_PATTERN = /\blogger\s*\.\s*(?:warn|error)\s*\(/;
export const CONTINUE_PATTERN = /\bcontinue\s*;/;
export const RUNTIME_ANOMALY_WRITE_PATTERN =
  /(?:runtimeAnomalyService|runtimeAnomaly|anomalyService|(?:this\.[A-Za-z_$][\w$]*[Aa]nomaly(?:[A-Za-z_$][\w$]*)?))\s*\.\s*(?:record|save|create)\s*\(/;
```

Method-body extraction reuses the same `extractMethodBodies` brace-matching logic from `audit-bypass-check.ts`.

Self-test: `tools/silent-skip-check-selftest.ts`, 15 assertions (8 unit + 3 integration, all pass).

Result: M=19 silent-skip violations discovered, all added to `KNOWN_DEFERRED_OFFENDERS` with `followUp: 'W5.I'`. No inline fixes — this PR is scanner-only per the W5.G scope boundary.

**Files:**
- Modified: `tools/audit-bypass-check.ts` (REPO_MUTATE_PATTERN + hasNonAuditRepoMutate)
- Modified: `tools/audit-bypass-check-selftest.ts` (17 assertions, +6 for W5.G)
- New: `tools/silent-skip-check.ts`
- New: `tools/silent-skip-check-selftest.ts` (15 assertions)
- Modified: `package.json` (`silent-skip:check`, `selftest:silent-skip`, wired into `selftest:scanners`)
- Modified: `.github/workflows/ci.yml` (Silent-skip check step + updated assertion counts)
- Modified: `CLAUDE.md` (§24 amendment)

**Out of scope:** Fixing the actual silent-skip violations in service files. That is W5.I work.

**Verification:**
- `npm run audit:check` → green, 4 deferred W5.B sites
- `npm run silent-skip:check` → green, 19 deferred W5.I sites
- `npx ts-node tools/audit-bypass-check-selftest.ts` → 17/17 assertions pass
- `npx ts-node tools/silent-skip-check-selftest.ts` → 15/15 assertions pass

### W5.H — audit-mutation sweep (follow-on to W5.G widening)

If W5.G's wider REPO_MUTATE_PATTERN surfaces new violations in W5.H-I service sweeps, add them to the W5.B-F wave sequence or as a dedicated W5.H pass. Currently: 0 new violations beyond existing W5.B allowlist.

### W5.I — silent-skip sweep

Sweep all 19 W5.G deferred silent-skip sites, adding `RuntimeAnomalyService.record(...)` adjacent to each `logger.warn/error + continue` pattern. Remove entries from `KNOWN_DEFERRED_OFFENDERS` as sites are fixed. The enterprise `libs/enterprise/src/lib/audit.service.ts` site requires evaluating whether to inject `RuntimeAnomalyService` or refactor the loop pattern.

## Acceptance

- `KNOWN_DEFERRED_OFFENDERS` empty after W5.B-F complete.
- `npm run audit:check` green with no deferred sites.
- Every state-changing service uses `withAudit(...)` (or has documented rationale for not needing audit attribution).
- CLAUDE.md §24 amendment line landed.
- No regression in the 5 other scanners.
- Integration test demonstrates atomic rollback when audit write fails.

## Out of scope (Plan Fix 25 boundary)

- F054 — audit hash chain backfill (one-shot migration). Related to §10 but distinct; tracked as own follow-on.
- Cross-service distributed-transaction audit (not applicable in modular monolith per spec §6.3).
- Audit attribution for read-only operations (canon §10 covers state-changing actions).
- Removing the silent admin bypass (`if (ctx.isAdmin) return true`) — canon §28.6 commitment, owed to a separate W2-final wave.
