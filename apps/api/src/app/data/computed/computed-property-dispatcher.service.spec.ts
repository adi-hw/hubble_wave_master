import { ComputedPropertyDispatcher } from './computed-property-dispatcher.service';

describe('ComputedPropertyDispatcher — Phase 1 §6.5 wire-through', () => {
  const buildDeps = () => {
    const formulaService = {
      evaluateComputedProperties: jest.fn().mockResolvedValue({ price_total: 99 }),
    };
    const lookupService = { resolveAllLookups: jest.fn().mockResolvedValue({}) };
    const hierarchicalService = { reparent: jest.fn().mockResolvedValue(undefined) };
    // Chainable QueryBuilder mock — the SUT's enqueueRollupRecompute uses
    // createQueryBuilder().where().andWhere().andWhere().getCount() to skip
    // duplicate pending recomputes. Returning 0 lets the save proceed.
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    const outboxRepo = {
      create: jest.fn().mockImplementation((p) => p),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
    };
    const runtimeAnomalyService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const dispatcher = new ComputedPropertyDispatcher(
      formulaService as never,
      lookupService as never,
      hierarchicalService as never,
      outboxRepo as never,
      dataSource as never,
      runtimeAnomalyService as never,
    );
    return { dispatcher, formulaService, lookupService, hierarchicalService, outboxRepo, dataSource, runtimeAnomalyService };
  };

  const ctx = { userId: 'user-1' };

  it('skips dispatch when the collection has no computed properties', async () => {
    const { dispatcher, formulaService, outboxRepo } = buildDeps();
    const result = await dispatcher.applyOnSave({
      ctx,
      collectionCode: 'orders',
      tableName: 'u_orders',
      properties: [
        { id: 'p1', code: 'name', propertyType: { code: 'string' } } as never,
      ],
      recordId: 'r1',
      record: { id: 'r1', name: 'A' },
      operation: 'create',
    });
    expect(result).toEqual({ id: 'r1', name: 'A' });
    expect(formulaService.evaluateComputedProperties).not.toHaveBeenCalled();
    expect(outboxRepo.save).not.toHaveBeenCalled();
  });

  it('evaluates a formula property and merges the result back onto the record', async () => {
    const { dispatcher, formulaService } = buildDeps();
    const result = await dispatcher.applyOnSave({
      ctx,
      collectionCode: 'orders',
      tableName: 'u_orders',
      properties: [
        { id: 'pt', code: 'price_total', propertyType: { code: 'formula' }, config: {} } as never,
      ],
      recordId: 'r1',
      record: { id: 'r1', qty: 3, unit_price: 33 },
      operation: 'create',
    });
    expect(formulaService.evaluateComputedProperties).toHaveBeenCalledTimes(1);
    expect(result.price_total).toBe(99);
  });

  it('enqueues a rollup recompute for the parent on a child save (debounce key by parentId+propertyId)', async () => {
    const { dispatcher, outboxRepo } = buildDeps();
    await dispatcher.applyOnSave({
      ctx,
      collectionCode: 'order_lines',
      tableName: 'u_order_lines',
      properties: [
        {
          id: 'pr',
          code: 'line_count',
          propertyType: { code: 'rollup' },
          config: { sourceCollection: 'orders', relationProperty: 'order_id' },
        } as never,
      ],
      recordId: 'line-1',
      record: { id: 'line-1', order_id: 'order-7' },
      operation: 'create',
    });
    expect(outboxRepo.save).toHaveBeenCalledTimes(1);
    const enqueued = outboxRepo.save.mock.calls[0][0];
    expect(enqueued.eventType).toBe('computed.rollup.recompute');
    expect(enqueued.payload.parentId).toBe('order-7');
    expect(enqueued.payload.debounceKey).toBe('order-7:pr');
  });

  it('skips hierarchical reparent when the parent reference is unchanged on update', async () => {
    const { dispatcher, hierarchicalService } = buildDeps();
    await dispatcher.applyOnSave({
      ctx,
      collectionCode: 'departments',
      tableName: 'u_departments',
      properties: [
        {
          id: 'ph',
          code: 'path',
          propertyType: { code: 'hierarchical' },
          config: { parentProperty: 'parent' },
        } as never,
      ],
      recordId: 'dept-1',
      record: { id: 'dept-1', parent: 'dept-root' },
      priorParentId: 'dept-root',
      operation: 'update',
    });
    expect(hierarchicalService.reparent).not.toHaveBeenCalled();
  });

  it('reparents on a hierarchical parent change', async () => {
    const { dispatcher, hierarchicalService } = buildDeps();
    await dispatcher.applyOnSave({
      ctx,
      collectionCode: 'departments',
      tableName: 'u_departments',
      properties: [
        {
          id: 'ph',
          code: 'path',
          propertyType: { code: 'hierarchical' },
          config: { parentProperty: 'parent' },
        } as never,
      ],
      recordId: 'dept-1',
      record: { id: 'dept-1', parent: 'dept-new' },
      priorParentId: 'dept-old',
      operation: 'update',
    });
    expect(hierarchicalService.reparent).toHaveBeenCalledTimes(1);
    const [hierCtx, recordId, newParentId] = hierarchicalService.reparent.mock.calls[0];
    expect(hierCtx).toMatchObject({ tableName: 'u_departments' });
    expect(recordId).toBe('dept-1');
    expect(newParentId).toBe('dept-new');
  });

  it('discovers parent-collection rollups on child save and enqueues a recompute against the parent record id', async () => {
    const { dispatcher, outboxRepo, dataSource } = buildDeps();
    // Simulate a parent rollup `orders.line_count` whose
    // sourceCollection points at `order_lines`.
    (dataSource.query as jest.Mock).mockResolvedValueOnce([
      {
        property_id: 'parent-rollup-id',
        property_code: 'line_count',
        collection_id: 'orders-coll-id',
        relation_property: 'order_id',
      },
    ]);
    await dispatcher.applyOnSave({
      ctx,
      collectionCode: 'order_lines',
      tableName: 'u_order_lines',
      // Critically: the saved CHILD collection has NO computed
      // properties of its own.
      properties: [{ id: 'p1', code: 'name', propertyType: { code: 'string' } } as never],
      recordId: 'line-77',
      record: { id: 'line-77', order_id: 'order-42', name: 'Widget' },
      operation: 'create',
    });
    expect(outboxRepo.save).toHaveBeenCalledTimes(1);
    const enqueued = outboxRepo.save.mock.calls[0][0];
    expect(enqueued.eventType).toBe('computed.rollup.recompute');
    expect(enqueued.payload.parentId).toBe('order-42');
    expect(enqueued.payload.rollupPropertyId).toBe('parent-rollup-id');
    expect(enqueued.payload.debounceKey).toBe('order-42:parent-rollup-id');
  });

  it('logs and continues when one computed property handler throws (other properties still apply)', async () => {
    const { dispatcher, formulaService, lookupService } = buildDeps();
    formulaService.evaluateComputedProperties.mockRejectedValueOnce(new Error('formula boom'));
    lookupService.resolveAllLookups.mockResolvedValueOnce({ lookup_field: 'resolved' });
    const result = await dispatcher.applyOnSave({
      ctx,
      collectionCode: 'orders',
      tableName: 'u_orders_combined',
      properties: [
        { id: 'p1', code: 'broken_formula', propertyType: { code: 'formula' }, config: {} } as never,
        { id: 'p2', code: 'lookup_field', propertyType: { code: 'lookup' }, config: {} } as never,
      ],
      recordId: 'r1',
      record: { id: 'r1' },
      operation: 'create',
    });
    expect(result.lookup_field).toBe('resolved');
    expect(result.broken_formula).toBeUndefined();
  });
});
