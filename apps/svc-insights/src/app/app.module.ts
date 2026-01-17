import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AnalyticsModule } from '@hubblewave/analytics';
import { AuthorizationModule } from '@hubblewave/authorization';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { MetricsModule } from './metrics/metrics.module';
import { AlertsModule } from './alerts/alerts.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { BackupModule } from './backup/backup.module';
import { AuditIntegrityModule } from './audit-integrity/audit-integrity.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthGuardModule,
    InstanceDbModule,
    AnalyticsModule,
    AuthorizationModule.forInstance(),
    ScheduleModule.forRoot(),
    MetricsModule,
    AlertsModule,
    DashboardsModule,
    BackupModule,
    AuditIntegrityModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
