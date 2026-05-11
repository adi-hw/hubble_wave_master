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
import { JwtService } from '@nestjs/jwt';
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

/**
 * JwtAuthGuard — global authentication guard for the instance plane.
 *
 * Responsibilities (post audit F002/F013/F016 fix):
 * 1. Verify the bearer token's signature, `audience`, and `issuer` claims
 *    (F016). Mismatched audience or issuer is rejected before any other
 *    work. Matches the posture of `JwtStrategy` in apps/api.
 * 2. Resolve the *current* identity (roles, permissions, lifecycle status)
 *    via {@link IdentityResolverPort}, not the JWT payload (F013). A user
 *    whose roles were revoked or whose account was deactivated since the
 *    token was minted is rejected.
 * 3. Check the {@link JwtRevocationPort} (F002). A token whose session
 *    was logged-out, or whose issued-at predates a per-user revoke
 *    cut-off, is rejected even if it has not yet expired.
 *
 * The two ports are `@Optional()` so light-weight tests that do not wire
 * the identity / revocation stack can still exercise this guard. In any
 * production composition both ports MUST be bound — see
 * `IdentityResolverAdapter` and `JwtRevocationAdapter` in apps/api.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
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

    // Use JWT secret from environment - NO fallback for security
    const jwtSecret =
      process.env['JWT_SECRET'] || process.env['IDENTITY_JWT_SECRET'];

    if (!jwtSecret) {
      this.logger.error(
        'SECURITY ERROR: JWT_SECRET environment variable is not configured. ' +
        'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
      throw new UnauthorizedException('Token verification not configured');
    }

    // F016: pin every accepted token to the platform's audience + issuer,
    // and apply the same 30s clock-skew tolerance JwtStrategy uses. Tokens
    // minted for any other audience or issuer fail verify() and are
    // rejected before identity / revocation checks run.
    //
    // The payload shape from `verify` is broader than JwtPayload (custom
    // claims, legacy `sessionId` aliasing) so we destructure into a single
    // record once and read fields by bracket notation — TypeScript's
    // noPropertyAccessFromIndexSignature otherwise rejects dot reads on
    // the dynamic claims.
    let raw: Record<string, unknown> | null = null;
    try {
      // jsonwebtoken's verify returns `object | string`; cast to the
      // claims map we care about since string returns are impossible
      // when the token is a signed JWS (which is the only mint shape).
      raw = this.jwtService.verify(token, {
        secret: jwtSecret,
        audience: process.env['JWT_AUDIENCE'] || 'hubblewave-instance',
        issuer: process.env['JWT_ISSUER'] || 'hubblewave-identity',
        clockTolerance: 30,
      }) as Record<string, unknown>;
    } catch (err) {
      const msg = (err as Error | undefined)?.message || 'Invalid token';
      this.logger.error(
        `JwtAuthGuard verification failed: ${msg}`,
        (err as Error | undefined)?.stack,
      );
      throw new UnauthorizedException('Invalid token');
    }

    if (!raw || typeof raw !== 'object') {
      throw new UnauthorizedException('Invalid token');
    }

    const sub = raw['sub'];
    const userId = typeof sub === 'string' ? sub : '';
    if (!userId) {
      throw new UnauthorizedException('Invalid token');
    }

    // F013: prefer fresh DB-backed identity over JWT-embedded claims. The
    // JWT payload is a fall-back for test compositions that do not bind
    // IdentityResolverPort (e.g. fixtures that stub a token with hand-rolled
    // roles). Production deployments MUST bind the port — see
    // `IdentityResolverAdapter` in apps/api.
    const rawRoles = raw['roles'];
    let resolvedRoles: string[] = Array.isArray(rawRoles)
      ? (rawRoles as string[])
      : [];
    const rawPerms = raw['permissions'];
    let resolvedPermissions: string[] = Array.isArray(rawPerms)
      ? (rawPerms as string[])
      : [];
    let resolvedIsAdmin =
      resolvedRoles.includes('admin') || raw['is_admin'] === true;

    if (this.identityResolver) {
      const identity = await this.identityResolver.resolveIdentity(userId);
      if (!identity) {
        throw new UnauthorizedException('User not found');
      }
      if (identity.status !== 'active') {
        throw new UnauthorizedException('User is inactive');
      }
      resolvedRoles = identity.roles;
      resolvedPermissions = identity.permissions;
      resolvedIsAdmin = identity.isAdmin;
    }

    const sessionIdRaw = raw['session_id'] ?? raw['sessionId'];
    const sessionId =
      typeof sessionIdRaw === 'string' ? sessionIdRaw : undefined;
    const jtiRaw = raw['jti'];
    const iatRaw = raw['iat'];

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

    const username = raw['username'];
    const attributes = raw['attributes'];
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
      raw,
      bearerToken: token,
    };

    request.user = requestContext;
    request.context = requestContext;
    return true;
  }
}
