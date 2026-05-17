import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InstanceRequest, JwtAuthGuard, isUserContext } from '@hubblewave/auth-guard';
import { SessionService, SessionInfo } from './session.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedOnly } from './decorators/public.decorator';

function currentSessionId(req: InstanceRequest): string | undefined {
  const ctx = req.context;
  if (ctx && isUserContext(ctx)) {
    return ctx.sessionId;
  }
  return undefined;
}

interface AuthenticatedUser {
  id: string;
  userId: string;
  username?: string;
  email?: string;
}

@AuthenticatedOnly()
@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * List all active sessions for the current user
   */
  @Get()
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: InstanceRequest,
  ): Promise<{ sessions: SessionInfo[] }> {
    const userId = user.userId || user.id;

    // canon §29.5: the JWT's `session_id` claim identifies the family
    // backing the current session. Plumb it through so the session list
    // can mark "this device" correctly.
    const sessions = await this.sessionService.getActiveSessionsForUser(
      userId,
      currentSessionId(req),
    );

    return { sessions };
  }

  /**
   * Get session count for the current user
   * NOTE: Must come before :sessionId route to avoid 'count' being interpreted as ID
   */
  @Get('count')
  async getSessionCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    const userId = user.userId || user.id;
    const count = await this.sessionService.countActiveSessions(userId);
    return { count };
  }

  /**
   * Get details of a specific session
   */
  @Get(':sessionId')
  async getSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ): Promise<{ session: SessionInfo | null }> {
    const userId = user.userId || user.id;
    const session = await this.sessionService.getSessionById(sessionId, userId);
    return { session };
  }

  /**
   * Revoke a specific session (sign out a device)
   */
  @Delete(':sessionId')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Req() req: InstanceRequest,
  ): Promise<{ success: boolean; message: string }> {
    const userId = user.userId || user.id;

    // Prevent revoking current session through this endpoint
    const currentTokenId = currentSessionId(req);
    if (currentTokenId && currentTokenId === sessionId) {
      throw new ForbiddenException(
        'Cannot revoke current session. Use logout instead.',
      );
    }

    const revoked = await this.sessionService.revokeSession(sessionId, userId);

    if (!revoked) {
      return { success: false, message: 'Session not found or already revoked' };
    }

    return { success: true, message: 'Session revoked successfully' };
  }

  /**
   * Revoke all other sessions (sign out all other devices)
   */
  @Post('revoke-others')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async revokeOtherSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: InstanceRequest,
  ): Promise<{ success: boolean; count: number; message: string }> {
    const userId = user.userId || user.id;
    // canon §29.5: the JWT's `session_id` claim identifies the family
    // backing the current session. Plumb it through so the session list
    // can mark "this device" correctly.
    const count = await this.sessionService.revokeAllOtherSessions(
      userId,
      currentSessionId(req),
    );

    return {
      success: true,
      count,
      message: `${count} session(s) revoked successfully`,
    };
  }

  /**
   * Revoke all sessions including current (force logout everywhere)
   */
  @Post('revoke-all')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async revokeAllSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; count: number; message: string }> {
    const userId = user.userId || user.id;

    const count = await this.sessionService.revokeAllSessionsForUser(userId);

    return {
      success: true,
      count,
      message: `All ${count} session(s) revoked. You will need to log in again.`,
    };
  }

}
