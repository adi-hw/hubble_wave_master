import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { DataSource, EntityManager } from 'typeorm';

import { ACCESS_AUDIT_PORT, type AccessAuditPort } from '@hubblewave/auth-guard';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { AuthEventsService } from './auth-events.service';
import { PasswordValidationService } from './password-validation.service';
import { SessionCacheService } from './session-cache.service';
import { PermissionResolverService } from '../roles/permission-resolver.service';
import { RedisService } from '@hubblewave/redis';
import { User, PasswordHistory, AuthSettings, RefreshToken } from '@hubblewave/instance-db';
import { JwtRevocationAdapter } from './jwt-revocation.adapter';
import { TokenIssuerService } from './token-issuer.service';

const mockUserRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
};

const mockPasswordHistoryRepository = {
  find: jest.fn(),
  save: jest.fn(),
  insert: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockAuthSettingsRepository = {
  findOne: jest.fn(),
};

const mockTokenIssuer = {
  issueAccessToken: jest.fn(),
  issueRefreshTokenFamily: jest.fn(),
  rotateRefreshToken: jest.fn(),
  revokeFamilyForSession: jest.fn(),
  revokeAllUserFamilies: jest.fn(),
  cleanupExpiredRefreshTokens: jest.fn(),
  generateSessionId: jest.fn(() => 'sess-test-uuid'),
  getAccessTokenTtlSeconds: jest.fn(() => 600),
  getRefreshTokenTtlSeconds: jest.fn(() => 14 * 24 * 60 * 60),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '15m',
      JWT_AUDIENCE: 'hubblewave-instance',
      JWT_ISSUER: 'hubblewave-identity',
    };
    return config[key] ?? defaultValue;
  }),
};

const mockMfaService = {
  isMfaEnabled: jest.fn(),
  verifyTotp: jest.fn(),
  verifyRecoveryCode: jest.fn(),
};

const mockAuthEventsService = {
  record: jest.fn(),
};

const mockPasswordValidationService = {
  validatePassword: jest.fn(),
};

const mockPermissionResolver = {
  getUserPermissions: jest.fn().mockResolvedValue({
    roles: [{ code: 'user', name: 'User' }],
    permissions: new Set<string>(['read:self']),
  }),
};

const mockRedisService = {
  get: jest.fn().mockResolvedValue(null),
  incrWithExpiry: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(undefined),
};

const mockJwtRevocationAdapter = {
  isRevoked: jest.fn().mockResolvedValue(false),
  revokeSession: jest.fn().mockResolvedValue(undefined),
  revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
};

/**
 * In-memory DataSource simulation. `transaction(cb)` invokes the callback
 * with an `EntityManager` whose `getRepository(Entity)` returns the matching
 * mock repository. Tests can assert on `mockRefreshTokenRepository.update`
 * and `mockUserRepository.update` to verify transactional writes.
 */
const mockRefreshTokenRepository = {
  update: jest.fn().mockResolvedValue({ affected: 0 }),
  insert: jest.fn().mockResolvedValue({ identifiers: [] }),
  find: jest.fn().mockResolvedValue([]),
};

const mockAccessAuditPort: AccessAuditPort = {
  logAdminBypass: jest.fn(),
  logSecurityEvent: jest.fn(),
  logAccessDenied: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn(async (cb: (manager: EntityManager) => unknown) => {
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === RefreshToken) return mockRefreshTokenRepository;
        if (entity === User) return mockUserRepository;
        if (entity === PasswordHistory) return mockPasswordHistoryRepository;
        return mockUserRepository;
      }),
    } as unknown as EntityManager;
    return cb(manager);
  }),
} as unknown as DataSource;

