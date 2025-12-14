import { MigrationInterface, QueryRunner } from 'typeorm';

export class HybridIdentityTenant1786000000000 implements MigrationInterface {
  name = 'HybridIdentityTenant1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tenant_users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_account_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'invited',
        employee_id VARCHAR(100),
        title VARCHAR(200),
        department VARCHAR(200),
        location VARCHAR(200),
        cost_center VARCHAR(50),
        manager_id UUID REFERENCES tenant_users(id),
        work_email VARCHAR(320),
        work_phone VARCHAR(50),
        mobile_phone VARCHAR(50),
        display_name VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(500),
        locale VARCHAR(20),
        time_zone VARCHAR(50),
        is_tenant_admin BOOLEAN DEFAULT false,
        invited_by UUID REFERENCES tenant_users(id),
        invited_at TIMESTAMPTZ,
        activation_token VARCHAR(255),
        activation_token_expires_at TIMESTAMPTZ,
        activated_at TIMESTAMPTZ,
        activated_by UUID REFERENCES tenant_users(id),
        deactivated_at TIMESTAMPTZ,
        deactivated_by UUID REFERENCES tenant_users(id),
        deactivation_reason TEXT,
        suspended_at TIMESTAMPTZ,
        suspended_by UUID REFERENCES tenant_users(id),
        suspension_reason TEXT,
        suspension_expires_at TIMESTAMPTZ,
        last_login_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        deleted_by UUID REFERENCES tenant_users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_user_account_per_tenant UNIQUE (user_account_id)
      )
    `);

    // Create indexes for tenant_users
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_users_user_account ON tenant_users(user_account_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_users_status ON tenant_users(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_users_manager ON tenant_users(manager_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_users_department ON tenant_users(department)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(work_email)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_users_employee_id ON tenant_users(employee_id) WHERE employee_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_users_active ON tenant_users(status) WHERE status = 'active'`);

    // Create user_preferences table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES tenant_users(id) ON DELETE CASCADE,
        theme VARCHAR(20) DEFAULT 'system',
        sidebar_collapsed BOOLEAN DEFAULT false,
        default_list_page_size INT DEFAULT 20,
        date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
        time_format VARCHAR(20) DEFAULT 'HH:mm',
        number_format VARCHAR(20) DEFAULT 'en-US',
        email_notifications BOOLEAN DEFAULT true,
        push_notifications BOOLEAN DEFAULT true,
        in_app_notifications BOOLEAN DEFAULT true,
        notification_digest VARCHAR(20) DEFAULT 'instant',
        module_preferences JSONB DEFAULT '{}',
        keyboard_shortcuts_enabled BOOLEAN DEFAULT true,
        custom_shortcuts JSONB DEFAULT '{}',
        default_dashboard VARCHAR(100),
        dashboard_layout JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create user_delegates table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_delegates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
        delegate_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
        delegation_type VARCHAR(50) NOT NULL,
        module_scope VARCHAR(100),
        starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMPTZ,
        can_approve BOOLEAN DEFAULT true,
        can_create BOOLEAN DEFAULT false,
        can_edit BOOLEAN DEFAULT false,
        notes TEXT,
        created_by UUID REFERENCES tenant_users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        revoked_by UUID REFERENCES tenant_users(id),
        revoke_reason TEXT,
        CONSTRAINT no_self_delegation CHECK (user_id != delegate_id),
        CONSTRAINT valid_date_range CHECK (ends_at IS NULL OR ends_at > starts_at)
      )
    `);

    // Create indexes for user_delegates
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_delegates_user ON user_delegates(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_delegates_delegate ON user_delegates(delegate_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_delegates_active ON user_delegates(user_id, delegate_id) WHERE revoked_at IS NULL`);

    // Create user_api_keys table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        key_prefix VARCHAR(12) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        scopes JSONB DEFAULT '["read"]',
        rate_limit_per_minute INT DEFAULT 60,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        last_used_ip VARCHAR(45),
        usage_count BIGINT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        revoked_at TIMESTAMPTZ,
        revoked_by UUID REFERENCES tenant_users(id),
        revoke_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_key_name_per_user UNIQUE (user_id, name)
      )
    `);

    // Create indexes for user_api_keys
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_api_keys_prefix ON user_api_keys(key_prefix)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(user_id) WHERE is_active = true`);

    // Create user_audit_log table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES tenant_users(id),
        action VARCHAR(50) NOT NULL,
        actor_id UUID REFERENCES tenant_users(id),
        actor_type VARCHAR(20) NOT NULL DEFAULT 'user',
        target_type VARCHAR(50),
        target_id UUID,
        target_name VARCHAR(255),
        old_value JSONB,
        new_value JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        correlation_id UUID,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes for user_audit_log
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_audit_log_user ON user_audit_log(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_audit_log_action ON user_audit_log(action)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_audit_log_created ON user_audit_log(created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_audit_log_actor ON user_audit_log(actor_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_audit_log_correlation ON user_audit_log(correlation_id)`);

    // Create tenant_settings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(50) NOT NULL,
        key VARCHAR(100) NOT NULL,
        value JSONB NOT NULL,
        value_type VARCHAR(20) NOT NULL DEFAULT 'string',
        display_name VARCHAR(200),
        description TEXT,
        ui_component VARCHAR(50),
        ui_options JSONB DEFAULT '{}',
        validation_rules JSONB,
        default_value JSONB,
        requires_admin BOOLEAN DEFAULT true,
        is_sensitive BOOLEAN DEFAULT false,
        is_readonly BOOLEAN DEFAULT false,
        display_order INT DEFAULT 0,
        group_name VARCHAR(100),
        updated_by UUID REFERENCES tenant_users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_tenant_setting UNIQUE (category, key)
      )
    `);

    // Create index for tenant_settings
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_settings_category ON tenant_settings(category)`);

    // Add tenant_user_id column to tenant_user_roles
    await queryRunner.query(`
      ALTER TABLE tenant_user_roles
      ADD COLUMN IF NOT EXISTS tenant_user_id UUID REFERENCES tenant_users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_user_roles_tenant_user ON tenant_user_roles(tenant_user_id)`);

    // Make user_id nullable in tenant_user_roles for migration
    await queryRunner.query(`ALTER TABLE tenant_user_roles ALTER COLUMN user_id DROP NOT NULL`);

    // Add tenant_user_id column to tenant_group_members
    await queryRunner.query(`
      ALTER TABLE tenant_group_members
      ADD COLUMN IF NOT EXISTS tenant_user_id UUID REFERENCES tenant_users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_group_members_tenant_user ON tenant_group_members(tenant_user_id)`);

    // Make user_id nullable in tenant_group_members for migration
    await queryRunner.query(`ALTER TABLE tenant_group_members ALTER COLUMN user_id DROP NOT NULL`);

    // Seed default tenant settings
    await queryRunner.query(`
      INSERT INTO tenant_settings (category, key, value, value_type, display_name, description, ui_component, display_order)
      VALUES
        -- User settings
        ('user', 'allow_self_registration', 'false', 'boolean', 'Allow Self Registration', 'Allow users to self-register for this tenant', 'toggle', 1),
        ('user', 'require_email_verification', 'true', 'boolean', 'Require Email Verification', 'Require email verification for new users', 'toggle', 2),
        ('user', 'invitation_expiry_hours', '72', 'number', 'Invitation Expiry (Hours)', 'Hours until invitation link expires', 'number', 3),
        ('user', 'session_timeout_minutes', '480', 'number', 'Session Timeout (Minutes)', 'Session inactivity timeout', 'number', 4),
        ('user', 'max_sessions_per_user', '5', 'number', 'Max Sessions Per User', 'Maximum concurrent sessions per user', 'number', 5),

        -- Password settings
        ('password', 'min_length', '12', 'number', 'Minimum Length', 'Minimum password length', 'number', 1),
        ('password', 'require_uppercase', 'true', 'boolean', 'Require Uppercase', 'Require uppercase letters', 'toggle', 2),
        ('password', 'require_lowercase', 'true', 'boolean', 'Require Lowercase', 'Require lowercase letters', 'toggle', 3),
        ('password', 'require_numbers', 'true', 'boolean', 'Require Numbers', 'Require numeric digits', 'toggle', 4),
        ('password', 'require_symbols', 'false', 'boolean', 'Require Symbols', 'Require special characters', 'toggle', 5),
        ('password', 'expiry_days', '0', 'number', 'Password Expiry (Days)', 'Days until password expires (0 = never)', 'number', 6),
        ('password', 'history_depth', '5', 'number', 'Password History', 'Number of previous passwords to check', 'number', 7),
        ('password', 'max_failed_attempts', '5', 'number', 'Max Failed Attempts', 'Failed attempts before lockout', 'number', 8),
        ('password', 'lockout_duration_minutes', '15', 'number', 'Lockout Duration (Minutes)', 'Account lockout duration', 'number', 9),

        -- MFA settings
        ('mfa', 'enabled', 'false', 'boolean', 'Enable MFA', 'Enable multi-factor authentication globally', 'toggle', 1),
        ('mfa', 'required_for_admins', 'true', 'boolean', 'Required for Admins', 'Require MFA for tenant admins', 'toggle', 2),
        ('mfa', 'remember_device_days', '30', 'number', 'Remember Device (Days)', 'Days to remember trusted device', 'number', 3),

        -- SSO settings
        ('sso', 'enabled', 'false', 'boolean', 'Enable SSO', 'Enable single sign-on authentication', 'toggle', 1),
        ('sso', 'allow_local_login', 'true', 'boolean', 'Allow Local Login', 'Allow local login when SSO is enabled', 'toggle', 2),
        ('sso', 'jit_provisioning', 'true', 'boolean', 'JIT Provisioning', 'Auto-create users on first SSO login', 'toggle', 3),

        -- API key settings
        ('api_keys', 'enabled', 'true', 'boolean', 'Enable API Keys', 'Enable personal API keys', 'toggle', 1),
        ('api_keys', 'max_per_user', '5', 'number', 'Max Per User', 'Maximum API keys per user', 'number', 2),
        ('api_keys', 'default_expiry_days', '365', 'number', 'Default Expiry (Days)', 'Default API key expiration', 'number', 3),

        -- Delegation settings
        ('delegation', 'enabled', 'true', 'boolean', 'Enable Delegation', 'Enable user delegation', 'toggle', 1),
        ('delegation', 'max_delegates_per_user', '5', 'number', 'Max Delegates Per User', 'Maximum delegates per user', 'number', 2),
        ('delegation', 'max_duration_days', '90', 'number', 'Max Duration (Days)', 'Maximum delegation duration', 'number', 3),

        -- Audit settings
        ('audit', 'retention_days', '365', 'number', 'Retention (Days)', 'Days to retain audit logs', 'number', 1),
        ('audit', 'export_enabled', 'true', 'boolean', 'Export Enabled', 'Allow audit log export', 'toggle', 2)
      ON CONFLICT (category, key) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove tenant_user_id from tenant_group_members
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenant_group_members_tenant_user`);
    await queryRunner.query(`ALTER TABLE tenant_group_members DROP COLUMN IF EXISTS tenant_user_id`);
    await queryRunner.query(`ALTER TABLE tenant_group_members ALTER COLUMN user_id SET NOT NULL`);

    // Remove tenant_user_id from tenant_user_roles
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenant_user_roles_tenant_user`);
    await queryRunner.query(`ALTER TABLE tenant_user_roles DROP COLUMN IF EXISTS tenant_user_id`);
    await queryRunner.query(`ALTER TABLE tenant_user_roles ALTER COLUMN user_id SET NOT NULL`);

    // Drop tenant_settings
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_settings`);

    // Drop user_audit_log
    await queryRunner.query(`DROP TABLE IF EXISTS user_audit_log`);

    // Drop user_api_keys
    await queryRunner.query(`DROP TABLE IF EXISTS user_api_keys`);

    // Drop user_delegates
    await queryRunner.query(`DROP TABLE IF EXISTS user_delegates`);

    // Drop user_preferences
    await queryRunner.query(`DROP TABLE IF EXISTS user_preferences`);

    // Drop tenant_users
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_users`);
  }
}
