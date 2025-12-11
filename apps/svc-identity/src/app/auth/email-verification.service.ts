import { Injectable } from '@nestjs/common';
import { LessThan } from 'typeorm';
import { EmailVerificationToken, UserAccount } from '@eam-platform/platform-db';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';
import { TenantDbService } from '@eam-platform/tenant-db';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly tenantDbService: TenantDbService,
    private emailService: EmailService,
  ) {}

  async createVerificationToken(tenantId: string, userId: string): Promise<string> {
    const verificationTokenRepo = await this.tenantDbService.getRepository(tenantId, EmailVerificationToken);
    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Set expiration to 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Invalidate existing tokens
    await verificationTokenRepo.update(
      { userId, tenantId, used: false },
      { used: true, usedAt: new Date() }
    );

    // Create new token
    await verificationTokenRepo.save({
      tenantId,
      userId,
      tokenHash,
      expiresAt,
      used: false,
    });

    return token;
  }

  async verifyEmail(tenantId: string, token: string): Promise<boolean> {
    const verificationTokenRepo = await this.tenantDbService.getRepository(tenantId, EmailVerificationToken);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const verificationToken = await verificationTokenRepo.findOne({
      where: { tokenHash, tenantId },
      relations: ['user'],
    });

    if (!verificationToken || verificationToken.used || verificationToken.expiresAt < new Date()) {
      return false;
    }

    // Mark token as used
    await verificationTokenRepo.update(verificationToken.id, {
      used: true,
      usedAt: new Date(),
    });

    return true;
  }

  async sendVerificationEmail(email: string, token: string, tenantSlug: string): Promise<void> {
    await this.emailService.sendEmailVerification(email, token, tenantSlug);
  }

  async resendVerification(tenantId: string, userId: string): Promise<string> {
    const usersRepo = await this.tenantDbService.getRepository(tenantId, UserAccount);
    const user = await usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    return await this.createVerificationToken(tenantId, userId);
  }

  async cleanupExpiredTokens(tenantId: string): Promise<void> {
    const verificationTokenRepo = await this.tenantDbService.getRepository(tenantId, EmailVerificationToken);
    await verificationTokenRepo.delete({
      expiresAt: LessThan(new Date()),
      tenantId,
    });
  }
}
