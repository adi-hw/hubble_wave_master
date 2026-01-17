import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AnalyticsEvent,
  CollectionDefinition,
  MetricDefinition,
  MetricPoint,
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
    ]),
  ],
  providers: [MetricsService],
  controllers: [MetricsController],
})
export class MetricsModule {}
