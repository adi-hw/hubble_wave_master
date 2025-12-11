import { Injectable } from '@nestjs/common';
import { TenantDbService } from '@eam-platform/tenant-db';
import { AbacPolicy } from '@eam-platform/platform-db';
import { IsNull } from 'typeorm';

/**
 * Supported predicate operations for row-level security.
 * These are translated to safe, parameterized SQL conditions.
 */
export type SafePredicate = {
  /** Column name (must be valid SQL identifier) */
  field: string;
  /** Comparison operator */
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte' | 'is_null' | 'is_not_null';
  /** Value to compare against - use context references like '$userId' or '$roles' */
  value?: string | number | boolean | null;
  /** Reference to context value instead of literal (e.g., 'userId', 'roles', 'groups') */
  contextRef?: string;
};

type Condition = {
  equals?: Record<string, unknown>;
  in?: Record<string, unknown>;
  /** @deprecated Use safePredicates instead - raw SQL predicates are no longer supported */
  predicates?: string[];
  /** @deprecated Use safePredicates instead - raw SQL predicates are no longer supported */
  predicate?: string;
  /** Safe, structured predicates for row-level security */
  safePredicates?: SafePredicate[];
};

// Whitelist of allowed column names for row-level security
const ALLOWED_RLS_COLUMNS = new Set([
  'id', 'created_by', 'updated_by', 'owner_id', 'assigned_to', 'assigned_user_id',
  'site_id', 'location_id', 'department_id', 'team_id', 'group_id',
  'status', 'state', 'is_active', 'is_deleted', 'tenant_id',
  'created_at', 'updated_at', 'visibility', 'access_level',
]);

