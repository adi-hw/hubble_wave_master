import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitControlPlane0001 implements MigrationInterface {
  name = 'InitControlPlane0001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // CUSTOMERS - HubbleWave's customers
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
        
        -- Contract details
        contract_start DATE NOT NULL,
        contract_end DATE,
        tier VARCHAR(20) NOT NULL CHECK (tier IN ('starter', 'professional', 'enterprise')),
        
        -- Contact info
        primary_contact_name VARCHAR(255),
        primary_contact_email VARCHAR(255),
        billing_email VARCHAR(255),
        
        -- Settings
        settings JSONB DEFAULT '{}',
        
        -- Audit
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_customers_code ON customers(code)`);
    await queryRunner.query(`CREATE INDEX idx_customers_status ON customers(status)`);

    // =====================================================
    // INSTANCES - Deployed customer instances (NOT tenant_instances!)
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        
        environment VARCHAR(20) NOT NULL CHECK (environment IN ('production', 'staging', 'development')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'provisioning', 'active', 'suspended', 'terminated', 'failed')),
        
        -- Infrastructure
        domain VARCHAR(255) UNIQUE,
        custom_domain VARCHAR(255),
        region VARCHAR(50) NOT NULL,
        
        -- Version
        platform_version VARCHAR(50),
        last_updated TIMESTAMPTZ,
        
        -- Resource allocation
        resource_tier VARCHAR(20) DEFAULT 'standard' CHECK (resource_tier IN ('standard', 'professional', 'enterprise')),
        
        -- Database connection (for Control Plane to manage)
        database_host VARCHAR(255),
        database_name VARCHAR(100),
        k8s_namespace VARCHAR(100),
        
        -- Health
        health_status VARCHAR(20) DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
        last_health_check TIMESTAMPTZ,
        health_details JSONB DEFAULT '{}',
        
        -- Provisioning
        provisioning_started_at TIMESTAMPTZ,
        provisioning_completed_at TIMESTAMPTZ,
        last_deployed_at TIMESTAMPTZ,
        
        -- Config & metadata
        config JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        
        -- Audit
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMPTZ,
        
        UNIQUE(customer_id, environment)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_instances_customer ON instances(customer_id)`);
    await queryRunner.query(`CREATE INDEX idx_instances_status ON instances(status)`);
    await queryRunner.query(`CREATE INDEX idx_instances_environment ON instances(environment)`);

    // =====================================================
    // SUBSCRIPTIONS - Billing
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        
        plan_id VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
        
        -- Billing
        monthly_amount DECIMAL(10,2),
        currency VARCHAR(3) DEFAULT 'USD',
        billing_cycle VARCHAR(20) DEFAULT 'monthly',
        
        -- Period
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        
        -- External integration
        stripe_subscription_id VARCHAR(255),
        stripe_customer_id VARCHAR(255),
        
        -- Audit
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // =====================================================
    // LICENSES
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE licenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        instance_id UUID REFERENCES instances(id) ON DELETE SET NULL,
        
        license_key VARCHAR(500) UNIQUE NOT NULL,
        license_type VARCHAR(50) NOT NULL CHECK (license_type IN ('production', 'staging', 'development', 'trial')),
        
        -- Features
        features JSONB DEFAULT '[]',
        
        -- Limits
        max_users INTEGER,
        max_assets INTEGER,
        
        -- Validity
        issued_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        
        -- Audit
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // =====================================================
    // INSTANCE METRICS (time-series)
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE instance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
        
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        -- Usage metrics
        active_users INTEGER,
        total_users INTEGER,
        api_requests_1h INTEGER,
        db_connections INTEGER,
        storage_bytes BIGINT,
        
        -- Performance metrics
        avg_response_time_ms DECIMAL(10,2),
        p95_response_time_ms DECIMAL(10,2),
        error_rate DECIMAL(5,4),
        
        -- Resource metrics
        cpu_percent DECIMAL(5,2),
        memory_percent DECIMAL(5,2),
        disk_percent DECIMAL(5,2)
      ) PARTITION BY RANGE (recorded_at)
    `);

    // Create initial partition
    await queryRunner.query(`
      CREATE TABLE instance_metrics_2025_01 PARTITION OF instance_metrics
      FOR VALUES FROM ('2025-01-01') TO ('2025-02-01')
    `);

    // =====================================================
    // CONTROL PLANE USERS (HubbleWave staff only)
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE control_plane_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(320) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        password_hash VARCHAR(255),
        
        role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'support', 'readonly')),
        
        status VARCHAR(20) DEFAULT 'active',
        mfa_enabled BOOLEAN DEFAULT false,
        mfa_secret VARCHAR(255),
        
        last_login_at TIMESTAMPTZ,
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // =====================================================
    // CONTROL PLANE AUDIT LOG
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE control_plane_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES control_plane_users(id),
        customer_id UUID REFERENCES customers(id),
        instance_id UUID REFERENCES instances(id),
        
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id UUID,
        
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        user_agent TEXT,
        
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_cp_audit_customer ON control_plane_audit_log(customer_id)`);
    await queryRunner.query(`CREATE INDEX idx_cp_audit_created ON control_plane_audit_log(created_at DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS control_plane_audit_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS control_plane_users`);
    await queryRunner.query(`DROP TABLE IF EXISTS instance_metrics`);
    await queryRunner.query(`DROP TABLE IF EXISTS licenses`);
    await queryRunner.query(`DROP TABLE IF EXISTS subscriptions`);
    await queryRunner.query(`DROP TABLE IF EXISTS instances`);
    await queryRunner.query(`DROP TABLE IF EXISTS customers`);
  }
}
