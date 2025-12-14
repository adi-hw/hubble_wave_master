import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import {
  UserAccount,
  UserInvitation,
  Tenant,
} from '@eam-platform/platform-db';
import {
  TenantDbService,
  TenantUser,
  TenantUserStatus,
  UserPreference,
  UserAuditLog,
  UserAuditAction,
  TenantUserRole,
  TenantGroupMember,
  TenantRole,
  TenantGroup,
} from '@eam-platform/tenant-db';
import { EmailService } from '../email/email.service';

export interface CreateTenantUserDto {
  email: string;
  displayName: string;
  employeeId?: string;
  title?: string;
  department?: string;
  location?: string;
  managerId?: string;
  workPhone?: string;
  mobilePhone?: string;
  locale?: string;
  timeZone?: string;
  isTenantAdmin?: boolean;
  roleIds?: string[];
  groupIds?: string[];
  sendInvitation?: boolean;
  personalMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTenantUserDto {
  displayName?: string;
  employeeId?: string;
  title?: string;
  department?: string;
  location?: string;
  costCenter?: string;
  managerId?: string | null;
  workPhone?: string;
  mobilePhone?: string;
  avatarUrl?: string;
  locale?: string;
  timeZone?: string;
  isTenantAdmin?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TenantUserListQuery {
  q?: string;
  status?: TenantUserStatus | TenantUserStatus[];
  department?: string;
  managerId?: string;
  roleId?: string;
  groupId?: string;
  isTenantAdmin?: boolean;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface TenantUserListResult {
  data: TenantUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class TenantUserService {
  private readonly logger = new Logger(TenantUserService.name);

  constructor(
    @InjectRepository(UserAccount)
    private readonly userAccountRepo: Repository<UserAccount>,
    @InjectRepository(UserInvitation)
    private readonly invitationRepo: Repository<UserInvitation>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantDbService: TenantDbService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create a new tenant user (invites existing or creates new platform user)
   */
  async createUser(
    tenantId: string,
    dto: CreateTenantUserDto,
    actorId?: string,
  ): Promise<{ tenantUser: TenantUser; isNewPlatformUser: boolean }> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);

    // Check if user already exists in this tenant by email
    const existingTenantUser = await tenantUserRepo.findOne({
      where: { workEmail: dto.email.toLowerCase() },
    });
    if (existingTenantUser) {
      throw new ConflictException('User with this email already exists in this tenant');
    }

    // Check if platform user already exists
    let userAccount = await this.userAccountRepo.findOne({
      where: { primaryEmail: dto.email.toLowerCase() },
    });
    const isNewPlatformUser = !userAccount;

    if (!userAccount) {
      // Create new platform user account
      userAccount = this.userAccountRepo.create({
        primaryEmail: dto.email.toLowerCase(),
        displayName: dto.displayName,
        status: 'INVITED',
        locale: dto.locale,
        timeZone: dto.timeZone,
      });
      await this.userAccountRepo.save(userAccount);
    }

    // Get actor tenant user for audit
    let actorTenantUser: TenantUser | null = null;
    if (actorId) {
      actorTenantUser = await tenantUserRepo.findOne({
        where: { userAccountId: actorId },
      });
    }

    // Create tenant user
    const tenantUser = tenantUserRepo.create({
      userAccountId: userAccount.id,
      displayName: dto.displayName,
      workEmail: dto.email.toLowerCase(),
      employeeId: dto.employeeId,
      title: dto.title,
      department: dto.department,
      location: dto.location,
      workPhone: dto.workPhone,
      mobilePhone: dto.mobilePhone,
      locale: dto.locale,
      timeZone: dto.timeZone,
      isTenantAdmin: dto.isTenantAdmin ?? false,
      managerId: dto.managerId,
      status: 'invited',
      invitedBy: actorTenantUser?.id,
      invitedAt: new Date(),
      metadata: dto.metadata ?? {},
    });

    // Generate activation token if sending invitation
    if (dto.sendInvitation !== false) {
      const token = randomBytes(32).toString('hex');
      tenantUser.activationToken = await argon2.hash(token);
      tenantUser.activationTokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

      // Store invitation in platform DB as well
      const tenant = await this.tenantRepo.findOneOrFail({ where: { id: tenantId } });
      const invitation = this.invitationRepo.create({
        email: dto.email.toLowerCase(),
        tenantId,
        token,
        tokenExpiresAt: tenantUser.activationTokenExpiresAt,
        invitedBy: actorId,
        invitationType: 'email',
        displayName: dto.displayName,
        title: dto.title,
        department: dto.department,
        employeeId: dto.employeeId,
        initialRoleIds: dto.roleIds ?? [],
        initialGroupIds: dto.groupIds ?? [],
        personalMessage: dto.personalMessage,
        status: 'pending',
      });
      await this.invitationRepo.save(invitation);

      // Send invitation email
      try {
        await this.emailService.sendInvitationEmail({
          to: dto.email,
          displayName: dto.displayName,
          tenantName: tenant.name ?? tenant.slug ?? 'Unknown Tenant',
          inviterName: actorTenantUser?.displayName,
          personalMessage: dto.personalMessage,
          activationUrl: `${process.env['APP_URL']}/activate?token=${token}&tenant=${tenant.slug ?? tenantId}`,
          expiresAt: tenantUser.activationTokenExpiresAt ?? undefined,
        });
      } catch (error) {
        this.logger.error(`Failed to send invitation email to ${dto.email}`, error);
      }
    }

    await tenantUserRepo.save(tenantUser);

    // Assign initial roles
    if (dto.roleIds?.length) {
      await this.assignRoles(tenantId, tenantUser.id, dto.roleIds, actorTenantUser?.id);
    }

    // Assign initial groups
    if (dto.groupIds?.length) {
      await this.addToGroups(tenantId, tenantUser.id, dto.groupIds, actorTenantUser?.id);
    }

    // Create default preferences
    await this.createDefaultPreferences(tenantId, tenantUser.id);

    // Log audit event
    await this.logAudit(tenantId, tenantUser.id, 'created', actorTenantUser?.id, null, {
      email: dto.email,
      displayName: dto.displayName,
      roleIds: dto.roleIds,
      groupIds: dto.groupIds,
    });

    return { tenantUser, isNewPlatformUser };
  }

  /**
   * Get tenant user by ID
   */
  async getUserById(tenantId: string, userId: string): Promise<TenantUser> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);
    const user = await tenantUserRepo.findOne({
      where: { id: userId },
      relations: ['manager'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Get tenant user by platform user account ID
   */
  async getUserByAccountId(tenantId: string, userAccountId: string): Promise<TenantUser | null> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);
    return tenantUserRepo.findOne({
      where: { userAccountId },
    });
  }

  /**
   * List tenant users with filtering and pagination
   */
  async listUsers(tenantId: string, query: TenantUserListQuery): Promise<TenantUserListResult> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const qb = tenantUserRepo.createQueryBuilder('user');

    // Filter by status
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      qb.andWhere('user.status IN (:...statuses)', { statuses });
    }

    // Exclude deleted unless requested
    if (!query.includeDeleted) {
      qb.andWhere('user.deleted_at IS NULL');
    }

    // Search by name, email, or employee ID
    if (query.q) {
      qb.andWhere(
        '(user.display_name ILIKE :q OR user.work_email ILIKE :q OR user.employee_id ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    // Filter by department
    if (query.department) {
      qb.andWhere('user.department = :department', { department: query.department });
    }

    // Filter by manager
    if (query.managerId) {
      qb.andWhere('user.manager_id = :managerId', { managerId: query.managerId });
    }

    // Filter by tenant admin
    if (query.isTenantAdmin !== undefined) {
      qb.andWhere('user.is_tenant_admin = :isTenantAdmin', { isTenantAdmin: query.isTenantAdmin });
    }

    // Filter by role
    if (query.roleId) {
      qb.innerJoin(
        'tenant_user_roles',
        'tur',
        'tur.tenant_user_id = user.id AND tur.role_id = :roleId',
        { roleId: query.roleId },
      );
    }

    // Filter by group
    if (query.groupId) {
      qb.innerJoin(
        'tenant_group_members',
        'tgm',
        'tgm.tenant_user_id = user.id AND tgm.group_id = :groupId',
        { groupId: query.groupId },
      );
    }

    // Sorting
    const sortBy = query.sortBy ?? 'displayName';
    const sortOrder = query.sortOrder ?? 'ASC';
    qb.orderBy(`user.${this.toSnakeCase(sortBy)}`, sortOrder);

    // Get total count
    const total = await qb.getCount();

    // Get paginated results
    qb.skip(skip).take(pageSize);
    const data = await qb.getMany();

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update tenant user profile
   */
  async updateUser(
    tenantId: string,
    userId: string,
    dto: UpdateTenantUserDto,
    actorId?: string,
  ): Promise<TenantUser> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);
    const user = await this.getUserById(tenantId, userId);

    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    // Track changes for audit
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && user[key as keyof TenantUser] !== value) {
        oldValues[key] = user[key as keyof TenantUser];
        newValues[key] = value;
        (user as unknown as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(newValues).length > 0) {
      await tenantUserRepo.save(user);

      // Get actor tenant user for audit
      let actorTenantUserId: string | undefined;
      if (actorId) {
        const actorTenantUser = await tenantUserRepo.findOne({
          where: { userAccountId: actorId },
        });
        actorTenantUserId = actorTenantUser?.id;
      }

      await this.logAudit(tenantId, userId, 'profile_updated', actorTenantUserId, oldValues, newValues);
    }

    return user;
  }

  /**
   * Activate an invited user
   */
  async activateUser(
    tenantId: string,
    token: string,
    password?: string,
  ): Promise<TenantUser> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);

    // Find user by activation token
    const users = await tenantUserRepo.find({
      where: {
        status: 'invited',
        activationTokenExpiresAt: Not(IsNull()),
      },
    });

    let targetUser: TenantUser | null = null;
    for (const user of users) {
      if (user.activationToken) {
        try {
          const valid = await argon2.verify(user.activationToken, token);
          if (valid) {
            targetUser = user;
            break;
          }
        } catch {
          // Invalid hash format, skip
        }
      }
    }

    if (!targetUser) {
      throw new BadRequestException('Invalid or expired activation token');
    }

    if (targetUser.activationTokenExpiresAt && targetUser.activationTokenExpiresAt < new Date()) {
      throw new BadRequestException('Activation token has expired');
    }

    // Update password if provided and user is new
    if (password && targetUser.userAccountId) {
      const userAccount = await this.userAccountRepo.findOne({
        where: { id: targetUser.userAccountId },
      });
      if (userAccount && !userAccount.passwordHash) {
        userAccount.passwordHash = await argon2.hash(password);
        userAccount.passwordAlgo = 'argon2';
        userAccount.status = 'ACTIVE';
        userAccount.emailVerified = true;
        userAccount.emailVerifiedAt = new Date();
        await this.userAccountRepo.save(userAccount);
      }
    }

    // Activate tenant user
    targetUser.status = 'active';
    targetUser.activatedAt = new Date();
    targetUser.activationToken = null;
    targetUser.activationTokenExpiresAt = null;
    await tenantUserRepo.save(targetUser);

    // Update invitation status in platform DB
    if (targetUser.workEmail) {
      await this.invitationRepo.update(
        { email: targetUser.workEmail, tenantId, status: 'pending' },
        { status: 'accepted', acceptedAt: new Date() },
      );
    }

    await this.logAudit(tenantId, targetUser.id, 'activated', undefined);

    return targetUser;
  }

