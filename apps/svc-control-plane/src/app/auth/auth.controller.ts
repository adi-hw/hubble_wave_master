import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto, RegisterDto, ChangePasswordDto, UpdateProfileDto, VerifyMfaDto } from './auth.dto';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { CurrentUser, CurrentUserData } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.authService.login(
      dto,
      ipAddress,
      typeof ua === 'string' ? ua : undefined,
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.authService.refresh(body?.refreshToken ?? '', {
      ipAddress,
      userAgent: typeof ua === 'string' ? ua : undefined,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ): Promise<void> {
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
