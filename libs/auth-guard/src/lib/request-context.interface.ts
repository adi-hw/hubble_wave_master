import { Request } from 'express';
import { ForbiddenException } from '@nestjs/common';

/**
 * Canon §29.7 — `RequestContext` is a discriminated union that tells
 * downstream code WHO is calling before it tells WHAT the caller may
 * do. The discriminator `kind` is the contract:
 *
 *   - `kind: 'user'`    — interactive human / API-key / SSO caller.
 *                          Carries `userId`, `roleIds`, `roleCodes`,
 *                          `permissionCodes`, `groupIds`,
 *                          `securityStamp` per canon §29.6.
 *   - `kind: 'service'` — service-to-service caller per canon §29.7.
 *                          Carries `serviceId`, `scopes`, `audience`.
 *                          NO `userId`, NO `roleIds`, NO
 *                          `securityStamp`.
 *
 * Founder direction: do not fake service callers as users. Every
 * consumer that reads `.userId`, `.roleIds`, `.roleCodes`,
 * `.permissionCodes`, `.isAdmin`, or `.securityStamp` MUST first
 * narrow via `assertUserContext(ctx)` or by checking
 * `ctx.kind === 'user'`. Direct field access on the union without
 * narrowing fails type checking — that is the point.
 *
 * Service tokens NEVER reach endpoints not explicitly opted in via
 * `@AllowServiceToken()` (canon §29.7). The default JWT guard
 * rejects service tokens at user endpoints with a clear 401 so the
 * `as any` workaround surface is closed by construction.
 *
 * W2 Stream 1 PR1 — JWT carries no `roles` / `permissions` claims.
 * `IdentityResolverPort` resolves the user's full authority from the
 * DB on every authenticated request and populates the fields below.
 * `roleIds` (UUIDs) is the ACL-match key against `CollectionAccessRule.roleId`
 * / `PropertyAccessRule.roleId`. `roleCodes` (stable codes) is the
 * display / audit / `@Roles()` / ABAC-string-match key. The two are
 * not interchangeable and consumers must pick the right one for the
 * call site's intent.
 */
export type RequestContext = UserRequestContext | ServiceRequestContext;

/**
 * Authenticated human / API-key / SSO caller. The roles / permissions
 * surface is the W2 Stream 1 contract — JWTs no longer carry these
 * claims, `IdentityResolverPort` populates them per request.
 */
export interface UserRequestContext {
  readonly kind: 'user';
  userId: string;
  /**
   * Role UUIDs from `identity.roles.id`. The key for ACL-rule matches
   * (`CollectionAccessRule.roleId`, `PropertyAccessRule.roleId`,
   * `GroupRole.roleId`). Always populated; empty array for users
   * with no role assignments.
   */
  roleIds: string[];
  /**
   * Role codes from `identity.roles.code` (e.g. `'admin'`,
   * `'platform_user'`). The key for `@Roles(...)` decorator matches,
   * audit trails, ABAC string predicates, and any UI display. Stable
   * across role-row replacements; safe to log. Always populated.
   */
  roleCodes: string[];
  /**
   * Platform-capability codes resolved from
   * `identity.role_permissions.permission_code` (colon-segment codes
   * per W2 spec §2.1 — `<domain>:<action>` or
   * `<domain>:<resource>:<action>`). The key for `@RequirePermission`
   * checks. Pre-W2 → Stream 2 PR3 window: this array is empty for
   * every user because path (ii) leaves `platform_permissions`
   * unpopulated until the registry sync ships.
   */
  permissionCodes: string[];
  /**
   * Direct group membership IDs from `identity.group_members.group_id`.
   * Seeded onto the context by `JwtAuthGuard` so the §28 evaluator
   * can match `CollectionAccessRule.groupId` / `PropertyAccessRule.groupId`
   * without an extra DB round-trip per request. Always populated;
   * empty array for users in no groups.
   */
  groupIds: string[];
  isAdmin: boolean;
  /**
   * Cross-cutting token kill-switch per canon §29.6. Carried in the
   * JWT's `token_version` claim; verifiers compare to the live
   * `users.security_stamp` value. Always populated post-Stream 1.
   */
  securityStamp: string;
  attributes?: Record<string, unknown>;
  sessionId?: string;
  username?: string;
  raw?: Record<string, unknown>;
  /**
   * Raw `Bearer <token>` string preserved by JwtAuthGuard. Used by
   * service-to-service callers that forward the original end-user's
   * JWT to a downstream instance service (e.g. svc-data → svc-automation
   * sync-trigger). Treat as sensitive: do not log, do not include in
   * structured outputs, do not persist. Optional because non-JWT auth
   * paths (system actors, migrations) construct RequestContext without
   * a token.
   */
  bearerToken?: string;
  /**
   * Request-scoped group membership cache (W6.D / F047).
   *
   * Populated by `JwtAuthGuard` at request start from the resolved
   * identity's `groupIds`. Consumed by `AuthorizationService.buildUserContext`
   * so that group-based ACL rules (`CollectionAccessRule.groupId`,
   * `PropertyAccessRule.groupId`) are correctly evaluated on every
   * authorised request without additional per-request DB queries.
   *
   * The map is keyed on `userId` so it can be extended for batch scenarios
   * (e.g. an admin viewing records owned by multiple users). For the
   * common single-user request path the map contains exactly one entry.
   *
   * Service tokens NEVER carry this field — service principals have no
   * user identity and therefore no user-group memberships (canon §29.7).
   */
  groupCache?: Map<string, string[]>;
}

