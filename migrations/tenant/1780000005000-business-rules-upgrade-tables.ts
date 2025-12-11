import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessRulesUpgradeTables1780000005000 implements MigrationInterface {
  name = 'BusinessRulesUpgradeTables1780000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Business Rule ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS business_rule (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid,
        code varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        target_table varchar(100) NOT NULL,
        rule_type varchar(50) NOT NULL,
        trigger_events varchar(30)[] NOT NULL,
        trigger_fields varchar(100)[],
        condition_expression jsonb,
        action_config jsonb NOT NULL,
        execution_order int NOT NULL DEFAULT 100,
        is_async boolean NOT NULL DEFAULT false,
        halt_on_failure boolean NOT NULL DEFAULT true,
        source varchar(20) NOT NULL DEFAULT 'tenant',
        is_system boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_business_rule UNIQUE (tenant_id, code)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_business_rule_table ON business_rule(target_table, is_active);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_business_rule_type ON business_rule(rule_type);`);

    // ========== Upgrade Manifest ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS upgrade_manifest (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        from_version varchar(20) NOT NULL,
        to_version varchar(20) NOT NULL,
        changes jsonb NOT NULL,
        migration_scripts jsonb,
        breaking_changes jsonb,
        deprecations jsonb,
        release_notes text,
        release_date timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_upgrade_manifest UNIQUE (from_version, to_version)
      );
    `);

    // ========== Tenant Upgrade Impact ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_upgrade_impact (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL,
        upgrade_manifest_id uuid NOT NULL REFERENCES upgrade_manifest(id),
        impact_level varchar(20) NOT NULL,
        affected_customizations jsonb NOT NULL,
        conflicts jsonb,
        auto_mergeable jsonb,
        manual_review_required jsonb,
        resolution_status varchar(30) NOT NULL DEFAULT 'pending',
        resolution_notes text,
        resolved_by uuid,
        resolved_at timestamptz,
        analyzed_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_tenant_upgrade_impact UNIQUE (tenant_id, upgrade_manifest_id)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_impact_tenant ON tenant_upgrade_impact(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upgrade_impact_status ON tenant_upgrade_impact(resolution_status);`);

    // ========== User Layout Preference ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_layout_preference (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        table_code varchar(100) NOT NULL,
        layout_data jsonb NOT NULL,
        based_on_version int,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_layout_preference UNIQUE (user_id, table_code)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_layout_user ON user_layout_preference(user_id);`);

    // ========== Field Protection Rule ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS field_protection_rule (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid,
        table_code varchar(100) NOT NULL,
        field_code varchar(100) NOT NULL,
        protection_level varchar(30) NOT NULL,
        condition jsonb,
        error_message text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_field_protection_table ON field_protection_rule(table_code);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS field_protection_rule;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_layout_preference;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_upgrade_impact;`);
    await queryRunner.query(`DROP TABLE IF EXISTS upgrade_manifest;`);
    await queryRunner.query(`DROP TABLE IF EXISTS business_rule;`);
  }
}
