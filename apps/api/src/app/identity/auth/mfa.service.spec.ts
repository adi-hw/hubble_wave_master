import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as argon2 from 'argon2';

import { MfaService } from './mfa.service';
import { MfaMethod } from '@hubblewave/instance-db';
import { RedisService } from '@hubblewave/redis';

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

/**
 * In-memory RedisService stand-in that mirrors the small subset of the API
 * exercised by MfaService (exists, set with TTL). Per-key TTL is tracked so
 * tests can simulate expiry.
 */
function createRedisMock() {
  const store = new Map<string, { value: string; expiresAt: number | null }>();
  return {
    store,
    set: jest.fn(async (key: string, value: string, ttlSeconds?: number) => {
      store.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      });
      return true;
    }),
    exists: jest.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return false;
      if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
        store.delete(key);
        return false;
      }
      return true;
    }),
    expire(key: string) {
      store.delete(key);
    },
  };
}

describe('MfaService', () => {
  let service: MfaService;
  let redisMock: ReturnType<typeof createRedisMock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    redisMock = createRedisMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        { provide: getRepositoryToken(MfaMethod), useValue: mockMfaMethodRepository },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: redisMock },
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

    it('should hash recovery codes with argon2id (PHC format) before storage', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValue(null);
      mockMfaMethodRepository.save.mockResolvedValue({ id: 'mfa-123', userId: 'user-123' });

      await service.enrollTotp('user-123');

      const saveArg = mockMfaMethodRepository.save.mock.calls[0][0];
      const storedCodes = (saveArg.recoveryCodes as string).split('\n');
      expect(storedCodes.length).toBe(10);
      for (const stored of storedCodes) {
        // Argon2id PHC strings always start with the algorithm sentinel.
        expect(stored.startsWith('$argon2id$')).toBe(true);
      }
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

    it('should reject an immediately replayed TOTP code (same user, same code)', async () => {
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

      const first = await service.verifyTotp('user-123', validToken);
      expect(first).toBe(true);

      const second = await service.verifyTotp('user-123', validToken);
      expect(second).toBe(false);

      // The replay cache must have written exactly one entry for this code.
      expect(redisMock.set).toHaveBeenCalledTimes(1);
    });

    it('should accept the same code from a different user (per-user replay key)', async () => {
      const secret = authenticator.generateSecret();
      const validToken = authenticator.generate(secret);

      mockMfaMethodRepository.findOne
        .mockResolvedValueOnce({
          id: 'mfa-a',
          userId: 'user-a',
          type: 'TOTP',
          secret,
          enabled: true,
          verified: true,
        })
        .mockResolvedValueOnce({
          id: 'mfa-b',
          userId: 'user-b',
          type: 'TOTP',
          secret,
          enabled: true,
          verified: true,
        });

      const userA = await service.verifyTotp('user-a', validToken);
      const userB = await service.verifyTotp('user-b', validToken);

      expect(userA).toBe(true);
      expect(userB).toBe(true);
      expect(redisMock.store.size).toBe(2);
    });

    it('should accept the same code again after the replay-cache TTL expires', async () => {
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

      const first = await service.verifyTotp('user-123', validToken);
      expect(first).toBe(true);

      // Simulate TTL expiry by purging the cache entry.
      for (const key of [...redisMock.store.keys()]) {
        redisMock.expire(key);
      }

      const second = await service.verifyTotp('user-123', validToken);
      expect(second).toBe(true);
    });
  });

  describe('verifyRecoveryCode', () => {
    it('should accept a valid recovery code and remove it from storage', async () => {
      const recoveryCode = 'ABCD1234';
      const hash = await argon2.hash(recoveryCode);

      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        recoveryCodes: hash,
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
      const validHash = await argon2.hash('VALID1234');

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

    it('should round-trip codes produced by enrollTotp through verifyRecoveryCode', async () => {
      mockMfaMethodRepository.findOne.mockResolvedValueOnce(null);
      mockMfaMethodRepository.save.mockResolvedValue({ id: 'mfa-123', userId: 'user-123' });

      const { recoveryCodes } = await service.enrollTotp('user-123');
      const storedHashes = (mockMfaMethodRepository.save.mock.calls[0][0].recoveryCodes as string);

      // Replay the codes through verifyRecoveryCode using the hashed payload
      // that was just persisted at enrollment.
      mockMfaMethodRepository.findOne.mockResolvedValue({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        recoveryCodes: storedHashes,
        enabled: true,
      });

      const accepted = await service.verifyRecoveryCode('user-123', recoveryCodes[0]);
      expect(accepted).toBe(true);
    });

    it('should reject a recovery code that has already been redeemed (one-time use)', async () => {
      const codeA = 'AAAA1111';
      const codeB = 'BBBB2222';
      const hashA = await argon2.hash(codeA);
      const hashB = await argon2.hash(codeB);
      const combined = [hashA, hashB].join('\n');

      // First call: codeA accepted; storage rewritten without it.
      mockMfaMethodRepository.findOne.mockResolvedValueOnce({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        recoveryCodes: combined,
        enabled: true,
      });

      const firstAttempt = await service.verifyRecoveryCode('user-123', codeA);
      expect(firstAttempt).toBe(true);

      const updateArgs = mockMfaMethodRepository.update.mock.calls[0][1];
      expect(updateArgs.recoveryCodes).toBe(hashB);

      // Second call: codeA already removed from storage; rejected.
      mockMfaMethodRepository.findOne.mockResolvedValueOnce({
        id: 'mfa-123',
        userId: 'user-123',
        type: 'TOTP',
        recoveryCodes: hashB,
        enabled: true,
      });

      const secondAttempt = await service.verifyRecoveryCode('user-123', codeA);
      expect(secondAttempt).toBe(false);
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
