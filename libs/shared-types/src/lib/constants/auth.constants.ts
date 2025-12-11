/**
 * Authentication and security related constants
 */
export const AUTH_CONSTANTS = {
  /** JWT access token expiry time */
  JWT_EXPIRY: '15m',

  /** Refresh token expiry in days */
  REFRESH_TOKEN_EXPIRY_DAYS: 7,

  /** Maximum refresh tokens allowed per user */
  MAX_REFRESH_TOKENS_PER_USER: 20,

  /** Default maximum failed login attempts before lockout */
  DEFAULT_MAX_FAILED_ATTEMPTS: 5,

  /** Default account lockout duration in minutes */
  DEFAULT_LOCKOUT_DURATION_MINUTES: 30,

  /** MFA TOTP time window (steps before/after) */
  MFA_TOTP_WINDOW: 1,

  /** Number of recovery codes generated for MFA */
  MFA_RECOVERY_CODES_COUNT: 10,

  /** Password history depth for preventing reuse */
  PASSWORD_HISTORY_DEPTH: 5,

  /** Minimum password length */
  MIN_PASSWORD_LENGTH: 8,

  /** Session inactivity timeout in minutes */
  SESSION_INACTIVITY_TIMEOUT_MINUTES: 30,

  /** Cookie names */
  COOKIE_NAMES: {
    REFRESH_TOKEN: 'eam_refresh_token',
    CSRF_TOKEN: 'eam_csrf_token',
  },
} as const;

/**
 * Cache related constants
 */
export const CACHE_CONSTANTS = {
  /** Model registry cache TTL in seconds */
  MODEL_REGISTRY_TTL_SECONDS: 300,

  /** Maximum tenant datasources to keep in pool */
  MAX_TENANT_DATASOURCES: 20,

  /** Permission cache TTL in seconds */
  PERMISSION_CACHE_TTL_SECONDS: 60,

  /** User profile cache TTL in seconds */
  USER_PROFILE_CACHE_TTL_SECONDS: 300,
} as const;

/**
 * Pagination constants
 */
export const PAGINATION_CONSTANTS = {
  /** Default page size */
  DEFAULT_PAGE_SIZE: 20,

  /** Maximum page size */
  MAX_PAGE_SIZE: 100,

  /** Default page number */
  DEFAULT_PAGE: 1,
} as const;

/**
 * Rate limiting constants
 */
export const RATE_LIMIT_CONSTANTS = {
  /** Login attempts per IP per minute */
  LOGIN_ATTEMPTS_PER_MINUTE: 10,

  /** API requests per user per minute */
  API_REQUESTS_PER_MINUTE: 100,

  /** Password reset requests per email per hour */
  PASSWORD_RESET_PER_HOUR: 3,
} as const;

/**
 * Validation constants
 */
export const VALIDATION_CONSTANTS = {
  /** Maximum string field length */
  MAX_STRING_LENGTH: 255,

  /** Maximum text field length */
  MAX_TEXT_LENGTH: 65535,

  /** Maximum table name length */
  MAX_TABLE_NAME_LENGTH: 100,

  /** Maximum field name length */
  MAX_FIELD_NAME_LENGTH: 100,

  /** Reserved field names that cannot be used */
  RESERVED_FIELD_NAMES: ['id', 'created_at', 'updated_at', 'deleted_at', 'tenant_id'],

  /** Reserved table names */
  RESERVED_TABLE_NAMES: ['user', 'users', 'role', 'roles', 'permission', 'permissions', 'tenant', 'tenants'],
} as const;
