import { Controller, Post, Body, UseGuards, Req, Get, Logger, UnauthorizedException, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedRequest, PublicRequest } from '@hubblewave/auth-guard';
import { UserProfileDto } from './dto/user-profile.dto';
import { Response, Request } from 'express';

type SameSiteOption = 'lax' | 'strict' | 'none';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly useRefreshCookie = process.env.USE_REFRESH_TOKEN_COOKIE !== 'false';
  private readonly cookiePath = process.env.REFRESH_COOKIE_PATH || '/';

  constructor(
    private readonly authService: AuthService,
  ) {}

  private parseRefreshFromCookie(req: Request): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> })?.cookies;
    if (cookies?.refreshToken) return cookies.refreshToken;
    const raw = req?.headers?.cookie;
    if (!raw) return undefined;
    const parts = raw.split(';').map((p) => p.trim());
    for (const part of parts) {
      if (part.startsWith('refreshToken=')) {
        return decodeURIComponent(part.substring('refreshToken='.length));
      }
    }
    return undefined;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Req() req: PublicRequest, @Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const resolvedSlug = loginDto.tenantSlug || process.env.DEFAULT_INSTANCE_SLUG || 'default';

    const normalizedDto: LoginDto = {
      ...loginDto,
      tenantSlug: resolvedSlug,
    };
    const result = await this.authService.login(normalizedDto, req.ip, req.headers['user-agent']);

    if (this.useRefreshCookie && result.refreshToken) {
      const isProduction = process.env.NODE_ENV === 'production';
      const secure = isProduction || process.env.REFRESH_COOKIE_SECURE === 'true';
      const sameSite: SameSiteOption = (process.env.REFRESH_COOKIE_SAMESITE as SameSiteOption) || 'lax';
      
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure,
        sameSite,
        path: this.cookiePath,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 refreshes per minute
  @Post('refresh')
  async refresh(@Req() req: PublicRequest, @Body() body: { refreshToken?: string }, @Res({ passthrough: true }) res: Response) {
    const resolvedSlug = process.env.DEFAULT_INSTANCE_SLUG || 'default';

    const refreshToken = body.refreshToken || this.parseRefreshFromCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    try {
      const result = await this.authService.refreshAccessToken(
        refreshToken,
        resolvedSlug,
        req.ip,
        req.headers['user-agent'],
      );

      if (this.useRefreshCookie && result.refreshToken) {
        const isProduction = process.env.NODE_ENV === 'production';
        const secure = isProduction || process.env.REFRESH_COOKIE_SECURE === 'true';
        const sameSite: SameSiteOption = (process.env.REFRESH_COOKIE_SAMESITE as SameSiteOption) || 'lax';
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure,
          sameSite,
          path: this.cookiePath,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Unexpected error during token refresh', {
        error: (error as Error)?.message,
        stack: (error as Error)?.stack,
        tenantSlug: resolvedSlug,
      });
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const response = await this.authService.logout(
      req.user.userId,
      req.ip,
      req.headers['user-agent'],
    );
    if (this.useRefreshCookie) {
      const isProduction = process.env.NODE_ENV === 'production';
      const secure = isProduction || process.env.REFRESH_COOKIE_SECURE === 'true';
      const sameSite: SameSiteOption = (process.env.REFRESH_COOKIE_SAMESITE as SameSiteOption) || 'lax';
      res.cookie('refreshToken', '', {
        httpOnly: true,
        secure,
        sameSite,
        path: this.cookiePath,
        expires: new Date(0),
      });
    }
    return response;
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
  async changePassword(@Req() req: AuthenticatedRequest, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword
    );
  }

  /**
   * Change password for expired password (no auth required, uses current credentials)
   */
  @Public()
  @Post('change-password-expired')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
  async changeExpiredPassword(
    @Body() body: { username: string; currentPassword: string; newPassword: string },
  ) {
    return this.authService.changeExpiredPassword(
      body.username,
      body.currentPassword,
      body.newPassword
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle() // Profile endpoint called frequently after login
  async getProfile(@Req() req: AuthenticatedRequest): Promise<UserProfileDto> {
    const { userId } = req.user;
    if (!userId) {
      throw new UnauthorizedException('Invalid user context');
    }

    const profile = await this.authService.getProfile(userId);

    return {
      id: profile.id,
      username: profile.username,
      roles: profile.roles,
      permissions: profile.permissions,
      displayName: profile.displayName,
      email: profile.email,
    };
  }
}
