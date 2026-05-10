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
import { AvaHealthController } from './ava-health.controller';
import { AvaPreviewService } from './ava-preview.service';

import { SearchModule } from './search/search.module';
import { AvaToolsModule } from './ava-tools/ava-tools.module';
import { DatasetModule } from './modelops/dataset.module';
import { ModelRegistryModule } from './modelops/model-registry.module';
import { ModelEvaluationModule } from './modelops/model-evaluation.module';
import { TrainingModule } from './modelops/training.module';
import { ModelDeploymentModule } from './modelops/model-deployment.module';

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

/**
 * AvaModule — canonical home for the AVA reasoning layer (formerly apps/svc-ava).
 * Per canon §11, AVA is "a reasoning layer over platform state" — chat,
 * RAG search, embeddings, governance, schema actions, AI-driven proposals,
 * MLOps lifecycle, and the Phase 7 AI surface (NL queries, AI reports, voice
 * control, predictive UI/ops, etc.).
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-ava-migration.md):
 *   Sub-areas:
 *     [x] ava-tools (AvaToolsModule)
 *     [x] search (SearchModule)
 *     [x] modelops (5 modules: Dataset/ModelRegistry/ModelEvaluation/Training/ModelDeployment)
 *     [x] phase7 (11 standalone controllers + barrel)
 *   Final top-level (7 controllers + 1 service + app.module thin adapter):
 *     [x] ava-health.controller (renamed from health.controller; route 'ava/health')
 *     [x] chat, embedding, AVA, AVAGovernance, AVASchema, AvaProposal controllers
 *     [x] AvaPreviewService
 *     [x] ava.module final composition
 *     [x] svc-ava app.module thin adapter
 *
 * apps/svc-ava is reduced to a thin adapter that imports AvaModule from
 * apps/api so the legacy service serves the same endpoints during parallel
 * deployment.
 *
 * Note: there is also a class named AvaModule at apps/api/src/app/automation/ava/ava.module.ts
 * (svc-automation's natural-language automation-rule generator). That is a
 * distinct class in a distinct namespace — different files, different scopes.
 * Consumers that need both alias one on import.
 */
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
    AvaHealthController,
    ChatController,
    EmbeddingController,
    AVAController,
    AVAGovernanceController,
    AVASchemaController,
    AvaProposalController,
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
  exports: [
    SearchModule,
    AvaToolsModule,
    DatasetModule,
    ModelRegistryModule,
    ModelEvaluationModule,
    TrainingModule,
    ModelDeploymentModule,
    AvaPreviewService,
  ],
})
export class AvaModule {}
