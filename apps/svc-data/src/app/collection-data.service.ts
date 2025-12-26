import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  CollectionDefinition,
  PropertyDefinition,
} from '@hubblewave/instance-db';
import { AuthorizationService } from '@hubblewave/authorization';
import { RequestContext } from '@hubblewave/auth-guard';
import { SelectQueryBuilder, ObjectLiteral, DataSource } from 'typeorm';
import { ValidationService } from './validation/validation.service';
import { DefaultValueService } from './defaults/default-value.service';
import { ValidationContext } from './validation/validation.types';
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
    config: Record<string, unknown>;
    isActive: boolean;
}

// Query DTOs
export interface QueryOptions {
  page?: number;
  pageSize?: number;
  sort?: SortOption[];
  filters?: FilterCondition[];
  search?: string;
  searchFields?: string[];
  groupBy?: string;
  viewId?: string;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterCondition {
  field: string;
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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;



@Injectable()
export class CollectionDataService {
  private readonly logger = new Logger(CollectionDataService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly authz: AuthorizationService,

    private readonly validationService: ValidationService,
    private readonly defaultValueService: DefaultValueService
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

  // Views disabled
  // private viewRepo() { return this.dataSource.getRepository(ViewDefinition); }
  // private viewColumnRepo() { return this.dataSource.getRepository(ViewColumn); }

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

  // Repository helpers
  // Get collection by code or ID - falls back to database introspection if not defined
  async getCollection(codeOrId: string): Promise<CollectionDefinition> {
    const repo = this.collectionRepo();

    // Try by ID first (UUID format)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codeOrId);

    const collection = await repo.findOne({
      where: isUuid
        ? { id: codeOrId, isActive: true }
        : { code: codeOrId, isActive: true },
    });

    if (collection) {
      return collection;
    }

    // Fallback: Check if table exists in database and create virtual collection
    const tableName = codeOrId.toLowerCase();
    const tableExists = await this.checkTableExists(tableName);

    if (!tableExists) {
      throw new NotFoundException(`Collection '${codeOrId}' not found`);
    }

    // Return a virtual collection definition based on the table
    return this.createVirtualCollection(tableName);
  }

  // Check if a table exists in the database
  private async checkTableExists(tableName: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = $1
      )`,
      [tableName]
    );
    return result[0]?.exists === true;
  }

  // Create a virtual collection definition from database table
  private createVirtualCollection(tableName: string): CollectionDefinition {
    // Convert table_name to Title Case label
    const label = tableName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Create a virtual collection (not persisted)
    const collection = new CollectionDefinition();
    collection.id = `virtual:${tableName}`;
    collection.code = tableName;
    collection.name = label;
    collection.tableName = tableName;
    collection.isActive = true;
    collection.isSystem = true;
    collection.description = `Auto-discovered table: ${tableName}`;

    return collection;
  }

  // Get all properties for a collection - falls back to database introspection
  async getProperties(collectionId: string): Promise<PropertyDefinition[]> {
    // Check if this is a virtual collection (introspected from database)
    if (collectionId.startsWith('virtual:')) {
      const tableName = collectionId.replace('virtual:', '');
      return this.getPropertiesFromSchema(tableName);
    }

    const repo = this.propertyRepo();

    const properties = await repo.find({
      where: { collectionId, isActive: true },
      order: { position: 'ASC', code: 'ASC' },
    });

    // If no properties defined, try to introspect from database
    if (properties.length === 0) {
      // Get the collection to find the table name
      const collection = await this.collectionRepo().findOne({ where: { id: collectionId } });
      if (collection?.tableName) {
        return this.getPropertiesFromSchema(collection.tableName);
      }
    }

    return properties;
  }

  // Introspect database schema to get column definitions as properties
  private async getPropertiesFromSchema(tableName: string): Promise<PropertyDefinition[]> {
    const columns = await this.dataSource.query(
      `SELECT
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position`,
      [tableName]
    );

    return columns.map((col: {
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
      character_maximum_length: number | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
      ordinal_position: number;
    }, index: number) => {
      const propertyType = this.pgTypeToPropertyType(col.data_type, col.udt_name);

      // Create a partial PropertyDefinition-like object for virtual properties
      // Using 'as PropertyDefinition' to satisfy TypeScript while allowing virtual properties
      const prop = {
        id: `virtual:${tableName}:${col.column_name}`,
        collectionId: `virtual:${tableName}`,
        code: col.column_name,
        name: this.columnNameToLabel(col.column_name),
        columnName: col.column_name,
        // Store the property type name in config.dataType for virtual properties
        propertyTypeId: `virtual:${propertyType}`,
        config: {
          dataType: propertyType,
          maxLength: col.character_maximum_length,
          precision: col.numeric_precision,
          scale: col.numeric_scale,
        },
        isRequired: col.is_nullable === 'NO' && !col.column_default,
        isActive: true,
        isVisible: true,
        isReadonly: false,
        isSortable: true,
        isFilterable: true,
        isSearchable: ['text', 'string', 'email'].includes(propertyType),
        position: index,
        validationRules: col.character_maximum_length
          ? { maxLength: col.character_maximum_length }
          : {},
        metadata: {},
        ownerType: 'system' as const,
        isSystem: true,
        isUnique: false,
        isIndexed: false,
        defaultValueType: 'static' as const,
      } as unknown as PropertyDefinition;

      return prop;
    });
  }

  // Convert column_name to "Column Name" label
  private columnNameToLabel(columnName: string): string {
    return columnName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Map PostgreSQL types to our property types
  private pgTypeToPropertyType(dataType: string, udtName: string): string {
    const typeMap: Record<string, string> = {
      // String types
      'character varying': 'string',
      'varchar': 'string',
      'character': 'string',
      'char': 'string',
      'text': 'text',
      'citext': 'string',

      // Numeric types
      'integer': 'integer',
      'int': 'integer',
      'int4': 'integer',
      'smallint': 'integer',
      'int2': 'integer',
      'bigint': 'integer',
      'int8': 'integer',
      'numeric': 'decimal',
      'decimal': 'decimal',
      'real': 'decimal',
      'float4': 'decimal',
      'double precision': 'decimal',
      'float8': 'decimal',
      'money': 'currency',

      // Boolean
      'boolean': 'boolean',
      'bool': 'boolean',

      // Date/Time types
      'date': 'date',
      'timestamp without time zone': 'datetime',
      'timestamp with time zone': 'datetime',
      'timestamptz': 'datetime',
      'timestamp': 'datetime',
      'time without time zone': 'time',
      'time with time zone': 'time',
      'interval': 'duration',

      // UUID
      'uuid': 'uuid',

      // JSON
      'json': 'json',
      'jsonb': 'json',

      // Arrays
      'ARRAY': 'array',

      // Other
      'bytea': 'binary',
      'inet': 'string',
      'cidr': 'string',
      'macaddr': 'string',
    };

    // Check udt_name for enum types
    if (dataType === 'USER-DEFINED') {
      return 'choice'; // Likely an enum
    }

    return typeMap[dataType.toLowerCase()] || typeMap[udtName.toLowerCase()] || 'string';
  }

  // Get view definition with columns
  async getViewWithColumns(viewId: string): Promise<{ view: ViewDefinition; columns: ViewColumn[] }> {
      // Views currently disabled during refactor
      throw new NotFoundException(`View '${viewId}' support currently disabled`);
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
      const property = propertyMap.get(filter.field);
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

    // Filter to readable fields based on field ACLs
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
      throw new ForbiddenException('No readable fields on this collection');
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

    // Apply filters
    // View filters are stored in config.filters (GridViewConfig)
    const viewFilters = (view?.config as Record<string, unknown>)?.filters as { conditions?: FilterCondition[] } | undefined;
    const allFilters = [...(options.filters || []), ...(viewFilters?.conditions || [])];
    if (allFilters.length > 0) {
      this.buildFilterClause(countQb, allFilters as FilterCondition[], properties, 'f');
    }

    // Apply search
    if (options.search && options.search.trim()) {
      const searchFields = options.searchFields?.length
        ? options.searchFields
        : properties.filter((p) => {
            const typeName = this.getPropertyTypeName(p);
            return ['text', 'long_text', 'email', 'string'].includes(typeName);
          }).map((p) => p.code);

      if (searchFields.length > 0) {
        const searchConditions = searchFields
          .map((field) => {
            const prop = properties.find((p) => p.code === field);
            if (!prop) return null;
            const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
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

    // Apply same filters
    if (allFilters.length > 0) {
      this.buildFilterClause(qb, allFilters as FilterCondition[], properties, 'f');
    }

    // Apply same search
    if (options.search && options.search.trim()) {
      const searchFields = options.searchFields?.length
        ? options.searchFields
        : properties.filter((p) => {
            const typeName = this.getPropertyTypeName(p);
            return ['text', 'long_text', 'email', 'string'].includes(typeName);
          }).map((p) => p.code);

      if (searchFields.length > 0) {
        const searchConditions = searchFields
          .map((field) => {
            const prop = properties.find((p) => p.code === field);
            if (!prop) return null;
            const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
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
    const viewSort = (view?.config as Record<string, unknown>)?.sort as ViewSortConfig[] | undefined;
    const sortOptions: Array<SortOption | ViewSortConfig> = options.sort?.length ? options.sort : (viewSort || []);
    if (sortOptions.length > 0) {
      sortOptions.forEach((sort: SortOption | ViewSortConfig, idx: number) => {
        const fieldCode = (sort as SortOption).field || (sort as ViewSortConfig).propertyCode;
        const prop = properties.find((p) => p.code === fieldCode);
        if (prop) {
          const col = this.ensureSafeIdentifier(this.getStorageColumn(prop), 'column');
          if (idx === 0) {
            qb.orderBy(`t."${col}"`, sort.direction.toUpperCase() as 'ASC' | 'DESC');
          } else {
            qb.addOrderBy(`t."${col}"`, sort.direction.toUpperCase() as 'ASC' | 'DESC');
          }
        }
      });
    } else {
      qb.orderBy('t."created_at"', 'DESC');
    }

    // Apply pagination
    qb.offset(offset).limit(pageSize);

    const data = await qb.getRawMany();

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
      throw new ForbiddenException('No readable fields on this collection');
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
        details: validationResult.fields.filter((f) => !f.isValid),
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
      throw new BadRequestException('No valid fields to insert');
    }

    const ds = this.dataSource;
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    const result = await ds.createQueryBuilder().insert().into(tableName).values(insertData).returning('id').execute();

    const newId = result.identifiers[0]?.id;
    if (!newId) {
      throw new BadRequestException('Failed to create record');
    }

    const createdRecord = await this.getOne(context, collectionCode, newId);



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
          details: validationResult.fields.filter((f) => !f.isValid),
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
      throw new BadRequestException('No valid fields to update');
    }

    updateData['updated_at'] = new Date();

    const ds = this.dataSource;
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    await ds.createQueryBuilder().update(tableName).set(updateData).where('id = :id', { id }).execute();




    const updatedRecord = await this.getOne(context, collectionCode, id);

    return updatedRecord;
  }

  // Delete record
  async delete(ctx: RequestContext, collectionCode: string, id: string): Promise<{ success: boolean }> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureTableAccess(context, collection.tableName, 'delete');

    // Verify record exists
    await this.getOne(context, collectionCode, id);

    const ds = this.dataSource;
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    const result = await ds.createQueryBuilder().delete().from(tableName).where('id = :id', { id }).execute();

    if (result.affected === 0) {
      throw new NotFoundException(`Record '${id}' not found`);
    }

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
      throw new BadRequestException('No valid fields to update');
    }

    updateData['updated_at'] = new Date();

    const ds = this.dataSource;
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.tableName, 'table')}`;

    const result = await ds.createQueryBuilder().update(tableName).set(updateData).whereInIds(ids).execute();

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

    const result = await ds.createQueryBuilder().delete().from(tableName).whereInIds(ids).execute();

    return { success: true, deletedCount: result.affected || 0 };
  }

  // Get reference data (for dropdowns)
  async getReferenceOptions(
    ctx: RequestContext,
    collectionCode: string,
    displayField: string,
    search?: string,
    limit = 50
  ): Promise<{ id: string; label: string }[]> {
    const context = this.withContext(ctx);
    const collection = await this.getCollection(collectionCode);
    await this.authz.ensureTableAccess(context, collection.tableName, 'read');

    const properties = await this.getProperties(collection.id);
    const displayProp = properties.find((p) => p.code === displayField);

    if (!displayProp) {
      throw new BadRequestException(`Display field '${displayField}' not found`);
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
}
