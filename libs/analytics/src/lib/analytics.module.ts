import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent, AggregatedMetric, Report } from './analytics-entities';
import { AnalyticsService } from './analytics.service';
import { ReportingService } from './reporting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalyticsEvent, AggregatedMetric, Report]),
    EventEmitterModule.forRoot(),
  ],
  providers: [AnalyticsService, ReportingService],
  exports: [AnalyticsService, ReportingService],
})
export class AnalyticsModule {}

