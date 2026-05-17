import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Request user interface for the current authenticated user.
 * Mirrors `UserRequestContext` / `AuthenticatedUser` for the
 * `@CurrentUser()` decorator surface. W2 Stream 1 PR1 vocabulary:
 * `roleIds` + `roleCodes` + `permissionCodes` + `groupIds` +
 * `securityStamp` replace the pre-Stream-1 `roles` / `permissions`
 * conflation.
 */
export interface RequestUser {
  id: string;
  userId: string;
  username: string;
  roleIds: string[];
  roleCodes: string[];
  permissionCodes: string[];
  groupIds: string[];
  securityStamp: string;
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
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | string | string[] | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    // Map authenticated user to RequestUser format
    const uid = user.userId || user.id;
    const requestUser: RequestUser = {
      id: uid,
      userId: uid,
      username: user.username,
      roleIds: user.roleIds ?? [],
      roleCodes: user.roleCodes ?? [],
      permissionCodes: user.permissionCodes ?? [],
      groupIds: user.groupIds ?? [],
      securityStamp: user.securityStamp ?? '',
      sessionId: user.sessionId,
    };

    // If a specific property is requested, return just that property
    if (data) {
      return requestUser[data];
    }

    return requestUser;
  },
);