describe('AuthService', () => {
  let service: AuthService;
  let validPasswordHash: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPermissionResolver.getUserPermissions.mockResolvedValue({
      roles: [{ code: 'user', name: 'User' }],
      permissions: new Set<string>(['read:self']),
    });
    mockRedisService.get.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(PasswordHistory), useValue: mockPasswordHistoryRepository },
        { provide: getRepositoryToken(AuthSettings), useValue: mockAuthSettingsRepository },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: TokenIssuerService, useValue: mockTokenIssuer },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MfaService, useValue: mockMfaService },
        { provide: AuthEventsService, useValue: mockAuthEventsService },
        { provide: PasswordValidationService, useValue: mockPasswordValidationService },
        { provide: PermissionResolverService, useValue: mockPermissionResolver },
        { provide: RedisService, useValue: mockRedisService },
        { provide: JwtRevocationAdapter, useValue: mockJwtRevocationAdapter },
        { provide: ACCESS_AUDIT_PORT, useValue: mockAccessAuditPort },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    validPasswordHash = await argon2.hash('TestPassword123!');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const baseUser = (): Partial<User> => ({
      id: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      passwordHash: validPasswordHash,
      passwordAlgo: 'argon2id',
      status: 'active',
      mfaEnabled: false,
      emailVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    it('issues access + refresh tokens for valid credentials', async () => {
      mockAuthSettingsRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(baseUser());
      mockMfaService.isMfaEnabled.mockResolvedValue(false);
      mockTokenIssuer.issueAccessToken.mockResolvedValue({
        token: 'mock-access-token',
        expiresIn: 600,
      });
      mockTokenIssuer.issueRefreshTokenFamily.mockResolvedValue({
        refreshToken: 'mock-refresh-token',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        familyId: 'family-uuid',
      });

      const result = await service.login(
        { username: 'test@example.com', password: 'TestPassword123!' },
        '127.0.0.1',
        'Jest Test',
      );

      expect(result).toMatchObject({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
      expect(mockAuthEventsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LOGIN_SUCCESS', success: true }),
      );
    });

    it('rejects login with an invalid password', async () => {
      mockAuthSettingsRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(baseUser());

      await expect(
        service.login({ username: 'test@example.com', password: 'WrongPassword!' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ failedLoginAttempts: 1 }),
      );
    });

    it('rejects login for a non-existent user', async () => {
      mockAuthSettingsRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({ username: 'nonexistent@example.com', password: 'TestPassword123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns mfaRequired=true when MFA is enabled and no token is supplied', async () => {
      mockAuthSettingsRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(baseUser());
      mockMfaService.isMfaEnabled.mockResolvedValue(true);

      const result = await service.login({
        username: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(result).toEqual(
        expect.objectContaining({ mfaRequired: true }),
      );
      expect(mockTokenIssuer.issueAccessToken).not.toHaveBeenCalled();
    });

    it('completes login when a valid TOTP token is provided', async () => {
      mockAuthSettingsRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(baseUser());
      mockMfaService.isMfaEnabled.mockResolvedValue(true);
      mockMfaService.verifyTotp.mockResolvedValue(true);
      mockTokenIssuer.issueAccessToken.mockResolvedValue({
        token: 'mock-access-token',
        expiresIn: 600,
      });
      mockTokenIssuer.issueRefreshTokenFamily.mockResolvedValue({
        refreshToken: 'mock-refresh-token',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        familyId: 'family-uuid',
      });

      const result = await service.login({
        username: 'test@example.com',
        password: 'TestPassword123!',
        mfaToken: '123456',
      });

      expect(result).toMatchObject({ accessToken: 'mock-access-token' });
      expect(mockMfaService.verifyTotp).toHaveBeenCalledWith('user-123', '123456');
      expect(mockRedisService.del).toHaveBeenCalled();
    });

    it('rejects an invalid TOTP token and records the failed attempt', async () => {
      mockAuthSettingsRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(baseUser());
      mockMfaService.isMfaEnabled.mockResolvedValue(true);
      mockMfaService.verifyTotp.mockResolvedValue(false);
      mockMfaService.verifyRecoveryCode.mockResolvedValue(false);

      await expect(
        service.login({
          username: 'test@example.com',
          password: 'TestPassword123!',
          mfaToken: '000000',
        }),
      ).rejects.toThrow(/Invalid MFA code/i);
      expect(mockRedisService.incrWithExpiry).toHaveBeenCalled();
    });

    it('rejects login for a locked account', async () => {
      mockAuthSettingsRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue({
        ...baseUser(),
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });

      await expect(
        service.login({ username: 'test@example.com', password: 'TestPassword123!' }),
      ).rejects.toThrow(/locked/i);
    });

    it('rejects login for an inactive user', async () => {
      mockAuthSettingsRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue({
        ...baseUser(),
        status: 'suspended',
      });

      await expect(
        service.login({ username: 'test@example.com', password: 'TestPassword123!' }),
      ).rejects.toThrow(/not active/i);
    });
  });

  describe('changePassword', () => {
    const userId = 'user-123';

    beforeEach(() => {
      mockUserRepository.findOne.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: validPasswordHash,
      });
      mockAuthSettingsRepository.findOne.mockResolvedValue(null);
      mockPasswordHistoryRepository.find.mockResolvedValue([]);
      mockPasswordHistoryRepository.insert.mockResolvedValue({});
      mockPasswordHistoryRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      });
    });

    it('changes the password when the current password and new password validate', async () => {
      mockPasswordValidationService.validatePassword.mockResolvedValue({ valid: true, errors: [] });

      const result = await service.changePassword(userId, 'TestPassword123!', 'NewPassword456!');

      expect(result.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );
      expect(mockPasswordHistoryRepository.insert).toHaveBeenCalled();
    });

    it('bumps security_stamp on password change (canon §29.6 kill-switch)', async () => {
      mockPasswordValidationService.validatePassword.mockResolvedValue({ valid: true, errors: [] });

      const result = await service.changePassword(userId, 'TestPassword123!', 'NewPassword456!');

      expect(result.success).toBe(true);
      // The update call must contain BOTH the new passwordHash AND a
      // fresh securityStamp — bumping the stamp is what makes every
      // outstanding access token fail verification immediately.
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          passwordHash: expect.any(String),
          passwordChangedAt: expect.any(Date),
          securityStamp: expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
      );
    });

    it('revokes every active refresh family for the user (canon §29.5 password_change)', async () => {
      mockPasswordValidationService.validatePassword.mockResolvedValue({ valid: true, errors: [] });

      const result = await service.changePassword(userId, 'TestPassword123!', 'NewPassword456!');

      expect(result.success).toBe(true);
      expect(mockTokenIssuer.revokeAllUserFamilies).toHaveBeenCalledWith(
        userId,
        'password_change',
      );
    });

    it('throws when the current password is incorrect', async () => {
      await expect(
        service.changePassword(userId, 'WrongPassword!', 'NewPassword456!'),
      ).rejects.toThrow(/current password/i);
    });

    it('returns a validation failure when the new password fails policy', async () => {
      mockPasswordValidationService.validatePassword.mockResolvedValue({
        valid: false,
        errors: ['Password too weak'],
      });

      const result = await service.changePassword(userId, 'TestPassword123!', 'weak');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Password too weak');
    });
  });

  describe('refreshAccessToken', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      mockTokenIssuer.rotateRefreshToken.mockResolvedValue({
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        userId: 'user-123',
        sessionId: 'sess-existing',
        instanceId: null,
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        status: 'active',
      });
      mockTokenIssuer.issueAccessToken.mockResolvedValue({
        token: 'new-access-token',
        expiresIn: 600,
      });

      const result = await service.refreshAccessToken(
        'old-refresh-token',
        undefined,
        '127.0.0.1',
        'Jest Test',
      );

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(mockTokenIssuer.rotateRefreshToken).toHaveBeenCalledWith({
        presentedToken: 'old-refresh-token',
        ipAddress: '127.0.0.1',
        userAgent: 'Jest Test',
      });
      // sessionId is reused across rotations (canon §29.5)
      expect(mockTokenIssuer.issueAccessToken).toHaveBeenCalledWith({
        userId: 'user-123',
        sessionId: 'sess-existing',
      });
    });

    it('rejects an unknown refresh token with the bland session-expired message', async () => {
      const { UnauthorizedException } = await import('@nestjs/common');
      mockTokenIssuer.rotateRefreshToken.mockRejectedValue(
        new UnauthorizedException('Your session has expired. Please sign in again.'),
      );

      await expect(
        service.refreshAccessToken('invalid-token'),
      ).rejects.toThrow(/session has expired/i);
    });

    it('rejects when rotation succeeds but the user is no longer active', async () => {
      mockTokenIssuer.rotateRefreshToken.mockResolvedValue({
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        userId: 'user-123',
        sessionId: 'sess-existing',
        instanceId: null,
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        status: 'suspended',
      });

      await expect(
        service.refreshAccessToken('valid-token'),
      ).rejects.toThrow(/session has expired/i);
      // Fail-closed: a user suspended between login and refresh must
      // have their freshly-minted family revoked too.
      expect(mockTokenIssuer.revokeAllUserFamilies).toHaveBeenCalledWith(
        'user-123',
        'admin_revoke',
      );
    });
  });

  describe('logout', () => {
    it('records the LOGOUT event and is a no-op on refresh-token state when no sessionId is present', async () => {
      await service.logout('user-123', undefined, '127.0.0.1', 'Jest Test');

      // Canon §29.5 rule 4: logout is session-scoped. Without a sessionId
      // we cannot identify which family to revoke, so no revocation
      // fires — but the audit event still records.
      expect(mockTokenIssuer.revokeFamilyForSession).not.toHaveBeenCalled();
      expect(mockJwtRevocationAdapter.revokeSession).not.toHaveBeenCalled();
      expect(mockAuthEventsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LOGOUT', userId: 'user-123' }),
      );
    });

    it('revokes the refresh-token family AND the live access-token session in Redis when sessionId is present', async () => {
      await service.logout('user-123', 'sess-xyz', '127.0.0.1', 'Jest Test');

      // Canon §29.5 rule 4 — refresh-side revocation by sessionId.
      expect(mockTokenIssuer.revokeFamilyForSession).toHaveBeenCalledWith('sess-xyz');
      // F002 — access-token revocation by sessionId.
      expect(mockJwtRevocationAdapter.revokeSession).toHaveBeenCalledWith('sess-xyz');
    });

    it('does NOT bump security_stamp on per-device logout (canon §29.6.1)', async () => {
      // Per-device logout is the load-bearing distinction: it must NOT
      // touch the user's security_stamp. The stamp is the global
      // kill-switch invoked only by /auth/logout-all-devices.
      await service.logout('user-123', 'sess-xyz', '127.0.0.1', 'Jest Test');

      // No update to the User row touching securityStamp.
      const securityStampCalls = mockUserRepository.update.mock.calls.filter(
        (call) => {
          const updates = call[1];
          return (
            updates &&
            typeof updates === 'object' &&
            'securityStamp' in updates
          );
        },
      );
      expect(securityStampCalls.length).toBe(0);
    });
  });

  describe('logoutAllDevices (canon §29.6.1)', () => {
    beforeEach(() => {
      mockRefreshTokenRepository.update.mockReset();
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 3 });
      mockUserRepository.update.mockReset();
      mockUserRepository.update.mockResolvedValue({ affected: 1 });
      (mockAccessAuditPort.logSecurityEvent as jest.Mock).mockReset();
      (mockDataSource.transaction as jest.Mock).mockClear();
    });

    it('revokes ALL active refresh families for the user with reason logout_all_devices', async () => {
      await service.logoutAllDevices('user-123');

      // The transactional update on refresh_tokens scopes to the user
      // and to active rows; the reason code is the new dedicated value.
      const refreshUpdateCall = mockRefreshTokenRepository.update.mock.calls[0];
      expect(refreshUpdateCall[0]).toMatchObject({ userId: 'user-123' });
      expect(refreshUpdateCall[1]).toMatchObject({
        revokedReason: 'logout_all_devices',
        revokedAt: expect.any(Date),
      });
    });

    it('bumps security_stamp to a fresh uuid in the same transaction', async () => {
      await service.logoutAllDevices('user-123');

      // Find the User.update call that touches securityStamp.
      const stampCall = mockUserRepository.update.mock.calls.find((call) => {
        const updates = call[1];
        return (
          updates && typeof updates === 'object' && 'securityStamp' in updates
        );
      });
      expect(stampCall).toBeDefined();
      // Stamp value must be a fresh uuid (not the literal string
      // 'undefined' or empty).
      expect((stampCall as unknown[])[1]).toMatchObject({
        securityStamp: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      });
    });

    it('runs both writes inside a single DataSource transaction', async () => {
      await service.logoutAllDevices('user-123');

      // dataSource.transaction MUST be invoked exactly once — the two
      // writes commit together or roll back together.
      expect((mockDataSource.transaction as jest.Mock).mock.calls.length).toBe(1);
    });

    it('emits a high-severity audit event with kind logout_all_devices', async () => {
      await service.logoutAllDevices('user-123', {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest Test',
      });

      expect(mockAccessAuditPort.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          kind: 'logout_all_devices',
          severity: 'high',
          context: expect.objectContaining({
            ipAddressAtInvocation: '127.0.0.1',
            userAgentAtInvocation: 'Jest Test',
          }),
        }),
      );
    });

    it('records LOGOUT_ALL_DEVICES in auth_events', async () => {
      await service.logoutAllDevices('user-123', {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest Test',
      });

      expect(mockAuthEventsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'LOGOUT_ALL_DEVICES',
          userId: 'user-123',
          success: true,
        }),
      );
    });

    it('audit context carries null ip + user-agent when not supplied', async () => {
      await service.logoutAllDevices('user-123');

      expect(mockAccessAuditPort.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            ipAddressAtInvocation: null,
            userAgentAtInvocation: null,
          }),
        }),
      );
    });

    it('does not throw when the AccessAuditPort logSecurityEvent throws', async () => {
      (mockAccessAuditPort.logSecurityEvent as jest.Mock).mockImplementation(() => {
        throw new Error('audit DB down');
      });

      // A thrown audit MUST NOT regress the revocation path.
      await expect(service.logoutAllDevices('user-123')).resolves.toBeUndefined();
      // Refresh-family revocation still ran.
      expect(mockRefreshTokenRepository.update).toHaveBeenCalled();
    });

    it('works for a user with zero active families (just bumps stamp + audits)', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 0 });

      await service.logoutAllDevices('user-123');

      // Even with zero families to revoke, stamp bump still happens.
      const stampCall = mockUserRepository.update.mock.calls.find((call) => {
        const updates = call[1];
        return (
          updates && typeof updates === 'object' && 'securityStamp' in updates
        );
      });
      expect(stampCall).toBeDefined();
      // And the audit event still fires.
      expect(mockAccessAuditPort.logSecurityEvent).toHaveBeenCalled();
    });

    it('is idempotent across rapid successive calls', async () => {
      await service.logoutAllDevices('user-123');
      await service.logoutAllDevices('user-123');

      // Two transactions, two audit events, two stamp bumps. No errors.
      expect((mockDataSource.transaction as jest.Mock).mock.calls.length).toBe(2);
      expect((mockAccessAuditPort.logSecurityEvent as jest.Mock).mock.calls.length).toBe(2);
    });
  });
});

