import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitControlPlane1790000000000 implements MigrationInterface {
  name = 'InitControlPlane1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS control_plane_users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        email varchar(255) NOT NULL,
        first_name varchar(100) NOT NULL,
        last_name varchar(100) NOT NULL,
        password_hash varchar(255) NOT NULL,
        role varchar(20) NOT NULL DEFAULT 'viewer',
        is_active boolean NOT NULL DEFAULT true,
        mfa_enabled boolean NOT NULL DEFAULT false,
        mfa_secret varchar(255),
        avatar_url varchar(500),
        last_login_at timestamptz,
        last_login_ip varchar(45),
        failed_login_attempts int NOT NULL DEFAULT 0,
        locked_until timestamptz,
        password_changed_at timestamptz,
        preferences jsonb NOT NULL DEFAULT '{}',
        created_by uuid,
        updated_by uuid,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_control_plane_users_email ON control_plane_users(email);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_control_plane_users_role ON control_plane_users(role);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_control_plane_users_is_active ON control_plane_users(is_active);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(50) NOT NULL,
        name varchar(200) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'trial',
        tier varchar(20) NOT NULL DEFAULT 'starter',
        contact_name varchar(200),
        contact_email varchar(255),
        contact_phone varchar(50),
        mrr int NOT NULL DEFAULT 0,
        contract_start date,
        contract_end date,
        settings jsonb NOT NULL DEFAULT '{}',
        total_users int NOT NULL DEFAULT 0,
        total_assets int NOT NULL DEFAULT 0,
        notes text,
        metadata jsonb NOT NULL DEFAULT '{}',
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
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_instances (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id uuid NOT NULL REFERENCES customers(id),
        environment varchar(20) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'provisioning',
        health varchar(20) NOT NULL DEFAULT 'unknown',
        domain varchar(255),
        custom_domain varchar(255),
        region varchar(50) NOT NULL,
        version varchar(50) NOT NULL,
        resource_tier varchar(20) NOT NULL DEFAULT 'standard',
        database_name varchar(100) NOT NULL,
        database_host varchar(255),
        k8s_namespace varchar(100),
        terraform_workspace varchar(100),
        last_health_check timestamptz,
        health_details jsonb NOT NULL DEFAULT '{}',
        resource_metrics jsonb NOT NULL DEFAULT '{}',
        config jsonb NOT NULL DEFAULT '{}',
        provisioning_started_at timestamptz,
        provisioning_completed_at timestamptz,
        last_deployed_at timestamptz,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_by uuid,
        updated_by uuid,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_instances_customer_id ON tenant_instances(customer_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_instances_environment ON tenant_instances(environment);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_instances_status ON tenant_instances(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_instances_health ON tenant_instances(health);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_instances_region ON tenant_instances(region);`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_instances_domain_unique ON tenant_instances(domain) WHERE domain IS NOT NULL;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id uuid NOT NULL REFERENCES customers(id),
        license_key varchar(100) NOT NULL,
        license_type varchar(20) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        max_users int NOT NULL,
        max_assets int NOT NULL,
        features jsonb NOT NULL DEFAULT '[]',
        issued_at timestamptz NOT NULL,
        activated_at timestamptz,
        expires_at timestamptz NOT NULL,
        signature text,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_by uuid,
        updated_by uuid,
        revoked_at timestamptz,
        revoked_by uuid,
        revoke_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_licenses_customer_id ON licenses(customer_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON licenses(expires_at);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS control_plane_audit_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id uuid,
        event_type varchar(100) NOT NULL,
        severity varchar(20) NOT NULL,
        actor varchar(255) NOT NULL,
        actor_type varchar(20) NOT NULL,
        target varchar(255) NOT NULL,
        target_type varchar(50) NOT NULL,
        description text NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}',
        ip_address varchar(45),
        user_agent text,
        correlation_id uuid,
        duration_ms int,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_customer_id ON control_plane_audit_logs(customer_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_event_type ON control_plane_audit_logs(event_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_severity ON control_plane_audit_logs(severity);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_actor ON control_plane_audit_logs(actor);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_actor_type ON control_plane_audit_logs(actor_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_target_type ON control_plane_audit_logs(target_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON control_plane_audit_logs(created_at);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terraform_jobs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        instance_id uuid NOT NULL REFERENCES tenant_instances(id),
        customer_code varchar(50) NOT NULL,
        environment varchar(20) NOT NULL,
        operation varchar(20) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        workspace varchar(100),
        plan jsonb NOT NULL DEFAULT '{"add":0,"change":0,"destroy":0}',
        output jsonb NOT NULL DEFAULT '[]',
        error_message text,
        started_at timestamptz,
        completed_at timestamptz,
        duration int,
        terraform_version varchar(20),
        metadata jsonb NOT NULL DEFAULT '{}',
        triggered_by uuid,
        cancelled_by uuid,
        cancelled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_terraform_jobs_instance_id ON terraform_jobs(instance_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_terraform_jobs_status ON terraform_jobs(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_terraform_jobs_operation ON terraform_jobs(operation);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_terraform_jobs_created_at ON terraform_jobs(created_at);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS terraform_jobs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS control_plane_audit_logs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS licenses;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenant_instances_domain_unique;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_instances;`);
    await queryRunner.query(`DROP TABLE IF EXISTS customers;`);
    await queryRunner.query(`DROP TABLE IF EXISTS control_plane_users;`);
  }
}
