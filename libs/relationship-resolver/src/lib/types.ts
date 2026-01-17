/**
 * Core types for relationship resolution
 */

/**
 * Aggregation functions for rollup properties
 */
export type RollupAggregation =
  | 'SUM'
  | 'AVG'
  | 'COUNT'
  | 'COUNTA'
  | 'COUNTALL'
  | 'MIN'
  | 'MAX'
  | 'FIRST'
  | 'LAST'
  | 'CONCAT'
  | 'CONCAT_UNIQUE';

/**
 * Lookup resolution request
 */
export interface LookupRequest {
  /** Collection to look up from */
  sourceCollection: string;
  /** Reference property in current record */
  referenceProperty: string;
  /** Property to fetch from source */
  sourceProperty: string;
  /** Current record ID */
  recordId: string;
  /** Value of the reference (the ID of the related record) */
  referenceValue: string | string[];
}

/**
 * Lookup resolution result
 */
export interface LookupResult {
  value: unknown;
  success: boolean;
  error?: string;
  fromCache: boolean;
  resolvedAt: Date;
}

/**
 * Rollup resolution request
 */
export interface RollupRequest {
  /** Collection to aggregate from */
  sourceCollection: string;
  /** Property linking back to current record */
  referenceProperty: string;
  /** Property to aggregate */
  sourceProperty: string;
  /** Aggregation function */
  aggregation: RollupAggregation;
  /** Current record ID */
  recordId: string;
  /** Optional filter expression */
  filter?: string;
}

/**
 * Rollup resolution result
 */
export interface RollupResult {
  value: unknown;
  count: number;
  success: boolean;
  error?: string;
  fromCache: boolean;
  resolvedAt: Date;
}

/**
 * Hierarchical resolution request
 */
export interface HierarchyRequest {
  /** Collection containing hierarchical data */
  collection: string;
  /** Self-reference property (parent pointer) */
  parentProperty: string;
  /** Current record ID */
  recordId: string;
  /** Direction of traversal */
  direction: 'ancestors' | 'descendants' | 'siblings' | 'path';
  /** Maximum depth to traverse */
  maxDepth?: number;
  /** Property to include in results */
  includeProperties?: string[];
}

/**
 * Hierarchical node in results
 */
export interface HierarchyNode {
  id: string;
  depth: number;
  properties: Record<string, unknown>;
  children?: HierarchyNode[];
  parent?: HierarchyNode;
}

/**
 * Hierarchical resolution result
 */
export interface HierarchyResult {
  nodes: HierarchyNode[];
  path?: string[];
  depth: number;
  success: boolean;
  error?: string;
  fromCache: boolean;
  resolvedAt: Date;
}

/**
 * Related records batch request
 */
export interface BatchRequest {
  requests: Array<LookupRequest | RollupRequest | HierarchyRequest>;
}

/**
 * Related records batch result
 */
export interface BatchResult {
  results: Array<LookupResult | RollupResult | HierarchyResult>;
  success: boolean;
  errors?: string[];
}

/**
 * Resolution metrics
 */
export interface ResolutionMetrics {
  lookupsResolved: number;
  rollupsResolved: number;
  hierarchiesResolved: number;
  cacheHits: number;
  cacheMisses: number;
  queryTime: number;
  totalTime: number;
}

/**
 * Dependency information for a property
 */
export interface PropertyDependency {
  propertyCode: string;
  collectionCode: string;
  dependsOn: Array<{
    collection: string;
    property: string;
    type: 'lookup' | 'rollup' | 'hierarchical' | 'formula';
  }>;
  updateOrder: number;
}
