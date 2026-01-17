/**
 * GridDataManager - Client-side orchestrator for Server-Side Row Model
 *
 * Responsibilities:
 * - Block-based data fetching with LRU caching
 * - Request deduplication and debouncing
 * - Scroll prediction for prefetching
 * - State coordination with TanStack Table
 * - Cache invalidation on filter/sort changes
 */

import { LRUCache } from 'lru-cache';
import type {
  GridRowData,
  BlockCacheEntry,
  GridDataManagerConfig,
  GridDataManagerStats,
  SSRMRequest,
  SSRMResponse,
} from '../types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default cache TTL in milliseconds (5 minutes) */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Scroll velocity thresholds for prefetch calculation (pixels per second) */
const SCROLL_VELOCITY_FAST = 2000;
const SCROLL_VELOCITY_MEDIUM = 1000;
const SCROLL_VELOCITY_SLOW = 500;

/** Prefetch block counts based on scroll velocity */
const PREFETCH_COUNT_FAST = 5;
const PREFETCH_COUNT_MEDIUM = 3;
const PREFETCH_COUNT_SLOW = 2;
const PREFETCH_COUNT_IDLE = 1;

/** Max time delta for velocity calculation (ms) */
const MAX_VELOCITY_TIME_DELTA = 200;

/** Debounce delay for low-priority requests (ms) */
const LOW_PRIORITY_DEBOUNCE_MS = 100;

export type BlockFetcher<TData> = (request: SSRMRequest) => Promise<SSRMResponse<TData>>;

export class GridDataManager<TData extends GridRowData> {
  private blockCache: LRUCache<string, BlockCacheEntry<TData>>;
  private pendingRequests: Map<string, Promise<BlockCacheEntry<TData>>>;
  private inFlightBlocks: Set<number>; // Prevents duplicate fetches for same block
  private requestQueue: Set<number>;
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private cacheVersion: string;
  private scrollVelocity: number = 0;
  private lastScrollTime: number = 0;
  private lastScrollPosition: number = 0;
  private config: GridDataManagerConfig;
  private fetcher: BlockFetcher<TData>;

  // Total row count tracking from server responses
  private _lastKnownTotalRows: number = -1;
  private _isEndOfData: boolean = false;

  constructor(config: GridDataManagerConfig, fetcher: BlockFetcher<TData>) {
    this.config = config;
    this.fetcher = fetcher;
    this.blockCache = new LRUCache({
      max: config.maxCacheBlocks,
      ttl: config.blockTTL ?? DEFAULT_CACHE_TTL_MS,
      updateAgeOnGet: true,
    });
    this.pendingRequests = new Map();
    this.inFlightBlocks = new Set();
    this.requestQueue = new Set();
    this.cacheVersion = this.generateCacheVersion();
  }

  /**
   * Get the last known total row count from server responses
   * Returns -1 if unknown (more data may exist)
   */
  get lastKnownTotalRows(): number {
    return this._lastKnownTotalRows;
  }

  /**
   * Check if we've reached the end of the dataset
   */
  get isEndOfData(): boolean {
    return this._isEndOfData;
  }

