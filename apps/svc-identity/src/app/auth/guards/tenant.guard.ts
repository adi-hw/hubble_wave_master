import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';

@Injectable()
export class TenantGuard implements CanActivate {
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

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    // Check if route has a tenantId param and it matches user's tenant
    const routeTenantId = request.params.tenantId || request.query.tenantId;
    
    if (routeTenantId && routeTenantId !== user.tenantId) {
      throw new ForbiddenException('Access denied to this tenant');
    }

    if (request.tenant && request.tenant.id && request.tenant.id !== user.tenantId) {
      throw new ForbiddenException('Token tenant does not match host tenant');
    }

    // Inject tenant context for downstream services
    request.tenantId = user.tenantId;

    return true;
  }
}
