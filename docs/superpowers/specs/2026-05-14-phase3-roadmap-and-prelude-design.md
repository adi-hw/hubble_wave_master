# Phase 3 Roadmap + Prelude Detailed Design

**Status:** Approved baseline, ready for execution planning.
**Date:** 2026-05-14
**Audience:** Founder, core engineers, AI coding agents working on Phase 3.
**Scope:** Phase 3 = the architectural moat. This document governs sequencing for W2–W5 and provides full detailed design for the Phase 3 Prelude. Each subsequent wave (W2, W3, W4, W5) gets its own brainstorm → spec → plan cycle when reached.

---

## Context

Phase 1 (architectural reshape: 11 svc-* services → modular monolith `apps/api` + `apps/control-plane`) and Phase 2 (canon §28 authorization + §29 identity + W5 audit-in-transaction + W6 perf hardening) are complete and smoke-tested green as of 2026-05-14.

Phase 3 is the architectural moat: customization layer, Workspaces, UI Builder, plugin SDK, mobile foundation, upgrade validator, platform analytics, AI Code Assistant. Per founder direction, Phase 3 contains **W2–W5 at full scope** with no deferred items and no compromises. W6 demo, W7 pre-launch hardening, W8 pilot, and the Clinical/Facilities Asset Management vertical pack resume after W5 passes its exit criterion.

This document is the governing roadmap. It also fully designs the Phase 3 **Prelude** — a deterministic-baseline restoration wave that runs before W2 starts.

---

## Cross-wave rules

These rules apply to every Phase 3 wave, not just the Prelude.

### Platform Reduction Rule

Every wave must reduce obsolete code, routes, modules, migrations, feature flags, and dead abstractions left by prior designs. Phase 3 is explicitly NOT additive-only. Each wave's exit criteria include a deletion ledger entry. Canon §14 ("delete ruthlessly") and canon §2 ("exactly one obvious way") apply continuously.

### Learning-Revises-Plan Rule

Each wave may revise downstream wave assumptions based on validated learning from the completed wave. If W2 reveals that plugin contracts need different auth semantics, or W3 reveals that metadata boundaries need different runtime primitives, then W3/W4/W5 evolve intentionally — not forced to adhere to a stale earlier plan. This protects against roadmap rigidity.

### Estimates are internal anchors, not external commitments

Each wave is gated by exit criteria, not calendar. Internal effort estimates are provided as planning aids only.

### Enforcement

Violations of any cross-wave rule require explicit founder approval documented in the PR. This converts the rules from philosophical guidance into operational escalation requirements.

---

## Phase 3 wave roadmap

| Wave | Name | Rough effort | Exit criterion (the real gate) |
|---|---|---|---|
| **Prelude** | Clean Foundation | 1–2 weeks | "Fresh database boot produces only valid platform experiences and a deterministic runtime baseline." Empty DB → migrations → boot succeeds with no bridge code, no hidden runtime assumptions, no stale module metadata, no orphaned navigation, no dead feature flags, no invalid routes/buttons/screens, no manual post-migration intervention. Smoke checks reproducible end-to-end. |
| **W2** | Platform Integrity | 4–5 weeks | "Platform auth, session, and audit model internally trustworthy." Plus: "Authorization, identity, audit, and search boundaries are enforced consistently across backend, frontend, APIs, search, and service-to-service calls." W2 is fundamentally a boundary-consistency wave. |
| **W3** | Shared Platform Runtime + SDK Foundation | 4–5 weeks | "Stable extension/runtime contract exists, with explicit compatibility commitments." Plugin SDK reachable to a customer plugin author via a typed, versioned API. Locks: semantic versioning policy, deprecation lifecycle, compatibility guarantees (canon §25 N=2 major version commitment), extension isolation model, SDK capability permission model. |
| **W4** | Customization Platform + Workspaces + UI Builder | 8–10 weeks | "Metadata customization layer production-capable, with metadata execution safety." Workspaces, full UI Builder, customization persistence model, upgrade-safe extension boundaries, runtime dependency graph, validator hooks. Plus safety primitives: metadata validation, sandbox/runtime safety model, dependency cycle prevention, customization execution boundaries, workspace/layout migration compatibility. |
| **W5** | Differentiation Layer | 6–8 weeks | "Differentiation systems operational, with platform intelligence cleanly separated from LLM-assisted features." Two tracks: (1) deterministic platform intelligence — upgrade validator (canon §13), telemetry-driven operational recommendations, operational intelligence, admin observability. (2) LLM-assisted features — AI Code Assistant (canon §11), assistant orchestration, LLM-assisted workflows. Platform analytics infrastructure spans both tracks. |

