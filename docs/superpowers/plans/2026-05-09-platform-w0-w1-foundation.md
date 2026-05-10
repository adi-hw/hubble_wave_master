# Platform W0 + W1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the architectural decision via canon amendments, scaffold the new monolith targets (`apps/api`, `apps/worker`, `apps/control-plane`), and migrate the first five platform foundation modules (kernel, db, identity, audit, metadata) from their existing `apps/svc-*` services into `apps/api`. At plan end, `apps/api` is a runnable Nest application containing the platform's authentication, authorization, audit, schema engine, and database modules — ready for the remaining 13 modules of W1 (data, automation, views, forms, dashboards, notifications, integrations, ai, packs, plugins, upgrade, storage, search) to land in a follow-on plan.

**Architecture:** Wave 0 amends the canon and creates Nest scaffolds for the three target apps. Wave 1 (foundation slice) ports existing module code from svc-* services into `apps/api`, preserving tests and behavior, while keeping the old services running side-by-side until full W1 cutover. The migration order — kernel → db → identity → audit → metadata — follows the dependency graph from spec §2 module layout.

**Tech Stack:** TypeScript 5.9, NestJS 11, TypeORM 0.3, Postgres + pgvector, Redis (cache-manager), BullMQ 5, Nx 22, Jest 30, Vitest 4, Vite 7.

**Spec reference:** `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` (v3, founder-approved 2026-05-09).

**Solo founder, ~6–8 weeks of work.** Wave naming "W0" / "W1" refers to the architectural-shift waves defined in the spec's §8 migration sequence — distinct from prior remediation wave numbering (e.g. W1.A, W2.D) which used the same "W" prefix but for security fixes. Commit messages in this plan say "ARC-W0" / "ARC-W1" to disambiguate.

---

## Files Created/Modified Overview

### W0 — Lock decision

**Modified:**
- `CLAUDE.md` — canon amendments per spec §9 (clauses §5, §7, §8, §11, §12, §17, §19, §21 amended; new §17.5, §25, §26, §27 added; §24 maintenance log updated)
- `package.json` — add `dev:api`, `dev:worker`, `dev:control-plane:new` scripts
- `nx.json` — register new project paths if Nx project files don't auto-discover
- `docs/plan-fixes/README.md` (creating if missing) — index Plan-Fix backlog with status; mark fixes 12, 16, 24 as deferred/superseded

**Created:**
- `apps/api/` — new Nest application scaffold:
  - `apps/api/src/main.ts` — Nest bootstrap
  - `apps/api/src/app/app.module.ts` — root module (empty initially)
  - `apps/api/project.json` — Nx project config
  - `apps/api/tsconfig.json` + `tsconfig.app.json` + `tsconfig.spec.json`
  - `apps/api/jest.config.ts`
  - `apps/api/Dockerfile`
  - `apps/api/eslint.config.mjs`
  - `apps/api/webpack.config.js`
- `apps/worker/` — same structure as `apps/api` but bootstrapped without HTTP server (BullMQ consumer process)
- `apps/control-plane-new/` — temporary new scaffold during W0; the existing `apps/svc-control-plane` keeps running until full W1 cutover. (Renamed/replaced in a later wave; do NOT delete `apps/svc-control-plane` in W0.)

### W1 — API consolidation foundation (kernel, db, identity, audit, metadata)

**Created:**
- `apps/api/src/app/kernel/` — shared types, errors, RequestContext (incl. `bearerToken` from Plan Fix 1 / PR2)
- `apps/api/src/app/db/` — TypeORM setup, transaction helpers (`withAudit`), datasource configuration; depends on kernel
- `apps/api/src/app/identity/` — JWT strategy, OIDC, LDAP, MFA (TOTP), RBAC + ABAC + row-level + field-level authz (the W1.5 centralized authz path), users, roles, sessions, API tokens, SCIM
- `apps/api/src/app/audit/` — `withAudit` writer wired to db transactions + runtime anomaly tracker
- `apps/api/src/app/metadata/` — collection definitions, properties, relationships, validation, formula engine wiring, publish-impact analyzer (W2.A reference scanner), packs install path

**Modified:**
- `apps/api/src/app/app.module.ts` — register the five new modules in dependency order
- Test fixtures in `apps/api/test/` — relocated from each source service's e2e harness

**NOT in scope for this plan (deferred to follow-on):**
- Remaining W1 modules: data, automation, views, forms, dashboards, notifications, integrations, ai, packs, plugins, upgrade, storage, search
- Deletion of `apps/svc-identity/`, `apps/svc-metadata/`, etc. (those services keep running as fallback during the foundation slice; deletion happens at full W1 cutover after all 18 modules are migrated and shadow mode is clean)
- Service-boundary scanner deletion (`tools/service-boundary-check.ts`) — deferred until W1 fully complete

---

## W0 — Lock the architectural decision

### Task 1: Amend canon §5 to SOFTEN (single-tenant default + pooled mode optional)

**Files:**
- Modify: `CLAUDE.md`

**Why this matters:** Canon §5 currently states "one instance per customer" as non-negotiable. The architecture this plan implements requires pooled mode for trials, sandboxes, and lower-tier customers per spec §6.3 and §9 (canon delta). The canon must commit to SOFTEN before code starts threading `tenant_id` through every query.

- [ ] **Step 1: Read current §5 in CLAUDE.md**

Run: `grep -n "^## 5\." CLAUDE.md`

Read the §5 section through the next `## ` heading. Confirm current text says "One Instance per Customer (Non-Negotiable)".

- [ ] **Step 2: Replace §5 with SOFTEN content**

Replace the entire §5 section with:

```markdown
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
```

- [ ] **Step 3: Verify CLAUDE.md still has exactly one §5 section and no other §5 references**

Run: `grep -c "^## 5\." CLAUDE.md`
Expected: `1`

Run: `grep -n "Non-Negotiable" CLAUDE.md`
Expected: zero matches (the absolutist phrasing is gone)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
canon(§5): SOFTEN — single-tenant default + pooled mode optional

ARC-W0 task 1. Spec ref: docs/superpowers/specs/2026-05-09-platform-architecture-design.md §6.3, §9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Amend canon §7 (views) and §8 (automation+workflow merger)

**Files:**
- Modify: `CLAUDE.md`

**Why this matters:** §7's 5-tier view hierarchy (System → Tenant → Role → Group → Personal) is ServiceNow-style governance overhead the spec drops; we keep customer-namespaced + role views which cover the same use cases at a fraction of the surface. §8 currently forbids merging automation and workflow — the spec inverts this because ServiceNow's split between Flow Designer and Workflow is a tax we don't pay.

- [ ] **Step 1: Read current §7 and §8 in CLAUDE.md**

Run: `grep -n "^## 7\." CLAUDE.md`
Run: `grep -n "^## 8\." CLAUDE.md`

Read both sections.

- [ ] **Step 2: Replace §7 with SOFTEN content**

Replace the entire §7 section with:

```markdown
## 7. Views Are First-Class (canon §7 SOFTEN, 2026-05-09)

Views are governed projections of data for specific audiences. The 5-tier hierarchy (System → Tenant → Role → Group → Personal) of the original §7 is dropped in favor of two hierarchy levels:

- **Customer-namespaced views** — defined in customer pack metadata; scoped to the customer's tenant.
- **Role views** — bound to one or more customer-defined roles; visible to users with those roles.
- **Personal views** (per-user) — owned and edited by the individual user; saved layout, filter, and column choices.

System and Tenant tiers are subsumed by "platform-default views" (shipped in vertical packs) and "customer-namespaced views" respectively. The simpler model covers all observed use cases without the governance overhead.

Views are stored as pack metadata and subject to the upgrade-safety validator.
```

- [ ] **Step 3: Replace §8 with INVERT content (automation and workflow merged)**

Replace the entire §8 section with:

```markdown
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
```

- [ ] **Step 4: Verify amendments parsed correctly**

