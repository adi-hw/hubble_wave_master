import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
import {
  EventBusService,
  EventTopic,
  GroupMembershipChangedPayload,
  RolePermissionChangedPayload,
  UserRoleChangedPayload,
} from '@hubblewave/event-bus';

/**
 * Cached permission data for a user
 */
export interface UserPermissionCache {
  userId: string;
  permissions: Set<string>;          // Permission codes
  permissionDetails: Map<string, Permission>;  // code -> full permission
  roleIds: string[];                 // Direct + inherited role IDs
  roles: Role[];               // Full role objects
  /**
   * W6.D / F047 — direct group membership IDs for the user. Populated
   * by `computeUserPermissions` as a by-product of fetching group roles.
   * Surfaced here so callers (e.g. `IdentityResolverAdapter`) can include
   * the group list in the request context without an extra DB query.
   */
  groupIds: string[];
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
 *
 * Cache invalidation is event-driven: entity changes on UserRole, RolePermission,
 * GroupRole, and GroupMember publish identity.* events on the cross-service bus,
 * and this service subscribes to drop the affected user(s) from the cache. The
 * 30-second TTL is a fallback for the rare case the bus drops a message — under
 * a healthy bus, role revocations propagate in well under a second.
 */
@Injectable()
export class PermissionResolverService implements OnModuleInit {
  private readonly logger = new Logger(PermissionResolverService.name);

  // In-memory cache: userId -> cached permissions
  private cache = new Map<string, UserPermissionCache>();

  // Cache TTL in milliseconds. Events are the primary invalidation path; this
  // is a safety net for cases where the event bus is unreachable.
  private readonly CACHE_TTL_MS = 30 * 1000;

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
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<UserRoleChangedPayload>(
      EventTopic.IdentityUserRoleChanged,
      (payload) => {
        for (const userId of payload.userIds ?? []) {
          this.invalidateUserCache(userId);
        }
      },
    );

    this.eventBus.subscribe<RolePermissionChangedPayload>(
      EventTopic.IdentityRolePermissionChanged,
      async (payload) => {
        await Promise.all(
          (payload.roleIds ?? []).map((roleId) =>
            this.invalidateRoleCache(roleId),
          ),
        );
      },
    );

    this.eventBus.subscribe<GroupMembershipChangedPayload>(
      EventTopic.IdentityGroupMembershipChanged,
      (payload) => {
        for (const userId of payload.userIds ?? []) {
          this.invalidateUserCache(userId);
        }
      },
    );
  }

  /**
   * W6.D / F047 — batch group lookup for multiple users in a single SQL
   * IN-query, with request-scoped cache support.
   *
   * Callers that need group IDs for N users (e.g. batch authz checks on
   * bulk record endpoints) should call this once before their loop and
   * index into the returned Map rather than calling `getUserPermissions`
   * per user — that pattern issues N separate DB round-trips.
   *
   * Cache semantics:
   *   - If `ctx.groupCache` is provided, entries already in the cache are
   *     returned directly; only the uncached userIds hit the DB.
   *   - DB hits are written back into `ctx.groupCache` for the remainder
   *     of the request.
   *   - When `ctx` is absent, falls through to a direct DB batch query with
   *     no caching.
   *
   * The in-process `UserPermissionCache` (keyed by userId, 30s TTL) is
   * also checked as a secondary source when the group cache misses but
   * the full permission cache is warm — avoids a DB query in the common
   * case where the user was recently resolved via `getUserPermissions`.
   *
   * @param userIds - Deduplicated list of user IDs to resolve.
   * @param groupCacheCtx - Optional request-scoped cache (`UserRequestContext.groupCache`).
   * @returns Map from userId → direct groupIds[]. Users with no memberships map to `[]`.
   */
  async getUserGroupsBatch(
    userIds: string[],
    groupCacheCtx?: Map<string, string[]>,
  ): Promise<Map<string, string[]>> {
    if (userIds.length === 0) {
      return new Map<string, string[]>();
    }

    const result = new Map<string, string[]>();
    const uncached: string[] = [];

    for (const uid of userIds) {
      // 1. Request-scoped cache hit.
      if (groupCacheCtx?.has(uid)) {
        result.set(uid, groupCacheCtx.get(uid)!);
        continue;
      }

      // 2. In-process permission cache hit — groupIds already computed.
      const permCached = this.cache.get(uid);
      if (permCached && permCached.expiresAt > new Date()) {
        const gids = permCached.groupIds;
        result.set(uid, gids);
        groupCacheCtx?.set(uid, gids);
        continue;
      }

      uncached.push(uid);
    }

    if (uncached.length === 0) {
      return result;
    }

    // 3. Single SQL IN-query for all uncached users (the N+1 fix).
    const rows = await this.groupMemberRepo.find({
      where: { userId: In(uncached) },
      select: ['userId', 'groupId'],
    });

    // Bucket by userId.
    const fromDb = new Map<string, string[]>();
    for (const uid of uncached) {
      fromDb.set(uid, []);
    }
    for (const row of rows) {
      fromDb.get(row.userId)?.push(row.groupId);
    }

    for (const [uid, gids] of fromDb) {
      result.set(uid, gids);
      groupCacheCtx?.set(uid, gids);
    }

    return result;
  }

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

    if (this.hasAdminRole(userPerms)) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Granted via admin role',
        grantedVia: 'role',
      };
    }

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
    if (this.hasAdminRole(userPerms)) return true;

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
    if (this.hasAdminRole(userPerms)) return true;

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

    // Step 2: Get roles from group membership. Capture groupIds as a
    // by-product (W6.D / F047) — returned in the cache entry so callers
    // can include them in the request context without an additional query.
    let groupRoleIds = new Set<string>();
    let resolvedGroupIds: string[] = [];
    try {
      const groupMemberships = await this.groupMemberRepo.find({
        where: { userId: userId },
      });

      if (groupMemberships.length > 0) {
        resolvedGroupIds = groupMemberships.map((m) => m.groupId);
        const groupRoles = await this.groupRoleRepo.find({
          where: { groupId: In(resolvedGroupIds) },
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
      groupIds: resolvedGroupIds,
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

  private hasAdminRole(userPerms: UserPermissionCache): boolean {
    if (userPerms.permissions.has('system.admin') || userPerms.permissions.has('*')) {
      return true;
    }
    // Only seeded `isSystem` roles count as admin via the code-based
    // fast-path. Without the `isSystem` gate, an operator with
    // `roles.create` could self-assign a custom role coded `admin`
    // and inherit platform admin via the string match alone.
    return userPerms.roles.some(
      (role) =>
        role.isSystem === true &&
        ['admin', 'system_admin', 'superadmin'].includes(role.code.toLowerCase()),
    );
  }

}
