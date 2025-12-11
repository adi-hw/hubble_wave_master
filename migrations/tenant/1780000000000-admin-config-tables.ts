import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminConfigTables1780000000000 implements MigrationInterface {
  name = 'AdminConfigTables1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Platform Configuration (Read-only base configs) ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_config (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        config_type varchar(50) NOT NULL,
        resource_key varchar(255) NOT NULL,
        config_data jsonb NOT NULL,
        platform_version varchar(20) NOT NULL,
        schema_version int NOT NULL DEFAULT 1,
        checksum varchar(64) NOT NULL,
        description text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_platform_config UNIQUE (config_type, resource_key, platform_version)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_platform_config_lookup ON platform_config(config_type, resource_key);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_platform_config_version ON platform_config(platform_version);`);

    // ========== Tenant Customization ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_customization (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL,
        config_type varchar(50) NOT NULL,
        resource_key varchar(255) NOT NULL,
        customization_type varchar(30) NOT NULL,
        base_platform_version varchar(20),
        base_config_checksum varchar(64),
        custom_config jsonb NOT NULL,
        diff_from_base jsonb,
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        version int NOT NULL DEFAULT 1,
        previous_version_id uuid REFERENCES tenant_customization(id),
        CONSTRAINT uq_tenant_customization UNIQUE (tenant_id, config_type, resource_key, version)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_custom_lookup ON tenant_customization(tenant_id, config_type, resource_key);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_custom_active ON tenant_customization(tenant_id, is_active) WHERE is_active = true;`);

    // ========== Config Change History ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS config_change_history (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid,
        config_type varchar(50) NOT NULL,
        resource_key varchar(255) NOT NULL,
        change_type varchar(20) NOT NULL,
        previous_value jsonb,
        new_value jsonb,
        diff jsonb,
        change_reason text,
        change_source varchar(30) NOT NULL,
        changed_by uuid,
        changed_at timestamptz NOT NULL DEFAULT now(),
        is_rollbackable boolean NOT NULL DEFAULT true,
        rolled_back_at timestamptz,
        rolled_back_by uuid,
        rollback_to_history_id uuid,
        platform_version varchar(20),
        correlation_id varchar(100)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_config_history_lookup ON config_change_history(tenant_id, config_type, resource_key);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_config_history_time ON config_change_history(changed_at DESC);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_config_history_user ON config_change_history(changed_by);`);

    // ========== Platform Script ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_script (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid,
        code varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        script_type varchar(30) NOT NULL,
        execution_context varchar(30) NOT NULL,
        target_table varchar(100),
        target_field varchar(100),
        script_content text NOT NULL,
        script_language varchar(20) NOT NULL DEFAULT 'javascript',
        execution_order int NOT NULL DEFAULT 100,
        is_async boolean NOT NULL DEFAULT false,
        timeout_ms int NOT NULL DEFAULT 5000,
        condition_expression jsonb,
        source varchar(20) NOT NULL DEFAULT 'tenant',
        platform_version varchar(20),
        is_active boolean NOT NULL DEFAULT true,
        is_system boolean NOT NULL DEFAULT false,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_platform_script UNIQUE (tenant_id, code)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_platform_script_type ON platform_script(script_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_platform_script_table ON platform_script(target_table);`);

    // ========== Script Execution Log ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS script_execution_log (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        script_id uuid NOT NULL REFERENCES platform_script(id) ON DELETE CASCADE,
        tenant_id uuid,
        execution_context jsonb,
        result jsonb,
        error_message text,
        error_stack text,
        execution_time_ms int,
        executed_at timestamptz NOT NULL DEFAULT now(),
        executed_by uuid
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_script_log_script ON script_execution_log(script_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_script_log_time ON script_execution_log(executed_at DESC);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS script_execution_log;`);
    await queryRunner.query(`DROP TABLE IF EXISTS platform_script;`);
    await queryRunner.query(`DROP TABLE IF EXISTS config_change_history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_customization;`);
    await queryRunner.query(`DROP TABLE IF EXISTS platform_config;`);
  }
}
