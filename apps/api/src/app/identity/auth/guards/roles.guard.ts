import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
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

    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      // No roles required
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Distinguish two distinct authorization failures:
    //   - No authenticated principal at all: 401 Unauthorized
    //   - Authenticated principal whose roles do not include any required role: 403 Forbidden
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    if (!user.roles) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Check if user has ANY of the required roles
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(`Required roles: ${requiredRoles.join(' or ')}`);
    }

    return true;
  }
}
