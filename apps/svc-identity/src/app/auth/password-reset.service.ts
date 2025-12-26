import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { PasswordResetToken, User, RefreshToken } from '@hubblewave/instance-db';
import { EmailService } from '../email/email.service';
import { AuthEventsService } from './auth-events.service';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

/**
 * OWASP-recommended Argon2id parameters
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,        // 3 iterations
  parallelism: 4,     // 4 threads
  hashLength: 32,     // 256-bit output
};

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetToken) private readonly resetTokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
    private emailService: EmailService,
    private authEventsService: AuthEventsService,
  ) {}

  async createResetToken(email: string): Promise<{ token: string; user: User } | null> {
    const user = await this.usersRepo.findOne({
      where: { email: email },
    });

    if (!user) {
      // Don't reveal if email exists or not
      return null;
    }

    if (user.status !== 'active') { // Assuming 'active' is the correct status string
      return null;
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Set expiration to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Invalidate any existing tokens for this user
    await this.resetTokenRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() }
    );

    // Create new reset token
    await this.resetTokenRepo.save({
      userId: user.id,
      token: tokenHash,
      expiresAt,
      usedAt: null,
    });

    return { token, user };
  }

  async validateResetToken(token: string): Promise<User | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await this.resetTokenRepo.findOne({
      where: { token: tokenHash },
      relations: ['user'],
    });

    if (!resetToken) {
      return null;
    }

    // Check if token is used
    if (resetToken.usedAt) {
      return null;
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      return null;
    }

    return await this.usersRepo.findOne({ where: { id: resetToken.userId } });
  }

  async useResetToken(token: string, newPassword: string): Promise<boolean> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await this.resetTokenRepo.findOne({
      where: { token: tokenHash },
      relations: ['user'],
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return false;
    }

    // Mark token as used
    await this.resetTokenRepo.update(resetToken.id, {
      usedAt: new Date(),
    });

    // Hash with OWASP-recommended parameters
    const hashed = await argon2.hash(newPassword, ARGON2_OPTIONS);

    await this.usersRepo.update(resetToken.userId, {
      passwordHash: hashed,
      passwordChangedAt: new Date(),
    });

    // Revoke all refresh tokens for security (force re-login)
    await this.refreshTokenRepo.update(
      { userId: resetToken.userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' }
    );

    // Record the password change event
    await this.authEventsService.record({
      eventType: 'PASSWORD_CHANGED',
      success: true,
      userId: resetToken.userId,
    });

    this.logger.log(`Password reset completed for user ${resetToken.userId}`);

    return true;
  }


  async cleanupExpiredTokens(): Promise<void> {
    await this.resetTokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  // Send reset email using EmailService
  async sendResetEmail(email: string, token: string): Promise<void> {
    await this.emailService.sendPasswordResetEmail(email, token);
  }
}





