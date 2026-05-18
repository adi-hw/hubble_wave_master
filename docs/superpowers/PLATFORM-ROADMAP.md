# HubbleWave Platform Master Roadmap

> **This is the single source of truth.** It supersedes the parallel `docs/plan-fixes/00-master-remediation-roadmap.md` (which lived on a sibling branch and was a separate audit-driven effort) and integrates with our architectural work in `docs/superpowers/specs/2026-05-09-platform-architecture-design.md`.
>
> **Read this file at the start of any session** to understand state, priorities, and what to do next. Update when a new tag lands or a major decision changes.
>
> **Last updated:** 2026-05-17 (after `phase3-w2-complete` — Phase 3 W2 Platform Integrity COMPLETE; tag points at master HEAD)

---

## Phase 3 governance baseline

The Phase 3 roadmap is governed by **`docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md`**. That document supersedes any "Phase 3" framing in this legacy roadmap below. Update sequencing decisions, exit criteria, and scope changes there — not here.

Phase 3 Prelude landed on master via PR #60 (merge commit `0cde604`) on 2026-05-15. The Prelude restored a deterministic runtime baseline before W2 starts: schema split finalized, every entity declares its domain schema, runtime `search_path` bridge removed, compatibility shims deleted, obsolete product surfaces removed via founder-approved deletion ledger, end-to-end validation harness + CI gates wired. See the merge commit + the ledger at `docs/superpowers/plans/2026-05-14-phase3-prelude-stream3-deletion-ledger.md` for what was approved/deferred.

**Phase 3 W2 — Platform Integrity COMPLETE** (2026-05-17, tag `phase3-w2-complete`). Boundary consistency across authz / identity / audit / search / scanner enforcement. Streams 0-3 + Stream 4a + the scoped Stream 4b subset (Tasks 35 / 36 / 40) landed across 16 PRs. The full canon §24 wave summary is in `CLAUDE.md`; the cliffsnotes:

- Identity contract on ES256 cross-plane; `RequestContext` discriminated union; permission registry as source of truth (47 codes, 381 call sites in sync).
- Canon §28 evaluator uniformly applied (admin short-circuit retired everywhere).
- Four primary boundary decorators at 100% across 881 handlers / 28 controllers; `route-boundary:check` hard gate.
- `PermissionsGuard` fails closed (warn-and-allow retired); audit provenance on 403.
- Integration specs for F042 hash chain, F052 AVA chat tx, F146 dashboard widget, search authz corpus/facet/pagination, `permissions.fields` payload contract.
- `w2-validate.ts` boundary-consistency harness wired as a CI step in the prelude-validate job.

Deferred to W3 (explicit follow-ups, see `CLAUDE.md` §24): frontend field-permission wiring + 401/403 UX + SSE invalidation channels (Tasks 37/38/39); service-token scope/ACL in the validate harness; admin role retirement 1s-budget assertion; the `AuthorizationService.getPropertyRules` query path bug.

**Tag `phase3-prelude-complete` points at HEAD `13b55a9`** (advanced from the merge commit through 6 audit-driven cleanups, see below). The tag annotation enumerates scope LIMITS explicitly: this milestone certifies the FOUNDATION only, not Platform Integrity (W2) or full default-deny (W3+).

### Foundation-only — what this milestone does NOT certify

The post-merge audit (2026-05-15) surfaced authz correctness gaps that are real W2 work, not Prelude regressions. They are tracked here for W2 planning intake:

