import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  AnalyticsEvent,
  InstanceEventOutbox,
  ModelArtifact,
  ModelDeployment,
  ProcessFlowDefinition,
} from '@hubblewave/instance-db';
import { ModelDeploymentController } from './model-deployment.controller';
import { ModelDeploymentService } from './model-deployment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModelDeployment,
      ModelArtifact,
      ProcessFlowDefinition,
      InstanceEventOutbox,
      AuditLog,
      AnalyticsEvent,
    ]),
  ],
  controllers: [ModelDeploymentController],
  providers: [ModelDeploymentService],
})
export class ModelDeploymentModule {}
