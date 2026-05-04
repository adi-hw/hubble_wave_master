import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';

import { MfaService } from './mfa.service';
import { MfaMethod } from '@hubblewave/instance-db';

const mockMfaMethodRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      MFA_ISSUER: 'HubbleWave',
      // No ENCRYPTION_KEY → secrets stored unencrypted (acceptable in dev/tests).
      NODE_ENV: 'test',
    };
    return config[key] ?? defaultValue;
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
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
    // OnModuleInit configures the encryption layer based on env.
    await (service as unknown as { onModuleInit: () => void | Promise<void> }).onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enrollTotp', () => {
    it('should generate a TOTP secret, QR code, and recovery codes', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue(null);
      mockMfaMethodRepository.save.mockResolvedValue({ id: 'mfa-123', userId: 'user-123' });

      const result = await service.enrollTotp('user-123');

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.qrCode).toMatch(/^data:image\/png/);
      expect(result.recoveryCodes).toBeDefined();
      expect(result.recoveryCodes.length).toBe(10);
      expect(mockMfaMethodRepository.save).toHaveBeenCalled();
    });

    it('should throw if TOTP is already enabled for the user', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        verified: true,
      });

      await expect(service.enrollTotp('user-123')).rejects.toThrow(/already enabled/i);
    });

    it('should reuse existing record when re-enrolling an unverified user', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-existing',
        userId: 'user-123',
        type: 'TOTP',
        verified: false,
      });

      await service.enrollTotp('user-123');

      expect(mockMfaMethodRepository.update).toHaveBeenCalledWith(
        'mfa-existing',
        expect.objectContaining({ verified: false }),
      );
    });
  });

  describe('verifyTotpEnrollment', () => {
    it('should verify a valid token and mark the method as enabled', async () => {
      const secret = authenticator.generateSecret();
      const validToken = authenticator.generate(secret);

      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        secret,
        verified: false,
        enabled: false,
      });

      const result = await service.verifyTotpEnrollment('user-123', validToken);

      expect(result).toBe(true);
      expect(mockMfaMethodRepository.update).toHaveBeenCalledWith(
        'mfa-123',
        expect.objectContaining({ verified: true, enabled: true }),
      );
    });

    it('should return false for an invalid enrollment token', async () => {
      const secret = authenticator.generateSecret();

      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        secret,
        verified: false,
        enabled: false,
      });

      const result = await service.verifyTotpEnrollment('user-123', '000000');

      expect(result).toBe(false);
      expect(mockMfaMethodRepository.update).not.toHaveBeenCalled();
    });

    it('should return false when the user has not started enrollment', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue(null);

      const result = await service.verifyTotpEnrollment('user-123', '123456');

      expect(result).toBe(false);
    });
  });

  describe('verifyTotp', () => {
    it('should verify a valid TOTP token for an enabled method', async () => {
      const secret = authenticator.generateSecret();
      const validToken = authenticator.generate(secret);

      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        secret,
        enabled: true,
        verified: true,
      });

      const result = await service.verifyTotp('user-123', validToken);

      expect(result).toBe(true);
      expect(mockMfaMethodRepository.update).toHaveBeenCalledWith(
        'mfa-123',
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });

    it('should reject an invalid TOTP token', async () => {
      const secret = authenticator.generateSecret();

      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        secret,
        enabled: true,
        verified: true,
      });

      const result = await service.verifyTotp('user-123', '000000');

      expect(result).toBe(false);
    });

    it('should return false when MFA is not set up for the user', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue(null);

      const result = await service.verifyTotp('user-123', '123456');

      expect(result).toBe(false);
    });
  });

  describe('verifyRecoveryCode', () => {
    it('should accept a valid recovery code and remove it from storage', async () => {
      const recoveryCode = 'ABCD1234';
      const codeHash = crypto.createHash('sha256').update(recoveryCode).digest('hex');

      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        recoveryCodes: codeHash,
        enabled: true,
      });

      const result = await service.verifyRecoveryCode('user-123', recoveryCode);

      expect(result).toBe(true);
      expect(mockMfaMethodRepository.update).toHaveBeenCalledWith(
        'mfa-123',
        expect.objectContaining({ recoveryCodes: '' }),
      );
    });

    it('should reject an invalid recovery code', async () => {
      const validHash = crypto.createHash('sha256').update('VALID1234').digest('hex');

      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        recoveryCodes: validHash,
        enabled: true,
      });

      const result = await service.verifyRecoveryCode('user-123', 'WRONG-CODE');

      expect(result).toBe(false);
    });

    it('should reject when no recovery codes are stored', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        recoveryCodes: '',
        enabled: true,
      });

      const result = await service.verifyRecoveryCode('user-123', 'ANY-CODE');

      expect(result).toBe(false);
    });
  });

  describe('isMfaEnabled', () => {
    it('should return true when an enabled+verified method exists', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        enabled: true,
        verified: true,
      });

      await expect(service.isMfaEnabled('user-123')).resolves.toBe(true);
    });

    it('should return false when no method exists', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue(null);

      await expect(service.isMfaEnabled('user-123')).resolves.toBe(false);
    });
  });

  describe('disableMfa', () => {
    it('should delete all MFA method rows for the user', async () => {
      mockMfaMethodRepository.delete.mockResolvedValue({ affected: 1 });

      await service.disableMfa('user-123');

      expect(mockMfaMethodRepository.delete).toHaveBeenCalledWith({ userId: 'user-123' });
    });
  });

  describe('getMfaStatus', () => {
    it('should report enabled status with method type', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        enabled: true,
        verified: true,
      });

      const status = await service.getMfaStatus('user-123');

      expect(status).toEqual({ enabled: true, type: 'TOTP' });
    });

    it('should report disabled when no enabled method exists', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue(null);

      const status = await service.getMfaStatus('user-123');

      expect(status).toEqual({ enabled: false });
    });
  });
});
