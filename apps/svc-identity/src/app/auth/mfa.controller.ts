import { Controller, Post, Get, Body, UseGuards, Req, Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedRequest } from '@hubblewave/auth-guard';
import { MfaService } from './mfa.service';

@Controller('auth/mfa')
@UseGuards(AuthGuard('jwt'))
export class MfaController {
  constructor(private mfaService: MfaService) {}

  @Get('status')
  async getStatus(@Req() req: AuthenticatedRequest) {
    return this.mfaService.getMfaStatus(req.user.userId);
  }

  @Get('setup')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async setup(@Req() req: AuthenticatedRequest) {
    // This is an alias for enrollTotp that starts the MFA enrollment process
    const result = await this.mfaService.enrollTotp(
      req.user.userId,
      'HubbleWave Platform'
    );

    return {
      qrCode: result.qrCode,
      secret: result.secret,
      recoveryCodes: result.recoveryCodes,
      message: 'Scan the QR code with your authenticator app and verify with a code',
    };
  }

  @Post('enroll/totp')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 enrollments per minute
  async enrollTotp(@Req() req: AuthenticatedRequest, @Body() body: { appName?: string }) {
    const result = await this.mfaService.enrollTotp(
      req.user.userId,
      body.appName || 'HubbleWave Platform'
    );

    return {
      qrCode: result.qrCode,
      recoveryCodes: result.recoveryCodes,
      message: 'Scan the QR code with your authenticator app and verify with a code',
    };
  }

  @Post('verify/enrollment')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 verification attempts per minute (prevents TOTP brute force)
  async verifyEnrollment(@Req() req: AuthenticatedRequest, @Body() body: { token: string }) {
    const isValid = await this.mfaService.verifyTotpEnrollment(
      req.user.userId,
      body.token
    );

    if (!isValid) {
      return { success: false, message: 'Invalid code' };
    }

    return {
      success: true,
      message: 'MFA enabled successfully',
    };
  }

  @Delete('disable')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 disable attempts per minute
  async disable(@Req() req: AuthenticatedRequest) {
    await this.mfaService.disableMfa(req.user.userId);
    return { message: 'MFA disabled successfully' };
  }
}
