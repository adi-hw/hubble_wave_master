# App Studio End-to-End Test Guide

> **Audience:** QA, founder, internal pilot users.
> **Scope:** Every functional surface inside App Studio (`/studio/*` routes), end-to-end. Each section opens with a short *what this is for* explanation before the steps so you can verify behaviour against intent, not just clickability.
> **Convention:** ✅ = expected pass. 🟥 = stop and file a bug. The numbered prefix is the route under test (e.g. **§3.2** = Data tab → Records sub-tab).

---

## §0. Prerequisites

App Studio sits on top of a chain of platform services, so several things must already be true before any test below will give meaningful results.

### What this section is for
- Confirms the database has been migrated to the latest schema and seeds.
- Confirms the test fixture (`inline_editing_test`) is present so a known-good Collection is available.
- Confirms the user account is in the `admin` role so permission-gated routes don't 403.

### 0.1 Run instance migrations

```bash
npm run migration:run:instance
```

✅ Output ends with `No migrations are pending` on a re-run, confirming idempotency.
🟥 If this errors, the rest of the guide is meaningless — fix the migration first.

### 0.2 Verify the test fixture seeded

Connect to the instance database and run:

```sql
SELECT COUNT(*) AS properties
FROM property_definitions p
JOIN collection_definitions c ON c.id = p.collection_id
WHERE c.code = 'inline_editing_test';

SELECT COUNT(*) AS records FROM inline_editing_test;
```

✅ `properties = 22` and `records = 100`.
🟥 If `properties = 0`, migration `1800000000001-create-inline-editing-test-table.ts` did not run; if `records = 0`, the seed loop failed.

### 0.3 Confirm admin role + permission seeds

```sql
SELECT code FROM permissions
WHERE code IN (
  'system.admin', 'collection.admin', 'collection.read', 'collection.create', 'collection.update', 'collection.delete',
  'property.read', 'property.create', 'property.update', 'property.delete',
  'ava.admin', 'workflow.run-as-system',
  'metadata.workspaces.edit', 'metadata.change-packages.edit',
  'metadata.collections.edit', 'metadata.properties.edit', 'metadata.forms.edit',
  'metadata.policies.edit', 'metadata.flows.edit', 'metadata.choices.edit',
  'metadata.collections.spreadsheet.write'
);
```

✅ All 21 rows present (means migrations `1817999999999`, `1834600000000`, and `1835300000000` ran).

### 0.4 Confirm test user

Log in as your admin user. Open DevTools → Application → Cookies (or LocalStorage, depending on auth shape) and confirm the access token's payload (jwt.io) includes `roles: ["admin"]`.

✅ Admin role bypasses every per-route permission gate; non-admins should be tested separately in §13.

---

## §1. App Studio Shell — `/studio/apps`

### What this is for
The Studio shell is the top-level entry point. It lists the **Applications** the platform knows about (an Application is a logical bundle of Collections + Workspaces — e.g. "EAM", "Facilities") and lets you drill into any Collection's TableBuilder.

### 1.1 Open App Studio
1. Navigate to `/studio/apps`.

✅ Page renders without console errors.
✅ At least one Application card is visible (seed data ships at least the platform/system app).
✅ The **Inline Editing Test** Collection is reachable either as a direct link, or via the Application card it belongs to.

### 1.2 Navigate to a Collection
1. Click into the Application that owns `inline_editing_test`.
2. Click the **Inline Editing Test** Collection.

✅ The URL becomes `/studio/c/inline_editing_test/data` (the Data tab is the default).
✅ The header shows the Collection name, the **monospace code** `inline_editing_test`, and a **status badge** (`draft` / `published` / `deprecated`).

### 1.3 Tab disable states
Across the top of the TableBuilder shell, four tabs are visible: **Data**, **Forms**, **Policies**, **Flows**.

1. Hover each tab.

✅ Disabled tabs show a tooltip explaining *why* (e.g. "Forms requires `metadata.forms.edit` permission" or "Workspaces apply only to extensible collections").
✅ Enabled tabs are clickable and don't show a denial reason.

---

## §2. Data Tab — Schema sub-tab — `/studio/c/:code/data?view=schema`

### What this is for
The Schema sub-tab is the **visual TableBuilder canvas**. It replaces the legacy form-based property editor with a spreadsheet-like grid: one row per property, inline edit of label/code/type/flags, drag-style reorder, status badges per row, and a save bar at the bottom. It is the canonical place to author *what a Collection looks like* before any data is entered.

Sub-areas:
- **Collection Meta Panel** (top): label, plural label, description, icon.
- **Inheritance Panel** (just below meta): if this Collection extends another, the parent's properties are surfaced here read-only.
- **Properties Grid** (main): editable rows.
- **Toolbar** (right): Preview Schema, Publish, Smart Detect, Add Property.
- **Save Bar** (bottom, visible when dirty): unsaved-count, Discard, Save Changes.

### 2.1 Property grid loads
1. Navigate to `/studio/c/inline_editing_test/data?view=schema`.

