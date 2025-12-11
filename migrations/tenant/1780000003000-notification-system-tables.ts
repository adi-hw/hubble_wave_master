import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationSystemTables1780000003000 implements MigrationInterface {
  name = 'NotificationSystemTables1780000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Notification Channel ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_channel (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid,
        code varchar(50) NOT NULL,
        name varchar(100) NOT NULL,
        channel_type varchar(30) NOT NULL,
        config jsonb NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        is_default boolean NOT NULL DEFAULT false,
        last_test_at timestamptz,
        last_test_status varchar(30),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_notification_channel UNIQUE (tenant_id, code)
      );
    `);

    // ========== Notification Template ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_template (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid,
        code varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        supported_channels varchar(30)[] NOT NULL,
        email_subject varchar(500),
        email_body_html text,
        email_body_text text,
        in_app_title varchar(255),
        in_app_body text,
        sms_body varchar(500),
        push_title varchar(100),
        push_body varchar(255),
        available_variables jsonb,
        source varchar(20) NOT NULL DEFAULT 'tenant',
        is_system boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_notification_template UNIQUE (tenant_id, code)
      );
    `);

    // Seed system templates
    await queryRunner.query(`
      INSERT INTO notification_template (tenant_id, code, name, supported_channels, email_subject, in_app_title, is_system, source) VALUES
        (NULL, 'approval_request', 'Approval Request', '{email,in_app,push}', 'Approval Required: {{record.display_name}}', 'Approval Required', true, 'platform'),
        (NULL, 'approval_response', 'Approval Response', '{email,in_app}', 'Approval {{response}}: {{record.display_name}}', 'Approval {{response}}', true, 'platform'),
        (NULL, 'approval_reminder', 'Approval Reminder', '{email,in_app,push}', 'Reminder: Approval Pending', 'Approval Reminder', true, 'platform'),
        (NULL, 'record_assigned', 'Record Assigned', '{email,in_app}', 'Assigned: {{record.display_name}}', 'New Assignment', true, 'platform'),
        (NULL, 'record_mentioned', 'Mentioned in Record', '{email,in_app}', 'You were mentioned', 'New Mention', true, 'platform'),
        (NULL, 'task_due_soon', 'Task Due Soon', '{email,in_app,push}', 'Task Due: {{record.display_name}}', 'Task Due Soon', true, 'platform'),
        (NULL, 'workflow_failed', 'Workflow Failed', '{email,in_app}', 'Workflow Error: {{workflow.name}}', 'Workflow Error', true, 'platform'),
        (NULL, 'password_reset', 'Password Reset', '{email}', 'Password Reset Request', NULL, true, 'platform'),
        (NULL, 'welcome', 'Welcome Email', '{email}', 'Welcome to {{tenant.name}}', NULL, true, 'platform')
      ON CONFLICT DO NOTHING;
    `);

    // ========== Notification Subscription ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_subscription (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL,
        user_id uuid NOT NULL,
        subscription_type varchar(50) NOT NULL,
        target_table varchar(100),
        target_record_id uuid,
        target_field varchar(100),
        filter_condition jsonb,
        channels varchar(30)[] NOT NULL,
        digest_mode varchar(20) NOT NULL DEFAULT 'immediate',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_notification_subscription UNIQUE (tenant_id, user_id, subscription_type, target_table, target_record_id)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notification_sub_user ON notification_subscription(user_id);`);

    // ========== Notification Delivery ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_delivery (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL,
        trigger_type varchar(50) NOT NULL,
        trigger_reference_id uuid,
        template_id uuid REFERENCES notification_template(id),
        template_code varchar(100),
        recipient_id uuid,
        recipient_email varchar(255),
        recipient_phone varchar(50),
        channel varchar(30) NOT NULL,
        channel_config_id uuid REFERENCES notification_channel(id),
        subject varchar(500),
        body text,
        html_body text,
        context_data jsonb,
        status varchar(30) NOT NULL DEFAULT 'pending',
        scheduled_at timestamptz NOT NULL DEFAULT now(),
        sent_at timestamptz,
        delivered_at timestamptz,
        read_at timestamptz,
        failed_at timestamptz,
        failure_reason text,
        retry_count int NOT NULL DEFAULT 0,
        external_message_id varchar(255),
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notification_delivery_status ON notification_delivery(status, scheduled_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notification_delivery_recipient ON notification_delivery(recipient_id);`);

    // ========== In-App Notification ==========
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS in_app_notification (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL,
        user_id uuid NOT NULL,
        title varchar(255) NOT NULL,
        message text,
        icon varchar(50),
        color varchar(20),
        link_type varchar(30),
        link_table varchar(100),
        link_record_id uuid,
        link_url varchar(500),
        is_read boolean NOT NULL DEFAULT false,
        read_at timestamptz,
        is_archived boolean NOT NULL DEFAULT false,
        archived_at timestamptz,
        group_key varchar(100),
        notification_type varchar(50),
        source_type varchar(30),
        source_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_in_app_notification_user ON in_app_notification(user_id, is_read, created_at DESC);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS in_app_notification;`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_delivery;`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_subscription;`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_template;`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_channel;`);
  }
}
