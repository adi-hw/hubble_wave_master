/**
 * @hubblewave/schema-engine
 *
 * The Schema Engine is the heart of HubbleWave's metadata layer. It provides
 * a complete solution for managing database schema through a rich metadata
 * abstraction that sits between the application and PostgreSQL.
 *
 * ## Core Concepts
 *
 * **Collections**: Application-level representation of database tables. Each
 * collection has a code (internal identifier), name (display name), and
 * physical storage table. Collections can be system (immutable), module
 * (extensible), or custom (full user control).
 *
 * **Properties**: Application-level representation of database columns. Each
 * property maps to a storage column but includes rich metadata like names,
 * validation rules, UI widgets, and help text that PostgreSQL cannot express.
 *
 * **Governance**: A permission model based on ownership (system/module/custom)
 * that determines what modifications are allowed.
 *
 * **Sync**: Automatic drift detection between metadata and physical schema
 * to catch inconsistencies early and enable brownfield migrations.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { SchemaEngineModule } from '@hubblewave/schema-engine';
 *
 * @Module({
 *   imports: [SchemaEngineModule],
 * })
 * export class AppModule {}
 *
 * // Use the CollectionService
 * import { CollectionService } from '@hubblewave/schema-engine';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private collections: CollectionService) {}
 *
 *   async createAssets() {
 *     return this.collections.createCollection({
 *       code: 'assets',
 *       name: 'Assets',
 *       properties: [
 *         { code: 'name', name: 'Name', propertyTypeId: '...', isRequired: true },
 *       ],
 *     }, { userId: 'user-id' });
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

// Module
export { SchemaEngineModule } from './lib/schema-engine.module';

// Services
export {
  // Main service
  CollectionService,
  CreateCollectionDto,
  UpdateCollectionDto,
  CreatePropertyDto,
  UpdatePropertyDto,
  OperationContext,
  ListCollectionsOptions,

  // Governance
  SchemaGovernanceService,
  ActorType,
  SchemaPermissions,

  // DDL Execution
  DdlExecutorService,
  CreateTableOptions,
  AlterTableOptions,
  ColumnDefinition,
  DdlResult,
  ChangeContext,

  // Sync
  SchemaSyncService,
  SyncIssue,
  SyncCheckResult,

  // Versioning
  SchemaVersionService,
  SchemaVersion,
  CollectionSnapshot,
  PropertySnapshot,
  IndexSnapshot,
  SchemaChangeType,
  SchemaVersionCompare,
  SchemaChange,
  RollbackResult,
} from './lib/services';
