import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Group,
  GroupType,
  GroupMember,
  GroupRole,
} from '@hubblewave/instance-db';

// ============================================================================
// DTOs
// ============================================================================

export interface CreateGroupDto {
  code: string;
  name: string;
  description?: string;
  type?: GroupType;
  parentId?: string | null;
  icon?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateGroupDto {
  name?: string;
  description?: string;
  type?: GroupType;
  parentId?: string | null;
  icon?: string;
  color?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface GroupListOptions {
  search?: string;
  type?: GroupType;
  parentId?: string | null;
  includeInactive?: boolean;
  includeCounts?: boolean;
}

export interface GroupWithCounts extends Group {
  directMemberCount?: number;
  totalMemberCount?: number;
  childGroupCount?: number;
  roleCount?: number;
}

export interface GroupHierarchyNode extends GroupWithCounts {
  children: GroupHierarchyNode[];
}

export interface GroupStats {
  organization: number;
  department: number;
  team: number;
  location: number;
  dynamic: number;
  standard: number;
  total: number;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly memberRepo: Repository<GroupMember>,
    @InjectRepository(GroupRole)
    private readonly groupRoleRepo: Repository<GroupRole>,
  ) {}

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Create a new group
   */
  async createGroup(dto: CreateGroupDto, createdBy?: string): Promise<GroupWithCounts> {
    // Check for duplicate code
    const existing = await this.groupRepo.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Group with code "${dto.code}" already exists`);
    }

    // Validate parent if provided
    let hierarchyLevel = 0;
    let hierarchyPath = '';
    if (dto.parentId) {
      const parent = await this.groupRepo.findOne({
        where: { id: dto.parentId, isActive: true },
      });
      if (!parent) {
        throw new NotFoundException(`Parent group not found: ${dto.parentId}`);
      }
      hierarchyLevel = parent.hierarchyLevel + 1;
      hierarchyPath = parent.hierarchyPath
        ? `${parent.hierarchyPath}/${parent.id}`
        : parent.id;
    }

    const group = this.groupRepo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description || null,
      type: dto.type || GroupType.STANDARD,
      parentId: dto.parentId || null,
      hierarchyLevel,
      hierarchyPath: hierarchyPath || null,
      icon: dto.icon || null,
      color: dto.color || null,
      metadata: dto.metadata || {},
      isSystem: false,
      isActive: true,
      createdBy,
    });

    const saved = await this.groupRepo.save(group);
    this.logger.log(`Created group: ${saved.name} (${saved.code})`);

    return this.getGroupById(saved.id);
  }

  /**
   * Get a group by ID with counts
   */
  async getGroupById(groupId: string): Promise<GroupWithCounts> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['parent'],
    });

    if (!group) {
      throw new NotFoundException(`Group not found: ${groupId}`);
    }

    return this.attachCounts(group);
  }

  /**
   * Get a group by code
   */
  async getGroupByCode(code: string): Promise<GroupWithCounts> {
    const group = await this.groupRepo.findOne({
      where: { code },
      relations: ['parent'],
    });

    if (!group) {
      throw new NotFoundException(`Group not found: ${code}`);
    }

    return this.attachCounts(group);
  }

  /**
   * List groups with filters
   */
  async listGroups(options: GroupListOptions = {}): Promise<GroupWithCounts[]> {
    const query = this.groupRepo.createQueryBuilder('group')
      .leftJoinAndSelect('group.parent', 'parent');

    if (!options.includeInactive) {
      query.andWhere('group.isActive = :isActive', { isActive: true });
    }

    if (options.search) {
      query.andWhere(
        '(group.name ILIKE :search OR group.code ILIKE :search OR group.description ILIKE :search)',
        { search: `%${options.search}%` },
      );
    }

    if (options.type) {
      query.andWhere('group.type = :type', { type: options.type });
    }

    if (options.parentId !== undefined) {
      if (options.parentId === null) {
        query.andWhere('group.parentId IS NULL');
      } else {
        query.andWhere('group.parentId = :parentId', { parentId: options.parentId });
      }
    }

    query.orderBy('group.hierarchyLevel', 'ASC')
      .addOrderBy('group.name', 'ASC');

    const groups = await query.getMany();

    if (options.includeCounts) {
      const result: GroupWithCounts[] = [];
      for (const group of groups) {
        result.push(await this.attachCounts(group));
      }
      return result;
    }

    return groups;
  }

  /**
   * Get group hierarchy as a tree structure
   */
  async getGroupHierarchy(options: { includeInactive?: boolean } = {}): Promise<GroupHierarchyNode[]> {
    const groups = await this.listGroups({
      includeInactive: options.includeInactive,
      includeCounts: true,
    });

    // Build tree structure
    const groupMap = new Map<string, GroupHierarchyNode>();
    const roots: GroupHierarchyNode[] = [];

    // First pass: create nodes
    for (const group of groups) {
      groupMap.set(group.id, { ...group, children: [] });
    }

    // Second pass: build tree
    for (const group of groups) {
      const node = groupMap.get(group.id)!;
      if (group.parentId && groupMap.has(group.parentId)) {
        groupMap.get(group.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Get group statistics by type
   */
  async getGroupStats(): Promise<GroupStats> {
    const counts = await this.groupRepo
      .createQueryBuilder('group')
      .select('group.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('group.isActive = :isActive', { isActive: true })
      .groupBy('group.type')
      .getRawMany();

    const stats: GroupStats = {
      organization: 0,
      department: 0,
      team: 0,
      location: 0,
      dynamic: 0,
      standard: 0,
      total: 0,
    };

    for (const row of counts) {
      const type = row.type as string;
      const count = parseInt(row.count, 10);
      if (type in stats) {
        (stats as any)[type] = count;
      }
      stats.total += count;
    }

    return stats;
  }

  /**
   * Update a group
   */
  async updateGroup(
    groupId: string,
    dto: UpdateGroupDto,
    _updatedBy?: string,
  ): Promise<GroupWithCounts> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group not found: ${groupId}`);
    }

