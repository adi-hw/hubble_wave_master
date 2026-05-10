import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, AnalyticsEvent, DatasetSnapshot, ModelArtifact, ModelEvaluation } from '@hubblewave/instance-db';
import { ModelEvaluationController } from './model-evaluation.controller';
import { ModelEvaluationService } from './model-evaluation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModelArtifact, ModelEvaluation, DatasetSnapshot, AuditLog, AnalyticsEvent]),
  ],
  controllers: [ModelEvaluationController],
  providers: [ModelEvaluationService],
})
export class ModelEvaluationModule {}
