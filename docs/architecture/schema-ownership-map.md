# Schema Ownership Map

_Generated_ from `tools/scanners/entity-schema-manifest.json` + `tools/scanners/cross-domain-allowlist.json`. **Do not edit by hand.** Regenerate with `npx tsx tools/scanners/generate-schema-ownership-map.ts`.

## Instance plane — Domain schemas

`apps/api` reads from the customer-instance DB. Each domain has its own schema (canon §17 modular monolith).

### `notify`

- `notify.device_tokens`
- `notify.in_app_notifications`
- `notify.notification_history`
- `notify.notification_queue`
- `notify.notification_templates`
- `notify.user_notification_preferences`

### `insights`

- `insights.aggregated_metrics`
- `insights.alert_definitions`
- `insights.analytics_events`
- `insights.dashboard_definitions`
- `insights.metric_definitions`
- `insights.metric_points`
- `insights.reports`

### `ava`

- `ava.ava_anomalies`
- `ava.ava_audit_trail`
- `ava.ava_cards`
- `ava.ava_contexts`
- `ava.ava_conversations`
- `ava.ava_feedback`
- `ava.ava_global_settings`
- `ava.ava_intents`
- `ava.ava_knowledge_embeddings`
- `ava.ava_messages`
- `ava.ava_permission_configs`
- `ava.ava_predictions`
- `ava.ava_prompt_policies`
- `ava.ava_proposal`
- `ava.ava_suggestions`
- `ava.ava_tools`
- `ava.ava_topics`
- `ava.ava_usage_metrics`
- `ava.dataset_definitions`
- `ava.dataset_snapshots`
- `ava.model_artifacts`
- `ava.model_deployments`
- `ava.model_evaluations`
- `ava.model_training_jobs`

### `automation`

- `automation.approvals`
- `automation.automation_execution_logs`
- `automation.automation_rule_revisions`
- `automation.automation_rules`
- `automation.business_hours`
- `automation.client_scripts`
- `automation.connectors`
- `automation.cross_domain_read_diff`
- `automation.decision_inputs`
- `automation.decision_rows`
- `automation.decision_table_revisions`
- `automation.decision_tables`
- `automation.guided_process_activities`
- `automation.guided_process_revisions`
- `automation.guided_process_stages`
- `automation.guided_processes`
- `automation.process_flow_definition_revisions`
- `automation.process_flow_definitions`
- `automation.process_flow_execution_history`
- `automation.process_flow_instances`
- `automation.scheduled_jobs`
- `automation.sla_breaches`
- `automation.sla_definitions`
- `automation.sla_instances`
- `automation.state_change_history`
- `automation.state_machine_definitions`

### `integrations`

- `integrations.api_keys`
- `integrations.api_request_logs`
- `integrations.connector_connections`
- `integrations.export_jobs`
- `integrations.external_connectors`
- `integrations.import_jobs`
- `integrations.oauth_access_tokens`
- `integrations.oauth_authorization_codes`
- `integrations.oauth_clients`
- `integrations.oauth_refresh_tokens`
- `integrations.property_mappings`
- `integrations.sync_configurations`
- `integrations.sync_runs`
- `integrations.webhook_deliveries`
- `integrations.webhook_subscriptions`

### `identity`

- `identity.auth_events`
- `identity.auth_settings`
- `identity.behavioral_profiles`
- `identity.delegations`
- `identity.email_verification_tokens`
- `identity.group_members`
- `identity.group_roles`
- `identity.groups`
- `identity.impersonation_sessions`
- `identity.ldap_configs`
- `identity.login_attempts`
- `identity.magic_link_tokens`
- `identity.mfa_methods`
- `identity.nav_profile_items`
- `identity.nav_profiles`
- `identity.password_history`
- `identity.password_policies`
- `identity.password_reset_tokens`
- `identity.permissions`
- `identity.refresh_tokens`
- `identity.role_permissions`
- `identity.roles`
- `identity.saml_auth_states`
- `identity.security_alerts`
- `identity.service_accounts`
- `identity.service_token_signing_keys`
- `identity.sso_providers`
- `identity.trusted_devices`
- `identity.user_invitations`
- `identity.user_roles`
- `identity.webauthn_challenges`
- `identity.webauthn_credentials`

### `app_builder`

