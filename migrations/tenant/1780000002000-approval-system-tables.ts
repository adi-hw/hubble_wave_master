import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApprovalSystemTables1780000002000 implements MigrationInterface {
  name = 'ApprovalSystemTables1780000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Approval Type ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS approval_type (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid,
        code varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        target_table varchar(100),
        trigger_conditions jsonb,
        approval_mode varchar(30) NOT NULL DEFAULT 'sequential',
        quorum_percentage int,
        hierarchy_levels int,
        approver_config jsonb NOT NULL,
        response_options jsonb NOT NULL DEFAULT '[{"code":"approved","label":"Approve"},{"code":"rejected","label":"Reject"}]',
        require_comments varchar(20) DEFAULT 'on_reject',
        allow_delegate boolean NOT NULL DEFAULT true,
        allow_recall boolean NOT NULL DEFAULT true,
        escalation_config jsonb,
        sla_hours int,
        sla_warning_hours int,
        notification_config jsonb,
        source varchar(20) NOT NULL DEFAULT 'tenant',
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_approval_type UNIQUE (tenant_id, code)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_approval_type_table ON approval_type(target_table);`);

    // ========== Approval Request ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS approval_request (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL,
        approval_type_id uuid NOT NULL REFERENCES approval_type(id),
        target_table varchar(100) NOT NULL,
        target_record_id uuid NOT NULL,
        target_record_snapshot jsonb,
        title varchar(500) NOT NULL,
        description text,
        requested_action varchar(100),
        changes_summary jsonb,
        status varchar(30) NOT NULL DEFAULT 'pending',
        final_response varchar(50),
        final_response_at timestamptz,
        final_responder_id uuid,
        requested_by uuid NOT NULL,
        requested_at timestamptz NOT NULL DEFAULT now(),
        due_at timestamptz,
        escalated_at timestamptz,
        escalation_level int NOT NULL DEFAULT 0,
        workflow_run_id uuid,
        correlation_id varchar(100),
        requestor_comments text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_approval_request_status ON approval_request(tenant_id, status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_approval_request_target ON approval_request(target_table, target_record_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_approval_request_type ON approval_request(approval_type_id);`);

    // ========== Approval Assignment ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS approval_assignment (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        approval_request_id uuid NOT NULL REFERENCES approval_request(id) ON DELETE CASCADE,
        approver_id uuid NOT NULL,
        approver_role varchar(100),
        sequence_order int NOT NULL DEFAULT 0,
        status varchar(30) NOT NULL DEFAULT 'pending',
        response varchar(50),
        response_comments text,
        responded_at timestamptz,
        delegated_to uuid,
        delegated_at timestamptz,
        delegation_reason text,
        notified_at timestamptz,
        first_viewed_at timestamptz,
        reminder_count int NOT NULL DEFAULT 0,
        last_reminder_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_approval_assignment_approver ON approval_assignment(approver_id, status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_approval_assignment_request ON approval_assignment(approval_request_id);`);

    // ========== Approval History ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS approval_history (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        approval_request_id uuid NOT NULL REFERENCES approval_request(id) ON DELETE CASCADE,
        assignment_id uuid REFERENCES approval_assignment(id),
        action varchar(50) NOT NULL,
        action_by uuid,
        action_data jsonb,
        action_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_approval_history_request ON approval_history(approval_request_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS approval_history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS approval_assignment;`);
    await queryRunner.query(`DROP TABLE IF EXISTS approval_request;`);
    await queryRunner.query(`DROP TABLE IF EXISTS approval_type;`);
  }
}
