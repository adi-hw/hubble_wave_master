import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { SsoProvider, User } from '@hubblewave/instance-db';
import { RedisService } from '@hubblewave/redis';

import { OidcService, type OIDCAuthState } from './oidc.service';

// ─────────────────────────────────────────────────────────────────
// openid-client mock surface
//
// The mock exposes:
//   - generators.* (state, nonce, codeVerifier, codeChallenge) — deterministic
//   - Issuer.prototype.Client — returns a controllable client instance
//
// Per-test overrides drive client.callback(), client.refresh(), and
// client.userinfo() to simulate IdP responses, including the four reject
// paths (nonce mismatch, signature failure, wrong iss, wrong aud, expired).
// ─────────────────────────────────────────────────────────────────

jest.mock('openid-client', () => {
  // Hoisted factory: build a sticky mock surface inside the factory and re-
  // export it on `module.exports` so tests can grab it via `getMocks()` below.
  const clientImpl: {
    authorizationUrl: jest.Mock;
    callback: jest.Mock;
    refresh: jest.Mock;
    userinfo: jest.Mock;
  } = {
    authorizationUrl: jest.fn(),
    callback: jest.fn(),
    refresh: jest.fn(),
    userinfo: jest.fn(),
  };

  class MockIssuer {
    Client: jest.Mock;
    metadata: Record<string, unknown>;
    constructor(metadata: Record<string, unknown>) {
      this.metadata = metadata;
      this.Client = jest.fn().mockImplementation(() => clientImpl);
    }
  }

  const generators = {
    state: jest.fn(() => 'state-fixed'),
    nonce: jest.fn(() => 'nonce-fixed'),
    codeVerifier: jest.fn(() => 'verifier-fixed'),
    codeChallenge: jest.fn((v: string) => `challenge-of-${v}`),
  };

  return {
    Issuer: jest.fn().mockImplementation((metadata: Record<string, unknown>) => new MockIssuer(metadata)),
    generators,
    __mockClientImpl: clientImpl,
    __mockGenerators: generators,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const oidcClientMock = require('openid-client');
const mockClientImpl: {
  authorizationUrl: jest.Mock;
  callback: jest.Mock;
  refresh: jest.Mock;
  userinfo: jest.Mock;
} = oidcClientMock.__mockClientImpl;

// ─────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────

const PROVIDER_ID = 'provider-uuid';
const CLIENT_ID = 'client-id-xyz';
const ISSUER = 'https://idp.example.com';

function buildProvider(overrides: Partial<SsoProvider> = {}): SsoProvider {
  return {
    id: PROVIDER_ID,
    name: 'Test IdP',
    slug: 'test-idp',
    type: 'oidc',
    issuer: ISSUER,
    clientId: CLIENT_ID,
    clientSecret: 'client-secret',
    authorizationUrl: `${ISSUER}/authorize`,
    tokenUrl: `${ISSUER}/token`,
    userInfoUrl: `${ISSUER}/userinfo`,
    jwksUrl: `${ISSUER}/.well-known/jwks.json`,
    scopes: 'openid profile email',
    jitEnabled: true,
    jitUpdateProfile: true,
    allowedDomains: undefined,
    enabled: true,
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SsoProvider;
}

function buildClaims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: ISSUER,
    aud: CLIENT_ID,
    sub: 'subject-1',
    nonce: 'nonce-fixed',
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
}

function buildTokenSet(overrides: Record<string, unknown> = {}) {
  const claims = (overrides.claims as Record<string, unknown> | undefined) ?? buildClaims();
  return {
    access_token: 'access-token-1',
    id_token: 'id-token-1',
    token_type: 'Bearer',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    claims: () => claims,
    ...overrides,
  };
}

function buildAuthState(overrides: Partial<OIDCAuthState> = {}): OIDCAuthState {
  return {
    providerId: PROVIDER_ID,
    nonce: 'nonce-fixed',
    codeVerifier: 'verifier-fixed',
    redirectUri: 'http://localhost/callback',
    state: 'state-fixed',
    ...overrides,
  };
}

const REDIRECT_URI = 'http://localhost/callback';

// ─────────────────────────────────────────────────────────────────

describe('OidcService', () => {
  let service: OidcService;
  let ssoProviderRepo: { findOne: jest.Mock };
  let userRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let redis: {
    setJson: jest.Mock;
    getJson: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    ssoProviderRepo = {
      findOne: jest.fn(),
    };

    userRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((u) => u),
      save: jest.fn().mockImplementation(async (u) => ({ id: 'new-user-id', ...u })),
      update: jest.fn().mockResolvedValue(undefined),
    };

    redis = {
      setJson: jest.fn().mockResolvedValue(true),
      getJson: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(true),
    };

    mockClientImpl.authorizationUrl.mockReturnValue(
      `${ISSUER}/authorize?client_id=${CLIENT_ID}&code_challenge=challenge-of-verifier-fixed&code_challenge_method=S256&state=state-fixed&nonce=nonce-fixed`,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OidcService,
        { provide: getRepositoryToken(SsoProvider), useValue: ssoProviderRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<OidcService>(OidcService);
  });

  // ─────────────────────────────────────────────────────────────────
  // F007 — PKCE
  // ─────────────────────────────────────────────────────────────────

  describe('F007: PKCE (Proof Key for Code Exchange)', () => {
    it('authorize redirect includes code_challenge and code_challenge_method=S256', async () => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider());

      await service.getAuthorizationUrl('test-idp', REDIRECT_URI);

      expect(mockClientImpl.authorizationUrl).toHaveBeenCalledTimes(1);
      const args = mockClientImpl.authorizationUrl.mock.calls[0][0];
      expect(args.code_challenge).toBe('challenge-of-verifier-fixed');
      expect(args.code_challenge_method).toBe('S256');
    });

    it('stored auth state contains code_verifier', async () => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider());

      await service.getAuthorizationUrl('test-idp', REDIRECT_URI);

      expect(redis.setJson).toHaveBeenCalledTimes(1);
      const [_key, payload] = redis.setJson.mock.calls[0];
      expect(payload).toMatchObject({
        codeVerifier: 'verifier-fixed',
        nonce: 'nonce-fixed',
        state: 'state-fixed',
        redirectUri: REDIRECT_URI,
        providerId: PROVIDER_ID,
      });
    });

    it('callback passes code_verifier matching the stored state to the token exchange', async () => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider());
      redis.getJson.mockResolvedValue(buildAuthState());
      mockClientImpl.callback.mockResolvedValue(buildTokenSet());
      mockClientImpl.userinfo.mockResolvedValue({
        sub: 'subject-1',
        email: 'user@example.com',
        email_verified: true,
      });
      userRepo.findOne.mockResolvedValue(null);

      await service.handleCallback('test-idp', 'auth-code-1', 'state-fixed', REDIRECT_URI);

      expect(mockClientImpl.callback).toHaveBeenCalledTimes(1);
      const [_redirectUri, _params, checks] = mockClientImpl.callback.mock.calls[0];
      expect(checks).toMatchObject({
        state: 'state-fixed',
        nonce: 'nonce-fixed',
        code_verifier: 'verifier-fixed',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // F008 — nonce + id_token signature + iss / aud / exp
  // ─────────────────────────────────────────────────────────────────

  describe('F008: id_token claim verification', () => {
    beforeEach(() => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider());
      redis.getJson.mockResolvedValue(buildAuthState());
      mockClientImpl.userinfo.mockResolvedValue({
        sub: 'subject-1',
        email: 'user@example.com',
        email_verified: true,
      });
      userRepo.findOne.mockResolvedValue(null);
    });

    it('rejects when id_token nonce does not match the stored nonce', async () => {
      mockClientImpl.callback.mockResolvedValue(
        buildTokenSet({ claims: () => buildClaims({ nonce: 'attacker-nonce' }) }),
      );

      await expect(
        service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when openid-client reports an invalid signature (JWKS mismatch)', async () => {
      // openid-client.callback() throws when the id_token signature does not
      // match the JWKS-fetched key. We simulate that here.
      mockClientImpl.callback.mockRejectedValue(new Error('JWT signature verification failed'));

      await expect(
        service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when id_token iss does not match the provider issuer', async () => {
      mockClientImpl.callback.mockResolvedValue(
        buildTokenSet({ claims: () => buildClaims({ iss: 'https://attacker.example.com' }) }),
      );

      await expect(
        service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when id_token aud does not include this client_id', async () => {
      mockClientImpl.callback.mockResolvedValue(
        buildTokenSet({ claims: () => buildClaims({ aud: 'some-other-client' }) }),
      );

      await expect(
        service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired id_token (exp before now beyond clock tolerance)', async () => {
      const expiredAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago, > 5 minute tolerance
      mockClientImpl.callback.mockResolvedValue(
        buildTokenSet({ claims: () => buildClaims({ exp: expiredAt, iat: expiredAt - 60 }) }),
      );

      await expect(
        service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // F009 — Redis-backed auth state
  // ─────────────────────────────────────────────────────────────────

  describe('F009: Redis-backed auth state', () => {
    it('authorize persists state to Redis with a 10-minute TTL', async () => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider());

      await service.getAuthorizationUrl('test-idp', REDIRECT_URI);

      expect(redis.setJson).toHaveBeenCalledTimes(1);
      const [key, _payload, ttl] = redis.setJson.mock.calls[0];
      expect(key).toBe('oidc:auth-state:state-fixed');
      expect(ttl).toBe(600);
    });

    it('callback reads state from Redis using the namespaced key', async () => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider());
      redis.getJson.mockResolvedValue(buildAuthState());
      mockClientImpl.callback.mockResolvedValue(buildTokenSet());
      mockClientImpl.userinfo.mockResolvedValue({
        sub: 'subject-1',
        email: 'user@example.com',
        email_verified: true,
      });
      userRepo.findOne.mockResolvedValue(null);

      await service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI);

      expect(redis.getJson).toHaveBeenCalledWith('oidc:auth-state:state-fixed');
    });

    it('callback deletes the state from Redis (single-use)', async () => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider());
      redis.getJson.mockResolvedValue(buildAuthState());
      mockClientImpl.callback.mockResolvedValue(buildTokenSet());
      mockClientImpl.userinfo.mockResolvedValue({
        sub: 'subject-1',
        email: 'user@example.com',
        email_verified: true,
      });
      userRepo.findOne.mockResolvedValue(null);

      await service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI);

      expect(redis.del).toHaveBeenCalledWith('oidc:auth-state:state-fixed');
    });

    it('callback rejects when state is missing or expired in Redis', async () => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider());
      redis.getJson.mockResolvedValue(null);

      await expect(
        service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI),
      ).rejects.toThrow(UnauthorizedException);
      // Even on a missing state we still attempt to clean up the key — single-use guard.
      expect(redis.del).toHaveBeenCalledWith('oidc:auth-state:state-fixed');
    });

    it('callback rejects when stored state does not bind to the requested provider', async () => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider({ id: 'different-provider' }));
      redis.getJson.mockResolvedValue(buildAuthState());

      await expect(
        service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // F010 — email_verified handling
  // ─────────────────────────────────────────────────────────────────

  describe('F010: email_verified defaults to false (strict rejection)', () => {
    beforeEach(() => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider());
      redis.getJson.mockResolvedValue(buildAuthState());
      mockClientImpl.callback.mockResolvedValue(buildTokenSet());
      userRepo.findOne.mockResolvedValue(null);
    });

    it('accepts the login when email_verified === true', async () => {
      mockClientImpl.userinfo.mockResolvedValue({
        sub: 'subject-1',
        email: 'user@example.com',
        email_verified: true,
      });

      const result = await service.handleCallback(
        'test-idp',
        'code',
        'state-fixed',
        REDIRECT_URI,
      );
      expect(result.user.email).toBe('user@example.com');
      expect(result.isNewUser).toBe(true);
    });

    it('rejects the login when email_verified is false', async () => {
      mockClientImpl.userinfo.mockResolvedValue({
        sub: 'subject-1',
        email: 'user@example.com',
        email_verified: false,
      });

      await expect(
        service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects the login when email_verified is missing (strict default)', async () => {
      mockClientImpl.userinfo.mockResolvedValue({
        sub: 'subject-1',
        email: 'user@example.com',
        // no email_verified field
      });

      await expect(
        service.handleCallback('test-idp', 'code', 'state-fixed', REDIRECT_URI),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Defensive metadata checks
  // ─────────────────────────────────────────────────────────────────

  describe('provider metadata validation', () => {
    it('refuses to issue an authorize URL when the JWKS URL is missing', async () => {
      ssoProviderRepo.findOne.mockResolvedValue(buildProvider({ jwksUrl: undefined }));

      await expect(
        service.getAuthorizationUrl('test-idp', REDIRECT_URI),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