### Scope outlines per wave

Level-2 outlines only. Each is brainstormed in full when its wave starts.

**Prelude.** Schema-split completion + entity decorator annotations; migration cleanup; fresh-DB rebuild validation; obsolete module/screen/button/route removal; AbacGuard rollback to opt-in formalized; PermissionsGuard duplicate-implementation removal + transitional posture; bridge-code removal (`search_path`, etc.); seed-data cleanup; navigation cleanup; build/runtime smoke tests reproducible. Detailed design in the next section.

**W2 — Platform Integrity.** Authorization correctness (verify F003/F004/F005/F006 post-Phase-2); explicit deny rules; field masking; frontend authz enforcement (F091); search pre-filter authz consistency (verify F136 across Typesense + pgvector); JWT/session architecture (F002 JWT revocation, F013 stale roles); refresh token families (F001 verify); JWKS/KMS; service identity (F022 verify); RequestContext discriminated union; audit transaction correctness (F042 hash chain concurrency, F052 AVA chat txn); audit explainability; 403 handling on frontend (F102); permission invalidation (F025); boundary consistency across backend/frontend/APIs/search/service-to-service; service-to-service authorization provenance.

**W3 — Shared Platform Runtime + SDK.** Shared runtime cleanup; `@hubblewave/plugin-sdk` with semantic-versioning policy, deprecation lifecycle, compatibility guarantees, extension isolation, SDK capability permission model; frontend consolidation; mobile foundation (React Native + Expo + WatermelonDB Day 1 per canon §26); metadata contracts; extension APIs; runtime boundaries; event contracts; component registry.

**W4 — Customization Platform.** Metadata-driven layout engine; workspace runtime; page composition engine; customization persistence model (canon §17.5); upgrade-safe extension boundaries; runtime dependency graph; validator hooks (architecture lands here); metadata validation; sandbox/runtime safety model; dependency cycle prevention; customization execution boundaries; workspace/layout migration compatibility.

**W5 — Differentiation Layer.** Track A (deterministic): upgrade validator (canon §13), telemetry-driven operational recommendations, operational intelligence, admin observability. Track B (LLM-assisted): AI Code Assistant (canon §11), assistant orchestration, LLM-assisted workflows. Platform analytics infrastructure spans both.

### Out of scope for Phase 3

Resumes after W5 passes its exit criterion:

- W6 demo build
- W7 pre-launch hardening
- W8 pilot
- Vertical pack (Clinical/Facilities Asset Management)

---

## Phase 3 Prelude — detailed design

### Prelude Freeze Rule

*No new feature development lands during Prelude except fixes required to complete Prelude exit criteria.* The cleanup wave protects itself from re-destabilization — if a non-Prelude PR opens during this window, it is labeled `prelude-freeze-queued` and queues until the exit criterion verifiably holds. Nothing else merges to master during Prelude.

### Prelude non-goals

Prelude does **NOT**:

