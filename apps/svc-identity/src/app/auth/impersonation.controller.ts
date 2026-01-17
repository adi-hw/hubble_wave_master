/**
 * Impersonation Controller
 * HubbleWave Platform - Phase 1
 *
 * REST endpoints for admin user impersonation with audit trail.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/permission.decorator';
import { ImpersonationService } from './impersonation.service';

interface RequestWithUser {
  user: {
    sub: string;
    username: string;
    impersonation?: {
      sessionId: string;
      impersonatorId: string;
    };
  };
  ip?: string;
  headers: {
    'user-agent'?: string;
  };
}

@Controller('auth/impersonation')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ImpersonationController {
  constructor(private readonly impersonationService: ImpersonationService) {}

  /**
   * Start impersonating a user
   */
  @Post('start')
  @RequirePermission('users.impersonate')
  @HttpCode(HttpStatus.OK)
  async startImpersonation(
    @Request() req: RequestWithUser,
    @Body() body: {
      targetUserId: string;
      reason: string;
      durationMinutes?: number;
    },
  ) {
    const session = await this.impersonationService.startImpersonation(
      req.user.sub,
      body.targetUserId,
      body.reason,
      body.durationMinutes,
      req.ip,
      req.headers['user-agent'],
    );

    return {
      success: true,
      sessionId: session.id,
      targetUserId: session.targetUserId,
      expiresAt: session.expiresAt,
      message: 'Impersonation session started. All actions will be logged.',
    };
  }

  /**
   * End impersonation session
   */
  @Post('end')
  @HttpCode(HttpStatus.OK)
  async endImpersonation(@Request() req: RequestWithUser) {
    const impersonation = req.user.impersonation;

    if (!impersonation) {
      return {
        success: false,
        message: 'No active impersonation session',
      };
    }

    await this.impersonationService.endImpersonation(
      impersonation.sessionId,
      impersonation.impersonatorId,
      req.ip,
      req.headers['user-agent'],
    );

    return {
      success: true,
      message: 'Impersonation session ended',
    };
  }

  /**
   * Get current impersonation status
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getImpersonationStatus(@Request() req: RequestWithUser) {
    const session = await this.impersonationService.getActiveSession(req.user.sub);

    if (!session) {
      return {
        isImpersonating: false,
      };
    }

    return {
      isImpersonating: true,
      sessionId: session.id,
      targetUserId: session.targetUserId,
      targetUser: session.targetUser ? {
        id: session.targetUser.id,
        email: session.targetUser.email,
        displayName: session.targetUser.displayName,
      } : undefined,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      actionsCount: session.actionsLog.length,
    };
  }

  /**
   * List impersonation sessions (admin view)
   */
  @Get('sessions')
  @RequirePermission('admin.audit')
  async listSessions(
    @Query('impersonatorId') impersonatorId?: string,
    @Query('targetUserId') targetUserId?: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.impersonationService.listSessions({
      impersonatorId,
      targetUserId,
      activeOnly: activeOnly === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return {
      sessions: result.sessions.map(session => ({
        id: session.id,
        impersonator: session.impersonator ? {
          id: session.impersonator.id,
          email: session.impersonator.email,
          displayName: session.impersonator.displayName,
        } : undefined,
        targetUser: session.targetUser ? {
          id: session.targetUser.id,
          email: session.targetUser.email,
          displayName: session.targetUser.displayName,
        } : undefined,
        reason: session.reason,
        isActive: session.isActive,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        expiresAt: session.expiresAt,
        actionsCount: session.actionsLog.length,
      })),
      total: result.total,
    };
  }

  /**
   * Get details of a specific impersonation session
   */
  @Get('sessions/:sessionId')
  @RequirePermission('admin.audit')
  async getSessionDetails(@Param('sessionId') sessionId: string) {
    const context = await this.impersonationService.getImpersonationContext(sessionId);

    if (!context) {
      return {
        found: false,
      };
    }

    return {
      found: true,
      ...context,
    };
  }

  /**
   * Terminate all active impersonation sessions (emergency)
   */
  @Post('terminate-all')
  @RequirePermission('admin.settings')
  @HttpCode(HttpStatus.OK)
  async terminateAllSessions(@Request() _req: RequestWithUser) {
    const count = await this.impersonationService.terminateAllSessions();

    return {
      success: true,
      terminatedCount: count,
      message: `Terminated ${count} active impersonation sessions`,
    };
  }
}
