import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CollectionDefinition,
  InstanceEventOutbox,
  PropertyDefinition,
} from '@hubblewave/instance-db';
import { RollupService } from '../formula/rollup.service';

/**
 * Plan §6.5 — outbox processor for `computed.rollup.recompute` events
 * enqueued by `ComputedPropertyDispatcher`. Without this, rollup
 * recompute events sit at status='pending' forever and parent
 * rollup columns never refresh when child records change.
 *
 * The processor mirrors the pattern in
 * `apps/svc-automation/runtime/outbox-processor.service.ts`:
 * setInterval poll, claim a batch via `FOR UPDATE SKIP LOCKED`,
 * dispatch each event, mark processed/failed. The two services
 * coexist by claiming distinct event_type prefixes — that processor
 * claims `record.%` only; this one claims `computed.%`.
 *
 * Debounce: dispatcher writes a `debounceKey` of `<parentId>:<propId>`
 * on each event. The processor coalesces events with the same key
 * by keeping only the most recent one (the older entries are marked
 * `processed` without recomputing, since the latest event will pick
 * up all in-flight changes).
 */
interface RollupRecomputePayload {
  parentCollectionCode?: string | null;
  parentId: string;
  rollupPropertyId: string;
  rollupPropertyCode: string;
  childCollectionCode: string;
  debounceKey: string;
}

