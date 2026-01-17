import { MigrationInterface, QueryRunner } from 'typeorm';

export class GlobalSettings1821000000000 implements MigrationInterface {
  name = 'GlobalSettings1821000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS total_users int NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_assets int NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS global_settings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        scope varchar(40) NOT NULL DEFAULT 'global',
        platform_name varchar(255) NOT NULL,
        maintenance_mode boolean NOT NULL DEFAULT false,
        public_signup boolean NOT NULL DEFAULT false,
        default_trial_days int NOT NULL DEFAULT 14,
        support_email varchar(320) NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_global_settings_scope ON global_settings(scope);
    `);

    await queryRunner.query(`
      INSERT INTO global_settings (
        scope,
        platform_name,
        maintenance_mode,
        public_signup,
        default_trial_days,
        support_email
      )
      SELECT
        'global',
        'HubbleWave Control Plane',
        false,
        false,
        14,
        'support@hubblewave.com'
      WHERE NOT EXISTS (
        SELECT 1 FROM global_settings WHERE scope = 'global'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_global_settings_scope;`);
    await queryRunner.query(`DROP TABLE IF EXISTS global_settings;`);
    await queryRunner.query(`
      ALTER TABLE customers
      DROP COLUMN IF EXISTS total_users,
      DROP COLUMN IF EXISTS total_assets;
    `);
  }
}
