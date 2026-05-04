import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 §8.2 — Decision Tables (ADR-14 four-entity model).
 * decision_tables (the spec), decision_inputs (typed input columns),
 * decision_rows (condition rows + answer reference). Answers live in
 * the configurable answerCollection (any Collection); the table
 * doesn't own them.
 */
export class DecisionTables1834900000000 implements MigrationInterface {
  name = 'DecisionTables1834900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS decision_tables (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(120) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        description text NULL,
        collection_id uuid NOT NULL,
        application_id uuid NOT NULL,
        answer_collection_code varchar(120) NULL,
        hit_policy varchar(20) NOT NULL DEFAULT 'first_match',
        status varchar(20) NOT NULL DEFAULT 'draft',
        is_active boolean NOT NULL DEFAULT true,
        current_revision_id uuid NULL,
        published_at timestamptz NULL,
        created_by uuid NULL,
        updated_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_decision_tables_collection
          FOREIGN KEY (collection_id) REFERENCES collection_definitions(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_decision_tables_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_decision_tables_collection ON decision_tables(collection_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_decision_tables_application ON decision_tables(application_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_decision_tables_status ON decision_tables(status)`,
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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS decision_inputs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        table_id uuid NOT NULL,
        name varchar(120) NOT NULL,
        input_type varchar(20) NOT NULL,
        config jsonb NULL,
        default_value jsonb NULL,
        position integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_decision_inputs_table
          FOREIGN KEY (table_id) REFERENCES decision_tables(id)
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_decision_inputs_table_position ON decision_inputs(table_id, position)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS decision_rows (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        table_id uuid NOT NULL,
        position integer NOT NULL,
        conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
        answer_record_id uuid NULL,
        answer_literal jsonb NULL,
        description text NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_decision_rows_table
          FOREIGN KEY (table_id) REFERENCES decision_tables(id)
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_decision_rows_table_position ON decision_rows(table_id, position)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS decision_rows`);
    await queryRunner.query(`DROP TABLE IF EXISTS decision_inputs`);
    await queryRunner.query(`DROP TABLE IF EXISTS decision_table_revisions`);
    await queryRunner.query(`DROP TABLE IF EXISTS decision_tables`);
  }
}
