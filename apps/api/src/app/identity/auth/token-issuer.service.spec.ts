import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import {
  generateKeyPairSync,
  KeyObject,
  createPublicKey,
  createHash,
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
import type { AccessAuditPort } from '@hubblewave/auth-guard';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import {
  TokenIssuerService,
  generateRefreshToken,
  hashToken,
} from './token-issuer.service';
import { JwtRevocationAdapter } from './jwt-revocation.adapter';
import { RefreshToken, ServicePrincipal } from '@hubblewave/instance-db';

/**
 * `TokenIssuerService` spec — canon §29.3 (claims contract), §29.4 (TTL
 * bounds), §29.5 (refresh-token family + rotation + reuse detection),
 * §29.6 (`security_stamp` → `token_version`), §29.9 (ES256 symmetric
 * dev/prod signing).
 */

const TEST_INSTANCE_ID = 'inst-test-1234';

function buildIdentity(overrides: Partial<ResolvedIdentity> = {}): ResolvedIdentity {
  return {
    userId: 'user-1',
    roleIds: ['role-id-user'],
    roleCodes: ['user'],
    permissionCodes: ['records.read'],
    groupIds: [],
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
    JWT_REFRESH_TTL_DAYS: 14,
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

/**
 * In-memory simulation of the refresh_tokens table. The repository
 * surface is rich enough for the production code path:
 *   - insert(...)
 *   - update(criteria, updates)
 *   - createQueryBuilder() with where()/setLock()/getOne()
 *   - createQueryBuilder().delete()...where().execute()
 *
 * The data source's transaction() callback is invoked synchronously and
 * given a manager whose `.getRepository(...)` returns the same in-memory
 * repo so transactional updates are visible across calls in the same
 * transaction.
 */
function buildRefreshTokenRepoMock() {
  const rows: RefreshToken[] = [];

  const repo = {
    rows,
    insert: jest.fn(async (input: Partial<RefreshToken>) => {
      rows.push({ ...input } as RefreshToken);
      return { identifiers: [{ tokenHash: input.tokenHash }] };
    }),
    update: jest.fn(async (criteria: any, updates: any) => {
      let affected = 0;
      for (const row of rows) {
        if (matchesCriteria(row, criteria)) {
          Object.assign(row, updates);
          affected++;
        }
      }
      return { affected };
    }),
    createQueryBuilder: jest.fn(() => {
      let whereHash: string | null = null;
      let pendingDeleteCutoff: Date | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {};
      builder.where = jest.fn((clause: string, params: Record<string, unknown>) => {
        if (clause.includes('token_hash')) {
          whereHash = params.hash as string;
        }
        if (clause.includes('expires_at')) {
          pendingDeleteCutoff = params.cutoff as Date;
        }
        return builder;
      });
      builder.setLock = jest.fn(() => builder);
      builder.getOne = jest.fn(async () => {
        if (whereHash !== null) {
          return rows.find((r) => r.tokenHash === whereHash) ?? null;
        }
        return null;
      });
      builder.delete = jest.fn(() => builder);
      builder.from = jest.fn(() => builder);
      builder.execute = jest.fn(async () => {
        if (pendingDeleteCutoff !== null) {
          const before = rows.length;
          for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i].expiresAt < (pendingDeleteCutoff as Date)) {
              rows.splice(i, 1);
            }
          }
          return { affected: before - rows.length };
        }
        return { affected: 0 };
      });
      return builder;
    }),
  };

  return repo;
}

function matchesCriteria(row: RefreshToken, criteria: any): boolean {
  if (!criteria || typeof criteria !== 'object') return true;
  for (const [key, value] of Object.entries(criteria)) {
    const rowValue = (row as any)[key];
    if (value && typeof value === 'object' && '_type' in value) {
      // typeorm IsNull() marker
      if ((value as any)._type === 'isNull') {
        if (rowValue !== null && rowValue !== undefined) return false;
        continue;
      }
    }
    // Sentinel IsNull match — TypeORM's IsNull() exports an object whose
    // serialization shape is internal. We treat any "expects null" via
    // a duck-typed check.
    if (
      value !== null &&
      typeof value === 'object' &&
      value.constructor?.name === 'FindOperator' &&
      (value as any)._type === 'isNull'
    ) {
      if (rowValue !== null && rowValue !== undefined) return false;
      continue;
    }
    if (rowValue !== value) {
      // Special case: TypeORM IsNull() comparisons. Mock with `null` to
      // match by writing `revokedAt: null` literally in the criteria.
      if (value === null && (rowValue === null || rowValue === undefined)) {
        continue;
      }
      return false;
    }
  }
  return true;
}

