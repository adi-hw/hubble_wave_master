import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MfaMethod } from '@eam-platform/platform-db';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { TenantDbService } from '@eam-platform/tenant-db';
import { EncryptionService } from '@eam-platform/shared-types';

@Injectable()
export class MfaService implements OnModuleInit {
  private readonly logger = new Logger(MfaService.name);
  private encryptionService: EncryptionService | null = null;

  constructor(
    private readonly tenantDbService: TenantDbService,
    private readonly configService: ConfigService,
  ) {
    // Configure TOTP settings
    authenticator.options = {
      window: 1, // Allow 1 step before and after (30 seconds each)
    };
  }

  onModuleInit() {
    // Initialize encryption service if ENCRYPTION_KEY is set
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    const nodeEnv = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
    const isProduction = nodeEnv === 'production';

    if (encryptionKey) {
      try {
        this.encryptionService = new EncryptionService(encryptionKey);
        this.logger.log('MFA secret encryption enabled');
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (isProduction) {
          // SECURITY: In production, encryption must work properly
          this.logger.error(`CRITICAL: Failed to initialize encryption service: ${errorMessage}`);
          throw new Error(
            `ENCRYPTION_KEY is set but invalid. MFA requires proper encryption in production. Error: ${errorMessage}`
          );
        } else {
          this.logger.warn('Failed to initialize encryption service, MFA secrets will be stored unencrypted', {
            error: errorMessage,
          });
        }
      }
    } else {
      if (isProduction) {
        // SECURITY: In production, ENCRYPTION_KEY is mandatory for MFA
        this.logger.error(
          'CRITICAL: ENCRYPTION_KEY environment variable is not set. ' +
          'This is required in production to encrypt MFA secrets. ' +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
        throw new Error(
          'ENCRYPTION_KEY is required in production for secure MFA secret storage. ' +
          'Set ENCRYPTION_KEY environment variable with a 64-character hex string.'
        );
      } else {
        this.logger.warn(
          'ENCRYPTION_KEY not set - MFA secrets will be stored unencrypted. ' +
          'This is acceptable for development but MUST be set for production.'
        );
      }
    }
  }

  /**
   * Encrypts a secret if encryption is enabled
   */
  private encryptSecret(secret: string): string {
    if (this.encryptionService) {
      return this.encryptionService.encrypt(secret);
    }
    return secret;
  }

  /**
   * Decrypts a secret if it appears to be encrypted
   */
  private decryptSecret(secret: string): string {
    if (this.encryptionService && this.encryptionService.isEncrypted(secret)) {
      return this.encryptionService.decrypt(secret);
    }
    return secret;
  }

  async enrollTotp(tenantId: string, userId: string, appName: string = 'EAM Platform'): Promise<{ secret: string; qrCode: string; recoveryCodes: string[] }> {
    const mfaMethodRepo = await this.tenantDbService.getRepository(tenantId, MfaMethod);
    // Generate a secret
    const secret = authenticator.generateSecret();

    // Check if user already has TOTP enabled
    const existing = await mfaMethodRepo.findOne({
      where: { userId, type: 'TOTP' },
    });

    if (existing && existing.verified) {
      throw new Error('TOTP already enabled for this user');
    }

    // Get user info for QR code label
    const otpauth = authenticator.keyuri(userId, appName, secret);

    // Generate QR code
    const qrCode = await QRCode.toDataURL(otpauth);

    // Generate recovery codes (10 codes)
    const recoveryCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      recoveryCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }

    // Hash recovery codes for storage
    const hashedCodes = recoveryCodes.map(code =>
      crypto.createHash('sha256').update(code).digest('hex')
    );
    const hashedCodesString = hashedCodes.join(',');

    // Encrypt secret before storage
    const encryptedSecret = this.encryptSecret(secret);

    // Save or update MFA method (not verified yet)
    if (existing) {
      await mfaMethodRepo.update(existing.id, {
        secret: encryptedSecret,
        recoveryCodes: hashedCodesString,
        verified: false,
      });
    } else {
      await mfaMethodRepo.save({
        userId,
        type: 'TOTP',
        secret: encryptedSecret,
        recoveryCodes: hashedCodesString,
        enabled: false,
        verified: false,
      });
    }

    return { secret, qrCode, recoveryCodes };
  }

