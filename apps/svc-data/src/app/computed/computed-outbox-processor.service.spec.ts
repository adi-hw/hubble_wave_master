import { ComputedOutboxProcessor } from './computed-outbox-processor.service';

describe('ComputedOutboxProcessor — Phase 1 §6.5 outbox consumer', () => {
  const buildDeps = () => {
    const claimedRows: Array<{ id: string; event_type: string; payload: unknown; created_at: Date }> = [];
    const updatedRows: Array<{ table: string; values: unknown[] }> = [];
    // Default source-collection properties (relationProperty +
    // aggregateProperty resolution). Tests can override.
    const sourceProperties = [
      { code: 'order_id', columnName: 'order_id_id' },
      { code: 'amount', columnName: 'amount' },
    ];
    const dataSource = {
      query: jest.fn().mockImplementation((sql: string, params: unknown[]) => {
        if (sql.includes('UPDATE instance_event_outbox')) {
          // Returns the claimed batch
          return Promise.resolve(claimedRows);
        }
        if (sql.startsWith('UPDATE "')) {
          updatedRows.push({ table: sql, values: params });
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      })),
      getRepository: jest.fn(() => ({
        find: jest.fn().mockResolvedValue(sourceProperties),
      })),
    };
    const configService = { get: (_k: string, def: string) => def };
    const rollupService = {
      calculateRollup: jest.fn().mockResolvedValue({ success: true, value: 42 }),
    };
    const propertyRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'rollup-prop-1',
        code: 'line_count',
        columnName: 'line_count',
        collectionId: 'col-1',
        config: {
          sourceCollection: 'order_lines',
          relationProperty: 'order_id',
          aggregateProperty: 'id',
          aggregation: 'count',
        },
      }),
    };
    // Two collection lookups happen during dispatch:
    //   1. parent (by id) — returns `orders`
    //   2. source (by code, from rollup config) — returns `order_lines`
    //      with its actual `tableName` for the SQL query.
    const collectionRepo = {
      findOne: jest.fn().mockImplementation((opts: { where?: { id?: string; code?: string } }) => {
        if (opts.where?.id === 'col-1') {
          return Promise.resolve({ id: 'col-1', code: 'orders', tableName: 'u_orders' });
        }
        if (opts.where?.code === 'order_lines') {
          return Promise.resolve({ id: 'col-2', code: 'order_lines', tableName: 'u_order_lines' });
        }
        return Promise.resolve(null);
      }),
    };
    const processor = new ComputedOutboxProcessor(
      dataSource as never,
      configService as never,
      rollupService as never,
      propertyRepo as never,
      collectionRepo as never,
    );
    const seedClaim = (rows: typeof claimedRows): void => {
      claimedRows.length = 0;
      claimedRows.push(...rows);
    };
    return {
      processor,
      dataSource,
      rollupService,
      propertyRepo,
      collectionRepo,
      updatedRows,
      seedClaim,
    };
  };

  it('consumes computed.rollup.recompute, computes the new value, and persists it on the parent', async () => {
    const deps = buildDeps();
    deps.seedClaim([
      {
        id: 'evt-1',
        event_type: 'computed.rollup.recompute',
        payload: {
          parentId: 'order-7',
          rollupPropertyId: 'rollup-prop-1',
          rollupPropertyCode: 'line_count',
          childCollectionCode: 'order_lines',
          debounceKey: 'order-7:rollup-prop-1',
        },
        created_at: new Date(),
      },
    ]);
    await (deps.processor as unknown as { poll(): Promise<void> }).poll();
    expect(deps.rollupService.calculateRollup).toHaveBeenCalledTimes(1);
    expect(deps.updatedRows).toHaveLength(1);
    const update = deps.updatedRows[0];
    expect(update.table).toContain('UPDATE "u_orders"');
    expect(update.values[0]).toBe(42);
    expect(update.values[1]).toBe('order-7');
  });

  it('resolves sourceCollection code → tableName and relationProperty code → columnName before calling RollupService', async () => {
    const deps = buildDeps();
    deps.seedClaim([
      {
        id: 'evt-1',
        event_type: 'computed.rollup.recompute',
        payload: {
          parentId: 'order-7',
          rollupPropertyId: 'rollup-prop-1',
          rollupPropertyCode: 'line_count',
          childCollectionCode: 'order_lines',
          debounceKey: 'order-7:rollup-prop-1',
        },
        created_at: new Date(),
      },
    ]);
    await (deps.processor as unknown as { poll(): Promise<void> }).poll();
    expect(deps.rollupService.calculateRollup).toHaveBeenCalledTimes(1);
    const callArgs = deps.rollupService.calculateRollup.mock.calls[0];
    const config = callArgs[2] as {
      sourceCollection: string;
      relationProperty: string;
      aggregateProperty: string;
    };
    // sourceCollection is now the actual TABLE NAME, not the code.
    expect(config.sourceCollection).toBe('u_order_lines');
    // relationProperty is the actual COLUMN NAME on the source table.
    expect(config.relationProperty).toBe('order_id_id');
  });

  it('debounces by debounceKey — only the latest event per key triggers a recompute', async () => {
    const deps = buildDeps();
    const earlier = new Date(Date.now() - 1000);
    const later = new Date();
    deps.seedClaim([
      {
        id: 'evt-stale',
        event_type: 'computed.rollup.recompute',
        payload: {
          parentId: 'order-7',
          rollupPropertyId: 'rollup-prop-1',
          rollupPropertyCode: 'line_count',
          childCollectionCode: 'order_lines',
          debounceKey: 'order-7:rollup-prop-1',
        },
        created_at: earlier,
      },
      {
        id: 'evt-latest',
        event_type: 'computed.rollup.recompute',
        payload: {
          parentId: 'order-7',
          rollupPropertyId: 'rollup-prop-1',
          rollupPropertyCode: 'line_count',
          childCollectionCode: 'order_lines',
          debounceKey: 'order-7:rollup-prop-1',
        },
        created_at: later,
      },
    ]);
    await (deps.processor as unknown as { poll(): Promise<void> }).poll();
    // Only one rollup computation despite two queued events for the
    // same debounce key.
    expect(deps.rollupService.calculateRollup).toHaveBeenCalledTimes(1);
  });

  it('marks an event failed when the rollup property is missing', async () => {
    const deps = buildDeps();
    (deps.propertyRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
    deps.seedClaim([
      {
        id: 'evt-orphan',
        event_type: 'computed.rollup.recompute',
        payload: {
          parentId: 'order-7',
          rollupPropertyId: 'never-existed',
          rollupPropertyCode: 'whatever',
          childCollectionCode: 'order_lines',
          debounceKey: 'k',
        },
        created_at: new Date(),
      },
    ]);
    await (deps.processor as unknown as { poll(): Promise<void> }).poll();
    expect(deps.rollupService.calculateRollup).not.toHaveBeenCalled();
  });
});
