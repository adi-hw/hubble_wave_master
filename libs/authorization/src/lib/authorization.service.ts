import { Injectable, ForbiddenException } from '@nestjs/common';
import { RequestContext } from '@eam-platform/auth-guard';
import { TableAclRepository } from './table-acl.repository';
import { FieldAclRepository } from './field-acl.repository';
import { AbacService, SafePredicate } from './abac.service';
import { AuthorizedFieldMeta, FieldMeta, TableOperation, FieldOperation, MaskingStrategy } from './types';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly tableAclRepo: TableAclRepository,
    private readonly fieldAclRepo: FieldAclRepository,
    private readonly abacService: AbacService,
  ) {}

  // ---- TABLE LEVEL ----------------------------------------------------

  async ensureTableAccess(ctx: RequestContext, tableName: string, operation: TableOperation): Promise<void> {
    const allowed = await this.canAccessTable(ctx, tableName, operation);
    if (!allowed) {
      throw new ForbiddenException(`You do not have permission to ${operation} on ${tableName}`);
    }
  }

  async canAccessTable(ctx: RequestContext, tableName: string, operation: TableOperation): Promise<boolean> {
    if (this.isPlatformAdmin(ctx) || this.isTenantAdmin(ctx)) {
      return true;
    }

    if (this.hasPermission(ctx, `${tableName}.${operation}`) || this.hasPermission(ctx, `${tableName}:${operation}`)) {
      return true;
    }

    const tableAcls = await this.tableAclRepo.findByTableAndOperation(ctx.tenantId, tableName, operation);
    const permMap = await this.tableAclRepo.mapPermissionNames(
      ctx.tenantId,
      tableAcls.map((t) => t.requiredPermissionId).filter(Boolean) as string[],
    );

    for (const acl of tableAcls) {
      if (!acl.isEnabled) continue;
      if (acl.requiredRoles?.length && !this.hasAnyRole(ctx, acl.requiredRoles)) continue;
      if (acl.requiredPermissionId) {
        const permName = permMap.get(acl.requiredPermissionId);
        if (permName && !this.hasPermission(ctx, permName)) continue;
      }
      if (!this.abacService.matches(acl.conditionExpression as any, { subject: ctx })) continue;
      return true;
    }

    const abacPolicies = await this.abacService.getPolicies(ctx.tenantId, 'table', tableName, operation);
    for (const policy of abacPolicies) {
      const subjectMatches = this.abacService.matches(policy.subjectFilter as any, { subject: ctx });
      const conditionMatches = this.abacService.matches(policy.condition as any, { subject: ctx });
      if (subjectMatches && conditionMatches) {
        return policy.effect === 'ALLOW';
      }
    }

    // Security: Deny by default if no explicit ACL or ABAC policy allows access
    return false;
  }

  // ---- FIELD LEVEL ----------------------------------------------------

  async getAuthorizedFields(
    ctx: RequestContext,
    tableName: string,
    fields: FieldMeta[],
  ): Promise<AuthorizedFieldMeta[]> {
    const fieldAcls = await this.fieldAclRepo.findByTable(ctx.tenantId, tableName, 'read');
    const fieldWriteAcls = await this.fieldAclRepo.findByTable(ctx.tenantId, tableName, 'write');
    const permMap = await this.fieldAclRepo.mapPermissionNames(
      ctx.tenantId,
      [...fieldAcls, ...fieldWriteAcls].map((f) => f.requiredPermissionId).filter(Boolean) as string[],
    );

    const resolved = await Promise.all(fields.map(async (field) => {
      const base: AuthorizedFieldMeta = {
        ...field,
        canRead: true,
        canWrite: true,
        maskingStrategy: 'NONE',
      };

      if (field.isInternal && !this.isPlatformAdmin(ctx)) {
        base.canRead = false;
        base.canWrite = false;
        base.maskingStrategy = 'FULL';
        return base;
      }

      const readDecision = this.evaluateField(ctx, field, 'read', fieldAcls, permMap);
      const writeDecision = this.evaluateField(ctx, field, 'write', fieldWriteAcls, permMap);

      base.canRead = readDecision.allowed;
      base.canWrite = writeDecision.allowed;
      base.maskingStrategy = readDecision.mask ? (readDecision.mask as MaskingStrategy) : 'NONE';

      if (base.canRead) {
        const abacAllow = await this.checkAbacField(ctx, tableName, field.code, 'read');
        if (abacAllow === false) base.canRead = false;
      }
      if (base.canWrite) {
        const abacAllow = await this.checkAbacField(ctx, tableName, field.code, 'write');
        if (abacAllow === false) base.canWrite = false;
      }

      return base;
    }));

    return resolved;
  }

  async filterReadableFields(ctx: RequestContext, tableName: string, fields: FieldMeta[]) {
    const authFields = await this.getAuthorizedFields(ctx, tableName, fields);
    return authFields.filter((f) => f.canRead);
  }

  async filterWritableFields(ctx: RequestContext, tableName: string, fields: FieldMeta[]) {
    const authFields = await this.getAuthorizedFields(ctx, tableName, fields);
    return authFields.filter((f) => f.canWrite);
  }

  async maskRecord<T extends Record<string, any>>(
    _ctx: RequestContext,
    _tableName: string,
    record: T,
    fields: AuthorizedFieldMeta[],
  ): Promise<T> {
    const masked: Record<string, any> = { ...record };
    for (const field of fields) {
      if (!field.canRead) {
        masked[field.code] = null;
        continue;
      }
      if (field.maskingStrategy === 'FULL') {
        masked[field.code] = null;
      } else if (field.maskingStrategy === 'PARTIAL' && masked[field.code] !== undefined) {
        masked[field.code] = this.partialMask(masked[field.code]);
      }
    }
    return masked as T;
  }

  // ---- ROW-LEVEL / ABAC -----------------------------------------------

  /**
   * @deprecated Use getSafeRowLevelPredicates instead - this method returns empty array for security
   */
  async getRowLevelPredicates(_ctx: RequestContext, _tableName: string, _operation: TableOperation): Promise<string[]> {
    // SECURITY: Return empty array - raw SQL predicates are no longer supported
    // This prevents SQL injection via ABAC policies
    // Use getSafeRowLevelPredicates() and buildRowLevelClause() instead
    return [];
  }

  /**
   * Get safe, structured row-level predicates for a table operation.
   * These predicates can be safely converted to parameterized SQL.
   */
  async getSafeRowLevelPredicates(ctx: RequestContext, tableName: string, operation: TableOperation): Promise<SafePredicate[]> {
    const policies = await this.abacService.getPolicies(ctx.tenantId, 'table', tableName, operation);
    const predicates: SafePredicate[] = [];

    for (const policy of policies) {
      const subjectMatches = this.abacService.matches(policy.subjectFilter as any, { subject: ctx });
      const conditionMatches = this.abacService.matches(policy.condition as any, { subject: ctx });
      if (subjectMatches && conditionMatches) {
        predicates.push(...this.abacService.extractSafePredicates(policy.condition as any));
      }
    }

    return predicates;
  }

  /**
   * Build parameterized WHERE clauses from row-level predicates.
   * Returns clauses and params that can be safely used with TypeORM query builder.
   */
  async buildRowLevelClause(
    ctx: RequestContext,
    tableName: string,
    operation: TableOperation,
    tableAlias = 't'
  ): Promise<{ clauses: string[]; params: Record<string, any> }> {
    const predicates = await this.getSafeRowLevelPredicates(ctx, tableName, operation);

    const context = {
      userId: ctx.userId,
      roles: ctx.roles || [],
      groups: (ctx.attributes?.groups as string[] | undefined) ?? [],
      sites: (ctx.attributes?.sites as string[] | undefined) ?? [],
      tenantId: ctx.tenantId,
    };

    return this.abacService.buildPredicateClause(predicates, context, tableAlias);
  }

  // ---- Internals ------------------------------------------------------

  private evaluateField(
    ctx: RequestContext,
    field: FieldMeta,
    _operation: FieldOperation,
    acls: any[],
    permMap: Map<string, string>,
  ) {
    const relevant = acls.filter((acl) => acl.fieldName === field.code);
    for (const acl of relevant) {
      if (!acl.isEnabled) continue;
      if (acl.requiredRoles?.length && !this.hasAnyRole(ctx, acl.requiredRoles)) continue;
      if (acl.requiredPermissionId) {
        const permName = permMap.get(acl.requiredPermissionId);
        if (permName && !this.hasPermission(ctx, permName)) continue;
      }
      if (!this.abacService.matches(acl.conditionExpression as any, { subject: ctx })) continue;
      return { allowed: true, mask: acl.maskingStrategy };
    }
    if (relevant.length) {
      return { allowed: false };
    }
    return { allowed: true };
  }

  private checkAbacField(ctx: RequestContext, tableName: string, fieldCode: string, op: FieldOperation) {
    // Normalize to ABAC enum actions (create/read/update/delete/execute)
    const action = op === 'read' ? 'read' : 'update';
    const policiesPromise = this.abacService.getPolicies(ctx.tenantId, 'field', `${tableName}.${fieldCode}`, action);
    return policiesPromise.then((policies) => {
      if (!policies || policies.length === 0) {
        // No ABAC policies defined = allow by default (field-level defaults to permissive)
        // Note: table-level access control is still enforced
        return null as boolean | null;
      }

      for (const policy of policies) {
        const subjectMatches = this.abacService.matches(policy.subjectFilter as any, { subject: ctx });
        const conditionMatches = this.abacService.matches(policy.condition as any, { subject: ctx });
        if (subjectMatches && conditionMatches) {
          return policy.effect === 'ALLOW';
        }
      }

      // Security: If ABAC policies exist but none match, deny access
      return false;
    });
  }

  private partialMask(value: any) {
    if (typeof value === 'string') {
      if (value.length <= 4) return '****';
      return `${value.slice(0, 2)}****${value.slice(-2)}`;
    }
    if (typeof value === 'number') {
      const str = value.toString();
      if (str.length <= 4) return '****';
      return `${str.slice(0, 2)}****${str.slice(-2)}`;
    }
    return '****';
  }

  private hasPermission(ctx: RequestContext, perm: string) {
    return Array.isArray(ctx.permissions) && ctx.permissions.includes(perm);
  }

  private hasAnyRole(ctx: RequestContext, requiredRoles: string[]) {
    return Array.isArray(ctx.roles) && requiredRoles.some((r) => ctx.roles.includes(r));
  }

  private isPlatformAdmin(ctx: RequestContext) {
    return !!ctx.isPlatformAdmin || (Array.isArray(ctx.roles) && ctx.roles.includes('platform_admin'));
  }

  private isTenantAdmin(ctx: RequestContext) {
    return !!ctx.isTenantAdmin || (Array.isArray(ctx.roles) && ctx.roles.includes('tenant_admin'));
  }
}
