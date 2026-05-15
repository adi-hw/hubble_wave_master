# Phase 3 Prelude Stream 3 — Deletion Ledger (Proposed)

**Status:** FINALIZED — approved entries marked [x]. Deferred entries (A4, A7, D3) retained with founder rationale. B1 awaits per-hook verification.
**Finalized:** 2026-05-14
**Author:** adi-hw
**Date:** 2026-05-14
**HEAD when assembled:** `8011d02 phase3-prelude: remove residual compatibility shims`

Each entry lists: target path, rationale, replacement state.
The founder approves by ticking `[ ]` → `[x]` (or removes the entry to reject).
Conditional / deferral items are marked **[CONDITIONAL — SEE CAVEAT]** and default unchecked.

---

## Category A: Backend modules / controllers / DTOs

*Source: Task 20 findings.*

---

### A1. `apps/svc-{10 sibling dirs}/` — untracked Phase D scaffolding

- [x] APPROVED: Approve deletion of all 10 untracked `svc-*` directories listed below.
- **Status:** Fully untracked (0 git-tracked files each). Present on disk only.
- **Rationale:** Phase 1 thin-adapter / Phase D distributed-services scaffolding. The arc-w1-complete tag consolidated all instance-plane business logic into the modular monolith at `apps/api/`. These directories contain stubs (`.env`, `src/instrumentation.ts`) left over from the pre-monolith service topology. They are invisible to git, but their presence on disk creates confusion and risks accidental execution.
- **Replacement state:** Full functionality lives in the `apps/api/src/app/{area}/` modules listed below.
- **Directories (10 total):**
  | Directory | Replacement in `apps/api/src/app/` |
  |---|---|
  | `apps/svc-automation/` | `automation/` |
  | `apps/svc-ava/` | `ava/` |
  | `apps/svc-control-plane/` | `apps/control-plane/` (separate tracked app) |
  | `apps/svc-data/` | `data/` |
  | `apps/svc-insights/` | `analytics/` |
  | `apps/svc-instance-api/` | monolith root (`apps/api/`) |
  | `apps/svc-notify/` | `notifications/` |
  | `apps/svc-view-engine/` | `views/` |
  | `apps/svc-workflow/` | `automation/` (canon §8 INVERT — one engine) |
  | `apps/svc-control-plane/` | `apps/control-plane/` |

**CRITICAL EXCLUSION:** `apps/svc-migrations/` is NOT in this list. It is a tracked, active Kubernetes Job migration runner referenced in `.github/workflows/cd.yml`, `.github/workflows/release.yml`, and `libs/instance-db/src/lib/instance-db.module.ts`. It must not be touched.

---

### A2. `apps/svc-identity/` — SEPARATE APPROVAL (canon §29.9 conflict)

- [x] APPROVED: Approve deletion of `apps/svc-identity/`.
- **Status:** Untracked. 10 substantive files on disk under `src/app/service-tokens/`.
- **Rationale:** Contains a `service-tokens/` sub-module implementing the ADR D1c RS256 OAuth path (`POST /v1/oauth/token`, `GET /.well-known/jwks.json`). Canon §29.9 explicitly forbids RS256 everywhere. This surface has no git-tracked migration, no entity registration in `libs/instance-db`, and no tracked importer. It is dead code that also represents a latent architectural violation — RS256 signing code in the repo, even untracked, is drift that could be accidentally resurrected.
- **Replacement state:** Canonical service-token path is `POST /internal/service-token` in `apps/api/src/app/identity/` + `KeySigningService` (ES256/KMS).
- **Specific files (10):** `jwks.controller.ts`, `oauth-token.controller.ts`, `service-account.service.ts`, specs, `.env`, `src/instrumentation.ts`.

---

### A3. `apps/svc-metadata/` — SEPARATE APPROVAL (large surface, v1 API risk)

- [x] APPROVED: Approve deletion of `apps/svc-metadata/`.
- **Status:** Untracked. 22 substantive files on disk.
- **Rationale:** Contains a full v1 synchronous-read API surface (`apps/svc-metadata/src/app/v1/` — controllers, services, openapi spec) targeting the svc-metadata separate-process architecture superseded by the monolith. References `@hubblewave/service-auth` (ADR D1c RS256 path — canon §29.9 violation). The `api/openapi.yaml` and `api/README.md` describe svc-metadata as a separate process, which conflicts with canon §17 UPDATE (modular monolith).
- **Replacement state:** `apps/api/src/app/metadata/` in the monolith.

