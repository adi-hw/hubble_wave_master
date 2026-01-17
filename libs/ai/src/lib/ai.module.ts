import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@hubblewave/redis';

// Core & Phase 7 Entities
import {
  // Core entities needed by Phase 7 services
  CollectionDefinition,
  PropertyDefinition,
  // Phase 7 Entities
  SprintRecording,
  AvaStory,
  StoryImplementation,
  CustomizationRegistry,
  UpgradeImpactAnalysis,
  UpgradeFix,
  GeneratedDocumentation,
  DocumentationVersion,
  PredictiveInsight,
  InsightAnalysisJob,
  DigitalTwin,
  SensorReading,
  SelfHealingEvent,
  ServiceHealthStatus,
  RecoveryAction,
  AIReport,
  AIReportTemplate,
  NLQuery,
  SavedNLQuery,
  ZeroCodeApp,
  ZeroCodeAppVersion,
  AppBuilderComponent,
  VoiceCommand,
  VoiceCommandPattern,
  UserBehavior,
  PredictiveSuggestion,
  UserPattern,
} from '@hubblewave/instance-db';

// LLM Provider
import { VLLMProvider } from './providers/vllm.provider';
import { LLMService } from './llm.service';

// Core AI Services
import { VectorStoreService } from './vector-store.service';
import { EmbeddingService } from './embedding.service';
import { RAGService } from './rag.service';

// AVA Services
import { AVAService } from './ava.service';
import { AVASchemaService } from './ava-schema.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { InsightsService } from './insights.service';
import { ActionExecutorService } from './action-executor.service';
import { AVAGovernanceService } from './ava-governance.service';
import { InstanceContextService } from './instance-context.service';
import { PlatformKnowledgeService } from './platform-knowledge.service';
import { UpgradeAssistantService } from './upgrade-assistant.service';

// Queue Services
import { EmbeddingQueueService } from './embedding-queue.service';
import { EmbeddingWorkerService } from './embedding-worker.service';

// Phase 7: Revolutionary Features
import {
  AgileDevelopmentService,
  LivingDocsService,
  PredictiveOpsService,
  DigitalTwinService,
  SelfHealingService,
  NLQueryService,
  AIReportsService,
  VoiceControlService,
  PredictiveUIService,
  AppBuilderService,
  Phase7UpgradeAssistantService,
} from './phase7';

@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    RedisModule,
    TypeOrmModule.forFeature([
      // Core entities needed by Phase 7 services
      CollectionDefinition,
      PropertyDefinition,
      // Agile Development
      SprintRecording,
      AvaStory,
      StoryImplementation,
      // Upgrade Assistant
      CustomizationRegistry,
      UpgradeImpactAnalysis,
      UpgradeFix,
      // Living Documentation
      GeneratedDocumentation,
      DocumentationVersion,
      // Predictive Operations
      PredictiveInsight,
      InsightAnalysisJob,
      // Digital Twins
      DigitalTwin,
      SensorReading,
      // Self-Healing
      SelfHealingEvent,
      ServiceHealthStatus,
      RecoveryAction,
      // AI Reports
      AIReport,
      AIReportTemplate,
      // Natural Language Query
      NLQuery,
      SavedNLQuery,
      // Zero-Code App Builder
      ZeroCodeApp,
      ZeroCodeAppVersion,
      AppBuilderComponent,
      // Voice Control
      VoiceCommand,
      VoiceCommandPattern,
      // Predictive UI
      UserBehavior,
      PredictiveSuggestion,
      UserPattern,
    ]),
  ],
  providers: [
    // LLM Provider (vLLM)
    VLLMProvider,
    LLMService,

    // Core AI
    VectorStoreService,
    EmbeddingService,
    RAGService,

    // AVA - AI Virtual Assistant
    AVAService,
    AVASchemaService,
    ConversationMemoryService,
    InsightsService,
    AVAGovernanceService,
    ActionExecutorService,
    InstanceContextService,
    PlatformKnowledgeService,
    UpgradeAssistantService,

    // Background Processing
    EmbeddingQueueService,
    EmbeddingWorkerService,

    // Phase 7: Revolutionary Features
    AgileDevelopmentService,
    LivingDocsService,
    PredictiveOpsService,
    DigitalTwinService,
    SelfHealingService,
    NLQueryService,
    AIReportsService,
    VoiceControlService,
    PredictiveUIService,
    AppBuilderService,
    Phase7UpgradeAssistantService,
  ],
  exports: [
    // LLM
    VLLMProvider,
    LLMService,

    // Core AI
    VectorStoreService,
    EmbeddingService,
    RAGService,

    // AVA
    AVAService,
    AVASchemaService,
    ConversationMemoryService,
    InsightsService,
    AVAGovernanceService,
    ActionExecutorService,
    InstanceContextService,
    PlatformKnowledgeService,
    UpgradeAssistantService,

    // Queue
    EmbeddingQueueService,
    EmbeddingWorkerService,

    // Phase 7: Revolutionary Features
    AgileDevelopmentService,
    LivingDocsService,
    PredictiveOpsService,
    DigitalTwinService,
    SelfHealingService,
    NLQueryService,
    AIReportsService,
    VoiceControlService,
    PredictiveUIService,
    AppBuilderService,
    Phase7UpgradeAssistantService,
  ],
})
export class AIModule {}
