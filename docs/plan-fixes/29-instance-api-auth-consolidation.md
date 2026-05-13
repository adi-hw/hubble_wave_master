# Plan Fix 29 — instance-api/identity/auth Consolidation (§29.9)

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR
**Related canon clauses:** §29.9 (HS256 forbidden everywhere)
**Triggering audit:** Item 13 of pending Phase 2 backlog — "Known canon §29.9 violation — parallel HS256 path"

## Context

Canon §29.9 forbids HS256 algorithm anywhere in the codebase. A parallel auth path at
`apps/api/src/app/instance-api/identity/auth/` was using `JwtModule.registerAsync` with a
symmetric `JWT_SECRET`/`IDENTITY_JWT_SECRET` to sign access tokens via `JwtService.sign(payload)`
— a direct HS256 violation. The path was live: the web client's base-URL convention
(`VITE_IDENTITY_API_URL = '/api/identity'`, then `/auth/login`) resolved to
`/api/identity/auth/login`, which was served by the parallel controller at
`@Controller('identity/auth')`.

## Investigation findings

The parallel `apps/api/src/app/instance-api/identity/auth/` directory contained:

| File | Purpose | HS256 violation |
|---|---|---|
| `auth.service.ts` | Login / logout / refresh logic | Yes — `this.jwtService.sign(payload)` |
| `auth.controller.ts` | Routes: POST login/refresh/logout, GET me | No direct HS256, but calls HS256 service |
| `auth-events.service.ts` | Auth event logging to `auth_events` table | No signing |
| `permission-resolver.service.ts` | In-memory role/permission cache | No signing |
| `refresh-token.service.ts` | Canon §29.5 refresh family contract | No signing (opaque tokens) |
| `sso-config.controller.ts` | GET SSO provider config | No signing |
| `dto/login.dto.ts` | Login DTO | — |
| `dto/user-profile.dto.ts` | Profile response shape | — |

The `identity.module.ts` registered `JwtModule.registerAsync({ secret: JWT_SECRET, ... })` —
the explicit HS256 symmetric key path. The comment in `auth.service.ts` line 137 confirmed the
violation: _"The instance-api duplicate still mints HS256-signed access tokens via JwtService"_.

The canonical `apps/api/src/app/identity/auth/` already uses `TokenIssuerService` (ES256 via
`KeySigningService`) per the §29 PR-A/B/C/D chain. The parallel path was a carry-over from
the `svc-instance-api` fold-in that was not cleaned up when the canonical auth path was upgraded.

**Decision: MIGRATE then DELETE.**

The web client calls the `identity/auth/*` routes and cannot be silently redirected to `auth/*`
without a client-side change. The migration creates a thin alias controller at
`@Controller('identity/auth')` that delegates to the canonical `AuthService` (ES256) instead.

## Files

### Deleted (8 files — the HS256 parallel path)

- `apps/api/src/app/instance-api/identity/auth/auth.service.ts`
- `apps/api/src/app/instance-api/identity/auth/auth.controller.ts`
- `apps/api/src/app/instance-api/identity/auth/auth-events.service.ts`
- `apps/api/src/app/instance-api/identity/auth/permission-resolver.service.ts`
- `apps/api/src/app/instance-api/identity/auth/refresh-token.service.ts`
- `apps/api/src/app/instance-api/identity/auth/sso-config.controller.ts`
- `apps/api/src/app/instance-api/identity/auth/dto/login.dto.ts`
- `apps/api/src/app/instance-api/identity/auth/dto/user-profile.dto.ts`

### Created (1 file — thin alias controller)

- `apps/api/src/app/instance-api/identity/auth/identity-auth-alias.controller.ts`
  — mounts at `@Controller('identity/auth')`, delegates every request to the canonical
  `AuthService`. No business logic. No token signing. No HS256.

### Modified (4 files — module wiring + scanner updates)

- `apps/api/src/app/instance-api/identity/identity.module.ts`
  — Rewritten: imports canonical `AuthModule` instead of registering its own `JwtModule`.
  Registers `IdentityAuthAliasController`.

- `apps/api/src/app/instance-api/instance-api.module.ts`
  — Trimmed: removed duplicate infrastructure imports (`InstanceDbModule`, `AuthGuardModule`,
  `GlobalGuardsModule`, `TypeOrmModule.forFeature(...)`, `AuthorizationModule.forRoot(...)`,
  `RedisModule`, `ScheduleModule`, `EventEmitterModule`) that were only needed for the parallel
  HS256 module. Now imports only `IdentityModule` (thin alias) and registers
  `InstanceApiHealthController`.

- `tools/security-bypass-check.ts`
  — `PUBLIC_ALLOWLIST` updated: removed `instance-api/identity/auth/auth.controller.ts` and
  `instance-api/identity/auth/sso-config.controller.ts`; added
  `instance-api/identity/auth/identity-auth-alias.controller.ts`.

- `tools/service-boundary-check.ts`
  — `KNOWN_VIOLATIONS` updated: 4 entries added for the deliberate cross-boundary imports
  from `svc-instance-api` into `svc-identity` (alias controller → canonical `AuthService`,
  `LoginDto`, `UserProfileDto`; and `IdentityModule` → canonical `AuthModule`).

## Verification

- `grep -rE "['\"]HS256['\"]" apps/api/ libs/ --include="*.ts"` returns:
  - `oauth2.service.ts` — OIDC discovery doc listing supported algorithms for external RPs
    (not a signing path)
  - `auth.module.ts` — comment documenting that HS256 is no longer used
  - `jwt.strategy.ts` — comment documenting removed HS256 path
  - `auth-guard.module.ts` — comment documenting removed HS256 path
  - `key-signing.service.ts` — canon reference comment
  Zero HS256 signing code paths remain.

- All scanners green: `security:check`, `authz:check`, `audit:check`,
  `service-boundary:check`, `dead-code:check`, `deps:check`.

- TypeScript compilation: no new errors from changed files (pre-existing errors in
  `analytics/dashboards`, `libs/storage` are unrelated to this change).

- Web client routes unchanged: `POST /api/identity/auth/login`,
  `POST /api/identity/auth/refresh`, `POST /api/identity/auth/logout`,
  `GET /api/identity/auth/me` all continue to resolve to the alias controller, which
  delegates to canonical `AuthService` (ES256).

## Out of scope

- `KeySigningService` implementation changes (already landed in §29 PR-A).
- Reviewing other potential HS256 hideouts (Phase 4 grep confirms none exist).
- The `POST /api/auth/*` canonical controller routes are unchanged and continue to work.
- The `SsoConfigController` in the parallel path served `GET identity/auth/sso/config`.
  The canonical `SsoConfigController` at `@Controller('auth/sso/config')` serves the same
  data. The alias controller does not re-expose this route; the web client's SSO config
  calls go through the canonical path at `/api/auth/sso/config` (via `VITE_IDENTITY_API_URL`
  + `/sso/config` in `SSOConfigPage.tsx`).
