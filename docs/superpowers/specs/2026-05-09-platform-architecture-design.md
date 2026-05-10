# HubbleWave Platform Architecture Design

**Date:** 2026-05-09
**Status:** Design — Awaiting Approval
**Author:** Aditya Singampally + Claude (collaborative)
**Supersedes:** Aspects of `CLAUDE.md` (Master Canon) — see §9 (Canon Delta)
**Audience:** Founder, future engineers, security reviewers, prospective first customer (technical readers)

---

## Executive summary

HubbleWave today is structured as a 14-service distributed system with 21 supporting libraries — roughly 278,000 lines of TypeScript that build a generic platform engine, with **zero domain models for the asset-management product the platform is supposed to host**. The architecture has shipped no customer-visible features and is currently operating in pure remediation mode: of the last 40 commits, all are architectural cleanup (Plan Fixes 1, 11, 14, 15, 16; waves W1–W7), none are feature work.

This document proposes a course correction:

1. **Collapse the 14-service distributed system into a 3-process modular monolith** (`api`, `worker`, `control-plane`) plus a Day-1 native mobile app, preserving every substantive capability that's been built.
2. **Make customization upgrade-safety the marquee architectural feature.** This is the precise gap the first customer (a Nuvolo user) has — and an architectural problem ServiceNow can't solve retroactively.
3. **Platform-first. Vertical packs are deferred to separate design docs.** This design covers the platform engine and its customization surface only. The Clinical/Facilities Asset Management pack is captured in Appendix D as a forward-looking inventory; it ships *after* the platform is in customer hands and is its own design effort. The first customer's pilot validates the platform itself by having them build their own clinical/facilities customizations on it.
4. **Ship in one shot, no phased pitches.** Platform Day-1 product includes:
   - Custom tables, properties, workflows, integrations
   - Custom React UI plugins (web + mobile)
   - **Workspaces** — persona-tuned, customer-customizable UI compositions
   - **UI Builder** — full low-code page authoring (compete directly with ServiceNow UI Builder)
   - **Mobile app** — native-feeling, offline-first, scanning, voice, biometric
   - **Platform Analytics** — both domain analytics and platform-usage analytics
   - **Rich AI feature surface** — conversational assistant, NL authoring, doc-AI, predictive maintenance, smart triage, image analysis
   - **AI Code Assistant** — Cursor/Copilot-style help for customers building plugins, formulas, automations, integrations, workspaces, analytics queries
   - Upgrade-safety guarantee (the moat)
   - Pooled-mode deployment (canon §5 SOFTEN) for trials, sandboxes, and lower-tier customers
5. **Realistic timeline (solo founder, platform-only scope)**: ~10–12 months critical path. Telling the first customer the optimistic number kills the trust the pitch is built on.

The architecture preserves the substantive engineering investment (`schema-engine`, `formula-parser`, `relationship-resolver`, `authorization`, `automation` runtime) by relocating it from independent services to typed Nest modules. The structural overhead (cross-service transactions, service-boundary scanners, duplicate runtimes, the 14-service operational tax) is dropped.

---

## Table of contents

