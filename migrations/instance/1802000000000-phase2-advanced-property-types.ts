import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 - Advanced Property Types Migration
 *
 * Adds new property types for Phase 2:
 * - formula: Calculated properties using formula expressions
 * - rollup: Aggregate values from related records
 * - lookup: Fetch values from related records
 * - hierarchical: Self-referential tree structures
 * - geolocation: Geographic coordinates with mapping support
 * - duration: Time duration values
 *
 * Also creates supporting tables:
 * - formula_cache: Stores computed formula results
 * - property_dependencies: Tracks property calculation order
 * - view_configurations: Stores view settings for each collection
 */
export class Phase2AdvancedPropertyTypes1802000000000 implements MigrationInterface {
  name = 'Phase2AdvancedPropertyTypes1802000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // STEP 1: Add new property types
    // =========================================================================

    await queryRunner.query(`
      INSERT INTO property_types (id, code, name, category, base_type, default_config, validation_rules, default_widget, icon, is_system)
      VALUES
        (gen_random_uuid(), 'formula', 'Formula', 'computed', 'text',
         '{"returnType":"string","cacheStrategy":"on_save"}'::jsonb,
         '{"type":"object","properties":{"formula":{"type":"string"},"returnType":{"type":"string","enum":["string","number","boolean","date","datetime"]},"cacheStrategy":{"type":"string","enum":["never","on_save","periodic","real_time"]},"cacheInterval":{"type":"number"},"errorHandling":{"type":"string","enum":["block","warn","ignore"]},"fallbackValue":{}}}'::jsonb,
         'formula', 'function-square', true),

        (gen_random_uuid(), 'rollup', 'Rollup', 'computed', 'text',
         '{"aggregation":"SUM","cacheStrategy":"on_save"}'::jsonb,
         '{"type":"object","properties":{"sourceCollection":{"type":"string"},"referenceProperty":{"type":"string"},"sourceProperty":{"type":"string"},"aggregation":{"type":"string","enum":["SUM","AVG","COUNT","COUNTA","COUNTALL","MIN","MAX","FIRST","LAST","CONCAT","CONCAT_UNIQUE"]},"filter":{"type":"string"},"cacheStrategy":{"type":"string","enum":["never","on_save","periodic"]}}}'::jsonb,
         'rollup', 'sigma', true),

        (gen_random_uuid(), 'lookup', 'Lookup', 'computed', 'text',
         '{"cache":true}'::jsonb,
         '{"type":"object","properties":{"sourceCollection":{"type":"string"},"referenceProperty":{"type":"string"},"sourceProperty":{"type":"string"},"cache":{"type":"boolean"}}}'::jsonb,
         'lookup', 'search', true),

        (gen_random_uuid(), 'hierarchical', 'Hierarchical', 'reference', 'uuid',
         '{"maxDepth":10,"displayMode":"tree"}'::jsonb,
         '{"type":"object","properties":{"parentProperty":{"type":"string"},"maxDepth":{"type":"number"},"displayMode":{"type":"string","enum":["tree","path","breadcrumb","flat"]},"pathSeparator":{"type":"string"}}}'::jsonb,
         'hierarchical', 'git-branch', true),

        (gen_random_uuid(), 'geolocation', 'Geolocation', 'complex', 'jsonb',
         '{"precision":6,"displayFormat":"decimal"}'::jsonb,
         '{"type":"object","properties":{"precision":{"type":"number"},"displayFormat":{"type":"string","enum":["decimal","dms","utm"]},"enableGeocoding":{"type":"boolean"}}}'::jsonb,
         'map', 'map-pin', true),

        (gen_random_uuid(), 'duration', 'Duration', 'temporal', 'interval',
         '{"units":"minutes","displayFormat":"short"}'::jsonb,
         '{"type":"object","properties":{"units":{"type":"string","enum":["seconds","minutes","hours","days","weeks"]},"displayFormat":{"type":"string","enum":["short","long","iso8601"]}}}'::jsonb,
         'duration', 'timer', true)
      ON CONFLICT (code) DO NOTHING
    `);

    // =========================================================================
    // STEP 2: Create formula_cache table
    // =========================================================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS formula_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Identity
        collection_id UUID NOT NULL,
        property_id UUID NOT NULL,
        record_id UUID NOT NULL,

