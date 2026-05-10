import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import {
  EmailVerificationToken,
  User,
} from '@hubblewave/instance-db';
import { EmailService } from '../email/email.service';
import { RedisService } from '@hubblewave/redis';

/**
 * Per-token failed attempt limit. After this many failed verification attempts
 * the token is forcibly marked as used regardless of its TTL. This stops an
 * attacker from grinding random token values against a known token id.
 */
const EMAIL_VERIFY_MAX_FAILURES_PER_TOKEN = 3;
const EMAIL_VERIFY_FAILURE_KEY_PREFIX = 'email-verify:fail:';
const EMAIL_VERIFY_FAILURE_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class EmailVerificationService {
  private readonly tokenExpiryHours = 24;

  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly verificationTokenRepo: Repository<EmailVerificationToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Generate a secure random token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new email verification token and send verification email
   */
  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    // Check if user exists
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is already verified
    if (user.emailVerified && user.email === email) {
      throw new BadRequestException('Email is already verified');
    }

    // Invalidate any existing tokens for this user
    await this.verificationTokenRepo.update(
      { userId, verifiedAt: IsNull() },
      { verifiedAt: new Date() }, // Mark as used
    );

    // Create new token
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.tokenExpiryHours);

    const verificationToken = this.verificationTokenRepo.create({
      userId,
      email,
      token,
      expiresAt,
    });

    await this.verificationTokenRepo.save(verificationToken);

    // Send verification email
    await this.emailService.sendEmailVerification(email, token);
  }

  /**
   * Verify an email using the token
   */
  async verifyEmail(token: string): Promise<{ userId: string; email: string }> {
    // Find the token
    const verificationToken = await this.verificationTokenRepo.findOne({
      where: { token },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const failureKey = `${EMAIL_VERIFY_FAILURE_KEY_PREFIX}${verificationToken.id}`;

    // If this token has already burned through its per-token failure budget,
    // refuse it even if its calendar TTL has not elapsed yet.
    const priorFailures = await this.redisService.get(failureKey);
    const priorCount = priorFailures ? parseInt(priorFailures, 10) : 0;
    if (Number.isFinite(priorCount) && priorCount >= EMAIL_VERIFY_MAX_FAILURES_PER_TOKEN) {
      if (!verificationToken.verifiedAt) {
        verificationToken.verifiedAt = new Date();
        await this.verificationTokenRepo.save(verificationToken);
      }
      throw new BadRequestException('Verification token has been invalidated due to repeated failed attempts. Please request a new verification email.');
    }

    // Check if already used
    if (verificationToken.verifiedAt) {
      await this.redisService.incrWithExpiry(failureKey, EMAIL_VERIFY_FAILURE_TTL_SECONDS);
      throw new BadRequestException('This verification link has already been used');
    }

    // Check expiry
    if (new Date() > verificationToken.expiresAt) {
      await this.redisService.incrWithExpiry(failureKey, EMAIL_VERIFY_FAILURE_TTL_SECONDS);
      throw new BadRequestException('Verification token has expired. Please request a new verification email.');
    }

    // Find the user
    const user = await this.userRepo.findOne({
      where: { id: verificationToken.userId },
    });

    if (!user) {
      await this.redisService.incrWithExpiry(failureKey, EMAIL_VERIFY_FAILURE_TTL_SECONDS);
      throw new NotFoundException('User not found');
    }

    // Mark token as used
    verificationToken.verifiedAt = new Date();
    await this.verificationTokenRepo.save(verificationToken);

    // Update user's email verification status
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();

    // If the user was pending_activation and this was their first email verification,
    // update their status to active
    if (user.status === 'pending_activation') {
      user.status = 'active';
      user.activatedAt = new Date();
    }

    await this.userRepo.save(user);

    // Successful verification clears the per-token failure counter so a new
    // verification request for the same user starts with a clean budget.
    await this.redisService.del(failureKey);

    return {
      userId: user.id,
      email: verificationToken.email,
    };
  }

  /**
   * Resend verification email (with rate limiting check)
   */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Check for recent verification emails (rate limit: 1 per minute)
    const oneMinuteAgo = new Date();
    oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);

    const recentToken = await this.verificationTokenRepo.findOne({
      where: {
        userId,
        createdAt: LessThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (recentToken && recentToken.createdAt > oneMinuteAgo) {
      const waitSeconds = Math.ceil(
        (recentToken.createdAt.getTime() + 60000 - Date.now()) / 1000
      );
      throw new BadRequestException(
        `Please wait ${waitSeconds} seconds before requesting another verification email`
      );
    }

    // Send new verification email
    await this.sendVerificationEmail(userId, user.email);
  }

  /**
   * Check if a user's email is verified
   */
  async isEmailVerified(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['emailVerified'],
    });

    return user?.emailVerified ?? false;
  }

  /**
   * Get verification status for a user
   */
  async getVerificationStatus(userId: string): Promise<{
    emailVerified: boolean;
    email: string;
    emailVerifiedAt: Date | null;
    canResend: boolean;
    resendAvailableAt: Date | null;
  }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['email', 'emailVerified', 'emailVerifiedAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let canResend = !user.emailVerified;
    let resendAvailableAt: Date | null = null;

    if (!user.emailVerified) {
      // Check for recent verification emails
      const recentToken = await this.verificationTokenRepo.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

      if (recentToken) {
        const oneMinuteAfterCreation = new Date(recentToken.createdAt);
        oneMinuteAfterCreation.setMinutes(oneMinuteAfterCreation.getMinutes() + 1);

        if (new Date() < oneMinuteAfterCreation) {
          canResend = false;
          resendAvailableAt = oneMinuteAfterCreation;
        }
      }
    }

    return {
      emailVerified: user.emailVerified,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt || null,
      canResend,
      resendAvailableAt,
    };
  }

  /**
   * Cleanup expired tokens (to be called by a scheduled job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.verificationTokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected || 0;
  }
}
