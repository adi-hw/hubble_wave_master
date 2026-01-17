/**
 * GridQueryService - High-performance grid data service for SSRM
 *
 * Features:
 * - Block-based data fetching for virtualized grids
 * - Complex filtering with multiple conditions
 * - Multi-column sorting
 * - Grouping with aggregations
 * - Optimized count queries
 * - ABAC/RLS integration
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { AuthorizationService, AuthorizedPropertyMeta } from '@hubblewave/authorization';
import { RequestContext } from '@hubblewave/auth-guard';
import { ModelRegistryService } from '../model-registry.service';


// =============================================================================
// TYPES
// =============================================================================

export interface GridQueryRequest {
  collection: string;
  startRow: number;
  endRow: number;
  sorting?: GridSortModel[];
  filters?: GridFilterModel[];
  grouping?: GridGroupModel;
  globalFilter?: string;
}

export interface GridSortModel {
  column: string;
  direction: 'asc' | 'desc';
}

export interface GridFilterModel {
  column: string;
  operator: GridFilterOperator;
  value: unknown;
  value2?: unknown; // For between operator
}

export type GridFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between'
  | 'inList'
  | 'notInList'
  | 'isNull'
  | 'isNotNull'
  | 'isEmpty'
  | 'isNotEmpty';

export interface GridGroupModel {
  columns: string[];
  aggregations?: GridAggregation[];
}

export interface GridAggregation {
  column: string;
  function: 'sum' | 'avg' | 'min' | 'max' | 'count';
  alias?: string;
}

export interface GridQueryResponse<T = unknown> {
  rows: T[];
  rowCount: number;
  lastRow: number;
  groupData?: GridGroupData[];
}

export interface GridGroupData {
  groupKey: string[];
  groupValue: unknown[];
  childCount: number;
  aggregations?: Record<string, number>;
}

export interface GridCountRequest {
  collection: string;
  filters?: GridFilterModel[];
  grouping?: GridGroupModel;
  globalFilter?: string;
}

/**
 * Extended property info for reference handling
 */
