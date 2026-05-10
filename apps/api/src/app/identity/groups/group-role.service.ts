import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Repository, In, MoreThan, IsNull } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Group,
  GroupRole,
  GroupMember,
  Role,
} from '@hubblewave/instance-db';

// ============================================================================
// DTOs
// ============================================================================

export interface AssignRoleDto {
  roleId: string;
}

export interface GroupRoleAssignment extends GroupRole {
  role?: Role;
}

export interface InheritedGroupRole {
  role: Role;
  fromGroupId: string;
  fromGroupName: string;
  depth: number;
}

export interface UserGroupRoleInfo {
  roleId: string;
  roleName: string;
  roleCode: string;
  roleColor?: string | null;
  source: 'direct' | 'group';
  groupId?: string;
  groupName?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class GroupRoleService {
  private readonly logger = new Logger(GroupRoleService.name);

  constructor(
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    @InjectRepository(GroupRole)
    private readonly groupRoleRepo: Repository<GroupRole>,
    @InjectRepository(GroupMember)
    private readonly memberRepo: Repository<GroupMember>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  // ==========================================================================
  // Role Assignment
  // ==========================================================================

  /**
   * Assign a role to a group
   */
  async assignRole(
    groupId: string,
    dto: AssignRoleDto,
    assignedBy?: string,
  ): Promise<GroupRoleAssignment> {
    // Validate group exists
    const group = await this.groupRepo.findOne({
      where: { id: groupId, isActive: true },
    });
    if (!group) {
      throw new NotFoundException(`Group not found: ${groupId}`);
    }

    // Validate role exists
    const role = await this.roleRepo.findOne({
      where: { id: dto.roleId, isActive: true },
    });
    if (!role) {
      throw new NotFoundException(`Role not found: ${dto.roleId}`);
    }

    // Check if already assigned
    const existing = await this.groupRoleRepo.findOne({
      where: { groupId, roleId: dto.roleId },
    });
    if (existing) {
      throw new ConflictException('Role is already assigned to this group');
    }

    const groupRole = this.groupRoleRepo.create({
      groupId,
      roleId: dto.roleId,
      createdBy: assignedBy,
    });

    const saved = await this.groupRoleRepo.save(groupRole);
    this.logger.log(`Assigned role ${role.name} to group ${group.name}`);

    return { ...saved, role };
  }

  /**
   * Remove a role from a group
   */
  async revokeRole(groupId: string, roleId: string): Promise<void> {
    const groupRole = await this.groupRoleRepo.findOne({
      where: { groupId, roleId },
    });

    if (!groupRole) {
      throw new NotFoundException('Role assignment not found');
    }

    await this.groupRoleRepo.remove(groupRole);
    this.logger.log(`Revoked role ${roleId} from group ${groupId}`);
  }

  /**
   * Bulk assign roles to a group
   */
  async bulkAssignRoles(
    groupId: string,
    roleIds: string[],
    assignedBy?: string,
  ): Promise<{ assigned: number; skipped: number }> {
    // Validate group exists
    const group = await this.groupRepo.findOne({
      where: { id: groupId, isActive: true },
    });
    if (!group) {
      throw new NotFoundException(`Group not found: ${groupId}`);
    }

    // Get existing assignments
    const existing = await this.groupRoleRepo.find({
      where: { groupId },
      select: ['roleId'],
    });
    const existingRoleIds = new Set(existing.map((gr) => gr.roleId));

    let assigned = 0;
    let skipped = 0;

    for (const roleId of roleIds) {
      if (existingRoleIds.has(roleId)) {
        skipped++;
        continue;
      }

      // Validate role exists
      const role = await this.roleRepo.findOne({
        where: { id: roleId, isActive: true },
      });
      if (!role) {
        skipped++;
        continue;
      }

      const groupRole = this.groupRoleRepo.create({
        groupId,
        roleId,
        createdBy: assignedBy,
      });
      await this.groupRoleRepo.save(groupRole);
      assigned++;
    }

    this.logger.log(
      `Bulk assigned ${assigned} roles to group ${groupId} (skipped: ${skipped})`,
    );

    return { assigned, skipped };
  }

  // ==========================================================================
  // Role Queries
  // ==========================================================================

  /**
   * Get roles directly assigned to a group
   */
  async getGroupRoles(groupId: string): Promise<GroupRoleAssignment[]> {
    const assignments = await this.groupRoleRepo.find({
      where: { groupId },
      relations: ['role'],
    });

    return assignments.filter((a) => a.role?.isActive);
  }

  /**
   * Get roles inherited from ancestor groups
   */
  async getInheritedRoles(groupId: string): Promise<InheritedGroupRole[]> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
    });

