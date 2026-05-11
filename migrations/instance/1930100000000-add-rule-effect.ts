import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * F006 — Add `effect` column to access-rule tables.
 *
 * Canon §28.2/§28.3 require both `allow` and `deny` rule effects so the
 * evaluator can implement the deny-wins precedence matrix. Prior to this
 * migration every persisted rule was implicitly an `allow`; the evaluator's
 * UNION-of-allows semantics had no way to express "this principal must NOT
 * see records matching condition X" except by carefully sequencing positive
 * grants — which is fragile and silently fails open when a new role grants
 * an overlap.
 *
 * Forward-only. Backfills every existing row to `'allow'` so the runtime
 * behaviour matches the pre-§28 contract until customers author deny rules.
 * A CHECK constraint enforces the closed set at the SQL layer so the
 * evaluator can rely on `effect` being one of `'allow' | 'deny'` without
 * a defensive switch.
 *
 * Greenfield platform — no rollback path beyond the explicit down() that
 * drops the column.
 */
export class AddRuleEffect1930100000000 implements MigrationInterface {
  name = 'AddRuleEffect1930100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "collection_access_rules"
        ADD COLUMN IF NOT EXISTS "effect" varchar(10) NOT NULL DEFAULT 'allow'
    `);
    await queryRunner.query(`
      ALTER TABLE "collection_access_rules"
        DROP CONSTRAINT IF EXISTS "CHK_collection_access_rules_effect"
    `);
    await queryRunner.query(`
      ALTER TABLE "collection_access_rules"
        ADD CONSTRAINT "CHK_collection_access_rules_effect"
        CHECK ("effect" IN ('allow', 'deny'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collection_access_rules_effect"
      ON "collection_access_rules" ("collection_id", "effect")
    `);

    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        ADD COLUMN IF NOT EXISTS "effect" varchar(10) NOT NULL DEFAULT 'allow'
    `);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        DROP CONSTRAINT IF EXISTS "CHK_property_access_rules_effect"
    `);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        ADD CONSTRAINT "CHK_property_access_rules_effect"
        CHECK ("effect" IN ('allow', 'deny'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_property_access_rules_effect"
      ON "property_access_rules" ("property_id", "effect")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_property_access_rules_effect"`);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        DROP CONSTRAINT IF EXISTS "CHK_property_access_rules_effect"
    `);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        DROP COLUMN IF EXISTS "effect"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_collection_access_rules_effect"`);
    await queryRunner.query(`
      ALTER TABLE "collection_access_rules"
        DROP CONSTRAINT IF EXISTS "CHK_collection_access_rules_effect"
    `);
    await queryRunner.query(`
      ALTER TABLE "collection_access_rules"
        DROP COLUMN IF EXISTS "effect"
    `);
  }
}
