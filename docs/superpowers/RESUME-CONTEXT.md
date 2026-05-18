# Resume Context — HubbleWave ARC-W1 Migration

> **Purpose:** Read this at the start of any fresh Claude Code session to pick up the HubbleWave platform architecture migration without re-deriving context. Update only when a new tag lands or a locked decision changes.
>
> **Master roadmap:** `docs/superpowers/PLATFORM-ROADMAP.md` — single source of truth coordinating BOTH the architectural reshape and the parallel security audit remediation. Read PLATFORM-ROADMAP.md FIRST for the bigger picture, then this file for the architecture-specific lessons + cheat sheet.
>
> **Phase 3 governance baseline:** `docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md` governs Phase 3 work; Prelude implementation plan at `docs/superpowers/plans/2026-05-14-phase3-prelude-implementation.md`. Read those before starting any W2+ task.
>
> **Last updated:** 2026-05-17 (after `phase3-w2-complete` — Phase 3 W2 Platform Integrity COMPLETE; boundary consistency across authz / identity / audit / search; canon §24 carries the wave-level summary; three frontend tasks + a handful of backend fix-ups deferred to W3, listed in the canon)

## Working directory

ARC-W1 work is complete. All architectural migrations have been consolidated into `master`. The current branch (`claude/amazing-yalow-0f9c37`) carried PRs #4 → #11. After PR #11 merged, the W1 final cutover landed in PR #12.

Future Claude Code sessions should spawn a fresh worktree off master in the `OneDrive...HW Platform/` parent folder. The pattern observed in this project:

```
C:\Dev\HW-Platform\HW Platform\                                                    ← founder's main repo (master). OFF LIMITS for direct work.
C:\Users\Hubble-Wave\OneDrive - Hubble Wave\Desktop\Project HW\.claude\HW Platform\
  ├─ <session-codename>/                                                            ← spawned worktree per Claude session
  ├─ condescending-shamir-92422b/                                                   ← security audit branch worktree (Effort B)
  └─ ...
```

Pin the worktree path in every subagent prompt (see "Migration pattern" below). The founder's main repo at `C:\Dev\HW-Platform\HW Platform` is OFF LIMITS — never write there directly.

## Approved canonical spec

`docs/superpowers/specs/2026-05-09-platform-architecture-design.md` (markdown + companion HTML).

Founder-approved architectural decisions baked into the spec:

- **Modular monolith** — apps/api + apps/worker + apps/control-plane + apps/web-client + apps/mobile (React Native, Day 1). Replaces the 14-service distributed system that existed at session start.
- **Customization upgrade-safety is the architectural moat** — canon §17.5, §25, §26, §27 are the load-bearing additions
- **Solo founder, ~10–12 months, platform-only scope** — vertical pack (Clinical/Facilities Asset Management) deferred to a separate design doc, captured in spec Appendix D
- **Day 1 product**: Workspaces + full UI Builder (ServiceNow UI Builder competitor) + Platform Analytics + AI Code Assistant + upgrade-safety guarantee + mobile

## Locked founder decisions (do not re-litigate)

| Decision | Rationale |
|---|---|
| React Native + Expo for mobile | TypeScript code reuse with web; mature offline patterns |
| §5 SOFTEN — single-tenant default + pooled (RLS) mode | Enables free trials, sales demos, internal dev/staging, lower-tier customers |
| AI Code Assistant Day 1 | Cursor/Copilot-style for plugin/formula/automation/integration/workspace/analytics authoring; competitor to ServiceNow's Now Assist for Creators |
| UI Builder full page authoring | First customer (current employer) uses ServiceNow UI Builder extensively; matching is non-negotiable |
| Vertical pack deferred | Platform-first discipline for solo execution; first customer's pilot is stronger when they build their own pack on the platform |
| LLM provider per customer (BAA-controlled) | Hospitals require data-residency control |

## Completed work (14 git tags, all on master)

### Foundation + Phase 0 reconciliation

