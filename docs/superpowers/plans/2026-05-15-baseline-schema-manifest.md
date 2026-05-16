# HubbleWave Schema Manifest
# Generated: 2026-05-16
# Deterministic schema snapshot for baseline audit and drift detection.
# SHA-256 (of introspection content below): 81df3069fd304a691b9914aed21cf53548dba126e674626ba6e776747eb2aaae
# Instance database: hubblewave
# Control-plane database: hubblewave_control_plane
## Tables and Columns
app_builder|ai_report_templates|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|ai_report_templates|name|2||NO|character varying|255|varchar
app_builder|ai_report_templates|description|3||YES|text||text
app_builder|ai_report_templates|category|4||YES|character varying|100|varchar
app_builder|ai_report_templates|base_prompt|5||YES|text||text
app_builder|ai_report_templates|schema_hints|6||YES|jsonb||jsonb
app_builder|ai_report_templates|chart_preferences|7||YES|jsonb||jsonb
app_builder|ai_report_templates|is_public|8|false|NO|boolean||bool
app_builder|ai_report_templates|created_by|9||YES|uuid||uuid
app_builder|ai_report_templates|created_at|10|now()|NO|timestamp with time zone||timestamptz
app_builder|ai_reports|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|ai_reports|title|2||YES|character varying|500|varchar
app_builder|ai_reports|prompt|3||NO|text||text
app_builder|ai_reports|parsed_intent|4||YES|jsonb||jsonb
app_builder|ai_reports|definition|5||NO|jsonb||jsonb
app_builder|ai_reports|format|6||YES|character varying|50|varchar
app_builder|ai_reports|status|7|'pending'::character varying|NO|character varying|20|varchar
app_builder|ai_reports|generated_file_url|8||YES|text||text
app_builder|ai_reports|generated_by|9||YES|uuid||uuid
app_builder|ai_reports|generation_time_ms|10||YES|integer||int4
app_builder|ai_reports|created_at|11|now()|NO|timestamp with time zone||timestamptz
app_builder|ai_reports|updated_at|12|now()|NO|timestamp with time zone||timestamptz
app_builder|app_builder_components|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|app_builder_components|name|2||NO|character varying|255|varchar
app_builder|app_builder_components|category|3||NO|character varying|100|varchar
app_builder|app_builder_components|component_type|4||NO|character varying|100|varchar
app_builder|app_builder_components|default_props|5||NO|jsonb||jsonb
app_builder|app_builder_components|schema|6||NO|jsonb||jsonb
app_builder|app_builder_components|icon|7||YES|character varying|100|varchar
app_builder|app_builder_components|is_system|8|false|NO|boolean||bool
app_builder|app_builder_components|created_at|9|now()|NO|timestamp with time zone||timestamptz
app_builder|ava_stories|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|ava_stories|recording_id|2||YES|uuid||uuid
app_builder|ava_stories|title|3||NO|character varying|255|varchar
app_builder|ava_stories|description|4||YES|text||text
app_builder|ava_stories|story_type|5||YES|character varying|50|varchar
app_builder|ava_stories|priority|6||YES|character varying|20|varchar
app_builder|ava_stories|estimated_points|7||YES|integer||int4
app_builder|ava_stories|acceptance_criteria|8||YES|jsonb||jsonb
app_builder|ava_stories|suggested_collections|9||YES|jsonb||jsonb
app_builder|ava_stories|suggested_rules|10||YES|jsonb||jsonb
app_builder|ava_stories|suggested_flows|11||YES|jsonb||jsonb
app_builder|ava_stories|status|12|'draft'::character varying|NO|character varying|20|varchar
app_builder|ava_stories|approved_by|13||YES|uuid||uuid
app_builder|ava_stories|approved_at|14||YES|timestamp with time zone||timestamptz
app_builder|ava_stories|created_at|15|now()|NO|timestamp with time zone||timestamptz
app_builder|ava_stories|updated_at|16|now()|NO|timestamp with time zone||timestamptz
app_builder|customization_registry|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|customization_registry|customization_type|2||NO|character varying|50|varchar
app_builder|customization_registry|artifact_id|3||NO|uuid||uuid
app_builder|customization_registry|artifact_code|4||YES|character varying|100|varchar
app_builder|customization_registry|is_system_modified|5|false|NO|boolean||bool
app_builder|customization_registry|original_hash|6||YES|character varying|64|varchar
app_builder|customization_registry|current_hash|7||YES|character varying|64|varchar
app_builder|customization_registry|dependencies|8|'[]'::jsonb|NO|jsonb||jsonb
app_builder|customization_registry|dependents|9|'[]'::jsonb|NO|jsonb||jsonb
app_builder|customization_registry|platform_version_created|10||YES|character varying|20|varchar
app_builder|customization_registry|last_analyzed_version|11||YES|character varying|20|varchar
app_builder|customization_registry|created_at|12|now()|NO|timestamp with time zone||timestamptz
app_builder|customization_registry|updated_at|13|now()|NO|timestamp with time zone||timestamptz
app_builder|digital_twins|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|digital_twins|asset_id|2||NO|character varying|255|varchar
app_builder|digital_twins|model_url|3||YES|text||text
app_builder|digital_twins|model_version|4||YES|character varying|50|varchar
app_builder|digital_twins|sync_interval|5|1000|NO|integer||int4
app_builder|digital_twins|sensor_mappings|6|'[]'::jsonb|NO|jsonb||jsonb
app_builder|digital_twins|state|7|'{}'::jsonb|NO|jsonb||jsonb
app_builder|digital_twins|is_active|8|true|NO|boolean||bool
app_builder|digital_twins|last_sync_at|9||YES|timestamp with time zone||timestamptz
app_builder|digital_twins|created_at|10|now()|NO|timestamp with time zone||timestamptz
app_builder|digital_twins|updated_at|11|now()|NO|timestamp with time zone||timestamptz
app_builder|digital_twins|name|12||NO|character varying|255|varchar
app_builder|digital_twins|description|13||YES|text||text
app_builder|digital_twins|asset_type|14||NO|character varying|100|varchar
app_builder|digital_twins|status|15|'active'::character varying|YES|character varying|20|varchar
app_builder|documentation_versions|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|documentation_versions|documentation_id|2||NO|uuid||uuid
app_builder|documentation_versions|version|3||NO|integer||int4
app_builder|documentation_versions|documentation|4||NO|jsonb||jsonb
app_builder|documentation_versions|change_summary|5||YES|text||text
app_builder|documentation_versions|created_at|6|now()|NO|timestamp with time zone||timestamptz
app_builder|generated_documentation|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|generated_documentation|artifact_type|2||NO|character varying|50|varchar
app_builder|generated_documentation|artifact_id|3||NO|uuid||uuid
app_builder|generated_documentation|artifact_code|4||YES|character varying|100|varchar
app_builder|generated_documentation|documentation|5||NO|jsonb||jsonb
app_builder|generated_documentation|search_text|6||YES|text||text
app_builder|generated_documentation|version|7|1|NO|integer||int4
app_builder|generated_documentation|generated_at|8|now()|NO|timestamp with time zone||timestamptz
app_builder|generated_documentation|generated_by|9|'ava'::character varying|NO|character varying|50|varchar
app_builder|generated_documentation|created_at|10|now()|NO|timestamp with time zone||timestamptz
app_builder|generated_documentation|updated_at|11|now()|NO|timestamp with time zone||timestamptz
app_builder|insight_analysis_jobs|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|insight_analysis_jobs|job_type|2||NO|character varying|50|varchar
app_builder|insight_analysis_jobs|last_run_at|3||YES|timestamp with time zone||timestamptz
app_builder|insight_analysis_jobs|next_run_at|4||YES|timestamp with time zone||timestamptz
app_builder|insight_analysis_jobs|run_frequency_hours|5|24|NO|integer||int4
app_builder|insight_analysis_jobs|status|6|'pending'::character varying|NO|character varying|20|varchar
app_builder|insight_analysis_jobs|last_result|7||YES|jsonb||jsonb
app_builder|insight_analysis_jobs|created_at|8|now()|NO|timestamp with time zone||timestamptz
app_builder|insight_analysis_jobs|updated_at|9|now()|NO|timestamp with time zone||timestamptz
app_builder|nl_queries|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|nl_queries|user_id|2||YES|uuid||uuid
app_builder|nl_queries|query_text|3||NO|text||text
app_builder|nl_queries|parsed_intent|4||YES|jsonb||jsonb
app_builder|nl_queries|generated_sql|5||YES|text||text
app_builder|nl_queries|result_count|6||YES|integer||int4
app_builder|nl_queries|confidence|7||YES|numeric||numeric
app_builder|nl_queries|execution_time_ms|8||YES|integer||int4
app_builder|nl_queries|error_message|9||YES|text||text
app_builder|nl_queries|created_at|10|now()|NO|timestamp with time zone||timestamptz
app_builder|predictive_insights|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|predictive_insights|insight_type|2||NO|character varying|50|varchar
app_builder|predictive_insights|severity|3||NO|character varying|20|varchar
app_builder|predictive_insights|title|4||NO|character varying|255|varchar
app_builder|predictive_insights|description|5||NO|text||text
app_builder|predictive_insights|affected_artifact_type|6||YES|character varying|50|varchar
app_builder|predictive_insights|affected_artifact_id|7||YES|uuid||uuid
app_builder|predictive_insights|data_points|8||YES|jsonb||jsonb
app_builder|predictive_insights|suggested_actions|9||YES|jsonb||jsonb
app_builder|predictive_insights|status|10|'open'::character varying|NO|character varying|20|varchar
app_builder|predictive_insights|resolved_action|11||YES|character varying|100|varchar
app_builder|predictive_insights|resolved_by|12||YES|uuid||uuid
app_builder|predictive_insights|resolved_at|13||YES|timestamp with time zone||timestamptz
app_builder|predictive_insights|expires_at|14||YES|timestamp with time zone||timestamptz
app_builder|predictive_insights|created_at|15|now()|NO|timestamp with time zone||timestamptz
app_builder|predictive_suggestions|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|predictive_suggestions|user_id|2||YES|uuid||uuid
app_builder|predictive_suggestions|suggestion_type|3||YES|character varying|100|varchar
app_builder|predictive_suggestions|label|4||YES|text||text
app_builder|predictive_suggestions|description|5||YES|text||text
app_builder|predictive_suggestions|action_type|6||YES|character varying|100|varchar
app_builder|predictive_suggestions|action_payload|7||YES|jsonb||jsonb
app_builder|predictive_suggestions|confidence|8||YES|numeric||numeric
app_builder|predictive_suggestions|accepted|9||YES|boolean||bool
app_builder|predictive_suggestions|dismissed|10|false|NO|boolean||bool
app_builder|predictive_suggestions|context_route|11||YES|character varying|500|varchar
app_builder|predictive_suggestions|shown_at|12|now()|NO|timestamp with time zone||timestamptz
app_builder|predictive_suggestions|responded_at|13||YES|timestamp with time zone||timestamptz
app_builder|recovery_actions|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|recovery_actions|name|2||NO|character varying|255|varchar
app_builder|recovery_actions|action_type|3||NO|character varying|50|varchar
app_builder|recovery_actions|target_service|4||YES|character varying|255|varchar
app_builder|recovery_actions|trigger_conditions|5||NO|jsonb||jsonb
app_builder|recovery_actions|action_config|6||NO|jsonb||jsonb
app_builder|recovery_actions|is_active|7|true|NO|boolean||bool
app_builder|recovery_actions|last_triggered_at|8||YES|timestamp with time zone||timestamptz
app_builder|recovery_actions|trigger_count|9|0|NO|integer||int4
app_builder|recovery_actions|created_at|10|now()|NO|timestamp with time zone||timestamptz
app_builder|recovery_actions|updated_at|11|now()|NO|timestamp with time zone||timestamptz
app_builder|saved_nl_queries|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|saved_nl_queries|user_id|2||YES|uuid||uuid
app_builder|saved_nl_queries|name|3||NO|character varying|255|varchar
app_builder|saved_nl_queries|query_text|4||NO|text||text
app_builder|saved_nl_queries|is_favorite|5|false|NO|boolean||bool
app_builder|saved_nl_queries|usage_count|6|0|NO|integer||int4
app_builder|saved_nl_queries|created_at|7|now()|NO|timestamp with time zone||timestamptz
app_builder|self_healing_events|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|self_healing_events|service_name|2||NO|character varying|255|varchar
app_builder|self_healing_events|event_type|3||NO|character varying|100|varchar
app_builder|self_healing_events|action_taken|4||YES|character varying|255|varchar
app_builder|self_healing_events|reason|5||YES|text||text
app_builder|self_healing_events|success|6||YES|boolean||bool
app_builder|self_healing_events|metrics|7||YES|jsonb||jsonb
app_builder|self_healing_events|duration_ms|8||YES|integer||int4
app_builder|self_healing_events|created_at|9|now()|NO|timestamp with time zone||timestamptz
app_builder|sensor_readings|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|sensor_readings|asset_id|2||NO|character varying|255|varchar
app_builder|sensor_readings|sensor_id|3||NO|character varying|255|varchar
app_builder|sensor_readings|data_type|4||YES|character varying|100|varchar
app_builder|sensor_readings|value|5||YES|numeric||numeric
app_builder|sensor_readings|unit|6||YES|character varying|50|varchar
app_builder|sensor_readings|quality|7|'good'::character varying|YES|character varying|20|varchar
app_builder|sensor_readings|timestamp|8|now()|NO|timestamp with time zone||timestamptz
app_builder|service_health_status|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|service_health_status|service_name|2||NO|character varying|255|varchar
app_builder|service_health_status|status|3|'unknown'::character varying|NO|character varying|20|varchar
app_builder|service_health_status|cpu_usage|4||YES|numeric||numeric
app_builder|service_health_status|memory_usage|5||YES|numeric||numeric
app_builder|service_health_status|error_rate|6||YES|numeric||numeric
app_builder|service_health_status|response_time_ms|7||YES|integer||int4
app_builder|service_health_status|replica_count|8||YES|integer||int4
app_builder|service_health_status|last_check_at|9||YES|timestamp with time zone||timestamptz
app_builder|service_health_status|health_history|10|'[]'::jsonb|NO|jsonb||jsonb
app_builder|service_health_status|created_at|11|now()|NO|timestamp with time zone||timestamptz
app_builder|service_health_status|updated_at|12|now()|NO|timestamp with time zone||timestamptz
app_builder|sprint_recordings|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|sprint_recordings|title|2||NO|character varying|255|varchar
app_builder|sprint_recordings|recording_url|3||YES|character varying|500|varchar
app_builder|sprint_recordings|transcript|4||YES|text||text
app_builder|sprint_recordings|duration_seconds|5||YES|integer||int4
app_builder|sprint_recordings|recorded_at|6||NO|timestamp with time zone||timestamptz
app_builder|sprint_recordings|recorded_by|7||YES|uuid||uuid
app_builder|sprint_recordings|status|8|'pending'::character varying|NO|character varying|20|varchar
app_builder|sprint_recordings|analysis|9||YES|jsonb||jsonb
app_builder|sprint_recordings|created_at|10|now()|NO|timestamp with time zone||timestamptz
app_builder|sprint_recordings|updated_at|11|now()|NO|timestamp with time zone||timestamptz
app_builder|story_implementations|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|story_implementations|story_id|2||NO|uuid||uuid
app_builder|story_implementations|artifact_type|3||NO|character varying|50|varchar
app_builder|story_implementations|artifact_id|4||NO|uuid||uuid
app_builder|story_implementations|generated_by_ava|5|true|NO|boolean||bool
app_builder|story_implementations|manual_modifications|6||YES|jsonb||jsonb
app_builder|story_implementations|created_at|7|now()|NO|timestamp with time zone||timestamptz
app_builder|upgrade_fixes|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|upgrade_fixes|analysis_id|2||NO|uuid||uuid
app_builder|upgrade_fixes|customization_id|3||NO|uuid||uuid
app_builder|upgrade_fixes|fix_type|4||NO|character varying|20|varchar
app_builder|upgrade_fixes|original_code|5||YES|text||text
app_builder|upgrade_fixes|fixed_code|6||YES|text||text
app_builder|upgrade_fixes|fix_description|7||YES|text||text
app_builder|upgrade_fixes|applied_by|8||YES|uuid||uuid
app_builder|upgrade_fixes|applied_at|9||YES|timestamp with time zone||timestamptz
app_builder|upgrade_fixes|rollback_available|10|true|NO|boolean||bool
app_builder|upgrade_fixes|created_at|11|now()|NO|timestamp with time zone||timestamptz
app_builder|upgrade_impact_analyses|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|upgrade_impact_analyses|from_version|2||NO|character varying|20|varchar
app_builder|upgrade_impact_analyses|to_version|3||NO|character varying|20|varchar
app_builder|upgrade_impact_analyses|analysis_status|4|'pending'::character varying|NO|character varying|20|varchar
app_builder|upgrade_impact_analyses|total_customizations|5||YES|integer||int4
app_builder|upgrade_impact_analyses|breaking_count|6||YES|integer||int4
app_builder|upgrade_impact_analyses|warning_count|7||YES|integer||int4
app_builder|upgrade_impact_analyses|safe_count|8||YES|integer||int4
app_builder|upgrade_impact_analyses|impact_details|9||YES|jsonb||jsonb
app_builder|upgrade_impact_analyses|ava_recommendations|10||YES|text||text
app_builder|upgrade_impact_analyses|auto_fixable_count|11||YES|integer||int4
app_builder|upgrade_impact_analyses|analyzed_at|12||YES|timestamp with time zone||timestamptz
app_builder|upgrade_impact_analyses|analyzed_by|13||YES|uuid||uuid
app_builder|upgrade_impact_analyses|created_at|14|now()|NO|timestamp with time zone||timestamptz
app_builder|user_behaviors|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|user_behaviors|user_id|2||NO|uuid||uuid
app_builder|user_behaviors|action|3||NO|character varying|255|varchar
app_builder|user_behaviors|context|4||YES|jsonb||jsonb
app_builder|user_behaviors|route|5||YES|character varying|500|varchar
app_builder|user_behaviors|target_entity_type|6||YES|character varying|100|varchar
app_builder|user_behaviors|target_entity_id|7||YES|uuid||uuid
app_builder|user_behaviors|duration_ms|8||YES|integer||int4
app_builder|user_behaviors|timestamp|9|now()|NO|timestamp with time zone||timestamptz
app_builder|user_patterns|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|user_patterns|user_id|2||NO|uuid||uuid
app_builder|user_patterns|pattern_type|3||NO|character varying|100|varchar
app_builder|user_patterns|pattern_data|4||NO|jsonb||jsonb
app_builder|user_patterns|confidence|5||YES|numeric||numeric
app_builder|user_patterns|occurrence_count|6|1|NO|integer||int4
app_builder|user_patterns|last_occurrence_at|7||YES|timestamp with time zone||timestamptz
app_builder|user_patterns|created_at|8|now()|NO|timestamp with time zone||timestamptz
app_builder|user_patterns|updated_at|9|now()|NO|timestamp with time zone||timestamptz
app_builder|voice_command_patterns|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|voice_command_patterns|intent|2||NO|character varying|255|varchar
app_builder|voice_command_patterns|patterns|3||NO|jsonb||jsonb
app_builder|voice_command_patterns|action_type|4||NO|character varying|100|varchar
app_builder|voice_command_patterns|action_config|5||NO|jsonb||jsonb
app_builder|voice_command_patterns|examples|6||YES|ARRAY||_text
app_builder|voice_command_patterns|is_active|7|true|NO|boolean||bool
app_builder|voice_command_patterns|created_at|8|now()|NO|timestamp with time zone||timestamptz
app_builder|voice_commands|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|voice_commands|user_id|2||YES|uuid||uuid
app_builder|voice_commands|session_id|3||YES|uuid||uuid
app_builder|voice_commands|command_text|4||NO|text||text
app_builder|voice_commands|intent|5||YES|character varying|255|varchar
app_builder|voice_commands|entities|6||YES|jsonb||jsonb
app_builder|voice_commands|confidence|7||YES|numeric||numeric
app_builder|voice_commands|executed|8|false|NO|boolean||bool
app_builder|voice_commands|execution_result|9||YES|jsonb||jsonb
app_builder|voice_commands|audio_duration_ms|10||YES|integer||int4
app_builder|voice_commands|created_at|11|now()|NO|timestamp with time zone||timestamptz
app_builder|zero_code_app_versions|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|zero_code_app_versions|app_id|2||NO|uuid||uuid
app_builder|zero_code_app_versions|version|3||NO|character varying|50|varchar
app_builder|zero_code_app_versions|definition|4||NO|jsonb||jsonb
app_builder|zero_code_app_versions|change_summary|5||YES|text||text
app_builder|zero_code_app_versions|created_by|6||YES|uuid||uuid
app_builder|zero_code_app_versions|created_at|7|now()|NO|timestamp with time zone||timestamptz
app_builder|zero_code_apps|id|1|uuid_generate_v4()|NO|uuid||uuid
app_builder|zero_code_apps|name|2||NO|character varying|255|varchar
app_builder|zero_code_apps|description|3||YES|text||text
app_builder|zero_code_apps|version|4|'1.0.0'::character varying|NO|character varying|50|varchar
app_builder|zero_code_apps|definition|5||NO|jsonb||jsonb
app_builder|zero_code_apps|is_published|6|false|NO|boolean||bool
app_builder|zero_code_apps|published_version|7||YES|character varying|50|varchar
app_builder|zero_code_apps|icon|8||YES|character varying|100|varchar
app_builder|zero_code_apps|category|9||YES|character varying|100|varchar
app_builder|zero_code_apps|created_by|10||YES|uuid||uuid
app_builder|zero_code_apps|created_at|11|now()|NO|timestamp with time zone||timestamptz
app_builder|zero_code_apps|updated_at|12|now()|NO|timestamp with time zone||timestamptz
app_builder|zero_code_apps|published_at|13||YES|timestamp with time zone||timestamptz
automation|approvals|id|1|gen_random_uuid()|NO|uuid||uuid
automation|approvals|process_flow_instance_id|2||YES|uuid||uuid
automation|approvals|node_id|3||NO|character varying|100|varchar
automation|approvals|approver_id|4||NO|uuid||uuid
automation|approvals|approver_type|5|'user'::character varying|YES|character varying|50|varchar
automation|approvals|status|6|'pending'::character varying|YES|character varying|50|varchar
automation|approvals|comments|7||YES|text||text
automation|approvals|due_date|8||YES|timestamp with time zone||timestamptz
automation|approvals|responded_at|9||YES|timestamp with time zone||timestamptz
automation|approvals|responded_by|10||YES|uuid||uuid
automation|approvals|delegated_to|11||YES|uuid||uuid
automation|approvals|delegated_at|12||YES|timestamp with time zone||timestamptz
automation|approvals|delegation_reason|13||YES|text||text
automation|approvals|sequence_number|14|1|YES|integer||int4
automation|approvals|approval_type|15|'sequential'::character varying|YES|character varying|50|varchar
automation|approvals|created_at|16|now()|YES|timestamp with time zone||timestamptz
automation|approvals|updated_at|17|now()|YES|timestamp with time zone||timestamptz
automation|automation_execution_logs|id|1|uuid_generate_v4()|NO|uuid||uuid
automation|automation_execution_logs|automation_rule_id|2||YES|uuid||uuid
automation|automation_execution_logs|scheduled_job_id|3||YES|uuid||uuid
automation|automation_execution_logs|automation_type|4||NO|character varying|16|varchar
automation|automation_execution_logs|automation_name|5||NO|character varying|128|varchar
automation|automation_execution_logs|collection_id|6||YES|uuid||uuid
automation|automation_execution_logs|record_id|7||YES|uuid||uuid
automation|automation_execution_logs|trigger_event|8||YES|character varying|32|varchar
automation|automation_execution_logs|trigger_timing|9||YES|character varying|16|varchar
automation|automation_execution_logs|status|10||NO|character varying|16|varchar
automation|automation_execution_logs|skipped_reason|11||YES|text||text
automation|automation_execution_logs|error_message|12||YES|text||text
automation|automation_execution_logs|error_stack|13||YES|text||text
automation|automation_execution_logs|input_data|14||YES|jsonb||jsonb
automation|automation_execution_logs|output_data|15||YES|jsonb||jsonb
automation|automation_execution_logs|actions_executed|16||YES|jsonb||jsonb
automation|automation_execution_logs|triggered_by|17||YES|uuid||uuid
automation|automation_execution_logs|execution_depth|18|1|NO|integer||int4
automation|automation_execution_logs|duration_ms|19||YES|integer||int4
automation|automation_execution_logs|created_at|20|now()|NO|timestamp with time zone||timestamptz
automation|automation_rule_revisions|id|1|uuid_generate_v4()|NO|uuid||uuid
automation|automation_rule_revisions|automation_rule_id|2||NO|uuid||uuid
automation|automation_rule_revisions|revision|3||NO|integer||int4
automation|automation_rule_revisions|status|4||NO|character varying|20|varchar
automation|automation_rule_revisions|payload|5|'{}'::jsonb|NO|jsonb||jsonb
automation|automation_rule_revisions|created_by|6||YES|uuid||uuid
automation|automation_rule_revisions|published_by|7||YES|uuid||uuid
automation|automation_rule_revisions|published_at|8||YES|timestamp with time zone||timestamptz
automation|automation_rule_revisions|created_at|9|now()|NO|timestamp with time zone||timestamptz
automation|automation_rules|id|1|uuid_generate_v4()|NO|uuid||uuid
automation|automation_rules|name|2||NO|character varying|128|varchar
automation|automation_rules|description|3||YES|text||text
automation|automation_rules|collection_id|4||NO|uuid||uuid
automation|automation_rules|trigger_timing|5||NO|character varying|16|varchar
automation|automation_rules|trigger_operations|6|'["insert", "update"]'::jsonb|NO|jsonb||jsonb
automation|automation_rules|watch_properties|7||YES|jsonb||jsonb
automation|automation_rules|condition_type|8|'always'::character varying|NO|character varying|16|varchar
automation|automation_rules|condition|9||YES|jsonb||jsonb
automation|automation_rules|condition_script|10||YES|text||text
automation|automation_rules|action_type|11|'no_code'::character varying|NO|character varying|16|varchar
automation|automation_rules|actions|12||YES|jsonb||jsonb
automation|automation_rules|script|13||YES|text||text
automation|automation_rules|abort_on_error|14|false|NO|boolean||bool
automation|automation_rules|execution_order|15|100|NO|integer||int4
automation|automation_rules|is_active|16|true|NO|boolean||bool
automation|automation_rules|is_system|17|false|NO|boolean||bool
automation|automation_rules|consecutive_errors|18|0|NO|integer||int4
automation|automation_rules|last_executed_at|19||YES|timestamp with time zone||timestamptz
automation|automation_rules|metadata|20|'{}'::jsonb|NO|jsonb||jsonb
automation|automation_rules|created_by|21||YES|uuid||uuid
automation|automation_rules|updated_by|22||YES|uuid||uuid
automation|automation_rules|created_at|23|now()|NO|timestamp with time zone||timestamptz
automation|automation_rules|updated_at|24|now()|NO|timestamp with time zone||timestamptz
automation|automation_rules|application_id|25||NO|uuid||uuid
automation|automation_rules|status|26|'draft'::character varying|NO|character varying|20|varchar
automation|automation_rules|current_revision_id|27||YES|uuid||uuid
automation|automation_rules|published_at|28||YES|timestamp with time zone||timestamptz
automation|automation_rules|source|29|'custom'::character varying|NO|character varying|120|varchar
automation|business_hours|id|1|gen_random_uuid()|NO|uuid||uuid
automation|business_hours|name|2||NO|character varying|255|varchar
automation|business_hours|code|3||NO|character varying|100|varchar
automation|business_hours|description|4||YES|text||text
automation|business_hours|timezone|5|'UTC'::character varying|NO|character varying|50|varchar
automation|business_hours|schedule|6|'{"friday": {"end": "17:00", "start": "09:00"}, "monday": {"end": "17:00", "start": "09:00"}, "tuesday": {"end": "17:00", "start": "09:00"}, "thursday": {"end": "17:00", "start": "09:00"}, "wednesday": {"end": "17:00", "start": "09:00"}}'::jsonb|NO|jsonb||jsonb
automation|business_hours|holidays|7|'[]'::jsonb|YES|jsonb||jsonb
automation|business_hours|is_default|8|false|YES|boolean||bool
automation|business_hours|is_active|9|true|YES|boolean||bool
automation|business_hours|created_by|10||YES|uuid||uuid
automation|business_hours|created_at|11|now()|YES|timestamp with time zone||timestamptz
automation|business_hours|updated_by|12||YES|uuid||uuid
automation|business_hours|updated_at|13|now()|YES|timestamp with time zone||timestamptz
automation|client_scripts|id|1|uuid_generate_v4()|NO|uuid||uuid
automation|client_scripts|name|2||NO|character varying|128|varchar
automation|client_scripts|description|3||YES|text||text
automation|client_scripts|collection_id|4||NO|uuid||uuid
automation|client_scripts|form_id|5||YES|uuid||uuid
automation|client_scripts|trigger|6||NO|character varying|16|varchar
automation|client_scripts|watch_property|7||YES|character varying|64|varchar
automation|client_scripts|condition_type|8|'always'::character varying|NO|character varying|16|varchar
automation|client_scripts|condition|9||YES|jsonb||jsonb
automation|client_scripts|actions|10||NO|jsonb||jsonb
automation|client_scripts|execution_order|11|100|NO|integer||int4
automation|client_scripts|is_active|12|true|NO|boolean||bool
automation|client_scripts|metadata|13|'{}'::jsonb|NO|jsonb||jsonb
automation|client_scripts|created_by|14||YES|uuid||uuid
automation|client_scripts|created_at|15|now()|NO|timestamp with time zone||timestamptz
automation|client_scripts|updated_at|16|now()|NO|timestamp with time zone||timestamptz
automation|connectors|id|1|gen_random_uuid()|NO|uuid||uuid
automation|connectors|code|2||NO|character varying|120|varchar
automation|connectors|name|3||NO|character varying|255|varchar
automation|connectors|description|4||YES|text||text
automation|connectors|kind|5||NO|character varying|20|varchar
automation|connectors|config|6|'{}'::jsonb|NO|jsonb||jsonb
automation|connectors|credential_ref|7||YES|character varying|255|varchar
automation|connectors|status|8|'active'::character varying|NO|character varying|20|varchar
automation|connectors|created_by|9||YES|uuid||uuid
automation|connectors|updated_by|10||YES|uuid||uuid
automation|connectors|created_at|11|now()|NO|timestamp with time zone||timestamptz
automation|connectors|updated_at|12|now()|NO|timestamp with time zone||timestamptz
automation|connectors|source|13|'custom'::character varying|NO|character varying|120|varchar
automation|cross_domain_read_diff|id|1|gen_random_uuid()|NO|uuid||uuid
automation|cross_domain_read_diff|caller_service|2||NO|character varying|80|varchar
automation|cross_domain_read_diff|callsite|3||NO|character varying|200|varchar
automation|cross_domain_read_diff|lookup_key|4||NO|character varying|500|varchar
automation|cross_domain_read_diff|diff_kind|5||NO|character varying|50|varchar
automation|cross_domain_read_diff|delta|6||YES|jsonb||jsonb
automation|cross_domain_read_diff|http_error|7||YES|text||text
automation|cross_domain_read_diff|detected_at|8|now()|NO|timestamp with time zone||timestamptz
automation|decision_inputs|id|1|gen_random_uuid()|NO|uuid||uuid
automation|decision_inputs|table_id|2||NO|uuid||uuid
automation|decision_inputs|name|3||NO|character varying|120|varchar
automation|decision_inputs|input_type|4||NO|character varying|20|varchar
automation|decision_inputs|config|5||YES|jsonb||jsonb
automation|decision_inputs|default_value|6||YES|jsonb||jsonb
automation|decision_inputs|position|7||NO|integer||int4
automation|decision_inputs|created_at|8|now()|NO|timestamp with time zone||timestamptz
automation|decision_rows|id|1|gen_random_uuid()|NO|uuid||uuid
automation|decision_rows|table_id|2||NO|uuid||uuid
automation|decision_rows|position|3||NO|integer||int4
automation|decision_rows|conditions|4|'[]'::jsonb|NO|jsonb||jsonb
automation|decision_rows|answer_record_id|5||YES|uuid||uuid
automation|decision_rows|answer_literal|6||YES|jsonb||jsonb
automation|decision_rows|description|7||YES|text||text
automation|decision_rows|is_active|8|true|NO|boolean||bool
automation|decision_rows|created_at|9|now()|NO|timestamp with time zone||timestamptz
automation|decision_table_revisions|id|1|gen_random_uuid()|NO|uuid||uuid
automation|decision_table_revisions|table_id|2||NO|uuid||uuid
automation|decision_table_revisions|revision|3||NO|integer||int4
automation|decision_table_revisions|status|4||NO|character varying|20|varchar
automation|decision_table_revisions|payload|5|'{}'::jsonb|NO|jsonb||jsonb
automation|decision_table_revisions|created_by|6||YES|uuid||uuid
automation|decision_table_revisions|published_by|7||YES|uuid||uuid
automation|decision_table_revisions|published_at|8||YES|timestamp with time zone||timestamptz
automation|decision_table_revisions|created_at|9|now()|NO|timestamp with time zone||timestamptz
automation|decision_tables|id|1|gen_random_uuid()|NO|uuid||uuid
automation|decision_tables|code|2||NO|character varying|120|varchar
automation|decision_tables|name|3||NO|character varying|255|varchar
automation|decision_tables|description|4||YES|text||text
automation|decision_tables|collection_id|5||NO|uuid||uuid
automation|decision_tables|application_id|6||NO|uuid||uuid
automation|decision_tables|answer_collection_code|7||YES|character varying|120|varchar
automation|decision_tables|hit_policy|8|'first_match'::character varying|NO|character varying|20|varchar
automation|decision_tables|status|9|'draft'::character varying|NO|character varying|20|varchar
automation|decision_tables|is_active|10|true|NO|boolean||bool
automation|decision_tables|current_revision_id|11||YES|uuid||uuid
automation|decision_tables|published_at|12||YES|timestamp with time zone||timestamptz
automation|decision_tables|created_by|13||YES|uuid||uuid
automation|decision_tables|updated_by|14||YES|uuid||uuid
automation|decision_tables|created_at|15|now()|NO|timestamp with time zone||timestamptz
automation|decision_tables|updated_at|16|now()|NO|timestamp with time zone||timestamptz
automation|decision_tables|source|17|'custom'::character varying|NO|character varying|120|varchar
automation|guided_process_activities|id|1|gen_random_uuid()|NO|uuid||uuid
automation|guided_process_activities|stage_id|2||NO|uuid||uuid
automation|guided_process_activities|name|3||NO|character varying|255|varchar
automation|guided_process_activities|description|4||YES|text||text
automation|guided_process_activities|position|5||NO|integer||int4
automation|guided_process_activities|kind|6||NO|character varying|20|varchar
automation|guided_process_activities|process_flow_code|7||YES|character varying|120|varchar
automation|guided_process_activities|required_condition|8||YES|jsonb||jsonb
automation|guided_process_activities|created_at|9|now()|NO|timestamp with time zone||timestamptz
automation|guided_process_revisions|id|1|gen_random_uuid()|NO|uuid||uuid
automation|guided_process_revisions|process_id|2||NO|uuid||uuid
automation|guided_process_revisions|revision|3||NO|integer||int4
automation|guided_process_revisions|status|4||NO|character varying|20|varchar
automation|guided_process_revisions|payload|5|'{}'::jsonb|NO|jsonb||jsonb
automation|guided_process_revisions|created_by|6||YES|uuid||uuid
automation|guided_process_revisions|published_by|7||YES|uuid||uuid
automation|guided_process_revisions|published_at|8||YES|timestamp with time zone||timestamptz
automation|guided_process_revisions|created_at|9|now()|NO|timestamp with time zone||timestamptz
automation|guided_process_stages|id|1|gen_random_uuid()|NO|uuid||uuid
automation|guided_process_stages|process_id|2||NO|uuid||uuid
automation|guided_process_stages|name|3||NO|character varying|255|varchar
automation|guided_process_stages|description|4||YES|text||text
automation|guided_process_stages|position|5||NO|integer||int4
automation|guided_process_stages|visibility_condition|6||YES|jsonb||jsonb
automation|guided_process_stages|created_at|7|now()|NO|timestamp with time zone||timestamptz
automation|guided_processes|id|1|gen_random_uuid()|NO|uuid||uuid
automation|guided_processes|code|2||NO|character varying|120|varchar
automation|guided_processes|name|3||NO|character varying|255|varchar
automation|guided_processes|description|4||YES|text||text
automation|guided_processes|collection_id|5||NO|uuid||uuid
automation|guided_processes|application_id|6||NO|uuid||uuid
automation|guided_processes|status|7|'draft'::character varying|NO|character varying|20|varchar
automation|guided_processes|is_active|8|true|NO|boolean||bool
automation|guided_processes|current_revision_id|9||YES|uuid||uuid
automation|guided_processes|published_at|10||YES|timestamp with time zone||timestamptz
automation|guided_processes|created_by|11||YES|uuid||uuid
automation|guided_processes|updated_by|12||YES|uuid||uuid
automation|guided_processes|created_at|13|now()|NO|timestamp with time zone||timestamptz
automation|guided_processes|updated_at|14|now()|NO|timestamp with time zone||timestamptz
automation|guided_processes|source|15|'custom'::character varying|NO|character varying|120|varchar
automation|process_flow_definition_revisions|id|1|uuid_generate_v4()|NO|uuid||uuid
automation|process_flow_definition_revisions|process_flow_id|2||NO|uuid||uuid
automation|process_flow_definition_revisions|revision|3||NO|integer||int4
automation|process_flow_definition_revisions|status|4||NO|character varying|20|varchar
automation|process_flow_definition_revisions|payload|5|'{}'::jsonb|NO|jsonb||jsonb
automation|process_flow_definition_revisions|created_by|6||YES|uuid||uuid
automation|process_flow_definition_revisions|published_by|7||YES|uuid||uuid
automation|process_flow_definition_revisions|published_at|8||YES|timestamp with time zone||timestamptz
automation|process_flow_definition_revisions|created_at|9|now()|NO|timestamp with time zone||timestamptz
automation|process_flow_definitions|id|1|gen_random_uuid()|NO|uuid||uuid
automation|process_flow_definitions|name|2||NO|character varying|255|varchar
automation|process_flow_definitions|code|3||NO|character varying|100|varchar
automation|process_flow_definitions|description|4||YES|text||text
automation|process_flow_definitions|collection_id|5||YES|uuid||uuid
automation|process_flow_definitions|version|6|1|YES|integer||int4
automation|process_flow_definitions|is_active|7|false|YES|boolean||bool
automation|process_flow_definitions|canvas|8|'{"nodes": [], "connections": []}'::jsonb|NO|jsonb||jsonb
automation|process_flow_definitions|trigger_type|9|'record_created'::character varying|NO|character varying|50|varchar
automation|process_flow_definitions|trigger_conditions|10||YES|jsonb||jsonb
automation|process_flow_definitions|trigger_schedule|11||YES|character varying|100|varchar
automation|process_flow_definitions|trigger_filter|12||YES|jsonb||jsonb
automation|process_flow_definitions|run_as|13|'system'::character varying|YES|character varying|50|varchar
automation|process_flow_definitions|timeout_minutes|14|60|YES|integer||int4
automation|process_flow_definitions|max_retries|15|3|YES|integer||int4
automation|process_flow_definitions|execution_count|16|0|YES|integer||int4
automation|process_flow_definitions|success_count|17|0|YES|integer||int4
automation|process_flow_definitions|failure_count|18|0|YES|integer||int4
automation|process_flow_definitions|last_executed_at|19||YES|timestamp with time zone||timestamptz
automation|process_flow_definitions|created_by|20||YES|uuid||uuid
automation|process_flow_definitions|created_at|21|now()|YES|timestamp with time zone||timestamptz
automation|process_flow_definitions|updated_by|22||YES|uuid||uuid
automation|process_flow_definitions|updated_at|23|now()|YES|timestamp with time zone||timestamptz
automation|process_flow_definitions|application_id|24||NO|uuid||uuid
automation|process_flow_definitions|status|25|'draft'::character varying|NO|character varying|20|varchar
automation|process_flow_definitions|current_revision_id|26||YES|uuid||uuid
automation|process_flow_definitions|published_at|27||YES|timestamp with time zone||timestamptz
automation|process_flow_definitions|source|28|'custom'::character varying|NO|character varying|120|varchar
automation|process_flow_execution_history|id|1|gen_random_uuid()|NO|uuid||uuid
automation|process_flow_execution_history|instance_id|2||YES|uuid||uuid
automation|process_flow_execution_history|node_id|3||NO|character varying|100|varchar
automation|process_flow_execution_history|node_type|4||NO|character varying|50|varchar
automation|process_flow_execution_history|node_name|5||YES|character varying|255|varchar
automation|process_flow_execution_history|action|6||NO|character varying|100|varchar
automation|process_flow_execution_history|status|7||NO|character varying|50|varchar
automation|process_flow_execution_history|input_data|8||YES|jsonb||jsonb
automation|process_flow_execution_history|output_data|9||YES|jsonb||jsonb
automation|process_flow_execution_history|error_message|10||YES|text||text
automation|process_flow_execution_history|error_stack|11||YES|text||text
automation|process_flow_execution_history|execution_time_ms|12||YES|integer||int4
automation|process_flow_execution_history|created_at|13|now()|YES|timestamp with time zone||timestamptz
automation|process_flow_instances|id|1|gen_random_uuid()|NO|uuid||uuid
automation|process_flow_instances|process_flow_id|2||YES|uuid||uuid
automation|process_flow_instances|record_id|3||NO|uuid||uuid
automation|process_flow_instances|collection_id|4||YES|uuid||uuid
automation|process_flow_instances|state|5|'running'::character varying|YES|character varying|50|varchar
automation|process_flow_instances|current_node_id|6||YES|character varying|100|varchar
automation|process_flow_instances|context|7|'{}'::jsonb|YES|jsonb||jsonb
automation|process_flow_instances|error_message|8||YES|text||text
automation|process_flow_instances|error_stack|9||YES|text||text
automation|process_flow_instances|retry_count|10|0|YES|integer||int4
automation|process_flow_instances|started_by|11||YES|uuid||uuid
automation|process_flow_instances|started_at|12|now()|YES|timestamp with time zone||timestamptz
automation|process_flow_instances|completed_at|13||YES|timestamp with time zone||timestamptz
automation|process_flow_instances|duration_ms|14||YES|integer||int4
automation|process_flow_instances|created_at|15|now()|YES|timestamp with time zone||timestamptz
automation|process_flow_instances|updated_at|16|now()|YES|timestamp with time zone||timestamptz
automation|scheduled_jobs|id|1|uuid_generate_v4()|NO|uuid||uuid
automation|scheduled_jobs|name|2||NO|character varying|128|varchar
automation|scheduled_jobs|description|3||YES|text||text
automation|scheduled_jobs|collection_id|4||YES|uuid||uuid
automation|scheduled_jobs|frequency|5|'daily'::character varying|NO|character varying|16|varchar
automation|scheduled_jobs|cron_expression|6||YES|character varying|64|varchar
automation|scheduled_jobs|timezone|7|'UTC'::character varying|NO|character varying|64|varchar
automation|scheduled_jobs|action_type|8|'no_code'::character varying|NO|character varying|16|varchar
automation|scheduled_jobs|actions|9||YES|jsonb||jsonb
automation|scheduled_jobs|script|10||YES|text||text
automation|scheduled_jobs|query_filter|11||YES|jsonb||jsonb
automation|scheduled_jobs|is_active|12|true|NO|boolean||bool
automation|scheduled_jobs|next_run_at|13||YES|timestamp with time zone||timestamptz
automation|scheduled_jobs|last_run_at|14||YES|timestamp with time zone||timestamptz
automation|scheduled_jobs|last_run_status|15||YES|character varying|16|varchar
automation|scheduled_jobs|consecutive_failures|16|0|NO|integer||int4
automation|scheduled_jobs|max_retries|17|3|NO|integer||int4
automation|scheduled_jobs|metadata|18|'{}'::jsonb|NO|jsonb||jsonb
automation|scheduled_jobs|created_by|19||YES|uuid||uuid
automation|scheduled_jobs|updated_by|20||YES|uuid||uuid
automation|scheduled_jobs|created_at|21|now()|NO|timestamp with time zone||timestamptz
automation|scheduled_jobs|updated_at|22|now()|NO|timestamp with time zone||timestamptz
automation|sla_breaches|id|1|gen_random_uuid()|NO|uuid||uuid
automation|sla_breaches|sla_instance_id|2||YES|uuid||uuid
automation|sla_breaches|sla_definition_id|3||YES|uuid||uuid
automation|sla_breaches|record_id|4||NO|uuid||uuid
automation|sla_breaches|collection_id|5||YES|uuid||uuid
automation|sla_breaches|target_seconds|6||NO|integer||int4
automation|sla_breaches|elapsed_seconds|7||NO|integer||int4
automation|sla_breaches|breach_amount_seconds|8||NO|integer||int4
automation|sla_breaches|resolved_at|9||YES|timestamp with time zone||timestamptz
automation|sla_breaches|resolution_notes|10||YES|text||text
automation|sla_breaches|created_at|11|now()|YES|timestamp with time zone||timestamptz
automation|sla_definitions|id|1|gen_random_uuid()|NO|uuid||uuid
automation|sla_definitions|name|2||NO|character varying|255|varchar
automation|sla_definitions|code|3||NO|character varying|100|varchar
automation|sla_definitions|description|4||YES|text||text
automation|sla_definitions|collection_id|5||YES|uuid||uuid
automation|sla_definitions|sla_type|6|'resolution'::character varying|NO|character varying|50|varchar
automation|sla_definitions|target_minutes|7||NO|integer||int4
automation|sla_definitions|warning_threshold_1|8|75|YES|integer||int4
automation|sla_definitions|warning_threshold_2|9|90|YES|integer||int4
automation|sla_definitions|business_hours_id|10||YES|uuid||uuid
automation|sla_definitions|conditions|11||YES|jsonb||jsonb
automation|sla_definitions|pause_conditions|12||YES|jsonb||jsonb
automation|sla_definitions|escalations|13|'[]'::jsonb|YES|jsonb||jsonb
automation|sla_definitions|priority|14|100|YES|integer||int4
automation|sla_definitions|is_active|15|true|YES|boolean||bool
automation|sla_definitions|created_by|16||YES|uuid||uuid
automation|sla_definitions|created_at|17|now()|YES|timestamp with time zone||timestamptz
automation|sla_definitions|updated_by|18||YES|uuid||uuid
automation|sla_definitions|updated_at|19|now()|YES|timestamp with time zone||timestamptz
automation|sla_instances|id|1|gen_random_uuid()|NO|uuid||uuid
automation|sla_instances|sla_definition_id|2||YES|uuid||uuid
automation|sla_instances|record_id|3||NO|uuid||uuid
automation|sla_instances|collection_id|4||YES|uuid||uuid
automation|sla_instances|state|5|'active'::character varying|YES|character varying|50|varchar
automation|sla_instances|elapsed_seconds|6|0|YES|integer||int4
automation|sla_instances|remaining_seconds|7||NO|integer||int4
automation|sla_instances|target_seconds|8||NO|integer||int4
automation|sla_instances|start_time|9||NO|timestamp with time zone||timestamptz
automation|sla_instances|pause_time|10||YES|timestamp with time zone||timestamptz
automation|sla_instances|complete_time|11||YES|timestamp with time zone||timestamptz
automation|sla_instances|breach_time|12||YES|timestamp with time zone||timestamptz
automation|sla_instances|target_time|13||NO|timestamp with time zone||timestamptz
automation|sla_instances|total_pause_seconds|14|0|YES|integer||int4
automation|sla_instances|pause_count|15|0|YES|integer||int4
automation|sla_instances|warning_1_sent|16|false|YES|boolean||bool
automation|sla_instances|warning_1_sent_at|17||YES|timestamp with time zone||timestamptz
automation|sla_instances|warning_2_sent|18|false|YES|boolean||bool
automation|sla_instances|warning_2_sent_at|19||YES|timestamp with time zone||timestamptz
automation|sla_instances|created_at|20|now()|YES|timestamp with time zone||timestamptz
automation|sla_instances|updated_at|21|now()|YES|timestamp with time zone||timestamptz
automation|state_change_history|id|1|gen_random_uuid()|NO|uuid||uuid
automation|state_change_history|record_id|2||NO|uuid||uuid
automation|state_change_history|collection_id|3||YES|uuid||uuid
automation|state_change_history|state_machine_id|4||YES|uuid||uuid
automation|state_change_history|from_state|5||YES|character varying|100|varchar
automation|state_change_history|to_state|6||NO|character varying|100|varchar
automation|state_change_history|transition_name|7||YES|character varying|100|varchar
automation|state_change_history|changed_by|8||YES|uuid||uuid
automation|state_change_history|change_reason|9||YES|text||text
automation|state_change_history|duration_in_state|10||YES|integer||int4
automation|state_change_history|created_at|11|now()|YES|timestamp with time zone||timestamptz
automation|state_machine_definitions|id|1|gen_random_uuid()|NO|uuid||uuid
automation|state_machine_definitions|name|2||NO|character varying|255|varchar
automation|state_machine_definitions|code|3||NO|character varying|100|varchar
automation|state_machine_definitions|description|4||YES|text||text
automation|state_machine_definitions|collection_id|5||YES|uuid||uuid
automation|state_machine_definitions|state_field|6||NO|character varying|100|varchar
automation|state_machine_definitions|states|7|'[]'::jsonb|NO|jsonb||jsonb
automation|state_machine_definitions|transitions|8|'[]'::jsonb|NO|jsonb||jsonb
automation|state_machine_definitions|is_active|9|true|YES|boolean||bool
automation|state_machine_definitions|created_by|10||YES|uuid||uuid
automation|state_machine_definitions|created_at|11|now()|YES|timestamp with time zone||timestamptz
automation|state_machine_definitions|updated_by|12||YES|uuid||uuid
automation|state_machine_definitions|updated_at|13|now()|YES|timestamp with time zone||timestamptz
ava|ava_anomalies|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_anomalies|anomaly_type|2||NO|character varying|100|varchar
ava|ava_anomalies|severity|3||NO|character varying|20|varchar
ava|ava_anomalies|description|4||NO|text||text
ava|ava_anomalies|affected_entity|5||YES|character varying|255|varchar
ava|ava_anomalies|affected_entity_id|6||YES|uuid||uuid
ava|ava_anomalies|metric_value|7||YES|numeric||numeric
ava|ava_anomalies|expected_value|8||YES|numeric||numeric
ava|ava_anomalies|deviation_percentage|9||YES|numeric||numeric
ava|ava_anomalies|confidence|10||YES|numeric||numeric
ava|ava_anomalies|recommended_actions|11||YES|jsonb||jsonb
ava|ava_anomalies|is_resolved|12|false|NO|boolean||bool
ava|ava_anomalies|resolved_by|13||YES|uuid||uuid
ava|ava_anomalies|resolution_notes|14||YES|text||text
ava|ava_anomalies|detected_at|15||NO|timestamp with time zone||timestamptz
ava|ava_anomalies|resolved_at|16||YES|timestamp with time zone||timestamptz
ava|ava_anomalies|created_at|17|now()|NO|timestamp with time zone||timestamptz
ava|ava_audit_trail|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_audit_trail|user_id|2||NO|uuid||uuid
ava|ava_audit_trail|user_name|3||YES|character varying||varchar
ava|ava_audit_trail|user_role|4||YES|character varying||varchar
ava|ava_audit_trail|conversation_id|5||YES|uuid||uuid
ava|ava_audit_trail|user_message|6||YES|text||text
ava|ava_audit_trail|ava_response|7||YES|text||text
ava|ava_audit_trail|action_type|8||NO|character varying|50|varchar
ava|ava_audit_trail|status|9|'pending'::character varying|NO|character varying|50|varchar
ava|ava_audit_trail|action_label|10||YES|character varying||varchar
ava|ava_audit_trail|action_target|11||YES|character varying||varchar
ava|ava_audit_trail|target_collection|12||YES|character varying||varchar
ava|ava_audit_trail|target_record_id|13||YES|uuid||uuid
ava|ava_audit_trail|target_display_value|14||YES|character varying||varchar
ava|ava_audit_trail|before_data|15||YES|jsonb||jsonb
ava|ava_audit_trail|after_data|16||YES|jsonb||jsonb
ava|ava_audit_trail|action_params|17||YES|jsonb||jsonb
ava|ava_audit_trail|is_revertible|18|false|NO|boolean||bool
ava|ava_audit_trail|ip_address|19||YES|character varying||varchar
ava|ava_audit_trail|user_agent|20||YES|text||text
ava|ava_audit_trail|session_id|21||YES|uuid||uuid
ava|ava_audit_trail|error_message|22||YES|text||text
ava|ava_audit_trail|error_code|23||YES|character varying||varchar
ava|ava_audit_trail|duration_ms|24||YES|integer||int4
ava|ava_audit_trail|completed_at|25||YES|timestamp with time zone||timestamptz
ava|ava_audit_trail|reverted_at|26||YES|timestamp with time zone||timestamptz
ava|ava_audit_trail|reverted_by|27||YES|uuid||uuid
ava|ava_audit_trail|revert_reason|28||YES|text||text
ava|ava_audit_trail|created_at|29|now()|NO|timestamp with time zone||timestamptz
ava|ava_audit_trail|suggested_actions|30||YES|jsonb||jsonb
ava|ava_audit_trail|preview_payload|31||YES|jsonb||jsonb
ava|ava_audit_trail|approval_payload|32||YES|jsonb||jsonb
ava|ava_audit_trail|execution_payload|33||YES|jsonb||jsonb
ava|ava_cards|id|1|gen_random_uuid()|NO|uuid||uuid
ava|ava_cards|code|2||NO|character varying|120|varchar
ava|ava_cards|name|3||NO|character varying|255|varchar
ava|ava_cards|description|4||YES|text||text
ava|ava_cards|layout|5|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_cards|action_bindings|6|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_cards|metadata|7|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_cards|is_active|8|true|YES|boolean||bool
ava|ava_cards|created_by|9||YES|uuid||uuid
ava|ava_cards|updated_by|10||YES|uuid||uuid
ava|ava_cards|created_at|11|now()|YES|timestamp with time zone||timestamptz
ava|ava_cards|updated_at|12|now()|YES|timestamp with time zone||timestamptz
ava|ava_contexts|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_contexts|user_id|2||NO|uuid||uuid
ava|ava_contexts|conversation_id|3||YES|uuid||uuid
ava|ava_contexts|context_type|4||NO|character varying|50|varchar
ava|ava_contexts|context_key|5||NO|character varying|100|varchar
ava|ava_contexts|context_value|6||NO|jsonb||jsonb
ava|ava_contexts|expires_at|7||YES|timestamp with time zone||timestamptz
ava|ava_contexts|created_at|8|now()|NO|timestamp with time zone||timestamptz
ava|ava_contexts|updated_at|9|now()|NO|timestamp with time zone||timestamptz
ava|ava_conversations|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_conversations|user_id|2||NO|uuid||uuid
ava|ava_conversations|status|3|'active'::character varying|NO|character varying|50|varchar
ava|ava_conversations|title|4||YES|text||text
ava|ava_conversations|message_count|5|0|NO|integer||int4
ava|ava_conversations|last_activity_at|6||YES|timestamp with time zone||timestamptz
ava|ava_conversations|context_summary|7||YES|text||text
ava|ava_conversations|session_metadata|8||YES|jsonb||jsonb
ava|ava_conversations|escalated_to|9||YES|uuid||uuid
ava|ava_conversations|escalation_reason|10||YES|text||text
ava|ava_conversations|created_at|11|now()|NO|timestamp with time zone||timestamptz
ava|ava_conversations|updated_at|12|now()|NO|timestamp with time zone||timestamptz
ava|ava_conversations|organization_id|13||YES|character varying|128|varchar
ava|ava_feedback|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_feedback|user_id|2||NO|uuid||uuid
ava|ava_feedback|message_id|3||YES|uuid||uuid
ava|ava_feedback|suggestion_id|4||YES|uuid||uuid
ava|ava_feedback|feedback_type|5||NO|character varying|50|varchar
ava|ava_feedback|rating|6||YES|integer||int4
ava|ava_feedback|comment|7||YES|text||text
ava|ava_feedback|expected_response|8||YES|text||text
ava|ava_feedback|is_processed|9|false|NO|boolean||bool
ava|ava_feedback|created_at|10|now()|NO|timestamp with time zone||timestamptz
ava|ava_global_settings|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_global_settings|ava_enabled|2|true|NO|boolean||bool
ava|ava_global_settings|read_only_mode|3|false|NO|boolean||bool
ava|ava_global_settings|allow_create_actions|4|true|NO|boolean||bool
ava|ava_global_settings|allow_update_actions|5|true|NO|boolean||bool
ava|ava_global_settings|allow_delete_actions|6|false|NO|boolean||bool
ava|ava_global_settings|allow_execute_actions|7|true|NO|boolean||bool
ava|ava_global_settings|default_requires_confirmation|8|true|NO|boolean||bool
ava|ava_global_settings|system_read_only_collections|9|'[]'::jsonb|NO|jsonb||jsonb
ava|ava_global_settings|user_rate_limit_per_hour|10|100|NO|integer||int4
ava|ava_global_settings|global_rate_limit_per_hour|11|10000|NO|integer||int4
ava|ava_global_settings|updated_by|12||YES|uuid||uuid
ava|ava_global_settings|updated_at|13|now()|NO|timestamp with time zone||timestamptz
ava|ava_intents|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_intents|message_id|2||NO|uuid||uuid
ava|ava_intents|category|3||NO|character varying|50|varchar
ava|ava_intents|intent_name|4||NO|character varying|100|varchar
ava|ava_intents|confidence|5||NO|numeric||numeric
ava|ava_intents|detected_entities|6||YES|jsonb||jsonb
ava|ava_intents|required_permissions|7||YES|jsonb||jsonb
ava|ava_intents|is_clarification_needed|8|false|NO|boolean||bool
ava|ava_intents|clarification_question|9||YES|text||text
ava|ava_intents|created_at|10|now()|NO|timestamp with time zone||timestamptz
ava|ava_knowledge_embeddings|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_knowledge_embeddings|source_type|2||NO|character varying|50|varchar
ava|ava_knowledge_embeddings|source_id|3||NO|uuid||uuid
ava|ava_knowledge_embeddings|content_hash|4||NO|character varying|64|varchar
ava|ava_knowledge_embeddings|content|5||NO|text||text
ava|ava_knowledge_embeddings|embedding|6||NO|jsonb||jsonb
ava|ava_knowledge_embeddings|embedding_model|7||NO|character varying|100|varchar
ava|ava_knowledge_embeddings|metadata|8||YES|jsonb||jsonb
ava|ava_knowledge_embeddings|created_at|9|now()|NO|timestamp with time zone||timestamptz
ava|ava_knowledge_embeddings|updated_at|10|now()|NO|timestamp with time zone||timestamptz
ava|ava_messages|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_messages|conversation_id|2||NO|uuid||uuid
ava|ava_messages|role|3||NO|character varying|20|varchar
ava|ava_messages|content|4||NO|text||text
ava|ava_messages|intent_id|5||YES|uuid||uuid
ava|ava_messages|detected_entities|6||YES|jsonb||jsonb
ava|ava_messages|sentiment_score|7||YES|numeric||numeric
ava|ava_messages|tool_calls|8||YES|jsonb||jsonb
ava|ava_messages|token_count|9||YES|integer||int4
ava|ava_messages|response_time_ms|10||YES|integer||int4
ava|ava_messages|model_used|11||YES|character varying|100|varchar
ava|ava_messages|created_at|12|now()|NO|timestamp with time zone||timestamptz
ava|ava_permission_configs|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_permission_configs|collection_code|2||YES|character varying||varchar
ava|ava_permission_configs|action_type|3||NO|character varying|50|varchar
ava|ava_permission_configs|is_enabled|4|true|NO|boolean||bool
ava|ava_permission_configs|requires_confirmation|5|true|NO|boolean||bool
ava|ava_permission_configs|allowed_roles|6|'[]'::jsonb|NO|jsonb||jsonb
ava|ava_permission_configs|excluded_roles|7|'[]'::jsonb|NO|jsonb||jsonb
ava|ava_permission_configs|created_by|8||YES|uuid||uuid
ava|ava_permission_configs|updated_by|9||YES|uuid||uuid
ava|ava_permission_configs|created_at|10|now()|NO|timestamp with time zone||timestamptz
ava|ava_permission_configs|updated_at|11|now()|NO|timestamp with time zone||timestamptz
ava|ava_predictions|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_predictions|prediction_type|2||NO|character varying|50|varchar
ava|ava_predictions|target_date|3||NO|date||date
ava|ava_predictions|prediction_value|4||NO|jsonb||jsonb
ava|ava_predictions|confidence|5||YES|numeric||numeric
ava|ava_predictions|model_version|6||YES|character varying|100|varchar
ava|ava_predictions|input_features|7||YES|jsonb||jsonb
ava|ava_predictions|is_active|8|true|NO|boolean||bool
ava|ava_predictions|actual_value|9||YES|jsonb||jsonb
ava|ava_predictions|accuracy|10||YES|numeric||numeric
ava|ava_predictions|created_at|11|now()|NO|timestamp with time zone||timestamptz
ava|ava_predictions|verified_at|12||YES|timestamp with time zone||timestamptz
ava|ava_prompt_policies|id|1|gen_random_uuid()|NO|uuid||uuid
ava|ava_prompt_policies|code|2||NO|character varying|120|varchar
ava|ava_prompt_policies|name|3||NO|character varying|255|varchar
ava|ava_prompt_policies|description|4||YES|text||text
ava|ava_prompt_policies|policy|5|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_prompt_policies|metadata|6|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_prompt_policies|is_active|7|true|YES|boolean||bool
ava|ava_prompt_policies|created_by|8||YES|uuid||uuid
ava|ava_prompt_policies|updated_by|9||YES|uuid||uuid
ava|ava_prompt_policies|created_at|10|now()|YES|timestamp with time zone||timestamptz
ava|ava_prompt_policies|updated_at|11|now()|YES|timestamp with time zone||timestamptz
ava|ava_proposal|id|1|gen_random_uuid()|NO|uuid||uuid
ava|ava_proposal|kind|2||NO|character varying|100|varchar
ava|ava_proposal|payload|3||NO|jsonb||jsonb
ava|ava_proposal|rationale|4||YES|text||text
ava|ava_proposal|state|5||NO|USER-DEFINED||ava_proposal_state_enum
ava|ava_proposal|actor_id|6||YES|uuid||uuid
ava|ava_proposal|preview_result|7||YES|jsonb||jsonb
ava|ava_proposal|execution_result|8||YES|jsonb||jsonb
ava|ava_proposal|rejection_reason|9||YES|text||text
ava|ava_proposal|created_at|10|now()|NO|timestamp with time zone||timestamptz
ava|ava_proposal|updated_at|11|now()|NO|timestamp with time zone||timestamptz
ava|ava_suggestions|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_suggestions|user_id|2||NO|uuid||uuid
ava|ava_suggestions|conversation_id|3||YES|uuid||uuid
ava|ava_suggestions|suggestion_type|4||NO|character varying|50|varchar
ava|ava_suggestions|target_entity|5||YES|character varying|255|varchar
ava|ava_suggestions|target_field|6||YES|character varying|255|varchar
ava|ava_suggestions|suggested_value|7||NO|jsonb||jsonb
ava|ava_suggestions|explanation|8||YES|text||text
ava|ava_suggestions|confidence|9||YES|numeric||numeric
ava|ava_suggestions|is_accepted|10||YES|boolean||bool
ava|ava_suggestions|user_feedback|11||YES|text||text
ava|ava_suggestions|response_time_ms|12||YES|integer||int4
ava|ava_suggestions|created_at|13|now()|NO|timestamp with time zone||timestamptz
ava|ava_suggestions|responded_at|14||YES|timestamp with time zone||timestamptz
ava|ava_tools|id|1|gen_random_uuid()|NO|uuid||uuid
ava|ava_tools|code|2||NO|character varying|120|varchar
ava|ava_tools|name|3||NO|character varying|255|varchar
ava|ava_tools|description|4||YES|text||text
ava|ava_tools|input_schema|5|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_tools|output_schema|6|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_tools|permission_requirements|7|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_tools|approval_policy|8|'always'::character varying|YES|character varying|30|varchar
ava|ava_tools|metadata|9|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_tools|is_active|10|true|YES|boolean||bool
ava|ava_tools|created_by|11||YES|uuid||uuid
ava|ava_tools|updated_by|12||YES|uuid||uuid
ava|ava_tools|created_at|13|now()|YES|timestamp with time zone||timestamptz
ava|ava_tools|updated_at|14|now()|YES|timestamp with time zone||timestamptz
ava|ava_topics|id|1|gen_random_uuid()|NO|uuid||uuid
ava|ava_topics|code|2||NO|character varying|120|varchar
ava|ava_topics|name|3||NO|character varying|255|varchar
ava|ava_topics|description|4||YES|text||text
ava|ava_topics|routing_rules|5|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_topics|response_formats|6|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_topics|metadata|7|'{}'::jsonb|YES|jsonb||jsonb
ava|ava_topics|is_active|8|true|YES|boolean||bool
ava|ava_topics|created_by|9||YES|uuid||uuid
ava|ava_topics|updated_by|10||YES|uuid||uuid
ava|ava_topics|created_at|11|now()|YES|timestamp with time zone||timestamptz
ava|ava_topics|updated_at|12|now()|YES|timestamp with time zone||timestamptz
ava|ava_usage_metrics|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|ava_usage_metrics|user_id|2||YES|uuid||uuid
ava|ava_usage_metrics|metric_date|3||NO|date||date
ava|ava_usage_metrics|metric_type|4||NO|character varying|100|varchar
ava|ava_usage_metrics|metric_value|5||NO|numeric||numeric
ava|ava_usage_metrics|dimensions|6||YES|jsonb||jsonb
ava|ava_usage_metrics|created_at|7|now()|NO|timestamp with time zone||timestamptz
ava|dataset_definitions|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|dataset_definitions|code|2||NO|character varying|120|varchar
ava|dataset_definitions|name|3||NO|character varying|255|varchar
ava|dataset_definitions|description|4||YES|text||text
ava|dataset_definitions|source_collection_code|5||NO|character varying|120|varchar
ava|dataset_definitions|filter|6|'{}'::jsonb|NO|jsonb||jsonb
ava|dataset_definitions|label_mapping|7|'{}'::jsonb|NO|jsonb||jsonb
ava|dataset_definitions|feature_mapping|8|'{}'::jsonb|NO|jsonb||jsonb
ava|dataset_definitions|status|9|'draft'::character varying|NO|character varying|20|varchar
ava|dataset_definitions|version|10|1|NO|integer||int4
ava|dataset_definitions|metadata|11|'{}'::jsonb|NO|jsonb||jsonb
ava|dataset_definitions|is_active|12|true|NO|boolean||bool
ava|dataset_definitions|created_by|13||YES|uuid||uuid
ava|dataset_definitions|updated_by|14||YES|uuid||uuid
ava|dataset_definitions|created_at|15|now()|NO|timestamp with time zone||timestamptz
ava|dataset_definitions|updated_at|16|now()|NO|timestamp with time zone||timestamptz
ava|dataset_snapshots|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|dataset_snapshots|dataset_definition_id|2||YES|uuid||uuid
ava|dataset_snapshots|status|3|'pending'::character varying|NO|character varying|20|varchar
ava|dataset_snapshots|snapshot_uri|4||YES|text||text
ava|dataset_snapshots|row_count|5||YES|integer||int4
ava|dataset_snapshots|checksum|6||YES|character varying|64|varchar
ava|dataset_snapshots|metadata|7|'{}'::jsonb|NO|jsonb||jsonb
ava|dataset_snapshots|requested_by|8||YES|uuid||uuid
ava|dataset_snapshots|started_at|9||YES|timestamp with time zone||timestamptz
ava|dataset_snapshots|completed_at|10||YES|timestamp with time zone||timestamptz
ava|dataset_snapshots|error_message|11||YES|text||text
ava|dataset_snapshots|created_at|12|now()|NO|timestamp with time zone||timestamptz
ava|dataset_snapshots|updated_at|13|now()|NO|timestamp with time zone||timestamptz
ava|model_artifacts|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|model_artifacts|code|2||NO|character varying|120|varchar
ava|model_artifacts|name|3||NO|character varying|255|varchar
ava|model_artifacts|version|4||NO|character varying|50|varchar
ava|model_artifacts|description|5||YES|text||text
ava|model_artifacts|dataset_snapshot_id|6||YES|uuid||uuid
ava|model_artifacts|artifact_bucket|7||NO|character varying|255|varchar
ava|model_artifacts|artifact_key|8||NO|text||text
ava|model_artifacts|content_type|9||YES|character varying|120|varchar
ava|model_artifacts|checksum|10||YES|character varying|64|varchar
ava|model_artifacts|size_bytes|11||YES|bigint||int8
ava|model_artifacts|status|12|'draft'::character varying|NO|character varying|20|varchar
ava|model_artifacts|metadata|13|'{}'::jsonb|NO|jsonb||jsonb
ava|model_artifacts|created_by|14||YES|uuid||uuid
ava|model_artifacts|updated_by|15||YES|uuid||uuid
ava|model_artifacts|created_at|16|now()|NO|timestamp with time zone||timestamptz
ava|model_artifacts|updated_at|17|now()|NO|timestamp with time zone||timestamptz
ava|model_deployments|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|model_deployments|model_artifact_id|2||YES|uuid||uuid
ava|model_deployments|target_type|3||NO|character varying|120|varchar
ava|model_deployments|target_config|4|'{}'::jsonb|NO|jsonb||jsonb
ava|model_deployments|status|5|'pending_approval'::character varying|NO|character varying|20|varchar
ava|model_deployments|requested_by|6||YES|uuid||uuid
ava|model_deployments|approved_by|7||YES|uuid||uuid
ava|model_deployments|workflow_instance_id|8||YES|uuid||uuid
ava|model_deployments|metadata|9|'{}'::jsonb|NO|jsonb||jsonb
ava|model_deployments|created_at|10|now()|NO|timestamp with time zone||timestamptz
ava|model_deployments|updated_at|11|now()|NO|timestamp with time zone||timestamptz
ava|model_evaluations|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|model_evaluations|model_artifact_id|2||YES|uuid||uuid
ava|model_evaluations|dataset_snapshot_id|3||YES|uuid||uuid
ava|model_evaluations|metrics|4|'{}'::jsonb|NO|jsonb||jsonb
ava|model_evaluations|confusion_matrix|5|'{}'::jsonb|NO|jsonb||jsonb
ava|model_evaluations|calibration_stats|6|'{}'::jsonb|NO|jsonb||jsonb
ava|model_evaluations|status|7|'completed'::character varying|NO|character varying|20|varchar
ava|model_evaluations|metadata|8|'{}'::jsonb|NO|jsonb||jsonb
ava|model_evaluations|created_by|9||YES|uuid||uuid
ava|model_evaluations|created_at|10|now()|NO|timestamp with time zone||timestamptz
ava|model_evaluations|updated_at|11|now()|NO|timestamp with time zone||timestamptz
ava|model_training_jobs|id|1|uuid_generate_v4()|NO|uuid||uuid
ava|model_training_jobs|dataset_snapshot_id|2||YES|uuid||uuid
ava|model_training_jobs|model_code|3||NO|character varying|120|varchar
ava|model_training_jobs|model_name|4||NO|character varying|255|varchar
ava|model_training_jobs|model_version|5||NO|character varying|50|varchar
ava|model_training_jobs|algorithm|6||NO|character varying|120|varchar
ava|model_training_jobs|hyperparameters|7|'{}'::jsonb|NO|jsonb||jsonb
ava|model_training_jobs|training_config|8|'{}'::jsonb|NO|jsonb||jsonb
ava|model_training_jobs|metrics|9|'{}'::jsonb|NO|jsonb||jsonb
ava|model_training_jobs|status|10|'pending'::character varying|NO|character varying|20|varchar
ava|model_training_jobs|model_artifact_id|11||YES|uuid||uuid
ava|model_training_jobs|requested_by|12||YES|uuid||uuid
ava|model_training_jobs|started_at|13||YES|timestamp with time zone||timestamptz
ava|model_training_jobs|completed_at|14||YES|timestamp with time zone||timestamptz
ava|model_training_jobs|error_message|15||YES|text||text
ava|model_training_jobs|metadata|16|'{}'::jsonb|NO|jsonb||jsonb
ava|model_training_jobs|created_at|17|now()|NO|timestamp with time zone||timestamptz
ava|model_training_jobs|updated_at|18|now()|NO|timestamp with time zone||timestamptz
identity|auth_events|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|auth_events|user_id|2||YES|uuid||uuid
identity|auth_events|event_type|3||NO|character varying|50|varchar
identity|auth_events|success|4||NO|boolean||bool
identity|auth_events|ip_address|5||YES|character varying|45|varchar
identity|auth_events|user_agent|6||YES|text||text
identity|auth_events|geo_location|7||YES|jsonb||jsonb
identity|auth_events|details|8|'{}'::jsonb|NO|jsonb||jsonb
identity|auth_events|created_at|9|now()|NO|timestamp with time zone||timestamptz
identity|auth_settings|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|auth_settings|password_min_length|2|12|NO|integer||int4
identity|auth_settings|password_require_uppercase|3|true|NO|boolean||bool
identity|auth_settings|password_require_lowercase|4|true|NO|boolean||bool
identity|auth_settings|password_require_numbers|5|true|NO|boolean||bool
identity|auth_settings|password_require_symbols|6|true|NO|boolean||bool
identity|auth_settings|password_history_count|7|12|NO|integer||int4
identity|auth_settings|password_expiry_days|8|90|NO|integer||int4
identity|auth_settings|password_block_common|9|true|NO|boolean||bool
identity|auth_settings|max_failed_attempts|10|5|NO|integer||int4
identity|auth_settings|lockout_duration_minutes|11|30|NO|integer||int4
identity|auth_settings|session_timeout_minutes|12|480|NO|integer||int4
identity|auth_settings|max_concurrent_sessions|13|5|NO|integer||int4
identity|auth_settings|remember_me_duration_days|14|30|NO|integer||int4
identity|auth_settings|mfa_required|15|false|NO|boolean||bool
identity|auth_settings|mfa_grace_period_days|16|7|NO|integer||int4
identity|auth_settings|sso_enabled|17|false|NO|boolean||bool
identity|auth_settings|sso_enforce|18|false|NO|boolean||bool
identity|auth_settings|sso_config|19||YES|jsonb||jsonb
identity|auth_settings|ip_whitelist_enabled|20|false|NO|boolean||bool
identity|auth_settings|ip_whitelist|21|'[]'::jsonb|NO|jsonb||jsonb
identity|auth_settings|allowed_auth_methods|22|'["password", "sso", "ldap"]'::jsonb|NO|jsonb||jsonb
identity|auth_settings|allow_password_reset|23|true|NO|boolean||bool
identity|auth_settings|allow_profile_edit|24|true|NO|boolean||bool
identity|auth_settings|allow_mfa_self_enrollment|25|true|NO|boolean||bool
identity|auth_settings|created_at|26|now()|NO|timestamp with time zone||timestamptz
identity|auth_settings|updated_at|27|now()|NO|timestamp with time zone||timestamptz
identity|behavioral_profiles|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|behavioral_profiles|user_id|2||NO|uuid||uuid
identity|behavioral_profiles|login_hours|3|'{}'::jsonb|YES|jsonb||jsonb
identity|behavioral_profiles|login_days|4|'{}'::jsonb|YES|jsonb||jsonb
identity|behavioral_profiles|known_locations|5|'[]'::jsonb|YES|jsonb||jsonb
identity|behavioral_profiles|known_ip_ranges|6|'[]'::jsonb|YES|jsonb||jsonb
identity|behavioral_profiles|known_devices|7|'[]'::jsonb|YES|jsonb||jsonb
identity|behavioral_profiles|avg_session_duration|8|30|YES|integer||int4
identity|behavioral_profiles|avg_actions_per_session|9|10|YES|integer||int4
identity|behavioral_profiles|last_updated_at|10|now()|NO|timestamp with time zone||timestamptz
identity|behavioral_profiles|data_points|11|0|YES|integer||int4
identity|behavioral_profiles|confidence_score|12|0|YES|integer||int4
identity|behavioral_profiles|created_at|13|now()|YES|timestamp with time zone||timestamptz
identity|behavioral_profiles|updated_at|14|now()|YES|timestamp with time zone||timestamptz
identity|delegations|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|delegations|delegator_id|2||NO|uuid||uuid
identity|delegations|delegate_id|3||NO|uuid||uuid
identity|delegations|name|4||NO|character varying|255|varchar
identity|delegations|reason|5||YES|text||text
identity|delegations|status|6|'pending'::character varying|YES|character varying|20|varchar
identity|delegations|delegated_permissions|7|'[]'::jsonb|YES|jsonb||jsonb
identity|delegations|delegated_roles|8|'[]'::jsonb|YES|jsonb||jsonb
identity|delegations|scope_restrictions|9||YES|jsonb||jsonb
identity|delegations|starts_at|10||NO|timestamp with time zone||timestamptz
identity|delegations|ends_at|11||NO|timestamp with time zone||timestamptz
identity|delegations|requires_approval|12|false|YES|boolean||bool
identity|delegations|approved_by|13||YES|uuid||uuid
identity|delegations|approved_at|14||YES|timestamp with time zone||timestamptz
identity|delegations|revoked_by|15||YES|uuid||uuid
identity|delegations|revoked_at|16||YES|timestamp with time zone||timestamptz
identity|delegations|revocation_reason|17||YES|text||text
identity|delegations|created_at|18|now()|YES|timestamp with time zone||timestamptz
identity|delegations|updated_at|19|now()|YES|timestamp with time zone||timestamptz
identity|email_verification_tokens|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|email_verification_tokens|user_id|2||NO|uuid||uuid
identity|email_verification_tokens|email|3||NO|character varying|320|varchar
identity|email_verification_tokens|token|4||NO|character varying|255|varchar
identity|email_verification_tokens|expires_at|5||NO|timestamp with time zone||timestamptz
identity|email_verification_tokens|verified_at|6||YES|timestamp with time zone||timestamptz
identity|email_verification_tokens|created_at|7|now()|NO|timestamp with time zone||timestamptz
identity|group_members|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|group_members|group_id|2||NO|uuid||uuid
identity|group_members|user_id|3||NO|uuid||uuid
identity|group_members|is_manager|4|false|NO|boolean||bool
identity|group_members|valid_from|5|now()|NO|timestamp with time zone||timestamptz
identity|group_members|valid_until|6||YES|timestamp with time zone||timestamptz
identity|group_members|created_by|7||YES|uuid||uuid
identity|group_members|created_at|8|now()|NO|timestamp with time zone||timestamptz
identity|group_roles|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|group_roles|group_id|2||NO|uuid||uuid
identity|group_roles|role_id|3||NO|uuid||uuid
identity|group_roles|created_by|4||YES|uuid||uuid
identity|group_roles|created_at|5|now()|NO|timestamp with time zone||timestamptz
identity|groups|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|groups|code|2||NO|character varying|100|varchar
identity|groups|name|3||NO|character varying|255|varchar
identity|groups|description|4||YES|text||text
identity|groups|parent_id|5||YES|uuid||uuid
identity|groups|hierarchy_level|6|0|NO|integer||int4
identity|groups|hierarchy_path|7||YES|character varying|500|varchar
identity|groups|type|8|'standard'::character varying|NO|character varying|50|varchar
identity|groups|membership_rules|9||YES|jsonb||jsonb
identity|groups|is_system|10|false|NO|boolean||bool
identity|groups|is_active|11|true|NO|boolean||bool
identity|groups|icon|12||YES|character varying|100|varchar
identity|groups|color|13||YES|character varying|50|varchar
identity|groups|metadata|14|'{}'::jsonb|NO|jsonb||jsonb
identity|groups|created_by|15||YES|uuid||uuid
identity|groups|created_at|16|now()|NO|timestamp with time zone||timestamptz
identity|groups|updated_at|17|now()|NO|timestamp with time zone||timestamptz
identity|impersonation_sessions|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|impersonation_sessions|impersonator_id|2||NO|uuid||uuid
identity|impersonation_sessions|target_user_id|3||NO|uuid||uuid
identity|impersonation_sessions|reason|4||NO|text||text
identity|impersonation_sessions|is_active|5|true|YES|boolean||bool
identity|impersonation_sessions|started_at|6|now()|NO|timestamp with time zone||timestamptz
identity|impersonation_sessions|ended_at|7||YES|timestamp with time zone||timestamptz
identity|impersonation_sessions|expires_at|8||NO|timestamp with time zone||timestamptz
identity|impersonation_sessions|ip_address|9||NO|character varying|45|varchar
identity|impersonation_sessions|user_agent|10||YES|text||text
identity|impersonation_sessions|actions_log|11|'[]'::jsonb|YES|jsonb||jsonb
identity|impersonation_sessions|created_at|12|now()|YES|timestamp with time zone||timestamptz
identity|ldap_configs|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|ldap_configs|host|2||NO|character varying||varchar
identity|ldap_configs|port|3|389|NO|integer||int4
identity|ldap_configs|secure|4|false|NO|boolean||bool
identity|ldap_configs|bindDn|5||YES|character varying||varchar
identity|ldap_configs|bindPassword|6||YES|character varying||varchar
identity|ldap_configs|searchBase|7||NO|character varying||varchar
identity|ldap_configs|userSearchFilter|8||NO|character varying||varchar
identity|ldap_configs|usernameAttribute|9|'uid'::character varying|NO|character varying||varchar
identity|ldap_configs|emailAttribute|10|'mail'::character varying|NO|character varying||varchar
identity|ldap_configs|fullNameAttribute|11|'cn'::character varying|NO|character varying||varchar
identity|ldap_configs|enabled|12|false|NO|boolean||bool
identity|ldap_configs|createdAt|13|now()|NO|timestamp without time zone||timestamp
identity|ldap_configs|updatedAt|14|now()|NO|timestamp without time zone||timestamp
identity|magic_link_tokens|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|magic_link_tokens|email|2||NO|character varying|320|varchar
identity|magic_link_tokens|user_id|3||YES|uuid||uuid
identity|magic_link_tokens|token|4||NO|character varying|255|varchar
identity|magic_link_tokens|expires_at|5||NO|timestamp with time zone||timestamptz
identity|magic_link_tokens|used_at|6||YES|timestamp with time zone||timestamptz
identity|magic_link_tokens|ip_address|7||YES|character varying|45|varchar
identity|magic_link_tokens|user_agent|8||YES|text||text
identity|magic_link_tokens|redirect_url|9||YES|text||text
identity|magic_link_tokens|created_at|10|now()|YES|timestamp with time zone||timestamptz
identity|mfa_methods|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|mfa_methods|user_id|2||NO|uuid||uuid
identity|mfa_methods|type|3||NO|character varying|50|varchar
identity|mfa_methods|secret|4||YES|text||text
identity|mfa_methods|recovery_codes|5||YES|text||text
identity|mfa_methods|enabled|6|false|NO|boolean||bool
identity|mfa_methods|verified|7|false|NO|boolean||bool
identity|mfa_methods|last_used_at|8||YES|timestamp with time zone||timestamptz
identity|mfa_methods|created_at|9|now()|NO|timestamp with time zone||timestamptz
identity|nav_profile_items|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|nav_profile_items|profile_id|2||NO|uuid||uuid
identity|nav_profile_items|type|3||NO|character varying|50|varchar
identity|nav_profile_items|code|4||NO|character varying|100|varchar
identity|nav_profile_items|label|5||NO|character varying|255|varchar
identity|nav_profile_items|icon|6||YES|character varying|100|varchar
identity|nav_profile_items|route|7||YES|character varying|500|varchar
identity|nav_profile_items|external_url|8||YES|character varying|500|varchar
identity|nav_profile_items|parent_id|9||YES|uuid||uuid
identity|nav_profile_items|position|10|0|NO|integer||int4
identity|nav_profile_items|visibility_expression|11||YES|text||text
identity|nav_profile_items|required_permission|12||YES|character varying|100|varchar
identity|nav_profile_items|is_visible|13|true|NO|boolean||bool
identity|nav_profile_items|is_expanded|14|false|NO|boolean||bool
identity|nav_profile_items|metadata|15|'{}'::jsonb|NO|jsonb||jsonb
identity|nav_profile_items|created_at|16|now()|NO|timestamp with time zone||timestamptz
identity|nav_profiles|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|nav_profiles|code|2||NO|character varying|100|varchar
identity|nav_profiles|name|3||NO|character varying|255|varchar
identity|nav_profiles|description|4||YES|text||text
identity|nav_profiles|scope|5|'role'::character varying|NO|character varying|50|varchar
identity|nav_profiles|role_id|6||YES|uuid||uuid
identity|nav_profiles|group_id|7||YES|uuid||uuid
identity|nav_profiles|user_id|8||YES|uuid||uuid
identity|nav_profiles|priority|9|100|NO|integer||int4
identity|nav_profiles|is_default|10|false|NO|boolean||bool
identity|nav_profiles|is_system|11|false|NO|boolean||bool
identity|nav_profiles|is_active|12|true|NO|boolean||bool
identity|nav_profiles|created_by|13||YES|uuid||uuid
identity|nav_profiles|created_at|14|now()|NO|timestamp with time zone||timestamptz
identity|nav_profiles|updated_at|15|now()|NO|timestamp with time zone||timestamptz
identity|nav_profiles|template_key|16||YES|character varying|100|varchar
identity|nav_profiles|auto_assign_roles|17||YES|text||text
identity|nav_profiles|auto_assign_expression|18||YES|text||text
identity|nav_profiles|is_locked|19|false|NO|boolean||bool
identity|password_history|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|password_history|user_id|2||NO|uuid||uuid
identity|password_history|password_hash|3||NO|character varying|255|varchar
identity|password_history|created_at|4|now()|NO|timestamp with time zone||timestamptz
identity|password_policies|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|password_policies|minLength|2|8|NO|integer||int4
identity|password_policies|requireUppercase|3|false|NO|boolean||bool
identity|password_policies|requireLowercase|4|false|NO|boolean||bool
identity|password_policies|requireNumbers|5|false|NO|boolean||bool
identity|password_policies|requireSpecialChars|6|false|NO|boolean||bool
identity|password_policies|expirationDays|7|90|NO|integer||int4
identity|password_policies|historyCount|8|5|NO|integer||int4
identity|password_policies|maxAttempts|9|3|NO|integer||int4
identity|password_policies|lockoutMinutes|10|30|NO|integer||int4
identity|password_policies|createdAt|11|now()|NO|timestamp without time zone||timestamp
identity|password_policies|updatedAt|12|now()|NO|timestamp without time zone||timestamp
identity|password_reset_tokens|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|password_reset_tokens|user_id|2||NO|uuid||uuid
identity|password_reset_tokens|token|3||NO|character varying|255|varchar
identity|password_reset_tokens|expires_at|4||NO|timestamp with time zone||timestamptz
identity|password_reset_tokens|used_at|5||YES|timestamp with time zone||timestamptz
identity|password_reset_tokens|created_at|6|now()|NO|timestamp with time zone||timestamptz
identity|platform_permissions|code|1||NO|text||text
identity|platform_permissions|plane|2||NO|text||text
identity|platform_permissions|domain|3||NO|text||text
identity|platform_permissions|resource|4||YES|text||text
identity|platform_permissions|action|5||NO|text||text
identity|platform_permissions|dangerous|6|false|NO|boolean||bool
identity|platform_permissions|description|7||NO|text||text
identity|refresh_tokens|token_hash|1||NO|text||text
identity|refresh_tokens|family_id|2||NO|uuid||uuid
identity|refresh_tokens|parent_token_id|3||YES|text||text
identity|refresh_tokens|user_id|4||NO|uuid||uuid
identity|refresh_tokens|instance_id|5||YES|uuid||uuid
identity|refresh_tokens|session_id|6||NO|uuid||uuid
identity|refresh_tokens|device_label|7||YES|text||text
identity|refresh_tokens|user_agent_hash|8||YES|text||text
identity|refresh_tokens|ip_address_hash|9||YES|text||text
identity|refresh_tokens|created_at|10|now()|NO|timestamp with time zone||timestamptz
identity|refresh_tokens|expires_at|11||NO|timestamp with time zone||timestamptz
identity|refresh_tokens|last_used_at|12||YES|timestamp with time zone||timestamptz
identity|refresh_tokens|revoked_at|13||YES|timestamp with time zone||timestamptz
identity|refresh_tokens|replaced_by_token_id|14||YES|text||text
identity|refresh_tokens|revoked_reason|15||YES|text||text
identity|role_permissions|role_id|1||NO|uuid||uuid
identity|role_permissions|permission_code|2||NO|text||text
identity|role_permissions|granted_at|3|now()|NO|timestamp with time zone||timestamptz
identity|role_permissions|granted_by|4||YES|uuid||uuid
identity|roles|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|roles|code|2||NO|character varying|100|varchar
identity|roles|name|3||NO|character varying|255|varchar
identity|roles|description|4||YES|text||text
identity|roles|parent_id|5||YES|uuid||uuid
identity|roles|hierarchy_level|6|0|NO|integer||int4
identity|roles|hierarchy_path|7||YES|character varying|500|varchar
identity|roles|scope|8|'global'::character varying|NO|character varying|50|varchar
identity|roles|max_users|9||YES|integer||int4
identity|roles|weight|10|0|NO|integer||int4
identity|roles|is_system|11|false|NO|boolean||bool
identity|roles|is_active|12|true|NO|boolean||bool
identity|roles|is_default|13|false|NO|boolean||bool
identity|roles|icon|14||YES|character varying|100|varchar
identity|roles|color|15||YES|character varying|50|varchar
identity|roles|metadata|16|'{}'::jsonb|NO|jsonb||jsonb
identity|roles|created_by|17||YES|uuid||uuid
identity|roles|updated_by|18||YES|uuid||uuid
identity|roles|created_at|19|now()|NO|timestamp with time zone||timestamptz
identity|roles|updated_at|20|now()|NO|timestamp with time zone||timestamptz
identity|saml_auth_states|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|saml_auth_states|provider_id|2||NO|uuid||uuid
identity|saml_auth_states|relay_state|3||NO|character varying|255|varchar
identity|saml_auth_states|redirect_uri|4||NO|character varying|2048|varchar
identity|saml_auth_states|expires_at|5||NO|timestamp with time zone||timestamptz
identity|saml_auth_states|consumed_at|6||YES|timestamp with time zone||timestamptz
identity|saml_auth_states|created_at|7|now()|YES|timestamp with time zone||timestamptz
identity|security_alerts|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|security_alerts|user_id|2||YES|uuid||uuid
identity|security_alerts|alert_type|3||NO|character varying|100|varchar
identity|security_alerts|title|4||NO|character varying|255|varchar
identity|security_alerts|description|5||NO|text||text
identity|security_alerts|severity|6||NO|character varying|20|varchar
identity|security_alerts|status|7|'new'::character varying|YES|character varying|20|varchar
identity|security_alerts|risk_score|8|50|YES|integer||int4
identity|security_alerts|details|9||YES|jsonb||jsonb
identity|security_alerts|recommended_actions|10|'[]'::jsonb|YES|jsonb||jsonb
identity|security_alerts|acknowledged_by|11||YES|uuid||uuid
identity|security_alerts|acknowledged_at|12||YES|timestamp with time zone||timestamptz
identity|security_alerts|resolution_notes|13||YES|text||text
identity|security_alerts|resolved_by|14||YES|uuid||uuid
identity|security_alerts|resolved_at|15||YES|timestamp with time zone||timestamptz
identity|security_alerts|created_at|16|now()|YES|timestamp with time zone||timestamptz
identity|security_alerts|updated_at|17|now()|YES|timestamp with time zone||timestamptz
identity|service_accounts|id|1|gen_random_uuid()|NO|uuid||uuid
identity|service_accounts|name|2||NO|character varying|80|varchar
identity|service_accounts|client_secret_hash|3||NO|character varying|255|varchar
identity|service_accounts|allowed_scopes|4|'[]'::jsonb|NO|jsonb||jsonb
identity|service_accounts|description|5||YES|text||text
identity|service_accounts|owner_team|6||YES|character varying|80|varchar
identity|service_accounts|status|7|'active'::character varying|NO|character varying|20|varchar
identity|service_accounts|secret_rotated_at|8||YES|timestamp with time zone||timestamptz
identity|service_accounts|last_used_at|9||YES|timestamp with time zone||timestamptz
identity|service_accounts|created_at|10|now()|NO|timestamp with time zone||timestamptz
identity|service_accounts|updated_at|11|now()|NO|timestamp with time zone||timestamptz
identity|service_accounts|created_by|12||YES|uuid||uuid
identity|service_accounts|updated_by|13||YES|uuid||uuid
identity|service_token_signing_keys|id|1|gen_random_uuid()|NO|uuid||uuid
identity|service_token_signing_keys|key_id|2||NO|character varying|80|varchar
identity|service_token_signing_keys|algorithm|3|'ES256'::character varying|NO|character varying|20|varchar
identity|service_token_signing_keys|public_key_pem|4||NO|text||text
identity|service_token_signing_keys|backend_ref|5||YES|character varying|255|varchar
identity|service_token_signing_keys|status|6|'active'::character varying|NO|character varying|20|varchar
identity|service_token_signing_keys|created_at|7|now()|NO|timestamp with time zone||timestamptz
identity|service_token_signing_keys|retired_at|8||YES|timestamp with time zone||timestamptz
identity|service_token_signing_keys|archived_at|9||YES|timestamp with time zone||timestamptz
identity|service_token_signing_keys|created_by|10||YES|uuid||uuid
identity|sso_providers|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|sso_providers|name|2||NO|character varying||varchar
identity|sso_providers|slug|3||NO|character varying||varchar
identity|sso_providers|description|4||YES|text||text
identity|sso_providers|type|5||NO|character varying||varchar
identity|sso_providers|issuer|6||YES|character varying||varchar
identity|sso_providers|client_id|7||YES|character varying||varchar
identity|sso_providers|client_secret|8||YES|character varying||varchar
identity|sso_providers|authorization_url|9||YES|character varying||varchar
identity|sso_providers|token_url|10||YES|character varying||varchar
identity|sso_providers|user_info_url|11||YES|character varying||varchar
identity|sso_providers|jwks_url|12||YES|character varying||varchar
identity|sso_providers|scopes|13||YES|character varying||varchar
identity|sso_providers|entity_id|14||YES|character varying||varchar
identity|sso_providers|sso_url|15||YES|character varying||varchar
identity|sso_providers|slo_url|16||YES|character varying||varchar
identity|sso_providers|certificate|17||YES|text||text
identity|sso_providers|jit_enabled|18|false|NO|boolean||bool
identity|sso_providers|jit_default_roles|19||YES|jsonb||jsonb
identity|sso_providers|jit_group_mapping|20||YES|jsonb||jsonb
identity|sso_providers|jit_update_profile|21|true|NO|boolean||bool
identity|sso_providers|attribute_mapping|22||YES|jsonb||jsonb
identity|sso_providers|button_text|23||YES|character varying||varchar
identity|sso_providers|button_icon_url|24||YES|character varying||varchar
identity|sso_providers|display_order|25|0|NO|integer||int4
identity|sso_providers|allowed_domains|26||YES|jsonb||jsonb
identity|sso_providers|logout_redirect_url|27||YES|character varying||varchar
identity|sso_providers|enabled|28|false|NO|boolean||bool
identity|sso_providers|created_at|29|now()|NO|timestamp without time zone||timestamp
identity|sso_providers|updated_at|30|now()|NO|timestamp without time zone||timestamp
identity|sso_providers|deleted_at|31||YES|timestamp without time zone||timestamp
identity|trusted_devices|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|trusted_devices|user_id|2||NO|uuid||uuid
identity|trusted_devices|device_fingerprint|3||NO|character varying|255|varchar
identity|trusted_devices|device_name|4||NO|character varying|255|varchar
identity|trusted_devices|device_type|5||NO|character varying|50|varchar
identity|trusted_devices|browser|6||YES|character varying|100|varchar
identity|trusted_devices|os|7||YES|character varying|100|varchar
identity|trusted_devices|status|8|'pending'::character varying|YES|character varying|20|varchar
identity|trusted_devices|trust_score|9|50|YES|integer||int4
identity|trusted_devices|known_ips|10|'[]'::jsonb|YES|jsonb||jsonb
identity|trusted_devices|known_locations|11|'[]'::jsonb|YES|jsonb||jsonb
identity|trusted_devices|verification_method|12||YES|character varying|50|varchar
identity|trusted_devices|trusted_until|13||YES|timestamp with time zone||timestamptz
identity|trusted_devices|first_seen_at|14|now()|NO|timestamp with time zone||timestamptz
identity|trusted_devices|last_seen_at|15|now()|NO|timestamp with time zone||timestamptz
identity|trusted_devices|login_count|16|0|YES|integer||int4
identity|trusted_devices|created_at|17|now()|YES|timestamp with time zone||timestamptz
identity|trusted_devices|updated_at|18|now()|YES|timestamp with time zone||timestamptz
identity|user_invitations|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|user_invitations|email|2||NO|character varying|320|varchar
identity|user_invitations|token|3||NO|character varying|255|varchar
identity|user_invitations|status|4|'pending'::character varying|NO|character varying|20|varchar
identity|user_invitations|role_ids|5|'[]'::jsonb|NO|jsonb||jsonb
identity|user_invitations|group_ids|6|'[]'::jsonb|NO|jsonb||jsonb
identity|user_invitations|message|7||YES|text||text
identity|user_invitations|expires_at|8||NO|timestamp with time zone||timestamptz
identity|user_invitations|accepted_at|9||YES|timestamp with time zone||timestamptz
identity|user_invitations|created_user_id|10||YES|uuid||uuid
identity|user_invitations|invited_by|11||NO|uuid||uuid
identity|user_invitations|created_at|12|now()|NO|timestamp with time zone||timestamptz
identity|user_roles|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|user_roles|user_id|2||NO|uuid||uuid
identity|user_roles|role_id|3||NO|uuid||uuid
identity|user_roles|source|4|'direct'::character varying|NO|character varying|50|varchar
identity|user_roles|source_id|5||YES|uuid||uuid
identity|user_roles|valid_from|6|now()|NO|timestamp with time zone||timestamptz
identity|user_roles|valid_until|7||YES|timestamp with time zone||timestamptz
identity|user_roles|created_by|8||YES|uuid||uuid
identity|user_roles|created_at|9|now()|NO|timestamp with time zone||timestamptz
identity|webauthn_challenges|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|webauthn_challenges|challenge|2||NO|character varying|255|varchar
identity|webauthn_challenges|user_id|3||YES|uuid||uuid
identity|webauthn_challenges|type|4||NO|character varying|20|varchar
identity|webauthn_challenges|session_data|5||YES|jsonb||jsonb
identity|webauthn_challenges|expires_at|6||NO|timestamp with time zone||timestamptz
identity|webauthn_challenges|created_at|7|now()|YES|timestamp with time zone||timestamptz
identity|webauthn_credentials|id|1|uuid_generate_v4()|NO|uuid||uuid
identity|webauthn_credentials|user_id|2||NO|uuid||uuid
identity|webauthn_credentials|credential_id|3||NO|text||text
identity|webauthn_credentials|public_key|4||NO|text||text
identity|webauthn_credentials|sign_count|5|0|YES|bigint||int8
identity|webauthn_credentials|credential_type|6|'public-key'::character varying|YES|character varying|50|varchar
identity|webauthn_credentials|transports|7|'[]'::jsonb|YES|jsonb||jsonb
identity|webauthn_credentials|name|8||NO|character varying|255|varchar
identity|webauthn_credentials|aaguid|9||YES|character varying|36|varchar
identity|webauthn_credentials|is_discoverable|10|true|YES|boolean||bool
identity|webauthn_credentials|is_backed_up|11|false|YES|boolean||bool
identity|webauthn_credentials|device_info|12||YES|jsonb||jsonb
identity|webauthn_credentials|last_used_at|13||YES|timestamp with time zone||timestamptz
identity|webauthn_credentials|is_active|14|true|YES|boolean||bool
identity|webauthn_credentials|created_at|15|now()|YES|timestamp with time zone||timestamptz
identity|webauthn_credentials|updated_at|16|now()|YES|timestamp with time zone||timestamptz
insights|alert_definitions|id|1|gen_random_uuid()|NO|uuid||uuid
insights|alert_definitions|code|2||NO|character varying|120|varchar
insights|alert_definitions|name|3||NO|character varying|255|varchar
insights|alert_definitions|description|4||YES|text||text
insights|alert_definitions|conditions|5|'{}'::jsonb|YES|jsonb||jsonb
insights|alert_definitions|actions|6|'{}'::jsonb|YES|jsonb||jsonb
insights|alert_definitions|metadata|7|'{}'::jsonb|YES|jsonb||jsonb
insights|alert_definitions|is_active|8|true|YES|boolean||bool
insights|alert_definitions|created_by|9||YES|uuid||uuid
insights|alert_definitions|updated_by|10||YES|uuid||uuid
insights|alert_definitions|created_at|11|now()|YES|timestamp with time zone||timestamptz
insights|alert_definitions|updated_at|12|now()|YES|timestamp with time zone||timestamptz
insights|dashboard_definitions|id|1|gen_random_uuid()|NO|uuid||uuid
insights|dashboard_definitions|code|2||NO|character varying|120|varchar
insights|dashboard_definitions|name|3||NO|character varying|255|varchar
insights|dashboard_definitions|description|4||YES|text||text
insights|dashboard_definitions|layout|5|'{}'::jsonb|YES|jsonb||jsonb
insights|dashboard_definitions|metadata|6|'{}'::jsonb|YES|jsonb||jsonb
insights|dashboard_definitions|is_active|7|true|YES|boolean||bool
insights|dashboard_definitions|created_by|8||YES|uuid||uuid
insights|dashboard_definitions|updated_by|9||YES|uuid||uuid
insights|dashboard_definitions|created_at|10|now()|YES|timestamp with time zone||timestamptz
insights|dashboard_definitions|updated_at|11|now()|YES|timestamp with time zone||timestamptz
insights|dashboard_definitions|scope|12|'tenant'::character varying|NO|character varying|20|varchar
insights|metric_definitions|id|1|gen_random_uuid()|NO|uuid||uuid
insights|metric_definitions|code|2||NO|character varying|100|varchar
insights|metric_definitions|name|3||NO|character varying|255|varchar
insights|metric_definitions|description|4||YES|text||text
insights|metric_definitions|source_type|5||NO|character varying|40|varchar
insights|metric_definitions|source_config|6|'{}'::jsonb|YES|jsonb||jsonb
insights|metric_definitions|aggregation|7||NO|character varying|20|varchar
insights|metric_definitions|cadence|8||NO|character varying|20|varchar
insights|metric_definitions|retention_days|9|90|YES|integer||int4
insights|metric_definitions|metadata|10|'{}'::jsonb|YES|jsonb||jsonb
insights|metric_definitions|is_active|11|true|YES|boolean||bool
insights|metric_definitions|created_by|12||YES|uuid||uuid
insights|metric_definitions|updated_by|13||YES|uuid||uuid
insights|metric_definitions|created_at|14|now()|YES|timestamp with time zone||timestamptz
insights|metric_definitions|updated_at|15|now()|YES|timestamp with time zone||timestamptz
insights|metric_definitions|definition_owner_id|16||YES|uuid||uuid
insights|metric_points|id|1|gen_random_uuid()|NO|uuid||uuid
insights|metric_points|metric_code|2||NO|character varying|100|varchar
insights|metric_points|period_start|3||NO|timestamp with time zone||timestamptz
insights|metric_points|period_end|4||NO|timestamp with time zone||timestamptz
insights|metric_points|value|5||NO|numeric||numeric
insights|metric_points|dimensions|6||YES|jsonb||jsonb
insights|metric_points|created_at|7|now()|YES|timestamp with time zone||timestamptz
integrations|api_keys|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|api_keys|user_id|2||NO|uuid||uuid
integrations|api_keys|name|3||NO|character varying|255|varchar
integrations|api_keys|key_hash|4||NO|character varying|255|varchar
integrations|api_keys|key_prefix|5||NO|character varying|20|varchar
integrations|api_keys|scopes|6|'[]'::jsonb|NO|jsonb||jsonb
integrations|api_keys|ip_whitelist|7||YES|jsonb||jsonb
integrations|api_keys|expires_at|8||YES|timestamp with time zone||timestamptz
integrations|api_keys|last_used_at|9||YES|timestamp with time zone||timestamptz
integrations|api_keys|last_used_ip|10||YES|character varying|45|varchar
integrations|api_keys|is_active|11|true|NO|boolean||bool
integrations|api_keys|created_at|12|now()|NO|timestamp with time zone||timestamptz
integrations|api_request_logs|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|api_request_logs|api_key_id|2||YES|uuid||uuid
integrations|api_request_logs|oauth_client_id|3||YES|uuid||uuid
integrations|api_request_logs|user_id|4||YES|uuid||uuid
integrations|api_request_logs|method|5||NO|character varying|10|varchar
integrations|api_request_logs|path|6||NO|text||text
integrations|api_request_logs|query_params|7||YES|jsonb||jsonb
integrations|api_request_logs|request_headers|8||YES|jsonb||jsonb
integrations|api_request_logs|request_body_size|9||YES|integer||int4
integrations|api_request_logs|response_status|10||YES|integer||int4
integrations|api_request_logs|response_body_size|11||YES|integer||int4
integrations|api_request_logs|duration_ms|12||YES|integer||int4
integrations|api_request_logs|ip_address|13||YES|character varying|45|varchar
integrations|api_request_logs|user_agent|14||YES|text||text
integrations|api_request_logs|error_message|15||YES|text||text
integrations|api_request_logs|created_at|16|now()|YES|timestamp with time zone||timestamptz
integrations|connector_connections|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|connector_connections|connector_id|2||YES|uuid||uuid
integrations|connector_connections|name|3||NO|character varying|255|varchar
integrations|connector_connections|description|4||YES|text||text
integrations|connector_connections|config|5||NO|jsonb||jsonb
integrations|connector_connections|credentials|6||YES|jsonb||jsonb
integrations|connector_connections|status|7|'disconnected'::character varying|YES|character varying|50|varchar
integrations|connector_connections|last_connected_at|8||YES|timestamp with time zone||timestamptz
integrations|connector_connections|last_sync_at|9||YES|timestamp with time zone||timestamptz
integrations|connector_connections|error_message|10||YES|text||text
integrations|connector_connections|is_active|11|true|YES|boolean||bool
integrations|connector_connections|created_by|12||YES|uuid||uuid
integrations|connector_connections|created_at|13|now()|YES|timestamp with time zone||timestamptz
integrations|connector_connections|updated_at|14|now()|YES|timestamp with time zone||timestamptz
integrations|connector_connections|metadata|15|'{}'::jsonb|NO|jsonb||jsonb
integrations|connector_connections|code|16||YES|character varying|120|varchar
integrations|connector_connections|credential_ref|17||YES|text||text
integrations|connector_connections|updated_by|18||YES|uuid||uuid
integrations|export_jobs|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|export_jobs|name|2||NO|character varying|255|varchar
integrations|export_jobs|source_collection_id|3||YES|uuid||uuid
integrations|export_jobs|query|4||YES|jsonb||jsonb
integrations|export_jobs|format|5|'csv'::character varying|NO|character varying|50|varchar
integrations|export_jobs|options|6|'{}'::jsonb|YES|jsonb||jsonb
integrations|export_jobs|include_fields|7||YES|jsonb||jsonb
integrations|export_jobs|exclude_fields|8||YES|jsonb||jsonb
integrations|export_jobs|status|9|'pending'::character varying|YES|character varying|50|varchar
integrations|export_jobs|progress|10|0|YES|integer||int4
integrations|export_jobs|total_records|11||YES|integer||int4
integrations|export_jobs|exported_records|12|0|YES|integer||int4
integrations|export_jobs|file_name|13||YES|character varying|500|varchar
integrations|export_jobs|file_size|14||YES|bigint||int8
integrations|export_jobs|file_url|15||YES|text||text
integrations|export_jobs|expires_at|16||YES|timestamp with time zone||timestamptz
integrations|export_jobs|started_at|17||YES|timestamp with time zone||timestamptz
integrations|export_jobs|completed_at|18||YES|timestamp with time zone||timestamptz
integrations|export_jobs|error_message|19||YES|text||text
integrations|export_jobs|created_by|20||YES|uuid||uuid
integrations|export_jobs|created_at|21|now()|YES|timestamp with time zone||timestamptz
integrations|external_connectors|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|external_connectors|code|2||NO|character varying|100|varchar
integrations|external_connectors|name|3||NO|character varying|255|varchar
integrations|external_connectors|description|4||YES|text||text
integrations|external_connectors|type|5||NO|character varying|50|varchar
integrations|external_connectors|version|6|'1.0.0'::character varying|YES|character varying|20|varchar
integrations|external_connectors|icon_url|7||YES|text||text
integrations|external_connectors|documentation_url|8||YES|text||text
integrations|external_connectors|config_schema|9||NO|jsonb||jsonb
integrations|external_connectors|auth_type|10||NO|character varying|50|varchar
integrations|external_connectors|supported_operations|11|'[]'::jsonb|YES|jsonb||jsonb
integrations|external_connectors|is_system|12|false|YES|boolean||bool
integrations|external_connectors|is_active|13|true|YES|boolean||bool
integrations|external_connectors|created_at|14|now()|YES|timestamp with time zone||timestamptz
integrations|external_connectors|updated_at|15|now()|YES|timestamp with time zone||timestamptz
integrations|external_connectors|metadata|16|'{}'::jsonb|NO|jsonb||jsonb
integrations|external_connectors|created_by|17||YES|uuid||uuid
integrations|external_connectors|updated_by|18||YES|uuid||uuid
integrations|import_jobs|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|import_jobs|name|2||NO|character varying|255|varchar
integrations|import_jobs|type|3||NO|character varying|50|varchar
integrations|import_jobs|source_type|4||NO|character varying|50|varchar
integrations|import_jobs|source_config|5||YES|jsonb||jsonb
integrations|import_jobs|file_name|6||YES|character varying|500|varchar
integrations|import_jobs|file_size|7||YES|bigint||int8
integrations|import_jobs|file_type|8||YES|character varying|100|varchar
integrations|import_jobs|target_collection_id|9||YES|uuid||uuid
integrations|import_jobs|field_mapping|10|'[]'::jsonb|NO|jsonb||jsonb
integrations|import_jobs|options|11|'{}'::jsonb|YES|jsonb||jsonb
integrations|import_jobs|status|12|'pending'::character varying|YES|character varying|50|varchar
integrations|import_jobs|progress|13|0|YES|integer||int4
integrations|import_jobs|total_records|14||YES|integer||int4
integrations|import_jobs|processed_records|15|0|YES|integer||int4
integrations|import_jobs|successful_records|16|0|YES|integer||int4
integrations|import_jobs|failed_records|17|0|YES|integer||int4
integrations|import_jobs|skipped_records|18|0|YES|integer||int4
integrations|import_jobs|error_log|19|'[]'::jsonb|YES|jsonb||jsonb
integrations|import_jobs|started_at|20||YES|timestamp with time zone||timestamptz
integrations|import_jobs|completed_at|21||YES|timestamp with time zone||timestamptz
integrations|import_jobs|created_by|22||YES|uuid||uuid
integrations|import_jobs|created_at|23|now()|YES|timestamp with time zone||timestamptz
integrations|oauth_access_tokens|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|oauth_access_tokens|access_token|2||NO|character varying|512|varchar
integrations|oauth_access_tokens|client_id|3||YES|uuid||uuid
integrations|oauth_access_tokens|user_id|4||YES|uuid||uuid
integrations|oauth_access_tokens|scope|5||YES|text||text
integrations|oauth_access_tokens|expires_at|6||NO|timestamp with time zone||timestamptz
integrations|oauth_access_tokens|revoked|7|false|YES|boolean||bool
integrations|oauth_access_tokens|revoked_at|8||YES|timestamp with time zone||timestamptz
integrations|oauth_access_tokens|created_at|9|now()|YES|timestamp with time zone||timestamptz
integrations|oauth_authorization_codes|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|oauth_authorization_codes|code|2||NO|character varying|255|varchar
integrations|oauth_authorization_codes|client_id|3||YES|uuid||uuid
integrations|oauth_authorization_codes|user_id|4||NO|uuid||uuid
integrations|oauth_authorization_codes|redirect_uri|5||NO|text||text
integrations|oauth_authorization_codes|scope|6||YES|text||text
integrations|oauth_authorization_codes|code_challenge|7||YES|character varying|255|varchar
integrations|oauth_authorization_codes|code_challenge_method|8||YES|character varying|10|varchar
integrations|oauth_authorization_codes|state|9||YES|character varying|255|varchar
integrations|oauth_authorization_codes|expires_at|10||NO|timestamp with time zone||timestamptz
integrations|oauth_authorization_codes|used|11|false|YES|boolean||bool
integrations|oauth_authorization_codes|created_at|12|now()|YES|timestamp with time zone||timestamptz
integrations|oauth_clients|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|oauth_clients|client_id|2||NO|character varying|255|varchar
integrations|oauth_clients|client_secret_hash|3||NO|character varying|255|varchar
integrations|oauth_clients|name|4||NO|character varying|255|varchar
integrations|oauth_clients|description|5||YES|text||text
integrations|oauth_clients|client_type|6|'confidential'::character varying|NO|character varying|50|varchar
integrations|oauth_clients|redirect_uris|7|'[]'::jsonb|NO|jsonb||jsonb
integrations|oauth_clients|allowed_scopes|8|'[]'::jsonb|NO|jsonb||jsonb
integrations|oauth_clients|allowed_grant_types|9|'["authorization_code", "refresh_token"]'::jsonb|NO|jsonb||jsonb
integrations|oauth_clients|access_token_lifetime_seconds|10|3600|YES|integer||int4
integrations|oauth_clients|refresh_token_lifetime_seconds|11|2592000|YES|integer||int4
integrations|oauth_clients|require_pkce|12|false|YES|boolean||bool
integrations|oauth_clients|is_active|13|true|YES|boolean||bool
integrations|oauth_clients|logo_url|14||YES|text||text
integrations|oauth_clients|terms_url|15||YES|text||text
integrations|oauth_clients|privacy_url|16||YES|text||text
integrations|oauth_clients|created_by|17||YES|uuid||uuid
integrations|oauth_clients|created_at|18|now()|YES|timestamp with time zone||timestamptz
integrations|oauth_clients|updated_at|19|now()|YES|timestamp with time zone||timestamptz
integrations|oauth_refresh_tokens|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|oauth_refresh_tokens|refresh_token|2||NO|character varying|512|varchar
integrations|oauth_refresh_tokens|access_token_id|3||YES|uuid||uuid
integrations|oauth_refresh_tokens|client_id|4||YES|uuid||uuid
integrations|oauth_refresh_tokens|user_id|5||YES|uuid||uuid
integrations|oauth_refresh_tokens|scope|6||YES|text||text
integrations|oauth_refresh_tokens|expires_at|7||NO|timestamp with time zone||timestamptz
integrations|oauth_refresh_tokens|revoked|8|false|YES|boolean||bool
integrations|oauth_refresh_tokens|revoked_at|9||YES|timestamp with time zone||timestamptz
integrations|oauth_refresh_tokens|created_at|10|now()|YES|timestamp with time zone||timestamptz
integrations|sync_configurations|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|sync_configurations|name|2||NO|character varying|255|varchar
integrations|sync_configurations|description|3||YES|text||text
integrations|sync_configurations|connection_id|4||YES|uuid||uuid
integrations|sync_configurations|mapping_id|5||YES|uuid||uuid
integrations|sync_configurations|schedule|6||YES|character varying|100|varchar
integrations|sync_configurations|direction|7|'bidirectional'::character varying|YES|character varying|20|varchar
integrations|sync_configurations|sync_mode|8|'incremental'::character varying|YES|character varying|50|varchar
integrations|sync_configurations|conflict_resolution|9|'source_wins'::character varying|YES|character varying|50|varchar
integrations|sync_configurations|batch_size|10|100|YES|integer||int4
integrations|sync_configurations|is_active|11|true|YES|boolean||bool
integrations|sync_configurations|last_run_at|12||YES|timestamp with time zone||timestamptz
integrations|sync_configurations|next_run_at|13||YES|timestamp with time zone||timestamptz
integrations|sync_configurations|run_count|14|0|YES|integer||int4
integrations|sync_configurations|success_count|15|0|YES|integer||int4
integrations|sync_configurations|failure_count|16|0|YES|integer||int4
integrations|sync_configurations|created_by|17||YES|uuid||uuid
integrations|sync_configurations|created_at|18|now()|YES|timestamp with time zone||timestamptz
integrations|sync_configurations|updated_at|19|now()|YES|timestamp with time zone||timestamptz
integrations|sync_configurations|metadata|20|'{}'::jsonb|NO|jsonb||jsonb
integrations|sync_runs|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|sync_runs|configuration_id|2||YES|uuid||uuid
integrations|sync_runs|status|3|'running'::character varying|YES|character varying|50|varchar
integrations|sync_runs|direction|4||YES|character varying|20|varchar
integrations|sync_runs|started_at|5|now()|YES|timestamp with time zone||timestamptz
integrations|sync_runs|completed_at|6||YES|timestamp with time zone||timestamptz
integrations|sync_runs|duration_ms|7||YES|bigint||int8
integrations|sync_runs|records_processed|8|0|YES|integer||int4
integrations|sync_runs|records_created|9|0|YES|integer||int4
integrations|sync_runs|records_updated|10|0|YES|integer||int4
integrations|sync_runs|records_deleted|11|0|YES|integer||int4
integrations|sync_runs|records_skipped|12|0|YES|integer||int4
integrations|sync_runs|records_failed|13|0|YES|integer||int4
integrations|sync_runs|conflicts_detected|14|0|YES|integer||int4
integrations|sync_runs|conflicts_resolved|15|0|YES|integer||int4
integrations|sync_runs|error_message|16||YES|text||text
integrations|sync_runs|error_details|17||YES|jsonb||jsonb
integrations|sync_runs|log|18|'[]'::jsonb|YES|jsonb||jsonb
integrations|sync_runs|created_at|19|now()|YES|timestamp with time zone||timestamptz
integrations|webhook_deliveries|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|webhook_deliveries|subscription_id|2||YES|uuid||uuid
integrations|webhook_deliveries|event_type|3||NO|character varying|100|varchar
integrations|webhook_deliveries|event_id|4||NO|character varying|255|varchar
integrations|webhook_deliveries|payload|5||NO|jsonb||jsonb
integrations|webhook_deliveries|request_headers|6||YES|jsonb||jsonb
integrations|webhook_deliveries|response_status|7||YES|integer||int4
integrations|webhook_deliveries|response_body|8||YES|text||text
integrations|webhook_deliveries|response_headers|9||YES|jsonb||jsonb
integrations|webhook_deliveries|attempt_count|10|1|YES|integer||int4
integrations|webhook_deliveries|max_attempts|11|5|YES|integer||int4
integrations|webhook_deliveries|status|12|'pending'::character varying|YES|character varying|50|varchar
integrations|webhook_deliveries|error_message|13||YES|text||text
integrations|webhook_deliveries|duration_ms|14||YES|integer||int4
integrations|webhook_deliveries|scheduled_at|15|now()|YES|timestamp with time zone||timestamptz
integrations|webhook_deliveries|delivered_at|16||YES|timestamp with time zone||timestamptz
integrations|webhook_deliveries|next_retry_at|17||YES|timestamp with time zone||timestamptz
integrations|webhook_deliveries|created_at|18|now()|YES|timestamp with time zone||timestamptz
integrations|webhook_subscriptions|id|1|uuid_generate_v4()|NO|uuid||uuid
integrations|webhook_subscriptions|name|2||NO|character varying|255|varchar
integrations|webhook_subscriptions|description|3||YES|text||text
integrations|webhook_subscriptions|endpoint_url|4||NO|text||text
integrations|webhook_subscriptions|secret|5||NO|character varying|255|varchar
integrations|webhook_subscriptions|events|6|'[]'::jsonb|NO|jsonb||jsonb
integrations|webhook_subscriptions|collection_id|7||YES|uuid||uuid
integrations|webhook_subscriptions|filter_conditions|8||YES|jsonb||jsonb
integrations|webhook_subscriptions|http_method|9|'POST'::character varying|YES|character varying|10|varchar
integrations|webhook_subscriptions|headers|10|'{}'::jsonb|YES|jsonb||jsonb
integrations|webhook_subscriptions|is_active|11|true|YES|boolean||bool
integrations|webhook_subscriptions|verify_ssl|12|true|YES|boolean||bool
integrations|webhook_subscriptions|retry_count|13|5|YES|integer||int4
integrations|webhook_subscriptions|retry_delay_seconds|14|30|YES|integer||int4
integrations|webhook_subscriptions|timeout_seconds|15|30|YES|integer||int4
integrations|webhook_subscriptions|last_triggered_at|16||YES|timestamp with time zone||timestamptz
integrations|webhook_subscriptions|last_success_at|17||YES|timestamp with time zone||timestamptz
integrations|webhook_subscriptions|last_failure_at|18||YES|timestamp with time zone||timestamptz
integrations|webhook_subscriptions|failure_count|19|0|YES|integer||int4
integrations|webhook_subscriptions|success_count|20|0|YES|integer||int4
integrations|webhook_subscriptions|created_by|21||YES|uuid||uuid
integrations|webhook_subscriptions|created_at|22|now()|YES|timestamp with time zone||timestamptz
integrations|webhook_subscriptions|updated_at|23|now()|YES|timestamp with time zone||timestamptz
metadata|application_revisions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|application_revisions|application_id|2||NO|uuid||uuid
metadata|application_revisions|revision|3||NO|integer||int4
metadata|application_revisions|status|4||NO|character varying|20|varchar
metadata|application_revisions|payload|5|'{}'::jsonb|NO|jsonb||jsonb
metadata|application_revisions|created_by|6||YES|uuid||uuid
metadata|application_revisions|published_by|7||YES|uuid||uuid
metadata|application_revisions|published_at|8||YES|timestamp with time zone||timestamptz
metadata|application_revisions|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|applications|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|applications|code|2||NO|character varying|120|varchar
metadata|applications|name|3||NO|character varying|255|varchar
metadata|applications|description|4||YES|text||text
metadata|applications|scope|5||YES|character varying|120|varchar
metadata|applications|source|6|'custom'::character varying|NO|character varying|120|varchar
metadata|applications|status|7|'draft'::character varying|NO|character varying|20|varchar
metadata|applications|current_revision_id|8||YES|uuid||uuid
metadata|applications|created_by|9||YES|uuid||uuid
metadata|applications|updated_by|10||YES|uuid||uuid
metadata|applications|created_at|11|now()|NO|timestamp with time zone||timestamptz
metadata|applications|updated_at|12|now()|NO|timestamp with time zone||timestamptz
metadata|change_packages|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|change_packages|code|2||NO|character varying|120|varchar
metadata|change_packages|name|3||NO|character varying|255|varchar
metadata|change_packages|description|4||YES|text||text
metadata|change_packages|application_id|5||NO|uuid||uuid
metadata|change_packages|status|6|'open'::character varying|NO|character varying|20|varchar
metadata|change_packages|changes|7|'[]'::jsonb|NO|jsonb||jsonb
metadata|change_packages|completed_at|8||YES|timestamp with time zone||timestamptz
metadata|change_packages|applied_at|9||YES|timestamp with time zone||timestamptz
metadata|change_packages|source_instance_id|10||YES|character varying|120|varchar
metadata|change_packages|created_by|11||YES|uuid||uuid
metadata|change_packages|updated_by|12||YES|uuid||uuid
metadata|change_packages|created_at|13|now()|NO|timestamp with time zone||timestamptz
metadata|change_packages|updated_at|14|now()|NO|timestamp with time zone||timestamptz
metadata|choice_items|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|choice_items|choice_list_id|2||NO|uuid||uuid
metadata|choice_items|value|3||NO|character varying|255|varchar
metadata|choice_items|label|4||NO|character varying|255|varchar
metadata|choice_items|position|5|0|NO|integer||int4
metadata|choice_items|color|6||YES|character varying|50|varchar
metadata|choice_items|icon|7||YES|character varying|100|varchar
metadata|choice_items|is_default|8|false|NO|boolean||bool
metadata|choice_items|is_active|9|true|NO|boolean||bool
metadata|choice_items|created_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|choice_lists|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|choice_lists|code|2||NO|character varying|100|varchar
metadata|choice_lists|name|3||NO|character varying|255|varchar
metadata|choice_lists|description|4||YES|text||text
metadata|choice_lists|is_system|5|false|NO|boolean||bool
metadata|choice_lists|is_active|6|true|NO|boolean||bool
metadata|choice_lists|created_at|7|now()|NO|timestamp with time zone||timestamptz
metadata|choice_lists|updated_at|8|now()|NO|timestamp with time zone||timestamptz
metadata|collection_constraints|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|collection_constraints|collection_id|2||NO|uuid||uuid
metadata|collection_constraints|code|3||NO|character varying|100|varchar
metadata|collection_constraints|name|4||NO|character varying|255|varchar
metadata|collection_constraints|constraint_type|5||NO|character varying|20|varchar
metadata|collection_constraints|columns|6||YES|ARRAY||_text
metadata|collection_constraints|expression|7||YES|text||text
metadata|collection_constraints|is_active|8|true|NO|boolean||bool
metadata|collection_constraints|metadata|9|'{}'::jsonb|NO|jsonb||jsonb
metadata|collection_constraints|created_by|10||YES|uuid||uuid
metadata|collection_constraints|updated_by|11||YES|uuid||uuid
metadata|collection_constraints|created_at|12|now()|NO|timestamp with time zone||timestamptz
metadata|collection_constraints|updated_at|13|now()|NO|timestamp with time zone||timestamptz
metadata|collection_definition_revisions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|collection_definition_revisions|collection_id|2||NO|uuid||uuid
metadata|collection_definition_revisions|revision|3||NO|integer||int4
metadata|collection_definition_revisions|status|4||NO|character varying|20|varchar
metadata|collection_definition_revisions|payload|5|'{}'::jsonb|NO|jsonb||jsonb
metadata|collection_definition_revisions|created_by|6||YES|uuid||uuid
metadata|collection_definition_revisions|published_by|7||YES|uuid||uuid
metadata|collection_definition_revisions|published_at|8||YES|timestamp with time zone||timestamptz
metadata|collection_definition_revisions|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|collection_definitions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|collection_definitions|code|2||NO|character varying|100|varchar
metadata|collection_definitions|name|3||NO|character varying|255|varchar
metadata|collection_definitions|plural_name|4||YES|character varying|255|varchar
metadata|collection_definitions|description|5||YES|text||text
metadata|collection_definitions|category|6||YES|character varying|100|varchar
metadata|collection_definitions|application_id|7||NO|uuid||uuid
metadata|collection_definitions|owner_type|8|'custom'::character varying|NO|character varying|20|varchar
metadata|collection_definitions|table_name|9||NO|character varying|100|varchar
metadata|collection_definitions|label_property|10|'name'::character varying|NO|character varying|100|varchar
metadata|collection_definitions|secondary_label_property|11||YES|character varying|100|varchar
metadata|collection_definitions|is_extensible|12|true|NO|boolean||bool
metadata|collection_definitions|is_audited|13|true|NO|boolean||bool
metadata|collection_definitions|enable_versioning|14|false|NO|boolean||bool
metadata|collection_definitions|enable_attachments|15|true|NO|boolean||bool
metadata|collection_definitions|enable_activity_log|16|true|NO|boolean||bool
metadata|collection_definitions|enable_search|17|true|NO|boolean||bool
metadata|collection_definitions|is_system|18|false|NO|boolean||bool
metadata|collection_definitions|is_active|19|true|NO|boolean||bool
metadata|collection_definitions|icon|20||YES|character varying|100|varchar
metadata|collection_definitions|color|21||YES|character varying|50|varchar
metadata|collection_definitions|default_access|22|'read'::character varying|NO|character varying|20|varchar
metadata|collection_definitions|metadata|23|'{}'::jsonb|NO|jsonb||jsonb
metadata|collection_definitions|created_by|24||YES|uuid||uuid
metadata|collection_definitions|updated_by|25||YES|uuid||uuid
metadata|collection_definitions|created_at|26|now()|NO|timestamp with time zone||timestamptz
metadata|collection_definitions|updated_at|27|now()|NO|timestamp with time zone||timestamptz
metadata|collection_definitions|owner|28|'custom'::schema_owner|NO|USER-DEFINED||schema_owner
metadata|collection_definitions|sync_status|29|'synced'::sync_status|NO|USER-DEFINED||sync_status
metadata|collection_definitions|sync_error|30||YES|text||text
metadata|collection_definitions|last_synced_at|31||YES|timestamp with time zone||timestamptz
metadata|collection_definitions|physical_checksum|32||YES|character varying|64|varchar
metadata|collection_definitions|is_locked|33|false|NO|boolean||bool
metadata|collection_definitions|platform_version|34||YES|character varying|20|varchar
metadata|collection_definitions|status|35|'draft'::character varying|NO|character varying|20|varchar
metadata|collection_definitions|current_revision_id|36||YES|uuid||uuid
metadata|collection_definitions|published_at|37||YES|timestamp with time zone||timestamptz
metadata|collection_definitions|source|38|'custom'::character varying|NO|character varying|120|varchar
metadata|collection_definitions|secure_fields_by_default|39|true|NO|boolean||bool
metadata|collection_indexes|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|collection_indexes|collection_id|2||NO|uuid||uuid
metadata|collection_indexes|code|3||NO|character varying|100|varchar
metadata|collection_indexes|name|4||NO|character varying|255|varchar
metadata|collection_indexes|index_type|5|'btree'::character varying|NO|character varying|20|varchar
metadata|collection_indexes|columns|6||NO|ARRAY||_text
metadata|collection_indexes|is_unique|7|false|NO|boolean||bool
metadata|collection_indexes|is_active|8|true|NO|boolean||bool
metadata|collection_indexes|metadata|9|'{}'::jsonb|NO|jsonb||jsonb
metadata|collection_indexes|created_by|10||YES|uuid||uuid
metadata|collection_indexes|updated_by|11||YES|uuid||uuid
metadata|collection_indexes|created_at|12|now()|NO|timestamp with time zone||timestamptz
metadata|collection_indexes|updated_at|13|now()|NO|timestamp with time zone||timestamptz
metadata|dependent_review_queue|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|dependent_review_queue|collection_id|2||NO|uuid||uuid
metadata|dependent_review_queue|collection_code|3||NO|character varying|120|varchar
metadata|dependent_review_queue|property_code|4||NO|character varying|120|varchar
metadata|dependent_review_queue|property_id|5||YES|uuid||uuid
metadata|dependent_review_queue|change_kind|6||NO|character varying|16|varchar
metadata|dependent_review_queue|classification|7||NO|character varying|16|varchar
metadata|dependent_review_queue|entity_type|8||NO|character varying|32|varchar
metadata|dependent_review_queue|entity_id|9||NO|uuid||uuid
metadata|dependent_review_queue|entity_label|10||NO|character varying|255|varchar
metadata|dependent_review_queue|href|11||YES|text||text
metadata|dependent_review_queue|reason|12||NO|text||text
metadata|dependent_review_queue|status|13|'needs_review'::character varying|NO|character varying|20|varchar
metadata|dependent_review_queue|created_by|14||YES|uuid||uuid
metadata|dependent_review_queue|created_at|15|now()|NO|timestamp with time zone||timestamptz
metadata|dependent_review_queue|resolved_by|16||YES|uuid||uuid
metadata|dependent_review_queue|resolved_at|17||YES|timestamp with time zone||timestamptz
metadata|dependent_review_queue|resolution_note|18||YES|text||text
metadata|display_rule_revisions|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|display_rule_revisions|display_rule_id|2||NO|uuid||uuid
metadata|display_rule_revisions|revision|3||NO|integer||int4
metadata|display_rule_revisions|status|4||NO|character varying|20|varchar
metadata|display_rule_revisions|payload|5|'{}'::jsonb|NO|jsonb||jsonb
metadata|display_rule_revisions|created_by|6||YES|uuid||uuid
metadata|display_rule_revisions|published_by|7||YES|uuid||uuid
metadata|display_rule_revisions|published_at|8||YES|timestamp with time zone||timestamptz
metadata|display_rule_revisions|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|display_rules|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|display_rules|name|2||NO|character varying|255|varchar
metadata|display_rules|description|3||YES|text||text
metadata|display_rules|collection_id|4||NO|uuid||uuid
metadata|display_rules|application_id|5||NO|uuid||uuid
metadata|display_rules|condition|6|'{}'::jsonb|NO|jsonb||jsonb
metadata|display_rules|actions|7|'[]'::jsonb|NO|jsonb||jsonb
metadata|display_rules|priority|8|100|NO|integer||int4
metadata|display_rules|is_active|9|true|NO|boolean||bool
metadata|display_rules|status|10|'draft'::character varying|NO|character varying|20|varchar
metadata|display_rules|current_revision_id|11||YES|uuid||uuid
metadata|display_rules|published_at|12||YES|timestamp with time zone||timestamptz
metadata|display_rules|created_by|13||YES|uuid||uuid
metadata|display_rules|updated_by|14||YES|uuid||uuid
metadata|display_rules|created_at|15|now()|NO|timestamp with time zone||timestamptz
metadata|display_rules|updated_at|16|now()|NO|timestamp with time zone||timestamptz
metadata|display_rules|source|17|'custom'::character varying|NO|character varying|120|varchar
metadata|form_definitions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|form_definitions|name|2||NO|character varying||varchar
metadata|form_definitions|collection_id|3||NO|uuid||uuid
metadata|form_definitions|isDefault|4|false|NO|boolean||bool
metadata|form_definitions|layout|5||YES|jsonb||jsonb
metadata|form_definitions|createdAt|6|now()|NO|timestamp without time zone||timestamp
metadata|form_definitions|updatedAt|7|now()|NO|timestamp without time zone||timestamp
metadata|form_definitions|application_id|8||NO|uuid||uuid
metadata|form_definitions|status|9|'draft'::character varying|NO|character varying|20|varchar
metadata|form_definitions|current_version_id|10||YES|uuid||uuid
metadata|form_definitions|published_at|11||YES|timestamp with time zone||timestamptz
metadata|form_definitions|source|12|'custom'::character varying|NO|character varying|120|varchar
metadata|form_versions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|form_versions|form_id|2||NO|uuid||uuid
metadata|form_versions|version|3||NO|integer||int4
metadata|form_versions|layout|4||NO|jsonb||jsonb
metadata|form_versions|createdAt|5|now()|NO|timestamp without time zone||timestamp
metadata|form_versions|status|6|'draft'::character varying|NO|character varying|20|varchar
metadata|form_versions|published_by|7||YES|uuid||uuid
metadata|form_versions|published_at|8||YES|timestamp with time zone||timestamptz
metadata|instance_branding|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|instance_branding|default_theme_id|2||YES|uuid||uuid
metadata|instance_branding|theme_overrides|3|'{}'::jsonb|NO|jsonb||jsonb
metadata|instance_branding|logo_url|4||YES|character varying|500|varchar
metadata|instance_branding|logo_dark_url|5||YES|character varying|500|varchar
metadata|instance_branding|favicon_url|6||YES|character varying|500|varchar
metadata|instance_branding|primary_color|7||YES|character varying|7|varchar
metadata|instance_branding|accent_color|8||YES|character varying|7|varchar
metadata|instance_branding|custom_css|9||YES|text||text
metadata|instance_branding|allow_user_customization|10|true|NO|boolean||bool
metadata|instance_branding|created_at|11|now()|NO|timestamp without time zone||timestamp
metadata|instance_branding|updated_at|12|now()|NO|timestamp without time zone||timestamp
metadata|locales|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|locales|code|2||NO|character varying|20|varchar
metadata|locales|name|3||NO|character varying|255|varchar
metadata|locales|direction|4|'ltr'::character varying|NO|character varying|5|varchar
metadata|locales|metadata|5|'{}'::jsonb|NO|jsonb||jsonb
metadata|locales|is_active|6|true|NO|boolean||bool
metadata|locales|created_by|7||YES|uuid||uuid
metadata|locales|updated_by|8||YES|uuid||uuid
metadata|locales|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|locales|updated_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|localization_bundles|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|localization_bundles|locale_id|2||YES|uuid||uuid
metadata|localization_bundles|locale_code|3||NO|character varying|20|varchar
metadata|localization_bundles|entries|4|'{}'::jsonb|NO|jsonb||jsonb
metadata|localization_bundles|checksum|5||NO|character varying|64|varchar
metadata|localization_bundles|published_by|6||YES|uuid||uuid
metadata|localization_bundles|published_at|7||YES|timestamp with time zone||timestamptz
metadata|localization_bundles|metadata|8|'{}'::jsonb|NO|jsonb||jsonb
metadata|localization_bundles|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|localization_bundles|updated_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|module_security|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|module_security|module_id|2||NO|uuid||uuid
metadata|module_security|role_id|3||NO|uuid||uuid
metadata|module_security|canView|4|true|NO|boolean||bool
metadata|modules|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|modules|key|2||NO|character varying||varchar
metadata|modules|slug|3||YES|character varying||varchar
metadata|modules|label|4||NO|character varying||varchar
metadata|modules|icon|5||YES|character varying||varchar
metadata|modules|sort_order|6|0|NO|integer||int4
metadata|modules|type|7|'list'::character varying|NO|character varying||varchar
metadata|modules|route|8||YES|character varying||varchar
metadata|modules|target_config|9||YES|jsonb||jsonb
metadata|modules|application_key|10||YES|character varying||varchar
metadata|modules|is_active|11|true|NO|boolean||bool
metadata|modules|createdAt|12|now()|NO|timestamp without time zone||timestamp
metadata|modules|updatedAt|13|now()|NO|timestamp without time zone||timestamp
metadata|nav_nodes|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|nav_nodes|profile_id|2||NO|uuid||uuid
metadata|nav_nodes|key|3||NO|character varying||varchar
metadata|nav_nodes|label|4||NO|character varying||varchar
metadata|nav_nodes|icon|5||YES|character varying||varchar
metadata|nav_nodes|type|6||NO|character varying||varchar
metadata|nav_nodes|module_key|7||YES|character varying||varchar
metadata|nav_nodes|url|8||YES|character varying||varchar
metadata|nav_nodes|parent_id|9||YES|uuid||uuid
metadata|nav_nodes|order|10|0|NO|integer||int4
metadata|nav_nodes|is_visible|11|true|NO|boolean||bool
metadata|nav_nodes|visibility|12||YES|jsonb||jsonb
metadata|nav_nodes|context_tags|13||YES|text||text
metadata|nav_nodes|created_at|14|now()|NO|timestamp without time zone||timestamp
metadata|nav_nodes|updated_at|15|now()|NO|timestamp without time zone||timestamp
metadata|nav_patches|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|nav_patches|profile_id|2||NO|uuid||uuid
metadata|nav_patches|operation|3||NO|character varying||varchar
metadata|nav_patches|target_node_key|4||NO|character varying||varchar
metadata|nav_patches|payload|5||YES|jsonb||jsonb
metadata|nav_patches|priority|6|0|NO|integer||int4
metadata|nav_patches|description|7||YES|character varying||varchar
metadata|nav_patches|is_active|8|true|NO|boolean||bool
metadata|nav_patches|created_at|9|now()|NO|timestamp without time zone||timestamp
metadata|nav_patches|updated_at|10|now()|NO|timestamp without time zone||timestamp
metadata|navigation_module_revisions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|navigation_module_revisions|navigation_module_id|2||NO|uuid||uuid
metadata|navigation_module_revisions|revision|3||NO|integer||int4
metadata|navigation_module_revisions|status|4||NO|character varying|20|varchar
metadata|navigation_module_revisions|layout|5|'{}'::jsonb|NO|jsonb||jsonb
metadata|navigation_module_revisions|created_by|6||YES|uuid||uuid
metadata|navigation_module_revisions|published_by|7||YES|uuid||uuid
metadata|navigation_module_revisions|published_at|8||YES|timestamp with time zone||timestamptz
metadata|navigation_module_revisions|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|navigation_modules|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|navigation_modules|code|2||NO|character varying|120|varchar
metadata|navigation_modules|name|3||NO|character varying|255|varchar
metadata|navigation_modules|description|4||YES|text||text
metadata|navigation_modules|metadata|5|'{}'::jsonb|NO|jsonb||jsonb
metadata|navigation_modules|is_active|6|true|NO|boolean||bool
metadata|navigation_modules|created_by|7||YES|uuid||uuid
metadata|navigation_modules|updated_by|8||YES|uuid||uuid
metadata|navigation_modules|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|navigation_modules|updated_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|navigation_modules|application_id|11||NO|uuid||uuid
metadata|navigation_variants|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|navigation_variants|navigation_module_id|2||NO|uuid||uuid
metadata|navigation_variants|scope|3||NO|character varying|20|varchar
metadata|navigation_variants|scope_key|4||YES|character varying|120|varchar
metadata|navigation_variants|priority|5|100|NO|integer||int4
metadata|navigation_variants|is_active|6|true|NO|boolean||bool
metadata|navigation_variants|created_by|7||YES|uuid||uuid
metadata|navigation_variants|updated_by|8||YES|uuid||uuid
metadata|navigation_variants|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|navigation_variants|updated_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|pack_install_locks|lock_key|1||NO|character varying|100|varchar
metadata|pack_install_locks|lock_holder|2||YES|character varying|100|varchar
metadata|pack_install_locks|lock_acquired_at|3||YES|timestamp with time zone||timestamptz
metadata|pack_install_locks|lock_expires_at|4||YES|timestamp with time zone||timestamptz
metadata|pack_install_locks|updated_at|5|now()|NO|timestamp with time zone||timestamptz
metadata|pack_object_revisions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|pack_object_revisions|release_record_id|2||NO|uuid||uuid
metadata|pack_object_revisions|object_type|3||NO|character varying|30|varchar
metadata|pack_object_revisions|object_key|4||NO|character varying|255|varchar
metadata|pack_object_revisions|object_hash|5||NO|character varying|64|varchar
metadata|pack_object_revisions|object_id|6||YES|uuid||uuid
metadata|pack_object_revisions|content|7||NO|jsonb||jsonb
metadata|pack_object_revisions|created_by|8||YES|uuid||uuid
metadata|pack_object_revisions|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|pack_object_states|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|pack_object_states|object_type|2||NO|character varying|30|varchar
metadata|pack_object_states|object_key|3||NO|character varying|255|varchar
metadata|pack_object_states|pack_code|4||NO|character varying|200|varchar
metadata|pack_object_states|current_revision_id|5||NO|uuid||uuid
metadata|pack_object_states|current_hash|6||NO|character varying|64|varchar
metadata|pack_object_states|object_id|7||YES|uuid||uuid
metadata|pack_object_states|is_active|8|true|NO|boolean||bool
metadata|pack_object_states|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|pack_object_states|updated_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|pack_release_records|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|pack_release_records|pack_code|2||NO|character varying|200|varchar
metadata|pack_release_records|pack_release_id|3||NO|character varying|50|varchar
metadata|pack_release_records|status|4||NO|character varying|30|varchar
metadata|pack_release_records|manifest|5||NO|jsonb||jsonb
metadata|pack_release_records|artifact_sha256|6||YES|character varying|64|varchar
metadata|pack_release_records|install_summary|7|'{}'::jsonb|NO|jsonb||jsonb
metadata|pack_release_records|warnings|8|'[]'::jsonb|NO|jsonb||jsonb
metadata|pack_release_records|applied_by|9||YES|uuid||uuid
metadata|pack_release_records|applied_by_type|10|'system'::character varying|NO|character varying|20|varchar
metadata|pack_release_records|started_at|11|now()|NO|timestamp with time zone||timestamptz
metadata|pack_release_records|completed_at|12||YES|timestamp with time zone||timestamptz
metadata|pack_release_records|rollback_of_release_id|13||YES|uuid||uuid
metadata|pack_release_records|created_at|14|now()|NO|timestamp with time zone||timestamptz
metadata|pack_release_records|updated_at|15|now()|NO|timestamp with time zone||timestamptz
metadata|property_definition_revisions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|property_definition_revisions|property_id|2||NO|uuid||uuid
metadata|property_definition_revisions|revision|3||NO|integer||int4
metadata|property_definition_revisions|status|4||NO|character varying|20|varchar
metadata|property_definition_revisions|payload|5|'{}'::jsonb|NO|jsonb||jsonb
metadata|property_definition_revisions|created_by|6||YES|uuid||uuid
metadata|property_definition_revisions|published_by|7||YES|uuid||uuid
metadata|property_definition_revisions|published_at|8||YES|timestamp with time zone||timestamptz
metadata|property_definition_revisions|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|property_definitions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|property_definitions|collection_id|2||NO|uuid||uuid
metadata|property_definitions|code|3||NO|character varying|100|varchar
metadata|property_definitions|name|4||NO|character varying|255|varchar
metadata|property_definitions|description|5||YES|text||text
metadata|property_definitions|property_type_id|6||NO|uuid||uuid
metadata|property_definitions|column_name|7||NO|character varying|100|varchar
metadata|property_definitions|config|8|'{}'::jsonb|NO|jsonb||jsonb
metadata|property_definitions|is_required|9|false|NO|boolean||bool
metadata|property_definitions|is_unique|10|false|NO|boolean||bool
metadata|property_definitions|is_indexed|11|false|NO|boolean||bool
metadata|property_definitions|validation_rules|12|'{}'::jsonb|NO|jsonb||jsonb
metadata|property_definitions|default_value|13||YES|text||text
metadata|property_definitions|default_value_type|14|'static'::character varying|NO|character varying|50|varchar
metadata|property_definitions|position|15|0|NO|integer||int4
metadata|property_definitions|is_visible|16|true|NO|boolean||bool
metadata|property_definitions|is_readonly|17|false|NO|boolean||bool
metadata|property_definitions|display_format|18||YES|character varying|100|varchar
metadata|property_definitions|placeholder|19||YES|character varying|255|varchar
metadata|property_definitions|help_text|20||YES|text||text
metadata|property_definitions|reference_collection_id|21||YES|uuid||uuid
metadata|property_definitions|reference_display_property|22||YES|character varying|100|varchar
metadata|property_definitions|reference_filter|23||YES|jsonb||jsonb
metadata|property_definitions|choice_list_id|24||YES|uuid||uuid
metadata|property_definitions|owner_type|25|'custom'::character varying|NO|character varying|20|varchar
metadata|property_definitions|is_system|26|false|NO|boolean||bool
metadata|property_definitions|is_active|27|true|NO|boolean||bool
metadata|property_definitions|is_searchable|28|false|NO|boolean||bool
metadata|property_definitions|is_sortable|29|true|NO|boolean||bool
metadata|property_definitions|is_filterable|30|true|NO|boolean||bool
metadata|property_definitions|metadata|31|'{}'::jsonb|NO|jsonb||jsonb
metadata|property_definitions|created_by|32||YES|uuid||uuid
metadata|property_definitions|created_at|33|now()|NO|timestamp with time zone||timestamptz
metadata|property_definitions|updated_at|34|now()|NO|timestamp with time zone||timestamptz
metadata|property_definitions|owner|35|'custom'::schema_owner|NO|USER-DEFINED||schema_owner
metadata|property_definitions|sync_status|36|'synced'::sync_status|NO|USER-DEFINED||sync_status
metadata|property_definitions|sync_error|37||YES|text||text
metadata|property_definitions|is_locked|38|false|NO|boolean||bool
metadata|property_definitions|platform_version|39||YES|character varying|20|varchar
metadata|property_definitions|custom_property_prefix|40|'x_'::character varying|YES|character varying|10|varchar
metadata|property_definitions|is_phi|41|false|NO|boolean||bool
metadata|property_definitions|is_pii|42|false|NO|boolean||bool
metadata|property_definitions|is_sensitive|43|false|NO|boolean||bool
metadata|property_definitions|masking_strategy|44|'none'::character varying|NO|character varying|20|varchar
metadata|property_definitions|mask_value|45||YES|character varying|50|varchar
metadata|property_definitions|requires_break_glass|46|false|NO|boolean||bool
metadata|property_definitions|application_id|47||NO|uuid||uuid
metadata|property_definitions|status|48|'draft'::character varying|NO|character varying|20|varchar
metadata|property_definitions|current_revision_id|49||YES|uuid||uuid
metadata|property_definitions|published_at|50||YES|timestamp with time zone||timestamptz
metadata|property_definitions|behavioral_attributes|51|'{}'::jsonb|NO|jsonb||jsonb
metadata|property_definitions|source|52|'custom'::character varying|NO|character varying|120|varchar
metadata|property_types|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|property_types|code|2||NO|character varying|50|varchar
metadata|property_types|name|3||NO|character varying|100|varchar
metadata|property_types|category|4||NO|character varying|50|varchar
metadata|property_types|description|5||YES|text||text
metadata|property_types|base_type|6||NO|character varying|50|varchar
metadata|property_types|default_config|7|'{}'::jsonb|NO|jsonb||jsonb
metadata|property_types|validation_rules|8|'{}'::jsonb|NO|jsonb||jsonb
metadata|property_types|default_widget|9||YES|character varying|50|varchar
metadata|property_types|icon|10||YES|character varying|50|varchar
metadata|property_types|is_system|11|true|NO|boolean||bool
metadata|property_types|created_at|12|now()|NO|timestamp with time zone||timestamptz
metadata|schema_change_log|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|schema_change_log|entity_type|2||NO|character varying|20|varchar
metadata|schema_change_log|entity_id|3||NO|uuid||uuid
metadata|schema_change_log|entity_code|4||NO|character varying|100|varchar
metadata|schema_change_log|change_type|5||NO|character varying|20|varchar
metadata|schema_change_log|change_source|6||NO|character varying|20|varchar
metadata|schema_change_log|before_state|7||YES|jsonb||jsonb
metadata|schema_change_log|after_state|8||YES|jsonb||jsonb
metadata|schema_change_log|ddl_statements|9||YES|ARRAY||_text
metadata|schema_change_log|performed_by|10||YES|uuid||uuid
metadata|schema_change_log|performed_by_type|11||NO|character varying|20|varchar
metadata|schema_change_log|success|12|true|NO|boolean||bool
metadata|schema_change_log|error_message|13||YES|text||text
metadata|schema_change_log|is_rolled_back|14|false|YES|boolean||bool
metadata|schema_change_log|rolled_back_at|15||YES|timestamp with time zone||timestamptz
metadata|schema_change_log|rolled_back_by|16||YES|uuid||uuid
metadata|schema_change_log|rollback_reason|17||YES|text||text
metadata|schema_change_log|created_at|18|now()|NO|timestamp with time zone||timestamptz
metadata|schema_sync_state|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|schema_sync_state|sync_lock_holder|2||YES|character varying|100|varchar
metadata|schema_sync_state|sync_lock_acquired_at|3||YES|timestamp with time zone||timestamptz
metadata|schema_sync_state|sync_lock_expires_at|4||YES|timestamp with time zone||timestamptz
metadata|schema_sync_state|last_full_sync_at|5||YES|timestamp with time zone||timestamptz
metadata|schema_sync_state|last_full_sync_duration_ms|6||YES|integer||int4
metadata|schema_sync_state|last_full_sync_result|7||YES|character varying|20|varchar
metadata|schema_sync_state|last_drift_check_at|8||YES|timestamp with time zone||timestamptz
metadata|schema_sync_state|drift_detected|9|false|YES|boolean||bool
metadata|schema_sync_state|drift_details|10||YES|jsonb||jsonb
metadata|schema_sync_state|total_collections|11|0|YES|integer||int4
metadata|schema_sync_state|total_properties|12|0|YES|integer||int4
metadata|schema_sync_state|orphaned_tables|13|0|YES|integer||int4
metadata|schema_sync_state|orphaned_columns|14|0|YES|integer||int4
metadata|schema_sync_state|updated_at|15|now()|YES|timestamp with time zone||timestamptz
metadata|search_dictionaries|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|search_dictionaries|code|2||NO|character varying|120|varchar
metadata|search_dictionaries|name|3||NO|character varying|255|varchar
metadata|search_dictionaries|locale|4|'en'::character varying|NO|character varying|20|varchar
metadata|search_dictionaries|entries|5|'[]'::jsonb|NO|jsonb||jsonb
metadata|search_dictionaries|metadata|6|'{}'::jsonb|NO|jsonb||jsonb
metadata|search_dictionaries|is_active|7|true|NO|boolean||bool
metadata|search_dictionaries|created_by|8||YES|uuid||uuid
metadata|search_dictionaries|updated_by|9||YES|uuid||uuid
metadata|search_dictionaries|created_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|search_dictionaries|updated_at|11|now()|NO|timestamp with time zone||timestamptz
metadata|search_experiences|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|search_experiences|code|2||NO|character varying|120|varchar
metadata|search_experiences|name|3||NO|character varying|255|varchar
metadata|search_experiences|description|4||YES|text||text
metadata|search_experiences|scope|5||NO|character varying|20|varchar
metadata|search_experiences|scope_key|6||YES|character varying|120|varchar
metadata|search_experiences|config|7|'{}'::jsonb|NO|jsonb||jsonb
metadata|search_experiences|metadata|8|'{}'::jsonb|NO|jsonb||jsonb
metadata|search_experiences|is_active|9|true|NO|boolean||bool
metadata|search_experiences|created_by|10||YES|uuid||uuid
metadata|search_experiences|updated_by|11||YES|uuid||uuid
metadata|search_experiences|created_at|12|now()|NO|timestamp with time zone||timestamptz
metadata|search_experiences|updated_at|13|now()|NO|timestamp with time zone||timestamptz
metadata|search_index_state|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|search_index_state|collection_code|2||NO|character varying|120|varchar
metadata|search_index_state|status|3|'idle'::character varying|NO|character varying|20|varchar
metadata|search_index_state|last_indexed_at|4||YES|timestamp with time zone||timestamptz
metadata|search_index_state|last_cursor|5||YES|character varying|200|varchar
metadata|search_index_state|stats|6|'{}'::jsonb|NO|jsonb||jsonb
metadata|search_index_state|updated_at|7|now()|NO|timestamp with time zone||timestamptz
metadata|search_sources|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|search_sources|code|2||NO|character varying|120|varchar
metadata|search_sources|name|3||NO|character varying|255|varchar
metadata|search_sources|description|4||YES|text||text
metadata|search_sources|collection_code|5||NO|character varying|120|varchar
metadata|search_sources|config|6|'{}'::jsonb|NO|jsonb||jsonb
metadata|search_sources|metadata|7|'{}'::jsonb|NO|jsonb||jsonb
metadata|search_sources|is_active|8|true|NO|boolean||bool
metadata|search_sources|created_by|9||YES|uuid||uuid
metadata|search_sources|updated_by|10||YES|uuid||uuid
metadata|search_sources|created_at|11|now()|NO|timestamp with time zone||timestamptz
metadata|search_sources|updated_at|12|now()|NO|timestamp with time zone||timestamptz
metadata|theme_definitions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|theme_definitions|code|2||NO|character varying||varchar
metadata|theme_definitions|name|3||NO|character varying||varchar
metadata|theme_definitions|description|4||YES|text||text
metadata|theme_definitions|config|5|'{}'::jsonb|NO|jsonb||jsonb
metadata|theme_definitions|theme_type|6|'custom'::character varying|NO|character varying||varchar
metadata|theme_definitions|contrast_level|7|'normal'::character varying|NO|character varying||varchar
metadata|theme_definitions|color_scheme|8|'dark'::character varying|NO|character varying||varchar
metadata|theme_definitions|is_default|9|false|NO|boolean||bool
metadata|theme_definitions|is_active|10|true|NO|boolean||bool
metadata|theme_definitions|is_deletable|11|true|NO|boolean||bool
metadata|theme_definitions|created_by|12||YES|uuid||uuid
metadata|theme_definitions|created_at|13|now()|NO|timestamp without time zone||timestamp
metadata|theme_definitions|updated_at|14|now()|NO|timestamp without time zone||timestamp
metadata|translation_keys|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|translation_keys|namespace|2||NO|character varying|120|varchar
metadata|translation_keys|key|3||NO|character varying|200|varchar
metadata|translation_keys|default_text|4||NO|text||text
metadata|translation_keys|description|5||YES|text||text
metadata|translation_keys|metadata|6|'{}'::jsonb|NO|jsonb||jsonb
metadata|translation_keys|is_active|7|true|NO|boolean||bool
metadata|translation_keys|created_by|8||YES|uuid||uuid
metadata|translation_keys|updated_by|9||YES|uuid||uuid
metadata|translation_keys|created_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|translation_keys|updated_at|11|now()|NO|timestamp with time zone||timestamptz
metadata|translation_requests|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|translation_requests|locale_id|2||YES|uuid||uuid
metadata|translation_requests|translation_key_id|3||YES|uuid||uuid
metadata|translation_requests|status|4|'pending'::character varying|NO|character varying|20|varchar
metadata|translation_requests|requested_by|5||YES|uuid||uuid
metadata|translation_requests|reviewer_ids|6|'[]'::jsonb|NO|jsonb||jsonb
metadata|translation_requests|due_at|7||YES|timestamp with time zone||timestamptz
metadata|translation_requests|workflow_instance_id|8||YES|uuid||uuid
metadata|translation_requests|metadata|9|'{}'::jsonb|NO|jsonb||jsonb
metadata|translation_requests|updated_by|10||YES|uuid||uuid
metadata|translation_requests|created_at|11|now()|NO|timestamp with time zone||timestamptz
metadata|translation_requests|updated_at|12|now()|NO|timestamp with time zone||timestamptz
metadata|translation_values|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|translation_values|translation_key_id|2||YES|uuid||uuid
metadata|translation_values|locale_id|3||YES|uuid||uuid
metadata|translation_values|text|4||NO|text||text
metadata|translation_values|status|5|'draft'::character varying|NO|character varying|20|varchar
metadata|translation_values|metadata|6|'{}'::jsonb|NO|jsonb||jsonb
metadata|translation_values|is_active|7|true|NO|boolean||bool
metadata|translation_values|created_by|8||YES|uuid||uuid
metadata|translation_values|updated_by|9||YES|uuid||uuid
metadata|translation_values|created_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|translation_values|updated_at|11|now()|NO|timestamp with time zone||timestamptz
metadata|user_theme_preferences|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|user_theme_preferences|user_id|2||NO|uuid||uuid
metadata|user_theme_preferences|theme_id|3||YES|uuid||uuid
metadata|user_theme_preferences|custom_overrides|4|'{}'::jsonb|NO|jsonb||jsonb
metadata|user_theme_preferences|color_scheme|5|'auto'::character varying|NO|character varying||varchar
metadata|user_theme_preferences|auto_dark_mode|6|true|NO|boolean||bool
metadata|user_theme_preferences|respect_reduced_motion|7|true|NO|boolean||bool
metadata|user_theme_preferences|preference_source|8|'manual'::character varying|NO|character varying||varchar
metadata|user_theme_preferences|created_at|9|now()|NO|timestamp without time zone||timestamp
metadata|user_theme_preferences|updated_at|10|now()|NO|timestamp without time zone||timestamp
metadata|view_definition_revisions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|view_definition_revisions|view_definition_id|2||NO|uuid||uuid
metadata|view_definition_revisions|revision|3||NO|integer||int4
metadata|view_definition_revisions|status|4||NO|character varying|20|varchar
metadata|view_definition_revisions|layout|5|'{}'::jsonb|NO|jsonb||jsonb
metadata|view_definition_revisions|widget_bindings|6|'{}'::jsonb|NO|jsonb||jsonb
metadata|view_definition_revisions|actions|7|'{}'::jsonb|NO|jsonb||jsonb
metadata|view_definition_revisions|created_by|8||YES|uuid||uuid
metadata|view_definition_revisions|published_by|9||YES|uuid||uuid
metadata|view_definition_revisions|published_at|10||YES|timestamp with time zone||timestamptz
metadata|view_definition_revisions|created_at|11|now()|NO|timestamp with time zone||timestamptz
metadata|view_definitions|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|view_definitions|code|2||NO|character varying|120|varchar
metadata|view_definitions|name|3||NO|character varying|255|varchar
metadata|view_definitions|description|4||YES|text||text
metadata|view_definitions|kind|5||NO|character varying|20|varchar
metadata|view_definitions|target_collection_code|6||YES|character varying|120|varchar
metadata|view_definitions|metadata|7|'{}'::jsonb|NO|jsonb||jsonb
metadata|view_definitions|is_active|8|true|NO|boolean||bool
metadata|view_definitions|created_by|9||YES|uuid||uuid
metadata|view_definitions|updated_by|10||YES|uuid||uuid
metadata|view_definitions|created_at|11|now()|NO|timestamp with time zone||timestamptz
metadata|view_definitions|updated_at|12|now()|NO|timestamp with time zone||timestamptz
metadata|view_definitions|application_id|13||NO|uuid||uuid
metadata|view_definitions|source|14|'custom'::character varying|NO|character varying|120|varchar
metadata|view_variants|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|view_variants|view_definition_id|2||NO|uuid||uuid
metadata|view_variants|scope|3||NO|character varying|20|varchar
metadata|view_variants|scope_key|4||YES|character varying|120|varchar
metadata|view_variants|priority|5|100|NO|integer||int4
metadata|view_variants|is_active|6|true|NO|boolean||bool
metadata|view_variants|created_by|7||YES|uuid||uuid
metadata|view_variants|updated_by|8||YES|uuid||uuid
metadata|view_variants|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|view_variants|updated_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|widget_catalog|id|1|uuid_generate_v4()|NO|uuid||uuid
metadata|widget_catalog|code|2||NO|character varying|120|varchar
metadata|widget_catalog|name|3||NO|character varying|255|varchar
metadata|widget_catalog|kind|4||NO|character varying|50|varchar
metadata|widget_catalog|contract|5|'{}'::jsonb|NO|jsonb||jsonb
metadata|widget_catalog|is_active|6|true|NO|boolean||bool
metadata|widget_catalog|created_at|7|now()|NO|timestamp with time zone||timestamptz
metadata|widget_catalog|updated_at|8|now()|NO|timestamp with time zone||timestamptz
metadata|widget_catalog|application_id|9||NO|uuid||uuid
metadata|workspace_definitions|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|workspace_definitions|code|2||NO|character varying|120|varchar
metadata|workspace_definitions|name|3||NO|character varying|255|varchar
metadata|workspace_definitions|description|4||YES|text||text
metadata|workspace_definitions|application_id|5||NO|uuid||uuid
metadata|workspace_definitions|default_collection_id|6||YES|uuid||uuid
metadata|workspace_definitions|theme_code|7||YES|character varying|120|varchar
metadata|workspace_definitions|source|8|'custom'::character varying|NO|character varying|64|varchar
metadata|workspace_definitions|status|9|'draft'::character varying|NO|character varying|20|varchar
metadata|workspace_definitions|is_active|10|false|NO|boolean||bool
metadata|workspace_definitions|published_at|11||YES|timestamp with time zone||timestamptz
metadata|workspace_definitions|created_by|12||YES|uuid||uuid
metadata|workspace_definitions|updated_by|13||YES|uuid||uuid
metadata|workspace_definitions|created_at|14|now()|NO|timestamp with time zone||timestamptz
metadata|workspace_definitions|updated_at|15|now()|NO|timestamp with time zone||timestamptz
metadata|workspace_pages|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|workspace_pages|workspace_id|2||NO|uuid||uuid
metadata|workspace_pages|code|3||NO|character varying|120|varchar
metadata|workspace_pages|name|4||NO|character varying|255|varchar
metadata|workspace_pages|kind|5||NO|character varying|20|varchar
metadata|workspace_pages|position|6|0|NO|integer||int4
metadata|workspace_pages|layout|7|'[]'::jsonb|NO|jsonb||jsonb
metadata|workspace_pages|source|8|'custom'::character varying|NO|character varying|64|varchar
metadata|workspace_pages|collection_id|9||YES|uuid||uuid
metadata|workspace_pages|created_at|10|now()|NO|timestamp with time zone||timestamptz
metadata|workspace_pages|updated_at|11|now()|NO|timestamp with time zone||timestamptz
metadata|workspace_variants|id|1|gen_random_uuid()|NO|uuid||uuid
metadata|workspace_variants|workspace_id|2||NO|uuid||uuid
metadata|workspace_variants|page_id|3||NO|uuid||uuid
metadata|workspace_variants|scope|4||NO|character varying|16|varchar
metadata|workspace_variants|scope_ref|5||YES|character varying|255|varchar
metadata|workspace_variants|priority|6|100|NO|integer||int4
metadata|workspace_variants|layout|7|'[]'::jsonb|NO|jsonb||jsonb
metadata|workspace_variants|created_by|8||YES|uuid||uuid
metadata|workspace_variants|created_at|9|now()|NO|timestamp with time zone||timestamptz
metadata|workspace_variants|updated_at|10|now()|NO|timestamp with time zone||timestamptz
notify|device_tokens|id|1|gen_random_uuid()|NO|uuid||uuid
notify|device_tokens|user_id|2||NO|uuid||uuid
notify|device_tokens|token|3||NO|text||text
notify|device_tokens|platform|4||NO|character varying|20|varchar
notify|device_tokens|device_name|5||YES|character varying|255|varchar
notify|device_tokens|device_model|6||YES|character varying|100|varchar
notify|device_tokens|os_version|7||YES|character varying|50|varchar
notify|device_tokens|app_version|8||YES|character varying|50|varchar
notify|device_tokens|is_active|9|true|YES|boolean||bool
notify|device_tokens|last_used_at|10||YES|timestamp with time zone||timestamptz
notify|device_tokens|created_at|11|now()|YES|timestamp with time zone||timestamptz
notify|device_tokens|updated_at|12|now()|YES|timestamp with time zone||timestamptz
notify|in_app_notifications|id|1|gen_random_uuid()|NO|uuid||uuid
notify|in_app_notifications|user_id|2||NO|uuid||uuid
notify|in_app_notifications|title|3||NO|character varying|255|varchar
notify|in_app_notifications|body|4||NO|text||text
notify|in_app_notifications|icon|5||YES|character varying|100|varchar
notify|in_app_notifications|priority|6|'medium'::character varying|YES|character varying|20|varchar
notify|in_app_notifications|actions|7||YES|jsonb||jsonb
notify|in_app_notifications|deep_link|8||YES|character varying|500|varchar
notify|in_app_notifications|record_id|9||YES|uuid||uuid
notify|in_app_notifications|collection_id|10||YES|uuid||uuid
notify|in_app_notifications|read|11|false|YES|boolean||bool
notify|in_app_notifications|read_at|12||YES|timestamp with time zone||timestamptz
notify|in_app_notifications|dismissed|13|false|YES|boolean||bool
notify|in_app_notifications|dismissed_at|14||YES|timestamp with time zone||timestamptz
notify|in_app_notifications|expires_at|15||YES|timestamp with time zone||timestamptz
notify|in_app_notifications|created_at|16|now()|YES|timestamp with time zone||timestamptz
notify|notification_history|id|1|gen_random_uuid()|NO|uuid||uuid
notify|notification_history|notification_queue_id|2||YES|uuid||uuid
notify|notification_history|channel|3||NO|character varying|20|varchar
notify|notification_history|recipient_id|4||NO|uuid||uuid
notify|notification_history|sent_at|5||YES|timestamp with time zone||timestamptz
notify|notification_history|delivered_at|6||YES|timestamp with time zone||timestamptz
notify|notification_history|opened_at|7||YES|timestamp with time zone||timestamptz
notify|notification_history|clicked_at|8||YES|timestamp with time zone||timestamptz
notify|notification_history|failed_at|9||YES|timestamp with time zone||timestamptz
notify|notification_history|error_message|10||YES|text||text
notify|notification_history|provider_id|11||YES|character varying|255|varchar
notify|notification_history|provider_response|12||YES|jsonb||jsonb
notify|notification_history|created_at|13|now()|YES|timestamp with time zone||timestamptz
notify|notification_queue|id|1|gen_random_uuid()|NO|uuid||uuid
notify|notification_queue|template_id|2||YES|uuid||uuid
notify|notification_queue|recipient_id|3||NO|uuid||uuid
notify|notification_queue|channels|4||NO|jsonb||jsonb
notify|notification_queue|context|5|'{}'::jsonb|NO|jsonb||jsonb
notify|notification_queue|scheduled_for|6||YES|timestamp with time zone||timestamptz
notify|notification_queue|priority|7|'medium'::character varying|YES|character varying|20|varchar
notify|notification_queue|status|8|'pending'::character varying|YES|character varying|50|varchar
notify|notification_queue|attempts|9|0|YES|integer||int4
notify|notification_queue|max_attempts|10|3|YES|integer||int4
notify|notification_queue|last_error|11||YES|text||text
notify|notification_queue|created_at|12|now()|YES|timestamp with time zone||timestamptz
notify|notification_queue|updated_at|13|now()|YES|timestamp with time zone||timestamptz
notify|notification_queue|processed_at|14||YES|timestamp with time zone||timestamptz
notify|notification_queue|idempotency_key|15||YES|character varying|64|varchar
notify|notification_templates|id|1|gen_random_uuid()|NO|uuid||uuid
notify|notification_templates|name|2||NO|character varying|255|varchar
notify|notification_templates|code|3||NO|character varying|100|varchar
notify|notification_templates|description|4||YES|text||text
notify|notification_templates|category|5|'general'::character varying|NO|character varying|100|varchar
notify|notification_templates|email_subject|6||YES|character varying|500|varchar
notify|notification_templates|email_body_html|7||YES|text||text
notify|notification_templates|email_body_text|8||YES|text||text
notify|notification_templates|email_from_name|9||YES|character varying|255|varchar
notify|notification_templates|email_from_address|10||YES|character varying|255|varchar
notify|notification_templates|email_reply_to|11||YES|character varying|255|varchar
notify|notification_templates|sms_body|12||YES|character varying|320|varchar
notify|notification_templates|push_title|13||YES|character varying|255|varchar
notify|notification_templates|push_body|14||YES|character varying|500|varchar
notify|notification_templates|push_icon|15||YES|character varying|255|varchar
notify|notification_templates|push_actions|16||YES|jsonb||jsonb
notify|notification_templates|in_app_title|17||YES|character varying|255|varchar
notify|notification_templates|in_app_body|18||YES|text||text
notify|notification_templates|in_app_icon|19||YES|character varying|100|varchar
notify|notification_templates|in_app_priority|20|'medium'::character varying|YES|character varying|20|varchar
notify|notification_templates|in_app_actions|21||YES|jsonb||jsonb
notify|notification_templates|in_app_deep_link|22||YES|character varying|500|varchar
notify|notification_templates|variables|23|'[]'::jsonb|YES|jsonb||jsonb
notify|notification_templates|supported_channels|24|'["email", "in_app"]'::jsonb|YES|jsonb||jsonb
notify|notification_templates|is_system|25|false|YES|boolean||bool
notify|notification_templates|is_active|26|true|YES|boolean||bool
notify|notification_templates|created_by|27||YES|uuid||uuid
notify|notification_templates|created_at|28|now()|YES|timestamp with time zone||timestamptz
notify|notification_templates|updated_by|29||YES|uuid||uuid
notify|notification_templates|updated_at|30|now()|YES|timestamp with time zone||timestamptz
notify|user_notification_preferences|id|1|gen_random_uuid()|NO|uuid||uuid
notify|user_notification_preferences|user_id|2||NO|uuid||uuid
notify|user_notification_preferences|preferences|3|'{}'::jsonb|NO|jsonb||jsonb
notify|user_notification_preferences|quiet_hours_enabled|4|false|YES|boolean||bool
notify|user_notification_preferences|quiet_hours_start|5||YES|time without time zone||time
notify|user_notification_preferences|quiet_hours_end|6||YES|time without time zone||time
notify|user_notification_preferences|quiet_hours_timezone|7|'UTC'::character varying|YES|character varying|50|varchar
notify|user_notification_preferences|digest_mode|8|false|YES|boolean||bool
notify|user_notification_preferences|digest_frequency|9|'daily'::character varying|YES|character varying|20|varchar
notify|user_notification_preferences|digest_time|10|'08:00:00'::time without time zone|YES|time without time zone||time
notify|user_notification_preferences|email_enabled|11|true|YES|boolean||bool
notify|user_notification_preferences|sms_enabled|12|true|YES|boolean||bool
notify|user_notification_preferences|push_enabled|13|true|YES|boolean||bool
notify|user_notification_preferences|in_app_enabled|14|true|YES|boolean||bool
notify|user_notification_preferences|created_at|15|now()|YES|timestamp with time zone||timestamptz
notify|user_notification_preferences|updated_at|16|now()|YES|timestamp with time zone||timestamptz
public|access_audit_logs|id|1|uuid_generate_v4()|NO|uuid||uuid
public|access_audit_logs|user_id|2||NO|uuid||uuid
public|access_audit_logs|resource|3||NO|character varying||varchar
public|access_audit_logs|action|4||NO|character varying||varchar
public|access_audit_logs|decision|5||NO|character varying||varchar
public|access_audit_logs|context|6||YES|jsonb||jsonb
public|access_audit_logs|timestamp|7|now()|NO|timestamp without time zone||timestamp
public|access_condition_groups|id|1|uuid_generate_v4()|NO|uuid||uuid
public|access_condition_groups|rule_id|2||NO|uuid||uuid
public|access_condition_groups|logic|3||NO|character varying||varchar
public|access_conditions|id|1|uuid_generate_v4()|NO|uuid||uuid
public|access_conditions|rule_id|2||NO|uuid||uuid
public|access_conditions|field|3||NO|character varying||varchar
public|access_conditions|operator|4||NO|character varying||varchar
public|access_conditions|value|5||NO|character varying||varchar
public|access_rule_audit_logs|id|1|uuid_generate_v4()|NO|uuid||uuid
public|access_rule_audit_logs|rule_id|2||NO|uuid||uuid
public|access_rule_audit_logs|action|3||NO|character varying||varchar
public|access_rule_audit_logs|changes|4||YES|jsonb||jsonb
public|access_rule_audit_logs|performed_by|5||NO|uuid||uuid
public|access_rule_audit_logs|performedAt|6|now()|NO|timestamp without time zone||timestamp
public|audit_logs|id|1|uuid_generate_v4()|NO|uuid||uuid
public|audit_logs|user_id|2||YES|uuid||uuid
public|audit_logs|collection_code|3||YES|character varying|100|varchar
public|audit_logs|record_id|4||YES|uuid||uuid
public|audit_logs|action|5||NO|character varying|50|varchar
public|audit_logs|old_values|6||YES|jsonb||jsonb
public|audit_logs|new_values|7||YES|jsonb||jsonb
public|audit_logs|ip_address|8||YES|character varying|45|varchar
public|audit_logs|user_agent|9||YES|text||text
public|audit_logs|created_at|10|now()|NO|timestamp with time zone||timestamptz
public|audit_logs|previous_hash|11||YES|character varying|64|varchar
public|audit_logs|hash|12||YES|character varying|64|varchar
public|audit_logs|permission_code|13||YES|character varying|100|varchar
public|collection_access_rules|id|1|uuid_generate_v4()|NO|uuid||uuid
public|collection_access_rules|collection_id|2||NO|uuid||uuid
public|collection_access_rules|name|3||NO|character varying|255|varchar
public|collection_access_rules|description|4||YES|text||text
public|collection_access_rules|role_id|5||YES|uuid||uuid
public|collection_access_rules|group_id|6||YES|uuid||uuid
public|collection_access_rules|user_id|7||YES|uuid||uuid
public|collection_access_rules|can_read|8|false|NO|boolean||bool
public|collection_access_rules|can_create|9|false|NO|boolean||bool
public|collection_access_rules|can_update|10|false|NO|boolean||bool
public|collection_access_rules|can_delete|11|false|NO|boolean||bool
public|collection_access_rules|conditions|12||YES|jsonb||jsonb
public|collection_access_rules|priority|13|100|NO|integer||int4
public|collection_access_rules|is_active|14|true|NO|boolean||bool
public|collection_access_rules|created_by|15||YES|uuid||uuid
public|collection_access_rules|created_at|16|now()|NO|timestamp with time zone||timestamptz
public|collection_access_rules|updated_at|17|now()|NO|timestamp with time zone||timestamptz
public|collection_access_rules|rule_key|18||YES|character varying|120|varchar
public|collection_access_rules|metadata|19|'{}'::jsonb|NO|jsonb||jsonb
public|collection_access_rules|effect|20|'allow'::character varying|NO|character varying|10|varchar
public|computed_properties_overview|collection_code|1||YES|character varying|100|varchar
public|computed_properties_overview|collection_name|2||YES|character varying|255|varchar
public|computed_properties_overview|property_code|3||YES|character varying|100|varchar
public|computed_properties_overview|property_name|4||YES|character varying|255|varchar
public|computed_properties_overview|property_type|5||YES|character varying|50|varchar
public|computed_properties_overview|type_config|6||YES|jsonb||jsonb
public|computed_properties_overview|dependency_count|7||YES|bigint||int8
public|computed_properties_overview|cached_count|8||YES|bigint||int8
public|computed_properties_overview|stale_count|9||YES|bigint||int8
public|config_change_history|id|1|uuid_generate_v4()|NO|uuid||uuid
public|config_change_history|configType|2||NO|character varying||varchar
public|config_change_history|code|3||YES|character varying||varchar
public|config_change_history|changeType|4||NO|character varying||varchar
public|config_change_history|details|5||YES|jsonb||jsonb
public|config_change_history|userId|6||YES|character varying||varchar
public|config_change_history|changedAt|7|now()|NO|timestamp without time zone||timestamp
public|field_mappings|id|1|uuid_generate_v4()|NO|uuid||uuid
public|field_mappings|connection_id|2||YES|uuid||uuid
public|field_mappings|name|3||NO|character varying|255|varchar
public|field_mappings|source_entity|4||NO|character varying|255|varchar
public|field_mappings|target_collection_id|5||YES|uuid||uuid
public|field_mappings|direction|6|'bidirectional'::character varying|YES|character varying|20|varchar
public|field_mappings|mappings|7|'[]'::jsonb|NO|jsonb||jsonb
public|field_mappings|transformations|8|'[]'::jsonb|YES|jsonb||jsonb
public|field_mappings|filters|9||YES|jsonb||jsonb
public|field_mappings|sync_mode|10|'incremental'::character varying|YES|character varying|50|varchar
public|field_mappings|conflict_resolution|11|'source_wins'::character varying|YES|character varying|50|varchar
public|field_mappings|is_active|12|true|YES|boolean||bool
public|field_mappings|created_by|13||YES|uuid||uuid
public|field_mappings|created_at|14|now()|YES|timestamp with time zone||timestamptz
public|field_mappings|updated_at|15|now()|YES|timestamp with time zone||timestamptz
public|formula_cache|id|1|gen_random_uuid()|NO|uuid||uuid
public|formula_cache|collection_id|2||NO|uuid||uuid
public|formula_cache|property_id|3||NO|uuid||uuid
public|formula_cache|record_id|4||NO|uuid||uuid
public|formula_cache|cached_value|5||YES|jsonb||jsonb
public|formula_cache|value_type|6||NO|character varying|20|varchar
public|formula_cache|formula_hash|7||NO|character varying|64|varchar
public|formula_cache|dependencies|8|'[]'::jsonb|YES|jsonb||jsonb
public|formula_cache|calculated_at|9|now()|NO|timestamp with time zone||timestamptz
public|formula_cache|expires_at|10||YES|timestamp with time zone||timestamptz
public|formula_cache|is_stale|11|false|YES|boolean||bool
public|formula_cache|stale_reason|12||YES|character varying|100|varchar
public|formula_cache|calculation_time_ms|13||YES|integer||int4
public|formula_cache|created_at|14|now()|NO|timestamp with time zone||timestamptz
public|formula_cache|updated_at|15|now()|NO|timestamp with time zone||timestamptz
public|inline_editing_test|id|1|uuid_generate_v4()|NO|uuid||uuid
public|inline_editing_test|text_field|2||YES|character varying|255|varchar
public|inline_editing_test|long_text_field|3||YES|text||text
public|inline_editing_test|email_field|4||YES|character varying|255|varchar
public|inline_editing_test|url_field|5||YES|character varying|512|varchar
public|inline_editing_test|phone_field|6||YES|character varying|50|varchar
public|inline_editing_test|integer_field|7||YES|integer||int4
public|inline_editing_test|decimal_field|8||YES|numeric||numeric
public|inline_editing_test|currency_field|9||YES|numeric||numeric
public|inline_editing_test|percent_field|10||YES|numeric||numeric
public|inline_editing_test|date_field|11||YES|date||date
public|inline_editing_test|datetime_field|12||YES|timestamp with time zone||timestamptz
public|inline_editing_test|time_field|13||YES|time without time zone||time
public|inline_editing_test|duration_field|14||YES|integer||int4
public|inline_editing_test|boolean_field|15|false|YES|boolean||bool
public|inline_editing_test|status_field|16||YES|character varying|50|varchar
public|inline_editing_test|priority_field|17||YES|character varying|50|varchar
public|inline_editing_test|tags_field|18|'[]'::jsonb|YES|jsonb||jsonb
public|inline_editing_test|progress_field|19|0|YES|integer||int4
public|inline_editing_test|assigned_user_id|20||YES|uuid||uuid
public|inline_editing_test|created_at|21|now()|NO|timestamp with time zone||timestamptz
public|inline_editing_test|updated_at|22|now()|NO|timestamp with time zone||timestamptz
public|instance_customizations|id|1|uuid_generate_v4()|NO|uuid||uuid
public|instance_customizations|instance_id|2|'default-instance'::character varying|NO|character varying|100|varchar
public|instance_customizations|config_type|3||NO|character varying|50|varchar
public|instance_customizations|resource_key|4||NO|character varying|255|varchar
public|instance_customizations|customization_type|5|'override'::character varying|NO|character varying|20|varchar
public|instance_customizations|original_value|6||YES|jsonb||jsonb
public|instance_customizations|custom_value|7||NO|jsonb||jsonb
public|instance_customizations|description|8||YES|text||text
public|instance_customizations|is_active|9|true|NO|boolean||bool
public|instance_customizations|created_by|10||YES|uuid||uuid
public|instance_customizations|updated_by|11||YES|uuid||uuid
public|instance_customizations|created_at|12|now()|NO|timestamp with time zone||timestamptz
public|instance_customizations|updated_at|13|now()|NO|timestamp with time zone||timestamptz
public|instance_event_outbox|id|1|gen_random_uuid()|NO|uuid||uuid
public|instance_event_outbox|event_type|2||NO|character varying|120|varchar
public|instance_event_outbox|collection_code|3||YES|character varying|120|varchar
public|instance_event_outbox|record_id|4||YES|uuid||uuid
public|instance_event_outbox|payload|5||NO|jsonb||jsonb
public|instance_event_outbox|status|6|'pending'::character varying|NO|character varying|16|varchar
public|instance_event_outbox|attempts|7|0|NO|integer||int4
public|instance_event_outbox|locked_at|8||YES|timestamp with time zone||timestamptz
public|instance_event_outbox|processed_at|9||YES|timestamp with time zone||timestamptz
public|instance_event_outbox|error_message|10||YES|text||text
public|instance_event_outbox|created_at|11|now()|NO|timestamp with time zone||timestamptz
public|instance_settings|id|1|uuid_generate_v4()|NO|uuid||uuid
public|instance_settings|category|2||NO|character varying|100|varchar
public|instance_settings|key|3||NO|character varying|100|varchar
public|instance_settings|value|4||NO|jsonb||jsonb
public|instance_settings|description|5||YES|text||text
public|instance_settings|is_system|6|false|NO|boolean||bool
public|instance_settings|updated_by|7||YES|uuid||uuid
public|instance_settings|created_at|8|now()|NO|timestamp with time zone||timestamptz
public|instance_settings|updated_at|9|now()|NO|timestamp with time zone||timestamptz
public|instance_upgrade_impact|id|1|uuid_generate_v4()|NO|uuid||uuid
public|instance_upgrade_impact|instance_id|2|'default-instance'::character varying|NO|character varying|100|varchar
public|instance_upgrade_impact|upgrade_manifest_id|3||YES|uuid||uuid
public|instance_upgrade_impact|config_type|4||NO|character varying|50|varchar
public|instance_upgrade_impact|resource_key|5||NO|character varying|255|varchar
public|instance_upgrade_impact|impact_type|6||NO|character varying|50|varchar
public|instance_upgrade_impact|impact_severity|7|'low'::character varying|NO|character varying|20|varchar
public|instance_upgrade_impact|description|8||YES|text||text
public|instance_upgrade_impact|current_instance_value|9||YES|jsonb||jsonb
public|instance_upgrade_impact|new_platform_value|10||YES|jsonb||jsonb
public|instance_upgrade_impact|suggested_resolution|11||YES|text||text
public|instance_upgrade_impact|status|12|'pending_analysis'::character varying|NO|character varying|30|varchar
public|instance_upgrade_impact|resolved_by|13||YES|uuid||uuid
public|instance_upgrade_impact|resolved_at|14||YES|timestamp with time zone||timestamptz
public|instance_upgrade_impact|resolution_notes|15||YES|text||text
public|instance_upgrade_impact|created_at|16|now()|NO|timestamp with time zone||timestamptz
public|instance_upgrade_impact|updated_at|17|now()|NO|timestamp with time zone||timestamptz
public|key_metadata|kid|1||NO|text||text
public|key_metadata|provider|2||NO|text||text
public|key_metadata|kms_alias|3||YES|text||text
public|key_metadata|kms_arn|4||YES|text||text
public|key_metadata|algorithm|5|'ES256'::text|NO|text||text
public|key_metadata|state|6||NO|text||text
public|key_metadata|public_key_pem|7||NO|text||text
public|key_metadata|instance_id|8||YES|uuid||uuid
public|key_metadata|created_at|9|now()|NO|timestamp with time zone||timestamptz
public|key_metadata|activated_at|10||YES|timestamp with time zone||timestamptz
public|key_metadata|retiring_at|11||YES|timestamp with time zone||timestamptz
public|key_metadata|retired_at|12||YES|timestamp with time zone||timestamptz
public|key_metadata|compromised_at|13||YES|timestamp with time zone||timestamptz
public|migrations|id|1|nextval('migrations_id_seq'::regclass)|NO|integer||int4
public|migrations|timestamp|2||NO|bigint||int8
public|migrations|name|3||NO|character varying||varchar
public|platform_config|id|1|uuid_generate_v4()|NO|uuid||uuid
public|platform_config|key|2||NO|character varying|100|varchar
public|platform_config|value|3||NO|text||text
public|platform_config|value_type|4|'string'::character varying|NO|character varying|20|varchar
public|platform_config|description|5||YES|text||text
public|platform_config|is_system|6|false|NO|boolean||bool
public|platform_config|created_at|7|now()|NO|timestamp with time zone||timestamptz
public|platform_config|updated_at|8|now()|NO|timestamp with time zone||timestamptz
public|property_access_rules|id|1|uuid_generate_v4()|NO|uuid||uuid
public|property_access_rules|property_id|2||YES|uuid||uuid
public|property_access_rules|role_id|3||YES|uuid||uuid
public|property_access_rules|group_id|4||YES|uuid||uuid
public|property_access_rules|user_id|5||YES|uuid||uuid
public|property_access_rules|can_read|6|true|NO|boolean||bool
public|property_access_rules|can_write|7|true|NO|boolean||bool
public|property_access_rules|conditions|8||YES|jsonb||jsonb
public|property_access_rules|priority|9|100|NO|integer||int4
public|property_access_rules|is_active|10|true|NO|boolean||bool
public|property_access_rules|created_by|11||YES|uuid||uuid
public|property_access_rules|created_at|12|now()|NO|timestamp with time zone||timestamptz
public|property_access_rules|masking_strategy|13|'NONE'::character varying|NO|character varying|20|varchar
public|property_access_rules|updated_at|14|now()|NO|timestamp with time zone||timestamptz
public|property_access_rules|rule_key|15||YES|character varying|120|varchar
public|property_access_rules|metadata|16|'{}'::jsonb|NO|jsonb||jsonb
public|property_access_rules|effect|17|'allow'::character varying|NO|character varying|10|varchar
public|property_access_rules|wildcard_collection_id|18||YES|uuid||uuid
public|property_audit_logs|id|1|uuid_generate_v4()|NO|uuid||uuid
public|property_audit_logs|property_id|2||NO|uuid||uuid
public|property_audit_logs|record_id|3||NO|uuid||uuid
public|property_audit_logs|oldValue|4||YES|text||text
public|property_audit_logs|newValue|5||YES|text||text
public|property_audit_logs|changed_by|6||NO|uuid||uuid
public|property_audit_logs|changedAt|7|now()|NO|timestamp without time zone||timestamp
public|property_dependencies|id|1|gen_random_uuid()|NO|uuid||uuid
public|property_dependencies|property_id|2||NO|uuid||uuid
public|property_dependencies|collection_id|3||NO|uuid||uuid
public|property_dependencies|depends_on_property_id|4||YES|uuid||uuid
public|property_dependencies|depends_on_collection_id|5||YES|uuid||uuid
public|property_dependencies|dependency_type|6||NO|character varying|20|varchar
public|property_dependencies|dependency_path|7||YES|ARRAY||_text
public|property_dependencies|update_order|8|0|YES|integer||int4
public|property_dependencies|created_at|9|now()|NO|timestamp with time zone||timestamptz
public|recent_schema_changes|id|1||YES|uuid||uuid
public|recent_schema_changes|entity_type|2||YES|character varying|20|varchar
public|recent_schema_changes|entity_code|3||YES|character varying|100|varchar
public|recent_schema_changes|change_type|4||YES|character varying|20|varchar
public|recent_schema_changes|change_source|5||YES|character varying|20|varchar
public|recent_schema_changes|performed_by_type|6||YES|character varying|20|varchar
public|recent_schema_changes|success|7||YES|boolean||bool
public|recent_schema_changes|error_message|8||YES|text||text
public|recent_schema_changes|is_rolled_back|9||YES|boolean||bool
public|recent_schema_changes|created_at|10||YES|timestamp with time zone||timestamptz
public|recent_schema_changes|entity_label|11||YES|character varying||varchar
public|recent_schema_changes|parent_collection_code|12||YES|character varying||varchar
public|runtime_anomaly|id|1|gen_random_uuid()|NO|uuid||uuid
public|runtime_anomaly|kind|2||NO|character varying|80|varchar
public|runtime_anomaly|service_code|3||NO|character varying|80|varchar
public|runtime_anomaly|collection_code|4||YES|character varying|120|varchar
public|runtime_anomaly|record_id|5||YES|character varying|120|varchar
public|runtime_anomaly|message|6||NO|text||text
public|runtime_anomaly|context|7||YES|jsonb||jsonb
public|runtime_anomaly|error_payload|8||YES|jsonb||jsonb
public|runtime_anomaly|occurred_at|9|now()|NO|timestamp with time zone||timestamptz
public|schema_versions|id|1|gen_random_uuid()|NO|uuid||uuid
public|schema_versions|version|2||NO|integer||int4
public|schema_versions|collection_code|3||NO|character varying|100|varchar
public|schema_versions|snapshot|4||NO|jsonb||jsonb
public|schema_versions|change_type|5||NO|character varying|30|varchar
public|schema_versions|change_summary|6||NO|text||text
public|schema_versions|created_by|7||NO|uuid||uuid
public|schema_versions|parent_version_id|8||YES|uuid||uuid
public|schema_versions|metadata|9||YES|jsonb||jsonb
public|schema_versions|created_at|10|now()|NO|timestamp with time zone||timestamptz
public|search_embeddings|id|1|gen_random_uuid()|NO|uuid||uuid
public|search_embeddings|source_type|2||NO|character varying|120|varchar
public|search_embeddings|source_id|3||NO|character varying|255|varchar
public|search_embeddings|chunk_index|4||NO|integer||int4
public|search_embeddings|content|5||NO|text||text
public|search_embeddings|metadata|6|'{}'::jsonb|YES|jsonb||jsonb
public|search_embeddings|embedding|7||YES|USER-DEFINED||vector
public|search_embeddings|created_at|8|now()|YES|timestamp with time zone||timestamptz
public|search_embeddings|updated_at|9|now()|YES|timestamp with time zone||timestamptz
public|search_embeddings|_collection_id|10||YES|uuid||uuid
public|search_embeddings|_attribute_region|11||YES|text||text
public|search_embeddings|_attribute_department_id|12||YES|uuid||uuid
public|search_embeddings|_attribute_site_id|13||YES|uuid||uuid
public|service_principals|service_id|1||NO|text||text
public|service_principals|display_name|2||NO|text||text
public|service_principals|allowed_audiences|3||NO|ARRAY||_text
public|service_principals|allowed_scopes|4||NO|ARRAY||_text
public|service_principals|k8s_service_account|5||YES|text||text
public|service_principals|active|6|true|NO|boolean||bool
public|service_principals|created_at|7|now()|NO|timestamp with time zone||timestamptz
public|service_principals|updated_at|8|now()|NO|timestamp with time zone||timestamptz
public|upgrade_history|id|1|uuid_generate_v4()|NO|uuid||uuid
public|upgrade_history|instance_id|2|'default-instance'::character varying|NO|character varying|100|varchar
public|upgrade_history|from_version|3||NO|character varying|50|varchar
public|upgrade_history|to_version|4||NO|character varying|50|varchar
public|upgrade_history|upgrade_manifest_id|5||YES|uuid||uuid
public|upgrade_history|status|6|'in_progress'::character varying|NO|character varying|30|varchar
public|upgrade_history|started_at|7|now()|NO|timestamp with time zone||timestamptz
public|upgrade_history|completed_at|8||YES|timestamp with time zone||timestamptz
public|upgrade_history|rollback_at|9||YES|timestamp with time zone||timestamptz
public|upgrade_history|initiated_by|10||YES|uuid||uuid
public|upgrade_history|rollback_by|11||YES|uuid||uuid
public|upgrade_history|execution_log|12|'[]'::jsonb|YES|jsonb||jsonb
public|upgrade_history|error_message|13||YES|text||text
public|upgrade_history|impacts_resolved|14|0|NO|integer||int4
public|upgrade_history|impacts_auto_merged|15|0|NO|integer||int4
public|upgrade_history|created_at|16|now()|NO|timestamp with time zone||timestamptz
public|upgrade_manifest|id|1|uuid_generate_v4()|NO|uuid||uuid
public|upgrade_manifest|version|2||NO|character varying|50|varchar
public|upgrade_manifest|release_date|3||NO|date||date
public|upgrade_manifest|release_notes|4||YES|text||text
public|upgrade_manifest|breaking_changes|5|'[]'::jsonb|YES|jsonb||jsonb
public|upgrade_manifest|new_features|6|'[]'::jsonb|YES|jsonb||jsonb
public|upgrade_manifest|deprecations|7|'[]'::jsonb|YES|jsonb||jsonb
public|upgrade_manifest|migrations|8|'[]'::jsonb|YES|jsonb||jsonb
public|upgrade_manifest|min_required_version|9||YES|character varying|50|varchar
public|upgrade_manifest|is_available|10|true|NO|boolean||bool
public|upgrade_manifest|is_mandatory|11|false|NO|boolean||bool
public|upgrade_manifest|created_at|12|now()|NO|timestamp with time zone||timestamptz
public|user_preferences|id|1|uuid_generate_v4()|NO|uuid||uuid
public|user_preferences|user_id|2||NO|uuid||uuid
public|user_preferences|density_mode|3|'comfortable'::character varying|NO|character varying|20|varchar
public|user_preferences|sidebar_position|4|'left'::character varying|NO|character varying|10|varchar
public|user_preferences|sidebar_collapsed|5|false|NO|boolean||bool
public|user_preferences|sidebar_width|6|260|NO|integer||int4
public|user_preferences|show_breadcrumbs|7|true|NO|boolean||bool
public|user_preferences|show_footer|8|true|NO|boolean||bool
public|user_preferences|content_width|9|'full'::character varying|NO|character varying|20|varchar
public|user_preferences|pinned_navigation|10|'[]'::jsonb|NO|jsonb||jsonb
public|user_preferences|recent_items_count|11|5|NO|integer||int4
public|user_preferences|show_favorites_in_sidebar|12|true|NO|boolean||bool
public|user_preferences|show_recent_in_sidebar|13|true|NO|boolean||bool
public|user_preferences|language|14|'en'::character varying|NO|character varying|10|varchar
public|user_preferences|timezone|15||YES|character varying|50|varchar
public|user_preferences|date_format|16|'MM/DD/YYYY'::character varying|NO|character varying|20|varchar
public|user_preferences|time_format|17|'12h'::character varying|NO|character varying|5|varchar
public|user_preferences|start_of_week|18|'sunday'::character varying|NO|character varying|10|varchar
public|user_preferences|number_format|19|'en-US'::character varying|NO|character varying|20|varchar
public|user_preferences|notification_preferences|20|'{"push": {"enabled": false}, "email": {"enabled": true, "frequency": "daily", "categories": []}, "inApp": {"sound": true, "enabled": true, "showPreview": true}}'::jsonb|NO|jsonb||jsonb
public|user_preferences|accessibility|21|'{"largeText": false, "highContrast": false, "reduceMotion": false, "focusIndicators": true, "keyboardNavigation": true, "screenReaderOptimized": false}'::jsonb|NO|jsonb||jsonb
public|user_preferences|keyboard_shortcuts_enabled|22|true|NO|boolean||bool
public|user_preferences|custom_shortcuts|23|'[]'::jsonb|NO|jsonb||jsonb
public|user_preferences|table_preferences|24|'{"compactMode": false, "stickyHeader": true, "showRowNumbers": false, "defaultPageSize": 25, "alternateRowColors": false, "enableColumnReorder": true}'::jsonb|NO|jsonb||jsonb
public|user_preferences|dashboard_preferences|25|'{"showWelcomeWidget": true, "autoRefreshInterval": 0}'::jsonb|NO|jsonb||jsonb
public|user_preferences|auto_save_enabled|26|true|NO|boolean||bool
public|user_preferences|auto_save_interval|27|30|NO|integer||int4
public|user_preferences|confirm_before_leave|28|true|NO|boolean||bool
public|user_preferences|show_field_descriptions|29|true|NO|boolean||bool
public|user_preferences|search_include_archived|30|false|NO|boolean||bool
public|user_preferences|search_results_per_page|31|20|NO|integer||int4
public|user_preferences|search_highlight_matches|32|true|NO|boolean||bool
public|user_preferences|home_page|33||YES|character varying|255|varchar
public|user_preferences|startup_page|34||YES|character varying|255|varchar
public|user_preferences|ava_enabled|35|true|NO|boolean||bool
public|user_preferences|ava_auto_suggest|36|true|NO|boolean||bool
public|user_preferences|ava_voice_enabled|37|false|NO|boolean||bool
public|user_preferences|sync_enabled|38|true|NO|boolean||bool
public|user_preferences|last_sync_device|39||YES|character varying|255|varchar
public|user_preferences|last_synced_at|40||YES|timestamp with time zone||timestamptz
public|user_preferences|preference_version|41|1|NO|integer||int4
public|user_preferences|created_at|42|now()|NO|timestamp with time zone||timestamptz
public|user_preferences|updated_at|43|now()|NO|timestamp with time zone||timestamptz
public|user_sessions|id|1|uuid_generate_v4()|NO|uuid||uuid
public|user_sessions|user_id|2||NO|uuid||uuid
public|user_sessions|session_token|3||NO|character varying|500|varchar
public|user_sessions|refresh_token|4||YES|character varying|500|varchar
public|user_sessions|device_id|5||YES|character varying|255|varchar
public|user_sessions|device_name|6||YES|character varying|255|varchar
public|user_sessions|device_type|7||YES|character varying|50|varchar
public|user_sessions|user_agent|8||YES|text||text
public|user_sessions|ip_address|9||YES|character varying|45|varchar
public|user_sessions|geo_location|10||YES|jsonb||jsonb
public|user_sessions|is_active|11|true|NO|boolean||bool
public|user_sessions|is_remembered|12|false|NO|boolean||bool
public|user_sessions|created_at|13|now()|NO|timestamp with time zone||timestamptz
public|user_sessions|last_activity_at|14|now()|NO|timestamp with time zone||timestamptz
public|user_sessions|expires_at|15||NO|timestamp with time zone||timestamptz
public|user_sessions|revoked_at|16||YES|timestamp with time zone||timestamptz
public|user_sessions|revoked_reason|17||YES|character varying|100|varchar
public|users|id|1|uuid_generate_v4()|NO|uuid||uuid
public|users|email|2||NO|character varying|320|varchar
public|users|username|3||YES|character varying|100|varchar
public|users|display_name|4||NO|character varying|255|varchar
public|users|first_name|5||YES|character varying|100|varchar
public|users|last_name|6||YES|character varying|100|varchar
public|users|password_hash|7||YES|character varying|255|varchar
public|users|password_algo|8|'argon2id'::character varying|NO|character varying|20|varchar
public|users|password_changed_at|9||YES|timestamp with time zone||timestamptz
public|users|must_change_password|10|false|NO|boolean||bool
public|users|status|11|'invited'::character varying|NO|character varying|20|varchar
public|users|work_phone|12||YES|character varying|50|varchar
public|users|mobile_phone|13||YES|character varying|50|varchar
public|users|employee_id|14||YES|character varying|100|varchar
public|users|title|15||YES|character varying|200|varchar
public|users|department|16||YES|character varying|200|varchar
public|users|location|17||YES|character varying|200|varchar
public|users|cost_center|18||YES|character varying|50|varchar
public|users|manager_id|19||YES|uuid||uuid
public|users|avatar_url|20||YES|character varying|500|varchar
public|users|locale|21|'en-US'::character varying|NO|character varying|20|varchar
public|users|time_zone|22|'America/New_York'::character varying|NO|character varying|50|varchar
public|users|date_format|23|'MM/DD/YYYY'::character varying|NO|character varying|20|varchar
public|users|time_format|24|'12h'::character varying|NO|character varying|10|varchar
public|users|mfa_enabled|25|false|NO|boolean||bool
public|users|mfa_secret|26||YES|character varying|255|varchar
public|users|mfa_backup_codes|27||YES|jsonb||jsonb
public|users|mfa_recovery_email|28||YES|character varying|320|varchar
public|users|failed_login_attempts|29|0|NO|integer||int4
public|users|locked_until|30||YES|timestamp with time zone||timestamptz
public|users|last_failed_login_at|31||YES|timestamp with time zone||timestamptz
public|users|email_verified|32|false|NO|boolean||bool
public|users|email_verified_at|33||YES|timestamp with time zone||timestamptz
public|users|is_admin|34|false|NO|boolean||bool
public|users|is_system_user|35|false|NO|boolean||bool
public|users|invited_by|36||YES|uuid||uuid
public|users|invited_at|37||YES|timestamp with time zone||timestamptz
public|users|activation_token|38||YES|character varying|255|varchar
public|users|activation_token_expires_at|39||YES|timestamp with time zone||timestamptz
public|users|activated_at|40||YES|timestamp with time zone||timestamptz
public|users|deactivated_at|41||YES|timestamp with time zone||timestamptz
public|users|deactivated_by|42||YES|uuid||uuid
public|users|deactivation_reason|43||YES|text||text
public|users|suspended_at|44||YES|timestamp with time zone||timestamptz
public|users|suspended_by|45||YES|uuid||uuid
public|users|suspension_reason|46||YES|text||text
public|users|suspension_expires_at|47||YES|timestamp with time zone||timestamptz
public|users|last_login_at|48||YES|timestamp with time zone||timestamptz
public|users|last_login_ip|49||YES|character varying|45|varchar
public|users|last_activity_at|50||YES|timestamp with time zone||timestamptz
public|users|deleted_at|51||YES|timestamp with time zone||timestamptz
public|users|deleted_by|52||YES|uuid||uuid
public|users|metadata|53|'{}'::jsonb|NO|jsonb||jsonb
public|users|created_at|54|now()|NO|timestamp with time zone||timestamptz
public|users|updated_at|55|now()|NO|timestamp with time zone||timestamptz
public|users|security_stamp|56|gen_random_uuid()|NO|uuid||uuid
public|view_configurations|id|1|gen_random_uuid()|NO|uuid||uuid
public|view_configurations|collection_id|2||NO|uuid||uuid
public|view_configurations|code|3||NO|character varying|100|varchar
public|view_configurations|name|4||NO|character varying|255|varchar
public|view_configurations|description|5||YES|text||text
public|view_configurations|view_type|6||NO|character varying|30|varchar
public|view_configurations|config|7|'{}'::jsonb|NO|jsonb||jsonb
public|view_configurations|columns|8|'[]'::jsonb|YES|jsonb||jsonb
public|view_configurations|filters|9|'[]'::jsonb|YES|jsonb||jsonb
public|view_configurations|sorts|10|'[]'::jsonb|YES|jsonb||jsonb
public|view_configurations|grouping|11||YES|jsonb||jsonb
public|view_configurations|calendar_config|12||YES|jsonb||jsonb
public|view_configurations|kanban_config|13||YES|jsonb||jsonb
public|view_configurations|timeline_config|14||YES|jsonb||jsonb
public|view_configurations|map_config|15||YES|jsonb||jsonb
public|view_configurations|gantt_config|16||YES|jsonb||jsonb
public|view_configurations|pivot_config|17||YES|jsonb||jsonb
public|view_configurations|gallery_config|18||YES|jsonb||jsonb
public|view_configurations|owner_type|19|'user'::character varying|NO|character varying|20|varchar
public|view_configurations|owner_id|20||YES|uuid||uuid
public|view_configurations|is_default|21|false|YES|boolean||bool
public|view_configurations|is_shared|22|false|YES|boolean||bool
public|view_configurations|shared_with|23|'[]'::jsonb|YES|jsonb||jsonb
public|view_configurations|display_order|24|0|YES|integer||int4
public|view_configurations|created_at|25|now()|NO|timestamp with time zone||timestamptz
public|view_configurations|updated_at|26|now()|NO|timestamp with time zone||timestamptz
public|view_configurations|created_by|27||YES|uuid||uuid
public|view_configurations|updated_by|28||YES|uuid||uuid

## Constraints
app_builder|ai_report_templates|17427_17471_10_not_null|CHECK|created_at IS NOT NULL
app_builder|ai_report_templates|17427_17471_1_not_null|CHECK|id IS NOT NULL
app_builder|ai_report_templates|17427_17471_2_not_null|CHECK|name IS NOT NULL
app_builder|ai_report_templates|17427_17471_8_not_null|CHECK|is_public IS NOT NULL
app_builder|ai_report_templates|PK_ai_report_templates|PRIMARY KEY|id
app_builder|ai_reports|17427_17479_11_not_null|CHECK|created_at IS NOT NULL
app_builder|ai_reports|17427_17479_12_not_null|CHECK|updated_at IS NOT NULL
app_builder|ai_reports|17427_17479_1_not_null|CHECK|id IS NOT NULL
app_builder|ai_reports|17427_17479_3_not_null|CHECK|prompt IS NOT NULL
app_builder|ai_reports|17427_17479_5_not_null|CHECK|definition IS NOT NULL
app_builder|ai_reports|17427_17479_7_not_null|CHECK|status IS NOT NULL
app_builder|ai_reports|PK_ai_reports|PRIMARY KEY|id
app_builder|app_builder_components|17427_17488_1_not_null|CHECK|id IS NOT NULL
app_builder|app_builder_components|17427_17488_2_not_null|CHECK|name IS NOT NULL
app_builder|app_builder_components|17427_17488_3_not_null|CHECK|category IS NOT NULL
app_builder|app_builder_components|17427_17488_4_not_null|CHECK|component_type IS NOT NULL
app_builder|app_builder_components|17427_17488_5_not_null|CHECK|default_props IS NOT NULL
app_builder|app_builder_components|17427_17488_6_not_null|CHECK|schema IS NOT NULL
app_builder|app_builder_components|17427_17488_8_not_null|CHECK|is_system IS NOT NULL
app_builder|app_builder_components|17427_17488_9_not_null|CHECK|created_at IS NOT NULL
app_builder|app_builder_components|PK_app_builder_components|PRIMARY KEY|id
app_builder|ava_stories|17427_17496_12_not_null|CHECK|status IS NOT NULL
app_builder|ava_stories|17427_17496_15_not_null|CHECK|created_at IS NOT NULL
app_builder|ava_stories|17427_17496_16_not_null|CHECK|updated_at IS NOT NULL
app_builder|ava_stories|17427_17496_1_not_null|CHECK|id IS NOT NULL
app_builder|ava_stories|17427_17496_3_not_null|CHECK|title IS NOT NULL
app_builder|ava_stories|PK_ava_stories|PRIMARY KEY|id
app_builder|customization_registry|17427_17505_12_not_null|CHECK|created_at IS NOT NULL
app_builder|customization_registry|17427_17505_13_not_null|CHECK|updated_at IS NOT NULL
app_builder|customization_registry|17427_17505_1_not_null|CHECK|id IS NOT NULL
app_builder|customization_registry|17427_17505_2_not_null|CHECK|customization_type IS NOT NULL
app_builder|customization_registry|17427_17505_3_not_null|CHECK|artifact_id IS NOT NULL
app_builder|customization_registry|17427_17505_5_not_null|CHECK|is_system_modified IS NOT NULL
app_builder|customization_registry|17427_17505_8_not_null|CHECK|dependencies IS NOT NULL
app_builder|customization_registry|17427_17505_9_not_null|CHECK|dependents IS NOT NULL
app_builder|customization_registry|PK_customization_registry|PRIMARY KEY|id
app_builder|digital_twins|17427_17516_10_not_null|CHECK|created_at IS NOT NULL
app_builder|digital_twins|17427_17516_11_not_null|CHECK|updated_at IS NOT NULL
app_builder|digital_twins|17427_17516_12_not_null|CHECK|name IS NOT NULL
app_builder|digital_twins|17427_17516_14_not_null|CHECK|asset_type IS NOT NULL
app_builder|digital_twins|17427_17516_1_not_null|CHECK|id IS NOT NULL
app_builder|digital_twins|17427_17516_2_not_null|CHECK|asset_id IS NOT NULL
app_builder|digital_twins|17427_17516_5_not_null|CHECK|sync_interval IS NOT NULL
app_builder|digital_twins|17427_17516_6_not_null|CHECK|sensor_mappings IS NOT NULL
app_builder|digital_twins|17427_17516_7_not_null|CHECK|state IS NOT NULL
app_builder|digital_twins|17427_17516_8_not_null|CHECK|is_active IS NOT NULL
app_builder|digital_twins|PK_digital_twins|PRIMARY KEY|id
app_builder|documentation_versions|17427_17529_1_not_null|CHECK|id IS NOT NULL
app_builder|documentation_versions|17427_17529_2_not_null|CHECK|documentation_id IS NOT NULL
app_builder|documentation_versions|17427_17529_3_not_null|CHECK|version IS NOT NULL
app_builder|documentation_versions|17427_17529_4_not_null|CHECK|documentation IS NOT NULL
app_builder|documentation_versions|17427_17529_6_not_null|CHECK|created_at IS NOT NULL
app_builder|documentation_versions|PK_documentation_versions|PRIMARY KEY|id
app_builder|generated_documentation|17427_17536_10_not_null|CHECK|created_at IS NOT NULL
app_builder|generated_documentation|17427_17536_11_not_null|CHECK|updated_at IS NOT NULL
app_builder|generated_documentation|17427_17536_1_not_null|CHECK|id IS NOT NULL
app_builder|generated_documentation|17427_17536_2_not_null|CHECK|artifact_type IS NOT NULL
app_builder|generated_documentation|17427_17536_3_not_null|CHECK|artifact_id IS NOT NULL
app_builder|generated_documentation|17427_17536_5_not_null|CHECK|documentation IS NOT NULL
app_builder|generated_documentation|17427_17536_7_not_null|CHECK|version IS NOT NULL
app_builder|generated_documentation|17427_17536_8_not_null|CHECK|generated_at IS NOT NULL
app_builder|generated_documentation|17427_17536_9_not_null|CHECK|generated_by IS NOT NULL
app_builder|generated_documentation|PK_generated_documentation|PRIMARY KEY|id
app_builder|insight_analysis_jobs|17427_17547_1_not_null|CHECK|id IS NOT NULL
app_builder|insight_analysis_jobs|17427_17547_2_not_null|CHECK|job_type IS NOT NULL
app_builder|insight_analysis_jobs|17427_17547_5_not_null|CHECK|run_frequency_hours IS NOT NULL
app_builder|insight_analysis_jobs|17427_17547_6_not_null|CHECK|status IS NOT NULL
app_builder|insight_analysis_jobs|17427_17547_8_not_null|CHECK|created_at IS NOT NULL
app_builder|insight_analysis_jobs|17427_17547_9_not_null|CHECK|updated_at IS NOT NULL
app_builder|insight_analysis_jobs|PK_insight_analysis_jobs|PRIMARY KEY|id
app_builder|nl_queries|17427_17557_10_not_null|CHECK|created_at IS NOT NULL
app_builder|nl_queries|17427_17557_1_not_null|CHECK|id IS NOT NULL
app_builder|nl_queries|17427_17557_3_not_null|CHECK|query_text IS NOT NULL
app_builder|nl_queries|PK_nl_queries|PRIMARY KEY|id
app_builder|predictive_insights|17427_17564_10_not_null|CHECK|status IS NOT NULL
app_builder|predictive_insights|17427_17564_15_not_null|CHECK|created_at IS NOT NULL
app_builder|predictive_insights|17427_17564_1_not_null|CHECK|id IS NOT NULL
app_builder|predictive_insights|17427_17564_2_not_null|CHECK|insight_type IS NOT NULL
app_builder|predictive_insights|17427_17564_3_not_null|CHECK|severity IS NOT NULL
app_builder|predictive_insights|17427_17564_4_not_null|CHECK|title IS NOT NULL
app_builder|predictive_insights|17427_17564_5_not_null|CHECK|description IS NOT NULL
app_builder|predictive_insights|PK_predictive_insights|PRIMARY KEY|id
app_builder|predictive_suggestions|17427_17572_10_not_null|CHECK|dismissed IS NOT NULL
app_builder|predictive_suggestions|17427_17572_12_not_null|CHECK|shown_at IS NOT NULL
app_builder|predictive_suggestions|17427_17572_1_not_null|CHECK|id IS NOT NULL
app_builder|predictive_suggestions|PK_predictive_suggestions|PRIMARY KEY|id
app_builder|recovery_actions|17427_17580_10_not_null|CHECK|created_at IS NOT NULL
app_builder|recovery_actions|17427_17580_11_not_null|CHECK|updated_at IS NOT NULL
app_builder|recovery_actions|17427_17580_1_not_null|CHECK|id IS NOT NULL
app_builder|recovery_actions|17427_17580_2_not_null|CHECK|name IS NOT NULL
app_builder|recovery_actions|17427_17580_3_not_null|CHECK|action_type IS NOT NULL
app_builder|recovery_actions|17427_17580_5_not_null|CHECK|trigger_conditions IS NOT NULL
app_builder|recovery_actions|17427_17580_6_not_null|CHECK|action_config IS NOT NULL
app_builder|recovery_actions|17427_17580_7_not_null|CHECK|is_active IS NOT NULL
app_builder|recovery_actions|17427_17580_9_not_null|CHECK|trigger_count IS NOT NULL
app_builder|recovery_actions|PK_recovery_actions|PRIMARY KEY|id
app_builder|saved_nl_queries|17427_17590_1_not_null|CHECK|id IS NOT NULL
app_builder|saved_nl_queries|17427_17590_3_not_null|CHECK|name IS NOT NULL
app_builder|saved_nl_queries|17427_17590_4_not_null|CHECK|query_text IS NOT NULL
app_builder|saved_nl_queries|17427_17590_5_not_null|CHECK|is_favorite IS NOT NULL
app_builder|saved_nl_queries|17427_17590_6_not_null|CHECK|usage_count IS NOT NULL
app_builder|saved_nl_queries|17427_17590_7_not_null|CHECK|created_at IS NOT NULL
app_builder|saved_nl_queries|PK_saved_nl_queries|PRIMARY KEY|id
app_builder|self_healing_events|17427_17599_1_not_null|CHECK|id IS NOT NULL
app_builder|self_healing_events|17427_17599_2_not_null|CHECK|service_name IS NOT NULL
app_builder|self_healing_events|17427_17599_3_not_null|CHECK|event_type IS NOT NULL
app_builder|self_healing_events|17427_17599_9_not_null|CHECK|created_at IS NOT NULL
app_builder|self_healing_events|PK_self_healing_events|PRIMARY KEY|id
app_builder|sensor_readings|17427_17606_1_not_null|CHECK|id IS NOT NULL
app_builder|sensor_readings|17427_17606_2_not_null|CHECK|asset_id IS NOT NULL
app_builder|sensor_readings|17427_17606_3_not_null|CHECK|sensor_id IS NOT NULL
app_builder|sensor_readings|17427_17606_8_not_null|CHECK|timestamp IS NOT NULL
app_builder|sensor_readings|PK_sensor_readings|PRIMARY KEY|id
app_builder|service_health_status|17427_17614_10_not_null|CHECK|health_history IS NOT NULL
app_builder|service_health_status|17427_17614_11_not_null|CHECK|created_at IS NOT NULL
app_builder|service_health_status|17427_17614_12_not_null|CHECK|updated_at IS NOT NULL
app_builder|service_health_status|17427_17614_1_not_null|CHECK|id IS NOT NULL
app_builder|service_health_status|17427_17614_2_not_null|CHECK|service_name IS NOT NULL
app_builder|service_health_status|17427_17614_3_not_null|CHECK|status IS NOT NULL
app_builder|service_health_status|PK_service_health_status|PRIMARY KEY|id
app_builder|service_health_status|UQ_service_health_name|UNIQUE|service_name
app_builder|sprint_recordings|17427_17624_10_not_null|CHECK|created_at IS NOT NULL
app_builder|sprint_recordings|17427_17624_11_not_null|CHECK|updated_at IS NOT NULL
app_builder|sprint_recordings|17427_17624_1_not_null|CHECK|id IS NOT NULL
app_builder|sprint_recordings|17427_17624_2_not_null|CHECK|title IS NOT NULL
app_builder|sprint_recordings|17427_17624_6_not_null|CHECK|recorded_at IS NOT NULL
app_builder|sprint_recordings|17427_17624_8_not_null|CHECK|status IS NOT NULL
app_builder|sprint_recordings|PK_sprint_recordings|PRIMARY KEY|id
app_builder|story_implementations|17427_17633_1_not_null|CHECK|id IS NOT NULL
app_builder|story_implementations|17427_17633_2_not_null|CHECK|story_id IS NOT NULL
app_builder|story_implementations|17427_17633_3_not_null|CHECK|artifact_type IS NOT NULL
app_builder|story_implementations|17427_17633_4_not_null|CHECK|artifact_id IS NOT NULL
app_builder|story_implementations|17427_17633_5_not_null|CHECK|generated_by_ava IS NOT NULL
app_builder|story_implementations|17427_17633_7_not_null|CHECK|created_at IS NOT NULL
app_builder|story_implementations|PK_story_implementations|PRIMARY KEY|id
app_builder|upgrade_fixes|17427_17641_10_not_null|CHECK|rollback_available IS NOT NULL
app_builder|upgrade_fixes|17427_17641_11_not_null|CHECK|created_at IS NOT NULL
app_builder|upgrade_fixes|17427_17641_1_not_null|CHECK|id IS NOT NULL
app_builder|upgrade_fixes|17427_17641_2_not_null|CHECK|analysis_id IS NOT NULL
app_builder|upgrade_fixes|17427_17641_3_not_null|CHECK|customization_id IS NOT NULL
app_builder|upgrade_fixes|17427_17641_4_not_null|CHECK|fix_type IS NOT NULL
app_builder|upgrade_fixes|PK_upgrade_fixes|PRIMARY KEY|id
app_builder|upgrade_impact_analyses|17427_17649_14_not_null|CHECK|created_at IS NOT NULL
app_builder|upgrade_impact_analyses|17427_17649_1_not_null|CHECK|id IS NOT NULL
app_builder|upgrade_impact_analyses|17427_17649_2_not_null|CHECK|from_version IS NOT NULL
app_builder|upgrade_impact_analyses|17427_17649_3_not_null|CHECK|to_version IS NOT NULL
app_builder|upgrade_impact_analyses|17427_17649_4_not_null|CHECK|analysis_status IS NOT NULL
app_builder|upgrade_impact_analyses|PK_upgrade_impact_analyses|PRIMARY KEY|id
app_builder|user_behaviors|17427_17657_1_not_null|CHECK|id IS NOT NULL
app_builder|user_behaviors|17427_17657_2_not_null|CHECK|user_id IS NOT NULL
app_builder|user_behaviors|17427_17657_3_not_null|CHECK|action IS NOT NULL
app_builder|user_behaviors|17427_17657_9_not_null|CHECK|timestamp IS NOT NULL
app_builder|user_behaviors|PK_user_behaviors|PRIMARY KEY|id
app_builder|user_patterns|17427_17664_1_not_null|CHECK|id IS NOT NULL
app_builder|user_patterns|17427_17664_2_not_null|CHECK|user_id IS NOT NULL
app_builder|user_patterns|17427_17664_3_not_null|CHECK|pattern_type IS NOT NULL
app_builder|user_patterns|17427_17664_4_not_null|CHECK|pattern_data IS NOT NULL
app_builder|user_patterns|17427_17664_6_not_null|CHECK|occurrence_count IS NOT NULL
app_builder|user_patterns|17427_17664_8_not_null|CHECK|created_at IS NOT NULL
app_builder|user_patterns|17427_17664_9_not_null|CHECK|updated_at IS NOT NULL
app_builder|user_patterns|PK_user_patterns|PRIMARY KEY|id
app_builder|voice_command_patterns|17427_17673_1_not_null|CHECK|id IS NOT NULL
app_builder|voice_command_patterns|17427_17673_2_not_null|CHECK|intent IS NOT NULL
app_builder|voice_command_patterns|17427_17673_3_not_null|CHECK|patterns IS NOT NULL
app_builder|voice_command_patterns|17427_17673_4_not_null|CHECK|action_type IS NOT NULL
app_builder|voice_command_patterns|17427_17673_5_not_null|CHECK|action_config IS NOT NULL
app_builder|voice_command_patterns|17427_17673_7_not_null|CHECK|is_active IS NOT NULL
app_builder|voice_command_patterns|17427_17673_8_not_null|CHECK|created_at IS NOT NULL
app_builder|voice_command_patterns|PK_voice_command_patterns|PRIMARY KEY|id
app_builder|voice_commands|17427_17681_11_not_null|CHECK|created_at IS NOT NULL
app_builder|voice_commands|17427_17681_1_not_null|CHECK|id IS NOT NULL
app_builder|voice_commands|17427_17681_4_not_null|CHECK|command_text IS NOT NULL
app_builder|voice_commands|17427_17681_8_not_null|CHECK|executed IS NOT NULL
app_builder|voice_commands|PK_voice_commands|PRIMARY KEY|id
app_builder|zero_code_app_versions|17427_17689_1_not_null|CHECK|id IS NOT NULL
app_builder|zero_code_app_versions|17427_17689_2_not_null|CHECK|app_id IS NOT NULL
app_builder|zero_code_app_versions|17427_17689_3_not_null|CHECK|version IS NOT NULL
app_builder|zero_code_app_versions|17427_17689_4_not_null|CHECK|definition IS NOT NULL
app_builder|zero_code_app_versions|17427_17689_7_not_null|CHECK|created_at IS NOT NULL
app_builder|zero_code_app_versions|PK_zero_code_app_versions|PRIMARY KEY|id
app_builder|zero_code_apps|17427_17696_11_not_null|CHECK|created_at IS NOT NULL
app_builder|zero_code_apps|17427_17696_12_not_null|CHECK|updated_at IS NOT NULL
app_builder|zero_code_apps|17427_17696_1_not_null|CHECK|id IS NOT NULL
app_builder|zero_code_apps|17427_17696_2_not_null|CHECK|name IS NOT NULL
app_builder|zero_code_apps|17427_17696_4_not_null|CHECK|version IS NOT NULL
app_builder|zero_code_apps|17427_17696_5_not_null|CHECK|definition IS NOT NULL
app_builder|zero_code_apps|17427_17696_6_not_null|CHECK|is_published IS NOT NULL
app_builder|zero_code_apps|PK_zero_code_apps|PRIMARY KEY|id
automation|approvals|17428_17706_1_not_null|CHECK|id IS NOT NULL
automation|approvals|17428_17706_3_not_null|CHECK|node_id IS NOT NULL
automation|approvals|17428_17706_4_not_null|CHECK|approver_id IS NOT NULL
automation|approvals|approvals_pkey|PRIMARY KEY|id
automation|approvals|chk_approval_status|CHECK|(((status)::text = ANY (ARRAY[('pending'::character varying)::t
automation|approvals|chk_approval_type|CHECK|(((approval_type)::text = ANY (ARRAY[('sequential'::character v
automation|approvals|chk_approver_type|CHECK|(((approver_type)::text = ANY (ARRAY[('user'::character varying
automation|automation_execution_logs|17428_17721_10_not_null|CHECK|status IS NOT NULL
automation|automation_execution_logs|17428_17721_18_not_null|CHECK|execution_depth IS NOT NULL
automation|automation_execution_logs|17428_17721_1_not_null|CHECK|id IS NOT NULL
automation|automation_execution_logs|17428_17721_20_not_null|CHECK|created_at IS NOT NULL
automation|automation_execution_logs|17428_17721_4_not_null|CHECK|automation_type IS NOT NULL
automation|automation_execution_logs|17428_17721_5_not_null|CHECK|automation_name IS NOT NULL
automation|automation_execution_logs|pk_automation_execution_logs|PRIMARY KEY|id
automation|automation_rule_revisions|17428_17729_1_not_null|CHECK|id IS NOT NULL
automation|automation_rule_revisions|17428_17729_2_not_null|CHECK|automation_rule_id IS NOT NULL
automation|automation_rule_revisions|17428_17729_3_not_null|CHECK|revision IS NOT NULL
automation|automation_rule_revisions|17428_17729_4_not_null|CHECK|status IS NOT NULL
automation|automation_rule_revisions|17428_17729_5_not_null|CHECK|payload IS NOT NULL
automation|automation_rule_revisions|17428_17729_9_not_null|CHECK|created_at IS NOT NULL
automation|automation_rule_revisions|automation_rule_revisions_pkey|PRIMARY KEY|id
automation|automation_rules|17428_17737_11_not_null|CHECK|action_type IS NOT NULL
automation|automation_rules|17428_17737_14_not_null|CHECK|abort_on_error IS NOT NULL
automation|automation_rules|17428_17737_15_not_null|CHECK|execution_order IS NOT NULL
automation|automation_rules|17428_17737_16_not_null|CHECK|is_active IS NOT NULL
automation|automation_rules|17428_17737_17_not_null|CHECK|is_system IS NOT NULL
automation|automation_rules|17428_17737_18_not_null|CHECK|consecutive_errors IS NOT NULL
automation|automation_rules|17428_17737_1_not_null|CHECK|id IS NOT NULL
automation|automation_rules|17428_17737_20_not_null|CHECK|metadata IS NOT NULL
automation|automation_rules|17428_17737_23_not_null|CHECK|created_at IS NOT NULL
automation|automation_rules|17428_17737_24_not_null|CHECK|updated_at IS NOT NULL
automation|automation_rules|17428_17737_25_not_null|CHECK|application_id IS NOT NULL
automation|automation_rules|17428_17737_26_not_null|CHECK|status IS NOT NULL
automation|automation_rules|17428_17737_29_not_null|CHECK|source IS NOT NULL
automation|automation_rules|17428_17737_2_not_null|CHECK|name IS NOT NULL
automation|automation_rules|17428_17737_4_not_null|CHECK|collection_id IS NOT NULL
automation|automation_rules|17428_17737_5_not_null|CHECK|trigger_timing IS NOT NULL
automation|automation_rules|17428_17737_6_not_null|CHECK|trigger_operations IS NOT NULL
automation|automation_rules|17428_17737_8_not_null|CHECK|condition_type IS NOT NULL
automation|automation_rules|pk_automation_rules|PRIMARY KEY|id
automation|business_hours|17428_17756_1_not_null|CHECK|id IS NOT NULL
automation|business_hours|17428_17756_2_not_null|CHECK|name IS NOT NULL
automation|business_hours|17428_17756_3_not_null|CHECK|code IS NOT NULL
automation|business_hours|17428_17756_5_not_null|CHECK|timezone IS NOT NULL
automation|business_hours|17428_17756_6_not_null|CHECK|schedule IS NOT NULL
automation|business_hours|business_hours_code_key|UNIQUE|code
automation|business_hours|business_hours_pkey|PRIMARY KEY|id
automation|client_scripts|17428_17769_10_not_null|CHECK|actions IS NOT NULL
automation|client_scripts|17428_17769_11_not_null|CHECK|execution_order IS NOT NULL
automation|client_scripts|17428_17769_12_not_null|CHECK|is_active IS NOT NULL
automation|client_scripts|17428_17769_13_not_null|CHECK|metadata IS NOT NULL
automation|client_scripts|17428_17769_15_not_null|CHECK|created_at IS NOT NULL
automation|client_scripts|17428_17769_16_not_null|CHECK|updated_at IS NOT NULL
automation|client_scripts|17428_17769_1_not_null|CHECK|id IS NOT NULL
automation|client_scripts|17428_17769_2_not_null|CHECK|name IS NOT NULL
automation|client_scripts|17428_17769_4_not_null|CHECK|collection_id IS NOT NULL
automation|client_scripts|17428_17769_6_not_null|CHECK|trigger IS NOT NULL
automation|client_scripts|17428_17769_8_not_null|CHECK|condition_type IS NOT NULL
automation|client_scripts|pk_client_scripts|PRIMARY KEY|id
automation|connectors|17428_17781_11_not_null|CHECK|created_at IS NOT NULL
automation|connectors|17428_17781_12_not_null|CHECK|updated_at IS NOT NULL
automation|connectors|17428_17781_13_not_null|CHECK|source IS NOT NULL
automation|connectors|17428_17781_1_not_null|CHECK|id IS NOT NULL
automation|connectors|17428_17781_2_not_null|CHECK|code IS NOT NULL
automation|connectors|17428_17781_3_not_null|CHECK|name IS NOT NULL
automation|connectors|17428_17781_5_not_null|CHECK|kind IS NOT NULL
automation|connectors|17428_17781_6_not_null|CHECK|config IS NOT NULL
automation|connectors|17428_17781_8_not_null|CHECK|status IS NOT NULL
automation|connectors|connectors_code_key|UNIQUE|code
automation|connectors|connectors_pkey|PRIMARY KEY|id
automation|cross_domain_read_diff|17428_17792_1_not_null|CHECK|id IS NOT NULL
automation|cross_domain_read_diff|17428_17792_2_not_null|CHECK|caller_service IS NOT NULL
automation|cross_domain_read_diff|17428_17792_3_not_null|CHECK|callsite IS NOT NULL
automation|cross_domain_read_diff|17428_17792_4_not_null|CHECK|lookup_key IS NOT NULL
automation|cross_domain_read_diff|17428_17792_5_not_null|CHECK|diff_kind IS NOT NULL
automation|cross_domain_read_diff|17428_17792_8_not_null|CHECK|detected_at IS NOT NULL
automation|cross_domain_read_diff|CHK_cross_domain_read_diff_kind|CHECK|(((diff_kind)::text = ANY (ARRAY[('value-mismatch'::character v
automation|cross_domain_read_diff|PK_cross_domain_read_diff|PRIMARY KEY|id
automation|decision_inputs|17428_17800_1_not_null|CHECK|id IS NOT NULL
automation|decision_inputs|17428_17800_2_not_null|CHECK|table_id IS NOT NULL
automation|decision_inputs|17428_17800_3_not_null|CHECK|name IS NOT NULL
automation|decision_inputs|17428_17800_4_not_null|CHECK|input_type IS NOT NULL
automation|decision_inputs|17428_17800_7_not_null|CHECK|position IS NOT NULL
automation|decision_inputs|17428_17800_8_not_null|CHECK|created_at IS NOT NULL
automation|decision_inputs|decision_inputs_pkey|PRIMARY KEY|id
automation|decision_rows|17428_17807_1_not_null|CHECK|id IS NOT NULL
automation|decision_rows|17428_17807_2_not_null|CHECK|table_id IS NOT NULL
automation|decision_rows|17428_17807_3_not_null|CHECK|position IS NOT NULL
automation|decision_rows|17428_17807_4_not_null|CHECK|conditions IS NOT NULL
automation|decision_rows|17428_17807_8_not_null|CHECK|is_active IS NOT NULL
automation|decision_rows|17428_17807_9_not_null|CHECK|created_at IS NOT NULL
automation|decision_rows|decision_rows_pkey|PRIMARY KEY|id
automation|decision_table_revisions|17428_17816_1_not_null|CHECK|id IS NOT NULL
automation|decision_table_revisions|17428_17816_2_not_null|CHECK|table_id IS NOT NULL
automation|decision_table_revisions|17428_17816_3_not_null|CHECK|revision IS NOT NULL
automation|decision_table_revisions|17428_17816_4_not_null|CHECK|status IS NOT NULL
automation|decision_table_revisions|17428_17816_5_not_null|CHECK|payload IS NOT NULL
automation|decision_table_revisions|17428_17816_9_not_null|CHECK|created_at IS NOT NULL
automation|decision_table_revisions|decision_table_revisions_pkey|PRIMARY KEY|id
automation|decision_tables|17428_17824_10_not_null|CHECK|is_active IS NOT NULL
automation|decision_tables|17428_17824_15_not_null|CHECK|created_at IS NOT NULL
automation|decision_tables|17428_17824_16_not_null|CHECK|updated_at IS NOT NULL
automation|decision_tables|17428_17824_17_not_null|CHECK|source IS NOT NULL
automation|decision_tables|17428_17824_1_not_null|CHECK|id IS NOT NULL
automation|decision_tables|17428_17824_2_not_null|CHECK|code IS NOT NULL
automation|decision_tables|17428_17824_3_not_null|CHECK|name IS NOT NULL
automation|decision_tables|17428_17824_5_not_null|CHECK|collection_id IS NOT NULL
automation|decision_tables|17428_17824_6_not_null|CHECK|application_id IS NOT NULL
automation|decision_tables|17428_17824_8_not_null|CHECK|hit_policy IS NOT NULL
automation|decision_tables|17428_17824_9_not_null|CHECK|status IS NOT NULL
automation|decision_tables|decision_tables_code_key|UNIQUE|code
automation|decision_tables|decision_tables_pkey|PRIMARY KEY|id
automation|guided_process_activities|17428_17836_1_not_null|CHECK|id IS NOT NULL
automation|guided_process_activities|17428_17836_2_not_null|CHECK|stage_id IS NOT NULL
automation|guided_process_activities|17428_17836_3_not_null|CHECK|name IS NOT NULL
automation|guided_process_activities|17428_17836_5_not_null|CHECK|position IS NOT NULL
automation|guided_process_activities|17428_17836_6_not_null|CHECK|kind IS NOT NULL
automation|guided_process_activities|17428_17836_9_not_null|CHECK|created_at IS NOT NULL
automation|guided_process_activities|guided_process_activities_pkey|PRIMARY KEY|id
automation|guided_process_revisions|17428_17843_1_not_null|CHECK|id IS NOT NULL
automation|guided_process_revisions|17428_17843_2_not_null|CHECK|process_id IS NOT NULL
automation|guided_process_revisions|17428_17843_3_not_null|CHECK|revision IS NOT NULL
automation|guided_process_revisions|17428_17843_4_not_null|CHECK|status IS NOT NULL
automation|guided_process_revisions|17428_17843_5_not_null|CHECK|payload IS NOT NULL
automation|guided_process_revisions|17428_17843_9_not_null|CHECK|created_at IS NOT NULL
automation|guided_process_revisions|guided_process_revisions_pkey|PRIMARY KEY|id
automation|guided_process_stages|17428_17851_1_not_null|CHECK|id IS NOT NULL
automation|guided_process_stages|17428_17851_2_not_null|CHECK|process_id IS NOT NULL
automation|guided_process_stages|17428_17851_3_not_null|CHECK|name IS NOT NULL
automation|guided_process_stages|17428_17851_5_not_null|CHECK|position IS NOT NULL
automation|guided_process_stages|17428_17851_7_not_null|CHECK|created_at IS NOT NULL
automation|guided_process_stages|guided_process_stages_pkey|PRIMARY KEY|id
automation|guided_processes|17428_17858_13_not_null|CHECK|created_at IS NOT NULL
automation|guided_processes|17428_17858_14_not_null|CHECK|updated_at IS NOT NULL
automation|guided_processes|17428_17858_15_not_null|CHECK|source IS NOT NULL
automation|guided_processes|17428_17858_1_not_null|CHECK|id IS NOT NULL
automation|guided_processes|17428_17858_2_not_null|CHECK|code IS NOT NULL
automation|guided_processes|17428_17858_3_not_null|CHECK|name IS NOT NULL
automation|guided_processes|17428_17858_5_not_null|CHECK|collection_id IS NOT NULL
automation|guided_processes|17428_17858_6_not_null|CHECK|application_id IS NOT NULL
automation|guided_processes|17428_17858_7_not_null|CHECK|status IS NOT NULL
automation|guided_processes|17428_17858_8_not_null|CHECK|is_active IS NOT NULL
automation|guided_processes|guided_processes_code_key|UNIQUE|code
automation|guided_processes|guided_processes_pkey|PRIMARY KEY|id
automation|process_flow_definition_revisions|17428_17869_1_not_null|CHECK|id IS NOT NULL
automation|process_flow_definition_revisions|17428_17869_2_not_null|CHECK|process_flow_id IS NOT NULL
automation|process_flow_definition_revisions|17428_17869_3_not_null|CHECK|revision IS NOT NULL
automation|process_flow_definition_revisions|17428_17869_4_not_null|CHECK|status IS NOT NULL
automation|process_flow_definition_revisions|17428_17869_5_not_null|CHECK|payload IS NOT NULL
automation|process_flow_definition_revisions|17428_17869_9_not_null|CHECK|created_at IS NOT NULL
automation|process_flow_definition_revisions|process_flow_definition_revisions_pkey|PRIMARY KEY|id
automation|process_flow_definitions|17428_17877_1_not_null|CHECK|id IS NOT NULL
automation|process_flow_definitions|17428_17877_24_not_null|CHECK|application_id IS NOT NULL
automation|process_flow_definitions|17428_17877_25_not_null|CHECK|status IS NOT NULL
automation|process_flow_definitions|17428_17877_28_not_null|CHECK|source IS NOT NULL
automation|process_flow_definitions|17428_17877_2_not_null|CHECK|name IS NOT NULL
automation|process_flow_definitions|17428_17877_3_not_null|CHECK|code IS NOT NULL
automation|process_flow_definitions|17428_17877_8_not_null|CHECK|canvas IS NOT NULL
automation|process_flow_definitions|17428_17877_9_not_null|CHECK|trigger_type IS NOT NULL
automation|process_flow_definitions|chk_trigger_type|CHECK|(((trigger_type)::text = ANY (ARRAY[('record_created'::characte
automation|process_flow_definitions|process_flow_definitions_code_key|UNIQUE|code
automation|process_flow_definitions|process_flow_definitions_pkey|PRIMARY KEY|id
automation|process_flow_execution_history|17428_17898_1_not_null|CHECK|id IS NOT NULL
automation|process_flow_execution_history|17428_17898_3_not_null|CHECK|node_id IS NOT NULL
automation|process_flow_execution_history|17428_17898_4_not_null|CHECK|node_type IS NOT NULL
automation|process_flow_execution_history|17428_17898_6_not_null|CHECK|action IS NOT NULL
automation|process_flow_execution_history|17428_17898_7_not_null|CHECK|status IS NOT NULL
automation|process_flow_execution_history|chk_history_status|CHECK|(((status)::text = ANY (ARRAY[('started'::character varying)::t
automation|process_flow_execution_history|process_flow_execution_history_pkey|PRIMARY KEY|id
automation|process_flow_instances|17428_17906_1_not_null|CHECK|id IS NOT NULL
automation|process_flow_instances|17428_17906_3_not_null|CHECK|record_id IS NOT NULL
automation|process_flow_instances|chk_instance_state|CHECK|(((state)::text = ANY (ARRAY[('running'::character varying)::te
automation|process_flow_instances|process_flow_instances_pkey|PRIMARY KEY|id
automation|scheduled_jobs|17428_17919_12_not_null|CHECK|is_active IS NOT NULL
automation|scheduled_jobs|17428_17919_16_not_null|CHECK|consecutive_failures IS NOT NULL
automation|scheduled_jobs|17428_17919_17_not_null|CHECK|max_retries IS NOT NULL
automation|scheduled_jobs|17428_17919_18_not_null|CHECK|metadata IS NOT NULL
automation|scheduled_jobs|17428_17919_1_not_null|CHECK|id IS NOT NULL
automation|scheduled_jobs|17428_17919_21_not_null|CHECK|created_at IS NOT NULL
automation|scheduled_jobs|17428_17919_22_not_null|CHECK|updated_at IS NOT NULL
automation|scheduled_jobs|17428_17919_2_not_null|CHECK|name IS NOT NULL
automation|scheduled_jobs|17428_17919_5_not_null|CHECK|frequency IS NOT NULL
automation|scheduled_jobs|17428_17919_7_not_null|CHECK|timezone IS NOT NULL
automation|scheduled_jobs|17428_17919_8_not_null|CHECK|action_type IS NOT NULL
automation|scheduled_jobs|pk_scheduled_jobs|PRIMARY KEY|id
automation|sla_breaches|17428_17934_1_not_null|CHECK|id IS NOT NULL
automation|sla_breaches|17428_17934_4_not_null|CHECK|record_id IS NOT NULL
automation|sla_breaches|17428_17934_6_not_null|CHECK|target_seconds IS NOT NULL
automation|sla_breaches|17428_17934_7_not_null|CHECK|elapsed_seconds IS NOT NULL
automation|sla_breaches|17428_17934_8_not_null|CHECK|breach_amount_seconds IS NOT NULL
automation|sla_breaches|sla_breaches_pkey|PRIMARY KEY|id
automation|sla_definitions|17428_17941_1_not_null|CHECK|id IS NOT NULL
automation|sla_definitions|17428_17941_2_not_null|CHECK|name IS NOT NULL
automation|sla_definitions|17428_17941_3_not_null|CHECK|code IS NOT NULL
automation|sla_definitions|17428_17941_6_not_null|CHECK|sla_type IS NOT NULL
automation|sla_definitions|17428_17941_7_not_null|CHECK|target_minutes IS NOT NULL
automation|sla_definitions|chk_sla_type|CHECK|(((sla_type)::text = ANY (ARRAY[('response'::character varying)
automation|sla_definitions|sla_definitions_code_key|UNIQUE|code
automation|sla_definitions|sla_definitions_pkey|PRIMARY KEY|id
automation|sla_instances|17428_17956_13_not_null|CHECK|target_time IS NOT NULL
automation|sla_instances|17428_17956_1_not_null|CHECK|id IS NOT NULL
automation|sla_instances|17428_17956_3_not_null|CHECK|record_id IS NOT NULL
automation|sla_instances|17428_17956_7_not_null|CHECK|remaining_seconds IS NOT NULL
automation|sla_instances|17428_17956_8_not_null|CHECK|target_seconds IS NOT NULL
automation|sla_instances|17428_17956_9_not_null|CHECK|start_time IS NOT NULL
automation|sla_instances|chk_sla_instance_state|CHECK|(((state)::text = ANY (ARRAY[('active'::character varying)::tex
automation|sla_instances|sla_instances_pkey|PRIMARY KEY|id
automation|state_change_history|17428_17969_1_not_null|CHECK|id IS NOT NULL
automation|state_change_history|17428_17969_2_not_null|CHECK|record_id IS NOT NULL
automation|state_change_history|17428_17969_6_not_null|CHECK|to_state IS NOT NULL
automation|state_change_history|state_change_history_pkey|PRIMARY KEY|id
automation|state_machine_definitions|17428_17976_1_not_null|CHECK|id IS NOT NULL
automation|state_machine_definitions|17428_17976_2_not_null|CHECK|name IS NOT NULL
automation|state_machine_definitions|17428_17976_3_not_null|CHECK|code IS NOT NULL
automation|state_machine_definitions|17428_17976_6_not_null|CHECK|state_field IS NOT NULL
automation|state_machine_definitions|17428_17976_7_not_null|CHECK|states IS NOT NULL
automation|state_machine_definitions|17428_17976_8_not_null|CHECK|transitions IS NOT NULL
automation|state_machine_definitions|state_machine_definitions_code_key|UNIQUE|code
automation|state_machine_definitions|state_machine_definitions_pkey|PRIMARY KEY|id
ava|ava_anomalies|17429_17987_12_not_null|CHECK|is_resolved IS NOT NULL
ava|ava_anomalies|17429_17987_15_not_null|CHECK|detected_at IS NOT NULL
ava|ava_anomalies|17429_17987_17_not_null|CHECK|created_at IS NOT NULL
ava|ava_anomalies|17429_17987_1_not_null|CHECK|id IS NOT NULL
ava|ava_anomalies|17429_17987_2_not_null|CHECK|anomaly_type IS NOT NULL
ava|ava_anomalies|17429_17987_3_not_null|CHECK|severity IS NOT NULL
ava|ava_anomalies|17429_17987_4_not_null|CHECK|description IS NOT NULL
ava|ava_anomalies|ava_anomalies_pkey|PRIMARY KEY|id
ava|ava_audit_trail|17429_17995_18_not_null|CHECK|is_revertible IS NOT NULL
ava|ava_audit_trail|17429_17995_1_not_null|CHECK|id IS NOT NULL
ava|ava_audit_trail|17429_17995_29_not_null|CHECK|created_at IS NOT NULL
ava|ava_audit_trail|17429_17995_2_not_null|CHECK|user_id IS NOT NULL
ava|ava_audit_trail|17429_17995_8_not_null|CHECK|action_type IS NOT NULL
ava|ava_audit_trail|17429_17995_9_not_null|CHECK|status IS NOT NULL
ava|ava_audit_trail|PK_8883aeb20729f23f84dddd4cd2b|PRIMARY KEY|id
ava|ava_cards|17429_18004_1_not_null|CHECK|id IS NOT NULL
ava|ava_cards|17429_18004_2_not_null|CHECK|code IS NOT NULL
ava|ava_cards|17429_18004_3_not_null|CHECK|name IS NOT NULL
ava|ava_cards|ava_cards_code_key|UNIQUE|code
ava|ava_cards|ava_cards_pkey|PRIMARY KEY|id
ava|ava_contexts|17429_18016_1_not_null|CHECK|id IS NOT NULL
ava|ava_contexts|17429_18016_2_not_null|CHECK|user_id IS NOT NULL
ava|ava_contexts|17429_18016_4_not_null|CHECK|context_type IS NOT NULL
ava|ava_contexts|17429_18016_5_not_null|CHECK|context_key IS NOT NULL
ava|ava_contexts|17429_18016_6_not_null|CHECK|context_value IS NOT NULL
ava|ava_contexts|17429_18016_8_not_null|CHECK|created_at IS NOT NULL
ava|ava_contexts|17429_18016_9_not_null|CHECK|updated_at IS NOT NULL
ava|ava_contexts|ava_contexts_pkey|PRIMARY KEY|id
ava|ava_conversations|17429_18024_11_not_null|CHECK|created_at IS NOT NULL
ava|ava_conversations|17429_18024_12_not_null|CHECK|updated_at IS NOT NULL
ava|ava_conversations|17429_18024_1_not_null|CHECK|id IS NOT NULL
ava|ava_conversations|17429_18024_2_not_null|CHECK|user_id IS NOT NULL
ava|ava_conversations|17429_18024_3_not_null|CHECK|status IS NOT NULL
ava|ava_conversations|17429_18024_5_not_null|CHECK|message_count IS NOT NULL
ava|ava_conversations|ava_conversations_pkey|PRIMARY KEY|id
ava|ava_feedback|17429_18034_10_not_null|CHECK|created_at IS NOT NULL
ava|ava_feedback|17429_18034_1_not_null|CHECK|id IS NOT NULL
ava|ava_feedback|17429_18034_2_not_null|CHECK|user_id IS NOT NULL
ava|ava_feedback|17429_18034_5_not_null|CHECK|feedback_type IS NOT NULL
ava|ava_feedback|17429_18034_9_not_null|CHECK|is_processed IS NOT NULL
ava|ava_feedback|ava_feedback_pkey|PRIMARY KEY|id
ava|ava_global_settings|17429_18042_10_not_null|CHECK|user_rate_limit_per_hour IS NOT NULL
ava|ava_global_settings|17429_18042_11_not_null|CHECK|global_rate_limit_per_hour IS NOT NULL
ava|ava_global_settings|17429_18042_13_not_null|CHECK|updated_at IS NOT NULL
ava|ava_global_settings|17429_18042_1_not_null|CHECK|id IS NOT NULL
ava|ava_global_settings|17429_18042_2_not_null|CHECK|ava_enabled IS NOT NULL
ava|ava_global_settings|17429_18042_3_not_null|CHECK|read_only_mode IS NOT NULL
ava|ava_global_settings|17429_18042_4_not_null|CHECK|allow_create_actions IS NOT NULL
ava|ava_global_settings|17429_18042_5_not_null|CHECK|allow_update_actions IS NOT NULL
ava|ava_global_settings|17429_18042_6_not_null|CHECK|allow_delete_actions IS NOT NULL
ava|ava_global_settings|17429_18042_7_not_null|CHECK|allow_execute_actions IS NOT NULL
ava|ava_global_settings|17429_18042_8_not_null|CHECK|default_requires_confirmation IS NOT NULL
ava|ava_global_settings|17429_18042_9_not_null|CHECK|system_read_only_collections IS NOT NULL
ava|ava_global_settings|PK_ae7c69697b886ebe857e9e15239|PRIMARY KEY|id
ava|ava_intents|17429_18059_10_not_null|CHECK|created_at IS NOT NULL
ava|ava_intents|17429_18059_1_not_null|CHECK|id IS NOT NULL
ava|ava_intents|17429_18059_2_not_null|CHECK|message_id IS NOT NULL
ava|ava_intents|17429_18059_3_not_null|CHECK|category IS NOT NULL
ava|ava_intents|17429_18059_4_not_null|CHECK|intent_name IS NOT NULL
ava|ava_intents|17429_18059_5_not_null|CHECK|confidence IS NOT NULL
ava|ava_intents|17429_18059_8_not_null|CHECK|is_clarification_needed IS NOT NULL
ava|ava_intents|ava_intents_pkey|PRIMARY KEY|id
ava|ava_knowledge_embeddings|17429_18067_10_not_null|CHECK|updated_at IS NOT NULL
ava|ava_knowledge_embeddings|17429_18067_1_not_null|CHECK|id IS NOT NULL
ava|ava_knowledge_embeddings|17429_18067_2_not_null|CHECK|source_type IS NOT NULL
ava|ava_knowledge_embeddings|17429_18067_3_not_null|CHECK|source_id IS NOT NULL
ava|ava_knowledge_embeddings|17429_18067_4_not_null|CHECK|content_hash IS NOT NULL
ava|ava_knowledge_embeddings|17429_18067_5_not_null|CHECK|content IS NOT NULL
ava|ava_knowledge_embeddings|17429_18067_6_not_null|CHECK|embedding IS NOT NULL
ava|ava_knowledge_embeddings|17429_18067_7_not_null|CHECK|embedding_model IS NOT NULL
ava|ava_knowledge_embeddings|17429_18067_9_not_null|CHECK|created_at IS NOT NULL
ava|ava_knowledge_embeddings|ava_knowledge_embeddings_pkey|PRIMARY KEY|id
ava|ava_messages|17429_18075_12_not_null|CHECK|created_at IS NOT NULL
ava|ava_messages|17429_18075_1_not_null|CHECK|id IS NOT NULL
ava|ava_messages|17429_18075_2_not_null|CHECK|conversation_id IS NOT NULL
ava|ava_messages|17429_18075_3_not_null|CHECK|role IS NOT NULL
ava|ava_messages|17429_18075_4_not_null|CHECK|content IS NOT NULL
ava|ava_messages|ava_messages_pkey|PRIMARY KEY|id
ava|ava_permission_configs|17429_18082_10_not_null|CHECK|created_at IS NOT NULL
ava|ava_permission_configs|17429_18082_11_not_null|CHECK|updated_at IS NOT NULL
ava|ava_permission_configs|17429_18082_1_not_null|CHECK|id IS NOT NULL
ava|ava_permission_configs|17429_18082_3_not_null|CHECK|action_type IS NOT NULL
ava|ava_permission_configs|17429_18082_4_not_null|CHECK|is_enabled IS NOT NULL
ava|ava_permission_configs|17429_18082_5_not_null|CHECK|requires_confirmation IS NOT NULL
ava|ava_permission_configs|17429_18082_6_not_null|CHECK|allowed_roles IS NOT NULL
ava|ava_permission_configs|17429_18082_7_not_null|CHECK|excluded_roles IS NOT NULL
ava|ava_permission_configs|PK_11683766f65091641045f8ae30f|PRIMARY KEY|id
ava|ava_predictions|17429_18094_11_not_null|CHECK|created_at IS NOT NULL
ava|ava_predictions|17429_18094_1_not_null|CHECK|id IS NOT NULL
ava|ava_predictions|17429_18094_2_not_null|CHECK|prediction_type IS NOT NULL
ava|ava_predictions|17429_18094_3_not_null|CHECK|target_date IS NOT NULL
ava|ava_predictions|17429_18094_4_not_null|CHECK|prediction_value IS NOT NULL
ava|ava_predictions|17429_18094_8_not_null|CHECK|is_active IS NOT NULL
ava|ava_predictions|ava_predictions_pkey|PRIMARY KEY|id
ava|ava_prompt_policies|17429_18102_1_not_null|CHECK|id IS NOT NULL
ava|ava_prompt_policies|17429_18102_2_not_null|CHECK|code IS NOT NULL
ava|ava_prompt_policies|17429_18102_3_not_null|CHECK|name IS NOT NULL
ava|ava_prompt_policies|ava_prompt_policies_code_key|UNIQUE|code
ava|ava_prompt_policies|ava_prompt_policies_pkey|PRIMARY KEY|id
ava|ava_proposal|17429_18113_10_not_null|CHECK|created_at IS NOT NULL
ava|ava_proposal|17429_18113_11_not_null|CHECK|updated_at IS NOT NULL
ava|ava_proposal|17429_18113_1_not_null|CHECK|id IS NOT NULL
ava|ava_proposal|17429_18113_2_not_null|CHECK|kind IS NOT NULL
ava|ava_proposal|17429_18113_3_not_null|CHECK|payload IS NOT NULL
ava|ava_proposal|17429_18113_5_not_null|CHECK|state IS NOT NULL
ava|ava_proposal|ava_proposal_pkey|PRIMARY KEY|id
ava|ava_suggestions|17429_18121_13_not_null|CHECK|created_at IS NOT NULL
ava|ava_suggestions|17429_18121_1_not_null|CHECK|id IS NOT NULL
ava|ava_suggestions|17429_18121_2_not_null|CHECK|user_id IS NOT NULL
ava|ava_suggestions|17429_18121_4_not_null|CHECK|suggestion_type IS NOT NULL
ava|ava_suggestions|17429_18121_7_not_null|CHECK|suggested_value IS NOT NULL
ava|ava_suggestions|ava_suggestions_pkey|PRIMARY KEY|id
ava|ava_tools|17429_18128_1_not_null|CHECK|id IS NOT NULL
ava|ava_tools|17429_18128_2_not_null|CHECK|code IS NOT NULL
ava|ava_tools|17429_18128_3_not_null|CHECK|name IS NOT NULL
ava|ava_tools|ava_tools_code_key|UNIQUE|code
ava|ava_tools|ava_tools_pkey|PRIMARY KEY|id
ava|ava_topics|17429_18142_1_not_null|CHECK|id IS NOT NULL
ava|ava_topics|17429_18142_2_not_null|CHECK|code IS NOT NULL
ava|ava_topics|17429_18142_3_not_null|CHECK|name IS NOT NULL
ava|ava_topics|ava_topics_code_key|UNIQUE|code
ava|ava_topics|ava_topics_pkey|PRIMARY KEY|id
ava|ava_usage_metrics|17429_18154_1_not_null|CHECK|id IS NOT NULL
ava|ava_usage_metrics|17429_18154_3_not_null|CHECK|metric_date IS NOT NULL
ava|ava_usage_metrics|17429_18154_4_not_null|CHECK|metric_type IS NOT NULL
ava|ava_usage_metrics|17429_18154_5_not_null|CHECK|metric_value IS NOT NULL
ava|ava_usage_metrics|17429_18154_7_not_null|CHECK|created_at IS NOT NULL
ava|ava_usage_metrics|ava_usage_metrics_pkey|PRIMARY KEY|id
ava|dataset_definitions|17429_18161_10_not_null|CHECK|version IS NOT NULL
ava|dataset_definitions|17429_18161_11_not_null|CHECK|metadata IS NOT NULL
ava|dataset_definitions|17429_18161_12_not_null|CHECK|is_active IS NOT NULL
ava|dataset_definitions|17429_18161_15_not_null|CHECK|created_at IS NOT NULL
ava|dataset_definitions|17429_18161_16_not_null|CHECK|updated_at IS NOT NULL
ava|dataset_definitions|17429_18161_1_not_null|CHECK|id IS NOT NULL
ava|dataset_definitions|17429_18161_2_not_null|CHECK|code IS NOT NULL
ava|dataset_definitions|17429_18161_3_not_null|CHECK|name IS NOT NULL
ava|dataset_definitions|17429_18161_5_not_null|CHECK|source_collection_code IS NOT NULL
ava|dataset_definitions|17429_18161_6_not_null|CHECK|filter IS NOT NULL
ava|dataset_definitions|17429_18161_7_not_null|CHECK|label_mapping IS NOT NULL
ava|dataset_definitions|17429_18161_8_not_null|CHECK|feature_mapping IS NOT NULL
ava|dataset_definitions|17429_18161_9_not_null|CHECK|status IS NOT NULL
ava|dataset_definitions|dataset_definitions_code_key|UNIQUE|code
ava|dataset_definitions|dataset_definitions_pkey|PRIMARY KEY|id
ava|dataset_snapshots|17429_18176_12_not_null|CHECK|created_at IS NOT NULL
ava|dataset_snapshots|17429_18176_13_not_null|CHECK|updated_at IS NOT NULL
ava|dataset_snapshots|17429_18176_1_not_null|CHECK|id IS NOT NULL
ava|dataset_snapshots|17429_18176_3_not_null|CHECK|status IS NOT NULL
ava|dataset_snapshots|17429_18176_7_not_null|CHECK|metadata IS NOT NULL
ava|dataset_snapshots|dataset_snapshots_pkey|PRIMARY KEY|id
ava|model_artifacts|17429_18186_12_not_null|CHECK|status IS NOT NULL
ava|model_artifacts|17429_18186_13_not_null|CHECK|metadata IS NOT NULL
ava|model_artifacts|17429_18186_16_not_null|CHECK|created_at IS NOT NULL
ava|model_artifacts|17429_18186_17_not_null|CHECK|updated_at IS NOT NULL
ava|model_artifacts|17429_18186_1_not_null|CHECK|id IS NOT NULL
ava|model_artifacts|17429_18186_2_not_null|CHECK|code IS NOT NULL
ava|model_artifacts|17429_18186_3_not_null|CHECK|name IS NOT NULL
ava|model_artifacts|17429_18186_4_not_null|CHECK|version IS NOT NULL
ava|model_artifacts|17429_18186_7_not_null|CHECK|artifact_bucket IS NOT NULL
ava|model_artifacts|17429_18186_8_not_null|CHECK|artifact_key IS NOT NULL
ava|model_artifacts|model_artifacts_pkey|PRIMARY KEY|id
ava|model_deployments|17429_18196_10_not_null|CHECK|created_at IS NOT NULL
ava|model_deployments|17429_18196_11_not_null|CHECK|updated_at IS NOT NULL
ava|model_deployments|17429_18196_1_not_null|CHECK|id IS NOT NULL
ava|model_deployments|17429_18196_3_not_null|CHECK|target_type IS NOT NULL
ava|model_deployments|17429_18196_4_not_null|CHECK|target_config IS NOT NULL
ava|model_deployments|17429_18196_5_not_null|CHECK|status IS NOT NULL
ava|model_deployments|17429_18196_9_not_null|CHECK|metadata IS NOT NULL
ava|model_deployments|model_deployments_pkey|PRIMARY KEY|id
ava|model_evaluations|17429_18207_10_not_null|CHECK|created_at IS NOT NULL
ava|model_evaluations|17429_18207_11_not_null|CHECK|updated_at IS NOT NULL
ava|model_evaluations|17429_18207_1_not_null|CHECK|id IS NOT NULL
ava|model_evaluations|17429_18207_4_not_null|CHECK|metrics IS NOT NULL
ava|model_evaluations|17429_18207_5_not_null|CHECK|confusion_matrix IS NOT NULL
ava|model_evaluations|17429_18207_6_not_null|CHECK|calibration_stats IS NOT NULL
ava|model_evaluations|17429_18207_7_not_null|CHECK|status IS NOT NULL
ava|model_evaluations|17429_18207_8_not_null|CHECK|metadata IS NOT NULL
ava|model_evaluations|model_evaluations_pkey|PRIMARY KEY|id
ava|model_training_jobs|17429_18220_10_not_null|CHECK|status IS NOT NULL
ava|model_training_jobs|17429_18220_16_not_null|CHECK|metadata IS NOT NULL
ava|model_training_jobs|17429_18220_17_not_null|CHECK|created_at IS NOT NULL
ava|model_training_jobs|17429_18220_18_not_null|CHECK|updated_at IS NOT NULL
ava|model_training_jobs|17429_18220_1_not_null|CHECK|id IS NOT NULL
ava|model_training_jobs|17429_18220_3_not_null|CHECK|model_code IS NOT NULL
ava|model_training_jobs|17429_18220_4_not_null|CHECK|model_name IS NOT NULL
ava|model_training_jobs|17429_18220_5_not_null|CHECK|model_version IS NOT NULL
ava|model_training_jobs|17429_18220_6_not_null|CHECK|algorithm IS NOT NULL
ava|model_training_jobs|17429_18220_7_not_null|CHECK|hyperparameters IS NOT NULL
ava|model_training_jobs|17429_18220_8_not_null|CHECK|training_config IS NOT NULL
ava|model_training_jobs|17429_18220_9_not_null|CHECK|metrics IS NOT NULL
ava|model_training_jobs|model_training_jobs_pkey|PRIMARY KEY|id
identity|auth_events|17430_18233_1_not_null|CHECK|id IS NOT NULL
identity|auth_events|17430_18233_3_not_null|CHECK|event_type IS NOT NULL
identity|auth_events|17430_18233_4_not_null|CHECK|success IS NOT NULL
identity|auth_events|17430_18233_8_not_null|CHECK|details IS NOT NULL
identity|auth_events|17430_18233_9_not_null|CHECK|created_at IS NOT NULL
identity|auth_events|PK_ab929cc6084ffb3fd795bd983c0|PRIMARY KEY|id
identity|auth_settings|17430_18241_10_not_null|CHECK|max_failed_attempts IS NOT NULL
identity|auth_settings|17430_18241_11_not_null|CHECK|lockout_duration_minutes IS NOT NULL
identity|auth_settings|17430_18241_12_not_null|CHECK|session_timeout_minutes IS NOT NULL
identity|auth_settings|17430_18241_13_not_null|CHECK|max_concurrent_sessions IS NOT NULL
identity|auth_settings|17430_18241_14_not_null|CHECK|remember_me_duration_days IS NOT NULL
identity|auth_settings|17430_18241_15_not_null|CHECK|mfa_required IS NOT NULL
identity|auth_settings|17430_18241_16_not_null|CHECK|mfa_grace_period_days IS NOT NULL
identity|auth_settings|17430_18241_17_not_null|CHECK|sso_enabled IS NOT NULL
identity|auth_settings|17430_18241_18_not_null|CHECK|sso_enforce IS NOT NULL
identity|auth_settings|17430_18241_1_not_null|CHECK|id IS NOT NULL
identity|auth_settings|17430_18241_20_not_null|CHECK|ip_whitelist_enabled IS NOT NULL
identity|auth_settings|17430_18241_21_not_null|CHECK|ip_whitelist IS NOT NULL
identity|auth_settings|17430_18241_22_not_null|CHECK|allowed_auth_methods IS NOT NULL
identity|auth_settings|17430_18241_23_not_null|CHECK|allow_password_reset IS NOT NULL
identity|auth_settings|17430_18241_24_not_null|CHECK|allow_profile_edit IS NOT NULL
identity|auth_settings|17430_18241_25_not_null|CHECK|allow_mfa_self_enrollment IS NOT NULL
identity|auth_settings|17430_18241_26_not_null|CHECK|created_at IS NOT NULL
identity|auth_settings|17430_18241_27_not_null|CHECK|updated_at IS NOT NULL
identity|auth_settings|17430_18241_2_not_null|CHECK|password_min_length IS NOT NULL
identity|auth_settings|17430_18241_3_not_null|CHECK|password_require_uppercase IS NOT NULL
identity|auth_settings|17430_18241_4_not_null|CHECK|password_require_lowercase IS NOT NULL
identity|auth_settings|17430_18241_5_not_null|CHECK|password_require_numbers IS NOT NULL
identity|auth_settings|17430_18241_6_not_null|CHECK|password_require_symbols IS NOT NULL
identity|auth_settings|17430_18241_7_not_null|CHECK|password_history_count IS NOT NULL
identity|auth_settings|17430_18241_8_not_null|CHECK|password_expiry_days IS NOT NULL
identity|auth_settings|17430_18241_9_not_null|CHECK|password_block_common IS NOT NULL
identity|auth_settings|PK_daf9fe3ab40a3241250fcd21127|PRIMARY KEY|id
identity|behavioral_profiles|17430_18272_10_not_null|CHECK|last_updated_at IS NOT NULL
identity|behavioral_profiles|17430_18272_1_not_null|CHECK|id IS NOT NULL
identity|behavioral_profiles|17430_18272_2_not_null|CHECK|user_id IS NOT NULL
identity|behavioral_profiles|behavioral_profiles_pkey|PRIMARY KEY|id
identity|behavioral_profiles|behavioral_profiles_user_id_key|UNIQUE|user_id
identity|delegations|17430_18290_10_not_null|CHECK|starts_at IS NOT NULL
identity|delegations|17430_18290_11_not_null|CHECK|ends_at IS NOT NULL
identity|delegations|17430_18290_1_not_null|CHECK|id IS NOT NULL
identity|delegations|17430_18290_2_not_null|CHECK|delegator_id IS NOT NULL
identity|delegations|17430_18290_3_not_null|CHECK|delegate_id IS NOT NULL
identity|delegations|17430_18290_4_not_null|CHECK|name IS NOT NULL
identity|delegations|delegations_pkey|PRIMARY KEY|id
identity|email_verification_tokens|17430_18302_1_not_null|CHECK|id IS NOT NULL
identity|email_verification_tokens|17430_18302_2_not_null|CHECK|user_id IS NOT NULL
identity|email_verification_tokens|17430_18302_3_not_null|CHECK|email IS NOT NULL
identity|email_verification_tokens|17430_18302_4_not_null|CHECK|token IS NOT NULL
identity|email_verification_tokens|17430_18302_5_not_null|CHECK|expires_at IS NOT NULL
identity|email_verification_tokens|17430_18302_7_not_null|CHECK|created_at IS NOT NULL
identity|email_verification_tokens|PK_417a095bbed21c2369a6a01ab9a|PRIMARY KEY|id
identity|email_verification_tokens|UQ_3d1613f95c6a564a3b588d161ae|UNIQUE|token
identity|group_members|17430_18309_1_not_null|CHECK|id IS NOT NULL
identity|group_members|17430_18309_2_not_null|CHECK|group_id IS NOT NULL
identity|group_members|17430_18309_3_not_null|CHECK|user_id IS NOT NULL
identity|group_members|17430_18309_4_not_null|CHECK|is_manager IS NOT NULL
identity|group_members|17430_18309_5_not_null|CHECK|valid_from IS NOT NULL
identity|group_members|17430_18309_8_not_null|CHECK|created_at IS NOT NULL
identity|group_members|PK_86446139b2c96bfd0f3b8638852|PRIMARY KEY|id
identity|group_members|UQ_f5939ee0ad233ad35e03f5c65c1|UNIQUE|group_id
identity|group_members|UQ_f5939ee0ad233ad35e03f5c65c1|UNIQUE|user_id
identity|group_roles|17430_18316_1_not_null|CHECK|id IS NOT NULL
identity|group_roles|17430_18316_2_not_null|CHECK|group_id IS NOT NULL
identity|group_roles|17430_18316_3_not_null|CHECK|role_id IS NOT NULL
identity|group_roles|17430_18316_5_not_null|CHECK|created_at IS NOT NULL
identity|group_roles|PK_c88b2351f40bf170bc7ab7e8fda|PRIMARY KEY|id
identity|group_roles|UQ_31cb33278c5d3f7aed58766840a|UNIQUE|group_id
identity|group_roles|UQ_31cb33278c5d3f7aed58766840a|UNIQUE|role_id
identity|groups|17430_18321_10_not_null|CHECK|is_system IS NOT NULL
identity|groups|17430_18321_11_not_null|CHECK|is_active IS NOT NULL
identity|groups|17430_18321_14_not_null|CHECK|metadata IS NOT NULL
identity|groups|17430_18321_16_not_null|CHECK|created_at IS NOT NULL
identity|groups|17430_18321_17_not_null|CHECK|updated_at IS NOT NULL
identity|groups|17430_18321_1_not_null|CHECK|id IS NOT NULL
identity|groups|17430_18321_2_not_null|CHECK|code IS NOT NULL
identity|groups|17430_18321_3_not_null|CHECK|name IS NOT NULL
identity|groups|17430_18321_6_not_null|CHECK|hierarchy_level IS NOT NULL
identity|groups|17430_18321_8_not_null|CHECK|type IS NOT NULL
identity|groups|PK_659d1483316afb28afd3a90646e|PRIMARY KEY|id
identity|groups|UQ_8989cafa0945a366f0c8716e609|UNIQUE|code
identity|impersonation_sessions|17430_18334_1_not_null|CHECK|id IS NOT NULL
identity|impersonation_sessions|17430_18334_2_not_null|CHECK|impersonator_id IS NOT NULL
identity|impersonation_sessions|17430_18334_3_not_null|CHECK|target_user_id IS NOT NULL
identity|impersonation_sessions|17430_18334_4_not_null|CHECK|reason IS NOT NULL
identity|impersonation_sessions|17430_18334_6_not_null|CHECK|started_at IS NOT NULL
identity|impersonation_sessions|17430_18334_8_not_null|CHECK|expires_at IS NOT NULL
identity|impersonation_sessions|17430_18334_9_not_null|CHECK|ip_address IS NOT NULL
identity|impersonation_sessions|impersonation_sessions_pkey|PRIMARY KEY|id
identity|ldap_configs|17430_18344_10_not_null|CHECK|emailAttribute IS NOT NULL
identity|ldap_configs|17430_18344_11_not_null|CHECK|fullNameAttribute IS NOT NULL
identity|ldap_configs|17430_18344_12_not_null|CHECK|enabled IS NOT NULL
identity|ldap_configs|17430_18344_13_not_null|CHECK|createdAt IS NOT NULL
identity|ldap_configs|17430_18344_14_not_null|CHECK|updatedAt IS NOT NULL
identity|ldap_configs|17430_18344_1_not_null|CHECK|id IS NOT NULL
identity|ldap_configs|17430_18344_2_not_null|CHECK|host IS NOT NULL
identity|ldap_configs|17430_18344_3_not_null|CHECK|port IS NOT NULL
identity|ldap_configs|17430_18344_4_not_null|CHECK|secure IS NOT NULL
identity|ldap_configs|17430_18344_7_not_null|CHECK|searchBase IS NOT NULL
identity|ldap_configs|17430_18344_8_not_null|CHECK|userSearchFilter IS NOT NULL
identity|ldap_configs|17430_18344_9_not_null|CHECK|usernameAttribute IS NOT NULL
identity|ldap_configs|PK_617b64e3f20ff5598a11ea7661e|PRIMARY KEY|id
identity|magic_link_tokens|17430_18358_1_not_null|CHECK|id IS NOT NULL
identity|magic_link_tokens|17430_18358_2_not_null|CHECK|email IS NOT NULL
identity|magic_link_tokens|17430_18358_4_not_null|CHECK|token IS NOT NULL
identity|magic_link_tokens|17430_18358_5_not_null|CHECK|expires_at IS NOT NULL
identity|magic_link_tokens|magic_link_tokens_pkey|PRIMARY KEY|id
identity|magic_link_tokens|magic_link_tokens_token_key|UNIQUE|token
identity|mfa_methods|17430_18365_1_not_null|CHECK|id IS NOT NULL
identity|mfa_methods|17430_18365_2_not_null|CHECK|user_id IS NOT NULL
identity|mfa_methods|17430_18365_3_not_null|CHECK|type IS NOT NULL
identity|mfa_methods|17430_18365_6_not_null|CHECK|enabled IS NOT NULL
identity|mfa_methods|17430_18365_7_not_null|CHECK|verified IS NOT NULL
identity|mfa_methods|17430_18365_9_not_null|CHECK|created_at IS NOT NULL
identity|mfa_methods|PK_60e4d183e6dbd427aa5549da581|PRIMARY KEY|id
identity|nav_profile_items|17430_18374_10_not_null|CHECK|position IS NOT NULL
identity|nav_profile_items|17430_18374_13_not_null|CHECK|is_visible IS NOT NULL
identity|nav_profile_items|17430_18374_14_not_null|CHECK|is_expanded IS NOT NULL
identity|nav_profile_items|17430_18374_15_not_null|CHECK|metadata IS NOT NULL
identity|nav_profile_items|17430_18374_16_not_null|CHECK|created_at IS NOT NULL
identity|nav_profile_items|17430_18374_1_not_null|CHECK|id IS NOT NULL
identity|nav_profile_items|17430_18374_2_not_null|CHECK|profile_id IS NOT NULL
identity|nav_profile_items|17430_18374_3_not_null|CHECK|type IS NOT NULL
identity|nav_profile_items|17430_18374_4_not_null|CHECK|code IS NOT NULL
identity|nav_profile_items|17430_18374_5_not_null|CHECK|label IS NOT NULL
identity|nav_profile_items|PK_cb0391e27b4c5bfa13728f5ebf4|PRIMARY KEY|id
identity|nav_profiles|17430_18385_10_not_null|CHECK|is_default IS NOT NULL
identity|nav_profiles|17430_18385_11_not_null|CHECK|is_system IS NOT NULL
identity|nav_profiles|17430_18385_12_not_null|CHECK|is_active IS NOT NULL
identity|nav_profiles|17430_18385_14_not_null|CHECK|created_at IS NOT NULL
identity|nav_profiles|17430_18385_15_not_null|CHECK|updated_at IS NOT NULL
identity|nav_profiles|17430_18385_19_not_null|CHECK|is_locked IS NOT NULL
identity|nav_profiles|17430_18385_1_not_null|CHECK|id IS NOT NULL
identity|nav_profiles|17430_18385_2_not_null|CHECK|code IS NOT NULL
identity|nav_profiles|17430_18385_3_not_null|CHECK|name IS NOT NULL
identity|nav_profiles|17430_18385_5_not_null|CHECK|scope IS NOT NULL
identity|nav_profiles|17430_18385_9_not_null|CHECK|priority IS NOT NULL
identity|nav_profiles|PK_eab82f3592b4f3bdfa425eb651a|PRIMARY KEY|id
identity|nav_profiles|UQ_92556f552f70c0531bdf4fc9d85|UNIQUE|code
identity|password_history|17430_18399_1_not_null|CHECK|id IS NOT NULL
identity|password_history|17430_18399_2_not_null|CHECK|user_id IS NOT NULL
identity|password_history|17430_18399_3_not_null|CHECK|password_hash IS NOT NULL
identity|password_history|17430_18399_4_not_null|CHECK|created_at IS NOT NULL
identity|password_history|PK_da65ed4600e5e6bc9315754a8b2|PRIMARY KEY|id
identity|password_policies|17430_18404_10_not_null|CHECK|lockoutMinutes IS NOT NULL
identity|password_policies|17430_18404_11_not_null|CHECK|createdAt IS NOT NULL
identity|password_policies|17430_18404_12_not_null|CHECK|updatedAt IS NOT NULL
identity|password_policies|17430_18404_1_not_null|CHECK|id IS NOT NULL
identity|password_policies|17430_18404_2_not_null|CHECK|minLength IS NOT NULL
identity|password_policies|17430_18404_3_not_null|CHECK|requireUppercase IS NOT NULL
identity|password_policies|17430_18404_4_not_null|CHECK|requireLowercase IS NOT NULL
identity|password_policies|17430_18404_5_not_null|CHECK|requireNumbers IS NOT NULL
identity|password_policies|17430_18404_6_not_null|CHECK|requireSpecialChars IS NOT NULL
identity|password_policies|17430_18404_7_not_null|CHECK|expirationDays IS NOT NULL
identity|password_policies|17430_18404_8_not_null|CHECK|historyCount IS NOT NULL
identity|password_policies|17430_18404_9_not_null|CHECK|maxAttempts IS NOT NULL
identity|password_policies|PK_5468b65a86afc8563ac81cb9153|PRIMARY KEY|id
identity|password_reset_tokens|17430_18419_1_not_null|CHECK|id IS NOT NULL
identity|password_reset_tokens|17430_18419_2_not_null|CHECK|user_id IS NOT NULL
identity|password_reset_tokens|17430_18419_3_not_null|CHECK|token IS NOT NULL
identity|password_reset_tokens|17430_18419_4_not_null|CHECK|expires_at IS NOT NULL
identity|password_reset_tokens|17430_18419_6_not_null|CHECK|created_at IS NOT NULL
identity|password_reset_tokens|PK_d16bebd73e844c48bca50ff8d3d|PRIMARY KEY|id
identity|password_reset_tokens|UQ_ab673f0e63eac966762155508ee|UNIQUE|token
identity|platform_permissions|17430_18424_1_not_null|CHECK|code IS NOT NULL
identity|platform_permissions|17430_18424_2_not_null|CHECK|plane IS NOT NULL
identity|platform_permissions|17430_18424_3_not_null|CHECK|domain IS NOT NULL
identity|platform_permissions|17430_18424_5_not_null|CHECK|action IS NOT NULL
identity|platform_permissions|17430_18424_6_not_null|CHECK|dangerous IS NOT NULL
identity|platform_permissions|17430_18424_7_not_null|CHECK|description IS NOT NULL
identity|platform_permissions|platform_permissions_pkey|PRIMARY KEY|code
identity|platform_permissions|platform_permissions_plane_check|CHECK|((plane = ANY (ARRAY['instance'::text, 'control-plane'::text]))
identity|refresh_tokens|17430_18433_10_not_null|CHECK|created_at IS NOT NULL
identity|refresh_tokens|17430_18433_11_not_null|CHECK|expires_at IS NOT NULL
identity|refresh_tokens|17430_18433_1_not_null|CHECK|token_hash IS NOT NULL
identity|refresh_tokens|17430_18433_2_not_null|CHECK|family_id IS NOT NULL
identity|refresh_tokens|17430_18433_4_not_null|CHECK|user_id IS NOT NULL
identity|refresh_tokens|17430_18433_6_not_null|CHECK|session_id IS NOT NULL
identity|refresh_tokens|refresh_tokens_pkey|PRIMARY KEY|token_hash
identity|refresh_tokens|refresh_tokens_revoked_reason_check|CHECK|(((revoked_reason IS NULL) OR (revoked_reason = ANY (ARRAY['reu
identity|role_permissions|17430_18440_1_not_null|CHECK|role_id IS NOT NULL
identity|role_permissions|17430_18440_2_not_null|CHECK|permission_code IS NOT NULL
identity|role_permissions|17430_18440_3_not_null|CHECK|granted_at IS NOT NULL
identity|role_permissions|role_permissions_pkey|PRIMARY KEY|permission_code
identity|role_permissions|role_permissions_pkey|PRIMARY KEY|role_id
identity|roles|17430_18448_10_not_null|CHECK|weight IS NOT NULL
identity|roles|17430_18448_11_not_null|CHECK|is_system IS NOT NULL
identity|roles|17430_18448_12_not_null|CHECK|is_active IS NOT NULL
identity|roles|17430_18448_13_not_null|CHECK|is_default IS NOT NULL
identity|roles|17430_18448_16_not_null|CHECK|metadata IS NOT NULL
identity|roles|17430_18448_19_not_null|CHECK|created_at IS NOT NULL
identity|roles|17430_18448_1_not_null|CHECK|id IS NOT NULL
identity|roles|17430_18448_20_not_null|CHECK|updated_at IS NOT NULL
identity|roles|17430_18448_2_not_null|CHECK|code IS NOT NULL
identity|roles|17430_18448_3_not_null|CHECK|name IS NOT NULL
identity|roles|17430_18448_6_not_null|CHECK|hierarchy_level IS NOT NULL
identity|roles|17430_18448_8_not_null|CHECK|scope IS NOT NULL
identity|roles|PK_c1433d71a4838793a49dcad46ab|PRIMARY KEY|id
identity|roles|UQ_f6d54f95c31b73fb1bdd8e91d0c|UNIQUE|code
identity|saml_auth_states|17430_18463_1_not_null|CHECK|id IS NOT NULL
identity|saml_auth_states|17430_18463_2_not_null|CHECK|provider_id IS NOT NULL
identity|saml_auth_states|17430_18463_3_not_null|CHECK|relay_state IS NOT NULL
identity|saml_auth_states|17430_18463_4_not_null|CHECK|redirect_uri IS NOT NULL
identity|saml_auth_states|17430_18463_5_not_null|CHECK|expires_at IS NOT NULL
identity|saml_auth_states|saml_auth_states_pkey|PRIMARY KEY|id
identity|saml_auth_states|saml_auth_states_relay_state_key|UNIQUE|relay_state
identity|security_alerts|17430_18470_1_not_null|CHECK|id IS NOT NULL
identity|security_alerts|17430_18470_3_not_null|CHECK|alert_type IS NOT NULL
identity|security_alerts|17430_18470_4_not_null|CHECK|title IS NOT NULL
identity|security_alerts|17430_18470_5_not_null|CHECK|description IS NOT NULL
identity|security_alerts|17430_18470_6_not_null|CHECK|severity IS NOT NULL
identity|security_alerts|security_alerts_pkey|PRIMARY KEY|id
identity|service_accounts|17430_18481_10_not_null|CHECK|created_at IS NOT NULL
identity|service_accounts|17430_18481_11_not_null|CHECK|updated_at IS NOT NULL
identity|service_accounts|17430_18481_1_not_null|CHECK|id IS NOT NULL
identity|service_accounts|17430_18481_2_not_null|CHECK|name IS NOT NULL
identity|service_accounts|17430_18481_3_not_null|CHECK|client_secret_hash IS NOT NULL
identity|service_accounts|17430_18481_4_not_null|CHECK|allowed_scopes IS NOT NULL
identity|service_accounts|17430_18481_7_not_null|CHECK|status IS NOT NULL
identity|service_accounts|CHK_service_accounts_status|CHECK|(((status)::text = ANY (ARRAY[('active'::character varying)::te
identity|service_accounts|PK_service_accounts|PRIMARY KEY|id
identity|service_token_signing_keys|17430_18492_1_not_null|CHECK|id IS NOT NULL
identity|service_token_signing_keys|17430_18492_2_not_null|CHECK|key_id IS NOT NULL
identity|service_token_signing_keys|17430_18492_3_not_null|CHECK|algorithm IS NOT NULL
identity|service_token_signing_keys|17430_18492_4_not_null|CHECK|public_key_pem IS NOT NULL
identity|service_token_signing_keys|17430_18492_6_not_null|CHECK|status IS NOT NULL
identity|service_token_signing_keys|17430_18492_7_not_null|CHECK|created_at IS NOT NULL
identity|service_token_signing_keys|CHK_service_token_signing_keys_status|CHECK|(((status)::text = ANY (ARRAY[('active'::character varying)::te
identity|service_token_signing_keys|PK_service_token_signing_keys|PRIMARY KEY|id
identity|sso_providers|17430_18502_18_not_null|CHECK|jit_enabled IS NOT NULL
identity|sso_providers|17430_18502_1_not_null|CHECK|id IS NOT NULL
identity|sso_providers|17430_18502_21_not_null|CHECK|jit_update_profile IS NOT NULL
identity|sso_providers|17430_18502_25_not_null|CHECK|display_order IS NOT NULL
identity|sso_providers|17430_18502_28_not_null|CHECK|enabled IS NOT NULL
identity|sso_providers|17430_18502_29_not_null|CHECK|created_at IS NOT NULL
identity|sso_providers|17430_18502_2_not_null|CHECK|name IS NOT NULL
identity|sso_providers|17430_18502_30_not_null|CHECK|updated_at IS NOT NULL
identity|sso_providers|17430_18502_3_not_null|CHECK|slug IS NOT NULL
identity|sso_providers|17430_18502_5_not_null|CHECK|type IS NOT NULL
identity|sso_providers|PK_348feeee9ed68f9161a2f5ffeb0|PRIMARY KEY|id
identity|sso_providers|UQ_85208f3eacf568550f725f5097a|UNIQUE|slug
identity|trusted_devices|17430_18514_14_not_null|CHECK|first_seen_at IS NOT NULL
identity|trusted_devices|17430_18514_15_not_null|CHECK|last_seen_at IS NOT NULL
identity|trusted_devices|17430_18514_1_not_null|CHECK|id IS NOT NULL
identity|trusted_devices|17430_18514_2_not_null|CHECK|user_id IS NOT NULL
identity|trusted_devices|17430_18514_3_not_null|CHECK|device_fingerprint IS NOT NULL
identity|trusted_devices|17430_18514_4_not_null|CHECK|device_name IS NOT NULL
identity|trusted_devices|17430_18514_5_not_null|CHECK|device_type IS NOT NULL
identity|trusted_devices|trusted_devices_pkey|PRIMARY KEY|id
identity|user_invitations|17430_18529_11_not_null|CHECK|invited_by IS NOT NULL
identity|user_invitations|17430_18529_12_not_null|CHECK|created_at IS NOT NULL
identity|user_invitations|17430_18529_1_not_null|CHECK|id IS NOT NULL
identity|user_invitations|17430_18529_2_not_null|CHECK|email IS NOT NULL
identity|user_invitations|17430_18529_3_not_null|CHECK|token IS NOT NULL
identity|user_invitations|17430_18529_4_not_null|CHECK|status IS NOT NULL
identity|user_invitations|17430_18529_5_not_null|CHECK|role_ids IS NOT NULL
identity|user_invitations|17430_18529_6_not_null|CHECK|group_ids IS NOT NULL
identity|user_invitations|17430_18529_8_not_null|CHECK|expires_at IS NOT NULL
identity|user_invitations|PK_c8005acb91c3ce9a7ae581eca8f|PRIMARY KEY|id
identity|user_invitations|UQ_1c885f83eb2a34fedd887e43e82|UNIQUE|token
identity|user_roles|17430_18539_1_not_null|CHECK|id IS NOT NULL
identity|user_roles|17430_18539_2_not_null|CHECK|user_id IS NOT NULL
identity|user_roles|17430_18539_3_not_null|CHECK|role_id IS NOT NULL
identity|user_roles|17430_18539_4_not_null|CHECK|source IS NOT NULL
identity|user_roles|17430_18539_6_not_null|CHECK|valid_from IS NOT NULL
identity|user_roles|17430_18539_9_not_null|CHECK|created_at IS NOT NULL
identity|user_roles|PK_8acd5cf26ebd158416f477de799|PRIMARY KEY|id
identity|user_roles|UQ_23ed6f04fe43066df08379fd034|UNIQUE|role_id
identity|user_roles|UQ_23ed6f04fe43066df08379fd034|UNIQUE|user_id
identity|webauthn_challenges|17430_18546_1_not_null|CHECK|id IS NOT NULL
identity|webauthn_challenges|17430_18546_2_not_null|CHECK|challenge IS NOT NULL
identity|webauthn_challenges|17430_18546_4_not_null|CHECK|type IS NOT NULL
identity|webauthn_challenges|17430_18546_6_not_null|CHECK|expires_at IS NOT NULL
identity|webauthn_challenges|webauthn_challenges_challenge_key|UNIQUE|challenge
identity|webauthn_challenges|webauthn_challenges_pkey|PRIMARY KEY|id
identity|webauthn_credentials|17430_18553_1_not_null|CHECK|id IS NOT NULL
identity|webauthn_credentials|17430_18553_2_not_null|CHECK|user_id IS NOT NULL
identity|webauthn_credentials|17430_18553_3_not_null|CHECK|credential_id IS NOT NULL
identity|webauthn_credentials|17430_18553_4_not_null|CHECK|public_key IS NOT NULL
identity|webauthn_credentials|17430_18553_8_not_null|CHECK|name IS NOT NULL
identity|webauthn_credentials|webauthn_credentials_credential_id_key|UNIQUE|credential_id
identity|webauthn_credentials|webauthn_credentials_pkey|PRIMARY KEY|id
insights|alert_definitions|17431_18567_1_not_null|CHECK|id IS NOT NULL
insights|alert_definitions|17431_18567_2_not_null|CHECK|code IS NOT NULL
insights|alert_definitions|17431_18567_3_not_null|CHECK|name IS NOT NULL
insights|alert_definitions|alert_definitions_code_key|UNIQUE|code
insights|alert_definitions|alert_definitions_pkey|PRIMARY KEY|id
insights|dashboard_definitions|17431_18579_12_not_null|CHECK|scope IS NOT NULL
insights|dashboard_definitions|17431_18579_1_not_null|CHECK|id IS NOT NULL
insights|dashboard_definitions|17431_18579_2_not_null|CHECK|code IS NOT NULL
insights|dashboard_definitions|17431_18579_3_not_null|CHECK|name IS NOT NULL
insights|dashboard_definitions|CHK_dashboard_definitions_scope|CHECK|(((scope)::text = ANY (ARRAY[('system'::character varying)::tex
insights|dashboard_definitions|dashboard_definitions_code_key|UNIQUE|code
insights|dashboard_definitions|dashboard_definitions_pkey|PRIMARY KEY|id
insights|metric_definitions|17431_18592_1_not_null|CHECK|id IS NOT NULL
insights|metric_definitions|17431_18592_2_not_null|CHECK|code IS NOT NULL
insights|metric_definitions|17431_18592_3_not_null|CHECK|name IS NOT NULL
insights|metric_definitions|17431_18592_5_not_null|CHECK|source_type IS NOT NULL
insights|metric_definitions|17431_18592_7_not_null|CHECK|aggregation IS NOT NULL
insights|metric_definitions|17431_18592_8_not_null|CHECK|cadence IS NOT NULL
insights|metric_definitions|metric_definitions_code_key|UNIQUE|code
insights|metric_definitions|metric_definitions_pkey|PRIMARY KEY|id
insights|metric_points|17431_18604_1_not_null|CHECK|id IS NOT NULL
insights|metric_points|17431_18604_2_not_null|CHECK|metric_code IS NOT NULL
insights|metric_points|17431_18604_3_not_null|CHECK|period_start IS NOT NULL
insights|metric_points|17431_18604_4_not_null|CHECK|period_end IS NOT NULL
insights|metric_points|17431_18604_5_not_null|CHECK|value IS NOT NULL
insights|metric_points|metric_points_pkey|PRIMARY KEY|id
integrations|api_keys|17432_18611_11_not_null|CHECK|is_active IS NOT NULL
integrations|api_keys|17432_18611_12_not_null|CHECK|created_at IS NOT NULL
integrations|api_keys|17432_18611_1_not_null|CHECK|id IS NOT NULL
integrations|api_keys|17432_18611_2_not_null|CHECK|user_id IS NOT NULL
integrations|api_keys|17432_18611_3_not_null|CHECK|name IS NOT NULL
integrations|api_keys|17432_18611_4_not_null|CHECK|key_hash IS NOT NULL
integrations|api_keys|17432_18611_5_not_null|CHECK|key_prefix IS NOT NULL
integrations|api_keys|17432_18611_6_not_null|CHECK|scopes IS NOT NULL
integrations|api_keys|PK_5c8a79801b44bd27b79228e1dad|PRIMARY KEY|id
integrations|api_keys|UQ_57384430aa1959f4578046c9b81|UNIQUE|key_hash
integrations|api_request_logs|17432_18620_1_not_null|CHECK|id IS NOT NULL
integrations|api_request_logs|17432_18620_5_not_null|CHECK|method IS NOT NULL
integrations|api_request_logs|17432_18620_6_not_null|CHECK|path IS NOT NULL
integrations|api_request_logs|api_request_logs_pkey|PRIMARY KEY|id
integrations|connector_connections|17432_18627_15_not_null|CHECK|metadata IS NOT NULL
integrations|connector_connections|17432_18627_1_not_null|CHECK|id IS NOT NULL
integrations|connector_connections|17432_18627_3_not_null|CHECK|name IS NOT NULL
integrations|connector_connections|17432_18627_5_not_null|CHECK|config IS NOT NULL
integrations|connector_connections|connector_connections_pkey|PRIMARY KEY|id
integrations|export_jobs|17432_18638_1_not_null|CHECK|id IS NOT NULL
integrations|export_jobs|17432_18638_2_not_null|CHECK|name IS NOT NULL
integrations|export_jobs|17432_18638_5_not_null|CHECK|format IS NOT NULL
integrations|export_jobs|export_jobs_pkey|PRIMARY KEY|id
integrations|external_connectors|17432_18650_10_not_null|CHECK|auth_type IS NOT NULL
integrations|external_connectors|17432_18650_16_not_null|CHECK|metadata IS NOT NULL
integrations|external_connectors|17432_18650_1_not_null|CHECK|id IS NOT NULL
integrations|external_connectors|17432_18650_2_not_null|CHECK|code IS NOT NULL
integrations|external_connectors|17432_18650_3_not_null|CHECK|name IS NOT NULL
integrations|external_connectors|17432_18650_5_not_null|CHECK|type IS NOT NULL
integrations|external_connectors|17432_18650_9_not_null|CHECK|config_schema IS NOT NULL
integrations|external_connectors|external_connectors_code_key|UNIQUE|code
integrations|external_connectors|external_connectors_pkey|PRIMARY KEY|id
integrations|import_jobs|17432_18663_10_not_null|CHECK|field_mapping IS NOT NULL
integrations|import_jobs|17432_18663_1_not_null|CHECK|id IS NOT NULL
integrations|import_jobs|17432_18663_2_not_null|CHECK|name IS NOT NULL
integrations|import_jobs|17432_18663_3_not_null|CHECK|type IS NOT NULL
integrations|import_jobs|17432_18663_4_not_null|CHECK|source_type IS NOT NULL
integrations|import_jobs|import_jobs_pkey|PRIMARY KEY|id
integrations|oauth_access_tokens|17432_18679_1_not_null|CHECK|id IS NOT NULL
integrations|oauth_access_tokens|17432_18679_2_not_null|CHECK|access_token IS NOT NULL
integrations|oauth_access_tokens|17432_18679_6_not_null|CHECK|expires_at IS NOT NULL
integrations|oauth_access_tokens|oauth_access_tokens_access_token_key|UNIQUE|access_token
integrations|oauth_access_tokens|oauth_access_tokens_pkey|PRIMARY KEY|id
integrations|oauth_authorization_codes|17432_18687_10_not_null|CHECK|expires_at IS NOT NULL
integrations|oauth_authorization_codes|17432_18687_1_not_null|CHECK|id IS NOT NULL
integrations|oauth_authorization_codes|17432_18687_2_not_null|CHECK|code IS NOT NULL
integrations|oauth_authorization_codes|17432_18687_4_not_null|CHECK|user_id IS NOT NULL
integrations|oauth_authorization_codes|17432_18687_5_not_null|CHECK|redirect_uri IS NOT NULL
integrations|oauth_authorization_codes|oauth_authorization_codes_code_key|UNIQUE|code
integrations|oauth_authorization_codes|oauth_authorization_codes_pkey|PRIMARY KEY|id
integrations|oauth_clients|17432_18695_1_not_null|CHECK|id IS NOT NULL
integrations|oauth_clients|17432_18695_2_not_null|CHECK|client_id IS NOT NULL
integrations|oauth_clients|17432_18695_3_not_null|CHECK|client_secret_hash IS NOT NULL
integrations|oauth_clients|17432_18695_4_not_null|CHECK|name IS NOT NULL
integrations|oauth_clients|17432_18695_6_not_null|CHECK|client_type IS NOT NULL
integrations|oauth_clients|17432_18695_7_not_null|CHECK|redirect_uris IS NOT NULL
integrations|oauth_clients|17432_18695_8_not_null|CHECK|allowed_scopes IS NOT NULL
integrations|oauth_clients|17432_18695_9_not_null|CHECK|allowed_grant_types IS NOT NULL
integrations|oauth_clients|oauth_clients_client_id_key|UNIQUE|client_id
integrations|oauth_clients|oauth_clients_pkey|PRIMARY KEY|id
integrations|oauth_refresh_tokens|17432_18711_1_not_null|CHECK|id IS NOT NULL
integrations|oauth_refresh_tokens|17432_18711_2_not_null|CHECK|refresh_token IS NOT NULL
integrations|oauth_refresh_tokens|17432_18711_7_not_null|CHECK|expires_at IS NOT NULL
integrations|oauth_refresh_tokens|oauth_refresh_tokens_pkey|PRIMARY KEY|id
integrations|oauth_refresh_tokens|oauth_refresh_tokens_refresh_token_key|UNIQUE|refresh_token
integrations|sync_configurations|17432_18719_1_not_null|CHECK|id IS NOT NULL
integrations|sync_configurations|17432_18719_20_not_null|CHECK|metadata IS NOT NULL
integrations|sync_configurations|17432_18719_2_not_null|CHECK|name IS NOT NULL
integrations|sync_configurations|sync_configurations_pkey|PRIMARY KEY|id
integrations|sync_runs|17432_18736_1_not_null|CHECK|id IS NOT NULL
integrations|sync_runs|sync_runs_pkey|PRIMARY KEY|id
integrations|webhook_deliveries|17432_18754_1_not_null|CHECK|id IS NOT NULL
integrations|webhook_deliveries|17432_18754_3_not_null|CHECK|event_type IS NOT NULL
integrations|webhook_deliveries|17432_18754_4_not_null|CHECK|event_id IS NOT NULL
integrations|webhook_deliveries|17432_18754_5_not_null|CHECK|payload IS NOT NULL
integrations|webhook_deliveries|webhook_deliveries_pkey|PRIMARY KEY|id
integrations|webhook_subscriptions|17432_18765_1_not_null|CHECK|id IS NOT NULL
integrations|webhook_subscriptions|17432_18765_2_not_null|CHECK|name IS NOT NULL
integrations|webhook_subscriptions|17432_18765_4_not_null|CHECK|endpoint_url IS NOT NULL
integrations|webhook_subscriptions|17432_18765_5_not_null|CHECK|secret IS NOT NULL
integrations|webhook_subscriptions|17432_18765_6_not_null|CHECK|events IS NOT NULL
integrations|webhook_subscriptions|webhook_subscriptions_pkey|PRIMARY KEY|id
metadata|application_revisions|17433_18783_1_not_null|CHECK|id IS NOT NULL
metadata|application_revisions|17433_18783_2_not_null|CHECK|application_id IS NOT NULL
metadata|application_revisions|17433_18783_3_not_null|CHECK|revision IS NOT NULL
metadata|application_revisions|17433_18783_4_not_null|CHECK|status IS NOT NULL
metadata|application_revisions|17433_18783_5_not_null|CHECK|payload IS NOT NULL
metadata|application_revisions|17433_18783_9_not_null|CHECK|created_at IS NOT NULL
metadata|application_revisions|application_revisions_pkey|PRIMARY KEY|id
metadata|applications|17433_18791_11_not_null|CHECK|created_at IS NOT NULL
metadata|applications|17433_18791_12_not_null|CHECK|updated_at IS NOT NULL
metadata|applications|17433_18791_1_not_null|CHECK|id IS NOT NULL
metadata|applications|17433_18791_2_not_null|CHECK|code IS NOT NULL
metadata|applications|17433_18791_3_not_null|CHECK|name IS NOT NULL
metadata|applications|17433_18791_6_not_null|CHECK|source IS NOT NULL
metadata|applications|17433_18791_7_not_null|CHECK|status IS NOT NULL
metadata|applications|applications_pkey|PRIMARY KEY|id
metadata|change_packages|17433_18801_13_not_null|CHECK|created_at IS NOT NULL
metadata|change_packages|17433_18801_14_not_null|CHECK|updated_at IS NOT NULL
metadata|change_packages|17433_18801_1_not_null|CHECK|id IS NOT NULL
metadata|change_packages|17433_18801_2_not_null|CHECK|code IS NOT NULL
metadata|change_packages|17433_18801_3_not_null|CHECK|name IS NOT NULL
metadata|change_packages|17433_18801_5_not_null|CHECK|application_id IS NOT NULL
metadata|change_packages|17433_18801_6_not_null|CHECK|status IS NOT NULL
metadata|change_packages|17433_18801_7_not_null|CHECK|changes IS NOT NULL
metadata|change_packages|change_packages_code_key|UNIQUE|code
metadata|change_packages|change_packages_pkey|PRIMARY KEY|id
metadata|choice_items|17433_18811_10_not_null|CHECK|created_at IS NOT NULL
metadata|choice_items|17433_18811_1_not_null|CHECK|id IS NOT NULL
metadata|choice_items|17433_18811_2_not_null|CHECK|choice_list_id IS NOT NULL
metadata|choice_items|17433_18811_3_not_null|CHECK|value IS NOT NULL
metadata|choice_items|17433_18811_4_not_null|CHECK|label IS NOT NULL
metadata|choice_items|17433_18811_5_not_null|CHECK|position IS NOT NULL
metadata|choice_items|17433_18811_8_not_null|CHECK|is_default IS NOT NULL
metadata|choice_items|17433_18811_9_not_null|CHECK|is_active IS NOT NULL
metadata|choice_items|PK_bffbbb5b6dce82a7246514834aa|PRIMARY KEY|id
metadata|choice_items|UQ_9d19126c923b35ffd71c6b08bbd|UNIQUE|choice_list_id
metadata|choice_items|UQ_9d19126c923b35ffd71c6b08bbd|UNIQUE|value
metadata|choice_lists|17433_18821_1_not_null|CHECK|id IS NOT NULL
metadata|choice_lists|17433_18821_2_not_null|CHECK|code IS NOT NULL
metadata|choice_lists|17433_18821_3_not_null|CHECK|name IS NOT NULL
metadata|choice_lists|17433_18821_5_not_null|CHECK|is_system IS NOT NULL
metadata|choice_lists|17433_18821_6_not_null|CHECK|is_active IS NOT NULL
metadata|choice_lists|17433_18821_7_not_null|CHECK|created_at IS NOT NULL
metadata|choice_lists|17433_18821_8_not_null|CHECK|updated_at IS NOT NULL
metadata|choice_lists|PK_32e58b5d1206ca7bd235da92c66|PRIMARY KEY|id
metadata|choice_lists|UQ_931628f1c40bc1d2b193ee07560|UNIQUE|code
metadata|collection_constraints|17433_18831_12_not_null|CHECK|created_at IS NOT NULL
metadata|collection_constraints|17433_18831_13_not_null|CHECK|updated_at IS NOT NULL
metadata|collection_constraints|17433_18831_1_not_null|CHECK|id IS NOT NULL
metadata|collection_constraints|17433_18831_2_not_null|CHECK|collection_id IS NOT NULL
metadata|collection_constraints|17433_18831_3_not_null|CHECK|code IS NOT NULL
metadata|collection_constraints|17433_18831_4_not_null|CHECK|name IS NOT NULL
metadata|collection_constraints|17433_18831_5_not_null|CHECK|constraint_type IS NOT NULL
metadata|collection_constraints|17433_18831_8_not_null|CHECK|is_active IS NOT NULL
metadata|collection_constraints|17433_18831_9_not_null|CHECK|metadata IS NOT NULL
metadata|collection_constraints|chk_collection_constraint_definition|CHECK|(((((constraint_type)::text = 'unique'::text) AND (columns IS N
metadata|collection_constraints|chk_collection_constraint_type|CHECK|(((constraint_type)::text = ANY (ARRAY[('unique'::character var
metadata|collection_constraints|collection_constraints_pkey|PRIMARY KEY|id
metadata|collection_constraints|uq_collection_constraints|UNIQUE|code
metadata|collection_constraints|uq_collection_constraints|UNIQUE|collection_id
metadata|collection_definition_revisions|17433_18843_1_not_null|CHECK|id IS NOT NULL
metadata|collection_definition_revisions|17433_18843_2_not_null|CHECK|collection_id IS NOT NULL
metadata|collection_definition_revisions|17433_18843_3_not_null|CHECK|revision IS NOT NULL
metadata|collection_definition_revisions|17433_18843_4_not_null|CHECK|status IS NOT NULL
metadata|collection_definition_revisions|17433_18843_5_not_null|CHECK|payload IS NOT NULL
metadata|collection_definition_revisions|17433_18843_9_not_null|CHECK|created_at IS NOT NULL
metadata|collection_definition_revisions|collection_definition_revisions_pkey|PRIMARY KEY|id
metadata|collection_definitions|17433_18851_10_not_null|CHECK|label_property IS NOT NULL
metadata|collection_definitions|17433_18851_12_not_null|CHECK|is_extensible IS NOT NULL
metadata|collection_definitions|17433_18851_13_not_null|CHECK|is_audited IS NOT NULL
metadata|collection_definitions|17433_18851_14_not_null|CHECK|enable_versioning IS NOT NULL
metadata|collection_definitions|17433_18851_15_not_null|CHECK|enable_attachments IS NOT NULL
metadata|collection_definitions|17433_18851_16_not_null|CHECK|enable_activity_log IS NOT NULL
metadata|collection_definitions|17433_18851_17_not_null|CHECK|enable_search IS NOT NULL
metadata|collection_definitions|17433_18851_18_not_null|CHECK|is_system IS NOT NULL
metadata|collection_definitions|17433_18851_19_not_null|CHECK|is_active IS NOT NULL
metadata|collection_definitions|17433_18851_1_not_null|CHECK|id IS NOT NULL
metadata|collection_definitions|17433_18851_22_not_null|CHECK|default_access IS NOT NULL
metadata|collection_definitions|17433_18851_23_not_null|CHECK|metadata IS NOT NULL
metadata|collection_definitions|17433_18851_26_not_null|CHECK|created_at IS NOT NULL
metadata|collection_definitions|17433_18851_27_not_null|CHECK|updated_at IS NOT NULL
metadata|collection_definitions|17433_18851_28_not_null|CHECK|owner IS NOT NULL
metadata|collection_definitions|17433_18851_29_not_null|CHECK|sync_status IS NOT NULL
metadata|collection_definitions|17433_18851_2_not_null|CHECK|code IS NOT NULL
metadata|collection_definitions|17433_18851_33_not_null|CHECK|is_locked IS NOT NULL
metadata|collection_definitions|17433_18851_35_not_null|CHECK|status IS NOT NULL
metadata|collection_definitions|17433_18851_38_not_null|CHECK|source IS NOT NULL
metadata|collection_definitions|17433_18851_39_not_null|CHECK|secure_fields_by_default IS NOT NULL
metadata|collection_definitions|17433_18851_3_not_null|CHECK|name IS NOT NULL
metadata|collection_definitions|17433_18851_7_not_null|CHECK|application_id IS NOT NULL
metadata|collection_definitions|17433_18851_8_not_null|CHECK|owner_type IS NOT NULL
metadata|collection_definitions|17433_18851_9_not_null|CHECK|table_name IS NOT NULL
metadata|collection_definitions|PK_92ac9ed8fcf26e5f49e30a29c2a|PRIMARY KEY|id
metadata|collection_definitions|UQ_7c22e7ac994b29b2d8320bf3bcf|UNIQUE|table_name
metadata|collection_definitions|UQ_d74cad0dd7ab2f1144e34e1a816|UNIQUE|code
metadata|collection_indexes|17433_18877_12_not_null|CHECK|created_at IS NOT NULL
metadata|collection_indexes|17433_18877_13_not_null|CHECK|updated_at IS NOT NULL
metadata|collection_indexes|17433_18877_1_not_null|CHECK|id IS NOT NULL
metadata|collection_indexes|17433_18877_2_not_null|CHECK|collection_id IS NOT NULL
metadata|collection_indexes|17433_18877_3_not_null|CHECK|code IS NOT NULL
metadata|collection_indexes|17433_18877_4_not_null|CHECK|name IS NOT NULL
metadata|collection_indexes|17433_18877_5_not_null|CHECK|index_type IS NOT NULL
metadata|collection_indexes|17433_18877_6_not_null|CHECK|columns IS NOT NULL
metadata|collection_indexes|17433_18877_7_not_null|CHECK|is_unique IS NOT NULL
metadata|collection_indexes|17433_18877_8_not_null|CHECK|is_active IS NOT NULL
metadata|collection_indexes|17433_18877_9_not_null|CHECK|metadata IS NOT NULL
metadata|collection_indexes|chk_collection_index_type|CHECK|(((index_type)::text = ANY (ARRAY[('btree'::character varying):
metadata|collection_indexes|collection_indexes_pkey|PRIMARY KEY|id
metadata|collection_indexes|uq_collection_indexes|UNIQUE|code
metadata|collection_indexes|uq_collection_indexes|UNIQUE|collection_id
metadata|dependent_review_queue|17433_18890_10_not_null|CHECK|entity_label IS NOT NULL
metadata|dependent_review_queue|17433_18890_12_not_null|CHECK|reason IS NOT NULL
metadata|dependent_review_queue|17433_18890_13_not_null|CHECK|status IS NOT NULL
metadata|dependent_review_queue|17433_18890_15_not_null|CHECK|created_at IS NOT NULL
metadata|dependent_review_queue|17433_18890_1_not_null|CHECK|id IS NOT NULL
metadata|dependent_review_queue|17433_18890_2_not_null|CHECK|collection_id IS NOT NULL
metadata|dependent_review_queue|17433_18890_3_not_null|CHECK|collection_code IS NOT NULL
metadata|dependent_review_queue|17433_18890_4_not_null|CHECK|property_code IS NOT NULL
metadata|dependent_review_queue|17433_18890_6_not_null|CHECK|change_kind IS NOT NULL
metadata|dependent_review_queue|17433_18890_7_not_null|CHECK|classification IS NOT NULL
metadata|dependent_review_queue|17433_18890_8_not_null|CHECK|entity_type IS NOT NULL
metadata|dependent_review_queue|17433_18890_9_not_null|CHECK|entity_id IS NOT NULL
metadata|dependent_review_queue|dependent_review_queue_pkey|PRIMARY KEY|id
metadata|display_rule_revisions|17433_18898_1_not_null|CHECK|id IS NOT NULL
metadata|display_rule_revisions|17433_18898_2_not_null|CHECK|display_rule_id IS NOT NULL
metadata|display_rule_revisions|17433_18898_3_not_null|CHECK|revision IS NOT NULL
metadata|display_rule_revisions|17433_18898_4_not_null|CHECK|status IS NOT NULL
metadata|display_rule_revisions|17433_18898_5_not_null|CHECK|payload IS NOT NULL
metadata|display_rule_revisions|17433_18898_9_not_null|CHECK|created_at IS NOT NULL
metadata|display_rule_revisions|display_rule_revisions_pkey|PRIMARY KEY|id
metadata|display_rules|17433_18906_10_not_null|CHECK|status IS NOT NULL
metadata|display_rules|17433_18906_15_not_null|CHECK|created_at IS NOT NULL
metadata|display_rules|17433_18906_16_not_null|CHECK|updated_at IS NOT NULL
metadata|display_rules|17433_18906_17_not_null|CHECK|source IS NOT NULL
metadata|display_rules|17433_18906_1_not_null|CHECK|id IS NOT NULL
metadata|display_rules|17433_18906_2_not_null|CHECK|name IS NOT NULL
metadata|display_rules|17433_18906_4_not_null|CHECK|collection_id IS NOT NULL
metadata|display_rules|17433_18906_5_not_null|CHECK|application_id IS NOT NULL
metadata|display_rules|17433_18906_6_not_null|CHECK|condition IS NOT NULL
metadata|display_rules|17433_18906_7_not_null|CHECK|actions IS NOT NULL
metadata|display_rules|17433_18906_8_not_null|CHECK|priority IS NOT NULL
metadata|display_rules|17433_18906_9_not_null|CHECK|is_active IS NOT NULL
metadata|display_rules|display_rules_pkey|PRIMARY KEY|id
metadata|form_definitions|17433_18920_12_not_null|CHECK|source IS NOT NULL
metadata|form_definitions|17433_18920_1_not_null|CHECK|id IS NOT NULL
metadata|form_definitions|17433_18920_2_not_null|CHECK|name IS NOT NULL
metadata|form_definitions|17433_18920_3_not_null|CHECK|collection_id IS NOT NULL
metadata|form_definitions|17433_18920_4_not_null|CHECK|isDefault IS NOT NULL
metadata|form_definitions|17433_18920_6_not_null|CHECK|createdAt IS NOT NULL
metadata|form_definitions|17433_18920_7_not_null|CHECK|updatedAt IS NOT NULL
metadata|form_definitions|17433_18920_8_not_null|CHECK|application_id IS NOT NULL
metadata|form_definitions|17433_18920_9_not_null|CHECK|status IS NOT NULL
metadata|form_definitions|PK_e7b46c89a49ab24f30618b410d9|PRIMARY KEY|id
metadata|form_versions|17433_18931_1_not_null|CHECK|id IS NOT NULL
metadata|form_versions|17433_18931_2_not_null|CHECK|form_id IS NOT NULL
metadata|form_versions|17433_18931_3_not_null|CHECK|version IS NOT NULL
metadata|form_versions|17433_18931_4_not_null|CHECK|layout IS NOT NULL
metadata|form_versions|17433_18931_5_not_null|CHECK|createdAt IS NOT NULL
metadata|form_versions|17433_18931_6_not_null|CHECK|status IS NOT NULL
metadata|form_versions|PK_46dbd35ef6adf11a8684deae1b1|PRIMARY KEY|id
metadata|instance_branding|17433_18939_10_not_null|CHECK|allow_user_customization IS NOT NULL
metadata|instance_branding|17433_18939_11_not_null|CHECK|created_at IS NOT NULL
metadata|instance_branding|17433_18939_12_not_null|CHECK|updated_at IS NOT NULL
metadata|instance_branding|17433_18939_1_not_null|CHECK|id IS NOT NULL
metadata|instance_branding|17433_18939_3_not_null|CHECK|theme_overrides IS NOT NULL
metadata|instance_branding|PK_ffa3a5f407b63635e6c7ec5e421|PRIMARY KEY|id
metadata|locales|17433_18949_10_not_null|CHECK|updated_at IS NOT NULL
metadata|locales|17433_18949_1_not_null|CHECK|id IS NOT NULL
metadata|locales|17433_18949_2_not_null|CHECK|code IS NOT NULL
metadata|locales|17433_18949_3_not_null|CHECK|name IS NOT NULL
metadata|locales|17433_18949_4_not_null|CHECK|direction IS NOT NULL
metadata|locales|17433_18949_5_not_null|CHECK|metadata IS NOT NULL
metadata|locales|17433_18949_6_not_null|CHECK|is_active IS NOT NULL
metadata|locales|17433_18949_9_not_null|CHECK|created_at IS NOT NULL
metadata|locales|locales_pkey|PRIMARY KEY|id
metadata|locales|uq_locales_code|UNIQUE|code
metadata|localization_bundles|17433_18960_10_not_null|CHECK|updated_at IS NOT NULL
metadata|localization_bundles|17433_18960_1_not_null|CHECK|id IS NOT NULL
metadata|localization_bundles|17433_18960_3_not_null|CHECK|locale_code IS NOT NULL
metadata|localization_bundles|17433_18960_4_not_null|CHECK|entries IS NOT NULL
metadata|localization_bundles|17433_18960_5_not_null|CHECK|checksum IS NOT NULL
metadata|localization_bundles|17433_18960_8_not_null|CHECK|metadata IS NOT NULL
metadata|localization_bundles|17433_18960_9_not_null|CHECK|created_at IS NOT NULL
metadata|localization_bundles|localization_bundles_pkey|PRIMARY KEY|id
metadata|localization_bundles|uq_localization_bundles_locale|UNIQUE|locale_code
metadata|module_security|17433_18970_1_not_null|CHECK|id IS NOT NULL
metadata|module_security|17433_18970_2_not_null|CHECK|module_id IS NOT NULL
metadata|module_security|17433_18970_3_not_null|CHECK|role_id IS NOT NULL
metadata|module_security|17433_18970_4_not_null|CHECK|canView IS NOT NULL
metadata|module_security|PK_4e41b3d2d49a520286fb067bffc|PRIMARY KEY|id
metadata|modules|17433_18975_11_not_null|CHECK|is_active IS NOT NULL
metadata|modules|17433_18975_12_not_null|CHECK|createdAt IS NOT NULL
metadata|modules|17433_18975_13_not_null|CHECK|updatedAt IS NOT NULL
metadata|modules|17433_18975_1_not_null|CHECK|id IS NOT NULL
metadata|modules|17433_18975_2_not_null|CHECK|key IS NOT NULL
metadata|modules|17433_18975_4_not_null|CHECK|label IS NOT NULL
metadata|modules|17433_18975_6_not_null|CHECK|sort_order IS NOT NULL
metadata|modules|17433_18975_7_not_null|CHECK|type IS NOT NULL
metadata|modules|PK_7dbefd488bd96c5bf31f0ce0c95|PRIMARY KEY|id
metadata|modules|UQ_a57f2b3bd9ebb022212e634f601|UNIQUE|key
metadata|nav_nodes|17433_18986_10_not_null|CHECK|order IS NOT NULL
metadata|nav_nodes|17433_18986_11_not_null|CHECK|is_visible IS NOT NULL
metadata|nav_nodes|17433_18986_14_not_null|CHECK|created_at IS NOT NULL
metadata|nav_nodes|17433_18986_15_not_null|CHECK|updated_at IS NOT NULL
metadata|nav_nodes|17433_18986_1_not_null|CHECK|id IS NOT NULL
metadata|nav_nodes|17433_18986_2_not_null|CHECK|profile_id IS NOT NULL
metadata|nav_nodes|17433_18986_3_not_null|CHECK|key IS NOT NULL
metadata|nav_nodes|17433_18986_4_not_null|CHECK|label IS NOT NULL
metadata|nav_nodes|17433_18986_6_not_null|CHECK|type IS NOT NULL
metadata|nav_nodes|PK_nav_nodes|PRIMARY KEY|id
metadata|nav_patches|17433_18996_10_not_null|CHECK|updated_at IS NOT NULL
metadata|nav_patches|17433_18996_1_not_null|CHECK|id IS NOT NULL
metadata|nav_patches|17433_18996_2_not_null|CHECK|profile_id IS NOT NULL
metadata|nav_patches|17433_18996_3_not_null|CHECK|operation IS NOT NULL
metadata|nav_patches|17433_18996_4_not_null|CHECK|target_node_key IS NOT NULL
metadata|nav_patches|17433_18996_6_not_null|CHECK|priority IS NOT NULL
metadata|nav_patches|17433_18996_8_not_null|CHECK|is_active IS NOT NULL
metadata|nav_patches|17433_18996_9_not_null|CHECK|created_at IS NOT NULL
metadata|nav_patches|PK_nav_patches|PRIMARY KEY|id
metadata|navigation_module_revisions|17433_19006_1_not_null|CHECK|id IS NOT NULL
metadata|navigation_module_revisions|17433_19006_2_not_null|CHECK|navigation_module_id IS NOT NULL
metadata|navigation_module_revisions|17433_19006_3_not_null|CHECK|revision IS NOT NULL
metadata|navigation_module_revisions|17433_19006_4_not_null|CHECK|status IS NOT NULL
metadata|navigation_module_revisions|17433_19006_5_not_null|CHECK|layout IS NOT NULL
metadata|navigation_module_revisions|17433_19006_9_not_null|CHECK|created_at IS NOT NULL
metadata|navigation_module_revisions|PK_navigation_module_revisions|PRIMARY KEY|id
metadata|navigation_module_revisions|UQ_navigation_module_revision|UNIQUE|navigation_module_id
metadata|navigation_module_revisions|UQ_navigation_module_revision|UNIQUE|revision
metadata|navigation_modules|17433_19014_10_not_null|CHECK|updated_at IS NOT NULL
metadata|navigation_modules|17433_19014_11_not_null|CHECK|application_id IS NOT NULL
metadata|navigation_modules|17433_19014_1_not_null|CHECK|id IS NOT NULL
metadata|navigation_modules|17433_19014_2_not_null|CHECK|code IS NOT NULL
metadata|navigation_modules|17433_19014_3_not_null|CHECK|name IS NOT NULL
metadata|navigation_modules|17433_19014_5_not_null|CHECK|metadata IS NOT NULL
metadata|navigation_modules|17433_19014_6_not_null|CHECK|is_active IS NOT NULL
metadata|navigation_modules|17433_19014_9_not_null|CHECK|created_at IS NOT NULL
metadata|navigation_modules|PK_navigation_modules|PRIMARY KEY|id
metadata|navigation_modules|UQ_navigation_modules_code|UNIQUE|code
metadata|navigation_variants|17433_19024_10_not_null|CHECK|updated_at IS NOT NULL
metadata|navigation_variants|17433_19024_1_not_null|CHECK|id IS NOT NULL
metadata|navigation_variants|17433_19024_2_not_null|CHECK|navigation_module_id IS NOT NULL
metadata|navigation_variants|17433_19024_3_not_null|CHECK|scope IS NOT NULL
metadata|navigation_variants|17433_19024_5_not_null|CHECK|priority IS NOT NULL
metadata|navigation_variants|17433_19024_6_not_null|CHECK|is_active IS NOT NULL
metadata|navigation_variants|17433_19024_9_not_null|CHECK|created_at IS NOT NULL
metadata|navigation_variants|PK_navigation_variants|PRIMARY KEY|id
metadata|pack_install_locks|17433_19032_1_not_null|CHECK|lock_key IS NOT NULL
metadata|pack_install_locks|17433_19032_5_not_null|CHECK|updated_at IS NOT NULL
metadata|pack_install_locks|pack_install_locks_pkey|PRIMARY KEY|lock_key
metadata|pack_object_revisions|17433_19036_1_not_null|CHECK|id IS NOT NULL
metadata|pack_object_revisions|17433_19036_2_not_null|CHECK|release_record_id IS NOT NULL
metadata|pack_object_revisions|17433_19036_3_not_null|CHECK|object_type IS NOT NULL
metadata|pack_object_revisions|17433_19036_4_not_null|CHECK|object_key IS NOT NULL
metadata|pack_object_revisions|17433_19036_5_not_null|CHECK|object_hash IS NOT NULL
metadata|pack_object_revisions|17433_19036_7_not_null|CHECK|content IS NOT NULL
metadata|pack_object_revisions|17433_19036_9_not_null|CHECK|created_at IS NOT NULL
metadata|pack_object_revisions|chk_pack_object_hash|CHECK|(((object_hash)::text ~ '^[a-f0-9]{64}$'::text))
metadata|pack_object_revisions|chk_pack_object_type|CHECK|(((object_type)::text = ANY (ARRAY[('metadata'::character varyi
metadata|pack_object_revisions|pack_object_revisions_pkey|PRIMARY KEY|id
metadata|pack_object_states|17433_19045_10_not_null|CHECK|updated_at IS NOT NULL
metadata|pack_object_states|17433_19045_1_not_null|CHECK|id IS NOT NULL
metadata|pack_object_states|17433_19045_2_not_null|CHECK|object_type IS NOT NULL
metadata|pack_object_states|17433_19045_3_not_null|CHECK|object_key IS NOT NULL
metadata|pack_object_states|17433_19045_4_not_null|CHECK|pack_code IS NOT NULL
metadata|pack_object_states|17433_19045_5_not_null|CHECK|current_revision_id IS NOT NULL
metadata|pack_object_states|17433_19045_6_not_null|CHECK|current_hash IS NOT NULL
metadata|pack_object_states|17433_19045_8_not_null|CHECK|is_active IS NOT NULL
metadata|pack_object_states|17433_19045_9_not_null|CHECK|created_at IS NOT NULL
metadata|pack_object_states|chk_pack_object_state_hash|CHECK|(((current_hash)::text ~ '^[a-f0-9]{64}$'::text))
metadata|pack_object_states|chk_pack_object_state_type|CHECK|(((object_type)::text = ANY (ARRAY[('metadata'::character varyi
metadata|pack_object_states|pack_object_states_pkey|PRIMARY KEY|id
metadata|pack_object_states|uq_pack_object_state|UNIQUE|object_key
metadata|pack_object_states|uq_pack_object_state|UNIQUE|object_type
metadata|pack_release_records|17433_19056_10_not_null|CHECK|applied_by_type IS NOT NULL
metadata|pack_release_records|17433_19056_11_not_null|CHECK|started_at IS NOT NULL
metadata|pack_release_records|17433_19056_14_not_null|CHECK|created_at IS NOT NULL
metadata|pack_release_records|17433_19056_15_not_null|CHECK|updated_at IS NOT NULL
metadata|pack_release_records|17433_19056_1_not_null|CHECK|id IS NOT NULL
metadata|pack_release_records|17433_19056_2_not_null|CHECK|pack_code IS NOT NULL
metadata|pack_release_records|17433_19056_3_not_null|CHECK|pack_release_id IS NOT NULL
metadata|pack_release_records|17433_19056_4_not_null|CHECK|status IS NOT NULL
metadata|pack_release_records|17433_19056_5_not_null|CHECK|manifest IS NOT NULL
metadata|pack_release_records|17433_19056_7_not_null|CHECK|install_summary IS NOT NULL
metadata|pack_release_records|17433_19056_8_not_null|CHECK|warnings IS NOT NULL
metadata|pack_release_records|chk_pack_release_actor|CHECK|(((applied_by_type)::text = ANY (ARRAY[('user'::character varyi
metadata|pack_release_records|chk_pack_release_id_format|CHECK|(((pack_release_id)::text ~ '^[0-9]{8}.[0-9]{3,}$'::text))
metadata|pack_release_records|chk_pack_release_sha256|CHECK|(((artifact_sha256 IS NULL) OR ((artifact_sha256)::text ~ '^[a-
metadata|pack_release_records|chk_pack_release_status|CHECK|(((status)::text = ANY (ARRAY[('applying'::character varying)::
metadata|pack_release_records|pack_release_records_pkey|PRIMARY KEY|id
metadata|property_definition_revisions|17433_19072_1_not_null|CHECK|id IS NOT NULL
metadata|property_definition_revisions|17433_19072_2_not_null|CHECK|property_id IS NOT NULL
metadata|property_definition_revisions|17433_19072_3_not_null|CHECK|revision IS NOT NULL
metadata|property_definition_revisions|17433_19072_4_not_null|CHECK|status IS NOT NULL
metadata|property_definition_revisions|17433_19072_5_not_null|CHECK|payload IS NOT NULL
metadata|property_definition_revisions|17433_19072_9_not_null|CHECK|created_at IS NOT NULL
metadata|property_definition_revisions|property_definition_revisions_pkey|PRIMARY KEY|id
metadata|property_definitions|17433_19080_10_not_null|CHECK|is_unique IS NOT NULL
metadata|property_definitions|17433_19080_11_not_null|CHECK|is_indexed IS NOT NULL
metadata|property_definitions|17433_19080_12_not_null|CHECK|validation_rules IS NOT NULL
metadata|property_definitions|17433_19080_14_not_null|CHECK|default_value_type IS NOT NULL
metadata|property_definitions|17433_19080_15_not_null|CHECK|position IS NOT NULL
metadata|property_definitions|17433_19080_16_not_null|CHECK|is_visible IS NOT NULL
metadata|property_definitions|17433_19080_17_not_null|CHECK|is_readonly IS NOT NULL
metadata|property_definitions|17433_19080_1_not_null|CHECK|id IS NOT NULL
metadata|property_definitions|17433_19080_25_not_null|CHECK|owner_type IS NOT NULL
metadata|property_definitions|17433_19080_26_not_null|CHECK|is_system IS NOT NULL
metadata|property_definitions|17433_19080_27_not_null|CHECK|is_active IS NOT NULL
metadata|property_definitions|17433_19080_28_not_null|CHECK|is_searchable IS NOT NULL
metadata|property_definitions|17433_19080_29_not_null|CHECK|is_sortable IS NOT NULL
metadata|property_definitions|17433_19080_2_not_null|CHECK|collection_id IS NOT NULL
metadata|property_definitions|17433_19080_30_not_null|CHECK|is_filterable IS NOT NULL
metadata|property_definitions|17433_19080_31_not_null|CHECK|metadata IS NOT NULL
metadata|property_definitions|17433_19080_33_not_null|CHECK|created_at IS NOT NULL
metadata|property_definitions|17433_19080_34_not_null|CHECK|updated_at IS NOT NULL
metadata|property_definitions|17433_19080_35_not_null|CHECK|owner IS NOT NULL
metadata|property_definitions|17433_19080_36_not_null|CHECK|sync_status IS NOT NULL
metadata|property_definitions|17433_19080_38_not_null|CHECK|is_locked IS NOT NULL
metadata|property_definitions|17433_19080_3_not_null|CHECK|code IS NOT NULL
metadata|property_definitions|17433_19080_41_not_null|CHECK|is_phi IS NOT NULL
metadata|property_definitions|17433_19080_42_not_null|CHECK|is_pii IS NOT NULL
metadata|property_definitions|17433_19080_43_not_null|CHECK|is_sensitive IS NOT NULL
metadata|property_definitions|17433_19080_44_not_null|CHECK|masking_strategy IS NOT NULL
metadata|property_definitions|17433_19080_46_not_null|CHECK|requires_break_glass IS NOT NULL
metadata|property_definitions|17433_19080_47_not_null|CHECK|application_id IS NOT NULL
metadata|property_definitions|17433_19080_48_not_null|CHECK|status IS NOT NULL
metadata|property_definitions|17433_19080_4_not_null|CHECK|name IS NOT NULL
metadata|property_definitions|17433_19080_51_not_null|CHECK|behavioral_attributes IS NOT NULL
metadata|property_definitions|17433_19080_52_not_null|CHECK|source IS NOT NULL
metadata|property_definitions|17433_19080_6_not_null|CHECK|property_type_id IS NOT NULL
metadata|property_definitions|17433_19080_7_not_null|CHECK|column_name IS NOT NULL
metadata|property_definitions|17433_19080_8_not_null|CHECK|config IS NOT NULL
metadata|property_definitions|17433_19080_9_not_null|CHECK|is_required IS NOT NULL
metadata|property_definitions|PK_09013b5e4e940a81de054ac6fd2|PRIMARY KEY|id
metadata|property_definitions|UQ_2211a0f9fca1a63a5a8ff76bda2|UNIQUE|code
metadata|property_definitions|UQ_2211a0f9fca1a63a5a8ff76bda2|UNIQUE|collection_id
metadata|property_types|17433_19116_11_not_null|CHECK|is_system IS NOT NULL
metadata|property_types|17433_19116_12_not_null|CHECK|created_at IS NOT NULL
metadata|property_types|17433_19116_1_not_null|CHECK|id IS NOT NULL
metadata|property_types|17433_19116_2_not_null|CHECK|code IS NOT NULL
metadata|property_types|17433_19116_3_not_null|CHECK|name IS NOT NULL
metadata|property_types|17433_19116_4_not_null|CHECK|category IS NOT NULL
metadata|property_types|17433_19116_6_not_null|CHECK|base_type IS NOT NULL
metadata|property_types|17433_19116_7_not_null|CHECK|default_config IS NOT NULL
metadata|property_types|17433_19116_8_not_null|CHECK|validation_rules IS NOT NULL
metadata|property_types|PK_129390b286b9c776438dfa475a8|PRIMARY KEY|id
metadata|property_types|UQ_1f7b17d42cf5cbd751912ddda14|UNIQUE|code
metadata|schema_change_log|17433_19126_11_not_null|CHECK|performed_by_type IS NOT NULL
metadata|schema_change_log|17433_19126_12_not_null|CHECK|success IS NOT NULL
metadata|schema_change_log|17433_19126_18_not_null|CHECK|created_at IS NOT NULL
metadata|schema_change_log|17433_19126_1_not_null|CHECK|id IS NOT NULL
metadata|schema_change_log|17433_19126_2_not_null|CHECK|entity_type IS NOT NULL
metadata|schema_change_log|17433_19126_3_not_null|CHECK|entity_id IS NOT NULL
metadata|schema_change_log|17433_19126_4_not_null|CHECK|entity_code IS NOT NULL
metadata|schema_change_log|17433_19126_5_not_null|CHECK|change_type IS NOT NULL
metadata|schema_change_log|17433_19126_6_not_null|CHECK|change_source IS NOT NULL
metadata|schema_change_log|chk_change_source|CHECK|(((change_source)::text = ANY (ARRAY[('api'::character varying)
metadata|schema_change_log|chk_change_type|CHECK|(((change_type)::text = ANY (ARRAY[('create'::character varying
metadata|schema_change_log|chk_entity_type|CHECK|(((entity_type)::text = ANY (ARRAY[('collection'::character var
metadata|schema_change_log|chk_performed_by_type|CHECK|(((performed_by_type)::text = ANY (ARRAY[('user'::character var
metadata|schema_change_log|schema_change_log_pkey|PRIMARY KEY|id
metadata|schema_sync_state|17433_19139_1_not_null|CHECK|id IS NOT NULL
metadata|schema_sync_state|chk_sync_result|CHECK|(((last_full_sync_result IS NULL) OR ((last_full_sync_result)::
metadata|schema_sync_state|schema_sync_state_pkey|PRIMARY KEY|id
metadata|search_dictionaries|17433_19152_10_not_null|CHECK|created_at IS NOT NULL
metadata|search_dictionaries|17433_19152_11_not_null|CHECK|updated_at IS NOT NULL
metadata|search_dictionaries|17433_19152_1_not_null|CHECK|id IS NOT NULL
metadata|search_dictionaries|17433_19152_2_not_null|CHECK|code IS NOT NULL
metadata|search_dictionaries|17433_19152_3_not_null|CHECK|name IS NOT NULL
metadata|search_dictionaries|17433_19152_4_not_null|CHECK|locale IS NOT NULL
metadata|search_dictionaries|17433_19152_5_not_null|CHECK|entries IS NOT NULL
metadata|search_dictionaries|17433_19152_6_not_null|CHECK|metadata IS NOT NULL
metadata|search_dictionaries|17433_19152_7_not_null|CHECK|is_active IS NOT NULL
metadata|search_dictionaries|search_dictionaries_pkey|PRIMARY KEY|id
metadata|search_dictionaries|uq_search_dictionaries_code|UNIQUE|code
metadata|search_experiences|17433_19164_12_not_null|CHECK|created_at IS NOT NULL
metadata|search_experiences|17433_19164_13_not_null|CHECK|updated_at IS NOT NULL
metadata|search_experiences|17433_19164_1_not_null|CHECK|id IS NOT NULL
metadata|search_experiences|17433_19164_2_not_null|CHECK|code IS NOT NULL
metadata|search_experiences|17433_19164_3_not_null|CHECK|name IS NOT NULL
metadata|search_experiences|17433_19164_5_not_null|CHECK|scope IS NOT NULL
metadata|search_experiences|17433_19164_7_not_null|CHECK|config IS NOT NULL
metadata|search_experiences|17433_19164_8_not_null|CHECK|metadata IS NOT NULL
metadata|search_experiences|17433_19164_9_not_null|CHECK|is_active IS NOT NULL
metadata|search_experiences|search_experiences_pkey|PRIMARY KEY|id
metadata|search_experiences|uq_search_experiences_code|UNIQUE|code
metadata|search_index_state|17433_19175_1_not_null|CHECK|id IS NOT NULL
metadata|search_index_state|17433_19175_2_not_null|CHECK|collection_code IS NOT NULL
metadata|search_index_state|17433_19175_3_not_null|CHECK|status IS NOT NULL
metadata|search_index_state|17433_19175_6_not_null|CHECK|stats IS NOT NULL
metadata|search_index_state|17433_19175_7_not_null|CHECK|updated_at IS NOT NULL
metadata|search_index_state|search_index_state_pkey|PRIMARY KEY|id
metadata|search_index_state|uq_search_index_state_collection|UNIQUE|collection_code
metadata|search_sources|17433_19184_11_not_null|CHECK|created_at IS NOT NULL
metadata|search_sources|17433_19184_12_not_null|CHECK|updated_at IS NOT NULL
metadata|search_sources|17433_19184_1_not_null|CHECK|id IS NOT NULL
metadata|search_sources|17433_19184_2_not_null|CHECK|code IS NOT NULL
metadata|search_sources|17433_19184_3_not_null|CHECK|name IS NOT NULL
metadata|search_sources|17433_19184_5_not_null|CHECK|collection_code IS NOT NULL
metadata|search_sources|17433_19184_6_not_null|CHECK|config IS NOT NULL
metadata|search_sources|17433_19184_7_not_null|CHECK|metadata IS NOT NULL
metadata|search_sources|17433_19184_8_not_null|CHECK|is_active IS NOT NULL
metadata|search_sources|search_sources_pkey|PRIMARY KEY|id
metadata|search_sources|uq_search_sources_code|UNIQUE|code
metadata|theme_definitions|17433_19195_10_not_null|CHECK|is_active IS NOT NULL
metadata|theme_definitions|17433_19195_11_not_null|CHECK|is_deletable IS NOT NULL
metadata|theme_definitions|17433_19195_13_not_null|CHECK|created_at IS NOT NULL
metadata|theme_definitions|17433_19195_14_not_null|CHECK|updated_at IS NOT NULL
metadata|theme_definitions|17433_19195_1_not_null|CHECK|id IS NOT NULL
metadata|theme_definitions|17433_19195_2_not_null|CHECK|code IS NOT NULL
metadata|theme_definitions|17433_19195_3_not_null|CHECK|name IS NOT NULL
metadata|theme_definitions|17433_19195_5_not_null|CHECK|config IS NOT NULL
metadata|theme_definitions|17433_19195_6_not_null|CHECK|theme_type IS NOT NULL
metadata|theme_definitions|17433_19195_7_not_null|CHECK|contrast_level IS NOT NULL
metadata|theme_definitions|17433_19195_8_not_null|CHECK|color_scheme IS NOT NULL
metadata|theme_definitions|17433_19195_9_not_null|CHECK|is_default IS NOT NULL
metadata|theme_definitions|PK_e9340ba17d97c17056d05759136|PRIMARY KEY|id
metadata|theme_definitions|UQ_7acdb47306e9b04ff598ca67a8d|UNIQUE|code
metadata|translation_keys|17433_19210_10_not_null|CHECK|created_at IS NOT NULL
metadata|translation_keys|17433_19210_11_not_null|CHECK|updated_at IS NOT NULL
metadata|translation_keys|17433_19210_1_not_null|CHECK|id IS NOT NULL
metadata|translation_keys|17433_19210_2_not_null|CHECK|namespace IS NOT NULL
metadata|translation_keys|17433_19210_3_not_null|CHECK|key IS NOT NULL
metadata|translation_keys|17433_19210_4_not_null|CHECK|default_text IS NOT NULL
metadata|translation_keys|17433_19210_6_not_null|CHECK|metadata IS NOT NULL
metadata|translation_keys|17433_19210_7_not_null|CHECK|is_active IS NOT NULL
metadata|translation_keys|translation_keys_pkey|PRIMARY KEY|id
metadata|translation_keys|uq_translation_keys_namespace_key|UNIQUE|key
metadata|translation_keys|uq_translation_keys_namespace_key|UNIQUE|namespace
metadata|translation_requests|17433_19220_11_not_null|CHECK|created_at IS NOT NULL
metadata|translation_requests|17433_19220_12_not_null|CHECK|updated_at IS NOT NULL
metadata|translation_requests|17433_19220_1_not_null|CHECK|id IS NOT NULL
metadata|translation_requests|17433_19220_4_not_null|CHECK|status IS NOT NULL
metadata|translation_requests|17433_19220_6_not_null|CHECK|reviewer_ids IS NOT NULL
metadata|translation_requests|17433_19220_9_not_null|CHECK|metadata IS NOT NULL
metadata|translation_requests|translation_requests_pkey|PRIMARY KEY|id
metadata|translation_values|17433_19231_10_not_null|CHECK|created_at IS NOT NULL
metadata|translation_values|17433_19231_11_not_null|CHECK|updated_at IS NOT NULL
metadata|translation_values|17433_19231_1_not_null|CHECK|id IS NOT NULL
metadata|translation_values|17433_19231_4_not_null|CHECK|text IS NOT NULL
metadata|translation_values|17433_19231_5_not_null|CHECK|status IS NOT NULL
metadata|translation_values|17433_19231_6_not_null|CHECK|metadata IS NOT NULL
metadata|translation_values|17433_19231_7_not_null|CHECK|is_active IS NOT NULL
metadata|translation_values|translation_values_pkey|PRIMARY KEY|id
metadata|translation_values|uq_translation_values_key_locale|UNIQUE|locale_id
metadata|translation_values|uq_translation_values_key_locale|UNIQUE|translation_key_id
metadata|user_theme_preferences|17433_19242_10_not_null|CHECK|updated_at IS NOT NULL
metadata|user_theme_preferences|17433_19242_1_not_null|CHECK|id IS NOT NULL
metadata|user_theme_preferences|17433_19242_2_not_null|CHECK|user_id IS NOT NULL
metadata|user_theme_preferences|17433_19242_4_not_null|CHECK|custom_overrides IS NOT NULL
metadata|user_theme_preferences|17433_19242_5_not_null|CHECK|color_scheme IS NOT NULL
metadata|user_theme_preferences|17433_19242_6_not_null|CHECK|auto_dark_mode IS NOT NULL
metadata|user_theme_preferences|17433_19242_7_not_null|CHECK|respect_reduced_motion IS NOT NULL
metadata|user_theme_preferences|17433_19242_8_not_null|CHECK|preference_source IS NOT NULL
metadata|user_theme_preferences|17433_19242_9_not_null|CHECK|created_at IS NOT NULL
metadata|user_theme_preferences|PK_d2925210c600e2673134dcf7e8b|PRIMARY KEY|id
metadata|view_definition_revisions|17433_19255_11_not_null|CHECK|created_at IS NOT NULL
metadata|view_definition_revisions|17433_19255_1_not_null|CHECK|id IS NOT NULL
metadata|view_definition_revisions|17433_19255_2_not_null|CHECK|view_definition_id IS NOT NULL
metadata|view_definition_revisions|17433_19255_3_not_null|CHECK|revision IS NOT NULL
metadata|view_definition_revisions|17433_19255_4_not_null|CHECK|status IS NOT NULL
metadata|view_definition_revisions|17433_19255_5_not_null|CHECK|layout IS NOT NULL
metadata|view_definition_revisions|17433_19255_6_not_null|CHECK|widget_bindings IS NOT NULL
metadata|view_definition_revisions|17433_19255_7_not_null|CHECK|actions IS NOT NULL
metadata|view_definition_revisions|PK_view_definition_revisions|PRIMARY KEY|id
metadata|view_definition_revisions|UQ_view_definition_revision|UNIQUE|revision
metadata|view_definition_revisions|UQ_view_definition_revision|UNIQUE|view_definition_id
metadata|view_definitions|17433_19265_11_not_null|CHECK|created_at IS NOT NULL
metadata|view_definitions|17433_19265_12_not_null|CHECK|updated_at IS NOT NULL
metadata|view_definitions|17433_19265_13_not_null|CHECK|application_id IS NOT NULL
metadata|view_definitions|17433_19265_14_not_null|CHECK|source IS NOT NULL
metadata|view_definitions|17433_19265_1_not_null|CHECK|id IS NOT NULL
metadata|view_definitions|17433_19265_2_not_null|CHECK|code IS NOT NULL
metadata|view_definitions|17433_19265_3_not_null|CHECK|name IS NOT NULL
metadata|view_definitions|17433_19265_5_not_null|CHECK|kind IS NOT NULL
metadata|view_definitions|17433_19265_7_not_null|CHECK|metadata IS NOT NULL
metadata|view_definitions|17433_19265_8_not_null|CHECK|is_active IS NOT NULL
metadata|view_definitions|PK_view_definitions|PRIMARY KEY|id
metadata|view_definitions|UQ_view_definitions_code|UNIQUE|code
metadata|view_variants|17433_19276_10_not_null|CHECK|updated_at IS NOT NULL
metadata|view_variants|17433_19276_1_not_null|CHECK|id IS NOT NULL
metadata|view_variants|17433_19276_2_not_null|CHECK|view_definition_id IS NOT NULL
metadata|view_variants|17433_19276_3_not_null|CHECK|scope IS NOT NULL
metadata|view_variants|17433_19276_5_not_null|CHECK|priority IS NOT NULL
metadata|view_variants|17433_19276_6_not_null|CHECK|is_active IS NOT NULL
metadata|view_variants|17433_19276_9_not_null|CHECK|created_at IS NOT NULL
metadata|view_variants|PK_view_variants|PRIMARY KEY|id
metadata|widget_catalog|17433_19284_1_not_null|CHECK|id IS NOT NULL
metadata|widget_catalog|17433_19284_2_not_null|CHECK|code IS NOT NULL
metadata|widget_catalog|17433_19284_3_not_null|CHECK|name IS NOT NULL
metadata|widget_catalog|17433_19284_4_not_null|CHECK|kind IS NOT NULL
metadata|widget_catalog|17433_19284_5_not_null|CHECK|contract IS NOT NULL
metadata|widget_catalog|17433_19284_6_not_null|CHECK|is_active IS NOT NULL
metadata|widget_catalog|17433_19284_7_not_null|CHECK|created_at IS NOT NULL
metadata|widget_catalog|17433_19284_8_not_null|CHECK|updated_at IS NOT NULL
metadata|widget_catalog|17433_19284_9_not_null|CHECK|application_id IS NOT NULL
metadata|widget_catalog|PK_widget_catalog|PRIMARY KEY|id
metadata|widget_catalog|UQ_widget_catalog_code|UNIQUE|code
metadata|workspace_definitions|17433_19294_10_not_null|CHECK|is_active IS NOT NULL
metadata|workspace_definitions|17433_19294_14_not_null|CHECK|created_at IS NOT NULL
metadata|workspace_definitions|17433_19294_15_not_null|CHECK|updated_at IS NOT NULL
metadata|workspace_definitions|17433_19294_1_not_null|CHECK|id IS NOT NULL
metadata|workspace_definitions|17433_19294_2_not_null|CHECK|code IS NOT NULL
metadata|workspace_definitions|17433_19294_3_not_null|CHECK|name IS NOT NULL
metadata|workspace_definitions|17433_19294_5_not_null|CHECK|application_id IS NOT NULL
metadata|workspace_definitions|17433_19294_8_not_null|CHECK|source IS NOT NULL
metadata|workspace_definitions|17433_19294_9_not_null|CHECK|status IS NOT NULL
metadata|workspace_definitions|workspace_definitions_code_key|UNIQUE|code
metadata|workspace_definitions|workspace_definitions_pkey|PRIMARY KEY|id
metadata|workspace_pages|17433_19305_10_not_null|CHECK|created_at IS NOT NULL
metadata|workspace_pages|17433_19305_11_not_null|CHECK|updated_at IS NOT NULL
metadata|workspace_pages|17433_19305_1_not_null|CHECK|id IS NOT NULL
metadata|workspace_pages|17433_19305_2_not_null|CHECK|workspace_id IS NOT NULL
metadata|workspace_pages|17433_19305_3_not_null|CHECK|code IS NOT NULL
metadata|workspace_pages|17433_19305_4_not_null|CHECK|name IS NOT NULL
metadata|workspace_pages|17433_19305_5_not_null|CHECK|kind IS NOT NULL
metadata|workspace_pages|17433_19305_6_not_null|CHECK|position IS NOT NULL
metadata|workspace_pages|17433_19305_7_not_null|CHECK|layout IS NOT NULL
metadata|workspace_pages|17433_19305_8_not_null|CHECK|source IS NOT NULL
metadata|workspace_pages|workspace_pages_pkey|PRIMARY KEY|id
metadata|workspace_variants|17433_19316_10_not_null|CHECK|updated_at IS NOT NULL
metadata|workspace_variants|17433_19316_1_not_null|CHECK|id IS NOT NULL
metadata|workspace_variants|17433_19316_2_not_null|CHECK|workspace_id IS NOT NULL
metadata|workspace_variants|17433_19316_3_not_null|CHECK|page_id IS NOT NULL
metadata|workspace_variants|17433_19316_4_not_null|CHECK|scope IS NOT NULL
metadata|workspace_variants|17433_19316_6_not_null|CHECK|priority IS NOT NULL
metadata|workspace_variants|17433_19316_7_not_null|CHECK|layout IS NOT NULL
metadata|workspace_variants|17433_19316_9_not_null|CHECK|created_at IS NOT NULL
metadata|workspace_variants|workspace_variants_pkey|PRIMARY KEY|id
notify|device_tokens|17434_19326_1_not_null|CHECK|id IS NOT NULL
notify|device_tokens|17434_19326_2_not_null|CHECK|user_id IS NOT NULL
notify|device_tokens|17434_19326_3_not_null|CHECK|token IS NOT NULL
notify|device_tokens|17434_19326_4_not_null|CHECK|platform IS NOT NULL
notify|device_tokens|chk_device_platform|CHECK|(((platform)::text = ANY (ARRAY[('ios'::character varying)::tex
notify|device_tokens|device_tokens_pkey|PRIMARY KEY|id
notify|device_tokens|device_tokens_token_key|UNIQUE|token
notify|in_app_notifications|17434_19336_1_not_null|CHECK|id IS NOT NULL
notify|in_app_notifications|17434_19336_2_not_null|CHECK|user_id IS NOT NULL
notify|in_app_notifications|17434_19336_3_not_null|CHECK|title IS NOT NULL
notify|in_app_notifications|17434_19336_4_not_null|CHECK|body IS NOT NULL
notify|in_app_notifications|chk_in_app_priority|CHECK|(((priority)::text = ANY (ARRAY[('low'::character varying)::tex
notify|in_app_notifications|in_app_notifications_pkey|PRIMARY KEY|id
notify|notification_history|17434_19347_1_not_null|CHECK|id IS NOT NULL
notify|notification_history|17434_19347_3_not_null|CHECK|channel IS NOT NULL
notify|notification_history|17434_19347_4_not_null|CHECK|recipient_id IS NOT NULL
notify|notification_history|chk_notification_channel|CHECK|(((channel)::text = ANY (ARRAY[('email'::character varying)::te
notify|notification_history|notification_history_pkey|PRIMARY KEY|id
notify|notification_queue|17434_19355_1_not_null|CHECK|id IS NOT NULL
notify|notification_queue|17434_19355_3_not_null|CHECK|recipient_id IS NOT NULL
notify|notification_queue|17434_19355_4_not_null|CHECK|channels IS NOT NULL
notify|notification_queue|17434_19355_5_not_null|CHECK|context IS NOT NULL
notify|notification_queue|chk_notification_priority|CHECK|(((priority)::text = ANY (ARRAY[('low'::character varying)::tex
notify|notification_queue|chk_notification_status|CHECK|(((status)::text = ANY (ARRAY[('pending'::character varying)::t
notify|notification_queue|notification_queue_pkey|PRIMARY KEY|id
notify|notification_templates|17434_19370_1_not_null|CHECK|id IS NOT NULL
notify|notification_templates|17434_19370_2_not_null|CHECK|name IS NOT NULL
notify|notification_templates|17434_19370_3_not_null|CHECK|code IS NOT NULL
notify|notification_templates|17434_19370_5_not_null|CHECK|category IS NOT NULL
notify|notification_templates|notification_templates_code_key|UNIQUE|code
notify|notification_templates|notification_templates_pkey|PRIMARY KEY|id
notify|user_notification_preferences|17434_19384_1_not_null|CHECK|id IS NOT NULL
notify|user_notification_preferences|17434_19384_2_not_null|CHECK|user_id IS NOT NULL
notify|user_notification_preferences|17434_19384_3_not_null|CHECK|preferences IS NOT NULL
notify|user_notification_preferences|chk_digest_frequency|CHECK|(((digest_frequency)::text = ANY (ARRAY[('daily'::character var
notify|user_notification_preferences|user_notification_preferences_pkey|PRIMARY KEY|id
notify|user_notification_preferences|user_notification_preferences_user_id_key|UNIQUE|user_id
public|access_audit_logs|2200_19403_1_not_null|CHECK|id IS NOT NULL
public|access_audit_logs|2200_19403_2_not_null|CHECK|user_id IS NOT NULL
public|access_audit_logs|2200_19403_3_not_null|CHECK|resource IS NOT NULL
public|access_audit_logs|2200_19403_4_not_null|CHECK|action IS NOT NULL
public|access_audit_logs|2200_19403_5_not_null|CHECK|decision IS NOT NULL
public|access_audit_logs|2200_19403_7_not_null|CHECK|timestamp IS NOT NULL
public|access_audit_logs|PK_92362eda47f20e6eff693801adc|PRIMARY KEY|id
public|access_condition_groups|2200_19410_1_not_null|CHECK|id IS NOT NULL
public|access_condition_groups|2200_19410_2_not_null|CHECK|rule_id IS NOT NULL
public|access_condition_groups|2200_19410_3_not_null|CHECK|logic IS NOT NULL
public|access_condition_groups|PK_a08fcc4ccef7a20eb06585d161d|PRIMARY KEY|id
public|access_conditions|2200_19416_1_not_null|CHECK|id IS NOT NULL
public|access_conditions|2200_19416_2_not_null|CHECK|rule_id IS NOT NULL
public|access_conditions|2200_19416_3_not_null|CHECK|field IS NOT NULL
public|access_conditions|2200_19416_4_not_null|CHECK|operator IS NOT NULL
public|access_conditions|2200_19416_5_not_null|CHECK|value IS NOT NULL
public|access_conditions|PK_dc7b7cc80c74b4cb2c2c908bc8e|PRIMARY KEY|id
public|access_rule_audit_logs|2200_19422_1_not_null|CHECK|id IS NOT NULL
public|access_rule_audit_logs|2200_19422_2_not_null|CHECK|rule_id IS NOT NULL
public|access_rule_audit_logs|2200_19422_3_not_null|CHECK|action IS NOT NULL
public|access_rule_audit_logs|2200_19422_5_not_null|CHECK|performed_by IS NOT NULL
public|access_rule_audit_logs|2200_19422_6_not_null|CHECK|performedAt IS NOT NULL
public|access_rule_audit_logs|PK_eabc37285db4504f74492eb2757|PRIMARY KEY|id
public|audit_logs|2200_19429_10_not_null|CHECK|created_at IS NOT NULL
public|audit_logs|2200_19429_1_not_null|CHECK|id IS NOT NULL
public|audit_logs|2200_19429_5_not_null|CHECK|action IS NOT NULL
public|audit_logs|PK_1bb179d048bbc581caa3b013439|PRIMARY KEY|id
public|collection_access_rules|2200_19436_10_not_null|CHECK|can_update IS NOT NULL
public|collection_access_rules|2200_19436_11_not_null|CHECK|can_delete IS NOT NULL
public|collection_access_rules|2200_19436_13_not_null|CHECK|priority IS NOT NULL
public|collection_access_rules|2200_19436_14_not_null|CHECK|is_active IS NOT NULL
public|collection_access_rules|2200_19436_16_not_null|CHECK|created_at IS NOT NULL
public|collection_access_rules|2200_19436_17_not_null|CHECK|updated_at IS NOT NULL
public|collection_access_rules|2200_19436_19_not_null|CHECK|metadata IS NOT NULL
public|collection_access_rules|2200_19436_1_not_null|CHECK|id IS NOT NULL
public|collection_access_rules|2200_19436_20_not_null|CHECK|effect IS NOT NULL
public|collection_access_rules|2200_19436_2_not_null|CHECK|collection_id IS NOT NULL
public|collection_access_rules|2200_19436_3_not_null|CHECK|name IS NOT NULL
public|collection_access_rules|2200_19436_8_not_null|CHECK|can_read IS NOT NULL
public|collection_access_rules|2200_19436_9_not_null|CHECK|can_create IS NOT NULL
public|collection_access_rules|CHK_collection_access_rules_effect|CHECK|(((effect)::text = ANY (ARRAY[('allow'::character varying)::tex
public|collection_access_rules|PK_685125fdb89c2749d2c76bca5a2|PRIMARY KEY|id
public|config_change_history|2200_19474_1_not_null|CHECK|id IS NOT NULL
public|config_change_history|2200_19474_2_not_null|CHECK|configType IS NOT NULL
public|config_change_history|2200_19474_4_not_null|CHECK|changeType IS NOT NULL
public|config_change_history|2200_19474_7_not_null|CHECK|changedAt IS NOT NULL
public|config_change_history|PK_1be86c25d2fc54beef9398c6991|PRIMARY KEY|id
public|field_mappings|2200_19481_1_not_null|CHECK|id IS NOT NULL
public|field_mappings|2200_19481_3_not_null|CHECK|name IS NOT NULL
public|field_mappings|2200_19481_4_not_null|CHECK|source_entity IS NOT NULL
public|field_mappings|2200_19481_7_not_null|CHECK|mappings IS NOT NULL
public|field_mappings|field_mappings_pkey|PRIMARY KEY|id
public|formula_cache|2200_19453_14_not_null|CHECK|created_at IS NOT NULL
public|formula_cache|2200_19453_15_not_null|CHECK|updated_at IS NOT NULL
public|formula_cache|2200_19453_1_not_null|CHECK|id IS NOT NULL
public|formula_cache|2200_19453_2_not_null|CHECK|collection_id IS NOT NULL
public|formula_cache|2200_19453_3_not_null|CHECK|property_id IS NOT NULL
public|formula_cache|2200_19453_4_not_null|CHECK|record_id IS NOT NULL
public|formula_cache|2200_19453_6_not_null|CHECK|value_type IS NOT NULL
public|formula_cache|2200_19453_7_not_null|CHECK|formula_hash IS NOT NULL
public|formula_cache|2200_19453_9_not_null|CHECK|calculated_at IS NOT NULL
public|formula_cache|chk_value_type|CHECK|(((value_type)::text = ANY (ARRAY[('string'::character varying)
public|formula_cache|formula_cache_pkey|PRIMARY KEY|id
public|inline_editing_test|2200_19495_1_not_null|CHECK|id IS NOT NULL
public|inline_editing_test|2200_19495_21_not_null|CHECK|created_at IS NOT NULL
public|inline_editing_test|2200_19495_22_not_null|CHECK|updated_at IS NOT NULL
public|inline_editing_test|inline_editing_test_pkey|PRIMARY KEY|id
public|instance_customizations|2200_19506_12_not_null|CHECK|created_at IS NOT NULL
public|instance_customizations|2200_19506_13_not_null|CHECK|updated_at IS NOT NULL
public|instance_customizations|2200_19506_1_not_null|CHECK|id IS NOT NULL
public|instance_customizations|2200_19506_2_not_null|CHECK|instance_id IS NOT NULL
public|instance_customizations|2200_19506_3_not_null|CHECK|config_type IS NOT NULL
public|instance_customizations|2200_19506_4_not_null|CHECK|resource_key IS NOT NULL
public|instance_customizations|2200_19506_5_not_null|CHECK|customization_type IS NOT NULL
public|instance_customizations|2200_19506_7_not_null|CHECK|custom_value IS NOT NULL
public|instance_customizations|2200_19506_9_not_null|CHECK|is_active IS NOT NULL
public|instance_customizations|instance_customizations_pkey|PRIMARY KEY|id
public|instance_event_outbox|2200_19517_11_not_null|CHECK|created_at IS NOT NULL
public|instance_event_outbox|2200_19517_1_not_null|CHECK|id IS NOT NULL
public|instance_event_outbox|2200_19517_2_not_null|CHECK|event_type IS NOT NULL
public|instance_event_outbox|2200_19517_5_not_null|CHECK|payload IS NOT NULL
public|instance_event_outbox|2200_19517_6_not_null|CHECK|status IS NOT NULL
public|instance_event_outbox|2200_19517_7_not_null|CHECK|attempts IS NOT NULL
public|instance_event_outbox|instance_event_outbox_pkey|PRIMARY KEY|id
public|instance_settings|2200_19526_1_not_null|CHECK|id IS NOT NULL
public|instance_settings|2200_19526_2_not_null|CHECK|category IS NOT NULL
public|instance_settings|2200_19526_3_not_null|CHECK|key IS NOT NULL
public|instance_settings|2200_19526_4_not_null|CHECK|value IS NOT NULL
public|instance_settings|2200_19526_6_not_null|CHECK|is_system IS NOT NULL
public|instance_settings|2200_19526_8_not_null|CHECK|created_at IS NOT NULL
public|instance_settings|2200_19526_9_not_null|CHECK|updated_at IS NOT NULL
public|instance_settings|PK_eb2567a5e4188cd54689e1d79ef|PRIMARY KEY|id
public|instance_settings|UQ_f4841fbd4c9819d5ade4b5dfeb8|UNIQUE|key
public|instance_upgrade_impact|2200_19535_12_not_null|CHECK|status IS NOT NULL
public|instance_upgrade_impact|2200_19535_16_not_null|CHECK|created_at IS NOT NULL
public|instance_upgrade_impact|2200_19535_17_not_null|CHECK|updated_at IS NOT NULL
public|instance_upgrade_impact|2200_19535_1_not_null|CHECK|id IS NOT NULL
public|instance_upgrade_impact|2200_19535_2_not_null|CHECK|instance_id IS NOT NULL
public|instance_upgrade_impact|2200_19535_4_not_null|CHECK|config_type IS NOT NULL
public|instance_upgrade_impact|2200_19535_5_not_null|CHECK|resource_key IS NOT NULL
public|instance_upgrade_impact|2200_19535_6_not_null|CHECK|impact_type IS NOT NULL
public|instance_upgrade_impact|2200_19535_7_not_null|CHECK|impact_severity IS NOT NULL
public|instance_upgrade_impact|instance_upgrade_impact_pkey|PRIMARY KEY|id
public|key_metadata|2200_19546_1_not_null|CHECK|kid IS NOT NULL
public|key_metadata|2200_19546_2_not_null|CHECK|provider IS NOT NULL
public|key_metadata|2200_19546_5_not_null|CHECK|algorithm IS NOT NULL
public|key_metadata|2200_19546_6_not_null|CHECK|state IS NOT NULL
public|key_metadata|2200_19546_7_not_null|CHECK|public_key_pem IS NOT NULL
public|key_metadata|2200_19546_9_not_null|CHECK|created_at IS NOT NULL
public|key_metadata|key_metadata_algorithm_check|CHECK|((algorithm = 'ES256'::text))
public|key_metadata|key_metadata_pkey|PRIMARY KEY|kid
public|key_metadata|key_metadata_provider_check|CHECK|((provider = ANY (ARRAY['aws-kms'::text, 'local-es256'::text]))
public|key_metadata|key_metadata_state_check|CHECK|((state = ANY (ARRAY['pending'::text, 'active'::text, 'retiring
public|migrations|2200_17419_1_not_null|CHECK|id IS NOT NULL
public|migrations|2200_17419_2_not_null|CHECK|timestamp IS NOT NULL
public|migrations|2200_17419_3_not_null|CHECK|name IS NOT NULL
public|migrations|PK_8c82d7f526340ab734260ea46be|PRIMARY KEY|id
public|platform_config|2200_19556_1_not_null|CHECK|id IS NOT NULL
public|platform_config|2200_19556_2_not_null|CHECK|key IS NOT NULL
public|platform_config|2200_19556_3_not_null|CHECK|value IS NOT NULL
public|platform_config|2200_19556_4_not_null|CHECK|value_type IS NOT NULL
public|platform_config|2200_19556_6_not_null|CHECK|is_system IS NOT NULL
public|platform_config|2200_19556_7_not_null|CHECK|created_at IS NOT NULL
public|platform_config|2200_19556_8_not_null|CHECK|updated_at IS NOT NULL
public|platform_config|platform_config_pkey|PRIMARY KEY|id
public|property_access_rules|2200_19566_10_not_null|CHECK|is_active IS NOT NULL
public|property_access_rules|2200_19566_12_not_null|CHECK|created_at IS NOT NULL
public|property_access_rules|2200_19566_13_not_null|CHECK|masking_strategy IS NOT NULL
public|property_access_rules|2200_19566_14_not_null|CHECK|updated_at IS NOT NULL
public|property_access_rules|2200_19566_16_not_null|CHECK|metadata IS NOT NULL
public|property_access_rules|2200_19566_17_not_null|CHECK|effect IS NOT NULL
public|property_access_rules|2200_19566_1_not_null|CHECK|id IS NOT NULL
public|property_access_rules|2200_19566_6_not_null|CHECK|can_read IS NOT NULL
public|property_access_rules|2200_19566_7_not_null|CHECK|can_write IS NOT NULL
public|property_access_rules|2200_19566_9_not_null|CHECK|priority IS NOT NULL
public|property_access_rules|CHK_property_access_rules_effect|CHECK|(((effect)::text = ANY (ARRAY[('allow'::character varying)::tex
public|property_access_rules|CHK_property_access_rules_target_xor|CHECK|((((property_id IS NOT NULL) AND (wildcard_collection_id IS NUL
public|property_access_rules|PK_64e3b9fa96a1735ba4741905d88|PRIMARY KEY|id
public|property_audit_logs|2200_19583_1_not_null|CHECK|id IS NOT NULL
public|property_audit_logs|2200_19583_2_not_null|CHECK|property_id IS NOT NULL
public|property_audit_logs|2200_19583_3_not_null|CHECK|record_id IS NOT NULL
public|property_audit_logs|2200_19583_6_not_null|CHECK|changed_by IS NOT NULL
public|property_audit_logs|2200_19583_7_not_null|CHECK|changedAt IS NOT NULL
public|property_audit_logs|PK_3878feaf1d72785e4c4fa1d6c53|PRIMARY KEY|id
public|property_dependencies|2200_19465_1_not_null|CHECK|id IS NOT NULL
public|property_dependencies|2200_19465_2_not_null|CHECK|property_id IS NOT NULL
public|property_dependencies|2200_19465_3_not_null|CHECK|collection_id IS NOT NULL
public|property_dependencies|2200_19465_6_not_null|CHECK|dependency_type IS NOT NULL
public|property_dependencies|2200_19465_9_not_null|CHECK|created_at IS NOT NULL
public|property_dependencies|chk_dependency_type|CHECK|(((dependency_type)::text = ANY (ARRAY[('formula'::character va
public|property_dependencies|property_dependencies_pkey|PRIMARY KEY|id
public|runtime_anomaly|2200_19590_1_not_null|CHECK|id IS NOT NULL
public|runtime_anomaly|2200_19590_2_not_null|CHECK|kind IS NOT NULL
public|runtime_anomaly|2200_19590_3_not_null|CHECK|service_code IS NOT NULL
public|runtime_anomaly|2200_19590_6_not_null|CHECK|message IS NOT NULL
public|runtime_anomaly|2200_19590_9_not_null|CHECK|occurred_at IS NOT NULL
public|runtime_anomaly|runtime_anomaly_pkey|PRIMARY KEY|id
public|schema_versions|2200_19597_10_not_null|CHECK|created_at IS NOT NULL
public|schema_versions|2200_19597_1_not_null|CHECK|id IS NOT NULL
public|schema_versions|2200_19597_2_not_null|CHECK|version IS NOT NULL
public|schema_versions|2200_19597_3_not_null|CHECK|collection_code IS NOT NULL
public|schema_versions|2200_19597_4_not_null|CHECK|snapshot IS NOT NULL
public|schema_versions|2200_19597_5_not_null|CHECK|change_type IS NOT NULL
public|schema_versions|2200_19597_6_not_null|CHECK|change_summary IS NOT NULL
public|schema_versions|2200_19597_7_not_null|CHECK|created_by IS NOT NULL
public|schema_versions|chk_schema_versions_change_type|CHECK|(((change_type)::text = ANY (ARRAY[('collection_created'::chara
public|schema_versions|schema_versions_pkey|PRIMARY KEY|id
public|schema_versions|uq_schema_versions_collection_version|UNIQUE|collection_code
public|schema_versions|uq_schema_versions_collection_version|UNIQUE|version
public|search_embeddings|2200_19605_1_not_null|CHECK|id IS NOT NULL
public|search_embeddings|2200_19605_2_not_null|CHECK|source_type IS NOT NULL
public|search_embeddings|2200_19605_3_not_null|CHECK|source_id IS NOT NULL
public|search_embeddings|2200_19605_4_not_null|CHECK|chunk_index IS NOT NULL
public|search_embeddings|2200_19605_5_not_null|CHECK|content IS NOT NULL
public|search_embeddings|search_embeddings_pkey|PRIMARY KEY|id
public|search_embeddings|search_embeddings_source_type_source_id_chunk_index_key|UNIQUE|chunk_index
public|search_embeddings|search_embeddings_source_type_source_id_chunk_index_key|UNIQUE|source_id
public|search_embeddings|search_embeddings_source_type_source_id_chunk_index_key|UNIQUE|source_type
public|service_principals|2200_19614_1_not_null|CHECK|service_id IS NOT NULL
public|service_principals|2200_19614_2_not_null|CHECK|display_name IS NOT NULL
public|service_principals|2200_19614_3_not_null|CHECK|allowed_audiences IS NOT NULL
public|service_principals|2200_19614_4_not_null|CHECK|allowed_scopes IS NOT NULL
public|service_principals|2200_19614_6_not_null|CHECK|active IS NOT NULL
public|service_principals|2200_19614_7_not_null|CHECK|created_at IS NOT NULL
public|service_principals|2200_19614_8_not_null|CHECK|updated_at IS NOT NULL
public|service_principals|service_principals_pkey|PRIMARY KEY|service_id
public|upgrade_history|2200_19622_14_not_null|CHECK|impacts_resolved IS NOT NULL
public|upgrade_history|2200_19622_15_not_null|CHECK|impacts_auto_merged IS NOT NULL
public|upgrade_history|2200_19622_16_not_null|CHECK|created_at IS NOT NULL
public|upgrade_history|2200_19622_1_not_null|CHECK|id IS NOT NULL
public|upgrade_history|2200_19622_2_not_null|CHECK|instance_id IS NOT NULL
public|upgrade_history|2200_19622_3_not_null|CHECK|from_version IS NOT NULL
public|upgrade_history|2200_19622_4_not_null|CHECK|to_version IS NOT NULL
public|upgrade_history|2200_19622_6_not_null|CHECK|status IS NOT NULL
public|upgrade_history|2200_19622_7_not_null|CHECK|started_at IS NOT NULL
public|upgrade_history|upgrade_history_pkey|PRIMARY KEY|id
public|upgrade_manifest|2200_19635_10_not_null|CHECK|is_available IS NOT NULL
public|upgrade_manifest|2200_19635_11_not_null|CHECK|is_mandatory IS NOT NULL
public|upgrade_manifest|2200_19635_12_not_null|CHECK|created_at IS NOT NULL
public|upgrade_manifest|2200_19635_1_not_null|CHECK|id IS NOT NULL
public|upgrade_manifest|2200_19635_2_not_null|CHECK|version IS NOT NULL
public|upgrade_manifest|2200_19635_3_not_null|CHECK|release_date IS NOT NULL
public|upgrade_manifest|upgrade_manifest_pkey|PRIMARY KEY|id
public|user_preferences|2200_19648_10_not_null|CHECK|pinned_navigation IS NOT NULL
public|user_preferences|2200_19648_11_not_null|CHECK|recent_items_count IS NOT NULL
public|user_preferences|2200_19648_12_not_null|CHECK|show_favorites_in_sidebar IS NOT NULL
public|user_preferences|2200_19648_13_not_null|CHECK|show_recent_in_sidebar IS NOT NULL
public|user_preferences|2200_19648_14_not_null|CHECK|language IS NOT NULL
public|user_preferences|2200_19648_16_not_null|CHECK|date_format IS NOT NULL
public|user_preferences|2200_19648_17_not_null|CHECK|time_format IS NOT NULL
public|user_preferences|2200_19648_18_not_null|CHECK|start_of_week IS NOT NULL
public|user_preferences|2200_19648_19_not_null|CHECK|number_format IS NOT NULL
public|user_preferences|2200_19648_1_not_null|CHECK|id IS NOT NULL
public|user_preferences|2200_19648_20_not_null|CHECK|notification_preferences IS NOT NULL
public|user_preferences|2200_19648_21_not_null|CHECK|accessibility IS NOT NULL
public|user_preferences|2200_19648_22_not_null|CHECK|keyboard_shortcuts_enabled IS NOT NULL
public|user_preferences|2200_19648_23_not_null|CHECK|custom_shortcuts IS NOT NULL
public|user_preferences|2200_19648_24_not_null|CHECK|table_preferences IS NOT NULL
public|user_preferences|2200_19648_25_not_null|CHECK|dashboard_preferences IS NOT NULL
public|user_preferences|2200_19648_26_not_null|CHECK|auto_save_enabled IS NOT NULL
public|user_preferences|2200_19648_27_not_null|CHECK|auto_save_interval IS NOT NULL
public|user_preferences|2200_19648_28_not_null|CHECK|confirm_before_leave IS NOT NULL
public|user_preferences|2200_19648_29_not_null|CHECK|show_field_descriptions IS NOT NULL
public|user_preferences|2200_19648_2_not_null|CHECK|user_id IS NOT NULL
public|user_preferences|2200_19648_30_not_null|CHECK|search_include_archived IS NOT NULL
public|user_preferences|2200_19648_31_not_null|CHECK|search_results_per_page IS NOT NULL
public|user_preferences|2200_19648_32_not_null|CHECK|search_highlight_matches IS NOT NULL
public|user_preferences|2200_19648_35_not_null|CHECK|ava_enabled IS NOT NULL
public|user_preferences|2200_19648_36_not_null|CHECK|ava_auto_suggest IS NOT NULL
public|user_preferences|2200_19648_37_not_null|CHECK|ava_voice_enabled IS NOT NULL
public|user_preferences|2200_19648_38_not_null|CHECK|sync_enabled IS NOT NULL
public|user_preferences|2200_19648_3_not_null|CHECK|density_mode IS NOT NULL
public|user_preferences|2200_19648_41_not_null|CHECK|preference_version IS NOT NULL
public|user_preferences|2200_19648_42_not_null|CHECK|created_at IS NOT NULL
public|user_preferences|2200_19648_43_not_null|CHECK|updated_at IS NOT NULL
public|user_preferences|2200_19648_4_not_null|CHECK|sidebar_position IS NOT NULL
public|user_preferences|2200_19648_5_not_null|CHECK|sidebar_collapsed IS NOT NULL
public|user_preferences|2200_19648_6_not_null|CHECK|sidebar_width IS NOT NULL
public|user_preferences|2200_19648_7_not_null|CHECK|show_breadcrumbs IS NOT NULL
public|user_preferences|2200_19648_8_not_null|CHECK|show_footer IS NOT NULL
public|user_preferences|2200_19648_9_not_null|CHECK|content_width IS NOT NULL
public|user_preferences|PK_e8cfb5b31af61cd363a6b6d7c25|PRIMARY KEY|id
public|user_sessions|2200_19690_11_not_null|CHECK|is_active IS NOT NULL
public|user_sessions|2200_19690_12_not_null|CHECK|is_remembered IS NOT NULL
public|user_sessions|2200_19690_13_not_null|CHECK|created_at IS NOT NULL
public|user_sessions|2200_19690_14_not_null|CHECK|last_activity_at IS NOT NULL
public|user_sessions|2200_19690_15_not_null|CHECK|expires_at IS NOT NULL
public|user_sessions|2200_19690_1_not_null|CHECK|id IS NOT NULL
public|user_sessions|2200_19690_2_not_null|CHECK|user_id IS NOT NULL
public|user_sessions|2200_19690_3_not_null|CHECK|session_token IS NOT NULL
public|user_sessions|PK_e93e031a5fed190d4789b6bfd83|PRIMARY KEY|id
public|user_sessions|UQ_e5eb7a3c7766f941fe16b9edecb|UNIQUE|session_token
public|users|2200_19700_10_not_null|CHECK|must_change_password IS NOT NULL
public|users|2200_19700_11_not_null|CHECK|status IS NOT NULL
public|users|2200_19700_1_not_null|CHECK|id IS NOT NULL
public|users|2200_19700_21_not_null|CHECK|locale IS NOT NULL
public|users|2200_19700_22_not_null|CHECK|time_zone IS NOT NULL
public|users|2200_19700_23_not_null|CHECK|date_format IS NOT NULL
public|users|2200_19700_24_not_null|CHECK|time_format IS NOT NULL
public|users|2200_19700_25_not_null|CHECK|mfa_enabled IS NOT NULL
public|users|2200_19700_29_not_null|CHECK|failed_login_attempts IS NOT NULL
public|users|2200_19700_2_not_null|CHECK|email IS NOT NULL
public|users|2200_19700_32_not_null|CHECK|email_verified IS NOT NULL
public|users|2200_19700_34_not_null|CHECK|is_admin IS NOT NULL
public|users|2200_19700_35_not_null|CHECK|is_system_user IS NOT NULL
public|users|2200_19700_4_not_null|CHECK|display_name IS NOT NULL
public|users|2200_19700_53_not_null|CHECK|metadata IS NOT NULL
public|users|2200_19700_54_not_null|CHECK|created_at IS NOT NULL
public|users|2200_19700_55_not_null|CHECK|updated_at IS NOT NULL
public|users|2200_19700_56_not_null|CHECK|security_stamp IS NOT NULL
public|users|2200_19700_8_not_null|CHECK|password_algo IS NOT NULL
public|users|PK_a3ffb1c0c8416b9fc6f907b7433|PRIMARY KEY|id
public|view_configurations|2200_19722_19_not_null|CHECK|owner_type IS NOT NULL
public|view_configurations|2200_19722_1_not_null|CHECK|id IS NOT NULL
public|view_configurations|2200_19722_25_not_null|CHECK|created_at IS NOT NULL
public|view_configurations|2200_19722_26_not_null|CHECK|updated_at IS NOT NULL
public|view_configurations|2200_19722_2_not_null|CHECK|collection_id IS NOT NULL
public|view_configurations|2200_19722_3_not_null|CHECK|code IS NOT NULL
public|view_configurations|2200_19722_4_not_null|CHECK|name IS NOT NULL
public|view_configurations|2200_19722_6_not_null|CHECK|view_type IS NOT NULL
public|view_configurations|2200_19722_7_not_null|CHECK|config IS NOT NULL
public|view_configurations|chk_owner_type|CHECK|(((owner_type)::text = ANY (ARRAY[('system'::character varying)
public|view_configurations|chk_view_type|CHECK|(((view_type)::text = ANY (ARRAY[('list'::character varying)::t
public|view_configurations|view_configurations_pkey|PRIMARY KEY|id

## Foreign Keys
app_builder|ai_report_templates|created_by|FK_ai_report_templates_user|public|users|id|NO ACTION|SET NULL
app_builder|ai_reports|generated_by|FK_ai_reports_user|public|users|id|NO ACTION|SET NULL
app_builder|ava_stories|approved_by|FK_ava_stories_approved_by|public|users|id|NO ACTION|SET NULL
app_builder|ava_stories|recording_id|FK_ava_stories_recording|app_builder|sprint_recordings|id|NO ACTION|CASCADE
app_builder|documentation_versions|documentation_id|FK_doc_versions_doc|app_builder|generated_documentation|id|NO ACTION|CASCADE
app_builder|nl_queries|user_id|FK_nl_queries_user|public|users|id|NO ACTION|SET NULL
app_builder|predictive_insights|resolved_by|FK_predictive_insights_user|public|users|id|NO ACTION|SET NULL
app_builder|predictive_suggestions|user_id|FK_predictive_suggestions_user|public|users|id|NO ACTION|CASCADE
app_builder|saved_nl_queries|user_id|FK_saved_nl_queries_user|public|users|id|NO ACTION|CASCADE
app_builder|sprint_recordings|recorded_by|FK_sprint_recordings_user|public|users|id|NO ACTION|SET NULL
app_builder|story_implementations|story_id|FK_story_implementations_story|app_builder|ava_stories|id|NO ACTION|CASCADE
app_builder|upgrade_fixes|analysis_id|FK_upgrade_fixes_analysis|app_builder|upgrade_impact_analyses|id|NO ACTION|CASCADE
app_builder|upgrade_fixes|customization_id|FK_upgrade_fixes_customization|app_builder|customization_registry|id|NO ACTION|CASCADE
app_builder|upgrade_fixes|applied_by|FK_upgrade_fixes_user|public|users|id|NO ACTION|SET NULL
app_builder|upgrade_impact_analyses|analyzed_by|FK_upgrade_analyses_user|public|users|id|NO ACTION|SET NULL
app_builder|user_behaviors|user_id|FK_user_behaviors_user|public|users|id|NO ACTION|CASCADE
app_builder|user_patterns|user_id|FK_user_patterns_user|public|users|id|NO ACTION|CASCADE
app_builder|voice_commands|user_id|FK_voice_commands_user|public|users|id|NO ACTION|SET NULL
app_builder|zero_code_app_versions|app_id|FK_app_versions_app|app_builder|zero_code_apps|id|NO ACTION|CASCADE
app_builder|zero_code_app_versions|created_by|FK_app_versions_user|public|users|id|NO ACTION|SET NULL
app_builder|zero_code_apps|created_by|FK_zero_code_apps_user|public|users|id|NO ACTION|SET NULL
automation|approvals|process_flow_instance_id|approvals_process_flow_instance_id_fkey|automation|process_flow_instances|id|NO ACTION|CASCADE
automation|automation_execution_logs|automation_rule_id|fk_execution_logs_automation_rule|automation|automation_rules|id|NO ACTION|SET NULL
automation|automation_rule_revisions|automation_rule_id|automation_rule_revisions_automation_rule_id_fkey|automation|automation_rules|id|NO ACTION|CASCADE
automation|automation_rules|application_id|fk_automation_rules_application|metadata|applications|id|NO ACTION|RESTRICT
automation|decision_inputs|table_id|fk_decision_inputs_table|automation|decision_tables|id|NO ACTION|CASCADE
automation|decision_rows|table_id|fk_decision_rows_table|automation|decision_tables|id|NO ACTION|CASCADE
automation|decision_table_revisions|table_id|fk_decision_table_revisions_table|automation|decision_tables|id|NO ACTION|CASCADE
automation|decision_tables|application_id|fk_decision_tables_application|metadata|applications|id|NO ACTION|RESTRICT
automation|decision_tables|collection_id|fk_decision_tables_collection|metadata|collection_definitions|id|NO ACTION|CASCADE
automation|guided_process_activities|stage_id|fk_guided_process_activities_stage|automation|guided_process_stages|id|NO ACTION|CASCADE
automation|guided_process_revisions|process_id|fk_guided_process_revisions_process|automation|guided_processes|id|NO ACTION|CASCADE
automation|guided_process_stages|process_id|fk_guided_process_stages_process|automation|guided_processes|id|NO ACTION|CASCADE
automation|guided_processes|application_id|fk_guided_processes_application|metadata|applications|id|NO ACTION|RESTRICT
automation|guided_processes|collection_id|fk_guided_processes_collection|metadata|collection_definitions|id|NO ACTION|CASCADE
automation|process_flow_definition_revisions|process_flow_id|process_flow_definition_revisions_process_flow_id_fkey|automation|process_flow_definitions|id|NO ACTION|CASCADE
automation|process_flow_definitions|application_id|fk_process_flow_definitions_application|metadata|applications|id|NO ACTION|RESTRICT
automation|process_flow_definitions|collection_id|process_flow_definitions_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|NO ACTION
automation|process_flow_execution_history|instance_id|process_flow_execution_history_instance_id_fkey|automation|process_flow_instances|id|NO ACTION|CASCADE
automation|process_flow_instances|collection_id|process_flow_instances_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|NO ACTION
automation|process_flow_instances|process_flow_id|process_flow_instances_process_flow_id_fkey|automation|process_flow_definitions|id|NO ACTION|CASCADE
automation|sla_breaches|collection_id|sla_breaches_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|NO ACTION
automation|sla_breaches|sla_definition_id|sla_breaches_sla_definition_id_fkey|automation|sla_definitions|id|NO ACTION|NO ACTION
automation|sla_breaches|sla_instance_id|sla_breaches_sla_instance_id_fkey|automation|sla_instances|id|NO ACTION|NO ACTION
automation|sla_definitions|business_hours_id|sla_definitions_business_hours_id_fkey|automation|business_hours|id|NO ACTION|NO ACTION
automation|sla_definitions|collection_id|sla_definitions_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|NO ACTION
automation|sla_instances|collection_id|sla_instances_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|NO ACTION
automation|sla_instances|sla_definition_id|sla_instances_sla_definition_id_fkey|automation|sla_definitions|id|NO ACTION|CASCADE
automation|state_change_history|collection_id|state_change_history_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|NO ACTION
automation|state_change_history|state_machine_id|state_change_history_state_machine_id_fkey|automation|state_machine_definitions|id|NO ACTION|NO ACTION
automation|state_machine_definitions|collection_id|state_machine_definitions_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|NO ACTION
ava|ava_intents|message_id|ava_intents_message_id_fkey|ava|ava_messages|id|NO ACTION|CASCADE
ava|ava_messages|conversation_id|ava_messages_conversation_id_fkey|ava|ava_conversations|id|NO ACTION|CASCADE
ava|dataset_snapshots|dataset_definition_id|dataset_snapshots_dataset_definition_id_fkey|ava|dataset_definitions|id|NO ACTION|CASCADE
ava|model_artifacts|dataset_snapshot_id|model_artifacts_dataset_snapshot_id_fkey|ava|dataset_snapshots|id|NO ACTION|SET NULL
ava|model_deployments|model_artifact_id|model_deployments_model_artifact_id_fkey|ava|model_artifacts|id|NO ACTION|RESTRICT
ava|model_evaluations|dataset_snapshot_id|model_evaluations_dataset_snapshot_id_fkey|ava|dataset_snapshots|id|NO ACTION|SET NULL
ava|model_evaluations|model_artifact_id|model_evaluations_model_artifact_id_fkey|ava|model_artifacts|id|NO ACTION|CASCADE
ava|model_training_jobs|dataset_snapshot_id|model_training_jobs_dataset_snapshot_id_fkey|ava|dataset_snapshots|id|NO ACTION|RESTRICT
ava|model_training_jobs|model_artifact_id|model_training_jobs_model_artifact_id_fkey|ava|model_artifacts|id|NO ACTION|SET NULL
identity|auth_events|user_id|FK_d27703f0a3d79ba424741807cb4|public|users|id|NO ACTION|NO ACTION
identity|behavioral_profiles|user_id|behavioral_profiles_user_id_fkey|public|users|id|NO ACTION|CASCADE
identity|delegations|approved_by|delegations_approved_by_fkey|public|users|id|NO ACTION|NO ACTION
identity|delegations|delegate_id|delegations_delegate_id_fkey|public|users|id|NO ACTION|CASCADE
identity|delegations|delegator_id|delegations_delegator_id_fkey|public|users|id|NO ACTION|CASCADE
identity|delegations|revoked_by|delegations_revoked_by_fkey|public|users|id|NO ACTION|NO ACTION
identity|email_verification_tokens|user_id|FK_fdcb77f72f529bf65c95d72a147|public|users|id|NO ACTION|CASCADE
identity|group_members|user_id|FK_20a555b299f75843aa53ff8b0ee|public|users|id|NO ACTION|CASCADE
identity|group_members|group_id|FK_2c840df5db52dc6b4a1b0b69c6e|identity|groups|id|NO ACTION|CASCADE
identity|group_members|created_by|FK_4ad0de0815545b0c63e2b86250c|public|users|id|NO ACTION|NO ACTION
identity|group_roles|group_id|FK_0f428ea82b51ea6c795689cdb8a|identity|groups|id|NO ACTION|CASCADE
identity|group_roles|created_by|FK_14ee449cf1a7a0e879b54fd5626|public|users|id|NO ACTION|NO ACTION
identity|group_roles|role_id|FK_35d4b5f7da6e1a9a730c3621ecc|identity|roles|id|NO ACTION|CASCADE
identity|groups|created_by|FK_a2fa29bfd5351b5b7ccacbc9f7c|public|users|id|NO ACTION|NO ACTION
identity|groups|parent_id|FK_d768ea35a407c2ba9c0b038b613|identity|groups|id|NO ACTION|NO ACTION
identity|impersonation_sessions|impersonator_id|impersonation_sessions_impersonator_id_fkey|public|users|id|NO ACTION|CASCADE
identity|impersonation_sessions|target_user_id|impersonation_sessions_target_user_id_fkey|public|users|id|NO ACTION|CASCADE
identity|magic_link_tokens|user_id|magic_link_tokens_user_id_fkey|public|users|id|NO ACTION|CASCADE
identity|mfa_methods|user_id|FK_1d590a89ba342ab3515e64f6d28|public|users|id|NO ACTION|CASCADE
identity|nav_profile_items|parent_id|FK_e61477461f4ab1ba6729234fe47|identity|nav_profile_items|id|NO ACTION|NO ACTION
identity|nav_profile_items|profile_id|FK_f02d51b25f5821bc1ee6780cc1b|identity|nav_profiles|id|NO ACTION|CASCADE
identity|nav_profiles|role_id|FK_1520f8f695df6f299c14f4f1fcc|identity|roles|id|NO ACTION|NO ACTION
identity|nav_profiles|user_id|FK_77d64f0d70a0883578f4436a804|public|users|id|NO ACTION|NO ACTION
identity|nav_profiles|group_id|FK_c2791c2beecf130b1bf94bb42a3|identity|groups|id|NO ACTION|NO ACTION
identity|password_history|user_id|FK_4933dc7a01356ac0733a5ad52d9|public|users|id|NO ACTION|CASCADE
identity|password_reset_tokens|user_id|FK_52ac39dd8a28730c63aeb428c9c|public|users|id|NO ACTION|CASCADE
identity|refresh_tokens|parent_token_id|refresh_tokens_parent_token_id_fkey|identity|refresh_tokens|token_hash|NO ACTION|SET NULL
identity|refresh_tokens|replaced_by_token_id|refresh_tokens_replaced_by_token_id_fkey|identity|refresh_tokens|token_hash|NO ACTION|SET NULL
identity|refresh_tokens|user_id|refresh_tokens_user_id_fkey|public|users|id|NO ACTION|CASCADE
identity|role_permissions|permission_code|role_permissions_permission_code_fkey|identity|platform_permissions|code|NO ACTION|RESTRICT
identity|role_permissions|role_id|role_permissions_role_id_fkey|identity|roles|id|NO ACTION|CASCADE
identity|roles|parent_id|FK_3e97eeaf865aeda0d20c0c5c509|identity|roles|id|NO ACTION|NO ACTION
identity|roles|created_by|FK_4a39f3095781cdd9d6061afaae5|public|users|id|NO ACTION|NO ACTION
identity|roles|updated_by|FK_747b580d73db0ad78963d78b076|public|users|id|NO ACTION|NO ACTION
identity|security_alerts|acknowledged_by|security_alerts_acknowledged_by_fkey|public|users|id|NO ACTION|NO ACTION
identity|security_alerts|resolved_by|security_alerts_resolved_by_fkey|public|users|id|NO ACTION|NO ACTION
identity|security_alerts|user_id|security_alerts_user_id_fkey|public|users|id|NO ACTION|SET NULL
identity|trusted_devices|user_id|trusted_devices_user_id_fkey|public|users|id|NO ACTION|CASCADE
identity|user_invitations|invited_by|FK_18241a1a2cb2d284716636b2340|public|users|id|NO ACTION|NO ACTION
identity|user_roles|user_id|FK_87b8888186ca9769c960e926870|public|users|id|NO ACTION|CASCADE
identity|user_roles|created_by|FK_947e863084a338ac018f1beab96|public|users|id|NO ACTION|NO ACTION
identity|user_roles|role_id|FK_b23c65e50a758245a33ee35fda1|identity|roles|id|NO ACTION|CASCADE
identity|webauthn_challenges|user_id|webauthn_challenges_user_id_fkey|public|users|id|NO ACTION|CASCADE
identity|webauthn_credentials|user_id|webauthn_credentials_user_id_fkey|public|users|id|NO ACTION|CASCADE
integrations|api_keys|user_id|FK_a3baee01d8408cd3c0f89a9a973|public|users|id|NO ACTION|CASCADE
integrations|api_request_logs|api_key_id|api_request_logs_api_key_id_fkey|integrations|api_keys|id|NO ACTION|SET NULL
integrations|api_request_logs|oauth_client_id|api_request_logs_oauth_client_id_fkey|integrations|oauth_clients|id|NO ACTION|SET NULL
integrations|connector_connections|connector_id|connector_connections_connector_id_fkey|integrations|external_connectors|id|NO ACTION|CASCADE
integrations|oauth_access_tokens|client_id|oauth_access_tokens_client_id_fkey|integrations|oauth_clients|id|NO ACTION|CASCADE
integrations|oauth_authorization_codes|client_id|oauth_authorization_codes_client_id_fkey|integrations|oauth_clients|id|NO ACTION|CASCADE
integrations|oauth_refresh_tokens|access_token_id|oauth_refresh_tokens_access_token_id_fkey|integrations|oauth_access_tokens|id|NO ACTION|CASCADE
integrations|oauth_refresh_tokens|client_id|oauth_refresh_tokens_client_id_fkey|integrations|oauth_clients|id|NO ACTION|CASCADE
integrations|sync_configurations|connection_id|sync_configurations_connection_id_fkey|integrations|connector_connections|id|NO ACTION|CASCADE
integrations|sync_configurations|mapping_id|sync_configurations_mapping_id_fkey|public|field_mappings|id|NO ACTION|NO ACTION
integrations|sync_runs|configuration_id|sync_runs_configuration_id_fkey|integrations|sync_configurations|id|NO ACTION|CASCADE
integrations|webhook_deliveries|subscription_id|webhook_deliveries_subscription_id_fkey|integrations|webhook_subscriptions|id|NO ACTION|CASCADE
metadata|application_revisions|application_id|application_revisions_application_id_fkey|metadata|applications|id|NO ACTION|CASCADE
metadata|change_packages|application_id|fk_change_packages_application|metadata|applications|id|NO ACTION|CASCADE
metadata|choice_items|choice_list_id|FK_98334e02c5109bd3a8ec155c2bd|metadata|choice_lists|id|NO ACTION|CASCADE
metadata|collection_constraints|collection_id|collection_constraints_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|CASCADE
metadata|collection_constraints|created_by|fk_collection_constraints_created_by|public|users|id|NO ACTION|SET NULL
metadata|collection_constraints|updated_by|fk_collection_constraints_updated_by|public|users|id|NO ACTION|SET NULL
metadata|collection_definition_revisions|collection_id|collection_definition_revisions_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|CASCADE
metadata|collection_definitions|updated_by|FK_c38e77b7b225ba65cddbf6e10a8|public|users|id|NO ACTION|NO ACTION
metadata|collection_definitions|created_by|FK_ed35ee925189245000d53d91490|public|users|id|NO ACTION|NO ACTION
metadata|collection_definitions|application_id|fk_collection_definitions_application|metadata|applications|id|NO ACTION|RESTRICT
metadata|collection_indexes|collection_id|collection_indexes_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|CASCADE
metadata|collection_indexes|created_by|fk_collection_indexes_created_by|public|users|id|NO ACTION|SET NULL
metadata|collection_indexes|updated_by|fk_collection_indexes_updated_by|public|users|id|NO ACTION|SET NULL
metadata|dependent_review_queue|collection_id|fk_dependent_review_queue_collection|metadata|collection_definitions|id|NO ACTION|RESTRICT
metadata|display_rule_revisions|display_rule_id|fk_display_rule_revisions_rule|metadata|display_rules|id|NO ACTION|CASCADE
metadata|display_rules|application_id|fk_display_rules_application|metadata|applications|id|NO ACTION|RESTRICT
metadata|display_rules|collection_id|fk_display_rules_collection|metadata|collection_definitions|id|NO ACTION|CASCADE
metadata|form_definitions|collection_id|FK_111982cc806d8c26c9c445ece75|metadata|collection_definitions|id|NO ACTION|NO ACTION
metadata|form_definitions|application_id|fk_form_definitions_application|metadata|applications|id|NO ACTION|RESTRICT
metadata|form_versions|form_id|FK_5270f702bc84ac42d6211ce4478|metadata|form_definitions|id|NO ACTION|NO ACTION
metadata|instance_branding|default_theme_id|FK_ce407c1aa6965b7f4667e1c2385|metadata|theme_definitions|id|NO ACTION|SET NULL
metadata|localization_bundles|locale_id|localization_bundles_locale_id_fkey|metadata|locales|id|NO ACTION|CASCADE
metadata|module_security|module_id|FK_476979d5494d0697ddd56dd94c8|metadata|modules|id|NO ACTION|NO ACTION
metadata|module_security|role_id|FK_6b88a58f364d05ef36ab89d3534|identity|roles|id|NO ACTION|NO ACTION
metadata|nav_nodes|parent_id|FK_nav_nodes_parent|metadata|nav_nodes|id|NO ACTION|CASCADE
metadata|nav_nodes|profile_id|FK_nav_nodes_profile|identity|nav_profiles|id|NO ACTION|CASCADE
metadata|nav_patches|profile_id|FK_nav_patches_profile|identity|nav_profiles|id|NO ACTION|CASCADE
metadata|navigation_module_revisions|created_by|FK_navigation_module_revisions_created_by|public|users|id|NO ACTION|SET NULL
metadata|navigation_module_revisions|navigation_module_id|FK_navigation_module_revisions_definition|metadata|navigation_modules|id|NO ACTION|CASCADE
metadata|navigation_module_revisions|published_by|FK_navigation_module_revisions_published_by|public|users|id|NO ACTION|SET NULL
metadata|navigation_modules|created_by|FK_navigation_modules_created_by|public|users|id|NO ACTION|SET NULL
metadata|navigation_modules|updated_by|FK_navigation_modules_updated_by|public|users|id|NO ACTION|SET NULL
metadata|navigation_modules|application_id|fk_navigation_modules_application|metadata|applications|id|NO ACTION|RESTRICT
metadata|navigation_variants|created_by|FK_navigation_variants_created_by|public|users|id|NO ACTION|SET NULL
metadata|navigation_variants|navigation_module_id|FK_navigation_variants_definition|metadata|navigation_modules|id|NO ACTION|CASCADE
metadata|navigation_variants|updated_by|FK_navigation_variants_updated_by|public|users|id|NO ACTION|SET NULL
metadata|pack_object_revisions|release_record_id|pack_object_revisions_release_record_id_fkey|metadata|pack_release_records|id|NO ACTION|CASCADE
metadata|pack_object_states|current_revision_id|pack_object_states_current_revision_id_fkey|metadata|pack_object_revisions|id|NO ACTION|NO ACTION
metadata|pack_release_records|applied_by|fk_pack_release_applied_by|public|users|id|NO ACTION|SET NULL
metadata|pack_release_records|rollback_of_release_id|fk_pack_release_rollback|metadata|pack_release_records|id|NO ACTION|SET NULL
metadata|property_definition_revisions|property_id|property_definition_revisions_property_id_fkey|metadata|property_definitions|id|NO ACTION|CASCADE
metadata|property_definitions|property_type_id|FK_10dab69d18bbe034d20839f2adf|metadata|property_types|id|NO ACTION|NO ACTION
metadata|property_definitions|collection_id|FK_2e4c4613796c3af281556a2b62c|metadata|collection_definitions|id|NO ACTION|CASCADE
metadata|property_definitions|created_by|FK_c88d8fdd8f9688600a99b0b9711|public|users|id|NO ACTION|NO ACTION
metadata|property_definitions|reference_collection_id|FK_e7ba7ffa905aec05e0791992923|metadata|collection_definitions|id|NO ACTION|NO ACTION
metadata|property_definitions|application_id|fk_property_definitions_application|metadata|applications|id|NO ACTION|RESTRICT
metadata|theme_definitions|created_by|FK_53431368019d2e12f9db8bee72a|public|users|id|NO ACTION|NO ACTION
metadata|translation_requests|locale_id|translation_requests_locale_id_fkey|metadata|locales|id|NO ACTION|CASCADE
metadata|translation_requests|translation_key_id|translation_requests_translation_key_id_fkey|metadata|translation_keys|id|NO ACTION|CASCADE
metadata|translation_values|locale_id|translation_values_locale_id_fkey|metadata|locales|id|NO ACTION|CASCADE
metadata|translation_values|translation_key_id|translation_values_translation_key_id_fkey|metadata|translation_keys|id|NO ACTION|CASCADE
metadata|user_theme_preferences|theme_id|FK_15ec7ebb4783b5d71df82027898|metadata|theme_definitions|id|NO ACTION|SET NULL
metadata|user_theme_preferences|user_id|FK_ae77cd7cd68614f5880e1027574|public|users|id|NO ACTION|CASCADE
metadata|view_definition_revisions|created_by|FK_view_definition_revisions_created_by|public|users|id|NO ACTION|SET NULL
metadata|view_definition_revisions|view_definition_id|FK_view_definition_revisions_definition|metadata|view_definitions|id|NO ACTION|CASCADE
metadata|view_definition_revisions|published_by|FK_view_definition_revisions_published_by|public|users|id|NO ACTION|SET NULL
metadata|view_definitions|created_by|FK_view_definitions_created_by|public|users|id|NO ACTION|SET NULL
metadata|view_definitions|updated_by|FK_view_definitions_updated_by|public|users|id|NO ACTION|SET NULL
metadata|view_definitions|application_id|fk_view_definitions_application|metadata|applications|id|NO ACTION|RESTRICT
metadata|view_variants|created_by|FK_view_variants_created_by|public|users|id|NO ACTION|SET NULL
metadata|view_variants|view_definition_id|FK_view_variants_definition|metadata|view_definitions|id|NO ACTION|CASCADE
metadata|view_variants|updated_by|FK_view_variants_updated_by|public|users|id|NO ACTION|SET NULL
metadata|widget_catalog|application_id|fk_widget_catalog_application|metadata|applications|id|NO ACTION|RESTRICT
metadata|workspace_definitions|application_id|fk_workspace_definitions_application|metadata|applications|id|NO ACTION|CASCADE
metadata|workspace_definitions|default_collection_id|fk_workspace_definitions_default_collection|metadata|collection_definitions|id|NO ACTION|SET NULL
metadata|workspace_pages|collection_id|fk_workspace_pages_collection|metadata|collection_definitions|id|NO ACTION|SET NULL
metadata|workspace_pages|workspace_id|fk_workspace_pages_workspace|metadata|workspace_definitions|id|NO ACTION|CASCADE
metadata|workspace_variants|page_id|fk_workspace_variants_page|metadata|workspace_pages|id|NO ACTION|CASCADE
metadata|workspace_variants|workspace_id|fk_workspace_variants_workspace|metadata|workspace_definitions|id|NO ACTION|CASCADE
notify|in_app_notifications|collection_id|in_app_notifications_collection_id_fkey|metadata|collection_definitions|id|NO ACTION|NO ACTION
notify|notification_history|notification_queue_id|notification_history_notification_queue_id_fkey|notify|notification_queue|id|NO ACTION|NO ACTION
notify|notification_queue|template_id|notification_queue_template_id_fkey|notify|notification_templates|id|NO ACTION|NO ACTION
public|audit_logs|user_id|FK_bd2726fd31b35443f2245b93ba0|public|users|id|NO ACTION|NO ACTION
public|collection_access_rules|collection_id|FK_0644be2a2e4d4a95dae2039d044|metadata|collection_definitions|id|NO ACTION|CASCADE
public|collection_access_rules|created_by|FK_0716029d0918b15af5c777d3b19|public|users|id|NO ACTION|NO ACTION
public|collection_access_rules|role_id|FK_0ee922b564bc954b4d97eae8154|identity|roles|id|NO ACTION|NO ACTION
public|collection_access_rules|user_id|FK_2bbd90ecb185529732938857fa3|public|users|id|NO ACTION|NO ACTION
public|collection_access_rules|group_id|FK_d9437ad9cb5e4aedaf442b949e5|identity|groups|id|NO ACTION|NO ACTION
public|field_mappings|connection_id|field_mappings_connection_id_fkey|integrations|connector_connections|id|NO ACTION|CASCADE
public|formula_cache|collection_id|fk_formula_cache_collection|metadata|collection_definitions|id|NO ACTION|CASCADE
public|formula_cache|property_id|fk_formula_cache_property|metadata|property_definitions|id|NO ACTION|CASCADE
public|instance_upgrade_impact|upgrade_manifest_id|instance_upgrade_impact_upgrade_manifest_id_fkey|public|upgrade_manifest|id|NO ACTION|CASCADE
public|property_access_rules|role_id|FK_0189d2c9de5f8ef47506294a27f|identity|roles|id|NO ACTION|NO ACTION
public|property_access_rules|property_id|FK_314d7767bd038e2d47aebb208f5|metadata|property_definitions|id|NO ACTION|CASCADE
public|property_access_rules|user_id|FK_8c5f3ff32b318d551d8f4a7b280|public|users|id|NO ACTION|NO ACTION
public|property_access_rules|group_id|FK_a0b9e97943e753481035a49922f|identity|groups|id|NO ACTION|NO ACTION
public|property_access_rules|wildcard_collection_id|FK_property_access_rules_wildcard_collection_id|metadata|collection_definitions|id|NO ACTION|CASCADE
public|property_dependencies|collection_id|fk_property_dependencies_collection|metadata|collection_definitions|id|NO ACTION|CASCADE
public|property_dependencies|property_id|fk_property_dependencies_property|metadata|property_definitions|id|NO ACTION|CASCADE
public|schema_versions|parent_version_id|schema_versions_parent_version_id_fkey|public|schema_versions|id|NO ACTION|NO ACTION
public|upgrade_history|upgrade_manifest_id|upgrade_history_upgrade_manifest_id_fkey|public|upgrade_manifest|id|NO ACTION|NO ACTION
public|user_preferences|user_id|FK_458057fa75b66e68a275647da2e|public|users|id|NO ACTION|CASCADE
public|user_sessions|user_id|FK_e9658e959c490b0a634dfc54783|public|users|id|NO ACTION|CASCADE
public|users|deleted_by|FK_021e2c9d9dca9f0885e8d738326|public|users|id|NO ACTION|NO ACTION
public|users|suspended_by|FK_84808507d893ed21a8b8253d6bc|public|users|id|NO ACTION|NO ACTION
public|users|deactivated_by|FK_a9add0cb9d63c590d8aedeceecb|public|users|id|NO ACTION|NO ACTION
public|users|invited_by|FK_d2dbc280ebc69071c0846c87019|public|users|id|NO ACTION|NO ACTION
public|users|manager_id|FK_fba2d8e029689aa8fea98e53c91|public|users|id|NO ACTION|NO ACTION
public|view_configurations|collection_id|fk_view_config_collection|metadata|collection_definitions|id|NO ACTION|CASCADE

## Indexes
app_builder|ai_report_templates|IDX_ai_report_templates_category|CREATE INDEX "IDX_ai_report_templates_category" ON app_builder.ai_report_templates USING btree (category)
app_builder|ai_report_templates|IDX_ai_report_templates_public|CREATE INDEX "IDX_ai_report_templates_public" ON app_builder.ai_report_templates USING btree (is_public)
app_builder|ai_report_templates|PK_ai_report_templates|CREATE UNIQUE INDEX "PK_ai_report_templates" ON app_builder.ai_report_templates USING btree (id)
app_builder|ai_reports|IDX_ai_reports_status|CREATE INDEX "IDX_ai_reports_status" ON app_builder.ai_reports USING btree (status)
app_builder|ai_reports|IDX_ai_reports_user|CREATE INDEX "IDX_ai_reports_user" ON app_builder.ai_reports USING btree (generated_by, created_at DESC)
app_builder|ai_reports|PK_ai_reports|CREATE UNIQUE INDEX "PK_ai_reports" ON app_builder.ai_reports USING btree (id)
app_builder|app_builder_components|IDX_app_components_category|CREATE INDEX "IDX_app_components_category" ON app_builder.app_builder_components USING btree (category)
app_builder|app_builder_components|IDX_app_components_type|CREATE INDEX "IDX_app_components_type" ON app_builder.app_builder_components USING btree (component_type)
app_builder|app_builder_components|PK_app_builder_components|CREATE UNIQUE INDEX "PK_app_builder_components" ON app_builder.app_builder_components USING btree (id)
app_builder|ava_stories|IDX_ava_stories_priority|CREATE INDEX "IDX_ava_stories_priority" ON app_builder.ava_stories USING btree (priority)
app_builder|ava_stories|IDX_ava_stories_recording|CREATE INDEX "IDX_ava_stories_recording" ON app_builder.ava_stories USING btree (recording_id)
app_builder|ava_stories|IDX_ava_stories_status|CREATE INDEX "IDX_ava_stories_status" ON app_builder.ava_stories USING btree (status)
app_builder|ava_stories|PK_ava_stories|CREATE UNIQUE INDEX "PK_ava_stories" ON app_builder.ava_stories USING btree (id)
app_builder|customization_registry|IDX_customization_registry_artifact|CREATE INDEX "IDX_customization_registry_artifact" ON app_builder.customization_registry USING btree (artifact_id)
app_builder|customization_registry|IDX_customization_registry_type|CREATE INDEX "IDX_customization_registry_type" ON app_builder.customization_registry USING btree (customization_type)
app_builder|customization_registry|IDX_customization_registry_unique|CREATE UNIQUE INDEX "IDX_customization_registry_unique" ON app_builder.customization_registry USING btree (customization_type, artifact_id)
app_builder|customization_registry|PK_customization_registry|CREATE UNIQUE INDEX "PK_customization_registry" ON app_builder.customization_registry USING btree (id)
app_builder|digital_twins|IDX_digital_twins_active|CREATE INDEX "IDX_digital_twins_active" ON app_builder.digital_twins USING btree (is_active)
app_builder|digital_twins|IDX_digital_twins_asset|CREATE UNIQUE INDEX "IDX_digital_twins_asset" ON app_builder.digital_twins USING btree (asset_id)
app_builder|digital_twins|IDX_digital_twins_status|CREATE INDEX "IDX_digital_twins_status" ON app_builder.digital_twins USING btree (status)
app_builder|digital_twins|PK_digital_twins|CREATE UNIQUE INDEX "PK_digital_twins" ON app_builder.digital_twins USING btree (id)
app_builder|documentation_versions|IDX_doc_versions_doc|CREATE INDEX "IDX_doc_versions_doc" ON app_builder.documentation_versions USING btree (documentation_id, version DESC)
app_builder|documentation_versions|PK_documentation_versions|CREATE UNIQUE INDEX "PK_documentation_versions" ON app_builder.documentation_versions USING btree (id)
app_builder|generated_documentation|IDX_generated_docs_artifact|CREATE UNIQUE INDEX "IDX_generated_docs_artifact" ON app_builder.generated_documentation USING btree (artifact_type, artifact_id)
app_builder|generated_documentation|IDX_generated_docs_code|CREATE INDEX "IDX_generated_docs_code" ON app_builder.generated_documentation USING btree (artifact_code)
app_builder|generated_documentation|IDX_generated_docs_search|CREATE INDEX "IDX_generated_docs_search" ON app_builder.generated_documentation USING gin (to_tsvector('english'::regconfig, search_text))
app_builder|generated_documentation|PK_generated_documentation|CREATE UNIQUE INDEX "PK_generated_documentation" ON app_builder.generated_documentation USING btree (id)
app_builder|insight_analysis_jobs|IDX_insight_jobs_next_run|CREATE INDEX "IDX_insight_jobs_next_run" ON app_builder.insight_analysis_jobs USING btree (next_run_at)
app_builder|insight_analysis_jobs|IDX_insight_jobs_type|CREATE UNIQUE INDEX "IDX_insight_jobs_type" ON app_builder.insight_analysis_jobs USING btree (job_type)
app_builder|insight_analysis_jobs|PK_insight_analysis_jobs|CREATE UNIQUE INDEX "PK_insight_analysis_jobs" ON app_builder.insight_analysis_jobs USING btree (id)
app_builder|nl_queries|IDX_nl_queries_user|CREATE INDEX "IDX_nl_queries_user" ON app_builder.nl_queries USING btree (user_id, created_at DESC)
app_builder|nl_queries|PK_nl_queries|CREATE UNIQUE INDEX "PK_nl_queries" ON app_builder.nl_queries USING btree (id)
app_builder|predictive_insights|IDX_predictive_insights_expires|CREATE INDEX "IDX_predictive_insights_expires" ON app_builder.predictive_insights USING btree (expires_at) WHERE (expires_at IS NOT NULL)
app_builder|predictive_insights|IDX_predictive_insights_severity|CREATE INDEX "IDX_predictive_insights_severity" ON app_builder.predictive_insights USING btree (severity)
app_builder|predictive_insights|IDX_predictive_insights_status|CREATE INDEX "IDX_predictive_insights_status" ON app_builder.predictive_insights USING btree (status)
app_builder|predictive_insights|IDX_predictive_insights_type|CREATE INDEX "IDX_predictive_insights_type" ON app_builder.predictive_insights USING btree (insight_type)
app_builder|predictive_insights|PK_predictive_insights|CREATE UNIQUE INDEX "PK_predictive_insights" ON app_builder.predictive_insights USING btree (id)
app_builder|predictive_suggestions|IDX_predictive_suggestions_type|CREATE INDEX "IDX_predictive_suggestions_type" ON app_builder.predictive_suggestions USING btree (suggestion_type)
app_builder|predictive_suggestions|IDX_predictive_suggestions_user|CREATE INDEX "IDX_predictive_suggestions_user" ON app_builder.predictive_suggestions USING btree (user_id, shown_at DESC)
app_builder|predictive_suggestions|PK_predictive_suggestions|CREATE UNIQUE INDEX "PK_predictive_suggestions" ON app_builder.predictive_suggestions USING btree (id)
app_builder|recovery_actions|IDX_recovery_actions_active|CREATE INDEX "IDX_recovery_actions_active" ON app_builder.recovery_actions USING btree (is_active)
app_builder|recovery_actions|IDX_recovery_actions_service|CREATE INDEX "IDX_recovery_actions_service" ON app_builder.recovery_actions USING btree (target_service)
app_builder|recovery_actions|PK_recovery_actions|CREATE UNIQUE INDEX "PK_recovery_actions" ON app_builder.recovery_actions USING btree (id)
app_builder|saved_nl_queries|IDX_saved_queries_favorite|CREATE INDEX "IDX_saved_queries_favorite" ON app_builder.saved_nl_queries USING btree (user_id, is_favorite) WHERE (is_favorite = true)
app_builder|saved_nl_queries|IDX_saved_queries_user|CREATE INDEX "IDX_saved_queries_user" ON app_builder.saved_nl_queries USING btree (user_id)
app_builder|saved_nl_queries|PK_saved_nl_queries|CREATE UNIQUE INDEX "PK_saved_nl_queries" ON app_builder.saved_nl_queries USING btree (id)
app_builder|self_healing_events|IDX_self_healing_event_type|CREATE INDEX "IDX_self_healing_event_type" ON app_builder.self_healing_events USING btree (event_type)
app_builder|self_healing_events|IDX_self_healing_service|CREATE INDEX "IDX_self_healing_service" ON app_builder.self_healing_events USING btree (service_name, created_at DESC)
app_builder|self_healing_events|PK_self_healing_events|CREATE UNIQUE INDEX "PK_self_healing_events" ON app_builder.self_healing_events USING btree (id)
app_builder|sensor_readings|IDX_sensor_readings_asset_time|CREATE INDEX "IDX_sensor_readings_asset_time" ON app_builder.sensor_readings USING btree (asset_id, "timestamp" DESC)
app_builder|sensor_readings|IDX_sensor_readings_sensor_time|CREATE INDEX "IDX_sensor_readings_sensor_time" ON app_builder.sensor_readings USING btree (sensor_id, "timestamp" DESC)
app_builder|sensor_readings|PK_sensor_readings|CREATE UNIQUE INDEX "PK_sensor_readings" ON app_builder.sensor_readings USING btree (id)
app_builder|service_health_status|IDX_service_health_status_val|CREATE INDEX "IDX_service_health_status_val" ON app_builder.service_health_status USING btree (status)
app_builder|service_health_status|PK_service_health_status|CREATE UNIQUE INDEX "PK_service_health_status" ON app_builder.service_health_status USING btree (id)
app_builder|service_health_status|UQ_service_health_name|CREATE UNIQUE INDEX "UQ_service_health_name" ON app_builder.service_health_status USING btree (service_name)
app_builder|sprint_recordings|IDX_sprint_recordings_recorded_at|CREATE INDEX "IDX_sprint_recordings_recorded_at" ON app_builder.sprint_recordings USING btree (recorded_at DESC)
app_builder|sprint_recordings|IDX_sprint_recordings_recorded_by|CREATE INDEX "IDX_sprint_recordings_recorded_by" ON app_builder.sprint_recordings USING btree (recorded_by)
app_builder|sprint_recordings|IDX_sprint_recordings_status|CREATE INDEX "IDX_sprint_recordings_status" ON app_builder.sprint_recordings USING btree (status)
app_builder|sprint_recordings|PK_sprint_recordings|CREATE UNIQUE INDEX "PK_sprint_recordings" ON app_builder.sprint_recordings USING btree (id)
app_builder|story_implementations|IDX_story_implementations_artifact|CREATE INDEX "IDX_story_implementations_artifact" ON app_builder.story_implementations USING btree (artifact_type, artifact_id)
app_builder|story_implementations|IDX_story_implementations_story|CREATE INDEX "IDX_story_implementations_story" ON app_builder.story_implementations USING btree (story_id)
app_builder|story_implementations|PK_story_implementations|CREATE UNIQUE INDEX "PK_story_implementations" ON app_builder.story_implementations USING btree (id)
app_builder|upgrade_fixes|IDX_upgrade_fixes_analysis|CREATE INDEX "IDX_upgrade_fixes_analysis" ON app_builder.upgrade_fixes USING btree (analysis_id)
app_builder|upgrade_fixes|IDX_upgrade_fixes_customization|CREATE INDEX "IDX_upgrade_fixes_customization" ON app_builder.upgrade_fixes USING btree (customization_id)
app_builder|upgrade_fixes|PK_upgrade_fixes|CREATE UNIQUE INDEX "PK_upgrade_fixes" ON app_builder.upgrade_fixes USING btree (id)
app_builder|upgrade_impact_analyses|IDX_upgrade_analyses_status|CREATE INDEX "IDX_upgrade_analyses_status" ON app_builder.upgrade_impact_analyses USING btree (analysis_status)
app_builder|upgrade_impact_analyses|IDX_upgrade_analyses_versions|CREATE INDEX "IDX_upgrade_analyses_versions" ON app_builder.upgrade_impact_analyses USING btree (from_version, to_version)
app_builder|upgrade_impact_analyses|PK_upgrade_impact_analyses|CREATE UNIQUE INDEX "PK_upgrade_impact_analyses" ON app_builder.upgrade_impact_analyses USING btree (id)
app_builder|user_behaviors|IDX_user_behaviors_action|CREATE INDEX "IDX_user_behaviors_action" ON app_builder.user_behaviors USING btree (action)
app_builder|user_behaviors|IDX_user_behaviors_route|CREATE INDEX "IDX_user_behaviors_route" ON app_builder.user_behaviors USING btree (route)
app_builder|user_behaviors|IDX_user_behaviors_user_time|CREATE INDEX "IDX_user_behaviors_user_time" ON app_builder.user_behaviors USING btree (user_id, "timestamp" DESC)
app_builder|user_behaviors|PK_user_behaviors|CREATE UNIQUE INDEX "PK_user_behaviors" ON app_builder.user_behaviors USING btree (id)
app_builder|user_patterns|IDX_user_patterns_type|CREATE INDEX "IDX_user_patterns_type" ON app_builder.user_patterns USING btree (pattern_type)
app_builder|user_patterns|IDX_user_patterns_user|CREATE INDEX "IDX_user_patterns_user" ON app_builder.user_patterns USING btree (user_id, pattern_type)
app_builder|user_patterns|PK_user_patterns|CREATE UNIQUE INDEX "PK_user_patterns" ON app_builder.user_patterns USING btree (id)
app_builder|voice_command_patterns|IDX_voice_patterns_active|CREATE INDEX "IDX_voice_patterns_active" ON app_builder.voice_command_patterns USING btree (is_active)
app_builder|voice_command_patterns|IDX_voice_patterns_intent|CREATE UNIQUE INDEX "IDX_voice_patterns_intent" ON app_builder.voice_command_patterns USING btree (intent)
app_builder|voice_command_patterns|PK_voice_command_patterns|CREATE UNIQUE INDEX "PK_voice_command_patterns" ON app_builder.voice_command_patterns USING btree (id)
app_builder|voice_commands|IDX_voice_commands_intent|CREATE INDEX "IDX_voice_commands_intent" ON app_builder.voice_commands USING btree (intent)
app_builder|voice_commands|IDX_voice_commands_session|CREATE INDEX "IDX_voice_commands_session" ON app_builder.voice_commands USING btree (session_id)
app_builder|voice_commands|IDX_voice_commands_user|CREATE INDEX "IDX_voice_commands_user" ON app_builder.voice_commands USING btree (user_id, created_at DESC)
app_builder|voice_commands|PK_voice_commands|CREATE UNIQUE INDEX "PK_voice_commands" ON app_builder.voice_commands USING btree (id)
app_builder|zero_code_app_versions|IDX_app_versions_app|CREATE INDEX "IDX_app_versions_app" ON app_builder.zero_code_app_versions USING btree (app_id, created_at DESC)
app_builder|zero_code_app_versions|PK_zero_code_app_versions|CREATE UNIQUE INDEX "PK_zero_code_app_versions" ON app_builder.zero_code_app_versions USING btree (id)
app_builder|zero_code_apps|IDX_zero_code_apps_category|CREATE INDEX "IDX_zero_code_apps_category" ON app_builder.zero_code_apps USING btree (category)
app_builder|zero_code_apps|IDX_zero_code_apps_creator|CREATE INDEX "IDX_zero_code_apps_creator" ON app_builder.zero_code_apps USING btree (created_by)
app_builder|zero_code_apps|IDX_zero_code_apps_published|CREATE INDEX "IDX_zero_code_apps_published" ON app_builder.zero_code_apps USING btree (is_published)
app_builder|zero_code_apps|PK_zero_code_apps|CREATE UNIQUE INDEX "PK_zero_code_apps" ON app_builder.zero_code_apps USING btree (id)
automation|approvals|approvals_pkey|CREATE UNIQUE INDEX approvals_pkey ON automation.approvals USING btree (id)
automation|approvals|idx_approvals_approver|CREATE INDEX idx_approvals_approver ON automation.approvals USING btree (approver_id, status)
automation|approvals|idx_approvals_pending|CREATE INDEX idx_approvals_pending ON automation.approvals USING btree (due_date) WHERE ((status)::text = 'pending'::text)
automation|approvals|idx_approvals_process_flow|CREATE INDEX idx_approvals_process_flow ON automation.approvals USING btree (process_flow_instance_id)
automation|automation_execution_logs|idx_execution_logs_automation_created|CREATE INDEX idx_execution_logs_automation_created ON automation.automation_execution_logs USING btree (automation_rule_id, created_at)
automation|automation_execution_logs|idx_execution_logs_record_created|CREATE INDEX idx_execution_logs_record_created ON automation.automation_execution_logs USING btree (record_id, created_at)
automation|automation_execution_logs|idx_execution_logs_status_created|CREATE INDEX idx_execution_logs_status_created ON automation.automation_execution_logs USING btree (status, created_at)
automation|automation_execution_logs|pk_automation_execution_logs|CREATE UNIQUE INDEX pk_automation_execution_logs ON automation.automation_execution_logs USING btree (id)
automation|automation_rule_revisions|automation_rule_revisions_pkey|CREATE UNIQUE INDEX automation_rule_revisions_pkey ON automation.automation_rule_revisions USING btree (id)
automation|automation_rule_revisions|idx_automation_rule_revisions_ar_rev|CREATE UNIQUE INDEX idx_automation_rule_revisions_ar_rev ON automation.automation_rule_revisions USING btree (automation_rule_id, revision)
automation|automation_rule_revisions|idx_automation_rule_revisions_automation_rule_id|CREATE INDEX idx_automation_rule_revisions_automation_rule_id ON automation.automation_rule_revisions USING btree (automation_rule_id)
automation|automation_rule_revisions|idx_automation_rule_revisions_status|CREATE INDEX idx_automation_rule_revisions_status ON automation.automation_rule_revisions USING btree (status)
automation|automation_rules|idx_automation_rules_application_id|CREATE INDEX idx_automation_rules_application_id ON automation.automation_rules USING btree (application_id)
automation|automation_rules|idx_automation_rules_collection_active|CREATE INDEX idx_automation_rules_collection_active ON automation.automation_rules USING btree (collection_id, is_active)
automation|automation_rules|idx_automation_rules_collection_id|CREATE INDEX idx_automation_rules_collection_id ON automation.automation_rules USING btree (collection_id)
automation|automation_rules|idx_automation_rules_metadata_gin|CREATE INDEX idx_automation_rules_metadata_gin ON automation.automation_rules USING gin (metadata jsonb_path_ops)
automation|automation_rules|idx_automation_rules_source|CREATE INDEX idx_automation_rules_source ON automation.automation_rules USING btree (source)
automation|automation_rules|idx_automation_rules_status|CREATE INDEX idx_automation_rules_status ON automation.automation_rules USING btree (status)
automation|automation_rules|idx_automation_rules_timing_active|CREATE INDEX idx_automation_rules_timing_active ON automation.automation_rules USING btree (trigger_timing, is_active)
automation|automation_rules|pk_automation_rules|CREATE UNIQUE INDEX pk_automation_rules ON automation.automation_rules USING btree (id)
automation|business_hours|business_hours_code_key|CREATE UNIQUE INDEX business_hours_code_key ON automation.business_hours USING btree (code)
automation|business_hours|business_hours_pkey|CREATE UNIQUE INDEX business_hours_pkey ON automation.business_hours USING btree (id)
automation|client_scripts|idx_client_scripts_collection_active|CREATE INDEX idx_client_scripts_collection_active ON automation.client_scripts USING btree (collection_id, is_active)
automation|client_scripts|pk_client_scripts|CREATE UNIQUE INDEX pk_client_scripts ON automation.client_scripts USING btree (id)
automation|connectors|connectors_code_key|CREATE UNIQUE INDEX connectors_code_key ON automation.connectors USING btree (code)
automation|connectors|connectors_pkey|CREATE UNIQUE INDEX connectors_pkey ON automation.connectors USING btree (id)
automation|connectors|idx_connectors_kind_status|CREATE INDEX idx_connectors_kind_status ON automation.connectors USING btree (kind, status)
automation|connectors|idx_connectors_source|CREATE INDEX idx_connectors_source ON automation.connectors USING btree (source)
automation|cross_domain_read_diff|IDX_cross_domain_read_diff_caller_callsite_detected_at|CREATE INDEX "IDX_cross_domain_read_diff_caller_callsite_detected_at" ON automation.cross_domain_read_diff USING btree (caller_service, callsite, detected_at)
automation|cross_domain_read_diff|IDX_cross_domain_read_diff_detected_at|CREATE INDEX "IDX_cross_domain_read_diff_detected_at" ON automation.cross_domain_read_diff USING btree (detected_at)
automation|cross_domain_read_diff|IDX_cross_domain_read_diff_kind|CREATE INDEX "IDX_cross_domain_read_diff_kind" ON automation.cross_domain_read_diff USING btree (diff_kind)
automation|cross_domain_read_diff|PK_cross_domain_read_diff|CREATE UNIQUE INDEX "PK_cross_domain_read_diff" ON automation.cross_domain_read_diff USING btree (id)
automation|decision_inputs|decision_inputs_pkey|CREATE UNIQUE INDEX decision_inputs_pkey ON automation.decision_inputs USING btree (id)
automation|decision_inputs|uq_decision_inputs_table_position|CREATE UNIQUE INDEX uq_decision_inputs_table_position ON automation.decision_inputs USING btree (table_id, "position")
automation|decision_rows|decision_rows_pkey|CREATE UNIQUE INDEX decision_rows_pkey ON automation.decision_rows USING btree (id)
automation|decision_rows|idx_decision_rows_table_position|CREATE INDEX idx_decision_rows_table_position ON automation.decision_rows USING btree (table_id, "position")
automation|decision_table_revisions|decision_table_revisions_pkey|CREATE UNIQUE INDEX decision_table_revisions_pkey ON automation.decision_table_revisions USING btree (id)
automation|decision_table_revisions|idx_decision_table_revisions_status|CREATE INDEX idx_decision_table_revisions_status ON automation.decision_table_revisions USING btree (status)
automation|decision_table_revisions|idx_decision_table_revisions_table|CREATE INDEX idx_decision_table_revisions_table ON automation.decision_table_revisions USING btree (table_id)
automation|decision_table_revisions|uq_decision_table_revisions_table_revision|CREATE UNIQUE INDEX uq_decision_table_revisions_table_revision ON automation.decision_table_revisions USING btree (table_id, revision)
automation|decision_tables|decision_tables_code_key|CREATE UNIQUE INDEX decision_tables_code_key ON automation.decision_tables USING btree (code)
automation|decision_tables|decision_tables_pkey|CREATE UNIQUE INDEX decision_tables_pkey ON automation.decision_tables USING btree (id)
automation|decision_tables|idx_decision_tables_application|CREATE INDEX idx_decision_tables_application ON automation.decision_tables USING btree (application_id)
automation|decision_tables|idx_decision_tables_collection|CREATE INDEX idx_decision_tables_collection ON automation.decision_tables USING btree (collection_id)
automation|decision_tables|idx_decision_tables_source|CREATE INDEX idx_decision_tables_source ON automation.decision_tables USING btree (source)
automation|decision_tables|idx_decision_tables_status|CREATE INDEX idx_decision_tables_status ON automation.decision_tables USING btree (status)
automation|guided_process_activities|guided_process_activities_pkey|CREATE UNIQUE INDEX guided_process_activities_pkey ON automation.guided_process_activities USING btree (id)
automation|guided_process_activities|uq_guided_process_activities_position|CREATE UNIQUE INDEX uq_guided_process_activities_position ON automation.guided_process_activities USING btree (stage_id, "position")
automation|guided_process_revisions|guided_process_revisions_pkey|CREATE UNIQUE INDEX guided_process_revisions_pkey ON automation.guided_process_revisions USING btree (id)
automation|guided_process_revisions|idx_guided_process_revisions_process|CREATE INDEX idx_guided_process_revisions_process ON automation.guided_process_revisions USING btree (process_id)
automation|guided_process_revisions|idx_guided_process_revisions_status|CREATE INDEX idx_guided_process_revisions_status ON automation.guided_process_revisions USING btree (status)
automation|guided_process_revisions|uq_guided_process_revisions_process_revision|CREATE UNIQUE INDEX uq_guided_process_revisions_process_revision ON automation.guided_process_revisions USING btree (process_id, revision)
automation|guided_process_stages|guided_process_stages_pkey|CREATE UNIQUE INDEX guided_process_stages_pkey ON automation.guided_process_stages USING btree (id)
automation|guided_process_stages|uq_guided_process_stages_position|CREATE UNIQUE INDEX uq_guided_process_stages_position ON automation.guided_process_stages USING btree (process_id, "position")
automation|guided_processes|guided_processes_code_key|CREATE UNIQUE INDEX guided_processes_code_key ON automation.guided_processes USING btree (code)
automation|guided_processes|guided_processes_pkey|CREATE UNIQUE INDEX guided_processes_pkey ON automation.guided_processes USING btree (id)
automation|guided_processes|idx_guided_processes_application|CREATE INDEX idx_guided_processes_application ON automation.guided_processes USING btree (application_id)
automation|guided_processes|idx_guided_processes_collection|CREATE INDEX idx_guided_processes_collection ON automation.guided_processes USING btree (collection_id)
automation|guided_processes|idx_guided_processes_source|CREATE INDEX idx_guided_processes_source ON automation.guided_processes USING btree (source)
automation|guided_processes|idx_guided_processes_status|CREATE INDEX idx_guided_processes_status ON automation.guided_processes USING btree (status)
automation|process_flow_definition_revisions|idx_process_flow_definition_revisions_pf_rev|CREATE UNIQUE INDEX idx_process_flow_definition_revisions_pf_rev ON automation.process_flow_definition_revisions USING btree (process_flow_id, revision)
automation|process_flow_definition_revisions|idx_process_flow_definition_revisions_process_flow_id|CREATE INDEX idx_process_flow_definition_revisions_process_flow_id ON automation.process_flow_definition_revisions USING btree (process_flow_id)
automation|process_flow_definition_revisions|idx_process_flow_definition_revisions_status|CREATE INDEX idx_process_flow_definition_revisions_status ON automation.process_flow_definition_revisions USING btree (status)
automation|process_flow_definition_revisions|process_flow_definition_revisions_pkey|CREATE UNIQUE INDEX process_flow_definition_revisions_pkey ON automation.process_flow_definition_revisions USING btree (id)
automation|process_flow_definitions|idx_process_flow_definitions_application_id|CREATE INDEX idx_process_flow_definitions_application_id ON automation.process_flow_definitions USING btree (application_id)
automation|process_flow_definitions|idx_process_flow_definitions_collection|CREATE INDEX idx_process_flow_definitions_collection ON automation.process_flow_definitions USING btree (collection_id) WHERE (is_active = true)
automation|process_flow_definitions|idx_process_flow_definitions_source|CREATE INDEX idx_process_flow_definitions_source ON automation.process_flow_definitions USING btree (source)
automation|process_flow_definitions|idx_process_flow_definitions_status|CREATE INDEX idx_process_flow_definitions_status ON automation.process_flow_definitions USING btree (status)
automation|process_flow_definitions|idx_process_flow_definitions_trigger|CREATE INDEX idx_process_flow_definitions_trigger ON automation.process_flow_definitions USING gin (trigger_conditions)
automation|process_flow_definitions|process_flow_definitions_code_key|CREATE UNIQUE INDEX process_flow_definitions_code_key ON automation.process_flow_definitions USING btree (code)
automation|process_flow_definitions|process_flow_definitions_pkey|CREATE UNIQUE INDEX process_flow_definitions_pkey ON automation.process_flow_definitions USING btree (id)
automation|process_flow_execution_history|idx_process_flow_history_instance|CREATE INDEX idx_process_flow_history_instance ON automation.process_flow_execution_history USING btree (instance_id, created_at DESC)
automation|process_flow_execution_history|process_flow_execution_history_pkey|CREATE UNIQUE INDEX process_flow_execution_history_pkey ON automation.process_flow_execution_history USING btree (id)
automation|process_flow_instances|idx_process_flow_instances_process_flow|CREATE INDEX idx_process_flow_instances_process_flow ON automation.process_flow_instances USING btree (process_flow_id)
automation|process_flow_instances|idx_process_flow_instances_record|CREATE INDEX idx_process_flow_instances_record ON automation.process_flow_instances USING btree (collection_id, record_id)
automation|process_flow_instances|idx_process_flow_instances_state|CREATE INDEX idx_process_flow_instances_state ON automation.process_flow_instances USING btree (state) WHERE ((state)::text = ANY (ARRAY[('running'::character varying)::text, ('waiting_approval'::character varying)::text]))
automation|process_flow_instances|process_flow_instances_pkey|CREATE UNIQUE INDEX process_flow_instances_pkey ON automation.process_flow_instances USING btree (id)
automation|scheduled_jobs|idx_scheduled_jobs_active_next_run|CREATE INDEX idx_scheduled_jobs_active_next_run ON automation.scheduled_jobs USING btree (is_active, next_run_at)
automation|scheduled_jobs|pk_scheduled_jobs|CREATE UNIQUE INDEX pk_scheduled_jobs ON automation.scheduled_jobs USING btree (id)
automation|sla_breaches|idx_sla_breaches_created|CREATE INDEX idx_sla_breaches_created ON automation.sla_breaches USING btree (created_at DESC)
automation|sla_breaches|idx_sla_breaches_record|CREATE INDEX idx_sla_breaches_record ON automation.sla_breaches USING btree (collection_id, record_id)
automation|sla_breaches|sla_breaches_pkey|CREATE UNIQUE INDEX sla_breaches_pkey ON automation.sla_breaches USING btree (id)
automation|sla_definitions|idx_sla_definitions_collection|CREATE INDEX idx_sla_definitions_collection ON automation.sla_definitions USING btree (collection_id) WHERE (is_active = true)
automation|sla_definitions|sla_definitions_code_key|CREATE UNIQUE INDEX sla_definitions_code_key ON automation.sla_definitions USING btree (code)
automation|sla_definitions|sla_definitions_pkey|CREATE UNIQUE INDEX sla_definitions_pkey ON automation.sla_definitions USING btree (id)
automation|sla_instances|idx_sla_instances_record|CREATE INDEX idx_sla_instances_record ON automation.sla_instances USING btree (collection_id, record_id)
automation|sla_instances|idx_sla_instances_state|CREATE INDEX idx_sla_instances_state ON automation.sla_instances USING btree (state)
automation|sla_instances|idx_sla_instances_target|CREATE INDEX idx_sla_instances_target ON automation.sla_instances USING btree (target_time) WHERE ((state)::text = 'active'::text)
automation|sla_instances|sla_instances_pkey|CREATE UNIQUE INDEX sla_instances_pkey ON automation.sla_instances USING btree (id)
automation|state_change_history|idx_state_change_record|CREATE INDEX idx_state_change_record ON automation.state_change_history USING btree (collection_id, record_id, created_at DESC)
automation|state_change_history|state_change_history_pkey|CREATE UNIQUE INDEX state_change_history_pkey ON automation.state_change_history USING btree (id)
automation|state_machine_definitions|idx_state_machine_collection|CREATE INDEX idx_state_machine_collection ON automation.state_machine_definitions USING btree (collection_id) WHERE (is_active = true)
automation|state_machine_definitions|state_machine_definitions_code_key|CREATE UNIQUE INDEX state_machine_definitions_code_key ON automation.state_machine_definitions USING btree (code)
automation|state_machine_definitions|state_machine_definitions_pkey|CREATE UNIQUE INDEX state_machine_definitions_pkey ON automation.state_machine_definitions USING btree (id)
ava|ava_anomalies|ava_anomalies_pkey|CREATE UNIQUE INDEX ava_anomalies_pkey ON ava.ava_anomalies USING btree (id)
ava|ava_anomalies|idx_ava_anomalies_detected_at|CREATE INDEX idx_ava_anomalies_detected_at ON ava.ava_anomalies USING btree (detected_at)
ava|ava_anomalies|idx_ava_anomalies_is_resolved|CREATE INDEX idx_ava_anomalies_is_resolved ON ava.ava_anomalies USING btree (is_resolved)
ava|ava_anomalies|idx_ava_anomalies_severity|CREATE INDEX idx_ava_anomalies_severity ON ava.ava_anomalies USING btree (severity)
ava|ava_anomalies|idx_ava_anomalies_type|CREATE INDEX idx_ava_anomalies_type ON ava.ava_anomalies USING btree (anomaly_type)
ava|ava_audit_trail|IDX_106f148639500d8a937386b5a7|CREATE INDEX "IDX_106f148639500d8a937386b5a7" ON ava.ava_audit_trail USING btree (target_collection)
ava|ava_audit_trail|IDX_97c0f7d7333849f12e42cf7779|CREATE INDEX "IDX_97c0f7d7333849f12e42cf7779" ON ava.ava_audit_trail USING btree (action_type)
ava|ava_audit_trail|IDX_a388db879a8dcc4ccdb37264fa|CREATE INDEX "IDX_a388db879a8dcc4ccdb37264fa" ON ava.ava_audit_trail USING btree (status)
ava|ava_audit_trail|IDX_e1702c609e880eb3d176d060ed|CREATE INDEX "IDX_e1702c609e880eb3d176d060ed" ON ava.ava_audit_trail USING btree (user_id)
ava|ava_audit_trail|IDX_f57eac7ca7c67e6dc24f2f1be1|CREATE INDEX "IDX_f57eac7ca7c67e6dc24f2f1be1" ON ava.ava_audit_trail USING btree (created_at)
ava|ava_audit_trail|PK_8883aeb20729f23f84dddd4cd2b|CREATE UNIQUE INDEX "PK_8883aeb20729f23f84dddd4cd2b" ON ava.ava_audit_trail USING btree (id)
ava|ava_cards|ava_cards_code_key|CREATE UNIQUE INDEX ava_cards_code_key ON ava.ava_cards USING btree (code)
ava|ava_cards|ava_cards_pkey|CREATE UNIQUE INDEX ava_cards_pkey ON ava.ava_cards USING btree (id)
ava|ava_contexts|ava_contexts_pkey|CREATE UNIQUE INDEX ava_contexts_pkey ON ava.ava_contexts USING btree (id)
ava|ava_contexts|idx_ava_contexts_context_type|CREATE INDEX idx_ava_contexts_context_type ON ava.ava_contexts USING btree (context_type)
ava|ava_contexts|idx_ava_contexts_expires_at|CREATE INDEX idx_ava_contexts_expires_at ON ava.ava_contexts USING btree (expires_at)
ava|ava_contexts|idx_ava_contexts_user_id|CREATE INDEX idx_ava_contexts_user_id ON ava.ava_contexts USING btree (user_id)
ava|ava_conversations|IDX_ava_conversations_organization_id|CREATE INDEX "IDX_ava_conversations_organization_id" ON ava.ava_conversations USING btree (organization_id)
ava|ava_conversations|IDX_ava_conversations_user_org|CREATE INDEX "IDX_ava_conversations_user_org" ON ava.ava_conversations USING btree (user_id, organization_id)
ava|ava_conversations|ava_conversations_pkey|CREATE UNIQUE INDEX ava_conversations_pkey ON ava.ava_conversations USING btree (id)
ava|ava_conversations|idx_ava_conversations_created_at|CREATE INDEX idx_ava_conversations_created_at ON ava.ava_conversations USING btree (created_at)
ava|ava_conversations|idx_ava_conversations_status|CREATE INDEX idx_ava_conversations_status ON ava.ava_conversations USING btree (status)
ava|ava_conversations|idx_ava_conversations_user_id|CREATE INDEX idx_ava_conversations_user_id ON ava.ava_conversations USING btree (user_id)
ava|ava_feedback|ava_feedback_pkey|CREATE UNIQUE INDEX ava_feedback_pkey ON ava.ava_feedback USING btree (id)
ava|ava_feedback|idx_ava_feedback_message_id|CREATE INDEX idx_ava_feedback_message_id ON ava.ava_feedback USING btree (message_id)
ava|ava_feedback|idx_ava_feedback_type|CREATE INDEX idx_ava_feedback_type ON ava.ava_feedback USING btree (feedback_type)
ava|ava_feedback|idx_ava_feedback_user_id|CREATE INDEX idx_ava_feedback_user_id ON ava.ava_feedback USING btree (user_id)
ava|ava_global_settings|PK_ae7c69697b886ebe857e9e15239|CREATE UNIQUE INDEX "PK_ae7c69697b886ebe857e9e15239" ON ava.ava_global_settings USING btree (id)
ava|ava_intents|ava_intents_pkey|CREATE UNIQUE INDEX ava_intents_pkey ON ava.ava_intents USING btree (id)
ava|ava_intents|idx_ava_intents_category|CREATE INDEX idx_ava_intents_category ON ava.ava_intents USING btree (category)
ava|ava_intents|idx_ava_intents_intent_name|CREATE INDEX idx_ava_intents_intent_name ON ava.ava_intents USING btree (intent_name)
ava|ava_intents|idx_ava_intents_message_id|CREATE INDEX idx_ava_intents_message_id ON ava.ava_intents USING btree (message_id)
ava|ava_knowledge_embeddings|ava_knowledge_embeddings_pkey|CREATE UNIQUE INDEX ava_knowledge_embeddings_pkey ON ava.ava_knowledge_embeddings USING btree (id)
ava|ava_knowledge_embeddings|idx_ava_embeddings_source_id|CREATE INDEX idx_ava_embeddings_source_id ON ava.ava_knowledge_embeddings USING btree (source_id)
ava|ava_knowledge_embeddings|idx_ava_embeddings_source_type|CREATE INDEX idx_ava_embeddings_source_type ON ava.ava_knowledge_embeddings USING btree (source_type)
ava|ava_messages|ava_messages_pkey|CREATE UNIQUE INDEX ava_messages_pkey ON ava.ava_messages USING btree (id)
ava|ava_messages|idx_ava_messages_conversation_id|CREATE INDEX idx_ava_messages_conversation_id ON ava.ava_messages USING btree (conversation_id)
ava|ava_messages|idx_ava_messages_created_at|CREATE INDEX idx_ava_messages_created_at ON ava.ava_messages USING btree (created_at)
ava|ava_messages|idx_ava_messages_role|CREATE INDEX idx_ava_messages_role ON ava.ava_messages USING btree (role)
ava|ava_permission_configs|IDX_6cd7923ae0d32881a0d82c0280|CREATE UNIQUE INDEX "IDX_6cd7923ae0d32881a0d82c0280" ON ava.ava_permission_configs USING btree (collection_code, action_type)
ava|ava_permission_configs|PK_11683766f65091641045f8ae30f|CREATE UNIQUE INDEX "PK_11683766f65091641045f8ae30f" ON ava.ava_permission_configs USING btree (id)
ava|ava_predictions|ava_predictions_pkey|CREATE UNIQUE INDEX ava_predictions_pkey ON ava.ava_predictions USING btree (id)
ava|ava_predictions|idx_ava_predictions_is_active|CREATE INDEX idx_ava_predictions_is_active ON ava.ava_predictions USING btree (is_active)
ava|ava_predictions|idx_ava_predictions_target_date|CREATE INDEX idx_ava_predictions_target_date ON ava.ava_predictions USING btree (target_date)
ava|ava_predictions|idx_ava_predictions_type|CREATE INDEX idx_ava_predictions_type ON ava.ava_predictions USING btree (prediction_type)
ava|ava_prompt_policies|ava_prompt_policies_code_key|CREATE UNIQUE INDEX ava_prompt_policies_code_key ON ava.ava_prompt_policies USING btree (code)
ava|ava_prompt_policies|ava_prompt_policies_pkey|CREATE UNIQUE INDEX ava_prompt_policies_pkey ON ava.ava_prompt_policies USING btree (id)
ava|ava_proposal|IDX_ava_proposal_actor_id_state|CREATE INDEX "IDX_ava_proposal_actor_id_state" ON ava.ava_proposal USING btree (actor_id, state)
ava|ava_proposal|IDX_ava_proposal_state_created_at|CREATE INDEX "IDX_ava_proposal_state_created_at" ON ava.ava_proposal USING btree (state, created_at)
ava|ava_proposal|ava_proposal_pkey|CREATE UNIQUE INDEX ava_proposal_pkey ON ava.ava_proposal USING btree (id)
ava|ava_suggestions|ava_suggestions_pkey|CREATE UNIQUE INDEX ava_suggestions_pkey ON ava.ava_suggestions USING btree (id)
ava|ava_suggestions|idx_ava_suggestions_is_accepted|CREATE INDEX idx_ava_suggestions_is_accepted ON ava.ava_suggestions USING btree (is_accepted)
ava|ava_suggestions|idx_ava_suggestions_target_entity|CREATE INDEX idx_ava_suggestions_target_entity ON ava.ava_suggestions USING btree (target_entity)
ava|ava_suggestions|idx_ava_suggestions_type|CREATE INDEX idx_ava_suggestions_type ON ava.ava_suggestions USING btree (suggestion_type)
ava|ava_suggestions|idx_ava_suggestions_user_id|CREATE INDEX idx_ava_suggestions_user_id ON ava.ava_suggestions USING btree (user_id)
ava|ava_tools|ava_tools_code_key|CREATE UNIQUE INDEX ava_tools_code_key ON ava.ava_tools USING btree (code)
ava|ava_tools|ava_tools_pkey|CREATE UNIQUE INDEX ava_tools_pkey ON ava.ava_tools USING btree (id)
ava|ava_topics|ava_topics_code_key|CREATE UNIQUE INDEX ava_topics_code_key ON ava.ava_topics USING btree (code)
ava|ava_topics|ava_topics_pkey|CREATE UNIQUE INDEX ava_topics_pkey ON ava.ava_topics USING btree (id)
ava|ava_usage_metrics|ava_usage_metrics_pkey|CREATE UNIQUE INDEX ava_usage_metrics_pkey ON ava.ava_usage_metrics USING btree (id)
ava|ava_usage_metrics|idx_ava_usage_metric_date|CREATE INDEX idx_ava_usage_metric_date ON ava.ava_usage_metrics USING btree (metric_date)
ava|ava_usage_metrics|idx_ava_usage_metric_type|CREATE INDEX idx_ava_usage_metric_type ON ava.ava_usage_metrics USING btree (metric_type)
ava|ava_usage_metrics|idx_ava_usage_user_id|CREATE INDEX idx_ava_usage_user_id ON ava.ava_usage_metrics USING btree (user_id)
ava|dataset_definitions|dataset_definitions_code_key|CREATE UNIQUE INDEX dataset_definitions_code_key ON ava.dataset_definitions USING btree (code)
ava|dataset_definitions|dataset_definitions_pkey|CREATE UNIQUE INDEX dataset_definitions_pkey ON ava.dataset_definitions USING btree (id)
ava|dataset_definitions|idx_dataset_definitions_active|CREATE INDEX idx_dataset_definitions_active ON ava.dataset_definitions USING btree (is_active)
ava|dataset_snapshots|dataset_snapshots_pkey|CREATE UNIQUE INDEX dataset_snapshots_pkey ON ava.dataset_snapshots USING btree (id)
ava|dataset_snapshots|idx_dataset_snapshots_definition|CREATE INDEX idx_dataset_snapshots_definition ON ava.dataset_snapshots USING btree (dataset_definition_id)
ava|dataset_snapshots|idx_dataset_snapshots_status|CREATE INDEX idx_dataset_snapshots_status ON ava.dataset_snapshots USING btree (status)
ava|model_artifacts|idx_model_artifacts_status|CREATE INDEX idx_model_artifacts_status ON ava.model_artifacts USING btree (status)
ava|model_artifacts|model_artifacts_pkey|CREATE UNIQUE INDEX model_artifacts_pkey ON ava.model_artifacts USING btree (id)
ava|model_artifacts|uq_model_artifacts_code_version|CREATE UNIQUE INDEX uq_model_artifacts_code_version ON ava.model_artifacts USING btree (code, version)
ava|model_deployments|idx_model_deployments_artifact|CREATE INDEX idx_model_deployments_artifact ON ava.model_deployments USING btree (model_artifact_id)
ava|model_deployments|idx_model_deployments_status|CREATE INDEX idx_model_deployments_status ON ava.model_deployments USING btree (status)
ava|model_deployments|model_deployments_pkey|CREATE UNIQUE INDEX model_deployments_pkey ON ava.model_deployments USING btree (id)
ava|model_evaluations|idx_model_evaluations_artifact|CREATE INDEX idx_model_evaluations_artifact ON ava.model_evaluations USING btree (model_artifact_id)
ava|model_evaluations|idx_model_evaluations_status|CREATE INDEX idx_model_evaluations_status ON ava.model_evaluations USING btree (status)
ava|model_evaluations|model_evaluations_pkey|CREATE UNIQUE INDEX model_evaluations_pkey ON ava.model_evaluations USING btree (id)
ava|model_training_jobs|idx_model_training_jobs_code|CREATE INDEX idx_model_training_jobs_code ON ava.model_training_jobs USING btree (model_code, model_version)
ava|model_training_jobs|idx_model_training_jobs_status|CREATE INDEX idx_model_training_jobs_status ON ava.model_training_jobs USING btree (status)
ava|model_training_jobs|model_training_jobs_pkey|CREATE UNIQUE INDEX model_training_jobs_pkey ON ava.model_training_jobs USING btree (id)
identity|auth_events|IDX_64ac9bded13b2b6b75b128d8e5|CREATE INDEX "IDX_64ac9bded13b2b6b75b128d8e5" ON identity.auth_events USING btree (created_at)
identity|auth_events|IDX_aff0693e5ee9e891fcdb414daa|CREATE INDEX "IDX_aff0693e5ee9e891fcdb414daa" ON identity.auth_events USING btree (event_type)
identity|auth_events|IDX_d27703f0a3d79ba424741807cb|CREATE INDEX "IDX_d27703f0a3d79ba424741807cb" ON identity.auth_events USING btree (user_id)
identity|auth_events|PK_ab929cc6084ffb3fd795bd983c0|CREATE UNIQUE INDEX "PK_ab929cc6084ffb3fd795bd983c0" ON identity.auth_events USING btree (id)
identity|auth_settings|PK_daf9fe3ab40a3241250fcd21127|CREATE UNIQUE INDEX "PK_daf9fe3ab40a3241250fcd21127" ON identity.auth_settings USING btree (id)
identity|behavioral_profiles|behavioral_profiles_pkey|CREATE UNIQUE INDEX behavioral_profiles_pkey ON identity.behavioral_profiles USING btree (id)
identity|behavioral_profiles|behavioral_profiles_user_id_key|CREATE UNIQUE INDEX behavioral_profiles_user_id_key ON identity.behavioral_profiles USING btree (user_id)
identity|delegations|delegations_pkey|CREATE UNIQUE INDEX delegations_pkey ON identity.delegations USING btree (id)
identity|delegations|idx_delegations_dates|CREATE INDEX idx_delegations_dates ON identity.delegations USING btree (starts_at, ends_at)
identity|delegations|idx_delegations_delegate|CREATE INDEX idx_delegations_delegate ON identity.delegations USING btree (delegate_id)
identity|delegations|idx_delegations_delegator|CREATE INDEX idx_delegations_delegator ON identity.delegations USING btree (delegator_id)
identity|delegations|idx_delegations_status|CREATE INDEX idx_delegations_status ON identity.delegations USING btree (status)
identity|email_verification_tokens|IDX_3d1613f95c6a564a3b588d161a|CREATE UNIQUE INDEX "IDX_3d1613f95c6a564a3b588d161a" ON identity.email_verification_tokens USING btree (token)
identity|email_verification_tokens|IDX_b7c64ecae33a54d3a11a4e6b6e|CREATE INDEX "IDX_b7c64ecae33a54d3a11a4e6b6e" ON identity.email_verification_tokens USING btree (expires_at)
identity|email_verification_tokens|IDX_fdcb77f72f529bf65c95d72a14|CREATE INDEX "IDX_fdcb77f72f529bf65c95d72a14" ON identity.email_verification_tokens USING btree (user_id)
identity|email_verification_tokens|PK_417a095bbed21c2369a6a01ab9a|CREATE UNIQUE INDEX "PK_417a095bbed21c2369a6a01ab9a" ON identity.email_verification_tokens USING btree (id)
identity|email_verification_tokens|UQ_3d1613f95c6a564a3b588d161ae|CREATE UNIQUE INDEX "UQ_3d1613f95c6a564a3b588d161ae" ON identity.email_verification_tokens USING btree (token)
identity|group_members|IDX_20a555b299f75843aa53ff8b0e|CREATE INDEX "IDX_20a555b299f75843aa53ff8b0e" ON identity.group_members USING btree (user_id)
identity|group_members|IDX_2c840df5db52dc6b4a1b0b69c6|CREATE INDEX "IDX_2c840df5db52dc6b4a1b0b69c6" ON identity.group_members USING btree (group_id)
identity|group_members|PK_86446139b2c96bfd0f3b8638852|CREATE UNIQUE INDEX "PK_86446139b2c96bfd0f3b8638852" ON identity.group_members USING btree (id)
identity|group_members|UQ_f5939ee0ad233ad35e03f5c65c1|CREATE UNIQUE INDEX "UQ_f5939ee0ad233ad35e03f5c65c1" ON identity.group_members USING btree (group_id, user_id)
identity|group_roles|IDX_0f428ea82b51ea6c795689cdb8|CREATE INDEX "IDX_0f428ea82b51ea6c795689cdb8" ON identity.group_roles USING btree (group_id)
identity|group_roles|IDX_35d4b5f7da6e1a9a730c3621ec|CREATE INDEX "IDX_35d4b5f7da6e1a9a730c3621ec" ON identity.group_roles USING btree (role_id)
identity|group_roles|PK_c88b2351f40bf170bc7ab7e8fda|CREATE UNIQUE INDEX "PK_c88b2351f40bf170bc7ab7e8fda" ON identity.group_roles USING btree (id)
identity|group_roles|UQ_31cb33278c5d3f7aed58766840a|CREATE UNIQUE INDEX "UQ_31cb33278c5d3f7aed58766840a" ON identity.group_roles USING btree (group_id, role_id)
identity|groups|IDX_8989cafa0945a366f0c8716e60|CREATE UNIQUE INDEX "IDX_8989cafa0945a366f0c8716e60" ON identity.groups USING btree (code)
identity|groups|IDX_8b343e4f936b28da5922520105|CREATE INDEX "IDX_8b343e4f936b28da5922520105" ON identity.groups USING btree (type)
identity|groups|IDX_d768ea35a407c2ba9c0b038b61|CREATE INDEX "IDX_d768ea35a407c2ba9c0b038b61" ON identity.groups USING btree (parent_id)
identity|groups|IDX_ed580a627f0d82d392897b4bca|CREATE INDEX "IDX_ed580a627f0d82d392897b4bca" ON identity.groups USING btree (is_active)
identity|groups|PK_659d1483316afb28afd3a90646e|CREATE UNIQUE INDEX "PK_659d1483316afb28afd3a90646e" ON identity.groups USING btree (id)
identity|groups|UQ_8989cafa0945a366f0c8716e609|CREATE UNIQUE INDEX "UQ_8989cafa0945a366f0c8716e609" ON identity.groups USING btree (code)
identity|impersonation_sessions|idx_impersonation_sessions_active|CREATE INDEX idx_impersonation_sessions_active ON identity.impersonation_sessions USING btree (is_active)
identity|impersonation_sessions|idx_impersonation_sessions_impersonator|CREATE INDEX idx_impersonation_sessions_impersonator ON identity.impersonation_sessions USING btree (impersonator_id)
identity|impersonation_sessions|idx_impersonation_sessions_target|CREATE INDEX idx_impersonation_sessions_target ON identity.impersonation_sessions USING btree (target_user_id)
identity|impersonation_sessions|impersonation_sessions_pkey|CREATE UNIQUE INDEX impersonation_sessions_pkey ON identity.impersonation_sessions USING btree (id)
identity|ldap_configs|PK_617b64e3f20ff5598a11ea7661e|CREATE UNIQUE INDEX "PK_617b64e3f20ff5598a11ea7661e" ON identity.ldap_configs USING btree (id)
identity|magic_link_tokens|idx_magic_link_tokens_email|CREATE INDEX idx_magic_link_tokens_email ON identity.magic_link_tokens USING btree (email)
identity|magic_link_tokens|idx_magic_link_tokens_expires_at|CREATE INDEX idx_magic_link_tokens_expires_at ON identity.magic_link_tokens USING btree (expires_at)
identity|magic_link_tokens|magic_link_tokens_pkey|CREATE UNIQUE INDEX magic_link_tokens_pkey ON identity.magic_link_tokens USING btree (id)
identity|magic_link_tokens|magic_link_tokens_token_key|CREATE UNIQUE INDEX magic_link_tokens_token_key ON identity.magic_link_tokens USING btree (token)
identity|mfa_methods|IDX_1d590a89ba342ab3515e64f6d2|CREATE INDEX "IDX_1d590a89ba342ab3515e64f6d2" ON identity.mfa_methods USING btree (user_id)
identity|mfa_methods|PK_60e4d183e6dbd427aa5549da581|CREATE UNIQUE INDEX "PK_60e4d183e6dbd427aa5549da581" ON identity.mfa_methods USING btree (id)
identity|nav_profile_items|IDX_e61477461f4ab1ba6729234fe4|CREATE INDEX "IDX_e61477461f4ab1ba6729234fe4" ON identity.nav_profile_items USING btree (parent_id)
identity|nav_profile_items|IDX_f02d51b25f5821bc1ee6780cc1|CREATE INDEX "IDX_f02d51b25f5821bc1ee6780cc1" ON identity.nav_profile_items USING btree (profile_id)
identity|nav_profile_items|PK_cb0391e27b4c5bfa13728f5ebf4|CREATE UNIQUE INDEX "PK_cb0391e27b4c5bfa13728f5ebf4" ON identity.nav_profile_items USING btree (id)
identity|nav_profiles|IDX_296ff17c5fdac130091f783281|CREATE INDEX "IDX_296ff17c5fdac130091f783281" ON identity.nav_profiles USING btree (is_default)
identity|nav_profiles|IDX_4db63a99d84dfd65fe3dca1bb2|CREATE INDEX "IDX_4db63a99d84dfd65fe3dca1bb2" ON identity.nav_profiles USING btree (scope)
identity|nav_profiles|IDX_92556f552f70c0531bdf4fc9d8|CREATE UNIQUE INDEX "IDX_92556f552f70c0531bdf4fc9d8" ON identity.nav_profiles USING btree (code)
identity|nav_profiles|PK_eab82f3592b4f3bdfa425eb651a|CREATE UNIQUE INDEX "PK_eab82f3592b4f3bdfa425eb651a" ON identity.nav_profiles USING btree (id)
identity|nav_profiles|UQ_92556f552f70c0531bdf4fc9d85|CREATE UNIQUE INDEX "UQ_92556f552f70c0531bdf4fc9d85" ON identity.nav_profiles USING btree (code)
identity|password_history|IDX_4933dc7a01356ac0733a5ad52d|CREATE INDEX "IDX_4933dc7a01356ac0733a5ad52d" ON identity.password_history USING btree (user_id)
identity|password_history|PK_da65ed4600e5e6bc9315754a8b2|CREATE UNIQUE INDEX "PK_da65ed4600e5e6bc9315754a8b2" ON identity.password_history USING btree (id)
identity|password_policies|PK_5468b65a86afc8563ac81cb9153|CREATE UNIQUE INDEX "PK_5468b65a86afc8563ac81cb9153" ON identity.password_policies USING btree (id)
identity|password_reset_tokens|IDX_52ac39dd8a28730c63aeb428c9|CREATE INDEX "IDX_52ac39dd8a28730c63aeb428c9" ON identity.password_reset_tokens USING btree (user_id)
identity|password_reset_tokens|IDX_7c038e5a589b06cbe4320cc88b|CREATE INDEX "IDX_7c038e5a589b06cbe4320cc88b" ON identity.password_reset_tokens USING btree (expires_at)
identity|password_reset_tokens|IDX_ab673f0e63eac966762155508e|CREATE UNIQUE INDEX "IDX_ab673f0e63eac966762155508e" ON identity.password_reset_tokens USING btree (token)
identity|password_reset_tokens|PK_d16bebd73e844c48bca50ff8d3d|CREATE UNIQUE INDEX "PK_d16bebd73e844c48bca50ff8d3d" ON identity.password_reset_tokens USING btree (id)
identity|password_reset_tokens|UQ_ab673f0e63eac966762155508ee|CREATE UNIQUE INDEX "UQ_ab673f0e63eac966762155508ee" ON identity.password_reset_tokens USING btree (token)
identity|platform_permissions|platform_permissions_pkey|CREATE UNIQUE INDEX platform_permissions_pkey ON identity.platform_permissions USING btree (code)
identity|refresh_tokens|idx_refresh_tokens_expires_at|CREATE INDEX idx_refresh_tokens_expires_at ON identity.refresh_tokens USING btree (expires_at) WHERE (revoked_at IS NULL)
identity|refresh_tokens|idx_refresh_tokens_family_id|CREATE INDEX idx_refresh_tokens_family_id ON identity.refresh_tokens USING btree (family_id)
identity|refresh_tokens|idx_refresh_tokens_family_not_revoked|CREATE INDEX idx_refresh_tokens_family_not_revoked ON identity.refresh_tokens USING btree (family_id) WHERE (revoked_at IS NULL)
identity|refresh_tokens|idx_refresh_tokens_user_session|CREATE INDEX idx_refresh_tokens_user_session ON identity.refresh_tokens USING btree (user_id, session_id)
identity|refresh_tokens|refresh_tokens_pkey|CREATE UNIQUE INDEX refresh_tokens_pkey ON identity.refresh_tokens USING btree (token_hash)
identity|role_permissions|IDX_178199805b901ccd220ab7740e|CREATE INDEX "IDX_178199805b901ccd220ab7740e" ON identity.role_permissions USING btree (role_id)
identity|role_permissions|role_permissions_pkey|CREATE UNIQUE INDEX role_permissions_pkey ON identity.role_permissions USING btree (role_id, permission_code)
identity|roles|IDX_2a3edd7bc16920c3287331ea42|CREATE INDEX "IDX_2a3edd7bc16920c3287331ea42" ON identity.roles USING btree (is_system)
identity|roles|IDX_3e97eeaf865aeda0d20c0c5c50|CREATE INDEX "IDX_3e97eeaf865aeda0d20c0c5c50" ON identity.roles USING btree (parent_id)
identity|roles|IDX_e9f58bffa9bdcc402c0438a60c|CREATE INDEX "IDX_e9f58bffa9bdcc402c0438a60c" ON identity.roles USING btree (is_active)
identity|roles|IDX_f6d54f95c31b73fb1bdd8e91d0|CREATE UNIQUE INDEX "IDX_f6d54f95c31b73fb1bdd8e91d0" ON identity.roles USING btree (code)
identity|roles|PK_c1433d71a4838793a49dcad46ab|CREATE UNIQUE INDEX "PK_c1433d71a4838793a49dcad46ab" ON identity.roles USING btree (id)
identity|roles|UQ_f6d54f95c31b73fb1bdd8e91d0c|CREATE UNIQUE INDEX "UQ_f6d54f95c31b73fb1bdd8e91d0c" ON identity.roles USING btree (code)
identity|saml_auth_states|idx_saml_auth_states_expires_at|CREATE INDEX idx_saml_auth_states_expires_at ON identity.saml_auth_states USING btree (expires_at)
identity|saml_auth_states|idx_saml_auth_states_relay_state|CREATE UNIQUE INDEX idx_saml_auth_states_relay_state ON identity.saml_auth_states USING btree (relay_state)
identity|saml_auth_states|saml_auth_states_pkey|CREATE UNIQUE INDEX saml_auth_states_pkey ON identity.saml_auth_states USING btree (id)
identity|saml_auth_states|saml_auth_states_relay_state_key|CREATE UNIQUE INDEX saml_auth_states_relay_state_key ON identity.saml_auth_states USING btree (relay_state)
identity|security_alerts|idx_security_alerts_created_at|CREATE INDEX idx_security_alerts_created_at ON identity.security_alerts USING btree (created_at)
identity|security_alerts|idx_security_alerts_severity|CREATE INDEX idx_security_alerts_severity ON identity.security_alerts USING btree (severity)
identity|security_alerts|idx_security_alerts_status|CREATE INDEX idx_security_alerts_status ON identity.security_alerts USING btree (status)
identity|security_alerts|idx_security_alerts_user_id|CREATE INDEX idx_security_alerts_user_id ON identity.security_alerts USING btree (user_id)
identity|security_alerts|security_alerts_pkey|CREATE UNIQUE INDEX security_alerts_pkey ON identity.security_alerts USING btree (id)
identity|service_accounts|IDX_service_accounts_status|CREATE INDEX "IDX_service_accounts_status" ON identity.service_accounts USING btree (status)
identity|service_accounts|PK_service_accounts|CREATE UNIQUE INDEX "PK_service_accounts" ON identity.service_accounts USING btree (id)
identity|service_accounts|UQ_service_accounts_name|CREATE UNIQUE INDEX "UQ_service_accounts_name" ON identity.service_accounts USING btree (name)
identity|service_token_signing_keys|IDX_service_token_signing_keys_status|CREATE INDEX "IDX_service_token_signing_keys_status" ON identity.service_token_signing_keys USING btree (status)
identity|service_token_signing_keys|PK_service_token_signing_keys|CREATE UNIQUE INDEX "PK_service_token_signing_keys" ON identity.service_token_signing_keys USING btree (id)
identity|service_token_signing_keys|UQ_service_token_signing_keys_key_id|CREATE UNIQUE INDEX "UQ_service_token_signing_keys_key_id" ON identity.service_token_signing_keys USING btree (key_id)
identity|service_token_signing_keys|UQ_service_token_signing_keys_one_active|CREATE UNIQUE INDEX "UQ_service_token_signing_keys_one_active" ON identity.service_token_signing_keys USING btree (status) WHERE ((status)::text = 'active'::text)
identity|sso_providers|PK_348feeee9ed68f9161a2f5ffeb0|CREATE UNIQUE INDEX "PK_348feeee9ed68f9161a2f5ffeb0" ON identity.sso_providers USING btree (id)
identity|sso_providers|UQ_85208f3eacf568550f725f5097a|CREATE UNIQUE INDEX "UQ_85208f3eacf568550f725f5097a" ON identity.sso_providers USING btree (slug)
identity|trusted_devices|idx_trusted_devices_fingerprint|CREATE INDEX idx_trusted_devices_fingerprint ON identity.trusted_devices USING btree (device_fingerprint)
identity|trusted_devices|idx_trusted_devices_status|CREATE INDEX idx_trusted_devices_status ON identity.trusted_devices USING btree (status)
identity|trusted_devices|idx_trusted_devices_user_id|CREATE INDEX idx_trusted_devices_user_id ON identity.trusted_devices USING btree (user_id)
identity|trusted_devices|trusted_devices_pkey|CREATE UNIQUE INDEX trusted_devices_pkey ON identity.trusted_devices USING btree (id)
identity|user_invitations|IDX_1c885f83eb2a34fedd887e43e8|CREATE UNIQUE INDEX "IDX_1c885f83eb2a34fedd887e43e8" ON identity.user_invitations USING btree (token)
identity|user_invitations|IDX_245772caab09e629f6e80aaaba|CREATE INDEX "IDX_245772caab09e629f6e80aaaba" ON identity.user_invitations USING btree (status)
identity|user_invitations|IDX_9f3ae879cf24686834c974effd|CREATE INDEX "IDX_9f3ae879cf24686834c974effd" ON identity.user_invitations USING btree (expires_at)
identity|user_invitations|IDX_d818b0ebcc97ef5dfb67fb7867|CREATE INDEX "IDX_d818b0ebcc97ef5dfb67fb7867" ON identity.user_invitations USING btree (email)
identity|user_invitations|PK_c8005acb91c3ce9a7ae581eca8f|CREATE UNIQUE INDEX "PK_c8005acb91c3ce9a7ae581eca8f" ON identity.user_invitations USING btree (id)
identity|user_invitations|UQ_1c885f83eb2a34fedd887e43e82|CREATE UNIQUE INDEX "UQ_1c885f83eb2a34fedd887e43e82" ON identity.user_invitations USING btree (token)
identity|user_roles|IDX_87b8888186ca9769c960e92687|CREATE INDEX "IDX_87b8888186ca9769c960e92687" ON identity.user_roles USING btree (user_id)
identity|user_roles|IDX_b23c65e50a758245a33ee35fda|CREATE INDEX "IDX_b23c65e50a758245a33ee35fda" ON identity.user_roles USING btree (role_id)
identity|user_roles|IDX_da27d912745ad6fae4eaaf07d3|CREATE INDEX "IDX_da27d912745ad6fae4eaaf07d3" ON identity.user_roles USING btree (valid_from, valid_until)
identity|user_roles|PK_8acd5cf26ebd158416f477de799|CREATE UNIQUE INDEX "PK_8acd5cf26ebd158416f477de799" ON identity.user_roles USING btree (id)
identity|user_roles|UQ_23ed6f04fe43066df08379fd034|CREATE UNIQUE INDEX "UQ_23ed6f04fe43066df08379fd034" ON identity.user_roles USING btree (user_id, role_id)
identity|webauthn_challenges|idx_webauthn_challenges_expires_at|CREATE INDEX idx_webauthn_challenges_expires_at ON identity.webauthn_challenges USING btree (expires_at)
identity|webauthn_challenges|idx_webauthn_challenges_user_id|CREATE INDEX idx_webauthn_challenges_user_id ON identity.webauthn_challenges USING btree (user_id)
identity|webauthn_challenges|webauthn_challenges_challenge_key|CREATE UNIQUE INDEX webauthn_challenges_challenge_key ON identity.webauthn_challenges USING btree (challenge)
identity|webauthn_challenges|webauthn_challenges_pkey|CREATE UNIQUE INDEX webauthn_challenges_pkey ON identity.webauthn_challenges USING btree (id)
identity|webauthn_credentials|idx_webauthn_credentials_user_id|CREATE INDEX idx_webauthn_credentials_user_id ON identity.webauthn_credentials USING btree (user_id)
identity|webauthn_credentials|webauthn_credentials_credential_id_key|CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON identity.webauthn_credentials USING btree (credential_id)
identity|webauthn_credentials|webauthn_credentials_pkey|CREATE UNIQUE INDEX webauthn_credentials_pkey ON identity.webauthn_credentials USING btree (id)
insights|alert_definitions|alert_definitions_code_key|CREATE UNIQUE INDEX alert_definitions_code_key ON insights.alert_definitions USING btree (code)
insights|alert_definitions|alert_definitions_pkey|CREATE UNIQUE INDEX alert_definitions_pkey ON insights.alert_definitions USING btree (id)
insights|dashboard_definitions|IDX_dashboard_definitions_scope|CREATE INDEX "IDX_dashboard_definitions_scope" ON insights.dashboard_definitions USING btree (scope)
insights|dashboard_definitions|dashboard_definitions_code_key|CREATE UNIQUE INDEX dashboard_definitions_code_key ON insights.dashboard_definitions USING btree (code)
insights|dashboard_definitions|dashboard_definitions_pkey|CREATE UNIQUE INDEX dashboard_definitions_pkey ON insights.dashboard_definitions USING btree (id)
insights|metric_definitions|IDX_metric_definitions_owner|CREATE INDEX "IDX_metric_definitions_owner" ON insights.metric_definitions USING btree (definition_owner_id) WHERE (definition_owner_id IS NOT NULL)
insights|metric_definitions|metric_definitions_code_key|CREATE UNIQUE INDEX metric_definitions_code_key ON insights.metric_definitions USING btree (code)
insights|metric_definitions|metric_definitions_pkey|CREATE UNIQUE INDEX metric_definitions_pkey ON insights.metric_definitions USING btree (id)
insights|metric_points|idx_metric_points_code_start|CREATE INDEX idx_metric_points_code_start ON insights.metric_points USING btree (metric_code, period_start)
insights|metric_points|metric_points_pkey|CREATE UNIQUE INDEX metric_points_pkey ON insights.metric_points USING btree (id)
integrations|api_keys|IDX_138cc6196c7bfa61d31412aea7|CREATE INDEX "IDX_138cc6196c7bfa61d31412aea7" ON integrations.api_keys USING btree (is_active)
integrations|api_keys|IDX_57384430aa1959f4578046c9b8|CREATE UNIQUE INDEX "IDX_57384430aa1959f4578046c9b8" ON integrations.api_keys USING btree (key_hash)
integrations|api_keys|IDX_a3baee01d8408cd3c0f89a9a97|CREATE INDEX "IDX_a3baee01d8408cd3c0f89a9a97" ON integrations.api_keys USING btree (user_id)
integrations|api_keys|PK_5c8a79801b44bd27b79228e1dad|CREATE UNIQUE INDEX "PK_5c8a79801b44bd27b79228e1dad" ON integrations.api_keys USING btree (id)
integrations|api_keys|UQ_57384430aa1959f4578046c9b81|CREATE UNIQUE INDEX "UQ_57384430aa1959f4578046c9b81" ON integrations.api_keys USING btree (key_hash)
integrations|api_keys|idx_api_keys_is_active|CREATE INDEX idx_api_keys_is_active ON integrations.api_keys USING btree (is_active)
integrations|api_keys|idx_api_keys_key_prefix|CREATE INDEX idx_api_keys_key_prefix ON integrations.api_keys USING btree (key_prefix)
integrations|api_request_logs|api_request_logs_pkey|CREATE UNIQUE INDEX api_request_logs_pkey ON integrations.api_request_logs USING btree (id)
integrations|api_request_logs|idx_api_request_logs_api_key|CREATE INDEX idx_api_request_logs_api_key ON integrations.api_request_logs USING btree (api_key_id)
integrations|api_request_logs|idx_api_request_logs_created|CREATE INDEX idx_api_request_logs_created ON integrations.api_request_logs USING btree (created_at DESC)
integrations|api_request_logs|idx_api_request_logs_path|CREATE INDEX idx_api_request_logs_path ON integrations.api_request_logs USING btree (path)
integrations|connector_connections|connector_connections_pkey|CREATE UNIQUE INDEX connector_connections_pkey ON integrations.connector_connections USING btree (id)
integrations|connector_connections|idx_connector_connections_connector|CREATE INDEX idx_connector_connections_connector ON integrations.connector_connections USING btree (connector_id)
integrations|connector_connections|idx_connector_connections_status|CREATE INDEX idx_connector_connections_status ON integrations.connector_connections USING btree (status)
integrations|export_jobs|export_jobs_pkey|CREATE UNIQUE INDEX export_jobs_pkey ON integrations.export_jobs USING btree (id)
integrations|export_jobs|idx_export_jobs_collection|CREATE INDEX idx_export_jobs_collection ON integrations.export_jobs USING btree (source_collection_id)
integrations|export_jobs|idx_export_jobs_status|CREATE INDEX idx_export_jobs_status ON integrations.export_jobs USING btree (status)
integrations|external_connectors|external_connectors_code_key|CREATE UNIQUE INDEX external_connectors_code_key ON integrations.external_connectors USING btree (code)
integrations|external_connectors|external_connectors_pkey|CREATE UNIQUE INDEX external_connectors_pkey ON integrations.external_connectors USING btree (id)
integrations|external_connectors|idx_external_connectors_code|CREATE INDEX idx_external_connectors_code ON integrations.external_connectors USING btree (code)
integrations|external_connectors|idx_external_connectors_type|CREATE INDEX idx_external_connectors_type ON integrations.external_connectors USING btree (type)
integrations|import_jobs|idx_import_jobs_collection|CREATE INDEX idx_import_jobs_collection ON integrations.import_jobs USING btree (target_collection_id)
integrations|import_jobs|idx_import_jobs_status|CREATE INDEX idx_import_jobs_status ON integrations.import_jobs USING btree (status)
integrations|import_jobs|import_jobs_pkey|CREATE UNIQUE INDEX import_jobs_pkey ON integrations.import_jobs USING btree (id)
integrations|oauth_access_tokens|idx_oauth_access_tokens_expires|CREATE INDEX idx_oauth_access_tokens_expires ON integrations.oauth_access_tokens USING btree (expires_at)
integrations|oauth_access_tokens|idx_oauth_access_tokens_token|CREATE INDEX idx_oauth_access_tokens_token ON integrations.oauth_access_tokens USING btree (access_token)
integrations|oauth_access_tokens|oauth_access_tokens_access_token_key|CREATE UNIQUE INDEX oauth_access_tokens_access_token_key ON integrations.oauth_access_tokens USING btree (access_token)
integrations|oauth_access_tokens|oauth_access_tokens_pkey|CREATE UNIQUE INDEX oauth_access_tokens_pkey ON integrations.oauth_access_tokens USING btree (id)
integrations|oauth_authorization_codes|idx_oauth_auth_codes_code|CREATE INDEX idx_oauth_auth_codes_code ON integrations.oauth_authorization_codes USING btree (code)
integrations|oauth_authorization_codes|idx_oauth_auth_codes_expires|CREATE INDEX idx_oauth_auth_codes_expires ON integrations.oauth_authorization_codes USING btree (expires_at)
integrations|oauth_authorization_codes|oauth_authorization_codes_code_key|CREATE UNIQUE INDEX oauth_authorization_codes_code_key ON integrations.oauth_authorization_codes USING btree (code)
integrations|oauth_authorization_codes|oauth_authorization_codes_pkey|CREATE UNIQUE INDEX oauth_authorization_codes_pkey ON integrations.oauth_authorization_codes USING btree (id)
integrations|oauth_clients|idx_oauth_clients_client_id|CREATE INDEX idx_oauth_clients_client_id ON integrations.oauth_clients USING btree (client_id)
integrations|oauth_clients|oauth_clients_client_id_key|CREATE UNIQUE INDEX oauth_clients_client_id_key ON integrations.oauth_clients USING btree (client_id)
integrations|oauth_clients|oauth_clients_pkey|CREATE UNIQUE INDEX oauth_clients_pkey ON integrations.oauth_clients USING btree (id)
integrations|oauth_refresh_tokens|idx_oauth_refresh_tokens_token|CREATE INDEX idx_oauth_refresh_tokens_token ON integrations.oauth_refresh_tokens USING btree (refresh_token)
integrations|oauth_refresh_tokens|oauth_refresh_tokens_pkey|CREATE UNIQUE INDEX oauth_refresh_tokens_pkey ON integrations.oauth_refresh_tokens USING btree (id)
integrations|oauth_refresh_tokens|oauth_refresh_tokens_refresh_token_key|CREATE UNIQUE INDEX oauth_refresh_tokens_refresh_token_key ON integrations.oauth_refresh_tokens USING btree (refresh_token)
integrations|sync_configurations|idx_sync_configurations_active|CREATE INDEX idx_sync_configurations_active ON integrations.sync_configurations USING btree (is_active)
integrations|sync_configurations|idx_sync_configurations_connection|CREATE INDEX idx_sync_configurations_connection ON integrations.sync_configurations USING btree (connection_id)
integrations|sync_configurations|idx_sync_configurations_next_run|CREATE INDEX idx_sync_configurations_next_run ON integrations.sync_configurations USING btree (next_run_at)
integrations|sync_configurations|sync_configurations_pkey|CREATE UNIQUE INDEX sync_configurations_pkey ON integrations.sync_configurations USING btree (id)
integrations|sync_runs|idx_sync_runs_configuration|CREATE INDEX idx_sync_runs_configuration ON integrations.sync_runs USING btree (configuration_id)
integrations|sync_runs|idx_sync_runs_started|CREATE INDEX idx_sync_runs_started ON integrations.sync_runs USING btree (started_at DESC)
integrations|sync_runs|idx_sync_runs_status|CREATE INDEX idx_sync_runs_status ON integrations.sync_runs USING btree (status)
integrations|sync_runs|sync_runs_pkey|CREATE UNIQUE INDEX sync_runs_pkey ON integrations.sync_runs USING btree (id)
integrations|webhook_deliveries|idx_webhook_deliveries_scheduled|CREATE INDEX idx_webhook_deliveries_scheduled ON integrations.webhook_deliveries USING btree (scheduled_at)
integrations|webhook_deliveries|idx_webhook_deliveries_status|CREATE INDEX idx_webhook_deliveries_status ON integrations.webhook_deliveries USING btree (status)
integrations|webhook_deliveries|idx_webhook_deliveries_subscription|CREATE INDEX idx_webhook_deliveries_subscription ON integrations.webhook_deliveries USING btree (subscription_id)
integrations|webhook_deliveries|webhook_deliveries_pkey|CREATE UNIQUE INDEX webhook_deliveries_pkey ON integrations.webhook_deliveries USING btree (id)
integrations|webhook_subscriptions|idx_webhook_subscriptions_active|CREATE INDEX idx_webhook_subscriptions_active ON integrations.webhook_subscriptions USING btree (is_active)
integrations|webhook_subscriptions|idx_webhook_subscriptions_events|CREATE INDEX idx_webhook_subscriptions_events ON integrations.webhook_subscriptions USING gin (events)
integrations|webhook_subscriptions|webhook_subscriptions_pkey|CREATE UNIQUE INDEX webhook_subscriptions_pkey ON integrations.webhook_subscriptions USING btree (id)
metadata|application_revisions|application_revisions_pkey|CREATE UNIQUE INDEX application_revisions_pkey ON metadata.application_revisions USING btree (id)
metadata|application_revisions|idx_application_revisions_app_id|CREATE INDEX idx_application_revisions_app_id ON metadata.application_revisions USING btree (application_id)
metadata|application_revisions|idx_application_revisions_app_rev|CREATE UNIQUE INDEX idx_application_revisions_app_rev ON metadata.application_revisions USING btree (application_id, revision)
metadata|application_revisions|idx_application_revisions_status|CREATE INDEX idx_application_revisions_status ON metadata.application_revisions USING btree (status)
metadata|applications|applications_pkey|CREATE UNIQUE INDEX applications_pkey ON metadata.applications USING btree (id)
metadata|applications|idx_applications_code|CREATE UNIQUE INDEX idx_applications_code ON metadata.applications USING btree (code)
metadata|applications|idx_applications_status|CREATE INDEX idx_applications_status ON metadata.applications USING btree (status)
metadata|change_packages|change_packages_code_key|CREATE UNIQUE INDEX change_packages_code_key ON metadata.change_packages USING btree (code)
metadata|change_packages|change_packages_pkey|CREATE UNIQUE INDEX change_packages_pkey ON metadata.change_packages USING btree (id)
metadata|change_packages|idx_change_packages_application|CREATE INDEX idx_change_packages_application ON metadata.change_packages USING btree (application_id)
metadata|change_packages|idx_change_packages_status|CREATE INDEX idx_change_packages_status ON metadata.change_packages USING btree (status)
metadata|choice_items|IDX_98334e02c5109bd3a8ec155c2b|CREATE INDEX "IDX_98334e02c5109bd3a8ec155c2b" ON metadata.choice_items USING btree (choice_list_id)
metadata|choice_items|PK_bffbbb5b6dce82a7246514834aa|CREATE UNIQUE INDEX "PK_bffbbb5b6dce82a7246514834aa" ON metadata.choice_items USING btree (id)
metadata|choice_items|UQ_9d19126c923b35ffd71c6b08bbd|CREATE UNIQUE INDEX "UQ_9d19126c923b35ffd71c6b08bbd" ON metadata.choice_items USING btree (choice_list_id, value)
metadata|choice_lists|IDX_931628f1c40bc1d2b193ee0756|CREATE UNIQUE INDEX "IDX_931628f1c40bc1d2b193ee0756" ON metadata.choice_lists USING btree (code)
metadata|choice_lists|PK_32e58b5d1206ca7bd235da92c66|CREATE UNIQUE INDEX "PK_32e58b5d1206ca7bd235da92c66" ON metadata.choice_lists USING btree (id)
metadata|choice_lists|UQ_931628f1c40bc1d2b193ee07560|CREATE UNIQUE INDEX "UQ_931628f1c40bc1d2b193ee07560" ON metadata.choice_lists USING btree (code)
metadata|collection_constraints|collection_constraints_pkey|CREATE UNIQUE INDEX collection_constraints_pkey ON metadata.collection_constraints USING btree (id)
metadata|collection_constraints|idx_collection_constraints_active|CREATE INDEX idx_collection_constraints_active ON metadata.collection_constraints USING btree (is_active)
metadata|collection_constraints|idx_collection_constraints_collection|CREATE INDEX idx_collection_constraints_collection ON metadata.collection_constraints USING btree (collection_id)
metadata|collection_constraints|idx_collection_constraints_type|CREATE INDEX idx_collection_constraints_type ON metadata.collection_constraints USING btree (constraint_type)
metadata|collection_constraints|uq_collection_constraints|CREATE UNIQUE INDEX uq_collection_constraints ON metadata.collection_constraints USING btree (collection_id, code)
metadata|collection_definition_revisions|collection_definition_revisions_pkey|CREATE UNIQUE INDEX collection_definition_revisions_pkey ON metadata.collection_definition_revisions USING btree (id)
metadata|collection_definition_revisions|idx_collection_definition_revisions_col_rev|CREATE UNIQUE INDEX idx_collection_definition_revisions_col_rev ON metadata.collection_definition_revisions USING btree (collection_id, revision)
metadata|collection_definition_revisions|idx_collection_definition_revisions_collection_id|CREATE INDEX idx_collection_definition_revisions_collection_id ON metadata.collection_definition_revisions USING btree (collection_id)
metadata|collection_definition_revisions|idx_collection_definition_revisions_status|CREATE INDEX idx_collection_definition_revisions_status ON metadata.collection_definition_revisions USING btree (status)
metadata|collection_definitions|IDX_7c22e7ac994b29b2d8320bf3bc|CREATE UNIQUE INDEX "IDX_7c22e7ac994b29b2d8320bf3bc" ON metadata.collection_definitions USING btree (table_name)
metadata|collection_definitions|IDX_d24aec9ddb25523068aefad8c5|CREATE INDEX "IDX_d24aec9ddb25523068aefad8c5" ON metadata.collection_definitions USING btree (application_id)
metadata|collection_definitions|IDX_d74cad0dd7ab2f1144e34e1a81|CREATE UNIQUE INDEX "IDX_d74cad0dd7ab2f1144e34e1a81" ON metadata.collection_definitions USING btree (code)
metadata|collection_definitions|IDX_d816b7a55d18d87ca3b6065a49|CREATE INDEX "IDX_d816b7a55d18d87ca3b6065a49" ON metadata.collection_definitions USING btree (category)
metadata|collection_definitions|IDX_e317662a80e3314c64265c35e9|CREATE INDEX "IDX_e317662a80e3314c64265c35e9" ON metadata.collection_definitions USING btree (is_active)
metadata|collection_definitions|PK_92ac9ed8fcf26e5f49e30a29c2a|CREATE UNIQUE INDEX "PK_92ac9ed8fcf26e5f49e30a29c2a" ON metadata.collection_definitions USING btree (id)
metadata|collection_definitions|UQ_7c22e7ac994b29b2d8320bf3bcf|CREATE UNIQUE INDEX "UQ_7c22e7ac994b29b2d8320bf3bcf" ON metadata.collection_definitions USING btree (table_name)
metadata|collection_definitions|UQ_d74cad0dd7ab2f1144e34e1a816|CREATE UNIQUE INDEX "UQ_d74cad0dd7ab2f1144e34e1a816" ON metadata.collection_definitions USING btree (code)
metadata|collection_definitions|idx_collection_definitions_application_id|CREATE INDEX idx_collection_definitions_application_id ON metadata.collection_definitions USING btree (application_id)
metadata|collection_definitions|idx_collection_definitions_metadata_gin|CREATE INDEX idx_collection_definitions_metadata_gin ON metadata.collection_definitions USING gin (metadata jsonb_path_ops)
metadata|collection_definitions|idx_collection_definitions_source|CREATE INDEX idx_collection_definitions_source ON metadata.collection_definitions USING btree (source)
metadata|collection_definitions|idx_collection_definitions_status|CREATE INDEX idx_collection_definitions_status ON metadata.collection_definitions USING btree (status)
metadata|collection_definitions|idx_collection_owner|CREATE INDEX idx_collection_owner ON metadata.collection_definitions USING btree (owner)
metadata|collection_definitions|idx_collection_sync_status|CREATE INDEX idx_collection_sync_status ON metadata.collection_definitions USING btree (sync_status)
metadata|collection_indexes|collection_indexes_pkey|CREATE UNIQUE INDEX collection_indexes_pkey ON metadata.collection_indexes USING btree (id)
metadata|collection_indexes|idx_collection_indexes_active|CREATE INDEX idx_collection_indexes_active ON metadata.collection_indexes USING btree (is_active)
metadata|collection_indexes|idx_collection_indexes_collection|CREATE INDEX idx_collection_indexes_collection ON metadata.collection_indexes USING btree (collection_id)
metadata|collection_indexes|idx_collection_indexes_type|CREATE INDEX idx_collection_indexes_type ON metadata.collection_indexes USING btree (index_type)
metadata|collection_indexes|uq_collection_indexes|CREATE UNIQUE INDEX uq_collection_indexes ON metadata.collection_indexes USING btree (collection_id, code)
metadata|dependent_review_queue|dependent_review_queue_pkey|CREATE UNIQUE INDEX dependent_review_queue_pkey ON metadata.dependent_review_queue USING btree (id)
metadata|dependent_review_queue|idx_dep_review_collection_status|CREATE INDEX idx_dep_review_collection_status ON metadata.dependent_review_queue USING btree (collection_id, status)
metadata|dependent_review_queue|idx_dep_review_entity|CREATE INDEX idx_dep_review_entity ON metadata.dependent_review_queue USING btree (entity_type, entity_id)
metadata|dependent_review_queue|idx_dep_review_status_created_at|CREATE INDEX idx_dep_review_status_created_at ON metadata.dependent_review_queue USING btree (status, created_at DESC)
metadata|display_rule_revisions|display_rule_revisions_pkey|CREATE UNIQUE INDEX display_rule_revisions_pkey ON metadata.display_rule_revisions USING btree (id)
metadata|display_rule_revisions|idx_display_rule_revisions_rule|CREATE INDEX idx_display_rule_revisions_rule ON metadata.display_rule_revisions USING btree (display_rule_id)
metadata|display_rule_revisions|idx_display_rule_revisions_status|CREATE INDEX idx_display_rule_revisions_status ON metadata.display_rule_revisions USING btree (status)
metadata|display_rule_revisions|uq_display_rule_revisions_rule_revision|CREATE UNIQUE INDEX uq_display_rule_revisions_rule_revision ON metadata.display_rule_revisions USING btree (display_rule_id, revision)
metadata|display_rules|display_rules_pkey|CREATE UNIQUE INDEX display_rules_pkey ON metadata.display_rules USING btree (id)
metadata|display_rules|idx_display_rules_application|CREATE INDEX idx_display_rules_application ON metadata.display_rules USING btree (application_id)
metadata|display_rules|idx_display_rules_collection_active|CREATE INDEX idx_display_rules_collection_active ON metadata.display_rules USING btree (collection_id, is_active)
metadata|display_rules|idx_display_rules_source|CREATE INDEX idx_display_rules_source ON metadata.display_rules USING btree (source)
metadata|display_rules|idx_display_rules_status|CREATE INDEX idx_display_rules_status ON metadata.display_rules USING btree (status)
metadata|form_definitions|IDX_111982cc806d8c26c9c445ece7|CREATE INDEX "IDX_111982cc806d8c26c9c445ece7" ON metadata.form_definitions USING btree (collection_id)
metadata|form_definitions|PK_e7b46c89a49ab24f30618b410d9|CREATE UNIQUE INDEX "PK_e7b46c89a49ab24f30618b410d9" ON metadata.form_definitions USING btree (id)
metadata|form_definitions|idx_form_definitions_application_id|CREATE INDEX idx_form_definitions_application_id ON metadata.form_definitions USING btree (application_id)
metadata|form_definitions|idx_form_definitions_source|CREATE INDEX idx_form_definitions_source ON metadata.form_definitions USING btree (source)
metadata|form_definitions|idx_form_definitions_status|CREATE INDEX idx_form_definitions_status ON metadata.form_definitions USING btree (status)
metadata|form_versions|PK_46dbd35ef6adf11a8684deae1b1|CREATE UNIQUE INDEX "PK_46dbd35ef6adf11a8684deae1b1" ON metadata.form_versions USING btree (id)
metadata|form_versions|idx_form_versions_status|CREATE INDEX idx_form_versions_status ON metadata.form_versions USING btree (status)
metadata|instance_branding|PK_ffa3a5f407b63635e6c7ec5e421|CREATE UNIQUE INDEX "PK_ffa3a5f407b63635e6c7ec5e421" ON metadata.instance_branding USING btree (id)
metadata|locales|idx_locales_code|CREATE INDEX idx_locales_code ON metadata.locales USING btree (code)
metadata|locales|locales_pkey|CREATE UNIQUE INDEX locales_pkey ON metadata.locales USING btree (id)
metadata|locales|uq_locales_code|CREATE UNIQUE INDEX uq_locales_code ON metadata.locales USING btree (code)
metadata|localization_bundles|idx_localization_bundles_locale_id|CREATE INDEX idx_localization_bundles_locale_id ON metadata.localization_bundles USING btree (locale_id)
metadata|localization_bundles|localization_bundles_pkey|CREATE UNIQUE INDEX localization_bundles_pkey ON metadata.localization_bundles USING btree (id)
metadata|localization_bundles|uq_localization_bundles_locale|CREATE UNIQUE INDEX uq_localization_bundles_locale ON metadata.localization_bundles USING btree (locale_code)
metadata|module_security|PK_4e41b3d2d49a520286fb067bffc|CREATE UNIQUE INDEX "PK_4e41b3d2d49a520286fb067bffc" ON metadata.module_security USING btree (id)
metadata|modules|IDX_a57f2b3bd9ebb022212e634f60|CREATE UNIQUE INDEX "IDX_a57f2b3bd9ebb022212e634f60" ON metadata.modules USING btree (key)
metadata|modules|PK_7dbefd488bd96c5bf31f0ce0c95|CREATE UNIQUE INDEX "PK_7dbefd488bd96c5bf31f0ce0c95" ON metadata.modules USING btree (id)
metadata|modules|UQ_a57f2b3bd9ebb022212e634f601|CREATE UNIQUE INDEX "UQ_a57f2b3bd9ebb022212e634f601" ON metadata.modules USING btree (key)
metadata|nav_nodes|IDX_nav_nodes_key|CREATE INDEX "IDX_nav_nodes_key" ON metadata.nav_nodes USING btree (key)
metadata|nav_nodes|IDX_nav_nodes_parent_id|CREATE INDEX "IDX_nav_nodes_parent_id" ON metadata.nav_nodes USING btree (parent_id)
metadata|nav_nodes|IDX_nav_nodes_profile_id|CREATE INDEX "IDX_nav_nodes_profile_id" ON metadata.nav_nodes USING btree (profile_id)
metadata|nav_nodes|PK_nav_nodes|CREATE UNIQUE INDEX "PK_nav_nodes" ON metadata.nav_nodes USING btree (id)
metadata|nav_patches|IDX_nav_patches_profile_id|CREATE INDEX "IDX_nav_patches_profile_id" ON metadata.nav_patches USING btree (profile_id)
metadata|nav_patches|PK_nav_patches|CREATE UNIQUE INDEX "PK_nav_patches" ON metadata.nav_patches USING btree (id)
metadata|navigation_module_revisions|IDX_navigation_module_revisions_definition|CREATE INDEX "IDX_navigation_module_revisions_definition" ON metadata.navigation_module_revisions USING btree (navigation_module_id)
metadata|navigation_module_revisions|IDX_navigation_module_revisions_status|CREATE INDEX "IDX_navigation_module_revisions_status" ON metadata.navigation_module_revisions USING btree (status)
metadata|navigation_module_revisions|PK_navigation_module_revisions|CREATE UNIQUE INDEX "PK_navigation_module_revisions" ON metadata.navigation_module_revisions USING btree (id)
metadata|navigation_module_revisions|UQ_navigation_module_revision|CREATE UNIQUE INDEX "UQ_navigation_module_revision" ON metadata.navigation_module_revisions USING btree (navigation_module_id, revision)
metadata|navigation_modules|PK_navigation_modules|CREATE UNIQUE INDEX "PK_navigation_modules" ON metadata.navigation_modules USING btree (id)
metadata|navigation_modules|UQ_navigation_modules_code|CREATE UNIQUE INDEX "UQ_navigation_modules_code" ON metadata.navigation_modules USING btree (code)
metadata|navigation_modules|idx_navigation_modules_application_id|CREATE INDEX idx_navigation_modules_application_id ON metadata.navigation_modules USING btree (application_id)
metadata|navigation_variants|IDX_navigation_variants_definition|CREATE INDEX "IDX_navigation_variants_definition" ON metadata.navigation_variants USING btree (navigation_module_id)
metadata|navigation_variants|IDX_navigation_variants_scope|CREATE INDEX "IDX_navigation_variants_scope" ON metadata.navigation_variants USING btree (scope)
metadata|navigation_variants|IDX_navigation_variants_scope_key|CREATE INDEX "IDX_navigation_variants_scope_key" ON metadata.navigation_variants USING btree (scope_key)
metadata|navigation_variants|PK_navigation_variants|CREATE UNIQUE INDEX "PK_navigation_variants" ON metadata.navigation_variants USING btree (id)
metadata|pack_install_locks|pack_install_locks_pkey|CREATE UNIQUE INDEX pack_install_locks_pkey ON metadata.pack_install_locks USING btree (lock_key)
metadata|pack_object_revisions|idx_pack_object_revisions_object|CREATE INDEX idx_pack_object_revisions_object ON metadata.pack_object_revisions USING btree (object_type, object_key)
metadata|pack_object_revisions|idx_pack_object_revisions_release|CREATE INDEX idx_pack_object_revisions_release ON metadata.pack_object_revisions USING btree (release_record_id)
metadata|pack_object_revisions|pack_object_revisions_pkey|CREATE UNIQUE INDEX pack_object_revisions_pkey ON metadata.pack_object_revisions USING btree (id)
metadata|pack_object_states|idx_pack_object_states_object_id|CREATE INDEX idx_pack_object_states_object_id ON metadata.pack_object_states USING btree (object_id)
metadata|pack_object_states|idx_pack_object_states_pack|CREATE INDEX idx_pack_object_states_pack ON metadata.pack_object_states USING btree (pack_code)
metadata|pack_object_states|pack_object_states_pkey|CREATE UNIQUE INDEX pack_object_states_pkey ON metadata.pack_object_states USING btree (id)
metadata|pack_object_states|uq_pack_object_state|CREATE UNIQUE INDEX uq_pack_object_state ON metadata.pack_object_states USING btree (object_type, object_key)
metadata|pack_release_records|idx_pack_release_records_pack|CREATE INDEX idx_pack_release_records_pack ON metadata.pack_release_records USING btree (pack_code, pack_release_id)
metadata|pack_release_records|idx_pack_release_records_started_at|CREATE INDEX idx_pack_release_records_started_at ON metadata.pack_release_records USING btree (started_at)
metadata|pack_release_records|idx_pack_release_records_status|CREATE INDEX idx_pack_release_records_status ON metadata.pack_release_records USING btree (status)
metadata|pack_release_records|pack_release_records_pkey|CREATE UNIQUE INDEX pack_release_records_pkey ON metadata.pack_release_records USING btree (id)
metadata|property_definition_revisions|idx_property_definition_revisions_prop_rev|CREATE UNIQUE INDEX idx_property_definition_revisions_prop_rev ON metadata.property_definition_revisions USING btree (property_id, revision)
metadata|property_definition_revisions|idx_property_definition_revisions_property_id|CREATE INDEX idx_property_definition_revisions_property_id ON metadata.property_definition_revisions USING btree (property_id)
metadata|property_definition_revisions|idx_property_definition_revisions_status|CREATE INDEX idx_property_definition_revisions_status ON metadata.property_definition_revisions USING btree (status)
metadata|property_definition_revisions|property_definition_revisions_pkey|CREATE UNIQUE INDEX property_definition_revisions_pkey ON metadata.property_definition_revisions USING btree (id)
metadata|property_definitions|IDX_10dab69d18bbe034d20839f2ad|CREATE INDEX "IDX_10dab69d18bbe034d20839f2ad" ON metadata.property_definitions USING btree (property_type_id)
metadata|property_definitions|IDX_16cc6ea2ff3b1429345831f1f9|CREATE INDEX "IDX_16cc6ea2ff3b1429345831f1f9" ON metadata.property_definitions USING btree (is_active)
metadata|property_definitions|IDX_2e4c4613796c3af281556a2b62|CREATE INDEX "IDX_2e4c4613796c3af281556a2b62" ON metadata.property_definitions USING btree (collection_id)
metadata|property_definitions|IDX_e7ba7ffa905aec05e079199292|CREATE INDEX "IDX_e7ba7ffa905aec05e079199292" ON metadata.property_definitions USING btree (reference_collection_id)
metadata|property_definitions|PK_09013b5e4e940a81de054ac6fd2|CREATE UNIQUE INDEX "PK_09013b5e4e940a81de054ac6fd2" ON metadata.property_definitions USING btree (id)
metadata|property_definitions|UQ_2211a0f9fca1a63a5a8ff76bda2|CREATE UNIQUE INDEX "UQ_2211a0f9fca1a63a5a8ff76bda2" ON metadata.property_definitions USING btree (collection_id, code)
metadata|property_definitions|idx_property_collection_owner|CREATE INDEX idx_property_collection_owner ON metadata.property_definitions USING btree (collection_id, owner)
metadata|property_definitions|idx_property_def_behavioral_audit|CREATE INDEX idx_property_def_behavioral_audit ON metadata.property_definitions USING btree (((behavioral_attributes ->> 'audit'::text))) WHERE ((behavioral_attributes ->> 'audit'::text) = 'true'::text)
metadata|property_definitions|idx_property_definitions_application_id|CREATE INDEX idx_property_definitions_application_id ON metadata.property_definitions USING btree (application_id)
metadata|property_definitions|idx_property_definitions_behavioral_attributes_gin|CREATE INDEX idx_property_definitions_behavioral_attributes_gin ON metadata.property_definitions USING gin (behavioral_attributes)
metadata|property_definitions|idx_property_definitions_config_gin|CREATE INDEX idx_property_definitions_config_gin ON metadata.property_definitions USING gin (config)
metadata|property_definitions|idx_property_definitions_metadata_gin|CREATE INDEX idx_property_definitions_metadata_gin ON metadata.property_definitions USING gin (metadata jsonb_path_ops)
metadata|property_definitions|idx_property_definitions_source|CREATE INDEX idx_property_definitions_source ON metadata.property_definitions USING btree (source)
metadata|property_definitions|idx_property_definitions_status|CREATE INDEX idx_property_definitions_status ON metadata.property_definitions USING btree (status)
metadata|property_definitions|idx_property_owner|CREATE INDEX idx_property_owner ON metadata.property_definitions USING btree (owner)
metadata|property_definitions|idx_property_sync_status|CREATE INDEX idx_property_sync_status ON metadata.property_definitions USING btree (sync_status)
metadata|property_types|IDX_1f7b17d42cf5cbd751912ddda1|CREATE UNIQUE INDEX "IDX_1f7b17d42cf5cbd751912ddda1" ON metadata.property_types USING btree (code)
metadata|property_types|IDX_b03cfc29a73bc8ab5edf39c826|CREATE INDEX "IDX_b03cfc29a73bc8ab5edf39c826" ON metadata.property_types USING btree (category)
metadata|property_types|PK_129390b286b9c776438dfa475a8|CREATE UNIQUE INDEX "PK_129390b286b9c776438dfa475a8" ON metadata.property_types USING btree (id)
metadata|property_types|UQ_1f7b17d42cf5cbd751912ddda14|CREATE UNIQUE INDEX "UQ_1f7b17d42cf5cbd751912ddda14" ON metadata.property_types USING btree (code)
metadata|schema_change_log|idx_schema_change_created|CREATE INDEX idx_schema_change_created ON metadata.schema_change_log USING btree (created_at DESC)
metadata|schema_change_log|idx_schema_change_entity|CREATE INDEX idx_schema_change_entity ON metadata.schema_change_log USING btree (entity_type, entity_id)
metadata|schema_change_log|idx_schema_change_entity_code|CREATE INDEX idx_schema_change_entity_code ON metadata.schema_change_log USING btree (entity_type, entity_code)
metadata|schema_change_log|idx_schema_change_failed|CREATE INDEX idx_schema_change_failed ON metadata.schema_change_log USING btree (created_at DESC) WHERE (success = false)
metadata|schema_change_log|idx_schema_change_performer|CREATE INDEX idx_schema_change_performer ON metadata.schema_change_log USING btree (performed_by, created_at DESC)
metadata|schema_change_log|idx_schema_change_rollback_candidates|CREATE INDEX idx_schema_change_rollback_candidates ON metadata.schema_change_log USING btree (created_at DESC) WHERE ((success = true) AND (is_rolled_back = false))
metadata|schema_change_log|idx_schema_change_type|CREATE INDEX idx_schema_change_type ON metadata.schema_change_log USING btree (change_type, created_at DESC)
metadata|schema_change_log|schema_change_log_pkey|CREATE UNIQUE INDEX schema_change_log_pkey ON metadata.schema_change_log USING btree (id)
metadata|schema_sync_state|idx_schema_sync_lock|CREATE INDEX idx_schema_sync_lock ON metadata.schema_sync_state USING btree (sync_lock_expires_at)
metadata|schema_sync_state|schema_sync_state_pkey|CREATE UNIQUE INDEX schema_sync_state_pkey ON metadata.schema_sync_state USING btree (id)
metadata|search_dictionaries|idx_search_dictionaries_locale|CREATE INDEX idx_search_dictionaries_locale ON metadata.search_dictionaries USING btree (locale)
metadata|search_dictionaries|search_dictionaries_pkey|CREATE UNIQUE INDEX search_dictionaries_pkey ON metadata.search_dictionaries USING btree (id)
metadata|search_dictionaries|uq_search_dictionaries_code|CREATE UNIQUE INDEX uq_search_dictionaries_code ON metadata.search_dictionaries USING btree (code)
metadata|search_experiences|idx_search_experiences_scope|CREATE INDEX idx_search_experiences_scope ON metadata.search_experiences USING btree (scope)
metadata|search_experiences|idx_search_experiences_scope_key|CREATE INDEX idx_search_experiences_scope_key ON metadata.search_experiences USING btree (scope_key)
metadata|search_experiences|search_experiences_pkey|CREATE UNIQUE INDEX search_experiences_pkey ON metadata.search_experiences USING btree (id)
metadata|search_experiences|uq_search_experiences_code|CREATE UNIQUE INDEX uq_search_experiences_code ON metadata.search_experiences USING btree (code)
metadata|search_index_state|search_index_state_pkey|CREATE UNIQUE INDEX search_index_state_pkey ON metadata.search_index_state USING btree (id)
metadata|search_index_state|uq_search_index_state_collection|CREATE UNIQUE INDEX uq_search_index_state_collection ON metadata.search_index_state USING btree (collection_code)
metadata|search_sources|idx_search_sources_collection|CREATE INDEX idx_search_sources_collection ON metadata.search_sources USING btree (collection_code)
metadata|search_sources|search_sources_pkey|CREATE UNIQUE INDEX search_sources_pkey ON metadata.search_sources USING btree (id)
metadata|search_sources|uq_search_sources_code|CREATE UNIQUE INDEX uq_search_sources_code ON metadata.search_sources USING btree (code)
metadata|theme_definitions|IDX_05cbb2665b2c235e3c06f0e55b|CREATE INDEX "IDX_05cbb2665b2c235e3c06f0e55b" ON metadata.theme_definitions USING btree (color_scheme)
metadata|theme_definitions|IDX_7acdb47306e9b04ff598ca67a8|CREATE UNIQUE INDEX "IDX_7acdb47306e9b04ff598ca67a8" ON metadata.theme_definitions USING btree (code)
metadata|theme_definitions|IDX_c0a7ca386aca61a735377afe1d|CREATE INDEX "IDX_c0a7ca386aca61a735377afe1d" ON metadata.theme_definitions USING btree (is_default)
metadata|theme_definitions|IDX_c8553e254fab743a15789c9367|CREATE INDEX "IDX_c8553e254fab743a15789c9367" ON metadata.theme_definitions USING btree (theme_type)
metadata|theme_definitions|PK_e9340ba17d97c17056d05759136|CREATE UNIQUE INDEX "PK_e9340ba17d97c17056d05759136" ON metadata.theme_definitions USING btree (id)
metadata|theme_definitions|UQ_7acdb47306e9b04ff598ca67a8d|CREATE UNIQUE INDEX "UQ_7acdb47306e9b04ff598ca67a8d" ON metadata.theme_definitions USING btree (code)
metadata|translation_keys|idx_translation_keys_namespace|CREATE INDEX idx_translation_keys_namespace ON metadata.translation_keys USING btree (namespace)
metadata|translation_keys|translation_keys_pkey|CREATE UNIQUE INDEX translation_keys_pkey ON metadata.translation_keys USING btree (id)
metadata|translation_keys|uq_translation_keys_namespace_key|CREATE UNIQUE INDEX uq_translation_keys_namespace_key ON metadata.translation_keys USING btree (namespace, key)
metadata|translation_requests|idx_translation_requests_key|CREATE INDEX idx_translation_requests_key ON metadata.translation_requests USING btree (translation_key_id)
metadata|translation_requests|idx_translation_requests_locale|CREATE INDEX idx_translation_requests_locale ON metadata.translation_requests USING btree (locale_id)
metadata|translation_requests|idx_translation_requests_status|CREATE INDEX idx_translation_requests_status ON metadata.translation_requests USING btree (status)
metadata|translation_requests|translation_requests_pkey|CREATE UNIQUE INDEX translation_requests_pkey ON metadata.translation_requests USING btree (id)
metadata|translation_values|idx_translation_values_key|CREATE INDEX idx_translation_values_key ON metadata.translation_values USING btree (translation_key_id)
metadata|translation_values|idx_translation_values_locale|CREATE INDEX idx_translation_values_locale ON metadata.translation_values USING btree (locale_id)
metadata|translation_values|translation_values_pkey|CREATE UNIQUE INDEX translation_values_pkey ON metadata.translation_values USING btree (id)
metadata|translation_values|uq_translation_values_key_locale|CREATE UNIQUE INDEX uq_translation_values_key_locale ON metadata.translation_values USING btree (translation_key_id, locale_id)
metadata|user_theme_preferences|IDX_ae77cd7cd68614f5880e102757|CREATE UNIQUE INDEX "IDX_ae77cd7cd68614f5880e102757" ON metadata.user_theme_preferences USING btree (user_id)
metadata|user_theme_preferences|PK_d2925210c600e2673134dcf7e8b|CREATE UNIQUE INDEX "PK_d2925210c600e2673134dcf7e8b" ON metadata.user_theme_preferences USING btree (id)
metadata|view_definition_revisions|IDX_view_definition_revisions_definition|CREATE INDEX "IDX_view_definition_revisions_definition" ON metadata.view_definition_revisions USING btree (view_definition_id)
metadata|view_definition_revisions|IDX_view_definition_revisions_status|CREATE INDEX "IDX_view_definition_revisions_status" ON metadata.view_definition_revisions USING btree (status)
metadata|view_definition_revisions|PK_view_definition_revisions|CREATE UNIQUE INDEX "PK_view_definition_revisions" ON metadata.view_definition_revisions USING btree (id)
metadata|view_definition_revisions|UQ_view_definition_revision|CREATE UNIQUE INDEX "UQ_view_definition_revision" ON metadata.view_definition_revisions USING btree (view_definition_id, revision)
metadata|view_definitions|IDX_view_definitions_active|CREATE INDEX "IDX_view_definitions_active" ON metadata.view_definitions USING btree (is_active)
metadata|view_definitions|IDX_view_definitions_kind|CREATE INDEX "IDX_view_definitions_kind" ON metadata.view_definitions USING btree (kind)
metadata|view_definitions|IDX_view_definitions_target_collection|CREATE INDEX "IDX_view_definitions_target_collection" ON metadata.view_definitions USING btree (target_collection_code)
metadata|view_definitions|PK_view_definitions|CREATE UNIQUE INDEX "PK_view_definitions" ON metadata.view_definitions USING btree (id)
metadata|view_definitions|UQ_view_definitions_code|CREATE UNIQUE INDEX "UQ_view_definitions_code" ON metadata.view_definitions USING btree (code)
metadata|view_definitions|idx_view_definitions_application_id|CREATE INDEX idx_view_definitions_application_id ON metadata.view_definitions USING btree (application_id)
metadata|view_definitions|idx_view_definitions_source|CREATE INDEX idx_view_definitions_source ON metadata.view_definitions USING btree (source)
metadata|view_variants|IDX_view_variants_definition|CREATE INDEX "IDX_view_variants_definition" ON metadata.view_variants USING btree (view_definition_id)
metadata|view_variants|IDX_view_variants_scope|CREATE INDEX "IDX_view_variants_scope" ON metadata.view_variants USING btree (scope)
metadata|view_variants|IDX_view_variants_scope_key|CREATE INDEX "IDX_view_variants_scope_key" ON metadata.view_variants USING btree (scope_key)
metadata|view_variants|PK_view_variants|CREATE UNIQUE INDEX "PK_view_variants" ON metadata.view_variants USING btree (id)
metadata|widget_catalog|PK_widget_catalog|CREATE UNIQUE INDEX "PK_widget_catalog" ON metadata.widget_catalog USING btree (id)
metadata|widget_catalog|UQ_widget_catalog_code|CREATE UNIQUE INDEX "UQ_widget_catalog_code" ON metadata.widget_catalog USING btree (code)
metadata|widget_catalog|idx_widget_catalog_application_id|CREATE INDEX idx_widget_catalog_application_id ON metadata.widget_catalog USING btree (application_id)
metadata|workspace_definitions|idx_workspace_definitions_application|CREATE INDEX idx_workspace_definitions_application ON metadata.workspace_definitions USING btree (application_id)
metadata|workspace_definitions|idx_workspace_definitions_status|CREATE INDEX idx_workspace_definitions_status ON metadata.workspace_definitions USING btree (status)
metadata|workspace_definitions|workspace_definitions_code_key|CREATE UNIQUE INDEX workspace_definitions_code_key ON metadata.workspace_definitions USING btree (code)
metadata|workspace_definitions|workspace_definitions_pkey|CREATE UNIQUE INDEX workspace_definitions_pkey ON metadata.workspace_definitions USING btree (id)
metadata|workspace_pages|idx_workspace_pages_position|CREATE INDEX idx_workspace_pages_position ON metadata.workspace_pages USING btree (workspace_id, "position")
metadata|workspace_pages|uq_workspace_pages_code|CREATE UNIQUE INDEX uq_workspace_pages_code ON metadata.workspace_pages USING btree (workspace_id, code)
metadata|workspace_pages|workspace_pages_pkey|CREATE UNIQUE INDEX workspace_pages_pkey ON metadata.workspace_pages USING btree (id)
metadata|workspace_variants|idx_workspace_variants_page|CREATE INDEX idx_workspace_variants_page ON metadata.workspace_variants USING btree (workspace_id, page_id)
metadata|workspace_variants|idx_workspace_variants_scope|CREATE INDEX idx_workspace_variants_scope ON metadata.workspace_variants USING btree (scope, scope_ref)
metadata|workspace_variants|workspace_variants_pkey|CREATE UNIQUE INDEX workspace_variants_pkey ON metadata.workspace_variants USING btree (id)
notify|device_tokens|device_tokens_pkey|CREATE UNIQUE INDEX device_tokens_pkey ON notify.device_tokens USING btree (id)
notify|device_tokens|device_tokens_token_key|CREATE UNIQUE INDEX device_tokens_token_key ON notify.device_tokens USING btree (token)
notify|device_tokens|idx_device_tokens_user|CREATE INDEX idx_device_tokens_user ON notify.device_tokens USING btree (user_id) WHERE (is_active = true)
notify|in_app_notifications|idx_in_app_notifications_unread|CREATE INDEX idx_in_app_notifications_unread ON notify.in_app_notifications USING btree (user_id) WHERE ((read = false) AND (dismissed = false))
notify|in_app_notifications|idx_in_app_notifications_user|CREATE INDEX idx_in_app_notifications_user ON notify.in_app_notifications USING btree (user_id, read, created_at DESC)
notify|in_app_notifications|in_app_notifications_pkey|CREATE UNIQUE INDEX in_app_notifications_pkey ON notify.in_app_notifications USING btree (id)
notify|notification_history|idx_notification_history_queue|CREATE INDEX idx_notification_history_queue ON notify.notification_history USING btree (notification_queue_id)
notify|notification_history|idx_notification_history_recipient|CREATE INDEX idx_notification_history_recipient ON notify.notification_history USING btree (recipient_id, sent_at DESC)
notify|notification_history|notification_history_pkey|CREATE UNIQUE INDEX notification_history_pkey ON notify.notification_history USING btree (id)
notify|notification_queue|IDX_notification_queue_idempotency_key|CREATE INDEX "IDX_notification_queue_idempotency_key" ON notify.notification_queue USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL)
notify|notification_queue|idx_notification_queue_recipient|CREATE INDEX idx_notification_queue_recipient ON notify.notification_queue USING btree (recipient_id)
notify|notification_queue|idx_notification_queue_status|CREATE INDEX idx_notification_queue_status ON notify.notification_queue USING btree (status, scheduled_for)
notify|notification_queue|notification_queue_pkey|CREATE UNIQUE INDEX notification_queue_pkey ON notify.notification_queue USING btree (id)
notify|notification_templates|idx_notification_templates_category|CREATE INDEX idx_notification_templates_category ON notify.notification_templates USING btree (category) WHERE (is_active = true)
notify|notification_templates|notification_templates_code_key|CREATE UNIQUE INDEX notification_templates_code_key ON notify.notification_templates USING btree (code)
notify|notification_templates|notification_templates_pkey|CREATE UNIQUE INDEX notification_templates_pkey ON notify.notification_templates USING btree (id)
notify|user_notification_preferences|user_notification_preferences_pkey|CREATE UNIQUE INDEX user_notification_preferences_pkey ON notify.user_notification_preferences USING btree (id)
notify|user_notification_preferences|user_notification_preferences_user_id_key|CREATE UNIQUE INDEX user_notification_preferences_user_id_key ON notify.user_notification_preferences USING btree (user_id)
public|access_audit_logs|PK_92362eda47f20e6eff693801adc|CREATE UNIQUE INDEX "PK_92362eda47f20e6eff693801adc" ON public.access_audit_logs USING btree (id)
public|access_condition_groups|PK_a08fcc4ccef7a20eb06585d161d|CREATE UNIQUE INDEX "PK_a08fcc4ccef7a20eb06585d161d" ON public.access_condition_groups USING btree (id)
public|access_conditions|PK_dc7b7cc80c74b4cb2c2c908bc8e|CREATE UNIQUE INDEX "PK_dc7b7cc80c74b4cb2c2c908bc8e" ON public.access_conditions USING btree (id)
public|access_rule_audit_logs|PK_eabc37285db4504f74492eb2757|CREATE UNIQUE INDEX "PK_eabc37285db4504f74492eb2757" ON public.access_rule_audit_logs USING btree (id)
public|audit_logs|IDX_0bacca40d90fcebfc311982eb1|CREATE INDEX "IDX_0bacca40d90fcebfc311982eb1" ON public.audit_logs USING btree (collection_code)
public|audit_logs|IDX_2cd10fda8276bb995288acfbfb|CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON public.audit_logs USING btree (created_at)
public|audit_logs|IDX_audit_logs_hash|CREATE INDEX "IDX_audit_logs_hash" ON public.audit_logs USING btree (hash)
public|audit_logs|IDX_audit_logs_permission_code_created_at|CREATE INDEX "IDX_audit_logs_permission_code_created_at" ON public.audit_logs USING btree (permission_code, created_at)
public|audit_logs|IDX_audit_logs_previous_hash|CREATE INDEX "IDX_audit_logs_previous_hash" ON public.audit_logs USING btree (previous_hash)
public|audit_logs|IDX_bd2726fd31b35443f2245b93ba|CREATE INDEX "IDX_bd2726fd31b35443f2245b93ba" ON public.audit_logs USING btree (user_id)
public|audit_logs|IDX_cee5459245f652b75eb2759b4c|CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON public.audit_logs USING btree (action)
public|audit_logs|IDX_f0acee5e593954a1dc4ac8aad3|CREATE INDEX "IDX_f0acee5e593954a1dc4ac8aad3" ON public.audit_logs USING btree (record_id)
public|audit_logs|PK_1bb179d048bbc581caa3b013439|CREATE UNIQUE INDEX "PK_1bb179d048bbc581caa3b013439" ON public.audit_logs USING btree (id)
public|collection_access_rules|IDX_0644be2a2e4d4a95dae2039d04|CREATE INDEX "IDX_0644be2a2e4d4a95dae2039d04" ON public.collection_access_rules USING btree (collection_id)
public|collection_access_rules|IDX_0ee922b564bc954b4d97eae815|CREATE INDEX "IDX_0ee922b564bc954b4d97eae815" ON public.collection_access_rules USING btree (role_id)
public|collection_access_rules|IDX_2bbd90ecb185529732938857fa|CREATE INDEX "IDX_2bbd90ecb185529732938857fa" ON public.collection_access_rules USING btree (user_id)
public|collection_access_rules|IDX_52174f0e91e1a5a0c87c9fcf78|CREATE INDEX "IDX_52174f0e91e1a5a0c87c9fcf78" ON public.collection_access_rules USING btree (priority)
public|collection_access_rules|IDX_collection_access_rules_effect|CREATE INDEX "IDX_collection_access_rules_effect" ON public.collection_access_rules USING btree (collection_id, effect)
public|collection_access_rules|IDX_collection_access_rules_rule_key|CREATE INDEX "IDX_collection_access_rules_rule_key" ON public.collection_access_rules USING btree (collection_id, rule_key) WHERE (rule_key IS NOT NULL)
public|collection_access_rules|IDX_d9437ad9cb5e4aedaf442b949e|CREATE INDEX "IDX_d9437ad9cb5e4aedaf442b949e" ON public.collection_access_rules USING btree (group_id)
public|collection_access_rules|PK_685125fdb89c2749d2c76bca5a2|CREATE UNIQUE INDEX "PK_685125fdb89c2749d2c76bca5a2" ON public.collection_access_rules USING btree (id)
public|config_change_history|PK_1be86c25d2fc54beef9398c6991|CREATE UNIQUE INDEX "PK_1be86c25d2fc54beef9398c6991" ON public.config_change_history USING btree (id)
public|field_mappings|field_mappings_pkey|CREATE UNIQUE INDEX field_mappings_pkey ON public.field_mappings USING btree (id)
public|field_mappings|idx_field_mappings_connection|CREATE INDEX idx_field_mappings_connection ON public.field_mappings USING btree (connection_id)
public|formula_cache|formula_cache_pkey|CREATE UNIQUE INDEX formula_cache_pkey ON public.formula_cache USING btree (id)
public|formula_cache|idx_formula_cache_dependencies|CREATE INDEX idx_formula_cache_dependencies ON public.formula_cache USING gin (dependencies)
public|formula_cache|idx_formula_cache_expires|CREATE INDEX idx_formula_cache_expires ON public.formula_cache USING btree (expires_at) WHERE (expires_at IS NOT NULL)
public|formula_cache|idx_formula_cache_stale|CREATE INDEX idx_formula_cache_stale ON public.formula_cache USING btree (is_stale) WHERE (is_stale = true)
public|formula_cache|idx_formula_cache_unique|CREATE UNIQUE INDEX idx_formula_cache_unique ON public.formula_cache USING btree (collection_id, property_id, record_id)
public|inline_editing_test|inline_editing_test_pkey|CREATE UNIQUE INDEX inline_editing_test_pkey ON public.inline_editing_test USING btree (id)
public|instance_customizations|idx_instance_customizations_active|CREATE INDEX idx_instance_customizations_active ON public.instance_customizations USING btree (is_active)
public|instance_customizations|idx_instance_customizations_instance|CREATE INDEX idx_instance_customizations_instance ON public.instance_customizations USING btree (instance_id)
public|instance_customizations|idx_instance_customizations_type|CREATE INDEX idx_instance_customizations_type ON public.instance_customizations USING btree (config_type)
public|instance_customizations|idx_instance_customizations_unique|CREATE UNIQUE INDEX idx_instance_customizations_unique ON public.instance_customizations USING btree (instance_id, config_type, resource_key)
public|instance_customizations|instance_customizations_pkey|CREATE UNIQUE INDEX instance_customizations_pkey ON public.instance_customizations USING btree (id)
public|instance_event_outbox|IDX_instance_event_outbox_locked_at|CREATE INDEX "IDX_instance_event_outbox_locked_at" ON public.instance_event_outbox USING btree (locked_at)
public|instance_event_outbox|IDX_instance_event_outbox_status_created_at|CREATE INDEX "IDX_instance_event_outbox_status_created_at" ON public.instance_event_outbox USING btree (status, created_at)
public|instance_event_outbox|instance_event_outbox_pkey|CREATE UNIQUE INDEX instance_event_outbox_pkey ON public.instance_event_outbox USING btree (id)
public|instance_settings|IDX_9c03e48624b266373a313f87d4|CREATE INDEX "IDX_9c03e48624b266373a313f87d4" ON public.instance_settings USING btree (category)
public|instance_settings|IDX_f4841fbd4c9819d5ade4b5dfeb|CREATE UNIQUE INDEX "IDX_f4841fbd4c9819d5ade4b5dfeb" ON public.instance_settings USING btree (key)
public|instance_settings|PK_eb2567a5e4188cd54689e1d79ef|CREATE UNIQUE INDEX "PK_eb2567a5e4188cd54689e1d79ef" ON public.instance_settings USING btree (id)
public|instance_settings|UQ_f4841fbd4c9819d5ade4b5dfeb8|CREATE UNIQUE INDEX "UQ_f4841fbd4c9819d5ade4b5dfeb8" ON public.instance_settings USING btree (key)
public|instance_upgrade_impact|idx_upgrade_impact_instance|CREATE INDEX idx_upgrade_impact_instance ON public.instance_upgrade_impact USING btree (instance_id)
public|instance_upgrade_impact|idx_upgrade_impact_manifest|CREATE INDEX idx_upgrade_impact_manifest ON public.instance_upgrade_impact USING btree (upgrade_manifest_id)
public|instance_upgrade_impact|idx_upgrade_impact_severity|CREATE INDEX idx_upgrade_impact_severity ON public.instance_upgrade_impact USING btree (impact_severity)
public|instance_upgrade_impact|idx_upgrade_impact_status|CREATE INDEX idx_upgrade_impact_status ON public.instance_upgrade_impact USING btree (status)
public|instance_upgrade_impact|instance_upgrade_impact_pkey|CREATE UNIQUE INDEX instance_upgrade_impact_pkey ON public.instance_upgrade_impact USING btree (id)
public|key_metadata|idx_key_metadata_one_active|CREATE UNIQUE INDEX idx_key_metadata_one_active ON public.key_metadata USING btree (COALESCE((instance_id)::text, 'platform'::text)) WHERE (state = 'active'::text)
public|key_metadata|idx_key_metadata_state|CREATE INDEX idx_key_metadata_state ON public.key_metadata USING btree (state) WHERE (state = ANY (ARRAY['active'::text, 'retiring'::text]))
public|key_metadata|key_metadata_pkey|CREATE UNIQUE INDEX key_metadata_pkey ON public.key_metadata USING btree (kid)
public|migrations|PK_8c82d7f526340ab734260ea46be|CREATE UNIQUE INDEX "PK_8c82d7f526340ab734260ea46be" ON public.migrations USING btree (id)
public|platform_config|idx_platform_config_key|CREATE UNIQUE INDEX idx_platform_config_key ON public.platform_config USING btree (key)
public|platform_config|platform_config_pkey|CREATE UNIQUE INDEX platform_config_pkey ON public.platform_config USING btree (id)
public|property_access_rules|IDX_0189d2c9de5f8ef47506294a27|CREATE INDEX "IDX_0189d2c9de5f8ef47506294a27" ON public.property_access_rules USING btree (role_id)
public|property_access_rules|IDX_314d7767bd038e2d47aebb208f|CREATE INDEX "IDX_314d7767bd038e2d47aebb208f" ON public.property_access_rules USING btree (property_id)
public|property_access_rules|IDX_8c5f3ff32b318d551d8f4a7b28|CREATE INDEX "IDX_8c5f3ff32b318d551d8f4a7b28" ON public.property_access_rules USING btree (user_id)
public|property_access_rules|IDX_a0b9e97943e753481035a49922|CREATE INDEX "IDX_a0b9e97943e753481035a49922" ON public.property_access_rules USING btree (group_id)
public|property_access_rules|IDX_property_access_rules_effect|CREATE INDEX "IDX_property_access_rules_effect" ON public.property_access_rules USING btree (property_id, effect)
public|property_access_rules|IDX_property_access_rules_rule_key|CREATE INDEX "IDX_property_access_rules_rule_key" ON public.property_access_rules USING btree (property_id, rule_key) WHERE (rule_key IS NOT NULL)
public|property_access_rules|IDX_property_access_rules_wildcard_collection_id|CREATE INDEX "IDX_property_access_rules_wildcard_collection_id" ON public.property_access_rules USING btree (wildcard_collection_id)
public|property_access_rules|PK_64e3b9fa96a1735ba4741905d88|CREATE UNIQUE INDEX "PK_64e3b9fa96a1735ba4741905d88" ON public.property_access_rules USING btree (id)
public|property_audit_logs|PK_3878feaf1d72785e4c4fa1d6c53|CREATE UNIQUE INDEX "PK_3878feaf1d72785e4c4fa1d6c53" ON public.property_audit_logs USING btree (id)
public|property_dependencies|idx_property_dependencies_collection|CREATE INDEX idx_property_dependencies_collection ON public.property_dependencies USING btree (collection_id)
public|property_dependencies|idx_property_dependencies_depends_on|CREATE INDEX idx_property_dependencies_depends_on ON public.property_dependencies USING btree (depends_on_property_id)
public|property_dependencies|idx_property_dependencies_order|CREATE INDEX idx_property_dependencies_order ON public.property_dependencies USING btree (collection_id, update_order)
public|property_dependencies|idx_property_dependencies_property|CREATE INDEX idx_property_dependencies_property ON public.property_dependencies USING btree (property_id)
public|property_dependencies|property_dependencies_pkey|CREATE UNIQUE INDEX property_dependencies_pkey ON public.property_dependencies USING btree (id)
public|runtime_anomaly|IDX_runtime_anomaly_kind_occurred_at|CREATE INDEX "IDX_runtime_anomaly_kind_occurred_at" ON public.runtime_anomaly USING btree (kind, occurred_at)
public|runtime_anomaly|IDX_runtime_anomaly_service_occurred_at|CREATE INDEX "IDX_runtime_anomaly_service_occurred_at" ON public.runtime_anomaly USING btree (service_code, occurred_at)
public|runtime_anomaly|runtime_anomaly_pkey|CREATE UNIQUE INDEX runtime_anomaly_pkey ON public.runtime_anomaly USING btree (id)
public|schema_versions|idx_schema_versions_collection|CREATE INDEX idx_schema_versions_collection ON public.schema_versions USING btree (collection_code)
public|schema_versions|idx_schema_versions_collection_version|CREATE INDEX idx_schema_versions_collection_version ON public.schema_versions USING btree (collection_code, version DESC)
public|schema_versions|idx_schema_versions_created_at|CREATE INDEX idx_schema_versions_created_at ON public.schema_versions USING btree (created_at DESC)
public|schema_versions|idx_schema_versions_created_by|CREATE INDEX idx_schema_versions_created_by ON public.schema_versions USING btree (created_by)
public|schema_versions|idx_schema_versions_parent|CREATE INDEX idx_schema_versions_parent ON public.schema_versions USING btree (parent_version_id)
public|schema_versions|schema_versions_pkey|CREATE UNIQUE INDEX schema_versions_pkey ON public.schema_versions USING btree (id)
public|schema_versions|uq_schema_versions_collection_version|CREATE UNIQUE INDEX uq_schema_versions_collection_version ON public.schema_versions USING btree (collection_code, version)
public|search_embeddings|idx_search_embeddings_attr_department_id|CREATE INDEX idx_search_embeddings_attr_department_id ON public.search_embeddings USING btree (_attribute_department_id)
public|search_embeddings|idx_search_embeddings_attr_region|CREATE INDEX idx_search_embeddings_attr_region ON public.search_embeddings USING btree (_attribute_region)
public|search_embeddings|idx_search_embeddings_attr_site_id|CREATE INDEX idx_search_embeddings_attr_site_id ON public.search_embeddings USING btree (_attribute_site_id)
public|search_embeddings|idx_search_embeddings_collection_id|CREATE INDEX idx_search_embeddings_collection_id ON public.search_embeddings USING btree (_collection_id)
public|search_embeddings|idx_search_embeddings_embedding|CREATE INDEX idx_search_embeddings_embedding ON public.search_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m='16', ef_construction='64')
public|search_embeddings|idx_search_embeddings_metadata|CREATE INDEX idx_search_embeddings_metadata ON public.search_embeddings USING gin (metadata)
public|search_embeddings|idx_search_embeddings_source_id|CREATE INDEX idx_search_embeddings_source_id ON public.search_embeddings USING btree (source_id)
public|search_embeddings|idx_search_embeddings_source_type|CREATE INDEX idx_search_embeddings_source_type ON public.search_embeddings USING btree (source_type)
public|search_embeddings|search_embeddings_pkey|CREATE UNIQUE INDEX search_embeddings_pkey ON public.search_embeddings USING btree (id)
public|search_embeddings|search_embeddings_source_type_source_id_chunk_index_key|CREATE UNIQUE INDEX search_embeddings_source_type_source_id_chunk_index_key ON public.search_embeddings USING btree (source_type, source_id, chunk_index)
public|service_principals|idx_service_principals_k8s_sa|CREATE INDEX idx_service_principals_k8s_sa ON public.service_principals USING btree (k8s_service_account) WHERE ((active = true) AND (k8s_service_account IS NOT NULL))
public|service_principals|service_principals_pkey|CREATE UNIQUE INDEX service_principals_pkey ON public.service_principals USING btree (service_id)
public|upgrade_history|idx_upgrade_history_completed|CREATE INDEX idx_upgrade_history_completed ON public.upgrade_history USING btree (completed_at)
public|upgrade_history|idx_upgrade_history_instance|CREATE INDEX idx_upgrade_history_instance ON public.upgrade_history USING btree (instance_id)
public|upgrade_history|idx_upgrade_history_status|CREATE INDEX idx_upgrade_history_status ON public.upgrade_history USING btree (status)
public|upgrade_history|upgrade_history_pkey|CREATE UNIQUE INDEX upgrade_history_pkey ON public.upgrade_history USING btree (id)
public|upgrade_manifest|idx_upgrade_manifest_available|CREATE INDEX idx_upgrade_manifest_available ON public.upgrade_manifest USING btree (is_available)
public|upgrade_manifest|idx_upgrade_manifest_version|CREATE UNIQUE INDEX idx_upgrade_manifest_version ON public.upgrade_manifest USING btree (version)
public|upgrade_manifest|upgrade_manifest_pkey|CREATE UNIQUE INDEX upgrade_manifest_pkey ON public.upgrade_manifest USING btree (id)
public|user_preferences|IDX_458057fa75b66e68a275647da2|CREATE UNIQUE INDEX "IDX_458057fa75b66e68a275647da2" ON public.user_preferences USING btree (user_id)
public|user_preferences|PK_e8cfb5b31af61cd363a6b6d7c25|CREATE UNIQUE INDEX "PK_e8cfb5b31af61cd363a6b6d7c25" ON public.user_preferences USING btree (id)
public|user_sessions|IDX_0c30b2278a5d31e23fcaee4887|CREATE INDEX "IDX_0c30b2278a5d31e23fcaee4887" ON public.user_sessions USING btree (is_active)
public|user_sessions|IDX_dbc81ff542b1b3366bae195f2a|CREATE INDEX "IDX_dbc81ff542b1b3366bae195f2a" ON public.user_sessions USING btree (expires_at)
public|user_sessions|IDX_e5eb7a3c7766f941fe16b9edec|CREATE UNIQUE INDEX "IDX_e5eb7a3c7766f941fe16b9edec" ON public.user_sessions USING btree (session_token)
public|user_sessions|IDX_e9658e959c490b0a634dfc5478|CREATE INDEX "IDX_e9658e959c490b0a634dfc5478" ON public.user_sessions USING btree (user_id)
public|user_sessions|PK_e93e031a5fed190d4789b6bfd83|CREATE UNIQUE INDEX "PK_e93e031a5fed190d4789b6bfd83" ON public.user_sessions USING btree (id)
public|user_sessions|UQ_e5eb7a3c7766f941fe16b9edecb|CREATE UNIQUE INDEX "UQ_e5eb7a3c7766f941fe16b9edecb" ON public.user_sessions USING btree (session_token)
public|users|IDX_01b38a262e9036dfcd0d686de6|CREATE UNIQUE INDEX "IDX_01b38a262e9036dfcd0d686de6" ON public.users USING btree (username) WHERE ((username IS NOT NULL) AND (deleted_at IS NULL))
public|users|IDX_0837b566b883183034a42db0e0|CREATE UNIQUE INDEX "IDX_0837b566b883183034a42db0e0" ON public.users USING btree (employee_id) WHERE (employee_id IS NOT NULL)
public|users|IDX_1b7c676ffb354a9cabc87b7da9|CREATE INDEX "IDX_1b7c676ffb354a9cabc87b7da9" ON public.users USING btree (is_admin)
public|users|IDX_3676155292d72c67cd4e090514|CREATE INDEX "IDX_3676155292d72c67cd4e090514" ON public.users USING btree (status)
public|users|IDX_7fdbf1baeb91b6f822b5d57e19|CREATE UNIQUE INDEX "IDX_7fdbf1baeb91b6f822b5d57e19" ON public.users USING btree (email) WHERE (deleted_at IS NULL)
public|users|IDX_c162e1fe9d744b0721daea3b1c|CREATE INDEX "IDX_c162e1fe9d744b0721daea3b1c" ON public.users USING btree (department)
public|users|IDX_fba2d8e029689aa8fea98e53c9|CREATE INDEX "IDX_fba2d8e029689aa8fea98e53c9" ON public.users USING btree (manager_id)
public|users|PK_a3ffb1c0c8416b9fc6f907b7433|CREATE UNIQUE INDEX "PK_a3ffb1c0c8416b9fc6f907b7433" ON public.users USING btree (id)
public|users|idx_users_security_stamp|CREATE INDEX idx_users_security_stamp ON public.users USING btree (id, security_stamp)
public|view_configurations|idx_view_config_collection|CREATE INDEX idx_view_config_collection ON public.view_configurations USING btree (collection_id, display_order)
public|view_configurations|idx_view_config_owner|CREATE INDEX idx_view_config_owner ON public.view_configurations USING btree (owner_type, owner_id)
public|view_configurations|idx_view_config_type|CREATE INDEX idx_view_config_type ON public.view_configurations USING btree (collection_id, view_type)
public|view_configurations|idx_view_config_unique|CREATE UNIQUE INDEX idx_view_config_unique ON public.view_configurations USING btree (collection_id, code)
public|view_configurations|view_configurations_pkey|CREATE UNIQUE INDEX view_configurations_pkey ON public.view_configurations USING btree (id)

## Tables and Columns
public|control_plane_audit_log|id|1|uuid_generate_v4()|NO|uuid||uuid
public|control_plane_audit_log|user_id|2||YES|uuid||uuid
public|control_plane_audit_log|customer_id|3||YES|uuid||uuid
public|control_plane_audit_log|instance_id|4||YES|uuid||uuid
public|control_plane_audit_log|action|5||NO|character varying|100|varchar
public|control_plane_audit_log|resource_type|6||YES|character varying|50|varchar
public|control_plane_audit_log|resource_id|7||YES|uuid||uuid
public|control_plane_audit_log|result|8|'success'::character varying|NO|character varying|20|varchar
public|control_plane_audit_log|error_message|9||YES|text||text
public|control_plane_audit_log|old_values|10||YES|jsonb||jsonb
public|control_plane_audit_log|new_values|11||YES|jsonb||jsonb
public|control_plane_audit_log|details|12|'{}'::jsonb|NO|jsonb||jsonb
public|control_plane_audit_log|ip_address|13||YES|character varying|45|varchar
public|control_plane_audit_log|user_agent|14||YES|text||text
public|control_plane_audit_log|request_id|15||YES|character varying|100|varchar
public|control_plane_audit_log|created_at|16|now()|NO|timestamp with time zone||timestamptz
public|control_plane_users|id|1|uuid_generate_v4()|NO|uuid||uuid
public|control_plane_users|email|2||NO|character varying|320|varchar
public|control_plane_users|display_name|3||NO|character varying|255|varchar
public|control_plane_users|first_name|4||YES|character varying|100|varchar
public|control_plane_users|last_name|5||YES|character varying|100|varchar
public|control_plane_users|password_hash|6||YES|character varying|255|varchar
public|control_plane_users|role|7|'readonly'::character varying|NO|character varying|50|varchar
public|control_plane_users|status|8|'active'::character varying|NO|character varying|20|varchar
public|control_plane_users|mfa_enabled|9|false|NO|boolean||bool
public|control_plane_users|mfa_secret|10||YES|character varying|255|varchar
public|control_plane_users|mfa_backup_codes|11||YES|jsonb||jsonb
public|control_plane_users|failed_login_attempts|12|0|NO|integer||int4
public|control_plane_users|locked_until|13||YES|timestamp with time zone||timestamptz
public|control_plane_users|password_changed_at|14||YES|timestamp with time zone||timestamptz
public|control_plane_users|last_login_at|15||YES|timestamp with time zone||timestamptz
public|control_plane_users|last_login_ip|16||YES|character varying|45|varchar
public|control_plane_users|last_activity_at|17||YES|timestamp with time zone||timestamptz
public|control_plane_users|avatar_url|18||YES|character varying|500|varchar
public|control_plane_users|metadata|19|'{}'::jsonb|NO|jsonb||jsonb
public|control_plane_users|created_at|20|now()|NO|timestamp with time zone||timestamptz
public|control_plane_users|updated_at|21|now()|NO|timestamp with time zone||timestamptz
public|customers|id|1|uuid_generate_v4()|NO|uuid||uuid
public|customers|code|2||NO|character varying|50|varchar
public|customers|name|3||NO|character varying|255|varchar
public|customers|status|4|'pending'::character varying|NO|character varying|20|varchar
public|customers|tier|5|'professional'::character varying|NO|character varying|20|varchar
public|customers|contract_start|6||YES|date||date
public|customers|contract_end|7||YES|date||date
public|customers|contract_value|8||YES|numeric||numeric
public|customers|currency|9|'USD'::character varying|NO|character varying|3|varchar
public|customers|mrr|10|0|NO|integer||int4
public|customers|primary_contact_name|11||YES|character varying|255|varchar
public|customers|primary_contact_email|12||YES|character varying|320|varchar
public|customers|primary_contact_phone|13||YES|character varying|50|varchar
public|customers|technical_contact_email|14||YES|character varying|320|varchar
public|customers|billing_email|15||YES|character varying|320|varchar
public|customers|address_line1|16||YES|character varying|255|varchar
public|customers|address_line2|17||YES|character varying|255|varchar
public|customers|city|18||YES|character varying|100|varchar
public|customers|state|19||YES|character varying|100|varchar
public|customers|postal_code|20||YES|character varying|20|varchar
public|customers|country|21||YES|character varying|100|varchar
public|customers|max_users|22||YES|integer||int4
public|customers|max_assets|23||YES|integer||int4
public|customers|max_storage_gb|24||YES|integer||int4
public|customers|max_instances|25|3|NO|integer||int4
public|customers|settings|26|'{}'::jsonb|NO|jsonb||jsonb
public|customers|feature_flags|27|'[]'::jsonb|NO|jsonb||jsonb
public|customers|metadata|28|'{}'::jsonb|NO|jsonb||jsonb
public|customers|notes|29||YES|text||text
public|customers|created_by|30||YES|uuid||uuid
public|customers|updated_by|31||YES|uuid||uuid
public|customers|deleted_at|32||YES|timestamp with time zone||timestamptz
public|customers|created_at|33|now()|NO|timestamp with time zone||timestamptz
public|customers|updated_at|34|now()|NO|timestamp with time zone||timestamptz
public|customers|total_users|35|0|NO|integer||int4
public|customers|total_assets|36|0|NO|integer||int4
public|global_settings|id|1|uuid_generate_v4()|NO|uuid||uuid
public|global_settings|scope|2|'global'::character varying|NO|character varying|40|varchar
public|global_settings|platform_name|3||NO|character varying|255|varchar
public|global_settings|maintenance_mode|4|false|NO|boolean||bool
public|global_settings|public_signup|5|false|NO|boolean||bool
public|global_settings|default_trial_days|6|14|NO|integer||int4
public|global_settings|support_email|7||NO|character varying|320|varchar
public|global_settings|metadata|8|'{}'::jsonb|NO|jsonb||jsonb
public|global_settings|created_at|9|now()|NO|timestamp with time zone||timestamptz
public|global_settings|updated_at|10|now()|NO|timestamp with time zone||timestamptz
public|instance_metrics|id|1|uuid_generate_v4()|NO|uuid||uuid
public|instance_metrics|instance_id|2||NO|uuid||uuid
public|instance_metrics|recorded_at|3|now()|NO|timestamp with time zone||timestamptz
public|instance_metrics|active_users|4||YES|integer||int4
public|instance_metrics|total_users|5||YES|integer||int4
public|instance_metrics|total_assets|6||YES|integer||int4
public|instance_metrics|api_requests_1h|7||YES|integer||int4
public|instance_metrics|db_connections|8||YES|integer||int4
public|instance_metrics|storage_bytes|9||YES|bigint||int8
public|instance_metrics|avg_response_time_ms|10||YES|numeric||numeric
public|instance_metrics|p95_response_time_ms|11||YES|numeric||numeric
public|instance_metrics|p99_response_time_ms|12||YES|numeric||numeric
public|instance_metrics|error_rate|13||YES|numeric||numeric
public|instance_metrics|cpu_percent|14||YES|numeric||numeric
public|instance_metrics|memory_percent|15||YES|numeric||numeric
public|instance_metrics|disk_percent|16||YES|numeric||numeric
public|instance_metrics|network_io_bytes|17||YES|bigint||int8
public|instance_metrics|db_size_bytes|18||YES|bigint||int8
public|instance_metrics|db_queries_1h|19||YES|integer||int4
public|instance_metrics|slow_queries_1h|20||YES|integer||int4
public|instances|id|1|uuid_generate_v4()|NO|uuid||uuid
public|instances|customer_id|2||NO|uuid||uuid
public|instances|environment|3||NO|character varying|20|varchar
public|instances|status|4|'pending'::character varying|NO|character varying|20|varchar
public|instances|health|5|'unknown'::character varying|NO|character varying|20|varchar
public|instances|domain|6||YES|character varying|255|varchar
public|instances|custom_domain|7||YES|character varying|255|varchar
public|instances|ssl_status|8||YES|character varying|50|varchar
public|instances|region|9||NO|character varying|50|varchar
public|instances|version|10||NO|character varying|50|varchar
public|instances|resource_tier|11|'standard'::character varying|NO|character varying|20|varchar
public|instances|database_name|12||NO|character varying|100|varchar
public|instances|database_host|13||YES|character varying|255|varchar
public|instances|database_port|14|5432|NO|integer||int4
public|instances|k8s_namespace|15||YES|character varying|100|varchar
public|instances|k8s_cluster|16||YES|character varying|100|varchar
public|instances|terraform_workspace|17||YES|character varying|100|varchar
public|instances|last_health_check|18||YES|timestamp with time zone||timestamptz
public|instances|health_details|19|'{}'::jsonb|NO|jsonb||jsonb
public|instances|resource_metrics|20|'{}'::jsonb|NO|jsonb||jsonb
public|instances|provisioning_started_at|21||YES|timestamp with time zone||timestamptz
public|instances|provisioning_completed_at|22||YES|timestamp with time zone||timestamptz
public|instances|last_deployed_at|23||YES|timestamp with time zone||timestamptz
public|instances|last_deployed_version|24||YES|character varying|50|varchar
public|instances|error_message|25||YES|text||text
public|instances|config|26|'{}'::jsonb|NO|jsonb||jsonb
public|instances|feature_flags|27|'[]'::jsonb|NO|jsonb||jsonb
public|instances|metadata|28|'{}'::jsonb|NO|jsonb||jsonb
public|instances|maintenance_window|29||YES|character varying|100|varchar
public|instances|next_maintenance|30||YES|timestamp with time zone||timestamptz
public|instances|backup_retention_days|31|30|NO|integer||int4
public|instances|last_backup_at|32||YES|timestamp with time zone||timestamptz
public|instances|created_by|33||YES|uuid||uuid
public|instances|updated_by|34||YES|uuid||uuid
public|instances|deleted_at|35||YES|timestamp with time zone||timestamptz
public|instances|created_at|36|now()|NO|timestamp with time zone||timestamptz
public|instances|updated_at|37|now()|NO|timestamp with time zone||timestamptz
public|instances|gpu_enabled|38|false|NO|boolean||bool
public|instances|gpu_instance_type|39||YES|character varying|50|varchar
public|instances|huggingface_token|40||YES|character varying|500|varchar
public|instances|vllm_model|41||YES|character varying|200|varchar
public|licenses|id|1|uuid_generate_v4()|NO|uuid||uuid
public|licenses|customer_id|2||NO|uuid||uuid
public|licenses|instance_id|3||YES|uuid||uuid
public|licenses|license_key|4||NO|character varying|500|varchar
public|licenses|license_type|5||NO|character varying|50|varchar
public|licenses|status|6|'active'::character varying|NO|character varying|20|varchar
public|licenses|features|7|'[]'::jsonb|NO|jsonb||jsonb
public|licenses|max_users|8||YES|integer||int4
public|licenses|max_assets|9||YES|integer||int4
public|licenses|signature|10||YES|character varying|500|varchar
public|licenses|metadata|11|'{}'::jsonb|NO|jsonb||jsonb
public|licenses|created_by|12||YES|uuid||uuid
public|licenses|issued_at|13|now()|NO|timestamp with time zone||timestamptz
public|licenses|expires_at|14||YES|timestamp with time zone||timestamptz
public|licenses|revoked_at|15||YES|timestamp with time zone||timestamptz
public|licenses|revoked_by|16||YES|uuid||uuid
public|licenses|revoke_reason|17||YES|text||text
public|licenses|created_at|18|now()|NO|timestamp with time zone||timestamptz
public|migrations|id|1|nextval('migrations_id_seq'::regclass)|NO|integer||int4
public|migrations|timestamp|2||NO|bigint||int8
public|migrations|name|3||NO|character varying||varchar
public|pack_registry|id|1|uuid_generate_v4()|NO|uuid||uuid
public|pack_registry|code|2||NO|character varying|200|varchar
public|pack_registry|name|3||NO|character varying|255|varchar
public|pack_registry|description|4||YES|text||text
public|pack_registry|publisher|5||NO|character varying|120|varchar
public|pack_registry|license|6||YES|character varying|120|varchar
public|pack_registry|metadata|7|'{}'::jsonb|NO|jsonb||jsonb
public|pack_registry|created_by|8||YES|uuid||uuid
public|pack_registry|updated_by|9||YES|uuid||uuid
public|pack_registry|created_at|10|now()|NO|timestamp with time zone||timestamptz
public|pack_registry|updated_at|11|now()|NO|timestamp with time zone||timestamptz
public|pack_releases|id|1|uuid_generate_v4()|NO|uuid||uuid
public|pack_releases|pack_id|2||NO|uuid||uuid
public|pack_releases|release_id|3||NO|character varying|50|varchar
public|pack_releases|manifest_revision|4|1|NO|integer||int4
public|pack_releases|manifest|5||NO|jsonb||jsonb
public|pack_releases|dependencies|6||YES|jsonb||jsonb
public|pack_releases|compatibility|7||YES|jsonb||jsonb
public|pack_releases|assets|8||NO|jsonb||jsonb
public|pack_releases|artifact_bucket|9||NO|character varying|255|varchar
public|pack_releases|artifact_key|10||NO|character varying|500|varchar
public|pack_releases|artifact_sha256|11||NO|character varying|64|varchar
public|pack_releases|signature|12||NO|text||text
public|pack_releases|signature_key_id|13||NO|character varying|200|varchar
public|pack_releases|is_active|14|true|NO|boolean||bool
public|pack_releases|created_by|15||YES|uuid||uuid
public|pack_releases|created_at|16|now()|NO|timestamp with time zone||timestamptz
public|pack_releases|is_installable_by_client|17|false|NO|boolean||bool
public|refresh_tokens|id|1|uuid_generate_v4()|NO|uuid||uuid
public|refresh_tokens|token_hash|2||NO|character varying|128|varchar
public|refresh_tokens|family|3||NO|uuid||uuid
public|refresh_tokens|user_id|4||NO|uuid||uuid
public|refresh_tokens|issued_at|5|now()|NO|timestamp with time zone||timestamptz
public|refresh_tokens|expires_at|6||NO|timestamp with time zone||timestamptz
public|refresh_tokens|revoked_at|7||YES|timestamp with time zone||timestamptz
public|refresh_tokens|revoke_reason|8||YES|character varying|64|varchar
public|refresh_tokens|replaced_by|9||YES|uuid||uuid
public|refresh_tokens|ip_address|10||YES|character varying|45|varchar
public|refresh_tokens|user_agent|11||YES|text||text
public|revoked_tokens|id|1|uuid_generate_v4()|NO|uuid||uuid
public|revoked_tokens|jti|2||NO|character varying|64|varchar
public|revoked_tokens|user_id|3||NO|uuid||uuid
public|revoked_tokens|expires_at|4||NO|timestamp with time zone||timestamptz
public|revoked_tokens|revoked_at|5|now()|NO|timestamp with time zone||timestamptz
public|revoked_tokens|ip_address|6||YES|character varying|45|varchar
public|revoked_tokens|user_agent|7||YES|text||text
public|subscriptions|id|1|uuid_generate_v4()|NO|uuid||uuid
public|subscriptions|customer_id|2||NO|uuid||uuid
public|subscriptions|plan_id|3||NO|character varying|50|varchar
public|subscriptions|plan_name|4||NO|character varying|100|varchar
public|subscriptions|status|5|'active'::character varying|NO|character varying|20|varchar
public|subscriptions|amount|6||NO|numeric||numeric
public|subscriptions|currency|7|'USD'::character varying|NO|character varying|3|varchar
public|subscriptions|billing_cycle|8|'monthly'::character varying|NO|character varying|20|varchar
public|subscriptions|discount_percent|9|0|NO|numeric||numeric
public|subscriptions|current_period_start|10||YES|timestamp with time zone||timestamptz
public|subscriptions|current_period_end|11||YES|timestamp with time zone||timestamptz
public|subscriptions|trial_end|12||YES|timestamp with time zone||timestamptz
public|subscriptions|cancelled_at|13||YES|timestamp with time zone||timestamptz
public|subscriptions|cancel_at_period_end|14|false|NO|boolean||bool
public|subscriptions|stripe_subscription_id|15||YES|character varying|255|varchar
public|subscriptions|stripe_customer_id|16||YES|character varying|255|varchar
public|subscriptions|stripe_price_id|17||YES|character varying|255|varchar
public|subscriptions|metadata|18|'{}'::jsonb|NO|jsonb||jsonb
public|subscriptions|created_at|19|now()|NO|timestamp with time zone||timestamptz
public|subscriptions|updated_at|20|now()|NO|timestamp with time zone||timestamptz
public|terraform_jobs|id|1|uuid_generate_v4()|NO|uuid||uuid
public|terraform_jobs|instance_id|2||NO|uuid||uuid
public|terraform_jobs|customer_code|3||NO|character varying|50|varchar
public|terraform_jobs|environment|4||NO|character varying|50|varchar
public|terraform_jobs|operation|5||NO|character varying|50|varchar
public|terraform_jobs|status|6|'pending'::character varying|NO|character varying|50|varchar
public|terraform_jobs|workspace|7||YES|character varying|100|varchar
public|terraform_jobs|plan_output|8||YES|text||text
public|terraform_jobs|plan|9||YES|jsonb||jsonb
public|terraform_jobs|output_lines|10||YES|jsonb||jsonb
public|terraform_jobs|output|11|'[]'::jsonb|NO|jsonb||jsonb
public|terraform_jobs|error_message|12||YES|text||text
public|terraform_jobs|exit_code|13||YES|integer||int4
public|terraform_jobs|started_at|14||YES|timestamp with time zone||timestamptz
public|terraform_jobs|completed_at|15||YES|timestamp with time zone||timestamptz
public|terraform_jobs|cancelled_at|16||YES|timestamp with time zone||timestamptz
public|terraform_jobs|triggered_by|17||YES|uuid||uuid
public|terraform_jobs|cancelled_by|18||YES|uuid||uuid
public|terraform_jobs|duration|19||YES|integer||int4
public|terraform_jobs|created_at|20|now()|NO|timestamp with time zone||timestamptz
public|terraform_jobs|updated_at|21|now()|NO|timestamp with time zone||timestamptz

## Constraints
public|control_plane_audit_log|2200_17147_12_not_null|CHECK|details IS NOT NULL
public|control_plane_audit_log|2200_17147_16_not_null|CHECK|created_at IS NOT NULL
public|control_plane_audit_log|2200_17147_1_not_null|CHECK|id IS NOT NULL
public|control_plane_audit_log|2200_17147_5_not_null|CHECK|action IS NOT NULL
public|control_plane_audit_log|2200_17147_8_not_null|CHECK|result IS NOT NULL
public|control_plane_audit_log|control_plane_audit_log_pkey|PRIMARY KEY|id
public|control_plane_users|2200_17156_12_not_null|CHECK|failed_login_attempts IS NOT NULL
public|control_plane_users|2200_17156_19_not_null|CHECK|metadata IS NOT NULL
public|control_plane_users|2200_17156_1_not_null|CHECK|id IS NOT NULL
public|control_plane_users|2200_17156_20_not_null|CHECK|created_at IS NOT NULL
public|control_plane_users|2200_17156_21_not_null|CHECK|updated_at IS NOT NULL
public|control_plane_users|2200_17156_2_not_null|CHECK|email IS NOT NULL
public|control_plane_users|2200_17156_3_not_null|CHECK|display_name IS NOT NULL
public|control_plane_users|2200_17156_7_not_null|CHECK|role IS NOT NULL
public|control_plane_users|2200_17156_8_not_null|CHECK|status IS NOT NULL
public|control_plane_users|2200_17156_9_not_null|CHECK|mfa_enabled IS NOT NULL
public|control_plane_users|control_plane_users_pkey|PRIMARY KEY|id
public|customers|2200_17169_10_not_null|CHECK|mrr IS NOT NULL
public|customers|2200_17169_1_not_null|CHECK|id IS NOT NULL
public|customers|2200_17169_25_not_null|CHECK|max_instances IS NOT NULL
public|customers|2200_17169_26_not_null|CHECK|settings IS NOT NULL
public|customers|2200_17169_27_not_null|CHECK|feature_flags IS NOT NULL
public|customers|2200_17169_28_not_null|CHECK|metadata IS NOT NULL
public|customers|2200_17169_2_not_null|CHECK|code IS NOT NULL
public|customers|2200_17169_33_not_null|CHECK|created_at IS NOT NULL
public|customers|2200_17169_34_not_null|CHECK|updated_at IS NOT NULL
public|customers|2200_17169_35_not_null|CHECK|total_users IS NOT NULL
public|customers|2200_17169_36_not_null|CHECK|total_assets IS NOT NULL
public|customers|2200_17169_3_not_null|CHECK|name IS NOT NULL
public|customers|2200_17169_4_not_null|CHECK|status IS NOT NULL
public|customers|2200_17169_5_not_null|CHECK|tier IS NOT NULL
public|customers|2200_17169_9_not_null|CHECK|currency IS NOT NULL
public|customers|customers_pkey|PRIMARY KEY|id
public|global_settings|2200_17187_10_not_null|CHECK|updated_at IS NOT NULL
public|global_settings|2200_17187_1_not_null|CHECK|id IS NOT NULL
public|global_settings|2200_17187_2_not_null|CHECK|scope IS NOT NULL
public|global_settings|2200_17187_3_not_null|CHECK|platform_name IS NOT NULL
public|global_settings|2200_17187_4_not_null|CHECK|maintenance_mode IS NOT NULL
public|global_settings|2200_17187_5_not_null|CHECK|public_signup IS NOT NULL
public|global_settings|2200_17187_6_not_null|CHECK|default_trial_days IS NOT NULL
public|global_settings|2200_17187_7_not_null|CHECK|support_email IS NOT NULL
public|global_settings|2200_17187_8_not_null|CHECK|metadata IS NOT NULL
public|global_settings|2200_17187_9_not_null|CHECK|created_at IS NOT NULL
public|global_settings|global_settings_pkey|PRIMARY KEY|id
public|instance_metrics|2200_17200_1_not_null|CHECK|id IS NOT NULL
public|instance_metrics|2200_17200_2_not_null|CHECK|instance_id IS NOT NULL
public|instance_metrics|2200_17200_3_not_null|CHECK|recorded_at IS NOT NULL
public|instance_metrics|instance_metrics_pkey|PRIMARY KEY|id
public|instances|2200_17205_10_not_null|CHECK|version IS NOT NULL
public|instances|2200_17205_11_not_null|CHECK|resource_tier IS NOT NULL
public|instances|2200_17205_12_not_null|CHECK|database_name IS NOT NULL
public|instances|2200_17205_14_not_null|CHECK|database_port IS NOT NULL
public|instances|2200_17205_19_not_null|CHECK|health_details IS NOT NULL
public|instances|2200_17205_1_not_null|CHECK|id IS NOT NULL
public|instances|2200_17205_20_not_null|CHECK|resource_metrics IS NOT NULL
public|instances|2200_17205_26_not_null|CHECK|config IS NOT NULL
public|instances|2200_17205_27_not_null|CHECK|feature_flags IS NOT NULL
public|instances|2200_17205_28_not_null|CHECK|metadata IS NOT NULL
public|instances|2200_17205_2_not_null|CHECK|customer_id IS NOT NULL
public|instances|2200_17205_31_not_null|CHECK|backup_retention_days IS NOT NULL
public|instances|2200_17205_36_not_null|CHECK|created_at IS NOT NULL
public|instances|2200_17205_37_not_null|CHECK|updated_at IS NOT NULL
public|instances|2200_17205_38_not_null|CHECK|gpu_enabled IS NOT NULL
public|instances|2200_17205_3_not_null|CHECK|environment IS NOT NULL
public|instances|2200_17205_4_not_null|CHECK|status IS NOT NULL
public|instances|2200_17205_5_not_null|CHECK|health IS NOT NULL
public|instances|2200_17205_9_not_null|CHECK|region IS NOT NULL
public|instances|instances_pkey|PRIMARY KEY|id
public|instances|instances_resource_tier_check|CHECK|(((resource_tier)::text = ANY (ARRAY[('standard'::character var
public|licenses|2200_17225_11_not_null|CHECK|metadata IS NOT NULL
public|licenses|2200_17225_13_not_null|CHECK|issued_at IS NOT NULL
public|licenses|2200_17225_18_not_null|CHECK|created_at IS NOT NULL
public|licenses|2200_17225_1_not_null|CHECK|id IS NOT NULL
public|licenses|2200_17225_2_not_null|CHECK|customer_id IS NOT NULL
public|licenses|2200_17225_4_not_null|CHECK|license_key IS NOT NULL
public|licenses|2200_17225_5_not_null|CHECK|license_type IS NOT NULL
public|licenses|2200_17225_6_not_null|CHECK|status IS NOT NULL
public|licenses|2200_17225_7_not_null|CHECK|features IS NOT NULL
public|licenses|licenses_pkey|PRIMARY KEY|id
public|migrations|2200_17139_1_not_null|CHECK|id IS NOT NULL
public|migrations|2200_17139_2_not_null|CHECK|timestamp IS NOT NULL
public|migrations|2200_17139_3_not_null|CHECK|name IS NOT NULL
public|migrations|PK_8c82d7f526340ab734260ea46be|PRIMARY KEY|id
public|pack_registry|2200_17236_10_not_null|CHECK|created_at IS NOT NULL
public|pack_registry|2200_17236_11_not_null|CHECK|updated_at IS NOT NULL
public|pack_registry|2200_17236_1_not_null|CHECK|id IS NOT NULL
public|pack_registry|2200_17236_2_not_null|CHECK|code IS NOT NULL
public|pack_registry|2200_17236_3_not_null|CHECK|name IS NOT NULL
public|pack_registry|2200_17236_5_not_null|CHECK|publisher IS NOT NULL
public|pack_registry|2200_17236_7_not_null|CHECK|metadata IS NOT NULL
public|pack_registry|pack_registry_pkey|PRIMARY KEY|id
public|pack_registry|uq_pack_registry_code|UNIQUE|code
public|pack_releases|2200_17245_10_not_null|CHECK|artifact_key IS NOT NULL
public|pack_releases|2200_17245_11_not_null|CHECK|artifact_sha256 IS NOT NULL
public|pack_releases|2200_17245_12_not_null|CHECK|signature IS NOT NULL
public|pack_releases|2200_17245_13_not_null|CHECK|signature_key_id IS NOT NULL
public|pack_releases|2200_17245_14_not_null|CHECK|is_active IS NOT NULL
public|pack_releases|2200_17245_16_not_null|CHECK|created_at IS NOT NULL
public|pack_releases|2200_17245_17_not_null|CHECK|is_installable_by_client IS NOT NULL
public|pack_releases|2200_17245_1_not_null|CHECK|id IS NOT NULL
public|pack_releases|2200_17245_2_not_null|CHECK|pack_id IS NOT NULL
public|pack_releases|2200_17245_3_not_null|CHECK|release_id IS NOT NULL
public|pack_releases|2200_17245_4_not_null|CHECK|manifest_revision IS NOT NULL
public|pack_releases|2200_17245_5_not_null|CHECK|manifest IS NOT NULL
public|pack_releases|2200_17245_8_not_null|CHECK|assets IS NOT NULL
public|pack_releases|2200_17245_9_not_null|CHECK|artifact_bucket IS NOT NULL
public|pack_releases|chk_pack_release_id_format|CHECK|(((release_id)::text ~ '^[0-9]{8}.[0-9]{3,}$'::text))
public|pack_releases|chk_pack_release_sha256|CHECK|(((artifact_sha256)::text ~ '^[a-f0-9]{64}$'::text))
public|pack_releases|pack_releases_pkey|PRIMARY KEY|id
public|pack_releases|uq_pack_releases_pack_release|UNIQUE|pack_id
public|pack_releases|uq_pack_releases_pack_release|UNIQUE|release_id
public|refresh_tokens|2200_17257_1_not_null|CHECK|id IS NOT NULL
public|refresh_tokens|2200_17257_2_not_null|CHECK|token_hash IS NOT NULL
public|refresh_tokens|2200_17257_3_not_null|CHECK|family IS NOT NULL
public|refresh_tokens|2200_17257_4_not_null|CHECK|user_id IS NOT NULL
public|refresh_tokens|2200_17257_5_not_null|CHECK|issued_at IS NOT NULL
public|refresh_tokens|2200_17257_6_not_null|CHECK|expires_at IS NOT NULL
public|refresh_tokens|refresh_tokens_pkey|PRIMARY KEY|id
public|revoked_tokens|2200_17264_1_not_null|CHECK|id IS NOT NULL
public|revoked_tokens|2200_17264_2_not_null|CHECK|jti IS NOT NULL
public|revoked_tokens|2200_17264_3_not_null|CHECK|user_id IS NOT NULL
public|revoked_tokens|2200_17264_4_not_null|CHECK|expires_at IS NOT NULL
public|revoked_tokens|2200_17264_5_not_null|CHECK|revoked_at IS NOT NULL
public|revoked_tokens|revoked_tokens_pkey|PRIMARY KEY|id
public|subscriptions|2200_17271_14_not_null|CHECK|cancel_at_period_end IS NOT NULL
public|subscriptions|2200_17271_18_not_null|CHECK|metadata IS NOT NULL
public|subscriptions|2200_17271_19_not_null|CHECK|created_at IS NOT NULL
public|subscriptions|2200_17271_1_not_null|CHECK|id IS NOT NULL
public|subscriptions|2200_17271_20_not_null|CHECK|updated_at IS NOT NULL
public|subscriptions|2200_17271_2_not_null|CHECK|customer_id IS NOT NULL
public|subscriptions|2200_17271_3_not_null|CHECK|plan_id IS NOT NULL
public|subscriptions|2200_17271_4_not_null|CHECK|plan_name IS NOT NULL
public|subscriptions|2200_17271_5_not_null|CHECK|status IS NOT NULL
public|subscriptions|2200_17271_6_not_null|CHECK|amount IS NOT NULL
public|subscriptions|2200_17271_7_not_null|CHECK|currency IS NOT NULL
public|subscriptions|2200_17271_8_not_null|CHECK|billing_cycle IS NOT NULL
public|subscriptions|2200_17271_9_not_null|CHECK|discount_percent IS NOT NULL
public|subscriptions|subscriptions_pkey|PRIMARY KEY|id
public|terraform_jobs|2200_17285_11_not_null|CHECK|output IS NOT NULL
public|terraform_jobs|2200_17285_1_not_null|CHECK|id IS NOT NULL
public|terraform_jobs|2200_17285_20_not_null|CHECK|created_at IS NOT NULL
public|terraform_jobs|2200_17285_21_not_null|CHECK|updated_at IS NOT NULL
public|terraform_jobs|2200_17285_2_not_null|CHECK|instance_id IS NOT NULL
public|terraform_jobs|2200_17285_3_not_null|CHECK|customer_code IS NOT NULL
public|terraform_jobs|2200_17285_4_not_null|CHECK|environment IS NOT NULL
public|terraform_jobs|2200_17285_5_not_null|CHECK|operation IS NOT NULL
public|terraform_jobs|2200_17285_6_not_null|CHECK|status IS NOT NULL
public|terraform_jobs|terraform_jobs_pkey|PRIMARY KEY|id

## Foreign Keys
public|instance_metrics|instance_id|instance_metrics_instance_id_fkey|public|instances|id|NO ACTION|CASCADE
public|instances|customer_id|instances_customer_id_fkey|public|customers|id|NO ACTION|NO ACTION
public|licenses|customer_id|licenses_customer_id_fkey|public|customers|id|NO ACTION|NO ACTION
public|licenses|instance_id|licenses_instance_id_fkey|public|instances|id|NO ACTION|NO ACTION
public|pack_registry|created_by|fk_pack_registry_created_by|public|control_plane_users|id|NO ACTION|SET NULL
public|pack_registry|updated_by|fk_pack_registry_updated_by|public|control_plane_users|id|NO ACTION|SET NULL
public|pack_releases|created_by|fk_pack_releases_created_by|public|control_plane_users|id|NO ACTION|SET NULL
public|pack_releases|pack_id|pack_releases_pack_id_fkey|public|pack_registry|id|NO ACTION|CASCADE
public|subscriptions|customer_id|subscriptions_customer_id_fkey|public|customers|id|NO ACTION|NO ACTION
public|terraform_jobs|instance_id|terraform_jobs_instance_id_fkey|public|instances|id|NO ACTION|CASCADE

## Indexes
public|control_plane_audit_log|control_plane_audit_log_pkey|CREATE UNIQUE INDEX control_plane_audit_log_pkey ON public.control_plane_audit_log USING btree (id)
public|control_plane_audit_log|idx_audit_action|CREATE INDEX idx_audit_action ON public.control_plane_audit_log USING btree (action)
public|control_plane_audit_log|idx_audit_created_at|CREATE INDEX idx_audit_created_at ON public.control_plane_audit_log USING btree (created_at)
public|control_plane_audit_log|idx_audit_customer_id|CREATE INDEX idx_audit_customer_id ON public.control_plane_audit_log USING btree (customer_id)
public|control_plane_audit_log|idx_audit_instance_id|CREATE INDEX idx_audit_instance_id ON public.control_plane_audit_log USING btree (instance_id)
public|control_plane_audit_log|idx_audit_user_id|CREATE INDEX idx_audit_user_id ON public.control_plane_audit_log USING btree (user_id)
public|control_plane_users|control_plane_users_pkey|CREATE UNIQUE INDEX control_plane_users_pkey ON public.control_plane_users USING btree (id)
public|control_plane_users|idx_control_plane_users_email|CREATE UNIQUE INDEX idx_control_plane_users_email ON public.control_plane_users USING btree (email)
public|control_plane_users|idx_control_plane_users_role|CREATE INDEX idx_control_plane_users_role ON public.control_plane_users USING btree (role)
public|control_plane_users|idx_control_plane_users_status|CREATE INDEX idx_control_plane_users_status ON public.control_plane_users USING btree (status)
public|customers|customers_pkey|CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id)
public|customers|idx_customers_code|CREATE UNIQUE INDEX idx_customers_code ON public.customers USING btree (code)
public|customers|idx_customers_status|CREATE INDEX idx_customers_status ON public.customers USING btree (status)
public|customers|idx_customers_tier|CREATE INDEX idx_customers_tier ON public.customers USING btree (tier)
public|global_settings|global_settings_pkey|CREATE UNIQUE INDEX global_settings_pkey ON public.global_settings USING btree (id)
public|global_settings|idx_global_settings_scope|CREATE UNIQUE INDEX idx_global_settings_scope ON public.global_settings USING btree (scope)
public|instance_metrics|idx_instance_metrics_instance_recorded|CREATE INDEX idx_instance_metrics_instance_recorded ON public.instance_metrics USING btree (instance_id, recorded_at)
public|instance_metrics|idx_instance_metrics_recorded_at|CREATE INDEX idx_instance_metrics_recorded_at ON public.instance_metrics USING btree (recorded_at)
public|instance_metrics|instance_metrics_pkey|CREATE UNIQUE INDEX instance_metrics_pkey ON public.instance_metrics USING btree (id)
public|instances|idx_instances_customer_env_unique|CREATE UNIQUE INDEX idx_instances_customer_env_unique ON public.instances USING btree (customer_id, environment)
public|instances|idx_instances_customer_id|CREATE INDEX idx_instances_customer_id ON public.instances USING btree (customer_id)
public|instances|idx_instances_domain_unique|CREATE UNIQUE INDEX idx_instances_domain_unique ON public.instances USING btree (domain) WHERE (domain IS NOT NULL)
public|instances|idx_instances_environment|CREATE INDEX idx_instances_environment ON public.instances USING btree (environment)
public|instances|idx_instances_health|CREATE INDEX idx_instances_health ON public.instances USING btree (health)
public|instances|idx_instances_region|CREATE INDEX idx_instances_region ON public.instances USING btree (region)
public|instances|idx_instances_status|CREATE INDEX idx_instances_status ON public.instances USING btree (status)
public|instances|instances_pkey|CREATE UNIQUE INDEX instances_pkey ON public.instances USING btree (id)
public|licenses|idx_licenses_customer_id|CREATE INDEX idx_licenses_customer_id ON public.licenses USING btree (customer_id)
public|licenses|idx_licenses_expires_at|CREATE INDEX idx_licenses_expires_at ON public.licenses USING btree (expires_at)
public|licenses|idx_licenses_instance_id|CREATE INDEX idx_licenses_instance_id ON public.licenses USING btree (instance_id)
public|licenses|idx_licenses_license_key|CREATE UNIQUE INDEX idx_licenses_license_key ON public.licenses USING btree (license_key)
public|licenses|idx_licenses_status|CREATE INDEX idx_licenses_status ON public.licenses USING btree (status)
public|licenses|licenses_pkey|CREATE UNIQUE INDEX licenses_pkey ON public.licenses USING btree (id)
public|migrations|PK_8c82d7f526340ab734260ea46be|CREATE UNIQUE INDEX "PK_8c82d7f526340ab734260ea46be" ON public.migrations USING btree (id)
public|pack_registry|idx_pack_registry_publisher|CREATE INDEX idx_pack_registry_publisher ON public.pack_registry USING btree (publisher)
public|pack_registry|pack_registry_pkey|CREATE UNIQUE INDEX pack_registry_pkey ON public.pack_registry USING btree (id)
public|pack_registry|uq_pack_registry_code|CREATE UNIQUE INDEX uq_pack_registry_code ON public.pack_registry USING btree (code)
public|pack_releases|idx_pack_releases_active|CREATE INDEX idx_pack_releases_active ON public.pack_releases USING btree (is_active)
public|pack_releases|idx_pack_releases_installable|CREATE INDEX idx_pack_releases_installable ON public.pack_releases USING btree (is_installable_by_client)
public|pack_releases|idx_pack_releases_pack_id|CREATE INDEX idx_pack_releases_pack_id ON public.pack_releases USING btree (pack_id)
public|pack_releases|idx_pack_releases_release_id|CREATE INDEX idx_pack_releases_release_id ON public.pack_releases USING btree (release_id)
public|pack_releases|pack_releases_pkey|CREATE UNIQUE INDEX pack_releases_pkey ON public.pack_releases USING btree (id)
public|pack_releases|uq_pack_releases_pack_release|CREATE UNIQUE INDEX uq_pack_releases_pack_release ON public.pack_releases USING btree (pack_id, release_id)
public|refresh_tokens|idx_refresh_tokens_expires_at|CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at)
public|refresh_tokens|idx_refresh_tokens_family|CREATE INDEX idx_refresh_tokens_family ON public.refresh_tokens USING btree (family)
public|refresh_tokens|idx_refresh_tokens_token_hash|CREATE UNIQUE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash)
public|refresh_tokens|idx_refresh_tokens_user_id|CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id)
public|refresh_tokens|refresh_tokens_pkey|CREATE UNIQUE INDEX refresh_tokens_pkey ON public.refresh_tokens USING btree (id)
public|revoked_tokens|idx_revoked_tokens_expires_at|CREATE INDEX idx_revoked_tokens_expires_at ON public.revoked_tokens USING btree (expires_at)
public|revoked_tokens|idx_revoked_tokens_jti|CREATE UNIQUE INDEX idx_revoked_tokens_jti ON public.revoked_tokens USING btree (jti)
public|revoked_tokens|revoked_tokens_pkey|CREATE UNIQUE INDEX revoked_tokens_pkey ON public.revoked_tokens USING btree (id)
public|subscriptions|idx_subscriptions_customer_id|CREATE INDEX idx_subscriptions_customer_id ON public.subscriptions USING btree (customer_id)
public|subscriptions|idx_subscriptions_status|CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status)
public|subscriptions|idx_subscriptions_stripe_id|CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions USING btree (stripe_subscription_id)
public|subscriptions|subscriptions_pkey|CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id)
public|terraform_jobs|idx_terraform_jobs_customer_created|CREATE INDEX idx_terraform_jobs_customer_created ON public.terraform_jobs USING btree (customer_code, created_at)
public|terraform_jobs|idx_terraform_jobs_instance_created|CREATE INDEX idx_terraform_jobs_instance_created ON public.terraform_jobs USING btree (instance_id, created_at)
public|terraform_jobs|idx_terraform_jobs_status|CREATE INDEX idx_terraform_jobs_status ON public.terraform_jobs USING btree (status)
public|terraform_jobs|terraform_jobs_pkey|CREATE UNIQUE INDEX terraform_jobs_pkey ON public.terraform_jobs USING btree (id)
