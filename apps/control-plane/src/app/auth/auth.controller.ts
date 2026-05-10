import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, CookieOptions } from 'express';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto, RegisterDto, ChangePasswordDto, UpdateProfileDto, VerifyMfaDto } from './auth.dto';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { CurrentUser, CurrentUserData } from './current-user.decorator';

/**
 * F089 (W1 task 10): refresh token lives in an HttpOnly cookie, not in
 * the response body. The cookie is scoped to the auth path so it
 * accompanies refresh requests but doesn't ride every API call. The
 * response body still includes `refreshToken` during the W1 transition
 * so the frontend's interceptor can switch over without a synchronized
 * deploy; once frontend cuts over, the body field can be removed.
 */
const REFRESH_COOKIE_NAME = 'control_plane_refresh';
const REFRESH_COOKIE_PATH = '/api/auth';

function buildRefreshCookieOptions(req: Request, maxAgeSeconds: number): CookieOptions {
  const isHttps = req.protocol === 'https' || req.secure;
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeSeconds * 1000,
  };
}

function setRefreshCookie(res: Response, req: Request, refreshToken: string, expiresAt: string): void {
  const expiryMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const maxAgeSeconds = Math.max(60, Math.floor(expiryMs / 1000));
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, buildRefreshCookieOptions(req, maxAgeSeconds));
}

function clearRefreshCookie(res: Response, req: Request): void {
  // clearCookie must use matching path + sameSite + secure as set; pass
  // the same options shape (sans maxAge — irrelevant for clear).
  const opts = buildRefreshCookieOptions(req, 0);
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
  });
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.authService.login(
      dto,
      ipAddress,
      typeof ua === 'string' ? ua : undefined,
    );
    if (result?.refreshToken && result?.refreshExpiresAt) {
      setRefreshCookie(res, req, result.refreshToken, result.refreshExpiresAt);
    }
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const ua = req.headers['user-agent'];
    // Prefer the HttpOnly cookie (set on login). Fall back to the body
    // during the W1 transition so older frontends keep working until
    // they cut over to the in-memory pattern.
    const cookieToken =
      typeof (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE_NAME] === 'string'
        ? (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE_NAME]
        : undefined;
    const refreshTokenInput = cookieToken ?? body?.refreshToken ?? '';
    const result = await this.authService.refresh(refreshTokenInput, {
      ipAddress,
      userAgent: typeof ua === 'string' ? ua : undefined,
    });
    if (result?.refreshToken && result?.refreshExpiresAt) {
      // Rotate the cookie to the new refresh token (refresh-token rotation).
      setRefreshCookie(res, req, result.refreshToken, result.refreshExpiresAt);
    }
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    clearRefreshCookie(res, req);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const correlationId = req.headers['x-correlation-id'];

    await this.authService.revokeToken({
      userId: user.id,
      jti: user.jti,
      expiresAt: user.tokenExpiresAt,
      family: user.family ?? null,
      ipAddress,
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    });

    await this.auditService.log('auth.logout', {
      userId: user.id,
      resourceType: 'auth',
      resourceId: user.id,
      result: 'success',
      ipAddress,
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      requestId: typeof correlationId === 'string' ? correlationId : undefined,
      details: {
        actor: user.email,
        actorType: 'user',
        jti: user.jti,
      },
    });
  }

  @Roles('admin')
  @Post('register')
  async register(@Body() dto: RegisterDto, @CurrentUser('id') userId: string) {
    const user = await this.authService.register(dto, userId);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  @Get('me')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Put('me')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() data: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, data);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() data: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, data);
    return { message: 'Password changed successfully' };
  }

  @Post('mfa/setup')
  async setupMfa(@CurrentUser('id') userId: string) {
    return this.authService.enableMfa(userId);
  }

  @Post('mfa/verify')
  async verifyMfa(@CurrentUser('id') userId: string, @Body() dto: VerifyMfaDto) {
    return this.authService.verifyMfa(userId, dto);
  }

  @Post('mfa/disable')
  async disableMfa(@CurrentUser('id') userId: string, @Body() dto: VerifyMfaDto) {
    return this.authService.disableMfa(userId, dto);
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
