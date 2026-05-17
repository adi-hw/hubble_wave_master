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

import {
  CollectionAccessRule,
  PropertyAccessRule,
} from '../entities/access-rule.entity';
import { GroupMember, GroupRole } from '../entities/group.entity';
import { RolePermission, UserRole } from '../entities/role-permission.entity';
import { Role } from '../entities/role.entity';

/**
 * Minimal contract a subscriber needs from the event bus. We avoid importing
 * `@hubblewave/event-bus` directly because TypeORM instantiates subscribers
 * outside the Nest DI graph; binding to a concrete service would create a
 * cycle at module load.
 */
export interface IdentityCacheEventPublisher {
  publish<T>(topic: string, payload: T): Promise<void>;
}

/**
 * The unified invalidation topic name. Mirrors
 * `EventTopic.PermissionInvalidate` in `@hubblewave/event-bus`; duplicated
 * here as a literal because the subscriber must not import from the event-
 * bus library (no DI cycle, no module-init ordering hazard).
 */
const TOPIC_PERMISSION_INVALIDATE = 'permission.invalidate';

type InvalidateScope = 'identity' | 'permissions' | 'acl';

interface PendingEvent {
  topic: string;
  payload: Record<string, unknown>;
}

interface InvalidatePayload extends Record<string, unknown> {
  scope: InvalidateScope;
  userIds?: string[];
  roleIds?: string[];
  groupIds?: string[];
  collectionIds?: string[];
  propertyIds?: string[];
}

/**
 * TypeORM entity subscriber that emits cache-invalidation events whenever
 * the source-of-truth tables for permissions change.
 *
 * Topic + payload (W2 Stream 1 PR2 / F025): single unified channel
 * `permission.invalidate` with a `scope` discriminator. The pre-W2
 * per-entity topics (user-role / role-permission / group-membership) were
 * collapsed into this one channel so every consumer cache routes through
 * one path. Scope mapping by entity:
 *
 *   - `identity`    — UserRole, GroupMember (user → role / user → group)
 *   - `permissions` — Role, RolePermission, GroupRole (role itself or
 *                     role → permission)
 *   - `acl`         — CollectionAccessRule, PropertyAccessRule (record-
 *                     level or field-level rule)
 *
 * Publish timing (F043): events are NOT published inline from
 * `afterInsert`/`afterUpdate`/`afterRemove`. Doing so risks two failure
 * modes:
 *   1. The publish succeeds but the surrounding transaction rolls back —
 *      downstream consumers invalidate caches for a write that never
 *      happened.
 *   2. The publish fails and the transaction still commits — consumers
 *      keep serving stale data until the cache TTL elapses.
 *
 * Instead the entity hooks enqueue pending events keyed by the
 * transaction's QueryRunner in a per-transaction WeakMap.
 * `afterTransactionCommit` drains the queue and publishes;
 * `afterTransactionRollback` drops the queue without publishing. Writes
 * outside an explicit transaction (`event.queryRunner.isTransactionActive ===
 * false`) publish immediately since no commit/rollback hook will fire for
 * them.
 *
 * Publish failures on the post-commit path are best-effort by definition
 * (the business write has already landed), but they are surfaced via
 * `logger.error` so operations can alert on a degraded event bus rather
 * than discovering it through stale-cache symptoms.
 *
 * Why a static holder for the publisher? TypeORM constructs subscribers
 * when the data source initialises — that happens during Nest's bootstrap,
 * before application providers like `EventBusService` are fully resolved.
 * Wiring the publisher via
 * `IdentityCacheInvalidationSubscriber.setPublisher(...)` from an
 * `onModuleInit` / constructor hook keeps the subscriber class free of DI
 * concerns while still letting it reach a live publisher at runtime.
 *
 * Until the publisher is set the subscriber is silent — events are dropped
 * with a debug log. This is intentional: it lets the database boot before
 * the bus is reachable without crashing migrations or seeders.
 */
