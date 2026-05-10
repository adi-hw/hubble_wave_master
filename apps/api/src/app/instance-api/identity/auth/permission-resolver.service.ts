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

export interface UserPermissionCache {
  userId: string;
  permissions: Set<string>;
  permissionDetails: Map<string, Permission>;
  roleIds: string[];
  roles: Role[];
  computedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class PermissionResolverService {
  private readonly logger = new Logger(PermissionResolverService.name);
  private cache = new Map<string, UserPermissionCache>();
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

  async getUserPermissions(userId: string, forceRefresh = false): Promise<UserPermissionCache> {
    if (!forceRefresh) {
      const cached = this.cache.get(userId);
      if (cached && cached.expiresAt > new Date()) {
        return cached;
      }
    }

    const permissions = await this.computeUserPermissions(userId);
    this.cache.set(userId, permissions);
    return permissions;
  }

  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const userPerms = await this.getUserPermissions(userId);

    const category = permissionCode.split('.')[0];
    if (userPerms.permissions.has(`${category}.*`) || userPerms.permissions.has('*')) {
      return true;
    }

    return userPerms.permissions.has(permissionCode);
  }

  invalidateUserCache(userId: string): void {
    this.cache.delete(userId);
    this.logger.debug(`Invalidated permission cache for user ${userId}`);
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async computeUserPermissions(userId: string): Promise<UserPermissionCache> {
    const now = new Date();

    const directAssignments = await this.userRoleRepo.find({
      where: [
        { userId, validUntil: IsNull() },
        { userId, validUntil: MoreThan(now) },
      ],
      relations: ['role'],
    });

    const directRoleIds = new Set(directAssignments.map((a) => a.roleId));

    let groupRoleIds = new Set<string>();
    try {
      const groupMemberships = await this.groupMemberRepo.find({
        where: { userId },
      });

      if (groupMemberships.length > 0) {
        const groupIds = groupMemberships.map((m) => m.groupId);
        const groupRoles = await this.groupRoleRepo.find({
          where: { groupId: In(groupIds) },
        });
        groupRoleIds = new Set(groupRoles.map((gr) => gr.roleId));
      }
    } catch {
      this.logger.debug('Could not fetch group roles');
    }

    const allDirectRoleIds = new Set([...directRoleIds, ...groupRoleIds]);
    const allRoleIds = await this.collectInheritedRoles(Array.from(allDirectRoleIds));

    const roles = allRoleIds.length > 0
      ? await this.roleRepo.find({
          where: { id: In(allRoleIds), isActive: true },
        })
      : [];

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
