# HubbleWave App Studio — Implementation Plan

**Status:** Authoritative single source of truth. Supersedes both prior chat-form
plans (the architecture-deltas brief and the file-paths brief) and the
ServiceNow-comparison addendum.

**Audience:** core engineers, architecture review, AI coding agents.

**Scope:** the in-platform builder surface — App Studio shell, Table Builder,
Form Builder, Display Rules, Process Flow Studio, Decision Tables, Automation
Rules, Workspace Builder, Change Packages — and the supporting metadata
infrastructure (Application registry, uniform lifecycle, pack-vs-custom
provenance) needed to make those builders shippable.

---

## 1. Goal

Close the gap between HubbleWave and ServiceNow's App Engine: customers
build applications end-to-end inside HubbleWave without leaving the
platform. The deliverables are visual builders for tables, forms, flows,
decision tables, automation rules, and workspaces, all hosted in a unified
App Studio shell, all backed by an Application registry that anchors
metadata scoping and a uniform DRAFT/PUBLISHED lifecycle that gates
runtime to published artifacts only.

---

## 2. What exists in HubbleWave today

| Capability | Status | Location |
|---|---|---|
| Collection (table) metadata CRUD | ✅ Exists | `svc-metadata` |
| Property (field) CRUD | ✅ Exists | `svc-metadata` |
| Record data CRUD with RLS | ✅ Exists (Wave 2 hardened) | `svc-data` |
| Views / list engine | ✅ Exists | `svc-metadata` views, `svc-view-engine` |
| Workflow instances + approvals | ✅ Exists (Wave 2 hardened) | `svc-workflow` |
| AVA AI embedded | ✅ Exists | `svc-ava` |
| Access rules / RBAC | ✅ Exists | `svc-metadata` access |
| **Application registry** | ✅ Exists (Phase 0 Slice A) | `svc-metadata` |
| **App Studio Home + naming-shortcut routes** | ✅ Exists (Phase 0 Slice B) | `apps/web-client/src/features/admin/applications` |
| `ViewDefinition` revisions | ✅ Exists | `view.entity.ts` |
| `NavigationModule` revisions | ✅ Exists | `navigation-module.entity.ts` |
| `Application` revisions | ✅ Exists (Phase 0 Slice A) | `application.entity.ts` |
| `Pack` revisions | ✅ Exists | `pack.entity.ts` |
| `FormVersion` (append-only history) | ⚠️ Partial — no `status`, no `currentVersionId` pointer, no publish gate | `form.entity.ts` |
| `extendsCollectionId` column | ⚠️ Half-built — column exists, no service consumes it | `collection-definition.entity.ts:167` |
| Computed property types (`formula`, `rollup`, `lookup`, `hierarchical`) | ⚠️ Half-built — types seeded, no executor | migration `1802000000000` |
| `ProcessFlowDesigner` (custom canvas, not React Flow) | ⚠️ Partial | `apps/web-client/src/features/admin/components` |
| `AutomationEditorPage.tsx` | ⚠️ Partial (244 lines) | `apps/web-client/src/features/automation` |
| `AppBuilderPage` (Phase 7 stub) | ⚠️ Partial | `apps/web-client/src/features/phase7/app-builder` |
| `applicationId` foreign key on `CollectionDefinition` | ✅ Wired (Phase 0 Slice A) | — |
| `applicationId` on other metadata entities | ❌ Missing — Phase 0 Slice C | — |
| Uniform DRAFT/PUBLISHED on `CollectionDefinition`, `PropertyDefinition`, `ProcessFlowDefinition`, `AutomationRule` | ❌ Missing — Phase 0 Slice C | — |
| Visual Table Builder UI (tabbed: data / forms / policies / flows) | ❌ Missing — Phase 1 | — |
| Computed-property executor | ❌ Missing — Phase 1 | — |
| Inheritance materialization (`extendsCollectionId` wiring) | ❌ Missing — Phase 1 | — |
| Property behavioral attributes (encryption / audit / mask) | ❌ Missing — Phase 1 | — |
| Drag-drop Form Builder + Display Rules | ❌ Missing — Phase 2 | — |
| React-Flow Process Flow Studio + Action Library + Data Pill Picker + test runner | ❌ Missing — Phase 3 | — |
| Decision Tables (4-entity model) | ❌ Missing — Phase 3 | — |
| Guided Processes (Playbooks) | ❌ Missing — Phase 3 | — |
| Automation Rule visual builder | ❌ Missing — Phase 4 | — |
| `WorkspacePage` entity (multi-page Workspace) | ❌ Missing — Phase 5.0 | — |
| Workspace Builder UI | ❌ Missing — Phase 5 | — |
| `phase7-revolutionary.entity.ts` rename to `app-builder.entity.ts` | ✅ Shipped — Slice D | — |
| Change Packages | ✅ Shipped — Phase 6 | — |
| Pack-vs-custom record provenance | ✅ Shipped — Phase 6 | — |
| Service Catalog / Portal | Out of scope (Q4) | — |
| UI Scripts (sandboxed JS) | Out of scope (Q1) | — |
| Localization / i18n | Out of scope (post-Phase-6) | — |

---

## 3. Naming convention (canon §1 compliance)

We do NOT use ServiceNow terms in our UI or docs. Any commit that introduces
ServiceNow terminology in a user-visible string fails canon scan.

| ServiceNow term | HubbleWave term |
|---|---|
| Table | Collection |
| Field | Property |
| Record | Record |
| Form | Record Form |
| List view | Record List |
| Flow Designer | Process Flow Studio |
| Flow | Process Flow |
| Playbook | Guided Process |
| Action | Flow Action |
| Subflow | Flow Module |
| Decision Table | Decision Table |
| Business Rule | Automation Rule |
| Client Script | UI Script *(deferred — Q1)* |
| UI Policy | Display Rule |
| Workspace | Workspace |
| App Engine Studio | App Studio |
| Update Set | Change Package |
| Service Catalog | Service Catalog *(deferred — Q4)* |
| Portal | Service Portal *(deferred)* |
| Spoke | Connector |
| Sys ID | Record ID |
| Dictionary entry | Property attribute |

---

## 4. Architecture Decision Records

### ADR-1: App Studio shell ships first, before any builder
Build `web-client` as the App Studio — a unified in-platform IDE-like shell
that houses Table Builder, Form Builder, Process Flow Studio, Workspace
Builder under one left-nav. Phase 0 Slice B has shipped the shell at
`/studio/apps`; subsequent builders mount inside it.

**Status:** Implemented (Phase 0 Slice B). `AppStudioHome`,
`ApplicationDetailPage`, naming-shortcut redirector at
`/studio/c/:code/:tab` all live.

### ADR-2: Process Flow execution stays in `svc-workflow`; editor lives in `web-client`
Engine is unchanged. Wave 2 hardened it (NFKC sandbox + AST depth + timeout +
optimistic locking + `partial_failure` + principal-type audit). It's
BullMQ-backed already. The visual editor is a `web-client` React Flow
component that writes JSON conforming to `ProcessFlowDefinition.canvas`.

### ADR-3: Form Builder stores layouts as JSON in `svc-metadata`, resolved by `svc-view-engine`
Form layouts (sections, tabs, field order, conditional rules) are
`FormLayout` records in `svc-metadata`. Resolution server-side in
`svc-view-engine`. React renderer consumes the resolved structure.

### ADR-4: Automation Rules compile to event-driven hooks in `svc-data`
Rules are stored as metadata and executed by `svc-data`'s event pipeline
on record create/update/delete/query events. Triggers subscribe to
`EventEmitter2`; actions are *structured* (`SetField`, `CreateRecord`,
`FireEvent`, `CallFlow`, `Abort`), never raw scripts.

### ADR-5: Uniform DRAFT/PUBLISHED lifecycle on every metadata entity
Every metadata entity (`Collection`, `Property`, `FormLayout`,
`ProcessFlowDefinition`, `AutomationRule`, `WorkspaceDefinition`,
`DecisionTable`, `Application`) carries:

- A `<entity>_revisions` table with `revision`, `status` (`draft | published`),
  `payload`, `created_by`, `published_by`, `published_at`.
- `status` (`draft | published | deprecated`) on the parent row.
- `current_revision_id` pointer on the parent.

Active references resolve only to **published** revisions; admins author
against drafts. Modeled on the existing `ViewDefinitionRevision` pattern.
**Without this, every builder ships saves to live state and admins break
production with half-finished edits.**

**Status:** Pilot landed on `Application` (Phase 0 Slice A). Broad rollout
in Phase 0 Slice C (CollectionDefinition + PropertyDefinition first;
ProcessFlowDefinition + AutomationRule second).

### ADR-6: `applicationId` scoping across all metadata
Every metadata entity has an `applicationId` foreign key referencing
`Application`. Name resolution scoped per app. A single instance can host
multiple sub-apps (HR + IT + Facilities) without naming collisions.

**Status:** Phase 0 Slice A wired the column on `CollectionDefinition` with
foreign key + NOT NULL after backfill. Slice C fans the column out to
`PropertyDefinition`, `ViewDefinition`, `FormLayout`,
`ProcessFlowDefinition`, `AutomationRule`, `NavigationModule`,
`WidgetCatalog`, `WorkspaceDefinition` (when it exists).

### ADR-7: Pack-vs-custom record provenance
Every metadata record carries a `source` enum: `pack:<pack-id>` for
records shipped by an installed pack, `custom` for customer-created. Pack
upgrade overwrites only `source = pack:*` rows; `custom` rows always
survive. Closes canon §13 (upgrade safety required). The Wave 1
pack-signing infrastructure is the substrate; this surfaces it in
metadata. Lands in Phase 6 alongside Change Packages.

### ADR-8: STI rejected — physical-materialization for Collection inheritance
ServiceNow uses single-table inheritance with a `sys_class_name`
discriminator (every child collection's fields live in the parent
table). HubbleWave deliberately diverges: each collection is exactly
one Postgres table; child collections materialize parent columns into
their own table at deploy time. Postgres performs better with narrow
tables and explicit joins than with hundred-column unions.

### ADR-9: Single-section forms always have a parent FormLayout row
ServiceNow's quirk where single-section forms exist as bare
`sys_ui_section` rows without a parent form record creates upgrade
pain. HubbleWave always writes a parent `FormLayout` regardless of
section count. Documentation-only — codifies existing
`FormLayoutDesigner` behavior.

### ADR-10: One Workspace authoring path
ServiceNow has a legacy/modern bifurcation (Workspace Builder vs UI
Builder). HubbleWave has only one Workspace authoring tool —
Workspace Builder. UI Builder equivalents (customer-authored React
components) are out of scope until the security model for arbitrary
customer JS in the platform shell is designed (separate ADR).

### ADR-11: Naming-shortcut URLs are redirectors, not first-class routes
The user-facing URL pattern is `/studio/c/<collection-code>/{data,
forms, policies, flows, sheet}`. Underlying pages stay on
`/studio/collections/<id>/...` until Phase 1 collapses them into a
single tabbed Table Builder. The shortcut component is the only place
that knows both shapes.

**Status:** Implemented (Phase 0 Slice B) via `CollectionShortcut.tsx`.

### ADR-12: Permissions decomposition is paired with guard updates
New per-feature permission slugs (`metadata.collections.edit`,
`metadata.properties.edit`, `metadata.forms.edit`, etc.) require
matching guard branches. The existing `CollectionAccessGuard` (Wave 2)
maps HTTP method to permission; new slugs must drive new branches.
**Seed migration alone is not sufficient.** Both ride the same PR.

### ADR-13: Collection-centric tabbed UI is the Phase 1 organizing principle
Forms / Display Rules / Flows are tabs of a Collection's record in App
Studio, not separate top-level destinations. Form Builder is
implemented as a top-level component but exposed only through the
Collection's Forms tab. This was the most important UX shift identified
during ServiceNow comparison; it drives the *order of work* in Phase 1.

### ADR-14: Decision Tables use a typed-IO model
`DecisionTable` (the spec), `DecisionInput` (input columns), and
`DecisionRow` (a row of conditions and answer reference). Answer rows
are sourced from a configurable answer Collection (any Collection in
the instance, referenced via `answerCollectionCode`); the table does
not own a dedicated answer entity. This typed-IO shape preserves
end-to-end type safety the moment an input is a reference field or
choice list — the compressed single-entity model breaks at that
point. Required for Phase 3a's typed-action contract.

### ADR-15: WorkspacePage refactor before any Workspace Builder UI
`WorkspaceDefinition` is the parent; `WorkspacePage` (kinds: `home`,
`list`, `record`, `search`, `analytics`, `custom`) is the child. A
Workspace is a multi-page artifact, not a single dashboard. Refactor
the entity at Phase 5.0 (before any UI), since post-UI refactors are
exponentially more expensive.

### ADR-16: Spreadsheet sub-tab is read-only by default with explicit edit gate
The Data tab's Spreadsheet view (records, not schema) defaults to
read-only. Edit mode requires the `metadata.collections.spreadsheet.write`
permission AND an explicit "Enter Edit Mode" toggle, with audit-log
emission on entry. Avoids blurring schema administration with data
management.

### ADR-17: Schema-change publish policy is classified, not uniform
When publishing a Collection or Property revision (ADR-5), the publish
endpoint classifies the diff into one of three impact tiers and the UX
adapts:

- **`cosmetic`** (label, description, help text, validation rule
  tweaks within the same operator) — publish without prompt.
