import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User, AuthSettings, MfaMethod } from '@hubblewave/instance-db';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenService } from './refresh-token.service';
import { AuthEventsService } from './auth-events.service';
import { PermissionResolverService } from './permission-resolver.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuthSettings)
    private readonly authSettingsRepo: Repository<AuthSettings>,
    @InjectRepository(MfaMethod)
    private readonly mfaMethodRepo: Repository<MfaMethod>,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly authEventsService: AuthEventsService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  private async checkAccountLockout(user: User): Promise<void> {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      throw new UnauthorizedException(
        `Account is locked due to too many failed login attempts. Please try again in ${minutesRemaining} minute(s).`
      );
    }

    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await this.userRepo.update(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: undefined,
      });
    }
  }

  private async handleFailedLogin(user: User, settings?: AuthSettings): Promise<void> {
    const maxAttempts = settings?.maxFailedAttempts ?? 5;
    const lockoutMinutes = settings?.lockoutDurationMinutes ?? 30;

    const newAttempts = (user.failedLoginAttempts || 0) + 1;

    const updates: {
      failedLoginAttempts: number;
      lastFailedLoginAt: Date;
      lockedUntil?: Date;
    } = {
      failedLoginAttempts: newAttempts,
      lastFailedLoginAt: new Date(),
    };

    if (newAttempts >= maxAttempts) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + lockoutMinutes);
      updates.lockedUntil = lockUntil;

      this.logger.warn(`Account locked due to failed login attempts`, {
        userId: user.id,
        attempts: newAttempts,
        lockedUntil: lockUntil,
      });
    }

    await this.userRepo.update(user.id, updates);
  }

  private async isMfaEnabled(userId: string): Promise<boolean> {
    const method = await this.mfaMethodRepo.findOne({
      where: { userId, verified: true, enabled: true },
    });
    return !!method;
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { username, password } = dto;
    this.logger.log('Login attempt', { username });

    try {
      const settings = await this.authSettingsRepo.findOne({ where: {}, order: { createdAt: 'DESC' } });

      const user = await this.userRepo.findOne({
        where: { email: username },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.status !== 'active') {
        if (user.status === 'invited') {
          throw new UnauthorizedException('Account not activated');
        }
        throw new UnauthorizedException('Account is not active');
      }

      await this.checkAccountLockout(user);

      if (!user.passwordHash) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await argon2.verify(user.passwordHash, password);
      if (!isPasswordValid) {
        await this.handleFailedLogin(user, settings || undefined);
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
        await this.userRepo.update(user.id, {
          failedLoginAttempts: 0,
          lockedUntil: undefined,
          lastFailedLoginAt: undefined,
        });
      }

      const mfaEnabled = await this.isMfaEnabled(user.id);
      if (mfaEnabled && !dto.mfaToken) {
        return {
          mfaRequired: true,
          message: 'MFA verification required',
        };
      }

      const { roleNames, permissions } = await this.resolveRolesAndPermissions(user.id);

      const payload = {
        sub: user.id,
        username: user.displayName || user.email,
        roles: roleNames,
        permissions: Array.from(permissions),
        is_admin: roleNames.includes('admin') || roleNames.includes('super_admin'),
      };

      const accessToken = this.jwtService.sign(payload);

      const { token: refreshToken } = await this.refreshTokenService.createRefreshToken(
        user.id,
        ipAddress,
        userAgent
      );

      await this.authEventsService.record({
        eventType: 'LOGIN_SUCCESS',
        success: true,
        userId: user.id,
        ipAddress,
        userAgent,
      });

      await this.userRepo.update(user.id, {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: 900,
        user: {
          id: user.id,
          username: user.displayName || user.email,
          email: user.email,
          displayName: user.displayName,
          roles: roleNames,
          permissions: Array.from(permissions),
          isAdmin: roleNames.includes('admin'),
        },
      };
    } catch (error) {
      await this.authEventsService.record({
        eventType: 'LOGIN_FAILED',
        success: false,
        userId: undefined,
        ipAddress,
        userAgent,
      });
      throw error;
    }
  }

  async logout(userId: string, ipAddress?: string, userAgent?: string) {
    await this.refreshTokenService.revokeAllUserTokens(userId);

    await this.authEventsService.record({
      eventType: 'LOGOUT',
      success: true,
      userId,
      ipAddress,
      userAgent,
    });

    return { success: true };
  }

  async refreshAccessToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenEntity = await this.refreshTokenService.findByToken(refreshToken);

    if (!tokenEntity) {
      await this.authEventsService.record({
        eventType: 'REFRESH_FAILED',
        success: false,
        userId: undefined,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (tokenEntity.isRevoked || (tokenEntity.expiresAt && tokenEntity.expiresAt < new Date())) {
      await this.authEventsService.record({
        eventType: 'REFRESH_FAILED',
        success: false,
        userId: tokenEntity.userId,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepo.findOne({
      where: { id: tokenEntity.userId },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User not found or inactive');
    }

    const { roleNames, permissions } = await this.resolveRolesAndPermissions(user.id);

    const rotated = await this.refreshTokenService.rotateRefreshToken(
      refreshToken,
      ipAddress,
      userAgent
    );

    if (!rotated) {
      throw new UnauthorizedException('Failed to rotate refresh token');
    }

    const payload = {
      sub: user.id,
      username: user.displayName || user.email,
      roles: roleNames,
      permissions: Array.from(permissions),
      is_admin: roleNames.includes('admin'),
    };

    const accessToken = this.jwtService.sign(payload);

    await this.authEventsService.record({
      eventType: 'REFRESH_SUCCESS',
      success: true,
      userId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken: rotated.token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { roleNames, permissions } = await this.resolveRolesAndPermissions(userId);

    return {
      id: user.id,
      username: user.displayName || user.email,
      email: user.email,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: roleNames,
      permissions: Array.from(permissions),
      isAdmin: roleNames.includes('admin'),
    };
  }

  private async resolveRolesAndPermissions(userId: string) {
    const cached = await this.permissionResolver.getUserPermissions(userId);
    const roleNames = cached.roles.map((r) => r.code || r.name);
    const permissions = cached.permissions;
    return { roleNames, permissions };
  }
}