1. [Current state](#1-current-state)
2. [Target architecture](#2-target-architecture)
3. [Tech stack](#3-tech-stack)
4. [Feature inventory](#4-feature-inventory)
5. [Customization architecture (the moat)](#5-customization-architecture-the-moat)
6. [Security model](#6-security-model)
7. [Evolution map](#7-evolution-map)
8. [Migration sequence](#8-migration-sequence)
9. [Canon delta](#9-canon-delta)

---

## 1. Current state

### Inventory (measured)

| Layer | Count | Lines of code | Notes |
|---|---|---|---|
| Backend services | **14** | ~83,500 | 12 Nest apps + 2 entry points; mostly `apps/svc-*` |
| Shared libraries | **21** | ~67,000 | `libs/*` |
| Frontend apps | 2 | ~128,400 | `web-client` (490 files), `web-control-plane` |
| CI scanners | 6 | — | authz, audit, security, service-boundary, deps, terminology |
| Documentation | 64+ files | — | 8 phases × 8 sub-docs each, plus canon and plan fixes |
| Plan-fix backlog | **8+ tracked** | — | #1 done; #11, #14, #15, #16 referenced; #8, #12, #13, #24 also called out |
| **Total TypeScript** | | **~278,900 LoC** | |

### What's actually built vs scaffolded

- **Genuinely substantive**: `libs/schema-engine`, `libs/formula-parser`, `libs/relationship-resolver`, `libs/authorization`, `libs/instance-db`, the runtime in `svc-automation`, the identity layer in `svc-identity`, the metadata layer in `svc-metadata`. Combined ~50–60k LoC of work that ports forward cleanly.
- **Structural overhead**: 11 of the 14 service entry points (each with main.ts, module.ts, app.module.ts, Dockerfile, e2e harness, scanner allowlists). The cross-service plumbing exists to satisfy decomposition that the team didn't need.
- **Domain gap**: A grep of `libs/instance-db/src` for `asset|equipment|facility|clinical|patient|hospital|hvac|maintenance|workorder` returns 6 files, all platform infrastructure (permissions, AVA, collection-definition, app-builder, access-rule, runtime-anomaly). **No `Asset`, `WorkOrder`, `MaintenanceSchedule`, `Equipment`, `Patient`, `Bed`, `MedicalDevice` entities exist.**

### Recent velocity (last 40 commits)

- Architectural remediation / consolidation (W1–W7, Plan Fixes): ~32 commits
- Compliance scanners and CI gates: ~6 commits
- Canon amendments: 2 commits
- Customer-visible features: **0 commits**

### Current topology

```mermaid
graph TB
  subgraph Frontend
    WC[web-client<br/>119k LoC]
    WCP[web-control-plane<br/>9k LoC]
  end

  subgraph "Instance Plane (per customer)"
    SI[svc-identity<br/>17k LoC]
    SD[svc-data<br/>15k LoC]
    SM[svc-metadata<br/>22k LoC]
    SA[svc-automation<br/>6k LoC]
    SW[svc-workflow<br/>3k LoC]
    SV[svc-view-engine<br/>2k LoC]
    SIN[svc-insights<br/>2k LoC]
    SAV[svc-ava<br/>8k LoC]
    SN[svc-notify<br/>1k LoC]
    SIA[svc-instance-api<br/>1k LoC]
    SMI[svc-migrations<br/>0.1k LoC]
  end

  subgraph "Control Plane"
    SCP[svc-control-plane<br/>6k LoC]
  end

  subgraph "Data infra (per instance)"
    PG[(Postgres<br/>+ pgvector)]
    R[(Redis<br/>BullMQ)]
    TS[(Typesense)]
  end

  WC --> SI & SD & SM & SA & SAV & SIN & SIA
  SD <-->|sync HTTP<br/>+ outbox| SA
  SD --> SM
  WCP --> SCP

  SI & SD & SM & SA & SW & SV & SIN & SAV & SN --> PG
  SI & SD & SM & SA & SW & SAV --> R
  SD & SM --> TS
```

### Ground truth

The architecture is structured for a 50-engineer platform org running at scale; the team is 1–2 people building toward a first paying customer. The mismatch is what's eating engineering hours. Plan Fix 1 alone took 5 PRs to consolidate two duplicated runtimes that the architecture-as-designed allowed to drift; the next 7 plan fixes are similar shape. The CI scanners are treating symptoms of the architectural choice, not the underlying mismatch.

This document proposes correcting that mismatch.

---

## 2. Target architecture

### Topology

Three backend processes, two web frontends, one mobile app, one Postgres, one Redis per customer instance. Control plane stays separate (correctly multi-tenant per Canon §18).

```mermaid
graph TB
  subgraph "Clients"
    WC[web-client<br/>+ Plugin Loader<br/>+ @hubblewave/plugin-sdk]
    WCP[web-control-plane<br/>HW admin UI]
    MOB[mobile<br/>React Native + Expo<br/>+ @hubblewave/plugin-sdk-mobile<br/>+ WatermelonDB offline]
  end

  subgraph "Customer Instance (one process group per customer)"
    API[api<br/>NestJS modular monolith<br/>~all instance modules]
    WK[worker<br/>BullMQ consumer<br/>+ scheduled jobs<br/>+ AI background tasks]
    PG_I[(Postgres<br/>per-customer<br/>+ pgvector + materialized views)]
    R_I[(Redis<br/>per-customer)]
  end

  subgraph "HubbleWave Control Plane (multi-tenant)"
    CP[control-plane<br/>provisioning + upgrades + licensing]
    PG_CP[(Postgres<br/>shared, customers table)]
  end

  subgraph "Edge"
    CDN[CDN<br/>web + mobile plugin bundles<br/>signed]
    LLM[LLM provider<br/>customer-chosen<br/>Claude / Bedrock / Azure / Ollama]
  end

  WC --> API
  WC --> CDN
  MOB --> API
  MOB --> CDN
  WCP --> CP
  CP -->|provision / upgrade / observe| API
  API <--> PG_I
  API <--> R_I
  API --> LLM
  WK <--> PG_I
  WK <--> R_I
  WK --> LLM
  CP --> PG_CP
```

### Module layout inside `api`

```mermaid
graph TB
  subgraph "apps/api (NestJS modular monolith)"
    K[kernel<br/>shared types, errors, RequestContext]
    DB[db<br/>TypeORM, transactions, datasources]
    ID[identity<br/>authn, authz, users, roles]
    AU[audit<br/>audit log, runtime anomalies]
    META[metadata<br/>schema engine, validation, formulas]
    DATA[data<br/>generic CRUD over collections]
    AUTO[automation<br/>rules + workflows merged]
    VIEWS[views<br/>view engine, projections]
    FORMS[forms<br/>form engine]
    DASH[dashboards<br/>composition + KPIs]
    WS[workspaces<br/>persona compositions]
    UIB[ui-builder<br/>page authoring + routes]
    ANL[analytics<br/>domain + platform usage]
    NOT[notifications<br/>email, SMS, push, in-app]
    INT[integrations<br/>typed adapters]
    AI[ai<br/>AVA feature surface<br/>NL search, doc-AI, predictive, vision]
    SYNC[sync<br/>mobile offline-first sync engine]
    PACKS[packs<br/>install, upgrade, validate]
    PLUG[plugins<br/>SDK loader, registry, web + mobile]
    UPG[upgrade<br/>validator, migration tools]
    STO[storage<br/>S3 abstraction]
    SRCH[search<br/>Typesense + vector hybrid]
  end

  K --> DB
  DB --> ID
  ID --> AU
  AU --> META
  META --> DATA
  DATA --> AUTO
  AUTO --> VIEWS
  AUTO --> FORMS
  AUTO --> DASH
  VIEWS --> WS
  FORMS --> WS
  DASH --> WS
  WS --> UIB
  DATA --> ANL
  AUTO --> ANL
  DATA --> NOT
  DATA --> INT
  DATA --> AI
  AI --> ANL
  DATA --> SYNC
  META --> PACKS
  PACKS --> PLUG
  PLUG --> UPG
  UPG --> ANL
  DATA --> STO
  DATA --> SRCH
  AI --> SRCH
```

### What stays vs drops

**Stays (becomes a Nest module or library)**:
- All `libs/schema-engine`, `libs/schema-validator`, `libs/formula-parser`, `libs/relationship-resolver`, `libs/authorization` content
- The `svc-automation` runtime (rule engine, condition evaluator, action handler, script sandbox)
- The `svc-identity` content (JWT, OIDC, LDAP, MFA, RBAC)
- The `svc-metadata` content (collection/property/relationship CRUD, publish-impact analyzer, packs install path)
- The `svc-data` content (CRUD, sync-trigger client folds back into automation module)
- The `svc-ava` runtime (becomes `ai` module — same code, different home)
- The `web-client` content (490 files, ~119k LoC) — bulk preserved; refactored to consume Plugin SDK internally
- All 6 instance Postgres schemas (consolidated into a single migration set)

**Drops or merges**:
- 11 of the 14 backend service entry points (Dockerfiles, main.ts, app.module.ts, e2e harnesses)
- `svc-workflow` — folds into `automation` (one engine; ServiceNow's split is a tax we don't pay)
- `svc-instance-api` — folds into `api` (it was an aggregator/proxy)
- `svc-view-engine`, `svc-insights`, `svc-notify` — fold into respective modules
- 4 of 6 CI scanners: `service-boundary` (irrelevant for monolith), `terminology` (lint rule instead), `security-bypass` (covered by audit + authz scanners), `audit-bypass` (kept simpler form)
- The cross-service distributed-transaction problem documented in Plan Fix 1's "Out of scope"
- Plan Fix 12 (service-boundary scanner) and Plan Fix 24 (per-service entity sets) — backlog items become irrelevant

**New (introduced by this design)**:
- `apps/control-plane` — formerly `svc-control-plane`, kept distinct because it's correctly multi-tenant
- `apps/worker` — single BullMQ consumer process for async automation, scheduled jobs, AVA tasks
- `@hubblewave/plugin-sdk` package — typed contract for customer plugin authors
- Plugin loader in `web-client` (Vite module federation runtime)
- Pack manifest format
- Pre-upgrade compatibility validator

### Why this is evolution-friendly

Module boundaries inside the monolith become the natural seams for future service extraction *if and when* a specific module hits a real performance ceiling. The boundaries you're committing to today (the Nest module list above) are the same ones you'd use to split into services later — but you don't pay the distributed-systems cost until you have evidence you need to. Shopify ran a Rails modular monolith to billions in GMV before any service extraction; Basecamp/HEY still does. Approach 2+ keeps that option open.

---

## 3. Tech stack

| Category | Tech | Status | Rationale |
|---|---|---|---|
| Language | TypeScript 5.9 | KEEP | Type-safety crucial for plugin SDK contract |
| Backend framework | NestJS 11 | KEEP | Module system maps cleanly to monolith plan |
| ORM | TypeORM 0.3 | KEEP | Custom entities for metadata engine; good migration tooling |
| Database | Postgres + pgvector | KEEP | RLS, JSONB, vectors all in one engine |
| Queue | BullMQ 5 | KEEP | Already in use; well-supported |
| Cache | Redis (cache-manager) | KEEP | Recently consolidated (W5.C) |
| Frontend framework | React 19 | KEEP | Already in use |
| UI library | MUI 7 | KEEP | Already in use; matches enterprise expectations |
| State / data fetching | TanStack Query 5 | KEEP | Already in use |
| Tables | TanStack Table 8 + Virtual | KEEP | Already in use; needed for asset list scale |
| Build (frontend) | Vite 7 | KEEP | Module federation support is reason for this choice |
| Build (backend) | Webpack via Nx | KEEP | NestJS-default; revisit if compile time becomes pain |
| Search | Typesense 2 | KEEP | Already in use; good fit for asset search |
| Storage | AWS S3 | KEEP | Already in use |
| Auth providers | OIDC, SAML, LDAP, JWT | KEEP | OIDC + SAML cover enterprise; LDAP for legacy AD |
| MFA | TOTP (otplib) | KEEP | Add WebAuthn in Wave 7 hardening |
| AI provider | Pluggable (Ollama dev, customer choice prod) | KEEP | Customer-controlled; HIPAA implications |
| Vector DB | pgvector | KEEP | In-Postgres avoids extra infra |
| Workflow visual editor | @xyflow/react 12 | KEEP | For automation/workflow visual builder |
| Code editor | @monaco-editor/react | KEEP | For formula/script authoring |
| Charting | Recharts | NEW | Works in both web (React) and mobile (React Native compatible) |
| Monorepo | Nx 22 | KEEP | Already in use; well-suited |
| Testing (unit) | Jest 30 | KEEP | Already in use |
| Testing (frontend) | Vitest 4 | KEEP | Already in use |
| Testing (e2e) | Playwright 1.36 | KEEP | Already in use |
| Mobile e2e | Detox or Maestro | NEW (W3+) | Native mobile test automation |
| Plugin federation | Vite Module Federation | NEW | Required for plugin SDK (web) |
| Plugin sandbox | CSP + capability authz | NEW | Defense-in-depth for plugin code |
| Distributed tracing | OpenTelemetry | NEW (Wave 7) | Production observability |
| **Mobile framework** | **React Native + Expo** | **NEW (W3+)** | **Day 1 — native-feeling, code reuse with web TS** |
| **Mobile offline DB** | **WatermelonDB** | **NEW (W3+)** | **SQLite-backed reactive DB optimized for sync** |
| **Mobile camera/scan** | **react-native-vision-camera + MLKit** | **NEW (W3+)** | **QR/barcode/OCR/RFID** |
| **Mobile push** | **Firebase Cloud Messaging + APNs** | **NEW (W3+)** | **Cross-platform push delivery** |
| **Mobile biometric** | **expo-local-authentication** | **NEW (W3+)** | **FaceID, TouchID, fingerprint** |
| **ML / predictive maintenance** | **TensorFlow.js + per-customer model registry** | **NEW (W6+)** | **Customer-specific models trained on their data** |
| **AI orchestration** | **LangChain.js or hand-rolled** | **NEW (W3+)** | **Multi-step AI flows (search + summarize, doc-AI extraction)** |
| **Speech-to-text (mobile)** | **expo-speech / on-device** | **NEW (W3+)** | **Voice work order completion** |
| **Image analysis** | **MLKit (mobile) + cloud LLM with vision (web)** | **NEW (W3+)** | **Asset identification, fault detection** |
| **Analytics ingestion** | **self-hosted: Postgres + materialized views** | **NEW (W5+)** | **Avoids 3rd-party data leakage for HIPAA** |
| **Analytics UI** | **custom on Recharts + TanStack Table** | **NEW (W5+)** | **Domain analytics + platform usage analytics** |
| Approved-deps registry | (existing W6.D) | KEEP | Cheap; broad value |
| Service-boundary scanner | (existing W5.D) | DROP | Irrelevant for monolith |

### What gets newly added (~30k LoC est.)

- `@hubblewave/plugin-sdk` (~3k LoC, typed interfaces + runtime)
- Plugin loader and security model in `web-client` (~5k LoC)
- Pack manifest format + parser + validator (~4k LoC)
- Upgrade compatibility validator (~6k LoC)
- Clinical/Facilities domain entities, services, UI (~12k LoC backend + ~30k LoC frontend, depending on feature scope)

### What gets deleted (~50k LoC est.)

- 11 service entry points + Dockerfiles + e2e harnesses
- Cross-service plumbing (sync-trigger HTTP client, outbox processors duplicated, etc.)
- 4 CI scanners + their allowlist files
- Duplicate Nest modules across services
- Plan-fix tracking docs for fixes that become irrelevant

Net codebase change: roughly flat (-50k +30k = -20k LoC), but with massively reduced operational and cognitive surface.

---

## 4. Feature inventory

### 4.1 Platform features (the engine)

#### Identity & access
- SSO via OIDC, SAML
- LDAP / Active Directory for legacy enterprise
- OAuth2 for API tokens
- MFA: TOTP (existing); WebAuthn (Wave 7)
- RBAC: roles, hierarchical roles
- ABAC: attribute-based rules combining role + record + user attributes
- Row-level security: per-record authz
- Field-level security: hide/mask sensitive fields per role
- Session management: Redis-backed; idle + absolute timeouts
- API token management: scoped, rotatable, auditable
- SCIM 2.0 for user provisioning

#### Schema engine (metadata)
- Collection definition (custom tables)
- Property definition with 16+ types (text, number, date, datetime, currency, boolean, picklist, multi-picklist, lookup, multi-lookup, formula, JSON, file, image, geo, vector)
- Relationship definition (one-to-many, many-to-many, polymorphic, hierarchical)
- Validation rules (required, regex, range, custom formula)
- Formulas / computed fields (deterministic expression language)
- History tracking (per-property, configurable retention)
- Dependency graph (publish-impact analyzer; existing W2.A)
- Reference checking on delete (existing W2.A)

#### Data engine
- CRUD over any collection (system or customer-defined)
- Bulk operations (insert, update, delete)
- Query builder (filters, sorts, joins, aggregations)
- Full-text search (Typesense backed)
- Vector search (pgvector backed; for AVA semantic queries)
- Soft delete + restore
- Record locking (optimistic + pessimistic)
- Import/export (CSV, Excel, JSON)

#### Automation engine (rules + workflows merged)
- **Rule mode** — synchronous, record-scoped, deterministic (canon §8 "automation"):
  - Trigger types: before/after record events, manual, scheduled, webhook
  - Conditions in formula language
  - Actions: record CRUD, send email/SMS, call HTTP, run sandboxed script
  - Cycle and depth control
  - Per-rule rate limiting (existing W7.C)
- **Workflow mode** — durable, multi-day, stateful (canon §8 "workflow"):
  - State persistence
  - Human task assignment, approvals, escalations
  - Parallel branches, joins, loops
  - SLA timers
- Visual workflow editor (existing @xyflow/react usage)
- Script sandbox (existing) — JS subset with allowlisted globals

#### View engine
- List views (table)
- Kanban
- Calendar
- Timeline / Gantt
- Map (geo-aware)
- Custom view via plugin
- Saved view per role / per user
- Bulk actions on selection

#### Form engine
- Declarative form definition
- Conditional logic (show/hide fields)
- Multi-step / wizard
- Inline validation
- Autosave
- Custom field via plugin

#### Dashboard engine
- KPI tiles
- Charts (line, bar, pie, area, scatter)
- Gauges
- Filterable dashboards
- Per-role dashboards
- Custom widget via plugin

#### Workspaces (Day 1)

Persona-tuned UIs that compose platform primitives (views, dashboards, forms, plugins) into focused work surfaces. Inspired by ServiceNow Workspaces but customer-customizable from Day 1 — a known weakness of ServiceNow's implementation, where Workspace customizations frequently break on upgrade.

**OOTB workspaces shipped with the Clinical/Facilities pack**:
- **Maintenance Technician Workspace** — assigned work, asset lookup, scanning, time entry
- **Facilities Manager Workspace** — team workload, KPIs, escalations, approvals
- **Biomedical Engineer Workspace** — calibration queue, recall management, regulatory readiness
- **Compliance Officer Workspace** — audit trails, regulatory dashboards, e-sign queue
- **Department Manager Workspace** — equipment status in their department, capital planning, downtime impact

**Workspace components**:
- Configurable tile grid (drag-drop layout)
- Persona homepage with most-relevant data + actions
- Pre-configured nav menu per persona
- Multi-tab work surface (work multiple records simultaneously)
- Embedded AVA chat panel (contextual to current work)
- Integrated search across persona-relevant collections
- Mobile-aware: each workspace has a corresponding mobile workspace with the same data binding but mobile-tuned layout

Customers can use OOTB workspaces as-is, customize them, or build new ones via the UI Builder. Workspaces are stored as pack metadata — fully upgrade-safe.

#### UI Builder (Day 1) — full page authoring, ServiceNow UI Builder competitor

Low-code UI composition tool. Customers compose pages, layouts, and entire workspaces from a palette of platform primitives + custom plugins, without writing code. **Full feature parity with ServiceNow UI Builder** — your current employer uses that feature extensively, and matching it is non-negotiable.

**Capabilities**:
- **Full page composition**: drag-drop arrangement of forms, views, dashboards, plugins, layout components onto a page canvas
- **Route definition**: customer-defined URLs (e.g. `/acme/lab-asset-overview`)
- **Layout authoring**: header, sidebar, content area, footer arrangement; nested layouts; responsive grid
- **Templates**: reusable page templates (e.g. "two-column with detail header"); customer-saved templates appear in the new-page wizard
- **Component palette**: reusable composed primitives (e.g. "asset card with PM countdown" once composed, available everywhere); customer can publish custom palette items
- **Conditional logic**: show/hide components based on user role, record state, ABAC attributes, dataset state
- **Event wiring**: button clicks → automation trigger, navigation, modal open, plugin invocation, AI action
- **Multi-screen workflows**: explicit page-to-page navigation flows with state passing (e.g. wizard: page 1 → page 2 → confirm); flow visualization editor
- **Theme awareness**: components inherit customer's theme pack
- **Mobile-aware (variants)**: page authors target web, mobile, or both; per-form-factor variants supported (e.g. "mobile shows X, web shows X+Y")
- **Localization**: per-string locale support; translations stored in customer pack
- **Branding**: per-app logo, colors, typography (each customer-built application can have its own brand surface within their pack)
- **Page-level access control**: per-page permission gating combined with row/field-level data security
- **Performance budgets**: page authors see a budget meter (bundle size, query count, expected load time); warnings if exceeded

**Authoring environment**:
- Visual canvas with live preview across web/mobile/desktop variants simultaneously
- Property panel for selected component
- Data source binding panel
- **AI Code Assistant integration** (see §AI Code Assistant): NL-to-page generation, page explanation, suggested optimizations
- Validation: every binding checked against current schema (design-time validation, §5.6)
- Versioning: each page has history; rollback per page
- Diff viewer between page versions
- Concurrent editing detection (warns if two admins edit the same page)

**Output**: pages, layouts, templates, workspaces, multi-screen flows all become customer pack metadata. Subject to the upgrade-safety validator. Customers can export pages as portable JSON to share between instances or with other customers.

#### Notification engine
- Email (transactional + digest)
- SMS
- In-app notifications
- Push (mobile, future)
- Templates with variables
- Per-user delivery preferences

#### Integration platform
- Typed integration adapter framework (REST, GraphQL, SOAP, file-based)
- Versioned contracts (per-integration API version pinning)
- Retry + replay with idempotency keys
- Webhook receiver with HMAC signature verification
- Outbound webhook fanout
- Scheduled sync jobs

#### AVA — AI feature surface (Day 1)

AVA is the platform's AI feature surface — a rich set of features wired into every relevant module. The §11 framing of "AI is infrastructure" is amended to "AI is a richly-integrated feature surface" — not infrastructure in the load-bearing sense, but a feature pillar visible in every workspace.

**Core AI capabilities**:

- **Conversational assistant**: chat panel embedded in every workspace. *"AVA, what's the maintenance status on all infusion pumps in ICU 4?"* Returns structured data + natural language answer. Permission-aware (AVA cannot reveal records the user can't read).
- **Natural language search**: hybrid (vector + keyword) over all platform data, permission-aware.
- **AI-assisted authoring**:
  - *"Create a PM schedule for all infusion pumps every 6 months"* → drafted automation rule
  - *"Show me overdue PMs by department"* → drafted view
  - *"Build a workspace for biomedical engineers"* → drafted workspace skeleton in the UI Builder
  - *"Add a custom field to track FDA UDI"* → drafted schema change
- **Document AI**: parse equipment manuals, recall notices, regulatory documents → extract structured data into asset records (specs, serial numbers, FDA UDI, calibration intervals).
- **Voice work order completion** (mobile): technician dictates findings → on-device speech-to-text + structured extraction → form fields populated.
- **Image analysis** (mobile + web):
  - Snap photo of equipment → AI identifies asset (visual fingerprint matching)
  - Snap photo of fault → AI suggests probable cause + relevant work order template
  - Damage assessment from photos
- **Predictive maintenance**: ML over historical work order + sensor data; surfaces assets trending toward failure with confidence + recommended action.
- **Smart triage**: incoming work orders auto-categorized by urgency, type, recommended technician.
- **Anomaly detection**: equipment readings outside expected ranges flagged proactively.
- **AI-suggested platform optimizations**: analytics-driven suggestions to simplify workflows, retire unused fields, reorganize roles (powered by Platform Analytics data).

**Architecture**:
- AVA is a Nest module (`ai`) inside the api monolith
- Pluggable LLM provider per customer:
  - Local: Ollama (existing dev setup)
  - Production: customer-chosen with BAA — Anthropic Claude (via Bedrock or direct), Azure OpenAI, AWS Bedrock, GCP Vertex AI
- Vector embeddings stored in pgvector (in-Postgres, no extra infra)
- ML models for predictive maintenance: per-customer model registry; trained on customer's historical data; models version-tracked alongside customer pack
- Voice/image: on-device for mobile (privacy + latency); server-side for high-fidelity inference
- All AI features auditable: every AI suggestion logged with prompt, model, version, response, applied/rejected status

**Trust model** (canon §12 reinterpreted): AVA defaults to **suggest/preview** mode. Real autonomous actions require explicit per-feature configuration by customer admin. The §12 progression (Suggest → Preview → Approve → Execute → Audit) applies *per AI feature*, not platform-wide. Example: a customer can enable "AVA can auto-triage low-urgency work orders" while keeping every other AI feature in suggest-only mode. This is a richer interpretation than "infrastructure-wide trust framework" — and easier to sell, because customers control granularity.

**Healthcare-specific AI safety**:
- AI never generates clinical recommendations (out of scope; we don't sell clinical decision support)
- AI never modifies patient data (out of scope; we don't touch EHR)
- AI suggestions involving safety-critical assets (life-support equipment) gated behind explicit human approval
- AI prompts and responses are auditable; PHI in prompts is logged for HIPAA "minimum necessary" reviews
- Per-customer LLM provider choice means customer controls data flow (some hospitals require LLM never leave their cloud — Bedrock with VPC endpoints, customer-hosted Ollama)

#### AI Code Assistant (Day 1) — Cursor/Copilot for the platform

A first-class AI development companion for customers (and HubbleWave engineers) building customizations. Inspired by Cursor and GitHub Copilot, but specialized to the platform: it understands the customer's current schema, their existing customizations, the Plugin SDK API surface, and the platform's security rules. **Direct competitor to ServiceNow's "Now Assist for Creators".**

**Where it appears**:

- **Plugin authoring** (web IDE + CLI): inline code completion in TypeScript/React for plugin development. Suggestions are aware of:
  - The customer's current schema (when typing `useRecord('Asset', ...)`, the AI knows what fields exist on `Asset`)
  - The Plugin SDK API surface (typed, versioned)
  - The customer's existing plugins (matches their style, suggests refactors)
  - Security rules (won't suggest `eval`, won't suggest non-platform `fetch`)
  - Performance best practices (warns on N+1 queries, large bundle imports)
- **Formula editor**: NL-to-formula and formula-to-NL bidirectional translation
  - *"asset's last PM is more than 6 months old AND it's classified as critical"* → `Asset.lastPM < TODAY() - 180 AND Asset.category = 'Critical'`
  - Point at any existing formula → plain-English explanation
  - One-click fix for formula errors
- **Automation script editor** (sandboxed JS subset): AI suggests platform SDK calls; validates against sandbox restrictions; refactors for performance
- **Integration adapter authoring**: AI helps configure typed integration adapters
  - *"I want to sync work orders with our SAP system"* → suggests REST adapter config + field mappings
- **Workspace builder**: AI generates workspace skeletons from natural language
  - *"Workspace for Quality Officers focused on inspection compliance"* → tile layout, navigation, embedded views
- **Analytics query builder**: AI generates SQL/analytics queries
  - *"MTTR by department for the last quarter, broken down by asset category"* → query
- **Code review at deployment** (gates plugin install): security scan, best-practices review, performance review, dependency vulnerability scan
- **Code explanation**: point at any customization (formula, automation, plugin) → plain-English explanation. Critical for handoffs, audits, and onboarding new admins
- **Error fixing**: customization fails at runtime → AI suggests fix with one-click apply

**Architecture**:

- Uses customer's chosen LLM (their BAA provider; same as conversational AVA)
- LLM gets platform context via:
  - **Schema introspection** — current schema as system-prompt context
  - **Plugin SDK documentation** embedded as RAG content (typed, versioned per platform release)
  - **Customer's existing customizations** as RAG context (their style, their patterns)
  - **Security rules** as constraints (the LLM is instructed never to suggest unsafe patterns)
- Tool/function calling for the LLM:
  - `getCollections()`, `getProperties(collection)`, `getRelationships(collection)` — schema queries
  - `getExistingPlugins()`, `getExistingAutomations()`, `getExistingViews()` — customization queries
  - `validateFormula(expr)`, `validatePluginCode(code)`, `runSandboxedTest(code, fixture)` — validation calls
- **Inline UI** in plugin authoring CLI/IDE, formula editor, automation script editor, integration config editor, workspace builder, analytics query builder
- All AI Code Assistant interactions auditable; customer can audit which prompts went to LLM provider

**Why this matters**:

ServiceNow's Now Assist for Creators is one of their fastest-selling premium add-ons. The pitch: "your admins ship customizations 5–10x faster, with fewer security incidents, even when they're not professional engineers." For your customer (whose admins are facilities/biomedical staff, not full-time devs), this is the difference between "nice-to-have customization" and "actually used customization." It's also what makes the Day-1 platform claim *demonstrable*: in the pitch, you can sit with a non-developer and show them building a custom workflow with AI assistance in 5 minutes.

#### Platform Analytics (Day 1)

Two flavors of analytics, both Day 1.

**Domain analytics (customer's data)** — extends the dashboard engine into a full reporting suite:
- Ad-hoc query authoring (visual + SQL-like)
- Cross-collection joins (asset + work order + downtime)
- Trend analysis (uptime over 12 months, MTTR by department)
- Pivot tables and crosstabs
- Scheduled report delivery (email, dashboard, API)
- AI-suggested insights (*"PM compliance dropping in HVAC; here's why"*)
- Export to Excel, PDF, BI tool (Power BI, Tableau via SQL endpoint)

**Platform usage analytics (how the platform is being used)** — meta-analytics for customer admins:
- **User adoption**: active users, feature adoption %, retention curves, mobile vs web split
- **Performance metrics**: page load times, query times, slow paths, API latencies
- **Customization usage**: which custom fields/forms/views/plugins are heavily used (informs what to keep/cut)
- **Error tracking**: errors by user, by feature, by integration
- **Audit-ready reports**: regulatory queries (who accessed PHI, when, why) — HIPAA-formatted exports
- **AI-suggested optimizations**: *"Workflow X has 80% abandon rate; consider simplifying"*; *"Custom field Y unused for 6 months; safe to retire"*

**Implementation**:
- Self-hosted (Postgres + materialized views + scheduled refresh) — avoids sending data to third-party analytics services, which is a HIPAA concern
- Integrates with customer SIEM/observability stack via standard exports (OTLP, syslog)

Platform analytics are a critical sales lever: customer admins show their leadership *"we adopted feature Y at Z%, saving $N/year."* Justifies platform investment internally — and surfaces upsell opportunities to HubbleWave.

#### Pack system
- Pack install / uninstall / upgrade / rollback
- Pack manifest validation
- Dependency resolution between packs
- Pack export/import for backup or migration
- Maintenance-mode lock during install/rollback (existing W4.D)

#### Plugin system
- Plugin SDK (`@hubblewave/plugin-sdk`)
- Plugin registry (per-customer install state)
- Plugin permissions (capability-based)
- Plugin loader (module federation)
- Plugin admin approval flow

#### Upgrade safety
- Pre-upgrade validator (schema, API, plugin, workflow, integration diffs)
- Automated migration generator (yellow path)
- Customer remediation workflow (red path)
- Audit row per upgrade

#### Mobile experience (Day 1) — competitive differentiator

Native-feeling mobile app for technicians, supervisors, and managers. Offline-first by design — hospitals are full of dead zones (basements, MRI suites, equipment rooms behind shielding). Nuvolo's mobile is widely criticized as weak; this is direct customer-pain alignment and a primary scoring point for the pitch.

**Stack**: React Native + Expo + WatermelonDB (offline reactive DB) + react-native-vision-camera (scanning) + react-native-mlkit (on-device OCR/barcode/QR/RFID).

**Capabilities**:
- **Offline-first**: full read/write while disconnected; sync on reconnect; conflict resolution via CRDT-style record-level merge
- **Scanning**: QR + Barcode + RFID + NFC; one-tap asset lookup
- **Photo/video capture**: with annotation, voice tags, automatic upload-on-reconnect
- **Voice input**: dictate work order completion notes; speech-to-text on-device
- **Biometric auth**: FaceID/TouchID/fingerprint; no password re-entry per session
- **Push notifications**: assigned work, urgent inspections, recall alerts
- **Floor plan navigation**: indoor wayfinding to asset locations (when CAD/BIM data is available)
- **Mobile-optimized work order flow**: touch-friendly, large hit areas, glove-friendly mode (PPE workers)
- **Mobile plugin support**: subset of Plugin SDK for mobile-specific custom components (`@hubblewave/plugin-sdk-mobile`)
- **Reduced bandwidth mode**: hospital networks are often saturated; aggressive image compression and incremental sync
- **Background sync**: continues syncing when app is backgrounded
- **Persona-tuned mobile workspaces**: same Workspace concept on mobile, layouts mobile-specific

**Architecture**:
- Single React Native codebase deploys to iOS + Android (no separate Swift/Kotlin)
- Shared business logic with web via TypeScript packages (data hooks, plugin SDK consumers, formula engine)
- Sync engine: optimistic UI + background reconciliation against the API
- Local DB: WatermelonDB (SQLite-backed reactive DB optimized for sync, ~100k records on-device performant)
- Authentication: shared with web (JWT + biometric session unlock; certificate pinning for high-security deployments)
- Plugin SDK: mobile-specific subset (`@hubblewave/plugin-sdk-mobile`) — same contract philosophy, mobile-tuned components and APIs

**Why this matters competitively**: Field staff in healthcare facilities are explicit about wanting better mobile. A demo where the mobile app works offline in an MRI suite and syncs cleanly when the technician walks back to the corridor is a dealbreaker-level moment vs Nuvolo, where the same scenario fails.

### 4.2 Clinical/Facilities Asset Management pack features — *deferred to separate design*

The Clinical/Facilities Asset Management vertical pack is **out of scope for this design**. It will be designed as its own document once the platform is in customer hands. Building it on top of the platform (rather than alongside it) is the right discipline — you build the moat once, then ship verticals fast.

A forward-looking inventory of expected vertical-pack features is preserved in [Appendix D — Deferred vertical pack inventory](#d-deferred-vertical-pack-inventory) for reference and customer discussions, but it does not constrain or scope this design.

The first customer's pilot (Wave 8) validates the platform itself by having them build their own clinical/facilities customizations on it — which is a stronger demo of the platform claim than them seeing a pre-built CMMS.

### 4.3 Customization surface (what customers can extend)

**Day 1**:
- Add custom collections (tables) with custom properties — no code
- Add custom properties to platform collections (Asset, WorkOrder, etc.) — no code
- Define custom relationships — no code
- Define custom validation rules — formula language, no code
- Define custom formulas / computed fields — formula language
- Define custom automations (rules + workflows) — visual editor + optional sandboxed script
- Define custom views (list, kanban, calendar, gantt, etc.) — declarative, no code
- Define custom forms with conditional logic — declarative
- Define custom dashboards — declarative
- Define custom roles + permissions — no code
- Define custom integrations — typed adapters with config; pluggable for new protocols
- **Upload custom React UI components** — via Plugin SDK (the differentiator vs Nuvolo)
- Customize email/notification templates — declarative
- Customize navigation/menu — declarative
- White-label theming (logo, colors, fonts) — declarative

**Customizable but admin-gated**:
- Plugin install (requires platform admin approval per plugin)
- High-privilege automation actions (e.g. delete-cascade, mass-update)
- Custom integration secrets (admin-managed)

---

## 5. Customization architecture (the moat)

This is the section that makes the platform claim defensible. Your first customer's complaint about Nuvolo is that customizations break on upgrade — not that customization is impossible. ServiceNow allows nearly all the customization you'd want; it just doesn't *isolate* customizations from platform internals, so each upgrade is a roll of the dice.

We can do this better because we're greenfield. The customization surface IS the contract, and the contract is enforced by the platform engine. Customers can't customize their way around it because there's no path off the contract.

### 5.1 The pack model

A "pack" is a versioned bundle of customizations. Three tiers:

1. **Platform packs** — base capabilities shipped by HubbleWave (identity, metadata, automation, etc.). Updated only via platform upgrades. Customers cannot modify these.
2. **Vertical packs** — pre-built apps shipped by HubbleWave (Clinical/Facilities Asset Management today; future Pharmacy, EHS, etc.). Updated via platform upgrades; customers can EXTEND but not modify the base pack.
3. **Customer packs** — customizations authored by customers. Owned by customer; never modified by platform upgrades.

Each pack contains:
- **Manifest** (`pack.json`) declaring: id, version, target platform API version, declared capabilities, dependencies on other packs
- **Schema definitions** — collections, properties, relationships
- **Automation definitions** — rules and workflows
- **View / form / dashboard definitions** — declarative
- **UI plugin bundles** — references to uploaded React components
- **Integration adapter configs** — typed integrations with versioned contracts
- **Permissions / roles**
- **Seed / reference data** (e.g. picklist values, lookup tables)

A customer instance composes packs:

> Customer instance state = base platform packs + selected vertical pack(s) + customer pack(s)

Pack composition rules:
- **Customer packs ADD** new collections (in customer namespace)
- **Customer packs EXTEND** platform/vertical collections (add custom properties, relationships)
- **Customer packs OVERRIDE** views/forms/dashboards (with explicit upgrade-impact warning if overriding a base view)
- **Customer packs REGISTER** plugins, automations, integrations

### Diagram 1 — Pack architecture & schema isolation

```mermaid
graph TB
  subgraph "Customer Instance Schema"
    subgraph "Platform schema (HubbleWave-owned)"
      PT[Platform tables<br/>users, roles, audit_log, ...]
      VT[Vertical-pack tables<br/>Asset, WorkOrder, Room, ...]
    end

    subgraph "Customer schema (customer-owned)"
      CT[Custom collections<br/>cust__acme__lab_assets<br/>cust__acme__safety_audit]
      CE["customer_extensions JSONB<br/>on platform tables<br/>(simple custom props)"]
      CST[Custom side tables<br/>cust__acme__inspection_extras<br/>linked by record_id]
    end
  end

  CT -.references via FK.-> VT
  CE -.attached column.-> VT & PT
  CST -.linked by record_id.-> VT
```

### 5.2 Schema isolation

**Customer customizations NEVER modify platform schema.** This is the architectural guarantee that enables upgrade safety.

Three strategies for storing customer customizations, picked per use case:

#### Custom collections → customer-namespaced tables

Naming: `cust__{customer_pack_id}__{collection_id}`. Migrations for these tables are owned by the customer pack version, not the platform version. Querying is via the same TypeORM and data engine as platform collections — the platform doesn't care whether a collection is platform-defined or customer-defined.

#### Simple custom properties on platform collections → JSONB extension column

Every platform table has a `customer_extensions` JSONB column (one per pack namespace). Customer packs declare property type metadata in the manifest. Platform engine handles serialization, validation, indexing (via Postgres GIN on JSONB).

```sql
-- Platform-owned column on Asset table
customer_extensions JSONB DEFAULT '{}'

-- Customer pack manifest declares:
{
  "extensions": {
    "Asset": {
      "acme.fda_class": { "type": "picklist", "values": ["I", "II", "III"] },
      "acme.last_inspection": { "type": "date", "indexed": true }
    }
  }
}
```

#### Complex custom properties → side tables

For relational extensions or fields needing complex indexes/queries, customer packs create side tables linked by `record_id`. Platform engine joins these automatically when querying.

```sql
CREATE TABLE cust__acme__asset_extras (
  record_id UUID PRIMARY KEY REFERENCES "Asset"(id),
  custom_field_a TEXT,
  custom_field_b INTEGER,
  ...
);
```

#### Custom relationships → customer-namespaced join tables

Never modifies platform foreign keys.

#### Validation / formula rules → pack metadata, evaluated at runtime

These never modify schema; they're interpreted by the platform engine against current schema.

**Why this matters**: when HubbleWave ships a platform upgrade migrating platform schema, customer schema is **completely orthogonal**. Migrations CAN'T conflict because they touch disjoint name spaces. The platform's migration tool literally cannot break a customer's custom collection.

### 5.3 Plugin SDK contract

Custom UI components are the highest-risk customization surface (arbitrary code execution). The Plugin SDK is the contract that makes them safe and upgrade-stable.

#### For the customer (plugin author)

Authoring a plugin:

```typescript
// my-asset-utilization-chart/src/index.tsx
import {
  definePlugin,
  useRecord,
  usePlatformAPI,
  RecordList,
  PlatformProvider
} from '@hubblewave/plugin-sdk';

export default definePlugin({
  id: 'acme.asset-utilization-chart',
  version: '1.0.0',
  targetPlatformApiVersion: '2026.05',
  capabilities: ['read:Asset', 'read:WorkOrder'],
  components: {
    AssetUtilizationChart: ({ assetId }) => {
      const asset = useRecord('Asset', assetId);
      const workOrders = usePlatformAPI('2026.05')
        .data.query('WorkOrder', { assetId, status: 'closed' });
      // ... render chart
      return <Chart data={...} />;
    }
  },
  slots: {
    'asset.detail.sidebar': 'AssetUtilizationChart'
  }
});
```

Build with `hw-plugin build` (CLI shipped with the SDK):
- Compiles TypeScript
- Bundles as ESM with module federation manifest
- Generates plugin manifest from the `definePlugin` call
- Outputs a single signed bundle + manifest JSON

Upload + install via platform admin UI (or `hw-plugin publish` CLI).

#### Stability guarantees

The Plugin SDK API commits to:

- **Stability for N major versions** (proposed N=2, ~2 years given quarterly major releases). Plugins built against `2026.05` work through `2027.05` minimum.
- **Deprecated APIs** still work for one full release cycle (1 year) with console warnings.
- **Removed APIs** ship with automated migration tooling for common patterns; `hw-plugin migrate` runs the migration.
- **No silent breakage**: if a plugin's `targetPlatformApiVersion` matches the platform's current API version (or within the 2-version window), the plugin loads and works. Outside the window, the plugin fails to load with a precise error pointing to the migration tool.

#### Runtime model

When a user opens a page where a plugin is bound to a slot:

1. Web-client encounters slot binding from the active customer pack
2. Plugin loader fetches bundle via CDN with strict CSP enforced
3. Module federation runtime resolves shared dependencies (React, MUI, plugin SDK) against platform-provided versions
4. Plugin instantiates inside a `<PlatformProvider>` context with restricted API surface
5. Plugin uses SDK hooks ONLY for data access — raw `fetch` to other origins is blocked at runtime by CSP
6. Plugin renders within the slot's React tree with normal React lifecycle

#### Security boundary (preview; full detail in §6.4)

- CSP: `script-src 'self' cdn.platform; connect-src 'self'; object-src 'none'; ...`
- Plugin runs in same React tree but with restricted context (no access to other plugins' state, no `window` globals beyond explicitly permitted)
- No `eval`, no `Function()`, no inline scripts (CSP-enforced)
- All data access via Plugin SDK; raw `fetch` to non-platform origins blocked
- Capability authz: plugin manifest declares capabilities (e.g. `read:Asset`), runtime enforces (e.g. plugin without `write:Asset` cannot call `useMutation('Asset')`)
- Plugin install requires platform-admin approval per plugin per customer
- Bundle scanning at upload time: known-bad patterns, dependency vulnerabilities (via Snyk-style scanner), bundle size limits
- Optional: publisher-signed bundles (publisher provides signing key; platform verifies at load)

### Diagram 2 — Plugin lifecycle

```mermaid
sequenceDiagram
  participant Author as Plugin Author
  participant CLI as hw-plugin CLI
  participant Platform as Platform API
  participant Registry as Plugin Registry
  participant CDN as CDN
  participant Client as Web Client (browser)

  Author->>CLI: hw-plugin build
  CLI->>CLI: Compile TS, bundle ESM,<br/>generate manifest, sign bundle
  Author->>Platform: hw-plugin publish (upload bundle + manifest)
  Platform->>Platform: Validate manifest<br/>(API version, capabilities)
  Platform->>Platform: Security scan<br/>(known-bad, vulns, size)
  Platform->>Platform: Verify signature
  Platform->>Registry: Register plugin (per customer)
  Platform->>CDN: Publish bundle (immutable URL)

  Note over Author,Client: --- Plugin live ---

  Client->>Client: User opens page with plugin slot
  Client->>Registry: Query plugins bound to slot
  Registry-->>Client: Plugin manifest + bundle URL
  Client->>CDN: Fetch bundle (strict CSP)
  CDN-->>Client: Bundle (verified signature)
  Client->>Client: Module federation resolves<br/>shared deps (React, MUI, SDK)
  Client->>Client: Instantiate plugin<br/>inside PlatformProvider
  Client->>Platform: Plugin SDK API calls<br/>(scoped to declared capabilities)
  Platform-->>Client: Data / mutations
```

### 5.4 Upgrade-safety mechanism

This is the marquee architectural feature — the precise problem your customer is trying to solve.

#### Customer-controlled upgrade flow

Customer environments stay on their current platform version until they accept an upgrade. The accept flow:

#### Step 1: Pre-upgrade validation runs on the customer instance

The validator inspects all installed packs and computes diffs against the new platform version's contract:

**a. Schema diff** — platform schema changes vs customer customizations:
- Removed platform tables that customer references → **BLOCK** (red)
- Removed platform columns that customer references → **BLOCK** (red)
- Renamed columns → **AUTO-MIGRATE** (yellow with rollback support)
- Type changes (e.g. INT → BIGINT) → **AUTO-MIGRATE** if widening; **BLOCK** if narrowing
- New platform columns → no impact on customer (green)
- New platform tables → no impact (green)

**b. API diff** — platform API changes vs customer pack uses:
- Removed REST endpoints used by customer integrations → **BLOCK** (red) with migration guide
- Removed plugin SDK functions used by plugins → check plugin's `targetPlatformApiVersion`; if within window, **AUTO-MIGRATE**; if outside, **BLOCK**
- Deprecated APIs still in use → **WARN** (yellow informational)
- New APIs → no impact (green)

**c. Plugin compatibility** — plugin's declared API version vs new platform:
- Plugin's `targetPlatformApiVersion` older than minimum supported → **BLOCK** with auto-migration tooling URL
- Plugin's `targetPlatformApiVersion` within window → **OK**
- Plugin uses removed SDK function → **BLOCK** with line-level migration guide

**d. Workflow validation** — workflow references vs new schema:
- Workflow references removed table/column → **BLOCK** with offending workflow steps highlighted
- Workflow uses deprecated action → **WARN** with replacement action suggestion

**e. Integration validation** — integration adapter contracts vs new endpoints:
- Integration uses removed endpoint → **BLOCK**
- Integration uses deprecated endpoint → **WARN** with new endpoint mapping

#### Step 2: Validator output classified

- **Green (proceed)**: no blocking issues; minor warnings are advisory. Customer clicks "upgrade now"; platform applies automatically.
- **Yellow (auto-migrate)**: blocking issues exist BUT automated migrations are available. Customer reviews proposed migrations in a diff UI, approves, applies. Auto-rollback on any failure.
- **Red (manual remediation)**: blocking issues without auto-fix. Validator surfaces precise remediation guide:
  - Which pack version, which file, which line
  - What contract was violated
  - Suggested fix (with code if possible)
  - Link to migration tooling
- Upgrade refuses to proceed until red issues are resolved (customer remediates pack and re-runs validator) OR explicit operator override (audited).

#### Step 3: Upgrade applies

- Platform schema migrations run in transaction
- Customer pack revalidated against new platform schema (post-migration check)
- Plugins reloaded with new platform API version
- Audit row written: who upgraded, from version, to version, validator output, applied migrations, customer pack versions before/after

#### The architectural guarantee

> If the validator says **green**, the upgrade IS safe. There is no path where validator passes and customizations break at runtime.

This is enforceable because:
- Customizations live on a typed, versioned contract (the pack manifest + plugin SDK)
- The platform engine is the only consumer of customization metadata at runtime
- The validator runs the same metadata through compatibility checks before the engine sees it
- There's no DOM-hack or side-channel for customizations to enter the system unvalidated

This is precisely what ServiceNow can't promise — their customers customized via DOM and JavaScript injection over 20 years, no contract, no validator possible. We can promise it because we're greenfield and the contract IS the customization surface.

### Diagram 3 — Upgrade flow

```mermaid
flowchart TB
  Start[Customer accepts<br/>upgrade prompt] --> Snapshot[Snapshot customer<br/>state for rollback]
  Snapshot --> Validator{Pre-upgrade<br/>validator}

  Validator -->|GREEN<br/>no blockers| Apply[Apply platform migrations<br/>in transaction]
  Validator -->|YELLOW<br/>auto-fixable| AutoMigrate[Generate auto-migrations<br/>Customer reviews + approves]
  Validator -->|RED<br/>manual remediation| Block[Block upgrade<br/>Surface remediation guide]

  AutoMigrate --> Apply
  Block --> CustomerFix[Customer fixes pack<br/>Re-runs validator]
  CustomerFix --> Validator

  Apply --> Revalidate[Revalidate pack<br/>against new schema]
  Revalidate -->|Pass| Audit[Write audit row<br/>Mark upgrade complete]
  Revalidate -->|Fail| Rollback[Auto-rollback<br/>to snapshot]
  Rollback --> Block

  Audit --> Done[Upgrade done<br/>Customer notified]
```

### 5.5 Versioning strategy

- **Platform versions**: `YYYY.MM` for major releases (e.g. `2026.05`, `2026.08`, `2026.11`). Quarterly cadence proposed.
- **Pack versions**: semver per pack (e.g. `acme-cmms-extensions@1.4.2`).
- **Plugin SDK versions**: semver, tied to platform API versions (`@hubblewave/plugin-sdk@2026.5.0`).
- **Platform API versions**: same as platform versions (e.g. `2026.05`).

Stability windows:
- Plugin SDK: **2 major versions** of forward compatibility (~6 months minimum guaranteed; typically 1+ year).
- Pack manifest format: **1 major version** with mandatory automated migration to the new format.
- Schema migrations: forward-only with rollback support; no breaking column type changes within a major version.

### 5.6 Customization design-time validation

The richest payoff for the contract is shifted left: customers get errors at *design time*, not at upgrade time.

When a customer authors a workflow that references a column in the platform schema, the platform validator checks against current schema in real time. Removed/renamed column → error in the editor, before they save. Same for:
- Form fields referencing properties
- View columns
- Automation conditions and actions
- Plugin SDK calls (caught by TypeScript at plugin build time)

This shifts upgrade pain LEFT: customers fix incompatibilities when they author, not at upgrade time when they're under pressure to deploy.

---

## 6. Security model

Defense-in-depth across six layers. Every layer is auditable, every layer fails closed, and there's no single layer whose compromise gives an attacker free rein.

### 6.1 Authentication

- **JWT** for session tokens (short-lived access + refresh). Signed with per-instance asymmetric key.
- **OIDC** for SSO (Azure AD, Okta, Google Workspace, Auth0).
- **SAML 2.0** for enterprise SSO with legacy IdPs.
- **LDAP / Active Directory** for legacy enterprise directories.
- **MFA**: TOTP (otplib already in dependencies); WebAuthn (Wave 7).
- **Session management**: Redis-backed; per-session security context; configurable idle (default 30 min) + absolute timeouts (default 12 hours).
- **API tokens**: per-user, scoped, rotatable, full audit trail.
- **Account lockout**: configurable failure threshold + exponential backoff.
- **Password policy**: configurable complexity; common-password blocklist; rotation policy per role.

### 6.2 Authorization

- **RBAC**: role-based, hierarchical roles. Roles can include other roles. System roles (e.g. `platform.admin`, `instance.admin`) plus customer-defined roles.
- **ABAC**: attribute-based rules combining user attributes (department, location), record attributes (criticality, status), and contextual attributes (time, IP).
- **Row-level security**: per-record authz combining RBAC + ABAC. Evaluated at the data-engine query layer, not after-the-fact filtering.
- **Field-level security**: hide/mask sensitive fields per role (e.g. patient identifiers visible to clinicians, masked for facilities staff).
- **Centralized**: every data access flows through the `authorization` library (existing `libs/authorization`). Canon §9 stays.
- **Pluggable**: customer packs can add custom permissions/roles. Plugin manifests declare capabilities; runtime enforces.
- **No fail-open**: authz resolution failure is `NotFoundException`, never empty rules (W1.5 architectural choice; preserved).

### 6.3 Data isolation

- **Default deployment: per-customer instance** with own Postgres database, own Redis, own process. Network and process isolation between customers.
- **Pooled deployment** (optional, lower-tier or dev/trial): shared Postgres with strict RLS keyed by `tenant_id`. Per-tenant tests for RLS boundary integrity. Chaos-engineering style test suite for cross-tenant leakage.
- **Encryption at rest**: AWS-managed keys default; **customer-managed keys (KMS BYOK)** for premium tier. Per-customer key gives the customer the kill switch — revoke key, data is unrecoverable.
- **Encryption in transit**: TLS 1.3 minimum to all public endpoints; mTLS between platform components inside the same instance.
- **Database backups**: per-customer encrypted backups; per-customer retention policy; backup encryption with separate key from runtime data (compromise of one doesn't compromise the other).

### 6.4 Plugin sandbox (detail)

The most interesting attack surface. We treat plugin code as semi-trusted (admin-approved, signed) but defend in depth.

#### Content Security Policy (CSP)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' cdn.platform;
  connect-src 'self';
  object-src 'none';
  frame-src 'none';
  base-uri 'self';
  form-action 'self';
```

This blocks:
- Inline scripts (XSS via DOM injection)
- Cross-origin XHR/fetch (data exfiltration)
- Plugin-loaded iframes (phishing within plugin)
- Object/embed tags (Flash-style escapes)

#### Restricted runtime

- Plugin runs in same React tree but with restricted JavaScript context:
  - No `eval`, no `Function()`, no `setTimeout(string)` (CSP enforces)
  - `window` global access mediated by platform shim — direct access to `window.localStorage`, `window.navigator.geolocation`, etc. requires capability declaration
  - No access to other plugins' React state (each plugin gets isolated context provider)
- All data access via Plugin SDK; raw `fetch` to non-platform origins blocked by CSP `connect-src`

#### Capability-based authz

Plugin manifest declares capabilities:

```json
{
  "capabilities": [
    "read:Asset",
    "read:WorkOrder",
    "write:Asset.customer_extensions.acme.fda_class"
  ]
}
```

Runtime enforces:
- Read capabilities checked at SDK hook level (e.g. `useRecord('Asset', id)` validates `read:Asset` capability)
- Write capabilities checked at mutation layer
- Field-level capabilities supported (plugin can be authorized to write specific custom fields without write access to the whole record)
- Capability denial fails closed: SDK call throws `CapabilityNotGrantedError`

#### Install-time approval

- Plugin install requires **platform admin approval** per plugin per customer
- Admin sees plugin manifest, declared capabilities, signature, scan results before approving
- Plugins from "trusted publishers" (registered with HubbleWave) can have streamlined approval

#### Bundle scanning at upload

- Known-bad pattern detection (signatures of common malicious patterns)
- Dependency vulnerability scan (via Snyk-style or `npm audit` integration)
- Bundle size limits (default 5MB; configurable)
- Static analysis for `eval`/`Function`/`document.write` etc.

#### Optional: signed bundles

- Publishers can register a signing key with HubbleWave
- Bundles signed at publish time
- Platform verifies signature at load time; signature mismatch = refuse to load

### 6.5 Audit

- **Every state-changing action writes an audit row in the same database transaction** (Canon §10; W1.6 + W2.D + W3.C). Use `withAudit(dataSource, fn)` helper from `libs/instance-db`.
- **Audit row content**: actor (user, session, IP, user-agent), action (verb + resource + record ID), timestamp, purpose code (optional, customer-required for HIPAA "minimum necessary"), permission context (which role + which ABAC rule was evaluated).
- **Read access auditing**: optional per-collection (HIPAA-required for PHI; configurable).
- **Audit retention**: per-customer policy (default 7 years for HIPAA-eligible deployments; configurable down to 1 year for non-regulated tenants).
- **Audit immutability**: append-only; no updates; no deletes. Cryptographic hash chain (each row hashes the previous row) — optional, enabled for HIPAA tier.
- **Runtime anomaly tracking**: silent skips, fallback behaviors, and unexpected state writes go to the `runtime_anomaly` table (W2.D infrastructure preserved).

### 6.6 Secrets

- **AWS Secrets Manager** for all secrets (already in dependencies).
- **No secrets in env vars** except local development. CI uses Secrets Manager via OIDC federation.
- **Per-customer secret namespace** isolated via per-instance KMS key.
- **Integration credentials** encrypted at rest with per-customer key; rotated per integration per customer.
- **Plugin secrets**: customers can register secrets the plugin needs; platform exposes them to plugins via `usePlatformSecret()` hook with capability check. Secret never appears in plugin bundle.

### 6.7 Network

- **Per-customer instance**: own VPC (or VPC tenant); private DB subnet; public ingress only via platform API gateway.
- **API gateway**: rate limiting (per-user, per-IP, per-tenant), DDoS protection, WAF rules (OWASP top 10).
- **Service-to-service inside instance**: localhost or local network only; no public endpoints for `worker`.
- **Outbound integrations**: per-instance NAT IP for customer-side IP whitelisting.
- **Webhooks**: HMAC signature required (we sign outbound, verify inbound); replay protection via timestamp + nonce.

### 6.8 Compliance posture

- **HIPAA-eligible**: BAA available with HubbleWave; audit trail satisfies §164.312(b); access controls satisfy §164.312(a); transmission security satisfies §164.312(e); data integrity via audit hash chain.
- **21 CFR Part 11**: e-signatures via MFA + audit; non-repudiation guaranteed; record-integrity via append-only audit.
- **SOC 2 Type II**: audit-friendly architecture; clear control mapping; pursued in Wave 7.
- **GDPR**: data residency per-instance (deploy to customer's region); right-to-deletion via per-record purge tooling that triggers downstream cleanup; data subject access via export tooling.
- **HITRUST CSF**: framework alignment for healthcare-specific controls.

### 6.9 Threat model summary

| Threat | Mitigation |
|---|---|
| Plugin code escape | CSP + Plugin SDK restricted runtime + capability authz + admin install + bundle scan + signing |
| Cross-tenant data leakage (pooled mode) | Strict RLS + per-tenant test suite + chaos engineering |
| Privileged-account compromise | MFA + admin session monitoring + JIT access for sensitive ops |
| Data exfiltration via integration | Egress allowlist per integration + audit + rate limit |
| SQL injection | Parameterized queries (TypeORM enforced) + lint rule + scanner |
| XSS in custom UI | DOMPurify (existing dep) + CSP + plugin SDK escaping |
| CSRF | SameSite=Strict cookies + CSRF tokens for mutating endpoints + Origin header validation |
| Supply-chain (deps) | Approved-deps registry (W6.D, kept) + Renovate with security alerts + bundle scan |
| Insider threat | Field-level security + audit + dual-control for high-risk actions + JIT admin access |
| Stolen JWT | Short access TTL + refresh rotation + IP-binding option + revocation list |
| Brute force on auth | Account lockout + exponential backoff + WAF + rate limit |

### Diagram — Defense-in-depth

```mermaid
graph TB
  subgraph L1["Layer 1: Network perimeter"]
    WAF[WAF + DDoS protection]
    GW[API gateway<br/>+ rate limiting]
  end

  subgraph L2["Layer 2: Authentication"]
    JWT[JWT, OIDC, SAML, LDAP, MFA]
  end

  subgraph L3["Layer 3: Authorization"]
    RBAC[RBAC + ABAC]
    RLS[Row-level + field-level]
  end

  subgraph L4["Layer 4: Application"]
    SAN[Input sanitization<br/>+ TypeORM parameterized]
    PLUG[Plugin sandbox<br/>CSP + capability authz]
  end

  subgraph L5["Layer 5: Data"]
    ENC[Encryption at rest + in transit<br/>+ BYOK premium]
    ISO[Per-instance isolation<br/>or strict RLS pooled]
  end

  subgraph L6["Layer 6: Audit + detection"]
    AUDIT[Transactional audit<br/>+ hash chain]
    ANOM[Runtime anomaly detection]
    MON[Continuous monitoring<br/>+ SIEM integration]
  end

  L1 --> L2 --> L3 --> L4 --> L5 --> L6
```

---

## 7. Evolution map

How does Approach 2+ evolve in each future scenario?

### Scenario 1: Add a 2nd vertical app (e.g. Pharmacy)

**Architecture impact: zero infrastructure change.** New vertical pack (`@hubblewave/pharmacy-pack`), new domain entities (Medication, Prescription, Inventory, Dispensing), new vertical UI screens. Same metadata engine, automation engine, plugin SDK. The platform gets exercised by a second app — proves the platform claim by living on it.

### Scenario 2: Scale to 5–20 customers

**Architecture impact: linear.** Provision more customer instances. Each is single Nest process + Postgres + Redis. Control plane handles provisioning (already designed for this), billing, upgrades, monitoring. Operational cost grows linearly with customer count, not exponentially.

### Scenario 3: A specific module hits performance limit

**Example**: AVA needs GPU-heavy LLM serving and high-throughput vector search. **Solution**: extract the `ai` module as a separate service. Module boundaries make this surgical — well-defined Nest module with explicit interface becomes a HTTP/gRPC service consumed by the rest of the monolith. Other modules unaffected. The split is deferred until evidence demands it; today's prediction of "which module needs extraction" is speculative.

Other natural extraction candidates if ever needed: `search` (Typesense already external), `worker` (already separate), `notifications` (already a queue consumer).

### Scenario 4: Multi-region (US + EU customers)

**Architecture impact: per-region deployment.** Customer instance deploys in customer's region. Control plane is multi-region (active-active), syncing customer registry across regions for HubbleWave admins. Per-customer data NEVER crosses region boundaries. GDPR/data-residency satisfied by deployment topology.

### Scenario 5: White-label / OEM deployment

**Architecture impact: theming + plugin SDK already support this.** Different white-label gets different theme pack + branded UI plugin pack. Same code; different brand surface.

### Scenario 6: Public app marketplace

**Architecture impact: extend the pack registry to public.** Add pack publishing flow, monetization, ratings, ISV onboarding. Same install/upgrade infrastructure already in place. Plugin sandbox + capability authz become more critical (untrusted publishers).

### Scenario 7: Self-hosted deployment (customer runs in their cloud)

**Architecture impact: package as self-hostable distribution.** Helm chart, Docker compose. Control plane optional — customer manages own upgrades against published platform images. Plugin/upgrade-safety mechanism unchanged because the validator runs in-instance.

### Decision tree

```mermaid
flowchart TD
  Future[Future need] --> Q1{What kind?}

  Q1 -->|New vertical app| NewApp[Build as new vertical pack<br/>Same architecture]
  Q1 -->|New customer feature| Q2{Scope?}
  Q1 -->|Performance pressure| Q3{Where?}
  Q1 -->|More customers| Provision[Provision new instances<br/>via control plane]
  Q1 -->|New region| Region[Deploy customer instance<br/>in customer's region]
  Q1 -->|White-label| Theme[Theme pack + branded<br/>plugin pack]
  Q1 -->|Marketplace| Marketplace[Extend pack registry<br/>+ ISV onboarding]
  Q1 -->|Self-hosted| Helm[Helm chart distribution<br/>Validator runs in-instance]

  Q2 -->|One customer| CustPack[Customer pack<br/>+ optional plugins]
  Q2 -->|All customers| VerticalUpdate[Vertical pack update<br/>or platform feature]

  Q3 -->|One module| Extract[Extract module<br/>as service]
  Q3 -->|Whole instance| Q4{Pattern?}
  Q4 -->|CPU/memory| Vertical[Vertical scale<br/>same instance shape]
  Q4 -->|Database hot| ReadReplica[Read replicas<br/>or shard customer]
  Q4 -->|Concurrent users| API_HPA[Horizontal pod autoscale<br/>API behind LB]
```

### What's hard to undo

These commitments are expensive to reverse, so they should be intentional:

- **Pack manifest format** — once published with customer packs, format changes need migration tooling
- **Plugin SDK API surface** — once plugins are in customer hands, removing/changing APIs has the upgrade-cost we're trying to avoid
- **Customer schema namespace convention** — once customer tables are named `cust__{pack}__{collection}`, renaming is risky
- **Audit row schema** — append-only audit is hard to migrate

The architecture is designed to make these commitments thoughtfully and only when stable. Pack manifest v1 should be reviewed by 2–3 future-self thought experiments before publishing.

---

## 8. Migration sequence

From current 14-service to target modular monolith — with Day-1 mobile, Workspaces, UI Builder, Platform Analytics, and rich AI features. Nine waves (W0–W8), some parallelizable.

### Scope-expansion note

This sequence reflects the post-feedback v2 of the design: mobile is Day 1, Workspaces + UI Builder + Platform Analytics + rich AI are Day 1. The original 25-week critical path expands to **~32–35 weeks (~8–9 months) with aggressive parallelization** or **~45–50 weeks (~10–12 months) sequential**. Solo founder, realistically: 12–18 months. Two engineers, realistically: 8–10 months. Be honest with yourself and stakeholders about which lane you're in.

### Wave 0 — Lock the architectural decision (1 week)

- Amend canon (this design doc + canon delta in §9)
- Pause Plan Fix work that becomes irrelevant (Plan Fix 12 service-boundary scanner; Plan Fix 24 per-service entity sets; Plan Fix 16 AVA proposal state machine — defer)
- Re-orient remediation backlog around target architecture
- Set up `apps/api`, `apps/worker`, `apps/control-plane` directories (empty Nest scaffolds)

**Gate**: founder approves canon delta; no objection from internal review.

### Wave 1 — API consolidation (4–6 weeks)

- Move modules from each instance service into `apps/api/src/app/{module-name}/`
- Order (per dependency graph): `kernel` → `db` → `identity` → `audit` → `metadata` → `data` → `automation` → `views` → `forms` → `dashboards` → `notifications` → `integrations` → `ai` → `packs` → `plugins` → `upgrade` → `storage` → `search`
- Each module retains its existing tests (Jest + Vitest)
- Service-boundary scanner deleted
- Old services kept running side-by-side via routing rules; new traffic routed to monolith
- Cutover when all integration tests green and shadow comparator (W3 in Plan Fix 1 lineage) detects no drift

**Gate**: all 14 service E2E suites pass against the monolith; latency budgets met; smoke tests green.

### Wave 2 — Library consolidation (2 weeks)

- Merge `libs/event-bus` into modules that use it
- Merge `libs/redis` into kernel (cache abstraction)
- Merge `libs/auth-guard` into `identity` module
- Merge `libs/automation` into `automation` module
- Merge `libs/control-plane-db` into `apps/control-plane`
- Keep: `schema-engine`, `schema-validator`, `formula-parser`, `relationship-resolver`, `authorization`, `ai`, `storage`, `shared-types`, `ui-components`
- Drop: `enterprise` (folded into appropriate module), `analytics` (folded into `dashboards`)

**Gate**: `nx run-many --target=test --all` green; no orphan imports.

### Wave 3 — Frontend consolidation + Plugin SDK + Mobile foundation (5 weeks)

- web-control-plane folds into web-client (role-gated routes)
- Add `@hubblewave/plugin-sdk` (web) and `@hubblewave/plugin-sdk-mobile` packages
- Add plugin loader in `web-client` (Vite module federation runtime)
- **NEW**: Set up `apps/mobile` (React Native + Expo) with shared TypeScript packages
- **NEW**: Mobile auth (JWT + biometric session unlock)
- **NEW**: WatermelonDB schema + sync engine skeleton
- **NEW**: Mobile plugin SDK foundation (subset of web SDK adapted to RN)
- **NEW**: Mobile data hooks (offline-first reads + optimistic writes)
- Refactor existing customization UIs (form builder, view builder, automation editor) to consume the web SDK internally

**Gate**: web + mobile both load with shared auth; plugin loader proven by loading stub plugins on both; mobile reads + writes one collection with offline support.

### Wave 4 — Customization + Workspaces + UI Builder (full page authoring) (10 weeks)

- Define pack manifest format (YAML or JSON; version 1.0)
- Implement schema isolation (customer-namespaced tables, JSONB extensions, side tables)
- Build pack install/uninstall/upgrade/rollback flows
- Build customization design-time validation (referential integrity against current schema)
- Define full plugin SDK contract (web + mobile)
- Build plugin install + upload + bundle-scan + admin-approval flow
- **Workspace engine** — composition layer for views/dashboards/forms/plugins; persona homepages; multi-tab work surface; embedded AVA chat
- **UI Builder (full page authoring, ServiceNow UI Builder competitor)** — page composition canvas; route definition; layout authoring (header/sidebar/content/footer + nested); **templates**; **multi-screen workflows with state passing**; **variants (web/mobile/desktop)**; **localization**; **branding**; conditional logic; event wiring; theme awareness; live preview across variants; design-time validation; performance budget meter
- **Mobile workspace runtime** — same workspace concept, mobile-tuned layouts

**Gate**: hello-world customer pack installs and runs end-to-end on web + mobile; admin builds a multi-page workspace via UI Builder (with templates, variants, conditional logic, event wiring) and binds to live data; plugin uploaded, approved, loaded on web + mobile.

### Wave 5 — Upgrade validator + Platform Analytics + AI features + AI Code Assistant (8 weeks)

- Schema/API/plugin/workflow/integration diff calculators
- Validator UI (green/yellow/red display + remediation guide)
- Automated migration generator (yellow path, common patterns)
- **Platform Analytics ingestion pipeline** — event collection from api + worker + web + mobile; materialized views in Postgres; per-customer scoping
- **Domain analytics UI** — ad-hoc query authoring, pivots, scheduled report delivery, BI tool export
- **Platform usage analytics UI** — adoption, performance, customization usage, error tracking, AI-suggested optimizations
- **AVA conversational assistant** — chat panel (web + mobile); permission-aware retrieval; pluggable LLM provider per customer
- **AI authoring assist** — drafted automation rules, views, workspaces from natural language
- **AI search** — vector + keyword hybrid
- **AI Code Assistant** (Cursor/Copilot for the platform) — schema-aware completion in plugin authoring (web IDE + CLI); NL-to-formula and formula-to-NL; sandboxed-JS-aware automation script suggestions; integration adapter authoring assist; workspace-skeleton generation; analytics-query generation; deployment-time security/performance review; code-explanation; one-click error fix
  - LLM context: schema introspection + Plugin SDK docs (RAG) + customer's existing customizations (RAG) + security rules
  - Tool/function calling: `getCollections`, `getProperties`, `validateFormula`, `validatePluginCode`, `runSandboxedTest`
  - Inline UI in: plugin web IDE, formula editor, automation script editor, integration config editor, workspace builder, analytics query builder

**Gate**: validator classifies synthetic packs correctly; analytics dashboards show real adoption data; AVA chat answers a real query against real data; NL-authored automation rule drafts and saves; AI Code Assistant in formula editor converts NL to formula and explains existing formulas; AI Code Assistant blocks a deliberately-unsafe plugin upload.

### Wave 6 — Platform demo build (6 weeks; parallelizable with W4–W5)

The vertical pack is deferred (see §4.2 and Appendix D). Wave 6 builds a **lightweight demo set** that exercises every platform feature without committing to a full clinical/facilities domain model. The demo set IS the eat-our-own-dog-food validation that the platform's primitives are sufficient.

**Demo set contents**:

- **Generic demo collections** (built via metadata engine, not hand-modeled): an `Asset`-style collection, a `WorkOrder`-style collection, a `PreventiveMaintenance`-style collection — generic enough to be re-skinned per customer, rich enough to exercise every metadata feature
- **Demo workspaces** (built via UI Builder): generic personas (Manager Dashboard, Field Worker, Compliance Officer) — proves the workspace + UI Builder claim without committing to clinical-specific personas
- **Demo plugins** (built via Plugin SDK): one or two example plugins (a custom chart, a custom field renderer) — proves the plugin lifecycle end-to-end
- **Demo integration adapters** (built via integration platform): a generic webhook receiver + a generic outbound webhook adapter — proves the integration platform
- **Demo platform analytics scenarios**: dashboards over the demo data; usage analytics over admin behavior
- **Demo AI scenarios**: AVA chat answering questions on demo data; AI Code Assistant authoring formulas/automations against demo schema; predictive-maintenance demo over synthetic time-series data
- **Demo mobile experience**: technician-style workflows over the demo collections, fully offline-capable
- **Sample data + onboarding flow**: a fresh-instance startup script that loads demo content; admins can browse, customize, learn

**Gate**: end-to-end demo across web + mobile + AI: an admin builds a custom workspace via UI Builder + AI Code Assistant in 15 minutes; a field worker on mobile uses that workspace offline; the upgrade validator green-lights a synthetic platform upgrade; AVA answers a question that joins data across multiple demo collections.

### Wave 7 — Pre-launch hardening (4 weeks)

- Performance testing under realistic customer load (10k assets, 50 concurrent users, 1k WO/month)
- Penetration testing (external firm)
- HIPAA compliance audit (external firm; gap analysis)
- Disaster recovery drill (per-instance backup + restore)
- Customer instance provisioning runbook
- Documentation (admin guide, customer guide, plugin developer guide, integration developer guide)
- WebAuthn MFA addition
- OpenTelemetry tracing across the monolith

**Gate**: pen-test report shows no critical/high findings unaddressed; HIPAA audit shows no compliance gaps for healthcare customers; DR drill restores within RTO.

### Wave 8 — Platform pilot with first customer (4 weeks)

The pilot validates the *platform* by having the customer build their own clinical/facilities customizations on it — not by handing them a pre-built CMMS. This is a stronger demo of the platform claim and lower-risk for solo execution.

- Provision pilot instance for current employer (single-tenant, dedicated)
- Customer-led discovery workshop: catalog the customizations their Nuvolo deployment has accumulated; identify the top 5–10 most painful "broke on upgrade" scenarios
- **Customer builds their first custom pack with you co-piloting**:
  - Custom collections (their actual asset categories, with their actual fields)
  - Custom forms / views / workspaces (mirror their current Nuvolo workflows)
  - Custom plugins (rebuild the 1–2 plugins that broke on their last Nuvolo upgrade)
  - Custom integrations (1 critical integration; e.g. their AD or their EHR)
- **Walk the upgrade-safety guarantee end-to-end**: deploy v1 → ship a synthetic v2 platform "upgrade" with deliberately-breaking changes → run validator → see green/yellow/red → apply auto-migrations → green
- AI Code Assistant adoption metrics: how often did the customer's admin use it; what was generated; what was rejected
- Iterate on feedback; gather requirements for second customer

**Gate**: customer signs off on the platform pilot; agrees in principle to a paid contract once vertical pack is delivered (Wave 9+, separate design); willing to be a reference customer.

### Total timeline (solo founder, platform-only scope)

| Wave | Duration | Notes |
|---|---|---|
| W0 Lock decision | 1 wk | Canon amendment, scaffold setup |
| W1 API consolidation | 5 wk | 14 services → 3 |
| W2 Lib consolidation | 2 wk | 21 libs → ~10 |
| W3 Frontend + SDK + Mobile foundation | 5 wk | Web + mobile + plugin SDK skeleton |
| W4 Customization + Workspaces + UI Builder (full page authoring) | **10 wk** | +2 from v2 for full page authoring + templates + multi-screen flows + variants + localization |
| W5 Validator + Analytics + AI features + AI Code Assistant | **8 wk** | +2 from v2 for AI Code Assistant |
| W6 Platform demo build | **6 wk** | Down from 12–14 wk for full vertical pack; demo set only |
| W7 Hardening | 4 wk | Pen test, HIPAA gap analysis, DR drill |
| W8 Platform pilot | 4 wk | Customer builds their own pack on the platform |
| **Solo sequential total** | **45 wk** | **~10–11 months** |

**Critical path scenarios**:

| Scenario | Critical path | Calendar time |
|---|---|---|
| **Solo founder, platform-only (this scope)** | 1+5+2+5+10+8+6+4+4 = **45 wk** | **~10–11 months** |
| **Solo founder with realistic buffer for solo realities (illness, deeper-than-expected refactors, dependency surprises)** | +6–8 wk buffer | **~12 months** |
| **+1 full-time engineer** | parallelism on W6 + parts of W4/W5 | **~7–8 months** |

Honest framing:
- **Solo founder, platform-only**: ~12 months to platform-pilot-ready (this is YOUR scenario).
- **Solo founder with rebuild of full Day-1 scope including vertical pack**: would be 18+ months — which is why we deferred the pack.
- **Solo founder + 1 contractor for mobile + AI**: 9–10 months feasible if the contractor takes W3 mobile + W5 AI Code Assistant in parallel with founder doing W1/W2/W4.

Telling your employer the realistic ~12-month timeline (with a clear demo at month 8 of the platform features in a generic demo set) is the right pitch. Under-promise; over-deliver.

### Wave gantt (solo founder, platform-only)

```mermaid
gantt
  title Migration sequence (solo, platform-only)
  dateFormat YYYY-MM-DD
  axisFormat %b

  section Foundation
  W0 Lock decision                   :w0, 2026-05-15, 7d
  W1 API consolidation               :w1, after w0, 35d
  W2 Lib consolidation               :w2, after w1, 14d
  W3 Frontend + SDK + Mobile         :w3, after w2, 35d

  section Platform features
  W4 Customization + Workspaces + UIB:w4, after w3, 70d
  W5 Validator + Analytics + AI      :w5, after w4, 56d

  section Demo + Launch
  W6 Platform demo build             :w6, after w5, 42d
  W7 Hardening                       :w7, after w6, 28d
  W8 Platform pilot                  :w8, after w7, 28d
```

---

## 9. Canon delta

Disposition of every existing canon clause, plus new clauses introduced by this design.

| § | Clause | Action | Note |
|---|---|---|---|
| 1 | This is a brand-new platform | KEEP | Greenfield discipline still right; no "V1/V2/legacy" language |
| 2 | Code is a product surface | KEEP | Naming + clarity discipline still right |
| 3 | Platform, not application | KEEP | Confirmed by user's positioning — Nuvolo competitor on configurability |
| 4 | Metadata is the product | KEEP | Now load-bearing for the customization moat |
| 5 | One instance per customer | **SOFTEN** | "Single-tenant per-customer instance" stays as the **default deployment** for paying customers (preserves the pitch). ALSO support **multi-tenant pooled mode** (shared Postgres with RLS keyed by `tenant_id`) for: free trials, sales demos, internal dev/staging, lower-tier customers, future ISV marketplace. Architectural cost: every query carries tenant context; RLS policies on every table; per-tenant cross-tenant-leak tests. Architectural benefit: trials + demos + low-tier economics that strict §5 forbids. Customer procurement still hears "your production instance is fully dedicated"; only trial/lower-tier sees pooled. |
| 6 | Schema before data | KEEP | |
| 7 | Views are first-class | **SOFTEN** | Drop the 5-tier view hierarchy (System → Tenant → Role → Group → Personal); customer-namespaced + role views are sufficient |
| 8 | Automation ≠ Workflow | **INVERT** | Merge into ONE engine with two modes (sync-rule / durable-workflow); ServiceNow's split is a tax, not a feature; canon language amended |
| 9 | Authorization is centralized | KEEP | W1.2 + W1.5 + W5.D enforcement preserved |
| 10 | Auditability is mandatory | KEEP | W1.6 + W2.D + W3.C transactional-audit preserved |
| 11 | AI is infrastructure | **SOFTEN** | AI is a richly-integrated feature surface: chat, NL authoring, doc-AI, predictive, vision, voice, AND **AI Code Assistant** (Cursor/Copilot for plugin/formula/automation/integration/workspace/analytics authoring) — direct competitor to ServiceNow's Now Assist for Creators. AVA is a Nest module wired into every authoring surface; not "infrastructure framework" but central to the product surface customers see. |
| 12 | Trust earned incrementally | **PER-FEATURE** | Progression (Suggest → Preview → Approve → Execute → Audit) applies per AI feature when customer enables autonomous action; not platform-wide infrastructure |
| 13 | Upgrade safety is required | **EXPAND** | Becomes the load-bearing differentiator; new mechanism in §5.4; Plan Fix added for "upgrade compatibility validator" |
| 14 | Delete ruthlessly | KEEP | W2.A reference-checker on metadata delete preserved |
| 15 | Speed never justifies decay | KEEP | |
| 16 | Manifesto is law | KEEP | |
| 17 | High-level architecture | **UPDATE** | Reflect modular monolith topology (3 backends, 2 frontends, per-customer DB) |
| 18 | Control Plane | KEEP | Stays as separate process; correctly multi-tenant |
| 19 | Customer Instance | **UPDATE** | Single Nest process per instance, not 14 services |
| 20 | Enforcement is part of architecture | KEEP | |
| 21 | Enforcement layers | **TRIM** | Drop service-boundary scanner; drop terminology scanner (becomes lint rule); keep audit-bypass + authz-bypass + approved-deps + canon-amendment process |
| 22 | AI agent compliance | KEEP | Applies to me as well as future agents |
| 23 | Canon as execution contract | KEEP | |
| 24 | Canon maintenance | KEEP | Amendment process still right; expand log to include this design doc |
| **NEW §17.5** | **Customizations are versioned, namespaced, and validated against platform-API versions. No customization may modify platform schema. Upgrades are blocked when customer customizations would break.** | ADD | Defines the upgrade-safety contract; this is the moat |
| **NEW §25** | **Plugin SDK is the platform contract.** API stability is committed for N=2 major versions. Removed APIs ship with automated migration tooling. Mobile and web SDKs share the contract philosophy with separate adapter packages. | ADD | Stability promise to plugin authors; the precise commitment ServiceNow can't make |
| **NEW §26** | **Mobile is a first-class platform surface.** All field-staff workflows have mobile parity with web. Mobile is offline-first; the offline-degraded experience is the design baseline, online is the bonus. Customizations (workspaces, plugins, automations, views) apply to mobile via `@hubblewave/plugin-sdk-mobile`. | ADD | Direct competitive lever vs Nuvolo's weak mobile; healthcare field staff explicit pain point |
| **NEW §27** | **Workspaces and UI Builder are the platform's user-facing customization surface.** Customers compose persona-tuned UIs and entire pages without code, using the same primitives HubbleWave uses to ship vertical packs. Eat-our-own-dog-food: every OOTB workspace is built via the same UI Builder customers use. | ADD | Makes the platform claim visible in a demo |

### Summary of canon energy redirected

- **Stays load-bearing**: §1, §2, §3, §4, §6, §9, §10, §13 (now expanded), §14, §15, §16, §18, §20, §22, §23, §24
- **Softened or inverted to match modular monolith reality**: §5, §7, §8, §11, §12, §17, §19, §21
- **New clauses for the moat**: §17.5 (upgrade safety contract), §25 (plugin SDK stability)

---

## Appendices

### A. What was decided in this design that the reader can challenge

These are the load-bearing decisions; if any of these are wrong, the design has to change:

1. **Modular monolith over microservices** for customer instance — predicated on team size + Shopify/Basecamp precedent. If team grows to 20+ engineers in year 2, revisit.
2. **Schema isolation via customer-namespaced tables + JSONB extensions** — predicated on Postgres handling this gracefully at customer scale. Verify with synthetic load test in Wave 7.
3. **Plugin SDK with module federation** — predicated on Vite module federation being production-stable. If it isn't, fall back to sandboxed iframes with PostMessage.
4. **Automation + workflow merged** — predicated on customers not needing both engines side-by-side. Validate with first customer in Wave 8.
5. **AVA as a richly-integrated feature surface (incl. AI Code Assistant)** — not infrastructure framework, but central authoring-surface pillar. Predicated on AI features being scoring points and the AI Code Assistant being demo-critical for non-developer admins.
6. **§5 SOFTEN — single-tenant default + pooled mode optional** — predicated on the trial/sandbox/marketplace/low-tier use cases being valuable enough to justify the architectural cost (tenant_id threading, RLS policies, dual-mode tests). Strict §5 would be simpler code but would forbid free trials and sandboxes. *Locked SOFTEN per founder direction 2026-05-09.*
7. **Upgrade-safety guarantee** — predicated on the contract being complete (no side-channels for customizations). If anywhere a customization can enter the system unvalidated, the guarantee fails. Audit aggressively in Wave 4.
8. **React Native + Expo (not Flutter, not native)** — predicated on TypeScript code reuse with web outweighing Flutter's performance edge. *Locked per founder direction 2026-05-09.* Validate with usability tests in W6 platform demo.
9. **Single mobile codebase serves both technicians and managers** — predicated on the same platform primitives + role-tuned workspaces being sufficient. If managers need fundamentally different UX patterns, may split into two mobile apps eventually.
10. **Workspaces + UI Builder full page authoring (ServiceNow UI Builder competitor) ship Day 1** — *locked per founder direction 2026-05-09.* Predicated on the customer's heavy use of ServiceNow UI Builder and inability to demo without it. Not negotiable.
11. **Pluggable LLM provider per customer** — predicated on hospitals wanting control over LLM data residency for HIPAA. Default to Ollama (local) for dev; production providers chosen per customer with their BAA.
12. **Self-hosted analytics (no third-party)** — predicated on HIPAA concerns about data leaving customer instance. If third-party analytics get HIPAA-compliant offerings, may revisit for cost.
13. **Vertical pack (Clinical/Facilities Asset Management) deferred to separate design** — *locked per founder direction 2026-05-09.* Predicated on platform-first being the right discipline for solo execution and the customer's pilot being stronger when they build their own pack on the platform. The Wave 6 generic demo set proves the platform without committing to vertical-specific scope.
14. **Solo founder timeline ~10–12 months, no parallelism assumed** — predicated on solo execution. If a contractor joins for mobile/AI work, timeline drops to 7–9 months. Plan for solo; treat any extra hands as upside.

### B. Out of scope for this document

- **Specific TypeScript interface definitions** — emerge during implementation; design doc names boundaries
- **Database column types and exact entity schemas** — emerge during Wave 6 domain modeling
- **PR-by-PR migration plan** — produced by `superpowers:writing-plans` after this doc is approved
- **UI mockups** — separate concern (frontend-design)
- **Sales/pitch deck content** — derivable from §4, §5, §6 but a different artifact

### C. Glossary

- **Pack** — a versioned bundle of customizations (schema, automation, views, plugins, integrations) with a manifest declaring its API contract.
- **Customer pack** — pack authored by a customer for their own instance.
- **Vertical pack** — pre-built application pack shipped by HubbleWave (e.g. Clinical/Facilities Asset Management — *deferred, see Appendix D*).
- **Plugin** — a customer-uploaded React component bundle that runs inside the platform's web client via the Plugin SDK.
- **Plugin SDK** — `@hubblewave/plugin-sdk`; the typed, versioned contract plugins consume.
- **Customization surface** — the set of platform extension points (schema, automation, views, forms, integrations, plugins) that customers can modify; this surface IS the contract for upgrade safety.
- **Customer instance** — a per-customer deployment of the platform: one `api`, one `worker`, one Postgres, one Redis (single-tenant default per §5 SOFTEN).
- **Pooled mode** — multi-tenant deployment where multiple customers share infrastructure with RLS isolation (§5 SOFTEN).
- **Control plane** — multi-tenant HubbleWave-owned service that provisions, upgrades, monitors, and bills customer instances.
- **Validator (upgrade)** — pre-upgrade compatibility checker; classifies upgrades as green/yellow/red.
- **AI Code Assistant** — Cursor/Copilot-style AI for customers building plugins/formulas/automations/integrations/workspaces/analytics queries; competitor to ServiceNow's Now Assist for Creators.

### D. Deferred vertical pack inventory

The Clinical/Facilities Asset Management vertical pack is deferred to a separate design. The inventory below is preserved for forward reference only — it is **NOT** scope for this design and **NOT** part of the Wave 6 platform demo build. It will inform a follow-on design effort once the platform is in customer hands.

This list is the result of v2 design exploration; treat it as a working catalog, not a commitment.

#### Asset management (deferred)
- Asset inventory (medical devices, HVAC, MRI, infusion pumps, biomedical equipment, building systems)
- Asset hierarchy (system → subsystem → component)
- Asset categories with category-specific fields:
  - Medical device class (FDA Class I/II/III)
  - FDA UDI (Unique Device Identifier)
  - Sterilization status / cycle counts
  - Calibration intervals + last/next due
  - IR / vibration / ultrasound meter readings
  - Manufacturer recall status
- Asset lifecycle (commissioned → in-service → maintenance → retired → decommissioned)
- Photos, manuals, schematics, warranty docs (S3-backed)
- Mobile asset lookup (QR/barcode scanning)

#### Work order management (deferred)
- Reactive work orders (corrective maintenance)
- Preventive maintenance schedules (interval-based, condition-based, runtime-based)
- Inspections (Joint Commission, fire safety, biomedical)
- Calibrations (with traceable certificates)
- Permit-to-work (lockout/tagout, hot work, confined space)
- Multi-shop assignment + dispatch
- Technician mobile UI (lookup, status update, parts request, photo capture)

#### Space and location management (deferred)
- Hospital → building → floor → room → bed hierarchy
- Space utilization tracking
- CAD / floor plan integration (DWG, IFC)
- Patient care area mapping
- Room-equipment assignment

#### Compliance & regulatory (deferred)
- Joint Commission audit trails
- FDA recall management workflow
- Equipment downtime impact tracking (patient-care criticality)
- 21 CFR Part 11 e-signatures
- HITECH HIPAA logging
- AEM (Alternative Equipment Maintenance) program documentation
- Regulatory readiness dashboard

#### Vendor & contract management (deferred)
- Vendor records, contacts, certifications
- Service contracts with SLA tracking
- Warranty management with expiration alerts
- Service history per asset per vendor
- Vendor portal (self-service work order updates)

#### Inventory & parts (deferred)
- Parts catalog
- Inventory levels per warehouse/bin
- Parts requisition workflow
- Reorder point automation
- Vendor cross-reference

#### Reporting & dashboards (deferred)
- Equipment uptime / MTTR / MTBF
- PM compliance %
- Cost-center spend
- Vendor performance scorecards
- Regulatory readiness indicators
- Asset utilization heatmaps

#### Integrations (deferred)
- HL7 v2 / FHIR R4 for patient context
- BACnet / Modbus for building management systems
- Legacy CMMS/EAM connectors (Maximo, Infor, Nuvolo) for migration
- ERP (SAP, Oracle, Workday) for procurement and accounting
- EHR (Epic, Cerner) for patient-care criticality tags
- Active Directory / SCIM for identity
- Email / SMS gateway providers
- Mobile app (technician + manager)

**Important**: every item above is implementable as a customer pack on the platform once it ships. The platform's customization surface (custom collections, properties, workflows, plugins, integrations) is sufficient to deliver this entire inventory. The deferred work is *building the pack*, not building platform capability — that's the whole point of platform-first.

---

## Decision request

This design supersedes parts of `CLAUDE.md` (the master canon). Specifically, it asks the founder to:

1. **Approve the architectural shift** from 14-service distributed system to 3-process modular monolith + mobile app.
2. **Approve the canon delta** in §9 — including new clauses §17.5 (upgrade safety), §25 (Plugin SDK contract), §26 (mobile first-class), §27 (Workspaces + UI Builder).
3. **Approve the migration sequence** in §8 (~45 weeks / ~10–12 months solo critical path; platform-only scope).
4. **Approve the customization moat** in §5 as the load-bearing differentiator vs Nuvolo/ServiceNow.
5. **Approve the platform-first scope** — vertical pack (Clinical/Facilities Asset Management) deferred to a separate design doc, captured in Appendix D as forward inventory.

### Founder direction locked (2026-05-09 conversation)

- Mobile: React Native + Expo, Day 1 ✓
- Solo founder lane: ~12 months realistic ✓
- AI Code Assistant: Day 1 ✓
- UI Builder: full page authoring (ServiceNow UI Builder competitor) ✓
- §5: SOFTEN (single-tenant default + pooled mode for trial/sandbox/low-tier) ✓
- Vertical pack: deferred to separate design ✓

Once approved, the next step is `superpowers:writing-plans` to produce the per-wave implementation plan (PR-level, file-level) for the platform-only scope.

Push back on any section before that step.
