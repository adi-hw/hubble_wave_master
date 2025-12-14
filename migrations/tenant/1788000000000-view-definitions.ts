import { MigrationInterface, QueryRunner } from 'typeorm';

export class ViewDefinitions1788000000000 implements MigrationInterface {
  name = 'ViewDefinitions1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create view_definitions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS view_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id UUID NOT NULL REFERENCES collection_definitions(id) ON DELETE CASCADE,
        code VARCHAR(100) NOT NULL,
        label VARCHAR(200) NOT NULL,
        description TEXT,
        view_type VARCHAR(30) NOT NULL DEFAULT 'list',
        is_default BOOLEAN DEFAULT false,
        is_system BOOLEAN DEFAULT false,
        is_personal BOOLEAN DEFAULT false,
        owner_id UUID,
        role_ids JSONB DEFAULT '[]',
        conditions JSONB DEFAULT '[]',
        sort_config JSONB DEFAULT '[]',
        group_by VARCHAR(100),
        page_size INT DEFAULT 20,
        quick_filters JSONB DEFAULT '[]',
        saved_filters JSONB DEFAULT '[]',
        row_actions JSONB DEFAULT '[]',
        bulk_actions JSONB DEFAULT '[]',
        card_config JSONB,
        board_config JSONB,
        calendar_config JSONB,
        timeline_config JSONB,
        metadata JSONB DEFAULT '{}',
        sort_order INT DEFAULT 0,
        version INT DEFAULT 1,
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_view_code_per_collection UNIQUE (collection_id, code)
      )
    `);

    // Indexes for view_definitions
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_view_def_collection ON view_definitions(collection_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_view_def_type ON view_definitions(view_type)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_view_def_default ON view_definitions(collection_id, is_default) WHERE is_default = true`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_view_def_owner ON view_definitions(owner_id) WHERE is_personal = true`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_view_def_active ON view_definitions(id) WHERE deleted_at IS NULL`);

    // Create view_columns table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS view_columns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        view_id UUID NOT NULL REFERENCES view_definitions(id) ON DELETE CASCADE,
        property_id UUID REFERENCES property_definitions(id) ON DELETE CASCADE,
        property_code VARCHAR(100),
        label VARCHAR(200),
        width INT,
        min_width INT,
        max_width INT,
        is_visible BOOLEAN DEFAULT true,
        is_sortable BOOLEAN DEFAULT true,
        is_filterable BOOLEAN DEFAULT true,
        is_resizable BOOLEAN DEFAULT true,
        is_frozen BOOLEAN DEFAULT false,
        is_pinned_left BOOLEAN DEFAULT false,
        is_pinned_right BOOLEAN DEFAULT false,
        sort_order INT DEFAULT 0,
        alignment VARCHAR(10) DEFAULT 'left',
        formatter VARCHAR(50),
        formatter_options JSONB DEFAULT '{}',
        cell_renderer VARCHAR(50),
        cell_renderer_options JSONB DEFAULT '{}',
        header_tooltip VARCHAR(500),
        aggregate_function VARCHAR(20),
        wrap_text BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_column_per_view UNIQUE (view_id, property_code)
      )
    `);

    // Indexes for view_columns
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_view_col_view ON view_columns(view_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_view_col_property ON view_columns(property_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_view_col_order ON view_columns(view_id, sort_order)`);

    // Create form_layouts table (detail views)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS form_layouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id UUID NOT NULL REFERENCES collection_definitions(id) ON DELETE CASCADE,
        code VARCHAR(100) NOT NULL,
        label VARCHAR(200) NOT NULL,
        description TEXT,
        layout_type VARCHAR(30) NOT NULL DEFAULT 'standard',
        is_default BOOLEAN DEFAULT false,
        is_system BOOLEAN DEFAULT false,
        conditions JSONB DEFAULT '[]',
        role_ids JSONB DEFAULT '[]',
        sections JSONB NOT NULL DEFAULT '[]',
        header_config JSONB DEFAULT '{}',
        footer_config JSONB DEFAULT '{}',
        sidebar_config JSONB DEFAULT '{}',
        actions_config JSONB DEFAULT '{}',
        related_lists JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        sort_order INT DEFAULT 0,
        version INT DEFAULT 1,
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_form_code_per_collection UNIQUE (collection_id, code)
      )
    `);

    // Indexes for form_layouts
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_form_layout_collection ON form_layouts(collection_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_form_layout_default ON form_layouts(collection_id, is_default) WHERE is_default = true`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_form_layout_active ON form_layouts(id) WHERE deleted_at IS NULL`);

    // Create user_view_preferences table (user-specific view customizations)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_view_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        view_id UUID NOT NULL REFERENCES view_definitions(id) ON DELETE CASCADE,
        column_order JSONB DEFAULT '[]',
        column_widths JSONB DEFAULT '{}',
        hidden_columns JSONB DEFAULT '[]',
        filters JSONB DEFAULT '[]',
        sort_config JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_user_view_pref UNIQUE (user_id, view_id)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_view_pref_user ON user_view_preferences(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_view_pref_view ON user_view_preferences(view_id)`);

    // Create saved_filters table (reusable filter presets)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS saved_filters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id UUID NOT NULL REFERENCES collection_definitions(id) ON DELETE CASCADE,
        code VARCHAR(100) NOT NULL,
        label VARCHAR(200) NOT NULL,
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        is_personal BOOLEAN DEFAULT false,
        owner_id UUID,
        role_ids JSONB DEFAULT '[]',
        conditions JSONB NOT NULL DEFAULT '[]',
        icon VARCHAR(50),
        color VARCHAR(20),
        sort_order INT DEFAULT 0,
        usage_count INT DEFAULT 0,
        last_used_at TIMESTAMPTZ,
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_filter_code_per_collection UNIQUE (collection_id, code)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_saved_filter_collection ON saved_filters(collection_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_saved_filter_owner ON saved_filters(owner_id) WHERE is_personal = true`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_saved_filter_active ON saved_filters(id) WHERE deleted_at IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS saved_filters`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_view_preferences`);
    await queryRunner.query(`DROP TABLE IF EXISTS form_layouts`);
    await queryRunner.query(`DROP TABLE IF EXISTS view_columns`);
    await queryRunner.query(`DROP TABLE IF EXISTS view_definitions`);
  }
}
