import { Injectable } from '@nestjs/common';
import {
  JwtRevocationPort,
  RevocationCheckClaims,
} from '@hubblewave/auth-guard';
import { RedisService } from '@hubblewave/redis';

/**
 * Redis key prefix for per-session revocation entries. Presence of the
 * key means the session has been explicitly logged out. Value is the
 * unix timestamp the revocation was recorded — useful for forensics.
 */
const REVOKED_SESSION_KEY_PREFIX = 'jwt:revoked:session:';

/**
 * Redis key prefix for the per-user "revoke-before" cut-off. Value is
 * a unix timestamp (seconds). Any access token with `iat < value` is
 * rejected. Used for "log me out everywhere" and admin-driven kill
 * switches (password change, role revoke, account suspension).
 */
const REVOKE_BEFORE_KEY_PREFIX = 'jwt:revoke-before:';

/**
 * TTL applied to revocation keys. Slightly longer than the maximum
 * JWT lifetime (15 minutes per AuthModule's JwtModule.signOptions) so
 * the revocation record outlives any token it might invalidate. Set
 * to 24h with margin — even if the access token TTL gets extended
 * (and barring a refresh-token compromise), 24h covers everything.
 */
const REVOCATION_KEY_TTL_SECONDS = 24 * 60 * 60;

/**
 * F002 / JwtRevocationPort implementation backed by Redis.
 *
 * Two revocation surfaces, both checked on every authenticated request
 * (after token verification + identity resolution):
 *
 * 1. Per-session — keyed by `session_id`. Written by the logout endpoint
 *    so a logged-out client's token cannot keep working until the
 *    natural `exp`. Cheap, O(1).
 * 2. Per-user revoke-before — keyed by user id. Written by admin tools
 *    or "log me out everywhere" flows. Invalidates every token issued
 *    before the cut-off without needing to enumerate sessions.
 *
 * Failure mode: Redis outage. The RedisService wrapper logs and returns
 * null on errors, which here surfaces as `isRevoked=false`. This is the
 * correct trade-off — a Redis outage must NOT lock every authenticated
 * user out, because the JWT signature + identity check are still
 * enforced and remain the primary security boundary. The revocation
 * check is best-effort containment for already-issued tokens.
 */
@Injectable()
export class JwtRevocationAdapter implements JwtRevocationPort {
  constructor(private readonly redis: RedisService) {}

  async isRevoked(claims: RevocationCheckClaims): Promise<boolean> {
    // Per-session revocation. Skipped when the token carries no
    // session_id (e.g. system actor tokens or API keys that bypass
    // JwtAuthGuard entirely — they should never reach this code, but
    // we guard defensively).
    if (claims.sessionId) {
      const sessionKey = `${REVOKED_SESSION_KEY_PREFIX}${claims.sessionId}`;
      const sessionRevoked = await this.redis.exists(sessionKey);
      if (sessionRevoked) {
        return true;
      }
    }

    // Per-user revoke-before cut-off. Only meaningful when `iat` is
    // present on the token — every HubbleWave-issued token sets iat
    // automatically via jsonwebtoken, so this branch is the normal
    // path.
    if (claims.userId && typeof claims.iat === 'number') {
      const userKey = `${REVOKE_BEFORE_KEY_PREFIX}${claims.userId}`;
      const raw = await this.redis.get(userKey);
      if (raw) {
        const cutoffSeconds = Number(raw);
        if (Number.isFinite(cutoffSeconds) && claims.iat < cutoffSeconds) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Mark a single session as revoked. Called from the logout endpoint.
   * Idempotent — duplicate calls re-write the same key. Errors are
   * swallowed inside RedisService; the controller logs + records the
   * logout audit event regardless of cache success.
   */
  async revokeSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    const key = `${REVOKED_SESSION_KEY_PREFIX}${sessionId}`;
    await this.redis.set(
      key,
      String(Math.floor(Date.now() / 1000)),
      REVOCATION_KEY_TTL_SECONDS,
    );
  }

  /**
   * Mark every token issued before the given timestamp (seconds since
   * epoch) as revoked for this user. Used by "log me out everywhere"
   * flows and admin-driven kill switches. Defaults to "now" when no
   * timestamp is supplied — the most common case.
   */
  async revokeAllUserTokens(
    userId: string,
    cutoffSeconds?: number,
  ): Promise<void> {
    if (!userId) return;
    const cutoff = cutoffSeconds ?? Math.floor(Date.now() / 1000);
    const key = `${REVOKE_BEFORE_KEY_PREFIX}${userId}`;
    await this.redis.set(key, String(cutoff), REVOCATION_KEY_TTL_SECONDS);
  }
}
