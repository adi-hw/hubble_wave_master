import { Logger } from '@nestjs/common';
import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import type { QueryRunner } from 'typeorm';

import { CollectionAccessRule, PropertyAccessRule } from '../entities/access-rule.entity';
import { PropertyDefinition } from '../entities/property-definition.entity';

/**
 * Publisher contract the subscriber needs to deliver invalidation events
 * to the cache owner (`AuthorizationService` in `libs/authorization`).
 *
 * This shape is intentionally identical to `AccessRuleCacheInvalidationPort`
 * in `libs/authorization`; the duplication exists so `libs/instance-db`
 * does not need to import `libs/authorization` (which would create a
 * dependency cycle — `authorization` already imports entity classes from
 * `instance-db`).
 *
 * `AuthorizationService` implements both shapes by virtue of implementing
 * the canonical port; the wiring in `apps/api/.../access.module.ts` passes
 * the service into `AccessRuleCacheInvalidationSubscriber.setPublisher`.
 */
export interface AccessRuleCacheInvalidationPublisher {
  invalidateCollectionRules(event: CollectionRuleChangeEvent): Promise<void>;
  invalidatePropertyRules(event: PropertyRuleChangeEvent): Promise<void>;
}

export type CacheInvalidationOperation = 'insert' | 'update' | 'remove';

export interface CollectionRuleChangeEvent {
  collectionId: string;
  operation: CacheInvalidationOperation;
  ruleId?: string;
}

export interface PropertyRuleChangeEvent {
  collectionId: string;
  operation: CacheInvalidationOperation;
  propertyId?: string;
  ruleId?: string;
}

/**
 * A pending invalidation queued during a transaction, drained on commit.
 * `kind` discriminates which publisher method to call; the `event` payload
 * is the exact value passed through to the publisher.
 */
type PendingEvent =
  | { kind: 'collection'; event: CollectionRuleChangeEvent }
  | { kind: 'property'; event: PropertyRuleChangeEvent };

/**
 * F025 — TypeORM entity subscriber that fires permission-cache invalidation
 * whenever `CollectionAccessRule` or `PropertyAccessRule` changes.
 *
 * Publish timing follows the F043 pattern (see
 * `identity-cache-invalidation.subscriber.ts` for the canonical writeup).
 * Briefly:
 *   - inside a transaction: enqueue per-QueryRunner, drain on commit, drop
 *     on rollback. Prevents two failure modes — publishing a phantom
 *     invalidation for a write that rolled back, or missing the publish
 *     entirely if it failed but the transaction committed.
 *   - outside a transaction: publish inline (no commit/rollback hook will
 *     ever fire to drain a queue), same swallow-but-log semantics.
 *
 * Property-rule events require a `collectionId` for the publisher's cache
 * key. The entity carries only `propertyId`, so this subscriber resolves
 * the parent collection via `event.manager.findOne(PropertyDefinition,
 * { where: { id: propertyId } })`. The lookup runs inside the same
 * QueryRunner that wrote the rule, so it sees a consistent view of the
 * data and adds at most one extra read per property-rule write.
 *
 * Publisher is wired via the static `setPublisher` method from a Nest
 * module-init hook. Until then, events are dropped with a debug log — the
 * subscriber is silent during bootstrap rather than crashing seeders or
 * migrations.
 *
 * `listenTo` returns `Object` so the subscriber receives events for every
 * entity; the dispatch logic in `handleChange` filters via `instanceof`
 * checks. This mirrors `IdentityCacheInvalidationSubscriber`'s pattern
 * and keeps the routing logic in one place.
 */
