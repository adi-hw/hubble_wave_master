// Redis injection token
export const REDIS_CLIENT = 'REDIS_CLIENT';

// Key prefixes for different use cases
export const REDIS_KEYS = {
  // Session keys
  SESSION: 'session:', // session:{sessionId}
  USER_SESSIONS: 'user:sessions:', // user:sessions:{userId} -> SET of session IDs
  REVOKED_SESSIONS: 'revoked:sessions', // SET of revoked session IDs

  // Token keys
  REFRESH_TOKEN: 'refresh:', // refresh:{tokenId}
  TOKEN_BLACKLIST: 'blacklist:', // blacklist:{tokenId}
  MFA_TOKEN: 'mfa:', // mfa:{tokenId}

  // Rate limiting
  RATE_LIMIT: 'ratelimit:', // ratelimit:{key}
  LOGIN_ATTEMPTS: 'login:attempts:', // login:attempts:{userId or IP}

  // Cache keys
  USER_CACHE: 'cache:user:', // cache:user:{userId}
  PERMISSIONS_CACHE: 'cache:perms:', // cache:perms:{userId}
} as const;

// Default TTLs in seconds
export const REDIS_TTL = {
  SESSION: 8 * 60 * 60, // 8 hours for session
  REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7 days for refresh token
  MFA_TOKEN: 5 * 60, // 5 minutes for MFA token
  REVOKED_SESSION: 7 * 24 * 60 * 60, // 7 days (match refresh token TTL)
  USER_CACHE: 5 * 60, // 5 minutes for user cache
  PERMISSIONS_CACHE: 5 * 60, // 5 minutes for permissions cache
  RATE_LIMIT: 15 * 60, // 15 minutes for rate limiting
  LOGIN_LOCKOUT: 30 * 60, // 30 minutes for login lockout
} as const;
