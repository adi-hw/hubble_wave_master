/**
 * Phase 5: Integration & Data Management Entities
 * HubbleWave Platform
 *
 * Entities for API management, webhooks, external connectors,
 * and data import/export functionality.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

// ============================================================
// Types and Enums
// ============================================================

export type OAuthClientType = 'confidential' | 'public';
export type OAuthGrantType = 'authorization_code' | 'refresh_token' | 'client_credentials' | 'password';
export type WebhookEvent = 'record.created' | 'record.updated' | 'record.deleted' | 'processFlow.completed' | 'approval.pending' | 'approval.completed' | 'sla.breached' | 'user.created' | 'user.updated';
export type WebhookDeliveryStatus = 'pending' | 'delivering' | 'delivered' | 'failed' | 'retrying';
export type ConnectorType = 'crm' | 'erp' | 'itsm' | 'project_management' | 'database' | 'file_storage' | 'generic';
export type ConnectorAuthType = 'none' | 'api_key' | 'basic' | 'oauth2' | 'jwt' | 'custom';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'testing';
export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';
export type SyncMode = 'full' | 'incremental' | 'delta';
export type ConflictResolution = 'source_wins' | 'target_wins' | 'newest_wins' | 'manual';
export type ImportExportStatus = 'pending' | 'validating' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ImportSourceType = 'file' | 'api' | 'connector';
export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'xml' | 'pdf';
export type SyncRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface ApiScope {
  name: string;
  description: string;
  resources: string[];
  actions: string[];
}

export interface PropertyMappingEntry {
  sourceProperty: string;
  targetProperty: string;
  transformation?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface DataTransformation {
  type: 'format' | 'lookup' | 'calculate' | 'concatenate' | 'split' | 'custom';
  config: Record<string, unknown>;
}

export interface ImportError {
  row: number;
  property: string;
  value: string;
  error: string;
}

export interface SyncLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================
// API Key (Extended from auth-tokens.entity)
// ============================================================

@Entity('api_keys')
export class IntegrationApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'key_prefix', type: 'varchar', length: 10 })
  keyPrefix!: string;

  @Column({ name: 'key_hash', type: 'varchar', length: 255 })
  keyHash!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', default: '[]' })
  scopes!: ApiScope[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'rate_limit_per_minute', type: 'int', default: 1000 })
  rateLimitPerMinute!: number;

  @Column({ name: 'allowed_ips', type: 'jsonb', default: '[]' })
  allowedIps!: string[];

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date;

  @Column({ name: 'usage_count', type: 'bigint', default: 0 })
  usageCount!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy?: string;
}

// ============================================================
// OAuth2 Client
// ============================================================

@Entity('oauth_clients')
export class OAuthClient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_id', type: 'varchar', length: 255, unique: true })
  clientId!: string;

  @Column({ name: 'client_secret_hash', type: 'varchar', length: 255 })
  clientSecretHash!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'client_type', type: 'varchar', length: 50, default: 'confidential' })
  clientType!: OAuthClientType;

  @Column({ name: 'redirect_uris', type: 'jsonb', default: '[]' })
  redirectUris!: string[];

  @Column({ name: 'allowed_scopes', type: 'jsonb', default: '[]' })
  allowedScopes!: string[];

  @Column({ name: 'allowed_grant_types', type: 'jsonb', default: '["authorization_code", "refresh_token"]' })
  allowedGrantTypes!: OAuthGrantType[];

  @Column({ name: 'access_token_lifetime_seconds', type: 'int', default: 3600 })
  accessTokenLifetimeSeconds!: number;

  @Column({ name: 'refresh_token_lifetime_seconds', type: 'int', default: 2592000 })
  refreshTokenLifetimeSeconds!: number;

  @Column({ name: 'require_pkce', type: 'boolean', default: false })
  requirePkce!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl?: string;

  @Column({ name: 'terms_url', type: 'text', nullable: true })
  termsUrl?: string;

  @Column({ name: 'privacy_url', type: 'text', nullable: true })
  privacyUrl?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// OAuth2 Authorization Code
// ============================================================

@Entity('oauth_authorization_codes')
export class OAuthAuthorizationCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  code!: string;

  @Column({ name: 'client_id', type: 'uuid' })
  oauthClientId!: string;

  @ManyToOne(() => OAuthClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client!: OAuthClient;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'redirect_uri', type: 'text' })
  redirectUri!: string;

  @Column({ type: 'text', nullable: true })
  scope?: string;

  @Column({ name: 'code_challenge', type: 'varchar', length: 255, nullable: true })
  codeChallenge?: string;

  @Column({ name: 'code_challenge_method', type: 'varchar', length: 10, nullable: true })
  codeChallengeMethod?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  state?: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  used!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// OAuth2 Access Token
// ============================================================

@Entity('oauth_access_tokens')
export class OAuthAccessToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'access_token', type: 'varchar', length: 512, unique: true })
  accessToken!: string;

  @Column({ name: 'client_id', type: 'uuid' })
  oauthClientId!: string;

  @ManyToOne(() => OAuthClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client!: OAuthClient;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'text', nullable: true })
  scope?: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// OAuth2 Refresh Token
// ============================================================

@Entity('oauth_refresh_tokens')
export class OAuthRefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'refresh_token', type: 'varchar', length: 512, unique: true })
  refreshToken!: string;

  @Column({ name: 'access_token_id', type: 'uuid' })
  accessTokenId!: string;

  @ManyToOne(() => OAuthAccessToken, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'access_token_id' })
  accessToken!: OAuthAccessToken;

  @Column({ name: 'client_id', type: 'uuid' })
  oauthClientId!: string;

  @ManyToOne(() => OAuthClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client!: OAuthClient;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'text', nullable: true })
  scope?: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// Webhook Subscription
// ============================================================

@Entity('webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'endpoint_url', type: 'text' })
  endpointUrl!: string;

  @Column({ type: 'varchar', length: 255 })
  secret!: string;

  @Column({ type: 'jsonb', default: '[]' })
  events!: WebhookEvent[];

  @Column({ name: 'collection_id', type: 'uuid', nullable: true })
  collectionId?: string;

  @Column({ name: 'filter_conditions', type: 'jsonb', nullable: true })
  filterConditions?: Record<string, unknown>;

  @Column({ name: 'http_method', type: 'varchar', length: 10, default: 'POST' })
  httpMethod!: string;

  @Column({ type: 'jsonb', default: '{}' })
  headers!: Record<string, string>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'verify_ssl', type: 'boolean', default: true })
  verifySsl!: boolean;

  @Column({ name: 'retry_count', type: 'int', default: 5 })
  retryCount!: number;

  @Column({ name: 'retry_delay_seconds', type: 'int', default: 30 })
  retryDelaySeconds!: number;

  @Column({ name: 'timeout_seconds', type: 'int', default: 30 })
  timeoutSeconds!: number;

  @Column({ name: 'last_triggered_at', type: 'timestamptz', nullable: true })
  lastTriggeredAt?: Date;

  @Column({ name: 'last_success_at', type: 'timestamptz', nullable: true })
  lastSuccessAt?: Date;

  @Column({ name: 'last_failure_at', type: 'timestamptz', nullable: true })
  lastFailureAt?: Date;

  @Column({ name: 'failure_count', type: 'int', default: 0 })
  failureCount!: number;

  @Column({ name: 'success_count', type: 'int', default: 0 })
  successCount!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// Webhook Delivery
// ============================================================

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'subscription_id', type: 'uuid' })
  subscriptionId!: string;

  @ManyToOne(() => WebhookSubscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription!: WebhookSubscription;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'event_id', type: 'varchar', length: 255 })
  eventId!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'request_headers', type: 'jsonb', nullable: true })
  requestHeaders?: Record<string, string>;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus?: number;

  @Column({ name: 'response_body', type: 'text', nullable: true })
  responseBody?: string;

  @Column({ name: 'response_headers', type: 'jsonb', nullable: true })
  responseHeaders?: Record<string, string>;

  @Column({ name: 'attempt_count', type: 'int', default: 1 })
  attemptCount!: number;

  @Column({ name: 'max_attempts', type: 'int', default: 5 })
  maxAttempts!: number;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: WebhookDeliveryStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number;

  @Column({ name: 'scheduled_at', type: 'timestamptz', default: () => 'NOW()' })
  scheduledAt!: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// External Connector
// ============================================================

@Entity('external_connectors')
export class ExternalConnector {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50 })
  type!: ConnectorType;

  @Column({ type: 'varchar', length: 20, default: '1.0.0' })
  version!: string;

  @Column({ name: 'icon_url', type: 'text', nullable: true })
  iconUrl?: string;

  @Column({ name: 'documentation_url', type: 'text', nullable: true })
  documentationUrl?: string;

  @Column({ name: 'config_schema', type: 'jsonb' })
  configSchema!: Record<string, unknown>;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'auth_type', type: 'varchar', length: 50 })
  authType!: ConnectorAuthType;

  @Column({ name: 'supported_operations', type: 'jsonb', default: '[]' })
  supportedOperations!: string[];

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// Connector Connection
// ============================================================

@Entity('connector_connections')
export class ConnectorConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120, nullable: true })
  code?: string | null;

  @Column({ name: 'connector_id', type: 'uuid' })
  connectorId!: string;

  @ManyToOne(() => ExternalConnector, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connector_id' })
  connector!: ExternalConnector;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb' })
  config!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  credentials?: Record<string, unknown>;

  @Column({ name: 'credential_ref', type: 'text', nullable: true })
  credentialRef?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, default: 'disconnected' })
  status!: ConnectionStatus;

  @Column({ name: 'last_connected_at', type: 'timestamptz', nullable: true })
  lastConnectedAt?: Date;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt?: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// Property Mapping (maps external source fields to collection properties)
// ============================================================

@Entity('property_mappings')
export class PropertyMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120, nullable: true })
  code?: string | null;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId!: string;

  @ManyToOne(() => ConnectorConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection!: ConnectorConnection;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'source_entity', type: 'varchar', length: 255 })
  sourceEntity!: string;

  @Column({ name: 'target_collection_id', type: 'uuid', nullable: true })
  targetCollectionId?: string;

  @Column({ type: 'varchar', length: 20, default: 'bidirectional' })
  direction!: SyncDirection;

  @Column({ type: 'jsonb', default: '[]' })
  mappings!: PropertyMappingEntry[];

  @Column({ type: 'jsonb', default: '[]' })
  transformations!: DataTransformation[];

  @Column({ type: 'jsonb', nullable: true })
  filters?: Record<string, unknown>;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'sync_mode', type: 'varchar', length: 50, default: 'incremental' })
  syncMode!: SyncMode;

  @Column({ name: 'conflict_resolution', type: 'varchar', length: 50, default: 'source_wins' })
  conflictResolution!: ConflictResolution;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// Import Job
// ============================================================

@Entity('import_jobs')
export class ImportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 50 })
  sourceType!: ImportSourceType;

  @Column({ name: 'source_config', type: 'jsonb', nullable: true })
  sourceConfig?: Record<string, unknown>;

  @Column({ name: 'file_name', type: 'varchar', length: 500, nullable: true })
  fileName?: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize?: number;

  @Column({ name: 'file_type', type: 'varchar', length: 100, nullable: true })
  fileType?: string;

  @Column({ name: 'target_collection_id', type: 'uuid', nullable: true })
  targetCollectionId?: string;

  @Column({ name: 'property_mapping', type: 'jsonb', default: '[]' })
  propertyMapping!: PropertyMappingEntry[];

  @Column({ type: 'jsonb', default: '{}' })
  options!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: ImportExportStatus;

  @Column({ type: 'int', default: 0 })
  progress!: number;

  @Column({ name: 'total_records', type: 'int', nullable: true })
  totalRecords?: number;

  @Column({ name: 'processed_records', type: 'int', default: 0 })
  processedRecords!: number;

  @Column({ name: 'successful_records', type: 'int', default: 0 })
  successfulRecords!: number;

  @Column({ name: 'failed_records', type: 'int', default: 0 })
  failedRecords!: number;

  @Column({ name: 'skipped_records', type: 'int', default: 0 })
  skippedRecords!: number;

  @Column({ name: 'error_log', type: 'jsonb', default: '[]' })
  errorLog!: ImportError[];

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// Export Job
// ============================================================

@Entity('export_jobs')
export class ExportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'source_collection_id', type: 'uuid', nullable: true })
  sourceCollectionId?: string;

  @Column({ type: 'jsonb', nullable: true })
  query?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, default: 'csv' })
  format!: ExportFormat;

  @Column({ type: 'jsonb', default: '{}' })
  options!: Record<string, unknown>;

  @Column({ name: 'include_properties', type: 'jsonb', nullable: true })
  includeProperties?: string[];

  @Column({ name: 'exclude_properties', type: 'jsonb', nullable: true })
  excludeProperties?: string[];

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: ImportExportStatus;

  @Column({ type: 'int', default: 0 })
  progress!: number;

  @Column({ name: 'total_records', type: 'int', nullable: true })
  totalRecords?: number;

  @Column({ name: 'exported_records', type: 'int', default: 0 })
  exportedRecords!: number;

  @Column({ name: 'file_name', type: 'varchar', length: 500, nullable: true })
  fileName?: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize?: number;

  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl?: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// Sync Configuration
// ============================================================

@Entity('sync_configurations')
export class SyncConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120, nullable: true })
  code?: string | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId!: string;

  @ManyToOne(() => ConnectorConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection!: ConnectorConnection;

  @Column({ name: 'mapping_id', type: 'uuid', nullable: true })
  mappingId?: string;

  @ManyToOne(() => PropertyMapping)
  @JoinColumn({ name: 'mapping_id' })
  mapping?: PropertyMapping;

  @Column({ type: 'varchar', length: 100, nullable: true })
  schedule?: string;

  @Column({ type: 'varchar', length: 20, default: 'bidirectional' })
  direction!: SyncDirection;

  @Column({ name: 'sync_mode', type: 'varchar', length: 50, default: 'incremental' })
  syncMode!: SyncMode;

  @Column({ name: 'conflict_resolution', type: 'varchar', length: 50, default: 'source_wins' })
  conflictResolution!: ConflictResolution;

  @Column({ name: 'batch_size', type: 'int', default: 100 })
  batchSize!: number;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt?: Date;

  @Column({ name: 'next_run_at', type: 'timestamptz', nullable: true })
  nextRunAt?: Date;

  @Column({ name: 'run_count', type: 'int', default: 0 })
  runCount!: number;

  @Column({ name: 'success_count', type: 'int', default: 0 })
  successCount!: number;

  @Column({ name: 'failure_count', type: 'int', default: 0 })
  failureCount!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// Sync Run
// ============================================================

@Entity('sync_runs')
export class SyncRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'configuration_id', type: 'uuid' })
  configurationId!: string;

  @ManyToOne(() => SyncConfiguration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'configuration_id' })
  configuration!: SyncConfiguration;

  @Column({ type: 'varchar', length: 50, default: 'running' })
  status!: SyncRunStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  direction?: SyncDirection;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'NOW()' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'duration_ms', type: 'bigint', nullable: true })
  durationMs?: number;

  @Column({ name: 'records_processed', type: 'int', default: 0 })
  recordsProcessed!: number;

  @Column({ name: 'records_created', type: 'int', default: 0 })
  recordsCreated!: number;

  @Column({ name: 'records_updated', type: 'int', default: 0 })
  recordsUpdated!: number;

  @Column({ name: 'records_deleted', type: 'int', default: 0 })
  recordsDeleted!: number;

  @Column({ name: 'records_skipped', type: 'int', default: 0 })
  recordsSkipped!: number;

  @Column({ name: 'records_failed', type: 'int', default: 0 })
  recordsFailed!: number;

  @Column({ name: 'conflicts_detected', type: 'int', default: 0 })
  conflictsDetected!: number;

  @Column({ name: 'conflicts_resolved', type: 'int', default: 0 })
  conflictsResolved!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails?: Record<string, unknown>;

  @Column({ type: 'jsonb', default: '[]' })
  log!: SyncLogEntry[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// API Request Log
// ============================================================

@Entity('api_request_logs')
export class ApiRequestLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'api_key_id', type: 'uuid', nullable: true })
  apiKeyId?: string;

  @ManyToOne(() => IntegrationApiKey, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'api_key_id' })
  apiKey?: IntegrationApiKey;

  @Column({ name: 'oauth_client_id', type: 'uuid', nullable: true })
  oauthClientId?: string;

  @ManyToOne(() => OAuthClient, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'oauth_client_id' })
  oauthClient?: OAuthClient;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 10 })
  method!: string;

  @Column({ type: 'text' })
  path!: string;

  @Column({ name: 'query_params', type: 'jsonb', nullable: true })
  queryParams?: Record<string, unknown>;

  @Column({ name: 'request_headers', type: 'jsonb', nullable: true })
  requestHeaders?: Record<string, string>;

  @Column({ name: 'request_body_size', type: 'int', nullable: true })
  requestBodySize?: number;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus?: number;

  @Column({ name: 'response_body_size', type: 'int', nullable: true })
  responseBodySize?: number;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
