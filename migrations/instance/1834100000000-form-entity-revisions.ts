import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 0 Slice C2 — extend ADR-5 (uniform DRAFT / PUBLISHED revisions)
 * to FormDefinition / FormVersion.
 *
 *   form_definitions gains: application_id, status, current_version_id,
 *                           published_at
 *   form_versions   gains: status, published_by, published_at
 *
 * Backfill strategy: every existing FormDefinition is treated as
 * `published` (they were already live), application_id is denormalized
 * from the parent collection, and current_version_id points at the
 * highest existing form_version. If a form has no versions yet but
 * carries a layout, we materialise version 1 from the layout so the
 * pointer is non-null. Existing FormVersion rows are stamped as
 * published with publishedAt = createdAt so the read-side sees a
 * coherent snapshot.
 *
 * Note: the legacy form_definitions / form_versions tables use
 * camelCase column names (`createdAt`, `updatedAt`, `isDefault`) —
 * preserve that on lookups. New columns are added in snake_case to
 * match the rest of the canon.
 */
export class FormEntityRevisions1834100000000 implements MigrationInterface {
  name = 'FormEntityRevisions1834100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // 1. form_definitions: add application_id, status, current_version_id, published_at.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE form_definitions
        ADD COLUMN IF NOT EXISTS application_id uuid,
        ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS current_version_id uuid,
        ADD COLUMN IF NOT EXISTS published_at timestamptz
    `);
    // Hydrate status: every pre-existing form was effectively live, so
    // mark them published. New forms created post-migration default to
    // draft because the column default is 'draft'.
    await queryRunner.query(`
      UPDATE form_definitions
         SET status = 'published'
       WHERE status = 'draft'
    `);
    // Backfill application_id from the parent collection.
    await queryRunner.query(`
      UPDATE form_definitions f
         SET application_id = c.application_id
        FROM collection_definitions c
       WHERE f.collection_id = c.id
         AND f.application_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE form_definitions
         SET published_at = COALESCE(published_at, "updatedAt", "createdAt")
       WHERE status = 'published'
    `);
    // Tighten the FK + NOT NULL once every row has a value.
    await queryRunner.query(`
      ALTER TABLE form_definitions
        ADD CONSTRAINT fk_form_definitions_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `ALTER TABLE form_definitions ALTER COLUMN application_id SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_form_definitions_application_id ON form_definitions(application_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_form_definitions_status ON form_definitions(status);`,
    );

    // ------------------------------------------------------------------
    // 2. form_versions: add status, published_by, published_at.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE form_versions
        ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS published_by uuid,
        ADD COLUMN IF NOT EXISTS published_at timestamptz
    `);
    // Existing rows were already in service — mark them published.
    await queryRunner.query(`
      UPDATE form_versions
         SET status = 'published',
             published_at = COALESCE(published_at, "createdAt")
       WHERE status = 'draft'
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_form_versions_status ON form_versions(status);`,
    );

    // ------------------------------------------------------------------
    // 3. Materialise version 1 for every form that has a layout but no
    //    versions yet. Without this, currentVersionId can't be wired.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO form_versions (form_id, version, layout, status, published_at, "createdAt")
      SELECT
        f.id,
        1,
        f.layout,
        'published',
        COALESCE(f."updatedAt", f."createdAt"),
        f."createdAt"
      FROM form_definitions f
      WHERE f.layout IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM form_versions v WHERE v.form_id = f.id
        )
    `);

    // ------------------------------------------------------------------
    // 4. Wire current_version_id to the highest version per form.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      UPDATE form_definitions f
         SET current_version_id = v.id
        FROM (
          SELECT DISTINCT ON (form_id) id, form_id
            FROM form_versions
        ORDER BY form_id, version DESC
        ) v
       WHERE v.form_id = f.id
         AND f.current_version_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // form_versions
    await queryRunner.query(`DROP INDEX IF EXISTS idx_form_versions_status;`);
    await queryRunner.query(`
      ALTER TABLE form_versions
        DROP COLUMN IF EXISTS published_at,
        DROP COLUMN IF EXISTS published_by,
        DROP COLUMN IF EXISTS status
    `);

    // form_definitions
    await queryRunner.query(`DROP INDEX IF EXISTS idx_form_definitions_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_form_definitions_application_id;`);
    await queryRunner.query(
      `ALTER TABLE form_definitions ALTER COLUMN application_id DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE form_definitions DROP CONSTRAINT IF EXISTS fk_form_definitions_application`,
    );
    await queryRunner.query(`
      ALTER TABLE form_definitions
        DROP COLUMN IF EXISTS published_at,
        DROP COLUMN IF EXISTS current_version_id,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS application_id
    `);
  }
}
