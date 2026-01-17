import { Injectable, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { BreakGlassSession, BreakGlassReasonCode } from '@hubblewave/instance-db';
import { UserAccessContext } from '../types/access.types';
import { AccessAuditService } from './access-audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface BreakGlassRequest {
  collectionId?: string;
  recordId?: string;
  reasonCode: BreakGlassReasonCode | string;
  justification: string;
  externalReference?: string;
  durationMinutes?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface BreakGlassSessionData {
  id: string;
  userId: string;
  collectionId?: string | null;
  recordId?: string | null;
  reasonCode: string;
  justification: string;
  status: string;
  expiresAt: Date;
  startedAt: Date;
  endedAt?: Date | null;
  isActive: boolean;
  actionCount: number;
}

const DEFAULT_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 480; // 8 hours maximum
const MIN_JUSTIFICATION_LENGTH = 20;

// Reason codes that require explicit approval
const APPROVAL_REQUIRED_REASONS: string[] = ['compliance_review', 'data_recovery'];

@Injectable()
export class BreakGlassService {
  private readonly logger = new Logger(BreakGlassService.name);

  constructor(
    @InjectRepository(BreakGlassSession)
    private readonly sessionRepo: Repository<BreakGlassSession>,
    private readonly auditService: AccessAuditService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Request break-glass access to a specific collection record or entire collection
   */
  async requestAccess(
    user: UserAccessContext,
    request: BreakGlassRequest
  ): Promise<BreakGlassSessionData> {
    // Validate justification
    if (!request.justification || request.justification.length < MIN_JUSTIFICATION_LENGTH) {
      throw new BadRequestException(
        `A valid justification (minimum ${MIN_JUSTIFICATION_LENGTH} characters) is required for break-glass access.`
      );
    }

    // Validate duration
    const durationMinutes = Math.min(
      request.durationMinutes || DEFAULT_DURATION_MINUTES,
      MAX_DURATION_MINUTES
    );

    // Check for existing active session for the same scope
    const existing = await this.checkActiveSession(user, request.collectionId, request.recordId);
    if (existing) {
      this.logger.log(`User ${user.id} already has active break-glass session ${existing.id}`);
      return existing;
    }

    // Determine if approval is required
    const approvalRequired = APPROVAL_REQUIRED_REASONS.includes(request.reasonCode);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Create session
    const session = this.sessionRepo.create({
      userId: user.id,
      collectionId: request.collectionId || null,
      recordId: request.recordId || null,
      reasonCode: request.reasonCode,
      justification: request.justification,
      externalReference: request.externalReference || null,
      status: approvalRequired ? 'pending' : 'active',
      expiresAt,
      durationMinutes,
      approvalRequired,
      ipAddress: request.ipAddress || null,
      userAgent: request.userAgent || null,
      contextData: {
        userRoles: user.roleIds,
        userGroups: user.groupIds,
      },
      actionCount: 0,
    });

    const savedSession = await this.sessionRepo.save(session);

    // Audit the request
    await this.auditService.logAccess(
      request.collectionId || 'all_collections',
      user.id,
      'break_glass_request',
      true,
      {
        sessionId: savedSession.id,
        reason: request.reasonCode,
        justification: request.justification,
        recordId: request.recordId,
        durationMinutes,
        approvalRequired,
        externalReference: request.externalReference,
      }
    );

    // Emit event for notification/process flow
    this.eventEmitter.emit('break_glass.requested', {
      sessionId: savedSession.id,
      userId: user.id,
      collectionId: request.collectionId,
      recordId: request.recordId,
      reasonCode: request.reasonCode,
      approvalRequired,
    });

    this.logger.log(
      `Break-glass session ${savedSession.id} created for user ${user.id}, ` +
      `reason: ${request.reasonCode}, approval required: ${approvalRequired}`
    );

    return this.mapToSessionData(savedSession);
  }

  /**
   * Check if a user has an active break-glass session for a target
   */
  async checkActiveSession(
    user: UserAccessContext,
    collectionId?: string,
    recordId?: string
  ): Promise<BreakGlassSessionData | null> {
    const now = new Date();

    // Build query for matching sessions
    const queryBuilder = this.sessionRepo
      .createQueryBuilder('session')
      .where('session.user_id = :userId', { userId: user.id })
      .andWhere('session.status = :status', { status: 'active' })
      .andWhere('session.expires_at > :now', { now });

    // Match collection-level or broader access
    if (collectionId) {
      queryBuilder.andWhere(
        '(session.collection_id = :collectionId OR session.collection_id IS NULL)',
        { collectionId }
      );
    }

    // Match record-level or broader access
    if (recordId) {
      queryBuilder.andWhere(
        '(session.record_id = :recordId OR session.record_id IS NULL)',
        { recordId }
      );
    }

    queryBuilder.orderBy('session.started_at', 'DESC');

    const session = await queryBuilder.getOne();

    if (!session) {
      return null;
    }

    return this.mapToSessionData(session);
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessionsForUser(userId: string): Promise<BreakGlassSessionData[]> {
    const now = new Date();

    const sessions = await this.sessionRepo.find({
      where: {
        userId,
        status: 'active',
        expiresAt: MoreThan(now),
      },
      order: { startedAt: 'DESC' },
    });

    return sessions.map(this.mapToSessionData);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<BreakGlassSessionData | null> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    return this.mapToSessionData(session);
  }

  /**
   * Approve a pending break-glass session
   */
  async approveSession(
    sessionId: string,
    approverId: string,
    comments?: string
  ): Promise<BreakGlassSessionData> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.status !== 'pending') {
      throw new BadRequestException('Session is not pending approval');
    }

    if (session.userId === approverId) {
      throw new ForbiddenException('Cannot approve your own break-glass request');
    }

    // Approve the session
    session.status = 'active';
    session.approvedBy = approverId;
    session.approvedAt = new Date();

    // Extend expiration from approval time
    session.expiresAt = new Date(Date.now() + session.durationMinutes * 60 * 1000);

    await this.sessionRepo.save(session);

    // Audit the approval
    await this.auditService.logAccess(
      session.collectionId || 'all_collections',
      approverId,
      'break_glass_approve',
      true,
      {
        sessionId,
        approvedUserId: session.userId,
        comments,
      }
    );

    // Emit event
    this.eventEmitter.emit('break_glass.approved', {
      sessionId,
      userId: session.userId,
      approverId,
    });

    this.logger.log(`Break-glass session ${sessionId} approved by ${approverId}`);

    return this.mapToSessionData(session);
  }

  /**
   * Revoke an active session
   */
  async revokeSession(
    sessionId: string,
    revokerId: string,
    reason?: string
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.status !== 'active' && session.status !== 'pending') {
      throw new BadRequestException('Session is not active or pending');
    }

    // Revoke the session
    session.status = 'revoked';
    session.endedAt = new Date();
    session.revokedBy = revokerId;
    session.revocationReason = reason || null;

    await this.sessionRepo.save(session);

    // Audit the revocation
    await this.auditService.logAccess(
      session.collectionId || 'all_collections',
      revokerId,
      'break_glass_revoke',
      true,
      {
        sessionId,
        revokedUserId: session.userId,
        reason,
        actionCount: session.actionCount,
      }
    );

    // Emit event
    this.eventEmitter.emit('break_glass.revoked', {
      sessionId,
      userId: session.userId,
      revokerId,
      reason,
    });

    this.logger.log(`Break-glass session ${sessionId} revoked by ${revokerId}`);
  }

  /**
   * Complete a session (user-initiated end)
   */
  async completeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.status !== 'active') {
      throw new BadRequestException('Session is not active');
    }

    session.status = 'completed';
    session.endedAt = new Date();

    await this.sessionRepo.save(session);

    // Audit the completion
    await this.auditService.logAccess(
      session.collectionId || 'all_collections',
      userId,
      'break_glass_complete',
      true,
      {
        sessionId,
        actionCount: session.actionCount,
        durationActual: Math.round(
          (new Date().getTime() - session.startedAt.getTime()) / 60000
        ),
      }
    );

    this.logger.log(`Break-glass session ${sessionId} completed by user`);
  }

  /**
   * Record an action performed during a break-glass session
   */
  async recordAction(
    sessionId: string,
    action: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const result = await this.sessionRepo.update(
      { id: sessionId, status: 'active' },
      {
        actionCount: () => 'action_count + 1',
        lastActionAt: new Date(),
      }
    );

    if (result.affected === 0) {
      this.logger.warn(`Could not record action for session ${sessionId} - session not active`);
      return;
    }

    // Audit the action
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (session) {
      await this.auditService.logAccess(
        session.collectionId || 'all_collections',
        session.userId,
        action,
        true,
        {
          sessionId,
          isBreakGlass: true,
          ...details,
        }
      );
    }
  }

  /**
   * Expire all sessions that have passed their expiration time
   */
  async expireOldSessions(): Promise<number> {
    const now = new Date();

    const expiredSessions = await this.sessionRepo.find({
      where: {
        status: 'active',
        expiresAt: LessThan(now),
      },
    });

    for (const session of expiredSessions) {
      session.status = 'expired';
      session.endedAt = now;
      await this.sessionRepo.save(session);

      // Audit the expiration
      await this.auditService.logAccess(
        session.collectionId || 'all_collections',
        session.userId,
        'break_glass_expired',
        true,
        {
          sessionId: session.id,
          actionCount: session.actionCount,
        }
      );

      this.logger.log(`Break-glass session ${session.id} expired`);
    }

    return expiredSessions.length;
  }

  /**
   * Get pending sessions awaiting approval
   */
  async getPendingSessions(): Promise<BreakGlassSessionData[]> {
    const sessions = await this.sessionRepo.find({
      where: { status: 'pending' },
      order: { startedAt: 'ASC' },
    });

    return sessions.map(this.mapToSessionData);
  }

  /**
   * Get session history for audit purposes
   */
  async getSessionHistory(
    options: {
      userId?: string;
      collectionId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ sessions: BreakGlassSessionData[]; total: number }> {
    const queryBuilder = this.sessionRepo.createQueryBuilder('session');

    if (options.userId) {
      queryBuilder.andWhere('session.user_id = :userId', { userId: options.userId });
    }

    if (options.collectionId) {
      queryBuilder.andWhere('session.collection_id = :collectionId', {
        collectionId: options.collectionId,
      });
    }

    if (options.status) {
      queryBuilder.andWhere('session.status = :status', { status: options.status });
    }

    const total = await queryBuilder.getCount();

    queryBuilder
      .orderBy('session.started_at', 'DESC')
      .skip(options.offset || 0)
      .take(options.limit || 50);

    const sessions = await queryBuilder.getMany();

    return {
      sessions: sessions.map(this.mapToSessionData),
      total,
    };
  }

  /**
   * Map entity to data object
   */
  private mapToSessionData(session: BreakGlassSession): BreakGlassSessionData {
    const now = new Date();
    const isActive =
      session.status === 'active' && session.expiresAt > now;

    return {
      id: session.id,
      userId: session.userId,
      collectionId: session.collectionId,
      recordId: session.recordId,
      reasonCode: session.reasonCode,
      justification: session.justification,
      status: session.status,
      expiresAt: session.expiresAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      isActive,
      actionCount: session.actionCount,
    };
  }
}
