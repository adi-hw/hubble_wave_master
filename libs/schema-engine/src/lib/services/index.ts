/**
 * Schema Engine Services
 *
 * This module exports all services that comprise the HubbleWave Schema Engine.
 */

// Main orchestrating service
export {
  CollectionService,
  CreateCollectionDto,
  UpdateCollectionDto,
  CreatePropertyDto,
  UpdatePropertyDto,
  OperationContext,
  ListCollectionsOptions,
} from './collection.service';

// Governance service (permission enforcement)
export {
  SchemaGovernanceService,
  ActorType,
  SchemaPermissions,
} from './schema-governance.service';

// DDL executor service (physical schema changes)
export {
  DdlExecutorService,
  CreateTableOptions,
  AlterTableOptions,
  ColumnDefinition,
  DdlResult,
  ChangeContext,
} from './ddl-executor.service';

// Schema sync service (drift detection)
export {
  SchemaSyncService,
  SyncIssue,
  SyncCheckResult,
} from './schema-sync.service';