---

### A4. `apps/api/src/app/instance-api/identity/auth/identity-auth-alias.controller.ts` — **[CONDITIONAL — SEE CAVEAT]**

- [ ] Approve deletion — **RECOMMENDED DEFERRAL TO W3** (leave unchecked unless explicitly accepting the caveat below)
**FOUNDER DECISION:** Deferred to W3. The alias controller stays until Vite proxy is no longer compatibility infrastructure.
- **Status:** Git-tracked, live, registered in the instance-api module.
- **Rationale:** Mounts `AuthService` at `@Controller('identity/auth')` → `/api/identity/auth/*`. The canonical `AuthController` lives at `@Controller('auth')` → `/api/auth/*`. The Vite proxy in `apps/web-client/vite.config.mts` rewrites `/api/identity` → `/api`, so web-client calls work against the canonical route during dev. The alias was introduced by Plan Fix 29 to preserve backward compatibility when the parallel HS256 `identity/auth/` path was deleted.
- **CAVEAT:** Deleting this controller makes the Vite proxy the load-bearing path for any direct API consumer that calls `/api/identity/auth/login`. Task 19's smoke test verified both routes work; deleting the alias would break that second route unless the web client is first updated to call `/api/auth/*` directly.
- **Recommendation:** Defer to W3 when `VITE_IDENTITY_API_URL` defaults are aligned and the web client is updated. Approve only if the Vite proxy becoming load-bearing is explicitly acceptable.

---

### A5. `libs/api-clients/identity-client/` and `libs/api-clients/metadata-client/`

- [x] APPROVED: Approve deletion of both libs under `libs/api-clients/`.
- **Status:** Fully untracked (0 git-tracked files). 20 files on disk total.
- **Rationale:** Generated orval SDK clients targeting the deleted `svc-identity` (`POST /v1/oauth/token`) and `svc-metadata` (`GET /v1/metadata/collections/{id}`) separate-process endpoints — the Phase D distributed-services architecture that was superseded before these libs were committed. Both READMEs reference ADR D1c/D1a and future PRs (D.3a, D.4) that were never started. The `http-mutator.ts` in both throws "transport not yet wired." Zero git-tracked importers.
- **Replacement state:** No replacement — the modular monolith does not need cross-service HTTP clients for internal module communication.

---

### A6. Untracked Phase D scaffolding libs (5 dirs)

- [x] APPROVED: Approve deletion of all 5 untracked libs listed below.
- **Status:** Fully untracked (0 git-tracked files each). All are Phase D ADR work (D1a/D1c/D3a) that pre-dates or was concurrent with arc-w1-complete and was never committed to git.
- **Replacement state:** Capabilities exist natively in `apps/api/` modules.

| Library | Files on disk | Capability | Monolith replacement |
|---|---|---|---|
| `libs/automation-runtime/` | 14 | `ConditionEvaluatorService`, `ScriptSandboxService`, `ActionHandlerService` | `apps/api/src/app/automation/runtime/` |
| `libs/http-client/` | 23 | Cross-service HTTP transport with circuit breakers, OTel propagation, service-token acquisition | Internal NestJS DI — no cross-service HTTP needed |
| `libs/observability/` | 19 | OpenTelemetry tracing + log correlation (ADR D1b) | Monolith instrumentation handled differently |
| `libs/metadata-reader/` | 18 | Shadow-mode metadata reader chain for cross-domain DB→HTTP migration (ADR D1a §C) | `apps/api/src/app/metadata/` direct DB access |
| `libs/service-auth/` | 34 | RS256 service-to-service token issuance + validation (ADR D1c) | Canon §29 ES256/KMS `KeySigningService` |

**Note on `libs/service-auth/`:** Only referenced in JSDoc comments in `libs/instance-db/src/lib/entities/service-token.entity.ts` (untracked file). Zero runtime coupling. Deleting it closes the last RS256 code path outside tracked source (alongside A2 and A3 above).

---

### A7. `phase7/` naming violations — **[RENAME, NOT DELETE — separate decision]**

