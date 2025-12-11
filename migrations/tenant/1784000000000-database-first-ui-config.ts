import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Database-First UI Configuration
 *
 * This migration creates lightweight overlay tables for UI metadata.
 * Instead of duplicating table/field definitions, we now:
 * 1. Discover tables directly from PostgreSQL's information_schema
 * 2. Store only UI-specific configuration (labels, visibility, display order) in overlay tables
 *
 * Tables created:
 * - table_ui_config: UI metadata for tables (label, description, icon, category, visibility)
 * - field_ui_config: UI metadata for fields (label, display order, show in forms/lists, etc.)
 */
export class DatabaseFirstUiConfig1784000000000 implements MigrationInterface {
  name = 'DatabaseFirstUiConfig1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Table UI Configuration - lightweight overlay for table display settings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS table_ui_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name varchar(100) NOT NULL UNIQUE,

        -- Display metadata
        label varchar(255),
        plural_label varchar(255),
        description text,
        icon varchar(50),
        color varchar(20),

        -- Classification
        category varchar(50) DEFAULT 'application',

        -- Visibility controls
        is_hidden boolean DEFAULT false,
        is_system boolean DEFAULT false,
        show_in_nav boolean DEFAULT true,
        show_in_search boolean DEFAULT true,

        -- Default behaviors
        default_sort_field varchar(100),
        default_sort_direction varchar(10) DEFAULT 'asc',
        records_per_page int DEFAULT 25,

        -- Display field (which field to show as the record title/name)
        display_field varchar(100),

        -- Audit
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        created_by uuid,
        updated_by uuid
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_table_ui_config_category ON table_ui_config(category);`);
    await queryRunner.query(`CREATE INDEX idx_table_ui_config_hidden ON table_ui_config(is_hidden) WHERE is_hidden = false;`);

    // Field UI Configuration - lightweight overlay for field display settings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS field_ui_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name varchar(100) NOT NULL,
        column_name varchar(100) NOT NULL,

        -- Display metadata
        label varchar(255),
        description text,
        placeholder varchar(255),
        help_text text,

        -- Visibility controls
        show_in_list boolean DEFAULT true,
        show_in_form boolean DEFAULT true,
        show_in_detail boolean DEFAULT true,
        is_hidden boolean DEFAULT false,

        -- Form behavior
        display_order int DEFAULT 0,
        form_section varchar(100),
        form_width varchar(20) DEFAULT 'full',

        -- Validation display
        validation_message text,

        -- Reference field configuration (for foreign keys)
        reference_table varchar(100),
        reference_display_field varchar(100),

        -- Choice field configuration (for enums/choices)
        choices jsonb,

        -- Formatting
        format_pattern varchar(100),
        prefix varchar(20),
        suffix varchar(20),

        -- Audit
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        created_by uuid,
        updated_by uuid,

        CONSTRAINT uq_field_ui_config UNIQUE (table_name, column_name)
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_field_ui_config_table ON field_ui_config(table_name);`);
    await queryRunner.query(`CREATE INDEX idx_field_ui_config_order ON field_ui_config(table_name, display_order);`);

    // Seed default UI config for system/infrastructure tables (mark them as hidden)
    await queryRunner.query(`
      INSERT INTO table_ui_config (table_name, label, category, is_hidden, is_system) VALUES
        -- Metadata tables (internal)
        ('migrations', 'Migrations', 'system', true, true),

        -- Platform infrastructure tables (hidden from regular users)
        ('table_ui_config', 'Table UI Config', 'system', true, true),
        ('field_ui_config', 'Field UI Config', 'system', true, true),
        ('platform_config', 'Platform Config', 'system', true, true),
        ('tenant_customization', 'Tenant Customization', 'system', true, true),
        ('config_change_history', 'Config Change History', 'system', true, true),
        ('platform_script', 'Platform Scripts', 'system', true, true),
        ('script_execution_log', 'Script Execution Log', 'system', true, true),

        -- User/Auth related (admin only)
        ('user_profile', 'User Profiles', 'identity', false, true),

        -- RBAC tables (admin only)
        ('tenant_roles', 'Roles', 'security', false, true),
        ('tenant_permissions', 'Permissions', 'security', false, true),
        ('tenant_role_permissions', 'Role Permissions', 'security', true, true),
        ('tenant_user_roles', 'User Roles', 'security', true, true),
        ('tenant_groups', 'Groups', 'security', false, true),
        ('tenant_group_members', 'Group Members', 'security', true, true),
        ('tenant_group_roles', 'Group Roles', 'security', true, true),
        ('tenant_nav_profiles', 'Navigation Profiles', 'security', false, true),
        ('tenant_nav_profile_items', 'Navigation Items', 'security', true, true),
        ('tenant_table_acls', 'Table ACLs', 'security', true, true),
        ('tenant_field_acls', 'Field ACLs', 'security', true, true),

        -- Workflow tables
        ('workflow_definitions', 'Workflow Definitions', 'workflow', false, true),
        ('workflow_runs', 'Workflow Runs', 'workflow', false, true),
        ('workflow_step_type', 'Workflow Step Types', 'workflow', true, true),
        ('workflow_step_execution', 'Workflow Step Executions', 'workflow', true, true),

        -- Approval tables
        ('approval_type', 'Approval Types', 'workflow', false, true),
        ('approval_request', 'Approval Requests', 'workflow', false, true),
        ('approval_assignment', 'Approval Assignments', 'workflow', true, true),
        ('approval_history', 'Approval History', 'workflow', true, true),

        -- Notification tables
        ('notification_channel', 'Notification Channels', 'notification', false, true),
        ('notification_template', 'Notification Templates', 'notification', false, true),
        ('notification_subscription', 'Notification Subscriptions', 'notification', true, true),
        ('notification_delivery', 'Notification Delivery', 'notification', true, true),
        ('in_app_notification', 'In-App Notifications', 'notification', false, true),

        -- Event tables
        ('event_definition', 'Event Definitions', 'event', false, true),
        ('event_log', 'Event Log', 'event', false, true),
        ('event_subscription', 'Event Subscriptions', 'event', true, true),
        ('event_delivery', 'Event Delivery', 'event', true, true),

        -- Business rules
        ('business_rule', 'Business Rules', 'automation', false, true),
        ('field_protection_rule', 'Field Protection Rules', 'security', false, true),

        -- Upgrade management
        ('upgrade_manifest', 'Upgrade Manifests', 'system', true, true),
        ('tenant_upgrade_impact', 'Upgrade Impact', 'system', true, true),

        -- User preferences
        ('user_layout_preference', 'User Layout Preferences', 'system', true, true),

        -- Audit
        ('audit_log', 'Audit Log', 'audit', false, true),

        -- Legacy metadata tables (keep for backward compatibility but mark as system)
        ('model_table', 'Model Tables (Legacy)', 'system', true, true),
        ('model_field', 'Model Fields (Legacy)', 'system', true, true),
        ('model_field_type', 'Field Types', 'system', true, true),
        ('model_form_layout', 'Form Layouts (Legacy)', 'system', true, true),
        ('modules', 'Modules', 'system', true, true),
        ('form_definitions', 'Form Definitions', 'system', true, true),
        ('form_versions', 'Form Versions', 'system', true, true),

        -- Application tables (visible)
        ('app_asset', 'Assets', 'application', false, false),
        ('app_field_type_demo', 'Field Type Demo', 'application', false, false)
      ON CONFLICT (table_name) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS field_ui_config;`);
    await queryRunner.query(`DROP TABLE IF EXISTS table_ui_config;`);
  }
}
