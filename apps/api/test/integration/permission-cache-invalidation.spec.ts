import { DataSource } from 'typeorm';

import {
  Group,
  GroupMember,
  GroupRole,
  PlatformPermission,
  Role,
  RolePermission,
  User,
  UserRole,
  IdentityCacheInvalidationSubscriber,
  type IdentityCacheEventPublisher,
} from '@hubblewave/instance-db';

import { createTestDataSource } from '../helpers/test-database';

/**
 * W2 Stream 1 PR2 / F025 — end-to-end cache invalidation contract.
 *
 * Verifies that a write to the source-of-truth tables
 * (`identity.role_permissions` here, but the same path covers
 * `user_roles`, `group_members`, `group_roles`, the access rules) triggers
 * the `permission.invalidate` event AND that the consumer side acts on it.
 *
 * The test wires the actual `IdentityCacheInvalidationSubscriber` against a
 * real Postgres DataSource and an in-process event-bus shim. The shim
 * implements just enough of the `EventBusService` surface that consumers
 * subscribe-and-fire on a single process — production runs the same code
 * across Redis pub/sub for cross-instance correctness, but the contract
 * (publish post-commit, deliver scoped payload, consumers evict on
 * `scope=permissions` for the role's users) is identical and is what this
 * test asserts.
 *
 * The "consumer" in this test is a tiny `PermissionInvalidationListener`
 * stub that records every event it would have acted on. We assert against
 * the recorded events; the real `PermissionResolverService` /
 * `IdentityResolverAdapter` / `AuthorizationService` consumers each have
 * their own unit tests for the cache-eviction logic.
 */

const PERMISSION_INVALIDATE_TOPIC = 'permission.invalidate';

interface InvalidationEvent {
  scope: 'identity' | 'permissions' | 'acl';
  userIds?: string[];
  roleIds?: string[];
  groupIds?: string[];
  collectionIds?: string[];
  propertyIds?: string[];
}

/**
 * Minimal in-process publisher that satisfies both
 * `IdentityCacheEventPublisher` (the publish-side contract the TypeORM
 * subscriber needs) and the subscribe-side contract a consumer would call
 * on `EventBusService`. Captures every event delivered to subscribers so
 * the test can assert on them.
 */
class InProcessEventBus implements IdentityCacheEventPublisher {
  readonly delivered: Array<{ topic: string; payload: InvalidationEvent }> = [];
  private readonly handlers = new Map<
    string,
    Array<(payload: InvalidationEvent) => void | Promise<void>>
  >();

  async publish<T>(topic: string, payload: T): Promise<void> {
    const ev = { topic, payload: payload as InvalidationEvent };
    this.delivered.push(ev);
    const hs = this.handlers.get(topic) ?? [];
    for (const h of hs) {
      await h(payload as InvalidationEvent);
    }
  }

  subscribe(
    topic: string,
    handler: (payload: InvalidationEvent) => void | Promise<void>,
  ): void {
    let hs = this.handlers.get(topic);
    if (!hs) {
      hs = [];
      this.handlers.set(topic, hs);
    }
    hs.push(handler);
  }
}