describe('PasswordValidationService', () => {
  let service: PasswordValidationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordValidationService,
        {
          provide: getRepositoryToken(AuthSettings),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              passwordMinLength: 12,
              passwordRequireUppercase: true,
              passwordRequireLowercase: true,
              passwordRequireNumbers: true,
              passwordRequireSymbols: true,
              passwordBlockCommon: true,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PasswordValidationService>(PasswordValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('accepts a strong password', async () => {
    const result = await service.validatePassword('MyStr0ng!Password');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a too-short password', async () => {
    const result = await service.validatePassword('Sh0rt!');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /at least/i.test(e))).toBe(true);
  });

  it('rejects a password without uppercase letters', async () => {
    const result = await service.validatePassword('alllowercase123!');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /uppercase/i.test(e))).toBe(true);
  });

  it('rejects a common password from the blocklist', async () => {
    // 'password1!' is on the COMMON_PASSWORDS list; the validator lowercases
    // before lookup, so case differences must not let the password through.
    const result = await service.validatePassword('Password1!');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /common|pattern/i.test(e))).toBe(true);
  });
});

describe('SessionCacheService', () => {
  let service: SessionCacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCacheService,
        { provide: ConfigService, useValue: mockConfigService },
        // RedisService is @Optional() — leaving it unbound causes the cache to
        // report as disabled, which is the behaviour we exercise here.
      ],
    }).compile();

    service = module.get<SessionCacheService>(SessionCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('reports disabled when Redis is unavailable', () => {
    expect(service.enabled).toBe(false);
  });

  it('returns null for getSession when disabled', async () => {
    await expect(service.getSession('any-session-id')).resolves.toBeNull();
  });

  it('returns an empty array for getUserSessionIds when disabled', async () => {
    await expect(service.getUserSessionIds('user-123')).resolves.toEqual([]);
  });
});
