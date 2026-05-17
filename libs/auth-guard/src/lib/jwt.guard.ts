import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
  type JWK,
  type JWTPayload,
} from 'jose';
import {
  ServiceRequestContext,
  UserRequestContext,
} from './request-context.interface';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ALLOW_SERVICE_TOKEN } from './allow-service-token.decorator';
import { REQUIRE_SERVICE_SCOPE_KEY } from './require-service-scope.decorator';
import {
  IDENTITY_RESOLVER_PORT,
  IdentityResolverPort,
  type ResolvedIdentity,
} from './identity-resolver.port';
import {
  JWT_REVOCATION_PORT,
  JwtRevocationPort,
} from './jwt-revocation.port';
import {
  KEY_SIGNING_SERVICE,
  KeySigningService,
} from './key-signing/key-signing.service';

/**
 * The canon §29.3 issuer prefix. Every accepted token must have `iss`
 * matching `${ISSUER_PREFIX}${instance_id}`; the suffix is the instance id.
 * Verified after `jwtVerify` so we can do a prefix match (jose itself
 * checks `iss` only via exact string equality).
 */
const ISSUER_PREFIX = 'hubblewave-';

/**
 * Canon §29.3 default audience for human tokens. Service-to-service
 * tokens have audience `svc-{target}` per canon §29.7 — service-token
 * verification compares to `SERVICE_AUDIENCE` (the receiver's own
 * service id).
 */
const DEFAULT_AUDIENCE = 'hubblewave-instance';

/**
 * Canon §29.7 default service audience. `apps/api` (the dominant
 * receiver of service tokens) treats every service token whose `aud`
 * does not match this as a misrouted token and rejects with 401.
 */
const DEFAULT_SERVICE_AUDIENCE = 'svc-api';

/**
 * Clock skew tolerance, in seconds. Matches `JwtStrategy` and the prior
 * HS256 path; 30s comfortably absorbs typical drift between identity and
 * verifiers without weakening expiry semantics.
 */
const CLOCK_TOLERANCE_SECONDS = 30;

/**
 * `sub` claim prefix for service tokens per canon §29.3 + §29.7.
 * `service:<service_id>` distinguishes service callers from human
 * callers (`user:<user_id>`) at the JWT layer.
 */
const SERVICE_SUB_PREFIX = 'service:';
const USER_SUB_PREFIX = 'user:';

