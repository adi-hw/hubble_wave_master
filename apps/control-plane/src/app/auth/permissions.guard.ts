/**
 * Canon §28 / W2 Stream 3 — control-plane PermissionsGuard.
 *
 * Reads `@RequirePermission(code | codes, mode)` metadata and enforces
 * the codes against the calling user's role tier. The control plane
 * does NOT carry per-user permission rows (canon §17 — it is a
 * conventional multi-tenant SaaS admin surface, not the instance
 * plane's per-user RBAC); instead, each capability code maps to a
 * minimum role tier in the `roles.guard.ts` hierarchy.
 *
 * Mapping rules:
 *   - `:read` actions          → `viewer` minimum (anyone with
 *                                control-plane access can observe)
 *   - `:manage` / `:invoke` /
 *     `:configure` actions     → `operator` minimum (write surface)
 *   - dangerous-tagged codes
 *     in `PERMISSION_REGISTRY`  → bumped to `admin` minimum
 *
 * The dangerous-bit comes from the same `PERMISSION_REGISTRY` constant
 * the instance plane consumes. Imported at module load; the registry
 * is a TypeScript constant so no DB lookup is needed.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_REGISTRY } from '@hubblewave/permission-registry';
import { ControlPlaneRole } from '@hubblewave/control-plane-db';
import { REQUIRE_PERMISSION_KEY, type RequirePermissionMetadata } from './require-permission.decorator';

const roleHierarchy: Record<ControlPlaneRole, number> = {
  super_admin: 6,
  admin: 5,
  operator: 4,
  support: 3,
  viewer: 2,
  readonly: 1,
};

const codeToMinRole = buildCodeToMinRoleMap();

function buildCodeToMinRoleMap(): Map<string, ControlPlaneRole> {
  const map = new Map<string, ControlPlaneRole>();
  for (const entry of PERMISSION_REGISTRY) {
    if (entry.plane !== 'control-plane') continue;
    const baseMin: ControlPlaneRole = entry.action === 'read' ? 'viewer' : 'operator';
    const min: ControlPlaneRole = entry.dangerous ? bumpToAdmin(baseMin) : baseMin;
    map.set(entry.code, min);
  }
  return map;
}

function bumpToAdmin(role: ControlPlaneRole): ControlPlaneRole {
  return roleHierarchy[role] < roleHierarchy.admin ? 'admin' : role;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<RequirePermissionMetadata | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta || meta.codes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role = request?.user?.role as ControlPlaneRole | undefined;
    if (!role) {
      throw new ForbiddenException('Permission denied');
    }
    const userLevel = roleHierarchy[role] ?? 0;

    const codeChecks = meta.codes.map((code) => {
      const minRole = codeToMinRole.get(code);
      if (!minRole) {
        // An unregistered code on the call site is caught by the CI
        // scanner. At runtime, reject defensively — a code that has
        // no minimum tier mapped is treated as deny.
        return false;
      }
      return userLevel >= roleHierarchy[minRole];
    });

    const passed = meta.mode === 'any' ? codeChecks.some(Boolean) : codeChecks.every(Boolean);
    if (!passed) {
      throw new ForbiddenException('Permission denied');
    }
    return true;
  }
}
