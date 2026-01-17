import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsightsMetadata1825000000000 implements MigrationInterface {
  name = 'InsightsMetadata1825000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS metric_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        source_type VARCHAR(40) NOT NULL,
        source_config JSONB DEFAULT '{}',
        aggregation VARCHAR(20) NOT NULL,
        cadence VARCHAR(20) NOT NULL,
        retention_days INT DEFAULT 90,
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS metric_points (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_code VARCHAR(100) NOT NULL,
        period_start TIMESTAMPTZ NOT NULL,
        period_end TIMESTAMPTZ NOT NULL,
        value NUMERIC(18,4) NOT NULL,
        dimensions JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_metric_points_code_start
        ON metric_points (metric_code, period_start)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dashboard_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(120) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        layout JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS alert_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(120) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        conditions JSONB DEFAULT '{}',
        actions JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS alert_definitions`);
    await queryRunner.query(`DROP TABLE IF EXISTS dashboard_definitions`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_metric_points_code_start`);
    await queryRunner.query(`DROP TABLE IF EXISTS metric_points`);
    await queryRunner.query(`DROP TABLE IF EXISTS metric_definitions`);
  }
}
