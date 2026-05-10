# Resume Context — HubbleWave ARC-W1 Migration

> **Purpose:** Read this at the start of any fresh Claude Code session to pick up the HubbleWave platform architecture migration without re-deriving context. Update only when a new tag lands or a locked decision changes.
>
> **Last updated:** 2026-05-10 (after `arc-w1-metadata-complete`)

## Working directory

This is a git worktree at `C:\Users\Hubble-Wave\OneDrive - Hubble Wave\Desktop\Project HW\.claude\HW Platform\nervous-volhard-f9abc2` on branch `claude/nervous-volhard-f9abc2`.

Other working tree at `C:\Dev\HW-Platform\HW Platform` (master branch) is **OFF LIMITS** — that's the founder's main repo. All work happens in the worktree.

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

## Completed work (4 git tags)

| Tag | Commit | What | Size |
|---|---|---|---|
| `arc-w0-complete` | `d3dede3` | Canon amendments to CLAUDE.md (§5/§7/§8/§11/§12/§17/§19/§21 amended; §17.5/§25/§26/§27 added; §24 maintenance log) + apps/api & apps/worker Nest scaffolds + package.json scripts | doc-only |
| `arc-w1-foundation-partial` | `bffef2f` | kernel + db + audit module wrappers in apps/api (re-exports from `libs/instance-db`) | small wrappers |
| `arc-w1-identity-complete` | `8710e79` | All 15 svc-identity sub-modules + 3 top-level files → apps/api/identity. Includes the **cyclic-core bundle** (auth+abac+ldap+roles, 71 files atomic). svc-identity reduced to a 27-line thin adapter. | ~17,200 LoC, 105 files |
| `arc-w1-metadata-complete` | `0b2f0d9` | All 23 svc-metadata sub-modules + 7 top-level files → apps/api/metadata. svc-metadata reduced to a 16-line thin adapter. HealthController renamed to `MetadataHealthController` (route `/metadata/health`) to avoid collision with identity's. | ~21,200 LoC, 102 files |

**Cumulative**: ~38,400 LoC migrated across 207 files via `git mv` (history preserved).

To see the full migration narrative:

```bash
git log --oneline arc-w0-complete..arc-w1-metadata-complete | wc -l   # ~50 commits
git log --oneline arc-w1-foundation-partial..arc-w1-identity-complete  # 15 commits
git log --oneline arc-w1-identity-complete..arc-w1-metadata-complete   # 27 commits
```

## Implementation plans (executed)

- `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md` — W0 + W1 foundation slice
- `docs/superpowers/plans/2026-05-09-platform-w1-identity-migration.md` — identity migration
- `docs/superpowers/plans/2026-05-10-platform-w1-metadata-migration.md` — metadata migration

## Migration pattern (battle-tested across identity + metadata)

These lessons are baked into the working subagent prompt template. Future migrations should preserve them.

### Working-directory pinning (mandatory)

Every subagent prompt MUST start with:

```bash
cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" && pwd && git rev-parse --abbrev-ref HEAD && git log --oneline -1
```

Verify branch is `claude/nervous-volhard-f9abc2` and HEAD matches the expected previous commit. STOP and report BLOCKED if either differs.

For all subsequent Bash commands in the dispatch, prefix with `cd "/c/Users/Hubble-Wave/OneDrive - Hubble Wave/Desktop/Project HW/.claude/HW Platform/nervous-volhard-f9abc2" &&`.

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
| Standard module (has `*.module.ts` with `@Module`) | UsersModule, ScriptModule | `imports: []` + `exports: []` |
| Service-only (no Module wrapper) | InsightsIngestService, AvaIngestService | `providers: []` + `exports: []` |
| Controller + services, no Module | schema (SchemaController + SchemaDeployService + SchemaDiffService) | `controllers: []` for controller; `providers: []` + `exports: []` for services |
| Naming collision in destination | metadata's `HealthController` vs identity's | Rename file + class + route prefix in destination |
| Class name collision avoided in source | metadata's `NavigationMetadataModule` vs identity's `NavigationModule` | No alias needed — different class names |

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

Identity ran the cyclic-core bundle (66 files) + per-sub-module dispatches. Metadata ran 4-of-23 individually then combined the remaining 19 into 4 dispatches. Same quality, much less dispatch overhead.

### Self-review checklist (subagent appends to prompt)

```bash
grep -E "^\s*\*\s+\[" apps/api/src/app/<area>/<area>.module.ts
```

Verify all newly-migrated sub-modules show `[x]` in the comment-block checklist. The first metadata combined batch missed this — the @Module decorator was correct but the human-readable checklist was stale. One follow-up commit synced it. Adding the self-review step prevents this.

## What's left in W1

### Remaining instance-plane services to migrate

Each needs its own focused plan + execution following the same template:

| Service | LoC (approx) | Notes |
|---|---|---|
| svc-data | 15,000 | Likely depends on identity + metadata (already migrated); check for internal cycles |
| svc-automation | 6,000 | Already partially consolidated in Plan Fix 1 |
| svc-ava | 8,000 | AVA runtime; may have proposal state machine concerns |
| svc-control-plane | 6,000 | Different plane (multi-tenant by design); lighter migration |
| svc-workflow | 3,000 | Will likely merge with automation per canon §8 amendment |
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

Open a new Claude Code session in this worktree and say:

> Read `docs/superpowers/RESUME-CONTEXT.md` and tell me what's done.
>
> Then I want to: [insert next request — e.g. "write the svc-data migration plan", "execute the svc-automation migration", "write the W1 final cutover plan", "review the canon delta and confirm it still matches our intent"].

Auto mode for continuous execution if you want minimal interruption.

## Useful tags + commands cheat sheet

```bash
# Where am I?
git log --oneline -1

# What's the migration narrative?
git log --oneline arc-w0-complete..arc-w1-metadata-complete

# Verify everything still builds
npx nx build api && npx nx build svc-identity && npx nx build svc-metadata && npx nx build worker

# All scanners green?
npm run authz:check && npm run audit:check && npm run security:check && npm run deps:check

# What's in apps/api now?
ls apps/api/src/app/

# What's left in svc-identity / svc-metadata?
ls apps/svc-identity/src/app/   # should show only app.module.ts
ls apps/svc-metadata/src/app/   # should show only app.module.ts

# Migration progress checklist (per-area)
grep -E "^\s*\*\s+\[" apps/api/src/app/identity/identity.module.ts
grep -E "^\s*\*\s+\[" apps/api/src/app/metadata/metadata.module.ts
```

---

**End of resume context.** Update this file when a new tag lands or a locked decision changes.