  /**
   * Get rows for a specific range, fetching from cache or server
   */
  async getRows(startRow: number, endRow: number): Promise<TData[]> {
    const startBlock = Math.floor(startRow / this.config.blockSize);
    const endBlock = Math.floor(endRow / this.config.blockSize);

    // Use a Map to collect rows keyed by block index to preserve ordering
    const blockRowsMap = new Map<number, TData[]>();
    const blocksToFetch: number[] = [];

    // Check cache and identify missing blocks
    for (let blockIndex = startBlock; blockIndex <= endBlock; blockIndex++) {
      const cacheKey = this.getCacheKey(blockIndex);
      const cached = this.blockCache.get(cacheKey);

      if (cached && cached.version === this.cacheVersion) {
        // Block is cached and valid - store in map
        blockRowsMap.set(
          blockIndex,
          this.extractRowsFromBlock(cached, startRow, endRow, blockIndex)
        );
      } else {
        blocksToFetch.push(blockIndex);
      }
    }

    // Fetch missing blocks
    if (blocksToFetch.length > 0) {
      const fetchedBlocks = await this.fetchBlocks(blocksToFetch);

      for (const block of fetchedBlocks) {
        blockRowsMap.set(
          block.blockIndex,
          this.extractRowsFromBlock(block, startRow, endRow, block.blockIndex)
        );
      }
    }

    // Flatten rows in sorted block order to maintain correct row ordering
    const rows: TData[] = [];
    for (let blockIndex = startBlock; blockIndex <= endBlock; blockIndex++) {
      const blockRows = blockRowsMap.get(blockIndex);
      if (blockRows) {
        rows.push(...blockRows);
      }
    }

    // Trigger prefetch for smooth scrolling
    this.prefetchAdjacentBlocks(startBlock, endBlock);

    return rows;
  }

  /**
   * Prefetch blocks based on scroll direction and velocity
   */
  private prefetchAdjacentBlocks(startBlock: number, endBlock: number): void {
    const prefetchCount = this.calculatePrefetchCount();
    const direction = this.scrollVelocity >= 0 ? 1 : -1;

    const blocksToPrefetch: number[] = [];

    if (direction > 0) {
      // Scrolling down - prefetch ahead
      for (let i = 1; i <= prefetchCount; i++) {
        blocksToPrefetch.push(endBlock + i);
      }
      // Keep 1 block behind
      if (startBlock > 0) {
        blocksToPrefetch.push(startBlock - 1);
      }
    } else {
      // Scrolling up - prefetch behind
      for (let i = 1; i <= prefetchCount; i++) {
        if (startBlock - i >= 0) {
          blocksToPrefetch.push(startBlock - i);
        }
      }
      // Keep 1 block ahead
      blocksToPrefetch.push(endBlock + 1);
    }

    // Queue prefetch requests (low priority)
    for (const blockIndex of blocksToPrefetch) {
      if (blockIndex >= 0 && !this.isBlockCached(blockIndex)) {
        this.queueBlockFetch(blockIndex, { priority: 'low' });
      }
    }
  }

  /**
   * Calculate prefetch count based on scroll velocity
   */
  private calculatePrefetchCount(): number {
    const absVelocity = Math.abs(this.scrollVelocity);

    if (absVelocity > SCROLL_VELOCITY_FAST) return PREFETCH_COUNT_FAST;
    if (absVelocity > SCROLL_VELOCITY_MEDIUM) return PREFETCH_COUNT_MEDIUM;
    if (absVelocity > SCROLL_VELOCITY_SLOW) return PREFETCH_COUNT_SLOW;
    return PREFETCH_COUNT_IDLE;
  }

  /**
   * Update scroll velocity for prediction
   */
  updateScrollPosition(position: number): void {
    const now = performance.now();
    const timeDelta = now - this.lastScrollTime;

    if (timeDelta > 0 && timeDelta < MAX_VELOCITY_TIME_DELTA) {
      const positionDelta = position - this.lastScrollPosition;
      this.scrollVelocity = (positionDelta / timeDelta) * 1000; // pixels per second
    }

    this.lastScrollTime = now;
    this.lastScrollPosition = position;
  }

