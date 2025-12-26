import { Injectable, BadRequestException } from '@nestjs/common';
import { UserAccessContext } from '../types/access.types';
import { AccessAuditService } from './access-audit.service';

export interface BreakGlassSession {
    id: string;
    userId: string;
    reasonCode: string;
    explanation: string;
    expiresAt: Date;
    startedAt: Date;
    endedAt?: Date;
    isActive: boolean;
}

export type BreakGlassReasonCode = 'emergency' | 'investigation' | 'maintenance' | string;

@Injectable()
export class BreakGlassService {
  constructor(
    private readonly auditService: AccessAuditService,
  ) {}

  /**
   * Request break-glass access to a specific collection record or entire collection
   */
  async requestAccess(
    user: UserAccessContext,
    collectionId: string,
    reasonCode: BreakGlassReasonCode,
    justification: string,
    recordId?: string,
  ): Promise<BreakGlassSession> {
    if (!justification || justification.length < 10) {
      throw new BadRequestException('A valid justification (min 10 chars) is required for break-glass access.');
    }

    // Check for existing active session
    const existing = await this.checkActiveSession(user, collectionId, recordId);
    if (existing) {
      return existing;
    }

    // Create session
    // Create session (Mock)
    const session: BreakGlassSession = {
      id: `mock-session-${Date.now()}`,
      userId: user.id,
      reasonCode: reasonCode as string,
      explanation: justification,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour default
      startedAt: new Date(),
      isActive: true,
    };

    const savedSession = session;

    // Audit the request
    await this.auditService.logAccess(
      collectionId,
      user.id,
      'break_glass_request',
      true,
      {
        sessionId: savedSession.id,
        reason: reasonCode as string,
        justification,
        recordId,
      }
    );

    return savedSession;
  }

  /**
   * Check if a user has an active break-glass session for a target
   */
  async checkActiveSession(
    _user: UserAccessContext,
    _collectionId: string,
    _recordId?: string
  ): Promise<BreakGlassSession | null> {
    return null;
  }

  /**
   * Revoke an active session
   */
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    // Audit the request only
    await this.auditService.logAccess(
      'break_glass',
      userId,
      'break_glass_revoke',
      true,
      { sessionId }
    );
  }
}

