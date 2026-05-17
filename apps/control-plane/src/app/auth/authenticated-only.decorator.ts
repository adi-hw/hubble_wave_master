/**
 * Canon §28 / W2 Stream 3 — `@AuthenticatedOnly()` declaration for
 * control-plane handlers. Mirrors the instance-plane decorator name
 * so the route-boundary scanner recognizes a primary boundary that
 * only requires the caller to be authenticated (no role-tier or
 * capability check beyond JWT validity).
 *
 * Auxiliary `@Roles(...)` on the same handler is NOT permitted by the
 * scanner (rule 4: AuthenticatedOnly conflicts with Roles). Use
 * `@RequirePermission(...)` whenever a role-tier constraint applies.
 */
import { SetMetadata } from '@nestjs/common';

export const IS_AUTHENTICATED_ONLY_KEY = 'controlPlaneAuthenticatedOnly';

export const AuthenticatedOnly = () =>
  SetMetadata(IS_AUTHENTICATED_ONLY_KEY, true);
