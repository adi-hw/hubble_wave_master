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
 * W2 Stream 1 PR1 closes F013 at the contract level: JWTs no longer carry
 * `roles` / `permissions`, so there is no embedded array to trust. The
 * port is the ONLY identity source — `JwtAuthGuard` fails closed when
 * `IDENTITY_RESOLVER_PORT` is unbound (the pre-Stream-1 JWT-payload
 * fallback is retired). Production services + tests both bind the port.
 *
 * The port lets `libs/auth-guard` stay free of `@hubblewave/instance-db`
 * and `apps/api` identity services while still letting the guard fetch
 * the latest identity state on every authenticated request. The consuming
 * Nest app supplies an implementation via `IDENTITY_RESOLVER_PORT`.
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
 *
 * W2 Stream 1 PR1: the `roles` / `permissions` shorthand is replaced by
 * the explicit `roleIds` + `roleCodes` + `permissionCodes` split so
 * downstream code can pick the right key for its call site. JWTs no
 * longer carry these fields; the adapter resolves them from the DB on
 * every authenticated request.
 */
export interface ResolvedIdentity {
  /** User id (must match the JWT sub claim). */
  userId: string;
  /**
   * Effective role UUIDs (direct + group + inherited). The ACL-match
   * key against `CollectionAccessRule.roleId` / `PropertyAccessRule.roleId`.
   * Always populated; empty array for users with no role assignments.
   */
  roleIds: string[];
  /**
   * Effective role codes (direct + group + inherited). The audit /
   * `@Roles()` / ABAC-string-match key. Stable across role-row
   * replacements.
   */
  roleCodes: string[];
  /**
   * Effective platform-capability codes (`<domain>:<action>` /
   * `<domain>:<resource>:<action>`) per W2 spec §2.1. The
   * `@RequirePermission` lookup key. Pre-W2 → Stream 2 PR3: empty for
   * every user because path (ii) leaves `platform_permissions`
   * unpopulated until the registry sync ships.
   */
  permissionCodes: string[];
  /**
   * Direct group membership IDs (W6.D / F047). Always populated; empty
   * array for users in no groups. Used by `JwtAuthGuard` to seed
   * `UserRequestContext.groupCache` at request start so the §28
   * evaluator matches `CollectionAccessRule.groupId` /
   * `PropertyAccessRule.groupId` without extra DB queries.
   */
  groupIds: string[];
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