@Injectable()
export class ComputedOutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComputedOutboxProcessor.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly lockTimeoutMs: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly rollupService: RollupService,
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
  ) {
    this.batchSize = parseInt(
      this.configService.get('COMPUTED_OUTBOX_BATCH_SIZE', '20'),
      10,
    );
    this.pollIntervalMs = parseInt(
      this.configService.get('COMPUTED_OUTBOX_POLL_MS', '3000'),
      10,
    );
    this.lockTimeoutMs = parseInt(
      this.configService.get('COMPUTED_OUTBOX_LOCK_TIMEOUT_MS', '60000'),
      10,
    );
  }

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const entries = await this.claimPending();
      if (entries.length === 0) return;

      // Debounce: group claimed events by debounceKey, process the
      // most recent per key, mark older entries `processed` without
      // recomputing (the latest event picks up all changes).
      const grouped = new Map<string, typeof entries>();
      for (const entry of entries) {
        const payload = entry.payload as unknown as RollupRecomputePayload;
        const key = payload.debounceKey ?? entry.id;
        const list = grouped.get(key) ?? [];
        list.push(entry);
        grouped.set(key, list);
      }

      for (const list of grouped.values()) {
        list.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
        const stale = list.slice(0, -1);
        const latest = list[list.length - 1];
        for (const e of stale) {
          await this.markProcessed(e.id);
        }
        try {
          await this.dispatch(latest.payload as unknown as RollupRecomputePayload);
          await this.markProcessed(latest.id);
        } catch (error) {
          await this.markFailed(latest.id, (error as Error).message);
        }
      }
    } catch (error) {
      this.logger.error(`Computed outbox poll failed: ${(error as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Recompute a parent record's rollup column. Two layers of
   * resolution before dispatch:
   *
   *  1. **Collection code → table name**: `RollupService` queries
   *     `public."<sourceCollection>"` directly, but the rollup
   *     property's config carries a Collection CODE (e.g. `order_lines`),
   *     not a TABLE NAME (`u_order_lines` for custom collections). We
   *     resolve via `CollectionDefinition` so the SQL hits the right
   *     table.
   *
   *  2. **Property code → column name**: same problem for
   *     `relationProperty` and `aggregateProperty`. `PropertyDefinition.columnName`
   *     is the actual SQL column (often `<code>_id` for references).
   *     `getRelatedRecords` queries `t."<relationProperty>" = …` and
   *     reads `r[<aggregateProperty>]` from the result — both must
   *     be column names, not property codes.
   *
   *  Without these resolutions, every rollup calls SQL like
   *  `SELECT FROM public."order_lines"` and computes 0/empty on every
   *  custom collection.
   */
  private async dispatch(payload: RollupRecomputePayload): Promise<void> {
    const property = await this.propertyRepo.findOne({
      where: { id: payload.rollupPropertyId },
    });
    if (!property) {
      throw new Error(`Rollup property ${payload.rollupPropertyId} not found`);
    }

    const config = (property.config as {
      sourceCollection?: string;
      relationProperty?: string;
      aggregateProperty?: string;
      aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last';
    } | null) ?? {};
    if (!config.sourceCollection || !config.relationProperty || !config.aggregation) {
      throw new Error(
        `Rollup property ${property.code} is missing config (sourceCollection / relationProperty / aggregation)`,
      );
    }

    const parent = await this.collectionRepo.findOne({
      where: { id: property.collectionId },
    });
    if (!parent) {
      throw new Error(`Parent collection ${property.collectionId} not found`);
    }

    // Resolve source collection code → table name.
    const sourceCollectionDef = await this.collectionRepo.findOne({
      where: { code: config.sourceCollection },
    });
    if (!sourceCollectionDef) {
      throw new Error(
        `Rollup property ${property.code} references missing source collection "${config.sourceCollection}"`,
      );
    }

    // Resolve property codes → column names on the SOURCE collection.
    const sourceProperties = await this.dataSource
      .getRepository(PropertyDefinition)
      .find({ where: { collectionId: sourceCollectionDef.id } });
    const relationColumn = sourceProperties.find((p) => p.code === config.relationProperty)?.columnName
      ?? config.relationProperty;
    const aggregateColumn = config.aggregateProperty
      ? (sourceProperties.find((p) => p.code === config.aggregateProperty)?.columnName ?? config.aggregateProperty)
      : 'id';

    const result = await this.rollupService.calculateRollup(
      parent.code,
      payload.parentId,
      {
        // RollupService treats these as raw identifiers in
        // `public."<sourceCollection>"."<relationProperty>"` queries,
        // so we pass already-resolved table/column names.
        sourceCollection: sourceCollectionDef.tableName,
        relationProperty: relationColumn,
        aggregateProperty: aggregateColumn,
        aggregation: config.aggregation,
      } as never,
      // Privileged system context. `RollupService.calculateRollup`
      // calls `AuthorizationService.canAccessTable`, whose only
      // bypass is `ctx.isAdmin`. Without that flag a synthetic
      // 'system' role gets ACL-checked like any user and the
      // canonical rollup computes as 0/null when no role grant
      // happens to permit read access. Background derived-value
      // recomputes need true platform-admin access.
      {
        userId: 'system',
        username: 'system',
        isAdmin: true,
        permissions: ['platform.bypass_authz'],
        roles: [],
      } as never,
    );

    if (!result.success) {
      throw new Error(`Rollup recalculation failed: ${result.error}`);
    }

    // Persist the computed value. Direct UPDATE on only the rollup
    // column, no automation re-trigger (rollups are a derived value;
    // mutating them is not a record edit).
    const column = property.columnName ?? property.code;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parent.tableName) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error('Refusing UPDATE with non-identifier table or column name');
    }
    await this.dataSource.query(
      `UPDATE "${parent.tableName}" SET "${column}" = $1 WHERE id = $2`,
      [result.value, payload.parentId],
    );
  }

  private async claimPending(): Promise<
    Array<{ id: string; event_type: string; payload: Record<string, unknown>; created_at: Date }>
  > {
    const lockCutoff = new Date(Date.now() - this.lockTimeoutMs).toISOString();
    const query = `
      UPDATE instance_event_outbox
      SET status = 'processing', locked_at = NOW(), attempts = attempts + 1
      WHERE id IN (
        SELECT id
        FROM instance_event_outbox
        WHERE status = 'pending'
          AND (locked_at IS NULL OR locked_at < $1)
          AND event_type LIKE 'computed.%'
        ORDER BY created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, event_type, payload, created_at
    `;
    const rows = (await this.dataSource.query(query, [lockCutoff, this.batchSize])) as Array<{
      id: string;
      event_type: string;
      payload: Record<string, unknown>;
      created_at: Date | string;
    }>;
    // Postgres returns `created_at` as a Date when TypeORM's
    // raw-driver type parsers are configured; some configurations
    // pass through as ISO strings. Normalize to Date so the
    // debounce sort always sees a comparable value rather than
    // NaN from `(string).getTime()`.
    return (rows ?? []).map((row) => ({
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    }));
  }

  private async markProcessed(id: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(InstanceEventOutbox)
      .set({
        status: 'processed',
        processedAt: new Date(),
        lockedAt: null,
        errorMessage: null,
      })
      .where('id = :id', { id })
      .execute();
  }

  private async markFailed(id: string, message: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(InstanceEventOutbox)
      .set({
        status: 'failed',
        processedAt: new Date(),
        lockedAt: null,
        errorMessage: message,
      })
      .where('id = :id', { id })
      .execute();
  }
}