- [ ] Approve rename pass for `phase7/` directories and `@ApiTags('Phase 7 - ...')` strings
**FOUNDER DECISION:** Rename conceptually approved but execution deferred to W3 (SDK/runtime stabilization wave). Not Prelude scope.
- **Status:** Tracked, live, wired into `AvaModule`. This is NOT a deletion — the controllers contain real business logic.
- **Canon violation:** Canon §1 prohibits lifecycle/version/phase naming. The `phase7/` directory name and `@ApiTags('Phase 7 - ...')` strings in 11 controllers violate this rule.
- **Affected files (12 total):** `apps/api/src/app/ava/phase7/` (11 controllers + 1 barrel) and `apps/web-client/src/features/phase7/` + `apps/web-client/src/services/phase7Api.ts`.
- **Recommendation:** Author a rename commit (phase7 → canonical feature-domain names). This is out of Stream 3 deletion scope but requires explicit approval to track. If approved, target W3.
- **Proposed canonical renames:**
  | Current | Proposed |
  |---|---|
  | `phase7/` (api ava dir) | `ai-features/` or split by domain |
  | `phase7/` (web-client features dir) | `ai-features/` or split by domain |
  | `phase7Api.ts` | `aiAssistantApi.ts` or domain-split files |
  | `@ApiTags('Phase 7 - ...')` | Domain-specific tag per controller |

*Both Tasks 20 and 21 flagged this independently. Consolidated here as a single rename decision.*

---

## Category B: Frontend surfaces

*Source: Tasks 21 and 22 findings.*

---

### B1. 9 unused hooks in `apps/web-client/src/hooks/`

- [ ] Approve deletion of all 9 hook files listed below.
**FOUNDER DECISION:** Conditionally approved. Per-hook visual/manual verification required during Task 27. Any hook that is dynamically imported, Storybook-only, or indirectly referenced stays. Final delete/keep list is determined by the Task 27 audit pass; the audit's hook-by-hook conclusions will be appended to docs/superpowers/plans/prelude-deletion-proof.md.
- **Status:** Git-tracked. Zero importers outside each file's own definition (confirmed via codebase-wide `git grep`).
- **Rationale:** These hooks are defined but never consumed. Canon §14 ("delete ruthlessly") and §1 (no dead code) require removal.

| File | Symbol(s) | Canonical replacement |
|---|---|---|
| `apps/web-client/src/hooks/useBreadcrumbs.ts` | `useBreadcrumbs` | None found in use |
| `apps/web-client/src/hooks/useBreakpoint.ts` | `useBreakpoint`, `useBreakpointDown` | None found in use |
| `apps/web-client/src/hooks/useDarkMode.ts` | `useDarkMode` | `useThemePreference` (13 importers) |
| `apps/web-client/src/hooks/useLabels.ts` | `useLabels` | None found in use |
| `apps/web-client/src/hooks/useNavigationCommands.tsx` | `useNavigationCommands` | CommandPalette derives from nav API |
| `apps/web-client/src/hooks/usePermissions.ts` | `usePermissions` | `useProfile` + `ProtectedRoute` pattern |
| `apps/web-client/src/hooks/usePreferencesSync.ts` | `usePreferencesSync` | None found in use |
| `apps/web-client/src/hooks/useTableMetadata.ts` | `useTableMetadata` | Re-exports `useCollectionMetadata` — the canonical hook has its own importers |
| `apps/web-client/src/hooks/useThemeTokens.ts` | `useThemeTokens` | `useThemePreference` (13 importers) |

**Founder note:** `useBreakpoint` and `useDarkMode` sound like they should be in use. The `git grep` returned zero importers, but a quick visual check before deletion is recommended.

---

### B2. `apps/web-client/src/services/modules.service.ts`

- [x] APPROVED: Approve deletion.
- **Status:** Git-tracked. Zero importers outside its own file.
- **Rationale:** `modulesService` calls `/modules` endpoint. No backend controller implementing `GET /modules` was found in `apps/api/`. The service is unconnected at both ends.
- **Replacement state:** No replacement — the endpoint does not exist in the monolith.

---

### B3. `apps/web-client/src/features/commitment/` (4 components + API service)