- **`structural`** (rename, type widen, new behavioral attribute,
  new validator added) — publish proceeds; every dependent artifact is
  marked `needs-review` in a new `dependent_review_queue` table and
  surfaced in the App Studio dashboard until acknowledged.
- **`breaking`** (delete, type narrow, required-flag flip, removal of
  an option from a choice list still in use) — publish blocked behind
  an explicit dialog enumerating affected dependents; admin must check
  each one. Optional cascade-rewrite available for renames only;
  cascade is forbidden onto rows where `source = pack:*` (per ADR-7),
  which are flagged instead.

**Why this and not the alternatives:**

- *Block-on-any-dependents* (ServiceNow): freezes admin productivity
  and creates a long tail of half-done renames.
- *Auto-cascade-everything* (Salesforce): silently corrupts
  pack-shipped rows, which would violate ADR-7 (upgrade safety).

**Why this is future-proof:**

- New dependent kinds (Decision Tables in 3b, Workspaces in 5,
  Change Packages in 6) register an `ImpactAnalyzer` against the
  publish pipeline. The publish endpoint contract does not change.
- New change kinds extend the classifier. The dialog UX does not
  change.
- The `dependent_review_queue` is the single inbox the dashboard
  reads from; new kinds plug in without UI rework.

**Implementation footprint:**

- `svc-metadata`: `ImpactAnalyzerRegistry` + per-entity analyzers;
  `dependent_review_queue` table + service.
- `web-client`: `useTableBuilder.ts` reads classification from the
  publish-preview endpoint; `PublishConfirmDialog` switches mode by
  classification; Studio dashboard surfaces queue.

Lands in Phase 1 §6.1 (preview endpoint + cosmetic path) and is
extended through every later phase as new dependent types ship.

---

## 5. Phase 0 — Foundation

**Goal:** Every later phase has a home, a scope to live under, and
safe-edit semantics from day one.

### 5.1 Slice A — Application registry + scoping pilot ✅ Shipped (`3a52e03`)
- `Application` + `ApplicationRevision` entities (lifecycle pilot for ADR-5)
- Migration `1833000000000-applications-registry.ts`: tables, FK
  constraint on `collection_definitions.application_id`, backfill to
  `default` Application
- `ApplicationModule` in `svc-metadata` with full CRUD + publish +
  deprecate + revision history endpoints
- All 11 backend services build clean

### 5.2 Slice B — App Studio shell ✅ Shipped
- `apps/web-client/src/features/admin/applications/`:
  - `AppStudioHome.tsx` — registry list, search, status badges
  - `CreateApplicationDialog.tsx` — name + auto-derived code
  - `ApplicationDetailPage.tsx` — per-app shell with publish /
    deprecate / edit-as-draft / revision history
  - `CollectionShortcut.tsx` — redirector for
    `/studio/c/:code/:tab` (ADR-11)
- Routes: `/studio/apps`, `/studio/apps/:id`, `/studio/c/:code`,
  `/studio/c/:code/:tab`
- Discoverability tile on `AdminDashboardPage`
- Vite proxy rule `/api/applications` → svc-metadata

### 5.3 Slice C — Lifecycle rollout to remaining metadata entities (in progress)
Apply the ADR-5 pattern that worked for `Application` to:

- **C1 — Schema entities**: `CollectionDefinition`, `PropertyDefinition`
  - New `*_revisions` tables; `status` + `current_revision_id` columns
  - Service updates: every edit creates a new draft revision; explicit
    publish endpoint flips revision + parent to `published`
  - Backfill: every existing row gets revision 1 (published) so
    runtime resolution works out of the box
  - `applicationId` foreign key on `PropertyDefinition` (transitive
    scoping is too brittle for cross-app reference checks)
- **C2 — Form entity completion**: `FormDefinition` gets `status`,
  `current_version_id`, `applicationId`. The existing `FormVersion`
  table is upgraded with `status`, `published_by`, `published_at`.
- **C3 — Workflow / Automation entities**:
  `ProcessFlowDefinition`, `AutomationRule` get the full revision
  pattern. Active flow instances pin the revision they started with
  (already supported by the engine).
- **C4 — `applicationId` fan-out** to remaining entities:
  `ViewDefinition`, `WidgetCatalog`, `NavigationModule` (and
  `WorkspaceDefinition` once it exists in Phase 5.0).

### 5.4 Slice D — `phase7-revolutionary.entity.ts` rename (small, mechanical)
- Rename file to `app-builder.entity.ts`
- Update imports across `apps/svc-ava`, `apps/web-client`,
  `libs/instance-db`
- Closes canon §1 violation; rides any phase that touches the file

---

## 6. Phase 1 — Schema + Collection-centric tabbed UI

**Goal:** A non-developer admin creates a Collection with mixed property
types (including computed and inherited) entirely through visual UI
inside a tabbed Table Builder; records validate correctly; encryption /
audit attrs land where requested.

**ADR-13 prerequisite (must precede UI work):** Phase 1 reorganizes
`apps/web-client/src/app/app-studio/` so each Collection has a single
page with **four tabs**: Data, Forms, Policies and Rules, Flows. Form
Builder, Display Rule Editor, and Process Flow Studio are implemented as
top-level components but exposed only through the Collection's tab. This
shapes all of Phase 1's component layout.

### 6.1 Visual Table Builder (Data tab)
Replaces the existing form-based `CollectionEditorPage.tsx`.

- `apps/web-client/src/app/app-studio/table-builder/TableBuilder.tsx` —
  shell with tab nav (Data | Forms | Policies and Rules | Flows)
- `table-builder/data/TableBuilderCanvas.tsx` — spreadsheet-like
  property grid, drag-to-reorder
- `data/PropertyRowEditor.tsx`, `data/PropertyTypeSelector.tsx`,
  `data/RelationshipConfigurator.tsx`, `data/SchemaPreview.tsx`,
  `data/InheritancePanel.tsx`
- `data/SpreadsheetView.tsx` — record-level inline editor
  (ADR-16: read-only by default, explicit edit gate)
- `data/hooks/useTableBuilder.ts`

### 6.2 Constraint runtime (validation rules executor)
- `apps/svc-metadata/src/app/validators/` — registry consuming
  `PropertyDefinition.validationRules`
- Built-in: `regex`, `min`, `max`, `length`, `email`, `url`, `uuid`,
  `customExpression`
- Custom expressions sandboxed via the same `script-sandbox.service.ts`
  (Wave 2). No parallel sandbox.
- Server-side enforcement on record create/update; client errors via
  existing `FieldRegistry`.

### 6.3 Behavioral attributes registry
- New `behavioralAttributes` JSONB on `PropertyDefinition` with a typed
  registry: `encrypt_at_rest`, `audit`, `mask_in_logs`,
  `mobile_visible`, `formula_cache_strategy`
- `encrypt_at_rest` routes through `libs/shared-types/encryption.service.ts`
  (Wave 3)
- `audit` adds the property to the existing audit-log subscriber's
  tracked-changes set
- `mask_in_logs` integrates with `notification.service.ts`
  `redactProviderError` patterns

### 6.4 Inheritance wiring (close `extendsCollectionId`)
- `collection.service.ts` resolves parent properties on read, merges
  into child
- `schema-diff.service.ts` cascades parent column changes to all child
  tables in one transaction
- Verification: add a property to a parent collection with 3 children
  → all 3 child tables receive the column atomically

### 6.5 Computed property executor (close formula / rollup / lookup)
- New `apps/svc-metadata/src/app/computed/`
- Executors:
  - `formula`: synchronous on save, sandbox-evaluated
  - `rollup`: async via outbox; debounce-by-`(parentId, rollupPropertyId)`
    inside transactional window before enqueuing
  - `lookup`: synchronous; honors RLS via
    `authz.buildRowLevelClause` (Wave 2)
  - `hierarchical`: maintains tree column on save; cycle detection
    via existing `executionChain` recursion guard

### 6.6 Permissions decomposition (paired with guard updates per ADR-12)
- New seed slugs in `1817999999999-seed-admin-role.ts`:
  - `metadata.collections.edit`
  - `metadata.properties.edit`
  - `metadata.forms.edit`
  - `metadata.policies.edit`
  - `metadata.choices.edit`
  - `metadata.flows.edit`
  - `metadata.collections.spreadsheet.write`
- `CollectionAccessGuard` extended to honor the new slugs
- `RolesGuard` paths in svc-metadata updated alongside

### 6.7 AVA integration (inline)
- "Add a field called Priority as a choice list" → AVA calls
  `POST /collections/:id/properties`
- "Upload this PDF and suggest columns" → AVA action over the existing
  Phase 7 chat surface (no new builder feature)
- Inline "Ask AVA" affordance in the property editor

### 6.8 Verification gate
- Self-service table build: 10 mixed properties (text, ref, choice,
  formula, rollup, hierarchical) entirely via Table Builder.
  Validation errors surface correctly.
- Inheritance: parent property → 3 child tables in one transaction.
- Formula recompute synchronous; rollup recompute via outbox within
  5s of triggering child change.
- **Performance gate:** rollup recompute on a parent with 1k children
  completes within 30s p95.
- Test gate: validator registry, inheritance DDL planner, computed
  executor specs, permission-decomposition guard tests.

---

## 7. Phase 2 — Form Builder + Display Rules

**Goal:** Drag-drop form designer that controls Record Form layout,
sections / tabs, and conditional visibility. Exposed only through the
Collection's Forms tab (ADR-13).

### 7.1 Form Builder UI
- `apps/web-client/src/app/app-studio/form-builder/FormBuilder.tsx`
- `form-builder/FormCanvas.tsx`, `SectionBlock.tsx` (1/2/3 columns),
  `FieldPalette.tsx`, `FormPreview.tsx`, `RelatedListPanel.tsx`
  (lazy-load on expand)
- `form-builder/AnnotationBlock.tsx` — label-only rows for visual
  grouping (synthetic `FormField` with `type: 'annotation'`)
- `form-builder/hooks/useFormBuilder.ts`

### 7.2 Form view multiplexing — UI / preview gap, not entity refactor
The existing `ViewScope` + priority resolution already supports per-role
form layouts. The gap is UI-side:
- Scope picker on save (system / instance / role / group / personal)
- "Preview as role X" mode in `FormPreview.tsx`
- Indicator on `FormLayoutPage.tsx` showing which scope this layout
  resolves for

(No new entity needed.)

### 7.3 Display Rules
- `DisplayRule` entity with revisions (per ADR-5):
  `{ applicationId, collectionId, condition, actions: DisplayAction[] }`
- `DisplayAction`: `{ propertyCode, action: 'show'|'hide'|'mandatory'|'readonly'|'setValue' }`
- Expression evaluation via the same `condition-evaluator.service.ts`
  in `svc-automation` (no parallel implementation)
- Server returns resolved policies with form layout; client
  re-evaluates on field change

### 7.4 "Edit Form" deep link from record overflow menu
- Record overflow menu shows "Configure → Form Layout" only when the
  caller has `metadata.forms.edit`. Permission-gated entry point per
  the architect-review pushback.

### 7.5 AVA integration (inline)
- "Make Priority mandatory when State is Open" → AVA writes a Display
  Rule

### 7.6 Verification gate
- Display Rule on form load + on field change: "if `priority=urgent`,
  require `justification` and show `escalation_contact`"
- Related list: form for parent record renders inline lazy-loaded grid
- **Performance gate:** form render < 500ms p95 with 50 fields
- Test gate: Display Rule expression unit tests + Playwright form snapshot

---

## 8. Phase 3 — Process Flow Studio + Decision Tables + Guided Processes

### 8.1 Phase 3a — Process Flow Studio
**Goal:** React Flow-based canvas, action library, data pill picker,
test runner. Engine unchanged (ADR-2).

#### 8.1.1 Tech setup
- `@xyflow/react` (React Flow v12), `@monaco-editor/react`,
  `react-grid-layout` (used in Phase 5)

#### 8.1.2 Canvas
- `apps/web-client/src/app/app-studio/flow-studio/FlowStudio.tsx`
- `FlowCanvas.tsx` — React Flow DAG
- Node components under `nodes/`: `TriggerNode`, `ActionNode`,
  `ConditionNode`, `LoopNode`, `WaitNode`, `ApprovalNode`,
  `NotifyNode`, `SubflowNode`
- Migrate existing `ProcessFlowDesigner.tsx` (custom canvas) to
  React Flow shapes; preserve `ProcessFlowDefinition.canvas` shape
- Schema-first validator: canvas writes only valid
  `ProcessFlowDefinition` shapes (ProseMirror-style)

#### 8.1.3 Action Library
- `flow-studio/ActionLibrary.tsx` — searchable, categorized
- Built-in actions: `CreateRecord`, `UpdateRecord`, `DeleteRecord`,
  `LookUpRecord`, `SendNotification`, `CreateApproval`,
  `SetFieldValue`, `CallFlowModule`, `RunAVAPrompt`, `HTTPRequest`,
  `WaitForApproval`, `MakeDecision` (decision-table lookup)

#### 8.1.4 Data Pill Picker (shared component)
- `libs/ui-components/src/lib/DataPillPicker/`
- Hierarchical: Trigger record → Step outputs → Current user → System
- Used across Form Builder default-value editor, Flow Action panels,
  Automation Rule conditions
- Backed by the same `ExpressionContext` shape as
  `condition-evaluator.service.ts`

