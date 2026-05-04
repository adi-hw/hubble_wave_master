import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsightsScopedAccess1831100000000 implements MigrationInterface {
  name = 'InsightsScopedAccess1831100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "dashboard_definitions"
        ADD COLUMN IF NOT EXISTS "scope" varchar(20) NOT NULL DEFAULT 'tenant'
    `);
    await queryRunner.query(`
      ALTER TABLE "dashboard_definitions"
        ADD CONSTRAINT "CHK_dashboard_definitions_scope"
        CHECK ("scope" IN ('system', 'tenant', 'role', 'personal'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dashboard_definitions_scope"
        ON "dashboard_definitions" ("scope")
    `);
    await queryRunner.query(`
      ALTER TABLE "metric_definitions"
        ADD COLUMN IF NOT EXISTS "definition_owner_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_metric_definitions_owner"
        ON "metric_definitions" ("definition_owner_id")
        WHERE "definition_owner_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_metric_definitions_owner"`);
    await queryRunner.query(`
      ALTER TABLE "metric_definitions"
        DROP COLUMN IF EXISTS "definition_owner_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dashboard_definitions_scope"`);
    await queryRunner.query(`
      ALTER TABLE "dashboard_definitions"
        DROP CONSTRAINT IF EXISTS "CHK_dashboard_definitions_scope"
    `);
    await queryRunner.query(`
      ALTER TABLE "dashboard_definitions"
        DROP COLUMN IF EXISTS "scope"
    `);
  }
}
