# Plan Fix 35 — Setup Script Cleanup

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR
**Related canon clauses:** §1 (greenfield discipline), §29 (identity & service auth)
**Triggering audit:** discovered during user-driven dev bootstrap on 2026-05-13 — script had drifted past multiple Plan Fixes

## Context

`scripts/setup.ts` is the one-command dev bootstrap. It hadn't been updated since the §29 identity wave + Plan Fix 31 (ts-node→tsx) + Plan Fix 29 (HS256 removal) + W6.C PgBouncer landed. Result: the generated `.env` produced env vars the runtime ignores or warns about, missed the env vars the runtime now requires, and the printed summary referenced dev scripts that were deleted in arc-w1-complete.

## What landed

### .env generation
- Removed `JWT_SECRET` (warns at boot per `auth.module.ts:131-142`; signing migrated to ES256/KMS per canon §29 PR-A)
- Removed `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` (replaced by §29 TTL vars)
- Removed pre-monolith `PORT_IDENTITY`, `PORT_DATA`, `PORT_METADATA`, `PORT_AVA`, `PORT_AUTOMATION`, `PORT_VIEW_ENGINE`, `PORT_INSIGHTS` vars
- Added `JWT_KEY_PROVIDER=local-es256` (canon §29.9 mandates)
- Added `JWT_ACCESS_TTL_SECONDS=600` (canon §29.4 — 10 minutes; note: runtime reads `JWT_ACCESS_TTL_SECONDS` not `JWT_ACCESS_TTL_MINUTES`)
- Added `JWT_REFRESH_TTL_DAYS=14` (canon §29 PR-C)
- Added `JWT_BOOTSTRAP_SECRET=<random>` (canon §29 PR-D dev service-token bootstrap)
- Added `DIRECT_DB_HOST=localhost`, `DIRECT_DB_PORT=5432` (W6.C PgBouncer; migration runner bypasses pool)
- Added `DIRECT_CONTROL_PLANE_DB_HOST=localhost`, `DIRECT_CONTROL_PLANE_DB_PORT=5432` (same, for control-plane DB)
- Added `API_PORT=3000` (modular monolith single API process)

### Summary output
- Replaced dead `dev:identity/data/metadata` references with `dev:api/worker/web/control-plane/web-control-plane/platform/all`
- Updated port references (removed pre-monolith service ports)
- Added "Admin password is printed by seed-admin-user.ts during setup" to Credentials block
- Shows which services were skipped when --skip-ava or --skip-search are used

### New flags
- `--skip-ava`: skips Ollama wait + platform-knowledge seed (minimal login-only bootstrap)
- `--skip-search`: skips TypeSense wait + TypeSense bootstrap (minimal login-only bootstrap)

### Tooling alignment
- Internal `execSync` calls within setup.ts switched from `npx ts-node` to `npx tsx` for `seed-admin-user.ts`, `bootstrap-buckets.ts`, `bootstrap-typesense.ts`, `seed-platform-knowledge.ts` (Plan Fix 31)
- New `setup:minimal` script in package.json: `npx tsx scripts/setup.ts --skip-ava --skip-search`

## Out of scope

- `apps/api/src/app/instance-api/identity/` and `apps/api/src/app/instance-api/identity/auth/refresh-token.service.ts` still reference `JWT_SECRET` — appears to be leftover from Plan Fix 29 incomplete cleanup. Tracked as a separate Plan Fix.
- `apps/api/src/app/identity/oidc/oidc.module.ts:21` uses `configService.get('JWT_SECRET') || 'dev-secret-key'` — canon §29.9 violation (HS256 fallback). Tracked as a separate Plan Fix.
- `scripts/generate-local-dev-secrets.ts` still generates `JWT_SECRET` and `IDENTITY_JWT_SECRET` — stale from pre-§29 era. Tracked as a separate Plan Fix.

## Acceptance

- `npm run setup` produces a `.env` whose every var is actually consumed
- `npm run setup:minimal` completes without Ollama or TypeSense running
- Boot logs no longer warn "JWT_SECRET is set but unused"
- The summary references only scripts that exist in `package.json`
- All scanners green
