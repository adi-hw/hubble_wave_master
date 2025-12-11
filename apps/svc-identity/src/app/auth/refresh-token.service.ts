import { Injectable, Logger } from '@nestjs/common';
import { LessThan, MoreThan } from 'typeorm';
import { RefreshToken } from '@eam-platform/platform-db';
import * as crypto from 'crypto';
import { TenantDbService } from '@eam-platform/tenant-db';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly maxTokensPerUser: number;

  constructor(
    private readonly tenantDbService: TenantDbService,
    configService: ConfigService,
  ) {
    const max = Number(configService.get('AUTH_MAX_REFRESH_TOKENS_PER_USER') ?? 20);
    this.maxTokensPerUser = Number.isNaN(max) ? 20 : max;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createRefreshToken(
    userId: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
    familyId?: string,
  ): Promise<{ token: string; entity: RefreshToken }> {
    const refreshTokenRepo = await this.tenantDbService.getRepository<RefreshToken>(tenantId, RefreshToken as any);
    // Generate a secure random token
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);
    const family = familyId || crypto.randomUUID();

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = refreshTokenRepo.create({
      userId,
      tenantId,
      familyId: family,
      tokenHash,
      expiresAt,
      createdByIp: ipAddress,
      createdUserAgent: userAgent,
      lastIp: ipAddress,
      lastUserAgent: userAgent,
      lastUsedAt: new Date(),
    });

    const entity = await refreshTokenRepo.save(refreshToken);
    await this.enforceUserLimit(tenantId, userId, this.maxTokensPerUser);

    return { token, entity };
  }

  async findByToken(token: string, tenantId: string): Promise<RefreshToken | null> {
    const refreshTokenRepo = await this.tenantDbService.getRepository<RefreshToken>(tenantId, RefreshToken as any);
    const tokenHash = this.hashToken(token);

    const refreshToken = await refreshTokenRepo.findOne({
      where: { tokenHash, tenantId },
      relations: ['user'],
    });

    return refreshToken;
  }

  async rotateRefreshToken(
    oldToken: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ token: string; entity: RefreshToken } | null> {
    const oldRefreshToken = await this.findByToken(oldToken, tenantId);

    if (!oldRefreshToken) {
      return null;
    }

    // Create new refresh token
    const { token, entity } = await this.createRefreshToken(
      oldRefreshToken.userId,
      tenantId,
      ipAddress,
      userAgent,
      oldRefreshToken.familyId,
    );

    // Mark the old token as replaced
    await this.markReplaced(tenantId, oldRefreshToken.id, entity.id, ipAddress, userAgent);

    return { token, entity };
  }

  async revokeToken(tenantId: string, tokenHash: string, replacedById?: string, reason?: string): Promise<void> {
    const refreshTokenRepo = await this.tenantDbService.getRepository<RefreshToken>(tenantId, RefreshToken as any);
    await refreshTokenRepo.update(
      { tokenHash, tenantId },
      {
        revokedAt: new Date(),
        replacedById,
        revokedReason: reason,
      },
    );
  }

  async revokeAllUserTokens(tenantId: string, userId: string): Promise<void> {
    const refreshTokenRepo = await this.tenantDbService.getRepository<RefreshToken>(tenantId, RefreshToken as any);
    await refreshTokenRepo.update(
      { userId, tenantId },
      {
        revokedAt: new Date(),
        revokedReason: 'LOGOUT',
      },
    );
  }

  async cleanupExpiredTokens(tenantId: string): Promise<void> {
    const refreshTokenRepo = await this.tenantDbService.getRepository<RefreshToken>(tenantId, RefreshToken as any);
    await refreshTokenRepo.delete({
      expiresAt: LessThan(new Date()),
      tenantId,
    });
  }

  async markFamilyAsCompromised(tenantId: string, familyId: string, reason: string) {
    const repo = await this.tenantDbService.getRepository<RefreshToken>(tenantId, RefreshToken as any);
    await repo.update(
      { familyId },
      {
        revokedAt: new Date(),
        revokedReason: reason,
        isReuseSuspect: true,
      }
    );
  }

  async markReplaced(tenantId: string, oldTokenId: string, newTokenId: string, ipAddress?: string, userAgent?: string) {
    const repo = await this.tenantDbService.getRepository<RefreshToken>(tenantId, RefreshToken as any);
    await repo.update(oldTokenId, {
      replacedById: newTokenId,
      lastUsedAt: new Date(),
      lastIp: ipAddress,
      lastUserAgent: userAgent,
    });
  }

  async enforceUserLimit(tenantId: string, userId: string, maxTokens: number) {
    if (maxTokens <= 0) return;
    const repo = await this.tenantDbService.getRepository<RefreshToken>(tenantId, RefreshToken as any);
    const active = await repo.find({
      where: {
        userId,
        tenantId,
        revokedAt: null as any,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'ASC' },
    });
    if (active.length <= maxTokens) return;
    const toRevoke = active.slice(0, active.length - maxTokens);
    const ids = toRevoke.map((t) => t.id);
    if (ids.length === 0) return;
    await repo
      .createQueryBuilder()
      .update(RefreshToken as any)
      .set({ revokedAt: new Date(), revokedReason: 'MAX_SESSIONS_EXCEEDED' })
      .whereInIds(ids)
      .execute();
    this.logger.warn(`Revoked ${ids.length} old refresh tokens due to max session limit`, { userId, tenantId });
  }

  async updateLastUsed(tenantId: string, tokenId: string, ipAddress?: string, userAgent?: string) {
    const repo = await this.tenantDbService.getRepository<RefreshToken>(tenantId, RefreshToken as any);
    await repo.update(tokenId, {
      lastUsedAt: new Date(),
      lastIp: ipAddress,
      lastUserAgent: userAgent,
    });
  }
}
