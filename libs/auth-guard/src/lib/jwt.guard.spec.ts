import { ExecutionContext, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  generateKeyPairSync,
  KeyObject,
} from 'crypto';
import {
  exportJWK,
  SignJWT,
} from 'jose';
import { JwtAuthGuard } from './jwt.guard';
import { IdentityResolverPort } from './identity-resolver.port';
import { JwtRevocationPort } from './jwt-revocation.port';
import { KeySigningService, PublicJwk } from './key-signing/key-signing.service';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Test harness for {@link JwtAuthGuard}. Post canon §29 PR-B coverage:
 *   - canon §29.3: ES256 signature + audience + issuer prefix
 *   - canon §29.6: token_version vs security_stamp mismatch
 *   - F013 (extended): securityStamp surfaces through the resolver port
 *   - F002 (preserved): revocation port short-circuits otherwise-valid tokens
 *
 * The mock KeySigningService keeps a real ES256 keypair in memory so
 * every test exercises an end-to-end sign→verify cycle. Retired keys
 * are modeled by having `getPublicJwk` throw — matching the production
 * provider's behavior for non-publishable states.
 */

interface BuiltContext {
  ctx: ExecutionContext;
  request: Record<string, unknown>;
}

function buildContext(opts: {
  isPublic?: boolean;
  authHeader?: string | undefined;
}): BuiltContext {
  const request: Record<string, unknown> = {
    headers: opts.authHeader ? { authorization: opts.authHeader } : {},
  };
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

function buildReflector(isPublic: boolean): Reflector {
  const r = new Reflector();
  jest
    .spyOn(r, 'getAllAndOverride')
    .mockImplementation((key: unknown) =>
      key === IS_PUBLIC_KEY ? isPublic : undefined,
    );
  return r;
}

const silentLogger: Logger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
} as unknown as Logger;

/**
 * Issue a real ES256 JWT with arbitrary claims, returning both the token
 * and the corresponding public JWK the signer would publish.
 */
async function issueTestToken(
  kid: string,
  claims: Record<string, unknown>,
): Promise<{ token: string; publicJwk: PublicJwk; privateKey: KeyObject }> {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const jwk = (await exportJWK(publicKey)) as Partial<PublicJwk>;
  const publicJwk: PublicJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: jwk.x as string,
    y: jwk.y as string,
    kid,
    use: 'sig',
    alg: 'ES256',
  };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid })
    .sign(privateKey);
  return { token, publicJwk, privateKey };
}

/**
 * `KeySigningService` mock — getPublicJwk returns the registered JWK or
 * throws NotFoundException, mirroring the production posture for
 * retired/compromised keys.
 */
function buildKeySigning(jwks: Record<string, PublicJwk>): KeySigningService {
  return {
    sign: jest.fn(),
    getPublicJwk: jest.fn(async (kid: string) => {
      const jwk = jwks[kid];
      if (!jwk) {
        throw new NotFoundException(`Unknown kid: ${kid}`);
      }
      return jwk;
    }),
    rotateKey: jest.fn(),
    getActiveKey: jest.fn(),
    getVerifyingKeys: jest.fn(),
  };
}

const ORIGINAL_ENV = { ...process.env };

