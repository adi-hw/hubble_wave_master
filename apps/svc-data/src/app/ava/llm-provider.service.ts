/**
 * LLM Provider Service
 * HubbleWave Platform - Phase 6
 *
 * Manages LLM provider integration with fallback support.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

interface AIContext {
  user: {
    id: string;
    name: string;
    role: string;
  };
  organization: {
    id: string;
    name: string;
  };
  permissions: string[];
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AvailableAction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  required?: string[];
}

interface AIRequest {
  messages: ConversationMessage[];
  context: AIContext;
  maxTokens?: number;
  temperature?: number;
  availableActions?: AvailableAction[];
  requiresFreshData?: boolean;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface AIResponse {
  id: string;
  content: string;
  toolCalls: ToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latency: number;
  model: string;
}

interface LLMProviderConfig {
  claudeApiKey?: string;
  claudeBaseUrl?: string;
  openaiApiKey?: string;
  timeout?: number;
}

@Injectable()
export class LLMProviderService {
  private readonly logger = new Logger(LLMProviderService.name);
  private config: LLMProviderConfig;
  private responseCache = new Map<string, { response: AIResponse; timestamp: number }>();
  private readonly cacheTTL = 3600000; // 1 hour

  constructor() {
    this.config = {
      claudeApiKey: process.env['ANTHROPIC_API_KEY'],
      claudeBaseUrl: process.env['ANTHROPIC_BASE_URL'] || 'https://api.anthropic.com',
      openaiApiKey: process.env['OPENAI_API_KEY'],
      timeout: 30000,
    };
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cached = this.getCachedResponse(cacheKey);
    if (cached && this.isCacheable(request)) {
      this.logger.debug('Cache hit for LLM request');
      return cached;
    }

    // Try primary provider (Claude)
    if (this.config.claudeApiKey) {
      try {
        const response = await this.callClaude(request);
        if (this.isCacheable(request)) {
          this.cacheResponse(cacheKey, response);
        }
        return response;
      } catch (error) {
        this.logger.warn('Claude API failed, trying fallback', error);
      }
    }

    // Fallback to OpenAI
    if (this.config.openaiApiKey) {
      try {
        const response = await this.callOpenAI(request);
        return response;
      } catch (error) {
        this.logger.error('OpenAI fallback failed', error);
        throw error;
      }
    }

    // No provider available, return mock response for development
    return this.getMockResponse(request);
  }

  private async callClaude(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const systemPrompt = this.buildSystemPrompt(request.context);

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature || 0.7,
      system: systemPrompt,
      messages: request.messages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
      tools: request.availableActions?.map((action) => ({
        name: action.name,
        description: action.description,
        input_schema: {
          type: 'object',
          properties: action.parameters,
          required: action.required || [],
        },
      })),
    };

    const response = await fetch(`${this.config.claudeBaseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.claudeApiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    return {
      id: data.id,
      content: this.extractContent(data),
      toolCalls: this.extractToolCalls(data),
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      latency,
      model: 'claude-sonnet-4-20250514',
    };
  }

  private async callOpenAI(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const systemPrompt = this.buildSystemPrompt(request.context);

    const body = {
      model: 'gpt-4-turbo-preview',
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature || 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...request.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ],
      tools: request.availableActions?.map((action) => ({
        type: 'function',
        function: {
          name: action.name,
          description: action.description,
          parameters: {
            type: 'object',
            properties: action.parameters,
            required: action.required || [],
          },
        },
      })),
      tool_choice: 'auto',
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.openaiApiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;
    const message = data.choices[0].message;

    return {
      id: data.id,
      content: message.content || '',
      toolCalls: this.extractOpenAIToolCalls(message),
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      latency,
      model: 'gpt-4-turbo-preview',
    };
  }

  private getMockResponse(request: AIRequest): AIResponse {
    const lastUserMessage = request.messages.filter((m) => m.role === 'user').pop();
    const userContent = lastUserMessage?.content.toLowerCase() || '';

    let responseContent = "I'm AVA, your virtual assistant. How can I help you today?";

    if (userContent.includes('ticket') || userContent.includes('issue')) {
      responseContent =
        "I can help you with tickets. Would you like me to create a new ticket, search for existing tickets, or view your assigned tickets?";
    } else if (userContent.includes('asset')) {
      responseContent =
        "I can help you manage assets. Would you like to search for assets, view asset details, or track an asset?";
    } else if (userContent.includes('help') || userContent.includes('what can you do')) {
      responseContent = `Hi ${request.context.user.name}! I'm AVA, your intelligent assistant. I can help you with:

• Ticket Management - Create, search, update, and close tickets
• Asset Management - Search, track, and allocate assets
• Knowledge Base - Find articles and documentation
• Analytics - Generate reports and insights
• Process Flows - Trigger automations and approvals

Just tell me what you need!`;
    } else if (userContent.includes('hello') || userContent.includes('hi')) {
      responseContent = `Hello ${request.context.user.name}! I'm AVA, your intelligent assistant at ${request.context.organization.name}. How can I help you today?`;
    }

    return {
      id: `mock-${Date.now()}`,
      content: responseContent,
      toolCalls: [],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      latency: 50,
      model: 'mock-provider',
    };
  }

  private buildSystemPrompt(context: AIContext): string {
    return `You are AVA (Autonomous Virtual Assistant), an intelligent AI assistant for the HubbleWave ITSM platform.

Current Context:
- User: ${context.user.name} (${context.user.role})
- Organization: ${context.organization.name}
- Permissions: ${context.permissions.join(', ')}
- Current Time: ${new Date().toISOString()}

Your Capabilities:
- Ticket management (create, update, search, assign, close)
- Asset tracking and allocation
- Procurement request processing
- Knowledge base search and recommendations
- Analytics and reporting
- Process flow automation

Guidelines:
- Be concise, helpful, and professional
- Always verify user permissions before actions
- Provide actionable suggestions
- Ask for clarification when uncertain
- Explain your reasoning when making recommendations
- Use natural, conversational language

Remember: You have access to tools for performing actions. Use them when appropriate.`;
  }

  private extractContent(response: Record<string, unknown>): string {
    const content = response.content as Array<{ type: string; text?: string }>;
    if (!content) return '';

    const textBlocks = content.filter((block) => block.type === 'text');
    return textBlocks.map((block) => block.text || '').join('');
  }

  private extractToolCalls(response: Record<string, unknown>): ToolCall[] {
    const content = response.content as Array<{
      type: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
    if (!content) return [];

    const toolBlocks = content.filter((block) => block.type === 'tool_use');
    return toolBlocks.map((block) => ({
      id: block.id || '',
      name: block.name || '',
      arguments: block.input || {},
    }));
  }

  private extractOpenAIToolCalls(message: Record<string, unknown>): ToolCall[] {
    const toolCalls = message.tool_calls as Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;
    if (!toolCalls) return [];

    return toolCalls.map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: JSON.parse(call.function.arguments),
    }));
  }

  private generateCacheKey(request: AIRequest): string {
    const hash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          messages: request.messages,
          context: request.context.user.id,
        }),
      )
      .digest('hex');
    return `llm:${hash}`;
  }

  private isCacheable(request: AIRequest): boolean {
    return !request.availableActions?.length && !request.requiresFreshData;
  }

  private getCachedResponse(key: string): AIResponse | null {
    const cached = this.responseCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.responseCache.delete(key);
      return null;
    }

    return cached.response;
  }

  private cacheResponse(key: string, response: AIResponse): void {
    this.responseCache.set(key, {
      response,
      timestamp: Date.now(),
    });

    // Cleanup old entries
    if (this.responseCache.size > 1000) {
      const oldestKey = this.responseCache.keys().next().value;
      if (oldestKey) {
        this.responseCache.delete(oldestKey);
      }
    }
  }
}
