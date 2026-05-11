/**
 * Port for checking whether a JWT (or the session backing it) has been
 * explicitly revoked.
 *
 * Audit finding F002: the instance plane previously had no JWT revocation
 * mechanism. Once issued, an access token remained valid until its `exp`,
 * meaning logout was cosmetic — anyone who captured a token could keep
 * using it for the rest of its lifetime. Refresh tokens were revocable
 * (see RefreshTokenService.revokeAllUserTokens) but the short-lived access
 * token was not.
 *
 * The port lets `libs/auth-guard` stay free of `@hubblewave/redis` and the
 * consuming Nest app supplies a Redis-backed implementation via
 * `JWT_REVOCATION_PORT`. When the port is unbound (e.g. light-weight
 * integration tests), the guard skips the revocation check — preserving
 * backward compatibility for existing test fixtures. Production services
 * must bind the port to close F002.
 */
export interface JwtRevocationPort {
  /**
   * Returns true when the presented token's session or user has been
   * explicitly revoked. Implementations check two revocation surfaces:
   *
   * 1. Per-session revocation — a logout call invalidated this exact
   *    session_id, so any token carrying it is rejected.
   * 2. Per-user revoke-before — an admin (or the user themselves via
   *    "log me out everywhere") set a cut-off timestamp; tokens issued
   *    before it are rejected.
   *
   * Implementations MUST NOT throw on a missing/unreachable backing
   * store — in that case they SHOULD log and return false, so a temporary
   * outage cannot lock every authenticated user out. The runtime
   * authorization checks (RolesGuard, PermissionsGuard) remain the
   * ultimate gate on what the token can actually do.
   */
  isRevoked(claims: RevocationCheckClaims): Promise<boolean>;
}

/**
 * Subset of JWT claims the revocation check needs. Defined here rather
 * than reusing `JwtPayload` so the port has no transitive dependency on
 * `@hubblewave/shared-types`.
 */
export interface RevocationCheckClaims {
  /** From JWT `sub`. Always present. */
  userId: string;
  /**
   * From JWT `session_id`. Optional because not every token type carries a
   * session (e.g. machine-to-machine API keys may not). Implementations
   * must tolerate undefined.
   */
  sessionId?: string;
  /**
   * Forward-compatible JWT `jti` (RFC 7519). Current HubbleWave-issued
   * access tokens do not include `jti` — F015 will add it. The port
   * accepts it now so adapters do not need updating when F015 lands.
   */
  jti?: string;
  /**
   * From JWT `iat` (issued-at, seconds since epoch). Used by the
   * "revoke-before" check: any token with `iat < cutoff` is rejected.
   */
  iat?: number;
}

/** Nest DI token for binding the port implementation. */
export const JWT_REVOCATION_PORT = 'JWT_REVOCATION_PORT';
