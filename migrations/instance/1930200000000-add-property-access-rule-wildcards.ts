import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wildcard field rules — canon §28.2 levels 3-4.
 *
 * F006 (migration 1930100000000-add-rule-effect.ts) introduced explicit
 * field-rule deny/allow at levels 1-2. This migration extends the
 * `property_access_rules` table with the wildcard layer: a rule that
 * applies to EVERY field of a given collection rather than a specific
 * property.
 *
 * Schema shape:
 *   - `property_id` becomes nullable (was NOT NULL since the table was
 *     created). A wildcard rule has `property_id IS NULL`.
 *   - `wildcard_collection_id` is added (nullable uuid FK to
 *     `collection_definitions(id)` ON DELETE CASCADE). An explicit-field
 *     rule has `wildcard_collection_id IS NULL`.
 *   - A CHECK constraint enforces XOR: exactly one of the two columns
 *     must be NOT NULL. This is the hard schema guarantee — the canonical
 *     model is "explicit OR wildcard, never both, never neither".
 *   - An index on `wildcard_collection_id` supports the new SQL path in
 *     `PropertyAclRepository.findByCollectionProperties` which OR's
 *     `property_id = ANY(...) OR wildcard_collection_id = :collectionId`.
 *
 * Greenfield platform — pre-existing rows all have `property_id NOT NULL`
 * and so remain valid under the new constraint without backfill.
 */
export class AddPropertyAccessRuleWildcards1930200000000 implements MigrationInterface {
  name = 'AddPropertyAccessRuleWildcards1930200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Relax NOT NULL on property_id.
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        ALTER COLUMN "property_id" DROP NOT NULL
    `);

    // 2. Add the new wildcard_collection_id column.
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        ADD COLUMN IF NOT EXISTS "wildcard_collection_id" uuid NULL
    `);

    // 3. Foreign key on wildcard_collection_id → collection_definitions(id).
    //    ON DELETE CASCADE matches the explicit `property_id` FK behaviour.
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        DROP CONSTRAINT IF EXISTS "FK_property_access_rules_wildcard_collection_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        ADD CONSTRAINT "FK_property_access_rules_wildcard_collection_id"
        FOREIGN KEY ("wildcard_collection_id")
        REFERENCES "collection_definitions"("id")
        ON DELETE CASCADE
    `);

    // 4. XOR CHECK constraint: exactly one of (property_id,
    //    wildcard_collection_id) is NOT NULL. This is the canonical
    //    schema guarantee — a rule is EITHER explicit OR wildcard.
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        DROP CONSTRAINT IF EXISTS "CHK_property_access_rules_target_xor"
    `);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        ADD CONSTRAINT "CHK_property_access_rules_target_xor"
        CHECK (
          ("property_id" IS NOT NULL AND "wildcard_collection_id" IS NULL) OR
          ("property_id" IS NULL AND "wildcard_collection_id" IS NOT NULL)
        )
    `);

    // 5. Index on wildcard_collection_id. The query path in
    //    PropertyAclRepository.findByCollectionProperties uses
    //    `wildcard_collection_id = :collectionId` as a top-level
    //    disjunct alongside the existing property_id ANY filter.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_property_access_rules_wildcard_collection_id"
      ON "property_access_rules" ("wildcard_collection_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order: drop index, drop CHECK, drop FK, drop column,
    // then restore NOT NULL on property_id. The XOR check enforced
    // exclusivity in the forward direction so every remaining row has
    // either property_id or wildcard_collection_id set. After dropping
    // wildcard rules (cascade or manual prior), all rows have
    // property_id NOT NULL and we can safely re-add the constraint.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_property_access_rules_wildcard_collection_id"`);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        DROP CONSTRAINT IF EXISTS "CHK_property_access_rules_target_xor"
    `);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        DROP CONSTRAINT IF EXISTS "FK_property_access_rules_wildcard_collection_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        DROP COLUMN IF EXISTS "wildcard_collection_id"
    `);
    // Drop any wildcard rows that linger (property_id IS NULL) before
    // restoring NOT NULL so the ALTER does not error on existing data.
    await queryRunner.query(`
      DELETE FROM "property_access_rules" WHERE "property_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "property_access_rules"
        ALTER COLUMN "property_id" SET NOT NULL
    `);
  }
}