| Tag | What |
|---|---|
| `arc-w0-complete` | Canon amendments to CLAUDE.md + apps/api & apps/worker Nest scaffolds + 8 architectural scanners + ESLint canon rules + gitleaks + SBOM + license-checker |
| `arc-w1-foundation-partial` | kernel + db + audit module wrappers in apps/api (re-exports from `libs/instance-db`) |
| `arc-reconciled-with-w1-security` | 27 W0+W1 security commits cherry-picked from `claude/condescending-shamir-92422b` with path-translation for migrated services (LDAP F011, packs SSRF F125+F126, ESLint F104) |

### Per-service migrations (11 of 11 complete)

| Tag | Service | New home | LoC |
|---|---|---|---|
| `arc-w1-identity-complete` | svc-identity | `apps/api/src/app/identity/` | ~17,200 |
| `arc-w1-metadata-complete` | svc-metadata | `apps/api/src/app/metadata/` | ~21,200 |
| `arc-w1-data-complete` | svc-data | `apps/api/src/app/data/` | ~17,700 |
| `arc-w1-automation-complete` | svc-automation | `apps/api/src/app/automation/` | ~6,000 |
| `arc-w1-ava-complete` | svc-ava | `apps/api/src/app/ava/` | ~8,000 |
| `arc-w1-workflow-complete` | svc-workflow | `apps/api/src/app/automation/workflow/` (canon §8 INVERT merger) | ~3,000 |
| `arc-w1-control-plane-complete` | svc-control-plane | `apps/control-plane/src/app/` (NEW Nest app, canon §18) | ~6,000 |
| `arc-w1-foldins-complete` | svc-view-engine + svc-notify + svc-instance-api + svc-insights | `apps/api/src/app/{views,notifications,instance-api,analytics}/` | ~6,500 |

### Final cutover

| Tag | What |
|---|---|
| `arc-w1-complete` | All 11 thin-adapter `apps/svc-*` directories deleted. Scanners retargeted (MIGRATED_AREAS → SERVICE_AREAS; INSTANCE_SERVICES collapsed to `['api']`; thin-adapter KNOWN_VIOLATIONS cleared). CI/CD matrix → `api, control-plane, svc-migrations, web-client, web-control-plane`. Helm collapsed to single `api` deployment. `dev:*` package scripts trimmed. New Dockerfiles for `apps/api`, `apps/control-plane`, `apps/svc-migrations`. |

**Cumulative**: ~91,000+ LoC consolidated. `apps/api` is the sole instance-plane runtime. `apps/control-plane` is the multi-tenant control plane. Only `apps/svc-migrations` remains (single-shot K8s Job).

To see the full Phase 1 narrative:

```bash
git log --oneline arc-w0-complete..arc-w1-complete                            # all of Phase 1
git log --oneline arc-w1-foldins-complete..arc-w1-complete                    # final cutover only
git tag --list 'arc-*'                                                        # all 13 tags
```

### Phase 3 Prelude (2026-05-15)

