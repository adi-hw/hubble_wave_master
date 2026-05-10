import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AIModule } from '@hubblewave/ai';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AuthGuardModule, GlobalGuardsModule } from '@hubblewave/auth-guard';
import { AuthorizationModule } from '@hubblewave/authorization';
import { RedisModule } from '@hubblewave/redis';
import { ChatController } from './chat.controller';
import { EmbeddingController } from './embedding.controller';
import { AVAController } from './ava.controller';
import { AVAGovernanceController } from './ava-governance.controller';
import { AVASchemaController } from './ava-schema.controller';
import { AvaProposalController } from './ava-proposal.controller';
import { HealthController } from './health.controller';
import { SearchModule } from '../../../api/src/app/ava/search/search.module';
import { AvaToolsModule } from '../../../api/src/app/ava/ava-tools/ava-tools.module';
import { AvaPreviewService } from './ava-preview.service';
import { DatasetModule } from '../../../api/src/app/ava/modelops/dataset.module';
import { ModelRegistryModule } from '../../../api/src/app/ava/modelops/model-registry.module';
import { ModelEvaluationModule } from '../../../api/src/app/ava/modelops/model-evaluation.module';
import { TrainingModule } from '../../../api/src/app/ava/modelops/training.module';
import { ModelDeploymentModule } from '../../../api/src/app/ava/modelops/model-deployment.module';

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
    GlobalGuardsModule,
    AuthorizationModule.forInstance(),
    RedisModule.forRoot(),
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
    AvaProposalController,
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

