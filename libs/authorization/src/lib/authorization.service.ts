import { Injectable, Inject, Optional, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
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
import { AbacService, SafePredicate, LeafPredicate } from './abac.service';
import { PolicyCompilerService } from './policy-compiler.service';
import { ACCESS_AUDIT_PORT, type AccessAuditPort } from './audit-port';
import type {
  AccessRuleCacheInvalidationPort,
  CollectionRuleChangeEvent,
  PropertyRuleChangeEvent,
} from './cache-invalidation.port';

export interface RowLevelClause {
  clauses: string[];
  params: Record<string, unknown>;
}

export const COLLECTION_ACL_REPOSITORY = 'COLLECTION_ACL_REPOSITORY';
export const PROPERTY_ACL_REPOSITORY = 'PROPERTY_ACL_REPOSITORY';
export const COLLECTION_DEFINITION_REPOSITORY = 'COLLECTION_DEFINITION_REPOSITORY';

interface CollectionAclRepo {
  find(options: { where: Record<string, unknown>; order?: Record<string, string> }): Promise<CollectionAccessRuleData[]>;
  /**
   * F023: when the repo can filter by principal in SQL, use this overload to
   * avoid the fetch-all-then-JS-filter pattern. Returns the same shape as
   * `find` but pre-filtered to rules whose principal matches the user
   * (own userId, any of roleIds, any of groupIds, or the all-NULL
   * "applies to everyone" rule).
   */
  findByCollectionAndUser?(
    collectionId: string,
    userId: string,
    roleIds: string[],
    groupIds: string[],
  ): Promise<CollectionAccessRuleData[]>;
}

interface PropertyAclRepo {
  find(options: { where: Record<string, unknown>; order?: Record<string, string> }): Promise<PropertyAccessRuleData[]>;
}

/**
 * Minimal repository contract used to translate a `tableName` (mutable label)
 * into the stable `collectionId` UUID, and to look up per-collection
 * authorization flags (canon §28.2 level 7, F005) by `id`. Any repository
 * whose entity exposes `id`, `tableName`, and `secureFieldsByDefault`
 * columns can satisfy this interface.
 *
 * `secureFieldsByDefault` is optional on the return type — test stubs
 * that pre-date F005 may omit it. The production `CollectionDefinition`
 * repo (TypeORM) returns it as a `boolean` (DB default `false`).
 */
interface CollectionDefinitionLookupRepo {
  findOne(
    options: { where: { tableName: string } | { id: string } },
  ): Promise<{ id: string; secureFieldsByDefault?: boolean } | null>;
}

@Injectable()
export class AuthorizationService implements AccessRuleCacheInvalidationPort {
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
    @Optional() @Inject(COLLECTION_DEFINITION_REPOSITORY)
    private readonly collectionDefinitionRepo: CollectionDefinitionLookupRepo | null = null,
    @Optional() @Inject(ACCESS_AUDIT_PORT)
    private readonly accessAudit: AccessAuditPort | null = null,
  ) {}

  // ============================================================================
  // Public API — Collection variants (preferred)
  //
  // These methods take the stable `collectionId` UUID and are the canonical
  // entry points. Use them whenever the caller already has a `collectionId`
  // in scope (which is true for nearly every direct caller).
  // ============================================================================

  /**
   * Check if user can access a collection for a given operation.
   * Returns true if access is allowed, false otherwise.
   *
   * F006 / canon §28.3 two-pass evaluation:
   * 1. Walk all matching rules. Any UNCONDITIONAL deny matching the
   *    operation → DENY (§28.4 rule 1, deny wins). Conditional denies do
   *    not block collection-level access — their row-conditions can only
   *    exclude specific records, not the whole collection.
   * 2. Otherwise, allow rules UNION: any matching allow on the operation
   *    grants access (§28.4 rule 5).
   */
  async canAccessCollection(
    ctx: RequestContext,
    collectionId: string,
    operation: CollectionOperation,
  ): Promise<boolean> {
    // Admin bypass
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, collectionId, operation);
      return true;
    }

    // If no repository configured, deny by default (secure)
    if (!this.collectionAclRepo) {
      this.logger.warn(`No collection access rule repository configured - denying access to collection ${collectionId}`);
      return false;
    }

    const userContext = this.buildUserContext(ctx);
    const rules = await this.getCollectionRules(collectionId, userContext);

    // Pass 1: any UNCONDITIONAL deny that matches the principal and the
    // operation flag wins outright (canon §28.4 rule 1). A conditional
    // deny does NOT block the collection-level check — its row-conditions
    // can only carve out specific records, evaluated by
    // canAccessCollectionRecord / getSafeRowLevelPredicatesForCollection.
    for (const rule of rules) {
      if (rule.effect !== 'deny') continue;
      if (!this.checkPrincipalMatch(rule, userContext)) continue;
      if (!this.checkOperationPermission(rule, operation)) continue;
      if (rule.conditions) continue;
      return false;
    }

    // Pass 2: union of allow rules. Any matching allow grants access.
    for (const rule of rules) {
      if (rule.effect === 'deny') continue;
      // F023 defense: principal-filter happened in SQL when the repo
      // supports it, but checkPrincipalMatch stays as a safety net for
      // stub-only test repos and against a future repo-impl regression.
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
   * Ensure user has access to a collection, throwing ForbiddenException if not.
   */
  async ensureCollectionAccess(
    ctx: RequestContext,
    collectionId: string,
    operation: CollectionOperation,
  ): Promise<void> {
    const hasAccess = await this.canAccessCollection(ctx, collectionId, operation);
    if (!hasAccess) {
      throw new ForbiddenException(
        `Access denied: You do not have permission to ${operation} records in collection ${collectionId}`,
      );
    }
  }

  /**
   * Get safe row-level predicates for a collection operation.
   * These can be used to build parameterized WHERE clauses.
   *
   * F006 / canon §28.3 + §28.4:
   * - Allow branches UNION (§28.4 rule 5). Multi-rule case wraps in `or`.
   * - Deny branches INTERSECT-with-not (§28.4 rule 1, deny wins). Multi-
   *   deny case wraps the deny set in `or` then negates the lot via `not`.
   * - The composed output is `[allow_or_clause, NOT (deny_or_clause)]`,
   *   AND'd by the renderer → `(allow_set) AND NOT (deny_set)`.
   *
   * Note: an unconditional deny is handled by canAccessCollection — it
   * already denies the whole collection so this method is never reached.
   * Defensively, an unconditional matching deny here still produces a
   * `NOT (TRUE)` style predicate that excludes every row.
   */
  async getSafeRowLevelPredicatesForCollection(
    ctx: RequestContext,
    collectionId: string,
    operation: CollectionOperation,
  ): Promise<SafePredicate[]> {
    // Admin bypass - no row restrictions
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, collectionId, `${operation}:row-filter`);
      return [];
    }

    if (!this.collectionAclRepo) {
      return [];
    }

    const userContext = this.buildUserContext(ctx);
    const rules = await this.getCollectionRules(collectionId, userContext);

    // F003 + F006: separate matching rules into allow and deny lanes.
    // Each lane's branches OR together; the lanes combine as
    // `(allow_or) AND NOT (deny_or)` via the renderer's AND-of-clauses.
    const allowBranches: SafePredicate[][] = [];
    const denyBranches: SafePredicate[][] = [];
    let hasUnconditionalAllow = false;
    let hasUnconditionalDeny = false;

    for (const rule of rules) {
      if (!this.checkPrincipalMatch(rule, userContext)) {
        continue;
      }
      if (!this.checkOperationPermission(rule, operation)) {
        continue;
      }

      const isDeny = rule.effect === 'deny';
      if (!rule.conditions) {
        // Unconditional grant or block at the row level.
        if (isDeny) {
          hasUnconditionalDeny = true;
        } else {
          hasUnconditionalAllow = true;
        }
        continue;
      }

      const rulePredicates = this.extractSafePredicatesFromCondition(
        rule.conditions,
        userContext,
      );
      if (rulePredicates.length === 0) continue;

      (isDeny ? denyBranches : allowBranches).push(rulePredicates);
    }

    // Unconditional deny at the row level is a contradiction caught earlier
    // by canAccessCollection (which returns false and prevents this method
    // being called for visible rows). If we somehow get here with one, fail
    // closed: emit a predicate that never matches.
    if (hasUnconditionalDeny) {
      return [{
        kind: 'leaf',
        field: 'id',
        operator: 'eq',
        value: '00000000-0000-0000-0000-000000000000',
      }];
    }

    const output: SafePredicate[] = [];

    // Allow lane. If any unconditional allow matched, the allow lane is
    // "all rows" — emit nothing for it (caller's WHERE stays unconstrained
    // by allows). Otherwise wrap each conditional-allow rule's predicates
    // as one branch of an `or`.
    if (!hasUnconditionalAllow && allowBranches.length > 0) {
      if (allowBranches.length === 1) {
        // Single allow rule: emit predicates flat. The renderer AND's them.
        output.push(...allowBranches[0]);
      } else {
        // Multi-rule allows (F003): `or` over branches.
        output.push({ kind: 'or', branches: allowBranches });
      }
    }

    // Deny lane. Wrap the deny rules in `not` so the renderer emits
    // `NOT (...)`. The `not` body is an `or` over deny branches when
    // multiple denies match, otherwise the single deny rule's leaves
    // wrapped directly in `not`.
    if (denyBranches.length > 0) {
      if (denyBranches.length === 1) {
        output.push({ kind: 'not', inner: denyBranches[0] });
      } else {
        output.push({
          kind: 'not',
          inner: [{ kind: 'or', branches: denyBranches }],
        });
      }
    }

    // Special case: no allow lane (no allows matched at all) and no deny
    // lane either. canAccessCollection would have already denied (no
    // allows = no access), so this method's result is moot — return [].
    // This matches the pre-F006 behaviour.
    return output;
  }

  /**
   * Build row-level security clause for SQL queries against a collection.
   * Returns parameterized WHERE clause components.
   */
  async buildCollectionRowLevelClause(
    ctx: RequestContext,
    collectionId: string,
    operation: CollectionOperation,
    tableAlias = 't',
  ): Promise<RowLevelClause> {
    // Admin bypass
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, collectionId, `${operation}:row-clause`);
      return { clauses: [], params: {} };
    }

    const predicates = await this.getSafeRowLevelPredicatesForCollection(ctx, collectionId, operation);

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
   * Get authorized fields for a collection with read/write permissions and masking strategies.
   */
  async getAuthorizedFieldsForCollection(
    ctx: RequestContext,
    collectionId: string,
    fields: PropertyMeta[],
  ): Promise<AuthorizedPropertyMeta[]> {
    // Admin bypass - full access
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, collectionId, 'fields:read');
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
    const propertyRules = await this.getPropertyRules(collectionId);

    // Canon §28.2 level 7 (F005): per-collection default-deny flag. If
    // the collection opts in by setting `secureFieldsByDefault=true`, a
    // field that no explicit (levels 1-2) or wildcard (levels 3-4) rule
    // matched resolves to canRead=false, canWrite=false, mask='FULL'.
    // When `false` (the DB default), the evaluator preserves the pre-§28
    // default-allow path for backward compatibility with existing
    // customer packs. Fetched once per call and cached for CACHE_TTL.
    const collectionFlag = await this.lookupCollectionFlag(collectionId);
    const defaultDeny = collectionFlag?.secureFieldsByDefault === true;

    // Canon §28.2 wildcard support: split the fetched rules into two
    // buckets once per collection, then per-field we filter the explicit
    // bucket on the field's code/id. Wildcard rules apply to every field
    // of `collectionId` so they pre-filter the same way for all fields.
    //
    // The XOR CHECK constraint on the DB guarantees each row is exactly
    // one shape (propertyId set XOR wildcardCollectionId set), so the
    // bucketing is unambiguous. A rule with `wildcardCollectionId !==
    // collectionId` is silently irrelevant — the repository's query
    // already filters by `wildcard_collection_id = :collectionId`, but
    // we belt-and-suspenders here so a misbehaving stub repo cannot
    // leak cross-collection wildcards into the evaluator.
    const wildcardRules = propertyRules.filter(
      (r) => r.wildcardCollectionId === collectionId,
    );

    return fields.map((field) => {
      const explicitFieldRules = propertyRules.filter(
        (r) =>
          // Explicit-field rules carry propertyId/propertyCode. The DB
          // XOR check guarantees these rules have wildcardCollectionId
          // null/undefined.
          !r.wildcardCollectionId &&
          (r.propertyCode === field.code || r.propertyId === field.code),
      );

      // Canon §28.2 walks levels 1→7 and the first matching level decides.
      // §28.4 rule 2: specificity ranks beat effect — wildcards NEVER
      // override explicit field rules, regardless of which is allow vs
      // deny. We therefore walk explicit rules (levels 1-2) first; only
      // when no explicit rule matches the principal do we fall through
      // to wildcards (levels 3-4).

      // ── Level 1: explicit-field deny ─────────────────────────────────
      // Any matching deny rule on the explicit field forces the field
      // to canRead=false, canWrite=false, maskingStrategy='FULL'
      // regardless of co-matching allows (§28.4 rule 1).
      for (const rule of explicitFieldRules) {
        if (rule.effect !== 'deny') continue;
        if (!this.checkPropertyPrincipalMatch(rule, userContext)) continue;
        return {
          ...field,
          canRead: false,
          canWrite: false,
          maskingStrategy: 'FULL' as MaskingStrategy,
        };
      }

      // ── Level 2: explicit-field allow (UNION across matching) ───────
      // Canon §28.2 level 2 + canon §28.5: combine ALL matching allow
      // rules at this level.
      //   canRead = UNION across matching allows (any-grants-wins)
      //   canWrite = UNION across matching allows
      //   maskingStrategy = MOST-restrictive value across matching
      //                     allows (NONE < PARTIAL < FULL — user sees
      //                     the LEAST data, enforcing HIPAA's "minimum
      //                     necessary" principle at the field level).
      const explicitAllowDecision = this.combineAllowRules(
        explicitFieldRules,
        userContext,
      );
      if (explicitAllowDecision) {
        return {
          ...field,
          ...explicitAllowDecision,
        };
      }

      // ── Level 3: wildcard deny ──────────────────────────────────────
      // A matching wildcard deny denies the field (same effect as level
      // 1, just at the wildcard specificity rank).
      for (const rule of wildcardRules) {
        if (rule.effect !== 'deny') continue;
        if (!this.checkPropertyPrincipalMatch(rule, userContext)) continue;
        return {
          ...field,
          canRead: false,
          canWrite: false,
          maskingStrategy: 'FULL' as MaskingStrategy,
        };
      }

      // ── Level 4: wildcard allow (UNION across matching) ─────────────
      // Same combination semantics as level 2, scoped to wildcard rules.
      const wildcardAllowDecision = this.combineAllowRules(
        wildcardRules,
        userContext,
      );
      if (wildcardAllowDecision) {
        return {
          ...field,
          ...wildcardAllowDecision,
        };
      }

      // ── Level 7: default-deny fallback (canon §28.2 + §28.4) ────────
      // F005 / canon §28.2 level 7: when no explicit (levels 1-2) or
      // wildcard (levels 3-4) rule matched, the collection's
      // `secureFieldsByDefault` flag decides. `true` → deny per canon
      // §28.4 ("missing policy = deny"). `false` → preserve the
      // pre-§28 default-allow contract.
      //
      // Levels 5-6 (collection-rule-as-field-fallback) are intentionally
      // not implemented here — collection-level rules gate
      // `canAccessCollection` but do not automatically grant field
      // access. That separation is preserved.
      if (defaultDeny) {
        return {
          ...field,
          canRead: false,
          canWrite: false,
          maskingStrategy: 'FULL' as MaskingStrategy,
        };
      }

      // secureFieldsByDefault === false: legacy default-allow path
      // preserved so existing collections behave as they did pre-§28.
      return {
        ...field,
        canRead: true,
        canWrite: !field.isSystem,
        maskingStrategy: 'NONE' as MaskingStrategy,
      };
    });
  }

  /**
   * Combine matching allow rules per canon §28.2 + §28.5. Returns a
   * decision object when at least one rule matched the user, or `null`
   * when no allow rule in the set matched (so the caller can fall
   * through to the next precedence level).
   *
   * Combination rules:
   *   - canRead/canWrite: UNION across matching allows (any-grants-wins)
   *   - maskingStrategy: MOST-restrictive value across matching allows
   *     (NONE < PARTIAL < FULL per §28.5)
   *
   * Deny rules in the input are skipped — callers handle deny rules
   * at the same level before invoking this helper.
   */
  private combineAllowRules(
    rules: PropertyAccessRuleData[],
    user: UserAccessContext,
  ): { canRead: boolean; canWrite: boolean; maskingStrategy: MaskingStrategy } | null {
    let canRead = false;
    let canWrite = false;
    let maskingStrategy: MaskingStrategy = 'NONE';
    let matched = false;

    for (const rule of rules) {
      if (rule.effect === 'deny') continue;
      if (!this.checkPropertyPrincipalMatch(rule, user)) continue;

      if (!matched) {
        // First matching rule: replace the defaults entirely. Without
        // this reset, a single restrictive rule would be masked by
        // permissive defaults and never tighten access.
        canRead = rule.canRead;
        canWrite = rule.canWrite;
        maskingStrategy = rule.maskingStrategy ?? 'NONE';
        matched = true;
        continue;
      }

      canRead = canRead || rule.canRead;
      canWrite = canWrite || rule.canWrite;
      maskingStrategy = this.mostRestrictiveMask(
        maskingStrategy,
        rule.maskingStrategy ?? 'NONE',
      );
    }

    return matched ? { canRead, canWrite, maskingStrategy } : null;
  }

  /**
   * Filter fields to only those readable by the user, scoped to a collection.
   */
  async filterReadableFieldsForCollection(
    ctx: RequestContext,
    collectionId: string,
    fields: PropertyMeta[],
  ): Promise<AuthorizedPropertyMeta[]> {
    const authorized = await this.getAuthorizedFieldsForCollection(ctx, collectionId, fields);
    return authorized.filter((f) => f.canRead);
  }

  /**
   * Filter fields to only those writable by the user, scoped to a collection.
   */
  async filterWritableFieldsForCollection(
    ctx: RequestContext,
    collectionId: string,
    fields: PropertyMeta[],
  ): Promise<AuthorizedPropertyMeta[]> {
    const authorized = await this.getAuthorizedFieldsForCollection(ctx, collectionId, fields);
    return authorized.filter((f) => f.canWrite);
  }

  /**
   * Apply field masking to a record based on authorization.
   * Note: Masking is driven by the `fields` array (which already encodes
   * canRead and maskingStrategy), so this method does not need a collection
   * identifier. Provided alongside the *Collection variants for symmetry.
   */
  async maskCollectionRecord(
    ctx: RequestContext,
    record: Record<string, unknown>,
    fields: AuthorizedPropertyMeta[],
  ): Promise<Record<string, unknown>> {
    // Admin bypass - no masking
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, 'record', 'mask', {
        recordId: record['id'] != null ? String(record['id']) : null,
      });
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
   * Check if user can perform operation on a specific record in a collection.
   * Evaluates row-level conditions against the record data.
   *
   * F006 / canon §28.3 two-pass evaluation per record:
   * 1. Any matching deny rule (principal + operation + conditions met by
   *    this record) → DENY (§28.4 rule 1).
   * 2. Otherwise, any matching allow rule grants access (§28.4 rule 5).
   */
  async canAccessCollectionRecord(
    ctx: RequestContext,
    collectionId: string,
    operation: CollectionOperation,
    record: Record<string, unknown>,
  ): Promise<boolean> {
    // Admin bypass
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, collectionId, operation, {
        recordId: record['id'] != null ? String(record['id']) : null,
      });
      return true;
    }

    if (!this.collectionAclRepo) {
      return false;
    }

    const userContext = this.buildUserContext(ctx);
    const rules = await this.getCollectionRules(collectionId, userContext);

    // Pass 1 (canon §28.4 rule 1): a matching deny rule whose conditions
    // are met by this record wins outright. Unconditional denies match
    // every record.
    for (const rule of rules) {
      if (rule.effect !== 'deny') continue;
      if (!this.checkPrincipalMatch(rule, userContext)) continue;
      if (!this.checkOperationPermission(rule, operation)) continue;

      if (rule.conditions) {
        const conditionMet = this.evaluateCondition(rule.conditions, record, userContext);
        if (!conditionMet) continue;
      }
      return false;
    }

    // Pass 2: union of allow rules. Any matching allow on the record
    // grants access.
    for (const rule of rules) {
      if (rule.effect === 'deny') continue;
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
  // Public API — Table-name variants (deprecated)
  //
  // These wrappers exist to keep callers that only have a `tableName` working
  // during the migration. They resolve `tableName -> collectionId` via the
  // CollectionDefinition repo and throw `NotFoundException` on failure.
  // The previous behaviour treated the parameter as a collectionId directly,
  // which silently produced empty rule sets when the value was a table name.
  // ============================================================================

  /**
   * @deprecated Use `canAccessCollection(ctx, collectionId, operation)` instead.
   * `tableName` is mutable; `collectionId` is stable. Resolution failures throw.
   */
  async canAccessTable(
    ctx: RequestContext,
    tableName: string,
    operation: CollectionOperation,
  ): Promise<boolean> {
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, tableName, operation);
      return true;
    }
    const collectionId = await this.resolveTableNameToCollectionId(tableName);
    return this.canAccessCollection(ctx, collectionId, operation);
  }

  /**
   * @deprecated Use `ensureCollectionAccess(ctx, collectionId, operation)` instead.
   */
  async ensureTableAccess(
    ctx: RequestContext,
    tableName: string,
    operation: CollectionOperation,
  ): Promise<void> {
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, tableName, operation);
      return;
    }
    const collectionId = await this.resolveTableNameToCollectionId(tableName);
    await this.ensureCollectionAccess(ctx, collectionId, operation);
  }

  /**
   * @deprecated Use `getSafeRowLevelPredicatesForCollection(ctx, collectionId, operation)` instead.
   */
  async getSafeRowLevelPredicates(
    ctx: RequestContext,
    tableName: string,
    operation: CollectionOperation,
  ): Promise<SafePredicate[]> {
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, tableName, `${operation}:row-filter`);
      return [];
    }
    const collectionId = await this.resolveTableNameToCollectionId(tableName);
    return this.getSafeRowLevelPredicatesForCollection(ctx, collectionId, operation);
  }

  /**
   * @deprecated Use `buildCollectionRowLevelClause(ctx, collectionId, operation, tableAlias)` instead.
   */
  async buildRowLevelClause(
    ctx: RequestContext,
    tableName: string,
    operation: CollectionOperation,
    tableAlias = 't',
  ): Promise<RowLevelClause> {
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, tableName, `${operation}:row-clause`);
      return { clauses: [], params: {} };
    }
    const collectionId = await this.resolveTableNameToCollectionId(tableName);
    return this.buildCollectionRowLevelClause(ctx, collectionId, operation, tableAlias);
  }

  /**
   * @deprecated Use `getAuthorizedFieldsForCollection(ctx, collectionId, fields)` instead.
   */
  async getAuthorizedFields(
    ctx: RequestContext,
    tableName: string,
    fields: PropertyMeta[],
  ): Promise<AuthorizedPropertyMeta[]> {
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, tableName, 'fields:read');
      return fields.map((field) => ({
        ...field,
        canRead: true,
        canWrite: true,
        maskingStrategy: 'NONE' as MaskingStrategy,
      }));
    }
    const collectionId = await this.resolveTableNameToCollectionId(tableName);
    return this.getAuthorizedFieldsForCollection(ctx, collectionId, fields);
  }

  /**
   * @deprecated Use `filterReadableFieldsForCollection(ctx, collectionId, fields)` instead.
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
   * @deprecated Use `filterWritableFieldsForCollection(ctx, collectionId, fields)` instead.
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
   * @deprecated Use `maskCollectionRecord(ctx, record, fields)` instead.
   * The `tableName` argument is unused — masking is driven entirely by `fields`.
   */
  async maskRecord(
    ctx: RequestContext,
    _tableName: string,
    record: Record<string, unknown>,
    fields: AuthorizedPropertyMeta[],
  ): Promise<Record<string, unknown>> {
    return this.maskCollectionRecord(ctx, record, fields);
  }

  /**
   * @deprecated Use `canAccessCollectionRecord(ctx, collectionId, operation, record)` instead.
   */
  async canAccessRecord(
    ctx: RequestContext,
    tableName: string,
    operation: CollectionOperation,
    record: Record<string, unknown>,
  ): Promise<boolean> {
    if (ctx.isAdmin) {
      this.auditAdminBypass(ctx, tableName, operation, {
        recordId: record['id'] != null ? String(record['id']) : null,
      });
      return true;
    }
    const collectionId = await this.resolveTableNameToCollectionId(tableName);
    return this.canAccessCollectionRecord(ctx, collectionId, operation, record);
  }

  // ============================================================================
  // Public API — Cache invalidation (F025; AccessRuleCacheInvalidationPort)
  //
  // These methods are called by the TypeORM `AccessRuleCacheInvalidationSubscriber`
  // in `libs/instance-db` whenever a CollectionAccessRule or PropertyAccessRule
  // is inserted, updated, or removed. The subscriber publishes ONLY after the
  // surrounding transaction commits (see F043 pattern), so by the time we get
  // here the rule change has landed in the source of truth and the cache must
  // be cleared promptly.
  //
  // Both methods are best-effort: cache failures are caught + logged. They
  // MUST NEVER throw — the business write that triggered them has already
  // committed; surfacing an error would just orphan a stale cache entry
  // until TTL elapses without doing anything to fix it.
  // ============================================================================

  /**
   * Invalidate every cached entry derived from collection-level rules for
   * `event.collectionId`. Clears:
   *   - the unfiltered key `auth:collection-rules:{cid}`
   *   - every per-user variant `auth:collection-rules:{cid}:*`
   *     (F023 pushdown stores one entry per principal hash)
   *
   * Option B (per-collection invalidation): when ANY rule on the
   * collection changes we drop ALL cached entries for that collection
   * regardless of which principal would have matched. Going finer-grained
   * (only the affected principal's entry) is unsafe because a single
   * rule's principal columns can become reachable by additional users
   * (e.g. a role membership changing in another transaction) between the
   * rule write and the next read.
   */
  async invalidateCollectionRules(event: CollectionRuleChangeEvent): Promise<void> {
    if (!this.cache) {
      // No cache wired (e.g. unit-test context) — nothing to invalidate.
      return;
    }
    try {
      await this.invalidateCollectionCacheKeys(event.collectionId);
    } catch (err) {
      this.logger.error(
        `Cache invalidation failed for collection ${event.collectionId} ` +
          `(operation=${event.operation}): ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Invalidate the cached property-rule entry for `event.collectionId`.
   * Property-rule cache keys are not per-user (no SQL pushdown today),
   * so a single `del()` on `auth:property-rules:{cid}` is sufficient.
   */
  async invalidatePropertyRules(event: PropertyRuleChangeEvent): Promise<void> {
    if (!this.cache) {
      return;
    }
    if (!event.collectionId) {
      // Defensive: the subscriber MUST resolve propertyId -> collectionId
      // before emitting; without a collectionId we cannot build a cache
      // key and there is nothing to do. Log so an upstream regression is
      // visible rather than silently leaving stale data.
      this.logger.warn(
        `invalidatePropertyRules called without collectionId (propertyId=${event.propertyId ?? 'unknown'}, operation=${event.operation}); skipping`,
      );
      return;
    }
    try {
      await this.cache.del(`auth:property-rules:${event.collectionId}`);
    } catch (err) {
      this.logger.error(
        `Cache invalidation failed for property rules on collection ${event.collectionId} ` +
          `(operation=${event.operation}, propertyId=${event.propertyId ?? 'unknown'}): ` +
          `${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Drop the unfiltered collection-rule cache entry plus every per-user
   * F023 variant. The cache-manager v5/v7 API surface is small (Cache.del
   * is the only guaranteed surface); enumerating keys requires reaching
   * through `stores[].iterator()` (Keyv-backed) or a legacy `store.keys()`
   * shape. We try the available enumeration path defensively and degrade
   * to deleting only the exact key when the store does not expose one —
   * the per-user variants will fall off via their 5-minute TTL on the
   * memory-store fallback path.
   */
  private async invalidateCollectionCacheKeys(collectionId: string): Promise<void> {
    if (!this.cache) return;
    const exactKey = `auth:collection-rules:${collectionId}`;
    const prefix = `${exactKey}:`;

    // Always drop the exact key first — covers callers that never used the
    // SQL pushdown path and is the path the memory-store fallback relies on.
    await this.cache.del(exactKey);

    // Best-effort enumeration of per-user variants. Two shapes are
    // checked: legacy `cache.store.keys()` (cache-manager v4 and the
    // canonical pattern in the F025 brief) and v5/v7 `cache.stores[i]`
    // Keyv-backed iterators. Either returning, neither returning, or one
    // throwing all degrade gracefully — exact-key delete above is the
    // load-bearing guarantee.
    const keys = await this.tryEnumerateKeys();
    if (keys.length === 0) {
      // Memory store has no enumeration; per-user variants will expire via TTL.
      return;
    }

    const matching = keys.filter((k) => k.startsWith(prefix));
    for (const key of matching) {
      try {
        await this.cache.del(key);
      } catch (err) {
        // Per-key delete failure is logged but does not abort the loop —
        // the goal is to clear as many stale entries as we can.
        this.logger.warn(
          `Failed to del per-user cache key ${key}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Defensive key-enumeration probe. Tries the legacy `cache.store.keys()`
   * surface first (cache-manager v4, Redis store via `keys *`) and falls
   * back to the v5/v7 `cache.stores[].iterator()` Keyv pattern. Returns
   * `[]` when neither is exposed — the caller must treat that as "store
   * does not enumerate" and rely on TTL.
   */
  private async tryEnumerateKeys(): Promise<string[]> {
    if (!this.cache) return [];
    const cacheAny = this.cache as unknown as {
      store?: { keys?: (pattern?: string) => Promise<string[]> | string[] };
      stores?: Array<{
        iterator?: () => AsyncIterator<[string, unknown]> | AsyncIterable<[string, unknown]>;
      }>;
    };

    // Legacy `store.keys()` (cache-manager v4 / redis-store / the shape
    // assumed by the F025 brief).
    if (cacheAny.store?.keys && typeof cacheAny.store.keys === 'function') {
      try {
        const result = await cacheAny.store.keys();
        return Array.isArray(result) ? result : [];
      } catch (err) {
        this.logger.warn(
          `cache.store.keys() failed: ${(err as Error).message}`,
        );
        return [];
      }
    }

    // v5/v7 Keyv-backed stores: each Keyv exposes an async iterator over
    // [key, value] tuples (optional in the type but present on most
    // backends). We iterate the first store and collect keys.
    if (Array.isArray(cacheAny.stores) && cacheAny.stores.length > 0) {
      const store = cacheAny.stores[0];
      if (typeof store?.iterator === 'function') {
        try {
          const out: string[] = [];
          const it = store.iterator();
          const iterator: AsyncIterator<[string, unknown]> =
            typeof (it as AsyncIterable<[string, unknown]>)[Symbol.asyncIterator] === 'function'
              ? (it as AsyncIterable<[string, unknown]>)[Symbol.asyncIterator]()
              : (it as AsyncIterator<[string, unknown]>);
          // Bounded enumeration: stop at a hard ceiling so a misconfigured
          // shared cache cannot trigger an unbounded scan from a single
          // rule write.
          const MAX_KEYS = 10000;
          for (let i = 0; i < MAX_KEYS; i++) {
            const step = await iterator.next();
            if (step.done) break;
            const [k] = step.value;
            if (typeof k === 'string') {
              out.push(k);
            }
          }
          return out;
        } catch (err) {
          this.logger.warn(
            `cache.stores[0].iterator() failed: ${(err as Error).message}`,
          );
          return [];
        }
      }
    }

    return [];
  }

  /**
   * Resolve a (mutable) `tableName` to its (stable) `collectionId` UUID via
   * the `CollectionDefinition` repository. Throws `NotFoundException` when no
   * matching collection exists — never returns null/undefined and never
   * silently degrades to "no rules" behaviour.
   */
  private async resolveTableNameToCollectionId(tableName: string): Promise<string> {
    if (!tableName) {
      throw new NotFoundException('Cannot resolve authorization rules: tableName is empty');
    }

    if (!this.collectionDefinitionRepo) {
      throw new NotFoundException(
        `Cannot resolve tableName "${tableName}" to collectionId: ` +
          'no CollectionDefinition repository is configured for AuthorizationService',
      );
    }

    const definition = await this.collectionDefinitionRepo.findOne({ where: { tableName } });
    if (!definition || !definition.id) {
      throw new NotFoundException(
        `No collection found for tableName "${tableName}". ` +
          'tableName is mutable; use the stable collectionId via the *Collection methods.',
      );
    }

    return definition.id;
  }

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
    user?: UserAccessContext,
  ): Promise<CollectionAccessRuleData[]> {
    if (!this.collectionAclRepo) {
      return [];
    }

    // F023: when the repo can filter by principal in SQL AND we have a user
    // context, use the filtered path. Cache key includes a principal hash so
    // per-user results don't poison entries across users. The unfiltered
    // path (fallback) keeps the original per-collection cache key for
    // backward-compat with test stubs that only implement find().
    const useSqlFilter = !!(user && this.collectionAclRepo.findByCollectionAndUser);
    const cacheKey = useSqlFilter
      ? `auth:collection-rules:${collectionId}:${this.principalCacheKey(user!)}`
      // Canon §5: one instance per customer — no tenant scoping needed.
      : `auth:collection-rules:${collectionId}`;

    if (this.cache) {
      const cached = await this.cache.get<CollectionAccessRuleData[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const rules = useSqlFilter
      ? await this.collectionAclRepo.findByCollectionAndUser!(
          collectionId,
          user!.userId,
          user!.roleIds,
          [...user!.groupIds, ...user!.teamIds],
        )
      : await this.collectionAclRepo.find({
          where: { collectionId, isActive: true },
          order: { priority: 'ASC' },
        });

    if (this.cache) {
      await this.cache.set(cacheKey, rules, this.CACHE_TTL);
    }

    return rules;
  }

  /**
   * Stable hash of a user's principal identity for use as a cache key
   * component (F023). Sorts each id list before joining so two contexts
   * with the same principals but different array order hash identically.
   */
  private principalCacheKey(user: UserAccessContext): string {
    const roles = [...user.roleIds].sort().join(',');
    const groups = [...user.groupIds].sort().join(',');
    const teams = [...user.teamIds].sort().join(',');
    return `${user.userId}|${roles}|${groups}|${teams}`;
  }

  private async getPropertyRules(
    collectionId: string,
  ): Promise<PropertyAccessRuleData[]> {
    if (!this.propertyAclRepo) {
      return [];
    }

    const cacheKey = `auth:property-rules:${collectionId}`;

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
   * Look up the per-collection authorization flags (canon §28.2 level 7,
   * F005). Cached for CACHE_TTL — collection-definition writes are rare
   * admin actions and TTL expiry (5 min) is acceptable per the F005
   * brief; the F025 rule-cache invalidation port intentionally does NOT
   * cover collection_definition writes.
   *
   * Returns `null` when:
   *   - the repo is not wired (test stub context), OR
   *   - no row exists for `collectionId` (deleted / misconfigured).
   * Callers MUST treat null as "no flag opt-in" (legacy default-allow)
   * — failing closed here would break every collection whose definition
   * row hasn't yet been seeded, which is not the F005 contract.
   */
  private async lookupCollectionFlag(
    collectionId: string,
  ): Promise<{ secureFieldsByDefault: boolean } | null> {
    if (!this.collectionDefinitionRepo) {
      return null;
    }

    const cacheKey = `auth:collection-flag:${collectionId}`;
    if (this.cache) {
      const cached = await this.cache.get<{ secureFieldsByDefault: boolean }>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const definition = await this.collectionDefinitionRepo.findOne({
      where: { id: collectionId },
    });
    if (!definition) {
      return null;
    }

    const flag = {
      secureFieldsByDefault: definition.secureFieldsByDefault === true,
    };

    if (this.cache) {
      await this.cache.set(cacheKey, flag, this.CACHE_TTL);
    }

    return flag;
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

  /**
   * Masking severity ordering for canon §28.5 multi-rule combination.
   * Higher number = more restrictive (more of the value hidden).
   *   NONE: 0 — full value shown
   *   PARTIAL: 1 — partial mask (e.g. last 4 of SSN)
   *   FULL: 2 — value entirely redacted
   *
   * Canon §28.5: the MOST-restrictive value across a user's matching
   * allow rules wins. Roles compose conjunctively — a user with two roles
   * (one masks SSN partially, one does not mask at all) sees the partial
   * mask, not the unmasked value. This enforces HIPAA's "minimum
   * necessary" principle at the field level.
   *
   * This inverts the pre-§28 F024 helper which picked least-restrictive.
   * The flip is deliberate and the canon section documents the rationale.
   */
  private static readonly MASK_SEVERITY: Record<MaskingStrategy, number> = {
    NONE: 0,
    PARTIAL: 1,
    FULL: 2,
  };

  private mostRestrictiveMask(
    a: MaskingStrategy,
    b: MaskingStrategy,
  ): MaskingStrategy {
    return AuthorizationService.MASK_SEVERITY[a] >= AuthorizationService.MASK_SEVERITY[b]
      ? a
      : b;
  }

  /**
   * F021: emit an audit row for an admin bypass site. Fire-and-forget —
   * never throws. The port's implementation is expected to be best-effort
   * (matches the AccessAuditService.logAccess posture); a failing write
   * cannot regress the bypass return value (canon §10 audit must not
   * compromise runtime correctness).
   *
   * Caller is responsible for only invoking this on admin paths — the
   * helper does not re-check ctx.isAdmin.
   */
  private auditAdminBypass(
    ctx: RequestContext,
    resource: string,
    action: string,
    context?: Record<string, unknown>,
  ): void {
    if (!this.accessAudit) return;
    try {
      this.accessAudit.logAdminBypass({
        userId: ctx.userId,
        resource,
        action,
        context,
      });
    } catch (err) {
      this.logger.warn(
        `Admin bypass audit emit failed for user=${ctx.userId} resource=${resource} action=${action}: ${(err as Error).message}`,
      );
    }
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
    pred: LeafPredicate,
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
    const counter = { value: 0 };

    for (const pred of predicates) {
      this.renderPredicateInternal(pred, ctx, tableAlias, clauses, params, counter);
    }

    return { clauses, params };
  }

  private renderPredicateInternal(
    pred: SafePredicate,
    ctx: RequestContext,
    tableAlias: string,
    clauses: string[],
    params: Record<string, unknown>,
    counter: { value: number },
  ): void {
    if (pred.kind === 'or') {
      const branchClauses: string[] = [];
      for (const branch of pred.branches) {
        const innerClauses: string[] = [];
        for (const inner of branch) {
          this.renderPredicateInternal(inner, ctx, tableAlias, innerClauses, params, counter);
        }
        if (innerClauses.length > 0) {
          branchClauses.push(innerClauses.length === 1 ? innerClauses[0] : `(${innerClauses.join(' AND ')})`);
        }
      }
      if (branchClauses.length > 0) {
        clauses.push(branchClauses.length === 1 ? branchClauses[0] : `(${branchClauses.join(' OR ')})`);
      }
      return;
    }

    if (pred.kind === 'not') {
      // F006: render the inner set AND-ed and wrap in NOT(...). Refuse
      // to emit `NOT ()` if every inner predicate dropped — that would
      // either be invalid SQL or, with some renderers, parse as TRUE
      // (fail-open). Dropping the whole NOT keeps the allow-set
      // (intersected with nothing) as the visible window, which is the
      // pre-§28 behaviour when no deny rules were present.
      const innerClauses: string[] = [];
      for (const inner of pred.inner) {
        this.renderPredicateInternal(inner, ctx, tableAlias, innerClauses, params, counter);
      }
      if (innerClauses.length === 0) {
        return;
      }
      const innerSql = innerClauses.length === 1 ? innerClauses[0] : `(${innerClauses.join(' AND ')})`;
      clauses.push(`NOT (${innerSql})`);
      return;
    }

    const field = `${tableAlias}."${pred.field}"`;
    const paramName = `rls_p${counter.value++}`;
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
          counter.value--;
          return;
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
          counter.value--;
          return;
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
          counter.value--;
          return;
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
        counter.value--;
        clauses.push(`${field} IS NULL`);
        break;
      case 'is_not_null':
        counter.value--;
        clauses.push(`${field} IS NOT NULL`);
        break;
    }
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
