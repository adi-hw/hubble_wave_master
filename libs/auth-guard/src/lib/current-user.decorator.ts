import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Request user interface for the current authenticated user.
 *
 * `isAdmin` is the cached form of "this user holds platform.bypass_authz".
 * Consumers should prefer `isAdmin` over inspecting `roles` directly so
 * that the metadata-driven authz model (Canon §4 + §9) is the only source
 * of truth for bypass authority.
 */
export interface RequestUser {
  id: string;
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
  sessionId?: string;
}

/**
 * Parameter decorator to extract the current authenticated user from the request.
 * Use with @UseGuards(JwtAuthGuard)
 *
 * @example
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: RequestUser) {
 *   return { userId: user.userId };
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | string | string[] | boolean | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    // Map authenticated user to RequestUser format
    const uid = user.userId || user.id;
    const permissions: string[] = user.permissions || [];
    const requestUser: RequestUser = {
      id: uid,
      userId: uid,
      username: user.username,
      roles: user.roles || [],
      permissions,
      isAdmin: typeof user.isAdmin === 'boolean'
        ? user.isAdmin
        : permissions.includes('platform.bypass_authz'),
      sessionId: user.sessionId,
    };

    // If a specific property is requested, return just that property
    if (data) {
      return requestUser[data];
    }

    return requestUser;
  },
);
