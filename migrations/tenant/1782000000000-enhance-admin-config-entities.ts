import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enhances existing admin configuration tables to support the full Admin Configuration Console features:
 * - Upgrade manifest with detailed change tracking
 * - Tenant upgrade impact analysis with conflict resolution
 * - Business rules with declarative conditions and scripting
 * - User layout preferences for the three-tier customization model
 * - Field protection rules for field-level security
 */
export class EnhanceAdminConfigEntities1782000000000 implements MigrationInterface {
  name = 'EnhanceAdminConfigEntities1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Enhance upgrade_manifest ==========
    await queryRunner.query(`
      ALTER TABLE upgrade_manifest
      ADD COLUMN IF NOT EXISTS upgrade_type varchar(20),
      ADD COLUMN IF NOT EXISTS config_changes jsonb DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS migrations jsonb DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS pre_checks jsonb DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS post_checks jsonb DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS is_mandatory boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS min_downtime_minutes int DEFAULT 0,
      ADD COLUMN IF NOT EXISTS checksum varchar(64);
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_manifest_release ON upgrade_manifest(release_date);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_manifest_type ON upgrade_manifest(upgrade_type);`);

    // ========== Enhance tenant_upgrade_impact ==========
    await queryRunner.query(`
      ALTER TABLE tenant_upgrade_impact
      ADD COLUMN IF NOT EXISTS customization_id uuid,
      ADD COLUMN IF NOT EXISTS config_type varchar(50),
      ADD COLUMN IF NOT EXISTS resource_key varchar(255),
      ADD COLUMN IF NOT EXISTS impact_type varchar(30),
      ADD COLUMN IF NOT EXISTS impact_severity varchar(20),
      ADD COLUMN IF NOT EXISTS description text,
      ADD COLUMN IF NOT EXISTS current_tenant_value jsonb,
      ADD COLUMN IF NOT EXISTS current_platform_value jsonb,
      ADD COLUMN IF NOT EXISTS new_platform_value jsonb,
      ADD COLUMN IF NOT EXISTS platform_diff jsonb,
      ADD COLUMN IF NOT EXISTS suggested_resolution varchar(30),
      ADD COLUMN IF NOT EXISTS preview_merged_value jsonb,
      ADD COLUMN IF NOT EXISTS status varchar(30) DEFAULT 'pending_analysis',
      ADD COLUMN IF NOT EXISTS resolution_choice varchar(30),
      ADD COLUMN IF NOT EXISTS custom_resolution_value jsonb,
      ADD COLUMN IF NOT EXISTS auto_resolved boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_impact_severity ON tenant_upgrade_impact(impact_severity);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_impact_config ON tenant_upgrade_impact(config_type, resource_key);`);

    // ========== Enhance business_rule ==========
    await queryRunner.query(`
      ALTER TABLE business_rule
      ADD COLUMN IF NOT EXISTS trigger varchar(30),
      ADD COLUMN IF NOT EXISTS condition_type varchar(30) DEFAULT 'always',
      ADD COLUMN IF NOT EXISTS watch_fields jsonb,
      ADD COLUMN IF NOT EXISTS condition_script text,
      ADD COLUMN IF NOT EXISTS action_type varchar(30),
      ADD COLUMN IF NOT EXISTS action_script text,
      ADD COLUMN IF NOT EXISTS script_context jsonb,
      ADD COLUMN IF NOT EXISTS on_error varchar(30) DEFAULT 'abort',
      ADD COLUMN IF NOT EXISTS error_message text,
      ADD COLUMN IF NOT EXISTS platform_version varchar(20),
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_business_rule_trigger ON business_rule(target_table, trigger, is_active);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_business_rule_order ON business_rule(execution_order);`);

    // ========== Enhance user_layout_preference ==========
    await queryRunner.query(`
      ALTER TABLE user_layout_preference
      ADD COLUMN IF NOT EXISTS tenant_id uuid,
      ADD COLUMN IF NOT EXISTS layout_type varchar(30),
      ADD COLUMN IF NOT EXISTS resource_key varchar(255),
      ADD COLUMN IF NOT EXISTS column_config jsonb,
      ADD COLUMN IF NOT EXISTS saved_filters jsonb,
      ADD COLUMN IF NOT EXISTS default_filter_id varchar(100),
      ADD COLUMN IF NOT EXISTS sort_config jsonb,
      ADD COLUMN IF NOT EXISTS form_sections jsonb,
      ADD COLUMN IF NOT EXISTS dashboard_layout jsonb,
      ADD COLUMN IF NOT EXISTS kanban_config jsonb,
      ADD COLUMN IF NOT EXISTS calendar_config jsonb,
      ADD COLUMN IF NOT EXISTS page_size int,
      ADD COLUMN IF NOT EXISTS density varchar(20),
      ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz;
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_layout_tenant ON user_layout_preference(tenant_id, user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_layout_resource ON user_layout_preference(resource_key, layout_type);`);

    // ========== Enhance field_protection_rule ==========
    await queryRunner.query(`
      ALTER TABLE field_protection_rule
      ADD COLUMN IF NOT EXISTS code varchar(100),
      ADD COLUMN IF NOT EXISTS name varchar(255),
      ADD COLUMN IF NOT EXISTS description text,
      ADD COLUMN IF NOT EXISTS target_table varchar(100),
      ADD COLUMN IF NOT EXISTS target_field varchar(100),
      ADD COLUMN IF NOT EXISTS protection_type varchar(30),
      ADD COLUMN IF NOT EXISTS protection_scope varchar(30) DEFAULT 'all',
      ADD COLUMN IF NOT EXISTS applies_to_roles jsonb,
      ADD COLUMN IF NOT EXISTS except_roles jsonb,
      ADD COLUMN IF NOT EXISTS applies_to_groups jsonb,
      ADD COLUMN IF NOT EXISTS condition_expression jsonb,
      ADD COLUMN IF NOT EXISTS condition_script text,
      ADD COLUMN IF NOT EXISTS mask_pattern varchar(100),
      ADD COLUMN IF NOT EXISTS mask_character char(1),
      ADD COLUMN IF NOT EXISTS visible_chars_start int,
      ADD COLUMN IF NOT EXISTS visible_chars_end int,
      ADD COLUMN IF NOT EXISTS encryption_key_id varchar(100),
      ADD COLUMN IF NOT EXISTS decrypt_roles jsonb,
      ADD COLUMN IF NOT EXISTS editable_conditions jsonb,
      ADD COLUMN IF NOT EXISTS audit_access boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS audit_changes boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS ui_message text,
      ADD COLUMN IF NOT EXISTS ui_icon varchar(50),
      ADD COLUMN IF NOT EXISTS execution_order int DEFAULT 100,
      ADD COLUMN IF NOT EXISTS source varchar(20) DEFAULT 'tenant',
      ADD COLUMN IF NOT EXISTS platform_version varchar(20),
      ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS created_by uuid,
      ADD COLUMN IF NOT EXISTS updated_by uuid;
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_field_protection_tenant ON field_protection_rule(tenant_id, code);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_field_protection_type ON field_protection_rule(protection_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_field_protection_target ON field_protection_rule(target_table, target_field, is_active);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_field_protection_target;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_field_protection_type;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_field_protection_tenant;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_layout_resource;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_layout_tenant;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_business_rule_order;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_business_rule_trigger;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_upgrade_impact_config;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_upgrade_impact_severity;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_upgrade_manifest_type;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_upgrade_manifest_release;`);

    // Note: We don't drop columns in down migration to avoid data loss
    // The original columns from the base migration will remain functional
  }
}
