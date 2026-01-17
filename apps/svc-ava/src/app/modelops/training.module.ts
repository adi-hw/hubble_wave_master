import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '@hubblewave/storage';
import {
  AuditLog,
  AnalyticsEvent,
  DatasetSnapshot,
  InstanceEventOutbox,
  ModelArtifact,
  ModelTrainingJob,
} from '@hubblewave/instance-db';
import { TrainingController } from './training.controller';
import { ModelTrainingService } from './training.service';
import { TrainingProcessorService } from './training-processor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModelTrainingJob,
      DatasetSnapshot,
      ModelArtifact,
      InstanceEventOutbox,
      AuditLog,
      AnalyticsEvent,
    ]),
    StorageModule,
  ],
  controllers: [TrainingController],
  providers: [ModelTrainingService, TrainingProcessorService],
})
export class TrainingModule {}
