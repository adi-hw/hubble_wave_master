import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

// LLM Provider
import { VLLMProvider } from './providers/vllm.provider';
import { LLMService } from './llm.service';

// Core AI Services
import { VectorStoreService } from './vector-store.service';
import { EmbeddingService } from './embedding.service';
import { RAGService } from './rag.service';

// AVA Services
import { AVAService } from './ava.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { InsightsService } from './insights.service';
import { ActionExecutorService } from './action-executor.service';
import { AVAGovernanceService } from './ava-governance.service';
import { TenantContextService } from './instance-context.service';
import { PlatformKnowledgeService } from './platform-knowledge.service';
import { UpgradeAssistantService } from './upgrade-assistant.service';

// Queue Services
import { EmbeddingQueueService } from './embedding-queue.service';
import { EmbeddingWorkerService } from './embedding-worker.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
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
    ConversationMemoryService,
    InsightsService,
    AVAGovernanceService,
    ActionExecutorService,
    TenantContextService,
    PlatformKnowledgeService,
    UpgradeAssistantService,

    // Background Processing
    EmbeddingQueueService,
    EmbeddingWorkerService,
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
    ConversationMemoryService,
    InsightsService,
    AVAGovernanceService,
    ActionExecutorService,
    TenantContextService,
    PlatformKnowledgeService,
    UpgradeAssistantService,

    // Queue
    EmbeddingQueueService,
    EmbeddingWorkerService,
  ],
})
export class AIModule {}