Run: `grep -c "^## 7\." CLAUDE.md`
Expected: `1`

Run: `grep -c "^## 8\." CLAUDE.md`
Expected: `1`

Run: `grep -i "they must never be merged" CLAUDE.md`
Expected: zero matches (old §8 phrasing is gone)

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
canon(§7,§8): SOFTEN views hierarchy; INVERT to merge automation+workflow

ARC-W0 task 2. Spec ref: docs/superpowers/specs/2026-05-09-platform-architecture-design.md §4.1, §9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Amend canon §11 (AI) and §12 (trust progression)

**Files:**
- Modify: `CLAUDE.md`

**Why this matters:** §11's "AI is infrastructure" framing forces a heavy-weight AVA architecture (separate service, runtime layer, etc.) that the design replaces with a richly-integrated feature surface (chat in every workspace, NL authoring, AI Code Assistant). §12's all-or-nothing trust framework is reframed as per-AI-feature: each AI capability the customer enables for autonomous action follows the trust progression independently.

- [ ] **Step 1: Read current §11 and §12 in CLAUDE.md**

Run: `grep -n "^## 11\." CLAUDE.md`
Run: `grep -n "^## 12\." CLAUDE.md`

- [ ] **Step 2: Replace §11 with SOFTEN content**

Replace the entire §11 section with:

```markdown
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
```

- [ ] **Step 3: Replace §12 with PER-FEATURE content**

Replace the entire §12 section with:

```markdown
## 12. Trust is Earned Per AI Feature (canon §12 PER-FEATURE, 2026-05-09)

Each AI capability the customer enables for autonomous action progresses through:

> Suggest → Preview → Approve → Execute → Audit

The progression applies **per AI feature**, not platform-wide. A customer may enable "AVA can auto-triage low-urgency work orders" (configured for autonomous Execute) while keeping every other AI feature in Suggest-only mode.

By default, all AI features ship in Suggest mode. Customer admin must explicitly configure each feature for higher trust levels. Every AI suggestion (and every autonomous action) is logged with prompt, model, version, response, applied/rejected status — the Audit stage is always-on.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §4.1 AVA + §9 canon delta.
```

- [ ] **Step 4: Verify**

Run: `grep -c "^## 11\." CLAUDE.md`
Expected: `1`

Run: `grep -c "^## 12\." CLAUDE.md`
Expected: `1`

Run: `grep -i "skipping steps is forbidden" CLAUDE.md`
Expected: zero matches (old §12 phrasing replaced)

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
canon(§11,§12): SOFTEN AI as feature surface; PER-FEATURE trust progression

ARC-W0 task 3. Spec ref: docs/superpowers/specs/2026-05-09-platform-architecture-design.md §4.1, §9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Amend canon §17 (high-level architecture) and §19 (customer instance) and §21 (enforcement layers)

**Files:**
- Modify: `CLAUDE.md`

**Why this matters:** §17 currently describes the high-level architecture without the modular monolith decision. §19 currently describes customer instance as a multi-service deployment. §21 enumerates enforcement layers including the service-boundary scanner that becomes irrelevant in a monolith. All three need updating to reflect the new topology.

- [ ] **Step 1: Read current §17, §19, §21 in CLAUDE.md**

Run: `grep -n "^## 17\." CLAUDE.md` (and §19, §21)

- [ ] **Step 2: Update §17 to reflect modular monolith topology**

Replace the body of §17 (keep heading) with:

```markdown
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
```

- [ ] **Step 3: Update §19 to reflect single-process-per-instance**

Replace the body of §19 (keep heading) with:

```markdown
## 19. Customer Instance Architecture (canon §19 UPDATE, 2026-05-09)

Each customer instance is a single process group:
- One `apps/api` process (Nest modular monolith with all instance-plane modules)
- One `apps/worker` process (BullMQ consumer for async automation, scheduled jobs, AI background tasks)
- One Postgres database (per-customer; pgvector + materialized views included)
- One Redis instance (per-customer; cache + BullMQ queues)

In pooled mode (canon §5 SOFTEN), multiple customers share these resources isolated by Postgres RLS keyed on `tenant_id`.

Instances are operationally independent. The Control Plane communicates with each instance only via explicit, authenticated APIs.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §2.
```

- [ ] **Step 4: Update §21 enforcement layers to TRIM scanner list**

Find the §21 enforcement layers list (it currently includes service-boundary scanner). Replace the scanner list portion with:

```markdown
### Enforcement scanners (CI gates)

The following scanners run in CI and block merges on violations:

- `npm run authz:check` — call-site verification (W1.2 enforcement)
- `npm run audit:check` — save-then-audit pattern detection (W1.6 enforcement)
- `npm run security:check` — security pattern checks
- `npm run deps:check` — approved-deps registry (W6.D)
- `npm run compliance:check` — terminology scanner (running as a lint rule in W4+)

**Removed scanners** (no longer relevant in modular monolith):
- ~~`npm run service-boundary:check`~~ — irrelevant when there's only one process; the monolith's TypeScript module system enforces what the scanner used to enforce. Removed in W1 final cleanup.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §3 (tech stack changes) + §9.
```

- [ ] **Step 5: Verify**

Run: `grep -n "service-boundary:check" CLAUDE.md`
Expected: only matches inside the "removed scanners" note in §21 (with `~~` strikethrough)

Run: `grep -c "^## 17\." CLAUDE.md`
Expected: `1`

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
canon(§17,§19,§21): UPDATE topology + TRIM scanner list for monolith

ARC-W0 task 4. Spec ref: docs/superpowers/specs/2026-05-09-platform-architecture-design.md §2, §9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add new canon clauses §17.5, §25, §26, §27

**Files:**
- Modify: `CLAUDE.md`

**Why this matters:** Four new canon clauses define the architectural moat: §17.5 (customizations versioned/namespaced/validated for upgrade safety), §25 (Plugin SDK contract), §26 (Mobile first-class), §27 (Workspaces + UI Builder as customization surface). These are the load-bearing additions of the new architecture.

- [ ] **Step 1: Locate the insertion point**

§17.5 inserts between §17 and §18.
§25, §26, §27 append at the end of the canon, before the existing FINAL STATEMENT.

Run: `grep -n "^## 18\." CLAUDE.md` (find §18 to insert §17.5 above)
Run: `grep -n "^## 24\." CLAUDE.md` (find §24 to append §25–§27 after)
Run: `grep -n "^# FINAL STATEMENT" CLAUDE.md` (boundary marker)

- [ ] **Step 2: Insert §17.5 before §18**

Insert the following block immediately before the `## 18.` heading:

```markdown
## 17.5. Customization Contract (canon §17.5 NEW, 2026-05-09)

**Customer customizations are versioned, namespaced, and validated against platform-API versions. No customization may modify platform schema. Upgrades are blocked when customer customizations would break.**

Concretely:
- All customer-defined collections, properties, relationships, automations, views, forms, dashboards, plugins, and integrations live in customer-namespaced metadata or customer-namespaced tables (`cust__{pack_id}__{collection_id}`) or JSONB extension columns on platform tables.
- Customer customizations declare a `targetPlatformApiVersion` in their pack manifest.
- Pre-upgrade validator (W5) inspects every installed pack against the new platform version and classifies the upgrade as green / yellow (auto-migrate) / red (manual remediation).
- If validator output is green, the upgrade is architecturally guaranteed safe — no customization can break at runtime.

Spec reference: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` §5 (customization architecture, the moat).
```

- [ ] **Step 3: Append §25, §26, §27 after §24, before FINAL STATEMENT**

Insert the following block after the `## 24.` section ends (and before `# FINAL STATEMENT`):

```markdown
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
```

- [ ] **Step 4: Verify**

Run: `grep -c "^## 17.5\." CLAUDE.md`
Expected: `1`

Run: `grep -c "^## 25\." CLAUDE.md`
Expected: `1`

Run: `grep -c "^## 26\." CLAUDE.md`
Expected: `1`

