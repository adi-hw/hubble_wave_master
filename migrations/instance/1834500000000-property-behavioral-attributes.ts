import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 §6.3 — `behavioral_attributes` JSONB column on
 * property_definitions. Stores the typed runtime-hook bag
 * (encrypt_at_rest, audit, mask_in_logs, mobile_visible,
 * formula_cache_strategy). Defaulted to {} so existing rows behave
 * as before until an admin opts in.
 */
export class PropertyBehavioralAttributes1834500000000 implements MigrationInterface {
  name = 'PropertyBehavioralAttributes1834500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE property_definitions
        ADD COLUMN IF NOT EXISTS behavioral_attributes jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_property_def_behavioral_audit
        ON property_definitions((behavioral_attributes->>'audit'))
        WHERE behavioral_attributes->>'audit' = 'true'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_property_def_behavioral_audit`,
    );
    await queryRunner.query(
      `ALTER TABLE property_definitions DROP COLUMN IF EXISTS behavioral_attributes`,
    );
  }
}
