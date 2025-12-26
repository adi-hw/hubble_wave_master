import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, MoreThan, IsNull } from 'typeorm';
import {
  Role,
  UserRole,
  AssignmentSource,
  User,
} from '@hubblewave/instance-db';
import { PermissionResolverService } from './permission-resolver.service';

/**
 * DTO for assigning role to user
 */
export interface AssignRoleDto {
  userId: string;        // User ID
  roleId: string;
  source?: AssignmentSource;
  expiresAt?: Date; // maps to validUntil
}

/**
 * DTO for bulk role assignment
 */
export interface BulkAssignRoleDto {
  userIds: string[];
  roleId: string;
  source?: AssignmentSource;
  expiresAt?: Date; // maps to validUntil
}

/**
 * Query options for user role assignments
 */
export interface UserRoleListOptions {
  userId?: string;
  roleId?: string;
  source?: AssignmentSource;
  includeExpired?: boolean;
}

/**
 * UserRoleService - Manages user-role assignments
 */
@Injectable()
export class UserRoleService {
  private readonly logger = new Logger(UserRoleService.name);

  constructor(
    @InjectRepository(UserRole) private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  /**
   * Assign a role to a user
   */
  async assignRole(
    dto: AssignRoleDto,
    assignedBy?: string,
  ): Promise<UserRole> {
    // Verify user exists
    const user = await this.userRepo.findOne({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User not found: ${dto.userId}`);
    }

    // Verify role exists
    const role = await this.roleRepo.findOne({
      where: { id: dto.roleId, isActive: true },
    });
    if (!role) {
      throw new NotFoundException(`Role not found or inactive: ${dto.roleId}`);
    }

    // Check for existing assignment (same user, role, scope)
    const existing = await this.userRoleRepo.findOne({
      where: {
        userId: dto.userId,
        roleId: dto.roleId,
      },
    });

    if (existing) {
      // Update expiration if changed
      if (dto.expiresAt !== undefined) {
        existing.validUntil = dto.expiresAt;
        await this.userRoleRepo.save(existing);
        this.logger.log(`Updated role assignment expiration: ${role.name} -> ${user.displayName || user.email}`);
        return existing;
      }
      throw new ConflictException('Role already assigned to user with same scope');
    }

    // Create assignment
    const assignment = this.userRoleRepo.create({
      userId: dto.userId,
      roleId: dto.roleId,
      source: dto.source || 'direct',
      validUntil: dto.expiresAt || null,
      createdBy: assignedBy,
    });

    const saved = await this.userRoleRepo.save(assignment);

    // Invalidate permission cache
    this.permissionResolver.invalidateUserCache(dto.userId);

    this.logger.log(`Assigned role ${role.name} to user ${user.displayName || user.email}`);

    return saved;
  }

  /**
   * Bulk assign role to multiple users
   */
  async bulkAssignRole(
    dto: BulkAssignRoleDto,
    assignedBy?: string,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;

    for (const userId of dto.userIds) {
      try {
        await this.assignRole(
          {
            userId,
            roleId: dto.roleId,
            source: dto.source,
            expiresAt: dto.expiresAt,
          },
          assignedBy,
        );
        success++;
      } catch (err) {
        errors.push(`User ${userId}: ${(err as Error).message}`);
      }
    }

    return {
      success,
      failed: dto.userIds.length - success,
      errors,
    };
  }

  /**
   * Remove role from user
   */
  async removeRole(
    userId: string,
    roleId: string,
  ): Promise<void> {

    const where: any = {
      userId,
      roleId,
    };

    const assignment = await this.userRoleRepo.findOne({ where });

    if (!assignment) {
      throw new NotFoundException('Role assignment not found');
    }

    await this.userRoleRepo.remove(assignment);

    // Invalidate permission cache
    this.permissionResolver.invalidateUserCache(userId);

    this.logger.log(`Removed role ${roleId} from user ${userId}`);
  }

  /**
   * Remove all roles from a user
   */
  async removeAllRoles(userId: string): Promise<number> {
    const result = await this.userRoleRepo.delete({ userId });

    // Invalidate permission cache
    this.permissionResolver.invalidateUserCache(userId);

    this.logger.log(`Removed all roles from user ${userId}`);

    return result.affected || 0;
  }

  /**
   * Get all role assignments for a user
   */
  async getUserRoles(
    userId: string,
    includeExpired = false,
  ): Promise<UserRole[]> {
    const query = this.userRoleRepo.createQueryBuilder('ur')
      .leftJoinAndSelect('ur.role', 'role')
      .leftJoinAndSelect('ur.createdByUser', 'createdBy')
      .where('(ur.userId = :userId)', { userId });

    if (!includeExpired) {
      query.andWhere('(ur.validUntil IS NULL OR ur.validUntil > :now)', { now: new Date() });
    }

    query.orderBy('role.name', 'ASC');

    return query.getMany();
  }

  /**
   * Get all users with a specific role
   */
  async getRoleUsers(
    roleId: string,
    includeExpired = false,
  ): Promise<UserRole[]> {
    const query = this.userRoleRepo.createQueryBuilder('ur')
      .leftJoinAndSelect('ur.user', 'user')
      .leftJoinAndSelect('ur.createdByUser', 'createdBy')
      .where('ur.roleId = :roleId', { roleId });

    if (!includeExpired) {
      query.andWhere('(ur.validUntil IS NULL OR ur.validUntil > :now)', { now: new Date() });
    }

    query.orderBy('ur.createdAt', 'DESC');

    return query.getMany();
  }

  /**
   * List role assignments with filters
   */
  async listAssignments(
    options: UserRoleListOptions = {},
  ): Promise<UserRole[]> {
    const query = this.userRoleRepo.createQueryBuilder('ur')
      .leftJoinAndSelect('ur.role', 'role')
      .leftJoinAndSelect('ur.user', 'user')
      .leftJoinAndSelect('ur.createdByUser', 'createdBy');

    if (options.userId) {
      query.andWhere('(ur.userId = :userId)', {
        userId: options.userId,
      });
    }

    if (options.roleId) {
      query.andWhere('ur.roleId = :roleId', { roleId: options.roleId });
    }

    if (options.source) {
      query.andWhere('ur.source = :source', { source: options.source });
    }

    if (!options.includeExpired) {
      query.andWhere('(ur.validUntil IS NULL OR ur.validUntil > :now)', { now: new Date() });
    }

    query.orderBy('ur.createdAt', 'DESC');

    return query.getMany();
  }

  /**
   * Set roles for a user (replace all existing)
   */
  async setUserRoles(
    userId: string,
    roleIds: string[],
    assignedBy?: string,
  ): Promise<UserRole[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    // Remove existing direct assignments
    await this.userRoleRepo.delete({
      userId,
      source: 'direct',
    });

    if (roleIds.length === 0) {
      this.permissionResolver.invalidateUserCache(userId);
      return [];
    }

    // Verify all roles exist
    const roles = await this.roleRepo.find({
      where: { id: In(roleIds), isActive: true }, // deletedAt removed
    });

    if (roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map((r) => r.id));
      const missing = roleIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Some roles not found or inactive: ${missing.join(', ')}`);
    }

    // Create new assignments
    const assignments = roleIds.map((roleId) =>
      this.userRoleRepo.create({
        userId,
        roleId,
        source: 'direct',
        createdBy: assignedBy,
      }),
    );

    const saved = await this.userRoleRepo.save(assignments);

    // Invalidate cache
    this.permissionResolver.invalidateUserCache(userId);

    this.logger.log(`Set ${saved.length} roles for user ${userId}`);

    return saved;
  }

  /**
   * Check if user has a specific role
   */
  async userHasRole(
    userId: string,
    roleId: string,
  ): Promise<boolean> {
    const count = await this.userRoleRepo.count({
      where: [
        { userId, roleId, validUntil: IsNull() },
        { userId, roleId, validUntil: MoreThan(new Date()) },
      ],
    });
    return count > 0;
  }

  /**
   * Clean up expired role assignments
   */
  async cleanupExpiredAssignments(): Promise<number> {
    // Get expired assignments to invalidate cache
    const expired = await this.userRoleRepo.find({
      where: { validUntil: LessThan(new Date()) },
      select: ['userId'],
    });

    if (expired.length === 0) {
      return 0;
    }

    // Delete expired
    const result = await this.userRoleRepo.delete({
      validUntil: LessThan(new Date()),
    });

    // Invalidate cache for affected users
    const userIds = new Set(expired.map((e: any) => e.userId).filter(Boolean));
    for (const userId of userIds) {
      if (userId) {
        this.permissionResolver.invalidateUserCache(userId);
      }
    }

    this.logger.log(`Cleaned up ${result.affected} expired role assignments`);

    return result.affected || 0;
  }

  /**
   * Get users without any roles
   */
  async getUsersWithoutRoles(): Promise<User[]> {
    const users = await this.userRepo
      .createQueryBuilder('user')
      .leftJoin(UserRole, 'ur', 'ur.user_id = user.id')
      .where('ur.id IS NULL')
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getMany();

    return users;
  }

  /**
   * Assign default roles to a new user
   */
  async assignDefaultRoles(userId: string): Promise<UserRole[]> {
    // Find default roles
    const defaultRoles = await this.roleRepo.find({
      where: { isDefault: true, isActive: true }, // deletedAt removed
    });

    if (defaultRoles.length === 0) {
      return [];
    }

    // Assign each default role
    const assignments: UserRole[] = [];
    for (const role of defaultRoles) {
      try {
        const assignment = await this.assignRole({
          userId,
          roleId: role.id,
          source: 'direct',
        });
        assignments.push(assignment);
      } catch (err) {
        // Ignore if already assigned
        this.logger.debug(`Could not assign default role ${role.name}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Assigned ${assignments.length} default roles to user ${userId}`);

    return assignments;
  }
}
