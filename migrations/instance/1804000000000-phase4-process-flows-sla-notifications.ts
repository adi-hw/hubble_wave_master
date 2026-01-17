/**
 * Phase 4: Process Flows, SLA Management & Multi-Channel Notifications
 * HubbleWave Platform
 *
 * This migration creates tables for:
 * - Process flow definitions and instances
 * - State machine configurations
 * - SLA definitions and tracking
 * - Multi-channel notification system
 * - Business hours calendars
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4ProcessFlowsSlaNotifications1804000000000 implements MigrationInterface {
  name = 'Phase4ProcessFlowsSlaNotifications1804000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════════════════════════════════════════════════════════════
    // BUSINESS HOURS CALENDAR
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS business_hours (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',

        -- Weekly schedule: { "monday": { "start": "09:00", "end": "17:00" }, ... }
        schedule JSONB NOT NULL DEFAULT '{
          "monday": { "start": "09:00", "end": "17:00" },
          "tuesday": { "start": "09:00", "end": "17:00" },
          "wednesday": { "start": "09:00", "end": "17:00" },
          "thursday": { "start": "09:00", "end": "17:00" },
          "friday": { "start": "09:00", "end": "17:00" }
        }'::jsonb,

        -- Holidays: [{ "date": "2025-12-25", "name": "Christmas" }, ...]
        holidays JSONB DEFAULT '[]'::jsonb,

        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,

        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by UUID,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // ═══════════════════════════════════════════════════════════════════
    // PROCESS FLOW DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS process_flow_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,

        -- Target collection for this process flow
        collection_id UUID REFERENCES collection_definitions(id),

        -- Version control
        version INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT false,

        -- Visual designer canvas data
        canvas JSONB NOT NULL DEFAULT '{"nodes": [], "connections": []}'::jsonb,

        -- Trigger configuration
        trigger_type VARCHAR(50) NOT NULL DEFAULT 'record_created',
        trigger_conditions JSONB,
        trigger_schedule VARCHAR(100),
        trigger_filter JSONB,

        -- Execution settings
        run_as VARCHAR(50) DEFAULT 'system',
        timeout_minutes INTEGER DEFAULT 60,
        max_retries INTEGER DEFAULT 3,

        -- Statistics
        execution_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_executed_at TIMESTAMP WITH TIME ZONE,

        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by UUID,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        CONSTRAINT chk_trigger_type CHECK (trigger_type IN (
          'record_created', 'record_updated', 'field_changed', 'scheduled', 'manual'
        ))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_process_flow_definitions_collection
        ON process_flow_definitions(collection_id) WHERE is_active = true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_process_flow_definitions_trigger
        ON process_flow_definitions USING gin(trigger_conditions)
    `);

    // ═══════════════════════════════════════════════════════════════════
    // PROCESS FLOW INSTANCES
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS process_flow_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        process_flow_id UUID REFERENCES process_flow_definitions(id) ON DELETE CASCADE,

        -- Target record
        record_id UUID NOT NULL,
        collection_id UUID REFERENCES collection_definitions(id),

        -- Execution state
        state VARCHAR(50) DEFAULT 'running',
        current_node_id VARCHAR(100),

        -- Runtime context (variables, outputs)
        context JSONB DEFAULT '{}'::jsonb,

        -- Error tracking
        error_message TEXT,
        error_stack TEXT,
        retry_count INTEGER DEFAULT 0,

        -- Timing
        started_by UUID,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        duration_ms INTEGER,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        CONSTRAINT chk_instance_state CHECK (state IN (
          'running', 'waiting_approval', 'waiting_condition', 'paused',
          'completed', 'failed', 'cancelled', 'timed_out'
        ))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_process_flow_instances_process_flow
        ON process_flow_instances(process_flow_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_process_flow_instances_record
        ON process_flow_instances(collection_id, record_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_process_flow_instances_state
        ON process_flow_instances(state) WHERE state IN ('running', 'waiting_approval')
    `);

    // ═══════════════════════════════════════════════════════════════════
    // PROCESS FLOW EXECUTION HISTORY
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS process_flow_execution_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID REFERENCES process_flow_instances(id) ON DELETE CASCADE,

        -- Node information
        node_id VARCHAR(100) NOT NULL,
        node_type VARCHAR(50) NOT NULL,
        node_name VARCHAR(255),

        -- Execution details
        action VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,

        -- Input/Output data
        input_data JSONB,
        output_data JSONB,

        -- Error tracking
        error_message TEXT,
        error_stack TEXT,

        -- Performance
        execution_time_ms INTEGER,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        CONSTRAINT chk_history_status CHECK (status IN (
          'started', 'completed', 'failed', 'skipped', 'waiting'
        ))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_process_flow_history_instance
        ON process_flow_execution_history(instance_id, created_at DESC)
    `);

    // ═══════════════════════════════════════════════════════════════════
    // APPROVALS - Handle existing table from workflow migrations
    // ═══════════════════════════════════════════════════════════════════

    // Check if approvals table exists
    const approvalsExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'approvals'
      )
    `);

    if (!approvalsExists[0]?.exists) {
      // Create new approvals table with process_flow_instance_id
      await queryRunner.query(`
        CREATE TABLE approvals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          process_flow_instance_id UUID REFERENCES process_flow_instances(id) ON DELETE CASCADE,

          -- Node that created this approval
          node_id VARCHAR(100) NOT NULL,

          -- Approver assignment
          approver_id UUID NOT NULL,
          approver_type VARCHAR(50) DEFAULT 'user',

          -- Approval status
          status VARCHAR(50) DEFAULT 'pending',
          comments TEXT,

          -- Timing
          due_date TIMESTAMP WITH TIME ZONE,
          responded_at TIMESTAMP WITH TIME ZONE,
          responded_by UUID,

          -- Delegation
          delegated_to UUID,
          delegated_at TIMESTAMP WITH TIME ZONE,
          delegation_reason TEXT,

          -- Metadata
          sequence_number INTEGER DEFAULT 1,
          approval_type VARCHAR(50) DEFAULT 'sequential',

          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

          CONSTRAINT chk_approval_status CHECK (status IN (
            'pending', 'approved', 'rejected', 'delegated', 'expired', 'cancelled'
          )),
          CONSTRAINT chk_approver_type CHECK (approver_type IN ('user', 'group', 'role')),
          CONSTRAINT chk_approval_type CHECK (approval_type IN ('sequential', 'parallel_any', 'parallel_all'))
        )
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_approvals_process_flow
          ON approvals(process_flow_instance_id)
      `);
    } else {
      // Table exists - add process_flow_instance_id column if it doesn't exist
      const columnExists = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'approvals'
            AND column_name = 'process_flow_instance_id'
        )
      `);

      if (!columnExists[0]?.exists) {
        await queryRunner.query(`
          ALTER TABLE approvals
          ADD COLUMN process_flow_instance_id UUID REFERENCES process_flow_instances(id) ON DELETE CASCADE
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_approvals_process_flow
            ON approvals(process_flow_instance_id)
        `);
      }
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_approvals_approver
        ON approvals(approver_id, status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_approvals_pending
        ON approvals(due_date) WHERE status = 'pending'
    `);

    // ═══════════════════════════════════════════════════════════════════
    // STATE MACHINE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS state_machine_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,

        -- Target collection and state field
        collection_id UUID REFERENCES collection_definitions(id),
        state_field VARCHAR(100) NOT NULL,

        -- States: [{ id, name, displayName, isInitial, isFinal, color, onEntry, onExit }]
        states JSONB NOT NULL DEFAULT '[]'::jsonb,

        -- Transitions: [{ id, fromState, toState, name, conditions, requiredRole, actions }]
        transitions JSONB NOT NULL DEFAULT '[]'::jsonb,

        is_active BOOLEAN DEFAULT true,

        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by UUID,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_state_machine_collection
        ON state_machine_definitions(collection_id) WHERE is_active = true
    `);

    // ═══════════════════════════════════════════════════════════════════
    // STATE CHANGE HISTORY
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS state_change_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        record_id UUID NOT NULL,
        collection_id UUID REFERENCES collection_definitions(id),
        state_machine_id UUID REFERENCES state_machine_definitions(id),

        from_state VARCHAR(100),
        to_state VARCHAR(100) NOT NULL,
        transition_name VARCHAR(100),

        -- Who made the change
        changed_by UUID,
        change_reason TEXT,

        -- Duration in previous state (seconds)
        duration_in_state INTEGER,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_state_change_record
        ON state_change_history(collection_id, record_id, created_at DESC)
    `);

    // ═══════════════════════════════════════════════════════════════════
    // SLA DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sla_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,

        -- Target collection
        collection_id UUID REFERENCES collection_definitions(id),

        -- SLA type
        sla_type VARCHAR(50) NOT NULL DEFAULT 'resolution',

        -- Target duration in minutes
        target_minutes INTEGER NOT NULL,

        -- Warning thresholds (percentage of target)
        warning_threshold_1 INTEGER DEFAULT 75,
        warning_threshold_2 INTEGER DEFAULT 90,

        -- Business hours calendar
        business_hours_id UUID REFERENCES business_hours(id),

        -- Conditions for this SLA to apply
        conditions JSONB,

        -- Pause conditions (e.g., waiting on customer)
        pause_conditions JSONB,

        -- Escalation actions
        escalations JSONB DEFAULT '[]'::jsonb,

        -- Priority order (higher = evaluated first)
        priority INTEGER DEFAULT 100,

        is_active BOOLEAN DEFAULT true,

        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by UUID,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        CONSTRAINT chk_sla_type CHECK (sla_type IN ('response', 'resolution', 'custom'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sla_definitions_collection
        ON sla_definitions(collection_id) WHERE is_active = true
    `);

    // ═══════════════════════════════════════════════════════════════════
    // SLA INSTANCES (Active Timers)
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sla_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sla_definition_id UUID REFERENCES sla_definitions(id) ON DELETE CASCADE,

        -- Target record
        record_id UUID NOT NULL,
        collection_id UUID REFERENCES collection_definitions(id),

        -- Timer state
        state VARCHAR(50) DEFAULT 'active',

        -- Time tracking (in seconds)
        elapsed_seconds INTEGER DEFAULT 0,
        remaining_seconds INTEGER NOT NULL,
        target_seconds INTEGER NOT NULL,

        -- Timestamps
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        pause_time TIMESTAMP WITH TIME ZONE,
        complete_time TIMESTAMP WITH TIME ZONE,
        breach_time TIMESTAMP WITH TIME ZONE,
        target_time TIMESTAMP WITH TIME ZONE NOT NULL,

        -- Pause tracking
        total_pause_seconds INTEGER DEFAULT 0,
        pause_count INTEGER DEFAULT 0,

        -- Warning tracking
        warning_1_sent BOOLEAN DEFAULT false,
        warning_1_sent_at TIMESTAMP WITH TIME ZONE,
        warning_2_sent BOOLEAN DEFAULT false,
        warning_2_sent_at TIMESTAMP WITH TIME ZONE,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        CONSTRAINT chk_sla_instance_state CHECK (state IN (
          'active', 'paused', 'completed', 'breached', 'cancelled'
        ))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sla_instances_record
        ON sla_instances(collection_id, record_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sla_instances_state
        ON sla_instances(state)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sla_instances_target
        ON sla_instances(target_time) WHERE state = 'active'
    `);

    // ═══════════════════════════════════════════════════════════════════
    // SLA BREACHES
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sla_breaches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sla_instance_id UUID REFERENCES sla_instances(id),
        sla_definition_id UUID REFERENCES sla_definitions(id),

        -- Target record
        record_id UUID NOT NULL,
        collection_id UUID REFERENCES collection_definitions(id),

        -- Breach details
        target_seconds INTEGER NOT NULL,
        elapsed_seconds INTEGER NOT NULL,
        breach_amount_seconds INTEGER NOT NULL,

        -- Resolution (if any)
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolution_notes TEXT,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sla_breaches_record
        ON sla_breaches(collection_id, record_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sla_breaches_created
        ON sla_breaches(created_at DESC)
    `);

    // ═══════════════════════════════════════════════════════════════════
    // NOTIFICATION TEMPLATES
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,

        -- Category for organization
        category VARCHAR(100) NOT NULL DEFAULT 'general',

        -- Channel-specific content
        email_subject VARCHAR(500),
        email_body_html TEXT,
        email_body_text TEXT,
        email_from_name VARCHAR(255),
        email_from_address VARCHAR(255),
        email_reply_to VARCHAR(255),

        sms_body VARCHAR(320),

        push_title VARCHAR(255),
        push_body VARCHAR(500),
        push_icon VARCHAR(255),
        push_actions JSONB,

        in_app_title VARCHAR(255),
        in_app_body TEXT,
        in_app_icon VARCHAR(100),
        in_app_priority VARCHAR(20) DEFAULT 'medium',
        in_app_actions JSONB,
        in_app_deep_link VARCHAR(500),

        -- Available variables for template
        variables JSONB DEFAULT '[]'::jsonb,

        -- Supported channels
        supported_channels JSONB DEFAULT '["email", "in_app"]'::jsonb,

        is_system BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,

        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by UUID,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_templates_category
        ON notification_templates(category) WHERE is_active = true
    `);

    // ═══════════════════════════════════════════════════════════════════
    // NOTIFICATION QUEUE
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID REFERENCES notification_templates(id),

        -- Recipient
        recipient_id UUID NOT NULL,

        -- Channels to send to
        channels JSONB NOT NULL,

        -- Context data for variable substitution
        context JSONB NOT NULL DEFAULT '{}'::jsonb,

        -- Scheduling
        scheduled_for TIMESTAMP WITH TIME ZONE,
        priority VARCHAR(20) DEFAULT 'medium',

        -- Status tracking
        status VARCHAR(50) DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,

        -- Error tracking
        last_error TEXT,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        processed_at TIMESTAMP WITH TIME ZONE,

        CONSTRAINT chk_notification_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        CONSTRAINT chk_notification_status CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_queue_status
        ON notification_queue(status, scheduled_for)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_queue_recipient
        ON notification_queue(recipient_id)
    `);

    // ═══════════════════════════════════════════════════════════════════
    // NOTIFICATION HISTORY
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        notification_queue_id UUID REFERENCES notification_queue(id),

        channel VARCHAR(20) NOT NULL,
        recipient_id UUID NOT NULL,

        -- Delivery tracking
        sent_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        opened_at TIMESTAMP WITH TIME ZONE,
        clicked_at TIMESTAMP WITH TIME ZONE,
        failed_at TIMESTAMP WITH TIME ZONE,

        -- Error information
        error_message TEXT,

        -- Provider tracking
        provider_id VARCHAR(255),
        provider_response JSONB,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        CONSTRAINT chk_notification_channel CHECK (channel IN ('email', 'sms', 'push', 'in_app'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_history_queue
        ON notification_history(notification_queue_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_history_recipient
        ON notification_history(recipient_id, sent_at DESC)
    `);

    // ═══════════════════════════════════════════════════════════════════
    // IN-APP NOTIFICATIONS (Real-time)
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS in_app_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,

        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        icon VARCHAR(100),

        priority VARCHAR(20) DEFAULT 'medium',

        -- Actions the user can take
        actions JSONB,

        -- Deep link to navigate to
        deep_link VARCHAR(500),

        -- Related record (if any)
        record_id UUID,
        collection_id UUID REFERENCES collection_definitions(id),

        -- Read status
        read BOOLEAN DEFAULT false,
        read_at TIMESTAMP WITH TIME ZONE,

        -- Dismissal
        dismissed BOOLEAN DEFAULT false,
        dismissed_at TIMESTAMP WITH TIME ZONE,

        -- Expiration
        expires_at TIMESTAMP WITH TIME ZONE,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        CONSTRAINT chk_in_app_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user
        ON in_app_notifications(user_id, read, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread
        ON in_app_notifications(user_id) WHERE read = false AND dismissed = false
    `);

    // ═══════════════════════════════════════════════════════════════════
    // USER NOTIFICATION PREFERENCES
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE,

        -- Channel preferences by category
        -- { "assignment": ["email", "in_app"], "approval": ["email", "sms", "push"] }
        preferences JSONB NOT NULL DEFAULT '{}'::jsonb,

        -- Quiet hours
        quiet_hours_enabled BOOLEAN DEFAULT false,
        quiet_hours_start TIME,
        quiet_hours_end TIME,
        quiet_hours_timezone VARCHAR(50) DEFAULT 'UTC',

        -- Digest mode
        digest_mode BOOLEAN DEFAULT false,
        digest_frequency VARCHAR(20) DEFAULT 'daily',
        digest_time TIME DEFAULT '08:00',

        -- Global settings
        email_enabled BOOLEAN DEFAULT true,
        sms_enabled BOOLEAN DEFAULT true,
        push_enabled BOOLEAN DEFAULT true,
        in_app_enabled BOOLEAN DEFAULT true,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        CONSTRAINT chk_digest_frequency CHECK (digest_frequency IN ('daily', 'weekly'))
      )
    `);

    // ═══════════════════════════════════════════════════════════════════
    // DEVICE TOKENS (for push notifications)
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,

        token TEXT NOT NULL UNIQUE,
        platform VARCHAR(20) NOT NULL,

        -- Device info
        device_name VARCHAR(255),
        device_model VARCHAR(100),
        os_version VARCHAR(50),
        app_version VARCHAR(50),

        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP WITH TIME ZONE,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        CONSTRAINT chk_device_platform CHECK (platform IN ('ios', 'android', 'web'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_device_tokens_user
        ON device_tokens(user_id) WHERE is_active = true
    `);

    // ═══════════════════════════════════════════════════════════════════
    // SEED DEFAULT BUSINESS HOURS
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      INSERT INTO business_hours (name, code, description, timezone, is_default)
      VALUES (
        'Standard Business Hours',
        'standard_business_hours',
        'Monday to Friday, 9 AM to 5 PM',
        'UTC',
        true
      )
      ON CONFLICT (code) DO NOTHING
    `);

    // ═══════════════════════════════════════════════════════════════════
    // SEED NOTIFICATION TEMPLATES
    // ═══════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      INSERT INTO notification_templates (name, code, category, is_system,
        email_subject, email_body_html, email_body_text,
        in_app_title, in_app_body, in_app_priority,
        variables, supported_channels)
      VALUES
        (
          'Record Assigned',
          'record_assigned',
          'assignment',
          true,
          '{{record.collection_label}} assigned to you: {{record.display_name}}',
          '<p>A {{record.collection_label}} has been assigned to you:</p><p><strong>{{record.display_name}}</strong></p><p><a href="{{portal_url}}/records/{{record.id}}">View Details</a></p>',
          'A {{record.collection_label}} has been assigned to you: {{record.display_name}}. View at {{portal_url}}/records/{{record.id}}',
          'New Assignment',
          '{{record.collection_label}}: {{record.display_name}}',
          'medium',
          '[{"name": "record", "type": "object"}, {"name": "assigned_by", "type": "object"}, {"name": "portal_url", "type": "string"}]',
          '["email", "push", "in_app"]'
        ),
        (
          'Approval Required',
          'approval_required',
          'approval',
          true,
          'Approval Required: {{record.display_name}}',
          '<p>Your approval is required for:</p><p><strong>{{record.display_name}}</strong></p><p>Submitted by: {{requester.name}}</p><p><a href="{{portal_url}}/approvals/{{approval.id}}">Review Now</a></p>',
          'Your approval is required for {{record.display_name}}. Submitted by {{requester.name}}. Review at {{portal_url}}/approvals/{{approval.id}}',
          'Approval Required',
          '{{record.display_name}} awaits your approval',
          'high',
          '[{"name": "record", "type": "object"}, {"name": "requester", "type": "object"}, {"name": "approval", "type": "object"}, {"name": "portal_url", "type": "string"}]',
          '["email", "sms", "push", "in_app"]'
        ),
        (
          'Approval Decision',
          'approval_decision',
          'approval',
          true,
          'Your {{record.collection_label}} was {{approval.status}}',
          '<p>Your {{record.collection_label}} has been <strong>{{approval.status}}</strong>:</p><p>{{record.display_name}}</p><p>{{#if approval.comments}}<em>Comments: {{approval.comments}}</em>{{/if}}</p>',
          'Your {{record.collection_label}} "{{record.display_name}}" was {{approval.status}}.',
          '{{approval.status | capitalize}}',
          '{{record.display_name}} was {{approval.status}}',
          'medium',
          '[{"name": "record", "type": "object"}, {"name": "approval", "type": "object"}]',
          '["email", "in_app"]'
        ),
        (
          'SLA Warning',
          'sla_warning',
          'sla',
          true,
          'SLA Warning: {{record.display_name}} - {{sla.percent_elapsed}}% elapsed',
          '<p><strong>SLA Warning</strong></p><p>{{record.display_name}} is approaching its SLA target.</p><p>Time remaining: {{sla.remaining_time}}</p><p><a href="{{portal_url}}/records/{{record.id}}">Take Action</a></p>',
          'SLA Warning: {{record.display_name}} has {{sla.remaining_time}} remaining before breach.',
          'SLA Warning',
          '{{record.display_name}} - {{sla.remaining_time}} remaining',
          'high',
          '[{"name": "record", "type": "object"}, {"name": "sla", "type": "object"}, {"name": "portal_url", "type": "string"}]',
          '["email", "push", "in_app"]'
        ),
        (
          'SLA Breach',
          'sla_breach',
          'sla',
          true,
          'SLA Breached: {{record.display_name}}',
          '<p><strong style="color: red;">SLA BREACHED</strong></p><p>{{record.display_name}} has exceeded its SLA target.</p><p>Target: {{sla.target_time}}</p><p>Elapsed: {{sla.elapsed_time}}</p><p><a href="{{portal_url}}/records/{{record.id}}">Take Immediate Action</a></p>',
          'SLA BREACHED: {{record.display_name}} exceeded target of {{sla.target_time}}.',
          'SLA Breach!',
          '{{record.display_name}} has breached SLA',
          'urgent',
          '[{"name": "record", "type": "object"}, {"name": "sla", "type": "object"}, {"name": "portal_url", "type": "string"}]',
          '["email", "sms", "push", "in_app"]'
        )
      ON CONFLICT (code) DO NOTHING
    `);

    console.log('Phase 4 migration completed: Process Flows, SLA, and Notifications tables created');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order of creation
    await queryRunner.query(`DROP TABLE IF EXISTS device_tokens CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_notification_preferences CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS in_app_notifications CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_history CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_queue CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_templates CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS sla_breaches CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS sla_instances CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS sla_definitions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS state_change_history CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS state_machine_definitions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS approvals CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS process_flow_execution_history CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS process_flow_instances CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS process_flow_definitions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS business_hours CASCADE`);

    console.log('Phase 4 migration rolled back');
  }
}