  async verifyTotpEnrollment(tenantId: string, userId: string, token: string): Promise<boolean> {
    const mfaMethodRepo = await this.tenantDbService.getRepository(tenantId, MfaMethod);
    const mfaMethod = await mfaMethodRepo.findOne({
      where: { userId, type: 'TOTP' },
    });

    if (!mfaMethod || !mfaMethod.secret) {
      return false;
    }

    // Decrypt secret for verification
    const decryptedSecret = this.decryptSecret(mfaMethod.secret);

    const isValid = authenticator.verify({
      token,
      secret: decryptedSecret,
    });

    if (isValid) {
      // Mark as verified and enabled
      await mfaMethodRepo.update(mfaMethod.id, {
        verified: true,
        enabled: true,
        lastUsedAt: new Date(),
      });
    }

    return isValid;
  }

  async verifyTotp(tenantId: string, userId: string, token: string): Promise<boolean> {
    const mfaMethodRepo = await this.tenantDbService.getRepository(tenantId, MfaMethod);
    const mfaMethod = await mfaMethodRepo.findOne({
      where: { userId, type: 'TOTP', enabled: true, verified: true },
    });

    if (!mfaMethod || !mfaMethod.secret) {
      return false;
    }

    // Decrypt secret for verification
    const decryptedSecret = this.decryptSecret(mfaMethod.secret);

    const isValid = authenticator.verify({
      token,
      secret: decryptedSecret,
    });

    if (isValid) {
      // Update last used timestamp
      await mfaMethodRepo.update(mfaMethod.id, {
        lastUsedAt: new Date(),
      });
    }

    return isValid;
  }

  async verifyRecoveryCode(tenantId: string, userId: string, code: string): Promise<boolean> {
    const mfaMethodRepo = await this.tenantDbService.getRepository(tenantId, MfaMethod);
    const mfaMethod = await mfaMethodRepo.findOne({
      where: { userId, type: 'TOTP', enabled: true },
    });

    if (!mfaMethod) {
      return false;
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const storedCodes = (mfaMethod.recoveryCodes || '').split(',').filter(Boolean);
    const codeIndex = storedCodes.indexOf(codeHash);

    if (codeIndex === -1) {
      return false;
    }

    // Remove used recovery code
    const updatedCodes = [...storedCodes];
    updatedCodes.splice(codeIndex, 1);

    await mfaMethodRepo.update(mfaMethod.id, {
      recoveryCodes: updatedCodes.join(','),
    });

    return true;
  }

  async isMfaEnabled(tenantId: string, userId: string): Promise<boolean> {
    const mfaMethodRepo = await this.tenantDbService.getRepository(tenantId, MfaMethod);
    const mfaMethod = await mfaMethodRepo.findOne({
      where: { userId, enabled: true, verified: true },
    });

    return !!mfaMethod;
  }

  async disableMfa(tenantId: string, userId: string): Promise<void> {
    const mfaMethodRepo = await this.tenantDbService.getRepository(tenantId, MfaMethod);
    await mfaMethodRepo.delete({ userId });
  }

  async getMfaStatus(tenantId: string, userId: string): Promise<{ enabled: boolean; type?: string }> {
    const mfaMethodRepo = await this.tenantDbService.getRepository(tenantId, MfaMethod);
    const mfaMethod = await mfaMethodRepo.findOne({
      where: { userId, enabled: true, verified: true },
    });

    if (!mfaMethod) {
      return { enabled: false };
    }

    return {
      enabled: true,
      type: mfaMethod.type,
    };
  }
}
