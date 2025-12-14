import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  TenantDbService,
  CollectionDefinition,
  PropertyDefinition,
  ViewDefinition,
  ViewColumn,
  SortConfig as ViewSortConfig,
} from '@eam-platform/tenant-db';
import { AuthorizationService } from '@eam-platform/authorization';
import { RequestContext } from '@eam-platform/auth-guard';
import { IsNull, SelectQueryBuilder, ObjectLiteral } from 'typeorm';

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
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly authz: AuthorizationService
  ) {}

  private ensureSafeIdentifier(value: string, label: string): string {
    if (!value || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new BadRequestException(`Invalid ${label} name: ${value}`);
    }
    return value;
  }

  // Repository helpers
  private async collectionRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(CollectionDefinition);
  }

  private async propertyRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(PropertyDefinition);
  }

  private async viewRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(ViewDefinition);
  }

  private async viewColumnRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(ViewColumn);
  }

  // Get collection by code or ID
  async getCollection(tenantId: string, codeOrId: string): Promise<CollectionDefinition> {
    const repo = await this.collectionRepo(tenantId);

    // Try by ID first (UUID format)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codeOrId);

    const collection = await repo.findOne({
      where: isUuid
        ? { id: codeOrId, deletedAt: IsNull() }
        : { code: codeOrId, deletedAt: IsNull() },
    });

    if (!collection) {
      throw new NotFoundException(`Collection '${codeOrId}' not found`);
    }

    return collection;
  }

  // Get all properties for a collection
  async getProperties(tenantId: string, collectionId: string): Promise<PropertyDefinition[]> {
    const repo = await this.propertyRepo(tenantId);

    return repo.find({
      where: { collectionId, deletedAt: IsNull() },
      order: { sortOrder: 'ASC', code: 'ASC' },
    });
  }

  // Get view definition with columns
  async getViewWithColumns(tenantId: string, viewId: string): Promise<{ view: ViewDefinition; columns: ViewColumn[] }> {
    const viewRepository = await this.viewRepo(tenantId);
    const columnRepository = await this.viewColumnRepo(tenantId);

    const view = await viewRepository.findOne({
      where: { id: viewId, deletedAt: IsNull() },
    });

    if (!view) {
      throw new NotFoundException(`View '${viewId}' not found`);
    }

    const columns = await columnRepository.find({
      where: { viewId },
      order: { sortOrder: 'ASC' },
    });

    return { view, columns };
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

      const column = this.ensureSafeIdentifier(property.storageColumn || property.code, 'column');
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

  // List records from a collection
  async list(
    ctx: RequestContext,
    collectionCode: string,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const collection = await this.getCollection(ctx.tenantId, collectionCode);

    // Check table-level access
    await this.authz.ensureTableAccess(ctx, collection.storageTable, 'read');

    // Get all properties
    const allProperties = await this.getProperties(ctx.tenantId, collection.id);

    // Filter to readable fields based on field ACLs
    const readableProperties = await this.authz.filterReadableFields(
      ctx,
      collection.storageTable,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${p.storageColumn || p.code}`,
        label: p.label,
      }))
    );
    const readableCodes = new Set(readableProperties.map((f) => f.code));
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
      const viewData = await this.getViewWithColumns(ctx.tenantId, options.viewId);
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
          const prop = properties.find((p) => p.code === vc.propertyCode);
          if (prop) {
            const col = this.ensureSafeIdentifier(prop.storageColumn || prop.code, 'column');
            selectParts.push(`t."${col}" AS "${prop.code}"`);
          }
        });
    } else {
      // Default: all readable properties
      properties.forEach((prop) => {
        const col = this.ensureSafeIdentifier(prop.storageColumn || prop.code, 'column');
        selectParts.push(`t."${col}" AS "${prop.code}"`);
      });
    }

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const tableName = `"${this.ensureSafeIdentifier('public', 'schema')}"."${this.ensureSafeIdentifier(collection.storageTable, 'table')}"`;

    // Count query
    const countQb = ds.createQueryBuilder().select('COUNT(*)', 'total').from(tableName, 't');

    // Apply filters
    const allFilters = [...(options.filters || []), ...(view?.conditions || [])];
    if (allFilters.length > 0) {
      this.buildFilterClause(countQb, allFilters as FilterCondition[], properties, 'f');
    }

    // Apply search
    if (options.search && options.search.trim()) {
      const searchFields = options.searchFields?.length
        ? options.searchFields
        : properties.filter((p) => ['text', 'string', 'email'].includes(p.propertyType)).map((p) => p.code);

      if (searchFields.length > 0) {
        const searchConditions = searchFields
          .map((field) => {
            const prop = properties.find((p) => p.code === field);
            if (!prop) return null;
            const col = this.ensureSafeIdentifier(prop.storageColumn || prop.code, 'column');
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
    const qb = ds.createQueryBuilder().select(selectParts).from(tableName, 't');

    // Apply same filters
    if (allFilters.length > 0) {
      this.buildFilterClause(qb, allFilters as FilterCondition[], properties, 'f');
    }

    // Apply same search
    if (options.search && options.search.trim()) {
      const searchFields = options.searchFields?.length
        ? options.searchFields
        : properties.filter((p) => ['text', 'string', 'email'].includes(p.propertyType)).map((p) => p.code);

      if (searchFields.length > 0) {
        const searchConditions = searchFields
          .map((field) => {
            const prop = properties.find((p) => p.code === field);
            if (!prop) return null;
            const col = this.ensureSafeIdentifier(prop.storageColumn || prop.code, 'column');
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
    const sortOptions = options.sort?.length ? options.sort : view?.sortConfig || [];
    if (sortOptions.length > 0) {
      sortOptions.forEach((sort, idx) => {
        const fieldCode = (sort as SortOption).field || (sort as ViewSortConfig).propertyCode;
        const prop = properties.find((p) => p.code === fieldCode);
        if (prop) {
          const col = this.ensureSafeIdentifier(prop.storageColumn || prop.code, 'column');
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
    const collection = await this.getCollection(ctx.tenantId, collectionCode);
    await this.authz.ensureTableAccess(ctx, collection.storageTable, 'read');

    const allProperties = await this.getProperties(ctx.tenantId, collection.id);
    const readableProperties = await this.authz.filterReadableFields(
      ctx,
      collection.storageTable,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${p.storageColumn || p.code}`,
        label: p.label,
      }))
    );
    const readableCodes = new Set(readableProperties.map((f) => f.code));
    const properties = allProperties.filter((p) => readableCodes.has(p.code));

    if (properties.length === 0) {
      throw new ForbiddenException('No readable fields on this collection');
    }

    const selectParts: string[] = ['t."id"', 't."created_at"', 't."updated_at"'];
    properties.forEach((prop) => {
      const col = this.ensureSafeIdentifier(prop.storageColumn || prop.code, 'column');
      selectParts.push(`t."${col}" AS "${prop.code}"`);
    });

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const tableName = `"${this.ensureSafeIdentifier('public', 'schema')}"."${this.ensureSafeIdentifier(collection.storageTable, 'table')}"`;

    const qb = ds.createQueryBuilder().select(selectParts).from(tableName, 't').where('t."id" = :id', { id });

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
    const collection = await this.getCollection(ctx.tenantId, collectionCode);
    await this.authz.ensureTableAccess(ctx, collection.storageTable, 'create');

    const allProperties = await this.getProperties(ctx.tenantId, collection.id);
    const writableProperties = await this.authz.filterWritableFields(
      ctx,
      collection.storageTable,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${p.storageColumn || p.code}`,
        label: p.label,
      }))
    );
    const writableCodes = new Set(writableProperties.map((f) => f.code));

    // Validate required fields
    for (const prop of allProperties) {
      if (prop.isRequired && !prop.defaultValue && data[prop.code] === undefined) {
        throw new BadRequestException(`Field '${prop.label}' is required`);
      }
    }

    // Build insert data
    const insertData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (!writableCodes.has(key)) continue;
      const prop = allProperties.find((p) => p.code === key);
      if (!prop) continue;

      const col = prop.storageColumn || prop.code;
      insertData[col] = value;
    }

    // Apply defaults
    for (const prop of allProperties) {
      const col = prop.storageColumn || prop.code;
      if (insertData[col] === undefined && prop.defaultValue !== undefined) {
        insertData[col] = prop.defaultValue;
      }
    }

    if (Object.keys(insertData).length === 0) {
      throw new BadRequestException('No valid fields to insert');
    }

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.storageTable, 'table')}`;

    const result = await ds.createQueryBuilder().insert().into(tableName).values(insertData).returning('id').execute();

    const newId = result.identifiers[0]?.id;
    if (!newId) {
      throw new BadRequestException('Failed to create record');
    }

    return this.getOne(ctx, collectionCode, newId);
  }

  // Update record
  async update(
    ctx: RequestContext,
    collectionCode: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<{ record: Record<string, unknown>; fields: PropertyDefinition[] }> {
    const collection = await this.getCollection(ctx.tenantId, collectionCode);
    await this.authz.ensureTableAccess(ctx, collection.storageTable, 'update');

    // Verify record exists
    await this.getOne(ctx, collectionCode, id);

    const allProperties = await this.getProperties(ctx.tenantId, collection.id);
    const writableProperties = await this.authz.filterWritableFields(
      ctx,
      collection.storageTable,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${p.storageColumn || p.code}`,
        label: p.label,
      }))
    );
    const writableCodes = new Set(writableProperties.map((f) => f.code));

    // Build update data
    const updateData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (!writableCodes.has(key)) continue;
      const prop = allProperties.find((p) => p.code === key);
      if (!prop) continue;

      const col = prop.storageColumn || prop.code;
      updateData[col] = value;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    updateData['updated_at'] = new Date();

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.storageTable, 'table')}`;

    await ds.createQueryBuilder().update(tableName).set(updateData).where('id = :id', { id }).execute();

    return this.getOne(ctx, collectionCode, id);
  }

  // Delete record
  async delete(ctx: RequestContext, collectionCode: string, id: string): Promise<{ success: boolean }> {
    const collection = await this.getCollection(ctx.tenantId, collectionCode);
    await this.authz.ensureTableAccess(ctx, collection.storageTable, 'delete');

    // Verify record exists
    await this.getOne(ctx, collectionCode, id);

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.storageTable, 'table')}`;

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

    const collection = await this.getCollection(ctx.tenantId, collectionCode);
    await this.authz.ensureTableAccess(ctx, collection.storageTable, 'update');

    const allProperties = await this.getProperties(ctx.tenantId, collection.id);
    const writableProperties = await this.authz.filterWritableFields(
      ctx,
      collection.storageTable,
      allProperties.map((p) => ({
        code: p.code,
        storagePath: `column:${p.storageColumn || p.code}`,
        label: p.label,
      }))
    );
    const writableCodes = new Set(writableProperties.map((f) => f.code));

    const updateData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (!writableCodes.has(key)) continue;
      const prop = allProperties.find((p) => p.code === key);
      if (!prop) continue;

      const col = prop.storageColumn || prop.code;
      updateData[col] = value;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    updateData['updated_at'] = new Date();

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.storageTable, 'table')}`;

    const result = await ds.createQueryBuilder().update(tableName).set(updateData).whereInIds(ids).execute();

    return { success: true, updatedCount: result.affected || 0 };
  }

  async bulkDelete(ctx: RequestContext, collectionCode: string, ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
    if (!ids.length) {
      throw new BadRequestException('No IDs provided');
    }

    const collection = await this.getCollection(ctx.tenantId, collectionCode);
    await this.authz.ensureTableAccess(ctx, collection.storageTable, 'delete');

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(collection.storageTable, 'table')}`;

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
    const collection = await this.getCollection(ctx.tenantId, collectionCode);
    await this.authz.ensureTableAccess(ctx, collection.storageTable, 'read');

    const properties = await this.getProperties(ctx.tenantId, collection.id);
    const displayProp = properties.find((p) => p.code === displayField);

    if (!displayProp) {
      throw new BadRequestException(`Display field '${displayField}' not found`);
    }

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const tableName = `"${this.ensureSafeIdentifier('public', 'schema')}"."${this.ensureSafeIdentifier(collection.storageTable, 'table')}"`;
    const displayCol = this.ensureSafeIdentifier(displayProp.storageColumn || displayProp.code, 'column');

    const qb = ds
      .createQueryBuilder()
      .select(['t."id"', `t."${displayCol}" AS "label"`])
      .from(tableName, 't');

    if (search?.trim()) {
      qb.where(`t."${displayCol}" ILIKE :search`, { search: `%${search}%` });
    }

    qb.orderBy(`t."${displayCol}"`, 'ASC').limit(limit);

    return qb.getRawMany();
  }
}
