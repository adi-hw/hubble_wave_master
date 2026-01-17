import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AIModule } from '@hubblewave/ai';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import { AuthorizationModule } from '@hubblewave/authorization';
import { ChatController } from './chat.controller';
import { EmbeddingController } from './embedding.controller';
import { AVAController } from './ava.controller';
import { AVAGovernanceController } from './ava-governance.controller';
import { AVASchemaController } from './ava-schema.controller';
import { HealthController } from './health.controller';
import { SearchModule } from './search/search.module';
import { AvaToolsModule } from './ava-tools/ava-tools.module';
import { AvaPreviewService } from './ava-preview.service';
import { DatasetModule } from './modelops/dataset.module';
import { ModelRegistryModule } from './modelops/model-registry.module';
import { ModelEvaluationModule } from './modelops/model-evaluation.module';
import { TrainingModule } from './modelops/training.module';
import { ModelDeploymentModule } from './modelops/model-deployment.module';

// Phase 7 Controllers
import {
  NLQueryController,
  AIReportsController,
  VoiceControlController,
  PredictiveUIController,
  AgileDevelopmentController,
  LivingDocsController,
  PredictiveOpsController,
  DigitalTwinController,
  SelfHealingController,
  AppBuilderController,
  UpgradeAssistantController,
} from './phase7';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    InstanceDbModule,
    AIModule,
    AuthGuardModule,
    AuthorizationModule.forInstance(),
    SearchModule,
    AvaToolsModule,
    DatasetModule,
    ModelRegistryModule,
    ModelEvaluationModule,
    TrainingModule,
    ModelDeploymentModule,
  ],
  controllers: [
    HealthController,
    ChatController,
    EmbeddingController,
    AVAController,
    AVAGovernanceController,
    AVASchemaController,
    // Phase 7 Controllers
    NLQueryController,
    AIReportsController,
    VoiceControlController,
    PredictiveUIController,
    AgileDevelopmentController,
    LivingDocsController,
    PredictiveOpsController,
    DigitalTwinController,
    SelfHealingController,
    AppBuilderController,
    UpgradeAssistantController,
  ],
  providers: [AvaPreviewService],
})
export class AppModule {}

