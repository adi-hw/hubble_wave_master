import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPropertySecurityColumns1809000000000 implements MigrationInterface {
  name = 'AddPropertySecurityColumns1809000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add sensitive data and security columns to property_definitions
    await queryRunner.query(`
      ALTER TABLE "property_definitions"
      ADD COLUMN IF NOT EXISTS "is_phi" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "property_definitions"
      ADD COLUMN IF NOT EXISTS "is_pii" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "property_definitions"
      ADD COLUMN IF NOT EXISTS "is_sensitive" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "property_definitions"
      ADD COLUMN IF NOT EXISTS "masking_strategy" varchar(20) NOT NULL DEFAULT 'none'
    `);

    await queryRunner.query(`
      ALTER TABLE "property_definitions"
      ADD COLUMN IF NOT EXISTS "mask_value" varchar(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "property_definitions"
      ADD COLUMN IF NOT EXISTS "requires_break_glass" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "property_definitions" DROP COLUMN IF EXISTS "requires_break_glass"`);
    await queryRunner.query(`ALTER TABLE "property_definitions" DROP COLUMN IF EXISTS "mask_value"`);
    await queryRunner.query(`ALTER TABLE "property_definitions" DROP COLUMN IF EXISTS "masking_strategy"`);
    await queryRunner.query(`ALTER TABLE "property_definitions" DROP COLUMN IF EXISTS "is_sensitive"`);
    await queryRunner.query(`ALTER TABLE "property_definitions" DROP COLUMN IF EXISTS "is_pii"`);
    await queryRunner.query(`ALTER TABLE "property_definitions" DROP COLUMN IF EXISTS "is_phi"`);
  }
}
