import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { AnalyticsService } from './analytics.service';
import { ReportingService } from './reporting.service';

@Module({
  imports: [
    TenantDbModule,
    EventEmitterModule.forRoot(),
  ],
  providers: [AnalyticsService, ReportingService],
  exports: [AnalyticsService, ReportingService],
})
export class AnalyticsModule {}
