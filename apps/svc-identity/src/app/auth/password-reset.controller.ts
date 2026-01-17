import { BadRequestException, Controller, Post, Get, Body, Query } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { PasswordValidationService } from './password-validation.service';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';

@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(
    private passwordResetService: PasswordResetService,
    private readonly passwordValidationService: PasswordValidationService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot')
  async forgotPassword(@Body() body: { email: string }) {
    // Always return success to prevent email enumeration
    const result = await this.passwordResetService.createResetToken(body.email);

    if (result) {
      await this.passwordResetService.sendResetEmail(body.email, result.token);
    }

    return {
      message: 'If an account exists with that email, a password reset link has been sent.',
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 validations per minute
  @Get('validate')
  async validateTokenGet(@Query('token') token: string) {
    if (!token) {
      return { valid: false, code: 'MISSING_TOKEN', message: 'Token is required' };
    }

    const user = await this.passwordResetService.validateResetToken(token);

    if (!user) {
      return { valid: false, code: 'TOKEN_EXPIRED', message: 'Invalid or expired reset token' };
    }

    return { valid: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 validations per minute
  @Post('validate')
  async validateTokenPost(@Body() body: { token: string }) {
    const user = await this.passwordResetService.validateResetToken(body.token);

    return {
      valid: !!user,
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 reset attempts per minute
  @Post('confirm')
  async confirmReset(@Body() body: { token: string; newPassword: string }) {
    // Validate token
    const user = await this.passwordResetService.validateResetToken(body.token);

    if (!user) {
      return {
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Invalid or expired reset token',
      };
    }

    // Validate password against policy and blocklist
    const validationResult = await this.passwordValidationService.validatePassword(
      body.newPassword,
      { email: user.email, displayName: user.displayName },
    );

    if (!validationResult.valid) {
      throw new BadRequestException({
        message: 'Password does not meet requirements',
        errors: validationResult.errors,
      });
    }

    // Use token and update password
    const success = await this.passwordResetService.useResetToken(body.token, body.newPassword);

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

  /**
   * Reset password using token (alias for confirmReset)
   */
  @Public()
  @Post('reset')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.confirmReset(body);
  }
}
