import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { EmailVerificationService } from './email-verification.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

interface AuthenticatedUser {
  id: string;
  userId: string;
  username?: string;
  email?: string;
}

interface VerifyEmailDto {
  token: string;
}

@Controller('auth/email')
export class EmailVerificationController {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  /**
   * Verify email using token (public - no auth required)
   * POST /auth/email/verify
   */
  @Public()
  @Post('verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() body: VerifyEmailDto,
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.emailVerificationService.verifyEmail(body.token);

    return {
      success: true,
      message: `Email ${result.email} has been successfully verified`,
    };
  }

  /**
   * Resend verification email (authenticated)
   * POST /auth/email/resend
   */
  @UseGuards(JwtAuthGuard)
  @Post('resend')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    const userId = user.userId || user.id;
    await this.emailVerificationService.resendVerification(userId);

    return {
      success: true,
      message: 'Verification email sent successfully',
    };
  }

  /**
   * Get email verification status (authenticated)
   * GET /auth/email/status
   */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getVerificationStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    emailVerified: boolean;
    email: string;
    emailVerifiedAt: Date | null;
    canResend: boolean;
    resendAvailableAt: Date | null;
  }> {
    const userId = user.userId || user.id;
    return this.emailVerificationService.getVerificationStatus(userId);
  }
}
