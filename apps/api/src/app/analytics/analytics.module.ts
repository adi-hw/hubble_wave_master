import { Module } from '@nestjs/common';
import { AnalyticsModule as AnalyticsLibModule } from '@hubblewave/analytics';
import { AlertsModule } from './alerts/alerts.module';
import { AuditIntegrityModule } from './audit-integrity/audit-integrity.module';
import { BackupModule } from './backup/backup.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { MetricsModule } from './metrics/metrics.module';
import { AnalyticsHealthController } from './analytics-health.controller';

/**
 * AnalyticsModule consolidates svc-insights into apps/api per spec §2.
 * Sub-areas: alerts, audit-integrity, backup, dashboards, metrics.
 * Route prefix for health check: '/analytics/health'.
 *
 * AnalyticsLibModule (@hubblewave/analytics) provides the platform-level
 * analytics event tracking and reporting infrastructure (AnalyticsService,
 * ReportingService) consumed by the analytics sub-domains.
 *
 * Global infrastructure (ConfigModule, AuthGuardModule, GlobalGuardsModule,
 * InstanceDbModule, AuthorizationModule, ScheduleModule) is registered at
 * apps/api root; AnalyticsModule consumes them as peer dependencies.
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-foldins-migration.md):
 *   [x] alerts
 *   [x] audit-integrity
 *   [x] backup
 *   [x] dashboards
 *   [x] metrics
 *   [x] analytics-health.controller (renamed from health.controller)
 *   [x] analytics.module final composition
 *   [x] svc-insights app.module thin adapter
 */
@Module({
  imports: [
    AnalyticsLibModule,
    AlertsModule,
    AuditIntegrityModule,
    BackupModule,
    DashboardsModule,
    MetricsModule,
  ],
  controllers: [AnalyticsHealthController],
  providers: [],
  exports: [AnalyticsLibModule, AlertsModule, AuditIntegrityModule, BackupModule, DashboardsModule, MetricsModule],
})
export class AnalyticsModule {}