/**
 * JwtAuthGuard — global authentication guard for the instance plane.
 *
 * Post canon §29 PR-D, the guard authenticates two distinct caller
 * kinds and populates `request.context` with the discriminated-union
 * `RequestContext` so consumers can branch on `ctx.kind`:
 *
 *   1. **User tokens** (`sub: user:<id>`)
 *      Resolved through `IdentityResolverPort` (F013 — fresh roles +
 *      permissions on every request), checked for revocation via
 *      `JwtRevocationPort` (F002 — session logout / admin revoke),
 *      and validated against `securityStamp` via the `token_version`
 *      claim (canon §29.6 kill-switch). Audience: `hubblewave-instance`.
 *
 *   2. **Service tokens** (`sub: service:<id>`)
 *      Verified against the configured `SERVICE_AUDIENCE` (default
 *      `svc-api` — the receiver's own service identity). Service tokens
 *      DO NOT route through `IdentityResolverPort`, `JwtRevocationPort`,
 *      or `securityStamp` — services have no user identity, no session,
 *      and no per-user revocation. Authorization is by `scope`
 *      (`<collection>:<action>`) which the consuming controller checks
 *      against its needs.
 *
 * **Default-deny for service tokens**: an endpoint accepts service
 * tokens ONLY when it carries `@AllowServiceToken()` at the method or
 * class level. A service token presented to a user-only endpoint is
 * rejected with `Service tokens are not accepted at this endpoint`.
 * This is the canon §28 deny-wins posture applied to the JWT layer.
 *
 * The two identity ports are `@Optional()` so light-weight integration
 * tests can stub them out. `KeySigningService` is REQUIRED — without a
 * public-key source the guard cannot validate any token. Production
 * compositions MUST bind every port; that is asserted by the global
 * authz scanner.
 *
 * Legacy HS256 verification has been removed. The `JWT_SECRET` env var is
 * accepted but unused for verification; consumers should remove it once
 * all token producers are confirmed ES256.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(KEY_SIGNING_SERVICE)
    private readonly keySigning: KeySigningService,
    private readonly logger: Logger,
    private readonly reflector: Reflector,
    @Optional()
    @Inject(IDENTITY_RESOLVER_PORT)
    private readonly identityResolver?: IdentityResolverPort,
    @Optional()
    @Inject(JWT_REVOCATION_PORT)
    private readonly revocation?: JwtRevocationPort,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowsServiceToken =
      this.reflector.getAllAndOverride<boolean>(ALLOW_SERVICE_TOKEN, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) === true;

    const request = ctx.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Canon §29.3 — read the header without verifying so we can resolve
    // the kid → public JWK before we know whether the signature checks
    // out. decodeProtectedHeader throws on a malformed token; let that
    // surface as a generic Invalid token error.
    let header: { alg?: string; kid?: string; typ?: string };
    try {
      header = decodeProtectedHeader(token) as {
        alg?: string;
        kid?: string;
        typ?: string;
      };
    } catch (err) {
      this.logger.error(
        `JwtAuthGuard header decode failed: ${(err as Error).message}`,
      );
      throw new UnauthorizedException('Invalid token');
    }

    if (header.alg !== 'ES256') {
      // Canon §29.1 — every HubbleWave token is ES256. HS256 / RS256 /
      // none are all rejected at the header level so we never expose a
      // downgrade attack surface.
      throw new UnauthorizedException('Invalid token algorithm');
    }
    if (!header.kid) {
      throw new UnauthorizedException('Invalid token header');
    }

    // Determine which audience to verify against. Service tokens use
    // SERVICE_AUDIENCE; user tokens use JWT_AUDIENCE. We peek at the
    // `sub` claim AFTER signature verification, so we have to verify
    // twice in the worst case — instead, accept either audience here
    // and re-check the specific one after we have the payload.
    let payload: JWTPayload;
    try {
      const jwk = await this.keySigning.getPublicJwk(header.kid);
      const publicKey = await importJWK(jwk as unknown as JWK, 'ES256');
      const verified = await jwtVerify(token, publicKey, {
        // Defer audience check to post-signature step where we know
        // the caller kind. jose's audience option does not support
        // "accept any of these audiences contextually."
        clockTolerance: `${CLOCK_TOLERANCE_SECONDS}s`,
        algorithms: ['ES256'],
      });
      payload = verified.payload;
    } catch (err) {
      const msg = (err as Error | undefined)?.message || 'Invalid token';
      this.logger.error(
        `JwtAuthGuard verification failed: ${msg}`,
        (err as Error | undefined)?.stack,
      );
      throw new UnauthorizedException('Invalid token');
    }

    // Canon §29.3 — iss must be `hubblewave-{instance_id}`. The suffix
    // varies per instance so a prefix check is correct; the full string
    // is too brittle for pooled-mode deployments.
    if (typeof payload.iss !== 'string' || !payload.iss.startsWith(ISSUER_PREFIX)) {
      throw new UnauthorizedException('Invalid token issuer');
    }

    const subRaw = payload.sub;
    if (typeof subRaw !== 'string' || subRaw.length === 0) {
      throw new UnauthorizedException('Invalid token');
    }

    // ─────────────────────────────────────────────────────────────
    // Service token branch (canon §29.7)
    // ─────────────────────────────────────────────────────────────
    if (subRaw.startsWith(SERVICE_SUB_PREFIX)) {
      if (!allowsServiceToken) {
        // Canon §29.7 default-deny — a service token at a non-opted-in
        // endpoint MUST be rejected even when the signature is valid.
        throw new UnauthorizedException(
          'Service tokens are not accepted at this endpoint',
        );
      }

      const serviceId = subRaw.slice(SERVICE_SUB_PREFIX.length);
      if (!serviceId) {
        throw new UnauthorizedException('Invalid token');
      }

      const expectedServiceAudience =
        process.env['SERVICE_AUDIENCE'] || DEFAULT_SERVICE_AUDIENCE;
      if (payload.aud !== expectedServiceAudience) {
        throw new UnauthorizedException('Token audience mismatch');
      }

      const rawScope = (payload as Record<string, unknown>)['scope'];
      const scopes: string[] = Array.isArray(rawScope)
        ? (rawScope as string[])
        : [];

      // Canon §29.7 — `@AllowServiceToken()` ALONE is insufficient. An
      // opted-in endpoint MUST also declare which scope a caller must
      // present via `@RequireServiceScope(code)`. Missing declaration
      // is a programmer error surfaced as 500 (so the developer sees it
      // in dev/test before it ships); the `service-token:check` CI
      // scanner catches the same mistake at PR time.
      const requiredScope = this.reflector.getAllAndOverride<string>(
        REQUIRE_SERVICE_SCOPE_KEY,
        [ctx.getHandler(), ctx.getClass()],
      );
      if (typeof requiredScope !== 'string' || requiredScope.length === 0) {
        throw new InternalServerErrorException(
          '@AllowServiceToken() requires a matching @RequireServiceScope(code) ' +
            'at the same handler or class (canon §29.7)',
        );
      }
      if (!scopes.includes(requiredScope)) {
        // 403 with the canon §28 minimal shape — never reveal which
        // scope was missing to the caller.
        throw new ForbiddenException({
          statusCode: 403,
          message: 'Permission denied',
          code: 'PERMISSION_DENIED',
        });
      }

      const instanceId =
        (payload as Record<string, unknown>)['instance_id'];
      const serviceContext: ServiceRequestContext = {
        kind: 'service',
        serviceId,
        instanceId: typeof instanceId === 'string' ? instanceId : '',
        scopes,
        audience: payload.aud as string,
        bearerToken: token,
      };

      request.user = serviceContext;
      request.context = serviceContext;
      return true;
    }

    // ─────────────────────────────────────────────────────────────
    // User token branch — existing flow (post-PR-B + PR-C)
    // ─────────────────────────────────────────────────────────────
    const userAudience = process.env['JWT_AUDIENCE'] || DEFAULT_AUDIENCE;
    if (payload.aud !== userAudience) {
      throw new UnauthorizedException('Token audience mismatch');
    }

    // `sub` per canon §29.3 is `user:{user_id}` for human tokens. For
    // backward compat with fixtures we accept a bare user id too.
    const userId = subRaw.startsWith(USER_SUB_PREFIX)
      ? subRaw.slice(USER_SUB_PREFIX.length)
      : subRaw;
    if (!userId) {
      throw new UnauthorizedException('Invalid token');
    }

    // F013 / W2 Stream 1 PR1: `IdentityResolverPort` is the only source
    // of truth for the user's roles + permissions. The pre-Stream-1 fallback
    // that read `roles` / `permissions` out of the JWT payload is retired —
    // JWTs no longer carry those claims (canon §29.4 + spec §1.1). When the
    // resolver is unbound the guard fails closed; production services bind
    // it, and tests that need to construct a context inline bypass the guard
    // entirely or stub the resolver.
    if (!this.identityResolver) {
      throw new UnauthorizedException(
        'JwtAuthGuard requires IDENTITY_RESOLVER_PORT to be bound (W2 Stream 1 PR1)',
      );
    }
    const resolvedIdentity: ResolvedIdentity | null =
      await this.identityResolver.resolveIdentity(userId);
    if (!resolvedIdentity) {
      throw new UnauthorizedException('User not found');
    }
    if (resolvedIdentity.status !== 'active') {
      throw new UnauthorizedException('User is inactive');
    }
    // Canon §29.6 — kill-switch check. The JWT carries the user's stamp
    // at issuance; the resolver returns the current value. Mismatch
    // means a stamp-bump event (password change, MFA disable, admin
    // force-logout, suspend) invalidated this token.
    const tokenVersion = (payload as Record<string, unknown>)['token_version'];
    if (
      typeof tokenVersion === 'string' &&
      tokenVersion !== resolvedIdentity.securityStamp
    ) {
      throw new UnauthorizedException('Token version stale');
    }
    const resolvedRoleIds: string[] = resolvedIdentity.roleIds;
    const resolvedRoleCodes: string[] = resolvedIdentity.roleCodes;
    const resolvedPermissionCodes: string[] = resolvedIdentity.permissionCodes;
    const resolvedGroupIds: string[] = resolvedIdentity.groupIds;
    const resolvedIsAdmin = resolvedIdentity.isAdmin;
    const resolvedSecurityStamp = resolvedIdentity.securityStamp;

    const sessionIdRaw =
      (payload as Record<string, unknown>)['session_id'] ??
      (payload as Record<string, unknown>)['sessionId'];
    const sessionId =
      typeof sessionIdRaw === 'string' ? sessionIdRaw : undefined;
    const jtiRaw = (payload as Record<string, unknown>)['jti'];
    const iatRaw = payload.iat;

    // F002: short-circuit revoked tokens. Order matters — identity must
    // resolve first so a deleted user surfaces as 'User not found' rather
    // than appearing valid in revocation logs.
    if (this.revocation) {
      const revoked = await this.revocation.isRevoked({
        userId,
        sessionId,
        jti: typeof jtiRaw === 'string' ? jtiRaw : undefined,
        iat: typeof iatRaw === 'number' ? iatRaw : undefined,
      });
      if (revoked) {
        throw new UnauthorizedException('Token revoked');
      }
    }

    const username = (payload as Record<string, unknown>)['username'];
    const attributes = (payload as Record<string, unknown>)['attributes'];
    // W6.D / F047 — seed the request-scoped group cache from the resolved
    // identity so the §28 authz evaluator can match group-based ACL rules
    // without additional per-request DB queries. The cache is keyed on
    // `userId`; for the common single-user path the map has one entry.
    // Service tokens never reach this branch; the service path returns early
    // above, so `groupCache` is never set on `ServiceRequestContext`.
    const groupCache = new Map<string, string[]>();
    groupCache.set(userId, resolvedGroupIds);

    const requestContext: UserRequestContext = {
      kind: 'user',
      userId,
      roleIds: resolvedRoleIds,
      roleCodes: resolvedRoleCodes,
      permissionCodes: resolvedPermissionCodes,
      groupIds: resolvedGroupIds,
      isAdmin: resolvedIsAdmin,
      securityStamp: resolvedSecurityStamp,
      sessionId,
      username: typeof username === 'string' ? username : undefined,
      attributes:
        attributes && typeof attributes === 'object'
          ? (attributes as Record<string, unknown>)
          : undefined,
      raw: payload as Record<string, unknown>,
      bearerToken: token,
      groupCache,
    };

    request.user = requestContext;
    request.context = requestContext;
    return true;
  }
}
