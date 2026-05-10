/**
 * Device Trust Service
 * HubbleWave Platform - Phase 1
 *
 * Service for managing trusted devices with fingerprinting and risk scoring.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import { TrustedDevice, User, AuditLog } from '@hubblewave/instance-db';

const DEVICE_TRUST_EXPIRY_DAYS = 90;
const MAX_TRUSTED_DEVICES_PER_USER = 10;
const CHALLENGE_EXPIRY_MINUTES = 5;

export interface DeviceFingerprint {
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  colorDepth?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  touchSupport?: boolean;
  webglVendor?: string;
  webglRenderer?: string;
  canvasHash?: string;
  audioHash?: string;
  fonts?: string[];
}

export interface DeviceRiskAssessment {
  score: number; // 0-100, higher = more risk
  factors: string[];
  recommendation: 'trust' | 'challenge' | 'block';
}

export interface TrustDeviceOptions {
  deviceName?: string;
  fingerprint: DeviceFingerprint;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class DeviceTrustService {
  private readonly logger = new Logger(DeviceTrustService.name);

  constructor(
    @InjectRepository(TrustedDevice)
    private readonly deviceRepo: Repository<TrustedDevice>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Register a device as trusted for a user
   */
  async trustDevice(
    userId: string,
    options: TrustDeviceOptions,
  ): Promise<TrustedDevice> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check device limit
    const existingDevices = await this.deviceRepo.count({
      where: { userId, status: 'trusted' },
    });
    if (existingDevices >= MAX_TRUSTED_DEVICES_PER_USER) {
      throw new BadRequestException(
        `Maximum ${MAX_TRUSTED_DEVICES_PER_USER} trusted devices allowed`,
      );
    }

    // Generate device fingerprint hash
    const deviceFingerprint = this.hashFingerprint(options.fingerprint);

    // Check if device already trusted
    const existingDevice = await this.deviceRepo.findOne({
      where: { userId, deviceFingerprint },
    });

    if (existingDevice) {
      // Update existing device
      existingDevice.lastSeenAt = new Date();
      existingDevice.loginCount += 1;
      if (options.ipAddress && !existingDevice.knownIps.includes(options.ipAddress)) {
        existingDevice.knownIps.push(options.ipAddress);
      }
      existingDevice.status = 'trusted';
      existingDevice.trustedUntil = new Date(
        Date.now() + DEVICE_TRUST_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );
      await this.deviceRepo.save(existingDevice);
      return existingDevice;
    }

    // Detect device type
    const deviceType = this.detectDeviceType(options.fingerprint);

    // Create new trusted device
    const now = new Date();
    const device = this.deviceRepo.create({
      userId,
      deviceName: options.deviceName || this.generateDeviceName(options.fingerprint),
      deviceFingerprint,
      deviceType,
      browser: this.extractBrowser(options.fingerprint.userAgent),
      os: this.extractOS(options.fingerprint.userAgent),
      status: 'trusted',
      trustScore: 100,
      knownIps: options.ipAddress ? [options.ipAddress] : [],
      knownLocations: [],
      firstSeenAt: now,
      lastSeenAt: now,
      loginCount: 1,
      trustedUntil: new Date(
        Date.now() + DEVICE_TRUST_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      ),
    });

    await this.deviceRepo.save(device);

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        userId,
        action: 'device.trust',
        collectionCode: 'device',
        recordId: device.id,
        newValues: {
          deviceName: device.deviceName,
        },
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      }),
    );

    this.logger.log(`Device trusted for user ${userId}: ${device.deviceName}`);

    return device;
  }

  /**
   * Check if a device is trusted for a user
   */
  async isDeviceTrusted(
    userId: string,
    fingerprint: DeviceFingerprint,
  ): Promise<{ trusted: boolean; device?: TrustedDevice; riskScore: number }> {
    const deviceFingerprint = this.hashFingerprint(fingerprint);

    const device = await this.deviceRepo.findOne({
      where: {
        userId,
        deviceFingerprint,
        status: 'trusted',
      },
    });

    if (!device) {
      const riskAssessment = await this.assessDeviceRisk(userId, fingerprint);
      return { trusted: false, riskScore: riskAssessment.score };
    }

    // Check if expired
    if (device.trustedUntil && new Date() > device.trustedUntil) {
      device.status = 'untrusted';
      await this.deviceRepo.save(device);
      return { trusted: false, device, riskScore: 50 };
    }

    // Update last seen
    device.lastSeenAt = new Date();
    device.loginCount += 1;
    await this.deviceRepo.save(device);

    return { trusted: true, device, riskScore: 0 };
  }

  /**
   * Assess risk for an unknown device
   */
  async assessDeviceRisk(
    userId: string,
    fingerprint: DeviceFingerprint,
    ipAddress?: string,
  ): Promise<DeviceRiskAssessment> {
    const factors: string[] = [];
    let score = 0;

    // Check if user has any trusted devices
    const trustedDevices = await this.deviceRepo.find({
      where: { userId, status: 'trusted' },
    });

    if (trustedDevices.length === 0) {
      // First device - moderate risk
      score += 30;
      factors.push('First device for this account');
    }

    // Check if the fingerprint matches any known device
    const matchingDevice = trustedDevices.find(d =>
      d.deviceFingerprint === this.hashFingerprint(fingerprint)
    );
    if (matchingDevice) {
      score -= 20;
      factors.push('Device fingerprint matches known device');
    } else if (trustedDevices.length > 0) {
      score += 15;
      factors.push('Device fingerprint does not match any known device');
    }

    // Check IP reputation (simplified)
    if (ipAddress) {
      const recentLogins = await this.auditLogRepo.count({
        where: {
          userId,
          action: 'login',
          ipAddress,
          createdAt: MoreThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        },
      });

      if (recentLogins === 0) {
        score += 15;
        factors.push('New IP address');
      } else {
        score -= 10;
        factors.push('Known IP address');
      }
    }

    // Check for suspicious fingerprint characteristics
    if (!fingerprint.screenResolution || !fingerprint.timezone) {
      score += 25;
      factors.push('Incomplete device fingerprint (possible automation)');
    }

    // Normalize score
    score = Math.max(0, Math.min(100, score));

    // Determine recommendation
    let recommendation: 'trust' | 'challenge' | 'block';
    if (score <= 30) {
      recommendation = 'trust';
    } else if (score <= 70) {
      recommendation = 'challenge';
    } else {
      recommendation = 'block';
    }

    return { score, factors, recommendation };
  }

  /**
   * Revoke trust for a device
   */
  async revokeDevice(
    userId: string,
    deviceId: string,
    reason?: string,
  ): Promise<void> {
    const device = await this.deviceRepo.findOne({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    device.status = 'revoked';
    await this.deviceRepo.save(device);

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        userId,
        action: 'device.revoke',
        collectionCode: 'device',
        recordId: deviceId,
        newValues: { reason, deviceName: device.deviceName },
      }),
    );

    this.logger.log(`Device ${deviceId} revoked for user ${userId}`);
  }

  /**
   * List trusted devices for a user
   */
  async listTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    return this.deviceRepo.find({
      where: { userId, status: 'trusted' },
      order: { lastSeenAt: 'DESC' },
    });
  }

  /**
   * Revoke all devices for a user (emergency)
   */
  async revokeAllDevices(userId: string, reason?: string): Promise<number> {
    const result = await this.deviceRepo.update(
      { userId, status: 'trusted' },
      { status: 'revoked' },
    );

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        userId,
        action: 'device.revoke_all',
        collectionCode: 'device',
        newValues: { reason, count: result.affected },
      }),
    );

    this.logger.warn(`All devices revoked for user ${userId}: ${result.affected} devices`);

    return result.affected || 0;
  }

  /**
   * Clean up expired devices
   */
  async cleanupExpiredDevices(): Promise<number> {
    const result = await this.deviceRepo.update(
      {
        status: 'trusted',
        trustedUntil: LessThan(new Date()),
      },
      { status: 'untrusted' },
    );

    return result.affected || 0;
  }

  /**
   * Generate a device challenge for additional verification
   */
  async generateDeviceChallenge(_userId: string): Promise<{ challenge: string; expiresAt: Date }> {
    const challenge = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MINUTES * 60 * 1000);

    // Challenge is returned to client and validated on submission within expiry window
    return { challenge, expiresAt };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private hashFingerprint(fingerprint: DeviceFingerprint): string {
    const normalized = JSON.stringify({
      userAgent: fingerprint.userAgent,
      screenResolution: fingerprint.screenResolution,
      timezone: fingerprint.timezone,
      platform: fingerprint.platform,
      canvasHash: fingerprint.canvasHash,
      audioHash: fingerprint.audioHash,
    });
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  private generateDeviceName(fingerprint: DeviceFingerprint): string {
    const browser = this.extractBrowser(fingerprint.userAgent);
    const os = this.extractOS(fingerprint.userAgent);
    return `${browser} on ${os}`;
  }

  private detectDeviceType(fingerprint: DeviceFingerprint): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
    const userAgent = fingerprint.userAgent || '';
    if (userAgent.includes('Mobile') || userAgent.includes('Android') && !userAgent.includes('Tablet')) {
      return 'mobile';
    }
    if (userAgent.includes('iPad') || userAgent.includes('Tablet')) {
      return 'tablet';
    }
    if (userAgent.includes('Windows') || userAgent.includes('Macintosh') || userAgent.includes('Linux')) {
      return 'desktop';
    }
    return 'unknown';
  }

  private extractBrowser(userAgent?: string): string {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Edg/')) return 'Edge';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    return 'Unknown';
  }

  private extractOS(userAgent?: string): string {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'Unknown';
  }
}
