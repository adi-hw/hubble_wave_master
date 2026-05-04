import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Forward-roll migration that brings existing dev/staging databases up
 * to the entity definitions for DecisionTable / GuidedProcessDefinition /
 * Connector after the App Studio code review fixes:
 *
 *  - DecisionTable + GuidedProcessDefinition now follow the full
 *    ADR-5 lifecycle: parent rows carry `current_revision_id` and a
 *    sibling `<entity>_revisions` table holds append-only history.
 *  - Connector now carries the ADR-7 `source` provenance column (and
 *    is included in the `provenanceTables` list in the change-package
 *    migration).
 *
 * The earlier-numbered migrations (1834800, 1834900, 1835000) were
 * edited in place to include these columns/tables for fresh builds —
 * but instances that had already run the earlier versions retain the
 * pre-fix schema. This migration is the forward path for those
 * instances. Idempotent via `IF NOT EXISTS`.
 */
export class FinishDecisionGuidedConnectorSchema1835400000000
  implements MigrationInterface
{
  name = 'FinishDecisionGuidedConnectorSchema1835400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── decision_tables: current_revision_id + revisions table ─────
    await queryRunner.query(
      `ALTER TABLE IF EXISTS decision_tables ADD COLUMN IF NOT EXISTS current_revision_id uuid NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS decision_table_revisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        table_id uuid NOT NULL,
        revision integer NOT NULL,
        status varchar(20) NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by uuid NULL,
        published_by uuid NULL,
        published_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_decision_table_revisions_table
          FOREIGN KEY (table_id) REFERENCES decision_tables(id)
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_decision_table_revisions_table ON decision_table_revisions(table_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_decision_table_revisions_status ON decision_table_revisions(status)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_decision_table_revisions_table_revision ON decision_table_revisions(table_id, revision)`,
    );

    // ── guided_processes: current_revision_id + revisions table ────
    await queryRunner.query(
      `ALTER TABLE IF EXISTS guided_processes ADD COLUMN IF NOT EXISTS current_revision_id uuid NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS guided_process_revisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        process_id uuid NOT NULL,
        revision integer NOT NULL,
        status varchar(20) NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by uuid NULL,
        published_by uuid NULL,
        published_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_guided_process_revisions_process
          FOREIGN KEY (process_id) REFERENCES guided_processes(id)
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_guided_process_revisions_process ON guided_process_revisions(process_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_guided_process_revisions_status ON guided_process_revisions(status)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_guided_process_revisions_process_revision ON guided_process_revisions(process_id, revision)`,
    );

    // ── connectors: source provenance column (ADR-7) ───────────────
    await queryRunner.query(
      `ALTER TABLE IF EXISTS connectors ADD COLUMN IF NOT EXISTS source varchar(120) NOT NULL DEFAULT 'custom'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_connectors_source ON connectors(source)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_connectors_source`);
    await queryRunner.query(`ALTER TABLE IF EXISTS connectors DROP COLUMN IF EXISTS source`);

    await queryRunner.query(`DROP TABLE IF EXISTS guided_process_revisions`);
    await queryRunner.query(
      `ALTER TABLE IF EXISTS guided_processes DROP COLUMN IF EXISTS current_revision_id`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS decision_table_revisions`);
    await queryRunner.query(
      `ALTER TABLE IF EXISTS decision_tables DROP COLUMN IF EXISTS current_revision_id`,
    );
  }
}
