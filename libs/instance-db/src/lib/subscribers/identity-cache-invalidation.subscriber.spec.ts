import { Logger } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';

import { GroupMember, GroupRole } from '../entities/group.entity';
import { RolePermission, UserRole } from '../entities/role-permission.entity';
import {
  IdentityCacheEventPublisher,
  IdentityCacheInvalidationSubscriber,
} from './identity-cache-invalidation.subscriber';

/**
 * F043: identity cache invalidation events must publish AFTER the
 * transaction commits, never before. These tests exercise the queue
 * mechanism directly by:
 *   - constructing synthetic InsertEvent/UpdateEvent/RemoveEvent objects
 *     carrying a fake QueryRunner;
 *   - feeding them to the public `afterInsert`/`afterUpdate`/`afterRemove`
 *     handlers;
 *   - asserting publish state at each transaction lifecycle boundary
 *     (`afterTransactionCommit`, `afterTransactionRollback`).
 *
 * Two QueryRunner shapes are simulated: a "transactional" one where
 * `isTransactionActive === true` so the subscriber must defer publish, and
 * a "non-transactional" one where the subscriber must publish inline (no
 * commit/rollback hook will fire to drain a queue otherwise).
 */
describe('IdentityCacheInvalidationSubscriber (F043 — publish after commit)', () => {
  let subscriber: IdentityCacheInvalidationSubscriber;
  let publishCalls: Array<{ topic: string; payload: unknown }>;
  let publisher: IdentityCacheEventPublisher;

  // Helpers to construct synthetic events. The subscriber only reads the
  // narrow surface listed below from each event — full TypeORM event
  // objects are not required for unit-testing the queue mechanism.
  function makeQueryRunner(transactionActive: boolean): QueryRunner {
    return { isTransactionActive: transactionActive } as unknown as QueryRunner;
  }

  function makeInsertEvent<T>(
    target: unknown,
    entity: T,
    queryRunner: QueryRunner,
  ): never {
    return {
      entity,
      metadata: { target },
      queryRunner,
    } as unknown as never;
  }

  function makeUpdateEvent<T>(
    target: unknown,
    entity: T,
    queryRunner: QueryRunner,
  ): never {
    return {
      entity,
      metadata: { target },
      queryRunner,
    } as unknown as never;
  }

  function makeRemoveEvent<T>(
    target: unknown,
    entity: T | undefined,
    databaseEntity: T | undefined,
    queryRunner: QueryRunner,
  ): never {
    return {
      entity,
      databaseEntity,
      metadata: { target },
      queryRunner,
    } as unknown as never;
  }

  function makeTransactionEvent(queryRunner: QueryRunner): never {
    return { queryRunner } as unknown as never;
  }

  beforeEach(() => {
    publishCalls = [];
    publisher = {
      publish: jest.fn(async (topic, payload) => {
        publishCalls.push({ topic, payload });
      }),
    };
    subscriber = new IdentityCacheInvalidationSubscriber();
    IdentityCacheInvalidationSubscriber.setPublisher(publisher);
  });

  afterEach(() => {
    IdentityCacheInvalidationSubscriber.clearPublisher();
    jest.restoreAllMocks();
  });

  // --- success path (pins existing behaviour) -----------------------------

  it('publishes the queued event on afterTransactionCommit', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u-1', roleId: 'r-1' }, qr),
    );
    // Nothing published yet — the transaction has not committed.
    await Promise.resolve();
    expect(publishCalls).toEqual([]);

    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    // Publish is async; flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toEqual([
      {
        topic: 'identity.user-role.changed',
        payload: { userIds: ['u-1'], roleIds: ['r-1'] },
      },
    ]);
  });

  // --- the F043 test: rollback must NOT publish ---------------------------

  it('does NOT publish when the transaction rolls back', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u-rollback', roleId: 'r-rollback' }, qr),
    );
    subscriber.afterUpdate(
      makeUpdateEvent(RolePermission, { roleId: 'r-rollback' }, qr),
    );
    subscriber.afterRemove(
      makeRemoveEvent(
        GroupMember,
        { userId: 'u-rollback', groupId: 'g-rollback' },
        undefined,
        qr,
      ),
    );

    subscriber.afterTransactionRollback(makeTransactionEvent(qr));
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toEqual([]);
    expect(publisher.publish).not.toHaveBeenCalled();

    // A subsequent commit on the same QueryRunner (e.g. it was recycled
    // by the pool and reused) must not replay the rolled-back queue.
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await Promise.resolve();
    await Promise.resolve();
    expect(publishCalls).toEqual([]);
  });

  // --- queue accumulation -------------------------------------------------

  it('publishes all events accumulated during a single transaction on commit', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u-a', roleId: 'r-a' }, qr),
    );
    subscriber.afterUpdate(
      makeUpdateEvent(RolePermission, { roleId: 'r-b' }, qr),
    );
    subscriber.afterInsert(
      makeInsertEvent(GroupRole, { groupId: 'g-1', roleId: 'r-c' }, qr),
    );
    subscriber.afterInsert(
      makeInsertEvent(GroupMember, { userId: 'u-d', groupId: 'g-d' }, qr),
    );

    expect(publishCalls).toEqual([]);

    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toHaveLength(4);
    expect(publishCalls.map((c) => c.topic)).toEqual([
      'identity.user-role.changed',
      'identity.role-permission.changed',
      'identity.role-permission.changed',
      'identity.group-membership.changed',
    ]);
    expect(publishCalls[0].payload).toEqual({
      userIds: ['u-a'],
      roleIds: ['r-a'],
    });
    expect(publishCalls[1].payload).toEqual({ roleIds: ['r-b'] });
    expect(publishCalls[2].payload).toEqual({ roleIds: ['r-c'] });
    expect(publishCalls[3].payload).toEqual({
      userIds: ['u-d'],
      groupIds: ['g-d'],
    });
  });

  // --- WeakMap isolation between concurrent transactions ------------------

  it('keeps queues isolated across concurrent transactions (WeakMap per QueryRunner)', async () => {
    const qrA = makeQueryRunner(true);
    const qrB = makeQueryRunner(true);

    // Interleaved writes on two transactions.
    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u-A', roleId: 'r-A' }, qrA),
    );
    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u-B', roleId: 'r-B' }, qrB),
    );
    subscriber.afterUpdate(
      makeUpdateEvent(RolePermission, { roleId: 'r-A2' }, qrA),
    );
    subscriber.afterUpdate(
      makeUpdateEvent(RolePermission, { roleId: 'r-B2' }, qrB),
    );

    // qrA commits, qrB rolls back. Only qrA's events should publish.
    subscriber.afterTransactionCommit(makeTransactionEvent(qrA));
    subscriber.afterTransactionRollback(makeTransactionEvent(qrB));
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toHaveLength(2);
    expect(publishCalls[0]).toEqual({
      topic: 'identity.user-role.changed',
      payload: { userIds: ['u-A'], roleIds: ['r-A'] },
    });
    expect(publishCalls[1]).toEqual({
      topic: 'identity.role-permission.changed',
      payload: { roleIds: ['r-A2'] },
    });
  });

  it('does not cross-publish when qrB commits after qrA already committed', async () => {
    const qrA = makeQueryRunner(true);
    const qrB = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u-A', roleId: 'r-A' }, qrA),
    );
    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u-B', roleId: 'r-B' }, qrB),
    );

    subscriber.afterTransactionCommit(makeTransactionEvent(qrA));
    await Promise.resolve();
    await Promise.resolve();
    expect(publishCalls).toHaveLength(1);
    expect(publishCalls[0].payload).toEqual({
      userIds: ['u-A'],
      roleIds: ['r-A'],
    });

    subscriber.afterTransactionCommit(makeTransactionEvent(qrB));
    await Promise.resolve();
    await Promise.resolve();
    expect(publishCalls).toHaveLength(2);
    expect(publishCalls[1].payload).toEqual({
      userIds: ['u-B'],
      roleIds: ['r-B'],
    });
  });

  // --- publish failure handling -------------------------------------------

  it('logs (does not throw) when publish fails after commit', async () => {
    const qr = makeQueryRunner(true);
    const errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const boom = new Error('event bus down');
    publisher = {
      publish: jest.fn(async () => {
        throw boom;
      }),
    };
    IdentityCacheInvalidationSubscriber.setPublisher(publisher);

    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u-1', roleId: 'r-1' }, qr),
    );

    // The commit hook must not throw, even though publish rejects.
    expect(() =>
      subscriber.afterTransactionCommit(makeTransactionEvent(qr)),
    ).not.toThrow();

    // The publish rejection is handled asynchronously by .catch — flush.
    await Promise.resolve();
    await Promise.resolve();

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalled();
    const firstCall = errorLog.mock.calls[0];
    expect(String(firstCall[0])).toContain(
      'Failed to publish identity.user-role.changed after commit',
    );
    expect(String(firstCall[0])).toContain('event bus down');
  });

  // --- non-transactional writes still publish -----------------------------

  it('publishes inline when the write is not inside a transaction', async () => {
    const qr = makeQueryRunner(false);

    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u-direct', roleId: 'r-direct' }, qr),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toEqual([
      {
        topic: 'identity.user-role.changed',
        payload: { userIds: ['u-direct'], roleIds: ['r-direct'] },
      },
    ]);
  });

  // --- pre-bootstrap (no publisher wired) ---------------------------------

  it('drops queued events silently when no publisher is wired at commit time', async () => {
    const qr = makeQueryRunner(true);
    IdentityCacheInvalidationSubscriber.clearPublisher();

    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u', roleId: 'r' }, qr),
    );
    // Commit must not throw even with no publisher.
    expect(() =>
      subscriber.afterTransactionCommit(makeTransactionEvent(qr)),
    ).not.toThrow();
    await Promise.resolve();
    expect(publishCalls).toEqual([]);
  });

  // --- entity-type routing on the deferred path ---------------------------

  it('routes each entity type to the correct topic on commit', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(UserRole, { userId: 'u1', roleId: 'r1' }, qr),
    );
    subscriber.afterInsert(
      makeInsertEvent(RolePermission, { roleId: 'r2', permissionId: 'p1' }, qr),
    );
    subscriber.afterInsert(
      makeInsertEvent(GroupRole, { groupId: 'g1', roleId: 'r3' }, qr),
    );
    subscriber.afterInsert(
      makeInsertEvent(GroupMember, { userId: 'u2', groupId: 'g2' }, qr),
    );
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls.map((c) => c.topic)).toEqual([
      'identity.user-role.changed',
      'identity.role-permission.changed',
      'identity.role-permission.changed',
      'identity.group-membership.changed',
    ]);
  });

  it('ignores entities of unrelated types', async () => {
    const qr = makeQueryRunner(true);
    class Unrelated {}

    subscriber.afterInsert(
      makeInsertEvent(Unrelated, { userId: 'u', roleId: 'r' }, qr),
    );
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await Promise.resolve();

    expect(publishCalls).toEqual([]);
  });

  it('falls back to databaseEntity on remove when entity is undefined', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterRemove(
      makeRemoveEvent(
        UserRole,
        undefined,
        { userId: 'u-db', roleId: 'r-db' },
        qr,
      ),
    );
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await Promise.resolve();
    await Promise.resolve();

    expect(publishCalls).toEqual([
      {
        topic: 'identity.user-role.changed',
        payload: { userIds: ['u-db'], roleIds: ['r-db'] },
      },
    ]);
  });
});
