/**
 * Relationship Cache
 *
 * Caches resolved relationship values for performance.
 */

/**
 * Cache entry
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Default TTL in milliseconds */
  defaultTTL?: number;
  /** Maximum cache size */
  maxSize?: number;
  /** Enable TTL-based expiration */
  enableTTL?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

/**
 * Relationship cache with LRU eviction and TTL support
 */
export class RelationshipCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private options: Required<CacheOptions>;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTTL: 60000, // 1 minute
      maxSize: 10000,
      enableTTL: true,
      cleanupInterval: 30000, // 30 seconds
      ...options,
    };

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };

    if (this.options.enableTTL && this.options.cleanupInterval > 0) {
      this.startCleanup();
    }
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    if (this.options.enableTTL && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    entry.hits++;
    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set a cached value
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      timestamp: now,
      expiresAt: now + (ttl ?? this.options.defaultTTL),
      hits: 0,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.options.enableTTL && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a cached value
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate entries for a collection
   */
  invalidateCollection(collectionCode: string): number {
    return this.invalidatePattern(new RegExp(`^${collectionCode}:`));
  }

  /**
   * Invalidate entries for a specific record
   */
  invalidateRecord(collectionCode: string, recordId: string): number {
    return this.invalidatePattern(new RegExp(`${collectionCode}:.*${recordId}`));
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      evictions: this.stats.evictions,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Generate cache key for lookup
   */
  static lookupKey(collection: string, referenceProperty: string, referenceValue: string, sourceProperty: string): string {
    return `lookup:${collection}:${referenceProperty}:${referenceValue}:${sourceProperty}`;
  }

  /**
   * Generate cache key for rollup
   */
  static rollupKey(
    collection: string,
    referenceProperty: string,
    recordId: string,
    sourceProperty: string,
    aggregation: string
  ): string {
    return `rollup:${collection}:${referenceProperty}:${recordId}:${sourceProperty}:${aggregation}`;
  }

  /**
   * Generate cache key for hierarchy
   */
  static hierarchyKey(collection: string, recordId: string, direction: string, maxDepth: number): string {
    return `hierarchy:${collection}:${recordId}:${direction}:${maxDepth}`;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private evictLRU(): void {
    // Find entry with lowest hits and oldest timestamp
    let lruKey: string | null = null;
    let lruScore = Infinity;

    for (const [key, entry] of this.cache) {
      // Score = hits + recency bonus
      const recencyBonus = (Date.now() - entry.timestamp) / 1000;
      const score = entry.hits - recencyBonus;

      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }
}
