// libs/instance-db/src/lib/entities/integrations.ts
//
// Integrations-area entities: integration API keys, OAuth clients,
// authorization codes, access and refresh tokens, webhook subscriptions
// and deliveries, external connectors and connections, property mappings,
// import/export jobs, sync configurations and runs, and API request logs.
//
// Public API surface is unchanged — entities continue to be exported via
// the package barrel `@hubblewave/instance-db`. This file exists to make
// area ownership explicit and to ease future code navigation. See Plan
// Fix 24 PR-A for the restructure rationale.

export {
  IntegrationApiKey,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthAccessToken,
  OAuthRefreshToken,
  WebhookSubscription,
  WebhookDelivery,
  ExternalConnector,
  ConnectorConnection,
  PropertyMapping,
  ImportJob,
  ExportJob,
  SyncConfiguration,
  SyncRun,
  ApiRequestLog,
} from './integration.entity';
export type {
  OAuthClientType,
  OAuthGrantType,
  WebhookEvent,
  WebhookDeliveryStatus,
  ConnectorType,
  ConnectorAuthType,
  ConnectionStatus,
  SyncDirection,
  SyncMode,
  ConflictResolution,
  ImportExportStatus,
  ImportSourceType,
  ExportFormat,
  SyncRunStatus,
  ApiScope,
  PropertyMappingEntry,
  DataTransformation,
  ImportError,
  SyncLogEntry,
} from './integration.entity';
