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

## 7. Views Are First-Class

Views are not UI sugar.

They are governed projections of data for specific audiences.

Hierarchy:
System → Tenant → Role → Group → Personal

---

## 8. Automation ≠ Workflow

Automation rules are:
- deterministic
- record-scoped
- synchronous

Workflows are:
- long-running
- stateful
- human-aware

They must never be merged.

---

## 9. Authorization Is Centralized

All data access flows through:
RBAC + ABAC + row-level + field-level rules.

There are no shortcuts.
Ever.

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

## 11. AI Is Infrastructure

AVA is not a chatbot.
AVA is a **reasoning layer over platform state**.

If AVA cannot reason about a feature, the feature is incomplete.

---

## 12. Trust Is Earned Incrementally

AVA progression:
Suggest → Preview → Approve → Execute → Audit

Skipping steps is forbidden.

**Implementation status (W5.B):** The progression is currently
DOCUMENTED but not yet ENFORCED in code. Plan Fix 16 (AVA proposal
state machine) is on the architecture remediation backlog. Until it
lands, AVA execution gates are convention-based; the canon's
"forbidden" stance is aspirational. Engineers writing AVA-adjacent
code MUST NOT introduce paths that bypass the documented stages, but
the platform does not yet enforce this with a state machine.

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

## 17. High-Level Architecture

HubbleWave consists of two strictly separated planes:

1. **Control Plane** — platform ownership, provisioning, governance
2. **Customer Instance Plane** — runtime platform used by customers

There is no shared business logic between planes.

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

## 19. Customer Instance Architecture (Recap)

Each customer instance includes:
- Identity & access services
- Metadata & schema engine
- Data services
- Automation & workflow engines
- UI & AVA runtime
- Instance-scoped databases and storage

Instances are operationally independent.

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

**Implementation status (W6.A):** The scanners exist and exit non-zero
on violations:
- `npm run authz:check` (W1.2)
- `npm run audit:check` (W1.6, KNOWN_DEFERRED_OFFENDERS empty after W2.E)
- `npm run security:check` (existing)
- `npm run compliance:check` (existing terminology scanner)
- `npm run service-boundary:check` (W5.D, currently 0 violations)

Whether `.github/workflows/` actually FAILS PRs on these checks is
a separate config concern. Engineers SHOULD verify CI gate status
before merging architectural changes. If a PR passes lint locally
but CI doesn't run the scanner, the rule is aspirational for that
PR. Tracked for human follow-up: ensure all five scanners are required
status checks on the merge protection rule.

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

# FINAL STATEMENT

HubbleWave is designed to outlast categories of enterprise software.

This canon exists so that:
- growth does not dilute principles,
- success does not corrupt architecture,
- automation does not undermine trust.

Everything built for HubbleWave must earn its place here.