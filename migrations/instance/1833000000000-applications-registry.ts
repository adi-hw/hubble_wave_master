import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 0 Slice A — Application registry.
 *
 * - Creates the `applications` and `application_revisions` tables
 *   (entities in libs/instance-db/.../application.entity.ts).
 * - Adds the foreign key constraint from
 *   `collection_definitions.application_id` to `applications.id`
 *   (the column already existed pre-migration; the FK didn't).
 * - Backfills existing collections to a single `default` Application
 *   so no row violates the NOT-NULL constraint we set after backfill.
 *
 * The Application entity is the pilot surface for ADR-5 (uniform
 * DRAFT / PUBLISHED revisions). Subsequent metadata entities adopt the
 * same pattern in Slice C of Phase 0.
 */
export class ApplicationsRegistry1833000000000 implements MigrationInterface {
  name = 'ApplicationsRegistry1833000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the applications table.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code                 varchar(120) NOT NULL,
        name                 varchar(255) NOT NULL,
        description          text,
        scope                varchar(120),
        source               varchar(120) NOT NULL DEFAULT 'custom',
        status               varchar(20)  NOT NULL DEFAULT 'draft',
        current_revision_id  uuid,
        created_by           uuid,
        updated_by           uuid,
        created_at           timestamptz  NOT NULL DEFAULT now(),
        updated_at           timestamptz  NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_code ON applications(code);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);`,
    );

    // 2. Create the application_revisions table.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS application_revisions (
        id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        application_id  uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        revision        integer NOT NULL,
        status          varchar(20) NOT NULL,
        payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by      uuid,
        published_by    uuid,
        published_at    timestamptz,
        created_at      timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_application_revisions_app_id ON application_revisions(application_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_application_revisions_status ON application_revisions(status);`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_application_revisions_app_rev ON application_revisions(application_id, revision);`,
    );

    // 3. Backfill: ensure at least one Application exists; assign every
    //    existing CollectionDefinition row to it. We seed a published
    //    revision so reads via currentRevisionId work immediately.
    await queryRunner.query(
      `
      INSERT INTO applications (id, code, name, description, status, source, created_at, updated_at)
      VALUES (
        uuid_generate_v4(),
        $1,
        $2,
        $3,
        'published',
        'custom',
        now(),
        now()
      )
      ON CONFLICT (code) DO NOTHING
      `,
      [
        'default',
        'Default Application',
        'Pre-Phase-0 collections were assigned here during Slice A backfill. Customers may rename, split, or replace this Application as part of their App Studio reorganization.',
      ],
    );

    const defaultRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM applications WHERE code = $1 LIMIT 1`,
      ['default'],
    );
    const defaultId = defaultRows[0]?.id;
    if (!defaultId) {
      throw new Error(
        'Backfill failed: default Application row missing after INSERT.',
      );
    }

    await queryRunner.query(
      `
      INSERT INTO application_revisions
        (application_id, revision, status, payload, published_at, created_at)
      VALUES
        ($1, 1, 'published', $2::jsonb, now(), now())
      `,
      [
        defaultId,
        JSON.stringify({
          code: 'default',
          name: 'Default Application',
          description:
            'Initial revision created by ApplicationsRegistry1833000000000 backfill.',
        }),
      ],
    );

    await queryRunner.query(
      `
      UPDATE applications
         SET current_revision_id = (
           SELECT id FROM application_revisions
            WHERE application_id = $1 AND revision = 1
         )
       WHERE id = $1
      `,
      [defaultId],
    );

    // 4. Backfill collection_definitions: anything with a NULL
    //    application_id rolls into the default Application.
    await queryRunner.query(
      `UPDATE collection_definitions SET application_id = $1 WHERE application_id IS NULL`,
      [defaultId],
    );

    // 5. Add the foreign key constraint and tighten the column to NOT
    //    NULL now that every row has a value.
    await queryRunner.query(`
      ALTER TABLE collection_definitions
        ADD CONSTRAINT fk_collection_definitions_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `ALTER TABLE collection_definitions ALTER COLUMN application_id SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_collection_definitions_application_id ON collection_definitions(application_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_collection_definitions_application_id;`,
    );
    await queryRunner.query(
      `ALTER TABLE collection_definitions ALTER COLUMN application_id DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE collection_definitions DROP CONSTRAINT IF EXISTS fk_collection_definitions_application`,
    );
    // Leave the application_id values populated; an operator who
    // genuinely wants to reset them can run an explicit UPDATE. Dropping
    // the FK is enough to make the column nullable for re-migration.

    await queryRunner.query(`DROP INDEX IF EXISTS idx_application_revisions_app_rev;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_application_revisions_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_application_revisions_app_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS application_revisions;`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_applications_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_applications_code;`);
    await queryRunner.query(`DROP TABLE IF EXISTS applications;`);
  }
}
