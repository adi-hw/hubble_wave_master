/**
 * Magic Link Service
 * HubbleWave Platform - Phase 1
 *
 * Service for passwordless email-based authentication via magic links.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as crypto from 'crypto';
import { MagicLinkToken, User } from '@hubblewave/instance-db';
import { AuthEventsService } from './auth-events.service';

const MAGIC_LINK_EXPIRY_MINUTES = 15;
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 5;

export interface MagicLinkResult {
  token: string;
  expiresAt: Date;
  email: string;
}

@Injectable()
export class MagicLinkService {
  private readonly logger = new Logger(MagicLinkService.name);

  constructor(
    @InjectRepository(MagicLinkToken)
    private readonly tokenRepo: Repository<MagicLinkToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly authEventsService: AuthEventsService,
  ) {}

  /**
   * Generate a magic link token for passwordless login
   */
  async generateMagicLink(
    email: string,
    ipAddress?: string,
    userAgent?: string,
    redirectUrl?: string,
  ): Promise<MagicLinkResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limiting check
    await this.checkRateLimit(normalizedEmail);

    // Find user (optional - can create account on first login)
    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });

    // Generate secure token
    const tokenValue = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(tokenValue);

    const expiresAt = new Date(
      Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000,
    );

    // Invalidate any existing unused tokens for this email
    await this.tokenRepo.update(
      { email: normalizedEmail, usedAt: null as any },
      { usedAt: new Date() },
    );

    // Create new token
    const token = this.tokenRepo.create({
      email: normalizedEmail,
      userId: user?.id || null,
      token: tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
      redirectUrl,
    });

    await this.tokenRepo.save(token);

    await this.authEventsService.record({
      userId: user?.id,
      eventType: 'magic_link_requested',
      success: true,
      ipAddress,
      userAgent,
    });

    this.logger.log(`Magic link generated for ${normalizedEmail}`);

    return {
      token: tokenValue, // Return unhashed token for email
      expiresAt,
      email: normalizedEmail,
    };
  }

  /**
   * Verify magic link token and authenticate user
   */
  async verifyMagicLink(
    tokenValue: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: User; redirectUrl?: string }> {
    const tokenHash = this.hashToken(tokenValue);

    // Find token
    const token = await this.tokenRepo.findOne({
      where: { token: tokenHash },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid or expired magic link');
    }

    // Check if already used
    if (token.usedAt) {
      await this.authEventsService.record({
        userId: token.userId ?? undefined,
        eventType: 'magic_link_verify',
        success: false,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Magic link has already been used');
    }

    // Check expiry
    if (new Date() > token.expiresAt) {
      await this.authEventsService.record({
        userId: token.userId ?? undefined,
        eventType: 'magic_link_verify',
        success: false,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Magic link has expired');
    }

    // Mark token as used
    token.usedAt = new Date();
    await this.tokenRepo.save(token);

    // Find or create user
    let user = token.userId
      ? await this.userRepo.findOne({ where: { id: token.userId } })
      : await this.userRepo.findOne({ where: { email: token.email } });

    if (!user) {
      // Create new user from magic link
      user = this.userRepo.create({
        email: token.email,
        displayName: token.email.split('@')[0],
        status: 'active',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
      await this.userRepo.save(user);

      this.logger.log(`Created new user from magic link: ${token.email}`);
    }

    // Check user status
    if (user.status !== 'active' && user.status !== 'pending_activation') {
      throw new UnauthorizedException('Account is not active');
    }

    // Mark email as verified if not already
    if (!user.emailVerified) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIp = ipAddress || null;
    await this.userRepo.save(user);

    await this.authEventsService.record({
      userId: user.id,
      eventType: 'magic_link_verify',
      success: true,
      ipAddress,
      userAgent,
    });

    this.logger.log(`Magic link verified for user ${user.id}`);

    return {
      user,
      redirectUrl: token.redirectUrl || undefined,
    };
  }

  /**
   * Revoke all pending magic links for an email
   */
  async revokePendingLinks(email: string): Promise<number> {
    const normalizedEmail = email.toLowerCase().trim();

    const result = await this.tokenRepo.update(
      { email: normalizedEmail, usedAt: null as any },
      { usedAt: new Date() },
    );

    return result.affected || 0;
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.tokenRepo.delete({
      expiresAt: MoreThan(new Date(Date.now() - 24 * 60 * 60 * 1000)) as any,
      usedAt: null as any,
    });

    return result.affected || 0;
  }

  /**
   * Get pending magic link status (for UI)
   */
  async getPendingLinkStatus(
    email: string,
  ): Promise<{ hasPending: boolean; expiresAt?: Date }> {
    const normalizedEmail = email.toLowerCase().trim();

    const token = await this.tokenRepo.findOne({
      where: {
        email: normalizedEmail,
        usedAt: null as any,
      },
      order: { createdAt: 'DESC' },
    });

    if (!token || new Date() > token.expiresAt) {
      return { hasPending: false };
    }

    return {
      hasPending: true,
      expiresAt: token.expiresAt,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async checkRateLimit(email: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentRequests = await this.tokenRepo.count({
      where: {
        email,
        createdAt: MoreThan(oneHourAgo) as any,
      },
    });

    if (recentRequests >= MAX_REQUESTS_PER_EMAIL_PER_HOUR) {
      throw new BadRequestException(
        'Too many magic link requests. Please try again later.',
      );
    }
  }
}
