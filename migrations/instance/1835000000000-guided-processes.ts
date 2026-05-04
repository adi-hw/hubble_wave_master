import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 §8.3 — Guided Processes (Playbooks). Three-table model
 * (definition → stages → activities) so runtime can index per-stage
 * progress, query "what stage is record X on?", and surface
 * activities in the audit timeline.
 */
export class GuidedProcesses1835000000000 implements MigrationInterface {
  name = 'GuidedProcesses1835000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS guided_processes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(120) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        description text NULL,
        collection_id uuid NOT NULL,
        application_id uuid NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'draft',
        is_active boolean NOT NULL DEFAULT true,
        current_revision_id uuid NULL,
        published_at timestamptz NULL,
        created_by uuid NULL,
        updated_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_guided_processes_collection
          FOREIGN KEY (collection_id) REFERENCES collection_definitions(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_guided_processes_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_guided_processes_collection ON guided_processes(collection_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_guided_processes_application ON guided_processes(application_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_guided_processes_status ON guided_processes(status)`,
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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS guided_process_stages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        process_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        description text NULL,
        position integer NOT NULL,
        visibility_condition jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_guided_process_stages_process
          FOREIGN KEY (process_id) REFERENCES guided_processes(id)
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_guided_process_stages_position ON guided_process_stages(process_id, position)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS guided_process_activities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        stage_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        description text NULL,
        position integer NOT NULL,
        kind varchar(20) NOT NULL,
        process_flow_code varchar(120) NULL,
        required_condition jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_guided_process_activities_stage
          FOREIGN KEY (stage_id) REFERENCES guided_process_stages(id)
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_guided_process_activities_position ON guided_process_activities(stage_id, position)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS guided_process_activities`);
    await queryRunner.query(`DROP TABLE IF EXISTS guided_process_stages`);
    await queryRunner.query(`DROP TABLE IF EXISTS guided_process_revisions`);
    await queryRunner.query(`DROP TABLE IF EXISTS guided_processes`);
  }
}
