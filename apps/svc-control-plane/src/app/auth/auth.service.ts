import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  ControlPlaneUser,
  ControlPlaneRole,
  RevokedToken,
  RefreshToken,
} from '@hubblewave/control-plane-db';
import { LoginDto, RegisterDto, ChangePasswordDto, UpdateProfileDto, VerifyMfaDto } from './auth.dto';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: ControlPlaneRole;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface LogoutContext {
  userId: string;
  jti?: string;
  expiresAt?: Date;
  family?: string | null;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: ControlPlaneRole;
    avatarUrl?: string;
  };
}

export interface RefreshContext {
  ipAddress?: string;
  userAgent?: string;
}

const REFRESH_TOKEN_TTL_DAYS = 14;
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(ControlPlaneUser)
    private readonly userRepo: Repository<ControlPlaneUser>,
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepo: Repository<RevokedToken>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<ControlPlaneUser | null> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase(), status: 'active' },
    });

    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      throw new UnauthorizedException('Account is temporarily locked. Please try again later.');
    }

    if (!user.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts += 1;

      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      }

      await this.userRepo.save(user);
      return null;
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();

    await this.userRepo.save(user);

    return user;
  }

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        throw new UnauthorizedException('MFA code required');
      }
      const secret = user.mfaSecret ? this.decryptSecret(user.mfaSecret) : null;
      if (!secret || !authenticator.check(dto.mfaCode, secret)) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Update last login info
    user.lastLoginIp = ipAddress || null;
    await this.userRepo.save(user);

    const family = crypto.randomUUID();
    const { accessToken } = this.signAccessToken(user, family);
    const { token: refreshToken, expiresAt: refreshExpiresAt } =
      await this.issueRefreshToken(user.id, family, ipAddress, userAgent);

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: refreshExpiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: user.role,
        avatarUrl: user.avatarUrl ?? undefined,
      },
    };
  }

  /**
   * Mint a new short-lived access token for `user` carrying the refresh
   * family id under a custom `fam` claim. JwtStrategy.validate() surfaces
   * `fam` so the logout flow can revoke the entire family along with the
   * specific access-token jti.
   */
  private signAccessToken(user: ControlPlaneUser, family: string): { accessToken: string; jti: string } {
    const jti = crypto.randomUUID();
    const payload: JwtPayload & { fam: string } = {
      sub: user.id,
      email: user.email,
      role: user.role,
      fam: family,
    };
    const accessToken = this.jwtService.sign(payload, { jwtid: jti });
    return { accessToken, jti };
  }

  /**
   * Issue a refresh token for `userId` in the given `family`. Returns the
   * raw token (only handed to the client) and the `expiresAt` boundary.
   */
  private async issueRefreshToken(
    userId: string,
    family: string,
    ipAddress?: string,
    userAgent?: string,
    replacedBy?: string,
  ): Promise<{ token: string; expiresAt: Date; row: RefreshToken }> {
    const raw = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashRefreshToken(raw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const row = this.refreshTokenRepo.create({
      tokenHash,
      family,
      userId,
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      replacedBy: replacedBy ?? null,
    });
    await this.refreshTokenRepo.save(row);
    return { token: raw, expiresAt, row };
  }

  private hashRefreshToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Exchange a valid refresh token for a fresh access+refresh pair. The
   * presented refresh row is rotated: revoked, linked to its successor.
   * Reuse of an already-revoked refresh token in any family triggers a
   * wholesale family revocation — that is the canonical token-theft
   * signal and must lock the session out.
   */
  async refresh(
    rawToken: string,
    ctx: RefreshContext = {},
  ): Promise<AuthResponse> {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const tokenHash = this.hashRefreshToken(rawToken);
    const row = await this.refreshTokenRepo.findOne({ where: { tokenHash } });
    if (!row) {
      throw new UnauthorizedException('Refresh token invalid');
    }

    if (row.revokedAt) {
      // Replay of a revoked refresh token = theft signal. Revoke the entire
      // family and force re-authentication.
      await this.revokeFamily(row.family, 'reuse_detected');
      throw new UnauthorizedException('Refresh token reuse detected; session terminated');
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.userRepo.findOne({
      where: { id: row.userId, status: 'active' },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer active');
    }

    // Mint successor before flipping the parent row, so any failure leaves
    // the parent intact and the session recoverable.
    const successor = await this.issueRefreshToken(
      user.id,
      row.family,
      ctx.ipAddress,
      ctx.userAgent,
    );

    row.revokedAt = new Date();
    row.revokeReason = 'rotated';
    row.replacedBy = successor.row.id;
    await this.refreshTokenRepo.save(row);

    const { accessToken } = this.signAccessToken(user, row.family);

    return {
      accessToken,
      refreshToken: successor.token,
      refreshExpiresAt: successor.expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: user.role,
        avatarUrl: user.avatarUrl ?? undefined,
      },
    };
  }

  /**
   * Revoke every refresh token in the given family. Idempotent — already-
   * revoked rows are left alone so the audit timestamp stays accurate.
   */
  async revokeFamily(family: string, reason: string): Promise<void> {
    if (!family) return;
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: () => 'NOW()', revokeReason: reason })
      .where('family = :family AND revoked_at IS NULL', { family })
      .execute();
  }

  /**
   * Add a token's `jti` to the revocation list. Called from `POST /auth/logout`.
   * Idempotent - duplicate jti is ignored thanks to the unique index. The row
   * is retained until the token would have naturally expired, then pruned.
   */
  async revokeToken(context: LogoutContext): Promise<void> {
    if (!context.jti || !context.expiresAt) {
      // Tokens issued before this rollout do not carry a jti. We cannot
      // surgically revoke them; the operator must rotate JWT_SECRET to
      // invalidate the entire signing key. Fail closed by raising so the
      // controller can return a clear error rather than silently no-op.
      throw new UnauthorizedException(
        'Token does not carry a jti claim and cannot be individually revoked. ' +
        'Re-authenticate to obtain a token issued by the current platform.',
      );
    }

    const entity = this.revokedTokenRepo.create({
      jti: context.jti,
      userId: context.userId,
      expiresAt: context.expiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    try {
      await this.revokedTokenRepo.save(entity);
    } catch (error: unknown) {
      // Unique-violation on jti means the token was already revoked - this
      // is the desired terminal state, not an error. Re-throw any other DB
      // error so the caller learns persistence actually failed.
      const code = (error as { code?: string })?.code;
      if (code !== '23505') {
        throw error;
      }
    }

    // Also revoke the refresh-token family so the silent-refresh path
    // cannot mint a new access token after explicit logout.
    if (context.family) {
      await this.revokeFamily(context.family, 'logout');
    }
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    if (!jti) return false;
    const row = await this.revokedTokenRepo.findOne({ where: { jti } });
    return !!row;
  }

  /**
   * Periodic-cleanup helper. Called by a scheduled job (or manual maintenance)
   * to drop revocation rows whose underlying token has already expired.
   */
  async purgeExpiredRevocations(now: Date = new Date()): Promise<number> {
    const result = await this.revokedTokenRepo.delete({
      expiresAt: LessThanOrEqual(now),
    });
    return result.affected ?? 0;
  }

  async register(dto: RegisterDto, createdBy?: string): Promise<ControlPlaneUser> {
    // Check if user already exists
    const existing = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    this.assertPasswordComplexity(dto.password);

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const displayName = [dto.firstName, dto.lastName].filter(Boolean).join(' ') || dto.email;
    void createdBy; // Reserved for audit tracking

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      displayName,
      role: (dto.role as ControlPlaneRole) || 'readonly',
      status: 'active',
      passwordChangedAt: new Date(),
    });

    return this.userRepo.save(user);
  }

  async findById(id: string): Promise<ControlPlaneUser | null> {
    return this.userRepo.findOne({
      where: { id, status: 'active' },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Password not set for this account');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    this.assertPasswordComplexity(dto.newPassword);

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    user.passwordChangedAt = new Date();

    await this.userRepo.save(user);
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const user = await this.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (data.firstName) user.firstName = data.firstName;
    if (data.lastName) user.lastName = data.lastName;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;

    await this.userRepo.save(user);

    return this.getProfile(userId);
  }

  // Seed initial admin user
  async seedAdminUser(): Promise<void> {
    const adminExists = await this.userRepo.findOne({ where: { role: 'super_admin' } });
    if (adminExists) {
      return;
    }

    const bootstrapEmail = this.configService.get<string>('CONTROL_PLANE_BOOTSTRAP_ADMIN_EMAIL');
    const bootstrapPassword = this.configService.get<string>('CONTROL_PLANE_BOOTSTRAP_ADMIN_PASSWORD');

    if (!bootstrapEmail || !bootstrapPassword) {
      Logger.warn(
        'CONTROL_PLANE_BOOTSTRAP_ADMIN_EMAIL and CONTROL_PLANE_BOOTSTRAP_ADMIN_PASSWORD not set; skipping auto-admin creation',
        'AuthService',
      );
      return;
    }

    this.assertPasswordComplexity(bootstrapPassword);

    await this.register({
      email: bootstrapEmail,
      password: bootstrapPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'super_admin',
    });

    Logger.log(`Seeded control plane admin user: ${bootstrapEmail}`, 'AuthService');
  }

  private assertPasswordComplexity(password: string) {
    if (password.length < 12) {
      throw new BadRequestException('Password must be at least 12 characters long');
    }
    const complexity = [
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;
    if (complexity < 3) {
      throw new BadRequestException(
        'Password must include at least three of the following: uppercase, lowercase, number, special character',
      );
    }
  }

  // MFA helpers
  generateMfaSecret() {
    const secret = authenticator.generateSecret();
    return {
      secret,
      otpauthUrl: authenticator.keyuri('control-plane-user', 'HubbleWave Control Plane', secret),
    };
  }

  async enableMfa(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const { secret } = this.generateMfaSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'HubbleWave Control Plane', secret);
    user.mfaSecret = this.encryptSecret(secret);
    await this.userRepo.save(user);
    return { secret, otpauthUrl };
  }

  async verifyMfa(userId: string, dto: VerifyMfaDto) {
    const user = await this.findById(userId);
    if (!user || !user.mfaSecret) throw new UnauthorizedException('User not found');
    const secret = this.decryptSecret(user.mfaSecret);
    if (!authenticator.check(dto.code, secret)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    user.mfaEnabled = true;
    await this.userRepo.save(user);
    return { message: 'MFA enabled' };
  }

  async disableMfa(userId: string, dto: VerifyMfaDto) {
    const user = await this.findById(userId);
    if (!user || !user.mfaSecret) throw new UnauthorizedException('User not found');
    const secret = this.decryptSecret(user.mfaSecret);
    if (!authenticator.check(dto.code, secret)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    user.mfaEnabled = false;
    user.mfaSecret = null;
    await this.userRepo.save(user);
    return { message: 'MFA disabled' };
  }

  private getEncryptionKey() {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      throw new InternalServerErrorException('ENCRYPTION_KEY is required for MFA secrets');
    }
    const buf = Buffer.from(key, 'hex');
    if (buf.length !== 32) {
      throw new InternalServerErrorException('ENCRYPTION_KEY must be 32-byte hex');
    }
    return buf;
  }

  private encryptSecret(secret: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decryptSecret(payload: string): string {
    const key = this.getEncryptionKey();
    const buffer = Buffer.from(payload, 'base64');
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const data = buffer.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
