# Plan Fix 36 — Complete HS256 Elimination Across Identity Surfaces

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR
**Related canon clauses:** §29.9 (HS256 forbidden everywhere)
**Triggering audit:** Plan Fix 35 (setup.ts cleanup, PR #54) surfaced 3 HS256 leftovers that Plan Fix 29 (PR #43) missed. Plus a leftover Claude session debris file.

## Context

Plan Fix 29 deleted the parallel HS256 auth stack at `apps/api/src/app/instance-api/identity/auth/` (except the alias controller). However, several HS256-era artifacts survived:

1. `scripts/generate-local-dev-secrets.ts` (lines 53-54) emitted `JWT_SECRET` + `IDENTITY_JWT_SECRET` for dev .env generation
2. `scripts/setup.ts` (line 79) emitted `JWT_SECRET` in the generated .env block
3. `apps/api/src/app/identity/oidc/oidc.module.ts:21` used `configService.get('JWT_SECRET') || 'dev-secret-key'` — HS256 with a hardcoded weak fallback
4. `apps/api/src/app/data/integration/oauth2.service.ts` (live violator) read `JWT_SECRET`/`IDENTITY_JWT_SECRET` and called `jwt.sign`/`jwt.verify` (HS256 jsonwebtoken)
5. `scripts/tmpclaude-8c30-cwd` — Claude session debris file (plain text with a path string)

**Investigation findings vs. original ticket:**

- Leftover 1 (`scripts/generate-local-dev-secrets.ts`): CONFIRMED — emits JWT_SECRET + IDENTITY_JWT_SECRET.
- Leftover 2 (`identity.module.ts` lines 51-56): FALSE ALARM — Plan Fix 29 already migrated it; no JWT_SECRET reads present.
- Leftover 3 (`instance-api/identity/auth/refresh-token.service.ts`): FALSE ALARM — file does not exist; Plan Fix 29 deleted it.
- Leftover 4 (`oidc.module.ts:21`): CONFIRMED — JwtModule with HS256 + hardcoded fallback.
- Leftover 5 (`scripts/tmpclaude-8c30-cwd`): CONFIRMED — debris file (plain text, not a directory).
- New discovery: `apps/api/src/app/data/integration/oauth2.service.ts` — active live HS256 violator not in the original ticket list.
- New discovery: `scripts/setup.ts` also emits JWT_SECRET.

## What landed

| Artifact | Decision | Rationale |
|---|---|---|
| `scripts/generate-local-dev-secrets.ts:53-54` | EDIT: replace `JWT_SECRET` + `IDENTITY_JWT_SECRET` with `JWT_BOOTSTRAP_SECRET` | JWT_SECRET has no live instance consumers post-migration; JWT_BOOTSTRAP_SECRET is the canon §29.7 dev-bootstrap secret |
| `scripts/setup.ts:79` | EDIT: replace `JWT_SECRET` + stale `JWT_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` with `JWT_BOOTSTRAP_SECRET` | Same rationale; TTL vars replaced by `JWT_ACCESS_TTL_SECONDS`/`JWT_REFRESH_TTL_DAYS` per canon §29.4 |
| `identity.module.ts` | NO CHANGE — already clean | Plan Fix 29 already migrated it |
| `instance-api/identity/auth/refresh-token.service.ts` | NO CHANGE — already deleted | Plan Fix 29 already deleted it |
| `apps/api/src/app/identity/oidc/oidc.module.ts` | EDIT: remove `JwtModule.registerAsync` block entirely | `OidcService` is fully stubbed (throws for every method); `SsoAdminController` does not inject `JwtService`; no code path consumes the registration |
| `apps/api/src/app/data/integration/oauth2.service.ts` | MIGRATE: replace `jwt.sign`/`jwt.verify` (HS256 jsonwebtoken) with `KeySigningService.sign()` + `decodeJwt` (ES256, jose) | Live violator; discovery not in original ticket |
| `scripts/tmpclaude-8c30-cwd` | DELETE via `git rm` | Plain-text Claude session debris |
| `tools/dead-code-allowlist.json` | EDIT: remove `scripts/tmpclaude-8c30-cwd` entry | Canon §21 ratchet — allowlist shrinks when the tracked item is deleted |

### `oauth2.service.ts` migration details

- Replaced `import * as jwt from 'jsonwebtoken'` with `import { decodeJwt } from 'jose'` and `import { KEY_SIGNING_SERVICE, KeySigningService } from '@hubblewave/auth-guard'`
- Removed `private readonly jwtSecret: string` field and the constructor fail-closed secret-reading block
- Added `@Inject(KEY_SIGNING_SERVICE) private readonly keySigning: KeySigningService` constructor parameter
- `generateAccessToken` is now `async`, returns `Promise<string>`, calls `this.keySigning.sign(payload)` with explicit `iat`/`exp` claims
- `validateAccessToken` now uses `decodeJwt(token)` (claim extraction without re-verification; the DB row already proves revocation + expiry)
- `getDiscoveryDocument`: removed `HS256` from `id_token_signing_alg_values_supported`; now advertises `ES256` only

## Files changed

**Deleted (1):**
- `scripts/tmpclaude-8c30-cwd`

**Modified (6):**
- `apps/api/src/app/data/integration/oauth2.service.ts` — HS256 → ES256 migration
- `apps/api/src/app/identity/oidc/oidc.module.ts` — removed vestigial `JwtModule` registration
- `scripts/generate-local-dev-secrets.ts` — replaced JWT_SECRET/IDENTITY_JWT_SECRET with JWT_BOOTSTRAP_SECRET
- `scripts/setup.ts` — replaced JWT_SECRET + stale TTL vars with JWT_BOOTSTRAP_SECRET
- `tools/dead-code-allowlist.json` — removed entry for deleted file (ratchet)

**Created (1):**
- `docs/plan-fixes/36-hs256-elimination-completion.md` (this file)

## Verification

- `grep` for `JWT_SECRET`/`IDENTITY_JWT_SECRET` in `apps/api/**/*.ts` → comments only (migration notes, warning block) + 1 test fixture
- `grep` for `JWT_SECRET`/`IDENTITY_JWT_SECRET` in `scripts/**/*.ts` → zero
- `grep` for `HS256` in `apps/api/**/*.ts` → comments only (migration history)
- `grep` for `jwt.sign` / `jwt.verify` / `jsonwebtoken` signing calls in `apps/api/**/*.ts` → zero
- `grep` for `createHmac('sha256', ...)` outside audit-log-hash → 2 results (both legitimate: backup payload signing + webhook HMAC, not JWT)
- All 9 scanners green (authz:check, audit:check, security:check, compliance:check, service-boundary:check, deps:check, cicd:check, dead-code:check, migrations:check, silent-skip:check)
- TypeScript compile: 2 pre-existing errors (aws-sdk/client-kms type declarations missing; authorization.service.ts unused variable) — zero new errors introduced

## Out of scope

- The `auth.module.ts:131-142` "JWT_SECRET is set but unused" warning block — that's defensive logging for operators who haven't cleaned their .env yet; kept per spec
- F139 SAML signature work or any other non-OIDC signed-token surface
- Control plane (`apps/control-plane`) legitimately uses `JWT_SECRET` — that's a separate multi-tenant SaaS service (canon §18) not subject to canon §29 instance-plane ES256 requirement
- `libs/shared-types/src/lib/security/jwt-config.ts` and `config-validation.ts` — these validate the presence of `JWT_SECRET` for the control plane; out of scope
- `libs/shared-types` JWT_SECRET references in tests — out of scope (test fixtures)

## Acceptance

- Canon §29.9 obligation closed across all identity surfaces in the instance plane
- Zero HS256 signing code paths in `apps/api` + `libs/` (excluding control plane and test fixtures)
- `KeySigningService` is the single ES256 signing path for all instance-plane JWT issuance
- `jwt.sign(payload, secret)` with a symmetric secret is eliminated from `apps/api`
