import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
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
  /** session_id from the refresh-token family (canon §29.5). */
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  /** Always 'Unknown' — IP is hashed on the operational row per canon §29.5. */
  ipAddress: string;
  /** User-supplied device label or UA-derived display string. */
  deviceLabel?: string | null;
  location?: string;
  lastActive: Date;
  isCurrent: boolean;
  createdAt: Date;
}

/**
 * Session service — exposes active refresh-token families to the user
 * (canon §29.5).
 *
 * In the §29.5 model, a "session" is a refresh-token family identified
 * by `session_id`. Each rotation produces a new row in the family but
 * carries the same `session_id`, so the user sees one session per
 * device-login regardless of how many rotations have happened.
 *
 * Plaintext IP and User-Agent are NOT stored on the operational row.
 * The session list shows `device_label` (the user-friendly string the
 * client supplied or that was UA-parsed at issue time) and best-effort
 * browser/OS extracted from the same source. For forensic IP/UA
 * details, see `AccessAuditLog` entries written by
 * `AccessAuditPort.logSecurityEvent`.
 */
@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  /**
   * Parse a User-Agent string into a device-info object. Used at issue
   * time (via `parseDeviceLabelFromUserAgent`) and at display time for
   * the session list. Cheap heuristic — keeps the lib free of a
   * full UA-parsing dependency.
   */
  parseUserAgent(userAgent?: string): DeviceInfo {
    if (!userAgent) {
      return {
        deviceType: 'desktop',
        browserName: 'Unknown',
        osName: 'Unknown',
      };
    }

    const ua = userAgent.toLowerCase();

    // Determine device type — check tablet patterns BEFORE mobile because
    // iPad UAs contain "Mobile" (e.g., "Mobile/15E148 Safari/604.1").
    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (/tablet|ipad/i.test(ua)) {
      deviceType = 'tablet';
    } else if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
      deviceType = 'mobile';
    }

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

    let osName = 'Unknown';
    let osVersion = '';
    if (/windows nt 10/i.test(ua)) {
      osName = 'Windows';
      osVersion = '10/11';
    } else if (/windows nt/i.test(ua)) {
      osName = 'Windows';
    } else if (/android/i.test(ua)) {
      osName = 'Android';
      const match = ua.match(/android (\d+)/);
      if (match) osVersion = match[1];
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      osName = 'iOS';
      const match = ua.match(/os (\d+)/);
      if (match) osVersion = match[1];
    } else if (/mac os x/i.test(ua)) {
      osName = 'macOS';
      const match = ua.match(/mac os x (\d+[._]\d+)/);
      if (match) osVersion = match[1].replace('_', '.');
    } else if (/linux/i.test(ua)) {
      osName = 'Linux';
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
   * List every active session for the user, deduplicated by `session_id`
   * (so multiple rotations in the same family show as one row). The
   * current session is marked when `currentSessionId` matches.
   */
  async getActiveSessionsForUser(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionInfo[]> {
    const tokens = await this.refreshTokenRepo.find({
      where: {
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    // Deduplicate by session_id — show one row per family, keyed off the
    // most recent rotation (descending order from the query). Map
    // preserves insertion order.
    const bySession = new Map<string, RefreshToken>();
    for (const token of tokens) {
      if (!bySession.has(token.sessionId)) {
        bySession.set(token.sessionId, token);
      }
    }

    return Array.from(bySession.values()).map((token) =>
      this.toSessionInfo(token, currentSessionId),
    );
  }

  /**
   * Revoke a specific session (refresh-token family). Used by the
   * "log this device out" surface. Canon §29.5 reason 'admin_revoke'
   * — captures user-initiated revocation as a deliberate action.
   */
  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.refreshTokenRepo.update(
      { sessionId, userId, revokedAt: IsNull() },
      {
        revokedAt: new Date(),
        revokedReason: 'admin_revoke',
      },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Revoke every active session for the user EXCEPT the one whose
   * `session_id` matches `currentSessionId`. "Log me out from every
   * other device."
   */
  async revokeAllOtherSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<number> {
    const where: Parameters<typeof this.refreshTokenRepo.update>[0] = {
      userId,
      revokedAt: IsNull(),
    };

    if (currentSessionId) {
      // TypeORM Not() on a single column lets us exclude the current
      // session from the bulk revoke.
      (where as Record<string, unknown>)['sessionId'] = Not(currentSessionId);
    }

    const result = await this.refreshTokenRepo.update(where, {
      revokedAt: new Date(),
      revokedReason: 'admin_revoke',
    });

    return result.affected ?? 0;
  }

  /**
   * Revoke every active session for the user, including the current one.
   * "Log me out everywhere."
   */
  async revokeAllSessionsForUser(userId: string): Promise<number> {
    const result = await this.refreshTokenRepo.update(
      { userId, revokedAt: IsNull() },
      {
        revokedAt: new Date(),
        revokedReason: 'admin_revoke',
      },
    );
    return result.affected ?? 0;
  }

  /**
   * Fetch a single session by its `session_id`. Returns the most recent
   * rotation as the representative row.
   */
  async getSessionById(
    sessionId: string,
    userId: string,
  ): Promise<SessionInfo | null> {
    const token = await this.refreshTokenRepo.findOne({
      where: { sessionId, userId },
      order: { createdAt: 'DESC' },
    });

    if (!token) return null;
    return this.toSessionInfo(token);
  }

  /**
   * Count active sessions (distinct `session_id` values with at least
   * one un-revoked row).
   */
  async countActiveSessions(userId: string): Promise<number> {
    const result = await this.refreshTokenRepo
      .createQueryBuilder('rt')
      .select('COUNT(DISTINCT rt.session_id)', 'count')
      .where('rt.user_id = :userId', { userId })
      .andWhere('rt.revoked_at IS NULL')
      .andWhere('rt.expires_at > :now', { now: new Date() })
      .getRawOne<{ count: string }>();
    return Number(result?.count ?? 0);
  }

  private toSessionInfo(
    token: RefreshToken,
    currentSessionId?: string,
  ): SessionInfo {
    // Best-effort browser/OS extraction from the device label. The
    // operational table no longer carries a raw UA — only its hash + a
    // pre-parsed label. Splitting "Chrome on Mac" into ('Chrome', 'Mac')
    // is the cheapest reconstruction.
    const label = token.deviceLabel ?? null;
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';
    if (label) {
      const match = label.match(/^(.*) on (.*)$/);
      if (match) {
        browser = match[1];
        os = match[2];
      } else {
        browser = label;
      }
    }

    const deviceType: 'desktop' | 'mobile' | 'tablet' = /iphone|ipod|android|mobile/i.test(label ?? '')
      ? 'mobile'
      : /ipad|tablet/i.test(label ?? '')
        ? 'tablet'
        : 'desktop';

    return {
      id: token.sessionId,
      deviceType,
      browser,
      os,
      ipAddress: 'Unknown',
      deviceLabel: label,
      lastActive: token.lastUsedAt ?? token.createdAt,
      isCurrent: token.sessionId === currentSessionId,
      createdAt: token.createdAt,
    };
  }
}