  /**
   * Activate a user using tenant slug (for public activation endpoint)
   */
  async activateUserBySlug(
    tenantSlug: string,
    token: string,
    password?: string,
  ): Promise<TenantUser> {
    // Resolve tenant from slug
    const tenant = await this.tenantRepo.findOne({ where: { slug: tenantSlug } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return this.activateUser(tenant.id, token, password);
  }

  /**
   * Deactivate a user (soft disable)
   */
  async deactivateUser(
    tenantId: string,
    userId: string,
    reason?: string,
    actorId?: string,
  ): Promise<TenantUser> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);
    const user = await this.getUserById(tenantId, userId);

    // Can't deactivate yourself
    if (actorId) {
      const actorTenantUser = await tenantUserRepo.findOne({
        where: { userAccountId: actorId },
      });
      if (actorTenantUser?.id === userId) {
        throw new BadRequestException('Cannot deactivate your own account');
      }
    }

    if (user.status === 'inactive') {
      throw new BadRequestException('User is already inactive');
    }

    const oldStatus = user.status;
    user.status = 'inactive';
    user.deactivatedAt = new Date();
    user.deactivationReason = reason || null;

    if (actorId) {
      const actorTenantUser = await tenantUserRepo.findOne({
        where: { userAccountId: actorId },
      });
      user.deactivatedBy = actorTenantUser?.id || null;
    }

    await tenantUserRepo.save(user);

    await this.logAudit(
      tenantId,
      userId,
      'deactivated',
      user.deactivatedBy || undefined,
      { status: oldStatus },
      { status: 'inactive', reason },
    );

    return user;
  }

