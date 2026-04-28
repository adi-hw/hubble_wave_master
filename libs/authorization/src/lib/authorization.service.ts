import { Injectable, Inject, Optional, ForbiddenException, Logger } from '@nestjs/common';
import { RequestContext } from '@hubblewave/auth-guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  AuthorizedPropertyMeta,
  PropertyMeta,
  CollectionOperation,
  MaskingStrategy,
  CollectionAccessRuleData,
  PropertyAccessRuleData,
  UserAccessContext,
  AccessConditionData,
  SPECIAL_VALUES,
} from './types';
import { AbacService, SafePredicate } from './abac.service';
import { PolicyCompilerService } from './policy-compiler.service';

export interface RowLevelClause {
  clauses: string[];
  params: Record<string, unknown>;
}

export const COLLECTION_ACL_REPOSITORY = 'COLLECTION_ACL_REPOSITORY';
export const PROPERTY_ACL_REPOSITORY = 'PROPERTY_ACL_REPOSITORY';

interface CollectionAclRepo {
  find(options: { where: Record<string, unknown>; order?: Record<string, string> }): Promise<CollectionAccessRuleData[]>;
}

interface PropertyAclRepo {
  find(options: { where: Record<string, unknown>; order?: Record<string, string> }): Promise<PropertyAccessRuleData[]>;
}

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(
    @Optional() @Inject(COLLECTION_ACL_REPOSITORY)
    private readonly collectionAclRepo: CollectionAclRepo | null,
    @Optional() @Inject(PROPERTY_ACL_REPOSITORY)
    private readonly propertyAclRepo: PropertyAclRepo | null,
    @Optional() @Inject(CACHE_MANAGER)
    private readonly cache: Cache | null,
    @Optional()
    private readonly abacService: AbacService | null,
    private readonly policyCompiler: PolicyCompilerService,
  ) {}

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Check if user can access a table/collection for a given operation.
   * Returns true if access is allowed, false otherwise.
   */
  async canAccessTable(
    ctx: RequestContext,
    tableName: string,
    operation: CollectionOperation,
  ): Promise<boolean> {
    // Admin bypass
    if (ctx.isAdmin) {
      return true;
    }

    // If no repository configured, deny by default (secure)
    if (!this.collectionAclRepo) {
      this.logger.warn(`No collection access rule repository configured - denying access to ${tableName}`);
      return false;
    }

    const userContext = this.buildUserContext(ctx);
    const rules = await this.getCollectionRules(tableName, this.tenantScope(ctx));

    for (const rule of rules) {
      if (!this.checkPrincipalMatch(rule, userContext)) {
        continue;
      }

      if (this.checkOperationPermission(rule, operation)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Ensure user has access to a table, throwing ForbiddenException if not.
   */
  async ensureTableAccess(
    ctx: RequestContext,
    tableName: string,
    operation: CollectionOperation,
  ): Promise<void> {
    const hasAccess = await this.canAccessTable(ctx, tableName, operation);
    if (!hasAccess) {
      throw new ForbiddenException(
        `Access denied: You do not have permission to ${operation} records in ${tableName}`,
      );
    }
  }

  /**
   * Get safe row-level predicates for a table operation.
   * These can be used to build parameterized WHERE clauses.
   */
  async getSafeRowLevelPredicates(
    ctx: RequestContext,
    tableName: string,
    operation: CollectionOperation,
  ): Promise<SafePredicate[]> {
    // Admin bypass - no row restrictions
    if (ctx.isAdmin) {
      return [];
    }

    if (!this.collectionAclRepo) {
      return [];
    }

    const userContext = this.buildUserContext(ctx);
    const rules = await this.getCollectionRules(tableName, this.tenantScope(ctx));
    const predicates: SafePredicate[] = [];

    for (const rule of rules) {
      if (!this.checkPrincipalMatch(rule, userContext)) {
        continue;
      }

      if (!this.checkOperationPermission(rule, operation)) {
        continue;
      }

      // Extract safe predicates from conditions
      if (rule.conditions) {
        const rulePredicates = this.extractSafePredicatesFromCondition(
          rule.conditions,
          userContext,
        );
        predicates.push(...rulePredicates);
      }
    }

    return predicates;
  }

  /**
   * Build row-level security clause for SQL queries.
   * Returns parameterized WHERE clause components.
   */
  async buildRowLevelClause(
    ctx: RequestContext,
    tableName: string,
    operation: CollectionOperation,
    tableAlias = 't',
  ): Promise<RowLevelClause> {
    // Admin bypass
    if (ctx.isAdmin) {
      return { clauses: [], params: {} };
    }

    const predicates = await this.getSafeRowLevelPredicates(ctx, tableName, operation);

    if (predicates.length === 0) {
      return { clauses: [], params: {} };
    }

    // Use AbacService if available, otherwise build manually
    if (this.abacService) {
      const userContext = this.buildUserContext(ctx);
      return this.abacService.buildPredicateClause(predicates, {
        userId: userContext.userId,
        roles: userContext.roleIds,
        groups: userContext.groupIds,
        sites: userContext.siteIds,
      }, tableAlias);
    }

    // Manual predicate building
    return this.buildPredicateClauseInternal(predicates, ctx, tableAlias);
  }

  /**
   * Get authorized fields with read/write permissions and masking strategies.
   */
  async getAuthorizedFields(
    ctx: RequestContext,
    tableName: string,
    fields: PropertyMeta[],
  ): Promise<AuthorizedPropertyMeta[]> {
    // Admin bypass - full access
    if (ctx.isAdmin) {
      return fields.map((field) => ({
        ...field,
        canRead: true,
        canWrite: true,
        maskingStrategy: 'NONE' as MaskingStrategy,
      }));
    }

    // If no property access rule repo, use default permissions
    if (!this.propertyAclRepo) {
      return fields.map((field) => ({
        ...field,
        canRead: true,
        canWrite: !field.isSystem,
        maskingStrategy: 'NONE' as MaskingStrategy,
      }));
    }

    const userContext = this.buildUserContext(ctx);
    const propertyRules = await this.getPropertyRules(tableName, this.tenantScope(ctx));

    return fields.map((field) => {
      const fieldRules = propertyRules.filter(
        (r) => r.propertyCode === field.code || r.propertyId === field.code,
      );

      // Default: readable, writable unless system field
      let canRead = true;
      let canWrite = !field.isSystem;
      let maskingStrategy: MaskingStrategy = 'NONE';

      // Apply matching rules (first match wins based on priority)
      for (const rule of fieldRules) {
        if (!this.checkPropertyPrincipalMatch(rule, userContext)) {
          continue;
        }

        // Apply permissions from the matching rule
        canRead = rule.canRead;
        canWrite = rule.canWrite;
        maskingStrategy = rule.maskingStrategy || 'NONE';
        break;
      }

      return {
        ...field,
        canRead,
        canWrite,
        maskingStrategy,
      };
    });
  }

  /**
   * Filter fields to only those readable by the user.
   */
  async filterReadableFields(
    ctx: RequestContext,
    tableName: string,
    fields: PropertyMeta[],
  ): Promise<AuthorizedPropertyMeta[]> {
    const authorized = await this.getAuthorizedFields(ctx, tableName, fields);
    return authorized.filter((f) => f.canRead);
  }

  /**
   * Filter fields to only those writable by the user.
   */
  async filterWritableFields(
    ctx: RequestContext,
    tableName: string,
    fields: PropertyMeta[],
  ): Promise<AuthorizedPropertyMeta[]> {
    const authorized = await this.getAuthorizedFields(ctx, tableName, fields);
    return authorized.filter((f) => f.canWrite);
  }

  /**
   * Apply field masking to a record based on authorization.
   */
  async maskRecord(
    ctx: RequestContext,
    _tableName: string,
    record: Record<string, unknown>,
    fields: AuthorizedPropertyMeta[],
  ): Promise<Record<string, unknown>> {
    // Admin bypass - no masking
    if (ctx.isAdmin) {
      return record;
    }

    const masked = { ...record };

    for (const field of fields) {
      if (!field.canRead) {
        // Remove field entirely if not readable
        delete masked[field.code];
        continue;
      }

      if (field.maskingStrategy !== 'NONE' && masked[field.code] !== undefined) {
        masked[field.code] = this.applyMask(masked[field.code], field.maskingStrategy);
      }
    }

    return masked;
  }

  /**
   * Check if user can perform operation on a specific record.
   * Evaluates row-level conditions against the record data.
   */
  async canAccessRecord(
    ctx: RequestContext,
    tableName: string,
    operation: CollectionOperation,
    record: Record<string, unknown>,
  ): Promise<boolean> {
    // Admin bypass
    if (ctx.isAdmin) {
      return true;
    }

    if (!this.collectionAclRepo) {
      return false;
    }

    const userContext = this.buildUserContext(ctx);
    const rules = await this.getCollectionRules(tableName, this.tenantScope(ctx));

    for (const rule of rules) {
      if (!this.checkPrincipalMatch(rule, userContext)) {
        continue;
      }

      if (!this.checkOperationPermission(rule, operation)) {
        continue;
      }

      // Check conditions against record
      if (rule.conditions) {
        const conditionMet = this.evaluateCondition(rule.conditions, record, userContext);
        if (!conditionMet) {
          continue;
        }
      }

      // Rule matched - access granted
      return true;
    }

    return false;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private buildUserContext(ctx: RequestContext): UserAccessContext {
    const attributes = ctx.attributes || {};

    return {
      userId: ctx.userId,
      email: attributes['email'] as string | undefined,
      roleIds: (attributes['roleIds'] as string[]) || ctx.roles || [],
      roleNames: ctx.roles || [],
      groupIds: (attributes['groupIds'] as string[]) || [],
      teamIds: (attributes['teamIds'] as string[]) || [],
      departmentId: attributes['departmentId'] as string | undefined,
      locationId: attributes['locationId'] as string | undefined,
      siteIds: (attributes['siteIds'] as string[]) || [],
      isAdmin: ctx.isAdmin,
    };
  }

  private async getCollectionRules(
    collectionId: string,
    tenantScope: string,
  ): Promise<CollectionAccessRuleData[]> {
    if (!this.collectionAclRepo) {
      return [];
    }

    const cacheKey = `auth:${tenantScope}:collection-rules:${collectionId}`;

    if (this.cache) {
      const cached = await this.cache.get<CollectionAccessRuleData[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const rules = await this.collectionAclRepo.find({
      where: { collectionId, isActive: true },
      order: { priority: 'ASC' },
    });

    if (this.cache) {
      await this.cache.set(cacheKey, rules, this.CACHE_TTL);
    }

    return rules;
  }

  private async getPropertyRules(
    collectionId: string,
    tenantScope: string,
  ): Promise<PropertyAccessRuleData[]> {
    if (!this.propertyAclRepo) {
      return [];
    }

    const cacheKey = `auth:${tenantScope}:property-rules:${collectionId}`;

    if (this.cache) {
      const cached = await this.cache.get<PropertyAccessRuleData[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const rules = await this.propertyAclRepo.find({
      where: { collectionId, isActive: true },
      order: { priority: 'ASC' },
    });

    if (this.cache) {
      await this.cache.set(cacheKey, rules, this.CACHE_TTL);
    }

    return rules;
  }

  /**
   * Resolve a tenant scope token from the request context. ACL caches must be
   * keyed under this token so a rule fetched on instance A is never served to
   * a request from instance B in shared-process deployments. Falls back to a
   * sentinel that is unique per service when no organization is on the
   * context (better than collisions across tenants).
   */
  private tenantScope(ctx: RequestContext): string {
    const fromAttributes = ctx.attributes?.['organizationId'] || ctx.attributes?.['instanceSlug'];
    if (typeof fromAttributes === 'string' && fromAttributes.trim()) {
      return fromAttributes.trim();
    }
    return process.env['INSTANCE_ID'] || 'unscoped';
  }

  private checkPrincipalMatch(
    rule: CollectionAccessRuleData,
    user: UserAccessContext,
  ): boolean {
    // If no specific principal, rule applies to everyone
    if (!rule.roleId && !rule.groupId && !rule.userId) {
      return true;
    }

    // Check user-specific rule
    if (rule.userId) {
      return user.userId === rule.userId;
    }

    // Check role-based rule
    if (rule.roleId) {
      return user.roleIds.includes(rule.roleId);
    }

    // Check group-based rule
    if (rule.groupId) {
      return (
        user.groupIds.includes(rule.groupId) ||
        user.teamIds.includes(rule.groupId)
      );
    }

    return false;
  }

  private checkPropertyPrincipalMatch(
    rule: PropertyAccessRuleData,
    user: UserAccessContext,
  ): boolean {
    if (!rule.roleId && !rule.groupId && !rule.userId) {
      return true;
    }

    if (rule.userId) {
      return user.userId === rule.userId;
    }

    if (rule.roleId) {
      return user.roleIds.includes(rule.roleId);
    }

    if (rule.groupId) {
      return (
        user.groupIds.includes(rule.groupId) ||
        user.teamIds.includes(rule.groupId)
      );
    }

    return false;
  }

  private checkOperationPermission(
    rule: CollectionAccessRuleData,
    operation: CollectionOperation,
  ): boolean {
    switch (operation) {
      case 'read':
        return rule.canRead;
      case 'create':
        return rule.canCreate;
      case 'update':
        return rule.canUpdate;
      case 'delete':
        return rule.canDelete;
      default:
        return false;
    }
  }

  private evaluateCondition(
    condition: AccessConditionData,
    record: Record<string, unknown>,
    user: UserAccessContext,
  ): boolean {
    // Handle condition groups (AND/OR)
    if (condition.and || condition.or) {
      if (condition.and && condition.and.length > 0) {
        const andResult = condition.and.every((c) =>
          this.evaluateCondition(c, record, user),
        );
        if (!andResult) return false;
      }

      if (condition.or && condition.or.length > 0) {
        const orResult = condition.or.some((c) =>
          this.evaluateCondition(c, record, user),
        );
        if (!orResult) return false;
      }

      return true;
    }

    // Handle simple condition
    if (!condition.property || !condition.operator) {
      return true;
    }

    const recordValue = record[condition.property];
    const expectedValue = this.resolveValue(condition.value, user);

    return this.compareValues(recordValue, condition.operator, expectedValue);
  }

  private resolveValue(value: unknown, user: UserAccessContext): unknown {
    if (typeof value === 'string' && value.startsWith('@')) {
      const resolver = SPECIAL_VALUES[value];
      if (resolver) {
        return resolver(user);
      }
    }
    return value;
  }

  private compareValues(
    actual: unknown,
    operator: string,
    expected: unknown,
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'greater_than':
        return (actual as number) > (expected as number);
      case 'greater_than_or_equals':
        return (actual as number) >= (expected as number);
      case 'less_than':
        return (actual as number) < (expected as number);
      case 'less_than_or_equals':
        return (actual as number) <= (expected as number);
      case 'contains':
        return String(actual).includes(String(expected));
      case 'not_contains':
        return !String(actual).includes(String(expected));
      case 'starts_with':
        return String(actual).startsWith(String(expected));
      case 'ends_with':
        return String(actual).endsWith(String(expected));
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'is_null':
        return actual === null || actual === undefined;
      case 'is_not_null':
        return actual !== null && actual !== undefined;
      default:
        return false;
    }
  }

  private extractSafePredicatesFromCondition(
    condition: AccessConditionData,
    user: UserAccessContext,
  ): SafePredicate[] {
    return this.policyCompiler.compile(condition, user);
  }

  /**
   * Resolve the predicate's runtime value. Array context refs (roles, groups,
   * sites) yield string[]; scalar refs (userId) yield string. Callers MUST
   * inspect the operator before binding so we never bind a string[] into a
   * scalar comparison or vice versa.
   */
  private resolvePredicateValue(
    pred: SafePredicate,
    ctx: RequestContext,
  ): string | string[] | number | boolean | null | undefined {
    if (!pred.contextRef) {
      return pred.value ?? null;
    }
    switch (pred.contextRef) {
      case 'userId':
        return ctx.userId;
      case 'roles':
        return Array.isArray(ctx.roles) ? ctx.roles : [];
      case 'groups':
        return (ctx.attributes?.['groupIds'] as string[] | undefined) ?? [];
      case 'sites':
        return (ctx.attributes?.['siteIds'] as string[] | undefined) ?? [];
      default:
        return undefined;
    }
  }

  private buildPredicateClauseInternal(
    predicates: SafePredicate[],
    ctx: RequestContext,
    tableAlias: string,
  ): RowLevelClause {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    let paramIndex = 0;

    for (const pred of predicates) {
      const field = `${tableAlias}."${pred.field}"`;
      const paramName = `rls_p${paramIndex++}`;
      const value = this.resolvePredicateValue(pred, ctx);

      switch (pred.operator) {
        case 'eq':
        case 'neq': {
          // Array values do not legally bind to scalar comparisons. Refuse
          // rather than coerce so a misconfigured policy fails closed.
          if (Array.isArray(value)) {
            this.logger.warn(
              `Skipping ${pred.operator} predicate on ${pred.field}: array value not supported for scalar operator`,
            );
            paramIndex--;
            continue;
          }
          clauses.push(`${field} ${pred.operator === 'eq' ? '=' : '!='} :${paramName}`);
          params[paramName] = value ?? null;
          break;
        }
        case 'in':
        case 'not_in': {
          // Postgres ANY/ALL bind to array params. Coerce scalars into
          // single-element arrays so a literal-value `in` policy still works.
          const arr = Array.isArray(value) ? value : value !== undefined && value !== null ? [value] : [];
          if (arr.length === 0) {
            paramIndex--;
            continue;
          }
          clauses.push(
            pred.operator === 'in'
              ? `${field} = ANY(:${paramName})`
              : `${field} != ALL(:${paramName})`,
          );
          params[paramName] = arr;
          break;
        }
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte': {
          if (Array.isArray(value)) {
            this.logger.warn(
              `Skipping ${pred.operator} predicate on ${pred.field}: array value not supported for range operator`,
            );
            paramIndex--;
            continue;
          }
          const opSql =
            pred.operator === 'gt' ? '>' :
            pred.operator === 'gte' ? '>=' :
            pred.operator === 'lt' ? '<' :
            '<=';
          clauses.push(`${field} ${opSql} :${paramName}`);
          params[paramName] = value;
          break;
        }
        case 'is_null':
          paramIndex--;
          clauses.push(`${field} IS NULL`);
          break;
        case 'is_not_null':
          paramIndex--;
          clauses.push(`${field} IS NOT NULL`);
          break;
      }
    }

    return { clauses, params };
  }

  private applyMask(value: unknown, strategy: MaskingStrategy): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    switch (strategy) {
      case 'FULL':
        return '********';

      case 'PARTIAL':
        const str = String(value);
        if (str.length <= 4) {
          return '****';
        }
        // Show first 2 and last 2 characters
        return `${str.slice(0, 2)}${'*'.repeat(str.length - 4)}${str.slice(-2)}`;

      case 'NONE':
      default:
        return value;
    }
  }
}
