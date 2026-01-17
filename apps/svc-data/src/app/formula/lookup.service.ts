/**
 * LookupService
 * HubbleWave Platform - Phase 2
 *
 * Service for resolving lookup values from related records.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FormulaCacheService } from './formula-cache.service';

interface LookupConfig {
  referenceProperty: string;
  sourceProperty: string;
  sourceCollection: string;
}

// Whitelist of safe SQL identifier characters
const SAFE_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface LookupResult {
  success: boolean;
  value?: unknown;
  error?: string;
}

@Injectable()
export class LookupService {
  private readonly logger = new Logger(LookupService.name);

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
   * Resolve a lookup value for a record
   */
  async resolveLookup(
    collectionCode: string,
    recordId: string,
    referenceValue: unknown,
    config: LookupConfig
  ): Promise<LookupResult> {
    try {
      if (referenceValue === null || referenceValue === undefined) {
        return { success: true, value: null };
      }

      // Check cache first
      const cacheKey = `lookup:${collectionCode}:${recordId}:${config.referenceProperty}:${config.sourceProperty}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached !== null) {
        return { success: true, value: cached };
      }

      // Handle single reference
      if (!Array.isArray(referenceValue)) {
        const value = await this.getLookupValue(
          config.sourceCollection,
          referenceValue as string,
          config.sourceProperty
        );

        await this.cacheService.set(cacheKey, value);
        return { success: true, value };
      }

      // Handle multi-reference
      const values = await Promise.all(
        (referenceValue as string[]).map((ref) =>
          this.getLookupValue(
            config.sourceCollection,
            ref,
            config.sourceProperty
          )
        )
      );

      const filteredValues = values.filter((v) => v !== null);
      await this.cacheService.set(cacheKey, filteredValues);
      return { success: true, value: filteredValues };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Lookup resolution failed: ${err.message}`, err.stack);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get a single lookup value from the source collection
   */
  private async getLookupValue(
    sourceCollection: string,
    recordId: string,
    sourceProperty: string
  ): Promise<unknown> {
    try {
      // SECURITY: Validate identifiers to prevent SQL injection
      if (!this.validateIdentifier(sourceCollection) || !this.validateIdentifier(sourceProperty)) {
        this.logger.warn(`SECURITY: Invalid identifier rejected in getLookupValue: collection=${sourceCollection}, property=${sourceProperty}`);
        return null;
      }

      const result = await this.dataSource.query(
        `SELECT "${sourceProperty}" FROM "${sourceCollection}"
         WHERE id = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [recordId]
      );

      if (result.length > 0) {
        return result[0][sourceProperty];
      }

      return null;
    } catch (error) {
      this.logger.debug(`Failed to get lookup value: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Resolve all lookup properties for a record
   */
  async resolveAllLookups(
    collectionCode: string,
    recordId: string,
    record: Record<string, unknown>,
    lookupConfigs: Array<{
      propertyCode: string;
      config: LookupConfig;
    }>
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    for (const { propertyCode, config } of lookupConfigs) {
      const referenceValue = record[config.referenceProperty];
      const result = await this.resolveLookup(
        collectionCode,
        recordId,
        referenceValue,
        config
      );

      if (result.success) {
        results[propertyCode] = result.value;
      }
    }

    return results;
  }

  /**
   * Invalidate lookup cache when source record changes
   */
  async invalidateLookupCache(
    sourceCollection: string,
    sourceRecordId: string
  ): Promise<void> {
    try {
      // Find all lookup properties that reference this collection
      const lookupDeps = await this.dataSource.query(
        `SELECT DISTINCT source_collection, source_property
         FROM property_dependencies
         WHERE target_collection = $1 AND dependency_type = 'lookup'`,
        [sourceCollection]
      );

      for (const dep of lookupDeps) {
        // SECURITY: Validate identifiers from database before using in query
        if (!this.validateIdentifier(dep.source_collection) || !this.validateIdentifier(dep.source_property)) {
          this.logger.warn(`SECURITY: Invalid identifier in property_dependencies: collection=${dep.source_collection}, property=${dep.source_property}`);
          continue;
        }

        // Find records that reference the changed record
        const affectedRecords = await this.dataSource.query(
          `SELECT id FROM "${dep.source_collection}"
           WHERE "${dep.source_property}" = $1
           OR "${dep.source_property}"::jsonb ? $1`,
          [sourceRecordId]
        );

        for (const record of affectedRecords) {
          await this.cacheService.invalidateRecord(
            dep.source_collection,
            record.id
          );
        }
      }
    } catch (error) {
      this.logger.debug(`Lookup cache invalidation failed: ${(error as Error).message}`);
    }
  }
}