#### 8.1.5 Action input/output type contract (must precede 3b)
Every Flow Action declares typed inputs/outputs from a fixed taxonomy:
`boolean | choice | date | datetime | email | integer | reference |
string | uuid | json | array<T>`. Validated at canvas-save AND at
execution-time. Saves the action's `conversationalCompatible: boolean`
flag derived from whether all inputs/outputs are AI-callable.

#### 8.1.6 Lifecycle (ADR-5 already in place from Slice C3)
- Flows with status `draft` cannot activate
- A flow that references a draft subflow or draft action fails
  publish-validation
- Active running instances continue against the revision they were
  started with

#### 8.1.7 Guardrails
- Max actions per flow: default 50, configurable via
  `FLOW_MAX_NODES`. Admin warning at 40.
- Direct recursion prevention (already in engine)
- **Compiled-plan caching is a verification gate, not initial impl.**
  Add a load-test target; build the cache only when it fails.

#### 8.1.8 Test runner
- `flow-studio/FlowTestRunner.tsx` — sidebar input mock data → run →
  step-by-step execution log
- Runs as the test user with their permissions; cannot mutate
  production records (test-mode flag)

#### 8.1.9 Trigger sources
- Record Created / Updated / Deleted (existing)
- Scheduled (existing)
- Manual / API trigger
- AVA-initiated trigger
- **Metric Trigger** (new) — `svc-insights` metric threshold crossing
- **Service Catalog Trigger** (new) — record submitted via public
  form (interface ready for the deferred Service Catalog phase)
- **REST/webhook trigger** (new) — extends existing
  `libs/integrations/webhook.service.ts` subscriber pattern. Do NOT
  create a parallel registry.

#### 8.1.10 Connector framework starter set
- New `Connector` entity (registered HTTP/SMTP/etc. with credential
  vault integration)
- Three starter connectors:
  - **SMTP** (already in `svc-notify` SmtpEmailProvider)
  - **Generic HTTP** (already in `libs/integrations/http-client`)
  - **LDAP / Active Directory** (new — user provisioning)
- Additional connectors (Slack, Teams, Stripe, Twilio, Salesforce)
  deferred

### 8.2 Phase 3b — Decision Tables (four-entity model per ADR-14)
- `DecisionTable` — the spec: `{ id, applicationId, name, inputs[], answerCollectionCode? }`
- `DecisionInput` — input columns: `{ tableId, name, type, defaultValue? }`
- `DecisionRow` — a single row of conditions: `{ tableId, order, conditions: { inputId, operator, value }[], answerRowId | answerLiteral }`
- `Answer` — output rows from `answerCollectionCode` (configurable;
  any Collection)
- `POST /decision-tables/:id/evaluate` — typed evaluation; returns
  matched row + answer reference or literal
- Used by the `MakeDecision` Flow Action from 3a.3

### 8.3 Phase 3c — Guided Processes (Playbooks)
- `GuidedProcessDefinition` with revisions → stages → activities
- Each activity backed by a Process Flow OR a manual task
- Runtime experience inside Workspace's record page

---

## 9. Phase 4 — Automation Rules

**Goal:** Server-side business-rule equivalents that run on record events.
Hosted in the Collection's Policies and Rules tab (ADR-13).

### 9.1 Automation Rules
- Triggers: `before_query`, `before_insert`, `before_update`,
  `before_delete`, `after_insert`, `after_update`, `after_delete`
- `AutomationRule` entity in `svc-data` with revisions:
  `{ applicationId, collectionId, trigger, condition, actions, order, active }`
- `AutomationAction` is structured (never raw scripts):
  `SetField | CreateRecord | FireEvent | CallFlow | Abort`
- `AutomationRuleEngine` evaluates rules in the event pipeline per
  trigger phase
- Reviews and extends the existing 244-line `AutomationEditorPage.tsx`

### 9.2 Builder UI
- `apps/web-client/src/app/app-studio/automation/AutomationRuleBuilder.tsx`
- Reuses `ConditionBuilder` and `DataPillPicker` (shared)

### 9.3 UI Scripts — explicitly out of scope (Q1 resolved)
Imperative form-level JavaScript is **not** provided. Display Rules +
Automation Rules cover the declarative surface. A browser-side sandbox
is a perpetual XSS footgun; ~95% of use cases are expressible
declaratively. If a customer truly needs imperative form behavior, give
them an Automation Rule that fires on field change.

### 9.4 Verification gate
- Automation Rule sets `Status=Active` on insert; create record;
  field set
- Rule with a condition referencing a property the actor cannot read
  → action fails closed (per Wave 2 condition-evaluator authz)

---

## 10. Phase 5 — Workspaces (multi-page)

### 10.1 Phase 5.0 — `WorkspacePage` entity refactor (must precede UI work; ADR-15)
Before any Workspace Builder UI is written:

- `WorkspaceDefinition` — parent: `{ id, applicationId, name, theme?, defaultCollection? }`
- `WorkspacePage` — child: `{ id, workspaceId, code, kind: 'home'|'list'|'record'|'search'|'analytics'|'custom', layout: PanelLayout[], source }`
- New Workspace seeds five default pages (home / list / record / search /
  analytics) bound to a chosen Collection.
- Per-page-kind direct-edit policy:
  - `home` direct-editable on every install
  - `list`, `record`, `search`, `analytics` from `source = pack:*`
    require a variant override to modify (pack-vs-custom enforcement
    per ADR-7)
- §7 hierarchy: `WorkspaceVariant` (scope `system | instance | role |
  group | personal`) with priority resolution

### 10.2 Workspace Builder UI
- `apps/web-client/src/app/app-studio/workspace-builder/WorkspaceBuilder.tsx`
- `WorkspaceCanvas.tsx` — `react-grid-layout` per page
- `PanelPalette.tsx`
- Panels under `panels/`:
  - `RecordListPanel.tsx` — embeds existing `DataGrid.tsx` (which
    respects RLS; verified during Phase 5 build-out)
  - `RecordDetailPanel.tsx` — embeds `<WorkspaceRecordPageProvider>`
    (see 10.4)
  - `MetricsPanel.tsx`
  - `RelatedListPanel.tsx`
  - `QuickActionsPanel.tsx`
  - `ActivityFeedPanel.tsx`
  - `NLQueryPanel.tsx` (svc-ava chat surface)
  - `IndicatorScorecardPanel.tsx` (svc-insights — backend
    verification: indicator-list endpoint must exist)
  - `DashboardsOverviewPanel.tsx` (svc-insights — **backend
    verification required:** "list dashboards visible to user"
    endpoint may need to be authored)
- `apps/web-client/src/app/workspace/WorkspaceRenderer.tsx`

### 10.3 Widget contract enforcement
- JSON Schema on `WidgetCatalog.contract` (currently free-form JSONB
  at `view.entity.ts:166`)
- Validated at app-build time and at render
- `libs/widget-validator/` shared lib

### 10.4 Record-page context provider
The four side-panel members (`RelatedListPanel`, `ActivityFeedPanel`,
`QuickActionsPanel`, `RecordDetailPanel`) share the currently-viewed
record context. Implementation: a `<WorkspaceRecordPageProvider>`
React context scoped to the `record` page kind. Panels read via
`useWorkspaceRecord()` hook. URL-param-driven backing
(`/workspace/:wsCode/record/:collectionCode/:recordId`) so deep links
work.

### 10.5 Custom-component plugin model — deferred (security rationale)
Customer-authored React components are deferred. The deferral rests on
a different threat model than "more work":

- Vite module federation requires CSP `script-src` relaxation for the
  platform shell
- Signed component bundles need a separate signature flow from the
  pack-signing infrastructure (different key class)
- Dynamic JS execution in admin context bypasses the entire static
  CSP posture Wave 4 established

When the time comes, this becomes a separate ADR. Phase 5 ships only
canonical-catalog components.

### 10.6 `phase7-revolutionary.entity.ts` rename rides this phase
Mechanical canon §1 cleanup. Update imports across `apps/svc-ava`,
`apps/web-client`, `libs/instance-db`. Same PR.

### 10.7 Verification gate
- Role-scoped workspace: published `WorkspaceDefinition` with role
  variant restricts access; system scope falls through correctly
- Widget contract violation: invalid binding rejected at build time
  with actionable error
- Record-page context: four side panels share current record state;
  navigating to a different record updates all four
- DataGrid in Studio context: admin without `system.admin` running a
  Studio workspace sees the same row count as a regular user with
  their permission set
- **Performance gate:** workspace render < 500ms p95 with 5 panels

---

## 11. Phase 6 — Change Packages + Pack-vs-custom Provenance

**Goal:** Track all metadata changes for export / import; protect
customer modifications across pack upgrades.

### 11.1 Change Package tracking (Q3 resolved: hybrid)
- `ChangePackage` entity:
  `{ id, applicationId, name, status: 'open'|'complete'|'applied', changes: MetadataChange[] }`
- Developer explicitly adds artifacts to a package (predictable for V1)
- Auto-track candidates run in the background; reviewed before commit
  (best of both worlds)
- Export as JSON; import to another instance
- `apps/web-client/src/app/app-studio/change-packages/ChangePackageManager.tsx`
- `apps/web-client/src/app/app-studio/change-packages/ChangePackageDiff.tsx`

### 11.2 Pack-vs-custom record provenance (ADR-7)
- Every metadata record carries `source: 'pack:<id>' | 'custom'`
- Pack upgrade overwrites only `source = pack:*` rows; `custom` rows
  preserved
- The Wave 1 pack-signing infrastructure (manifest signature, install
  token) is the substrate; this phase surfaces provenance in the data
  layer
- Studio shell shows provenance badge per artifact

### 11.3 Verification gate
- Create an Application; make schema changes; export Change Package
  → import to test instance → schema migrated
- Install a pack; modify a customer-facing label on a pack-shipped
  Collection; upgrade pack; verify customer label preserved

---

## 12. Cross-cutting concerns

### 12.1 Shared UI components (`libs/ui-components/`)
- `DataPillPicker/` — hierarchical variable reference picker
- `ConditionBuilder/` — shared filter UI; calls into
  `condition-evaluator.service.ts` from svc-automation — same
  expression contract end to end
- `CodeEditor/` — Monaco wrapper (formula editor, JSON config; UI
  Scripts deferred)
- `ApplicationPicker/` — used by every builder when creating new
  artifacts

### 12.2 AVA integration is per-phase
Each builder embeds an "Ask AVA" affordance inline. AVA Phase 7 Build
Agent is the single backend; UIs adapt to builder context. Per canon
§2 ("exactly one obvious way"), there is no separate "AI builder
page" alongside the visual builders.

### 12.3 Lifecycle is a contract
Every entity introduced in any phase ships with the ADR-5 lifecycle
pattern. No "we'll add versioning later" exception.

### 12.4 Performance gates alongside correctness gates
- Phase 1: 1k-child rollup recompute under 30s p95
- Phase 3a: 1k flow executions/min sustained
- Phase 5: workspace render under 500ms p95 with 5 panels

---

## 13. Resolved open questions

| Q | Resolution |
|---|---|
| Q1 — UI Scripts (sandboxed JS) | **Defer / out of scope.** Display Rules + Automation Rules cover the declarative surface; browser-side sandbox is too risky for the value. |
| Q2 — Replace `svc-workflow` engine | **No, extend.** Wave 2 hardened it; runtime is solid. The visual editor is the gap. |
| Q3 — Change Package scope | **Explicit-add for V1, with background auto-track candidates** the developer reviews before commit. |
| Q4 — Service Catalog / Portal | **Defer.** Build core first. Once Phases 0–6 are solid, Service Catalog is a 2-3 sprint application built using only Studio surfaces. The Service Catalog Trigger is wired in Phase 3a so the integration point exists. |
| Q5 — React Flow vs G6 | **React Flow (`@xyflow/react`).** Industry standard, best DX, strongest TypeScript. |

---

## 14. Out of scope (explicit)

- Migrations from any predecessor system (canon §1)
- Multi-tenant runtime sharing (canon §5; one instance per customer is
  non-negotiable)
- ServiceNow GlideRecord / Glide* scripting compatibility — HubbleWave
  defines its own scripting surface
- UI Scripts / arbitrary client-side JavaScript (Q1)
- Service Catalog and Service Portal (Q4 — post-Phase 6)
- Localization / i18n (post-Phase 6)
- Compiled flow process plan caching (Phase 3a perf gate; defer build
  until needed)
- Auto-track-everything Change Package mode (Q3 — V2 enhancement)
- Spoke catalog beyond SMTP + HTTP + LDAP (Phase 3a starter set;
  further connectors are demand-driven)
- Custom-component plugin model (Phase 5 deferral; separate ADR when
  the threat model for arbitrary customer JS is designed)
- Domain Separation (canon §5: one instance per customer covers it)

---

## 15. Stack-ranked structural musts

1. **Phase 1: Collection-centric tabbed UI (ADR-13)** — drives the
   *order of work* in Phase 1; Form Builder must NOT ship as a
   standalone destination
2. **Phase 3a: typed action IO contract** — drives Phase 3b (Decision
   Tables four-entity model) prerequisite
3. **Phase 5.0: WorkspacePage entity refactor (ADR-15)** — drives the
   entire Phase 5 work breakdown; refactoring after the UI is
   exponentially more expensive
4. **Phase 0 Slice C: ADR-5 lifecycle on Collection / Property /
   ProcessFlow / AutomationRule** — every later phase assumes safe-edit
   semantics
