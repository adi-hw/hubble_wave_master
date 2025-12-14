import { MigrationInterface, QueryRunner } from 'typeorm';

export class HybridIdentityPlatform1786000000000 implements MigrationInterface {
  name = 'HybridIdentityPlatform1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to user_accounts
    await queryRunner.query(`
      ALTER TABLE user_accounts
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45),
      ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false
    `);

    // Create index for platform admins
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_accounts_platform_admin
      ON user_accounts(is_platform_admin) WHERE is_platform_admin = true
    `);

    // Create user_invitations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(320) NOT NULL,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        token VARCHAR(255) NOT NULL UNIQUE,
        token_expires_at TIMESTAMPTZ NOT NULL,
        invited_by UUID REFERENCES user_accounts(id),
        invitation_type VARCHAR(50) NOT NULL DEFAULT 'email',
        metadata JSONB DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        accepted_at TIMESTAMPTZ,
        display_name VARCHAR(255),
        title VARCHAR(200),
        department VARCHAR(200),
        employee_id VARCHAR(100),
        initial_role_ids JSONB DEFAULT '[]',
        initial_group_ids JSONB DEFAULT '[]',
        personal_message TEXT,
        resend_count INT DEFAULT 0,
        last_resent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes for user_invitations
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant ON user_invitations(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status)`);

    // Create sso_configs table (enhanced SSO configuration)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sso_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id),
        provider VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT false,

        -- SAML fields
        entity_id VARCHAR(500),
        sso_url VARCHAR(500),
        slo_url VARCHAR(500),
        certificate TEXT,
        sp_entity_id VARCHAR(500),
        sp_acs_url VARCHAR(500),

        -- OIDC/OAuth fields
        client_id VARCHAR(255),
        client_secret_encrypted TEXT,
        authorization_url VARCHAR(500),
        token_url VARCHAR(500),
        userinfo_url VARCHAR(500),
        jwks_url VARCHAR(500),
        scopes VARCHAR(255) DEFAULT 'openid profile email',

        -- Attribute mapping
        attribute_mapping JSONB DEFAULT '{"email": "email", "display_name": "name", "first_name": "given_name", "last_name": "family_name"}',

        -- JIT provisioning
        jit_enabled BOOLEAN DEFAULT false,
        jit_default_roles JSONB DEFAULT '[]',
        jit_group_mapping JSONB DEFAULT '{}',
        jit_update_profile BOOLEAN DEFAULT true,

        -- UI customization
        button_text VARCHAR(100),
        button_icon_url VARCHAR(500),
        display_order INT DEFAULT 0,

        -- Additional settings
        allowed_domains JSONB DEFAULT '[]',
        logout_redirect_url VARCHAR(500),

        -- Audit
        created_by UUID REFERENCES user_accounts(id),
        updated_by UUID REFERENCES user_accounts(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,

        CONSTRAINT unique_sso_per_tenant UNIQUE (tenant_id, provider, name)
      )
    `);

    // Create indexes for sso_configs
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sso_configs_tenant ON sso_configs(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sso_configs_provider ON sso_configs(provider)`);

    // Add migrated_to_tenant_db column to tenant_user_memberships for migration tracking
    await queryRunner.query(`
      ALTER TABLE tenant_user_memberships
      ADD COLUMN IF NOT EXISTS migrated_to_tenant_db BOOLEAN DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove migrated_to_tenant_db column
    await queryRunner.query(`ALTER TABLE tenant_user_memberships DROP COLUMN IF EXISTS migrated_to_tenant_db`);

    // Drop sso_configs table
    await queryRunner.query(`DROP TABLE IF EXISTS sso_configs`);

    // Drop user_invitations table
    await queryRunner.query(`DROP TABLE IF EXISTS user_invitations`);

    // Drop platform admin index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_accounts_platform_admin`);

    // Remove new columns from user_accounts
    await queryRunner.query(`
      ALTER TABLE user_accounts
      DROP COLUMN IF EXISTS first_name,
      DROP COLUMN IF EXISTS last_name,
      DROP COLUMN IF EXISTS avatar_url,
      DROP COLUMN IF EXISTS email_verified,
      DROP COLUMN IF EXISTS email_verified_at,
      DROP COLUMN IF EXISTS is_platform_admin,
      DROP COLUMN IF EXISTS last_login_at,
      DROP COLUMN IF EXISTS last_login_ip,
      DROP COLUMN IF EXISTS phone_number,
      DROP COLUMN IF EXISTS phone_verified
    `);
  }
}
