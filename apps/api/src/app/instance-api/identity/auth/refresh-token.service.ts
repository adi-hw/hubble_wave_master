import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { RefreshToken } from '@hubblewave/instance-db';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly maxTokensPerUser: number;
  private readonly tokenExpiryDays: number;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    configService: ConfigService,
  ) {
    const max = Number(configService.get('AUTH_MAX_REFRESH_TOKENS_PER_USER') ?? 20);
    this.maxTokensPerUser = Number.isNaN(max) ? 20 : max;
    this.tokenExpiryDays = Number(configService.get('REFRESH_TOKEN_EXPIRY_DAYS') ?? 7);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    familyId?: string,
  ): Promise<{ token: string; entity: RefreshToken }> {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);
    const family = familyId || crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.tokenExpiryDays);

    const refreshToken = this.refreshTokenRepo.create({
      userId,
      family,
      token: tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
      isRevoked: false,
    });

    const entity = await this.refreshTokenRepo.save(refreshToken);
    await this.enforceUserLimit(userId, this.maxTokensPerUser);

    return { token, entity };
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    const tokenHash = this.hashToken(token);

    return this.refreshTokenRepo.findOne({
      where: { token: tokenHash },
      relations: ['user'],
    });
  }

  async rotateRefreshToken(
    oldToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ token: string; entity: RefreshToken } | null> {
    const oldRefreshToken = await this.findByToken(oldToken);

    if (!oldRefreshToken) {
      return null;
    }

    const { token, entity } = await this.createRefreshToken(
      oldRefreshToken.userId,
      ipAddress,
      userAgent,
      oldRefreshToken.family || oldRefreshToken.id,
    );

    await this.revokeToken(oldRefreshToken.token, 'ROTATED');

    return { token, entity };
  }

  async revokeToken(tokenHash: string, reason?: string): Promise<void> {
    await this.refreshTokenRepo.update(
      { token: tokenHash },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    );
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepo.update(
      { userId },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'LOGOUT',
      },
    );
  }

  async cleanupExpiredTokens(): Promise<void> {
    await this.refreshTokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  private async enforceUserLimit(userId: string, maxTokens: number): Promise<void> {
    if (maxTokens <= 0) return;

    const active = await this.refreshTokenRepo.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'ASC' },
    });

    if (active.length <= maxTokens) return;

    const toRevoke = active.slice(0, active.length - maxTokens);
    const ids = toRevoke.map((t) => t.id);

    if (ids.length === 0) return;

    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ isRevoked: true, revokedAt: new Date(), revokedReason: 'MAX_SESSIONS_EXCEEDED' })
      .whereInIds(ids)
      .execute();

    this.logger.warn(`Revoked ${ids.length} old refresh tokens due to max session limit`, { userId });
  }
}