/**
 * Service-to-service caller per canon §29.7. Service tokens have
 * no user identity, no session, no per-user revocation. Authorization
 * is by `scope` (`<collection>:<action>`) verified by the receiving
 * service, not by RBAC/ABAC against a user principal.
 *
 * Service tokens are accepted ONLY at endpoints explicitly opted
 * in via `@AllowServiceToken()`. Default-deny — see
 * `JwtAuthGuard.canActivate`.
 */
export interface ServiceRequestContext {
  readonly kind: 'service';
  /** Service identifier — e.g. `svc-worker`. Mirrors the `sub` claim's `service:<id>` suffix. */
  serviceId: string;
  /** Instance id the token was minted for; matches the `iss`/`instance_id` claim suffix. */
  instanceId: string;
  /** `<collection>:<action>` scopes copied from the principal's `allowed_scopes`. */
  scopes: string[];
  /** Target audience the token names — the receiving service (e.g. `svc-api`). */
  audience: string;
  /** Raw token preserved so the receiver can re-attest or forward. */
  bearerToken?: string;
}

/**
 * Narrowing helper — assert that the context is a user caller and
 * return it as `UserRequestContext`. Throws `ForbiddenException`
 * when called with a service context so a service token cannot
 * accidentally reach a code path that assumes a `userId`.
 *
 * Use at the entry point of every method that reads user-shaped
 * fields. Most callsites collapse to:
 *
 * ```ts
 * async someMethod(ctx: RequestContext, ...) {
 *   const userCtx = assertUserContext(ctx);
 *   // userCtx.userId, .roles, etc. are now type-safe.
 * }
 * ```
 */
export function assertUserContext(
  ctx: RequestContext,
): UserRequestContext {
  if (ctx.kind !== 'user') {
    throw new ForbiddenException(
      'User context required — service tokens are not accepted here',
    );
  }
  return ctx;
}

/**
 * Mirror of `assertUserContext` for the service branch. Throws when
 * called with a user context. Use in code that only makes sense
 * for service callers (e.g. quota counters keyed on `serviceId`).
 */
export function assertServiceContext(
  ctx: RequestContext,
): ServiceRequestContext {
  if (ctx.kind !== 'service') {
    throw new ForbiddenException(
      'Service context required — user tokens are not accepted here',
    );
  }
  return ctx;
}

/**
 * Type guard variant — useful when you need to branch rather than
 * throw (e.g. a shared endpoint that handles both kinds).
 */
export function isUserContext(
  ctx: RequestContext,
): ctx is UserRequestContext {
  return ctx.kind === 'user';
}

