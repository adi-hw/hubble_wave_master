/**
 * LookupService
 * HubbleWave Platform - Phase 2
 *
 * Service for resolving lookup values from related records.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthorizationService } from '@hubblewave/authorization';
import { UserRequestContext } from '@hubblewave/auth-guard';
import { RuntimeAnomalyService } from '@hubblewave/instance-db';
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
    private readonly cacheService: FormulaCacheService,
    private readonly authz: AuthorizationService,
    private readonly runtimeAnomalyService: RuntimeAnomalyService,
  ) {}

  /**
   * Validate SQL identifier to prevent SQL injection
   */
  private validateIdentifier(identifier: string): boolean {
    return SAFE_IDENTIFIER_REGEX.test(identifier);
  }

  /**
   * Resolve a lookup value for a record. The caller's UserRequestContext is used to
   * enforce row- and field-level access on the source collection. If the caller
   * cannot read the source field or referenced row, null is returned for that
   * value (fail-closed).
   */
  async resolveLookup(
    collectionCode: string,
    recordId: string,
    referenceValue: unknown,
    config: LookupConfig,
    ctx: UserRequestContext,
  ): Promise<LookupResult> {
    try {
      if (referenceValue === null || referenceValue === undefined) {
        return { success: true, value: null };
      }

      // Field-level access on source collection: if caller cannot read the
      // source property, return null without querying.
      const fieldReadable = await this.isFieldReadable(ctx, config.sourceCollection, config.sourceProperty);
      if (!fieldReadable) {
        return { success: true, value: null };
      }

      // Check cache first — cache key includes user identity so users with
      // different access do not share lookup results.
      const cacheKey = `lookup:${ctx.userId}:${collectionCode}:${recordId}:${config.referenceProperty}:${config.sourceProperty}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached !== null) {
        return { success: true, value: cached };
      }

      // Handle single reference
      if (!Array.isArray(referenceValue)) {
        const value = await this.getLookupValue(
          ctx,
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
            ctx,
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
   * Get a single lookup value from the source collection, applying RLS.
   */
  private async getLookupValue(
    ctx: UserRequestContext,
    sourceCollection: string,
    recordId: string,
    sourceProperty: string
  ): Promise<unknown> {
    try {
      // SECURITY: Validate identifiers to prevent SQL injection
      if (!this.validateIdentifier(sourceCollection) || !this.validateIdentifier(sourceProperty)) {
        this.logger.warn(`SECURITY: Invalid identifier rejected in getLookupValue: collection=${sourceCollection}, property=${sourceProperty}`);
        await this.runtimeAnomalyService.record({
          kind: 'lookup_invalid_identifier_rejected',
          serviceCode: 'svc-data',
          message: `SECURITY: Invalid identifier rejected in getLookupValue for collection=${sourceCollection}, property=${sourceProperty}`,
          collectionCode: sourceCollection,
          context: { sourceCollection, sourceProperty },
        });
        return null;
      }

      // Row-level access: if caller cannot read the table at all, return null.
      const canRead = await this.authz.canAccessTable(ctx, sourceCollection, 'read');
      if (!canRead) {
        return null;
      }

      const qb = this.dataSource
        .createQueryBuilder()
        .select(`t."${sourceProperty}"`, sourceProperty)
        .from(`public."${sourceCollection}"`, 't')
        .where('t.id = :lookup_id', { lookup_id: recordId })
        .andWhere('t.deleted_at IS NULL')
        .limit(1);

      const rls = await this.authz.buildRowLevelClause(ctx, sourceCollection, 'read', 't');
      rls.clauses.forEach((clause, index) => {
        const prefixed: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rls.params)) {
          prefixed[`lookup_rls_${index}_${k}`] = v;
        }
        const replaced = clause.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => `:lookup_rls_${index}_${name}`);
        qb.andWhere(replaced, prefixed);
      });

      const row = await qb.getRawOne();
      if (row && sourceProperty in row) {
        return row[sourceProperty];
      }
      return null;
    } catch (error) {
      this.logger.debug(`Failed to get lookup value: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Check whether the caller can read a specific property on a collection.
   */
  private async isFieldReadable(
    ctx: UserRequestContext,
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
   * Resolve all lookup properties for a record
   */
  async resolveAllLookups(
    collectionCode: string,
    recordId: string,
    record: Record<string, unknown>,
    lookupConfigs: Array<{
      propertyCode: string;
      config: LookupConfig;
    }>,
    ctx: UserRequestContext,
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    for (const { propertyCode, config } of lookupConfigs) {
      const referenceValue = record[config.referenceProperty];
      const result = await this.resolveLookup(
        collectionCode,
        recordId,
        referenceValue,
        config,
        ctx,
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
          await this.runtimeAnomalyService.record({
            kind: 'lookup_invalid_identifier_rejected',
            serviceCode: 'svc-data',
            message: `SECURITY: Invalid identifier rejected in invalidateLookupCache for collection=${dep.source_collection}, property=${dep.source_property}`,
            collectionCode: sourceCollection,
            recordId: sourceRecordId,
            context: { sourceCollection: dep.source_collection, sourceProperty: dep.source_property },
          });
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
