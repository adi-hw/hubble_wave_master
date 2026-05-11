import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { MfaService } from './mfa.service';
import { AuthEventsService } from './auth-events.service';
import { PasswordValidationService } from './password-validation.service';
import { SessionCacheService } from './session-cache.service';
import { PermissionResolverService } from '../roles/permission-resolver.service';
import { RedisService } from '@hubblewave/redis';
import { User, PasswordHistory, AuthSettings } from '@hubblewave/instance-db';
import { JwtRevocationAdapter } from './jwt-revocation.adapter';

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

const mockJwtService = {
  sign: jest.fn(),
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
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

const mockRefreshTokenService = {
  createRefreshToken: jest.fn(),
  findByToken: jest.fn(),
  rotateRefreshToken: jest.fn(),
  revokeToken: jest.fn(),
  revokeAllUserTokens: jest.fn(),
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
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
        { provide: MfaService, useValue: mockMfaService },
        { provide: AuthEventsService, useValue: mockAuthEventsService },
        { provide: PasswordValidationService, useValue: mockPasswordValidationService },
        { provide: PermissionResolverService, useValue: mockPermissionResolver },
        { provide: RedisService, useValue: mockRedisService },
        { provide: JwtRevocationAdapter, useValue: mockJwtRevocationAdapter },
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
      mockJwtService.sign.mockReturnValue('mock-access-token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue({
        token: 'mock-refresh-token',
        entity: { id: 'token-id' },
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
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('completes login when a valid TOTP token is provided', async () => {
      mockAuthSettingsRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(baseUser());
      mockMfaService.isMfaEnabled.mockResolvedValue(true);
      mockMfaService.verifyTotp.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-access-token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue({
        token: 'mock-refresh-token',
        entity: { id: 'token-id' },
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
      mockRefreshTokenService.findByToken.mockResolvedValue({
        userId: 'user-123',
        token: 'hashed-old-token',
        family: 'family-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        status: 'active',
      });
      mockRefreshTokenService.rotateRefreshToken.mockResolvedValue({
        token: 'new-refresh-token',
        entity: { id: 'new-token-id' },
      });
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshAccessToken('old-refresh-token', undefined, '127.0.0.1', 'Jest Test');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(mockRefreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        'old-refresh-token',
        '127.0.0.1',
        'Jest Test',
        'user-123',
      );
    });

    it('rejects an unknown refresh token', async () => {
      mockRefreshTokenService.findByToken.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken('invalid-token'),
      ).rejects.toThrow(/invalid or expired/i);
    });

    it('rejects a revoked refresh token', async () => {
      mockRefreshTokenService.findByToken.mockResolvedValue({
        userId: 'user-123',
        token: 'hashed-revoked',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await expect(
        service.refreshAccessToken('revoked-token'),
      ).rejects.toThrow(/invalid or expired/i);
    });
  });

  describe('logout', () => {
    it('revokes all refresh tokens for the user and records the event', async () => {
      await service.logout('user-123', undefined, '127.0.0.1', 'Jest Test');

      expect(mockRefreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-123');
      expect(mockAuthEventsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LOGOUT', userId: 'user-123' }),
      );
    });

    it('revokes the live access-token session in Redis when sessionId is present (F002)', async () => {
      await service.logout('user-123', 'sess-xyz', '127.0.0.1', 'Jest Test');

      expect(mockJwtRevocationAdapter.revokeSession).toHaveBeenCalledWith('sess-xyz');
      // Refresh-token revocation must still fire — the two are
      // independent revocation surfaces.
      expect(mockRefreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-123');
    });

    it('skips the access-token session revoke when no sessionId is on the JWT (F002)', async () => {
      await service.logout('user-123', undefined, '127.0.0.1', 'Jest Test');

      expect(mockJwtRevocationAdapter.revokeSession).not.toHaveBeenCalled();
      expect(mockRefreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-123');
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
