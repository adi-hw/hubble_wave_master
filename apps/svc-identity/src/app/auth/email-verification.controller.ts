import { BadRequestException, Controller, Post, Body, Get, Query, Req } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service';
import { TenantDbService, extractTenantSlug } from '@eam-platform/tenant-db';

@Controller('auth/email')
export class EmailVerificationController {
  constructor(
    private emailVerificationService: EmailVerificationService,
    private readonly tenantDbService: TenantDbService
  ) {}

  @Post('verify')
  async verifyEmail(@Req() req: any, @Body() body: { token: string; tenantSlug?: string }) {
    const tenantSlug = body.tenantSlug || extractTenantSlug(req.headers.host || '');
    if (!tenantSlug) {
      throw new BadRequestException('Tenant could not be determined');
    }
    const tenant = await this.tenantDbService.getTenantOrThrow(tenantSlug);
    const success = await this.emailVerificationService.verifyEmail(tenant.id, body.token);

    if (!success) {
      return {
        success: false,
        message: 'Invalid or expired verification token',
      };
    }

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  @Get('resend')
  async resendVerification(
    @Req() req: any,
    @Query('userId') userId: string,
    @Query('tenantSlug') tenantSlug?: string,
  ) {
    const slug = tenantSlug || extractTenantSlug(req.headers.host || '');
    if (!slug) {
      throw new BadRequestException('Tenant could not be determined');
    }
    const tenant = await this.tenantDbService.getTenantOrThrow(slug);
    try {
      await this.emailVerificationService.resendVerification(tenant.id, userId);
      
      // Get user to send email (in real app, fetch from DB)
      // For now, just return success
      return {
        success: true,
        message: 'Verification email sent',
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }
}
