import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 0 Slice C3 — extend ADR-5 (uniform DRAFT / PUBLISHED revisions)
 * to ProcessFlowDefinition and AutomationRule.
 *
 *   process_flow_definitions  gains: application_id, status,
 *                                    current_revision_id, published_at
 *   automation_rules          gains: application_id, status,
 *                                    current_revision_id, published_at
 *
 * Two new revision tables — process_flow_definition_revisions and
 * automation_rule_revisions — record append-only payload snapshots.
 *
 * Backfill strategy: every existing row is treated as `published` (they
 * were already live). application_id is denormalized from the parent
 * collection for AutomationRule (collection_id is NOT NULL there).
 * For ProcessFlowDefinition, collection_id is nullable, so flows
 * without a collection roll into the `default` Application created in
 * Slice A. Each row gets revision 1 (status = published) so runtime
 * resolution via currentRevisionId works the moment the migration
 * completes.
 *
 * The operational `is_active` flag remains untouched; lifecycle status
 * (`status`) and operational on/off (`is_active`) are orthogonal.
 */
export class ProcessFlowAndAutomationRevisions1834200000000
  implements MigrationInterface
{
  name = 'ProcessFlowAndAutomationRevisions1834200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // 1. process_flow_definitions: add columns.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE process_flow_definitions
        ADD COLUMN IF NOT EXISTS application_id uuid,
        ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS current_revision_id uuid,
        ADD COLUMN IF NOT EXISTS published_at timestamptz
    `);
    // Mark every pre-existing flow as published — they were already live.
    await queryRunner.query(`
      UPDATE process_flow_definitions
         SET status = 'published'
       WHERE status = 'draft'
    `);
    // Backfill application_id from the parent collection when bound.
    await queryRunner.query(`
      UPDATE process_flow_definitions f
         SET application_id = c.application_id
        FROM collection_definitions c
       WHERE f.collection_id = c.id
         AND f.application_id IS NULL
    `);
    // Flows without a collection roll into the `default` Application.
    const defaultRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM applications WHERE code = 'default' LIMIT 1`,
    );
    const defaultId = defaultRows[0]?.id;
    if (!defaultId) {
      throw new Error(
        'Backfill failed: default Application row missing — run applications-registry first.',
      );
    }
    await queryRunner.query(
      `UPDATE process_flow_definitions SET application_id = $1 WHERE application_id IS NULL`,
      [defaultId],
    );
    await queryRunner.query(`
      UPDATE process_flow_definitions
         SET published_at = COALESCE(published_at, updated_at, created_at)
       WHERE status = 'published'
    `);
    await queryRunner.query(`
      ALTER TABLE process_flow_definitions
        ADD CONSTRAINT fk_process_flow_definitions_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `ALTER TABLE process_flow_definitions ALTER COLUMN application_id SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_process_flow_definitions_application_id ON process_flow_definitions(application_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_process_flow_definitions_status ON process_flow_definitions(status);`,
    );

    // ------------------------------------------------------------------
    // 2. process_flow_definition_revisions table.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS process_flow_definition_revisions (
        id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        process_flow_id uuid NOT NULL REFERENCES process_flow_definitions(id) ON DELETE CASCADE,
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
      `CREATE INDEX IF NOT EXISTS idx_process_flow_definition_revisions_process_flow_id ON process_flow_definition_revisions(process_flow_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_process_flow_definition_revisions_status ON process_flow_definition_revisions(status);`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_process_flow_definition_revisions_pf_rev ON process_flow_definition_revisions(process_flow_id, revision);`,
    );

    // ------------------------------------------------------------------
    // 3. Backfill: revision 1 (published) per existing flow.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO process_flow_definition_revisions
        (process_flow_id, revision, status, payload, published_by, published_at, created_by, created_at)
      SELECT
        f.id,
        1,
        'published',
        jsonb_build_object(
          'name', f.name,
          'code', f.code,
          'description', f.description,
          'collectionId', f.collection_id,
          'applicationId', f.application_id,
          'version', f.version,
          'isActive', f.is_active,
          'canvas', f.canvas,
          'triggerType', f.trigger_type,
          'triggerConditions', f.trigger_conditions,
          'triggerSchedule', f.trigger_schedule,
          'triggerFilter', f.trigger_filter,
          'runAs', f.run_as,
          'timeoutMinutes', f.timeout_minutes,
          'maxRetries', f.max_retries
        ),
        f.updated_by,
        COALESCE(f.published_at, f.updated_at),
        f.created_by,
        f.created_at
      FROM process_flow_definitions f
      WHERE NOT EXISTS (
        SELECT 1 FROM process_flow_definition_revisions r WHERE r.process_flow_id = f.id
      )
    `);
    await queryRunner.query(`
      UPDATE process_flow_definitions f
         SET current_revision_id = r.id
        FROM process_flow_definition_revisions r
       WHERE r.process_flow_id = f.id
         AND r.revision = 1
         AND f.current_revision_id IS NULL
    `);

    // ------------------------------------------------------------------
    // 4. automation_rules: add columns.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE automation_rules
        ADD COLUMN IF NOT EXISTS application_id uuid,
        ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS current_revision_id uuid,
        ADD COLUMN IF NOT EXISTS published_at timestamptz
    `);
    await queryRunner.query(`
      UPDATE automation_rules
         SET status = 'published'
       WHERE status = 'draft'
    `);
    await queryRunner.query(`
      UPDATE automation_rules a
         SET application_id = c.application_id
        FROM collection_definitions c
       WHERE a.collection_id = c.id
         AND a.application_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE automation_rules
         SET published_at = COALESCE(published_at, updated_at, created_at)
       WHERE status = 'published'
    `);
    await queryRunner.query(`
      ALTER TABLE automation_rules
        ADD CONSTRAINT fk_automation_rules_application
          FOREIGN KEY (application_id) REFERENCES applications(id)
          ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `ALTER TABLE automation_rules ALTER COLUMN application_id SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_automation_rules_application_id ON automation_rules(application_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_automation_rules_status ON automation_rules(status);`,
    );

    // ------------------------------------------------------------------
    // 5. automation_rule_revisions table.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS automation_rule_revisions (
        id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        automation_rule_id  uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
        revision            integer NOT NULL,
        status              varchar(20) NOT NULL,
        payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by          uuid,
        published_by        uuid,
        published_at        timestamptz,
        created_at          timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_automation_rule_revisions_automation_rule_id ON automation_rule_revisions(automation_rule_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_automation_rule_revisions_status ON automation_rule_revisions(status);`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_rule_revisions_ar_rev ON automation_rule_revisions(automation_rule_id, revision);`,
    );

    // ------------------------------------------------------------------
    // 6. Backfill: revision 1 (published) per existing automation rule.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO automation_rule_revisions
        (automation_rule_id, revision, status, payload, published_by, published_at, created_by, created_at)
      SELECT
        a.id,
        1,
        'published',
        jsonb_build_object(
          'name', a.name,
          'description', a.description,
          'collectionId', a.collection_id,
          'applicationId', a.application_id,
          'triggerTiming', a.trigger_timing,
          'triggerOperations', a.trigger_operations,
          'watchProperties', a.watch_properties,
          'conditionType', a.condition_type,
          'condition', a.condition,
          'conditionScript', a.condition_script,
          'actionType', a.action_type,
          'actions', a.actions,
          'script', a.script,
          'abortOnError', a.abort_on_error,
          'executionOrder', a.execution_order,
          'isActive', a.is_active,
          'isSystem', a.is_system,
          'metadata', a.metadata
        ),
        a.updated_by,
        COALESCE(a.published_at, a.updated_at),
        a.created_by,
        a.created_at
      FROM automation_rules a
      WHERE NOT EXISTS (
        SELECT 1 FROM automation_rule_revisions r WHERE r.automation_rule_id = a.id
      )
    `);
    await queryRunner.query(`
      UPDATE automation_rules a
         SET current_revision_id = r.id
        FROM automation_rule_revisions r
       WHERE r.automation_rule_id = a.id
         AND r.revision = 1
         AND a.current_revision_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // automation
    await queryRunner.query(`DROP INDEX IF EXISTS idx_automation_rule_revisions_ar_rev;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_automation_rule_revisions_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_automation_rule_revisions_automation_rule_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS automation_rule_revisions;`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_automation_rules_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_automation_rules_application_id;`);
    await queryRunner.query(
      `ALTER TABLE automation_rules ALTER COLUMN application_id DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS fk_automation_rules_application`,
    );
    await queryRunner.query(`
      ALTER TABLE automation_rules
        DROP COLUMN IF EXISTS published_at,
        DROP COLUMN IF EXISTS current_revision_id,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS application_id
    `);

    // process flow
    await queryRunner.query(`DROP INDEX IF EXISTS idx_process_flow_definition_revisions_pf_rev;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_process_flow_definition_revisions_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_process_flow_definition_revisions_process_flow_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS process_flow_definition_revisions;`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_process_flow_definitions_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_process_flow_definitions_application_id;`);
    await queryRunner.query(
      `ALTER TABLE process_flow_definitions ALTER COLUMN application_id DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE process_flow_definitions DROP CONSTRAINT IF EXISTS fk_process_flow_definitions_application`,
    );
    await queryRunner.query(`
      ALTER TABLE process_flow_definitions
        DROP COLUMN IF EXISTS published_at,
        DROP COLUMN IF EXISTS current_revision_id,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS application_id
    `);
  }
}
