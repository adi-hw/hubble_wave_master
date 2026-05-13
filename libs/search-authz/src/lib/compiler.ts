/**
 * Search authorization compiler — §28 collection access rules → engine-neutral filter AST.
 *
 * Translates the §28 record-decision precedence matrix into a FilterAst that
 * engine-specific emitters (Typesense filter_by in PR-2, pgvector SQL WHERE in
 * PR-3) can render without any further authorization logic. The compiler never
 * performs engine-specific work; it only understands authorization semantics.
 *
 * Algorithm mirrors §28.3 record-decision precedence:
 *   Level 1 (deny): matching deny rule → collection excluded from the AST.
 *   Level 2 (allow): matching allow rule → collection included, potentially
 *                    narrowed by row-condition.
 *   Level 3 (default): no matching rule → deny_all for that collection; if NO
 *                      collection produced any allow, return deny_all globally.
 *
 * Canon refs: §9 (centralized authz), §28.3 (record-decision precedence),
 * §28.4 (deny wins), Plan Fix 30 / F136.
 */

import type { CollectionAccessRuleData, AccessConditionData } from '@hubblewave/authorization';
import type { FilterAst, PrimitiveValue } from './ast';

export interface SearchAuthzCompilerInput {
  /** The active user's ID — used for ABAC condition resolution. */
  userId: string;
  /** All role IDs the user holds. */
  userRoleIds: string[];
  /** All group IDs the user belongs to. */
  userGroupIds: string[];
  /**
   * All collection-level access rules visible to this caller (all collections,
   * all principals). The compiler filters to the rules that match the user's
   * identity and evaluates §28.3 precedence per collection.
   *
   * PropertyAccessRules are NOT included in PR-1. Field-level pre-filtering is
   * orthogonal to record visibility and continues to be handled post-search by
   * the existing masking pipeline.
   */
  collectionRules: CollectionAccessRuleData[];
}

/**
 * Compile §28 collection access rules into an engine-neutral FilterAst.
 *
 * The returned AST gates RECORD visibility. Field-level policies are applied
 * post-search by the existing masking pipeline and are intentionally out of
 * scope for this compiler.
 */
