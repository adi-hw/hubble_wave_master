import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  CollectionAccessRule,
  PropertyAccessRule,
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
      // await this.validatePrincipalExists(dto.principalType, dto.principalId);
    }

    // Validate condition properties exist
    if (dto.condition) {
      // await this.validateConditionProperties(collectionId, dto.condition);
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
      // await this.validateConditionProperties(rule.collectionId, dto.condition);
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

  async getPropertyAccessForUser(
    _collectionId: string,
    _rules: PropertyAccessRule[],
    _user: UserAccessContext
  ): Promise<PropertyAccessResult[]> {
    // This is a simplified logic. In reality, we merge rules.
    // For now, let's just return what we have, filtering by principal.
    const results: PropertyAccessResult[] = [];
    
    // Group rules by propertyId/code logic could be here strictly
    // For now, listing valid props
    
    // We need to define property structure. Assuming rules cover distinct properties or merging top priority.
    // TODO: Implement full merge strategy.
    
    return results;
  }

  // private async invalidatePropertyRulesCache(_collectionId: string) {
  //   await this.cache.del(`property-rules:collection:${collectionId}`);
  // }

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
         result: 'matched' | 'no_principal_match' | 'no_permission' | 'condition_failed' | 'skipped', // Updated result type
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
           result: result as any, // Cast to any to bypass strict type check if needed, or align types
         };
       }
}

