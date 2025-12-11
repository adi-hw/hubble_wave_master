import { Controller, Post, Get, Body, UseGuards, Req, Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { MfaService } from './mfa.service';

@Controller('auth/mfa')
@UseGuards(AuthGuard('jwt'))
export class MfaController {
  constructor(private mfaService: MfaService) {}

  @Get('status')
  async getStatus(@Req() req: any) {
    return this.mfaService.getMfaStatus(req.user.tenantId, req.user.userId);
  }

  @Post('enroll/totp')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 enrollments per minute
  async enrollTotp(@Req() req: any, @Body() body: { appName?: string }) {
    const result = await this.mfaService.enrollTotp(
      req.user.tenantId,
      req.user.userId,
      body.appName || 'EAM Platform'
    );

    return {
      qrCode: result.qrCode,
      recoveryCodes: result.recoveryCodes,
      message: 'Scan the QR code with your authenticator app and verify with a code',
    };
  }

  @Post('verify/enrollment')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 verification attempts per minute (prevents TOTP brute force)
  async verifyEnrollment(@Req() req: any, @Body() body: { token: string }) {
    const isValid = await this.mfaService.verifyTotpEnrollment(
      req.user.tenantId,
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
  async disable(@Req() req: any) {
    await this.mfaService.disableMfa(req.user.tenantId, req.user.userId);
    return { message: 'MFA disabled successfully' };
  }
}
