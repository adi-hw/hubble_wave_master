# HubbleWave Clinical + Facilities Asset Maintenance — Architecture + Implementation Spec

**Status:** Approved architecture spec; implementation-detail inline expansion in progress per §13.
**Branch:** `phase4/clinical-facilities-pack-design` (off master).
**Authored:** 2026-05-16 (brainstorm); approved 2026-05-17.
**Format:** Mega-spec inline — every substrate section + pack + marquee specified in this single document per user direction. §3.1 carries the full artifact-level detail as the template; §3.2-§3.18 expansions land in subsequent commits on this branch.

---

## 1. Context

A real RFP is in flight. The customer is currently evaluating **Nuvolo** (clinical/facilities CMMS on ServiceNow) and **ServiceNow's own Planned Maintenance + FSM** modules. HubbleWave must compete with both, hit every feature, and win on three specific pain points the customer has named:

1. **Nuvolo mobile is slow.** Field technicians abandon it. We must be visibly faster on a real device in a hospital setting (intermittent connectivity, dirty environment, gloves).
2. **ServiceNow's `task` polymorphic root has 20M+ rows.** List queries take minutes to load. The data-model decision that locked ServiceNow into that pain is the one we must not repeat.
3. **The customer loves ServiceNow's Workspaces + UI Builder.** Canon §27 already commits to feature parity; the pack must deliver the dog-food proof (every OOTB workspace built via UI Builder).

The HubbleWave platform's 2026-05-09 spec (Appendix D, lines 1558-1635) pre-inventoried Clinical/Facilities Asset Management as deferred pack work and asserted "the platform's customization surface is sufficient to deliver this entire inventory." This plan tests that assertion against full-vertical scope (CMMS + FSM + Parts + Compliance + Integrations + Predictive AI) and identifies the substrate additions the vertical legitimately presses on.

**Outcome we are designing for:** a substrate pack + three vertical overlays that ship together, win the RFP, and prove the canon §17.5 customization contract on a real domain — without violating greenfield discipline (canon §1), without bypassing upgrade safety (canon §13), and without re-implementing the architectural mistakes Nuvolo inherited from ServiceNow.

## 1.1 Implementation Priority (binding before this work starts)

This vertical is compliance-heavy and depends on identity + authorization invariants that the current Phase 3 W2 work hardens. **Before any of this plan's work begins, the existing platform must be sound:**

1. **W2 Stream 1 platform-blocker cleanup** must land first: the role-code vs role-id auth mismatch resolution, the migration / package coherence fixes, and the scanner baseline that ensures CI is green on all 8 architectural scanners. This vertical relies on §28 + §29 invariants that those streams establish.
2. **Pack capability contract** (§8 §17.5 amendment) must extend pack manifests + validators to support: `requires_capabilities`, `provides_capabilities`, `capability_bindings`, `task_projection.attrs[]`, `public_intake.schemas[]`, connector simulator declarations, reserved-namespace signing via Verified Pack Registry. Without these, every #23-35 marquee is implementable only by violating the customization contract.
3. **Metadata safety fields** must be added to `PropertyDefinition` BEFORE the surfaces that consume them: `projection_safe`, `confidentiality_class`, `break_glass_eligible`, `sync_to_mobile`, `taskable_field_mapping`, `vector_indexed`. Validator rules refuse pack publish if these are missing where required.

Phase 0 of §6 incorporates this prework explicitly; G0a cannot start until these three items are done.

---

## 2. Architectural Ruling (load-bearing decisions, founder-locked)

**Thesis.** *Platform supplies generic capability contracts and scalable read/runtime primitives; `maintenance-core` is the first HubbleWave-owned pack that composes them into CMMS/FSM, with Clinical and Facilities overlays proving specialization without schema inheritance or platform bypass.*

These four decisions set destiny for everything that follows. Each was an explicit choice between defensible alternatives.

1. **Composition over inheritance for tasks.** `MaintenanceWorkOrder` is its own domain table (`cust__hw_maintenance__work_order`) with its own indexes, partitions, lifecycle, archive policy. It does NOT inherit from a polymorphic root. The platform exposes a **`taskable` capability** that any collection opts into by exposing the required semantic fields (number, title, state, priority, assignment, due date, SLA, lifecycle, requester, timeline). A rebuildable **`task_projection`** read model powers global queues, search, and cross-collection workspaces — never the source of truth, never the surface a 20M-row list query hits.

2. **Substrate + two overlays.** One `maintenance-core` pack contains all vertical-agnostic content. `clinical-maintenance` and `facilities-maintenance` are thin overlays that add only vertical-specific entities, fields, workflows, role models, and integrations. Customers install Core + chosen overlay(s); both can coexist on one instance. GxP/regulated workflows are cross-cutting via a `regulated-action` platform capability, not Clinical-only.

3. **HubbleWave-owned packs follow the customer-pack contract.** Maintenance-core, clinical-maintenance, and facilities-maintenance live under the same upgrade-safety validator (spec §5.4), the same namespace rules (`cust__{pack}__{collection}`), the same plugin SDK stability promises (§25). No platform-pack admin bypass. We eat our own dog food on the customization moat that differentiates us from ServiceNow.

4. **AI dispatch + predictive maintenance live in maintenance-core, not in overlays.** Both verticals benefit from the same scoring and routing primitives. The vertical-specific tuning happens in pack-shipped data (sample assets, calibrated thresholds), not in code. Per canon §12, every AI feature ships in Suggest mode by default; customer admin opts in to higher trust levels per-feature.

---

## 3. Platform Substrate Additions (Phase 1a + 1b + 1c — 18 substrate sections, ~42 PRs)

Each addition is a platform capability that the maintenance verticals press on, structurally universal enough to live in the platform substrate (not in the pack). Each requires a canon amendment. **Without these, packs reinvent shared primitives (AVA semantic match, connector simulation, spatial graph, document provenance, financial controls, bulk import staging, NAC egress safety) and the §17.5 customization contract quietly turns into "custom platform code wearing a pack costume."**

Split across three gates per §5.3:
- **G0a (foundation)**: §3.1 taskable + §3.2 task_projection skeleton + §3.3 scheduling + §3.4 list-scale framework + §3.5 observations base + §3.6 regulated-action single-signature.
- **G0b (advanced)**: task_projection circuit-breaker + tombstones + reconciliation, regulated-action Merkle batch, §3.7 mobile parity, §3.8 AVA UI synthesis, §3.9 public intake hardened, §3.10 break-glass override, §3.11 external-collaborator sessions, observation rollup jobs.
- **G0c (shared substrate for marquees #23-35)**: §3.12 Storage/Evidence runtime + §3.13 Connector runtime + simulators + §3.14 Semantic Search/Vector Match + §3.15 Spatial+Graph + §3.16 Financial Control + §3.17 Bulk Import Staging + §3.18 Integration Secrets + Egress Policy. These are the shared substrates that prevent packs from inventing ad-hoc versions.

### 3.1 `taskable` capability (canon §30 NEW)
- **What:** Metadata-layer declaration on a `CollectionDefinition`. Collections that opt in expose a fixed semantic-field contract. NOT a base table.
- **New tables (schema `metadata`):** `taskable_capabilities` (~14 cols, FK to collection_definitions, JSONB field mapping, state-machine ref), `taskable_required_fields` (constraint denormalization).
- **Reused:** `StateMachineDefinition`, `SLADefinition` + `SLAInstance`, `ProcessFlowDefinition`, `Approval`, `ChoiceList`.
- **TypeORM placement:** new area file `libs/instance-db/src/lib/entities/capabilities.entity.ts`.

### 3.2 `task_projection` read model (canon §34 NEW)
- **What:** Denormalized, eventually consistent (sub-second under normal load) projection of every active taskable record across all opted-in collections. Powers global queues, search, mobile sync, workspaces.
- **New tables (schema `data`):** `task_projection` (~20 cols, **projection_safe columns only** — only fields whose `PropertyDefinition.projection_safe = true` AND whose `confidentiality_class` ∈ {`public`, `internal`} are eligible for the projection; pack authors declare projection_safety at publish; the validator refuses publish if a `taskable_capability` field-mapping references a property that is NOT projection_safe; runtime authz STILL post-filters every row through `AuthorizationService` — projection_safety is a STATIC publish-time gate, not the runtime gate. **`attrs_jsonb` is also schema-gated**: every projection JSON key must have a corresponding entry in the pack manifest's `task_projection.attrs[]` schema, each marked `projection_safe = true` with an allowed `confidentiality_class`; the projection writer rejects any attempt to write a key not in the schema (arbitrary attrs cannot smuggle sensitive data). PARTITION BY LIST `task_kind` then RANGE `opened_at` month; includes `deleted_at` for tombstones). `task_projection_archive` (cold partitions); `task_projection_lag` (per-collection cursor).
- **Refresh:** `apps/worker` (horizontally scaled — see §8 §19 amendment) runs `TaskProjectionConsumer` driven by `instance_event_outbox` rows via **Redis Consumer Groups (at-least-once delivery)**; the consumer achieves **effectively-once processing** through transactional idempotency: every outbox event carries a unique `event_id`; the **`processed_events` ledger insert AND the projection/domain mutation happen in the same DB transaction** (`INSERT ... ON CONFLICT (consumer_name, event_id) DO NOTHING` + projection UPSERT in one BEGIN/COMMIT); Redis XACK fires **only after DB commit** — crash between mutation and XACK results in a re-delivery that no-ops via the ledger. Projection writes are idempotent UPSERTs keyed on source-record-id + source-version; tombstones are retry-safe.
- **`processed_events` table policy.** Schema `automation` (or `data`); partitioned by RANGE on `received_at` (monthly). pg_partman auto-creates partitions. Retention: 90 days default (much longer than any reasonable redelivery window); older partitions detached and dropped by `processed_events_steward.job.ts`. Per consumer-name ledger keyed on `(consumer_name, event_id)`. Otherwise the table grows forever.
- Consumer handles `record.write` (upsert), `record.delete` (tombstone), `rule.invalidate` (bucket rebuild). Optimistic write-back-read for the actor's own session.
- **Circuit-breaker degradation (lag > 30s).** **List views do NOT fall back to source-table queries** under burst load — fallback would thunder-herd the source partitions and cascade-fail the instance. Instead: serve stale projection rows with a `"Syncing… results up to {last_projected_at}"` banner; refuse new pagination cursors past the staleness window. **Single-record fetches** can fallback to source (low cardinality, no herd risk). Threshold + behavior controlled per `task_kind` via `task_projection_lag.circuit_open_above_seconds`.
- **Authz contract (security, not optimization).** Every list read passes through `AuthorizationService` for record-visibility (§28.1) and field-masking (§28.5) — no exception. The projection row is a candidate, not an authorization. **Projection_safety is a static publish-time gate** that decides what columns are EVEN ELIGIBLE to live in the projection (PropertyDefinition.projection_safe + permitted confidentiality_class); runtime authz still post-filters every row. The cached `customer_acl_hash` bucket strategy is an OPTIMIZATION that pre-filters candidate rows by a precomputed principal-set signature, reducing the volume centralized authz must evaluate; it is never the gate. Stale projection rows (post-rule-edit, pre-rebuild) cannot grant access because the centralized post-filter is unconditional.
- **Bucket invalidation.** A `CollectionAccessRule` edit emits an outbox event consumed by `TaskProjectionConsumer`; the affected bucket-hash is recomputed and rows re-tagged. During rebuild, list views serve from the stale-but-correct projection (centralized authz post-filter still enforced); single-record reads can fall through to source.
- **Tombstones + reconciliation.** Source deletes emit a tombstone row (`deleted_at` set) — kept for the read-through window, then GC'd. A scheduled `task_projection_reconciler` worker job walks each `task_kind`/month partition pair (source ↔ projection) on a slow cadence (default daily) and produces a per-row diff: missing-in-projection (reproject), orphan-in-projection (tombstone), stale-by-version (reproject). Reconciliation lag visible in the Maintenance Manager workspace.
- **Search:** Typesense feeds via the same `SearchSource` / `SearchIndexState` rail packs use today.

### 3.3 Scheduling primitives (canon §35 NEW)
- **What:** Recurrence, suppression windows, blackout calendars, shift calendars, utilization-triggered scheduling, idempotent record generation. **Generic** — the platform primitive knows nothing about PM, WO, or assets; the maintenance-core pack binds those semantics on top.
- **New tables (schema `automation`):** `recurrence_definitions`, `suppression_windows`, `blackout_calendars`, `shift_calendars`, `generation_runs` (generic idempotency ledger — `(id, source_collection_id, source_record_id, subject_collection_id, subject_record_id, fire_at, generated_collection_id, generated_record_id, idempotency_key text UNIQUE, run_kind varchar(64), created_at)`; the maintenance-core pack binds PM semantics on top — platform table holds no asset/PM/WO coupling, and the same ledger serves any future scheduled-generation domain).
- **RRULE library:** `libs/scheduling/` wraps a trusted RFC-5545 implementation (rrule.js).
- **Reused:** `BusinessHours`, `ScheduledJob`, `AutomationExecutionLog`, `RuntimeAnomaly`.

### 3.4 List-scale primitives (folded into §34 amendment)
- **What:** Three mechanisms: materialized list snapshots for huge canned views, active/archive partitioning per `taskable_capability` (default `archive_age_months = 24`, never deleted), denormalized mobile list payload endpoint (`GET /mobile/tasks/sync`).
- **New tables (schema `data`):** `list_snapshots`, `list_snapshot_rows` (partitioned by `snapshot_id`).
- **Compliance answer for 7-year archive recall:** explicit `archive_query_facade.ts` opens cold partitions on regulator request; slow (minutes) but correct, and audit-logged.

### 3.5 Time-series observations (canon §31 NEW)
- **What:** Asset meter readings (IR, vibration, runtime hours, refrigerant pressures, BMS setpoints) stored in partitioned Postgres tables. Supports condition-based PM, predictive ML feature extraction, dashboards.
- **New tables (schema `observations` — new schema):** `observation_streams` (~14 cols, **generic subject binding** via `subject_collection_id` + `subject_record_id` + `stream_kind varchar(64)` — no domain FK to asset; the maintenance pack binds asset/meter semantics on top, the platform table works for any future observable domain), `observations` (RANGE-partitioned monthly via **pg_partman** auto-managed partitions, ~9 cols — subject reference lives on the stream, not on every reading; keeps the hot partitioned table narrow and avoids domain leakage into the platform), `observation_units` (seeded), **`observation_rollups_hourly` / `observation_rollups_daily` / `observation_rollups_weekly`** — explicit rollup tables (NOT materialized views, NOT pg_ivm — pg_ivm's README requires non-partitioned base tables and its immediate-maintenance mode degrades under high-volume writes); each rollup table maintained by a scheduled SQL upsert job in the worker (parameterized `INSERT ... ON CONFLICT (stream_id, bucket_start) DO UPDATE` with the SQL aggregation running in Postgres, not the Node worker — the worker only issues the statement and tracks lag). `observation_alerts` (optional, threshold-based; references `stream_id` only).
- **Decision (Day-1 — revised twice).** Adopt **pg_partman from Day 1** for automated partition creation/retention on `observations`. **Reject pg_ivm** for v1: per its own documentation, its base tables must be simple (non-partitioned) tables, and immediate-maintenance mode adds write-time overhead unsuitable for high-volume sensor ingest. Rollups land in explicit purpose-built tables refreshed by **scheduled SQL upsert jobs** running in Postgres (the worker issues the statement and observes lag; the aggregation math runs entirely in the database). **TimescaleDB remains a deferred escape valve** for >10B observations/instance, where its continuous-aggregate primitive becomes operationally compelling. Node-side rollup computation remains rejected outright.
- **Migration:** Replace the existing `SensorReading` in `app_builder` schema (greenfield, not extend — canon §1).

### 3.6 Regulated-action primitives (canon §32 NEW)
- **What:** E-signature, reason codes, immutable evidence artifacts, dedicated compliance hash-chain ledger separate from the platform audit chain.
- **New tables (schema `compliance` — new schema):** `electronic_signatures` (~13 cols, signer + re-auth method + payload hash); `reason_codes` (seeded per pack); `evidence_artifacts` (~15 cols: `id`, `collection_id`, `record_id`, `artifact_kind`, `storage_uri`, `s3_object_version_id` — immutable S3 object-lock version reference, `sha256` — content hash for tamper detection, `content_type`, `size_bytes`, `captured_at`, `captured_by`, `device_meta`, `audit_log_id`, **`retention_until timestamptz`** — object-lock retention boundary derived from regulatory class, **`legal_hold boolean default false`** — operational override that blocks expiration regardless of retention_until; together with hash + version_id these satisfy the Part 11 retention story, not just tamper detection); `signature_chains` (append-only, parallel to `audit_logs` chain, both linked via `audit_log_id`).
- **Re-auth methods:** leverages existing `MfaMethod`, `WebAuthnCredential`.
- **Linearization + Merkle batch root.** `signature_chains` ROOT inserts follow Plan Fix 41 — sequential single-row writes via `withAudit(...)`. Batching multiple actions under one signature is allowed via a **Merkle-tree batch root** with strict leaf shape: each leaf hash MUST be computed over the canonical tuple `(signer_user_id, signer_display_name_at_sign_time, signer_login_at_sign_time, signed_at_utc, action_code, target_collection_id, target_record_id, reason_code_id, signature_meaning, payload_hash)` — every Part 11 §11.50 metadata element AND a snapshot of the signer's identity at sign-time (display name + login may change later via §29.6 stamp bumps; the snapshot ensures the leaf can be replayed independently of subsequent user-record mutations). Compromise vs single-action linearization is acceptable because (a) the root signature chain-linearized, (b) every leaf cryptographically tied to the root, (c) UX cost of N sequential signs would lose the technician-experience win. `audit-bypass-check.ts` allows the Merkle-batch insert pattern with explicit code marker; raw batched `signature_chains` inserts without marker remain forbidden.
- **21 CFR Part 11 posture (hash chains are evidence mechanics, NOT compliance by themselves).** Part 11 compliance requires the platform deliver, beyond hash chains: (a) **validation evidence** — IQ/OQ/PQ-style change-control records mapping every signature-chain implementation change to its test, owned in `docs/validation/` with auditor-readable export; (b) **authority checks** — the signer's role + permission + active session must satisfy the action's required authority at sign-time (§28 evaluator + canon §29.6 stamp comparison enforced); (c) **operational checks** — sequence-dependent actions enforce predecessor completion (e.g., LOTO step-3 cannot sign before step-2 closed); (d) **audit retention** — 7-year minimum on `audit_logs` + `signature_chains` + `evidence_artifacts`; archive partitions never deleted (canon §34); (e) **record copying/export** — Compliance Officer can export any record's full signature-chain + audit-trail + evidence-artifact list as a single attestation file (PDF + JSON + S3 download manifest); (f) **signer identity binding** — Re-auth at sign-time via WebAuthn / TOTP / password-reverify per `signature_meaning`; weak meanings allow session-only, strong meanings require fresh credential; (g) **meaning of signature** — every signature carries a `signature_meaning varchar(64)` enum (`review`, `approval`, `responsibility`, `verification`, `closure`); leaf hash binds it; (h) **reason codes** — codified vocabulary per pack; never free-text; (i) **controlled session rules** — kiosk + collaborator + standard user sessions all have explicit idle-timeout policy + re-auth-on-resume policy per canon §29.

### 3.7 Mobile runtime parity (canon §33 NEW)
- **What:** Same `FormDefinition` / `WorkspacePage` JSON renders **semantically equivalent and validator-compatible** on web (React) and mobile (React Native): identical fields, identical actions, identical visibility rules, identical permission gates — with platform-native layouts per device (no attempt at pixel parity, which is the trap). Authored via `@hubblewave/ui-primitives` vocabulary: foundation (`Stack`, `Field`, `Card`, `List`, `ActionBar`, `Chart`, `Signature`), capture (`MediaCapture`, `BarcodeScanner`, `NameplateCamera`), and **field-tool primitives** designed for the technician's physical reality: `SwipeProgressCard` (horizontal swipe bound to state transitions — replaces precision tapping with glove-friendly gestures), `ThumbToggle` (full-row tap zone replacing tiny checkboxes), `LargeActionButton` (minimum 64dp tap target). Field-tool primitives exist because ServiceNow / Nuvolo treat mobile as a miniaturized desktop; HubbleWave treats mobile as a field tool. They degrade gracefully on web (swipe → drag, thumb-toggle → checkbox-with-larger-zone).
- **New packages:** `@hubblewave/ui-primitives` (vocabulary), `@hubblewave/ui-primitives-web` (MUI/Tailwind adapter), `@hubblewave/ui-primitives-mobile` (RN + Reanimated adapter).
- **New tables (schema `metadata`):** `mobile_sync_policies` (per-collection: `full | assigned_only | recent_only`, conflict strategy), `mobile_sync_conflicts` (operator-review queue).
- **Default conflict strategy:** `server_wins` for header fields + `last_write_wins` for completion fields (checklist answers, photos, notes). Per-collection override.
- **WatermelonDB schema** generated from collections marked `sync_to_mobile = true` on `CollectionDefinition` (new column).
- **"Elevator Mode" (offline-first as identity).** The mobile app NEVER blocks the technician on network state. Every action — open WO, swipe state, complete checklist, capture photo, e-sign, start next WO — is locally optimistic; UI responds in <16ms regardless of connectivity; WatermelonDB stores local state; background sync flushes silently on reconnect. UI surfaces an inline "Offline — working locally" badge, never a spinner. **Acceptance contract:** a technician can complete an entire shift in airplane mode (open, swipe through, sign, close every WO) and the sync replays on reconnect with conflict resolution per the policy above. Branded "Elevator Mode" because that's where Nuvolo dies — hospital MRI suites, sub-basements, elevators are exactly the dead zones competitors crumble in.

### 3.8 AVA Runtime UI Synthesis (canon §11 extension — powers "Invisible Manual")
- **What:** AVA can emit a **transient `FormDefinition` JSON** that renders via the same `@hubblewave/ui-primitives` vocabulary as persisted forms — without writing to metadata storage. Enables AVA to mutate the UI in response to a query: technician asks *"AVA, what does Error E-42 mean on a Baxter Sigma Spectrum?"* → AVA reads the ingested service manual, synthesizes a step-by-step troubleshooting checklist, renders it inline in the WO. ServiceNow / Nuvolo cannot do this — their AI is a side-panel that emits text, not a UI orchestrator.
- **No new tables.** Synthesis is request-scoped; the rendered form lives only for the user's session. Each call logs to `AVAProposal` for canon §12 traceability.
- **Validator gate:** AVA-emitted FormDefinitions pass the SAME validator that pack-shipped forms pass — only `@hubblewave/ui-primitives` vocabulary allowed, no escape hatches. Refused synthesis returns a structured "AVA can't render that" error to the orchestrator, never a runtime exception.
- **Trust progression:** Canon §12 per-feature. New synthesis features ship in Suggest mode (preview-before-apply); mature features may opt-in to direct render after evidence of accuracy.
- **Pack consumption:** Pack authors register AVA tool definitions via existing `AVATool` entity. The maintenance-core pack registers `synthesizeTroubleshootingChecklist(assetId, errorContext)`; AVA's planner selects it when the query matches a known asset + error-code shape.

### 3.9 Public Intake Primitive (canon §36 NEW — powers "Walk-by" nurse intake)
- **What:** Signed-token scoped public endpoints — unauthenticated POST that accepts narrow payloads, validates against a pack-declared schema, routes through AVA for triage, returns a confirmation token but NO platform data. Enables QR-code-on-asset + voice-memo intake without portal/login friction. ServiceNow / Nuvolo licensing + identity models make this expensive to retrofit.
- **New tables (schema `intake` — new schema):** `public_intake_tokens` (~10 cols: `id`, `code varchar(64) UNIQUE`, `scope_collection_id`, `scope_record_id`, `purpose varchar(64)`, `expires_at`, `max_uses int`, `uses int default 0`, `signing_kid`, `revoked_at`, `created_at`) — bound to a specific record (e.g., one asset) so a leaked QR cannot be used against other assets; `public_intake_submissions` (~12 cols: `id`, `token_id (FK)`, `raw_payload jsonb`, `structured_payload jsonb`, `ava_proposal_id (FK)`, `resolved_collection_id`, `resolved_record_id`, `ip_hash`, `ua_hash`, `outcome varchar(32)`, `created_at`).
- **Security posture (defense in depth):** Tokens signed via canon §29 KMS-backed signing (dedicated kid per instance). Per-token rate limit + per-IP rate limit + gitleaks-style secret scan on free-text. **Two-tier payload model:** (1) **JSON payload** for the submission body (max 50KB; schemas declared in pack manifest under `public_intake.schemas[]`); (2) **attachments** (audio, photos, PDFs) upload separately to pre-signed S3 URLs scoped to the token — each attachment max 25MB; each goes through AV scan + secret/PII scan + content-hash + **quarantine** before the AVA pipeline can read it; failed scan → attachment marked `quarantined`, AVA processing skips it, anomaly alert raised. JSON references attachments by their submission-scoped IDs. **Hard contract: endpoint never returns operational data** — only a submission code. Any data leak through this surface is a P0 incident.
- **Lifecycle + hardening (mandatory):** **Per-asset revoke/quarantine** — Maintenance Manager / Compliance Officer can revoke any QR token in one tap; quarantine an asset (all tokens revoked + future issuance refused) when abuse is detected. **Token rotation option** — pack-manifest declares whether tokens for a given purpose are lifetime or rotated on cadence (default lifetime for facilities-asset QR; rotate-quarterly available as a per-customer policy). **Replay idempotency** — every submission carries a client-generated UUID; duplicate UUIDs accepted with the same submission code (no duplicate WOs). **Anomaly alerts** — rate-limit breach, scan-fail, repeated malformed submissions on one token, geo-anomaly (token issued in NYC but submitted from offshore IP) all emit `RuntimeAnomaly` rows + page-on-call for the customer's ops contact.
- **Routing:** Submission lands in `intake.public_intake_submissions`; AVA pipeline (a worker job, no special privileges) reads the raw payload, runs structured extraction, writes back to `structured_payload` and `ava_proposal_id`, then dispatches to the pack-declared handler (e.g., maintenance-core's "create WO from intake" action) using a system-principal identity scoped to the intake purpose.
- **Service-boundary scanner:** `intake.*` writes restricted to `apps/api/src/app/intake/**` (token issuance) and `apps/worker/src/intake/**` (submission processing).

### 3.10 Break-Glass Field Override (canon §28.10 NEW — powers "Break-Glass PHI Access")
- **What:** Time-bound, audited override of §28 field masking — but **only for properties explicitly marked `break_glass_eligible = true` in metadata**, and **never** for properties classified into one of the hard-deny classes. A user with the right role + on an eligible property presses "Break Glass," selects a reason code, and the field is unmasked for a bounded duration (default 10 minutes). Auto-revoke after timer. ServiceNow ACLs cannot do dynamic, time-limited, audited, class-gated unmasking without custom scripting that breaks across upgrades.
- **Property eligibility metadata.** New column on `PropertyDefinition`: `break_glass_eligible boolean default false`. New column: `confidentiality_class varchar(64)` taking values from a seeded enum: `'public'`, `'internal'`, `'sensitive'`, `'never_reveal'`, `'legal_hold'`, `'sealed_investigation'`, `'system_secret'`, `'unrelated_patient_context'`. The latter five are **hard-deny classes** — break-glass NEVER unmasks them, regardless of grant or role. Pack authors mark each property with both flags at publish; validator refuses publish if `break_glass_eligible = true` AND `confidentiality_class` is a hard-deny class (the two are mutually exclusive).
- **New tables (schema `compliance`):** `field_unmask_grants` (~12 cols: `id`, `principal_user_id (FK)`, `collection_id`, `record_id`, `property_id`, `granted_at`, `granted_until`, `reason_code_id (FK)`, `signature_chain_id (FK)`, `audit_log_id (FK)`, `revoked_at`, `revocation_reason varchar(64)`).
- **Evaluator integration (canon §28.5 + §28.10) — three-stage:** (1) **Hard-deny check first.** If `PropertyDefinition.confidentiality_class` is in `{never_reveal, legal_hold, sealed_investigation, system_secret, unrelated_patient_context}` → DENY unconditionally. No grant overrides this. (2) **Active-grant check.** If property is `break_glass_eligible` AND an active unrevoked grant for `(principal, collection, record, property)` with `granted_until > now()` exists → UNMASK. (3) **Normal masking.** Run the canon §28.5 7-level matrix as usual. Grant lookup caches per-request in `UserRequestContext`; cache invalidation on grant insert/revoke via outbox event.
- **Audit linkage:** Every grant emits (a) a `signature_chains` row chained to the actor's session (compliance ledger), (b) an `audit_logs` row via `withAudit` (platform chain). Both linked via `audit_log_id` per canon §32. Tampering with a grant retroactively is impossible because the signature chain detects it.
- **Auto-revoke:** Worker job `compliance/break-glass-revoker.service.ts` polls `field_unmask_grants WHERE granted_until <= now() AND revoked_at IS NULL` every 60s; sets `revoked_at` + writes audit row. **Fail-safe in evaluator:** if `granted_until` is past, evaluator treats grant as revoked even before the steward stamps `revoked_at` — no time-window race.
- **Forensic query:** Compliance Officer workspace ships a "Break-glass log" view — every grant, every reason code, every principal, every patient context. Filterable by date / patient / user / property; CSV export.

### 3.11 External-Collaborator Session Tokens (canon §29 extension — powers Auditor Kiosk + Contractor Flow)
- **What:** Two complementary primitives for external (non-HubbleWave-account-holding) human users: (a) **read-only kiosk sessions** — time-bound scoped JWTs that bind a device to a single workspace with strictly-read-only permission (the Joint Commission auditor's iPad use case); (b) **magic-link collaborator invitations** — single-use email/SMS link that authenticates an external contractor into a session scoped to ONE record + a narrow permission set (view, attach photo, add notes, e-sign).
- **New tables (schema `identity`, near canon §29):** `kiosk_sessions` (~11 cols: `id`, `code varchar(64) UNIQUE`, `purpose varchar(64)` — e.g. `joint_commission_audit`, `workspace_id`, `bound_device_fingerprint`, `granted_by_user_id`, `granted_at`, `expires_at`, `revoked_at`, `signing_kid`, `audit_log_id`); `collaborator_invitations` (~13 cols: `id`, `code varchar(64) UNIQUE`, `email`, `phone`, `delivery_method`, `scope_collection_id`, `scope_record_id`, `permitted_actions text[]` — e.g. `['view', 'attach_photo', 'sign_closeout']`, `granted_by_user_id`, `granted_at`, `expires_at`, `consumed_at`, `signing_kid`).
- **Security posture:** Tokens signed by KMS (per canon §29.1) — dedicated kid per instance per purpose category. Read-only kiosk JWTs carry `aud='kiosk'`, `permitted_actions=['read']`, audience-checked at every API call; the §28 evaluator hard-rejects any write attempt under a kiosk audience regardless of role. Magic-link tokens carry `aud='collaborator'`, scope-bound; consumed_at stamped on first redemption (single-use). Per-device-fingerprint binding on kiosks prevents token-share. Every token issuance + redemption + revoke writes to `audit_logs` AND `signature_chains` (compliance officer can prove who handed an auditor what device when).
- **Revocation:** Compliance Officer / authorized role can revoke any kiosk session or magic-link in one tap; next API call → 401. Auto-revoke at `expires_at`. Token version bump on revoke prevents replay.
- **Service-boundary scanner:** `kiosk_sessions` + `collaborator_invitations` writes restricted to `apps/api/src/app/identity/external/**`. The kiosk audience handler in `JwtAuthGuard` (new branch alongside §29.7 service-token branch) writes `request.context = { kind: 'kiosk', sessionId, workspaceId, ... }`; consumers must narrow via `assertKioskContext()` helper.

### 3.12 Storage & Evidence Attachment Runtime (canon §38 NEW — shared substrate for marquees #5, #7, #9, #13, #15, #19, #29, #34)
- **What:** Generic pre-signed upload pipeline + immutable storage with object-lock + scanning + retention. Without this, packs reinvent attachment handling per surface (LOTO photos, evidence artifacts, contractor uploads, nameplate photos, asset-pin voice notes, invoice PDFs).
- **New tables (schema `storage`):** `attachment_uploads` (~12 cols: `id`, `purpose`, `scope_collection_id`, `scope_record_id`, `presigned_url`, `expected_size_bytes`, `actual_size_bytes`, `content_hash_sha256`, `s3_object_key`, `s3_version_id`, `status varchar(32)` ∈ {`presigned`, `uploaded`, `scanning`, `quarantined`, `clean`, `linked`}, `quarantine_reason`, `created_at`, `linked_artifact_id` FK→evidence_artifacts), `attachment_scan_results` (per-scan-pass: AV verdict, secret-scan verdict, PII verdict). Object-lock retention via S3 / equivalent — every upload carries `retention_until` + `legal_hold` flag.
- **Workers:** av-scan, secret-scan, content-hash, link-on-clean (transitions `status: clean → linked` and creates the `evidence_artifacts` row).
- **Service-boundary:** `storage.*` writes restricted to `apps/worker/src/storage/**` + `apps/api/src/app/storage/presign-controller.ts`. Consumers (packs) call `requestUpload(purpose, scope)` to get a presigned URL; never touch the storage tables directly.

### 3.13 Connector Runtime + Certified Simulators (canon §39 NEW — required by every integration adapter)
- **What:** Adapter SDK that every integration declares against, plus conformance-tested simulators for the §5.3 live-or-simulator rule. Without this, every pack's integrations are bespoke and the simulator certification claim is unfalsifiable.
- **Adapter SDK contract:** `IntegrationAdapter` TypeScript interface — `init(secret_handle, config)`, `healthCheck()`, `executeOperation(op_id, payload)`, `mode: 'live' | 'simulator'`, `conformance: ConformanceDeclaration[]`. Every adapter ships in two flavors (live + simulator); the simulator's conformance declares which operations it certifies (e.g., `hl7v2: ['ADT-A08', 'ORU-R01']`).
- **New tables (schema `integrations`):** `integration_adapter_registry` (per-instance enabled adapters with `mode` + `last_health_check_at`), `adapter_conformance_records` (per-adapter fixture-replay pass/fail history — gate-acceptance proof).
- **Pack publish:** pack manifest declares `integrations[]` with required adapter IDs + minimum conformance version. Install refuses if instance doesn't have a compatible adapter registered.

### 3.14 Semantic Search / Vector Match Primitive (canon §40 NEW — required by #2, #8, #11, #23, #29, #31, #33)
- **What:** Platform-level pgvector embedding index over pack-declared fields. Without this, packs would each wire their own vector search (Invisible Manual, Dirty Nameplate, Asset Pins, AVA Document AI for contracts/invoices, Semantic Recall, Auto-Commissioning all need it).
- **New tables (schema `search`):** `vector_index_entry` (partitioned by `collection_id` then by `embedding_model_version`; `(id, collection_id, record_id, embedding vector(768), source_text, source_field, last_indexed_at, model_version, provenance_jsonb)`), `embedding_model_registry` (which model is active per instance; supports rotation).
- **Pack opt-in:** `PropertyDefinition.vector_indexed = true` on text fields triggers indexing on write. Pack-manifest declares semantic-search use cases under `semantic_search.indexes[]`.
- **Query API:** `semanticMatch(query, collectionId, options)` returns ranked candidates with confidence + explainable factors (which embedding terms matched + which lexical fallback fired). Confidence bands (high > 0.85, med 0.70-0.85, low < 0.70) are platform defaults; packs declare per-use-case thresholds.

### 3.15 Spatial + Relationship Graph Primitive (canon §41 NEW — required by #12, #21, #22, #24, #32)
- **What:** Generic graph store + traversal API. Floor-plan routing (#12, #24), dependency graph (#22), Live Command Map (#21), and Analyzer Blast Radius (#32) all need graph operations. Without a shared primitive, each plugin would build its own graph.
- **New tables (schema `graph`):** `relationship_edge` (`id`, `src_collection_id`, `src_record_id`, `edge_kind`, `dst_collection_id`, `dst_record_id`, `weight`, `metadata_jsonb`; partitioned by `edge_kind`); `graph_index_hint` (per-collection indexing strategy for high-degree nodes).
- **Traversal API:** `traverse(start_node, edge_filter, depth_limit, options)` returns BFS/DFS results with cycle detection. `routeSolve(graph_id, from, to, weighting)` for floor-plan navigation. `blastRadius(start_node, edge_kind, depth, time_window)` for #32.
- **Pack-publish validator:** graphs declared in pack manifest checked for orphan nodes (door with no connected corridor) + cycle detection where forbidden (dependency graphs must be DAGs).

### 3.16 Financial Control Primitive (canon §42 NEW — required by #17, #27, #28, #29, #35)
- **What:** Approval-limit enforcement, separation-of-duties, three-way match, variance reason codes, budget hooks. Without this primitive, marquees #27 (capital), #28 (procurement), #29 (invoice), #35 (key custody co-sign) each reinvent financial controls.
- **New tables (schema `finance`):** `approval_limit_policy` (`(id, scope_kind, scope_ref, role, amount_min, amount_max, co_sign_roles[], active)`), `transaction_approval` (taskable — `(id, transaction_kind, transaction_ref, amount, requester_user_id, current_approver_role, status)`), `three_way_match_record` (`(id, po_id, invoice_id, receipt_id, variance_amount, variance_reason_code_id, matched_at)`), `budget_envelope` (`(id, cost_center, period_start, period_end, allocated_amount, consumed_amount)`), `variance_reason_code`.
- **Separation-of-duties:** the `transaction_approval` row's `requester_user_id` must differ from the approving user for transactions > threshold; enforced by the §28 evaluator + a dedicated `enforceSeparationOfDuties()` check at workflow transition.

### 3.17 Bulk Import / Commissioning Staging (canon §43 NEW — required by #33; reused by overlays for pack-data import)
- **What:** Generic staging table for bulk imports + AVA-normalized review grid + atomic publish. Marquee #33 Auto-Commissioning is the primary consumer, but every pack with seed data benefits.
- **New tables (schema `import`):** `import_batch` (taskable — `(id, purpose, source_filename, source_uploader_user_id, target_collection_id, row_count, status varchar(32)` ∈ {`ingested`, `normalizing`, `reviewable`, `publishing`, `published`, `rolled_back`}`, ava_confidence_summary_jsonb)`), `import_row` (per-row staging — `(id, batch_id, source_row_payload, ava_normalized_payload, ava_confidence_per_field, reviewer_overrides, status` ∈ {`pending`, `accepted`, `rejected`}`)`), `import_review_session` (reviewer assignment + completion timestamps).
- **Atomic publish:** transitioning `import_batch.status: reviewable → publishing → published` runs in a single DB transaction: all `import_row.status = accepted` rows insert into the target collection; audit chain extends; rollback is supported for N hours after publish (default 24h, customer-policy override).
- **Service-boundary:** `import.*` writes restricted to `apps/api/src/app/import/**`. Pack #33's `asset_import_batch` becomes a thin alias / view over the platform `import_batch` — the pack provides the asset-specific normalization rules but uses the platform staging machinery.

### 3.18 Integration Secrets + Egress Policy (canon §44 NEW — required by every integration adapter + critical for #26 NAC + #29 invoice + #30 telematics)
- **What:** Per-instance secret vault + outbound egress allowlist + kill switch. Without this, every adapter reinvents secrets handling, and NAC quarantine (#26) becomes a security vulnerability rather than a control.
- **New tables (schema `integrations`):** `integration_secret` (`(id, instance_id, adapter_id, secret_handle, kms_key_arn, encrypted_value bytea, rotated_at, expires_at)` — KMS-encrypted per canon §29 keys; never exposed to API process beyond a `getSecret(handle)` helper that resolves at call time), `egress_allowlist_entry` (`(adapter_id, target_host, target_port, target_protocol, purpose, active)` — deny-all default; explicit allowlist entries permit each outbound destination), `outbound_call_log` (every outbound HTTP/TCP call — partitioned monthly via pg_partman), `adapter_killswitch_state` (per-adapter emergency-stop flag; flips an adapter to fail-closed on every operation).
- **NAC guardrails (per #26):** the `nac-quarantine` adapter cannot fire a quarantine action without (a) dual-confirmation (security officer + maintenance manager), (b) customer-policy override flag, (c) an active `quarantine_safety_check_passed` evidence row written by an asset-criticality precheck — these gates prevent accidental clinical-operations impact.
- **Service-boundary:** secrets writes restricted to `apps/api/src/app/integrations/secrets/**`; egress allowlist + outbound_call_log restricted to `apps/worker/src/integrations/egress/**`.

---

## 4. Pack Composition (4 packs, ~55 pack PRs)

### 4.1 `maintenance-core` (~25 PRs)
- **~51 collections** including: `asset` (with `asset_type` discriminator — supports vehicles per #30 via `asset_type = 'vehicle'` + telematics capability; supports keys per #35 via `asset_type = 'physical_key'` + key-custody capability), `asset_type`, `asset_relationship`, `asset_meter`, `asset_pin`, `location`, `location_relationship`, `space`, `maintenance_work_order` (taskable), `maintenance_work_task` (taskable), `pm_schedule` (supports utilization-triggered generation for mileage-based vehicle PM per #30), `pm_asset_assignment`, `maintenance_definition`, `checklist_template`, `checklist_instance`, `inspection`, `deficiency`, `work_round_definition`, **`work_round_session`** (NOT taskable; per #25), `vendor`, `vendor_contact`, `service_contract`, `warranty`, `master_service_agreement`, `purchase_order` (taskable), `vendor_scorecard`, **`procurement_proposal`** (taskable — AVA-drafted JIT shopping cart per #28; lifecycle proposed → reviewed → approved-to-PO → rejected; each line carries AVA's provenance: which upcoming PMs and historical-break-fix records justified the quantity), **`vendor_invoice`** (taskable — invoice PDF + extracted line items + reconciliation status per #29; lifecycle received → ai_reconciled → discrepancy_flagged → human_review → approved → paid), **`capital_replacement_request`** (taskable — generated by Active Intercept per #27 when repair-cost ÷ residual-value ratio exceeds policy; lifecycle proposed → director_review → approved → procurement_proposal_linked → asset_decommissioned), `parts_catalog`, `inventory_location`, `inventory_bin`, `inventory_lot`, `inventory_serial`, `mobile_inventory_holding`, `technician_presence`, `parts_requisition` (taskable), `parts_consumption`, `stock_movement`, `document`, `advisory`, `recall_response` (taskable + regulated), `dispatch_plan`, `dispatch_assignment`, `permit_to_work` (taskable + regulated), `loto_step_check` (regulated), `work_order_dependency`, **`asset_import_batch`** (taskable — per #33 Auto-Commissioning; lifecycle ingested → normalized → reviewed → published; tracks the spreadsheet ingest + AVA per-row normalization confidence + customer-confirmed publish), **`key_record`** (per #35 — physical key inventory: `(id, key_serial, key_class, parent_master_key_id, opens_locks[], status)`), **`key_assignment`** (taskable + regulated — per #35; every issuance e-signed via §3.6; signature_chain_id binds custody transfer), **`unrecovered_key_flag`** (taskable — auto-generated when an employee transitions to `terminated` while holding open key assignments).
- **~18 workflows** (process flows): WO intake/triage, **WO triage with entitlement intercept** (per #23), WO approval, PM generation orchestration, calibration signoff, recall remediation, FCA review, permit-to-work auth, parts reorder, AEM review, WO escalation loop, WO close-out, **round_completion_review** (per #25 — observation failures → reactive WOs), **contract_renewal_cycle** (T-90/30/7 notifications), **capital_replacement_review** (per #27 — Active Intercept fires → Maintenance Manager triages → Director approves or rejects → if approved, generates a linked `procurement_proposal`), **procurement_proposal_approval** (per #28 — AVA-drafted JIT cart → Procurement Manager Approve All / Edit / Skip → converts approved lines into `purchase_order` rows), **vendor_invoice_reconciliation** (per #29 — vendor PDF dropped at §3.11 portal → Document AI extract → cross-reference against time_on_site + MSA rates + parts_consumption → match → AP auto-approve, OR mismatch → discrepancy_review queue with reason codes), **fleet_telematics_to_pm** (per #30 — OBD2 mileage threshold → `pm_schedule` utilization-trigger → idempotent `maintenance_work_order`), **asset_import_commissioning** (per #33 — AVA-normalized spreadsheet → review grid → bulk publish), **key_revocation_on_termination** (per #35 — HR `user.status = terminated` event → automation fires → every open `key_assignment` for the user emits `unrecovered_key_flag` + recovery WO + Security Officer notification).
- **~25 automation rules** (state-machine guards, SLA start/stop, projection outbox, scheduled reorder check, scheduled warranty alerts, scheduled meter rollover, scheduled stale-WO escalation, before-delete reference check, after-insert checklist instantiation).
- **~50 views** across 7 personas.
- **9 OOTB workspaces** all built via UI Builder (the dog-food proof per canon §27):
  - `ws_technician_mobile_first` — Home / Work / **Rounds** (dedicated tab; `<RoundsRunner>` opens a `work_round_session` and presents the Glove-Mode Rapid Fire swipe-deck per #25; observations stream into §3.5; only failures spawn reactive WOs) / Assets; barcode → WO → checklist → photo → sign
  - `ws_dispatcher` — map + queue + drag-to-assign + Smart Sprint board
  - `ws_maintenance_manager` — KPI dash, PM compliance %, MTTR, MTBF, replacement-urgency board, contract-renewal board, vendor scorecard
  - `ws_biomed_engineer` (Clinical overlay-aware)
  - `ws_facilities_manager` (Facilities overlay-aware) — adds space reservations + move-request board
  - `ws_compliance_officer` — readiness dashboard, audit-trail browser, e-signature ledger, kiosk-session manager
  - `ws_fca_inspector` — mobile-first FCA capture, deficiency log
  - `ws_auditor_kiosk` — strictly read-only; bound to a §3.11 kiosk session
  - `ws_ot_security_officer` (OT Security overlay) — vulnerability triage queue + advisory inbox + risk dashboard + per-asset baseline view
- **32 React + RN plugin components** via `@hubblewave/maintenance-plugins`: foundational viewers (`<AssetUtilizationChart>`, `<PredictiveFailureHeatmap>`, `<FloorPlanOverlay>`, `<FloorPlanRouter>`, `<CalibrationCalendar>`, `<RecallResponseTracker>`, `<DispatchMap>`, `<ChecklistRunner>`, `<SignatureCapture>`, `<RoundsRunner>`); workflow triggers (`<BreakGlassButton>`, `<PartFinder>`, `<AssetPinsCard>`, `<LotoStepRunner>`); external-collaborator surfaces (`<AuditorKioskShell>`, `<ContractorPortal>`); persona dashboards (`<SprintBoard>`, `<ReplacementUrgencyScore>`, `<ContractRenewalBoard>`, `<CapitalReplacementCard>`, `<ProcurementProposalCart>`, `<InvoiceDiscrepancyBoard>`, `<FleetTelemetryPanel>`, **`<SemanticRecallMatchBoard>`** per #31, **`<AnalyzerBlastRadiusBoard>`** per #32, **`<AssetImportWizard>`** per #33, **`<KeyCustodyLedger>`** per #35); and **fluid WO-processing views**: `<PivotKanban>`, `<DualAxisTimeline>`, `<TriageDeck>`, `<LiveCommandMap>`, `<DependencyGraph>` — each as described in §5.1 marquees #18-22.
- **7 integration adapters** in core: BACnet generic, Modbus, MQTT-generic, mobile-barcode, S3 evidence store, AD/SCIM roster, **`obd2-telematics-feed`** (per #30 Fleet-as-Asset — ingests OBD2 + GPS telemetry into §3.5 `observation_streams` for vehicle-type assets; stream_kind ∈ {engine_rpm, coolant_temp, mileage, gps_lat, gps_lon, fault_code}).

### 4.2 `clinical-maintenance` overlay (~8 PRs)
Every entry justified by PHI implication, FDA/UDI/ECRI vocabulary, or non-portable evidence schema.
- **~12 collections:** `clinical_device_class` (FDA I/II/III), `udi_record` (FDA UDI/GS1), `gmdn_term`, `ecri_recall`, `aem_program`, `aem_program_membership`, `calibration_certificate` (traceability chain), `sterilization_cycle`, `phi_disposal_record`, `ehr_context_link` (HL7/FHIR linkage; read-only, never stores PHI), `life_support_designation`, `clinical_criticality_score`.
- **3 workflows:** `aem_committee_review`, `phi_safe_disposal`, `ecri_advisory_response`.
- **4 integrations:** `hl7-v2`, `fhir-r4`, `ecri-feed`, `fda-udi-feed`.
- **3 plugins:** `<UDILookup>`, `<EhrContextPanel>`, `<AemProgramDashboard>`.

### 4.3 `facilities-maintenance` overlay (~12 PRs)
- **~14 collections:** `building_system` (HVAC/electrical/plumbing/fire), `refrigerant_inventory`, `refrigerant_log` (EPA Section 608), `fca_assessment`, `fca_finding`, `cad_drawing_link`, `ifc_space_link`, `energy_baseline`, `commissioning_record`, `building_compliance_certificate`, **`space_reservation`** (room/equipment booking — `(id, space_id, requester_user_id, start_at, end_at, purpose, status, conflict_resolution_id)`; taskable), **`seat_assignment`** (per-employee seat binding — `(id, space_id, occupant_user_id, assignment_kind ∈ {permanent, hot_desk, temporary}, valid_from, valid_until)`), **`move_request`** (taskable — relocation workflow: `(id, requester_user_id, from_space_id, to_space_id, asset_ids_to_move[], assigned_team, scheduled_at, status)`), **`occupancy_log`** (utilization tracking — `(space_id, observed_at, occupant_count, source ∈ {badge_reader, sensor, manual_count}, confidence)`; partitioned monthly).
- **5 workflows:** `fca_assessment_cycle`, `refrigerant_leak_response` (EPA reporting), `commissioning_signoff`, **`move_request_approval`** (originator → facility manager → IT (asset relocation) → safety officer → scheduled execution), **`space_reservation_conflict_resolution`** (concurrent booking detection → priority rule → notification + alternate-suggestion).
- **4 integrations:** `bacnet-building-pack` (richer than core), `autocad-dwg`, `ifc-bim`, **`wifi-beacon-occupancy`** (Wi-Fi controller + BLE beacon + badge-reader telemetry feed → §3.5 `observation_streams` → materialized into `occupancy_log`; per #24 Invisible Space Audits; aggregated by room + 5-min bucket, never per-individual).
- **7 plugins:** `<RefrigerantLedger>`, `<FcaDeficiencyMap>`, `<EnergyDashboard>`, `<SpaceReservationCalendar>`, `<MoveRequestBoard>`, `<OccupancyHeatmap>`, **`<LiveOperationalCanvas>`** (WebGL-native floor plan with real-time technician dots + AVA-plotted walking path for multi-PM shifts, per #24).

### 4.4 `ot-security-maintenance` overlay (~10 PRs) — Nuvolo OT Cyber Security parity
A third HubbleWave-owned overlay for hospitals + facilities tracking operational-technology (OT) device cyber-security alongside maintenance. Same pack model as Clinical / Facilities; same upgrade-safety contract.
- **~6 collections:** `ot_asset_vulnerability` (taskable — `(id, asset_id, cve_id, cvss_score, exploitability, exposure, status ∈ {open, mitigating, mitigated, accepted_risk}, signature_chain_id)`), `network_policy` (`(id, asset_id_set[], policy_kind, ingress_rules, egress_rules, last_audited_at, owner_user_id)`), `security_advisory` (`(id, source ∈ {claroty, medigate, asimily, ecri, fda, manufacturer}, ref_id, affected_asset_query, severity, published_at, action_required, status)`), `discovery_event` (asset-discovery feed — `(id, source_adapter, raw_payload, mapped_asset_id, status ∈ {new, mapped, ignored})`), `risk_score` (per-asset cyber-risk: `(asset_id, computed_at, score, factors_jsonb, computed_by_rule_set_version)`), `network_baseline` (allowed-traffic-pattern snapshot per asset class).
- **4 workflows:** `vulnerability_response` (open → triage → mitigation plan → e-sign → mitigated), `network_anomaly_review` (deviation from baseline → security officer review → policy update or quarantine), `security_advisory_distribution` (advisory ingest → asset-query match → notify owners → tracked acknowledgement), **`ava_convergence_routing`** (per #26 — OT alert + matching upcoming PM → propose attaching patch-install step to the PM; OT Security Officer one-tap approves; vulnerability ticket auto-closes-as-merged; signature_chains records the convergence decision).
- **5 integrations:** `claroty-medical-device-security`, `medigate-asset-feed`, `asimily-vulnerability-feed`, `generic-cmdb-export` (push HubbleWave asset registry to a customer-owned CMDB for cross-platform views), **`nac-quarantine`** (per #26 Quarantine Lockout — outbound API to NAC platforms like Cisco ISE / Aruba ClearPass / Forescout; on quarantine, the asset's `status` flips to `quarantined`, clinical mobile app surfaces "Do Not Use — Cybersecurity Quarantine" banner, signature_chains row recorded).
- **3 plugins:** `<OtAssetRiskMap>` (risk-colored floorplan overlay), `<VulnerabilityTracker>` (per-asset CVE board with remediation timeline), `<NetworkBaselineDashboard>` (deviation visualization).
- **1 new workspace:** `ws_ot_security_officer` (9th OOTB workspace) — vulnerability triage queue + advisory inbox + risk dashboard + per-asset baseline view; consumes `task_projection` for the vulnerability queue.

### 4.5 `regulated-action` capability (cross-cutting platform substrate, consumed by every pack)
The `regulated-action` capability is **provided by the platform substrate** (§3.6) — every pack consumes it via `requires_capabilities: ['regulated-action']` and binds collections via `capability_bindings.regulated_action`:
- **`maintenance-core` binds core regulated collections**: `permit_to_work`, `loto_step_check`, `recall_response`, `inspection`, `checklist_instance`, **`key_assignment`** (every key issuance e-signed by holder; master-key issuance requires supervisor co-sign per #35), **`capital_replacement_request`** (Capital Active Intercept per #27 — Director approval is a regulated action that forwards to Finance), **`vendor_invoice`** (variance approvals above customer-configurable threshold per #29 require AP-supervisor e-signature), **`procurement_proposal`** (Procurement Manager approval of AVA-drafted shopping cart per #28 — separation-of-duties enforced via §3.16).
- **`clinical-maintenance` binds overlay-owned regulated collections only**: `calibration_certificate`, `aem_program_membership`, `phi_disposal_record`.
- **`facilities-maintenance` binds overlay-owned regulated collections only**: `refrigerant_log`, `fca_assessment`, `commissioning_record`, `building_compliance_certificate`, `move_request` (cross-departmental moves with safety-officer approval).
- **`ot-security-maintenance` binds overlay-owned regulated collections**: `ot_asset_vulnerability` (accepted-risk decisions require OT Security Officer + Compliance Officer co-sign), `network_policy` (changes are regulated-action — every edit logged + reason-coded), `nac-quarantine` actions (per #26 — quarantine decisions are regulated actions with dual-confirmation captured in `signature_chains`).

Each pack binds only the collections it owns; overlays never re-bind maintenance-core collections. The validator refuses install of any pack whose `requires_capabilities` lists a capability the substrate version doesn't expose.

---

## 5. Full Showcase Pilot (~48-50 weeks — everything in scope)

This is no longer an MVP slice. The pilot is the full showcase: **35 differentiators** (#1-22 originals + #23-26 Contracts / Space / Rounds / OT Security category-resets + #27-30 Capital / JIT Procurement / Invoice Reconciliation / Fleet-as-Asset back-office reinventions + #31-35 Semantic Recall / Analyzer Blast Radius / Auto-Commissioning / Joint Commission Merkle Proof / Key Custody edge-reinventions), three overlays at production fidelity, complete substrate (18 platform sections), scale verification. Phase gates prevent a "giant final integration" risk — every 5-7 weeks ends with a demonstrable Go/No-Go increment. The RFP demo at week 50 is the customer-on-site moment; everything before it is internal acceptance. (Timeline grew from 46 → 50 weeks to absorb G0c shared substrate — §3.12-§3.18 are non-negotiable to prevent the packs from inventing ad-hoc versions of platform primitives.)

### 5.1 Pilot scope (Full Showcase — all features in scope)
- **All Phase 1 substrate** (canon §3.1-§3.11 — taskable, projection w/ circuit breaker + tombstones, scheduling, list-scale, observations, regulated-action w/ Merkle batch, mobile parity + Elevator Mode, AVA UI synthesis, public intake, break-glass override, external-collaborator session tokens). Active/archive partitioning included.
- **`maintenance-core` full:** all 38 collections (assets, asset-types, asset-relationships, asset-meters, asset-pins, locations, locations-relationships, spaces, work-orders, work-tasks, PM-schedules, PM-assignments, maintenance-definitions, checklists + instances, inspections, deficiencies, vendors + contacts + contracts + warranties, parts catalog + inventory locations + bins + lots + serials + mobile-inventory-holdings + technician-presence + requisitions + consumption + stock-movements, documents + advisories + recall-responses, dispatch plans + assignments + sprints, permits-to-work + LOTO step checks, work-order dependencies); all 8 OOTB workspaces; all 22 plugin components; all 12 workflows; all 25+ automation rules; all 6 integration adapters.
- **`clinical-maintenance` full:** all 12 collections, 3 workflows, 4 integrations (HL7v2, FHIR R4, ECRI feed, FDA UDI — live where customer credentials + sandbox environment are available, certified simulator otherwise per the §5.3 live-integration rule), 3 plugins. PHI masking + break-glass + AEM + recall response live.
- **`facilities-maintenance` full:** all 14 collections, 5 workflows, 3 integrations (BACnet building-pack adapter, AutoCAD DWG, IFC BIM — live where customer credentials + sandbox environment are available, certified simulator otherwise per the §5.3 live-integration rule), 6 plugins. FCA + refrigerant + commissioning + space reservations + move-request + occupancy tracking all live.
- **`ot-security-maintenance` full:** all 6 collections, 3 workflows, 4 integrations (Claroty, Medigate, Asimily, generic-CMDB-export — live or certified-simulator per §5.3 rule), 3 plugins, 9th OOTB workspace `ws_ot_security_officer`. Vulnerability response + network-anomaly review + security-advisory distribution all live.
- **AI marquee #1 — Voice WO capture + AVA structuring.** Technician taps mic, says *"Infusion pump 4521 in room 312 is alarming and the screen is frozen, replaced battery yesterday."* AVA produces a WO with asset linked (UDI match on "4521"), location linked (room 312), category (display/alarm), description structured, suggested triage. One-tap submit. Single canon §12 Suggest-mode flow.
- **AI marquee #2 — "Invisible Manual" (AVA-native troubleshooting).** Technician opens a WO on mobile, taps mic, asks *"AVA, what does Error Code E-42 mean on a Baxter Sigma Spectrum?"* AVA — having ingested the asset's PDF service manual via document AI (canon §11) — doesn't just answer in text; it **dynamically synthesizes a step-by-step troubleshooting checklist that renders inline in the mobile UI** via the `<ChecklistRunner>` primitive. Technician steps through it; AVA logs each step's outcome. Checklist is ephemeral — never persisted as a metadata `checklist_template`. Powered by §3.8 AVA Runtime UI Synthesis + canon §11 document AI + canon §33 mobile parity, composed. **ServiceNow / Nuvolo cannot do this** — their AI is a side-panel that emits text, not a UI orchestrator that can generate runtime components.
- **AI marquee #3 — "Walk-by" frictionless nurse intake.** Nurse scans the QR code on an infusion pump with their phone. **No login, no portal, no required fields.** They hold a button, say *"The screen is frozen and it keeps beeping,"* and walk away. AVA (a) resolves the asset from the signed QR slug, (b) processes the audio, (c) categorizes the issue, (d) sets priority based on asset criticality + life-support designation (clinical overlay), (e) routes to the correct biomed group. Nurse gets one confirmation toast; the technician sees the structured WO in their workspace within projection lag. Powered by §3.9 Public Intake Primitive. **ServiceNow / Nuvolo cannot do this** without enterprise license + custom portal work — their licensing + identity models make frictionless guest ingest expensive.
- **AI marquee #4 — Deterministic parts staging (rules + history, not predictive ML).** When AVA structures the WO (from voice capture or QR intake), a deterministic rules engine queries the asset's WO history + parts-consumption ledger + error-symptom keyword index. The engine ranks candidates by (frequency-of-use on this asset class) × (recency) × (parts cross-reference match strength). Top candidate, if confidence-rule passes, is reserved via `parts_requisition` insert + stockroom push notification. **Technician sees "Part reserved in Bin B4" on their mobile BEFORE they leave their desk.** Every reservation carries full provenance — clicking the suggestion shows the ranking factors and the 3 historical WOs that drove it. No black-box ML; no per-customer training. Trained ML refinement is a **post-G6** option that strictly improves accuracy on top of the same explainable substrate. **ServiceNow / Nuvolo cannot do this at intake time** — it requires tight synchronous coupling between the reasoning layer and inventory collections, which their architecture decouples by design.
- **AI marquee #5 — "Break-Glass" PHI access.** WO carries a `patient_context` field masked by default (HIPAA minimum-necessary per canon §28.5). Tech presses "Break Glass," selects a reason code (Emergency Repair, Equipment Triage, Infectious Isolation Check), and the patient context (e.g., *"Airborne Isolation — N95 Required, Room 312 — VRE precautions"*) is revealed for **10 minutes**. Auto-revoke. Every grant + reveal recorded in immutable `signature_chains` ledger; HIPAA auditor can query "every break-glass on patient X in the last 6 months" in one click. Powered by §3.10 Break-Glass Field Override. **ServiceNow / Nuvolo cannot do this** without custom scripting that breaks across upgrades — their ACLs are static; dynamic, time-limited, audited field unmasking is not native; the 20M-row task table makes the row-security overhead prohibitive.
- **Technician superpower #6 — Glove-Mode swipe UX.** Mobile WO list and detail use `<SwipeProgressCard>` — swipe right = start, left = block/escalate, long-swipe right = complete. `<ThumbToggle>` replaces every checklist checkbox with a full-row tap zone. `<LargeActionButton>` enforces 64dp minimum tap targets. Designed for nitrile gloves + one-handed ladder use. Works the same on web (drag) and mobile (swipe). ServiceNow's mobile is a miniaturized desktop; ours is a field tool. Eliminates the "precision tapping on tiny dropdowns" pain that infuriates Nuvolo users.
- **Technician superpower #7 — Generative close-out (eliminate typing).** At WO end, tech taps mic and says *"Swapped the intake O-ring, recalibrated pressure to 50 PSI, ran a test cycle, all good."* AVA renders this into a compliance-grade close-out: FDA-style resolution narrative, auto-selected reason codes from the regulated-action vocabulary (`corrective_action_taken`, `calibration_verified`), populated parts-consumption log, pre-filled resolution fields. Tech reviews on a `<SwipeProgressCard>`, swipes-right-to-approve, e-signs via Plan-Fix-41 chain (or Merkle batch if closing N WOs at end-of-shift). Turns a 3-minute typing chore into a 5-second voice memo while raising audit quality. Powered by §3.8 AVA UI synthesis + canon §11 voice + §3.6 regulated-action.
- **Technician superpower #8 — Dirty Nameplate Vision Extraction.** Tech snaps a photo of a scratched, dusty, dim asset nameplate via new `<NameplateCamera>` primitive. AVA Vision OCRs the text, fuzzy-matches against `task_projection` + asset registry, returns the asset with confidence score. Confidence > 90% → opens asset detail directly; 70-90% → surfaces top-3 candidates for tap-confirm; < 70% → falls back to `<BarcodeScanner>` or manual search. **The barcode-missing failure mode kills Nuvolo customers** in the field; Dirty Nameplate is the answer.
- **Technician superpower #9 — Elevator Mode (offline as identity).** Every mobile action is locally optimistic with <16ms UI response. WatermelonDB stores local state; sync flushes silently on reconnect. Tech can complete an entire shift in airplane mode — open WO, swipe state, complete checklist, capture nameplate photo, voice close-out, e-sign — all without seeing a spinner. Inline "Offline" badge instead of blocking. Implementation in §3.7; branded prominently for the RFP because **speed is the #1 complaint against Nuvolo**.
- **Connected-network superpower #10 — Peer-to-peer parts locator.** Tech taps "Find Part" on a WO. AVA queries `inventory_location` (stockrooms + bins) AND `mobile_inventory_holding` (every clocked-in technician's cart/van stock) AND `technician_presence` (who's near and available). Returns ranked candidates: *"John Smith is on Floor 2 and has 3 of these in his cart."* Tap → ping John via in-app notification: *"Can I grab one of your batteries for WO-1042?"* John accepts/declines on his phone; on accept, `parts_requisition` is created with `source = peer_transfer` and `holder_user_id = john`. Treats inventory as a dynamic mobile network, not a static warehouse. **Privacy gate:** `technician_presence` is opt-in per-technician policy with explicit consent recorded; presence visibility scoped to maintenance team peers only.
- **Connected-network superpower #11 — "Tribal Knowledge" Asset Pins.** A 30-year veteran taps the mic on an asset record and says *"Hey guys, the manual says X, but just jiggle the bypass valve first before resetting."* AVA transcribes, indexes, tags severity, and stores in `asset_pin`. When a junior tech later scans that same asset (Dirty Nameplate or QR), AVA proactively surfaces: *"3 technicians have noted a quirk with this valve — tap to hear."* The veteran's voice plays back at 1×, optionally with the AVA-summarized transcript. Captures institutional memory at zero friction — converts watercooler talk into searchable asset intelligence. Solves the "veteran retires, knowledge lost" problem that breaks every legacy CMMS.
- **Connected-network superpower #12 — Contextual Floor-Plan Routing (the "Blue Dot" experience).** WO says *"Location: West Wing, Floor 3, Utility Closet 3B, Panel 4."* Tech taps "Take me to Asset" in the `<FloorPlanRouter>` plugin. The facilities overlay's `cad_drawing_link` / `ifc_space_link` graph yields an interactive floor plan with a highlighted path from the tech's current position to the target door — Google-Maps-style indoor navigation. Nuvolo's space module is heavy and desktop-leaning; this is fluid + mobile-first + offline-cached.
- **Connected-network superpower #13 — Smart LOTO with AVA Vision.** When a WO carries a `permit_to_work` for hazardous-energy work, `<LotoStepRunner>` enforces the **customer-defined energy-control procedure under OSHA 1910.147 (Lockout/Tagout)** as authored in the pack metadata. **Tech must snap a photo of each placed lock**; AVA Vision confirms a lock is present in the image (lock-type matching the expected type for the step) before the tech can swipe to the next step. Each verified step writes a `loto_step_check` row chained into `signature_chains` — the entire procedure becomes mathematically auditable evidence rather than a paper-binder headache. Safety officers will champion HubbleWave on this one feature alone. **Vision-failure policy:** confidence < 70% → step BLOCKED with structured error "AVA cannot confirm lock placement; retake photo or escalate to safety officer."
- **Systemic differentiator #14 — Auditor Kiosk (Compliance Officer / Joint Commission, FDA).** When an auditor walks in, the Compliance Officer issues a §3.11 kiosk session bound to the auditor's iPad, hands them the device. The iPad lands on `ws_auditor_kiosk`: PM compliance %, drill-downs into critical life-safety assets, direct access to the immutable `signature_chains` ledger with full filterability, CSV/PDF export. No edit affordance anywhere — every API call enforces `kind='kiosk'` audience read-only. Compliance Officer can revoke the session in one tap when the audit ends. Hands an auditor mathematically verifiable evidence rather than printed PDFs and apologies. **ServiceNow / Nuvolo cannot do this** without manual prep work + custom report-builder time + heroic dashboard hacks.
- **Systemic differentiator #15 — Zero-Login Contractor Flow (External Vendor).** When a WO is routed to an external vendor (elevator company, specialized imaging tech, etc.), HubbleWave sends a §3.11 magic-link via SMS + email. Vendor taps the link → lightweight mobile web view (`<ContractorPortal>`) loads → sees the WO, the asset, the location, attaches photo, types or voice-dictates close-out notes, e-signs. **No app download, no password, no training, no per-seat license.** Brings 100% of contractor work into the platform's audit trail. **ServiceNow / Nuvolo charge per-seat for external users** — making this expensive enough that most hospitals manage contractor WOs via email and lose all visibility.
- **Systemic differentiator #16 — Smart Sprint Batching (rule-based clustering, not AI optimizer).** Dispatcher gets AVA-proposed Sprints built by a **deterministic clustering algorithm**: (a) cluster open WOs by floor + wing locality from `task_projection`; (b) overlay `pm_schedule` PMs due in the next 14 days that share locality and skill; (c) intersect with `technician_presence` + skill matrix; (d) score by total estimated time vs trips-saved factor. Returns proposals like *"Sarah, 4 WOs for your morning: 3 reactive on Floor 4 + 1 HVAC PM due next week on the same floor. Estimated 95 minutes, two trips saved."* Each Sprint card shows the clustering criteria + scoring weights — auditable, deterministic, no black-box. Dispatcher reviews on `<SprintBoard>` and one-tap approves; Sprint is never auto-applied. ServiceNow's routing is a map; ours is an explainable scheduler. Post-G6 option: trained ML model refines the locality + scoring weights from historical Sprint-acceptance data.
- **Systemic differentiator #17 — Repair-vs-Replace Score (deterministic rubric + transparent sentiment, not black-box ML).** Every asset carries a **Replacement Urgency Score** computed by a transparent published rubric: quantitative (cumulative repair cost ÷ replacement cost, downtime hours, MTBF trend, warranty remaining — each weighted by a published coefficient) PLUS qualitative signal from close-out narratives + asset pins (sentiment classified by a deterministic keyword + phrase lexicon shipped with the pack — every classification shows which lexicon entries fired). When techs log *"this thing is a nightmare"* or *"patched it again but the motor is dying,"* the lexicon picks it up with provenance. Score surfaces on `<ReplacementUrgencyScore>` plugin. **Every score is explainable end-to-end** — click any score, see exactly which factors contributed and how much. Maintenance Manager sign-off required before score forwards to Finance dashboard. Post-G6 option: trained ML model improves sentiment classification accuracy while keeping the published-rubric structure unchanged. **CFO/Finance Director sees an explainable financial-decision tool**, not a black box. ServiceNow / Nuvolo treat this as a separate "asset analytics" SKU; we ship it core, deterministic, and explainable.
- **WO-processing view #18 — Pivot-Kanban (contextual boards).** Dispatcher's Kanban with pivotable columns: state (default) / floor / technician skill / asset category / priority. One tap pivots the view. Drag-between-columns isn't just visual — it executes AVA macros: drag a WO into "Electrical" → AVA re-assigns to the nearest available electrician + updates categorization + writes audit row. ServiceNow's VTB groups only by state. This is the same data, pivoted in real-time, with drag-as-command semantics.
- **WO-processing view #19 — Dual-Axis Timeline (Asset vs Technician sync).** Specialized Gantt with two synchronized horizontal tracks: technicians on top (shifts, current WOs), critical assets on bottom (their "available for maintenance" windows pulled from EHR scheduling — Clinical overlay only — or facilities calendars). Dispatcher drags a 4-hour PM block; as they drag, AVA highlights valid technician × asset-window intersections in green; release snaps to the chosen intersection. Eliminates "playing Tetris with spreadsheets" — the operating-room PM scheduling pain point.
- **WO-processing view #20 — Triage Deck (high-speed keyboard dispatch).** Inspired by Superhuman email. Incoming unassigned WOs presented one-at-a-time as a massive central card showing photo, nurse's voice transcript, AVA's suggested tech with reasoning, asset criticality. Keyboard-driven: Right Arrow = accept AVA's suggestion → next card; Left Arrow = reject / request more info; Up Arrow = escalate to critical; Down Arrow = defer to backlog; Number keys = override with specific technician. Dispatcher clears 50 tickets in 2 minutes without touching the mouse. ServiceNow's list view requires multi-click on every row.
- **WO-processing view #21 — Live Command Map (spatial god-mode).** Top-down 2D floorplan / campus map; WOs render as heat-map dots colored by priority (red critical, yellow routine, blue informational); technicians render as moving blue dots from `technician_presence` (with privacy opt-in). Maintenance Manager sees the spatial reality immediately: 15 red dots clustered on Floor 3 = burst pipe cascading into electrical shorts. Lasso-select the cluster, drag onto the nearest technician's blue dot = creates a "Major Incident" batch assignment with one gesture. ServiceNow's map module is a heavy add-on; this is the platform's default view for an instance with `cad_drawing_link` / `ifc_space_link` data.
- **WO-processing view #22 — Dependency Graph (bottleneck hunting).** Complex repairs have inter-trade dependencies (Carpentry opens wall → Plumbing fixes pipe → Electrical re-wires). Graph view: WOs as bubbles, dependencies as arrows. AVA computes the critical path and badges the bottleneck WO in glowing red: *"This $15 drywall repair is currently blocking 3 high-priority plumbing tasks."* Shifts maintenance management from reactive ticketing to proactive bottleneck elimination. Powered by a `work_order_dependency` join collection (~5 cols: `id, blocker_wo_id, blocked_wo_id, dependency_kind, created_by`) added to maintenance-core.
- **Category-reset #23 — Active Entitlement Shield (reinvents Contracts).** Nuvolo / ServiceNow ship Contracts as static data-entry forms; technicians do work, then billing realizes the asset was under warranty — millions in "warranty leakage." HubbleWave inverts this: (a) **AVA Document AI intake** — drag a 50-page vendor PDF onto `master_service_agreement`; AVA (canon §11) extracts SLAs + covered components + response-time clauses + exclusion lists into structured metadata, never manual data entry; (b) **Contextual Dispatch Intercept** — at WO triage, AVA checks `master_service_agreement` + `warranty` against the asset; if covered, the dispatcher sees an inline prompt *"This MRI is under a Gold Philips warranty (response 4h, parts + labor covered) — route to Philips via their vendor portal?"*; one tap routes the WO out via §3.11 Zero-Login Contractor magic-link (vendor receives SMS, performs work, captures photo, e-signs — no vendor portal login). Powered by §3.8 AVA UI synthesis + canon §11 document AI + §3.11 collaborator sessions, composed. Eliminates warranty leakage as a category.
- **Category-reset #24 — Live Operational Canvas (reinvents Space Management).** Nuvolo treats space as an office-planner tool disconnected from the technician walking the floor. HubbleWave makes it a live operational canvas: (a) Floor plans render natively in mobile via WebGL (`<FloorPlanRouter>` from #12 + new `<LiveOperationalCanvas>` plugin); when a tech has 8 PMs on Floor 3, AVA plots the most efficient walking path between rooms (TSP-approx solver against the floor-plan graph) + estimates total time saved; (b) **Invisible Space Audits** — instead of dispatching humans for "space utilization studies," HubbleWave ingests Wi-Fi / Bluetooth beacon / badge-reader telemetry via the §3.5 observations substrate (new adapter `wifi-beacon-occupancy`); the worker materializes per-room occupancy heatmaps into `occupancy_log` automatically; space metadata reflects actual usage, not planner assumptions. Privacy gate: occupancy is aggregated by room + 5-min bucket, never per-individual; opt-in per customer with explicit policy disclosure to staff.
- **Category-reset #25 — Continuous Observations Engine (reinvents Rounds).** Nuvolo / ServiceNow check 50 fire extinguishers → spawn 50 task rows → bloat the polymorphic task table → technician taps "Close Complete" 50 times. **HubbleWave: a round is not a task; it is a Batch Observation Session.** `work_round_session` (NOT taskable) opens on the mobile app; each check writes a single `observations` row (pass / fail / measurement) into the §3.5 partitioned table — 50 checks = 50 observations, 0 WO rows. **Glove-Mode Rapid Fire** swipe-deck UX: tech swipes right = "Pass" + auto-advance to next check; left = "Fail" + spawn ONE reactive `maintenance_work_order` (taskable) only for the failure; long-press = capture measurement value. 49 passes complete in seconds. **Dynamic Smart Rounds**: AVA analyzes failure trends across `observations` rollups — if brand-X beds are failing bed-rail checks across the hospital this week, AVA dynamically injects a mandatory bed-rail check into the standard room-round for that day's techs. The polymorphic-task bloat that kills ServiceNow at scale never happens.
- **Category-reset #26 — Network-to-Physical Triage (reinvents OT Security).** Nuvolo / ServiceNow ingest Medigate/Ordr alerts and create an avalanche of security incident tickets. HubbleWave converges the digital + physical paths: (a) **AVA Convergence Routing** — when an OT alert fires (*"Infusion pump 4521 needs OS patch CVE-2026-1234"*), AVA cross-references the asset's physical maintenance schedule. If a PM is already scheduled for next Tuesday, AVA suggests *"Attach the patch-install step to the existing PM instead of dispatching a separate ticket today? Saves a trip, satisfies the SLA window."* OT Security Officer one-tap approves; the PM WO gets a new checklist step + the vulnerability ticket auto-closes-as-merged. (b) **Quarantine Lockout** — if a device is actively compromised (CVE with known exploit + observed-exfil signature), an automation rule fires an outbound API call to the NAC (Network Access Control — new adapter `nac-quarantine`) to drop the device from the network; simultaneously the asset's `status` flips to `quarantined` and the clinical mobile app surfaces a *"Do Not Use — Cybersecurity Quarantine"* banner over the asset. All actions chain into `signature_chains` for forensic audit. Powered by §3.6 regulated-action + §3.5 observations + the new `nac-quarantine` integration adapter.
- **Back-office reinvention #27 — Predictive TCO (Capital Planning that beats accounting ledgers).** Nuvolo / ServiceNow track financial lifecycle as static depreciation tables. HubbleWave makes TCO **live**: AVA continuously computes `replacement_urgency_score` (already in #17) AND a new `capital_replacement_request` recommendation. The deterministic rubric: cumulative repair cost ÷ replacement cost (with straight-line depreciation residual value as denominator), MTBF trend, downtime hours, warranty remaining, sentiment from close-out narratives. **Active intercept at parts-order time**: when a technician tries to order a $4,000 controller board for a 10-year-old ultrasound, AVA inspects the asset's residual value + recent repair spend; if repair-cost ÷ remaining-residual-value > customer-policy threshold (default 60%), the order dialog interrupts: *"This repair is $4,000; remaining residual value is $6,200 (TCO ratio 65%). Want me to generate a Capital Replacement Request to the Director instead?"* One tap → `capital_replacement_request` row + Maintenance Manager notification → forwards to Finance Director per #17 forwarding policy. ServiceNow's ledger never interrupts; HubbleWave makes the financial decision visible at the operational moment.
- **Back-office reinvention #28 — Autonomous JIT Procurement (parts you'll need next month, not parts that hit zero).** Nuvolo / ServiceNow reorder on min/max thresholds — purely reactive. HubbleWave is proactive: AVA reads the next 30-90 days of `pm_schedule` + historical break-fix consumption rates from `parts_consumption` + asset-class failure trends + supplier lead times. It drafts `procurement_proposal` records (essentially AVA-pre-filled `purchase_order` shopping carts grouped by vendor) and hands them to the Procurement Manager as *"Approve All / Edit / Skip"* on `<ProcurementProposalCart>`. The proposals carry full provenance — clicking a line item shows which PMs and historical failures drove the quantity. Each approval transitions the proposal into actual `purchase_order` rows with `source = ava_jit_proposal`. The "stock hit zero, emergency reorder, PM slipped" Nuvolo failure mode disappears.
- **Back-office reinvention #29 — AI-Enforced Vendor Invoice Reconciliation.** Vendors email PDF invoices; humans manually check that billed hours match WO time logs and rates match contracts. HubbleWave: vendor uses the §3.11 magic-link contractor portal to drop the PDF; new `vendor_invoice` collection (taskable) ingests it; AVA Document AI (canon §11) extracts billed-hours + line-items + rates; cross-references against (a) the WO's actual `time_on_site` (computed from `technician_presence` clock-in/out + GPS-fix-on-mobile when the magic-link was redeemed), (b) the structured `master_service_agreement` rates extracted at intake (per #23), (c) the WO's `parts_consumption` ledger. Any mismatch flags `invoice_discrepancy` and routes to `invoice_discrepancy_review` workflow before it reaches AP. AP sees only invoices that have already been reconciled or explicitly approved-with-variance — they stop being the bottleneck. Every check + every override is `signature_chains`-audited.
- **Back-office reinvention #30 — Fleet-as-Asset (the "asset is an asset" architecture proof).** Nuvolo / ServiceNow ship Fleet Management as a disconnected separate module with its own UI and data model. HubbleWave's answer: **vehicles are just `asset` rows with `asset_type = 'vehicle'` and a `telematics` capability binding to §3.5 observation streams**. New integration adapter `obd2-telematics-feed` ingests OBD2 + GPS telemetry into `observation_streams` (subject_collection_id=asset, subject_record_id=vehicle.id, stream_kind ∈ {engine_rpm, coolant_temp, mileage, gps_lat, gps_lon, fault_code}). All of maintenance-core's WO + PM + parts + dispatch + visualization views apply unchanged: a fire-rescue truck PM is the same WO type as an MRI PM. Mileage-based PM (oil change every 5000 mi) fires automatically via §3.3 scheduling utilization-triggered generation. Fault codes via OBD2 stream into `observations`; threshold-rule fires a reactive `maintenance_work_order` with the AVA-suggested fix (per #4 Predictive Parts Staging). Zero new tables, zero new UI patterns — proves the §17.5 customization-contract claim that the platform is universal.
- **Edge reinvention #31 — Semantic Recall Quarantine (FDA / ECRI recalls).** Nuvolo / ServiceNow do dumb text-matching against the asset registry; messy hospital data (typos, model-number variants, manufacturer rebrandings) means recalls miss matches and humans manually reconcile. HubbleWave: AVA reads the raw recall notice and uses **vector-search semantic similarity** (canon §11) against asset metadata; *"Philips Model X"* matches assets entered as "Philps Mod-X", "Phillips M-X", or "Philips MX-2026" with confidence scores. Confidence > 0.85 → auto-tag all matching assets with "Do Not Use — Active Recall" on the clinical mobile app + auto-generate `recall_response` taskable rows + auto-dispatch to biomed group; 0.70-0.85 → surface for biomed-engineer one-tap-confirm; below 0.70 → notification only. The 14 affected patient monitors that Nuvolo would miss are caught in seconds. Backed by existing `recall_response` (clinical overlay) + new `<SemanticRecallMatchBoard>` plugin.
- **Edge reinvention #32 — Graph-Native Reverse Calibration Traceability ("Analyzer Blast Radius").** A Fluke Analyzer goes out of tolerance during its own calibration check. Every patient monitor it touched in the last 6 months potentially has bad calibration. Nuvolo / ServiceNow report-builders make this nightmarish; HubbleWave's observation substrate makes it a one-click query. Every calibration event already writes an `inspection` row (clinical overlay regulated-action) AND an `observations` row (instrument + asset + reading + signed measurement). One click on the faulty Fluke's asset detail → AVA runs a graph traversal: *"Show me every asset where the inspection.calibration_instrument_id = this Fluke in the last 180 days."* Returns 500 patient monitors. Bulk action: suspend clinical status → `<DoNotUseBanner>` lights up on each asset in the mobile app → reactive `maintenance_work_order` (re-calibrate) auto-generated for each. Compliance officer's worst nightmare becomes a 30-second query. New plugin: `<AnalyzerBlastRadiusBoard>` in `ws_biomed_engineer`.
- **Edge reinvention #33 — AVA Auto-Commissioning (Capital Project Handover).** A construction contractor finishes a hospital wing and hands the facilities team a messy 5,000-row Excel: HVACs, doors, lights, infusion pumps. Nuvolo / ServiceNow customers spend 6 months on manual data entry. HubbleWave: facilities manager drag-drops the spreadsheet into `<AssetImportWizard>`; AVA (canon §11 document AI + the metadata vocabulary) normalizes naming conventions, categorizes assets to existing `asset_type` taxonomy, infers `location` mappings from column heuristics, structures everything into a draft `asset_import_batch` (taskable, lifecycle: ingested → normalized → reviewed → published). Facilities manager reviews on a structured grid + AVA explanations + per-row confidence; one-tap accept-all (or edit-then-accept) publishes all 5,000 assets in minutes. The 6-month commissioning lag disappears. New collection: `asset_import_batch`; new plugin: `<AssetImportWizard>`; new workflow: `asset_import_commissioning`.
- **Edge reinvention #34 — Joint Commission EoC Auditor Proof (extension of #14).** The Auditor Kiosk (`ws_auditor_kiosk` + §3.11 kiosk session) gets a Live Operational Canvas mode for the Joint Commission Environment-of-Care audit. Auditor taps any room on the Live Command Map; the workspace shows: every PM done in that room in the audit window, every inspection (including fire-doors, life-safety devices, sprinklers), with the **Merkle root hash** from `signature_chains` for each. Tap a fire-door → see the signed inspection row → see the Merkle proof binding it to the chain head → see the signer + reason code + signed payload. **Cryptographic proof, not screenshots of PDFs.** Zero prep time for the hospital director; un-fakeable evidence. ServiceNow / Nuvolo cannot show this because their audit data is a relational query, not a chain.
- **Edge reinvention #35 — Cryptographic Key Custody & Locksmithing.** Nuvolo / ServiceNow ship a simple `keys` table linking keys to employees and doors. Easily broken (key holder leaves, key not returned, no audit trail). HubbleWave treats physical keys as restricted assets with the full regulated-action ledger: (a) `key_record` (`(id, key_serial, key_class, parent_master_key_id, opens_locks[], status ∈ {unassigned, issued, returned, lost, decommissioned})`); (b) `key_assignment` (taskable + regulated — every issuance requires e-signature from the holder per §3.6; `signature_chain_id` binds the transfer of custody); (c) `unrecovered_key_flag` (taskable) auto-generated by automation rule when an employee's HR record transitions to `terminated` while they still hold open key assignments — flags every outstanding key with a recovery WO + notifies Security Officer. Master-key issuance requires additional supervisor co-sign. Audit query: *"Show me every master-key transfer this quarter, with signer identity + reason code"* runs in seconds. Plugin: `<KeyCustodyLedger>` in Facilities Manager + Compliance Officer workspaces.

**UI Builder dog-food showpiece (per founder's demo recommendation):** **Compose the dispatcher workspace entirely in UI Builder** using `<PivotKanban>` (#18) and `<LiveCommandMap>` (#21) as registered plugin components — the layout, routes, filters, and widget wiring are all UI Builder authoring; the underlying React components ship in `@hubblewave/maintenance-plugins`. Show the evaluation committee: (a) the workspace authored in UI Builder ships with the platform; (b) the customer can fork it, pivot it differently, and add their own widget without code; (c) at 60fps + sub-second pivots on 100k+ WOs, the demo proves the §3.2 task_projection thesis. ServiceNow's map is a heavy add-on; this is native + composed.

**Demo storyboard (RFP closing scene — chains marquees 1-9 into one 18-minute narrative):**

> A nurse on the overnight shift scans the QR code on infusion pump 4521 in Room 312, holds the button, says *"Screen is frozen and it keeps beeping,"* walks away (marquee #3). 7:14 AM: Maria, the on-shift biomed tech, sees the structured WO at the top of her workspace. She swipes-right-to-start (marquee #6). She walks to Room 312, snaps a photo of the pump's faded nameplate to confirm identity (marquee #8). The WO's patient context is masked — she presses Break Glass, selects "Emergency Repair" (marquee #5), sees *"Airborne Isolation — N95 Required, Room 312 — VRE precautions"* revealed for 10 minutes. She asks AVA *"Error E-42?"* AVA renders an inline 6-step troubleshooting checklist drawn from the pump's service manual (marquee #2). Step 4 calls for a controller board — the WO already shows "Part reserved in Bin B4" from when the WO was triaged at 4:00 AM (marquee #4). She walks to the stockroom, grabs the part, returns. She loses Wi-Fi entering the elevator — the app keeps working (marquee #9). She steps through the checklist using thumb-toggles (no precision tapping with gloves), taps the mic, says *"Replaced the controller board, recalibrated to 50 PSI, ran self-test, all good."* AVA renders the compliance close-out narrative + reason codes + parts log (marquee #7). Maria swipes-right-to-complete (marquee #6) and e-signs (canon §10 hash chain). **Total time: 18 minutes.** With ServiceNow + Nuvolo: 45+ minutes, two trips to the stockroom, one missed PHI flag, and a compliance officer's nightmare close-out note.

- **v1 predictive (honest, no fake ML).** Explainable risk scoring on every asset surfaced in the Maintenance Manager workspace. Factors: WO history (recent failures, recurring corrective work), observation thresholds (out-of-band readings on bound streams), simple anomaly detection (z-score on rolling rollups). Each score carries rule-level provenance — clicking the score shows the exact factors that contributed. No per-customer trained ML model in v1; the explainability is the differentiator vs Nuvolo's blank dashboard and ServiceNow's BigQuery offload pattern. Backed by §3.5 observations + maintenance-core's WO history.

### 5.2 Post-Showcase Enhancements (explicitly outside pilot acceptance)

These three enhancements are platform commitments but are NOT gated by pilot acceptance. They land on the post-G6 roadmap. None of them is required for the showcase pilot's category-defining demo; deferring them lets the showcase ship at G6 without scope creep:

- **Per-customer trained predictive maintenance ML models.** Pilot features (#4 Predictive Parts Staging, #16 Smart Sprint, #17 Repair-vs-Replace, v1 risk scoring) all ship as **deterministic + explainable rule-based scoring with provenance** — no trained ML required for the showcase. Trained ML refinement is post-G6 work that strictly improves accuracy on top of the same explainable substrate, via self-hosted Ollama for inference + single-tenant SageMaker (or equivalent) for training (multi-tenant managed ML services violate canon §5 instance isolation under PHI).
- **AI Code Assistant for end-customer plugin authoring.** Canon §11 commits to this; the implementation lands post-G6 after the maintenance pack proves the customization model. Customers in the showcase pilot get UI Builder authoring without code-assist.
- **Live UI Builder workspace authoring on mobile.** Web UI Builder is in the showcase; on-mobile authoring is post-G6 (web → publish → mobile refresh is sufficient for the showcase narrative).

### 5.3 Phase gates (~36-44 weeks, 8 gates)

Each gate ends with a working demo and a Go/No-Go decision. No giant final-integration crunch. G0 is split because shipping all 11 substrate sections in 6 weeks is not credible.

| Gate | Week | Acceptance demo |
|---|---:|---|
| **G0a** — Foundation substrate | 5 | §3.1 taskable + §3.3 scheduling + §3.4 list-scale framework + §3.5 observations base (pg_partman + ingest only, no rollups) + §3.6 regulated-action single-signature path + processed_events ledger + Redis Consumer Groups + idempotency scaffold; foundation CI scanners green. Demo: synthetic taskable collection installed → `generation_runs` idempotency holds under double-fire → observation ingest hits the pg_partman partition → single-signature flow extends the chain. |
| **G0b** — Advanced substrate | 11 | §3.2 task_projection (circuit breaker + tombstones + reconciliation), §3.6 Merkle batch, §3.7 mobile parity (UI primitives + Elevator Mode), §3.8 AVA UI synthesis, §3.9 public intake (hardened), §3.10 break-glass override, §3.11 external-collaborator session tokens, observation rollup jobs. Demo: 100k WO bulk-import → circuit breaker keeps list views responsive → Merkle batch of 50 signatures + replay attack rejected → kiosk session bound to a device → revoke is one-tap. |
| **G0c** — Shared substrate for marquees #23-35 | 17 | §3.12 Storage/Evidence Attachment Runtime + §3.13 Connector Runtime + certified simulators + §3.14 Semantic Search/Vector Match + §3.15 Spatial+Graph + §3.16 Financial Control + §3.17 Bulk Import Staging + §3.18 Integration Secrets + Egress Policy. Demo: pre-signed upload + AV-scan + object-lock works end-to-end; one connector adapter runs in both live + simulator modes with conformance proof; semantic match returns explainable confidence bands; floor-plan graph route-solves a 4-floor hospital fixture; three-way match + separation-of-duties enforces on a synthetic invoice; bulk import publishes 5,000 rows atomically; NAC adapter refuses to fire without dual-confirmation guardrails. |
| **G1** — maintenance-core core | 23 | Assets + WO + PM + checklists + technician mobile workspace live; AI marquee #1 (voice WO capture) demonstrable; v1 explainable risk scoring live in Maintenance Manager workspace; Compliance Officer workspace shows the platform audit chain. |
| **G2** — Three overlays + AI marquees 1-5 + Edge marquees #31 + #33 | 31 | Clinical + Facilities + OT Security overlays installable without collision; UDI lookup live; BACnet + Claroty + Medigate + Asimily live or certified-simulator; AI marquees #1-5 + edge marquees #31 (Semantic Recall) + #33 (Auto-Commissioning) demonstrable; three-overlays-installed CI test passes. |
| **G3** — Technician + Connected-network superpowers + Rounds + Calibration Blast Radius | 37 | #6-13 all live; Rounds dedicated mobile tab live (Batch Observation Sessions per #25); edge marquee #32 (Analyzer Blast Radius via §3.15 spatial-graph) live; all three overlays' OOTB workspaces author-able in UI Builder. |
| **G4** — Systemic + Contracts + Space + Capital + JIT Procurement + Invoice + Key Custody | 43 | #14-17 all live; #27 Capital Active Intercept live (via §3.16 financial control); #28 JIT Procurement live; #29 AI invoice reconciliation live; #35 Key Custody with co-sign live; expanded contracts + facilities space management live; 8th + 9th OOTB workspaces (Auditor, OT Security Officer) operating. |
| **G5** — WO-processing visualization views + Fleet + Joint Commission Merkle Proof | 47 | #18-22 all live at 60fps on demo dataset; #30 Fleet-as-Asset live (vehicles via §3.5 telematics; mileage-PM utilization-trigger); #34 Joint Commission Merkle Proof live (Auditor Kiosk shows signature_chains drilldown); UI Builder dog-food showpiece. |
| **G6** — Scale + on-site demo readiness | 50 | `apps/scale-rig` produces 3M assets / 20M WOs / **≤10B observations**; hot list views stay snapshot-backed under load; mobile selective-sync pulls < 1MB metadata/list payload for a single technician's day; perf baseline frozen in `docs/scale-baselines/v1.json`; on-site mobile field test in a hospital dead-zone / MRI-adjacent approved test area with intermittent connectivity passes; regulator-export rehearsal validates against HubbleWave attestation schema mapped to Part 11 controls + Joint Commission readiness rubric. **Demo to RFP committee at gate close.** |

Each gate is gated by: CI green, scanner self-tests green, the demo for that gate runs end-to-end without manual intervention, and a written gate-acceptance memo signed by the Maintenance Manager persona test-user (internal). Gate slip → re-baseline before continuing.

**Live-integration rule (binding for all integration-dependent gates):** Every integration adapter (HL7v2, FHIR R4, BACnet, Modbus, ECRI feed, FDA UDI, AutoCAD DWG, IFC, EHR vendor APIs) ships in **one of two modes** — *live* where customer credentials + sandbox environment are available, *certified simulator* otherwise. Simulator certifications declare conformance level (e.g. "HL7 v2.5.1 ADT-A08 covered; ORU-R01 covered; remaining segments stubbed"). Acceptance demos pass on simulator where live access is gated by vendor/customer access. This rule exists so the pilot does NOT block on access negotiations, only on engineering.

### 5.4 Personas Covered (the RFP voting matrix)

Every persona that votes on the RFP gets their own "wow" moment. No single feature has to please everyone — the design ensures coverage:

| Persona | Their pain today | Our wow moment |
|---|---|---|
| Nurse (floor staff) | Portal logins, 5 required fields, 3-minute ticket to report a broken pump | Walk-by intake (marquee #3): QR + voice + walk away |
| Technician (biomed, facilities) | Glove-unfriendly UI, dead-zone spinners, typing close-out notes on a phone | Glove-Mode swipe (#6) + Generative close-out (#7) + Dirty Nameplate (#8) + Elevator Mode (#9) |
| Junior technician / new hire | Asset hunting, lost institutional knowledge, getting lost in the building | Asset Pins (#11) + Floor-Plan Routing (#12) + Invisible Manual (#2) |
| Dispatcher | Manual ticket assignment, dead-walking, no schedule awareness | Smart Sprint batching (#16) |
| Maintenance Manager | KPIs locked behind report-builder | OOTB workspace + replacement-urgency board (#17) |
| Compliance Officer | Auditor panic, custom report-building | Auditor Kiosk (#14) + break-glass forensic log (#5) + LOTO mathematical evidence (#13) |
| Safety Officer | OSHA paper-binders, LOTO sequence enforcement | Smart LOTO with AVA Vision (#13) |
| External Contractor | Email-thread chaos, no platform visibility | Zero-Login Contractor Flow (#15) |
| Finance Director / CFO | Capital planning by gut-feeling, asset replacement decisions | Repair-vs-Replace score (#17) |
| IT Admin (RFP gatekeeper) | ServiceNow upgrade breakage, customization-vs-upgrade tension | Verified Pack Registry (§8 §17.5) + upgrade-safety validator + N=2 SDK stability (canon §25) |
| CISO / Privacy Officer | Static ACLs, PHI in WO notes locked away | Break-Glass PHI (#5) — dynamic, time-limited, audited |
| OT Security Officer | Medical-device vulns invisible to facilities team; manual Claroty/Medigate triage | `ws_ot_security_officer` workspace + `<OtAssetRiskMap>` + `<VulnerabilityTracker>` + Claroty/Medigate/Asimily live feeds + AVA Convergence Routing (#26) (§4.4 overlay) |
| Space Planner / Workplace Manager | Manual seat charts; double-booked rooms; move-day chaos | Live Operational Canvas (#24) + `<SpaceReservationCalendar>` + `<MoveRequestBoard>` + `<OccupancyHeatmap>` + Invisible Space Audits via Wi-Fi/BT beacon (§4.3 facilities) |
| Procurement Manager | Reactive PO firefighting; stock hits zero before reorder | Autonomous JIT Procurement (#28) — AVA-drafted `procurement_proposal` shopping carts with full provenance |
| Accounts Payable / Finance | Manual invoice-vs-WO reconciliation; vendor billing disputes | AI-Enforced Vendor Invoice Reconciliation (#29) — only pre-reconciled or explicitly variance-approved invoices reach AP |
| Capital Planner / Director | Capital-vs-repair decisions made on gut feel | Predictive TCO Active Intercept (#27) — repair-cost-over-residual-value triggers `capital_replacement_request` at the operational moment |
| Fleet Manager | Disconnected fleet module separate from facility CMMS | Fleet-as-Asset (#30) — vehicles ARE assets; OBD2 telematics feeds the same observation substrate; mileage-based PM via utilization-trigger; no separate fleet module |

Demo strategy: pitch the right feature to the right persona during the RFP meeting. Every voter gets one moment that says *"this is built for me."*

---

## 6. Full Showcase Build Decomposition

The work breakdown for the Full Showcase Pilot. Total: ~140-160 PRs over 50 weeks, aligned to the gates in §5.3. Phase durations sum to gate-week targets exactly.

- **Phase 0** (1 week, ~6 PRs): canon amendments, spec doc, plan-fix doc, Appendix D update, capability vocabulary doc, scanner ownership rules. **Prerequisite gate: W2 Stream 1 platform-blocker cleanup must be complete per §1.1.**
- **Phase 1a** (4 weeks, ~12 PRs) → **gate G0a (week 5)**: foundation substrate — §3.1 taskable + §3.3 scheduling + §3.4 list-scale + §3.5 observations base + §3.6 regulated-action single-signature + processed_events + Redis Consumer Groups + idempotency scaffold.
- **Phase 1b** (6 weeks, ~14 PRs) → **gate G0b (week 11)**: advanced substrate — §3.2 task_projection with circuit-breaker + tombstones + reconciliation + §3.6 Merkle batch + §3.7 mobile parity + §3.8 AVA UI synthesis + §3.9 public intake hardened + §3.10 break-glass + §3.11 external-collaborator sessions + observation rollup jobs.
- **Phase 1c** (6 weeks, ~16 PRs) → **gate G0c (week 17)**: shared substrate — §3.12 Storage/Evidence + §3.13 Connector Runtime + simulators + §3.14 Semantic Search/Vector + §3.15 Spatial+Graph + §3.16 Financial Control + §3.17 Bulk Import + §3.18 Integration Secrets + Egress Policy. These prevent the marquees #23-35 from inventing ad-hoc versions.
- **Phase 2** (6 weeks, ~22 PRs) → **gate G1 (week 17)**: full `maintenance-core` core slice (assets, WO, PM, checklists, technician workspace, Compliance Officer workspace, AI marquee #1).
- **Phase 2** (6 weeks, ~22 PRs) → **gate G1 (week 23)**: full `maintenance-core` core slice (assets, WO, PM, checklists, technician workspace, Compliance Officer workspace, AI marquee #1).
- **Phase 3** (8 weeks, ~24 PRs) → **gate G2 (week 31)**: full three overlays (Clinical, Facilities, OT Security) + AI marquees #2-5 + edge marquees #31 (Semantic Recall) + #33 (Auto-Commissioning); HL7v2 + FHIR + BACnet + Claroty + Medigate + Asimily wired (live or certified-simulator per §5.3 rule).
- **Phase 4** (6 weeks, ~18 PRs) → **gate G3 (week 37)**: Technician superpowers #6-9 + Connected-network #10-13 + Rounds dedicated mobile tab + edge marquee #32 (Analyzer Blast Radius).
- **Phase 5** (6 weeks, ~18 PRs) → **gate G4 (week 43)**: Systemic differentiators #14-17 + Auditor workspace + expanded contracts + facilities space management + back-office reinventions #27 (Capital) + #28 (JIT Procurement) + #29 (Invoice Reconciliation) + #35 (Key Custody).
- **Phase 6** (4 weeks, ~14 PRs) → **gate G5 (week 47)**: WO-processing visualization views #18-22 + #30 Fleet-as-Asset + #34 Joint Commission Merkle Proof + UI Builder dog-food showpiece.
- **Phase 7** (3 weeks, ~10 PRs) → **gate G6 (week 50)**: scale rig (3M assets / 20M WOs / ≤10B observations), three-overlays-installed test suite, workspace-leakage tests, mobile offline-conflict tests, attestation export validation, upgrade-validator extension tests, on-site mobile field test, perf baseline freeze. **Demo to RFP committee at gate close.**

Sum: 1 + 4 + 6 + 6 + 6 + 8 + 6 + 6 + 4 + 3 = 50 weeks. Per-gate slip budget (§11.1 q1) absorbs the remaining headroom.

Post-Showcase Enhancements (§5.2 — per-customer trained ML, AI Code Assistant for end-customer plugin authoring, live UI Builder workspace authoring on mobile) are NOT in this decomposition.

---

## 7. Risk Register (HIGH only — full list in spec doc)

| Risk | Severity | Mitigation |
|---|---:|---|
| `task_projection` lag under burst load (200k-WO import saturates queue) | HIGH | (a) Bulk-import bypass writes projection rows in source transaction via explicit service-boundary allowlist; (b) Redis Consumer Groups distribute the fan-out across N worker pods (§19 amendment); (c) **circuit-breaker on list views** — at lag > 30s serve stale + "Syncing…" banner, NEVER fallback to source-table queries (thundering herd); single-record fetches retain source fallback. |
| Workspace leakage between Clinical + Facilities overlays installed together | HIGH | Pack manifest declares `owned_collections` + `references_collections` separately; upgrade validator extension checks every workspace view binding against installing pack's `owned + references` set; CI tests both overlays installed simultaneously. |
| 21 CFR Part 11 e-signature replay attack | HIGH | `signature_chains.this_hash` computed over `(record_id, action_code, signed_payload_hash, prev_hash)` — replay impossible. Merkle batch root (§3.6) inherits the same property: each leaf hash binds to record+action, and the proof binds the leaf to the root. Explicit replay attack tests in compliance integration suite cover both single-action and batch-via-Merkle paths. |
| Public intake endpoint as attack surface (§3.9 — QR token leak, abuse, payload injection) | HIGH | Signed tokens via KMS (kid per instance); bound to specific record (leaked QR for asset A cannot submit against asset B); per-token + per-IP rate limit; max-payload size; AV scan on attachments; gitleaks scan on free text; endpoint never returns operational data; rate-limit breach + scan-fail emit `RuntimeAnomaly` rows for ops alerts. Pack manifest declares per-purpose schemas — payload that fails schema rejected with structured error. |
| Break-glass field-override abuse (§3.10 — unauthorized unmask of PHI) | HIGH | Eligibility role-bound at the §28 level; reason code REQUIRED (selected from per-pack vocabulary, not free-text); every grant emits signature_chains row chained to actor's session; Compliance Officer workspace surfaces a forensic log every grant; auto-revoke at `granted_until`; quarterly auditor query rehearsals built into v1 verification. |
| NAC quarantine false positive (§3.18 + #26) causing clinical-operations impact | HIGH | Dual-confirmation required (Security Officer + Maintenance Manager); customer-policy override flag; criticality precheck refuses quarantine on life-support assets without explicit override; per-customer kill switch + automatic rollback within N seconds if downstream telemetry shows clinical-state impact; signature_chains-audited; every fire recorded with the precheck evidence row. |
| Technician/occupancy/location tracking labor + privacy challenge (§3.5 + #10 + #24) | HIGH | Opt-in per individual with documented retention; "Go Invisible" toggle; aggregated room-level only for occupancy (5-min buckets, never per-individual); customer-admin policy disclosed at onboarding; per-jurisdiction policy variants (US right-to-work vs EU GDPR vs union-CBA defaults); legal review gate before deployment to a customer in a jurisdiction not previously cleared. |
| Auto-commissioning (#33) publishing bad asset/location data at scale | HIGH | AVA confidence threshold per row + reviewer grid; bulk publish runs in a single DB transaction with rollback affordance for 24h; pack manifest declares per-collection minimum-confidence-for-auto-accept thresholds (default very high); orphan-location detector (asset references location not in the registry) blocks publish until resolved. |
| Semantic recall false negatives (#31) — FDA/ECRI notice misses an affected asset | HIGH | Layered match: vector semantic match (high recall, lower precision) PLUS lexical fuzzy match PLUS manufacturer-ID join; confidence < 0.70 still surfaces for biomed-engineer one-tap-confirm rather than silent miss; weekly QA replay of last quarter's ECRI feed against a known-truth corpus; FDA-recall miss is a P0 incident with named post-mortem owner. |
| Vendor invoice / payment fraud via #29 contractor portal or document extraction | HIGH | Three-way match (§3.16 financial control) enforced by separation-of-duties; AVA-extracted amounts cross-checked against `master_service_agreement` rates extracted at intake; contractor portal sessions tied to magic-link single-use consumption; high-variance invoices route to human Accounts Payable review with reason codes; AVA never auto-approves over a customer-configurable amount threshold. |
| Procurement approval abuse / AVA over-ordering (#28) | HIGH | `procurement_proposal` is always advisory; never auto-converts to `purchase_order` without Procurement Manager approval; separation-of-duties enforced (proposer ≠ approver above threshold); per-period budget envelope check (§3.16 budget_envelope) blocks proposals that would breach budget; weekly AVA-vs-actual consumption variance analysis surfaces overordering patterns for review. |
| 10B-observation vanilla Postgres operational ceiling | HIGH | G6 scale rig caps at ≤10B observations to stay within vanilla-PG + pg_partman comfort; TimescaleDB adoption gate triggered automatically when a customer's projected volume crosses 8B (early warning at 80% of fork point); migration runbook + customer-onboarding pre-flight check published; per-instance partition-steward observability surfaces hot-partition lag before it becomes a query-killer. |
| OT advisory / vulnerability feed poisoning (#26, #31) | HIGH | Feed-provider TLS cert pinning + signed-advisory verification where the provider supports it (FDA UDI, ECRI, vendor-specific manufacturer feeds); anomaly detection on advisory ingest (sudden volume spike, unusual severity distribution); ingest stages to `security_advisory` with `status = quarantined_pending_review` for any feed-poisoning indicator; OT Security Officer must explicitly approve before mitigation actions cascade. |
| Mobile offline regulated signature ambiguity (#7 + #9 + #13 + §3.6 + §3.7) | HIGH | Mobile-captured signatures buffered locally with a unique `intent_id`; on sync, the server re-authenticates the user via session re-bind + verifies the signed payload hasn't changed since offline capture; if re-auth fails (session-stamp bump per canon §29.6 happened while offline), the signature is rejected and the action requires re-sign with current session; UI clearly indicates "offline-pending" vs "signed-and-synced" state. |

Twenty-four additional MED-severity risks (TimescaleDB fork-point management; mobile conflict policy; 7-year archive query; pack version coordination; FormDefinition portability; projection authz on rule edits; per-customer ML training infrastructure — post-showcase only; AVA UI synthesis correctness; predictive parts staging accuracy; **rollup-job lag + backfill correctness** — scheduled SQL upsert jobs must catch up correctly after partition rollover or worker outage; pg_partman partition-steward correctness (orphaned partitions, mis-aligned retention windows); SwipeProgressCard cross-platform parity; AVA Vision OCR accuracy on scratched/dirty nameplates; Generative close-out reason-code accuracy; technician presence privacy; asset-pin moderation + abuse; floor-plan routing graph correctness; Smart LOTO vision-failure handling; kiosk session token leak; magic-link contractor token misuse; Smart Sprint optimization edge cases; replacement-urgency score correctness; Live Command Map technician-tracking accuracy; Pivot-Kanban macro side-effects; Triage Deck keyboard-shortcut hijack) and two LOW (scale rig location, AI false-positive WO storms) tracked in the spec doc.

---

## 8. Canon Amendments Required (Phase 0)

| Section | Change | New/Update |
|---|---|---|
| §13 | Extend upgrade validator: verify taskable collections still satisfy `taskable_required_fields`; mobile-syncable forms still web+mobile-renderable; no orphaned `audit_log_id` in `signature_chains`. | Update |
| §17 | Add `maintenance-core`, `clinical-maintenance`, `facilities-maintenance`, **`ot-security-maintenance`** to monolith inventory as HubbleWave-owned PACKS (not modules). List new platform API modules: `capabilities`, `compliance`, `observations`, `mobile`, `scheduling`, `projections`, `intake`. **No `maintenance` API module** — maintenance is a pack, not platform code; this is load-bearing for the §17.5 customization-contract story. | Update |
| §17.5 | HubbleWave-owned packs follow the same upgrade-safety + versioning contract as customer packs. No platform-pack admin bypass. **Introduce a Verified Pack Registry**: HubbleWave-owned packs (and customer-trusted partner packs) install via the standard pack-install pipeline but with a cryptographic signature check against the registry's signing key; prevents customer packs from hijacking platform-reserved namespaces like `maintenance-core`. | Update |
| §19 NEW (UPDATE) | **Horizontal worker scaling.** `apps/worker` runs as multiple pods per instance, consuming `instance_event_outbox`, `obs.ingest`, and projection-rebuild queues via **Redis Consumer Groups (at-least-once delivery)**. Workers achieve **effectively-once processing** through idempotency: every outbox event has a unique `event_id`; a `processed_events` ledger gates each apply; mutations are idempotent UPSERTs or use unique generation keys (`generation_runs.idempotency_key`); tombstones are retry-safe. Redis Streams' XACK + claim-timeout reassigns in-flight messages on pod death without loss. Pool sizing per-instance configurable. SPOF eliminated. | Update |
| §21 | Extend service-boundary scanner ownership rules for every new table (`taskable_*`, `task_projection*`, `observations.*`, `compliance.*`, `mobile_sync_*`, scheduling tables). | Update |
| §30 NEW | **Capability Contracts.** Domain collections opt into platform capabilities declaratively via metadata. Each capability has a required-fields contract; validator refuses publish when missing. Capabilities never imply table inheritance — composition over projection. | New |
| §31 NEW | **Time-Series Observations.** Dedicated `observations` schema using Postgres declarative partitioning with **pg_partman (auto-managed partitions) adopted Day-1**. Rollups in explicit purpose-built tables (`observation_rollups_hourly/daily/weekly`) refreshed by **scheduled SQL upsert jobs**; aggregation math runs in Postgres, the worker only issues the statement and observes lag. **pg_ivm rejected for v1** — its base tables must be non-partitioned and its immediate-maintenance degrades under high-volume writes. TimescaleDB remains a deferred escape valve for >10B observations/instance. Node-side rollup computation rejected outright. | New |
| §32 NEW | **Regulated-Action Primitives.** E-signature, reason codes, immutable evidence artifacts, signature_chains ledger parallel to audit_logs chain. Hash chains + Merkle roots are **evidence mechanics**, not Part 11 compliance by themselves. §32 commits to the full Part 11 envelope: validation evidence (IQ/OQ/PQ change-control export), authority checks (§28 + §29.6 at sign-time), operational checks (sequence enforcement), 7-year audit retention (§34 archive partitions), record copy/export (single attestation file per record), signer identity binding (re-auth per signature meaning), meaning of signature (enum-valued), reason codes (codified vocabulary, never free-text), controlled-session rules (idle timeout, re-auth-on-resume). Merkle batch leaf MUST bind `(signer, timestamp, action, record, reason, meaning, payload_hash)`; non-Merkle batched signature_chains inserts forbidden. | New |
| §33 NEW | **Mobile Runtime Parity + Field-Tool Primitives.** Pack-shipped FormDefinitions and WorkspacePages render semantically equivalent on web and mobile via `@hubblewave/ui-primitives` vocabulary only. Vocabulary includes field-tool primitives (`SwipeProgressCard`, `ThumbToggle`, `LargeActionButton`, `NameplateCamera`) designed for the technician's physical reality (gloves, ladders, dim/dirty nameplates, intermittent Wi-Fi). **"Elevator Mode" UX contract:** mobile app never blocks on network state; every action locally optimistic with <16ms UI response; WatermelonDB stores local state; background sync silent. Customer forms may use web-only primitives but flagged `web_only` and excluded from mobile sync. | New |
| §34 NEW | **List-Scale Primitives.** Hot list views backed by materialized snapshots or projection rows; runtime list endpoint may not scan partitioned domain tables >1M rows. Active/archive partitioning policy-driven per collection. Archived data queryable via explicit facade with audit-logged access. | New |
| §35 NEW | **Scheduling Primitives.** Recurrence, suppression windows, blackout calendars, shift calendars as platform primitives. Generation jobs emitting domain records must record idempotency key; unique constraint is the correctness guarantee (not check-then-write). | New |
| §11 (extension) | **AVA Runtime UI Synthesis.** AVA may emit transient `FormDefinition` JSON that renders via `@hubblewave/ui-primitives` without persisting to metadata. Synthesis passes the same validator as pack-shipped forms — vocabulary-restricted, no escape hatches. Every synthesis logs an `AVAProposal` row for canon §12 trust progression. Refused synthesis returns a structured error, never a runtime exception. | Update |
| §28.10 NEW | **Break-Glass Field Override (eligibility-gated, hard-deny enforced).** Time-bound, audited unmask of §28 field masking. PropertyDefinition gains `break_glass_eligible boolean` and `confidentiality_class varchar(64)` ∈ `{public, internal, sensitive, never_reveal, legal_hold, sealed_investigation, system_secret, unrelated_patient_context}`. §28.5 evaluator runs three stages in order: (1) **hard-deny check** — confidentiality_class in {never_reveal, legal_hold, sealed_investigation, system_secret, unrelated_patient_context} → DENY unconditionally, no grant overrides; (2) **active-grant check** — only on `break_glass_eligible = true` properties; (3) **normal masking** otherwise. Validator refuses publish when `break_glass_eligible = true` AND class is hard-deny (mutually exclusive). Auto-revoke at `granted_until`. Every grant emits signature_chains + audit_logs rows transactionally. | New |
| §36 NEW | **Public Intake Endpoints (hardened).** Signed-token scoped unauthenticated POST endpoints with per-record binding. Hard contract: endpoint **never returns operational data**, only a submission code. Per-asset revoke + quarantine in one tap. Token rotation option per pack-manifest (lifetime or cadence-rotated). Replay idempotency via client-generated submission UUID. Rate limits + payload bounds + AV scan + secret scan + geo-anomaly detection are platform defaults; all failures emit `RuntimeAnomaly` + page-on-call. Pack manifest declares per-purpose payload schemas under `public_intake.schemas[]`. Submissions route through AVA pipeline using a system-principal scoped to the intake purpose. | New |
| §29.11 NEW (extension) | **External-Collaborator Session Tokens.** Two complementary patterns for non-account-holding external users: (a) **kiosk sessions** — read-only, time-bound, device-fingerprint-bound JWTs (aud=`kiosk`); (b) **magic-link collaborator invitations** — single-use SMS/email-delivered tokens scoped to one record + narrow permitted-actions (aud=`collaborator`). Both KMS-signed per canon §29.1. JwtAuthGuard branches on audience to build `KioskRequestContext` / `CollaboratorRequestContext` (extensions to RequestContext discriminated union). Token issuance + redemption + revoke recorded in `audit_logs` AND `signature_chains` jointly. | New |
| §38 NEW | **Storage & Evidence Attachment Runtime.** Pre-signed upload pipeline + immutable storage with S3 object-lock + scanning (AV, secret, PII) + retention (`retention_until` + `legal_hold`) + content-hash + version_id. Packs request uploads via `requestUpload(purpose, scope)`; never touch storage tables. Clean attachments transition to linked `evidence_artifacts` (§3.6). | New |
| §39 NEW | **Connector Runtime + Certified Simulators.** All integration adapters declare against the `IntegrationAdapter` SDK interface and ship in both live + simulator modes with conformance declarations + fixture-replay test history. Pack manifests declare `integrations[]` with minimum-conformance-version requirements; install refuses on incompatible adapters. The §5.3 live-or-simulator rule is enforceable because conformance is verifiable. | New |
| §40 NEW | **Semantic Search / Vector Match.** Platform pgvector embedding index over pack-declared text fields (`PropertyDefinition.vector_indexed = true`). `semanticMatch(query, collectionId, options)` returns ranked candidates with confidence bands (high > 0.85, med 0.70-0.85, low < 0.70) + explainable factors. Per-instance embedding-model registry supports rotation. | New |
| §41 NEW | **Spatial + Relationship Graph.** Generic graph store + traversal API. `traverse(start, edge_filter, depth_limit)` for BFS/DFS; `routeSolve(graph_id, from, to, weighting)` for floor-plan nav; `blastRadius(start, edge_kind, depth, time_window)` for #32 reverse-traceability. Pack-publish validator checks orphan nodes + cycle rules. | New |
| §42 NEW | **Financial Control.** Approval limits + separation-of-duties + three-way match + variance reason codes + budget envelopes. The `transaction_approval` taskable workflow enforces requester ≠ approver above threshold. Three-way match (PO + Invoice + Receipt) is platform-level; packs supply line-item logic but cannot bypass the match. | New |
| §43 NEW | **Bulk Import / Commissioning Staging.** Generic `import_batch` + `import_row` + `import_review_session` substrate. Atomic publish in a single DB transaction with 24h rollback affordance. Packs (incl. #33 Auto-Commissioning) consume this — they do NOT ship their own bulk-import collections. | New |
| §44 NEW | **Integration Secrets + Egress Policy.** Per-instance KMS-encrypted secrets vault (`integration_secret`) + outbound deny-by-default with explicit `egress_allowlist_entry` per adapter + per-adapter kill switch + every outbound call logged. NAC quarantine actions (#26) require dual-confirmation + customer-policy override + asset-criticality precheck — refuse to fire without all three. | New |

---

## 9. Critical Files

Five load-bearing files for the entire build:

- `C:\Dev\HW-Platform\HW Platform\CLAUDE.md` — canon amendments (extension §11, §13, §17, §17.5, §19, §21, §28.10, §29.11, new §30, §31, §32, §33, §34, §35, §36).
- `C:\Dev\HW-Platform\HW Platform\libs\instance-db\src\lib\entities\index.ts` — per-area re-exports (lines 23-30) and `instanceEntities` array (lines 261-528). Every new entity registers here.
- `C:\Dev\HW-Platform\HW Platform\libs\packs\src\lib\manifest.ts` — manifest schema (lines 36-65); extend with `provides_capabilities`, `requires_capabilities`, `capability_bindings`, `task_projection.attrs[]` (projection schema gate per §3.2), `public_intake.schemas[]` (intake payload schema per §3.9), and `pivot_kanban.column_transitions[]` (macro binding per §11.1 q19).
- `C:\Dev\HW-Platform\HW Platform\apps\api\src\app\metadata\packs\packs.service.ts` — pack install/upgrade entry points (`installPack` at :111).
- `C:\Dev\HW-Platform\HW Platform\tools\service-boundary-check.ts` — ownership rules for every new table.

Existing primitives reused (no reinvention):

- `libs\instance-db\src\lib\entities\sla.entity.ts:46` (BusinessHours), `:101` (SLADefinition), `:183` (SLAInstance), `:336` (StateMachineDefinition) — taskable foundation.
- `libs\instance-db\src\lib\entities\automation.entity.ts:52` (AutomationRule), `:222` (ScheduledJob) — PM orchestration.
- `libs\instance-db\src\lib\entities\workspace.entity.ts:33` (WorkspaceDefinition), `:135` (WorkspacePage), `:201` (WorkspaceVariant) — 9 OOTB workspaces (Technician mobile-first, Dispatcher, Maintenance Manager, Biomed Engineer, Facilities Manager, Compliance Officer, FCA Inspector, Auditor Kiosk, OT Security Officer).
- `libs\instance-db\src\lib\entities\app-builder.entity.ts:678` (SensorReading) — to be REPLACED (greenfield, not extended) by new `observations` schema per §31.
- `libs\instance-db\src\lib\audit\with-audit.ts:63` — pattern that `signature_chains` writer follows for Plan Fix 41 linearization.

New area files:

- `libs\instance-db\src\lib\entities\capabilities.entity.ts`
- `libs\instance-db\src\lib\entities\compliance.entity.ts`
- `libs\instance-db\src\lib\entities\observations.entity.ts`
- `libs\instance-db\src\lib\entities\scheduling.entity.ts`
- `libs\instance-db\src\lib\entities\mobile.entity.ts`

Worker process additions (`apps\worker\src\`). **Note:** `apps/worker` runs as multiple horizontally-scaled pods per instance (per §8 §19 amendment), consuming queues via Redis Consumer Groups for safe concurrent delivery.

- `projections\task-projection\` — `TaskProjectionConsumer` (one-per-pod via Consumer Group; partitioned consumption by `task_kind`)
- `scheduling\generation.service.ts` — generic generation dispatcher (consumes scheduled rules via the platform automation engine and writes idempotent rows to `generation_runs`; maintenance-core's PM rules feed it but the service has no maintenance coupling)
- `observations\adapters\` + `observations\ingest.service.ts` — sensor ingest pipeline (batched COPY writes; aggregation handled by `rollup.service.ts` via scheduled SQL upsert jobs against the explicit rollup tables — no pg_ivm, no Node-side math)
- `observations\rollup.service.ts` — schedules SQL upsert jobs against the explicit rollup tables (`observation_rollups_hourly/daily/weekly`); each job is a parameterized `INSERT ... ON CONFLICT DO UPDATE` whose aggregation runs entirely in Postgres; the service observes refresh lag and alerts when behind. pg_ivm is NOT used (see §3.5 decision); Node-side rollup math is rejected.
- `archive\partition-steward.job.ts` — active/archive transitions (uses pg_partman primitives where applicable)

---

## 10. Verification Plan

Each substrate addition has self-test scope. Each pack has integration-test scope. The pilot has a customer-facing acceptance scope.

### 10.1 Substrate (Phase 1 acceptance)
- **taskable capability:** Metadata validator self-test — opt-in a synthetic collection missing `state` field → publish must fail with structured error. Self-test grows to ≥10 assertions.
- **task_projection:** Insert 100k WOs across 3 task_kinds → projection lag stays < 1s p95 under normal load. Bucket-hash authz pre-filter matches a hand-computed expected row set on 5 ACL test fixtures.
- **task_projection circuit-breaker (edge case).** Simulate 200k WO bulk-import. Expect: active UI shows "Syncing…" banner; **zero source-table fallback queries on list endpoints** (verified via DB query log); single-record fetches continue to work via source fallback. Confirms no thundering-herd failure mode.
- **task_projection reconciler (edge case for scale rig).** With 20M-WO DB, run reconciler on cold partitions; verify it uses `ACCESS SHARE` lock only (never blocks active partition writes); produces correct diff in < 1 hour for one partition pair.
- **scheduling:** Generator self-test — schedule + subject record + suppression window → exactly one record generated; second worker scoop fails the `idempotency_key` unique constraint and is logged as `RuntimeAnomaly`. RRULE parsing self-test ≥15 assertions.
- **observations:** Ingest 1M readings across 10 streams via worker batches; verify pg_partman creates next month's partition automatically; explicit rollup tables (`observation_rollups_hourly/daily/weekly`) reflect new readings within the scheduled-job interval (default 5 min for hourly, 1 hour for daily); rollup values match a hand-computed `min/max/avg/p95`; rollup-refresh lag observable via `task_projection_lag`-equivalent operational table.
- **regulated-action (single + Merkle batch):** Replay attack on single signature → rejected. Merkle batch of 50 signatures → one root row in `signature_chains`, 50 leaf records with valid Merkle proofs binding `(signer, timestamp, action, record, reason, meaning, payload_hash)`; tampering with one leaf invalidates its proof; replay of the entire batch root → rejected. Audit chain + signature chain both extend correctly. Compliance attestation export validates against the **HubbleWave attestation schema mapped to Part 11 controls** for both flows.
- **mobile parity:** Same FormDefinition JSON renders **semantically equivalent** on web (Storybook) and mobile (Detox snapshot — semantic-tree equivalence, not pixel diff) for the 9 primitive components. End-to-end demo: edit a workspace via web UI Builder → publish → mobile workspace refresh shows the change within one pull cycle.
- **mobile sync conflict (edge case).** Technician A and Technician B both go offline and complete the same `checklist_instance` task; both come online. Verify the per-collection conflict policy resolves correctly: last-write-wins on completion fields (latest answer / photo / note); server-wins on header fields (assigned_to, state); ambiguous cases queued in `mobile_sync_conflicts` for Compliance Officer review. WO state never enters an inconsistent state during resolution.
- **horizontal worker (edge case).** Spin up 3 worker pods consuming the same projection queue via Redis Consumer Group; produce 10k outbox events; verify **at-least-once delivery + effectively-once processing**: zero duplicate effects in the projection table despite injected duplicate deliveries (Redis Stream replay simulating XACK loss). Each duplicate hits the `processed_events` ledger and no-ops. Roughly equal load distribution across pods. Killing one pod mid-batch → remaining pods absorb in-flight messages via XCLAIM within the Consumer Group claim timeout (default 30s); reclaimed messages re-process idempotently with no duplicate effects.
- **AVA UI synthesis (Invisible Manual marquee).** AVA ingests a sample Baxter Sigma Spectrum manual PDF via document AI; technician asks "Error Code E-42"; AVA synthesizes a 6-step troubleshooting checklist; validator accepts (only `@hubblewave/ui-primitives` vocabulary used); checklist renders semantically equivalent on web Storybook + RN Detox; each step completion writes to `AVAProposal` row. Synthesis of a payload with forbidden component (e.g., raw HTML escape) → validator rejects with structured error; no runtime exception.
- **Public intake (Walk-by marquee).** QR scan → unauthenticated POST with JSON body (≤50KB) + attachment upload to pre-signed S3 URL (audio ≤25MB, AV + secret-scan + quarantine before AVA reads) → AVA structuring → WO created with biomed-routed assignment within 5s; rate limit kicks in at 10 submissions/min per token; JSON payload >50KB rejected; attachment scan failure → attachment quarantined + anomaly alert; malformed audio rejected with structured error; replay of same client-generated submission UUID is idempotent (returns same submission code, no duplicate WOs); token revoke flips immediate (next submission rejected with 401); per-asset quarantine prevents future issuance. Endpoint never returns operational data — only a submission code. Forensic query returns the submission with structured + raw payload + AVA proposal lineage.
- **Predictive parts staging.** WO created with known asset + error category → AVA proposes correct part for 80%+ of seeded historical scenarios → reservation creates `parts_requisition` row + push notification delivered to stockroom workstation within 2s of WO creation → technician's mobile view shows "Part reserved in Bin B4" inside their existing session. If part unavailable, AVA flags reorder with cross-ref alternate. Stockroom can override AVA reservation (regulated-action: reason code required, logged).
- **Break-glass PHI (marquee).** Tech with biomed-grade role presses Break Glass on a clinical WO; reason code dropdown enforced; on confirm, `field_unmask_grants` row inserted + `signature_chains` row chained + `audit_logs` row written, all in one transaction; field reveals on the WO for 10 minutes (configurable per asset class). At t=10min: worker auto-revokes, field re-masks on next render, audit row written. Forensic query: "every break-glass on this patient in last 90 days" returns the action with full provenance. **Negative tests:** (a) Tech without role pressing Break Glass → 403 with explainability (which role is required). (b) Tech with role pressing Break Glass on a property with `break_glass_eligible = false` → 403 with structured error "Property is not break-glass-eligible" — grant NOT written. (c) Tech with role pressing Break Glass on a property with `confidentiality_class = sealed_investigation` (hard-deny class) → 403 with structured error "Property is hard-denied; no grant possible" regardless of role; grant NOT written; audit row records the rejected attempt. (d) Same negative test for `confidentiality_class = unrelated_patient_context`. (e) Validator refuses publish of a property that sets `break_glass_eligible = true` AND `confidentiality_class = legal_hold` (mutually exclusive per §3.10).
- **Glove-Mode swipe UX (technician superpower).** Golden tests: `<SwipeProgressCard>` swipe-right invokes the same state-transition action on web (drag-right) and mobile (swipe-right); Detox + Playwright assertions verify both render identical state changes; `<ThumbToggle>` tap zone measures ≥ 44dp on web and ≥ 64dp on mobile per accessibility minimum. Visual regression captures gesture affordances.
- **Generative close-out (technician superpower).** Tech voice input on mobile → AVA produces structured close-out (resolution narrative + reason codes + parts log) → renders in mobile review pane → tech swipes-right-to-approve → e-signature row in `signature_chains`. Golden-test corpus: 50 representative voice inputs per overlay (clinical, facilities), AVA-generated reason codes must match the human-labeled gold set ≥ 95%. Failures route to AVA Code Assistant retraining backlog.
- **Dirty Nameplate Vision (technician superpower).** Test corpus: 100 nameplate photos (clean, scratched, dim, partially-occluded) with known asset ground truth. AVA Vision must return correct asset at confidence > 90% on ≥ 80% of photos; surface candidate list at 70-90% confidence on the remaining gradients; fall back to barcode/manual below 70%. False positives (high-confidence wrong asset) must be 0 in the corpus — this is a clinical safety boundary, not a quality target.
- **Elevator Mode (technician superpower).** Mobile app in simulated airplane-mode end-to-end: open WO, swipe-progress through states, complete checklist with thumb-toggles, capture nameplate photo, voice close-out, e-sign. Every step UI-responds in <16ms (measured via React DevTools profiler). On reconnect, sync replays all changes in order; conflict resolution per §3.7 policy; no data loss verified by post-sync DB query matching the offline-captured intent log.
- **P2P parts locator (connected-network).** Seed 3 technicians with cart stock of part X; one tech opens WO and taps "Find Part"; AVA returns ranked list including stockroom + 2 peer holders ordered by proximity; tap-ping creates in-app notification on holder's phone; accept → `parts_requisition` row with `source = peer_transfer`; decline → next candidate. Privacy: technician with `technician_presence.available_for_assist = false` does NOT appear in results. Audit: every ping + accept/decline logged in `audit_logs`.
- **Tribal-knowledge asset pins (connected-network).** Voice note on asset → AVA transcribes + indexes; junior tech opens same asset later → AVA proactive notification surfaces the pin within 500ms of asset detail render; tap plays voice + shows transcript; downvote removes from proactive surfacing for that user; moderation flag routes to Maintenance Manager workspace for review.
- **Floor-plan routing (connected-network).** Test corpus: 20 WO/location pairs in a synthetic hospital CAD/IFC dataset. `<FloorPlanRouter>` returns highlighted path for 95%+ of pairs within 2s; offline-cached for the technician's assigned wing; graph-validation pass at pack-install detects orphan nodes (door with no connected corridor) and refuses publish.
- **Smart LOTO vision verification (connected-network + regulated).** `permit_to_work` carries a customer-defined energy-control procedure under OSHA 1910.147 (5-step example used in this verification); `<LotoStepRunner>` enforces order; each step requires photo + AVA Vision verdict; vision-confidence < 70% → step blocked with structured error (never auto-advanced); 70-90% → tech asked to retake or attest; > 90% → step accepted, `loto_step_check` written, `signature_chains` extended. Full sequence completion writes a "Procedure Complete" signature; auditor can replay every lock photo + every verdict on demand.
- **Auditor Kiosk session (systemic differentiator).** Compliance Officer creates a kiosk session bound to a device fingerprint; auditor's iPad lands on `ws_auditor_kiosk`; every API call carries `aud='kiosk'`; ANY write attempt (POST/PUT/DELETE) returns 403 with structured "kiosk audience is read-only" regardless of role; revoke-in-one-tap kills the session immediately; expired session 401s with "Audit session ended"; full provenance in `audit_logs` + `signature_chains` of who issued, who used (device fingerprint), what was viewed.
- **Zero-login contractor flow (systemic differentiator).** Magic-link issued for one WO with `permitted_actions=['view','attach_photo','add_notes','sign_closeout']`; contractor receives SMS, taps, lands on `<ContractorPortal>`; can view + photo + note + sign; cannot navigate to other WOs (URL hacks → 403); single-use consumption stamps `consumed_at` on first redemption; subsequent attempt → 401 with "Link already used"; full audit trail of every action.
- **Smart Sprint batching (systemic differentiator).** Seed 12 WOs across 4 floors + 6 PMs due in next 14 days; AVA proposes 3 Sprints for 3 dispatchers; verify each Sprint maximizes floor-locality and pulls in 1-2 PMs that share a floor; dispatcher can edit/decline; approved Sprint creates `dispatch_assignment` rows; Sprint never auto-applied without dispatcher confirm.
- **Replacement-urgency score (systemic differentiator).** Seed 50 assets with varying repair-cost / downtime / sentiment profiles; AVA produces ranked urgency scores; top 5 match human-judged "obvious replace" set; each score's provenance card shows the underlying numbers + 3 quoted close-out narratives that drove the sentiment. Maintenance Manager sign-off required before score forwards to Finance dashboard.
- **Pivot-Kanban (visualization #18).** Seed 1000 WOs across 3 floors × 4 skill categories × 5 states. Pivot the board through all 5 column groupings (state, floor, skill, asset-category, priority); each pivot returns rendered DOM within 200ms on the demo dataset. Drag a WO from "Plumbing" to "Electrical" → AVA macro fires; WO re-assigned to electrician; categorization updated; audit row written; UI reflects within projection lag.
- **Dual-Axis Timeline (visualization #19).** Seed 20 technicians + 15 critical assets with realistic shift + downtime-window data; load 30 PMs into the timeline. Drag a PM block across the canvas; AVA highlights valid green intersections within 100ms of drag-event; snap-on-release writes `dispatch_assignment` row; invalid intersections (tech off-shift, asset in surgery) refuse the drop with structured "Not available" tooltip.
- **Triage Deck (visualization #20).** Seed 50 unassigned WOs; dispatcher uses keyboard only (no mouse) — Right/Left/Up/Down/Number keys; measure total time to clear all 50; assert ≤ 3 minutes (target 2 minutes). Each acceptance writes `dispatch_assignment`; each rejection re-queues. Accessibility: full keyboard navigation, ARIA labels per card, screen-reader narrates current WO summary.
- **Live Command Map (visualization #21).** Seed a synthetic CAD/IFC dataset for a 4-floor 200k-sqft hospital; 100 WOs distributed; 12 technicians with presence pings. Map renders at 60fps (Chrome perf trace); lasso-select 15 clustered WOs in one gesture, drag onto a technician's blue dot → creates "Major Incident" `dispatch_plan` with 15 assignment rows in one transaction. Privacy gate: technicians with `available_for_assist = false` rendered as gray (not droppable); their identity hidden from non-managers.
- **Dependency Graph (visualization #22).** Seed 25 WOs with 30 dependency edges across 3 trades; AVA computes critical path within 500ms; bottleneck WO badged with the AVA-generated explanation; clicking the bottleneck shows the 3 blocked downstream WOs + their priority + their SLA breach time. Reordering by dragging an edge updates the critical path live.
- **Active Entitlement Shield (#23 category-reset).** Drop a 50-page Philips vendor PDF onto `master_service_agreement` create-screen → AVA extracts SLA classes + covered components + response times + exclusions; structured payload renders for review; AP approves. Create a synthetic MRI WO → dispatcher sees the warranty-routing prompt; one-tap routes via §3.11 magic-link to the vendor; vendor completes work + e-signs → WO closes with `source = vendor_warranty_routed`. Negative: WO on a non-covered asset shows no prompt.
- **Live Operational Canvas (#24 category-reset).** Seed a synthetic 4-floor hospital CAD; load 8 PMs on Floor 3 for one tech; `<LiveOperationalCanvas>` renders with WebGL at 60fps + AVA-plotted walking path between rooms minimizing travel time + estimated total time. Wi-Fi beacon adapter (`wifi-beacon-occupancy`) emits a 24-hour synthetic occupancy trace; `occupancy_log` materializes; per-room heatmap renders aggregated by 5-min bucket; **no per-individual tracking surface in any view** (privacy verification).
- **Continuous Observations Engine (#25 category-reset).** Run a 50-fire-extinguisher round in the mobile swipe-deck (`<RoundsRunner>` Glove-Mode Rapid Fire); time elapsed ≤ 90s for 49 passes + 1 fail; **DB verification: exactly 50 `observations` rows + exactly 1 reactive `maintenance_work_order` row + ZERO additional WO rows** (the failure case). Trigger a synthetic failure-trend (3 brand-X beds fail bed-rail this week) → AVA Dynamic Smart Rounds injects a mandatory bed-rail check into tomorrow's room-round template for techs on the affected floors.
- **Network-to-Physical Triage + Quarantine Lockout (#26 category-reset).** Inject a Medigate vulnerability for an infusion pump that has a PM scheduled in 5 days → AVA Convergence Routing surfaces the merge proposal to OT Security Officer → approve → vulnerability ticket auto-closes-as-merged + PM checklist gains the patch-install step. Separately inject a critical CVE with exploit signature → quarantine workflow requires Security Officer + Maintenance Manager dual-confirmation + asset-criticality precheck → on confirm, `nac-quarantine` adapter fires (recorded in `outbound_call_log`), asset status flips to `quarantined`, clinical mobile shows "Do Not Use" banner; revoke (rollback) succeeds within 10s.
- **Predictive TCO Active Intercept (#27 back-office).** Synthetic 10-year-old ultrasound with cumulative repair cost = $14,000 + replacement cost = $20,000 + recent close-out narratives sentiment-tagged negative. Technician opens parts catalog and tries to order a $4,000 controller board → dialog interrupts with provenance card (TCO ratio = 65%, ratio threshold = 60%); accept-intercept → `capital_replacement_request` row created + Maintenance Manager notified; reject-and-order → `purchase_order` row created with `override_reason_code`. §3.16 separation-of-duties enforced on the capital-request approval path.
- **Autonomous JIT Procurement (#28 back-office).** Seed 30 days of `pm_schedule` + `parts_consumption` history. AVA emits 3 `procurement_proposal` rows next morning, one per major supplier; each line carries provenance (which PMs + which historical failures drove the qty). Procurement Manager reviews on `<ProcurementProposalCart>` and one-tap approves all → 3 `purchase_order` rows created with `source = ava_jit_proposal`. Budget envelope (§3.16) check verified: a proposal that would breach the quarterly budget refused with structured error + alternate-suggestion (cut by 20% / split across quarter / increase budget request).
- **AI-Enforced Vendor Invoice Reconciliation (#29 back-office).** Vendor drops a PDF invoice through the §3.11 magic-link portal; AVA Document AI extracts billed hours (4h) + rate ($150/h) + parts; reconciliation engine cross-references against actual time_on_site from `technician_presence` (2h) + `master_service_agreement` rate ($150/h matches) + `parts_consumption` (matches). **Mismatch detected: 4h billed vs 2h on-site** → `invoice_discrepancy` flag + workflow routes to discrepancy_review → AP supervisor sees a reason-coded variance + AVA's evidence summary + one-tap approve-with-variance or reject. Fraud-flagged invoices NEVER reach AP auto-approve.
- **Fleet-as-Asset (#30 back-office).** Seed a fire-rescue truck as `asset_type = 'vehicle'`; OBD2 telematics feed (`obd2-telematics-feed`) streams mileage + GPS into §3.5 `observation_streams`. PM schedule with utilization-trigger at 5,000 mi → idempotent `maintenance_work_order` fires when mileage crosses threshold; double-trigger refused by `generation_runs.idempotency_key` unique. Fault-code threshold rule fires → reactive WO with AVA-suggested fix per #4 Predictive Parts Staging.
- **Semantic Recall Quarantine (#31 edge-reset).** Feed in a synthetic FDA recall notice naming "Philips Model X". Seed an asset registry with deliberately messy data ("Philps Mod-X", "Phillips M-X", "Philips MX-2026", "Philips X Model"). AVA semantic match returns 4 matches at confidence ≥ 0.85; auto-tag with "Do Not Use" + biomed-dispatch fires. Negative: a "Philips Model Y" asset (different model) returns confidence 0.40 — surfaces for review, no auto-tag. **FDA precision/recall corpus** test runs against last-quarter ECRI feed; recall ≥ 95% on a hand-labeled ground-truth set is the gate.
- **Analyzer Blast Radius (#32 edge-reset).** Seed 500 patient-monitor calibration `inspection` rows pointing to a single Fluke Analyzer over 6 months (via §3.15 `relationship_edge` from calibrations to instruments). Mark the Fluke as out-of-tolerance → one-tap "Compute Blast Radius" in `<AnalyzerBlastRadiusBoard>` returns all 500 affected monitors within 2s; bulk action suspends clinical status on all of them + spawns 500 reactive `maintenance_work_order` rows. Verify no monitor is missed by cross-checking against the raw `inspection` table.
- **AVA Auto-Commissioning (#33 edge-reset).** Drag a synthetic 5,000-row messy contractor spreadsheet (deliberate typos, mixed naming conventions, varied location refs) into `<AssetImportWizard>`. AVA ingests + normalizes within 10 minutes → `import_batch` populated with per-row confidence + AVA explanations. Facilities Manager reviews on the grid; high-confidence rows (≥ 0.95) auto-accept-all option; med-confidence (0.80-0.95) one-tap-confirm-each; low-confidence (< 0.80) routed to AVA-edit-with-reviewer-followup. Atomic publish creates 5,000 `asset` rows in one transaction; rollback within 24h reverses.
- **Joint Commission EoC Merkle Proof (#34 edge-reset).** Auditor's iPad in `ws_auditor_kiosk` session. Auditor taps a room on Live Command Map → workspace renders every PM + inspection done in that room in the audit window (default last 365 days). Each row shows its `signature_chain_id` + Merkle root hash + ability to drill-down to the signed payload + signer's identity snapshot. Spot-check: tamper one inspection row in the source table → the chain re-verification at audit-export time detects the tamper + the audit-export flags the integrity failure.
- **Cryptographic Key Custody (#35 edge-reset).** Issue a master key to an employee via `<KeyCustodyLedger>`; e-sign by holder + supervisor co-sign required + `signature_chain_id` chains the transfer. Transition the employee's HR record to `terminated` (synthetic event) → automation fires `key_revocation_on_termination` → every open `key_assignment` for that user emits `unrecovered_key_flag` + recovery WO; Security Officer's workspace surfaces the recovery queue. Audit query: "every master-key transfer this quarter with signer identity + reason code" returns the expected rows in under 1s.

### 10.2 Pack-level (Phase 2-4 acceptance)
- **maintenance-core:** All 43 collections publish cleanly; reference-checker (W2.A) blocks delete of property referenced by automation rule or view; 9 OOTB workspaces render in both web and mobile; PM generator produces correct WOs against 1000-asset fixture; **rounds:** Batch Observation Session test — 50-extinguisher fire-safety round in mobile swipe-deck (#25 Glove-Mode Rapid Fire) → 50 `observations` rows written, 0 WO rows; one failure injected → exactly 1 reactive `maintenance_work_order` spawned; smart-rounds dynamic-injection rule verified against a synthetic failure-trend dataset; **contracts:** `master_service_agreement` renewal cycle fires at T-90/T-30/T-7 days; vendor scorecard recomputes on every WO close-out.
- **Three overlays installed together:** No schema collision; no role/view leakage between clinical, facilities, and OT security; pack-install upgrade validator passes.
- **clinical-maintenance:** UDI lookup against FDA fixture; calibration sign-off requires WebAuthn re-auth; ECRI advisory ingest creates `recall_response` records correctly.
- **facilities-maintenance:** BACnet adapter reads from mock device; refrigerant leak workflow generates EPA report draft; FCA assessment cycle produces deficiency log + remediation WO; **space management:** concurrent `space_reservation` requests on same space + overlapping window → conflict resolution workflow fires + alternate suggestion offered; `move_request` workflow advances through approval chain; `occupancy_log` partitions roll monthly via pg_partman.
- **ot-security-maintenance:** Claroty / Medigate / Asimily feeds ingest into `discovery_event` and map to existing assets; `ot_asset_vulnerability` taskable surfaces in `ws_ot_security_officer`; vulnerability_response workflow advances through triage → mitigation → e-sign → mitigated; `risk_score` recomputes on advisory ingest.

### 10.3 Pilot acceptance (Full Showcase — G6 close, ~week 44)
- **Mobile speed:** 60fps list scroll + sub-1s WO open on mid-range Android in a **hospital dead-zone / MRI-adjacent approved test area** with intermittent connectivity. Filmed comparison vs Nuvolo on the same device.
- **UI Builder dog-food:** Live edit a Technician workspace in the demo, save, reload — change persists, no downtime, no schema drift.
- **AVA voice WO marquee:** Demonstrated on stage. Technician dictates → AVA structures → one-tap submit → WO appears in Dispatcher workspace within projection lag (<1s).
- **Upgrade safety:** Run upgrade-validator against demo customer pack manifest; green result for compatible change; red result with precise fix instructions for incompatible change.
- **Compliance:** Produce a single attestation file for one asset's lifetime, verifiable hash chain end-to-end.

### 10.4 G6 scale acceptance (inside the Full Showcase Pilot — week 44)
- `apps/scale-rig` produces 3M assets, 20M WOs, archived history, **≤10B observation partitions** (within vanilla-PG + pg_partman comfort per §3.5; TimescaleDB triggered above this).
- Hot list views stay snapshot-backed (no full-table scan in EXPLAIN plan); circuit breaker holds under burst.
- Mobile selective-sync pulls < 1MB **of metadata + list payload** for a single technician's day; photos, audio recordings, service manuals, and evidence artifacts lazy-fetch on explicit user action (tap-to-load), not via background sync.
- Rollup-refresh lag stays under target across all granularities (hourly ≤ 5 min, daily ≤ 1 hour, weekly ≤ 1 day).
- Perf baseline frozen in `docs/scale-baselines/v1.json`.
- On-site mobile field test in a **hospital dead-zone / MRI-adjacent approved test area** (intermittent connectivity) — Elevator Mode acceptance contract holds.
- Regulator-export rehearsal validates against **HubbleWave attestation schema mapped to Part 11 controls + Joint Commission readiness rubric** (the platform delivers a Part 11-ready control envelope; full Part 11 compliance is a customer-operational determination).

---

## 11. Closed Questions (resolved during architectural review)

The 6 questions originally open are all closed by the review pass. Recorded here for traceability.

1. **Pilot timeline.** RESOLVED: pilot rebaselined as **Full Showcase, ~36-44 weeks**. Both Clinical AND Facilities overlays + all 22 differentiators + full substrate + scale verification all in scope. Phase gates G0a → G6 (§5.3) prevent giant-final-integration risk. No cut list — the architecture is honest about being a category-defining build, not an MVP slice.
2. **Training infrastructure (post-G6 only).** RESOLVED: self-hosted Ollama for inference + dedicated single-tenant SageMaker (or equivalent) for training. Multi-tenant managed ML services violate canon §5 instance isolation when handling PHI. Post-showcase work per §5.2.
3. **TimescaleDB stance.** RESOLVED: adopt **pg_partman Day-1** for partition management; rollups via **explicit SQL rollup tables + scheduled upsert jobs** (NOT pg_ivm — its README requires non-partitioned base tables and its immediate-maintenance mode degrades under high-volume writes). TimescaleDB stays a deferred escape valve for >10B observations/instance; G6 scale rig caps at ≤10B observations to stay within vanilla-PG comfort. Node-side rollup computation rejected. Reflected in §3.5 + §8 §31 amendment.
4. **Pack delivery channel.** RESOLVED: introduce a **Verified Pack Registry** using the standard install pipeline but enforcing a cryptographic signature check against the registry's signing key. Prevents customer packs from hijacking platform-reserved namespaces (e.g., a malicious customer pack named `maintenance-core`). Reflected in §8 §17.5 amendment.
5. **Cross-overlay GxP scope.** RESOLVED: `regulated-action` is a platform capability available to every overlay. Clinical (FDA), Facilities (EPA), and OT Security (CVE remediation evidence) all require immutable ledgers. Confirms the §3.6 + §4.5 design.
6. **Worker process scaling.** RESOLVED: single worker per instance is a SPOF. Introduce **Redis Consumer Groups (at-least-once delivery)** + **effectively-once processing** via idempotent consumers (unique `event_id` + `processed_events` ledger + idempotent UPSERTs + retry-safe tombstones; processed_events insert and domain mutation occur in the same DB transaction; Redis XACK only after commit). Canon §19 amended (see §8 amendments table). Reflected in §3.2 + §9.

## 11.1 New open questions surfaced by the review + differentiator pass

1. **Per-gate slip budget.** Each gate G0a → G6 has a target week. What's the slip-budget policy (e.g., ≤ 2 weeks of slip per gate before re-baseline) and what triggers a forced re-baseline (e.g., G3 slips 4 weeks → re-baseline the remaining 3 gates)? Proposal: 2 weeks per gate; cumulative budget capped at 6 weeks before mandatory re-baseline.
2. **Verified Pack Registry signing-key custody.** Is the registry signed by a HubbleWave root key (single key, cross-customer trust), or per-customer keys, or a hybrid (HubbleWave root + delegated partner publishers)?
3. **Ollama vs SageMaker boundary (post-G6).** Is inference always on-instance via Ollama, or are there inference patterns that route to single-tenant SageMaker endpoints (e.g., large-context document AI for service manuals)? Needs post-G6 spec.
4. **Break-glass eligibility policy.** Who can break-glass on what, and bound by what? Default proposal: role-eligibility (`biomed_technician`, `clinical_engineer`, `facility_manager`) × asset-category × pack-defined reason-code vocabulary × maximum 10-min duration. Per-customer policy override? Hospital ethics board approval for the bound set?
5. **AVA UI synthesis trust graduation.** Each synthesis feature defaults to Suggest mode (canon §12). What's the evidence threshold to graduate to direct-render? Proposal: 100+ accepted syntheses, 95%+ acceptance rate, zero validator rejections — then promote per-feature via the existing canon §12 trust progression rail.
6. **Public intake QR rotation policy.** Does an asset's QR token rotate (e.g., quarterly) or persist for the asset's lifetime? Lifetime is simpler for facilities staff; rotation is more secure but requires re-labeling. Proposal: lifetime by default; rotation triggered on token-revoke + automatic for assets with active grants.
7. **Predictive parts staging fallback.** If AVA cannot suggest a part (low confidence, no history), what's the default? Proposal: WO ships without staged part; technician's mobile view shows "AVA could not auto-stage parts; tap to browse catalog"; clean no-magic fallback rather than a wrong suggestion.
8. **AVA Vision model selection.** Per-customer trained vs generic CV model for nameplate OCR? Generic model is faster to ship; per-customer trained becomes valuable for unusual equipment (custom-engraved nameplates, manufacturer-specific layouts). Proposal: v1 generic OCR + asset-registry fuzzy match; per-customer fine-tuning post-G6 if metric corpus shows < 80% accuracy on the customer's mix.
9. **UI primitive evolution policy.** When does a new primitive land in the `@hubblewave/ui-primitives` vocabulary (canon §33 commitment, web+mobile rendering symmetry) vs ship in a customer plugin? Proposal: primitive lands in vocabulary only when (a) used by 2+ verticals OR by core platform, AND (b) has a clear semantic-equivalence contract across web + mobile. Otherwise stays in `@hubblewave/maintenance-plugins` or customer pack.
10. **Technician presence privacy policy.** Location/presence tracking of a workforce is labor-ethics territory and a likely sticking point in unionized hospital deployments. Proposal: opt-in per technician at first login; "Go Invisible" toggle in the mobile profile that keeps the tech outside `<PartFinder>` results without disabling pings to them; clear retention policy (presence pings deleted after 30 days); customer-admin policy override for organizations that require always-on tracking, documented in onboarding.
11. **Asset-pin moderation model.** Voice notes are user-generated content on a clinical/operations asset. Proposal: lightweight social moderation (downvote, flag-as-incorrect, flag-as-unsafe); AVA pre-screens for hostile language or PHI leakage at transcribe time and refuses to publish flagged content; pins flagged for "unsafe" route to Maintenance Manager workspace for review/delete; pins above N upvotes promoted to formal Knowledge Base article via AVA-drafted PR.
12. **Smart LOTO vision-failure escalation.** If AVA Vision cannot confirm a lock placement at any step, the workflow blocks (fail-safe-block, never fail-safe-allow per OSHA). Default escalation: technician can attest manually with a reason code + photo + supervisor co-sign (regulated-action), which captures full provenance. Open: should attestation require remote-witnessed sign-off (supervisor receives push, watches a 10-sec video, co-signs from their phone), or is the reason-code-and-photo trail sufficient?
13. **Kiosk device-fingerprint policy.** What constitutes a device fingerprint robust enough for kiosk binding? Proposal: WebAuthn-style platform-attestation key registered at kiosk-session-start; rotating the iPad voids the session and forces re-issue. Plus second-factor: Compliance Officer's confirmation tap on their phone when the iPad presents the session for the first time.
14. **Magic-link contractor link delivery + rate-limit.** SMS vs email vs both? Proposal: customer-admin choice; deliverability matters more in the field than precision; default to BOTH with deduplication on first redemption. Rate-limit: 3 redemption attempts before token revocation (anti-brute-force).
15. **Smart Sprint dispatcher autonomy.** AVA proposes; dispatcher approves. But what about dispatch-shift handoffs — does the next dispatcher inherit the previous dispatcher's approved Sprint or restart? Proposal: Sprint persists until completion or dispatcher manual cancel; shift handoff transfers ownership; AVA can suggest re-batching only on Sprint completion.
16. **Replacement-urgency score forwarding policy.** When does a high-urgency score forward from Maintenance Manager → Finance? Proposal: Maintenance Manager reviews on a weekly cadence; explicit "Forward to Finance" action writes a signature_chains row + emits a notification to Finance Director persona. Never auto-forwarded; always human-gated.
17. **Live Command Map technician-tracking source-of-truth.** Wi-Fi triangulation vs Bluetooth-beacon mesh vs mobile-device GPS vs manual check-in. Proposal: customer-admin choice per facility, default to opt-in mobile GPS for outdoor + Wi-Fi triangulation indoors; staleness threshold 60s renders as "last known"; data retention 24h then aggregate-only for trend analytics.
18. **Pivot-Kanban macro behavior policy.** Which column transitions fire which AVA macros? Proposal: pack-author declares macro bindings in pack manifest (`pivot_kanban.column_transitions[]`); platform default is "no-op + audit"; customers customize via UI Builder; critical-priority WOs require confirm-on-drop; 5-second undo affordance on every drag.
19. **Lasso-and-drag UX accessibility on Command Map.** Lasso is mouse/touch-only. Keyboard-only operators need an alternative. Proposal: ship a keyboard-driven "select by criteria" modal (floor + priority + age) that yields the same multi-WO assignment outcome; same audit row; same UX endpoint.

---

---

## 12. Architecture Visual

### 12.1 Layered architecture (top-down)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  RFP VOTERS (§5.4 personas — 14 distinct)                                       │
│  Nurse  Technician  Junior-tech  Dispatcher  Maint-Mgr  Compliance-Officer       │
│  Safety-Officer  Contractor  Finance/CFO  IT-Admin  CISO  OT-Sec-Officer         │
│  Space-Planner  Procurement-Mgr  Accounts-Payable  Capital-Planner  Fleet-Mgr    │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │ each persona has ≥ 1 "wow" moment
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  35 MARQUEE DIFFERENTIATORS (§5.1)                                              │
│  #1-22 originals  │  #23-26 category-resets  │  #27-30 back-office  │  #31-35   │
│  voice / mobile  │  Contracts Space Rounds  │  Capital  JIT  AI-   │  edge-     │
│  AVA / kiosk     │  OT-Security             │  Invoice Fleet       │  resets    │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │ surfaced via workspaces (built in UI Builder) +
                                      │ React/RN plugin components
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  9 OOTB WORKSPACES (UI Builder dog-food — §4.1)                                 │
│  Tech-Mobile   Dispatcher   Maint-Mgr   Biomed-Eng   Facilities-Mgr             │
│  Compliance-Officer   FCA-Inspector   Auditor-Kiosk   OT-Sec-Officer            │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  4 HUBBLEWAVE-OWNED PACKS (§4) — same upgrade-safety contract as customer packs │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ maintenance-core  (51 collections, 18 workflows, 32 plugins, 7 adapters)│    │
│  └────┬────────────────────────────────────────────────────────────────────┘    │
│       │ binds capabilities to platform substrate                                │
│  ┌────▼──────────────────┐  ┌────────────────────┐  ┌─────────────────────┐    │
│  │ clinical-maintenance  │  │ facilities-maint   │  │ ot-security-maint   │    │
│  │ (overlay, 12 cols)    │  │ (overlay, 14 cols) │  │ (overlay, 6 cols)   │    │
│  │ FDA/UDI/ECRI/HL7      │  │ BACnet/CAD/IFC     │  │ Claroty/Medigate    │    │
│  └────────────┬──────────┘  └─────────┬──────────┘  └─────────┬───────────┘    │
└───────────────┼──────────────────────┼──────────────────────────┼──────────────┘
                │ all packs consume     │ never modify             │
                │ via requires_capabili │ platform schema          │
                ▼                      ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PLATFORM SUBSTRATE — 18 sections, 3 gates (§3 + §8 amendments §30-§44)         │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │ G0a FOUNDATION (week 5)                                                │    │
│  │  §3.1 taskable   §3.3 scheduling   §3.4 list-scale   §3.5 observations │    │
│  │                   §3.6 regulated-action (single-signature)             │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │ G0b ADVANCED (week 11)                                                 │    │
│  │  §3.2 task_projection (circuit-breaker + tombstones + reconciliation)  │    │
│  │  §3.6 Merkle batch    §3.7 mobile parity + Elevator Mode               │    │
│  │  §3.8 AVA UI synth    §3.9 public intake    §3.10 break-glass          │    │
│  │  §3.11 external-collaborator sessions    rollup jobs                   │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │ G0c SHARED (week 17 — prevents pack ad-hoc reinvention)                │    │
│  │  §3.12 Storage/Evidence    §3.13 Connector + simulators                │    │
│  │  §3.14 Semantic Vector Match    §3.15 Spatial+Graph                    │    │
│  │  §3.16 Financial Control    §3.17 Bulk Import Staging                  │    │
│  │  §3.18 Integration Secrets + Egress Policy                             │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │ all substrate sections are domain-agnostic
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  EXISTING HUBBLEWAVE PLATFORM (canon today — must be sound before §1.1)         │
│  CollectionDefinition + PropertyDefinition + FormDefinition + WorkspacePage     │
│  AuthorizationService (§28 deny-wins matrix)   AuditLog hash-chain (Plan-Fix-41)│
│  AuthnGuard (§29 ES256 KMS-signed JWT)         pack-install pipeline            │
│  Verified Pack Registry (§17.5 cryptographic signature check)                   │
│  Postgres (pg_partman + RLS in pooled mode)  Redis (Consumer Groups + Streams)  │
│  apps/api (Nest modular monolith)  apps/worker (multi-pod via Redis CG)         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Substrate sections by gate (timeline-aligned)

```
WEEK   0 ────────── 5 ────── 11 ────── 17 ───── 23 ────── 31 ────── 37 ────── 43 ── 47 ── 50
        │           │         │         │        │         │         │         │     │     │
PHASE   0   1a────► G0a  1b─► G0b   1c► G0c  2 ─► G1   3 ──► G2   4 ─► G3   5 ──► G4  G5  G6
        │   foun-       advan-      shared      core      3-overlay  superp-  systemic  viz scale
        │   dation      ced         platform    maint-    + AI       owers    + back-   + fleet
        │   sub-        sub-        sub-        core      marquees   + Rds    office    + JC
        │   strate      strate      strate      slice     1-5+#31    +Cal-    #14-17    Merkle
        │                                                  +#33      brate-   +#27-29   #34
        │                                                            Blast    +#35
        │                                                            #32      
        └─── §1.1 platform blockers cleared ─────────────────────────────────────────┘
             (W2 Stream 1 + capability contract + metadata safety fields)
```

### 12.3 Marquee → substrate dependency matrix

| Marquee | §3.1 task | §3.2 proj | §3.3 sched | §3.5 obs | §3.6 reg | §3.7 mob | §3.8 AVA | §3.9 intake | §3.10 BG | §3.11 ext | §3.12 store | §3.13 conn | §3.14 sem | §3.15 graph | §3.16 fin | §3.17 imp | §3.18 sec |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| #1 Voice WO | ✓ | ✓ |  |  |  | ✓ | ✓ |  |  |  | ✓ |  |  |  |  |  |  |
| #2 Invisible Manual |  |  |  |  |  | ✓ | ✓ |  |  |  | ✓ |  | ✓ |  |  |  |  |
| #3 Walk-by Intake | ✓ | ✓ |  |  |  | ✓ | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |
| #4 Predictive Parts | ✓ | ✓ |  | ✓ |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| #5 Break-Glass PHI |  |  |  |  | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  |
| #6 Glove-Mode |  |  |  |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| #7 Gen Close-Out |  |  |  |  | ✓ | ✓ | ✓ |  |  |  | ✓ |  |  |  |  |  |  |
| #8 Dirty Nameplate |  |  |  |  |  | ✓ | ✓ |  |  |  | ✓ |  | ✓ |  |  |  |  |
| #9 Elevator Mode |  |  |  |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| #10 P2P Parts | ✓ | ✓ |  | ✓ |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| #11 Asset Pins |  |  |  |  |  | ✓ | ✓ |  |  |  | ✓ |  | ✓ |  |  |  |  |
| #12 Floor-Plan Routing |  |  |  |  |  | ✓ |  |  |  |  |  |  |  | ✓ |  |  |  |
| #13 Smart LOTO | ✓ |  |  |  | ✓ | ✓ | ✓ |  |  |  | ✓ |  | ✓ |  |  |  |  |
| #14 Auditor Kiosk |  | ✓ |  |  | ✓ |  |  |  |  | ✓ |  |  |  |  |  |  |  |
| #15 Contractor Flow | ✓ |  |  |  | ✓ | ✓ |  |  |  | ✓ | ✓ |  |  |  |  |  |  |
| #16 Smart Sprint | ✓ | ✓ | ✓ |  |  |  | ✓ |  |  |  |  |  |  | ✓ |  |  |  |
| #17 Repl-Urgency Score |  |  |  | ✓ |  |  | ✓ |  |  |  |  |  | ✓ |  | ✓ |  |  |
| #18 Pivot-Kanban |  | ✓ |  |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| #19 Dual-Axis Timeline |  | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| #20 Triage Deck |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| #21 Live Command Map |  | ✓ |  | ✓ |  | ✓ |  |  |  |  |  |  |  | ✓ |  |  |  |
| #22 Dependency Graph |  | ✓ |  |  |  |  |  |  |  |  |  |  |  | ✓ |  |  |  |
| #23 Entitlement Shield | ✓ |  |  |  | ✓ |  | ✓ |  |  | ✓ | ✓ | ✓ | ✓ |  | ✓ |  |  |
| #24 Live Op Canvas |  |  |  | ✓ |  | ✓ |  |  |  |  |  | ✓ |  | ✓ |  |  | ✓ |
| #25 Cont. Observations |  |  | ✓ | ✓ |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| #26 N-to-P + Quarantine | ✓ |  | ✓ | ✓ | ✓ |  | ✓ |  |  |  |  | ✓ |  |  |  |  | ✓ |
| #27 Predictive TCO |  |  |  | ✓ | ✓ |  | ✓ |  |  |  |  |  | ✓ |  | ✓ |  |  |
| #28 JIT Procurement | ✓ |  | ✓ | ✓ | ✓ |  | ✓ |  |  |  |  |  |  |  | ✓ |  |  |
| #29 Invoice Reconcil. | ✓ |  |  |  | ✓ |  | ✓ |  |  | ✓ | ✓ |  | ✓ |  | ✓ |  |  |
| #30 Fleet-as-Asset | ✓ |  | ✓ | ✓ |  |  |  |  |  |  |  | ✓ |  |  |  |  | ✓ |
| #31 Semantic Recall | ✓ |  |  |  | ✓ | ✓ | ✓ |  |  |  | ✓ |  | ✓ |  |  |  |  |
| #32 Blast Radius |  |  |  | ✓ | ✓ |  |  |  |  |  |  |  |  | ✓ |  |  |  |
| #33 Auto-Commissioning |  |  |  |  | ✓ |  | ✓ |  |  |  | ✓ |  | ✓ |  |  | ✓ |  |
| #34 JC Merkle Proof |  |  |  |  | ✓ |  |  |  |  | ✓ |  |  |  |  |  |  |  |
| #35 Key Custody | ✓ |  |  |  | ✓ |  |  |  |  |  |  |  |  |  | ✓ |  |  |

Every marquee touches multiple substrate sections. **No marquee is implementable as a pack-only feature.** This is the load-bearing proof that the substrate additions §3.12-§3.18 are mandatory (not nice-to-have): #23-#35 collectively press on every G0c primitive.

### 12.4 Capability bindings (per pack)

```
PLATFORM SUBSTRATE                  ⟵ capability provides
       │
       │  taskable        ◄────────────────────────────────────┐
       │  regulated-action ◄───────────────────────────────────┤
       │  observable      ◄────────────────────────────────────┤
       │  schedulable     ◄────────────────────────────────────┤
       │  mobile-syncable ◄────────────────────────────────────┤
       │  projection-safe ◄────────────────────────────────────┤
       │  vector-indexed  ◄────────────────────────────────────┤
       │                                                       │
       ▼                                                       │
maintenance-core  binds taskable to:                           │
                  ├ maintenance_work_order                     │
                  ├ maintenance_work_task                      │
                  ├ inspection                                 │
                  ├ deficiency                                 │
                  ├ work_round_session (NOT taskable! #25)     │
                  ├ purchase_order                             │
                  ├ vendor_invoice                             │
                  ├ procurement_proposal                       │
                  ├ capital_replacement_request                │
                  ├ asset_import_batch                         │
                  ├ key_assignment                             │
                  ├ unrecovered_key_flag                       │
                  ├ parts_requisition                          │
                  ├ recall_response                            │
                  ├ permit_to_work                             │
                  └ deficiency                                 │
                                                               │
                  binds regulated-action to:                   │
                  ├ permit_to_work + loto_step_check           │
                  ├ recall_response                            │
                  ├ inspection + checklist_instance            │
                  ├ key_assignment (master-key co-sign)        │
                  ├ capital_replacement_request                │
                  ├ vendor_invoice (variance approval)         │
                  └ procurement_proposal                       │
                                                               │
clinical-maintenance overlay  requires_capabilities: ─────────┤
                  ├ regulated-action  ───── binds:             │
                  │   ├ calibration_certificate                │
                  │   ├ aem_program_membership                 │
                  │   └ phi_disposal_record                    │
                  └ observable   ───── binds: (UDI feed)       │
                                                               │
facilities-maintenance overlay  requires_capabilities: ───────┤
                  ├ regulated-action  ───── binds:             │
                  │   ├ refrigerant_log                        │
                  │   ├ fca_assessment                         │
                  │   ├ commissioning_record                   │
                  │   ├ building_compliance_certificate        │
                  │   └ move_request                           │
                  └ observable   ───── binds: (BACnet, beacon) │
                                                               │
ot-security-maintenance overlay  requires_capabilities: ──────┘
                  ├ regulated-action  ───── binds:
                  │   ├ ot_asset_vulnerability (accepted-risk)
                  │   ├ network_policy
                  │   └ nac-quarantine actions
                  └ observable   ───── binds: (Claroty, Medigate, Asimily feeds)
```

### 12.5 Example data flow: Walk-by Intake (marquee #3 + #4 staging)

```
Nurse's mobile (no login)                              Hospital biomed staff (logged in)
       │                                                                  ▲
       │  1. Scan QR on pump 4521                                         │
       │  ────────────────────────────────────────►                       │
       │                                                                  │
       │  2. App resolves QR slug                                         │
       │     to public_intake_token                                       │
       │     scope=asset:4521 (§3.9)                                      │
       │                                                                  │
       │  3. Hold mic + speak: "screen frozen,                            │
       │     keeps beeping"                                               │
       │                                                                  │
       │  4. POST /intake/v1/submit                                       │
       │     - JSON body (text metadata, ≤50KB)                           │
       │     - Audio attachment via pre-signed                            │
       │       S3 URL (§3.12), AV+secret-scanned,                         │
       │       hashed, object-lock + retention                            │
       │                                                                  │
       │     ──── token validated, rate-limit OK, queued ────►            │
       │                                                                  │
       │  5. Confirmation toast (submission code)    [worker pod 1]       │
       │  ◄────────────────────────────────────                           │
       │     (NEVER returns operational data)        │ AVA structures:    │
       │                                             │ - asset resolved   │
                                                     │   (UDI match 4521) │
                                                     │ - location: Rm 312 │
                                                     │ - category: alarm  │
                                                     │ - priority: P2     │
                                                     │ - route: biomed    │
                                                     │                    │
                                                     ▼                    │
                                  ┌──────────────────────────────────┐    │
                                  │ Create maintenance_work_order   │    │
                                  │ (taskable per §3.1)             │    │
                                  │ + emit outbox event             │    │
                                  └──────────┬───────────────────────┘    │
                                             │                            │
                                             ▼                            │
                                  ┌──────────────────────────────────┐    │
                                  │ Predictive Parts Staging (#4)   │    │
                                  │ AVA queries history + bins      │    │
                                  │ → create parts_requisition       │    │
                                  │ → notify stockroom              │    │
                                  └──────────┬───────────────────────┘    │
                                             │                            │
                                             ▼                            │
                                  [worker pod 2 — projection consumer]    │
                                  ┌──────────────────────────────────┐    │
                                  │ §3.2 task_projection.upsert     │    │
                                  │ (idempotent, processed_events   │    │
                                  │ in same DB tx, XACK after       │    │
                                  │ commit)                          │    │
                                  └──────────┬───────────────────────┘    │
                                             │                            │
                                             ▼                            │
                                  ┌──────────────────────────────────┐    │
                                  │ Maria's mobile: new WO in        │────┘
                                  │ Technician workspace within     │
                                  │ projection lag (<1s)             │
                                  └──────────────────────────────────┘
```

### 12.6 Workspace × Persona × Marquee matrix (selected; full version in §5.4 + §4.1)

```
WORKSPACE                    │ PRIMARY PERSONA            │ KEY MARQUEES
─────────────────────────────┼───────────────────────────┼──────────────────────────────
ws_technician_mobile_first   │ Field technician (biomed   │ #1, #2, #5, #6, #7, #8, #9,
                              │  / facilities)             │  #10, #11, #12, #13, #25, #32
ws_dispatcher                │ Dispatcher                 │ #16, #18, #19, #20, #21, #22
ws_maintenance_manager       │ Maintenance Manager        │ #17, #27, #28
ws_biomed_engineer           │ Biomed Engineer            │ #5, #8, #13, #31, #32
ws_facilities_manager        │ Facilities Manager         │ #12, #21, #24, #35
ws_compliance_officer        │ Compliance / CISO          │ #5, #14, #34
ws_fca_inspector             │ FCA Inspector (Facilities) │ #25 (FCA rounds)
ws_auditor_kiosk             │ External Auditor (read-only│ #14, #34
                              │  kiosk session via §3.11)  │
ws_ot_security_officer       │ OT Security Officer        │ #26, #31, #34
                              │                            │
[plus external sessions]      │ External Contractor        │ #15, #29 (invoice)
                              │ External Auditor           │ #14, #34
```

### 12.7 Risk-mitigation control flow (HIGH risk #1: task_projection lag under burst)

```
Bulk import of 200k WOs (e.g. legacy CMMS migration)
        │
        ▼
┌──────────────────────────────────────────┐
│ Import API endpoint                      │
│ - service-boundary allowlist for         │
│   bulk-import "projection-write bypass"  │ ◄── Mitigation (a)
│ - writes both source row AND projection  │
│   row in the SAME transaction            │
│ - emits ONE outbox event for cache       │
│   invalidation                           │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│ apps/worker (multi-pod via Redis CG)     │
│ - Pool of N pods, partitioned by         │ ◄── Mitigation (b)
│   task_kind, claim limit per pod         │     fan-out cap
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│ Read path (list view)                    │
│ if (task_projection_lag > 30s) {         │
│   serve stale projection rows + banner   │ ◄── Mitigation (c)
│   refuse new pagination cursor           │     circuit-breaker
│   (NEVER fallback to source table        │     (no thundering
│    on list endpoints — thundering herd)  │      herd)
│ } else if (single-record fetch) {        │
│   source-table fallback OK               │
│ }                                         │
└──────────────────────────────────────────┘
```

---

---

## 13. Implementation Plan (concrete artifact-level spec — to be filled in per substrate section + pack module before code starts)

### 13.1 Implementation-plan structure

Every substrate section (§3.1-§3.18), every pack collection (51 core + 12 clinical + 14 facilities + 6 OT security = 83), every workflow, and every marquee follows the **same artifact template**:

1. **Tables** — every new table with: schema, name, every column (name, Postgres type, default, NOT NULL / NULLABLE, FK references); every index (including partial indexes + composite indexes); partition strategy if applicable; row-level security policies if applicable.
2. **Migrations** — every migration file with: filename (UTC-timestamp prefix per HubbleWave convention), contents sketch (DDL statements), `CONCURRENTLY` flag where needed per Plan Fix 26.
3. **TypeORM entities** — entity class name, area file (`libs/instance-db/src/lib/entities/<area>.entity.ts`), every decorator, every relation.
4. **Services + ports** — every service class, method signatures, port interfaces, DI bindings.
5. **API endpoints** — every route (path + HTTP method), auth requirements (`@Public` / `@Roles` / `@AllowServiceToken` / `@RequireServiceScope`), request schema, response schema, status codes.
6. **Validator extensions** — what publish gate fails and with which structured error.
7. **Service-boundary scanner rules** — which paths may write which tables; entries for `tools/service-boundary-check.ts`.
8. **Workflows** — state-machine diagram with states + transitions + guards + actions.
9. **Tests** — unit, integration, self-test, edge-case verification assertions (every test target named).
10. **PR breakdown** — ordered list of PRs with goal, files touched, acceptance criteria, dependencies.
11. **Canon amendment text** — exact wording to land in `CLAUDE.md`.

### 13.2 Worked example: §3.1 Taskable Capability (complete artifact-level spec — template for the other 17 substrate sections)

#### 13.2.1 Tables

**`metadata.taskable_capabilities`** — one row per opted-in collection.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | Primary key |
| `collection_id` | `uuid` | — | NOT NULL | FK → `metadata.collection_definitions(id)`; UNIQUE |
| `task_kind` | `varchar(64)` | — | NOT NULL | e.g. `maintenance_work_order`, `inspection`, `calibration`, `permit_to_work` |
| `field_mapping` | `jsonb` | `'{}'::jsonb` | NOT NULL | Semantic-name → propertyId map: `{"number": "<uuid>", "title": "<uuid>", "state": "<uuid>", "priority": "<uuid>", "assigned_to": "<uuid>", "assigned_group": "<uuid>", "requested_by": "<uuid>", "due_at": "<uuid>", "opened_at": "<uuid>", "closed_at": "<uuid>", "sla_breach_at": "<uuid>"}` |
| `lifecycle_state_machine_id` | `uuid` | — | NULL | FK → `automation.state_machine_definitions(id)` |
| `timeline_enabled` | `boolean` | `false` | NOT NULL | — |
| `approvals_enabled` | `boolean` | `false` | NOT NULL | — |
| `projection_enabled` | `boolean` | `true` | NOT NULL | When `true`, source events emit to `instance_event_outbox` for §3.2 task_projection consumer |
| `priority_choice_list_id` | `uuid` | — | NULL | FK → `metadata.choice_lists(id)` |
| `source` | `varchar(64)` | `'pack'` | NOT NULL | Provenance: `pack` / `customer` / `migration` |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `updated_at` | `timestamptz` | `now()` | NOT NULL | Updated by trigger |

**Indexes:**
- `pk_taskable_capabilities` ON (`id`) — PK
- `ux_taskable_capabilities_collection_id` UNIQUE ON (`collection_id`)
- `ix_taskable_capabilities_task_kind` ON (`task_kind`)
- `ix_taskable_capabilities_source` ON (`source`)

**`metadata.taskable_required_fields`** — denormalized constraint rows so the metadata validator can fail fast.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `capability_id` | `uuid` | — | NOT NULL | FK → `taskable_capabilities(id)` ON DELETE CASCADE |
| `semantic_name` | `varchar(64)` | — | NOT NULL | One of: `number`, `title`, `state`, `priority`, `assigned_to`, `assigned_group`, `requested_by`, `due_at`, `opened_at`, `closed_at`, `sla_breach_at` |
| `required` | `boolean` | `true` | NOT NULL | — |
| `expected_type` | `varchar(32)` | — | NOT NULL | One of: `text`, `uuid`, `timestamptz`, `int`, `enum_via_choice_list` |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

**Indexes:**
- `pk_taskable_required_fields` ON (`id`)
- `ux_taskable_required_fields_capability_semantic` UNIQUE ON (`capability_id`, `semantic_name`)
- `ix_taskable_required_fields_capability_id` ON (`capability_id`)

#### 13.2.2 Migrations

**`libs/instance-db/src/lib/migrations/1937000000000-add-taskable-capabilities.ts`** (instance-DB, runs after Phase 0 amendments land):

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskableCapabilities1937000000000 implements MigrationInterface {
  name = 'AddTaskableCapabilities1937000000000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`CREATE TABLE metadata.taskable_capabilities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      collection_id uuid NOT NULL UNIQUE REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE,
      task_kind varchar(64) NOT NULL,
      field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
      lifecycle_state_machine_id uuid REFERENCES automation.state_machine_definitions(id),
      timeline_enabled boolean NOT NULL DEFAULT false,
      approvals_enabled boolean NOT NULL DEFAULT false,
      projection_enabled boolean NOT NULL DEFAULT true,
      priority_choice_list_id uuid REFERENCES metadata.choice_lists(id),
      source varchar(64) NOT NULL DEFAULT 'pack',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await qr.query(`CREATE INDEX ix_taskable_capabilities_task_kind ON metadata.taskable_capabilities(task_kind)`);
    await qr.query(`CREATE INDEX ix_taskable_capabilities_source ON metadata.taskable_capabilities(source)`);

    await qr.query(`CREATE TABLE metadata.taskable_required_fields (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      capability_id uuid NOT NULL REFERENCES metadata.taskable_capabilities(id) ON DELETE CASCADE,
      semantic_name varchar(64) NOT NULL,
      required boolean NOT NULL DEFAULT true,
      expected_type varchar(32) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (capability_id, semantic_name)
    )`);
    await qr.query(`CREATE INDEX ix_taskable_required_fields_capability_id ON metadata.taskable_required_fields(capability_id)`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE metadata.taskable_required_fields`);
    await qr.query(`DROP TABLE metadata.taskable_capabilities`);
  }
}
```

`CONCURRENTLY` not needed: tables are new + empty at creation.

#### 13.2.3 TypeORM entities

**File:** `libs/instance-db/src/lib/entities/capabilities.entity.ts` (NEW area file)

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, Unique } from 'typeorm';
import { CollectionDefinition } from './metadata.entity';
import { StateMachineDefinition } from './automation.entity';
import { ChoiceList } from './metadata.entity';

@Entity({ schema: 'metadata', name: 'taskable_capabilities' })
@Unique(['collectionId'])
@Index(['taskKind'])
@Index(['source'])
export class TaskableCapability {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'collection_id' }) collectionId: string;
  @ManyToOne(() => CollectionDefinition) @JoinColumn({ name: 'collection_id' }) collection: CollectionDefinition;
  @Column('varchar', { length: 64, name: 'task_kind' }) taskKind: string;
  @Column('jsonb', { name: 'field_mapping', default: () => `'{}'::jsonb` }) fieldMapping: Record<string, string>;
  @Column('uuid', { name: 'lifecycle_state_machine_id', nullable: true }) lifecycleStateMachineId?: string;
  @ManyToOne(() => StateMachineDefinition) @JoinColumn({ name: 'lifecycle_state_machine_id' }) lifecycleStateMachine?: StateMachineDefinition;
  @Column('boolean', { name: 'timeline_enabled', default: false }) timelineEnabled: boolean;
  @Column('boolean', { name: 'approvals_enabled', default: false }) approvalsEnabled: boolean;
  @Column('boolean', { name: 'projection_enabled', default: true }) projectionEnabled: boolean;
  @Column('uuid', { name: 'priority_choice_list_id', nullable: true }) priorityChoiceListId?: string;
  @ManyToOne(() => ChoiceList) @JoinColumn({ name: 'priority_choice_list_id' }) priorityChoiceList?: ChoiceList;
  @Column('varchar', { length: 64, default: 'pack' }) source: string;
  @Column('timestamptz', { name: 'created_at', default: () => 'now()' }) createdAt: Date;
  @Column('timestamptz', { name: 'updated_at', default: () => 'now()' }) updatedAt: Date;
  @OneToMany(() => TaskableRequiredField, (rf) => rf.capability) requiredFields: TaskableRequiredField[];
}

@Entity({ schema: 'metadata', name: 'taskable_required_fields' })
@Unique(['capabilityId', 'semanticName'])
@Index(['capabilityId'])
export class TaskableRequiredField {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'capability_id' }) capabilityId: string;
  @ManyToOne(() => TaskableCapability, (tc) => tc.requiredFields, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'capability_id' }) capability: TaskableCapability;
  @Column('varchar', { length: 64, name: 'semantic_name' }) semanticName: string;
  @Column('boolean', { default: true }) required: boolean;
  @Column('varchar', { length: 32, name: 'expected_type' }) expectedType: string;
  @Column('timestamptz', { name: 'created_at', default: () => 'now()' }) createdAt: Date;
}
```

**Index update:** `libs/instance-db/src/lib/entities/index.ts` — add new line `export * from './capabilities.entity';` and add `TaskableCapability` + `TaskableRequiredField` to the `instanceEntities` array.

#### 13.2.4 Services

**File:** `apps/api/src/app/metadata/capabilities/capability-registry.service.ts` (NEW)

```typescript
@Injectable()
export class CapabilityRegistryService {
  constructor(
    @InjectRepository(TaskableCapability) private readonly capRepo: Repository<TaskableCapability>,
    @InjectRepository(TaskableRequiredField) private readonly fieldRepo: Repository<TaskableRequiredField>,
    private readonly logger: Logger,
  ) {}

  async isTaskable(collectionId: string): Promise<boolean> {
    return (await this.capRepo.count({ where: { collectionId } })) > 0;
  }

  async getCapability(collectionId: string): Promise<TaskableCapability | null> {
    return this.capRepo.findOne({ where: { collectionId }, relations: ['requiredFields'] });
  }

  async registerCapability(input: RegisterTaskableInput, ctx: UserRequestContext): Promise<TaskableCapability> {
    // Validates field_mapping against required fields; refuses if a required field is unmapped.
    // Writes via withAudit per canon §10.
  }

  async validateFieldMapping(capabilityId: string, mapping: Record<string, string>): Promise<ValidationResult> {
    // For each TaskableRequiredField with required=true: verify mapping has the semantic name AND
    // verify the mapped property's PropertyDefinition.type matches expected_type.
    // Returns structured ValidationResult with errors[] for the metadata validator.
  }
}

export interface RegisterTaskableInput {
  collectionId: string;
  taskKind: string;
  fieldMapping: Record<string, string>;
  lifecycleStateMachineId?: string;
  projectionEnabled?: boolean;
  source?: 'pack' | 'customer' | 'migration';
}
```

**File:** `apps/api/src/app/metadata/capabilities/capabilities.module.ts` (NEW) — module wiring + TypeOrmModule.forFeature([TaskableCapability, TaskableRequiredField]).

#### 13.2.5 API endpoints

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| `GET` | `/metadata/capabilities/taskable/:collectionId` | `@Roles('admin', 'metadata_admin')` | path param | `TaskableCapabilityDto` | 404 if not taskable |
| `POST` | `/metadata/capabilities/taskable` | `@Roles('admin', 'metadata_admin')` | `RegisterTaskableInput` | `TaskableCapabilityDto` | 409 if already registered |
| `PUT` | `/metadata/capabilities/taskable/:id` | `@Roles('admin', 'metadata_admin')` | `RegisterTaskableInput` | `TaskableCapabilityDto` | re-validates field_mapping |
| `DELETE` | `/metadata/capabilities/taskable/:id` | `@Roles('admin')` | — | 204 | Refuses if any pack has installed records that reference this capability — error structured per W2.A reference-checker pattern |
| `GET` | `/metadata/capabilities/required-fields/contract` | `@Public()` | — | `{ requiredFields: [{semantic_name, expected_type, required}] }` | Returns the global taskable contract (one of: number/title/state/priority/...) for pack authors to reference at build time. |

#### 13.2.6 Validator extension

Extend `apps/api/src/app/metadata/packs/pack-validator.service.ts`:

- New validator rule `TaskableFieldMappingComplete`: for every collection in the pack manifest that declares `taskable: true`, the `taskable_field_mapping` block must have entries for every `TaskableRequiredField.required = true` row, AND every entry must reference a property declared in the same pack's `properties[]`, AND that property's type must match `expected_type`.
- Refusal returns structured error: `{ kind: 'INCOMPLETE_TASKABLE_MAPPING', collection: '...', missing: ['state', 'priority'], type_mismatches: [{semantic_name: 'due_at', expected: 'timestamptz', actual: 'text'}] }`.

#### 13.2.7 Service-boundary scanner

Extend `tools/service-boundary-check.ts`:

```typescript
// New entries
'metadata.taskable_capabilities': {
  writers: ['apps/api/src/app/metadata/capabilities/**'],
  readers: ['apps/api/src/app/automation/**', 'apps/api/src/app/views/**', 'apps/api/src/app/data/**', 'apps/api/src/app/notifications/**', 'apps/api/src/app/ai/**', 'apps/worker/src/projections/**'],
},
'metadata.taskable_required_fields': {
  writers: ['apps/api/src/app/metadata/capabilities/**'],
  readers: ['apps/api/src/app/metadata/packs/**'],  // validator reads at publish
},
```

#### 13.2.8 Tests

**Self-test** (`tools/taskable-capability-check.ts.spec.ts` or co-located): grows to ≥ 10 assertions covering:

1. Registering a taskable capability with all required fields mapped → succeeds.
2. Missing `state` mapping → `validateFieldMapping` returns `INCOMPLETE_TASKABLE_MAPPING` with `missing: ['state']`.
3. Mapping `due_at` to a `text` property → returns `type_mismatches` with the expected vs actual.
4. Registering a second capability on the same collection → 409 conflict.
5. Deleting a capability that another pack's record references → 409 with reference list.
6. `isTaskable(collectionId)` returns true after registration, false before.
7. Re-registering with `source = 'pack'` after `source = 'customer'` is refused (pack cannot overwrite customer registration).
8. Validator catches a pack manifest that declares `taskable: true` without `taskable_field_mapping`.
9. `priority_choice_list_id` if present must reference an existing `ChoiceList`; missing FK refuses.
10. State-machine reference if present must be active; inactive state machine refuses.

**Integration tests** (`apps/api/test/integration/taskable-capability.spec.ts`): full HTTP-layer tests against a Postgres testcontainer.

**Canon scanner update**: `npm run authz:check`, `service-boundary:check`, `audit:check` all pass.

#### 13.2.9 PR breakdown for §3.1

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Migration + entities | `libs/instance-db/src/lib/migrations/1937000000000-add-taskable-capabilities.ts`, `libs/instance-db/src/lib/entities/capabilities.entity.ts`, `libs/instance-db/src/lib/entities/index.ts` | Migration runs forward + backward; entities load in `instanceEntities` array; existing tests stay green. |
| 2 | Service + module + ports | `apps/api/src/app/metadata/capabilities/capability-registry.service.ts`, `capabilities.module.ts`; module imported in `MetadataModule` | Service injectable; `isTaskable()`, `getCapability()`, `registerCapability()`, `validateFieldMapping()` covered by unit tests. |
| 3 | API controllers | `apps/api/src/app/metadata/capabilities/capabilities.controller.ts` (CRUD endpoints) | Integration tests pass for all 5 endpoints; authz guards verified; W2.A reference-check on delete. |
| 4 | Validator + scanner | `apps/api/src/app/metadata/packs/pack-validator.service.ts` extension; `tools/service-boundary-check.ts` rules | Validator self-test ≥ 10 assertions; scanner self-test green; pack-publish negative test refuses incomplete mapping. |
| 5 | Canon amendment | `CLAUDE.md` §30 NEW: Capability Contracts | Canon merged; review checklist references it. |

**Total: 5 PRs for §3.1. Estimated effort: ~4-6 working days for one engineer + AI agents.**

### 13.3 Worked example: §3.2 Task Projection (full artifact-level spec — the largest substrate section)

#### 13.3.1 Tables

**`data.task_projection`** — denormalized projection of every active taskable record across all opted-in collections.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | — | NOT NULL | = `source_record_id`; part of composite PK with `task_kind` |
| `source_collection_id` | `uuid` | — | NOT NULL | FK → `metadata.collection_definitions(id)` (NOT VALIDATED — projection lives outside the source schema) |
| `source_collection_code` | `varchar(120)` | — | NOT NULL | Denormalized for query speed; avoids join on every list query |
| `task_kind` | `varchar(64)` | — | NOT NULL | LIST partition key; values from `taskable_capabilities.task_kind` |
| `number` | `text` | — | NULL | Semantic field `number` mapped via `taskable_capabilities.field_mapping` |
| `title` | `text` | — | NULL | Semantic field `title` |
| `state` | `varchar(64)` | — | NOT NULL | Semantic field `state`; lifecycle position |
| `priority` | `smallint` | — | NULL | Derived from priority `ChoiceItem.order` for sort-stable ordering |
| `assigned_to` | `uuid` | — | NULL | User FK |
| `assigned_group` | `uuid` | — | NULL | Group FK |
| `requested_by` | `uuid` | — | NULL | User FK |
| `opened_at` | `timestamptz` | `now()` | NOT NULL | RANGE partition key (monthly) within each `task_kind` LIST partition |
| `due_at` | `timestamptz` | — | NULL | — |
| `closed_at` | `timestamptz` | — | NULL | NOT NULL on closed/cancelled rows |
| `sla_breach_at` | `timestamptz` | — | NULL | Computed at projection time from `sla_instance` |
| `customer_acl_hash` | `bytea(32)` | — | NULL | §28 cached principal-set signature for ACL pre-filter |
| `last_projected_at` | `timestamptz` | `now()` | NOT NULL | When this row was last upserted by consumer |
| `source_version` | `int` | — | NOT NULL | Row version on source record at projection time (stale detection) |
| `deleted_at` | `timestamptz` | — | NULL | Tombstone marker; rows kept N hours then GC'd |
| `attrs_jsonb` | `jsonb` | `'{}'::jsonb` | NOT NULL | Pack-declared chips; every key must appear in pack's `task_projection.attrs[]` schema per §3.2 |

**Partitioning strategy:**
```sql
CREATE TABLE data.task_projection (...) PARTITION BY LIST (task_kind);
-- Per task_kind:
CREATE TABLE data.task_projection_maintenance_work_order PARTITION OF data.task_projection
  FOR VALUES IN ('maintenance_work_order') PARTITION BY RANGE (opened_at);
-- pg_partman manages monthly sub-partitions of each LIST partition:
SELECT partman.create_parent(
  'data.task_projection_maintenance_work_order',
  'opened_at', 'native', 'monthly',
  p_premake := 3, p_start_partition := '2026-01-01'
);
```

**Indexes** (each per LIST sub-partition):
| Index | Columns / WHERE | Purpose |
|---|---|---|
| PK | `(id, task_kind)` | Required composite due to LIST partitioning |
| `ix_assignee_state` | `(assigned_to, state) WHERE deleted_at IS NULL` | Technician's "my open work" |
| `ix_group_state` | `(assigned_group, state) WHERE deleted_at IS NULL` | Dispatcher queue |
| `ix_due_at` | `(due_at) WHERE deleted_at IS NULL AND closed_at IS NULL` | SLA queue |
| `ix_sla_breach_at` | `(sla_breach_at) WHERE deleted_at IS NULL AND closed_at IS NULL` | SLA escalation |
| `ix_acl_hash` | `(customer_acl_hash) WHERE deleted_at IS NULL` | §28 ACL bucket pre-filter |
| `ix_attrs_gin` | `GIN(attrs_jsonb)` | Pivot-Kanban / chip queries |
| `ix_source_record` | `(source_collection_id, id) WHERE deleted_at IS NULL` | Reconciler join key |

All indexes created `CONCURRENTLY` on populated partitions per Plan Fix 26.

**`data.task_projection_archive`** — identical schema; receives detached cold partitions (rows with `closed_at < now() - archive_age_months`) via the `partition-steward.job.ts` worker.

**`data.task_projection_lag`** — per-collection consumer cursor.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `collection_id` | `uuid` | — | NOT NULL | PK |
| `task_kind` | `varchar(64)` | — | NOT NULL | Denormalized for ops dashboards |
| `last_outbox_seq` | `bigint` | `0` | NOT NULL | Last consumed `instance_event_outbox.seq` for this collection |
| `last_projected_at` | `timestamptz` | `now()` | NOT NULL | Wall-clock of last successful projection write |
| `lag_seconds` | `int` | `0` | NOT NULL | Trigger-computed from `(now() - last_projected_at)`; surfaces on Maintenance Manager workspace |
| `circuit_open_above_seconds` | `int` | `30` | NOT NULL | Per-kind override threshold for the circuit-breaker (§3.2) |
| `bucket_rebuilding` | `boolean` | `false` | NOT NULL | Set true during a §28 `CollectionAccessRule` invalidation rebuild |
| `updated_at` | `timestamptz` | `now()` | NOT NULL | Trigger-maintained |

Indexes: PK on `(collection_id)`; `ix_lag` on `(lag_seconds DESC)` for ops dashboards.

**`automation.processed_events`** — idempotency ledger for **all** worker consumers (not just task_projection).

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `consumer_name` | `varchar(120)` | — | NOT NULL | Part of PK; e.g. `task_projection_consumer`, `rollup_consumer`, `pm_generator` |
| `event_id` | `uuid` | — | NOT NULL | Part of PK; from `instance_event_outbox.event_id` |
| `received_at` | `timestamptz` | `now()` | NOT NULL | RANGE partition key (monthly via pg_partman) |
| `processed_at` | `timestamptz` | `now()` | NOT NULL | — |
| `outcome` | `varchar(32)` | `'applied'` | NOT NULL | `applied` / `skipped` / `error` |

**Partitioning:** `PARTITION BY RANGE (received_at)` monthly; pg_partman auto-creates next month + drops > 90 days.
**PK:** `(consumer_name, event_id)` — composite PK IS the idempotency check. `INSERT ... ON CONFLICT DO NOTHING` is the gate.

#### 13.3.2 Migrations

Files in `libs/instance-db/src/lib/migrations/`:

1. `1937100000000-add-task-projection.ts` — creates `data.task_projection` as LIST partitioned root + `data.task_projection_archive` + `data.task_projection_lag`. Does NOT create per-task_kind sub-partitions (those are added on `taskable_capability` insert via service code, not migration).
2. `1937100000001-add-processed-events.ts` — creates `automation.processed_events` partitioned root + initial 3 monthly partitions.
3. `1937100000002-add-task-projection-pg-partman-config.ts` — registers each task_kind's sub-partition with `partman.create_parent`. Calls are wrapped in `IF NOT EXISTS` patterns so re-run is safe.
4. `1937100000003-add-task-projection-indexes-concurrent.ts` — `static transaction = false`; creates indexes `CONCURRENTLY` per Plan Fix 26 (the empty initial state means CONCURRENT isn't strictly required, but the migration is forward-compatible with later non-empty re-runs).

Each migration file extends `MigrationInterface` with `up()` + `down()`. `down()` for #1 drops the tables; `down()` for #4 drops the indexes only.

#### 13.3.3 TypeORM entities

**New file:** `libs/instance-db/src/lib/entities/projection.entity.ts`

```typescript
@Entity({ schema: 'data', name: 'task_projection' })
export class TaskProjection {
  @PrimaryColumn('uuid') id: string;
  @PrimaryColumn('varchar', { length: 64, name: 'task_kind' }) taskKind: string;
  @Column('uuid', { name: 'source_collection_id' }) sourceCollectionId: string;
  @Column('varchar', { length: 120, name: 'source_collection_code' }) sourceCollectionCode: string;
  @Column('text', { nullable: true }) number?: string;
  @Column('text', { nullable: true }) title?: string;
  @Column('varchar', { length: 64 }) state: string;
  @Column('smallint', { nullable: true }) priority?: number;
  @Column('uuid', { name: 'assigned_to', nullable: true }) assignedTo?: string;
  @Column('uuid', { name: 'assigned_group', nullable: true }) assignedGroup?: string;
  @Column('uuid', { name: 'requested_by', nullable: true }) requestedBy?: string;
  @Column('timestamptz', { name: 'opened_at' }) openedAt: Date;
  @Column('timestamptz', { name: 'due_at', nullable: true }) dueAt?: Date;
  @Column('timestamptz', { name: 'closed_at', nullable: true }) closedAt?: Date;
  @Column('timestamptz', { name: 'sla_breach_at', nullable: true }) slaBreachAt?: Date;
  @Column('bytea', { name: 'customer_acl_hash', nullable: true }) customerAclHash?: Buffer;
  @Column('timestamptz', { name: 'last_projected_at' }) lastProjectedAt: Date;
  @Column('int', { name: 'source_version' }) sourceVersion: number;
  @Column('timestamptz', { name: 'deleted_at', nullable: true }) deletedAt?: Date;
  @Column('jsonb', { name: 'attrs_jsonb', default: () => `'{}'::jsonb` }) attrsJsonb: Record<string, unknown>;
}

@Entity({ schema: 'data', name: 'task_projection_lag' })
export class TaskProjectionLag {
  @PrimaryColumn('uuid', { name: 'collection_id' }) collectionId: string;
  @Column('varchar', { length: 64, name: 'task_kind' }) taskKind: string;
  @Column('bigint', { name: 'last_outbox_seq' }) lastOutboxSeq: string; // bigint as string per TypeORM convention
  @Column('timestamptz', { name: 'last_projected_at' }) lastProjectedAt: Date;
  @Column('int', { name: 'lag_seconds' }) lagSeconds: number;
  @Column('int', { name: 'circuit_open_above_seconds', default: 30 }) circuitOpenAboveSeconds: number;
  @Column('boolean', { name: 'bucket_rebuilding', default: false }) bucketRebuilding: boolean;
  @Column('timestamptz', { name: 'updated_at' }) updatedAt: Date;
}

@Entity({ schema: 'automation', name: 'processed_events' })
export class ProcessedEvent {
  @PrimaryColumn('varchar', { length: 120, name: 'consumer_name' }) consumerName: string;
  @PrimaryColumn('uuid', { name: 'event_id' }) eventId: string;
  @Column('timestamptz', { name: 'received_at' }) receivedAt: Date;
  @Column('timestamptz', { name: 'processed_at' }) processedAt: Date;
  @Column('varchar', { length: 32, default: 'applied' }) outcome: string;
}
```

Register in `libs/instance-db/src/lib/entities/index.ts` and `instanceEntities` array.

#### 13.3.4 Services (worker + API)

**File:** `apps/worker/src/projections/task-projection/task-projection.consumer.ts` (NEW)

```typescript
@Injectable()
export class TaskProjectionConsumer {
  constructor(
    private readonly dataSource: DataSource,
    private readonly capabilityRegistry: CapabilityRegistryService,
    private readonly authzService: AuthorizationService,
    private readonly logger: Logger,
  ) {}

  /** Entry point — Redis Consumer Group handler. */
  async handleOutboxBatch(messages: OutboxMessage[]): Promise<void> {
    for (const msg of messages) {
      await this.dataSource.transaction(async (em) => {
        // 1. Insert processed_events row (or skip if duplicate delivery)
        const insert = await em
          .createQueryBuilder()
          .insert()
          .into(ProcessedEvent)
          .values({ consumerName: 'task_projection_consumer', eventId: msg.eventId, receivedAt: new Date(), processedAt: new Date(), outcome: 'applied' })
          .orIgnore()  // ON CONFLICT DO NOTHING
          .execute();
        if (insert.identifiers.length === 0) {
          // Duplicate delivery → no-op; XACK after commit
          return;
        }
        // 2. Apply the mutation
        switch (msg.kind) {
          case 'record.write': await this.upsertProjection(em, msg); break;
          case 'record.delete': await this.tombstoneProjection(em, msg); break;
          case 'rule.invalidate': await this.markBucketRebuilding(em, msg); break;
        }
      });
      // 3. XACK ONLY AFTER transaction commits — Redis Streams ack semantics
      await this.ackOutboxMessage(msg);
    }
  }

  private async upsertProjection(em: EntityManager, msg: OutboxMessage): Promise<void> {
    // a. Resolve the taskable capability for the source collection
    const cap = await this.capabilityRegistry.getCapability(msg.collectionId);
    if (!cap || !cap.projectionEnabled) return;
    // b. Read the source row at msg.recordId; apply field_mapping
    const source = await em.findOne(/* dynamic */, { where: { id: msg.recordId } });
    if (!source) return;
    const projectionRow = this.mapToProjection(source, cap);
    // c. Filter attrs_jsonb to only the pack-declared projection_safe keys (per §3.2 attrs schema)
    projectionRow.attrsJsonb = this.filterToProjectionSafe(projectionRow.attrsJsonb, cap);
    // d. Compute customer_acl_hash via §28 cache
    projectionRow.customerAclHash = await this.authzService.computeAclBucketHash(msg.collectionId, source);
    // e. UPSERT — idempotent
    await em
      .createQueryBuilder()
      .insert()
      .into(TaskProjection)
      .values(projectionRow)
      .orUpdate(/* all columns except id+task_kind */)
      .execute();
    // f. Update lag cursor
    await em
      .createQueryBuilder()
      .update(TaskProjectionLag)
      .set({ lastOutboxSeq: msg.seq, lastProjectedAt: new Date() })
      .where({ collectionId: msg.collectionId })
      .execute();
  }

  private async tombstoneProjection(em: EntityManager, msg: OutboxMessage): Promise<void> {
    await em
      .createQueryBuilder()
      .update(TaskProjection)
      .set({ deletedAt: new Date() })
      .where({ id: msg.recordId, taskKind: msg.taskKind })
      .execute();
  }

  private async markBucketRebuilding(em: EntityManager, msg: OutboxMessage): Promise<void> {
    // Mark the lag row as bucket_rebuilding; the reconciler picks up affected rows asynchronously
    await em.update(TaskProjectionLag, { collectionId: msg.collectionId }, { bucketRebuilding: true });
    // Schedule a follow-up batch job to re-project affected rows
  }
}
```

**File:** `apps/worker/src/projections/task-projection/task-projection.reconciler.ts` (NEW) — scheduled daily; diffs source ↔ projection per partition pair; emits missing/orphan/stale-by-version repair operations. Uses `ACCESS SHARE` lock only on active partitions.

**File:** `apps/api/src/app/views/list-reader.service.ts` (extends existing) — adds the circuit-breaker logic:

```typescript
async listTasks(query: ListQuery, ctx: RequestContext): Promise<ListResult> {
  const cap = await this.capabilityRegistry.getCapability(query.collectionId);
  if (!cap || !cap.projectionEnabled) throw new BadRequestException('Collection is not projection-enabled');

  const lag = await this.lagRepo.findOne({ where: { collectionId: query.collectionId } });
  if (lag && lag.lagSeconds > lag.circuitOpenAboveSeconds) {
    // CIRCUIT OPEN — serve stale + banner; DO NOT fallback to source on list endpoints
    return this.servStaleWithBanner(query, ctx, lag.lastProjectedAt);
  }

  // Normal path: §28 evaluator pre-filters via customer_acl_hash bucket
  const buckets = await this.authzService.getApplicableAclBuckets(query.collectionId, ctx);
  const candidates = await this.projectionRepo.find({
    where: { sourceCollectionId: query.collectionId, customerAclHash: In(buckets), deletedAt: IsNull() },
    take: query.limit, skip: query.offset,
  });
  // Final post-filter through centralized authz (the security gate)
  const visible = await this.authzService.applyRowConditions(candidates, ctx);
  // Field-masking on the projection-safe attrs
  return this.authzService.applyFieldMasking(visible, ctx);
}
```

#### 13.3.5 API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/views/:viewId/list` | `@Roles` per view | List endpoint (circuit-breaker gated) — returns `{ rows, totalCount, isStale, staleAsOf, bannerMessage? }` |
| `GET` | `/projection/:collectionId/lag` | `@Roles('maintenance_admin', 'ops')` | Operations endpoint — returns `task_projection_lag` row |
| `POST` | `/projection/:collectionId/rebuild` | `@Roles('platform_admin')` | Manual reconciler trigger for a single collection |
| `GET` | `/projection/:taskKind/_health` | `@AllowServiceToken @RequireServiceScope('projection:read')` | Internal health check for monitoring; returns lag + last-projected timestamp |

#### 13.3.6 Validator extensions

Pack publish validator (`apps/api/src/app/metadata/packs/pack-validator.service.ts`):

1. **Projection_safe attrs schema gate.** For every collection with `taskable_capabilities.projection_enabled = true`, the pack manifest must declare `task_projection.attrs[]` schema. Every attrs key has `projection_safe: true` AND `confidentiality_class ∈ {public, internal}`. Validator refuses publish with structured error if attrs key references a property whose `confidentiality_class` is `sensitive` / `never_reveal` / etc.
2. **Task_kind uniqueness gate.** No two pack-declared taskable collections may share the same `task_kind` value within the same instance. Validator refuses publish on conflict.
3. **field_mapping cross-pack collision.** If a collection's `field_mapping` references properties from another pack (e.g., a clinical overlay references a maintenance-core property), the pack-dependency graph must include that pack and the property must exist at publish-eval time.

#### 13.3.7 Service-boundary scanner rules

```typescript
// tools/service-boundary-check.ts entries
'data.task_projection': {
  writers: ['apps/worker/src/projections/task-projection/**'],
  readers: ['apps/api/src/app/views/**', 'apps/api/src/app/search/**', 'apps/api/src/app/ai/**'],
  /* No direct API-process writes — list endpoint is read-only on this table. */
},
'data.task_projection_archive': {
  writers: ['apps/worker/src/archive/partition-steward.job.ts'],
  readers: ['apps/api/src/app/archive/**'],
},
'data.task_projection_lag': {
  writers: ['apps/worker/src/projections/task-projection/**'],
  readers: ['apps/api/src/app/views/**', 'apps/api/src/app/ops/**'],
},
'automation.processed_events': {
  writers: ['apps/worker/src/projections/**', 'apps/worker/src/maintenance/**', 'apps/worker/src/observations/**'],
  readers: ['apps/api/src/app/ops/**'],
},
```

**Bulk-import bypass allowlist** (per §7 risk #1 mitigation): explicit allowlist entries in `service-boundary-check.ts` for `apps/api/src/app/import/bulk-import-projection-write.service.ts` to write `task_projection` rows in the same transaction as the source row, named with a comment explaining the architectural carve-out.

#### 13.3.8 Tests (self-test ≥ 15 assertions)

1. Insert a `taskable_capability` for a synthetic collection → consumer wakes → outbox row → projection upsert → row visible via list endpoint.
2. Duplicate delivery: send the same outbox event twice → `processed_events` insert succeeds first time, fails (ON CONFLICT) second time → `task_projection` upserted exactly once.
3. `record.delete` event → projection row gets `deleted_at` set → list endpoint excludes the row → archive partition steward later moves it.
4. `rule.invalidate` event → lag row's `bucket_rebuilding = true` → reconciler picks up affected rows → ACL bucket recomputed → `bucket_rebuilding` flips false on completion.
5. **Circuit breaker:** inject lag of 60s on one task_kind → list endpoint returns `isStale: true` + banner + serves last-projected rows → NO source-table queries fired (verified via DB query log).
6. **Single-record fallback:** circuit open → single-record fetch endpoint still queries source-table → returns the freshest data.
7. **Reconciler diff:** seed 100 source rows; delete 5 directly from projection; run reconciler → 5 missing-in-projection diff entries surfaced → reproject restores them.
8. **Reconciler ACCESS SHARE only:** during reconciler run, concurrent INSERTs into the source partition succeed without blocking (verified via pg_stat_activity).
9. **Bulk-import bypass:** 200k WO bulk import → projection rows + source rows written in same transaction via the allowlisted path → no queue saturation.
10. **Tombstone GC:** rows with `deleted_at < now() - 7 days` GC'd by partition steward; archive partition contains them.
11. **Partition steward:** closed rows older than `archive_age_months` (default 24) get detached from active partition + attached to archive.
12. **Projection_safe filtering:** an `attrs_jsonb` value containing a key not in the pack-declared schema is REJECTED at consumer write time + logged as RuntimeAnomaly.
13. **task_kind uniqueness:** publishing a second pack with the same task_kind fails with structured error.
14. **Bigint serialization:** `last_outbox_seq` is stored and read correctly as bigint (not lossy on values > 2^53).
15. **Authz post-filter:** synthetic deny rule edited → centralized post-filter excludes the affected rows even before the rebuild lands; stale-projection-cannot-grant-access verified.

Integration tests in `apps/api/test/integration/task-projection.spec.ts` and `apps/worker/test/integration/task-projection-consumer.spec.ts`.

#### 13.3.9 PR breakdown for §3.2

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Tables + migrations | 4 migration files; `data` + `automation` schemas | All migrations run forward + backward; baseline empty; scanner pass |
| 2 | TypeORM entities + module wiring | `libs/instance-db/src/lib/entities/projection.entity.ts`; index update | Entities load in `instanceEntities`; `TypeOrmModule.forFeature` wired |
| 3 | ProcessedEvent ledger + idempotency helper | New `libs/instance-db/src/lib/projection/processed-event.helper.ts` exposing `consumeIdempotently()` | Self-test: duplicate insert returns no-op; ON CONFLICT works |
| 4 | TaskProjectionConsumer (worker) — happy path | `apps/worker/src/projections/task-projection/task-projection.consumer.ts`; Redis Consumer Group wiring | Outbox event → projection upsert → idempotent on replay |
| 5 | TaskProjectionConsumer — tombstone + rule.invalidate paths | Same consumer extended | Self-test cases 3, 4 pass |
| 6 | TaskProjectionReconciler (worker) | `task-projection.reconciler.ts` | Self-test cases 7, 8 pass |
| 7 | List endpoint with circuit-breaker | `apps/api/src/app/views/list-reader.service.ts` extension | Self-test case 5 pass: zero source-table queries when circuit open |
| 8 | Bulk-import bypass + service-boundary allowlist | `apps/api/src/app/import/bulk-import-projection-write.service.ts` + scanner entry | 200k-row import doesn't saturate queue |
| 9 | Partition steward — active/archive transitions | `apps/worker/src/archive/partition-steward.job.ts` | Self-test case 11 pass |
| 10 | Pack validator extensions — projection_safe attrs + task_kind uniqueness | `pack-validator.service.ts` extensions | Self-test cases 12, 13 pass |
| 11 | Authz integration — bucket hash + post-filter wiring | `apps/api/src/app/views/list-reader.service.ts` + `authorization.service.ts` extension | Self-test case 15 pass; §28 evaluator verified |
| 12 | Canon §34 amendment + ops dashboard endpoints + docs | `CLAUDE.md`; lag/health endpoints; `docs/operations/task-projection-runbook.md` | Canon merged; runbook published; smoke test on perf-staging confirms circuit-breaker behavior under burst |

**Total: 12 PRs for §3.2. Estimated effort: ~10-12 working days for one engineer + AI agents.**

---

### 13.4 Worked example: §3.3 Scheduling Primitives (full artifact-level spec)

#### 13.4.1 Tables

All tables live in `schema: 'automation'`. All are platform-generic — no asset/PM/WO domain coupling. Pack-level semantics bound on top at consumer time.

**`automation.recurrence_definitions`** — reusable RRULE templates.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `code` | `varchar(120)` | — | NOT NULL | UNIQUE per instance — packs reference by code (stable across upgrades) |
| `name` | `varchar(255)` | — | NOT NULL | Human-readable |
| `rrule` | `text` | — | NOT NULL | RFC 5545 RRULE string, e.g. `FREQ=MONTHLY;BYMONTHDAY=1;COUNT=120` |
| `timezone` | `varchar(64)` | `'UTC'` | NOT NULL | IANA timezone name; affects DST boundaries |
| `business_hours_id` | `uuid` | — | NULL | FK → `automation.business_hours(id)`; if set, recurrence fires only within business hours |
| `blackout_calendar_id` | `uuid` | — | NULL | FK → `automation.blackout_calendars(id)`; firings inside blackout dates are skipped |
| `is_active` | `boolean` | `true` | NOT NULL | — |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `updated_at` | `timestamptz` | `now()` | NOT NULL | Trigger-maintained |
| `source` | `varchar(64)` | `'pack'` | NOT NULL | `pack` / `customer` |

Indexes: PK on `(id)`; UNIQUE on `(code)`; `ix_recurrence_active ON (is_active) WHERE is_active = true`.

**`automation.suppression_windows`** — time-bounded suppression for scheduled generation.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `code` | `varchar(120)` | — | NOT NULL | UNIQUE |
| `name` | `varchar(255)` | — | NOT NULL | — |
| `start_at` | `timestamptz` | — | NOT NULL | — |
| `end_at` | `timestamptz` | — | NOT NULL | CHECK (`end_at > start_at`) |
| `reason` | `text` | — | NULL | Human-readable suppression rationale; written into `audit_logs` when a generation is suppressed |
| `scope` | `varchar(64)` | `'global'` | NOT NULL | `global` / `collection` / `record` — determines breadth |
| `scope_collection_id` | `uuid` | — | NULL | FK → `metadata.collection_definitions(id)`; required when `scope = 'collection'` or `'record'` |
| `scope_record_id` | `uuid` | — | NULL | Required when `scope = 'record'` |
| `is_active` | `boolean` | `true` | NOT NULL | — |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `source` | `varchar(64)` | `'customer'` | NOT NULL | — |

Indexes: PK; UNIQUE `(code)`; `ix_suppression_active_range ON (start_at, end_at) WHERE is_active = true`; partial `ix_suppression_scope_record ON (scope_collection_id, scope_record_id) WHERE scope = 'record' AND is_active = true`.

**`automation.blackout_calendars`** — date-range exclusion sets.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `code` | `varchar(120)` | — | NOT NULL | UNIQUE |
| `name` | `varchar(255)` | — | NOT NULL | e.g., "US Federal Holidays 2026", "Hospital Closure 2026-12-25" |
| `dates` | `jsonb` | `'[]'::jsonb` | NOT NULL | Array of `{date: ISO-8601, label?: string}` entries OR RRULE for recurring holidays |
| `recurrence_rrule` | `text` | — | NULL | Optional RRULE for recurring blackouts (e.g., every US federal holiday) |
| `timezone` | `varchar(64)` | `'UTC'` | NOT NULL | — |
| `is_active` | `boolean` | `true` | NOT NULL | — |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `source` | `varchar(64)` | `'pack'` | NOT NULL | — |

Indexes: PK; UNIQUE `(code)`; `ix_blackout_active ON (is_active) WHERE is_active = true`; GIN `(dates jsonb_path_ops)` per Plan Fix 26.

**`automation.shift_calendars`** — technician shift bindings (extends `BusinessHours` semantics).

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `code` | `varchar(120)` | — | NOT NULL | UNIQUE |
| `name` | `varchar(255)` | — | NOT NULL | — |
| `timezone` | `varchar(64)` | `'UTC'` | NOT NULL | — |
| `shifts` | `jsonb` | `'[]'::jsonb` | NOT NULL | Array of `{dayOfWeek: 0-6, start: 'HH:MM', end: 'HH:MM', code: string}` |
| `technician_group_id` | `uuid` | — | NULL | FK → `identity.groups(id)`; binds shift to a tech group |
| `is_active` | `boolean` | `true` | NOT NULL | — |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

Indexes: PK; UNIQUE `(code)`; `ix_shift_group ON (technician_group_id) WHERE technician_group_id IS NOT NULL AND is_active = true`.

**`automation.generation_runs`** — generic idempotency ledger for ANY scheduled-generation domain (PM-from-schedule, scheduled-inspection, recurring-permit, etc.). Platform-generic; no asset/PM/WO knowledge.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `source_collection_id` | `uuid` | — | NOT NULL | The schedule's collection (e.g., `pm_schedule` for PM generation) |
| `source_record_id` | `uuid` | — | NOT NULL | The schedule's record (e.g., a specific PM schedule) |
| `subject_collection_id` | `uuid` | — | NOT NULL | What the generation acts ON (e.g., `asset` for PM, `space` for recurring inspection) |
| `subject_record_id` | `uuid` | — | NOT NULL | The specific subject (e.g., a specific asset) |
| `fire_at` | `timestamptz` | — | NOT NULL | The scheduled fire time |
| `generated_collection_id` | `uuid` | — | NOT NULL | What was generated (e.g., `maintenance_work_order`) |
| `generated_record_id` | `uuid` | — | NULL | NULL until generation succeeds; populated on insert success |
| `idempotency_key` | `text` | — | NOT NULL | **UNIQUE** — typically `${source_collection_code}/${source_record_id}/${subject_record_id}/${fire_at_iso}`; the unique constraint is the correctness gate |
| `run_kind` | `varchar(64)` | — | NOT NULL | Pack-defined; e.g., `pm_generation`, `inspection_generation`, `recurring_permit` |
| `suppressed_by` | `uuid` | — | NULL | FK → `automation.suppression_windows(id)` if a suppression caused skip |
| `status` | `varchar(32)` | `'pending'` | NOT NULL | `pending` / `generated` / `suppressed` / `failed` |
| `error_message` | `text` | — | NULL | Failure detail when `status = 'failed'` |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

Indexes:
- PK on `(id)`
- **UNIQUE `(idempotency_key)`** — the correctness gate (not check-then-write); second scoop fails INSERT and skips
- `ix_generation_source ON (source_collection_id, source_record_id)` — for "show me all WOs generated from this schedule"
- `ix_generation_subject ON (subject_collection_id, subject_record_id)` — for "show me all generations against this asset"
- `ix_generation_fire_at ON (fire_at) WHERE status = 'pending'` — for retry sweep
- `ix_generation_run_kind ON (run_kind)` — operational filter

#### 13.4.2 Migrations

1. `1937200000000-add-recurrence-definitions.ts` — creates `automation.recurrence_definitions` + index.
2. `1937200000001-add-suppression-windows.ts` — creates `automation.suppression_windows` + indexes; includes the CHECK constraint on `end_at > start_at`.
3. `1937200000002-add-blackout-calendars.ts` — creates `automation.blackout_calendars` + GIN index on `dates`.
4. `1937200000003-add-shift-calendars.ts` — creates `automation.shift_calendars`.
5. `1937200000004-add-generation-runs.ts` — creates `automation.generation_runs` + ALL indexes including the UNIQUE `(idempotency_key)` (the load-bearing one).

All migrations stand alone; no inter-table dependencies that force ordering. Five small migrations rather than one mega-migration so each can be reverted independently if needed.

#### 13.4.3 TypeORM entities

**New file:** `libs/instance-db/src/lib/entities/scheduling.entity.ts`

```typescript
@Entity({ schema: 'automation', name: 'recurrence_definitions' })
@Unique(['code'])
export class RecurrenceDefinition {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('varchar', { length: 120 }) code: string;
  @Column('varchar', { length: 255 }) name: string;
  @Column('text') rrule: string;
  @Column('varchar', { length: 64, default: 'UTC' }) timezone: string;
  @Column('uuid', { name: 'business_hours_id', nullable: true }) businessHoursId?: string;
  @ManyToOne(() => BusinessHours) @JoinColumn({ name: 'business_hours_id' }) businessHours?: BusinessHours;
  @Column('uuid', { name: 'blackout_calendar_id', nullable: true }) blackoutCalendarId?: string;
  @Column('boolean', { name: 'is_active', default: true }) isActive: boolean;
  @Column('timestamptz', { name: 'created_at', default: () => 'now()' }) createdAt: Date;
  @Column('timestamptz', { name: 'updated_at', default: () => 'now()' }) updatedAt: Date;
  @Column('varchar', { length: 64, default: 'pack' }) source: string;
}

@Entity({ schema: 'automation', name: 'suppression_windows' })
@Unique(['code'])
@Check('"end_at" > "start_at"')
export class SuppressionWindow {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('varchar', { length: 120 }) code: string;
  @Column('varchar', { length: 255 }) name: string;
  @Column('timestamptz', { name: 'start_at' }) startAt: Date;
  @Column('timestamptz', { name: 'end_at' }) endAt: Date;
  @Column('text', { nullable: true }) reason?: string;
  @Column('varchar', { length: 64, default: 'global' }) scope: 'global' | 'collection' | 'record';
  @Column('uuid', { name: 'scope_collection_id', nullable: true }) scopeCollectionId?: string;
  @Column('uuid', { name: 'scope_record_id', nullable: true }) scopeRecordId?: string;
  @Column('boolean', { name: 'is_active', default: true }) isActive: boolean;
  @Column('timestamptz', { name: 'created_at', default: () => 'now()' }) createdAt: Date;
  @Column('varchar', { length: 64, default: 'customer' }) source: string;
}

@Entity({ schema: 'automation', name: 'blackout_calendars' })
@Unique(['code'])
export class BlackoutCalendar {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('varchar', { length: 120 }) code: string;
  @Column('varchar', { length: 255 }) name: string;
  @Column('jsonb', { default: () => `'[]'::jsonb` }) dates: Array<{ date: string; label?: string }>;
  @Column('text', { name: 'recurrence_rrule', nullable: true }) recurrenceRrule?: string;
  @Column('varchar', { length: 64, default: 'UTC' }) timezone: string;
  @Column('boolean', { name: 'is_active', default: true }) isActive: boolean;
  @Column('timestamptz', { name: 'created_at', default: () => 'now()' }) createdAt: Date;
  @Column('varchar', { length: 64, default: 'pack' }) source: string;
}

@Entity({ schema: 'automation', name: 'shift_calendars' })
@Unique(['code'])
export class ShiftCalendar {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('varchar', { length: 120 }) code: string;
  @Column('varchar', { length: 255 }) name: string;
  @Column('varchar', { length: 64, default: 'UTC' }) timezone: string;
  @Column('jsonb', { default: () => `'[]'::jsonb` }) shifts: Array<{ dayOfWeek: number; start: string; end: string; code: string }>;
  @Column('uuid', { name: 'technician_group_id', nullable: true }) technicianGroupId?: string;
  @Column('boolean', { name: 'is_active', default: true }) isActive: boolean;
  @Column('timestamptz', { name: 'created_at', default: () => 'now()' }) createdAt: Date;
}

@Entity({ schema: 'automation', name: 'generation_runs' })
@Unique(['idempotencyKey'])
@Index(['sourceCollectionId', 'sourceRecordId'])
@Index(['subjectCollectionId', 'subjectRecordId'])
export class GenerationRun {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'source_collection_id' }) sourceCollectionId: string;
  @Column('uuid', { name: 'source_record_id' }) sourceRecordId: string;
  @Column('uuid', { name: 'subject_collection_id' }) subjectCollectionId: string;
  @Column('uuid', { name: 'subject_record_id' }) subjectRecordId: string;
  @Column('timestamptz', { name: 'fire_at' }) fireAt: Date;
  @Column('uuid', { name: 'generated_collection_id' }) generatedCollectionId: string;
  @Column('uuid', { name: 'generated_record_id', nullable: true }) generatedRecordId?: string;
  @Column('text', { name: 'idempotency_key' }) idempotencyKey: string;
  @Column('varchar', { length: 64, name: 'run_kind' }) runKind: string;
  @Column('uuid', { name: 'suppressed_by', nullable: true }) suppressedBy?: string;
  @Column('varchar', { length: 32, default: 'pending' }) status: 'pending' | 'generated' | 'suppressed' | 'failed';
  @Column('text', { name: 'error_message', nullable: true }) errorMessage?: string;
  @Column('timestamptz', { name: 'created_at', default: () => 'now()' }) createdAt: Date;
}
```

Register all five entities in `libs/instance-db/src/lib/entities/index.ts`.

#### 13.4.4 Services + RRULE library

**New library:** `libs/scheduling/` (Nx-buildable library, importable as `@hubblewave/scheduling`).

- Wraps `rrule.js` (battle-tested RFC 5545 implementation; MIT licensed).
- Exports `evaluateRRule(rrule: string, from: Date, until: Date, timezone: string): Date[]` returning all fire times in window.
- Exports `applyBlackoutMask(fireTimes: Date[], blackoutCalendarId: string): Promise<Date[]>` filtering out blackout dates.
- Exports `applyBusinessHours(fireTime: Date, businessHoursId?: string): Promise<Date>` shifting fire time to the next valid business-hours window if it falls outside.
- Exports `applyShiftMask(fireTime: Date, shiftCalendarId?: string): Promise<{within: boolean, nextValid: Date}>`.
- Self-test corpus of ≥ 20 RRULE strings with expected fire times across DST boundaries (high-stakes correctness; RRULE bugs are insidious).

**New worker service:** `apps/worker/src/scheduling/generation.service.ts` — the generic generation dispatcher.

```typescript
@Injectable()
export class GenerationDispatcher {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scheduling: SchedulingService, // wraps libs/scheduling
    private readonly logger: Logger,
  ) {}

  /** Called periodically (e.g., every 5 minutes) per registered run_kind. */
  async dispatchPending(input: DispatchInput): Promise<DispatchResult> {
    // 1. Query all active schedules for input.runKind (e.g., pm_schedule rows with is_active = true)
    //    Each schedule has a recurrence_definition_id; resolve the RRULE.
    // 2. For each schedule, compute fire times in the [now, now + lookahead_minutes] window.
    // 3. For each fire time per subject record:
    //    a. Build idempotency_key
    //    b. Check active suppression_windows scoping to this subject/collection
    //    c. INSERT INTO generation_runs ... ON CONFLICT (idempotency_key) DO NOTHING
    //    d. If insert succeeded:
    //       - if suppressed → mark status=suppressed, suppressed_by=window_id, write audit
    //       - else → invoke the pack-registered handler (e.g., maintenance-core's create-WO action)
    //         on success: UPDATE generation_runs SET status='generated', generated_record_id=...
    //         on failure: status='failed', error_message=..., RuntimeAnomaly emitted
  }
}
```

The dispatcher is **generic** — the maintenance-core pack provides a handler for `run_kind = 'pm_generation'` that creates `maintenance_work_order` rows. The platform never references `pm_schedule` or `maintenance_work_order` by name.

#### 13.4.5 API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/automation/recurrences` | `@Roles('automation_admin')` | List all recurrence definitions |
| `POST` | `/automation/recurrences` | `@Roles('automation_admin')` | Create recurrence definition; validates RRULE via `libs/scheduling` parser |
| `PUT` | `/automation/recurrences/:id` | `@Roles('automation_admin')` | Update; deactivating an in-use recurrence refuses via W2.A reference-checker |
| `POST` | `/automation/suppression-windows` | `@Roles('automation_admin', 'maintenance_admin')` | Create suppression window |
| `POST` | `/automation/blackout-calendars` | `@Roles('automation_admin')` | — |
| `POST` | `/automation/shift-calendars` | `@Roles('automation_admin', 'hr_admin')` | — |
| `GET` | `/automation/generation-runs` | `@Roles('automation_admin', 'maintenance_admin')` | Filterable list of generation runs; shows status + suppressed_by + error_message |
| `POST` | `/automation/generation-runs/:id/retry` | `@Roles('automation_admin')` | Retry a failed generation (must be `status = failed`) |

#### 13.4.6 Validator extensions

Pack-publish validator:
1. **RRULE validity gate.** Every `recurrence_definition` declared in a pack manifest is parsed via `libs/scheduling.evaluateRRule()` against a 1-year horizon. Validator refuses publish if RRULE fails to parse or generates zero fire times.
2. **Suppression-window scope gate.** A `scope = 'record'` suppression window's `scope_record_id` must resolve to an existing record in `scope_collection_id`.
3. **`run_kind` namespace gate.** Pack-declared run_kinds must be prefixed with the pack id (e.g., `maintenance-core/pm_generation`) to prevent collision across packs.

#### 13.4.7 Service-boundary scanner rules

```typescript
'automation.recurrence_definitions': { writers: ['apps/api/src/app/automation/scheduling/**'], readers: ['apps/worker/src/scheduling/**'] },
'automation.suppression_windows': { writers: ['apps/api/src/app/automation/scheduling/**'], readers: ['apps/worker/src/scheduling/**'] },
'automation.blackout_calendars': { writers: ['apps/api/src/app/automation/scheduling/**'], readers: ['apps/worker/src/scheduling/**', 'apps/worker/src/maintenance/**'] },
'automation.shift_calendars': { writers: ['apps/api/src/app/automation/scheduling/**'], readers: ['apps/worker/src/maintenance/**', 'apps/api/src/app/views/**'] },
'automation.generation_runs': { writers: ['apps/worker/src/scheduling/**'], readers: ['apps/api/src/app/automation/scheduling/**'] },
```

#### 13.4.8 Tests (self-test ≥ 15 assertions)

1. RRULE library: 20-entry corpus of RFC 5545 strings → expected fire times match (DST boundaries, leap years, end-of-month edge cases).
2. Generation idempotency: two concurrent worker pods dispatch the same schedule for the same subject + fire_at → only one `generation_runs` row created; the other INSERT fails on UNIQUE.
3. Suppression: a fire time inside an active suppression window → row gets `status = 'suppressed'`, `suppressed_by = window_id`, audit row written.
4. Blackout calendar mask: RRULE that would fire on a holiday → masked out → no `generation_runs` insert.
5. Business-hours mask: fire time outside business hours → shifted to next valid window per `BusinessHours.id` policy.
6. Shift calendar mask: a `pm_generation` for a technician group whose shift calendar is "M-F 8am-5pm" + fire time at Saturday 2am → next valid Monday morning slot.
7. Pack-validator RRULE failure: malformed RRULE → publish refused with structured error.
8. Pack-validator run_kind namespace: an un-namespaced `run_kind` fails publish.
9. Failed generation: handler throws → `status = 'failed'`, `error_message` populated, `RuntimeAnomaly` row inserted.
10. Retry endpoint: retry of a failed generation → handler re-invoked; on success, `status = 'generated'`.
11. Scope-record suppression validator: a window with `scope_record_id` referencing a deleted record fails publish.
12. Recurrence reference-check (W2.A): deleting a `recurrence_definition` referenced by an active `pm_schedule` refuses with structured "in-use" error.
13. DST forward-shift correctness: an RRULE firing at 2:30am on a DST-spring-forward day → resolved to 3:30am same day (not skipped).
14. DST backward-shift correctness: an RRULE firing at 1:30am on a DST-fall-back day → fires once (not twice).
15. Cross-month boundary: an RRULE with `FREQ=MONTHLY;BYMONTHDAY=31` → February → no fire (not Feb 28/29 fallback unless explicitly configured).

Integration tests in `apps/worker/test/integration/generation-dispatcher.spec.ts` exercise the full path against a Postgres testcontainer.

#### 13.4.9 PR breakdown for §3.3

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Tables + migrations | 5 migration files | All migrations forward + backward; scanner pass |
| 2 | TypeORM entities + module wiring | `libs/instance-db/src/lib/entities/scheduling.entity.ts`; index update | Entities load in `instanceEntities` |
| 3 | `libs/scheduling/` RRULE wrapper + self-test corpus | `libs/scheduling/src/` (Nx lib); 20-test corpus | Self-test ≥ 20 RRULE assertions pass including DST edge cases |
| 4 | `GenerationDispatcher` worker service | `apps/worker/src/scheduling/generation.service.ts`; BullMQ wiring | Self-test cases 2, 3, 9 pass |
| 5 | API endpoints (recurrence/suppression/blackout/shift CRUD + generation-runs read + retry) | `apps/api/src/app/automation/scheduling/`; 8 controllers/services | Integration tests for all 8 endpoints; authz verified |
| 6 | Pack validator extensions | `pack-validator.service.ts` extensions | Self-test cases 7, 8, 11 pass |

**Total: 6 PRs for §3.3. Estimated effort: ~5-7 working days.**

---

### 13.5 Worked example: §3.4 List-Scale Primitives (full artifact-level spec)

#### 13.5.1 Tables

**`data.list_snapshots`** — materialized list-view snapshots for huge canned views (e.g., "All Open WOs in Building 5") that get re-served from snapshot for short TTLs.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `view_id` | `uuid` | — | NOT NULL | FK → `metadata.view_definitions(id)` |
| `scope_principal` | `varchar(255)` | — | NOT NULL | Hash of `(user_id, role_set, group_set)` — snapshots are principal-scoped so masking is precomputed for the scoping principal |
| `query_hash` | `bytea(32)` | — | NOT NULL | SHA-256 of canonical query (view_id + filters + sort) — enables cache hits for identical queries |
| `total_rows` | `int` | — | NOT NULL | Pre-computed row count (avoids re-counting on each pagination request) |
| `generated_at` | `timestamptz` | `now()` | NOT NULL | When snapshot was built |
| `ttl_at` | `timestamptz` | — | NOT NULL | Snapshot becomes invalid after `ttl_at`; default `generated_at + 5 min` per view-config override |
| `builder_event_id` | `uuid` | — | NULL | Event that triggered build (for traceability) |

**Indexes:**
- PK on `(id)`
- `ux_list_snapshot_query` UNIQUE ON `(view_id, scope_principal, query_hash)` WHERE `ttl_at > now()` — at most one active snapshot per (view, principal, query) tuple
- `ix_list_snapshot_ttl` ON `(ttl_at)` WHERE `ttl_at < now()` — for GC sweep

**`data.list_snapshot_rows`** — actual row payloads, partitioned by `snapshot_id`.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `snapshot_id` | `uuid` | — | NOT NULL | LIST partition key (so all rows for one snapshot live in one partition; dropping a snapshot = drop partition) |
| `position` | `int` | — | NOT NULL | 0-indexed position within snapshot for stable pagination |
| `source_record_id` | `uuid` | — | NOT NULL | Reference back to source row |
| `payload_jsonb` | `jsonb` | — | NOT NULL | Denormalized projection-safe + masked-per-principal payload |

**Partitioning:** `PARTITION BY LIST (snapshot_id)`. Each new snapshot gets a new sub-partition; `ttl_at` expiry → drop the partition (instant, no row-by-row delete).

**Indexes** (per sub-partition):
- PK on `(snapshot_id, position)`

#### 13.5.2 Active/archive partitioning policy (codified per `taskable_capability`)

This is NOT a new table — it's a per-capability configuration in `metadata.taskable_capabilities`:

Adds a new column to `metadata.taskable_capabilities`:
- `archive_age_months` `int` `NOT NULL` `DEFAULT 24` — closed records older than this age move from active to archive partition tree. Editable per pack.

The worker job `apps/worker/src/archive/partition-steward.job.ts` (already declared §9) reads each capability's `archive_age_months` and detaches `*_old_*` partitions from the active parent, attaches them to the archive parent. **Archive partitions are NEVER deleted** — only detached and re-attached to the archive tree. Compliance §10 (7-year retention) requires this.

#### 13.5.3 Mobile list payload + Archive query facade

**Mobile list payload service:** `apps/api/src/app/mobile/mobile-list-payload.service.ts` (NEW)

Endpoint: `GET /mobile/tasks/sync?since=<timestamp>&kind=<task_kind>&assigned_to=<user_id>`. Returns a hyper-dense JSON for WatermelonDB: one row per task with denormalized `{wo, asset, location, due_at, parts_ready, last_checklist_state}` chips pulled from `task_projection.attrs_jsonb` (per §3.2 projection_safe gate). Selective sync per `mobile_sync_policies` (§3.7).

**Archive query facade:** `apps/api/src/app/archive/archive-query-facade.service.ts` (NEW)

Endpoint: `GET /archive/tasks?from=<iso>&to=<iso>&filters=...`. Opens cold partitions explicitly via Postgres `ALTER TABLE ... ATTACH PARTITION` (or equivalent partition-aware query). Slow (minutes); audited via `audit_logs` with `purpose = regulator_archive_query`; Compliance Officer + Auditor Kiosk session principals authorized.

#### 13.5.4 PR breakdown for §3.4

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Tables + migrations | 2 migration files (`list_snapshots`, `list_snapshot_rows` partitioned root) + 1 alter on `taskable_capabilities` (add `archive_age_months`) | Migrations + scanner pass |
| 2 | Snapshot builder worker | `apps/worker/src/projections/list-snapshot-builder.service.ts` | Self-test: build snapshot from a 100k-row view; subsequent identical query returns from snapshot in <50ms |
| 3 | Mobile list payload endpoint | `apps/api/src/app/mobile/mobile-list-payload.service.ts` + controller | Self-test: `GET /mobile/tasks/sync` returns <1MB for one technician's day |
| 4 | Archive query facade + partition steward extensions | `apps/api/src/app/archive/`; `apps/worker/src/archive/partition-steward.job.ts` extensions | Self-test: detach a closed-WO partition older than 24 months → archive query still returns its rows; active list view does not |

**Total: 4 PRs for §3.4. Estimated effort: ~4 working days.**

---

### 13.6 Worked example: §3.5 Time-Series Observations (full artifact-level spec — second-largest substrate section)

#### 13.6.1 Tables

All tables live in `schema: 'observations'` (NEW dedicated schema). Subject binding is generic — `subject_collection_id` + `subject_record_id` + `stream_kind` — no asset/meter coupling at the platform layer.

**`observations.observation_streams`** — one row per addressable time-series stream.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `code` | `varchar(120)` | — | NOT NULL | UNIQUE per instance |
| `subject_collection_id` | `uuid` | — | NOT NULL | FK → `metadata.collection_definitions(id)`. Generic: maintenance pack binds asset; the platform doesn't know what an asset is |
| `subject_record_id` | `uuid` | — | NOT NULL | The specific subject (e.g., a specific asset record) |
| `stream_kind` | `varchar(64)` | — | NOT NULL | Pack-defined vocabulary; e.g., `meter`, `setpoint`, `sensor`, `gps_lat`, `engine_rpm` |
| `unit_code` | `varchar(32)` | — | NOT NULL | FK → `observation_units(code)` |
| `data_type` | `varchar(32)` | — | NOT NULL | `numeric` / `boolean` / `enum` |
| `source_adapter` | `varchar(64)` | — | NOT NULL | `bacnet` / `modbus` / `hl7` / `manual` / `mqtt` / `webhook` / `obd2-telematics-feed` / `wifi-beacon-occupancy` |
| `expected_interval_seconds` | `int` | — | NULL | Expected cadence; gap-detection alarms reference this |
| `quality_floor` | `varchar(20)` | `'good'` | NOT NULL | Minimum acceptable quality tag; readings below this are dropped |
| `retention_days` | `int` | `365` | NOT NULL | Per-stream retention; partition-steward respects |
| `rollup_policy_id` | `uuid` | — | NULL | FK → `observation_rollup_policies(id)`; controls which rollup tables are maintained |
| `is_active` | `boolean` | `true` | NOT NULL | — |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `updated_at` | `timestamptz` | `now()` | NOT NULL | Trigger-maintained |

Indexes: PK; UNIQUE `(code)`; `ix_streams_subject ON (subject_collection_id, subject_record_id)`; `ix_streams_active ON (is_active) WHERE is_active = true`; `ix_streams_source_adapter ON (source_adapter)`.

**`observations.observations`** — the hot append-only readings table. RANGE-partitioned monthly via pg_partman.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `bigserial` | — | NOT NULL | Part of PK with `(stream_id, recorded_at)`; bigserial because volumes are huge |
| `stream_id` | `uuid` | — | NOT NULL | FK → `observation_streams(id)` |
| `recorded_at` | `timestamptz` | — | NOT NULL | RANGE partition key |
| `value_numeric` | `double precision` | — | NULL | Used when stream.data_type = 'numeric' |
| `value_text` | `text` | — | NULL | Used for 'enum' or free-form |
| `value_bool` | `boolean` | — | NULL | Used for 'boolean' |
| `quality` | `varchar(20)` | `'good'` | NOT NULL | Tag — sensor health |
| `source_adapter` | `varchar(64)` | — | NOT NULL | Denormalized for audit / forensic |
| `ingested_at` | `timestamptz` | `now()` | NOT NULL | When the worker landed the row (vs `recorded_at` which is the sensor's clock) |

**Partitioning:**
```sql
CREATE TABLE observations.observations (...) PARTITION BY RANGE (recorded_at);
SELECT partman.create_parent(
  'observations.observations',
  'recorded_at', 'native', 'monthly',
  p_premake := 3
);
```

**Indexes** (per monthly partition):
- PK on `(stream_id, recorded_at, id)` — composite required by RANGE partitioning
- BRIN on `(recorded_at)` — block-range index efficient for monotonically-increasing timestamps
- `ix_observations_stream_recorded` on `(stream_id, recorded_at DESC)` — for "latest N readings on stream X" queries

**`observations.observation_units`** — unit dictionary (seeded).

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `code` | `varchar(32)` | — | NOT NULL | PK — `°C`, `°F`, `kPa`, `psi`, `runtime_hours`, `mph`, `kg`, `lux`, etc. |
| `name` | `varchar(120)` | — | NOT NULL | — |
| `dimension` | `varchar(64)` | — | NOT NULL | `temperature` / `pressure` / `length` / `time` / `mass` / `illuminance` |
| `si_conversion_factor` | `double precision` | `1.0` | NOT NULL | Multiplier to convert to SI base unit |
| `si_conversion_offset` | `double precision` | `0.0` | NOT NULL | Offset (needed for temperature) |

Indexes: PK on `(code)`.

**`observations.observation_rollup_policies`** — declares which rollup tables to populate per stream.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `code` | `varchar(120)` | — | NOT NULL | UNIQUE — e.g., `default_thermometer`, `vibration_high_cadence` |
| `hourly_enabled` | `boolean` | `true` | NOT NULL | — |
| `daily_enabled` | `boolean` | `true` | NOT NULL | — |
| `weekly_enabled` | `boolean` | `true` | NOT NULL | — |
| `aggregations` | `varchar(64)[]` | `'{min,max,avg,p50,p95}'` | NOT NULL | Which aggregations to compute |

**`observations.observation_rollups_hourly` / `_daily` / `_weekly`** — explicit rollup tables (NOT pg_ivm — see §3.5 decision and canon §31).

Same column set per granularity:
| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `stream_id` | `uuid` | — | NOT NULL | PK with bucket_start |
| `bucket_start` | `timestamptz` | — | NOT NULL | Bucket start time (hour / day / week boundary) |
| `min_value` | `double precision` | — | NULL | — |
| `max_value` | `double precision` | — | NULL | — |
| `avg_value` | `double precision` | — | NULL | — |
| `p50_value` | `double precision` | — | NULL | Approximated via Postgres `percentile_disc` |
| `p95_value` | `double precision` | — | NULL | — |
| `sample_count` | `int` | — | NOT NULL | Number of source observations in bucket |
| `last_refreshed_at` | `timestamptz` | `now()` | NOT NULL | When the rollup row was last upserted |

Partition by RANGE on `bucket_start` (yearly for hourly, multi-year for daily/weekly).

Indexes: PK `(stream_id, bucket_start)`; `ix_rollup_bucket_desc ON (bucket_start DESC)` for "show me last N buckets".

**`observations.observation_alerts`** — optional threshold-based alerts (rules emit reactive WO via automation).

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `code` | `varchar(120)` | — | NOT NULL | UNIQUE |
| `stream_id` | `uuid` | — | NOT NULL | FK → `observation_streams(id)`; subject reference lives on the stream |
| `kind` | `varchar(32)` | — | NOT NULL | `threshold_above` / `threshold_below` / `out_of_band` / `gap_detected` / `z_score_outlier` |
| `threshold_value` | `double precision` | — | NULL | For threshold_above/below |
| `condition_jsonb` | `jsonb` | — | NULL | For more complex conditions (e.g., z-score window) |
| `action_id` | `uuid` | — | NOT NULL | FK → `automation_rules(id)` — what to do when the alert fires |
| `is_active` | `boolean` | `true` | NOT NULL | — |
| `cooldown_seconds` | `int` | `300` | NOT NULL | Min seconds between fires to prevent storm |

#### 13.6.2 Migrations

1. `1937300000000-add-observations-schema.ts` — creates `observations` schema.
2. `1937300000001-add-observation-units.ts` — creates `observation_units` + seeds the standard dictionary (~50 entries: °C, °F, kPa, psi, runtime_hours, mph, kg, lux, etc.).
3. `1937300000002-add-observation-streams.ts` — creates `observation_streams`.
4. `1937300000003-add-observation-rollup-policies.ts` — creates `observation_rollup_policies` + seeds defaults.
5. `1937300000004-add-observations-partitioned.ts` — creates partitioned `observations` parent + pg_partman setup.
6. `1937300000005-add-observation-rollups.ts` — creates 3 rollup tables + per-table partitioning.
7. `1937300000006-add-observation-alerts.ts` — creates `observation_alerts`.

Each migration discrete + reversible. Migration 5 is special — must run `partman.create_parent` after table creation.

#### 13.6.3 TypeORM entities

**New file:** `libs/instance-db/src/lib/entities/observations.entity.ts` — 7 entities (`ObservationStream`, `Observation`, `ObservationUnit`, `ObservationRollupPolicy`, `ObservationRollupHourly`, `ObservationRollupDaily`, `ObservationRollupWeekly`, `ObservationAlert`). Standard TypeORM decoration; `ObservationUnit` uses `code` as PK.

#### 13.6.4 Services

**Worker ingest pipeline:** `apps/worker/src/observations/ingest.service.ts` (NEW)

```typescript
@Injectable()
export class ObservationIngestService {
  /** Per-adapter buffer for 5s coalescing; on flush, batched COPY-style insert. */
  async ingest(events: IngestEvent[]): Promise<void> {
    // Group by stream_id; for each stream, look up retention_days + quality_floor;
    // drop events below quality_floor; convert source-adapter values via unit dictionary;
    // INSERT INTO observations.observations(...) VALUES ... (batched 1000+/insert).
    // Idempotency via (stream_id, recorded_at, source_adapter_event_id) uniqueness if event_id present.
  }
}
```

**Adapter contracts:** `apps/worker/src/observations/adapters/{bacnet,modbus,mqtt,hl7,obd2,wifi-beacon,manual,webhook}.adapter.ts` — each implements `IngestionAdapter` interface from §3.13 connector runtime.

**Rollup service:** `apps/worker/src/observations/rollup.service.ts` (referenced in §9 critical files)

```typescript
@Injectable()
export class ObservationRollupService {
  /** Scheduled per granularity: hourly every 5 min, daily every hour, weekly every day. */
  async refreshHourly(): Promise<void> {
    // INSERT INTO observation_rollups_hourly (stream_id, bucket_start, min, max, avg, p50, p95, sample_count)
    // SELECT stream_id, date_trunc('hour', recorded_at), min(...), max(...), avg(...), percentile_disc(0.5), percentile_disc(0.95), count(*)
    // FROM observations.observations
    // WHERE recorded_at >= last_refreshed_at AND recorded_at < now() - INTERVAL '1 hour'  -- avoid open bucket
    // GROUP BY stream_id, date_trunc('hour', recorded_at)
    // ON CONFLICT (stream_id, bucket_start) DO UPDATE SET ...;
    // -- aggregation runs in Postgres; the worker only issues the statement + observes lag
  }
  // similar for refreshDaily / refreshWeekly
}
```

Rollup-refresh lag visible in `task_projection_lag`-equivalent operational table (or extend that one).

**API service:** `apps/api/src/app/observations/observations.service.ts` — read APIs for raw + rollup data.

#### 13.6.5 API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/observations/streams` | `@Roles` | List streams (filterable by subject_collection_id + subject_record_id) |
| `POST` | `/observations/streams` | `@Roles('observations_admin')` | Create stream (rare — usually pack-installed) |
| `GET` | `/observations/streams/:id/readings?from=&to=&limit=` | `@Roles` per subject collection | Raw readings paginated |
| `GET` | `/observations/streams/:id/rollups/:granularity?from=&to=` | `@Roles` per subject | Rollup data for charts (hourly / daily / weekly) |
| `POST` | `/observations/ingest` | `@AllowServiceToken @RequireServiceScope('observations:ingest')` | Webhook ingest endpoint for non-adapter sources |

#### 13.6.6 Validator extensions

1. **Stream unit consistency**: when a pack declares an `observation_streams` row, the `unit_code` must exist in `observation_units` AND the `data_type` (numeric/bool/enum) must be compatible with the unit's `dimension`.
2. **Rollup policy resolution**: if `rollup_policy_id` is set, it must reference an existing policy and the policy's `aggregations` array must be non-empty.
3. **Adapter declaration**: `source_adapter` must reference a registered `integration_adapter_registry` row (§3.13).

#### 13.6.7 Service-boundary scanner rules

```typescript
'observations.observation_streams': { writers: ['apps/api/src/app/observations/**', 'apps/worker/src/observations/adapters/**'], readers: ['apps/api/src/app/observations/**', 'apps/api/src/app/views/**', 'apps/api/src/app/ai/**'] },
'observations.observations': { writers: ['apps/worker/src/observations/ingest.service.ts', 'apps/worker/src/observations/adapters/**'], readers: ['apps/api/src/app/observations/**'] },
'observations.observation_units': { writers: ['apps/api/src/app/observations/admin/**'], readers: ['apps/api/src/app/observations/**', 'apps/worker/src/observations/**'] },
'observations.observation_rollups_*': { writers: ['apps/worker/src/observations/rollup.service.ts'], readers: ['apps/api/src/app/observations/**', 'apps/api/src/app/views/**'] },
'observations.observation_alerts': { writers: ['apps/api/src/app/observations/admin/**'], readers: ['apps/worker/src/observations/alert-evaluator.service.ts'] },
```

#### 13.6.8 Tests (self-test ≥ 15 assertions)

1. Stream creation: minimal valid stream → succeeds; missing unit → fails validator.
2. Ingest 100k readings → all land in correct monthly partition.
3. pg_partman creates next month's partition automatically (advance the clock to month-end, verify partition exists).
4. Quality floor: readings below `quality_floor` dropped at ingest; not stored.
5. Unit conversion at ingest: a Fahrenheit BACnet reading → stored as-is + tagged with unit; rollup queries can convert via `observation_units.si_conversion_factor`.
6. Hourly rollup refresh: 60 readings within an hour → one rollup row with correct min/max/avg/p50/p95.
7. Rollup refresh doesn't re-process closed buckets: idempotent for old hours; only the newest hour gets recomputed if it's been refreshed before.
8. Daily rollup builds from hourly rollups (cascading aggregation) where appropriate.
9. Alert: a threshold-above alert + a reading exceeding threshold → automation rule fires + cooldown_seconds honored on subsequent readings within window.
10. Gap detection: stream's `expected_interval_seconds = 60` + no readings for 5 min → gap_detected alert fires once.
11. Retention: stream's `retention_days = 30` + monthly partition older than 30 days → partition-steward marks for archive (but does NOT delete; compliance §10).
12. Worker idempotency: duplicate ingest event_id (where the source adapter provides one) → second ingest no-ops via `processed_events`.
13. Z-score outlier alert: a reading 4σ from the rolling-24h mean → outlier alert fires.
14. Adapter health: BACnet adapter loses connection → `observation_streams.is_active` for streams from that adapter NOT auto-deactivated (alert only); manual or policy decision.
15. Read API authz: §28 evaluator filters readings by subject record visibility (a tech who can't see the asset can't see its readings).

#### 13.6.9 PR breakdown for §3.5

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Tables + migrations (1-3) | 3 migration files (schema, units, streams) + units dictionary seed | Migrations + scanner pass |
| 2 | Partitioned observations table + pg_partman | Migration 4-5 + entity registration | partman creates next monthly partition; ingest a row into latest partition |
| 3 | Rollup tables + rollup service (worker) | Migration 6 + `rollup.service.ts` | Self-test cases 6, 7, 8 pass |
| 4 | Ingest pipeline + adapter SDK reference impl | `apps/worker/src/observations/ingest.service.ts` + `manual.adapter.ts` + `webhook.adapter.ts` | Self-test cases 2, 4, 5, 12 pass |
| 5 | Alerts engine | Migration 7 + `alert-evaluator.service.ts` | Self-test cases 9, 10, 13 pass |
| 6 | API endpoints + authz | `apps/api/src/app/observations/**` | Self-test case 15 + integration tests for all 5 endpoints |
| 7 | Canon §31 amendment + ops runbook | `CLAUDE.md`; `docs/operations/observations-runbook.md` | Canon merged; runbook covers pg_partman maintenance + rollup-lag escalation |

**Total: 7 PRs for §3.5. Estimated effort: ~7-9 working days.**

---

### 13.7 Worked example: §3.6 Regulated-Action Primitives (full artifact-level spec — e-signature + Merkle batch + Part 11 envelope)

#### 13.7.1 Tables

All tables live in `schema: 'compliance'` (NEW dedicated schema). Five tables: `reason_codes`, `electronic_signatures`, `signature_chains`, `evidence_artifacts`, `attestation_jobs`. The platform never deletes from `signature_chains`, `electronic_signatures`, or `evidence_artifacts` — 7-year retention via active/archive partitioning per canon §34.

**`compliance.reason_codes`** — seeded vocabulary; one row per pack-scoped reason.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `code` | `varchar(120)` | — | NOT NULL | UNIQUE; pack-owned rows MUST be `<pack-id>__<slug>` (validator-enforced) |
| `label` | `text` | — | NOT NULL | Human-readable, locale-keyed by `label_locale` |
| `label_locale` | `varchar(16)` | `'en-US'` | NOT NULL | IETF BCP-47 |
| `category` | `varchar(64)` | — | NOT NULL | `maintenance` / `safety` / `clinical` / `compliance` / `financial` / `regulatory` |
| `pack_id` | `text` | — | NULL | NULL = platform-default; else the pack that seeded it |
| `applicable_signature_meanings` | `varchar(64)[]` | `'{}'::varchar[]` | NOT NULL | Subset of `{review, approval, responsibility, verification, closure}` — validator-enforced |
| `description` | `text` | — | NULL | Free-form auditor-facing explanation |
| `is_active` | `boolean` | `true` | NOT NULL | Deactivation does NOT cascade — historical signatures keep the reference |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `updated_at` | `timestamptz` | `now()` | NOT NULL | Trigger-maintained |

Indexes: PK; UNIQUE `(code)`; `ix_reason_pack ON (pack_id, is_active)`; `ix_reason_category ON (category)`.

**`compliance.electronic_signatures`** — one row per signed action (whether single or part of a batch).

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | NULL in single-tenant mode (canon §5); NOT NULL in pooled mode (RLS enforces) |
| `collection_id` | `uuid` | — | NOT NULL | FK → `metadata.collection_definitions(id)` |
| `record_id` | `uuid` | — | NOT NULL | The signed record |
| `signer_user_id` | `uuid` | — | NOT NULL | FK → `identity.users(id)` |
| `signer_display_name_at_sign_time` | `text` | — | NOT NULL | Snapshot — see §3.6 leaf-tuple rationale; replay must not depend on current `users.display_name` |
| `signer_login_at_sign_time` | `text` | — | NOT NULL | Snapshot |
| `signed_at_utc` | `timestamptz` | `now()` | NOT NULL | Server clock; client clock is informational only |
| `action_code` | `text` | — | NOT NULL | Pack-defined action vocabulary (e.g., `clinical-pm-completed`, `loto-step-2-verified`) |
| `signature_meaning` | `varchar(64)` | — | NOT NULL | CHECK ∈ `{review, approval, responsibility, verification, closure}` |
| `reason_code_id` | `uuid` | — | NOT NULL | FK → `reason_codes(id)`; must be active at sign-time AND its `applicable_signature_meanings` must include `signature_meaning` |
| `reauth_method` | `varchar(16)` | — | NOT NULL | CHECK ∈ `{session, totp, webauthn}` |
| `reauth_evidence_ref` | `uuid` | — | NULL | FK → `identity.mfa_methods(id)` or `identity.webauthn_credentials(id)` disambiguated by `reauth_method`; NULL only when `reauth_method = 'session'` |
| `payload_hash` | `bytea` | — | NOT NULL | 32 bytes — SHA-256 of canonical action payload (record snapshot being signed) |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK → `identity.audit_logs(id)`; binds e-signature to canon §10 audit chain |
| `chain_entry_id` | `uuid` | — | NOT NULL | UNIQUE; FK → `signature_chains(id)`; corresponding row in compliance chain |
| `merkle_root_chain_entry_id` | `uuid` | — | NULL | When part of a Merkle batch, references the `signature_chains` row whose `entry_kind = 'merkle_root'`; for single-action signatures equals `chain_entry_id` |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

Indexes: PK; `ix_es_record ON (collection_id, record_id, signed_at_utc DESC)`; `ix_es_signer ON (signer_user_id, signed_at_utc DESC)`; UNIQUE `(audit_log_id)`; UNIQUE `(chain_entry_id)`; `ix_es_merkle_root ON (merkle_root_chain_entry_id) WHERE merkle_root_chain_entry_id IS NOT NULL`.

CHECK constraint: `(reauth_method = 'session') = (reauth_evidence_ref IS NULL)`.

**`compliance.signature_chains`** — append-only hash-linked ledger; parallel to `identity.audit_logs` chain; linked via `electronic_signatures.audit_log_id`.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture as `electronic_signatures.instance_id` |
| `entry_kind` | `varchar(16)` | — | NOT NULL | CHECK ∈ `{signature, merkle_root}` |
| `previous_hash` | `bytea` | — | NULL | 32 bytes; NULL only for the genesis row per instance |
| `hash` | `bytea` | — | NOT NULL | 32 bytes; SHA-256 of `previous_hash \|\| canonical_payload_bytes` |
| `payload` | `jsonb` | — | NOT NULL | For `signature`: canonical leaf tuple as JSON. For `merkle_root`: `{ algorithm: 'merkle-sha256', leaf_count, root_hash_hex, tree_depth, leaves: [{electronic_signature_id, leaf_hash_hex}] }` |
| `signature_id` | `uuid` | — | NULL | FK → `electronic_signatures(id)` when `entry_kind = 'signature'`; NULL when `merkle_root` |
| `merkle_root_hash` | `bytea` | — | NULL | 32 bytes when `entry_kind = 'merkle_root'` |
| `merkle_leaf_count` | `smallint` | — | NULL | 1..256 when `entry_kind = 'merkle_root'`; CHECK `merkle_leaf_count BETWEEN 1 AND 256` |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

Indexes: PK; `ix_sc_created ON (created_at)`; UNIQUE `(signature_id) WHERE signature_id IS NOT NULL`; `ix_sc_kind_created ON (entry_kind, created_at)`.

CHECK constraints:
- `(entry_kind = 'signature') = (signature_id IS NOT NULL)`
- `(entry_kind = 'merkle_root') = (merkle_root_hash IS NOT NULL AND merkle_leaf_count IS NOT NULL)`

Subscriber: `SignatureChainSubscriber` (modeled on `AuditLogSubscriber`) acquires `pg_advisory_xact_lock(hashtext('compliance.signature_chains'))` per insert; reads the latest row in the same transaction; computes `previous_hash` and `hash`; rejects array saves at the entity level — `withAudit(...)` flushes signature_chains rows individually per Plan Fix 41.

**`compliance.evidence_artifacts`** — immutable evidence (photos, signature images, PDFs, sensor captures, voice notes).

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `collection_id` | `uuid` | — | NOT NULL | FK |
| `record_id` | `uuid` | — | NOT NULL | The record this artifact evidences |
| `artifact_kind` | `varchar(64)` | — | NOT NULL | `photo` / `signature_image` / `pdf_export` / `sensor_capture` / `voice_note` / `nameplate_ocr` / `barcode_scan` |
| `storage_uri` | `text` | — | NOT NULL | `s3://bucket/instance/{instance_id}/evidence/{yyyy/mm/dd}/{object-id}` |
| `s3_object_version_id` | `text` | — | NOT NULL | Object Lock version anchor (immutable per version) |
| `s3_retention_mode` | `varchar(16)` | `'COMPLIANCE'` | NOT NULL | CHECK ∈ `{COMPLIANCE, GOVERNANCE}`; COMPLIANCE is the platform default per founder decision 2026-05-17 |
| `sha256` | `bytea` | — | NOT NULL | 32 bytes; content hash for tamper detection |
| `content_type` | `varchar(128)` | — | NOT NULL | RFC 6838 |
| `size_bytes` | `bigint` | — | NOT NULL | — |
| `captured_at` | `timestamptz` | — | NOT NULL | Device clock at capture (may precede `created_at` for offline-then-sync) |
| `captured_by` | `uuid` | — | NOT NULL | FK → `identity.users(id)` |
| `device_meta` | `jsonb` | `'{}'::jsonb` | NOT NULL | `{ make, model, os, app_version, location: {lat,lng,accuracy_m}, timezone, time_anchor }` |
| `retention_class` | `varchar(32)` | — | NOT NULL | CHECK ∈ `{part_11_clinical, sox, osha, iso_55000, joint_commission, default_7y}` |
| `retention_until` | `timestamptz` | — | NOT NULL | Computed from `captured_at + retention_class.duration`; never < `captured_at + 7 years` |
| `legal_hold` | `boolean` | `false` | NOT NULL | When true, retention sweep MUST NOT delete regardless of `retention_until` |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK → `identity.audit_logs(id)` |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

Indexes: PK; `ix_ev_record ON (collection_id, record_id, captured_at DESC)`; `ix_ev_retention ON (retention_until) WHERE legal_hold = false`; UNIQUE `(audit_log_id)`; `ix_ev_legal_hold ON (id) WHERE legal_hold = true` (partial — small cardinality); GIN `ix_ev_device_meta ON (device_meta jsonb_path_ops)`.

**`compliance.attestation_jobs`** — async export tracking for Part 11 attestation bundles.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `requested_by` | `uuid` | — | NOT NULL | FK → `identity.users(id)` |
| `target_kind` | `varchar(32)` | — | NOT NULL | CHECK ∈ `{record, collection_slice, date_range}` |
| `target_collection_id` | `uuid` | — | NULL | NOT NULL when `target_kind ∈ {record, collection_slice}` (CHECK) |
| `target_record_id` | `uuid` | — | NULL | NOT NULL when `target_kind = record` (CHECK) |
| `target_filter` | `jsonb` | — | NULL | For `collection_slice` / `date_range` — canonical filter expression |
| `status` | `varchar(16)` | `'queued'` | NOT NULL | CHECK ∈ `{queued, running, completed, failed, expired}` |
| `requested_at` | `timestamptz` | `now()` | NOT NULL | — |
| `started_at` | `timestamptz` | — | NULL | Set when worker picks up |
| `completed_at` | `timestamptz` | — | NULL | — |
| `expires_at` | `timestamptz` | — | NOT NULL | `requested_at + 7 days` — signed URLs expire then; bundle objects deleted on expiry |
| `pdf_storage_uri` | `text` | — | NULL | Set when status transitions to `completed` |
| `json_storage_uri` | `text` | — | NULL | — |
| `manifest_storage_uri` | `text` | — | NULL | S3 manifest enumerating every referenced evidence artifact + signed-URL TTL |
| `error_message` | `text` | — | NULL | Populated on `failed` |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |

Indexes: PK; `ix_attest_requested_by ON (requested_by, requested_at DESC)`; `ix_attest_status ON (status, expires_at)`; UNIQUE `(audit_log_id)`.

#### 13.7.2 Partitioning strategy

- `compliance.signature_chains` — RANGE partition by `created_at`, yearly, native partitioning. `signature_chains_active_YYYY` is the current write target; once `now() - INTERVAL '13 months'`, partition flips to `signature_chains_archive_YYYY` (READ ONLY via revocation of INSERT/UPDATE/DELETE from runtime roles). Never DROP.
- `compliance.electronic_signatures` — RANGE partition by `signed_at_utc`, yearly, same policy.
- `compliance.evidence_artifacts` — RANGE partition by `captured_at`, yearly, same policy. Evidence whose `retention_until > partition_max_date` AND `legal_hold = false` does NOT prevent partition flip-to-archive (archive is read-only, NOT delete). Object Lock on S3 enforces the binding storage-side guarantee.
- `compliance.reason_codes` — single table; small cardinality.
- `compliance.attestation_jobs` — single table; rows pruned by `expires_at + 30 days` retention sweep (the job rows themselves expire; bundles they generated have their own retention via `evidence_artifacts` linkage).

pg_partman is NOT used here — yearly partitions are infrequent enough that explicit per-year migration files are tractable and auditable (pg_partman config drift is a known auditor objection in regulated industries).

#### 13.7.3 Migrations

| # | Filename | Action |
|---|---|---|
| 1 | `1932000000000-create-compliance-schema.ts` | `CREATE SCHEMA compliance; CREATE EXTENSION IF NOT EXISTS pgcrypto;` |
| 2 | `1932000000001-create-reason-codes.ts` | Table + indexes; trigger for `updated_at` |
| 3 | `1932000000002-create-electronic-signatures.ts` | Table + partition skeleton (`PARTITION BY RANGE (signed_at_utc)`) + indexes via `createIndexConcurrent` |
| 4 | `1932000000003-create-signature-chains.ts` | Table + partition skeleton + indexes; `SignatureChainSubscriber` registration follows in entity wiring |
| 5 | `1932000000004-create-evidence-artifacts.ts` | Table + partition skeleton + indexes |
| 6 | `1932000000005-create-attestation-jobs.ts` | Table + indexes |
| 7 | `1932000000006-partition-compliance-tables-current-year.ts` | Create concrete partitions for current + next year for `signature_chains`, `electronic_signatures`, `evidence_artifacts` |
| 8 | `1932000000007-seed-platform-reason-codes.ts` | Seed ~12 platform-default reason codes (`platform__close_corrective`, `platform__break_glass_phi_access`, `platform__contractor_signoff`, etc.) |

All migrations: `static transaction = false` where `CREATE INDEX CONCURRENTLY` is used (per W6.A `createIndexConcurrent`); `migrationsTransactionMode='each'` honored.

#### 13.7.4 TypeORM entities

`libs/instance-db/src/lib/entities/compliance.ts` (new file under the W6.A entity area split):

```typescript
@Entity({ schema: 'compliance', name: 'reason_codes' })
export class ReasonCode {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 120, unique: true }) code!: string;
  @Column({ type: 'text' }) label!: string;
  @Column({ length: 16, default: 'en-US' }) labelLocale!: string;
  @Column({ length: 64 }) category!: string;
  @Column({ type: 'text', nullable: true }) packId!: string | null;
  @Column({ type: 'varchar', length: 64, array: true, default: () => "'{}'" })
  applicableSignatureMeanings!: SignatureMeaning[];
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ schema: 'compliance', name: 'electronic_signatures' })
export class ElectronicSignature {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) instanceId!: string | null;
  @Column({ type: 'uuid' }) collectionId!: string;
  @Column({ type: 'uuid' }) recordId!: string;
  @Column({ type: 'uuid' }) signerUserId!: string;
  @Column({ type: 'text' }) signerDisplayNameAtSignTime!: string;
  @Column({ type: 'text' }) signerLoginAtSignTime!: string;
  @Column({ type: 'timestamptz' }) signedAtUtc!: Date;
  @Column({ type: 'text' }) actionCode!: string;
  @Column({ type: 'varchar', length: 64 }) signatureMeaning!: SignatureMeaning;
  @Column({ type: 'uuid' }) reasonCodeId!: string;
  @Column({ type: 'varchar', length: 16 }) reauthMethod!: 'session' | 'totp' | 'webauthn';
  @Column({ type: 'uuid', nullable: true }) reauthEvidenceRef!: string | null;
  @Column({ type: 'bytea' }) payloadHash!: Buffer;
  @Column({ type: 'uuid' }) auditLogId!: string;
  @Column({ type: 'uuid' }) chainEntryId!: string;
  @Column({ type: 'uuid', nullable: true }) merkleRootChainEntryId!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

@Entity({ schema: 'compliance', name: 'signature_chains' })
export class SignatureChainEntry {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) instanceId!: string | null;
  @Column({ type: 'varchar', length: 16 }) entryKind!: 'signature' | 'merkle_root';
  @Column({ type: 'bytea', nullable: true }) previousHash!: Buffer | null;
  @Column({ type: 'bytea' }) hash!: Buffer;
  @Column({ type: 'jsonb' }) payload!: Record<string, unknown>;
  @Column({ type: 'uuid', nullable: true }) signatureId!: string | null;
  @Column({ type: 'bytea', nullable: true }) merkleRootHash!: Buffer | null;
  @Column({ type: 'smallint', nullable: true }) merkleLeafCount!: number | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

@Entity({ schema: 'compliance', name: 'evidence_artifacts' })
export class EvidenceArtifact { /* parallel structure; columns per §13.7.1 */ }

@Entity({ schema: 'compliance', name: 'attestation_jobs' })
export class AttestationJob { /* parallel structure; columns per §13.7.1 */ }

export type SignatureMeaning = 'review' | 'approval' | 'responsibility' | 'verification' | 'closure';
```

The `compliance` area file is added to `libs/instance-db/src/lib/entities/index.ts` per the W6.A area-split barrel pattern (Plan Fix 24 PR-A).

#### 13.7.5 Services

`apps/api/src/app/compliance/` (new module).

**`SignatureService`** — `apps/api/src/app/compliance/signature/signature.service.ts`:

```typescript
sign(input: SignRequest, requestContext: UserRequestContext): Promise<SignatureResult>;
listForRecord(collectionId: string, recordId: string, ctx: UserRequestContext): Promise<ElectronicSignature[]>;
verifyChainExtension(signatureId: string, ctx: UserRequestContext): Promise<ChainVerificationResult>;
```

Contract for `sign(...)`:
1. Resolve authority via `AuthorizationService.canPerformAction(actionCode, collectionId, recordId, ctx)` — must return `allow`. 403 with canon §28 minimal shape on deny; `AccessAuditPort.logAccessDenied` row written.
2. Resolve re-auth requirement via `signatureMeaningPolicy(signatureMeaning)` (founder-locked matrix, §13.7.5.1).
3. Validate presented re-auth proof matches requirement:
   - `session`: ensure session idle < 5 minutes (compare `session.last_activity_at` to `now()`).
   - `totp`: validate the presented code via `TotpService.verify(userId, code)` — code from the last 30s window.
   - `webauthn`: validate the presented assertion via `WebAuthnService.verifyAssertion(userId, assertion)` — assertion timestamp within 60s.
4. Validate `reason_code_id` is active AND `signatureMeaning ∈ reasonCode.applicableSignatureMeanings`. 400 with structured error on violation.
5. Compute canonical payload bytes from the action payload (record snapshot at sign-time) and SHA-256 it → `payload_hash`.
6. Inside `withAudit(dataSource, async () => { ... })`:
   - Insert `electronic_signatures` row (pre-generate `chainEntryId` UUID).
   - Insert `signature_chains` row with `entry_kind = 'signature'`, `signature_id = electronic_signature.id`. `SignatureChainSubscriber` populates `previous_hash` + `hash` under advisory lock.
   - Audit log entry written by `withAudit`.
7. Return `{ signatureId, chainEntryId, hash, signedAt, auditLogId }`.

**`MerkleBatchService`** — `apps/api/src/app/compliance/signature/merkle-batch.service.ts`:

```typescript
batchSign(input: BatchSignRequest, requestContext: UserRequestContext): Promise<BatchSignResult>;
```

Contract for `batchSign(...)`:
1. Validate `input.actions.length ≤ 256` — 400 with structured error `MERKLE_BATCH_CAP_EXCEEDED` if violated. The 256-leaf cap is founder-locked (2026-05-17) to bound tree depth (log2 = 8) and keep auditor verification predictable.
2. Validate every action's `signatureMeaning` resolves to the SAME re-auth tier (e.g., all `closure` or all `review`); mixed-tier batches rejected with `MERKLE_BATCH_MIXED_MEANING`. Re-auth happens ONCE for the batch; meaning establishes the re-auth bar.
3. Resolve authority + reason-code validation per-action (§13.7.5 step 1+4 applied N times). Any per-action failure rejects the whole batch — partial commits forbidden.
4. Build canonical leaf bytes per action: concatenation `signer_user_id || signer_display_name_at_sign_time || signer_login_at_sign_time || signed_at_utc || action_code || target_collection_id || target_record_id || reason_code_id || signature_meaning || payload_hash`. All UTF-8 NFC-normalized; separators are the 0x1F (US) ASCII byte; `signed_at_utc` serialized as RFC 3339 with `Z` suffix.
5. SHA-256 over each leaf → `leaf_hash`.
6. Build Merkle tree (binary, balanced; pad odd levels by duplicating the last node). `root_hash` = root of tree.
7. Inside `withAudit(...)`:
   - For each action: insert `electronic_signatures` row carrying `merkle_root_chain_entry_id` pointing to the merkle_root row (created next).
   - Emit ONE `signature_chains` row with `entry_kind = 'merkle_root'` and `payload.leaves[]` carrying per-leaf hashes. ALL N actions' `chain_entry_id` AND `merkle_root_chain_entry_id` point to this single merkle_root row — the merkle_root IS the chain extension for the batch. Root hash binds every leaf cryptographically; per-leaf chain rows are intentionally elided.
   - The merkle_root insert is preceded by the comment marker `// @AuditMerkleBatchInsert` so `audit-bypass-check.ts` recognizes the batched-leaves payload as allowed (§13.7.8).
   - Audit log entry per the entire batch (one row).
8. Return `{ signatures: [{id, leafHashHex}], rootChainEntryId, rootHashHex, signedAt, auditLogId }`.

**`ReasonCodeService`** — standard CRUD with validator hooks; pack installer calls `seedPackReasonCodes(packId, definitions)` during pack install.

**`EvidenceArtifactService`** — `apps/api/src/app/compliance/evidence/evidence-artifact.service.ts`:

```typescript
attach(input: AttachEvidenceRequest, ctx: UserRequestContext): Promise<EvidenceArtifact>;
fetchSignedDownloadUrl(artifactId: string, ttlSeconds: number, ctx: UserRequestContext): Promise<string>;
applyLegalHold(artifactId: string, reasonText: string, ctx: UserRequestContext): Promise<void>;
releaseLegalHold(artifactId: string, reasonText: string, ctx: UserRequestContext): Promise<void>;
```

`attach(...)` flow: multipart upload → S3 `PutObject` with `ObjectLockMode='COMPLIANCE'`, `ObjectLockRetainUntilDate=retention_until`, `ChecksumSHA256` set; verify returned `VersionId`; compute server-side SHA-256 of the response body and compare to the request SHA-256 (defense-in-depth against in-flight tamper); insert `evidence_artifacts` row via `withAudit(...)`.

`applyLegalHold(...)` / `releaseLegalHold(...)` use S3 `PutObjectLegalHold` in addition to the `legal_hold` column flip; the operation order — S3 first, then DB row commit — means S3 leads truth on failure (DB rollback after S3 success is a known divergence; reconciliation sweep runs nightly). `releaseLegalHold` writes a high-severity audit row via `AccessAuditPort.logSecurityEvent({ severity: 'high', kind: 'legal_hold_released', ... })`.

**`Part11AttestationService`** — `apps/api/src/app/compliance/attestation/attestation.service.ts` (API side; export work runs in `apps/worker`):

```typescript
enqueueExport(input: AttestationExportRequest, ctx: UserRequestContext): Promise<{ jobId: string }>;
status(jobId: string, ctx: UserRequestContext): Promise<AttestationJobStatus>;
```

Worker side (`apps/worker/src/compliance/attestation-export.processor.ts`): on BullMQ job pickup, walks the target's signature chain + evidence artifacts; renders a PDF via pdfkit (auditor-readable layout); writes a JSON canonical export including chain proof (every `signature_chains.hash` replayable from `payload + previous_hash`); writes an S3 manifest enumerating evidence artifact storage URIs with 7-day signed URLs. All three artifacts written to S3 with `COMPLIANCE` retention. Job row transitions `queued → running → completed`. The bundle itself is registered as a recursive `evidence_artifact` so its own integrity is auditable.

##### 13.7.5.1 Signature meaning re-auth policy (founder-locked 2026-05-17)

| `signature_meaning` | Required re-auth method | Freshness window |
|---|---|---|
| `review` | `session` (idle < 5 min) | session token still valid |
| `approval` | `totp` OR `webauthn` | code/assertion < 60s old |
| `responsibility` | `webauthn` | assertion < 60s old |
| `verification` | `webauthn` | assertion < 60s old |
| `closure` | `webauthn` | assertion < 60s old |

Hard-coded in `SignatureService.signatureMeaningPolicy` constant; NOT runtime-configurable per pack. Founder-locked because the matrix maps to FDA inspection expectations — a customer-tunable matrix is a compliance-defense liability. Reflected in §13.7.9 test #2.

#### 13.7.6 API endpoints

All endpoints under `apps/api/src/app/compliance/`. Every handler carries exactly one primary boundary decorator per W2 Stream 3 (`@RequirePermission` OR `@RequireCollectionAccess` OR `@AuthenticatedOnly`). All permission codes added to `libs/permission-registry`.

| Method | Path | Boundary | Body / params |
|---|---|---|---|
| `POST` | `/api/compliance/signatures` | `@RequirePermission('compliance:signature:sign')` | `{ collectionId, recordId, actionCode, signatureMeaning, reasonCodeId, reauthMethod, reauthProof, payloadSnapshot }` |
| `POST` | `/api/compliance/signatures/batch` | `@RequirePermission('compliance:signature:sign')` | `{ actions: [...same as single...] }` (length ≤ 256) |
| `GET` | `/api/compliance/signatures/:id` | `@RequirePermission('compliance:signature:read')` | — |
| `GET` | `/api/compliance/records/:collectionId/:recordId/signatures` | `@RequireCollectionAccess('read')` | — |
| `POST` | `/api/compliance/signatures/:id/verify` | `@RequirePermission('compliance:signature:read')` | — returns chain replay result |
| `GET` | `/api/compliance/reason-codes` | `@AuthenticatedOnly()` | query: `meaning`, `packId`, `category` |
| `POST` | `/api/compliance/reason-codes` | `@RequirePermission('compliance:reason_code:manage')` | admin / pack-installer path |
| `POST` | `/api/compliance/evidence` | `@RequirePermission('compliance:evidence:attach')` | multipart with `record`, `metadata` JSON part |
| `GET` | `/api/compliance/evidence/:id` | `@RequireCollectionAccess('read')` (resolved via artifact's record) | — returns metadata + 60s signed URL |
| `POST` | `/api/compliance/evidence/:id/legal-hold` | `@RequirePermission('compliance:legal_hold:apply')` | `{ reasonText }` |
| `DELETE` | `/api/compliance/evidence/:id/legal-hold` | `@RequirePermission('compliance:legal_hold:release')` | `{ reasonText }` |
| `POST` | `/api/compliance/attestations` | `@RequirePermission('compliance:attestation:export')` | `{ targetKind, targetCollectionId?, targetRecordId?, targetFilter? }` returns 202 `{ jobId }` |
| `GET` | `/api/compliance/attestations/:id` | `@RequirePermission('compliance:attestation:export')` | — |

Permission codes added to `PERMISSION_REGISTRY` (W2 Stream 2 PR3 vocabulary):
- `compliance:signature:sign`, `compliance:signature:read`
- `compliance:reason_code:manage`
- `compliance:evidence:attach`
- `compliance:legal_hold:apply` (dangerous: false)
- `compliance:legal_hold:release` (dangerous: true)
- `compliance:attestation:export`

#### 13.7.7 Validator extensions

Pack validator (`libs/pack-validator`) gains 5 publish gates:

1. **G7.1** — Any collection with `taskable.requires_signature = true` MUST have at least one reason_code seeded by the pack whose `applicable_signature_meanings` includes the collection's declared `closure_signature_meaning`. Error: `MISSING_REASON_CODE_FOR_CLOSURE_SIGNATURE`.
2. **G7.2** — Every pack-owned `reason_codes.code` MUST match regex `^${packId}__[a-z0-9_]+$`. Error: `REASON_CODE_NAMESPACE_VIOLATION`.
3. **G7.3** — Every `applicable_signature_meanings[]` value MUST be in the canonical enum `{review, approval, responsibility, verification, closure}`. Error: `INVALID_SIGNATURE_MEANING`.
4. **G7.4** — Pack workflows referencing a `reason_code_id` MUST reference one seeded by THAT pack OR by `platform__*`. Cross-pack reason-code references rejected. Error: `CROSS_PACK_REASON_CODE_REFERENCE`.
5. **G7.5** — `evidence_artifacts.retention_class` referenced by pack collections MUST be in the canonical enum. Error: `INVALID_RETENTION_CLASS`.

#### 13.7.8 Service-boundary scanner rules

`tools/service-boundary-check.ts` `KNOWN_WRITES` table gains:

| Entity | Allowed writers |
|---|---|
| `ElectronicSignature` | `SignatureService.sign`, `MerkleBatchService.batchSign` |
| `SignatureChainEntry` | `SignatureService.sign`, `MerkleBatchService.batchSign` |
| `ReasonCode` | `ReasonCodeService.*`, `PackInstaller.seedPackReasonCodes` |
| `EvidenceArtifact` | `EvidenceArtifactService.*`, `RetentionSweepService.markExpired` |
| `AttestationJob` | `Part11AttestationService.enqueueExport`, `AttestationExportProcessor.process` |

`tools/audit-bypass-check.ts` `AUDIT_LOG_BULK_INSERT_ALLOWLIST` gains ONE entry:

```typescript
{
  file: 'apps/api/src/app/compliance/signature/merkle-batch.service.ts',
  pattern: '@AuditMerkleBatchInsert',
  rationale: 'Merkle batch root emits ONE signature_chains row with entry_kind=merkle_root; leaf rows go in electronic_signatures (single-row inserts via withAudit, individually linearized). The merkle_root row IS the chain extension for the batch; root hash binds every leaf. Per canon §3.6 Merkle-batch ruling and Plan Fix 41 linearization carve-out.',
  reference: 'docs/superpowers/specs/2026-05-16-clinical-facilities-asset-maintenance-design.md §13.7'
}
```

Without the `@AuditMerkleBatchInsert` marker, any batched insert on `signature_chains` or `electronic_signatures` continues to fail the scanner.

`tools/permission-registry-sync-check.ts` enforces the 7 new permission codes each have ≥ 1 call site.

#### 13.7.9 Tests (self-test ≥ 15 assertions)

Integration tests at `apps/api/test/integration/compliance-*.spec.ts`:

1. **`compliance-signature-happy-path.spec.ts`** — single signature: writes one `electronic_signatures` row + one `signature_chains` row with `entry_kind='signature'`; chain `previous_hash` extends from prior row's `hash`; `audit_log_id` resolves to a row in `identity.audit_logs`.
2. **`compliance-signature-reauth-matrix.spec.ts`** — 10 test cases across 5 meanings × 3 methods × pass/fail. Confirms `review` accepts session and rejects expired session; `approval` accepts totp + webauthn and rejects session; `responsibility/verification/closure` accept only webauthn.
3. **`compliance-signature-leaf-replay.spec.ts`** — after sign, recompute leaf canonical bytes from row columns alone → SHA-256 → matches `signature_chains.hash` after stripping the `previous_hash` prefix.
4. **`compliance-merkle-batch-100.spec.ts`** — 100-leaf batch: writes 100 `electronic_signatures` rows + 1 `signature_chains` row (`entry_kind=merkle_root`); root hash equals tree built from leaves; `merkle_leaf_count=100`.
5. **`compliance-merkle-batch-cap-exceeded.spec.ts`** — 257-action batch rejected with structured error `MERKLE_BATCH_CAP_EXCEEDED`; zero rows written (transactional rollback).
6. **`compliance-merkle-batch-mixed-meaning.spec.ts`** — batch with mixed `signature_meaning` rejected with `MERKLE_BATCH_MIXED_MEANING`.
7. **`compliance-merkle-batch-concurrency.spec.ts`** — 5 concurrent 50-leaf batches; each contributes exactly one `merkle_root` chain row; chain remains linear (assert N+1 chain rows with no fork on `previous_hash`); reuses Plan Fix 41 reproducer shape.
8. **`compliance-signer-snapshot.spec.ts`** — sign as `user-A`; later update `user-A.displayName`; replay leaf bytes from `signer_display_name_at_sign_time` (NOT current `users.display_name`); SHA-256 still matches `signature_chains.hash`.
9. **`compliance-authority-check.spec.ts`** — user lacking `compliance:signature:sign` gets canon §28 minimal 403 shape; `AccessAuditPort.logAccessDenied` row written.
10. **`compliance-reason-code-validator.spec.ts`** — pack with `requires_signature=true` collection and zero seeded reason codes is rejected by validator with `MISSING_REASON_CODE_FOR_CLOSURE_SIGNATURE`.
11. **`compliance-evidence-attach-roundtrip.spec.ts`** — upload photo to LocalStack S3 with COMPLIANCE retention; read back via signed URL; SHA-256 matches; `retention_until = captured_at + 7 years`; `s3_retention_mode = 'COMPLIANCE'`.
12. **`compliance-evidence-legal-hold.spec.ts`** — apply hold; advance `retention_until` to the past; RetentionSweepService runs; artifact NOT deleted. Release hold; sweep runs; artifact deleted from index (S3 object enforces COMPLIANCE separately).
13. **`compliance-evidence-tamper-detect.spec.ts`** — mutate S3 object out-of-band; `fetchSignedDownloadUrl` returns; client computes SHA-256 of downloaded bytes → does NOT match `evidence_artifacts.sha256`; reporting hook fires.
14. **`compliance-attestation-export-roundtrip.spec.ts`** — enqueue export for a record with 3 signatures + 1 Merkle batch of 50 actions + 5 evidence artifacts; worker completes; PDF generated; JSON contains chain proof; manifest enumerates all 5 artifact URIs; bundle itself becomes an `evidence_artifact` (recursive proof). Total chain-replay walk: 3 + 1 + 5 = 9 chain rows verified.
15. **`compliance-scanner-coverage.spec.ts`** — service-boundary scanner: writing to `electronic_signatures` from a file NOT in the allowed-writers list fails. audit-bypass scanner: batched insert on `signature_chains` WITHOUT `@AuditMerkleBatchInsert` marker fails.

Self-test count: 15 integration tests × ≥ 1 primary assertion each, plus ≥ 5 assertions in the `audit-bypass-check.ts` self-test for the new allowlist entry. Total ≥ 20 new assertions in the §3.6 acceptance lattice.

#### 13.7.10 PR breakdown for §3.6

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Schema + reason_codes + entity + ReasonCodeService + validator G7.2/G7.3 + scanner writer rule | Migrations 1+2+8 (schema, reason_codes, seed); `compliance.ts` entity area (partial); `apps/api/src/app/compliance/reason-codes/**`; validator extensions | Migrations run cleanly; ReasonCode CRUD passes; validator rejects bad naming; service-boundary scanner pins writers |
| 2 | electronic_signatures + signature_chains + `SignatureService.sign()` single-action path | Migrations 3+4; entities (added to area file); `apps/api/src/app/compliance/signature/signature.service.ts`; `SignatureChainSubscriber`; re-auth matrix policy constant; tests 1, 2, 3, 9, 14 | Single-signature happy-path test passes against real Postgres; re-auth matrix enforced; chain extends linearly; scanner pins writers; audit-bypass scanner passes (single-row writes); §28 deny path returns minimal shape + AccessAuditPort row |
| 3 | `MerkleBatchService.batchSign()` + 256-cap + `@AuditMerkleBatchInsert` allowlist + tests 4, 5, 6, 7, 8 | `merkle-batch.service.ts`; canonical-bytes helper (shared); `audit-bypass-check.ts` allowlist entry + self-test extension; integration tests | 100-leaf batch round-trips; 257 rejected; mixed-meaning rejected; concurrent batches don't fork; signer snapshot survives display-name changes |
| 4 | evidence_artifacts table + `EvidenceArtifactService` + S3 COMPLIANCE upload + retention_until computation + tests 11, 13 | Migration 5; entity; `apps/api/src/app/compliance/evidence/**`; LocalStack S3 fixture | Upload writes S3 with `ObjectLockMode='COMPLIANCE'`; SHA-256 round-trips; retention_until pinned to `captured_at + class.duration`; tamper-detection test exercises mismatch |
| 5 | Legal-hold lifecycle + `RetentionSweepService` + high-severity audit + test 12 | `apps/api/src/app/compliance/evidence/legal-hold.controller.ts`; `retention-sweep.service.ts` (scheduled via SchedulingModule); audit hook | Apply/release flip both DB flag and S3 PutObjectLegalHold; release writes `AccessAuditPort.logSecurityEvent` severity=high; sweep respects legal_hold |
| 6 | attestation_jobs + `Part11AttestationService` + `AttestationExportProcessor` (worker) + PDF/JSON/manifest generation + test 15 + test 10 + canon §32 amendment | Migration 6; `apps/api/src/app/compliance/attestation/**`; `apps/worker/src/compliance/attestation-export.processor.ts`; pdfkit dependency; CLAUDE.md amendment | Export job queues + completes; bundle contains chain proof + manifest; bundle itself stored as recursive `evidence_artifact`; canon merged |

**Total: 6 PRs for §3.6. Estimated effort: ~10-12 working days.**

---

### 13.8 Worked example: §3.7 Mobile Runtime Parity + UI Primitives (full artifact-level spec — Elevator Mode + offline e-signature queue + per-collection WatermelonDB versioning)

#### 13.8.1 Tables

Three new tables in `schema: 'metadata'`, plus one new column on the existing `metadata.collection_definitions` table.

**`metadata.collection_definitions`** — gains one column:

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `sync_to_mobile` | `boolean` | `false` | NOT NULL | When `true`, this collection participates in mobile sync; pack validator (§13.8.7 G8.1) requires a matching `mobile_sync_policies` row |

**`metadata.mobile_sync_policies`** — one row per sync-eligible collection.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `collection_id` | `uuid` | — | NOT NULL | UNIQUE; FK → `metadata.collection_definitions(id) ON DELETE RESTRICT` (canon §14 — refuse delete if a policy exists) |
| `pull_scope` | `varchar(32)` | `'assigned_only'` | NOT NULL | CHECK ∈ `{full, assigned_only, recent_only}`. `full`: every readable record. `assigned_only`: where assignee = current_user. `recent_only`: last 30 days of `updated_at` |
| `pull_recent_window_days` | `int` | `30` | NOT NULL | Only relevant when `pull_scope = 'recent_only'`; CHECK `pull_recent_window_days BETWEEN 1 AND 365` |
| `conflict_strategy_header` | `varchar(32)` | `'server_wins'` | NOT NULL | CHECK ∈ `{server_wins, client_wins, last_write_wins, operator_review}` |
| `conflict_strategy_completion` | `varchar(32)` | `'last_write_wins'` | NOT NULL | Same enum; default `last_write_wins` per §3.7 founder ruling |
| `header_field_codes` | `varchar(120)[]` | `'{}'::varchar[]` | NOT NULL | Property codes treated as header for conflict-strategy purposes; remaining properties are completion fields |
| `field_permission_masking` | `boolean` | `true` | NOT NULL | When `true`, masked fields are absent from mobile payload entirely (canon §28 most-restrictive); when `false`, mobile receives the masked string |
| `is_active` | `boolean` | `true` | NOT NULL | Deactivation halts new pull deltas; existing local DBs unaffected |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `updated_at` | `timestamptz` | `now()` | NOT NULL | Trigger-maintained |

Indexes: PK; UNIQUE `(collection_id)`; `ix_msp_active ON (is_active) WHERE is_active = true`.

**`metadata.mobile_sync_conflicts`** — operator review queue. One row per detected conflict.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `collection_id` | `uuid` | — | NOT NULL | FK |
| `record_id` | `uuid` | — | NOT NULL | The collided record |
| `field_code` | `varchar(120)` | — | NULL | NULL = whole-record conflict (record was deleted server-side and edited client-side); non-NULL = specific property |
| `detected_at` | `timestamptz` | `now()` | NOT NULL | — |
| `client_user_id` | `uuid` | — | NOT NULL | FK → `identity.users(id)`; who made the offending client write |
| `client_value` | `jsonb` | — | NOT NULL | Client's submitted value (or `null` JSON for delete-vs-edit conflicts) |
| `server_value` | `jsonb` | — | NOT NULL | Server's value at conflict-detection time |
| `client_value_at_timestamp` | `timestamptz` | — | NOT NULL | When the client believed it was writing (offline-capture clock) |
| `server_value_at_timestamp` | `timestamptz` | — | NOT NULL | When the server's value was last written |
| `strategy_applied` | `varchar(32)` | — | NOT NULL | CHECK ∈ `{server_wins, client_wins, last_write_wins, operator_review}`; what the policy selected |
| `auto_resolved` | `boolean` | `false` | NOT NULL | `true` if `strategy_applied ≠ 'operator_review'`; row is informational |
| `resolved_at` | `timestamptz` | — | NULL | Set when operator review closes; for auto-resolved rows equals `detected_at` |
| `resolved_by` | `uuid` | — | NULL | FK → `identity.users(id)` for `operator_review` |
| `resolution_choice` | `varchar(16)` | — | NULL | CHECK ∈ `{client, server, manual}`; `manual` means operator entered a third value, captured in `manual_value` |
| `manual_value` | `jsonb` | — | NULL | Only when `resolution_choice = 'manual'` |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |

Indexes: PK; `ix_msc_record ON (collection_id, record_id, detected_at DESC)`; `ix_msc_open ON (strategy_applied) WHERE strategy_applied = 'operator_review' AND resolved_at IS NULL`; `ix_msc_client ON (client_user_id, detected_at DESC)`.

**`metadata.mobile_collection_schemas`** — per-collection WatermelonDB schema versioning (founder-locked per-collection-hash strategy 2026-05-17).

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `collection_id` | `uuid` | — | NOT NULL | UNIQUE; FK → `metadata.collection_definitions(id)` |
| `schema_hash` | `bytea` | — | NOT NULL | 32 bytes; SHA-256 over canonical property-set bytes (sorted by property `code`, NFC-normalized) |
| `watermelon_schema_json` | `jsonb` | — | NOT NULL | Generated WatermelonDB schema document — full column descriptors + decorators |
| `generated_at` | `timestamptz` | `now()` | NOT NULL | — |
| `properties_snapshot` | `jsonb` | — | NOT NULL | Snapshot of property metadata at generation time — replay-able for forensic schema diff |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |

Indexes: PK; UNIQUE `(collection_id)`; UNIQUE `(schema_hash)` — duplicate-hash detection across collections (same hash = identical schemas, useful for deduplication); `ix_mcs_generated ON (generated_at DESC)`.

#### 13.8.2 Partitioning strategy

None. `mobile_sync_conflicts` grows linearly but at the pilot scale (low thousands per month per instance) does not warrant partitioning. If hospital pilots produce > 50k conflict rows/year, a `mobile_sync_conflicts_archive_YYYY` annual partition follows the §13.7.2 pattern in a future plan-fix; flagged in §13.8.10 PR-6 acceptance.

`mobile_collection_schemas` carries one row per collection per instance — bounded by collection count (~70 in a fully-loaded customer with all 4 packs installed).

#### 13.8.3 Migrations

| # | Filename | Action |
|---|---|---|
| 1 | `1933000000000-add-sync-to-mobile-column.ts` | `ALTER TABLE metadata.collection_definitions ADD COLUMN sync_to_mobile boolean NOT NULL DEFAULT false;` |
| 2 | `1933000000001-create-mobile-sync-policies.ts` | Table + indexes; FK `ON DELETE RESTRICT` to enforce canon §14 reference-checking on collection delete |
| 3 | `1933000000002-create-mobile-sync-conflicts.ts` | Table + indexes |
| 4 | `1933000000003-create-mobile-collection-schemas.ts` | Table + indexes; `updated_at` trigger |

All migrations: `static transaction = false` where `CREATE INDEX CONCURRENTLY` is used (per W6.A `createIndexConcurrent`).

#### 13.8.4 TypeORM entities

Added to `libs/instance-db/src/lib/entities/metadata.ts` (existing area file per W6.A area-split pattern):

```typescript
@Entity({ schema: 'metadata', name: 'mobile_sync_policies' })
export class MobileSyncPolicy {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) collectionId!: string;
  @Column({ type: 'varchar', length: 32, default: 'assigned_only' })
  pullScope!: 'full' | 'assigned_only' | 'recent_only';
  @Column({ type: 'int', default: 30 }) pullRecentWindowDays!: number;
  @Column({ type: 'varchar', length: 32, default: 'server_wins' })
  conflictStrategyHeader!: ConflictStrategy;
  @Column({ type: 'varchar', length: 32, default: 'last_write_wins' })
  conflictStrategyCompletion!: ConflictStrategy;
  @Column({ type: 'varchar', length: 120, array: true, default: () => "'{}'" })
  headerFieldCodes!: string[];
  @Column({ default: true }) fieldPermissionMasking!: boolean;
  @Column({ default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ schema: 'metadata', name: 'mobile_sync_conflicts' })
export class MobileSyncConflict {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) collectionId!: string;
  @Column({ type: 'uuid' }) recordId!: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) fieldCode!: string | null;
  @Column({ type: 'timestamptz' }) detectedAt!: Date;
  @Column({ type: 'uuid' }) clientUserId!: string;
  @Column({ type: 'jsonb' }) clientValue!: unknown;
  @Column({ type: 'jsonb' }) serverValue!: unknown;
  @Column({ type: 'timestamptz' }) clientValueAtTimestamp!: Date;
  @Column({ type: 'timestamptz' }) serverValueAtTimestamp!: Date;
  @Column({ type: 'varchar', length: 32 }) strategyApplied!: ConflictStrategy;
  @Column({ default: false }) autoResolved!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) resolvedBy!: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true })
  resolutionChoice!: 'client' | 'server' | 'manual' | null;
  @Column({ type: 'jsonb', nullable: true }) manualValue!: unknown | null;
  @Column({ type: 'uuid' }) auditLogId!: string;
}

@Entity({ schema: 'metadata', name: 'mobile_collection_schemas' })
export class MobileCollectionSchema {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) collectionId!: string;
  @Column({ type: 'bytea' }) schemaHash!: Buffer;
  @Column({ type: 'jsonb' }) watermelonSchemaJson!: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) generatedAt!: Date;
  @Column({ type: 'jsonb' }) propertiesSnapshot!: unknown[];
  @Column({ type: 'uuid' }) auditLogId!: string;
}

export type ConflictStrategy = 'server_wins' | 'client_wins' | 'last_write_wins' | 'operator_review';
```

#### 13.8.5 Packages + UI primitive vocabulary

Three new npm packages under `libs/`:

- **`@hubblewave/ui-primitives`** (`libs/ui-primitives/`) — TypeScript types + primitive declarations. No runtime; pure vocabulary. Every primitive is a `PrimitiveDescriptor` carrying `{ name, props: TypeBox schema, supportedSurfaces: ['web', 'mobile'], ... }`. The package exports the constant `PRIMITIVE_REGISTRY: Record<string, PrimitiveDescriptor>` enumerating every supported primitive.
- **`@hubblewave/ui-primitives-web`** (`libs/ui-primitives-web/`) — React + MUI + Tailwind adapter. Exports one React component per primitive with the same name (`Stack`, `Field`, `Card`, `SwipeProgressCard`, ...). Web variants of field-tool primitives degrade gracefully (e.g., `SwipeProgressCard` on web uses pointer-drag instead of touch-swipe).
- **`@hubblewave/ui-primitives-mobile`** (`libs/ui-primitives-mobile/`) — React Native + Reanimated 3 adapter. Same export names, RN-native gestures.

Foundation primitives: `Stack`, `Field`, `Card`, `List`, `ActionBar`, `Chart`, `Signature`.
Capture primitives: `MediaCapture`, `BarcodeScanner`, `NameplateCamera` (LLM-OCR-backed nameplate identification).
Field-tool primitives: `SwipeProgressCard`, `ThumbToggle`, `LargeActionButton` (minimum 64dp tap target enforced via Reanimated layout measure on mobile, MUI `sx={{ minHeight: 64 }}` on web).

The `PRIMITIVE_REGISTRY` is the single source of truth for the `ui-primitive-parity-check` scanner (§13.8.9).

#### 13.8.6 Services

`apps/api/src/app/mobile/` (new module).

**`MobileCollectionSchemaService`** — `apps/api/src/app/mobile/schema/mobile-collection-schema.service.ts`:

```typescript
computeSchemaHash(collectionId: string, ctx: UserRequestContext): Promise<{ hash: Buffer; schema: WatermelonSchema }>;
publishSchema(collectionId: string, ctx: UserRequestContext): Promise<MobileCollectionSchema>;
listManifest(ctx: UserRequestContext): Promise<Array<{ collectionId: string; hashHex: string; generatedAt: string }>>;
```

`computeSchemaHash(...)` walks the collection's properties (filtered to non-masked-for-requestor per canon §28); canonicalizes (sort by property `code`, NFC-normalize property labels, RFC 3339 timestamps); computes SHA-256. `publishSchema(...)` writes the row inside `withAudit(...)` so the schema-publish event is auditable.

Schema regeneration runs on:
- Pack install (every sync-eligible collection)
- `collection_definitions.sync_to_mobile` flip from `false → true`
- Property add/update/delete on a sync-eligible collection (via `MetadataEventBus.on('property.modified')`)

**`MobileSyncService`** — `apps/api/src/app/mobile/sync/mobile-sync.service.ts`:

```typescript
pull(input: PullRequest, ctx: UserRequestContext): Promise<PullResponse>;
push(input: PushRequest, ctx: UserRequestContext): Promise<PushResponse>;
```

`pull(...)` flow:
1. Validate `lastPullCursor` per collection; cursor is `(updated_at, id)` pair.
2. For each collection in scope, apply `pull_scope` filter (full / assigned_only / recent_only); intersect with canon §28 record visibility (`AuthorizationService.filterReadable`).
3. For each readable record, apply canon §28 field-level decision; emit fields per `field_permission_masking` policy (omit on `true`, mask on `false`).
4. Return `{ deltas: { [collectionId]: { upserts: [], deletes: [], nextCursor } } }`.

`push(...)` flow per submitted write:
1. Authorization check via `AuthorizationService.canPerformAction`; deny → 403 minimal shape + AccessAuditPort.logAccessDenied. Whole-push fails on first deny (no partial commits).
2. Read server row at version `clientBaseVersionAtTimestamp`.
3. Conflict detection per field: if `serverRow.updated_at > clientBaseVersionAtTimestamp` AND fields overlap → resolve per `mobile_sync_policies.conflict_strategy_*`. The same strategy is applied online and offline (founder-locked 2026-05-17).
4. Auto-resolved conflicts: emit `mobile_sync_conflicts` row with `auto_resolved=true, strategy_applied=<resolved-strategy>`. Operator-review conflicts emit row with `auto_resolved=false`; the client write is REJECTED with 409 + the conflict ID.
5. Apply non-conflicting + resolved-in-client-favor writes inside `withAudit(...)`.
6. Return `{ accepted: [recordId], conflicts: [{recordId, conflictId, strategyApplied}] }`.

**`MobileSyncConflictService`** — `apps/api/src/app/mobile/sync/mobile-sync-conflict.service.ts`:

```typescript
listOpenConflicts(filter: ConflictFilter, ctx: UserRequestContext): Promise<MobileSyncConflict[]>;
resolveConflict(conflictId: string, choice: 'client' | 'server' | 'manual', manualValue?: unknown, ctx: UserRequestContext): Promise<void>;
```

`resolveConflict(...)` applies the chosen value via `DataRecordService.update` inside `withAudit(...)` (the record update is audit-logged as a separate row from the conflict resolution); marks the conflict row resolved.

**`OfflineSignatureQueueService`** — `apps/api/src/app/mobile/signature/offline-signature-queue.service.ts`:

```typescript
ingestQueuedSignatures(input: QueuedSignatureBatch, ctx: UserRequestContext): Promise<QueueIngestResult>;
confirmQueuedBatch(input: { batchId: string; webauthnAssertion: WebAuthnAssertion }, ctx: UserRequestContext): Promise<BatchConfirmResult>;
```

Contract (closes the §3.6 ↔ §3.7 tension, founder-locked 2026-05-17):

`ingestQueuedSignatures(...)`:
1. Receives N queued signatures from the client (each with `local_signature_id`, full canonical payload, `signed_at_utc` from the device clock, `signature_meaning`).
2. Validates authority + reason-code per signature (per §13.7.5).
3. Writes intermediate rows to a new transient queue table `compliance.offline_signature_queue` (out of scope for §13.8.1 detail; covered in PR-7 acceptance) with status `pending_reauth`. No `electronic_signatures` rows written yet.
4. Returns `{ batchId, queuedCount }`. Client UI shows the batched "Awaiting confirm" badge.

`confirmQueuedBatch(...)`:
1. Validates the presented WebAuthn assertion (fresh, < 60s) via `WebAuthnService.verifyAssertion`.
2. If valid, invokes `MerkleBatchService.batchSign(...)` with the queue's actions as one batch — Merkle root binds every queued signature cryptographically. Existing 256-leaf cap applies; queues over 256 split into ceiling(N/256) batches confirmed sequentially under the same WebAuthn assertion.
3. Deletes the `compliance.offline_signature_queue` rows on successful Merkle batch commit.
4. Returns `{ confirmedSignatures: [...], merkleRootChainEntryId }`.

The deferred-reauth path is auditor-safe because: (a) signatures don't enter `electronic_signatures` until the WebAuthn challenge confirms them, so a "signature" in the audit trail still carries fresh re-auth evidence; (b) the offline_signature_queue rows carry the device clock `signed_at_utc` plus the server clock `enqueued_at_utc` so post-hoc reconstruction shows the timeline accurately; (c) the queue is bounded — if a technician never reconnects, queued signatures eventually expire and the client surfaces "Pending signatures could not be confirmed" with the full action list for manual replay.

#### 13.8.7 API endpoints

| Method | Path | Boundary | Body / params |
|---|---|---|---|
| `GET` | `/api/mobile/sync/manifest` | `@AuthenticatedOnly()` | — returns array of `{ collectionId, schemaHashHex, pullScope, fieldPermissionMasking }` |
| `GET` | `/api/mobile/schemas/:collectionId` | `@RequireCollectionAccess('read')` | — returns full `watermelonSchemaJson` |
| `POST` | `/api/mobile/sync/pull` | `@AuthenticatedOnly()` | `{ collections: [{ collectionId, lastPullCursor }] }` returns delta payload |
| `POST` | `/api/mobile/sync/push` | `@AuthenticatedOnly()` | `{ writes: [{ collectionId, recordId, clientBaseVersionAt, fields }] }` returns `{ accepted, conflicts }` |
| `GET` | `/api/mobile/sync/conflicts` | `@RequirePermission('mobile:sync:conflict:read')` | query: `collectionId?`, `status?`, `assignee?` |
| `POST` | `/api/mobile/sync/conflicts/:id/resolve` | `@RequirePermission('mobile:sync:conflict:resolve')` | `{ choice: 'client'\|'server'\|'manual', manualValue? }` |
| `POST` | `/api/mobile/sync/queued-signatures` | `@RequirePermission('compliance:signature:sign')` | `{ signatures: [...queued] }` returns `{ batchId, queuedCount }` |
| `POST` | `/api/mobile/sync/queued-signatures/:batchId/confirm` | `@RequirePermission('compliance:signature:sign')` | `{ webauthnAssertion }` returns `{ confirmedSignatures, merkleRootChainEntryId }` |
| `POST` | `/api/mobile/sync/queued-signatures/:batchId/abandon` | `@RequirePermission('compliance:signature:sign')` | — drops the queued batch; emits high-severity audit |

Permission codes added to `PERMISSION_REGISTRY`:
- `mobile:sync:conflict:read`, `mobile:sync:conflict:resolve`

(`compliance:signature:sign` already exists from §13.7 — reused here.)

`/api/mobile/sync/pull` and `/api/mobile/sync/push` are `@AuthenticatedOnly()` rather than `@RequirePermission` because per-record + per-field §28 authorization happens INSIDE the service, not at the boundary; the boundary just confirms a valid user session.

#### 13.8.8 Validator extensions

Pack validator gains 4 new publish gates:

1. **G8.1** — Any `collection_definitions.sync_to_mobile = true` MUST have a corresponding `mobile_sync_policies` row. Error: `MISSING_MOBILE_SYNC_POLICY`.
2. **G8.2** — Every `mobile_sync_policies.header_field_codes[]` value MUST resolve to an existing property `code` on the same collection. Error: `INVALID_HEADER_FIELD_CODE`.
3. **G8.3** — `mobile_sync_policies.conflict_strategy_*` MUST be in the canonical enum. Error: `INVALID_CONFLICT_STRATEGY`.
4. **G8.4** — Any `FormDefinition` published on a `sync_to_mobile=true` collection MUST use only primitives whose `PRIMITIVE_REGISTRY[name].supportedSurfaces` includes `'mobile'`. Error: `MOBILE_INELIGIBLE_PRIMITIVE` (lists the offending primitive + form path).

Frontend lint rule additions (`tools/eslint-rules/`):
- `hw/no-direct-mui-import-in-mobile-form` — files in `apps/mobile/src/forms/` MUST NOT import from `@mui/material` directly; must use `@hubblewave/ui-primitives-mobile`. Error level.

#### 13.8.9 Service-boundary scanner rules + new parity scanner

`tools/service-boundary-check.ts` `KNOWN_WRITES` table gains:

| Entity | Allowed writers |
|---|---|
| `MobileSyncPolicy` | `MobileSyncPolicyService.*`, `PackInstaller.installMobileSyncPolicies` |
| `MobileSyncConflict` | `MobileSyncService.push`, `MobileSyncConflictService.resolveConflict` |
| `MobileCollectionSchema` | `MobileCollectionSchemaService.publishSchema` |

`tools/ui-primitive-parity-check.ts` (NEW scanner, founder-locked 2026-05-17):
- Reads `PRIMITIVE_REGISTRY` from `@hubblewave/ui-primitives`.
- Globs the public export surface of `@hubblewave/ui-primitives-web/src/index.ts` and `@hubblewave/ui-primitives-mobile/src/index.ts`.
- For each entry in the registry: BOTH adapters MUST export a symbol matching the primitive name. Asymmetric exports fail CI with `PRIMITIVE_PARITY_VIOLATION: <name> exported from -web only` or vice versa.
- Self-test: 8 assertions covering (a) registered + both exported → pass; (b) registered + web-only → fail; (c) registered + mobile-only → fail; (d) unregistered + both exported → flagged as orphan; (e) registered + neither exported → fail; (f) primitive renamed on one side → fail; (g) export-default vs named-export distinction handled; (h) self-test stable across Windows + Linux paths.

`tools/elevator-mode-check.ts` (NEW scanner, founder-locked 2026-05-17):
- Greps `apps/mobile/src/` for action handlers (functions matching `on[A-Z]\w+` exported from `actions.ts` files).
- Flags any handler whose body starts with `await fetch(` / `await api.` BEFORE a WatermelonDB write (regex check on the first non-comment statement).
- Codifies the Elevator Mode invariant: local optimistic write MUST happen before any network call.
- Allowlist entry per legitimate exception (read-only refresh actions, etc.); allowlist tagged with `followUp` notes for review.

#### 13.8.10 Tests (self-test ≥ 18 assertions)

Integration + e2e tests at `apps/api/test/integration/mobile-*.spec.ts` and `apps/mobile/test/e2e/elevator-mode-*.spec.ts`:

1. **`mobile-semantic-equivalence.spec.ts`** — same `FormDefinition` JSON rendered via `@hubblewave/ui-primitives-web` and via `@hubblewave/ui-primitives-mobile`; assert (a) field set identical, (b) visibility rules emit identical computed booleans for the same record, (c) permission gates emit identical hidden-field sets.
2. **`mobile-collection-schema-hash-stable.spec.ts`** — same collection content → same `schema_hash` across two `computeSchemaHash` calls.
3. **`mobile-collection-schema-hash-detects-change.spec.ts`** — add a property → hash changes; remove the property → hash returns to original value (deterministic).
4. **`mobile-sync-pull-scope-assigned-only.spec.ts`** — user A pulls; receives only records where `assignee_id = A`; user B pulls same collection; receives B's records.
5. **`mobile-sync-pull-field-permission-masking.spec.ts`** — user with masked-field policy on `salary` pulls; record arrives WITHOUT the `salary` field key (masked-as-omission per `field_permission_masking=true`).
6. **`mobile-sync-push-server-wins-header.spec.ts`** — client offline edits header field; server modified header in parallel; push reconciles to server value; `mobile_sync_conflicts` row written with `auto_resolved=true, strategy_applied='server_wins'`.
7. **`mobile-sync-push-lww-completion.spec.ts`** — client offline edits a completion field with `signed_at_utc` AFTER server's last update → client wins; conflicts row records the resolution.
8. **`mobile-sync-push-operator-review.spec.ts`** — collection configured with `conflict_strategy_header='operator_review'`; client push collides; 409 returned with conflict ID; row appears in `MobileSyncConflictService.listOpenConflicts`.
9. **`mobile-sync-push-authorization-deny.spec.ts`** — user pushes a write to a record they lack `update` permission on; entire push rejected with canon §28 minimal 403 shape; no rows committed; `AccessAuditPort.logAccessDenied` row written.
10. **`mobile-sync-pull-cursor-resume.spec.ts`** — pull twice; first call returns 50 rows + cursor; second call resumes from cursor and returns next 50 + null cursor.
11. **`mobile-offline-signature-queue.spec.ts`** — client queues 3 closure signatures offline; calls `/queued-signatures` (stored in `offline_signature_queue` as `pending_reauth`); presents WebAuthn assertion via `/confirm`; `MerkleBatchService.batchSign` produces ONE `signature_chains` merkle_root row + 3 `electronic_signatures` rows; queue rows deleted; total chain extension = 1 row.
12. **`mobile-offline-signature-queue-abandon.spec.ts`** — queue 2 signatures; abandon batch; rows deleted; high-severity audit row written; zero `electronic_signatures` created.
13. **`mobile-offline-signature-256-split.spec.ts`** — queue 300 signatures; single WebAuthn confirm splits into 2 Merkle batches (256 + 44 leaves); each is a separate `signature_chains` merkle_root row; chain remains linear.
14. **`mobile-primitive-parity-scanner.spec.ts`** — temporarily remove a primitive from `-mobile`; scanner CI exits non-zero with `PRIMITIVE_PARITY_VIOLATION`; restore; scanner passes.
15. **`mobile-elevator-mode-scanner.spec.ts`** — temporarily add `await api.x()` before WatermelonDB write in a mobile action handler; scanner CI exits non-zero; revert; passes.
16. **`mobile-elevator-mode-acceptance.spec.ts`** — full e2e in iOS simulator with network disabled: open WO list → swipe through states → complete checklist → capture photo → e-sign (queued) → close. Re-enable network; sync flushes; all writes commit + queued signature confirmed via WebAuthn modal.
17. **`mobile-sync-conflict-policy-online.spec.ts`** — two browser sessions edit the same record concurrently while both online; second write triggers conflict per same policy as offline path (founder-locked 2026-05-17); conflict row written.
18. **`mobile-collection-delete-blocks-on-policy.spec.ts`** — attempt to delete a collection that has a `mobile_sync_policies` row → blocked by canon §14 reference-checking; structured "in-use" error lists the policy.

Self-test count: 18 integration tests × ≥ 1 primary assertion + 8 assertions on the parity scanner self-test + 6 on the elevator-mode scanner self-test = ≥ 32 new assertions in the §3.7 acceptance lattice.

#### 13.8.11 PR breakdown for §3.7

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | `@hubblewave/ui-primitives` package + `PRIMITIVE_REGISTRY` + `ui-primitive-parity-check.ts` scanner + scanner self-test | `libs/ui-primitives/**`; `tools/ui-primitive-parity-check.ts`; `tools/ui-primitive-parity-check.spec.ts`; CI workflow job | Package builds; 8 scanner self-test assertions pass; CI gate added as required |
| 2 | `@hubblewave/ui-primitives-web` adapter (MUI + Tailwind) | `libs/ui-primitives-web/**`; storybook stories per primitive | Every `PRIMITIVE_REGISTRY` entry has a `-web` export; storybook renders; parity scanner passes |
| 3 | `@hubblewave/ui-primitives-mobile` adapter (RN + Reanimated) including field-tool primitives | `libs/ui-primitives-mobile/**`; Expo build target verifies | Every registry entry has a `-mobile` export; `LargeActionButton` measures ≥ 64dp on iOS + Android; `SwipeProgressCard` gesture binding stable |
| 4 | Migrations + entities + `sync_to_mobile` column + service-boundary writer rules | Migrations 1-4; entities in `metadata.ts` area file; `service-boundary-check.ts` rules; validator G8.1-G8.3 | Migrations run cleanly; entity barrel preserved; validator rejects bad config |
| 5 | `MobileCollectionSchemaService` + manifest + schema-publish hooks + tests 2, 3 | `apps/api/src/app/mobile/schema/**`; `MetadataEventBus` wire | Hash stable; hash detects change; publish writes via `withAudit` |
| 6 | `MobileSyncService.pull + push` + `MobileSyncConflictService` + canon §28 plumbing + tests 4-10, 17, 18 | `apps/api/src/app/mobile/sync/**`; `mobile_sync_conflicts` operator workspace stub | Conflict policy honored online + offline; field-masking emits omission; cursor pagination resumes; collection delete blocked by §14 |
| 7 | `OfflineSignatureQueueService` + `offline_signature_queue` table + queued/confirm/abandon endpoints + Merkle batch handoff + tests 11, 12, 13 | `apps/api/src/app/mobile/signature/**`; new migration for `offline_signature_queue`; integration with §13.7 `MerkleBatchService` | 256-split works; abandon emits high-severity audit; WebAuthn assertion gates the commit; bundle hash binds queued leaves cryptographically |
| 8 | `elevator-mode-check.ts` scanner + mobile e2e acceptance + canon §33 amendment + `hw/no-direct-mui-import-in-mobile-form` ESLint rule | `tools/elevator-mode-check.ts` + self-test; `apps/mobile/test/e2e/elevator-mode-*.spec.ts`; `tools/eslint-rules/no-direct-mui-import-in-mobile-form.cjs`; CLAUDE.md amendment | Scanner CI gate added; e2e completes a full WO offline → sync; canon merged |

**Total: 8 PRs for §3.7. Estimated effort: ~14-18 working days.**

---

### 13.9 Worked example: §3.8 AVA Runtime UI Synthesis (full artifact-level spec — Invisible Manual + transient FormDefinition rendering)

#### 13.9.1 Tables

No new persistent tables (request-scoped synthesis per §3.8 prose). Three additive columns on the existing `ava.ava_proposals` entity (canon §11/§12):

**`ava.ava_proposals`** — gains three columns:

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `synthesis_kind` | `varchar(64)` | — | NULL | Set when proposal carries a synthesized `FormDefinition`; values e.g. `troubleshooting_checklist`, `manual_excerpt_form`, `inline_diagnostic_grid` |
| `synthesized_form_def` | `jsonb` | — | NULL | Full `FormDefinition` JSON; rendered by client via `@hubblewave/ui-primitives` |
| `validator_passed` | `boolean` | — | NULL | `true` when `FormDefinitionValidator.validate()` returned no errors; `false` when synthesis was refused (proposal still recorded for canon §12 traceability — the auditor sees what AVA *tried* to render even when refused) |

Index: `ix_ava_synthesis_kind ON (synthesis_kind) WHERE synthesis_kind IS NOT NULL` — partial; supports "show me all troubleshooting synthesis attempts in the last week" queries.

#### 13.9.2 Migrations

| # | Filename | Action |
|---|---|---|
| 1 | `1934000000000-add-ava-proposal-synthesis-columns.ts` | `ALTER TABLE ava.ava_proposals ADD COLUMN synthesis_kind varchar(64) NULL, ADD COLUMN synthesized_form_def jsonb NULL, ADD COLUMN validator_passed boolean NULL;` + index via `createIndexConcurrent` |

#### 13.9.3 Services

`apps/api/src/app/ava/synthesis/` (new submodule under existing `ava` module).

**`AvaFormSynthesisService`** — `apps/api/src/app/ava/synthesis/ava-form-synthesis.service.ts`:

```typescript
synthesize(input: SynthesisRequest, ctx: UserRequestContext): Promise<SynthesisResult>;
```

`SynthesisRequest` carries `{ toolName: string; toolInput: Record<string, unknown>; targetCollectionId?: string; targetRecordId?: string; }`. Flow:
1. Resolve the registered `AVATool` by `toolName`; refuse with 404 if unknown. Every synthesis tool is gated through canon §12 trust progression — the tool's `trust_state` column (existing) determines whether the result auto-renders (`execute`) or requires a Preview confirmation (`suggest`/`preview`).
2. Invoke the tool's handler (registered by the pack at boot via `AVAToolRegistry.register({ name, handler, trust_state })`). Handler returns a candidate `FormDefinition` JSON.
3. Pass the candidate through `FormDefinitionValidator.validate(candidate, { synthesisMode: true })`. The validator is the SAME one pack-shipped forms use — only `@hubblewave/ui-primitives` primitive names allowed, no escape hatches. Synthesis-mode adds two additional rules: (a) max 20 fields, (b) max nested depth of 3 (prevents AVA from emitting a UI bomb).
4. Write an `AVAProposal` row inside `withAudit(...)` with `synthesis_kind`, `synthesized_form_def` (if validator passed), `validator_passed = boolean`. The trust-state policy determines `proposal_state`: `execute` → `applied`; `suggest`/`preview` → `pending_review`.
5. Return `{ proposalId, formDef?, validatorErrors?, trustState }`.

The handler-emitted `FormDefinition` is NEVER persisted to `metadata.form_definitions` — pack-shipped vs synthesized forms are distinct surfaces. Persisted forms come through pack publishers; synthesized forms render-and-vanish via the proposal row.

**`FormDefinitionValidator`** — extended (existing service from §3.7 G8.4):

```typescript
validate(formDef: FormDefinition, options?: { synthesisMode?: boolean }): ValidationResult;
```

Synthesis mode additionally enforces field-count + depth caps. Errors emit structured codes: `SYNTHESIS_FIELD_CAP_EXCEEDED`, `SYNTHESIS_NEST_DEPTH_EXCEEDED`.

#### 13.9.4 API endpoints

| Method | Path | Boundary | Body / params |
|---|---|---|---|
| `POST` | `/api/ava/synthesize` | `@RequirePermission('ava:synthesis:invoke')` | `{ toolName, toolInput, targetCollectionId?, targetRecordId? }` returns `{ proposalId, formDef?, validatorErrors?, trustState }` |
| `GET` | `/api/ava/proposals/:id/synthesis` | `@RequirePermission('ava:proposal:read')` | — returns the persisted `synthesized_form_def` for audit/replay |

New permission codes in `PERMISSION_REGISTRY`:
- `ava:synthesis:invoke`
- `ava:proposal:read` (reused from canon §11)

#### 13.9.5 Validator extensions

Pack validator gains 2 publish gates:

1. **G9.1** — Pack `ava_tools[]` declarations MUST resolve to functions exported by the pack's `ava-tools/` directory; registration signature `AVAToolRegistry.register({ name, handler, trust_state })`. Error: `MISSING_AVA_TOOL_HANDLER`.
2. **G9.2** — Every `ava_tools[].trust_state` MUST be in `{suggest, preview, execute}` per canon §12 per-feature trust progression. Error: `INVALID_TRUST_STATE`.

#### 13.9.6 Service-boundary scanner rules

Writes to `ava.ava_proposals` already restricted to `AvaProposalService`; allow `AvaFormSynthesisService` in `tools/service-boundary-check.ts` `KNOWN_WRITES`. No new entity-writer rules.

#### 13.9.7 Tests (self-test ≥ 10 assertions)

Integration tests at `apps/api/test/integration/ava-synthesis-*.spec.ts`:

1. **`ava-synthesis-happy-path.spec.ts`** — register `synthesizeTroubleshootingChecklist`; invoke via API; validator passes; proposal row written with `synthesis_kind` + `synthesized_form_def`.
2. **`ava-synthesis-validator-refuses-non-primitive.spec.ts`** — tool emits `FormDefinition` referencing primitive `LegacyMuiButton` (not in `PRIMITIVE_REGISTRY`); validator rejects; proposal row written with `validator_passed=false` and `synthesized_form_def=null`; API response 422 with structured error.
3. **`ava-synthesis-field-cap-exceeded.spec.ts`** — tool emits 25 fields; validator rejects with `SYNTHESIS_FIELD_CAP_EXCEEDED`; proposal still written.
4. **`ava-synthesis-nest-depth-exceeded.spec.ts`** — tool emits 4-level-nested Stack; rejects with `SYNTHESIS_NEST_DEPTH_EXCEEDED`.
5. **`ava-synthesis-trust-state-suggest.spec.ts`** — tool registered with `trust_state='suggest'`; result `proposal_state = pending_review`; UI must call `confirmProposal` before render.
6. **`ava-synthesis-trust-state-execute.spec.ts`** — same but `trust_state='execute'`; `proposal_state='applied'`; UI renders directly.
7. **`ava-synthesis-authorization.spec.ts`** — user without `ava:synthesis:invoke` gets canon §28 minimal 403; `AccessAuditPort.logAccessDenied` row written.
8. **`ava-synthesis-mobile-primitive-only.spec.ts`** — synthesis on a `sync_to_mobile=true` collection refuses primitives whose `supportedSurfaces` lacks `'mobile'`; reuses §13.8 G8.4.
9. **`ava-synthesis-canon12-audit.spec.ts`** — every synthesis call (passed AND refused) writes one `audit_logs` row; payload includes tool name + validator result.
10. **`ava-synthesis-validator-mode-symmetry.spec.ts`** — same `FormDefinition` passes both pack-validator and synthesis-validator; only synthesis-mode additions are field-cap + nest-depth. Regression test for validator drift.

#### 13.9.8 PR breakdown for §3.8

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Migration + entity columns + `AvaFormSynthesisService` + `FormDefinitionValidator` synthesis mode + tests 1, 2, 9, 10 | Migration 1; `ava.ts` entity area patch; `apps/api/src/app/ava/synthesis/**`; validator extension; integration tests | Happy-path renders; invalid primitive refused; audit row per call; validator mode symmetry test green |
| 2 | API endpoints + permission codes + `AVAToolRegistry` boot wiring + tests 3, 4, 7, 8 | `apps/api/src/app/ava/synthesis/synthesis.controller.ts`; `PERMISSION_REGISTRY` + sync; pack-installer hook | Field-cap rejected; nest-depth rejected; 403 on missing permission; mobile-eligible refusal |
| 3 | Trust-state plumbing + Suggest/Preview/Execute branches + canon §11 amendment + tests 5, 6 | Trust-state policy lookup; canon §11/§12 amendment to CLAUDE.md | Suggest defers render; Execute renders inline; canon merged |

**Total: 3 PRs for §3.8. Estimated effort: ~4-5 working days.**

---

### 13.10 Worked example: §3.9 Public Intake Primitive (full artifact-level spec — signed-token QR intake + AVA triage + hardening)

#### 13.10.1 Tables

All tables in `schema: 'intake'` (NEW schema).

**`intake.public_intake_tokens`** — issued tokens; each bound to a specific record so a leaked QR cannot be used against other assets.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | NULL in single-tenant; NOT NULL in pooled |
| `code` | `varchar(64)` | — | NOT NULL | UNIQUE — public-facing token string (high-entropy random) |
| `purpose` | `varchar(64)` | — | NOT NULL | Pack-declared; e.g. `facility_asset_qr`, `walkby_nurse_intake`, `incident_report` |
| `scope_collection_id` | `uuid` | — | NOT NULL | The collection the token routes submissions into |
| `scope_record_id` | `uuid` | — | NULL | When present, the specific record this token is bound to (e.g., one asset) — REQUIRED by validator G10.4 for purposes declaring `record_bound=true` |
| `issued_by_user_id` | `uuid` | — | NOT NULL | FK → `identity.users(id)` |
| `signing_kid` | `varchar(64)` | — | NOT NULL | Per canon §29.2; the kid used to sign embedded JWT envelopes (token also includes raw `code` for visual scanning) |
| `expires_at` | `timestamptz` | — | NOT NULL | When the token stops accepting submissions |
| `max_uses` | `int` | — | NULL | NULL = unlimited within expiry; >0 caps total submissions |
| `uses` | `int` | `0` | NOT NULL | Incremented atomically on each submission |
| `rotation_policy` | `varchar(32)` | `'lifetime'` | NOT NULL | CHECK ∈ `{lifetime, quarterly_rotate}` per §3.9 prose |
| `next_rotation_at` | `timestamptz` | — | NULL | When `rotation_policy='quarterly_rotate'`, the next scheduled rotation |
| `revoked_at` | `timestamptz` | — | NULL | One-tap revoke by Maintenance Manager / Compliance Officer |
| `revoked_reason` | `varchar(64)` | — | NULL | `manual_revoke` / `abuse_detected` / `asset_quarantined` / `rotation` |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

Indexes: PK; UNIQUE `(code)`; `ix_pit_purpose ON (purpose, expires_at) WHERE revoked_at IS NULL`; `ix_pit_scope ON (scope_collection_id, scope_record_id) WHERE revoked_at IS NULL`; `ix_pit_rotation ON (next_rotation_at) WHERE rotation_policy = 'quarterly_rotate' AND revoked_at IS NULL`.

**`intake.public_intake_submissions`** — every public submission.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `token_id` | `uuid` | — | NOT NULL | FK → `public_intake_tokens(id)` |
| `client_idempotency_uuid` | `uuid` | — | NOT NULL | Client-generated; UNIQUE per `(token_id, client_idempotency_uuid)` — duplicate submissions return the same submission code |
| `submission_code` | `varchar(32)` | — | NOT NULL | UNIQUE; public-facing confirmation code returned to caller |
| `raw_payload` | `jsonb` | — | NOT NULL | Original JSON body (max 50KB enforced at HTTP layer) |
| `structured_payload` | `jsonb` | — | NULL | AVA-normalized form; set when worker completes |
| `ava_proposal_id` | `uuid` | — | NULL | FK → `ava.ava_proposals(id)` |
| `resolved_collection_id` | `uuid` | — | NULL | The collection a record was created in (e.g., `work_orders`) |
| `resolved_record_id` | `uuid` | — | NULL | The created record |
| `ip_hash` | `bytea` | — | NOT NULL | SHA-256 of source IP — plaintext IP NEVER stored on the operational table per §29.5 pattern |
| `user_agent_hash` | `bytea` | — | NOT NULL | SHA-256 of UA |
| `geo_country_code` | `varchar(2)` | — | NULL | Best-effort ISO 3166-1 alpha-2 from GeoIP |
| `outcome` | `varchar(32)` | `'pending_processing'` | NOT NULL | CHECK ∈ `{pending_processing, processed, refused_rate_limit, refused_scan_failed, refused_malformed, refused_token_revoked, refused_token_expired, refused_token_exhausted}` |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `processed_at` | `timestamptz` | — | NULL | Set when worker finishes |

Indexes: PK; UNIQUE `(token_id, client_idempotency_uuid)`; UNIQUE `(submission_code)`; `ix_pis_token ON (token_id, created_at DESC)`; `ix_pis_outcome ON (outcome, created_at) WHERE outcome != 'processed'`.

**`intake.public_intake_attachments`** — per-submission attachment metadata; binary payload in S3.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK; this UUID is the attachment ID the JSON payload references |
| `submission_id` | `uuid` | — | NOT NULL | FK → `public_intake_submissions(id)` |
| `storage_uri` | `text` | — | NOT NULL | `s3://intake-bucket/instance/{instance_id}/{submission_id}/{id}` |
| `content_type` | `varchar(128)` | — | NOT NULL | RFC 6838 |
| `size_bytes` | `bigint` | — | NOT NULL | CHECK `size_bytes <= 25 * 1024 * 1024` (25 MB cap per §3.9 prose) |
| `sha256` | `bytea` | — | NOT NULL | 32 bytes; computed by ingest worker post-upload |
| `scan_status` | `varchar(16)` | `'pending'` | NOT NULL | CHECK ∈ `{pending, scanning, clean, quarantined}` |
| `scan_results` | `jsonb` | — | NULL | `{ av: {verdict, scanner_version}, secrets: {verdict, hits}, pii: {verdict, categories} }` |
| `quarantine_reason` | `varchar(120)` | — | NULL | Filled when `scan_status='quarantined'` |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `scanned_at` | `timestamptz` | — | NULL | — |

Indexes: PK; `ix_pia_submission ON (submission_id)`; `ix_pia_scan_pending ON (scan_status) WHERE scan_status IN ('pending', 'scanning')`.

#### 13.10.2 Migrations

| # | Filename | Action |
|---|---|---|
| 1 | `1935000000000-create-intake-schema.ts` | `CREATE SCHEMA intake;` |
| 2 | `1935000000001-create-public-intake-tokens.ts` | Table + indexes |
| 3 | `1935000000002-create-public-intake-submissions.ts` | Table + indexes |
| 4 | `1935000000003-create-public-intake-attachments.ts` | Table + indexes |

#### 13.10.3 Services

`apps/api/src/app/intake/` (new module) + `apps/worker/src/intake/` (new module).

**`PublicIntakeTokenService`** — API side; issues + revokes tokens.
- `issue(input: IssueTokenRequest, ctx: UserRequestContext): Promise<PublicIntakeToken>` — issuance requires `intake:token:issue` permission; writes via `withAudit`.
- `revoke(tokenId: string, reason: string, ctx: UserRequestContext): Promise<void>` — one-tap revoke; writes high-severity audit if `reason='abuse_detected'`.
- `quarantineAsset(collectionId: string, recordId: string, ctx: UserRequestContext): Promise<void>` — revokes ALL tokens scoped to that record AND blocks future issuance via `intake_asset_quarantine` flag (new column on `collection_records` — out of scope to add for §13.10; tracked as PR-3 acceptance dependency).

**`PublicIntakeSubmissionController`** — `apps/api/src/app/intake/public-intake.controller.ts`. Public endpoints (`@Public` decorator, but per-route rate-limited):
- `POST /api/public/intake/:tokenCode/submit` — single-step JSON submission. Validates token (not revoked, not expired, uses < max_uses); validates payload against the pack-declared schema for `token.purpose`; computes ip_hash + ua_hash + geo_country_code; emits `RuntimeAnomaly` row if (a) rate-limit breached, (b) geo-anomaly detected (token issued in country X but submission from country Y for `quarterly_rotate` tokens). Returns `{ submissionCode }` and NEVER any operational data.
- `POST /api/public/intake/:tokenCode/attachment-url` — pre-signed S3 upload URL. Per-attachment scope. Returns `{ attachmentId, presignedUrl, expiresAt }`.

**`PublicIntakeProcessor`** — worker side; `apps/worker/src/intake/public-intake.processor.ts`. On BullMQ job pickup:
1. Wait for ALL attachments referenced by the submission to reach `scan_status='clean'`; if any hits `quarantined`, mark the submission `outcome='refused_scan_failed'`, emit `RuntimeAnomaly`, stop.
2. Run AVA structured extraction via the pack-declared handler for `token.purpose`; output goes to `structured_payload` + creates an `AVAProposal` row.
3. Dispatch to the pack action handler under a system principal scoped to `intake:dispatch:<purpose>` (system principal is the canon §29.7 service-principal mechanism); the pack creates the target record (e.g., a Work Order from a walk-by nurse intake) and writes `resolved_collection_id` + `resolved_record_id` back onto the submission.
4. Stamp `outcome='processed'` + `processed_at`.

**`AttachmentScanProcessor`** — worker side; runs AV + secret-scan + PII-scan + content-hash pipeline on each attachment upload. Reuses §3.12 Storage runtime infrastructure (PR-5 acceptance documents the dependency).

#### 13.10.4 API endpoints

| Method | Path | Boundary | Body / params |
|---|---|---|---|
| `POST` | `/api/intake/tokens` | `@RequirePermission('intake:token:issue')` | `{ purpose, scopeCollectionId, scopeRecordId?, expiresAt, maxUses?, rotationPolicy? }` |
| `DELETE` | `/api/intake/tokens/:id` | `@RequirePermission('intake:token:revoke')` | `{ reason }` |
| `POST` | `/api/intake/assets/:collectionId/:recordId/quarantine` | `@RequirePermission('intake:asset:quarantine')` | `{ reason }` |
| `GET` | `/api/intake/submissions` | `@RequirePermission('intake:submission:read')` | query: `tokenId?`, `outcome?` |
| `POST` | `/api/public/intake/:tokenCode/submit` | `@Public()` (per-token + per-IP rate-limited) | `{ clientIdempotencyUuid, payload, attachments?: [{attachmentId}] }` returns `{ submissionCode }` |
| `POST` | `/api/public/intake/:tokenCode/attachment-url` | `@Public()` (per-token rate-limited) | `{ filename, contentType, sizeBytes }` returns `{ attachmentId, presignedUrl, expiresAt }` |

New permission codes: `intake:token:issue`, `intake:token:revoke`, `intake:asset:quarantine`, `intake:submission:read`. `intake:asset:quarantine` is `dangerous: true`.

#### 13.10.5 Validator extensions

Pack validator gains 5 publish gates:

1. **G10.1** — Pack `public_intake.schemas[]` MUST declare a JSON Schema for each purpose's payload. Error: `MISSING_INTAKE_SCHEMA`.
2. **G10.2** — Pack `public_intake.purposes[].dispatch_handler` MUST resolve to an exported function. Error: `MISSING_INTAKE_DISPATCH_HANDLER`.
3. **G10.3** — Pack `public_intake.purposes[].rotation_policy` MUST be in `{lifetime, quarterly_rotate}`. Error: `INVALID_ROTATION_POLICY`.
4. **G10.4** — When `public_intake.purposes[].record_bound = true`, token issuance MUST require `scope_record_id`. Error: `RECORD_BOUND_PURPOSE_MISSING_RECORD`.
5. **G10.5** — Pack `public_intake.purposes[].max_payload_kb` MUST be ≤ 50 (platform cap). Error: `PAYLOAD_CAP_EXCEEDED`.

#### 13.10.6 Service-boundary scanner rules

`tools/service-boundary-check.ts` `KNOWN_WRITES`:

| Entity | Allowed writers |
|---|---|
| `PublicIntakeToken` | `PublicIntakeTokenService.*` |
| `PublicIntakeSubmission` | `PublicIntakeSubmissionController.submit`, `PublicIntakeProcessor.process` |
| `PublicIntakeAttachment` | `PublicIntakeSubmissionController.requestAttachmentUrl`, `AttachmentScanProcessor.recordScanResult` |

Additionally added to `tools/security-bypass-check.ts` `PUBLIC_ALLOWLIST` (the two public endpoints under `/api/public/intake/`).

#### 13.10.7 Tests (self-test ≥ 15 assertions)

1. **`intake-token-issue-and-submit.spec.ts`** — issue token; submit valid payload; submission processed; pack dispatch creates target record; `resolved_record_id` populated.
2. **`intake-idempotency.spec.ts`** — submit twice with same `clientIdempotencyUuid`; second response returns identical `submissionCode`; only ONE submission row created.
3. **`intake-token-expired.spec.ts`** — token with `expires_at = past`; submit returns 410 generic message; submission row created with `outcome='refused_token_expired'`.
4. **`intake-token-revoked.spec.ts`** — issue + revoke; submit returns 410 generic; row with `outcome='refused_token_revoked'`.
5. **`intake-token-exhausted.spec.ts`** — `max_uses=1`; first submit OK; second returns 410; row with `outcome='refused_token_exhausted'`.
6. **`intake-rate-limit.spec.ts`** — 101 submissions/min from same IP hash; 100th OK, 101st returns 429; `RuntimeAnomaly` row written.
7. **`intake-attachment-clean-flow.spec.ts`** — request attachment URL; upload binary to LocalStack S3; scan transitions `pending → scanning → clean`; submission references attachment by `attachmentId`; processor proceeds.
8. **`intake-attachment-quarantined.spec.ts`** — AV scanner flags upload; `scan_status='quarantined'`; submission processor refuses + `outcome='refused_scan_failed'`; `RuntimeAnomaly` written.
9. **`intake-attachment-size-cap.spec.ts`** — upload 26MB attachment rejected with structured error; CHECK constraint trips.
10. **`intake-payload-size-cap.spec.ts`** — 51KB JSON payload rejected; G10.5-equivalent runtime check.
11. **`intake-no-data-leakage.spec.ts`** — submit; inspect response body and headers — contains ONLY `submissionCode`; no record IDs, no field values, no token metadata.
12. **`intake-geo-anomaly.spec.ts`** — token issued from US IP; submission from offshore IP; `RuntimeAnomaly` emitted with kind `intake_geo_anomaly`; submission still accepted (alert-only).
13. **`intake-asset-quarantine.spec.ts`** — quarantine asset; all asset-scoped tokens marked revoked; new token issuance for that scope refused with structured error.
14. **`intake-rotation-quarterly.spec.ts`** — token with `rotation_policy='quarterly_rotate'` advances `next_rotation_at`; cron job (apps/worker scheduled task) rotates code on the boundary; old code returns 410 thereafter; new code is delivered to the customer's rotation webhook.
15. **`intake-system-principal-dispatch.spec.ts`** — pack dispatch handler runs as system principal scoped to `intake:dispatch:<purpose>`; cannot escalate to write outside its declared collection scope; canon §29.7 audience binding enforced.

#### 13.10.8 PR breakdown for §3.9

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Schema + tokens table + `PublicIntakeTokenService` + issuance/revocation endpoints + tests 3, 4, 5, 13 | Migrations 1+2; entity area patch; `apps/api/src/app/intake/token/**`; validator G10.3, G10.4 | Token lifecycle stable; revoke cascades to scope; G10.4 enforced |
| 2 | submissions + attachments tables + public submission endpoint + idempotency + rate-limit + tests 1, 2, 6, 10, 11 | Migrations 3+4; `apps/api/src/app/intake/public/**`; per-token + per-IP rate-limiter middleware; security-bypass PUBLIC_ALLOWLIST entry | No data leakage in response; idempotency works; rate-limit emits RuntimeAnomaly |
| 3 | Attachment pre-signed URL + AttachmentScanProcessor + AV/secret/PII pipeline + tests 7, 8, 9 | `apps/worker/src/intake/attachment-scan.processor.ts`; LocalStack S3 fixture; integration with §3.12 Storage runtime | Clean attachments propagate; quarantined block submission; size cap enforced |
| 4 | `PublicIntakeProcessor` + AVA structured extraction + pack dispatch handler + system principal + tests 1 (full path), 15 | `apps/worker/src/intake/public-intake.processor.ts`; pack-installer hooks; canon §29.7 system principal seeding | Submission → AVA → record creation works; system principal cannot escalate scope |
| 5 | Asset quarantine + rotation cron + geo-anomaly detection + canon §36 amendment + tests 12, 13, 14 | `apps/worker/src/intake/rotation-cron.processor.ts`; GeoIP wiring; canon §36 amendment to CLAUDE.md | Rotation rolls token code on schedule; geo-anomaly emits alert; canon merged |

**Total: 5 PRs for §3.9. Estimated effort: ~10-12 working days.**

---

### 13.11 Worked example: §3.10 Break-Glass Field Override (full artifact-level spec — time-bound unmasking + hard-deny classes + canon §28.10)

#### 13.11.1 Tables + additive columns

Two additive columns on the existing `metadata.property_definitions` table, plus one new table in `schema: 'compliance'`.

**`metadata.property_definitions`** — gains two columns:

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `break_glass_eligible` | `boolean` | `false` | NOT NULL | When `true`, property can be unmasked via a time-bound grant (subject to confidentiality_class) |
| `confidentiality_class` | `varchar(64)` | `'internal'` | NOT NULL | CHECK ∈ `{public, internal, sensitive, never_reveal, legal_hold, sealed_investigation, system_secret, unrelated_patient_context}`; the five hard-deny values are mutually exclusive with `break_glass_eligible=true` (validator G11.1) |

Index: `ix_pd_break_glass ON (collection_id, break_glass_eligible) WHERE break_glass_eligible = true`.

**`compliance.field_unmask_grants`** — time-bound grant rows.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `principal_user_id` | `uuid` | — | NOT NULL | FK → `identity.users(id)`; the user receiving the unmask |
| `collection_id` | `uuid` | — | NOT NULL | FK |
| `record_id` | `uuid` | — | NOT NULL | The specific record |
| `property_id` | `uuid` | — | NOT NULL | FK → `metadata.property_definitions(id)`; CHECK at insert that `property.break_glass_eligible = true` AND `property.confidentiality_class NOT IN (hard-deny enum)` |
| `granted_at` | `timestamptz` | `now()` | NOT NULL | — |
| `granted_until` | `timestamptz` | — | NOT NULL | Bounded duration (default 10 minutes; per-pack policy may extend up to 60 minutes) |
| `reason_code_id` | `uuid` | — | NOT NULL | FK → `compliance.reason_codes(id)`; reason_code's `applicable_signature_meanings` must include `'break_glass'` (new meaning) OR the platform-default `platform__break_glass_phi_access` row |
| `signature_chain_entry_id` | `uuid` | — | NOT NULL | UNIQUE; FK → `compliance.signature_chains(id)`; binds the grant to the §13.7 compliance chain |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |
| `revoked_at` | `timestamptz` | — | NULL | Set by auto-revoker OR manual revoke |
| `revocation_reason` | `varchar(64)` | — | NULL | `auto_expired` / `manual_revoke` / `principal_session_ended` / `compromise_response` |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

Indexes: PK; `ix_fug_active ON (principal_user_id, collection_id, record_id, property_id) WHERE revoked_at IS NULL AND granted_until > now()` — partial; this is the cache-bust target for `compliance:break_glass:grant:invalidate` events; `ix_fug_expiring ON (granted_until) WHERE revoked_at IS NULL` — for the auto-revoker sweep.

**§13.11 extends `compliance.reason_codes.applicable_signature_meanings` enum to include `'break_glass'`** (the signature meaning enum stays at 5 values; `break_glass` is an *applicable-meaning* tag distinct from the `signature_meaning` column on `electronic_signatures`). The signature row that authorizes a break-glass grant uses `signature_meaning='responsibility'` per the §13.7.5.1 matrix (so a fresh WebAuthn assertion is required), AND `reason_code.applicable_signature_meanings` must contain `'break_glass'`.

#### 13.11.2 Migrations

| # | Filename | Action |
|---|---|---|
| 1 | `1936000000000-add-property-confidentiality-columns.ts` | `ALTER TABLE metadata.property_definitions ADD COLUMN break_glass_eligible boolean NOT NULL DEFAULT false, ADD COLUMN confidentiality_class varchar(64) NOT NULL DEFAULT 'internal';` + CHECK + index via `createIndexConcurrent` |
| 2 | `1936000000001-create-field-unmask-grants.ts` | Table + indexes; CHECK that grants reference eligible non-hard-deny properties |
| 3 | `1936000000002-seed-break-glass-reason-codes.ts` | Seed `platform__break_glass_phi_access` (applicable meanings `['break_glass']`), `platform__break_glass_legal_request`, `platform__break_glass_incident_response` |

#### 13.11.3 Services

`apps/api/src/app/compliance/break-glass/` (new submodule under existing compliance module).

**`BreakGlassService`** — `apps/api/src/app/compliance/break-glass/break-glass.service.ts`:

```typescript
requestGrant(input: GrantRequest, ctx: UserRequestContext): Promise<GrantResult>;
revokeGrant(grantId: string, reason: string, ctx: UserRequestContext): Promise<void>;
listActiveGrants(filter: GrantFilter, ctx: UserRequestContext): Promise<FieldUnmaskGrant[]>;
```

`requestGrant(...)` flow:
1. Resolve target `property_definitions` row. Refuse with structured error `BREAK_GLASS_PROPERTY_INELIGIBLE` if `break_glass_eligible=false` OR `confidentiality_class ∈ {never_reveal, legal_hold, sealed_investigation, system_secret, unrelated_patient_context}`. **The hard-deny class check is the first thing checked** — even if a misconfigured grant somehow reaches insert, the property-level eligibility check at evaluator time still wins.
2. Validate authority — user must hold `compliance:break_glass:request` permission AND have READ access to the record (i.e., can SEE the masked-or-omitted field; break-glass unmasks what the user already has row-visibility for).
3. Require fresh WebAuthn re-auth (per §13.7.5.1 `responsibility` tier; per-call, not session); reuse `WebAuthnService.verifyAssertion`.
4. Validate `reason_code_id` is active AND its `applicable_signature_meanings` includes `'break_glass'`.
5. Compute `granted_until = now() + min(requested_duration, 60 minutes, pack_policy.max_break_glass_duration)`. Default 10 minutes; pack manifest may declare a tighter cap per purpose.
6. Inside `withAudit(...)`:
   - Insert `electronic_signatures` row with `signature_meaning='responsibility'` and `reason_code_id` (binds the action to canon §10 + §32).
   - Insert `field_unmask_grants` row referencing `signature_chains` from the previous step.
   - Emit `compliance:break_glass:grant:invalidate` event on the cache-invalidation bus (canon F025) so subsequent reads pick up the grant immediately.
7. Return `{ grantId, grantedUntil, signatureChainEntryId, auditLogId }`.

`revokeGrant(...)`:
- Manual revoke requires `compliance:break_glass:revoke` permission. Sets `revoked_at + revocation_reason='manual_revoke'`. Writes audit + emits cache-bust.
- A user revoking their own active grant (e.g., "I'm done; don't leave it sitting") is allowed via `compliance:break_glass:revoke_own` (less-privileged code).

**`BreakGlassRevokerService`** — worker side; `apps/worker/src/compliance/break-glass-revoker.service.ts`:
- Scheduled via SchedulingModule every 60 seconds.
- Query: `SELECT id FROM compliance.field_unmask_grants WHERE granted_until <= now() AND revoked_at IS NULL`.
- For each: set `revoked_at = now(), revocation_reason='auto_expired'`; write audit row; emit cache-bust event.
- Self-bound batch size 500 per tick (avoids long transactions).

**`AuthorizationService.evaluateFieldDecision`** — extended (existing service from canon §28):

The three-stage evaluator per §3.10 prose:

```typescript
function evaluateFieldDecision(ctx, property, record): FieldDecision {
  // Stage 1 — Hard-deny classes (overrides everything, including grants)
  if (HARD_DENY_CLASSES.has(property.confidentiality_class)) {
    return { effect: 'deny', matchedLevel: 0, matchedRuleId: 'hard_deny_class', ... };
  }
  // Stage 2 — Active grant short-circuits to UNMASK
  if (property.break_glass_eligible) {
    const grant = ctx.breakGlassGrantCache.get(`${record.id}:${property.id}`);
    if (grant && grant.granted_until > now() && !grant.revoked_at) {
      return { effect: 'allow', matchedLevel: 'break_glass_grant', matchedRuleId: grant.id, ... };
    }
  }
  // Stage 3 — Normal canon §28.5 7-level matrix
  return evaluateNormalFieldDecision(ctx, property, record);
}
```

The grant cache (`UserRequestContext.breakGlassGrantCache`) is request-scoped + populated lazily on first field decision involving an eligible property. Cache-bust events invalidate the entry. The evaluator's `granted_until > now()` check is the fail-safe — even if the auto-revoker is delayed, an expired grant CANNOT unmask because the evaluator sees the past `granted_until` and falls through to stage 3.

#### 13.11.4 API endpoints

| Method | Path | Boundary | Body / params |
|---|---|---|---|
| `POST` | `/api/compliance/break-glass/grants` | `@RequirePermission('compliance:break_glass:request')` | `{ collectionId, recordId, propertyId, reasonCodeId, requestedDurationSeconds, webauthnAssertion }` |
| `DELETE` | `/api/compliance/break-glass/grants/:id` | `@RequirePermission('compliance:break_glass:revoke')` OR `compliance:break_glass:revoke_own` (own grants only) | `{ reason }` |
| `GET` | `/api/compliance/break-glass/grants` | `@RequirePermission('compliance:break_glass:audit_read')` | query: `principalUserId?`, `collectionId?`, `recordId?`, `active?`, `from?`, `to?` — forensic query for Compliance Officer |
| `GET` | `/api/compliance/break-glass/properties` | `@RequirePermission('metadata:property:read')` | query: `collectionId?` — returns eligibility metadata for UI break-glass button rendering |

New permission codes:
- `compliance:break_glass:request`
- `compliance:break_glass:revoke` (revokes any grant; admin)
- `compliance:break_glass:revoke_own` (less-privileged)
- `compliance:break_glass:audit_read` (Compliance Officer forensic query)

#### 13.11.5 Validator extensions

Pack validator gains 3 publish gates:

1. **G11.1** — A property MUST NOT have BOTH `break_glass_eligible=true` AND `confidentiality_class ∈ hard-deny enum`. Error: `BREAK_GLASS_HARD_DENY_CONFLICT` (lists the offending property + its class).
2. **G11.2** — Pack manifest `break_glass.max_duration_seconds` MUST be ≤ 3600 (60 minutes platform cap). Error: `BREAK_GLASS_DURATION_CAP_EXCEEDED`.
3. **G11.3** — Every `reason_codes.applicable_signature_meanings[]` value MUST be a recognized meaning — the enum now includes `'break_glass'` alongside the §13.7.1 five. Error: `INVALID_SIGNATURE_MEANING_TAG` (extends §13.7.7 G7.3).

#### 13.11.6 Service-boundary scanner rules

| Entity | Allowed writers |
|---|---|
| `FieldUnmaskGrant` | `BreakGlassService.requestGrant`, `BreakGlassService.revokeGrant`, `BreakGlassRevokerService.sweep` |

Property column updates to `break_glass_eligible` / `confidentiality_class` go through the existing `PropertyDefinitionService` (already in the metadata-writers list).

#### 13.11.7 Tests (self-test ≥ 14 assertions)

1. **`break-glass-happy-path.spec.ts`** — request grant on eligible property; fresh WebAuthn assertion present; row created; signature chain extended; audit log row written; subsequent record-read returns the unmasked value within `granted_until`.
2. **`break-glass-hard-deny-class-refused.spec.ts`** — property classified `never_reveal`; request grant → `BREAK_GLASS_PROPERTY_INELIGIBLE`; no row created. Repeat for each of the 5 hard-deny classes.
3. **`break-glass-not-eligible.spec.ts`** — property with `break_glass_eligible=false` and `confidentiality_class='sensitive'`; request grant → `BREAK_GLASS_PROPERTY_INELIGIBLE`.
4. **`break-glass-no-row-visibility.spec.ts`** — user lacks row-level read access to record; request grant returns canon §28 minimal 403 (cannot break-glass a row you can't see).
5. **`break-glass-webauthn-required.spec.ts`** — request grant without fresh assertion → 401; with stale (> 60s) assertion → 401.
6. **`break-glass-duration-cap.spec.ts`** — request 3700 seconds; clamped to 3600 (platform cap); response includes `grantedUntil` reflecting clamp.
7. **`break-glass-pack-policy-cap.spec.ts`** — pack with `max_duration_seconds=600` overrides platform default; request 3000 → clamped to 600.
8. **`break-glass-auto-revoke.spec.ts`** — grant with `granted_until = now()+5s`; wait > 5s + scheduler tick; row has `revoked_at, revocation_reason='auto_expired'`; subsequent record read returns masked.
9. **`break-glass-evaluator-failsafe.spec.ts`** — grant expired but auto-revoker hasn't run yet (row's `revoked_at` still NULL); evaluator's `granted_until > now()` check returns `mask` (not unmask). The fail-safe holds without scheduler.
10. **`break-glass-manual-revoke.spec.ts`** — grant created; admin revokes; subsequent reads return masked even before `granted_until`.
11. **`break-glass-revoke-own.spec.ts`** — user with `revoke_own` revokes own grant; user without `revoke_own` cannot revoke someone else's grant.
12. **`break-glass-cache-bust.spec.ts`** — grant insertion emits `compliance:break_glass:grant:invalidate`; concurrent request's cache picks up new grant on next field decision (assert via 2-request sequence + cache hit/miss counter).
13. **`break-glass-forensic-query.spec.ts`** — Compliance Officer with `audit_read` permission queries all grants in date range; CSV export returns every grant including auto-revoke + manual-revoke entries.
14. **`break-glass-property-validator-conflict.spec.ts`** — pack declares property with `break_glass_eligible=true AND confidentiality_class='legal_hold'`; pack publish refused with G11.1 `BREAK_GLASS_HARD_DENY_CONFLICT`.

#### 13.11.8 PR breakdown for §3.10

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Property column migration + `confidentiality_class` enum + G11.1 validator + tests 2, 3, 14 | Migration 1; `metadata` entity area patch; pack-validator extension | Hard-deny classes refuse grant at validator AND at runtime; eligibility properly checked |
| 2 | `field_unmask_grants` table + `BreakGlassService.requestGrant/revokeGrant` + WebAuthn re-auth + signature chain integration + tests 1, 4, 5, 6, 7, 10, 11 | Migrations 2+3; entity area patch; `apps/api/src/app/compliance/break-glass/**`; permission registry additions; reason-code seeds | Grants written via withAudit + signature chain; WebAuthn enforced; duration capped; revoke paths work |
| 3 | `AuthorizationService.evaluateFieldDecision` three-stage extension + cache integration + tests 9, 12 | `libs/authorization/src/lib/authorization.service.ts` patch; cache-invalidation event wiring | Hard-deny first; grant short-circuit; fail-safe on expired-without-revoked grant; cache bust propagates |
| 4 | `BreakGlassRevokerService` worker + Compliance Officer forensic query endpoint + canon §28.10 amendment + tests 8, 13 | `apps/worker/src/compliance/break-glass-revoker.service.ts`; `apps/api/src/app/compliance/break-glass/audit.controller.ts`; CLAUDE.md amendment | Sweep auto-revokes expired grants; CSV export from forensic endpoint; canon §28.10 merged |

**Total: 4 PRs for §3.10. Estimated effort: ~7-9 working days.**

---

### 13.12 Worked example: §3.11 External-Collaborator Session Tokens (full artifact-level spec — kiosk + magic-link via canon §29.7 extensions)

#### 13.12.1 Tables

Two new tables in `schema: 'identity'` (adjacent to canon §29.5 refresh_tokens + canon §29.7 service_principals).

**`identity.kiosk_sessions`** — time-bound read-only device-bound sessions for auditors / regulators.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `code` | `varchar(64)` | — | NOT NULL | UNIQUE; public-facing kiosk code (high-entropy) |
| `purpose` | `varchar(64)` | — | NOT NULL | Pack-declared; e.g. `joint_commission_audit`, `fda_inspection`, `regulatory_observation` |
| `workspace_id` | `uuid` | — | NOT NULL | FK → `metadata.workspaces(id)`; the bound workspace is the ONLY surface the kiosk can read |
| `bound_device_fingerprint` | `bytea` | — | NOT NULL | 32 bytes; SHA-256 of `(user_agent || screen_dims || tz_offset || nonce)` captured at first bind; subsequent requests must present a matching fingerprint or the session is treated as compromised |
| `display_label` | `text` | — | NULL | UI-friendly label, e.g. "iPad - 5N Wing Audit 2026-05-17"; auditor-facing |
| `granted_by_user_id` | `uuid` | — | NOT NULL | FK → `identity.users(id)`; who handed the auditor the device |
| `granted_at` | `timestamptz` | `now()` | NOT NULL | — |
| `bound_at` | `timestamptz` | — | NULL | When the auditor's device first redeemed the code; NULL = code not yet bound |
| `expires_at` | `timestamptz` | — | NOT NULL | Hard expiry; default `granted_at + 24h`; pack policy may extend up to 7 days |
| `revoked_at` | `timestamptz` | — | NULL | One-tap revoke |
| `revoked_reason` | `varchar(64)` | — | NULL | `auditor_departed` / `compromise_response` / `auto_expired` / `granted_by_revoke` |
| `signing_kid` | `varchar(64)` | — | NOT NULL | Per canon §29.2; per-purpose kid namespace (`kiosk:<purpose>`) |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |

Indexes: PK; UNIQUE `(code)`; `ix_ks_active ON (workspace_id) WHERE revoked_at IS NULL AND expires_at > now()`; `ix_ks_expiring ON (expires_at) WHERE revoked_at IS NULL`.

**`identity.collaborator_invitations`** — single-use magic-link invitations for external contractors.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `code` | `varchar(64)` | — | NOT NULL | UNIQUE; the magic-link path component |
| `email` | `text` | — | NULL | Required when `delivery_method='email'` |
| `phone` | `varchar(32)` | — | NULL | Required when `delivery_method='sms'` |
| `delivery_method` | `varchar(16)` | — | NOT NULL | CHECK ∈ `{email, sms}` |
| `scope_collection_id` | `uuid` | — | NOT NULL | The collection containing the scoped record |
| `scope_record_id` | `uuid` | — | NOT NULL | The single record the collaborator can interact with |
| `permitted_actions` | `varchar(64)[]` | `'{}'::varchar[]` | NOT NULL | Subset of `{view, attach_photo, attach_document, add_note, sign_closeout}` |
| `granted_by_user_id` | `uuid` | — | NOT NULL | FK |
| `granted_at` | `timestamptz` | `now()` | NOT NULL | — |
| `expires_at` | `timestamptz` | — | NOT NULL | Default `granted_at + 14 days` |
| `consumed_at` | `timestamptz` | — | NULL | Set on first redemption; subsequent attempts return 410 |
| `consumed_session_token_hash` | `bytea` | — | NULL | 32 bytes; SHA-256 of the resulting session JWT for forensic linking |
| `revoked_at` | `timestamptz` | — | NULL | One-tap revoke |
| `revoked_reason` | `varchar(64)` | — | NULL | — |
| `signing_kid` | `varchar(64)` | — | NOT NULL | Per canon §29.2; per-purpose kid namespace (`collaborator:<purpose>`) |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |

Indexes: PK; UNIQUE `(code)`; `ix_ci_consumable ON (code) WHERE consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()`; `ix_ci_scope ON (scope_collection_id, scope_record_id)`.

#### 13.12.2 Migrations

| # | Filename | Action |
|---|---|---|
| 1 | `1937000000000-create-kiosk-sessions.ts` | Table + indexes |
| 2 | `1937000000001-create-collaborator-invitations.ts` | Table + indexes |
| 3 | `1937000000002-seed-kiosk-collaborator-kids.ts` | Bootstrap KMS aliases `kiosk:joint_commission_audit`, `kiosk:fda_inspection`, `collaborator:contractor_signoff` in `identity.key_metadata` (canon §29.2) — one row per supported purpose namespace |

#### 13.12.3 Services

`apps/api/src/app/identity/external/` (new submodule under existing identity module).

**`KioskSessionService`** — `apps/api/src/app/identity/external/kiosk-session.service.ts`:

```typescript
issue(input: IssueKioskRequest, ctx: UserRequestContext): Promise<KioskCode>;
bind(code: string, deviceFingerprint: Buffer): Promise<KioskJwt>;
revoke(id: string, reason: string, ctx: UserRequestContext): Promise<void>;
list(filter: KioskFilter, ctx: UserRequestContext): Promise<KioskSession[]>;
```

`issue(...)`:
1. Authority check: `identity:kiosk:issue` permission.
2. Validate `workspace_id` exists and is readable by the issuer.
3. Compute `expires_at = min(requested_duration, 7 days, pack_policy.max_kiosk_duration)`.
4. Insert `kiosk_sessions` row via `withAudit`; return the generated `code` (high-entropy 32-byte random, base32 of length 64).

`bind(...)`:
- Public endpoint (`@Public()`). Called by the auditor's device on first scan.
- Validates row not expired, not revoked, not yet bound. Single-bind enforced via row-update `WHERE bound_at IS NULL` predicate; concurrent bind attempts → 410 for all but the winner.
- Computes `bound_device_fingerprint` from the request's user-agent + screen dims + tz-offset + a server-generated nonce returned to the client.
- Stamps `bound_at`; mints a KMS-signed JWT (ES256, per canon §29.1) with claims:
  - `aud='kiosk'`
  - `sub='kiosk:<sessionId>'`
  - `instance_id`, `session_id=row.id`, `kid` from `signing_kid`
  - `permitted_actions=['read']`
  - `workspace_id`, `device_fp_hash` (truncated 12-hex-char prefix of fingerprint for in-token verification)
  - `exp = row.expires_at`, fresh `iat`
- Returns `{ jwt, expiresAt }` to the device. The JWT never carries `userId`.

`revoke(...)`:
- Sets `revoked_at + revoked_reason`. The `JwtAuthGuard` rejects subsequent calls because the kiosk session lookup (added below) fails the `revoked_at IS NULL AND expires_at > now()` predicate.

**`JwtAuthGuard`** — gains a `kind: 'kiosk'` branch alongside the existing `user` / `service` branches (canon §29.7 discriminated union):

```typescript
if (decoded.aud === 'kiosk') {
  const session = await kioskSessionRepo.findActive(decoded.session_id);
  if (!session) throw 401;
  // Device fingerprint binding check
  const presentedFp = computeFingerprint(req);
  if (presentedFp.toString('hex').slice(0, 12) !== decoded.device_fp_hash) throw 401;
  req.context = { kind: 'kiosk', sessionId, workspaceId, ... };
}
```

A new helper `assertKioskContext(ctx)` narrows for consumers. The §28 evaluator hard-rejects any write op when `ctx.kind === 'kiosk'` regardless of role — kiosks are read-only by construction, not by policy.

**`CollaboratorInvitationService`** — `apps/api/src/app/identity/external/collaborator-invitation.service.ts`:

```typescript
issue(input: IssueCollaboratorRequest, ctx: UserRequestContext): Promise<CollaboratorCode>;
redeem(code: string, deviceFingerprint?: Buffer): Promise<CollaboratorJwt>;
revoke(id: string, reason: string, ctx: UserRequestContext): Promise<void>;
```

`issue(...)`: similar to kiosk but for a specific record. Triggers delivery via `NotificationService.deliver({ method, recipient, template: 'collaborator_invitation', payload: { link, expiresAt }})`. Delivery webhook URL is the customer's outbound notifications channel.

`redeem(...)`: single-use; flips `consumed_at` atomically (UPDATE...WHERE consumed_at IS NULL); on win, mints a JWT with `aud='collaborator'`, `permitted_actions=row.permitted_actions`, `scope.collectionId / recordId`, `exp = min(invitation.expires_at, now() + 4h)` (collaborator sessions don't last as long as the invitation window — once redeemed, the working session is bounded to 4 hours).

`JwtAuthGuard` gains a `kind: 'collaborator'` branch:

```typescript
if (decoded.aud === 'collaborator') {
  const inv = await invRepo.findById(decoded.invitation_id);
  if (!inv || inv.revoked_at) throw 401;
  req.context = { kind: 'collaborator', invitationId, scopeCollectionId, scopeRecordId, permittedActions, ... };
}
```

The §28 evaluator: a collaborator context can READ + UPDATE only the bound record AND only fields whose property has `collaborator_writable=true` (proposed new boolean column on `property_definitions` — flagged as founder-correctable below); attempts outside scope → 403 minimal shape.

#### 13.12.4 API endpoints

| Method | Path | Boundary | Body / params |
|---|---|---|---|
| `POST` | `/api/identity/kiosk-sessions` | `@RequirePermission('identity:kiosk:issue')` | `{ purpose, workspaceId, displayLabel?, requestedDurationSeconds? }` |
| `POST` | `/api/public/kiosk/:code/bind` | `@Public()` | `{ userAgent, screenDims, tzOffset }` returns `{ jwt, expiresAt }` |
| `DELETE` | `/api/identity/kiosk-sessions/:id` | `@RequirePermission('identity:kiosk:revoke')` | `{ reason }` |
| `GET` | `/api/identity/kiosk-sessions` | `@RequirePermission('identity:kiosk:audit_read')` | query: `workspaceId?`, `active?`, `from?`, `to?` |
| `POST` | `/api/identity/collaborator-invitations` | `@RequirePermission('identity:collaborator:issue')` | `{ scopeCollectionId, scopeRecordId, permittedActions, deliveryMethod, recipientEmail?, recipientPhone? }` |
| `POST` | `/api/public/collaborator/:code/redeem` | `@Public()` | `{}` returns `{ jwt, expiresAt }` |
| `DELETE` | `/api/identity/collaborator-invitations/:id` | `@RequirePermission('identity:collaborator:revoke')` | `{ reason }` |

New permission codes (registered in `PERMISSION_REGISTRY`):
- `identity:kiosk:issue`, `identity:kiosk:revoke`, `identity:kiosk:audit_read`
- `identity:collaborator:issue`, `identity:collaborator:revoke`

PUBLIC_ALLOWLIST entries added for the two `/api/public/` bind/redeem endpoints.

#### 13.12.5 Validator extensions

Pack validator gains 3 publish gates:

1. **G12.1** — Pack `kiosk_sessions.purposes[]` MUST declare a `purpose` value AND a `signing_kid_namespace` matching the `kiosk:<purpose>` pattern. Error: `INVALID_KIOSK_PURPOSE_DECLARATION`.
2. **G12.2** — Pack `collaborator_invitations.permitted_actions[]` MUST be a subset of `{view, attach_photo, attach_document, add_note, sign_closeout}`. Error: `INVALID_COLLABORATOR_ACTION`.
3. **G12.3** — When `collaborator_invitations.permitted_actions` includes `sign_closeout`, the bound collection MUST have at least one reason_code seeded by THIS pack with `applicable_signature_meanings ∋ 'closure'`. Error: `COLLABORATOR_CLOSEOUT_MISSING_REASON_CODE`.

#### 13.12.6 Service-boundary scanner rules

| Entity | Allowed writers |
|---|---|
| `KioskSession` | `KioskSessionService.*` |
| `CollaboratorInvitation` | `CollaboratorInvitationService.*` |

Adds branches to `JwtAuthGuard` for `kiosk` + `collaborator` audiences; the no-untyped-req scanner (canon §29.6) requires new helpers `assertKioskContext` / `assertCollaboratorContext`.

#### 13.12.7 Tests (self-test ≥ 14 assertions)

1. **`kiosk-issue-and-bind.spec.ts`** — issue code; bind from device A; JWT minted with correct claims; second-device bind on same code → 410.
2. **`kiosk-fingerprint-tampering.spec.ts`** — bind device A; replay JWT with mismatched user-agent → 401.
3. **`kiosk-expired-bind.spec.ts`** — issue code with `expires_at = past`; bind → 410.
4. **`kiosk-readonly-enforced.spec.ts`** — kiosk JWT attempting POST to any data endpoint → §28 evaluator rejects with canon §28 minimal 403; AccessAuditPort.logAccessDenied row written.
5. **`kiosk-workspace-bound.spec.ts`** — kiosk bound to workspace W1; attempts to read from workspace W2 → 403.
6. **`kiosk-revoke.spec.ts`** — issue + bind + revoke; subsequent JWT presentation → 401.
7. **`kiosk-auto-expire.spec.ts`** — bound kiosk past `expires_at`; JWT verification fails on `exp` check; AND the JwtAuthGuard's session lookup also fails (defense-in-depth — even if `exp` was tampered, the DB row's expiry is checked).
8. **`collaborator-issue-deliver.spec.ts`** — issue invitation with `delivery_method='email'`; `NotificationService.deliver` called with the magic-link URL.
9. **`collaborator-redeem-once.spec.ts`** — redeem succeeds + mints JWT; second redeem → 410.
10. **`collaborator-scope-bound.spec.ts`** — JWT scoped to record R1; attempts to read R2 in same collection → 403.
11. **`collaborator-action-bound.spec.ts`** — invitation with `permitted_actions=['view', 'attach_photo']`; attempt `add_note` → 403; attempt `view` + `attach_photo` → succeeds.
12. **`collaborator-sign-closeout.spec.ts`** — invitation with `sign_closeout`; collaborator signs; `electronic_signatures` row written with `signer_user_id` resolved to a system-generated collaborator-principal user (canon §29.7 service-principal-style binding); chain extended.
13. **`collaborator-validator-closeout-without-reason.spec.ts`** — pack declares `permitted_actions ∋ sign_closeout` but no reason_code; publish refused with G12.3.
14. **`external-session-context-narrowing.spec.ts`** — controller uses `req.context` directly without `assertKioskContext` or `assertCollaboratorContext` → no-untyped-req scanner fails CI.

#### 13.12.8 PR breakdown for §3.11

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Migrations + entities + `KioskSessionService.issue/bind/revoke` + JwtAuthGuard `kiosk` branch + tests 1, 2, 3, 6, 7 | Migrations 1+3; entity area patches; `apps/api/src/app/identity/external/kiosk-*`; `libs/auth-guard` extension; `assertKioskContext` helper | Issue + bind + revoke + auto-expire + fingerprint tamper detection all work |
| 2 | Kiosk read-only enforcement at §28 evaluator + workspace binding + tests 4, 5, 14 | `libs/authorization/src/lib/authorization.service.ts` patch; no-untyped-req scanner extension | Kiosk writes ALWAYS rejected; workspace boundary enforced; helper narrowing required |
| 3 | `CollaboratorInvitationService.issue/redeem/revoke` + JwtAuthGuard `collaborator` branch + NotificationService wire + tests 8, 9, 10, 11 | Migration 2; `apps/api/src/app/identity/external/collaborator-*`; `assertCollaboratorContext` helper; canon §29 amendment to CLAUDE.md | Single-use redemption; scope binding; action subsetting; delivery hooks fire |
| 4 | Collaborator sign-closeout integration with §13.7 SignatureService + G12.1-G12.3 validator + tests 12, 13 + canon §29 amendment | Pack-validator extension; SignatureService special path for collaborator principals; CLAUDE.md amendment | Closeout signatures land with proper signer identity; validator gates publish; canon merged |
| 5 | Audit forensic endpoint for kiosk/collaborator history + Compliance Officer view + monitoring | `apps/api/src/app/identity/external/audit.controller.ts`; alerting on rapid-fire issuance patterns | CSV export from forensic endpoint; rapid-issuance pattern emits RuntimeAnomaly |

**Total: 5 PRs for §3.11. Estimated effort: ~10-12 working days.**

---

### 13.13 Worked example: §3.12 Storage & Evidence Attachment Runtime (full artifact-level spec — generic pre-signed upload + AV/secret/PII scan + object-lock + retention)

#### 13.13.1 Tables

Two new tables in `schema: 'storage'` (NEW schema). Shared substrate consumed by §3.6 evidence_artifacts, §3.9 intake attachments, and every pack that handles file uploads.

**`storage.attachment_uploads`** — one row per upload request.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `purpose` | `varchar(64)` | — | NOT NULL | E.g. `loto_photo`, `evidence_attachment`, `contractor_upload`, `nameplate_photo`, `asset_pin_voice_note`, `invoice_pdf`, `intake_attachment` |
| `scope_collection_id` | `uuid` | — | NULL | When non-NULL, the upload is bound to a specific collection's record |
| `scope_record_id` | `uuid` | — | NULL | The record the upload eventually links to |
| `requested_by_user_id` | `uuid` | — | NULL | NULL when issued by a system principal (e.g. intake submission); FK otherwise |
| `requested_by_principal_kind` | `varchar(16)` | — | NOT NULL | CHECK ∈ `{user, intake, collaborator, service}` |
| `presigned_url` | `text` | — | NOT NULL | Returned to client; S3 PUT URL; signed with 15-minute expiry |
| `presigned_url_expires_at` | `timestamptz` | — | NOT NULL | — |
| `expected_size_bytes` | `bigint` | — | NULL | Hint from client (validation only) |
| `actual_size_bytes` | `bigint` | — | NULL | Filled by ingest worker post-upload |
| `content_type` | `varchar(128)` | — | NOT NULL | Declared by client; ingest worker verifies via magic-byte sniffing |
| `actual_content_type` | `varchar(128)` | — | NULL | Detected post-upload; mismatch → `quarantined` |
| `content_hash_sha256` | `bytea` | — | NULL | 32 bytes; computed by ingest worker |
| `s3_object_key` | `text` | — | NOT NULL | `instance/{instance_id}/storage/{purpose}/{yyyy/mm/dd}/{id}` |
| `s3_bucket` | `varchar(120)` | — | NOT NULL | Per-instance bucket name |
| `s3_version_id` | `text` | — | NULL | Filled post-upload from S3 response |
| `s3_object_lock_mode` | `varchar(16)` | `'COMPLIANCE'` | NOT NULL | CHECK ∈ `{COMPLIANCE, GOVERNANCE}` per §13.7 founder-locked default |
| `retention_until` | `timestamptz` | — | NULL | Filled by `link-on-clean` worker based on purpose's retention class |
| `legal_hold` | `boolean` | `false` | NOT NULL | — |
| `status` | `varchar(16)` | `'presigned'` | NOT NULL | CHECK ∈ `{presigned, uploaded, scanning, quarantined, clean, linked, expired}` |
| `quarantine_reason` | `varchar(120)` | — | NULL | Filled on `status='quarantined'` |
| `linked_artifact_table` | `varchar(64)` | — | NULL | E.g. `compliance.evidence_artifacts`, `intake.public_intake_attachments`; the table the linked-on-clean row was written to |
| `linked_artifact_id` | `uuid` | — | NULL | FK to the linked artifact's row in `linked_artifact_table` |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `uploaded_at` | `timestamptz` | — | NULL | Stamped by ingest worker |
| `linked_at` | `timestamptz` | — | NULL | Stamped by `link-on-clean` worker |

Indexes: PK; `ix_au_status ON (status, created_at) WHERE status IN ('presigned', 'uploaded', 'scanning', 'quarantined')`; `ix_au_scope ON (scope_collection_id, scope_record_id) WHERE status = 'linked'`; UNIQUE `(s3_bucket, s3_object_key)`; `ix_au_purpose ON (purpose, created_at DESC)`.

**`storage.attachment_scan_results`** — per-scan-pass result rows.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `attachment_upload_id` | `uuid` | — | NOT NULL | FK → `attachment_uploads(id)` |
| `scan_kind` | `varchar(16)` | — | NOT NULL | CHECK ∈ `{av, secret, pii, content_type}` |
| `scanner_name` | `varchar(64)` | — | NOT NULL | E.g. `clamav-0.103`, `gitleaks-8.18`, `presidio-2.2`, `magic-byte-libmagic-5.45` |
| `scanner_version` | `varchar(32)` | — | NOT NULL | — |
| `verdict` | `varchar(16)` | — | NOT NULL | CHECK ∈ `{clean, suspicious, dirty, error}` |
| `details` | `jsonb` | `'{}'::jsonb` | NOT NULL | Scanner-specific findings (e.g., signature names, secret token kinds, PII categories) |
| `started_at` | `timestamptz` | — | NOT NULL | — |
| `finished_at` | `timestamptz` | — | NOT NULL | — |
| `error_message` | `text` | — | NULL | Populated when `verdict='error'` |

Indexes: PK; `ix_asr_upload ON (attachment_upload_id, scan_kind)`; `ix_asr_dirty ON (verdict) WHERE verdict IN ('suspicious', 'dirty')`.

#### 13.13.2 Migrations

| # | Filename | Action |
|---|---|---|
| 1 | `1938000000000-create-storage-schema.ts` | `CREATE SCHEMA storage;` |
| 2 | `1938000000001-create-attachment-uploads.ts` | Table + indexes |
| 3 | `1938000000002-create-attachment-scan-results.ts` | Table + indexes |

#### 13.13.3 Services

`apps/api/src/app/storage/` (new API module) + `apps/worker/src/storage/` (new worker module).

**`StoragePresignService`** — `apps/api/src/app/storage/presign.service.ts`:

```typescript
requestUpload(input: PresignRequest, ctx: RequestContext): Promise<PresignResult>;
```

`PresignRequest` carries `{ purpose, scopeCollectionId?, scopeRecordId?, expectedSizeBytes?, contentType }`. Flow:
1. Resolve purpose policy from a config registry (purpose-to-(retention_class, max_size_bytes, allowed_content_types) mapping declared by packs).
2. Validate `expectedSizeBytes ≤ purpose.max_size_bytes` and `contentType ∈ purpose.allowed_content_types`.
3. Authorization: callers must hold `storage:upload:request` permission OR be one of the trusted principal kinds (intake processor, collaborator session). The request_context's `kind` drives this check.
4. Generate `s3_object_key`, mint a 15-minute presigned PUT URL via S3 SDK, write `attachment_uploads` row via `withAudit` with `status='presigned'`.
5. Return `{ uploadId, presignedUrl, expiresAt, objectKey }`.

**`AttachmentIngestProcessor`** — worker side; triggered by S3 event notification (`s3:ObjectCreated:Put`):
1. Look up `attachment_uploads` row by `s3_object_key`; if not found OR `status != 'presigned'` → emit RuntimeAnomaly (`storage_ingest_unexpected_object`) and quarantine.
2. Verify `actual_size_bytes ≤ purpose.max_size_bytes`; mismatch → `quarantined`.
3. Sniff magic bytes; if `actual_content_type` mismatches declared → `quarantined`.
4. Compute SHA-256 → `content_hash_sha256`.
5. Set `status='scanning'`, `uploaded_at=now()`. Enqueue per-scanner jobs.

**`AvScanProcessor`** — ClamAV (or pluggable); writes `attachment_scan_results` row with `scan_kind='av'`.
**`SecretScanProcessor`** — gitleaks-rules-based; writes row with `scan_kind='secret'`.
**`PiiScanProcessor`** — Presidio or equivalent; writes row with `scan_kind='pii'`.

Each scanner's verdict feeds into a state-machine check:
- ALL `verdict='clean'` → `status='clean'`; trigger link-on-clean.
- ANY `verdict='dirty'` → `status='quarantined'`; `quarantine_reason=<details>`; emit RuntimeAnomaly.
- ANY `verdict='suspicious'` → quarantine + emit RuntimeAnomaly; secret/PII findings always treated as quarantine (deliberately strict).
- ANY `verdict='error'` AND no other dirty → retry the failed scan once; second error → quarantine with reason `scan_error_retry_exhausted`.

**`LinkOnCleanProcessor`** — runs when ALL configured scans for the purpose return `clean`:
1. Compute `retention_until` from `purpose.retention_class` (uses the §13.7 classes — `part_11_clinical`, `osha`, etc.).
2. Apply S3 `PutObjectRetention` with `ObjectLockRetainUntilDate=retention_until` and `Mode='COMPLIANCE'` (per §3.6 founder default).
3. Resolve `purpose.link_target` and INSERT the artifact row into the target table (`compliance.evidence_artifacts` for evidence purposes; `intake.public_intake_attachments` already exists from §13.10 — the link-on-clean stamps `scan_status='clean'` rather than inserting a new row).
4. Update `attachment_uploads` row: `status='linked'`, `linked_artifact_table`, `linked_artifact_id`, `linked_at`.

**`ExpiredPresignSweeper`** — worker; scheduled every 5 minutes:
- Finds rows where `status='presigned'` AND `presigned_url_expires_at < now() - INTERVAL '1 hour'`. Marks them `status='expired'` so they don't accumulate.

#### 13.13.4 API endpoints

| Method | Path | Boundary | Body / params |
|---|---|---|---|
| `POST` | `/api/storage/uploads` | `@AuthenticatedOnly()` (per-purpose authorization inside service) | `{ purpose, scopeCollectionId?, scopeRecordId?, expectedSizeBytes?, contentType }` returns `{ uploadId, presignedUrl, expiresAt }` |
| `GET` | `/api/storage/uploads/:id` | `@RequirePermission('storage:upload:read')` | — returns status + scan results |
| `GET` | `/api/storage/uploads/:id/download-url` | `@RequireCollectionAccess('read')` (resolved via `scope_collection_id`/`scope_record_id`) | — returns a 60-second signed GET URL when `status='linked'` |

New permission code: `storage:upload:read`. The `requestUpload` controller is `@AuthenticatedOnly()` because purpose-specific authorization is too dynamic for a single boundary decorator — the service computes it from purpose policy + principal kind.

#### 13.13.5 Validator extensions

Pack validator gains 3 publish gates:

1. **G13.1** — Pack `storage.purposes[]` MUST declare `(name, retention_class, max_size_bytes, allowed_content_types[], link_target_table)`. Error: `MISSING_STORAGE_PURPOSE_DECLARATION`.
2. **G13.2** — `retention_class` MUST be in the §13.7 canonical enum. Error: `INVALID_RETENTION_CLASS`.
3. **G13.3** — `link_target_table` MUST be one of the registered receivers: `compliance.evidence_artifacts`, `intake.public_intake_attachments`, or a pack-declared table whose schema includes the required columns (sha256, content_type, size_bytes, s3_object_version_id). Error: `INVALID_LINK_TARGET`.

#### 13.13.6 Service-boundary scanner rules

| Entity | Allowed writers |
|---|---|
| `AttachmentUpload` | `StoragePresignService.requestUpload`, `AttachmentIngestProcessor.process`, `LinkOnCleanProcessor.link`, `ExpiredPresignSweeper.sweep` |
| `AttachmentScanResult` | `AvScanProcessor`, `SecretScanProcessor`, `PiiScanProcessor`, `AttachmentIngestProcessor` (for content_type results) |

Pack consumers MUST call `StoragePresignService.requestUpload(...)` for uploads; direct `storage.*` writes from packs fail the scanner.

#### 13.13.7 Tests (self-test ≥ 12 assertions)

1. **`storage-presign-happy-path.spec.ts`** — request upload; receive presigned URL; PUT to LocalStack S3; ingest worker fires; SHA-256 computed; scans clean; link-on-clean inserts into `compliance.evidence_artifacts`; status `linked`.
2. **`storage-presign-expired-url.spec.ts`** — wait 16 minutes; attempt PUT → S3 rejects; ExpiredPresignSweeper marks row `expired`.
3. **`storage-size-cap.spec.ts`** — request 30MB upload for a purpose with `max_size_bytes=25MB` → `BAD_REQUEST` at presign; PUT of oversize file rejected by ingest worker → `quarantined`.
4. **`storage-content-type-mismatch.spec.ts`** — declare `application/pdf`; upload a PNG; magic-byte sniff detects mismatch; `quarantined` with reason `content_type_mismatch`.
5. **`storage-av-dirty.spec.ts`** — ClamAV verdict `dirty`; row `quarantined`; RuntimeAnomaly emitted.
6. **`storage-secret-dirty.spec.ts`** — upload contains an AWS access key string; secret scanner flags; `quarantined`; RuntimeAnomaly.
7. **`storage-pii-suspicious.spec.ts`** — upload contains PII (SSN-shaped); Presidio flags `suspicious`; `quarantined` (suspicious is treated as quarantine).
8. **`storage-scan-error-retry.spec.ts`** — AV scanner crashes once; scan retried; second attempt clean; row proceeds to `linked`.
9. **`storage-scan-error-exhausted.spec.ts`** — AV scanner crashes twice; row `quarantined` with reason `scan_error_retry_exhausted`.
10. **`storage-link-on-clean-target-routing.spec.ts`** — purpose `intake_attachment` routes to `intake.public_intake_attachments`; purpose `evidence_attachment` routes to `compliance.evidence_artifacts`. Mistaken target → G13.3 validator refusal at pack-publish time.
11. **`storage-download-authz.spec.ts`** — linked artifact; user without `@RequireCollectionAccess('read')` on the scope record → 403; with access → 60s signed URL.
12. **`storage-service-boundary-scanner.spec.ts`** — adding a `attachmentUploadsRepo.save()` call from outside the allowed-writers list fails the scanner.

#### 13.13.8 PR breakdown for §3.12

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Schema + tables + entities + `StoragePresignService` + presign endpoint + tests 1 (partial), 3 | Migrations 1-3; entity area patch; `apps/api/src/app/storage/**`; validator G13.1-G13.3 | Presign URL returned; row written; size cap enforced; validator gates pack declarations |
| 2 | `AttachmentIngestProcessor` + content-type sniff + SHA-256 + `ExpiredPresignSweeper` + tests 2, 4 | `apps/worker/src/storage/ingest.processor.ts`; SchedulingModule wire | Ingest stamps actual values; mismatch quarantines; expired sweep runs |
| 3 | AV + secret + PII scanners + state machine + tests 5, 6, 7 | `apps/worker/src/storage/av-scan.processor.ts` + `secret-scan.processor.ts` + `pii-scan.processor.ts`; ClamAV deployment manifest | All dirty/suspicious paths quarantine + emit RuntimeAnomaly |
| 4 | Scan retry semantics + tests 8, 9 | State-machine extension; scan-error retry counter | Single-error retried; double-error quarantined |
| 5 | `LinkOnCleanProcessor` + retention_until computation + COMPLIANCE Object Lock + link target routing + tests 1 (full), 10, 11 | `apps/worker/src/storage/link-on-clean.processor.ts`; S3 PutObjectRetention; download endpoint | Clean uploads land in correct target table; COMPLIANCE applied; signed download URL works |
| 6 | Canon §38 amendment + service-boundary scanner extension + ExpiredPresignSweeper + test 12 | CLAUDE.md amendment; `tools/service-boundary-check.ts` updates | Scanner blocks external writes; canon merged |

**Total: 6 PRs for §3.12. Estimated effort: ~10-13 working days.**

---

### 13.14 Worked example: §3.13 Connector Runtime + Certified Simulators (full artifact-level spec — IntegrationAdapter SDK + fixture-replay conformance)

#### 13.14.1 Tables

Two new tables in `schema: 'integrations'` (NEW schema).

**`integrations.integration_adapter_registry`** — per-instance enabled adapters.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `adapter_id` | `varchar(120)` | — | NOT NULL | UNIQUE per `(instance_id)`; canonical adapter identifier (e.g. `hl7v2`, `bacnet`, `obd2-telematics`, `nac-quarantine`) |
| `adapter_version` | `varchar(32)` | — | NOT NULL | Semver; the registered build |
| `mode` | `varchar(16)` | — | NOT NULL | CHECK ∈ `{live, simulator}`; live = real integration; simulator = certified simulator stub |
| `config_handle` | `text` | — | NOT NULL | Opaque reference into `integrations.integration_secret` (§3.18); never the secret value |
| `conformance_declaration` | `jsonb` | — | NOT NULL | `{ operations: [{op_id, version}], fixture_set_id, hash_of_fixtures }` |
| `last_health_check_at` | `timestamptz` | — | NULL | Stamped by `AdapterHealthCheckProcessor` |
| `last_health_check_verdict` | `varchar(16)` | — | NULL | `ok` / `degraded` / `down` |
| `enabled` | `boolean` | `true` | NOT NULL | Operator can disable without uninstalling |
| `installed_at` | `timestamptz` | `now()` | NOT NULL | — |
| `installed_by_user_id` | `uuid` | — | NOT NULL | FK |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |

Indexes: PK; UNIQUE `(instance_id, adapter_id)`; `ix_iar_health ON (last_health_check_verdict, last_health_check_at) WHERE enabled = true`.

**`integrations.adapter_conformance_records`** — per-replay run pass/fail history.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `adapter_registry_id` | `uuid` | — | NOT NULL | FK → `integration_adapter_registry(id)` |
| `fixture_set_id` | `varchar(120)` | — | NOT NULL | E.g. `hl7v2-adt-fixtures-v3`; canonical fixture bundle identifier |
| `fixture_count` | `int` | — | NOT NULL | Number of fixtures in the bundle |
| `passed_count` | `int` | — | NOT NULL | — |
| `failed_count` | `int` | — | NOT NULL | — |
| `results` | `jsonb` | — | NOT NULL | Per-fixture: `[{fixture_id, op_id, expected_hash, actual_hash, verdict}]` |
| `replay_started_at` | `timestamptz` | — | NOT NULL | — |
| `replay_finished_at` | `timestamptz` | — | NOT NULL | — |
| `gate_acceptance_run` | `boolean` | `false` | NOT NULL | `true` when this replay was the gate-acceptance proof for a deploy/upgrade (immutable evidence) |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |

Indexes: PK; `ix_acr_adapter ON (adapter_registry_id, replay_finished_at DESC)`; `ix_acr_gate ON (gate_acceptance_run, replay_finished_at DESC) WHERE gate_acceptance_run = true`.

#### 13.14.2 Migrations

| # | Filename | Action |
|---|---|---|
| 1 | `1939000000000-create-integrations-schema.ts` | `CREATE SCHEMA integrations;` |
| 2 | `1939000000001-create-integration-adapter-registry.ts` | Table + indexes |
| 3 | `1939000000002-create-adapter-conformance-records.ts` | Table + indexes |

#### 13.14.3 Adapter SDK contract

`libs/integration-adapter-sdk` (new package) exports:

```typescript
export interface IntegrationAdapter<TConfig, TPayload, TResult> {
  readonly adapterId: string;            // e.g. 'hl7v2'
  readonly adapterVersion: string;       // semver
  readonly mode: 'live' | 'simulator';
  readonly conformance: ConformanceDeclaration;

  init(secretHandle: string, config: TConfig): Promise<void>;
  healthCheck(): Promise<{ verdict: 'ok' | 'degraded' | 'down'; details?: Record<string, unknown> }>;
  executeOperation(opId: string, payload: TPayload): Promise<TResult>;
  shutdown(): Promise<void>;
}

export interface ConformanceDeclaration {
  fixtureSetId: string;
  operations: Array<{ opId: string; version: string }>;
  fixturesPath: string;  // relative to adapter package root
}
```

Every adapter ships in **two flavors**: a `<adapterId>-live` and `<adapterId>-simulator` package; both implement the same interface. The simulator's `conformance.fixtureSetId` declares which fixture bundle it conforms to.

Fixture bundle format: `<adapter>/fixtures/<fixtureSetId>/<opId>/{request.json,expected_response.json}`. Bundle hash (SHA-256 of canonical bytes) stored in `conformance_declaration.hash_of_fixtures` so drift is detectable.

#### 13.14.4 Services

`apps/api/src/app/integrations/` (new module) + `apps/worker/src/integrations/` (new module).

**`AdapterRegistryService`** — `apps/api/src/app/integrations/adapter-registry.service.ts`:

```typescript
register(input: RegisterAdapterRequest, ctx: UserRequestContext): Promise<AdapterRegistry>;
setMode(adapterId: string, mode: 'live' | 'simulator', ctx: UserRequestContext): Promise<void>;
enable(adapterId: string, ctx: UserRequestContext): Promise<void>;
disable(adapterId: string, reason: string, ctx: UserRequestContext): Promise<void>;
list(filter: RegistryFilter, ctx: UserRequestContext): Promise<AdapterRegistry[]>;
```

`register(...)` flow:
1. Authority: `integrations:adapter:install` permission (admin / Compliance Officer).
2. Validate the requested `(adapterId, adapterVersion, mode)` matches a package available in the deployment's adapter manifest (a build-time-frozen list of supported adapters per release).
3. Run an immediate conformance replay (PR-2 acceptance) — refuse registration if `failed_count > 0`.
4. Initialize adapter via `adapter.init(secretHandle, config)`; refuse with structured error if `init` throws.
5. Insert `integration_adapter_registry` row via `withAudit`; first health check fires immediately.

`setMode(...)` switches an adapter between live and simulator. Switching is a significant operational event — emits high-severity audit row + page-on-call notification.

**`ConformanceReplayService`** — runs the fixture replay loop:
```typescript
replay(adapterRegistryId: string, gateAcceptance: boolean, ctx: RequestContext): Promise<ConformanceRecord>;
```
1. Loads fixtures from `adapter.conformance.fixturesPath`.
2. Verifies bundle hash matches `conformance_declaration.hash_of_fixtures`; mismatch → fixture-tampering error.
3. For each fixture: calls `adapter.executeOperation(opId, request)` and compares the canonical hash of the response to `expected_response`'s canonical hash.
4. Writes `adapter_conformance_records` row with full results.
5. When `gateAcceptance=true`, the row is marked immutable (any UPDATE attempt fails via row-level trigger).

**`AdapterHealthCheckProcessor`** — worker; scheduled every 60 seconds for each enabled adapter:
1. Calls `adapter.healthCheck()` with a 5-second timeout.
2. Updates `last_health_check_at` + `last_health_check_verdict`.
3. Verdict transition `ok → degraded/down` emits RuntimeAnomaly.

**`AdapterCallExecutor`** — the call surface every pack-side integration code uses:
```typescript
execute(adapterId: string, opId: string, payload: unknown): Promise<unknown>;
```
1. Resolves adapter from registry; refuses with 503 if `enabled=false` OR `last_health_check_verdict='down'`.
2. Looks up the adapter's killswitch state (§3.18 link): if killed, refuses fail-closed.
3. Logs the call (request shape, NOT raw secret) to `integrations.outbound_call_log` (§3.18 table).
4. Calls `adapter.executeOperation(opId, payload)`.
5. Returns result OR re-throws.

#### 13.14.5 API endpoints

| Method | Path | Boundary | Body / params |
|---|---|---|---|
| `POST` | `/api/integrations/adapters` | `@RequirePermission('integrations:adapter:install')` | `{ adapterId, adapterVersion, mode, config }` |
| `PATCH` | `/api/integrations/adapters/:id` | `@RequirePermission('integrations:adapter:configure')` | `{ mode?, enabled? }` |
| `DELETE` | `/api/integrations/adapters/:id` | `@RequirePermission('integrations:adapter:uninstall')` | `{ reason }` |
| `GET` | `/api/integrations/adapters` | `@RequirePermission('integrations:adapter:read')` | — |
| `POST` | `/api/integrations/adapters/:id/replay-conformance` | `@RequirePermission('integrations:adapter:replay')` | `{ gateAcceptance? }` |
| `GET` | `/api/integrations/adapters/:id/conformance-records` | `@RequirePermission('integrations:adapter:read')` | — |
| `GET` | `/api/integrations/adapters/:id/health` | `@RequirePermission('integrations:adapter:read')` | — |

New permission codes:
- `integrations:adapter:install` (`dangerous: true`)
- `integrations:adapter:configure`
- `integrations:adapter:uninstall` (`dangerous: true`)
- `integrations:adapter:read`
- `integrations:adapter:replay`

#### 13.14.6 Validator extensions

Pack validator gains 3 publish gates:

1. **G14.1** — Pack manifest `integrations[]` MUST declare required `adapter_id` + `minimum_conformance_version`. Error: `MISSING_ADAPTER_DEPENDENCY`.
2. **G14.2** — At install time, each declared adapter MUST have a registered row with `enabled=true` AND `conformance_declaration.fixture_set_id` ≥ pack's `minimum_conformance_version`. Error: `ADAPTER_NOT_AVAILABLE` (install-time, not publish-time).
3. **G14.3** — Pack code-path calls to `AdapterCallExecutor.execute(adapterId, ...)` MUST use only `adapterId` values declared in the pack's `integrations[]`. Error: `UNDECLARED_ADAPTER_USAGE` (catches packs that try to use platform-shared adapters they didn't declare).

#### 13.14.7 Service-boundary scanner rules

| Entity | Allowed writers |
|---|---|
| `AdapterRegistry` | `AdapterRegistryService.*`, `AdapterHealthCheckProcessor.updateHealth` |
| `ConformanceRecord` | `ConformanceReplayService.replay` |

Additionally: `tools/integration-call-check.ts` (NEW scanner) — grep pack code for direct adapter package imports; require all integration calls to flow through `AdapterCallExecutor.execute`. Direct import of an adapter package outside `apps/api/src/app/integrations/**` fails CI.

#### 13.14.8 Tests (self-test ≥ 12 assertions)

1. **`adapter-register-with-conformance.spec.ts`** — register `hl7v2-simulator`; conformance replay passes all fixtures; row created with healthy verdict.
2. **`adapter-register-conformance-fail.spec.ts`** — register with broken fixture set (one expected_response edited); replay fails; registration refused; no row created.
3. **`adapter-fixture-hash-tamper.spec.ts`** — fixture bundle hash on disk does NOT match `conformance_declaration.hash_of_fixtures`; replay refuses with `FIXTURE_BUNDLE_TAMPERED`.
4. **`adapter-set-mode-live-to-sim.spec.ts`** — switch mode live→simulator; high-severity audit row written; subsequent calls go through simulator.
5. **`adapter-health-check-degraded.spec.ts`** — simulator returns `verdict='degraded'`; health check stamps row; RuntimeAnomaly emitted on first degraded transition.
6. **`adapter-call-routed.spec.ts`** — `AdapterCallExecutor.execute('hl7v2', 'ADT-A08', payload)` → call routed to active adapter; result returned; `outbound_call_log` row written.
7. **`adapter-killswitch-fail-closed.spec.ts`** — flip §3.18 killswitch; subsequent `execute()` calls refuse with 503; no adapter code invoked.
8. **`adapter-down-fail-closed.spec.ts`** — adapter health `down`; `execute()` refuses fail-closed.
9. **`adapter-pack-undeclared-usage.spec.ts`** — pack calls `execute('hl7v2', ...)` without declaring `hl7v2` in its manifest; scanner G14.3 fails CI.
10. **`adapter-pack-install-missing-adapter.spec.ts`** — pack with `integrations: [{adapter_id: 'hl7v2', minimum_conformance_version: 'v3'}]`; instance has no `hl7v2` registered; pack install refused.
11. **`adapter-gate-acceptance-immutable.spec.ts`** — conformance record with `gate_acceptance_run=true` cannot be modified; UPDATE attempt fails via trigger.
12. **`adapter-direct-import-scanner.spec.ts`** — pack code imports `@hubblewave/hl7v2-live` directly (bypassing AdapterCallExecutor); scanner fails CI.

#### 13.14.9 PR breakdown for §3.13

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Schema + tables + entities + SDK package + `AdapterRegistryService.register/list` + tests 1, 2, 3 | Migrations 1-3; `libs/integration-adapter-sdk/**`; `apps/api/src/app/integrations/adapter-registry.service.ts`; canonical hash helper | Registration validates conformance; tampered fixtures refused |
| 2 | `ConformanceReplayService` + replay endpoint + gate-acceptance immutability + test 11 | `apps/api/src/app/integrations/conformance-replay.service.ts`; replay controller; immutable trigger | Replay round-trips; gate-acceptance rows immutable |
| 3 | `AdapterHealthCheckProcessor` + health endpoint + tests 5, 8 | `apps/worker/src/integrations/health-check.processor.ts`; SchedulingModule wire; RuntimeAnomaly hook | Healthy + degraded + down all stamped; alert emitted on transition |
| 4 | `AdapterCallExecutor` + outbound_call_log wire + tests 6, 7 | `apps/api/src/app/integrations/adapter-call-executor.ts`; §3.18 outbound_call_log dependency stub | Calls routed; killswitch fail-closed |
| 5 | Mode-switch endpoint + setMode + tests 4 + canon §39 amendment + validator G14.1-G14.2 | `apps/api/src/app/integrations/mode-switch.controller.ts`; pack-validator extension; CLAUDE.md amendment | Mode flip emits audit + alert; pack install enforces adapter availability |
| 6 | Service-boundary scanner extension + `integration-call-check.ts` NEW scanner + tests 9, 10, 12 | `tools/integration-call-check.ts` + self-test; G14.3 validator | Undeclared adapter usage fails; direct adapter import fails; scanner CI-gated |

**Total: 6 PRs for §3.13. Estimated effort: ~11-14 working days. (Tracker said 5 PRs; final estimate is 6 once mode-switch + validator gates were broken out.)**

---

### 13.15 Worked example: §3.14 Semantic Search / Vector Match Primitive (full artifact-level spec — pgvector index + explainable confidence bands)

#### 13.15.1 Tables

Two new tables in `schema: 'search'` (existing schema from canon §40 / Plan Fix 30 search authz wave).

**`search.vector_index_entry`** — one row per indexed field-value, partitioned by `collection_id` then by `embedding_model_version`. Reuses canon §28 search-authz pre-filter mechanism (Plan Fix 30 PR-2 + PR-3).

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK component (with `collection_id` for partitioning) |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `collection_id` | `uuid` | — | NOT NULL | LIST partition key |
| `record_id` | `uuid` | — | NOT NULL | The indexed record |
| `source_field` | `varchar(120)` | — | NOT NULL | Property `code` whose text was embedded |
| `source_text` | `text` | — | NOT NULL | The exact text embedded (subject to PII redaction policy at pack manifest) |
| `embedding` | `vector(1536)` | — | NOT NULL | pgvector — 1536 dims matches OpenAI text-embedding-3-small AND Ollama nomic-embed-text; founder-correctable in registry |
| `embedding_model_version` | `varchar(64)` | — | NOT NULL | E.g. `openai-3-small-2024-02`, `ollama-nomic-embed-text-v1.5`; SUB-partition key |
| `last_indexed_at` | `timestamptz` | — | NOT NULL | When this entry was last refreshed |
| `provenance` | `jsonb` | `'{}'::jsonb` | NOT NULL | `{ source_kind: 'record_update' \| 'pack_install' \| 'manual_reindex', triggered_by_user_id?, prior_embedding_age_seconds? }` |
| `_collection_id` | `uuid` | — | NOT NULL | Plan Fix 30 PR-3 ACL projection column; mirror of `collection_id` for authz filter |
| `_attribute_*` | `jsonb` | — | NULL | Plan Fix 30 PR-3 ABAC projection columns added per pack's `acl_attributes[]` declaration |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

**Partitioning:**
```sql
CREATE TABLE search.vector_index_entry (...) PARTITION BY LIST (collection_id);
-- Per-collection partition, then SUB-partition by embedding_model_version:
CREATE TABLE search.vector_index_entry_{collection_uuid}
  PARTITION OF search.vector_index_entry FOR VALUES IN ('{collection_uuid}')
  PARTITION BY LIST (embedding_model_version);
```

Indexes (per leaf partition):
- PK on `(id, collection_id, embedding_model_version)` — composite required by 2-level partitioning
- IVFFlat or HNSW on `(embedding)` — chosen per leaf based on row count (HNSW preferred when partition > 100k rows; IVFFlat for smaller). `vector_cosine_ops` operator class.
- `ix_vie_record ON (record_id)` for "re-index this record" queries.
- BRIN on `(last_indexed_at)` for retention sweep.

**`search.embedding_model_registry`** — which model is active per (instance, family).

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `model_family` | `varchar(64)` | — | NOT NULL | `text` / `image` / `audio`; only `text` shipped at G0a |
| `model_version` | `varchar(64)` | — | NOT NULL | E.g. `openai-3-small-2024-02` |
| `provider` | `varchar(32)` | — | NOT NULL | `openai` / `anthropic` / `ollama` / `bedrock` / `local-onnx` |
| `dimensions` | `int` | — | NOT NULL | E.g. 1536; CHECK `dimensions IN (768, 1024, 1536, 3072)` (covering known production models) |
| `cost_per_million_tokens_usd` | `decimal(10, 4)` | `0` | NOT NULL | Operational telemetry |
| `is_active` | `boolean` | `false` | NOT NULL | Exactly one row per `(instance_id, model_family)` may be active (UNIQUE partial index enforces) |
| `activated_at` | `timestamptz` | — | NULL | Set when `is_active` flipped true |
| `retiring_at` | `timestamptz` | — | NULL | Set when a successor is activated; old partitions retained until cutover sweep completes |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

Indexes: PK; UNIQUE `(instance_id, model_family) WHERE is_active = true` — partial uniqueness enforces single-active-model invariant; `ix_emr_family ON (model_family)`.

**Additive column on `metadata.property_definitions`**:

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `vector_indexed` | `boolean` | `false` | NOT NULL | When `true`, writes to records of this property trigger embedding generation + index upsert |

#### 13.15.2 Migrations

| # | Filename | Action |
|---|---|---|
| 1 | `1940000000000-add-vector-indexed-property-column.ts` | `ALTER TABLE metadata.property_definitions ADD COLUMN vector_indexed boolean NOT NULL DEFAULT false;` |
| 2 | `1940000000001-create-embedding-model-registry.ts` | Table + partial unique index |
| 3 | `1940000000002-create-vector-index-entry-parent.ts` | Parent partitioned table (LIST by collection_id) — no leaf partitions yet; subsequent migrations create them on `sync_to_mobile`-style triggers |
| 4 | `1940000000003-seed-default-embedding-model.ts` | Seed `model_family='text'`, `provider='ollama'`, `model_version='nomic-embed-text-v1.5'`, `dimensions=768`, `is_active=true` for dev; production deployments override via control-plane provisioning |

(Founder-correctable: `dimensions=1536` is the platform default for new installs because OpenAI 3-small is the most common production model; Ollama nomic-embed produces 768; an instance can run either by registering the appropriate `embedding_model_registry` row. The `embedding vector(1536)` column declaration locks any single instance to ONE dimension count — switching dimensions requires a partition-reindex migration. The seed flips to 768 dim for dev — flagged in PR-4 acceptance.)

#### 13.15.3 Services

`apps/worker/src/search/embedding-pipeline.processor.ts` + `apps/api/src/app/search/vector/`:

**`EmbeddingPipelineProcessor`** — worker; listens on a Redis stream for `record.modified` + `record.created` events emitted by data services:
1. For each event, iterate over the record's properties; collect those whose `property_definition.vector_indexed = true`.
2. For each such property, generate canonical text (NFC-normalized, whitespace-collapsed); skip if text unchanged from prior embedding (compare via `source_text` field).
3. Invoke the active embedding model (resolved from `embedding_model_registry` for the instance + `model_family='text'`); receive a `vector(N)` where N matches the registered `dimensions`.
4. UPSERT into `search.vector_index_entry` (`record_id, source_field, embedding_model_version` is the upsert key); stamp `provenance.source_kind='record_update'`.
5. Reuse Plan Fix 30 PR-3 ACL projection columns — populate `_collection_id` and `_attribute_*` so subsequent searches respect §28.

**`VectorMatchService`** — `apps/api/src/app/search/vector/vector-match.service.ts`:

```typescript
semanticMatch(query: string, collectionId: string, options: SemanticMatchOptions, ctx: UserRequestContext): Promise<RankedMatch[]>;
```

Flow:
1. Resolve active embedding model from registry; refuse with 503 if no active model.
2. Embed the query text (one API call to the active provider).
3. Build the §28 authz pre-filter via `compileSearchAuthz(collectionId, ctx)` (Plan Fix 30 PR-3). The resulting AST translates into a parameterized WHERE clause on `_collection_id` + `_attribute_*` columns.
4. Execute pgvector ANN query: `SELECT id, record_id, source_field, source_text, embedding <=> $1 AS distance FROM search.vector_index_entry WHERE <authz_where> ORDER BY embedding <=> $1 LIMIT $topK;`
5. Compute `confidence = 1 - cosine_distance`. Apply bands: `high ≥ 0.85`; `medium 0.70-0.85`; `low < 0.70`.
6. For low-confidence (< 0.70), AUTOMATICALLY append a lexical fallback (`SearchService.searchLexical` via §28 Typesense path); merge results with `match_kind='lexical_fallback'` flag.
7. Return `RankedMatch[]` with `{ recordId, score, confidence, band, sourceField, sourceText, matchKind: 'vector' | 'lexical_fallback', explainability: { ...explainable_factors } }`.

`explainable_factors`: `{ embedding_model_version, query_token_count, top_neighbor_distance, second_neighbor_distance, lexical_fallback_terms?: string[] }`. The platform surfaces these in the AVA chat trace + `/api/search/explain` endpoint.

**`EmbeddingModelLifecycleService`** — admin path to register, activate, and retire embedding models:
```typescript
register(input: RegisterModelRequest, ctx: UserRequestContext): Promise<EmbeddingModelRegistry>;
activate(modelId: string, ctx: UserRequestContext): Promise<void>;
reindex(collectionId: string, modelVersion: string, ctx: UserRequestContext): Promise<{ jobId: string }>;
```

Switching active model triggers a full background reindex per collection (writes to a new model-version SUB-partition; old SUB-partition retained until cutover sweep removes it 30 days later).

#### 13.15.4 API endpoints

| Method | Path | Boundary | Body / params |
|---|---|---|---|
| `POST` | `/api/search/vector` | `@RequireCollectionAccess('read')` | `{ query, collectionId, topK?, options? }` returns ranked matches |
| `GET` | `/api/search/explain` | `@RequirePermission('search:explain:read')` | query: `matchId` — full explainability payload for a prior match |
| `POST` | `/api/integrations/embedding-models` | `@RequirePermission('search:embedding_model:manage')` | `{ provider, modelVersion, dimensions, costPerMillionTokensUsd }` |
| `POST` | `/api/integrations/embedding-models/:id/activate` | `@RequirePermission('search:embedding_model:manage')` (`dangerous: true`) | — triggers full reindex |
| `GET` | `/api/integrations/embedding-models` | `@RequirePermission('search:embedding_model:read')` | — |

#### 13.15.5 Validator extensions

Pack validator gains 2 publish gates:

1. **G15.1** — Property declared with `vector_indexed=true` MUST be a text-type property (string / text / markdown / longtext). Error: `VECTOR_INDEX_REQUIRES_TEXT_PROPERTY`.
2. **G15.2** — Pack `semantic_search.indexes[]` declarations MUST reference existing properties with `vector_indexed=true`. Error: `SEMANTIC_INDEX_REFERENCES_NON_INDEXED_PROPERTY`.

#### 13.15.6 Service-boundary scanner rules

| Entity | Allowed writers |
|---|---|
| `VectorIndexEntry` | `EmbeddingPipelineProcessor.process`, `EmbeddingModelLifecycleService.reindex` |
| `EmbeddingModelRegistry` | `EmbeddingModelLifecycleService.*` |

#### 13.15.7 Tests (self-test ≥ 11 assertions)

1. **`vector-record-modified-triggers-embed.spec.ts`** — record write on a `vector_indexed=true` property → embed-and-upsert row in `vector_index_entry`; `provenance.source_kind='record_update'`.
2. **`vector-text-unchanged-skip.spec.ts`** — second write with same canonical text → no new embedding call (assert via mock counter).
3. **`vector-semantic-match-high-confidence.spec.ts`** — query that closely matches an indexed phrase; returns `band='high'`; `match_kind='vector'`.
4. **`vector-semantic-match-low-confidence-falls-back.spec.ts`** — query with no close match; `band='low'`; lexical fallback fires; merged result includes `match_kind='lexical_fallback'`.
5. **`vector-authz-prefilter.spec.ts`** — user with §28 collection access restricted to status='active' records; vector search returns ONLY active records; status='draft' records absent from result.
6. **`vector-attribute-prefilter.spec.ts`** — user with ABAC `region=NA` rule; results filtered via `_attribute_*` ACL columns.
7. **`vector-explainability.spec.ts`** — every result carries `embedding_model_version` + neighbor distances; `/api/search/explain` returns full audit trail.
8. **`vector-active-model-activate-reindex.spec.ts`** — register new model + activate; full reindex job runs; new SUB-partition populated; old SUB-partition retained 30 days then swept.
9. **`vector-no-active-model.spec.ts`** — instance with NO active model; `semanticMatch` returns 503 with `NO_ACTIVE_EMBEDDING_MODEL`.
10. **`vector-validator-non-text-property.spec.ts`** — pack declares `vector_indexed=true` on a `number` property; publish refused with G15.1.
11. **`vector-validator-undeclared-property.spec.ts`** — pack `semantic_search.indexes[]` references a property not marked `vector_indexed=true`; G15.2 refusal.

#### 13.15.8 PR breakdown for §3.14

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Migrations + entities + property column + `EmbeddingModelLifecycleService` + admin endpoints + validator G15.1/G15.2 + tests 9, 10, 11 | Migrations 1-4; entity area patch; `apps/api/src/app/search/vector/embedding-model.service.ts`; pack-validator extension | Registry CRUD works; partial-unique enforces single-active; validator catches misuse |
| 2 | `EmbeddingPipelineProcessor` + `record.modified` listener + canonical text + skip-unchanged + ACL projection wire + tests 1, 2 | `apps/worker/src/search/embedding-pipeline.processor.ts`; Redis stream consumer | Writes trigger embed; unchanged text skipped; Plan Fix 30 PR-3 projections populated |
| 3 | `VectorMatchService.semanticMatch` + pgvector ANN + confidence bands + tests 3, 5, 6 | `apps/api/src/app/search/vector/vector-match.service.ts`; SQL emitter | High-confidence results returned; §28 + ABAC pre-filter respected |
| 4 | Lexical fallback + explainability + `/api/search/explain` endpoint + tests 4, 7 | Merge logic with §28 Typesense path; explain controller | Low-confidence triggers fallback; explainability complete |
| 5 | Reindex on model activation + 30-day SUB-partition retention sweep + canon §40 amendment + test 8 | `apps/worker/src/search/reindex.processor.ts`; SchedulingModule; CLAUDE.md amendment | Switch reindexes; old SUB-partition swept; canon merged |

**Total: 5 PRs for §3.14. Estimated effort: ~9-11 working days.**

---

### 13.16 Worked example: §3.15 Spatial + Relationship Graph Primitive (full artifact-level spec — generic edges + traversal + route-solve + blast-radius)

#### 13.16.1 Tables

Two new tables in `schema: 'graph'` (NEW schema).

**`graph.relationship_edge`** — every edge in the platform's relationship graph, partitioned by `edge_kind` (LIST).

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK component (with `edge_kind`) |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `edge_kind` | `varchar(64)` | — | NOT NULL | LIST partition key; e.g. `floor_connects_to`, `asset_depends_on`, `room_contains_asset`, `corridor_links_rooms`, `key_owned_by`, `circuit_protects` |
| `src_collection_id` | `uuid` | — | NOT NULL | Source node's collection |
| `src_record_id` | `uuid` | — | NOT NULL | Source node |
| `dst_collection_id` | `uuid` | — | NOT NULL | Target node's collection |
| `dst_record_id` | `uuid` | — | NOT NULL | Target node |
| `weight` | `double precision` | `1.0` | NOT NULL | Edge weight (distance / cost / dependency strength) |
| `directed` | `boolean` | `true` | NOT NULL | When `false`, edge is treated as bidirectional in traversal |
| `metadata` | `jsonb` | `'{}'::jsonb` | NOT NULL | Pack-defined edge properties (e.g. `door_locked_after_hours`, `corridor_width_meters`) |
| `valid_from` | `timestamptz` | `now()` | NOT NULL | Edge effective-from (for time-windowed graphs like roster history) |
| `valid_until` | `timestamptz` | — | NULL | NULL = currently valid; non-NULL = retired edge retained for historical traversal |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |
| `audit_log_id` | `uuid` | — | NOT NULL | UNIQUE; FK |

**Partitioning:**
```sql
CREATE TABLE graph.relationship_edge (...) PARTITION BY LIST (edge_kind);
-- Per-edge-kind partitions are created on first use via DDL migration.
```

Indexes (per partition):
- PK on `(id, edge_kind)`.
- `ix_re_src ON (src_collection_id, src_record_id) WHERE valid_until IS NULL` — partial; supports "outgoing edges from this node" queries.
- `ix_re_dst ON (dst_collection_id, dst_record_id) WHERE valid_until IS NULL` — partial; incoming-edge queries.
- `ix_re_undirected ON (LEAST(src_record_id, dst_record_id), GREATEST(src_record_id, dst_record_id)) WHERE directed = false`.
- GIN `ix_re_metadata ON (metadata jsonb_path_ops)` for edge-attribute filtering.

**`graph.graph_index_hint`** — per-collection per-edge-kind indexing strategy overrides for high-degree nodes.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | NOT NULL | PK |
| `instance_id` | `uuid` | — | NULL | Same posture |
| `edge_kind` | `varchar(64)` | — | NOT NULL | UNIQUE per `(instance_id)` |
| `degree_skew_strategy` | `varchar(32)` | `'default'` | NOT NULL | CHECK ∈ `{default, materialized_neighbors, capped_fanout}`. `materialized_neighbors`: maintains a per-node materialized neighbor list to avoid scanning the partition for "neighbors of node X" with millions of edges. `capped_fanout`: traversal refuses to expand a node with > `max_fanout` edges. |
| `max_fanout` | `int` | — | NULL | Used when strategy = `capped_fanout` |
| `materialization_table` | `text` | — | NULL | When strategy = `materialized_neighbors`, the auxiliary table name |
| `created_at` | `timestamptz` | `now()` | NOT NULL | — |

#### 13.16.2 Migrations

| # | Filename | Action |
|---|---|---|
| 1 | `1941000000000-create-graph-schema.ts` | `CREATE SCHEMA graph;` |
| 2 | `1941000000001-create-relationship-edge-parent.ts` | Parent partitioned table + indexes on parent template |
| 3 | `1941000000002-create-graph-index-hint.ts` | Table |
| 4 | `1941000000003-seed-default-edge-kinds.ts` | Create per-pack partitions on pack install via `PackInstaller` hook (no static seed; partition creation is dynamic) |

#### 13.16.3 Services

`apps/api/src/app/graph/` (new module).

**`GraphEdgeService`** — `apps/api/src/app/graph/graph-edge.service.ts`:

```typescript
upsertEdge(input: EdgeInput, ctx: UserRequestContext): Promise<RelationshipEdge>;
retireEdge(edgeId: string, ctx: UserRequestContext): Promise<void>;
listEdges(filter: EdgeFilter, ctx: UserRequestContext): Promise<RelationshipEdge[]>;
```

Edge writes flow through `withAudit`; pack-validator runs `cycle_check`/`orphan_check` per declared invariant.

**`GraphTraversalService`** — `apps/api/src/app/graph/graph-traversal.service.ts`:

```typescript
traverse(input: TraverseInput, ctx: UserRequestContext): Promise<TraverseResult>;
routeSolve(input: RouteInput, ctx: UserRequestContext): Promise<RouteResult>;
blastRadius(input: BlastRadiusInput, ctx: UserRequestContext): Promise<BlastRadiusResult>;
```

`traverse(...)`:
- `{ startNodeCollectionId, startNodeRecordId, edgeFilter: { kinds: string[], metadataPredicate?, weightRange? }, depthLimit: 1-10, options: { algorithm: 'bfs' | 'dfs', cycleDetection: 'strict' | 'merge_revisit', maxNodes?: int } }`.
- §28 authz applied per-node: a traversal returning a node the user can't see is suppressed (with optional `omitted_count` in the response). Traversal cannot leak existence of forbidden nodes.
- Cycle detection: `strict` mode rejects when a cycle is encountered on a pack-declared DAG edge kind; `merge_revisit` allows but marks the revisit count.
- Honors `graph_index_hint.capped_fanout` — refuses to expand a node whose outgoing edge count exceeds the cap with `GRAPH_FANOUT_EXCEEDED` (avoids accidental N² scans).

`routeSolve(...)`:
- Bidirectional Dijkstra (or A* if `heuristic` provided) over edges filtered to `edgeFilter`.
- Returns `{ path: [{nodeId, edgeId, cumulativeWeight}], totalDistance, found: boolean }`.
- For floor-plan navigation (marquees #12, #24): Dijkstra over `corridor_links_rooms` + `room_contains_asset` edges with `weight = distance_meters` + door-locked filter from `metadata.door_locked_after_hours`.

`blastRadius(...)`:
- BFS from a starting node along `edge_kind` for `depth_limit` hops, intersected with a time window (returns nodes touched by the failure event within `time_window`).
- Used by Analyzer marquee #32 (blast-radius forensics on a suspected security incident).

#### 13.16.4 API endpoints

| Method | Path | Boundary | Body / params |
|---|---|---|---|
| `POST` | `/api/graph/edges` | `@RequirePermission('graph:edge:manage')` | `{ edgeKind, srcCollectionId, srcRecordId, dstCollectionId, dstRecordId, weight?, metadata?, directed? }` |
| `DELETE` | `/api/graph/edges/:id` | `@RequirePermission('graph:edge:manage')` | — sets `valid_until=now()` |
| `GET` | `/api/graph/edges` | `@RequirePermission('graph:edge:read')` | filter params |
| `POST` | `/api/graph/traverse` | `@RequirePermission('graph:query:read')` | traverse params |
| `POST` | `/api/graph/route` | `@RequirePermission('graph:query:read')` | route params |
| `POST` | `/api/graph/blast-radius` | `@RequirePermission('graph:query:read')` | blast-radius params |

#### 13.16.5 Validator extensions

Pack validator gains 4 publish gates:

1. **G16.1** — Pack `graph.edge_kinds[]` MUST declare `(kind, src_collection_id, dst_collection_id, directed, dag?: boolean)`. Error: `MISSING_EDGE_KIND_DECLARATION`.
2. **G16.2** — Edges declared `dag=true` cannot form cycles in seeded data; pack-install runs cycle-check via `GraphValidator.detectCycles`. Error: `CYCLE_IN_DAG_EDGE_KIND` (lists the offending cycle path).
3. **G16.3** — Spatial graph kinds (`corridor_links_rooms`, `floor_connects_to`) MUST NOT have orphan rooms (rooms with zero corridor connections) in seeded floor plans; orphan-check at pack install. Error: `ORPHAN_NODE_IN_SPATIAL_GRAPH` (lists orphan node IDs).
4. **G16.4** — `graph_index_hint.max_fanout` MUST be ≥ 50 (platform minimum). Error: `FANOUT_CAP_TOO_LOW`.

#### 13.16.6 Service-boundary scanner rules

| Entity | Allowed writers |
|---|---|
| `RelationshipEdge` | `GraphEdgeService.*`, `PackInstaller.seedGraphEdges` |
| `GraphIndexHint` | `GraphIndexHintService.*` (admin-only) |

#### 13.16.7 Tests (self-test ≥ 11 assertions)

1. **`graph-edge-upsert.spec.ts`** — upsert edge; row written; partition picked correctly by `edge_kind`.
2. **`graph-retire-edge.spec.ts`** — retire edge; `valid_until` stamped; subsequent traversals exclude it; historical traversal (`as_of` timestamp option) still includes it.
3. **`graph-traverse-bfs.spec.ts`** — 5-node chain; traverse(depth=3) returns 3 hops; cycle in graph; `strict` mode rejects, `merge_revisit` mode marks revisit count.
4. **`graph-traverse-authz.spec.ts`** — user lacks §28 read on node X; traversal omits X; `omitted_count` reflects it.
5. **`graph-route-solve-shortest.spec.ts`** — corridor graph with multiple paths; routeSolve returns shortest weighted path.
6. **`graph-route-solve-door-locked.spec.ts`** — door locked after hours; routeSolve at 21:00 excludes that edge; finds alternate path or returns `found=false`.
7. **`graph-blast-radius-bfs.spec.ts`** — incident on node X; blastRadius(depth=2, time_window=1h) returns nodes reachable via `circuit_protects` edges within window.
8. **`graph-fanout-cap.spec.ts`** — node with 10k outgoing edges; `capped_fanout` strategy with `max_fanout=1000` refuses with `GRAPH_FANOUT_EXCEEDED`.
9. **`graph-cycle-detection-validator.spec.ts`** — pack seeds A→B→C→A on `asset_depends_on` (declared `dag=true`); pack install refused with G16.2.
10. **`graph-orphan-room-validator.spec.ts`** — pack seeds room R with no corridor edges; G16.3 refusal.
11. **`graph-cross-collection-edge.spec.ts`** — edge from `assets` (R1) to `rooms` (R2); upsert + traverse both directions; cross-collection edges work.

#### 13.16.8 PR breakdown for §3.15

| PR | Goal | Files | Acceptance |
|---:|---|---|---|
| 1 | Schema + parent partitioned table + entities + `GraphEdgeService` + dynamic partition creation on pack install + tests 1, 2, 11 | Migrations 1-3; entity area patch; `apps/api/src/app/graph/graph-edge.service.ts`; pack-installer hook | Upsert + retire work; per-edge-kind partitions created on demand |
| 2 | `GraphTraversalService.traverse` with BFS/DFS + §28 authz integration + cycle detection + tests 3, 4 | `apps/api/src/app/graph/graph-traversal.service.ts` traverse path | Cycles detected; authz suppresses unauthorized nodes |
| 3 | `routeSolve` Dijkstra + door-locked metadata filter + tests 5, 6 | Dijkstra impl; door-time filter helper | Shortest path found; lockout windows respected |
| 4 | `blastRadius` BFS + time window + test 7 | BFS impl; temporal filter | Blast radius computed within window |
| 5 | `graph_index_hint` + fanout cap + validator G16.1-G16.4 + canon §41 amendment + tests 8, 9, 10 | `apps/api/src/app/graph/graph-index-hint.service.ts`; pack-validator extension; CLAUDE.md amendment | Fanout cap enforced; cycle/orphan detection at pack publish; canon merged |

**Total: 5 PRs for §3.15. Estimated effort: ~10-12 working days.**

---

### 13.17 Remaining implementation specs (inline expansion per §3.N — progress tracker)

Per user direction, all implementation detail is inline in this single mega-spec. Worked examples §13.2 — §13.16 cover §3.1 — §3.15; the remaining 3 substrate sections + 4 packs + 30 workflows + 35 marquees get the same artifact-level treatment in subsequent commits on `phase4/clinical-facilities-pack-design`.

**Substrate (3 remaining sections — §3.1-§3.15 ✅):**
- ✅ §3.1 taskable capability — §13.2 (5 PRs)
- ✅ §3.2 task_projection — §13.3 (12 PRs)
- ✅ §3.3 scheduling primitives — §13.4 (6 PRs)
- ✅ §3.4 list-scale primitives — §13.5 (4 PRs)
- ✅ §3.5 time-series observations — §13.6 (7 PRs)
- ✅ §3.6 regulated-action + Merkle batch + Part 11 envelope — §13.7 (6 PRs)
- ✅ §3.7 mobile parity + UI primitives — §13.8 (8 PRs)
- ✅ §3.8 AVA UI synthesis — §13.9 (3 PRs)
- ✅ §3.9 public intake hardened — §13.10 (5 PRs)
- ✅ §3.10 break-glass override — §13.11 (4 PRs)
- ✅ §3.11 external-collaborator sessions — §13.12 (5 PRs)
- ✅ §3.12 Storage / Evidence Attachment runtime — §13.13 (6 PRs)
- ✅ §3.13 Connector runtime + simulators — §13.14 (6 PRs)
- ✅ §3.14 Semantic Search / Vector Match — §13.15 (5 PRs)
- ✅ §3.15 Spatial + Relationship Graph — §13.16 (5 PRs)
- §3.16 Financial Control primitive (5 PRs)
- §3.17 Bulk Import / Commissioning Staging (4 PRs)
- §3.18 Integration Secrets + Egress Policy (5 PRs)

**Packs (4 packs):**
- `maintenance-core` — 51 collections, 18 workflows, 32 plugins, 7 integrations, 9 workspaces. ~25 PRs across Phase 2.
- `clinical-maintenance` — 12 collections, 3 workflows, 3 plugins, 4 integrations. ~8 PRs.
- `facilities-maintenance` — 14 collections, 5 workflows, 7 plugins, 4 integrations. ~10 PRs.
- `ot-security-maintenance` — 6 collections, 4 workflows, 3 plugins, 5 integrations, 1 workspace. ~10 PRs.

**Marquees (35 total):**
Each marquee is an integration test plus user-facing wiring. Specs include: end-to-end happy path; negative tests; edge cases; metrics + provenance verification. Typically 1-3 PRs per marquee on top of the underlying substrate + pack.

**Workflows (18 maintenance-core + 3 clinical + 5 facilities + 4 OT security = 30 total):**
Each workflow needs a state-machine specification: states + transitions + guards + actions + roles authorized for each transition + audit events emitted. Format: state diagram (Mermaid or ASCII) + transition table.

**Per-substrate-section spec doc** lives at `docs/superpowers/specs/2026-05-16-substrate-§{N}-{slug}.md`. Per-pack spec doc at `docs/superpowers/specs/2026-05-16-pack-{packname}.md`. Master implementation plan at `docs/superpowers/plans/2026-05-16-clinical-facilities-asset-maintenance-implementation.md` cross-references them in execution order.

### 13.18 Convention for spec doc filenames (superseded by mega-spec-inline approach)

```
docs/
  superpowers/
    specs/
      2026-05-16-clinical-facilities-asset-maintenance-design.md   ← THIS plan converted post-approval
      2026-05-16-substrate-3-01-taskable-capability.md             ← §3.1 detail
      2026-05-16-substrate-3-02-task-projection.md                 ← §3.2 detail (the biggest)
      2026-05-16-substrate-3-03-scheduling-primitives.md
      ... (18 substrate specs total)
      2026-05-16-pack-maintenance-core.md                          ← Pack spec
      2026-05-16-pack-clinical-maintenance.md
      2026-05-16-pack-facilities-maintenance.md
      2026-05-16-pack-ot-security-maintenance.md
    plans/
      2026-05-16-clinical-facilities-asset-maintenance-implementation.md
        ← Master implementation plan: PR sequence across all 18 substrate + 4 packs + 35 marquees
          aligned to gates G0a → G6 with explicit dependencies + slip budget.
```

### 13.19 What's left to do BEFORE code starts

1. **Convert this plan file** to `docs/superpowers/specs/2026-05-16-clinical-facilities-asset-maintenance-design.md` (the architecture spec — already drafted; post-ExitPlanMode it's a `git mv` + commit).
2. **Write 17 more substrate spec docs** (§3.2-§3.18), each following the §13.2 template above.
3. **Write 4 pack spec docs**, each enumerating every collection's tables/columns/migrations/services + every workflow's state machine + every plugin component skeleton.
4. **Write the master implementation plan** at `docs/superpowers/plans/2026-05-16-...-implementation.md` cross-referencing the spec docs into PR sequence by gate.
5. **§1.1 prerequisites cleared** before Phase 0 can start: W2 Stream 1 role-code/role-id auth resolution + migration/package coherence + scanner baseline.

Estimated effort for the implementation-spec work: **~6-8 working weeks** for one engineer + AI agents to produce the full spec set before the 50-week build clock starts. This is the cost of designing thoroughly before coding — and it's what prevents the architecture plan from quietly becoming "custom platform code wearing a pack costume" during execution.

---

**End of plan. Ready for user review. After approval, the next deliverables are the spec docs listed in §13.4 and §13.5 — written one at a time using §13.2 as the template.**
