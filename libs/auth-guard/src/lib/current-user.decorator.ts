import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Request user interface for the current authenticated user
 */
export interface RequestUser {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
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
 *   return { userId: user.id };
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
    const requestUser: RequestUser = {
      id: user.userId || user.id,
      username: user.username,
      roles: user.roles || [],
      permissions: user.permissions || [],
      sessionId: user.sessionId,
    };

    // If a specific property is requested, return just that property
    if (data) {
      return requestUser[data];
    }

    return requestUser;
  },
);