    if (!group || !group.hierarchyPath) {
      return [];
    }

    const ancestorIds = group.hierarchyPath.split('/').filter(Boolean);
    if (ancestorIds.length === 0) {
      return [];
    }

    const ancestors = await this.groupRepo.find({
      where: { id: In(ancestorIds), isActive: true },
      order: { hierarchyLevel: 'ASC' },
    });

    const inheritedRoles: InheritedGroupRole[] = [];

    for (const ancestor of ancestors) {
      const ancestorRoles = await this.groupRoleRepo.find({
        where: { groupId: ancestor.id },
        relations: ['role'],
      });

      for (const gr of ancestorRoles) {
        if (gr.role?.isActive) {
          inheritedRoles.push({
            role: gr.role,
            fromGroupId: ancestor.id,
            fromGroupName: ancestor.name,
            depth: group.hierarchyLevel - ancestor.hierarchyLevel,
          });
        }
      }
    }

    return inheritedRoles;
  }

  /**
   * Get all effective roles for a group (direct + inherited)
   */
  async getEffectiveRoles(groupId: string): Promise<{
    direct: GroupRoleAssignment[];
    inherited: InheritedGroupRole[];
  }> {
    const [direct, inherited] = await Promise.all([
      this.getGroupRoles(groupId),
      this.getInheritedRoles(groupId),
    ]);

    return { direct, inherited };
  }

  /**
   * Get all effective roles for a user through their group memberships
   */
  async getUserEffectiveRoles(userId: string): Promise<UserGroupRoleInfo[]> {
    const now = new Date();
    const effectiveRoles: UserGroupRoleInfo[] = [];
    const seenRoleIds = new Set<string>();

    // Get user's direct group memberships
    const memberships = await this.memberRepo.find({
      where: [
        { userId, validUntil: IsNull() },
        { userId, validUntil: MoreThan(now) },
      ],
      relations: ['group'],
    });

    for (const membership of memberships) {
      if (!membership.group?.isActive) continue;

      // Get direct roles from this group
      const groupRoles = await this.getGroupRoles(membership.group.id);
      for (const gr of groupRoles) {
        if (gr.role && !seenRoleIds.has(gr.role.id)) {
          seenRoleIds.add(gr.role.id);
          effectiveRoles.push({
            roleId: gr.role.id,
            roleName: gr.role.name,
            roleCode: gr.role.code,
            roleColor: gr.role.color,
            source: 'group',
            groupId: membership.group.id,
            groupName: membership.group.name,
          });
        }
      }

      // Get inherited roles from ancestor groups
      const inheritedRoles = await this.getInheritedRoles(membership.group.id);
      for (const ir of inheritedRoles) {
        if (!seenRoleIds.has(ir.role.id)) {
          seenRoleIds.add(ir.role.id);
          effectiveRoles.push({
            roleId: ir.role.id,
            roleName: ir.role.name,
            roleCode: ir.role.code,
            roleColor: ir.role.color,
            source: 'group',
            groupId: ir.fromGroupId,
            groupName: ir.fromGroupName,
          });
        }
      }
    }

    return effectiveRoles;
  }

  /**
   * Get all groups that have a specific role assigned
   */
  async getGroupsWithRole(roleId: string): Promise<Group[]> {
    const assignments = await this.groupRoleRepo.find({
      where: { roleId },
      relations: ['group'],
    });

    return assignments
      .filter((a) => a.group?.isActive)
      .map((a) => a.group!);
  }

  /**
   * Check if a group has a specific role (direct or inherited)
   */
  async hasRole(groupId: string, roleId: string): Promise<boolean> {
    // Check direct assignment
    const direct = await this.groupRoleRepo.findOne({
      where: { groupId, roleId },
    });
    if (direct) return true;

    // Check inherited
    const inherited = await this.getInheritedRoles(groupId);
    return inherited.some((ir) => ir.role.id === roleId);
  }

  /**
   * Get count of roles assigned to a group
   */
  async getRoleCount(groupId: string): Promise<{
    direct: number;
    inherited: number;
    total: number;
  }> {
    const direct = await this.groupRoleRepo.count({
      where: { groupId },
    });

    const inherited = await this.getInheritedRoles(groupId);

    return {
      direct,
      inherited: inherited.length,
      total: direct + inherited.length,
    };
  }
}
