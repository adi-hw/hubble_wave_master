# Plan Fix 1 — Automation Engine Consolidation

**Status:** Planned, not started.
**Owner:** Unassigned.
**Estimated effort:** 3–5 PRs over 2–3 sprints.
**Related canon clauses:** §1 (greenfield, no duplication), §3 (platform not application), §8 (automation ≠ workflow), §14 (delete ruthlessly).
**Triggering audit:** Senior-architect critique (`zippy-creek` plan), Critique 1 + Section S1.

---

## Context

Today, automation runtime logic lives in **two services**:

- `apps/svc-data/src/app/automation/` — **synchronous, in-request** before/after triggers. ~4,786 LoC.
- `apps/svc-automation/src/app/runtime/` — **asynchronous, post-commit** outbox consumer. ~3,196 LoC.

The two share three near-duplicate files (`condition-evaluator.service.ts`, `script-sandbox.service.ts`, `action-handler.service.ts`) that have **already started to diverge** (svc-automation's evaluator added `_previous.` and `_changes` system properties; svc-data's didn't). Every condition-evaluation bugfix has to land in two places. Every audit reader has to ask "which engine ran this?". The CLAUDE.md amendment in §1 admits this is "slated for deletion" but the duplicate has shipped to production.

The drift is the real cost. The duplication is the leading indicator.

## Target end state

- **`svc-automation` is the sole runtime.** It exposes both an async (BullMQ) and a sync (HTTP) execution path. Triggers, conditions, actions, script sandbox, cycle/depth control, rate limiting, scheduled jobs all live here.
- **`svc-data` emits events only.** Its `automation/` directory shrinks to a thin client: an outbox emitter for async triggers and an HTTP client for sync triggers.
- **`automation.controller.ts` (CRUD on AutomationRule)** moves to either svc-automation (if owned by the runtime) or svc-metadata (if treated as schema artifact). Decide per the service responsibility map in `zippy-creek` §C — `svc-automation` "owns the automation runtime" so the rules belong with it.
- **Per-collection rule cache** lives in svc-automation, invalidated via the event bus introduced in Plan Fix 3.
- **Service-boundary scanner** detects and rejects any cross-service entity write to `AutomationRule` / `AutomationExecutionLog`.

## PR sequence

Each PR ships independently. Each is reversible. No big-bang.

### PR 1 — Add `POST /sync-trigger` endpoint to svc-automation

**What:** Expose a synchronous HTTP execution path on svc-automation that mirrors svc-data's current `executeAutomations(collectionId, timing, operation, record, prev, actor, parentCtx)` contract.

**Files:**
- New: `apps/svc-automation/src/app/sync-trigger/sync-trigger.controller.ts`
- New: `apps/svc-automation/src/app/sync-trigger/sync-trigger.service.ts` — thin wrapper that calls existing `AutomationRuntimeService` in sync mode
- New: `apps/svc-automation/src/app/sync-trigger/sync-trigger.module.ts`
- Modified: `apps/svc-automation/src/app/app.module.ts` (register module)

**Authz:** New permission `automation.sync_trigger.execute`. Granted to a system role (svc-data uses a service-to-service JWT). Migration adds the slug + grants.

**Contract:** JSON request matching the current `ExecuteAutomationsArgs`; JSON response matching the current `ExecutionResult`. Versioned URL: `/api/automation/v1/sync-trigger`.

**Edge cases to test:**
- Before-triggers that abort — must return abort signal in response, not throw.
- Before-query gates — read-only path; must accept `operation: 'query'`.
- Recursion / cycle detection — caller's `parentAutomationContext` propagates across the HTTP boundary.
- Timeout — endpoint enforces a hard upper bound (e.g. 5 s for sync triggers); times out → returns abort signal, never hangs the caller.
- Audit — execution log entries written by svc-automation in the same transaction as the rule run.

**Out of scope:** Migrating svc-data callers (PR 2). svc-data still uses its local executor.

**Verification:** Hit the endpoint with payloads that mirror real triggers; confirm output matches svc-data's local executor for the same input. Latency budget: P99 < 100 ms for a no-action condition check.

### PR 2 — Migrate svc-data sync callers to the HTTP endpoint

**What:** Replace svc-data's local `AutomationExecutorService.executeAutomations()` calls with HTTP calls to svc-automation. Keep both implementations alive — feature-flag the migration.

**Files:**
- New: `apps/svc-data/src/app/automation/sync-trigger-client.service.ts` — typed HTTP client
- Modified: `apps/svc-data/src/app/collection-data.service.ts:259,410,476` — three call sites switch from local executor to client
- Modified: `apps/svc-data/src/app/automation/automation.module.ts` — add client provider

**Feature flag:** `AUTOMATION_SYNC_VIA_HTTP` env var, default `false`. When `false`, the local executor still runs (existing behavior). When `true`, calls go to svc-automation. CI sets it to `true` for E2E.

**Edge cases to test:**
- Network failure — graceful degradation, NOT silent skip. Either: (a) treat as before-trigger abort with a clear "automation runtime unavailable" message, OR (b) fail the user request. Pick one and document. Don't have it skip silently — that's a worse failure mode than either alternative.
- Latency — measure P50/P99 for record creation before and after. Acceptable budget: +20 ms P50 because of the new HTTP hop. If higher, evaluate a same-process colocation deployment.
- Authz — service-to-service JWT lifecycle. Token expires? Token rotation?
- Audit log — execution log lands in svc-automation's writer, not svc-data's. Verify reports across both still aggregate correctly.

**Out of scope:** Deleting the local executor (PR 4).

**Verification:** Set the flag to `true` in dev, run the full record-CRUD E2E, compare audit log entries between flag-on and flag-off runs. Should be identical content, different `service` column.

### PR 3 — Shadow mode + contract test harness

**What:** Run BOTH paths simultaneously for one cohort of triggers, compare outputs, report drift. Two-sprint shadow window before deletion.

**Files:**
- New: `apps/svc-data/src/app/automation/shadow-comparator.service.ts` — invokes both paths, structurally compares results, logs differences as `runtime_anomaly` rows (using existing W2.D infrastructure)
- New: `apps/svc-automation/src/app/sync-trigger/contract-test.spec.ts` — table-driven test that asserts sync-trigger output matches a frozen reference for ~30 representative payloads (covers all condition operators, action types, before/after timings, cycle scenarios)

**Operational guidance:**
- Shadow runs only in non-prod and with `SHADOW_AUTOMATION=true`.
- Drift threshold: > 0.1% mismatch across a 24-hour window blocks the next PR.
- Anomalies feed the existing `runtime_anomaly` query path so on-call sees them.

**Out of scope:** Deletion. svc-data's local path is still authoritative.

**Verification:** 14-day shadow run with zero unexplained drift events. Any drift either fixes a bug in svc-automation, or is documented as intentional (and the shadow comparator updated to expect it).

### PR 4 — Delete svc-data's local runtime files

**What:** Remove svc-data's duplicate runtime code now that the HTTP path is proven.

**Files deleted:**
- `apps/svc-data/src/app/automation/automation-executor.service.ts` (+ spec)
- `apps/svc-data/src/app/automation/condition-evaluator.service.ts` (+ spec)
- `apps/svc-data/src/app/automation/script-sandbox.service.ts` (+ spec)
- `apps/svc-data/src/app/automation/action-handler.service.ts` (+ spec)
- `apps/svc-data/src/app/automation/script-api-bridge.service.ts`
- `apps/svc-data/src/app/automation/condition-validator.service.ts` — moves to svc-automation if not already there

**Files kept (for now):**
- `apps/svc-data/src/app/automation/automation.controller.ts` — REST CRUD for rules. Decided in PR 5.
- `apps/svc-data/src/app/automation/automation.service.ts` — supports the controller.
- `apps/svc-data/src/app/automation/scheduled-job.service.ts`, `scheduler.service.ts` — scheduled jobs. Decided in PR 5.
- `apps/svc-data/src/app/automation/automation-rate-limiter.service.ts` (W7.C) — used by scheduler. Decided in PR 5.
- `apps/svc-data/src/app/automation/ava-automation.service.ts` — AVA bridge. Decided in PR 5.

**Files modified:**
- `apps/svc-data/src/app/automation/automation.module.ts` — remove deleted providers
- `apps/svc-data/src/app/collection-data.service.ts` — remove `AutomationExecutorService` injection (now uses sync-trigger-client only)
- `apps/svc-data/src/app/automation/sync-trigger-client.service.ts` — flip default to call svc-automation; remove the feature flag.

**Edge cases:**
- Tenants with mid-flight automations — none should break; the HTTP path handles their requests since PR 2.
- CI/lint — service-boundary-check.ts verifies no orphan imports. Run all scanners.
- Audit log readers — verify `execution_log` queries still return results (just from a different writer service).

**Verification:** All scanners green. svc-data tests pass. No new violations in `runtime_anomaly`. Roll forward; if any regressions surface, revert PR 4 (PR 1–3 are independently safe).

### PR 5 — Relocate residual code (CRUD, scheduling, rate limiter, AVA bridge)

**What:** Decide the final home for the files PR 4 left behind. Two reasonable splits:

**Option 1:** All to svc-automation (canonical "automation runtime owns everything automation").
- Pro: Single owner. Matches the service responsibility map.
- Con: svc-automation grows by ~2,000 LoC (controllers + supporting services). Larger blast radius.

**Option 2:** Split — CRUD/AVA to svc-metadata (rules are metadata), scheduling to svc-automation, rate limiter stays where its consumer is.
- Pro: svc-automation stays focused on runtime.
- Con: AutomationRule entity ownership becomes ambiguous again.

**Recommended:** Option 1. The service responsibility map in `zippy-creek` §C explicitly lists "THE automation runtime: triggers, conditions, actions, script sandbox, cycle/depth control" as svc-automation's. Adding CRUD is a natural extension.

**Files moved:**
- `apps/svc-data/src/app/automation/automation.controller.ts` → `apps/svc-automation/src/app/rules/rules.controller.ts`
- `apps/svc-data/src/app/automation/automation.service.ts` → `apps/svc-automation/src/app/rules/rules.service.ts`
- `apps/svc-data/src/app/automation/scheduled-job.service.ts` → `apps/svc-automation/src/app/scheduling/`
- `apps/svc-data/src/app/automation/scheduler.service.ts` → `apps/svc-automation/src/app/scheduling/`
- `apps/svc-data/src/app/automation/automation-rate-limiter.service.ts` → `apps/svc-automation/src/app/scheduling/`
- `apps/svc-data/src/app/automation/ava-automation.service.ts` → `apps/svc-automation/src/app/ava/` (AVA bridge endpoint)

**API path migration:** `/api/automations/*` → `/api/automation/v1/rules/*`. Add a 410 Gone or a 6-month deprecation alias depending on integrator policy.

**Module cleanup:**
- Delete `apps/svc-data/src/app/automation/automation.module.ts`
- Remove `AutomationModule` from `apps/svc-data/src/app/app.module.ts`
- Wire new modules in svc-automation

**Verification:** Frontend integration test against the new URL paths; smoke test scheduled jobs still fire; AVA bridge end-to-end.

---

## Cross-cutting concerns

### Shadow mode infrastructure (introduced in PR 3, reused for future migrations)

The comparator pattern (run two implementations, compare results, log drift) is broadly useful. Consider extracting `libs/shadow-comparator` for future migrations. Out of scope here, but flag it.

### Rollback strategy

Each PR is independently reversible:
- PR 1 — endpoint addition is purely additive; revert by removing the module.
- PR 2 — feature flag default `false`; flip back if migration goes wrong.
- PR 3 — telemetry only.
- PR 4 — destructive but small; revert reinstates local code.
- PR 5 — moves files between services; revert via git.

The point of the sequence is that no single PR commits to a path that can't be backed out.

### Performance budget

Adding an HTTP hop to the record-write path is the riskiest move. Set a hard budget:
- Same-region service mesh latency: < 5 ms P50.
- Connection-reuse via HTTP/2 keepalive.
- If P99 record-write latency rises by > 15 ms after PR 2, **stop and re-evaluate**. Possible mitigations: gRPC instead of HTTP/JSON, in-process colocation in dev, or rejecting the migration as currently designed and instead extracting a shared library (Section S1's Option B).

### Service-to-service authz

svc-data calls svc-automation as a service, not as a user. Two valid patterns:
1. **Mint a system JWT per request**, propagating the original user's `RequestContext` as a claim. svc-automation enforces authz against the user, not the service. Preserves the user's permission view.
2. **Use a system token with `platform.bypass_authz`**, and rely on svc-data having already enforced authz. Simpler but less defensible.

Pick (1) for compliance posture. The migration in PR 1940000000000 (this PR — `platform.bypass_authz`) makes this cleaner: the service token doesn't need the bypass, the propagated user JWT carries whatever permissions the user has.

### Per-tenant rate limiting

svc-data's W7.C rate limiter is per-automation, applied at the BullMQ scheduler. After PR 5, this stays in svc-automation. Verify the limit applies to BOTH sync-trigger HTTP calls AND async outbox-consumer paths so a chatty rule can't burst through the HTTP path.

### Test coverage

Critique 5 in `zippy-creek` flagged that svc-automation's runtime had **zero spec files** — that has since been addressed (3 spec files now present). PR 1 should keep the bar high: every code path on the new sync-trigger module gets a test, and the contract-test harness in PR 3 covers the cross-service surface.

---

## Verification (whole-effort smoke test)

After PR 5 is merged:

1. **Drift check:** No file in `apps/svc-data/src/app/automation/` references `condition-evaluator`, `script-sandbox`, `action-handler`, or `automation-executor`. Verify with grep.
2. **Service-boundary scanner:** `npm run service-boundary:check` green.
3. **Contract test:** The PR 3 harness still runs against svc-automation's sole engine. Should pass identically.
4. **Audit reads:** A query for "automation executions in the last 24 hours" returns rows from svc-automation only (verify by joining audit_logs with the producing service column if present).
5. **Latency:** P50/P99 record-write latency within budget vs. baseline.
6. **Customer pack regression:** A representative pack with sync triggers + scheduled jobs + AVA-driven automations installs and runs cleanly on a fresh instance.

---

## Open questions to resolve before PR 1

1. **Authz pattern for service-to-service calls** — propagated user JWT (option 1) vs. system token (option 2). Recommendation above is option 1; needs founder/security signoff.
2. **HTTP vs gRPC** — JSON HTTP is simpler; gRPC is faster and has stricter contracts. Default to HTTP unless P99 latency in PR 2 forces the switch.
3. **API URL strategy for PR 5** — hard cutover to `/api/automation/v1/rules/*` or 6-month alias? Depends on whether any external integrator hits `/api/automations/*` today.
4. **Where AutomationRule lives in the entity barrel after PR 5** — Plan Fix 24 (per-service entity sets) reorganizes the `instance-db` barrel. If Plan Fix 24 ships first, AutomationRule moves to a `libs/automation-entities` package owned by svc-automation. If this fix ships first, the entity stays in the shared barrel for now.

---

## Why not just extract a shared library?

The `zippy-creek` plan's Critique 1 mentions Option B: "extract a shared `@hubblewave/automation-runtime` library and ban duplication via the compliance scanner." This was considered and rejected as the primary approach because:

- A shared library still leaves **two execution sites** (svc-data process and svc-automation process), so audit logs still get written by two services and the "which engine ran this?" question persists.
- Distributed monolith risk: every consumer of the library can drift in *how* they invoke it.
- The canon's §3 ("platform, not application") implies clean service ownership, which a shared library undermines.

A shared library is, however, a reasonable **fallback** if PR 2's latency budget proves untenable. In that case: extract `libs/automation-runtime`, both services still call it locally, but svc-data's executor is replaced with a thin wrapper that just calls library functions identically to how svc-automation does. The drift problem is solved; the dual-writer problem remains. Worse than full consolidation, better than today.

---

## Out of scope

The following are real concerns but **not** part of this fix:

- **Plan Fix 24** (per-service entity sets) — the `AutomationRule` entity stays in the shared barrel until that fix lands.
- **Plan Fix 16** (AVA proposal state machine enforcement) — handled by W6.C.
- **Per-tenant HTTP rate limiting** — broader than automation; needs its own design doc.
- **Cross-service saga / compensating-action framework** — needed eventually for "create record + run automation + send notification" atomicity, but a separate concern.
- **DLQ for BullMQ failures** — Critique 9 in `zippy-creek`; separate fix.

---

## Acceptance criteria (the "done" definition)

- One automation runtime, in one service.
- One condition evaluator, in one service.
- One script sandbox, in one service.
- All sync triggers route through `POST /sync-trigger` to svc-automation.
- All async triggers route through the outbox consumer in svc-automation.
- `apps/svc-data/src/app/automation/` is either empty or contains only a thin sync-trigger client.
- The `service-boundary` scanner enforces that no service other than svc-automation writes to `AutomationRule` or `AutomationExecutionLog`.
- The CLAUDE.md amendment in §1 mentioning "Plan Fix 1 (automation consolidation)" is **deleted** (the deferred-offender entry is gone because the offender is gone).
