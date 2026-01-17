/**
 * Relationship Resolver
 *
 * Main resolver for lookup, rollup, and hierarchical properties.
 */

import { DataProvider } from './data-provider';
import { SchemaProvider } from './schema-provider';
import { RelationshipCache, CacheOptions } from './cache';
import { CircularDependencyDetector } from './circular-detector';
import {
  LookupRequest,
  LookupResult,
  RollupRequest,
  RollupResult,
  RollupAggregation,
  HierarchyRequest,
  HierarchyResult,
  HierarchyNode,
  BatchRequest,
  BatchResult,
  ResolutionMetrics,
} from './types';
import {
  CollectionNotFoundError,
  PropertyNotFoundError,
  InvalidReferenceError,
  MaxDepthExceededError,
} from './errors';

/**
 * Resolver options
 */
export interface RelationshipResolverOptions {
  dataProvider: DataProvider;
  schemaProvider: SchemaProvider;
  cacheOptions?: CacheOptions;
  maxHierarchyDepth?: number;
  queryTimeout?: number;
}

/**
 * Main relationship resolver
 */
export class RelationshipResolver {
  private dataProvider: DataProvider;
  private schemaProvider: SchemaProvider;
  private cache: RelationshipCache;
  private circularDetector: CircularDependencyDetector;
  private maxHierarchyDepth: number;
  private metrics: ResolutionMetrics;

  constructor(options: RelationshipResolverOptions) {
    this.dataProvider = options.dataProvider;
    this.schemaProvider = options.schemaProvider;
    this.cache = new RelationshipCache(options.cacheOptions);
    this.circularDetector = new CircularDependencyDetector();
    this.maxHierarchyDepth = options.maxHierarchyDepth ?? 50;
    this.resetMetrics();
  }

  /**
   * Resolve a lookup property
   */
  async resolveLookup(request: LookupRequest): Promise<LookupResult> {
    const startTime = Date.now();
    this.metrics.lookupsResolved++;

    try {
      // Check cache
      const cacheKey = RelationshipCache.lookupKey(
        request.sourceCollection,
        request.referenceProperty,
        String(request.referenceValue),
        request.sourceProperty
      );

      const cached = this.cache.get<unknown>(cacheKey);
      if (cached !== undefined) {
        this.metrics.cacheHits++;
        return {
          value: cached,
          success: true,
          fromCache: true,
          resolvedAt: new Date(),
        };
      }

      this.metrics.cacheMisses++;

      // Validate collection exists
      const collection = await this.schemaProvider.getCollection(request.sourceCollection);
      if (!collection) {
        throw new CollectionNotFoundError(request.sourceCollection);
      }

      // Validate property exists
      const property = await this.schemaProvider.getProperty(request.sourceCollection, request.sourceProperty);
      if (!property) {
        throw new PropertyNotFoundError(request.sourceProperty, request.sourceCollection);
      }

      // Fetch the related record
      const referenceValues = Array.isArray(request.referenceValue)
        ? request.referenceValue
        : [request.referenceValue];

      const records = await this.dataProvider.getByIds(
        request.sourceCollection,
        referenceValues,
        [request.sourceProperty]
      );

      const queryTime = Date.now() - startTime;
      this.metrics.queryTime += queryTime;

      if (records.length === 0) {
        return {
          value: null,
          success: true,
          fromCache: false,
          resolvedAt: new Date(),
        };
      }

      // Return single value for single reference, array for multi-reference
      const value = Array.isArray(request.referenceValue)
        ? records.map((r) => r[request.sourceProperty])
        : records[0][request.sourceProperty];

      // Cache result
      this.cache.set(cacheKey, value);

      return {
        value,
        success: true,
        fromCache: false,
        resolvedAt: new Date(),
      };
    } catch (error) {
      return {
        value: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fromCache: false,
        resolvedAt: new Date(),
      };
    }
  }

  /**
   * Resolve a rollup property
   */
  async resolveRollup(request: RollupRequest): Promise<RollupResult> {
    const startTime = Date.now();
    this.metrics.rollupsResolved++;

    try {
      // Check cache
      const cacheKey = RelationshipCache.rollupKey(
        request.sourceCollection,
        request.referenceProperty,
        request.recordId,
        request.sourceProperty,
        request.aggregation
      );

      const cached = this.cache.get<{ value: unknown; count: number }>(cacheKey);
      if (cached !== undefined) {
        this.metrics.cacheHits++;
        return {
          ...cached,
          success: true,
          fromCache: true,
          resolvedAt: new Date(),
        };
      }

      this.metrics.cacheMisses++;

      // Validate collection exists
      const collection = await this.schemaProvider.getCollection(request.sourceCollection);
      if (!collection) {
        throw new CollectionNotFoundError(request.sourceCollection);
      }

      // Fetch related records
      const records = await this.dataProvider.getByField(
        request.sourceCollection,
        request.referenceProperty,
        [request.recordId],
        [request.sourceProperty]
      );

      const queryTime = Date.now() - startTime;
      this.metrics.queryTime += queryTime;

      // Apply filter if provided
      let filteredRecords = records;
      if (request.filter) {
        // Simple filter parsing - in production this would use the formula parser
        filteredRecords = this.applySimpleFilter(records, request.filter);
      }

      // Aggregate values
      const values = filteredRecords.map((r) => r[request.sourceProperty]);
      const { value, count } = this.aggregate(values, request.aggregation);

      // Cache result
      this.cache.set(cacheKey, { value, count });

      return {
        value,
        count,
        success: true,
        fromCache: false,
        resolvedAt: new Date(),
      };
    } catch (error) {
      return {
        value: null,
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fromCache: false,
        resolvedAt: new Date(),
      };
    }
  }

