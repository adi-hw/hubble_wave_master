import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  AuditLog,
  CollectionDefinition,
  PropertyDefinition,
  RuntimeAnomalyService,
  ViewDefinition as ViewEntity,
  ViewDefinitionRevision,
  withAudit,
} from '@hubblewave/instance-db';
import { AuthorizationService } from '@hubblewave/authorization';
import { UserRequestContext } from '@hubblewave/auth-guard';
import { SelectQueryBuilder, ObjectLiteral, DataSource, EntityManager } from 'typeorm';
import { ValidationService } from './validation/validation.service';
import { DefaultValueService } from './defaults/default-value.service';
import { EventOutboxService } from './events/event-outbox.service';
import { SyncTriggerClientService } from './automation/sync-trigger-client.service';
import { ComputedPropertyDispatcher } from './computed/computed-property-dispatcher.service';
import { AUTOMATION_CODE_ALIASES } from '@hubblewave/shared-types';
import { PropertyValidationResult, ValidationContext } from './validation/validation.types';
import { DefaultValueContext } from './defaults/default-value.types';

// Local type for view sort configuration
interface ViewSortConfig {
  propertyCode: string;
  direction: 'asc' | 'desc';
}

// Internal interfaces for missing entities
interface ViewColumn {
    code: string;
    position: number;
    isVisible: boolean;
    config?: Record<string, unknown>;
    viewId?: string;
}

interface ViewDefinition {
    id: string;
    code: string;
    name: string;
    kind: string;
    layout: Record<string, unknown>;
    isActive: boolean;
}

// Query DTOs
export interface QueryOptions {
  page?: number;
  pageSize?: number;
  sort?: SortOption[];
  filters?: FilterCondition[];
  search?: string;
  searchProperties?: string[];
  groupBy?: string;
  viewId?: string;
}

export interface SortOption {
  property: string;
  direction: 'asc' | 'desc';
}

export interface FilterCondition {
  property: string;
  operator: FilterOperator;
  value: unknown;
  orGroup?: string;
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_equal'
  | 'less_than'
  | 'less_equal'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'between';

export interface QueryResult<T = Record<string, unknown>> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  fields: PropertyDefinition[];
  view?: ViewDefinition;
}

// ============================================================================
// GROUPING TYPES
// ============================================================================

export interface GroupedRow {
  /** Unique identifier for this group */
  __groupId: string;
  /** Whether this is a group row (vs a data row) */
  __isGroup: true;
  /** The property being grouped by */
  __groupField: string;
  /** The value of the grouping property */
  __groupValue: unknown;
  /** Display label for the group */
  __groupLabel: string;
  /** Number of child rows in this group */
  __childCount: number;
  /** Depth level (0 = top level, 1 = nested, etc.) */
  __depth: number;
  /** Aggregation values for numeric columns */
  __aggregations?: Record<string, { sum?: number; avg?: number; min?: number; max?: number; count?: number }>;
}

export interface GroupedQueryResult {
  /** Groups at this level */
  groups: GroupedRow[];
  /** Total number of groups */
  totalGroups: number;
  /** Total number of records across all groups */
  totalRecords: number;
  /** Properties available */
  fields: PropertyDefinition[];
}

export interface GroupChildrenResult<T = Record<string, unknown>> {
  /** Data rows within the group */
  data: T[];
  /** Pagination info */
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  fields: PropertyDefinition[];
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;



@Injectable()
export class CollectionDataService {
  private readonly logger = new Logger(CollectionDataService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly authz: AuthorizationService,

    private readonly validationService: ValidationService,
    private readonly defaultValueService: DefaultValueService,
    private readonly outboxService: EventOutboxService,
    private readonly syncTriggerClient: SyncTriggerClientService,
    private readonly computedDispatcher: ComputedPropertyDispatcher,
    private readonly runtimeAnomaly: RuntimeAnomalyService,
  ) {}

  /**
   * Plan §6.5 — apply computed-property executors after a save, then
   * write back any column values the dispatcher resolved (formula /
   * lookup outputs). Hierarchical reparent + rollup outbox enqueue
   * happen inside the dispatcher and don't need a write-back here.
   *
   * The write-back is a focused UPDATE on only the changed computed
   * columns — it doesn't re-trigger automations or validators (the
   * computed values came from sandboxed evaluation against
   * already-validated source columns).
   */
  private async runComputedDispatch(
    ctx: UserRequestContext,
    collection: { id: string; code: string; tableName: string },
    properties: PropertyDefinition[],
    recordId: string,
    record: Record<string, unknown>,
    operation: 'create' | 'update',
    priorRecord?: Record<string, unknown> | null,
  ): Promise<Record<string, unknown>> {
    const merged = await this.computedDispatcher.applyOnSave({
      ctx: { userId: ctx.userId ?? 'system', username: ctx.username, permissions: ctx.permissionCodes, roles: ctx.roleCodes },
      collectionCode: collection.code,
      tableName: collection.tableName,
      properties,
      recordId,
      record,
      priorRecord,
      operation,
    });

    // Build a write-back payload of only the columns the dispatcher
    // changed. Skip anything the dispatcher didn't touch and skip the
    // primary key.
    const writeBack: Record<string, unknown> = {};
    for (const property of properties) {
      const code = property.propertyType?.code;
      if (code !== 'formula' && code !== 'lookup') continue;
      const column = this.getStorageColumn(property);
      if (!column) continue;
      if (record[property.code] !== merged[property.code]) {
        writeBack[column] = merged[property.code];
      }
    }
    if (Object.keys(writeBack).length === 0) {
      return merged;
    }

    const setClauses = Object.keys(writeBack)
      .map((col, idx) => `"${col}" = $${idx + 1}`)
      .join(', ');
    const values = Object.values(writeBack);
    const sql = `UPDATE "${collection.tableName}" SET ${setClauses} WHERE id = $${values.length + 1}`;
    await this.dataSource.query(sql, [...values, recordId]);
    return merged;
  }