5. **Phase 0 / Phase 1: permissions decomposition + guard updates
   (ADR-12)** — paired work, never just seed migration

---

## 15.1 Tracked tech debt (deferred — not blockers)

| Item | Origin | Why deferred | Trigger to address |
|---|---|---|---|
| **Bulk property save endpoint** | Phase 1 review (D2) | `useTableBuilder.saveAll` does N sequential HTTP round-trips (delete → create → update → reorder). At Phase 1 scale a Collection has ≤30 properties so latency is acceptable; the four reorder requests already use the bulk-style endpoint. Refactor to a single `PATCH /collections/:id/properties/bulk` accepting an array of `{op, id?, payload}` items, server-side transactional. | Phase 3 — Decision Tables and Process Flows will surface collections with >50 properties; serial save will become noticeable. Or earlier if telemetry shows save latency > 2s p95. |
| ~~**Visual editor surfaces for Decision Tables and Guided Processes**~~ | Phase 3 ship-decision | Resolved Phase 6.5 — `DecisionTableEditor` (route `/decision-tables/:id`) authors the table top-metadata + immutable inputs at create time, then per-row editing through a typed condition editor (one row per input, operator dropdown, value coercion by inputType) with a built-in test runner that calls `evaluate` against sample inputs. `GuidedProcessEditor` (route `/guided-processes/:id`) authors the full stages → activities tree client-side; new backend `PUT /collections/:cid/guided-processes/:id/structure` endpoint replaces children transactionally. Both panels (`DecisionTablesPanel`, `GuidedProcessesPanel`) wired to the new editors. | — Resolved Phase 6.5 |
| **`CallFlowModule`, `RunAVAPrompt` action handlers** | Phase 3 review-2 | Each requires a runtime backbone outside `svc-workflow`'s reach: CallFlowModule needs the sub-flow execution lifecycle with parent/child instance linkage; RunAVAPrompt needs the AVA prompt-execution channel. Dispatcher throws `NotImplementedException` with an explicit message (canon §1 — no half-finished pretense). | CallFlowModule: Phase 4 sub-flow lifecycle. RunAVAPrompt: Phase 5 AVA build-agent integration. |
| ~~**Step palette gap for SetFieldValue and WaitForApproval**~~ | Phase 3 review-3 (narrowed in Phase 3.5) | Resolved Phase 6.5 — both palette items added to `FlowStudio` STEP_TYPES (`SetFieldValue` under category `action`, `WaitForApproval` under category `approval`); per-action config panels (`SetFieldValueConfig`, `WaitForApprovalConfig`) added to `ProcessFlowEditorPage`. Runtime handlers in `svc-workflow/workflow-action.service.ts` already supported both — only the canvas-side palette and config UI was missing. | — Resolved Phase 6.5 |
| **`HTTPRequest` credential resolution** | Phase 3 review-2 | Connector lookup + axios call is implemented and live; connectors with `credentialRef === null` execute. Authenticated connectors (vault-resolved bearer / basic auth) throw — the `ConnectorCredentialsService` lives in `svc-data` and a cross-service credential client isn't wired into `svc-workflow` yet. | When the platform-vault client is extracted into a shared lib usable from any service. Currently consumers can stand up unauthenticated HTTP integrations end-to-end. |

---

## 16. Slice progress

