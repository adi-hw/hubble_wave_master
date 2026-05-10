import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthGuardModule, GlobalGuardsModule } from '@hubblewave/auth-guard';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AuthorizationModule } from '@hubblewave/authorization';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsModule } from '../../../api/src/app/analytics/analytics.module';

/**
 * Thin adapter: svc-insights re-exports AnalyticsModule from apps/api.
 * All analytics domain logic (alerts, audit-integrity, backup, dashboards,
 * metrics) now lives at apps/api/src/app/analytics/.
 *
 * ARC-W1 Task 4 — W1 final cutover will delete apps/svc-insights entirely.
 * AnalyticsModule inside apps/api will serve all analytics endpoints.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthGuardModule,
    GlobalGuardsModule,
    InstanceDbModule,
    AuthorizationModule.forInstance(),
    ScheduleModule.forRoot(),
    AnalyticsModule,
  ],
  controllers: [],
})
export class AppModule {}
