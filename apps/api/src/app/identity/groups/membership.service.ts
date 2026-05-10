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
  GroupMember,
  User,
} from '@hubblewave/instance-db';

// ============================================================================
// DTOs
// ============================================================================

export interface AddMemberDto {
  userId: string;
  isManager?: boolean;
  validFrom?: Date;
  validUntil?: Date | null;
}

export interface UpdateMemberDto {
  isManager?: boolean;
  validUntil?: Date | null;
}

export interface BulkAddMembersDto {
  userIds: string[];
  isManager?: boolean;
  validUntil?: Date | null;
}

export interface MemberWithUser extends GroupMember {
  user?: User;
}

export interface GroupMembershipInfo {
  group: Group;
  membership: GroupMember;
  membershipType: 'direct' | 'inherited';
  inheritedFrom?: Group;
}

export interface EffectiveMember {
  user: User;
  membershipType: 'direct' | 'nested';
  viaGroupId?: string;
  viaGroupName?: string;
  isManager: boolean;
}

export interface BulkOperationResult {
  added: number;
  skipped: number;
  errors: Array<{ userId: string; error: string }>;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly memberRepo: Repository<GroupMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ==========================================================================
  // Member Management
  // ==========================================================================

  /**
   * Add a user to a group
   */
  async addMember(
    groupId: string,
    dto: AddMemberDto,
    addedBy?: string,
  ): Promise<GroupMember> {
    // Validate group exists
    const group = await this.groupRepo.findOne({
      where: { id: groupId, isActive: true },
    });
    if (!group) {
      throw new NotFoundException(`Group not found: ${groupId}`);
    }

    // Validate user exists
    const user = await this.userRepo.findOne({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User not found: ${dto.userId}`);
    }

    // Check if already a member
    const existing = await this.memberRepo.findOne({
      where: { groupId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this group');
    }

    const member = this.memberRepo.create({
      groupId,
      userId: dto.userId,
      isManager: dto.isManager ?? false,
      validFrom: dto.validFrom ?? new Date(),
      validUntil: dto.validUntil ?? null,
      createdBy: addedBy,
    });

    const saved = await this.memberRepo.save(member);
    this.logger.log(`Added user ${dto.userId} to group ${groupId}`);

    return saved;
  }

  /**
   * Remove a user from a group
   */
  async removeMember(groupId: string, userId: string): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: { groupId, userId },
    });

    if (!member) {
      throw new NotFoundException('Membership not found');
    }

    await this.memberRepo.remove(member);
    this.logger.log(`Removed user ${userId} from group ${groupId}`);
  }

  /**
   * Update membership details
   */
  async updateMember(
    groupId: string,
    userId: string,
    dto: UpdateMemberDto,
  ): Promise<GroupMember> {
    const member = await this.memberRepo.findOne({
      where: { groupId, userId },
    });

    if (!member) {
      throw new NotFoundException('Membership not found');
    }

    if (dto.isManager !== undefined) {
      member.isManager = dto.isManager;
    }
    if (dto.validUntil !== undefined) {
      member.validUntil = dto.validUntil;
    }

    return this.memberRepo.save(member);
  }

  /**
   * Bulk add members to a group
   */
  async bulkAddMembers(
    groupId: string,
    dto: BulkAddMembersDto,
    addedBy?: string,
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      added: 0,
      skipped: 0,
      errors: [],
    };

    // Validate group exists
    const group = await this.groupRepo.findOne({
      where: { id: groupId, isActive: true },
    });
    if (!group) {
      throw new NotFoundException(`Group not found: ${groupId}`);
    }

    // Get existing members
    const existingMembers = await this.memberRepo.find({
      where: { groupId },
      select: ['userId'],
    });
    const existingUserIds = new Set(existingMembers.map((m) => m.userId));

    // Process each user
    for (const userId of dto.userIds) {
      try {
        if (existingUserIds.has(userId)) {
          result.skipped++;
          continue;
        }

        // Validate user exists
        const user = await this.userRepo.findOne({
          where: { id: userId },
        });
        if (!user) {
          result.errors.push({ userId, error: 'User not found' });
          continue;
        }

        const member = this.memberRepo.create({
          groupId,
          userId,
          isManager: dto.isManager ?? false,
          validFrom: new Date(),
          validUntil: dto.validUntil ?? null,
          createdBy: addedBy,
        });

        await this.memberRepo.save(member);
        result.added++;
      } catch (error: any) {
        result.errors.push({ userId, error: error.message });
      }
    }

    this.logger.log(
      `Bulk added ${result.added} members to group ${groupId} (skipped: ${result.skipped}, errors: ${result.errors.length})`,
    );

    return result;
  }

  /**
   * Bulk remove members from a group
   */
  async bulkRemoveMembers(groupId: string, userIds: string[]): Promise<number> {
    const result = await this.memberRepo.delete({
      groupId,
      userId: In(userIds),
    });

    this.logger.log(`Bulk removed ${result.affected} members from group ${groupId}`);
    return result.affected || 0;
  }

  // ==========================================================================
  // Member Queries
  // ==========================================================================

  /**
   * Get direct members of a group
   */
  async getGroupMembers(
    groupId: string,
    options: {
      includeExpired?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ members: MemberWithUser[]; total: number }> {
    const now = new Date();
    const query = this.memberRepo
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.user', 'user')
      .where('member.groupId = :groupId', { groupId });

    if (!options.includeExpired) {
      query.andWhere(
        '(member.validUntil IS NULL OR member.validUntil > :now)',
        { now },
      );
    }

    if (options.search) {
      query.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${options.search}%` },
      );
    }