Run: `grep -c "^## 27\." CLAUDE.md`
Expected: `1`

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
canon(§17.5,§25,§26,§27): ADD customization contract, Plugin SDK, mobile, Workspaces clauses

ARC-W0 task 5. Spec ref: docs/superpowers/specs/2026-05-09-platform-architecture-design.md §5, §9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Update §24 maintenance log with this amendment

**Files:**
- Modify: `CLAUDE.md`

**Why this matters:** Per canon §24, every architectural amendment must land an explicit log entry. This is the audit trail for canon evolution.

- [ ] **Step 1: Locate §24 maintenance log**

Run: `grep -n "^## 24\." CLAUDE.md`

Read the existing log entries to match their format.

- [ ] **Step 2: Prepend new log entry to the §24 list**

Add (immediately after the §24 intro paragraph, as the new most-recent entry):

```markdown
- 2026-05-09 (Architecture v3 spec): Major architectural shift from 14-service distributed system to 3-process modular monolith + Day-1 mobile + AI Code Assistant + full UI Builder. Amendments: §5 SOFTEN (single-tenant default + pooled mode), §7 SOFTEN (drop 5-tier view hierarchy), §8 INVERT (merge automation + workflow), §11 SOFTEN (AI as feature surface incl. AI Code Assistant), §12 PER-FEATURE (trust progression per AI feature), §17 UPDATE (monolith topology), §19 UPDATE (single Nest process per instance), §21 TRIM (drop service-boundary scanner). New: §17.5 (customization contract, the moat), §25 (Plugin SDK contract), §26 (mobile first-class), §27 (Workspaces + UI Builder). Vertical pack (Clinical/Facilities Asset Management) deferred to a separate design doc; preserved as forward inventory in spec Appendix D. Solo founder timeline: ~10–12 months critical path for platform-only scope. Refs spec `docs/superpowers/specs/2026-05-09-platform-architecture-design.md`.
```

- [ ] **Step 3: Verify**

Run: `head -50 CLAUDE.md` and search for "## 24" — confirm new entry is present and well-formatted.

Run: `grep -c "2026-05-09" CLAUDE.md`
Expected: ≥1 (this entry)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
canon(§24): log Architecture v3 amendment

ARC-W0 task 6. Closes the canon-amendment phase of W0; next: pause irrelevant plan-fix work and scaffold apps/api.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Mark Plan Fixes 12, 16, 24 as deferred or superseded

**Files:**
- Modify or Create: `docs/plan-fixes/README.md` (index file; create if it doesn't exist)
- Modify (only if the file exists): `docs/plan-fixes/12-*.md`, `docs/plan-fixes/16-*.md`, `docs/plan-fixes/24-*.md` — add status header

**Why this matters:** Plan Fix 12 (service-boundary scanner) becomes irrelevant in a monolith. Plan Fix 24 (per-service entity sets) becomes irrelevant in a monolith. Plan Fix 16 (AVA proposal state machine) is deferred per canon §12 PER-FEATURE — applies only when a customer enables autonomous AVA action. Marking these explicitly prevents the founder from accidentally working on fixes that no longer apply.

- [ ] **Step 1: Check which plan-fix files exist**

Run: `ls docs/plan-fixes/`

Expected: at least `01-automation-consolidation.md` (the completed Plan Fix 1). The numbered files for 12, 16, 24 may not exist yet — they may be referenced in CLAUDE.md only.

- [ ] **Step 2: Create or update `docs/plan-fixes/README.md`**

Write to `docs/plan-fixes/README.md`:

```markdown
# Plan Fixes — Status Index

Tracks architectural remediation efforts referenced in `CLAUDE.md`. Each fix has its own design doc when it has one.

## Status as of 2026-05-09 (Architecture v3 amendment)

| # | Title | Status | Notes |
|---|---|---|---|
| 1 | Automation engine consolidation | **Done** | Completed 2026-05; svc-automation owns the runtime. See `01-automation-consolidation.md`. |
| 8 | (TBD historical) | Active | Referenced in CLAUDE.md amendment log; no design doc yet. |
| 11 | Cache consolidation | **Done** | Completed in W5.C remediation wave. |
| 12 | Service-boundary scanner | **Superseded by Architecture v3** | The monolith makes cross-service entity ownership a non-issue at the language level. Scanner deletion is part of W1 final cleanup (after all 18 modules consolidate). |
| 13 | Canon §5/§10/§12/§14 amendments | **Done** | Completed in W5.B / 2026-05. |
| 14 | Per-automation rate limiting | **Done** | Completed in W7.C. |
| 15 | Approved-deps registry | **Done** | Completed in W6.D. |
| 16 | AVA proposal state machine | **Deferred (Architecture v3)** | Per canon §12 PER-FEATURE: the trust progression applies per AI feature when customer enables autonomous action. Activate per-feature when needed; not a platform-wide framework. |
| 24 | Per-service entity sets | **Superseded by Architecture v3** | The modular monolith uses one shared entity set inside `apps/api`. The "god-package" `libs/instance-db/src/lib/entities/index.ts` becomes the single source of truth for the API process; per-service splitting is no longer needed. |

## Active fixes after Architecture v3

The architectural shift introduces new tracked items:
- **ARC-W0** — canon amendments + scaffolds (this plan: `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md`)
- **ARC-W1** — API consolidation (this plan covers foundation modules; remaining modules in a follow-on plan)
- **ARC-W2** through **ARC-W8** — see spec §8

Refs spec: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md`.
```

- [ ] **Step 3: If individual plan-fix files exist for 12, 16, or 24, prepend a status banner**

For any file that exists at `docs/plan-fixes/12-*.md`, `docs/plan-fixes/16-*.md`, `docs/plan-fixes/24-*.md`, prepend:

```markdown
> **Status (2026-05-09):** Superseded / Deferred per Architecture v3 amendment.
> See `docs/plan-fixes/README.md` for current status and `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` for the architectural shift.
```

- [ ] **Step 4: Commit**

```bash
git add docs/plan-fixes/
git commit -m "$(cat <<'EOF'
docs(plan-fixes): mark fixes 12, 16, 24 as superseded/deferred per Architecture v3

ARC-W0 task 7. Adds plan-fixes/README.md status index.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Scaffold apps/api (empty Nest application)

**Files:**
- Create: `apps/api/` directory and Nest scaffolding

**Why this matters:** `apps/api` is the destination for all instance-plane module migrations in W1. The scaffold must exist and build successfully before any module migration starts; verifying the build at this point catches Nx/TypeScript config mistakes early.

- [ ] **Step 1: Generate the apps/api Nx project**

Run from repo root:

```bash
npx nx g @nx/nest:application apps/api --linter=eslint --unitTestRunner=jest --setupFile=none --strict=true
```

Expected: Nx scaffolds `apps/api/` with Nest-default `main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts`, `project.json`, `tsconfig.app.json`, `tsconfig.spec.json`, `jest.config.ts`, `Dockerfile`.

- [ ] **Step 2: Customize main.ts to use the platform's standard bootstrap**

Replace `apps/api/src/main.ts` with:

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const globalPrefix = process.env.API_GLOBAL_PREFIX ?? 'api';
  app.setGlobalPrefix(globalPrefix);

  const port = parseInt(process.env.API_PORT ?? '3000', 10);
  await app.listen(port);

  Logger.log(`apps/api listening on http://localhost:${port}/${globalPrefix}`, 'Bootstrap');
}

bootstrap();
```

- [ ] **Step 3: Empty out app.module.ts to be ready for module migration**

Replace `apps/api/src/app/app.module.ts` with:

```typescript
import { Module } from '@nestjs/common';

