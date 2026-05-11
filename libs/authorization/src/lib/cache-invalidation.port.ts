/**
 * F025 — Permission cache invalidation port.
 *
 * AuthorizationService caches per-collection and per-property access rules
 * with a 5-minute TTL. Without an invalidation signal a rule change leaves
 * the cache serving the previous policy for up to that full window, which
 * is unacceptable for authorization (canon §9 — Authorization Is
 * Centralized; cache must reflect source-of-truth promptly).
 *
 * The port is implemented by `AuthorizationService` (consumer side) and
 * called from a TypeORM entity subscriber in `libs/instance-db` (producer
 * side) whenever a `CollectionAccessRule` / `PropertyAccessRule` is
 * inserted, updated, or removed.
 *
 * Producer-side note: `libs/instance-db` cannot import this port directly
 * without creating an `instance-db -> authorization -> instance-db`
 * dependency cycle. The subscriber therefore defines its own structurally-
 * identical publisher interface and `AuthorizationService` satisfies both
 * shapes by implementing this port — that single implementation is bound
 * into the subscriber via a static setter at module-init time
 * (see `AccessRuleCacheInvalidationSubscriber.setPublisher`).
 *
 * Why a port at all? AuthorizationService already lives in a library that
 * has no direct dependency on the instance-db subscriber stack; binding via
 * a port keeps the lib usable in unit-test contexts where neither TypeORM
 * nor a real cache are available, and keeps the cache-invalidation
 * contract a first-class concern rather than a coincidental method on a
 * service class.
 */
export interface AccessRuleCacheInvalidationPort {
  /**
   * Invalidate every cached entry derived from collection-level rules for
   * `collectionId`. Implementations MUST clear:
   *   - the unfiltered cache key (`auth:collection-rules:{cid}`)
   *   - every per-user key matching `auth:collection-rules:{cid}:*`
   *     (F023 — when SQL principal-filter pushdown is in use, the cache
   *     key includes a per-principal hash; each user keeps a distinct
   *     entry that must be cleared individually).
   *
   * Best-effort: cache-store failures MUST be caught and logged; this
   * method MUST NOT throw. The rule write has already committed by the
   * time invalidation runs (the subscriber publishes after commit), so
   * propagating an error would leave the data store and cache in
   * inconsistent states.
   */
  invalidateCollectionRules(event: CollectionRuleChangeEvent): Promise<void>;

  /**
   * Invalidate the cached property-rule entry for the collection that
   * owns the changed property. Implementations MUST clear:
   *   - the per-collection cache key (`auth:property-rules:{cid}`)
   *
   * Same best-effort semantics as `invalidateCollectionRules`: catch and
   * log cache-store errors; never throw.
   *
   * `collectionId` is required so the publisher can build the cache key
   * directly. The producer-side subscriber resolves
   * `propertyId -> collectionId` against the live data source before
   * emitting (the subscriber runs inside the same QueryRunner that
   * committed the rule change, so the lookup is cheap and always
   * consistent with the write).
   */
  invalidatePropertyRules(event: PropertyRuleChangeEvent): Promise<void>;
}

/**
 * Operation type carried with every invalidation event. The publisher does
 * not branch on it today (every operation invalidates the same keys), but
 * downstream logging and metrics consumers benefit from being able to
 * distinguish a rule INSERT from an UPDATE or REMOVE.
 */
export type CacheInvalidationOperation = 'insert' | 'update' | 'remove';

export interface CollectionRuleChangeEvent {
  collectionId: string;
  operation: CacheInvalidationOperation;
  /** Optional — included when the rule's primary key is known. */
  ruleId?: string;
}

export interface PropertyRuleChangeEvent {
  /**
   * Required. The subscriber resolves this from `propertyId` before
   * emitting; the publisher uses it directly as the cache-key suffix.
   */
  collectionId: string;
  operation: CacheInvalidationOperation;
  /** The property the rule applies to; carried for observability. */
  propertyId?: string;
  /** Optional — included when the rule's primary key is known. */
  ruleId?: string;
}

/**
 * Nest DI token used by `apps/api`'s `AccessModule` to bind the
 * `AuthorizationService` implementation to the port.
 */
export const ACCESS_RULE_CACHE_INVALIDATION_PORT =
  'ACCESS_RULE_CACHE_INVALIDATION_PORT';