export function compileSearchAuthz(input: SearchAuthzCompilerInput): FilterAst {
  const { userId, userRoleIds, userGroupIds, collectionRules } = input;

  if (collectionRules.length === 0) {
    return { kind: 'deny_all' };
  }

  // Step 1: retain only active rules that match the user's identity (userId,
  // any of their roles, any of their groups, or public rules with no principal).
  const matchingRules = collectionRules.filter(
    (r) => r.isActive && principalMatches(r, userId, userRoleIds, userGroupIds),
  );

  if (matchingRules.length === 0) {
    return { kind: 'deny_all' };
  }

  // Step 2: group matching rules by collectionId.
  const byCollection = groupByCollection(matchingRules);

  // Step 3: for each collection, apply §28.3 precedence to produce a per-collection
  // FilterAst (or null when the collection is denied at level 1).
  const perCollectionAsts: FilterAst[] = [];

  for (const [collectionId, rules] of byCollection) {
    const ast = compileCollectionRules(collectionId, rules, userId);
    if (ast !== null) {
      perCollectionAsts.push(ast);
    }
  }

  if (perCollectionAsts.length === 0) {
    return { kind: 'deny_all' };
  }

  // Step 4: a user can see records matching ANY of the per-collection allows
  // (§28.3: positive grants UNION / §28.4 rule 5: UNION across collections).
  if (perCollectionAsts.length === 1) {
    return perCollectionAsts[0];
  }

  return { kind: 'or', clauses: perCollectionAsts };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Whether a rule's principal matches the given user identity.
 *
 * A rule with no principal fields (roleId, groupId, userId all null) is a
 * "public" rule that applies to every user (e.g. admin seed policies that
 * apply globally).
 */
function principalMatches(
  rule: CollectionAccessRuleData,
  userId: string,
  userRoleIds: string[],
  userGroupIds: string[],
): boolean {
  const hasNoPrincipal =
    rule.roleId == null && rule.groupId == null && rule.userId == null;
  if (hasNoPrincipal) return true;

  if (rule.userId != null && rule.userId === userId) return true;
  if (rule.roleId != null && userRoleIds.includes(rule.roleId)) return true;
  if (rule.groupId != null && userGroupIds.includes(rule.groupId)) return true;

  return false;
}

function groupByCollection(
  rules: CollectionAccessRuleData[],
): Map<string, CollectionAccessRuleData[]> {
  const map = new Map<string, CollectionAccessRuleData[]>();
  for (const rule of rules) {
    const bucket = map.get(rule.collectionId);
    if (bucket) {
      bucket.push(rule);
    } else {
      map.set(rule.collectionId, [rule]);
    }
  }
  return map;
}

/**
 * Apply §28.3 record-decision precedence for a single collection.
 *
 * Returns null when the collection is fully denied at level 1 (deny rule
 * without a row-condition covers all records). When a deny rule exists but has
 * a row-condition, the collection is not excluded — the allow range is narrowed
 * by subtraction, which the AST represents as `not` if the condition can be
 * translated, or as a degraded `in_collection` when it cannot.
 *
 * In practice a deny-with-row-condition is unusual; the common case is a deny
 * on a whole collection (no condition) that blocks it entirely, or an allow on
 * a whole collection (no condition) that opens it fully.
 */
function compileCollectionRules(
  collectionId: string,
  rules: CollectionAccessRuleData[],
  userId: string,
): FilterAst | null {
  // §28.3 level 1: unconditional deny (no row-condition) takes the collection
  // entirely out of the visible set regardless of any allow rules.
  const unconditionalDeny = rules.find(
    (r) => r.effect === 'deny' && r.canRead && !hasCondition(r),
  );
  if (unconditionalDeny) {
    return null;
  }

  // §28.3 level 2: collect the allow rules that grant canRead.
  const allowRules = rules.filter((r) => r.effect === 'allow' && r.canRead);

  if (allowRules.length === 0) {
    // No allow rule matched — §28.3 level 3 default deny.
    return null;
  }

  // Build the allow sub-AST. When any allow rule has no row-condition the user
  // gets unrestricted access to the collection — emit in_collection.
  const hasUnconditionalAllow = allowRules.some((r) => !hasCondition(r));
  if (hasUnconditionalAllow) {
    // Check whether there are any deny rules with row-conditions that narrow
    // the unconditional allow. A deny-with-condition means "allow all EXCEPT
    // records matching this condition". We model that as NOT(deny_condition).
    const conditionalDenies = rules.filter(
      (r) => r.effect === 'deny' && r.canRead && hasCondition(r),
    );

    if (conditionalDenies.length === 0) {
      return { kind: 'in_collection', collectionId };
    }

    // Try to translate each deny condition to a NOT clause. If translation
    // fails for any, degrade to the broader in_collection (safer / fail-open
    // at the AST level; post-filter will catch the edge cases at runtime).
    const notClauses: FilterAst[] = [];
    let degraded = false;
    for (const denyRule of conditionalDenies) {
      const conditionAst = compileCondition(denyRule.conditions ?? null, userId);
      if (conditionAst === null) {
        degraded = true;
        break;
      }
      notClauses.push({ kind: 'not', clause: conditionAst });
    }

    if (degraded || notClauses.length === 0) {
      return { kind: 'in_collection', collectionId };
    }

    // Combine: in_collection AND NOT(deny1) AND NOT(deny2) ...
    return {
      kind: 'and',
      clauses: [{ kind: 'in_collection', collectionId }, ...notClauses],
    };
  }

  // Every allow rule has a row-condition: accumulate per-rule ASTs and OR
  // them together (§28.4 rule 5 — positive grants UNION).
  const conditionClauses: FilterAst[] = [];
  let degradedToInCollection = false;

  for (const allowRule of allowRules) {
    const conditionAst = compileCondition(allowRule.conditions ?? null, userId);
    if (conditionAst === null) {
      // Condition could not be translated — degrade the whole collection to
      // in_collection (broader) so the post-filter can handle the row-by-row
      // decision. This is documented in the compiler's public contract.
      degradedToInCollection = true;
      break;
    }
    conditionClauses.push(conditionAst);
  }

  if (degradedToInCollection) {
    return { kind: 'in_collection', collectionId };
  }

  if (conditionClauses.length === 1) {
    return conditionClauses[0];
  }

  return { kind: 'or', clauses: conditionClauses };
}

/**
 * Translate a single AccessConditionData into a FilterAst node.
 *
 * Returns null when the condition cannot be expressed in the AST (e.g.
 * compound AND/OR conditions beyond the simple field-comparison form, or
 * operators outside the supported set). Callers degrade to `in_collection`
 * in that case so post-filter picks up the remainder.
 *
 * Supported condition shapes:
 *   { property, operator: 'equals', value: <literal> }  → eq
 *   { property, operator: 'in', value: [...] }          → in
 *   { property, operator: 'equals', value: '@currentUser' } → attribute_match (userId)
 *   { property, operator: 'equals', value: '@currentUser.*' } → attribute_match
 *
 * ABAC predicates that reference user attributes (e.g. `value: '@currentUser.region'`)
 * compile to `attribute_match` so the emitter can substitute the user's
 * attribute at query time. The AST remains user-agnostic and cacheable.
 */
function compileCondition(
  condition: AccessConditionData | null,
  _userId: string,
): FilterAst | null {
  if (condition == null) return null;

  // Compound AND — translate children and AND them.
  if (condition.and && condition.and.length > 0) {
    const children: FilterAst[] = [];
    for (const child of condition.and) {
      const childAst = compileCondition(child, _userId);
      if (childAst === null) return null;
      children.push(childAst);
    }
    return children.length === 1 ? children[0] : { kind: 'and', clauses: children };
  }

  // Compound OR — translate children and OR them.
  if (condition.or && condition.or.length > 0) {
    const children: FilterAst[] = [];
    for (const child of condition.or) {
      const childAst = compileCondition(child, _userId);
      if (childAst === null) return null;
      children.push(childAst);
    }
    return children.length === 1 ? children[0] : { kind: 'or', clauses: children };
  }

  // Leaf condition — requires both property and operator.
  if (!condition.property || !condition.operator) return null;

  const field = condition.property;
  const value = condition.value;

  // ABAC: value references a user context attribute.
  if (typeof value === 'string' && value.startsWith('@currentUser')) {
    const userAttribute = resolveUserAttributeName(value);
    if (userAttribute === null) return null;
    return { kind: 'attribute_match', field, userAttribute };
  }

  // Literal equality.
  if (condition.operator === 'equals') {
    if (!isPrimitive(value)) return null;
    return { kind: 'eq', field, value: value as PrimitiveValue };
  }

  // Literal IN.
  if (condition.operator === 'in') {
    if (!Array.isArray(value)) return null;
    const primitives = value.filter(isPrimitive) as PrimitiveValue[];
    if (primitives.length !== value.length) return null;
    return { kind: 'in', field, values: primitives };
  }

  // All other operators (gt, lt, contains, starts_with, etc.) are not
  // translatable to the current AST vocabulary — degrade to null so the
  // caller falls back to in_collection.
  return null;
}

/** Map `@currentUser` / `@currentUser.xxx` to the user attribute name. */
function resolveUserAttributeName(value: string): string | null {
  if (value === '@currentUser' || value === '@currentUser.id') return 'userId';
  if (value.startsWith('@currentUser.')) {
    const attr = value.slice('@currentUser.'.length);
    // Accept only safe identifier characters.
    if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(attr)) return attr;
  }
  return null;
}

function isPrimitive(v: unknown): boolean {
  return v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function hasCondition(rule: CollectionAccessRuleData): boolean {
  if (rule.conditions == null) return false;
  const c = rule.conditions;
  return Boolean(
    c.property || (c.and && c.and.length > 0) || (c.or && c.or.length > 0),
  );
}
