import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  ILLMProvider,
  LLMChatMessage,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMModelInfo,
  LLMEmbeddingResponse,
  LLMProviderStatus,
} from '../llm-provider.interface';

/**
 * vLLM Provider
 * Best for: Production, high-throughput, multi-GPU deployments
 * Features: PagedAttention, continuous batching, OpenAI-compatible API
 *
 * vLLM exposes an OpenAI-compatible API at /v1/chat/completions
 * For embeddings, it uses /v1/embeddings
 */
@Injectable()
export class VLLMProvider implements ILLMProvider, OnModuleInit {
  readonly name = 'vllm';
  private readonly logger = new Logger(VLLMProvider.name);
  private baseUrl: string;
  private defaultModel: string;
  private embeddingModel: string;
  private apiKey: string;
  private available = false;

  constructor() {
    this.baseUrl = process.env['VLLM_BASE_URL'] || process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
    this.defaultModel = process.env['VLLM_DEFAULT_MODEL'] || process.env['OLLAMA_MODEL'] || 'llama3:latest';
    this.embeddingModel = process.env['VLLM_EMBEDDING_MODEL'] || process.env['OLLAMA_EMBEDDING_MODEL'] || 'nomic-embed-text';
    this.apiKey = process.env['VLLM_API_KEY'] || '';

    this.logger.log(`LLM Provider initialized - URL: ${this.baseUrl}, Model: ${this.defaultModel}`);
  }

  async onModuleInit() {
    await this.initialize();
  }

  isAvailable(): boolean {
    return this.available;
  }

  async initialize(): Promise<boolean> {
    try {
      // Support both /v1 suffix in URL and without
      const modelsUrl = this.baseUrl.endsWith('/v1')
        ? `${this.baseUrl}/models`
        : `${this.baseUrl}/v1/models`;
      const response = await fetch(modelsUrl, {
        headers: this.getHeaders(),
      });
      if (response.ok) {
        this.available = true;
        const data = await response.json();
        this.logger.log(
          `LLM connected at ${this.baseUrl}. Available models: ${data.data?.length || 0}`
        );
        return true;
      }
      this.available = false;
      return false;
    } catch {
      this.available = false;
      this.logger.warn(
        `LLM not available at ${this.baseUrl}. AI features will be limited.`
      );
      return false;
    }
  }

  async getStatus(): Promise<LLMProviderStatus> {
    const models = this.available ? await this.listModels() : [];
    return {
      available: this.available,
      provider: this.name,
      defaultModel: this.defaultModel,
      embeddingModel: this.embeddingModel,
      availableModels: models,
    };
  }

  private getApiUrl(endpoint: string): string {
    // Support both /v1 suffix in URL and without
    return this.baseUrl.endsWith('/v1')
      ? `${this.baseUrl}${endpoint}`
      : `${this.baseUrl}/v1${endpoint}`;
  }

  async listModels(): Promise<LLMModelInfo[]> {
    try {
      const response = await fetch(this.getApiUrl('/models'), {
        headers: this.getHeaders(),
      });
      if (!response.ok) return [];

      const data = await response.json();
      return (data.data || []).map((m: { id: string; max_model_len?: number }) => ({
        name: m.id,
        contextLength: m.max_model_len,
      }));
    } catch {
      return [];
    }
  }

  async chat(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResponse> {
    const startTime = Date.now();

    const response = await fetch(this.getApiUrl('/chat/completions'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.defaultModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        top_p: options?.topP ?? 1.0,
        stop: options?.stopSequences,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`vLLM chat failed: ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      model: data.model || this.defaultModel,
      finishReason: choice?.finish_reason === 'stop' ? 'stop' :
                    choice?.finish_reason === 'length' ? 'length' : undefined,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      duration,
    };
  }

  async *chatStream(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): AsyncGenerator<LLMStreamChunk> {
    const response = await fetch(this.getApiUrl('/chat/completions'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.defaultModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        top_p: options?.topP ?? 1.0,
        stop: options?.stopSequences,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`vLLM stream failed: ${response.statusText} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') {
          yield { content: '', done: true };
          return;
        }

        try {
          const data = JSON.parse(jsonStr);
          const choice = data.choices?.[0];
          const content = choice?.delta?.content || '';
          const isDone = choice?.finish_reason !== null;

          if (content || isDone) {
            yield {
              content,
              done: isDone,
              model: data.model,
            };
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  async embed(text: string): Promise<LLMEmbeddingResponse> {
    const response = await fetch(this.getApiUrl('/embeddings'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.embeddingModel,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`vLLM embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding || [];

    return {
      embedding,
      model: this.embeddingModel,
      tokenCount: data.usage?.total_tokens,
    };
  }

  async embedBatch(texts: string[]): Promise<LLMEmbeddingResponse[]> {
    // vLLM supports batch embeddings natively
    const response = await fetch(this.getApiUrl('/embeddings'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.embeddingModel,
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`vLLM batch embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.data || []).map((item: { embedding: number[]; index: number }) => ({
      embedding: item.embedding,
      model: this.embeddingModel,
    }));
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  // vLLM-specific: Get server metrics
  async getMetrics(): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(`${this.baseUrl}/metrics`);
      if (response.ok) {
        return { raw: await response.text() };
      }
      return null;
    } catch {
      return null;
    }
  }
}
