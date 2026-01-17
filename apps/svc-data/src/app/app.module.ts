import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import {
  AuthorizationModule,
  COLLECTION_ACL_REPOSITORY,
  PROPERTY_ACL_REPOSITORY,
} from '@hubblewave/authorization';
import {
  CollectionAccessRule,
  PropertyAccessRule,
  InstanceDbModule,
} from '@hubblewave/instance-db';
import { RedisModule } from '@hubblewave/redis';
import { DataController } from './data.controller';
import { DataService } from './data.service';
import { HealthController } from './health.controller';
import { ModelRegistryService } from './model-registry.service';
import { CollectionDataController } from './collection-data.controller';
import { CollectionDataService } from './collection-data.service';
import { EventOutboxService } from './events/event-outbox.service';
import { OfferingsController } from './offerings/offerings.controller';
import { OfferingsService } from './offerings/offerings.service';
import { WorkController } from './work/work.controller';
import { WorkService } from './work/work.service';

import { AutomationModule } from './automation/automation.module';
import { IntegrationModule } from './integration/integration.module';
import { AVAModule } from './ava/ava.module';
import { WorkflowModule } from './workflow/workflow.module';

import { ValidationModule } from './validation/validation.module';
import { DefaultsModule } from './defaults/defaults.module';
import { GridModule } from './grid/grid.module';
import { FormulaModule } from './formula/formula.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    InstanceDbModule,
    AuthGuardModule,
    TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule]),
    AuthorizationModule.forRoot({
      enableCaching: true,
    }),
    RedisModule.forRoot(),
    AutomationModule,
    IntegrationModule,
    AVAModule,
    WorkflowModule,
    ValidationModule,
    DefaultsModule,
    GridModule,
    FormulaModule,
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

