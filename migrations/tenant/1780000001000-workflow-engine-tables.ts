import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkflowEngineTables1780000001000 implements MigrationInterface {
  name = 'WorkflowEngineTables1780000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Workflow Step Type Registry ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workflow_step_type (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(50) NOT NULL UNIQUE,
        name varchar(100) NOT NULL,
        description text,
        category varchar(50) NOT NULL,
        config_schema jsonb NOT NULL,
        input_schema jsonb,
        output_schema jsonb,
        handler_type varchar(30) NOT NULL,
        handler_reference varchar(255),
        icon varchar(50),
        color varchar(20),
        is_builtin boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Seed builtin step types
    await queryRunner.query(`
      INSERT INTO workflow_step_type (code, name, category, handler_type, config_schema, is_builtin) VALUES
        ('condition', 'Condition', 'control', 'builtin', '{"type":"object","properties":{"expression":{"type":"object"}}}', true),
        ('switch', 'Switch', 'control', 'builtin', '{"type":"object","properties":{"field":{"type":"string"},"cases":{"type":"array"}}}', true),
        ('parallel', 'Parallel Execution', 'control', 'builtin', '{"type":"object","properties":{"branches":{"type":"array"}}}', true),
        ('wait', 'Wait/Delay', 'control', 'builtin', '{"type":"object","properties":{"duration":{"type":"string"}}}', true),
        ('wait_for_event', 'Wait for Event', 'control', 'builtin', '{"type":"object","properties":{"eventType":{"type":"string"}}}', true),
        ('update_record', 'Update Record', 'action', 'builtin', '{"type":"object","properties":{"table":{"type":"string"},"updates":{"type":"object"}}}', true),
        ('create_record', 'Create Record', 'action', 'builtin', '{"type":"object","properties":{"table":{"type":"string"},"data":{"type":"object"}}}', true),
        ('delete_record', 'Delete Record', 'action', 'builtin', '{"type":"object","properties":{"table":{"type":"string"},"recordId":{"type":"string"}}}', true),
        ('run_script', 'Run Script', 'action', 'builtin', '{"type":"object","properties":{"scriptId":{"type":"string"}}}', true),
        ('http_request', 'HTTP Request', 'integration', 'builtin', '{"type":"object","properties":{"url":{"type":"string"},"method":{"type":"string"}}}', true),
        ('send_email', 'Send Email', 'notification', 'builtin', '{"type":"object","properties":{"template":{"type":"string"},"recipients":{"type":"array"}}}', true),
        ('send_notification', 'Send Notification', 'notification', 'builtin', '{"type":"object","properties":{"channel":{"type":"string"},"message":{"type":"string"}}}', true),
        ('create_approval', 'Create Approval', 'approval', 'builtin', '{"type":"object","properties":{"approvalType":{"type":"string"},"approvers":{"type":"array"}}}', true),
        ('create_task', 'Create Task', 'action', 'builtin', '{"type":"object","properties":{"assignee":{"type":"string"},"description":{"type":"string"}}}', true),
        ('log', 'Log Message', 'action', 'builtin', '{"type":"object","properties":{"level":{"type":"string"},"message":{"type":"string"}}}', true),
        ('end', 'End', 'control', 'builtin', '{"type":"object"}', true),
        ('start', 'Start', 'control', 'builtin', '{"type":"object"}', true)
      ON CONFLICT (code) DO NOTHING;
    `);

    // ========== Workflow Step Execution ==========
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
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_step_execution_run ON workflow_step_execution(run_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_step_execution_status ON workflow_step_execution(status);`);

    // Add foreign key after workflow_run exists (from previous migration)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_run') THEN
          ALTER TABLE workflow_step_execution
            DROP CONSTRAINT IF EXISTS fk_step_execution_run,
            ADD CONSTRAINT fk_step_execution_run FOREIGN KEY (run_id) REFERENCES workflow_run(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS workflow_step_execution;`);
    await queryRunner.query(`DROP TABLE IF EXISTS workflow_step_type;`);
  }
}
