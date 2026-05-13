# Plan Fix 33 — Admin Bypass Retirement (canon §28.6)

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR
**Related canon clauses:** §9, §10, §28 (specifically §28.6 commitment)
**Triggering audit:** F021 (interim audit on admin bypass) — canon §28.6 binds removal

## Context

Pre-§28, the platform short-circuited authz for admin-role users via `if (ctx.isAdmin) return true`
at multiple sites in `libs/authorization` and `libs/auth-guard`. F021's audit-row emission on every
bypass site was the interim compliance layer.

Canon §28.6 ("Admin-role users go through the same evaluator. They are not short-circuited")
binds the platform to retire the bypass entirely. This PR delivers on that commitment.

## What landed

### 1. Seed admin policies migration

`migrations/instance/1931100000000-seed-admin-policies.ts` inserts for each system/platform
collection (37 collection codes enumerated in the migration):

- One `CollectionAccessRule` row: `role_id = <admin_role_id>`, `can_read/can_create/can_update/can_delete = true`, `effect = 'allow'`, `conditions = NULL` (unconditional), `rule_key = 'seed:admin:<code>'`. Priority 0 (highest).
- One `PropertyAccessRule` wildcard row: `property_id = NULL`, `wildcard_collection_id = <collection_id>`, `role_id = <admin_role_id>`, `can_read = true`, `can_write = true`, `masking_strategy = 'NONE'`, `effect = 'allow'`, `rule_key = 'seed:admin:wildcard:<code>'`.

Idempotent via `ON CONFLICT DO NOTHING` keyed on the existing `(collection_id, rule_key)` partial
index from migration `1820000000000-access-policy-metadata.ts`. The admin role id is resolved at
migration run time (`SELECT id FROM roles WHERE code = 'admin'`).

`down()` removes the seeded rows by `rule_key`. The bypass is NOT re-added on rollback; operators
who roll back this migration accept that admin loses access until policies are re-seeded.
Forward-only is the recommended path.

### 2. Bypass removal

Deleted `if (ctx.isAdmin) return true` (and equivalent blocks) at:

- `libs/authorization/src/lib/authorization.service.ts` — 9 bypass sites removed:
  - `canAccessCollection` (collection-level check + F021 wouldBe audit branch)
  - `getSafeRowLevelPredicatesForCollection` (row-filter)
  - `buildCollectionRowLevelClause` (row-clause)
  - `getAuthorizedFieldsForCollection` (field auth)
  - `maskCollectionRecord` (masking)
  - `canAccessCollectionRecord` (record-level check)
  - `canAccessTable` (deprecated wrapper)
  - `ensureTableAccess` (deprecated wrapper)
  - `getSafeRowLevelPredicates` (deprecated wrapper)
  - `buildRowLevelClause` (deprecated wrapper)
  - `getAuthorizedFields` (deprecated wrapper)
  - `canAccessRecord` (deprecated wrapper)
- `libs/auth-guard/src/lib/permissions.guard.ts` — 1 bypass site removed:
  - `if (userRoles.includes('admin') || userRoles.includes('super_admin')) return true`

### 3. F021 interim audit emission

The private `auditAdminBypass` helper in `AuthorizationService` and its `AccessAuditPort`
DI injection (`ACCESS_AUDIT_PORT`) were removed from `AuthorizationService` because all callers
(the bypass sites) are gone.

**Retained:** The `AccessAuditPort` interface and its `logAdminBypass` method remain in
`libs/authorization/src/lib/audit-port.ts` and continue to be exported. The `auth.service.ts` and
`token-issuer.service.ts` consumers that use `ACCESS_AUDIT_PORT` for security event audit logging
(refresh token reuse, etc.) are unaffected.

### 4. Tests

- Replaced the 7 F021 bypass-audit tests in `authorization.service.spec.ts` with 6 new
  §28.6 evaluator tests: admin-via-seeded-policy positive cases + regression guard
  (admin without seeded policy gets denied).
- Updated the existing `'admins bypass collection-level checks'` test to two tests:
  - `canon §28.6: admin with seeded policy rule is allowed via the §28 evaluator`
  - `canon §28.6: admin WITHOUT seeded policies is denied — bypass is gone`
- Updated the F005 admin test (test 9) to use a seeded wildcard property rule.

## Acceptance

- 10+ bypass sites removed across `libs/authorization` + `libs/auth-guard`
- Seed migration `1931100000000-seed-admin-policies.ts` installs broad admin policies
- All existing authz tests updated; new §28.6 regression guard tests added
- `AccessAuditPort.logAdminBypass` retained on the interface (per task scope); DI injection
  removed from `AuthorizationService` only
- §28 evaluator handles admin uniformly with other roles
- Canon §28.6 obligation fulfilled

## Out of scope

- Customizing which system collections are admin-accessible (operator concern)
- Per-tenant admin role variations (W4 customization layer territory)
- Removal of `ctx.isAdmin` from `RequestContext` — the field is retained as a UI/audit hint
  even though it no longer drives authz decisions in the evaluator
- Removal of `AccessAuditPort.logAdminBypass` interface method (W4 cleanup)
