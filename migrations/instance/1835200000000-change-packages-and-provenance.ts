import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6 §11.1 / §11.2 — Change Packages + ADR-7 provenance.
 *
 * 1. `change_packages` table for tracking metadata changes destined
 *    for export/import between instances.
 * 2. `metadata.change-packages.edit` permission slug.
 * 3. `source` provenance column added to every metadata table that
 *    didn't already have it (Application + workspaces did). The
 *    column defaults to 'custom' so existing rows are correctly
 *    classified — pack-installed rows get rewritten to
 *    `source = pack:<id>` by the pack-install pipeline.
 *
 * Idempotent — the IF NOT EXISTS clauses make this safe to re-run
 * during the dev rebuild loop and during pre-production verification.
 */
export class ChangePackagesAndProvenance1835200000000 implements MigrationInterface {
  name = 'ChangePackagesAndProvenance1835200000000';

  private readonly provenanceTables: ReadonlyArray<string> = [
    'collection_definitions',
    'property_definitions',
    'view_definitions',
    'form_definitions',
    'process_flow_definitions',
    'automation_rules',
    'decision_tables',
    'guided_processes',
    'display_rules',
    'connectors',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── change_packages ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS change_packages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(120) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        description text NULL,
        application_id uuid NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'open',
        changes jsonb NOT NULL DEFAULT '[]'::jsonb,
        completed_at timestamptz NULL,
        applied_at timestamptz NULL,
        source_instance_id varchar(120) NULL,
        created_by uuid NULL,
        updated_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_change_packages_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_change_packages_application ON change_packages(application_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_change_packages_status ON change_packages(status)`,
    );

    // ─── metadata.change-packages.edit permission ───────────────────
    await queryRunner.query(
      `INSERT INTO permissions (id, code, name, description, category, is_dangerous, is_system, created_at)
       VALUES (uuid_generate_v4(), 'metadata.change-packages.edit',
               'Edit Change Packages',
               'Create, edit, complete, and apply Change Packages in App Studio',
               'metadata', false, true, NOW())
       ON CONFLICT (code) DO NOTHING`,
    );

    const adminRole = await queryRunner.query(
      `SELECT id FROM roles WHERE code = 'admin' LIMIT 1`,
    );
    if (adminRole && adminRole.length > 0) {
      await queryRunner.query(
        `INSERT INTO role_permissions (id, role_id, permission_id, created_at)
         SELECT uuid_generate_v4(), $1, p.id, NOW()
           FROM permissions p
          WHERE p.code = 'metadata.change-packages.edit'
         ON CONFLICT DO NOTHING`,
        [adminRole[0].id],
      );
    }

    // ─── ADR-7 source provenance columns ────────────────────────────
    for (const table of this.provenanceTables) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS ${table}
           ADD COLUMN IF NOT EXISTS source varchar(120) NOT NULL DEFAULT 'custom'`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_${table}_source ON ${table}(source)`,
      );
    }

    // Backfill `source` from any pack ownership marker the rows
    // already carry on their `metadata` column. Without this
    // backfill, pack-installed rows would default to `source='custom'`
    // and the strict ownership check in `metadata-ingest.service.ts`
    // would refuse to upgrade them on the next pack release. Tables
    // without a `metadata` column are skipped (they have no
    // pre-existing ownership signal).
    const tablesWithMetadata: ReadonlyArray<string> = [
      'collection_definitions',
      'property_definitions',
    ];
    for (const table of tablesWithMetadata) {
      await queryRunner.query(
        `UPDATE ${table}
            SET source = 'pack:' || (metadata->'pack'->>'code')
          WHERE source = 'custom'
            AND metadata ? 'pack'
            AND metadata->'pack'->>'code' IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.provenanceTables) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS ${table} DROP COLUMN IF EXISTS source`,
      );
    }
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'metadata.change-packages.edit')`,
    );
    await queryRunner.query(
      `DELETE FROM permissions WHERE code = 'metadata.change-packages.edit'`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS change_packages`);
  }
}