- `app_builder.ai_report_templates`
- `app_builder.ai_reports`
- `app_builder.app_builder_components`
- `app_builder.ava_stories`
- `app_builder.customization_registry`
- `app_builder.digital_twins`
- `app_builder.documentation_versions`
- `app_builder.generated_documentation`
- `app_builder.insight_analysis_jobs`
- `app_builder.nl_queries`
- `app_builder.predictive_insights`
- `app_builder.predictive_suggestions`
- `app_builder.recovery_actions`
- `app_builder.saved_nl_queries`
- `app_builder.self_healing_events`
- `app_builder.sensor_readings`
- `app_builder.service_health_status`
- `app_builder.sprint_recordings`
- `app_builder.story_implementations`
- `app_builder.upgrade_fixes`
- `app_builder.upgrade_impact_analyses`
- `app_builder.user_behaviors`
- `app_builder.user_patterns`
- `app_builder.voice_command_patterns`
- `app_builder.voice_commands`
- `app_builder.zero_code_app_versions`
- `app_builder.zero_code_apps`

### `metadata`

- `metadata.application_revisions`
- `metadata.applications`
- `metadata.change_packages`
- `metadata.choice_items`
- `metadata.choice_lists`
- `metadata.collection_constraints`
- `metadata.collection_definition_revisions`
- `metadata.collection_definitions`
- `metadata.collection_indexes`
- `metadata.dependent_review_queue`
- `metadata.display_rule_revisions`
- `metadata.display_rules`
- `metadata.form_definitions`
- `metadata.form_versions`
- `metadata.instance_branding`
- `metadata.locales`
- `metadata.localization_bundles`
- `metadata.module_security`
- `metadata.modules`
- `metadata.nav_nodes`
- `metadata.nav_patches`
- `metadata.navigation_module_revisions`
- `metadata.navigation_modules`
- `metadata.navigation_variants`
- `metadata.pack_install_locks`
- `metadata.pack_object_revisions`
- `metadata.pack_object_states`
- `metadata.pack_release_records`
- `metadata.property_definition_revisions`
- `metadata.property_definitions`
- `metadata.property_types`
- `metadata.schema_change_log`
- `metadata.schema_sync_state`
- `metadata.search_dictionaries`
- `metadata.search_experiences`
- `metadata.search_index_state`
- `metadata.search_sources`
- `metadata.theme_definitions`
- `metadata.translation_keys`
- `metadata.translation_requests`
- `metadata.translation_values`
- `metadata.user_theme_preferences`
- `metadata.view_definition_revisions`
- `metadata.view_definitions`
- `metadata.view_variants`
- `metadata.widget_catalog`
- `metadata.workspace_definitions`
- `metadata.workspace_pages`
- `metadata.workspace_variants`

## Instance plane — Public-schema exceptions

Tables intentionally kept in `public` on the instance DB (cross-domain shared or instance-wide singleton):

- `public.access_audit_logs`
- `public.access_condition_groups`
- `public.access_conditions`
- `public.access_rule_audit_logs`
- `public.audit_logs`
- `public.collection_access_rules`
- `public.computed_properties_overview`
- `public.config_change_history`
- `public.field_mappings`
- `public.formula_cache`
- `public.inline_editing_test`
- `public.instance_customizations`
- `public.instance_event_outbox`
- `public.instance_settings`
- `public.instance_upgrade_impact`
- `public.key_metadata`
- `public.migrations`
- `public.platform_config`
- `public.property_access_rules`
- `public.property_audit_logs`
- `public.property_dependencies`
- `public.recent_schema_changes`
- `public.runtime_anomaly`
- `public.schema_versions`
- `public.search_embeddings`
- `public.service_principals`
- `public.upgrade_history`
- `public.upgrade_manifest`
- `public.user_preferences`
- `public.user_sessions`
- `public.users`
- `public.view_configurations`

## Control plane — Schemas

`apps/control-plane` reads from a separate DB (canon §18 — traditional multi-tenant admin app, not subject to the instance schema split). All tables live in `public`.

### `controlPlane.public`

- `public.control_plane_audit_log`
- `public.control_plane_users`
- `public.customers`
- `public.global_settings`
- `public.instance_metrics`
- `public.instances`
- `public.key_metadata`
- `public.licenses`
- `public.pack_registry`
- `public.refresh_tokens`
- `public.revoked_tokens`
- `public.subscriptions`
- `public.terraform_jobs`

## Allowlisted cross-domain relations