✅ The grid shows ~22 rows (the fixture's seeded properties: text_field, long_text_field, …, assigned_user_id).
✅ Each row shows: `#`, Label, Code (monospace), Type selector, Required checkbox, Unique checkbox, Status badge (empty for clean rows), Actions (move-up, move-down, gear, trash).
🟥 Empty grid = §0.2 didn't pass. Re-run migrations.

### 2.2 Inline edit a property label
1. Click the **Label** cell of `text_field` and change "Text" to "Sample Text".

✅ The row's status badge becomes **Edited** (amber).
✅ The Save bar at the bottom appears: "1 unsaved change · Discard · Save changes".
✅ Other rows remain `clean`.

### 2.3 Toggle Required / Unique
1. Tick the **Required** checkbox on a row that wasn't required.

✅ Row status becomes **Edited**, dirty count increments.

### 2.4 Reorder rows
1. Click the **▲** (move-up) action on the third row.

✅ The row jumps to position 2 and the position numbers re-flow.
✅ The reordered row(s) are marked **Edited** (because their `displayOrder` changed).

### 2.5 Add a new property
1. Click **Add property** in the toolbar.

✅ A new empty row appears at the bottom with status **New** (emerald).
✅ Code field is editable (codes are immutable on existing properties).
✅ Type selector is editable (types are also immutable post-create — only on `New` rows).

2. Fill in label `My Test`, code `my_test`, type `text`.

### 2.6 Smart Detect (AVA)
This invokes the AI-assisted property type detector — given a name, AVA suggests an appropriate type.

1. Click **Smart Detect** in the toolbar.
2. Enter a name like "email_address" and submit.

✅ Modal returns at least one suggestion (e.g. `email`).
✅ Clicking **Apply** adds a new property row pre-filled with that type.
🟥 If you get a 403, the user lacks AVA permissions; not a Studio bug.

### 2.7 Configure a reference target
References point to other Collections (FK). The relationship configurator picks the target collection and the display property.

1. Add a property with type `reference`.
2. Click the **Configure target** chip on the row (it'll be highlighted because the reference is incomplete).
3. Pick `users` as the target and `display_name` as the display property.

✅ The chip changes to **→ Users** (no longer warning-coloured).
✅ The Publish button at the top remains disabled if any other reference is incomplete (incomplete-reference count is shown in the save bar).

### 2.8 Delete a property
1. Click the **🗑** (trash) action on the new `my_test` row.

✅ Status becomes **Deleted** (rose, strikethrough).
✅ Dirty count includes the deletion.
✅ Click trash again — it does NOT delete from server immediately; commit happens on Save.

### 2.9 Discard
1. Click **Discard** in the save bar.

✅ Confirmation either inline or via the standard pattern.
✅ All edits revert; status badges clear; save bar disappears.

### 2.10 Save changes
1. Re-do an edit (e.g. label) and click **Save changes**.

✅ Save spinner shows.
✅ On success, save bar clears, toast confirms (if your toast system is wired), all rows return to `clean`.
✅ The change persists across refresh.

### 2.11 Schema Preview (DDL)
This is a read-only preview of the SQL statements `svc-metadata` would execute on the next deploy/publish — useful for confirming a draft change won't drop a column or rename it lossy.

1. Click **Preview schema**.

✅ Modal opens with a SQL block: `ALTER TABLE …` for changed columns, `ADD COLUMN …` for new properties, `DROP COLUMN …` for soft-deleted ones.
✅ The preview reflects the *current draft*, not the published baseline.

### 2.12 Inheritance Panel
This appears only when the Collection extends another. (Skip if Inline Editing Test does not extend.)

1. If your Collection has `extendsCollectionId` set, the panel should show:

✅ Parent Collection name + property count.
✅ Inherited properties listed read-only above your own properties (greyed text).
✅ A clear visual divider between inherited and own properties.

### 2.13 Publish Confirm Dialog (ADR-17)
This is the impact-aware publish flow. It computes a diff between draft and published, classifies the change, and gates the Confirm button accordingly.

Classifications:
- **no_changes** — nothing to publish; one-click confirm.
- **cosmetic** — label/description only; one-click confirm.
- **structural** — column add or non-narrowing change; lists dependents that will be flagged needs-review.
- **breaking** — column drop, type narrow, required→non-null on populated table; **every** dependent must be acknowledged with a checkbox before confirm enables.

1. Make a cosmetic edit, save, then click **Publish**.

✅ Dialog opens with a green "Cosmetic changes only — safe to publish" banner.
✅ Confirm button is enabled.

2. Cancel. Add a brand new column, save, click **Publish**.

✅ Banner is amber: "Structural changes detected …".
✅ Dependents (forms, views, automations, flows referencing this Collection) are listed.

3. Cancel. Delete an existing property, save, click **Publish**.

✅ Banner is rose: "Breaking changes detected …".
✅ Each affected dependent has its own acknowledgement checkbox.
✅ Confirm button (renamed "Publish despite breaking changes") is **disabled** until all checkboxes are ticked.

4. Tick all and confirm.

✅ Collection's status badge in the header flips to **published**.

---

## §3. Data Tab — Records sub-tab — `/studio/c/:code/data?view=records`

### What this is for
The Records sub-tab is the **read-only-by-default spreadsheet** over the Collection's actual rows. Per ADR-16, entering edit mode is a privileged action that emits a dedicated audit-log row (not just downstream record mutations) — so you have a forensic trail of *who decided to bulk-edit at what time*.

### 3.1 Read-only view
1. Click the **Records** sub-tab.

✅ Header shows a **Read-only** pill with an eye icon and "100 records".
✅ Grid columns reflect the property definitions (id and deleted_at are hidden by design).
✅ Cell formatting handles types: dates render localized, booleans as Yes/No, JSON as inline `{...}`.
✅ Clicking a row navigates to `/inline_editing_test/<id>` (the canonical record page).

### 3.2 Search
1. Type a token from any visible cell into the **Search** input.

✅ Grid filters in real time across all visible columns.

### 3.3 Refresh
1. Click **Refresh**.

✅ Spinner runs briefly; data re-fetches from server.

### 3.4 Open list view
1. Click **Open list view**.

✅ Navigates to the canonical `/<collectionCode>.list` page in a new tab/replacement.

### 3.5 Enter edit mode (audit-logged)
This requires `metadata.collections.spreadsheet.write` (admin has it).

1. Click **Enter edit mode**.

✅ Brief loading spinner (the audit-log entry is being recorded server-side).
✅ Pill flips to amber **Edit mode** with a pen icon.
✅ Toolbar gains: **New record**, **Exit edit mode**.
✅ Each row gains row-action buttons (pencil, trash).

2. In your DB, query `audit_log` (or equivalent) for the most recent entry:

```sql
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5;
```

✅ A row exists for "spreadsheet edit-mode entry" with the user id and Collection id.

### 3.6 Delete a record (edit mode)
1. Click the trash icon on any row.

✅ Confirm modal opens with a danger-style "This will soft-delete the record" message.
2. Confirm.

✅ Row disappears; record count decrements.
✅ Refresh — record stays gone (soft-delete, not removable from grid even after refresh).

### 3.7 Exit edit mode
1. Click **Exit edit mode**.

✅ Pill returns to read-only.
✅ Row actions disappear; row click navigates again.

---

## §4. Forms Tab — `/studio/c/:code/forms`

### What this is for
The Forms tab governs **Record Form layouts** — the form a runtime user sees when creating or editing a record. Layouts are tabbed (e.g. "Details", "Settings"), have sections per tab, and rules per field (visible/required/readonly via Display Rules in the Policies tab).

### 4.1 List + select form
1. Click the **Forms** tab.

✅ One or more form layouts are listed (the "default" form is auto-derived if none authored).
2. Click a form.

### 4.2 Designer canvas
✅ Tabs appear at the top of the form preview.
✅ Sections within tabs collapse/expand.
✅ Fields can be dragged from the property palette onto sections.

### 4.3 Preview-as-role
This is the security-sensitive preview that shows what the form would look like for a *different* role — used to verify your Display Rules + ABAC field-level rules haven't accidentally hidden critical fields from delegated users.

1. Click **Preview as role**.
2. Pick a role (e.g. `viewer`).

✅ The preview re-resolves with that role's view (fields they can't see disappear).
✅ The deep-link button **Preview record list →** opens `/<collectionCode>?previewAsRole=<csv>` in a new tab.

The server-side gate (`metadata.forms.edit` or admin) means a malicious caller can't escalate via this query parameter.

### 4.4 Save layout
1. Move a field into a different section, click **Save**.

✅ Save persists; refresh confirms.
✅ Form's currentRevision flips to draft until the form is published.

---

## §5. Policies Tab — `/studio/c/:code/policies`

The Policies tab houses two builders:
- **Display Rules** (§5.1)
- **Automation Rules** (§5.2)

### What Display Rules are for
Display Rules are *client-side* form rules that fire on form load and on field change. They evaluate a condition against the in-memory record, then apply one or more actions: hide field, show field, mark required, mark readonly, set value. They are the right tool for **conditional forms** (e.g. "Hide Reason field unless Status = Cancelled").

### What Automation Rules are for
Automation Rules are *server-side* deterministic rules that fire synchronously on record events (create / update / delete). They mutate the record via five canonical actions: SetField, CreateRecord, FireEvent, CallFlow, Abort. They are the right tool for **invariants and side-effects** (e.g. "When Status changes to Closed, set ClosedAt = now and CreateRecord in audit").

Display Rules are *advisory* (run client-side, can be bypassed); Automation Rules are *enforced* (run server-side, can't be bypassed). Pick the right one.

### 5.1 Display Rules

#### 5.1.1 List
1. Open the Policies tab → **Display Rules** sub-section.

✅ Existing rules listed with: name, priority, action count, status pill, operations.
✅ Empty state copy is helpful: "Create your first rule to conditionally show, hide, or require fields…"

#### 5.1.2 Create a rule
1. Click **New rule**.

✅ Modal opens with: name, priority (numeric), description, condition builder, actions list.

2. Fill in:
   - Name: `Hide Reason unless Cancelled`
   - Priority: `10`
   - Condition (via ConditionBuilder): `status_field equals 'cancelled'`
   - Action: `hide` field `long_text_field` (when condition is FALSE — invert with the rule's "applies when" semantic).

✅ Save creates the rule with status **draft**.

#### 5.1.3 Publish
1. Click **Publish current revision** (upload icon).

✅ Status pill flips to **published** (emerald).
✅ The rule is now active on the form runtime.

#### 5.1.4 Edit a published rule
1. Click pencil → make a change → save.

✅ Status flips back to **draft**; runtime serves the last published revision until you re-publish.

#### 5.1.5 Delete a rule
1. Click trash → confirm.

✅ Soft-deletes (status → deprecated, isActive=false). Rule disappears from the runtime.

#### 5.1.6 Inactive row dim
1. Toggle a rule inactive.

✅ Row dims (60% opacity) so authors can scan published-vs-draft visually.

### 5.2 Automation Rules

#### 5.2.1 List
1. Open the **Automation Rules** sub-section.

✅ Existing automations listed with: name, timing (Before/After/Async), execution order, status, active toggle, operations.

#### 5.2.2 Create
1. Click **New rule**. (This navigates to the existing `AutomationEditorPage` at `/studio/collections/:id/automations/new`.)
2. Configure:
   - Name: `Stamp ClosedAt`
   - Trigger event: record_updated
   - Trigger timing: After
   - Trigger condition: `status_field changed to 'closed'`
   - Action: SetField → `datetime_field` ← `@now`
3. Save.

✅ Rule appears in the list with status `draft`, timing `After`, isActive `on`.

#### 5.2.3 Verify pill tokens
The DataPillPicker emits the *automation* runtime's token shape: `@record.<code>`, `@currentUser.<code>`, `@now`, `@today`, `@instanceCode`. (No `@system.` prefix in automation — that's flow-only.)

✅ Picker buttons in the value field show those exact tokens.

#### 5.2.4 Publish + Toggle
1. Click upload (Publish), then the Power icon (toggle active).

✅ Status pill `published`, Active toggle `on`.
2. Trigger an event that satisfies the condition (e.g. update a record's status to closed via the Records spreadsheet).

✅ The After-Update fires, and the record's `datetime_field` is stamped with the current timestamp.

#### 5.2.5 Delete
1. Click trash → confirm.

✅ Soft-deletes; row disappears from the active list.

---

## §6. Flows Tab — `/studio/c/:code/flows`

The Flows tab houses three lifecycle CRUD surfaces:
- **Process Flows** (§6.1)
- **Decision Tables** (§6.2)
- **Guided Processes** (§6.3)

### What Process Flows are for
Process Flows are visual workflows that compose **typed Action steps** from the platform's built-in catalog (CreateRecord, UpdateRecord, DeleteRecord, LookUpRecord, SetFieldValue, SendNotification, CreateApproval, WaitForApproval, MakeDecision, CallFlowModule, HTTPRequest, RunAVAPrompt). They are long-running, stateful, and human-aware — use them when the work crosses a wait boundary (an approval, a pause, an external system call).

### What Decision Tables are for
Decision Tables turn a tangle of nested if/elses into a typed truth table: declared inputs (string/integer/boolean/choice/reference/date), one row per case, and an answer per row. The runtime evaluates the table left-to-right and returns the matching row's answer — either a literal or a reference to a record. Decision Tables are the right tool for **routing logic** (assignment matrices, pricing tables, eligibility tables) where the rule list is large but flat.

### What Guided Processes are for
Guided Processes (Playbooks) are **multi-stage** runtime experiences: stages → activities. Each activity is a manual task, a Process Flow trigger, or a Decision Table evaluation. The runtime user sees a checklist on each record they're working; advancing an activity gates the next. They are the right tool for **structured human workflows** (incident triage, customer onboarding) where you want the platform to enforce a script.

### 6.1 Process Flows

#### 6.1.1 List
1. Open the Flows tab → **Process Flows** section.

✅ Existing flows listed with: name, code, trigger, runs count, status pill, operations.

#### 6.1.2 Create + open in designer
1. Click **New flow**. This navigates to `/process-flows/new?collectionId=…` — the FlowStudio canvas.

✅ Empty canvas with Action Library sidebar on the left and a centered "Start Building Your Process Flow" placeholder.

#### 6.1.3 ActionLibrary palette
The sidebar is sourced from the canonical `BUILT_IN_ACTIONS` catalog in `libs/shared-types/action-contract.ts` — categorized (control / record / decision / approval / notification / flow / integration / ai), searchable, with **AI** badges on actions whose entire input/output surface is typed primitives (no opaque JSON).

✅ Search filters by code/name/description.
✅ Categories collapse cleanly.
✅ AI-callable badges appear on the typed actions only (CreateApproval, WaitForApproval, HTTPRequest etc.; not CreateRecord which has a json `values` input).

#### 6.1.4 Add nodes
1. Click **Start** in the sidebar.

✅ A green **Start** node appears on the canvas.
2. Click **CreateRecord**.

✅ A blue **Create Record** node appears, NOT visually as "Start" (the §6.12 fix).
🟥 If the new node renders as "Start", the FlowStudio STEP_TYPES registry is missing the catalog code.

3. Add **MakeDecision**, **SendNotification**, **End**.

#### 6.1.5 Connect nodes
1. Drag from the bottom handle of Start to the top handle of CreateRecord.

✅ A smooth-step edge appears.
✅ Self-connections refused.
✅ Duplicate edges refused.

#### 6.1.6 Drag-position persistence
1. Drag a node to a new position.

✅ On drop, the canvas asks the parent to persist position changes.
✅ Refresh — node retains the new position.

#### 6.1.7 Configure a node
1. Click a node → side panel opens with the action's typed inputs.

✅ Each input matches the BUILT_IN_ACTIONS spec (types, required flags).
✅ DataPillPicker buttons render `{{trigger.x}}`, `{{user.x}}`, `{{system.now}}` tokens (flow runtime shape, double-brace).

#### 6.1.8 Trigger settings (Webhook)
1. Open the flow settings modal → set Trigger Type to **webhook**.

✅ A webhook section appears with **Secret** input + a "Generate" button.
✅ Generate produces a 256-bit random secret (~64 hex chars).
✅ Saving persists `triggerConditions.webhookSecret`.

(Optional) Test with curl:
```bash
curl -X POST http://localhost:3007/api/workflows/webhook/<flowCode>/trigger \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <secret>" \
  -d '{"hello":"world"}'
```

✅ 200 with new instance id.
✅ Without `X-Webhook-Secret`: 401/403 fail-closed.

#### 6.1.9 Flow Test Runner (dry-run)
1. Click **Test** in the toolbar.

✅ Sidebar opens with a JSON input box (mock trigger record).
✅ Submit → step-by-step trace renders, no actual record mutation.
✅ Each `{{path}}` binding is interpolated against the mock; missing values render as `<undefined>` not as a literal `{{...}}` string.
✅ The dry-run scope includes `trigger`, `input`, `record`, `user`, `system.now`, `system.today`, `system.instanceCode`, `userId`, `triggeredBy` — same shape as a wet-run.

#### 6.1.10 Flow Test Runner (wet-run)
1. Toggle Test Runner to **Wet run**.

✅ Refuses to run if flow is not published / inactive.
2. Publish the flow, retry.

✅ Returns `instanceId` + `instanceState` alongside the trace.
✅ The instance shows up in `process_flow_instances` table.

#### 6.1.11 Approval pause/resume flow
1. Build a flow: Start → CreateApproval → WaitForApproval → SendNotification → End.
   - WaitForApproval's `approvalId` input ← `{{stepOutputs.<createApprovalNodeId>.approvalId}}`.
2. Publish + trigger.

✅ Instance state is `waiting_approval`; stops at WaitForApproval.
3. Approve via the approval UI (or `POST /approvals/:id/respond`).

✅ Instance resumes from the parked node (not from CreateApproval), and the WaitForApproval outputs `decision: 'approved'` to its bindings.
✅ SendNotification fires with the resolved bindings.

#### 6.1.12 Lifecycle (publish, delete)
Back in the Flows tab Process Flows panel:
1. Click upload (Publish).

✅ Status `published`.
2. Click trash → confirm.

✅ Soft-deletes (isActive=false, status=deprecated). Row dims if "show inactive" filter is on.

### 6.2 Decision Tables

#### 6.2.1 Create
1. Click **New table**. Routes to `/decision-tables/new?collectionId=…`.

✅ Form requests: code, name, description, hit policy (first_match | all_matches), answer collection (optional), inputs.
2. Add inputs: `priority` (string), `value` (integer), `region` (string).
3. Submit.

✅ Table created; routes to `/decision-tables/:id`. Inputs are now **immutable** (the four-entity model means rows reference inputs by id; reshuffling inputs would invalidate every row's conditions).

#### 6.2.2 Add rows
1. Click **Add row**.

✅ Row editor opens with one condition slot per input + an answer field.
2. Configure:
   - `priority equals 'critical'` AND `value greater_than 5000` → answer `executive`.
3. Add a second row (lower priority) for `region equals 'EU'` → `eu_team`.

✅ Rows persist; status on the table flips to draft.

#### 6.2.3 Test runner (draft)
1. Click **Test**. Type test inputs `{ priority: 'critical', value: 6000, region: 'US' }`.

✅ Returns `matched: true, rowPosition: 0, answer: 'executive'`.
✅ Runs against the **draft** (uses `evaluateDraft` endpoint which skips the published gate so authors can iterate).

#### 6.2.4 Hit policy = all_matches
1. Switch hitPolicy to all_matches, save.
2. Test with inputs that match multiple rows.

✅ Returns `matches: [{...}, {...}]` array.

#### 6.2.5 Publish + runtime evaluation
1. Click **Publish**.
2. Trigger from a Process Flow's MakeDecision action.

✅ Runtime evaluation works; `evaluate` endpoint refuses unpublished tables (`evaluateDraft` is editor-only).

#### 6.2.6 Delete row / table
1. Click trash on a row → confirm.

✅ Row deleted; table flips back to draft.
2. Back in DecisionTablesPanel, click trash on the table → confirm.

✅ Soft-deleted; disappears from default list.

### 6.3 Guided Processes

#### 6.3.1 Create
1. Click **New process**. Routes to `/guided-processes/new?collectionId=…`.

✅ Empty editor with one stage and one activity.
2. Configure:
   - Stage 1 "Triage" → Activity 1 "Capture details" (manual_task).
   - Stage 2 "Assign" → Activity 2 "Run assignment flow" (flow, processFlowCode = your routing flow), Activity 3 "Eligibility" (decision, with the decision table code).

#### 6.3.2 Reorder + delete
1. Use the up/down arrows on stages and activities.

✅ Position is reflected in the rendered runtime later.
2. Delete a stage.

✅ Removed from the in-memory draft. Save commits the structure transactionally — partial saves never persist (delete-cascade then re-insert in one queryRunner; mid-save error rolls back).

#### 6.3.3 Save + publish
1. Save. Status flips to draft.
2. Publish.

✅ Publish dependency-validation runs; if it references an unpublished flow or decision table, the publish error tells you which.
3. Open a record of this Collection in the runtime.

✅ Workspace renders the playbook with stages → activities. Marking activities complete advances the runtime.

#### 6.3.4 Lifecycle
1. Click trash → confirm.

✅ Soft-deletes; runtime stops surfacing the playbook.

---

## §7. Workspace Builder — `/studio/workspaces/:code` (or panel from App overview)

### What this is for
A Workspace is a **dashboard-style page** composed of **panels** (record list, related list, dashboards overview, indicator scorecards, metrics, activity feed, record detail, quick actions, NL query, …). Workspaces are bound to a Collection or to an Application; each panel reads governed projections of data and renders a visualisation. They are the answer to "give me one screen for my role" without writing code.

### 7.1 Panel Palette
The left sidebar lists every panel in `BUILT_IN_PANELS`, grouped by allowed page kind (record / collection / app / system).

✅ Hover an unsupported panel — disabled with reason tooltip.
✅ Click a panel → it lands on the canvas.

### 7.2 Canvas (react-grid-layout)
✅ Panels resize via the bottom-right handle.
✅ Panels drag-reposition. Dropping snaps to grid.
✅ The canvas is responsive — resizing the browser pane reflows the layout (WidthProvider).

### 7.3 Save
1. Click **Save**.

✅ Persists x/y/w/h coordinates; published+active workspaces flip back to draft on save (so authors review before re-shipping).
✅ Refresh — layout matches what was saved.

### 7.4 Activate / Deactivate
1. Click **Activate**.

✅ Workspace's `isActive` flips true. Runtime callers (`list`, `get` for non-editor users) start seeing it.
2. Click **Deactivate**.

✅ Reverses; runtime stops surfacing.

### 7.5 Variants
Workspaces can have role/group-scoped variants (a per-role layout override).
1. Add a variant with scope=role, scopeKey=`technician`.

✅ Variant appears on the variant list; only callers with `metadata.workspaces.edit` or admin can read variant JSON via the API.

### 7.6 Runtime render parity
1. Open the runtime workspace at `/workspace/<code>` (or whatever your route is) as a non-editor.

✅ Layout renders pixel-identically to the editor (same react-grid-layout in read-only via `static=true`).
✅ Each panel calls its server endpoint and renders real data.

### 7.7 Per-panel smoke tests

| Panel | Quick check |
|---|---|
| **RecordListPanel** | Embeds DataGrid, paginates, renders RLS-filtered rows |
| **RelatedListPanel** | Ditto, scoped to the bound record's reverse-reference |
| **DashboardsOverviewPanel** | Tiles for each visible dashboard; no `bg-primary-subtle` invalid class |
| **MetricsPanel** | Calls `/api/data/grid/aggregate` for count/sum/avg/min/max — all five work |
| **IndicatorScorecardPanel** | Fetches latest point per indicator (`?direction=desc&limit=1`); per-indicator failures are inline |
| **ActivityFeedPanel** | Calls `/api/data/collections/:code/data/:id/audit-log`; renders chronological events |
| **RecordDetailPanel** | Resolves the form layout via `viewApi.resolve({ kind: 'form' })`; groups fields into the resolved tabs/sections; deep-link target is `/<code>/:id?edit=true&formCode=…` |
| **QuickActionsPanel** | Buttons fire flows by code or navigate to record-form route |
| **NLQueryPanel** | Mounts AvaChat with workspace-scoped context (page = topicCode, recordId) |

✅ Each panel renders without console errors against the inline_editing_test Collection.

---

## §8. Change Package Manager — `/studio/change-packages`

### What this is for
A Change Package bundles metadata changes (collections, properties, views, forms, flows, automations, decision tables, guided processes, workspaces) into a portable JSON document so you can author on a non-prod instance and apply the same diff to prod. Per ADR-7 every artifact carries a `source` (`custom` or `pack:<id>@<version>`) so importers refuse to overwrite a customer-authored row with a pack-shipped row, and refuse to overwrite a pack-owned row with a different pack.

Lifecycle:
- **open** — package is being authored; artifacts can be added/removed.
- **complete** — frozen (no more edits). Ready for export.
- **applied** — was imported into this instance; immutable forever.

### 8.1 List
1. Open the Change Package Manager.

✅ Existing packages render with status pills (open=amber, complete=emerald, applied=slate).
✅ Empty state copy: "No Change Packages yet …".

### 8.2 Create
1. Click **New package**.
2. Pick Application from the dropdown (NOT a free-text source-instance UUID).
3. Fill in code (e.g. `release-2026-q2`), display name, optional description.
4. Submit.

✅ Package created with status **open**; appears in the list.

### 8.3 Add an artifact
1. Open the package detail.
2. Click **Add artifact**.
3. Pick kind = `collection`, code = `inline_editing_test`.

✅ Artifact appears with provenance badge (custom or pack).
✅ Per-kind composite-code hint shows next to the input (collection-scoped kinds use `<collection_code>.<name>`).
✅ Underneath the snapshot, the captured payload includes child rows (e.g. for `collection`, the cascaded `properties[]`).

### 8.4 Capture-time portability
The capture step **strips source-instance UUIDs** and replaces them with stable codes:
- `applicationId` → `applicationCode`
- `propertyTypeId` → `propertyTypeCode`
- `referenceCollectionId` → `referenceCollectionCode`
- `choiceListId` → `choiceListCode`
- `collectionId` → `collectionCode` (top-level)

✅ Inspect the snapshot JSON in the UI / API — none of those id fields appear, only the code variants.

### 8.5 Complete (freeze)
1. Click **Complete and freeze**.

✅ Status flips to **complete** (emerald).
✅ `Add artifact`, `Remove artifact` are disabled.

### 8.6 Export
1. Click **Export JSON**.

✅ Downloads a JSON file.
✅ The file includes `applicationCode` (so the importer can auto-select-by-code on the target).

### 8.7 Import (round-trip)
1. Open a different Application or a different instance.
2. Click **Import**.
3. Pick a target Application from the **dropdown** (the importer never trusts `payload.applicationId` because it's a source-instance UUID).
4. Paste the JSON from §8.6.

✅ Hint banner appears: "source code: …, source applicationCode: …, artifact count: …".
✅ If a matching `applicationCode` exists on this instance, it auto-selects.
5. Submit.

✅ Apply runs in a single DB transaction; on success the row appears with status **applied**, `appliedAt` stamped.
✅ Each artifact's `<code>` was resolved against the target instance's codes; missing required codes (e.g. `propertyTypeCode='foo'` doesn't exist on target) → typed `NotFoundException`, txn rolls back, no half-imported package.

### 8.8 Source-of-truth refusal (ADR-7)
1. Try to import a package that contains a row with `source='custom'` against a target where the same code already exists with `source='pack:abc@1.0'`.

✅ ConflictException; txn rolls back.
2. Same for the reverse (pack-owned → custom).

### 8.9 Provenance badge surfaces everywhere
✅ Workspace Builder header shows the workspace's source pill (custom = slate, pack = amber).
✅ Per-artifact rows in ChangePackageDiff show their source.
✅ TableBuilder header surfaces the Collection's source.

---

## §9. Property Editor (Advanced) — modal launched from §2.x gear

### What this is for
The advanced editor is the home for **uncommon property options**: choice lists, validation rules (regex, min/max, custom expression), default values (static / expression / current_user / current_datetime), help text, placeholder, behavioral attributes (encrypt_at_rest, audit, mask_in_logs, mobile_visible, formula_cache_strategy).

### 9.1 Choice list
1. Edit a `choice` property → open advanced.
2. Add options: `{value: open, label: Open, color: #3b82f6}` etc.

✅ Save persists; the property's `config.options` is updated; the spreadsheet renders the option labels and colors.

### 9.2 Validation rules
1. Add a `regex` rule with pattern `^[A-Z][a-z]+$`.
2. Save and try to insert a record violating the rule.

✅ Server returns 422 with the rule's message.

### 9.3 Default value (expression)
1. Set defaultValueType = `expression`, value = `@now`.
2. Create a new record without specifying datetime_field.

✅ The new record's datetime_field is the server's `now()`.

### 9.4 Behavioral attributes
1. Toggle `audit: true` on a property.
2. Update a record changing that property's value.

✅ The audit-log subscriber's tracked-changes set captures the diff (verify via `audit_log` query).

---

## §10. AVA Suggestions Modal — Smart Detect

### What this is for
The Smart Detect modal asks AVA (the platform's AI reasoning layer) to infer a property type from a name and (optionally) sample values. It is the right tool for **bulk import flow** where you have a CSV header but no schema yet.

1. Open Smart Detect (§2.6).
2. Type "phone_mobile" — AVA should suggest `phone`.
3. Submit a list of 5 sample emails — AVA should suggest `email`.
4. Submit a mixed list — AVA returns a low-confidence suggestion with a warning banner.

✅ Each suggestion has a confidence score and explanation.
✅ Apply adds the property pre-filled with the suggested type + format options.

---

## §11. ProcessFlow trigger sources

### What this is for
A flow's **trigger** is what kicks off an instance. Beyond the Phase-3 default 5 (record_created, record_updated, property_changed, scheduled, manual), Phase 6.8 added 4 more:
- **ava_initiated** — fires when AVA decides to invoke a flow during a conversation.
- **metric_threshold** — fires when an Insights metric crosses a configured boundary (`AlertsService.queueWorkflow`).
- **service_catalog** — fires when a Service Catalog item is requested.
- **webhook** — fires from `POST /workflows/webhook/:flowCode/trigger` (§6.1.8).

Test each in the FlowStudio settings modal:

✅ Each trigger type renders its own config block (webhook gets the secret input, metric_threshold gets a metric picker, etc.).
✅ Saving persists; loading the flow re-renders the right block.

---

## §12. Lifecycle + Provenance matrix (cross-cutting)

Every authored artifact moves through ADR-5 lifecycle: **draft → published → deprecated**. Every artifact carries ADR-7 provenance: **custom** or **pack:<id>@<version>**. Verify the matrix:

| Surface | Artifact | Draft? | Publish flips green? | Deprecated soft-delete? | Provenance badge? |
|---|---|---|---|---|---|
| §2 | CollectionDefinition | ✅ | ✅ | ✅ | ✅ |
| §2 | PropertyDefinition | ✅ | ✅ | ✅ | ✅ |
| §4 | FormDefinition | ✅ | ✅ | ✅ | ✅ |
| §5.1 | DisplayRule | ✅ | ✅ | ✅ | ✅ |
| §5.2 | AutomationRule | ✅ | ✅ | ✅ | ✅ |
| §6.1 | ProcessFlowDefinition | ✅ | ✅ | ✅ | ✅ |
| §6.2 | DecisionTable | ✅ | ✅ | ✅ | ✅ |
| §6.3 | GuidedProcess | ✅ | ✅ | ✅ | ✅ |
| §7 | WorkspaceDefinition | ✅ | ✅ | ✅ | ✅ |
| §8 | ChangePackage | n/a — has its own open/complete/applied | n/a | n/a | n/a |

For each row, the test is:
1. Create artifact → status = **draft** (amber pill).
2. Publish → status = **published** (emerald pill).
3. Edit → status flips back to **draft**.
4. Delete → status = **deprecated**, isActive=false, dims in list.
5. Run a pack install — provenance pill flips to amber `Pack`. Author a custom variant → custom row appears alongside.

---

## §13. Permissions matrix (non-admin)

App Studio's per-feature permissions per ADR-12. Test each as a **non-admin** user holding only the listed slug:

| Permission slug | Surface | Expected |
|---|---|---|
| `metadata.collections.edit` | TableBuilder Data tab | Read+write on Collection meta |
| `metadata.properties.edit` | Schema sub-tab | Add/edit/delete properties |
| `metadata.collections.spreadsheet.write` | Records sub-tab | Enter edit mode (audit-logged) |
| `metadata.forms.edit` | Forms tab | Save form layouts; Preview-as-role |
| `metadata.policies.edit` | Policies tab | CRUD Display + Automation rules |
| `metadata.flows.edit` | Flows tab | CRUD flows / decision tables / guided processes |
| `metadata.choices.edit` | Property advanced (choice) | Edit choice list options |
| `metadata.workspaces.edit` | Workspace Builder | CRUD workspaces |
| `metadata.change-packages.edit` | §8 | Create/import/export packages |

For each:
1. Log in as a user with ONLY that slug.

✅ The targeted surface is editable.
🟥 No other surface should be editable (read may still work via `collection.read`).

Then test cross-feature combinations:
- `collection.read` alone → can browse records, can't enter edit mode.
- `collection.read` + `metadata.flows.edit` → can browse + author flows, can't author rules.

---

## §14. Negative / edge tests

### 14.1 Invalid Collection code
1. Visit `/studio/c/__not_a_real_code__/data`.

✅ "Collection not available" error card; back button works.

### 14.2 Unknown tab
1. Visit `/studio/c/inline_editing_test/banana`.

✅ "Unknown tab" error card listing supported tabs.

### 14.3 50-node FLOW_MAX_NODES
1. Author a flow with 51 action nodes.

✅ Save returns 400 with the limit message.
2. Author 41 nodes (80% of default 50).

✅ Save succeeds but the publish-preview surface shows the soft warning.

### 14.4 Duplicate property code
1. Add two rows with the same code.

✅ Save flags both rows; server-side returns ConflictException.

### 14.5 Reference cycle
1. Set `inline_editing_test.assigned_user_id` to reference itself.

✅ The reference configurator excludes the current Collection (`excludeCollectionIds={[collection.id]}`); circular ref impossible.

### 14.6 Concurrent edit
1. In two tabs: open the same Collection's Schema sub-tab.
2. Edit + save in tab 1.
3. Edit + save in tab 2 without refreshing.

✅ Tab 2's save either succeeds (if no conflicting fields) or returns a conflict error pointing to the changed field. (No silent overwrite.)

---

## §15. Browser smoke checklist

After running the above on Chrome, sweep through:
- **Firefox** — react-flow drag, react-grid-layout drag.
- **Safari** — date pickers, JSON cell rendering.
- **Edge** — same as Chrome (chromium parity).

For each:
- DevTools console has 0 errors during normal use.
- Network 4xx/5xx only when explicitly triggered (negative tests).
- No invalid Tailwind classes (search element `class` attributes — `bg-primary-subtle` is the canary; should be 0 occurrences in inspected DOM).

---

## §16. Accessibility checks

- All interactive elements have a tooltip or `aria-label`.
- Tab order through the property grid is logical (label → code → type → required → unique → actions).
- The save bar's "Save changes" button is reachable from the keyboard while the grid is focused.
- Status pills have sufficient colour contrast against their backgrounds (4.5:1 for text).
- The Records sub-tab edit-mode pill has an accessible label change ("Read-only" → "Edit mode").

---

## §17. Reporting bugs

When you hit a 🟥, file with:
- The §-section header.
- Exact URL.
- The user's permission set (admin or list of slugs).
- The Collection code under test.
- The relevant network request/response (DevTools → Network → save HAR).
- Screenshot of the failure state.
- Console errors verbatim.

---

**End of guide.**
