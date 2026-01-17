import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  CollectionAccessRule,
  PropertyAccessRule,
  PropertyDefinition,
  Role,
  Group,
  User,
} from '@hubblewave/instance-db';
import {
  CreateCollectionAccessRuleDto,
  UpdateCollectionAccessRuleDto,
} from '../dto/access-rule.dto';
import {
  UserAccessContext,
  Operation,
  AccessCheckRequest,
  AccessCheckResult,
  RuleEvaluationTrace,
  PropertyAccessResult,
  EffectivePermissions,
  SPECIAL_VALUES,
  SpecialValueKey,
} from '../types/access.types';
import { AccessAuditService } from './access-audit.service';

@Injectable()
export class AccessRuleService {
  constructor(
    @InjectRepository(CollectionAccessRule)
    private readonly collectionRuleRepo: Repository<CollectionAccessRule>,
    @InjectRepository(PropertyAccessRule)
    private readonly propertyRuleRepo: Repository<PropertyAccessRule>,
    @InjectRepository(PropertyDefinition)
    private readonly propertyDefRepo: Repository<PropertyDefinition>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly auditService: AccessAuditService,
  ) {}

  // ============================================================================
  // Collection Access Rules CRUD
  // ============================================================================

  async listCollectionRules(
    collectionId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<CollectionAccessRule[]> {
    const where: any = { collectionId };
    if (!options.includeInactive) {
      where.isActive = true;
    }

    return this.collectionRuleRepo.find({
      where,
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
  }

  async getCollectionRule(id: string): Promise<CollectionAccessRule> {
    const rule = await this.collectionRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Access rule ${id} not found`);
    }
    return rule;
  }

  async createCollectionRule(
    collectionId: string,
    dto: CreateCollectionAccessRuleDto,
    userId: string,
  ): Promise<CollectionAccessRule> {
    // Validate principal exists
    if (dto.principalType !== 'everyone' && dto.principalId) {
      await this.validatePrincipalExists(dto.principalType, dto.principalId);
    }

    // Validate condition properties exist
    if (dto.condition) {
      await this.validateConditionProperties(collectionId, dto.condition);
    }

    const rule = this.collectionRuleRepo.create({
      collectionId,
      name: dto.name,
      description: dto.description,
      roleId: dto.principalType === 'role' ? dto.principalId || null : null,
      groupId: dto.principalType === 'team' ? dto.principalId || null : null,
      userId: dto.principalType === 'user' ? dto.principalId || null : null,
      canRead: dto.canRead ?? false,
      canCreate: dto.canCreate ?? false,
      canUpdate: dto.canUpdate ?? false,
      canDelete: dto.canDelete ?? false,
      conditions: dto.condition || null,
      priority: dto.priority || 100,
      isActive: dto.isActive ?? true,
      createdBy: userId,
    });

    const saved = await this.collectionRuleRepo.save(rule);

    // Invalidate cache
    await this.invalidateCollectionRulesCache(collectionId);

    // Log audit
    await this.auditService.logRuleChange('collection', saved.id, collectionId, 'create', null, saved, userId);

    return saved;
  }

  async updateCollectionRule(
    id: string,
    dto: UpdateCollectionAccessRuleDto,
    userId: string,
  ): Promise<CollectionAccessRule> {
    const rule = await this.getCollectionRule(id);

    const previousState = { ...rule };

    // Validate condition if provided
    if (dto.condition !== undefined && dto.condition !== null) {
      await this.validateConditionProperties(rule.collectionId, dto.condition);
    }

    // Update fields
    Object.assign(rule, {
      ...dto,
      conditions: dto.condition ?? rule.conditions,
    });

    const saved = await this.collectionRuleRepo.save(rule);

    // Invalidate cache
    await this.invalidateCollectionRulesCache(rule.collectionId);

    // Log audit
    await this.auditService.logRuleChange(
      'collection',
      saved.id,
      rule.collectionId,
      'update',
      previousState,
      saved,
      userId,
    );

    return saved;
  }

  async deleteCollectionRule(id: string, userId: string): Promise<void> {
    const rule = await this.getCollectionRule(id);

    const previousState = { ...rule };

    await this.collectionRuleRepo.delete(id);

    // Invalidate cache
    await this.invalidateCollectionRulesCache(rule.collectionId);

    // Log audit
    await this.auditService.logRuleChange(
      'collection',
      id,
      rule.collectionId,
      'delete',
      previousState,
      null,
      userId,
    );
  }

  async reorderRules(
    collectionId: string,
    rules: { id: string; priority: number }[],
  ): Promise<number> {
    let updated = 0;

    for (const { id, priority } of rules) {
      const result = await this.collectionRuleRepo.update(
        { id, collectionId },
        { priority },
      );
      if (result.affected) {
        updated++;
      }
    }

    if (updated > 0) {
      await this.invalidateCollectionRulesCache(collectionId);
    }

    return updated;
  }

  // ============================================================================
  // Access Check (Core Logic)
  // ============================================================================

  async checkAccess(request: AccessCheckRequest): Promise<AccessCheckResult> {
    const { user, collectionId, operation, record, includeTrace } = request;

    // Get active rules from cache or DB
    const rules = await this.getActiveRulesForCollection(collectionId);
    const trace: RuleEvaluationTrace[] = [];

    for (const rule of rules) {
      const principalMatch = this.checkPrincipalMatch(rule, user);
      if (!principalMatch) {
        if (includeTrace) {
          trace.push(this.createTraceEntry(rule, 'no_principal_match', false, false, null));
        }
        continue;
      }

      // Check operation permission
      const hasPermission = this.checkOperationPermission(rule, operation);
      if (!hasPermission) {
        if (includeTrace) {
          trace.push(this.createTraceEntry(rule, 'no_permission', true, false, null));
        }
        continue;
      }

      let conditionResult: boolean | null = null;
      let conditionDetails: RuleEvaluationTrace['conditionDetails'] | undefined;

      if (rule.conditions && record) {
        const evalResult = this.evaluateCondition(rule.conditions as any, record, user);
        conditionResult = evalResult.passed;
        conditionDetails = evalResult.details;

        if (!conditionResult) {
          if (includeTrace) {
            trace.push({
              ...this.createTraceEntry(rule, 'condition_failed', true, true, false),
              conditionResult,
              conditionDetails,
            });
          }
          continue;
        }
      }

      // ACCESS GRANTED
      if (includeTrace) {
        trace.push({
          ...this.createTraceEntry(rule, 'matched', true, true, conditionResult),
          conditionResult,
          conditionDetails,
        });
      }

      return {
        allowed: true,
        matchingRule: {
          id: rule.id,
          name: rule.name,
          priority: rule.priority,
        },
        condition: (rule as any).conditions || undefined,
        trace: includeTrace ? trace : undefined,
      };
    }

    // DEFAULT DENY
    return {
      allowed: false,
      reason: 'NO_MATCHING_RULE',
      trace: includeTrace ? trace : undefined,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async getActiveRulesForCollection(collectionId: string): Promise<CollectionAccessRule[]> {
    const cacheKey = `access-rules:collection:${collectionId}`;
    const cached = await this.cache.get<CollectionAccessRule[]>(cacheKey);
    if (cached) return cached;

    const rules = await this.collectionRuleRepo.find({
      where: { collectionId, isActive: true },
      order: { priority: 'ASC' },
    });

    await this.cache.set(cacheKey, rules, 300000); // 5 minutes
    return rules;
  }

  private async invalidateCollectionRulesCache(collectionId: string) {
    await this.cache.del(`access-rules:collection:${collectionId}`);
  }

  private checkPrincipalMatch(rule: CollectionAccessRule, user: UserAccessContext): boolean {
    if (!rule.roleId && !rule.groupId && !rule.userId) return true; // everyone
    if (rule.userId) return user.id === rule.userId;
    if (rule.roleId) return user.roleIds.includes(rule.roleId);
    if (rule.groupId) return user.teamIds.includes(rule.groupId);
    return false;
  }

  private checkOperationPermission(rule: CollectionAccessRule, operation: Operation): boolean {
    switch (operation) {
      case 'read': return rule.canRead;
      case 'create': return rule.canCreate;
      case 'update': return rule.canUpdate;
      case 'delete': return rule.canDelete;
      default: return false;
    }
  }

  // ============================================================================
  // Effective Permissions
  // ============================================================================

  async getEffectivePermissions(
    collectionId: string,
    user: UserAccessContext,
    _recordId?: string,
  ): Promise<EffectivePermissions> {
    const rules = await this.getActiveRulesForCollection(collectionId);
    const propertyRules = await this.getPropertyRulesForCollection(collectionId);

    const permissions: EffectivePermissions = {
      canRead: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      propertyAccess: [],
      appliedRules: [],
    };

    // Check each operation
    for (const rule of rules) {
      if (!this.checkPrincipalMatch(rule, user)) continue;

      if (rule.canRead && !permissions.canRead) {
        permissions.canRead = true;
        permissions.readCondition = (rule as any).conditions || undefined;
        permissions.appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          effect: 'read',
        });
      }

      if (rule.canCreate && !permissions.canCreate) {
        permissions.canCreate = true;
        permissions.appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          effect: 'create',
        });
      }

      if (rule.canUpdate && !permissions.canUpdate) {
        permissions.canUpdate = true;
        permissions.updateCondition = (rule as any).conditions || undefined;
        permissions.appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          effect: 'update',
        });
      }

      if (rule.canDelete && !permissions.canDelete) {
        permissions.canDelete = true;
        permissions.deleteCondition = (rule as any).conditions || undefined;
        permissions.appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          effect: 'delete',
        });
      }
    }

    // Get property-level permissions
    permissions.propertyAccess = await this.getPropertyAccessForUser(
      collectionId,
      propertyRules,
      user,
    );

    return permissions;
  }

  async getPropertyRulesForCollection(collectionId: string): Promise<PropertyAccessRule[]> {
    const cacheKey = `property-rules:collection:${collectionId}`;
    const cached = await this.cache.get<PropertyAccessRule[]>(cacheKey);
    if (cached) return cached;

    const rules = await this.propertyRuleRepo.find({
      where: { isActive: true } as any,
      order: { priority: 'ASC' },
    });

    await this.cache.set(cacheKey, rules, 300000); // 5 minutes
    return rules;
  }

  /**
   * Calculate field-level security permissions for a user on a collection.
   *
   * This method determines:
   * - Which properties the user can read/write
   * - Which properties require masking
   * - Which properties are PHI and require break-glass access
   *
   * The evaluation follows priority order (lower priority = evaluated first).
   * For each property:
   * 1. Start with defaults from PropertyDefinition (isReadonly, isSensitive, etc.)
   * 2. Apply any matching PropertyAccessRules in priority order
   * 3. User-specific rules override group rules override role rules
   */
  async getPropertyAccessForUser(
    collectionId: string,
    rules: PropertyAccessRule[],
    user: UserAccessContext
  ): Promise<PropertyAccessResult[]> {
    // Get all properties for this collection
    const properties = await this.getPropertiesForCollection(collectionId);

    if (properties.length === 0) {
      return [];
    }

    // Get property IDs to filter rules
    const propertyIds = properties.map(p => p.id);

    // Filter rules to only those that match properties in this collection
    // and match the user's principals
    const applicableRules = rules.filter(rule => {
      // Check property belongs to this collection
      if (!propertyIds.includes(rule.propertyId)) {
        return false;
      }

      // Check principal match
      return this.checkPropertyRulePrincipalMatch(rule, user);
    });

    // Build permission map for each property
    const results: PropertyAccessResult[] = [];

    for (const property of properties) {
      // Start with default permissions based on property definition
      let canRead = true; // Default: allow read
      let canWrite = !property.isReadonly; // Default: allow write unless readonly

      // Get masking info from property definition
      const isSensitive = property.isSensitive || property.isPhi || property.isPii;
      const requiresBreakGlass = property.requiresBreakGlass;
      const maskingStrategy = property.maskingStrategy || 'none';
      const maskValue = property.maskValue || '****';

      // Find applicable rules for this property (sorted by priority)
      const propertyRules = applicableRules
        .filter(r => r.propertyId === property.id)
        .sort((a, b) => a.priority - b.priority);

      // Apply rules in priority order
      // More specific rules (user > group > role) take precedence when at same priority
      const sortedRules = this.sortRulesBySpecificity(propertyRules, user);

      for (const rule of sortedRules) {
        // Rule explicitly sets permissions
        canRead = rule.canRead;
        canWrite = rule.canWrite;

        // First matching rule wins (due to priority ordering)
        break;
      }

      // If property requires break-glass and user doesn't have active session, deny
      // This check would integrate with BreakGlassService in a full implementation
      const effectiveCanRead = requiresBreakGlass ? false : canRead;
      const effectiveCanWrite = requiresBreakGlass ? false : canWrite;

      // Determine if masking should be applied
      const isMasked = isSensitive && maskingStrategy !== 'none' && effectiveCanRead;

      results.push({
        propertyCode: property.code,
        canRead: effectiveCanRead,
        canWrite: effectiveCanWrite,
        isMasked,
        maskValue: isMasked ? maskValue : undefined,
        isPhi: property.isPhi,
        requiresBreakGlass,
      });
    }

    return results;
  }

  /**
   * Get properties for a collection with caching
   */
  private async getPropertiesForCollection(collectionId: string): Promise<PropertyDefinition[]> {
    const cacheKey = `property-defs:collection:${collectionId}`;
    const cached = await this.cache.get<PropertyDefinition[]>(cacheKey);
    if (cached) return cached;

    const properties = await this.propertyDefRepo.find({
      where: { collectionId, isActive: true },
      order: { position: 'ASC' },
    });

    await this.cache.set(cacheKey, properties, 300000); // 5 minutes
    return properties;
  }

  /**
   * Check if a property access rule matches the user's principals
   */
  private checkPropertyRulePrincipalMatch(rule: PropertyAccessRule, user: UserAccessContext): boolean {
    // If no principal specified, rule applies to everyone
    if (!rule.roleId && !rule.groupId && !rule.userId) {
      return true;
    }

    // Check user-specific rule
    if (rule.userId) {
      return user.id === rule.userId;
    }

    // Check role-based rule
    if (rule.roleId) {
      return user.roleIds.includes(rule.roleId);
    }

    // Check group-based rule
    if (rule.groupId) {
      return user.groupIds.includes(rule.groupId) || user.teamIds.includes(rule.groupId);
    }

    return false;
  }

  /**
   * Sort rules by specificity (user > group > role > everyone)
   * within the same priority level
   */
  private sortRulesBySpecificity(
    rules: PropertyAccessRule[],
    user: UserAccessContext
  ): PropertyAccessRule[] {
    return [...rules].sort((a, b) => {
      // First sort by priority (lower = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // At same priority, sort by specificity
      const specificityA = this.getRuleSpecificity(a, user);
      const specificityB = this.getRuleSpecificity(b, user);

      // Higher specificity wins
      return specificityB - specificityA;
    });
  }

  /**
   * Get specificity score for a rule
   * User-specific: 3, Group-specific: 2, Role-specific: 1, Everyone: 0
   */
  private getRuleSpecificity(rule: PropertyAccessRule, user: UserAccessContext): number {
    if (rule.userId && rule.userId === user.id) {
      return 3; // User-specific (most specific)
    }
    if (rule.groupId && (user.groupIds.includes(rule.groupId) || user.teamIds.includes(rule.groupId))) {
      return 2; // Group-specific
    }
    if (rule.roleId && user.roleIds.includes(rule.roleId)) {
      return 1; // Role-specific
    }
    return 0; // Everyone (least specific)
  }

  private evaluateCondition(
    condition: any,
    record: Record<string, unknown>,
    user: UserAccessContext
  ): { passed: boolean; details?: any } {
    if (this.isConditionGroup(condition)) {
      const details: any = { type: 'group' };
      let passed = true;

      const andConditions = condition.and ?? [];
      if (andConditions.length > 0) {
        const results = andConditions.map((c: any) => this.evaluateCondition(c, record, user));
        const andPassed = results.every((r: any) => r.passed);
        details.and = results;
        if (!andPassed) passed = false;
      }

      const orConditions = passed ? condition.or ?? [] : [];
      if (passed && orConditions.length > 0) {
        const results = orConditions.map((c: any) => this.evaluateCondition(c, record, user));
        const orPassed = results.some((r: any) => r.passed);
        details.or = results;
        if (!orPassed) passed = false;
      }

      return { passed, details };
    } else {
      const { property, operator, value } = condition;
      const recordValue = record[property];
      const expectedValue = this.resolveValue(value, user);
      
      const passed = this.compareValues(recordValue, operator, expectedValue);
      
      return {
        passed,
        details: {
          property,
          operator,
          recordValue,
          expectedValue,
          passed
        }
      };
    }
  }

  private isConditionGroup(c: any): c is { and?: any[]; or?: any[] } {
    return !!(c && (c.and || c.or));
  }

  private resolveValue(value: any, user: UserAccessContext): any {
    if (typeof value === 'string' && value.startsWith('@')) {
      const key = value as SpecialValueKey;
      if (SPECIAL_VALUES[key]) {
        return SPECIAL_VALUES[key](user);
      }
    }
    return value;
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals': return actual == expected;
      case 'not_equals': return actual != expected;
      case 'greater_than': return actual > expected;
      case 'greater_than_or_equals': return actual >= expected;
      case 'less_than': return actual < expected;
      case 'less_than_or_equals': return actual <= expected;
      case 'contains': return String(actual).includes(String(expected));
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
      default: return false;
    }
  }

  private createTraceEntry(
         rule: CollectionAccessRule,
         result: 'matched' | 'no_principal_match' | 'no_permission' | 'condition_failed' | 'skipped',
         principalMatch: boolean = false,
         permissionCheck: boolean = false,
         conditionCheck: boolean | null = null
       ): RuleEvaluationTrace {
         return {
           ruleId: rule.id,
           ruleName: rule.name,
           priority: rule.priority,
           principalMatch,
           permissionCheck,
           conditionCheck,
           result: result as RuleEvaluationTrace['result'],
         };
       }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  private async validatePrincipalExists(principalType: string, principalId: string): Promise<void> {
    let exists = false;

    switch (principalType) {
      case 'role':
        const role = await this.roleRepo.findOne({ where: { id: principalId } });
        exists = !!role;
        break;
      case 'team':
      case 'group':
        const group = await this.groupRepo.findOne({ where: { id: principalId } });
        exists = !!group;
        break;
      case 'user':
        const user = await this.userRepo.findOne({ where: { id: principalId } });
        exists = !!user;
        break;
      default:
        throw new BadRequestException(`Invalid principal type: ${principalType}`);
    }

    if (!exists) {
      throw new BadRequestException(`Principal not found: ${principalType}/${principalId}`);
    }
  }

  private async validateConditionProperties(collectionId: string, condition: unknown): Promise<void> {
    if (!condition || typeof condition !== 'object') {
      return;
    }

    const properties = await this.getPropertiesForCollection(collectionId);
    const propertyCodeSet = new Set(properties.map(p => p.code));

    const validateConditionNode = (node: unknown): void => {
      if (!node || typeof node !== 'object') {
        return;
      }

      const conditionObj = node as Record<string, unknown>;

      // Check for group conditions (and/or)
      if (conditionObj['and'] && Array.isArray(conditionObj['and'])) {
        for (const sub of conditionObj['and']) {
          validateConditionNode(sub);
        }
      }

      if (conditionObj['or'] && Array.isArray(conditionObj['or'])) {
        for (const sub of conditionObj['or']) {
          validateConditionNode(sub);
        }
      }

      // Check for leaf condition with property reference
      if (conditionObj['property'] && typeof conditionObj['property'] === 'string') {
        const propertyCode = conditionObj['property'];
        if (!propertyCodeSet.has(propertyCode)) {
          throw new BadRequestException(`Property not found in collection: ${propertyCode}`);
        }
      }
    };

    validateConditionNode(condition);
  }
}

