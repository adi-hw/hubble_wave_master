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
| Change Packages | ❌ Missing — Phase 6 | — |
| Pack-vs-custom record provenance | ❌ Missing — Phase 6 | — |
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

### ADR-14: Decision Tables use a four-entity model
`DecisionTable` (the spec), `DecisionInput` (input columns),
`DecisionRow` (a row of conditions and answer reference), and
`Answer` (an output row from a configurable answer Collection). The
compressed single-entity model breaks typed IO the moment an input is
a reference field or choice list. Required for Phase 3a's typed-action
contract.

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
| Phase 1 | 1 | ⏳ Queued | — |
| Phase 2 | 2 | ⏳ Queued | — |
| Phase 3a/b/c | 3 | ⏳ Queued | — |
| Phase 4 | 4 | ⏳ Queued | — |
| Phase 5.0 / 5.x | 5 | ⏳ Queued | — |
| Phase 6 | 6 | ⏳ Queued | — |