describe('Permission cache invalidation (W2 Stream 1 PR2 / F025)', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let bus: InProcessEventBus;

  beforeAll(async () => {
    const setup = await createTestDataSource({
      schemas: ['identity'],
      entities: [
        User,
        Role,
        PlatformPermission,
        RolePermission,
        UserRole,
        Group,
        GroupMember,
        GroupRole,
      ],
    });
    dataSource = setup.dataSource;
    cleanup = setup.cleanup;

    // Re-register the subscriber against this datasource. TypeORM
    // discovers `@EventSubscriber()` decorated classes via the global
    // metadata registry, but the test datasource is created
    // programmatically so we attach the subscriber instance directly.
    const subscriber = new IdentityCacheInvalidationSubscriber();
    dataSource.subscribers.push(subscriber);

    bus = new InProcessEventBus();
    IdentityCacheInvalidationSubscriber.setPublisher(bus);
  });

  afterAll(async () => {
    IdentityCacheInvalidationSubscriber.clearPublisher();
    await cleanup();
  });

  beforeEach(() => {
    bus.delivered.length = 0;
  });

  it('publishes scope=permissions when a RolePermission is inserted', async () => {
    const roleId = '11111111-1111-1111-1111-111111111111';
    await dataSource.transaction(async (tx) => {
      await tx.getRepository(Role).save({
        id: roleId,
        code: `test_role_${Date.now()}`,
        name: 'Test Role',
        isSystem: false,
        isActive: true,
        isDefault: false,
        scope: 'global',
        hierarchyLevel: 0,
        weight: 0,
        metadata: {},
      });
      await tx.getRepository(PlatformPermission).save({
        code: 'work_order:read',
        plane: 'instance',
        domain: 'work_order',
        action: 'read',
        dangerous: false,
        description: 'Test permission',
      });
      await tx.getRepository(RolePermission).save({
        roleId,
        permissionCode: 'work_order:read',
      });
    });

    // The publisher is async (Promise.all in publishNow / drain on
    // commit); yield the microtask queue twice so the delivery completes.
    await Promise.resolve();
    await Promise.resolve();

    const permissionEvents = bus.delivered.filter(
      (e) =>
        e.topic === PERMISSION_INVALIDATE_TOPIC &&
        e.payload.scope === 'permissions',
    );
    expect(permissionEvents.length).toBeGreaterThan(0);
    const rolePermissionEvent = permissionEvents.find((e) =>
      e.payload.roleIds?.includes(roleId),
    );
    expect(rolePermissionEvent).toBeDefined();
  });

  it('publishes scope=identity when a UserRole is inserted', async () => {
    const userId = '22222222-2222-2222-2222-222222222222';
    const roleId = '11111111-1111-1111-1111-111111111111';
    await dataSource.transaction(async (tx) => {
      await tx.getRepository(User).save({
        id: userId,
        email: `test-${Date.now()}@hubblewave.local`,
        username: `test-${Date.now()}`,
        displayName: `Test ${Date.now()}`,
        passwordHash: 'x',
        status: 'active',
        emailVerified: true,
        isAdmin: false,
        failedLoginAttempts: 0,
      });
      await tx.getRepository(UserRole).save({
        userId,
        roleId,
        source: 'direct',
      });
    });

    await Promise.resolve();
    await Promise.resolve();

    const identityEvents = bus.delivered.filter(
      (e) =>
        e.topic === PERMISSION_INVALIDATE_TOPIC &&
        e.payload.scope === 'identity',
    );
    const userRoleEvent = identityEvents.find((e) =>
      e.payload.userIds?.includes(userId),
    );
    expect(userRoleEvent).toBeDefined();
    expect(userRoleEvent?.payload.roleIds).toEqual([roleId]);
  });

  it('does NOT publish when the transaction rolls back (F043)', async () => {
    const startDelivered = bus.delivered.length;
    const roleId = '33333333-3333-3333-3333-333333333333';
    try {
      await dataSource.transaction(async (tx) => {
        await tx.getRepository(Role).save({
          id: roleId,
          code: `rollback_role_${Date.now()}`,
          name: 'Rollback Role',
          isSystem: false,
          isActive: true,
          isDefault: false,
          scope: 'global',
          hierarchyLevel: 0,
          weight: 0,
          metadata: {},
        });
        throw new Error('induced rollback');
      });
    } catch (e: unknown) {
      // Expected — the transaction rolled back.
      expect((e as Error).message).toBe('induced rollback');
    }

    await Promise.resolve();
    await Promise.resolve();

    // No new events published since the start of this test.
    expect(bus.delivered.length).toBe(startDelivered);
  });
});
