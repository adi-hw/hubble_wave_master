import { Module } from '@nestjs/common';
import { NavigationResolveModule } from './navigation/navigation.module';
import { TransformModule } from './transform/transform.module';
import { ViewModule } from './view/view.module';

/**
 * ViewsModule consolidates svc-view-engine into apps/api per spec §2.
 * Sub-areas: navigation, transform, view. Plus a ViewsHealthController
 * (renamed from svc-view-engine's HealthController; route 'views/health').
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-foldins-migration.md):
 *   [x] navigation
 *   [x] transform
 *   [x] view
 *   [ ] views-health.controller (renamed from health.controller)
 *   [ ] views.module final composition
 *   [ ] svc-view-engine app.module thin adapter
 */
@Module({
  imports: [NavigationResolveModule, TransformModule, ViewModule],
  controllers: [],
  providers: [],
  exports: [NavigationResolveModule, TransformModule, ViewModule],
})
export class ViewsModule {}
