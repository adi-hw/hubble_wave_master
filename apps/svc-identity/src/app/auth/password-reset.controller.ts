import { BadRequestException, Controller, Post, Body, Req } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import * as argon2 from 'argon2';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { TenantDbService, extractTenantSlug } from '@eam-platform/tenant-db';

@Controller('auth/password')
export class PasswordResetController {
  constructor(
    private passwordResetService: PasswordResetService,
    private readonly tenantDbService: TenantDbService
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot')
  async forgotPassword(@Req() req: any, @Body() body: { email: string; tenantSlug?: string }) {
    const tenantSlug = body.tenantSlug || extractTenantSlug(req.headers.host || '');
    if (!tenantSlug) {
      throw new BadRequestException('Tenant could not be determined');
    }
    const tenant = await this.tenantDbService.getTenantOrThrow(tenantSlug);
    // Always return success to prevent email enumeration
    const result = await this.passwordResetService.createResetToken(body.email, tenant.id);

    if (result) {
      await this.passwordResetService.sendResetEmail(
        body.email,
        result.token,
        tenantSlug
      );
    }

    return {
      message: 'If an account exists with that email, a password reset link has been sent.',
    };
  }

  @Public()
  @Post('reset')
  async resetPassword(@Req() req: any, @Body() body: { token: string; newPassword: string; tenantSlug?: string }) {
    const tenantSlug = body.tenantSlug || extractTenantSlug(req.headers.host || '');
    if (!tenantSlug) {
      throw new BadRequestException('Tenant could not be determined');
    }
    const tenant = await this.tenantDbService.getTenantOrThrow(tenantSlug);
    // Validate token
    const user = await this.passwordResetService.validateResetToken(tenant.id, body.token);

    if (!user) {
      return {
        success: false,
        message: 'Invalid or expired reset token',
      };
    }

    // Hash new password
    const passwordHash = await argon2.hash(body.newPassword);

    // Use token and update password
    const success = await this.passwordResetService.useResetToken(tenant.id, body.token, passwordHash);

    if (!success) {
      return {
        success: false,
        message: 'Failed to reset password',
      };
    }

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  @Public()
  @Post('validate-token')
  async validateToken(@Req() req: any, @Body() body: { token: string; tenantSlug?: string }) {
    const tenantSlug = body.tenantSlug || extractTenantSlug(req.headers.host || '');
    if (!tenantSlug) {
      throw new BadRequestException('Tenant could not be determined');
    }
    const tenant = await this.tenantDbService.getTenantOrThrow(tenantSlug);
    const user = await this.passwordResetService.validateResetToken(tenant.id, body.token);

    return {
      valid: !!user,
    };
  }
}
