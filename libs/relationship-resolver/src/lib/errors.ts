/**
 * Error types for relationship resolution
 */

/**
 * Base error for relationship resolution
 */
export class RelationshipError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RelationshipError';
  }
}

/**
 * Circular dependency detected
 */
export class CircularDependencyError extends RelationshipError {
  constructor(
    public path: string[],
    public startNode: string
  ) {
    super(
      `Circular dependency detected: ${path.join(' -> ')} -> ${startNode}`,
      'CIRCULAR_DEPENDENCY',
      { path, startNode }
    );
    this.name = 'CircularDependencyError';
  }
}

/**
 * Collection not found
 */
export class CollectionNotFoundError extends RelationshipError {
  constructor(public collectionCode: string) {
    super(
      `Collection not found: ${collectionCode}`,
      'COLLECTION_NOT_FOUND',
      { collectionCode }
    );
    this.name = 'CollectionNotFoundError';
  }
}

/**
 * Property not found
 */
export class PropertyNotFoundError extends RelationshipError {
  constructor(
    public propertyCode: string,
    public collectionCode: string
  ) {
    super(
      `Property "${propertyCode}" not found in collection "${collectionCode}"`,
      'PROPERTY_NOT_FOUND',
      { propertyCode, collectionCode }
    );
    this.name = 'PropertyNotFoundError';
  }
}

/**
 * Invalid reference
 */
export class InvalidReferenceError extends RelationshipError {
  constructor(
    public referenceProperty: string,
    public expectedCollection: string,
    public reason: string
  ) {
    super(
      `Invalid reference "${referenceProperty}": ${reason}`,
      'INVALID_REFERENCE',
      { referenceProperty, expectedCollection, reason }
    );
    this.name = 'InvalidReferenceError';
  }
}

/**
 * Resolution timeout
 */
export class ResolutionTimeoutError extends RelationshipError {
  constructor(
    public operation: string,
    public timeoutMs: number
  ) {
    super(
      `Resolution timeout after ${timeoutMs}ms for operation: ${operation}`,
      'RESOLUTION_TIMEOUT',
      { operation, timeoutMs }
    );
    this.name = 'ResolutionTimeoutError';
  }
}

/**
 * Max depth exceeded
 */
export class MaxDepthExceededError extends RelationshipError {
  constructor(
    public maxDepth: number,
    public actualDepth: number
  ) {
    super(
      `Maximum hierarchy depth exceeded: ${actualDepth} > ${maxDepth}`,
      'MAX_DEPTH_EXCEEDED',
      { maxDepth, actualDepth }
    );
    this.name = 'MaxDepthExceededError';
  }
}
