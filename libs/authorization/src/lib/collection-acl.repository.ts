import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionAccessRule } from '@hubblewave/instance-db';
import {
  CollectionAccessRuleData,
  CollectionAccessRuleRepository,
  AccessConditionData,
} from './types';

/**
 * CollectionAclRepository
 *
 * Provides data access for collection-level access rules.
 * Implements row-level security by filtering rules based on
 * user identity, roles, and groups.
 */
@Injectable()
export class CollectionAclRepository implements CollectionAccessRuleRepository {
  constructor(
    @InjectRepository(CollectionAccessRule)
    private readonly ruleRepo: Repository<CollectionAccessRule>
  ) {}

  /**
   * Find all access rules for a collection
   */
  async findByCollection(
    collectionId: string,
    activeOnly = true
  ): Promise<CollectionAccessRuleData[]> {
    const where: Record<string, unknown> = { collectionId };
    if (activeOnly) {
      where['isActive'] = true;
    }

    const rules = await this.ruleRepo.find({
      where,
      order: { priority: 'ASC', createdAt: 'ASC' },
    });

    return rules.map(this.mapToData);
  }

  /**
   * Find access rules applicable to a specific user
   * Returns rules that match by userId, roleIds, or groupIds
   */
  async findByCollectionAndUser(
    collectionId: string,
    userId: string,
    roleIds: string[],
    groupIds: string[]
  ): Promise<CollectionAccessRuleData[]> {
    const queryBuilder = this.ruleRepo
      .createQueryBuilder('rule')
      .where('rule.collection_id = :collectionId', { collectionId })
      .andWhere('rule.is_active = :isActive', { isActive: true })
      .andWhere(
        '(' +
          'rule.user_id = :userId OR ' +
          'rule.role_id = ANY(:roleIds) OR ' +
          'rule.group_id = ANY(:groupIds) OR ' +
          '(rule.user_id IS NULL AND rule.role_id IS NULL AND rule.group_id IS NULL)' +
          ')',
        {
          userId,
          roleIds: roleIds.length > 0 ? roleIds : ['00000000-0000-0000-0000-000000000000'],
          groupIds: groupIds.length > 0 ? groupIds : ['00000000-0000-0000-0000-000000000000'],
        }
      )
      .orderBy('rule.priority', 'ASC')
      .addOrderBy('rule.created_at', 'ASC');

    const rules = await queryBuilder.getMany();
    return rules.map(this.mapToData);
  }

  /**
   * Find access rules by role
   */
  async findByRole(roleId: string, activeOnly = true): Promise<CollectionAccessRuleData[]> {
    const where: Record<string, unknown> = { roleId };
    if (activeOnly) {
      where['isActive'] = true;
    }

    const rules = await this.ruleRepo.find({
      where,
      order: { priority: 'ASC' },
    });

    return rules.map(this.mapToData);
  }

  /**
   * Find access rules by group
   */
  async findByGroup(groupId: string, activeOnly = true): Promise<CollectionAccessRuleData[]> {
    const where: Record<string, unknown> = { groupId };
    if (activeOnly) {
      where['isActive'] = true;
    }

    const rules = await this.ruleRepo.find({
      where,
      order: { priority: 'ASC' },
    });

    return rules.map(this.mapToData);
  }

  /**
   * Find access rules by user
   */
  async findByUser(userId: string, activeOnly = true): Promise<CollectionAccessRuleData[]> {
    const where: Record<string, unknown> = { userId };
    if (activeOnly) {
      where['isActive'] = true;
    }

    const rules = await this.ruleRepo.find({
      where,
      order: { priority: 'ASC' },
    });

    return rules.map(this.mapToData);
  }

  /**
   * Create a new access rule
   */
  async create(data: Omit<CollectionAccessRuleData, 'id'>): Promise<CollectionAccessRuleData> {
    const rule = this.ruleRepo.create({
      collectionId: data.collectionId,
      name: data.name,
      description: data.description ?? null,
      roleId: data.roleId ?? null,
      groupId: data.groupId ?? null,
      userId: data.userId ?? null,
      canRead: data.canRead,
      canCreate: data.canCreate,
      canUpdate: data.canUpdate,
      canDelete: data.canDelete,
      conditions: data.conditions as Record<string, unknown> | null,
      priority: data.priority,
      isActive: data.isActive,
    });

    const saved = await this.ruleRepo.save(rule);
    return this.mapToData(saved);
  }

  /**
   * Update an access rule
   */
  async update(
    id: string,
    data: Partial<Omit<CollectionAccessRuleData, 'id'>>
  ): Promise<CollectionAccessRuleData | null> {
    await this.ruleRepo.update(id, {
      ...data,
      conditions: data.conditions as any,
    });

    const updated = await this.ruleRepo.findOne({ where: { id } });
    return updated ? this.mapToData(updated) : null;
  }

  /**
   * Delete an access rule
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.ruleRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Check if user has a specific operation permission on a collection
   */
  async hasPermission(
    collectionId: string,
    userId: string,
    roleIds: string[],
    groupIds: string[],
    operation: 'read' | 'create' | 'update' | 'delete'
  ): Promise<boolean> {
    const rules = await this.findByCollectionAndUser(collectionId, userId, roleIds, groupIds);

    if (rules.length === 0) {
      // No explicit rules - default deny
      return false;
    }

    // Check rules in priority order
    for (const rule of rules) {
      switch (operation) {
        case 'read':
          if (rule.canRead) return true;
          break;
        case 'create':
          if (rule.canCreate) return true;
          break;
        case 'update':
          if (rule.canUpdate) return true;
          break;
        case 'delete':
          if (rule.canDelete) return true;
          break;
      }
    }

    return false;
  }

  /**
   * Get aggregated permissions for a user on a collection
   */
  async getAggregatedPermissions(
    collectionId: string,
    userId: string,
    roleIds: string[],
    groupIds: string[]
  ): Promise<{ canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }> {
    const rules = await this.findByCollectionAndUser(collectionId, userId, roleIds, groupIds);

    // Aggregate permissions - any rule granting permission is sufficient
    return {
      canRead: rules.some((r) => r.canRead),
      canCreate: rules.some((r) => r.canCreate),
      canUpdate: rules.some((r) => r.canUpdate),
      canDelete: rules.some((r) => r.canDelete),
    };
  }

  /**
   * Map entity to data transfer object
   */
  private mapToData(rule: CollectionAccessRule): CollectionAccessRuleData {
    return {
      id: rule.id,
      collectionId: rule.collectionId,
      name: rule.name,
      description: rule.description,
      roleId: rule.roleId,
      groupId: rule.groupId,
      userId: rule.userId,
      canRead: rule.canRead,
      canCreate: rule.canCreate,
      canUpdate: rule.canUpdate,
      canDelete: rule.canDelete,
      conditions: rule.conditions as AccessConditionData | null,
      priority: rule.priority,
      isActive: rule.isActive,
    };
  }
}
