import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import {
  AuthGuardModule,
  GlobalGuardsModule,
  MaintenanceModeModule,
} from '@hubblewave/auth-guard';
import {
  AuthorizationModule,
  COLLECTION_ACL_REPOSITORY,
  PROPERTY_ACL_REPOSITORY,
} from '@hubblewave/authorization';
import {
  CollectionAccessRule,
  PropertyAccessRule,
  InstanceDbModule,
  RuntimeAnomalyModule,
} from '@hubblewave/instance-db';
import { RedisModule } from '@hubblewave/redis';

import { DataController } from './data.controller';
import { DataService } from './data.service';
import { DataHealthController } from './data-health.controller';
import { CollectionDataController } from './collection-data.controller';
import { CollectionDataService } from './collection-data.service';
import { ModelRegistryService } from './model-registry.service';

import { SyncTriggerClientService } from './automation/sync-trigger-client.service';
import { EventOutboxService } from './events/event-outbox.service';
import { OfferingsController } from './offerings/offerings.controller';
import { OfferingsService } from './offerings/offerings.service';
import { WorkController } from './work/work.controller';
import { WorkService } from './work/work.service';

import { AVAModule } from './ava/ava.module';
import { ComputedModule } from './computed/computed.module';
import { DefaultsModule } from './defaults/defaults.module';
import { FormulaModule } from './formula/formula.module';
import { GridModule } from './grid/grid.module';
import { IntegrationModule } from './integration/integration.module';
import { ValidationModule } from './validation/validation.module';
import { WorkflowModule } from './workflow/workflow.module';

/**
 * DataModule — canonical home for the data plane (formerly apps/svc-data).
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-data-migration.md):
 *   Standard modules:
 *     [x] workflow
 *     [x] defaults
 *     [x] validation
 *     [x] ava
 *     [x] formula
 *     [x] computed
 *     [x] integration
 *     [x] grid
 *   Service-only sub-directories:
 *     [x] events
 *     [x] automation
 *     [x] work
 *     [x] offerings
 *   Top-level service files (mid-stream):
 *     [x] collection-data.service + spec
 *     [x] model-registry.service
 *   Final top-level (controllers, data.service, app.module thin adapter):
 *     [x] data.controller, health.controller (renamed DataHealthController), collection-data.controller
 *     [x] data.service + spec
 *     [x] data.module final composition
 *     [x] svc-data app.module thin adapter
 *
 * apps/svc-data is reduced to a thin adapter that imports DataModule from
 * apps/api so the legacy service serves the same endpoints during parallel
 * deployment. Legacy service deletion is deferred to W1 final cutover.
 */
@Module({
  imports: [
    InstanceDbModule,
    RuntimeAnomalyModule,
    AuthGuardModule,
    GlobalGuardsModule,
    CacheModule.register({ ttl: 30_000, max: 1000 }),
    TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule]),
    AuthorizationModule.forRoot({ enableCaching: true }),
    RedisModule.forRoot(),
    MaintenanceModeModule,
    ConfigModule,
    ScheduleModule.forRoot(),
    AVAModule,
    ComputedModule,
    DefaultsModule,
    FormulaModule,
    GridModule,
    IntegrationModule,
    ValidationModule,
    WorkflowModule,
  ],
  controllers: [
    DataController,
    DataHealthController,
    CollectionDataController,
    OfferingsController,
    WorkController,
  ],
  providers: [
    DataService,
    ModelRegistryService,
    CollectionDataService,
    SyncTriggerClientService,
    EventOutboxService,
    OfferingsService,
    WorkService,
    {
      provide: COLLECTION_ACL_REPOSITORY,
      useFactory: (repo: Repository<CollectionAccessRule>) => repo,
      inject: [getRepositoryToken(CollectionAccessRule)],
    },
    {
      provide: PROPERTY_ACL_REPOSITORY,
      useFactory: (repo: Repository<PropertyAccessRule>) => repo,
      inject: [getRepositoryToken(PropertyAccessRule)],
    },
  ],
  exports: [
    AVAModule,
    ComputedModule,
    DefaultsModule,
    FormulaModule,
    GridModule,
    IntegrationModule,
    ValidationModule,
    WorkflowModule,
    DataService,
    ModelRegistryService,
    CollectionDataService,
    SyncTriggerClientService,
    EventOutboxService,
    OfferingsService,
    WorkService,
  ],
})
export class DataModule {}
