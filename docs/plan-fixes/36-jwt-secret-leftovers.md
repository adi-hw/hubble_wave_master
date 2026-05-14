# Plan Fix 36 — JWT_SECRET Leftovers from Plan Fix 29/35

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR
**Related canon clauses:** §1 (greenfield), §14 (delete ruthlessly), §29.9 (HS256 forbidden everywhere)
**Triggering audit:** Two `JWT_SECRET` sites left out of scope by Plan Fix 29 (instance-api auth consolidation) and Plan Fix 35 (setup.ts §29 alignment):
1. `apps/api/src/app/identity/oidc/oidc.module.ts:21` — `JwtModule.registerAsync` with `JWT_SECRET || 'dev-secret-key'`
2. `scripts/generate-local-dev-secrets.ts:53-54` — emits `JWT_SECRET` + `IDENTITY_JWT_SECRET` into developer .env files

## Context

Canon §29.9 binds the platform to ES256 signing via `KeySigningService` (AWS KMS in production, `LocalEs256KeySigningService` in development). HS256 is forbidden everywhere — no symmetric-key dev path, no fallback. Plan Fix 29 deleted the parallel HS256 path in `apps/api/src/app/instance-api/identity/auth/`. Plan Fix 35 migrated `scripts/setup.ts` to emit `JWT_KEY_PROVIDER=local-es256` + `JWT_BOOTSTRAP_SECRET` instead of `JWT_SECRET`.

Two sites slipped through:

### Site 1 — `oidc.module.ts`

```typescript
JwtModule.registerAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    secret: configService.get<string>('JWT_SECRET') || 'dev-secret-key',
    signOptions: { expiresIn: '15m' },
  }),
  inject: [ConfigService],
}),
```

Two §29.9 violations in one block:
- Uses `JWT_SECRET` as a symmetric signing secret.
- Falls back to the hardcoded literal `'dev-secret-key'` when `JWT_SECRET` is unset — would silently mint forgeable tokens in any deployment with the env var missing.

Investigation showed the registration is **dead code**: `OidcController`, `OidcService`, and `SsoAdminController` do not inject `JwtService`. The local `OidcService` is a stub that throws `UnauthorizedException('OIDC is disabled for this deployment.')`. The canonical SSO/OIDC implementation lives in `apps/api/src/app/identity/auth/sso/`; this module retains only an admin CRUD surface (`SsoAdminController`) for provider configuration rows in `sso_providers`.

### Site 2 — `generate-local-dev-secrets.ts`

```typescript
const jwtSecret = hex(64);
// ...
JWT_SECRET=${jwtSecret}
IDENTITY_JWT_SECRET=${jwtSecret}
```

Plan Fix 35 fixed the parallel emission in `scripts/setup.ts` but not this script. A fresh local checkout that runs `scripts/generate-local-dev-secrets.ts >> .env` still gets HS256-era variables that the platform (post-§29 PR-B) does not use.

## Resolution

### oidc.module.ts

Deleted the `JwtModule.registerAsync({...})` block and the now-unused imports of `JwtModule`, `ConfigModule`, and `ConfigService`. `AuthModule` import is retained so the canonical token-issuance services (`TokenIssuerService`, `KeySigningService`, auth-event services) remain available to consumers in this module's scope.

### generate-local-dev-secrets.ts

Replaced `JWT_SECRET` + `IDENTITY_JWT_SECRET` emission with the canon §29 variable set:

- `JWT_KEY_PROVIDER=local-es256` — canon §29.9; selects `LocalEs256KeySigningService` for dev
- `JWT_ACCESS_TTL_SECONDS=600` — canon §29.4; default user access TTL
- `JWT_REFRESH_TTL_DAYS=14` — canon §29.4 / §29.5; founder-locked default
- `JWT_BOOTSTRAP_SECRET=<hex(32)>` — canon §29.7; dev-only service-token bootstrap secret

This matches the pattern Plan Fix 35 established in `scripts/setup.ts`. The unused `jwtSecret = hex(64)` binding is removed.

### identity.module.ts and identity-auth-alias.controller.ts (verified clean)

The user-flagged paths `apps/api/src/app/instance-api/identity/identity.module.ts` and `apps/api/src/app/instance-api/identity/auth/` were verified to contain zero `JWT_SECRET` references. Plan Fix 29 cleanup was complete for this directory. No change required.

## Files

- `apps/api/src/app/identity/oidc/oidc.module.ts` — deleted `JwtModule.registerAsync` block + unused imports (12 lines removed, 0 added)
- `scripts/generate-local-dev-secrets.ts` — replaced `JWT_SECRET`/`IDENTITY_JWT_SECRET` emission with `JWT_KEY_PROVIDER`/`JWT_ACCESS_TTL_SECONDS`/`JWT_REFRESH_TTL_DAYS`/`JWT_BOOTSTRAP_SECRET`
- `docs/plan-fixes/36-jwt-secret-leftovers.md` — this doc
- `CLAUDE.md` — §24 amendment

