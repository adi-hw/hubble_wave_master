import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InstanceEventOutbox, PropertyDefinition } from '@hubblewave/instance-db';
import { DataSource, Repository } from 'typeorm';
import { FormulaService } from '../formula/formula.service';
import { LookupService } from '../formula/lookup.service';
import { HierarchicalService } from '../formula/hierarchical.service';

/**
 * Plan §6.5 — computed property dispatcher.
 *
 * The orchestration layer that wires the per-type computed-property
 * services (Formula / Rollup / Lookup / Hierarchical — implemented
 * under `apps/api/src/app/data/formula/`) into the record save
 * pipeline. Per-type semantics:
 *
 * - **formula** — synchronous on save, sandbox-evaluated. Result is
 *   merged back onto the record before the SQL UPDATE that returns
 *   the saved row to the caller.
 *
 * - **rollup** — async via the outbox. We DON'T recompute the
 *   parent's rollup synchronously on the child save (per §6.5's "via
 *   outbox; debounce-by-`(parentId, rollupPropertyId)`"). The
 *   debounce key in the outbox payload lets the rollup processor
 *   coalesce repeated child saves before issuing a single recompute.
 *
 * - **lookup** — synchronous, RLS-aware. Resolves the referenced
 *   record's field via `LookupService.resolveAllLookups` (which
 *   honors the caller's authz). Writes back to the record.
 *
 * - **hierarchical** — maintains the path column on save when the
 *   parent reference changes. Uses `HierarchicalService.reparent`
 *   which performs cycle detection.
 *
 * The dispatcher is invoked from `CollectionDataService.create` and
 * `CollectionDataService.update` AFTER SQL commit but BEFORE the
 * caller-visible record is returned. Errors are logged but not
 * propagated when a single computed property fails — a broken
 * formula on one property must not corrupt the rest of the save.
 * Hard validation lives upstream in `ValidationService`.
 */
@Injectable()
export class ComputedPropertyDispatcher {
  private readonly logger = new Logger(ComputedPropertyDispatcher.name);

