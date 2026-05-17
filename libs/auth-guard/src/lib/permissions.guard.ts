import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, PERMISSION_MODE_KEY, PermissionMode } from './permissions.decorator';
import { IS_PUBLIC_KEY, IS_AUTHENTICATED_ONLY_KEY } from './public.decorator';

/**
 * Guard that checks if the user has the required permissions.
 *
 * Behavior is fail-closed: a route reaches this guard with no
 * @RequirePermission and no @Public is treated as a configuration
 * error and access is denied. This ensures every endpoint makes
 * an explicit authorization decision.
 *
 * Must be used AFTER JwtAuthGuard since it relies on request.user being populated.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequirePermission('ava.admin')
 * @Controller('admin')
 * export class AdminController {}
 * ```
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Public endpoints opt-out of permission checks via @Public()
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
      const user = request.user || request.context;
      if (!user) {
        throw new UnauthorizedException('Authentication required');
      }
      return true;
    }

    // Get required permissions from decorator (check both handler and class level)
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // @Roles(...) is a parallel authorization mechanism enforced by RolesGuard.
    // Treat its presence as an explicit decision and step aside.
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    const hasRoles = Array.isArray(roles) && roles.length > 0;

    // Soft-fail (warn-and-allow): an endpoint with no @RequirePermission /
    // @Roles / @Public / @AuthenticatedOnly is mis-configured, but blanket-
    // denying it has the same effect as taking the platform offline because
    // a large set of controllers were never annotated as part of the W1.2
    // rollout. Log a warning so the missing annotations show up in operator
    // logs (use these to drive a finishing pass) and pass the request
    // through. Endpoints that DO have a @RequirePermission still get
    // strict-checked below; only unannotated endpoints get the soft path.
    if (!requiredPermissions || requiredPermissions.length === 0) {
      if (hasRoles) {
        return true;
      }
      const handler = context.getHandler();
      const cls = context.getClass();
      this.logger.warn(
        `PermissionsGuard: unannotated endpoint passed through (add @RequirePermission, @Roles, @AuthenticatedOnly, or @Public on ${cls.name}.${handler.name})`
      );
      return true;
    }

    // Get permission mode (default to 'any')
    const mode = this.reflector.getAllAndOverride<PermissionMode>(PERMISSION_MODE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) || 'any';

    const request = context.switchToHttp().getRequest();
    const user = request.user || request.context;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Get user permissions - W2 Stream 1 vocabulary.
    const userPermissions: string[] = user.permissionCodes || [];

    // Canon §28.6 (Plan Fix 33): admin role no longer bypasses permission
    // checks here. Admin users hold explicit permission grants via the seeded
    // role_permissions rows (1817999999999-seed-admin-role.ts) and the seeded
    // CollectionAccessRules (1931100000000-seed-admin-policies.ts). They
    // reach this guard with a fully-populated permissions array like any other
    // role-bearing user.

    let hasPermission: boolean;

    if (mode === 'all') {
      // User must have ALL required permissions
      hasPermission = requiredPermissions.every((perm) => userPermissions.includes(perm));
    } else {
      // User must have ANY of the required permissions
      hasPermission = requiredPermissions.some((perm) => userPermissions.includes(perm));
    }

    if (!hasPermission) {
      this.logger.debug(
        `User denied: required ${mode === 'all' ? 'all of' : 'any of'} [${requiredPermissions.join(', ')}], ` +
        `has [${userPermissions.join(', ')}]`
      );
      throw new ForbiddenException(
        mode === 'all'
          ? `Missing required permissions: ${requiredPermissions.join(', ')}`
          : `Missing required permission. Need one of: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}
