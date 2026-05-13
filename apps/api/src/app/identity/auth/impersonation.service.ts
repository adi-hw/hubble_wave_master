/**
 * Impersonation Service
 * HubbleWave Platform - Phase 1
 *
 * Service for admin impersonation of users with full audit trail.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ImpersonationSession, User, withAudit } from '@hubblewave/instance-db';
import { AuthEventsService } from './auth-events.service';
import { PermissionResolverService } from '../roles/permission-resolver.service';

const DEFAULT_IMPERSONATION_DURATION_MINUTES = 60;
const MAX_IMPERSONATION_DURATION_MINUTES = 480; // 8 hours

export interface ImpersonationContext {
  impersonatorId: string;
  impersonatorEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  sessionId: string;
  startedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class ImpersonationService {
  private readonly logger = new Logger(ImpersonationService.name);

  constructor(
    @InjectRepository(ImpersonationSession)
    private readonly sessionRepo: Repository<ImpersonationSession>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly authEventsService: AuthEventsService,
    private readonly permissionResolver: PermissionResolverService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Start an impersonation session
   */
  async startImpersonation(
    impersonatorId: string,
    targetUserId: string,
    reason: string,
    durationMinutes: number = DEFAULT_IMPERSONATION_DURATION_MINUTES,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ImpersonationSession> {
    // Validate duration
    if (durationMinutes > MAX_IMPERSONATION_DURATION_MINUTES) {
      throw new BadRequestException(
        `Maximum impersonation duration is ${MAX_IMPERSONATION_DURATION_MINUTES} minutes`,
      );
    }

    // Get impersonator
    const impersonator = await this.userRepo.findOne({
      where: { id: impersonatorId },
    });
    if (!impersonator) {
      throw new NotFoundException('Impersonator not found');
    }

    // Defense in depth: the controller already gates with
    // @RequirePermission('users.impersonate'), but impersonation has high blast
    // radius so we verify the permission again at the service layer. Any future
    // caller (scheduled job, internal RPC, AVA execution path) that reaches
    // this method must hold the same permission.
    const impersonatorPerms = await this.permissionResolver.getUserPermissions(impersonatorId);
    if (!impersonatorPerms.permissions.has('users.impersonate')) {
      this.logger.warn('Impersonation rejected: missing users.impersonate permission', {
        impersonatorId,
        targetUserId,
      });
      throw new ForbiddenException('Missing required permission: users.impersonate');
    }

    // Get target user
    const targetUser = await this.userRepo.findOne({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Cannot impersonate yourself
    if (impersonatorId === targetUserId) {
      throw new BadRequestException('Cannot impersonate yourself');
    }

    // Cannot impersonate another admin (safety measure)
    // This could be configurable based on requirements

    // Check for existing active impersonation session
    const existingSession = await this.sessionRepo.findOne({
      where: { impersonatorId, isActive: true },
    });
    if (existingSession) {
      throw new BadRequestException(
        'You already have an active impersonation session. End it first.',
      );
    }

    // Create session
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const session = this.sessionRepo.create({
      impersonatorId,
      targetUserId,
      reason,
      isActive: true,
      startedAt: now,
      expiresAt,
      ipAddress: ipAddress || '',
      userAgent,
      actionsLog: [],
    });

    const savedSession = await withAudit(this.dataSource, async (mgr, recordAudit) => {
      const persisted = await mgr.getRepository(ImpersonationSession).save(session);

      recordAudit({
        userId: impersonatorId,
        action: 'impersonation.start',
        collectionCode: 'user',
        recordId: targetUserId,
        newValues: {
          reason,
          sessionId: persisted.id,
          targetUserEmail: targetUser.email,
          impersonatorEmail: impersonator.email,
          durationMinutes,
        },
        ipAddress,
        userAgent,
      });

      return persisted;
    });

    // Analytics observability write — intentionally outside the audit transaction
    // (not a §10 audit row; does not need to be atomic with the data write).
    await this.authEventsService.record({
      userId: impersonatorId,
      eventType: 'impersonation_start',
      success: true,
      ipAddress,
      userAgent,
    });

    this.logger.warn(
      `IMPERSONATION: User ${impersonator.email} started impersonating ${targetUser.email} - Reason: ${reason}`,
    );

    return savedSession;
  }

  /**
   * End an impersonation session
   */
  async endImpersonation(
    sessionId: string,
    impersonatorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, impersonatorId, isActive: true },
      relations: ['targetUser', 'impersonator'],
    });

    if (!session) {
      throw new NotFoundException('Active impersonation session not found');
    }

    session.isActive = false;
    session.endedAt = new Date();

    const endedAt = session.endedAt;
    const startedAt = session.startedAt;
    const actionsCount = session.actionsLog.length;
    const targetUserId = session.targetUserId;

    await withAudit(this.dataSource, async (mgr, recordAudit) => {
      await mgr.getRepository(ImpersonationSession).save(session);

      recordAudit({
        userId: impersonatorId,
        action: 'impersonation.end',
        collectionCode: 'user',
        recordId: targetUserId,
        newValues: {
          sessionId,
          durationMinutes: Math.round(
            (endedAt.getTime() - startedAt.getTime()) / 60000,
          ),
          actionsCount,
        },
        ipAddress,
        userAgent,
      });
    });

    // Analytics observability write — intentionally outside the audit transaction
    // (not a §10 audit row; does not need to be atomic with the data write).
    await this.authEventsService.record({
      userId: impersonatorId,
      eventType: 'impersonation_end',
      success: true,
      ipAddress,
      userAgent,
    });

    this.logger.log(`IMPERSONATION: Session ${sessionId} ended`);
  }

  /**
   * Get active impersonation session for a user
   */
  async getActiveSession(
    impersonatorId: string,
  ): Promise<ImpersonationSession | null> {
    const session = await this.sessionRepo.findOne({
      where: { impersonatorId, isActive: true },
      relations: ['targetUser'],
    });

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      session.isActive = false;
      session.endedAt = new Date();
      await this.sessionRepo.save(session);
      return null;
    }

    return session;
  }

  /**
   * Get impersonation context for JWT claims
   */
  async getImpersonationContext(
    sessionId: string,
  ): Promise<ImpersonationContext | null> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, isActive: true },
      relations: ['targetUser', 'impersonator'],
    });

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      session.isActive = false;
      session.endedAt = new Date();
      await this.sessionRepo.save(session);
      return null;
    }

    return {
      impersonatorId: session.impersonatorId,
      impersonatorEmail: session.impersonator?.email || '',
      targetUserId: session.targetUserId,
      targetUserEmail: session.targetUser?.email || '',
      sessionId: session.id,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Log an action performed during impersonation
   */
  async logImpersonationAction(
    sessionId: string,
    action: string,
    resource: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, isActive: true },
    });

    if (!session) {
      return;
    }

    session.actionsLog.push({
      action,
      resource,
      timestamp: new Date().toISOString(),
      details,
    });

    await this.sessionRepo.save(session);
  }

  /**
   * List impersonation sessions (for admin review)
   */
  async listSessions(options: {
    impersonatorId?: string;
    targetUserId?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: ImpersonationSession[]; total: number }> {
    const query = this.sessionRepo.createQueryBuilder('session')
      .leftJoinAndSelect('session.impersonator', 'impersonator')
      .leftJoinAndSelect('session.targetUser', 'targetUser');

    if (options.impersonatorId) {
      query.andWhere('session.impersonatorId = :impersonatorId', {
        impersonatorId: options.impersonatorId,
      });
    }

    if (options.targetUserId) {
      query.andWhere('session.targetUserId = :targetUserId', {
        targetUserId: options.targetUserId,
      });
    }

    if (options.activeOnly) {
      query.andWhere('session.isActive = true');
    }

    query.orderBy('session.startedAt', 'DESC');

    const total = await query.getCount();

    if (options.limit) {
      query.take(options.limit);
    }
    if (options.offset) {
      query.skip(options.offset);
    }

    const sessions = await query.getMany();

    return { sessions, total };
  }

  /**
   * Terminate all active impersonation sessions (emergency)
   */
  async terminateAllSessions(): Promise<number> {
    const result = await this.sessionRepo.update(
      { isActive: true },
      { isActive: false, endedAt: new Date() },
    );

    this.logger.warn(
      `IMPERSONATION: Emergency termination of all sessions - ${result.affected} sessions ended`,
    );

    return result.affected || 0;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.sessionRepo.update(
      {
        isActive: true,
        expiresAt: new Date() as any, // Less than now
      },
      { isActive: false, endedAt: new Date() },
    );

    return result.affected || 0;
  }

  /**
   * Verify session is still valid (for request interceptor)
   */
  async verifySession(sessionId: string): Promise<boolean> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, isActive: true },
    });

    if (!session) {
      return false;
    }

    if (new Date() > session.expiresAt) {
      session.isActive = false;
      session.endedAt = new Date();
      await this.sessionRepo.save(session);
      return false;
    }

    return true;
  }
}
