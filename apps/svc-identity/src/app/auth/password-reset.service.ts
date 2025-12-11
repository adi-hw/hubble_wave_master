import { Injectable } from '@nestjs/common';
import { LessThan } from 'typeorm';
import { PasswordResetToken, UserAccount, TenantUserMembership } from '@eam-platform/platform-db';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { TenantDbService } from '@eam-platform/tenant-db';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly tenantDbService: TenantDbService,
    private emailService: EmailService,
  ) {}

  async createResetToken(email: string, tenantId: string): Promise<{ token: string; user: UserAccount } | null> {
    const resetTokenRepo = await this.tenantDbService.getRepository<PasswordResetToken>(tenantId, PasswordResetToken as any);
    const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenantId, UserAccount as any);
    const membershipRepo = await this.tenantDbService.getRepository<TenantUserMembership>(tenantId, TenantUserMembership as any);
    const user = await usersRepo.findOne({
      where: { primaryEmail: email },
    });

    if (!user) {
      // Don't reveal if email exists or not
      return null;
    }

    const membership = await membershipRepo.findOne({ where: { tenantId, userId: user.id } });
    if (!membership || membership.status !== 'ACTIVE') {
      return null;
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Set expiration to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Invalidate any existing tokens for this user
    await resetTokenRepo.update(
      { userId: user.id, tenantId, used: false },
      { used: true, usedAt: new Date() }
    );

    // Create new reset token
    await resetTokenRepo.save({
      tenantId,
      userId: user.id,
      tokenHash,
      expiresAt,
      used: false,
    });

    return { token, user };
  }

  async validateResetToken(tenantId: string, token: string): Promise<UserAccount | null> {
    const resetTokenRepo = await this.tenantDbService.getRepository<PasswordResetToken>(tenantId, PasswordResetToken as any);
    const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenantId, UserAccount as any);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await resetTokenRepo.findOne({
      where: { tokenHash, tenantId },
      relations: ['user'],
    });

    if (!resetToken) {
      return null;
    }

    // Check if token is used
    if (resetToken.used) {
      return null;
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      return null;
    }

    return await usersRepo.findOne({ where: { id: resetToken.userId } });
  }

  async useResetToken(tenantId: string, token: string, newPassword: string): Promise<boolean> {
    const resetTokenRepo = await this.tenantDbService.getRepository<PasswordResetToken>(tenantId, PasswordResetToken as any);
    const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenantId, UserAccount as any);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await resetTokenRepo.findOne({
      where: { tokenHash, tenantId },
      relations: ['user'],
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return false;
    }

    // Mark token as used
    await resetTokenRepo.update(resetToken.id, {
      used: true,
      usedAt: new Date(),
    });

    const hashed = await argon2.hash(newPassword);

    await usersRepo.update(resetToken.userId, {
      passwordHash: hashed,
    });

    return true;
  }

  async cleanupExpiredTokens(tenantId: string): Promise<void> {
    const resetTokenRepo = await this.tenantDbService.getRepository<PasswordResetToken>(tenantId, PasswordResetToken as any);
    await resetTokenRepo.delete({
      expiresAt: LessThan(new Date()),
      tenantId,
    });
  }

  // Send reset email using EmailService
  async sendResetEmail(email: string, token: string, tenantSlug: string): Promise<void> {
    await this.emailService.sendPasswordResetEmail(email, token, tenantSlug);
  }
}
