# Phase 3 Prelude — Session Resume Note

**Last session ended:** 2026-05-14 (HEAD = `228c133` on `master`).

**Next pickup:** Task 5 of the Phase 3 Prelude implementation plan.

---

## Governing documents

| Doc | Path |
|---|---|
| Spec (governance, frozen) | `docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md` (commit `09d654a`) |
| Implementation plan (34 tasks) | `docs/superpowers/plans/2026-05-14-phase3-prelude-implementation.md` (commit `228c133`) |

Read both at the start of the resume session. The plan is the source of truth for what each task does. The spec is the source of truth for WHY the plan looks the way it does (cross-wave rules, preservation boundaries, exit criteria).

---

## What's done

### Section 1: Roadmap + Prelude design (frozen baseline)

| Commit | What |
|---|---|
| `09d654a` | `docs(phase3): freeze roadmap and Prelude baseline` — the governing spec |
| `228c133` | `phase3-prelude: add implementation plan` — the 34-task execution plan |

### Stream 1 sub-phase A: Scanner authoring (Tasks 1–4)

| Commit | What | Selftest | Codebase baseline |
|---|---|---|---|
| `a89aa63` | `phase3-prelude: introduce tools/scanners/ conventions` | — | — |
| `542978b` | `phase3-prelude: introduce entity-schema-ownership scanner` | 5/5 | **185 violations** |
| `aa5e450` | `phase3-prelude: introduce cross-domain-import scanner` | 3/3 | **39 violations** |
| `033df3f` | `phase3-prelude: introduce migration-filename scanner` | 5/5 | **0 violations** (after allowlist for 6 pre-Wave-1 files) |

All four scanners follow the conventions in `tools/scanners/README.md`:
- Exit non-zero on violation
- Support `--ci` JSON output
- Allowlists at `tools/scanners/<name>-allowlist.json` with `rationale` + `addedBy` + `addedAt`
- Self-tests at `tools/scanners/<name>-selftest.ts`

### Surprises and corrections during execution

These are real-world adjustments the plan didn't anticipate. Future tasks should respect them:

1. **Entity violation count is 185, not the plan's estimated ~130.** Task 7's scope is bigger than planned. Batching by schema is still the right approach; expect ~24 entities per schema on average (8 schemas, 185 entities).
2. **Cross-domain violations are 39, dominated by `<any-domain> → public.user`.** Most entities have `createdBy`/`updatedBy` FK columns to `public.users`. Task 8's allowlist needs broad `<domain>.* → public.user` entries with rationale `"FK to public.users; users intentionally stays in public per schema-split design."`
3. **TypeORM timestamp prefixes are 13 digits, not 14.** The migration-filename scanner regex was relaxed from `\d{14}` to `\d{13,14}`. Plan's "<14-digit-timestamp>" framing is stale — the rule is "13-or-14-digit-timestamp + kebab-case-name".
4. **Six pre-Wave-1 migrations are allowlisted in `tools/scanners/migration-filename-allowlist.json`** with `followUp: "permanent"`. They predate the kebab-case + no-`fix`-token convention; renaming would rewrite committed history.
5. **Path resolution bug in the plan's spec code for Task 3** — imports ending `.entity` would have been double-suffixed to `.entity.entity.ts`. The scanner now handles three cases: `.entity.ts` (as-is), `.entity` (append `.ts`), bare (append `.entity.ts`).
6. **Multi-line `@Entity({...})` regex blindness** — both entity-schema-ownership and cross-domain-import scanners use `[\s\S]*?` instead of `[^}]*` to handle decorators authored across multiple lines.
7. **Cross-domain scanner caveats documented in its header**: barrel re-exports (`import X from '../entities'`) are silently skipped; case-insensitive filesystems may miss non-lowercase `.entity.ts`; kebab conversion assumes CamelCase discipline.

These adjustments are committed in the scanner code + scanner docstrings; no plan amendments needed.

---

## Where to pick up

**Next: Task 5 of the implementation plan.**

The remaining Stream 1 sub-phase B (Tasks 5–10) is the heavy lift:

- **Task 5:** Audit + stage the 11 untracked `1940000000000`–`1942000000000` migration files. Verify each has working `down()` (or documented `IRREVERSIBLE` rationale). Verify schema-qualified identifiers throughout. Stage but don't commit.
- **Task 6:** Cross-verify `tools/scanners/entity-schema-manifest.json` against the live DB. Build was already done in Task 2; this is a sanity check + refinement.
- **Task 7:** Update ~185 entity decorators across 8 domain schemas. Execute in batches per schema; running entity-schema scanner after each batch confirms count decreasing. **Final landing remains atomic** — no intermediate commits inside Task 7.
- **Task 8:** Triage the 39 cross-domain violations. Populate `tools/scanners/cross-domain-allowlist.json` with legitimate FK relations (most are `<domain>.* → public.user`). Each entry needs `rationale` + `addedBy` + `addedAt`.
- **Task 9:** Atomic Stream 1 commit: entities + migrations + manifest + allowlist + `search_path` removal from `libs/instance-db/src/lib/instance-db.module.ts` + new `tools/scanners/generate-schema-ownership-map.ts` + generated `docs/architecture/schema-ownership-map.md`. **Single commit** with message `phase3-prelude: finalize schema split and remove runtime bridge`. Includes the fresh-DB rebuild verification + login smoke (with readiness polling, not fixed sleeps).
- **Task 10:** Stream 1 exit gate — re-verify all scanners pass, all selftests pass, fresh-DB build works, no `search_path` reference in runtime code.