## Acceptance

- `npm run authz:check` passes
- `npm run audit:check` passes
- `npm run security:check` passes (no new `JWT_SECRET` references introduced)
- `npm run service-boundary:check` passes
- `npm run deps:check` passes
- `npm run compliance:check` passes
- `npm run silent-skip:check` passes
- `npm run cicd:check` passes
- `npm run dead-code:check` passes
- `npm run migrations:check` passes
- `npm run license:check` passes
- `apps/api` builds cleanly — confirms `OidcModule` no longer needs `JwtService` injected into any provider
- Codebase-wide grep `JWT_SECRET` in `apps/api/src/app/identity/oidc/` returns no matches
- `scripts/generate-local-dev-secrets.ts` no longer emits `JWT_SECRET` or `IDENTITY_JWT_SECRET`

## Out of scope

The following `JWT_SECRET` references remain in the codebase. Each is independently scoped and will be addressed in subsequent plan-fixes:

1. **`apps/api/src/app/data/integration/oauth2.service.ts:67-89`** — Signs OAuth2 access tokens with HS256 via the `jsonwebtoken` library directly. This is the largest remaining canon §29.9 violation in `apps/api`: it produces production-bound tokens, not just dev configuration. **Side effect of this PR:** removing `JWT_SECRET` emission from `generate-local-dev-secrets.ts` means a fresh dev checkout no longer satisfies the `OAuth2Service` constructor's fail-closed check. Dev environments that invoke OAuth2 authorization-server endpoints (`/api/oauth2/authorize`, `/api/oauth2/token`) will see startup errors from `OAuth2Service` until that service is migrated to `TokenIssuerService` or `KeySigningService`. Tracked as the next plan-fix in this thread.

2. **`apps/api/src/app/identity/auth/auth.module.ts:134-157`** — The canonical `AuthModule` retains a transitional `JwtModule.registerAsync({...})` that accepts but does not use `JWT_SECRET`. Its docstring explicitly references the canon §29 PR-D commitment to drop the dependency once no consumer still pulls `JwtService`. This is the deliberate transitional shell; addressing it is canon §29 PR-D, not Plan Fix 36.

3. **`libs/auth-guard/src/lib/auth-guard.module.ts:27-39`** — Same transitional shape as `apps/api`'s `AuthModule`; logs a warning if `JWT_SECRET` (or `IDENTITY_JWT_SECRET`) is set but does not use it. Removable when canon §29 PR-D lands.

4. **`libs/shared-types/src/lib/security/jwt-config.ts` and `config-validation.ts`** — Still validate `JWT_SECRET` as a required production var. Validators must be migrated to assert `JWT_KEY_PROVIDER=aws-kms` and `JWT_BOOTSTRAP_SECRET` unset in production. Out of scope here; tracked alongside item 2 under canon §29 PR-D.

5. **`apps/api/src/app/identity/auth/auth.service.spec.ts:54`** — Unit-test fixture sets a fake `JWT_SECRET`. Will be cleaned up alongside the test-config refresh that follows item 2.

6. **`apps/control-plane/src/app/auth/auth.module.ts:22` + `jwt.strategy.ts`** — The control plane (canon §18, a traditional multi-tenant SaaS service distinct from the instance plane) still uses HS256 with `JWT_SECRET`. Canon §29.9 binds the instance plane explicitly; the control plane's migration to ES256 is its own architectural decision that needs a separate plan-fix amendment.

7. **`.env.example:25-26`** — Empty placeholder lines (`JWT_SECRET=`, `IDENTITY_JWT_SECRET=`) with a `DEPRECATED` comment. Documents the transition. Removable when canon §29 PR-D lands and the variables are fully eliminated.

8. **`.env.production.example:11`** — `JWT_SECRET=GENERATE_A_SECURE_64_BYTE_SECRET_HERE`. Removable with the same wave as `.env.example`.

9. **`.github/workflows/{cd,ci,release}.yml`** — CI/CD workflows pass `JWT_SECRET` as a deploy / test env var. These will be removed in the same plan-fix that closes items 2-7.

10. **`infrastructure/terraform/modules/{customer-instance,control-plane}/main.tf`** — Terraform modules generate and pass `JWT_SECRET` via `random_password.jwt_secret`. The customer-instance module is the high-priority one (canon §29 instance-plane scope); the control-plane module follows item 6's separate decision.

11. **`infrastructure/helm/{instance-services,control-plane}/templates/secret.yaml`** — Helm chart entries emit `JWT_SECRET` into the in-cluster Secret. Same wave as item 10.

12. **`scripts/setup.ts`** — Already migrated by Plan Fix 35. No further action required from this Plan Fix.

13. **`README.md`, `SECRETS_ROTATION.md`, `docs/phases/phase-8/01-IMPLEMENTATION-GUIDE.md`** — Documentation references. Will be updated alongside the workflow file changes in items 9-11 to ensure operator-facing docs match the deployed config surface.
