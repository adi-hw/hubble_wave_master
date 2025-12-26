import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema Governance Enhancement Migration
 * 
 * This migration adds governance and synchronization capabilities to the
 * collection_definitions and property_definitions tables. It introduces:
 * 
 * 1. Ownership model (system/platform/custom) - determines mutability
 * 2. Sync status tracking - detects drift between metadata and physical schema
 * 3. Locking mechanism - prevents modification of protected schemas
 * 4. Checksum tracking - for drift detection
 * 
 * @see https://hubblewave.dev/docs/architecture/schema-governance
 */
export class SchemaGovernanceEnhancement1787000010000 implements MigrationInterface {
  name = 'SchemaGovernanceEnhancement1787000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // STEP 1: Create ENUM types for governance
    // =========================================================================
    
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE schema_owner AS ENUM ('system', 'platform', 'custom');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE sync_status AS ENUM ('synced', 'pending', 'error', 'orphaned');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // =========================================================================
    // STEP 2: Enhance collection_definitions table
    // =========================================================================
    
    // Add ownership column - determines who can modify this collection
    await queryRunner.query(`
      ALTER TABLE collection_definitions
      ADD COLUMN IF NOT EXISTS owner schema_owner NOT NULL DEFAULT 'custom'
    `);

    // Add sync status tracking
    await queryRunner.query(`
      ALTER TABLE collection_definitions 
      ADD COLUMN IF NOT EXISTS sync_status sync_status NOT NULL DEFAULT 'synced'
    `);

    await queryRunner.query(`
      ALTER TABLE collection_definitions 
      ADD COLUMN IF NOT EXISTS sync_error TEXT
    `);

    await queryRunner.query(`
      ALTER TABLE collection_definitions 
      ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ
    `);

    // Physical schema checksum for drift detection
    await queryRunner.query(`
      ALTER TABLE collection_definitions 
      ADD COLUMN IF NOT EXISTS physical_checksum VARCHAR(64)
    `);

    // Lock mechanism - prevents any modification including via API
    await queryRunner.query(`
      ALTER TABLE collection_definitions 
      ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false
    `);

    // Platform version tracking - for upgrade compatibility
    await queryRunner.query(`
      ALTER TABLE collection_definitions 
      ADD COLUMN IF NOT EXISTS platform_version VARCHAR(20)
    `);

    // Add indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_collection_owner 
      ON collection_definitions(owner)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_collection_sync_status 
      ON collection_definitions(sync_status)
    `);

    // Add comments for documentation
    await queryRunner.query(`
      COMMENT ON COLUMN collection_definitions.owner IS 
        'Ownership determines mutability: system=immutable, platform=extensible by tenant, custom=full tenant control'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN collection_definitions.sync_status IS 
        'Synchronization status between metadata and physical PostgreSQL schema'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN collection_definitions.physical_checksum IS 
        'SHA-256 hash of physical table structure for drift detection'
    `);

    // =========================================================================
    // STEP 3: Enhance property_definitions table
    // =========================================================================
    
    await queryRunner.query(`
      ALTER TABLE property_definitions 
      ADD COLUMN IF NOT EXISTS owner schema_owner NOT NULL DEFAULT 'custom'
    `);

    await queryRunner.query(`
      ALTER TABLE property_definitions 
      ADD COLUMN IF NOT EXISTS sync_status sync_status NOT NULL DEFAULT 'synced'
    `);

    await queryRunner.query(`
      ALTER TABLE property_definitions 
      ADD COLUMN IF NOT EXISTS sync_error TEXT
    `);

    await queryRunner.query(`
      ALTER TABLE property_definitions 
      ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE property_definitions 
      ADD COLUMN IF NOT EXISTS platform_version VARCHAR(20)
    `);

    // Custom property prefix enforcement tracking
    await queryRunner.query(`
      ALTER TABLE property_definitions 
      ADD COLUMN IF NOT EXISTS custom_property_prefix VARCHAR(10) DEFAULT 'x_'
    `);

    // Add indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_property_owner 
      ON property_definitions(owner)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_property_sync_status 
      ON property_definitions(sync_status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_property_collection_owner 
      ON property_definitions(collection_id, owner)
    `);

    // Add comments
    await queryRunner.query(`
      COMMENT ON COLUMN property_definitions.owner IS 
        'Ownership determines mutability. Custom properties on platform collections must use x_ prefix.'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN property_definitions.custom_property_prefix IS 
        'Required prefix for custom properties added to platform collections (default: x_)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS idx_property_collection_owner`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_property_sync_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_property_owner`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_sync_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_owner`);

    // Remove columns from property_definitions
    await queryRunner.query(`ALTER TABLE property_definitions DROP COLUMN IF EXISTS custom_property_prefix`);
    await queryRunner.query(`ALTER TABLE property_definitions DROP COLUMN IF EXISTS platform_version`);
    await queryRunner.query(`ALTER TABLE property_definitions DROP COLUMN IF EXISTS is_locked`);
    await queryRunner.query(`ALTER TABLE property_definitions DROP COLUMN IF EXISTS sync_error`);
    await queryRunner.query(`ALTER TABLE property_definitions DROP COLUMN IF EXISTS sync_status`);
    await queryRunner.query(`ALTER TABLE property_definitions DROP COLUMN IF EXISTS owner`);

    // Remove columns from collection_definitions
    await queryRunner.query(`ALTER TABLE collection_definitions DROP COLUMN IF EXISTS platform_version`);
    await queryRunner.query(`ALTER TABLE collection_definitions DROP COLUMN IF EXISTS is_locked`);
    await queryRunner.query(`ALTER TABLE collection_definitions DROP COLUMN IF EXISTS physical_checksum`);
    await queryRunner.query(`ALTER TABLE collection_definitions DROP COLUMN IF EXISTS last_synced_at`);
    await queryRunner.query(`ALTER TABLE collection_definitions DROP COLUMN IF EXISTS sync_error`);
    await queryRunner.query(`ALTER TABLE collection_definitions DROP COLUMN IF EXISTS sync_status`);
    await queryRunner.query(`ALTER TABLE collection_definitions DROP COLUMN IF EXISTS owner`);

    // Drop enum types (only if no other tables use them)
    await queryRunner.query(`DROP TYPE IF EXISTS sync_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS schema_owner`);
  }
}
