/**
 * Schema Version Service
 * HubbleWave Platform - Phase 2
 *
 * Manages schema versioning, snapshots, and rollback capabilities.
 * Tracks all schema changes with full audit trail.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';

export interface SchemaVersion {
  id: string;
  version: number;
  collectionCode: string;
  snapshot: CollectionSnapshot;
  changeType: SchemaChangeType;
  changeSummary: string;
  createdBy: string;
  createdAt: Date;
  parentVersionId?: string;
  metadata?: Record<string, unknown>;
}

export interface CollectionSnapshot {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  storageTable: string;
  ownership: 'system' | 'module' | 'custom';
  properties: PropertySnapshot[];
  indexes: IndexSnapshot[];
  metadata?: Record<string, unknown>;
}

export interface PropertySnapshot {
  id: string;
  code: string;
  name: string;
  propertyTypeId: string;
  storageColumn: string;
  isRequired: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  defaultValue?: unknown;
  config?: Record<string, unknown>;
  order: number;
}

export interface IndexSnapshot {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export type SchemaChangeType =
  | 'collection_created'
  | 'collection_updated'
  | 'collection_deleted'
  | 'property_added'
  | 'property_updated'
  | 'property_deleted'
  | 'index_added'
  | 'index_deleted'
  | 'rollback';

export interface SchemaVersionCompare {
  oldVersion: SchemaVersion;
  newVersion: SchemaVersion;
  changes: SchemaChange[];
}

export interface SchemaChange {
  type: 'added' | 'removed' | 'modified';
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
}

export interface RollbackResult {
  success: boolean;
  newVersion?: SchemaVersion;
  error?: string;
  affectedRecords?: number;
}

@Injectable()
export class SchemaVersionService {
  private readonly logger = new Logger(SchemaVersionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource
  ) {}

  /**
   * Create a new schema version snapshot
   */
  async createVersion(
    collectionCode: string,
    snapshot: CollectionSnapshot,
    changeType: SchemaChangeType,
    changeSummary: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<SchemaVersion> {
    return this.dataSource.transaction(async (manager) => {
      const lastVersion = await manager.query(
        `SELECT MAX(version) as max_version FROM schema_versions WHERE collection_code = $1`,
        [collectionCode]
      );

      const newVersionNum = (lastVersion[0]?.max_version || 0) + 1;
      const parentId = lastVersion[0]?.id;

      const [result] = await manager.query(
        `INSERT INTO schema_versions
         (id, version, collection_code, snapshot, change_type, change_summary, created_by, parent_version_id, metadata)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          newVersionNum,
          collectionCode,
          JSON.stringify(snapshot),
          changeType,
          changeSummary,
          userId,
          parentId,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );

      this.logger.log(
        `Created schema version ${newVersionNum} for ${collectionCode}: ${changeSummary}`
      );

      return this.mapToSchemaVersion(result);
    });
  }

  /**
   * Get all versions for a collection
   */
  async getVersionHistory(
    collectionCode: string,
    limit = 50,
    offset = 0
  ): Promise<{ versions: SchemaVersion[]; total: number }> {
    const [versions, [countResult]] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM schema_versions
         WHERE collection_code = $1
         ORDER BY version DESC
         LIMIT $2 OFFSET $3`,
        [collectionCode, limit, offset]
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as total FROM schema_versions WHERE collection_code = $1`,
        [collectionCode]
      ),
    ]);

    return {
      versions: versions.map(this.mapToSchemaVersion),
      total: parseInt(countResult.total, 10),
    };
  }

  /**
   * Get a specific version by ID or version number
   */
  async getVersion(
    collectionCode: string,
    versionOrId: number | string
  ): Promise<SchemaVersion | null> {
    const query =
      typeof versionOrId === 'number'
        ? `SELECT * FROM schema_versions WHERE collection_code = $1 AND version = $2`
        : `SELECT * FROM schema_versions WHERE collection_code = $1 AND id = $2`;

    const [result] = await this.dataSource.query(query, [collectionCode, versionOrId]);

    return result ? this.mapToSchemaVersion(result) : null;
  }

  /**
   * Get the latest version for a collection
   */
  async getLatestVersion(collectionCode: string): Promise<SchemaVersion | null> {
    const [result] = await this.dataSource.query(
      `SELECT * FROM schema_versions
       WHERE collection_code = $1
       ORDER BY version DESC
       LIMIT 1`,
      [collectionCode]
    );

    return result ? this.mapToSchemaVersion(result) : null;
  }

  /**
   * Compare two versions and return the differences
   */
  async compareVersions(
    collectionCode: string,
    oldVersionNum: number,
    newVersionNum: number
  ): Promise<SchemaVersionCompare | null> {
    const [oldVersion, newVersion] = await Promise.all([
      this.getVersion(collectionCode, oldVersionNum),
      this.getVersion(collectionCode, newVersionNum),
    ]);

    if (!oldVersion || !newVersion) {
      return null;
    }

    const changes = this.calculateChanges(oldVersion.snapshot, newVersion.snapshot);

    return {
      oldVersion,
      newVersion,
      changes,
    };
  }

  /**
   * Rollback a collection to a previous version
   */
  async rollbackToVersion(
    collectionCode: string,
    targetVersion: number,
    userId: string
  ): Promise<RollbackResult> {
    return this.dataSource.transaction(async (manager) => {
      const targetSnapshot = await this.getVersion(collectionCode, targetVersion);
      if (!targetSnapshot) {
        return { success: false, error: `Version ${targetVersion} not found` };
      }

      const currentVersion = await this.getLatestVersion(collectionCode);
      if (!currentVersion) {
        return { success: false, error: 'No current version found' };
      }

      if (targetVersion >= currentVersion.version) {
        return { success: false, error: 'Cannot rollback to a newer or same version' };
      }

      try {
        await this.applySnapshot(manager, targetSnapshot.snapshot);

        const newVersion = await this.createVersionInTransaction(
          manager,
          collectionCode,
          targetSnapshot.snapshot,
          'rollback',
          `Rolled back to version ${targetVersion}`,
          userId,
          { rolledBackFrom: currentVersion.version, rolledBackTo: targetVersion }
        );

        this.logger.log(
          `Rolled back ${collectionCode} from v${currentVersion.version} to v${targetVersion}`
        );

        return { success: true, newVersion };
      } catch (error) {
        this.logger.error(`Rollback failed: ${error.message}`, error.stack);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Create an initial snapshot of the current schema state
   */
  async createInitialSnapshot(
    collectionCode: string,
    userId: string
  ): Promise<SchemaVersion> {
    const snapshot = await this.captureCurrentSnapshot(collectionCode);
    if (!snapshot) {
      throw new Error(`Collection ${collectionCode} not found`);
    }

    return this.createVersion(
      collectionCode,
      snapshot,
      'collection_created',
      'Initial schema snapshot',
      userId
    );
  }

  /**
   * Capture the current state of a collection as a snapshot
   */
  async captureCurrentSnapshot(collectionCode: string): Promise<CollectionSnapshot | null> {
    const [collection] = await this.dataSource.query(
      `SELECT * FROM collections WHERE code = $1 AND deleted_at IS NULL`,
      [collectionCode]
    );

    if (!collection) {
      return null;
    }

    const properties = await this.dataSource.query(
      `SELECT * FROM properties WHERE collection_id = $1 AND deleted_at IS NULL ORDER BY "order"`,
      [collection.id]
    );

    const indexes = await this.getTableIndexes(collection.storage_table);

    return {
      code: collection.code,
      name: collection.name,
      description: collection.description,
      icon: collection.icon,
      storageTable: collection.storage_table,
      ownership: collection.ownership,
      properties: properties.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        code: p.code as string,
        name: p.name as string,
        propertyTypeId: p.property_type_id as string,
        storageColumn: p.storage_column as string,
        isRequired: p.is_required as boolean,
        isUnique: p.is_unique as boolean,
        isIndexed: p.is_indexed as boolean,
        defaultValue: p.default_value,
        config: p.config as Record<string, unknown>,
        order: p.order as number,
      })),
      indexes,
      metadata: collection.metadata,
    };
  }

  /**
   * Calculate differences between two snapshots
   */
  private calculateChanges(
    oldSnapshot: CollectionSnapshot,
    newSnapshot: CollectionSnapshot
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];

    if (oldSnapshot.name !== newSnapshot.name) {
      changes.push({
        type: 'modified',
        path: 'name',
        oldValue: oldSnapshot.name,
        newValue: newSnapshot.name,
        description: `Collection name changed from "${oldSnapshot.name}" to "${newSnapshot.name}"`,
      });
    }

    if (oldSnapshot.description !== newSnapshot.description) {
      changes.push({
        type: 'modified',
        path: 'description',
        oldValue: oldSnapshot.description,
        newValue: newSnapshot.description,
        description: 'Collection description changed',
      });
    }

    const oldProps = new Map(oldSnapshot.properties.map((p) => [p.code, p]));
    const newProps = new Map(newSnapshot.properties.map((p) => [p.code, p]));

    for (const [code, newProp] of newProps) {
      const oldProp = oldProps.get(code);
      if (!oldProp) {
        changes.push({
          type: 'added',
          path: `properties.${code}`,
          newValue: newProp,
          description: `Property "${newProp.name}" added`,
        });
      } else {
        const propChanges = this.compareProperties(oldProp, newProp);
        changes.push(...propChanges);
      }
    }

    for (const [code, oldProp] of oldProps) {
      if (!newProps.has(code)) {
        changes.push({
          type: 'removed',
          path: `properties.${code}`,
          oldValue: oldProp,
          description: `Property "${oldProp.name}" removed`,
        });
      }
    }

    const oldIndexes = new Map(oldSnapshot.indexes.map((i) => [i.name, i]));
    const newIndexes = new Map(newSnapshot.indexes.map((i) => [i.name, i]));

    for (const [name, newIndex] of newIndexes) {
      if (!oldIndexes.has(name)) {
        changes.push({
          type: 'added',
          path: `indexes.${name}`,
          newValue: newIndex,
          description: `Index "${name}" added`,
        });
      }
    }

    for (const [name, oldIndex] of oldIndexes) {
      if (!newIndexes.has(name)) {
        changes.push({
          type: 'removed',
          path: `indexes.${name}`,
          oldValue: oldIndex,
          description: `Index "${name}" removed`,
        });
      }
    }

    return changes;
  }

  /**
   * Compare two property snapshots
   */
  private compareProperties(
    oldProp: PropertySnapshot,
    newProp: PropertySnapshot
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const prefix = `properties.${oldProp.code}`;

    if (oldProp.name !== newProp.name) {
      changes.push({
        type: 'modified',
        path: `${prefix}.name`,
        oldValue: oldProp.name,
        newValue: newProp.name,
        description: `Property "${oldProp.code}" name changed`,
      });
    }

    if (oldProp.propertyTypeId !== newProp.propertyTypeId) {
      changes.push({
        type: 'modified',
        path: `${prefix}.propertyTypeId`,
        oldValue: oldProp.propertyTypeId,
        newValue: newProp.propertyTypeId,
        description: `Property "${oldProp.code}" type changed`,
      });
    }

    if (oldProp.isRequired !== newProp.isRequired) {
      changes.push({
        type: 'modified',
        path: `${prefix}.isRequired`,
        oldValue: oldProp.isRequired,
        newValue: newProp.isRequired,
        description: `Property "${oldProp.code}" required constraint ${newProp.isRequired ? 'added' : 'removed'}`,
      });
    }

    if (oldProp.isUnique !== newProp.isUnique) {
      changes.push({
        type: 'modified',
        path: `${prefix}.isUnique`,
        oldValue: oldProp.isUnique,
        newValue: newProp.isUnique,
        description: `Property "${oldProp.code}" unique constraint ${newProp.isUnique ? 'added' : 'removed'}`,
      });
    }

    return changes;
  }

  /**
   * Apply a snapshot to restore the schema state
   */
  private async applySnapshot(
    manager: EntityManager,
    snapshot: CollectionSnapshot
  ): Promise<void> {
    await manager.query(
      `UPDATE collections SET name = $1, description = $2, icon = $3, metadata = $4, updated_at = NOW()
       WHERE code = $5`,
      [
        snapshot.name,
        snapshot.description,
        snapshot.icon,
        snapshot.metadata ? JSON.stringify(snapshot.metadata) : null,
        snapshot.code,
      ]
    );
  }

  /**
   * Get indexes for a table
   */
  private async getTableIndexes(tableName: string): Promise<IndexSnapshot[]> {
    const indexes = await this.dataSource.query(
      `SELECT
         i.relname as index_name,
         a.attname as column_name,
         ix.indisunique as is_unique
       FROM pg_class t
       JOIN pg_index ix ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
       WHERE t.relname = $1 AND t.relkind = 'r'
       AND NOT ix.indisprimary
       ORDER BY i.relname`,
      [tableName]
    );

    const indexMap = new Map<string, { columns: string[]; isUnique: boolean }>();
    for (const row of indexes) {
      const existing = indexMap.get(row.index_name);
      if (existing) {
        existing.columns.push(row.column_name);
      } else {
        indexMap.set(row.index_name, {
          columns: [row.column_name],
          isUnique: row.is_unique,
        });
      }
    }

    return Array.from(indexMap.entries()).map(([name, data]) => ({
      name,
      columns: data.columns,
      isUnique: data.isUnique,
    }));
  }

  /**
   * Create version within an existing transaction
   */
  private async createVersionInTransaction(
    manager: EntityManager,
    collectionCode: string,
    snapshot: CollectionSnapshot,
    changeType: SchemaChangeType,
    changeSummary: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<SchemaVersion> {
    const lastVersion = await manager.query(
      `SELECT MAX(version) as max_version, id FROM schema_versions WHERE collection_code = $1 GROUP BY id ORDER BY max_version DESC LIMIT 1`,
      [collectionCode]
    );

    const newVersionNum = (lastVersion[0]?.max_version || 0) + 1;
    const parentId = lastVersion[0]?.id;

    const [result] = await manager.query(
      `INSERT INTO schema_versions
       (id, version, collection_code, snapshot, change_type, change_summary, created_by, parent_version_id, metadata)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        newVersionNum,
        collectionCode,
        JSON.stringify(snapshot),
        changeType,
        changeSummary,
        userId,
        parentId,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    return this.mapToSchemaVersion(result);
  }

  /**
   * Map database row to SchemaVersion type
   */
  private mapToSchemaVersion(row: Record<string, unknown>): SchemaVersion {
    return {
      id: row.id as string,
      version: row.version as number,
      collectionCode: row.collection_code as string,
      snapshot:
        typeof row.snapshot === 'string'
          ? JSON.parse(row.snapshot)
          : (row.snapshot as CollectionSnapshot),
      changeType: row.change_type as SchemaChangeType,
      changeSummary: row.change_summary as string,
      createdBy: row.created_by as string,
      createdAt: new Date(row.created_at as string),
      parentVersionId: row.parent_version_id as string | undefined,
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : (row.metadata as Record<string, unknown> | undefined),
    };
  }
}
