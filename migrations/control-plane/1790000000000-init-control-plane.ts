import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitControlPlane1790000000000 implements MigrationInterface {
  name = 'InitControlPlane1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // ============================================================
    // Control Plane Users (HubbleWave staff, not customer users)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS control_plane_users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        email varchar(320) NOT NULL,
        display_name varchar(255) NOT NULL,
        first_name varchar(100),
        last_name varchar(100),
        password_hash varchar(255),
        role varchar(50) NOT NULL DEFAULT 'readonly',
        status varchar(20) NOT NULL DEFAULT 'active',
        mfa_enabled boolean NOT NULL DEFAULT false,
        mfa_secret varchar(255),
        mfa_backup_codes jsonb,
        failed_login_attempts int NOT NULL DEFAULT 0,
        locked_until timestamptz,
        password_changed_at timestamptz,
        last_login_at timestamptz,
        last_login_ip varchar(45),
        last_activity_at timestamptz,
        avatar_url varchar(500),
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_control_plane_users_email ON control_plane_users(email);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_control_plane_users_role ON control_plane_users(role);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_control_plane_users_status ON control_plane_users(status);`);

    // ============================================================
    // Customers (HubbleWave customer organizations)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(50) NOT NULL,
        name varchar(255) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        tier varchar(20) NOT NULL DEFAULT 'professional',
        contract_start date,
        contract_end date,
        contract_value decimal(12,2),
        currency varchar(3) NOT NULL DEFAULT 'USD',
        mrr int NOT NULL DEFAULT 0,
        primary_contact_name varchar(255),
        primary_contact_email varchar(320),
        primary_contact_phone varchar(50),
        technical_contact_email varchar(320),
        billing_email varchar(320),
        address_line1 varchar(255),
        address_line2 varchar(255),
        city varchar(100),
        state varchar(100),
        postal_code varchar(20),
        country varchar(100),
        max_users int,
        max_assets int,
        max_storage_gb int,
        max_instances int NOT NULL DEFAULT 3,
        settings jsonb NOT NULL DEFAULT '{}',
        feature_flags jsonb NOT NULL DEFAULT '[]',
        metadata jsonb NOT NULL DEFAULT '{}',
        notes text,
        created_by uuid,
        updated_by uuid,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_code ON customers(code);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);`);

    // ============================================================
    // Instances (deployed customer instances, one per environment)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS instances (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id uuid NOT NULL REFERENCES customers(id),
        environment varchar(20) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        health varchar(20) NOT NULL DEFAULT 'unknown',
        domain varchar(255),
        custom_domain varchar(255),
        ssl_status varchar(50),
        region varchar(50) NOT NULL,
        version varchar(50) NOT NULL,
        resource_tier varchar(20) NOT NULL DEFAULT 'standard',
        database_name varchar(100) NOT NULL,
        database_host varchar(255),
        database_port int NOT NULL DEFAULT 5432,
        k8s_namespace varchar(100),
        k8s_cluster varchar(100),
        terraform_workspace varchar(100),
        last_health_check timestamptz,
        health_details jsonb NOT NULL DEFAULT '{}',
        resource_metrics jsonb NOT NULL DEFAULT '{}',
        provisioning_started_at timestamptz,
        provisioning_completed_at timestamptz,
        last_deployed_at timestamptz,
        last_deployed_version varchar(50),
        error_message text,
        config jsonb NOT NULL DEFAULT '{}',
        feature_flags jsonb NOT NULL DEFAULT '[]',
        metadata jsonb NOT NULL DEFAULT '{}',
        maintenance_window varchar(100),
        next_maintenance timestamptz,
        backup_retention_days int NOT NULL DEFAULT 30,
        last_backup_at timestamptz,
        created_by uuid,
        updated_by uuid,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_instances_customer_id ON instances(customer_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_instances_environment ON instances(environment);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_instances_health ON instances(health);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_instances_region ON instances(region);`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_instances_domain_unique ON instances(domain) WHERE domain IS NOT NULL;`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_instances_customer_env_unique ON instances(customer_id, environment);`);

    // ============================================================
    // Subscriptions (billing subscriptions, Stripe integration)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id uuid NOT NULL REFERENCES customers(id),
        plan_id varchar(50) NOT NULL,
        plan_name varchar(100) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        amount decimal(10,2) NOT NULL,
        currency varchar(3) NOT NULL DEFAULT 'USD',
        billing_cycle varchar(20) NOT NULL DEFAULT 'monthly',
        discount_percent decimal(5,2) NOT NULL DEFAULT 0,
        current_period_start timestamptz,
        current_period_end timestamptz,
        trial_end timestamptz,
        cancelled_at timestamptz,
        cancel_at_period_end boolean NOT NULL DEFAULT false,
        stripe_subscription_id varchar(255),
        stripe_customer_id varchar(255),
        stripe_price_id varchar(255),
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);`);

    // ============================================================
    // Licenses (software licenses for customers)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id uuid NOT NULL REFERENCES customers(id),
        instance_id uuid REFERENCES instances(id),
        license_key varchar(500) NOT NULL,
        license_type varchar(50) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        features jsonb NOT NULL DEFAULT '[]',
        max_users int,
        max_assets int,
        signature varchar(500),
        metadata jsonb NOT NULL DEFAULT '{}',
        created_by uuid,
        issued_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz,
        revoked_at timestamptz,
        revoked_by uuid,
        revoke_reason text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_licenses_customer_id ON licenses(customer_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_licenses_instance_id ON licenses(instance_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON licenses(expires_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);`);

    // ============================================================
    // Instance Metrics (time-series metrics for monitoring)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS instance_metrics (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        active_users int,
        total_users int,
        total_assets int,
        api_requests_1h int,
        db_connections int,
        storage_bytes bigint,
        avg_response_time_ms decimal(10,2),
        p95_response_time_ms decimal(10,2),
        p99_response_time_ms decimal(10,2),
        error_rate decimal(5,4),
        cpu_percent decimal(5,2),
        memory_percent decimal(5,2),
        disk_percent decimal(5,2),
        network_io_bytes bigint,
        db_size_bytes bigint,
        db_queries_1h int,
        slow_queries_1h int
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_instance_metrics_instance_recorded ON instance_metrics(instance_id, recorded_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_instance_metrics_recorded_at ON instance_metrics(recorded_at);`);

    // ============================================================
    // Control Plane Audit Logs (administrative audit trail)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS control_plane_audit_log (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid,
        customer_id uuid,
        instance_id uuid,
        action varchar(100) NOT NULL,
        resource_type varchar(50),
        resource_id uuid,
        result varchar(20) NOT NULL DEFAULT 'success',
        error_message text,
        old_values jsonb,
        new_values jsonb,
        details jsonb NOT NULL DEFAULT '{}',
        ip_address varchar(45),
        user_agent text,
        request_id varchar(100),
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_user_id ON control_plane_audit_log(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_customer_id ON control_plane_audit_log(customer_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_instance_id ON control_plane_audit_log(instance_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON control_plane_audit_log(action);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON control_plane_audit_log(created_at);`);

    // ============================================================
    // Terraform Jobs (infrastructure provisioning jobs)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terraform_jobs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
        customer_code varchar(50) NOT NULL,
        environment varchar(50) NOT NULL,
        operation varchar(50) NOT NULL,
        status varchar(50) NOT NULL DEFAULT 'pending',
        workspace varchar(100),
        plan_output text,
        plan jsonb,
        output_lines jsonb,
        output jsonb NOT NULL DEFAULT '[]',
        error_message text,
        exit_code int,
        started_at timestamptz,
        completed_at timestamptz,
        cancelled_at timestamptz,
        triggered_by uuid,
        cancelled_by uuid,
        duration int,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_terraform_jobs_instance_created ON terraform_jobs(instance_id, created_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_terraform_jobs_customer_created ON terraform_jobs(customer_code, created_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_terraform_jobs_status ON terraform_jobs(status);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS terraform_jobs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS control_plane_audit_log;`);
    await queryRunner.query(`DROP TABLE IF EXISTS instance_metrics;`);
    await queryRunner.query(`DROP TABLE IF EXISTS licenses;`);
    await queryRunner.query(`DROP TABLE IF EXISTS subscriptions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS instances;`);
    await queryRunner.query(`DROP TABLE IF EXISTS customers;`);
    await queryRunner.query(`DROP TABLE IF EXISTS control_plane_users;`);
  }
}