interface ReferencePropertyInfo {
  code: string;
  storagePath: string;
  config?: {
    referenceCollection?: string | null;
    referenceDisplayProperty?: string | null;
  };
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class GridQueryService {
  constructor(
    private readonly modelRegistry: ModelRegistryService,
    private readonly dataSource: DataSource,
    private readonly authz: AuthorizationService,
  ) {}

  // ---------------------------------------------------------------------------
  // QUERY DATA
  // ---------------------------------------------------------------------------

  async query<T = unknown>(
    ctx: RequestContext,
    request: GridQueryRequest,
  ): Promise<GridQueryResponse<T>> {
    const { collection, startRow, endRow, sorting, filters, globalFilter } = request;
    // Note: grouping is handled in queryGrouped method

    // Validate pagination
    if (startRow < 0 || endRow < startRow) {
      throw new BadRequestException('Invalid row range');
    }

    const limit = endRow - startRow;
    const skip = startRow;

    // Get table metadata
    const model = await this.modelRegistry.getCollection(collection);
    await this.authz.ensureTableAccess(ctx, model.storageTable, 'read');

    // Get readable fields
    const allFields = await this.modelRegistry.getProperties(collection, ctx.roles);
    const readableFields = await this.authz.filterReadableFields(ctx, model.storageTable, allFields);

    if (!readableFields.length) {
      throw new ForbiddenException('No readable properties on this collection');
    }

    // Build select columns
    const selectParts = this.buildSelectParts(readableFields);

    // Build query
    const qb = this.dataSource
      .createQueryBuilder()
      .select(selectParts)
      .from(this.buildPhysicalTableForQb(model), 't');

    // Add LEFT JOINs for reference fields to fetch display values
    this.buildReferenceJoins(qb, readableFields);

    // Apply RLS
    const { clauses: rlsClauses, params: rlsParams } = await this.authz.buildRowLevelClause(
      ctx,
      model.storageTable,
      'read',
      't',
    );
    rlsClauses.forEach((clause) => qb.andWhere(clause));
    qb.setParameters({ ...this.buildAbacParams(ctx), ...rlsParams });

    // Apply filters
    this.applyFilters(qb, filters, readableFields, allFields);

    // Apply global filter
    if (globalFilter) {
      this.applyGlobalFilter(qb, globalFilter, readableFields, allFields);
    }

    // Apply sorting
    this.applySorting(qb, sorting, readableFields, allFields);

    // Apply pagination
    qb.offset(skip).limit(limit);

    // Execute query
    const rows = await qb.getRawMany();

    // Mask sensitive data
    const maskedRows = await Promise.all(
      rows.map((row) =>
        this.authz.maskRecord(ctx, model.storageTable, row, readableFields as AuthorizedPropertyMeta[]),
      ),
    );

    // Get total count for the filtered dataset
    const rowCount = await this.getFilteredCount(ctx, request);

    return {
      rows: maskedRows as T[],
      rowCount,
      lastRow: startRow + maskedRows.length,
    };
  }

  // ---------------------------------------------------------------------------
  // COUNT
  // ---------------------------------------------------------------------------

  async count(ctx: RequestContext, request: GridCountRequest): Promise<number> {
    const { collection, filters, globalFilter } = request;

    // Get table metadata
    const model = await this.modelRegistry.getCollection(collection);
    await this.authz.ensureTableAccess(ctx, model.storageTable, 'read');

    // Get readable fields for filtering
    const allFields = await this.modelRegistry.getProperties(collection, ctx.roles);
    const readableFields = await this.authz.filterReadableFields(ctx, model.storageTable, allFields);

    // Build count query
    const qb = this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'total')
      .from(this.buildPhysicalTableForQb(model), 't');

    // Apply RLS
    const { clauses: rlsClauses, params: rlsParams } = await this.authz.buildRowLevelClause(
      ctx,
      model.storageTable,
      'read',
      't',
    );
    rlsClauses.forEach((clause) => qb.andWhere(clause));
    qb.setParameters({ ...this.buildAbacParams(ctx), ...rlsParams });

    // Apply filters
    this.applyFilters(qb, filters, readableFields, allFields);

    // Apply global filter
    if (globalFilter) {
      this.applyGlobalFilter(qb, globalFilter, readableFields, allFields);
    }

    const result = await qb.getRawOne();
    return parseInt(result?.total || '0', 10);
  }

  // ---------------------------------------------------------------------------
  // GROUPED QUERY (for tree/group views)
  // ---------------------------------------------------------------------------

