import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, PERMISSION_MODE_KEY, PermissionMode } from '../decorators/permission.decorator';
import { PermissionResolverService } from '../permission-resolver.service';

/**
 * PermissionGuard - Enforces permission-based access control
 *
 * Checks if the authenticated user has the required permissions
 * to access the decorated endpoint.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get permission mode (any or all)
    const mode = this.reflector.getAllAndOverride<PermissionMode>(
      PERMISSION_MODE_KEY,
      [context.getHandler(), context.getClass()],
    ) || 'any';

    // Get request and user
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Support different property names for user ID
    // JwtStrategy returns 'userId', but JWT payload might have 'sub' or 'id'
    const userId = user.userId || user.id || user.sub;

    if (!userId) {
      this.logger.warn('Missing userId in request', { user: Object.keys(user) });
      throw new UnauthorizedException('Invalid authentication context');
    }

    // Check permissions
    try {
      if (mode === 'all') {
        // User must have ALL required permissions
        const hasAll = await this.permissionResolver.hasAllPermissions(
          userId,
          requiredPermissions,
        );

        if (!hasAll) {
          this.logger.debug(
            `User ${userId} denied access: missing all of ${requiredPermissions.join(', ')}`,
          );
          throw new ForbiddenException(
            `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
          );
        }
      } else {
        // User must have ANY of the required permissions
        const hasAny = await this.permissionResolver.hasAnyPermission(
          userId,
          requiredPermissions,
        );

        if (!hasAny) {
          this.logger.debug(
            `User ${userId} denied access: missing any of ${requiredPermissions.join(', ')}`,
          );
          throw new ForbiddenException(
            `Insufficient permissions. Required one of: ${requiredPermissions.join(', ')}`,
          );
        }
      }

      return true;
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(`Permission check failed: ${(err as Error).message}`);
      throw new ForbiddenException('Permission check failed');
    }
  }
}

/**
 * Create a custom permission guard with specific settings
 */
export function createPermissionGuard(
  permissions: string[],
  mode: PermissionMode = 'any',
) {
  @Injectable()
  class CustomPermissionGuard implements CanActivate {
    constructor(
      private readonly permissionResolver: PermissionResolverService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      const user = request.user;

      if (!user) {
        throw new UnauthorizedException('Authentication required');
      }

      const userId = user.userId || user.id || user.sub;

      if (mode === 'all') {
        const hasAll = await this.permissionResolver.hasAllPermissions(
          userId,
          permissions,
        );
        if (!hasAll) {
          throw new ForbiddenException('Insufficient permissions');
        }
      } else {
        const hasAny = await this.permissionResolver.hasAnyPermission(
          userId,
          permissions,
        );
        if (!hasAny) {
          throw new ForbiddenException('Insufficient permissions');
        }
      }

      return true;
    }
  }

  return CustomPermissionGuard;
}
