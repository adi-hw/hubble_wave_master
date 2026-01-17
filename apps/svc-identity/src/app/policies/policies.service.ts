import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CollectionAccessRule,
  PropertyAccessRule,
  CollectionDefinition,
  PropertyDefinition,
  Role,
  Group,
  User,
} from '@hubblewave/instance-db';

/**
 * Filter options for listing policies
 */
export interface PolicyListOptions {
  collectionId?: string;
  propertyId?: string;
  roleId?: string;
  groupId?: string;
  userId?: string;
  isActive?: boolean;
  includeInactive?: boolean;
}

/**
 * Aggregated policy response for collection access rules
 */
export interface CollectionPolicyResponse {
  id: string;
  type: 'collection';
  name: string;
  description: string | null;
  ruleKey: string | null;
  collectionId: string;
  collectionCode?: string;
  collectionName?: string;
  scope: {
    roleId: string | null;
    roleName?: string | null;
    groupId: string | null;
    groupName?: string | null;
    userId: string | null;
    userEmail?: string | null;
  };
  permissions: {
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
  conditions: Record<string, unknown> | null;
  priority: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

/**
 * Aggregated policy response for property access rules
 */
export interface PropertyPolicyResponse {
  id: string;
  type: 'property';
  propertyId: string;
  propertyCode?: string;
  propertyName?: string;
  collectionId?: string;
  collectionCode?: string;
  scope: {
    roleId: string | null;
    roleName?: string | null;
    groupId: string | null;
    groupName?: string | null;
    userId: string | null;
    userEmail?: string | null;
  };
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    maskingStrategy: 'NONE' | 'PARTIAL' | 'FULL';
  };
  conditions: Record<string, unknown> | null;
  priority: number;
  isActive: boolean;
  ruleKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

/**
 * Combined policy response
 */
export type PolicyResponse = CollectionPolicyResponse | PropertyPolicyResponse;

/**
 * Policy statistics
 */
export interface PolicyStats {
  totalCollectionRules: number;
  totalPropertyRules: number;
  activeCollectionRules: number;
  activePropertyRules: number;
  rulesByCollection: Array<{ collectionId: string; collectionName: string; count: number }>;
  rulesByRole: Array<{ roleId: string; roleName: string; count: number }>;
}

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    @InjectRepository(CollectionAccessRule)
    private readonly collectionRuleRepo: Repository<CollectionAccessRule>,
    @InjectRepository(PropertyAccessRule)
    private readonly propertyRuleRepo: Repository<PropertyAccessRule>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * List all access policies with optional filtering
   */
  async listPolicies(options: PolicyListOptions = {}): Promise<PolicyResponse[]> {
    const [collectionPolicies, propertyPolicies] = await Promise.all([
      this.listCollectionPolicies(options),
      this.listPropertyPolicies(options),
    ]);

    const combined: PolicyResponse[] = [...collectionPolicies, ...propertyPolicies];
    combined.sort((a, b) => a.priority - b.priority);

    return combined;
  }

  /**
   * List collection-level access policies
   */
  async listCollectionPolicies(options: PolicyListOptions = {}): Promise<CollectionPolicyResponse[]> {
    const query = this.collectionRuleRepo.createQueryBuilder('rule')
      .leftJoinAndSelect('rule.collection', 'collection')
      .leftJoinAndSelect('rule.role', 'role')
      .leftJoinAndSelect('rule.group', 'grp')
      .leftJoinAndSelect('rule.user', 'user');

    if (!options.includeInactive) {
      query.andWhere('rule.isActive = :isActive', { isActive: true });
    }

    if (options.collectionId) {
      query.andWhere('rule.collectionId = :collectionId', { collectionId: options.collectionId });
    }

    if (options.roleId) {
      query.andWhere('rule.roleId = :roleId', { roleId: options.roleId });
    }

    if (options.groupId) {
      query.andWhere('rule.groupId = :groupId', { groupId: options.groupId });
    }

    if (options.userId) {
      query.andWhere('rule.userId = :userId', { userId: options.userId });
    }

    query.orderBy('rule.priority', 'ASC')
      .addOrderBy('rule.createdAt', 'DESC');

    const rules = await query.getMany();

    return rules.map((rule) => this.mapCollectionRule(rule));
  }

  /**
   * List property-level access policies
   */
  async listPropertyPolicies(options: PolicyListOptions = {}): Promise<PropertyPolicyResponse[]> {
    const query = this.propertyRuleRepo.createQueryBuilder('rule')
      .leftJoinAndSelect('rule.property', 'property')
      .leftJoinAndSelect('property.collection', 'collection')
      .leftJoinAndSelect('rule.role', 'role')
      .leftJoinAndSelect('rule.group', 'grp')
      .leftJoinAndSelect('rule.user', 'user');

    if (!options.includeInactive) {
      query.andWhere('rule.isActive = :isActive', { isActive: true });
    }

    if (options.propertyId) {
      query.andWhere('rule.propertyId = :propertyId', { propertyId: options.propertyId });
    }

    if (options.collectionId) {
      query.andWhere('property.collectionId = :collectionId', { collectionId: options.collectionId });
    }

    if (options.roleId) {
      query.andWhere('rule.roleId = :roleId', { roleId: options.roleId });
    }

    if (options.groupId) {
      query.andWhere('rule.groupId = :groupId', { groupId: options.groupId });
    }

    if (options.userId) {
      query.andWhere('rule.userId = :userId', { userId: options.userId });
    }

    query.orderBy('rule.priority', 'ASC')
      .addOrderBy('rule.createdAt', 'DESC');

    const rules = await query.getMany();

    return rules.map((rule) => this.mapPropertyRule(rule));
  }

  /**
   * Get a specific policy by ID
   * Searches both collection and property access rules
   */
  async getPolicyById(id: string): Promise<PolicyResponse> {
    const collectionRule = await this.collectionRuleRepo.findOne({
      where: { id },
      relations: ['collection', 'role', 'group', 'user'],
    });

    if (collectionRule) {
      return this.mapCollectionRule(collectionRule);
    }

    const propertyRule = await this.propertyRuleRepo.findOne({
      where: { id },
      relations: ['property', 'property.collection', 'role', 'group', 'user'],
    });

    if (propertyRule) {
      return this.mapPropertyRule(propertyRule);
    }

    throw new NotFoundException(`Policy not found: ${id}`);
  }

  /**
   * Get policy statistics
   */
  async getPolicyStats(): Promise<PolicyStats> {
    const [
      totalCollectionRules,
      totalPropertyRules,
      activeCollectionRules,
      activePropertyRules,
    ] = await Promise.all([
      this.collectionRuleRepo.count(),
      this.propertyRuleRepo.count(),
      this.collectionRuleRepo.count({ where: { isActive: true } }),
      this.propertyRuleRepo.count({ where: { isActive: true } }),
    ]);

    const rulesByCollectionRaw = await this.collectionRuleRepo
      .createQueryBuilder('rule')
      .select('rule.collectionId', 'collectionId')
      .addSelect('collection.name', 'collectionName')
      .addSelect('COUNT(*)', 'count')
      .leftJoin('rule.collection', 'collection')
      .where('rule.isActive = :isActive', { isActive: true })
      .groupBy('rule.collectionId')
      .addGroupBy('collection.name')
      .getRawMany();

    const rulesByRoleRaw = await this.collectionRuleRepo
      .createQueryBuilder('rule')
      .select('rule.roleId', 'roleId')
      .addSelect('role.name', 'roleName')
      .addSelect('COUNT(*)', 'count')
      .leftJoin('rule.role', 'role')
      .where('rule.isActive = :isActive', { isActive: true })
      .andWhere('rule.roleId IS NOT NULL')
      .groupBy('rule.roleId')
      .addGroupBy('role.name')
      .getRawMany();

    return {
      totalCollectionRules,
      totalPropertyRules,
      activeCollectionRules,
      activePropertyRules,
      rulesByCollection: rulesByCollectionRaw.map((r) => ({
        collectionId: r.collectionId,
        collectionName: r.collectionName || 'Unknown',
        count: parseInt(r.count, 10),
      })),
      rulesByRole: rulesByRoleRaw.map((r) => ({
        roleId: r.roleId,
        roleName: r.roleName || 'Unknown',
        count: parseInt(r.count, 10),
      })),
    };
  }

  /**
   * Get policies for a specific collection
   */
  async getPoliciesForCollection(collectionId: string): Promise<{
    collectionRules: CollectionPolicyResponse[];
    propertyRules: PropertyPolicyResponse[];
  }> {
    const collection = await this.collectionRepo.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException(`Collection not found: ${collectionId}`);
    }

    const [collectionRules, propertyRules] = await Promise.all([
      this.listCollectionPolicies({ collectionId }),
      this.listPropertyPolicies({ collectionId }),
    ]);

    return { collectionRules, propertyRules };
  }

