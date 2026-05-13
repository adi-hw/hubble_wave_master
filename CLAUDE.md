# HubbleWave Master Canon
## Architecture, Product, Design, and Enforcement Authority

**Status:** Canonical Source of Truth  
**Scope:** Full Platform (Instance + Control Plane)  
**Audience:** Founder, Core Engineers, AI Coding Agents, Senior Architects  
**Intent:** This document defines what HubbleWave *is*, *how it is built*, and *how compliance is enforced*.

If any implementation (human or AI-generated) conflicts with this document, the implementation is invalid and must be corrected.

---

# PART I — FOUNDERS ARCHITECTURE MANIFESTO (PRESCRIPTIVE)

## 1. This Is a Brand-New Platform

HubbleWave is a **greenfield platform**.

It is not:
- a migration,
- a rewrite,
- a compatibility layer,
- a phased replacement.

### Absolute Rules
- No references to V1, V2, legacy systems, migrations, or predecessors
- No comments such as:
  - “temporary”
  - “replace later”
  - “for now”
  - “legacy workaround”
- No TODOs, FIXMEs, commented-out code, or dead branches
- No speculative scaffolding or placeholder abstractions

All code must be written **as if it is deploying to production today**.

If something is not production-ready, it does not belong in the codebase.

**Implementation status (W6.A, updated post-Plan-Fix-1):** The "no
TODO/FIXME/dead code" rule is enforced for NEW code via lint + the
compliance scanner. Pre-existing violations are tracked explicitly:
- `tools/audit-bypass-check.ts` KNOWN_DEFERRED_OFFENDERS list (currently
  empty after W2.E)
- `tools/service-boundary-check.ts` KNOWN_VIOLATIONS list (currently
  empty after W5.D)
- `libs/instance-db/src/lib/entities/index.ts` is acknowledged as a
  "god-package" pending Plan Fix 24 (per-service entity sets)

Plan Fix 1 (automation consolidation) is complete: svc-data's
`automation/` directory now contains only a thin HTTP client; the
runtime, scheduling, AVA bridge, and CRUD all live in svc-automation.

The rule applies to GREENFIELD code; legacy cleanup is tracked in the
remediation backlog rather than allowed to bypass the rule via TODO
comments. Engineers MUST NOT introduce new TODOs/FIXMEs; every
exception must be an explicit allowlist entry in a CI scanner.

---

## 2. Code Is a Product Surface

The codebase is a user-facing artifact.

Therefore:
- Naming must be intentional, final, and domain-correct
- APIs must be explicit, stable, and boring
- Comments explain *why*, never *what*
- There must be exactly one obvious way to accomplish a task

Ambiguity is architectural debt.

---

## 3. Platform, Not Application

HubbleWave is not an application.
It is a **general-purpose enterprise platform**.

Applications (EAM, Facilities, Ops, Compliance) are composed *on top* of the platform.

If something only works for one application, it is suspect by default.

---

## 4. Metadata Is the Product

Everything that can be expressed as metadata **must be expressed as metadata**:
- Collections
- Properties
- Forms
- Views
- Access rules
- Automation
- Navigation
- Validation

Hardcoded business logic is architectural failure.

---

## 5. Single-Tenant Default + Pooled Mode Optional (canon §5 SOFTEN, 2026-05-09)

Customer isolation is architectural, with two supported deployment modes.

### Default: per-customer instance (single-tenant)
For paying production customers, each instance is fully dedicated:
- Own Nest API process
- Own BullMQ worker process
- Own Postgres database
- Own Redis instance

This is the default and is what every paying customer's procurement should expect.

### Optional: pooled mode (multi-tenant via Postgres RLS)
For free trials, sales demos, internal dev/staging, lower-tier customers, and future ISV-marketplace test environments, multiple tenants share infrastructure isolated by Postgres Row-Level Security (RLS) policies keyed on `tenant_id`.

In pooled mode:
- Every database query carries a `tenant_id` (or its equivalent)
- Postgres RLS policies enforce cross-tenant isolation at the SQL layer
- Per-tenant cross-tenant-leak tests run in CI
- Audit and identity continue to function exactly as in single-tenant mode

Both modes use the same source code; only deployment topology differs.

### Implementation requirements (binding on all instance services)
- All data access must include tenant context. Use `RequestContext.tenantId` for the active tenant.
- All Postgres tables that hold tenant-scoped data carry RLS policies (enabled in pooled mode; the policy is trivially `USING (true)` in single-tenant mode).
- Tests must run in both modes (single-tenant fixture + pooled fixture) to catch isolation leaks.

### Scope clarification
This rule applies to the **Customer Instance Plane** — the runtime environment customers use. The **Control Plane** (Part II §18) is a traditional multi-tenant SaaS application by design.

