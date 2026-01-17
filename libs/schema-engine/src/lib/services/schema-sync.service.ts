import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import {
  CollectionDefinition,
  PropertyDefinition,
  SchemaSyncState,
  OwnerType,
} from '@hubblewave/instance-db';

/**
 * Represents a physical table discovered from PostgreSQL information_schema.
 */
interface PhysicalTableInfo {
  tableName: string;
  schemaName: string;
  columns: PhysicalColumnInfo[];
}

/**
 * Represents a physical column discovered from PostgreSQL information_schema.
 */
interface PhysicalColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  characterMaxLength: number | null;
}

/**
 * Issue detected during sync/drift check.
 */
export interface SyncIssue {
  type: 'orphaned_table' | 'orphaned_column' | 'missing_table' |
        'missing_column' | 'type_mismatch' | 'constraint_mismatch';
  severity: 'error' | 'warning' | 'info';
  collection?: string;
  property?: string;
  message: string;
  autoResolvable: boolean;
  suggestedAction?: string;
}

/**
 * Result of a sync operation.
 */
export interface SyncCheckResult {
  collectionsChecked: number;
  propertiesChecked: number;
  driftDetected: boolean;
  issues: SyncIssue[];
  resolvedAutomatically: number;
  requiresManualReview: number;
  durationMs: number;
}

/**
 * SchemaSyncService
 *
 * This service is responsible for maintaining consistency between HubbleWave's
 * metadata layer and the actual PostgreSQL physical schema.
 */
@Injectable()
export class SchemaSyncService implements OnModuleInit {
  private readonly logger = new Logger(SchemaSyncService.name);

  private readonly syncLockInstanceId: string;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,

    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,

