import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AlertDefinition,
  AuditLog,
  InstanceEventOutbox,
  MetricDefinition,
  MetricPoint,
  ProcessFlowDefinition,
} from '@hubblewave/instance-db';
import { AlertsService } from './alerts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlertDefinition,
      MetricDefinition,
      MetricPoint,
      ProcessFlowDefinition,
      InstanceEventOutbox,
      AuditLog,
    ]),
  ],
  providers: [AlertsService],
})
export class AlertsModule {}
