import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, PERMISSION_MODE_KEY, PermissionMode } from './permissions.decorator';

/**
 * Guard that checks if the user has the required permissions.
 * Must be used AFTER JwtAuthGuard since it relies on request.user being populated.
 *
 * Permissions are expected to be in the JWT token or loaded into request.user.permissions
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
    // Get required permissions from decorator (check both handler and class level)
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
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

    // Get user permissions - support multiple property names
    const userPermissions: string[] = user.permissions || user.perms || [];

    // Admin role bypasses permission checks
    const userRoles: string[] = user.roles || [];
    if (userRoles.includes('admin') || userRoles.includes('super_admin')) {
      return true;
    }

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
