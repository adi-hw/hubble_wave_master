import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 0 Slice C4 — fan `application_id` (ADR-6 explicit scoping) out
 * to the remaining metadata entities that didn't already carry it:
 *
 *   - view_definitions (resolves Application via target_collection_code)
 *   - widget_catalog   (no collection link — backfilled to default)
 *   - navigation_modules (no collection link — backfilled to default)
 *
 * The lifecycle plumbing for these entities was built before the rest
 * of ADR-5 (ApplicationRevision was modeled on ViewDefinitionRevision),
 * so this migration is purely about adding the FK column and tightening
 * NOT NULL after backfill. No new revision tables — those already exist.
 */
export class ApplicationIdFanout1834300000000 implements MigrationInterface {
  name = 'ApplicationIdFanout1834300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const defaultRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM applications WHERE code = 'default' LIMIT 1`,
    );
    const defaultId = defaultRows[0]?.id;
    if (!defaultId) {
      throw new Error(
        'Backfill failed: default Application row missing — run applications-registry first.',
      );
    }

    // ------------------------------------------------------------------
    // 1. view_definitions
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE view_definitions
        ADD COLUMN IF NOT EXISTS application_id uuid
    `);
    // Backfill from the target collection's applicationId where possible.
    // target_collection_code is a code, not an FK — join on code.
    await queryRunner.query(`
      UPDATE view_definitions v
         SET application_id = c.application_id
        FROM collection_definitions c
       WHERE v.target_collection_code = c.code
         AND v.application_id IS NULL
    `);
    // Anything still null (system views, dashboards, etc.) rolls into default.
    await queryRunner.query(
      `UPDATE view_definitions SET application_id = $1 WHERE application_id IS NULL`,
      [defaultId],
    );
    await queryRunner.query(`
      ALTER TABLE view_definitions
        ADD CONSTRAINT fk_view_definitions_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `ALTER TABLE view_definitions ALTER COLUMN application_id SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_view_definitions_application_id ON view_definitions(application_id);`,
    );

    // ------------------------------------------------------------------
    // 2. widget_catalog
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE widget_catalog
        ADD COLUMN IF NOT EXISTS application_id uuid
    `);
    await queryRunner.query(
      `UPDATE widget_catalog SET application_id = $1 WHERE application_id IS NULL`,
      [defaultId],
    );
    await queryRunner.query(`
      ALTER TABLE widget_catalog
        ADD CONSTRAINT fk_widget_catalog_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `ALTER TABLE widget_catalog ALTER COLUMN application_id SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_widget_catalog_application_id ON widget_catalog(application_id);`,
    );

    // ------------------------------------------------------------------
    // 3. navigation_modules
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE navigation_modules
        ADD COLUMN IF NOT EXISTS application_id uuid
    `);
    await queryRunner.query(
      `UPDATE navigation_modules SET application_id = $1 WHERE application_id IS NULL`,
      [defaultId],
    );
    await queryRunner.query(`
      ALTER TABLE navigation_modules
        ADD CONSTRAINT fk_navigation_modules_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `ALTER TABLE navigation_modules ALTER COLUMN application_id SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_navigation_modules_application_id ON navigation_modules(application_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // navigation_modules
    await queryRunner.query(`DROP INDEX IF EXISTS idx_navigation_modules_application_id;`);
    await queryRunner.query(
      `ALTER TABLE navigation_modules ALTER COLUMN application_id DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE navigation_modules DROP CONSTRAINT IF EXISTS fk_navigation_modules_application`,
    );
    await queryRunner.query(`
      ALTER TABLE navigation_modules
        DROP COLUMN IF EXISTS application_id
    `);

    // widget_catalog
    await queryRunner.query(`DROP INDEX IF EXISTS idx_widget_catalog_application_id;`);
    await queryRunner.query(
      `ALTER TABLE widget_catalog ALTER COLUMN application_id DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE widget_catalog DROP CONSTRAINT IF EXISTS fk_widget_catalog_application`,
    );
    await queryRunner.query(`
      ALTER TABLE widget_catalog
        DROP COLUMN IF EXISTS application_id
    `);

    // view_definitions
    await queryRunner.query(`DROP INDEX IF EXISTS idx_view_definitions_application_id;`);
    await queryRunner.query(
      `ALTER TABLE view_definitions ALTER COLUMN application_id DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE view_definitions DROP CONSTRAINT IF EXISTS fk_view_definitions_application`,
    );
    await queryRunner.query(`
      ALTER TABLE view_definitions
        DROP COLUMN IF EXISTS application_id
    `);
  }
}
