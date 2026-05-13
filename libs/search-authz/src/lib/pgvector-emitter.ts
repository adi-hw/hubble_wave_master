/**
 * pgvector SQL WHERE-clause emitter — translates a FilterAst produced by
 * compileSearchAuthz() into a parameterized SQL WHERE fragment suitable for
 * filtering a pgvector ANN (cosine similarity) search.
 *
 * The emitter is the only place that knows about pgvector / PostgreSQL SQL
 * syntax. It contains zero authorization logic — all §28 rule evaluation
 * happens in the compiler. The emitter's job is purely syntactic translation.
 *
 * SQL field naming convention (enforced by the indexer / migration):
 *   _collection_id             — the record's parent collection UUID (uuid column)
 *   _attribute_<name>          — denormalized ABAC field (e.g. `_attribute_region`)
 *
 * SECURITY: every user-attribute value MUST go through parameterized bind
 * parameters ($1, $2, …). Never interpolate `attrs[key]` directly into the
 * SQL string. SQL injection here is a privilege-escalation vector because the
 * emitter is part of the §28 authorization path.
 *
 * Canon refs: §9 (centralized authz), §11 (AVA), §28 (resolution model),
 * Plan Fix 30 PR-3 / F136.
 */

import type { FilterAst, PrimitiveValue } from './ast';
import type { AttributeContext } from './typesense-emitter';

/**
 * Result from `emitPgvectorWhere`.
 *
 * - `clause`         — SQL WHERE fragment with $N placeholders.
 *                      `'TRUE'` for allow_all (no constraint).
 *                      `'FALSE'` for deny_all (no rows match).
 *                      All other cases produce a parenthesized or field-equality expression.
 * - `params`         — Bind-parameter values in $startParamIndex, $startParamIndex+1, …
 *                      order. Empty array for allow_all and deny_all.
 * - `nextParamIndex` — The next $N index the caller should use for its own additional
 *                      parameters (startParamIndex + params.length).
 */
export interface PgvectorWhereResult {
  clause: string;
  params: unknown[];
  nextParamIndex: number;
}

/**
 * Emit a SQL WHERE-clause fragment from a FilterAst suitable for filtering
 * a pgvector ANN search (cosine similarity).
 *
 * @param ast            — FilterAst produced by `compileSearchAuthz()`.
 * @param attrs          — ABAC attribute context from the active RequestContext.
 * @param startParamIndex — First $N index to use for bind parameters (default 1).
 *
 * The caller is responsible for constructing `attrs` from the active
 * `UserRequestContext` or `ServiceRequestContext` (canon §29 discriminated
 * union) before calling this function.
 *
 * Caller usage pattern:
 * ```ts
 * const { clause, params, nextParamIndex } = emitPgvectorWhere(ast, attrs, 2);
 * const sql = `
 *   SELECT source_type, source_id, content, metadata,
 *          1 - (embedding <=> $1::vector) AS similarity
 *   FROM search_embeddings
 *   WHERE ${clause}
 *     AND 1 - (embedding <=> $1::vector) >= $${nextParamIndex}
 *   ORDER BY embedding <=> $1::vector
 *   LIMIT $${nextParamIndex + 1}
 * `;
 * const values = [embeddingStr, ...params, threshold, limit];
 * ```
 */
export function emitPgvectorWhere(
  ast: FilterAst,
  attrs: AttributeContext,
  startParamIndex = 1,
): PgvectorWhereResult {
  const params: unknown[] = [];
  const clause = emitNode(ast, attrs, params, startParamIndex);
  return {
    clause,
    params,
    nextParamIndex: startParamIndex + params.length,
  };
}

// ---------------------------------------------------------------------------
// Internal emitters — one per AST node kind
// ---------------------------------------------------------------------------

/**
 * Emit a single AST node as a SQL expression, appending any bind values to
 * `params` and using `$N` placeholders starting at `nextParam[0]`.
 *
 * `nextParam` is a one-element array (mutable integer box) so recursive calls
 * can advance the counter without returning it through every level of the call
 * stack. All recursive callers share the same `params` array and `nextParam`
 * box — parameter ordering is determined by DFS traversal order, which is
 * deterministic and matches the emitter's left-to-right structure.
 */
function emitNode(
  node: FilterAst,
  attrs: AttributeContext,
  params: unknown[],
  startParam: number,
): string {
  const counter: [number] = [startParam];
  return emitNodeInner(node, attrs, params, counter);
}

function emitNodeInner(
  node: FilterAst,
  attrs: AttributeContext,
  params: unknown[],
  counter: [number],
): string {
  switch (node.kind) {
    case 'allow_all':
      return 'TRUE';

    case 'deny_all':
      return 'FALSE';

    case 'in_collection':
      return emitInCollection(node.collectionId, params, counter);

    case 'and':
      return emitAnd(node.clauses, attrs, params, counter);

    case 'or':
      return emitOr(node.clauses, attrs, params, counter);

    case 'not':
      return emitNot(node.clause, attrs, params, counter);

    case 'eq':
      return emitEq(node.field, node.value, params, counter);

    case 'in':
      return emitIn(node.field, node.values, params, counter);

    case 'attribute_match':
      return emitAttributeMatch(node.field, node.userAttribute, attrs, params, counter);
  }
}

