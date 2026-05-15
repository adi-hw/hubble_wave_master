import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AutomationSchema1940300000000
 *
 * Plan Fix 24 / W9 Phase C — automation domain. Moves rules,
 * scheduled jobs, decision tables, connectors, guided processes,
 * process flows, and SLA tables out of public into a dedicated
 * `automation` schema.
 *
 * Cross-schema reads from svc-data and svc-workflow (they consume
 * automation entities for the in-request executor and workflow
 * runner respectively) work natively in Postgres once both schemas
 * are on the search_path.
 */
export class AutomationSchema1940300000000 implements MigrationInterface {
  name = 'AutomationSchema1940300000000';

  private readonly tables = [
    // automation.entity.ts
    'automation_rules',
    'automation_rule_revisions',
    'scheduled_jobs',
    'automation_execution_logs',
    'client_scripts',
    // process-flow.entity.ts
    'process_flow_definitions',
    'process_flow_instances',
    'process_flow_execution_history',
    'approvals',
    'process_flow_definition_revisions',
    // sla.entity.ts
    'business_hours',
    'sla_definitions',
    'sla_instances',
    'sla_breaches',
    'state_machine_definitions',
    'state_change_history',
    // decision-table.entity.ts
    'decision_tables',
    'decision_table_revisions',
    'decision_inputs',
    'decision_rows',
    // guided-process.entity.ts
    'guided_processes',
    'guided_process_revisions',
    'guided_process_stages',
    'guided_process_activities',
    // connector.entity.ts
    'connectors',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "automation"`);

    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE public."${table}" SET SCHEMA automation';
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'automation'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE automation."${table}" SET SCHEMA public';
          END IF;
        END $$;
      `);
    }
    await queryRunner.query(`DROP SCHEMA IF EXISTS "automation" CASCADE`);
  }
}
