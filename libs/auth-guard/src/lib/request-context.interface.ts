import { Request } from 'express';
import { ForbiddenException } from '@nestjs/common';

/**
 * Canon §29.7 — `RequestContext` is a discriminated union that tells
 * downstream code WHO is calling before it tells WHAT the caller may
 * do. The discriminator `kind` is the contract:
 *
 *   - `kind: 'user'`    — interactive human / API-key / SSO caller.
 *                          Carries `userId`, `roles`, `permissions`,
 *                          `securityStamp` per canon §29.6.
 *   - `kind: 'service'` — service-to-service caller per canon §29.7.
 *                          Carries `serviceId`, `scopes`, `audience`.
 *                          NO `userId`, NO `roles`, NO
 *                          `securityStamp`.
 *
 * Founder direction: do not fake service callers as users. Every
 * consumer that reads `.userId`, `.roles`, `.permissions`,
 * `.isAdmin`, or `.securityStamp` MUST first narrow via
 * `assertUserContext(ctx)` or by checking `ctx.kind === 'user'`.
 * Direct field access on the union without narrowing fails type
 * checking — that is the point.
 *
 * Service tokens NEVER reach endpoints not explicitly opted in via
 * `@AllowServiceToken()` (canon §29.7). The default JWT guard
 * rejects service tokens at user endpoints with a clear 401 so the
 * `as any` workaround surface is closed by construction.
 */
export type RequestContext = UserRequestContext | ServiceRequestContext;

/**
 * Authenticated human / API-key / SSO caller. The shape mirrors the
 * pre-canon-§29-PR-D contract — every existing field is preserved,
 * the `kind` discriminator is the only addition. Consumers that
 * have narrowed (or that only run on user endpoints) keep
 * compiling unchanged.
 */
export interface UserRequestContext {
  readonly kind: 'user';
  userId: string;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
  /**
   * Cross-cutting token kill-switch per canon §29.6. Carried in the
   * JWT's `token_version` claim; verifiers compare to the live
   * `users.security_stamp` value.
   */
  securityStamp?: string;
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
 * User object attached by JWT strategy after authentication
 */
export interface AuthenticatedUser {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
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
      roles: user.roles || [],
      permissions: user.permissions || [],
      isAdmin: user.roles?.includes('admin') ?? false,
      sessionId: user.sessionId,
    };
  }

  throw new Error(
    'No valid RequestContext found on request. Ensure JwtAuthGuard is applied.',
  );
}

/**
 * Type guard to check if an object is a valid RequestContext.
 * Accepts both the canon §29.7 discriminated shape and the legacy
 * untagged shape for tests that construct contexts inline.
 */
function isValidContext(obj: unknown): obj is RequestContext {
  if (!obj || typeof obj !== 'object') return false;
  const ctx = obj as Record<string, unknown>;
  if (ctx['kind'] === 'service') {
    return typeof ctx['serviceId'] === 'string' && Array.isArray(ctx['scopes']);
  }
  // 'user' kind OR legacy untagged shape (treated as user).
  return typeof ctx['userId'] === 'string' && Array.isArray(ctx['roles']);
}

/**
 * Type guard to check if an object is a valid AuthenticatedUser
 */
function isValidAuthenticatedUser(obj: unknown): obj is AuthenticatedUser {
  if (!obj || typeof obj !== 'object') return false;
  const user = obj as Record<string, unknown>;
  return typeof user['userId'] === 'string';
}
