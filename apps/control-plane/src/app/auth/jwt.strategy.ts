import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { decodeProtectedHeader, importJWK, JWK } from 'jose';
import {
  KEY_SIGNING_SERVICE,
  KeySigningService,
} from '@hubblewave/auth-guard';
import { AuthService, JwtPayload } from './auth.service';

const CONTROL_PLANE_ISSUER = 'hubblewave-control-plane';
const CONTROL_PLANE_AUDIENCE = 'hubblewave-control-plane';

/**
 * ES256 JWT verification for the control plane (canon §29.1 + §29.9).
 *
 * The strategy looks up the public key per token via the `kid` header,
 * converting the JWK to PEM for passport-jwt. Active and retiring keys
 * are eligible — the `KeySigningService.getPublicJwk` contract enforces
 * the state check.
 *
 * `validate()` still consults the `RevokedToken` table (token-level
 * revocation list) and the underlying user row so disabled / deleted
 * accounts cannot resurrect themselves via a still-valid token.
 *
 * Canon §29.9 forbids HS256 anywhere in the platform; the pre-Stream-1-PR3
 * symmetric-key signing path is gone.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static readonly logger = new Logger('ControlPlaneJwtStrategy');

  constructor(
    @Inject(KEY_SIGNING_SERVICE)
    keySigning: KeySigningService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['ES256'],
      issuer: CONTROL_PLANE_ISSUER,
      audience: CONTROL_PLANE_AUDIENCE,
      passReqToCallback: false,
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (err: Error | null, secretOrKey?: string | Buffer) => void,
      ) => {
        void JwtStrategy.resolveKey(keySigning, rawJwtToken)
          .then((buf) => done(null, buf))
          .catch((err: Error) => done(err));
      },
      // 30 second clock skew tolerance — same posture the global
      // JwtAuthGuard applies in the instance plane so token edge cases
      // around expiry behave consistently across both planes.
      jsonWebTokenOptions: {
        clockTolerance: 30,
      },
    });
  }

  async validate(payload: JwtPayload & { fam?: string }) {
    if (payload.jti && (await this.authService.isTokenRevoked(payload.jti))) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.authService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      jti: payload.jti,
      family: payload.fam ?? null,
      tokenExpiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
    };
  }

  /**
   * Decode the JWT header (without signature verification — passport-jwt
   * will do that next with the resolved key), pull `kid`, fetch the matching
   * public JWK via `KeySigningService`, import via `jose.importJWK`, and
   * return a buffer-typed key for passport-jwt. Rejects tokens with missing
   * or unknown `kid`. Same shape as `apps/api/src/app/identity/auth/
   * jwt.strategy.ts` so the two planes' verification paths stay in lockstep.
   */
  private static async resolveKey(
    keySigning: KeySigningService,
    rawJwt: string,
  ): Promise<Buffer> {
    const header = decodeProtectedHeader(rawJwt) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== 'ES256') {
      throw new UnauthorizedException(
        `Unsupported alg '${header.alg ?? '<missing>'}'; control plane requires ES256`,
      );
    }
    if (!header.kid) {
      throw new UnauthorizedException('Token header missing kid');
    }

    try {
      const jwk = await keySigning.getPublicJwk(header.kid);
      const publicKey = await importJWK(jwk as unknown as JWK, 'ES256');
      return publicKey as unknown as Buffer;
    } catch (err) {
      this.logger.warn(
        `Rejecting token: kid='${header.kid}' not publishable (${(err as Error).message})`,
      );
      throw new UnauthorizedException('Token kid not recognized');
    }
  }
}
