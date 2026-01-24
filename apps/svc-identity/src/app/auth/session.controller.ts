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
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { SessionService, SessionInfo } from './session.service';
import { CurrentUser } from './decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  userId: string;
  username?: string;
  email?: string;
}

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
    @Req() req: any,
  ): Promise<{ sessions: SessionInfo[] }> {
    const userId = user.userId || user.id;

    // Try to get current token ID from request (if available)
    const currentTokenId = req.tokenId || undefined;

    const sessions = await this.sessionService.getActiveSessionsForUser(
      userId,
      currentTokenId,
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
    @Req() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const userId = user.userId || user.id;

    // Prevent revoking current session through this endpoint
    const currentTokenId = req.tokenId;
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
    @Req() req: any,
  ): Promise<{ success: boolean; count: number; message: string }> {
    const userId = user.userId || user.id;
    const currentTokenId = req.tokenId || undefined;

    const count = await this.sessionService.revokeAllOtherSessions(
      userId,
      currentTokenId,
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
