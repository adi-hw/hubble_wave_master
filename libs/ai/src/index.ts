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

// Tenant Context (for tenant-specific AVA behavior)
export {
  TenantContextService,
  TenantProfile,
  CollectionContext,
  ModuleContext,
  BusinessRuleContext,
  TenantMetrics,
  UserProfile,
} from './lib/tenant-context.service';

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
  GetTenantDataSourceFn,
  FetchSourceDataFn,
} from './lib/embedding-worker.service';

// Legacy exports for backward compatibility (ChatMessage type)
import type { LLMChatMessage } from './lib/llm-provider.interface';
export type ChatMessage = LLMChatMessage;