function allocParam(value: unknown, params: unknown[], counter: [number]): string {
  params.push(value);
  const placeholder = `$${counter[0]}`;
  counter[0] += 1;
  return placeholder;
}

function emitInCollection(
  collectionId: string,
  params: unknown[],
  counter: [number],
): string {
  const placeholder = allocParam(collectionId, params, counter);
  return `_collection_id = ${placeholder}`;
}

function emitAnd(
  clauses: FilterAst[],
  attrs: AttributeContext,
  params: unknown[],
  counter: [number],
): string {
  if (clauses.length === 0) {
    // Empty AND: no constraints → allow_all semantics.
    return 'TRUE';
  }

  const parts: string[] = [];
  for (const clause of clauses) {
    const emitted = emitNodeInner(clause, attrs, params, counter);
    if (emitted === 'TRUE') {
      // allow_all child contributes no constraint — collapse it.
      continue;
    }
    if (emitted === 'FALSE') {
      // deny_all child short-circuits the AND.
      return 'FALSE';
    }
    parts.push(emitted);
  }

  if (parts.length === 0) {
    return 'TRUE';
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return parts.map(parenthesise).join(' AND ');
}

function emitOr(
  clauses: FilterAst[],
  attrs: AttributeContext,
  params: unknown[],
  counter: [number],
): string {
  if (clauses.length === 0) {
    // Empty OR: no permitted clauses → deny_all semantics.
    return 'FALSE';
  }

  const parts: string[] = [];
  for (const clause of clauses) {
    const emitted = emitNodeInner(clause, attrs, params, counter);
    if (emitted === 'TRUE') {
      // allow_all child short-circuits the OR → the whole OR allows all.
      return 'TRUE';
    }
    if (emitted === 'FALSE') {
      // deny_all child contributes nothing to a union — skip it.
      continue;
    }
    parts.push(emitted);
  }

  if (parts.length === 0) {
    // All children were FALSE → deny_all.
    return 'FALSE';
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return parts.map(parenthesise).join(' OR ');
}

function emitNot(
  inner: FilterAst,
  attrs: AttributeContext,
  params: unknown[],
  counter: [number],
): string {
  const emitted = emitNodeInner(inner, attrs, params, counter);
  if (emitted === 'TRUE') {
    // NOT(allow_all) → deny_all.
    return 'FALSE';
  }
  if (emitted === 'FALSE') {
    // NOT(deny_all) → allow_all.
    return 'TRUE';
  }
  return `NOT (${emitted})`;
}

function emitEq(
  field: string,
  value: PrimitiveValue,
  params: unknown[],
  counter: [number],
): string {
  if (value === null) {
    return `${field} IS NULL`;
  }
  const placeholder = allocParam(value, params, counter);
  return `${field} = ${placeholder}`;
}

function emitIn(
  field: string,
  values: PrimitiveValue[],
  params: unknown[],
  counter: [number],
): string {
  if (values.length === 0) {
    // Empty IN matches nothing.
    return 'FALSE';
  }
  const placeholders = values.map((v) => allocParam(v, params, counter));
  return `${field} IN (${placeholders.join(', ')})`;
}

/**
 * Emit an ABAC predicate by substituting the user attribute from `attrs`.
 *
 * The record field in the SQL table is stored with `_attribute_` prefix
 * (`_attribute_<field>`) to namespace it as an ACL-projection field on the
 * `search_embeddings` table (prevents collisions with content fields like
 * `content`, `metadata`). The emitter applies this prefix here.
 *
 * SECURITY: the attribute value is bound via a parameter placeholder — it is
 * never interpolated into the SQL string, even though it comes from the active
 * user context. A malicious `attrs` value (e.g. SQL fragments) is always
 * treated as a literal bind value, not as SQL code.
 *
 * Missing or null attribute → FALSE (deny). The caller is responsible for
 * populating all ABAC attributes from the active RequestContext before calling
 * the emitter. A user with an unset ABAC attribute cannot match any record
 * narrowed by that attribute.
 */
function emitAttributeMatch(
  field: string,
  userAttribute: string,
  attrs: AttributeContext,
  params: unknown[],
  counter: [number],
): string {
  const value = attrs[userAttribute];
  if (value === undefined || value === null) {
    return 'FALSE';
  }
  const columnName = `_attribute_${field}`;
  const placeholder = allocParam(value, params, counter);
  return `${columnName} = ${placeholder}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wrap an expression in parentheses when it contains an AND / OR keyword at
 * the top level (i.e. when it is a compound expression). Simple single-term
 * expressions (field = $N, TRUE, FALSE) never need wrapping.
 */
function parenthesise(expr: string): string {
  if (expr === 'TRUE' || expr === 'FALSE') {
    return expr;
  }
  if (/ AND | OR /.test(expr)) {
    return `(${expr})`;
  }
  return expr;
}