| From | To | Rationale | Added by | Added at |
|---|---|---|---|---|
| `identity.web-authn-credential` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `app_builder.sprint-recording` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.application` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `identity.password-history` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `automation.automation-rule` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.change-package` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.collection-definition` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.collection-index` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `automation.connector` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `automation.decision-table` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.dependent-review-queue-entry` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.display-rule` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.form-definition` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `identity.group` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `automation.guided-process-definition` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.locale` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `ava.dataset-definition` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.navigation-module` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.pack-release-record` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `automation.process-flow-definition` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.property-definition` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `identity.role-permission` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `identity.role` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.search-experience` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `identity.auth-settings` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.theme-definition` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.view-definition` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `metadata.workspace-definition` | `public.user` | FK to public.users; users intentionally stays in public per the schema-split design — users are shared across all domains. | adi-hw | 2026-05-14 |
| `public.collection-access-rule` | `metadata.collection-definition` | Cross-domain reference to canonical metadata; collections/properties are the platform's metadata layer that automation, access-rule, and notification entities reference by FK. Refactoring out of scope for Prelude; W2 boundary-consistency wave addresses if a cleaner pattern is identified. | adi-hw | 2026-05-14 |
| `public.collection-access-rule` | `metadata.property-definition` | Cross-domain reference to canonical metadata; collections/properties are the platform's metadata layer that automation, access-rule, and notification entities reference by FK. Refactoring out of scope for Prelude; W2 boundary-consistency wave addresses if a cleaner pattern is identified. | adi-hw | 2026-05-14 |
| `automation.decision-table` | `metadata.collection-definition` | Cross-domain reference to canonical metadata; collections/properties are the platform's metadata layer that automation, access-rule, and notification entities reference by FK. Refactoring out of scope for Prelude; W2 boundary-consistency wave addresses if a cleaner pattern is identified. | adi-hw | 2026-05-14 |
| `automation.guided-process-definition` | `metadata.collection-definition` | Cross-domain reference to canonical metadata; collections/properties are the platform's metadata layer that automation, access-rule, and notification entities reference by FK. Refactoring out of scope for Prelude; W2 boundary-consistency wave addresses if a cleaner pattern is identified. | adi-hw | 2026-05-14 |
| `automation.process-flow-definition` | `metadata.collection-definition` | Cross-domain reference to canonical metadata; collections/properties are the platform's metadata layer that automation, access-rule, and notification entities reference by FK. Refactoring out of scope for Prelude; W2 boundary-consistency wave addresses if a cleaner pattern is identified. | adi-hw | 2026-05-14 |
| `automation.business-hours` | `metadata.collection-definition` | Cross-domain reference to canonical metadata; collections/properties are the platform's metadata layer that automation, access-rule, and notification entities reference by FK. Refactoring out of scope for Prelude; W2 boundary-consistency wave addresses if a cleaner pattern is identified. | adi-hw | 2026-05-14 |
| `notify.notification-template` | `metadata.collection-definition` | Cross-domain reference to canonical metadata; collections/properties are the platform's metadata layer that automation, access-rule, and notification entities reference by FK. Refactoring out of scope for Prelude; W2 boundary-consistency wave addresses if a cleaner pattern is identified. | adi-hw | 2026-05-14 |
| `public.collection-access-rule` | `identity.role` | Cross-domain reference to identity primitives (roles/groups/auth-settings); these are the platform's identity layer that access-rule, module, and navigation entities reference for authorization context. Refactoring out of scope for Prelude; W2 boundary-consistency wave reviews if cleaner separation is possible. | adi-hw | 2026-05-14 |
| `public.collection-access-rule` | `identity.group` | Cross-domain reference to identity primitives (roles/groups/auth-settings); these are the platform's identity layer that access-rule, module, and navigation entities reference for authorization context. Refactoring out of scope for Prelude; W2 boundary-consistency wave reviews if cleaner separation is possible. | adi-hw | 2026-05-14 |
| `metadata.module-entity` | `identity.role` | Cross-domain reference to identity primitives (roles/groups/auth-settings); these are the platform's identity layer that access-rule, module, and navigation entities reference for authorization context. Refactoring out of scope for Prelude; W2 boundary-consistency wave reviews if cleaner separation is possible. | adi-hw | 2026-05-14 |
| `metadata.nav-node` | `identity.auth-settings` | Cross-domain reference to identity primitives (roles/groups/auth-settings); these are the platform's identity layer that access-rule, module, and navigation entities reference for authorization context. Refactoring out of scope for Prelude; W2 boundary-consistency wave reviews if cleaner separation is possible. | adi-hw | 2026-05-14 |
