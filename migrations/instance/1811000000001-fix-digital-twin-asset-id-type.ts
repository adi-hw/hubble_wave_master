import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDigitalTwinAssetIdType1811000000001 implements MigrationInterface {
  name = 'FixDigitalTwinAssetIdType1811000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change asset_id column type from uuid to varchar(255) in digital_twins
    await queryRunner.query(`
      ALTER TABLE "digital_twins"
      ALTER COLUMN "asset_id" TYPE varchar(255) USING "asset_id"::varchar(255)
    `);

    // Change asset_id column type from uuid to varchar(255) in sensor_readings
    await queryRunner.query(`
      ALTER TABLE "sensor_readings"
      ALTER COLUMN "asset_id" TYPE varchar(255) USING "asset_id"::varchar(255)
    `);

    // Add new columns to digital_twins to match frontend model
    await queryRunner.query(`
      ALTER TABLE "digital_twins"
      ADD COLUMN IF NOT EXISTS "name" varchar(255),
      ADD COLUMN IF NOT EXISTS "description" text,
      ADD COLUMN IF NOT EXISTS "asset_type" varchar(100),
      ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'active'
    `);

    // Make model_url nullable
    await queryRunner.query(`
      ALTER TABLE "digital_twins"
      ALTER COLUMN "model_url" DROP NOT NULL
    `);

    // Set default values for existing rows
    await queryRunner.query(`
      UPDATE "digital_twins"
      SET "name" = COALESCE("name", 'Unnamed Twin'),
          "asset_type" = COALESCE("asset_type", 'generic')
      WHERE "name" IS NULL OR "asset_type" IS NULL
    `);

    // Now make the columns NOT NULL
    await queryRunner.query(`
      ALTER TABLE "digital_twins"
      ALTER COLUMN "name" SET NOT NULL,
      ALTER COLUMN "asset_type" SET NOT NULL
    `);

    // Add index on status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_digital_twins_status" ON "digital_twins" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the status index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_digital_twins_status"`);

    // Remove new columns
    await queryRunner.query(`
      ALTER TABLE "digital_twins"
      DROP COLUMN IF EXISTS "name",
      DROP COLUMN IF EXISTS "description",
      DROP COLUMN IF EXISTS "asset_type",
      DROP COLUMN IF EXISTS "status"
    `);

    // Make model_url required again
    await queryRunner.query(`
      ALTER TABLE "digital_twins"
      ALTER COLUMN "model_url" SET NOT NULL
    `);

    // Revert to uuid type - note: this will fail if non-uuid values exist
    await queryRunner.query(`
      ALTER TABLE "sensor_readings"
      ALTER COLUMN "asset_id" TYPE uuid USING "asset_id"::uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "digital_twins"
      ALTER COLUMN "asset_id" TYPE uuid USING "asset_id"::uuid
    `);
  }
}
