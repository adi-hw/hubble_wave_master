import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollectionSchema1787000000000 implements MigrationInterface {
  name = 'CollectionSchema1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create collection_definitions table (Collections = ServiceNow Tables)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS collection_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(200) NOT NULL,
        label_plural VARCHAR(200),
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(20),
        storage_table VARCHAR(100) NOT NULL,
        is_system BOOLEAN DEFAULT false,
        is_extensible BOOLEAN DEFAULT true,
        is_audited BOOLEAN DEFAULT true,
        is_versioned BOOLEAN DEFAULT false,
        extends_collection_id UUID REFERENCES collection_definitions(id),
        module_id UUID,
        display_property_id UUID,
        identifier_property_id UUID,
        category VARCHAR(100),
        tags JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        sort_order INT DEFAULT 0,
        version INT DEFAULT 1,
        published_at TIMESTAMPTZ,
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes for collection_definitions
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_def_code ON collection_definitions(code)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_def_module ON collection_definitions(module_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_def_extends ON collection_definitions(extends_collection_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_def_category ON collection_definitions(category)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_def_system ON collection_definitions(is_system)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_def_active ON collection_definitions(id) WHERE deleted_at IS NULL`);

    // Create property_definitions table (Properties = ServiceNow Fields)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS property_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id UUID NOT NULL REFERENCES collection_definitions(id) ON DELETE CASCADE,
        code VARCHAR(100) NOT NULL,
        label VARCHAR(200) NOT NULL,
        description TEXT,
        property_type VARCHAR(50) NOT NULL,
        storage_column VARCHAR(100) NOT NULL,
        is_system BOOLEAN DEFAULT false,
        is_required BOOLEAN DEFAULT false,
        is_unique BOOLEAN DEFAULT false,
        is_indexed BOOLEAN DEFAULT false,
        is_searchable BOOLEAN DEFAULT true,
        is_filterable BOOLEAN DEFAULT true,
        is_sortable BOOLEAN DEFAULT true,
        is_readonly BOOLEAN DEFAULT false,
        is_computed BOOLEAN DEFAULT false,
        is_encrypted BOOLEAN DEFAULT false,
        is_internal BOOLEAN DEFAULT false,
        max_length INT,
        min_value DECIMAL,
        max_value DECIMAL,
        precision_value INT,
        scale_value INT,
        default_value JSONB,
        computed_formula TEXT,
        validation_regex VARCHAR(500),
        validation_message VARCHAR(500),
        hint_text VARCHAR(500),
        placeholder VARCHAR(200),
        reference_collection_id UUID REFERENCES collection_definitions(id),
        reference_display_property VARCHAR(100),
        reference_filter JSONB,
        choice_list JSONB,
        choice_type VARCHAR(20),
        choice_dependent_on UUID REFERENCES property_definitions(id),
        sort_order INT DEFAULT 0,
        group_name VARCHAR(100),
        ui_width VARCHAR(20) DEFAULT 'full',
        ui_component VARCHAR(50),
        ui_options JSONB DEFAULT '{}',
        version INT DEFAULT 1,
        deprecated_at TIMESTAMPTZ,
        deprecation_message TEXT,
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_property_per_collection UNIQUE (collection_id, code)
      )
    `);

    // Indexes for property_definitions
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_property_def_collection ON property_definitions(collection_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_property_def_code ON property_definitions(collection_id, code)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_property_def_type ON property_definitions(property_type)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_property_def_ref ON property_definitions(reference_collection_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_property_def_system ON property_definitions(is_system)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_property_def_active ON property_definitions(id) WHERE deleted_at IS NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_property_def_group ON property_definitions(collection_id, group_name)`);

    // Create property_types table (defines available property types)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS property_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) NOT NULL UNIQUE,
        label VARCHAR(100) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        category VARCHAR(50) NOT NULL,
        storage_type VARCHAR(30) NOT NULL,
        ui_component VARCHAR(50) NOT NULL,
        supports_default BOOLEAN DEFAULT true,
        supports_validation BOOLEAN DEFAULT true,
        supports_choices BOOLEAN DEFAULT false,
        supports_reference BOOLEAN DEFAULT false,
        supports_computed BOOLEAN DEFAULT false,
        supports_encryption BOOLEAN DEFAULT false,
        config_schema JSONB DEFAULT '{}',
        sort_order INT DEFAULT 0,
        is_system BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Seed default property types
    await queryRunner.query(`
      INSERT INTO property_types (code, label, description, icon, category, storage_type, ui_component, supports_choices, supports_reference, supports_computed, supports_encryption, sort_order)
      VALUES
        -- Text types
        ('string', 'Single Line Text', 'Short text input', 'Type', 'text', 'varchar', 'TextInput', false, false, true, true, 1),
        ('text', 'Multi-Line Text', 'Long text with multiple lines', 'AlignLeft', 'text', 'text', 'TextArea', false, false, true, true, 2),
        ('rich_text', 'Rich Text', 'Formatted HTML content', 'FileText', 'text', 'text', 'RichTextEditor', false, false, false, false, 3),
        ('email', 'Email', 'Email address', 'Mail', 'text', 'varchar', 'EmailInput', false, false, false, false, 4),
        ('url', 'URL', 'Web address', 'Link', 'text', 'varchar', 'UrlInput', false, false, false, false, 5),
        ('phone', 'Phone Number', 'Phone number', 'Phone', 'text', 'varchar', 'PhoneInput', false, false, false, false, 6),

        -- Number types
        ('integer', 'Integer', 'Whole number', 'Hash', 'number', 'integer', 'NumberInput', false, false, true, false, 10),
        ('decimal', 'Decimal', 'Number with decimals', 'Percent', 'number', 'decimal', 'DecimalInput', false, false, true, false, 11),
        ('currency', 'Currency', 'Monetary value', 'DollarSign', 'number', 'decimal', 'CurrencyInput', false, false, true, false, 12),
        ('percent', 'Percentage', 'Percentage value', 'Percent', 'number', 'decimal', 'PercentInput', false, false, true, false, 13),

        -- Date/Time types
        ('date', 'Date', 'Date without time', 'Calendar', 'datetime', 'date', 'DatePicker', false, false, true, false, 20),
        ('datetime', 'Date & Time', 'Date with time', 'Clock', 'datetime', 'timestamptz', 'DateTimePicker', false, false, true, false, 21),
        ('time', 'Time', 'Time only', 'Clock', 'datetime', 'time', 'TimePicker', false, false, true, false, 22),
        ('duration', 'Duration', 'Time duration', 'Timer', 'datetime', 'interval', 'DurationInput', false, false, true, false, 23),

        -- Choice types
        ('choice', 'Single Choice', 'Select one option', 'List', 'choice', 'varchar', 'Select', true, false, false, false, 30),
        ('multi_choice', 'Multiple Choice', 'Select multiple options', 'ListChecks', 'choice', 'jsonb', 'MultiSelect', true, false, false, false, 31),
        ('boolean', 'Yes/No', 'Boolean toggle', 'ToggleLeft', 'choice', 'boolean', 'Toggle', false, false, false, false, 32),

        -- Reference types
        ('reference', 'Reference', 'Link to another collection', 'Link2', 'reference', 'uuid', 'ReferenceSelector', false, true, false, false, 40),
        ('multi_reference', 'Multiple References', 'Links to multiple records', 'Link2', 'reference', 'jsonb', 'MultiReferenceSelector', false, true, false, false, 41),
        ('user', 'User', 'Link to user', 'User', 'reference', 'uuid', 'UserPicker', false, true, false, false, 42),
        ('group', 'Group', 'Link to group', 'Users', 'reference', 'uuid', 'GroupPicker', false, true, false, false, 43),

        -- Special types
        ('attachment', 'Attachment', 'File attachment', 'Paperclip', 'special', 'jsonb', 'FileUpload', false, false, false, false, 50),
        ('image', 'Image', 'Image file', 'Image', 'special', 'jsonb', 'ImageUpload', false, false, false, false, 51),
        ('json', 'JSON', 'Structured JSON data', 'Braces', 'special', 'jsonb', 'JsonEditor', false, false, false, false, 52),
        ('script', 'Script', 'Executable script', 'Code', 'special', 'text', 'CodeEditor', false, false, false, false, 53),
        ('formula', 'Formula', 'Calculated field', 'Function', 'special', 'text', 'FormulaEditor', false, false, true, false, 54),
        ('conditions', 'Conditions', 'Conditional logic', 'GitBranch', 'special', 'jsonb', 'ConditionBuilder', false, false, false, false, 55),
        ('glide_list', 'List', 'Comma-separated values', 'List', 'special', 'text', 'GlideList', false, false, false, false, 56)
      ON CONFLICT (code) DO NOTHING
    `);

    // Create collection_relationships table for explicit relationships
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS collection_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_collection_id UUID NOT NULL REFERENCES collection_definitions(id) ON DELETE CASCADE,
        target_collection_id UUID NOT NULL REFERENCES collection_definitions(id) ON DELETE CASCADE,
        source_property_id UUID NOT NULL REFERENCES property_definitions(id) ON DELETE CASCADE,
        relationship_type VARCHAR(20) NOT NULL,
        cascade_delete BOOLEAN DEFAULT false,
        cascade_update BOOLEAN DEFAULT false,
        inverse_property_id UUID REFERENCES property_definitions(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_relationship UNIQUE (source_collection_id, source_property_id)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coll_rel_source ON collection_relationships(source_collection_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coll_rel_target ON collection_relationships(target_collection_id)`);

    // Create property_dependency table for conditional display
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS property_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dependent_property_id UUID NOT NULL REFERENCES property_definitions(id) ON DELETE CASCADE,
        depends_on_property_id UUID NOT NULL REFERENCES property_definitions(id) ON DELETE CASCADE,
        condition JSONB NOT NULL,
        dependency_type VARCHAR(20) NOT NULL DEFAULT 'visibility',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_dependency UNIQUE (dependent_property_id, depends_on_property_id)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_prop_dep_dependent ON property_dependencies(dependent_property_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_prop_dep_depends_on ON property_dependencies(depends_on_property_id)`);

    // Update display_property_id and identifier_property_id foreign keys
    await queryRunner.query(`
      ALTER TABLE collection_definitions
      ADD CONSTRAINT fk_display_property
      FOREIGN KEY (display_property_id) REFERENCES property_definitions(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE collection_definitions
      ADD CONSTRAINT fk_identifier_property
      FOREIGN KEY (identifier_property_id) REFERENCES property_definitions(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign keys first
    await queryRunner.query(`ALTER TABLE collection_definitions DROP CONSTRAINT IF EXISTS fk_display_property`);
    await queryRunner.query(`ALTER TABLE collection_definitions DROP CONSTRAINT IF EXISTS fk_identifier_property`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS property_dependencies`);
    await queryRunner.query(`DROP TABLE IF EXISTS collection_relationships`);
    await queryRunner.query(`DROP TABLE IF EXISTS property_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS property_definitions`);
    await queryRunner.query(`DROP TABLE IF EXISTS collection_definitions`);
  }
}