describe('JwtAuthGuard (canon §29 PR-B)', () => {
  const ISS = 'hubblewave-inst-1';

  /**
   * Helper that issues a token + builds a guard with the appropriate
   * KeySigning mock so the test only specifies the interesting claims.
   */
  async function buildGuardForClaims(
    claims: Record<string, unknown>,
    options: {
      identity?: IdentityResolverPort;
      revocation?: JwtRevocationPort;
      isPublic?: boolean;
      keyState?: 'active' | 'retired';
    } = {},
  ) {
    const kid = 'hwk_2026_05_11_aaaa1111';
    const { token, publicJwk } = await issueTestToken(kid, {
      iss: ISS,
      aud: 'hubblewave-instance',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
      ...claims,
    });
    const jwks: Record<string, PublicJwk> =
      options.keyState === 'retired' ? {} : { [kid]: publicJwk };
    const keySigning = buildKeySigning(jwks);
    const guard = new JwtAuthGuard(
      keySigning,
      silentLogger,
      buildReflector(options.isPublic ?? false),
      options.identity,
      options.revocation,
    );
    const { ctx, request } = buildContext({
      authHeader: `Bearer ${token}`,
      isPublic: options.isPublic,
    });
    return { guard, ctx, request, token, kid, publicJwk, keySigning };
  }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, JWT_AUDIENCE: 'hubblewave-instance' };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('public route short-circuit', () => {
    it('returns true without verifying when @Public() is set', async () => {
      const keySigning = buildKeySigning({});
      const guard = new JwtAuthGuard(
        keySigning,
        silentLogger,
        buildReflector(true),
      );
      const { ctx } = buildContext({ isPublic: true });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(keySigning.getPublicJwk).not.toHaveBeenCalled();
    });
  });

  describe('header parsing', () => {
    it('rejects when the Authorization header is missing', async () => {
      const keySigning = buildKeySigning({});
      const guard = new JwtAuthGuard(
        keySigning,
        silentLogger,
        buildReflector(false),
      );
      const { ctx } = buildContext({ authHeader: undefined });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the Authorization header does not start with Bearer', async () => {
      const keySigning = buildKeySigning({});
      const guard = new JwtAuthGuard(
        keySigning,
        silentLogger,
        buildReflector(false),
      );
      const { ctx } = buildContext({ authHeader: 'Basic abc' });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('canon §29.3 — ES256 signature verification', () => {
    it('accepts a token signed with an active key', async () => {
      const { guard, ctx, request } = await buildGuardForClaims(
        {
          sub: 'user:u-1',
          session_id: 'sess-1',
        },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const userCtx = request['user'] as { userId: string };
      expect(userCtx.userId).toBe('u-1');
    });

    it('rejects a token signed with a retired key', async () => {
      const { guard, ctx } = await buildGuardForClaims(
        { sub: 'user:u-1' },
        { keyState: 'retired' },
      );
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token with header.alg != ES256', async () => {
      const kid = 'hwk_2026_05_11_aaaa1111';
      const { privateKey } = await issueTestToken(kid, {});
      // Build a hand-rolled HS-like token to exercise the alg guard.
      // We use jose's SignJWT with ES256, then mutate the header — but
      // simpler: produce a token where the header.alg is none-encoded.
      // The easiest assertion path is decoding our own raw header.
      const fakeHeader = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT', kid }),
      ).toString('base64url');
      const fakePayload = Buffer.from(
        JSON.stringify({ sub: 'user:u-1' }),
      ).toString('base64url');
      const fakeSig = '';
      const token = `${fakeHeader}.${fakePayload}.${fakeSig}`;

      const keySigning = buildKeySigning({});
      const guard = new JwtAuthGuard(
        keySigning,
        silentLogger,
        buildReflector(false),
      );
      const { ctx } = buildContext({ authHeader: `Bearer ${token}` });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // Use private key only to keep tsc happy about the unused symbol.
      void privateKey;
    });

    it('rejects a token with the wrong audience', async () => {
      const kid = 'hwk_2026_05_11_aaaa1111';
      const { token, publicJwk } = await issueTestToken(kid, {
        iss: ISS,
        aud: 'wrong-aud',
        sub: 'user:u-1',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 600,
      });
      const keySigning = buildKeySigning({ [kid]: publicJwk });
      const guard = new JwtAuthGuard(
        keySigning,
        silentLogger,
        buildReflector(false),
      );
      const { ctx } = buildContext({ authHeader: `Bearer ${token}` });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token whose iss does not start with hubblewave-', async () => {
      const { guard, ctx } = await buildGuardForClaims({
        iss: 'evil-issuer-inst-1',
        sub: 'user:u-1',
      });
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'Invalid token issuer',
      });
    });
  });

  describe('canon §29.6 — token_version freshness', () => {
    it('accepts when token_version matches the user current security_stamp', async () => {
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roles: ['user'],
          permissions: [],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp-aaa',
        }),
      };
      const { guard, ctx } = await buildGuardForClaims(
        {
          sub: 'user:u-1',
          token_version: 'stamp-aaa',
        },
        { identity: resolver },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('rejects with "Token version stale" when token_version differs from the live stamp', async () => {
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roles: ['user'],
          permissions: [],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp-NEW',
        }),
      };
      const { guard, ctx } = await buildGuardForClaims(
        {
          sub: 'user:u-1',
          token_version: 'stamp-OLD',
        },
        { identity: resolver },
      );
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'Token version stale',
      });
    });
  });

  describe('F013 — fresh identity via IdentityResolverPort', () => {
    it('uses resolver-port output (not JWT claims) for roles/permissions/isAdmin', async () => {
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roles: ['user'],
          permissions: ['records.read'],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp-aaa',
        }),
      };
      const { guard, ctx, request } = await buildGuardForClaims(
        {
          sub: 'user:u-1',
          roles: ['manager'], // JWT lies — resolver wins
          permissions: ['records.delete'],
          is_admin: true,
          token_version: 'stamp-aaa',
        },
        { identity: resolver },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const userCtx = request['user'] as {
        roles: string[];
        permissions: string[];
        isAdmin: boolean;
      };
      expect(userCtx.roles).toEqual(['user']);
      expect(userCtx.permissions).toEqual(['records.read']);
      expect(userCtx.isAdmin).toBe(false);
    });

    it('rejects when the resolver port returns null', async () => {
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue(null),
      };
      const { guard, ctx } = await buildGuardForClaims(
        { sub: 'user:ghost' },
        { identity: resolver },
      );
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'User not found',
      });
    });

    it('rejects when the resolver port reports non-active status', async () => {
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roles: [],
          permissions: [],
          isAdmin: false,
          status: 'suspended',
          securityStamp: 'stamp',
        }),
      };
      const { guard, ctx } = await buildGuardForClaims(
        { sub: 'user:u-1' },
        { identity: resolver },
      );
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'User is inactive',
      });
    });
  });

  describe('F002 — revocation via JwtRevocationPort', () => {
    it('rejects when the revocation port reports the session as revoked', async () => {
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roles: [],
          permissions: [],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp',
        }),
      };
      const revocation: JwtRevocationPort = {
        isRevoked: jest.fn().mockResolvedValue(true),
      };
      const { guard, ctx } = await buildGuardForClaims(
        {
          sub: 'user:u-1',
          session_id: 'sess-xyz',
          token_version: 'stamp',
        },
        { identity: resolver, revocation },
      );
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'Token revoked',
      });
      expect(revocation.isRevoked).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u-1', sessionId: 'sess-xyz' }),
      );
    });

    it('accepts when the revocation port reports the token as live', async () => {
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roles: [],
          permissions: [],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp',
        }),
      };
      const revocation: JwtRevocationPort = {
        isRevoked: jest.fn().mockResolvedValue(false),
      };
      const { guard, ctx, request } = await buildGuardForClaims(
        {
          sub: 'user:u-1',
          session_id: 'sess-live',
          token_version: 'stamp',
        },
        { identity: resolver, revocation },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect((request['user'] as { sessionId?: string }).sessionId).toBe(
        'sess-live',
      );
    });
  });

  describe('payload sanity', () => {
    it('rejects an empty sub claim', async () => {
      const { guard, ctx } = await buildGuardForClaims({ sub: '' });
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'Invalid token',
      });
    });

    it('handles a bare sub (no "user:" prefix) for backward compat', async () => {
      const { guard, ctx, request } = await buildGuardForClaims({
        sub: 'u-bare',
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const userCtx = request['user'] as { userId: string };
      expect(userCtx.userId).toBe('u-bare');
    });
  });
});
