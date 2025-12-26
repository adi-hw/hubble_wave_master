import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@hubblewave/redis';
import { REDIS_KEYS, REDIS_TTL } from '@hubblewave/redis';

export interface RedisSessionData {
  sessionId: string;
  userId: string;
  ipAddress: string;
  userAgent?: string;
  deviceType?: string;
  geoLocation?: {
    city?: string;
    country?: string;
    countryCode?: string;
    region?: string;
    timezone?: string;
  };
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  isRemembered?: boolean;
}

/**
 * Session cache service with Redis backing.
 * Provides fast session validation without database queries.
 */
@Injectable()
export class SessionCacheService {
  private readonly logger = new Logger(SessionCacheService.name);
  private readonly _enabled: boolean;

  constructor(
    @Optional() private readonly redisService: RedisService | null,
    private readonly configService: ConfigService,
  ) {
    // Enable Redis cache if service is available and not explicitly disabled
    this._enabled = !!redisService &&
      this.configService.get<string>('SESSION_CACHE_ENABLED', 'true') !== 'false';

    if (this._enabled) {
      this.logger.log('Session cache enabled with Redis');
    } else {
      this.logger.warn('Session cache disabled - falling back to database');
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Cache a session in Redis
   */
  async cacheSession(data: RedisSessionData): Promise<void> {
    if (!this._enabled || !this.redisService) return;

    try {
      const sessionKey = `${REDIS_KEYS.SESSION}${data.sessionId}`;
      const userSessionsKey = `${REDIS_KEYS.USER_SESSIONS}${data.userId}`;

      // Calculate TTL based on expires time
      const ttl = Math.max(
        Math.floor((data.expiresAt - Date.now()) / 1000),
        REDIS_TTL.SESSION
      );

      // Store session data
      await this.redisService.setJson(sessionKey, data, ttl);

      // Add to user's session set
      await this.redisService.sadd(userSessionsKey, data.sessionId);
      await this.redisService.expire(userSessionsKey, REDIS_TTL.REFRESH_TOKEN);

      this.logger.debug(`Cached session ${data.sessionId} for user ${data.userId}`);
    } catch (error) {
      this.logger.error('Failed to cache session:', error);
    }
  }

  /**
   * Get session data from cache
   */
  async getSession(sessionId: string): Promise<RedisSessionData | null> {
    if (!this._enabled || !this.redisService) return null;

    try {
      const sessionKey = `${REDIS_KEYS.SESSION}${sessionId}`;
      return await this.redisService.getJson<RedisSessionData>(sessionKey);
    } catch (error) {
      this.logger.error('Failed to get session from cache:', error);
      return null;
    }
  }

  /**
   * Validate session is cached and not expired/revoked
   */
  async validateSession(sessionId: string): Promise<boolean> {
    if (!this._enabled || !this.redisService) return true; // Fall back to DB validation

    try {
      // Check if session is revoked
      const isRevoked = await this.isSessionRevoked(sessionId);
      if (isRevoked) return false;

      // Check if session exists in cache
      const session = await this.getSession(sessionId);
      if (!session) return true; // Cache miss - let DB validation handle it

      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        await this.invalidateSession(sessionId, session.userId);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to validate session:', error);
      return true; // Fail open to DB validation
    }
  }

  /**
   * Update last activity timestamp for a session
   */
  async updateActivity(sessionId: string): Promise<void> {
    if (!this._enabled || !this.redisService) return;

    try {
      const session = await this.getSession(sessionId);
      if (!session) return;

      session.lastActivityAt = Date.now();

      const sessionKey = `${REDIS_KEYS.SESSION}${sessionId}`;
      const remainingTtl = await this.redisService.ttl(sessionKey);

      if (remainingTtl > 0) {
        await this.redisService.setJson(sessionKey, session, remainingTtl);
      }
    } catch (error) {
      this.logger.error('Failed to update session activity:', error);
    }
  }

  /**
   * Invalidate a specific session
   */
  async invalidateSession(sessionId: string, userId?: string): Promise<void> {
    if (!this._enabled || !this.redisService) return;

    try {
      const sessionKey = `${REDIS_KEYS.SESSION}${sessionId}`;

      // Get user ID from session if not provided
      if (!userId) {
        const session = await this.getSession(sessionId);
        userId = session?.userId;
      }

      // Delete session data
      await this.redisService.del(sessionKey);

      // Add to revoked set
      await this.redisService.sadd(REDIS_KEYS.REVOKED_SESSIONS, sessionId);
      await this.redisService.expire(REDIS_KEYS.REVOKED_SESSIONS, REDIS_TTL.REVOKED_SESSION);

      // Remove from user's session set
      if (userId) {
        const userSessionsKey = `${REDIS_KEYS.USER_SESSIONS}${userId}`;
        await this.redisService.srem(userSessionsKey, sessionId);
      }

      this.logger.debug(`Invalidated session ${sessionId}`);
    } catch (error) {
      this.logger.error('Failed to invalidate session:', error);
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<number> {
    if (!this._enabled || !this.redisService) return 0;

    try {
      const userSessionsKey = `${REDIS_KEYS.USER_SESSIONS}${userId}`;
      const sessionIds = await this.redisService.smembers(userSessionsKey);

      if (sessionIds.length === 0) return 0;

      // Delete each session and add to revoked set
      for (const sessionId of sessionIds) {
        await this.redisService.del(`${REDIS_KEYS.SESSION}${sessionId}`);
        await this.redisService.sadd(REDIS_KEYS.REVOKED_SESSIONS, sessionId);
      }

      // Clear user's session set
      await this.redisService.del(userSessionsKey);

      // Ensure revoked set has proper TTL
      await this.redisService.expire(REDIS_KEYS.REVOKED_SESSIONS, REDIS_TTL.REVOKED_SESSION);

      this.logger.debug(`Invalidated ${sessionIds.length} sessions for user ${userId}`);
      return sessionIds.length;
    } catch (error) {
      this.logger.error('Failed to invalidate all user sessions:', error);
      return 0;
    }
  }

  /**
   * Get all session IDs for a user
   */
  async getUserSessionIds(userId: string): Promise<string[]> {
    if (!this._enabled || !this.redisService) return [];

    try {
      const userSessionsKey = `${REDIS_KEYS.USER_SESSIONS}${userId}`;
      return await this.redisService.smembers(userSessionsKey);
    } catch (error) {
      this.logger.error('Failed to get user session IDs:', error);
      return [];
    }
  }

  /**
   * Get count of active sessions for a user
   */
  async getUserSessionCount(userId: string): Promise<number> {
    if (!this._enabled || !this.redisService) return 0;

    try {
      const userSessionsKey = `${REDIS_KEYS.USER_SESSIONS}${userId}`;
      return await this.redisService.scard(userSessionsKey);
    } catch (error) {
      this.logger.error('Failed to get user session count:', error);
      return 0;
    }
  }

  /**
   * Check if a session has been revoked
   */
  async isSessionRevoked(sessionId: string): Promise<boolean> {
    if (!this._enabled || !this.redisService) return false;

    try {
      return await this.redisService.sismember(REDIS_KEYS.REVOKED_SESSIONS, sessionId);
    } catch (error) {
      this.logger.error('Failed to check if session is revoked:', error);
      return false;
    }
  }

  /**
   * Bulk cache multiple sessions
   */
  async cacheSessions(sessions: RedisSessionData[]): Promise<void> {
    if (!this._enabled || !this.redisService) return;

    for (const session of sessions) {
      await this.cacheSession(session);
    }
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    if (!this._enabled || !this.redisService) {
      return { healthy: false, error: 'Session cache disabled' };
    }

    return await this.redisService.healthCheck();
  }

  /**
   * Track login attempt for rate limiting
   */
  async trackLoginAttempt(identifier: string): Promise<number> {
    if (!this._enabled || !this.redisService) return 0;

    try {
      const key = `${REDIS_KEYS.LOGIN_ATTEMPTS}${identifier}`;
      return await this.redisService.incrWithExpiry(key, REDIS_TTL.LOGIN_LOCKOUT);
    } catch (error) {
      this.logger.error('Failed to track login attempt:', error);
      return 0;
    }
  }

  /**
   * Get login attempt count
   */
  async getLoginAttemptCount(identifier: string): Promise<number> {
    if (!this._enabled || !this.redisService) return 0;

    try {
      const key = `${REDIS_KEYS.LOGIN_ATTEMPTS}${identifier}`;
      const count = await this.redisService.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      this.logger.error('Failed to get login attempt count:', error);
      return 0;
    }
  }

  /**
   * Clear login attempts after successful login
   */
  async clearLoginAttempts(identifier: string): Promise<void> {
    if (!this._enabled || !this.redisService) return;

    try {
      const key = `${REDIS_KEYS.LOGIN_ATTEMPTS}${identifier}`;
      await this.redisService.del(key);
    } catch (error) {
      this.logger.error('Failed to clear login attempts:', error);
    }
  }

  /**
   * Cache MFA session token temporarily
   */
  async cacheMfaToken(tokenId: string, data: { userId: string; expiresAt: number }): Promise<void> {
    if (!this._enabled || !this.redisService) return;

    try {
      const key = `${REDIS_KEYS.MFA_TOKEN}${tokenId}`;
      await this.redisService.setJson(key, data, REDIS_TTL.MFA_TOKEN);
    } catch (error) {
      this.logger.error('Failed to cache MFA token:', error);
    }
  }

  /**
   * Get MFA session token
   */
  async getMfaToken(tokenId: string): Promise<{ userId: string; expiresAt: number } | null> {
    if (!this._enabled || !this.redisService) return null;

    try {
      const key = `${REDIS_KEYS.MFA_TOKEN}${tokenId}`;
      return await this.redisService.getJson(key);
    } catch (error) {
      this.logger.error('Failed to get MFA token:', error);
      return null;
    }
  }

  /**
   * Invalidate MFA token after use
   */
  async invalidateMfaToken(tokenId: string): Promise<void> {
    if (!this._enabled || !this.redisService) return;

    try {
      const key = `${REDIS_KEYS.MFA_TOKEN}${tokenId}`;
      await this.redisService.del(key);
    } catch (error) {
      this.logger.error('Failed to invalidate MFA token:', error);
    }
  }
}