    @InjectRepository(SchemaSyncState)
    private readonly syncStateRepo: Repository<SchemaSyncState>,
  ) {
    this.syncLockInstanceId = `instance-${crypto.randomBytes(8).toString('hex')}-${process.pid}`;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`Schema Sync Service initialized with instance ID: ${this.syncLockInstanceId}`);

    this.performDriftCheck().catch(err => {
      this.logger.error(`Initial drift check failed: ${err.message}`);
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledDriftCheck(): Promise<void> {
    this.logger.debug('Starting scheduled drift check');
    await this.performDriftCheck();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRIFT DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Performs a comprehensive drift check between metadata and physical schema.
   */
  async performDriftCheck(): Promise<SyncCheckResult> {
    const startTime = Date.now();

    const gotLock = await this.acquireSyncLock();
    if (!gotLock) {
      this.logger.debug('Another instance is running drift check, skipping');
      return {
        collectionsChecked: 0,
        propertiesChecked: 0,
        driftDetected: false,
        issues: [],
        resolvedAutomatically: 0,
        requiresManualReview: 0,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const issues: SyncIssue[] = [];

      const collections = await this.collectionRepo.find({
        relations: ['properties'],
      });

      const physicalTables = await this.getPhysicalTables();

      const physicalTableMap = new Map(
        physicalTables.map(t => [`${t.schemaName}.${t.tableName}`, t])
      );

      const accountedTables = new Set<string>();

      for (const collection of collections) {
        const schema = 'public';
        const tableKey = `${schema}.${collection.tableName}`;
        const physicalTable = physicalTableMap.get(tableKey);

        if (!physicalTable) {
          issues.push({
            type: 'missing_table',
            severity: 'error',
            collection: collection.code,
            message: `Physical table '${tableKey}' not found for collection '${collection.code}'`,
            autoResolvable: collection.ownerType === 'custom',
            suggestedAction: collection.ownerType === 'custom'
              ? 'Recreate table from collection definition'
              : 'Run platform migration to create missing table',
          });
          continue;
        }

        accountedTables.add(tableKey);

        const physicalColumnMap = new Map(
          physicalTable.columns.map(c => [c.columnName, c])
        );

        for (const property of collection.properties || []) {
          if (!property.columnName) {
            continue;
          }

          const physicalColumn = physicalColumnMap.get(property.columnName);

          if (!physicalColumn) {
            issues.push({
              type: 'missing_column',
              severity: 'error',
              collection: collection.code,
              property: property.code,
              message: `Column '${property.columnName}' not found for property '${property.code}'`,
              autoResolvable: property.ownerType === 'custom',
              suggestedAction: 'Add column to table',
            });
            continue;
          }
        }

        const standardColumns = new Set([
          'id', 'created_at', 'updated_at', 'created_by', 'updated_by',
          'is_deleted', 'deleted_at',
        ]);

        const propertyColumns = new Set(
          (collection.properties || [])
            .filter(p => p.columnName)
            .map(p => p.columnName)
        );

        for (const col of physicalTable.columns) {
          if (
            !standardColumns.has(col.columnName) &&
            !propertyColumns.has(col.columnName) &&
            !col.columnName.startsWith('_deleted_')
          ) {
            issues.push({
              type: 'orphaned_column',
              severity: 'warning',
              collection: collection.code,
              property: col.columnName,
              message: `Column '${col.columnName}' in table '${collection.tableName}' has no property definition`,
              autoResolvable: false,
              suggestedAction: 'Create property definition or remove orphaned column',
            });
          }
        }
      }

      const systemTablePrefixes = [
        'pg_', 'sql_', '_deleted_', 'schema_', 'typeorm_',
        'collection_definition', 'property_definition', 'choice_',
      ];

      for (const [tableKey, table] of physicalTableMap) {
        if (!accountedTables.has(tableKey)) {
          const isSystemTable = systemTablePrefixes.some(
            prefix => table.tableName.startsWith(prefix)
          );

          if (!isSystemTable) {
            issues.push({
              type: 'orphaned_table',
              severity: 'info',
              collection: table.tableName,
              message: `Table '${tableKey}' has no collection definition`,
              autoResolvable: false,
              suggestedAction: 'Create collection definition or consider removing orphaned table',
            });
          }
        }
      }

      const durationMs = Date.now() - startTime;
      const totalProperties = collections.reduce(
        (sum, c) => sum + (c.properties?.length ?? 0),
        0
      );
      const errorCount = issues.filter(i => i.severity === 'error').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;

      await this.updateSyncState({
        lastFullSyncAt: new Date(),
        lastFullSyncDurationMs: durationMs,
        lastFullSyncResult: issues.length === 0 ? 'success' : 'issues_found',
        lastDriftCheckAt: new Date(),
        driftDetected: issues.length > 0,
        driftDetails: issues.length > 0 ? {
          issues,
          checkedAt: new Date().toISOString()
        } : null,
        totalCollections: collections.length,
        totalProperties,
        orphanedTables: issues.filter(i => i.type === 'orphaned_table').length,
        orphanedColumns: issues.filter(i => i.type === 'orphaned_column').length,
      });

      if (issues.length > 0) {
        this.logger.warn(
          `Drift check completed in ${durationMs}ms - found ${issues.length} issues: ` +
          `${errorCount} errors, ${warningCount} warnings, ` +
          `${issues.length - errorCount - warningCount} info`
        );
      } else {
        this.logger.log(
          `Drift check completed in ${durationMs}ms - ` +
          `${collections.length} collections and ${totalProperties} properties in sync`
        );
      }

      return {
        collectionsChecked: collections.length,
        propertiesChecked: totalProperties,
        driftDetected: issues.length > 0,
        issues,
        resolvedAutomatically: 0,
        requiresManualReview: issues.filter(i => !i.autoResolvable).length,
        durationMs,
      };
    } finally {
      await this.releaseSyncLock();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLE DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Discovers physical tables and creates collection definitions for them.
   */
  async discoverAndRegisterTables(
    tableNames: string[],
    options: {
      schemaName?: string;
      owner?: OwnerType;
      performedBy?: string;
    } = {},
  ): Promise<{ registered: string[]; failed: string[] }> {
    const schemaName = options.schemaName || 'public';
    const registered: string[] = [];
    const failed: string[] = [];

    for (const tableName of tableNames) {
      try {
        const existing = await this.collectionRepo.findOne({
          where: { tableName },
        });

        if (existing) {
          this.logger.debug(
            `Collection already exists for table '${tableName}', skipping`
          );
          continue;
        }

        const tableInfo = await this.getPhysicalTableInfo(tableName, schemaName);
        if (!tableInfo) {
          this.logger.warn(`Table '${tableName}' not found in schema '${schemaName}'`);
          failed.push(tableName);
          continue;
        }

        const collection = this.collectionRepo.create({
          code: this.tableNameToCode(tableName),
          name: this.tableNameToLabel(tableName),
          pluralName: this.tableNameToLabel(tableName) + 's',
          tableName: tableName,
          ownerType: options.owner || 'custom',
          category: 'custom',
          isExtensible: true,
          enableAttachments: true,
          enableActivityLog: true,
          isAudited: true,
        });

        const savedCollection = await this.collectionRepo.save(collection);

        const standardColumns = new Set([
          'id', 'created_at', 'updated_at', 'created_by', 'updated_by',
          'is_deleted', 'deleted_at',
        ]);

        let position = 0;
        for (const column of tableInfo.columns) {
          if (standardColumns.has(column.columnName)) {
            continue;
          }

          // Note: propertyTypeId is resolved from PropertyType table
          const property = this.propertyRepo.create({
            collection: savedCollection,
            collectionId: savedCollection.id,
            code: column.columnName,
            name: this.columnNameToLabel(column.columnName),
            columnName: column.columnName,
            propertyTypeId: await this.resolvePropertyTypeId(column.dataType),
            isRequired: !column.isNullable,
            ownerType: options.owner || 'custom',
            position: position++,
          });

          await this.propertyRepo.save(property);
        }

        registered.push(tableName);
        this.logger.log(
          `Registered table '${tableName}' as collection '${collection.code}' ` +
          `with ${tableInfo.columns.length - standardColumns.size} properties`
        );
      } catch (error: any) {
        this.logger.error(`Failed to register table '${tableName}': ${error.message}`);
        failed.push(tableName);
      }
    }

    return { registered, failed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHYSICAL SCHEMA QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  private async getPhysicalTables(): Promise<PhysicalTableInfo[]> {
    const tables = await this.dataSource.query(`
      SELECT
        t.table_schema as schema_name,
        t.table_name
      FROM information_schema.tables t
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_schema, t.table_name
    `);

    const result: PhysicalTableInfo[] = [];

    for (const table of tables) {
      const columns = await this.getPhysicalColumns(
        table.table_name,
        table.schema_name
      );
      result.push({
        tableName: table.table_name,
        schemaName: table.schema_name,
        columns,
      });
    }

    return result;
  }

  private async getPhysicalColumns(
    tableName: string,
    schemaName: string,
  ): Promise<PhysicalColumnInfo[]> {
    const columns = await this.dataSource.query(`
      SELECT
        column_name,
        data_type,
        is_nullable = 'YES' as is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `, [schemaName, tableName]);

    return columns.map((c: Record<string, unknown>) => ({
      columnName: c.column_name as string,
      dataType: c.data_type as string,
      isNullable: c.is_nullable as boolean,
      columnDefault: c.column_default as string | null,
      characterMaxLength: c.character_maximum_length as number | null,
    }));
  }

  private async getPhysicalTableInfo(
    tableName: string,
    schemaName: string,
  ): Promise<PhysicalTableInfo | null> {
    const columns = await this.getPhysicalColumns(tableName, schemaName);

    if (columns.length === 0) {
      return null;
    }

    return {
      tableName,
      schemaName,
      columns,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPE MAPPING
  // ═══════════════════════════════════════════════════════════════════════════

  private async resolvePropertyTypeId(pgType: string): Promise<string> {
    // Default to text type - in a real implementation, this would
    // look up the PropertyType table based on the PostgreSQL type
    const mapping: Record<string, string> = {
      'uuid': 'uuid',
      'character varying': 'text',
      'varchar': 'text',
      'text': 'text',
      'integer': 'integer',
      'bigint': 'integer',
      'numeric': 'decimal',
      'boolean': 'boolean',
      'date': 'date',
      'timestamp with time zone': 'datetime',
      'timestamptz': 'datetime',
      'jsonb': 'json',
    };

    const typeCode = mapping[pgType.toLowerCase()] || 'text';

    // Query the PropertyType table to get the actual ID
    const propertyType = await this.dataSource.query(`
      SELECT id FROM property_types WHERE code = $1 LIMIT 1
    `, [typeCode]);

    if (propertyType.length > 0) {
      return propertyType[0].id;
    }

    // Fallback to querying for text type
    const textType = await this.dataSource.query(`
      SELECT id FROM property_types WHERE code = 'text' LIMIT 1
    `);

    return textType.length > 0 ? textType[0].id : '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private tableNameToCode(tableName: string): string {
    return tableName
      .replace(/^(t_|tbl_|table_)/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
  }

  private tableNameToLabel(tableName: string): string {
    return tableName
      .replace(/^(t_|tbl_|table_)/, '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private columnNameToLabel(columnName: string): string {
    return columnName
      .replace(/_id$/, '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISTRIBUTED LOCKING
  // ═══════════════════════════════════════════════════════════════════════════

  private async acquireSyncLock(): Promise<boolean> {
    const lockDurationMs = 5 * 60 * 1000;
    const expiresAt = new Date(Date.now() + lockDurationMs);

    const result = await this.syncStateRepo
      .createQueryBuilder()
      .update()
      .set({
        syncLockHolder: this.syncLockInstanceId,
        syncLockAcquiredAt: new Date(),
        syncLockExpiresAt: expiresAt,
      })
      .where('sync_lock_holder IS NULL OR sync_lock_expires_at < NOW()')
      .execute();

    const acquired = (result.affected ?? 0) >= 1;

    if (acquired) {
      this.logger.debug(`Acquired sync lock (expires: ${expiresAt.toISOString()})`);
    }

    return acquired;
  }

  private async releaseSyncLock(): Promise<void> {
    const result = await this.syncStateRepo
      .createQueryBuilder()
      .update()
      .set({
        syncLockHolder: null as unknown as string,
        syncLockAcquiredAt: null as unknown as Date,
        syncLockExpiresAt: null as unknown as Date,
      })
      .where('sync_lock_holder = :holder', { holder: this.syncLockInstanceId })
      .execute();

    if ((result.affected ?? 0) >= 1) {
      this.logger.debug('Released sync lock');
    }
  }

  private async updateSyncState(
    updates: Partial<SchemaSyncState>
  ): Promise<void> {
    await this.syncStateRepo
      .createQueryBuilder()
      .update()
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .execute();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC QUERY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async getSyncState(): Promise<SchemaSyncState | null> {
    return this.syncStateRepo.findOne({});
  }

  async getSyncSummary(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    driftDetected: boolean;
    lastCheckAt: Date | null;
    issueCount: number;
    collections: number;
    properties: number;
    message: string;
  }> {
    const state = await this.getSyncState();

    if (!state) {
      return {
        status: 'warning',
        driftDetected: false,
        lastCheckAt: null,
        issueCount: 0,
        collections: 0,
        properties: 0,
        message: 'Sync state not initialized',
      };
    }

    const issueCount = state.driftDetails?.issues?.length ?? 0;
    const errorCount = state.driftDetails?.issues?.filter(
      (i: SyncIssue) => i.severity === 'error'
    ).length ?? 0;

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (errorCount > 0) {
      status = 'error';
    } else if (issueCount > 0) {
      status = 'warning';
    }

    return {
      status,
      driftDetected: state.driftDetected,
      lastCheckAt: state.lastFullSyncAt,
      issueCount,
      collections: state.totalCollections,
      properties: state.totalProperties,
      message: state.getSummary(),
    };
  }
}