  /**
   * Get policies assigned to a specific role
   */
  async getPoliciesForRole(roleId: string): Promise<PolicyResponse[]> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });

    if (!role) {
      throw new NotFoundException(`Role not found: ${roleId}`);
    }

    return this.listPolicies({ roleId });
  }

  /**
   * Get policies assigned to a specific group
   */
  async getPoliciesForGroup(groupId: string): Promise<PolicyResponse[]> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });

    if (!group) {
      throw new NotFoundException(`Group not found: ${groupId}`);
    }

    return this.listPolicies({ groupId });
  }

  /**
   * Get policies assigned to a specific user
   */
  async getPoliciesForUser(userId: string): Promise<PolicyResponse[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    return this.listPolicies({ userId });
  }

  /**
   * Map collection access rule entity to response
   */
  private mapCollectionRule(rule: CollectionAccessRule): CollectionPolicyResponse {
    return {
      id: rule.id,
      type: 'collection',
      name: rule.name,
      description: rule.description ?? null,
      ruleKey: rule.ruleKey ?? null,
      collectionId: rule.collectionId,
      collectionCode: rule.collection?.code,
      collectionName: rule.collection?.name,
      scope: {
        roleId: rule.roleId ?? null,
        roleName: rule.role?.name ?? null,
        groupId: rule.groupId ?? null,
        groupName: rule.group?.name ?? null,
        userId: rule.userId ?? null,
        userEmail: rule.user?.email ?? null,
      },
      permissions: {
        canRead: rule.canRead,
        canCreate: rule.canCreate,
        canUpdate: rule.canUpdate,
        canDelete: rule.canDelete,
      },
      conditions: rule.conditions ?? null,
      priority: rule.priority,
      isActive: rule.isActive,
      metadata: rule.metadata,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      createdBy: rule.createdBy ?? null,
    };
  }

  /**
   * Map property access rule entity to response
   */
  private mapPropertyRule(rule: PropertyAccessRule): PropertyPolicyResponse {
    return {
      id: rule.id,
      type: 'property',
      propertyId: rule.propertyId,
      propertyCode: rule.property?.code,
      propertyName: rule.property?.name,
      collectionId: rule.property?.collectionId,
      collectionCode: rule.property?.collection?.code,
      scope: {
        roleId: rule.roleId ?? null,
        roleName: rule.role?.name ?? null,
        groupId: rule.groupId ?? null,
        groupName: rule.group?.name ?? null,
        userId: rule.userId ?? null,
        userEmail: rule.user?.email ?? null,
      },
      permissions: {
        canRead: rule.canRead,
        canWrite: rule.canWrite,
        maskingStrategy: rule.maskingStrategy,
      },
      conditions: rule.conditions ?? null,
      priority: rule.priority,
      isActive: rule.isActive,
      ruleKey: rule.ruleKey ?? null,
      metadata: rule.metadata,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      createdBy: rule.createdBy ?? null,
    };
  }
}