  /**
   * Fetch multiple blocks in a single batch request
   */
  private async fetchBlocks(blockIndices: number[]): Promise<BlockCacheEntry<TData>[]> {
    // Deduplicate with pending requests AND in-flight blocks
    const uniqueBlocks = blockIndices.filter((idx) => {
      const cacheKey = this.getCacheKey(idx);
      return !this.pendingRequests.has(cacheKey) && !this.inFlightBlocks.has(idx);
    });

    if (uniqueBlocks.length === 0) {
      // All blocks already being fetched, wait for them
      const promises = blockIndices
        .map((idx) => this.pendingRequests.get(this.getCacheKey(idx)))
        .filter((p): p is Promise<BlockCacheEntry<TData>> => p !== undefined);
      return Promise.all(promises);
    }

    // Mark blocks as in-flight to prevent duplicate requests
    for (const idx of uniqueBlocks) {
      this.inFlightBlocks.add(idx);
    }

    // Capture version at request time to detect stale responses
    const requestVersion = this.cacheVersion;

    // Create single batch request for the contiguous range of requested blocks
    const startRow = Math.min(...uniqueBlocks) * this.config.blockSize;
    const endRow = (Math.max(...uniqueBlocks) + 1) * this.config.blockSize;

    const request: SSRMRequest = {
      collection: this.config.collection,
      startRow,
      endRow,
      sorting: this.config.sorting,
      filters: this.config.filters,
      grouping: this.config.grouping,
      globalFilter: this.config.globalFilter,
    };

    // Single fetch for the full requested span
    const batchPromise = this.fetcher(request).then((response) => {
      // Check if cache was invalidated while request was in flight
      if (requestVersion !== this.cacheVersion) {
        // Stale response - discard it and return empty entries
        for (const idx of uniqueBlocks) {
          this.inFlightBlocks.delete(idx);
          this.pendingRequests.delete(this.getCacheKey(idx));
        }
        return uniqueBlocks.map((blockIndex) => ({
          blockIndex,
          rows: [] as TData[],
          loadedAt: new Date(),
          version: requestVersion, // Mark with old version so it won't be used
        }));
      }

      // Update total row count from server response
      if (response.lastRow !== undefined && response.lastRow >= 0) {
        this._lastKnownTotalRows = response.lastRow;
        this._isEndOfData = true;
      } else if (response.lastRow === -1) {
        // More data available - update estimate based on what we've seen
        const fetchedEndRow = startRow + response.rows.length;
        if (fetchedEndRow > this._lastKnownTotalRows) {
          this._lastKnownTotalRows = fetchedEndRow;
        }
        this._isEndOfData = false;
      }

      const blocksMap = new Map<number, TData[]>();

      response.rows.forEach((row, idx) => {
        const absoluteIndex = startRow + idx;
        const targetBlock = Math.floor(absoluteIndex / this.config.blockSize);
        const arr = blocksMap.get(targetBlock) ?? [];
        arr.push(row);
        blocksMap.set(targetBlock, arr);
      });

      // Build cache entries for each requested block
      return uniqueBlocks.map((blockIndex) => {
        const cacheKey = this.getCacheKey(blockIndex);
        const entry: BlockCacheEntry<TData> = {
          blockIndex,
          rows: blocksMap.get(blockIndex) ?? [],
          loadedAt: new Date(),
          version: this.cacheVersion,
        };

        this.blockCache.set(cacheKey, entry);
        this.pendingRequests.delete(cacheKey);
        this.inFlightBlocks.delete(blockIndex);

        return entry;
      });
    }).catch((error) => {
      // Clean up in-flight tracking on error
      for (const idx of uniqueBlocks) {
        this.inFlightBlocks.delete(idx);
        this.pendingRequests.delete(this.getCacheKey(idx));
      }
      throw error;
    });

    // Create per-block promises that resolve from the batch response
    const blockPromises = uniqueBlocks.map((blockIndex) => {
      const cacheKey = this.getCacheKey(blockIndex);
      const promise = batchPromise.then((entries) => {
        const entry = entries.find((e) => e.blockIndex === blockIndex);
        if (!entry) {
          return {
            blockIndex,
            rows: [],
            loadedAt: new Date(),
            version: this.cacheVersion,
          };
        }
        return entry;
      });

      this.pendingRequests.set(cacheKey, promise);
      return promise;
    });

    return Promise.all(blockPromises);
  }

