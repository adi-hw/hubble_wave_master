import { Module } from '@nestjs/common';
import { AlertsModule } from './alerts/alerts.module';
import { AuditIntegrityModule } from './audit-integrity/audit-integrity.module';
import { BackupModule } from './backup/backup.module';
import { DashboardsModule } from './dashboards/dashboards.module';

/**
 * AnalyticsModule consolidates svc-insights into apps/api per spec §2.
 * Sub-areas: alerts, audit-integrity, backup, dashboards, metrics.
 * Plus an AnalyticsHealthController (renamed from svc-insights's
 * HealthController; route '/analytics/health').
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-foldins-migration.md):
 *   [x] alerts
 *   [x] audit-integrity
 *   [x] backup
 *   [x] dashboards
 *   [ ] metrics
 *   [ ] analytics-health.controller (renamed from health.controller)
 *   [ ] analytics.module final composition
 *   [ ] svc-insights app.module thin adapter
 */
@Module({
  imports: [AlertsModule, AuditIntegrityModule, BackupModule, DashboardsModule],
  controllers: [],
  providers: [],
  exports: [AlertsModule, AuditIntegrityModule, BackupModule, DashboardsModule],
})
export class AnalyticsModule {}
