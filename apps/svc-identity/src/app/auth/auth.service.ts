import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { In } from 'typeorm';
import {
  Tenant,
  UserAccount,
  UserRoleAssignment,
  LdapConfig,
  PasswordPolicy,
  PasswordHistory,
  GroupRole,
  UserGroup,
  TenantUserMembership,
  RoleInheritance,
  Role,
} from '@eam-platform/platform-db';
import { UserProfile } from '@eam-platform/tenant-db';
import { LoginDto } from './dto/login.dto';
import { LdapService } from '../ldap/ldap.service';
import { RefreshTokenService } from './refresh-token.service';
import { MfaService } from './mfa.service';
import { TenantDbService } from '@eam-platform/tenant-db';
import { AuthEventsService } from './auth-events.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly tenantDbService: TenantDbService,
    private readonly jwtService: JwtService,
    private readonly ldapService: LdapService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly mfaService: MfaService,
    private readonly authEventsService: AuthEventsService,
  ) {}

  private async validatePasswordHistory(
    tenantId: string,
    userId: string,
    newPassword: string,
    policy?: PasswordPolicy
  ): Promise<boolean> {
    const historyDepth = policy?.passwordHistoryDepth ?? 5;
    if (historyDepth <= 0) {
      return true;
    }

    const historyRepo = await this.tenantDbService.getRepository<PasswordHistory>(tenantId, PasswordHistory as any);
    const history = await historyRepo.find({
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

  private async ensureUserProfile(
    tenantId: string,
    membershipId: string,
    primaryEmail: string,
    displayName?: string,
  ): Promise<void> {
    try {
      const profileRepo = await this.tenantDbService.getRepository<UserProfile>(tenantId, UserProfile);
      let profile = await profileRepo.findOne({ where: { tenantUserId: membershipId } });
      if (!profile) {
        profile = profileRepo.create({
          tenantUserId: membershipId,
          displayName: displayName || primaryEmail,
          email: primaryEmail,
          isActive: true,
        });
        await profileRepo.save(profile);
      } else {
        const updated: Partial<UserProfile> = {};
        if (profile.email !== primaryEmail) updated.email = primaryEmail;
        if (displayName && profile.displayName !== displayName) updated.displayName = displayName;
        if (Object.keys(updated).length > 0) {
          await profileRepo.update(profile.id, updated);
        }
      }
    } catch (err) {
      this.logger.warn('Failed to ensure tenant user profile', {
        tenantId,
        membershipId,
        error: (err as Error)?.message,
      });
    }
  }

  private async updatePasswordHistory(
    tenantId: string,
    userId: string,
    newPasswordHash: string,
    maxHistory = 5
  ): Promise<void> {
    const historyRepo = await this.tenantDbService.getRepository<PasswordHistory>(tenantId, PasswordHistory as any);
    await historyRepo.insert({
      userId,
      passwordHash: newPasswordHash,
    });

    const keep = Math.max(maxHistory, 0);
    if (keep > 0) {
      const idsToKeep = await historyRepo
        .createQueryBuilder('ph')
        .select('ph.id')
        .where('ph.user_id = :userId', { userId })
        .orderBy('ph.created_at', 'DESC')
        .limit(keep)
        .getMany();
      const keepIds = idsToKeep.map((h) => h.id);
      if (keepIds.length > 0) {
        await historyRepo
          .createQueryBuilder()
          .delete()
          .from(PasswordHistory as any)
          .where('user_id = :userId', { userId })
          .andWhere('id NOT IN (:...ids)', { ids: keepIds })
          .execute();
      }
    }
  }

  private async checkAccountLockout(
    tenantId: string,
    user: UserAccount,
    _policy?: PasswordPolicy
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
      const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenantId, UserAccount);
      await usersRepo.update(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: undefined,
      });
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
    }
  }

  private async handleFailedLogin(tenantId: string, user: UserAccount, policy?: PasswordPolicy): Promise<void> {
    const maxAttempts = policy?.maxFailedAttempts ?? 5;
    const lockoutMinutes = policy?.lockoutDurationMinutes ?? 30;

    const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenantId, UserAccount);
    const newAttempts = (user.failedLoginAttempts || 0) + 1;

    const updates: Partial<UserAccount> = {
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

    await usersRepo.update(user.id, updates);
  }

  private async resetFailedLoginAttempts(tenantId: string, userId: string): Promise<void> {
    const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenantId, UserAccount);
    await usersRepo.update(userId, {
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      lastFailedLoginAt: undefined,
    });
  }

  private async validateLocalUser(user: UserAccount, password: string, tenantId: string, policy?: PasswordPolicy) {
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Check if account is locked
    await this.checkAccountLockout(tenantId, user, policy);

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      // Record failed attempt and potentially lock account
      await this.handleFailedLogin(tenantId, user, policy);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
      await this.resetFailedLoginAttempts(tenantId, user.id);
    }

    return user;
  }

  async validateLdapUser(tenant: Tenant, username: string, password: string) {
    const ldapConfigRepo = await this.tenantDbService.getRepository<LdapConfig>(tenant.id, LdapConfig as any);
    const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenant.id, UserAccount as any);
    const ldapConfig = await ldapConfigRepo.findOne({
      where: { enabled: true },
    });

    if (!ldapConfig) {
      throw new UnauthorizedException('LDAP not configured');
    }

    const ldapUser = await this.ldapService.authenticate(
      ldapConfig,
      username,
      password
    );

    let user = await usersRepo.findOne({
      where: { primaryEmail: ldapUser.username },
    });

    if (!user) {
      user = usersRepo.create({
        primaryEmail: ldapUser.username,
        displayName: ldapUser.displayName,
        status: 'ACTIVE',
      });
      await usersRepo.save(user);
    }

    return user;
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { tenantSlug, username, password } = dto;
    this.logger.log('Login attempt', { tenantSlug, username });

    try {
      if (!tenantSlug) {
        throw new UnauthorizedException('Tenant could not be determined from host');
      }
      const tenant = await this.tenantDbService.getTenantOrThrow(tenantSlug);
      if (!tenant || tenant.status !== 'ACTIVE') {
        await this.authEventsService.record({
          tenantId: tenant?.id,
          type: 'LOGIN_FAILED',
          ip: ipAddress,
          userAgent,
          metadata: { reason: 'TENANT_INACTIVE_OR_INVALID', tenantSlug },
        });
        throw new UnauthorizedException('Tenant is not active');
      }

      const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenant.id, UserAccount as any);
      const membershipRepo = await this.tenantDbService.getRepository<TenantUserMembership>(tenant.id, TenantUserMembership as any);

      let user = await usersRepo.findOne({
        where: { primaryEmail: username },
      });
      this.logger.log('User lookup', { user: user ? user.id : null });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const membership = await membershipRepo.findOne({
        where: { tenantId: tenant.id, userId: user.id },
      });

      if (!membership || membership.status !== 'ACTIVE') {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Get password policy for lockout enforcement
      const passwordPolicyRepo = await this.tenantDbService.getRepository<PasswordPolicy>(tenant.id, PasswordPolicy as any);
      const policy = await passwordPolicyRepo.findOne({
        where: { tenantId: tenant.id },
      });

      user = await this.validateLocalUser(user, password, tenant.id, policy ?? undefined);

      // Check if MFA is required
      const mfaEnabled = await this.mfaService.isMfaEnabled(tenant.id, user.id);

      if (mfaEnabled) {
        if (dto.mfaToken) {
          const isValid = await this.mfaService.verifyTotp(
            tenant.id,
            user.id,
            dto.mfaToken
          );
          if (!isValid) {
            const isRecoveryValid = await this.mfaService.verifyRecoveryCode(
              tenant.id,
              user.id,
              dto.mfaToken
            );
            if (!isRecoveryValid) {
              throw new UnauthorizedException('Invalid MFA code');
            }
          }
        } else {
          await this.authEventsService.record({
            tenantId: tenant.id,
            userId: user.id,
            type: 'LOGIN_MFA_REQUIRED',
            ip: ipAddress,
            userAgent,
          });
          return {
            mfaRequired: true,
            message: 'MFA verification required',
          };
        }
      }

      // Password expiry check
      if (policy?.passwordExpiryDays && (user as any).passwordChangedAt) {
        const daysSinceChange = Math.floor(
          (Date.now() - new Date((user as any).passwordChangedAt).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysSinceChange >= policy.passwordExpiryDays) {
          return {
            passwordExpired: true,
            message: 'Password has expired. Please change your password.',
            userId: user.id,
          };
        }
      }

      await this.ensureUserProfile(tenant.id, membership.id, user.primaryEmail, user.displayName);

      const { roleNames, permissions } = await this.resolveRolesAndPermissions(tenant.id, membership.id);

      // Include tenant_admin role if set on membership but not already in roleNames
      const allRoles = [...roleNames];
      if (membership.isTenantAdmin && !allRoles.includes('tenant_admin')) {
        allRoles.push('tenant_admin');
      }

      const payload = {
        sub: user.id,
        username: user.displayName || user.primaryEmail,
        tenant_id: tenant.id,
        roles: allRoles,
        permissions: Array.from(permissions),
        is_tenant_admin: membership.isTenantAdmin,
      };
      const accessToken = this.jwtService.sign(payload);

      const { token: refreshToken } =
        await this.refreshTokenService.createRefreshToken(user.id, tenant.id, ipAddress, userAgent);

      await this.authEventsService.record({
        tenantId: tenant.id,
        userId: user.id,
        type: 'LOGIN_SUCCESS',
        ip: ipAddress,
        userAgent,
      });
      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.displayName || user.primaryEmail,
          email: user.primaryEmail,
          displayName: user.displayName,
          tenantId: tenant.id,
          roles: allRoles,
          isTenantAdmin: membership.isTenantAdmin,
        },
      };
    } catch (error) {
      await this.authEventsService.record({
        tenantId: undefined,
        userId: undefined,
        type: 'LOGIN_FAILED',
        ip: ipAddress,
        userAgent,
        metadata: { reason: (error as any)?.message || 'UNKNOWN_ERROR' },
      });
      this.logger.error('Login error', error as any);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string, tenantSlug?: string, ipAddress?: string, userAgent?: string) {
    if (!tenantSlug) {
      throw new UnauthorizedException('Tenant could not be determined from host');
    }
    const tenant = await this.tenantDbService.getTenantOrThrow(tenantSlug);
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tenant not active');
    }

    const tokenEntity = await this.refreshTokenService.findByToken(refreshToken, tenant.id);
    if (!tokenEntity) {
      await this.authEventsService.record({
        tenantId: tenant.id,
        type: 'REFRESH_FAILED',
        ip: ipAddress,
        userAgent,
        metadata: { reason: 'NOT_FOUND' },
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (tokenEntity.revokedAt || tokenEntity.expiresAt < new Date()) {
      await this.authEventsService.record({
        tenantId: tenant.id,
        userId: tokenEntity.userId,
        type: 'REFRESH_FAILED',
        ip: ipAddress,
        userAgent,
        metadata: { reason: 'EXPIRED_OR_REVOKED', tokenId: tokenEntity.id },
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (tokenEntity.replacedById) {
      await this.refreshTokenService.markFamilyAsCompromised(tenant.id, tokenEntity.familyId, 'REUSE_DETECTED');
      await this.authEventsService.record({
        tenantId: tenant.id,
        userId: tokenEntity.userId,
        type: 'REFRESH_TOKEN_REUSE_DETECTED',
        ip: ipAddress,
        userAgent,
        metadata: { familyId: tokenEntity.familyId, tokenId: tokenEntity.id },
      });
      this.logger.warn('Refresh token reuse detected', {
        familyId: tokenEntity.familyId,
        tokenId: tokenEntity.id,
        tenantId: tenant.id,
        userId: tokenEntity.userId,
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenant.id, UserAccount as any);
    const user = await usersRepo.findOne({
      where: { id: tokenEntity.userId },
    });

    const membershipRepo = await this.tenantDbService.getRepository<TenantUserMembership>(tenant.id, TenantUserMembership as any);
    const membership = await membershipRepo.findOne({ where: { tenantId: tenant.id, userId: tokenEntity.userId } });

    if (!user || !membership || membership.status !== 'ACTIVE') {
      await this.authEventsService.record({
        tenantId: tenant.id,
        userId: tokenEntity.userId,
        type: 'REFRESH_FAILED',
        ip: ipAddress,
        userAgent,
        metadata: { reason: 'USER_INACTIVE' },
      });
      throw new UnauthorizedException('User not found or inactive');
    }

    await this.ensureUserProfile(tenant.id, membership.id, user.primaryEmail, user.displayName);

    const { roleNames, permissions } = await this.resolveRolesAndPermissions(tenant.id, membership.id);

    // Include tenant_admin role if set on membership but not already in roleNames
    const allRoles = [...roleNames];
    if (membership.isTenantAdmin && !allRoles.includes('tenant_admin')) {
      allRoles.push('tenant_admin');
    }

    // Touch last used metadata on the current token
    await this.refreshTokenService.updateLastUsed(tenant.id, tokenEntity.id, ipAddress, userAgent);

    const rotated = await this.refreshTokenService.rotateRefreshToken(
      refreshToken,
      tenant.id,
      ipAddress,
      userAgent,
    );
    if (!rotated) {
      await this.refreshTokenService.markFamilyAsCompromised(tenant.id, tokenEntity.familyId, 'ROTATION_FAILED');
      await this.authEventsService.record({
        tenantId: tenant.id,
        userId: user.id,
        type: 'REFRESH_FAILED',
        ip: ipAddress,
        userAgent,
        metadata: { reason: 'ROTATION_FAILED', familyId: tokenEntity.familyId },
      });
      throw new UnauthorizedException('Failed to rotate refresh token');
    }

    const payload = {
      sub: user.id,
      username: user.displayName || user.primaryEmail,
      tenant_id: tenant.id,
      roles: allRoles,
      permissions: Array.from(permissions),
      is_tenant_admin: membership.isTenantAdmin,
    };
    const accessToken = this.jwtService.sign(payload);

    await this.authEventsService.record({
      tenantId: tenant.id,
      userId: user.id,
      type: 'REFRESH_SUCCESS',
      ip: ipAddress,
      userAgent,
      metadata: { familyId: tokenEntity.familyId },
    });

    return {
      accessToken,
      refreshToken: rotated.token,
    };
  }

  async changePassword(
    tenantId: string,
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenantId, UserAccount as any);
    const user = await usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.passwordHash) {
      const isValid = await argon2.verify(user.passwordHash, currentPassword);
      if (!isValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    const passwordPolicyRepo = await this.tenantDbService.getRepository<PasswordPolicy>(tenantId, PasswordPolicy as any);
    const policy = await passwordPolicyRepo.findOne({ where: { tenantId } });

    const historyValid = await this.validatePasswordHistory(tenantId, userId, newPassword, policy || undefined);
    if (!historyValid) {
      return {
        success: false,
        message:
          'Password was used recently. Please choose a different password.',
      };
    }

    const newPasswordHash = await argon2.hash(newPassword);

    await this.updatePasswordHistory(
      tenantId,
      userId,
      newPasswordHash,
      policy?.passwordHistoryDepth ?? 5
    );

    await usersRepo.update(userId, {
      passwordHash: newPasswordHash,
    });

    await this.authEventsService.record({
      tenantId,
      userId,
      type: 'PASSWORD_CHANGED',
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async logout(tenantId: string, userId: string, ipAddress?: string, userAgent?: string) {
    await this.refreshTokenService.revokeAllUserTokens(tenantId, userId);
    await this.authEventsService.record({
      tenantId,
      userId,
      type: 'LOGOUT',
      ip: ipAddress,
      userAgent,
    });
    return { success: true };
  }

  private async resolveRolesAndPermissions(tenantId: string, membershipId: string) {
    const userRolesRepo = await this.tenantDbService.getRepository<UserRoleAssignment>(tenantId, UserRoleAssignment as any);
    const inheritanceRepo = await this.tenantDbService.getRepository<RoleInheritance>(tenantId, RoleInheritance as any);
    const groupRoleRepo = await this.tenantDbService.getRepository<GroupRole>(tenantId, GroupRole as any);
    const roleRepo = await this.tenantDbService.getRepository<Role>(tenantId, Role as any);

    const directAssignments = await userRolesRepo.find({
      where: { tenantUserMembershipId: membershipId },
      relations: ['role', 'role.rolePermissions', 'role.rolePermissions.permission'],
    });

    const groupRoles = await groupRoleRepo
      .createQueryBuilder('gr')
      .innerJoin(UserGroup, 'ug', 'ug.group_id = gr.group_id AND ug.tenant_user_membership_id = :membershipId', { membershipId })
      .leftJoinAndSelect('gr.role', 'role')
      .leftJoinAndSelect('role.rolePermissions', 'rp')
      .leftJoinAndSelect('rp.permission', 'perm')
      .getMany();

    const roleMap = new Map<string, any>();
    [...directAssignments.map((ra) => ra.role), ...groupRoles.map((gr) => gr.role)]
      .filter(Boolean)
      .forEach((r) => roleMap.set(r.id, r));

    const collectInherited = async (roleIds: string[], visited: Set<string>) => {
      if (!roleIds.length) return;
      const rows = await inheritanceRepo.find({
        where: [{ parentRoleId: In(roleIds) }],
      });
      const childIds = rows.map((r) => r.childRoleId).filter((id) => !visited.has(id));
      if (!childIds.length) return;
      for (const id of childIds) {
        visited.add(id);
        const child = await roleRepo.findOne({ where: { id }, relations: ['rolePermissions', 'rolePermissions.permission'] });
        if (child) roleMap.set(child.id, child);
      }
      await collectInherited(childIds, visited);
    };

    await collectInherited(Array.from(roleMap.keys()), new Set());

    const uniqueRoles = Array.from(roleMap.values());
    const roleNames = uniqueRoles.map((r) => r.slug || r.name);
    const permissions = new Set<string>();
    uniqueRoles.forEach((role) => {
      role.rolePermissions?.forEach((rp: any) => {
        if (rp.permission?.name) permissions.add(rp.permission.name);
      });
    });
    return { roleNames, permissions };
  }
}