  /**
   * Run before-trigger Automation Rules synchronously inside the data
   * pipeline. Rules can mutate the pending payload (SetField), abort
   * the request (Abort → throws BadRequestException), or surface
   * field-level errors that the caller treats as validation failures.
   * Side-effect actions (CreateRecord / CallFlow / FireEvent /
   * SendNotification) are queued; the caller drains the queue post-
   * commit via `drainQueuedActions`.
   */
  private async runBeforeAutomations(
    ctx: UserRequestContext,
    collection: CollectionDefinition,
    operation: 'insert' | 'update' | 'delete',
    record: Record<string, unknown>,
    previousRecord: Record<string, unknown> | undefined,
    parentAutomationContext?: { depth?: number; executionChain?: string[] },
  ): Promise<{
    modifiedRecord: Record<string, unknown>;
    asyncQueue: Array<{
      action: { type: string; config: Record<string, unknown> };
      output?: unknown;
      executeAfterCommit: boolean;
    }>;
  }> {
    const result = await this.syncTriggerClient.executeSyncTrigger(ctx, {
      collectionId: collection.id,
      timing: 'before',
      operation,
      record,
      previousRecord,
      userContext: { id: ctx.userId ?? '', email: ctx.username, roles: ctx.roleCodes },
      parentContext: parentAutomationContext,
    });
    if (result.aborted) {
      throw new BadRequestException({
        message: result.abortMessage ?? 'Operation aborted by Automation Rule',
        code: 'AUTOMATION_ABORT',
      });
    }
    if (result.errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.errors.map((e) => `${e.property}: ${e.message}`),
        details: result.errors,
      });
    }
    return {
      modifiedRecord: result.modifiedRecord,
      asyncQueue: result.asyncQueue.map((q) => ({
        action: { type: q.action.type, config: q.action.config },
        output: q.output,
        executeAfterCommit: q.executeAfterCommit,
      })),
    };
  }

  /**
   * Drain the asyncQueue produced by a before-trigger automation pass.
   * Each queued action is forwarded to its appropriate consumer via
   * the same outbox event types svc-automation already publishes for
   * after-triggers — so the catalog's CreateRecord / CallFlow /
   * FireEvent / SendNotification produce real downstream effects
   * regardless of whether they were attached to a before- or after-
   * trigger rule. CreateRecord on a parent record's before-pass
   * recurses through `this.create` so the new record's own
   * automations and validation run normally.
   */
  private async drainQueuedActions(
    ctx: UserRequestContext,
    parentCollection: CollectionDefinition,
    parentRecordId: string | undefined,
    asyncQueue: Array<{
      action: { type: string; config: Record<string, unknown> };
      output?: unknown;
      executeAfterCommit: boolean;
    }>,
    parentAutomationContext: { depth: number; executionChain: string[] },
  ): Promise<void> {
    for (const queued of asyncQueue) {
      try {
        const { type, config } = queued.action;
        // Normalize to the canonical catalog code so any alias the
        // UI persists (e.g. `start_workflow` for CallFlow) routes
        // through one branch. Without this, the executor's raw
        // action.type (the UI's snake_case code) misses the
        // dispatcher's canonical+alias match list — adding a new
        // alias would otherwise require touching both the dispatcher
        // AND this drain.
        const canonical = AUTOMATION_CODE_ALIASES[type] ?? type;
        // Resolved output is preferred over raw config: handlers
        // resolve `@record.id` / `@output.x` bindings into output at
        // queue time, so reading from output produces evaluated
        // values (literal placeholder strings would otherwise leak
        // through to consumers).
        const out = (queued.output ?? {}) as Record<string, unknown>;

        if (canonical === 'CreateRecord') {
          const targetCollection = (out.collection ??
            config.collectionCode ??
            config.collection) as string | undefined;
          const values = (out.values ?? config.values ?? config.data ?? {}) as Record<string, unknown>;
          if (!targetCollection) {
            this.logger.warn(`CreateRecord action missing collectionCode; skipped`);
            await this.runtimeAnomaly.record({
              kind: 'queued_action_missing_collection',
              serviceCode: 'svc-data',
              message: `CreateRecord queued action missing collectionCode; action skipped for parent record ${parentRecordId ?? 'unknown'}`,
              collectionCode: parentCollection.code,
              recordId: parentRecordId,
              context: { actionType: type, canonical, parentCollectionCode: parentCollection.code },
            });
            continue;
          }
          // Recursive create — propagate the executor's depth and
          // executionChain so the inner pass enforces MAX_DEPTH and
          // sees prior automation ids. Without this, each recursive
          // create reset depth=1 and could recurse to request/DB
          // failure.
          await this.createInternal(ctx, targetCollection, values, {
            depth: parentAutomationContext.depth,
            executionChain: parentAutomationContext.executionChain,
          });
        } else if (canonical === 'FireEvent') {
          const event = (out.event ?? config.event ?? config.eventType) as string | undefined;
          if (!event) continue;
          await this.outboxService.enqueueAutomationEvent({
            event,
            data: (out.data ?? config.data ?? {}) as Record<string, unknown>,
            collectionCode: parentCollection.code,
            recordId: parentRecordId,
            userId: ctx.userId ?? null,
          });
        } else if (canonical === 'CallFlow') {
          const flowCode = (out.workflowId ??
            config.flowCode ??
            config.workflowId) as string | undefined;
          if (!flowCode) continue;
          await this.outboxService.enqueueWorkflowStart({
            workflowId: flowCode,
            inputs: (out.inputs ?? config.inputs ?? {}) as Record<string, unknown>,
            collectionCode: parentCollection.code,
            recordId: parentRecordId,
            userId: ctx.userId ?? null,
          });
        } else if (canonical === 'SendNotification') {
          const recipients =
            (out.recipients as string[] | undefined) ??
            (config.recipients as string[] | undefined) ??
            (config.recipientUserId ? [config.recipientUserId as string] : []);
          await this.outboxService.enqueueNotificationRequest({
            templateCode: (out.templateCode ?? config.templateCode ?? config.template) as string | undefined,
            templateId: (out.templateId ?? config.templateId) as string | undefined,
            recipients,
            channels: (out.channels ?? config.channels) as string[] | undefined,
            data: (out.data ?? config.data ?? {}) as Record<string, unknown>,
            collectionCode: parentCollection.code,
            recordId: parentRecordId,
            userId: ctx.userId ?? null,
          });
        }
      } catch (err) {
        // A queued action failure shouldn't undo the parent write
        // that already committed. Log loudly; the execution log
        // already captured per-action status.
        const msg = err instanceof Error ? err.message : 'unknown';
        this.logger.error(`Queued automation action ${queued.action.type} failed: ${msg}`);
        await this.runtimeAnomaly.record({
          kind: 'queued_action_execution_failed',
          serviceCode: 'svc-data',
          message: `Queued automation action ${queued.action.type} failed for parent record ${parentRecordId ?? 'unknown'}: ${msg}`,
          collectionCode: parentCollection.code,
          recordId: parentRecordId,
          context: { actionType: queued.action.type, errorMessage: msg },
          error: err instanceof Error ? err : undefined,
        });
      }
    }
  }

  /**
   * Run before-query automations. The "record" the rule sees is the
   * QueryOptions payload (filters, viewId, page) so a rule can
   * inspect what the caller is about to read. modifiedRecord is
   * not consumed here — query rules are read-only gates and do not
   * mutate the QueryOptions payload. Abort throws 400; non-abort
   * errors throw 400 too so the read fails closed.
   */
  private async runBeforeQueryAutomations(
    ctx: UserRequestContext,
    collection: CollectionDefinition,
    options: Record<string, unknown>,
  ): Promise<void> {
    const result = await this.syncTriggerClient.executeSyncTrigger(ctx, {
      collectionId: collection.id,
      timing: 'before',
      operation: 'query',
      record: options,
      userContext: { id: ctx.userId ?? '', email: ctx.username, roles: ctx.roleCodes },
    });
    if (result.aborted) {
      throw new BadRequestException({
        message: result.abortMessage ?? 'Query aborted by Automation Rule',
        code: 'AUTOMATION_ABORT',
      });
    }
    if (result.errors.length > 0) {
      throw new BadRequestException({
        message: 'Query rejected by Automation Rule',
        errors: result.errors.map((e) => `${e.property}: ${e.message}`),
        details: result.errors,
      });
    }
    // Side-effect actions on before_query rules (FireEvent for audit,
    // CreateRecord for log entries) drain immediately. Query has no
    // commit boundary, so the drain runs before the SQL select.
    if (result.asyncQueue.length > 0) {
      await this.drainQueuedActions(
        ctx,
        collection,
        undefined,
        result.asyncQueue.map((q) => ({
          action: { type: q.action.type, config: q.action.config },
          output: q.output,
          executeAfterCommit: q.executeAfterCommit,
        })),
        { depth: 1, executionChain: [] },
      );
    }
  }

  private hasAutomationChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): boolean {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        return true;
      }
    }
    return false;
  }

  private async runAfterAutomations(
    ctx: UserRequestContext,
    collection: CollectionDefinition,
    operation: 'insert' | 'update' | 'delete',
    record: Record<string, unknown>,
    previousRecord: Record<string, unknown> | undefined,
  ): Promise<void> {
    // After-trigger rules run post-commit. Their write actions
    // (CreateRecord, side-effect notifications) are queued via the
    // executor's asyncQueue and processed by svc-automation's outbox
    // consumer; this call surfaces synchronous errors only as warnings
    // so a downstream automation failure cannot retroactively fail
    // the user's already-committed write.
    try {
      const result = await this.syncTriggerClient.executeSyncTrigger(ctx, {
        collectionId: collection.id,
        timing: 'after',
        operation,
        record,
        previousRecord,
        userContext: { id: ctx.userId ?? '', email: ctx.username, roles: ctx.roleCodes },
      });
      if (result.errors.length > 0 || result.warnings.length > 0) {
        this.logger.warn(
          `After-automation issues for ${collection.code}: ` +
            JSON.stringify({ errors: result.errors, warnings: result.warnings }),
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`After-automation execution failed for ${collection.code}: ${msg}`);
    }
  }

  private readonly instanceId = process.env.INSTANCE_ID || 'default-instance';

  private withContext(ctx: UserRequestContext) {
    return { ...ctx, instanceId: this.instanceId };
  }

  private collectionRepo() {
    return this.dataSource.getRepository(CollectionDefinition);
  }

  private propertyRepo() {
    return this.dataSource.getRepository(PropertyDefinition);
  }

  private ensureSafeIdentifier(value: string, label: string): string {
    if (!value || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new BadRequestException(`Invalid ${label} name: ${value}`);
    }
    return value;
  }

  // Helper to get storage column name from property
  private getStorageColumn(prop: PropertyDefinition): string {
    return prop.columnName || prop.code;
  }

  // Helper to get label from property
  private getLabel(prop: PropertyDefinition): string {
    return prop.name || prop.code;
  }

  // Helper to prefix parameter names to avoid collisions
  private prefixParams(params: Record<string, unknown>, prefix: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(params)) {
      result[`${prefix}${key}`] = params[key];
    }
    return result;
  }

  private isEmptyValue(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  // Repository helpers
  // Get collection by code or ID
  async getCollection(codeOrId: string): Promise<CollectionDefinition> {
    const repo = this.collectionRepo();

    // Try by ID first (UUID format)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codeOrId);

    const collection = await repo
      .createQueryBuilder('c')
      .where(isUuid ? 'c.id = :id' : 'c.code = :code', { id: codeOrId, code: codeOrId })
      .andWhere('c.is_active = true')
      .andWhere("COALESCE(c.metadata->>'status','published') = 'published'")
      .getOne();

    if (collection) {
      return collection;
    }

    throw new NotFoundException(`Collection '${codeOrId}' not found`);
  }

  // Get all properties for a collection
  async getProperties(collectionId: string): Promise<PropertyDefinition[]> {
    const repo = this.propertyRepo();

    return repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.propertyType', 'propertyType')
      .where('p.collection_id = :collectionId', { collectionId })
      .andWhere('p.is_active = true')
      .andWhere("COALESCE(p.metadata->>'status','published') = 'published'")
      .orderBy('p.position', 'ASC')
      .addOrderBy('p.code', 'ASC')
      .getMany();
  }

  /**
   * Enrich properties with reference collection codes for frontend navigation
   * Looks up collection codes from referenceCollectionId UUIDs
   * Also ensures dataType is set to 'reference' for reference properties
   */
  async enrichPropertiesWithReferences(
    properties: PropertyDefinition[]
  ): Promise<Array<Omit<PropertyDefinition, 'referenceCollection'> & { referenceCollectionCode?: string; dataType?: string }>> {
    // Collect all reference collection IDs
    const refCollectionIds = new Set<string>();
    for (const prop of properties) {
      if (prop.referenceCollectionId) {
        refCollectionIds.add(prop.referenceCollectionId);
      }
    }

    // Look up collection codes for all referenced collections.
    // Per HubbleWave canon §5 (one instance per customer), the collection
    // metadata repository is scoped to this customer's instance database at
    // the connection level — there is no cross-instance scope to filter.
    const idToCodeMap = new Map<string, string>();
    if (refCollectionIds.size > 0) {
      const refCollections = await this.collectionRepo().find({
        where: [...refCollectionIds].map(id => ({ id })),
        select: ['id', 'code'],
      });

      for (const col of refCollections) {
        idToCodeMap.set(col.id, col.code);
      }
    }

    // Enrich properties with referenceCollectionCode and ensure dataType is set
    return properties.map(prop => {
      const config = prop.config as Record<string, unknown> || {};
      const existingDataType = config.dataType as string | undefined;

      // Determine the dataType from propertyType relation first, then config, then default
      // Priority: propertyType.code > config.dataType > 'string'
      let dataType = prop.propertyType?.code || existingDataType || 'string';

      // Override to 'reference' if it has a referenceCollectionId
      if (prop.referenceCollectionId) {
        dataType = 'reference';
      }

      // Destructure to remove TypeORM relation properties that shouldn't be sent to frontend
      const { referenceCollection: _relation, propertyType: _propType, ...propWithoutRelation } = prop;

      return {
        ...propWithoutRelation,
        dataType, // Expose dataType at top level for frontend
        referenceCollectionCode: prop.referenceCollectionId
          ? idToCodeMap.get(prop.referenceCollectionId)
          : undefined,
      };
    });
  }

  // Get actual column names from database schema
  private async getActualColumnNames(tableName: string): Promise<Set<string>> {
    const columns = await this.dataSource.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1`,
      [tableName]
    );
    return new Set(columns.map((col: { column_name: string }) => col.column_name));
  }

  private async validateUniqueConstraints(
    collection: CollectionDefinition,
    properties: PropertyDefinition[],
    data: Record<string, unknown>,
    excludeId?: string
  ): Promise<PropertyValidationResult[]> {
    const violations: PropertyValidationResult[] = [];
    const schemaName = this.ensureSafeIdentifier('public', 'schema');
    const tableName = this.ensureSafeIdentifier(collection.tableName, 'table');
    const tableRef = `${schemaName}.${tableName}`;

    for (const property of properties) {
      if (!property.isUnique) continue;
      const value = data[property.code];
      if (this.isEmptyValue(value)) continue;

      const columnName = this.ensureSafeIdentifier(this.getStorageColumn(property), 'column');
      const qb = this.dataSource
        .createQueryBuilder()
        .select('t.id', 'id')
        .from(tableRef, 't')
        .where(`t."${columnName}" = :value`, { value });

      if (excludeId) {
        qb.andWhere('t."id" <> :excludeId', { excludeId });
      }

      const existing = await qb.getRawOne();
      if (existing) {
        const label = this.getLabel(property);
        violations.push({
          property: property.code,
          propertyLabel: label,
          isValid: false,
          errors: [
            {
              rule: 'unique',
              passed: false,
              message: `${label} must be unique`,
            },
          ],
        });
      }
    }

    return violations;
  }

  /**
   * List audit-log entries scoped to a single record. Used by the
   * Phase 5 ActivityFeedPanel; ordered newest-first. Result includes
   * `userId` / `action` / `oldValues` / `newValues` / `createdAt` so
   * the panel can render "who changed what when" without further
   * lookups. Caller authz: the panel mounts only inside a workspace
   * runtime, which already gates the parent record by the
   * collection's read ACL.
   */
  async listAuditLog(
    ctx: UserRequestContext,
    collectionCode: string,
    recordId: string,
    options: { limit?: number } = {},
  ): Promise<{ entries: AuditLog[] }> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureCollectionAccess(context, collection.id, 'read');

    const repo = this.dataSource.getRepository(AuditLog);
    const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
    const entries = await repo.find({
      where: { collectionCode, recordId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return { entries };
  }

  private async readRecord(
    mgr: EntityManager,
    collection: CollectionDefinition,
    properties: PropertyDefinition[],
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const schema = this.ensureSafeIdentifier('public', 'schema');
    const safeTable = this.ensureSafeIdentifier(collection.tableName, 'table');
    const selectParts: string[] = ['t."id"', 't."created_at"', 't."updated_at"'];
    properties.forEach((prop) => {
      const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
      selectParts.push(`t."${col}" AS "${prop.code}"`);
    });
    const sql = `SELECT ${selectParts.join(', ')} FROM "${schema}"."${safeTable}" t WHERE t."id" = $1`;
    const rows = (await mgr.query(sql, [id])) as Record<string, unknown>[];
    return rows[0] ?? null;
  }

  // Get view definition with columns
  async getViewWithColumns(viewId: string): Promise<{ view: ViewDefinition; columns: ViewColumn[] }> {
    const viewRepo = this.dataSource.getRepository(ViewEntity);
    const revisionRepo = this.dataSource.getRepository(ViewDefinitionRevision);

    const viewEntity = await viewRepo.findOne({ where: { id: viewId, isActive: true } });

    if (!viewEntity) {
      throw new NotFoundException(`View '${viewId}' not found`);
    }

    const revision = await revisionRepo.findOne({
      where: { definitionId: viewEntity.id, status: 'published' },
      order: { revision: 'DESC' },
    });

    if (!revision) {
      throw new NotFoundException(`Published view revision not found for '${viewId}'`);
    }

    // Map to internal ViewDefinition/ViewColumn types
    const view: ViewDefinition = {
      id: viewEntity.id,
      code: viewEntity.code,
      name: viewEntity.name,
      kind: viewEntity.kind,
      layout: revision.layout as Record<string, unknown>,
      isActive: viewEntity.isActive,
    };

    const viewColumns = this.extractViewColumns(view.layout);

    return { view, columns: viewColumns };
  }

  private extractViewColumns(layout: Record<string, unknown>): ViewColumn[] {
    const rawColumns = (layout.columns || []) as Array<Record<string, unknown>>;
    const results: ViewColumn[] = [];

    rawColumns.forEach((column, index) => {
      const code = (column.property_code || column.code) as string | undefined;
      if (!code) {
        return;
      }
      const isVisible = column.visible !== false;
      const position = typeof column.position === 'number' ? column.position : index;
      results.push({
        code,
        position,
        isVisible,
        config: column,
      });
    });

    return results.sort((a, b) => a.position - b.position);
  }

  // Build WHERE clause from filters
  private buildFilterClause(
    qb: SelectQueryBuilder<ObjectLiteral>,
    filters: FilterCondition[],
    properties: PropertyDefinition[],
    paramPrefix: string
  ): void {
    const propertyMap = new Map(properties.map((p) => [p.code, p]));

    filters.forEach((filter, idx) => {
      const property = propertyMap.get(filter.property);
      if (!property) return;

      const column = this.ensureSafeIdentifier(this.getStorageColumn(property), 'column');
      const paramName = `${paramPrefix}_${idx}`;

      switch (filter.operator) {
        case 'equals':
          qb.andWhere(`t."${column}" = :${paramName}`, { [paramName]: filter.value });
          break;
        case 'not_equals':
          qb.andWhere(`t."${column}" != :${paramName}`, { [paramName]: filter.value });
          break;
        case 'contains':
          qb.andWhere(`t."${column}" ILIKE :${paramName}`, { [paramName]: `%${filter.value}%` });
          break;
        case 'not_contains':
          qb.andWhere(`t."${column}" NOT ILIKE :${paramName}`, { [paramName]: `%${filter.value}%` });
          break;
        case 'starts_with':
          qb.andWhere(`t."${column}" ILIKE :${paramName}`, { [paramName]: `${filter.value}%` });
          break;
        case 'ends_with':
          qb.andWhere(`t."${column}" ILIKE :${paramName}`, { [paramName]: `%${filter.value}` });
          break;
        case 'greater_than':
          qb.andWhere(`t."${column}" > :${paramName}`, { [paramName]: filter.value });
          break;
        case 'greater_equal':
          qb.andWhere(`t."${column}" >= :${paramName}`, { [paramName]: filter.value });
          break;
        case 'less_than':
          qb.andWhere(`t."${column}" < :${paramName}`, { [paramName]: filter.value });
          break;
        case 'less_equal':
          qb.andWhere(`t."${column}" <= :${paramName}`, { [paramName]: filter.value });
          break;
        case 'in':
          qb.andWhere(`t."${column}" IN (:...${paramName})`, { [paramName]: filter.value });
          break;
        case 'not_in':
          qb.andWhere(`t."${column}" NOT IN (:...${paramName})`, { [paramName]: filter.value });
          break;
        case 'is_null':
          qb.andWhere(`t."${column}" IS NULL`);
          break;
        case 'is_not_null':
          qb.andWhere(`t."${column}" IS NOT NULL`);
          break;
        case 'between':
          if (Array.isArray(filter.value) && filter.value.length === 2) {
            qb.andWhere(`t."${column}" BETWEEN :${paramName}_min AND :${paramName}_max`, {
              [`${paramName}_min`]: filter.value[0],
              [`${paramName}_max`]: filter.value[1],
            });
          }
          break;
      }
    });
  }

  // Get property type name (for search field filtering)
  private getPropertyTypeName(prop: PropertyDefinition): string {
    // PropertyDefinition uses propertyTypeId, we'll check the config for type hints
    const config = prop.config as Record<string, unknown>;
    return (config?.dataType as string) || 'text';
  }

  // List records from a collection
  async list(
    ctx: UserRequestContext,
    collectionCode: string,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);

    // Check table-level access
    await this.authz.ensureCollectionAccess(context, collection.id, 'read');

    // Run before-query automations. Plan §9.1 exposes `before_query`
    // as a gate primarily for Abort (e.g. block list reads on
    // archived collections, or enforce row-level read constraints
    // beyond ACLs). modifiedRecord output isn't consumed here — there
    // is no record to mutate — but Abort and add_error throw
    // BadRequestException so the read fails closed.
    await this.runBeforeQueryAutomations(ctx, collection, options as unknown as Record<string, unknown>);

    // Get all properties
    const allProperties = await this.getProperties(collection.id);

    // Filter to readable properties based on property ACLs
    const authorizedFields = await this.authz.getAuthorizedFieldsForCollection(
      context,
      collection.id,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const readableCodes = new Set(authorizedFields.filter((f) => f.canRead).map((f) => f.code));
    let properties = allProperties.filter((p) => readableCodes.has(p.code));

    if (properties.length === 0) {
      throw new ForbiddenException('No readable properties on this collection');
    }

    const actualColumns = await this.getActualColumnNames(collection.tableName);
    if (!actualColumns.has('id')) {
      throw new BadRequestException(
        `Storage table '${collection.tableName}' for collection '${collection.code}' has not been deployed. ` +
        'Deploy the schema before loading records.',
      );
    }
    properties = properties.filter((p) => actualColumns.has(this.getStorageColumn(p)));

    // Pagination
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options.pageSize || DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * pageSize;

    // Get view configuration if specified
    let view: ViewDefinition | undefined;
    let viewColumns: ViewColumn[] = [];
    if (options.viewId) {
      const viewData = await this.getViewWithColumns(options.viewId);
      view = viewData.view;
      viewColumns = viewData.columns;
    }

    // Build select columns
    const selectParts: string[] = ['t."id"', 't."created_at"', 't."updated_at"'];

    // If view specified, use view columns order and visibility
    if (viewColumns.length > 0) {
      viewColumns
        .filter((vc) => vc.isVisible)
        .forEach((vc) => {
          const prop = properties.find((p) => p.code === vc.code);
          if (prop) {
            const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
            selectParts.push(`t."${col}" AS "${prop.code}"`);
          }
        });
    } else {
      // Default: all readable properties
      properties.forEach((prop) => {
        const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
        selectParts.push(`t."${col}" AS "${prop.code}"`);
      });
    }

    const ds = this.dataSource;
    // Use unquoted table name for TypeORM query builder - it handles quoting internally
    const schemaName = this.ensureSafeIdentifier('public', 'schema');
    const tableNameOnly = this.ensureSafeIdentifier(collection.tableName, 'table');

    // Count query - use raw SQL with proper quoting for FROM clause
    const countQb = ds.createQueryBuilder().select('COUNT(*)', 'total').from(`${schemaName}.${tableNameOnly}`, 't');

    // Apply row-level security predicates
    const rowLevelClause = await this.authz.buildCollectionRowLevelClause(context, collection.id, 'read', 't');
    if (rowLevelClause.clauses.length > 0) {
      rowLevelClause.clauses.forEach((clause, index) => {
        countQb.andWhere(clause, this.prefixParams(rowLevelClause.params, `rls_${index}_`));
      });
    }

    // Apply filters
    // View filters are stored in config.filters (GridViewConfig)
    const viewFilters = (view?.layout as Record<string, unknown>)?.filters as { conditions?: FilterCondition[] } | undefined;
    const allFilters = [...(options.filters || []), ...(viewFilters?.conditions || [])];
    if (allFilters.length > 0) {
      this.buildFilterClause(countQb, allFilters as FilterCondition[], properties, 'f');
    }

    // Apply search
    if (options.search && options.search.trim()) {
      const searchFields = options.searchProperties?.length
        ? options.searchProperties
        : properties.filter((p) => {
            const typeName = this.getPropertyTypeName(p);
            return ['text', 'long_text', 'email', 'string'].includes(typeName);
          }).map((p) => p.code);

      if (searchFields.length > 0) {
        const searchConditions = searchFields
          .map((propCode) => {
            const propDef = properties.find((p) => p.code === propCode);
            if (!propDef) return null;
            const col = this.ensureSafeIdentifier(this.getStorageColumn(propDef), 'column');
            return `t."${col}" ILIKE :search`;
          })
          .filter(Boolean);

        if (searchConditions.length > 0) {
          countQb.andWhere(`(${searchConditions.join(' OR ')})`, { search: `%${options.search}%` });
        }
      }
    }

    const countResult = await countQb.getRawOne();
    const total = parseInt(countResult?.total || '0', 10);

    // Data query
    const qb = ds.createQueryBuilder().select(selectParts).from(`${schemaName}.${tableNameOnly}`, 't');

    // Apply row-level security predicates (same as count query)
    if (rowLevelClause.clauses.length > 0) {
      rowLevelClause.clauses.forEach((clause, index) => {
        qb.andWhere(clause, this.prefixParams(rowLevelClause.params, `rls_d_${index}_`));
      });
    }

    // Apply same filters
    if (allFilters.length > 0) {
      this.buildFilterClause(qb, allFilters as FilterCondition[], properties, 'f');
    }

    // Apply same search
    if (options.search && options.search.trim()) {
      const searchFields = options.searchProperties?.length
        ? options.searchProperties
        : properties.filter((p) => {
            const typeName = this.getPropertyTypeName(p);
            return ['text', 'long_text', 'email', 'string'].includes(typeName);
          }).map((p) => p.code);

      if (searchFields.length > 0) {
        const searchConditions = searchFields
          .map((propCode) => {
            const propDef = properties.find((p) => p.code === propCode);
            if (!propDef) return null;
            const col = this.ensureSafeIdentifier(this.getStorageColumn(propDef), 'column');
            return `t."${col}" ILIKE :search`;
          })
          .filter(Boolean);

        if (searchConditions.length > 0) {
          qb.andWhere(`(${searchConditions.join(' OR ')})`, { search: `%${options.search}%` });
        }
      }
    }

    // Apply sorting
    // SortOption uses 'field', ViewSortConfig uses 'propertyCode'
    // View sort is stored in config.sort (GridViewConfig)
    // NOTE: We build ORDER BY clause manually to avoid TypeORM entity metadata lookup issues
    const viewSort = (view?.layout as Record<string, unknown>)?.sort as ViewSortConfig[] | undefined;
    const sortOptions: Array<SortOption | ViewSortConfig> = options.sort?.length ? options.sort : (viewSort || []);
    const orderByParts: string[] = [];
    if (sortOptions.length > 0) {
      sortOptions.forEach((sort: SortOption | ViewSortConfig) => {
        const propertyCode = (sort as SortOption).property || (sort as ViewSortConfig).propertyCode;
        const prop = properties.find((p) => p.code === propertyCode);
        if (prop) {
          const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
          const dir = sort.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
          orderByParts.push(`t."${col}" ${dir}`);
        }
      });
    }
    // Default sort by created_at DESC if no other sorting specified
    if (orderByParts.length === 0) {
      orderByParts.push('t."created_at" DESC');
    }

    // Build and execute raw query to avoid TypeORM entity metadata issues with orderBy
    // TypeORM's orderBy() fails with raw table names (non-entity tables)
    // We get the base query and manually append ORDER BY, LIMIT, OFFSET
    const baseQuery = qb.getQuery();
    const params = qb.getParameters();

    // Convert named parameters to positional parameters ($1, $2, etc.)
    // TypeORM uses :paramName syntax, PostgreSQL needs $N syntax
    const paramNames = Object.keys(params);
    const paramValues: unknown[] = [];
    let paramIndex = 1;
    const paramMap: Record<string, number> = {};

    paramNames.forEach((name) => {
      paramMap[name] = paramIndex++;
      paramValues.push(params[name]);
    });

    // Replace :paramName with $N in the query
    let convertedQuery = baseQuery;
    paramNames.forEach((name) => {
      const regex = new RegExp(`:${name}\\b`, 'g');
      convertedQuery = convertedQuery.replace(regex, `$${paramMap[name]}`);
    });

    // Build final query with ORDER BY and pagination
    const orderByClause = `ORDER BY ${orderByParts.join(', ')}`;
    const finalQuery = `${convertedQuery} ${orderByClause} LIMIT ${pageSize} OFFSET ${offset}`;

    const data = await ds.query(finalQuery, paramValues);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      fields: properties,
      view,
    };
  }

  // Get single record
  async getOne(ctx: UserRequestContext, collectionCode: string, id: string): Promise<{ record: Record<string, unknown>; fields: PropertyDefinition[] }> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureCollectionAccess(context, collection.id, 'read');

    const allProperties = await this.getProperties(collection.id);
    const authorizedFields = await this.authz.getAuthorizedFieldsForCollection(
      context,
      collection.id,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const readableCodes = new Set(authorizedFields.filter((f) => f.canRead).map((f) => f.code));
    let properties = allProperties.filter((p) => readableCodes.has(p.code));

    if (properties.length === 0) {
      throw new ForbiddenException('No readable properties on this collection');
    }

    const actualColumns = await this.getActualColumnNames(collection.tableName);
    if (!actualColumns.has('id')) {
      throw new BadRequestException(
        `Storage table '${collection.tableName}' for collection '${collection.code}' has not been deployed. ` +
        'Deploy the schema before loading records.',
      );
    }
    properties = properties.filter((p) => actualColumns.has(this.getStorageColumn(p)));

    const selectParts: string[] = ['t."id"', 't."created_at"', 't."updated_at"'];
    properties.forEach((prop) => {
      const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
      selectParts.push(`t."${col}" AS "${prop.code}"`);
    });

    const ds = this.dataSource;
    const schemaName = this.ensureSafeIdentifier('public', 'schema');
    const tableNameOnly = this.ensureSafeIdentifier(collection.tableName, 'table');

    const qb = ds.createQueryBuilder().select(selectParts).from(`${schemaName}.${tableNameOnly}`, 't').where('t."id" = :id', { id });

    // Apply row-level security predicates so a caller restricted to one
    // access scope cannot fetch a record outside that scope by id alone
    // (id is a public bearer token).
    const rowLevelClause = await this.authz.buildRowLevelClause(context, collection.tableName, 'read', 't');
    if (rowLevelClause.clauses.length > 0) {
      rowLevelClause.clauses.forEach((clause, index) => {
        qb.andWhere(clause, this.prefixParams(rowLevelClause.params, `rls_one_${index}_`));
      });
    }

    const record = await qb.getRawOne();

    if (!record) {
      throw new NotFoundException(`Record '${id}' not found in collection '${collectionCode}'`);
    }

    return { record, fields: properties };
  }

  // Create record
  async create(
    ctx: UserRequestContext,
    collectionCode: string,
    data: Record<string, unknown>
  ): Promise<{ record: Record<string, unknown>; fields: PropertyDefinition[] }> {
    return this.createInternal(ctx, collectionCode, data, {
      depth: 0,
      executionChain: [],
    });
  }

  /**
   * Internal create with automation-recursion bookkeeping. Public
   * `create` calls in at depth=0; drainQueuedActions calls in at the
   * parent's depth+1 so a chain of CreateRecord rules cannot recurse
   * without bound. The executor's MAX_DEPTH (5) is checked through
   * the parentContext we forward; once exceeded, executeAutomations
   * skips the entire automation pass for the recursive insert and
   * the SQL write proceeds as a plain create.
   */
  private async createInternal(
    ctx: UserRequestContext,
    collectionCode: string,
    data: Record<string, unknown>,
    parentAutomationContext: { depth: number; executionChain: string[] },
  ): Promise<{ record: Record<string, unknown>; fields: PropertyDefinition[] }> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureCollectionAccess(context, collection.id, 'create');

    const allProperties = await this.getProperties(collection.id);
    const authorizedFields = await this.authz.getAuthorizedFieldsForCollection(
      context,
      collection.id,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const writableCodes = new Set(authorizedFields.filter((f) => f.canWrite).map((f) => f.code));

    // Create default value context. Expose only readable field codes so any
    // user-authored expression cannot read fields the caller can't read on
    // this collection.
    const readableFieldCodes = authorizedFields
      .filter((f) => f.canRead)
      .map((f) => f.code);
    const defaultValueContext: DefaultValueContext = {
      userId: ctx.userId,
      userName: ctx.username,
      collectionCode,
      collectionId: collection.id,
      record: data,
      isCreate: true,
      authorizedFieldCodes: readableFieldCodes,
    };

    // Apply default values first
    const processedData = await this.defaultValueService.applyDefaults(
      data,
      allProperties,
      defaultValueContext
    );

    // Create validation context
    const validationContext: ValidationContext = {
      record: processedData,
      userId: ctx.userId,
      collectionCode,
      isCreate: true,
    };

    // Validate the data
    const validationResult = await this.validationService.validateRecord(
      processedData,
      allProperties,
      validationContext
    );

    if (!validationResult.isValid) {
      const errors = this.validationService.getErrorMessages(validationResult);
      this.logger.warn(`Validation failed for create in ${collectionCode}: ${errors.join(', ')}`);
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
        details: validationResult.properties.filter((p) => !p.isValid),
      });
    }

    const uniqueViolations = await this.validateUniqueConstraints(
      collection,
      allProperties,
      processedData
    );
    if (uniqueViolations.length > 0) {
      const errors = uniqueViolations.flatMap((issue) =>
        issue.errors.map((error) => error.message).filter(Boolean)
      );
      this.logger.warn(`Uniqueness failed for create in ${collectionCode}: ${errors.join(', ')}`);
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
        details: uniqueViolations,
      });
    }

    // Run before-insert automations: rules may SetField (mutate the
    // pending payload) or Abort (throw 400). The executor sees the
    // post-defaults, post-validation state. parentAutomationContext
    // forwards depth + executionChain so a chain of recursive
    // CreateRecord drains hits MAX_DEPTH instead of looping forever.
    const beforeInsertResult = await this.runBeforeAutomations(
      ctx,
      collection,
      'insert',
      processedData,
      undefined,
      parentAutomationContext,
    );
    const automatedData = beforeInsertResult.modifiedRecord;

    // Re-validate AFTER automations: a SetField rule could have written
    // a value that fails property validation (type mismatch, range,
    // pattern) or violates a uniqueness constraint. Without this
    // pass, the rule's mutation lands in the database despite breaking
    // the property contract.
    if (this.hasAutomationChanges(processedData, automatedData)) {
      const postRuleValidation = await this.validationService.validateRecord(
        automatedData,
        allProperties,
        { ...validationContext, record: automatedData },
      );
      if (!postRuleValidation.isValid) {
        const errors = this.validationService.getErrorMessages(postRuleValidation);
        this.logger.warn(
          `Post-automation validation failed in ${collectionCode}: ${errors.join(', ')}`,
        );
        throw new BadRequestException({
          message: 'Automation rule wrote a value that fails property validation',
          errors,
          details: postRuleValidation.properties.filter((p) => !p.isValid),
        });
      }
      const postRuleUnique = await this.validateUniqueConstraints(
        collection,
        allProperties,
        automatedData,
      );
      if (postRuleUnique.length > 0) {
        const errors = postRuleUnique.flatMap((issue) =>
          issue.errors.map((error) => error.message).filter(Boolean),
        );
        throw new BadRequestException({
          message: 'Automation rule wrote a value that violates a uniqueness constraint',
          errors,
          details: postRuleUnique,
        });
      }
    }

    // Build insert data
    const insertData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(automatedData)) {
      if (!writableCodes.has(key)) continue;
      const prop = allProperties.find((p) => p.code === key);
      if (!prop) continue;

      const col = this.getStorageColumn(prop);
      insertData[col] = value;
    }

    if (Object.keys(insertData).length === 0) {
      throw new BadRequestException('No valid properties to insert');
    }

    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    const createdRow = await withAudit(this.dataSource, async (mgr, recordAudit) => {
      const result = await mgr
        .createQueryBuilder()
        .insert()
        .into(tableName)
        .values(insertData)
        .returning('id')
        .execute();

      const newId = result.identifiers[0]?.id;
      if (!newId) {
        throw new BadRequestException('Failed to create record');
      }

      const record = await this.readRecord(mgr, collection, allProperties, newId);
      if (!record) {
        throw new BadRequestException('Created record could not be loaded');
      }

      recordAudit({
        userId: context.userId,
        action: 'create',
        collectionCode: collection.code,
        recordId: newId,
        newValues: record,
      });

      await this.outboxService.enqueueRecordEvent(
        {
          eventType: 'record.created',
          collectionCode: collection.code,
          recordId: newId,
          record,
          previousRecord: null,
          changedProperties: Object.keys(record || {}),
          userId: context.userId,
        },
        mgr,
      );

      return { id: newId, record };
    });

    // Drain the before-pass asyncQueue now that the parent has
    // committed. CreateRecord, FireEvent, CallFlow, SendNotification
    // attached to before-rules produce their downstream effects
    // here. After-trigger rules then run with the parent record
    // visible. The bumped depth bounds recursive CreateRecord
    // chains: drainQueuedActions → createInternal → executor sees
    // depth+1 → after MAX_DEPTH levels the executor skips its
    // automation pass.
    await this.drainQueuedActions(ctx, collection, createdRow.id, beforeInsertResult.asyncQueue, {
      depth: parentAutomationContext.depth + 1,
      executionChain: parentAutomationContext.executionChain,
    });

    await this.runAfterAutomations(ctx, collection, 'insert', createdRow.record, undefined);

    // Plan §6.5 — formulas + lookups recompute and persist; rollups
    // enqueue a debounced parent-recompute via the outbox;
    // hierarchical maintains the path column. After every save.
    const mergedRecord = await this.runComputedDispatch(
      ctx,
      collection,
      allProperties,
      createdRow.id,
      createdRow.record,
      'create',
    );

    return { record: mergedRecord, fields: allProperties };
  }

  // Update record
  async update(
    ctx: UserRequestContext,
    collectionCode: string,
    id: string,
    data: Record<string, unknown>,
    // Forward executor depth + executionChain so a CreateRecord rule
    // in a before-update pass triggers a downstream update without
    // resetting the recursion-depth gate. Defaults to depth=0 for
    // direct caller invocations from controllers.
    parentAutomationContext: { depth: number; executionChain: string[] } = {
      depth: 0,
      executionChain: [],
    },
  ): Promise<{ record: Record<string, unknown>; fields: PropertyDefinition[] }> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureCollectionAccess(context, collection.id, 'update');

    // Get existing record
    const existingResult = await this.getOne(context, collectionCode, id);
    const existingRecord = existingResult.record;

    const allProperties = await this.getProperties(collection.id);
    const authorizedFields = await this.authz.getAuthorizedFieldsForCollection(
      context,
      collection.id,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const writableCodes = new Set(authorizedFields.filter((f) => f.canWrite).map((f) => f.code));

    // Merge existing record with new data for validation
    const mergedData = { ...existingRecord, ...data };

    // Create validation context for update
    const validationContext: ValidationContext = {
      record: mergedData,
      existingRecord,
      userId: ctx.userId,
      collectionCode,
      isCreate: false,
    };

    // Only validate fields being updated
    const propsToValidate = allProperties.filter((p) => data[p.code] !== undefined);

    if (propsToValidate.length > 0) {
      const validationResult = await this.validationService.validateRecord(
        mergedData,
        propsToValidate,
        validationContext
      );

      if (!validationResult.isValid) {
        const errors = this.validationService.getErrorMessages(validationResult);
        this.logger.warn(`Validation failed for update in ${collectionCode}/${id}: ${errors.join(', ')}`);
        throw new BadRequestException({
          message: 'Validation failed',
          errors,
          details: validationResult.properties.filter((p) => !p.isValid),
        });
      }
    }

    const uniqueProps = allProperties.filter(
      (prop) => prop.isUnique && data[prop.code] !== undefined
    );
    if (uniqueProps.length > 0) {
      const uniqueViolations = await this.validateUniqueConstraints(
        collection,
        uniqueProps,
        mergedData,
        id
      );
      if (uniqueViolations.length > 0) {
        const errors = uniqueViolations.flatMap((issue) =>
          issue.errors.map((error) => error.message).filter(Boolean)
        );
        this.logger.warn(`Uniqueness failed for update in ${collectionCode}/${id}: ${errors.join(', ')}`);
        throw new BadRequestException({
          message: 'Validation failed',
          errors,
          details: uniqueViolations,
        });
      }
    }

    // Run before-update automations against the merged record so the
    // rule sees the post-change state. SetField rules add to / override
    // entries in `data`; Abort rules raise BadRequestException.
    // parentAutomationContext propagates depth + executionChain so a
    // chain of recursive updates hits MAX_DEPTH instead of looping.
    const beforeUpdateResult = await this.runBeforeAutomations(
      ctx,
      collection,
      'update',
      mergedData,
      existingRecord,
      parentAutomationContext,
    );
    const automatedMerged = beforeUpdateResult.modifiedRecord;
    // The executor returns the post-rule merged state. Diff against
    // the pre-rule merged state to capture any SetField mutations and
    // fold them into the data the writer persists.
    const automatedData: Record<string, unknown> = { ...data };
    for (const [key, value] of Object.entries(automatedMerged)) {
      if (mergedData[key] !== value) {
        automatedData[key] = value;
      }
    }

    // Re-validate post-automation. A SetField rule writing an invalid
    // or non-unique value would otherwise persist despite breaking
    // the contract. Only run when the rule actually mutated.
    if (this.hasAutomationChanges(mergedData, automatedMerged)) {
      const propsToReValidate = allProperties.filter(
        (p) => automatedData[p.code] !== undefined,
      );
      if (propsToReValidate.length > 0) {
        const postRuleValidation = await this.validationService.validateRecord(
          automatedMerged,
          propsToReValidate,
          { ...validationContext, record: automatedMerged },
        );
        if (!postRuleValidation.isValid) {
          const errors = this.validationService.getErrorMessages(postRuleValidation);
          this.logger.warn(
            `Post-automation validation failed for update in ${collectionCode}/${id}: ${errors.join(', ')}`,
          );
          throw new BadRequestException({
            message: 'Automation rule wrote a value that fails property validation',
            errors,
            details: postRuleValidation.properties.filter((p) => !p.isValid),
          });
        }
        const uniqueRule = propsToReValidate.filter((p) => p.isUnique);
        if (uniqueRule.length > 0) {
          const postRuleUnique = await this.validateUniqueConstraints(
            collection,
            uniqueRule,
            automatedMerged,
            id,
          );
          if (postRuleUnique.length > 0) {
            const errors = postRuleUnique.flatMap((issue) =>
              issue.errors.map((error) => error.message).filter(Boolean),
            );
            throw new BadRequestException({
              message: 'Automation rule wrote a value that violates a uniqueness constraint',
              errors,
              details: postRuleUnique,
            });
          }
        }
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(automatedData)) {
      if (!writableCodes.has(key)) continue;
      const prop = allProperties.find((p) => p.code === key);
      if (!prop) continue;

      const col = this.getStorageColumn(prop);
      updateData[col] = value;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No valid properties to update');
    }

    updateData['updated_at'] = new Date();

    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    const updatedRow = await withAudit(this.dataSource, async (mgr, recordAudit) => {
      await mgr
        .createQueryBuilder()
        .update(tableName)
        .set(updateData)
        .where('id = :id', { id })
        .execute();

      const row = await this.readRecord(mgr, collection, allProperties, id);
      if (!row) {
        throw new NotFoundException(`Record '${id}' not found after update`);
      }

      recordAudit({
        userId: context.userId,
        action: 'update',
        collectionCode: collection.code,
        recordId: id,
        oldValues: existingRecord,
        newValues: row,
      });

      await this.outboxService.enqueueRecordEvent(
        {
          eventType: 'record.updated',
          collectionCode: collection.code,
          recordId: id,
          record: row,
          previousRecord: existingRecord,
          changedProperties: this.calculateChangedProperties(existingRecord, row),
          userId: context.userId,
        },
        mgr,
      );

      return row;
    });

    // Mirror the createInternal pattern (line ~1409): bump depth so
    // a CreateRecord queued by a before-update can recurse without
    // bypassing MAX_DEPTH. Inherit executionChain from the parent
    // so the executor sees the full run history.
    await this.drainQueuedActions(ctx, collection, id, beforeUpdateResult.asyncQueue, {
      depth: parentAutomationContext.depth + 1,
      executionChain: parentAutomationContext.executionChain,
    });

    await this.runAfterAutomations(ctx, collection, 'update', updatedRow, existingRecord);

    // Plan §6.5 — same dispatch as on create. The previous record
    // is passed so the hierarchical executor can short-circuit
    // when the parent reference hasn't changed.
    const mergedRecord = await this.runComputedDispatch(
      ctx,
      collection,
      allProperties,
      id,
      updatedRow,
      'update',
      existingRecord,
    );

    return { record: mergedRecord, fields: allProperties };
  }

  // Delete record
  async delete(ctx: UserRequestContext, collectionCode: string, id: string): Promise<{ success: boolean }> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureCollectionAccess(context, collection.id, 'delete');

    // Verify record exists
    const existingResult = await this.getOne(context, collectionCode, id);

    // Before-delete automations: rules can Abort the delete (e.g. a
    // policy that forbids removing records past a retention threshold).
    // SetField mutations on a delete are dropped — there is no record
    // post-delete for them to apply to. Side-effect actions
    // (CreateRecord, FireEvent, CallFlow) ARE drained after the
    // delete commits.
    const beforeDeleteResult = await this.runBeforeAutomations(
      ctx,
      collection,
      'delete',
      existingResult.record,
      existingResult.record,
    );

    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    await withAudit(this.dataSource, async (mgr, recordAudit) => {
      const result = await mgr
        .createQueryBuilder()
        .delete()
        .from(tableName)
        .where('id = :id', { id })
        .execute();

      if (result.affected === 0) {
        throw new NotFoundException(`Record '${id}' not found`);
      }

      recordAudit({
        userId: context.userId,
        action: 'delete',
        collectionCode: collection.code,
        recordId: id,
        oldValues: existingResult.record,
      });

      await this.outboxService.enqueueRecordEvent(
        {
          eventType: 'record.deleted',
          collectionCode: collection.code,
          recordId: id,
          record: existingResult.record,
          previousRecord: existingResult.record,
          changedProperties: Object.keys(existingResult.record || {}),
          userId: context.userId,
        },
        mgr,
      );
    });

    await this.drainQueuedActions(ctx, collection, id, beforeDeleteResult.asyncQueue, {
      depth: 1,
      executionChain: [],
    });

    await this.runAfterAutomations(
      ctx,
      collection,
      'delete',
      existingResult.record,
      existingResult.record,
    );

    // Plan §6.5 — recompute parent rollups whose source was this
    // collection. The deleted child contributed to the parent's
    // aggregate; without this enqueue the parent rollup keeps the
    // stale value.
    await this.computedDispatcher.applyOnDelete({
      ctx: {
        userId: ctx.userId ?? 'system',
        username: ctx.username,
        permissions: ctx.permissionCodes,
        roles: ctx.roleCodes,
      },
      collectionCode: collection.code,
      deletedRecord: existingResult.record,
    });

    return { success: true };
  }

  // Bulk operations
  async bulkUpdate(
    ctx: UserRequestContext,
    collectionCode: string,
    ids: string[],
    data: Record<string, unknown>
  ): Promise<{ success: boolean; updatedCount: number; skippedCount: number; skippedIds: string[] }> {
    if (!ids.length) {
      throw new BadRequestException('No IDs provided');
    }

    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureCollectionAccess(context, collection.id, 'update');

    const allProperties = await this.getProperties(collection.id);
    const authorizedFields = await this.authz.getAuthorizedFieldsForCollection(
      context,
      collection.id,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const writableCodes = new Set(authorizedFields.filter((f) => f.canWrite).map((f) => f.code));

    // Filter incoming data to writable properties only — the same
    // silent drop the bulk path has always applied.
    const filteredData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (writableCodes.has(key)) {
        filteredData[key] = value;
      }
    }

    if (Object.keys(filteredData).length === 0) {
      throw new BadRequestException('No valid properties to update');
    }

    // Filter ids through row-level access for the 'update' operation. Each row
    // selected by the caller must independently satisfy RLS predicates.
    const authorizedIds = await this.filterIdsByRowLevel(context, collection.tableName, ids, 'update');
    const accessSkippedIds = ids.filter((id) => !authorizedIds.includes(id));
    if (authorizedIds.length === 0) {
      throw new ForbiddenException('No accessible records in selection');
    }

    // Iterate authorized ids and route each through the single-record
    // `update` pipeline. A bulk SQL UPDATE would silently bypass
    // before/after automations, computed dispatch, and the queued-
    // action drain — plan §6.5 / ADR-4 require these on every
    // mutation path. Per-record cost is the trade-off for correctness;
    // chunk at the caller for very large bulks. Each per-record call
    // already runs in its own withAudit transaction (audit log + outbox
    // emit committed atomically with the SQL write).
    const updatedIds: string[] = [];
    const failureSkippedIds: string[] = [];
    for (const id of authorizedIds) {
      try {
        await this.update(ctx, collectionCode, id, filteredData);
        updatedIds.push(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`bulkUpdate: record ${id} skipped — ${msg}`);
        failureSkippedIds.push(id);
        // Loud, queryable record of the per-row skip so operators can
        // alert on bulk-partial failures rather than scraping logs. The
        // record is still consistent (the row's own update transaction
        // rolled back); we just want visibility into the skip rate.
        await this.runtimeAnomaly.record({
          kind: 'bulk_partial_failure',
          serviceCode: 'svc-data',
          message: `Skipped row during bulk update for ${collection.code}/${id}: ${msg}`,
          collectionCode: collection.code,
          recordId: id,
          context: { operation: 'bulk_update', userId: context.userId },
          error: err as Error,
        });
      }
    }

    const skippedIds = [...accessSkippedIds, ...failureSkippedIds];

    // Write a single bulk-summary audit row alongside the per-record
    // entries already produced inside each `this.update` call. The
    // standalone withAudit transaction here only inserts the audit row;
    // the underlying record changes have already committed.
    await withAudit(this.dataSource, async (_mgr, recordAudit) => {
      recordAudit({
        userId: context.userId,
        action: 'bulk_update',
        collectionCode: collection.code,
        newValues: { ids: updatedIds, data, accessSkippedIds, failureSkippedIds },
      });
    });

    return {
      success: failureSkippedIds.length === 0,
      updatedCount: updatedIds.length,
      skippedCount: skippedIds.length,
      skippedIds,
    };
  }

  async bulkDelete(
    ctx: UserRequestContext,
    collectionCode: string,
    ids: string[],
  ): Promise<{ success: boolean; deletedCount: number; skippedCount: number; skippedIds: string[] }> {
    if (!ids.length) {
      throw new BadRequestException('No IDs provided');
    }

    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureCollectionAccess(context, collection.id, 'delete');

    // Filter ids through row-level access for the 'delete' operation.
    const authorizedIds = await this.filterIdsByRowLevel(context, collection.tableName, ids, 'delete');
    const skippedIds = ids.filter((id) => !authorizedIds.includes(id));
    if (authorizedIds.length === 0) {
      throw new ForbiddenException('No accessible records in selection');
    }

    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    const properties = await this.getProperties(collection.id);

    const { affected, deletedRecords } = await withAudit(
      this.dataSource,
      async (mgr, recordAudit) => {
        const records = await this.fetchRecordsByIdsWithManager(
          mgr,
          collection.tableName,
          authorizedIds,
          properties,
        );

        const result = await mgr
          .createQueryBuilder()
          .delete()
          .from(tableName)
          .whereInIds(authorizedIds)
          .execute();

        recordAudit({
          userId: context.userId,
          action: 'bulk_delete',
          collectionCode: collection.code,
          newValues: { ids: authorizedIds, skippedIds },
        });

        for (const record of records) {
          const recordId = record.id as string;
          await this.outboxService.enqueueRecordEvent(
            {
              eventType: 'record.deleted',
              collectionCode: collection.code,
              recordId,
              record,
              previousRecord: record,
              changedProperties: Object.keys(record || {}),
              userId: context.userId,
            },
            mgr,
          );
        }

        return { affected: result.affected || 0, deletedRecords: records };
      },
    );

    // Plan §6.5 — recompute parent rollups for each deleted child.
    // The processor coalesces by `(parentId, rollupPropertyId)`,
    // so deleting N children of one parent results in one parent
    // recompute, not N. See `applyOnDelete` for the per-row path.
    // Runs post-commit so a transient rollup-write failure cannot
    // undo the deletes that have already landed.
    for (const record of deletedRecords) {
      const recordId = record.id as string;
      try {
        await this.computedDispatcher.applyOnDelete({
          ctx: {
            userId: ctx.userId ?? 'system',
            username: ctx.username,
            permissions: ctx.permissionCodes,
            roles: ctx.roleCodes,
          },
          collectionCode: collection.code,
          deletedRecord: record,
        });
      } catch (err) {
        // Tolerate per-row rollup recompute failure so the rest of the
        // bulk delete still proceeds, but record an anomaly so the gap is
        // queryable. The DB delete itself has already committed.
        this.logger.warn(
          `bulkDelete skipped rollup recompute for ${collection.code}/${recordId}: ${(err as Error).message}`,
        );
        await this.runtimeAnomaly.record({
          kind: 'bulk_partial_failure',
          serviceCode: 'svc-data',
          message: `Skipped rollup recompute during bulk delete for ${collection.code}/${recordId}: ${(err as Error).message}`,
          collectionCode: collection.code,
          recordId,
          context: { operation: 'bulk_delete', userId: context.userId },
          error: err as Error,
        });
      }
    }

    return {
      success: true,
      deletedCount: affected,
      skippedCount: skippedIds.length,
      skippedIds,
    };
  }

  /**
   * Resolve the subset of `ids` the caller is permitted to operate on for a given
   * row-level operation (read/update/delete). Admins bypass; otherwise the same
   * RLS predicates used by getList are applied to constrain the id set.
   */
  private async filterIdsByRowLevel(
    context: UserRequestContext,
    tableName: string,
    ids: string[],
    operation: 'read' | 'update' | 'delete',
  ): Promise<string[]> {
    if (context.isAdmin) {
      return ids;
    }
    const ds = this.dataSource;
    const schemaName = this.ensureSafeIdentifier('public', 'schema');
    const safeTable = this.ensureSafeIdentifier(tableName, 'table');

    const qb = ds
      .createQueryBuilder()
      .select('t.id', 'id')
      .from(`${schemaName}.${safeTable}`, 't')
      .where('t.id IN (:...rls_ids)', { rls_ids: ids });

    const rowLevelClause = await this.authz.buildRowLevelClause(context, tableName, operation, 't');
    if (rowLevelClause.clauses.length > 0) {
      rowLevelClause.clauses.forEach((clause, index) => {
        qb.andWhere(clause, this.prefixParams(rowLevelClause.params, `rls_bk_${index}_`));
      });
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => r.id as string);
  }

  private calculateChangedProperties(
    previousRecord: Record<string, unknown>,
    currentRecord: Record<string, unknown>,
  ): string[] {
    const changes: string[] = [];
    const keys = new Set([...Object.keys(previousRecord || {}), ...Object.keys(currentRecord || {})]);
    for (const key of keys) {
      if (JSON.stringify(previousRecord?.[key]) !== JSON.stringify(currentRecord?.[key])) {
        changes.push(key);
      }
    }
    return changes;
  }

  private async fetchRecordsByIdsWithManager(
    mgr: EntityManager,
    tableName: string,
    ids: string[],
    properties: PropertyDefinition[],
  ): Promise<Record<string, unknown>[]> {
    if (!ids.length) {
      return [];
    }
    const schema = this.ensureSafeIdentifier('public', 'schema');
    const safeTable = this.ensureSafeIdentifier(tableName, 'table');
    const sql = `SELECT * FROM "${schema}"."${safeTable}" WHERE id = ANY($1)`;
    const records = await mgr.query(sql, [ids]);
    return (records as Record<string, unknown>[]).map((row) => this.mapRowToRecord(row, properties));
  }

  private mapRowToRecord(
    row: Record<string, unknown>,
    properties: PropertyDefinition[],
  ): Record<string, unknown> {
    const record: Record<string, unknown> = {
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    for (const property of properties) {
      const column = this.getStorageColumn(property);
      if (column in row) {
        record[property.code] = row[column];
      }
    }

    return record;
  }

  // Get reference data (for dropdowns)
  async getReferenceOptions(
    ctx: UserRequestContext,
    collectionCode: string,
    displayProperty: string,
    search?: string,
    limit = 50
  ): Promise<{ id: string; label: string }[]> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureCollectionAccess(context, collection.id, 'read');

    const properties = await this.getProperties(collection.id);
    const displayProp = properties.find((p) => p.code === displayProperty);

    if (!displayProp) {
      throw new BadRequestException(`Display property '${displayProperty}' not found`);
    }

    const ds = this.dataSource;
    const schemaName = this.ensureSafeIdentifier('public', 'schema');
    const tableNameOnly = this.ensureSafeIdentifier(collection.tableName, 'table');
    const displayCol = this.ensureSafeIdentifier(this.getStorageColumn(displayProp), 'column');

    const qb = ds
      .createQueryBuilder()
      .select(['t."id"', `t."${displayCol}" AS "label"`])
      .from(`${schemaName}.${tableNameOnly}`, 't');

    if (search?.trim()) {
      qb.where(`t."${displayCol}" ILIKE :search`, { search: `%${search}%` });
    }

    qb.orderBy(`t."${displayCol}"`, 'ASC').limit(limit);

    return qb.getRawMany();
  }

  // ============================================================================
  // GROUPED QUERY OPERATIONS
  // ============================================================================

  /**
   * List records grouped by a property - returns group headers with counts
   * This is optimized for large datasets - only returns group summaries, not all data
   */
  async listGrouped(
    ctx: UserRequestContext,
    collectionCode: string,
    groupByField: string,
    options: Omit<QueryOptions, 'groupBy' | 'page' | 'pageSize'> = {}
  ): Promise<GroupedQueryResult> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);

    // Check table-level access
    await this.authz.ensureCollectionAccess(context, collection.id, 'read');

    // Get all properties
    const allProperties = await this.getProperties(collection.id);

    // Filter to readable properties based on property ACLs
    const authorizedFields = await this.authz.getAuthorizedFieldsForCollection(
      context,
      collection.id,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const readableCodes = new Set(authorizedFields.filter((f) => f.canRead).map((f) => f.code));
    let properties = allProperties.filter((p) => readableCodes.has(p.code));

    // Filter properties to only include those with columns that actually exist in the database
    // This prevents errors when property definitions are out of sync with the actual schema
    const actualColumns = await this.getActualColumnNames(collection.tableName);
    properties = properties.filter((p) => {
      const col = this.getStorageColumn(p);
      return actualColumns.has(col);
    });

    // Validate groupBy property exists and is readable
    const groupByProp = properties.find((p) => p.code === groupByField);
    if (!groupByProp) {
      throw new BadRequestException(`Cannot group by field '${groupByField}' - field not found or not accessible`);
    }

    const groupByColumn = this.ensureSafeIdentifier(this.getStorageColumn(groupByProp), 'column');

    const ds = this.dataSource;
    const schemaName = this.ensureSafeIdentifier('public', 'schema');
    const tableNameOnly = this.ensureSafeIdentifier(collection.tableName, 'table');

    // Check if the groupBy property is a reference property
    let referenceJoin: { refTable: string; displayField: string; alias: string } | null = null;
    if (groupByProp.referenceCollectionId) {
      // Look up the referenced collection's table name
      const refCollection = await this.collectionRepo().findOne({
        where: { id: groupByProp.referenceCollectionId },
        select: ['id', 'tableName'],
      });

      if (refCollection && groupByProp.referenceDisplayProperty) {
        const displayField = groupByProp.referenceDisplayProperty;
        try {
          this.ensureSafeIdentifier(refCollection.tableName, 'reference table');
          this.ensureSafeIdentifier(displayField, 'display field');
          referenceJoin = {
            refTable: refCollection.tableName,
            displayField,
            alias: 'ref_grp',
          };
        } catch {
          // Invalid reference config, skip the join
        }
      }
    }

    // Build GROUP BY query
    // If it's a reference field, we select both the ID and display value
    const selectParts = referenceJoin
      ? [
          `t."${groupByColumn}" AS "groupValue"`,
          `${referenceJoin.alias}."${referenceJoin.displayField}" AS "groupDisplayValue"`,
          'COUNT(*) AS "childCount"',
        ]
      : [
          `t."${groupByColumn}" AS "groupValue"`,
          'COUNT(*) AS "childCount"',
        ];

    const qb = ds.createQueryBuilder()
      .select(selectParts)
      .from(`${schemaName}.${tableNameOnly}`, 't');

    // Add LEFT JOIN for reference field
    if (referenceJoin) {
      qb.leftJoin(
        (subQuery: any) =>
          subQuery
            .select([
              `sub_${referenceJoin!.alias}.id AS id`,
              `sub_${referenceJoin!.alias}."${referenceJoin!.displayField}" AS "${referenceJoin!.displayField}"`,
            ])
            .from(`${schemaName}.${referenceJoin!.refTable}`, `sub_${referenceJoin!.alias}`),
        referenceJoin.alias,
        `${referenceJoin.alias}.id = t."${groupByColumn}"`,
      );
    }

    // Group by both the ID and display value (if reference field)
    if (referenceJoin) {
      qb.groupBy(`t."${groupByColumn}", ${referenceJoin.alias}."${referenceJoin.displayField}"`);
    } else {
      qb.groupBy(`t."${groupByColumn}"`);
    }

    // Apply filters
    if (options.filters && options.filters.length > 0) {
      this.buildFilterClause(qb, options.filters, properties, 'f');
    }

    // Apply search
    if (options.search && options.search.trim()) {
      const searchFields = options.searchProperties?.length
        ? options.searchProperties
        : properties.filter((p) => {
            const typeName = this.getPropertyTypeName(p);
            return ['text', 'long_text', 'email', 'string'].includes(typeName);
          }).map((p) => p.code);

      if (searchFields.length > 0) {
        const searchConditions = searchFields
          .map((propCode) => {
            const propDef = properties.find((p) => p.code === propCode);
            if (!propDef) return null;
            const col = this.ensureSafeIdentifier(this.getStorageColumn(propDef), 'column');
            return `t."${col}" ILIKE :search`;
          })
          .filter(Boolean);

        if (searchConditions.length > 0) {
          qb.andWhere(`(${searchConditions.join(' OR ')})`, { search: `%${options.search}%` });
        }
      }
    }

    // Execute with ORDER BY appended (can't use qb.orderBy for raw table queries)
    // Order by display value if reference field, otherwise by raw value
    const [sql, params] = qb.getQueryAndParameters();
    const orderByColumn = referenceJoin
      ? `${referenceJoin.alias}."${referenceJoin.displayField}"`
      : `t."${groupByColumn}"`;
    const groupResults = await this.dataSource.query(`${sql} ORDER BY ${orderByColumn} ASC`, params);

    // Get total record count
    const countQb = ds.createQueryBuilder()
      .select('COUNT(*)', 'total')
      .from(`${schemaName}.${tableNameOnly}`, 't');

    if (options.filters && options.filters.length > 0) {
      this.buildFilterClause(countQb, options.filters, properties, 'f');
    }

    if (options.search && options.search.trim()) {
      const searchFields = options.searchProperties?.length
        ? options.searchProperties
        : properties.filter((p) => {
            const typeName = this.getPropertyTypeName(p);
            return ['text', 'long_text', 'email', 'string'].includes(typeName);
          }).map((p) => p.code);

      if (searchFields.length > 0) {
        const searchConditions = searchFields
          .map((propCode) => {
            const propDef = properties.find((p) => p.code === propCode);
            if (!propDef) return null;
            const col = this.ensureSafeIdentifier(this.getStorageColumn(propDef), 'column');
            return `t."${col}" ILIKE :search`;
          })
          .filter(Boolean);

        if (searchConditions.length > 0) {
          countQb.andWhere(`(${searchConditions.join(' OR ')})`, { search: `%${options.search}%` });
        }
      }
    }

    const countResult = await countQb.getRawOne();
    const totalRecords = parseInt(countResult?.total || '0', 10);

    // Transform to GroupedRow format
    // Use display value for the label if it's a reference field
    const groups: GroupedRow[] = groupResults.map((row: { groupValue: unknown; groupDisplayValue?: unknown; childCount: string }, index: number) => {
      // Use display value if available (reference field), otherwise use raw value
      const displayValue = row.groupDisplayValue ?? row.groupValue;
      return {
        __groupId: `group_${groupByField}_${index}`,
        __isGroup: true as const,
        __groupField: groupByField,
        __groupValue: row.groupValue, // Keep the raw ID for filtering/navigation
        __groupLabel: displayValue !== null ? String(displayValue) : '(Empty)',
        __childCount: parseInt(row.childCount, 10),
        __depth: 0,
      };
    });

    return {
      groups,
      totalGroups: groups.length,
      totalRecords,
      fields: properties,
    };
  }

  /**
   * Get paginated children within a group
   */
  async getGroupChildren(
    ctx: UserRequestContext,
    collectionCode: string,
    groupByField: string,
    groupValue: unknown,
    options: QueryOptions = {}
  ): Promise<GroupChildrenResult> {
    this.logger.debug(`getGroupChildren called: collection=${collectionCode}, groupBy=${groupByField}, groupValue=${JSON.stringify(groupValue)}`);

    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);

    // Check table-level access
    await this.authz.ensureCollectionAccess(context, collection.id, 'read');

    // Get all properties
    const allProperties = await this.getProperties(collection.id);

    // Filter to readable properties based on property ACLs
    const authorizedFields = await this.authz.getAuthorizedFieldsForCollection(
      context,
      collection.id,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const readableCodes = new Set(authorizedFields.filter((f) => f.canRead).map((f) => f.code));
    let properties = allProperties.filter((p) => readableCodes.has(p.code));

    // Filter properties to only include those with columns that actually exist in the database
    // This prevents SELECT errors when property definitions are out of sync with the actual schema
    const actualColumns = await this.getActualColumnNames(collection.tableName);
    properties = properties.filter((p) => {
      const col = this.getStorageColumn(p);
      return actualColumns.has(col);
    });

    // Validate groupBy property exists
    const groupByProp = properties.find((p) => p.code === groupByField);
    if (!groupByProp) {
      throw new BadRequestException(`Field '${groupByField}' not found or not accessible`);
    }

    const groupByColumn = this.ensureSafeIdentifier(this.getStorageColumn(groupByProp), 'column');

    // Pagination
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options.pageSize || DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * pageSize;

    const ds = this.dataSource;
    const schemaName = this.ensureSafeIdentifier('public', 'schema');
    const tableNameOnly = this.ensureSafeIdentifier(collection.tableName, 'table');

    // Build select columns
    const selectParts: string[] = ['t."id"', 't."created_at"', 't."updated_at"'];
    properties.forEach((prop) => {
      const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
      selectParts.push(`t."${col}" AS "${prop.code}"`);
    });

    // Count query for this group
    const countQb = ds.createQueryBuilder()
      .select('COUNT(*)', 'total')
      .from(`${schemaName}.${tableNameOnly}`, 't');

    // Add group filter
    if (groupValue === null) {
      countQb.where(`t."${groupByColumn}" IS NULL`);
    } else {
      countQb.where(`t."${groupByColumn}" = :groupValue`, { groupValue });
    }

    // Apply additional filters
    if (options.filters && options.filters.length > 0) {
      this.buildFilterClause(countQb, options.filters, properties, 'f');
    }

    // Apply search
    if (options.search && options.search.trim()) {
      const searchFields = options.searchProperties?.length
        ? options.searchProperties
        : properties.filter((p) => {
            const typeName = this.getPropertyTypeName(p);
            return ['text', 'long_text', 'email', 'string'].includes(typeName);
          }).map((p) => p.code);

      if (searchFields.length > 0) {
        const searchConditions = searchFields
          .map((propCode) => {
            const propDef = properties.find((p) => p.code === propCode);
            if (!propDef) return null;
            const col = this.ensureSafeIdentifier(this.getStorageColumn(propDef), 'column');
            return `t."${col}" ILIKE :search`;
          })
          .filter(Boolean);

        if (searchConditions.length > 0) {
          countQb.andWhere(`(${searchConditions.join(' OR ')})`, { search: `%${options.search}%` });
        }
      }
    }

    const countResult = await countQb.getRawOne();
    const total = parseInt(countResult?.total || '0', 10);

    // Data query
    const qb = ds.createQueryBuilder()
      .select(selectParts)
      .from(`${schemaName}.${tableNameOnly}`, 't');

    // Add group filter
    if (groupValue === null) {
      qb.where(`t."${groupByColumn}" IS NULL`);
    } else {
      qb.where(`t."${groupByColumn}" = :groupValue`, { groupValue });
    }

    // Apply additional filters
    if (options.filters && options.filters.length > 0) {
      this.buildFilterClause(qb, options.filters, properties, 'f');
    }

    // Apply search
    if (options.search && options.search.trim()) {
      const searchFields = options.searchProperties?.length
        ? options.searchProperties
        : properties.filter((p) => {
            const typeName = this.getPropertyTypeName(p);
            return ['text', 'long_text', 'email', 'string'].includes(typeName);
          }).map((p) => p.code);

      if (searchFields.length > 0) {
        const searchConditions = searchFields
          .map((propCode) => {
            const propDef = properties.find((p) => p.code === propCode);
            if (!propDef) return null;
            const col = this.ensureSafeIdentifier(this.getStorageColumn(propDef), 'column');
            return `t."${col}" ILIKE :search`;
          })
          .filter(Boolean);

        if (searchConditions.length > 0) {
          qb.andWhere(`(${searchConditions.join(' OR ')})`, { search: `%${options.search}%` });
        }
      }
    }

    // Apply sorting - use raw ORDER BY clause since we're querying a raw table, not an entity
    // TypeORM's orderBy() requires entity metadata which isn't available for raw table queries
    const orderByParts: string[] = [];
    if (options.sort && options.sort.length > 0) {
      options.sort.forEach((sort) => {
        const prop = properties.find((p) => p.code === sort.property);
        if (prop) {
          const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
          orderByParts.push(`t."${col}" ${sort.direction.toUpperCase()}`);
        }
      });
    }
    if (orderByParts.length === 0) {
      orderByParts.push('t."created_at" DESC');
    }

    // Apply pagination and get raw SQL with parameters
    // Clear any internal orderBys so TypeORM doesn't try to resolve metadata for the raw alias
    qb.expressionMap.orderBys = {};
    const [sql, params] = qb.offset(offset).limit(pageSize).getQueryAndParameters();

    // Inject ORDER BY before LIMIT/OFFSET
    // The query ends with "LIMIT X OFFSET Y", we inject ORDER BY before that
    const orderBySql = `ORDER BY ${orderByParts.join(', ')}`;
    const limitMatch = sql.match(/(\s+LIMIT\s+\$?\d+)/i);
    let finalSql: string;
    if (limitMatch) {
      finalSql = sql.replace(limitMatch[0], ` ${orderBySql}${limitMatch[0]}`);
    } else {
      finalSql = `${sql} ${orderBySql}`;
    }

    const data = await this.dataSource.query(finalSql, params);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      fields: properties,
    };
  }
}