- **Role-code vs role-id mismatch.** `IdentityResolverAdapter.getUserContext` returns role CODES (`r.code`); `AuthorizationService.toAbacPrincipal` falls back to `ctx.roles` as if they were role IDs (UUIDs) when `attributes.roleIds` is absent. Production JWT path mismatches role-based ACL rules; tests inject `attributes.roleIds` and hide the regression. Files: `apps/api/src/app/identity/auth/identity-resolver.adapter.ts:81` ↔ `libs/authorization/src/lib/authorization.service.ts:1369` ↔ `libs/instance-db/src/lib/entities/access-rule.entity.ts`.
- **PermissionsGuard is warn-and-allow on unannotated handlers by design** during the Prelude transition. Coverage is at 207/804 (25.7%); flipping to deny-by-default is W2's milestone, gated on coverage approaching 100%. See `docs/permissions-rollout-coverage.md` for live coverage; the guard's own header doc-comment at `libs/auth-guard/src/lib/permissions.guard.ts:68` records the rationale.
- **Search authz keeps an admin `allow_all` short-circuit** in `apps/api/src/app/ava/search/search-query.service.ts:179`, parallel to canon §28.6's admin-bypass retirement. The search-side bypass has not shipped (W2 scope).
- **Full default-deny is NOT enabled.** `secureFieldsByDefault` defaults `false` on `CollectionDefinition`; property authorization default-allows when the flag is off. Spec §28.9 explicitly defers platform-wide default-deny to W3+.
- **svc-migrations `workspace_modules` is not wired.** The `nx run svc-migrations:prune` target chain fails (executor expects `apps/svc-migrations/package.json` which doesn't exist), so `copy-workspace-modules` doesn't materialize `workspace_modules/` next to `dist/apps/svc-migrations/main.js`. That blocks `migration 1930900000001-backfill-audit-log-hash-chain` from `require('@hubblewave/instance-db')` at runtime in the K8s Job (the other 48 migrations run fine after the post-merge packaging fix).
- **Baseline squash NOT performed.** The committed .ts migration chain (98 instance migrations + 8 control-plane migrations) is preserved as-is. The K8s Job now packages it correctly (post-merge fix at `0ec51fe`), so fresh-DB bootstrap works. A future fresh-baseline squash is W2+ scope per founder direction.

### Post-merge audit-driven cleanups (5 commits on master after `0cde604`)

| Commit | What |
|---|---|
| `d4772c3` | Task 34: roadmap + RESUME-CONTEXT updated for Prelude close (this entry) |
| `07e08ca` | service-boundary regression fix — Task 18 had imported `AuthModule` from `apps/api/src/app/identity/auth/auth.module` into `apps/api/src/app/metadata/access/access.module.ts`, violating the metadata ↔ identity service boundary. Fix: annotate `AuthModule` with `@Global()` so cross-domain consumers get `IDENTITY_RESOLVER_PORT` via DI; remove the cross-service import. Scanner now exits 0. |
| `4e021ac` | authorization tests aligned with Plan Fix 33 (canon §28.6 admin-bypass retirement) — 7 stale 7-arg constructor sites repaired, 1 stale `admins bypass tableName resolution entirely` test rewritten to assert the post-§28.6 reality (admin throws `NotFoundException` for unknown tables like every other role). `nx test authorization` → 115/115. |
| `0ec51fe` | svc-migrations K8s Job packaging fix. Two P0s: (a) `dist/migrations/instance/*.js` never produced — webpack only bundles `main.ts`, not the migration `.ts` files loaded at runtime via TypeORM glob. Fix: new `apps/svc-migrations/tsconfig.migrations.json` + Dockerfile `RUN npx tsc -p apps/svc-migrations/tsconfig.migrations.json` step. (b) `migrationsTransactionMode: 'each'` missing from `apps/svc-migrations/src/main.ts` — without it, the 2 migrations that declare `transaction = false` (jsonb-gin-indexes, search-acl-fields) get rejected at runtime. Fix: mirror `scripts/datasource-instance.ts`. |
| `762dd6b` | InstanceCustomization entity ↔ schema alignment. Migration `1813000000000-upgrade-assistant-tables.ts` recreated `instance_customizations` with snake_case columns + 4 columns the entity didn't model (`instance_id`, `customization_type`, `original_value`, `description`); the codebase wires no `SnakeNamingStrategy` globally, so entity queries failed at runtime with "column configType does not exist". Fix: explicit `name:` overrides on every `@Column` + 4 missing properties added. Sibling entity `ConfigChangeHistory` documented as intentionally retaining its unquoted camelCase columns (from `InitialSchema1766696011515` TypeORM-generated DDL). |
| `13b55a9` | orphan `seed:test-user` npm script removed (pointed at `scripts/seed-test-user.ts` deleted in `a7cac0f`; referenced an `eam_global` schema that predates the HubbleWave rename). 4 stale gitignored `.js`/`.js.map` artifacts deleted from `scripts/` for the same hygiene reason as the libs/ + migrations/ cleanup (282 files removed total — TypeORM was resolving stale `.js` before `.ts` and breaking `migration:show`). |

These were direct-pushes to master (not via PR). The work is small + atomic + each commit is independently revertable. Future substantive code changes should go through the PR workflow per repo convention.

---

## State of play

**Phase 1 is COMPLETE.** All 11 instance/control-plane services have been migrated from `apps/svc-*` into `apps/api` + `apps/control-plane`. The thin-adapter `svc-*` directories have been deleted in the W1 final cutover. CI/CD, helm, scanners, and package.json scripts have been retargeted at the new topology.

| Effort | Status |
|---|---|
| **A — Architectural reshape** (`apps/svc-* → apps/api` + `apps/control-plane`) | **PHASE 1 COMPLETE.** 11/11 instance/control-plane services migrated (~91,000+ LoC consolidated). svc-* thin adapters deleted. `apps/svc-migrations` retained (single-shot K8s Job). |
| **B — Security/correctness audit remediation** | W0 (foundation scanners) + W1 (14 critical fixes) cherry-picked into master via Phase 0 reconciliation. W2–W11 (~120 findings) still owed. |

The originally-diverged W0+W1 security commits from `claude/condescending-shamir-92422b` were path-translated and cherry-picked into the architectural branch (Phase 0, complete). master now contains both the modular monolith and the W0+W1 security baseline. Future security work cherry-picks against the consolidated paths.

---

## Anchor documents

| Doc | Purpose |
|---|---|
| `docs/superpowers/specs/2026-05-09-platform-architecture-design.md` | Approved canonical spec (architecture, customization moat, mobile, AI Code Assistant). Founder-locked decisions live here. |
| `docs/superpowers/RESUME-CONTEXT.md` | Quick start for a fresh session — read first. |
| `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md` | Foundation plan (executed) |
| `docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md` | Identity migration plan (executed) |
| `docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md` | Metadata migration plan (executed) |
| `docs/superpowers/plans/2026-05-10-platform-w1-data-migration.md` | Data migration plan (executed) |
| `docs/superpowers/plans/2026-05-10-phase0-branch-reconciliation.md` | Phase 0 branch reconciliation plan (executed) |
| **(this file)** | Master roadmap that sequences all remaining work across both efforts |
| `CLAUDE.md` | The canon (amended through `arc-w0-complete`). Authoritative on rules. |
| `apps/api/src/app/identity/identity.module.ts` | Migration progress checklist for identity (15 sub-modules ✓) |
| `apps/api/src/app/metadata/metadata.module.ts` | Migration progress checklist for metadata (23 sub-modules ✓) |
| `apps/api/src/app/data/data.module.ts` | Migration progress checklist for data (12 sub-directories ✓) |

---

## Locked decisions (do not re-litigate)

From the spec + founder direction (2026-05-09):

| Decision | Source |
|---|---|
| Modular monolith — apps/api + apps/worker + apps/control-plane + apps/web-client + apps/mobile | Spec §2 |
| React Native + Expo for mobile, Day 1 | Founder lock 2026-05-09 |
| §5 SOFTEN — single-tenant default + pooled (RLS) mode | Canon §5 amendment, founder lock 2026-05-09 |
| AI Code Assistant Day 1 (Cursor/Copilot for plugin/formula/automation/integration/workspace/analytics authoring) | Founder lock 2026-05-09 |
| UI Builder full page authoring (ServiceNow UI Builder competitor) | Founder lock 2026-05-09 |
| Vertical pack (Clinical/Facilities Asset Management) deferred | Spec §4.2; Appendix D inventory only |
| Solo founder, ~10–12 months critical path | Spec §8 |

---

## What's done

### Effort A — architectural (13 tags, all consolidated into master)

| Tag | HEAD | What |
|---|---|---|
| `arc-w0-complete` | `d3dede3` | Canon amendments §5/§7/§8/§11/§12/§17/§19/§21 + new §17.5/§25/§26/§27 + apps/api & worker scaffolds |
| `arc-w1-foundation-partial` | `bffef2f` | kernel + db + audit module wrappers in apps/api (re-exports from libs/instance-db) |
| `arc-w1-identity-complete` | `8710e79` | All 15 svc-identity sub-modules + 3 top-level files → apps/api/identity (~17,200 LoC; cyclic-core bundle for auth+abac+ldap+roles) |
| `arc-w1-metadata-complete` | `0b2f0d9` | All 23 svc-metadata sub-modules + 7 top-level files → apps/api/metadata (~21,200 LoC) |
| `arc-w1-data-complete` | `d10f0d9` | All 12 svc-data sub-directories + 9 top-level files → apps/api/data (~17,700 LoC). Mid-stream service-file move pattern handled cross-deps cleanly. |
| `arc-reconciled-with-w1-security` | `fbb640b` | 27 W0+W1 security commits cherry-picked from `claude/condescending-shamir-92422b` with path-translation for migrated services (LDAP F011, packs SSRF F125+F126, ESLint F104). |
| `arc-w1-automation-complete` | `2d77402` | svc-automation runtime + sync-trigger + scheduling + AVA + CRUD → apps/api/automation (~6,000 LoC, cyclic-core bundle) |
| `arc-w1-ava-complete` | `01e2dbe` | svc-ava core + governance + reasoning → apps/api/ava (~8,000 LoC, clean DAG) |
| `arc-w1-workflow-complete` | `39e260b` | svc-workflow folded into apps/api/automation/workflow per canon §8 INVERT (~3,000 LoC) |
| `arc-w1-control-plane-complete` | `86e9ca1` | svc-control-plane → apps/control-plane (NEW Nest app, multi-tenant per canon §18, ~6,000 LoC, 2 cyclic-core bundles) |
| `arc-w1-foldins-complete` | `4fd1cfd` | svc-view-engine → apps/api/views; svc-notify → apps/api/notifications; svc-instance-api → apps/api/instance-api; svc-insights → apps/api/analytics (~6,500 LoC across 4 services) |
| `arc-w1-complete` | (latest) | **PHASE 1 FINAL CUTOVER.** Deleted all 11 svc-* thin adapters. Retargeted CI/CD matrix (api, control-plane, svc-migrations, web-client, web-control-plane), helm chart (single `api` deployment), scanners (`MIGRATED_AREAS` → `SERVICE_AREAS`; INSTANCE_SERVICES collapsed; svc-* PUBLIC_ALLOWLIST entries removed), package.json (`dev:*` scripts trimmed). |

**Cumulative**: 11 of 11 instance/control-plane services consolidated into apps/api + apps/control-plane (~91,000+ LoC across 273+ files via `git mv` with history preserved). Only `apps/svc-migrations` remains (single-shot K8s Job for instance DB migrations).

### Effort B — security/correctness (in sibling branch only)

**W0 closed** (per `condescending-shamir-92422b/docs/plan-fixes/W00-acceptance.md`):
- F018 — authz-bypass-check.ts scope extended to all 11 instance services
- F056 — service-boundary-check.ts gained AutomationRule write rule
- F104 — ESLint canon §21 enforcement (no-warning-comments, custom hw/no-versioned-identifier)
- F105 — security-bypass PUBLIC_ALLOWLIST reconciled (27 entries, 5 categories)
- F106 — CD wired to require CI completion (workflow_run trigger)
- F119 — gitleaks + SBOM (anchore/syft + grype) + license-checker added to CI
- D.6 — `tools/dead-code-check.ts` anti-resurrection scanner

**W1 closed** (per `condescending-shamir-92422b/docs/plan-fixes/W01-acceptance.md`):
- F011 — LDAP filter injection (RFC 4515 escape)
- F027 — Unsandboxed `expr-eval` RCE-class fixed (`SafeExpressionEvaluator` 5-layer defense)
- F053 — svc-migrations default-password fallback removed
- F073 — Vector search authorization (principal required, post-filter authzCheck)
- F088 — React Rules-of-Hooks fix in ProtectedRoute + PermissionGate
- F089 — Control plane in-memory access token + HttpOnly refresh cookie
- F093 — Shared `sanitizeHtml(content, profile)` helper
- F111 — `SECRETS_ROTATION.md` private-key block redacted (rotation owed to ops)
- F124 — SQL injection in custom report queries (raw-SQL branch deleted)
- F125 — Pack download SSRF guard (`validateOutboundUrl()`)
- F126 — Pack install controller `@Public()` reconciled (PackInstallGuard handles auth)
- F127 — Notification template `{{{ raw }}}` triple-brace XSS fixed
- F139 — SAML signature affirmation gate + `email_verified` defaulting fixed
- F141 — SAML metadata XML escape (`escapeXmlAttribute()`)
- F014 — JWT secret in `.env.backup` (gitleaks visibility, force-rewrite owed to ops)

**Total W0+W1**: 27 commits, ~6,500 LoC additions / ~50 LoC deletions across 5 new scanners + custom ESLint rule + 7 new security primitive modules + 8 new spec files (148 W1-specific assertions) + CI/CD config.

### Phase 3 Prelude — **COMPLETE** ✓ (2026-05-15)

Landed via PR #60 (merge commit `0cde604`). 16+ commits across 4 streams that restored a deterministic runtime baseline before W2 work begins. Governing spec: `docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md`. Implementation plan: `docs/superpowers/plans/2026-05-14-phase3-prelude-implementation.md` (34 tasks).

| Tag | What |
|---|---|
| `phase3-prelude-complete` | **Phase 3 Prelude FINAL.** Stream 1: 10 schema-split migrations (notify/insights/ava/automation/integrations/identity/app_builder/metadata + service-token-tables + cross-domain-read-diff) + 45 entity-decorator schema declarations + 39-entry cross-domain allowlist + generated schema-ownership-map.md + runtime `search_path` bridge removed. Stream 2: duplicate PermissionsGuard deleted + canonical lib `@hubblewave/auth-guard` warn-and-allow + permissions-coverage scanner (reporting-only) + abac-coverage scanner (fails CI) + Vite proxy transitional annotation + 8 pre-Prelude smoke bridges committed. Stream 3: founder-approved deletion ledger applied — 17 categories executed (11 svc-* dirs incl. svc-identity/svc-metadata RS256 cleanup, 2 api-clients subdirs, 5 Phase D scaffolding libs, 9 unused hooks, libs/ui-components + libs/enterprise, 4 phase7 orphan exports, scripts/seed-platform-knowledge.ts, navigation-legacy.bak, 5 tmpclaude breadcrumbs, .env.example cleanup, +2 follow-up migrations 1943000000000-remove-orphan-studio-views-nav-node + 1943100000000-dedup-nav-nodes). 3 categories DEFERRED to W3: A4 alias controller (Vite proxy still load-bearing), A7 phase7 rename (SDK/runtime stabilization wave), D3 cross_domain_read_diff table drop (proof of shadow-mode closure required first). Stream 4: scripts/prelude-validate.ts harness (11 assertions, fresh-DB rebuild → boot → dual-route login + ES256 JWT + scanner gates) + GitHub Actions CI wiring + 5 Prelude scanners as required status checks. Net: 62 file deletions, ~5,548 net LoC removed, scanners green, fresh-DB rebuild + login validated end-to-end. |

**Founder gates in this stream**: deletion ledger explicit per-category approval at Task 26 (hard stop). Three founder-locked decisions captured in the canon-amendment style: (1) Plan Fix 33 admin-bypass retirement applied uniformly through §28 evaluator; (2) RS256 forbidden everywhere via canon §29.9 — eliminates the `apps/svc-identity/service-tokens/` parallel OAuth path; (3) seed manifest restricted to one row (svc-worker → svc-api), explicitly rejecting speculative seeding of `apps/svc-{automation,data,workflow,notify,view-engine,insights,ava}` accounts that were carried in the original 1941100000000-seed-initial-service-accounts.ts.

---

## Remaining work (consolidated, sequenced by priority)

### Phase 0: Branch reconciliation — **COMPLETE** ✓ (2026-05-10)

Tag `arc-reconciled-with-w1-security` at `fbb640b`. 27 W0+W1 security commits from `claude/condescending-shamir-92422b` cherry-picked into the architectural branch:
- 21 cherry-picked clean (paths unchanged on architectural branch — libs/, tools/, .github/, web-client, svc-* services not yet migrated)
- 1 CLAUDE.md additive merge (W0 acceptance + §21 amendment-log)
- 1 web-client + eslint additive merge
- 2 path-translated for migrated services (F011 LDAP → apps/api/identity/ldap; F125+F126 packs SSRF → apps/api/metadata/packs)
- 1 mixed apply for bdbe876 ESLint enforcement (svc-data lint fixes path-translated to apps/api/data, plus eslint-rules new files)
- 1 W1 acceptance + amendment-log additive merge
- Auxiliary: PUBLIC_ALLOWLIST entries added for migrated apps/api endpoints, svc-notify tsconfig spec exclude, scanner-coverage-gap acknowledged in code

See [docs/superpowers/plans/2026-05-10-phase0-branch-reconciliation.md](plans/2026-05-10-phase0-branch-reconciliation.md) for the full plan + completion note.

### Phase 1: Complete W1 architectural migration — **COMPLETE** ✓ (2026-05-10)

Per spec §8. All 11 instance/control-plane services migrated:

| Service | LoC | Status | New home |
|---|---|---|---|
| svc-identity | ~17,200 | ✅ | `apps/api/src/app/identity/` |
| svc-metadata | ~21,200 | ✅ | `apps/api/src/app/metadata/` |
| svc-data | ~17,700 | ✅ | `apps/api/src/app/data/` |
| svc-automation | ~6,000 | ✅ | `apps/api/src/app/automation/` |
| svc-ava | ~8,000 | ✅ | `apps/api/src/app/ava/` |
| svc-workflow | ~3,000 | ✅ | `apps/api/src/app/automation/workflow/` (canon §8 INVERT) |
| svc-control-plane | ~6,000 | ✅ | `apps/control-plane/src/app/` (new Nest app) |
| svc-view-engine | ~1,700 | ✅ | `apps/api/src/app/views/` |
| svc-insights | ~2,300 | ✅ | `apps/api/src/app/analytics/` |
| svc-notify | ~1,300 | ✅ | `apps/api/src/app/notifications/` |
| svc-instance-api | ~1,200 | ✅ | `apps/api/src/app/instance-api/` |

**Final cutover delivered (tag `arc-w1-complete`):**

- All 11 thin-adapter `apps/svc-*` directories deleted
- `apps/svc-migrations` retained (single-shot K8s Job for instance DB migrations)
- Scanners retargeted: `MIGRATED_AREAS` → `SERVICE_AREAS`; `INSTANCE_SERVICES` collapsed to `['api']`; thin-adapter `KNOWN_VIOLATIONS` cleared
- CI/CD build matrix: `api, control-plane, svc-migrations, web-client, web-control-plane`
- Helm `instance-services` chart: single `api` deployment (replaces 11 per-service deployments)
- `package.json` scripts: `dev:identity/metadata/data/ava/view-engine` dropped; `dev:control-plane` and `dev:web-control-plane` added; `dev:all` runs the new monolith set
- New `Dockerfile`s for `apps/api`, `apps/control-plane`, `apps/svc-migrations`

apps/api is now the sole instance-plane runtime. apps/control-plane is the multi-tenant control plane (canon §18).

### Phase 2: Critical security findings that must land before pilot (W2–W5 from Effort B)

These are correctness bugs in shared libs (paths unchanged by architectural migration). Must land before any customer pilot regardless of architecture wave.

#### W2 — Authorization correctness (~3 weeks, ~11 findings)

| ID | Finding | Path | Why critical |
|---|---|---|---|
| F003 | ACL predicates AND'd not OR'd → users see fewer records than they should | `libs/authorization/src/lib/authorization.service.ts:144-163` | First customer's procurement WILL ask "show me a user seeing the records they're entitled to"; today, they see fewer |
| F004 | Field-level masking hardcoded NONE | `libs/authorization/src/lib/property-acl.repository.ts:514` | HIPAA: PHI must be maskable per role |
| F005 | Field-level access defaults to ALLOW | `libs/authorization/src/lib/property-acl.repository.ts:343-446` | Should default-deny; currently defaults to allow |
| F006 | No deny rules in ACL model | `libs/authorization/src/lib/types.ts:30-61` | Compliance customers explicitly require deny rules |
| F021 | Admin role bypasses everything including masking + audit | `libs/auth-guard/.../permissions.guard.ts:97-101`, `authorization.service.ts:213-219, 302-305` | Admin bypass without audit row violates canon §10 "every action explainable" |
| F023 | `getCollectionRules` fetches all rules then filters in JS | `authorization.service.ts:583-587` | Performance + correctness |
| F024 | First-rule-wins on field permissions | `authorization.service.ts:246-257` | Same root cause as F003 |
| F091 | Field-level permission gating absent in renderer | `apps/web-client/src/components/form/FieldRegistry.tsx`, `FormLayout.tsx` | Frontend doesn't enforce what backend does |
| F102 | No 403 handling | `apps/web-client/src/api/services/api.ts:62-117` | UX: silent failures on permission denial |
| F136 | Search authz post-filters after search (pagination + facet leak) | `apps/svc-ava/src/app/search/search-query.service.ts:399-479` | Path migrates with svc-ava (Phase 1 #3) |
| F146 | Insights dashboards has no authorization on layout content | `apps/svc-insights/src/app/dashboards/dashboards.service.ts:122-142` | Path migrates with svc-insights (Phase 1 #7) |

#### W3 — JWT, session, MFA, SSO hardening (~3 weeks, ~13 findings)

| ID | Finding | Path | Why critical |
|---|---|---|---|
| F001 | Refresh token reuse undetected | `apps/api/src/app/identity/auth/refresh-token.service.ts:55-104` (post-migration) | OWASP A07:2021 |
| F002 | No JWT revocation on instance plane | `libs/auth-guard/src/lib/jwt.guard.ts:47` | OWASP A07 |
| F007 | OIDC missing PKCE | `apps/api/src/app/identity/auth/sso/oidc.service.ts:42-101` (post-migration) | OWASP authn standard |
| F008 | OIDC missing nonce + id_token signature check | `oidc.service.ts:209-232, 247, 285-303` | OWASP authn standard |
| F009 | OIDC state store in-memory (Map) | `oidc.service.ts:52` | Breaks under multi-pod HA |
| F010 | OIDC trusts `email_verified ?? true` | `oidc.service.ts:294` | Account takeover vector |
| F013 | Stale roles in JWT override fresh DB state | conflict between `libs/auth-guard/.../jwt.guard.ts` and `apps/api/.../jwt.strategy.ts` | Admin who lost privileges still has them in JWT |
| F015 | No JWT key rotation infrastructure (no kid, no JWKS) | `apps/api/src/app/identity/auth/auth.module.ts:114-132` (post-migration) | Forced re-key requires app restart |
| F016 | JwtAuthGuard doesn't validate audience or issuer | `libs/auth-guard/src/lib/jwt.guard.ts:47` | Token confusion attacks |
| F019 | Recovery codes hashed with plain SHA-256 | `apps/api/src/app/identity/auth/mfa.service.ts:118-120` (post-migration) | Should be argon2 (per W6.B) |
| F020 | TOTP window=1 + no replay-detection | `mfa.service.ts:21-23` | Same code can be reused within window |
| F022 | No service-to-service auth | `apps/api/.../sync-trigger-client.service.ts` (post-migration) | Anyone with network access can call internal endpoints |
| F025 | Permission cache TTL 5min, no invalidation hook | `authorization.service.ts:48` | Permission changes take 5min to propagate |

#### W5 — Data plane survival (~4 weeks, ~13 findings)

The big one for HIPAA-eligibility. Includes:

| ID | Finding | Why critical |
|---|---|---|
| F031 | God-package entity barrel (130+ entities, every service loads all) | Boot time + memory; deferred since `arc-w0-complete` |
| F042 | Audit hash chain unsafe under concurrency | `libs/instance-db/src/lib/subscribers/audit-log.subscriber.ts:11-32` — HIPAA auditability claim depends on integrity |
| F043 | Identity cache invalidation publishes BEFORE commit, swallows failures | `identity-cache-invalidation.subscriber.ts:65-78` |
| F044 | Audit log writes outside transactions in 30+ services | Canon §10 violated; W5.X scanner is stale |
| F045–F050 | Performance: rollups, N+1 group resolution, no PgBouncer, no `CREATE INDEX CONCURRENTLY`, JSONB GIN coverage gaps | Customer load test fails today |
| F052 | AVA `chat` chains 7 sequential writes with no transaction | Partial-failure leaves AVA conversation in invalid state |
| F054 | Subscriber-based audit hash means migrations can't backfill | One-shot backfill migration owed |
| F140 | Storage bucket layout: per-customer prefix asserted but never used | Per-customer isolation is paper-only |

### Phase 3: Architectural moat (W2–W5 of Effort A spec)

Per spec §8 — this is where customer-facing differentiation gets built:

- **W2** (~2 weeks): Library consolidation
- **W3** (~5 weeks): Frontend + Plugin SDK + Mobile foundation (React Native + Expo)
- **W4** (~10 weeks): **Customization layer + Workspaces + UI Builder** — the moat
- **W5** (~8 weeks): **Upgrade validator + Platform Analytics + AI features + AI Code Assistant** — the differentiator
- **W6** (~6 weeks): Platform demo build (generic demo set, not Clinical/Facilities pack)
- **W7** (~4 weeks): Pre-launch hardening (pen test, HIPAA gap, DR drill, OpenTelemetry)
- **W8** (~4 weeks): Pilot with first customer (your employer builds their own pack on the platform)

### Phase 4: Remaining audit findings (W6–W11 from Effort B; ~80–100 findings)

Lower priority, can land between architectural waves OR after pilot:

- **W6** (Effort B): Workflow & automation correctness (F057–F070, F131–F134, F150)
- **W7** (Effort B): Schema engine truth (F029, F030, F032–F038, F040, F137, F144)
- **W8** (Effort B): AVA lifecycle enforcement (F072–F087, F096) — overlaps with Phase 1 svc-ava migration
- **W9** (Effort B): Frontend compliance (F090, F092, F094, F095, F097, F100, F101, F103) — overlaps with Phase 3 W3
- **W10** (Effort B): Operational maturity (F076–F079, F108, F112–F118, F121, F128, F129, F135, F138, F142, F143, F145, F149) — overlaps with Phase 3 W7
- **W11** (Effort B): Verification & sign-off — overlaps with Phase 3 W7

Many of these find their natural home inside an architectural wave. Track per finding-ID; close as the relevant architectural work completes.

### Out of scope for first pilot

These can wait until post-pilot:

- All deletions in Effort B's "Deletion Catalog §D.1–D.4" that aren't blocking a security finding
- F140 sophistication (per-customer bucket isolation): basic prefix-per-customer is fine; per-bucket isolation is enterprise-tier
- F144 (view tenant scope check): edge case for shared system views
- F147–F149 (libs/enterprise junk drawer cleanup): cosmetic
- All "TODO comment" findings (F121, F153, F154 etc.): drive to zero through scanner allowlist enforcement, not direct cleanup

---

## Pilot blocker checklist

Before scheduling first customer pilot (current employer), confirm:

- [ ] All architectural W1 services migrated (`arc-w1-complete` tag)
- [ ] W0+W1 security work cherry-picked (Phase 0 complete)
- [ ] Phase 2 W2 + W3 + W5 critical findings closed
- [ ] Architectural W4 customization layer + Workspaces + UI Builder shipped
- [ ] Architectural W5 upgrade validator + AI Code Assistant shipped
- [ ] Architectural W6 platform demo build completes the demo set
- [ ] Architectural W7 hardening: pen test passes, HIPAA gap-analysis green, DR drill restores within RTO
- [ ] F111 keypair rotation completed by ops (revoke + reissue + git history rewrite)
- [ ] F014 .env.backup history rewrite completed by ops

Estimated calendar to all checkboxes done: **12–15 months solo** (per RESUME-CONTEXT.md realistic recalibration).

---

## What to do next session

Start by reading this file (PLATFORM-ROADMAP.md) and `RESUME-CONTEXT.md`. master is at the `phase3-w2-complete` tag (Phase 3 W2 Platform Integrity closed 2026-05-17).

**Recommended next move (2026-05-17)**: pick from the W3 deferral list in `CLAUDE.md` §24. In priority order:

1. **Frontend field-permission wiring** (was Task 37) — biggest chunk, web-client + web-control-plane render hidden/masked/read-only/denied fields per the `permissions.fields` payload Task 36 added. Needs browser verification per the CLAUDE.md frontend rule.
2. **Frontend 401/403 UX** (was Task 38, F102) — unified empty-state + retry across both clients.
3. **SSE invalidation channels** (was Task 39) — per-plane SSE endpoints + frontend subscribers for sub-1s permission-change propagation.
4. **`AuthorizationService.getPropertyRules` query path bug** — smallest backend fix; the method queries a non-existent `collectionId` column on `PropertyAccessRule`. Production binds a custom repository that joins through `PropertyDefinition`; the integration specs `apps/api/test/integration/{permissions-payload,collection-data-masking}.spec.ts` document the bug with an inline shim. Fixing the underlying query lets both specs drop the shim.
5. **Service-token scope + ACL paths in `w2-validate`** — the harness scaffolding is in place; add a seeded service principal + bootstrap exchange + scope/ACL assertions.
6. **Admin role retirement 1s-budget assertion** — live DB mutation + bus observation.

The Phase 1 / W1 architectural migration is COMPLETE (the legacy bullet list referencing svc-automation / svc-ava / svc-control-plane migrations is stale; those landed under `arc-w1-complete`). The Phase 2 security audit categories (F003-F006, F021, F136, F146) all closed in W2 — see the canon §24 wave summary for the per-finding outcomes.

---

## Useful commands

```bash
# Where am I architecturally?
git log --oneline -1
git tag --list | grep arc

# What's been migrated?
ls apps/api/src/app/                          # has identity, metadata, kernel, db, audit
ls apps/svc-identity/src/app/                  # only app.module.ts (thin adapter)
ls apps/svc-metadata/src/app/                  # only app.module.ts (thin adapter)
ls apps/svc-data apps/svc-automation apps/svc-ava ...  # still full services

# What security work exists in sibling branch?
git log --oneline 96c92c2..claude/condescending-shamir-92422b 2>/dev/null  # 27 commits

# Which W0+W1 commits are in OUR branch?
for sha in <list>; do
  git merge-base --is-ancestor $sha HEAD 2>/dev/null && echo "$sha: in branch" || echo "$sha: NOT in branch"
done

# All scanners green?
npm run authz:check && npm run audit:check && npm run security:check && npm run deps:check

# All builds clean?
npx nx build api && npx nx build worker && npx nx build svc-identity && npx nx build svc-metadata
```

---

**End of master roadmap.** Update this file when:

- A new tag lands (add to "What's done")
- A locked decision changes (update "Locked decisions")
- A finding is closed (move from remaining to done)
- The phasing changes (update "Sequenced wave plan")