- Redesign authorization (that's W2).
- Redesign SDK / runtime contracts (that's W3).
- Introduce new customization primitives (that's W4).
- Introduce new AI features (that's W5).
- Optimize prematurely (no performance work unless it's a regression blocking the validation harness).

**Refactor scope is also constrained:** Prelude may refactor existing implementations only insofar as required to satisfy deterministic-baseline goals. Refactors that exceed that scope are stealth redesigns and get `prelude-freeze-queued` like any other non-Prelude work.

This non-goal list is enforceable: any PR opened during Prelude that touches W2/W3/W4/W5 concerns gets `prelude-freeze-queued` regardless of how the author labels it.

### Prelude preservation boundaries

Prelude is deletion-focused, but deletion without preservation boundaries destabilizes approved foundations. Prelude **preserves**:

- Existing canonical API contracts unless invalid or broken.
- Approved Phase 2 authorization, identity, and audit architecture direction (canon §28 + §29 + audit-in-transaction).
- Current modular-monolith topology (`apps/api`, `apps/control-plane`, `apps/worker`, `apps/web-client`).
- Existing W2/W3/W4/W5 sequencing assumptions unless explicitly revised under the Learning-Revises-Plan Rule and documented in a roadmap amendment.

If a deletion candidate touches one of these preservation boundaries, it is escalated for explicit founder approval and documented in the PR — same posture as a cross-wave rule violation.

### Wave goal

Establish a deterministic runtime baseline by completing the schema split, removing every compatibility shim from the Phase 1/2 transition, and deleting obsolete product surfaces. Post-Prelude, the master folder represents the current product — not the history of abandoned experiments.

### Exit criterion

*"Fresh database boot produces only valid platform experiences and a deterministic runtime baseline."*

Empty DB → migrations → boot succeeds with no bridge code, no hidden runtime assumptions, no stale module metadata, no orphaned navigation, no dead feature flags, no invalid routes/buttons/screens, no manual post-migration intervention. Smoke checks reproducible end-to-end.

### Work streams

Four streams, each with its own deletion ledger entry (per the Platform Reduction Rule).

#### Stream 1 — Schema Model Finalization (heaviest, ~50% of Prelude effort)

**Entity decorator updates:**

- Inventory every `@Entity()` in `libs/instance-db/src/lib/entities/*`, `apps/api/src/app/**/*.entity.ts`, and `apps/control-plane/src/app/**/*.entity.ts`.
- For every entity whose table moved into a domain schema (per the `1940*` migration manifest), convert `@Entity('users')` → `@Entity({ name: 'users', schema: 'identity' })`. Match the migration's source-of-truth schema assignment.

**Migration commits + cleanup:**

- Commit the `1940000000000`–`1942000000000` migration files (currently untracked).
- Inventory each migration for validity. Delete abandoned/duplicate/draft files.
- Reversibility is required unless the migration is explicitly marked irreversible with documented rationale (in the migration's class doc comment).

**Bridge removal:**

- Remove the `search_path` clause from `libs/instance-db/src/lib/instance-db.module.ts`. Once entities are explicit, the bridge becomes incorrect (hidden coupling).
- Keep `scripts/datasource-instance.ts` and `scripts/seed-admin-user.ts` schema-qualified.

**New scanners (written before the entity edits; used as CI gates):**

- `tools/scanners/entity-schema-ownership-check.ts`: fails if any `@Entity()` declares a schema other than the one the migration manifest assigns to that table.
- `tools/scanners/cross-domain-import-check.ts`: fails if an entity in one domain (e.g. `identity`) imports an entity from another domain (e.g. `metadata`) outside an explicit allowlist. Allowlist at `tools/scanners/cross-domain-allowlist.json`; every entry requires `rationale` + `addedBy` + `addedAt`.

**Migration policy (locked, becomes permanent rule):**

- No migration may depend on implicit `search_path` behavior. Migrations must use schema-qualified identifiers everywhere.
- Migration filenames standardized: `<14-digit-timestamp>-<kebab-case-name>.ts`, chronological.
- Forbidden tokens in migration filenames: `temp`, `fix`, `final`, `final-final`, `retry`, `smoke`, `wip`, `draft`. `tools/scanners/migration-filename-check.ts` enforces this on `migrations/instance/*` and `migrations/control-plane/*`.

**Stream 1 verification:** empty DB → `npm run migration:run:instance` → no errors → every domain schema present → every entity's runtime query targets the schema declared in its `@Entity({ schema: ... })` decorator (verified by matching `SELECT schemaname, tablename FROM pg_tables` against the entity manifest) → both new scanners pass → migration filename scanner passes.

#### Stream 2 — Compatibility Shim Removal

Order: shim cleanup first establishes context; auth rollout policies then read as architectural policy rather than incidental cleanup.

**Misc shims:**

- **Vite proxy:** strip rewrites stay (dev convenience) but commented as transitional until web client's `VITE_*_API_URL` defaults align with apps/api's unified URL space (later wave).
- Audit `tools/dead-code-allowlist.json` for entries now deletable.
- Sweep `KNOWN_DEFERRED_OFFENDERS` lists in `tools/*.ts` for entries that can close.
- Delete `scripts/generate-local-dev-secrets.ts` if it predates canon §29.9 ES256.

**PermissionsGuard direction (locked):**

- The duplicate guard at `apps/api/src/app/identity/auth/guards/permissions.guard.ts` is **deleted**.
- The canonical guard at `libs/auth-guard/src/lib/permissions.guard.ts` is the only `PermissionsGuard`. Identity module imports it from the lib.
- **Terminal architecture posture:** deny-by-default once the annotation rollout completes. Annotations are `@RequirePermission` / `@Roles` / `@Public` / `@AuthenticatedOnly`.
- **Transitional rollout posture:** coverage-tracked transitional allow posture stays. A `tools/scanners/permissions-annotation-coverage.ts` scanner inventories every `@Controller()` handler and reports which are missing an annotation. The coverage report is a tracked artifact (`docs/permissions-rollout-coverage.md`); the deny-by-default flip is gated by that report reaching 100%.
- This transitional state is explicitly not acceptable long-term — it is tracked toward a known terminal state.

**AbacGuard direction (locked):**

- Stays opt-in (removed from `APP_GUARD`, applied per-controller via `@UseGuards(AbacGuard)` where ABAC is configured).
- New scanner `tools/scanners/abac-coverage-check.ts`: every controller method on a class that has `@UseGuards(AbacGuard)` MUST have a valid `@AbacResource` / `@SkipAbac` / `@Public` / `@AuthenticatedOnly`. Fail-CI if missing.
- Global wiring is **not** restored in Prelude; it returns only when the full annotation rollout completes (post-W2 at earliest).

#### Stream 3 — Obsolete Product Surface Removal

User-approval gate: every candidate goes onto a single deletion-ledger PR. User approves the list before any deletion lands. Deletion ledger entries must include rationale and replacement state (if any).

**Backend modules / controllers / DTOs:**

- `apps/api/src/app/instance-api/identity/auth/identity-auth-alias.controller.ts` (redundant once Vite proxy strip is canonical).
- `phase7/*` controllers if not part of canonical product per canon §11.
- Any svc-* remnants.
- Orphaned DTOs — every DTO file with no remaining importer.
- Unused API schemas (Swagger/OpenAPI definitions for routes that don't exist).
- Stale generated clients/types (anything under `libs/api-clients/` or similar that targets deleted endpoints).

**Frontend surfaces:**

- Web-client routes pointing to deleted/abandoned pages.
- Web-client calls to `/api/openapi/spec` if there's no producer.
- Phase7 UI screens if backed by stub controllers.
- Unused SDK exports — anything exported from `@hubblewave/*` libs that no consumer imports.
- Abandoned hooks / providers / stores in `apps/web-client/src/**`.

**Navigation / actions / flags:**

- Menu items pointing to nonexistent routes.
- Sidebar entries for deleted modules.
- Any `feature.*` flag for designs not in current scope.

**Seed / migration data:**

- `scripts/seed-platform-knowledge.ts` if it points to anything no longer real.
- Navigation seed rows for deleted modules.
- Abandoned/duplicate migrations from Stream 1 inventory.

**Repository hygiene (operationalizing "master folder represents the current product"):**

- No `.bak`, `.old`, `.tmp`, `.disabled` files anywhere. Scanner enforces.
- No commented-out abandoned implementations. Block comments wrapping dead code are deleted, not preserved.
- No duplicate controllers / services kept "just in case." Pick one, delete the others.
- No dead environment variables in `.env.example` or `scripts/setup.ts` (variables not referenced by any code).
- No dead `docker-compose.yml` services (containers no one starts).

#### Stream 4 — Validation Harness

Reproducible script `scripts/prelude-validate.ts`:

**Happy path:**

- `docker-compose down -v` → fresh containers.
- `docker-compose up -d` → wait for healthy.
- All migrations run.
- Admin seed runs.
- `apps/api` starts → no `ERROR` or `WARN` from known transitional bridges in stdout.
- `curl POST /api/auth/login` → 201 + valid JWT.
- `curl GET /api/users` with admin token → 200.
- `curl GET /api/health` → 200.
- Canonical module-load endpoints all return 200/401/404 as expected.

**Negative cases (Prelude validates absence of transitional state, not only success):**

- Unauthorized call to a protected route returns proper 401/403 (not 500, not 200).
- Deleted/removed routes return 404 (not 500).
- Navigation seed contains zero entries pointing to deleted modules.
- Zero references in the codebase to feature flags marked stale/abandoned.
- No startup warnings/errors from known transitional systems unless explicitly tracked in rollout coverage artifacts.

**CI hook:** run `prelude-validate.ts` on every PR that touches `migrations/`, `libs/instance-db/`, any `*.entity.ts`, `apps/api/src/app/identity/auth/guards/`, or scanner files. Pass = required status check.

Smoke reproducibility: zero manual `psql` interventions, zero "edit `.env` then restart" steps.

### Order of execution

```
Stream 1 (Schema)  ─▶  Stream 2 (Shims)  ─▶  Stream 3 (Obsolete)  ─▶  Stream 4 (Validation)
   ~3-4 days           ~1-2 days              ~2-3 days                ~1 day
```

Streams 1 and 2 must complete before Stream 3 because the schema state determines what queries to seed data look like, and shim decisions determine which routes/guards remain. Stream 4 validates the end-to-end result before W2 starts.

### Scanner conventions

Prelude introduces several new scanners. To prevent scanner-as-random-one-off-script drift, all Prelude scanners (and every scanner added in later waves) follow these conventions:

- All scanners exit non-zero on violation.
- All scanners support CI mode + local mode (local mode prints summaries; CI mode emits structured output for status checks).
- All scanners emit both machine-readable JSON (to a known stdout/stderr stream or file path) and human-readable summaries.
- Scanner allowlists require `rationale` + `addedBy` + `addedAt` per entry. Bare entries without these fields fail the scanner.
- Scanners live under `tools/scanners/*`. Older scanners at `tools/*.ts` migrate to this location as part of the Prelude or W2 work, depending on which is least disruptive.
- Prelude scanners become permanent CI gates unless explicitly retired via a documented amendment in this spec or a successor.

### Commit conventions

All Prelude commits use the prefix `phase3-prelude:` for archaeology. Specific atomic-commit messages already standardized:

- Stream 1 atomic commit: `phase3-prelude: finalize schema split and remove runtime bridge`
- Stream 3 deletion commit: `phase3-prelude: remove obsolete product surfaces`

Other Prelude commits follow the same prefix with a short descriptive suffix (e.g. `phase3-prelude: introduce entity-schema-ownership scanner`, `phase3-prelude: delete duplicate PermissionsGuard implementation`).

### Definition of done

Prelude is done when **all four** are true:

1. Fresh DB rebuild via `prelude-validate.ts` succeeds with no manual steps — happy path AND every negative case asserted.
2. No Prelude-scoped allowlist or deferred-offender entry remains in any scanner. (Relabel-vulnerable wording such as "marked followUp: 'W2' or earlier" is explicitly avoided.)
3. Every uncommitted or transitional Phase 1/2 artifact is either committed (real fix) or deleted (was a bridge). Already-committed but still transitional artifacts are included in this scope.
4. The Section "Exit criterion" verifiably holds — independent boot, no bridge code, no orphaned navigation, no WARN-level transitional startup lines unrelated to the annotation rollout.

### Risks

- **Stream 1 risk:** ~130 entity files touched — high mechanical-error surface. *Mitigation:* write `entity-schema-ownership-check.ts` + `cross-domain-import-check.ts` FIRST, then do entity edits with both scanners green at each commit.
- **Stream 3 risk:** "obsolete" is subjective. *Mitigation:* every deletion candidate goes onto a single deletion-ledger PR; user approves the list as a single batch; deletions land in one atomic commit ("Phase 3 Prelude: remove obsolete product surfaces").
- **Bridge-removal risk:** removing the `search_path` bridge while entity decorators are partially updated will crash boot. *Mitigation:* Stream 1 is atomic — entities + migration commits + `search_path` removal land in one commit, validated in the same CI run.
- **Freeze violation risk:** non-Prelude PRs queued during the freeze can stack up and create merge pressure. *Mitigation:* any PR opened during Prelude is labeled `prelude-freeze-queued`; nothing merges to master that's not Prelude-scoped.

---

## References

- `CLAUDE.md` — HubbleWave Master Canon. Authoritative on rules.
- `docs/superpowers/PLATFORM-ROADMAP.md` — predecessor roadmap (will be updated to point at this document as governing baseline post-approval).
- `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` — approved architectural spec (W2–W8 originate there).
- `docs/superpowers/RESUME-CONTEXT.md` — Phase 1/2 completion summary.
- Memory: `phase1_2_smoke_bridges.md` — the seven uncommitted bridging fixes that Prelude resolves.

---

**Document status:** Approved baseline. Section 1 (Phase 3 roadmap) is frozen as the governing wave sequence. Section 2 (Prelude detailed design) is the next wave's execution scope. Next step after user review of this file: invoke `writing-plans` skill to produce the Prelude implementation plan.
