/**
 * Data Provider Interface
 *
 * Abstraction for data access to support different data sources.
 */

/**
 * Query filter condition
 */
export interface FilterCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'contains';
  value: unknown;
}

/**
 * Sort specification
 */
export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Query options
 */
export interface QueryOptions {
  /** Filter conditions */
  filters?: FilterCondition[];
  /** Fields to include */
  select?: string[];
  /** Sort order */
  orderBy?: SortSpec[];
  /** Maximum results */
  limit?: number;
  /** Skip results */
  offset?: number;
}

/**
 * Query result
 */
export interface QueryResult<T = Record<string, unknown>> {
  records: T[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Data provider interface
 */
export interface DataProvider {
  /**
   * Get a single record by ID
   */
  getById(collection: string, id: string, select?: string[]): Promise<Record<string, unknown> | null>;

  /**
   * Get multiple records by IDs
   */
  getByIds(collection: string, ids: string[], select?: string[]): Promise<Record<string, unknown>[]>;

  /**
   * Query records with filters
   */
  query(collection: string, options?: QueryOptions): Promise<QueryResult>;

  /**
   * Get records where a field matches given values
   */
  getByField(
    collection: string,
    field: string,
    values: unknown[],
    select?: string[]
  ): Promise<Record<string, unknown>[]>;

  /**
   * Get related records through a reference
   */
  getRelated(
    sourceCollection: string,
    targetCollection: string,
    referenceField: string,
    referenceValue: string | string[],
    select?: string[]
  ): Promise<Record<string, unknown>[]>;

  /**
   * Get child records in a hierarchy
   */
  getChildren(
    collection: string,
    parentField: string,
    parentId: string | null,
    select?: string[]
  ): Promise<Record<string, unknown>[]>;

  /**
   * Count records matching criteria
   */
  count(collection: string, filters?: FilterCondition[]): Promise<number>;
}

/**
 * In-memory data provider for testing
 */
export class InMemoryDataProvider implements DataProvider {
  private data: Map<string, Map<string, Record<string, unknown>>> = new Map();

  /**
   * Load data for a collection
   */
  load(collection: string, records: Record<string, unknown>[]): void {
    const collectionMap = new Map<string, Record<string, unknown>>();
    for (const record of records) {
      const id = String(record.id ?? record._id);
      collectionMap.set(id, record);
    }
    this.data.set(collection, collectionMap);
  }

  async getById(collection: string, id: string, select?: string[]): Promise<Record<string, unknown> | null> {
    const collectionData = this.data.get(collection);
    if (!collectionData) return null;

    const record = collectionData.get(id);
    if (!record) return null;

    return select ? this.selectFields(record, select) : record;
  }

  async getByIds(collection: string, ids: string[], select?: string[]): Promise<Record<string, unknown>[]> {
    const collectionData = this.data.get(collection);
    if (!collectionData) return [];

    const records: Record<string, unknown>[] = [];
    for (const id of ids) {
      const record = collectionData.get(id);
      if (record) {
        records.push(select ? this.selectFields(record, select) : record);
      }
    }

    return records;
  }

  async query(collection: string, options?: QueryOptions): Promise<QueryResult> {
    const collectionData = this.data.get(collection);
    if (!collectionData) {
      return { records: [], totalCount: 0, hasMore: false };
    }

    let records = Array.from(collectionData.values());

    // Apply filters
    if (options?.filters) {
      records = records.filter((record) => this.matchesFilters(record, options.filters!));
    }

    const totalCount = records.length;

    // Apply sorting
    if (options?.orderBy) {
      records = this.sortRecords(records, options.orderBy);
    }

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? records.length;
    records = records.slice(offset, offset + limit);

    // Apply field selection
    if (options?.select) {
      records = records.map((r) => this.selectFields(r, options.select!));
    }

    return {
      records,
      totalCount,
      hasMore: offset + records.length < totalCount,
    };
  }

  async getByField(
    collection: string,
    field: string,
    values: unknown[],
    select?: string[]
  ): Promise<Record<string, unknown>[]> {
    const result = await this.query(collection, {
      filters: [{ field, operator: 'in', value: values }],
      select,
    });
    return result.records;
  }

  async getRelated(
    _sourceCollection: string,
    targetCollection: string,
    referenceField: string,
    referenceValue: string | string[],
    select?: string[]
  ): Promise<Record<string, unknown>[]> {
    const values = Array.isArray(referenceValue) ? referenceValue : [referenceValue];
    return this.getByField(targetCollection, referenceField, values, select);
  }

  async getChildren(
    collection: string,
    parentField: string,
    parentId: string | null,
    select?: string[]
  ): Promise<Record<string, unknown>[]> {
    const result = await this.query(collection, {
      filters: [{ field: parentField, operator: parentId === null ? 'eq' : 'eq', value: parentId }],
      select,
    });
    return result.records;
  }

  async count(collection: string, filters?: FilterCondition[]): Promise<number> {
    const result = await this.query(collection, { filters });
    return result.totalCount;
  }

  private selectFields(record: Record<string, unknown>, fields: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in record) {
        result[field] = record[field];
      }
    }
    // Always include id
    if ('id' in record) result.id = record.id;
    if ('_id' in record) result._id = record._id;
    return result;
  }

  private matchesFilters(record: Record<string, unknown>, filters: FilterCondition[]): boolean {
    for (const filter of filters) {
      const value = record[filter.field];
      if (!this.matchesCondition(value, filter.operator, filter.value)) {
        return false;
      }
    }
    return true;
  }

  private matchesCondition(value: unknown, operator: FilterCondition['operator'], compareValue: unknown): boolean {
    switch (operator) {
      case 'eq':
        return value === compareValue;
      case 'neq':
        return value !== compareValue;
      case 'gt':
        return (value as number) > (compareValue as number);
      case 'gte':
        return (value as number) >= (compareValue as number);
      case 'lt':
        return (value as number) < (compareValue as number);
      case 'lte':
        return (value as number) <= (compareValue as number);
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(value);
      case 'nin':
        return Array.isArray(compareValue) && !compareValue.includes(value);
      case 'like':
        return typeof value === 'string' && typeof compareValue === 'string' && value.includes(compareValue);
      case 'contains':
        return typeof value === 'string' && typeof compareValue === 'string' && value.toLowerCase().includes(compareValue.toLowerCase());
      default:
        return false;
    }
  }

  private sortRecords(records: Record<string, unknown>[], orderBy: SortSpec[]): Record<string, unknown>[] {
    return [...records].sort((a, b) => {
      for (const spec of orderBy) {
        const aVal = a[spec.field];
        const bVal = b[spec.field];

        if (aVal === bVal) continue;

        const comparison = aVal < bVal ? -1 : 1;
        return spec.direction === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  }
}