- [x] APPROVED: Approve deletion of all 5 files listed below.
- **Status:** Git-tracked. No route in `app.tsx`. No backend controller (`git grep` for `commitment` in `apps/api/src/` returns nothing). Zero consumers outside the directory itself.
- **Rationale:** Unrouted, unwired feature with no backend. Speculative scaffolding — canon §1 prohibits it.
- **Replacement state:** No replacement — this feature was never shipped.
- **Files:**
  - `apps/web-client/src/features/commitment/components/BusinessScheduleEditor.tsx`
  - `apps/web-client/src/features/commitment/components/CommitmentBadge.tsx`
  - `apps/web-client/src/features/commitment/components/CommitmentPanel.tsx`
  - `apps/web-client/src/features/commitment/components/CommitmentWidget.tsx`
  - `apps/web-client/src/services/commitmentApi.ts`

---

### B4. `libs/ui-components/` — already in dead-code-allowlist

- [x] APPROVED: Approve deletion (closes `owedTo: W4` allowlist entry).
- **Status:** Git-tracked. Already in `tools/dead-code-allowlist.json` with `owedTo: W4`. Zero importers of `@hubblewave/ui-components` anywhere in the codebase.
- **Rationale:** Library contains local copies of components that have live canonical implementations in `apps/web-client/src/components/`. The lib is entirely superseded and its allowlist entry should be closed rather than perpetuated.
- **Files (6):** `DataPillPicker.tsx`, `DataPillButton.tsx`, `ConditionBuilder.tsx`, `CodeEditor.tsx`, `ApplicationPicker.tsx`, `useDataPillCategories.ts`.
- **Replacement state:** Live copies at `apps/web-client/src/components/data-pill/` and `apps/web-client/src/components/access/ConditionBuilder.tsx`.

---

### B5. `libs/enterprise/` — already in dead-code-allowlist

- [x] APPROVED: Approve deletion (closes `owedTo: W4` allowlist entry).
- **Status:** Git-tracked. Already in `tools/dead-code-allowlist.json` with `owedTo: W4`. Zero importers of `@hubblewave/enterprise` outside the lib itself.
- **Rationale:** `EnterpriseModule`, `SSOService`, `AuditService`, `ComplianceService`, `saml-assertion-gate.ts` were superseded by W1: live SSO path lives in `apps/api/src/app/identity/oidc/`; audit path uses `withAudit()` in `libs/instance-db`. The lib is dead.
- **Replacement state:** `apps/api/src/app/identity/oidc/` (SSO), `libs/instance-db/src/lib/` (audit).

---

### B6. 4 orphan `phase7` barrel exports (dead components)

- [x] APPROVED: Approve deletion of 4 component files and their barrel re-exports.
- **Status:** Git-tracked. Exported from `apps/web-client/src/features/phase7/index.ts` barrel but never imported by any route or shell component (confirmed via `git grep`).
- **Rationale:** These components duplicate canonical implementations in `features/voice/` and `features/predictive/`. They are dead exports in the phase7 barrel — the canonical replacements are used instead.
- **Files:**
  - `apps/web-client/src/features/phase7/voice-control/VoiceControlPanel.tsx` (duplicate of `features/voice/VoiceControlPanel.tsx`)
  - `apps/web-client/src/features/phase7/voice-control/VoiceControlButton.tsx` (duplicate of `features/voice/` implementation)
  - `apps/web-client/src/features/phase7/predictive-ui/PredictiveUIPanel.tsx` (duplicate of `features/predictive/` implementation)
  - `apps/web-client/src/features/phase7/predictive-ui/PredictiveUIButton.tsx` (duplicate of `features/predictive/` implementation)
- **Note:** The barrel re-exports for these 4 symbols in `phase7/index.ts` must also be removed when the files are deleted.

*Task 22 flagged these 4 as orphan menu exports. Task 21 confirmed no importers. Consolidated here.*

---

## Category C: Navigation / actions / feature flags

*Source: Tasks 22 and 23 findings.*

---

### C1. Orphan `studio.views` nav node — follow-up migration required

- [x] APPROVED: Approve authoring a follow-up DELETE migration to remove the orphan `studio.views` navigation entry.
- **Status:** The `studio.views` node is seeded by migration `1819000000000-seed-default-navigation-module.ts` into `navigation_module_revisions`. No `<Route path="/studio/views">` exists in `apps/web-client/src/app/app.tsx`. Views are accessed via `/studio/collections/:id/views` (per-collection context), not a standalone `/studio/views` listing.
- **Rationale:** An orphan nav node produces a dead menu entry that navigates to a 404. Users clicking it in the sidebar will see a blank/broken page.
- **Action:** Author migration (suggested name: `1943000000000-remove-orphan-studio-views-nav-node.ts`) that removes the `studio.views` entry from the published `navigation_module_revisions` layout JSON. The node is a child of the `studio` group; the migration SQL must recurse into the `children` array.
- **Replacement state:** No replacement — the route does not exist. Views are per-collection only.

