import { SetMetadata } from '@nestjs/common';

/**
 * Reflector metadata key for the `@RequireServiceScope()` decorator.
 * `JwtAuthGuard` reads this via `Reflector.getAllAndOverride` to find
 * the scope code a service-token caller must present.
 */
export const REQUIRE_SERVICE_SCOPE_KEY = 'REQUIRE_SERVICE_SCOPE';

/**
 * Canon §29.7 — declare the platform-capability scope a service-token
 * caller MUST present to invoke this endpoint.
 *
 * Pairs with `@AllowServiceToken()`. The two decorators together form
 * the canon §29.7 service-token authorization contract:
 *
 *   1. `@AllowServiceToken()` — endpoint opts in to accepting service
 *      tokens at all (default-deny otherwise).
 *   2. `@RequireServiceScope(code)` — endpoint declares which scope a
 *      service token must carry. JwtAuthGuard rejects with 403 if the
 *      token's `scope` array does not include `code`.
 *
 * Both must be present at the method or class level. A controller with
 * `@AllowServiceToken()` but no matching `@RequireServiceScope(code)` is
 * a programmer error — the guard throws `InternalServerErrorException`
 * to surface the misconfiguration at the first service-token request,
 * and the `service-token:check` CI scanner catches it at PR time.
 *
 * Scope codes are drawn from `PERMISSION_REGISTRY` (Stream 2 PR3 lands
 * the canonical constant). Until that PR ships, the registry codes are
 * agreed shape, not enforceable values; this decorator accepts any
 * non-empty string and the runtime check is a substring match against
 * the JWT's `scope[]`.
 *
 * @example
 * ```ts
 * @Post('process-event')
 * @AllowServiceToken()
 * @RequireServiceScope('analytics.events.ingest')
 * processEvent(@Req() req: InstanceRequest) {
 *   // service tokens lacking 'analytics.events.ingest' in scope[] get 403
 * }
 * ```
 */
export const RequireServiceScope = (code: string) =>
  SetMetadata(REQUIRE_SERVICE_SCOPE_KEY, code);
