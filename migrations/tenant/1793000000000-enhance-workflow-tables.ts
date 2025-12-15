import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Enhance Workflow Tables
 *
 * Adds missing columns to workflow_definitions and workflow_runs tables
 * to match the TypeORM entity definitions.
 */
export class EnhanceWorkflowTables1793000000000 implements MigrationInterface {
  name = 'EnhanceWorkflowTables1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== workflow_definitions enhancements ==========
    await queryRunner.query(`
      ALTER TABLE workflow_definitions
        ADD COLUMN IF NOT EXISTS tenant_id uuid,
        ADD COLUMN IF NOT EXISTS code varchar(100),
        ADD COLUMN IF NOT EXISTS category varchar(50),
        ADD COLUMN IF NOT EXISTS canvas_layout jsonb,
        ADD COLUMN IF NOT EXISTS input_schema jsonb,
        ADD COLUMN IF NOT EXISTS variables jsonb,
        ADD COLUMN IF NOT EXISTS output_mapping jsonb,
        ADD COLUMN IF NOT EXISTS execution_mode varchar(20) DEFAULT 'async',
        ADD COLUMN IF NOT EXISTS timeout_minutes int DEFAULT 60,
        ADD COLUMN IF NOT EXISTS retry_config jsonb,
        ADD COLUMN IF NOT EXISTS error_handling varchar(30) DEFAULT 'stop',
        ADD COLUMN IF NOT EXISTS source varchar(20) DEFAULT 'tenant',
        ADD COLUMN IF NOT EXISTS platform_version varchar(20),
        ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS created_by uuid,
        ADD COLUMN IF NOT EXISTS updated_by uuid
    `);

    // Create indexes for workflow_definitions
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant_code
        ON workflow_definitions(tenant_id, code)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant_active
        ON workflow_definitions(tenant_id, is_active)
    `);

    // ========== workflow_runs enhancements ==========
    await queryRunner.query(`
      ALTER TABLE workflow_runs
        ADD COLUMN IF NOT EXISTS tenant_id uuid,
        ADD COLUMN IF NOT EXISTS trigger_type varchar(30),
        ADD COLUMN IF NOT EXISTS trigger_source jsonb,
        ADD COLUMN IF NOT EXISTS triggered_by uuid,
        ADD COLUMN IF NOT EXISTS current_step_id varchar(100),
        ADD COLUMN IF NOT EXISTS execution_path jsonb,
        ADD COLUMN IF NOT EXISTS input_data jsonb,
        ADD COLUMN IF NOT EXISTS context_data jsonb,
        ADD COLUMN IF NOT EXISTS output_data jsonb,
        ADD COLUMN IF NOT EXISTS error_message text,
        ADD COLUMN IF NOT EXISTS error_step_id varchar(100),
        ADD COLUMN IF NOT EXISTS error_details jsonb,
        ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
        ADD COLUMN IF NOT EXISTS correlation_id varchar(100),
        ADD COLUMN IF NOT EXISTS parent_run_id uuid,
        ADD COLUMN IF NOT EXISTS completed_at timestamptz,
        ADD COLUMN IF NOT EXISTS estimated_completion_at timestamptz
    `);

    // Create indexes for workflow_runs
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant_status
        ON workflow_runs(tenant_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id
        ON workflow_runs(workflow_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_correlation_id
        ON workflow_runs(correlation_id)
    `);

    // Add foreign key for parent_run_id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_workflow_runs_parent'
          AND table_name = 'workflow_runs'
        ) THEN
          ALTER TABLE workflow_runs
            ADD CONSTRAINT fk_workflow_runs_parent
            FOREIGN KEY (parent_run_id) REFERENCES workflow_runs(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // ========== workflow_step_execution enhancements ==========
    // Ensure the table exists first (it should from previous migration)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workflow_step_execution (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        run_id uuid NOT NULL,
        step_id varchar(100) NOT NULL,
        step_type varchar(50) NOT NULL,
        status varchar(30) NOT NULL DEFAULT 'pending',
        input_data jsonb,
        output_data jsonb,
        error_message text,
        started_at timestamptz,
        completed_at timestamptz,
        duration_ms int,
        external_reference varchar(255),
        waiting_for jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_step_execution_run
        ON workflow_step_execution(run_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove workflow_runs enhancements
    await queryRunner.query(`
      ALTER TABLE workflow_runs
        DROP COLUMN IF EXISTS tenant_id,
        DROP COLUMN IF EXISTS trigger_type,
        DROP COLUMN IF EXISTS trigger_source,
        DROP COLUMN IF EXISTS triggered_by,
        DROP COLUMN IF EXISTS current_step_id,
        DROP COLUMN IF EXISTS execution_path,
        DROP COLUMN IF EXISTS input_data,
        DROP COLUMN IF EXISTS context_data,
        DROP COLUMN IF EXISTS output_data,
        DROP COLUMN IF EXISTS error_message,
        DROP COLUMN IF EXISTS error_step_id,
        DROP COLUMN IF EXISTS error_details,
        DROP COLUMN IF EXISTS retry_count,
        DROP COLUMN IF EXISTS correlation_id,
        DROP COLUMN IF EXISTS parent_run_id,
        DROP COLUMN IF EXISTS completed_at,
        DROP COLUMN IF EXISTS estimated_completion_at
    `);

    // Remove workflow_definitions enhancements
    await queryRunner.query(`
      ALTER TABLE workflow_definitions
        DROP COLUMN IF EXISTS tenant_id,
        DROP COLUMN IF EXISTS code,
        DROP COLUMN IF EXISTS category,
        DROP COLUMN IF EXISTS canvas_layout,
        DROP COLUMN IF EXISTS input_schema,
        DROP COLUMN IF EXISTS variables,
        DROP COLUMN IF EXISTS output_mapping,
        DROP COLUMN IF EXISTS execution_mode,
        DROP COLUMN IF EXISTS timeout_minutes,
        DROP COLUMN IF EXISTS retry_config,
        DROP COLUMN IF EXISTS error_handling,
        DROP COLUMN IF EXISTS source,
        DROP COLUMN IF EXISTS platform_version,
        DROP COLUMN IF EXISTS is_active,
        DROP COLUMN IF EXISTS is_system,
        DROP COLUMN IF EXISTS created_by,
        DROP COLUMN IF EXISTS updated_by
    `);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_workflow_definitions_tenant_code`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_workflow_definitions_tenant_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_workflow_runs_tenant_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_workflow_runs_workflow_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_workflow_runs_correlation_id`);
  }
}