---

### C2. Feature flags

- (no entry)
- **Finding:** The codebase has no feature-flag infrastructure whatsoever. Canon §12's trust progression (Suggest → Preview → Approve → Execute → Audit) is convention-only (Plan Fix 16 deferred). Zero stale flags to delete. Nothing to action.

---

## Category D: Seed data + follow-up migrations

*Source: Task 23 findings.*

---

### D1. `scripts/seed-platform-knowledge.ts` + `package.json` `seed:knowledge` entry

- [x] APPROVED: Approve deletion of the script and removal of the npm script entry.
- **Status:** Git-tracked. Wired to `npm run seed:knowledge` in `package.json`.
- **Rationale:** The script inserts `document_chunks` rows with `sourceType = 'platform_docs'`. `VectorStoreService.DocumentChunk.sourceType` is a discriminated union restricted to `'knowledge_article' | 'catalog_item' | 'record' | 'comment' | 'attachment'` — `'platform_docs'` is not in the union. Rows inserted by this script are **phantom rows** — invisible to any typed query through `VectorStoreService`. Additionally, the content is ITSM-domain ServiceNow-style knowledge (Incident Management, Service Request, Change Management) that does not match the platform's current vertical.
- **Replacement state:** `libs/ai/src/lib/platform-knowledge.service.ts` provides platform self-knowledge via code rather than DB rows (already exists). Any future platform-knowledge seeding must use a `DocumentChunk` source type in the canonical union.
- **Actions (two parts):**
  1. Delete `scripts/seed-platform-knowledge.ts`.
  2. Remove the `seed:knowledge` script entry from `package.json`.

---

### D2. `nav_nodes` duplicate rows — follow-up dedup migration

- [x] APPROVED: Approve authoring a follow-up dedup migration for `nav_nodes`.
- **Status:** Migration `1807000000000-seed-default-navigation.ts` uses `ON CONFLICT DO NOTHING` with `uuid_generate_v4()` IDs for child node inserts. Since `uuid_generate_v4()` generates a new UUID on each run, the conflict clause can never fire — repeated migration runs produce duplicate rows in `nav_nodes`.
- **Rationale:** Data quality defect. Duplicate nav nodes cause multiple identical entries in the navigation sidebar.
- **Action:** Author a dedup migration: `DELETE FROM nav_nodes WHERE ctid NOT IN (SELECT min(ctid) FROM nav_nodes GROUP BY key, profile_id)`.
- **Note:** The migration content itself is not a deletion candidate — it seeds valid routes. Only the duplicate rows need cleanup.

---

### D3. `cross-domain-read-diff` table — conditional evaluation

- [ ] Approve evaluation of `cross-domain-read-diff` table status (CONDITIONAL — see below)
**FOUNDER DECISION:** Do NOT drop the table or entity in Prelude. Table removal requires later proof of: no runtime writes, no subscribers depend, no operational use, shadow-mode formally closed. In Task 27, ONLY clean the canon-§1 violating comment/migration language in 1942000000000-cross-domain-read-diff-table.ts — leave table and entity intact.
- **Status:** Migration `1942000000000-cross-domain-read-diff-table.ts` contains migration-era language ("migration window", "legacy DB read alongside a new cross-service HTTP read") violating canon §1. The table `cross_domain_read_diff` IS live and referenced by `libs/instance-db/src/lib/entities/cross-domain-read-diff.entity.ts` and `libs/instance-db/src/lib/subscribers/metadata-cache-invalidation.subscriber.ts`.
- **CAVEAT:** This item requires a judgment call: if the shadow-mode diffing operation it supports is complete, both the table and migration are deletion candidates. If the diff operation is still in progress or planned, only the comment language needs updating.
- **Conditional actions:**
  - If shadow-mode diff is **complete:** author a migration to `DROP TABLE cross_domain_read_diff` and delete the entity file.
  - If shadow-mode diff is **ongoing:** update the migration JSDoc to remove "migration window" / "legacy" language (canon §1 compliance only; no structural change).
