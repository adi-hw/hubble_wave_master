# HubbleWave Clinical + Facilities Asset Maintenance — Master Implementation Plan

**Status:** Implementation-ready
**Spec reference:** `docs/superpowers/specs/2026-05-16-clinical-facilities-asset-maintenance-design.md` (7381-line mega-spec)
**Timeline:** ~50 weeks from G0a kickoff to G6 close
**Estimated PR count:** ~250 PRs (~103 substrate + ~53 pack + ~30 workflow + ~65 marquee implementation PRs)

This document sequences the Phase 4 design spec into an executable PR schedule across 8 gates. Every PR cross-references its underlying spec section (§13.X / §14.X / §15.X / §16.X) and declares its dependencies on earlier PRs. The plan is structured for solo-founder execution with AI agents, calibrated to one engineer's throughput on the critical path.

## 1. Plan structure + cross-spec referencing

Each PR row carries:
- **PR#** — global counter across all gates (PR-001 to PR-250-ish)
- **Spec ref** — `§13.7 PR-2` form, pointing into the design spec's per-section PR breakdown
- **Scope summary** — 1-2 lines (the spec carries full file lists + acceptance)
- **Depends on** — PR numbers that must merge first
- **Gate** — which gate this PR contributes to

The plan does NOT duplicate the spec's per-section PR breakdowns; it sequences them. Section §13.X / §14.X / §15.X / §16.X is the authoritative source for "what's in PR-N"; this plan answers "when does PR-N land".

## 2. Gate framework (recap from §5.3 with PR allocation)

