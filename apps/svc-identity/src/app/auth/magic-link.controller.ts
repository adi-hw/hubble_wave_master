/**
 * Magic Link Controller
 * HubbleWave Platform - Phase 1
 *
 * REST endpoints for passwordless email-based authentication.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MagicLinkService } from './magic-link.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuthEventsService } from './auth-events.service';

interface RequestWithUser {
  ip?: string;
  headers: {
    'user-agent'?: string;
  };
}

interface EmailServiceInterface {
  sendMagicLink(email: string, link: string, expiresAt: Date): Promise<void>;
}

@Controller('auth/magic-link')
export class MagicLinkController {
  constructor(
    private readonly magicLinkService: MagicLinkService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly authEventsService: AuthEventsService,
    @Inject('EMAIL_SERVICE') private readonly emailService: EmailServiceInterface,
  ) {}

  /**
   * Request a magic link for passwordless login
   */
  @Post('request')
  @HttpCode(HttpStatus.OK)
  async requestMagicLink(
    @Request() req: RequestWithUser,
    @Body() body: { email: string; redirectUrl?: string },
  ) {
    const result = await this.magicLinkService.generateMagicLink(
      body.email,
      req.ip,
      req.headers['user-agent'],
      body.redirectUrl,
    );

    // Send email with magic link
    const magicLinkUrl = `${process.env['APP_URL'] || 'http://localhost:4200'}/auth/magic-link/verify?token=${result.token}`;

    await this.emailService.sendMagicLink(
      result.email,
      magicLinkUrl,
      result.expiresAt,
    );

    return {
      success: true,
      message: 'Magic link sent to your email',
      expiresAt: result.expiresAt,
    };
  }

  /**
   * Verify magic link and complete authentication
   */
  @Get('verify')
  @HttpCode(HttpStatus.OK)
  async verifyMagicLink(
    @Request() req: RequestWithUser,
    @Query('token') token: string,
  ) {
    const result = await this.magicLinkService.verifyMagicLink(
      token,
      req.ip,
      req.headers['user-agent'],
    );

    // Generate tokens
    const payload = {
      sub: result.user.id,
      username: result.user.displayName || result.user.email,
      email: result.user.email,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.refreshTokenService.createRefreshToken(
      result.user.id,
      req.ip,
      req.headers['user-agent'],
    );

    await this.authEventsService.record({
      userId: result.user.id,
      eventType: 'login',
      success: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      accessToken,
      refreshToken: refreshToken.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
      },
      redirectUrl: result.redirectUrl,
    };
  }

  /**
   * Check magic link status (for UI polling)
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getMagicLinkStatus(@Query('email') email: string) {
    const status = await this.magicLinkService.getPendingLinkStatus(email);

    return {
      hasPending: status.hasPending,
      expiresAt: status.expiresAt,
    };
  }

  /**
   * Revoke pending magic links for an email
   */
  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  async revokePendingLinks(@Body() body: { email: string }) {
    const count = await this.magicLinkService.revokePendingLinks(body.email);

    return {
      success: true,
      revokedCount: count,
    };
  }
}
