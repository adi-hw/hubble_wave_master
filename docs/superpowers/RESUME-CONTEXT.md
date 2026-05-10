# Resume Context — HubbleWave ARC-W1 Migration

> **Purpose:** Read this at the start of any fresh Claude Code session to pick up the HubbleWave platform architecture migration without re-deriving context. Update only when a new tag lands or a locked decision changes.
>
> **Master roadmap:** `docs/superpowers/PLATFORM-ROADMAP.md` — single source of truth coordinating BOTH the architectural reshape and the parallel security audit remediation. Read PLATFORM-ROADMAP.md FIRST for the bigger picture, then this file for the architecture-specific lessons + cheat sheet.
>
> **Last updated:** 2026-05-10 (after `arc-w1-data-complete` + `arc-reconciled-with-w1-security` consolidated into master via PR #4 + PR #5)

## Working directory

Both prior architectural work branches (`claude/nervous-volhard-f9abc2` and its source `claude/amazing-yalow-0f9c37`) have been merged into `master` and the remote PR-head branches deleted. master is at `7b47d49` with the full W1 migration through data + Phase 0 reconciliation.

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

## Completed work (6 git tags, all on master)

| Tag | Commit | What | Size |
|---|---|---|---|
| `arc-w0-complete` | `d3dede3` | Canon amendments to CLAUDE.md (§5/§7/§8/§11/§12/§17/§19/§21 amended; §17.5/§25/§26/§27 added; §24 maintenance log) + apps/api & apps/worker Nest scaffolds + package.json scripts | doc-only |
| `arc-w1-foundation-partial` | `bffef2f` | kernel + db + audit module wrappers in apps/api (re-exports from `libs/instance-db`) | small wrappers |
| `arc-w1-identity-complete` | `8710e79` | All 15 svc-identity sub-modules + 3 top-level files → apps/api/identity. Includes the **cyclic-core bundle** (auth+abac+ldap+roles, 71 files atomic). svc-identity reduced to a 27-line thin adapter. | ~17,200 LoC, 105 files |
| `arc-w1-metadata-complete` | `0b2f0d9` | All 23 svc-metadata sub-modules + 7 top-level files → apps/api/metadata. svc-metadata reduced to a 16-line thin adapter. HealthController renamed to `MetadataHealthController` (route `/metadata/health`) to avoid collision with identity's. | ~21,200 LoC, 102 files |
| `arc-w1-data-complete` | `d10f0d9` | All 12 svc-data sub-directories + 9 top-level files → apps/api/data. svc-data reduced to a thin adapter. HealthController renamed to `DataHealthController` (route `/data/health`). Mid-stream service-file move pattern: `collection-data.service` + `model-registry.service` migrated mid-stream so `work`/`offerings`/`grid` could resolve sibling-relative imports. | ~17,700 LoC, 66 files |
| `arc-reconciled-with-w1-security` | `fbb640b` | 27 W0+W1 security commits cherry-picked from `claude/condescending-shamir-92422b` with path-translation for migrated services (LDAP F011 → apps/api/identity/ldap; packs SSRF F125+F126 → apps/api/metadata/packs; ESLint F104 lint fixes path-translated to apps/api/data). | ~6,500 additions / ~50 deletions across ~50 files |

**Cumulative**: ~56,100 LoC migrated across ~273 files via `git mv` (history preserved). All in master at HEAD `7b47d49`.

To see the full migration narrative:

```bash
git log --oneline arc-w0-complete..arc-reconciled-with-w1-security | wc -l   # ~80 commits
git log --oneline arc-w1-metadata-complete..arc-w1-data-complete             # 17 commits (data migration)
git log --oneline arc-w1-data-complete..arc-reconciled-with-w1-security      # 35 commits (Phase 0 reconciliation)
```

## Implementation plans (executed)

- `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md` — W0 + W1 foundation slice
- `docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md` — identity migration
- `docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md` — metadata migration
- `docs/superpowers/plans/2026-05-10-platform-w1-data-migration.md` — data migration
- `docs/superpowers/plans/2026-05-10-phase0-branch-reconciliation.md` — Phase 0 W0+W1 cherry-pick reconciliation

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

## What's left in W1

### Phase 1 prerequisite: scanner coverage extension

`tools/service-boundary-check.ts` and `tools/authz-bypass-check.ts` use `SERVICE_DIR_RE = /^svc-[a-z0-9-]+$/` which only matches `apps/svc-*`. After the identity/metadata/data migrations, ~56,100 LoC live at `apps/api/src/app/{identity,metadata,data}/` where the scanners don't reach. Extend the scanners (and update `KNOWN_ENTITY_VIOLATIONS` allowlist paths if needed) before further service migrations so "scanners green" is meaningful.

### Remaining instance-plane services to migrate

Each needs its own focused plan + execution following the same template:

| Service | LoC (approx) | Notes |
|---|---|---|
| svc-automation | 6,000 | Already partially consolidated in Plan Fix 1; should be fast |
| svc-ava | 8,000 | AVA runtime; F072+F074 proposal state machine overlap with Plan Fix 16 (`ca16e40`) |
| svc-control-plane | 6,000 | Different plane (multi-tenant by design); different shape |
| svc-workflow | 3,000 | Will likely fold into apps/api/automation per canon §8 INVERT |
| svc-view-engine | 2,000 | Small leaf |
| svc-insights | 2,000 | Small leaf |
| svc-notify | 1,000 | Small leaf |
| svc-instance-api | 1,000 | Likely an aggregator/proxy that folds into apps/api wholesale |

### W1 final cutover (separate plan)

After all instance services migrate:
1. Delete legacy `apps/svc-*` directories (the thin adapters)
2. Delete `tools/service-boundary-check.ts` (no longer relevant)
3. Update CI to remove the service-boundary scanner from required checks
4. Update Nx project graph
5. Verify apps/api handles 100% of instance-plane traffic
6. Tag `arc-w1-cutover-complete`

### Then W2 onward (per spec §8)

- W2: Library consolidation (~2 weeks)
- W3: Frontend + SDK + Mobile foundation (~5 weeks)
- W4: Customization layer + Workspaces + UI Builder (~10 weeks)
- W5: Upgrade validator + Platform Analytics + AI features + AI Code Assistant (~8 weeks)
- W6: Platform demo build (~6 weeks)
- W7: Pre-launch hardening (~4 weeks)
- W8: Pilot with first customer (~4 weeks)

## How to start a fresh session

Spawn a new Claude Code worktree off `master` and say:

> Read `docs/superpowers/PLATFORM-ROADMAP.md` and `docs/superpowers/RESUME-CONTEXT.md` and tell me what's done.
>
> Then I want to: [insert next request — e.g. "extend the scanners to scan apps/api before continuing migrations", "write the svc-automation migration plan", "execute the svc-ava migration", "tackle Phase 2 W2 authz correctness fixes"].

Auto mode for continuous execution if you want minimal interruption.

**Recommended next move (per PLATFORM-ROADMAP.md)**: Phase 1 prerequisite (extend scanners to apps/api), then continue W1 architectural migration with svc-automation.

## Useful tags + commands cheat sheet

```bash
# Where am I?
git log --oneline -1
git tag --list | grep arc

# What's the migration narrative?
git log --oneline arc-w0-complete..arc-reconciled-with-w1-security | wc -l   # ~80 commits across all migrations + reconciliation

# Verify everything still builds
npx nx build api && npx nx build svc-identity && npx nx build svc-metadata && npx nx build svc-data && npx nx build worker

# All scanners green?
npm run authz:check && npm run audit:check && npm run security:check && npm run service-boundary:check && npm run deps:check && npm run dead-code:check
npm run selftest:scanners

# What's in apps/api now?
ls apps/api/src/app/   # has identity, metadata, data, kernel, db, audit

# What's left in svc-identity / svc-metadata / svc-data?
ls apps/svc-identity/src/app/   # only app.module.ts (thin adapter)
ls apps/svc-metadata/src/app/   # only app.module.ts (thin adapter)
ls apps/svc-data/src/app/       # only app.module.ts (thin adapter)

# Migration progress checklist (per-area)
grep -E "^\s*\*\s+\[" apps/api/src/app/identity/identity.module.ts
grep -E "^\s*\*\s+\[" apps/api/src/app/metadata/metadata.module.ts
grep -E "^\s*\*\s+\[" apps/api/src/app/data/data.module.ts
```

---

**End of resume context.** Update this file when a new tag lands or a locked decision changes.
