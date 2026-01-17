import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDigitalTwinsSchema1815000000000 implements MigrationInterface {
  name = 'FixDigitalTwinsSchema1815000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add missing columns to digital_twins table to match the entity definition

    // Check and add 'name' column
    const hasName = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'digital_twins'
          AND column_name = 'name'
      )
    `);

    if (!hasName[0]?.exists) {
      await queryRunner.query(`
        ALTER TABLE "digital_twins"
        ADD COLUMN "name" varchar(255)
      `);

      // Populate name from asset_id for existing rows
      await queryRunner.query(`
        UPDATE "digital_twins"
        SET "name" = 'Twin-' || LEFT(asset_id::text, 8)
        WHERE "name" IS NULL
      `);

      // Make name NOT NULL after populating
      await queryRunner.query(`
        ALTER TABLE "digital_twins"
        ALTER COLUMN "name" SET NOT NULL
      `);
    }

    // Check and add 'description' column
    const hasDescription = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'digital_twins'
          AND column_name = 'description'
      )
    `);

    if (!hasDescription[0]?.exists) {
      await queryRunner.query(`
        ALTER TABLE "digital_twins"
        ADD COLUMN "description" text
      `);
    }

    // Check and add 'asset_type' column
    const hasAssetType = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'digital_twins'
          AND column_name = 'asset_type'
      )
    `);

    if (!hasAssetType[0]?.exists) {
      await queryRunner.query(`
        ALTER TABLE "digital_twins"
        ADD COLUMN "asset_type" varchar(100) DEFAULT 'generic'
      `);

      await queryRunner.query(`
        UPDATE "digital_twins"
        SET "asset_type" = 'generic'
        WHERE "asset_type" IS NULL
      `);

      await queryRunner.query(`
        ALTER TABLE "digital_twins"
        ALTER COLUMN "asset_type" SET NOT NULL
      `);
    }

    // Check and add 'status' column
    const hasStatus = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'digital_twins'
          AND column_name = 'status'
      )
    `);

    if (!hasStatus[0]?.exists) {
      await queryRunner.query(`
        ALTER TABLE "digital_twins"
        ADD COLUMN "status" varchar(20) DEFAULT 'active'
      `);
    }

    console.log('Fixed digital_twins schema - added missing columns');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the columns added by this migration
    await queryRunner.query(`
      ALTER TABLE "digital_twins"
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "asset_type",
      DROP COLUMN IF EXISTS "description",
      DROP COLUMN IF EXISTS "name"
    `);
  }
}
