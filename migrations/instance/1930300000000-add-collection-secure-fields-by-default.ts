import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-collection `secure_fields_by_default` flag — canon §28.2 level 7
 * (the default-deny fallback) via Path A migration mechanic (F005).
 *
 * When `true`, the field-access evaluator returns canRead=false,
 * canWrite=false, maskingStrategy='FULL' for any field on the collection
 * that no explicit or wildcard rule (levels 1-4) matched. When `false`
 * (today's behaviour), the evaluator falls through to the legacy
 * default-allow path: canRead=true, canWrite=!isSystem, mask='NONE'.
 *
 * Default `false` is deliberate. Existing collections must preserve
 * their pre-§28 default-allow behaviour on rollout — flipping the
 * platform default in a single PR would cascade access regressions
 * across every customer pack. Customers opt in per-collection by
 * setting the flag through the metadata API.
 */
export class AddCollectionSecureFieldsByDefault1930300000000 implements MigrationInterface {
  name = 'AddCollectionSecureFieldsByDefault1930300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "collection_definitions"
        ADD COLUMN IF NOT EXISTS "secure_fields_by_default" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "collection_definitions"
        DROP COLUMN IF EXISTS "secure_fields_by_default"
    `);
  }
}