export function isServiceContext(
  ctx: RequestContext,
): ctx is ServiceRequestContext {
  return ctx.kind === 'service';
}

/**
 * User object attached by JWT strategy after authentication. Mirrors
 * `UserRequestContext` minus the discriminator and the request-scope
 * caches — `JwtAuthGuard` reads from `IdentityResolverPort` and
 * populates this shape onto `request.user` for compatibility with the
 * passport contract. Fields match the W2 Stream 1 vocabulary.
 */
export interface AuthenticatedUser {
  userId: string;
  username: string;
  roleIds: string[];
  roleCodes: string[];
  permissionCodes: string[];
  groupIds: string[];
  securityStamp: string;
  sessionId?: string;
}

/**
 * Extended Express Request with context information
 */
export interface InstanceRequest extends Request {
  context: RequestContext;
  user?: AuthenticatedUser | RequestContext;
}

// Deprecated alias for backward compatibility
export type TenantRequest = InstanceRequest;

/**
 * Request type for authenticated endpoints
 * Use this when @UseGuards(JwtAuthGuard) is applied
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  ip: string;
  headers: Request['headers'] & {
    'user-agent'?: string;
  };
}

/**
 * Request type for public endpoints
 */
export interface PublicRequest extends Request {
  ip: string;
  headers: Request['headers'] & {
    'user-agent'?: string;
    host?: string;
  };
}

/**
 * Safely extracts the user-shaped RequestContext from a request
 * object. Throws `ForbiddenException` (via `assertUserContext`) when
 * the request was authenticated by a service token — endpoints that
 * call this expect a human caller. Service endpoints should instead
 * read `request.context` directly and branch on `.kind`.
 *
 * @throws ForbiddenException — service token at user endpoint
 * @throws Error              — no context at all (guard misconfigured)
 */
export function extractContext(
  req: InstanceRequest | AuthenticatedRequest | Record<string, unknown>,
): UserRequestContext {
  // Primary: Use context from InstanceRequest (set by middleware/guard)
  const ctx = (req as { context?: unknown }).context;
  if (ctx && isValidContext(ctx)) {
    return assertUserContext(ctx);
  }

  // Fallback: Build context from AuthenticatedUser if available.
  // This path runs only when JwtAuthGuard is bypassed but a passport
  // strategy attached a user — there is no service-token equivalent
  // because service flows always populate `request.context`.
  const user = (req as { user?: unknown }).user;
  if (user && isValidAuthenticatedUser(user)) {
    return {
      kind: 'user',
      userId: user.userId,
      username: user.username,
      roleIds: user.roleIds ?? [],
      roleCodes: user.roleCodes ?? [],
      permissionCodes: user.permissionCodes ?? [],
      groupIds: user.groupIds ?? [],
      securityStamp: user.securityStamp ?? '',
      isAdmin: user.roleCodes?.includes('admin') ?? false,
      sessionId: user.sessionId,
    };
  }

  throw new Error(
    'No valid RequestContext found on request. Ensure JwtAuthGuard is applied.',
  );
}

/**
 * Type guard to check if an object is a valid RequestContext.
 * Canon §29.7 discriminated shape only — the pre-W2-Stream-1
 * untagged shape (legacy `roles` field) is no longer accepted; the
 * W2 contract requires the new `roleIds` + `roleCodes` split per
 * Stream 1 PR1.
 */
function isValidContext(obj: unknown): obj is RequestContext {
  if (!obj || typeof obj !== 'object') return false;
  const ctx = obj as Record<string, unknown>;
  if (ctx['kind'] === 'service') {
    return typeof ctx['serviceId'] === 'string' && Array.isArray(ctx['scopes']);
  }
  return typeof ctx['userId'] === 'string' && Array.isArray(ctx['roleIds']);
}

/**
 * Type guard to check if an object is a valid AuthenticatedUser
 */
function isValidAuthenticatedUser(obj: unknown): obj is AuthenticatedUser {
  if (!obj || typeof obj !== 'object') return false;
  const user = obj as Record<string, unknown>;
  return typeof user['userId'] === 'string';
}