  /**
   * Queue a block fetch with debouncing
   */
  private queueBlockFetch(blockIndex: number, options: { priority: 'high' | 'low' }): void {
    this.requestQueue.add(blockIndex);

    if (options.priority === 'high') {
      this.flushQueue();
    } else {
      // Debounce low-priority requests
      if (this.flushTimeout) {
        clearTimeout(this.flushTimeout);
      }
      this.flushTimeout = setTimeout(() => this.flushQueue(), LOW_PRIORITY_DEBOUNCE_MS);
    }
  }

  /**
   * Flush queued requests
   */
  private flushQueue(): void {
    if (this.requestQueue.size === 0) return;

    const blocks = Array.from(this.requestQueue);
    this.requestQueue.clear();

    // Fire and forget for prefetch
    this.fetchBlocks(blocks).catch(console.error);
  }

  /**
   * Invalidate cache when filters/sorting changes
   */
  invalidateCache(): void {
    this.cacheVersion = this.generateCacheVersion();
    this.blockCache.clear();
    this.pendingRequests.clear();
    this.inFlightBlocks.clear();
    this.requestQueue.clear();
    // Reset total row tracking - will be updated from next server response
    this._lastKnownTotalRows = -1;
    this._isEndOfData = false;
  }

  /**
   * Update configuration (triggers cache invalidation if needed)
   */
  updateConfig(newConfig: Partial<GridDataManagerConfig>): void {
    const needsInvalidation =
      this.hasChanged(newConfig.sorting, this.config.sorting) ||
      this.hasChanged(newConfig.filters, this.config.filters) ||
      this.hasChanged(newConfig.grouping, this.config.grouping) ||
      newConfig.globalFilter !== this.config.globalFilter;

    Object.assign(this.config, newConfig);

    if (needsInvalidation) {
      this.invalidateCache();
    }
  }

  /**
   * Check if a value has changed (deep comparison)
   */
  private hasChanged(newValue: unknown, oldValue: unknown): boolean {
    if (newValue === undefined) return false;
    return JSON.stringify(newValue) !== JSON.stringify(oldValue);
  }

  private getCacheKey(blockIndex: number): string {
    return `${this.cacheVersion}:${blockIndex}`;
  }

  private isBlockCached(blockIndex: number): boolean {
    const cacheKey = this.getCacheKey(blockIndex);
    return this.blockCache.has(cacheKey) || this.pendingRequests.has(cacheKey);
  }

  private generateCacheVersion(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  private extractRowsFromBlock(
    block: BlockCacheEntry<TData>,
    startRow: number,
    endRow: number,
    blockIndex: number
  ): TData[] {
    const blockStartRow = blockIndex * this.config.blockSize;
    const localStartIdx = Math.max(0, startRow - blockStartRow);
    const localEndIdx = Math.min(block.rows.length, endRow - blockStartRow);

    return block.rows.slice(localStartIdx, localEndIdx);
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): GridDataManagerStats & { currentSorting?: unknown } {
    return {
      cachedBlocks: this.blockCache.size,
      maxBlocks: this.config.maxCacheBlocks,
      pendingRequests: this.pendingRequests.size,
      queuedRequests: this.requestQueue.size,
      inFlightBlocks: this.inFlightBlocks.size,
      cacheVersion: this.cacheVersion,
      scrollVelocity: this.scrollVelocity,
      lastKnownTotalRows: this._lastKnownTotalRows,
      isEndOfData: this._isEndOfData,
      currentSorting: this.config.sorting,
    };
  }

  /**
   * Get currently loaded blocks
   */
  getLoadedBlocks(): Map<number, BlockCacheEntry<TData>> {
    const result = new Map<number, BlockCacheEntry<TData>>();
    for (const [, value] of this.blockCache.entries()) {
      if (value.version === this.cacheVersion) {
        result.set(value.blockIndex, value);
      }
    }
    return result;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    this.blockCache.clear();
    this.pendingRequests.clear();
    this.inFlightBlocks.clear();
    this.requestQueue.clear();
  }
}
