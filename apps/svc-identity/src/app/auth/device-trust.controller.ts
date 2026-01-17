/**
 * Device Trust Controller
 * HubbleWave Platform - Phase 1
 *
 * REST endpoints for managing trusted devices.
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { DeviceTrustService, DeviceFingerprint } from './device-trust.service';

interface RequestWithUser {
  user: {
    sub: string;
    username: string;
  };
  ip?: string;
  headers: {
    'user-agent'?: string;
  };
}

@Controller('auth/devices')
@UseGuards(JwtAuthGuard)
export class DeviceTrustController {
  constructor(private readonly deviceTrustService: DeviceTrustService) {}

  /**
   * Trust the current device
   */
  @Post('trust')
  @HttpCode(HttpStatus.OK)
  async trustDevice(
    @Request() req: RequestWithUser,
    @Body() body: {
      fingerprint: DeviceFingerprint;
      deviceName?: string;
    },
  ) {
    const device = await this.deviceTrustService.trustDevice(req.user.sub, {
      fingerprint: body.fingerprint,
      deviceName: body.deviceName,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      device: {
        id: device.id,
        deviceName: device.deviceName,
        status: device.status,
        trustedUntil: device.trustedUntil,
      },
    };
  }

  /**
   * Check if current device is trusted
   */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  async checkDeviceTrust(
    @Request() req: RequestWithUser,
    @Body() body: { fingerprint: DeviceFingerprint },
  ) {
    const result = await this.deviceTrustService.isDeviceTrusted(
      req.user.sub,
      body.fingerprint,
    );

    return {
      trusted: result.trusted,
      riskScore: result.riskScore,
      device: result.device ? {
        id: result.device.id,
        deviceName: result.device.deviceName,
        lastSeenAt: result.device.lastSeenAt,
      } : undefined,
    };
  }

  /**
   * Assess risk for an unknown device
   */
  @Post('risk-assessment')
  @HttpCode(HttpStatus.OK)
  async assessDeviceRisk(
    @Request() req: RequestWithUser,
    @Body() body: { fingerprint: DeviceFingerprint },
  ) {
    const assessment = await this.deviceTrustService.assessDeviceRisk(
      req.user.sub,
      body.fingerprint,
      req.ip,
    );

    return {
      score: assessment.score,
      factors: assessment.factors,
      recommendation: assessment.recommendation,
    };
  }

  /**
   * List user's trusted devices
   */
  @Get()
  async listTrustedDevices(@Request() req: RequestWithUser) {
    const devices = await this.deviceTrustService.listTrustedDevices(
      req.user.sub,
    );

    return {
      devices: devices.map(d => ({
        id: d.id,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        browser: d.browser,
        os: d.os,
        status: d.status,
        trustScore: d.trustScore,
        lastSeenAt: d.lastSeenAt,
        loginCount: d.loginCount,
        trustedUntil: d.trustedUntil,
        createdAt: d.createdAt,
      })),
    };
  }

  /**
   * Revoke trust for a specific device
   */
  @Delete(':deviceId')
  async revokeDevice(
    @Request() req: RequestWithUser,
    @Param('deviceId') deviceId: string,
    @Body() body: { reason?: string },
  ) {
    await this.deviceTrustService.revokeDevice(
      req.user.sub,
      deviceId,
      body.reason,
    );

    return {
      success: true,
      message: 'Device trust revoked',
    };
  }

  /**
   * Revoke all trusted devices (emergency)
   */
  @Delete()
  async revokeAllDevices(
    @Request() req: RequestWithUser,
    @Body() body: { reason?: string },
  ) {
    const count = await this.deviceTrustService.revokeAllDevices(
      req.user.sub,
      body.reason,
    );

    return {
      success: true,
      revokedCount: count,
      message: `${count} devices revoked`,
    };
  }

  /**
   * Generate a device challenge for additional verification
   */
  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  async generateDeviceChallenge(@Request() req: RequestWithUser) {
    const result = await this.deviceTrustService.generateDeviceChallenge(
      req.user.sub,
    );

    return {
      challenge: result.challenge,
      expiresAt: result.expiresAt,
    };
  }
}