function buildDataSourceMock(repo: ReturnType<typeof buildRefreshTokenRepoMock>): DataSource {
  return {
    transaction: jest.fn(async (cb: (manager: EntityManager) => any) => {
      const manager = {
        getRepository: jest.fn(() => repo),
      } as unknown as EntityManager;
      return cb(manager);
    }),
  } as unknown as DataSource;
}

function buildServicePrincipalRepoMock(
  principals: ServicePrincipal[] = [],
): Repository<ServicePrincipal> {
  const store = new Map<string, ServicePrincipal>();
  for (const p of principals) {
    store.set(p.serviceId, p);
  }
  return {
    findOne: jest.fn(async (opts: { where: { serviceId: string; active: boolean } }) => {
      const p = store.get(opts.where.serviceId);
      if (!p) return null;
      if (opts.where.active === true && !p.active) return null;
      return p;
    }),
  } as unknown as Repository<ServicePrincipal>;
}

function buildSessionRevokerMock(): JwtRevocationAdapter {
  return {
    revokeSession: jest.fn().mockResolvedValue(undefined),
    revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
    isRevoked: jest.fn().mockResolvedValue(false),
  } as unknown as JwtRevocationAdapter;
}

function buildAuditPortMock(): AccessAuditPort {
  return {
    logAdminBypass: jest.fn(),
    logSecurityEvent: jest.fn(),
    logAccessDenied: jest.fn(),
  };
}

interface BuiltService {
  svc: TokenIssuerService;
  signer: MockKeySigner;
  refreshRepo: ReturnType<typeof buildRefreshTokenRepoMock>;
  sessionRevoker: JwtRevocationAdapter;
  audit: AccessAuditPort;
  identity: ResolvedIdentity;
}

async function buildService(
  configOverrides: Record<string, unknown> = {},
  identityOverrides: Partial<ResolvedIdentity> = {},
  options: {
    withInit?: boolean;
    audit?: AccessAuditPort | null;
    principals?: ServicePrincipal[];
  } = {},
): Promise<BuiltService> {
  const signer = await buildKeySigner();
  const identity = buildIdentity(identityOverrides);
  const resolver = buildIdentityResolver(identity);
  const config = buildConfig(configOverrides);
  const refreshRepo = buildRefreshTokenRepoMock();
  const dataSource = buildDataSourceMock(refreshRepo);
  const servicePrincipalRepo = buildServicePrincipalRepoMock(
    options.principals ?? [],
  );
  const sessionRevoker = buildSessionRevokerMock();
  const audit =
    options.audit === undefined ? buildAuditPortMock() : options.audit;

  const svc = new TokenIssuerService(
    signer.service,
    resolver,
    config,
    refreshRepo as unknown as Repository<RefreshToken>,
    servicePrincipalRepo,
    dataSource,
    sessionRevoker,
    audit,
  );
  if (options.withInit !== false) {
    svc.onModuleInit();
  }
  return {
    svc,
    signer,
    refreshRepo,
    sessionRevoker,
    audit: audit as AccessAuditPort,
    identity,
  };
}