  constructor(
    private readonly formulaService: FormulaService,
    private readonly lookupService: LookupService,
    private readonly hierarchicalService: HierarchicalService,
    @InjectRepository(InstanceEventOutbox)
    private readonly outboxRepo: Repository<InstanceEventOutbox>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Apply every computed property executor relevant to this save.
   *
   * `record` is the post-commit row (i.e. what the caller will see).
   * `priorParentId` is the previous hierarchical parent before the
   * save, used by `hierarchical.reparent` to detect a parent change.
   * Pass `undefined` on create.
   *
   * Returns the merged record. The caller writes the merged row back
   * to the database in a follow-up UPDATE (a small additional write
   * the cost of which is dwarfed by the dependent-rollup recompute
   * that the same save triggers).
   */
  async applyOnSave(args: {
    ctx: ComputedDispatchContext;
    collectionCode: string;
    /** Collection storage table name — required by the hierarchical executor. */
    tableName: string;
    properties: PropertyDefinition[];
    recordId: string;
    record: Record<string, unknown>;
    /**
     * The pre-update state of the record — used by hierarchical to
     * detect a parent reference change and skip an unnecessary
     * reparent. `priorParentId` is also accepted as a precomputed
     * shortcut when the caller already knows the previous value.
     */
    priorRecord?: Record<string, unknown> | null;
    priorParentId?: string | null;
    operation: 'create' | 'update';
  }): Promise<Record<string, unknown>> {
    const computed = args.properties.filter((p) => this.isComputedProperty(p));
    let merged: Record<string, unknown> = { ...args.record };

    // NOTE: even when this collection has zero computed properties,
    // we still need to run the parent-rollup discovery pass below —
    // a child save typically has none of its own computeds but must
    // notify parent collections whose rollups aggregate from it.

    for (const property of computed) {
      const typeCode = this.getTypeCode(property);
      try {
        switch (typeCode) {
          case 'formula': {
            const formulaResults = await this.formulaService.evaluateComputedProperties({
              userId: args.ctx.userId,
              collectionCode: args.collectionCode,
              recordId: args.recordId,
              record: merged,
              properties: [property],
            } as never);
            if (formulaResults && property.code in formulaResults) {
              merged[property.code] = formulaResults[property.code];
            }
            break;
          }
          case 'lookup': {
            const lookupConfig = (property.config as Record<string, unknown> | null) ?? {};
            const lookupResults = await this.lookupService.resolveAllLookups(
              args.collectionCode,
              args.recordId,
              merged,
              [{ propertyCode: property.code, config: lookupConfig as never }],
              args.ctx as never,
            );
            if (lookupResults && property.code in lookupResults) {
              merged[property.code] = lookupResults[property.code];
            }
            break;
          }
          case 'hierarchical': {
            const config = (property.config as {
              parentProperty?: string;
              parentColumn?: string;
            } | null) ?? {};
            const parentPropCode = config.parentProperty ?? 'parent';
            const newParentId = (merged[parentPropCode] as string | null | undefined) ?? null;
            // Skip when the parent hasn't moved on this save.
            const priorParentId =
              args.priorParentId !== undefined
                ? args.priorParentId
                : ((args.priorRecord?.[parentPropCode] as string | null | undefined) ?? null);
            if (args.operation === 'update' && priorParentId === newParentId) break;
            const parentColumn = config.parentColumn
              ?? args.properties.find((p) => p.code === parentPropCode)?.columnName
              ?? `${parentPropCode}_id`;
            const pathColumn = property.columnName ?? property.code;
            await this.hierarchicalService.reparent(
              { tableName: args.tableName, parentColumn, pathColumn },
              args.recordId,
              newParentId,
            );
            break;
          }
          case 'rollup': {
            // A rollup property authored ON the saved collection
            // itself is unusual but valid (e.g. a self-referential
            // collection that aggregates from itself). The common
            // case — a rollup on a PARENT collection that aggregates
            // from this child — is handled separately by
            // `enqueueParentRollupsForChildSave` below.
            await this.enqueueRollupRecompute(property, args.collectionCode, merged);
            break;
          }
          default:
            // Non-computed types fall through; this branch is only
            // reachable if a new computed type ships before its
            // dispatcher case lands.
            this.logger.debug(`No dispatcher case for computed type "${typeCode}"`);
        }
      } catch (error) {
        // §6.5 contract: a single broken computed property logs and
        // continues. The save itself was already committed by the
        // caller.
        this.logger.error(
          `Computed property "${property.code}" (${typeCode}) failed: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    // Plan §6.5 — discover PARENT-collection rollups whose
    // sourceCollection points at the saved collection. The common
    // case: orders.line_count rolls up from order_lines; a save on
    // order_lines must enqueue a recompute against the related
    // orders parent. Without this discovery pass the rollup column
    // never refreshes when a child changes.
    await this.enqueueParentRollupsForChildSave(
      args.collectionCode,
      merged,
      args.priorRecord ?? undefined,
    );

    return merged;
  }

  /**
   * Find every rollup property (on any other collection) whose
   * config.sourceCollection points at the saved collection. For each
   * one, enqueue a recompute against the parent record id, derived
   * from the saved record's relationProperty value. When the child
   * MOVES from one parent to another (relationProperty value changes
   * between `priorRecord` and `childRecord`), enqueue BOTH parent
   * ids — otherwise the old parent's rollup keeps the moved child's
   * contribution. Coalesced by `(parentId, rollupPropertyId)` so a
   * burst of child saves yields one parent recompute per parent.
   */
  private async enqueueParentRollupsForChildSave(
    childCollectionCode: string,
    childRecord: Record<string, unknown>,
    priorChildRecord?: Record<string, unknown>,
  ): Promise<void> {
    // Property configs are JSONB; `config->>'sourceCollection'` gives
    // the source collection name as text. We also restrict to active
    // rollup-typed properties so deactivated rollups don't get queued.
    const rows = (await this.dataSource.query(
      `SELECT pd.id AS property_id, pd.code AS property_code,
              pd.collection_id AS collection_id,
              pd.config->>'relationProperty' AS relation_property
         FROM property_definitions pd
         JOIN property_types pt ON pt.id = pd.property_type_id
        WHERE pt.code = 'rollup'
          AND pd.is_active = true
          AND pd.config->>'sourceCollection' = $1`,
      [childCollectionCode],
    )) as Array<{
      property_id: string;
      property_code: string;
      collection_id: string;
      relation_property: string | null;
    }>;

    if (!rows || rows.length === 0) return;

    for (const row of rows) {
      if (!row.relation_property) {
        this.logger.warn(
          `Rollup property ${row.property_code} on collection ${row.collection_id} is missing relationProperty config; skipping`,
        );
        continue;
      }
      const newParentId = childRecord[row.relation_property] as string | null | undefined;
      const oldParentId = priorChildRecord?.[row.relation_property] as string | null | undefined;

      // Build the set of parent ids to recompute. On a move (old !=
      // new), both must recompute — the OLD parent's rollup needs to
      // drop the child's contribution, the NEW parent's needs to add
      // it. On a stable update or a create, only the current parent
      // is queued.
      const targetParents = new Set<string>();
      if (newParentId) targetParents.add(newParentId);
      if (oldParentId && oldParentId !== newParentId) {
        targetParents.add(oldParentId);
      }
      if (targetParents.size === 0) continue;

      for (const parentId of targetParents) {
        try {
          await this.outboxRepo.save(
            this.outboxRepo.create({
              eventType: 'computed.rollup.recompute',
              payload: {
                parentCollectionId: row.collection_id,
                parentId,
                rollupPropertyId: row.property_id,
                rollupPropertyCode: row.property_code,
                childCollectionCode,
                debounceKey: `${parentId}:${row.property_id}`,
              },
              status: 'pending',
            }),
          );
        } catch (error) {
          this.logger.error(
            `Failed to enqueue parent rollup ${row.property_code} for child save: ${(error as Error).message}`,
          );
        }
      }
    }
  }

  /**
   * Public delete-side entry point. CollectionDataService.delete /
   * bulkDelete call this AFTER the SQL DELETE commits, passing the
   * deleted record(s) so we can enqueue a recompute against the
   * parent rollup whose contribution just disappeared. There is no
   * own-properties pass (the row is gone — formula/lookup/
   * hierarchical have nothing to compute against), only the
   * parent-rollup discovery.
   */
  async applyOnDelete(args: {
    ctx: ComputedDispatchContext;
    collectionCode: string;
    deletedRecord: Record<string, unknown>;
  }): Promise<void> {
    void args.ctx;
    await this.enqueueParentRollupsForChildSave(args.collectionCode, args.deletedRecord);
  }

  /**
   * Enqueue a debounced rollup recompute event. The outbox processor
   * coalesces by `(parentId, rollupPropertyId)` so a burst of child
   * saves results in one recompute. The dispatch shape matches the
   * existing automation.workflow.start outbox event so the same
   * BullMQ worker pool can handle it.
   */
  private async enqueueRollupRecompute(
    property: PropertyDefinition,
    childCollectionCode: string,
    childRecord: Record<string, unknown>,
  ): Promise<void> {
    const config = (property.config as {
      sourceCollection?: string;
      relationProperty?: string;
      sourceProperty?: string;
    } | null) ?? {};
    const parentPropCode = config.relationProperty ?? config.sourceProperty;
    if (!parentPropCode) return;
    const parentId = childRecord[parentPropCode] as string | null | undefined;
    if (!parentId) return;

    const debounceKey = `${parentId}:${property.id}`;

    // Coalesce on enqueue: when a pending recompute for the same
    // (parentId, rollupPropertyId) is already in the outbox, skip the
    // INSERT. The processor reads current DB state when it fires, so
    // the existing pending row picks up this child's contribution.
    // Without this guard, N rapid child saves produce N pending rows
    // that each trigger a serial recompute before consume-time
    // grouping kicks in (the outbox processor only coalesces within
    // a single poll batch).
    const existing = await this.outboxRepo
      .createQueryBuilder('o')
      .where(`o.event_type = :type`, { type: 'computed.rollup.recompute' })
      .andWhere(`o.status = :status`, { status: 'pending' })
      .andWhere(`o.payload->>'debounceKey' = :key`, { key: debounceKey })
      .getCount();
    if (existing > 0) return;

    await this.outboxRepo.save(
      this.outboxRepo.create({
        eventType: 'computed.rollup.recompute',
        payload: {
          parentCollectionCode: config.sourceCollection ?? null,
          parentId,
          rollupPropertyId: property.id,
          rollupPropertyCode: property.code,
          childCollectionCode,
          // Debounce key — the processor uses this to coalesce.
          debounceKey,
        },
        status: 'pending',
      }),
    );
  }

  private isComputedProperty(property: PropertyDefinition): boolean {
    const code = this.getTypeCode(property);
    return code === 'formula' || code === 'rollup' || code === 'lookup' || code === 'hierarchical';
  }

  private getTypeCode(property: PropertyDefinition): string {
    return (
      property.propertyType?.code ??
      ((property.config as Record<string, unknown> | undefined)?.dataType as string | undefined) ??
      ''
    );
  }
}

export interface ComputedDispatchContext {
  userId: string;
  username?: string;
  permissions?: string[];
  roles?: string[];
}
