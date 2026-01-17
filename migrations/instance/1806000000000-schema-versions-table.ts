import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema Versions Table Migration
 * HubbleWave Platform - Phase 2
 *
 * Creates the schema_versions table for tracking schema snapshots
 * and enabling rollback capabilities. This complements the
 * schema_change_log table by storing full point-in-time snapshots.
 */
export class SchemaVersionsTable1806000000000 implements MigrationInterface {
  name = 'SchemaVersionsTable1806000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create schema_versions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Version number (incrementing per collection)
        version INTEGER NOT NULL,

        -- Collection this version belongs to
        collection_code VARCHAR(100) NOT NULL,

        -- Full schema snapshot at this version
        snapshot JSONB NOT NULL,

        -- What type of change created this version
        change_type VARCHAR(30) NOT NULL,

        -- Human-readable summary of the change
        change_summary TEXT NOT NULL,

        -- Who created this version
        created_by UUID NOT NULL,

        -- Link to parent version (for version chain)
        parent_version_id UUID REFERENCES schema_versions(id),

        -- Additional metadata
        metadata JSONB,

        -- Timestamp
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT uq_schema_versions_collection_version
          UNIQUE (collection_code, version),
        CONSTRAINT chk_schema_versions_change_type CHECK (
          change_type IN (
            'collection_created',
            'collection_updated',
            'collection_deleted',
            'property_added',
            'property_updated',
            'property_deleted',
            'index_added',
            'index_deleted',
            'rollback'
          )
        )
      )
    `);

    // Indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_versions_collection
      ON schema_versions(collection_code)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_versions_collection_version
      ON schema_versions(collection_code, version DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_versions_created_by
      ON schema_versions(created_by)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_versions_created_at
      ON schema_versions(created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_versions_parent
      ON schema_versions(parent_version_id)
    `);

    // Add comments
    await queryRunner.query(`
      COMMENT ON TABLE schema_versions IS
        'Stores full schema snapshots for collections, enabling version history and rollback'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN schema_versions.snapshot IS
        'Complete JSON snapshot of the collection schema at this version'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN schema_versions.change_summary IS
        'Human-readable description of what changed in this version'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_versions_parent`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_versions_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_versions_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_versions_collection_version`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_versions_collection`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS schema_versions`);
  }
}
