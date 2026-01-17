import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create Advanced Auth Tables
 *
 * Creates tables for:
 * - WebAuthn credentials and challenges
 * - Magic link tokens
 * - Trusted devices
 * - Impersonation sessions
 * - Delegations
 * - Behavioral profiles
 * - Security alerts
 */
export class CreateAdvancedAuthTables1808000000000 implements MigrationInterface {
  name = 'CreateAdvancedAuthTables1808000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // WebAuthn Credentials
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        sign_count BIGINT DEFAULT 0,
        credential_type VARCHAR(50) DEFAULT 'public-key',
        transports JSONB DEFAULT '[]',
        name VARCHAR(255) NOT NULL,
        aaguid VARCHAR(36),
        is_discoverable BOOLEAN DEFAULT true,
        is_backed_up BOOLEAN DEFAULT false,
        device_info JSONB,
        last_used_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON webauthn_credentials(user_id)
    `);

    // WebAuthn Challenges
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS webauthn_challenges (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        challenge VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        session_data JSONB,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_id ON webauthn_challenges(user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at)
    `);

    // Magic Link Tokens
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS magic_link_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(320) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        ip_address VARCHAR(45),
        user_agent TEXT,
        redirect_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email ON magic_link_tokens(email)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_expires_at ON magic_link_tokens(expires_at)
    `);

    // Trusted Devices
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS trusted_devices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_fingerprint VARCHAR(255) NOT NULL,
        device_name VARCHAR(255) NOT NULL,
        device_type VARCHAR(50) NOT NULL,
        browser VARCHAR(100),
        os VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        trust_score INT DEFAULT 50,
        known_ips JSONB DEFAULT '[]',
        known_locations JSONB DEFAULT '[]',
        verification_method VARCHAR(50),
        trusted_until TIMESTAMPTZ,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        login_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_status ON trusted_devices(status)
    `);

    // Impersonation Sessions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS impersonation_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        impersonator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        actions_log JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_impersonator ON impersonation_sessions(impersonator_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target ON impersonation_sessions(target_user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active ON impersonation_sessions(is_active)
    `);

    // Delegations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS delegations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delegator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delegate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        delegated_permissions JSONB DEFAULT '[]',
        delegated_roles JSONB DEFAULT '[]',
        scope_restrictions JSONB,
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL,
        requires_approval BOOLEAN DEFAULT false,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        revoked_by UUID REFERENCES users(id),
        revoked_at TIMESTAMPTZ,
        revocation_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON delegations(delegator_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_delegations_delegate ON delegations(delegate_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_delegations_status ON delegations(status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_delegations_dates ON delegations(starts_at, ends_at)
    `);

    // Behavioral Profiles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS behavioral_profiles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        login_hours JSONB DEFAULT '{}',
        login_days JSONB DEFAULT '{}',
        known_locations JSONB DEFAULT '[]',
        known_ip_ranges JSONB DEFAULT '[]',
        known_devices JSONB DEFAULT '[]',
        avg_session_duration INT DEFAULT 30,
        avg_actions_per_session INT DEFAULT 10,
        last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        data_points INT DEFAULT 0,
        confidence_score INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Security Alerts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS security_alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        alert_type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        severity VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'new',
        risk_score INT DEFAULT 50,
        details JSONB,
        recommended_actions JSONB DEFAULT '[]',
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMPTZ,
        resolution_notes TEXT,
        resolved_by UUID REFERENCES users(id),
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS security_alerts`);
    await queryRunner.query(`DROP TABLE IF EXISTS behavioral_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS delegations`);
    await queryRunner.query(`DROP TABLE IF EXISTS impersonation_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS trusted_devices`);
    await queryRunner.query(`DROP TABLE IF EXISTS magic_link_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS webauthn_challenges`);
    await queryRunner.query(`DROP TABLE IF EXISTS webauthn_credentials`);
  }
}
