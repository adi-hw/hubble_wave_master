import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ControlPlaneRole } from '@hubblewave/control-plane-db';
import { ROLES_KEY } from './roles.decorator';

const roleHierarchy: Record<ControlPlaneRole, number> = {
  super_admin: 6,
  admin: 5,
  operator: 4,
  support: 3,
  viewer: 2,
  readonly: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<ControlPlaneRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      return false;
    }

    const userRoleLevel = roleHierarchy[user.role as ControlPlaneRole] || 0;

    // Check if user's role level is >= any of the required roles
    return requiredRoles.some((role) => userRoleLevel >= roleHierarchy[role]);
  }
}