  /**
   * Resolve a hierarchy
   */
  async resolveHierarchy(request: HierarchyRequest): Promise<HierarchyResult> {
    const startTime = Date.now();
    this.metrics.hierarchiesResolved++;

    try {
      // Check cache
      const cacheKey = RelationshipCache.hierarchyKey(
        request.collection,
        request.recordId,
        request.direction,
        request.maxDepth ?? this.maxHierarchyDepth
      );

      const cached = this.cache.get<HierarchyResult>(cacheKey);
      if (cached !== undefined) {
        this.metrics.cacheHits++;
        return { ...cached, fromCache: true };
      }

      this.metrics.cacheMisses++;

      const maxDepth = request.maxDepth ?? this.maxHierarchyDepth;

      let result: HierarchyResult;

      switch (request.direction) {
        case 'ancestors':
          result = await this.resolveAncestors(request, maxDepth);
          break;
        case 'descendants':
          result = await this.resolveDescendants(request, maxDepth);
          break;
        case 'siblings':
          result = await this.resolveSiblings(request);
          break;
        case 'path':
          result = await this.resolvePath(request, maxDepth);
          break;
        default:
          throw new Error(`Unknown hierarchy direction: ${request.direction}`);
      }

      // Cache result
      this.cache.set(cacheKey, result);

      this.metrics.queryTime += Date.now() - startTime;

      return result;
    } catch (error) {
      return {
        nodes: [],
        depth: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fromCache: false,
        resolvedAt: new Date(),
      };
    }
  }

