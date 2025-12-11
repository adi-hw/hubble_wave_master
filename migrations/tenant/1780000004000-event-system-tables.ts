import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventSystemTables1780000004000 implements MigrationInterface {
  name = 'EventSystemTables1780000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Event Definition ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS event_definition (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid,
        code varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        category varchar(50),
        payload_schema jsonb,
        source_type varchar(30) NOT NULL,
        source_config jsonb,
        is_published boolean NOT NULL DEFAULT true,
        retention_days int DEFAULT 30,
        is_system boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_event_definition UNIQUE (tenant_id, code)
      );
    `);

    // Seed system events
    await queryRunner.query(`
      INSERT INTO event_definition (tenant_id, code, name, category, source_type, is_system) VALUES
        (NULL, 'record.created', 'Record Created', 'record', 'table', true),
        (NULL, 'record.updated', 'Record Updated', 'record', 'table', true),
        (NULL, 'record.deleted', 'Record Deleted', 'record', 'table', true),
        (NULL, 'workflow.started', 'Workflow Started', 'workflow', 'workflow', true),
        (NULL, 'workflow.completed', 'Workflow Completed', 'workflow', 'workflow', true),
        (NULL, 'workflow.failed', 'Workflow Failed', 'workflow', 'workflow', true),
        (NULL, 'approval.requested', 'Approval Requested', 'approval', 'approval', true),
        (NULL, 'approval.responded', 'Approval Responded', 'approval', 'approval', true),
        (NULL, 'approval.escalated', 'Approval Escalated', 'approval', 'approval', true),
        (NULL, 'user.login', 'User Login', 'user', 'system', true),
        (NULL, 'user.logout', 'User Logout', 'user', 'system', true),
        (NULL, 'user.created', 'User Created', 'user', 'system', true)
      ON CONFLICT DO NOTHING;
    `);

    // ========== Event Log ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS event_log (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL,
        event_definition_id uuid REFERENCES event_definition(id),
        event_code varchar(100) NOT NULL,
        source_type varchar(30) NOT NULL,
        source_table varchar(100),
        source_record_id uuid,
        source_user_id uuid,
        payload jsonb NOT NULL,
        correlation_id varchar(100),
        causation_id uuid,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        partition_key varchar(50)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_log_code ON event_log(tenant_id, event_code, occurred_at DESC);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_log_source ON event_log(source_table, source_record_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_log_correlation ON event_log(correlation_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_log_time ON event_log(occurred_at DESC);`);

    // ========== Event Subscription ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS event_subscription (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid,
        name varchar(255) NOT NULL,
        description text,
        event_codes varchar(100)[] NOT NULL,
        source_filter jsonb,
        handler_type varchar(30) NOT NULL,
        handler_config jsonb NOT NULL,
        execution_mode varchar(20) NOT NULL DEFAULT 'async',
        batch_config jsonb,
        retry_config jsonb,
        condition_expression jsonb,
        is_active boolean NOT NULL DEFAULT true,
        last_triggered_at timestamptz,
        trigger_count bigint NOT NULL DEFAULT 0,
        error_count bigint NOT NULL DEFAULT 0,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_subscription_active ON event_subscription(is_active) WHERE is_active = true;`);

    // ========== Event Delivery ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS event_delivery (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_log_id uuid NOT NULL REFERENCES event_log(id) ON DELETE CASCADE,
        subscription_id uuid NOT NULL REFERENCES event_subscription(id) ON DELETE CASCADE,
        status varchar(30) NOT NULL DEFAULT 'pending',
        attempt_count int NOT NULL DEFAULT 0,
        last_attempt_at timestamptz,
        delivered_at timestamptz,
        error_message text,
        error_details jsonb,
        handler_response jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_delivery_status ON event_delivery(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_delivery_event ON event_delivery(event_log_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS event_delivery;`);
    await queryRunner.query(`DROP TABLE IF EXISTS event_subscription;`);
    await queryRunner.query(`DROP TABLE IF EXISTS event_log;`);
    await queryRunner.query(`DROP TABLE IF EXISTS event_definition;`);
  }
}
