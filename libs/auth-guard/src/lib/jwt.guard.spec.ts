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
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roleIds: [],
          roleCodes: [],
          permissionCodes: [],
          groupIds: [],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp-1',
        }),
      };
      const { guard, ctx, request } = await buildGuardForClaims(
        {
          sub: 'user:u-1',
          session_id: 'sess-1',
          token_version: 'stamp-1',
        },
        { identity: resolver },
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
          roleIds: ['role-1'],
          roleCodes: ['user'],
          permissionCodes: [],
          groupIds: [],
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
          roleIds: ['role-1'],
          roleCodes: ['user'],
          permissionCodes: [],
          groupIds: [],
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
    it('uses resolver-port output (not JWT claims) for roleCodes/permissionCodes/isAdmin', async () => {
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roleIds: ['role-1'],
          roleCodes: ['user'],
          permissionCodes: ['records.read'],
          groupIds: [],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp-aaa',
        }),
      };
      // W2 Stream 1 PR1 — the JWT no longer carries roles/permissions/is_admin,
      // so the "JWT lies" scenario the pre-Stream-1 test covered is moot at
      // the contract level. We keep the spirit of the assertion (resolver
      // output reaches request.user / request.context) without injecting
      // claims the guard now ignores.
      const { guard, ctx, request } = await buildGuardForClaims(
        {
          sub: 'user:u-1',
          token_version: 'stamp-aaa',
        },
        { identity: resolver },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const userCtx = request['user'] as {
        roleIds: string[];
        roleCodes: string[];
        permissionCodes: string[];
        isAdmin: boolean;
      };
      expect(userCtx.roleIds).toEqual(['role-1']);
      expect(userCtx.roleCodes).toEqual(['user']);
      expect(userCtx.permissionCodes).toEqual(['records.read']);
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
          roleIds: [],
          roleCodes: [],
          permissionCodes: [],
          groupIds: [],
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
          roleIds: [],
          roleCodes: [],
          permissionCodes: [],
          groupIds: [],
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
          roleIds: [],
          roleCodes: [],
          permissionCodes: [],
          groupIds: [],
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
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-bare',
          roleIds: [],
          roleCodes: [],
          permissionCodes: [],
          groupIds: [],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp-bare',
        }),
      };
      const { guard, ctx, request } = await buildGuardForClaims(
        { sub: 'u-bare', token_version: 'stamp-bare' },
        { identity: resolver },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const userCtx = request['user'] as { userId: string };
      expect(userCtx.userId).toBe('u-bare');
    });
  });

  describe('W6.D / F047 — groupCache seeding on UserRequestContext', () => {
    it('seeds groupCache from the resolver identity.groupIds', async () => {
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roleIds: ['role-1'],
          roleCodes: ['user'],
          permissionCodes: [],
          groupIds: ['grp-x', 'grp-y'],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp-gc',
        }),
      };
      const { guard, ctx, request } = await buildGuardForClaims(
        { sub: 'user:u-1', token_version: 'stamp-gc' },
        { identity: resolver },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const userCtx = request['context'] as {
        groupCache?: Map<string, string[]>;
        userId: string;
      };
      expect(userCtx.groupCache).toBeDefined();
      expect(userCtx.groupCache!.get('u-1')).toEqual(['grp-x', 'grp-y']);
    });

    it('seeds an empty groupCache entry when resolver returns an empty groupIds array', async () => {
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-2',
          roleIds: ['role-1'],
          roleCodes: ['user'],
          permissionCodes: [],
          groupIds: [],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp-empty',
        }),
      };
      const { guard, ctx, request } = await buildGuardForClaims(
        { sub: 'user:u-2', token_version: 'stamp-empty' },
        { identity: resolver },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const userCtx = request['context'] as {
        groupCache?: Map<string, string[]>;
      };
      expect(userCtx.groupCache).toBeDefined();
      expect(userCtx.groupCache!.get('u-2')).toEqual([]);
    });

    // W2 Stream 1 PR1: the pre-Stream-1 fallback that built an empty
    // UserRequestContext when no `IdentityResolverPort` was wired is
    // retired. The guard now fails closed on missing resolver, so the
    // "no resolver → 401" path is asserted as its own test below.
    it('fails closed with 401 when no IdentityResolverPort is wired', async () => {
      const { guard, ctx } = await buildGuardForClaims({
        sub: 'user:u-no-resolver',
      });
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: expect.stringMatching(/IDENTITY_RESOLVER_PORT/),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // Service-token branch (canon §29.7 PR-D)
  // ───────────────────────────────────────────────────────────────────

  describe('service tokens (canon §29.7)', () => {
    const KID = 'hwk_2026_05_11_svc11111';
    const SERVICE_AUDIENCE = 'svc-api';

    async function buildGuardForServiceClaims(
      claims: Record<string, unknown>,
      options: {
        allowServiceToken?: boolean;
        identity?: IdentityResolverPort;
        revocation?: JwtRevocationPort;
        // Canon §29.7 — every opted-in endpoint MUST declare its required
        // scope. Helper defaults to a known-good value so existing tests
        // exercise the green path; tests that target the missing-decorator
        // or scope-mismatch branches set this explicitly.
        requireServiceScope?: string | undefined;
      } = {},
    ) {
      const { token, publicJwk } = await issueTestToken(KID, {
        iss: ISS,
        aud: SERVICE_AUDIENCE,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
        instance_id: 'inst-1',
        ...claims,
      });
      const jwks: Record<string, PublicJwk> = { [KID]: publicJwk };
      const keySigning = buildKeySigning(jwks);

      const requireScope =
        'requireServiceScope' in options
          ? options.requireServiceScope
          : 'work_order:read';

      const reflector = new Reflector();
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: unknown) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === 'ALLOW_SERVICE_TOKEN')
            return options.allowServiceToken === true;
          if (key === 'REQUIRE_SERVICE_SCOPE') return requireScope;
          return undefined;
        });

      const guard = new JwtAuthGuard(
        keySigning,
        silentLogger,
        reflector,
        options.identity,
        options.revocation,
      );
      const { ctx, request } = buildContext({
        authHeader: `Bearer ${token}`,
      });
      return { guard, ctx, request, keySigning, token };
    }

    beforeEach(() => {
      process.env['SERVICE_AUDIENCE'] = SERVICE_AUDIENCE;
    });

    it('populates a ServiceRequestContext when @AllowServiceToken() is set', async () => {
      const { guard, ctx, request } = await buildGuardForServiceClaims(
        {
          sub: 'service:svc-worker',
          scope: ['work_order:read', 'audit:write'],
        },
        { allowServiceToken: true },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const serviceCtx = request['context'] as {
        kind: string;
        serviceId: string;
        audience: string;
        scopes: string[];
        instanceId: string;
        bearerToken: string;
      };
      expect(serviceCtx.kind).toBe('service');
      expect(serviceCtx.serviceId).toBe('svc-worker');
      expect(serviceCtx.audience).toBe(SERVICE_AUDIENCE);
      expect(serviceCtx.scopes).toEqual(['work_order:read', 'audit:write']);
      expect(serviceCtx.instanceId).toBe('inst-1');
      expect(typeof serviceCtx.bearerToken).toBe('string');
    });

    it('rejects a service token at a non-opted-in endpoint (default-deny)', async () => {
      const { guard, ctx } = await buildGuardForServiceClaims(
        {
          sub: 'service:svc-worker',
          scope: ['work_order:read'],
        },
        { allowServiceToken: false },
      );
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        /Service tokens are not accepted at this endpoint/,
      );
    });

    it('rejects a service token whose aud does not match SERVICE_AUDIENCE', async () => {
      const { guard, ctx } = await buildGuardForServiceClaims(
        {
          sub: 'service:svc-worker',
          aud: 'svc-attacker',
          scope: ['work_order:read'],
        },
        { allowServiceToken: true },
      );
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        /audience mismatch/,
      );
    });

    it('does NOT consult the IdentityResolverPort for service tokens', async () => {
      const identity = {
        resolveIdentity: jest.fn(),
      } as unknown as IdentityResolverPort;
      const { guard, ctx } = await buildGuardForServiceClaims(
        {
          sub: 'service:svc-worker',
          scope: ['work_order:read'],
        },
        { allowServiceToken: true, identity },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(identity.resolveIdentity).not.toHaveBeenCalled();
    });

    it('does NOT consult the JwtRevocationPort for service tokens', async () => {
      const revocation = {
        isRevoked: jest.fn().mockResolvedValue(false),
        revokeSession: jest.fn(),
        revokeAllUserTokens: jest.fn(),
      } as unknown as JwtRevocationPort;
      const { guard, ctx } = await buildGuardForServiceClaims(
        {
          sub: 'service:svc-worker',
          scope: ['work_order:read'],
        },
        { allowServiceToken: true, revocation },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(revocation.isRevoked).not.toHaveBeenCalled();
    });

    it('rejects with 500 when @AllowServiceToken is set but @RequireServiceScope is missing', async () => {
      // Canon §29.7 — programmer error surfaced as InternalServerError so
      // the misconfiguration is loud in dev/test before it ships.
      const { guard, ctx } = await buildGuardForServiceClaims(
        {
          sub: 'service:svc-worker',
          scope: ['work_order:read'],
        },
        { allowServiceToken: true, requireServiceScope: undefined },
      );
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        /@AllowServiceToken\(\) requires a matching @RequireServiceScope/,
      );
    });

    it('rejects with 403 PERMISSION_DENIED when the required scope is not in the token', async () => {
      const { guard, ctx } = await buildGuardForServiceClaims(
        {
          sub: 'service:svc-worker',
          // Token presents a different scope than the endpoint requires.
          scope: ['audit:write'],
        },
        { allowServiceToken: true, requireServiceScope: 'work_order:read' },
      );
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: 403,
        response: {
          statusCode: 403,
          message: 'Permission denied',
          code: 'PERMISSION_DENIED',
        },
      });
    });

    it('admits a service token whose scope[] contains the required scope', async () => {
      const { guard, ctx, request } = await buildGuardForServiceClaims(
        {
          sub: 'service:svc-worker',
          scope: ['work_order:read', 'audit:write'],
        },
        { allowServiceToken: true, requireServiceScope: 'work_order:read' },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const serviceCtx = request['context'] as {
        kind: string;
        scopes: string[];
      };
      expect(serviceCtx.kind).toBe('service');
      expect(serviceCtx.scopes).toContain('work_order:read');
    });

    it('a USER token at an @AllowServiceToken endpoint still goes through the user path', async () => {
      const identity = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roleIds: ['role-1'],
          roleCodes: ['member'],
          permissionCodes: [],
          groupIds: [],
          isAdmin: false,
          status: 'active',
          securityStamp: 'stamp-1',
        }),
      } as unknown as IdentityResolverPort;
      // Re-issue a user-token shape against the user audience.
      const { token, publicJwk } = await issueTestToken(KID, {
        iss: ISS,
        aud: 'hubblewave-instance',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 600,
        instance_id: 'inst-1',
        sub: 'user:u-1',
        token_version: 'stamp-1',
      });
      const reflector = new Reflector();
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: unknown) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === 'ALLOW_SERVICE_TOKEN') return true;
          if (key === 'REQUIRE_SERVICE_SCOPE') return 'work_order:read';
          return undefined;
        });
      const guard = new JwtAuthGuard(
        buildKeySigning({ [KID]: publicJwk }),
        silentLogger,
        reflector,
        identity,
      );
      const { ctx, request } = buildContext({
        authHeader: `Bearer ${token}`,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const userCtx = request['context'] as { kind: string; userId: string };
      expect(userCtx.kind).toBe('user');
      expect(userCtx.userId).toBe('u-1');
    });
  });
});
