import type { UserRequestContext } from './request-context.interface';
import type { CollectionAccessVerb } from './require-collection-access.decorator';

/**
 * The collection-level §28 evaluator surface the `CollectionAccessGuard`
 * needs from any AuthorizationService-shaped service.
 *
 * Mirrors the relevant subset of `@hubblewave/authorization`'s public
 * API. Defining the shape locally keeps `@hubblewave/auth-guard` free of
 * a circular dependency on `@hubblewave/authorization` (the
 * authorization lib already imports `UserRequestContext` from this lib).
 *
 * Three methods, three concerns:
 *   - `canAccessCollection` — collection-level decision (allow/deny).
 *   - `canAccessCollectionRecord` — record-level decision for routes
 *     that target a specific row. Layered on top of the collection
 *     check — record visibility gates field evaluation per canon §28.1.
 *   - `getSafeRowLevelPredicatesForCollection` — for list/search routes,
 *     return the §28 row-condition predicates that the data service
 *     applies to the query. The guard attaches the result to
 *     `request.rowConditions` (canonical request augmentation point);
 *     the data service consumes it.
 *
 * Authorization decisions returned by these methods reflect canon §28
 * deny-wins semantics — an unconditional deny anywhere collapses the
 * result to `false`. No admin special-case (canon §28.6 retired the
 * bypass via Plan Fix 33).
 */
export interface CollectionAccessEvaluator {
  canAccessCollection(
    ctx: UserRequestContext,
    collectionId: string,
    operation: CollectionAccessVerb,
  ): Promise<boolean>;

  canAccessCollectionRecord(
    ctx: UserRequestContext,
    collectionId: string,
    recordId: string,
    operation: CollectionAccessVerb,
  ): Promise<boolean>;

  /**
   * Return the row-level predicates that gate which records the user
   * may see. The shape is engine-neutral (a list of safe predicate
   * objects); the data service compiles them into SQL or filter DSL
   * at query time.
   *
   * `unknown[]` is the contract here — auth-guard does not pin the
   * predicate shape because that shape evolves with the §28 emitters
   * (W2 spec §4.2 + Stream 4b search-authz work). Consumers cast to
   * `SafePredicate[]` from `@hubblewave/authorization` at the data
   * service boundary.
   */
  getSafeRowLevelPredicatesForCollection(
    ctx: UserRequestContext,
    collectionId: string,
    operation: CollectionAccessVerb,
  ): Promise<unknown[]>;
}

/** Injection token used by `CollectionAccessGuard`. */
export const COLLECTION_ACCESS_EVALUATOR_PORT =
  'COLLECTION_ACCESS_EVALUATOR_PORT';