    // Handle parent change
    if (dto.parentId !== undefined && dto.parentId !== group.parentId) {
      if (dto.parentId === null) {
        group.parentId = null;
        group.hierarchyLevel = 0;
        group.hierarchyPath = null;
      } else {
        // Validate new parent
        const parent = await this.groupRepo.findOne({
          where: { id: dto.parentId, isActive: true },
        });
        if (!parent) {
          throw new NotFoundException(`Parent group not found: ${dto.parentId}`);
        }

        // Check for cycles
        if (await this.wouldCreateCycle(groupId, dto.parentId)) {
          throw new BadRequestException('This would create a circular hierarchy');
        }

        group.parentId = dto.parentId;
        group.hierarchyLevel = parent.hierarchyLevel + 1;
        group.hierarchyPath = parent.hierarchyPath
          ? `${parent.hierarchyPath}/${parent.id}`
          : parent.id;
      }

      // Update hierarchy for all descendants
      await this.updateDescendantHierarchy(groupId);
    }

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.description !== undefined) group.description = dto.description;
    if (dto.type !== undefined) group.type = dto.type;
    if (dto.icon !== undefined) group.icon = dto.icon;
    if (dto.color !== undefined) group.color = dto.color;
    if (dto.isActive !== undefined) group.isActive = dto.isActive;
    if (dto.metadata !== undefined) group.metadata = dto.metadata;

    await this.groupRepo.save(group);
    this.logger.log(`Updated group: ${group.name} (${groupId})`);

    return this.getGroupById(groupId);
  }

  /**
   * Delete (soft) a group
   */
  async deleteGroup(groupId: string): Promise<void> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group not found: ${groupId}`);
    }

    if (group.isSystem) {
      throw new BadRequestException('Cannot delete system group');
    }

    // Check for child groups
    const childCount = await this.groupRepo.count({
      where: { parentId: groupId, isActive: true },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete group with ${childCount} child group(s). Move or delete children first.`,
      );
    }

    // Soft delete
    group.isActive = false;
    await this.groupRepo.save(group);
    this.logger.log(`Deleted group: ${group.name} (${groupId})`);
  }

  /**
   * Restore a deleted group
   */
  async restoreGroup(groupId: string): Promise<GroupWithCounts> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group not found: ${groupId}`);
    }

    group.isActive = true;
    await this.groupRepo.save(group);
    this.logger.log(`Restored group: ${group.name} (${groupId})`);

    return this.getGroupById(groupId);
  }

  // ==========================================================================
  // Hierarchy Operations
  // ==========================================================================

  /**
   * Get all ancestor groups of a group
   */
  async getAncestors(groupId: string): Promise<Group[]> {
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

    return this.groupRepo.find({
      where: { id: In(ancestorIds), isActive: true },
      order: { hierarchyLevel: 'ASC' },
    });
  }

  /**
   * Get all descendant groups of a group
   */
  async getDescendants(groupId: string): Promise<Group[]> {
    const query = this.groupRepo
      .createQueryBuilder('group')
      .where('group.isActive = :isActive', { isActive: true })
      .andWhere(
        "(group.hierarchyPath LIKE :path OR group.hierarchyPath LIKE :pathMid)",
        {
          path: `${groupId}%`,
          pathMid: `%/${groupId}%`,
        },
      )
      .orderBy('group.hierarchyLevel', 'ASC');

    return query.getMany();
  }

  /**
   * Get immediate child groups
   */
  async getChildren(groupId: string): Promise<GroupWithCounts[]> {
    const children = await this.groupRepo.find({
      where: { parentId: groupId, isActive: true },
      order: { name: 'ASC' },
    });

    const result: GroupWithCounts[] = [];
    for (const child of children) {
      result.push(await this.attachCounts(child));
    }
    return result;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Check if setting a parent would create a cycle
   */
  private async wouldCreateCycle(groupId: string, proposedParentId: string): Promise<boolean> {
    // Can't be your own parent
    if (groupId === proposedParentId) {
      return true;
    }

    // Check if proposed parent is a descendant of this group
    const proposedParent = await this.groupRepo.findOne({
      where: { id: proposedParentId },
    });

    if (!proposedParent) {
      return false;
    }

    // If proposed parent's path contains this group, it would create a cycle
    if (proposedParent.hierarchyPath?.includes(groupId)) {
      return true;
    }

    return false;
  }

  /**
   * Update hierarchy path for all descendants when parent changes
   */
  private async updateDescendantHierarchy(groupId: string): Promise<void> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) return;

    const children = await this.groupRepo.find({
      where: { parentId: groupId },
    });

    for (const child of children) {
      child.hierarchyLevel = group.hierarchyLevel + 1;
      child.hierarchyPath = group.hierarchyPath
        ? `${group.hierarchyPath}/${group.id}`
        : group.id;
      await this.groupRepo.save(child);

      // Recursively update children
      await this.updateDescendantHierarchy(child.id);
    }
  }

  /**
   * Attach member and role counts to a group
   */
  private async attachCounts(group: Group): Promise<GroupWithCounts> {
    const [directMemberCount, roleCount, childGroupCount] = await Promise.all([
      this.memberRepo.count({
        where: { groupId: group.id },
      }),
      this.groupRoleRepo.count({
        where: { groupId: group.id },
      }),
      this.groupRepo.count({
        where: { parentId: group.id, isActive: true },
      }),
    ]);

    // Calculate total members (including descendants)
    let totalMemberCount = directMemberCount;
    if (childGroupCount > 0) {
      const descendants = await this.getDescendants(group.id);
      for (const desc of descendants) {
        const descMemberCount = await this.memberRepo.count({
          where: { groupId: desc.id },
        });
        totalMemberCount += descMemberCount;
      }
    }

    return {
      ...group,
      directMemberCount,
      totalMemberCount,
      childGroupCount,
      roleCount,
    };
  }
}