@EventSubscriber()
export class AccessRuleCacheInvalidationSubscriber
  implements EntitySubscriberInterface
{
  private static publisher: AccessRuleCacheInvalidationPublisher | null = null;
  private static readonly logger = new Logger(
    'AccessRuleCacheInvalidationSubscriber',
  );

  /**
   * Per-transaction queue of pending invalidation events. Keyed by the
   * QueryRunner so concurrent transactions never see each other's events.
   * WeakMap allows the queue to be garbage-collected once the QueryRunner
   * is released back to the pool.
   */
  private readonly pendingByQueryRunner = new WeakMap<
    QueryRunner,
    PendingEvent[]
  >();

  /** Inject the publisher once Nest is up. Idempotent. */
  static setPublisher(publisher: AccessRuleCacheInvalidationPublisher): void {
    AccessRuleCacheInvalidationSubscriber.publisher = publisher;
  }

  /** Test/teardown hook. */
  static clearPublisher(): void {
    AccessRuleCacheInvalidationSubscriber.publisher = null;
  }

  afterInsert(event: InsertEvent<unknown>): void {
    void this.handleChange(
      event.entity,
      event.metadata.target,
      'insert',
      event.queryRunner,
    );
  }

  afterUpdate(event: UpdateEvent<unknown>): void {
    void this.handleChange(
      event.entity,
      event.metadata.target,
      'update',
      event.queryRunner,
    );
  }

  afterRemove(event: RemoveEvent<unknown>): void {
    void this.handleChange(
      event.entity ?? event.databaseEntity,
      event.metadata.target,
      'remove',
      event.queryRunner,
    );
  }

  /**
   * Drain the per-QueryRunner queue and dispatch each event to the
   * publisher. Failures during dispatch are logged but never re-thrown —
   * the business transaction has already committed and the subscriber
   * must not destabilise the caller.
   */
  afterTransactionCommit(event: TransactionCommitEvent): void {
    const pending = this.pendingByQueryRunner.get(event.queryRunner);
    if (!pending || pending.length === 0) {
      return;
    }
    // Remove the queue before dispatching so a recycled QueryRunner cannot
    // accidentally re-deliver these events on a later transaction.
    this.pendingByQueryRunner.delete(event.queryRunner);

    const publisher = AccessRuleCacheInvalidationSubscriber.publisher;
    if (!publisher) {
      AccessRuleCacheInvalidationSubscriber.logger.debug(
        `Dropping ${pending.length} access-rule invalidation event(s) — publisher not yet wired`,
      );
      return;
    }

    for (const item of pending) {
      this.dispatch(publisher, item);
    }
  }

  /**
   * Drop any pending events for the rolled-back transaction. The rule
   * write never happened, so the cache must not be invalidated.
   */
  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.pendingByQueryRunner.delete(event.queryRunner);
  }

  /**
   * Resolve the change into a `PendingEvent` (looking up the parent
   * collection for property rules) and route it to the per-transaction
   * queue when a transaction is active, or publish inline otherwise.
   */
  private async handleChange(
    entity: unknown,
    target: unknown,
    operation: CacheInvalidationOperation,
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (!entity) {
      return;
    }

    // Collection-rule path: the entity carries `collectionId` directly.
    if (target === CollectionAccessRule) {
      const rule = entity as Partial<CollectionAccessRule>;
      if (!rule.collectionId) {
        return;
      }
      this.routeOrPublish(queryRunner, {
        kind: 'collection',
        event: {
          collectionId: rule.collectionId,
          operation,
          ruleId: rule.id,
        },
      });
      return;
    }

    // Property-rule path: handles both explicit field rules (carrying
    // `propertyId`) and wildcard field rules (carrying
    // `wildcardCollectionId`, canon §28.2 levels 3-4). The DB XOR CHECK
    // constraint guarantees each row is exactly one shape.
    if (target === PropertyAccessRule) {
      const rule = entity as Partial<PropertyAccessRule>;

      // Wildcard rule: the entity carries `wildcardCollectionId` directly
      // — no PropertyDefinition lookup needed.
      if (rule.wildcardCollectionId) {
        this.routeOrPublish(queryRunner, {
          kind: 'property',
          event: {
            collectionId: rule.wildcardCollectionId,
            operation,
            // No specific propertyId — wildcard applies to every field
            // of the collection. The invalidator handles this as a
            // collection-wide property-rule invalidation.
            propertyId: undefined,
            ruleId: rule.id,
          },
        });
        return;
      }

      // Explicit-field rule: the entity has `propertyId` but not the
      // parent collectionId. Resolve via the QueryRunner's manager so
      // the lookup is consistent with the same transaction's writes.
      if (!rule.propertyId) {
        return;
      }
      const collectionId = await this.resolveCollectionId(queryRunner, rule);
      if (!collectionId) {
        // Property was already deleted (FK violation would have prevented
        // the rule write, so this only happens in pathological races) or
        // the lookup failed transiently. Log and continue — the cache TTL
        // will eventually catch up.
        AccessRuleCacheInvalidationSubscriber.logger.warn(
          `Could not resolve collectionId for propertyId=${rule.propertyId} (operation=${operation}); skipping invalidation`,
        );
        return;
      }
      this.routeOrPublish(queryRunner, {
        kind: 'property',
        event: {
          collectionId,
          operation,
          propertyId: rule.propertyId,
          ruleId: rule.id,
        },
      });
      return;
    }
    // Other entities are ignored — `listenTo` returning Object means we
    // see every write in the database; only the two access-rule tables
    // matter.
  }

  /**
   * Look up the parent collection for a property-access-rule change. Uses
   * the QueryRunner's manager so the read sees the same transactional
   * view as the rule write that triggered the event. Returns `null` on
   * miss or error rather than throwing — invalidation is best-effort.
   */
  private async resolveCollectionId(
    queryRunner: QueryRunner,
    rule: Partial<PropertyAccessRule>,
  ): Promise<string | null> {
    // If the relation happened to be loaded, prefer it — saves a query.
    const loaded = rule.property as Partial<PropertyDefinition> | undefined;
    if (loaded?.collectionId) {
      return loaded.collectionId;
    }
    if (!rule.propertyId) {
      return null;
    }
    try {
      const def = await queryRunner.manager.findOne(PropertyDefinition, {
        where: { id: rule.propertyId },
        select: ['id', 'collectionId'],
      });
      return def?.collectionId ?? null;
    } catch (err) {
      AccessRuleCacheInvalidationSubscriber.logger.warn(
        `PropertyDefinition lookup failed for propertyId=${rule.propertyId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Append to the per-QueryRunner queue when a transaction is active;
   * publish immediately when the write was not part of one (no commit/
   * rollback hook would fire to drain a queue otherwise).
   */
  private routeOrPublish(queryRunner: QueryRunner, item: PendingEvent): void {
    if (!queryRunner?.isTransactionActive) {
      const publisher = AccessRuleCacheInvalidationSubscriber.publisher;
      if (!publisher) {
        AccessRuleCacheInvalidationSubscriber.logger.debug(
          `Dropping ${item.kind} invalidation — publisher not yet wired`,
        );
        return;
      }
      this.dispatch(publisher, item);
      return;
    }

    let queue = this.pendingByQueryRunner.get(queryRunner);
    if (!queue) {
      queue = [];
      this.pendingByQueryRunner.set(queryRunner, queue);
    }
    queue.push(item);
  }

  /**
   * Call the appropriate publisher method for the given pending event.
   * Wraps the async call in a `.catch` that converts every rejection
   * into a logged error — propagating would re-throw across the
   * transaction-commit hook, which TypeORM does not handle cleanly.
   */
  private dispatch(
    publisher: AccessRuleCacheInvalidationPublisher,
    item: PendingEvent,
  ): void {
    const onError = (err: Error): void => {
      AccessRuleCacheInvalidationSubscriber.logger.error(
        `Failed to publish ${item.kind}-rule invalidation: ${err.message}`,
        err.stack,
      );
    };
    if (item.kind === 'collection') {
      publisher.invalidateCollectionRules(item.event).catch(onError);
    } else {
      publisher.invalidatePropertyRules(item.event).catch(onError);
    }
  }
}
