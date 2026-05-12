import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MfaMethod, User } from '@hubblewave/instance-db';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { EncryptionService } from '@hubblewave/shared-types';
import { RedisService } from '@hubblewave/redis';

/**
 * Argon2id parameters for recovery codes (OWASP-recommended baseline).
 *
 * Recovery codes are short (8 hex characters), so a fast hash like SHA-256
 * is brute-forceable offline. Argon2id resists GPU/ASIC attacks and is the
 * canonical secret hash for HubbleWave (see W5.C dep registry).
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,       // 3 iterations
  parallelism: 4,    // 4 threads
  hashLength: 32,    // 256-bit output
};

/**
 * TOTP step size in seconds (RFC 6238 default).
 */
const TOTP_STEP_SECONDS = 30;

/**
 * TOTP verification window: ±1 step from the current step. Allows for ~30s
 * of clock drift on each side, giving a total validity span of 90 seconds.
 *
 * Replay detection (see verifyTotp) prevents a code captured during that
 * window from being redeemed more than once.
 */
const TOTP_WINDOW = 1;

/**
 * Replay-cache TTL: covers the full validity span of any accepted TOTP code
 * (step × (2×window + 1) = 30 × 3 = 90 seconds). Once the entry expires, the
 * underlying TOTP code is no longer accepted by the verifier anyway, so the
 * replay record can be reaped.
 */
const TOTP_REPLAY_TTL_SECONDS = TOTP_STEP_SECONDS * (2 * TOTP_WINDOW + 1);

@Injectable()
export class MfaService implements OnModuleInit {
  private readonly logger = new Logger(MfaService.name);
  private encryptionService: EncryptionService | null = null;

  constructor(
    @InjectRepository(MfaMethod) private readonly mfaMethodRepo: Repository<MfaMethod>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    // Configure TOTP settings. window=1 tolerates ±30s of clock drift; the
    // replay cache in verifyTotp prevents reuse within that span.
    authenticator.options = {
      step: TOTP_STEP_SECONDS,
      window: TOTP_WINDOW,
    };
  }

