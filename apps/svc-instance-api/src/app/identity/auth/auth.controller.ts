import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Logger,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Public, JwtAuthGuard, AuthenticatedRequest, PublicRequest } from '@hubblewave/auth-guard';
import { Response, Request } from 'express';

type SameSiteOption = 'lax' | 'strict' | 'none';

@Controller('identity/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly useRefreshCookie = process.env.USE_REFRESH_TOKEN_COOKIE !== 'false';
  private readonly cookiePath = process.env.REFRESH_COOKIE_PATH || '/';

  constructor(private readonly authService: AuthService) {}

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
  async login(
    @Req() req: PublicRequest,
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.login(
      loginDto,
      req.ip,
      req.headers['user-agent']
    );

    if (this.useRefreshCookie && result.refreshToken) {
      const isProduction = process.env.NODE_ENV === 'production';
      const secure = isProduction || process.env.REFRESH_COOKIE_SECURE === 'true';
      const sameSite: SameSiteOption =
        (process.env.REFRESH_COOKIE_SAMESITE as SameSiteOption) || 'lax';

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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  async refresh(
    @Req() req: PublicRequest,
    @Body() body: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = body.refreshToken || this.parseRefreshFromCookie(req as Request);

    if (!refreshToken) {
      this.logger.warn('Refresh token missing from both body and cookies');
      throw new UnauthorizedException('Refresh token missing');
    }

    try {
      const result = await this.authService.refreshAccessToken(
        refreshToken,
        req.ip,
        req.headers['user-agent']
      );

      if (this.useRefreshCookie && result.refreshToken) {
        const isProduction = process.env.NODE_ENV === 'production';
        const secure = isProduction || process.env.REFRESH_COOKIE_SECURE === 'true';
        const sameSite: SameSiteOption =
          (process.env.REFRESH_COOKIE_SAMESITE as SameSiteOption) || 'lax';

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
      });
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response
  ) {
    const response = await this.authService.logout(
      req.user.userId,
      req.ip,
      req.headers['user-agent']
    );

    if (this.useRefreshCookie) {
      const isProduction = process.env.NODE_ENV === 'production';
      const secure = isProduction || process.env.REFRESH_COOKIE_SECURE === 'true';
      const sameSite: SameSiteOption =
        (process.env.REFRESH_COOKIE_SAMESITE as SameSiteOption) || 'lax';

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  async getProfile(@Req() req: AuthenticatedRequest): Promise<UserProfileDto> {
    const { userId } = req.user;
    if (!userId) {
      throw new UnauthorizedException('Invalid user context');
    }

    const profile = await this.authService.getProfile(userId);

    return {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      displayName: profile.displayName,
      roles: profile.roles,
      permissions: profile.permissions,
      isAdmin: profile.isAdmin,
    };
  }
}