  /**
   * Resolve multiple relationships in batch
   */
  async resolveBatch(request: BatchRequest): Promise<BatchResult> {
    const results: Array<LookupResult | RollupResult | HierarchyResult> = [];
    const errors: string[] = [];

    for (const req of request.requests) {
      if ('sourceProperty' in req && 'aggregation' in req) {
        const result = await this.resolveRollup(req as RollupRequest);
        results.push(result);
        if (!result.success && result.error) {
          errors.push(result.error);
        }
      } else if ('sourceProperty' in req) {
        const result = await this.resolveLookup(req as LookupRequest);
        results.push(result);
        if (!result.success && result.error) {
          errors.push(result.error);
        }
      } else if ('direction' in req) {
        const result = await this.resolveHierarchy(req as HierarchyRequest);
        results.push(result);
        if (!result.success && result.error) {
          errors.push(result.error);
        }
      }
    }

    return {
      results,
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Invalidate cache for a record
   */
  invalidateRecord(collectionCode: string, recordId: string): void {
    this.cache.invalidateRecord(collectionCode, recordId);
  }

  /**
   * Invalidate cache for a collection
   */
  invalidateCollection(collectionCode: string): void {
    this.cache.invalidateCollection(collectionCode);
  }

  /**
   * Get resolution metrics
   */
  getMetrics(): ResolutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      lookupsResolved: 0,
      rollupsResolved: 0,
      hierarchiesResolved: 0,
      cacheHits: 0,
      cacheMisses: 0,
      queryTime: 0,
      totalTime: 0,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  private async resolveAncestors(request: HierarchyRequest, maxDepth: number): Promise<HierarchyResult> {
    const nodes: HierarchyNode[] = [];
    const visited = new Set<string>();
    let currentId = request.recordId;
    let depth = 0;

    while (depth < maxDepth) {
      if (visited.has(currentId)) {
        // Circular reference detected
        break;
      }
      visited.add(currentId);

      const record = await this.dataProvider.getById(
        request.collection,
        currentId,
        request.includeProperties
      );

      if (!record) break;

      const parentId = record[request.parentProperty] as string | null;

      nodes.push({
        id: currentId,
        depth,
        properties: record,
      });

      if (!parentId) break;

      currentId = parentId;
      depth++;
    }

    if (depth >= maxDepth) {
      throw new MaxDepthExceededError(maxDepth, depth);
    }

    return {
      nodes,
      depth,
      success: true,
      fromCache: false,
      resolvedAt: new Date(),
    };
  }

  private async resolveDescendants(request: HierarchyRequest, maxDepth: number): Promise<HierarchyResult> {
    const rootNode = await this.buildDescendantTree(
      request.collection,
      request.parentProperty,
      request.recordId,
      0,
      maxDepth,
      new Set(),
      request.includeProperties
    );

    return {
      nodes: rootNode ? [rootNode] : [],
      depth: this.getMaxDepth(rootNode),
      success: true,
      fromCache: false,
      resolvedAt: new Date(),
    };
  }

  private async buildDescendantTree(
    collection: string,
    parentProperty: string,
    parentId: string,
    currentDepth: number,
    maxDepth: number,
    visited: Set<string>,
    includeProperties?: string[]
  ): Promise<HierarchyNode | null> {
    if (currentDepth > maxDepth) {
      throw new MaxDepthExceededError(maxDepth, currentDepth);
    }

    if (visited.has(parentId)) {
      return null;
    }
    visited.add(parentId);

    const record = await this.dataProvider.getById(collection, parentId, includeProperties);
    if (!record) return null;

    const children = await this.dataProvider.getChildren(collection, parentProperty, parentId, includeProperties);

    const childNodes: HierarchyNode[] = [];
    for (const child of children) {
      const childId = String(child.id ?? child._id);
      const childNode = await this.buildDescendantTree(
        collection,
        parentProperty,
        childId,
        currentDepth + 1,
        maxDepth,
        visited,
        includeProperties
      );
      if (childNode) {
        childNodes.push(childNode);
      }
    }

    return {
      id: parentId,
      depth: currentDepth,
      properties: record,
      children: childNodes.length > 0 ? childNodes : undefined,
    };
  }

  private async resolveSiblings(request: HierarchyRequest): Promise<HierarchyResult> {
    const record = await this.dataProvider.getById(request.collection, request.recordId);
    if (!record) {
      return {
        nodes: [],
        depth: 0,
        success: true,
        fromCache: false,
        resolvedAt: new Date(),
      };
    }

    const parentId = record[request.parentProperty] as string | null;
    const siblings = await this.dataProvider.getChildren(
      request.collection,
      request.parentProperty,
      parentId,
      request.includeProperties
    );

    const nodes: HierarchyNode[] = siblings
      .filter((s) => String(s.id ?? s._id) !== request.recordId)
      .map((s) => ({
        id: String(s.id ?? s._id),
        depth: 0,
        properties: s,
      }));

    return {
      nodes,
      depth: 0,
      success: true,
      fromCache: false,
      resolvedAt: new Date(),
    };
  }

  private async resolvePath(request: HierarchyRequest, maxDepth: number): Promise<HierarchyResult> {
    const ancestors = await this.resolveAncestors(request, maxDepth);
    const path = ancestors.nodes.reverse().map((n) => n.id);

    return {
      nodes: ancestors.nodes.reverse(),
      path,
      depth: ancestors.depth,
      success: true,
      fromCache: false,
      resolvedAt: new Date(),
    };
  }

  private aggregate(values: unknown[], aggregation: RollupAggregation): { value: unknown; count: number } {
    const numericValues = values
      .filter((v) => v !== null && v !== undefined && typeof v === 'number')
      .map((v) => v as number);

    const stringValues = values
      .filter((v) => v !== null && v !== undefined)
      .map((v) => String(v));

    switch (aggregation) {
      case 'SUM':
        return { value: numericValues.reduce((a, b) => a + b, 0), count: numericValues.length };

      case 'AVG':
        return {
          value: numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0,
          count: numericValues.length,
        };

      case 'COUNT':
        return { value: numericValues.length, count: numericValues.length };

      case 'COUNTA':
        return { value: values.filter((v) => v !== null && v !== undefined && v !== '').length, count: values.length };

      case 'COUNTALL':
        return { value: values.length, count: values.length };

      case 'MIN':
        return { value: numericValues.length > 0 ? Math.min(...numericValues) : null, count: numericValues.length };

      case 'MAX':
        return { value: numericValues.length > 0 ? Math.max(...numericValues) : null, count: numericValues.length };

      case 'FIRST':
        return { value: values.length > 0 ? values[0] : null, count: values.length };

      case 'LAST':
        return { value: values.length > 0 ? values[values.length - 1] : null, count: values.length };

      case 'CONCAT':
        return { value: stringValues.join(', '), count: stringValues.length };

      case 'CONCAT_UNIQUE':
        return { value: [...new Set(stringValues)].join(', '), count: stringValues.length };

      default:
        return { value: null, count: 0 };
    }
  }

  private applySimpleFilter(records: Record<string, unknown>[], filter: string): Record<string, unknown>[] {
    // Simple filter implementation - just parse field = value
    const match = filter.match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/);
    if (!match) return records;

    const [, field, value] = match;
    return records.filter((r) => String(r[field]) === value);
  }

  private getMaxDepth(node: HierarchyNode | null): number {
    if (!node) return 0;
    if (!node.children || node.children.length === 0) return node.depth;
    return Math.max(...node.children.map((c) => this.getMaxDepth(c)));
  }
}
