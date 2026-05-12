import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
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
import { RequestContext } from './request-context.interface';
import { IS_PUBLIC_KEY } from './public.decorator';
import {
  IDENTITY_RESOLVER_PORT,
  IdentityResolverPort,
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
 * tokens have audience `svc-{target}` per canon §29.7 and are not yet
 * accepted by this guard (closes in a follow-up PR).
 */
const DEFAULT_AUDIENCE = 'hubblewave-instance';

/**
 * Clock skew tolerance, in seconds. Matches `JwtStrategy` and the prior
 * HS256 path; 30s comfortably absorbs typical drift between identity and
 * verifiers without weakening expiry semantics.
 */
const CLOCK_TOLERANCE_SECONDS = 30;

/**
 * JwtAuthGuard — global authentication guard for the instance plane.
 *
 * Responsibilities (post canon §29 PR-B + audit F002/F013/F016 fix):
 *
 *   1. **Signature + claims** (canon §29.3): verify ES256 over the JWT
 *      using the public JWK whose `kid` matches the token header. Only
 *      `active`/`retiring` keys resolve via `KeySigningService.getPublicJwk`,
 *      so a retired/compromised key cannot validate. `aud` must match the
 *      configured audience. `iss` must start with `hubblewave-` (the
 *      suffix is the instance id, verified separately).
 *   2. **Token version** (canon §29.6): compare the JWT's `token_version`
 *      claim to the user's current `security_stamp`. Mismatch → reject
 *      with `Token version stale`. This is the cross-cutting kill-switch
 *      that survives password changes, MFA disables, and admin
 *      force-logouts.
 *   3. **Fresh identity** (F013): resolve roles, permissions, status via
 *      {@link IdentityResolverPort}, not the JWT claims. A user whose
 *      role was revoked between mint and verify is rejected.
 *   4. **Revocation** (F002): check {@link JwtRevocationPort}. A token
 *      whose session was logged-out, or whose `iat` predates a per-user
 *      revoke cutoff, is rejected even before expiry.
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

    // Resolve the public JWK from the signing service. getPublicJwk only
    // returns active/retiring keys; retired or compromised keys throw
    // and the catch below maps them to Invalid token.
    let payload: JWTPayload;
    try {
      const jwk = await this.keySigning.getPublicJwk(header.kid);
      const publicKey = await importJWK(jwk as unknown as JWK, 'ES256');
      const audience =
        process.env['JWT_AUDIENCE'] || DEFAULT_AUDIENCE;
      const verified = await jwtVerify(token, publicKey, {
        audience,
        // We do not pin `issuer` via jose because canon §29.3 issuer is
        // a per-instance suffix; we check the prefix ourselves below
        // after jwtVerify confirms the signature.
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

    // `sub` per canon §29.3 is `user:{user_id}` for human tokens. For
    // backward compat with fixtures we accept a bare user id too.
    const subRaw = payload.sub;
    const userId =
      typeof subRaw === 'string'
        ? subRaw.startsWith('user:')
          ? subRaw.slice('user:'.length)
          : subRaw
        : '';
    if (!userId) {
      throw new UnauthorizedException('Invalid token');
    }

    // F013: prefer fresh DB-backed identity over JWT-embedded claims.
    // Pre-PR-B the fallback path read roles/permissions out of the JWT
    // payload directly. Post-PR-B that fallback remains for tests that
    // do not wire the resolver, but now production also enforces the
    // canon §29.6 token-version check, which requires the resolver.
    const rawRoles = (payload as Record<string, unknown>)['roles'];
    let resolvedRoles: string[] = Array.isArray(rawRoles)
      ? (rawRoles as string[])
      : [];
    const rawPerms = (payload as Record<string, unknown>)['permissions'];
    let resolvedPermissions: string[] = Array.isArray(rawPerms)
      ? (rawPerms as string[])
      : [];
    let resolvedIsAdmin =
      resolvedRoles.includes('admin') ||
      (payload as Record<string, unknown>)['is_admin'] === true;

    if (this.identityResolver) {
      const identity = await this.identityResolver.resolveIdentity(userId);
      if (!identity) {
        throw new UnauthorizedException('User not found');
      }
      if (identity.status !== 'active') {
        throw new UnauthorizedException('User is inactive');
      }
      // Canon §29.6 — kill-switch check. The JWT carries the user's
      // stamp at issuance; the resolver returns the current value.
      // Mismatch means a stamp-bump event (password change, MFA
      // disable, admin force-logout, suspend) invalidated this token.
      const tokenVersion = (payload as Record<string, unknown>)['token_version'];
      if (
        typeof tokenVersion === 'string' &&
        tokenVersion !== identity.securityStamp
      ) {
        throw new UnauthorizedException('Token version stale');
      }
      resolvedRoles = identity.roles;
      resolvedPermissions = identity.permissions;
      resolvedIsAdmin = identity.isAdmin;
    }

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
    const requestContext: RequestContext = {
      userId,
      roles: resolvedRoles,
      permissions: resolvedPermissions,
      isAdmin: resolvedIsAdmin,
      sessionId,
      username: typeof username === 'string' ? username : undefined,
      attributes:
        attributes && typeof attributes === 'object'
          ? (attributes as Record<string, unknown>)
          : undefined,
      raw: payload as Record<string, unknown>,
      bearerToken: token,
    };

    request.user = requestContext;
    request.context = requestContext;
    return true;
  }
}