- **Replacement state:** N/A if dropped; the diff table has no business-logic replacement.

---

## Category E: Repository hygiene

*Source: Task 24 findings.*

---

### E1. `apps/web-client/src/types/navigation-legacy.ts.bak`

- [x] APPROVED: Approve deletion.
- **Status:** Git-tracked. Not imported anywhere in the codebase (zero `import`/`require` references found).
- **Rationale:** A `.bak` file containing TypeScript interface definitions (`NavItem`, `NavSection`, `NavigationResponse`) superseded by the live `navigation.ts` next to it. Tracked `.bak` files are canon §1 violations (dead code).
- **Replacement state:** `apps/web-client/src/types/navigation.ts` (live, richer type set).

---

### E2. 5 tracked `tmpclaude-*` session breadcrumb files

- [x] APPROVED: Approve deletion of all 5 tracked session breadcrumb files listed below.
- **Status:** Git-tracked. Each file contains a single absolute directory path as text — these are Claude Code session CWD markers accidentally committed. They carry no code, no tests, no configuration.
- **Rationale:** Session debris. Canon §1 (no dead code). Already in `tools/dead-code-allowlist.json` with `owedTo: W4`. Plan Fix 36 already deleted `scripts/tmpclaude-8c30-cwd`; these 5 remain.
- **Files:**
  | Tracked path | Content (directory it points to) |
  |---|---|
  | `apps/tmpclaude-4824-cwd` | `/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/HW Platform/apps` |
  | `libs/control-plane-db/src/lib/entities/tmpclaude-2d01-cwd` | `.../libs/control-plane-db/src/lib/entities` |
  | `migrations/control-plane/tmpclaude-c11b-cwd` | `.../migrations/control-plane` |
  | `migrations/tmpclaude-fe69-cwd` | `.../migrations` |
  | `tools/tmpclaude-0e02-cwd` | `.../tools` |
- **Note:** Deleting these also removes their entries from `tools/dead-code-allowlist.json`.

---

### E3. `.env.example` — dead / mismatched variable names (corrections only, no deletions)

- [x] APPROVED: Approve 3 corrections to `.env.example` listed below.
- **Status:** Git-tracked. Mismatch between `.env.example` variable names and the names the source code actually reads.
- **Actions (3 items):**

  | Action | Variable | Detail |
  |---|---|---|
  | **Delete line** | `PACK_SIGNING_DEV_SKIP` | Zero references in any `.ts` file — the variable is not read by any source. |
  | **Rename line** | `VLLM_API_URL` → `VLLM_BASE_URL` | Code reads `VLLM_BASE_URL` (see `libs/ai/src/lib/providers/vllm.provider.ts:49`). The current `.env.example` line documents the wrong name. |
  | **Rename line** | `PACK_SIGNING_PUBLIC_KEY` → `PACK_SIGNING_PUBLIC_KEYS` | Runtime code reads the plural form (`packs.service.ts:2266`). Scripts `generate-local-dev-secrets.ts` and `generate-pack-signing-keypair.ts` also need updating. |

- **Items NOT changed:**
  - `JWT_SECRET` and `IDENTITY_JWT_SECRET` — marked deprecated in `.env.example` but `apps/control-plane` still reads them (non-deprecated path). Leave as-is.

---

### E4. `.env.example` — missing variable documentation (additions only)

- [x] APPROVED: Approve additions of 6 missing variable entries to `.env.example`.
- **Status:** Variables are used in source code but absent from `.env.example`, creating a silent failure mode for new developers.
- **Variables to add:**

  | Variable | Used in |
  |---|---|
  | `VLLM_BASE_URL` | `libs/ai/src/lib/providers/vllm.provider.ts`, `scripts/setup.ts` |
  | `DIRECT_DB_HOST` | `libs/instance-db/src/lib/instance-db.module.ts` (W6.C PgBouncer migration-runner) |
  | `DIRECT_DB_PORT` | `libs/instance-db/src/lib/instance-db.module.ts` |
  | `DIRECT_CONTROL_PLANE_DB_HOST` | `libs/control-plane-db/src/lib/control-plane-db.module.ts` |
  | `DIRECT_CONTROL_PLANE_DB_PORT` | `libs/control-plane-db/src/lib/control-plane-db.module.ts` |
  | `OLLAMA_BASE_URL` | `libs/ai/src/lib/providers/vllm.provider.ts` |
  | `OLLAMA_API_KEY` | `libs/ai/src/lib/providers/vllm.provider.ts` |

