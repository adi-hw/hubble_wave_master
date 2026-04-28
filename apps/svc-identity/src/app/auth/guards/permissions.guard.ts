import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY, IS_AUTHENTICATED_ONLY_KEY } from '../decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // @AuthenticatedOnly endpoints require auth but no specific permission.
    const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (authenticatedOnly) {
      const request = context.switchToHttp().getRequest();
      const user = request.user;
      if (!user) {
        throw new UnauthorizedException('Authentication required');
      }
      return true;
    }

    // Get required permissions from decorator. Two key conventions exist:
    //   - 'permissions' (auth/decorators/permissions.decorator.ts)
    //   - 'required_permissions' (roles/decorators/permission.decorator.ts)
    // Both are valid and indicate the endpoint owner has made a deliberate
    // authorization decision.
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ||
      this.reflector.getAllAndOverride<string[]>('required_permissions', [
        context.getHandler(),
        context.getClass(),
      ]);

    // @Roles(...) at handler or class level also counts as an explicit
    // authorization decision (RolesGuard handles enforcement). PermissionsGuard
    // simply steps aside in that case.
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    const hasRoles = Array.isArray(roles) && roles.length > 0;

    // Fail-closed: a route with no @RequirePermission, no @Roles, no @AuthenticatedOnly, and no @Public is denied.
    if (!requiredPermissions || requiredPermissions.length === 0) {
      if (hasRoles) {
        return true;
      }
      const handler = context.getHandler();
      const cls = context.getClass();
      this.logger.debug(
        `PermissionsGuard: deny-by-default (missing @RequirePermission, @Roles, @AuthenticatedOnly, or @Public on ${cls.name}.${handler.name})`
      );
      throw new ForbiddenException('Endpoint authorization not configured');
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.permissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Check if user has ALL required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      user.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Missing required permissions: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}
