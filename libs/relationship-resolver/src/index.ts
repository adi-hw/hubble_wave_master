/**
 * @hubblewave/relationship-resolver
 *
 * The Relationship Resolver library handles the resolution of relationships
 * between collections for computed properties like Lookup, Rollup, and
 * Hierarchical properties.
 *
 * ## Core Concepts
 *
 * **Lookup Resolution**: Fetches values from related records through reference properties
 * **Rollup Resolution**: Aggregates values from related records with filtering
 * **Hierarchical Resolution**: Traverses parent-child relationships
 * **Circular Detection**: Prevents infinite loops in relationship chains
 *
 * @example
 * ```typescript
 * import { RelationshipResolver, ResolverContext } from '@hubblewave/relationship-resolver';
 *
 * const resolver = new RelationshipResolver({
 *   dataProvider: myDataProvider,
 *   schemaProvider: mySchemaProvider,
 * });
 *
 * const result = await resolver.resolveLookup({
 *   sourceCollection: 'users',
 *   referenceProperty: 'manager_id',
 *   sourceProperty: 'full_name',
 *   recordId: 'current-record-id',
 *   referenceValue: 'manager-user-id',
 * });
 * ```
 *
 * @packageDocumentation
 */

// Core types
export * from './lib/types';

// Resolver
export { RelationshipResolver, RelationshipResolverOptions } from './lib/resolver';

// Data Provider Interface
export { DataProvider, QueryOptions, QueryResult } from './lib/data-provider';

// Schema Provider Interface
export { SchemaProvider, CollectionSchema, PropertySchema } from './lib/schema-provider';

// Circular Detection
export { CircularDependencyDetector, DependencyGraph, CircularPath } from './lib/circular-detector';

// Cache
export { RelationshipCache, CacheOptions, CacheStats } from './lib/cache';

// Errors
export {
  RelationshipError,
  CircularDependencyError,
  CollectionNotFoundError,
  PropertyNotFoundError,
  InvalidReferenceError,
} from './lib/errors';
