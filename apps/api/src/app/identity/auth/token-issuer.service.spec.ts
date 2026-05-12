import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import {
  generateKeyPairSync,
  KeyObject,
  createPublicKey,
} from 'crypto';
import {
  decodeProtectedHeader,
  decodeJwt,
  exportJWK,
  importJWK,
  type JWK,
  jwtVerify,
  SignJWT,
} from 'jose';
import {
  IdentityResolverPort,
  KeySigningService,
  PublicJwk,
  ResolvedIdentity,
} from '@hubblewave/auth-guard';
import { TokenIssuerService } from './token-issuer.service';

/**
 * `TokenIssuerService` spec — canon §29.3 (claims contract), §29.4 (TTL
 * bounds), §29.6 (`security_stamp` → `token_version`), §29.9 (ES256
 * symmetric dev/prod signing).
 *
 * The test signer mirrors `LocalEs256KeySigningService` but in-memory:
 * we mint a P-256 keypair, hand the public component out via
 * `getPublicJwk`, and sign via jose's `SignJWT`. This keeps the spec
 * lightweight while still exercising the full ES256 round-trip every
 * issued token must support.
 */

const TEST_INSTANCE_ID = 'inst-test-1234';

/**
 * Synthetic identity used by every issuance test. The `securityStamp`
 * value is what we expect to land in the JWT's `token_version` claim.
 */
function buildIdentity(overrides: Partial<ResolvedIdentity> = {}): ResolvedIdentity {
  return {
    userId: 'user-1',
    roles: ['user'],
    permissions: ['records.read'],
    isAdmin: false,
    status: 'active',
    securityStamp: 'stamp-aaa-111',
    ...overrides,
  };
}

interface MockKeySigner {
  service: KeySigningService;
  privateKey: KeyObject;
  publicJwk: PublicJwk;
  kid: string;
}

async function buildKeySigner(kid = 'hwk_2026_05_11_deadbeef'): Promise<MockKeySigner> {
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
  const service: KeySigningService = {
    sign: async (payload, header) => {
      const jws = await new SignJWT(payload)
        .setProtectedHeader({
          alg: 'ES256',
          typ: header?.typ ?? 'JWT',
          kid,
        })
        .sign(privateKey);
      return jws;
    },
    getPublicJwk: async () => publicJwk,
    rotateKey: jest.fn(),
    getActiveKey: async () => ({
      kid,
      provider: 'local-es256',
      kmsAlias: null,
      kmsArn: null,
      algorithm: 'ES256',
      state: 'active',
      publicKeyPem: '',
      instanceId: null,
      createdAt: new Date(),
      activatedAt: new Date(),
      retiringAt: null,
      retiredAt: null,
      compromisedAt: null,
    }),
    getVerifyingKeys: async () => [],
  };
  return { service, privateKey, publicJwk, kid };
}

function buildIdentityResolver(
  result: ResolvedIdentity | null,
): IdentityResolverPort {
  return {
    resolveIdentity: jest.fn().mockResolvedValue(result),
  };
}

function buildConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    INSTANCE_ID: TEST_INSTANCE_ID,
    JWT_AUDIENCE: 'hubblewave-instance',
    JWT_ACCESS_TTL_SECONDS: 600,
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('TokenIssuerService', () => {
  describe('TTL bounds (canon §29.4)', () => {
    it('boots with the default 600s TTL when JWT_ACCESS_TTL_SECONDS is unset', async () => {
      const { service: keySigning } = await buildKeySigner();
      const resolver = buildIdentityResolver(buildIdentity());
      const config = buildConfig({ JWT_ACCESS_TTL_SECONDS: undefined });
      const svc = new TokenIssuerService(keySigning, resolver, config);
      svc.onModuleInit();
      expect(svc.getAccessTokenTtlSeconds()).toBe(600);
    });

    it('throws at startup when JWT_ACCESS_TTL_SECONDS is below 300', async () => {
      const { service: keySigning } = await buildKeySigner();
      const resolver = buildIdentityResolver(buildIdentity());
      const config = buildConfig({ JWT_ACCESS_TTL_SECONDS: 60 });
      const svc = new TokenIssuerService(keySigning, resolver, config);
      expect(() => svc.onModuleInit()).toThrow(/JWT_ACCESS_TTL_SECONDS/);
      expect(() => svc.onModuleInit()).toThrow(/\[300, 900\]/);
    });

    it('throws at startup when JWT_ACCESS_TTL_SECONDS is above 900', async () => {
      const { service: keySigning } = await buildKeySigner();
      const resolver = buildIdentityResolver(buildIdentity());
      const config = buildConfig({ JWT_ACCESS_TTL_SECONDS: 3600 });
      const svc = new TokenIssuerService(keySigning, resolver, config);
      expect(() => svc.onModuleInit()).toThrow(/\[300, 900\]/);
    });

    it('throws at startup when JWT_ACCESS_TTL_SECONDS is not an integer', async () => {
      const { service: keySigning } = await buildKeySigner();
      const resolver = buildIdentityResolver(buildIdentity());
      const config = buildConfig({ JWT_ACCESS_TTL_SECONDS: 'not-a-number' });
      const svc = new TokenIssuerService(keySigning, resolver, config);
      expect(() => svc.onModuleInit()).toThrow(/integer/);
    });

    it('accepts boundary values 300 and 900', async () => {
      const { service: keySigning } = await buildKeySigner();
      const resolver = buildIdentityResolver(buildIdentity());
      const svcMin = new TokenIssuerService(
        keySigning,
        resolver,
        buildConfig({ JWT_ACCESS_TTL_SECONDS: 300 }),
      );
      svcMin.onModuleInit();
      expect(svcMin.getAccessTokenTtlSeconds()).toBe(300);

      const svcMax = new TokenIssuerService(
        keySigning,
        resolver,
        buildConfig({ JWT_ACCESS_TTL_SECONDS: 900 }),
      );
      svcMax.onModuleInit();
      expect(svcMax.getAccessTokenTtlSeconds()).toBe(900);
    });
  });

  describe('canonical claims (canon §29.3)', () => {
    let svc: TokenIssuerService;
    let signer: MockKeySigner;
    const identity = buildIdentity();

    beforeEach(async () => {
      signer = await buildKeySigner();
      svc = new TokenIssuerService(
        signer.service,
        buildIdentityResolver(identity),
        buildConfig(),
      );
      svc.onModuleInit();
    });

    it('issues a JWT with all required §29.3 claims', async () => {
      const { token } = await svc.issueAccessToken({
        userId: 'user-1',
        sessionId: 'sess-9',
      });

      const decoded = decodeJwt(token);
      expect(decoded.iss).toBe(`hubblewave-${TEST_INSTANCE_ID}`);
      expect(decoded.aud).toBe('hubblewave-instance');
      expect(decoded.sub).toBe('user:user-1');
      expect(typeof decoded.iat).toBe('number');
      expect(typeof decoded.exp).toBe('number');
      expect((decoded.exp as number) - (decoded.iat as number)).toBe(600);
      expect((decoded as Record<string, unknown>)['instance_id']).toBe(
        TEST_INSTANCE_ID,
      );
      expect((decoded as Record<string, unknown>)['session_id']).toBe('sess-9');
      expect((decoded as Record<string, unknown>)['token_version']).toBe(
        identity.securityStamp,
      );
    });

    it('embeds the user current security_stamp as token_version', async () => {
      const stamp = 'stamp-fresh-7';
      const customResolver = buildIdentityResolver(
        buildIdentity({ securityStamp: stamp }),
      );
      const customSvc = new TokenIssuerService(
        signer.service,
        customResolver,
        buildConfig(),
      );
      customSvc.onModuleInit();
      const { token } = await customSvc.issueAccessToken({
        userId: 'user-1',
        sessionId: 'sess-9',
      });
      const decoded = decodeJwt(token);
      expect((decoded as Record<string, unknown>)['token_version']).toBe(stamp);
    });

    it('sets the JWT header to alg=ES256 with the active kid', async () => {
      const { token } = await svc.issueAccessToken({
        userId: 'user-1',
        sessionId: 'sess-9',
      });
      const header = decodeProtectedHeader(token);
      expect(header.alg).toBe('ES256');
      expect(header.kid).toBe(signer.kid);
      expect(header.typ).toBe('JWT');
    });

    it('round-trips verification with the active public JWK', async () => {
      const { token } = await svc.issueAccessToken({
        userId: 'user-1',
        sessionId: 'sess-9',
      });
      const publicKey = await importJWK(
        signer.publicJwk as unknown as JWK,
        'ES256',
      );
      const verified = await jwtVerify(token, publicKey, {
        audience: 'hubblewave-instance',
        algorithms: ['ES256'],
      });
      expect(verified.payload.sub).toBe('user:user-1');
      expect(verified.payload.iss).toBe(`hubblewave-${TEST_INSTANCE_ID}`);
    });

    it('exposes expiresIn equal to the configured TTL', async () => {
      const { expiresIn } = await svc.issueAccessToken({
        userId: 'user-1',
        sessionId: 'sess-9',
      });
      expect(expiresIn).toBe(600);
    });
  });

  describe('identity resolution errors', () => {
    it('throws UnauthorizedException when the resolver returns null', async () => {
      const { service: keySigning } = await buildKeySigner();
      const svc = new TokenIssuerService(
        keySigning,
        buildIdentityResolver(null),
        buildConfig(),
      );
      svc.onModuleInit();
      await expect(
        svc.issueAccessToken({ userId: 'ghost', sessionId: 'sess' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user is not active', async () => {
      const { service: keySigning } = await buildKeySigner();
      const svc = new TokenIssuerService(
        keySigning,
        buildIdentityResolver(buildIdentity({ status: 'suspended' })),
        buildConfig(),
      );
      svc.onModuleInit();
      await expect(
        svc.issueAccessToken({ userId: 'user-1', sessionId: 'sess' }),
      ).rejects.toThrow(/inactive/i);
    });
  });

  describe('generateSessionId', () => {
    it('returns a fresh uuid each call', async () => {
      const { service: keySigning } = await buildKeySigner();
      const svc = new TokenIssuerService(
        keySigning,
        buildIdentityResolver(buildIdentity()),
        buildConfig(),
      );
      svc.onModuleInit();
      const a = svc.generateSessionId();
      const b = svc.generateSessionId();
      expect(a).not.toBe(b);
      expect(a).toMatch(/[0-9a-f-]{36}/);
    });
  });
});

// `createPublicKey` import kept so the file's behavior matches the
// production signer's posture (private → public derivation), even though
// the mock signer in this spec uses `exportJWK(publicKey)` directly.
// Referenced here so the unused-import lint does not flag the symbol.
void createPublicKey;
