import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeProtectedHeader, importJWK, type JWK } from 'jose';
import { User } from '@hubblewave/instance-db';
import {
  KEY_SIGNING_SERVICE,
  KeySigningService,
} from '@hubblewave/auth-guard';
import { PermissionResolverService } from '../roles/permission-resolver.service';
import { JwtPayload } from '@hubblewave/shared-types';

/**
 * Canon §29.3 issuer prefix — every accepted token's `iss` must start with
 * `hubblewave-`; the suffix is the instance id. passport-jwt does not have
 * a prefix-match option, so we check this in the validate() callback.
 */
const ISSUER_PREFIX = 'hubblewave-';

/**
 * Canon §29.3 default audience for human tokens.
 */
const DEFAULT_AUDIENCE = 'hubblewave-instance';

/**
 * `JwtStrategy` — passport-jwt strategy for ES256 + JWKS verification per
 * canon §29.3.
 *
 * Runs alongside {@link JwtAuthGuard} from `@hubblewave/auth-guard`. Used
 * by the local identity module's guards (which extend passport-jwt's
 * `AuthGuard('jwt')`) — see `apps/api/src/app/identity/auth/guards/
 * jwt-auth.guard.ts`. The library-level `JwtAuthGuard` does not use
 * passport; the two paths must agree on every accept/reject decision.
 *
 * Migration notes (canon §29 PR-B):
 *   - HS256 verification (shared `JWT_SECRET`) is gone. Tokens are
 *     verified with the ES256 public JWK whose `kid` matches the token
 *     header.
 *   - `secretOrKeyProvider` resolves the public key dynamically. The
 *     callback fetches from {@link KeySigningService.getPublicJwk};
 *     retired/compromised keys raise and reject the token.
 *   - The `validate()` callback enforces canon §29.6 token-version: the
 *     JWT's `token_version` claim must match the user's current
 *     `security_stamp`. A stale stamp means a password change, MFA
 *     disable, admin force-logout, or suspend invalidated this token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly permissionResolver: PermissionResolverService,
    @Inject(KEY_SIGNING_SERVICE)
    keySigning: KeySigningService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Canon §29.3 — ES256 only. The algorithms list defends against
      // alg-confusion attacks even if the kid-keyed key file content
      // were to leak.
      algorithms: ['ES256'],
      audience:
        configService.get<string>('JWT_AUDIENCE') || DEFAULT_AUDIENCE,
      // jose-style dynamic-key callback. passport-jwt forwards the
      // resolved key to jsonwebtoken.verify(), which accepts the
      // KeyObject returned by jose's importJWK.
      //
      // passport-jwt's TypeScript declaration types the done callback's
      // second arg as `string | Buffer`. The runtime accepts KeyObject
      // (jsonwebtoken.verify itself accepts it via JOSE-compat). The
      // cast is the smallest safe escape hatch.
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (err: Error | null, secretOrKey?: string | Buffer) => void,
      ) => {
        (async () => {
          try {
            const header = decodeProtectedHeader(rawJwtToken) as {
              alg?: string;
              kid?: string;
            };
            if (header.alg !== 'ES256') {
              return done(new Error('Invalid token algorithm'));
            }
            if (!header.kid) {
              return done(new Error('Invalid token header'));
            }
            const jwk = await keySigning.getPublicJwk(header.kid);
            const publicKey = await importJWK(jwk as unknown as JWK, 'ES256');
            done(null, publicKey as unknown as Buffer);
          } catch (err) {
            done(err as Error);
          }
        })();
      },
      // 30 second clock skew tolerance — same posture JwtAuthGuard
      // applies, so the two authentication surfaces agree on edge cases
      // around expiry.
      jsonWebTokenOptions: {
        clockTolerance: 30,
      },
    });
  }

  async validate(payload: JwtPayload) {
    // Canon §29.3 — iss must be `hubblewave-{instance_id}`. The suffix
    // varies per instance so a prefix check is correct.
    if (typeof payload.iss !== 'string' || !payload.iss.startsWith(ISSUER_PREFIX)) {
      throw new UnauthorizedException('Invalid token issuer');
    }

    // `sub` per canon §29.3 is `user:{user_id}` for human tokens. Accept
    // bare user id as a fallback for fixtures that have not migrated yet.
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

    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User is inactive');
    }

    // Canon §29.6 — token version is the cross-cutting kill-switch.
    // The JWT carries the stamp at issuance; mismatch with the live DB
    // value rejects every outstanding token after a stamp bump.
    const tokenVersion = (payload as unknown as Record<string, unknown>)[
      'token_version'
    ];
    if (
      typeof tokenVersion === 'string' &&
      tokenVersion !== user.securityStamp
    ) {
      throw new UnauthorizedException('Token version stale');
    }

    // Resolve permissions using the resolver service. The cache key is
    // the user id, so repeated requests within the TTL window incur a
    // single DB round trip. W2 Stream 1 PR1 — the AuthenticatedUser shape
    // carries the explicit roleIds/roleCodes/permissionCodes split.
    const { permissions, roles, groupIds } =
      await this.permissionResolver.getUserPermissions(userId);

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      roleIds: roles.map((r) => r.id),
      roleCodes: roles.map((r) => r.code),
      permissionCodes: Array.from(permissions),
      groupIds: groupIds ?? [],
      securityStamp: user.securityStamp,
      sessionId: payload.session_id,
    };
  }
}
