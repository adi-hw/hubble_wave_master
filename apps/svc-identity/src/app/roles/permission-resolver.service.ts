import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan, IsNull } from 'typeorm';
import {
  Role,
  Permission,
  RolePermission,
  UserRole,
  GroupRole,
  GroupMember,
} from '@hubblewave/instance-db';

/**
 * Cached permission data for a user
 */
export interface UserPermissionCache {
  userId: string;
  permissions: Set<string>;          // Permission codes
  permissionDetails: Map<string, Permission>;  // code -> full permission
  roleIds: string[];                 // Direct + inherited role IDs
  roles: Role[];               // Full role objects
  computedAt: Date;
  expiresAt: Date;
}

/**
 * Result of permission check
 */
export interface PermissionCheckResult {
  allowed: boolean;
  permission: string;
  reason: string;
  requiresMfa?: boolean;
  grantedVia?: 'direct' | 'role' | 'group' | 'inherited';
  roleId?: string;
  roleName?: string;
}

/**
 * PermissionResolverService - Handles permission resolution with inheritance and caching
 */
@Injectable()
export class PermissionResolverService {
  private readonly logger = new Logger(PermissionResolverService.name);

  // In-memory cache: userId -> cached permissions
  private cache = new Map<string, UserPermissionCache>();

  // Cache TTL in milliseconds (5 minutes)
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(GroupRole)
    private readonly groupRoleRepo: Repository<GroupRole>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepo: Repository<GroupMember>,
  ) {}

  /**
   * Get all effective permissions for a user (with caching)
   */
  async getUserPermissions(userId: string, forceRefresh = false): Promise<UserPermissionCache> {
    const cacheKey = userId;

    // Check cache first
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > new Date()) {
        return cached;
      }
    }

    // Compute permissions
    const permissions = await this.computeUserPermissions(userId);

    // Cache the result
    this.cache.set(cacheKey, permissions);

    return permissions;
  }

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(
    userId: string,
    permissionCode: string,
  ): Promise<PermissionCheckResult> {
    const userPerms = await this.getUserPermissions(userId);

    // Check wildcard permission first (admin.*)
    const category = permissionCode.split('.')[0];
    if (userPerms.permissions.has(`${category}.*`) || userPerms.permissions.has('*')) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Granted via wildcard permission',
        grantedVia: 'role',
      };
    }

    // Check exact permission
    if (userPerms.permissions.has(permissionCode)) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Permission granted',
        grantedVia: 'role',
      };
    }

    return {
      allowed: false,
      permission: permissionCode,
      reason: 'Permission not granted to user',
    };
  }

  /**
   * Check multiple permissions at once
   */
  async hasAnyPermission(
    userId: string,
    permissionCodes: string[],
  ): Promise<boolean> {
    const userPerms = await this.getUserPermissions(userId);

    for (const code of permissionCodes) {
      if (userPerms.permissions.has(code)) {
        return true;
      }
      // Check wildcard
      const category = code.split('.')[0];
      if (userPerms.permissions.has(`${category}.*`) || userPerms.permissions.has('*')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user has ALL specified permissions
   */
  async hasAllPermissions(
    userId: string,
    permissionCodes: string[],
  ): Promise<boolean> {
    const userPerms = await this.getUserPermissions(userId);

    for (const code of permissionCodes) {
      if (!userPerms.permissions.has(code)) {
        // Check wildcard
        const category = code.split('.')[0];
        if (!userPerms.permissions.has(`${category}.*`) && !userPerms.permissions.has('*')) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get effective roles for a user
   */
  async getUserEffectiveRoles(userId: string): Promise<Role[]> {
    const userPerms = await this.getUserPermissions(userId);
    return userPerms.roles;
  }

  /**
   * Invalidate cache for a specific user
   */
  invalidateUserCache(userId: string): void {
    const cacheKey = userId;
    this.cache.delete(cacheKey);
    this.logger.debug(`Invalidated permission cache for user ${userId}`);
  }

  /**
   * Invalidate cache for all users with a specific role
   */
  async invalidateRoleCache(roleId: string): Promise<void> {
    const assignments = await this.userRoleRepo.find({
      where: { roleId },
      select: ['userId'],
    });

    for (const assignment of assignments) {
      if (assignment.userId) {
        this.invalidateUserCache(assignment.userId);
      }
    }

    this.logger.debug(`Invalidated permission cache for all users with role ${roleId}`);
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Cleared all permission cache');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async computeUserPermissions(userId: string): Promise<UserPermissionCache> {
    const now = new Date();

    // Step 1: Get direct role assignments (not expired)
    const directAssignments = await this.userRoleRepo.find({
      where: [
        { userId: userId, validUntil: IsNull() },
        { userId: userId, validUntil: MoreThan(now) },
      ],
      relations: ['role'],
    });

    const directRoleIds = new Set(directAssignments.map((a) => a.roleId));

    // Step 2: Get roles from group membership
    let groupRoleIds = new Set<string>();
    try {
      const groupMemberships = await this.groupMemberRepo.find({
        where: { userId: userId },
      });

      if (groupMemberships.length > 0) {
        const groupIds = groupMemberships.map((m) => m.groupId);
        const groupRoles = await this.groupRoleRepo.find({
          where: { groupId: In(groupIds) },
        });
        groupRoleIds = new Set(groupRoles.map((gr) => gr.roleId));
      }
    } catch (err) {
      this.logger.debug('Could not fetch group roles', err);
    }

    // Step 3: Combine all direct role IDs
    const allDirectRoleIds = new Set([...directRoleIds, ...groupRoleIds]);

    // Step 4: Recursively collect inherited roles
    const allRoleIds = await this.collectInheritedRoles(Array.from(allDirectRoleIds));

    // Step 5: Fetch all role details
    const roles = allRoleIds.length > 0
      ? await this.roleRepo.find({
          where: { id: In(allRoleIds), isActive: true },
        })
      : [];

    // Step 6: Fetch all permissions for these roles
    const permissions = new Set<string>();
    const permissionDetails = new Map<string, Permission>();

    if (allRoleIds.length > 0) {
      const rolePerms = await this.rolePermissionRepo.find({
        where: { roleId: In(allRoleIds) },
        relations: ['permission'],
      });

      for (const rp of rolePerms) {
        if (rp.permission) {
          permissions.add(rp.permission.code);
          permissionDetails.set(rp.permission.code, rp.permission);
        }
      }
    }

    return {
      userId,
      permissions,
      permissionDetails,
      roleIds: allRoleIds,
      roles,
      computedAt: now,
      expiresAt: new Date(now.getTime() + this.CACHE_TTL_MS),
    };
  }

  private async collectInheritedRoles(baseRoleIds: string[]): Promise<string[]> {
    if (baseRoleIds.length === 0) return [];

    const collected = new Set<string>(baseRoleIds);
    const toProcess = [...baseRoleIds];

    while (toProcess.length > 0) {
      const currentIds = toProcess.splice(0, 50);

      const roles = await this.roleRepo.find({
        where: { id: In(currentIds), isActive: true },
        select: ['id', 'parentId'],
      });

      for (const role of roles) {
        if (role.parentId && !collected.has(role.parentId)) {
          collected.add(role.parentId);
          toProcess.push(role.parentId);
        }
      }
    }

    return Array.from(collected);
  }

}
