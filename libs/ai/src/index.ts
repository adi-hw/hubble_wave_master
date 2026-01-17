// AI Module
export { AIModule } from './lib/ai.module';

// LLM Provider Interface
export {
  ILLMProvider,
  LLMChatMessage,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMModelInfo,
  LLMEmbeddingResponse,
  LLMProviderStatus,
} from './lib/llm-provider.interface';

// vLLM Provider
export { VLLMProvider } from './lib/providers/vllm.provider';

// LLM Service
export {
  LLMService,
} from './lib/llm.service';

// Vector Store
export {
  VectorStoreService,
  DocumentChunk,
  SearchResult,
  VectorSearchOptions,
} from './lib/vector-store.service';

// Embedding Service
export {
  EmbeddingService,
  TextChunk,
  ChunkingOptions,
  IndexingResult,
} from './lib/embedding.service';

// RAG Service
export {
  RAGService,
  RAGContext,
  RAGResponse,
  RAGOptions,
} from './lib/rag.service';

// AVA - AI Virtual Assistant
export {
  AVAService,
  AVAContext,
  AVAMessage,
  AVASource,
  AVAAction,
  AVAResponse,
  AVAInsight,
  AVA_BRANDING,
} from './lib/ava.service';

// Conversation Memory
export {
  ConversationMemoryService,
  Conversation,
  ConversationSummary,
} from './lib/conversation-memory.service';

// Insights Engine
export {
  InsightsService,
  InsightRule,
  InsightContext,
} from './lib/insights.service';

// Action Executor
export {
  ActionExecutorService,
  ActionRequest,
  ActionResult,
  ActionPermission,
} from './lib/action-executor.service';

// AVA Governance
export {
  AVAGovernanceService,
  PermissionCheckResult,
  AuditEntry,
  RevertResult,
  AuditQueryOptions,
  RateLimitCheck,
} from './lib/ava-governance.service';

// Instance Context (for instance-specific AVA behavior)
export {
  InstanceContextService,
  InstanceProfile,
  CollectionContext,
  ModuleContext,
  BusinessRuleContext,
  InstanceMetrics,
  UserProfile,
  // Deprecated aliases for backward compatibility
  TenantContextService,
  TenantProfile,
  TenantMetrics,
} from './lib/instance-context.service';

// Platform Knowledge (AVA's knowledge of platform capabilities)
export {
  PlatformKnowledgeService,
  PlatformCapability,
  PlatformCategory,
  PlatformModule,
  PlatformFeature,
} from './lib/platform-knowledge.service';

// Upgrade Assistant (pre/during/post upgrade help)
export {
  UpgradeAssistantService,
  UpgradeContext,
  CustomizationSummary,
  UpgradeImpactSummary,
  UpgradeConflict,
  NewFeature,
  DeprecationNotice,
  UpgradeGuidance,
  ActionItem,
} from './lib/upgrade-assistant.service';

// AVA Schema Assistance (Phase 2)
export {
  AVASchemaService,
  DesignCollectionDto,
  RecommendPropertiesDto,
  CreateFormulaDto,
  DebugFormulaDto,
  OptimizeFormulaDto,
  DesignViewDto,
  AssessImpactDto,
  FormulaDebugResult,
  FormulaOptimization,
} from './lib/ava-schema.service';

// Phase 1 Intents
export {
  Phase1IntentCategory,
  AvaContext,
  AvaResponse,
  matchPhase1Intent,
  AvaResponseTemplates,
} from './lib/intents/phase1-intents';

// Phase 2 Intents
export {
  Phase2IntentCategory,
  IntentMatch,
  FormulaIntent,
  FormulaResult,
  SchemaDesignIntent,
  SchemaRecommendation,
  PropertyRecommendation,
  RelationshipRecommendation,
  ViewDesignIntent,
  ViewRecommendation,
  ImpactAssessment,
  matchIntent,
} from './lib/intents/phase2-intents';

// Embedding Queue
export {
  EmbeddingQueueService,
  EmbeddingJob,
  EmbeddingJobResult,
  QueueStats,
} from './lib/embedding-queue.service';

// Embedding Worker
export {
  EmbeddingWorkerService,
  GetInstanceDataSourceFn,
  FetchSourceDataFn,
  // Deprecated alias for backward compatibility
  GetTenantDataSourceFn,
} from './lib/embedding-worker.service';

// Type alias for ChatMessage
import type { LLMChatMessage } from './lib/llm-provider.interface';
export type ChatMessage = LLMChatMessage;

// ============================================================
// Phase 7: Revolutionary Features Services
// ============================================================

// AVA-Powered Agile Development
export { AgileDevelopmentService } from './lib/phase7/agile-development.service';

// Living Documentation System
export { LivingDocsService } from './lib/phase7/living-docs.service';

// Predictive Operations
export { PredictiveOpsService } from './lib/phase7/predictive-ops.service';

// Digital Twin & IoT/Sensor Integration
export { DigitalTwinService } from './lib/phase7/digital-twin.service';

// Self-Healing Infrastructure
export { SelfHealingService } from './lib/phase7/self-healing.service';

// Natural Language Queries
export { NLQueryService } from './lib/phase7/nl-query.service';

// AI Report Generator
export { AIReportsService } from './lib/phase7/ai-reports.service';

// Voice Control
export { VoiceControlService } from './lib/phase7/voice-control.service';

// Predictive UI
export { PredictiveUIService, UserContext, UISuggestion } from './lib/phase7/predictive-ui.service';

// Zero-Code App Builder
export { AppBuilderService } from './lib/phase7/app-builder.service';

// Intelligent Upgrade Assistant (Phase 7)
export { Phase7UpgradeAssistantService } from './lib/phase7/upgrade-assistant.service';