@EventSubscriber()
export class IdentityCacheInvalidationSubscriber
  implements EntitySubscriberInterface
{
  private static publisher: IdentityCacheEventPublisher | null = null;
  private static readonly logger = new Logger(
    'IdentityCacheInvalidationSubscriber',
  );

  /**
   * Per-transaction queue of pending invalidation events. Keyed by the
   * QueryRunner so concurrent transactions never see each other's events.
   * WeakMap allows the queue to be garbage-collected once the QueryRunner
   * is released.
   */
  private readonly pendingByQueryRunner = new WeakMap<
    QueryRunner,
    PendingEvent[]
  >();

  /**
   * Inject the publisher once Nest is up. Idempotent — calling repeatedly
   * replaces the previous publisher.
   */
  static setPublisher(publisher: IdentityCacheEventPublisher): void {
    IdentityCacheInvalidationSubscriber.publisher = publisher;
  }

  /** Test/teardown hook. */
  static clearPublisher(): void {
    IdentityCacheInvalidationSubscriber.publisher = null;
  }

  afterInsert(event: InsertEvent<unknown>): void {
    this.handleChange(event.entity, event.metadata.target, event.queryRunner);
  }

  afterUpdate(event: UpdateEvent<unknown>): void {
    this.handleChange(event.entity, event.metadata.target, event.queryRunner);
  }

  afterRemove(event: RemoveEvent<unknown>): void {
    this.handleChange(
      event.entity ?? event.databaseEntity,
      event.metadata.target,
      event.queryRunner,
    );
  }

  /**
   * Drain the queue for this transaction and publish each enqueued event.
   * Failures are logged loudly but not re-thrown — the business transaction
   * has already committed and the subscriber must not destabilise the
   * caller. Operators are expected to alert on the error log.
   */
  afterTransactionCommit(event: TransactionCommitEvent): void {
    const pending = this.pendingByQueryRunner.get(event.queryRunner);
    if (!pending || pending.length === 0) {
      return;
    }
    // Remove the queue before publishing so a recycled QueryRunner cannot
    // accidentally re-deliver these events on a future transaction.
    this.pendingByQueryRunner.delete(event.queryRunner);

    const publisher = IdentityCacheInvalidationSubscriber.publisher;
    if (!publisher) {
      IdentityCacheInvalidationSubscriber.logger.debug(
        `Dropping ${pending.length} permission-invalidate event(s) — event bus publisher not yet wired`,
      );
      return;
    }

    for (const { topic, payload } of pending) {
      publisher.publish(topic, payload).catch((error: Error) => {
        IdentityCacheInvalidationSubscriber.logger.error(
          `Failed to publish ${topic} after commit: ${error.message}`,
          error.stack,
        );
      });
    }
  }

  /**
   * Drop any pending events for the rolled-back transaction. The data
   * change never happened, so the cache must not be invalidated.
   */
  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.pendingByQueryRunner.delete(event.queryRunner);
  }

  private handleChange(
    entity: unknown,
    target: unknown,
    queryRunner: QueryRunner,
  ): void {
    if (!entity) {
      return;
    }

    // identity scope — user → role / user → group mapping changed
    if (target === UserRole) {
      const userRole = entity as Partial<UserRole>;
      if (userRole.userId) {
        this.enqueue(queryRunner, {
          scope: 'identity',
          userIds: [userRole.userId],
          roleIds: userRole.roleId ? [userRole.roleId] : undefined,
        });
      }
      return;
    }

    if (target === GroupMember) {
      const member = entity as Partial<GroupMember>;
      if (member.userId) {
        this.enqueue(queryRunner, {
          scope: 'identity',
          userIds: [member.userId],
          groupIds: member.groupId ? [member.groupId] : undefined,
        });
      }
      return;
    }

    // permissions scope — role itself or role → permission mapping changed
    if (target === Role) {
      const role = entity as Partial<Role>;
      if (role.id) {
        this.enqueue(queryRunner, {
          scope: 'permissions',
          roleIds: [role.id],
        });
      }
      return;
    }

    if (target === RolePermission) {
      const rolePerm = entity as Partial<RolePermission>;
      if (rolePerm.roleId) {
        this.enqueue(queryRunner, {
          scope: 'permissions',
          roleIds: [rolePerm.roleId],
        });
      }
      return;
    }

    if (target === GroupRole) {
      // A group's role changing affects every user in the group. Consumers
      // resolve the affected users from the role; we only carry the role IDs.
      const groupRole = entity as Partial<GroupRole>;
      if (groupRole.roleId) {
        this.enqueue(queryRunner, {
          scope: 'permissions',
          roleIds: [groupRole.roleId],
        });
      }
      return;
    }

    // acl scope — record-level or field-level rule changed
    if (target === CollectionAccessRule) {
      const rule = entity as Partial<CollectionAccessRule>;
      this.enqueue(queryRunner, {
        scope: 'acl',
        collectionIds: rule.collectionId ? [rule.collectionId] : undefined,
        roleIds: rule.roleId ? [rule.roleId] : undefined,
      });
      return;
    }

    if (target === PropertyAccessRule) {
      const rule = entity as Partial<PropertyAccessRule>;
      this.enqueue(queryRunner, {
        scope: 'acl',
        propertyIds: rule.propertyId ? [rule.propertyId] : undefined,
        collectionIds: rule.wildcardCollectionId
          ? [rule.wildcardCollectionId]
          : undefined,
        roleIds: rule.roleId ? [rule.roleId] : undefined,
      });
      return;
    }
  }

  /**
   * Route an event to the per-transaction queue when a transaction is
   * active; publish immediately when the write was not part of one (no
   * commit/rollback hook will fire to drain a queue in that case).
   */
  private enqueue(
    queryRunner: QueryRunner,
    payload: InvalidatePayload,
  ): void {
    if (!queryRunner?.isTransactionActive) {
      this.publishNow(payload);
      return;
    }

    let queue = this.pendingByQueryRunner.get(queryRunner);
    if (!queue) {
      queue = [];
      this.pendingByQueryRunner.set(queryRunner, queue);
    }
    queue.push({ topic: TOPIC_PERMISSION_INVALIDATE, payload });
  }

  /**
   * Inline publish for non-transactional writes. Same swallow-but-log
   * semantics as the post-commit path: the caller's write has already
   * landed by the time this runs.
   */
  private publishNow(payload: InvalidatePayload): void {
    const publisher = IdentityCacheInvalidationSubscriber.publisher;
    if (!publisher) {
      IdentityCacheInvalidationSubscriber.logger.debug(
        `Dropping ${TOPIC_PERMISSION_INVALIDATE} — event bus publisher not yet wired`,
      );
      return;
    }

    publisher
      .publish(TOPIC_PERMISSION_INVALIDATE, payload)
      .catch((error: Error) => {
        IdentityCacheInvalidationSubscriber.logger.error(
          `Failed to publish ${TOPIC_PERMISSION_INVALIDATE}: ${error.message}`,
          error.stack,
        );
      });
  }
}
