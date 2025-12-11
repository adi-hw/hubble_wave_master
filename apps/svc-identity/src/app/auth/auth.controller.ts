import { Controller, Post, Body, UseGuards, Req, Get, Logger, UnauthorizedException, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { ApiTags } from '@nestjs/swagger';
import { extractTenantSlug } from '@eam-platform/tenant-db';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantDbService } from '@eam-platform/tenant-db';
import { UserAccount, TenantUserMembership } from '@eam-platform/platform-db';
import { AuthenticatedRequest, PublicRequest } from '@eam-platform/auth-guard';
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
    private readonly tenantDbService: TenantDbService,
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
    const tenantSlugFromHost = extractTenantSlug(req.headers.host);
    const headerSlug = req.headers['x-tenant-slug'];
    const allowFallback = process.env.ALLOW_DEFAULT_TENANT_FALLBACK === 'true';
    const defaultSlug = process.env.DEFAULT_TENANT_SLUG || 'acme';
    const resolvedSlugFromRequest =
      loginDto.tenantSlug || req?.tenant?.slug || headerSlug || tenantSlugFromHost;
    const usingDefaultFallback = !resolvedSlugFromRequest && !!defaultSlug;

    if (!resolvedSlugFromRequest && !allowFallback) {
      this.logger.error('No tenant slug resolved in login request');
      throw new UnauthorizedException('Tenant could not be determined from request');
    }

    if (usingDefaultFallback && allowFallback) {
      // Should be rare; signals missing tenant context in request rather than intentional default
      this.logger.warn('No tenant slug resolved, using default', { defaultSlug });
    }

    const resolvedSlug = resolvedSlugFromRequest || defaultSlug;

    const normalizedDto: LoginDto = {
      ...loginDto,
      tenantSlug: resolvedSlug,
    };
    const result = await this.authService.login(normalizedDto, req.ip, req.headers['user-agent']);

    if (this.useRefreshCookie && result.refreshToken) {
      // In development (localhost), cookies must NOT be secure to work over HTTP
      const isProduction = process.env.NODE_ENV === 'production';
      const secure = isProduction || process.env.REFRESH_COOKIE_SECURE === 'true';
      const sameSite: SameSiteOption = (process.env.REFRESH_COOKIE_SAMESITE as SameSiteOption) || 'lax';
      this.logger.debug(`Setting refresh cookie: secure=${secure}, sameSite=${sameSite}, path=${this.cookiePath}`);
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
    const tenantSlugFromHost = extractTenantSlug(req.headers.host);
    const headerSlug = req.headers['x-tenant-slug'];
    const allowFallback = process.env.ALLOW_DEFAULT_TENANT_FALLBACK === 'true';
    const defaultSlug = process.env.DEFAULT_TENANT_SLUG || 'acme';
    const resolvedSlugFromRequest = req?.tenant?.slug || headerSlug || tenantSlugFromHost;
    const usingDefaultFallback = !resolvedSlugFromRequest && !!defaultSlug;

    if (!resolvedSlugFromRequest && !allowFallback) {
      this.logger.error('No tenant slug resolved in refresh request');
      throw new UnauthorizedException('Tenant could not be determined from request');
    }

    if (usingDefaultFallback && allowFallback) {
      this.logger.warn('No tenant slug resolved for refresh, using default', { defaultSlug });
    }

    const resolvedSlug = resolvedSlugFromRequest || defaultSlug;

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
      // If it's already an UnauthorizedException, rethrow it
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Log unexpected errors and return a generic auth error to avoid 500
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
      req.user.tenantId,
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
      req.user.tenantId,
      req.user.userId,
      body.currentPassword,
      body.newPassword
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle() // Profile endpoint called frequently after login
  async getProfile(@Req() req: AuthenticatedRequest): Promise<UserProfileDto> {
    const { userId, tenantId, roles, permissions } = req.user;
    if (!userId || !tenantId) {
      throw new UnauthorizedException('Invalid user context');
    }

    const userRepo = await this.tenantDbService.getRepository<UserAccount>(tenantId, UserAccount as any);
    const membershipRepo = await this.tenantDbService.getRepository<TenantUserMembership>(tenantId, TenantUserMembership as any);
    const user = await userRepo.findOne({ where: { id: userId } });
    const membership = await membershipRepo.findOne({ where: { tenantId, userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('Membership not active');
    }

    return {
      id: user.id,
      username: user.displayName || user.primaryEmail,
      tenantId,
      roles: roles ?? [],
      permissions: permissions ?? [],
      displayName: user.displayName,
      email: user.primaryEmail,
    };
  }
}