| Gate | Target week | Spec sections | PRs allocated | Acceptance demo |
|---|---:|---|---:|---|
| **G0a** Foundation | 5 | Pre-flight PR-A1/A2/A3 (§1.1 preconditions #2+#3) + §13.2 + §13.4 + §13.5 + §13.6 (partial) + §13.7 (single-sig) | ~29 | Pack-validator capability fields + property_definitions safety columns + taskable + scheduling + observation base + single-signature path; CI green |
| **G0b** Advanced | 11 | §13.3 + §13.7 (Merkle) + §13.8 + §13.9 + §13.10 + §13.11 + §13.12 + §13.20 (PRs B1-B6 — §3.19 core + 5 adapters) | ~58 | task_projection w/ circuit breaker + Merkle batch + mobile parity + kiosk + customization override core + workflow/automation/form/workspace override adapters |
| **G0c** Marquee substrate | 17 | §13.13 + §13.14 + §13.15 + §13.16 + §13.17 + §13.18 + §13.19 + §13.20 (PRs C1-C7 — remaining 4 adapters + upgrade classifier + scanner) | ~45 | Storage + Connector + Vector + Graph + Financial + Import + Secrets + ALL 9 customization override adapters + UpgradeOverrideClassifier all live |
| **G1** maintenance-core | 23 | §14.1 + selected §15.1 workflows + MQ-#1 | ~28 | WO + PM + checklists + mobile tech workspace + voice WO capture |
| **G2** Overlays + MQ #2-5,31,33 | 31 | §14.2 + §14.3 + §14.4 + §15.2-§15.4 workflows + 7 marquees | ~38 | All 4 packs install together; AI marquees 1-5 + edges #31 #33 live |
| **G3** Tech superpowers + #6-13 + #32 | 37 | MQ-#6-13 + MQ-#32 + workflow refinements | ~22 | Glove-Mode + Generative close-out + Dirty Nameplate + Elevator Mode + P2P parts + Pins + Routing + LOTO + Blast Radius all live |
| **G4** Systemic + #14-17 + #27-29 + #35 | 43 | MQ-#14-17 + MQ-#27-29 + MQ-#35 + workspace 8+9 | ~22 | Auditor Kiosk + Contractor Flow + Smart Sprint + Replace Score + Capital Intercept + JIT + Invoice + Key Custody |
| **G5** Views + #18-22 + #30 + #34 | 47 | MQ-#18-22 + MQ-#30 + MQ-#34 | ~16 | Pivot-Kanban + Dual-Axis + Triage Deck + Live Command Map + Dependency Graph + Fleet + Joint Commission Merkle Proof |
| **G6** Scale + Demo | 50 | scale-rig + perf baseline + on-site test | ~8 | 3M assets / 20M WOs / 10B observations; mobile field test in dead-zone |

**Total: ~263 PRs across 50 weeks (~250 original + ~13 §3.19 customization override PRs added 2026-05-18 per founder direction). Critical-path PR throughput required: ~5-6 PRs/week sustained, with parallelism on independent tracks.**

Each gate ends with a written gate-acceptance memo + Go/No-Go decision (per §5.3). Gate slip → re-baseline before continuing.

## 3. G0a — Foundation substrate (Weeks 1-5; ~29 PRs incl. 3 pre-flight)

**Goal:** §3.1 taskable + §3.3 scheduling + §3.4 list-scale + §3.5 observation base + §3.6 single-signature path + processed_events ledger + Redis Consumer Groups + idempotency scaffold. Foundation CI scanners green.

**§1.1 precondition status (2026-05-17):**
- ✅ **Precondition #1 (W2 Stream 1)** — CLEARED at tag `phase3-w2-complete` (commit `fe71976`, merged to master). 16-PR W2 wave delivered role-code/role-id auth resolution, migration/package coherence, 13-scanner baseline green.
- 🔄 **Precondition #2 (Pack capability contract)** — embedded as PR-A1 below.
- 🔄 **Precondition #3 (Metadata safety fields)** — embedded as PR-A2 below.

The two remaining preconditions are NOT separate "operator action items" anymore; they are the first executable PRs of G0a (pre-flight PR-A1 + PR-A2 + PR-A3). All G0a substrate PRs (001+) depend on these three.

### G0a pre-flight PRs (week 1 — must merge before PR-001)

| PR# | Spec ref | Scope | Depends |
|---:|---|---|---|
| **A1** | §1.1 precondition #2 + §8 §17.5 amendment | `libs/pack-validator` extended to accept new pack-manifest fields: `requires_capabilities` (string[]), `provides_capabilities` (string[]), `capability_bindings` ({capability_code → binding_spec}), `task_projection.attrs[]` ({attr_name, source_path, projection_index_kind}), `public_intake.schemas[]` ({purpose, json_schema}), `connector_simulator_declarations[]` ({adapter_id, fixture_set_id, conformance_version}), `reserved_namespace_signing` ({ed25519_public_key_id, signed_namespaces[]}). Schema acceptance only — runtime enforcement comes per substrate PR. Pack-validator self-test: 8 assertions covering field presence + type checks + reserved-namespace pattern. Files: `libs/pack-validator/src/lib/manifest-schema.ts`, `libs/pack-validator/src/lib/manifest-schema.spec.ts`. | W2 baseline (precondition #1) |
| **A2** | §1.1 precondition #3 | `metadata.property_definitions` migration adding 6 nullable columns: `projection_safe boolean`, `confidentiality_class varchar(64)` (CHECK enum: public/internal/sensitive/never_reveal/legal_hold/sealed_investigation/system_secret/unrelated_patient_context), `break_glass_eligible boolean DEFAULT false`, `sync_to_mobile boolean DEFAULT false`, `taskable_field_mapping jsonb`, `vector_indexed boolean DEFAULT false`. Entity update in `libs/instance-db/src/lib/entities/metadata.ts`. Migration: `1932500000000-add-property-safety-fields.ts`. Validator G11.1 (break_glass_eligible mutually exclusive with hard-deny classes) lands here as scaffold; full enforcement per §13.11 PR-1. | A1 |
| **A3** | (CI verification) | End-to-end CI sweep on master after A1+A2 merge: all 13 architectural scanners green; migration runs cleanly on a fresh dev instance + on a phase3-w2-complete-tagged instance; no allowlist additions to `audit-bypass-check.ts` / `service-boundary-check.ts` / `permission-registry-sync-check.ts` / `route-boundary-coverage-check.ts`. Self-test additions for pack-validator schema acceptance. **Acceptance memo signed by operator before PR-001 ships.** | A1, A2 |

**Pre-flight acceptance:** All 13 architectural scanners green; pack-manifest schema accepts new fields; property_definitions has the 6 safety columns; substrate PRs can begin.

### G0a substrate PR sequence (week 1-5; ~26 PRs)

| PR# | Spec ref | Scope | Depends |
|---:|---|---|---|
| 001 | §13.2 PR-1 | `taskable_capability` table + entity + initial validator | A3 |
| 002 | §13.2 PR-2 | `task_emission` generation hook + before-save automation | 001 |
| 003 | §13.2 PR-3 | Per-pack opt-in registration + service-boundary scanner extension | 001 |
| 004 | §13.2 PR-4 | `generation_runs` idempotency table + double-fire test | 002 |
| 005 | §13.2 PR-5 | Canon §30 amendment + canon-test self-check | 001-004 |
| 006 | §13.4 PR-1 | `schedule_definitions` table + RRULE parser library | — |
| 007 | §13.4 PR-2 | Calendar-trigger scheduler worker | 006 |
| 008 | §13.4 PR-3 | Utilization-trigger scheduler (meter-aware) | 006 |
| 009 | §13.4 PR-4 | Condition-trigger scheduler + predicate evaluator | 006 |
| 010 | §13.4 PR-5 | Cross-trigger debounce + 1h window idempotency | 007, 008, 009 |
| 011 | §13.4 PR-6 | Canon §35 amendment + scheduling runbook | 010 |
| 012 | §13.5 PR-1 | `active`/`archive` partition strategy + admin endpoint | 001 |
| 013 | §13.5 PR-2 | Archive partition flip job (13-month cadence) | 012 |
| 014 | §13.5 PR-3 | Read-only archive enforcement + role revocation | 013 |
| 015 | §13.5 PR-4 | Cross-partition query helper | 014 |
| 016 | §13.6 PR-1 | Schema + observation_streams + observations table + pg_partman monthly | — |
| 017 | §13.6 PR-2 | observation_units dictionary seed + unit_code FK | 016 |
| 018 | §13.6 PR-3 | Ingest pipeline (manual + webhook adapters) | 016 |
| 019 | §13.6 PR-4 | 5s coalescing + COPY-style writes | 018 |
| 020 | §13.7 PR-1 | `compliance` schema + reason_codes + ReasonCodeService + validator G7.2/G7.3 | — |
| 021 | §13.7 PR-2 | `electronic_signatures` + `signature_chains` + SignatureService.sign() single-action + SignatureChainSubscriber + re-auth matrix | 020 |
| 022 | (sub-§13.7) | processed_events ledger + outbox pattern + canon §10 audit-in-tx helper | — |
| 023 | (sub-§13.7) | Redis Consumer Groups setup for worker idempotency | 022 |
| 024 | (sub-§13.7) | Idempotency scaffold (client_idempotency_uuid pattern reused across §3.X) | 022 |
| 025 | (CI gate) | All G0a CI scanners green (service-boundary, audit-bypass, permission-registry, route-boundary) | 001-024 |
| 026 | (Acceptance) | G0a demo end-to-end: taskable install → idempotency → observation ingest → single-signature chain extension | 025 |

**G0a acceptance:** Synthetic taskable collection installed; `generation_runs` idempotency holds under double-fire; observation ingest hits pg_partman partition; single-signature flow extends `signature_chains` with hash + previous_hash linearized via `pg_advisory_xact_lock`.

**Critical path within G0a:** PR-001 → PR-002 → PR-016 → PR-020 → PR-021 (the taskable + observation + signature linearization spine). PR-006/-007 scheduling can run in parallel with the observation track.

## 4. G0b — Advanced substrate (Weeks 6-11; ~52 PRs)

**Goal:** §3.2 task_projection (circuit breaker + tombstones + reconciliation), §3.6 Merkle batch, §3.7 mobile parity (UI primitives + Elevator Mode), §3.8 AVA UI synthesis, §3.9 public intake hardened, §3.10 break-glass override, §3.11 external-collaborator session tokens, observation rollup jobs.

### G0b PR sequence

| PR# | Spec ref | Scope | Depends |
|---:|---|---|---|
| 027 | §13.3 PR-1 | task_projection table + materialized projection helper | 001 |
| 028 | §13.3 PR-2 | Projection refresh job (debounce + batch) | 027 |
| 029 | §13.3 PR-3 | Circuit breaker on projection lag | 028 |
| 030 | §13.3 PR-4 | Tombstone strategy on collection delete | 027 |
| 031 | §13.3 PR-5 | Reconciliation job (drift detection) | 028 |
| 032 | §13.3 PR-6 | task_projection authz pre-filter (canon §28) | 027 |
| 033 | §13.3 PR-7 | task_projection materialized refresh perf hardening | 028 |
| 034 | §13.3 PR-8 | List-view pagination + cursor consistency | 027 |
| 035 | §13.3 PR-9 | task_projection mobile selective sync hooks | 034 |
| 036 | §13.3 PR-10 | Cross-collection task surface aggregator | 027 |
| 037 | §13.3 PR-11 | task_projection cost-aware materialization triggers | 028 |
| 038 | §13.3 PR-12 | Canon §34 amendment + projection runbook | 027-037 |
| 039 | §13.7 PR-3 | MerkleBatchService.batchSign() + 256-cap + @AuditMerkleBatchInsert allowlist | 021 |
| 040 | §13.5 PR-5 + §13.5 PR-6 | Observation rollup tables (hourly/daily/weekly) + ObservationRollupService scheduled SQL | 015, 016 |
| 041 | §13.5 PR-7 | Alerts engine + alert-evaluator.service.ts | 040 |
| 042 | §13.8 PR-1 | @hubblewave/ui-primitives package + PRIMITIVE_REGISTRY + parity scanner | — |
| 043 | §13.8 PR-2 | @hubblewave/ui-primitives-web adapter | 042 |
| 044 | §13.8 PR-3 | @hubblewave/ui-primitives-mobile adapter (RN + Reanimated) + field-tool primitives | 042 |
| 045 | §13.8 PR-4 | Migrations + entities + sync_to_mobile column + service-boundary writer rules | 027 |
| 046 | §13.8 PR-5 | MobileCollectionSchemaService + manifest endpoint + schema-publish hooks | 045 |
| 047 | §13.8 PR-6 | MobileSyncService.pull + push + MobileSyncConflictService + canon §28 plumbing | 046 |
| 048 | §13.8 PR-7 | OfflineSignatureQueueService + queued/confirm/abandon endpoints + Merkle batch handoff | 039, 047 |
| 049 | §13.8 PR-8 | elevator-mode-check.ts scanner + mobile e2e acceptance + canon §33 amendment + ESLint rule | 048 |
| 050 | §13.9 PR-1 | Migration + entity columns + AvaFormSynthesisService + FormDefinitionValidator synthesis mode | 042 |
| 051 | §13.9 PR-2 | API endpoints + permission codes + AVAToolRegistry boot wiring | 050 |
| 052 | §13.9 PR-3 | Trust-state plumbing + Suggest/Preview/Execute branches + canon §11 amendment | 050 |
| 053 | §13.10 PR-1 | Schema + tokens table + PublicIntakeTokenService + issuance/revocation | 020 |
| 054 | §13.10 PR-2 | Submissions + attachments tables + public submission endpoint + idempotency + rate-limit | 053 |
| 055 | §13.10 PR-3 | Attachment pre-signed URL + AttachmentScanProcessor + AV/secret/PII pipeline | 054 |
| 056 | §13.10 PR-4 | PublicIntakeProcessor + AVA structured extraction + pack dispatch + system principal | 055 |
| 057 | §13.10 PR-5 | Asset quarantine + rotation cron + geo-anomaly detection + canon §36 amendment | 056 |
| 058 | §13.11 PR-1 | Property column migration + confidentiality_class enum + G11.1 validator | — |
| 059 | §13.11 PR-2 | field_unmask_grants table + BreakGlassService.requestGrant/revokeGrant + WebAuthn re-auth + signature chain integration | 021, 058 |
| 060 | §13.11 PR-3 | AuthorizationService.evaluateFieldDecision three-stage extension + cache integration | 059 |
| 061 | §13.11 PR-4 | BreakGlassRevokerService worker + Compliance Officer forensic query endpoint + canon §28.10 amendment | 060 |
| 062 | §13.12 PR-1 | Migrations + entities + KioskSessionService.issue/bind/revoke + JwtAuthGuard kiosk branch | — |
| 063 | §13.12 PR-2 | Kiosk read-only enforcement at §28 evaluator + workspace binding | 062 |
| 064 | §13.12 PR-3 | CollaboratorInvitationService.issue/redeem/revoke + JwtAuthGuard collaborator branch + NotificationService wire | 062 |
| 065 | §13.12 PR-4 | Collaborator sign-closeout integration with §13.7 SignatureService + G12.1-G12.3 validator + canon §29 amendment | 064 |
| 066 | §13.12 PR-5 | Audit forensic endpoint for kiosk/collaborator history + monitoring | 063, 064 |
| 067 | §13.6 PR-7 | Canon §31 amendment + ops runbook (pg_partman + rollup-lag escalation) | 040, 041 |
| **B1** | §13.20 PR-1 | `customization_overrides` table + entity + `UniversalOverrideMergeEngine` core + `OverrideAdapterRegistry` + `CustomizationOverrideService` CRUD + 5 permission codes | 027 (task_projection awareness) |
| **B2** | §13.20 PR-2 | `override_policy` column migration on 9 pack-shipped artifact tables + pack-validator G20.1-G20.3 + canon §45 amendment + 5-scenario fixture loader | B1 |
| **B3** | §13.20 PR-3 | `WorkflowOverrideAdapter` + 5-scenario tests 1-5 (workflow surface — canonical first adapter) | B1, B2 |
| **B4** | §13.20 PR-4 | `AutomationRuleOverrideAdapter` + test 7 | B1, B2 |
| **B5** | §13.20 PR-5 | `FormDefinitionOverrideAdapter` + test 8 + integration with §13.8 G8.4 mobile-eligibility | B1, B2, 042-044 |
| **B6** | §13.20 PR-6 | `WorkspacePageOverrideAdapter` + test 10 + UI Builder authoring contract integration | B1, B2, 042-044 |
| 068 | (CI gate) | All G0b CI scanners green incl. customization override coverage on 4 active surfaces (workflow/automation/form/workspace) | 027-067, B1-B6 |
| 069 | (Acceptance) | G0b demo: 100k WO bulk-import → circuit breaker → Merkle batch 50 signatures → kiosk session bind/revoke + workflow override applied (5-scenario fixture green) | 068 |
| 070 | (Slack) | Slip-budget reserve PR — fix any G0b regressions before G0c | 069 |
| 071-072 | (Slack) | Slip-budget reserve PRs (~2 spare slots within G0b's 6-week window; tighter than before due to §3.19 absorption) | 069 |

**G0b acceptance:** 100k WO bulk-import → circuit breaker keeps list views responsive → Merkle batch of 50 signatures + replay attack rejected → kiosk session bound to a device → revoke is one-tap.

**Critical path within G0b:** task_projection track (PR-027→028→029→031) is independent of the mobile track (PR-042→047→048). The Merkle batch (PR-039) requires single-sig (PR-021 from G0a) but unblocks offline signature queue (PR-048).

## 5. G0c — Marquee substrate (Weeks 12-17; ~45 PRs incl. 7 §3.19 adapters)

**Goal:** §3.12 Storage + §3.13 Connector + §3.14 Vector + §3.15 Graph + §3.16 Financial + §3.17 Import + §3.18 Secrets + COMPLETE §3.19 customization override (4 remaining adapters + upgrade classifier + scanner). All shared marquee substrate AND all 9 customization override adapters ready before G1 pack work begins.

**§3.19 completion in G0c** is binding per founder direction (2026-05-18): "platform capabilities must all be ready before the pack work starts". PRs C1-C7 land all 4 remaining adapters + UpgradeOverrideClassifier + customization-coverage-check scanner before §14.1 maintenance-core PRs in G1.

### G0c PR sequence

| PR# | Spec ref | Scope | Depends |
|---:|---|---|---|
| **C1** | §13.20 PR-7 | `ViewOverrideAdapter` + test 9 + canon §7 layering integration (priority: personal > customer-override > role > pack) | B1, view runtime |
| **C2** | §13.20 PR-8 | `PropertyValidatorOverrideAdapter` + test 11 + confidentiality_class hard-deny enforcement | B1, §13.11 (will land via PR-058+) |
| **C3** | §13.20 PR-9 | `CollectionAccessRuleOverrideAdapter` + test 12 + canon §28 evaluator integration (add_rule only; never modify pack's default) | B1, canon §28 evaluator |
| **C4** | §13.20 PR-10 | `NotificationTemplateOverrideAdapter` + test 13 + template variable validation | B1, NotificationService |
| **C5** | §13.20 PR-11 | `AvaToolConfigOverrideAdapter` + test 14 + canon §12 trust progression enforcement (cannot upgrade past pack maximum) | B1, 050-052 |
| **C6** | §13.20 PR-12 | `UpgradeOverrideClassifier` + `migration_manifest.yaml` rename-hint format + G20.4 validator + tests 15-17 + `/api/customization/upgrade-classify` endpoint | C1-C5, B3-B6 (all 9 adapters) |
| **C7** | §13.20 PR-13 | `tools/customization-coverage-check.ts` scanner + self-test (12 assertions) + test 18 + canon §45 amendment finalization + `/api/customization/override-policies` endpoint | C6 |
| 079 | §13.13 PR-1 | Schema + tables + entities + StoragePresignService + validator | — |
| 080 | §13.13 PR-2 | AttachmentIngestProcessor + content-type sniff + SHA-256 + ExpiredPresignSweeper | 079 |
| 081 | §13.13 PR-3 | AV + secret + PII scanners + state machine | 080 |
| 082 | §13.13 PR-4 | Scan retry semantics | 081 |
| 083 | §13.13 PR-5 | LinkOnCleanProcessor + retention_until + COMPLIANCE Object Lock + link target routing | 082 |
| 084 | §13.13 PR-6 | Canon §38 amendment + service-boundary scanner | 083 |
| 085 | §13.14 PR-1 | Schema + tables + entities + SDK package + AdapterRegistryService.register/list | — |
| 086 | §13.14 PR-2 | ConformanceReplayService + replay endpoint + gate-acceptance immutability | 085 |
| 087 | §13.14 PR-3 | AdapterHealthCheckProcessor + health endpoint | 085 |
| 088 | §13.14 PR-4 | AdapterCallExecutor + outbound_call_log wire | 085 |
| 089 | §13.14 PR-5 | Mode-switch endpoint + setMode + canon §39 amendment + validator G14.1-G14.2 | 087, 088 |
| 090 | §13.14 PR-6 | Service-boundary scanner extension + integration-call-check.ts scanner | 088, 089 |
| 091 | §13.15 PR-1 | Migrations + entities + property column + EmbeddingModelLifecycleService + validator | — |
| 092 | §13.15 PR-2 | EmbeddingPipelineProcessor + record.modified listener + canonical text + ACL projection | 091 |
| 093 | §13.15 PR-3 | VectorMatchService.semanticMatch + pgvector ANN + confidence bands | 091, 092 |
| 094 | §13.15 PR-4 | Lexical fallback + explainability + /api/search/explain | 093 |
| 095 | §13.15 PR-5 | Reindex on model activation + 30-day SUB-partition retention sweep + canon §40 amendment | 093 |
| 096 | §13.16 PR-1 | Schema + parent partitioned table + entities + GraphEdgeService + dynamic partition creation | — |
| 097 | §13.16 PR-2 | GraphTraversalService.traverse BFS/DFS + §28 authz + cycle detection | 096 |
| 098 | §13.16 PR-3 | routeSolve Dijkstra + door-locked metadata filter | 097 |
| 099 | §13.16 PR-4 | blastRadius BFS + time window | 097 |
| 100 | §13.16 PR-5 | graph_index_hint + fanout cap + validator G16.1-G16.4 + canon §41 amendment | 098, 099 |
| 101 | §13.17 PR-1 | Schema + tables + entities + ApprovalPolicyService + validator G17.1-G17.2 | — |
| 102 | §13.17 PR-2 | TransactionApprovalService.request/approve/reject + separation-of-duties + WebAuthn | 101, 059 |
| 103 | §13.17 PR-3 | ThreeWayMatchService.attemptMatch + variance | 101 |
| 104 | §13.17 PR-4 | BudgetEnvelopeService.allocate/checkAndConsume + over-envelope branches | 101 |
| 105 | §13.17 PR-5 | enforceSeparationOfDuties extension to §28 evaluator + canon §42 amendment + AST-scan G17.3 | 102, 060 |
| 106 | §13.18 PR-1 | Schema + tables + entities + ImportBatchService.ingest/listRows/applyReviewerOverride/setRowStatus | — |
| 107 | §13.18 PR-2 | ImportNormalizationProcessor + AVA integration | 050, 106 |
| 108 | §13.18 PR-3 | Atomic publish + transaction wrapping | 107 |
| 109 | §13.18 PR-4 | rollback + customer policy + window enforcement + canon §43 amendment + AccessAuditPort security event | 108 |
| 110 | §13.18 PR-5 | abandon + RollbackWindowExpiryProcessor cold-storage archival + validator G18.1-G18.3 | 109 |
| 111 | §13.19 PR-1 | Migrations + entities + IntegrationSecretService.create/rotate/delete/listMetadata + SecretResolver | — |
| 112 | §13.19 PR-2 | EgressAllowlistEnforcer + outbound_call_log writes | 111 |
| 113 | §13.19 PR-3 | KillswitchService simple trip/reset + adapter call routing | 088, 111 |
| 114 | §13.19 PR-4 | NAC dual-confirmation flow + validator G19.3 | 113 |
| 115 | §13.19 PR-5 | egress-enforcer-check.ts scanner + AST-scan for SecretResolver direct-read + validator G19.1, G19.2, G19.4 | 112, 114 |
| 116 | §13.19 PR-6 | Canon §44 amendment + service-boundary rule additions | 111-115 |
| 117 | (CI gate + Acceptance) | All G0c scanners green; G0c demo end-to-end | 079-116 |

**G0c acceptance:** Pre-signed upload + AV-scan + object-lock works E2E; one connector adapter runs in both live + simulator modes with conformance proof; semantic match returns explainable confidence bands; floor-plan graph route-solves a 4-floor hospital fixture; three-way match + SoD enforces on synthetic invoice; bulk import publishes 5,000 rows atomically; NAC adapter refuses to fire without dual-confirmation guardrails; **§3.19 universal customization override fully ready: all 9 surface adapters active + 5-scenario fixture green + UpgradeOverrideClassifier classifies synthetic upgrade green/yellow/red correctly + customization-coverage-check scanner blocks packs missing override_policy declarations** (binding per founder direction 2026-05-18).

**Critical path within G0c:** Storage (PR-079→083) blocks intake attachment pipeline + evidence_artifact link-on-clean for all downstream marquees. Vector + Graph are independent tracks. Financial + Import are independent. Secrets + Egress unblock connector calls.

## 6. G1 — maintenance-core (Weeks 18-23; ~28 PRs)

**Goal:** maintenance-core pack at §14.1 — full collections + WO/PM/checklists + technician mobile workspace + AI marquee #1 (voice WO capture) + v1 explainable risk scoring + Compliance Officer workspace.

### G1 PR sequence

| PR# | Spec ref | Scope | Depends |
|---:|---|---|---|
| 118 | §14.1 PR-1 | Pack scaffold + manifest + RBAC roles + permission registry seeding | 020, 058 |
| 119 | §14.1 PR-2 | Asset hierarchy (5 collections) + §3.15 graph wiring | 096, 118 |
| 120 | §14.1 PR-3 | Locations + spaces (3 collections) | 119 |
| 121 | §14.1 PR-4 | Work orders core (3 collections) + WF-1 + WF-12 + WF-11 escalation | 001, 027, 119 |
| 122 | §14.1 PR-5 | PM machinery (3 collections) + WF-4 PM generation + scheduled rules | 006, 121 |
| 123 | §14.1 PR-6 | Checklists + inspections (4 collections) + WF-5 calibration | 121 |
| 124 | §14.1 PR-7 | Rounds (2 collections) + WF-13 + observation stream wiring | 016, 121 |
| 125 | §14.1 PR-8 | Vendors + contracts (6 collections) + WF-14 contract renewal | 121 |
| 126 | §14.1 PR-9 | Procurement (4 collections) + WF-3 + WF-15 + WF-16 + §3.16 transaction_approval | 102, 121, 125 |
| 127 | §14.1 PR-10 | Inventory (9 collections) + parts reorder WF-9 | 121 |
| 128 | §14.1 PR-11 | Stock + documents + recalls (4 collections) + WF-6 recall remediation | 121, 127 |
| 129 | §14.1 PR-12 | Dispatch (3 collections) + WF-2 entitlement intercept + AVA contract match | 050, 121 |
| 130 | §14.1 PR-13 | Key custody (3 collections) + WF-20 | 121 |
| 131 | §14.1 PR-14 | Asset import wizard (1 collection alias over §3.17) + WF-19 + AVA normalization tool | 108, 121 |
| 132 | §14.1 PR-15 | Fleet telematics integration + WF-18 + obd2-telematics-feed adapter | 016, 085, 122 |
| 133 | §14.1 PR-16 | Vendor invoice reconciliation WF-17 + AI three-way-match | 103, 125 |
| 134 | §14.1 PR-17 | UI Builder workspaces 1-5 (technician, dispatcher, manager, biomed/facilities placeholders) | 042, 043, 044, 121 |
| 135 | §14.1 PR-18 | UI Builder workspaces 6-9 (compliance officer, FCA inspector, auditor kiosk, OT security placeholder) | 062, 134 |
| 136 | §14.1 PR-19 | Plugin components 1-10 (foundation viewers) | 042-044 |
| 137 | §14.1 PR-20 | Plugin components 11-20 (workflow triggers + external-collaborator surfaces) | 042-044, 064 |
| 138 | §14.1 PR-21 | Plugin components 21-32 (persona dashboards + fluid WO views) | 042-044 |
| 139 | §14.1 PR-22 | ~50 views | 121 |
| 140 | §14.1 PR-23 | ~25 automation rules end-to-end | 121-138 |
| 141 | §14.1 PR-24 | Integration adapter conformance: 6 of 7 (bacnet, modbus, mqtt, barcode, s3, ad-scim) | 085-089 |
| 142 | §14.1 PR-25 | Pack-validator final gates + RBAC seed + cross-pack integration smoke tests + canon §17.5 confirmation | 118-141 |
| 143 | §16.1 MQ-#1 | Voice WO capture impl + AVA tool + integration test fixture mq-01 | 121, 134 |
| 144 | (v1 risk scoring) | Explainable risk scoring in `ws_maintenance_manager` per §5.1 v1 predictive | 121, 138 |
| 145 | (Acceptance) | G1 demo end-to-end: WO lifecycle + voice capture + risk score + audit chain | 118-144 |

**G1 acceptance:** Assets + WO + PM + checklists + technician mobile workspace live; AI marquee #1 demonstrable; v1 risk scoring live; Compliance Officer workspace shows audit chain.

**Critical path within G1:** PR-118 (scaffold) → PR-119 (asset) → PR-121 (WO) → PR-122-128 (other collections in parallel). The 32-plugin work (PR-136-138) is the longest tail; assign to dedicated AI-agent track with strong primitive-parity discipline.

## 7. G2 — Overlays + AI marquees + edges #31, #33 (Weeks 24-31; ~38 PRs)

**Goal:** Clinical + Facilities + OT-Security overlays installable without collision; AI marquees #1-5 + edge marquees #31 (Semantic Recall) + #33 (Auto-Commissioning) demonstrable; three-overlays CI test passes.

### G2 PR sequence

| PR# | Spec ref | Scope | Depends |
|---:|---|---|---|
| 146 | §14.2 PR-1 | clinical-maintenance scaffold + clinical_device_class + udi_record + gmdn_term + FDA seed data | 118 |
| 147 | §14.2 PR-2 | ecri_recall + WF-OC3 + <SemanticRecallMatchBoard> integration with §3.14 + auto rule 1 | 093, 094, 146 |
| 148 | §14.2 PR-3 | aem_program + aem_program_membership + WF-OC1 + auto rule 4 + AEM dashboard | 146 |
| 149 | §14.2 PR-4 | calibration_certificate + sterilization_cycle + auto rules 2, 3, 5 | 123, 146 |
| 150 | §14.2 PR-5 | phi_disposal_record + WF-OC2 + auto rule 6 (SoD) + canon §10 PHI-disposal audit | 146 |
| 151 | §14.2 PR-6 | ehr_context_link + <EhrContextPanel> deep-link only + life_support_designation + clinical_criticality_score + KMS encryption | 111, 146 |
| 152 | §14.2 PR-7 | HL7-v2 + FHIR-R4 adapters (live + simulator) + conformance fixtures | 085-089 |
| 153 | §14.2 PR-8 | ECRI feed + FDA UDI feed adapters + ws_biomed_engineer workspace 4 pages + canon amendment | 134, 147, 152 |
| 154 | §14.3 PR-1 | facilities-maintenance scaffold + building_system + refrigerant_inventory + building_compliance_certificate | 118 |
| 155 | §14.3 PR-2 | refrigerant_log + WF-OF2 + auto rule 1 (25% threshold) + EPA form attachment | 154 |
| 156 | §14.3 PR-3 | fca_assessment + fca_finding + WF-OF1 + <FcaDeficiencyMap> | 154 |
| 157 | §14.3 PR-4 | cad_drawing_link + ifc_space_link + autocad-dwg + ifc-bim adapters | 085-089, 154 |
| 158 | §14.3 PR-5 | energy_baseline + commissioning_record + WF-OF3 + <EnergyDashboard> + auto rules 4, 7 | 154 |
| 159 | §14.3 PR-6 | space_reservation + WF-OF5 + <SpaceReservationCalendar> + auto rule 3 | 154 |
| 160 | §14.3 PR-7 | seat_assignment + move_request + WF-OF4 + <MoveRequestBoard> + auto rule 5 | 159 |
| 161 | §14.3 PR-8 | occupancy_log + wifi-beacon-occupancy adapter + <OccupancyHeatmap> + auto rule 6 | 016, 085-089, 154 |
| 162 | §14.3 PR-9 | bacnet-building-pack adapter + 10 facilities views | 085-089, 154 |
| 163 | §14.3 PR-10 | ws_facilities_manager workspace 5 pages (incl. <LiveOperationalCanvas>) + canon amendment | 134, 154-162 |
| 164 | §14.4 PR-1 | ot-security scaffold + ot_asset_vulnerability table + WF-OT1 | 118 |
| 165 | §14.4 PR-2 | network_policy + auto rule 4 (signature enforcement) | 164 |
| 166 | §14.4 PR-3 | security_advisory + WF-OT3 + §3.14 dedup | 094, 164 |
| 167 | §14.4 PR-4 | discovery_event + auto rule 1 + Claroty + Medigate adapters | 085-089, 164 |
| 168 | §14.4 PR-5 | risk_score + cross-pack reading clinical_criticality_score | 151, 164 |
| 169 | §14.4 PR-6 | network_baseline + WF-OT2 + auto rule 3 | 016, 164 |
| 170 | §14.4 PR-7 | Asimily + generic-cmdb-export adapters | 085-089, 164 |
| 171 | §14.4 PR-8 | nac-quarantine adapter + §3.18 dual-confirmation + clinical_criticality > 70 refusal | 114, 167-169 |
| 172 | §14.4 PR-9 | WF-OT4 ava_convergence_routing (marquee #26 prep) + AVA tool + auto rule 2 + <VulnerabilityTracker> | 050, 121, 164 |
| 173 | §14.4 PR-10 | <OtAssetRiskMap> + <NetworkBaselineDashboard> + ws_ot_security_officer workspace 4 pages + canon §44 amendment | 134, 164-172 |
| 174 | §16.1 MQ-#2 | Invisible Manual impl + AVA service-manual ingestion + <ChecklistRunner> wire + mq-02 fixture | 050, 091, 093, 121 |
| 175 | §16.1 MQ-#3 | Walk-by nurse intake impl + §3.9 wire + mq-03 fixture | 053-057 |
| 176 | §16.1 MQ-#4 | Deterministic parts staging impl + AVA rules engine + mq-04 fixture | 121, 127 |
| 177 | §16.1 MQ-#5 | Break-Glass PHI impl + <BreakGlassButton> + mq-05 fixture | 058-061, 151 |
| 178 | §16.8 MQ-#31 | Semantic Recall Quarantine impl + mq-31 fixture | 093, 147 |
| 179 | §16.8 MQ-#33 | AVA Auto-Commissioning impl + <AssetImportWizard> + mq-33 fixture | 106-110, 131 |
| 180 | (CI test) | three-overlays-installed CI test passes | 146-179 |
| 181 | (Acceptance) | G2 demo | 180 |
| 182-183 | (Slack) | Slip-budget reserve PRs | 181 |

**G2 acceptance:** Three overlays install together; UDI lookup live; BACnet + Claroty + Medigate + Asimily live or certified-simulator; AI marquees #1-5 + edges #31 + #33 demonstrable.

**Critical path within G2:** Overlays installable order matters — clinical first (provides risk-score cross-ref), then OT-security (consumes clinical_criticality). Facilities is independent of clinical for the most part. Marquees #1 is already in G1; #2-5 + #31 + #33 close in G2.

## 8. G3 — Technician + Connected-network superpowers + #32 (Weeks 32-37; ~22 PRs)

**Goal:** MQ-#6-13 + MQ-#32 (Analyzer Blast Radius). Rounds dedicated mobile tab live. All three overlays' OOTB workspaces author-able in UI Builder.

### G3 PR sequence

| PR# | Spec ref | Scope | Depends |
|---:|---|---|---|
| 184 | §16.2 MQ-#6 | Glove-Mode swipe UX impl (SwipeProgressCard/ThumbToggle/LargeActionButton) + mq-06 fixture | 042-044, 121 |
| 185 | §16.2 MQ-#7 | Generative close-out impl + AVA tool + reason-code vocabulary + mq-07 fixture | 050, 121 |
| 186 | §16.2 MQ-#8 | Dirty Nameplate Vision + <NameplateCamera> + AVA Vision tool + mq-08 fixture | 050, 091, 121 |
| 187 | §16.2 MQ-#9 | Elevator Mode full E2E test + airplane-mode shift fixture mq-09 | 045-049 |
| 188 | §16.3 MQ-#10 | P2P parts locator impl + presence opt-in + mq-10 fixture | 121, 127 |
| 189 | §16.3 MQ-#11 | Tribal Knowledge Asset Pins impl + AVA classify + §3.14 vector wire + mq-11 fixture | 091, 093, 121 |
| 190 | §16.3 MQ-#12 | Floor-Plan Routing <FloorPlanRouter> + technician_presence stream + mq-12 fixture | 097, 098, 154 |
| 191 | §16.3 MQ-#13 | Smart LOTO with AVA Vision impl + <LotoStepRunner> + mq-13 fixture | 050, 121 |
| 192 | §16.8 MQ-#32 | Analyzer Blast Radius <AnalyzerBlastRadiusBoard> + §3.15 blastRadius wire + bulk suspend + mq-32 fixture | 099, 121, 146 |
| 193 | (rounds dedicated tab) | Mobile tab integration for rounds + ws_technician_mobile_first update | 124, 134 |
| 194 | (workspace authoring) | UI Builder author-ability validation for all 9 OOTB workspaces | 134, 135 |
| 195-204 | (slack/refinement) | Slip budget + workflow refinements + post-G3 polish | 194 |
| 205 | (Acceptance) | G3 demo: tech superpowers full flow | 184-194 |

**G3 acceptance:** #6-13 all live; Rounds dedicated mobile tab live; #32 live; all 9 OOTB workspaces author-able.

**Critical path within G3:** Plugin parity scanner must remain green for every primitive added; Elevator Mode E2E (PR-187) requires the full §3.7 chain from G0b.

## 9. G4 — Systemic + Capital + JIT + Invoice + Key (Weeks 38-43; ~22 PRs)

**Goal:** MQ-#14-17 + MQ-#27-29 + MQ-#35. 8th + 9th OOTB workspaces (Auditor Kiosk, OT Security Officer) operating.

### G4 PR sequence

| PR# | Spec ref | Scope | Depends |
|---:|---|---|---|
| 206 | §16.4 MQ-#14 | Auditor Kiosk impl + <AuditorKioskShell> + ws_auditor_kiosk full + mq-14 fixture | 062, 063, 135 |
| 207 | §16.4 MQ-#15 | Zero-Login Contractor + <ContractorPortal> + magic-link delivery + mq-15 fixture | 064, 065, 121 |
| 208 | §16.4 MQ-#16 | Smart Sprint <SprintBoard> + AVA clustering engine + mq-16 fixture | 027, 097, 121 |
| 209 | §16.4 MQ-#17 | Replacement Urgency Score <ReplacementUrgencyScore> + sentiment lexicon + mq-17 fixture | 121, 134 |
| 210 | §16.7 MQ-#27 | Predictive TCO Active Intercept + parts-order modal + <CapitalReplacementCard> + mq-27 fixture | 102, 121, 126 |
| 211 | §16.7 MQ-#28 | Autonomous JIT Procurement + <ProcurementProposalCart> + scheduled AVA tool + mq-28 fixture | 102, 126 |
| 212 | §16.7 MQ-#29 | AI Invoice Reconciliation + <InvoiceDiscrepancyBoard> + AVA Document AI + mq-29 fixture | 103, 121, 125, 133 |
| 213 | §16.8 MQ-#35 | Cryptographic Key Custody + <KeyCustodyLedger> + WF-20 + master-key cascade + mq-35 fixture | 130, 097 |
| 214 | (#23) | MQ-#23 Active Entitlement Shield impl + MSA extraction tool + dispatcher intercept + mq-23 fixture | 050, 125, 129 |
| 215 | (#24) | MQ-#24 Live Operational Canvas + <LiveOperationalCanvas> WebGL + mq-24 fixture | 098, 161, 163 |
| 216 | (#25) | MQ-#25 Continuous Observations Engine + <RoundsRunner> Glove-Mode swipe-deck + Dynamic Smart Rounds + mq-25 fixture | 016, 124, 184 |
| 217 | (#26) | MQ-#26 Network-to-Physical Triage (convergence + NAC quarantine cross-pack signature_chains) + mq-26 fixture | 050, 171, 172 |
| 218 | (8th workspace operational) | ws_auditor_kiosk full operational + audit forensic query CSV export | 206 |
| 219 | (9th workspace operational) | ws_ot_security_officer full operational | 173, 217 |
| 220-227 | (Slack/refinement) | Slip-budget reserve + workflow refinements | 219 |

**G4 acceptance:** #14-17 live; #27-29 live; #35 live; expanded contracts + facilities space management live; 8th + 9th OOTB workspaces operational.

**Critical path within G4:** Capital intercept (PR-210) → JIT (PR-211) → Invoice (PR-212) is a tight financial-control chain; each requires the next. Cross-pack convergence (PR-217 / MQ-#26) requires both clinical (PR-151) and ot-security (PR-172) — install order: clinical → ot-security → convergence.

## 10. G5 — WO views + Fleet + Joint Commission Merkle Proof (Weeks 44-47; ~16 PRs)

**Goal:** MQ-#18-22 + MQ-#30 (Fleet-as-Asset) + MQ-#34 (Joint Commission Merkle Proof).

### G5 PR sequence

| PR# | Spec ref | Scope | Depends |
|---:|---|---|---|
| 228 | §16.5 MQ-#18 | Pivot-Kanban <PivotKanban> + AVA macros (drag-as-command) + mq-18 fixture | 027, 121 |
| 229 | §16.5 MQ-#19 | Dual-Axis Timeline <DualAxisTimeline> + EHR context deep-link only + mq-19 fixture | 122, 151 |
| 230 | §16.5 MQ-#20 | Triage Deck <TriageDeck> Superhuman-style keyboard dispatch + mq-20 fixture | 027, 121 |
| 231 | §16.5 MQ-#21 | Live Command Map <LiveCommandMap> + WebGL + lasso-batch macro + mq-21 fixture | 027, 097, 121, 161 |
| 232 | §16.5 MQ-#22 | Dependency Graph <DependencyGraph> + critical-path AVA tool + mq-22 fixture | 097, 121 |
| 233 | §16.7 MQ-#30 | Fleet-as-Asset impl: obd2-telematics-feed live + utilization-trigger PMs + fault-code reactive WO + mq-30 fixture | 008, 016, 132 |
| 234 | §16.8 MQ-#34 | Joint Commission EoC Auditor Proof + <LiveOperationalCanvas> EoC mode + Merkle-proof viewer + client-side re-hash + mq-34 fixture | 039, 062, 206, 215 |
| 235 | (UI Builder showpiece) | UI Builder dog-food: dispatcher workspace authored entirely in UI Builder demonstrating <PivotKanban> + <LiveCommandMap> | 228, 231 |
| 236-243 | (Slack/perf) | Pre-G6 performance hardening + edge-case polish | 235 |

**G5 acceptance:** #18-22 all live at 60fps on demo dataset; #30 Fleet live; #34 Joint Commission Merkle Proof live; UI Builder dog-food showpiece.

**Critical path within G5:** MQ-#21 Live Command Map needs every Phase 4 substrate primitive working under load (task_projection + technician_presence + graph + canvas). MQ-#34 cryptographic verification client-side requires §3.6 Merkle batch + §3.11 kiosk audience — both already shipped in G0b/G4.

## 11. G6 — Scale + on-site demo readiness (Weeks 48-50; ~8 PRs)

**Goal:** apps/scale-rig produces 3M assets / 20M WOs / **≤10B observations**. Hot list views stay snapshot-backed under load. Mobile selective-sync pulls < 1MB metadata/list payload per technician's day. Perf baseline frozen.

### G6 PR sequence

| PR# | Spec ref | Scope | Depends |
|---:|---|---|---|
| 244 | (scale-rig) | apps/scale-rig synthetic data generator (3M assets, 20M WOs, 10B observations) | 244 |
| 245 | (perf hardening) | List-view snapshot-backed perf hardening under load | 244 |
| 246 | (mobile sync perf) | Mobile selective-sync optimization (<1MB metadata + list per day per tech) | 045-049 |
| 247 | (perf baseline) | Freeze perf baseline at docs/scale-baselines/v1.json | 244-246 |
| 248 | (on-site test) | On-site mobile field test (dead-zone / MRI-adjacent test area) | 246 |
| 249 | (Part 11 regulator-export rehearsal) | HubbleWave attestation schema mapped to Part 11 controls + Joint Commission readiness rubric; validation rehearsal | 234 |
| 250 | (Acceptance + RFP demo) | G6 demo to RFP committee at gate close | 244-249 |
| 251-256 | (Slack) | Slip-budget reserve + final polish | 250 |

**G6 acceptance:** Scale-rig produces target volume; hot list views responsive under load; mobile selective-sync passes byte budget; on-site field test passes; regulator-export rehearsal validates against Part 11 + Joint Commission schemas; **demo to RFP committee at gate close**.

**Critical path within G6:** PR-244 scale-rig generation must complete before PR-245-247 perf measurement runs. The on-site field test (PR-248) requires a real hospital test area, which is the longest-lead-time external dependency. Negotiate test-area access in G4-G5 to avoid blocking G6.

## 12. Cross-spec dependency map

The full PR dependency graph is implicit in the "Depends" column above. Key cross-section dependencies:

- **Substrate → Substrate:** §13.2 taskable → §13.3 task_projection → §13.X all taskable workflows. §13.6 single-signature → §13.6 Merkle batch → §13.8 offline signature queue.
- **Substrate → Pack:** Every pack PR depends on the relevant substrate primitives. §14.1 maintenance-core depends on §13.2-§13.6 substrate.
- **Pack → Marquee:** Every marquee PR depends on the pack(s) it composes. MQ-#26 cross-pack convergence requires BOTH §14.1 (maintenance-core) AND §14.4 (ot-security).
- **Workflow → Pack:** Workflow deep dives (§15.X) inform pack workflow files (declared per pack manifest) but don't introduce new PR dependencies — workflow specs are reference material for pack PRs.

**Cross-pack writes (architectural callouts):**
1. MQ-#26 WF-OT4 writes ONE `signature_chains` row referencing BOTH `ot_asset_vulnerability` AND `maintenance_work_order` (cross-pack atomicity; PR-217 spans §14.1 + §14.4)
2. MQ-#23 Active Entitlement Shield reads `master_service_agreement` from `maintenance-core` to influence WF-2 dispatch (PR-214)
3. MQ-#32 Analyzer Blast Radius traverses §3.15 graph across both `clinical-maintenance` (calibration instruments) and `maintenance-core` (asset registry) (PR-192)
4. MQ-#34 Joint Commission EoC Audit reads `signature_chains` written by EVERY pack (cross-pack read-only; PR-234)

## 13. Critical path

The single longest chain through the plan, gate-by-gate:

```
G0a:  PR-001 (taskable) → 002 → 016 (observations) → 020 (compliance schema) → 021 (single-sig)
G0b:  → 027 (task_projection) → 028 (refresh job) → 029 (circuit breaker) → 039 (Merkle batch) → 047 (mobile sync) → 048 (offline sig queue) → B1 (override engine core) → B3 (workflow adapter)
G0c:  → 079 (storage) → 083 (link-on-clean) → 091 (vector) → 093 (semantic match) → 096 (graph) → 102 (transaction approval) → C6 (upgrade classifier) → C7 (coverage scanner)
G1:   → 118 (pack scaffold) → 119 (asset) → 121 (WO) → 122 (PM) → 129 (dispatch)
G2:   → 146 (clinical scaffold) → 151 (ehr_context_link) → 164 (ot-security scaffold) → 171 (NAC adapter) → 172 (WF-OT4)
G3:   → 184 (Glove-Mode) → 192 (Blast Radius)
G4:   → 210 (TCO intercept) → 211 (JIT) → 212 (Invoice) → 217 (Convergence cross-pack)
G5:   → 231 (Live Command Map) → 234 (Joint Commission Merkle Proof)
G6:   → 244 (scale-rig) → 250 (RFP demo)
```

This chain is ~120 PRs long (was ~115; §3.19 added 5 to critical path: B1→B3→C6→C7 plus parallel adapter dependencies). At a sustained throughput of 5-6 PRs/week on the critical path with AI agent parallelism on independent branches, the chain completes in ~22-24 weeks of critical-path engineer time. Total elapsed time including gate-acceptance demos + slack = 50 weeks.

**§3.19 universal customization override is on the critical path because every pack-shipped workflow / form / automation rule that customers will customize requires the override engine + classifier + scanner to be in place BEFORE the pack ships in G1.** Per founder direction (2026-05-18): "platform capabilities must all be ready before the pack work starts" — §3.19's completion at end of G0c (week 17) is binding.

## 14. Risk register (HIGH risks only; full list in spec §7)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| task_projection lag under burst load (§3.2 circuit breaker fails) | M | HIGH | Tombstones + reconciliation job + 10B-observation scale-rig in G6; PR-029 circuit breaker is non-negotiable G0b gate |
| Live integrations gated on vendor sandbox access | H | M | Certified-simulator rule (§5.3 live-integration rule): every adapter ships in both modes; gates pass on simulator |
| AVA hallucination on synthesized FormDefinition | M | HIGH | §13.9 validator synthesis-mode caps (20 fields / depth 3 / vocabulary check) + canon §12 trust progression Suggest→Preview→Execute |
| Cross-pack signature_chains row corruption | L | CRITICAL | §3.6 Plan Fix 41 linearization via pg_advisory_xact_lock; concurrent batch test PR (per §13.7 PR-3) |
| Mobile primitive parity drift | M | M | §3.7 ui-primitive-parity-check scanner blocks asymmetric exports at CI |
| Hospital pilot site dead-zone exceeding offline budget | L | HIGH | G6 PR-248 on-site test in MRI-adjacent area; if fails, escalate Elevator Mode hardening before G6 close |
| Vendor invoice reconciliation false-positive variance flagging | M | M | Tolerance configurable per pack (§3.16 G17.x); AP clerk override path with reason code in MQ-#29 |
| NAC quarantine triggering on clinical-critical asset | L | CRITICAL | §3.18 G19.3 validator + clinical_criticality_score > 70 hard refusal; PR-171 acceptance is the gate |
| Spec-vs-implementation drift over 50 weeks | M | M | Every PR cross-references its §X.Y spec section + pack-validator catches drift at install |
| External team merges to phase4 branch (recurring observation) | H | M | Worktree isolation for design-spec PRs; pack-implementation PRs go through standard PR review |
| §3.19 customization override classifier produces false-positive red on legitimate yellow rename | M | HIGH | `migration_manifest.yaml` rename-hint format declared in §13.20 PR-12 (G20.4 validator); upgrade can be force-overridden by operator with audit row in extreme cases; classifier shipped with 17 fixture-tested scenarios covering rename / removal / signature-change / side-effect-change |
| §3.19 customer override applies to a transition the pack later marks override_policy=false (regression) | L | M | Validator at upgrade time treats this as red; customer notified; remediation: deactivate override, re-author per new policy. Pack authors cannot tighten override_policy on a previously-overridable artifact without a green→red migration acknowledgment |
| §3.19 G0c absorbs G0b slip → cascading slip into G1 | M | HIGH | G0c slack = 0 by design; if §3.19 PRs C1-C7 slip into week 18, push G1 to week 19. Pack work cannot begin until §3.19 fully ready per founder direction 2026-05-18. |

## 15. Slip budget per gate

| Gate | Critical PRs | Slack PRs allocated | Slip absorb capacity |
|---|---:|---:|---|
| G0a | 28 (incl. 3 pre-flight) | 1 | 1 PR slip = 1 week slip; no buffer |
| G0b | 47 (41 + 6 §3.19 PRs B1-B6) | 5 (down from 11; §3.19 absorbed 6) | ~1 week slip absorbed within gate; tighter than original G0b plan |
| G0c | 45 (38 + 7 §3.19 PRs C1-C7) | 0 | None (very tight gate) — pre-allocate from G0b slack OR extend by 1 week (push G1 from week 18 → week 19) if needed |
| G1 | 28 | 0 | None — G1 has dense pack work; consider extending to 7 weeks if PR throughput < target |
| G2 | 35 | 3 | Modest |
| G3 | 11 | 11 | Largest slack — recovery window after dense G2 |
| G4 | 14 | 8 | Modest |
| G5 | 7 | 9 | Modest |
| G6 | 7 | 6 | Final polish |

**Gate-slip protocol (per §5.3):** Gate slip → re-baseline ALL downstream gates' target weeks before proceeding. Do NOT compress later gates to absorb earlier slip; that path leads to G6 cratering at demo time.

## 16. Implementation phase preconditions

Before PR-001 ships, all of the following MUST be true:

1. ✅ All 19 substrate worked examples specified at artifact level (§13.2-§13.20) — §3.1-§3.18 landed `78ed4d3`; §3.19 added 2026-05-18
2. ✅ All 4 pack composition specs landed (§14.1-§14.4) — landed at `78ed4d3`
3. ✅ All 30 workflow state-machine deep dives complete (§15.1-§15.4) — landed at `78ed4d3`
4. ✅ All 35 marquee end-to-end specs landed (§16.1-§16.8) — landed at `78ed4d3`
5. ✅ **§1.1 precondition #1 cleared** — W2 Stream 1 role-code/role-id auth resolution + migration/package coherence + 13-scanner baseline green. Evidence: tag `phase3-w2-complete` (commit `fe71976`), merged to master via PR sequence closing 2026-05-17.
6. 🔄 **§1.1 preconditions #2 + #3 embedded as G0a pre-flight PRs A1/A2/A3** (see §3 above) — no longer separate operator action items; they are the first executable PRs.
7. 🔄 **§3.19 universal customization override embedded as G0b PRs B1-B6 + G0c PRs C1-C7** — all 9 surface adapters + upgrade classifier + scanner must be green by G0c close before G1 pack work begins. Founder direction 2026-05-18: "platform capabilities must all be ready before the pack work starts."
8. ✅ **Canon amendments listed in §8 of design spec** — each substrate worked example commits its canon amendment as part of its final PR (§13.7 PR-6 commits canon §32; §13.8 PR-8 commits canon §33; §13.20 PR-13 commits canon §45). Drafts already inline in the design spec's §24 amendment ledger. Per-substrate PRs land them incrementally; no separate pre-G0a canon work needed.

**Status:** All preconditions ✅ or embedded in PR sequence. **G0a is startable.** Pre-flight PRs A1+A2+A3 are the first 3 PRs of week 1; substrate PR-001 (taskable capability) lands when A3 acceptance memo is signed. §3.19 customization override completion (PR-C7) is the latest substrate gate before G1 begins (week 18).

## 17. Notes for AI agent execution

AI agents executing this plan SHOULD:

- Cross-reference every PR's §X.Y.Z spec section in the PR description (one click to spec) before writing code
- Run the full CI scanner suite (`npm run` permutations: `audit:check`, `service-boundary:check`, `permission-registry:check`, `route-boundary:check`, plus the new scanners introduced per substrate: `ui-primitive-parity-check`, `elevator-mode-check`, `egress-enforcer-check`, etc.) on every PR
- Honor every spec section's "Founder-correctable defaults (proposed)" notes — these are the design decisions the founder may override before code lands; flag them explicitly in PR review
- For each marquee implementation PR, create the fixture file at `apps/api/test/fixtures/marquees/mq-NN-<slug>.json` BEFORE writing implementation code (test-first per the marquee acceptance assertions)
- For each substrate PR, ship the scanner self-test extension AS PART OF THE PR — never as a follow-up

AI agents executing this plan MUST NOT:

- Skip the canon §10 audit-in-transaction commitment (every state-changing operation uses `withAudit(...)`)
- Skip §3.6 Plan Fix 41 linearization (TypeORM array saves of `AuditLog` or `signature_chains` are forbidden)
- Skip §28 evaluator paths in favor of "admin bypass" anywhere
- Introduce new TODOs/FIXMEs (canon §1 greenfield rule)
- Bypass §3.18 NAC dual-confirmation in any code path that calls `nac-quarantine.quarantine_asset`

## 18. Document maintenance

This plan is a living document. As PRs land, mark them ✅ in the per-gate tables. When the design spec is amended (e.g., new canon section), update the corresponding "Spec ref" column. The plan's "Depends" column is the authoritative source for cross-PR ordering during execution.

**Status:** Implementation-ready as of `78ed4d3` (2026-05-17). **§1.1 preconditions cleared 2026-05-17** (precondition #1 by W2 wave completion; preconditions #2 + #3 embedded as pre-flight PR-A1/A2/A3 at start of G0a). **§3.19 universal customization override added 2026-05-18** (covers the customization-vs-upgrade moat across all 9 surfaces; embedded as G0b PRs B1-B6 + G0c PRs C1-C7 per founder direction "platform capabilities must all be ready before the pack work starts"). **G0a is startable.** Next operator action: kick off G0a pre-flight PR-A1 (pack-validator capability contract extension).
