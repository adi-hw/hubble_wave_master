/**
 * View Engine App Module
 * HubbleWave Platform - Phase 2
 */

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
  InstanceDbModule,
  CollectionAccessRule,
  PropertyAccessRule,
} from '@hubblewave/instance-db';
import { HealthController } from './health.controller';
import { ViewModule } from './view/view.module';
import { TransformModule } from './transform/transform.module';
import { NavigationResolveModule } from './navigation/navigation.module';

@Module({
  imports: [
    InstanceDbModule,
    AuthGuardModule,
    TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule]),
    AuthorizationModule.forRoot({
      enableCaching: true,
    }),
    ViewModule,
    NavigationResolveModule,
    TransformModule,
  ],
  controllers: [HealthController],
  providers: [
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
