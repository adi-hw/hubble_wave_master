/**
 * Canon §28 / W2 Stream 3 — `@RequirePermission(...)` declaration for
 * control-plane handlers. Mirrors the instance-plane decorator name
 * so the route-boundary scanner sees a canonical primary boundary on
 * every control-plane endpoint.
 *
 * The code arguments MUST appear in `PERMISSION_REGISTRY` (entries
 * tagged `plane: 'control-plane'`). The `permission-registry-sync-check`
 * scanner enforces this — call-site codes that are not in the
 * registry, and registry codes that have no call sites, both fail CI.
 *
 * The control-plane uses role-hierarchy auth (canon §17 — the control
 * plane is a traditional multi-tenant SaaS admin surface, not subject
 * to the per-user permission model of the instance plane), so this
 * decorator's runtime enforcement is delegated to
 * `ControlPlaneRequirePermissionGuard`, which maps each capability
 * code to a minimum role tier in `roles.guard.ts`'s hierarchy. A
 * `@Roles(...)` decorator may be retained alongside as auxiliary
 * defense when the resource needs a tighter constraint than the
 * code's default minimum tier.
 */
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'controlPlaneRequirePermission';

export interface RequirePermissionMetadata {
  readonly codes: ReadonlyArray<string>;
  readonly mode: 'any' | 'all';
}

export function RequirePermission(
  codeOrCodes: string | ReadonlyArray<string>,
  mode: 'any' | 'all' = 'all',
): MethodDecorator & ClassDecorator {
  const codes = Array.isArray(codeOrCodes)
    ? (codeOrCodes as ReadonlyArray<string>)
    : [codeOrCodes as string];
  const meta: RequirePermissionMetadata = { codes, mode };
  return SetMetadata(REQUIRE_PERMISSION_KEY, meta);
}
