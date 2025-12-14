import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ILLMProvider,
  LLMChatMessage,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMModelInfo,
  LLMEmbeddingResponse,
  LLMProviderStatus,
} from './llm-provider.interface';
import { VLLMProvider } from './providers/vllm.provider';

/**
 * Unified LLM Service
 * Wraps the vLLM provider with additional functionality for AVA
 */
@Injectable()
export class LLMService implements OnModuleInit {
  private readonly logger = new Logger(LLMService.name);
  private provider: ILLMProvider;

  constructor(
    // Reserved for future provider configuration
    _configService: ConfigService,
    vllmProvider: VLLMProvider
  ) {
    this.provider = vllmProvider;
  }

  async onModuleInit() {
    await this.provider.initialize();
    if (this.provider.isAvailable()) {
      this.logger.log(`LLM Service initialized with provider: ${this.provider.name}`);
    } else {
      this.logger.warn('LLM provider not available. AI features will be limited.');
    }
  }

  isAvailable(): boolean {
    return this.provider.isAvailable();
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async getStatus(): Promise<LLMProviderStatus> {
    return this.provider.getStatus();
  }

  async listModels(): Promise<LLMModelInfo[]> {
    return this.provider.listModels();
  }

  /**
   * Chat completion (non-streaming)
   */
  async chat(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResponse> {
    if (!this.provider.isAvailable()) {
      throw new Error('LLM provider not available');
    }
    return this.provider.chat(messages, options);
  }

  /**
   * Chat completion (streaming)
   */
  async *chatStream(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): AsyncGenerator<LLMStreamChunk> {
    if (!this.provider.isAvailable()) {
      throw new Error('LLM provider not available');
    }
    yield* this.provider.chatStream(messages, options);
  }

  /**
   * Generate embeddings
   */
  async embed(text: string): Promise<LLMEmbeddingResponse> {
    if (!this.provider.isAvailable()) {
      throw new Error('LLM provider not available');
    }
    return this.provider.embed(text);
  }

  /**
   * Batch embeddings
   */
  async embedBatch(texts: string[]): Promise<LLMEmbeddingResponse[]> {
    if (!this.provider.isAvailable()) {
      throw new Error('LLM provider not available');
    }
    return this.provider.embedBatch(texts);
  }

  /**
   * Simple completion helper
   */
  async complete(
    prompt: string,
    systemPrompt?: string,
    options?: LLMCompletionOptions
  ): Promise<string> {
    const messages: LLMChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.chat(messages, options);
    return response.content;
  }

  /**
   * Get embedding vector for text
   */
  async getEmbedding(text: string): Promise<number[]> {
    const response = await this.embed(text);
    return response.embedding;
  }

  /**
   * Get embedding vectors for multiple texts
   */
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    const responses = await this.embedBatch(texts);
    return responses.map((r) => r.embedding);
  }
}

// Re-export types for convenience
export {
  LLMChatMessage,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMModelInfo,
  LLMEmbeddingResponse,
  LLMProviderStatus,
} from './llm-provider.interface';