**Spec reference:** `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §6.3 (data isolation) and §9 (canon delta).

---

## 6. Schema Before Data

Tables store data.
Schemas define meaning, behavior, governance, and UI.

No schema → no table.
No property → no column.

---

## 7. Views Are First-Class (canon §7 SOFTEN, 2026-05-09)

Views are governed projections of data for specific audiences. The 5-tier hierarchy (System → Tenant → Role → Group → Personal) of the original §7 is dropped in favor of two hierarchy levels:

- **Customer-namespaced views** — defined in customer pack metadata; scoped to the customer's tenant.
- **Role views** — bound to one or more customer-defined roles; visible to users with those roles.
- **Personal views** (per-user) — owned and edited by the individual user; saved layout, filter, and column choices.

System and Tenant tiers are subsumed by "platform-default views" (shipped in vertical packs) and "customer-namespaced views" respectively. The simpler model covers all observed use cases without the governance overhead.

Views are stored as pack metadata and subject to the upgrade-safety validator.

---

## 8. Automation + Workflow are One Engine (canon §8 INVERT, 2026-05-09)

The ServiceNow split between Flow Designer (durable, human-aware) and Workflow (deterministic, synchronous) is a tax we don't pay. HubbleWave's automation engine has two **modes** in one engine:

### Rule mode — synchronous, record-scoped, deterministic
- Trigger types: before/after record events, manual, scheduled, webhook
- Conditions in the platform's formula language
- Actions: record CRUD, send email/SMS, call HTTP, run sandboxed script
- Cycle and depth control; per-rule rate limiting (W7.C remediation work, preserved)

### Workflow mode — durable, multi-day, stateful
- State persistence in Postgres
- Human task assignment, approvals, escalations
- Parallel branches, joins, loops
- SLA timers

One visual editor (using `@xyflow/react`) authors both. One sandbox (`script-sandbox`) executes scripted actions in either mode. One execution log captures both runtimes.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §4.1 automation engine + §9 canon delta.

---

## 9. Authorization Is Centralized

All data access flows through:
RBAC + ABAC + row-level + field-level rules.

There are no shortcuts.
Ever.

**Resolution model:** §28 specifies the operational semantics — precedence
matrices, deny-wins, row-gating, masking direction, explainability,
admin-bypass commitment. §9 is the principle; §28 is the contract.

**Implementation status (post-W1.2 + W1.5 + W5.D):**
- Global guard wiring (W1.2): EVERY NestJS service runs JwtAuthGuard +
  RolesGuard + PermissionsGuard via APP_GUARD providers. `@Roles()` /
  `@Permissions()` decorators are no longer inert.
- Centralized authz (W1.5): all callers use the `*Collection` API on
  AuthorizationService keyed by stable `collectionId` UUID. The
  deprecated `*Table` API throws NotFoundException on resolution failure
  — never returns empty rules (no fail-open).
- CI scanners enforce: `authz:check` (call-site verification, W1.2
  upgrade), `service-boundary:check` (W5.D, currently 0 violations).

The rule's spirit holds: shortcuts are forbidden. Past gaps where
decorators were inert (e.g. theme.controller.ts pre-W1.2) are closed.
But "Ever." in the literal sense requires every change to keep these
gates green — no allowlist additions to `authz-bypass-check.ts`'s
deferred list, and no `@Public()` additions without explicit operator
review.

---

## 10. Auditability Is Mandatory

Every action must be explainable:
Who did what, when, why, and under which permission.

Auditability is not optional or configurable away.

**Implementation requirement (W1.6 + W2.D + W3.C):** Audit log writes
MUST occur in the same database transaction as the action they audit.
Use the `withAudit(dataSource, fn)` helper in `libs/instance-db`. The
CI scanner `tools/audit-bypass-check.ts` (npm run audit:check) flags
save-then-audit patterns outside transactions and fails the build.

A failed action cannot leave a successful audit row, and a failed
audit cannot leave a successful action. Both commit or both roll back.

Silent skips (logger.warn followed by `continue`) are also auditability
violations. They MUST also write a `runtime_anomaly` row via
`RuntimeAnomalyService` so operators can query and alert on them.

---

## 11. AI is a Richly-Integrated Feature Surface (canon §11 SOFTEN, 2026-05-09)

AVA is not a chatbot. AVA is a feature surface wired into every workspace and authoring tool:

- **Conversational assistant** in every workspace (permission-aware retrieval)
- **Natural language search** (vector + keyword hybrid)
- **AI authoring assist** — drafted automation rules, views, workspaces, schema changes from natural language
- **Document AI** — parse equipment manuals, recall notices, regulatory documents
- **Voice work order completion** (mobile, on-device speech-to-text)
- **Image analysis** (mobile + web; asset identification, fault detection, damage assessment)
- **Predictive maintenance** (per-customer ML models)
- **Smart triage** (incoming work order categorization)
- **Anomaly detection** (equipment readings flagged proactively)
- **AI Code Assistant** — Cursor/Copilot-style help for plugin authoring, formula editor, automation script editor, integration adapter authoring, workspace builder, analytics query builder. Direct competitor to ServiceNow's Now Assist for Creators.

AVA is implemented as a Nest module (`ai`) inside `apps/api`, NOT as a separate service or runtime layer. Pluggable LLM provider per customer (Ollama for dev/local; production providers chosen per customer with their BAA).

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §4.1 AVA + AI Code Assistant.

---

## 12. Trust is Earned Per AI Feature (canon §12 PER-FEATURE, 2026-05-09)

Each AI capability the customer enables for autonomous action progresses through:

> Suggest → Preview → Approve → Execute → Audit

The progression applies **per AI feature**, not platform-wide. A customer may enable "AVA can auto-triage low-urgency work orders" (configured for autonomous Execute) while keeping every other AI feature in Suggest-only mode.

By default, all AI features ship in Suggest mode. Customer admin must explicitly configure each feature for higher trust levels. Every AI suggestion (and every autonomous action) is logged with prompt, model, version, response, applied/rejected status — the Audit stage is always-on.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §4.1 AVA + §9 canon delta.

---

## 13. Upgrade Safety Is Required

Customizations must survive upgrades.

If a change breaks customer configuration, it does not ship.

**Implementation status (W6.A):** This rule is currently CONVENTION-BASED.
There is no automated upgrade-compatibility scanner that compares a
proposed schema/metadata change against a representative customer
configuration set and blocks the change if it breaks any. The
remediation backlog tracks this as a future addition (no plan-fix
number yet; flagged here for human prioritization).

In the meantime, engineers MUST manually verify that schema changes,
property renames/deletes, and view changes do not break:
1. Existing customer pack configurations (test-deploy a representative
   pack before merging)
2. Active automation rules (the W2.A reference scanner now blocks
   property deletes if any automation references them)
3. Active formulas, views, forms (same scanner)

The W2.A reference scanner is the closest existing safeguard and
catches the most common upgrade-breaks at metadata-change time.

---

## 14. We Delete Ruthlessly

Dead code is technical debt.
Deletion is architectural hygiene.

**Implementation requirement (W2.A):** When deleting metadata
(properties, collections, views, automations, forms, validation
rules), the platform MUST scan for downstream references and refuse
the delete if any exist, surfacing a structured "in-use" error with
the full reference list. Use `PropertyReferenceScanner` in
`apps/svc-metadata/src/app/property/`. A force-delete escape hatch
exists for explicit operator override.

This rule does not apply to ephemeral or system-only data (logs,
caches, sessions) — only to user-authored metadata that other parts
of the platform may depend on.

---

## 15. Speed Never Justifies Decay

Short-term velocity never outweighs long-term correctness.

---

## 16. This Manifesto Is Law

When disagreements arise, this document decides.

If change is required, the manifesto is amended explicitly — never bypassed silently.

— HubbleWave Founder

---

# PART II — PLATFORM ARCHITECTURE (COMPLETE)

## 17. High-Level Architecture (canon §17 UPDATE, 2026-05-09)

HubbleWave consists of two strictly separated planes:

1. **Control Plane** — multi-tenant HubbleWave-owned service (`apps/control-plane`) that provisions, upgrades, monitors, and bills customer instances.
2. **Customer Instance Plane** — the runtime platform used by customers. Each customer instance is a single Nest API process (`apps/api`) plus a single BullMQ worker process (`apps/worker`), backed by per-customer Postgres + Redis (single-tenant default, canon §5).

Clients:
- `apps/web-client` — main React web client (consumed by all platform users)
- `apps/web-control-plane` — HubbleWave admin console
- `apps/mobile` — React Native + Expo, offline-first (canon §26)

The instance API is a **modular monolith** (NestJS modules: kernel, db, identity, audit, metadata, data, automation, views, forms, dashboards, notifications, integrations, ai, packs, plugins, upgrade, storage, search). Module boundaries are the natural seams for future service extraction *if and when* a specific module hits a real performance ceiling — but the platform commits to the monolith shape for the first 10–20 customer instances.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §2.

---

## 17.5. Customization Contract (canon §17.5 NEW, 2026-05-09)

**Customer customizations are versioned, namespaced, and validated against platform-API versions. No customization may modify platform schema. Upgrades are blocked when customer customizations would break.**

Concretely:
- All customer-defined collections, properties, relationships, automations, views, forms, dashboards, plugins, and integrations live in customer-namespaced metadata or customer-namespaced tables (`cust__{pack_id}__{collection_id}`) or JSONB extension columns on platform tables.
- Customer customizations declare a `targetPlatformApiVersion` in their pack manifest.
- Pre-upgrade validator (W5) inspects every installed pack against the new platform version and classifies the upgrade as green / yellow (auto-migrate) / red (manual remediation).
- If validator output is green, the upgrade is architecturally guaranteed safe — no customization can break at runtime.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §5 (customization architecture, the moat).

---

## 18. Control Plane Architecture

### Purpose
The Control Plane exists to:
- manage customers and subscriptions,
- provision and lifecycle-manage instances,
- enforce licensing and entitlements,
- observe health and usage,
- perform platform-level governance.

The Control Plane **never**:
- contains customer business data,
- executes customer workflows,
- accesses instance databases directly for business logic.

---

### Core Control Plane Responsibilities
- Customer registry
- Instance provisioning & teardown
- Environment management (prod, non-prod)
- License generation & validation
- Platform version tracking
- Instance health monitoring
- Global audit logs (control-plane only)

---

### Control Plane Services (Conceptual)
- Authentication & admin identity
- Customer management service
- Instance management service
- Subscription & licensing service
- Metrics & telemetry service

---

### Control Plane Boundaries
- Control Plane may communicate with instances **only via explicit, authenticated APIs**
- Control Plane cannot mutate instance data except through versioned, audited upgrade mechanisms
- Instance runtime must continue operating even if Control Plane is unavailable

---

## 19. Customer Instance Architecture (canon §19 UPDATE, 2026-05-09)

Each customer instance is a single process group:
- One `apps/api` process (Nest modular monolith with all instance-plane modules)
- One `apps/worker` process (BullMQ consumer for async automation, scheduled jobs, AI background tasks)
- One Postgres database (per-customer; pgvector + materialized views included)
- One Redis instance (per-customer; cache + BullMQ queues)

In pooled mode (canon §5 SOFTEN), multiple customers share these resources isolated by Postgres RLS keyed on `tenant_id`.

Instances are operationally independent. The Control Plane communicates with each instance only via explicit, authenticated APIs.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §2.

---

# PART III — PRODUCT & UX REFERENCE (SUMMARY)

(Condensed reference; detailed UX specs live in the Page Architecture document.)

- Identity & Access (RBAC + ABAC)
- Schema & Data Modeling
- Dynamic Forms & Views
- High-performance Data Grids
- Automation & Workflows
- Notifications & Reporting
- AVA (AI reasoning and execution layer)

---

# PART IV — ENFORCEMENT & COMPLIANCE (MANDATORY)

## 20. Enforcement Is Part of the Architecture

Rules without enforcement are aspirations.
This section defines **how compliance is guaranteed**.

These rules apply to:
- human developers,
- contractors,
- and **AI coding agents**.

---

## 21. Enforcement Layers

### 1. Code Reviews (Human Enforcement)
Every change must:
- reference the relevant section of this canon (explicitly or implicitly),
- demonstrate production readiness,
- contain no TODOs, FIXMEs, or future promises,
- avoid versioned naming or legacy language.

PRs that violate the canon are rejected.

---

### 2. Static Analysis & Linting (Automated Enforcement)
The codebase must enforce:
- no TODO / FIXME comments
- no commented-out code blocks
- no versioned identifiers (v1, v2, legacy)
- consistent naming conventions
- unused code detection

Builds fail if violations exist.

**Implementation status (W0, 2026-05-09):** Every canon-claimed
scanner or lint rule below is enforced by code AND is wired into
.github/workflows/ci.yml as a CI job. Each scanner ships with a
self-test that proves it catches its claimed patterns (44 assertions
across 5 suites + 21 ESLint rule assertions = 65 verifications on
every CI run).

Static-analysis scanners (8 total; all required CI jobs):
- `npm run authz:check` (W1.2; W0 task 4 extended scope to all 11
  instance services; svc-control-plane intentionally excluded per
  canon §18). 1 entry tracked in KNOWN_BYPASSES → W2/F146.
- `npm run audit:check` (W1.6; KNOWN_DEFERRED_OFFENDERS empty).
- `npm run security:check` (W0 task 3 reconciled PUBLIC_ALLOWLIST
  to 27 entries in 5 categories; fixed cross-platform path bug;
  tightened detection to ignore comment references).
- `npm run compliance:check` (W0 task 1.5 fixed broken `glob` import
  via native fs walk; F152 strict-mode-exit bug tracked → W4).
- `npm run service-boundary:check` (W0 task 5 added entity-write
  bypass detection: string-getRepository + raw SQL UPDATE/INSERT/
  DELETE; word-boundary defense). 4 ownership rules + 4 write-bypass
  rules + 7 allowlisted reads. In the modular monolith the scanner's
  role shifts from import-topology enforcement to entity-write
  ownership enforcement; both modes coexist.
- `npm run deps:check` (existing; 1 legacy carve-out → W4/bcrypt).
- `npm run cicd:check` (W0 task 7; asserts CD ↔ CI workflow_run
  trigger + no `if: always()` bypass outside the notify job).
- `npm run dead-code:check` (W0 task 10; trash-pattern + phantom-dep
  + orphan-lib detection; 12-entry allowlist all owedTo: W4).

ESLint enforcement (W0 task 6):
- `no-warning-comments: error` (TODO/FIXME/XXX/HACK at comment start).
- `@typescript-eslint/no-unused-vars: error` (with `^_` ignore).
- `hw/no-versioned-identifier: error` (custom rule at
  tools/eslint-rules/no-versioned-identifier.cjs; bans
  *V<digits>$, Deprecated*, Temp*; legacy* and old* deliberately
  not matched per the rule's header docs).
- DEFERRED: react-hooks/rules-of-hooks (W1 owns F088 fix and the
  plugin install). naming-convention (surface area too large for
  W0; W4 cleanup pass).
- ENFORCEMENT MODEL: `nx affected --target=lint` runs the new rules
  on changed files. Pre-existing 89 violations in unchanged files
  do not fail CI today; they get cleaned as files are touched in
  later waves (the "delete ruthlessly" ratchet).

Supply-chain & secret gates (W0 tasks 8 + 9; required CI jobs):
- `gitleaks` (per-PR + push history scan; rules at .gitleaks.toml).
- anchore/syft + grype SBOM + CVE scan (fail-build on high severity).
- license-checker + tools/validate-licenses.ts (allowed/blocked/
  exception structure with reason+addedBy+addedAt).

Whether each gate is configured as a REQUIRED status check on the
master branch protection rule is a GitHub repo-settings operation
documented in `docs/plan-fixes/W00-required-status-checks.md`.
Until that runbook is applied by the repo admin, the gates exist
in CI but admin-merge could bypass them. Track via the W0 PR's
follow-up issue.

---

### 3. CI/CD Gates (System Enforcement)
CI must:
- block merges on lint failures,
- block merges on unused exports,
- block merges on dead code,
- enforce formatting and naming rules,
- require all checks to pass before merge.

No bypasses.

---

### 4. Runtime Safeguards
At runtime:
- authorization checks are centralized,
- unsafe actions require explicit approval,
- AVA execution paths are audited,
- dangerous operations are gated.

---

## 22. AI Agent Compliance (CRITICAL)

Any AI agent generating code **must follow this canon**.

### AI Agent Rules
- AI must generate production-ready code only
- AI must not introduce TODOs, placeholders, or speculative abstractions
- AI must not reference future rewrites, migrations, or replacements
- AI-generated comments must explain intent, not apologize

If AI output violates these rules, it is considered **incorrect output**.

---

## 23. Canon as Execution Contract

This document is not guidance.
It is an execution contract.

- Humans are accountable for following it.
- AI agents are constrained by it.
- Tooling enforces it.
- Deviations require explicit amendment.

---

## 24. Canon Maintenance

This document is amended through pull requests, not silent updates.
Every architectural change that affects the canon should land an
explicit amendment note (date, fix code if from a remediation wave,
1-line summary of what changed).

Past amendments (most recent first):

- 2026-05-13 (W5.A / Plan Fix 25): §10 enforcement strengthened.
  `tools/audit-bypass-check.ts` regex widened to catch
  `<varName>Repo.save()` / `<varName>Repository.save()` patterns
  that were previously missed due to a leading `\b` word-boundary
  bug. Baseline F044 inventory captured in `KNOWN_DEFERRED_OFFENDERS`
  with per-area `followUp` tags (W5.B identity, W5.C metadata,
  W5.D data, W5.E automation+ava, W5.F fold-ins). Area sweeps
  follow in W5.B-F; allowlist must reach empty by end of wave.
  Refs Plan Fix 25.

- 2026-05-12 (canon §29 PR-D — service principals + RequestContext
  discriminated union, closes audit finding F022):
  • `service_principals` table + `ServicePrincipal` entity land in
    `migrations/instance/1930800000000-add-service-principals.ts`.
  • Seed manifest is ONE row only: `svc-worker → svc-api`. Canon §29.7
    amended to flag the prior `svc-api/svc-ava/svc-insights/svc-worker`
    example list as documentation, not a seed manifest. Founder
    direction: do not seed imaginary principals; future cross-process
    call surfaces add their own row via migration.
  • `RequestContext` is now a discriminated union
    `{ kind: 'user', ... } | { kind: 'service', ... }`.
    `UserRequestContext` carries `userId/roles/permissions/isAdmin/
    securityStamp` (pre-PR-D fields preserved, with `kind: 'user'`).
    `ServiceRequestContext` carries `serviceId/scopes/audience/
    instanceId` — NO `userId`, NO `roles`, NO `securityStamp`.
    Founder direction: "do not fake service callers as users."
  • Helpers `assertUserContext()` / `assertServiceContext()` /
    `isUserContext()` / `isServiceContext()` exported from
    `@hubblewave/auth-guard`. Every controller that reads user-shaped
    fields narrows at entry via `assertUserContext(req.context)`;
    accessing `.userId` on the union without narrowing fails type
    checking — that is the point.
  • `@AllowServiceToken()` decorator + default-deny posture: every
    endpoint rejects service tokens unless explicitly opted in at the
    method or class level. Canon §28 deny-wins applied to the JWT
    layer. `JwtAuthGuard` enforces.
  • `TokenIssuerService.issueServiceToken({ serviceId, audience })`
    mints ES256 service JWTs. Fixed 5-minute TTL per canon §29.4. NO
    `token_version` claim — services have no `security_stamp` per
    canon §29.6. Fresh `session_id` per mint.
  • `POST /internal/service-token` endpoint: `@Public()` because the
    caller has no HubbleWave JWT yet. Bootstrap via
    `ServiceBootstrapService` — K8s TokenReview in production
    (raw `https.request` to the cluster API server; no kubernetes-
    client dep), `X-Bootstrap-Secret: <JWT_BOOTSTRAP_SECRET>` +
    `X-Service-Id: <id>` in dev. Generic 401 on every failure mode
    so probes cannot enumerate which bootstrap kind failed.
    Allowlisted in `tools/security-bypass-check.ts` Category 7.
  • `JwtAuthGuard` branches on `sub.startsWith('service:')` to build
    `ServiceRequestContext`. Service tokens NEVER route through
    `IdentityResolverPort`, `JwtRevocationPort`, or `security_stamp`
    lookup — those carry user semantics that don't apply.
  • `ServiceTokenClient` in `@hubblewave/auth-guard` for consumers
    that need to mint outbound service tokens — caches per audience,
    refreshes 30s before expiry, reads K8s SA token in production /
    bootstrap headers in dev. Wired into `apps/worker` today; the
    worker doesn't currently make HTTP callbacks to apps/api, but the
    client is preparatory parity with the canon §29.7 contract.

- 2026-05-12 (canon §29 PR-C2 — logout-all-devices + security_stamp
  bump triggers + §29.6.1 amendment):
  • §29.6 amended with the exclusive list of `security_stamp` bump
    events (8 entries). Adds an explicit negative statement that
    per-device `POST /auth/logout` does NOT bump the stamp — that's
    the global kill-switch, not the ordinary sign-out.
  • §29.6.1 added distinguishing the two logout endpoints:
    `POST /auth/logout` (per-device, `revoked_reason='logout'`, no
    stamp bump) and `POST /auth/logout-all-devices` (global,
    `revoked_reason='logout_all_devices'`, bumps stamp, emits
    high-severity audit event).
  • §29.5 `revoked_reason` enum extended with `'logout_all_devices'`
    so the operational table distinguishes the global kill-switch
    from per-device sign-out. Migration
    `1930700000000-extend-refresh-token-revoked-reason.ts` updates
    the CHECK constraint.
  • `SecurityAuditEventKind` (libs/authorization audit port) gained
    `'logout_all_devices'`.
  Code lands in this PR: new `AuthService.logoutAllDevices(userId)`
  transactional method (revoke all families + bump stamp + high
  -severity audit), new `POST /auth/logout-all-devices` endpoint
  (204 No Content), MFA stamp bumps wired into `enrollTotp` +
  `verifyTotpEnrollment` + `disableMfa`, suspendUser / deactivateUser
  / deleteUser stamp bumps in `users.service.ts`. Password reset stamp
  bump was already wired by PR-B and verified by tests in this PR.
  Refs PR-C2 (PR #33).

- 2026-05-12 (canon §29 PR-C — Refresh token family + rotation + reuse
  detection): closes audit finding F001. Refines the §29.5 schema
  ahead of code landing — replaces the draft field set with the
  operational shape:
  • Plaintext `ip`/`user_agent`/`device_id` dropped from the
    operational table. Replaced with SHA-256 hashes (`ip_address_hash`,
    `user_agent_hash`) and a user-facing `device_label`. Plaintext
    values live only in the `AccessAuditPort.logSecurityEvent` payload
    on reuse-detection events, where retention + access controls are
    stricter than the operational refresh_tokens table.
  • `instance_id` changed from NOT NULL to NULL — single-tenant mode
    (canon §5) has no instance UUID to carry.
  • Field renames: `issued_at` → `created_at` (DEFAULT now()), `used_at`
    → `last_used_at`, `parent_token_id` upgraded to a real self-FK with
    `ON DELETE SET NULL`. `replaced_by_token_id` becomes a real FK with
    the same ON DELETE behavior so descendants survive the eviction of
    an ancestor.
  Founder-locked defaults (binding): refresh TTL default 14 days;
  `JWT_REFRESH_TTL_DAYS` configurable in `[1, 30]` with fail-fast
  startup guard; concurrent families per user UNBOUNDED (no cap);
  reuse-detection response = revoke family + revoke session via
  `JwtRevocationPort` + force re-auth + high-severity audit event.
  Client-facing 401 message is bland ("Your session has expired.
  Please sign in again.") — does NOT leak the reuse signal.
  AccessAuditPort extended with `logSecurityEvent({ severity,
  userId, kind, context })` — a sibling to `logAdminBypass`. The
  adapter writes the event to `AccessAuditLog` with
  `decision='HIGH_SEVERITY'` and the structured payload in
  `context.additionalData`. Audit log table required no schema
  change. Refs F001 PR #32.

- 2026-05-11 (W3 — Identity & Service Authentication Architecture):
  new §29. Locks the identity slice that closes audit findings F001,
  F015, F022 as ONE architectural commitment (not three isolated fixes).
  Highlights:
  • Signing: ES256 (KMS does not support Ed25519); per-instance AWS
    KMS asymmetric keys; alias `alias/hubblewave/{instance_id}/jwt-signing`;
    direct KMS signing per token (no in-memory cache, no envelope keys).
  • `kid` namespace: `hwk_YYYY_MM_DD_<8-hex>` — readable + ~32-bit
    entropy; `key_metadata` table maps `kid` → KMS ARN + state; JWT
    format never exposes AWS identifiers.
  • Key lifecycle: pending → active → retiring → retired/compromised;
    rotation every 30–90 days; retiring keys retained in JWKS until
    max(access_TTL, service_TTL) + clock skew.
  • JWT claims contract: every token carries kid, iss, aud, iat, exp,
    sub, instance_id, session_id, token_version. Verifiers check all
    of these plus signature.
  • TTLs: user access 10min default (range [5, 15]); service tokens
    5min fixed; refresh 1–30 days.
  • F001 — Refresh token family chains: single-use rotation, reuse
    detection revokes entire family, `revoked_reason` enum captures
    cause.
  • F015 — security_stamp / token_version on users; bumped on
    password change / MFA disable / admin force-logout / suspend;
    JWT carries value at issuance; mismatch → reject. Closes the
    "old session still works after password change" gap.
  • F022 — Service-to-service: `service_principals` table; production
    bootstrap via Kubernetes projected SA tokens + TokenReview API;
    local dev `JWT_BOOTSTRAP_SECRET` honored only when
    NODE_ENV !== 'production' (production startup fails fast if set);
    scope vocabulary `<collection>:<action>`.
  • Performance posture explicitly EXCLUDES in-memory signing key
    caches and envelope-key patterns; HSM is the cryptographic root.
  • Signing provider interface (§29.9): `KeySigningService` abstracts
    `AwsKmsEs256KeySigningService` (production) and
    `LocalEs256KeySigningService` (dev). Both produce ES256 over
    identical claims, kid, JWKS surface. HS256 is forbidden
    everywhere; LocalStack is NOT the default dev path. Production
    startup fails fast if `JWT_KEY_PROVIDER !== 'aws-kms'`.
  Code lands as a 4-PR chain after this amendment: (1) key_metadata
  infra + KeySigningService interface + both providers + JWKS
  publication, (2) token claims + security_stamp, (3) refresh family
  schema + rotation, (4) service principals + service-token issuance.

- 2026-05-11 (W2 — Authorization Resolution Model): new §28
  formalizing the authorization model. Publishes (a) the field-decision
  precedence matrix (7 levels: field-explicit deny/allow → field-wildcard
  deny/allow → collection deny/allow → default deny), (b) the
  record-decision precedence matrix (3 levels), (c) the five hard
  conflict-resolution rules (deny wins at same specificity; specificity
  ranks beat effect; field overrides collection; missing policy = deny;
  positive grants UNION, restrictions INTERSECT), (d) masking direction
  (DENY > MASK > ALLOW; MAX of severity across matching rules — inverts
  the pre-§28 helper which picked least-restrictive), (e) the row-gating
  rule (record visibility gates field evaluation), (f) admin-bypass
  commitment (no silent return-true; admin uses seed policies through
  the same evaluator; F021 is the audit interim, removal is owed),
  (g) explainability mandate (every decision returns provenance:
  matched level + rule + principal + fallback chain), (h) performance
  posture explicitly EXCLUDING pre-compiled permission graphs as
  premature, (i) deferred items (application-layer scope, unified
  policy table, materialized permissions). §28 is the contract; F006
  and a follow-up wildcard-rules PR are the code that lands it.

- 2026-05-10 (W1 — Stop-the-Bleeding): all 14 W1-owned audit findings
  closed (F011, F014, F027, F053, F073, F088, F089, F093, F111, F124,
  F125, F126, F127, F139, F141). 13 commits, 148 new W1-specific spec
  assertions, 0 regressions on the 65 W0 scanner self-tests.
  Highlights tied to canon claims:
  • §11 ("AVA reasons over platform state"): vector search now
    requires a typed RequestContext principal + post-filter authzCheck
    (F073). Audit log emits attribution on every search.
  • §9 ("authorization centralized, no shortcuts"): F089 closes the
    Control Plane localStorage XSS exfil vector — access token in
    memory, refresh in HttpOnly+SameSite=Strict cookie. No
    localStorage path remains for tokens.
  • §1 ("written as if deploying to production today"): F124 deletes
    the SQL-injection branch in reports rather than refactoring it;
    F127 deletes the triple-brace XSS branch in template engine. Two
    capability removals net-negative on LOC.
  • §10 (auditability): F139's typed SAML signature affirmation
    sentinel forces every SAML caller to make an explicit
    verification choice; the runtime check defends against `as any`
    bypasses.
  Risks carried forward: F111 keypair rotation requires operator
  action (documented in SECRETS_ROTATION.md OPEN INCIDENT block);
  F089 frontend change needs browser verification per CLAUDE.md
  frontend rule; libs/enterprise SSO domain is W4-pending-deletion
  (F139+F141 fix lives in saml-assertion-gate.ts and is
  forward-portable). Cf. master roadmap at
  docs/plan-fixes/00-master-remediation-roadmap.md and W1 acceptance
  at docs/plan-fixes/W01-acceptance.md.
- 2026-05-09 (Architecture v3 spec): Major architectural shift from 14-service distributed system to 3-process modular monolith + Day-1 mobile + AI Code Assistant + full UI Builder. Amendments: §5 SOFTEN (single-tenant default + pooled mode), §7 SOFTEN (drop 5-tier view hierarchy), §8 INVERT (merge automation + workflow), §11 SOFTEN (AI as feature surface incl. AI Code Assistant), §12 PER-FEATURE (trust progression per AI feature), §17 UPDATE (monolith topology), §19 UPDATE (single Nest process per instance), §21 UPDATE (W0 expanded service-boundary:check to entity-write enforcement; import-topology TRIM no longer applies). New: §17.5 (customization contract, the moat), §25 (Plugin SDK contract), §26 (mobile first-class), §27 (Workspaces + UI Builder). Vertical pack (Clinical/Facilities Asset Management) deferred to a separate design doc; preserved as forward inventory in spec Appendix D. Solo founder timeline: ~10–12 months critical path for platform-only scope. Refs spec `docs/superpowers/specs/2026-05-09-platform-architecture-design.md`.
- 2026-05-09 (W0 — Foundation): §21 implementation status replaced
  with current reality. 8 architectural scanners + ESLint rules +
  gitleaks + SBOM + license-checker now CI-gated. Each new scanner
  ships with a self-test (44 + 21 = 65 assertions on every CI).
  CD ↔ CI workflow_run gating closes F106. PUBLIC_ALLOWLIST
  reconciled (F105). Plan Fix 1 amendment from 2026-05 is partly
  superseded: the service-boundary scanner now enforces entity-write
  bypass (string-getRepository + raw SQL) in addition to the existing
  import-topology rule (W0 task 5 / F056). Cf. master roadmap at
  docs/plan-fixes/00-master-remediation-roadmap.md and W0 acceptance
  at docs/plan-fixes/W00-acceptance.md.
- 2026-05 (Plan Fix 1): §1 deferred-offender list pruned — the
  `apps/svc-data/src/app/automation/` deprecation entry is removed
  because the duplicate runtime is gone. svc-automation now owns the
  full automation domain (runtime + sync-trigger + scheduling + AVA +
  CRUD). svc-data retains only a thin HTTP client. Service-boundary
  scanner extended with a rule that any service other than
  svc-automation writing to AutomationRule or AutomationExecutionLog
  fails CI.
- 2026-05 (W6.A): §1 absolutes clarified (greenfield rule + tracked
  legacy backlog); §9 "no shortcuts" tied to specific W1.2 + W1.5 +
  W5.D enforcement; §13 upgrade safety acknowledged convention-based
  pending automated scanner; §21 lint coverage list expanded with
  status. Refs Plan Fix 13 follow-up.
- 2026-05: §5 scope clarification (control-plane multi-tenancy
  acknowledged); §10 audit-in-transaction requirement (W1.6 + W2.D +
  W3.C); §14 reference-checking on delete (W2.A); §12 AVA gate-
  enforcement deferral (W5.B). Refs Plan Fix 13.

---

## 25. Plugin SDK is the Platform Contract (canon §25 NEW, 2026-05-09)

`@hubblewave/plugin-sdk` (web) and `@hubblewave/plugin-sdk-mobile` are the typed, versioned contract that customer plugin authors consume. The SDK commits to:

- API stability for **N=2 major versions** (~2 years given quarterly release cadence). Plugins built against `2026.05` work through `2027.05` minimum.
- Deprecated APIs continue to work for one full release cycle with console warnings.
- Removed APIs ship with automated migration tooling (`hw-plugin migrate`).
- No silent breakage: plugins outside the supported version window fail to load with a precise error pointing to the migration tool.

The SDK is the precise commitment ServiceNow can't make — their customers customized via DOM and JavaScript injection over 20 years, no contract, no validator possible. We can promise it because we're greenfield and the contract IS the customization surface.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §5.3.

---

## 26. Mobile is a First-Class Platform Surface (canon §26 NEW, 2026-05-09)

All field-staff workflows have mobile parity with web. Mobile is offline-first; the offline-degraded experience is the design baseline, online is the bonus. Customizations (workspaces, plugins, automations, views) apply to mobile via `@hubblewave/plugin-sdk-mobile`.

Stack: React Native + Expo + WatermelonDB + react-native-vision-camera + react-native-mlkit. iOS + Android from one TypeScript codebase. JWT auth shared with web; biometric session unlock (FaceID, TouchID, fingerprint) per session.

Direct competitive lever vs Nuvolo's weak mobile experience. Healthcare field staff are explicit pain-point.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §4.1 mobile experience.

---

## 27. Workspaces + UI Builder are the User-Facing Customization Surface (canon §27 NEW, 2026-05-09)

Customers compose persona-tuned UIs (Workspaces) and entire pages (UI Builder full page authoring) without code, using the same primitives HubbleWave uses to ship vertical packs.

The UI Builder achieves full feature parity with ServiceNow UI Builder: page composition, route definition, layout authoring, templates, multi-screen workflows, variants (web/mobile/desktop), localization, branding, conditional logic, event wiring, AI authoring assist via §AI Code Assistant.

Eat-our-own-dog-food: every OOTB workspace shipped by HubbleWave is built via the same UI Builder customers use. If our own product can't be built on the customization layer, the layer isn't real.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §4.1 Workspaces + UI Builder.

---

## 28. Authorization Resolution Model (canon §28 NEW, 2026-05-11)

This section makes §9 ("Authorization Is Centralized") **operationally specific**. §9 says shortcuts are forbidden; §28 says exactly how rules combine, what wins, and what happens when no rule matches.

### 28.1 Two evaluation surfaces

The platform answers two distinct authorization questions, in this fixed order:

1. **Record visibility** — "can user U perform operation O on a specific record R of collection C?" Evaluated against `CollectionAccessRule` rows (with row-conditions).
2. **Field visibility** — "for a record the user can already see, what is the effect on field F?" Evaluated against `PropertyAccessRule` rows (which may themselves carry row-conditions).

**Record visibility gates field evaluation.** If the record-level decision denies, field policies are NEVER consulted on that record. Field decisions are only meaningful on records that already passed record-level checks. This is a hard rule, not a performance optimization.

### 28.2 Field-decision precedence (the canonical matrix)

For each (user, field, record) tuple, the evaluator walks levels 1→7 and **the first matching level decides**:

| Priority | Rule shape | Effect |
|---------:|---|---|
| 1 | Field-explicit rule matching principal, field, and (if present) row-condition | `deny` |
| 2 | Field-explicit rule matching principal, field, and (if present) row-condition | `allow` |
| 3 | Field-wildcard rule (propertyId IS NULL) matching principal and collection | `deny` |
| 4 | Field-wildcard rule (propertyId IS NULL) matching principal and collection | `allow` |
| 5 | Collection rule (CollectionAccessRule.canRead/etc.) matching principal | `deny` |
| 6 | Collection rule matching principal | `allow` |
| 7 | (none of the above matched) | `deny` |

Within a level, **deny rules are evaluated before allow rules at the same level**. If multiple rules at the same level-and-effect match the user, the decision is unchanged (the effect is uniform across them).

### 28.3 Record-decision precedence

For each (user, operation, record) tuple, the evaluator walks levels 1→3:

| Priority | Rule shape | Effect |
|---------:|---|---|
| 1 | Collection rule matching principal and row-condition (if any) | `deny` |
| 2 | Collection rule matching principal and row-condition (if any) | `allow` |
| 3 | (none matched) | `deny` |

A user matching multiple `allow` rules at level 2 sees the **UNION** of those rules' row-conditions (`OR`-combined). A user matching any `deny` at level 1 sees no records the deny matches, regardless of allow rules. This is the §28.4 deny-wins rule applied at the row level.

### 28.4 Conflict resolution — the five hard rules

The platform makes these guarantees. They are not configuration; they are platform semantics:

1. **Deny wins at the same specificity.** If two rules match a user at the same level and one is `deny`, the decision is `deny`.
2. **Specificity ranks beat effect.** Wildcards never override explicit field rules (a wildcard allow does not unblock an explicit field deny; but a wildcard deny does not block an explicit field allow either — the explicit allow at level 2 fires first).
3. **Field rules override collection rules.** A field-level allow on `salary` is sufficient even if the collection-level decision is more restrictive — provided record visibility (§28.1) is satisfied.
4. **Missing policy = deny.** Level 7 (and level 3 for record decisions) is `deny`. There is no "default allow because nothing matched."
5. **Positive grants UNION; restrictions INTERSECT.** When multiple rules at the SAME level all grant access, the grants combine (most permissive across read/write). When restrictions (`deny`, masking severity) co-apply, the most restrictive wins.

### 28.5 Masking direction

When a field's level-2 (or level-4) `allow` rule has a `maskingStrategy ∈ {NONE, PARTIAL, FULL}`, multiple matching allow rules combine by **MAX of severity**:

- Severity ordering: `NONE` (0) < `PARTIAL` (1) < `FULL` (2)
- Effective masking strategy = the highest severity across matching rules

Rationale: roles compose conjunctively. A user with two roles — one that masks SSN partially, one that does not — sees the partial mask, not the unmasked value. The more restrictive role's intent must hold. This applies HIPAA's "minimum necessary" principle at the field level.

**This is a deliberate inversion of the pre-§28 helper that picked least-restrictive masking.** Implementations from before this amendment landed used least-restrictive; F006 + the §28 landing migrates the helper to most-restrictive.

The effective outcome of a field decision is one of three:

- `ALLOW` — return the raw value
- `MASK` (with strategy) — return the masked value via `maskCollectionRecord`
- `DENY` — omit the field entirely from the response

These three are first-class outcomes, not bolted-on layers.

### 28.6 No silent admin bypass

Admin-role users go through the same evaluator. They are not short-circuited to `return true`. Instead, the platform ships an `admin` policy at install time that grants broad allow rules across system collections. Customers who tighten admin access do so by editing those policies, not by changing the evaluator.

**Implementation status (pre-§28 amendment):** F021 added an audit row on every admin bypass site. The bypass still exists. Removing the bypass and replacing with seed policies is owed to a follow-up wave; the canon now binds the destination.

### 28.7 Explainability is mandatory

Every authorization decision MUST be able to produce its provenance on request:

```json
{
  "effect": "deny",
  "matchedLevel": 3,
  "matchedRuleId": "uuid",
  "matchedPrincipal": "role-uuid",
  "fallbackChain": ["level-1: no match", "level-2: no match", "level-3: deny matched"]
}
```

The provenance object is attached to audit log rows (F021) and exposed via an `/authorization/explain` endpoint for admin tooling. The explainability output is part of the platform contract — auditors will ask "why did user X get access to record Y" and the platform must answer without engineer-level debugging.

### 28.8 Performance posture

- Caches are SQL-pushdown + rule-cache (F023, F025). Decisions stay sub-100ms at pilot scale.
- **Compiled effective permission graphs (Cedar/OPA-style materialization) are NOT a §28 commitment.** They are a future option if measured cache pressure warrants them. Premature pre-compilation is explicitly excluded from this canon section.

### 28.9 What §28 does NOT include (deferred)

The following are committed in spirit but NOT bound by §28 today:

- **Application-layer authorization scope** — packs are customization boundaries, not security boundaries. Adding cross-pack trust grants is W4/W5 work and gets its own canon amendment when it lands.
- **Unified `security_policy` mega-table** — the two-table split (`CollectionAccessRule` + `PropertyAccessRule`) is canonical for now. Unification is only acceptable if real duplication emerges in the evaluator.
- **Pre-computed materialized permissions** — see §28.8.

Spec reference: this section + the in-flight remediation PRs (F003, F004, F005, F006, F021, F023, F024, F025) collectively implement §28. The remediation backlog tracks each.

---

## 29. Identity & Service Authentication Architecture (canon §29 NEW, 2026-05-11)

§9 commits to centralized authorization. §28 specifies how authorization decisions are made. §29 specifies **who issues the tokens that drive those decisions**, how those tokens are signed, how they expire, how they are revoked, and how internal services authenticate to one another.

### 29.1 Signing topology

- **Algorithm: ES256 (ECDSA P-256).** RS256 is a fallback only for specific OIDC RP interoperability issues; not the default.
- **Per-instance AWS KMS asymmetric keys.** No shared signing keys across instances. Each instance's KMS alias: `alias/hubblewave/{instance_id}/jwt-signing`. The private key never leaves the KMS HSM.
- **Direct KMS signing per token.** No in-memory signing key cache. No envelope-key / data-key shortcut. The HSM is the cryptographic root.
- **Verification via cached public keys.** Public keys are fetched once at startup and on rotation events; JWKS endpoint exposes them.

### 29.2 `kid` namespace + key lifecycle

- **`kid` format**: `hwk_YYYY_MM_DD_<8-hex>`. Example: `hwk_2026_05_11_7f3a9c2e`. Date prefix for ops readability; 8-hex suffix (~32 bits entropy) defeats predictable-kid attacks. Generated at key-creation time, immutable.
- **`key_metadata` table** maps `kid` → `{ provider: 'aws-kms', kms_alias, kms_arn, algorithm, state, created_at, activated_at, retiring_at, retired_at, compromised_at }`. JWT format never exposes AWS-specific identifiers; internal `kid` is the only public reference.
- **Key states**: `pending` → `active` → `retiring` → `retired` (terminal) or `compromised` (terminal, emergency state). Lifecycle transitions are admin operations, audited via F021's `AccessAuditPort`.
- **Rotation cadence**: every 30–90 days. Default 90 days; shorten to 30 if compromise risk emerges. Rotation creates a new key (`pending`), activates it (`active`), demotes the previous active key (`retiring`), and retains the retiring key's public component in JWKS until the longest in-flight token lifetime + clock skew has elapsed.
- **JWKS exposure rule**: `/.well-known/jwks.json` returns the public keys of `active` and `retiring` keys only. `pending`, `retired`, and `compromised` keys are never in JWKS.

### 29.3 JWT claims contract

Every HubbleWave JWT MUST include:

| Claim | Value |
|---|---|
| Header `alg` | `ES256` |
| Header `typ` | `JWT` |
| Header `kid` | Internal `kid` from §29.2 |
| `iss` | Instance issuer — `hubblewave-{instance_id}` |
| `aud` | Target audience — `hubblewave-instance` for human tokens, `svc-{target}` for service tokens |
| `iat` | Issued-at (unix seconds) |
| `exp` | Expires-at (unix seconds) — bounded per §29.4 |
| `sub` | `user:{user_id}` for human tokens, `service:svc-{service-id}` for service tokens |
| `instance_id` | Instance UUID — duplicates `iss` parsing but is independently checked |
| `session_id` | Persisted session row UUID — used for revocation lookups |
| `token_version` | Per-user `security_stamp` value (see §29.6) |
| `scope` (service tokens only) | Array of `<collection>:<action>` strings |

Verifiers MUST check signature, `kid` resolves to an `active` or `retiring` key, `iss`, `aud`, `exp`, `iat` (with clock tolerance ≤ 30s), and `token_version` matches the current DB value (see §29.6).

### 29.4 Token TTLs

- **User access tokens**: default **10 minutes**. Configurable per instance within `[5min, 15min]`. Values outside that range fail instance startup. Stale permissions are NOT solved with longer JWTs — they are solved with `security_stamp` invalidation (§29.6).
- **Service-to-service tokens**: **5 minutes**, fixed. No instance override. Audience-bound, scope-limited.
- **Refresh tokens**: 1–30 days, configurable per instance. Single-use rotation (§29.5).
- **Retiring key retention** in JWKS: `max(access_token_TTL, service_token_TTL) + clock_skew`, never less than 24 hours for operational safety.

### 29.5 Refresh token family model (closes F001)

Single-use rotation with token-family chains. Reusable refresh tokens are forbidden.

Persistent state per token:

```
refresh_tokens (
  token_hash             text PRIMARY KEY,    -- SHA-256 of the opaque token
  family_id              uuid NOT NULL,
  parent_token_id        text NULL,           -- FK to token_hash; NULL for first token in family
  user_id                uuid NOT NULL,
  instance_id            uuid NULL,           -- NULL in single-tenant mode (canon §5)
  session_id             uuid NOT NULL,
  device_label           text NULL,           -- user-facing label, e.g. "Chrome on Mac"
  user_agent_hash        text NULL,           -- SHA-256 of UA at issue time
  ip_address_hash        text NULL,           -- SHA-256 of IP at issue time
  created_at             timestamptz NOT NULL DEFAULT now(),
  expires_at             timestamptz NOT NULL,
  last_used_at           timestamptz NULL,    -- set on first rotation; NULL = never used
  revoked_at             timestamptz NULL,
  replaced_by_token_id   text NULL,           -- FK to token_hash of successor in family
  revoked_reason         text NULL            -- enum: 'reuse_detected' | 'logout' |
                                              -- 'password_change' | 'admin_revoke' |
                                              -- 'family_expired' | 'logout_all_devices'
)
```

Plaintext IP and User-Agent are NOT stored on the operational row — only
their SHA-256 hashes. Plaintext values (when needed for forensics) are
captured in the audit event emitted via AccessAuditPort on security
events; the audit log row has different retention and access controls
than the operational refresh_tokens table.

`device_label` is user-facing display only ("Chrome on Mac", "iPhone
14 Pro"). The login endpoint accepts an optional `device_label`
parameter from the client; defaults to a User-Agent-parsed string when
omitted.

Indexes: `(family_id, revoked_at)`, `(user_id, session_id)`, plus the primary key on `token_hash`.

Rotation rules:

1. **Issue**: every refresh request consumes the current token (`last_used_at = now()`), mints a new one with the same `family_id`, sets `parent_token_id` and `replaced_by_token_id` to chain them.
2. **Reuse detection**: if a token presents with `last_used_at IS NOT NULL`, **revoke the entire family** (`UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'reuse_detected' WHERE family_id = $1 AND revoked_at IS NULL`). Emit a security audit event via F021's `AccessAuditPort.logSecurityEvent`.
3. **Family expiry**: when the family's oldest `created_at` is older than the refresh-token max lifetime, revoke the whole family with `revoked_reason = 'family_expired'`.
4. **Logout**: revokes the family with `revoked_reason = 'logout'`. The access-token revocation (F002's `JwtRevocationPort`) is the parallel mechanism for in-flight access tokens.
5. **Single-use rotation without a family chain is forbidden** — it cannot reliably kill descendants after reuse.

### 29.6 `security_stamp` / token_version

Every user carries a `security_stamp` column (`uuid` regenerated on security events). The list of bump events is **exclusive** — only these events bump the stamp:

1. **`POST /auth/logout-all-devices`** — the global kill-switch endpoint (see §29.6.1).
2. **Password change** — `POST /auth/change-password` (authenticated) and `POST /auth/change-password-expired` (re-auth flow).
3. **Password reset** — `POST /auth/password-reset` after the reset token is consumed.
4. **MFA enrollment** — the moment a verified TOTP method is marked enabled (`verifyTotpEnrollment` success).
5. **MFA disable** — `disableMfa` clearing the MFA method row.
6. **MFA reset / regenerate recovery codes** — wherever a future endpoint lands; same posture as enrollment.
7. **Admin-forced session revocation** — admin endpoint that calls `AuthService.logoutAllDevices(targetUserId)` on the user's behalf.
8. **Account status change to a non-active state** — `'suspended'`, `'inactive'`, `'deleted'`, `'compromised'`. Wherever the platform mutates `user.status` away from `'active'`, the same write must bump `securityStamp`.

Per-device logout (`POST /auth/logout`) does NOT bump `security_stamp`. Bumping the stamp invalidates every access token across every device — that's the global kill-switch, not the ordinary sign-out.

Every JWT carries the user's `security_stamp` value at issuance time in the `token_version` claim. Verifiers (`JwtAuthGuard`, `JwtStrategy`) compare to the current DB value; mismatch → reject with `Token version stale`. Closes the "old session still works after password change" gap.

`security_stamp` is the cross-cutting kill-switch — independent of `JwtRevocationPort` (which is per-session) and refresh-token family revocation (which is per-family). Bumping stamp invalidates ALL tokens for the user globally.

### 29.6.1 Logout semantics — two endpoints

The platform exposes two distinct logout surfaces. They are operationally different and carry different revocation reasons in the audit trail:

**`POST /auth/logout`** (per-device):

- Revokes the current refresh-token family (`revoked_reason = 'logout'`).
- Revokes the current session via `JwtRevocationPort` (so the in-flight access token also fails on its next request).
- Clears the refresh cookie on the calling device.
- Does NOT bump `security_stamp`.
- Other devices the user is signed in to are unaffected.

**`POST /auth/logout-all-devices`** (global kill-switch):

- Revokes ALL of the user's active refresh-token families with `revoked_reason = 'logout_all_devices'`. The dedicated reason code distinguishes the global revocation from the per-device sign-out in the operational table — forensic queries can filter explicitly.
- Bumps `security_stamp` — every in-flight access token across every device becomes invalid on next verification (§29.6 stamp comparison).
- Writes a high-severity audit event via `AccessAuditPort.logSecurityEvent` with `kind: 'logout_all_devices'` and `severity: 'high'`.
- Forces full re-authentication everywhere, including the device that called the endpoint.
- Response is 204 No Content. No tokens issued in the response body.

### 29.7 Service-to-service authentication (closes F022)

No shared "internal secret." Every service has a registered principal and mints short-lived audience-bound tokens.

`service_principals` table (seeded at deploy time per environment):

```
service_principals (
  service_id              text PRIMARY KEY,            -- e.g. 'svc-worker'
  display_name            text NOT NULL,
  allowed_audiences       text[] NOT NULL,             -- e.g. ['svc-api'] — services this principal may call
  allowed_scopes          text[] NOT NULL,             -- e.g. ['work_order:read', 'audit:write'] — <collection>:<action>
  k8s_service_account     text NULL,                   -- e.g. 'system:serviceaccount:hubblewave-system:svc-worker-sa'
  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL,
  updated_at              timestamptz NOT NULL
)
```

**Service identifier examples in this canon (svc-api, svc-ava, svc-insights, svc-worker, etc.) are DOCUMENTATION, not a seed manifest.** Each row is added only when a real cross-process call surface emerges. Per founder direction (canon §29 PR-D landing 2026-05-12), the seed manifest starts with exactly one principal:

| service_id    | display_name                | allowed_audiences | allowed_scopes                                        | k8s_service_account                                       |
|---------------|-----------------------------|-------------------|-------------------------------------------------------|-----------------------------------------------------------|
| `svc-worker`  | BullMQ background worker    | `['svc-api']`     | `['work_order:read', 'work_order:write', 'audit:write']` | `system:serviceaccount:hubblewave-system:svc-worker-sa` |

Adding a principal is an architectural decision, not a runtime operation — it requires a migration, a canon §24 maintenance log entry, and a clear answer to "what real cross-process call uses this." Speculative seeding ("we might call svc-ava someday") is rejected.

#### Bootstrap

**Production**: Kubernetes projected service account tokens with audience binding. The auth service exposes `/internal/service-token` (mTLS or in-cluster only); each calling service presents its projected SA JWT (with `audience: hubblewave-auth-service`); auth service validates via the k8s `TokenReview` API, looks up the matching `service_principals` row by `k8s_service_account`, mints a HubbleWave service token.

**Local dev only**: `JWT_BOOTSTRAP_SECRET` env var. The auth service accepts this **only when `NODE_ENV !== 'production'`**. Production-mode startup MUST fail fast if `JWT_BOOTSTRAP_SECRET` is present — defense in depth against accidental dev-mode deploy.

#### Service token claims

```json
{
  "alg": "ES256",
  "typ": "JWT",
  "kid": "hwk_2026_05_11_7f3a9c2e",
  "iss": "hubblewave-{instance_id}",
  "aud": "svc-api",
  "sub": "service:svc-ava",
  "iat": 1747000000,
  "exp": 1747000300,
  "instance_id": "{uuid}",
  "session_id": "{uuid-generated-per-issuance}",
  "scope": ["work_order:read", "dashboard:read"]
}
```

#### Scope vocabulary

`<collection>:<action>`. Examples: `work_order:read`, `work_order:write`, `dashboard:read`, `search:query`, `attachment:read`, `audit:write`.

Service identity is in `sub` (the caller) and `aud` (the target). Scopes describe permission, not caller identity. Do NOT add service-prefixed scopes (e.g., `svc-ava:work_order:read`) — `sub` already carries that.

#### Defense in depth

mTLS at the service mesh / ingress layer is acceptable as defense in depth but does NOT replace app-layer authorization. Network trust is not authorization.

### 29.8 Performance posture

KMS signing is ~50–100ms per call. At pilot scale (low-mid hundreds of token issuances per minute per instance), direct KMS signing is acceptable without optimization. Verification is local (cached public keys), so the read path is fast.

**Explicitly excluded** from this canon section:

- In-memory signing key cache (envelope pattern). The HSM is the cryptographic root; data keys break that invariant.
- Bulk token pre-mint. Each token is signed at issue time.

If measured signing latency becomes a problem post-pilot, the canonical optimization is provisioning higher KMS request quotas, not an in-memory cache.

### 29.9 Signing provider interface + dev/prod symmetry

§29.1 binds production to AWS KMS as the private-key custodian. Dev MUST NOT diverge from that contract in a way that trains the codebase on the wrong primitive. Specifically:

- **HS256 is forbidden everywhere.** No symmetric-key dev path. The codebase must never carry HS256 code that "works in dev" — that path becomes an attack surface in production.
- **LocalStack is NOT the default dev path.** Its KMS emulation has subtle behavioral differences from real KMS that we do not want to bake into local development expectations.
- **Both prod and dev sign with ES256 over the same JWT format**, identical claims, identical `kid`/`key_metadata` lifecycle, identical verification semantics. The ONLY difference between environments is the custodian of the private key.

The platform exposes one interface:

```typescript
interface KeySigningService {
  sign(payload: JwtPayload, kid: string): Promise<string>;
  getPublicJwk(kid: string): Promise<JsonWebKey>;
  rotateKey(): Promise<KeyMetadata>;
  getActiveKey(): Promise<KeyMetadata>;
  getVerifyingKeys(): Promise<KeyMetadata[]>;  // returns active + retiring
}
```

Two implementations:

| Implementation | Private key custody | When used |
|---|---|---|
| `AwsKmsEs256KeySigningService` | AWS KMS HSM | **REQUIRED** for `NODE_ENV === 'production'` |
| `LocalEs256KeySigningService` | `.dev/keys/` file or dev-only DB row | non-production environments only |

Both produce ES256 signatures, both expose the same `kid`/lifecycle/JWKS surface. The local provider differs only in WHERE the private key lives.

#### Configuration

```
JWT_KEY_PROVIDER=aws-kms | local-es256
```

#### Hard guard at startup

```typescript
if (process.env.NODE_ENV === 'production' && process.env.JWT_KEY_PROVIDER !== 'aws-kms') {
  throw new Error('Production requires aws-kms JWT key provider');
}
```

Production startup MUST fail fast if `JWT_KEY_PROVIDER !== 'aws-kms'`. No fallback. No "warn but continue."

#### Local key storage requirements

- Generated ES256 keypair persists across restarts (otherwise dev tokens become invalid every reload — false-positive failure mode in tests)
- Storage path: `.dev/keys/` directory (must be gitignored) OR a dev-only DB table that is NOT included in production migrations
- File permissions: `0600` (owner-read/write only); the local provider refuses to start if the file is group/other-readable
- Never committed to source control

This is binding: ship `local-es256` for dev, ship `aws-kms` for production. The signing provider interface enforces the contract — application code calls `KeySigningService.sign(...)` and is environment-agnostic.

### 29.10 What §29 does NOT include (deferred)

- **mTLS service mesh** — defense-in-depth layer; not the primary authentication mechanism.
- **HSM provider migration tooling** — KMS is the only provider supported today. Vault Transit / GCP KMS are future options if pricing or sovereignty pressure requires.
- **OIDC RP federation server** — HubbleWave's OIDC capabilities today are RP-side (consuming external IdPs per F007–F010). Being an OIDC OP for third-party RPs is a separate spec.

Spec reference: this section + the implementation PRs that follow (canon §29 PR-chain — `key_metadata` infra + JWKS publication; token claims + `security_stamp`; refresh family schema; service principals + token issuance) collectively close audit findings F001, F015, F022.

---

# FINAL STATEMENT

HubbleWave is designed to outlast categories of enterprise software.

This canon exists so that:
- growth does not dilute principles,
- success does not corrupt architecture,
- automation does not undermine trust.

Everything built for HubbleWave must earn its place here.