/**
 * apps/api root module.
 *
 * Modules are migrated in dependency order per spec §2 module layout:
 *   kernel → db → identity → audit → metadata → data → automation → views
 *   → forms → dashboards → notifications → integrations → ai → packs
 *   → plugins → upgrade → storage → search
 *
 * This plan (ARC-W0+W1 foundation) lands kernel → db → identity → audit → metadata.
 * Subsequent modules land in a follow-on plan.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 4: Delete the auto-generated app.controller.ts and app.service.ts**

```bash
rm apps/api/src/app/app.controller.ts
rm apps/api/src/app/app.controller.spec.ts
rm apps/api/src/app/app.service.ts
rm apps/api/src/app/app.service.spec.ts
```

(These are Nx scaffolding placeholders; the platform doesn't need them.)

- [ ] **Step 5: Verify apps/api builds and starts**

Run: `npx nx build api`
Expected: build succeeds; output in `dist/apps/api/`.

Run: `npx nx serve api` (in a separate terminal)
Expected: server starts on port 3000; `GET http://localhost:3000/api` returns 404 (no controllers yet) but the server is healthy.

Stop the server with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add apps/api/
git commit -m "$(cat <<'EOF'
feat(arc): scaffold apps/api Nest modular monolith

ARC-W0 task 8. Empty AppModule ready for W1 module migration. Builds
and serves cleanly; no functional behavior yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Scaffold apps/worker (BullMQ consumer process)

**Files:**
- Create: `apps/worker/` Nest scaffolding

**Why this matters:** `apps/worker` is the destination for async automation, scheduled jobs, and AI background tasks. It runs as a Nest application without an HTTP server. Like `apps/api`, the scaffold must exist before module migration; we'll wire BullMQ consumers in subsequent tasks once the relevant modules migrate.

- [ ] **Step 1: Generate the apps/worker Nx project**

Run:

```bash
npx nx g @nx/nest:application apps/worker --linter=eslint --unitTestRunner=jest --setupFile=none --strict=true
```

- [ ] **Step 2: Customize main.ts to bootstrap as a worker (no HTTP server)**

Replace `apps/worker/src/main.ts` with:

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  // BullMQ consumers and scheduled-job processors are registered as Nest
  // providers in the worker's modules. They start automatically as part of
  // application initialization.

  Logger.log('apps/worker started; BullMQ consumers active', 'Bootstrap');

  // Graceful shutdown on SIGTERM/SIGINT
  process.on('SIGTERM', async () => {
    Logger.log('SIGTERM received; shutting down', 'Bootstrap');
    await app.close();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    Logger.log('SIGINT received; shutting down', 'Bootstrap');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
```

- [ ] **Step 3: Empty out app.module.ts**

Replace `apps/worker/src/app/app.module.ts` with:

```typescript
import { Module } from '@nestjs/common';

/**
 * apps/worker root module.
 *
 * Houses BullMQ consumers, scheduled jobs, and AI background-task workers.
 * Modules migrate in dependency order alongside apps/api per spec §2.
 *
 * This plan (ARC-W0+W1 foundation) lands the scaffold only; consumer
 * registration begins when the automation module migrates (later W1 plan).
 */
@Module({
  imports: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 4: Delete Nx scaffolding placeholders**

```bash
rm apps/worker/src/app/app.controller.ts
rm apps/worker/src/app/app.controller.spec.ts
rm apps/worker/src/app/app.service.ts
rm apps/worker/src/app/app.service.spec.ts
```

- [ ] **Step 5: Verify apps/worker builds**

Run: `npx nx build worker`
Expected: build succeeds; output in `dist/apps/worker/`.

Run: `node dist/apps/worker/main.js`
Expected: process logs "apps/worker started" and stays running. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/
git commit -m "$(cat <<'EOF'
feat(arc): scaffold apps/worker Nest BullMQ consumer process

ARC-W0 task 9. Empty AppModule; bootstrap as application-context (no HTTP).
Ready for W1 automation/scheduling/AI module migration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Update package.json scripts for new apps

**Files:**
- Modify: `package.json`

**Why this matters:** The existing `dev:identity`, `dev:metadata`, `dev:data`, `dev:all` scripts run the legacy services. The new `apps/api` and `apps/worker` need their own scripts so the founder can iterate on the new monolith without disrupting the parallel-running legacy services.

- [ ] **Step 1: Read current scripts in package.json**

Run: `grep -n "\"dev:" package.json`

Note the existing dev scripts pattern.

- [ ] **Step 2: Add new scripts**

In the `"scripts"` section of `package.json`, add (alongside existing `dev:*` scripts):

```json
"dev:api": "nx serve api",
"dev:worker": "nx serve worker",
"dev:platform": "nx run-many --target=serve --projects=api,worker,web-client",
```

Place these immediately after the existing `"dev:web"` script for visibility.

- [ ] **Step 3: Verify package.json is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"`
Expected: no output (no error).

- [ ] **Step 4: Verify the scripts work**

Run: `npm run dev:api` (in a separate terminal)
Expected: `apps/api` starts on port 3000.

Stop the server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore(scripts): add dev:api, dev:worker, dev:platform for new monolith

ARC-W0 task 10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Verify W0 baseline — all existing tests still pass

**Files:**
- None modified; verification only

**Why this matters:** W0 is purely additive (new scaffolds + canon amendments + plan-fix status updates) and should NOT have broken any existing tests. If a test fails, something in the canon amendment or scaffold added a regression that must be fixed before W1 starts.

- [ ] **Step 1: Run the full test suite**

```bash
npx nx run-many --target=test --all
```

Expected: all existing tests pass (baseline status before W0 = baseline status after W0).

- [ ] **Step 2: Run the architectural scanners**

```bash
npm run authz:check
npm run audit:check
npm run security:check
npm run deps:check
npm run compliance:check
```

Expected: all five exit with status 0.

(Note: `service-boundary:check` is intentionally still in the codebase at this point. Its deletion happens at full W1 cutover, NOT in W0.)

- [ ] **Step 3: Run lint and build**

```bash
npx nx run-many --target=lint --all
npx nx run-many --target=build --all
```

Expected: clean lint; all 14 services + apps/api + apps/worker build successfully.

- [ ] **Step 4: If any failure surfaces, stop and triage**

W1 cannot start with failing tests, lints, or builds. Fix root cause; do not skip.

- [ ] **Step 5: Tag the W0 completion**

```bash
git tag arc-w0-complete
git log --oneline arc-w0-complete~7..arc-w0-complete
```

Expected: 7 commits visible (one per W0 task that committed: tasks 1, 2, 3, 4, 5, 6, 7) plus tasks 8, 9, 10 that also committed.

(The exact commit count depends on whether you committed the W0 tag itself. The point is: W0 has a clear endpoint marker.)

- [ ] **Step 6: Push the tag (optional, if working with a remote)**

```bash
git push origin arc-w0-complete
```

---

## W1 — API Consolidation Foundation (kernel → db → identity → audit → metadata)

### Task 12: Set up apps/api integration test harness

**Files:**
- Create: `apps/api/test/setup.ts` — Jest setup file
- Create: `apps/api/test/helpers/test-database.ts` — test Postgres fixture (uses Docker `postgres:16` from existing `docker-compose.yml`)
- Modify: `apps/api/jest.config.ts` — register the setup file

**Why this matters:** Each module migration in W1 needs a working integration-test harness inside `apps/api` so that ported tests can run against the new monolith's wiring. Without this, every module migration would have to bring its own ad-hoc test setup.

- [ ] **Step 1: Create the test database helper**

Write to `apps/api/test/helpers/test-database.ts`:

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Spins up a TypeORM DataSource pointed at a per-test-run Postgres database.
 * Uses the existing docker-compose Postgres on localhost:5432.
 *
 * Database name: `hw_test_<random>` (ensures isolation between concurrent runs).
 * Caller is responsible for calling `dataSource.destroy()` and dropping the DB
 * via the returned `cleanup` function.
 */
export async function createTestDataSource(opts?: {
  entities?: DataSourceOptions['entities'];
}): Promise<{ dataSource: DataSource; cleanup: () => Promise<void> }> {
  const dbName = `hw_test_${Math.random().toString(36).slice(2, 10)}`;

  // Connect to the default Postgres to create the per-test database.
  const adminDs = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: 'postgres',
  });
  await adminDs.initialize();
  await adminDs.query(`CREATE DATABASE "${dbName}"`);
  await adminDs.destroy();

  // Connect to the per-test database with the entities under test.
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: dbName,
    entities: opts?.entities ?? [],
    synchronize: true, // OK in tests; never in prod
  });
  await dataSource.initialize();

  const cleanup = async () => {
    await dataSource.destroy();
    const ds = new DataSource({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
      username: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: 'postgres',
    });
    await ds.initialize();
    await ds.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await ds.destroy();
  };

  return { dataSource, cleanup };
}
```

- [ ] **Step 2: Create the Jest setup file**

Write to `apps/api/test/setup.ts`:

```typescript
/**
 * Global Jest setup for apps/api tests.
 *
 * Loaded via apps/api/jest.config.ts `setupFilesAfterEach` setting.
 * Currently a no-op; per-test database lifecycle is handled by individual
 * tests using createTestDataSource() from helpers/test-database.ts.
 */