  /**
   * Canon §29.6 — bump `security_stamp` on MFA security events
   * (enrollment, disable, recovery-code regeneration). Verifiers
   * compare the JWT's `token_version` to the live stamp; mismatch →
   * 401, every in-flight access token invalidated globally.
   *
   * Callers MUST run this inside the same transaction as the MFA
   * write so both happen or neither does (canon §10 audit-in
   * -transaction; the stamp bump is the security-relevant write that
   * makes the MFA change effective immediately rather than after the
   * next access-token TTL roll).
   */
  private async bumpSecurityStamp(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    await manager.getRepository(User).update(
      { id: userId },
      { securityStamp: crypto.randomUUID() },
    );
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

  async enrollTotp(userId: string, appName: string = 'HubbleWave Platform'): Promise<{ secret: string; qrCode: string; recoveryCodes: string[] }> {
    // Generate a secret
    const secret = authenticator.generateSecret();

    // Check if user already has TOTP enabled
    const existing = await this.mfaMethodRepo.findOne({
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

    // Hash recovery codes with argon2id for storage. Argon2 PHC strings embed
    // their own salt+params, so each code gets a unique, slow-to-brute-force
    // hash. The PHC format contains commas inside the parameter block, so the
    // stored list is joined by newlines.
    const hashedCodes = await Promise.all(
      recoveryCodes.map((code) => argon2.hash(code, ARGON2_OPTIONS)),
    );
    const hashedCodesString = hashedCodes.join('\n');

    // Encrypt secret before storage
    const encryptedSecret = this.encryptSecret(secret);

    // Canon §29.6 + §10 — MFA enrollment is a security event. Save the
    // MFA method AND bump `security_stamp` in ONE transaction so the
    // two writes commit or roll back together. The stamp bump
    // invalidates every in-flight access token for the user; on the
    // next request the verifier sees `token_version` mismatch and
    // forces a fresh token mint that reflects the new MFA state.
    await this.dataSource.transaction(async (manager) => {
      const mfaMethodRepo = manager.getRepository(MfaMethod);
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
      await this.bumpSecurityStamp(manager, userId);
    });

    return { secret, qrCode, recoveryCodes };
  }

  async verifyTotpEnrollment(userId: string, token: string): Promise<boolean> {
    const mfaMethod = await this.mfaMethodRepo.findOne({
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
      // Canon §29.6 + §10 — completing MFA enrollment is the moment
      // MFA actually protects the account. Mark the method as enabled
      // AND bump `security_stamp` in ONE transaction so every existing
      // access token is invalidated; the next token mint carries the
      // new stamp value with MFA in effect.
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(MfaMethod).update(mfaMethod.id, {
          verified: true,
          enabled: true,
          lastUsedAt: new Date(),
        });
        await this.bumpSecurityStamp(manager, userId);
      });
    }

    return isValid;
  }

  async verifyTotp(userId: string, token: string): Promise<boolean> {
    const mfaMethodRepo = this.mfaMethodRepo;
    const mfaMethod = await mfaMethodRepo.findOne({
      where: { userId, type: 'TOTP', enabled: true, verified: true },
    });

    if (!mfaMethod || !mfaMethod.secret) {
      return false;
    }

    // Reject replays: a TOTP code accepted within the last validity span
    // (step × (2×window + 1) seconds) cannot be redeemed a second time by
    // the same user. Key is scoped per-user so the same code from a
    // different user's authenticator is unaffected.
    const replayKey = this.buildTotpReplayKey(userId, token);
    if (await this.redisService.exists(replayKey)) {
      this.logger.warn(`Rejected replayed TOTP code for user ${userId}`);
      return false;
    }

    // Decrypt secret for verification
    const decryptedSecret = this.decryptSecret(mfaMethod.secret);

    const isValid = authenticator.verify({
      token,
      secret: decryptedSecret,
    });

    if (isValid) {
      // Record the redeemed code in the replay cache before any downstream
      // work, so a parallel request cannot redeem the same code.
      await this.redisService.set(replayKey, '1', TOTP_REPLAY_TTL_SECONDS);

      // Update last used timestamp
      await mfaMethodRepo.update(mfaMethod.id, {
        lastUsedAt: new Date(),
      });
    }

    return isValid;
  }

  /**
   * Build the per-user, per-code replay-cache key.
   *
   * The token is included in the key (not the value) so distinct codes do not
   * collide, and so the cache scales linearly with the number of distinct
   * codes a user redeems in the TTL window. The token is also passed through
   * a SHA-256 digest before being placed in the key: that is purely
   * defensive (avoid leaking the OTP if Redis is ever logged or
   * dumped), not a substitute for argon2 — TOTPs are short-lived and the
   * cache is in-memory only.
   */
  private buildTotpReplayKey(userId: string, token: string): string {
    const tokenDigest = crypto.createHash('sha256').update(token).digest('hex');
    return `mfa:totp:replay:${userId}:${tokenDigest}`;
  }

  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const mfaMethodRepo = this.mfaMethodRepo;
    const mfaMethod = await mfaMethodRepo.findOne({
      where: { userId, type: 'TOTP', enabled: true },
    });

    if (!mfaMethod) {
      return false;
    }

    // Recovery codes are stored as newline-delimited argon2id PHC strings.
    // Each candidate is verified with argon2.verify; the first match wins.
    const storedCodes = (mfaMethod.recoveryCodes || '').split('\n').filter(Boolean);
    let matchedIndex = -1;

    for (let i = 0; i < storedCodes.length; i++) {
      try {
        if (await argon2.verify(storedCodes[i], code)) {
          matchedIndex = i;
          break;
        }
      } catch {
        // A malformed stored entry should not block verification of the rest.
        // The entry will be skipped; downstream regenerate-recovery-codes flow
        // can replace it.
        continue;
      }
    }

    if (matchedIndex === -1) {
      return false;
    }

    // One-time use: remove the matched code so it cannot be redeemed again.
    const updatedCodes = [...storedCodes];
    updatedCodes.splice(matchedIndex, 1);

    await mfaMethodRepo.update(mfaMethod.id, {
      recoveryCodes: updatedCodes.join('\n'),
    });

    return true;
  }

  async isMfaEnabled(userId: string): Promise<boolean> {
    const mfaMethodRepo = this.mfaMethodRepo;
    const mfaMethod = await mfaMethodRepo.findOne({
      where: { userId, enabled: true, verified: true },
    });

    return !!mfaMethod;
  }

  async disableMfa(userId: string): Promise<void> {
    // Canon §29.6 + §10 — disabling MFA is a security event. Delete
    // the MFA method AND bump `security_stamp` in ONE transaction.
    // The stamp bump invalidates every in-flight access token so that
    // the user (or an attacker who already had a session) cannot
    // continue authenticating against the now-weaker credential
    // surface without re-authenticating against it explicitly.
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(MfaMethod).delete({ userId });
      await this.bumpSecurityStamp(manager, userId);
    });
  }

  async getMfaStatus(userId: string): Promise<{ enabled: boolean; type?: string }> {
    const mfaMethodRepo = this.mfaMethodRepo;
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
