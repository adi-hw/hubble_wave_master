/**
 * RollupService
 * HubbleWave Platform - Phase 2
 *
 * Service for calculating rollup aggregations across related records.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthorizationService } from '@hubblewave/authorization';
import { RequestContext } from '@hubblewave/auth-guard';
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
    private readonly cacheService: FormulaCacheService,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * Validate SQL identifier to prevent SQL injection
   */
  private validateIdentifier(identifier: string): boolean {
    return SAFE_IDENTIFIER_REGEX.test(identifier);
  }

  /**
   * Calculate a rollup value for a record. The caller's RequestContext is used
   * to enforce row- and field-level access on the source collection. If the
   * caller cannot read the aggregate field, the rollup returns 0 (count) or
   * null (other aggregations) without exposing protected values.
   */
  async calculateRollup(
    collectionCode: string,
    recordId: string,
    config: RollupConfig,
    ctx: RequestContext,
  ): Promise<RollupResult> {
    try {
      // Field-level access on source collection: required for any aggregation
      // other than 'count' (which only depends on row visibility).
      if (config.aggregation !== 'count') {
        const fieldReadable = await this.isFieldReadable(ctx, config.sourceCollection, config.aggregateProperty);
        if (!fieldReadable) {
          return { success: true, value: null, count: 0 };
        }
      }

      // Cache key includes user identity so users with different access do not
      // share rollup results.
      const cacheKey = `rollup:${ctx.userId}:${collectionCode}:${recordId}:${config.relationProperty}:${config.aggregation}:${config.aggregateProperty}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached !== null) {
        return { success: true, value: cached as number | string | null };
      }

      // Get related records (RLS-filtered)
      const relatedRecords = await this.getRelatedRecords(
        ctx,
        recordId,
        config.relationProperty,
        config.sourceCollection
      );

      if (relatedRecords.length === 0) {
        await this.cacheService.set(cacheKey, null);
        return { success: true, value: config.aggregation === 'count' ? 0 : null, count: 0 };
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
   * Get related records for rollup calculation, filtered by RLS for the caller.
   */
  private async getRelatedRecords(
    ctx: RequestContext,
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

      // Row-level access: if caller cannot read the source table, return [].
      const canRead = await this.authz.canAccessTable(ctx, sourceCollection, 'read');
      if (!canRead) {
        return [];
      }

      const qb = this.dataSource
        .createQueryBuilder()
        .select('t.*')
        .from(`public."${sourceCollection}"`, 't')
        .where(`t."${relationProperty}" = :rollup_record_id`, { rollup_record_id: recordId })
        .andWhere('t.deleted_at IS NULL');

      const rls = await this.authz.buildRowLevelClause(ctx, sourceCollection, 'read', 't');
      rls.clauses.forEach((clause, index) => {
        const prefixed: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rls.params)) {
          prefixed[`rollup_rls_${index}_${k}`] = v;
        }
        const replaced = clause.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => `:rollup_rls_${index}_${name}`);
        qb.andWhere(replaced, prefixed);
      });

      return await qb.getRawMany();
    } catch (error) {
      this.logger.debug(`Failed to get related records: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Check whether the caller can read a specific property on a collection.
   */
  private async isFieldReadable(
    ctx: RequestContext,
    sourceCollection: string,
    sourceProperty: string,
  ): Promise<boolean> {
    if (ctx.isAdmin) {
      return true;
    }
    if (!this.validateIdentifier(sourceCollection) || !this.validateIdentifier(sourceProperty)) {
      return false;
    }
    const fields = await this.authz.getAuthorizedFields(ctx, sourceCollection, [
      { code: sourceProperty, storagePath: `column:${sourceProperty}`, label: sourceProperty },
    ]);
    return fields[0]?.canRead === true;
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