@Injectable()
export class AbacService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async getPolicies(tenantId: string, resourceType: string, resource: string, action: string) {
    // Normalize legacy/write operations to the enum-friendly value
    const normalizedAction = action === 'write' ? 'update' : action;
    const repo = await this.tenantDb.getRepository<AbacPolicy>(tenantId, AbacPolicy as any);
    return repo.find({
      where: [
        { tenantId, resource, action: normalizedAction, resourceType, isEnabled: true },
        { tenantId: IsNull(), resource, action: normalizedAction, resourceType, isEnabled: true },
      ],
      order: { priority: 'ASC' },
    });
  }

  matches(condition: Condition | undefined, context: Record<string, any>) {
    if (!condition) return true;
    if (condition.equals) {
      for (const [key, expected] of Object.entries(condition.equals)) {
        if (this.readContext(context, key) !== expected) return false;
      }
    }
    if (condition.in) {
      for (const [key, expected] of Object.entries(condition.in)) {
        const actual = this.readContext(context, key);
        const list = Array.isArray(expected) ? expected : [expected];
        if (!list.includes(actual as never)) return false;
      }
    }
    return true;
  }

  /**
   * Extract safe predicates from a condition.
   * Returns structured predicate objects that can be safely converted to parameterized SQL.
   *
   * @deprecated raw string predicates are ignored for security - use safePredicates instead
   */
  extractSafePredicates(condition: Condition | undefined): SafePredicate[] {
    if (!condition) return [];

    // Only return structured safe predicates - ignore raw SQL strings for security
    if (Array.isArray(condition.safePredicates)) {
      return condition.safePredicates.filter(p => this.validatePredicate(p));
    }

    // Log warning if legacy raw predicates are found (but don't use them)
    if (condition.predicates?.length || condition.predicate) {
      console.warn(
        'SECURITY: Raw SQL predicates in ABAC policy are ignored. ' +
        'Migrate to safePredicates format for row-level security.'
      );
    }

    return [];
  }

  /**
   * @deprecated Use extractSafePredicates instead - this method is kept for backward compatibility
   * but returns empty array to prevent SQL injection
   */
  extractPredicates(condition: Condition | undefined): string[] {
    // SECURITY: Never return raw SQL predicates - they enable SQL injection
    // Log a warning to help identify policies that need migration
    if (condition?.predicates?.length || condition?.predicate) {
      console.warn(
        'SECURITY: extractPredicates() called with raw SQL predicates. ' +
        'These are IGNORED to prevent SQL injection. Migrate to safePredicates format.'
      );
    }
    return [];
  }

  /**
   * Validate that a predicate is safe to use
   */
  private validatePredicate(pred: SafePredicate): boolean {
    // Validate field name is in whitelist or matches safe pattern
    if (!pred.field) return false;

    const fieldLower = pred.field.toLowerCase();
    if (!ALLOWED_RLS_COLUMNS.has(fieldLower)) {
      // Allow custom fields that match safe identifier pattern
      if (!/^[a-z_][a-z0-9_]*$/.test(fieldLower)) {
        console.warn(`SECURITY: Invalid RLS field name rejected: ${pred.field}`);
        return false;
      }
    }

    // Validate operator
    const validOps = ['eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'is_null', 'is_not_null'];
    if (!validOps.includes(pred.operator)) {
      console.warn(`SECURITY: Invalid RLS operator rejected: ${pred.operator}`);
      return false;
    }

    // Validate contextRef if present
    if (pred.contextRef) {
      const validRefs = ['userId', 'roles', 'groups', 'sites', 'tenantId', 'departments', 'teams'];
      if (!validRefs.includes(pred.contextRef)) {
        console.warn(`SECURITY: Invalid RLS context reference rejected: ${pred.contextRef}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Build a parameterized WHERE clause from safe predicates.
   * Returns { sql: string, params: Record<string, any> } for use with query builder.
   */
  buildPredicateClause(
    predicates: SafePredicate[],
    context: { userId: string; roles: string[]; groups?: string[]; sites?: string[]; tenantId?: string },
    tableAlias = 't'
  ): { clauses: string[]; params: Record<string, any> } {
    const clauses: string[] = [];
    const params: Record<string, any> = {};
    let paramIndex = 0;

    for (const pred of predicates) {
      if (!this.validatePredicate(pred)) continue;

      const field = `${tableAlias}."${pred.field}"`;
      const paramName = `rls_${paramIndex++}`;

      // Resolve value from context if contextRef is specified
      let value: string | number | boolean | null | undefined | string[] = pred.value;
      if (pred.contextRef) {
        switch (pred.contextRef) {
          case 'userId': value = context.userId; break;
          case 'roles': value = context.roles; break;
          case 'groups': value = context.groups ?? []; break;
          case 'sites': value = context.sites ?? []; break;
          case 'tenantId': value = context.tenantId; break;
          default: continue; // Skip invalid refs
        }
      }

      switch (pred.operator) {
        case 'eq':
          clauses.push(`${field} = :${paramName}`);
          params[paramName] = value;
          break;
        case 'neq':
          clauses.push(`${field} != :${paramName}`);
          params[paramName] = value;
          break;
        case 'in':
          if (Array.isArray(value) && value.length > 0) {
            clauses.push(`${field} = ANY(:${paramName})`);
            params[paramName] = value;
          }
          break;
        case 'not_in':
          if (Array.isArray(value) && value.length > 0) {
            clauses.push(`${field} != ALL(:${paramName})`);
            params[paramName] = value;
          }
          break;
        case 'gt':
          clauses.push(`${field} > :${paramName}`);
          params[paramName] = value;
          break;
        case 'gte':
          clauses.push(`${field} >= :${paramName}`);
          params[paramName] = value;
          break;
        case 'lt':
          clauses.push(`${field} < :${paramName}`);
          params[paramName] = value;
          break;
        case 'lte':
          clauses.push(`${field} <= :${paramName}`);
          params[paramName] = value;
          break;
        case 'is_null':
          clauses.push(`${field} IS NULL`);
          break;
        case 'is_not_null':
          clauses.push(`${field} IS NOT NULL`);
          break;
      }
    }

    return { clauses, params };
  }

  private readContext(ctx: Record<string, any>, path: string): unknown {
    return path.split('.').reduce((acc, segment) => (acc ? acc[segment] : undefined), ctx);
  }
}
