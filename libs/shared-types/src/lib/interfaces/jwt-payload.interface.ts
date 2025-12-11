/**
 * JWT Token Payload interface
 * Used for typing JWT verification results
 */
export interface JwtPayload {
  /** User ID (subject) */
  sub: string;

  /** Username/email */
  username: string;

  /** Tenant ID */
  tenant_id: string;

  /** User's role names */
  roles: string[];

  /** User's permission names */
  permissions: string[];

  /** Session ID for tracking */
  session_id?: string;

  /** Issued at timestamp */
  iat?: number;

  /** Expiration timestamp */
  exp?: number;

  /** Not before timestamp */
  nbf?: number;

  /** Issuer */
  iss?: string;

  /** Audience */
  aud?: string | string[];
}

/**
 * Refresh token payload (minimal)
 */
export interface RefreshTokenPayload {
  /** User ID */
  sub: string;

  /** Tenant ID */
  tenant_id: string;

  /** Token family for rotation detection */
  family?: string;

  /** Session ID */
  session_id?: string;

  /** Issued at timestamp */
  iat?: number;

  /** Expiration timestamp */
  exp?: number;
}

/**
 * API Key payload
 */
export interface ApiKeyPayload {
  /** API Key ID */
  kid: string;

  /** User ID */
  sub: string;

  /** Tenant ID */
  tenant_id: string;

  /** Scopes/permissions */
  scopes: string[];

  /** Issued at timestamp */
  iat?: number;

  /** Expiration timestamp */
  exp?: number;
}
