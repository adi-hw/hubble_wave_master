import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline0000000000000 implements MigrationInterface {
  name = 'Baseline0000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Schemas
    await queryRunner.query(`CREATE SCHEMA app_builder;`);
    await queryRunner.query(`CREATE SCHEMA automation;`);
    await queryRunner.query(`CREATE SCHEMA ava;`);
    await queryRunner.query(`CREATE SCHEMA identity;`);
    await queryRunner.query(`CREATE SCHEMA insights;`);
    await queryRunner.query(`CREATE SCHEMA integrations;`);
    await queryRunner.query(`CREATE SCHEMA metadata;`);
    await queryRunner.query(`CREATE SCHEMA notify;`);

    // Extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;`);

    // Types
    await queryRunner.query(`CREATE TYPE public.ava_proposal_state_enum AS ENUM (
    'suggested',
    'previewed',
    'approved',
    'rejected',
    'executed',
    'failed'
);`);
    await queryRunner.query(`CREATE TYPE public.schema_owner AS ENUM (
    'system',
    'platform',
    'custom'
);`);
    await queryRunner.query(`CREATE TYPE public.sync_status AS ENUM (
    'synced',
    'pending',
    'error',
    'orphaned'
);`);

    // Functions
    await queryRunner.query(`CREATE FUNCTION public.invalidate_formula_cache(p_collection_id uuid, p_record_id uuid DEFAULT NULL::uuid, p_property_id uuid DEFAULT NULL::uuid, p_reason character varying DEFAULT 'dependency_changed'::character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
      DECLARE
        v_count INTEGER;
      BEGIN
        UPDATE formula_cache
        SET
          is_stale = true,
          stale_reason = p_reason
        WHERE
          collection_id = p_collection_id
          AND (p_record_id IS NULL OR record_id = p_record_id)
          AND (p_property_id IS NULL OR property_id = p_property_id)
          AND is_stale = false;

        GET DIAGNOSTICS v_count = ROW_COUNT;
        RETURN v_count;
      END;
      $$;`);
    await queryRunner.query(`CREATE FUNCTION public.update_formula_cache_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;`);
    await queryRunner.query(`CREATE FUNCTION public.update_schema_sync_state_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;`);
    await queryRunner.query(`CREATE FUNCTION public.update_view_config_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;`);

    // Sequences
    await queryRunner.query(`CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;`);

    // Tables
    await queryRunner.query(`CREATE TABLE app_builder.ai_report_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    base_prompt text,
    schema_hints jsonb,
    chart_preferences jsonb,
    is_public boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.ai_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(500),
    prompt text NOT NULL,
    parsed_intent jsonb,
    definition jsonb NOT NULL,
    format character varying(50),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    generated_file_url text,
    generated_by uuid,
    generation_time_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.app_builder_components (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    component_type character varying(100) NOT NULL,
    default_props jsonb NOT NULL,
    schema jsonb NOT NULL,
    icon character varying(100),
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.ava_stories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    recording_id uuid,
    title character varying(255) NOT NULL,
    description text,
    story_type character varying(50),
    priority character varying(20),
    estimated_points integer,
    acceptance_criteria jsonb,
    suggested_collections jsonb,
    suggested_rules jsonb,
    suggested_flows jsonb,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.customization_registry (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customization_type character varying(50) NOT NULL,
    artifact_id uuid NOT NULL,
    artifact_code character varying(100),
    is_system_modified boolean DEFAULT false NOT NULL,
    original_hash character varying(64),
    current_hash character varying(64),
    dependencies jsonb DEFAULT '[]'::jsonb NOT NULL,
    dependents jsonb DEFAULT '[]'::jsonb NOT NULL,
    platform_version_created character varying(20),
    last_analyzed_version character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.digital_twins (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id character varying(255) NOT NULL,
    model_url text,
    model_version character varying(50),
    sync_interval integer DEFAULT 1000 NOT NULL,
    sensor_mappings jsonb DEFAULT '[]'::jsonb NOT NULL,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    asset_type character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying
);`);
    await queryRunner.query(`CREATE TABLE app_builder.documentation_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    documentation_id uuid NOT NULL,
    version integer NOT NULL,
    documentation jsonb NOT NULL,
    change_summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.generated_documentation (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    artifact_type character varying(50) NOT NULL,
    artifact_id uuid NOT NULL,
    artifact_code character varying(100),
    documentation jsonb NOT NULL,
    search_text text,
    version integer DEFAULT 1 NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated_by character varying(50) DEFAULT 'ava'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.insight_analysis_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    job_type character varying(50) NOT NULL,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    run_frequency_hours integer DEFAULT 24 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    last_result jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.nl_queries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    query_text text NOT NULL,
    parsed_intent jsonb,
    generated_sql text,
    result_count integer,
    confidence numeric(3,2),
    execution_time_ms integer,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.predictive_insights (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    insight_type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    affected_artifact_type character varying(50),
    affected_artifact_id uuid,
    data_points jsonb,
    suggested_actions jsonb,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    resolved_action character varying(100),
    resolved_by uuid,
    resolved_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.predictive_suggestions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    suggestion_type character varying(100),
    label text,
    description text,
    action_type character varying(100),
    action_payload jsonb,
    confidence numeric(3,2),
    accepted boolean,
    dismissed boolean DEFAULT false NOT NULL,
    context_route character varying(500),
    shown_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone
);`);
    await queryRunner.query(`CREATE TABLE app_builder.recovery_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    action_type character varying(50) NOT NULL,
    target_service character varying(255),
    trigger_conditions jsonb NOT NULL,
    action_config jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_triggered_at timestamp with time zone,
    trigger_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.saved_nl_queries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    name character varying(255) NOT NULL,
    query_text text NOT NULL,
    is_favorite boolean DEFAULT false NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.self_healing_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    service_name character varying(255) NOT NULL,
    event_type character varying(100) NOT NULL,
    action_taken character varying(255),
    reason text,
    success boolean,
    metrics jsonb,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.sensor_readings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id character varying(255) NOT NULL,
    sensor_id character varying(255) NOT NULL,
    data_type character varying(100),
    value numeric(20,6),
    unit character varying(50),
    quality character varying(20) DEFAULT 'good'::character varying,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.service_health_status (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    service_name character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    cpu_usage numeric(5,2),
    memory_usage numeric(5,2),
    error_rate numeric(5,2),
    response_time_ms integer,
    replica_count integer,
    last_check_at timestamp with time zone,
    health_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.sprint_recordings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    recording_url character varying(500),
    transcript text,
    duration_seconds integer,
    recorded_at timestamp with time zone NOT NULL,
    recorded_by uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    analysis jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.story_implementations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    story_id uuid NOT NULL,
    artifact_type character varying(50) NOT NULL,
    artifact_id uuid NOT NULL,
    generated_by_ava boolean DEFAULT true NOT NULL,
    manual_modifications jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.upgrade_fixes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    analysis_id uuid NOT NULL,
    customization_id uuid NOT NULL,
    fix_type character varying(20) NOT NULL,
    original_code text,
    fixed_code text,
    fix_description text,
    applied_by uuid,
    applied_at timestamp with time zone,
    rollback_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.upgrade_impact_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    from_version character varying(20) NOT NULL,
    to_version character varying(20) NOT NULL,
    analysis_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    total_customizations integer,
    breaking_count integer,
    warning_count integer,
    safe_count integer,
    impact_details jsonb,
    ava_recommendations text,
    auto_fixable_count integer,
    analyzed_at timestamp with time zone,
    analyzed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.user_behaviors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    action character varying(255) NOT NULL,
    context jsonb,
    route character varying(500),
    target_entity_type character varying(100),
    target_entity_id uuid,
    duration_ms integer,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.user_patterns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    pattern_type character varying(100) NOT NULL,
    pattern_data jsonb NOT NULL,
    confidence numeric(3,2),
    occurrence_count integer DEFAULT 1 NOT NULL,
    last_occurrence_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.voice_command_patterns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    intent character varying(255) NOT NULL,
    patterns jsonb NOT NULL,
    action_type character varying(100) NOT NULL,
    action_config jsonb NOT NULL,
    examples text[],
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.voice_commands (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    session_id uuid,
    command_text text NOT NULL,
    intent character varying(255),
    entities jsonb,
    confidence numeric(3,2),
    executed boolean DEFAULT false NOT NULL,
    execution_result jsonb,
    audio_duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.zero_code_app_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    app_id uuid NOT NULL,
    version character varying(50) NOT NULL,
    definition jsonb NOT NULL,
    change_summary text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE app_builder.zero_code_apps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    version character varying(50) DEFAULT '1.0.0'::character varying NOT NULL,
    definition jsonb NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    published_version character varying(50),
    icon character varying(100),
    category character varying(100),
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone
);`);
    await queryRunner.query(`CREATE TABLE automation.approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    process_flow_instance_id uuid,
    node_id character varying(100) NOT NULL,
    approver_id uuid NOT NULL,
    approver_type character varying(50) DEFAULT 'user'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    comments text,
    due_date timestamp with time zone,
    responded_at timestamp with time zone,
    responded_by uuid,
    delegated_to uuid,
    delegated_at timestamp with time zone,
    delegation_reason text,
    sequence_number integer DEFAULT 1,
    approval_type character varying(50) DEFAULT 'sequential'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_approval_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'delegated'::character varying, 'expired'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT chk_approval_type CHECK (((approval_type)::text = ANY ((ARRAY['sequential'::character varying, 'parallel_any'::character varying, 'parallel_all'::character varying])::text[]))),
    CONSTRAINT chk_approver_type CHECK (((approver_type)::text = ANY ((ARRAY['user'::character varying, 'group'::character varying, 'role'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE automation.automation_execution_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    automation_rule_id uuid,
    scheduled_job_id uuid,
    automation_type character varying(16) NOT NULL,
    automation_name character varying(128) NOT NULL,
    collection_id uuid,
    record_id uuid,
    trigger_event character varying(32),
    trigger_timing character varying(16),
    status character varying(16) NOT NULL,
    skipped_reason text,
    error_message text,
    error_stack text,
    input_data jsonb,
    output_data jsonb,
    actions_executed jsonb,
    triggered_by uuid,
    execution_depth integer DEFAULT 1 NOT NULL,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.automation_rule_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    automation_rule_id uuid NOT NULL,
    revision integer NOT NULL,
    status character varying(20) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.automation_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(128) NOT NULL,
    description text,
    collection_id uuid NOT NULL,
    trigger_timing character varying(16) NOT NULL,
    trigger_operations jsonb DEFAULT '["insert", "update"]'::jsonb NOT NULL,
    watch_properties jsonb,
    condition_type character varying(16) DEFAULT 'always'::character varying NOT NULL,
    condition jsonb,
    condition_script text,
    action_type character varying(16) DEFAULT 'no_code'::character varying NOT NULL,
    actions jsonb,
    script text,
    abort_on_error boolean DEFAULT false NOT NULL,
    execution_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    consecutive_errors integer DEFAULT 0 NOT NULL,
    last_executed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    application_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    current_revision_id uuid,
    published_at timestamp with time zone,
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.business_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    description text,
    timezone character varying(50) DEFAULT 'UTC'::character varying NOT NULL,
    schedule jsonb DEFAULT '{"friday": {"end": "17:00", "start": "09:00"}, "monday": {"end": "17:00", "start": "09:00"}, "tuesday": {"end": "17:00", "start": "09:00"}, "thursday": {"end": "17:00", "start": "09:00"}, "wednesday": {"end": "17:00", "start": "09:00"}}'::jsonb NOT NULL,
    holidays jsonb DEFAULT '[]'::jsonb,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE automation.client_scripts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(128) NOT NULL,
    description text,
    collection_id uuid NOT NULL,
    form_id uuid,
    trigger character varying(16) NOT NULL,
    watch_property character varying(64),
    condition_type character varying(16) DEFAULT 'always'::character varying NOT NULL,
    condition jsonb,
    actions jsonb NOT NULL,
    execution_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.connectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    kind character varying(20) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    credential_ref character varying(255),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.cross_domain_read_diff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caller_service character varying(80) NOT NULL,
    callsite character varying(200) NOT NULL,
    lookup_key character varying(500) NOT NULL,
    diff_kind character varying(50) NOT NULL,
    delta jsonb,
    http_error text,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CHK_cross_domain_read_diff_kind" CHECK (((diff_kind)::text = ANY ((ARRAY['value-mismatch'::character varying, 'db-only'::character varying, 'http-only'::character varying, 'http-error'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE automation.decision_inputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    input_type character varying(20) NOT NULL,
    config jsonb,
    default_value jsonb,
    "position" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.decision_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid NOT NULL,
    "position" integer NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    answer_record_id uuid,
    answer_literal jsonb,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.decision_table_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid NOT NULL,
    revision integer NOT NULL,
    status character varying(20) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.decision_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    collection_id uuid NOT NULL,
    application_id uuid NOT NULL,
    answer_collection_code character varying(120),
    hit_policy character varying(20) DEFAULT 'first_match'::character varying NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    current_revision_id uuid,
    published_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.guided_process_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "position" integer NOT NULL,
    kind character varying(20) NOT NULL,
    process_flow_code character varying(120),
    required_condition jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.guided_process_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    process_id uuid NOT NULL,
    revision integer NOT NULL,
    status character varying(20) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.guided_process_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    process_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "position" integer NOT NULL,
    visibility_condition jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.guided_processes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    collection_id uuid NOT NULL,
    application_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    current_revision_id uuid,
    published_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.process_flow_definition_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    process_flow_id uuid NOT NULL,
    revision integer NOT NULL,
    status character varying(20) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.process_flow_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    description text,
    collection_id uuid,
    version integer DEFAULT 1,
    is_active boolean DEFAULT false,
    canvas jsonb DEFAULT '{"nodes": [], "connections": []}'::jsonb NOT NULL,
    trigger_type character varying(50) DEFAULT 'record_created'::character varying NOT NULL,
    trigger_conditions jsonb,
    trigger_schedule character varying(100),
    trigger_filter jsonb,
    run_as character varying(50) DEFAULT 'system'::character varying,
    timeout_minutes integer DEFAULT 60,
    max_retries integer DEFAULT 3,
    execution_count integer DEFAULT 0,
    success_count integer DEFAULT 0,
    failure_count integer DEFAULT 0,
    last_executed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    application_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    current_revision_id uuid,
    published_at timestamp with time zone,
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL,
    CONSTRAINT chk_trigger_type CHECK (((trigger_type)::text = ANY ((ARRAY['record_created'::character varying, 'record_updated'::character varying, 'field_changed'::character varying, 'scheduled'::character varying, 'manual'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE automation.process_flow_execution_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id uuid,
    node_id character varying(100) NOT NULL,
    node_type character varying(50) NOT NULL,
    node_name character varying(255),
    action character varying(100) NOT NULL,
    status character varying(50) NOT NULL,
    input_data jsonb,
    output_data jsonb,
    error_message text,
    error_stack text,
    execution_time_ms integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_history_status CHECK (((status)::text = ANY ((ARRAY['started'::character varying, 'completed'::character varying, 'failed'::character varying, 'skipped'::character varying, 'waiting'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE automation.process_flow_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    process_flow_id uuid,
    record_id uuid NOT NULL,
    collection_id uuid,
    state character varying(50) DEFAULT 'running'::character varying,
    current_node_id character varying(100),
    context jsonb DEFAULT '{}'::jsonb,
    error_message text,
    error_stack text,
    retry_count integer DEFAULT 0,
    started_by uuid,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_instance_state CHECK (((state)::text = ANY ((ARRAY['running'::character varying, 'waiting_approval'::character varying, 'waiting_condition'::character varying, 'paused'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'timed_out'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE automation.scheduled_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(128) NOT NULL,
    description text,
    collection_id uuid,
    frequency character varying(16) DEFAULT 'daily'::character varying NOT NULL,
    cron_expression character varying(64),
    timezone character varying(64) DEFAULT 'UTC'::character varying NOT NULL,
    action_type character varying(16) DEFAULT 'no_code'::character varying NOT NULL,
    actions jsonb,
    script text,
    query_filter jsonb,
    is_active boolean DEFAULT true NOT NULL,
    next_run_at timestamp with time zone,
    last_run_at timestamp with time zone,
    last_run_status character varying(16),
    consecutive_failures integer DEFAULT 0 NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE automation.sla_breaches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sla_instance_id uuid,
    sla_definition_id uuid,
    record_id uuid NOT NULL,
    collection_id uuid,
    target_seconds integer NOT NULL,
    elapsed_seconds integer NOT NULL,
    breach_amount_seconds integer NOT NULL,
    resolved_at timestamp with time zone,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE automation.sla_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    description text,
    collection_id uuid,
    sla_type character varying(50) DEFAULT 'resolution'::character varying NOT NULL,
    target_minutes integer NOT NULL,
    warning_threshold_1 integer DEFAULT 75,
    warning_threshold_2 integer DEFAULT 90,
    business_hours_id uuid,
    conditions jsonb,
    pause_conditions jsonb,
    escalations jsonb DEFAULT '[]'::jsonb,
    priority integer DEFAULT 100,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_sla_type CHECK (((sla_type)::text = ANY ((ARRAY['response'::character varying, 'resolution'::character varying, 'custom'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE automation.sla_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sla_definition_id uuid,
    record_id uuid NOT NULL,
    collection_id uuid,
    state character varying(50) DEFAULT 'active'::character varying,
    elapsed_seconds integer DEFAULT 0,
    remaining_seconds integer NOT NULL,
    target_seconds integer NOT NULL,
    start_time timestamp with time zone NOT NULL,
    pause_time timestamp with time zone,
    complete_time timestamp with time zone,
    breach_time timestamp with time zone,
    target_time timestamp with time zone NOT NULL,
    total_pause_seconds integer DEFAULT 0,
    pause_count integer DEFAULT 0,
    warning_1_sent boolean DEFAULT false,
    warning_1_sent_at timestamp with time zone,
    warning_2_sent boolean DEFAULT false,
    warning_2_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_sla_instance_state CHECK (((state)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'completed'::character varying, 'breached'::character varying, 'cancelled'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE automation.state_change_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    record_id uuid NOT NULL,
    collection_id uuid,
    state_machine_id uuid,
    from_state character varying(100),
    to_state character varying(100) NOT NULL,
    transition_name character varying(100),
    changed_by uuid,
    change_reason text,
    duration_in_state integer,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE automation.state_machine_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    description text,
    collection_id uuid,
    state_field character varying(100) NOT NULL,
    states jsonb DEFAULT '[]'::jsonb NOT NULL,
    transitions jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_anomalies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    anomaly_type character varying(100) NOT NULL,
    severity character varying(20) NOT NULL,
    description text NOT NULL,
    affected_entity character varying(255),
    affected_entity_id uuid,
    metric_value numeric(15,4),
    expected_value numeric(15,4),
    deviation_percentage numeric(7,4),
    confidence numeric(5,4),
    recommended_actions jsonb,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_by uuid,
    resolution_notes text,
    detected_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_audit_trail (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    user_name character varying,
    user_role character varying,
    conversation_id uuid,
    user_message text,
    ava_response text,
    action_type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    action_label character varying,
    action_target character varying,
    target_collection character varying,
    target_record_id uuid,
    target_display_value character varying,
    before_data jsonb,
    after_data jsonb,
    action_params jsonb,
    is_revertible boolean DEFAULT false NOT NULL,
    ip_address character varying,
    user_agent text,
    session_id uuid,
    error_message text,
    error_code character varying,
    duration_ms integer,
    completed_at timestamp with time zone,
    reverted_at timestamp with time zone,
    reverted_by uuid,
    revert_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    suggested_actions jsonb,
    preview_payload jsonb,
    approval_payload jsonb,
    execution_payload jsonb
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    layout jsonb DEFAULT '{}'::jsonb,
    action_bindings jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_contexts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid,
    context_type character varying(50) NOT NULL,
    context_key character varying(100) NOT NULL,
    context_value jsonb NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    title text,
    message_count integer DEFAULT 0 NOT NULL,
    last_activity_at timestamp with time zone,
    context_summary text,
    session_metadata jsonb,
    escalated_to uuid,
    escalation_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id character varying(128)
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_feedback (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    message_id uuid,
    suggestion_id uuid,
    feedback_type character varying(50) NOT NULL,
    rating integer,
    comment text,
    expected_response text,
    is_processed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_global_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ava_enabled boolean DEFAULT true NOT NULL,
    read_only_mode boolean DEFAULT false NOT NULL,
    allow_create_actions boolean DEFAULT true NOT NULL,
    allow_update_actions boolean DEFAULT true NOT NULL,
    allow_delete_actions boolean DEFAULT false NOT NULL,
    allow_execute_actions boolean DEFAULT true NOT NULL,
    default_requires_confirmation boolean DEFAULT true NOT NULL,
    system_read_only_collections jsonb DEFAULT '[]'::jsonb NOT NULL,
    user_rate_limit_per_hour integer DEFAULT 100 NOT NULL,
    global_rate_limit_per_hour integer DEFAULT 10000 NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_intents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    category character varying(50) NOT NULL,
    intent_name character varying(100) NOT NULL,
    confidence numeric(5,4) NOT NULL,
    detected_entities jsonb,
    required_permissions jsonb,
    is_clarification_needed boolean DEFAULT false NOT NULL,
    clarification_question text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_knowledge_embeddings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    source_type character varying(50) NOT NULL,
    source_id uuid NOT NULL,
    content_hash character varying(64) NOT NULL,
    content text NOT NULL,
    embedding jsonb NOT NULL,
    embedding_model character varying(100) NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    intent_id uuid,
    detected_entities jsonb,
    sentiment_score numeric(5,4),
    tool_calls jsonb,
    token_count integer,
    response_time_ms integer,
    model_used character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_permission_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    collection_code character varying,
    action_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    requires_confirmation boolean DEFAULT true NOT NULL,
    allowed_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    excluded_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_predictions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prediction_type character varying(50) NOT NULL,
    target_date date NOT NULL,
    prediction_value jsonb NOT NULL,
    confidence numeric(5,4),
    model_version character varying(100),
    input_features jsonb,
    is_active boolean DEFAULT true NOT NULL,
    actual_value jsonb,
    accuracy numeric(5,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    verified_at timestamp with time zone
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_prompt_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    policy jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_proposal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind character varying(100) NOT NULL,
    payload jsonb NOT NULL,
    rationale text,
    state public.ava_proposal_state_enum NOT NULL,
    actor_id uuid,
    preview_result jsonb,
    execution_result jsonb,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_suggestions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid,
    suggestion_type character varying(50) NOT NULL,
    target_entity character varying(255),
    target_field character varying(255),
    suggested_value jsonb NOT NULL,
    explanation text,
    confidence numeric(5,4),
    is_accepted boolean,
    user_feedback text,
    response_time_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_tools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    input_schema jsonb DEFAULT '{}'::jsonb,
    output_schema jsonb DEFAULT '{}'::jsonb,
    permission_requirements jsonb DEFAULT '{}'::jsonb,
    approval_policy character varying(30) DEFAULT 'always'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    routing_rules jsonb DEFAULT '{}'::jsonb,
    response_formats jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE ava.ava_usage_metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    metric_date date NOT NULL,
    metric_type character varying(100) NOT NULL,
    metric_value numeric(15,4) NOT NULL,
    dimensions jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.dataset_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    source_collection_code character varying(120) NOT NULL,
    filter jsonb DEFAULT '{}'::jsonb NOT NULL,
    label_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    feature_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.dataset_snapshots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dataset_definition_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    snapshot_uri text,
    row_count integer,
    checksum character varying(64),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    requested_by uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.model_artifacts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    version character varying(50) NOT NULL,
    description text,
    dataset_snapshot_id uuid,
    artifact_bucket character varying(255) NOT NULL,
    artifact_key text NOT NULL,
    content_type character varying(120),
    checksum character varying(64),
    size_bytes bigint,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.model_deployments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    model_artifact_id uuid,
    target_type character varying(120) NOT NULL,
    target_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending_approval'::character varying NOT NULL,
    requested_by uuid,
    approved_by uuid,
    workflow_instance_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.model_evaluations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    model_artifact_id uuid,
    dataset_snapshot_id uuid,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    confusion_matrix jsonb DEFAULT '{}'::jsonb NOT NULL,
    calibration_stats jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE ava.model_training_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dataset_snapshot_id uuid,
    model_code character varying(120) NOT NULL,
    model_name character varying(255) NOT NULL,
    model_version character varying(50) NOT NULL,
    algorithm character varying(120) NOT NULL,
    hyperparameters jsonb DEFAULT '{}'::jsonb NOT NULL,
    training_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    model_artifact_id uuid,
    requested_by uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.auth_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    event_type character varying(50) NOT NULL,
    success boolean NOT NULL,
    ip_address character varying(45),
    user_agent text,
    geo_location jsonb,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.auth_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    password_min_length integer DEFAULT 12 NOT NULL,
    password_require_uppercase boolean DEFAULT true NOT NULL,
    password_require_lowercase boolean DEFAULT true NOT NULL,
    password_require_numbers boolean DEFAULT true NOT NULL,
    password_require_symbols boolean DEFAULT true NOT NULL,
    password_history_count integer DEFAULT 12 NOT NULL,
    password_expiry_days integer DEFAULT 90 NOT NULL,
    password_block_common boolean DEFAULT true NOT NULL,
    max_failed_attempts integer DEFAULT 5 NOT NULL,
    lockout_duration_minutes integer DEFAULT 30 NOT NULL,
    session_timeout_minutes integer DEFAULT 480 NOT NULL,
    max_concurrent_sessions integer DEFAULT 5 NOT NULL,
    remember_me_duration_days integer DEFAULT 30 NOT NULL,
    mfa_required boolean DEFAULT false NOT NULL,
    mfa_grace_period_days integer DEFAULT 7 NOT NULL,
    sso_enabled boolean DEFAULT false NOT NULL,
    sso_enforce boolean DEFAULT false NOT NULL,
    sso_config jsonb,
    ip_whitelist_enabled boolean DEFAULT false NOT NULL,
    ip_whitelist jsonb DEFAULT '[]'::jsonb NOT NULL,
    allowed_auth_methods jsonb DEFAULT '["password", "sso", "ldap"]'::jsonb NOT NULL,
    allow_password_reset boolean DEFAULT true NOT NULL,
    allow_profile_edit boolean DEFAULT true NOT NULL,
    allow_mfa_self_enrollment boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.behavioral_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    login_hours jsonb DEFAULT '{}'::jsonb,
    login_days jsonb DEFAULT '{}'::jsonb,
    known_locations jsonb DEFAULT '[]'::jsonb,
    known_ip_ranges jsonb DEFAULT '[]'::jsonb,
    known_devices jsonb DEFAULT '[]'::jsonb,
    avg_session_duration integer DEFAULT 30,
    avg_actions_per_session integer DEFAULT 10,
    last_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    data_points integer DEFAULT 0,
    confidence_score integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE identity.delegations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    delegator_id uuid NOT NULL,
    delegate_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying,
    delegated_permissions jsonb DEFAULT '[]'::jsonb,
    delegated_roles jsonb DEFAULT '[]'::jsonb,
    scope_restrictions jsonb,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    requires_approval boolean DEFAULT false,
    approved_by uuid,
    approved_at timestamp with time zone,
    revoked_by uuid,
    revoked_at timestamp with time zone,
    revocation_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE identity.email_verification_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    email character varying(320) NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.group_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_manager boolean DEFAULT false NOT NULL,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.group_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    group_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    parent_id uuid,
    hierarchy_level integer DEFAULT 0 NOT NULL,
    hierarchy_path character varying(500),
    type character varying(50) DEFAULT 'standard'::character varying NOT NULL,
    membership_rules jsonb,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    icon character varying(100),
    color character varying(50),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.impersonation_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    impersonator_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    reason text NOT NULL,
    is_active boolean DEFAULT true,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    ip_address character varying(45) NOT NULL,
    user_agent text,
    actions_log jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE identity.ldap_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    host character varying NOT NULL,
    port integer DEFAULT 389 NOT NULL,
    secure boolean DEFAULT false NOT NULL,
    "bindDn" character varying,
    "bindPassword" character varying,
    "searchBase" character varying NOT NULL,
    "userSearchFilter" character varying NOT NULL,
    "usernameAttribute" character varying DEFAULT 'uid'::character varying NOT NULL,
    "emailAttribute" character varying DEFAULT 'mail'::character varying NOT NULL,
    "fullNameAttribute" character varying DEFAULT 'cn'::character varying NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.magic_link_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(320) NOT NULL,
    user_id uuid,
    token character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    ip_address character varying(45),
    user_agent text,
    redirect_url text,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE identity.mfa_methods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    secret text,
    recovery_codes text,
    enabled boolean DEFAULT false NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.nav_profile_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    profile_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    code character varying(100) NOT NULL,
    label character varying(255) NOT NULL,
    icon character varying(100),
    route character varying(500),
    external_url character varying(500),
    parent_id uuid,
    "position" integer DEFAULT 0 NOT NULL,
    visibility_expression text,
    required_permission character varying(100),
    is_visible boolean DEFAULT true NOT NULL,
    is_expanded boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.nav_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    scope character varying(50) DEFAULT 'role'::character varying NOT NULL,
    role_id uuid,
    group_id uuid,
    user_id uuid,
    priority integer DEFAULT 100 NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    template_key character varying(100),
    auto_assign_roles text,
    auto_assign_expression text,
    is_locked boolean DEFAULT false NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.password_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.password_policies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "minLength" integer DEFAULT 8 NOT NULL,
    "requireUppercase" boolean DEFAULT false NOT NULL,
    "requireLowercase" boolean DEFAULT false NOT NULL,
    "requireNumbers" boolean DEFAULT false NOT NULL,
    "requireSpecialChars" boolean DEFAULT false NOT NULL,
    "expirationDays" integer DEFAULT 90 NOT NULL,
    "historyCount" integer DEFAULT 5 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    "lockoutMinutes" integer DEFAULT 30 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.password_reset_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.platform_permissions (
    code text NOT NULL,
    plane text NOT NULL,
    domain text NOT NULL,
    resource text,
    action text NOT NULL,
    dangerous boolean DEFAULT false NOT NULL,
    description text NOT NULL,
    CONSTRAINT platform_permissions_plane_check CHECK (plane IN ('instance', 'control-plane')),
    CONSTRAINT platform_permissions_pkey PRIMARY KEY (code)
);`);
    await queryRunner.query(`CREATE TABLE identity.refresh_tokens (
    token_hash text NOT NULL,
    family_id uuid NOT NULL,
    parent_token_id text,
    user_id uuid NOT NULL,
    instance_id uuid,
    session_id uuid NOT NULL,
    device_label text,
    user_agent_hash text,
    ip_address_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    replaced_by_token_id text,
    revoked_reason text,
    CONSTRAINT refresh_tokens_revoked_reason_check CHECK (((revoked_reason IS NULL) OR (revoked_reason = ANY (ARRAY['reuse_detected'::text, 'logout'::text, 'password_change'::text, 'admin_revoke'::text, 'family_expired'::text, 'logout_all_devices'::text]))))
);`);
    await queryRunner.query(`CREATE TABLE identity.role_permissions (
    role_id uuid NOT NULL,
    permission_code text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_by uuid,
    CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_code)
);`);
    await queryRunner.query(`CREATE TABLE identity.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    parent_id uuid,
    hierarchy_level integer DEFAULT 0 NOT NULL,
    hierarchy_path character varying(500),
    scope character varying(50) DEFAULT 'global'::character varying NOT NULL,
    max_users integer,
    weight integer DEFAULT 0 NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    icon character varying(100),
    color character varying(50),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.saml_auth_states (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid NOT NULL,
    relay_state character varying(255) NOT NULL,
    redirect_uri character varying(2048) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE identity.security_alerts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    alert_type character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    severity character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'new'::character varying,
    risk_score integer DEFAULT 50,
    details jsonb,
    recommended_actions jsonb DEFAULT '[]'::jsonb,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolution_notes text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE identity.service_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(80) NOT NULL,
    client_secret_hash character varying(255) NOT NULL,
    allowed_scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    description text,
    owner_team character varying(80),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    secret_rotated_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT "CHK_service_accounts_status" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'revoked'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE identity.service_token_signing_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key_id character varying(80) NOT NULL,
    algorithm character varying(20) DEFAULT 'ES256'::character varying NOT NULL,
    public_key_pem text NOT NULL,
    backend_ref character varying(255),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    retired_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_by uuid,
    CONSTRAINT "CHK_service_token_signing_keys_status" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'retired'::character varying, 'archived'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE identity.sso_providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    slug character varying NOT NULL,
    description text,
    type character varying NOT NULL,
    issuer character varying,
    client_id character varying,
    client_secret character varying,
    authorization_url character varying,
    token_url character varying,
    user_info_url character varying,
    jwks_url character varying,
    scopes character varying,
    entity_id character varying,
    sso_url character varying,
    slo_url character varying,
    certificate text,
    jit_enabled boolean DEFAULT false NOT NULL,
    jit_default_roles jsonb,
    jit_group_mapping jsonb,
    jit_update_profile boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb,
    button_text character varying,
    button_icon_url character varying,
    display_order integer DEFAULT 0 NOT NULL,
    allowed_domains jsonb,
    logout_redirect_url character varying,
    enabled boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);`);
    await queryRunner.query(`CREATE TABLE identity.trusted_devices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    device_fingerprint character varying(255) NOT NULL,
    device_name character varying(255) NOT NULL,
    device_type character varying(50) NOT NULL,
    browser character varying(100),
    os character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying,
    trust_score integer DEFAULT 50,
    known_ips jsonb DEFAULT '[]'::jsonb,
    known_locations jsonb DEFAULT '[]'::jsonb,
    verification_method character varying(50),
    trusted_until timestamp with time zone,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    login_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE identity.user_invitations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(320) NOT NULL,
    token character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    role_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    group_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    message text,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_user_id uuid,
    invited_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.user_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    source character varying(50) DEFAULT 'direct'::character varying NOT NULL,
    source_id uuid,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE identity.webauthn_challenges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    challenge character varying(255) NOT NULL,
    user_id uuid,
    type character varying(20) NOT NULL,
    session_data jsonb,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE identity.webauthn_credentials (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    credential_id text NOT NULL,
    public_key text NOT NULL,
    sign_count bigint DEFAULT 0,
    credential_type character varying(50) DEFAULT 'public-key'::character varying,
    transports jsonb DEFAULT '[]'::jsonb,
    name character varying(255) NOT NULL,
    aaguid character varying(36),
    is_discoverable boolean DEFAULT true,
    is_backed_up boolean DEFAULT false,
    device_info jsonb,
    last_used_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE insights.alert_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    conditions jsonb DEFAULT '{}'::jsonb,
    actions jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE insights.dashboard_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    layout jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    scope character varying(20) DEFAULT 'tenant'::character varying NOT NULL,
    CONSTRAINT "CHK_dashboard_definitions_scope" CHECK (((scope)::text = ANY ((ARRAY['system'::character varying, 'tenant'::character varying, 'role'::character varying, 'personal'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE insights.metric_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    source_type character varying(40) NOT NULL,
    source_config jsonb DEFAULT '{}'::jsonb,
    aggregation character varying(20) NOT NULL,
    cadence character varying(20) NOT NULL,
    retention_days integer DEFAULT 90,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    definition_owner_id uuid
);`);
    await queryRunner.query(`CREATE TABLE insights.metric_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_code character varying(100) NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    value numeric(18,4) NOT NULL,
    dimensions jsonb,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE integrations.api_keys (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    key_hash character varying(255) NOT NULL,
    key_prefix character varying(20) NOT NULL,
    scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    ip_whitelist jsonb,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    last_used_ip character varying(45),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE integrations.api_request_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    api_key_id uuid,
    oauth_client_id uuid,
    user_id uuid,
    method character varying(10) NOT NULL,
    path text NOT NULL,
    query_params jsonb,
    request_headers jsonb,
    request_body_size integer,
    response_status integer,
    response_body_size integer,
    duration_ms integer,
    ip_address character varying(45),
    user_agent text,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE integrations.connector_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    connector_id uuid,
    name character varying(255) NOT NULL,
    description text,
    config jsonb NOT NULL,
    credentials jsonb,
    status character varying(50) DEFAULT 'disconnected'::character varying,
    last_connected_at timestamp with time zone,
    last_sync_at timestamp with time zone,
    error_message text,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    code character varying(120),
    credential_ref text,
    updated_by uuid
);`);
    await queryRunner.query(`CREATE TABLE integrations.export_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    source_collection_id uuid,
    query jsonb,
    format character varying(50) DEFAULT 'csv'::character varying NOT NULL,
    options jsonb DEFAULT '{}'::jsonb,
    include_fields jsonb,
    exclude_fields jsonb,
    status character varying(50) DEFAULT 'pending'::character varying,
    progress integer DEFAULT 0,
    total_records integer,
    exported_records integer DEFAULT 0,
    file_name character varying(500),
    file_size bigint,
    file_url text,
    expires_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE integrations.external_connectors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) NOT NULL,
    version character varying(20) DEFAULT '1.0.0'::character varying,
    icon_url text,
    documentation_url text,
    config_schema jsonb NOT NULL,
    auth_type character varying(50) NOT NULL,
    supported_operations jsonb DEFAULT '[]'::jsonb,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid
);`);
    await queryRunner.query(`CREATE TABLE integrations.import_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    source_type character varying(50) NOT NULL,
    source_config jsonb,
    file_name character varying(500),
    file_size bigint,
    file_type character varying(100),
    target_collection_id uuid,
    field_mapping jsonb DEFAULT '[]'::jsonb NOT NULL,
    options jsonb DEFAULT '{}'::jsonb,
    status character varying(50) DEFAULT 'pending'::character varying,
    progress integer DEFAULT 0,
    total_records integer,
    processed_records integer DEFAULT 0,
    successful_records integer DEFAULT 0,
    failed_records integer DEFAULT 0,
    skipped_records integer DEFAULT 0,
    error_log jsonb DEFAULT '[]'::jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE integrations.oauth_access_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    access_token character varying(512) NOT NULL,
    client_id uuid,
    user_id uuid,
    scope text,
    expires_at timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE integrations.oauth_authorization_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(255) NOT NULL,
    client_id uuid,
    user_id uuid NOT NULL,
    redirect_uri text NOT NULL,
    scope text,
    code_challenge character varying(255),
    code_challenge_method character varying(10),
    state character varying(255),
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE integrations.oauth_clients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    client_id character varying(255) NOT NULL,
    client_secret_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    client_type character varying(50) DEFAULT 'confidential'::character varying NOT NULL,
    redirect_uris jsonb DEFAULT '[]'::jsonb NOT NULL,
    allowed_scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    allowed_grant_types jsonb DEFAULT '["authorization_code", "refresh_token"]'::jsonb NOT NULL,
    access_token_lifetime_seconds integer DEFAULT 3600,
    refresh_token_lifetime_seconds integer DEFAULT 2592000,
    require_pkce boolean DEFAULT false,
    is_active boolean DEFAULT true,
    logo_url text,
    terms_url text,
    privacy_url text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE integrations.oauth_refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    refresh_token character varying(512) NOT NULL,
    access_token_id uuid,
    client_id uuid,
    user_id uuid,
    scope text,
    expires_at timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE integrations.sync_configurations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    connection_id uuid,
    mapping_id uuid,
    schedule character varying(100),
    direction character varying(20) DEFAULT 'bidirectional'::character varying,
    sync_mode character varying(50) DEFAULT 'incremental'::character varying,
    conflict_resolution character varying(50) DEFAULT 'source_wins'::character varying,
    batch_size integer DEFAULT 100,
    is_active boolean DEFAULT true,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    run_count integer DEFAULT 0,
    success_count integer DEFAULT 0,
    failure_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE integrations.sync_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    configuration_id uuid,
    status character varying(50) DEFAULT 'running'::character varying,
    direction character varying(20),
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    duration_ms bigint,
    records_processed integer DEFAULT 0,
    records_created integer DEFAULT 0,
    records_updated integer DEFAULT 0,
    records_deleted integer DEFAULT 0,
    records_skipped integer DEFAULT 0,
    records_failed integer DEFAULT 0,
    conflicts_detected integer DEFAULT 0,
    conflicts_resolved integer DEFAULT 0,
    error_message text,
    error_details jsonb,
    log jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE integrations.webhook_deliveries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    subscription_id uuid,
    event_type character varying(100) NOT NULL,
    event_id character varying(255) NOT NULL,
    payload jsonb NOT NULL,
    request_headers jsonb,
    response_status integer,
    response_body text,
    response_headers jsonb,
    attempt_count integer DEFAULT 1,
    max_attempts integer DEFAULT 5,
    status character varying(50) DEFAULT 'pending'::character varying,
    error_message text,
    duration_ms integer,
    scheduled_at timestamp with time zone DEFAULT now(),
    delivered_at timestamp with time zone,
    next_retry_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE integrations.webhook_subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    endpoint_url text NOT NULL,
    secret character varying(255) NOT NULL,
    events jsonb DEFAULT '[]'::jsonb NOT NULL,
    collection_id uuid,
    filter_conditions jsonb,
    http_method character varying(10) DEFAULT 'POST'::character varying,
    headers jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    verify_ssl boolean DEFAULT true,
    retry_count integer DEFAULT 5,
    retry_delay_seconds integer DEFAULT 30,
    timeout_seconds integer DEFAULT 30,
    last_triggered_at timestamp with time zone,
    last_success_at timestamp with time zone,
    last_failure_at timestamp with time zone,
    failure_count integer DEFAULT 0,
    success_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE metadata.application_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    revision integer NOT NULL,
    status character varying(20) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.applications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    scope character varying(120),
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    current_revision_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.change_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    application_id uuid NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    changes jsonb DEFAULT '[]'::jsonb NOT NULL,
    completed_at timestamp with time zone,
    applied_at timestamp with time zone,
    source_instance_id character varying(120),
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.choice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    choice_list_id uuid NOT NULL,
    value character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    color character varying(50),
    icon character varying(100),
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.choice_lists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.collection_constraints (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    collection_id uuid NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    constraint_type character varying(20) NOT NULL,
    columns text[],
    expression text,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_collection_constraint_definition CHECK (((((constraint_type)::text = 'unique'::text) AND (columns IS NOT NULL)) OR (((constraint_type)::text = 'check'::text) AND (expression IS NOT NULL)))),
    CONSTRAINT chk_collection_constraint_type CHECK (((constraint_type)::text = ANY ((ARRAY['unique'::character varying, 'check'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE metadata.collection_definition_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    collection_id uuid NOT NULL,
    revision integer NOT NULL,
    status character varying(20) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.collection_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    plural_name character varying(255),
    description text,
    category character varying(100),
    application_id uuid NOT NULL,
    owner_type character varying(20) DEFAULT 'custom'::character varying NOT NULL,
    table_name character varying(100) NOT NULL,
    label_property character varying(100) DEFAULT 'name'::character varying NOT NULL,
    secondary_label_property character varying(100),
    is_extensible boolean DEFAULT true NOT NULL,
    is_audited boolean DEFAULT true NOT NULL,
    enable_versioning boolean DEFAULT false NOT NULL,
    enable_attachments boolean DEFAULT true NOT NULL,
    enable_activity_log boolean DEFAULT true NOT NULL,
    enable_search boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    icon character varying(100),
    color character varying(50),
    default_access character varying(20) DEFAULT 'read'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner public.schema_owner DEFAULT 'custom'::public.schema_owner NOT NULL,
    sync_status public.sync_status DEFAULT 'synced'::public.sync_status NOT NULL,
    sync_error text,
    last_synced_at timestamp with time zone,
    physical_checksum character varying(64),
    is_locked boolean DEFAULT false NOT NULL,
    platform_version character varying(20),
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    current_revision_id uuid,
    published_at timestamp with time zone,
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL,
    secure_fields_by_default boolean DEFAULT true NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.collection_indexes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    collection_id uuid NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    index_type character varying(20) DEFAULT 'btree'::character varying NOT NULL,
    columns text[] NOT NULL,
    is_unique boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_collection_index_type CHECK (((index_type)::text = ANY ((ARRAY['btree'::character varying, 'gin'::character varying, 'trigram'::character varying, 'vector'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE metadata.dependent_review_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    collection_code character varying(120) NOT NULL,
    property_code character varying(120) NOT NULL,
    property_id uuid,
    change_kind character varying(16) NOT NULL,
    classification character varying(16) NOT NULL,
    entity_type character varying(32) NOT NULL,
    entity_id uuid NOT NULL,
    entity_label character varying(255) NOT NULL,
    href text,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'needs_review'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    resolution_note text
);`);
    await queryRunner.query(`CREATE TABLE metadata.display_rule_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_rule_id uuid NOT NULL,
    revision integer NOT NULL,
    status character varying(20) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.display_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    collection_id uuid NOT NULL,
    application_id uuid NOT NULL,
    condition jsonb DEFAULT '{}'::jsonb NOT NULL,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    current_revision_id uuid,
    published_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.form_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    collection_id uuid NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    layout jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    application_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    current_version_id uuid,
    published_at timestamp with time zone,
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.form_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    form_id uuid NOT NULL,
    version integer NOT NULL,
    layout jsonb NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    published_by uuid,
    published_at timestamp with time zone
);`);
    await queryRunner.query(`CREATE TABLE metadata.instance_branding (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    default_theme_id uuid,
    theme_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    logo_url character varying(500),
    logo_dark_url character varying(500),
    favicon_url character varying(500),
    primary_color character varying(7),
    accent_color character varying(7),
    custom_css text,
    allow_user_customization boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.locales (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    direction character varying(5) DEFAULT 'ltr'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.localization_bundles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    locale_id uuid,
    locale_code character varying(20) NOT NULL,
    entries jsonb DEFAULT '{}'::jsonb NOT NULL,
    checksum character varying(64) NOT NULL,
    published_by uuid,
    published_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.module_security (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    module_id uuid NOT NULL,
    role_id uuid NOT NULL,
    "canView" boolean DEFAULT true NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.modules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying NOT NULL,
    slug character varying,
    label character varying NOT NULL,
    icon character varying,
    sort_order integer DEFAULT 0 NOT NULL,
    type character varying DEFAULT 'list'::character varying NOT NULL,
    route character varying,
    target_config jsonb,
    application_key character varying,
    is_active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.nav_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    key character varying NOT NULL,
    label character varying NOT NULL,
    icon character varying,
    type character varying NOT NULL,
    module_key character varying,
    url character varying,
    parent_id uuid,
    "order" integer DEFAULT 0 NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    visibility jsonb,
    context_tags text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.nav_patches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    operation character varying NOT NULL,
    target_node_key character varying NOT NULL,
    payload jsonb,
    priority integer DEFAULT 0 NOT NULL,
    description character varying,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.navigation_module_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    navigation_module_id uuid NOT NULL,
    revision integer NOT NULL,
    status character varying(20) NOT NULL,
    layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.navigation_modules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    application_id uuid NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.navigation_variants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    navigation_module_id uuid NOT NULL,
    scope character varying(20) NOT NULL,
    scope_key character varying(120),
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.pack_install_locks (
    lock_key character varying(100) NOT NULL,
    lock_holder character varying(100),
    lock_acquired_at timestamp with time zone,
    lock_expires_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.pack_object_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    release_record_id uuid NOT NULL,
    object_type character varying(30) NOT NULL,
    object_key character varying(255) NOT NULL,
    object_hash character varying(64) NOT NULL,
    object_id uuid,
    content jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pack_object_hash CHECK (((object_hash)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT chk_pack_object_type CHECK (((object_type)::text = ANY ((ARRAY['metadata'::character varying, 'access'::character varying, 'views'::character varying, 'automation'::character varying, 'workflows'::character varying, 'insights'::character varying, 'ava'::character varying, 'seed'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE metadata.pack_object_states (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    object_type character varying(30) NOT NULL,
    object_key character varying(255) NOT NULL,
    pack_code character varying(200) NOT NULL,
    current_revision_id uuid NOT NULL,
    current_hash character varying(64) NOT NULL,
    object_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pack_object_state_hash CHECK (((current_hash)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT chk_pack_object_state_type CHECK (((object_type)::text = ANY ((ARRAY['metadata'::character varying, 'access'::character varying, 'views'::character varying, 'automation'::character varying, 'workflows'::character varying, 'insights'::character varying, 'ava'::character varying, 'seed'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE metadata.pack_release_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pack_code character varying(200) NOT NULL,
    pack_release_id character varying(50) NOT NULL,
    status character varying(30) NOT NULL,
    manifest jsonb NOT NULL,
    artifact_sha256 character varying(64),
    install_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    applied_by uuid,
    applied_by_type character varying(20) DEFAULT 'system'::character varying NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    rollback_of_release_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pack_release_actor CHECK (((applied_by_type)::text = ANY ((ARRAY['user'::character varying, 'system'::character varying])::text[]))),
    CONSTRAINT chk_pack_release_id_format CHECK (((pack_release_id)::text ~ '^[0-9]{8}\.[0-9]{3,}$'::text)),
    CONSTRAINT chk_pack_release_sha256 CHECK (((artifact_sha256 IS NULL) OR ((artifact_sha256)::text ~ '^[a-f0-9]{64}$'::text))),
    CONSTRAINT chk_pack_release_status CHECK (((status)::text = ANY ((ARRAY['applying'::character varying, 'applied'::character varying, 'failed'::character varying, 'rolled_back'::character varying, 'skipped'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE metadata.property_definition_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    property_id uuid NOT NULL,
    revision integer NOT NULL,
    status character varying(20) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.property_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    collection_id uuid NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    property_type_id uuid NOT NULL,
    column_name character varying(100) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    is_unique boolean DEFAULT false NOT NULL,
    is_indexed boolean DEFAULT false NOT NULL,
    validation_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    default_value text,
    default_value_type character varying(50) DEFAULT 'static'::character varying NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    is_readonly boolean DEFAULT false NOT NULL,
    display_format character varying(100),
    placeholder character varying(255),
    help_text text,
    reference_collection_id uuid,
    reference_display_property character varying(100),
    reference_filter jsonb,
    choice_list_id uuid,
    owner_type character varying(20) DEFAULT 'custom'::character varying NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_searchable boolean DEFAULT false NOT NULL,
    is_sortable boolean DEFAULT true NOT NULL,
    is_filterable boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner public.schema_owner DEFAULT 'custom'::public.schema_owner NOT NULL,
    sync_status public.sync_status DEFAULT 'synced'::public.sync_status NOT NULL,
    sync_error text,
    is_locked boolean DEFAULT false NOT NULL,
    platform_version character varying(20),
    custom_property_prefix character varying(10) DEFAULT 'x_'::character varying,
    is_phi boolean DEFAULT false NOT NULL,
    is_pii boolean DEFAULT false NOT NULL,
    is_sensitive boolean DEFAULT false NOT NULL,
    masking_strategy character varying(20) DEFAULT 'none'::character varying NOT NULL,
    mask_value character varying(50),
    requires_break_glass boolean DEFAULT false NOT NULL,
    application_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    current_revision_id uuid,
    published_at timestamp with time zone,
    behavioral_attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.property_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    base_type character varying(50) NOT NULL,
    default_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    default_widget character varying(50),
    icon character varying(50),
    is_system boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.schema_change_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type character varying(20) NOT NULL,
    entity_id uuid NOT NULL,
    entity_code character varying(100) NOT NULL,
    change_type character varying(20) NOT NULL,
    change_source character varying(20) NOT NULL,
    before_state jsonb,
    after_state jsonb,
    ddl_statements text[],
    performed_by uuid,
    performed_by_type character varying(20) NOT NULL,
    success boolean DEFAULT true NOT NULL,
    error_message text,
    is_rolled_back boolean DEFAULT false,
    rolled_back_at timestamp with time zone,
    rolled_back_by uuid,
    rollback_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_change_source CHECK (((change_source)::text = ANY ((ARRAY['api'::character varying, 'migration'::character varying, 'sync'::character varying, 'manual'::character varying, 'system'::character varying])::text[]))),
    CONSTRAINT chk_change_type CHECK (((change_type)::text = ANY ((ARRAY['create'::character varying, 'update'::character varying, 'delete'::character varying, 'sync'::character varying, 'rollback'::character varying])::text[]))),
    CONSTRAINT chk_entity_type CHECK (((entity_type)::text = ANY ((ARRAY['collection'::character varying, 'property'::character varying])::text[]))),
    CONSTRAINT chk_performed_by_type CHECK (((performed_by_type)::text = ANY ((ARRAY['user'::character varying, 'system'::character varying, 'migration'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE metadata.schema_sync_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sync_lock_holder character varying(100),
    sync_lock_acquired_at timestamp with time zone,
    sync_lock_expires_at timestamp with time zone,
    last_full_sync_at timestamp with time zone,
    last_full_sync_duration_ms integer,
    last_full_sync_result character varying(20),
    last_drift_check_at timestamp with time zone,
    drift_detected boolean DEFAULT false,
    drift_details jsonb,
    total_collections integer DEFAULT 0,
    total_properties integer DEFAULT 0,
    orphaned_tables integer DEFAULT 0,
    orphaned_columns integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_sync_result CHECK (((last_full_sync_result IS NULL) OR ((last_full_sync_result)::text = ANY ((ARRAY['success'::character varying, 'issues_found'::character varying, 'error'::character varying, 'timeout'::character varying])::text[]))))
);`);
    await queryRunner.query(`CREATE TABLE metadata.search_dictionaries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    locale character varying(20) DEFAULT 'en'::character varying NOT NULL,
    entries jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.search_experiences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    scope character varying(20) NOT NULL,
    scope_key character varying(120),
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.search_index_state (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    collection_code character varying(120) NOT NULL,
    status character varying(20) DEFAULT 'idle'::character varying NOT NULL,
    last_indexed_at timestamp with time zone,
    last_cursor character varying(200),
    stats jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.search_sources (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    collection_code character varying(120) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.theme_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    theme_type character varying DEFAULT 'custom'::character varying NOT NULL,
    contrast_level character varying DEFAULT 'normal'::character varying NOT NULL,
    color_scheme character varying DEFAULT 'dark'::character varying NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_deletable boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.translation_keys (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    namespace character varying(120) NOT NULL,
    key character varying(200) NOT NULL,
    default_text text NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.translation_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    locale_id uuid,
    translation_key_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    requested_by uuid,
    reviewer_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    due_at timestamp with time zone,
    workflow_instance_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.translation_values (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    translation_key_id uuid,
    locale_id uuid,
    text text NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.user_theme_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    theme_id uuid,
    custom_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    color_scheme character varying DEFAULT 'auto'::character varying NOT NULL,
    auto_dark_mode boolean DEFAULT true NOT NULL,
    respect_reduced_motion boolean DEFAULT true NOT NULL,
    preference_source character varying DEFAULT 'manual'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.view_definition_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    view_definition_id uuid NOT NULL,
    revision integer NOT NULL,
    status character varying(20) NOT NULL,
    layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    widget_bindings jsonb DEFAULT '{}'::jsonb NOT NULL,
    actions jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.view_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    kind character varying(20) NOT NULL,
    target_collection_code character varying(120),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    application_id uuid NOT NULL,
    source character varying(120) DEFAULT 'custom'::character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.view_variants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    view_definition_id uuid NOT NULL,
    scope character varying(20) NOT NULL,
    scope_key character varying(120),
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.widget_catalog (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    kind character varying(50) NOT NULL,
    contract jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    application_id uuid NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.workspace_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    application_id uuid NOT NULL,
    default_collection_id uuid,
    theme_code character varying(120),
    source character varying(64) DEFAULT 'custom'::character varying NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.workspace_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    kind character varying(20) NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    layout jsonb DEFAULT '[]'::jsonb NOT NULL,
    source character varying(64) DEFAULT 'custom'::character varying NOT NULL,
    collection_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE metadata.workspace_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    page_id uuid NOT NULL,
    scope character varying(16) NOT NULL,
    scope_ref character varying(255),
    priority integer DEFAULT 100 NOT NULL,
    layout jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE notify.device_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform character varying(20) NOT NULL,
    device_name character varying(255),
    device_model character varying(100),
    os_version character varying(50),
    app_version character varying(50),
    is_active boolean DEFAULT true,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_device_platform CHECK (((platform)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE notify.in_app_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    icon character varying(100),
    priority character varying(20) DEFAULT 'medium'::character varying,
    actions jsonb,
    deep_link character varying(500),
    record_id uuid,
    collection_id uuid,
    read boolean DEFAULT false,
    read_at timestamp with time zone,
    dismissed boolean DEFAULT false,
    dismissed_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_in_app_priority CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE notify.notification_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_queue_id uuid,
    channel character varying(20) NOT NULL,
    recipient_id uuid NOT NULL,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    failed_at timestamp with time zone,
    error_message text,
    provider_id character varying(255),
    provider_response jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_notification_channel CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying, 'push'::character varying, 'in_app'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE notify.notification_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    recipient_id uuid NOT NULL,
    channels jsonb NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    scheduled_for timestamp with time zone,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    last_error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    idempotency_key character varying(64),
    CONSTRAINT chk_notification_priority CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT chk_notification_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'sent'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE notify.notification_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    description text,
    category character varying(100) DEFAULT 'general'::character varying NOT NULL,
    email_subject character varying(500),
    email_body_html text,
    email_body_text text,
    email_from_name character varying(255),
    email_from_address character varying(255),
    email_reply_to character varying(255),
    sms_body character varying(320),
    push_title character varying(255),
    push_body character varying(500),
    push_icon character varying(255),
    push_actions jsonb,
    in_app_title character varying(255),
    in_app_body text,
    in_app_icon character varying(100),
    in_app_priority character varying(20) DEFAULT 'medium'::character varying,
    in_app_actions jsonb,
    in_app_deep_link character varying(500),
    variables jsonb DEFAULT '[]'::jsonb,
    supported_channels jsonb DEFAULT '["email", "in_app"]'::jsonb,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE notify.user_notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    quiet_hours_enabled boolean DEFAULT false,
    quiet_hours_start time without time zone,
    quiet_hours_end time without time zone,
    quiet_hours_timezone character varying(50) DEFAULT 'UTC'::character varying,
    digest_mode boolean DEFAULT false,
    digest_frequency character varying(20) DEFAULT 'daily'::character varying,
    digest_time time without time zone DEFAULT '08:00:00'::time without time zone,
    email_enabled boolean DEFAULT true,
    sms_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT true,
    in_app_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_digest_frequency CHECK (((digest_frequency)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE public.access_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    resource character varying NOT NULL,
    action character varying NOT NULL,
    decision character varying NOT NULL,
    context jsonb,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.access_condition_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    rule_id uuid NOT NULL,
    logic character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.access_conditions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    rule_id uuid NOT NULL,
    field character varying NOT NULL,
    operator character varying NOT NULL,
    value character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.access_rule_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    rule_id uuid NOT NULL,
    action character varying NOT NULL,
    changes jsonb,
    performed_by uuid NOT NULL,
    "performedAt" timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    collection_code character varying(100),
    record_id uuid,
    action character varying(50) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    previous_hash character varying(64),
    hash character varying(64),
    permission_code character varying(100)
);`);
    await queryRunner.query(`CREATE TABLE public.collection_access_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    collection_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    role_id uuid,
    group_id uuid,
    user_id uuid,
    can_read boolean DEFAULT false NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_update boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    conditions jsonb,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rule_key character varying(120),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    effect character varying(10) DEFAULT 'allow'::character varying NOT NULL,
    CONSTRAINT "CHK_collection_access_rules_effect" CHECK (((effect)::text = ANY ((ARRAY['allow'::character varying, 'deny'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE public.formula_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    property_id uuid NOT NULL,
    record_id uuid NOT NULL,
    cached_value jsonb,
    value_type character varying(20) NOT NULL,
    formula_hash character varying(64) NOT NULL,
    dependencies jsonb DEFAULT '[]'::jsonb,
    calculated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    is_stale boolean DEFAULT false,
    stale_reason character varying(100),
    calculation_time_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_value_type CHECK (((value_type)::text = ANY ((ARRAY['string'::character varying, 'number'::character varying, 'boolean'::character varying, 'date'::character varying, 'datetime'::character varying, 'null'::character varying, 'array'::character varying, 'object'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE public.property_dependencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    depends_on_property_id uuid,
    depends_on_collection_id uuid,
    dependency_type character varying(20) NOT NULL,
    dependency_path text[],
    update_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_dependency_type CHECK (((dependency_type)::text = ANY ((ARRAY['formula'::character varying, 'rollup'::character varying, 'lookup'::character varying, 'hierarchical'::character varying, 'direct'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE public.config_change_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "configType" character varying NOT NULL,
    code character varying,
    "changeType" character varying NOT NULL,
    details jsonb,
    "userId" character varying,
    "changedAt" timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.field_mappings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    connection_id uuid,
    name character varying(255) NOT NULL,
    source_entity character varying(255) NOT NULL,
    target_collection_id uuid,
    direction character varying(20) DEFAULT 'bidirectional'::character varying,
    mappings jsonb DEFAULT '[]'::jsonb NOT NULL,
    transformations jsonb DEFAULT '[]'::jsonb,
    filters jsonb,
    sync_mode character varying(50) DEFAULT 'incremental'::character varying,
    conflict_resolution character varying(50) DEFAULT 'source_wins'::character varying,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);`);
    await queryRunner.query(`CREATE TABLE public.inline_editing_test (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    text_field character varying(255),
    long_text_field text,
    email_field character varying(255),
    url_field character varying(512),
    phone_field character varying(50),
    integer_field integer,
    decimal_field numeric(15,2),
    currency_field numeric(15,2),
    percent_field numeric(5,2),
    date_field date,
    datetime_field timestamp with time zone,
    time_field time without time zone,
    duration_field integer,
    boolean_field boolean DEFAULT false,
    status_field character varying(50),
    priority_field character varying(50),
    tags_field jsonb DEFAULT '[]'::jsonb,
    progress_field integer DEFAULT 0,
    assigned_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.instance_customizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    instance_id character varying(100) DEFAULT 'default-instance'::character varying NOT NULL,
    config_type character varying(50) NOT NULL,
    resource_key character varying(255) NOT NULL,
    customization_type character varying(20) DEFAULT 'override'::character varying NOT NULL,
    original_value jsonb,
    custom_value jsonb NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.instance_event_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type character varying(120) NOT NULL,
    collection_code character varying(120),
    record_id uuid,
    payload jsonb NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    locked_at timestamp with time zone,
    processed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.instance_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category character varying(100) NOT NULL,
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.instance_upgrade_impact (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    instance_id character varying(100) DEFAULT 'default-instance'::character varying NOT NULL,
    upgrade_manifest_id uuid,
    config_type character varying(50) NOT NULL,
    resource_key character varying(255) NOT NULL,
    impact_type character varying(50) NOT NULL,
    impact_severity character varying(20) DEFAULT 'low'::character varying NOT NULL,
    description text,
    current_instance_value jsonb,
    new_platform_value jsonb,
    suggested_resolution text,
    status character varying(30) DEFAULT 'pending_analysis'::character varying NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.key_metadata (
    kid text NOT NULL,
    provider text NOT NULL,
    kms_alias text,
    kms_arn text,
    algorithm text DEFAULT 'ES256'::text NOT NULL,
    state text NOT NULL,
    public_key_pem text NOT NULL,
    instance_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_at timestamp with time zone,
    retiring_at timestamp with time zone,
    retired_at timestamp with time zone,
    compromised_at timestamp with time zone,
    CONSTRAINT key_metadata_algorithm_check CHECK ((algorithm = 'ES256'::text)),
    CONSTRAINT key_metadata_provider_check CHECK ((provider = ANY (ARRAY['aws-kms'::text, 'local-es256'::text]))),
    CONSTRAINT key_metadata_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'active'::text, 'retiring'::text, 'retired'::text, 'compromised'::text])))
);`);
    await queryRunner.query(`CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.platform_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    value_type character varying(20) DEFAULT 'string'::character varying NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.property_access_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    property_id uuid,
    role_id uuid,
    group_id uuid,
    user_id uuid,
    can_read boolean DEFAULT true NOT NULL,
    can_write boolean DEFAULT true NOT NULL,
    conditions jsonb,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    masking_strategy character varying(20) DEFAULT 'NONE'::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rule_key character varying(120),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    effect character varying(10) DEFAULT 'allow'::character varying NOT NULL,
    wildcard_collection_id uuid,
    CONSTRAINT "CHK_property_access_rules_effect" CHECK (((effect)::text = ANY ((ARRAY['allow'::character varying, 'deny'::character varying])::text[]))),
    CONSTRAINT "CHK_property_access_rules_target_xor" CHECK ((((property_id IS NOT NULL) AND (wildcard_collection_id IS NULL)) OR ((property_id IS NULL) AND (wildcard_collection_id IS NOT NULL))))
);`);
    await queryRunner.query(`CREATE TABLE public.property_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    property_id uuid NOT NULL,
    record_id uuid NOT NULL,
    "oldValue" text,
    "newValue" text,
    changed_by uuid NOT NULL,
    "changedAt" timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.runtime_anomaly (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind character varying(80) NOT NULL,
    service_code character varying(80) NOT NULL,
    collection_code character varying(120),
    record_id character varying(120),
    message text NOT NULL,
    context jsonb,
    error_payload jsonb,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.schema_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version integer NOT NULL,
    collection_code character varying(100) NOT NULL,
    snapshot jsonb NOT NULL,
    change_type character varying(30) NOT NULL,
    change_summary text NOT NULL,
    created_by uuid NOT NULL,
    parent_version_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_schema_versions_change_type CHECK (((change_type)::text = ANY ((ARRAY['collection_created'::character varying, 'collection_updated'::character varying, 'collection_deleted'::character varying, 'property_added'::character varying, 'property_updated'::character varying, 'property_deleted'::character varying, 'index_added'::character varying, 'index_deleted'::character varying, 'rollback'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE public.search_embeddings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type character varying(120) NOT NULL,
    source_id character varying(255) NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    embedding public.vector(768),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    _collection_id uuid,
    _attribute_region text,
    _attribute_department_id uuid,
    _attribute_site_id uuid
);`);
    await queryRunner.query(`CREATE TABLE public.service_principals (
    service_id text NOT NULL,
    display_name text NOT NULL,
    allowed_audiences text[] NOT NULL,
    allowed_scopes text[] NOT NULL,
    k8s_service_account text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.upgrade_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    instance_id character varying(100) DEFAULT 'default-instance'::character varying NOT NULL,
    from_version character varying(50) NOT NULL,
    to_version character varying(50) NOT NULL,
    upgrade_manifest_id uuid,
    status character varying(30) DEFAULT 'in_progress'::character varying NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    rollback_at timestamp with time zone,
    initiated_by uuid,
    rollback_by uuid,
    execution_log jsonb DEFAULT '[]'::jsonb,
    error_message text,
    impacts_resolved integer DEFAULT 0 NOT NULL,
    impacts_auto_merged integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.upgrade_manifest (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version character varying(50) NOT NULL,
    release_date date NOT NULL,
    release_notes text,
    breaking_changes jsonb DEFAULT '[]'::jsonb,
    new_features jsonb DEFAULT '[]'::jsonb,
    deprecations jsonb DEFAULT '[]'::jsonb,
    migrations jsonb DEFAULT '[]'::jsonb,
    min_required_version character varying(50),
    is_available boolean DEFAULT true NOT NULL,
    is_mandatory boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.user_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    density_mode character varying(20) DEFAULT 'comfortable'::character varying NOT NULL,
    sidebar_position character varying(10) DEFAULT 'left'::character varying NOT NULL,
    sidebar_collapsed boolean DEFAULT false NOT NULL,
    sidebar_width integer DEFAULT 260 NOT NULL,
    show_breadcrumbs boolean DEFAULT true NOT NULL,
    show_footer boolean DEFAULT true NOT NULL,
    content_width character varying(20) DEFAULT 'full'::character varying NOT NULL,
    pinned_navigation jsonb DEFAULT '[]'::jsonb NOT NULL,
    recent_items_count integer DEFAULT 5 NOT NULL,
    show_favorites_in_sidebar boolean DEFAULT true NOT NULL,
    show_recent_in_sidebar boolean DEFAULT true NOT NULL,
    language character varying(10) DEFAULT 'en'::character varying NOT NULL,
    timezone character varying(50),
    date_format character varying(20) DEFAULT 'MM/DD/YYYY'::character varying NOT NULL,
    time_format character varying(5) DEFAULT '12h'::character varying NOT NULL,
    start_of_week character varying(10) DEFAULT 'sunday'::character varying NOT NULL,
    number_format character varying(20) DEFAULT 'en-US'::character varying NOT NULL,
    notification_preferences jsonb DEFAULT '{"push": {"enabled": false}, "email": {"enabled": true, "frequency": "daily", "categories": []}, "inApp": {"sound": true, "enabled": true, "showPreview": true}}'::jsonb NOT NULL,
    accessibility jsonb DEFAULT '{"largeText": false, "highContrast": false, "reduceMotion": false, "focusIndicators": true, "keyboardNavigation": true, "screenReaderOptimized": false}'::jsonb NOT NULL,
    keyboard_shortcuts_enabled boolean DEFAULT true NOT NULL,
    custom_shortcuts jsonb DEFAULT '[]'::jsonb NOT NULL,
    table_preferences jsonb DEFAULT '{"compactMode": false, "stickyHeader": true, "showRowNumbers": false, "defaultPageSize": 25, "alternateRowColors": false, "enableColumnReorder": true}'::jsonb NOT NULL,
    dashboard_preferences jsonb DEFAULT '{"showWelcomeWidget": true, "autoRefreshInterval": 0}'::jsonb NOT NULL,
    auto_save_enabled boolean DEFAULT true NOT NULL,
    auto_save_interval integer DEFAULT 30 NOT NULL,
    confirm_before_leave boolean DEFAULT true NOT NULL,
    show_field_descriptions boolean DEFAULT true NOT NULL,
    search_include_archived boolean DEFAULT false NOT NULL,
    search_results_per_page integer DEFAULT 20 NOT NULL,
    search_highlight_matches boolean DEFAULT true NOT NULL,
    home_page character varying(255),
    startup_page character varying(255),
    ava_enabled boolean DEFAULT true NOT NULL,
    ava_auto_suggest boolean DEFAULT true NOT NULL,
    ava_voice_enabled boolean DEFAULT false NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    last_sync_device character varying(255),
    last_synced_at timestamp with time zone,
    preference_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.user_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    session_token character varying(500) NOT NULL,
    refresh_token character varying(500),
    device_id character varying(255),
    device_name character varying(255),
    device_type character varying(50),
    user_agent text,
    ip_address character varying(45),
    geo_location jsonb,
    is_active boolean DEFAULT true NOT NULL,
    is_remembered boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoked_reason character varying(100)
);`);
    await queryRunner.query(`CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(320) NOT NULL,
    username character varying(100),
    display_name character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    password_hash character varying(255),
    password_algo character varying(20) DEFAULT 'argon2id'::character varying NOT NULL,
    password_changed_at timestamp with time zone,
    must_change_password boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'invited'::character varying NOT NULL,
    work_phone character varying(50),
    mobile_phone character varying(50),
    employee_id character varying(100),
    title character varying(200),
    department character varying(200),
    location character varying(200),
    cost_center character varying(50),
    manager_id uuid,
    avatar_url character varying(500),
    locale character varying(20) DEFAULT 'en-US'::character varying NOT NULL,
    time_zone character varying(50) DEFAULT 'America/New_York'::character varying NOT NULL,
    date_format character varying(20) DEFAULT 'MM/DD/YYYY'::character varying NOT NULL,
    time_format character varying(10) DEFAULT '12h'::character varying NOT NULL,
    mfa_enabled boolean DEFAULT false NOT NULL,
    mfa_secret character varying(255),
    mfa_backup_codes jsonb,
    mfa_recovery_email character varying(320),
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    last_failed_login_at timestamp with time zone,
    email_verified boolean DEFAULT false NOT NULL,
    email_verified_at timestamp with time zone,
    is_admin boolean DEFAULT false NOT NULL,
    is_system_user boolean DEFAULT false NOT NULL,
    invited_by uuid,
    invited_at timestamp with time zone,
    activation_token character varying(255),
    activation_token_expires_at timestamp with time zone,
    activated_at timestamp with time zone,
    deactivated_at timestamp with time zone,
    deactivated_by uuid,
    deactivation_reason text,
    suspended_at timestamp with time zone,
    suspended_by uuid,
    suspension_reason text,
    suspension_expires_at timestamp with time zone,
    last_login_at timestamp with time zone,
    last_login_ip character varying(45),
    last_activity_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    security_stamp uuid DEFAULT gen_random_uuid() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.view_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    view_type character varying(30) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    columns jsonb DEFAULT '[]'::jsonb,
    filters jsonb DEFAULT '[]'::jsonb,
    sorts jsonb DEFAULT '[]'::jsonb,
    "grouping" jsonb,
    calendar_config jsonb,
    kanban_config jsonb,
    timeline_config jsonb,
    map_config jsonb,
    gantt_config jsonb,
    pivot_config jsonb,
    gallery_config jsonb,
    owner_type character varying(20) DEFAULT 'user'::character varying NOT NULL,
    owner_id uuid,
    is_default boolean DEFAULT false,
    is_shared boolean DEFAULT false,
    shared_with jsonb DEFAULT '[]'::jsonb,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT chk_owner_type CHECK (((owner_type)::text = ANY ((ARRAY['system'::character varying, 'tenant'::character varying, 'role'::character varying, 'group'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT chk_view_type CHECK (((view_type)::text = ANY ((ARRAY['list'::character varying, 'card'::character varying, 'calendar'::character varying, 'kanban'::character varying, 'timeline'::character varying, 'map'::character varying, 'gantt'::character varying, 'pivot'::character varying, 'gallery'::character varying])::text[])))
);`);

    // Views
    await queryRunner.query(`CREATE VIEW public.computed_properties_overview AS
 SELECT cd.code AS collection_code,
    cd.name AS collection_name,
    pd.code AS property_code,
    pd.name AS property_name,
    pt.code AS property_type,
    pd.config AS type_config,
    ( SELECT count(*) AS count
           FROM public.property_dependencies dep
          WHERE (dep.property_id = pd.id)) AS dependency_count,
    ( SELECT count(*) AS count
           FROM public.formula_cache fc
          WHERE ((fc.property_id = pd.id) AND (fc.is_stale = false))) AS cached_count,
    ( SELECT count(*) AS count
           FROM public.formula_cache fc
          WHERE ((fc.property_id = pd.id) AND (fc.is_stale = true))) AS stale_count
   FROM ((metadata.property_definitions pd
     JOIN metadata.collection_definitions cd ON ((pd.collection_id = cd.id)))
     JOIN metadata.property_types pt ON ((pd.property_type_id = pt.id)))
  WHERE ((pt.code)::text = ANY ((ARRAY['formula'::character varying, 'rollup'::character varying, 'lookup'::character varying])::text[]))
  ORDER BY cd.code, pd."position";`);
    await queryRunner.query(`CREATE VIEW public.recent_schema_changes AS
 SELECT scl.id,
    scl.entity_type,
    scl.entity_code,
    scl.change_type,
    scl.change_source,
    scl.performed_by_type,
    scl.success,
    scl.error_message,
    scl.is_rolled_back,
    scl.created_at,
        CASE
            WHEN ((scl.entity_type)::text = 'collection'::text) THEN cd.name
            WHEN ((scl.entity_type)::text = 'property'::text) THEN pd.name
            ELSE NULL::character varying
        END AS entity_label,
        CASE
            WHEN ((scl.entity_type)::text = 'property'::text) THEN cd2.code
            ELSE NULL::character varying
        END AS parent_collection_code
   FROM (((metadata.schema_change_log scl
     LEFT JOIN metadata.collection_definitions cd ON ((((scl.entity_type)::text = 'collection'::text) AND (scl.entity_id = cd.id))))
     LEFT JOIN metadata.property_definitions pd ON ((((scl.entity_type)::text = 'property'::text) AND (scl.entity_id = pd.id))))
     LEFT JOIN metadata.collection_definitions cd2 ON ((pd.collection_id = cd2.id)))
  ORDER BY scl.created_at DESC
 LIMIT 100;`);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_ai_report_templates_category" ON app_builder.ai_report_templates USING btree (category);`);
    await queryRunner.query(`CREATE INDEX "IDX_ai_report_templates_public" ON app_builder.ai_report_templates USING btree (is_public);`);
    await queryRunner.query(`CREATE INDEX "IDX_ai_reports_status" ON app_builder.ai_reports USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_ai_reports_user" ON app_builder.ai_reports USING btree (generated_by, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX "IDX_app_components_category" ON app_builder.app_builder_components USING btree (category);`);
    await queryRunner.query(`CREATE INDEX "IDX_app_components_type" ON app_builder.app_builder_components USING btree (component_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_app_versions_app" ON app_builder.zero_code_app_versions USING btree (app_id, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX "IDX_ava_stories_priority" ON app_builder.ava_stories USING btree (priority);`);
    await queryRunner.query(`CREATE INDEX "IDX_ava_stories_recording" ON app_builder.ava_stories USING btree (recording_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_ava_stories_status" ON app_builder.ava_stories USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_customization_registry_artifact" ON app_builder.customization_registry USING btree (artifact_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_customization_registry_type" ON app_builder.customization_registry USING btree (customization_type);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_customization_registry_unique" ON app_builder.customization_registry USING btree (customization_type, artifact_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_digital_twins_active" ON app_builder.digital_twins USING btree (is_active);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_digital_twins_asset" ON app_builder.digital_twins USING btree (asset_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_digital_twins_status" ON app_builder.digital_twins USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_doc_versions_doc" ON app_builder.documentation_versions USING btree (documentation_id, version DESC);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_generated_docs_artifact" ON app_builder.generated_documentation USING btree (artifact_type, artifact_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_generated_docs_code" ON app_builder.generated_documentation USING btree (artifact_code);`);
    await queryRunner.query(`CREATE INDEX "IDX_generated_docs_search" ON app_builder.generated_documentation USING gin (to_tsvector('english'::regconfig, search_text));`);
    await queryRunner.query(`CREATE INDEX "IDX_insight_jobs_next_run" ON app_builder.insight_analysis_jobs USING btree (next_run_at);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_insight_jobs_type" ON app_builder.insight_analysis_jobs USING btree (job_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_nl_queries_user" ON app_builder.nl_queries USING btree (user_id, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX "IDX_predictive_insights_expires" ON app_builder.predictive_insights USING btree (expires_at) WHERE (expires_at IS NOT NULL);`);
    await queryRunner.query(`CREATE INDEX "IDX_predictive_insights_severity" ON app_builder.predictive_insights USING btree (severity);`);
    await queryRunner.query(`CREATE INDEX "IDX_predictive_insights_status" ON app_builder.predictive_insights USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_predictive_insights_type" ON app_builder.predictive_insights USING btree (insight_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_predictive_suggestions_type" ON app_builder.predictive_suggestions USING btree (suggestion_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_predictive_suggestions_user" ON app_builder.predictive_suggestions USING btree (user_id, shown_at DESC);`);
    await queryRunner.query(`CREATE INDEX "IDX_recovery_actions_active" ON app_builder.recovery_actions USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX "IDX_recovery_actions_service" ON app_builder.recovery_actions USING btree (target_service);`);
    await queryRunner.query(`CREATE INDEX "IDX_saved_queries_favorite" ON app_builder.saved_nl_queries USING btree (user_id, is_favorite) WHERE (is_favorite = true);`);
    await queryRunner.query(`CREATE INDEX "IDX_saved_queries_user" ON app_builder.saved_nl_queries USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_self_healing_event_type" ON app_builder.self_healing_events USING btree (event_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_self_healing_service" ON app_builder.self_healing_events USING btree (service_name, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX "IDX_sensor_readings_asset_time" ON app_builder.sensor_readings USING btree (asset_id, "timestamp" DESC);`);
    await queryRunner.query(`CREATE INDEX "IDX_sensor_readings_sensor_time" ON app_builder.sensor_readings USING btree (sensor_id, "timestamp" DESC);`);
    await queryRunner.query(`CREATE INDEX "IDX_service_health_status_val" ON app_builder.service_health_status USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_sprint_recordings_recorded_at" ON app_builder.sprint_recordings USING btree (recorded_at DESC);`);
    await queryRunner.query(`CREATE INDEX "IDX_sprint_recordings_recorded_by" ON app_builder.sprint_recordings USING btree (recorded_by);`);
    await queryRunner.query(`CREATE INDEX "IDX_sprint_recordings_status" ON app_builder.sprint_recordings USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_story_implementations_artifact" ON app_builder.story_implementations USING btree (artifact_type, artifact_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_story_implementations_story" ON app_builder.story_implementations USING btree (story_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_upgrade_analyses_status" ON app_builder.upgrade_impact_analyses USING btree (analysis_status);`);
    await queryRunner.query(`CREATE INDEX "IDX_upgrade_analyses_versions" ON app_builder.upgrade_impact_analyses USING btree (from_version, to_version);`);
    await queryRunner.query(`CREATE INDEX "IDX_upgrade_fixes_analysis" ON app_builder.upgrade_fixes USING btree (analysis_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_upgrade_fixes_customization" ON app_builder.upgrade_fixes USING btree (customization_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_user_behaviors_action" ON app_builder.user_behaviors USING btree (action);`);
    await queryRunner.query(`CREATE INDEX "IDX_user_behaviors_route" ON app_builder.user_behaviors USING btree (route);`);
    await queryRunner.query(`CREATE INDEX "IDX_user_behaviors_user_time" ON app_builder.user_behaviors USING btree (user_id, "timestamp" DESC);`);
    await queryRunner.query(`CREATE INDEX "IDX_user_patterns_type" ON app_builder.user_patterns USING btree (pattern_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_user_patterns_user" ON app_builder.user_patterns USING btree (user_id, pattern_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_voice_commands_intent" ON app_builder.voice_commands USING btree (intent);`);
    await queryRunner.query(`CREATE INDEX "IDX_voice_commands_session" ON app_builder.voice_commands USING btree (session_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_voice_commands_user" ON app_builder.voice_commands USING btree (user_id, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX "IDX_voice_patterns_active" ON app_builder.voice_command_patterns USING btree (is_active);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_voice_patterns_intent" ON app_builder.voice_command_patterns USING btree (intent);`);
    await queryRunner.query(`CREATE INDEX "IDX_zero_code_apps_category" ON app_builder.zero_code_apps USING btree (category);`);
    await queryRunner.query(`CREATE INDEX "IDX_zero_code_apps_creator" ON app_builder.zero_code_apps USING btree (created_by);`);
    await queryRunner.query(`CREATE INDEX "IDX_zero_code_apps_published" ON app_builder.zero_code_apps USING btree (is_published);`);
    await queryRunner.query(`CREATE INDEX "IDX_cross_domain_read_diff_caller_callsite_detected_at" ON automation.cross_domain_read_diff USING btree (caller_service, callsite, detected_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_cross_domain_read_diff_detected_at" ON automation.cross_domain_read_diff USING btree (detected_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_cross_domain_read_diff_kind" ON automation.cross_domain_read_diff USING btree (diff_kind);`);
    await queryRunner.query(`CREATE INDEX idx_approvals_approver ON automation.approvals USING btree (approver_id, status);`);
    await queryRunner.query(`CREATE INDEX idx_approvals_pending ON automation.approvals USING btree (due_date) WHERE ((status)::text = 'pending'::text);`);
    await queryRunner.query(`CREATE INDEX idx_approvals_process_flow ON automation.approvals USING btree (process_flow_instance_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_automation_rule_revisions_ar_rev ON automation.automation_rule_revisions USING btree (automation_rule_id, revision);`);
    await queryRunner.query(`CREATE INDEX idx_automation_rule_revisions_automation_rule_id ON automation.automation_rule_revisions USING btree (automation_rule_id);`);
    await queryRunner.query(`CREATE INDEX idx_automation_rule_revisions_status ON automation.automation_rule_revisions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_automation_rules_application_id ON automation.automation_rules USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_automation_rules_collection_active ON automation.automation_rules USING btree (collection_id, is_active);`);
    await queryRunner.query(`CREATE INDEX idx_automation_rules_collection_id ON automation.automation_rules USING btree (collection_id);`);
    await queryRunner.query(`CREATE INDEX idx_automation_rules_metadata_gin ON automation.automation_rules USING gin (metadata jsonb_path_ops);`);
    await queryRunner.query(`CREATE INDEX idx_automation_rules_source ON automation.automation_rules USING btree (source);`);
    await queryRunner.query(`CREATE INDEX idx_automation_rules_status ON automation.automation_rules USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_automation_rules_timing_active ON automation.automation_rules USING btree (trigger_timing, is_active);`);
    await queryRunner.query(`CREATE INDEX idx_client_scripts_collection_active ON automation.client_scripts USING btree (collection_id, is_active);`);
    await queryRunner.query(`CREATE INDEX idx_connectors_kind_status ON automation.connectors USING btree (kind, status);`);
    await queryRunner.query(`CREATE INDEX idx_connectors_source ON automation.connectors USING btree (source);`);
    await queryRunner.query(`CREATE INDEX idx_decision_rows_table_position ON automation.decision_rows USING btree (table_id, "position");`);
    await queryRunner.query(`CREATE INDEX idx_decision_table_revisions_status ON automation.decision_table_revisions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_decision_table_revisions_table ON automation.decision_table_revisions USING btree (table_id);`);
    await queryRunner.query(`CREATE INDEX idx_decision_tables_application ON automation.decision_tables USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_decision_tables_collection ON automation.decision_tables USING btree (collection_id);`);
    await queryRunner.query(`CREATE INDEX idx_decision_tables_source ON automation.decision_tables USING btree (source);`);
    await queryRunner.query(`CREATE INDEX idx_decision_tables_status ON automation.decision_tables USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_execution_logs_automation_created ON automation.automation_execution_logs USING btree (automation_rule_id, created_at);`);
    await queryRunner.query(`CREATE INDEX idx_execution_logs_record_created ON automation.automation_execution_logs USING btree (record_id, created_at);`);
    await queryRunner.query(`CREATE INDEX idx_execution_logs_status_created ON automation.automation_execution_logs USING btree (status, created_at);`);
    await queryRunner.query(`CREATE INDEX idx_guided_process_revisions_process ON automation.guided_process_revisions USING btree (process_id);`);
    await queryRunner.query(`CREATE INDEX idx_guided_process_revisions_status ON automation.guided_process_revisions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_guided_processes_application ON automation.guided_processes USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_guided_processes_collection ON automation.guided_processes USING btree (collection_id);`);
    await queryRunner.query(`CREATE INDEX idx_guided_processes_source ON automation.guided_processes USING btree (source);`);
    await queryRunner.query(`CREATE INDEX idx_guided_processes_status ON automation.guided_processes USING btree (status);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_process_flow_definition_revisions_pf_rev ON automation.process_flow_definition_revisions USING btree (process_flow_id, revision);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_definition_revisions_process_flow_id ON automation.process_flow_definition_revisions USING btree (process_flow_id);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_definition_revisions_status ON automation.process_flow_definition_revisions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_definitions_application_id ON automation.process_flow_definitions USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_definitions_collection ON automation.process_flow_definitions USING btree (collection_id) WHERE (is_active = true);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_definitions_source ON automation.process_flow_definitions USING btree (source);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_definitions_status ON automation.process_flow_definitions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_definitions_trigger ON automation.process_flow_definitions USING gin (trigger_conditions);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_history_instance ON automation.process_flow_execution_history USING btree (instance_id, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_instances_process_flow ON automation.process_flow_instances USING btree (process_flow_id);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_instances_record ON automation.process_flow_instances USING btree (collection_id, record_id);`);
    await queryRunner.query(`CREATE INDEX idx_process_flow_instances_state ON automation.process_flow_instances USING btree (state) WHERE ((state)::text = ANY ((ARRAY['running'::character varying, 'waiting_approval'::character varying])::text[]));`);
    await queryRunner.query(`CREATE INDEX idx_scheduled_jobs_active_next_run ON automation.scheduled_jobs USING btree (is_active, next_run_at);`);
    await queryRunner.query(`CREATE INDEX idx_sla_breaches_created ON automation.sla_breaches USING btree (created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_sla_breaches_record ON automation.sla_breaches USING btree (collection_id, record_id);`);
    await queryRunner.query(`CREATE INDEX idx_sla_definitions_collection ON automation.sla_definitions USING btree (collection_id) WHERE (is_active = true);`);
    await queryRunner.query(`CREATE INDEX idx_sla_instances_record ON automation.sla_instances USING btree (collection_id, record_id);`);
    await queryRunner.query(`CREATE INDEX idx_sla_instances_state ON automation.sla_instances USING btree (state);`);
    await queryRunner.query(`CREATE INDEX idx_sla_instances_target ON automation.sla_instances USING btree (target_time) WHERE ((state)::text = 'active'::text);`);
    await queryRunner.query(`CREATE INDEX idx_state_change_record ON automation.state_change_history USING btree (collection_id, record_id, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_state_machine_collection ON automation.state_machine_definitions USING btree (collection_id) WHERE (is_active = true);`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_decision_inputs_table_position ON automation.decision_inputs USING btree (table_id, "position");`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_decision_table_revisions_table_revision ON automation.decision_table_revisions USING btree (table_id, revision);`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_guided_process_activities_position ON automation.guided_process_activities USING btree (stage_id, "position");`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_guided_process_revisions_process_revision ON automation.guided_process_revisions USING btree (process_id, revision);`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_guided_process_stages_position ON automation.guided_process_stages USING btree (process_id, "position");`);
    await queryRunner.query(`CREATE INDEX "IDX_106f148639500d8a937386b5a7" ON ava.ava_audit_trail USING btree (target_collection);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6cd7923ae0d32881a0d82c0280" ON ava.ava_permission_configs USING btree (collection_code, action_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_97c0f7d7333849f12e42cf7779" ON ava.ava_audit_trail USING btree (action_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_a388db879a8dcc4ccdb37264fa" ON ava.ava_audit_trail USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_ava_conversations_organization_id" ON ava.ava_conversations USING btree (organization_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_ava_conversations_user_org" ON ava.ava_conversations USING btree (user_id, organization_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_ava_proposal_actor_id_state" ON ava.ava_proposal USING btree (actor_id, state);`);
    await queryRunner.query(`CREATE INDEX "IDX_ava_proposal_state_created_at" ON ava.ava_proposal USING btree (state, created_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_e1702c609e880eb3d176d060ed" ON ava.ava_audit_trail USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_f57eac7ca7c67e6dc24f2f1be1" ON ava.ava_audit_trail USING btree (created_at);`);
    await queryRunner.query(`CREATE INDEX idx_ava_anomalies_detected_at ON ava.ava_anomalies USING btree (detected_at);`);
    await queryRunner.query(`CREATE INDEX idx_ava_anomalies_is_resolved ON ava.ava_anomalies USING btree (is_resolved);`);
    await queryRunner.query(`CREATE INDEX idx_ava_anomalies_severity ON ava.ava_anomalies USING btree (severity);`);
    await queryRunner.query(`CREATE INDEX idx_ava_anomalies_type ON ava.ava_anomalies USING btree (anomaly_type);`);
    await queryRunner.query(`CREATE INDEX idx_ava_contexts_context_type ON ava.ava_contexts USING btree (context_type);`);
    await queryRunner.query(`CREATE INDEX idx_ava_contexts_expires_at ON ava.ava_contexts USING btree (expires_at);`);
    await queryRunner.query(`CREATE INDEX idx_ava_contexts_user_id ON ava.ava_contexts USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_ava_conversations_created_at ON ava.ava_conversations USING btree (created_at);`);
    await queryRunner.query(`CREATE INDEX idx_ava_conversations_status ON ava.ava_conversations USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_ava_conversations_user_id ON ava.ava_conversations USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_ava_embeddings_source_id ON ava.ava_knowledge_embeddings USING btree (source_id);`);
    await queryRunner.query(`CREATE INDEX idx_ava_embeddings_source_type ON ava.ava_knowledge_embeddings USING btree (source_type);`);
    await queryRunner.query(`CREATE INDEX idx_ava_feedback_message_id ON ava.ava_feedback USING btree (message_id);`);
    await queryRunner.query(`CREATE INDEX idx_ava_feedback_type ON ava.ava_feedback USING btree (feedback_type);`);
    await queryRunner.query(`CREATE INDEX idx_ava_feedback_user_id ON ava.ava_feedback USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_ava_intents_category ON ava.ava_intents USING btree (category);`);
    await queryRunner.query(`CREATE INDEX idx_ava_intents_intent_name ON ava.ava_intents USING btree (intent_name);`);
    await queryRunner.query(`CREATE INDEX idx_ava_intents_message_id ON ava.ava_intents USING btree (message_id);`);
    await queryRunner.query(`CREATE INDEX idx_ava_messages_conversation_id ON ava.ava_messages USING btree (conversation_id);`);
    await queryRunner.query(`CREATE INDEX idx_ava_messages_created_at ON ava.ava_messages USING btree (created_at);`);
    await queryRunner.query(`CREATE INDEX idx_ava_messages_role ON ava.ava_messages USING btree (role);`);
    await queryRunner.query(`CREATE INDEX idx_ava_predictions_is_active ON ava.ava_predictions USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX idx_ava_predictions_target_date ON ava.ava_predictions USING btree (target_date);`);
    await queryRunner.query(`CREATE INDEX idx_ava_predictions_type ON ava.ava_predictions USING btree (prediction_type);`);
    await queryRunner.query(`CREATE INDEX idx_ava_suggestions_is_accepted ON ava.ava_suggestions USING btree (is_accepted);`);
    await queryRunner.query(`CREATE INDEX idx_ava_suggestions_target_entity ON ava.ava_suggestions USING btree (target_entity);`);
    await queryRunner.query(`CREATE INDEX idx_ava_suggestions_type ON ava.ava_suggestions USING btree (suggestion_type);`);
    await queryRunner.query(`CREATE INDEX idx_ava_suggestions_user_id ON ava.ava_suggestions USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_ava_usage_metric_date ON ava.ava_usage_metrics USING btree (metric_date);`);
    await queryRunner.query(`CREATE INDEX idx_ava_usage_metric_type ON ava.ava_usage_metrics USING btree (metric_type);`);
    await queryRunner.query(`CREATE INDEX idx_ava_usage_user_id ON ava.ava_usage_metrics USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_dataset_definitions_active ON ava.dataset_definitions USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX idx_dataset_snapshots_definition ON ava.dataset_snapshots USING btree (dataset_definition_id);`);
    await queryRunner.query(`CREATE INDEX idx_dataset_snapshots_status ON ava.dataset_snapshots USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_model_artifacts_status ON ava.model_artifacts USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_model_deployments_artifact ON ava.model_deployments USING btree (model_artifact_id);`);
    await queryRunner.query(`CREATE INDEX idx_model_deployments_status ON ava.model_deployments USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_model_evaluations_artifact ON ava.model_evaluations USING btree (model_artifact_id);`);
    await queryRunner.query(`CREATE INDEX idx_model_evaluations_status ON ava.model_evaluations USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_model_training_jobs_code ON ava.model_training_jobs USING btree (model_code, model_version);`);
    await queryRunner.query(`CREATE INDEX idx_model_training_jobs_status ON ava.model_training_jobs USING btree (status);`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_model_artifacts_code_version ON ava.model_artifacts USING btree (code, version);`);
    await queryRunner.query(`CREATE INDEX "IDX_0f428ea82b51ea6c795689cdb8" ON identity.group_roles USING btree (group_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_178199805b901ccd220ab7740e" ON identity.role_permissions USING btree (role_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1c885f83eb2a34fedd887e43e8" ON identity.user_invitations USING btree (token);`);
    await queryRunner.query(`CREATE INDEX "IDX_1d590a89ba342ab3515e64f6d2" ON identity.mfa_methods USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_20a555b299f75843aa53ff8b0e" ON identity.group_members USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_245772caab09e629f6e80aaaba" ON identity.user_invitations USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_296ff17c5fdac130091f783281" ON identity.nav_profiles USING btree (is_default);`);
    await queryRunner.query(`CREATE INDEX "IDX_2a3edd7bc16920c3287331ea42" ON identity.roles USING btree (is_system);`);
    await queryRunner.query(`CREATE INDEX "IDX_2c840df5db52dc6b4a1b0b69c6" ON identity.group_members USING btree (group_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_35d4b5f7da6e1a9a730c3621ec" ON identity.group_roles USING btree (role_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3d1613f95c6a564a3b588d161a" ON identity.email_verification_tokens USING btree (token);`);
    await queryRunner.query(`CREATE INDEX "IDX_3e97eeaf865aeda0d20c0c5c50" ON identity.roles USING btree (parent_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_4933dc7a01356ac0733a5ad52d" ON identity.password_history USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_4db63a99d84dfd65fe3dca1bb2" ON identity.nav_profiles USING btree (scope);`);
    await queryRunner.query(`CREATE INDEX "IDX_52ac39dd8a28730c63aeb428c9" ON identity.password_reset_tokens USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_64ac9bded13b2b6b75b128d8e5" ON identity.auth_events USING btree (created_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_7c038e5a589b06cbe4320cc88b" ON identity.password_reset_tokens USING btree (expires_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_87b8888186ca9769c960e92687" ON identity.user_roles USING btree (user_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8989cafa0945a366f0c8716e60" ON identity.groups USING btree (code);`);
    await queryRunner.query(`CREATE INDEX "IDX_8b343e4f936b28da5922520105" ON identity.groups USING btree (type);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_92556f552f70c0531bdf4fc9d8" ON identity.nav_profiles USING btree (code);`);
    await queryRunner.query(`CREATE INDEX "IDX_9f3ae879cf24686834c974effd" ON identity.user_invitations USING btree (expires_at);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ab673f0e63eac966762155508e" ON identity.password_reset_tokens USING btree (token);`);
    await queryRunner.query(`CREATE INDEX "IDX_aff0693e5ee9e891fcdb414daa" ON identity.auth_events USING btree (event_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_b23c65e50a758245a33ee35fda" ON identity.user_roles USING btree (role_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_b7c64ecae33a54d3a11a4e6b6e" ON identity.email_verification_tokens USING btree (expires_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_d27703f0a3d79ba424741807cb" ON identity.auth_events USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_d768ea35a407c2ba9c0b038b61" ON identity.groups USING btree (parent_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_d818b0ebcc97ef5dfb67fb7867" ON identity.user_invitations USING btree (email);`);
    await queryRunner.query(`CREATE INDEX "IDX_da27d912745ad6fae4eaaf07d3" ON identity.user_roles USING btree (valid_from, valid_until);`);
    await queryRunner.query(`CREATE INDEX "IDX_e61477461f4ab1ba6729234fe4" ON identity.nav_profile_items USING btree (parent_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_e9f58bffa9bdcc402c0438a60c" ON identity.roles USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX "IDX_ed580a627f0d82d392897b4bca" ON identity.groups USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX "IDX_f02d51b25f5821bc1ee6780cc1" ON identity.nav_profile_items USING btree (profile_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f6d54f95c31b73fb1bdd8e91d0" ON identity.roles USING btree (code);`);
    await queryRunner.query(`CREATE INDEX "IDX_fdcb77f72f529bf65c95d72a14" ON identity.email_verification_tokens USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_service_accounts_status" ON identity.service_accounts USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_service_token_signing_keys_status" ON identity.service_token_signing_keys USING btree (status);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_service_accounts_name" ON identity.service_accounts USING btree (name);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_service_token_signing_keys_key_id" ON identity.service_token_signing_keys USING btree (key_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_service_token_signing_keys_one_active" ON identity.service_token_signing_keys USING btree (status) WHERE ((status)::text = 'active'::text);`);
    await queryRunner.query(`CREATE INDEX idx_delegations_dates ON identity.delegations USING btree (starts_at, ends_at);`);
    await queryRunner.query(`CREATE INDEX idx_delegations_delegate ON identity.delegations USING btree (delegate_id);`);
    await queryRunner.query(`CREATE INDEX idx_delegations_delegator ON identity.delegations USING btree (delegator_id);`);
    await queryRunner.query(`CREATE INDEX idx_delegations_status ON identity.delegations USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_impersonation_sessions_active ON identity.impersonation_sessions USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX idx_impersonation_sessions_impersonator ON identity.impersonation_sessions USING btree (impersonator_id);`);
    await queryRunner.query(`CREATE INDEX idx_impersonation_sessions_target ON identity.impersonation_sessions USING btree (target_user_id);`);
    await queryRunner.query(`CREATE INDEX idx_magic_link_tokens_email ON identity.magic_link_tokens USING btree (email);`);
    await queryRunner.query(`CREATE INDEX idx_magic_link_tokens_expires_at ON identity.magic_link_tokens USING btree (expires_at);`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_expires_at ON identity.refresh_tokens USING btree (expires_at) WHERE (revoked_at IS NULL);`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_family_id ON identity.refresh_tokens USING btree (family_id);`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_family_not_revoked ON identity.refresh_tokens USING btree (family_id) WHERE (revoked_at IS NULL);`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_user_session ON identity.refresh_tokens USING btree (user_id, session_id);`);
    await queryRunner.query(`CREATE INDEX idx_saml_auth_states_expires_at ON identity.saml_auth_states USING btree (expires_at);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_saml_auth_states_relay_state ON identity.saml_auth_states USING btree (relay_state);`);
    await queryRunner.query(`CREATE INDEX idx_security_alerts_created_at ON identity.security_alerts USING btree (created_at);`);
    await queryRunner.query(`CREATE INDEX idx_security_alerts_severity ON identity.security_alerts USING btree (severity);`);
    await queryRunner.query(`CREATE INDEX idx_security_alerts_status ON identity.security_alerts USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_security_alerts_user_id ON identity.security_alerts USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_trusted_devices_fingerprint ON identity.trusted_devices USING btree (device_fingerprint);`);
    await queryRunner.query(`CREATE INDEX idx_trusted_devices_status ON identity.trusted_devices USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_trusted_devices_user_id ON identity.trusted_devices USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_webauthn_challenges_expires_at ON identity.webauthn_challenges USING btree (expires_at);`);
    await queryRunner.query(`CREATE INDEX idx_webauthn_challenges_user_id ON identity.webauthn_challenges USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_webauthn_credentials_user_id ON identity.webauthn_credentials USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_dashboard_definitions_scope" ON insights.dashboard_definitions USING btree (scope);`);
    await queryRunner.query(`CREATE INDEX "IDX_metric_definitions_owner" ON insights.metric_definitions USING btree (definition_owner_id) WHERE (definition_owner_id IS NOT NULL);`);
    await queryRunner.query(`CREATE INDEX idx_metric_points_code_start ON insights.metric_points USING btree (metric_code, period_start);`);
    await queryRunner.query(`CREATE INDEX "IDX_138cc6196c7bfa61d31412aea7" ON integrations.api_keys USING btree (is_active);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_57384430aa1959f4578046c9b8" ON integrations.api_keys USING btree (key_hash);`);
    await queryRunner.query(`CREATE INDEX "IDX_a3baee01d8408cd3c0f89a9a97" ON integrations.api_keys USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_api_keys_is_active ON integrations.api_keys USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX idx_api_keys_key_prefix ON integrations.api_keys USING btree (key_prefix);`);
    await queryRunner.query(`CREATE INDEX idx_api_request_logs_api_key ON integrations.api_request_logs USING btree (api_key_id);`);
    await queryRunner.query(`CREATE INDEX idx_api_request_logs_created ON integrations.api_request_logs USING btree (created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_api_request_logs_path ON integrations.api_request_logs USING btree (path);`);
    await queryRunner.query(`CREATE INDEX idx_connector_connections_connector ON integrations.connector_connections USING btree (connector_id);`);
    await queryRunner.query(`CREATE INDEX idx_connector_connections_status ON integrations.connector_connections USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_export_jobs_collection ON integrations.export_jobs USING btree (source_collection_id);`);
    await queryRunner.query(`CREATE INDEX idx_export_jobs_status ON integrations.export_jobs USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_external_connectors_code ON integrations.external_connectors USING btree (code);`);
    await queryRunner.query(`CREATE INDEX idx_external_connectors_type ON integrations.external_connectors USING btree (type);`);
    await queryRunner.query(`CREATE INDEX idx_import_jobs_collection ON integrations.import_jobs USING btree (target_collection_id);`);
    await queryRunner.query(`CREATE INDEX idx_import_jobs_status ON integrations.import_jobs USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_oauth_access_tokens_expires ON integrations.oauth_access_tokens USING btree (expires_at);`);
    await queryRunner.query(`CREATE INDEX idx_oauth_access_tokens_token ON integrations.oauth_access_tokens USING btree (access_token);`);
    await queryRunner.query(`CREATE INDEX idx_oauth_auth_codes_code ON integrations.oauth_authorization_codes USING btree (code);`);
    await queryRunner.query(`CREATE INDEX idx_oauth_auth_codes_expires ON integrations.oauth_authorization_codes USING btree (expires_at);`);
    await queryRunner.query(`CREATE INDEX idx_oauth_clients_client_id ON integrations.oauth_clients USING btree (client_id);`);
    await queryRunner.query(`CREATE INDEX idx_oauth_refresh_tokens_token ON integrations.oauth_refresh_tokens USING btree (refresh_token);`);
    await queryRunner.query(`CREATE INDEX idx_sync_configurations_active ON integrations.sync_configurations USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX idx_sync_configurations_connection ON integrations.sync_configurations USING btree (connection_id);`);
    await queryRunner.query(`CREATE INDEX idx_sync_configurations_next_run ON integrations.sync_configurations USING btree (next_run_at);`);
    await queryRunner.query(`CREATE INDEX idx_sync_runs_configuration ON integrations.sync_runs USING btree (configuration_id);`);
    await queryRunner.query(`CREATE INDEX idx_sync_runs_started ON integrations.sync_runs USING btree (started_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_sync_runs_status ON integrations.sync_runs USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_webhook_deliveries_scheduled ON integrations.webhook_deliveries USING btree (scheduled_at);`);
    await queryRunner.query(`CREATE INDEX idx_webhook_deliveries_status ON integrations.webhook_deliveries USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_webhook_deliveries_subscription ON integrations.webhook_deliveries USING btree (subscription_id);`);
    await queryRunner.query(`CREATE INDEX idx_webhook_subscriptions_active ON integrations.webhook_subscriptions USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX idx_webhook_subscriptions_events ON integrations.webhook_subscriptions USING gin (events);`);
    await queryRunner.query(`CREATE INDEX "IDX_05cbb2665b2c235e3c06f0e55b" ON metadata.theme_definitions USING btree (color_scheme);`);
    await queryRunner.query(`CREATE INDEX "IDX_10dab69d18bbe034d20839f2ad" ON metadata.property_definitions USING btree (property_type_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_111982cc806d8c26c9c445ece7" ON metadata.form_definitions USING btree (collection_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_16cc6ea2ff3b1429345831f1f9" ON metadata.property_definitions USING btree (is_active);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1f7b17d42cf5cbd751912ddda1" ON metadata.property_types USING btree (code);`);
    await queryRunner.query(`CREATE INDEX "IDX_2e4c4613796c3af281556a2b62" ON metadata.property_definitions USING btree (collection_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7acdb47306e9b04ff598ca67a8" ON metadata.theme_definitions USING btree (code);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7c22e7ac994b29b2d8320bf3bc" ON metadata.collection_definitions USING btree (table_name);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_931628f1c40bc1d2b193ee0756" ON metadata.choice_lists USING btree (code);`);
    await queryRunner.query(`CREATE INDEX "IDX_98334e02c5109bd3a8ec155c2b" ON metadata.choice_items USING btree (choice_list_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a57f2b3bd9ebb022212e634f60" ON metadata.modules USING btree (key);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ae77cd7cd68614f5880e102757" ON metadata.user_theme_preferences USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_b03cfc29a73bc8ab5edf39c826" ON metadata.property_types USING btree (category);`);
    await queryRunner.query(`CREATE INDEX "IDX_c0a7ca386aca61a735377afe1d" ON metadata.theme_definitions USING btree (is_default);`);
    await queryRunner.query(`CREATE INDEX "IDX_c8553e254fab743a15789c9367" ON metadata.theme_definitions USING btree (theme_type);`);
    await queryRunner.query(`CREATE INDEX "IDX_d24aec9ddb25523068aefad8c5" ON metadata.collection_definitions USING btree (application_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d74cad0dd7ab2f1144e34e1a81" ON metadata.collection_definitions USING btree (code);`);
    await queryRunner.query(`CREATE INDEX "IDX_d816b7a55d18d87ca3b6065a49" ON metadata.collection_definitions USING btree (category);`);
    await queryRunner.query(`CREATE INDEX "IDX_e317662a80e3314c64265c35e9" ON metadata.collection_definitions USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX "IDX_e7ba7ffa905aec05e079199292" ON metadata.property_definitions USING btree (reference_collection_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_nav_nodes_key" ON metadata.nav_nodes USING btree (key);`);
    await queryRunner.query(`CREATE INDEX "IDX_nav_nodes_parent_id" ON metadata.nav_nodes USING btree (parent_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_nav_nodes_profile_id" ON metadata.nav_nodes USING btree (profile_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_nav_patches_profile_id" ON metadata.nav_patches USING btree (profile_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_navigation_module_revisions_definition" ON metadata.navigation_module_revisions USING btree (navigation_module_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_navigation_module_revisions_status" ON metadata.navigation_module_revisions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_navigation_variants_definition" ON metadata.navigation_variants USING btree (navigation_module_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_navigation_variants_scope" ON metadata.navigation_variants USING btree (scope);`);
    await queryRunner.query(`CREATE INDEX "IDX_navigation_variants_scope_key" ON metadata.navigation_variants USING btree (scope_key);`);
    await queryRunner.query(`CREATE INDEX "IDX_view_definition_revisions_definition" ON metadata.view_definition_revisions USING btree (view_definition_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_view_definition_revisions_status" ON metadata.view_definition_revisions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX "IDX_view_definitions_active" ON metadata.view_definitions USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX "IDX_view_definitions_kind" ON metadata.view_definitions USING btree (kind);`);
    await queryRunner.query(`CREATE INDEX "IDX_view_definitions_target_collection" ON metadata.view_definitions USING btree (target_collection_code);`);
    await queryRunner.query(`CREATE INDEX "IDX_view_variants_definition" ON metadata.view_variants USING btree (view_definition_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_view_variants_scope" ON metadata.view_variants USING btree (scope);`);
    await queryRunner.query(`CREATE INDEX "IDX_view_variants_scope_key" ON metadata.view_variants USING btree (scope_key);`);
    await queryRunner.query(`CREATE INDEX idx_application_revisions_app_id ON metadata.application_revisions USING btree (application_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_application_revisions_app_rev ON metadata.application_revisions USING btree (application_id, revision);`);
    await queryRunner.query(`CREATE INDEX idx_application_revisions_status ON metadata.application_revisions USING btree (status);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_applications_code ON metadata.applications USING btree (code);`);
    await queryRunner.query(`CREATE INDEX idx_applications_status ON metadata.applications USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_change_packages_application ON metadata.change_packages USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_change_packages_status ON metadata.change_packages USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_collection_constraints_active ON metadata.collection_constraints USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX idx_collection_constraints_collection ON metadata.collection_constraints USING btree (collection_id);`);
    await queryRunner.query(`CREATE INDEX idx_collection_constraints_type ON metadata.collection_constraints USING btree (constraint_type);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_collection_definition_revisions_col_rev ON metadata.collection_definition_revisions USING btree (collection_id, revision);`);
    await queryRunner.query(`CREATE INDEX idx_collection_definition_revisions_collection_id ON metadata.collection_definition_revisions USING btree (collection_id);`);
    await queryRunner.query(`CREATE INDEX idx_collection_definition_revisions_status ON metadata.collection_definition_revisions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_collection_definitions_application_id ON metadata.collection_definitions USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_collection_definitions_metadata_gin ON metadata.collection_definitions USING gin (metadata jsonb_path_ops);`);
    await queryRunner.query(`CREATE INDEX idx_collection_definitions_source ON metadata.collection_definitions USING btree (source);`);
    await queryRunner.query(`CREATE INDEX idx_collection_definitions_status ON metadata.collection_definitions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_collection_indexes_active ON metadata.collection_indexes USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX idx_collection_indexes_collection ON metadata.collection_indexes USING btree (collection_id);`);
    await queryRunner.query(`CREATE INDEX idx_collection_indexes_type ON metadata.collection_indexes USING btree (index_type);`);
    await queryRunner.query(`CREATE INDEX idx_collection_owner ON metadata.collection_definitions USING btree (owner);`);
    await queryRunner.query(`CREATE INDEX idx_collection_sync_status ON metadata.collection_definitions USING btree (sync_status);`);
    await queryRunner.query(`CREATE INDEX idx_dep_review_collection_status ON metadata.dependent_review_queue USING btree (collection_id, status);`);
    await queryRunner.query(`CREATE INDEX idx_dep_review_entity ON metadata.dependent_review_queue USING btree (entity_type, entity_id);`);
    await queryRunner.query(`CREATE INDEX idx_dep_review_status_created_at ON metadata.dependent_review_queue USING btree (status, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_display_rule_revisions_rule ON metadata.display_rule_revisions USING btree (display_rule_id);`);
    await queryRunner.query(`CREATE INDEX idx_display_rule_revisions_status ON metadata.display_rule_revisions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_display_rules_application ON metadata.display_rules USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_display_rules_collection_active ON metadata.display_rules USING btree (collection_id, is_active);`);
    await queryRunner.query(`CREATE INDEX idx_display_rules_source ON metadata.display_rules USING btree (source);`);
    await queryRunner.query(`CREATE INDEX idx_display_rules_status ON metadata.display_rules USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_form_definitions_application_id ON metadata.form_definitions USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_form_definitions_source ON metadata.form_definitions USING btree (source);`);
    await queryRunner.query(`CREATE INDEX idx_form_definitions_status ON metadata.form_definitions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_form_versions_status ON metadata.form_versions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_locales_code ON metadata.locales USING btree (code);`);
    await queryRunner.query(`CREATE INDEX idx_localization_bundles_locale_id ON metadata.localization_bundles USING btree (locale_id);`);
    await queryRunner.query(`CREATE INDEX idx_navigation_modules_application_id ON metadata.navigation_modules USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_pack_object_revisions_object ON metadata.pack_object_revisions USING btree (object_type, object_key);`);
    await queryRunner.query(`CREATE INDEX idx_pack_object_revisions_release ON metadata.pack_object_revisions USING btree (release_record_id);`);
    await queryRunner.query(`CREATE INDEX idx_pack_object_states_object_id ON metadata.pack_object_states USING btree (object_id);`);
    await queryRunner.query(`CREATE INDEX idx_pack_object_states_pack ON metadata.pack_object_states USING btree (pack_code);`);
    await queryRunner.query(`CREATE INDEX idx_pack_release_records_pack ON metadata.pack_release_records USING btree (pack_code, pack_release_id);`);
    await queryRunner.query(`CREATE INDEX idx_pack_release_records_started_at ON metadata.pack_release_records USING btree (started_at);`);
    await queryRunner.query(`CREATE INDEX idx_pack_release_records_status ON metadata.pack_release_records USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_property_collection_owner ON metadata.property_definitions USING btree (collection_id, owner);`);
    await queryRunner.query(`CREATE INDEX idx_property_def_behavioral_audit ON metadata.property_definitions USING btree (((behavioral_attributes ->> 'audit'::text))) WHERE ((behavioral_attributes ->> 'audit'::text) = 'true'::text);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_property_definition_revisions_prop_rev ON metadata.property_definition_revisions USING btree (property_id, revision);`);
    await queryRunner.query(`CREATE INDEX idx_property_definition_revisions_property_id ON metadata.property_definition_revisions USING btree (property_id);`);
    await queryRunner.query(`CREATE INDEX idx_property_definition_revisions_status ON metadata.property_definition_revisions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_property_definitions_application_id ON metadata.property_definitions USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_property_definitions_behavioral_attributes_gin ON metadata.property_definitions USING gin (behavioral_attributes);`);
    await queryRunner.query(`CREATE INDEX idx_property_definitions_config_gin ON metadata.property_definitions USING gin (config);`);
    await queryRunner.query(`CREATE INDEX idx_property_definitions_metadata_gin ON metadata.property_definitions USING gin (metadata jsonb_path_ops);`);
    await queryRunner.query(`CREATE INDEX idx_property_definitions_source ON metadata.property_definitions USING btree (source);`);
    await queryRunner.query(`CREATE INDEX idx_property_definitions_status ON metadata.property_definitions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_property_owner ON metadata.property_definitions USING btree (owner);`);
    await queryRunner.query(`CREATE INDEX idx_property_sync_status ON metadata.property_definitions USING btree (sync_status);`);
    await queryRunner.query(`CREATE INDEX idx_schema_change_created ON metadata.schema_change_log USING btree (created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_schema_change_entity ON metadata.schema_change_log USING btree (entity_type, entity_id);`);
    await queryRunner.query(`CREATE INDEX idx_schema_change_entity_code ON metadata.schema_change_log USING btree (entity_type, entity_code);`);
    await queryRunner.query(`CREATE INDEX idx_schema_change_failed ON metadata.schema_change_log USING btree (created_at DESC) WHERE (success = false);`);
    await queryRunner.query(`CREATE INDEX idx_schema_change_performer ON metadata.schema_change_log USING btree (performed_by, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_schema_change_rollback_candidates ON metadata.schema_change_log USING btree (created_at DESC) WHERE ((success = true) AND (is_rolled_back = false));`);
    await queryRunner.query(`CREATE INDEX idx_schema_change_type ON metadata.schema_change_log USING btree (change_type, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_schema_sync_lock ON metadata.schema_sync_state USING btree (sync_lock_expires_at);`);
    await queryRunner.query(`CREATE INDEX idx_search_dictionaries_locale ON metadata.search_dictionaries USING btree (locale);`);
    await queryRunner.query(`CREATE INDEX idx_search_experiences_scope ON metadata.search_experiences USING btree (scope);`);
    await queryRunner.query(`CREATE INDEX idx_search_experiences_scope_key ON metadata.search_experiences USING btree (scope_key);`);
    await queryRunner.query(`CREATE INDEX idx_search_sources_collection ON metadata.search_sources USING btree (collection_code);`);
    await queryRunner.query(`CREATE INDEX idx_translation_keys_namespace ON metadata.translation_keys USING btree (namespace);`);
    await queryRunner.query(`CREATE INDEX idx_translation_requests_key ON metadata.translation_requests USING btree (translation_key_id);`);
    await queryRunner.query(`CREATE INDEX idx_translation_requests_locale ON metadata.translation_requests USING btree (locale_id);`);
    await queryRunner.query(`CREATE INDEX idx_translation_requests_status ON metadata.translation_requests USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_translation_values_key ON metadata.translation_values USING btree (translation_key_id);`);
    await queryRunner.query(`CREATE INDEX idx_translation_values_locale ON metadata.translation_values USING btree (locale_id);`);
    await queryRunner.query(`CREATE INDEX idx_view_definitions_application_id ON metadata.view_definitions USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_view_definitions_source ON metadata.view_definitions USING btree (source);`);
    await queryRunner.query(`CREATE INDEX idx_widget_catalog_application_id ON metadata.widget_catalog USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_workspace_definitions_application ON metadata.workspace_definitions USING btree (application_id);`);
    await queryRunner.query(`CREATE INDEX idx_workspace_definitions_status ON metadata.workspace_definitions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_workspace_pages_position ON metadata.workspace_pages USING btree (workspace_id, "position");`);
    await queryRunner.query(`CREATE INDEX idx_workspace_variants_page ON metadata.workspace_variants USING btree (workspace_id, page_id);`);
    await queryRunner.query(`CREATE INDEX idx_workspace_variants_scope ON metadata.workspace_variants USING btree (scope, scope_ref);`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_display_rule_revisions_rule_revision ON metadata.display_rule_revisions USING btree (display_rule_id, revision);`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_workspace_pages_code ON metadata.workspace_pages USING btree (workspace_id, code);`);
    await queryRunner.query(`CREATE INDEX "IDX_notification_queue_idempotency_key" ON notify.notification_queue USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);`);
    await queryRunner.query(`CREATE INDEX idx_device_tokens_user ON notify.device_tokens USING btree (user_id) WHERE (is_active = true);`);
    await queryRunner.query(`CREATE INDEX idx_in_app_notifications_unread ON notify.in_app_notifications USING btree (user_id) WHERE ((read = false) AND (dismissed = false));`);
    await queryRunner.query(`CREATE INDEX idx_in_app_notifications_user ON notify.in_app_notifications USING btree (user_id, read, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_notification_history_queue ON notify.notification_history USING btree (notification_queue_id);`);
    await queryRunner.query(`CREATE INDEX idx_notification_history_recipient ON notify.notification_history USING btree (recipient_id, sent_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_notification_queue_recipient ON notify.notification_queue USING btree (recipient_id);`);
    await queryRunner.query(`CREATE INDEX idx_notification_queue_status ON notify.notification_queue USING btree (status, scheduled_for);`);
    await queryRunner.query(`CREATE INDEX idx_notification_templates_category ON notify.notification_templates USING btree (category) WHERE (is_active = true);`);
    await queryRunner.query(`CREATE INDEX "IDX_0189d2c9de5f8ef47506294a27" ON public.property_access_rules USING btree (role_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_01b38a262e9036dfcd0d686de6" ON public.users USING btree (username) WHERE ((username IS NOT NULL) AND (deleted_at IS NULL));`);
    await queryRunner.query(`CREATE INDEX "IDX_0644be2a2e4d4a95dae2039d04" ON public.collection_access_rules USING btree (collection_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0837b566b883183034a42db0e0" ON public.users USING btree (employee_id) WHERE (employee_id IS NOT NULL);`);
    await queryRunner.query(`CREATE INDEX "IDX_0bacca40d90fcebfc311982eb1" ON public.audit_logs USING btree (collection_code);`);
    await queryRunner.query(`CREATE INDEX "IDX_0c30b2278a5d31e23fcaee4887" ON public.user_sessions USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX "IDX_0ee922b564bc954b4d97eae815" ON public.collection_access_rules USING btree (role_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_1b7c676ffb354a9cabc87b7da9" ON public.users USING btree (is_admin);`);
    await queryRunner.query(`CREATE INDEX "IDX_2bbd90ecb185529732938857fa" ON public.collection_access_rules USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON public.audit_logs USING btree (created_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_314d7767bd038e2d47aebb208f" ON public.property_access_rules USING btree (property_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_3676155292d72c67cd4e090514" ON public.users USING btree (status);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_458057fa75b66e68a275647da2" ON public.user_preferences USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_52174f0e91e1a5a0c87c9fcf78" ON public.collection_access_rules USING btree (priority);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7fdbf1baeb91b6f822b5d57e19" ON public.users USING btree (email) WHERE (deleted_at IS NULL);`);
    await queryRunner.query(`CREATE INDEX "IDX_8c5f3ff32b318d551d8f4a7b28" ON public.property_access_rules USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_9c03e48624b266373a313f87d4" ON public.instance_settings USING btree (category);`);
    await queryRunner.query(`CREATE INDEX "IDX_a0b9e97943e753481035a49922" ON public.property_access_rules USING btree (group_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_hash" ON public.audit_logs USING btree (hash);`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_permission_code_created_at" ON public.audit_logs USING btree (permission_code, created_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_previous_hash" ON public.audit_logs USING btree (previous_hash);`);
    await queryRunner.query(`CREATE INDEX "IDX_bd2726fd31b35443f2245b93ba" ON public.audit_logs USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_c162e1fe9d744b0721daea3b1c" ON public.users USING btree (department);`);
    await queryRunner.query(`CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON public.audit_logs USING btree (action);`);
    await queryRunner.query(`CREATE INDEX "IDX_collection_access_rules_effect" ON public.collection_access_rules USING btree (collection_id, effect);`);
    await queryRunner.query(`CREATE INDEX "IDX_collection_access_rules_rule_key" ON public.collection_access_rules USING btree (collection_id, rule_key) WHERE (rule_key IS NOT NULL);`);
    await queryRunner.query(`CREATE INDEX "IDX_d9437ad9cb5e4aedaf442b949e" ON public.collection_access_rules USING btree (group_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_dbc81ff542b1b3366bae195f2a" ON public.user_sessions USING btree (expires_at);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e5eb7a3c7766f941fe16b9edec" ON public.user_sessions USING btree (session_token);`);
    await queryRunner.query(`CREATE INDEX "IDX_e9658e959c490b0a634dfc5478" ON public.user_sessions USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_f0acee5e593954a1dc4ac8aad3" ON public.audit_logs USING btree (record_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f4841fbd4c9819d5ade4b5dfeb" ON public.instance_settings USING btree (key);`);
    await queryRunner.query(`CREATE INDEX "IDX_fba2d8e029689aa8fea98e53c9" ON public.users USING btree (manager_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_instance_event_outbox_locked_at" ON public.instance_event_outbox USING btree (locked_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_instance_event_outbox_status_created_at" ON public.instance_event_outbox USING btree (status, created_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_property_access_rules_effect" ON public.property_access_rules USING btree (property_id, effect);`);
    await queryRunner.query(`CREATE INDEX "IDX_property_access_rules_rule_key" ON public.property_access_rules USING btree (property_id, rule_key) WHERE (rule_key IS NOT NULL);`);
    await queryRunner.query(`CREATE INDEX "IDX_property_access_rules_wildcard_collection_id" ON public.property_access_rules USING btree (wildcard_collection_id);`);
    await queryRunner.query(`CREATE INDEX "IDX_runtime_anomaly_kind_occurred_at" ON public.runtime_anomaly USING btree (kind, occurred_at);`);
    await queryRunner.query(`CREATE INDEX "IDX_runtime_anomaly_service_occurred_at" ON public.runtime_anomaly USING btree (service_code, occurred_at);`);
    await queryRunner.query(`CREATE INDEX idx_field_mappings_connection ON public.field_mappings USING btree (connection_id);`);
    await queryRunner.query(`CREATE INDEX idx_formula_cache_dependencies ON public.formula_cache USING gin (dependencies);`);
    await queryRunner.query(`CREATE INDEX idx_formula_cache_expires ON public.formula_cache USING btree (expires_at) WHERE (expires_at IS NOT NULL);`);
    await queryRunner.query(`CREATE INDEX idx_formula_cache_stale ON public.formula_cache USING btree (is_stale) WHERE (is_stale = true);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_formula_cache_unique ON public.formula_cache USING btree (collection_id, property_id, record_id);`);
    await queryRunner.query(`CREATE INDEX idx_instance_customizations_active ON public.instance_customizations USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX idx_instance_customizations_instance ON public.instance_customizations USING btree (instance_id);`);
    await queryRunner.query(`CREATE INDEX idx_instance_customizations_type ON public.instance_customizations USING btree (config_type);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_instance_customizations_unique ON public.instance_customizations USING btree (instance_id, config_type, resource_key);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_key_metadata_one_active ON public.key_metadata USING btree (COALESCE((instance_id)::text, 'platform'::text)) WHERE (state = 'active'::text);`);
    await queryRunner.query(`CREATE INDEX idx_key_metadata_state ON public.key_metadata USING btree (state) WHERE (state = ANY (ARRAY['active'::text, 'retiring'::text]));`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_platform_config_key ON public.platform_config USING btree (key);`);
    await queryRunner.query(`CREATE INDEX idx_property_dependencies_collection ON public.property_dependencies USING btree (collection_id);`);
    await queryRunner.query(`CREATE INDEX idx_property_dependencies_depends_on ON public.property_dependencies USING btree (depends_on_property_id);`);
    await queryRunner.query(`CREATE INDEX idx_property_dependencies_order ON public.property_dependencies USING btree (collection_id, update_order);`);
    await queryRunner.query(`CREATE INDEX idx_property_dependencies_property ON public.property_dependencies USING btree (property_id);`);
    await queryRunner.query(`CREATE INDEX idx_schema_versions_collection ON public.schema_versions USING btree (collection_code);`);
    await queryRunner.query(`CREATE INDEX idx_schema_versions_collection_version ON public.schema_versions USING btree (collection_code, version DESC);`);
    await queryRunner.query(`CREATE INDEX idx_schema_versions_created_at ON public.schema_versions USING btree (created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_schema_versions_created_by ON public.schema_versions USING btree (created_by);`);
    await queryRunner.query(`CREATE INDEX idx_schema_versions_parent ON public.schema_versions USING btree (parent_version_id);`);
    await queryRunner.query(`CREATE INDEX idx_search_embeddings_attr_department_id ON public.search_embeddings USING btree (_attribute_department_id);`);
    await queryRunner.query(`CREATE INDEX idx_search_embeddings_attr_region ON public.search_embeddings USING btree (_attribute_region);`);
    await queryRunner.query(`CREATE INDEX idx_search_embeddings_attr_site_id ON public.search_embeddings USING btree (_attribute_site_id);`);
    await queryRunner.query(`CREATE INDEX idx_search_embeddings_collection_id ON public.search_embeddings USING btree (_collection_id);`);
    await queryRunner.query(`CREATE INDEX idx_search_embeddings_embedding ON public.search_embeddings USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');`);
    await queryRunner.query(`CREATE INDEX idx_search_embeddings_metadata ON public.search_embeddings USING gin (metadata);`);
    await queryRunner.query(`CREATE INDEX idx_search_embeddings_source_id ON public.search_embeddings USING btree (source_id);`);
    await queryRunner.query(`CREATE INDEX idx_search_embeddings_source_type ON public.search_embeddings USING btree (source_type);`);
    await queryRunner.query(`CREATE INDEX idx_service_principals_k8s_sa ON public.service_principals USING btree (k8s_service_account) WHERE ((active = true) AND (k8s_service_account IS NOT NULL));`);
    await queryRunner.query(`CREATE INDEX idx_upgrade_history_completed ON public.upgrade_history USING btree (completed_at);`);
    await queryRunner.query(`CREATE INDEX idx_upgrade_history_instance ON public.upgrade_history USING btree (instance_id);`);
    await queryRunner.query(`CREATE INDEX idx_upgrade_history_status ON public.upgrade_history USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_upgrade_impact_instance ON public.instance_upgrade_impact USING btree (instance_id);`);
    await queryRunner.query(`CREATE INDEX idx_upgrade_impact_manifest ON public.instance_upgrade_impact USING btree (upgrade_manifest_id);`);
    await queryRunner.query(`CREATE INDEX idx_upgrade_impact_severity ON public.instance_upgrade_impact USING btree (impact_severity);`);
    await queryRunner.query(`CREATE INDEX idx_upgrade_impact_status ON public.instance_upgrade_impact USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_upgrade_manifest_available ON public.upgrade_manifest USING btree (is_available);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_upgrade_manifest_version ON public.upgrade_manifest USING btree (version);`);
    await queryRunner.query(`CREATE INDEX idx_users_security_stamp ON public.users USING btree (id, security_stamp);`);
    await queryRunner.query(`CREATE INDEX idx_view_config_collection ON public.view_configurations USING btree (collection_id, display_order);`);
    await queryRunner.query(`CREATE INDEX idx_view_config_owner ON public.view_configurations USING btree (owner_type, owner_id);`);
    await queryRunner.query(`CREATE INDEX idx_view_config_type ON public.view_configurations USING btree (collection_id, view_type);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_view_config_unique ON public.view_configurations USING btree (collection_id, code);`);

    // Triggers
    await queryRunner.query(`CREATE TRIGGER trg_schema_sync_state_updated_at BEFORE UPDATE ON metadata.schema_sync_state FOR EACH ROW EXECUTE FUNCTION public.update_schema_sync_state_updated_at();`);
    await queryRunner.query(`CREATE TRIGGER trg_formula_cache_updated_at BEFORE UPDATE ON public.formula_cache FOR EACH ROW EXECUTE FUNCTION public.update_formula_cache_updated_at();`);
    await queryRunner.query(`CREATE TRIGGER trg_view_config_updated_at BEFORE UPDATE ON public.view_configurations FOR EACH ROW EXECUTE FUNCTION public.update_view_config_updated_at();`);

    // Constraints
    await queryRunner.query(`ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.ai_report_templates
    ADD CONSTRAINT "PK_ai_report_templates" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.ai_reports
    ADD CONSTRAINT "PK_ai_reports" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.app_builder_components
    ADD CONSTRAINT "PK_app_builder_components" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.ava_stories
    ADD CONSTRAINT "PK_ava_stories" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.customization_registry
    ADD CONSTRAINT "PK_customization_registry" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.digital_twins
    ADD CONSTRAINT "PK_digital_twins" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.documentation_versions
    ADD CONSTRAINT "PK_documentation_versions" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.generated_documentation
    ADD CONSTRAINT "PK_generated_documentation" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.insight_analysis_jobs
    ADD CONSTRAINT "PK_insight_analysis_jobs" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.nl_queries
    ADD CONSTRAINT "PK_nl_queries" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.predictive_insights
    ADD CONSTRAINT "PK_predictive_insights" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.predictive_suggestions
    ADD CONSTRAINT "PK_predictive_suggestions" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.recovery_actions
    ADD CONSTRAINT "PK_recovery_actions" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.saved_nl_queries
    ADD CONSTRAINT "PK_saved_nl_queries" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.self_healing_events
    ADD CONSTRAINT "PK_self_healing_events" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.sensor_readings
    ADD CONSTRAINT "PK_sensor_readings" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.service_health_status
    ADD CONSTRAINT "PK_service_health_status" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.sprint_recordings
    ADD CONSTRAINT "PK_sprint_recordings" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.story_implementations
    ADD CONSTRAINT "PK_story_implementations" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.upgrade_fixes
    ADD CONSTRAINT "PK_upgrade_fixes" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.upgrade_impact_analyses
    ADD CONSTRAINT "PK_upgrade_impact_analyses" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.user_behaviors
    ADD CONSTRAINT "PK_user_behaviors" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.user_patterns
    ADD CONSTRAINT "PK_user_patterns" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.voice_command_patterns
    ADD CONSTRAINT "PK_voice_command_patterns" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.voice_commands
    ADD CONSTRAINT "PK_voice_commands" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.zero_code_app_versions
    ADD CONSTRAINT "PK_zero_code_app_versions" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.zero_code_apps
    ADD CONSTRAINT "PK_zero_code_apps" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.service_health_status
    ADD CONSTRAINT "UQ_service_health_name" UNIQUE (service_name);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.cross_domain_read_diff
    ADD CONSTRAINT "PK_cross_domain_read_diff" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.automation_rule_revisions
    ADD CONSTRAINT automation_rule_revisions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.business_hours
    ADD CONSTRAINT business_hours_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.business_hours
    ADD CONSTRAINT business_hours_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.connectors
    ADD CONSTRAINT connectors_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.connectors
    ADD CONSTRAINT connectors_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.decision_inputs
    ADD CONSTRAINT decision_inputs_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.decision_rows
    ADD CONSTRAINT decision_rows_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.decision_table_revisions
    ADD CONSTRAINT decision_table_revisions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.decision_tables
    ADD CONSTRAINT decision_tables_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.decision_tables
    ADD CONSTRAINT decision_tables_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.guided_process_activities
    ADD CONSTRAINT guided_process_activities_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.guided_process_revisions
    ADD CONSTRAINT guided_process_revisions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.guided_process_stages
    ADD CONSTRAINT guided_process_stages_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.guided_processes
    ADD CONSTRAINT guided_processes_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.guided_processes
    ADD CONSTRAINT guided_processes_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.automation_execution_logs
    ADD CONSTRAINT pk_automation_execution_logs PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.automation_rules
    ADD CONSTRAINT pk_automation_rules PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.client_scripts
    ADD CONSTRAINT pk_client_scripts PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.scheduled_jobs
    ADD CONSTRAINT pk_scheduled_jobs PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_definition_revisions
    ADD CONSTRAINT process_flow_definition_revisions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_definitions
    ADD CONSTRAINT process_flow_definitions_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_definitions
    ADD CONSTRAINT process_flow_definitions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_execution_history
    ADD CONSTRAINT process_flow_execution_history_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_instances
    ADD CONSTRAINT process_flow_instances_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_breaches
    ADD CONSTRAINT sla_breaches_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_definitions
    ADD CONSTRAINT sla_definitions_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_definitions
    ADD CONSTRAINT sla_definitions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_instances
    ADD CONSTRAINT sla_instances_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.state_change_history
    ADD CONSTRAINT state_change_history_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.state_machine_definitions
    ADD CONSTRAINT state_machine_definitions_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.state_machine_definitions
    ADD CONSTRAINT state_machine_definitions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_permission_configs
    ADD CONSTRAINT "PK_11683766f65091641045f8ae30f" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_audit_trail
    ADD CONSTRAINT "PK_8883aeb20729f23f84dddd4cd2b" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_global_settings
    ADD CONSTRAINT "PK_ae7c69697b886ebe857e9e15239" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_anomalies
    ADD CONSTRAINT ava_anomalies_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_cards
    ADD CONSTRAINT ava_cards_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_cards
    ADD CONSTRAINT ava_cards_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_contexts
    ADD CONSTRAINT ava_contexts_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_conversations
    ADD CONSTRAINT ava_conversations_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_feedback
    ADD CONSTRAINT ava_feedback_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_intents
    ADD CONSTRAINT ava_intents_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_knowledge_embeddings
    ADD CONSTRAINT ava_knowledge_embeddings_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_messages
    ADD CONSTRAINT ava_messages_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_predictions
    ADD CONSTRAINT ava_predictions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_prompt_policies
    ADD CONSTRAINT ava_prompt_policies_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_prompt_policies
    ADD CONSTRAINT ava_prompt_policies_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_proposal
    ADD CONSTRAINT ava_proposal_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_suggestions
    ADD CONSTRAINT ava_suggestions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_tools
    ADD CONSTRAINT ava_tools_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_tools
    ADD CONSTRAINT ava_tools_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_topics
    ADD CONSTRAINT ava_topics_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_topics
    ADD CONSTRAINT ava_topics_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_usage_metrics
    ADD CONSTRAINT ava_usage_metrics_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.dataset_definitions
    ADD CONSTRAINT dataset_definitions_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.dataset_definitions
    ADD CONSTRAINT dataset_definitions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.dataset_snapshots
    ADD CONSTRAINT dataset_snapshots_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.model_artifacts
    ADD CONSTRAINT model_artifacts_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.model_deployments
    ADD CONSTRAINT model_deployments_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.model_evaluations
    ADD CONSTRAINT model_evaluations_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.model_training_jobs
    ADD CONSTRAINT model_training_jobs_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.sso_providers
    ADD CONSTRAINT "PK_348feeee9ed68f9161a2f5ffeb0" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.email_verification_tokens
    ADD CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.password_policies
    ADD CONSTRAINT "PK_5468b65a86afc8563ac81cb9153" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.mfa_methods
    ADD CONSTRAINT "PK_60e4d183e6dbd427aa5549da581" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.ldap_configs
    ADD CONSTRAINT "PK_617b64e3f20ff5598a11ea7661e" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.groups
    ADD CONSTRAINT "PK_659d1483316afb28afd3a90646e" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.group_members
    ADD CONSTRAINT "PK_86446139b2c96bfd0f3b8638852" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.user_roles
    ADD CONSTRAINT "PK_8acd5cf26ebd158416f477de799" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.auth_events
    ADD CONSTRAINT "PK_ab929cc6084ffb3fd795bd983c0" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.roles
    ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.user_invitations
    ADD CONSTRAINT "PK_c8005acb91c3ce9a7ae581eca8f" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.group_roles
    ADD CONSTRAINT "PK_c88b2351f40bf170bc7ab7e8fda" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.nav_profile_items
    ADD CONSTRAINT "PK_cb0391e27b4c5bfa13728f5ebf4" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.password_reset_tokens
    ADD CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.password_history
    ADD CONSTRAINT "PK_da65ed4600e5e6bc9315754a8b2" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.auth_settings
    ADD CONSTRAINT "PK_daf9fe3ab40a3241250fcd21127" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.nav_profiles
    ADD CONSTRAINT "PK_eab82f3592b4f3bdfa425eb651a" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.service_accounts
    ADD CONSTRAINT "PK_service_accounts" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.service_token_signing_keys
    ADD CONSTRAINT "PK_service_token_signing_keys" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.user_invitations
    ADD CONSTRAINT "UQ_1c885f83eb2a34fedd887e43e82" UNIQUE (token);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.user_roles
    ADD CONSTRAINT "UQ_23ed6f04fe43066df08379fd034" UNIQUE (user_id, role_id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.group_roles
    ADD CONSTRAINT "UQ_31cb33278c5d3f7aed58766840a" UNIQUE (group_id, role_id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.email_verification_tokens
    ADD CONSTRAINT "UQ_3d1613f95c6a564a3b588d161ae" UNIQUE (token);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.sso_providers
    ADD CONSTRAINT "UQ_85208f3eacf568550f725f5097a" UNIQUE (slug);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.groups
    ADD CONSTRAINT "UQ_8989cafa0945a366f0c8716e609" UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.nav_profiles
    ADD CONSTRAINT "UQ_92556f552f70c0531bdf4fc9d85" UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.password_reset_tokens
    ADD CONSTRAINT "UQ_ab673f0e63eac966762155508ee" UNIQUE (token);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.group_members
    ADD CONSTRAINT "UQ_f5939ee0ad233ad35e03f5c65c1" UNIQUE (group_id, user_id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.roles
    ADD CONSTRAINT "UQ_f6d54f95c31b73fb1bdd8e91d0c" UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.behavioral_profiles
    ADD CONSTRAINT behavioral_profiles_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.behavioral_profiles
    ADD CONSTRAINT behavioral_profiles_user_id_key UNIQUE (user_id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.delegations
    ADD CONSTRAINT delegations_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.magic_link_tokens
    ADD CONSTRAINT magic_link_tokens_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.magic_link_tokens
    ADD CONSTRAINT magic_link_tokens_token_key UNIQUE (token);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (token_hash);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.saml_auth_states
    ADD CONSTRAINT saml_auth_states_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.saml_auth_states
    ADD CONSTRAINT saml_auth_states_relay_state_key UNIQUE (relay_state);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.security_alerts
    ADD CONSTRAINT security_alerts_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.trusted_devices
    ADD CONSTRAINT trusted_devices_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_challenge_key UNIQUE (challenge);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_credential_id_key UNIQUE (credential_id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY insights.alert_definitions
    ADD CONSTRAINT alert_definitions_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY insights.alert_definitions
    ADD CONSTRAINT alert_definitions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY insights.dashboard_definitions
    ADD CONSTRAINT dashboard_definitions_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY insights.dashboard_definitions
    ADD CONSTRAINT dashboard_definitions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY insights.metric_definitions
    ADD CONSTRAINT metric_definitions_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY insights.metric_definitions
    ADD CONSTRAINT metric_definitions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY insights.metric_points
    ADD CONSTRAINT metric_points_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.api_keys
    ADD CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.api_keys
    ADD CONSTRAINT "UQ_57384430aa1959f4578046c9b81" UNIQUE (key_hash);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.api_request_logs
    ADD CONSTRAINT api_request_logs_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.connector_connections
    ADD CONSTRAINT connector_connections_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.export_jobs
    ADD CONSTRAINT export_jobs_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.external_connectors
    ADD CONSTRAINT external_connectors_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.external_connectors
    ADD CONSTRAINT external_connectors_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_access_token_key UNIQUE (access_token);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_authorization_codes
    ADD CONSTRAINT oauth_authorization_codes_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_authorization_codes
    ADD CONSTRAINT oauth_authorization_codes_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_clients
    ADD CONSTRAINT oauth_clients_client_id_key UNIQUE (client_id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_refresh_token_key UNIQUE (refresh_token);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.sync_configurations
    ADD CONSTRAINT sync_configurations_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.sync_runs
    ADD CONSTRAINT sync_runs_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.webhook_subscriptions
    ADD CONSTRAINT webhook_subscriptions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_definitions
    ADD CONSTRAINT "PK_09013b5e4e940a81de054ac6fd2" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_types
    ADD CONSTRAINT "PK_129390b286b9c776438dfa475a8" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.choice_lists
    ADD CONSTRAINT "PK_32e58b5d1206ca7bd235da92c66" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.form_versions
    ADD CONSTRAINT "PK_46dbd35ef6adf11a8684deae1b1" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.module_security
    ADD CONSTRAINT "PK_4e41b3d2d49a520286fb067bffc" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.modules
    ADD CONSTRAINT "PK_7dbefd488bd96c5bf31f0ce0c95" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_definitions
    ADD CONSTRAINT "PK_92ac9ed8fcf26e5f49e30a29c2a" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.choice_items
    ADD CONSTRAINT "PK_bffbbb5b6dce82a7246514834aa" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.user_theme_preferences
    ADD CONSTRAINT "PK_d2925210c600e2673134dcf7e8b" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.form_definitions
    ADD CONSTRAINT "PK_e7b46c89a49ab24f30618b410d9" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.theme_definitions
    ADD CONSTRAINT "PK_e9340ba17d97c17056d05759136" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.instance_branding
    ADD CONSTRAINT "PK_ffa3a5f407b63635e6c7ec5e421" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.nav_nodes
    ADD CONSTRAINT "PK_nav_nodes" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.nav_patches
    ADD CONSTRAINT "PK_nav_patches" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_module_revisions
    ADD CONSTRAINT "PK_navigation_module_revisions" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_modules
    ADD CONSTRAINT "PK_navigation_modules" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_variants
    ADD CONSTRAINT "PK_navigation_variants" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_definition_revisions
    ADD CONSTRAINT "PK_view_definition_revisions" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_definitions
    ADD CONSTRAINT "PK_view_definitions" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_variants
    ADD CONSTRAINT "PK_view_variants" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.widget_catalog
    ADD CONSTRAINT "PK_widget_catalog" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_types
    ADD CONSTRAINT "UQ_1f7b17d42cf5cbd751912ddda14" UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_definitions
    ADD CONSTRAINT "UQ_2211a0f9fca1a63a5a8ff76bda2" UNIQUE (collection_id, code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.theme_definitions
    ADD CONSTRAINT "UQ_7acdb47306e9b04ff598ca67a8d" UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_definitions
    ADD CONSTRAINT "UQ_7c22e7ac994b29b2d8320bf3bcf" UNIQUE (table_name);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.choice_lists
    ADD CONSTRAINT "UQ_931628f1c40bc1d2b193ee07560" UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.choice_items
    ADD CONSTRAINT "UQ_9d19126c923b35ffd71c6b08bbd" UNIQUE (choice_list_id, value);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.modules
    ADD CONSTRAINT "UQ_a57f2b3bd9ebb022212e634f601" UNIQUE (key);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_definitions
    ADD CONSTRAINT "UQ_d74cad0dd7ab2f1144e34e1a816" UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_module_revisions
    ADD CONSTRAINT "UQ_navigation_module_revision" UNIQUE (navigation_module_id, revision);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_modules
    ADD CONSTRAINT "UQ_navigation_modules_code" UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_definition_revisions
    ADD CONSTRAINT "UQ_view_definition_revision" UNIQUE (view_definition_id, revision);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_definitions
    ADD CONSTRAINT "UQ_view_definitions_code" UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.widget_catalog
    ADD CONSTRAINT "UQ_widget_catalog_code" UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.application_revisions
    ADD CONSTRAINT application_revisions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.change_packages
    ADD CONSTRAINT change_packages_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.change_packages
    ADD CONSTRAINT change_packages_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_constraints
    ADD CONSTRAINT collection_constraints_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_definition_revisions
    ADD CONSTRAINT collection_definition_revisions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_indexes
    ADD CONSTRAINT collection_indexes_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.dependent_review_queue
    ADD CONSTRAINT dependent_review_queue_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.display_rule_revisions
    ADD CONSTRAINT display_rule_revisions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.display_rules
    ADD CONSTRAINT display_rules_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.locales
    ADD CONSTRAINT locales_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.localization_bundles
    ADD CONSTRAINT localization_bundles_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.pack_install_locks
    ADD CONSTRAINT pack_install_locks_pkey PRIMARY KEY (lock_key);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.pack_object_revisions
    ADD CONSTRAINT pack_object_revisions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.pack_object_states
    ADD CONSTRAINT pack_object_states_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.pack_release_records
    ADD CONSTRAINT pack_release_records_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_definition_revisions
    ADD CONSTRAINT property_definition_revisions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.schema_change_log
    ADD CONSTRAINT schema_change_log_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.schema_sync_state
    ADD CONSTRAINT schema_sync_state_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.search_dictionaries
    ADD CONSTRAINT search_dictionaries_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.search_experiences
    ADD CONSTRAINT search_experiences_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.search_index_state
    ADD CONSTRAINT search_index_state_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.search_sources
    ADD CONSTRAINT search_sources_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.translation_keys
    ADD CONSTRAINT translation_keys_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.translation_requests
    ADD CONSTRAINT translation_requests_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.translation_values
    ADD CONSTRAINT translation_values_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_constraints
    ADD CONSTRAINT uq_collection_constraints UNIQUE (collection_id, code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_indexes
    ADD CONSTRAINT uq_collection_indexes UNIQUE (collection_id, code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.locales
    ADD CONSTRAINT uq_locales_code UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.localization_bundles
    ADD CONSTRAINT uq_localization_bundles_locale UNIQUE (locale_code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.pack_object_states
    ADD CONSTRAINT uq_pack_object_state UNIQUE (object_type, object_key);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.search_dictionaries
    ADD CONSTRAINT uq_search_dictionaries_code UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.search_experiences
    ADD CONSTRAINT uq_search_experiences_code UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.search_index_state
    ADD CONSTRAINT uq_search_index_state_collection UNIQUE (collection_code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.search_sources
    ADD CONSTRAINT uq_search_sources_code UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.translation_keys
    ADD CONSTRAINT uq_translation_keys_namespace_key UNIQUE (namespace, key);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.translation_values
    ADD CONSTRAINT uq_translation_values_key_locale UNIQUE (translation_key_id, locale_id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.workspace_definitions
    ADD CONSTRAINT workspace_definitions_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.workspace_definitions
    ADD CONSTRAINT workspace_definitions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.workspace_pages
    ADD CONSTRAINT workspace_pages_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.workspace_variants
    ADD CONSTRAINT workspace_variants_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.device_tokens
    ADD CONSTRAINT device_tokens_token_key UNIQUE (token);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.in_app_notifications
    ADD CONSTRAINT in_app_notifications_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.notification_history
    ADD CONSTRAINT notification_history_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.notification_queue
    ADD CONSTRAINT notification_queue_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.notification_templates
    ADD CONSTRAINT notification_templates_code_key UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_key UNIQUE (user_id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.config_change_history
    ADD CONSTRAINT "PK_1be86c25d2fc54beef9398c6991" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.property_audit_logs
    ADD CONSTRAINT "PK_3878feaf1d72785e4c4fa1d6c53" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.property_access_rules
    ADD CONSTRAINT "PK_64e3b9fa96a1735ba4741905d88" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.collection_access_rules
    ADD CONSTRAINT "PK_685125fdb89c2749d2c76bca5a2" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.access_audit_logs
    ADD CONSTRAINT "PK_92362eda47f20e6eff693801adc" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.access_condition_groups
    ADD CONSTRAINT "PK_a08fcc4ccef7a20eb06585d161d" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.access_conditions
    ADD CONSTRAINT "PK_dc7b7cc80c74b4cb2c2c908bc8e" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT "PK_e8cfb5b31af61cd363a6b6d7c25" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.access_rule_audit_logs
    ADD CONSTRAINT "PK_eabc37285db4504f74492eb2757" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.instance_settings
    ADD CONSTRAINT "PK_eb2567a5e4188cd54689e1d79ef" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT "UQ_e5eb7a3c7766f941fe16b9edecb" UNIQUE (session_token);`);
    await queryRunner.query(`ALTER TABLE ONLY public.instance_settings
    ADD CONSTRAINT "UQ_f4841fbd4c9819d5ade4b5dfeb8" UNIQUE (key);`);
    await queryRunner.query(`ALTER TABLE ONLY public.field_mappings
    ADD CONSTRAINT field_mappings_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.formula_cache
    ADD CONSTRAINT formula_cache_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.inline_editing_test
    ADD CONSTRAINT inline_editing_test_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.instance_customizations
    ADD CONSTRAINT instance_customizations_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.instance_event_outbox
    ADD CONSTRAINT instance_event_outbox_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.instance_upgrade_impact
    ADD CONSTRAINT instance_upgrade_impact_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.key_metadata
    ADD CONSTRAINT key_metadata_pkey PRIMARY KEY (kid);`);
    await queryRunner.query(`ALTER TABLE ONLY public.platform_config
    ADD CONSTRAINT platform_config_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.property_dependencies
    ADD CONSTRAINT property_dependencies_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.runtime_anomaly
    ADD CONSTRAINT runtime_anomaly_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.schema_versions
    ADD CONSTRAINT schema_versions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.search_embeddings
    ADD CONSTRAINT search_embeddings_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.search_embeddings
    ADD CONSTRAINT search_embeddings_source_type_source_id_chunk_index_key UNIQUE (source_type, source_id, chunk_index);`);
    await queryRunner.query(`ALTER TABLE ONLY public.service_principals
    ADD CONSTRAINT service_principals_pkey PRIMARY KEY (service_id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.upgrade_history
    ADD CONSTRAINT upgrade_history_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.upgrade_manifest
    ADD CONSTRAINT upgrade_manifest_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.schema_versions
    ADD CONSTRAINT uq_schema_versions_collection_version UNIQUE (collection_code, version);`);
    await queryRunner.query(`ALTER TABLE ONLY public.view_configurations
    ADD CONSTRAINT view_configurations_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.ai_report_templates
    ADD CONSTRAINT "FK_ai_report_templates_user" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.ai_reports
    ADD CONSTRAINT "FK_ai_reports_user" FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.zero_code_app_versions
    ADD CONSTRAINT "FK_app_versions_app" FOREIGN KEY (app_id) REFERENCES app_builder.zero_code_apps(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.zero_code_app_versions
    ADD CONSTRAINT "FK_app_versions_user" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.ava_stories
    ADD CONSTRAINT "FK_ava_stories_approved_by" FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.ava_stories
    ADD CONSTRAINT "FK_ava_stories_recording" FOREIGN KEY (recording_id) REFERENCES app_builder.sprint_recordings(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.documentation_versions
    ADD CONSTRAINT "FK_doc_versions_doc" FOREIGN KEY (documentation_id) REFERENCES app_builder.generated_documentation(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.nl_queries
    ADD CONSTRAINT "FK_nl_queries_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.predictive_insights
    ADD CONSTRAINT "FK_predictive_insights_user" FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.predictive_suggestions
    ADD CONSTRAINT "FK_predictive_suggestions_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.saved_nl_queries
    ADD CONSTRAINT "FK_saved_nl_queries_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.sprint_recordings
    ADD CONSTRAINT "FK_sprint_recordings_user" FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.story_implementations
    ADD CONSTRAINT "FK_story_implementations_story" FOREIGN KEY (story_id) REFERENCES app_builder.ava_stories(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.upgrade_impact_analyses
    ADD CONSTRAINT "FK_upgrade_analyses_user" FOREIGN KEY (analyzed_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.upgrade_fixes
    ADD CONSTRAINT "FK_upgrade_fixes_analysis" FOREIGN KEY (analysis_id) REFERENCES app_builder.upgrade_impact_analyses(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.upgrade_fixes
    ADD CONSTRAINT "FK_upgrade_fixes_customization" FOREIGN KEY (customization_id) REFERENCES app_builder.customization_registry(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.upgrade_fixes
    ADD CONSTRAINT "FK_upgrade_fixes_user" FOREIGN KEY (applied_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.user_behaviors
    ADD CONSTRAINT "FK_user_behaviors_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.user_patterns
    ADD CONSTRAINT "FK_user_patterns_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.voice_commands
    ADD CONSTRAINT "FK_voice_commands_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY app_builder.zero_code_apps
    ADD CONSTRAINT "FK_zero_code_apps_user" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.approvals
    ADD CONSTRAINT approvals_process_flow_instance_id_fkey FOREIGN KEY (process_flow_instance_id) REFERENCES automation.process_flow_instances(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.automation_rule_revisions
    ADD CONSTRAINT automation_rule_revisions_automation_rule_id_fkey FOREIGN KEY (automation_rule_id) REFERENCES automation.automation_rules(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.automation_rules
    ADD CONSTRAINT fk_automation_rules_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.decision_inputs
    ADD CONSTRAINT fk_decision_inputs_table FOREIGN KEY (table_id) REFERENCES automation.decision_tables(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.decision_rows
    ADD CONSTRAINT fk_decision_rows_table FOREIGN KEY (table_id) REFERENCES automation.decision_tables(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.decision_table_revisions
    ADD CONSTRAINT fk_decision_table_revisions_table FOREIGN KEY (table_id) REFERENCES automation.decision_tables(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.decision_tables
    ADD CONSTRAINT fk_decision_tables_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.decision_tables
    ADD CONSTRAINT fk_decision_tables_collection FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.automation_execution_logs
    ADD CONSTRAINT fk_execution_logs_automation_rule FOREIGN KEY (automation_rule_id) REFERENCES automation.automation_rules(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.guided_process_activities
    ADD CONSTRAINT fk_guided_process_activities_stage FOREIGN KEY (stage_id) REFERENCES automation.guided_process_stages(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.guided_process_revisions
    ADD CONSTRAINT fk_guided_process_revisions_process FOREIGN KEY (process_id) REFERENCES automation.guided_processes(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.guided_process_stages
    ADD CONSTRAINT fk_guided_process_stages_process FOREIGN KEY (process_id) REFERENCES automation.guided_processes(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.guided_processes
    ADD CONSTRAINT fk_guided_processes_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.guided_processes
    ADD CONSTRAINT fk_guided_processes_collection FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_definitions
    ADD CONSTRAINT fk_process_flow_definitions_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_definition_revisions
    ADD CONSTRAINT process_flow_definition_revisions_process_flow_id_fkey FOREIGN KEY (process_flow_id) REFERENCES automation.process_flow_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_definitions
    ADD CONSTRAINT process_flow_definitions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_execution_history
    ADD CONSTRAINT process_flow_execution_history_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES automation.process_flow_instances(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_instances
    ADD CONSTRAINT process_flow_instances_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.process_flow_instances
    ADD CONSTRAINT process_flow_instances_process_flow_id_fkey FOREIGN KEY (process_flow_id) REFERENCES automation.process_flow_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_breaches
    ADD CONSTRAINT sla_breaches_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_breaches
    ADD CONSTRAINT sla_breaches_sla_definition_id_fkey FOREIGN KEY (sla_definition_id) REFERENCES automation.sla_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_breaches
    ADD CONSTRAINT sla_breaches_sla_instance_id_fkey FOREIGN KEY (sla_instance_id) REFERENCES automation.sla_instances(id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_definitions
    ADD CONSTRAINT sla_definitions_business_hours_id_fkey FOREIGN KEY (business_hours_id) REFERENCES automation.business_hours(id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_definitions
    ADD CONSTRAINT sla_definitions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_instances
    ADD CONSTRAINT sla_instances_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.sla_instances
    ADD CONSTRAINT sla_instances_sla_definition_id_fkey FOREIGN KEY (sla_definition_id) REFERENCES automation.sla_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY automation.state_change_history
    ADD CONSTRAINT state_change_history_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.state_change_history
    ADD CONSTRAINT state_change_history_state_machine_id_fkey FOREIGN KEY (state_machine_id) REFERENCES automation.state_machine_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY automation.state_machine_definitions
    ADD CONSTRAINT state_machine_definitions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_intents
    ADD CONSTRAINT ava_intents_message_id_fkey FOREIGN KEY (message_id) REFERENCES ava.ava_messages(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY ava.ava_messages
    ADD CONSTRAINT ava_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES ava.ava_conversations(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY ava.dataset_snapshots
    ADD CONSTRAINT dataset_snapshots_dataset_definition_id_fkey FOREIGN KEY (dataset_definition_id) REFERENCES ava.dataset_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY ava.model_artifacts
    ADD CONSTRAINT model_artifacts_dataset_snapshot_id_fkey FOREIGN KEY (dataset_snapshot_id) REFERENCES ava.dataset_snapshots(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY ava.model_deployments
    ADD CONSTRAINT model_deployments_model_artifact_id_fkey FOREIGN KEY (model_artifact_id) REFERENCES ava.model_artifacts(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY ava.model_evaluations
    ADD CONSTRAINT model_evaluations_dataset_snapshot_id_fkey FOREIGN KEY (dataset_snapshot_id) REFERENCES ava.dataset_snapshots(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY ava.model_evaluations
    ADD CONSTRAINT model_evaluations_model_artifact_id_fkey FOREIGN KEY (model_artifact_id) REFERENCES ava.model_artifacts(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY ava.model_training_jobs
    ADD CONSTRAINT model_training_jobs_dataset_snapshot_id_fkey FOREIGN KEY (dataset_snapshot_id) REFERENCES ava.dataset_snapshots(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY ava.model_training_jobs
    ADD CONSTRAINT model_training_jobs_model_artifact_id_fkey FOREIGN KEY (model_artifact_id) REFERENCES ava.model_artifacts(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.group_roles
    ADD CONSTRAINT "FK_0f428ea82b51ea6c795689cdb8a" FOREIGN KEY (group_id) REFERENCES identity.groups(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.group_roles
    ADD CONSTRAINT "FK_14ee449cf1a7a0e879b54fd5626" FOREIGN KEY (created_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.nav_profiles
    ADD CONSTRAINT "FK_1520f8f695df6f299c14f4f1fcc" FOREIGN KEY (role_id) REFERENCES identity.roles(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.user_invitations
    ADD CONSTRAINT "FK_18241a1a2cb2d284716636b2340" FOREIGN KEY (invited_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.mfa_methods
    ADD CONSTRAINT "FK_1d590a89ba342ab3515e64f6d28" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.group_members
    ADD CONSTRAINT "FK_20a555b299f75843aa53ff8b0ee" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.group_members
    ADD CONSTRAINT "FK_2c840df5db52dc6b4a1b0b69c6e" FOREIGN KEY (group_id) REFERENCES identity.groups(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.group_roles
    ADD CONSTRAINT "FK_35d4b5f7da6e1a9a730c3621ecc" FOREIGN KEY (role_id) REFERENCES identity.roles(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.roles
    ADD CONSTRAINT "FK_3e97eeaf865aeda0d20c0c5c509" FOREIGN KEY (parent_id) REFERENCES identity.roles(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.password_history
    ADD CONSTRAINT "FK_4933dc7a01356ac0733a5ad52d9" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.roles
    ADD CONSTRAINT "FK_4a39f3095781cdd9d6061afaae5" FOREIGN KEY (created_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.group_members
    ADD CONSTRAINT "FK_4ad0de0815545b0c63e2b86250c" FOREIGN KEY (created_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.password_reset_tokens
    ADD CONSTRAINT "FK_52ac39dd8a28730c63aeb428c9c" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.roles
    ADD CONSTRAINT "FK_747b580d73db0ad78963d78b076" FOREIGN KEY (updated_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.nav_profiles
    ADD CONSTRAINT "FK_77d64f0d70a0883578f4436a804" FOREIGN KEY (user_id) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.user_roles
    ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.user_roles
    ADD CONSTRAINT "FK_947e863084a338ac018f1beab96" FOREIGN KEY (created_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.groups
    ADD CONSTRAINT "FK_a2fa29bfd5351b5b7ccacbc9f7c" FOREIGN KEY (created_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.user_roles
    ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY (role_id) REFERENCES identity.roles(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.nav_profiles
    ADD CONSTRAINT "FK_c2791c2beecf130b1bf94bb42a3" FOREIGN KEY (group_id) REFERENCES identity.groups(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.auth_events
    ADD CONSTRAINT "FK_d27703f0a3d79ba424741807cb4" FOREIGN KEY (user_id) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.groups
    ADD CONSTRAINT "FK_d768ea35a407c2ba9c0b038b613" FOREIGN KEY (parent_id) REFERENCES identity.groups(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.nav_profile_items
    ADD CONSTRAINT "FK_e61477461f4ab1ba6729234fe47" FOREIGN KEY (parent_id) REFERENCES identity.nav_profile_items(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.nav_profile_items
    ADD CONSTRAINT "FK_f02d51b25f5821bc1ee6780cc1b" FOREIGN KEY (profile_id) REFERENCES identity.nav_profiles(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.email_verification_tokens
    ADD CONSTRAINT "FK_fdcb77f72f529bf65c95d72a147" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.behavioral_profiles
    ADD CONSTRAINT behavioral_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.delegations
    ADD CONSTRAINT delegations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.delegations
    ADD CONSTRAINT delegations_delegate_id_fkey FOREIGN KEY (delegate_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.delegations
    ADD CONSTRAINT delegations_delegator_id_fkey FOREIGN KEY (delegator_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.delegations
    ADD CONSTRAINT delegations_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_impersonator_id_fkey FOREIGN KEY (impersonator_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.impersonation_sessions
    ADD CONSTRAINT impersonation_sessions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.magic_link_tokens
    ADD CONSTRAINT magic_link_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_parent_token_id_fkey FOREIGN KEY (parent_token_id) REFERENCES identity.refresh_tokens(token_hash) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_replaced_by_token_id_fkey FOREIGN KEY (replaced_by_token_id) REFERENCES identity.refresh_tokens(token_hash) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.security_alerts
    ADD CONSTRAINT security_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.security_alerts
    ADD CONSTRAINT security_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.security_alerts
    ADD CONSTRAINT security_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.trusted_devices
    ADD CONSTRAINT trusted_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.api_keys
    ADD CONSTRAINT "FK_a3baee01d8408cd3c0f89a9a973" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.api_request_logs
    ADD CONSTRAINT api_request_logs_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES integrations.api_keys(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.api_request_logs
    ADD CONSTRAINT api_request_logs_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES integrations.oauth_clients(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.connector_connections
    ADD CONSTRAINT connector_connections_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES integrations.external_connectors(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_client_id_fkey FOREIGN KEY (client_id) REFERENCES integrations.oauth_clients(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_authorization_codes
    ADD CONSTRAINT oauth_authorization_codes_client_id_fkey FOREIGN KEY (client_id) REFERENCES integrations.oauth_clients(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_access_token_id_fkey FOREIGN KEY (access_token_id) REFERENCES integrations.oauth_access_tokens(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_client_id_fkey FOREIGN KEY (client_id) REFERENCES integrations.oauth_clients(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.sync_configurations
    ADD CONSTRAINT sync_configurations_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES integrations.connector_connections(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.sync_configurations
    ADD CONSTRAINT sync_configurations_mapping_id_fkey FOREIGN KEY (mapping_id) REFERENCES public.field_mappings(id);`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.sync_runs
    ADD CONSTRAINT sync_runs_configuration_id_fkey FOREIGN KEY (configuration_id) REFERENCES integrations.sync_configurations(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY integrations.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES integrations.webhook_subscriptions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_definitions
    ADD CONSTRAINT "FK_10dab69d18bbe034d20839f2adf" FOREIGN KEY (property_type_id) REFERENCES metadata.property_types(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.form_definitions
    ADD CONSTRAINT "FK_111982cc806d8c26c9c445ece75" FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.user_theme_preferences
    ADD CONSTRAINT "FK_15ec7ebb4783b5d71df82027898" FOREIGN KEY (theme_id) REFERENCES metadata.theme_definitions(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_definitions
    ADD CONSTRAINT "FK_2e4c4613796c3af281556a2b62c" FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.module_security
    ADD CONSTRAINT "FK_476979d5494d0697ddd56dd94c8" FOREIGN KEY (module_id) REFERENCES metadata.modules(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.form_versions
    ADD CONSTRAINT "FK_5270f702bc84ac42d6211ce4478" FOREIGN KEY (form_id) REFERENCES metadata.form_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.theme_definitions
    ADD CONSTRAINT "FK_53431368019d2e12f9db8bee72a" FOREIGN KEY (created_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.module_security
    ADD CONSTRAINT "FK_6b88a58f364d05ef36ab89d3534" FOREIGN KEY (role_id) REFERENCES identity.roles(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.choice_items
    ADD CONSTRAINT "FK_98334e02c5109bd3a8ec155c2bd" FOREIGN KEY (choice_list_id) REFERENCES metadata.choice_lists(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.user_theme_preferences
    ADD CONSTRAINT "FK_ae77cd7cd68614f5880e1027574" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_definitions
    ADD CONSTRAINT "FK_c38e77b7b225ba65cddbf6e10a8" FOREIGN KEY (updated_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_definitions
    ADD CONSTRAINT "FK_c88d8fdd8f9688600a99b0b9711" FOREIGN KEY (created_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.instance_branding
    ADD CONSTRAINT "FK_ce407c1aa6965b7f4667e1c2385" FOREIGN KEY (default_theme_id) REFERENCES metadata.theme_definitions(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_definitions
    ADD CONSTRAINT "FK_e7ba7ffa905aec05e0791992923" FOREIGN KEY (reference_collection_id) REFERENCES metadata.collection_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_definitions
    ADD CONSTRAINT "FK_ed35ee925189245000d53d91490" FOREIGN KEY (created_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.nav_nodes
    ADD CONSTRAINT "FK_nav_nodes_parent" FOREIGN KEY (parent_id) REFERENCES metadata.nav_nodes(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.nav_nodes
    ADD CONSTRAINT "FK_nav_nodes_profile" FOREIGN KEY (profile_id) REFERENCES identity.nav_profiles(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.nav_patches
    ADD CONSTRAINT "FK_nav_patches_profile" FOREIGN KEY (profile_id) REFERENCES identity.nav_profiles(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_module_revisions
    ADD CONSTRAINT "FK_navigation_module_revisions_created_by" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_module_revisions
    ADD CONSTRAINT "FK_navigation_module_revisions_definition" FOREIGN KEY (navigation_module_id) REFERENCES metadata.navigation_modules(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_module_revisions
    ADD CONSTRAINT "FK_navigation_module_revisions_published_by" FOREIGN KEY (published_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_modules
    ADD CONSTRAINT "FK_navigation_modules_created_by" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_modules
    ADD CONSTRAINT "FK_navigation_modules_updated_by" FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_variants
    ADD CONSTRAINT "FK_navigation_variants_created_by" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_variants
    ADD CONSTRAINT "FK_navigation_variants_definition" FOREIGN KEY (navigation_module_id) REFERENCES metadata.navigation_modules(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_variants
    ADD CONSTRAINT "FK_navigation_variants_updated_by" FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_definition_revisions
    ADD CONSTRAINT "FK_view_definition_revisions_created_by" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_definition_revisions
    ADD CONSTRAINT "FK_view_definition_revisions_definition" FOREIGN KEY (view_definition_id) REFERENCES metadata.view_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_definition_revisions
    ADD CONSTRAINT "FK_view_definition_revisions_published_by" FOREIGN KEY (published_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_definitions
    ADD CONSTRAINT "FK_view_definitions_created_by" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_definitions
    ADD CONSTRAINT "FK_view_definitions_updated_by" FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_variants
    ADD CONSTRAINT "FK_view_variants_created_by" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_variants
    ADD CONSTRAINT "FK_view_variants_definition" FOREIGN KEY (view_definition_id) REFERENCES metadata.view_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_variants
    ADD CONSTRAINT "FK_view_variants_updated_by" FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.application_revisions
    ADD CONSTRAINT application_revisions_application_id_fkey FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_constraints
    ADD CONSTRAINT collection_constraints_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_definition_revisions
    ADD CONSTRAINT collection_definition_revisions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_indexes
    ADD CONSTRAINT collection_indexes_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.change_packages
    ADD CONSTRAINT fk_change_packages_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_constraints
    ADD CONSTRAINT fk_collection_constraints_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_constraints
    ADD CONSTRAINT fk_collection_constraints_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_definitions
    ADD CONSTRAINT fk_collection_definitions_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_indexes
    ADD CONSTRAINT fk_collection_indexes_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.collection_indexes
    ADD CONSTRAINT fk_collection_indexes_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.dependent_review_queue
    ADD CONSTRAINT fk_dependent_review_queue_collection FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.display_rule_revisions
    ADD CONSTRAINT fk_display_rule_revisions_rule FOREIGN KEY (display_rule_id) REFERENCES metadata.display_rules(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.display_rules
    ADD CONSTRAINT fk_display_rules_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.display_rules
    ADD CONSTRAINT fk_display_rules_collection FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.form_definitions
    ADD CONSTRAINT fk_form_definitions_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.navigation_modules
    ADD CONSTRAINT fk_navigation_modules_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.pack_release_records
    ADD CONSTRAINT fk_pack_release_applied_by FOREIGN KEY (applied_by) REFERENCES public.users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.pack_release_records
    ADD CONSTRAINT fk_pack_release_rollback FOREIGN KEY (rollback_of_release_id) REFERENCES metadata.pack_release_records(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_definitions
    ADD CONSTRAINT fk_property_definitions_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.view_definitions
    ADD CONSTRAINT fk_view_definitions_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.widget_catalog
    ADD CONSTRAINT fk_widget_catalog_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE RESTRICT;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.workspace_definitions
    ADD CONSTRAINT fk_workspace_definitions_application FOREIGN KEY (application_id) REFERENCES metadata.applications(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.workspace_definitions
    ADD CONSTRAINT fk_workspace_definitions_default_collection FOREIGN KEY (default_collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.workspace_pages
    ADD CONSTRAINT fk_workspace_pages_collection FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.workspace_pages
    ADD CONSTRAINT fk_workspace_pages_workspace FOREIGN KEY (workspace_id) REFERENCES metadata.workspace_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.workspace_variants
    ADD CONSTRAINT fk_workspace_variants_page FOREIGN KEY (page_id) REFERENCES metadata.workspace_pages(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.workspace_variants
    ADD CONSTRAINT fk_workspace_variants_workspace FOREIGN KEY (workspace_id) REFERENCES metadata.workspace_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.localization_bundles
    ADD CONSTRAINT localization_bundles_locale_id_fkey FOREIGN KEY (locale_id) REFERENCES metadata.locales(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.pack_object_revisions
    ADD CONSTRAINT pack_object_revisions_release_record_id_fkey FOREIGN KEY (release_record_id) REFERENCES metadata.pack_release_records(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.pack_object_states
    ADD CONSTRAINT pack_object_states_current_revision_id_fkey FOREIGN KEY (current_revision_id) REFERENCES metadata.pack_object_revisions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.property_definition_revisions
    ADD CONSTRAINT property_definition_revisions_property_id_fkey FOREIGN KEY (property_id) REFERENCES metadata.property_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.translation_requests
    ADD CONSTRAINT translation_requests_locale_id_fkey FOREIGN KEY (locale_id) REFERENCES metadata.locales(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.translation_requests
    ADD CONSTRAINT translation_requests_translation_key_id_fkey FOREIGN KEY (translation_key_id) REFERENCES metadata.translation_keys(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.translation_values
    ADD CONSTRAINT translation_values_locale_id_fkey FOREIGN KEY (locale_id) REFERENCES metadata.locales(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY metadata.translation_values
    ADD CONSTRAINT translation_values_translation_key_id_fkey FOREIGN KEY (translation_key_id) REFERENCES metadata.translation_keys(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY notify.in_app_notifications
    ADD CONSTRAINT in_app_notifications_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.notification_history
    ADD CONSTRAINT notification_history_notification_queue_id_fkey FOREIGN KEY (notification_queue_id) REFERENCES notify.notification_queue(id);`);
    await queryRunner.query(`ALTER TABLE ONLY notify.notification_queue
    ADD CONSTRAINT notification_queue_template_id_fkey FOREIGN KEY (template_id) REFERENCES notify.notification_templates(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.property_access_rules
    ADD CONSTRAINT "FK_0189d2c9de5f8ef47506294a27f" FOREIGN KEY (role_id) REFERENCES identity.roles(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_021e2c9d9dca9f0885e8d738326" FOREIGN KEY (deleted_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.collection_access_rules
    ADD CONSTRAINT "FK_0644be2a2e4d4a95dae2039d044" FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.collection_access_rules
    ADD CONSTRAINT "FK_0716029d0918b15af5c777d3b19" FOREIGN KEY (created_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.collection_access_rules
    ADD CONSTRAINT "FK_0ee922b564bc954b4d97eae8154" FOREIGN KEY (role_id) REFERENCES identity.roles(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.collection_access_rules
    ADD CONSTRAINT "FK_2bbd90ecb185529732938857fa3" FOREIGN KEY (user_id) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.property_access_rules
    ADD CONSTRAINT "FK_314d7767bd038e2d47aebb208f5" FOREIGN KEY (property_id) REFERENCES metadata.property_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT "FK_458057fa75b66e68a275647da2e" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_84808507d893ed21a8b8253d6bc" FOREIGN KEY (suspended_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.property_access_rules
    ADD CONSTRAINT "FK_8c5f3ff32b318d551d8f4a7b280" FOREIGN KEY (user_id) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.property_access_rules
    ADD CONSTRAINT "FK_a0b9e97943e753481035a49922f" FOREIGN KEY (group_id) REFERENCES identity.groups(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_a9add0cb9d63c590d8aedeceecb" FOREIGN KEY (deactivated_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0" FOREIGN KEY (user_id) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_d2dbc280ebc69071c0846c87019" FOREIGN KEY (invited_by) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.collection_access_rules
    ADD CONSTRAINT "FK_d9437ad9cb5e4aedaf442b949e5" FOREIGN KEY (group_id) REFERENCES identity.groups(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_fba2d8e029689aa8fea98e53c91" FOREIGN KEY (manager_id) REFERENCES public.users(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.property_access_rules
    ADD CONSTRAINT "FK_property_access_rules_wildcard_collection_id" FOREIGN KEY (wildcard_collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.field_mappings
    ADD CONSTRAINT field_mappings_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES integrations.connector_connections(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.formula_cache
    ADD CONSTRAINT fk_formula_cache_collection FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.formula_cache
    ADD CONSTRAINT fk_formula_cache_property FOREIGN KEY (property_id) REFERENCES metadata.property_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.property_dependencies
    ADD CONSTRAINT fk_property_dependencies_collection FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.property_dependencies
    ADD CONSTRAINT fk_property_dependencies_property FOREIGN KEY (property_id) REFERENCES metadata.property_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.view_configurations
    ADD CONSTRAINT fk_view_config_collection FOREIGN KEY (collection_id) REFERENCES metadata.collection_definitions(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.instance_upgrade_impact
    ADD CONSTRAINT instance_upgrade_impact_upgrade_manifest_id_fkey FOREIGN KEY (upgrade_manifest_id) REFERENCES public.upgrade_manifest(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.schema_versions
    ADD CONSTRAINT schema_versions_parent_version_id_fkey FOREIGN KEY (parent_version_id) REFERENCES public.schema_versions(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.upgrade_history
    ADD CONSTRAINT upgrade_history_upgrade_manifest_id_fkey FOREIGN KEY (upgrade_manifest_id) REFERENCES public.upgrade_manifest(id);`);
    await queryRunner.query(`ALTER TABLE ONLY identity.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES identity.roles(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY identity.role_permissions
    ADD CONSTRAINT role_permissions_permission_code_fkey FOREIGN KEY (permission_code) REFERENCES identity.platform_permissions(code) ON DELETE RESTRICT;`);

    // Comments
    await queryRunner.query(`COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';`);
    await queryRunner.query(`COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';`);
    await queryRunner.query(`COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';`);
    await queryRunner.query(`COMMENT ON FUNCTION public.invalidate_formula_cache(p_collection_id uuid, p_record_id uuid, p_property_id uuid, p_reason character varying) IS 'Marks formula cache entries as stale. Used when source data changes.';`);
    await queryRunner.query(`COMMENT ON COLUMN metadata.collection_definitions.owner IS 'Ownership determines mutability: system=immutable, platform=extensible by tenant, custom=full tenant control';`);
    await queryRunner.query(`COMMENT ON COLUMN metadata.collection_definitions.sync_status IS 'Synchronization status between metadata and physical PostgreSQL schema';`);
    await queryRunner.query(`COMMENT ON COLUMN metadata.collection_definitions.physical_checksum IS 'SHA-256 hash of physical table structure for drift detection';`);
    await queryRunner.query(`COMMENT ON COLUMN metadata.property_definitions.owner IS 'Ownership determines mutability. Custom properties on platform collections must use x_ prefix.';`);
    await queryRunner.query(`COMMENT ON COLUMN metadata.property_definitions.custom_property_prefix IS 'Required prefix for custom properties added to platform collections (default: x_)';`);
    await queryRunner.query(`COMMENT ON TABLE metadata.schema_change_log IS 'Complete audit trail of all schema modifications for compliance and rollback support';`);
    await queryRunner.query(`COMMENT ON COLUMN metadata.schema_change_log.before_state IS 'JSON snapshot of entity state before change, enables rollback';`);
    await queryRunner.query(`COMMENT ON COLUMN metadata.schema_change_log.ddl_statements IS 'Array of SQL DDL statements executed during this change';`);
    await queryRunner.query(`COMMENT ON TABLE metadata.schema_sync_state IS 'Singleton table tracking schema synchronization state and distributed locking';`);
    await queryRunner.query(`COMMENT ON COLUMN metadata.schema_sync_state.sync_lock_holder IS 'Instance ID of the service currently running sync (for distributed coordination)';`);
    await queryRunner.query(`COMMENT ON COLUMN metadata.schema_sync_state.drift_details IS 'JSON array of detected drift issues from last check';`);
    await queryRunner.query(`COMMENT ON TABLE public.formula_cache IS 'Caches computed formula values for performance. Invalidated when dependencies change.';`);
    await queryRunner.query(`COMMENT ON TABLE public.property_dependencies IS 'Tracks dependencies between computed properties for proper calculation ordering and cache invalidation.';`);
    await queryRunner.query(`COMMENT ON VIEW public.computed_properties_overview IS 'Overview of all computed properties with dependency and cache statistics.';`);
    await queryRunner.query(`COMMENT ON VIEW public.recent_schema_changes IS 'Convenience view showing recent schema modifications with entity names';`);
    await queryRunner.query(`COMMENT ON TABLE public.schema_versions IS 'Stores full schema snapshots for collections, enabling version history and rollback';`);
    await queryRunner.query(`COMMENT ON COLUMN public.schema_versions.snapshot IS 'Complete JSON snapshot of the collection schema at this version';`);
    await queryRunner.query(`COMMENT ON COLUMN public.schema_versions.change_summary IS 'Human-readable description of what changed in this version';`);
    await queryRunner.query(`COMMENT ON TABLE public.view_configurations IS 'Stores view configurations for collections including list, calendar, kanban, timeline, map, gantt, and pivot views.';`);

  }

  public async down(): Promise<void> {
    throw new Error('Baseline migration is forward-only');
  }
}
