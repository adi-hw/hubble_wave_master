import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase7RevolutionaryFeatures1811000000000 implements MigrationInterface {
  name = 'Phase7RevolutionaryFeatures1811000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // SECTION 1: AVA-POWERED AGILE DEVELOPMENT
    // ============================================================

    // Sprint Recordings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sprint_recordings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(255) NOT NULL,
        "recording_url" varchar(500),
        "transcript" text,
        "duration_seconds" integer,
        "recorded_at" timestamptz NOT NULL,
        "recorded_by" uuid,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "analysis" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sprint_recordings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sprint_recordings_user" FOREIGN KEY ("recorded_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sprint_recordings_status" ON "sprint_recordings" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sprint_recordings_recorded_at" ON "sprint_recordings" ("recorded_at" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sprint_recordings_recorded_by" ON "sprint_recordings" ("recorded_by")`);

    // AVA-Generated Stories
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ava_stories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recording_id" uuid,
        "title" varchar(255) NOT NULL,
        "description" text,
        "story_type" varchar(50),
        "priority" varchar(20),
        "estimated_points" integer,
        "acceptance_criteria" jsonb,
        "suggested_collections" jsonb,
        "suggested_rules" jsonb,
        "suggested_flows" jsonb,
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "approved_by" uuid,
        "approved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ava_stories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ava_stories_recording" FOREIGN KEY ("recording_id")
          REFERENCES "sprint_recordings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ava_stories_approved_by" FOREIGN KEY ("approved_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ava_stories_recording" ON "ava_stories" ("recording_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ava_stories_status" ON "ava_stories" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ava_stories_priority" ON "ava_stories" ("priority")`);

    // Story Implementation Tracking
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "story_implementations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "story_id" uuid NOT NULL,
        "artifact_type" varchar(50) NOT NULL,
        "artifact_id" uuid NOT NULL,
        "generated_by_ava" boolean NOT NULL DEFAULT true,
        "manual_modifications" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_story_implementations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_story_implementations_story" FOREIGN KEY ("story_id")
          REFERENCES "ava_stories"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_story_implementations_story" ON "story_implementations" ("story_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_story_implementations_artifact" ON "story_implementations" ("artifact_type", "artifact_id")`);

    // ============================================================
    // SECTION 2: INTELLIGENT UPGRADE ASSISTANT
    // ============================================================

    // Customization Registry
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customization_registry" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customization_type" varchar(50) NOT NULL,
        "artifact_id" uuid NOT NULL,
        "artifact_code" varchar(100),
        "is_system_modified" boolean NOT NULL DEFAULT false,
        "original_hash" varchar(64),
        "current_hash" varchar(64),
        "dependencies" jsonb NOT NULL DEFAULT '[]',
        "dependents" jsonb NOT NULL DEFAULT '[]',
        "platform_version_created" varchar(20),
        "last_analyzed_version" varchar(20),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customization_registry" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customization_registry_type" ON "customization_registry" ("customization_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customization_registry_artifact" ON "customization_registry" ("artifact_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customization_registry_unique" ON "customization_registry" ("customization_type", "artifact_id")`);

    // Upgrade Impact Analyses
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "upgrade_impact_analyses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "from_version" varchar(20) NOT NULL,
        "to_version" varchar(20) NOT NULL,
        "analysis_status" varchar(20) NOT NULL DEFAULT 'pending',
        "total_customizations" integer,
        "breaking_count" integer,
        "warning_count" integer,
        "safe_count" integer,
        "impact_details" jsonb,
        "ava_recommendations" text,
        "auto_fixable_count" integer,
        "analyzed_at" timestamptz,
        "analyzed_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_upgrade_impact_analyses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_upgrade_analyses_user" FOREIGN KEY ("analyzed_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_upgrade_analyses_versions" ON "upgrade_impact_analyses" ("from_version", "to_version")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_upgrade_analyses_status" ON "upgrade_impact_analyses" ("analysis_status")`);

    // Upgrade Fixes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "upgrade_fixes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "analysis_id" uuid NOT NULL,
        "customization_id" uuid NOT NULL,
        "fix_type" varchar(20) NOT NULL,
        "original_code" text,
        "fixed_code" text,
        "fix_description" text,
        "applied_by" uuid,
        "applied_at" timestamptz,
        "rollback_available" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_upgrade_fixes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_upgrade_fixes_analysis" FOREIGN KEY ("analysis_id")
          REFERENCES "upgrade_impact_analyses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_upgrade_fixes_customization" FOREIGN KEY ("customization_id")
          REFERENCES "customization_registry"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_upgrade_fixes_user" FOREIGN KEY ("applied_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_upgrade_fixes_analysis" ON "upgrade_fixes" ("analysis_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_upgrade_fixes_customization" ON "upgrade_fixes" ("customization_id")`);

    // ============================================================
    // SECTION 3: LIVING DOCUMENTATION SYSTEM
    // ============================================================

    // Generated Documentation
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "generated_documentation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "artifact_type" varchar(50) NOT NULL,
        "artifact_id" uuid NOT NULL,
        "artifact_code" varchar(100),
        "documentation" jsonb NOT NULL,
        "search_text" text,
        "version" integer NOT NULL DEFAULT 1,
        "generated_at" timestamptz NOT NULL DEFAULT now(),
        "generated_by" varchar(50) NOT NULL DEFAULT 'ava',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_generated_documentation" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_generated_docs_artifact" ON "generated_documentation" ("artifact_type", "artifact_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_generated_docs_code" ON "generated_documentation" ("artifact_code")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_generated_docs_search" ON "generated_documentation" USING gin(to_tsvector('english', "search_text"))`);

    // Documentation Versions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documentation_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentation_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "documentation" jsonb NOT NULL,
        "change_summary" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documentation_versions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_doc_versions_doc" FOREIGN KEY ("documentation_id")
          REFERENCES "generated_documentation"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_doc_versions_doc" ON "documentation_versions" ("documentation_id", "version" DESC)`);

    // ============================================================
    // SECTION 4: PREDICTIVE OPERATIONS
    // ============================================================

    // Predictive Insights
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "predictive_insights" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "insight_type" varchar(50) NOT NULL,
        "severity" varchar(20) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "affected_artifact_type" varchar(50),
        "affected_artifact_id" uuid,
        "data_points" jsonb,
        "suggested_actions" jsonb,
        "status" varchar(20) NOT NULL DEFAULT 'open',
        "resolved_action" varchar(100),
        "resolved_by" uuid,
        "resolved_at" timestamptz,
        "expires_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_predictive_insights" PRIMARY KEY ("id"),
        CONSTRAINT "FK_predictive_insights_user" FOREIGN KEY ("resolved_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_predictive_insights_type" ON "predictive_insights" ("insight_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_predictive_insights_severity" ON "predictive_insights" ("severity")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_predictive_insights_status" ON "predictive_insights" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_predictive_insights_expires" ON "predictive_insights" ("expires_at") WHERE "expires_at" IS NOT NULL`);

    // Insight Analysis Jobs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "insight_analysis_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_type" varchar(50) NOT NULL,
        "last_run_at" timestamptz,
        "next_run_at" timestamptz,
        "run_frequency_hours" integer NOT NULL DEFAULT 24,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "last_result" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_insight_analysis_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_insight_jobs_type" ON "insight_analysis_jobs" ("job_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_insight_jobs_next_run" ON "insight_analysis_jobs" ("next_run_at")`);

    // ============================================================
    // SECTION 5: DIGITAL TWINS
    // ============================================================

    // Digital Twins
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "digital_twins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "asset_id" uuid NOT NULL,
        "model_url" text NOT NULL,
        "model_version" varchar(50),
        "sync_interval" integer NOT NULL DEFAULT 1000,
        "sensor_mappings" jsonb NOT NULL DEFAULT '[]',
        "state" jsonb NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "last_sync_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_digital_twins" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_digital_twins_asset" ON "digital_twins" ("asset_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_digital_twins_active" ON "digital_twins" ("is_active")`);

    // Sensor Readings (Time-Series)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sensor_readings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "asset_id" uuid NOT NULL,
        "sensor_id" varchar(255) NOT NULL,
        "data_type" varchar(100),
        "value" decimal(20,6),
        "unit" varchar(50),
        "quality" varchar(20) DEFAULT 'good',
        "timestamp" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sensor_readings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sensor_readings_asset_time" ON "sensor_readings" ("asset_id", "timestamp" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sensor_readings_sensor_time" ON "sensor_readings" ("sensor_id", "timestamp" DESC)`);

    // ============================================================
    // SECTION 6: SELF-HEALING INFRASTRUCTURE
    // ============================================================

    // Self-Healing Events
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "self_healing_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "service_name" varchar(255) NOT NULL,
        "event_type" varchar(100) NOT NULL,
        "action_taken" varchar(255),
        "reason" text,
        "success" boolean,
        "metrics" jsonb,
        "duration_ms" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_self_healing_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_self_healing_service" ON "self_healing_events" ("service_name", "created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_self_healing_event_type" ON "self_healing_events" ("event_type")`);

    // Service Health Status
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "service_health_status" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "service_name" varchar(255) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'unknown',
        "cpu_usage" decimal(5,2),
        "memory_usage" decimal(5,2),
        "error_rate" decimal(5,2),
        "response_time_ms" integer,
        "replica_count" integer,
        "last_check_at" timestamptz,
        "health_history" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_health_status" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_service_health_name" UNIQUE ("service_name")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_service_health_status_val" ON "service_health_status" ("status")`);

    // Recovery Actions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recovery_actions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "action_type" varchar(50) NOT NULL,
        "target_service" varchar(255),
        "trigger_conditions" jsonb NOT NULL,
        "action_config" jsonb NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_triggered_at" timestamptz,
        "trigger_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recovery_actions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_recovery_actions_service" ON "recovery_actions" ("target_service")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_recovery_actions_active" ON "recovery_actions" ("is_active")`);

    // ============================================================
    // SECTION 7: AI REPORTS
    // ============================================================

    // AI Reports
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(500),
        "prompt" text NOT NULL,
        "parsed_intent" jsonb,
        "definition" jsonb NOT NULL,
        "format" varchar(50),
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "generated_file_url" text,
        "generated_by" uuid,
        "generation_time_ms" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_reports_user" FOREIGN KEY ("generated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_reports_user" ON "ai_reports" ("generated_by", "created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_reports_status" ON "ai_reports" ("status")`);

    // Report Templates
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_report_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "category" varchar(100),
        "base_prompt" text,
        "schema_hints" jsonb,
        "chart_preferences" jsonb,
        "is_public" boolean NOT NULL DEFAULT false,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_report_templates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_report_templates_user" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_report_templates_category" ON "ai_report_templates" ("category")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_report_templates_public" ON "ai_report_templates" ("is_public")`);

    // ============================================================
    // SECTION 8: NATURAL LANGUAGE QUERIES
    // ============================================================

    // NL Queries
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nl_queries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "query_text" text NOT NULL,
        "parsed_intent" jsonb,
        "generated_sql" text,
        "result_count" integer,
        "confidence" decimal(3,2),
        "execution_time_ms" integer,
        "error_message" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nl_queries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_nl_queries_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_nl_queries_user" ON "nl_queries" ("user_id", "created_at" DESC)`);

    // Saved Queries
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_nl_queries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "name" varchar(255) NOT NULL,
        "query_text" text NOT NULL,
        "is_favorite" boolean NOT NULL DEFAULT false,
        "usage_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_nl_queries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_saved_nl_queries_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_saved_queries_user" ON "saved_nl_queries" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_saved_queries_favorite" ON "saved_nl_queries" ("user_id", "is_favorite") WHERE "is_favorite" = true`);

    // ============================================================
    // SECTION 9: ZERO-CODE APP BUILDER
    // ============================================================

    // Zero-Code Apps
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zero_code_apps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "version" varchar(50) NOT NULL DEFAULT '1.0.0',
        "definition" jsonb NOT NULL,
        "is_published" boolean NOT NULL DEFAULT false,
        "published_version" varchar(50),
        "icon" varchar(100),
        "category" varchar(100),
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "published_at" timestamptz,
        CONSTRAINT "PK_zero_code_apps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_zero_code_apps_user" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zero_code_apps_published" ON "zero_code_apps" ("is_published")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zero_code_apps_creator" ON "zero_code_apps" ("created_by")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zero_code_apps_category" ON "zero_code_apps" ("category")`);

    // App Versions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zero_code_app_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "app_id" uuid NOT NULL,
        "version" varchar(50) NOT NULL,
        "definition" jsonb NOT NULL,
        "change_summary" text,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zero_code_app_versions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_app_versions_app" FOREIGN KEY ("app_id")
          REFERENCES "zero_code_apps"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_app_versions_user" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_app_versions_app" ON "zero_code_app_versions" ("app_id", "created_at" DESC)`);

    // Component Library
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_builder_components" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "category" varchar(100) NOT NULL,
        "component_type" varchar(100) NOT NULL,
        "default_props" jsonb NOT NULL,
        "schema" jsonb NOT NULL,
        "icon" varchar(100),
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_builder_components" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_app_components_category" ON "app_builder_components" ("category")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_app_components_type" ON "app_builder_components" ("component_type")`);

    // ============================================================
    // SECTION 10: VOICE CONTROL
    // ============================================================

    // Voice Commands
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "voice_commands" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "session_id" uuid,
        "command_text" text NOT NULL,
        "intent" varchar(255),
        "entities" jsonb,
        "confidence" decimal(3,2),
        "executed" boolean NOT NULL DEFAULT false,
        "execution_result" jsonb,
        "audio_duration_ms" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voice_commands" PRIMARY KEY ("id"),
        CONSTRAINT "FK_voice_commands_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_voice_commands_user" ON "voice_commands" ("user_id", "created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_voice_commands_session" ON "voice_commands" ("session_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_voice_commands_intent" ON "voice_commands" ("intent")`);

    // Voice Command Patterns
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "voice_command_patterns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "intent" varchar(255) NOT NULL,
        "patterns" jsonb NOT NULL,
        "action_type" varchar(100) NOT NULL,
        "action_config" jsonb NOT NULL,
        "examples" text[],
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voice_command_patterns" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_voice_patterns_intent" ON "voice_command_patterns" ("intent")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_voice_patterns_active" ON "voice_command_patterns" ("is_active")`);

    // ============================================================
    // SECTION 11: PREDICTIVE UI
    // ============================================================

    // User Behaviors
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_behaviors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "action" varchar(255) NOT NULL,
        "context" jsonb,
        "route" varchar(500),
        "target_entity_type" varchar(100),
        "target_entity_id" uuid,
        "duration_ms" integer,
        "timestamp" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_behaviors" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_behaviors_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_behaviors_user_time" ON "user_behaviors" ("user_id", "timestamp" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_behaviors_action" ON "user_behaviors" ("action")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_behaviors_route" ON "user_behaviors" ("route")`);

    // Predictive Suggestions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "predictive_suggestions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "suggestion_type" varchar(100),
        "label" text,
        "description" text,
        "action_type" varchar(100),
        "action_payload" jsonb,
        "confidence" decimal(3,2),
        "accepted" boolean,
        "dismissed" boolean NOT NULL DEFAULT false,
        "context_route" varchar(500),
        "shown_at" timestamptz NOT NULL DEFAULT now(),
        "responded_at" timestamptz,
        CONSTRAINT "PK_predictive_suggestions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_predictive_suggestions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_predictive_suggestions_user" ON "predictive_suggestions" ("user_id", "shown_at" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_predictive_suggestions_type" ON "predictive_suggestions" ("suggestion_type")`);

    // User Patterns
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_patterns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "pattern_type" varchar(100) NOT NULL,
        "pattern_data" jsonb NOT NULL,
        "confidence" decimal(3,2),
        "occurrence_count" integer NOT NULL DEFAULT 1,
        "last_occurrence_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_patterns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_patterns_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_patterns_user" ON "user_patterns" ("user_id", "pattern_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_patterns_type" ON "user_patterns" ("pattern_type")`);

    // ============================================================
    // SECTION 12: SEED INSIGHT ANALYSIS JOBS
    // ============================================================

    await queryRunner.query(`
      INSERT INTO "insight_analysis_jobs" ("job_type", "run_frequency_hours", "status", "next_run_at")
      VALUES
        ('capacity', 24, 'pending', now() + interval '1 hour'),
        ('security', 12, 'pending', now() + interval '30 minutes'),
        ('performance', 6, 'pending', now() + interval '15 minutes'),
        ('compliance', 24, 'pending', now() + interval '2 hours'),
        ('usage', 24, 'pending', now() + interval '3 hours')
      ON CONFLICT ("job_type") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order
    await queryRunner.query('DROP TABLE IF EXISTS "user_patterns" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "predictive_suggestions" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "user_behaviors" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "voice_command_patterns" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "voice_commands" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "app_builder_components" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "zero_code_app_versions" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "zero_code_apps" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "saved_nl_queries" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "nl_queries" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "ai_report_templates" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "ai_reports" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "recovery_actions" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "service_health_status" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "self_healing_events" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "sensor_readings" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "digital_twins" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "insight_analysis_jobs" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "predictive_insights" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "documentation_versions" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "generated_documentation" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "upgrade_fixes" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "upgrade_impact_analyses" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "customization_registry" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "story_implementations" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "ava_stories" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "sprint_recordings" CASCADE');
  }
}
