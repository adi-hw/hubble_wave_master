/**
 * ACL projection types and utilities.
 *
 * Every Typesense document MUST carry a set of ACL fields so the emitter's
 * `filter_by` clauses can resolve them. This module defines the field
 * contract and provides a utility that extracts the required fields from a
 * compiled FilterAst.
 *
 * The indexer calls `extractRequiredAttributes(ast)` for each collection to
 * learn which ABAC fields must be denormalized onto the document. It then
 * includes those fields when building the Typesense document payload.
 *
 * ACL field naming convention on documents:
 *   `_collection_id`  — the record's parent collection UUID (always required).
 *   `_<attribute>`    — denormalized ABAC field value, e.g. `_region`, `_department_id`.
 *                       The underscore prefix namespaces ACL fields away from
 *                       user-visible content fields (title, content, tags, …).
 *
 * Canon refs: §9 (centralized authz), §28 (resolution model), Plan Fix 30 PR-2 / F136.
 */

import type { FilterAst } from './ast';

/**
 * Describes the set of fields the indexer must attach to every document for a
 * given collection so the Typesense `filter_by` clauses produced by the
 * emitter can resolve them.
 *
 * `collectionId` identifies which collection's documents this projection
 * applies to. `attributes` is the list of ABAC field names (without the
 * `_` prefix — the indexer adds the prefix when building the document).
 * `_collection_id` is always required and is not listed in `attributes`.
 */
export interface AclProjection {
  collectionId: string;
  /** ABAC attribute field names (no leading `_`). Always denormalize these. */
  attributes: string[];
}

/**
 * Walk a FilterAst and return the set of ABAC record-field names it
 * references through `attribute_match` nodes.
 *
 * The indexer calls this at document-build time to decide which additional
 * fields to include in the Typesense document payload. The list is
 * deduplicated and sorted for deterministic output.
 *
 * `_collection_id` is excluded from the return value because it is always
 * required and the indexer includes it unconditionally.
 */
export function extractRequiredAttributes(ast: FilterAst): string[] {
  const collected = new Set<string>();
  collectAttributes(ast, collected);
  return [...collected].sort();
}

// ---------------------------------------------------------------------------
// Internal walker — depth-first traversal
// ---------------------------------------------------------------------------

function collectAttributes(node: FilterAst, out: Set<string>): void {
  switch (node.kind) {
    case 'allow_all':
    case 'deny_all':
    case 'in_collection':
    case 'eq':
    case 'in':
      return;

    case 'attribute_match':
      out.add(node.field);
      return;

    case 'not':
      collectAttributes(node.clause, out);
      return;

    case 'and':
    case 'or':
      for (const child of node.clauses) {
        collectAttributes(child, out);
      }
      return;
  }
}
