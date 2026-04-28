import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, SetMetadata, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbacService } from './abac.service';
import { IS_PUBLIC_KEY, IS_AUTHENTICATED_ONLY_KEY } from '../auth/decorators/public.decorator';

export const ABAC_RESOURCE_KEY = 'abac_resource';
export const SKIP_ABAC_KEY = 'skip_abac';

export const AbacResource = (resource: string, action: string, resourceType: 'collection' | 'property' | 'action' = 'action') =>
  SetMetadata(ABAC_RESOURCE_KEY, { resource, action, resourceType });

/**
 * Marks a route handler as not requiring ABAC evaluation. Use this for
 * endpoints whose authorization is fully handled elsewhere (e.g. public
 * health checks, login/refresh flows). Endpoints without either
 * @AbacResource or @SkipAbac are treated as misconfigured and denied.
 */
export const SkipAbac = () => SetMetadata(SKIP_ABAC_KEY, true);

@Injectable()
export class AbacGuard implements CanActivate {
  private readonly logger = new Logger(AbacGuard.name);

  constructor(private reflector: Reflector, private abacService: AbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const cls = context.getClass();

    // Auto-skip when the endpoint is explicitly @Public() (no caller identity
    // exists yet, so there is nothing for ABAC to evaluate against — login,
    // magic-link, refresh, etc.) or @AuthenticatedOnly() (the route's
    // authorization is intentionally "any authenticated user, no resource-
    // level decision" — /auth/me, /auth/logout, change-password). Either
    // marker is treated as the explicit ABAC opt-out alongside @SkipAbac().
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, cls]);
    if (isPublic) return true;
    const isAuthenticatedOnly = this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_ONLY_KEY, [handler, cls]);
    if (isAuthenticatedOnly) return true;
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ABAC_KEY, [handler, cls]);
    if (skip) return true;

    const meta = this.reflector.getAllAndOverride<{ resource: string; action: string; resourceType?: 'collection' | 'property' | 'action' }>(
      ABAC_RESOURCE_KEY,
      [handler, cls],
    );

    const req = context.switchToHttp().getRequest();

    if (!meta) {
      // Fail closed: an endpoint protected by AbacGuard must declare either an
      // @AbacResource(...) policy target or opt out explicitly via @Public,
      // @AuthenticatedOnly, or @SkipAbac. Silently allowing endpoints with no
      // metadata creates an authorization hole that scales with every new
      // route added.
      this.logger.warn(
        `ABAC denied: route ${cls?.name ?? '<class>'}.${handler?.name ?? '<handler>'} has no @AbacResource or opt-out metadata`,
      );
      throw new ForbiddenException('ABAC policy not configured for this endpoint');
    }

    if (!req.user) {
      throw new UnauthorizedException();
    }

    const { resource, action, resourceType = 'action' } = meta;

    // The AbacService expects a flat context shaped around the calling user.
    // Build it from the JWT claims that JwtStrategy.validate() attaches to
    // req.user, falling back to the raw payload's `sub` field for callers
    // that have not been mapped through the strategy.
    const u = req.user as Record<string, unknown> | undefined;
    const evaluationContext = {
      userId: (u?.['userId'] as string | undefined)
        ?? (u?.['sub'] as string | undefined)
        ?? (u?.['id'] as string | undefined),
      roles: Array.isArray(u?.['roles']) ? (u?.['roles'] as string[]) : [],
      permissions: Array.isArray(u?.['permissions']) ? (u?.['permissions'] as string[]) : [],
      groups: Array.isArray(u?.['groups']) ? (u?.['groups'] as string[]) : [],
      sites: Array.isArray(u?.['sites']) ? (u?.['sites'] as string[]) : [],
      isAdmin: u?.['is_admin'] === true || u?.['isAdmin'] === true,
    };

    const allowed = await this.abacService.isAllowed(resource, action, evaluationContext, resourceType);
    if (!allowed) throw new ForbiddenException('ABAC policy denied');
    return true;
  }
}
