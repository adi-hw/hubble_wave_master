import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5: Integration & Data Management
 *
 * Creates tables for:
 * - API keys and OAuth2 clients
 * - Webhook subscriptions and delivery logs
 * - External connectors and connections
 * - Data import/export jobs
 * - Sync configurations and logs
 */
export class Phase5Integrations1805000000000 implements MigrationInterface {
  name = 'Phase5Integrations1805000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // API Keys
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(10) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        description TEXT,
        scopes JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        rate_limit_per_minute INTEGER DEFAULT 1000,
        allowed_ips JSONB DEFAULT '[]',
        expires_at TIMESTAMP WITH TIME ZONE,
        last_used_at TIMESTAMP WITH TIME ZONE,
        usage_count BIGINT DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        revoked_at TIMESTAMP WITH TIME ZONE,
        revoked_by UUID
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active)`);

    // ============================================================
    // OAuth2 Clients
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id VARCHAR(255) UNIQUE NOT NULL,
        client_secret_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        client_type VARCHAR(50) NOT NULL DEFAULT 'confidential',
        redirect_uris JSONB NOT NULL DEFAULT '[]',
        allowed_scopes JSONB NOT NULL DEFAULT '[]',
        allowed_grant_types JSONB NOT NULL DEFAULT '["authorization_code", "refresh_token"]',
        access_token_lifetime_seconds INTEGER DEFAULT 3600,
        refresh_token_lifetime_seconds INTEGER DEFAULT 2592000,
        require_pkce BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        logo_url TEXT,
        terms_url TEXT,
        privacy_url TEXT,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id)`);

    // ============================================================
    // OAuth2 Authorization Codes
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(255) UNIQUE NOT NULL,
        client_id UUID REFERENCES oauth_clients(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        redirect_uri TEXT NOT NULL,
        scope TEXT,
        code_challenge VARCHAR(255),
        code_challenge_method VARCHAR(10),
        state VARCHAR(255),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_code ON oauth_authorization_codes(code)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_expires ON oauth_authorization_codes(expires_at)`);

    // ============================================================
    // OAuth2 Access Tokens
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS oauth_access_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        access_token VARCHAR(512) UNIQUE NOT NULL,
        client_id UUID REFERENCES oauth_clients(id) ON DELETE CASCADE,
        user_id UUID,
        scope TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked BOOLEAN DEFAULT false,
        revoked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_token ON oauth_access_tokens(access_token)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires ON oauth_access_tokens(expires_at)`);

    // ============================================================
    // OAuth2 Refresh Tokens
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        refresh_token VARCHAR(512) UNIQUE NOT NULL,
        access_token_id UUID REFERENCES oauth_access_tokens(id) ON DELETE CASCADE,
        client_id UUID REFERENCES oauth_clients(id) ON DELETE CASCADE,
        user_id UUID,
        scope TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked BOOLEAN DEFAULT false,
        revoked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_token ON oauth_refresh_tokens(refresh_token)`);

    // ============================================================
    // Webhook Subscriptions
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        endpoint_url TEXT NOT NULL,
        secret VARCHAR(255) NOT NULL,
        events JSONB NOT NULL DEFAULT '[]',
        collection_id UUID,
        filter_conditions JSONB,
        http_method VARCHAR(10) DEFAULT 'POST',
        headers JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        verify_ssl BOOLEAN DEFAULT true,
        retry_count INTEGER DEFAULT 5,
        retry_delay_seconds INTEGER DEFAULT 30,
        timeout_seconds INTEGER DEFAULT 30,
        last_triggered_at TIMESTAMP WITH TIME ZONE,
        last_success_at TIMESTAMP WITH TIME ZONE,
        last_failure_at TIMESTAMP WITH TIME ZONE,
        failure_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(is_active)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_events ON webhook_subscriptions USING GIN(events)`);

    // ============================================================
    // Webhook Delivery Logs
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        subscription_id UUID REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        request_headers JSONB,
        response_status INTEGER,
        response_body TEXT,
        response_headers JSONB,
        attempt_count INTEGER DEFAULT 1,
        max_attempts INTEGER DEFAULT 5,
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        duration_ms INTEGER,
        scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        delivered_at TIMESTAMP WITH TIME ZONE,
        next_retry_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription ON webhook_deliveries(subscription_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_scheduled ON webhook_deliveries(scheduled_at)`);

    // ============================================================
    // External Connectors
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS external_connectors (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        version VARCHAR(20) DEFAULT '1.0.0',
        icon_url TEXT,
        documentation_url TEXT,
        config_schema JSONB NOT NULL,
        auth_type VARCHAR(50) NOT NULL,
        supported_operations JSONB DEFAULT '[]',
        is_system BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_external_connectors_code ON external_connectors(code)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_external_connectors_type ON external_connectors(type)`);

    // ============================================================
    // Connector Connections (Instances)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS connector_connections (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        connector_id UUID REFERENCES external_connectors(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        config JSONB NOT NULL,
        credentials JSONB,
        status VARCHAR(50) DEFAULT 'disconnected',
        last_connected_at TIMESTAMP WITH TIME ZONE,
        last_sync_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_connector_connections_connector ON connector_connections(connector_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_connector_connections_status ON connector_connections(status)`);

    // ============================================================
    // Field Mappings
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS field_mappings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        connection_id UUID REFERENCES connector_connections(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        source_entity VARCHAR(255) NOT NULL,
        target_collection_id UUID,
        direction VARCHAR(20) DEFAULT 'bidirectional',
        mappings JSONB NOT NULL DEFAULT '[]',
        transformations JSONB DEFAULT '[]',
        filters JSONB,
        sync_mode VARCHAR(50) DEFAULT 'incremental',
        conflict_resolution VARCHAR(50) DEFAULT 'source_wins',
        is_active BOOLEAN DEFAULT true,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_field_mappings_connection ON field_mappings(connection_id)`);

    // ============================================================
    // Import Jobs
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS import_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        source_type VARCHAR(50) NOT NULL,
        source_config JSONB,
        file_name VARCHAR(500),
        file_size BIGINT,
        file_type VARCHAR(100),
        target_collection_id UUID,
        field_mapping JSONB NOT NULL DEFAULT '[]',
        options JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        total_records INTEGER,
        processed_records INTEGER DEFAULT 0,
        successful_records INTEGER DEFAULT 0,
        failed_records INTEGER DEFAULT 0,
        skipped_records INTEGER DEFAULT 0,
        error_log JSONB DEFAULT '[]',
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_import_jobs_collection ON import_jobs(target_collection_id)`);

    // ============================================================
    // Export Jobs
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS export_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        source_collection_id UUID,
        query JSONB,
        format VARCHAR(50) NOT NULL DEFAULT 'csv',
        options JSONB DEFAULT '{}',
        include_fields JSONB,
        exclude_fields JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        total_records INTEGER,
        exported_records INTEGER DEFAULT 0,
        file_name VARCHAR(500),
        file_size BIGINT,
        file_url TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_export_jobs_collection ON export_jobs(source_collection_id)`);

    // ============================================================
    // Sync Configurations
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sync_configurations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        connection_id UUID REFERENCES connector_connections(id) ON DELETE CASCADE,
        mapping_id UUID REFERENCES field_mappings(id),
        schedule VARCHAR(100),
        direction VARCHAR(20) DEFAULT 'bidirectional',
        sync_mode VARCHAR(50) DEFAULT 'incremental',
        conflict_resolution VARCHAR(50) DEFAULT 'source_wins',
        batch_size INTEGER DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        last_run_at TIMESTAMP WITH TIME ZONE,
        next_run_at TIMESTAMP WITH TIME ZONE,
        run_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sync_configurations_connection ON sync_configurations(connection_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sync_configurations_active ON sync_configurations(is_active)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sync_configurations_next_run ON sync_configurations(next_run_at)`);

    // ============================================================
    // Sync Runs
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sync_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        configuration_id UUID REFERENCES sync_configurations(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'running',
        direction VARCHAR(20),
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        duration_ms BIGINT,
        records_processed INTEGER DEFAULT 0,
        records_created INTEGER DEFAULT 0,
        records_updated INTEGER DEFAULT 0,
        records_deleted INTEGER DEFAULT 0,
        records_skipped INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        conflicts_detected INTEGER DEFAULT 0,
        conflicts_resolved INTEGER DEFAULT 0,
        error_message TEXT,
        error_details JSONB,
        log JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sync_runs_configuration ON sync_runs(configuration_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON sync_runs(started_at DESC)`);

    // ============================================================
    // API Request Logs
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS api_request_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
        oauth_client_id UUID REFERENCES oauth_clients(id) ON DELETE SET NULL,
        user_id UUID,
        method VARCHAR(10) NOT NULL,
        path TEXT NOT NULL,
        query_params JSONB,
        request_headers JSONB,
        request_body_size INTEGER,
        response_status INTEGER,
        response_body_size INTEGER,
        duration_ms INTEGER,
        ip_address VARCHAR(45),
        user_agent TEXT,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_api_request_logs_api_key ON api_request_logs(api_key_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_api_request_logs_created ON api_request_logs(created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_api_request_logs_path ON api_request_logs(path)`);

    // ============================================================
    // Seed System Connectors
    // ============================================================
    await queryRunner.query(`
      INSERT INTO external_connectors (code, name, description, type, auth_type, config_schema, supported_operations, is_system)
      VALUES
        ('salesforce', 'Salesforce', 'Salesforce CRM integration for managing leads, opportunities, accounts, and custom objects', 'crm', 'oauth2',
         '{"properties": {"instanceUrl": {"type": "string", "title": "Instance URL"}, "apiVersion": {"type": "string", "title": "API Version", "default": "v58.0"}}}',
         '["read", "create", "update", "delete", "bulk_read", "bulk_write"]', true),
        ('jira', 'Jira', 'Atlassian Jira integration for issue tracking and project management', 'project_management', 'oauth2',
         '{"properties": {"cloudId": {"type": "string", "title": "Cloud ID"}, "baseUrl": {"type": "string", "title": "Base URL"}}}',
         '["read", "create", "update", "delete"]', true),
        ('servicenow', 'ServiceNow', 'ServiceNow ITSM integration for incidents, requests, and CMDB', 'itsm', 'basic',
         '{"properties": {"instanceUrl": {"type": "string", "title": "Instance URL"}, "apiVersion": {"type": "string", "title": "API Version", "default": "v1"}}}',
         '["read", "create", "update", "delete"]', true),
        ('sap', 'SAP', 'SAP ERP integration for materials, purchase orders, and master data', 'erp', 'basic',
         '{"properties": {"baseUrl": {"type": "string", "title": "Base URL"}, "client": {"type": "string", "title": "Client"}}}',
         '["read", "create", "update"]', true),
        ('rest_api', 'Generic REST API', 'Connect to any REST API endpoint', 'generic', 'api_key',
         '{"properties": {"baseUrl": {"type": "string", "title": "Base URL"}, "defaultHeaders": {"type": "object", "title": "Default Headers"}}}',
         '["read", "create", "update", "delete"]', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS api_request_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS sync_runs`);
    await queryRunner.query(`DROP TABLE IF EXISTS sync_configurations`);
    await queryRunner.query(`DROP TABLE IF EXISTS export_jobs`);
    await queryRunner.query(`DROP TABLE IF EXISTS import_jobs`);
    await queryRunner.query(`DROP TABLE IF EXISTS field_mappings`);
    await queryRunner.query(`DROP TABLE IF EXISTS connector_connections`);
    await queryRunner.query(`DROP TABLE IF EXISTS external_connectors`);
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_deliveries`);
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_subscriptions`);
    await queryRunner.query(`DROP TABLE IF EXISTS oauth_refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS oauth_access_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS oauth_authorization_codes`);
    await queryRunner.query(`DROP TABLE IF EXISTS oauth_clients`);
    await queryRunner.query(`DROP TABLE IF EXISTS api_keys`);
  }
}
