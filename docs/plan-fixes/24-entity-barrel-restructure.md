# Plan Fix 24 — Entity Barrel Restructure

**Status:** In progress (PR-A complete; PR-B/PR-C may follow if measured benefit justifies them)
**Owner:** adi-hw
**Effort:** 1–3 PRs depending on follow-through
**Related canon clauses:** §1 (greenfield), §17 (modular monolith)
**Triggering audit:** F031 — "god-package entity barrel (130+ entities, every service loads all)"

## Context

`libs/instance-db/src/lib/entities/index.ts` grew to a single file with 52 entity source files
re-exported in one place — roughly 1 100 lines at its peak. Every consumer (`apps/api`,
`apps/worker`, `apps/control-plane`, `apps/svc-migrations`) imported the entire entity set at
boot via the `@hubblewave/instance-db` package barrel with no visibility into which domain owned
which entity.

The modular-monolith architecture (canon §17) means all four processes legitimately share the
same entity set, so per-service splitting is not warranted. What is warranted is per-area
conceptual clarity: clear ownership lines, easier navigation, and a foundation for any
future per-module TypeORM `forFeature` declarations if measured boot-time benefit ever
justifies that work.

The original plan-fixes README listed Plan Fix 24 as "Superseded by Architecture v3." The
founder's pending Phase 2 list subsequently re-flagged F031 as "design-locked option A
(~4–6 sub-PRs)" — specifically per-area FILES inside `libs/instance-db`, not per-service
splits. This document tracks that revived work.

## PR-A (this PR): per-area entity files

Split the monolithic `index.ts` into eight area-level sibling files. The barrel at `index.ts`
now re-exports via `export * from './identity'` etc., so the public API of
`@hubblewave/instance-db` is unchanged — zero consumer import changes required.

**Files created:**

| File | Area | Entity source files covered |
|---|---|---|
| `identity.ts` | Users, RBAC, sessions, auth tokens, signing keys, service principals, advanced auth | `user`, `role`, `permission`, `role-permission`, `group`, `auth-config`, `auth-tokens`, `key-metadata`, `service-principal`, `advanced-auth` |
| `metadata.ts` | Schema engine, access-control rules, forms, views, navigation, workspaces, packs, search, localization | `application`, `collection-definition`, `property-definition`, `property-type`, `collection-index`, `schema-change-log`, `schema-sync-state`, `access-rule`, `access-conditions`, `module`, `form`, `view`, `navigation-module`, `workspace`, `display-rule`, `pack`, `search`, `localization`, `dependent-review-queue`, `change-package` |
| `automation.ts` | Business rules, process flows, SLA, decision tables, guided processes, connectors, event outbox | `automation`, `process-flow`, `sla`, `decision-table`, `guided-process`, `connector`, `event-outbox` |
| `ava.ts` | AVA conversations, registry, proposals, ModelOps, app-builder | `ava`, `ava-registry`, `ava-proposal`, `modelops`, `app-builder` |
| `settings.ts` | Instance settings, navigation, themes, user preferences, audit logs, runtime anomalies | `settings`, `navigation`, `instance-config`, `theme`, `user-preference`, `audit`, `runtime-anomaly` |
| `analytics.ts` | Dashboards, metrics, reports | `analytics` |
| `notifications.ts` | Notification templates, queue, in-app, push tokens | `notification` |
| `integrations.ts` | OAuth, webhooks, external connectors, import/export, sync | `integration` |

**`instanceEntities` array** in `index.ts` is preserved verbatim (same entries, same order,
duplicates removed that were already present in the original). TypeORM configuration is
unchanged.

**Verification:**

- `npx tsc --noEmit -p libs/instance-db/tsconfig.lib.json` — clean (zero errors)
- `npx tsc --noEmit -p apps/worker/tsconfig.app.json` — clean
- `npx tsc --noEmit -p apps/control-plane/tsconfig.app.json` — clean
- `npx tsc --noEmit -p apps/svc-migrations/tsconfig.app.json` — clean
- `apps/api` has one pre-existing `@aws-sdk/client-kms` missing-package error (unrelated to
  this change; tracked separately)
- `npm run audit:check` — ok (4 pre-existing deferred sites, unchanged)
- `npm run service-boundary:check` — ok (pre-existing allowlisted reads, unchanged)
- `npm run dead-code:check` — ok (pre-existing W4-owed allowlist entries, unchanged)
- `npm run compliance:check` — ok (pre-existing warnings, unchanged)

## PR-B (deferred unless measured benefit justifies it): per-module TypeORM entity sets

Replace the single `instanceEntities` array with per-module `TypeOrmModule.forFeature([...])`
declarations so each NestJS module registers only the entities it owns. This is a larger
refactor touching every NestJS module file. It is only worth doing if profiling shows a
meaningful reduction in startup time or memory — the TypeORM entity registry is not known to
be a bottleneck at current scale. Do not start this PR without a measured baseline.

## PR-C (deferred unless needed): scanner enforcement of area boundaries

Add a scanner rule that rejects a direct import of a per-area file path (e.g.,
`@hubblewave/instance-db/lib/entities/identity`) from outside `libs/instance-db`. All external
consumers must continue to import from `@hubblewave/instance-db`. Currently enforced by
convention and documented in the barrel comment; a scanner would make it CI-gated.

## Acceptance criteria (PR-A)

- [x] `libs/instance-db/src/lib/entities/index.ts` is a thin re-export from per-area files
- [x] Public API of `@hubblewave/instance-db` is unchanged (every entity still exported)
- [x] `instanceEntities` TypeORM array preserved without duplication
- [x] All four build targets type-check clean (pre-existing unrelated errors excluded)
- [x] All CI scanners pass (pre-existing tracked violations excluded)
- [x] CLAUDE.md §1 god-package note updated to reflect the new structure
- [x] CLAUDE.md §24 amendment log entry added
- [x] README.md plan-fixes index updated to reflect Plan Fix 24 revived status

## Out of scope (PR-A)

- Updating any consumer's import path
- Removing the barrel
- Per-module TypeORM entity declaration changes (PR-B)
- Scanner enforcement of area boundaries (PR-C)