        -- Cached value
        cached_value JSONB,
        value_type VARCHAR(20) NOT NULL,

        -- Calculation metadata
        formula_hash VARCHAR(64) NOT NULL,
        dependencies JSONB DEFAULT '[]'::jsonb,

        -- Cache management
        calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        is_stale BOOLEAN DEFAULT false,
        stale_reason VARCHAR(100),

        -- Performance tracking
        calculation_time_ms INTEGER,

        -- Audit
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT fk_formula_cache_collection FOREIGN KEY (collection_id)
          REFERENCES collection_definitions(id) ON DELETE CASCADE,
        CONSTRAINT fk_formula_cache_property FOREIGN KEY (property_id)
          REFERENCES property_definitions(id) ON DELETE CASCADE,
        CONSTRAINT chk_value_type CHECK (value_type IN ('string', 'number', 'boolean', 'date', 'datetime', 'null', 'array', 'object'))
      )
    `);

    // Unique constraint for one cache entry per record/property
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_formula_cache_unique
      ON formula_cache(collection_id, property_id, record_id)
    `);

    // Index for cache invalidation queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_formula_cache_stale
      ON formula_cache(is_stale) WHERE is_stale = true
    `);

    // Index for expiration cleanup
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_formula_cache_expires
      ON formula_cache(expires_at) WHERE expires_at IS NOT NULL
    `);

    // Index for dependency-based invalidation
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_formula_cache_dependencies
      ON formula_cache USING gin(dependencies)
    `);

    await queryRunner.query(`
      COMMENT ON TABLE formula_cache IS
        'Caches computed formula values for performance. Invalidated when dependencies change.'
    `);

    // =========================================================================
    // STEP 3: Create property_dependencies table
    // =========================================================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS property_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Source property (the computed property)
        property_id UUID NOT NULL,
        collection_id UUID NOT NULL,

        -- Dependency information
        depends_on_property_id UUID,
        depends_on_collection_id UUID,
        dependency_type VARCHAR(20) NOT NULL,

        -- Dependency path for nested references
        dependency_path TEXT[],

        -- Calculation order (for topological sort)
        update_order INTEGER DEFAULT 0,

        -- Audit
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT fk_property_dependencies_property FOREIGN KEY (property_id)
          REFERENCES property_definitions(id) ON DELETE CASCADE,
        CONSTRAINT fk_property_dependencies_collection FOREIGN KEY (collection_id)
          REFERENCES collection_definitions(id) ON DELETE CASCADE,
        CONSTRAINT chk_dependency_type CHECK (dependency_type IN ('formula', 'rollup', 'lookup', 'hierarchical', 'direct'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_property_dependencies_property
      ON property_dependencies(property_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_property_dependencies_depends_on
      ON property_dependencies(depends_on_property_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_property_dependencies_collection
      ON property_dependencies(collection_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_property_dependencies_order
      ON property_dependencies(collection_id, update_order)
    `);

    await queryRunner.query(`
      COMMENT ON TABLE property_dependencies IS
        'Tracks dependencies between computed properties for proper calculation ordering and cache invalidation.'
    `);

    // =========================================================================
    // STEP 4: Create view_configurations table
    // =========================================================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS view_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Identity
        collection_id UUID NOT NULL,
        code VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,

        -- View type
        view_type VARCHAR(30) NOT NULL,

        -- Configuration
        config JSONB NOT NULL DEFAULT '{}'::jsonb,

        -- Display settings
        columns JSONB DEFAULT '[]'::jsonb,
        filters JSONB DEFAULT '[]'::jsonb,
        sorts JSONB DEFAULT '[]'::jsonb,
        grouping JSONB,

        -- View-specific settings
        calendar_config JSONB,
        kanban_config JSONB,
        timeline_config JSONB,
        map_config JSONB,
        gantt_config JSONB,
        pivot_config JSONB,
        gallery_config JSONB,

        -- Access control
        owner_type VARCHAR(20) NOT NULL DEFAULT 'user',
        owner_id UUID,
        is_default BOOLEAN DEFAULT false,
        is_shared BOOLEAN DEFAULT false,
        shared_with JSONB DEFAULT '[]'::jsonb,

        -- Ordering
        display_order INTEGER DEFAULT 0,

        -- Audit
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,

        -- Constraints
        CONSTRAINT fk_view_config_collection FOREIGN KEY (collection_id)
          REFERENCES collection_definitions(id) ON DELETE CASCADE,
        CONSTRAINT chk_view_type CHECK (view_type IN ('list', 'card', 'calendar', 'kanban', 'timeline', 'map', 'gantt', 'pivot', 'gallery')),
        CONSTRAINT chk_owner_type CHECK (owner_type IN ('system', 'tenant', 'role', 'group', 'user'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_view_config_unique
      ON view_configurations(collection_id, code)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_view_config_collection
      ON view_configurations(collection_id, display_order)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_view_config_owner
      ON view_configurations(owner_type, owner_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_view_config_type
      ON view_configurations(collection_id, view_type)
    `);

    await queryRunner.query(`
      COMMENT ON TABLE view_configurations IS
        'Stores view configurations for collections including list, calendar, kanban, timeline, map, gantt, and pivot views.'
    `);

    // =========================================================================
    // STEP 5: Create triggers for updated_at
    // =========================================================================

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_formula_cache_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_formula_cache_updated_at
      BEFORE UPDATE ON formula_cache
      FOR EACH ROW
      EXECUTE FUNCTION update_formula_cache_updated_at()
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_view_config_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_view_config_updated_at
      BEFORE UPDATE ON view_configurations
      FOR EACH ROW
      EXECUTE FUNCTION update_view_config_updated_at()
    `);

    // =========================================================================
    // STEP 6: Create function for formula cache invalidation
    // =========================================================================

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION invalidate_formula_cache(
        p_collection_id UUID,
        p_record_id UUID DEFAULT NULL,
        p_property_id UUID DEFAULT NULL,
        p_reason VARCHAR(100) DEFAULT 'dependency_changed'
      )
      RETURNS INTEGER AS $$
      DECLARE
        v_count INTEGER;
      BEGIN
        UPDATE formula_cache
        SET
          is_stale = true,
          stale_reason = p_reason
        WHERE
          collection_id = p_collection_id
          AND (p_record_id IS NULL OR record_id = p_record_id)
          AND (p_property_id IS NULL OR property_id = p_property_id)
          AND is_stale = false;

        GET DIAGNOSTICS v_count = ROW_COUNT;
        RETURN v_count;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      COMMENT ON FUNCTION invalidate_formula_cache IS
        'Marks formula cache entries as stale. Used when source data changes.'
    `);

    // =========================================================================
    // STEP 7: Create helper view for computed property overview
    // =========================================================================

    await queryRunner.query(`
      CREATE OR REPLACE VIEW computed_properties_overview AS
      SELECT
        cd.code as collection_code,
        cd.name as collection_name,
        pd.code as property_code,
        pd.name as property_name,
        pt.code as property_type,
        pd.config as type_config,
        (SELECT COUNT(*) FROM property_dependencies dep WHERE dep.property_id = pd.id) as dependency_count,
        (SELECT COUNT(*) FROM formula_cache fc WHERE fc.property_id = pd.id AND fc.is_stale = false) as cached_count,
        (SELECT COUNT(*) FROM formula_cache fc WHERE fc.property_id = pd.id AND fc.is_stale = true) as stale_count
      FROM property_definitions pd
      JOIN collection_definitions cd ON pd.collection_id = cd.id
      JOIN property_types pt ON pd.property_type_id = pt.id
      WHERE pt.code IN ('formula', 'rollup', 'lookup')
      ORDER BY cd.code, pd.position
    `);

    await queryRunner.query(`
      COMMENT ON VIEW computed_properties_overview IS
        'Overview of all computed properties with dependency and cache statistics.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop views
    await queryRunner.query(`DROP VIEW IF EXISTS computed_properties_overview`);

    // Drop functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS invalidate_formula_cache`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_view_config_updated_at CASCADE`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_formula_cache_updated_at CASCADE`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS view_configurations`);
    await queryRunner.query(`DROP TABLE IF EXISTS property_dependencies`);
    await queryRunner.query(`DROP TABLE IF EXISTS formula_cache`);

    // Remove new property types
    await queryRunner.query(`
      DELETE FROM property_types
      WHERE code IN ('formula', 'rollup', 'lookup', 'hierarchical', 'geolocation', 'duration')
    `);
  }
}
