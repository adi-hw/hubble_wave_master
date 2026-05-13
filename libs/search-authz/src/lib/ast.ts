/**
 * Engine-neutral filter AST for search authorization pre-filtering.
 *
 * The AST is produced by compileSearchAuthz() from §28 collection access rules
 * and consumed by per-engine emitters (Typesense filter_by in PR-2, pgvector
 * SQL WHERE in PR-3). The compiler never emits engine-specific syntax — the
 * AST is the contract between the authorization layer and the search layer.
 *
 * Canon refs: §9 (centralized authz), §11 (AVA), §28 (resolution model),
 * Plan Fix 30 / F136.
 */

export type PrimitiveValue = string | number | boolean | null;

/**
 * Engine-neutral filter AST node (discriminated union).
 *
 * - `allow_all`       — user has unconditional read access to everything.
 *                       Emitters translate to no filter clause.
 * - `deny_all`        — user has no read access. Emitters translate to a
 *                       "match nothing" filter or suppress the query entirely.
 * - `in_collection`   — user has access to records whose collection ID matches.
 *                       Emitters translate to the engine's collection-ID field.
 * - `and`             — all child clauses must match (intersection).
 * - `or`              — any child clause may match (union).
 * - `not`             — negation of the inner clause. The compiler emits `not`
 *                       only when an explicit deny rule applies to all records
 *                       in a collection; this is rare but valid under §28.4.
 * - `eq`              — field equals a literal primitive value.
 * - `in`              — field is in a list of literal primitive values.
 * - `attribute_match` — ABAC predicate deferring substitution to the emitter.
 *                       Used for predicates like `record.region = user.region`
 *                       where `userAttribute` names the user context property.
 *                       The AST is cacheable across users; emitters perform the
 *                       substitution at query time.
 */
export type FilterAst =
  | { kind: 'allow_all' }
  | { kind: 'deny_all' }
  | { kind: 'in_collection'; collectionId: string }
  | { kind: 'and'; clauses: FilterAst[] }
  | { kind: 'or'; clauses: FilterAst[] }
  | { kind: 'not'; clause: FilterAst }
  | { kind: 'eq'; field: string; value: PrimitiveValue }
  | { kind: 'in'; field: string; values: PrimitiveValue[] }
  /**
   * ABAC predicate that references a user attribute.
   *
   * `field`         — the record field to test (e.g. "region", "department_id").
   * `userAttribute` — the user context property to compare against at query time
   *                   (e.g. "region", "departmentId"). The emitter resolves the
   *                   user attribute from the active RequestContext.
   *
   * Deferred resolution keeps the AST user-agnostic and therefore cacheable at
   * the collection+role level, not the per-user level.
   */
  | { kind: 'attribute_match'; field: string; userAttribute: string };
