import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import {
  RefreshToken,
  type RefreshTokenRevokedReason,
} from '@hubblewave/instance-db';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomBytes,
  randomUUID,
} from 'crypto';

/**
 * Refresh-token service for the instance-api auth-flow surface — canon
 * §29.5 single-use rotation with reuse detection (instance-api copy of
 * the canonical `TokenIssuerService` refresh methods at
 * `apps/api/src/app/identity/auth/token-issuer.service.ts`).
 *
 * Kept as a separate class because the instance-api IdentityModule has
 * its own provider graph distinct from the canonical AuthModule. The
 * behavioral contract is identical: opaque base64url refresh tokens
 * (NOT JWTs), single-use rotation, family-wide revocation on reuse.
 *
 * NOTE: this surface does NOT emit the AccessAuditPort security event
 * on reuse detection — the instance-api IdentityModule does not import
 * the authorization library, and the founder direction for instance-api
 * is to be deleted entirely in a follow-up. The session+access-token
 * revocation still fires, so the security posture downgrade is limited
 * to "no SIEM trail on reuse" until the duplicate is removed.
 */
@Injectable()
export class RefreshTokenService {
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    const raw = Number(configService.get('JWT_REFRESH_TTL_DAYS') ?? 14);
    const days =
      Number.isInteger(raw) && raw >= 1 && raw <= 30 ? raw : 14;
    this.refreshTokenTtlSeconds = days * 24 * 60 * 60;
  }

  /**
   * Issue a brand-new refresh-token family — one row per login.
   */
  async createRefreshTokenFamily(params: {
    userId: string;
    sessionId: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ refreshToken: string; expiresAt: Date; familyId: string }> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const familyId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.refreshTokenTtlSeconds * 1000,
    );

    await this.refreshTokenRepo.insert({
      tokenHash,
      familyId,
      parentTokenId: null,
      userId: params.userId,
      instanceId: null,
      sessionId: params.sessionId,
      deviceLabel: parseDeviceLabel(params.userAgent),
      userAgentHash: params.userAgent ? hashOpaque(params.userAgent) : null,
      ipAddressHash: params.ipAddress ? hashOpaque(params.ipAddress) : null,
      createdAt: now,
      expiresAt,
    });

    return { refreshToken: token, expiresAt, familyId };
  }

  /**
   * Single-use rotation. Reuse → revoke family + session, throw a
   * generic UnauthorizedException upstream.
   */
  async rotateRefreshToken(params: {
    presentedToken: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{
    refreshToken: string;
    expiresAt: Date;
    userId: string;
    sessionId: string;
  } | null> {
    const presentedHash = hashToken(params.presentedToken);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RefreshToken);

      const row = await repo
        .createQueryBuilder('rt')
        .where('rt.token_hash = :hash', { hash: presentedHash })
        .setLock('pessimistic_write')
        .getOne();

      if (!row) return null;

      if (row.expiresAt < new Date()) {
        await this.revokeFamily(manager, row.familyId, 'family_expired');
        return null;
      }

      if (row.revokedAt) {
        return null;
      }

      if (row.lastUsedAt) {
        // Reuse detected.
        await this.revokeFamily(manager, row.familyId, 'reuse_detected');
        return null;
      }

      const newToken = randomBytes(32).toString('base64url');
      const newTokenHash = hashToken(newToken);
      const now = new Date();
      const newExpiresAt = row.expiresAt;

      await repo.update(
        { tokenHash: presentedHash },
        { lastUsedAt: now, replacedByTokenId: newTokenHash },
      );

      await repo.insert({
        tokenHash: newTokenHash,
        familyId: row.familyId,
        parentTokenId: presentedHash,
        userId: row.userId,
        instanceId: row.instanceId,
        sessionId: row.sessionId,
        deviceLabel: row.deviceLabel,
        userAgentHash: params.userAgent
          ? hashOpaque(params.userAgent)
          : row.userAgentHash,
        ipAddressHash: params.ipAddress
          ? hashOpaque(params.ipAddress)
          : row.ipAddressHash,
        createdAt: now,
        expiresAt: newExpiresAt,
      });

      return {
        refreshToken: newToken,
        expiresAt: newExpiresAt,
        userId: row.userId,
        sessionId: row.sessionId,
      };
    });
  }

  /** Logout: revoke every active row tied to `sessionId`. */
  async revokeFamilyForSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    await this.refreshTokenRepo.update(
      { sessionId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: 'logout' },
    );
  }

  /** Password change / admin force-logout. */
  async revokeAllUserFamilies(
    userId: string,
    reason: RefreshTokenRevokedReason = 'password_change',
  ): Promise<void> {
    if (!userId) return;
    await this.refreshTokenRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  async cleanupExpiredTokens(): Promise<void> {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('expires_at < :cutoff', { cutoff: new Date() })
      .execute();
  }

  private async revokeFamily(
    manager: EntityManager,
    familyId: string,
    reason: RefreshTokenRevokedReason,
  ): Promise<void> {
    await manager.getRepository(RefreshToken).update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashOpaque(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseDeviceLabel(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  let browser = 'Browser';
  if (/edg\//.test(ua)) browser = 'Edge';
  else if (/chrome/.test(ua) && !/chromium/.test(ua)) browser = 'Chrome';
  else if (/firefox/.test(ua)) browser = 'Firefox';
  else if (/safari/.test(ua) && !/chrome/.test(ua)) browser = 'Safari';
  let os = 'device';
  if (/windows/.test(ua)) os = 'Windows';
  else if (/android/.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/.test(ua)) os = 'iOS';
  else if (/mac os x/.test(ua)) os = 'Mac';
  else if (/linux/.test(ua)) os = 'Linux';
  return `${browser} on ${os}`;
}
