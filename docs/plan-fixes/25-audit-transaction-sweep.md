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

### W5.B — identity area sweep (COMPLETE, 2026-05-13)

Refactored all 4 identity/auth sites captured in W5.A's allowlist to use
`withAudit(dataSource, fn)`. Removed all 4 entries from `KNOWN_DEFERRED_OFFENDERS`.
`npm run audit:check` now reports `audit bypass check: ok` with zero deferred sites.

**Files refactored:**

- `apps/api/src/app/identity/auth/behavioral-analytics.service.ts`
  - `updateAlertStatus` (lines 389–441): `alertRepo.save` + `auditLogRepo.save`
    wrapped in `withAudit`. `AuditLog` injection removed (no longer used as
    direct repo; `withAudit` manages audit writes internally).

- `apps/api/src/app/identity/auth/delegation.service.ts`
  - `createDelegation` (~line 120): `delegationRepo.save` + `auditLogRepo.save`
  - `approveDelegation` (~line 186): `delegationRepo.save` + `auditLogRepo.save`
  - `revokeDelegation` (~line 234): `delegationRepo.save` + `auditLogRepo.save`
  All 3 wrapped in `withAudit`. `AuditLog` injection removed.

- `apps/api/src/app/identity/auth/device-trust.service.ts`
  - `trustDevice` (~line 135): `deviceRepo.save` + `auditLogRepo.save` for new devices
  - `revokeDevice` (~line 285): `deviceRepo.save` + `auditLogRepo.save`
  - `revokeAllDevices` (~line 314): `deviceRepo.update` + `auditLogRepo.save`
  All 3 wrapped in `withAudit`. `AuditLog` injection kept (still used for
  read-only queries in `assessDeviceRisk`).

- `apps/api/src/app/identity/auth/impersonation.service.ts`
  - `startImpersonation` (~line 131): `sessionRepo.save` + `authEventsService.record`
    + `auditLogRepo.save`. After refactor: `sessionRepo.save` + `recordAudit`
    inside `withAudit`; `authEventsService.record` moved after commit (analytics
    concern, not a §10 audit row). `AuditLog` injection removed.
  - `endImpersonation` (~line 188): same pattern.

**Integration test added:**
`apps/api/src/app/identity/auth/impersonation.service.spec.ts`

- `startImpersonation — happy path`: asserts session persists when audit write succeeds.
- `startImpersonation — atomic rollback (canon §10)`: overrides the `AuditLog`
  repo save to throw; asserts the overall call throws and `authEventsService.record`
  is NOT called (it runs after the transaction, so a throw inside the transaction
  prevents it from executing).
- `endImpersonation — happy path`: asserts session.isActive = false is persisted.

`authEventsService.record(...)` calls intentionally moved OUTSIDE the `withAudit`
wrapper in all affected methods — they are analytics/observability writes, not §10
audit rows, and they do not need to be atomic with the data write.

### W5.C — metadata area sweep

Same shape, area = `apps/api/src/app/metadata/**`.

### W5.D — data area sweep

Same shape, area = `apps/api/src/app/data/**`.

### W5.E — automation + ava area sweep

Same shape, areas = `apps/api/src/app/automation/**` + `apps/api/src/app/ava/**`. Combined — both areas already use `withAudit` per `arc-w1-automation-complete` + `arc-w1-ava-complete`, so the sweep is narrow.

### W5.F — fold-in areas sweep

Same shape, areas = `apps/api/src/app/{views,notifications,instance-api,analytics}/**` + `apps/control-plane/**` for any flagged files.

### W5.G — silent-skip → runtime_anomaly migration (deferred)

Canon §10 also requires that silent skips (`logger.warn` + `continue`) write a `runtime_anomaly` row via `RuntimeAnomalyService`. Separate scanner extension + sweep. Tracked but out of scope for W5.A-F.

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