| Tag | What |
|---|---|
| `phase3-prelude-complete` | FOUNDATION milestone only — does NOT certify Platform Integrity (W2). Tag points at HEAD `13b55a9` (advanced past the PR #60 merge through 6 audit-driven cleanups, see below). 16+ commits across 4 streams landed via PR #60 (merge `0cde604`). Schema model finalized: 10 schema-split migrations, 45 entity decorators declare their domain schema, runtime `search_path` bridge removed. Compatibility shims removed: duplicate `apps/api PermissionsGuard` deleted in favor of canonical `@hubblewave/auth-guard` (`@Global()` so cross-domain consumers get `IDENTITY_RESOLVER_PORT` via DI), permissions-annotation-coverage scanner (reporting-only) and abac-coverage scanner (fails CI) added, Vite proxy annotated as transitional. Obsolete product surfaces removed via founder-approved deletion ledger: 11 untracked svc-* dirs (incl. svc-identity RS256 OAuth path that violated canon §29.9, svc-metadata v1 API), 5 Phase D scaffolding libs (libs/{automation-runtime, http-client, observability, metadata-reader, service-auth}), 9 unused hooks, libs/ui-components + libs/enterprise, 4 phase7 orphan exports, scripts/seed-platform-knowledge.ts, hygiene cleanup (1 .bak, 5 tmpclaude breadcrumbs, .env.example corrections), + 2 follow-up migrations (1943000000000-remove-orphan-studio-views-nav-node, 1943100000000-dedup-nav-nodes). Net: 62 file deletions, ~5,548 net LoC removed. End-to-end validation harness `scripts/prelude-validate.ts` (11 assertions) + 5 Prelude scanners wired as required CI status checks. **DEFERRED to W3 per founder direction:** A4 (`IdentityAuthAliasController` — Vite proxy still load-bearing), A7 (`phase7/` rename — SDK/runtime stabilization wave), D3 (`cross_domain_read_diff` table drop — proof of shadow-mode closure required first). |

Phase 3 governing spec: `docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md`. Implementation plan: `docs/superpowers/plans/2026-05-14-phase3-prelude-implementation.md` (34 tasks). Deletion ledger with founder per-category approvals: `docs/superpowers/plans/2026-05-14-phase3-prelude-stream3-deletion-ledger.md`. Pre-deletion proof artifact (B1 hook audit + Nx dependency graph snapshot evidencing zero coupling): `docs/superpowers/plans/prelude-deletion-proof.md`.

### Post-merge audit-driven cleanups (read before W2)

Two careful audits (2026-05-15) ran after PR #60 merged. They found 2 real Prelude regressions (now fixed) and surfaced 4 pre-existing W2-scope authz correctness gaps that the original Prelude completion claim had not made explicit.

**Real regressions fixed in-stream (5 direct-to-master commits, all live on origin):**

- `07e08ca` — service-boundary fix. `apps/api/src/app/metadata/access/access.module.ts` was importing `AuthModule` from `apps/api/src/app/identity/auth/auth.module` (cross-service-boundary violation flagged by `tools/service-boundary-check.ts`). Fix: annotate `AuthModule` with `@Global()`; remove the cross-service import.
- `4e021ac` — authorization tests aligned with Plan Fix 33. `nx test authorization` failed compile with TS2554 at 7 sites still passing the deleted `AccessAuditPort` constructor argument; 1 test still asserted the retired admin short-circuit. Now 115/115 passing.
- `0ec51fe` — svc-migrations K8s Job packaging fix. (a) `nx build svc-migrations` only emitted `dist/apps/svc-migrations/main.js`; the migration `.ts` files were never compiled. Now a dedicated `apps/svc-migrations/tsconfig.migrations.json` + Dockerfile tsc step produces `dist/migrations/instance/*.js`. (b) `migrationsTransactionMode: 'each'` was missing from the K8s DataSource; two migrations (jsonb-gin-indexes, search-acl-fields) declare `transaction = false` for `CREATE INDEX CONCURRENTLY` and were getting rejected. Now mirrors the CLI datasource.
- `762dd6b` — InstanceCustomization entity ↔ schema alignment. Migration `1813000000000-upgrade-assistant-tables.ts` recreated `instance_customizations` with snake_case columns + 4 columns the entity didn't model; the codebase wires no `SnakeNamingStrategy`. Every repo query against `InstanceCustomization` failed at runtime. Fix: explicit `name:` overrides + 4 missing properties added.
- `13b55a9` — orphan `seed:test-user` npm script removed (pointed at a deleted file that referenced the pre-rename `eam_global` schema). 4 stale `.js`/`.js.map` artifacts cleaned from `scripts/` (286 files total cleaned across libs/, migrations/, scripts/ — TypeORM was resolving stale `.js` before `.ts` and breaking `migration:show` locally).

**W2-scope correctness gaps surfaced — track these into W2 brainstorming:**

- **Role-code vs role-id mismatch.** `IdentityResolverAdapter.getUserContext` returns role CODES; `AuthorizationService.toAbacPrincipal` falls back to `ctx.roles` as if they were role IDs (UUIDs). Production JWT path mismatches role-based ACL rules; tests inject `attributes.roleIds` and hide the regression. Files: `apps/api/src/app/identity/auth/identity-resolver.adapter.ts:81` ↔ `libs/authorization/src/lib/authorization.service.ts:1369` ↔ `libs/instance-db/src/lib/entities/access-rule.entity.ts`.
- **PermissionsGuard is warn-and-allow on unannotated handlers by design** during the Prelude transition. Coverage at 207/804 (25.7%); flipping to deny-by-default is W2's milestone, gated on coverage approaching 100%.
- **Search authz keeps an admin `allow_all` short-circuit** in `apps/api/src/app/ava/search/search-query.service.ts:179`. Canon §28.6 retired the AuthorizationService admin bypass via Plan Fix 33; the parallel search-side retirement has not shipped.
- **Full default-deny not enabled.** `secureFieldsByDefault` defaults `false`; property authorization default-allows when the flag is off. Spec §28.9 explicitly defers platform-wide default-deny to W3+.

**Migration-runner follow-up that remains:**

- `nx run svc-migrations:prune` is broken (executor expects `apps/svc-migrations/package.json` which doesn't exist). `copy-workspace-modules` doesn't run, so `workspace_modules/` is not packaged next to `dist/apps/svc-migrations/main.js`. That blocks migration `1930900000001-backfill-audit-log-hash-chain` from `require('@hubblewave/instance-db')` at runtime in the K8s Job. The other 48 migrations run fine. Fix is either wiring `apps/svc-migrations/package.json` to satisfy the executor, or rewriting that single migration to inline its tiny dep — either is W2+ housekeeping.

**Baseline squash decision:**

The committed `.ts` migration chain (98 instance + 8 control-plane) is preserved as-is and now packages correctly into the K8s Job. The squash-to-baseline path (one clean baseline per plane + structural seed data + delete the incremental files) is a one-way door; not done. Tracked as W2+ work pending founder decision.

## Implementation plans (executed)

- `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md` — W0 + W1 foundation slice
- `docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md` — identity migration
- `docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md` — metadata migration
- `docs/superpowers/plans/2026-05-10-platform-w1-data-migration.md` — data migration
- `docs/superpowers/plans/2026-05-10-phase0-branch-reconciliation.md` — Phase 0 W0+W1 cherry-pick reconciliation
- `docs/superpowers/plans/2026-05-14-phase3-prelude-implementation.md` — Phase 3 Prelude (34 tasks across 4 streams)

## Migration pattern (battle-tested across identity + metadata)

These lessons are baked into the working subagent prompt template. Future migrations should preserve them.

### Working-directory pinning (mandatory)

Every subagent prompt MUST start with the actual worktree path of the spawning session, e.g.:

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/<session-codename>" && pwd && git rev-parse --abbrev-ref HEAD && git log --oneline -1
```

Verify branch is the spawning session's branch (typically `claude/<session-codename>`) and HEAD matches the expected previous commit. STOP and report BLOCKED if either differs.

For all subsequent Bash commands in the dispatch, prefix with the same `cd "<worktree-path>" &&`.

For Write/Edit, use absolute paths starting with the worktree root.

This rule was learned the hard way: an early Haiku subagent committed `41e9f0e` (canon §5 SOFTEN) to **master in the main repo** instead of the worktree branch. Recovery cost time. Pinning eliminates the failure.

### Empty-directory pre-flight (mandatory)

Before any `git mv`, run:

```bash
find apps/api/src/app/<area> -type d -empty
```

If the destination directory exists empty (residue from a prior failed attempt), `rmdir` it first. Otherwise `git mv source dest` will nest source inside the empty destination (`dest/source/files`).

This Windows/OneDrive quirk hit three separate migrations in this session before being baked into the template.

### Forbidden-file list (do not modify)

Subagents must NOT modify these under any circumstances:
- `nx.json`, `package.json`, `package-lock.json`
- `.vscode/`, `.gitignore`
- `tsconfig.base.json`
- `tools/` (any file)
- `docs/` (subagents reference plan docs but should not edit them)

If the migration touches one of these legitimately (e.g. adding an Nx project), it requires a separate authorized commit, not a side-effect of a sub-module migration.

### `git mv` only (never copy + modify)

The first subagent attempt at config migration created duplicate files in svc-identity instead of moving cleanly. Recovery cost a `git reset --hard`. Subagents are now explicitly told: **"Use `git mv` only. No copies. No 'temporary re-exports'. If you can't make it work with `git mv`, report BLOCKED."**

### Cross-module dependency analysis

Before writing a migration plan for a new service, run the dependency survey:

```powershell
$subs = @('list','of','sub-modules');
foreach ($s in $subs) {
  $path = "apps/svc-<svc>/src/app/$s";
  if (Test-Path $path) {
    $crossDeps = Get-ChildItem $path -Recurse -Include *.ts |
      Select-String -Pattern "from\s+'\.\./" |
      Where-Object { $_.Line -notmatch "from\s+'\.\./\.\./\.\." } |
      ForEach-Object { if ($_.Line -match "from\s+'\.\./([^/']+)") { $matches[1] } } |
      Sort-Object -Unique | Where-Object { $_ -ne $s };
    if ($crossDeps) { "{0,-18} -> {1}" -f $s, ($crossDeps -join ', ') }
    else { "{0,-18} -> (no cross-sub-module deps)" -f $s }
  }
}
```

Then check for cycles. If cycles exist (like identity's auth↔abac↔ldap↔roles), the dependent group must migrate as one **atomic cyclic-core bundle** (single commit, all files at once). If the graph is a clean DAG (like metadata), each sub-module migrates independently in topological order.

### Sub-module patterns

| Pattern | Example | Registration |
|---|---|---|
| Standard module (has `*.module.ts` with `@Module`) | UsersModule, ScriptModule, FormulaModule | `imports: []` + `exports: []` |
| Service-only (no Module wrapper) | InsightsIngestService, AvaIngestService, EventOutboxService, SyncTriggerClientService | `providers: []` + `exports: []` |
| Controller + services, no Module | schema (SchemaController + SchemaDeployService + SchemaDiffService) | `controllers: []` for controller; `providers: []` + `exports: []` for services |
| Service-only with controller | OfferingsController+OfferingsService (svc-data), WorkController+WorkService | `controllers: []` for controller + `providers: []`/`exports: []` for service |
| Naming collision in destination | metadata's `HealthController` → `MetadataHealthController` (route `/metadata/health`); data's → `DataHealthController` (route `/data/health`) | Rename file + class + route prefix in destination |
| Class name collision avoided in source | metadata's `NavigationMetadataModule` vs identity's `NavigationModule` | No alias needed — different class names |
| Co-located types | svc-data's `automation.types.ts` only consumed by `automation/sync-trigger-client.service.ts` → moved into `apps/api/src/app/data/automation/automation.types.ts` | Update single import to sibling-relative; remove empty `src/types/` parent |
| Sub-module → top-level service dep (data migration wrinkle) | `work`/`offerings` → `collection-data.service`; `grid` → `model-registry.service` | Mid-stream service-file move: relocate the top-level services BEFORE migrating dependent sub-modules so siblings resolve cleanly post-move |

### Model selection for subagents

| Task type | Model |
|---|---|
| Standard module migration (1 sub-module, paste-the-template work) | Haiku |
| Combined batch of standard module migrations (5+ in one dispatch) | Haiku |
| Service-only migration | Haiku |
| Cyclic-core bundle (atomic multi-sub-module commit, 60+ files) | Sonnet |
| Top-level migration (full @Module rewrite combining 15+ sub-modules) | Sonnet |
| Schema-style migration (controller + services, no Module — judgment about registration) | Sonnet |
| Architecture/design/spec writing | Opus (the controller — me — does this) |

Right tool for each job. Haiku handled ~80% of migrations with no quality loss. Sonnet earned its cost on the bundles and rewrites.

### Authorized recovery path

Subagent prompts include this clause:

> If anything goes irrecoverably wrong, you may run `git reset --hard <prev-commit>` to revert to the pre-task state. Use only if state is broken and can't proceed cleanly.

This explicitly authorizes the destructive operation in a bounded way. A subagent that hits a nesting issue or import-graph dead-end can recover without escalating.

### Combined dispatches

Once the pattern is mechanical (verified by 2–3 successful single-sub-module migrations), combine 4–7 sub-modules per dispatch with the standard template applied multiple times. The subagent commits atomically per sub-module so any single failure remains recoverable.

Identity ran the cyclic-core bundle (66 files) + per-sub-module dispatches. Metadata ran 4-of-23 individually then combined the remaining 19 into 4 dispatches. Data ran Tasks 1, 2, 3, 4 individually (one of each pattern), then batched Tasks 5-8, 9-10, 13-15. Same quality, much less dispatch overhead.

### Path-translation cherry-picks (Phase 0 pattern)

When cherry-picking a security fix from a sibling branch into a branch where the target file has been migrated to a new path (e.g. `apps/svc-identity/src/app/ldap/` → `apps/api/src/app/identity/ldap/`), `git cherry-pick` fails because the source path doesn't exist. Use `git format-patch | sed | git apply` instead:

```bash
git format-patch -1 <SHA> --stdout | sed 's|apps/svc-<old>/src/app/<sub>/|apps/api/src/app/<area>/<sub>/|g' > /tmp/translated.patch
git apply --check /tmp/translated.patch && git apply /tmp/translated.patch
```

For commits that touch BOTH unchanged paths and migrated paths (mixed), use `git apply --reject` to apply what fits and inspect `*.rej` for the rest. Manually port rejected hunks. Worked for bdbe876 (F104 ESLint enforcement) which touched 13 files, of which 3 needed translation and 10 applied cleanly.

Phase 0 used this pattern across 27 W0+W1 commits: 21 plain cherry-picks, 3 path-translations, 2 CLAUDE.md additive merges, 1 mixed apply. See [docs/superpowers/plans/2026-05-10-phase0-branch-reconciliation.md](plans/2026-05-10-phase0-branch-reconciliation.md).

### Self-review checklist (subagent appends to prompt)

```bash
grep -E "^\s*\*\s+\[" apps/api/src/app/<area>/<area>.module.ts
```

Verify all newly-migrated sub-modules show `[x]` in the comment-block checklist. The first metadata combined batch missed this — the @Module decorator was correct but the human-readable checklist was stale. One follow-up commit synced it. Adding the self-review step prevents this.

## What's next — W3 onward (post-W2)

Phase 1 (architectural reshape) and Phase 3 W2 (Platform Integrity) are both COMPLETE as of 2026-05-17. The W2 wave closed F003-F006, F021, F136, F146 plus delivered the boundary-consistency contracts the original Phase 2 backlog set out to address (canon §28 evaluator unification, ES256 cross-plane, permission registry, route-boundary hard gate, fail-closed PermissionsGuard, audit provenance). See `CLAUDE.md` §24 (the 2026-05-17 W2-complete entry) for the per-finding outcomes.

### Immediate (W3 deferrals from `CLAUDE.md` §24)

In priority order:

1. **Frontend field-permission wiring** (was W2 Task 37) — biggest chunk; web-client + web-control-plane render hidden/masked/read-only/denied fields per the `permissions.fields` payload Task 36 added. Needs browser verification per the CLAUDE.md frontend rule.
2. **Frontend 401/403 UX** (was Task 38, F102) — unified empty-state + retry across both clients.
3. **SSE invalidation channels** (was Task 39) — per-plane SSE endpoints + frontend subscribers for sub-1s permission-change propagation.
4. **`AuthorizationService.getPropertyRules` query path bug** — smallest backend fix. The method queries a non-existent `collectionId` column on `PropertyAccessRule`. Two integration specs (`permissions-payload.spec.ts`, `collection-data-masking.spec.ts`) document the bug with an inline shim — fixing the underlying query lets both drop the shim.
5. **Service-token scope + ACL paths in `w2-validate`** — harness scaffolding is in place; needs seeded service principal + bootstrap exchange + scope/ACL assertions.
6. **Admin role retirement 1s-budget assertion** — live DB mutation + bus observation.

The entity-schema scanner per-plane manifest shipped in W2 follow-up round 3 (PR #103). Manifest now has `{ instance: {...}, controlPlane: {...} }` sections; scanner detects plane by path and validates against the matching section. Control-plane drift is caught instead of skipped wholesale.

### Original W3 (JWT / session / MFA / SSO hardening, ~13 findings) — most folded into W2

Several of the original W3 items landed during W2 (refresh-token family rotation + reuse detection per canon §29.5; ES256 + JWKS per §29.1; service-to-service auth per §29.7; permission-cache invalidation per F025). What remains: OIDC PKCE/nonce/state hardening, MFA recovery-code hashing — both still owed and not in the W2 scope.

### W4–W8 (per spec §8)

- W4: Customization layer + Workspaces + UI Builder (~10 weeks)
- W5: Upgrade validator + Platform Analytics + AI features + AI Code Assistant + Data plane survival (~8 weeks)
- W6: Platform demo build (~6 weeks)
- W7: Pre-launch hardening (~4 weeks)
- W8: Pilot with first customer (~4 weeks)

See PLATFORM-ROADMAP.md for the full sequenced backlog.

## How to start a fresh session

Spawn a new Claude Code worktree off `master` (or pick up an existing worktree) and say:

> Read `docs/superpowers/PLATFORM-ROADMAP.md` and `docs/superpowers/RESUME-CONTEXT.md` and tell me what's done.
>
> Then I want to: [insert next request — e.g. "fix the AuthorizationService.getPropertyRules query path bug", "wire frontend field-permission rendering in web-client", "wire SSE invalidation channels"].

Auto mode for continuous execution if you want minimal interruption.

**Recommended next move (per PLATFORM-ROADMAP.md, 2026-05-17)**: pick from the W3 deferral list in `CLAUDE.md` §24 — frontend field-permission wiring (was Task 37) is the biggest chunk; the `AuthorizationService.getPropertyRules` query path bug is the smallest backend fix. Phase 2 W2 authz correctness (F003-F006, F021, F136, F146) all closed in the W2 wave.

## Useful tags + commands cheat sheet

```bash
# Where am I?
git log --oneline -1
git tag --list 'arc-*'                                # all 13 ARC tags

# Verify everything still builds
npx nx run-many --target=build --projects=api,control-plane,worker,web-client,web-control-plane,svc-migrations --parallel=2

# All scanners green?
npm run authz:check && npm run audit:check && npm run security:check && npm run service-boundary:check && npm run deps:check && npm run dead-code:check

# All selftests pass?
npx ts-node tools/authz-bypass-check-selftest.ts
npx ts-node tools/service-boundary-check-selftest.ts
npx ts-node tools/security-bypass-check-selftest.ts
npx ts-node tools/dead-code-check-selftest.ts

# Tests pass?
npx nx test api

# What's in apps/api now?
ls apps/api/src/app/                                  # identity, metadata, data, automation, ava, views, notifications, instance-api, analytics, kernel, db, audit, app.module.ts
ls apps/control-plane/src/app/                        # customers, instances, packs, licenses, recovery, audit, auth, settings, terraform, subscriptions, metrics, health-aggregator
ls apps/                                              # api, api-e2e, control-plane, svc-migrations, web-client, web-control-plane, worker, worker-e2e  (no svc-* except svc-migrations)
```

---

**End of resume context.** Update this file when a new tag lands or a locked decision changes.
