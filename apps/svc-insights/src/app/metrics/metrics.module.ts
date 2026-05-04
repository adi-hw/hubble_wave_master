import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AnalyticsEvent,
  AuditLog,
  CollectionDefinition,
  MetricDefinition,
  MetricPoint,
  User,
} from '@hubblewave/instance-db';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MetricDefinition,
      MetricPoint,
      CollectionDefinition,
      AnalyticsEvent,
      AuditLog,
      User,
    ]),
  ],
  providers: [MetricsService],
  controllers: [MetricsController],
})
export class MetricsModule {}
