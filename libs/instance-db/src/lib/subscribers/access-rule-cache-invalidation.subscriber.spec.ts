import { Logger } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';

import { CollectionAccessRule, PropertyAccessRule } from '../entities/access-rule.entity';
import { PropertyDefinition } from '../entities/property-definition.entity';
import {
  AccessRuleCacheInvalidationPublisher,
  AccessRuleCacheInvalidationSubscriber,
} from './access-rule-cache-invalidation.subscriber';

/**
 * F025: tests for the TypeORM subscriber that fires permission-cache
 * invalidation when a CollectionAccessRule or PropertyAccessRule changes.
 *
 * Follows the F043 pattern (queue-on-insert/update/remove, drain on
 * commit, drop on rollback) and mirrors the structure of
 * `identity-cache-invalidation.subscriber.spec.ts`.
 *
 * The QueryRunner is a fake whose `manager.findOne` is wired per-test so
 * we can exercise the property-rule -> collectionId resolution path
 * without booting a real TypeORM data source.
 */
describe('AccessRuleCacheInvalidationSubscriber (F025)', () => {
  let subscriber: AccessRuleCacheInvalidationSubscriber;
  let publisher: AccessRuleCacheInvalidationPublisher;
  let collectionCalls: Array<Parameters<AccessRuleCacheInvalidationPublisher['invalidateCollectionRules']>[0]>;
  let propertyCalls: Array<Parameters<AccessRuleCacheInvalidationPublisher['invalidatePropertyRules']>[0]>;

  /**
   * A QueryRunner stub. `manager.findOne` returns whichever PropertyDefinition
   * shape the test wired up; defaults to a permissive resolver that maps any
   * propertyId to `coll-from-prop`.
   */
  function makeQueryRunner(
    transactionActive: boolean,
    overrides: {
      propertyToCollection?: Record<string, string | null>;
      findOneThrows?: Error;
    } = {},
  ): QueryRunner {
    const findOne = jest.fn(async (entity: unknown, opts: { where: { id: string } }) => {
      if (overrides.findOneThrows) {
        throw overrides.findOneThrows;
      }
      if (entity !== PropertyDefinition) {
        return null;
      }
      const map = overrides.propertyToCollection;
      if (map) {
        const collectionId = map[opts.where.id];
        return collectionId ? { id: opts.where.id, collectionId } : null;
      }
      return { id: opts.where.id, collectionId: 'coll-from-prop' };
    });
    return {
      isTransactionActive: transactionActive,
      manager: { findOne },
    } as unknown as QueryRunner;
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

  /** Settle every pending microtask the dispatcher uses. */
  async function flushMicrotasks(): Promise<void> {
    // Three turns cover: queueing -> dispatch promise -> publisher onError catch.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    collectionCalls = [];
    propertyCalls = [];
    publisher = {
      invalidateCollectionRules: jest.fn(async (event) => {
        collectionCalls.push(event);
      }),
      invalidatePropertyRules: jest.fn(async (event) => {
        propertyCalls.push(event);
      }),
    };
    subscriber = new AccessRuleCacheInvalidationSubscriber();
    AccessRuleCacheInvalidationSubscriber.setPublisher(publisher);
  });

  afterEach(() => {
    AccessRuleCacheInvalidationSubscriber.clearPublisher();
    jest.restoreAllMocks();
  });

  // ─── collection rules ────────────────────────────────────────────────

  it('publishes invalidateCollectionRules on CollectionAccessRule insert after commit', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(
        CollectionAccessRule,
        { id: 'rule-1', collectionId: 'coll-A' },
        qr,
      ),
    );

    // No publish until commit.
    await flushMicrotasks();
    expect(collectionCalls).toEqual([]);

    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(collectionCalls).toEqual([
      { collectionId: 'coll-A', operation: 'insert', ruleId: 'rule-1' },
    ]);
  });

  it('publishes invalidateCollectionRules on CollectionAccessRule update after commit', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterUpdate(
      makeUpdateEvent(
        CollectionAccessRule,
        { id: 'rule-2', collectionId: 'coll-B' },
        qr,
      ),
    );
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(collectionCalls).toEqual([
      { collectionId: 'coll-B', operation: 'update', ruleId: 'rule-2' },
    ]);
  });

  it('publishes invalidateCollectionRules on CollectionAccessRule remove after commit', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterRemove(
      makeRemoveEvent(
        CollectionAccessRule,
        { id: 'rule-3', collectionId: 'coll-C' },
        undefined,
        qr,
      ),
    );
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(collectionCalls).toEqual([
      { collectionId: 'coll-C', operation: 'remove', ruleId: 'rule-3' },
    ]);
  });

  it('falls back to databaseEntity on remove when entity is undefined', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterRemove(
      makeRemoveEvent(
        CollectionAccessRule,
        undefined,
        { id: 'rule-db', collectionId: 'coll-D' },
        qr,
      ),
    );
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(collectionCalls).toEqual([
      { collectionId: 'coll-D', operation: 'remove', ruleId: 'rule-db' },
    ]);
  });

  // ─── property rules ──────────────────────────────────────────────────

  it('resolves propertyId -> collectionId via queryRunner.manager and publishes after commit', async () => {
    const qr = makeQueryRunner(true, {
      propertyToCollection: { 'prop-1': 'coll-from-lookup' },
    });

    subscriber.afterInsert(
      makeInsertEvent(
        PropertyAccessRule,
        { id: 'prule-1', propertyId: 'prop-1' },
        qr,
      ),
    );
    // The resolution is async — let it complete before commit so the event
    // makes it into the queue.
    await flushMicrotasks();
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(propertyCalls).toEqual([
      {
        collectionId: 'coll-from-lookup',
        operation: 'insert',
        propertyId: 'prop-1',
        ruleId: 'prule-1',
      },
    ]);
    expect(qr.manager.findOne).toHaveBeenCalledWith(
      PropertyDefinition,
      expect.objectContaining({ where: { id: 'prop-1' } }),
    );
  });

  it('publishes property invalidation on update + remove', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterUpdate(
      makeUpdateEvent(
        PropertyAccessRule,
        { id: 'prule-2', propertyId: 'prop-2' },
        qr,
      ),
    );
    subscriber.afterRemove(
      makeRemoveEvent(
        PropertyAccessRule,
        { id: 'prule-3', propertyId: 'prop-3' },
        undefined,
        qr,
      ),
    );
    await flushMicrotasks();
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(propertyCalls.map((c) => c.operation)).toEqual(['update', 'remove']);
    expect(propertyCalls.every((c) => c.collectionId === 'coll-from-prop')).toBe(true);
  });

  it('uses a preloaded property relation when available (no extra findOne)', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(
        PropertyAccessRule,
        {
          id: 'prule-eager',
          propertyId: 'prop-X',
          property: { id: 'prop-X', collectionId: 'coll-eager' },
        },
        qr,
      ),
    );
    await flushMicrotasks();
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(propertyCalls).toEqual([
      {
        collectionId: 'coll-eager',
        operation: 'insert',
        propertyId: 'prop-X',
        ruleId: 'prule-eager',
      },
    ]);
    expect(qr.manager.findOne).not.toHaveBeenCalled();
  });

  it('skips and warns when propertyId cannot be resolved to a collection', async () => {
    const qr = makeQueryRunner(true, {
      propertyToCollection: { 'prop-missing': null },
    });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    subscriber.afterInsert(
      makeInsertEvent(
        PropertyAccessRule,
        { id: 'prule-skip', propertyId: 'prop-missing' },
        qr,
      ),
    );
    await flushMicrotasks();
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(propertyCalls).toEqual([]);
    expect(warn).toHaveBeenCalled();
    const firstCall = warn.mock.calls[0];
    expect(String(firstCall[0])).toContain('Could not resolve collectionId');
  });

  it('catches findOne errors and skips invalidation (best-effort)', async () => {
    const qr = makeQueryRunner(true, {
      findOneThrows: new Error('PG connection lost'),
    });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    subscriber.afterUpdate(
      makeUpdateEvent(
        PropertyAccessRule,
        { id: 'prule-boom', propertyId: 'prop-boom' },
        qr,
      ),
    );
    await flushMicrotasks();
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(propertyCalls).toEqual([]);
    expect(warn).toHaveBeenCalled();
    // Two warns: the catch in resolveCollectionId, and the skip in handleChange.
    expect(warn.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  // ─── rollback ────────────────────────────────────────────────────────

  it('does NOT publish when the transaction rolls back', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(
        CollectionAccessRule,
        { id: 'rule-rollback', collectionId: 'coll-rb' },
        qr,
      ),
    );
    subscriber.afterUpdate(
      makeUpdateEvent(
        PropertyAccessRule,
        { id: 'prule-rollback', propertyId: 'prop-rb' },
        qr,
      ),
    );
    await flushMicrotasks();

    subscriber.afterTransactionRollback(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(collectionCalls).toEqual([]);
    expect(propertyCalls).toEqual([]);
    expect(publisher.invalidateCollectionRules).not.toHaveBeenCalled();
    expect(publisher.invalidatePropertyRules).not.toHaveBeenCalled();

    // A subsequent commit on the same QueryRunner must not replay the queue.
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();
    expect(collectionCalls).toEqual([]);
    expect(propertyCalls).toEqual([]);
  });

  // ─── queue accumulation ─────────────────────────────────────────────

  it('drains all events queued during a single transaction on commit', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(CollectionAccessRule, { id: 'r1', collectionId: 'c1' }, qr),
    );
    subscriber.afterInsert(
      makeInsertEvent(CollectionAccessRule, { id: 'r2', collectionId: 'c2' }, qr),
    );
    subscriber.afterUpdate(
      makeUpdateEvent(
        PropertyAccessRule,
        { id: 'pr1', propertyId: 'p1' },
        qr,
      ),
    );
    await flushMicrotasks();

    expect(collectionCalls).toEqual([]);
    expect(propertyCalls).toEqual([]);

    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(collectionCalls).toEqual([
      { collectionId: 'c1', operation: 'insert', ruleId: 'r1' },
      { collectionId: 'c2', operation: 'insert', ruleId: 'r2' },
    ]);
    expect(propertyCalls).toEqual([
      {
        collectionId: 'coll-from-prop',
        operation: 'update',
        propertyId: 'p1',
        ruleId: 'pr1',
      },
    ]);
  });

  // ─── concurrent transactions (WeakMap isolation) ─────────────────────

  it('keeps queues isolated across concurrent transactions (WeakMap per QueryRunner)', async () => {
    const qrA = makeQueryRunner(true);
    const qrB = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(CollectionAccessRule, { id: 'rA', collectionId: 'cA' }, qrA),
    );
    subscriber.afterInsert(
      makeInsertEvent(CollectionAccessRule, { id: 'rB', collectionId: 'cB' }, qrB),
    );
    subscriber.afterUpdate(
      makeUpdateEvent(CollectionAccessRule, { id: 'rA2', collectionId: 'cA' }, qrA),
    );

    // A commits, B rolls back: only A's events should publish.
    subscriber.afterTransactionCommit(makeTransactionEvent(qrA));
    subscriber.afterTransactionRollback(makeTransactionEvent(qrB));
    await flushMicrotasks();

    expect(collectionCalls).toEqual([
      { collectionId: 'cA', operation: 'insert', ruleId: 'rA' },
      { collectionId: 'cA', operation: 'update', ruleId: 'rA2' },
    ]);
  });

  // ─── non-transactional writes (inline publish) ──────────────────────

  it('publishes inline when the write is not inside a transaction', async () => {
    const qr = makeQueryRunner(false);

    subscriber.afterInsert(
      makeInsertEvent(
        CollectionAccessRule,
        { id: 'r-inline', collectionId: 'c-inline' },
        qr,
      ),
    );
    await flushMicrotasks();

    expect(collectionCalls).toEqual([
      { collectionId: 'c-inline', operation: 'insert', ruleId: 'r-inline' },
    ]);
  });

  // ─── publisher unbound ──────────────────────────────────────────────

  it('drops queued events silently when no publisher is wired at commit time', async () => {
    const qr = makeQueryRunner(true);
    AccessRuleCacheInvalidationSubscriber.clearPublisher();

    subscriber.afterInsert(
      makeInsertEvent(CollectionAccessRule, { id: 'r', collectionId: 'c' }, qr),
    );
    expect(() =>
      subscriber.afterTransactionCommit(makeTransactionEvent(qr)),
    ).not.toThrow();
    await flushMicrotasks();

    expect(collectionCalls).toEqual([]);
    expect(propertyCalls).toEqual([]);
  });

  // ─── publisher rejection handling ───────────────────────────────────

  it('logs (does not throw) when publish rejects after commit', async () => {
    const qr = makeQueryRunner(true);
    const errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const boom = new Error('cache store down');
    publisher = {
      invalidateCollectionRules: jest.fn(async () => {
        throw boom;
      }),
      invalidatePropertyRules: jest.fn(async () => undefined),
    };
    AccessRuleCacheInvalidationSubscriber.setPublisher(publisher);

    subscriber.afterInsert(
      makeInsertEvent(CollectionAccessRule, { id: 'r', collectionId: 'c' }, qr),
    );

    expect(() =>
      subscriber.afterTransactionCommit(makeTransactionEvent(qr)),
    ).not.toThrow();

    await flushMicrotasks();

    expect(publisher.invalidateCollectionRules).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalled();
    const firstCall = errorLog.mock.calls[0];
    expect(String(firstCall[0])).toContain('Failed to publish collection-rule invalidation');
    expect(String(firstCall[0])).toContain('cache store down');
  });

  // ─── ignored entity types ───────────────────────────────────────────

  it('ignores entities of unrelated types', async () => {
    const qr = makeQueryRunner(true);
    class Unrelated {}

    subscriber.afterInsert(
      makeInsertEvent(Unrelated, { id: 'x', collectionId: 'c' }, qr),
    );
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(collectionCalls).toEqual([]);
    expect(propertyCalls).toEqual([]);
  });

  it('ignores CollectionAccessRule writes that lack a collectionId', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(CollectionAccessRule, { id: 'r-no-cid' }, qr),
    );
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(collectionCalls).toEqual([]);
  });

  it('ignores PropertyAccessRule writes that lack a propertyId', async () => {
    const qr = makeQueryRunner(true);

    subscriber.afterInsert(
      makeInsertEvent(PropertyAccessRule, { id: 'pr-no-pid' }, qr),
    );
    await flushMicrotasks();
    subscriber.afterTransactionCommit(makeTransactionEvent(qr));
    await flushMicrotasks();

    expect(propertyCalls).toEqual([]);
    expect(qr.manager.findOne).not.toHaveBeenCalled();
  });
});
