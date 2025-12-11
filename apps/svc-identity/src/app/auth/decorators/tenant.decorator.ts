import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Extracts the tenantId from the authenticated user context.
 * This decorator should only be used on routes protected by JwtAuthGuard.
 *
 * SECURITY: Always use this decorator instead of getting tenantId from URL parameters
 * to prevent cross-tenant access attacks.
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tenantId) {
      throw new UnauthorizedException('Tenant context not available - ensure JwtAuthGuard is applied');
    }

    return user.tenantId;
  },
);

/**
 * Extracts the full user context from the authenticated request.
 * This decorator should only be used on routes protected by JwtAuthGuard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
