import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuardModule, GlobalGuardsModule } from '@hubblewave/auth-guard';
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
import { NavigationResolveModule } from './navigation/navigation.module';
import { TransformModule } from './transform/transform.module';
import { ViewModule } from './view/view.module';
import { ViewsHealthController } from './views-health.controller';

/**
 * ViewsModule consolidates svc-view-engine into apps/api per spec §2.
 * Sub-areas: navigation, transform, view. ViewsHealthController serves
 * the /views/health liveness endpoint (renamed from svc-view-engine's
 * HealthController at /health).
 *
 * Global wiring (AuthGuardModule, GlobalGuardsModule, AuthorizationModule,
 * InstanceDbModule, ACL repositories) mirrors the original svc-view-engine
 * app.module.ts configuration exactly.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-foldins-migration.md):
 *   [x] navigation
 *   [x] transform
 *   [x] view
 *   [x] views-health.controller (renamed from health.controller)
 *   [x] views.module final composition
 *   [x] svc-view-engine app.module thin adapter
 */
@Module({
  imports: [
    InstanceDbModule,
    AuthGuardModule,
    GlobalGuardsModule,
    TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule]),
    AuthorizationModule.forRoot({
      enableCaching: true,
    }),
    NavigationResolveModule,
    TransformModule,
    ViewModule,
  ],
  controllers: [ViewsHealthController],
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
  exports: [NavigationResolveModule, TransformModule, ViewModule],
})
export class ViewsModule {}
