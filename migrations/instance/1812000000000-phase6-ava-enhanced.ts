import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase6AvaEnhanced1812000000000 implements MigrationInterface {
  name = 'Phase6AvaEnhanced1812000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // AVA Conversations - Multi-turn conversation tracking
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_conversations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        status varchar(50) NOT NULL DEFAULT 'active',
        title text,
        message_count int NOT NULL DEFAULT 0,
        last_activity_at timestamptz,
        context_summary text,
        session_metadata jsonb,
        escalated_to uuid,
        escalation_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_conversations_user_id ON ava_conversations(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_conversations_status ON ava_conversations(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_conversations_created_at ON ava_conversations(created_at);`);

    // ============================================================
    // AVA Messages - Individual messages in conversations
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_messages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id uuid NOT NULL REFERENCES ava_conversations(id) ON DELETE CASCADE,
        role varchar(20) NOT NULL,
        content text NOT NULL,
        intent_id uuid,
        detected_entities jsonb,
        sentiment_score decimal(5,4),
        tool_calls jsonb,
        token_count int,
        response_time_ms int,
        model_used varchar(100),
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_messages_conversation_id ON ava_messages(conversation_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_messages_role ON ava_messages(role);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_messages_created_at ON ava_messages(created_at);`);

    // ============================================================
    // AVA Intents - Intent classification results
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_intents (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        message_id uuid NOT NULL REFERENCES ava_messages(id) ON DELETE CASCADE,
        category varchar(50) NOT NULL,
        intent_name varchar(100) NOT NULL,
        confidence decimal(5,4) NOT NULL,
        detected_entities jsonb,
        required_permissions jsonb,
        is_clarification_needed boolean NOT NULL DEFAULT false,
        clarification_question text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_intents_message_id ON ava_intents(message_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_intents_category ON ava_intents(category);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_intents_intent_name ON ava_intents(intent_name);`);

    // ============================================================
    // AVA Contexts - Session/user context storage
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_contexts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        conversation_id uuid,
        context_type varchar(50) NOT NULL,
        context_key varchar(100) NOT NULL,
        context_value jsonb NOT NULL,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_contexts_user_id ON ava_contexts(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_contexts_context_type ON ava_contexts(context_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_contexts_expires_at ON ava_contexts(expires_at);`);

    // ============================================================
    // AVA Predictions - Predictive analytics results
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_predictions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        prediction_type varchar(50) NOT NULL,
        target_date date NOT NULL,
        prediction_value jsonb NOT NULL,
        confidence decimal(5,4),
        model_version varchar(100),
        input_features jsonb,
        is_active boolean NOT NULL DEFAULT true,
        actual_value jsonb,
        accuracy decimal(5,4),
        created_at timestamptz NOT NULL DEFAULT now(),
        verified_at timestamptz
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_predictions_type ON ava_predictions(prediction_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_predictions_target_date ON ava_predictions(target_date);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_predictions_is_active ON ava_predictions(is_active);`);

    // ============================================================
    // AVA Anomalies - Detected anomalies
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_anomalies (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        anomaly_type varchar(100) NOT NULL,
        severity varchar(20) NOT NULL,
        description text NOT NULL,
        affected_entity varchar(255),
        affected_entity_id uuid,
        metric_value decimal(15,4),
        expected_value decimal(15,4),
        deviation_percentage decimal(7,4),
        confidence decimal(5,4),
        recommended_actions jsonb,
        is_resolved boolean NOT NULL DEFAULT false,
        resolved_by uuid,
        resolution_notes text,
        detected_at timestamptz NOT NULL,
        resolved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_anomalies_type ON ava_anomalies(anomaly_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_anomalies_severity ON ava_anomalies(severity);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_anomalies_is_resolved ON ava_anomalies(is_resolved);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_anomalies_detected_at ON ava_anomalies(detected_at);`);

    // ============================================================
    // AVA Suggestions - Smart suggestions for users
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_suggestions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        conversation_id uuid,
        suggestion_type varchar(50) NOT NULL,
        target_entity varchar(255),
        target_field varchar(255),
        suggested_value jsonb NOT NULL,
        explanation text,
        confidence decimal(5,4),
        is_accepted boolean,
        user_feedback text,
        response_time_ms int,
        created_at timestamptz NOT NULL DEFAULT now(),
        responded_at timestamptz
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_suggestions_user_id ON ava_suggestions(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_suggestions_type ON ava_suggestions(suggestion_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_suggestions_target_entity ON ava_suggestions(target_entity);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_suggestions_is_accepted ON ava_suggestions(is_accepted);`);

    // ============================================================
    // AVA Feedback - User feedback for learning
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_feedback (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        message_id uuid,
        suggestion_id uuid,
        feedback_type varchar(50) NOT NULL,
        rating int,
        comment text,
        expected_response text,
        is_processed boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_feedback_user_id ON ava_feedback(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_feedback_message_id ON ava_feedback(message_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_feedback_type ON ava_feedback(feedback_type);`);

    // ============================================================
    // AVA Knowledge Embeddings - Vector embeddings for RAG
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_knowledge_embeddings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        source_type varchar(50) NOT NULL,
        source_id uuid NOT NULL,
        content_hash varchar(64) NOT NULL,
        content text NOT NULL,
        embedding jsonb NOT NULL,
        embedding_model varchar(100) NOT NULL,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_embeddings_source_type ON ava_knowledge_embeddings(source_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_embeddings_source_id ON ava_knowledge_embeddings(source_id);`);

    // ============================================================
    // AVA Usage Metrics - Usage tracking for analytics
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_usage_metrics (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid,
        metric_date date NOT NULL,
        metric_type varchar(100) NOT NULL,
        metric_value decimal(15,4) NOT NULL,
        dimensions jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_usage_user_id ON ava_usage_metrics(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_usage_metric_date ON ava_usage_metrics(metric_date);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ava_usage_metric_type ON ava_usage_metrics(metric_type);`);

    // ============================================================
    // Update ava_conversations to add missing columns if needed
    // ============================================================
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ava_conversations' AND column_name='status') THEN
          ALTER TABLE ava_conversations ADD COLUMN status varchar(50) NOT NULL DEFAULT 'active';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ava_conversations' AND column_name='message_count') THEN
          ALTER TABLE ava_conversations ADD COLUMN message_count int NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ava_conversations' AND column_name='last_activity_at') THEN
          ALTER TABLE ava_conversations ADD COLUMN last_activity_at timestamptz;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ava_conversations' AND column_name='context_summary') THEN
          ALTER TABLE ava_conversations ADD COLUMN context_summary text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ava_conversations' AND column_name='session_metadata') THEN
          ALTER TABLE ava_conversations ADD COLUMN session_metadata jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ava_conversations' AND column_name='escalated_to') THEN
          ALTER TABLE ava_conversations ADD COLUMN escalated_to uuid;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ava_conversations' AND column_name='escalation_reason') THEN
          ALTER TABLE ava_conversations ADD COLUMN escalation_reason text;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ava_usage_metrics;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_knowledge_embeddings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_feedback;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_suggestions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_anomalies;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_predictions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_contexts;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_intents;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_messages;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_conversations;`);
  }
}