    const total = await query.getCount();

    query.orderBy('member.isManager', 'DESC').addOrderBy('user.lastName', 'ASC');

    if (options.limit) {
      query.take(options.limit);
    }
    if (options.offset) {
      query.skip(options.offset);
    }

    const members = await query.getMany();

    return { members, total };
  }

  /**
   * Get effective members of a group (including nested group members)
   */
  async getEffectiveGroupMembers(groupId: string): Promise<EffectiveMember[]> {
    const effectiveMembers: EffectiveMember[] = [];
    const seenUserIds = new Set<string>();
    const now = new Date();

    // Get direct members
    const directMembers = await this.memberRepo.find({
      where: [
        { groupId, validUntil: IsNull() },
        { groupId, validUntil: MoreThan(now) },
      ],
      relations: ['user'],
    });

    for (const member of directMembers) {
      if (member.user && !seenUserIds.has(member.userId)) {
        seenUserIds.add(member.userId);
        effectiveMembers.push({
          user: member.user,
          membershipType: 'direct',
          isManager: member.isManager,
        });
      }
    }

    // Get members from child groups (recursively)
    const childGroups = await this.getDescendantGroups(groupId);
    for (const childGroup of childGroups) {
      const childMembers = await this.memberRepo.find({
        where: [
          { groupId: childGroup.id, validUntil: IsNull() },
          { groupId: childGroup.id, validUntil: MoreThan(now) },
        ],
        relations: ['user'],
      });

      for (const member of childMembers) {
        if (member.user && !seenUserIds.has(member.userId)) {
          seenUserIds.add(member.userId);
          effectiveMembers.push({
            user: member.user,
            membershipType: 'nested',
            viaGroupId: childGroup.id,
            viaGroupName: childGroup.name,
            isManager: member.isManager,
          });
        }
      }
    }

    return effectiveMembers;
  }

  /**
   * Get all groups a user is a direct member of
   */
  async getUserDirectGroups(userId: string): Promise<GroupMembershipInfo[]> {
    const now = new Date();
    const memberships = await this.memberRepo.find({
      where: [
        { userId, validUntil: IsNull() },
        { userId, validUntil: MoreThan(now) },
      ],
      relations: ['group'],
    });

    return memberships
      .filter((m) => m.group?.isActive)
      .map((m) => ({
        group: m.group!,
        membership: m,
        membershipType: 'direct' as const,
      }));
  }

  /**
   * Get all groups a user is an effective member of (direct + inherited)
   */
  async getUserEffectiveGroups(userId: string): Promise<GroupMembershipInfo[]> {
    const directGroups = await this.getUserDirectGroups(userId);
    const effectiveGroups: GroupMembershipInfo[] = [...directGroups];
    const seenGroupIds = new Set(directGroups.map((g) => g.group.id));

    // For each direct group, add ancestor groups
    for (const directGroup of directGroups) {
      const ancestors = await this.getAncestorGroups(directGroup.group.id);
      for (const ancestor of ancestors) {
        if (!seenGroupIds.has(ancestor.id)) {
          seenGroupIds.add(ancestor.id);
          effectiveGroups.push({
            group: ancestor,
            membership: directGroup.membership,
            membershipType: 'inherited',
            inheritedFrom: directGroup.group,
          });
        }
      }
    }

    return effectiveGroups;
  }

  /**
   * Check if a user is a member of a group
   */
  async isMember(userId: string, groupId: string): Promise<boolean> {
    const now = new Date();
    const count = await this.memberRepo.count({
      where: [
        { userId, groupId, validUntil: IsNull() },
        { userId, groupId, validUntil: MoreThan(now) },
      ],
    });
    return count > 0;
  }

  /**
   * Check if a user is a manager of a group
   */
  async isManager(userId: string, groupId: string): Promise<boolean> {
    const now = new Date();
    const count = await this.memberRepo.count({
      where: [
        { userId, groupId, isManager: true, validUntil: IsNull() },
        { userId, groupId, isManager: true, validUntil: MoreThan(now) },
      ],
    });
    return count > 0;
  }

  /**
   * Get group managers
   */
  async getGroupManagers(groupId: string): Promise<MemberWithUser[]> {
    const now = new Date();
    return this.memberRepo.find({
      where: [
        { groupId, isManager: true, validUntil: IsNull() },
        { groupId, isManager: true, validUntil: MoreThan(now) },
      ],
      relations: ['user'],
    });
  }

  /**
   * Get member count for a group
   */
  async getMemberCount(groupId: string): Promise<{
    direct: number;
    nested: number;
    total: number;
  }> {
    const now = new Date();

    const direct = await this.memberRepo.count({
      where: [
        { groupId, validUntil: IsNull() },
        { groupId, validUntil: MoreThan(now) },
      ],
    });

    // Get nested count
    const childGroups = await this.getDescendantGroups(groupId);
    let nested = 0;
    for (const child of childGroups) {
      nested += await this.memberRepo.count({
        where: [
          { groupId: child.id, validUntil: IsNull() },
          { groupId: child.id, validUntil: MoreThan(now) },
        ],
      });
    }

    return {
      direct,
      nested,
      total: direct + nested,
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private async getDescendantGroups(groupId: string): Promise<Group[]> {
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

  private async getAncestorGroups(groupId: string): Promise<Group[]> {
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
}
