import { MigrationInterface, QueryRunner } from 'typeorm';

export class AVAGovernance1791000000000 implements MigrationInterface {
  name = 'AVAGovernance1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // AVA Audit Trail - tracks all actions performed by AVA
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_audit_trail (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- User context
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255),
        user_role VARCHAR(100),

        -- Conversation context
        conversation_id UUID,
        user_message TEXT,
        ava_response TEXT,

        -- Action details
        action_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        action_label VARCHAR(255) NOT NULL,
        action_target VARCHAR(500) NOT NULL,

        -- Target entity
        target_collection VARCHAR(100),
        target_record_id VARCHAR(255),
        target_display_value VARCHAR(500),

        -- Data for revert capability
        before_data JSONB,
        after_data JSONB,
        action_params JSONB,

        -- Revert information
        is_revertible BOOLEAN DEFAULT false,
        reverted_at TIMESTAMP WITH TIME ZONE,
        reverted_by VARCHAR(255),
        revert_reason TEXT,

        -- Failure tracking
        error_message TEXT,
        error_code VARCHAR(100),

        -- Permission context
        permission_granted BOOLEAN DEFAULT true,
        permission_rule_id UUID,
        rejection_reason TEXT,

        -- Metadata
        ip_address VARCHAR(50),
        user_agent TEXT,
        session_id VARCHAR(255),
        duration_ms INTEGER,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Indexes for audit trail
    await queryRunner.query(`
      CREATE INDEX idx_ava_audit_user_id ON ava_audit_trail (user_id);
      CREATE INDEX idx_ava_audit_user_created ON ava_audit_trail (user_id, created_at DESC);
      CREATE INDEX idx_ava_audit_action_status ON ava_audit_trail (action_type, status);
      CREATE INDEX idx_ava_audit_target ON ava_audit_trail (target_collection, target_record_id);
      CREATE INDEX idx_ava_audit_conversation ON ava_audit_trail (conversation_id);
      CREATE INDEX idx_ava_audit_created ON ava_audit_trail (created_at DESC);
      CREATE INDEX idx_ava_audit_revertible ON ava_audit_trail (is_revertible) WHERE is_revertible = true;
    `);

    // AVA Permission Configuration - controls what AVA can do
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_permission_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Scope
        collection_code VARCHAR(100),
        action_type VARCHAR(50) NOT NULL,

        -- Permission settings
        is_enabled BOOLEAN DEFAULT true,
        requires_confirmation BOOLEAN DEFAULT true,
        allowed_roles JSONB DEFAULT '[]',
        excluded_roles JSONB DEFAULT '[]',

        -- Restrictions
        max_records_per_hour INTEGER,
        max_records_per_day INTEGER,
        restricted_fields JSONB DEFAULT '[]',
        read_only_collections JSONB DEFAULT '[]',

        -- Approval workflow
        requires_approval BOOLEAN DEFAULT false,
        approver_roles JSONB DEFAULT '[]',

        -- Audit requirements
        always_audit BOOLEAN DEFAULT true,
        notify_admin BOOLEAN DEFAULT false,

        -- Metadata
        description TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by VARCHAR(255),
        updated_at TIMESTAMP WITH TIME ZONE,

        UNIQUE(collection_code, action_type)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_ava_perm_collection ON ava_permission_config (collection_code, action_type);
    `);

    // AVA Global Settings - tenant-wide configuration
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_global_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Master switch
        ava_enabled BOOLEAN DEFAULT true,

        -- Default behaviors
        default_requires_confirmation BOOLEAN DEFAULT true,
        allow_create_actions BOOLEAN DEFAULT true,
        allow_update_actions BOOLEAN DEFAULT true,
        allow_delete_actions BOOLEAN DEFAULT false,
        allow_execute_actions BOOLEAN DEFAULT false,

        -- Rate limits
        global_rate_limit_per_hour INTEGER DEFAULT 100,
        user_rate_limit_per_hour INTEGER DEFAULT 20,

        -- Audit settings
        audit_retention_days INTEGER DEFAULT 90,
        audit_all_queries BOOLEAN DEFAULT false,

        -- Read-only mode
        read_only_mode BOOLEAN DEFAULT false,
        system_read_only_collections JSONB DEFAULT '["ava_audit_trail", "ava_permission_config", "ava_global_settings", "users", "roles", "tenants"]',

        -- Notifications
        admin_notification_email VARCHAR(255),
        notify_on_failure BOOLEAN DEFAULT true,
        notify_on_revert BOOLEAN DEFAULT true,

        -- Metadata
        updated_by VARCHAR(255),
        updated_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Insert default global settings
    await queryRunner.query(`
      INSERT INTO ava_global_settings (id)
      VALUES (gen_random_uuid())
      ON CONFLICT DO NOTHING
    `);

    // Insert default permission configurations
    await queryRunner.query(`
      INSERT INTO ava_permission_config (collection_code, action_type, is_enabled, requires_confirmation, description)
      VALUES
        (NULL, 'navigate', true, false, 'Allow AVA to navigate users to pages'),
        (NULL, 'create', true, true, 'Allow AVA to create records (requires confirmation)'),
        (NULL, 'update', true, true, 'Allow AVA to update records (requires confirmation)'),
        (NULL, 'delete', false, true, 'Delete actions are disabled by default'),
        (NULL, 'execute', false, true, 'Execute actions are disabled by default')
      ON CONFLICT (collection_code, action_type) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ava_global_settings`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_permission_config`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_audit_trail`);
  }
}