  /**
   * Reactivate an inactive user
   */
  async reactivateUser(
    tenantId: string,
    userId: string,
    actorId?: string,
  ): Promise<TenantUser> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);
    const user = await this.getUserById(tenantId, userId);

    if (user.status !== 'inactive') {
      throw new BadRequestException('User is not inactive');
    }

    if (user.deletedAt) {
      throw new BadRequestException('Cannot reactivate a deleted user');
    }

    user.status = 'active';
    user.deactivatedAt = null;
    user.deactivatedBy = null;
    user.deactivationReason = null;

    await tenantUserRepo.save(user);

    let actorTenantUserId: string | undefined;
    if (actorId) {
      const actorTenantUser = await tenantUserRepo.findOne({
        where: { userAccountId: actorId },
      });
      actorTenantUserId = actorTenantUser?.id;
    }

    await this.logAudit(
      tenantId,
      userId,
      'reactivated',
      actorTenantUserId,
      { status: 'inactive' },
      { status: 'active' },
    );

    return user;
  }

  /**
   * Suspend a user temporarily
   */
  async suspendUser(
    tenantId: string,
    userId: string,
    reason: string,
    expiresAt?: Date,
    actorId?: string,
  ): Promise<TenantUser> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);
    const user = await this.getUserById(tenantId, userId);

    if (user.status === 'suspended') {
      throw new BadRequestException('User is already suspended');
    }

    const oldStatus = user.status;
    user.status = 'suspended';
    user.suspendedAt = new Date();
    user.suspensionReason = reason;
    user.suspensionExpiresAt = expiresAt || null;

    if (actorId) {
      const actorTenantUser = await tenantUserRepo.findOne({
        where: { userAccountId: actorId },
      });
      user.suspendedBy = actorTenantUser?.id || null;
    }

    await tenantUserRepo.save(user);

    await this.logAudit(
      tenantId,
      userId,
      'suspended',
      user.suspendedBy || undefined,
      { status: oldStatus },
      { status: 'suspended', reason, expiresAt },
    );

    return user;
  }

  /**
   * Unsuspend a suspended user
   */
  async unsuspendUser(
    tenantId: string,
    userId: string,
    actorId?: string,
  ): Promise<TenantUser> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);
    const user = await this.getUserById(tenantId, userId);

    if (user.status !== 'suspended') {
      throw new BadRequestException('User is not suspended');
    }

    user.status = 'active';
    user.suspendedAt = null;
    user.suspendedBy = null;
    user.suspensionReason = null;
    user.suspensionExpiresAt = null;

    await tenantUserRepo.save(user);

    let actorTenantUserId: string | undefined;
    if (actorId) {
      const actorTenantUser = await tenantUserRepo.findOne({
        where: { userAccountId: actorId },
      });
      actorTenantUserId = actorTenantUser?.id;
    }

    await this.logAudit(
      tenantId,
      userId,
      'unsuspended',
      actorTenantUserId,
      { status: 'suspended' },
      { status: 'active' },
    );

    return user;
  }

  /**
   * Soft delete a user
   */
  async deleteUser(
    tenantId: string,
    userId: string,
    actorId?: string,
  ): Promise<void> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);
    const user = await this.getUserById(tenantId, userId);

    // Can't delete yourself
    if (actorId) {
      const actorTenantUser = await tenantUserRepo.findOne({
        where: { userAccountId: actorId },
      });
      if (actorTenantUser?.id === userId) {
        throw new BadRequestException('Cannot delete your own account');
      }
    }

    user.status = 'deleted';
    user.deletedAt = new Date();

    if (actorId) {
      const actorTenantUser = await tenantUserRepo.findOne({
        where: { userAccountId: actorId },
      });
      user.deletedBy = actorTenantUser?.id || null;
    }

    await tenantUserRepo.save(user);

    await this.logAudit(tenantId, userId, 'deleted', user.deletedBy || undefined);
  }

  /**
   * Resend invitation email
   */
  async resendInvitation(
    tenantId: string,
    userId: string,
    actorId?: string,
  ): Promise<void> {
    const tenantUserRepo = await this.tenantDbService.getRepository(tenantId, TenantUser);
    const user = await this.getUserById(tenantId, userId);

    if (user.status !== 'invited') {
      throw new BadRequestException('User is not in invited status');
    }

    const tenant = await this.tenantRepo.findOneOrFail({ where: { id: tenantId } });

    // Generate new activation token
    const token = randomBytes(32).toString('hex');
    user.activationToken = await argon2.hash(token);
    user.activationTokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await tenantUserRepo.save(user);

    // Update invitation in platform DB
    if (user.workEmail) {
      await this.invitationRepo.update(
        { email: user.workEmail, tenantId, status: 'pending' },
        {
          token,
          tokenExpiresAt: user.activationTokenExpiresAt,
          resendCount: () => 'resend_count + 1',
          lastResentAt: new Date(),
        },
      );
    }

    // Get actor name for email
    let inviterName: string | undefined;
    if (actorId) {
      const actorTenantUser = await tenantUserRepo.findOne({
        where: { userAccountId: actorId },
      });
      inviterName = actorTenantUser?.displayName;
    }

    // Send invitation email
    if (user.workEmail) {
      try {
        await this.emailService.sendInvitationEmail({
          to: user.workEmail,
          displayName: user.displayName,
          tenantName: tenant.name ?? tenant.slug ?? 'Unknown Tenant',
          inviterName,
          activationUrl: `${process.env['APP_URL']}/activate?token=${token}&tenant=${tenant.slug ?? tenantId}`,
          expiresAt: user.activationTokenExpiresAt,
        });
      } catch (error) {
        this.logger.error(`Failed to resend invitation email to ${user.workEmail}`, error);
        throw new BadRequestException('Failed to send invitation email');
      }
    }

    let actorTenantUserId: string | undefined;
    if (actorId) {
      const actorTenantUser = await tenantUserRepo.findOne({
        where: { userAccountId: actorId },
      });
      actorTenantUserId = actorTenantUser?.id;
    }

    await this.logAudit(tenantId, userId, 'invitation_resent', actorTenantUserId);
  }

  /**
   * Get user's roles
   */
  async getUserRoles(tenantId: string, userId: string): Promise<TenantRole[]> {
    const tenantUserRoleRepo = await this.tenantDbService.getRepository(tenantId, TenantUserRole);

    const userRoles = await tenantUserRoleRepo.find({
      where: { tenantUserId: userId },
      relations: ['role'],
    });

    return userRoles.map((ur) => ur.role).filter(Boolean) as TenantRole[];
  }

  /**
   * Assign roles to a user
   */
  async assignRoles(
    tenantId: string,
    userId: string,
    roleIds: string[],
    actorId?: string,
  ): Promise<void> {
    const tenantUserRoleRepo = await this.tenantDbService.getRepository(tenantId, TenantUserRole);
    const tenantRoleRepo = await this.tenantDbService.getRepository(tenantId, TenantRole);

    for (const roleId of roleIds) {
      // Check if role exists
      const role = await tenantRoleRepo.findOne({ where: { id: roleId } });
      if (!role) {
        throw new NotFoundException(`Role ${roleId} not found`);
      }

      // Check if already assigned
      const existing = await tenantUserRoleRepo.findOne({
        where: { tenantUserId: userId, roleId },
      });
      if (existing) continue;

      const userRole = tenantUserRoleRepo.create({
        tenantUserId: userId,
        roleId,
        assignedBy: actorId,
      });
      await tenantUserRoleRepo.save(userRole);

      await this.logAudit(
        tenantId,
        userId,
        'role_assigned',
        actorId,
        null,
        { roleId, roleName: role.name },
      );
    }
  }

  /**
   * Remove roles from a user
   */
  async removeRoles(
    tenantId: string,
    userId: string,
    roleIds: string[],
    actorId?: string,
  ): Promise<void> {
    const tenantUserRoleRepo = await this.tenantDbService.getRepository(tenantId, TenantUserRole);
    const tenantRoleRepo = await this.tenantDbService.getRepository(tenantId, TenantRole);

    for (const roleId of roleIds) {
      const role = await tenantRoleRepo.findOne({ where: { id: roleId } });
      await tenantUserRoleRepo.delete({ tenantUserId: userId, roleId });

      await this.logAudit(
        tenantId,
        userId,
        'role_removed',
        actorId,
        { roleId, roleName: role?.name },
        null,
      );
    }
  }

  /**
   * Get user's groups
   */
  async getUserGroups(tenantId: string, userId: string): Promise<TenantGroup[]> {
    const tenantGroupMemberRepo = await this.tenantDbService.getRepository(tenantId, TenantGroupMember);

    const memberships = await tenantGroupMemberRepo.find({
      where: { tenantUserId: userId },
      relations: ['group'],
    });

    return memberships.map((m) => m.group).filter(Boolean) as TenantGroup[];
  }

  /**
   * Add user to groups
   */
  async addToGroups(
    tenantId: string,
    userId: string,
    groupIds: string[],
    actorId?: string,
  ): Promise<void> {
    const tenantGroupMemberRepo = await this.tenantDbService.getRepository(tenantId, TenantGroupMember);
    const tenantGroupRepo = await this.tenantDbService.getRepository(tenantId, TenantGroup);

    for (const groupId of groupIds) {
      // Check if group exists
      const group = await tenantGroupRepo.findOne({ where: { id: groupId } });
      if (!group) {
        throw new NotFoundException(`Group ${groupId} not found`);
      }

      // Check if already a member
      const existing = await tenantGroupMemberRepo.findOne({
        where: { tenantUserId: userId, groupId },
      });
      if (existing) continue;

      const membership = tenantGroupMemberRepo.create({
        tenantUserId: userId,
        groupId,
        addedBy: actorId,
      });
      await tenantGroupMemberRepo.save(membership);

      await this.logAudit(
        tenantId,
        userId,
        'group_joined',
        actorId,
        null,
        { groupId, groupName: group.name },
      );
    }
  }

  /**
   * Remove user from groups
   */
  async removeFromGroups(
    tenantId: string,
    userId: string,
    groupIds: string[],
    actorId?: string,
  ): Promise<void> {
    const tenantGroupMemberRepo = await this.tenantDbService.getRepository(tenantId, TenantGroupMember);
    const tenantGroupRepo = await this.tenantDbService.getRepository(tenantId, TenantGroup);

    for (const groupId of groupIds) {
      const group = await tenantGroupRepo.findOne({ where: { id: groupId } });
      await tenantGroupMemberRepo.delete({ tenantUserId: userId, groupId });

      await this.logAudit(
        tenantId,
        userId,
        'group_left',
        actorId,
        { groupId, groupName: group?.name },
        null,
      );
    }
  }

  /**
   * Get user audit log
   */
  async getUserAuditLog(
    tenantId: string,
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<UserAuditLog[]> {
    const auditRepo = await this.tenantDbService.getRepository(tenantId, UserAuditLog);
    return auditRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['actor'],
    });
  }

  // Private helper methods

  private async createDefaultPreferences(tenantId: string, userId: string): Promise<void> {
    const prefRepo = await this.tenantDbService.getRepository(tenantId, UserPreference);
    const pref = prefRepo.create({ userId });
    await prefRepo.save(pref);
  }

  private async logAudit(
    tenantId: string,
    userId: string,
    action: UserAuditAction,
    actorId?: string,
    oldValue?: Record<string, unknown> | null,
    newValue?: Record<string, unknown> | null,
  ): Promise<void> {
    const auditRepo = await this.tenantDbService.getRepository(tenantId, UserAuditLog);
    const log = auditRepo.create({
      userId,
      action,
      actorId,
      actorType: actorId ? 'user' : 'system',
      oldValue,
      newValue,
    });
    await auditRepo.save(log);
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
