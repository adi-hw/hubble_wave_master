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
import { Repository, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ControlPlaneUser, ControlPlaneRole } from '@hubblewave/control-plane-db';
import { LoginDto, RegisterDto, ChangePasswordDto, UpdateProfileDto, VerifyMfaDto } from './auth.dto';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: ControlPlaneRole;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: ControlPlaneRole;
    avatarUrl?: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(ControlPlaneUser)
    private readonly userRepo: Repository<ControlPlaneUser>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<ControlPlaneUser | null> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase(), isActive: true, deletedAt: IsNull() },
    });

    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      throw new UnauthorizedException('Account is temporarily locked. Please try again later.');
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

  async login(dto: LoginDto, ipAddress?: string): Promise<AuthResponse> {
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

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatarUrl: user.avatarUrl || undefined,
      },
    };
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

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role || 'viewer',
      isActive: true,
      passwordChangedAt: new Date(),
      createdBy,
    });

    return this.userRepo.save(user);
  }

  async findById(id: string): Promise<ControlPlaneUser | null> {
    return this.userRepo.findOne({
      where: { id, isActive: true, deletedAt: IsNull() },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
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
