import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Not } from 'typeorm';
import { RefreshToken } from '@hubblewave/instance-db';

export interface DeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  deviceName?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
}

export interface SessionInfo {
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  ipAddress: string;
  location?: string;
  lastActive: Date;
  isCurrent: boolean;
  createdAt: Date;
}

/**
 * Session service - manages user sessions via refresh tokens
 * Each refresh token represents an active session
 */
@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  /**
   * Parse user agent string to extract device information
   */
  parseUserAgent(userAgent?: string): DeviceInfo {
    if (!userAgent) {
      return {
        deviceType: 'desktop',
        browserName: 'Unknown',
        osName: 'Unknown',
      };
    }

    // Simple user agent parsing without external dependency
    const ua = userAgent.toLowerCase();

    // Determine device type
    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
      deviceType = 'mobile';
    } else if (/tablet|ipad/i.test(ua)) {
      deviceType = 'tablet';
    }

    // Parse browser
    let browserName = 'Unknown';
    let browserVersion = '';
    if (/edg\//i.test(ua)) {
      browserName = 'Microsoft Edge';
      const match = ua.match(/edg\/(\d+)/);
      if (match) browserVersion = match[1];
    } else if (/chrome/i.test(ua) && !/chromium/i.test(ua)) {
      browserName = 'Chrome';
      const match = ua.match(/chrome\/(\d+)/);
      if (match) browserVersion = match[1];
    } else if (/firefox/i.test(ua)) {
      browserName = 'Firefox';
      const match = ua.match(/firefox\/(\d+)/);
      if (match) browserVersion = match[1];
    } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      browserName = 'Safari';
      const match = ua.match(/version\/(\d+)/);
      if (match) browserVersion = match[1];
    } else if (/msie|trident/i.test(ua)) {
      browserName = 'Internet Explorer';
    }

    // Parse OS
    let osName = 'Unknown';
    let osVersion = '';
    if (/windows nt 10/i.test(ua)) {
      osName = 'Windows';
      osVersion = '10/11';
    } else if (/windows nt/i.test(ua)) {
      osName = 'Windows';
    } else if (/mac os x/i.test(ua)) {
      osName = 'macOS';
      const match = ua.match(/mac os x (\d+[._]\d+)/);
      if (match) osVersion = match[1].replace('_', '.');
    } else if (/linux/i.test(ua)) {
      osName = 'Linux';
    } else if (/android/i.test(ua)) {
      osName = 'Android';
      const match = ua.match(/android (\d+)/);
      if (match) osVersion = match[1];
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      osName = 'iOS';
      const match = ua.match(/os (\d+)/);
      if (match) osVersion = match[1];
    }

    return {
      deviceType,
      browserName,
      browserVersion,
      osName,
      osVersion,
    };
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessionsForUser(
    userId: string,
    currentTokenId?: string,
  ): Promise<SessionInfo[]> {
    const tokens = await this.refreshTokenRepo.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    return tokens.map((token) => {
      const deviceInfo = this.parseUserAgent(token.userAgent || undefined);

      return {
        id: token.id,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browserName
          ? `${deviceInfo.browserName}${deviceInfo.browserVersion ? ` ${deviceInfo.browserVersion}` : ''}`
          : 'Unknown Browser',
        os: deviceInfo.osName
          ? `${deviceInfo.osName}${deviceInfo.osVersion ? ` ${deviceInfo.osVersion}` : ''}`
          : 'Unknown OS',
        ipAddress: token.ipAddress || 'Unknown',
        lastActive: token.createdAt, // Could be enhanced with last-used tracking
        isCurrent: token.id === currentTokenId,
        createdAt: token.createdAt,
      };
    });
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.refreshTokenRepo.update(
      { id: sessionId, userId },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'USER_REVOKED',
      },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Revoke all sessions for a user except the current one
   */
  async revokeAllOtherSessions(
    userId: string,
    currentTokenId?: string,
  ): Promise<number> {
    const query: any = {
      userId,
      isRevoked: false,
    };

    if (currentTokenId) {
      query.id = Not(currentTokenId);
    }

    const result = await this.refreshTokenRepo.update(query, {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: 'USER_REVOKED_ALL_OTHERS',
    });

    return result.affected ?? 0;
  }

  /**
   * Revoke all sessions for a user (including current)
   */
  async revokeAllSessionsForUser(userId: string): Promise<number> {
    const result = await this.refreshTokenRepo.update(
      { userId, isRevoked: false },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'USER_LOGOUT_ALL',
      },
    );
    return result.affected ?? 0;
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string, userId: string): Promise<SessionInfo | null> {
    const token = await this.refreshTokenRepo.findOne({
      where: { id: sessionId, userId },
    });

    if (!token) return null;

    const deviceInfo = this.parseUserAgent(token.userAgent || undefined);

    return {
      id: token.id,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browserName
        ? `${deviceInfo.browserName}${deviceInfo.browserVersion ? ` ${deviceInfo.browserVersion}` : ''}`
        : 'Unknown Browser',
      os: deviceInfo.osName
        ? `${deviceInfo.osName}${deviceInfo.osVersion ? ` ${deviceInfo.osVersion}` : ''}`
        : 'Unknown OS',
      ipAddress: token.ipAddress || 'Unknown',
      lastActive: token.createdAt,
      isCurrent: false,
      createdAt: token.createdAt,
    };
  }

  /**
   * Count active sessions for a user
   */
  async countActiveSessions(userId: string): Promise<number> {
    return this.refreshTokenRepo.count({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
    });
  }
}
