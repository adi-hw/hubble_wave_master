import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema Audit Tables Migration
 * 
 * Creates the audit and synchronization tracking infrastructure:
 * 
 * 1. schema_change_log - Complete audit trail of all schema changes with
 *    before/after state, DDL statements, and rollback support
 * 
 * 2. schema_sync_state - Singleton table tracking drift detection state
 *    and distributed locking for sync operations
 * 
 * These tables are essential for:
 * - PHI/HIPAA compliance (audit trail)
 * - Debugging schema issues
 * - Rollback capabilities
 * - Multi-instance coordination
 */
export class SchemaAuditTables1787000010001 implements MigrationInterface {
  name = 'SchemaAuditTables1787000010001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // STEP 1: Create schema_change_log table
    // =========================================================================
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS schema_change_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- What changed
        entity_type VARCHAR(20) NOT NULL,
        entity_id UUID NOT NULL,
        entity_code VARCHAR(100) NOT NULL,
        
        -- Change details
        change_type VARCHAR(20) NOT NULL,
        change_source VARCHAR(20) NOT NULL,
        
        -- Before/After state for rollback capability
        before_state JSONB,
        after_state JSONB,
        
        -- Physical DDL executed (if any)
        ddl_statements TEXT[],
        
        -- Actor information
        performed_by UUID,
        performed_by_type VARCHAR(20) NOT NULL,
        
        -- Result tracking
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        
        -- Rollback support
        is_rolled_back BOOLEAN DEFAULT false,
        rolled_back_at TIMESTAMPTZ,
        rolled_back_by UUID,
        rollback_reason TEXT,
        
        -- Timestamps
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        -- Constraints
        CONSTRAINT chk_entity_type CHECK (entity_type IN ('collection', 'property')),
        CONSTRAINT chk_change_type CHECK (change_type IN ('create', 'update', 'delete', 'sync', 'rollback')),
        CONSTRAINT chk_change_source CHECK (change_source IN ('api', 'migration', 'sync', 'manual', 'system')),
        CONSTRAINT chk_performed_by_type CHECK (performed_by_type IN ('user', 'system', 'migration'))
      )
    `);

    // Indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_change_entity 
      ON schema_change_log(entity_type, entity_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_change_entity_code 
      ON schema_change_log(entity_type, entity_code)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_change_created 
      ON schema_change_log(created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_change_performer 
      ON schema_change_log(performed_by, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_change_type 
      ON schema_change_log(change_type, created_at DESC)
    `);

    // Partial index for failed changes (usually more interesting)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_change_failed 
      ON schema_change_log(created_at DESC) 
      WHERE success = false
    `);

    // Partial index for rollback candidates
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_change_rollback_candidates 
      ON schema_change_log(created_at DESC) 
      WHERE success = true AND is_rolled_back = false
    `);

    // Add comments
    await queryRunner.query(`
      COMMENT ON TABLE schema_change_log IS 
        'Complete audit trail of all schema modifications for compliance and rollback support'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN schema_change_log.before_state IS 
        'JSON snapshot of entity state before change, enables rollback'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN schema_change_log.ddl_statements IS 
        'Array of SQL DDL statements executed during this change'
    `);

    // =========================================================================
    // STEP 2: Create schema_sync_state table (singleton)
    // =========================================================================
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS schema_sync_state (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Distributed lock management
        sync_lock_holder VARCHAR(100),
        sync_lock_acquired_at TIMESTAMPTZ,
        sync_lock_expires_at TIMESTAMPTZ,
        
        -- Last sync run information
        last_full_sync_at TIMESTAMPTZ,
        last_full_sync_duration_ms INTEGER,
        last_full_sync_result VARCHAR(20),
        
        -- Drift detection results
        last_drift_check_at TIMESTAMPTZ,
        drift_detected BOOLEAN DEFAULT false,
        drift_details JSONB,
        
        -- Statistics
        total_collections INTEGER DEFAULT 0,
        total_properties INTEGER DEFAULT 0,
        orphaned_tables INTEGER DEFAULT 0,
        orphaned_columns INTEGER DEFAULT 0,
        
        -- Metadata
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        
        -- Constraints
        CONSTRAINT chk_sync_result CHECK (
          last_full_sync_result IS NULL OR 
          last_full_sync_result IN ('success', 'issues_found', 'error', 'timeout')
        )
      )
    `);

    // Ensure only one row exists (singleton pattern)
    await queryRunner.query(`
      INSERT INTO schema_sync_state (id) 
      VALUES (gen_random_uuid())
      ON CONFLICT DO NOTHING
    `);

    // Create index for lock acquisition queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_sync_lock
      ON schema_sync_state(sync_lock_expires_at)
    `);

    // Add comments
    await queryRunner.query(`
      COMMENT ON TABLE schema_sync_state IS
        'Singleton table tracking schema synchronization state and distributed locking'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN schema_sync_state.sync_lock_holder IS 
        'Instance ID of the service currently running sync (for distributed coordination)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN schema_sync_state.drift_details IS 
        'JSON array of detected drift issues from last check'
    `);

    // =========================================================================
    // STEP 3: Create helper function for automatic updated_at
    // =========================================================================
    
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_schema_sync_state_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_schema_sync_state_updated_at ON schema_sync_state
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_schema_sync_state_updated_at
      BEFORE UPDATE ON schema_sync_state
      FOR EACH ROW
      EXECUTE FUNCTION update_schema_sync_state_updated_at()
    `);

    // =========================================================================
    // STEP 4: Create view for recent schema changes (useful for debugging)
    // =========================================================================
    
    await queryRunner.query(`
      CREATE OR REPLACE VIEW recent_schema_changes AS
      SELECT 
        scl.id,
        scl.entity_type,
        scl.entity_code,
        scl.change_type,
        scl.change_source,
        scl.performed_by_type,
        scl.success,
        scl.error_message,
        scl.is_rolled_back,
        scl.created_at,
        CASE
          WHEN scl.entity_type = 'collection' THEN cd.name
          WHEN scl.entity_type = 'property' THEN pd.name
        END as entity_label,
        CASE 
          WHEN scl.entity_type = 'property' THEN cd2.code
        END as parent_collection_code
      FROM schema_change_log scl
      LEFT JOIN collection_definitions cd 
        ON scl.entity_type = 'collection' AND scl.entity_id = cd.id
      LEFT JOIN property_definitions pd 
        ON scl.entity_type = 'property' AND scl.entity_id = pd.id
      LEFT JOIN collection_definitions cd2 
        ON pd.collection_id = cd2.id
      ORDER BY scl.created_at DESC
      LIMIT 100
    `);

    await queryRunner.query(`
      COMMENT ON VIEW recent_schema_changes IS 
        'Convenience view showing recent schema modifications with entity names'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop view first
    await queryRunner.query(`DROP VIEW IF EXISTS recent_schema_changes`);

    // Drop trigger and function
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_schema_sync_state_updated_at ON schema_sync_state`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_schema_sync_state_updated_at`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_sync_lock`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_change_rollback_candidates`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_change_failed`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_change_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_change_performer`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_change_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_change_entity_code`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schema_change_entity`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS schema_sync_state`);
    await queryRunner.query(`DROP TABLE IF EXISTS schema_change_log`);
  }
}
