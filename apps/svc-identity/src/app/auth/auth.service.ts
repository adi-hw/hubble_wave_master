import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  User,
  AuthSettings,
  PasswordHistory,
} from '@hubblewave/instance-db';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenService } from './refresh-token.service';
import { MfaService } from './mfa.service';
import { AuthEventsService } from './auth-events.service';
import { PasswordValidationService } from './password-validation.service';
import { PermissionResolverService } from '../roles/permission-resolver.service';

/**
 * Type-safe user update payload for login-related fields.
 * Uses Pick to ensure only valid User fields can be updated.
 */
type LoginAttemptUpdate = Pick<User, 'failedLoginAttempts' | 'lockedUntil' | 'lastFailedLoginAt'>;

/**
 * OWASP-recommended Argon2id parameters:
 * - memoryCost: 64 MB (65536 KB) - resistant to GPU attacks
 * - timeCost: 3 iterations - balances security/performance
 * - parallelism: 4 threads - utilizes multi-core
 * - hashLength: 32 bytes (256 bits)
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,        // 3 iterations
  parallelism: 4,     // 4 threads
  hashLength: 32,     // 256-bit output
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuthSettings)
    private readonly authSettingsRepo: Repository<AuthSettings>,
    @InjectRepository(PasswordHistory)
    private readonly passwordHistoryRepo: Repository<PasswordHistory>,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly mfaService: MfaService,
    private readonly authEventsService: AuthEventsService,
    private readonly passwordValidationService: PasswordValidationService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  private async validatePasswordHistory(
    userId: string,
    newPassword: string,
    settings?: AuthSettings
  ): Promise<boolean> {
    const historyDepth = settings?.passwordHistoryCount ?? 5;
    if (historyDepth <= 0) {
      return true;
    }

    const history = await this.passwordHistoryRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: historyDepth,
    });

    for (const entry of history) {
      const matches = await argon2.verify(entry.passwordHash, newPassword);
      if (matches) return false;
    }

    return true;
  }

  private async updatePasswordHistory(
    userId: string,
    newPasswordHash: string,
    maxHistory = 5
  ): Promise<void> {
    await this.passwordHistoryRepo.insert({
      userId,
      passwordHash: newPasswordHash,
    });

    const keep = Math.max(maxHistory, 0);
    if (keep > 0) {
      const idsToKeep = await this.passwordHistoryRepo
        .createQueryBuilder('ph')
        .select('ph.id')
        .where('ph.user_id = :userId', { userId })
        .orderBy('ph.created_at', 'DESC')
        .limit(keep)
        .getMany();
      const keepIds = idsToKeep.map((h) => h.id);
      if (keepIds.length > 0) {
        await this.passwordHistoryRepo
          .createQueryBuilder()
          .delete()
          .from(PasswordHistory)
          .where('user_id = :userId', { userId })
          .andWhere('id NOT IN (:...ids)', { ids: keepIds })
          .execute();
      }
    }
  }

  private async checkAccountLockout(
    user: User,
    _settings?: AuthSettings
  ): Promise<void> {
    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      throw new UnauthorizedException(
        `Account is locked due to too many failed login attempts. Please try again in ${minutesRemaining} minute(s).`
      );
    }

    // If lock period expired, reset failed attempts
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await this.userRepo.update(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
    }
  }

  private async handleFailedLogin(user: User, settings?: AuthSettings): Promise<void> {
    const maxAttempts = settings?.maxFailedAttempts ?? 5;
    const lockoutMinutes = settings?.lockoutDurationMinutes ?? 30;

    const newAttempts = (user.failedLoginAttempts || 0) + 1;

    const updates: Partial<LoginAttemptUpdate> = {
      failedLoginAttempts: newAttempts,
      lastFailedLoginAt: new Date(),
    };

    // Lock account if max attempts exceeded
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

  private async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.userRepo.update(userId, {
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      lastFailedLoginAt: undefined,
    });
  }

  private async validateLocalUser(user: User, password: string, settings?: AuthSettings) {
    if (user.status !== 'active') {
      if (user.status === 'invited') {
        throw new UnauthorizedException('Account not activated');
      }
      throw new UnauthorizedException('Account is not active');
    }

    // Check if account is locked
    await this.checkAccountLockout(user, settings);

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      // Record failed attempt and potentially lock account
      await this.handleFailedLogin(user, settings);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
      await this.resetFailedLoginAttempts(user.id);
    }

    return user;
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { username, password } = dto;
    const instanceId = process.env.INSTANCE_ID || 'default-instance';
    this.logger.log('Login attempt', { instanceId, username });

    try {
      // 1. Single-customer deployment (no tenant lookup)

      // 2. specific Auth Settings
      const settings = await this.authSettingsRepo.findOne({ where: {}, order: { createdAt: 'DESC' } });

      // 3. Find User
      const user = await this.userRepo.findOne({
        where: { email: username },
      });
      this.logger.log('User lookup', { userId: user ? user.id : null });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // 4. Validate Credentials
      await this.validateLocalUser(user, password, settings || undefined);

      // 5. MFA Check
      const mfaEnabled = await this.mfaService.isMfaEnabled(user.id); 

      if (mfaEnabled) {
        if (dto.mfaToken) {
          const isValid = await this.mfaService.verifyTotp(
            user.id,
            dto.mfaToken
          );
          if (!isValid) {
            const isRecoveryValid = await this.mfaService.verifyRecoveryCode(
              user.id,
              dto.mfaToken
            );
            if (!isRecoveryValid) {
              throw new UnauthorizedException('Invalid MFA code');
            }
          }
        } else {
          return {
            mfaRequired: true,
            message: 'MFA verification required',
          };
        }
      }

      // 6. Password Expiry Check
      if (settings?.passwordExpiryDays && user.passwordChangedAt) {
        const daysSinceChange = Math.floor(
          (Date.now() - new Date(user.passwordChangedAt).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysSinceChange >= settings.passwordExpiryDays) {
          return {
            passwordExpired: true,
            message: 'Password has expired. Please change your password.',
            userId: user.id,
          };
        }
      }

      // 7. Resolve Roles
      const { roleNames, permissions } = await this.resolveRolesAndPermissionsForUser(user.id);

      // 8. Generate Token
      const payload = {
        sub: user.id,
        username: user.displayName || user.email,
        roles: roleNames,
        permissions: Array.from(permissions),
        is_admin: roleNames.includes('admin') || roleNames.includes('super_admin'),
      };
      
      const accessToken = this.jwtService.sign(payload);

      const { token: refreshToken } =
        await this.refreshTokenService.createRefreshToken(user.id, ipAddress, userAgent);

      await this.authEventsService.record({
        eventType: 'LOGIN_SUCCESS',
        success: true,
        userId: user.id,
        ipAddress: ipAddress,
        userAgent,
      });

      return {
        accessToken,
        refreshToken,
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
        ipAddress: ipAddress,
        userAgent,
      });
      this.logger.error('Login error', error as any);
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

  /**
   * Generate tokens for a user (used by SSO login flows)
   * This bypasses password validation since the user is already authenticated by the IdP
   */
  async generateTokensForUser(user: User, req?: { ip?: string; headers?: { 'user-agent'?: string; 'x-forwarded-for'?: string } }) {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || undefined;
    const userAgent = req?.headers?.['user-agent'];

    // Resolve roles and permissions
    const { roleNames, permissions } = await this.resolveRolesAndPermissionsForUser(user.id);

    // Generate JWT payload
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

    // Record login event
    await this.authEventsService.record({
      eventType: 'SSO_LOGIN_SUCCESS',
      success: true,
      userId: user.id,
      ipAddress,
      userAgent,
    });

    // Calculate expiry (15 minutes from JWT config)
    const expiresIn = 15 * 60; // 15 minutes in seconds

    return {
      accessToken,
      refreshToken,
      expiresIn,
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
  }

  async refreshAccessToken(refreshToken: string, _tenantSlug?: string, ipAddress?: string, userAgent?: string) {
    // 2. Validate Refresh Token
    const tokenEntity = await this.refreshTokenService.findByToken(refreshToken);
    if (!tokenEntity) {
      await this.authEventsService.record({
        eventType: 'REFRESH_FAILED',
        success: false,
        userId: undefined,
        ipAddress: ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (tokenEntity.isRevoked || (tokenEntity.expiresAt && tokenEntity.expiresAt < new Date())) {
      await this.authEventsService.record({
        eventType: 'REFRESH_FAILED',
        success: false,
        userId: tokenEntity.userId,
        ipAddress: ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 3. Find User
    const user = await this.userRepo.findOne({
        where: { id: tokenEntity.userId }
    });

    if (!user || user.status !== 'active') {
       await this.authEventsService.record({
        eventType: 'REFRESH_FAILED',
        success: false,
        userId: tokenEntity.userId,
        ipAddress: ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('User not found or inactive');
    }
    
    // 4. Resolve Roles
    const { roleNames, permissions } = await this.resolveRolesAndPermissionsForUser(user.id);
    
    // 5. Rotate Token
    const rotated = await this.refreshTokenService.rotateRefreshToken(
      refreshToken,
      ipAddress,
      userAgent,
    );

    if (!rotated) {
        throw new UnauthorizedException('Failed to rotate refresh token');
    }

    // 6. Generate New Access Token
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
        ipAddress: ipAddress,
        userAgent,
      });

      return {
        accessToken,
        refreshToken: rotated.token,
      };
  }

  /**
   * Change expired password (before login, using current credentials)
   */
  async changeExpiredPassword(
    username: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string; errors?: string[] }> {
    // Find user by email/username
    const user = await this.userRepo.findOne({
      where: { email: username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify current password
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Check that password is actually expired
    const settings = await this.authSettingsRepo.findOne({ where: {}, order: { createdAt: 'DESC' } });
    if (settings?.passwordExpiryDays && user.passwordChangedAt) {
      const daysSinceChange = Math.floor(
        (Date.now() - new Date(user.passwordChangedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysSinceChange < settings.passwordExpiryDays) {
        // Password is not actually expired
        throw new UnauthorizedException('Password has not expired');
      }
    }

    // Validate new password
    const validationResult = await this.passwordValidationService.validatePassword(
      newPassword,
      { email: user.email, displayName: user.displayName },
    );

    if (!validationResult.valid) {
      return {
        success: false,
        message: 'Password does not meet requirements',
        errors: validationResult.errors,
      };
    }

    // Check password history
    const historyValid = await this.validatePasswordHistory(user.id, newPassword, settings || undefined);
    if (!historyValid) {
      return {
        success: false,
        message: 'Password was used recently. Please choose a different password.',
      };
    }

    // Hash and save new password with OWASP-recommended parameters
    const newPasswordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    await this.updatePasswordHistory(
      user.id,
      newPasswordHash,
      settings?.passwordHistoryCount ?? 5
    );

    await this.userRepo.update(user.id, {
      passwordHash: newPasswordHash,
      passwordChangedAt: new Date(),
    });

    await this.authEventsService.record({
      eventType: 'PASSWORD_CHANGED',
      success: true,
      userId: user.id,
    });

    return {
      success: true,
      message: 'Password changed successfully. Please log in with your new password.',
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string; errors?: string[] }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.passwordHash) {
      const isValid = await argon2.verify(user.passwordHash, currentPassword);
      if (!isValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    // Validate password against blocklist and policy
    const validationResult = await this.passwordValidationService.validatePassword(
      newPassword,
      { email: user.email, displayName: user.displayName },
    );

    if (!validationResult.valid) {
      return {
        success: false,
        message: 'Password does not meet requirements',
        errors: validationResult.errors,
      };
    }

    const settings = await this.authSettingsRepo.findOne({ where: {}, order: { createdAt: 'DESC' } });

    const historyValid = await this.validatePasswordHistory(userId, newPassword, settings || undefined);
    if (!historyValid) {
      return {
        success: false,
        message:
          'Password was used recently. Please choose a different password.',
      };
    }

    // Hash password with OWASP-recommended parameters
    const newPasswordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    await this.updatePasswordHistory(
      userId,
      newPasswordHash,
      settings?.passwordHistoryCount ?? 5
    );

    await this.userRepo.update(userId, {
      passwordHash: newPasswordHash,
      passwordChangedAt: new Date(),
    });

    await this.authEventsService.record({
      eventType: 'PASSWORD_CHANGED',
      success: true,
      userId,
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  /**
   * Hash a password using OWASP-recommended Argon2id parameters
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    
    const { roleNames, permissions } = await this.resolveRolesAndPermissionsForUser(userId);

    return {
      id: user.id,
      username: user.displayName || user.email,
      email: user.email,
      displayName: user.displayName,
      roles: roleNames,
      permissions: Array.from(permissions),
    };
  }

  /**
   * Resolve roles and permissions for a User using shared PermissionResolverService (with caching)
   */
  async resolveRolesAndPermissionsForUser(userId: string) {
    const cached = await this.permissionResolver.getUserPermissions(userId);
    const roleNames = cached.roles.map(r => r.code || r.name);
    const permissions = cached.permissions;
    return { roleNames, permissions };
  }
}