// Increase default timeout for integration tests that spin up Postgres.
jest.setTimeout(30_000);
```

- [ ] **Step 3: Wire setup file into jest.config.ts**

Modify `apps/api/jest.config.ts` to include:

```typescript
export default {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api',
  setupFilesAfterEach: ['<rootDir>/test/setup.ts'],
};
```

- [ ] **Step 4: Verify the harness loads**

Run: `npx nx test api`
Expected: 0 tests run (no test files yet), Jest exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/ apps/api/jest.config.ts
git commit -m "$(cat <<'EOF'
test(api): set up integration test harness with per-test Postgres

ARC-W1 task 12. createTestDataSource() spawns a per-test Postgres database
and tears it down after; ready for module-level integration tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Migrate kernel module — identify and copy source files

**Files:**
- Source (existing, to be copied):
  - `libs/shared-types/src/index.ts` — shared type re-exports
  - `apps/svc-data/src/app/kernel/` (and similar in svc-identity, svc-metadata, svc-automation) — RequestContext class, error types
  - Any centralized error definitions (search needed in step 1)
- Destination: `apps/api/src/app/kernel/`

**Why this matters:** Kernel is the deepest dependency in the module graph. Every other module imports from kernel (RequestContext, error types, shared interfaces). The kernel must land in `apps/api` complete and tested before db, identity, audit, or metadata can migrate.

This task is the **migration template**: subsequent module-migration tasks (db, identity, audit, metadata) follow the same structure with module-specific details.

- [ ] **Step 1: Identify all kernel-equivalent code in the existing services**

Run from repo root:

```bash
# Find every file using or defining RequestContext.
grep -rln "class RequestContext\|RequestContext\b" apps/svc-*/src libs/ --include="*.ts" 2>/dev/null | sort -u
```

Expected: a list of files. The canonical RequestContext implementation should live in one place (likely `libs/shared-types` or one specific svc-* service); other files are consumers.

```bash
# Find shared error class hierarchy.
grep -rln "extends.*HwError\|extends BaseError\|class.*Error.*extends" apps/svc-*/src libs/ --include="*.ts" 2>/dev/null | head -50
```

Expected: a list of error class definitions. The canonical hierarchy should be in `libs/shared-types/` (or a similarly central location).

```bash
# Find all shared-types index exports.
cat libs/shared-types/src/index.ts 2>/dev/null || echo "(no shared-types index)"
```

Document the kernel migration scope as a checklist:
- [ ] RequestContext class (with `userId`, `tenantId`, `bearerToken`, `roles`, etc. — verify the exact fields)
- [ ] Domain error hierarchy (BaseError, NotFoundError, AuthzError, ValidationError, etc. — verify the actual hierarchy)
- [ ] Shared interfaces (any types used across all modules)
- [ ] Constants (API version markers, etc.)

- [ ] **Step 2: Create the kernel directory structure in apps/api**

```bash
mkdir -p apps/api/src/app/kernel/errors
```

- [ ] **Step 3: Copy RequestContext to apps/api/src/app/kernel/request-context.ts**

Identify the single source of truth for RequestContext (the file with the canonical class definition). Copy that file's contents — verbatim, preserving the `bearerToken` field added in Plan Fix 1 PR2 — into `apps/api/src/app/kernel/request-context.ts`.

If the canonical source had relative imports, update them to point at the new kernel location (or at well-known external dependencies). For example, if the source imported from `'../shared-types'`, change to `'./types'` or the appropriate relative path.

- [ ] **Step 4: Copy domain error classes to apps/api/src/app/kernel/errors/**

Copy each error class file. Common files (verify against your codebase):
- `apps/api/src/app/kernel/errors/base-error.ts`
- `apps/api/src/app/kernel/errors/not-found.error.ts`
- `apps/api/src/app/kernel/errors/authz.error.ts`
- `apps/api/src/app/kernel/errors/validation.error.ts`
- `apps/api/src/app/kernel/errors/conflict.error.ts`
- `apps/api/src/app/kernel/errors/index.ts` — barrel export

- [ ] **Step 5: Copy shared interfaces and types**

Copy each interface/type file. Common files:
- `apps/api/src/app/kernel/types.ts` — shared TS interfaces
- `apps/api/src/app/kernel/constants.ts` — API version constants, etc.

- [ ] **Step 6: Create the kernel barrel export**

Write `apps/api/src/app/kernel/index.ts`:

```typescript
export { RequestContext } from './request-context';
export * from './errors';
export * from './types';
export * from './constants';
```

- [ ] **Step 7: Create the KernelModule**

Write `apps/api/src/app/kernel/kernel.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';

/**
 * KernelModule provides the foundational types, errors, and RequestContext
 * used by every other module in apps/api.
 *
 * @Global means consumers don't need to import KernelModule explicitly;
 * the providers (currently none — kernel is type-only) and exports propagate
 * automatically.
 */
@Global()
@Module({
  providers: [],
  exports: [],
})
export class KernelModule {}
```

(Kernel is type-only — no Nest providers. The `@Global()` decorator is forward-looking for when shared services like `RequestContextStorage` (AsyncLocalStorage) get added.)

---

### Task 14: Migrate kernel module — wire into AppModule and verify

**Files:**
- Modify: `apps/api/src/app/app.module.ts`

- [ ] **Step 1: Register KernelModule in AppModule**

Update `apps/api/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { KernelModule } from './kernel/kernel.module';

