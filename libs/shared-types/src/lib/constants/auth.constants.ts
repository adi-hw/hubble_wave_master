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
  /** Maximum string property length */
  MAX_STRING_LENGTH: 255,

  /** Maximum text property length */
  MAX_TEXT_LENGTH: 65535,

  /** Maximum collection name length */
  MAX_COLLECTION_NAME_LENGTH: 100,

  /** Maximum property name length */
  MAX_PROPERTY_NAME_LENGTH: 100,

  /** Reserved property names that cannot be used */
  RESERVED_PROPERTY_NAMES: ['id', 'created_at', 'updated_at', 'deleted_at'],

  /** Reserved collection names */
  RESERVED_COLLECTION_NAMES: ['user', 'users', 'role', 'roles', 'permission', 'permissions'],
} as const;

/**
 * AVA (AI Assistant) constants
 */
export const AVA_CONSTANTS = {
  /** Maximum conversation history messages to include in context */
  CONVERSATION_HISTORY_LIMIT: 10,

  /** Maximum RAG documents to retrieve */
  MAX_RAG_DOCUMENTS: 5,

  /** Similarity threshold for RAG retrieval */
  SIMILARITY_THRESHOLD: 0.5,

  /** Maximum tokens for model context */
  MAX_CONTEXT_TOKENS: 8000,

  /** Default temperature for completions */
  DEFAULT_TEMPERATURE: 0.7,
} as const;

/**
 * Bulk operation constants
 */
export const BULK_OPERATION_CONSTANTS = {
  /** Maximum records for bulk update */
  MAX_BULK_UPDATE_SIZE: 500,

  /** Maximum records for bulk delete */
  MAX_BULK_DELETE_SIZE: 500,

  /** Maximum records for bulk insert */
  MAX_BULK_INSERT_SIZE: 1000,
} as const;
