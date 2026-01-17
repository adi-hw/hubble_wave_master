import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccessPolicyMetadata1820000000000 implements MigrationInterface {
  name = 'AccessPolicyMetadata1820000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "collection_access_rules"
        ADD COLUMN IF NOT EXISTS "rule_key" varchar(120),
        ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collection_access_rules_rule_key"
      ON "collection_access_rules" ("collection_id", "rule_key")
      WHERE "rule_key" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        ADD COLUMN IF NOT EXISTS "masking_strategy" varchar(20) NOT NULL DEFAULT 'NONE',
        ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS "rule_key" varchar(120),
        ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_property_access_rules_rule_key"
      ON "property_access_rules" ("property_id", "rule_key")
      WHERE "rule_key" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_property_access_rules_rule_key"`);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        DROP COLUMN IF EXISTS "metadata",
        DROP COLUMN IF EXISTS "rule_key",
        DROP COLUMN IF EXISTS "updated_at",
        DROP COLUMN IF EXISTS "masking_strategy"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_collection_access_rules_rule_key"`);
    await queryRunner.query(`
      ALTER TABLE "collection_access_rules"
        DROP COLUMN IF EXISTS "metadata",
        DROP COLUMN IF EXISTS "rule_key"
    `);
  }
}
