import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import {
  CollectionDefinition,
  PropertyDefinition,
  SchemaChangeLog,
  SchemaSyncState,
} from '@hubblewave/instance-db';

import {
  CollectionService,
  SchemaGovernanceService,
  DdlExecutorService,
  SchemaSyncService,
} from './services';

/**
 * SchemaEngineModule
 *
 * This module provides the complete Schema Engine functionality for HubbleWave.
 * It should be imported into your application module to enable schema management
 * features including collection/property CRUD, governance enforcement, and
 * automatic drift detection.
 *
 * The module provides:
 *
 * **CollectionService**: Main orchestrating service for all schema operations.
 * Use this service for creating collections, adding properties, etc.
 *
 * **SchemaGovernanceService**: Permission and naming validation. Usually called
 * internally by CollectionService, but can be used directly for validation checks.
 *
 * **DdlExecutorService**: Low-level DDL execution with transaction safety.
 * Usually called internally, but available for advanced use cases.
 *
 * **SchemaSyncService**: Drift detection and table discovery. Runs automatically
 * on a schedule, but can be triggered manually for immediate checks.
 *
 * @example
 * ```typescript
 * // In your app module
 * @Module({
 *   imports: [
 *     TypeOrmModule.forRoot(instanceDbConfig),
 *     ScheduleModule.forRoot(),
 *     SchemaEngineModule,
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CollectionDefinition,
      PropertyDefinition,
      SchemaChangeLog,
      SchemaSyncState,
    ]),

    ScheduleModule.forRoot(),
  ],

  providers: [
    SchemaGovernanceService,
    DdlExecutorService,
    SchemaSyncService,
    CollectionService,
  ],

  exports: [
    CollectionService,
    SchemaGovernanceService,
    DdlExecutorService,
    SchemaSyncService,
  ],
})
export class SchemaEngineModule {}
