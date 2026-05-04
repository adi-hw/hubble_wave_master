import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 §10.1 — Workspaces (multi-page, ADR-15). Three-table model:
 *
 *   workspace_definitions      — parent
 *   workspace_pages            — child pages (home / list / record / search / analytics / custom)
 *   workspace_variants         — §7 hierarchy overrides (system / instance / role / group / personal)
 *
 * Also seeds `metadata.workspaces.edit` so delegated workspace
 * editors can be granted the slug independently of the platform-admin
 * role. Idempotent — safe to re-run.
 */
export class Workspaces1835100000000 implements MigrationInterface {
  name = 'Workspaces1835100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── workspace_definitions ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workspace_definitions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(120) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        description text NULL,
        application_id uuid NOT NULL,
        default_collection_id uuid NULL,
        theme_code varchar(120) NULL,
        source varchar(64) NOT NULL DEFAULT 'custom',
        status varchar(20) NOT NULL DEFAULT 'draft',
        is_active boolean NOT NULL DEFAULT false,
        published_at timestamptz NULL,
        created_by uuid NULL,
        updated_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_workspace_definitions_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_workspace_definitions_default_collection
          FOREIGN KEY (default_collection_id) REFERENCES collection_definitions(id)
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_workspace_definitions_application ON workspace_definitions(application_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_workspace_definitions_status ON workspace_definitions(status)`,
    );

    // ─── workspace_pages ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workspace_pages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL,
        code varchar(120) NOT NULL,
        name varchar(255) NOT NULL,
        kind varchar(20) NOT NULL,
        position integer NOT NULL DEFAULT 0,
        layout jsonb NOT NULL DEFAULT '[]'::jsonb,
        source varchar(64) NOT NULL DEFAULT 'custom',
        collection_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_workspace_pages_workspace
          FOREIGN KEY (workspace_id) REFERENCES workspace_definitions(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_workspace_pages_collection
          FOREIGN KEY (collection_id) REFERENCES collection_definitions(id)
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_pages_code ON workspace_pages(workspace_id, code)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_workspace_pages_position ON workspace_pages(workspace_id, position)`,
    );

    // ─── workspace_variants ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workspace_variants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL,
        page_id uuid NOT NULL,
        scope varchar(16) NOT NULL,
        scope_ref varchar(255) NULL,
        priority integer NOT NULL DEFAULT 100,
        layout jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_workspace_variants_workspace
          FOREIGN KEY (workspace_id) REFERENCES workspace_definitions(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_workspace_variants_page
          FOREIGN KEY (page_id) REFERENCES workspace_pages(id)
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_workspace_variants_page ON workspace_variants(workspace_id, page_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_workspace_variants_scope ON workspace_variants(scope, scope_ref)`,
    );

    // ─── seed metadata.workspaces.edit ──────────────────────────────
    await queryRunner.query(
      `INSERT INTO permissions (id, code, name, description, category, is_dangerous, is_system, created_at)
       VALUES (uuid_generate_v4(), 'metadata.workspaces.edit', 'Edit Workspaces',
               'Edit Workspace definitions, pages, and variants in App Studio',
               'metadata', false, true, NOW())
       ON CONFLICT (code) DO NOTHING`,
    );

    // Grant to the admin role (idempotent) so existing platform admins
    // keep full surface area without manual role editing.
    const adminRole = await queryRunner.query(
      `SELECT id FROM roles WHERE code = 'admin' LIMIT 1`,
    );
    if (adminRole && adminRole.length > 0) {
      await queryRunner.query(
        `INSERT INTO role_permissions (id, role_id, permission_id, created_at)
         SELECT uuid_generate_v4(), $1, p.id, NOW()
           FROM permissions p
          WHERE p.code = 'metadata.workspaces.edit'
         ON CONFLICT DO NOTHING`,
        [adminRole[0].id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'metadata.workspaces.edit')`,
    );
    await queryRunner.query(
      `DELETE FROM permissions WHERE code = 'metadata.workspaces.edit'`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS workspace_variants`);
    await queryRunner.query(`DROP TABLE IF EXISTS workspace_pages`);
    await queryRunner.query(`DROP TABLE IF EXISTS workspace_definitions`);
  }
}