---

## Working tree state at session end

**HEAD:** `228c133` on `master`.

### Modified files (uncommitted, pre-Prelude smoke work — all addressed by Prelude tasks)

| File | Disposition |
|---|---|
| `apps/api/src/app/automation/runtime/automation-runtime.module.ts` | Cosmetic only — Stream 2 or accept as-is |
| `apps/api/src/app/data/grid/grid.module.ts` | Cosmetic only — Stream 2 or accept as-is |
| `apps/api/src/app/identity/auth/guards/permissions.guard.ts` | **Bridge** — duplicate PermissionsGuard with warn-and-allow. Stream 2 Task 11 DELETES this file. |
| `apps/api/src/app/identity/identity.module.ts` | **Locked direction** — AbacGuard removed from APP_GUARD. Stream 2 commits this in Task 18. |
| `apps/api/src/app/metadata/access/access.module.ts` | **Real fix** — AuthModule moved out of forFeature array. Stream 2 commits this in Task 18. |
| `apps/web-client/vite.config.mts` | **Real fix + transitional comment** — proxy retargeted at modular monolith. Stream 2 Task 15 adds the transitional comment header; Task 18 commits. |
| `libs/auth-guard/src/lib/permissions.guard.ts` | **Locked direction** — warn-and-allow on canonical lib guard. Stream 2 commits in Task 18. |
| `libs/authorization/src/lib/authorization.service.ts` | Cosmetic only (`ctx` → `_ctx` unused param) — Stream 2 or accept as-is. |
| `libs/instance-db/src/lib/instance-db.module.ts` | **Bridge** — `search_path` clause. Stream 1 Task 9 REMOVES atomically with entity updates. |
| `migrations/instance/1930900000001-backfill-audit-log-hash-chain.ts` + deleted `.spec.ts` | Pre-Prelude; accept as-is or escalate. Not in Prelude scope. |
| `package-lock.json` | Lock file drift; accept as-is. |
| `scripts/datasource-instance.ts` | **Real fix** (migrationsTransactionMode). Commit when convenient. |
| `scripts/seed-admin-user.ts` | **Real fix** — schema-qualified RBAC tables. Stream 2 commits in Task 18 (or accept as part of Stream 1's atomic landing if cleaner). |

### Untracked files

- **11 schema migrations** `migrations/instance/1940000000000-notify-schema.ts` through `1942000000000-cross-domain-read-diff-table.ts` — Stream 1 Task 5 stages, Task 9 commits atomically.
- **11 `apps/svc-*` directories** — Phase 1 deletion leftovers (deleted in `arc-w1-complete` tag but still on disk). Stream 3 Task 20 lists for deletion approval.
- Various other untracked (`docs/REMEDIATION-BACKLOG.md`, `docs/adrs/`, `docs/api-contracts.md`, `libs/api-clients/`, `libs/observability/`, `libs/metadata-reader/`, etc.) — Stream 3 Task 20 inventories.

---

## Sub-agent dispatch convention used (continue this in resume session)

- Implementer: `Agent({subagent_type: "general-purpose", model: "sonnet"})` with full task text + context inline, NEVER asking the subagent to read the plan file.
- Spec compliance review: `Agent({subagent_type: "general-purpose", model: "haiku"})` — read the actual code, verify against the plan's task spec independently.
- Code quality review: `Agent({subagent_type: "general-purpose", model: "haiku"})` — strengths + Critical/Important/Minor issues + Assessment.
- Fix loops: same model as the original implementer; if reviewer found Critical or Important issues, dispatch fix subagent before marking task complete.
- Run all three reviews + fix loops PER TASK before moving to the next task. No skipping reviews.
- **Stream 3 Task 26 is a hard stop** — surface the deletion ledger and wait for user approval before proceeding to Task 27.

---

## What this resume note does NOT cover

- Stream 2 / 3 / 4 detail — those are in the plan file.
- Long-term governance — that's in the spec.
- Phase 1/2 smoke history — that's in memory: `phase1_2_smoke_bridges.md`.

If the resume session needs context beyond what's in this note + the plan + the spec, escalate before proceeding.