| Slice | Phase | Status | Commit |
|---|---|---|---|
| A | 0 | ✅ Shipped | `3a52e03` |
| B | 0 | ✅ Shipped | (after rebase) |
| C1 | 0 | ✅ Shipped | `0854cc7` |
| C2 | 0 | ✅ Shipped | `c04b35d` |
| C3 | 0 | ✅ Shipped | `5e0ea21` |
| C4 | 0 | ✅ Shipped | (in same commit) |
| D | 0 | ✅ Shipped | (this commit) |
| Phase 1 Slice A — TableBuilder shell + canonical route | 1 | ✅ Shipped | (prior commit) |
| Phase 1 Slice B1 — visual property grid (canvas + meta panel + type selector + row + hook) | 1 | ✅ Shipped | (prior commit) |
| Phase 1 Slice B2 — InheritancePanel + inherited property rows | 1 | ✅ Shipped | (prior commit) |
| Phase 1 Slice B2-cascade — schema-diff DDL cascade for parent property changes (§6.4 backend) | 1 | ✅ Shipped | (this commit) |
| Phase 1 Slice B3 — RelationshipConfigurator (reference target picker + display property) | 1 | ✅ Shipped | (prior commit) |
| Phase 1 Slice B4 — SchemaPreview (DDL diff readout via existing /schema/plan) | 1 | ✅ Shipped | (prior commit) |
| Phase 1 Slice B5 — Spreadsheet record sub-tab + audit emission (ADR-16) | 1 | ✅ Shipped | (prior commit) |
| Phase 1 Slice B6a — ADR-17 publish-impact classifier + GET /collections/:id/publish-preview endpoint | 1 | ✅ Shipped | (prior commit) |
| Phase 1 Slice B6b — ImpactAnalyzer registry + View / Form analyzers | 1 | ✅ Shipped | (prior commit) |
| Phase 1 Slice B6b-cont — Process Flow / Automation Rule analyzers | 1 | ✅ Shipped | (prior commit) |
| Phase 1 Slice B6c — dependent_review_queue table + service + endpoints + publish hook | 1 | ✅ Shipped | (prior commit) |
| Phase 1 Slice B6d — PublishConfirmDialog frontend + canvas Publish button | 1 | ✅ Shipped | (this commit) |
| Phase 1 §6.2 — Constraint runtime (validators registry) — uuid validator added; rest pre-existing | 1 | ✅ Shipped | (this commit) |
| Phase 1 §6.3 — Behavioral attributes registry (column + types + accessor service) | 1 | ✅ Shipped | (this commit) |
| Phase 1 §6.5 — Computed property executor — formula/rollup/lookup pre-existing; HierarchicalService added | 1 | ✅ Shipped | (this commit) |
| Phase 1 §6.6 — Permissions decomposition (ADR-12 slugs seeded; CollectionAccessGuard accepts new slugs) | 1 | ✅ Shipped | (this commit) |
| Phase 1 §6.7 — AVA inline integration — covered by existing AvaSuggestionsModal + PropertyEditor auto-suggest | 1 | ✅ Shipped | (this commit) |
| Phase 1 review-fix pass — P0 module wiring + P1 property DTO shape + propertyApi list unwrap + queue authz + spreadsheet backend gate + soft-delete removal + loadAllPublishedByCode latest-revision + status column not JSONB + status dual-write removal + saveAll atomic + crypto.randomUUID + tab disabled guard + HierarchicalService record CRUD wiring + setAttributes draft revisions + classifier 34-case test suite + Workflow→Process Flows nomenclature | 1 | ✅ Shipped | (this commit) |
| Phase 1 review-fix pass 2 — CollectionAccessGuard route-aware expansion for spreadsheet-write slug + DependentReviewQueueController switched to PermissionsGuard (drop @Roles AND-trap) | 1 | ✅ Shipped | (this commit) |
| **Phase 1 — COMPLETE** | 1 | ✅ Shipped | — |
| Phase 2 §7.1 — Form Builder UI (existing FormLayoutDesigner already covers; no rebuild) | 2 | ✅ Shipped | (this commit) |
| Phase 2 §7.2 — Form scope picker (existing) + preview-as-role (deferred to view-variant rendering work) | 2 | ✅ Shipped | (this commit) |
| Phase 2 §7.3 — DisplayRule entity + service + controller + frontend editor + Policies sub-tab + shared condition evaluator | 2 | ✅ Shipped | (this commit) |
| Phase 2 §7.4 — Edit Form deep link (record overflow → /studio/c/:code/forms, gated on metadata.forms.edit) | 2 | ✅ Shipped | (this commit) |
| Phase 2 §7.5 — AVA "make X mandatory when Y" (deferred — requires AVA Build-Agent integration; tracked) | 2 | ⏳ Tracked | — |
| Phase 2 §7.6 — DisplayRule expression unit tests (40 tests, libs/shared-types) | 2 | ✅ Shipped | (this commit) |
| **Phase 2 — COMPLETE** | 2 | ✅ Shipped | — |
| Phase 3 §8.1 — Process Flow Studio (built-in Action catalog + dispatcher; ReactFlow migration deferred — see §15.1) | 3 | ✅ Shipped | (this commit) |
| Phase 3 §8.1 — `BUILT_IN_ACTIONS` catalog in `libs/shared-types` (CreateRecord, UpdateRecord, DeleteRecord, LookUpRecord, SetFieldValue, SendNotification, CreateApproval, WaitForApproval, CallFlowModule, HTTPRequest, RunAVAPrompt, MakeDecision) | 3 | ✅ Shipped | (this commit) |
| Phase 3 §8.2 — Decision Tables (entities + service + controller + collection-scoped frontend panel + evaluate engine; visual editor deferred — see §15.1) | 3 | ✅ Shipped | (this commit) |
| Phase 3 §8.3 — Guided Processes (entities + service + controller + collection-scoped frontend panel; runtime + visual editor land in Phase 5) | 3 | ✅ Shipped | (this commit) |
| Phase 3 review-fix pass 1 — workflow-action dispatcher accepts both legacy snake_case and canonical PascalCase action codes (and throws on unknown instead of silently ignoring); Decision row upsert/delete flips parent table back to draft when published; Guided Process publish validates flow/decision dependencies (existence + status); ProcessFlowsPanel mounted in FlowsTab as default sub-tab (replaces the prior misnamed `AutomationsListPage` mount, which now lives under "Automation Rules") | 3 | ✅ Shipped | (this commit) |
| Phase 3.1 — Decision Table evaluate test suite (9 tests) + Guided Process publish dependency-validation test suite (7 tests) | 3 | ✅ Shipped | (this commit) |
| Phase 3.2 review-fix pass — designer edge contract normalized to canonical `{ fromNode, toNode }` (load + save); workflow definitions controller switched to `PermissionsGuard` with `metadata.flows.edit` slug (delegated flow editors now functional, admin bypass intact); `activate()` rejects non-published revisions; `BUILT_IN_ACTIONS` dispatcher rewritten with `validateActionPayload` + handlers for CreateRecord / UpdateRecord / DeleteRecord / LookUpRecord / SetFieldValue / SendNotification (correct `recipientUserId` shape) / CreateApproval / WaitForApproval / HTTPRequest (Connector lookup); MakeDecision / CallFlowModule / RunAVAPrompt throw `NotImplementedException` with explicit deferred-runtime messages (see §15.1); `RecordMutationService.deleteRecord` added with audit + outbox; Process Flows panel now passes `?collectionId=` to the editor route so new flows bind to the active collection | 3 | ✅ Shipped | (this commit) |
| Phase 3.2 — `FlowStudio` component (xyflow/react migration); replaces `ProcessFlowDesigner` + retires the duplicate `WorkflowDesigner`; pan / zoom / minimap / smooth-step edge routing / drag-to-connect from typed handles ship for free; canvas state mirrors parent through controlled props so save semantics are unchanged | 3 | ✅ Shipped | (this commit) |
| Phase 3.3 review-fix pass — `/process-flows/*` editor routes gated by `metadata.flows.edit` (delegated editors no longer hit /unauthorized); `update()` and `deprecate()` clear `isActive` so the runtime stops matching draft / deprecated flows; editor config panels (`NotificationConfig`, `UpdateRecordConfig`, `CreateRecordConfig`, `ApprovalConfig`) write the canonical catalog shape (`recipientUserId` / `values` / `assigneeUserIds[]` / `subject`); decision evaluator extracted to `libs/shared-types/decision-evaluator.ts` and consumed by both `svc-metadata` and `svc-workflow`; `MakeDecision` action now executes against the published Decision Table and returns the matched answer | 3 | ✅ Shipped | (this commit) |
| Phase 3.4 review-fix pass — runtime boundary in `process-flow-engine.startProcessFlow` and `workflow-outbox-processor.handleWorkflowStart` gates by `code + isActive + status='published'` (previously `isActive` only — pre-existing rows / seeds / data corrections could still execute draft or deprecated flows); `normalizeCanvas` derives the action-node detection set from `BUILT_IN_ACTIONS` + legacy snake_case aliases so any catalog-typed node (e.g. `MakeDecision`, `HTTPRequest`, `DeleteRecord`) wraps into a `type:'action'` node with `{ actionType, actionConfig }` instead of falling through the engine's default-warn branch; `subflow` switch case wrapped in braces so `automation:lint` passes (no-case-declarations). | 3 | ✅ Shipped | (this commit) |
| Phase 3.5 review-fix pass — FlowStudio palette extended with the runnable catalog actions: MakeDecision (decision category), DeleteRecord + LookUpRecord (action category), HTTPRequest (integration category); per-step config panels added in `ProcessFlowEditorPage` (`MakeDecisionConfig`, `RecordReferenceConfig` shared by Delete/LookUp, `HttpRequestConfig`); dispatcher `LEGACY_CODE_MAP` extended with `make_decision → MakeDecision` and `lookup_record → LookUpRecord` so canvas-time + runtime alias sets agree. | 3 | ✅ Shipped | (this commit) |
| Phase 3.6 review-fix pass — engine `executeAction` now runs `interpolateObject(actionConfig, context)` before dispatch so `{{record.field}}` / `{{stepOutputs.x.y}}` bindings resolve into real values for every action (MakeDecision inputs, UpdateRecord values, HTTPRequest body, …) instead of arriving at the dispatcher as literal placeholder strings; `MakeDecisionConfig` and `HttpRequestConfig` editors parse JSON on every change so successful parses store an object — interpolation can recurse per leaf and preserve types (a numeric `{{record.amount}}` stays a number). | 3 | ✅ Shipped | (this commit) |
| Phase 3.7 review-fix pass — interpolation now routes arrays through a dedicated branch in a new `interpolateAny` helper instead of falling into the generic object recursion; arrays round-trip as arrays (no more `['x','y']` → `{0:'x',1:'y'}` corruption), so list-valued decision inputs, HTTP request bodies, and notification data preserve their shape end-to-end. | 3 | ✅ Shipped | (this commit) |
| **Phase 3 — COMPLETE** | 3 | ✅ Shipped | — |
| Phase 4 §9.1 — runtime gates: `getAutomationsForTrigger` requires `status='published'` AND `is_active=true` (mirrors Phase 3.4 ProcessFlow fix); `update()` clears `isActive=false` when flipping to draft; `deprecate()` clears `isActive=false`; `toggleAutomation` rejects activation of non-published rules with a named ConflictException. | 4 | ✅ Shipped | (this commit) |
| Phase 4 §9.1 — `BUILT_IN_AUTOMATION_ACTIONS` catalog in `libs/shared-types` exposing the canonical structured action set (SetField / CreateRecord / FireEvent / CallFlow / Abort) with `LEGACY_AUTOMATION_CODE_MAP` translating snake_case aliases (set_value, set_values, create_record, log_event, trigger_flow, abort) — same pattern as `BUILT_IN_ACTIONS` for flow actions. | 4 | ✅ Shipped | (this commit) |
| Phase 4 §9.1 — `AutomationController` switched to per-method `PermissionsGuard` + `@RequirePermission('metadata.flows.edit')` on the collection-scoped rule routes (list / get / create / update / delete / toggle / publish / deprecate / revisions / reorder). Cross-collection list, scheduled-jobs, AVA helpers keep their `@Roles('admin')` gate. Delegated flow editors can now manage rules without platform-admin role. | 4 | ✅ Shipped | (this commit) |
| Phase 4 §9.2 — `AutomationRuleBuilder.tsx` collection-scoped UI mounted as the FlowsTab "Automation Rules" sub-tab (replaces the prior global `AutomationsListPage` mount). List, publish, toggle, deprecate, delete, deep-link to the existing visual editor. | 4 | ✅ Shipped | (this commit) |
| Phase 4 §9.4 — verification gate: `svc-data` jest infrastructure + `ActionHandlerService` spec (5 tests covering SetField produces a modify_record change, onlyIfEmpty respect, Abort returns the operator-visible message, CreateRecord queues post-commit, unknown actions don't crash); `ConditionEvaluatorService` spec (5 tests covering equality / AND short-circuit / OR cross-match / empty default-allow / **fail-closed when the property is absent — proxy for an authz-redacted field**). 12 tests in `libs/shared-types/automation-action-contract.spec.ts` for catalog presence + alias resolution. | 4 | ✅ Shipped | (this commit) |
| Phase 4.1 review-fix pass — wired `executeAutomations` into `CollectionDataService.create/update/delete` (before-trigger mutates payload + raises 400 on Abort; after-trigger runs post-commit, errors logged not propagated); `svc-automation` runtime now requires `status='published'` (was `isActive` only); `svc-automation` action handler accepts canonical PascalCase codes (SetField/CreateRecord/FireEvent/CallFlow/Abort) via reverse-map onto the legacy snake_case branches and reads CreateRecord's `collectionCode` (was `collection`); new rules now save with `isActive=false` so publish + activate are both required before fire; `AutomationService.toAutomation` includes `status` + `publishedAt` so the panel badge and Activate button render correctly after reload; `AutomationRuleBuilder` navigates to `/studio/collections/:id/automations/{new,:automationId}` (was the unrouted `/admin/automations/...`); `AutomationEditorPage.isNew` now treats both `automationId === 'new'` AND missing `automationId` as new mode (the `/automations/new` route has no param); scheduled-job mutation routes gated by `metadata.flows.edit` (no-decorator inheritance from RolesGuard was permitting any authenticated user); 5 tests in `automation-executor.service.spec.ts` lock the wiring contract: SetField mutates, Abort halts the chain, multiple rules layer in execution order, watchProperties gate update fires. | 4 | ✅ Shipped | (this commit) |
| Phase 4.2 review-fix pass — `AutomationEditorPage` now writes the canonical `triggerTiming` ∈ {before,after,async} + `triggerOperations[]` schema (was the combined `before_insert` shape that matched neither runtime path) and reads back via `triggerOperations` first with legacy fallback; `before_query` automations now run inside `CollectionDataService.list` via `runBeforeQueryAutomations` (Abort throws 400, errors fail closed); `svc-data`'s sync `ActionHandlerService` mirrors svc-automation by translating canonical PascalCase codes (SetField/Abort/CreateRecord/…) onto the legacy branches via `LEGACY_AUTOMATION_CODE_MAP` + a reverse map, and `handleCreateRecord` accepts `collectionCode` alongside `collection`; `ActionBuilder` config schema for `create_record` writes the canonical `collectionCode` field (was the unread `collectionId`); `TriggerOperation` widened to include `'query'` in both RuleBuilder and TriggerBuilder; `CollectionDataService.create/update` re-validate post-automation data (property validation + uniqueness) when a SetField rule mutated the payload, so a rule cannot persist a value that violates the property contract; 3 new tests on canonical-code dispatch + `collectionCode` round-trip in `action-handler.service.spec.ts` (svc-data now ships 18 tests across 3 suites). | 4 | ✅ Shipped | (this commit) |
| Phase 4.3 review-fix pass — `FireEvent` (legacy `log_event`) now actually publishes: `ActionResult` gained a `fire_event` variant; `handleLogEvent` returns it; the runtime catches it and calls `OutboxPublisherService.publishEvent` under the `automation.event.${name}` namespace (was returning `type: 'none'`, so the rule appeared to run while emitting nothing); `CallFlow` accepts canonical `flowCode` alongside legacy `workflowId` at both validation and dispatch boundaries; `LEGACY_AUTOMATION_CODE_MAP` no longer aliases `set_values → SetField` (multi-property writes were being squashed onto the single-field handler) — `set_values` now passes through to its dedicated branch in both runtime dispatchers; spec asserts `set_values` is not catalog-resolvable. | 4 | ✅ Shipped | (this commit) |
| Phase 4.4 review-fix pass — svc-data's synchronous before-trigger path now drains `asyncQueue` post-commit: new `drainQueuedActions` helper forwards each queued action to its outbox event (CreateRecord recurses through `this.create` so the new record's own automations and validation run; FireEvent → `automation.event.${name}`; CallFlow → `automation.workflow.start`; SendNotification → `automation.notification.requested`). `runBeforeAutomations` now returns both `modifiedRecord` and `asyncQueue`. Drain runs in `create`, `update`, `delete` after the SQL commit and once at the start of `list` for `before_query` (no commit boundary, so drain immediately). svc-data's `handleLogEvent` now returns `queue_async` with the event payload (was `none`, which the executor ignored). 1 new test in `automation-executor.service.spec.ts` locks the contract: side-effect actions on before-trigger rules populate the asyncQueue with the right `executeAsync` / `executeAfterCommit` flags. | 4 | ✅ Shipped | (this commit) |
| Phase 4.5 review-fix pass — drained side effects use the contract each consumer expects: new `enqueueNotificationRequest` (root-level `templateCode`/`recipients`/`data` per `NotificationOutboxProcessor`) + `enqueueAutomationEvent` (free-form `automation.event.${name}` without a record-event wrapper or search.index companion); CallFlow now publishes via the existing `enqueueWorkflowStart` helper (`payload.workflow.workflowId` per `WorkflowOutboxProcessor`). Recursive `CreateRecord` chain depth is bounded: new private `createInternal` accepts a `parentAutomationContext`, threads it through `runBeforeAutomations` → executor, and bumps `depth` per recursion step; the executor's `MAX_DEPTH=5` now actually fires when a same-collection CreateRecord rule chains. `QueuedAction` carries the action handler's `result.output` so resolved `@record` / `@output` bindings reach the drain step (was discarded, leaving literal placeholder strings in published events); svc-data's `handleCreateRecord` and `handleSendNotification` resolve their config values into output via a new `resolveRecord` helper. 1 new test asserts FireEvent's `@record` bindings evaluate at queue time. svc-data now ships 20 tests. | 4 | ✅ Shipped | (this commit) |
| Phase 4.6 review-fix pass — CallFlow end-to-end works: `WorkflowOutboxProcessor.handleWorkflowStart` now resolves `workflow.workflowId` as either a UUID id OR a flow code (regex-detect, then `findOne` by the right field); the catalog's `flowCode` reaches a runnable Process Flow instead of being marked failed as not-found. svc-data's `trigger_flow` action gained a dedicated `handleTriggerFlow` mirroring the svc-automation pattern: resolves `inputs` via `resolveRecord` and emits `output: { workflowId, inputs }`, so before-trigger CallFlow bindings evaluate at queue time and `drainQueuedActions` publishes evaluated inputs to the outbox. 1 new test in `action-handler.service.spec.ts` locks the resolved-inputs contract; svc-data now ships 21 tests. | 4 | ✅ Shipped | (this commit) |
| Phase 4.7 review-fix pass — UI-authored CallFlow now reaches the dispatcher: `LEGACY_AUTOMATION_CODE_MAP` aliases `start_workflow → CallFlow` (the visual ActionBuilder persists the workflow action as `start_workflow`; both runtimes' canonical-to-legacy reverse maps then route to their own handler branch — `start_workflow` in svc-automation, `trigger_flow` in svc-data — without UI changes). ActionBuilder gained dedicated `'json'` and `'string-array'` field types: SendNotification.data, SendNotification.recipients, start_workflow.inputs, create_record.values now commit parsed values to `action.config` instead of raw strings (was `'{...}'` strings reaching the runtime as `{}` per object-type checks; recipients was a comma-string instead of `string[]`, failing `NotificationOutboxProcessor` validation). Defense-in-depth: svc-data's `resolveRecord` try-parses string inputs before the typeof check, so legacy rows with stringified configs still execute. | 4 | ✅ Shipped | (this commit) |
| Phase 4.8 review-fix pass — `drainQueuedActions` normalizes `queued.action.type` via `LEGACY_AUTOMATION_CODE_MAP` at the top of the loop, then branches on canonical codes only (`CreateRecord`/`FireEvent`/`CallFlow`/`SendNotification`). Queued actions whose original type was a legacy alias (`start_workflow`, `log_event`, `set_value`, …) now route to the right outbox helper without touching the drain when a new alias lands. Locks down the `start_workflow` queue path — UI-authored before-trigger CallFlow rules previously fell through the drain because the executor stored the raw `start_workflow` type and the dispatcher's match list only checked `trigger_flow`/`CallFlow`. | 4 | ✅ Shipped | (this commit) |
| Phase 4.9 review-fix pass — `SendNotification` added to `BUILT_IN_AUTOMATION_ACTIONS` (the catalog now mirrors what both runtimes have always supported); `LEGACY_AUTOMATION_CODE_MAP` aliases `send_notification → SendNotification` so the drain's canonical-only switch matches UI-authored Send Notification rules. Without this, Phase 4.8's refactor matched only the canonical name, leaving every snake_case-typed notification queue entry unhandled. | 4 | ✅ Shipped | (this commit) |
| **Phase 4 — COMPLETE** | 4 | ✅ Shipped | — |
| Phase 5.0 §10.1 — `WorkspaceDefinition` + `WorkspacePage` + `WorkspaceVariant` entities (ADR-15); ADR-5 lifecycle; per-page-kind direct-edit policy (`home` always editable, `list/record/search/analytics` from `pack:*` require a variant override per ADR-7); §7 scope hierarchy `system > instance > role > group > personal` with priority tie-breaking. | 5 | ✅ Shipped | (this commit) |
| Phase 5.0 — `WorkspaceService` + `WorkspaceController` + module wired into `svc-metadata`. Create seeds 5 default pages bound to a chosen Collection. Lifecycle methods (publish, deprecate, toggle) mirror Phase 3 patterns. Publish validates every page's layout against `validatePageLayout` before flipping status. Per-method `PermissionsGuard` with `metadata.workspaces.edit` slug. Variant resolution (`resolvePageLayout`) returns the highest-specificity match per Plan §7. | 5 | ✅ Shipped | (this commit) |
| Phase 5 §10.3 — `libs/shared-types/widget-contract.ts` houses `BUILT_IN_PANELS` (9 panels: RecordList / RecordDetail / Metrics / RelatedList / QuickActions / ActivityFeed / NLQuery / IndicatorScorecard / DashboardsOverview), per-panel typed input contracts, allowed-page-kind gate, and `validatePanelConfig` / `validatePageLayout` helpers used at canvas-save time AND by the runtime renderer. 9 unit tests cover catalog presence, page-kind enforcement, type mismatches, and layout-level validation. | 5 | ✅ Shipped | (this commit) |
| Phase 5 §10.4 — `WorkspaceRecordPageProvider` React context + `useWorkspaceRecord()` hook. Context reads URL params `/workspace/:wsCode/record/:collectionCode/:recordId`; explicit-prop overrides for the Studio preview case; null-safe so non-record pages render placeholders rather than crash. 3 web-client tests verify (a) four panel children share the same record state via the context, (b) non-record routes return null without error, (c) prop overrides win for in-builder preview. | 5 | ✅ Shipped | (this commit) |
| Phase 5 §10.2 — Workspace Builder UI: `WorkspaceBuilder.tsx` shell with a 3-pane layout (pages list / canvas / palette+inspector); `WorkspaceCanvas.tsx` driven by `react-grid-layout` (canonical `PanelLayout` x/y/w/h mirrors the library's grid-item shape); `PanelPalette.tsx` filters by the active page kind so authors can't place an invalid combination; `PanelConfigEditor.tsx` renders catalog-declared inputs as a typed form with JSON / array commit-on-change. Mounted at `/app-studio/workspaces/:workspaceId` gated by `metadata.workspaces.edit`. | 5 | ✅ Shipped | (this commit) |
| Phase 5 §10.2 — 9 panel components under `apps/web-client/src/app/workspace/panels/`: `RecordListPanel`, `RecordDetailPanel`, `MetricsPanel`, `RelatedListPanel`, `QuickActionsPanel`, `ActivityFeedPanel`, `NLQueryPanel`, `IndicatorScorecardPanel`, `DashboardsOverviewPanel`. `PANEL_REGISTRY` maps catalog code → component for both authoring and runtime. Side-panel members consume the workspace record context. Per-panel deep wiring (DataGrid fetcher, audit feed, AVA chat mount) is tracked per slice. | 5 | ✅ Shipped | (this commit) |
| Phase 5 §10.2 — `WorkspaceRenderer.tsx` runtime route: loads workspace by code, picks the page (the record route forces `record` kind), resolves variant layout via `/workspaces/:id/pages/:pageId/resolved-layout`, mounts panels via the registry. Read-only render gated by `isActive=true` AND `status='published'`. Routes: `/workspace/:wsCode` and `/workspace/:wsCode/record/:collectionCode/:recordId`. | 5 | ✅ Shipped | (this commit) |
| Phase 5 §10.7 — Verification gate: 7 svc-metadata tests for variant scope resolution + priority tie-breaking + direct-edit policy + widget-contract layout rejection; 9 shared-types tests for the widget catalog; 3 web-client tests for the record-page context. svc-metadata now ships 88 tests across 6 suites. | 5 | ✅ Shipped | (this commit) |
| Phase 5 §10.6 — `phase7-revolutionary.entity.ts` rename: no-op (file does not exist; only a historical migration filename and docs reference the term, both outside the scope of canon §1's "no versioned identifiers" rule for runtime entities). | 5 | ✅ Shipped | (this commit) |
| Phase 5.1 review-fix pass — instance migration `1835100000000-workspaces.ts` creates `workspace_definitions` / `workspace_pages` / `workspace_variants` (with FKs to `applications` + `collection_definitions`) and seeds the `metadata.workspaces.edit` permission slug + grants it to admin (idempotent); `WorkspaceService.upsertPage` / `deletePage` / `upsertVariant` now invalidate the published workspace (status→draft, isActive→false) so a published+active workspace stops serving stale layouts the moment a layout is edited; `list` / `get` now filter to `is_active=true AND status='published'` for non-editor callers (only callers with `metadata.workspaces.edit` or admin role see drafts/inactive); `WorkspaceBuilder` adds an Activate / Deactivate button (was missing — workspaces couldn't reach the runtime after publish); `WorkspaceCanvas` wraps `react-grid-layout` in `WidthProvider` so the canvas is responsive instead of pinned to 1000px; `WorkspaceRenderer` uses the same `react-grid-layout` (read-only via `isDraggable=false isResizable=false static=true`) so authored x/y/w/h coordinates render pixel-identically at runtime; `RecordListPanel` + `RelatedListPanel` embed the actual `DataGrid` via a new `useCollectionRecords` hook; new `GET /data/collections/:code/data/:id/audit-log` endpoint backs `ActivityFeedPanel`'s real audit-feed render. | 5 | ✅ Shipped | (this commit) |
| Phase 5.2 review-fix pass — `useCollectionRecords` URL paths corrected (axios baseURL is `/api/data`, so paths drop the leading `/data/`) and grid body matches `GridQueryRequest` shape (`collection`/`startRow`/`endRow`, was `tableName`/`page`/`pageSize` which the controller rejected); ActivityFeedPanel URL fixed the same way; `listVariants` and `resolvePageLayout` now thread editor scope through the parent-workspace gate so non-editor callers cannot read variant or resolved-layout JSON for draft / inactive workspaces by guessing IDs; `RecordDetailPanel` renders the bound record's fields read-only from `/collections/:code/data/:id` + schema-derived labels with a deep-link to the full record editor; `MetricsPanel.count` runs against `/grid/count` (sum/avg surface a "metric not yet wired" message until the aggregate slice ships); `QuickActionsPanel` buttons fire Process Flows by code via a new `processFlowsService.triggerByCode` helper or navigate to the record-form route per action kind; `NLQueryPanel` mounts the existing `AvaChat` component with workspace-scoped context (page = topicCode, recordId = bound record). | 5 | ✅ Shipped | (this commit) |
| Phase 5.3 review-fix pass — `RecordDetailPanel` resolves the form layout via `viewApi.resolve({ kind: 'form', collection })` and groups readable fields into the resolved tabs / sections (RLS-filtered schema endpoint already excludes unreadable fields); deep-link target fixed to the canonical `/:collectionCode/:recordId?edit=true&formCode=...` route. `QuickActionsPanel` form-kind navigation uses the same canonical route. New `POST /api/data/grid/aggregate` endpoint in `svc-data` (single SQL aggregate count / sum / avg / min / max with the same RLS pipeline as `/grid/count`); `MetricsPanel` now executes ALL five aggregations through this endpoint so the catalog and runtime match exactly. `IndicatorScorecardPanel` fetches each configured indicator via `/insights/metrics/:code/points?limit=1` and resolves names via `/insights/metrics`; per-indicator failures show inline without breaking the panel. `DashboardsOverviewPanel` calls the canonical `GET /insights/dashboards` (no separate `/visible` endpoint exists; the list endpoint already enforces visibility) and renders tile-links to each dashboard. | 5 | ✅ Shipped | (this commit) |
| Phase 5.4 review-fix pass — view-engine `resolveView` accepts a `code` filter so `viewApi.resolve({ kind, collection, code })` pins to a specific named view; `CollectionRecordPage` reads `?formCode=` and forwards it, and `RecordDetailPanel` forwards its panel-config `formCode`. Display rules now apply at the workspace panel: `RecordDetailPanel` calls `composeDisplay` against the resolved `displayRules` so hide / mandatory / readonly / setValue actions match the runtime record page (rule-hidden fields drop out of the panel; `setValue` overrides the rendered value; required/readonly badges surface). Vite dev proxy routed `/api/insights` to localhost:3007 (WORKFLOW_PORT); fixed to 3009 (INSIGHTS_PORT) — without this, every workspace analytics call hit svc-workflow in dev. svc-insights `getMetricPoints` accepts `direction=asc\|desc` (default asc); `IndicatorScorecardPanel` now requests `desc` + `limit=1` to read the LATEST point (was returning the oldest retained point). | 5 | ✅ Shipped | (this commit) |
| **Phase 5 — COMPLETE** | 5 | ✅ Shipped | — |
| Phase 6 §11.1 — `ChangePackage` entity (id / applicationId / code / name / description / status:'open'\|'complete'\|'applied' / changes: `MetadataChange[]` / completedAt / appliedAt / sourceInstanceId) added to `libs/instance-db`. `MetadataChange` discriminated by `kind` ∈ {collection, property, view, form, flow, automation, decision, guidedProcess, workspace} and carries `beforeHash` (FNV-1a over canonical-stringify of `after`) so importers can detect drift between author intent and target state. Idempotent migration `1835200000000-change-packages-and-provenance.ts` creates `change_packages`, seeds the `metadata.change-packages.edit` permission slug + admin grant. | 6 | ✅ Shipped | (this commit) |
| Phase 6 §11.2 — ADR-7 `source` column added to 8 metadata entities (CollectionDefinition, PropertyDefinition, AutomationRule, ProcessFlow, GuidedProcess, DecisionTable, ViewDefinition, FormDefinition); each defaults to `'custom'` and is indexed for the pack-vs-custom Studio queries. The same migration ALTERs each table with `idx_<table>_source`. `ProvenanceBadge.tsx` (web-client) renders pack-shipped rows orange (`Box` icon) and custom rows slate (`Wrench` icon) with the pack id surfaced in the tooltip; mounted in the Workspace Builder header next to the workspace name. | 6 | ✅ Shipped | (this commit) |
| Phase 6 §11.1 — `ChangePackageService` (svc-metadata) with create / list / get / addArtifact / removeArtifact / complete / exportJson / importPackage. `addArtifact` dispatches to per-kind repos (collection + view in V1; remaining kinds defer with `_captureDeferred:true` until per-kind capture lands), de-duplicates by (kind, code), refuses to mutate non-open packages. `complete` freezes the package and stamps `sourceInstanceId`. `importPackage` rejects a code already present and stamps `status='applied'` + `appliedAt` on a fresh row. `ChangePackageController` routes gated by `metadata.change-packages.edit` per ADR-12; module wired into `app.module.ts`. | 6 | ✅ Shipped | (this commit) |
| Phase 6 §11.1 — Studio surfaces: `ChangePackageManager.tsx` lists packages with status badges + create-package form + import-from-JSON textarea; `ChangePackageDiff.tsx` renders per-package detail with provenance badges per artifact row, add-artifact form, complete-and-freeze action, export-as-JSON download. Routes mounted at `/app-studio/change-packages` and `/app-studio/change-packages/:id` gated by `metadata.change-packages.edit`. Frontend client at `services/changePackages.ts` mirrors the backend contract. | 6 | ✅ Shipped | (this commit) |
| Phase 6 §11.3 — Verification gate: 7 `change-package.service.spec.ts` tests covering (1) collection-artifact capture stamps hashed snapshot + provenance source, (2) addArtifact rejects on a complete package (ConflictException), (3) duplicate (kind, code) replaces rather than appends, (4) exportJson round-trips code/name/changes/sourceInstanceId, (5) importPackage rejects an existing code, (6) importPackage stamps applied + appliedAt on a fresh code, (7) addArtifact for an unknown collection throws NotFoundException. svc-metadata now ships 95 tests (7 new) across 7 suites. | 6 | ✅ Shipped | (this commit) |
| Phase 6.1 review-fix pass — `importPackage` now actually applies artifacts: dispatches each `MetadataChange` to per-kind upsert handlers inside a single `dataSource.transaction`, persists the package row with `status='applied'` only after every change lands. Failure mid-import rolls all writes back so a package row is never marked applied without the target rows existing. Collection capture cascades child `PropertyDefinition` rows into `after.properties` (was dropping the schema). Workspace capture cascades child `WorkspacePage` rows. Every kind exposed in the UI selector now has real capture (no more `_captureDeferred:true` placeholders): code-keyed kinds (collection / view / flow / decision / guidedProcess / workspace) by `code`; collection-scoped named kinds (form, automation) and standalone properties by composite `<collection_code>.<name>` codes. Apply enforces ADR-7 source-of-truth: the change's `source` must match the target row's `source` if the row exists; mismatches throw `ConflictException` and the txn rolls back. Pack ingest in `metadata-ingest.service.ts` now stamps `source='pack:<packCode>'` on create (was defaulting to 'custom') and `assertPackOwnership` reads the canonical `source` column — refusing to overwrite either a `custom` row OR a row owned by a different pack (legacy `metadata.pack.code` is consulted only as a backwards-compat fallback). Migration `1835200000000` backfills `source` from legacy `metadata.pack.code` so pre-Phase-6 pack-installed rows aren't suddenly classified as custom. UI `ChangePackageDiff` shows per-kind composite-code hints next to the artifact-code input. 5 new tests bring svc-metadata to 100 tests across 7 suites: cascade-properties capture, transactional apply with appliedAt, rollback on apply failure, source-mismatch overwrite refusal, unknown-kind rejection, workspace-cascade-pages capture, composite-property capture. | 6 | ✅ Shipped | (this commit) |
| Phase 6.2 review-fix pass — cross-instance ID portability + deep cascade: capture-time replaces every source-instance UUID with a stable code (`applicationId`→`applicationCode`, `propertyTypeId`→`propertyTypeCode`, `referenceCollectionId`→`referenceCollectionCode`, `choiceListId`→`choiceListCode`, `collectionId`→`collectionCode` for top-level rows). Apply-time resolves codes against the target instance via new `resolveCodeRequired` / `resolveCodeOptional` helpers; an unresolvable required code (e.g. a target with no matching `propertyTypeCode`) throws `NotFoundException` and rolls back the import rather than persisting a row with a wrong/null FK. View capture now cascades `ViewDefinitionRevision` + `ViewVariant` (was definition-only — the runtime resolver returned no published layout for transported views); apply upserts revisions by `(definitionId, revision)` and variants by `(definitionId, scope, scopeKey, priority)` under the imported definition's target id. Decision capture cascades `DecisionInput` + `DecisionRow`; rows' `conditions[].inputId` is rewritten to a stable `inputPosition` so apply can re-resolve to the target's freshly-generated input ids (children are replaced wholesale via `inputRepo.delete` + insert). GuidedProcess capture cascades `GuidedProcessStage` + `GuidedProcessActivity`; apply replaces stages/activities under the target's process id. Pack ownership guard in `metadata-ingest.service.ts` rewritten as belt-and-suspenders: same-pack happy-path on `source` match; **legacy promotion** when source defaulted to 'custom' (e.g. unbackfilled row) but `metadata.pack.code` already identifies this pack as owner — `applyCollectionUpdate` / `applyPropertyUpdate` then rewrite `source` to canonical on save, so the next pass sees the right value. Without this, a pre-existing pack row whose backfill was skipped would now throw as customer-authored on the next pack release. 9 new tests bring svc-metadata to 109 tests across 7 suites: property-capture FK→code transform, property-apply code→FK resolution, property-apply NotFound on unknown propertyTypeCode, view-cascade revisions+variants capture and apply, decision inputId→position rewrite on capture and position→inputId rewrite on apply, guided-process stages+activities capture and apply with FK resolution. | 6 | ✅ Shipped | (this commit) |
| Phase 6.3 review-fix pass — closes the remaining cross-instance / ADR-7 gaps. (1) **Studio import target picker** — `ChangePackageManager.tsx` no longer trusts `payload.applicationId` (a source-instance UUID that fails the target FK). Loads `applicationsApi.list()` on mount; create form swapped raw-text Application input for a `<select>`; import flow shows a target-Application `<select>` plus a parsed-payload hint banner (source code, source `applicationCode`, artifact count, auto-select-by-code when a matching app exists on this instance). `exportJson` now includes `applicationCode` resolved from the package's `applicationId`, so the importer's auto-select-by-code path has a stable signal. (2) **Workspace page collectionId portability** — workspace capture now resolves each page's `collectionId` to `collectionCode` (a per-page list/record/search reference) and strips the source UUID; apply re-resolves `collectionCode` against the target via `resolveCodeOptional` and sets the target instance's `collectionId` (or null for kinds without a bound collection). (3) **View revision publishedBy strip** — view-revision apply adds `publishedBy` and `publishedAt` to the strip list, then restamps `publishedBy = importingUserId` and `publishedAt = NOW()` only when the snapshot's `status === 'published'`. Without this, a published view package fails on the target whenever the source-instance user UUID does not exist in `users`. (4) **Pack pipeline source stamping outside metadata-ingest** — `applyViewAsset` now receives `packCode`; `createViewDefinition` / `updateViewDefinition` stamp `source = pack:<packCode>` (was defaulting to `'custom'`); new `assertViewPackOwnership` refuses to overwrite `custom` rows or rows owned by a different pack. `applyAutomationAsset` and `applyWorkflowAsset` now stamp `source` on both create and update branches, with new `assertAutomationPackOwnership` (legacy `metadata.packCode` promotion path included) and `assertWorkflowPackOwnership` ownership guards. The shared `assertSourcedRowPackOwnership` helper centralizes the ADR-7 check. 3 new tests bring svc-metadata to 112 tests across 7 suites: workspace-page collectionCode capture+apply, view-revision publishedBy strip+restamp, exportJson includes applicationCode. | 6 | ✅ Shipped | (this commit) |
| Phase 6.4 review-fix pass — pre-Phase-6 view/workflow rows have `source='custom'` (the column default at migration time) but `pack_object_states` already records who owns them. Without consulting that signal, a same-pack release or rollback touching one of those legacy rows would now throw as customer-authored. The fix threads `legacyPackOwnership: existingState?.packCode ?? null` from the install loop and `legacyPackOwnership: state?.packCode ?? target.packCode` from the rollback loop into `applyViewAsset` / `applyAutomationAsset` / `applyWorkflowAsset`. The shared `assertSourcedRowPackOwnership` helper (and `assertAutomationPackOwnership`) gained a `legacyPackOwnership` parameter that promotes the row to same-pack when set; the existing save path already rewrites `source` to canonical, so the next pass sees the right value. The outer cross-pack guard (`existingState.packCode !== manifest.pack.code → ConflictException`) still fires before any apply runs, so the legacy promotion is only triggered when the installer has already verified same-pack ownership. | 6 | ✅ Shipped | (this commit) |
| Phase 6.5 deferred-debt closeout — three §15.1 items resolved. (1) **FlowStudio palette: SetFieldValue + WaitForApproval** — both added to `STEP_TYPES` in `FlowStudio.tsx` (action / approval categories). Per-action config panels `SetFieldValueConfig` and `WaitForApprovalConfig` added to `ProcessFlowEditorPage`; runtime handlers in `svc-workflow/workflow-action.service.ts` already covered both, so this is purely the canvas-side gap. (2) **Decision Table visual editor** — new `DecisionTableEditor` page mounted at `/decision-tables/:id`. Authors top-metadata, immutable inputs at create time (the four-entity model means rows reference inputs by id; reshuffling inputs would invalidate every row's conditions), per-row editing via a typed condition editor (one row per input, operator dropdown, value coercion via `coerceConditionValue`), and a built-in `Test` modal that calls `evaluate` against sample inputs. `DecisionTablesPanel` New table + Edit buttons enabled and wired to the new editor. (3) **Guided Process visual editor** — new `GuidedProcessEditor` page mounted at `/guided-processes/:id`. Authors the full stages → activities tree client-side; per-stage and per-activity reorder + add + delete + activity-kind switching (manual_task / flow / decision). New backend `PUT /collections/:cid/guided-processes/:id/structure` endpoint (`GuidedProcessService.replaceStructure`) replaces children transactionally — delete cascade on `processId` drops every stage + activity in one statement, then the new tree inserts in the same query runner; a mid-save error rolls everything back so the playbook is never half-replaced. The save flips the process back to `draft`, so the existing `Publish` lifecycle (with dependency validation against referenced flows / decision tables) gates re-promotion. `GuidedProcessesPanel` New process + Edit buttons enabled and wired. | 6 | ✅ Shipped | (this commit) |
| Phase 6.6 review-fix pass — three issues from the 6.5 closeout. (1) **WaitForApproval now parks instead of failing** — `process-flow-engine.service.ts.executeNode` catches `error.name === 'ApprovalPendingException'` (matched by name across the package boundary; `instanceof` doesn't work since the exception class lives in `apps/svc-workflow` and the engine in `libs/automation`), marks the step `waiting`, sets `instance.state='waiting_approval'` AND `instance.currentNodeId=nodeId` (the field `resumeProcessFlow` consults when an approval response arrives), emits `processFlow.waiting_approval`, and returns without rethrowing. Without this the catalog's pending-approval path bubbled out to the generic action-error catcher and burned the instance. (2) **CreateApproval now produces approvalId for WaitForApproval** — `CreateApproval` removed from `ENGINE_NODE_TYPES` in `workflow-definition.service.ts`, so it's now in `ACTION_NODE_TYPES` and `normalizeCanvas` wraps it as `type:'action'` with `actionType:'CreateApproval'`. The catalog handler `handleCreateApproval` runs through the dispatcher, returns `{ approvalId }` to `stepOutputs[nodeId]`, which downstream `WaitForApproval` binds to via `{{stepOutputs.<id>.approvalId}}`. The editor palette flips from `type:'create_approval'` (legacy snake_case) to `type:'CreateApproval'` (canonical) for new authoring; the config-panel selector accepts both forms so legacy flows still surface ApprovalConfig. The legacy `create_approval` route stays intact for back-compat (engine `approval` node, pause-self semantics). (3) **Decision Table draft test runner** — new `evaluateDraft` service method skips the published-status gate; new `POST /collections/:cid/decision-tables/:id/evaluate-draft` endpoint gated by `metadata.flows.edit` (no `collection.read` fallback so runtime callers can't bypass the published gate). `DecisionTableEditor`'s Test runner switched to `evaluateDraft` so authors can verify rows on the draft they're mid-editing. | 6 | ✅ Shipped | (this commit) |
| Phase 6.7 review-fix pass — closes the WaitForApproval resume gap from 6.6. The catalog `CreateApproval` stamps its own `nodeId` on the Approval row; on response the legacy resume path treats *that* as the from-node and rebuilds context with an empty `stepOutputs`, so the downstream WaitForApproval re-executes with `{{stepOutputs.<createApproval>.approvalId}}` resolving to `undefined` and fails its required-input check. Two cooperating fixes: **(1) Persist stepOutputs across the pause** — `executeNode` now writes `instance.context.stepOutputs[nodeId] = result` after every action completes via a new `persistStepOutputs` helper. `resumeProcessFlow` rebuilds context from `instance.context.stepOutputs` instead of `{}`, so cross-node bindings authored before the pause survive the resume. The persistence is JSONB-merge-then-save on the existing `process_flow_instances.context` column — no schema change. **(2) Resume from the parked node** — `handleApprovalResponse` now reads `instance.currentNodeId` (set in 6.6 when WaitForApproval threw `ApprovalPendingException`) and resumes from THAT node, not from the Approval row's `nodeId`. The legacy `approval` engine node is unaffected because `executeNode` writes `currentNodeId = nodeId` on every node entry, so a legacy approval pause records itself as `currentNodeId` and the same code path takes the right resume target. The handler also seeds `stepOutputs[parkedNodeId] = { decision, comment }` from the response (translating runtime's `{ approved, approver, comments }` into the catalog's WaitForApproval output shape), so post-WaitForApproval bindings see typed outputs without re-executing the wait. New optional `seedStepOutputs` parameter on `resumeProcessFlow` carries this through. | 6 | ✅ Shipped | (this commit) |
| Phase 6.8 spec-gap closure — twelve plan-spec gaps surfaced by the §13 audit, all addressed in one slice. **(1) Phase 1 §6.2 validators runtime registry** — new `ValidatorRegistry` (`apps/svc-data/src/app/validation/validator.registry.ts`) replaces the inline switch in `ValidationService.validateRule`; built-ins (regex / min / max / length / email / url / uuid / customExpression / required / phone / range / min_length / max_length) all register at constructor time, plus a `length` alias accepting `{min, max}`. 5 new tests in `validator.registry.spec.ts`. **(2) Phase 1 §6.5 computed property dispatcher** — new `ComputedPropertyDispatcher` (`apps/svc-data/src/app/computed/`) wires the existing `formula/`, `rollup/`, `lookup/`, `hierarchical/` services into `CollectionDataService.create` + `update` post-commit. Formula + lookup outputs write back via direct UPDATE on the changed columns; rollup enqueues a debounced `computed.rollup.recompute` outbox event keyed by `(parentId, rollupPropertyId)`; hierarchical reparent runs only when the parent reference changed. 6 new tests in `computed-property-dispatcher.service.spec.ts`. **(3) Phase 3 §8.1.1 Monaco** — `@monaco-editor/react` added to package.json; `CodeEditor` wrapper shipped in the new `libs/ui-components`. **(4) Phase 3 §8.1.3 ActionLibrary** — new `ActionLibrary.tsx` component (`apps/web-client/src/features/admin/components/`) replaces the inline `STEP_TYPES` palette in FlowStudio; reads `BUILT_IN_ACTIONS` from `libs/shared-types`; surfaces searchable + categorized list with AI-callable badges. **(5) Phase 3 §8.1.4 DataPillPicker wiring** — shared `DataPillButton` wrapper + `useDataPillCategories` hook; wired into ProcessFlow's `SetFieldValueConfig`, `AutomationConditionBuilder` value input, and `DisplayRuleEditor` setValue input — three builders authoring against the same Trigger / User / System taxonomy. **(6) Phase 3 §8.1.7 FLOW_MAX_NODES guardrail** — `assertNodeCountWithinLimit` enforces the 50-node default (configurable via env) on every create + update of a process flow; `warnNodeCountBand` exposes a 80%-threshold soft warning for the publish-preview surface. **(7) Phase 3 §8.1.8 FlowTestRunner** — new sidebar component `FlowTestRunner.tsx` + backend `POST /workflows/definitions/:id/test-run` endpoint (`WorkflowDefinitionService.testRun`). Walks the canvas in connection order, interpolates `{{path.to.value}}` bindings against caller-supplied mock input, returns a step-by-step trace. Dry-run mode (default) never reaches the engine — record-mutating actions are simulated. Test button mounted in `ProcessFlowEditorPage` toolbar. **(8) Phase 3 §8.1.9 trigger sources** — `TriggerType` enum extended with `ava_initiated`, `metric_threshold`, `service_catalog`, `webhook` (the existing 5 stay). New `WorkflowWebhookController` (`POST /workflows/webhook/:flowCode/trigger`) handles inbound REST triggers; flows declare a webhook secret on `triggerConditions.webhookSecret` and the controller fail-closes when the secret isn't set. Existing `AlertsService.queueWorkflow` already covers metric_threshold dispatch. **(9) Phase 2 §7.2 Form Builder Preview-as-role** — new `FormPreviewRolePicker` component; `view.controller.ts.resolve` accepts `?previewAsRole=<csv>` query param, gated by `metadata.forms.edit` or admin so preview can't be used to escalate privileges. **(10) Phase 2 §7.6 Display Rule expression tests** — verified the existing `condition-evaluator.spec.ts` in `libs/shared-types` already ships **40 passing tests** matching the plan's claim. **(11) §12.1 libs/ui-components** — new shared library at `libs/ui-components/` exposing `DataPillPicker`, `DataPillButton`, `useDataPillCategories`, `ConditionBuilder`, `CodeEditor` (Monaco wrapper), `ApplicationPicker`. tsconfig.base path `@hubblewave/ui-components` resolves to `libs/ui-components/src/index.ts`. **(12) §12.4 performance gate fixtures** — new `bench/` directory with `rollup-recompute.fixture.ts` (Phase 1: 1k children <30s p95), `flow-throughput.fixture.ts` (Phase 3a: 1k flows/min sustained), `workspace-render.fixture.ts` (Phase 5: <500ms p95 with 5 panels). `docs/performance-gates.md` documents the run / verification policy. svc-data: 32 tests (was 21); shared-types: 40 condition-evaluator tests confirmed; svc-metadata: 112 tests; all builds clean across svc-data / svc-workflow / svc-metadata / web-client. | All | ✅ Shipped | (this commit) |
| Phase 6.9 wire-up review-fix pass — five live-wire gaps found in the §6.8 closure. **(1) Data pill token syntax** — `useDataPillCategories` was emitting single-brace `{trigger.x}` tokens, but the flow engine matches `{{path}}` and the automation handler matches `@record.x` / `@currentUser.x`. Hook now accepts `runtime: 'flow' \| 'automation'` and emits the correct prefix per runtime; `AutomationConditionBuilder` switched to `runtime:'automation'`; FlowStudio `SetFieldValueConfig` keeps the default `'flow'` runtime. The Display Rule `setValue` pill button is REMOVED — `composeDisplay` stores `action.value` literally (no interpolation pass) so any pill there would have been saved as a literal `{{trigger.x}}` string. **(2) Rollup outbox processor** — new `ComputedOutboxProcessor` (`apps/svc-data/src/app/computed/`) polls `instance_event_outbox WHERE event_type LIKE 'computed.%'` via `FOR UPDATE SKIP LOCKED`, debounces by `payload.debounceKey`, calls `RollupService.calculateRollup`, and writes the result back to the parent's rollup column. Without this the events the dispatcher writes would sit at status='pending' forever — rollup recomputes never actually fired. 3 new tests in `computed-outbox-processor.service.spec.ts`. **(3) Webhook secret config UI** — `ProcessFlowEditorPage` settings modal renders a webhook section when `triggerType === 'webhook'` with a secret input + generate-button (256-bit random via `crypto.getRandomValues`). Writes to `triggerConditions.webhookSecret`, which `WorkflowWebhookController.trigger` validates against the `X-Webhook-Secret` header. Authors can now actually configure a runnable webhook flow; before this they could publish but the webhook controller fail-closed every call. **(4) previewAsRole wiring** — `viewApi.resolve` accepts `previewAsRole?: string[]` and serializes as `?previewAsRole=<csv>`. `CollectionRecordPage` reads the URL query param and forwards to `viewApi.resolve`. `FormPreviewRolePicker` mounted in `FormLayoutPage`'s designer toolbar with a deep-link "Preview record list →" button that opens `/<collectionCode>?previewAsRole=<csv>` in a new tab. The view-engine's server-side gate (`metadata.forms.edit` or admin) still applies — only authorized callers actually see the override take effect. **(5) Wet-run test runner** — `WorkflowDefinitionService.testRun` now branches on `dryRun`: dry-run keeps the prior canvas-walking trace; wet-run delegates to `engine.startProcessFlow` (same path manual triggers use), returning the new `instanceId` + `instanceState` alongside the trace. Wet-run refuses non-published / inactive flows with a typed warning. The engine was injected into the service constructor; `@hubblewave/automation`'s `AutomationModule` was already imported in `app.module.ts` so no module changes needed. svc-data: 35 tests (was 32 — 3 new for the outbox processor); all builds clean (svc-data, svc-workflow, web-client). | All | ✅ Shipped | (this commit) |
| Phase 6.10 runtime-correctness review-fix pass — four bugs the §6.9 wire-ups exposed. **(1) Parent rollups now enqueue on child save** — `ComputedPropertyDispatcher.applyOnSave` previously iterated only the SAVED collection's properties for rollup discovery, which never matches a correctly-modeled parent rollup (rollup property lives on the parent, not the child). New `enqueueParentRollupsForChildSave` queries `property_definitions WHERE config->>'sourceCollection' = $savedCollectionCode AND property_type = 'rollup'` after the own-properties loop, derives the parent record id from the child's `relationProperty` value, and enqueues a debounced `computed.rollup.recompute` event keyed by `(parentId, rollupPropertyId)`. The early-return when own-properties have no computeds was removed so the parent-discovery pass always runs. 1 new test: `discovers parent-collection rollups on child save and enqueues a recompute against the parent record id`. **(2) Rollup processor is actually privileged** — `ComputedOutboxProcessor.dispatch` now passes `isAdmin: true, roles: ['admin']` to `RollupService.calculateRollup`. Without admin bypass, `AuthorizationService.canAccessTable` (the only gate the rollup path consults) treats the synthetic `'system'` role like a regular role and rollups compute as 0/null when no ACL grants read. Background derived-value recomputes are platform infrastructure, not user-visible queries — privileged context is the correct shape. **(3) Flow context carries `trigger`/`user`/`system` namespaces** — `ProcessFlowContext` extended with `trigger` (alias of `input` — the trigger record), `user` (`{id, email?, username?}` shape mirrored on the DataPillPicker contract), `system` (`{now, today, instanceCode}` captured at context-build so all bindings inside one execution see the same timestamp). `executeProcessFlow` and `resumeProcessFlow` both inject the namespaces via two new helpers `buildUserNamespace` / `buildSystemNamespace`. Without this the `{{trigger.x}}` / `{{user.x}}` / `{{system.now}}` pills DataPillPicker emits resolved to undefined at runtime — they only worked in the dry-run trace because the trace mock used a different scope. **(4) Automation pills use supported tokens** — automation runtime resolvers handle `@now` / `@today` / `@record.` / `@currentUser.` literally; there is no `@system.` namespace. `useDataPillCategories` for `runtime:'automation'` now emits `@now` / `@today` / `@instanceCode` (no `@system.` prefix). Three runtime-side resolvers gain `@instanceCode` support: `apps/svc-data/automation/action-handler` + `condition-evaluator`, and `apps/svc-automation/runtime/action-handler` + `condition-evaluator` — all read `process.env.INSTANCE_CODE`. Web-client also gained a `vite-env.d.ts` Vite/PWA type ref so the production build resolves the `virtual:pwa-register` module without a stub-import error. svc-data: 36 tests (was 35 — 1 new for parent-rollup discovery); all builds clean (svc-data, svc-workflow, svc-metadata, svc-automation, web-client). | All | ✅ Shipped | (this commit) |
| Phase 6.11 rollup-correctness review-fix pass — five rollup wiring bugs (four flagged, one user-followup). **(1) Rollups stale on parent move** — `enqueueParentRollupsForChildSave` only queued the post-save parent. On an UPDATE that changes `relationProperty`, the OLD parent kept the moved child's contribution. Method now accepts `priorChildRecord`, builds a Set of target parent ids, and enqueues a recompute for both old and new parents when they differ. **(2) Child deletes don't recompute parents** — `CollectionDataService.delete` and `bulkDelete` previously emitted `record.deleted` events but never called the dispatcher; parent count/sum/avg rollups stayed stale after child removal. New `ComputedPropertyDispatcher.applyOnDelete` is invoked after each delete commit, passing the just-deleted record so the parent-rollup discovery enqueues correctly. **(3) sourceCollection code → table name resolution** — `RollupService.calculateRollup` queries `public."<sourceCollection>"` directly, so when the dispatcher passed a Collection CODE (`order_lines`) the SQL hit the wrong table — custom collections live at `u_<code>`. The processor now resolves `config.sourceCollection` → `CollectionDefinition.tableName`, and resolves `config.relationProperty` / `config.aggregateProperty` → `PropertyDefinition.columnName` against the source collection's properties before calling `calculateRollup`. Without this, every rollup against a custom collection computed empty/failed silently. New test: `resolves sourceCollection code → tableName and relationProperty code → columnName before calling RollupService`. **(4) Dry-run scope mirrors runtime ProcessFlowContext** — test runner used a custom scope `{ trigger: { recordId, input }, input, record }` that omitted `user` / `system` / `userId` / `triggeredBy` / `variables` / `stepOutputs`. A picker-authored `{{user.id}}` / `{{system.now}}` resolved in dry-run differently than wet-run. `buildDryRunTrace` now constructs the same shape `executeProcessFlow` does — `system.now` captured from the platform clock, `system.instanceCode` from `INSTANCE_CODE` env, `trigger` aliased to `input`, full `user` namespace shape. **(5) Dry-run user identity flows through actor** — `buildDryRunTrace` previously hardcoded `userId: 'test-user'`. It now accepts the `WorkflowDefinitionActor` and seeds `userId` / `triggeredBy` / `user.id` from `actor?.id`, falling back to `'test-user'` only when no actor was supplied. A flow binding `{{user.id}}` resolves to the same value in dry-run and wet-run for the same caller. **Bonus** — fixed an unrelated pre-existing svc-metadata build break: `DecisionTableService.list` was returning `tables.map((t) => this.toDto(t))` (DTO) where the signature expected the entity, and `workflow-action.service.ts` constructed a `DecisionTableDto` missing five required fields (`id`, `code`, `name`, `collectionId`, `status`). svc-data: 37 tests (was 36 — 1 new for tableName resolution); svc-metadata: 112 tests; all 5 builds clean. | All | ✅ Shipped | (this commit) |
| Phase 6.12 App Studio fix sweep — five issue clusters surfaced by the user. **(1) Flow canvas action nodes rendered as "Start"** — `FlowStudio.tsx`'s `STEP_TYPES` registry covered some PascalCase catalog codes (`DeleteRecord`, `MakeDecision`, …) but missed `CreateRecord`, `UpdateRecord`, `SendNotification`, `CallFlowModule`, `RunAVAPrompt`. `findStepType(code)` silently fell back to `STEP_TYPES[0]` (Start) when ActionLibrary's `onAdd(action)` emitted a missed PascalCase code, so every newly-dropped action node visually rendered as Start. Registry now covers every `BUILT_IN_ACTIONS` entry plus the four synthetic control nodes (start / end / condition / wait) and the legacy snake_case codes (`create_record` / `update_record` / `send_email` / `send_notification`) for already-saved canvases — both shapes round-trip via `LEGACY_CODE_MAP` and `normalizeCanvas`. **(2) Missing platform permission seeds** — controllers reference `system.admin`, `collection.admin`, `collection.read|create|update|delete`, `property.read|create|update|delete`, `ava.admin`, `workflow.run-as-system`, `metadata.workspaces.edit`, `metadata.change-packages.edit` via `@RequirePermission(...)`, but only `1817999999999-seed-admin-role.ts` (plural `collections.*`) and `1834600000000-seed-app-studio-permissions.ts` (subset) seeded permissions — the singular and operation-agnostic slugs were never inserted. New idempotent migration `1835300000000-seed-platform-permissions.ts` adds the 14 missing slugs and grants them to admin (mirrors the App Studio seed pattern; ON CONFLICT DO NOTHING on permissions and role_permissions). Without this, every privileged admin route 403'd because the underlying permission row didn't exist. **(3) Invalid `bg-primary-subtle` Tailwind class** — used as a JSX className in 7 spots (PanelPalette, DashboardsOverviewPanel, ApiExplorerPage, NotificationCenterPage, WebhooksPage 4×, ApiExplorerPage twice). Tailwind has no `bg-primary-subtle` utility — the matching CSS variable is `--bg-primary-subtle`, accessed via the bracket syntax `bg-[var(--bg-primary-subtle)]`. All 7 sites switched to `bg-primary/10` (semantic 10%-opacity primary), which renders correctly under both light/dark themes via the existing `--primary` HSL token. CSS-var consumers (`bg-[var(--bg-primary-subtle)]` in Glass components, raw `var(--bg-primary-subtle)` inside `<style>` blocks) were valid and stayed. **(4) Status-pill + destructive-button class duplication** — the `border-emerald-200 bg-emerald-100 text-emerald-800` triplet was duplicated across 6 panels (ProcessFlowsPanel, GuidedProcessesPanel, DecisionTablesPanel, DisplayRulesPanel, AutomationRuleBuilder, ChangePackageManager), and the `rounded p-1 text-muted-foreground transition-colors hover:bg-rose-100 hover:text-rose-700` destructive-icon-button pattern was duplicated in 12+ files. New `apps/web-client/src/lib/styling.ts` exposes `STATUS_PILL_SUCCESS|PENDING|NEUTRAL|DANGER` + `STATUS_BANNER_SUCCESS|PENDING|DANGER` + `DESTRUCTIVE_ICON_BUTTON` constants. Migrated 7 high-value sites: ChangePackageManager, AutomationRuleBuilder, ProcessFlowsPanel, GuidedProcessesPanel, DecisionTablesPanel, DisplayRulesPanel, PublishConfirmDialog, ProvenanceBadge. **(5) Disabled-opacity drift** — App Studio buttons used `disabled:opacity-30` / `disabled:opacity-40` in 17 spots across 8 files. Standardized to `disabled:opacity-50` (matches WAI-ARIA contract used by shadcn + Glass). Lint clean (0 errors, 317 pre-existing warnings); web-client production build clean; web-client tests pass. | All | ✅ Shipped | (this commit) |
| **Phase 6 — COMPLETE** | 6 | ✅ Shipped | — |
