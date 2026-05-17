import { SetMetadata } from '@nestjs/common';

/**
 * Reflector metadata key for the `@RequireCollectionAccess(...)`
 * decorator. `CollectionAccessGuard` reads this via
 * `Reflector.getAllAndOverride` to drive the §28 evaluator.
 */
export const REQUIRE_COLLECTION_ACCESS_KEY = 'REQUIRE_COLLECTION_ACCESS';

/**
 * The four canonical collection operations per canon §28. Mirrors
 * `CollectionOperation` in `@hubblewave/authorization` — kept as a
 * sibling enum here so the decorator doesn't pull in a dependency on
 * the authorization library at decorator-import time (the guard
 * resolves the real authorization service at request time).
 */
export type CollectionAccessVerb = 'read' | 'create' | 'update' | 'delete';

/**
 * Where on the request the guard finds the collection identifier
 * (param, query, body) or a hardcoded value (`'fixed'`, useful for
 * controllers that hardwire a collection — e.g., the audit log
 * controller writing to `audit_logs`).
 */
export type AccessLocation = 'param' | 'query' | 'body' | 'fixed';

/**
 * Which side of the collection identity dichotomy the resolved value
 * is — a UUID `id` (the row's primary key in
 * `metadata.collection_definitions`) or a `code` (the customer-facing
 * stable identifier used in URLs and metadata DSLs).
 *
 * The two have different lookup paths in the metadata service; the
 * decorator declares which one the request carries so the guard's
 * resolution step does the right query without ambiguous fallback.
 */
export type CollectionKind = 'id' | 'code';

export interface CollectionTarget {
  /** Where on the request to read the collection identifier from. */
  readonly from: AccessLocation;
  /**
   * For `from: 'param' | 'query' | 'body'`: the key under that bucket
   * (e.g. `'collectionId'`, `'collection'`).
   * For `from: 'fixed'`: the literal collection identifier itself
   * (the `name` IS the value).
   */
  readonly name: string;
  /** Whether `name` resolves to a `code` or a UUID `id`. */
  readonly kind: CollectionKind;
}

export interface RecordTarget {
  /** Where on the request to read the record identifier from. */
  readonly from: 'param' | 'query' | 'body';
  /** Key on the request bucket. */
  readonly name: string;
}

export interface RequireCollectionAccessOptions {
  /**
   * The §28 operation being attempted. The verb determines which
   * `CollectionAccessRule.canRead/canCreate/canUpdate/canDelete`
   * column the evaluator consults.
   */
  readonly verb: CollectionAccessVerb;

  /**
   * Where the collection identifier comes from. Every endpoint MUST
   * declare this — there are no defaults. Misapplying the decorator
   * (e.g. declaring `from: 'param', name: 'collectionId'` on a route
   * with no `:collectionId` segment) causes a runtime
   * `InternalServerErrorException`, which is the desired posture per
   * canon §28 — fail loud, never silently allow.
   */
  readonly collection: CollectionTarget;

  /**
   * Optional record identifier for routes that target a specific row
   * (GET / PATCH / DELETE on `/collections/:c/records/:r`). When
   * present, the guard performs an additional record-level check via
   * `canAccessCollectionRecord` after the collection-level check
   * passes.
   *
   * Omit for list / create / search routes where there is no specific
   * record yet (collection-level check is sufficient).
   */
  readonly record?: RecordTarget;
}

/**
 * Canon §28 — declare the data-ACL contract for an endpoint.
 *
 * The decorator is **always explicit**: it does NOT infer the verb
 * from the HTTP method, does NOT infer the collection from the route
 * segment, and has NO default values. Every endpoint that needs
 * collection-level access enforcement MUST hand the guard the full
 * `(verb, collection, record?)` triple. This is the canon §28
 * deny-wins posture applied at the decorator surface.
 *
 * Pairs with `CollectionAccessGuard`, which routes the decorator's
 * declaration into the §28 evaluator (`canAccessCollection`,
 * `canAccessCollectionRecord`) and attaches the resolved row-level
 * predicates to the request so the data service can apply them to
 * lists / searches.
 *
 * Stream 3 sweeps existing data-ACL routes (post-Stream-2 PR1
 * registry mismatch list) and applies this decorator end-to-end.
 *
 * @example
 * ```ts
 * @Get(':collectionId/records')
 * @RequireCollectionAccess({
 *   verb: 'read',
 *   collection: { from: 'param', name: 'collectionId', kind: 'id' },
 * })
 * list(@Param('collectionId') collectionId: string, @Req() req: InstanceRequest) {
 *   // The guard already attached row-conditions to `req.rowConditions`;
 *   // pass them through to the data service for query composition.
 * }
 *
 * @Patch(':collectionId/records/:recordId')
 * @RequireCollectionAccess({
 *   verb: 'update',
 *   collection: { from: 'param', name: 'collectionId', kind: 'id' },
 *   record: { from: 'param', name: 'recordId' },
 * })
 * update(@Param('collectionId') c: string, @Param('recordId') r: string) { ... }
 * ```
 */
export const RequireCollectionAccess = (opts: RequireCollectionAccessOptions) =>
  SetMetadata(REQUIRE_COLLECTION_ACCESS_KEY, opts);
