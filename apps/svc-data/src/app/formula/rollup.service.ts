/**
 * RollupService
 * HubbleWave Platform - Phase 2
 *
 * Service for calculating rollup aggregations across related records.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FormulaCacheService } from './formula-cache.service';

interface RollupConfig {
  relationProperty: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';
  aggregateProperty: string;
  sourceCollection: string;
}

interface RollupResult {
  success: boolean;
  value?: number | string | null;
  error?: string;
  count?: number;
}

// Whitelist of safe SQL identifier characters
const SAFE_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

@Injectable()
export class RollupService {
  private readonly logger = new Logger(RollupService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cacheService: FormulaCacheService
  ) {}

  /**
   * Validate SQL identifier to prevent SQL injection
   */
  private validateIdentifier(identifier: string): boolean {
    return SAFE_IDENTIFIER_REGEX.test(identifier);
  }

  /**
   * Calculate a rollup value for a record
   */
  async calculateRollup(
    collectionCode: string,
    recordId: string,
    config: RollupConfig
  ): Promise<RollupResult> {
    try {
      // Check cache first
      const cacheKey = `rollup:${collectionCode}:${recordId}:${config.relationProperty}:${config.aggregation}:${config.aggregateProperty}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached !== null) {
        return { success: true, value: cached as number | string | null };
      }

      // Get related records
      const relatedRecords = await this.getRelatedRecords(
        collectionCode,
        recordId,
        config.relationProperty,
        config.sourceCollection
      );

      if (relatedRecords.length === 0) {
        await this.cacheService.set(cacheKey, null);
        return { success: true, value: null, count: 0 };
      }

      // Extract values for aggregation
      const values = relatedRecords
        .map((r) => r[config.aggregateProperty])
        .filter((v) => v !== null && v !== undefined);

      // Calculate aggregation
      const result = this.aggregate(values, config.aggregation);

      // Cache the result
      await this.cacheService.set(cacheKey, result);

      return {
        success: true,
        value: result,
        count: relatedRecords.length,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Rollup calculation failed: ${err.message}`, err.stack);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get related records for rollup calculation
   */
  private async getRelatedRecords(
    _collectionCode: string,
    recordId: string,
    relationProperty: string,
    sourceCollection: string
  ): Promise<Record<string, unknown>[]> {
    try {
      // SECURITY: Validate identifiers to prevent SQL injection
      if (!this.validateIdentifier(sourceCollection) || !this.validateIdentifier(relationProperty)) {
        this.logger.warn(`SECURITY: Invalid identifier rejected in getRelatedRecords: collection=${sourceCollection}, property=${relationProperty}`);
        return [];
      }

      // Query for related records where the relation property points to this record
      const result = await this.dataSource.query(
        `SELECT * FROM "${sourceCollection}"
         WHERE "${relationProperty}" = $1
         AND deleted_at IS NULL`,
        [recordId]
      );

      return result;
    } catch (error) {
      this.logger.debug(`Failed to get related records: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Perform aggregation on values
   */
  private aggregate(
    values: unknown[],
    aggregation: RollupConfig['aggregation']
  ): number | string | null {
    if (values.length === 0) {
      return aggregation === 'count' ? 0 : null;
    }

    switch (aggregation) {
      case 'count':
        return values.length;

      case 'sum': {
        const nums = values.filter((v) => typeof v === 'number') as number[];
        return nums.reduce((a, b) => a + b, 0);
      }

      case 'avg': {
        const nums = values.filter((v) => typeof v === 'number') as number[];
        if (nums.length === 0) return null;
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      }

      case 'min': {
        const nums = values.filter((v) => typeof v === 'number') as number[];
        if (nums.length === 0) return null;
        return Math.min(...nums);
      }

      case 'max': {
        const nums = values.filter((v) => typeof v === 'number') as number[];
        if (nums.length === 0) return null;
        return Math.max(...nums);
      }

      case 'first':
        return values[0] as string | number;

      case 'last':
        return values[values.length - 1] as string | number;

      default:
        return null;
    }
  }

  /**
   * Recalculate all rollups for a collection when source data changes
   */
  async recalculateRollupsForSource(
    sourceCollection: string,
    changedRecordId: string
  ): Promise<void> {
    try {
      // Find all rollup properties that depend on this source collection
      const rollupDeps = await this.dataSource.query(
        `SELECT DISTINCT source_collection, source_property
         FROM property_dependencies
         WHERE target_collection = $1 AND dependency_type = 'rollup'`,
        [sourceCollection]
      );

      for (const dep of rollupDeps) {
        // SECURITY: Validate identifiers from database before using in query
        if (!this.validateIdentifier(dep.source_collection) || !this.validateIdentifier(dep.source_property)) {
          this.logger.warn(`SECURITY: Invalid identifier in property_dependencies: collection=${dep.source_collection}, property=${dep.source_property}`);
          continue;
        }

        // Find records that reference the changed record
        const affectedRecords = await this.dataSource.query(
          `SELECT id FROM "${dep.source_collection}"
           WHERE "${dep.source_property}" = $1`,
          [changedRecordId]
        );

        for (const record of affectedRecords) {
          // Invalidate cache for this record
          await this.cacheService.invalidateRecord(
            dep.source_collection,
            record.id
          );
        }
      }
    } catch (error) {
      this.logger.debug(`Rollup recalculation failed: ${(error as Error).message}`);
    }
  }
}
