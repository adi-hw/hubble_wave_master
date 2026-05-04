import { Logger } from '@nestjs/common';
import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';

import { GroupMember, GroupRole } from '../entities/group.entity';
import { RolePermission, UserRole } from '../entities/role-permission.entity';

/**
 * Minimal contract a subscriber needs from the event bus. We avoid importing
 * `@hubblewave/event-bus` directly because TypeORM instantiates subscribers
 * outside the Nest DI graph; binding to a concrete service would create a
 * cycle at module load.
 */
export interface IdentityCacheEventPublisher {
  publish<T>(topic: string, payload: T): Promise<void>;
}

const TOPIC_USER_ROLE_CHANGED = 'identity.user-role.changed';
const TOPIC_ROLE_PERMISSION_CHANGED = 'identity.role-permission.changed';
const TOPIC_GROUP_MEMBERSHIP_CHANGED = 'identity.group-membership.changed';

/**
 * TypeORM entity subscriber that emits cache-invalidation events whenever
 * the source-of-truth tables for permissions change.
 *
 * Why a static holder for the publisher? TypeORM constructs subscribers when
 * the data source initialises — that happens during Nest's bootstrap, before
 * application providers like `EventBusService` are fully resolved. Wiring the
 * publisher via `IdentityCacheInvalidationSubscriber.setPublisher(...)` from
 * `onApplicationBootstrap` (or any module-init hook) keeps the subscriber
 * class free of DI concerns while still letting it reach a live publisher at
 * runtime.
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
    this.handleChange(event.entity, event.metadata.target);
  }

  afterUpdate(event: UpdateEvent<unknown>): void {
    this.handleChange(event.entity, event.metadata.target);
  }

  afterRemove(event: RemoveEvent<unknown>): void {
    this.handleChange(
      event.entity ?? event.databaseEntity,
      event.metadata.target,
    );
  }

  private handleChange(entity: unknown, target: unknown): void {
    if (!entity) {
      return;
    }

    if (target === UserRole) {
      const userRole = entity as Partial<UserRole>;
      if (userRole.userId) {
        this.emit(TOPIC_USER_ROLE_CHANGED, {
          userIds: [userRole.userId],
          roleIds: userRole.roleId ? [userRole.roleId] : undefined,
        });
      }
      return;
    }

    if (target === RolePermission) {
      const rolePerm = entity as Partial<RolePermission>;
      if (rolePerm.roleId) {
        this.emit(TOPIC_ROLE_PERMISSION_CHANGED, {
          roleIds: [rolePerm.roleId],
        });
      }
      return;
    }

    if (target === GroupRole) {
      // A group's role changing affects every user in the group. Subscribers
      // resolve the affected users from the role; we only carry the role IDs.
      const groupRole = entity as Partial<GroupRole>;
      if (groupRole.roleId) {
        this.emit(TOPIC_ROLE_PERMISSION_CHANGED, {
          roleIds: [groupRole.roleId],
        });
      }
      return;
    }

    if (target === GroupMember) {
      const member = entity as Partial<GroupMember>;
      if (member.userId) {
        this.emit(TOPIC_GROUP_MEMBERSHIP_CHANGED, {
          userIds: [member.userId],
          groupIds: member.groupId ? [member.groupId] : undefined,
        });
      }
      return;
    }
  }

  private emit(topic: string, payload: Record<string, unknown>): void {
    const publisher = IdentityCacheInvalidationSubscriber.publisher;
    if (!publisher) {
      IdentityCacheInvalidationSubscriber.logger.debug(
        `Dropping ${topic} — event bus publisher not yet wired`,
      );
      return;
    }

    publisher.publish(topic, payload).catch((error: Error) => {
      IdentityCacheInvalidationSubscriber.logger.error(
        `Failed to publish ${topic}: ${error.message}`,
      );
    });
  }
}
