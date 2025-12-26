/**
 * Schema Engine Entities
 * 
 * This module exports all TypeORM entities related to the HubbleWave Schema Engine.
 * The Schema Engine provides the metadata layer that sits between the application
 * and PostgreSQL, enabling rich configuration, governance, and synchronization.
 * 
 * Core Entities:
 * - CollectionDefinition: Metadata for data tables (collections)
 * - PropertyDefinition: Metadata for columns (properties)
 * 
 * Governance Entities:
 * - SchemaChangeLog: Audit trail of all schema modifications
 * - SchemaSyncState: Synchronization state and distributed locking
 * 
 * @module tenant-db/entities
 */

// Core Schema Entities
export { 
  CollectionDefinition, 
  SchemaOwner, 
  SyncStatus 
} from './collection-definition.entity';

export { 
  PropertyDefinition, 
  PropertyDataType 
} from './property-definition.entity';

// Governance & Audit Entities
export { 
  SchemaChangeLog, 
  SchemaEntityType,
  SchemaChangeType,
  SchemaChangeSource,
  PerformedByType,
} from './schema-change-log.entity';

export { 
  SchemaSyncState,
  SyncResult,
} from './schema-sync-state.entity';

/**
 * Re-export type aliases for convenience
 */
export type {
  SchemaOwner as CollectionOwner,
  SyncStatus as CollectionSyncStatus,
} from './collection-definition.entity';
