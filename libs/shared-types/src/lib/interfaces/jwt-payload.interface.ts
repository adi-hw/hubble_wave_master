export interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
  permissions: string[];
  /**
   * Convenience admin flag minted alongside roles. Kept for backward
   * compatibility with handlers that read `payload.is_admin` directly;
   * the authoritative admin signal post-F013 is the resolver port.
   */
  is_admin?: boolean;
  /**
   * Stable session identifier — used by JwtRevocationPort (F002) to
   * key per-session revocation entries written at logout.
   */
  session_id?: string;
  /**
   * Forward-compatible JWT id (RFC 7519). Not minted today; reserved for
   * F015 which adds explicit per-token revocation.
   */
  jti?: string;
  /** Issued-at, seconds since epoch (RFC 7519). Used by revoke-before. */
  iat?: number;
  /** Expiration, seconds since epoch (RFC 7519). */
  exp?: number;
  /** JWT audience claim — pinned to `hubblewave-instance` (F016). */
  aud?: string | string[];
  /** JWT issuer claim — pinned to `hubblewave-identity` (F016). */
  iss?: string;
}
