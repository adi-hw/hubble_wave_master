import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
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
import { HealthController } from './health.controller';
import { ModelRegistryService } from './model-registry.service';
import { CollectionDataController } from './collection-data.controller';
import { CollectionDataService } from './collection-data.service';
import { SyncTriggerClientService } from '../../../api/src/app/data/automation/sync-trigger-client.service';
import { EventOutboxService } from '../../../api/src/app/data/events/event-outbox.service';
import { OfferingsController } from './offerings/offerings.controller';
import { OfferingsService } from './offerings/offerings.service';
import { WorkController } from './work/work.controller';
import { WorkService } from './work/work.service';

import { IntegrationModule } from './integration/integration.module';
import { AVAModule } from './ava/ava.module';
import { WorkflowModule } from '../../../api/src/app/data/workflow/workflow.module';

import { ValidationModule } from './validation/validation.module';
import { DefaultsModule } from './defaults/defaults.module';
import { GridModule } from './grid/grid.module';
import { FormulaModule } from './formula/formula.module';
import { ComputedModule } from './computed/computed.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    InstanceDbModule,
    RuntimeAnomalyModule,
    AuthGuardModule,
    GlobalGuardsModule,
    // Backs ModelRegistryService cache. 30-second TTL keeps schema
    // discovery responsive after metadata changes; 1000-key cap bounds
    // memory growth as new collections are discovered.
    CacheModule.register({ ttl: 30_000, max: 1000 }),
    TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule]),
    AuthorizationModule.forRoot({
      enableCaching: true,
    }),
    RedisModule.forRoot(),
    MaintenanceModeModule,
    ConfigModule,
    IntegrationModule,
    AVAModule,
    WorkflowModule,
    ValidationModule,
    DefaultsModule,
    GridModule,
    FormulaModule,
    ComputedModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    DataController,
    HealthController,
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
})
export class AppModule {}