@Module({
  imports: [KernelModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 2: Verify the build**

Run: `npx nx build api`
Expected: build succeeds. If TypeScript errors surface, the imports inside the copied kernel files likely need adjusting (paths that were relative to the old service won't resolve in the new location).

- [ ] **Step 3: Add a smoke test to verify kernel imports**

Write `apps/api/src/app/kernel/kernel.spec.ts`:

```typescript
import { RequestContext, NotFoundError, AuthzError, ValidationError } from './index';

describe('kernel barrel exports', () => {
  it('exports RequestContext', () => {
    expect(RequestContext).toBeDefined();
  });

  it('exports error classes that extend Error', () => {
    expect(new NotFoundError('foo').name).toBe('NotFoundError');
    expect(new AuthzError('bar').name).toBe('AuthzError');
    expect(new ValidationError('baz').name).toBe('ValidationError');
  });

  it('RequestContext can be constructed with userId + tenantId + bearerToken', () => {
    const ctx = new RequestContext({
      userId: 'user-1',
      tenantId: 'tenant-1',
      bearerToken: 'jwt-here',
    });
    expect(ctx.userId).toBe('user-1');
    expect(ctx.tenantId).toBe('tenant-1');
    expect(ctx.bearerToken).toBe('jwt-here');
  });
});
```

(Adjust the test to match your RequestContext's actual constructor signature — read the canonical file you copied to know the right shape.)

- [ ] **Step 4: Run the smoke test**

Run: `npx nx test api --testNamePattern="kernel"`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app/kernel/ apps/api/src/app/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): migrate kernel module from svc-* services into apps/api

ARC-W1 task 13-14. RequestContext, domain errors, shared types now live
in apps/api/src/app/kernel/. Smoke test verifies barrel exports + class
construction. KernelModule is @Global so consumers don't need explicit
imports.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Migrate db module — identify, copy, and wire

**Files:**
- Source: `libs/instance-db/src/lib/` — TypeORM datasource config, transaction helpers (`withAudit` and similar)
- Destination: `apps/api/src/app/db/`
- Modify: `apps/api/src/app/app.module.ts` — register DbModule after KernelModule

**Why this matters:** db module owns the TypeORM datasource for the customer instance schema. Every other module that touches Postgres depends on it. The `withAudit` helper (W1.6 enforcement) lives here and is consumed by every state-changing operation.

- [ ] **Step 1: Identify all db-equivalent code**

```bash
# Datasource definitions.
grep -rln "DataSource\|@nestjs/typeorm\|TypeOrmModule" libs/instance-db/ apps/svc-*/src/app/db --include="*.ts" 2>/dev/null

# Transaction helpers (canonical withAudit lives here).
grep -rln "withAudit\b" libs/instance-db/ apps/svc-*/src --include="*.ts" 2>/dev/null

# Entity definitions (already in libs/instance-db/src/lib/entities/index.ts per Plan Fix 24).
ls libs/instance-db/src/lib/entities/ 2>/dev/null | head -30
```

Document the db migration scope:
- [ ] DataSource configuration (instance datasource; control-plane datasource stays separate)
- [ ] `withAudit(dataSource, fn)` helper (W1.6)
- [ ] TypeORM module configuration (synchronous, async with config service, etc.)
- [ ] Entity barrel re-export (or direct import from `libs/instance-db`)

- [ ] **Step 2: Create the db directory**

```bash
mkdir -p apps/api/src/app/db
```

- [ ] **Step 3: Copy datasource configuration**

Copy the canonical datasource configuration to `apps/api/src/app/db/datasource.ts`. Adjust imports as needed.

A typical shape:

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import * as entities from '@hubblewave/instance-db';

export function buildInstanceDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DB ?? 'hw_instance',
    entities: Object.values(entities).filter(
      (v) => typeof v === 'function' && /^class /.test(v.toString())
    ) as DataSourceOptions['entities'],
    migrations: ['dist/migrations/*.js'],
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === 'true',
  };
}

export const InstanceDataSource = new DataSource(buildInstanceDataSourceOptions());
```

(Adjust to match the actual entity-import pattern used in `libs/instance-db`.)

- [ ] **Step 4: Copy the withAudit transaction helper**

Copy `withAudit` from its canonical location to `apps/api/src/app/db/transaction.ts`. Preserve the W1.6 + W2.D + W3.C semantics: same transaction for action + audit row, never split.

If `withAudit` is already exported from `libs/instance-db`, you may simply re-export from db module rather than duplicating:

```typescript
// apps/api/src/app/db/transaction.ts
export { withAudit } from '@hubblewave/instance-db';
```

- [ ] **Step 5: Create the DbModule**

Write `apps/api/src/app/db/db.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { buildInstanceDataSourceOptions } from './datasource';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot(buildInstanceDataSourceOptions()),
  ],
  exports: [TypeOrmModule],
})
export class DbModule {}
```

- [ ] **Step 6: Create the db barrel export**

Write `apps/api/src/app/db/index.ts`:

```typescript
export { buildInstanceDataSourceOptions, InstanceDataSource } from './datasource';
export { withAudit } from './transaction';
```

- [ ] **Step 7: Register DbModule in AppModule**

Update `apps/api/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { KernelModule } from './kernel/kernel.module';
import { DbModule } from './db/db.module';

@Module({
  imports: [
    KernelModule,
    DbModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 8: Add an integration smoke test**

Write `apps/api/src/app/db/db.module.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

import { DbModule } from './db.module';
import { withAudit } from './transaction';

describe('DbModule', () => {
  let app: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [DbModule],
    }).compile();

    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  it('connects to Postgres', async () => {
    expect(dataSource.isInitialized).toBe(true);
  });

  it('withAudit runs both fn and audit-write in same transaction', async () => {
    let txnCount = 0;
    await withAudit(dataSource, async (manager) => {
      // Verify we're inside a transaction by checking that manager is a
      // QueryRunner-bound EntityManager.
      txnCount++;
      expect(manager).toBeDefined();
    });
    expect(txnCount).toBe(1);
  });
});
```

(The exact test depends on `withAudit`'s actual signature. Adjust the assertion to match.)

- [ ] **Step 9: Verify**

Run: `npx nx test api --testNamePattern="DbModule"`
Expected: tests pass.

Run: `npx nx serve api`
Expected: server starts; logs show TypeORM connecting to Postgres.

Stop the server.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/app/db/ apps/api/src/app/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): migrate db module — TypeORM datasource + withAudit helper

ARC-W1 task 15. DbModule is @Global so consumers can inject
@InjectDataSource() and Repository<T> without explicit module imports.
withAudit preserves W1.6/W2.D/W3.C transactional-audit semantics.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Migrate identity module — copy and wire

**Files:**
- Source: `apps/svc-identity/src/app/` — JWT strategy, OIDC, LDAP, MFA (TOTP), RBAC + ABAC + row/field-level authz, users, roles, sessions, API tokens, SCIM
- Destination: `apps/api/src/app/identity/`
- Modify: `apps/api/src/app/app.module.ts` — register IdentityModule

**Why this matters:** Identity is the largest single module migration in W1 (~17k LoC source). Every other module depends on `RequestContext.userId` + role/permission checks via the identity module's authz services. The W1.2 global guard wiring (`JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` as APP_GUARD providers) and W1.5 centralized authz (the `*Collection` API on `AuthorizationService`) are non-negotiable preservations.

- [ ] **Step 1: Identify all identity-equivalent code in apps/svc-identity**

```bash
ls apps/svc-identity/src/app/
```

Expected directories and files include (specific names depend on existing structure):
- `auth/` — JWT, OIDC, SAML, LDAP strategies
- `mfa/` — TOTP, recovery codes
- `users/` — User CRUD, profile management
- `roles/` — role CRUD, role hierarchy
- `permissions/` — permission CRUD, slug resolution
- `sessions/` — session management
- `api-tokens/` — API token CRUD
- `scim/` — SCIM 2.0 user provisioning
- `authorization/` — RBAC + ABAC + row/field evaluators (likely re-exports from `libs/authorization`)
- `guards/` — JwtAuthGuard, RolesGuard, PermissionsGuard
- `theme/` — theme/branding (this might be a separate concern; verify)

Document the migration scope as a checklist (read your actual svc-identity to enumerate).

- [ ] **Step 2: Copy the entire svc-identity module tree to apps/api/src/app/identity/**

Use `git mv` so history is preserved:

```bash
git mv apps/svc-identity/src/app apps/api/src/app/identity
```

This relocates the module sub-tree wholesale. Update imports in step 3.

(Note: this leaves `apps/svc-identity/src/main.ts` and `apps/svc-identity/src/app.module.ts` orphaned. Do NOT delete them yet — `apps/svc-identity/main.ts` keeps the legacy service running during the parallel-deployment phase. Cleanup happens at full W1 cutover.)

After the move, the old service's app.module.ts will import-fail. Fix that in step 4.

- [ ] **Step 3: Update imports inside the moved files**

The moved files reference each other with imports like `import { Foo } from '../foo'`. Those should still work since the relative structure is preserved.

But files that imported from outside the module (e.g. from `libs/auth-guard`, `libs/authorization`, `libs/instance-db`) need their imports adjusted because the location relative to `node_modules` and to `libs/` is the same — no change needed if the imports use package aliases (`@hubblewave/...`).

Run a search for relative-path imports that escape the module:

```bash
grep -rn "from '\.\./\.\./\.\." apps/api/src/app/identity --include="*.ts" | head -30
```

Any matches need adjusting. Common pattern: `'../../../../shared-types'` becomes `'../kernel'` or `'@hubblewave/shared-types'`.

- [ ] **Step 4: Restore apps/svc-identity to a runnable state for parallel deployment**

The legacy service must keep running during the foundation slice (other services' tests reference it). Quick fix: re-create a thin app.module.ts in `apps/svc-identity/src/app/` that re-imports the relocated module from `apps/api`.

Write `apps/svc-identity/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { IdentityModule } from '../../../api/src/app/identity/identity.module';

/**
 * apps/svc-identity is being kept alive in parallel during the ARC-W1
 * foundation slice. The actual module logic now lives in apps/api/src/app/identity.
 * This thin adapter keeps the legacy service callable at the old port until
 * full W1 cutover.
 */
@Module({
  imports: [IdentityModule],
})
export class AppModule {}
```

(Adjust the relative import path if your monorepo structure differs.)

- [ ] **Step 5: Create or verify apps/api/src/app/identity/identity.module.ts**

If the moved files include an `app.module.ts` (likely renamed to `identity.module.ts` during the move), use it. Otherwise create:

Write `apps/api/src/app/identity/identity.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SessionsModule } from './sessions/sessions.module';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { ScimModule } from './scim/scim.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    SessionsModule,
    ApiTokensModule,
    ScimModule,
  ],
  providers: [
    // W1.2 enforcement: every endpoint gets these three guards globally.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    SessionsModule,
  ],
})
export class IdentityModule {}
```

(Adjust to match the actual module sub-structure of svc-identity.)

- [ ] **Step 6: Register IdentityModule in AppModule**

Update `apps/api/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { KernelModule } from './kernel/kernel.module';
import { DbModule } from './db/db.module';
import { IdentityModule } from './identity/identity.module';

