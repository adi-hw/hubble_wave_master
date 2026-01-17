import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpgradeAssistantTables1813000000000 implements MigrationInterface {
  name = 'UpgradeAssistantTables1813000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // Platform Config - Instance-level configuration
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_config (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        key varchar(100) NOT NULL,
        value text NOT NULL,
        value_type varchar(20) NOT NULL DEFAULT 'string',
        description text,
        is_system boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_config_key ON platform_config(key);`);

    // Seed initial platform version
    await queryRunner.query(`
      INSERT INTO platform_config (key, value, value_type, description, is_system)
      VALUES ('platform_version', '1.0.0', 'string', 'Current platform version', true)
      ON CONFLICT (key) DO NOTHING;
    `);

    // ============================================================
    // Instance Customizations - Track customer customizations
    // Drop existing table with old schema and recreate with correct schema
    // ============================================================
    await queryRunner.query(`DROP TABLE IF EXISTS instance_customizations;`);
    await queryRunner.query(`
      CREATE TABLE instance_customizations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        instance_id varchar(100) NOT NULL DEFAULT 'default-instance',
        config_type varchar(50) NOT NULL,
        resource_key varchar(255) NOT NULL,
        customization_type varchar(20) NOT NULL DEFAULT 'override',
        original_value jsonb,
        custom_value jsonb NOT NULL,
        description text,
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_instance_customizations_instance ON instance_customizations(instance_id);`);
    await queryRunner.query(`CREATE INDEX idx_instance_customizations_type ON instance_customizations(config_type);`);
    await queryRunner.query(`CREATE INDEX idx_instance_customizations_active ON instance_customizations(is_active);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_instance_customizations_unique ON instance_customizations(instance_id, config_type, resource_key);`);

    // ============================================================
    // Upgrade Manifest - Available platform upgrades
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS upgrade_manifest (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        version varchar(50) NOT NULL,
        release_date date NOT NULL,
        release_notes text,
        breaking_changes jsonb DEFAULT '[]',
        new_features jsonb DEFAULT '[]',
        deprecations jsonb DEFAULT '[]',
        migrations jsonb DEFAULT '[]',
        min_required_version varchar(50),
        is_available boolean NOT NULL DEFAULT true,
        is_mandatory boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_upgrade_manifest_version ON upgrade_manifest(version);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_manifest_available ON upgrade_manifest(is_available);`);

    // ============================================================
    // Instance Upgrade Impact - Impact analysis per instance
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS instance_upgrade_impact (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        instance_id varchar(100) NOT NULL DEFAULT 'default-instance',
        upgrade_manifest_id uuid REFERENCES upgrade_manifest(id) ON DELETE CASCADE,
        config_type varchar(50) NOT NULL,
        resource_key varchar(255) NOT NULL,
        impact_type varchar(50) NOT NULL,
        impact_severity varchar(20) NOT NULL DEFAULT 'low',
        description text,
        current_instance_value jsonb,
        new_platform_value jsonb,
        suggested_resolution text,
        status varchar(30) NOT NULL DEFAULT 'pending_analysis',
        resolved_by uuid,
        resolved_at timestamptz,
        resolution_notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_impact_instance ON instance_upgrade_impact(instance_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_impact_manifest ON instance_upgrade_impact(upgrade_manifest_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_impact_status ON instance_upgrade_impact(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_impact_severity ON instance_upgrade_impact(impact_severity);`);

    // ============================================================
    // Upgrade History - Track completed upgrades
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS upgrade_history (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        instance_id varchar(100) NOT NULL DEFAULT 'default-instance',
        from_version varchar(50) NOT NULL,
        to_version varchar(50) NOT NULL,
        upgrade_manifest_id uuid REFERENCES upgrade_manifest(id),
        status varchar(30) NOT NULL DEFAULT 'in_progress',
        started_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        rollback_at timestamptz,
        initiated_by uuid,
        rollback_by uuid,
        execution_log jsonb DEFAULT '[]',
        error_message text,
        impacts_resolved int NOT NULL DEFAULT 0,
        impacts_auto_merged int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_history_instance ON upgrade_history(instance_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_history_status ON upgrade_history(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_history_completed ON upgrade_history(completed_at);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS upgrade_history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS instance_upgrade_impact;`);
    await queryRunner.query(`DROP TABLE IF EXISTS upgrade_manifest;`);
    await queryRunner.query(`DROP TABLE IF EXISTS instance_customizations;`);
    await queryRunner.query(`DROP TABLE IF EXISTS platform_config;`);
  }
}
