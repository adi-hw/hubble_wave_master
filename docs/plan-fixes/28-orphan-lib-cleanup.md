# Plan Fix 28 — Orphan-lib Cleanup

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR
**Related canon clauses:** §1 (greenfield discipline), §14 (delete ruthlessly)
**Triggering audit:** dead-code-allowlist.json entries flagged `owedTo: W2` after service consolidation

## Context

Three libraries were marked as orphans in `tools/dead-code-allowlist.json` during the arc-w1-complete cutover, with `owedTo: W2` — work owed to "after service consolidation finishes." PR #35 (arc-w1-complete) merged the modular monolith topology, and the orphan label can now be resolved.

All three libs lost their importers when the `svc-*` thin adapters were deleted in W1 final cutover. Their functionality was re-implemented inline in `apps/api/src/app/metadata` and `apps/api/src/app/data`. Investigation confirmed zero external consumers: no `from '@hubblewave/...'` imports anywhere in `apps/`, `libs/` (other than self-referential barrel re-exports in each lib's own `src/index.ts`), or `tools/`.

## Decisions

### libs/relationship-resolver

**Verdict:** DELETED

**Rationale:** Zero external consumers found via grep across `apps/`, `libs/`, and `tools/`. The only file containing `@hubblewave/relationship-resolver` was `libs/relationship-resolver/src/index.ts` — the lib's own barrel export (self-referential). Last meaningful git activity was `030c7bc` (Control Plane enhancements, pre-monolith era). The functionality (entity reference resolution for Lookup, Rollup, Hierarchical properties) is embedded inline in `apps/api/src/app/data` and `apps/api/src/app/metadata`. No `project.json` in this lib.

### libs/schema-engine

**Verdict:** DELETED

**Rationale:** Zero external consumers found. The only file containing `@hubblewave/schema-engine` was `libs/schema-engine/src/index.ts` itself. Last meaningful git activity was `030c7bc`. Schema engine functionality (collection DDL, schema sync, governance, versioning) is embedded inline in `apps/api/src/app/metadata`. No `project.json` in this lib.

### libs/schema-validator

**Verdict:** DELETED

**Rationale:** Zero external consumers found. The only files containing `@hubblewave/schema-validator` were `libs/schema-validator/src/index.ts` (barrel) and `libs/schema-validator/src/lib/schema-validator.module.ts` (internal NestJS module). Last meaningful git activity was `030c7bc`. Validation functionality is embedded inline in `apps/api/src/app/metadata` and `apps/api/src/app/data`. Had a `project.json` (Nx project config) — also deleted.

## Files

**Deleted directories (25 files total):**
- `libs/relationship-resolver/` — 8 files (src/index.ts + 7 lib files)
- `libs/schema-engine/` — 8 files (src/index.ts + 7 lib files including services/)
- `libs/schema-validator/` — 9 files (project.json + src/index.ts + 7 lib files)

**Modified:**
- `tsconfig.base.json` — removed 3 path mappings (`@hubblewave/schema-engine`, `@hubblewave/relationship-resolver`, `@hubblewave/schema-validator`)
- `tools/dead-code-allowlist.json` — removed 3 `owedTo: W2` orphan-lib entries

## Verification

- `npm run dead-code:check` green with orphan entries removed
- `npx nx run-many --target=build --projects=api,control-plane` green (deletions do not break dependent apps — zero external consumers confirmed pre-deletion)
- All other scanners (authz, audit, security, service-boundary, deps, compliance) green

## Out of scope

- Other libs flagged for different reasons in dead-code-allowlist.json (W4 entries: bcrypt, trash patterns, libs/enterprise, libs/ui-components)
- Reorganizing remaining libs
- Library naming or path convention changes
