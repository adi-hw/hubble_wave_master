/**
 * Typesense `filter_by` emitter — translates a FilterAst produced by
 * compileSearchAuthz() into a Typesense query filter string.
 *
 * The emitter is the only place that knows about Typesense syntax. It
 * contains zero authorization logic — all §28 rule evaluation happens in
 * the compiler. The emitter's job is purely syntactic translation.
 *
 * Typesense filter_by syntax reference:
 *   field:=value               — string/int exact match
 *   field:=[v1,v2,v3]          — in (any of)
 *   field:!=value              — not-equals
 *   expr1 && expr2             — logical AND
 *   expr1 || expr2             — logical OR
 *   !(expr)                    — logical NOT
 *
 * ACL field convention (enforced by the indexer):
 *   _collection_id             — the record's parent collection UUID
 *   _<attribute>               — denormalized ABAC field (e.g. `_region`)
 *
 * Canon refs: §9, §11, §28, Plan Fix 30 PR-2 / F136.
 */

import type { FilterAst, PrimitiveValue } from './ast';

/**
 * Substitution context for ABAC `attribute_match` nodes. The emitter resolves
 * `userAttribute` references against this context at query time.
 *
 * Example: AST node { kind: 'attribute_match', field: 'region', userAttribute: 'region' }
 * with context { region: 'us-east' } → Typesense clause `_region:="us-east"`.
 *
 * When a user attribute is absent from `attrs` the emitter treats the node as
 * `deny_all` for that clause (no-match sentinel) — the caller must populate the
 * context from the active RequestContext before calling the emitter.
 */
export interface AttributeContext {
  [userAttribute: string]: string | number | boolean | null;
}

/**
 * Sentinel value used in `deny_all` clauses. The `_collection_id` field is a
 * required ACL field on every document; this sentinel value is never a valid
 * UUID, so no document will ever match.
 */
const DENY_SENTINEL = '__no_access__';

/**
 * Emit a Typesense `filter_by` clause from a FilterAst.
 *
 * Returns an empty string for `allow_all` (Typesense interprets no
 * `filter_by` as an unrestricted search). Returns a guaranteed-no-match
 * sentinel clause for `deny_all`. All other nodes produce their corresponding
 * Typesense syntax.
 *
 * The caller is responsible for constructing `attrs` from the active
 * `UserRequestContext` or `ServiceRequestContext` (canon §29 discriminated
 * union) before calling this function.
 */
export function emitTypesenseFilterBy(
  ast: FilterAst,
  attrs: AttributeContext,
): string {
  return emitNode(ast, attrs);
}

// ---------------------------------------------------------------------------
// Internal emitters — one per AST node kind
// ---------------------------------------------------------------------------

function emitNode(node: FilterAst, attrs: AttributeContext): string {
  switch (node.kind) {
    case 'allow_all':
      return '';

    case 'deny_all':
      return emitDenySentinel();

    case 'in_collection':
      return `_collection_id:=${escapeValue(node.collectionId)}`;

    case 'and':
      return emitAnd(node.clauses, attrs);

    case 'or':
      return emitOr(node.clauses, attrs);

    case 'not':
      return emitNot(node.clause, attrs);

    case 'eq':
      return emitEq(node.field, node.value);

    case 'in':
      return emitIn(node.field, node.values);

    case 'attribute_match':
      return emitAttributeMatch(node.field, node.userAttribute, attrs);
  }
}

function emitDenySentinel(): string {
  return `_collection_id:=${escapeValue(DENY_SENTINEL)}`;
}

function emitAnd(clauses: FilterAst[], attrs: AttributeContext): string {
  if (clauses.length === 0) {
    // Empty AND: no constraints → allow_all semantics.
    return '';
  }

  const parts: string[] = [];
  for (const clause of clauses) {
    const emitted = emitNode(clause, attrs);
    if (emitted === '') {
      // An allow_all child collapses: this clause contributes no constraint.
      continue;
    }
    // A deny_all child short-circuits the AND: the whole AND denies.
    if (emitted === emitDenySentinel()) {
      return emitDenySentinel();
    }
    parts.push(emitted);
  }

  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return parts.map(parenthesise).join(' && ');
}

function emitOr(clauses: FilterAst[], attrs: AttributeContext): string {
  if (clauses.length === 0) {
    // Empty OR: no permitted clauses → deny_all semantics.
    return emitDenySentinel();
  }

  const parts: string[] = [];
  for (const clause of clauses) {
    const emitted = emitNode(clause, attrs);
    if (emitted === '') {
      // An allow_all child short-circuits the OR: the whole OR allows all.
      return '';
    }
    // Skip deny_all children (they contribute nothing to a union).
    if (emitted === emitDenySentinel()) {
      continue;
    }
    parts.push(emitted);
  }

  if (parts.length === 0) {
    // All children were deny_all → the union is still deny_all.
    return emitDenySentinel();
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return parts.map(parenthesise).join(' || ');
}

function emitNot(inner: FilterAst, attrs: AttributeContext): string {
  const emitted = emitNode(inner, attrs);
  if (emitted === '') {
    // NOT(allow_all) → deny_all.
    return emitDenySentinel();
  }
  if (emitted === emitDenySentinel()) {
    // NOT(deny_all) → allow_all (no filter).
    return '';
  }
  return `!(${emitted})`;
}

function emitEq(field: string, value: PrimitiveValue): string {
  return `${field}:=${escapeValue(value)}`;
}

function emitIn(field: string, values: PrimitiveValue[]): string {
  if (values.length === 0) {
    // Empty IN matches nothing → deny_all for this clause.
    return emitDenySentinel();
  }
  const formatted = values.map(escapeValue).join(',');
  return `${field}:=[${formatted}]`;
}

/**
 * Emit an ABAC predicate by substituting the user attribute from `attrs`.
 *
 * The record field in Typesense is stored with an underscore prefix (`_<field>`)
 * to namespace it as an ACL-projection field (prevents collisions with user-
 * visible content fields). The emitter applies this prefix here.
 *
 * Missing attribute → deny_all for this clause. The caller is responsible for
 * ensuring all ABAC attributes are present in the context before calling the
 * emitter. A null attribute value is also treated as deny_all (a user with
 * an unset ABAC attribute cannot match any record narrowed by that attribute).
 */
function emitAttributeMatch(
  field: string,
  userAttribute: string,
  attrs: AttributeContext,
): string {
  const value = attrs[userAttribute];
  if (value === undefined || value === null) {
    return emitDenySentinel();
  }
  return `_${field}:=${escapeValue(value)}`;
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

function escapeValue(value: PrimitiveValue | string | number | boolean): string {
  if (value === null) {
    // Typesense does not support null literals in filter_by — treat as deny.
    // Callers should not emit null-literal EQ clauses; this is a safety guard.
    return escapeValue(DENY_SENTINEL);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  // String: wrap in double-quotes and escape internal quotes.
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Wrap a clause in parentheses only when it contains a space (i.e. it is a
 * compound clause). Simple field:=value clauses never need wrapping.
 */
function parenthesise(clause: string): string {
  if (clause.includes(' ')) {
    return `(${clause})`;
  }
  return clause;
}
