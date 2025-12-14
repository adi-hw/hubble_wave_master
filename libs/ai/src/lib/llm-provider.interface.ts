/**
 * LLM Provider Abstraction Layer
 * Allows swapping between Ollama, vLLM, OpenAI, etc.
 */

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  finishReason?: 'stop' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  duration?: number;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  model?: string;
  duration?: number;
}

export interface LLMModelInfo {
  name: string;
  size?: number;
  contextLength?: number;
  capabilities?: string[];
}

export interface LLMEmbeddingResponse {
  embedding: number[];
  model: string;
  tokenCount?: number;
}

export interface LLMProviderStatus {
  available: boolean;
  provider: string;
  defaultModel: string;
  embeddingModel: string;
  availableModels: LLMModelInfo[];
}

/**
 * Abstract interface for LLM providers
 * Implementations: OllamaProvider, vLLMProvider, OpenAIProvider, etc.
 */
export interface ILLMProvider {
  readonly name: string;

  /**
   * Check if the provider is available
   */
  isAvailable(): boolean;

  /**
   * Initialize the provider and check health
   */
  initialize(): Promise<boolean>;

  /**
   * Get provider status and available models
   */
  getStatus(): Promise<LLMProviderStatus>;

  /**
   * List available models
   */
  listModels(): Promise<LLMModelInfo[]>;

  /**
   * Chat completion (non-streaming)
   */
  chat(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResponse>;

  /**
   * Chat completion (streaming)
   */
  chatStream(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): AsyncGenerator<LLMStreamChunk>;

  /**
   * Generate embeddings for text
   */
  embed(text: string): Promise<LLMEmbeddingResponse>;

  /**
   * Batch embed multiple texts
   */
  embedBatch(texts: string[]): Promise<LLMEmbeddingResponse[]>;
}
