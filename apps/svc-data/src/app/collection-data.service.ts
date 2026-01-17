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
  ViewDefinition as ViewEntity,
  ViewDefinitionRevision,
} from '@hubblewave/instance-db';
import { AuthorizationService } from '@hubblewave/authorization';
import { RequestContext } from '@hubblewave/auth-guard';
import { SelectQueryBuilder, ObjectLiteral, DataSource } from 'typeorm';
import { ValidationService } from './validation/validation.service';
import { DefaultValueService } from './defaults/default-value.service';
import { EventOutboxService } from './events/event-outbox.service';
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
    private readonly outboxService: EventOutboxService
  ) {}

  private readonly instanceId = process.env.INSTANCE_ID || 'default-instance';

  private withContext(ctx: RequestContext) {
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

    // Look up collection codes for all referenced collections
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

  private async writeAuditLog(params: {
    userId: string;
    action: string;
    collectionCode: string;
    recordId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    permissionCode?: string | null;
  }): Promise<void> {
    const repo = this.dataSource.getRepository(AuditLog);
    const entry = repo.create({
      userId: params.userId,
      collectionCode: params.collectionCode,
      recordId: params.recordId ?? null,
      action: params.action,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
      permissionCode: params.permissionCode ?? null,
    });
    await repo.save(entry);
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
    ctx: RequestContext,
    collectionCode: string,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);

    // Check table-level access
    await this.authz.ensureTableAccess(context, collection.tableName, 'read');

    // Get all properties
    const allProperties = await this.getProperties(collection.id);

    // Filter to readable properties based on property ACLs
    const authorizedFields = await this.authz.getAuthorizedFields(
      context,
      collection.tableName,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const readableCodes = new Set(authorizedFields.filter((f) => f.canRead).map((f) => f.code));
    const properties = allProperties.filter((p) => readableCodes.has(p.code));

    if (properties.length === 0) {
      throw new ForbiddenException('No readable properties on this collection');
    }

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
    const rowLevelClause = await this.authz.buildRowLevelClause(context, collection.tableName, 'read', 't');
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
  async getOne(ctx: RequestContext, collectionCode: string, id: string): Promise<{ record: Record<string, unknown>; fields: PropertyDefinition[] }> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureTableAccess(context, collection.tableName, 'read');

    const allProperties = await this.getProperties(collection.id);
    const authorizedFields = await this.authz.getAuthorizedFields(
      context,
      collection.tableName,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const readableCodes = new Set(authorizedFields.filter((f) => f.canRead).map((f) => f.code));
    const properties = allProperties.filter((p) => readableCodes.has(p.code));

    if (properties.length === 0) {
      throw new ForbiddenException('No readable properties on this collection');
    }

    const selectParts: string[] = ['t."id"', 't."created_at"', 't."updated_at"'];
    properties.forEach((prop) => {
      const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
      selectParts.push(`t."${col}" AS "${prop.code}"`);
    });

    const ds = this.dataSource;
    const schemaName = this.ensureSafeIdentifier('public', 'schema');
    const tableNameOnly = this.ensureSafeIdentifier(collection.tableName, 'table');

    const qb = ds.createQueryBuilder().select(selectParts).from(`${schemaName}.${tableNameOnly}`, 't').where('t."id" = :id', { id });

    const record = await qb.getRawOne();

    if (!record) {
      throw new NotFoundException(`Record '${id}' not found in collection '${collectionCode}'`);
    }

    return { record, fields: properties };
  }

  // Create record
  async create(
    ctx: RequestContext,
    collectionCode: string,
    data: Record<string, unknown>
  ): Promise<{ record: Record<string, unknown>; fields: PropertyDefinition[] }> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureTableAccess(context, collection.tableName, 'create');

    const allProperties = await this.getProperties(collection.id);
    const authorizedFields = await this.authz.getAuthorizedFields(
      context,
      collection.tableName,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const writableCodes = new Set(authorizedFields.filter((f) => f.canWrite).map((f) => f.code));

    // Create default value context
    const defaultValueContext: DefaultValueContext = {
      userId: ctx.userId,
      userName: ctx.username,
      collectionCode,
      collectionId: collection.id,
      record: data,
      isCreate: true,
    };

    // Apply default values first
    let processedData = await this.defaultValueService.applyDefaults(
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

    // Build insert data
    const insertData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(processedData)) {
      if (!writableCodes.has(key)) continue;
      const prop = allProperties.find((p) => p.code === key);
      if (!prop) continue;

      const col = this.getStorageColumn(prop);
      insertData[col] = value;
    }

    if (Object.keys(insertData).length === 0) {
      throw new BadRequestException('No valid properties to insert');
    }

    const ds = this.dataSource;
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    const result = await ds.createQueryBuilder().insert().into(tableName).values(insertData).returning('id').execute();

    const newId = result.identifiers[0]?.id;
    if (!newId) {
      throw new BadRequestException('Failed to create record');
    }

    const createdRecord = await this.getOne(context, collectionCode, newId);

      await this.writeAuditLog({
        userId: context.userId,
        action: 'create',
        collectionCode: collection.code,
        recordId: newId,
        newValues: createdRecord.record,
      });

      await this.outboxService.enqueueRecordEvent({
        eventType: 'record.created',
        collectionCode: collection.code,
        recordId: newId,
        record: createdRecord.record,
        previousRecord: null,
        changedProperties: Object.keys(createdRecord.record || {}),
        userId: context.userId,
      });

      return createdRecord;
    }

  // Update record
  async update(
    ctx: RequestContext,
    collectionCode: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<{ record: Record<string, unknown>; fields: PropertyDefinition[] }> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureTableAccess(context, collection.tableName, 'update');

    // Get existing record
    const existingResult = await this.getOne(context, collectionCode, id);
    const existingRecord = existingResult.record;

    const allProperties = await this.getProperties(collection.id);
    const authorizedFields = await this.authz.getAuthorizedFields(
      context,
      collection.tableName,
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

    // Build update data
    const updateData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
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

    const ds = this.dataSource;
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    await ds.createQueryBuilder().update(tableName).set(updateData).where('id = :id', { id }).execute();




    const updatedRecord = await this.getOne(context, collectionCode, id);

      await this.writeAuditLog({
        userId: context.userId,
        action: 'update',
        collectionCode: collection.code,
        recordId: id,
        oldValues: existingRecord,
        newValues: updatedRecord.record,
      });

      await this.outboxService.enqueueRecordEvent({
        eventType: 'record.updated',
        collectionCode: collection.code,
        recordId: id,
        record: updatedRecord.record,
        previousRecord: existingRecord,
        changedProperties: this.calculateChangedProperties(existingRecord, updatedRecord.record),
        userId: context.userId,
      });

      return updatedRecord;
    }

  // Delete record
  async delete(ctx: RequestContext, collectionCode: string, id: string): Promise<{ success: boolean }> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureTableAccess(context, collection.tableName, 'delete');

    // Verify record exists
    const existingResult = await this.getOne(context, collectionCode, id);

    const ds = this.dataSource;
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    const result = await ds.createQueryBuilder().delete().from(tableName).where('id = :id', { id }).execute();

    if (result.affected === 0) {
      throw new NotFoundException(`Record '${id}' not found`);
    }

      await this.writeAuditLog({
        userId: context.userId,
        action: 'delete',
        collectionCode: collection.code,
        recordId: id,
        oldValues: existingResult.record,
      });

      await this.outboxService.enqueueRecordEvent({
        eventType: 'record.deleted',
        collectionCode: collection.code,
        recordId: id,
        record: existingResult.record,
        previousRecord: existingResult.record,
        changedProperties: Object.keys(existingResult.record || {}),
        userId: context.userId,
      });

      return { success: true };
    }

  // Bulk operations
  async bulkUpdate(
    ctx: RequestContext,
    collectionCode: string,
    ids: string[],
    data: Record<string, unknown>
  ): Promise<{ success: boolean; updatedCount: number }> {
    if (!ids.length) {
      throw new BadRequestException('No IDs provided');
    }

    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureTableAccess(context, collection.tableName, 'update');

    const allProperties = await this.getProperties(collection.id);
    const authorizedFields = await this.authz.getAuthorizedFields(
      context,
      collection.tableName,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${this.getStorageColumn(p)}`,
        label: this.getLabel(p),
      }))
    );
    const writableCodes = new Set(authorizedFields.filter((f) => f.canWrite).map((f) => f.code));

    const updateData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
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

    const ds = this.dataSource;
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    const properties = await this.getProperties(collection.id);
    const beforeRecords = await this.fetchRecordsByIds(collection.tableName, ids, properties);

    const result = await ds.createQueryBuilder().update(tableName).set(updateData).whereInIds(ids).execute();

    await this.writeAuditLog({
      userId: context.userId,
      action: 'bulk_update',
      collectionCode: collection.code,
      newValues: { ids, data },
    });

    const afterRecords = await this.fetchRecordsByIds(collection.tableName, ids, properties);

    const beforeMap = new Map(beforeRecords.map((record) => [record.id as string, record]));
    for (const record of afterRecords) {
      const recordId = record.id as string;
      const previousRecord = beforeMap.get(recordId) || null;
      await this.outboxService.enqueueRecordEvent({
        eventType: 'record.updated',
        collectionCode: collection.code,
        recordId,
        record,
        previousRecord,
        changedProperties: this.calculateChangedProperties(previousRecord || {}, record),
        userId: context.userId,
      });
    }

    return { success: true, updatedCount: result.affected || 0 };
  }

  async bulkDelete(ctx: RequestContext, collectionCode: string, ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
    if (!ids.length) {
      throw new BadRequestException('No IDs provided');
    }

    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureTableAccess(context, collection.tableName, 'delete');

    const ds = this.dataSource;
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    const properties = await this.getProperties(collection.id);
    const deletedRecords = await this.fetchRecordsByIds(collection.tableName, ids, properties);

    const result = await ds.createQueryBuilder().delete().from(tableName).whereInIds(ids).execute();

    await this.writeAuditLog({
      userId: context.userId,
      action: 'bulk_delete',
      collectionCode: collection.code,
      newValues: { ids },
    });

    for (const record of deletedRecords) {
      const recordId = record.id as string;
      await this.outboxService.enqueueRecordEvent({
        eventType: 'record.deleted',
        collectionCode: collection.code,
        recordId,
        record,
        previousRecord: record,
        changedProperties: Object.keys(record || {}),
        userId: context.userId,
      });
    }

    return { success: true, deletedCount: result.affected || 0 };
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

  private async fetchRecordsByIds(
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
    const records = await this.dataSource.query(sql, [ids]);
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
    ctx: RequestContext,
    collectionCode: string,
    displayProperty: string,
    search?: string,
    limit = 50
  ): Promise<{ id: string; label: string }[]> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureTableAccess(context, collection.tableName, 'read');

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
    ctx: RequestContext,
    collectionCode: string,
    groupByField: string,
    options: Omit<QueryOptions, 'groupBy' | 'page' | 'pageSize'> = {}
  ): Promise<GroupedQueryResult> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);

    // Check table-level access
    await this.authz.ensureTableAccess(context, collection.tableName, 'read');

    // Get all properties
    const allProperties = await this.getProperties(collection.id);

    // Filter to readable properties based on property ACLs
    const authorizedFields = await this.authz.getAuthorizedFields(
      context,
      collection.tableName,
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
    ctx: RequestContext,
    collectionCode: string,
    groupByField: string,
    groupValue: unknown,
    options: QueryOptions = {}
  ): Promise<GroupChildrenResult> {
    this.logger.debug(`getGroupChildren called: collection=${collectionCode}, groupBy=${groupByField}, groupValue=${JSON.stringify(groupValue)}`);

    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);

    // Check table-level access
    await this.authz.ensureTableAccess(context, collection.tableName, 'read');

    // Get all properties
    const allProperties = await this.getProperties(collection.id);

    // Filter to readable properties based on property ACLs
    const authorizedFields = await this.authz.getAuthorizedFields(
      context,
      collection.tableName,
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
