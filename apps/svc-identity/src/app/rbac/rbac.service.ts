import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import {
  Group,
  GroupRole,
  Role,
  UserGroup,
  Permission,
  RolePermission,
  UserRoleAssignment,
  TenantUserMembership,
  RoleInheritance,
} from '@eam-platform/platform-db';
import { TenantDbService } from '@eam-platform/tenant-db';

@Injectable()
export class RbacService {
  constructor(
    private readonly tenantDbService: TenantDbService,
  ) {}

  async createRole(tenantId: string, name: string, description?: string, permissions: string[] = []) {
    const roleRepo = await this.tenantDbService.getRepository(tenantId, Role);
    const permissionRepo = await this.tenantDbService.getRepository(tenantId, Permission);
    const rolePermissionRepo = await this.tenantDbService.getRepository(tenantId, RolePermission);

    const role = await roleRepo.save(roleRepo.create({ tenantId, name, slug: name, description }));

    if (permissions.length > 0) {
      const perms = await permissionRepo.find({ where: { name: In(permissions) } });
      const toInsert = perms.map((perm) =>
        rolePermissionRepo.create({ roleId: role.id, permissionId: perm.id }),
      );
      if (toInsert.length) {
        await rolePermissionRepo.save(toInsert);
      }
    }

    return await roleRepo.findOne({
      where: { id: role.id },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });
  }

  async upsertGroup(tenantId: string, slug: string, name: string, description?: string) {
    const groupRepo = await this.tenantDbService.getRepository(tenantId, Group);
    let group = await groupRepo.findOne({ where: { slug, tenantId } });
    if (!group) {
      group = groupRepo.create({ slug, name, description, tenantId });
    } else {
      group.description = description;
      group.name = name;
    }
    return groupRepo.save(group);
  }

  async assignRoleToGroup(tenantId: string, groupId: string, roleId: string) {
    const groupRoleRepo = await this.tenantDbService.getRepository(tenantId, GroupRole);
    const exists = await groupRoleRepo.findOne({ where: { groupId, roleId } });
    if (exists) return exists;
    const rel = groupRoleRepo.create({ groupId, roleId });
    return groupRoleRepo.save(rel);
  }

  async addUserToGroup(tenantId: string, membershipId: string, groupId: string) {
    const userGroupRepo = await this.tenantDbService.getRepository(tenantId, UserGroup);
    const exists = await userGroupRepo.findOne({ where: { tenantUserMembershipId: membershipId, groupId } });
    if (exists) return exists;
    const rel = userGroupRepo.create({ tenantUserMembershipId: membershipId, groupId });
    return userGroupRepo.save(rel);
  }

  async listGroups(tenantId: string) {
    const groupRepo = await this.tenantDbService.getRepository(tenantId, Group);
    return groupRepo.find({ where: { tenantId } });
  }

  async listRoles(tenantId: string) {
    const roleRepo = await this.tenantDbService.getRepository(tenantId, Role);
    return roleRepo.find({
      where: { tenantId },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });
  }

  async getUserEffectiveRoles(tenantId: string, membershipId: string) {
    const membershipRepo = await this.tenantDbService.getRepository(tenantId, TenantUserMembership);
    const membership = await membershipRepo.findOne({ where: { id: membershipId } });
    if (!membership) throw new NotFoundException('Membership not found');
    const userRoleRepo = await this.tenantDbService.getRepository(tenantId, UserRoleAssignment);
    const directAssignments = await userRoleRepo.find({
      where: { tenantUserMembershipId: membershipId },
      relations: ['role', 'role.rolePermissions', 'role.rolePermissions.permission'],
    });

    const groupRoleRepo = await this.tenantDbService.getRepository(tenantId, GroupRole as any);
    const groupAssignments = await groupRoleRepo
      .createQueryBuilder('gr')
      .innerJoin(UserGroup, 'ug', 'ug.group_id = gr.group_id AND ug.tenant_user_membership_id = :membershipId', { membershipId })
      .leftJoinAndSelect('gr.role', 'role')
      .leftJoinAndSelect('role.rolePermissions', 'rp')
      .leftJoinAndSelect('rp.permission', 'perm')
      .getMany();

    const baseRoles = [
      ...directAssignments.map((ra) => ra.role),
      ...groupAssignments.map((gr) => gr.role),
    ].filter(Boolean);

    const roleMap = new Map<string, any>();
    baseRoles.forEach((r) => roleMap.set(r.id, r));

    const inheritanceRepo = await this.tenantDbService.getRepository<RoleInheritance>(tenantId, RoleInheritance as any);
    const roleRepo = await this.tenantDbService.getRepository<Role>(tenantId, Role as any);
    const collectInherited = async (roleIds: string[], visited: Set<string>) => {
      if (!roleIds.length) return;
      const rows = await inheritanceRepo.find({ where: [{ parentRoleId: In(roleIds) }] });
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

    const unique = Array.from(roleMap.values());
    const permissions = unique.flatMap((r) =>
      (r.rolePermissions || []).map((rp: any) => rp.permission?.name).filter(Boolean) as string[],
    );
    return { roles: unique, permissions };
  }
}
