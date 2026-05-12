/**
 * Port for resolving the *current* identity (roles, permissions, admin flag,
 * lifecycle status) of a user at JWT verification time.
 *
 * Audit finding F013: previously JwtAuthGuard treated the role/permission
 * arrays embedded in the JWT as authoritative, which meant a revoked role
 * remained effective until the (typically 15 min) access token expired.
 * Worse, an offline-deactivated user could keep operating with a stale token
 * because the guard never touched the DB.
 *
 * The port lets `libs/auth-guard` stay free of `@hubblewave/instance-db`
 * and `apps/api` identity services while still letting the guard fetch the
 * latest identity state on every authenticated request. The consuming Nest
 * app supplies an implementation via `IDENTITY_RESOLVER_PORT`.
 *
 * When the port is unbound (e.g. light-weight integration tests that stub
 * out the identity stack), the guard falls back to the JWT payload — this
 * preserves backward compatibility for existing test fixtures. Production
 * services must bind the port to close F013.
 */
export interface IdentityResolverPort {
  /**
   * Look up the live identity for the given user id. Returns null when the
   * user no longer exists. Implementations are free to cache; the guard
   * does not retry on null.
   */
  resolveIdentity(userId: string): Promise<ResolvedIdentity | null>;
}

/**
 * Snapshot of the user's live identity. Roles and permissions are the
 * canonical effective set (direct + group + inherited), already resolved
 * against the role hierarchy. `status` mirrors `users.status` from the
 * instance DB; any value other than `'active'` causes the guard to reject
 * the request, matching the `JwtStrategy.validate` posture in apps/api.
 */
export interface ResolvedIdentity {
  /** User id (must match the JWT sub claim). */
  userId: string;
  /** Effective role codes after inheritance + group expansion. */
  roles: string[];
  /** Effective permission codes after role resolution. */
  permissions: string[];
  /** True when the user holds an admin role (`admin`, `system_admin`, etc.). */
  isAdmin: boolean;
  /**
   * Lifecycle status copied from `users.status`. Anything other than
   * `'active'` is rejected by the guard. Typed loosely as `string` so the
   * port stays decoupled from `UserStatus` in `@hubblewave/instance-db`.
   */
  status: 'active' | 'inactive' | 'suspended' | string;
  /**
   * Cross-cutting token kill-switch per canon §29.6. JWT verifiers
   * compare to the `token_version` claim; mismatch rejects the token with
   * `Token version stale`. Bumped on password change, MFA disable, admin
   * force-logout, and account suspend.
   */
  securityStamp: string;
}

/** Nest DI token for binding the port implementation. */
export const IDENTITY_RESOLVER_PORT = 'IDENTITY_RESOLVER_PORT';
