import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { In, Repository } from 'typeorm';
import {
  Role,
  Permission,
  RolePermission,
  UserRole,
} from '@hubblewave/instance-db';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionResolverService } from './permission-resolver.service';

export interface CreateRoleDto {
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  color?: string;
  isDefault?: boolean;
  weight?: number;
  permissions?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  parentId?: string | null;
  color?: string;
  isDefault?: boolean;
  isActive?: boolean;
  weight?: number;
}

export interface RoleListOptions {
  search?: string;
  includeInactive?: boolean;
  parentId?: string | null;
  isSystem?: boolean;
  isDefault?: boolean;
}

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async createRole(dto: CreateRoleDto, createdBy?: string): Promise<Role> {
    // Check for duplicate code
    const existing = await this.roleRepo.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Role with code "${dto.code}" already exists`);
    }

    // Validate parent role
    if (dto.parentId) {
      const parent = await this.roleRepo.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent role not found: ${dto.parentId}`);
      }
      if (await this.wouldCreateCycle(null, dto.parentId)) {
        throw new BadRequestException('Invalid parent role: would create circular reference');
      }
    }

    const role = this.roleRepo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description,
      parentId: dto.parentId || null,
      color: dto.color || '#6366f1',
      isDefault: dto.isDefault ?? false,
      isSystem: false,
      isActive: true,
      weight: dto.weight ?? 0,
      createdBy,
    });

    const savedRole = await this.roleRepo.save(role);

    if (dto.permissions && dto.permissions.length > 0) {
      await this.setRolePermissions(savedRole.id, dto.permissions);
    }

    this.logger.log(`Created role: ${savedRole.name} (${savedRole.code})`);
    return this.getRoleById(savedRole.id);
  }

  async getRoleById(roleId: string): Promise<Role & { userCount?: number; permissionCount?: number }> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
      relations: ['parent', 'rolePermissions', 'rolePermissions.permission'],
    });

    if (!role) {
      throw new NotFoundException(`Role not found: ${roleId}`);
    }

    const userCount = await this.getRoleUserCount(roleId);
    const permissionCount = role.rolePermissions?.length || 0;

    return { ...role, userCount, permissionCount };
  }

  async getRoleByCode(code: string): Promise<Role & { userCount?: number; permissionCount?: number }> {
    const role = await this.roleRepo.findOne({
      where: { code },
      relations: ['parent', 'rolePermissions', 'rolePermissions.permission'],
    });

    if (!role) {
      throw new NotFoundException(`Role not found: ${code}`);
    }

    const userCount = await this.getRoleUserCount(role.id);
    const permissionCount = role.rolePermissions?.length || 0;

    return { ...role, userCount, permissionCount };
  }

  async listRoles(options: RoleListOptions = {}): Promise<(Role & { userCount?: number; permissionCount?: number })[]> {
    const query = this.roleRepo.createQueryBuilder('role')
      .leftJoinAndSelect('role.parent', 'parent');

    if (!options.includeInactive) {
      query.andWhere('role.isActive = :isActive', { isActive: true });
    }

    if (options.search) {
      query.andWhere(
        '(role.name ILIKE :search OR role.code ILIKE :search OR role.description ILIKE :search)',
        { search: `%${options.search}%` },
      );
    }

    if (options.parentId !== undefined) {
      if (options.parentId === null) {
        query.andWhere('role.parentId IS NULL');
      } else {
        query.andWhere('role.parentId = :parentId', { parentId: options.parentId });
      }
    }

    if (options.isSystem !== undefined) {
      query.andWhere('role.isSystem = :isSystem', { isSystem: options.isSystem });
    }

    if (options.isDefault !== undefined) {
      query.andWhere('role.isDefault = :isDefault', { isDefault: options.isDefault });
    }

    query.orderBy('role.weight', 'DESC')
      .addOrderBy('role.name', 'ASC');

    const roles = await query.getMany();
    const rolesWithCounts: (Role & { userCount?: number; permissionCount?: number })[] = [];

    for (const role of roles) {
      const userCount = await this.getRoleUserCount(role.id);
      const permissionCount = await this.getRolePermissionCount(role.id);
      rolesWithCounts.push({ ...role, userCount, permissionCount });
    }

    return rolesWithCounts;
  }

  async getRoleHierarchy(): Promise<any[]> {
    const roles = await this.listRoles({ includeInactive: false });
    const rootRoles: any[] = [];

    const rolesWithChildren = roles.map(r => ({ ...r, children: [] as any[] }));
    const roleWithChildrenMap = new Map(rolesWithChildren.map(r => [r.id, r]));

    for (const role of rolesWithChildren) {
      if (!role.parentId) {
        rootRoles.push(role);
      } else {
        const parent = roleWithChildrenMap.get(role.parentId);
        if (parent) {
          parent.children.push(role);
        }
      }
    }
    return rootRoles;
  }

  async updateRole(
    roleId: string,
    dto: UpdateRoleDto,
    updatedBy?: string,
  ): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role not found: ${roleId}`);
    }

    if (dto.parentId !== undefined && dto.parentId !== role.parentId) {
      if (dto.parentId) {
        const parent = await this.roleRepo.findOne({
          where: { id: dto.parentId },
        });
        if (!parent) {
          throw new NotFoundException(`Parent role not found: ${dto.parentId}`);
        }
        if (await this.wouldCreateCycle(roleId, dto.parentId)) {
          throw new BadRequestException('Invalid parent role: would create circular reference');
        }
      }
      role.parentId = dto.parentId || null;
    }

    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.color !== undefined) role.color = dto.color;
    if (dto.isDefault !== undefined) role.isDefault = dto.isDefault;
    if (dto.isActive !== undefined) role.isActive = dto.isActive;
    if (dto.weight !== undefined) role.weight = dto.weight;
    role.updatedBy = updatedBy;

    await this.roleRepo.save(role);
    await this.permissionResolver.invalidateRoleCache(roleId);
    this.logger.log(`Updated role: ${role.name} (${role.id})`);

    return this.getRoleById(roleId);
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role not found: ${roleId}`);
    }

    if (role.isSystem) {
      throw new BadRequestException('Cannot delete system role');
    }

    const children = await this.roleRepo.find({
      where: { parentId: roleId },
    });
    if (children.length > 0) {
      throw new BadRequestException(
        `Cannot delete role with child roles. Remove or reassign ${children.length} child role(s) first.`,
      );
    }

    const userCount = await this.getRoleUserCount(roleId);
    if (userCount > 0) {
       throw new BadRequestException(`Cannot delete role assigned to ${userCount} users.`);
    }

    await this.roleRepo.remove(role);
    await this.permissionResolver.invalidateRoleCache(roleId);
    this.logger.log(`Deleted role: ${role.name} (${roleId})`);
  }

  async setRolePermissions(
    roleId: string,
    permissionCodes: string[],
  ): Promise<void> {
    await this.getRoleById(roleId);
    await this.rolePermissionRepo.delete({ roleId });

    if (permissionCodes.length === 0) {
      await this.permissionResolver.invalidateRoleCache(roleId);
      return;
    }

    const permissions = await this.permissionRepo.find({
      where: { code: In(permissionCodes) },
    });

    if (permissions.length === 0) {
      this.logger.warn(`No valid permissions found for codes: ${permissionCodes.join(', ')}`);
      await this.permissionResolver.invalidateRoleCache(roleId);
      return;
    }

    const assignments = permissions.map((perm) =>
      this.rolePermissionRepo.create({ roleId, permissionId: perm.id }),
    );
    await this.rolePermissionRepo.save(assignments);
    await this.permissionResolver.invalidateRoleCache(roleId);
    this.logger.log(`Set ${assignments.length} permissions for role ${roleId}`);
  }

  async addRolePermissions(
    roleId: string,
    permissionCodes: string[],
  ): Promise<void> {
    await this.getRoleById(roleId);

    const permissions = await this.permissionRepo.find({
      where: { code: In(permissionCodes) },
    });

    const existing = await this.rolePermissionRepo.find({
      where: { roleId },
      select: ['permissionId'],
    });
    const existingIds = new Set(existing.map((e) => e.permissionId));

    const newAssignments = permissions
      .filter((perm) => !existingIds.has(perm.id))
      .map((perm) => this.rolePermissionRepo.create({ roleId, permissionId: perm.id }));

    if (newAssignments.length > 0) {
      await this.rolePermissionRepo.save(newAssignments);
      await this.permissionResolver.invalidateRoleCache(roleId);
      this.logger.log(`Added ${newAssignments.length} permissions to role ${roleId}`);
    }
  }

  async removeRolePermissions(
    roleId: string,
    permissionCodes: string[],
  ): Promise<void> {
    await this.getRoleById(roleId);

    const permissions = await this.permissionRepo.find({
      where: { code: In(permissionCodes) },
      select: ['id'],
    });

    if (permissions.length > 0) {
      const permIds = permissions.map((p) => p.id);
      await this.rolePermissionRepo.delete({ roleId, permissionId: In(permIds) });
      await this.permissionResolver.invalidateRoleCache(roleId);
      this.logger.log(`Removed ${permissions.length} permissions from role ${roleId}`);
    }
  }

  async getRoleEffectivePermissions(
    roleId: string,
  ): Promise<{ direct: Permission[]; inherited: Permission[] }> {
    const directPerms = await this.rolePermissionRepo.find({
      where: { roleId },
      relations: ['permission'],
    });
    const direct = directPerms
      .filter((rp) => rp.permission)
      .map((rp) => rp.permission!);

    const inherited: Permission[] = [];
    const directIds = new Set(direct.map((p) => p.id));

    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    let currentParentId = role?.parentId;

    while (currentParentId) {
      const parentPerms = await this.rolePermissionRepo.find({
        where: { roleId: currentParentId },
        relations: ['permission'],
      });

      for (const rp of parentPerms) {
        if (rp.permission && !directIds.has(rp.permission.id)) {
          inherited.push(rp.permission);
          directIds.add(rp.permission.id);
        }
      }

      const parent = await this.roleRepo.findOne({
        where: { id: currentParentId },
        select: ['parentId'],
      });
      currentParentId = parent?.parentId || null;
    }

    return { direct, inherited };
  }

  private async getRoleUserCount(roleId: string): Promise<number> {
    return this.userRoleRepo.count({ where: { roleId } });
  }

  private async getRolePermissionCount(roleId: string): Promise<number> {
    return this.rolePermissionRepo.count({ where: { roleId } });
  }

  private async wouldCreateCycle(
    roleId: string | null,
    parentId: string,
  ): Promise<boolean> {
    if (!roleId) return false;

    const visited = new Set<string>();
    let currentId: string | null = parentId;

    while (currentId) {
      if (currentId === roleId) {
        return true;
      }
      if (visited.has(currentId)) {
        break;
      }
      visited.add(currentId);

      const current = await this.roleRepo.findOne({
        where: { id: currentId },
        select: ['parentId'],
      });
      currentId = current?.parentId || null;
    }

    return false;
  }
}
