import {
  GroupMember,
  GroupRole,
  IdentityCacheInvalidationSubscriber,
  RolePermission,
  UserRole,
} from '@hubblewave/instance-db';
import type { QueryRunner } from 'typeorm';

/**
 * The user-role assignment path writes a UserRole row, which fires the
 * TypeORM `@AfterInsert`/`@AfterUpdate`/`@AfterRemove` hooks. Those hooks
 * delegate to IdentityCacheInvalidationSubscriber, which queues the
 * cross-service event and publishes it from `afterTransactionCommit`
 * (F043: publish-after-commit pattern). These tests exercise that
 * subscriber directly — driving it with synthetic events so we can prove
 * the publish contract without a live database.
 *
 * Non-transactional writes (where `queryRunner.isTransactionActive` is
 * false) publish inline since no commit hook will fire to drain a queue
 * in that case. The synthetic events here use that mode unless the test
 * is specifically asserting the transactional path.
 */
describe('IdentityCacheInvalidationSubscriber', () => {
  let subscriber: IdentityCacheInvalidationSubscriber;
  let publishCalls: Array<{ topic: string; payload: unknown }>;

  // Non-transactional QueryRunner: writes publish inline.
  const directQueryRunner = {
    isTransactionActive: false,
  } as unknown as QueryRunner;

  beforeEach(() => {
    publishCalls = [];
    subscriber = new IdentityCacheInvalidationSubscriber();
    IdentityCacheInvalidationSubscriber.setPublisher({
      publish: async (topic, payload) => {
        publishCalls.push({ topic, payload });
      },
    });
  });

  afterEach(() => {
    IdentityCacheInvalidationSubscriber.clearPublisher();
  });

  function makeInsertEvent<T>(target: unknown, entity: T): never {
    // Subscribers read `entity`, `metadata.target`, and `queryRunner`;
    // a synthetic shape suffices and avoids constructing real TypeORM
    // EntityMetadata objects in unit tests.
    return {
      entity,
      metadata: { target },
      queryRunner: directQueryRunner,
    } as unknown as never;
  }

  it('publishes identity.user-role.changed when a UserRole is inserted', async () => {
    subscriber.afterInsert(
      makeInsertEvent(UserRole, {
        userId: 'user-1',
        roleId: 'role-1',
      }),
    );
    // The publish is async; flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toEqual([
      {
        topic: 'identity.user-role.changed',
        payload: { userIds: ['user-1'], roleIds: ['role-1'] },
      },
    ]);
  });

  it('publishes identity.user-role.changed when a UserRole is removed', async () => {
    subscriber.afterRemove({
      entity: { userId: 'user-2', roleId: 'role-2' },
      databaseEntity: undefined,
      metadata: { target: UserRole },
      queryRunner: directQueryRunner,
    } as never);
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toHaveLength(1);
    expect(publishCalls[0].topic).toBe('identity.user-role.changed');
    expect(publishCalls[0].payload).toEqual({
      userIds: ['user-2'],
      roleIds: ['role-2'],
    });
  });

  it('falls back to databaseEntity when entity is undefined on remove', async () => {
    subscriber.afterRemove({
      entity: undefined,
      databaseEntity: { userId: 'user-3', roleId: 'role-3' },
      metadata: { target: UserRole },
      queryRunner: directQueryRunner,
    } as never);
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toEqual([
      {
        topic: 'identity.user-role.changed',
        payload: { userIds: ['user-3'], roleIds: ['role-3'] },
      },
    ]);
  });

  it('publishes identity.role-permission.changed when a RolePermission changes', async () => {
    subscriber.afterInsert(
      makeInsertEvent(RolePermission, {
        roleId: 'role-x',
        permissionId: 'perm-x',
      }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toEqual([
      {
        topic: 'identity.role-permission.changed',
        payload: { roleIds: ['role-x'] },
      },
    ]);
  });

  it('publishes identity.role-permission.changed when a GroupRole changes', async () => {
    subscriber.afterInsert(
      makeInsertEvent(GroupRole, {
        groupId: 'group-1',
        roleId: 'role-y',
      }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toEqual([
      {
        topic: 'identity.role-permission.changed',
        payload: { roleIds: ['role-y'] },
      },
    ]);
  });

  it('publishes identity.group-membership.changed when a GroupMember changes', async () => {
    subscriber.afterInsert(
      makeInsertEvent(GroupMember, {
        userId: 'user-9',
        groupId: 'group-9',
      }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toEqual([
      {
        topic: 'identity.group-membership.changed',
        payload: { userIds: ['user-9'], groupIds: ['group-9'] },
      },
    ]);
  });

  it('silently drops events when no publisher is wired (pre-bootstrap)', async () => {
    IdentityCacheInvalidationSubscriber.clearPublisher();

    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u', roleId: 'r' }),
    );
    await Promise.resolve();

    expect(publishCalls).toEqual([]);
  });

  it('ignores entities of unrelated types', async () => {
    class Unrelated {}
    subscriber.afterInsert(
      makeInsertEvent(Unrelated, { userId: 'u', roleId: 'r' }),
    );
    await Promise.resolve();

    expect(publishCalls).toEqual([]);
  });
});
