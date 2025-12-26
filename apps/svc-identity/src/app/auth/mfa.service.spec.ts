import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'otplib';

import { MfaService } from './mfa.service';
import { MfaMethod, User } from '@hubblewave/instance-db';

// Mock repositories
const mockMfaMethodRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

const mockUserRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      MFA_ISSUER: 'HubbleWave',
      MFA_ENCRYPTION_KEY: 'test-encryption-key-32-characters',
    };
    return config[key] || defaultValue;
  }),
};

describe('MfaService', () => {
  let service: MfaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        { provide: getRepositoryToken(MfaMethod), useValue: mockMfaMethodRepository },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSecret', () => {
    it('should generate a valid TOTP secret', async () => {
      const mockUser: Partial<User> = {
        id: 'user-123',
        email: 'test@example.com',
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.generateSecret('user-123');

      expect(result).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.qrCode).toBeDefined();
      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.generateSecret('non-existent')).rejects.toThrow();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid TOTP token', async () => {
      // Generate a real secret for testing
      const secret = speakeasy.authenticator.generateSecret();
      const validToken = speakeasy.authenticator.generate(secret);

      const mockMfaMethod: Partial<MfaMethod> = {
        id: 'mfa-123',
        userId: 'user-123',
        type: 'totp',
        secret: secret, // In real impl, this would be encrypted
        isActive: true,
      };

      mockMfaMethodRepository.findOne.mockResolvedValue(mockMfaMethod);

      const result = await service.verifyToken('user-123', validToken);

      expect(result).toBe(true);
    });

    it('should reject invalid TOTP token', async () => {
      const secret = speakeasy.authenticator.generateSecret();

      const mockMfaMethod: Partial<MfaMethod> = {
        id: 'mfa-123',
        userId: 'user-123',
        type: 'totp',
        secret: secret,
        isActive: true,
      };

      mockMfaMethodRepository.findOne.mockResolvedValue(mockMfaMethod);

      const result = await service.verifyToken('user-123', '000000');

      expect(result).toBe(false);
    });

    it('should reject when MFA is not set up', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyToken('user-123', '123456')).rejects.toThrow();
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify valid backup code', async () => {
      const backupCodes = ['ABCD-1234-EFGH', 'IJKL-5678-MNOP'];

      const mockMfaMethod: Partial<MfaMethod> = {
        id: 'mfa-123',
        userId: 'user-123',
        type: 'totp',
        backupCodes: backupCodes,
        isActive: true,
      };

      mockMfaMethodRepository.findOne.mockResolvedValue(mockMfaMethod);

      const result = await service.verifyBackupCode('user-123', 'ABCD-1234-EFGH');

      expect(result).toBe(true);
      // Should save with used code removed
      expect(mockMfaMethodRepository.save).toHaveBeenCalled();
    });

    it('should reject invalid backup code', async () => {
      const mockMfaMethod: Partial<MfaMethod> = {
        id: 'mfa-123',
        userId: 'user-123',
        type: 'totp',
        backupCodes: ['ABCD-1234-EFGH'],
        isActive: true,
      };

      mockMfaMethodRepository.findOne.mockResolvedValue(mockMfaMethod);

      const result = await service.verifyBackupCode('user-123', 'WRONG-CODE-HERE');

      expect(result).toBe(false);
    });

    it('should reject already used backup code', async () => {
      const mockMfaMethod: Partial<MfaMethod> = {
        id: 'mfa-123',
        userId: 'user-123',
        type: 'totp',
        backupCodes: [], // No codes left
        isActive: true,
      };

      mockMfaMethodRepository.findOne.mockResolvedValue(mockMfaMethod);

      const result = await service.verifyBackupCode('user-123', 'ANY-CODE-HERE');

      expect(result).toBe(false);
    });
  });

  describe('enableMfa', () => {
    it('should enable MFA for user', async () => {
      const mockUser: Partial<User> = {
        id: 'user-123',
        email: 'test@example.com',
        mfaEnabled: false,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        isVerified: true,
      });

      await service.enableMfa('user-123');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ mfaEnabled: true })
      );
    });

    it('should throw if MFA method not verified', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        isVerified: false,
      });

      await expect(service.enableMfa('user-123')).rejects.toThrow();
    });
  });

  describe('disableMfa', () => {
    it('should disable MFA for user', async () => {
      const mockUser: Partial<User> = {
        id: 'user-123',
        email: 'test@example.com',
        mfaEnabled: true,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await service.disableMfa('user-123');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ mfaEnabled: false })
      );
      expect(mockMfaMethodRepository.delete).toHaveBeenCalledWith({ userId: 'user-123' });
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should generate new backup codes', async () => {
      const mockMfaMethod: Partial<MfaMethod> = {
        id: 'mfa-123',
        userId: 'user-123',
        type: 'totp',
        backupCodes: ['OLD-CODE-1234'],
        isActive: true,
      };

      mockMfaMethodRepository.findOne.mockResolvedValue(mockMfaMethod);

      const newCodes = await service.regenerateBackupCodes('user-123');

      expect(newCodes).toBeDefined();
      expect(newCodes.length).toBeGreaterThan(0);
      expect(newCodes).not.toContain('OLD-CODE-1234');
      expect(mockMfaMethodRepository.save).toHaveBeenCalled();
    });

    it('should throw if MFA not set up', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue(null);

      await expect(service.regenerateBackupCodes('user-123')).rejects.toThrow();
    });
  });
});
