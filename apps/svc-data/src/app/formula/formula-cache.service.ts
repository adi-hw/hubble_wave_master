/**
 * FormulaCacheService
 * HubbleWave Platform - Phase 2
 *
 * Caching service for formula evaluation results.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';

interface CacheEntry {
  value: unknown;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class FormulaCacheService {
  private readonly logger = new Logger(FormulaCacheService.name);
  private readonly memoryCache = new Map<string, CacheEntry>();
  private readonly defaultTtl = 300000; // 5 minutes

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Generate a cache key for a formula result
   */
  generateCacheKey(
    collectionCode: string,
    recordId: string,
    formula: string
  ): string {
    const hash = crypto
      .createHash('md5')
      .update(formula)
      .digest('hex')
      .substring(0, 8);
    return `formula:${collectionCode}:${recordId}:${hash}`;
  }

  /**
   * Get a cached value
   */
  async get(key: string): Promise<unknown | null> {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (Date.now() - memEntry.timestamp < memEntry.ttl) {
        return memEntry.value;
      }
      this.memoryCache.delete(key);
    }

    // Check database cache
    try {
      const result = await this.dataSource.query(
        `SELECT cached_value, expires_at
         FROM formula_cache
         WHERE cache_key = $1 AND expires_at > NOW()`,
        [key]
      );

      if (result.length > 0) {
        const value = result[0].cached_value;
        // Store in memory cache
        this.memoryCache.set(key, {
          value,
          timestamp: Date.now(),
          ttl: this.defaultTtl,
        });
        return value;
      }
    } catch (error) {
      this.logger.debug(`Cache lookup failed: ${(error as Error).message}`);
    }

    return null;
  }

  /**
   * Set a cached value
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const actualTtl = ttl || this.defaultTtl;

    // Store in memory cache
    this.memoryCache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: actualTtl,
    });

    // Store in database cache
    try {
      const expiresAt = new Date(Date.now() + actualTtl);
      await this.dataSource.query(
        `INSERT INTO formula_cache (cache_key, cached_value, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (cache_key)
         DO UPDATE SET cached_value = $2, expires_at = $3`,
        [key, JSON.stringify(value), expiresAt]
      );
    } catch (error) {
      this.logger.debug(`Cache write failed: ${(error as Error).message}`);
    }
  }

  /**
   * Invalidate cache for a specific record
   */
  async invalidateRecord(collectionCode: string, recordId: string): Promise<void> {
    const pattern = `formula:${collectionCode}:${recordId}:%`;

    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`formula:${collectionCode}:${recordId}:`)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear database cache
    try {
      await this.dataSource.query(
        `DELETE FROM formula_cache WHERE cache_key LIKE $1`,
        [pattern]
      );
    } catch (error) {
      this.logger.debug(`Cache invalidation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Invalidate all cache for a collection
   */
  async invalidateCollection(collectionCode: string): Promise<void> {
    const pattern = `formula:${collectionCode}:%`;

    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`formula:${collectionCode}:`)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear database cache
    try {
      await this.dataSource.query(
        `DELETE FROM formula_cache WHERE cache_key LIKE $1`,
        [pattern]
      );
    } catch (error) {
      this.logger.debug(`Cache invalidation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Clear expired cache entries
   */
  async clearExpired(): Promise<number> {
    // Clear memory cache
    const now = Date.now();
    let cleared = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        cleared++;
      }
    }

    // Clear database cache
    try {
      const result = await this.dataSource.query(
        `DELETE FROM formula_cache WHERE expires_at < NOW()`
      );
      cleared += result.rowCount || 0;
    } catch (error) {
      this.logger.debug(`Cache cleanup failed: ${(error as Error).message}`);
    }

    return cleared;
  }
}