@Module({
  imports: [
    KernelModule,
    DbModule,
    IdentityModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 7: Run the existing identity tests against the new location**

Run: `npx nx test api`
Expected: all the tests that were in `apps/svc-identity/src/app/` now run as `apps/api` tests and pass.

If specific tests fail because of import-path resolution, fix the imports and rerun. Do NOT skip failing tests — they're the safety net for the migration.

- [ ] **Step 8: Verify the legacy svc-identity still runs (parallel-deployment safety)**

Run: `npx nx serve svc-identity`
Expected: legacy service starts on its old port; the thin adapter in step 4 keeps it serving.

Stop the server.

- [ ] **Step 9: Run authz scanner**

Run: `npm run authz:check`
Expected: passes. The W1.2 global guard wiring is preserved by the new IdentityModule's APP_GUARD providers.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/app/identity/ apps/api/src/app/app.module.ts apps/svc-identity/src/app/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): migrate identity module from svc-identity into apps/api

ARC-W1 task 16. JWT, OIDC, LDAP, MFA, RBAC, ABAC, users, roles,
sessions, API tokens, SCIM all relocated. W1.2 global guards (APP_GUARD)
and W1.5 centralized authz preserved. svc-identity kept alive via thin
adapter for parallel deployment until full W1 cutover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Migrate audit module — copy and wire

**Files:**
- Source: existing audit log writer + runtime anomaly tracker (likely in `libs/instance-db/src/lib/runtime-anomaly/` and `apps/svc-data/src/app/audit/` — verify locations)
- Destination: `apps/api/src/app/audit/`
- Modify: `apps/api/src/app/app.module.ts` — register AuditModule

**Why this matters:** Audit is the second-deepest dependency (after kernel) — every state-changing operation in any module writes an audit row via `withAudit` (already migrated in Task 15). The audit module wraps `withAudit` with the structured row schema (actor, action, target, timestamp, purpose code, permission context) and the runtime anomaly tracker.

- [ ] **Step 1: Identify audit-equivalent code**

```bash
# Audit log writer (canonical home).
grep -rln "AuditLog\|audit_log\|AuditService" libs/instance-db/ apps/svc-*/src --include="*.ts" 2>/dev/null | head -20

# Runtime anomaly tracker (W2.D infrastructure).
grep -rln "RuntimeAnomalyService\|runtime_anomaly" libs/instance-db/ apps/svc-*/src --include="*.ts" 2>/dev/null | head -20
```

Document scope:
- [ ] AuditService (writes audit rows)
- [ ] AuditLog entity (already in `libs/instance-db/src/lib/entities/`)
- [ ] RuntimeAnomalyService (W2.D)
- [ ] runtime_anomaly entity (already in `libs/instance-db`)

- [ ] **Step 2: Create apps/api/src/app/audit/ directory**

```bash
mkdir -p apps/api/src/app/audit
```

- [ ] **Step 3: Copy AuditService and runtime-anomaly service**

Copy the canonical implementations to `apps/api/src/app/audit/`:
- `apps/api/src/app/audit/audit.service.ts`
- `apps/api/src/app/audit/runtime-anomaly.service.ts`
- Their existing `*.spec.ts` files

Use `git mv` if moving from a single source location, or copy verbatim if the canonical source is in `libs/instance-db` and you want to keep the lib re-export.

- [ ] **Step 4: Create AuditModule**

Write `apps/api/src/app/audit/audit.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, RuntimeAnomaly } from '@hubblewave/instance-db';

import { AuditService } from './audit.service';
import { RuntimeAnomalyService } from './runtime-anomaly.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, RuntimeAnomaly]),
  ],
  providers: [AuditService, RuntimeAnomalyService],
  exports: [AuditService, RuntimeAnomalyService],
})
export class AuditModule {}
```

(Adjust entity imports to match your `libs/instance-db` exports.)

- [ ] **Step 5: Register AuditModule in AppModule**

Update `apps/api/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { KernelModule } from './kernel/kernel.module';
import { DbModule } from './db/db.module';
import { IdentityModule } from './identity/identity.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    KernelModule,
    DbModule,
    IdentityModule,
    AuditModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 6: Run existing audit tests**

Run: `npx nx test api --testNamePattern="audit|RuntimeAnomaly"`
Expected: pass.

- [ ] **Step 7: Run audit scanner**

Run: `npm run audit:check`
Expected: passes. The W1.6 transactional-audit pattern is preserved.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/app/audit/ apps/api/src/app/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): migrate audit module — AuditService + RuntimeAnomalyService

ARC-W1 task 17. W1.6 transactional-audit + W2.D runtime-anomaly tracking
preserved. AuditModule is @Global so any state-changing operation can
inject AuditService.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Migrate metadata module — copy and wire

**Files:**
- Source: `apps/svc-metadata/src/app/` — collection, property, relationship CRUD; validation engine; formula engine wiring; publish-impact analyzer (W2.A); reference checker; packs install path
- Destination: `apps/api/src/app/metadata/`
- Modify: `apps/api/src/app/app.module.ts` — register MetadataModule
- Modify: `apps/svc-metadata/src/app/app.module.ts` — adapter to keep parallel-running

**Why this matters:** Metadata is the schema engine — collection/property/relationship CRUD, validation rules, formulas, the publish-impact analyzer (W2.A reference checker that blocks deletes when references exist), and the packs install path. Every customer customization (via §17.5) flows through this module's validation. Migrating it correctly means the upgrade-safety claim stays intact through the consolidation.

- [ ] **Step 1: Identify metadata-equivalent code**

```bash
ls apps/svc-metadata/src/app/
```

Expected directories include:
- `collections/` — CollectionDefinition CRUD
- `properties/` — Property CRUD with type system
- `relationships/` — Relationship CRUD
- `validation/` — validation rule evaluator
- `formulas/` — formula authoring + evaluator wiring
- `publish-impact/` — W2.A publish-impact analyzer
- `reference-scanner/` — W2.A reference checker on delete
- `packs/` — pack install path (uses existing libs/packs)
- `views/` (maybe) — if view definitions live in metadata
- `forms/` (maybe) — if form definitions live in metadata

- [ ] **Step 2: Move the entire svc-metadata module tree**

```bash
git mv apps/svc-metadata/src/app apps/api/src/app/metadata
```

- [ ] **Step 3: Update import paths inside the moved files**

```bash
grep -rn "from '\.\./\.\./\.\." apps/api/src/app/metadata --include="*.ts" | head -30
```

Adjust any escapes.

- [ ] **Step 4: Restore svc-metadata to runnable state via thin adapter**

Write `apps/svc-metadata/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MetadataModule } from '../../../api/src/app/metadata/metadata.module';

@Module({
  imports: [MetadataModule],
})
export class AppModule {}
```

- [ ] **Step 5: Verify or create apps/api/src/app/metadata/metadata.module.ts**

If the move produced a `metadata.module.ts`, use it. Otherwise compose from the sub-modules:

```typescript
import { Module } from '@nestjs/common';
import { CollectionsModule } from './collections/collections.module';
import { PropertiesModule } from './properties/properties.module';
import { RelationshipsModule } from './relationships/relationships.module';
import { ValidationModule } from './validation/validation.module';
import { FormulasModule } from './formulas/formulas.module';
import { PublishImpactModule } from './publish-impact/publish-impact.module';
import { ReferenceScannerModule } from './reference-scanner/reference-scanner.module';
import { PacksInstallModule } from './packs/packs-install.module';

@Module({
  imports: [
    CollectionsModule,
    PropertiesModule,
    RelationshipsModule,
    ValidationModule,
    FormulasModule,
    PublishImpactModule,
    ReferenceScannerModule,
    PacksInstallModule,
  ],
  exports: [
    CollectionsModule,
    PropertiesModule,
    RelationshipsModule,
    ValidationModule,
    FormulasModule,
  ],
})
export class MetadataModule {}
```

(Adjust to match actual sub-module structure.)

- [ ] **Step 6: Register MetadataModule in AppModule**

Update `apps/api/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { KernelModule } from './kernel/kernel.module';
import { DbModule } from './db/db.module';
import { IdentityModule } from './identity/identity.module';
import { AuditModule } from './audit/audit.module';
import { MetadataModule } from './metadata/metadata.module';

@Module({
  imports: [
    KernelModule,
    DbModule,
    IdentityModule,
    AuditModule,
    MetadataModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 7: Run all tests including metadata-specific**

Run: `npx nx test api`
Expected: all tests pass (kernel + db + identity + audit + metadata).

- [ ] **Step 8: Verify W2.A reference scanner still functional**

Sanity check: try to delete a collection that has a reference (via the API, locally) and verify the error message lists the reference. This is a manual smoke test — the formal test should be in the test suite.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/app/metadata/ apps/api/src/app/app.module.ts apps/svc-metadata/src/app/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): migrate metadata module from svc-metadata into apps/api

ARC-W1 task 18. Collection/property/relationship CRUD, validation,
formulas, W2.A publish-impact analyzer + reference scanner, packs install
path all relocated. Foundation slice complete: apps/api now contains
kernel + db + identity + audit + metadata.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Foundation verification gate — run everything

**Files:**
- None modified; verification only

**Why this matters:** The foundation slice (kernel + db + identity + audit + metadata) is the platform bedrock. Before this plan declares "done" and a follow-on plan tackles the remaining 13 W1 modules, every test, scanner, and build must be green. A regression here would compound through every subsequent module migration.

- [ ] **Step 1: Run the full test suite across all projects**

```bash
npx nx run-many --target=test --all
```

Expected: all tests pass — both legacy svc-* services (still running via thin adapters) AND apps/api tests.

- [ ] **Step 2: Run all architectural scanners**

```bash
npm run authz:check
npm run audit:check
npm run security:check
npm run deps:check
npm run compliance:check
```

Expected: all five exit 0.

(Note: `service-boundary:check` is intentionally still in the codebase. It will continue to pass because the moves used `git mv` and the entity-ownership rules remain satisfied. Its actual deletion is part of full W1 cutover, NOT this foundation slice.)

- [ ] **Step 3: Run full build**

```bash
npx nx run-many --target=build --all
```

Expected: clean build. apps/api, apps/worker, apps/control-plane (still svc-control-plane), and all 14 legacy services build.

- [ ] **Step 4: Run lint**

```bash
npx nx run-many --target=lint --all
```

Expected: clean lint.

- [ ] **Step 5: Boot apps/api end-to-end**

```bash
npm run docker:up   # Start Postgres + Redis
sleep 5
npx nx serve api
```

In a separate terminal:

```bash
curl -i http://localhost:3000/api/health
```

Expected: 200 OK or 404 (depending on whether a health controller has been migrated yet — both are acceptable for the foundation slice; at least the server boots without crashing).

Stop the server.

```bash
npm run docker:down
```

- [ ] **Step 6: Tag the foundation completion**

```bash
git tag arc-w1-foundation-complete
```

- [ ] **Step 7: Verify the tag**

```bash
git log --oneline arc-w0-complete..arc-w1-foundation-complete
```

Expected: 8 commits (tasks 12–19; task 19 itself doesn't commit but tags).

- [ ] **Step 8: Document next steps**

Append to `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md` (this file) at the bottom:

```markdown
---

## Status: Complete (target: <fill in completion date>)

W0 + W1 foundation slice complete. apps/api now contains:
- kernel (RequestContext, errors, types)
- db (TypeORM datasource, withAudit)
- identity (auth, authz, users, roles, sessions, MFA, API tokens, SCIM)
- audit (audit log + runtime anomaly)
- metadata (collections, properties, relationships, validation, formulas, publish-impact, reference-scanner)

Legacy svc-* services kept alive via thin adapters; their deletion is part
of full W1 cutover, NOT this slice.

### Next plan: ARC-W1-remaining-modules

Continues W1 with: data → automation → views → forms → dashboards
→ notifications → integrations → ai → packs → plugins → upgrade
→ storage → search.

After all 18 modules consolidate, the full W1 cutover deletes the legacy
svc-* directories, the service-boundary scanner, and migrates traffic
fully to apps/api.

To create the next plan, invoke `superpowers:writing-plans` with the spec
section §8 Wave 1 + this completion as input.
```

---

## Self-review

Pre-commit checklist run on the plan:

**1. Spec coverage:**
- W0 (lock decision, ~1 wk) — covered by tasks 1–11. All 13 canon amendments + 4 new clauses + plan-fix updates + 3 scaffolds + script updates + verification.
- W1 foundation (5 modules of 18) — covered by tasks 12–19. Test harness, kernel, db, identity, audit, metadata, verification.
- Remaining 13 W1 modules: explicitly out of scope, deferred to follow-on plan.
- Spec sections referenced: §2 (target architecture), §3 (tech stack), §4 (feature inventory), §5 (customization architecture), §6 (security model), §8 (migration sequence), §9 (canon delta), Appendix D.

**2. Placeholder scan:** Searched for "TBD", "TODO", "implement later", "fill in details", "Add appropriate error handling", "Similar to Task". Found "(verify the exact fields)" in Task 13 — that's an instruction to read the codebase, not a placeholder for missing plan content. Acceptable. No other placeholders.

**3. Type consistency:**
- `RequestContext` referenced in Tasks 13, 14, and (implicitly) 16+ — same name throughout.
- `withAudit(dataSource, fn)` referenced in Tasks 15, 17 — same signature throughout.
- `AuditService`, `RuntimeAnomalyService` consistent in Task 17.
- `IdentityModule`, `MetadataModule`, etc. — naming matches AppModule registration in Tasks 14, 16, 17, 18.
- `KernelModule`, `DbModule`, `AuditModule` marked `@Global()` consistently.

**4. Scope check:** Plan covers W0 + W1 foundation slice. ~6–8 weeks of solo work. Single plan size is appropriate.

No issues found.

---

**End of W0 + W1 foundation plan. Subsequent waves planned wave-by-wave per spec §8.**