describe('TokenIssuerService', () => {
  describe('TTL bounds (canon §29.4)', () => {
    it('boots with the default 600s TTL when JWT_ACCESS_TTL_SECONDS is unset', async () => {
      const { svc } = await buildService({ JWT_ACCESS_TTL_SECONDS: undefined });
      expect(svc.getAccessTokenTtlSeconds()).toBe(600);
    });

    it('throws at startup when JWT_ACCESS_TTL_SECONDS is below 300', async () => {
      const { svc } = await buildService(
        { JWT_ACCESS_TTL_SECONDS: 60 },
        {},
        { withInit: false },
      );
      expect(() => svc.onModuleInit()).toThrow(/JWT_ACCESS_TTL_SECONDS/);
      expect(() => svc.onModuleInit()).toThrow(/\[300, 900\]/);
    });

    it('throws at startup when JWT_ACCESS_TTL_SECONDS is above 900', async () => {
      const { svc } = await buildService(
        { JWT_ACCESS_TTL_SECONDS: 3600 },
        {},
        { withInit: false },
      );
      expect(() => svc.onModuleInit()).toThrow(/\[300, 900\]/);
    });

    it('throws at startup when JWT_ACCESS_TTL_SECONDS is not an integer', async () => {
      const { svc } = await buildService(
        { JWT_ACCESS_TTL_SECONDS: 'not-a-number' },
        {},
        { withInit: false },
      );
      expect(() => svc.onModuleInit()).toThrow(/integer/);
    });

    it('accepts boundary values 300 and 900', async () => {
      const min = await buildService({ JWT_ACCESS_TTL_SECONDS: 300 });
      expect(min.svc.getAccessTokenTtlSeconds()).toBe(300);
      const max = await buildService({ JWT_ACCESS_TTL_SECONDS: 900 });
      expect(max.svc.getAccessTokenTtlSeconds()).toBe(900);
    });
  });

  describe('Refresh-token TTL bounds (canon §29.4 / §29.5)', () => {
    it('defaults to 14 days when JWT_REFRESH_TTL_DAYS is unset', async () => {
      const { svc } = await buildService({ JWT_REFRESH_TTL_DAYS: undefined });
      expect(svc.getRefreshTokenTtlSeconds()).toBe(14 * 24 * 60 * 60);
    });

    it('honors a custom JWT_REFRESH_TTL_DAYS=7', async () => {
      const { svc } = await buildService({ JWT_REFRESH_TTL_DAYS: 7 });
      expect(svc.getRefreshTokenTtlSeconds()).toBe(7 * 24 * 60 * 60);
    });

    it('throws at startup when JWT_REFRESH_TTL_DAYS=0', async () => {
      const { svc } = await buildService(
        { JWT_REFRESH_TTL_DAYS: 0 },
        {},
        { withInit: false },
      );
      expect(() => svc.onModuleInit()).toThrow(/JWT_REFRESH_TTL_DAYS/);
      expect(() => svc.onModuleInit()).toThrow(/\[1, 30\]/);
    });

    it('throws at startup when JWT_REFRESH_TTL_DAYS=31', async () => {
      const { svc } = await buildService(
        { JWT_REFRESH_TTL_DAYS: 31 },
        {},
        { withInit: false },
      );
      expect(() => svc.onModuleInit()).toThrow(/\[1, 30\]/);
    });

    it('throws at startup when JWT_REFRESH_TTL_DAYS is not an integer', async () => {
      const { svc } = await buildService(
        { JWT_REFRESH_TTL_DAYS: 'forever' },
        {},
        { withInit: false },
      );
      expect(() => svc.onModuleInit()).toThrow(/integer/);
    });
  });

  describe('canonical claims (canon §29.3)', () => {
    it('issues a JWT with all required §29.3 claims', async () => {
      const { svc, identity } = await buildService();
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
      const { svc } = await buildService({}, { securityStamp: 'stamp-fresh-7' });
      const { token } = await svc.issueAccessToken({
        userId: 'user-1',
        sessionId: 'sess-9',
      });
      const decoded = decodeJwt(token);
      expect((decoded as Record<string, unknown>)['token_version']).toBe(
        'stamp-fresh-7',
      );
    });

    it('sets the JWT header to alg=ES256 with the active kid', async () => {
      const { svc, signer } = await buildService();
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
      const { svc, signer } = await buildService();
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
      const { svc } = await buildService();
      const { expiresIn } = await svc.issueAccessToken({
        userId: 'user-1',
        sessionId: 'sess-9',
      });
      expect(expiresIn).toBe(600);
    });
  });

  describe('identity resolution errors', () => {
    it('throws UnauthorizedException when the resolver returns null', async () => {
      const signer = await buildKeySigner();
      const refreshRepo = buildRefreshTokenRepoMock();
      const svc = new TokenIssuerService(
        signer.service,
        buildIdentityResolver(null),
        buildConfig(),
        refreshRepo as unknown as Repository<RefreshToken>,
        buildServicePrincipalRepoMock(),
        buildDataSourceMock(refreshRepo),
        buildSessionRevokerMock(),
        buildAuditPortMock(),
      );
      svc.onModuleInit();
      await expect(
        svc.issueAccessToken({ userId: 'ghost', sessionId: 'sess' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user is not active', async () => {
      const { svc } = await buildService({}, { status: 'suspended' });
      await expect(
        svc.issueAccessToken({ userId: 'user-1', sessionId: 'sess' }),
      ).rejects.toThrow(/inactive/i);
    });
  });

  describe('generateSessionId', () => {
    it('returns a fresh uuid each call', async () => {
      const { svc } = await buildService();
      const a = svc.generateSessionId();
      const b = svc.generateSessionId();
      expect(a).not.toBe(b);
      expect(a).toMatch(/[0-9a-f-]{36}/);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Refresh-token family (canon §29.5)
  // ─────────────────────────────────────────────────────────────────

  describe('issueRefreshTokenFamily', () => {
    it('writes a new row with the right shape (family_id new, parent_token_id null)', async () => {
      const { svc, refreshRepo } = await buildService();
      const { refreshToken, familyId } = await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-1',
        instanceId: null,
        userAgent: 'Mozilla/5.0 Chrome/120',
        ipAddress: '127.0.0.1',
      });

      expect(refreshRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = (refreshRepo.insert.mock.calls[0][0] ?? {}) as Partial<RefreshToken>;
      expect(inserted.parentTokenId).toBeNull();
      expect(inserted.familyId).toBe(familyId);
      expect(inserted.userId).toBe('user-1');
      expect(inserted.sessionId).toBe('sess-1');
      expect(typeof refreshToken).toBe('string');
    });

    it('returns a base64url 32-byte token whose hash matches the stored value', async () => {
      const { svc, refreshRepo } = await buildService();
      const { refreshToken } = await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-1',
        instanceId: null,
      });
      // 32 bytes → 43 char base64url (no padding)
      expect(refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const expectedHash = createHash('sha256').update(refreshToken).digest('hex');
      const inserted = (refreshRepo.insert.mock.calls[0][0] ?? {}) as Partial<RefreshToken>;
      expect(inserted.tokenHash).toBe(expectedHash);
    });

    it('sets expires_at to now + 14 days by default', async () => {
      const { svc, refreshRepo } = await buildService();
      const before = Date.now();
      await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-1',
        instanceId: null,
      });
      const after = Date.now();
      const inserted = (refreshRepo.insert.mock.calls[0][0] ?? {}) as Partial<RefreshToken>;
      const expiresMs = (inserted.expiresAt as Date).getTime();
      const fourteenDays = 14 * 24 * 60 * 60 * 1000;
      expect(expiresMs).toBeGreaterThanOrEqual(before + fourteenDays - 100);
      expect(expiresMs).toBeLessThanOrEqual(after + fourteenDays + 100);
    });

    it('honors a custom JWT_REFRESH_TTL_DAYS=7', async () => {
      const { svc, refreshRepo } = await buildService({ JWT_REFRESH_TTL_DAYS: 7 });
      const before = Date.now();
      await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-1',
        instanceId: null,
      });
      const inserted = (refreshRepo.insert.mock.calls[0][0] ?? {}) as Partial<RefreshToken>;
      const expiresMs = (inserted.expiresAt as Date).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDays - 1000);
      expect(expiresMs).toBeLessThan(before + sevenDays + 1000);
    });

    it('does NOT store plaintext IP or User-Agent — only their SHA-256 hashes', async () => {
      const { svc, refreshRepo } = await buildService();
      await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-1',
        instanceId: null,
        userAgent: 'Mozilla/5.0',
        ipAddress: '10.0.0.42',
      });
      const inserted = (refreshRepo.insert.mock.calls[0][0] ?? {}) as Partial<RefreshToken>;
      // No plaintext field on the entity
      expect((inserted as Record<string, unknown>)['ipAddress']).toBeUndefined();
      expect((inserted as Record<string, unknown>)['userAgent']).toBeUndefined();
      // Hashes present and equal to expected
      expect(inserted.ipAddressHash).toBe(
        createHash('sha256').update('10.0.0.42').digest('hex'),
      );
      expect(inserted.userAgentHash).toBe(
        createHash('sha256').update('Mozilla/5.0').digest('hex'),
      );
    });

    it('derives a device_label from the User-Agent when none is supplied', async () => {
      const { svc, refreshRepo } = await buildService();
      await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-1',
        instanceId: null,
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
      });
      const inserted = (refreshRepo.insert.mock.calls[0][0] ?? {}) as Partial<RefreshToken>;
      expect(inserted.deviceLabel).toBe('Safari on Mac');
    });
  });

  describe('rotateRefreshToken — happy path', () => {
    it('consumes old token (sets last_used_at + replaced_by_token_id) and mints new in same family', async () => {
      const { svc, refreshRepo } = await buildService();
      const issued = await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-1',
        instanceId: null,
      });
      const originalHash = hashToken(issued.refreshToken);

      const rotated = await svc.rotateRefreshToken({
        presentedToken: issued.refreshToken,
        ipAddress: '127.0.0.1',
      });

      expect(rotated.refreshToken).not.toBe(issued.refreshToken);
      expect(rotated.userId).toBe('user-1');
      expect(rotated.sessionId).toBe('sess-1');

      const oldRow = refreshRepo.rows.find((r) => r.tokenHash === originalHash);
      expect(oldRow?.lastUsedAt).toBeInstanceOf(Date);
      expect(oldRow?.replacedByTokenId).toBe(hashToken(rotated.refreshToken));

      const newRow = refreshRepo.rows.find(
        (r) => r.tokenHash === hashToken(rotated.refreshToken),
      );
      expect(newRow?.familyId).toBe(issued.familyId);
      expect(newRow?.parentTokenId).toBe(originalHash);
    });

    it('preserves family_id across rotations; parent_token_id chains correctly', async () => {
      const { svc, refreshRepo } = await buildService();
      const issued = await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-1',
        instanceId: null,
      });
      const rot1 = await svc.rotateRefreshToken({ presentedToken: issued.refreshToken });
      const rot2 = await svc.rotateRefreshToken({ presentedToken: rot1.refreshToken });

      // Verify the chain root → rot1 → rot2 all share the family_id
      // and parent_token_id points to the predecessor's hash.
      const familyMembers = refreshRepo.rows.filter((r) => r.familyId === issued.familyId);
      expect(familyMembers).toHaveLength(3);
      const rot2Row = familyMembers.find(
        (r) => r.tokenHash === hashToken(rot2.refreshToken),
      );
      expect(rot2Row?.parentTokenId).toBe(hashToken(rot1.refreshToken));
    });
  });

  describe('rotateRefreshToken — reuse detection', () => {
    it('on already-rotated token: revokes family, revokes session, audits high-severity, throws 401', async () => {
      const { svc, refreshRepo, sessionRevoker, audit } = await buildService();
      const issued = await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-reuse',
        instanceId: null,
      });
      // First rotation consumes the original token.
      await svc.rotateRefreshToken({ presentedToken: issued.refreshToken });

      // Replaying the original (already-used) token triggers reuse detection.
      await expect(
        svc.rotateRefreshToken({
          presentedToken: issued.refreshToken,
          ipAddress: '203.0.113.7',
          userAgent: 'curl/7.85',
        }),
      ).rejects.toThrow(/session has expired/i);

      // Entire family revoked with reason 'reuse_detected'.
      const familyRows = refreshRepo.rows.filter((r) => r.familyId === issued.familyId);
      expect(familyRows.every((r) => r.revokedAt instanceof Date)).toBe(true);
      expect(familyRows.every((r) => r.revokedReason === 'reuse_detected')).toBe(true);

      // Session revoked via the JwtRevocationPort surface so access tokens fail too.
      expect(sessionRevoker.revokeSession).toHaveBeenCalledWith('sess-reuse');

      // High-severity AccessAuditPort.logSecurityEvent with the plaintext IP/UA.
      expect(audit.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          kind: 'reuse_detected',
          severity: 'high',
          context: expect.objectContaining({
            familyId: issued.familyId,
            sessionId: 'sess-reuse',
            ipAddressAtReuse: '203.0.113.7',
            userAgentAtReuse: 'curl/7.85',
          }),
        }),
      );
    });
  });

  describe('rotateRefreshToken — unknown / revoked / expired', () => {
    it('on an unknown token: throws bland 401, no audit event', async () => {
      const { svc, audit } = await buildService();
      await expect(
        svc.rotateRefreshToken({ presentedToken: 'never-existed' }),
      ).rejects.toThrow(/session has expired/i);
      expect(audit.logSecurityEvent).not.toHaveBeenCalled();
    });

    it('on a token whose family is already expired: revokes with reason family_expired, throws 401', async () => {
      const { svc, refreshRepo } = await buildService({ JWT_REFRESH_TTL_DAYS: 1 });
      const issued = await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-1',
        instanceId: null,
      });
      // Force the family's expires_at into the past.
      for (const row of refreshRepo.rows) {
        if (row.familyId === issued.familyId) {
          row.expiresAt = new Date(Date.now() - 60_000);
        }
      }

      await expect(
        svc.rotateRefreshToken({ presentedToken: issued.refreshToken }),
      ).rejects.toThrow(/session has expired/i);

      const familyRows = refreshRepo.rows.filter((r) => r.familyId === issued.familyId);
      expect(familyRows.every((r) => r.revokedReason === 'family_expired')).toBe(true);
    });

    it('on an already-revoked token: throws bland 401', async () => {
      const { svc, refreshRepo } = await buildService();
      const issued = await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-1',
        instanceId: null,
      });
      // Pre-revoke the issued row.
      for (const row of refreshRepo.rows) {
        if (row.tokenHash === hashToken(issued.refreshToken)) {
          row.revokedAt = new Date();
          row.revokedReason = 'logout';
        }
      }

      await expect(
        svc.rotateRefreshToken({ presentedToken: issued.refreshToken }),
      ).rejects.toThrow(/session has expired/i);
    });
  });

  describe('revokeFamilyForSession', () => {
    it('marks every active row in the family with reason logout', async () => {
      const { svc, refreshRepo } = await buildService();
      await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-logout',
        instanceId: null,
      });
      await svc.revokeFamilyForSession('sess-logout');
      const row = refreshRepo.rows[0];
      expect(row.revokedReason).toBe('logout');
      expect(row.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('revokeAllUserFamilies', () => {
    it('marks every active family for the user with reason password_change by default', async () => {
      const { svc, refreshRepo } = await buildService();
      await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-a',
        instanceId: null,
      });
      await svc.issueRefreshTokenFamily({
        userId: 'user-1',
        sessionId: 'sess-b',
        instanceId: null,
      });
      await svc.revokeAllUserFamilies('user-1');
      for (const row of refreshRepo.rows) {
        expect(row.revokedReason).toBe('password_change');
        expect(row.revokedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('generateRefreshToken helper', () => {
    it('returns a base64url string of 43 chars (32 bytes pre-encoding)', () => {
      const token = generateRefreshToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('returns a different token each call', () => {
      const a = generateRefreshToken();
      const b = generateRefreshToken();
      expect(a).not.toBe(b);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Service-token issuance (canon §29.7)
  // ─────────────────────────────────────────────────────────────────

  describe('issueServiceToken', () => {
    function buildPrincipal(
      overrides: Partial<ServicePrincipal> = {},
    ): ServicePrincipal {
      return {
        serviceId: 'svc-worker',
        displayName: 'BullMQ background worker',
        allowedAudiences: ['svc-api'],
        allowedScopes: ['work_order:read', 'work_order:write', 'audit:write'],
        k8sServiceAccount:
          'system:serviceaccount:hubblewave-system:svc-worker-sa',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      } as ServicePrincipal;
    }

    it('mints an ES256 token with sub=service:<id>, aud=<audience>, scope=allowed_scopes (5min TTL)', async () => {
      const principal = buildPrincipal();
      const { svc, signer } = await buildService({}, {}, {
        principals: [principal],
      });
      const { token, expiresIn } = await svc.issueServiceToken({
        serviceId: 'svc-worker',
        audience: 'svc-api',
        instanceId: TEST_INSTANCE_ID,
      });
      expect(expiresIn).toBe(300);

      const header = decodeProtectedHeader(token) as { alg?: string };
      expect(header.alg).toBe('ES256');

      const publicKey = await importJWK(
        await exportJWK(createPublicKey(signer.privateKey)),
        'ES256',
      );
      const verified = await jwtVerify(token, publicKey, {
        audience: 'svc-api',
        algorithms: ['ES256'],
      });
      const payload = verified.payload as Record<string, unknown>;
      expect(payload['sub']).toBe('service:svc-worker');
      expect(payload['aud']).toBe('svc-api');
      expect(payload['iss']).toBe(`hubblewave-${TEST_INSTANCE_ID}`);
      expect(payload['scope']).toEqual([
        'work_order:read',
        'work_order:write',
        'audit:write',
      ]);
      expect(payload['instance_id']).toBe(TEST_INSTANCE_ID);
    });

    it('NEVER carries a token_version claim — service tokens have no security_stamp', async () => {
      const { svc } = await buildService({}, {}, {
        principals: [buildPrincipal()],
      });
      const { token } = await svc.issueServiceToken({
        serviceId: 'svc-worker',
        audience: 'svc-api',
        instanceId: TEST_INSTANCE_ID,
      });
      const payload = decodeJwt(token) as Record<string, unknown>;
      expect(payload['token_version']).toBeUndefined();
    });

    it('session_id is a fresh UUID per mint (not tied to a user session)', async () => {
      const { svc } = await buildService({}, {}, {
        principals: [buildPrincipal()],
      });
      const first = await svc.issueServiceToken({
        serviceId: 'svc-worker',
        audience: 'svc-api',
        instanceId: TEST_INSTANCE_ID,
      });
      const second = await svc.issueServiceToken({
        serviceId: 'svc-worker',
        audience: 'svc-api',
        instanceId: TEST_INSTANCE_ID,
      });
      const sid1 = (decodeJwt(first.token) as Record<string, unknown>)[
        'session_id'
      ];
      const sid2 = (decodeJwt(second.token) as Record<string, unknown>)[
        'session_id'
      ];
      expect(sid1).not.toBe(sid2);
      expect(typeof sid1).toBe('string');
      expect(String(sid1)).toMatch(/[0-9a-f-]{36}/);
    });

    it('throws UnauthorizedException when the principal does not exist', async () => {
      const { svc } = await buildService({}, {}, { principals: [] });
      await expect(
        svc.issueServiceToken({
          serviceId: 'svc-ghost',
          audience: 'svc-api',
          instanceId: TEST_INSTANCE_ID,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when the principal is inactive', async () => {
      const { svc } = await buildService({}, {}, {
        principals: [buildPrincipal({ active: false })],
      });
      await expect(
        svc.issueServiceToken({
          serviceId: 'svc-worker',
          audience: 'svc-api',
          instanceId: TEST_INSTANCE_ID,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws ForbiddenException when audience is not in allowed_audiences', async () => {
      const { svc } = await buildService({}, {}, {
        principals: [buildPrincipal({ allowedAudiences: ['svc-api'] })],
      });
      await expect(
        svc.issueServiceToken({
          serviceId: 'svc-worker',
          audience: 'svc-attacker',
          instanceId: TEST_INSTANCE_ID,
        }),
      ).rejects.toThrow(/not allowed to call audience/);
    });

    it('throws UnauthorizedException when serviceId is empty', async () => {
      const { svc } = await buildService({}, {}, { principals: [] });
      await expect(
        svc.issueServiceToken({
          serviceId: '',
          audience: 'svc-api',
          instanceId: TEST_INSTANCE_ID,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});

// `createPublicKey` import kept so the file's behavior matches the
// production signer's posture (private → public derivation), even though
// the mock signer in this spec uses `exportJWK(publicKey)` directly.
// Referenced here so the unused-import lint does not flag the symbol.
void createPublicKey;