- **Note:** `VLLM_BASE_URL` addition here is coordinated with the rename in E3 — same variable, two complementary actions.

---

## Summary table

| Category | Total items proposed | Conditional / deferral | Already-allowlisted |
|---|---|---|---|
| A: Backend | 7 | 2 (A4 alias controller; A7 rename) | 0 |
| B: Frontend | 6 | 0 | 2 (B4 ui-components, B5 enterprise) |
| C: Nav/Flags | 1 nav follow-up migration | 0 | 0 |
| D: Seed | 3 | 1 (D3 cross-domain-diff conditional) | 0 |
| E: Hygiene | 4 | 0 | 5 (E2 tmpclaude files) |
| **Total** | **21** | **3 conditional** | **7 already-allowlisted** |

**Total checkboxes (discrete approval decisions): 21**

---

## Notes for founder

### 1. `phase7` naming (Category A7, B6) — rename, not delete
The `phase7/` directories in both `apps/api/src/app/ava/phase7/` and `apps/web-client/src/features/phase7/` contain live business logic wired into `AvaModule`. They are not dead — they are naming violations (canon §1: no lifecycle/version naming). The 4 orphan exports in B6 are dead and should be deleted; the remaining `phase7` controllers and pages require a rename pass. This is tracked as A7 as a separate rename decision.

### 2. 9 unused hooks (Category B1) — quick visual check recommended
Some hooks (`useBreakpoint`, `useDarkMode`) sound like they should be in use. The `git grep` returned zero importers, but a visual spot-check before deletion is recommended to confirm they are not wired via dynamic import or used in a way the grep missed.

### 3. Alias controller (Category A4) — recommended deferral to W3
Approving A4 today means the Vite proxy becomes the load-bearing path for `/api/identity/auth/login`. Task 19's smoke test verified both routes; deleting the alias removes the redundancy but shifts correctness responsibility to the proxy configuration. The safe path is to update the web client to call `/api/auth/*` directly first, then delete the alias.

### 4. `apps/svc-identity/` RS256 path (Category A2)
The presence of a `service-tokens/` OAuth sub-module using RS256 — even untracked — is a latent canon §29.9 violation. Deleting it removes the risk of accidental resurrection. This is the clearest high-confidence deletion in Category A.

### 5. `cross-domain-read-diff` table (Category D3)
This is the only item that requires a product-level judgment call: is the shadow-mode diffing it supports complete or ongoing? The answer determines whether this is a deletion or just a comment-cleanup.

### 6. De-duplication across scan tasks
The following items were reported by multiple scan tasks and are consolidated as single entries here:
- `phase7/` naming violations: Tasks 20 + 21 + 22 → consolidated into A7 (rename) + B6 (orphan exports only)
- `apps/svc-identity/` RS256 concern: Tasks 20 → A2 (separate approval item)
- `studio.views` orphan nav: Tasks 22 + 23 → consolidated into C1

Reply with which categories or items you approve. Default = nothing is approved or executed.

---

## Founder Decisions — 2026-05-14

### Approved for Task 27 execution
A1, A2, A3, A5, A6, B2, B3, B4, B5, B6, C1, D1, D2, E1, E2, E3, E4

### Conditionally approved (per-item verification required)
B1 — 9 unused hooks. Per-hook visual/manual verification required during Task 27. Any hook dynamically imported, Storybook-only, or indirectly referenced stays. Audit conclusions append to `docs/superpowers/plans/prelude-deletion-proof.md`.

### Deferred to W3
A4 (alias controller), A7 (phase7 rename)

### Deferred — Prelude does comment-language cleanup only
D3 (cross-domain-read-diff table) — table and entity stay. Only canon-§1 violating comment/migration language in 1942000000000-cross-domain-read-diff-table.ts is cleaned during Prelude.

### Founder-required pre-deletion artifact
Before executing A1, A2, A3, A5, A6 deletions, Task 27 MUST generate `docs/superpowers/plans/prelude-deletion-proof.md` with:
- grep/import graph for each candidate
- Nx dependency graph snapshot
- remaining references count

This artifact commits BEFORE the deletion commit, so the evidence of disconnection survives the deletion.