  async queryGrouped<T = unknown>(
    ctx: RequestContext,
    request: GridQueryRequest,
  ): Promise<GridQueryResponse<T>> {
    const { collection, grouping, filters, globalFilter, startRow, endRow } = request;

    if (!grouping?.columns?.length) {
      return this.query<T>(ctx, request);
    }

    // Get table metadata
    const model = await this.modelRegistry.getCollection(collection);
    await this.authz.ensureTableAccess(ctx, model.storageTable, 'read');

    const allFields = await this.modelRegistry.getProperties(collection, ctx.roles);
    const readableFields = await this.authz.filterReadableFields(ctx, model.storageTable, allFields);

    // Track reference properties that need LEFT JOINs for display values
    const referenceJoins: Array<{
      propertyCode: string;
      refTable: string;
      displayProperty: string;
      alias: string;
      columnName: string;
    }> = [];

    // Build group query - for reference fields, we'll group by ID but select display value
    const groupColumns: string[] = [];
    const groupDisplayColumns: string[] = [];

    for (const col of grouping.columns) {
      const field = (allFields as Array<ReferencePropertyInfo>).find((f) => f.code === col);
      if (!field) continue;

      const parsed = this.parseStoragePath(field.storagePath);
      if (parsed.type === 'column') {
        // Always group by the actual column (ID for references)
        groupColumns.push(`t."${parsed.column}"`);

        // Check if this is a reference field - if so, select display value
        if (field.config?.referenceCollection && field.config?.referenceDisplayProperty) {
          const refTable = field.config.referenceCollection;
          const displayField = field.config.referenceDisplayProperty;
          const alias = `ref_grp_${field.code}`;

          try {
            this.ensureSafeIdentifier(refTable, 'reference table');
            this.ensureSafeIdentifier(displayField, 'display field');

            referenceJoins.push({
              propertyCode: field.code,
              refTable,
              displayProperty: displayField,
              alias,
              columnName: parsed.column,
            });

            // For display, use the reference display value
            groupDisplayColumns.push(`${alias}."${displayField}"`);
          } catch {
            // Invalid reference config, just use the raw column
            groupDisplayColumns.push(`t."${parsed.column}"`);
          }
        } else {
          // Not a reference field, use raw column
          groupDisplayColumns.push(`t."${parsed.column}"`);
        }
      } else if (parsed.type === 'json') {
        const jsonCol = `t."${parsed.column}"->>'${parsed.path}'`;
        groupColumns.push(jsonCol);
        groupDisplayColumns.push(jsonCol);
      }
    }

    if (!groupColumns.length) {
      return this.query<T>(ctx, request);
    }

    // Select parts: group_N for actual value (ID), group_N_display for display value
    const selectParts: string[] = [];
    for (let i = 0; i < groupColumns.length; i++) {
      selectParts.push(`${groupColumns[i]} AS "group_${i}"`);
      selectParts.push(`${groupDisplayColumns[i]} AS "group_${i}_display"`);
    }
    selectParts.push('COUNT(*) AS "count"');

    // Add aggregations
    if (grouping.aggregations) {
      for (const agg of grouping.aggregations) {
        const field = allFields.find((f) => f.code === agg.column);
        if (!field) continue;
        const parsed = this.parseStoragePath(field.storagePath);
        if (parsed.type === 'column') {
          const alias = agg.alias ?? `${agg.function}_${agg.column}`;
          selectParts.push(`${agg.function.toUpperCase()}(t."${parsed.column}") AS "${alias}"`);
        }
      }
    }

    const qb = this.dataSource
      .createQueryBuilder()
      .select(selectParts)
      .from(this.buildPhysicalTableForQb(model), 't');

    // Add LEFT JOINs for reference fields used in grouping
    for (const ref of referenceJoins) {
      qb.leftJoin(
        (subQuery) =>
          subQuery
            .select([
              `sub_${ref.alias}.id AS id`,
              `sub_${ref.alias}."${ref.displayProperty}" AS "${ref.displayProperty}"`,
            ])
            .from(`public.${ref.refTable}`, `sub_${ref.alias}`),
        ref.alias,
        `${ref.alias}.id = t."${ref.columnName}"`,
      );
    }

    // Group by both ID columns and display columns (needed for aggregation)
    const allGroupByColumns = [...groupColumns, ...groupDisplayColumns.filter((c, i) => c !== groupColumns[i])];
    qb.groupBy(allGroupByColumns.join(', '));

    // Apply RLS
    const { clauses: rlsClauses, params: rlsParams } = await this.authz.buildRowLevelClause(
      ctx,
      model.storageTable,
      'read',
      't',
    );
    rlsClauses.forEach((clause) => qb.andWhere(clause));
    qb.setParameters({ ...this.buildAbacParams(ctx), ...rlsParams });

    // Apply filters
    this.applyFilters(qb, filters, readableFields, allFields);

    // Apply global filter
    if (globalFilter) {
      this.applyGlobalFilter(qb, globalFilter, readableFields, allFields);
    }

    // Apply pagination
    qb.offset(startRow).limit(endRow - startRow);

    const rows = await qb.getRawMany();

    // Transform to group data - use display values when available
    const groupData: GridGroupData[] = rows.map((row) => ({
      groupKey: grouping.columns,
      // Use display value if available, otherwise fall back to raw value
      groupValue: grouping.columns.map((_, i) => row[`group_${i}_display`] ?? row[`group_${i}`]),
      childCount: parseInt(row.count, 10),
      aggregations: grouping.aggregations?.reduce(
        (acc, agg) => {
          const alias = agg.alias ?? `${agg.function}_${agg.column}`;
          acc[alias] = parseFloat(row[alias]) || 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
    }));

    return {
      rows: [] as T[],
      rowCount: groupData.length,
      lastRow: startRow + groupData.length,
      groupData,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private buildSelectParts(readableFields: unknown[]): string[] {
    const selectParts = ['t.id', 't.created_at', 't.updated_at'];

    (readableFields as Array<ReferencePropertyInfo>).forEach((f) => {
      if (!f.storagePath) return;
      const parsed = this.parseStoragePath(f.storagePath);
      if (parsed.type === 'column') {
        selectParts.push(`t."${parsed.column}" AS "${f.code}"`);

        // If this is a reference field, also select the display value from the joined table
        if (f.config?.referenceCollection && f.config?.referenceDisplayProperty) {
          const alias = `ref_${f.code}`;
          const displayField = this.ensureSafeIdentifier(f.config.referenceDisplayProperty, 'reference display field');
          selectParts.push(`${alias}."${displayField}" AS "${f.code}_display"`);
        }
      } else if (parsed.type === 'json') {
        selectParts.push(`t."${parsed.column}"->>'${parsed.path}' AS "${f.code}"`);
      }
    });

    return selectParts;
  }

  /**
   * Build LEFT JOINs for reference fields
   * Uses subquery approach since TypeORM's leftJoin with raw table names
   * is interpreted as entity relation paths.
   */
  private buildReferenceJoins(
    qb: SelectQueryBuilder<ObjectLiteral>,
    readableFields: unknown[],
  ): void {
    (readableFields as Array<ReferencePropertyInfo>).forEach((f) => {
      if (!f.storagePath || !f.config?.referenceCollection || !f.config?.referenceDisplayProperty) return;

      const parsed = this.parseStoragePath(f.storagePath);
      if (parsed.type !== 'column') return;

      const refTable = f.config.referenceCollection;
      const alias = `ref_${f.code}`;
      const displayField = f.config.referenceDisplayProperty;

      // Validate the reference table and display field names for security
      try {
        this.ensureSafeIdentifier(refTable, 'reference table');
        this.ensureSafeIdentifier(displayField, 'display field');
      } catch {
        // Skip invalid reference table names
        return;
      }

      // LEFT JOIN the referenced table using a subquery
      // This works with TypeORM's query builder when the main FROM is a raw table
      qb.leftJoin(
        (subQuery) =>
          subQuery
            .select([`sub_${alias}.id AS id`, `sub_${alias}."${displayField}" AS "${displayField}"`])
            .from(`public.${refTable}`, `sub_${alias}`),
        alias,
        `${alias}.id = t."${parsed.column}"`,
      );
    });
  }

  private applyFilters(
    qb: SelectQueryBuilder<ObjectLiteral>,
    filters: GridFilterModel[] | undefined,
    readableFields: unknown[],
    allFields: unknown[],
  ): void {
    if (!filters?.length) return;

    let paramIndex = 0;

    for (const filter of filters) {
      const field = (allFields as Array<{ code: string; storagePath: string }>).find(
        (f) => f.code === filter.column,
      );
      if (!field) continue;

      // Check if field is readable
      if (!(readableFields as Array<{ code: string }>).some((f) => f.code === filter.column)) {
        continue;
      }

      const parsed = this.parseStoragePath(field.storagePath);
      const columnRef =
        parsed.type === 'column'
          ? `t."${parsed.column}"`
          : `t."${parsed.column}"->>'${parsed.path}'`;

      const paramName = `filter_${paramIndex++}`;
      const paramName2 = `filter_${paramIndex++}`;

      switch (filter.operator) {
        case 'equals':
          qb.andWhere(`${columnRef} = :${paramName}`, { [paramName]: filter.value });
          break;
        case 'notEquals':
          qb.andWhere(`${columnRef} != :${paramName}`, { [paramName]: filter.value });
          break;
        case 'contains':
          qb.andWhere(`${columnRef} ILIKE :${paramName}`, {
            [paramName]: `%${filter.value}%`,
          });
          break;
        case 'notContains':
          qb.andWhere(`${columnRef} NOT ILIKE :${paramName}`, {
            [paramName]: `%${filter.value}%`,
          });
          break;
        case 'startsWith':
          qb.andWhere(`${columnRef} ILIKE :${paramName}`, {
            [paramName]: `${filter.value}%`,
          });
          break;
        case 'endsWith':
          qb.andWhere(`${columnRef} ILIKE :${paramName}`, {
            [paramName]: `%${filter.value}`,
          });
          break;
        case 'greaterThan':
          qb.andWhere(`${columnRef} > :${paramName}`, { [paramName]: filter.value });
          break;
        case 'greaterThanOrEqual':
          qb.andWhere(`${columnRef} >= :${paramName}`, { [paramName]: filter.value });
          break;
        case 'lessThan':
          qb.andWhere(`${columnRef} < :${paramName}`, { [paramName]: filter.value });
          break;
        case 'lessThanOrEqual':
          qb.andWhere(`${columnRef} <= :${paramName}`, { [paramName]: filter.value });
          break;
        case 'between':
          qb.andWhere(`${columnRef} BETWEEN :${paramName} AND :${paramName2}`, {
            [paramName]: filter.value,
            [paramName2]: filter.value2,
          });
          break;
        case 'inList':
          if (Array.isArray(filter.value)) {
            qb.andWhere(`${columnRef} IN (:...${paramName})`, {
              [paramName]: filter.value,
            });
          }
          break;
        case 'notInList':
          if (Array.isArray(filter.value)) {
            qb.andWhere(`${columnRef} NOT IN (:...${paramName})`, {
              [paramName]: filter.value,
            });
          }
          break;
        case 'isNull':
          qb.andWhere(`${columnRef} IS NULL`);
          break;
        case 'isNotNull':
          qb.andWhere(`${columnRef} IS NOT NULL`);
          break;
        case 'isEmpty':
          qb.andWhere(`(${columnRef} IS NULL OR ${columnRef} = '')`);
          break;
        case 'isNotEmpty':
          qb.andWhere(`${columnRef} IS NOT NULL AND ${columnRef} != ''`);
          break;
      }
    }
  }

  private applyGlobalFilter(
    qb: SelectQueryBuilder<ObjectLiteral>,
    globalFilter: string,
    readableFields: unknown[],
    allFields: unknown[],
  ): void {
    const searchTerm = `%${globalFilter}%`;
    const orConditions: string[] = [];

    (readableFields as Array<{ code: string }>).forEach((rf) => {
      const field = (allFields as Array<{ code: string; storagePath: string; type?: string }>).find(
        (f) => f.code === rf.code,
      );
      if (!field?.storagePath) return;

      // Only search text-like fields
      const searchableTypes = ['text', 'string', 'email', 'phone', 'url', undefined];
      if (!searchableTypes.includes(field.type)) return;

      const parsed = this.parseStoragePath(field.storagePath);
      if (parsed.type === 'column') {
        orConditions.push(`t."${parsed.column}"::text ILIKE :globalSearch`);
      } else if (parsed.type === 'json') {
        orConditions.push(`t."${parsed.column}"->>'${parsed.path}' ILIKE :globalSearch`);
      }
    });

    if (orConditions.length > 0) {
      qb.andWhere(`(${orConditions.join(' OR ')})`, { globalSearch: searchTerm });
    }
  }

  private applySorting(
    qb: SelectQueryBuilder<ObjectLiteral>,
    sorting: GridSortModel[] | undefined,
    readableFields: unknown[],
    allFields: unknown[],
  ): void {
    if (!sorting?.length) {
      qb.orderBy('t."created_at"', 'DESC');
      return;
    }

    const readableCodes = new Set((readableFields as Array<{ code: string }>).map((f) => f.code));

    sorting.forEach((sort, index) => {
      const direction = sort.direction.toUpperCase() as 'ASC' | 'DESC';
      let columnRef: string | null = null;

      const isDefault = ['id', 'created_at', 'updated_at'].includes(sort.column);

      if (isDefault) {
        columnRef = `t."${this.ensureSafeIdentifier(sort.column, 'sort column')}"`;
      } else {
        const field = (allFields as Array<{ code: string; storagePath: string; type?: string }>).find(
          (f) => f.code === sort.column,
        );

        if (field && readableCodes.has(field.code)) {
          const parsed = this.parseStoragePath(field.storagePath);
          columnRef =
            parsed.type === 'column'
              ? `t."${parsed.column}"`
              : `t."${parsed.column}"->>'${parsed.path}'`;
        }
      }

      if (!columnRef) return;

      if (index === 0) {
        qb.orderBy(columnRef, direction);
      } else {
        qb.addOrderBy(columnRef, direction);
      }
    });

    // Ensure deterministic ordering
    if (!qb.expressionMap.orderBys || Object.keys(qb.expressionMap.orderBys).length === 0) {
      qb.orderBy('t."created_at"', 'DESC');
    }
  }

  private async getFilteredCount(
    ctx: RequestContext,
    request: GridQueryRequest,
  ): Promise<number> {
    return this.count(ctx, {
      collection: request.collection,
      filters: request.filters,
      globalFilter: request.globalFilter,
    });
  }

  // ---------------------------------------------------------------------------
  // UTILITY METHODS
  // ---------------------------------------------------------------------------

  private ensureSafeIdentifier(value: string, label: string): string {
    if (!value || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new BadRequestException(`Invalid ${label} name`);
    }
    return value;
  }

  private buildPhysicalTableForQb(table: { storageSchema: string; storageTable: string }): string {
    const schema = this.ensureSafeIdentifier(table.storageSchema, 'schema');
    const name = this.ensureSafeIdentifier(table.storageTable, 'table');
    return `${schema}.${name}`;
  }

  private parseStoragePath(storagePath: string): {
    type: 'column' | 'json';
    column: string;
    path?: string;
  } {
    if (!storagePath) {
      throw new BadRequestException('Unsupported storage path');
    }

    if (!storagePath.includes(':')) {
      const col = storagePath;
      this.ensureSafeIdentifier(col, 'column');
      return { type: 'column', column: col };
    }

    if (storagePath.startsWith('column:')) {
      const col = storagePath.split(':')[1];
      this.ensureSafeIdentifier(col, 'column');
      return { type: 'column', column: col };
    }

    if (storagePath.startsWith('json:')) {
      const parts = storagePath.split(':')[1].split('.');
      if (parts.length !== 2) {
        throw new BadRequestException('Invalid json storage path');
      }
      const [col, path] = parts;
      this.ensureSafeIdentifier(col, 'column');
      if (!/^[A-Za-z0-9_]+$/.test(path)) {
        throw new BadRequestException('Invalid json path');
      }
      return { type: 'json', column: col, path };
    }

    throw new BadRequestException('Unsupported storage path');
  }

  private buildAbacParams(ctx: RequestContext): Record<string, unknown> {
    return {
      userId: ctx.userId,
      roles: ctx.roles,
      groups: ctx.attributes?.groups ?? [],
      sites: ctx.attributes?.sites ?? [],
    };
  }
}
