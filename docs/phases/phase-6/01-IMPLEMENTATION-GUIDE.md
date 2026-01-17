# Phase 6: AVA Intelligence - Implementation Guide

**Technical Reference for Phase 6 Implementation**

---

## Table of Contents

1. [LLM Integration](#llm-integration)
2. [Intent Classification System](#intent-classification-system)
3. [Context Management](#context-management)
4. [Action Execution Framework](#action-execution-framework)
5. [Learning & Adaptation](#learning--adaptation)
6. [Knowledge Graph](#knowledge-graph)
7. [Vector Embeddings](#vector-embeddings)
8. [Database Schema](#database-schema)

---

## LLM Integration

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   LLM Provider Layer                     │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Primary    │  │   Fallback   │  │    Cache     │ │
│  │   Claude     │  │     GPT      │  │   Layer      │ │
│  │   Sonnet     │  │    4 Turbo   │  │   (Redis)    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Claude API Integration

**Configuration:**

```typescript
// src/services/ai/providers/claude.ts

import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIRequest, AIResponse } from '../types';

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private model: string = 'claude-sonnet-4-5-20250929';

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
    });
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens || 1024,
        temperature: request.temperature || 0.7,
        system: this.buildSystemPrompt(request.context),
        messages: this.formatMessages(request.messages),
        tools: this.formatTools(request.availableActions),
      });

      return {
        id: response.id,
        content: this.extractContent(response),
        toolCalls: this.extractToolCalls(response),
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        latency: Date.now() - startTime,
        model: this.model,
      };
    } catch (error) {
      throw new LLMProviderError('Claude API error', error);
    }
  }

  async stream(request: AIRequest): AsyncGenerator<AIStreamChunk> {
    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens || 1024,
      system: this.buildSystemPrompt(request.context),
      messages: this.formatMessages(request.messages),
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        yield {
          type: 'content',
          content: chunk.delta.text,
        };
      } else if (chunk.type === 'message_stop') {
        yield {
          type: 'done',
        };
      }
    }
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
- Workflow automation

Guidelines:
- Be concise, helpful, and professional
- Always verify user permissions before actions
- Provide actionable suggestions
- Ask for clarification when uncertain
- Explain your reasoning when making recommendations
- Use natural, conversational language

Remember: You have access to tools for performing actions. Use them when appropriate.`;
  }

  private formatMessages(messages: ConversationMessage[]): Anthropic.MessageParam[] {
    return messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
  }

  private formatTools(actions: AvailableAction[]): Anthropic.Tool[] {
    return actions.map(action => ({
      name: action.name,
      description: action.description,
      input_schema: {
        type: 'object',
        properties: action.parameters,
        required: action.required || [],
      },
    }));
  }

  private extractContent(response: Anthropic.Message): string {
    const contentBlocks = response.content.filter(
      block => block.type === 'text'
    );
    return contentBlocks.map(block => block.text).join('');
  }

  private extractToolCalls(response: Anthropic.Message): ToolCall[] {
    const toolBlocks = response.content.filter(
      block => block.type === 'tool_use'
    );

    return toolBlocks.map(block => ({
      id: block.id,
      name: block.name,
      arguments: block.input,
    }));
  }
}
```

### GPT Fallback Integration

```typescript
// src/services/ai/providers/openai.ts

import OpenAI from 'openai';
import { AIProvider, AIRequest, AIResponse } from '../types';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string = 'gpt-4-turbo-preview';

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
    });
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.buildSystemPrompt(request.context) },
          ...this.formatMessages(request.messages),
        ],
        max_tokens: request.maxTokens || 1024,
        temperature: request.temperature || 0.7,
        tools: this.formatTools(request.availableActions),
        tool_choice: 'auto',
      });

      const message = response.choices[0].message;

      return {
        id: response.id,
        content: message.content || '',
        toolCalls: this.extractToolCalls(message),
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        latency: Date.now() - startTime,
        model: this.model,
      };
    } catch (error) {
      throw new LLMProviderError('OpenAI API error', error);
    }
  }

  private formatTools(actions: AvailableAction[]): OpenAI.ChatCompletionTool[] {
    return actions.map(action => ({
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
    }));
  }

  private extractToolCalls(message: OpenAI.ChatCompletionMessage): ToolCall[] {
    if (!message.tool_calls) return [];

    return message.tool_calls.map(call => ({
      id: call.id,
      name: call.function.name,
      arguments: JSON.parse(call.function.arguments),
    }));
  }
}
```

### Provider Manager with Fallback

```typescript
// src/services/ai/provider-manager.ts

export class LLMProviderManager {
  private primaryProvider: AIProvider;
  private fallbackProvider: AIProvider;
  private cache: RedisCache;
  private metrics: MetricsCollector;

  constructor(config: ProviderConfig) {
    this.primaryProvider = new ClaudeProvider(config.claude);
    this.fallbackProvider = new OpenAIProvider(config.openai);
    this.cache = new RedisCache(config.redis);
    this.metrics = new MetricsCollector();
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cached = await this.cache.get(cacheKey);
    if (cached && this.isCacheable(request)) {
      this.metrics.recordCacheHit();
      return cached;
    }

    // Try primary provider
    try {
      const response = await this.primaryProvider.complete(request);
      this.metrics.recordProviderSuccess('claude', response.latency);

      // Cache successful responses
      if (this.isCacheable(request)) {
        await this.cache.set(cacheKey, response, 3600); // 1 hour TTL
      }

      return response;
    } catch (error) {
      this.metrics.recordProviderError('claude', error);
      logger.warn('Primary provider failed, falling back to OpenAI', error);

      // Fallback to secondary provider
      try {
        const response = await this.fallbackProvider.complete(request);
        this.metrics.recordProviderSuccess('openai', response.latency);
        return response;
      } catch (fallbackError) {
        this.metrics.recordProviderError('openai', fallbackError);
        throw new LLMProviderError('All providers failed', fallbackError);
      }
    }
  }

  private generateCacheKey(request: AIRequest): string {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        messages: request.messages,
        context: request.context.user.id,
      }))
      .digest('hex');
    return `llm:${hash}`;
  }

  private isCacheable(request: AIRequest): boolean {
    // Don't cache requests with actions or real-time data
    return !request.availableActions?.length &&
           !request.requiresFreshData;
  }
}
```

---

## Intent Classification System

### Intent Taxonomy

```typescript
// src/services/ai/intents/taxonomy.ts

export enum IntentCategory {
  TICKET_MANAGEMENT = 'ticket_management',
  ASSET_MANAGEMENT = 'asset_management',
  PROCUREMENT = 'procurement',
  KNOWLEDGE = 'knowledge',
  ANALYTICS = 'analytics',
  USER_MANAGEMENT = 'user_management',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

export interface Intent {
  id: string;
  category: IntentCategory;
  name: string;
  description: string;
  examples: string[];
  requiredEntities: string[];
  optionalEntities: string[];
  requiredPermissions: string[];
  confidence: number;
}

export const INTENT_REGISTRY: Intent[] = [
  // Ticket Management Intents
  {
    id: 'ticket.create',
    category: IntentCategory.TICKET_MANAGEMENT,
    name: 'Create Ticket',
    description: 'User wants to create a new support ticket',
    examples: [
      'Create a ticket for printer issue',
      'I need to report a problem',
      'The email server is down',
      'Submit an incident',
    ],
    requiredEntities: ['issue_description'],
    optionalEntities: ['priority', 'category', 'affected_asset'],
    requiredPermissions: ['ticket.create'],
    confidence: 0.0,
  },
  {
    id: 'ticket.search',
    category: IntentCategory.TICKET_MANAGEMENT,
    name: 'Search Tickets',
    description: 'User wants to search or list tickets',
    examples: [
      'Show me my tickets',
      'What tickets are assigned to me?',
      'List all critical incidents',
      'Find tickets about the printer',
    ],
    requiredEntities: [],
    optionalEntities: ['assignee', 'priority', 'status', 'category', 'keyword'],
    requiredPermissions: ['ticket.read'],
    confidence: 0.0,
  },
  {
    id: 'ticket.update',
    category: IntentCategory.TICKET_MANAGEMENT,
    name: 'Update Ticket',
    description: 'User wants to update an existing ticket',
    examples: [
      'Update ticket INC-1234',
      'Change priority to high',
      'Add a comment to this ticket',
      'Mark as in progress',
    ],
    requiredEntities: ['ticket_id'],
    optionalEntities: ['priority', 'status', 'assignee', 'comment'],
    requiredPermissions: ['ticket.update'],
    confidence: 0.0,
  },
  {
    id: 'ticket.assign',
    category: IntentCategory.TICKET_MANAGEMENT,
    name: 'Assign Ticket',
    description: 'User wants to assign a ticket to someone',
    examples: [
      'Assign this to John',
      'Reassign to networking team',
      'Give this ticket to Sarah',
    ],
    requiredEntities: ['ticket_id', 'assignee'],
    optionalEntities: [],
    requiredPermissions: ['ticket.assign'],
    confidence: 0.0,
  },
  {
    id: 'ticket.close',
    category: IntentCategory.TICKET_MANAGEMENT,
    name: 'Close Ticket',
    description: 'User wants to close or resolve a ticket',
    examples: [
      'Close this ticket',
      'Mark as resolved',
      'This issue is fixed',
    ],
    requiredEntities: ['ticket_id'],
    optionalEntities: ['resolution_note'],
    requiredPermissions: ['ticket.close'],
    confidence: 0.0,
  },

  // Asset Management Intents
  {
    id: 'asset.search',
    category: IntentCategory.ASSET_MANAGEMENT,
    name: 'Search Assets',
    description: 'User wants to search or list assets',
    examples: [
      'Show me all laptops',
      'Find assets assigned to John',
      'List available printers',
      'What assets are in Building A?',
    ],
    requiredEntities: [],
    optionalEntities: ['asset_type', 'location', 'assignee', 'status'],
    requiredPermissions: ['asset.read'],
    confidence: 0.0,
  },
  {
    id: 'asset.allocate',
    category: IntentCategory.ASSET_MANAGEMENT,
    name: 'Allocate Asset',
    description: 'User wants to allocate an asset to someone',
    examples: [
      'Assign laptop to new employee',
      'Allocate printer to 3rd floor',
      'Give this monitor to Sarah',
    ],
    requiredEntities: ['asset_id', 'assignee'],
    optionalEntities: ['allocation_date', 'return_date'],
    requiredPermissions: ['asset.allocate'],
    confidence: 0.0,
  },
  {
    id: 'asset.track',
    category: IntentCategory.ASSET_MANAGEMENT,
    name: 'Track Asset',
    description: 'User wants to track or locate an asset',
    examples: [
      'Where is laptop LAP-1234?',
      'Track this asset',
      'Find the projector',
    ],
    requiredEntities: ['asset_id'],
    optionalEntities: [],
    requiredPermissions: ['asset.read'],
    confidence: 0.0,
  },

  // Procurement Intents
  {
    id: 'procurement.submit',
    category: IntentCategory.PROCUREMENT,
    name: 'Submit Procurement Request',
    description: 'User wants to submit a purchase request',
    examples: [
      'I need to order new laptops',
      'Submit a purchase request',
      'Request approval for software purchase',
    ],
    requiredEntities: ['item_description'],
    optionalEntities: ['quantity', 'estimated_cost', 'justification'],
    requiredPermissions: ['procurement.create'],
    confidence: 0.0,
  },
  {
    id: 'procurement.approve',
    category: IntentCategory.PROCUREMENT,
    name: 'Approve Procurement',
    description: 'User wants to approve a purchase request',
    examples: [
      'Approve this request',
      'Authorize purchase PR-1234',
      'Accept this procurement',
    ],
    requiredEntities: ['request_id'],
    optionalEntities: ['comment'],
    requiredPermissions: ['procurement.approve'],
    confidence: 0.0,
  },

  // Knowledge Intents
  {
    id: 'knowledge.search',
    category: IntentCategory.KNOWLEDGE,
    name: 'Search Knowledge Base',
    description: 'User wants to search for information',
    examples: [
      'How do I reset a password?',
      'Find articles about VPN setup',
      'Search knowledge base for printer troubleshooting',
    ],
    requiredEntities: ['search_query'],
    optionalEntities: ['category'],
    requiredPermissions: ['knowledge.read'],
    confidence: 0.0,
  },

  // Analytics Intents
  {
    id: 'analytics.report',
    category: IntentCategory.ANALYTICS,
    name: 'Generate Report',
    description: 'User wants to generate a report or analytics',
    examples: [
      'Show me ticket trends',
      'Generate SLA report',
      'How many tickets were closed last week?',
    ],
    requiredEntities: ['report_type'],
    optionalEntities: ['date_range', 'filters'],
    requiredPermissions: ['analytics.read'],
    confidence: 0.0,
  },

  // System Intents
  {
    id: 'system.help',
    category: IntentCategory.SYSTEM,
    name: 'Get Help',
    description: 'User needs help or guidance',
    examples: [
      'Help',
      'What can you do?',
      'How do I use this?',
    ],
    requiredEntities: [],
    optionalEntities: ['topic'],
    requiredPermissions: [],
    confidence: 0.0,
  },
  {
    id: 'system.greeting',
    category: IntentCategory.SYSTEM,
    name: 'Greeting',
    description: 'User is greeting AVA',
    examples: [
      'Hello',
      'Hi AVA',
      'Good morning',
    ],
    requiredEntities: [],
    optionalEntities: [],
    requiredPermissions: [],
    confidence: 0.0,
  },
];
```

### Intent Classifier

```typescript
// src/services/ai/intents/classifier.ts

export class IntentClassifier {
  private llmProvider: LLMProviderManager;
  private vectorStore: VectorStore;
  private intentRegistry: Intent[];

  constructor(config: ClassifierConfig) {
    this.llmProvider = new LLMProviderManager(config.llm);
    this.vectorStore = new VectorStore(config.vectorStore);
    this.intentRegistry = INTENT_REGISTRY;
  }

  async classify(
    userInput: string,
    context: AIContext
  ): Promise<ClassificationResult> {
    // Parallel processing for speed
    const [llmResult, vectorResult] = await Promise.all([
      this.classifyWithLLM(userInput, context),
      this.classifyWithVectorSimilarity(userInput),
    ]);

    // Combine results with weighted scoring
    const combinedIntent = this.combineResults(llmResult, vectorResult);

    // Validate permissions
    const validatedIntent = await this.validatePermissions(
      combinedIntent,
      context
    );

    return validatedIntent;
  }

  private async classifyWithLLM(
    userInput: string,
    context: AIContext
  ): Promise<IntentPrediction> {
    const prompt = `Classify the following user request into one of the predefined intents.

User Request: "${userInput}"

Available Intents:
${this.intentRegistry.map(i => `- ${i.id}: ${i.description}`).join('\n')}

Return your answer in JSON format:
{
  "intentId": "the_intent_id",
  "confidence": 0.95,
  "reasoning": "brief explanation"
}`;

    const response = await this.llmProvider.complete({
      messages: [{ role: 'user', content: prompt }],
      context,
      maxTokens: 256,
      temperature: 0.3, // Lower temperature for classification
    });

    const result = JSON.parse(response.content);
    return {
      intent: this.intentRegistry.find(i => i.id === result.intentId)!,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  }

  private async classifyWithVectorSimilarity(
    userInput: string
  ): Promise<IntentPrediction> {
    // Get embedding for user input
    const inputEmbedding = await this.vectorStore.embed(userInput);

    // Find most similar intent examples
    const similarities: Array<{ intent: Intent; similarity: number }> = [];

    for (const intent of this.intentRegistry) {
      for (const example of intent.examples) {
        const exampleEmbedding = await this.vectorStore.embed(example);
        const similarity = this.cosineSimilarity(
          inputEmbedding,
          exampleEmbedding
        );
        similarities.push({ intent, similarity });
      }
    }

    // Get best match
    similarities.sort((a, b) => b.similarity - a.similarity);
    const best = similarities[0];

    return {
      intent: best.intent,
      confidence: best.similarity,
      reasoning: 'Vector similarity match',
    };
  }

  private combineResults(
    llmResult: IntentPrediction,
    vectorResult: IntentPrediction
  ): IntentPrediction {
    // Weighted average (LLM: 70%, Vector: 30%)
    const llmWeight = 0.7;
    const vectorWeight = 0.3;

    if (llmResult.intent.id === vectorResult.intent.id) {
      // Both agree - high confidence
      return {
        intent: llmResult.intent,
        confidence: llmWeight * llmResult.confidence +
                    vectorWeight * vectorResult.confidence,
        reasoning: `Both methods agree: ${llmResult.reasoning}`,
      };
    } else {
      // Disagreement - use LLM result but lower confidence
      return {
        intent: llmResult.intent,
        confidence: llmResult.confidence * llmWeight,
        reasoning: `LLM classification (vector suggested ${vectorResult.intent.id})`,
      };
    }
  }

  private async validatePermissions(
    prediction: IntentPrediction,
    context: AIContext
  ): Promise<ClassificationResult> {
    const { intent, confidence, reasoning } = prediction;

    // Check if user has required permissions
    const hasPermissions = intent.requiredPermissions.every(perm =>
      context.permissions.includes(perm)
    );

    if (!hasPermissions) {
      return {
        intent: this.intentRegistry.find(i => i.id === 'system.help')!,
        confidence: 1.0,
        reasoning: 'User lacks required permissions',
        error: {
          type: 'PERMISSION_DENIED',
          message: `You don't have permission to ${intent.name}`,
          requiredPermissions: intent.requiredPermissions,
        },
      };
    }

    return {
      intent,
      confidence,
      reasoning,
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
```

### Entity Extraction

```typescript
// src/services/ai/intents/entity-extractor.ts

export class EntityExtractor {
  private llmProvider: LLMProviderManager;
  private patterns: Map<string, RegExp>;

  constructor(config: ExtractorConfig) {
    this.llmProvider = new LLMProviderManager(config.llm);
    this.initializePatterns();
  }

  async extract(
    userInput: string,
    intent: Intent,
    context: AIContext
  ): Promise<ExtractedEntities> {
    // Parallel extraction using rules and LLM
    const [ruleBasedEntities, llmEntities] = await Promise.all([
      this.extractWithRules(userInput, intent),
      this.extractWithLLM(userInput, intent, context),
    ]);

    // Merge results (LLM takes precedence)
    const entities = { ...ruleBasedEntities, ...llmEntities };

    // Validate extracted entities
    const validated = await this.validateEntities(entities, intent, context);

    return validated;
  }

  private initializePatterns(): void {
    this.patterns = new Map([
      ['ticket_id', /\b(INC|REQ|CHG|PRB)-\d{4,6}\b/i],
      ['asset_id', /\b(LAP|DES|PRT|MON)-\d{4,6}\b/i],
      ['priority', /\b(low|medium|high|critical|urgent)\b/i],
      ['email', /\b[\w.-]+@[\w.-]+\.\w{2,}\b/i],
      ['date', /\b\d{4}-\d{2}-\d{2}\b/],
      ['phone', /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/],
    ]);
  }

  private async extractWithRules(
    userInput: string,
    intent: Intent
  ): Promise<Partial<ExtractedEntities>> {
    const entities: Partial<ExtractedEntities> = {};

    // Extract using regex patterns
    for (const [entityType, pattern] of this.patterns) {
      if (
        intent.requiredEntities.includes(entityType) ||
        intent.optionalEntities.includes(entityType)
      ) {
        const match = userInput.match(pattern);
        if (match) {
          entities[entityType] = match[0];
        }
      }
    }

    return entities;
  }

  private async extractWithLLM(
    userInput: string,
    intent: Intent,
    context: AIContext
  ): Promise<Partial<ExtractedEntities>> {
    const requiredEntities = intent.requiredEntities;
    const optionalEntities = intent.optionalEntities;
    const allEntities = [...requiredEntities, ...optionalEntities];

    if (allEntities.length === 0) return {};

    const prompt = `Extract the following entities from the user request:

User Request: "${userInput}"

Entities to extract:
${allEntities.map(e => `- ${e}`).join('\n')}

Context:
- Current user: ${context.user.name}
- Organization: ${context.organization.name}

Return a JSON object with extracted entities. If an entity is not found, omit it.
Example: { "ticket_id": "INC-1234", "priority": "high" }`;

    const response = await this.llmProvider.complete({
      messages: [{ role: 'user', content: prompt }],
      context,
      maxTokens: 256,
      temperature: 0.2,
    });

    try {
      return JSON.parse(response.content);
    } catch (error) {
      logger.warn('Failed to parse LLM entity extraction', error);
      return {};
    }
  }

  private async validateEntities(
    entities: Partial<ExtractedEntities>,
    intent: Intent,
    context: AIContext
  ): Promise<ExtractedEntities> {
    // Check for missing required entities
    const missingRequired = intent.requiredEntities.filter(
      entity => !entities[entity]
    );

    if (missingRequired.length > 0) {
      throw new MissingEntitiesError(
        `Missing required entities: ${missingRequired.join(', ')}`,
        missingRequired
      );
    }

    // Validate entity formats and values
    const validated: ExtractedEntities = {};

    for (const [key, value] of Object.entries(entities)) {
      const validatedValue = await this.validateEntity(key, value, context);
      if (validatedValue !== null) {
        validated[key] = validatedValue;
      }
    }

    return validated;
  }

  private async validateEntity(
    entityType: string,
    value: any,
    context: AIContext
  ): Promise<any> {
    switch (entityType) {
      case 'ticket_id':
        return this.validateTicketId(value, context);
      case 'asset_id':
        return this.validateAssetId(value, context);
      case 'assignee':
        return this.validateUser(value, context);
      case 'priority':
        return this.validatePriority(value);
      default:
        return value;
    }
  }

  private async validateTicketId(
    ticketId: string,
    context: AIContext
  ): Promise<string> {
    // Check if ticket exists
    const ticket = await TicketService.getById(ticketId);
    if (!ticket) {
      throw new EntityValidationError(`Ticket ${ticketId} not found`);
    }

    // Check if user has access
    const hasAccess = await TicketService.checkAccess(
      ticket.id,
      context.user.id
    );
    if (!hasAccess) {
      throw new EntityValidationError(`No access to ticket ${ticketId}`);
    }

    return ticketId;
  }

  private async validateAssetId(
    assetId: string,
    context: AIContext
  ): Promise<string> {
    const asset = await AssetService.getById(assetId);
    if (!asset) {
      throw new EntityValidationError(`Asset ${assetId} not found`);
    }
    return assetId;
  }

  private async validateUser(
    userIdentifier: string,
    context: AIContext
  ): Promise<string> {
    // Try to find user by name or email
    const user = await UserService.findByNameOrEmail(userIdentifier);
    if (!user) {
      throw new EntityValidationError(`User ${userIdentifier} not found`);
    }
    return user.id;
  }

  private validatePriority(priority: string): string {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    const normalized = priority.toLowerCase();
    if (!validPriorities.includes(normalized)) {
      throw new EntityValidationError(`Invalid priority: ${priority}`);
    }
    return normalized;
  }
}
```

---

## Context Management

### Context Store Architecture

```typescript
// src/services/ai/context/context-manager.ts

export class ContextManager {
  private redis: RedisClient;
  private postgres: PostgresClient;
  private cache: Map<string, ConversationContext>;

  constructor(config: ContextConfig) {
    this.redis = new RedisClient(config.redis);
    this.postgres = new PostgresClient(config.postgres);
    this.cache = new Map();
  }

  async getContext(sessionId: string, userId: string): Promise<AIContext> {
    // Try cache first
    const cached = this.cache.get(sessionId);
    if (cached && this.isContextValid(cached)) {
      return cached;
    }

    // Load from Redis (active sessions)
    const redisContext = await this.redis.get(`context:${sessionId}`);
    if (redisContext) {
      const context = JSON.parse(redisContext);
      this.cache.set(sessionId, context);
      return context;
    }

    // Build fresh context
    const context = await this.buildContext(sessionId, userId);
    await this.saveContext(sessionId, context);
    return context;
  }

  private async buildContext(
    sessionId: string,
    userId: string
  ): Promise<AIContext> {
    // Load user data
    const user = await UserService.getById(userId);
    const permissions = await PermissionService.getUserPermissions(userId);
    const organization = await OrganizationService.getById(user.organizationId);

    // Load conversation history
    const conversationHistory = await this.loadConversationHistory(
      sessionId,
      userId
    );

    // Load recent sessions for cross-session context
    const recentSessions = await this.loadRecentSessions(userId);

    // Load user preferences and learned patterns
    const preferences = await this.loadUserPreferences(userId);

    // Build context object
    const context: AIContext = {
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        preferences,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        settings: organization.settings,
        timezone: organization.timezone,
      },
      permissions,
      conversationHistory,
      recentSessions,
      temporalContext: {
        currentTime: new Date(),
        businessHours: organization.businessHours,
        timezone: organization.timezone,
      },
      metadata: {
        userAgent: '', // Set from request
        ipAddress: '', // Set from request
        deviceType: '', // Set from request
      },
    };

    return context;
  }

  async updateContext(
    sessionId: string,
    updates: Partial<AIContext>
  ): Promise<void> {
    const current = await this.getContext(sessionId, updates.user!.id);
    const updated = { ...current, ...updates };

    // Save to cache and Redis
    this.cache.set(sessionId, updated);
    await this.redis.set(
      `context:${sessionId}`,
      JSON.stringify(updated),
      'EX',
      3600 // 1 hour expiry
    );
  }

  async addMessage(
    sessionId: string,
    message: ConversationMessage
  ): Promise<void> {
    // Add to conversation history
    const context = this.cache.get(sessionId);
    if (context) {
      context.conversationHistory.push(message);

      // Trim history if too long (keep last 30 messages)
      if (context.conversationHistory.length > 30) {
        context.conversationHistory = context.conversationHistory.slice(-30);
      }

      await this.updateContext(sessionId, context);
    }

    // Save to persistent storage
    await this.postgres.query(
      'INSERT INTO conversation_messages (session_id, role, content, timestamp) VALUES ($1, $2, $3, $4)',
      [sessionId, message.role, message.content, new Date()]
    );
  }

  private async loadConversationHistory(
    sessionId: string,
    userId: string
  ): Promise<ConversationMessage[]> {
    const result = await this.postgres.query(
      'SELECT role, content, timestamp FROM conversation_messages WHERE session_id = $1 ORDER BY timestamp ASC LIMIT 30',
      [sessionId]
    );

    return result.rows.map(row => ({
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
    }));
  }

  private async loadRecentSessions(
    userId: string
  ): Promise<SessionSummary[]> {
    const result = await this.postgres.query(
      `SELECT
        session_id,
        created_at,
        last_activity,
        message_count,
        intents_used,
        actions_performed
       FROM conversation_sessions
       WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY last_activity DESC
       LIMIT 10`,
      [userId]
    );

    return result.rows.map(row => ({
      sessionId: row.session_id,
      createdAt: row.created_at,
      lastActivity: row.last_activity,
      messageCount: row.message_count,
      intentsUsed: row.intents_used,
      actionsPerformed: row.actions_performed,
    }));
  }

  private async loadUserPreferences(userId: string): Promise<UserPreferences> {
    const result = await this.postgres.query(
      'SELECT preferences FROM user_ai_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return this.getDefaultPreferences();
    }

    return result.rows[0].preferences;
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      responseStyle: 'professional', // professional, casual, technical
      verbosity: 'medium', // concise, medium, detailed
      proactiveNotifications: true,
      autonomyLevel: 'confirm', // suggest, confirm, auto
      language: 'en',
    };
  }

  private isContextValid(context: ConversationContext): boolean {
    // Context is valid if less than 5 minutes old
    const age = Date.now() - context.metadata.lastUpdate;
    return age < 5 * 60 * 1000;
  }

  async saveContext(sessionId: string, context: AIContext): Promise<void> {
    this.cache.set(sessionId, context);
    await this.redis.set(
      `context:${sessionId}`,
      JSON.stringify(context),
      'EX',
      3600
    );
  }
}
```

---

## Action Execution Framework

```typescript
// src/services/ai/actions/action-executor.ts

export class ActionExecutor {
  private actionRegistry: Map<string, ActionHandler>;
  private permissionChecker: PermissionChecker;
  private auditLogger: AuditLogger;

  constructor(config: ExecutorConfig) {
    this.actionRegistry = new Map();
    this.permissionChecker = new PermissionChecker();
    this.auditLogger = new AuditLogger();
    this.registerActions();
  }

  private registerActions(): void {
    // Ticket actions
    this.register(new CreateTicketAction());
    this.register(new UpdateTicketAction());
    this.register(new SearchTicketsAction());
    this.register(new AssignTicketAction());
    this.register(new CloseTicketAction());

    // Asset actions
    this.register(new SearchAssetsAction());
    this.register(new AllocateAssetAction());
    this.register(new TrackAssetAction());

    // Procurement actions
    this.register(new SubmitProcurementAction());
    this.register(new ApproveProcurementAction());

    // Knowledge actions
    this.register(new SearchKnowledgeAction());

    // Analytics actions
    this.register(new GenerateReportAction());
  }

  private register(action: ActionHandler): void {
    this.actionRegistry.set(action.name, action);
  }

  async execute(
    actionName: string,
    parameters: Record<string, any>,
    context: AIContext
  ): Promise<ActionResult> {
    const action = this.actionRegistry.get(actionName);
    if (!action) {
      throw new ActionNotFoundError(`Action ${actionName} not found`);
    }

    // Check permissions
    await this.permissionChecker.check(action, context);

    // Validate parameters
    const validatedParams = await action.validateParameters(parameters);

    // Execute action
    const startTime = Date.now();
    let result: ActionResult;

    try {
      result = await action.execute(validatedParams, context);
      result.latency = Date.now() - startTime;
      result.status = 'success';
    } catch (error) {
      result = {
        status: 'error',
        error: error.message,
        latency: Date.now() - startTime,
      };
    }

    // Audit log
    await this.auditLogger.log({
      actionName,
      parameters: validatedParams,
      result,
      context,
      timestamp: new Date(),
    });

    return result;
  }
}

// Example action: Create Ticket
export class CreateTicketAction implements ActionHandler {
  name = 'create_ticket';
  description = 'Create a new support ticket';

  requiredPermissions = ['ticket.create'];

  parameterSchema = {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    category: { type: 'string' },
    assignee: { type: 'string' },
  };

  async validateParameters(params: any): Promise<CreateTicketParams> {
    // Validate using schema
    const validated = validateSchema(params, this.parameterSchema);
    return validated;
  }

  async execute(
    params: CreateTicketParams,
    context: AIContext
  ): Promise<ActionResult> {
    // Create ticket
    const ticket = await TicketService.create({
      title: params.title,
      description: params.description,
      priority: params.priority || 'medium',
      category: params.category,
      assignee: params.assignee,
      reporter: context.user.id,
      organizationId: context.organization.id,
    });

    return {
      status: 'success',
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        url: `/tickets/${ticket.id}`,
      },
      message: `Created ticket ${ticket.number}: ${ticket.title}`,
    };
  }
}
```

---

## Learning & Adaptation

```typescript
// src/services/ai/learning/learning-engine.ts

export class LearningEngine {
  private postgres: PostgresClient;
  private analytics: AnalyticsService;

  async recordInteraction(interaction: AIInteraction): Promise<void> {
    await this.postgres.query(
      `INSERT INTO ai_interactions
       (session_id, user_id, intent_id, confidence, entities, result, feedback, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        interaction.sessionId,
        interaction.userId,
        interaction.intent.id,
        interaction.confidence,
        JSON.stringify(interaction.entities),
        JSON.stringify(interaction.result),
        interaction.feedback,
        new Date(),
      ]
    );
  }

  async recordFeedback(
    interactionId: string,
    feedback: Feedback
  ): Promise<void> {
    await this.postgres.query(
      'UPDATE ai_interactions SET feedback = $1, feedback_timestamp = $2 WHERE id = $3',
      [JSON.stringify(feedback), new Date(), interactionId]
    );

    // Trigger retraining if enough negative feedback
    await this.checkRetrainingTrigger();
  }

  async learnUserPreferences(userId: string): Promise<void> {
    // Analyze user interaction patterns
    const patterns = await this.analyzeUserPatterns(userId);

    // Update user preferences
    await this.postgres.query(
      'UPDATE user_ai_preferences SET preferences = $1 WHERE user_id = $2',
      [JSON.stringify(patterns), userId]
    );
  }

  private async analyzeUserPatterns(userId: string): Promise<UserPreferences> {
    // Get user's interaction history
    const interactions = await this.postgres.query(
      `SELECT * FROM ai_interactions
       WHERE user_id = $1
         AND timestamp > NOW() - INTERVAL '90 days'
       ORDER BY timestamp DESC`,
      [userId]
    );

    // Analyze patterns
    const preferences: UserPreferences = {
      responseStyle: this.inferResponseStyle(interactions.rows),
      verbosity: this.inferVerbosity(interactions.rows),
      proactiveNotifications: this.inferNotificationPreference(interactions.rows),
      autonomyLevel: this.inferAutonomyLevel(interactions.rows),
      language: 'en',
    };

    return preferences;
  }

  private inferResponseStyle(interactions: any[]): string {
    // Analyze which response style gets better feedback
    // This is a simplified example
    const feedback = interactions
      .filter(i => i.feedback)
      .map(i => i.feedback.rating);

    const avgRating = feedback.reduce((a, b) => a + b, 0) / feedback.length;

    return avgRating > 4 ? 'professional' : 'casual';
  }
}
```

---

## Knowledge Graph

```typescript
// src/services/ai/knowledge/knowledge-graph.ts

export class KnowledgeGraph {
  private neo4j: Neo4jDriver;

  async buildGraph(): Promise<void> {
    // Build knowledge graph from platform data
    await this.createTicketNodes();
    await this.createAssetNodes();
    await this.createUserNodes();
    await this.createRelationships();
  }

  private async createTicketNodes(): Promise<void> {
    const tickets = await TicketService.getAll();

    for (const ticket of tickets) {
      await this.neo4j.run(
        `CREATE (t:Ticket {
          id: $id,
          title: $title,
          category: $category,
          priority: $priority,
          status: $status
        })`,
        ticket
      );
    }
  }

  async query(question: string): Promise<GraphQueryResult> {
    // Convert natural language to Cypher query
    const cypherQuery = await this.nlToCypher(question);

    // Execute query
    const result = await this.neo4j.run(cypherQuery);

    return result;
  }
}
```

---

## Vector Embeddings

```typescript
// src/services/ai/embeddings/vector-store.ts

export class VectorStore {
  private pinecone: PineconeClient;
  private embedder: EmbeddingService;

  async embed(text: string): Promise<number[]> {
    const response = await this.embedder.createEmbedding({
      model: 'text-embedding-3-large',
      input: text,
    });

    return response.data[0].embedding;
  }

  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    const queryEmbedding = await this.embed(query);

    const results = await this.pinecone.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    return results.matches;
  }

  async index(id: string, text: string, metadata: any): Promise<void> {
    const embedding = await this.embed(text);

    await this.pinecone.upsert([{
      id,
      values: embedding,
      metadata,
    }]);
  }
}
```

---

## Database Schema

```sql
-- AI Conversations
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  intents_used JSONB DEFAULT '[]',
  actions_performed JSONB DEFAULT '[]',
  INDEX idx_user_id (user_id),
  INDEX idx_last_activity (last_activity)
);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL REFERENCES conversation_sessions(session_id),
  role VARCHAR(50) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_session_id (session_id),
  INDEX idx_timestamp (timestamp)
);

-- AI Interactions
CREATE TABLE ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  intent_id VARCHAR(100) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  entities JSONB,
  result JSONB,
  feedback JSONB,
  feedback_timestamp TIMESTAMP,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_user_id (user_id),
  INDEX idx_intent_id (intent_id),
  INDEX idx_timestamp (timestamp)
);

-- User AI Preferences
CREATE TABLE user_ai_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  preferences JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- AI Audit Log
CREATE TABLE ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_name VARCHAR(100) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  parameters JSONB,
  result JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_user_id (user_id),
  INDEX idx_action_name (action_name),
  INDEX idx_timestamp (timestamp)
);
```

---

## Performance Optimization

### Caching Strategy

- **LLM Response Cache**: 1-hour TTL for common queries
- **Context Cache**: In-memory + Redis for active sessions
- **Intent Classification Cache**: Cache by input hash
- **Vector Search Cache**: Cache top-K results

### Scaling Considerations

- **Horizontal Scaling**: Multiple AVA API instances behind load balancer
- **Database Sharding**: Shard by user_id for conversation data
- **Vector DB Partitioning**: Partition by organization
- **Rate Limiting**: Per-user rate limits to prevent abuse

---

## Monitoring & Observability

```typescript
// Key metrics to track
const METRICS = {
  'ava.response_time': 'histogram',
  'ava.intent_accuracy': 'gauge',
  'ava.action_success_rate': 'gauge',
  'ava.user_satisfaction': 'gauge',
  'ava.cache_hit_rate': 'gauge',
  'ava.llm_api_errors': 'counter',
};
```

---

This implementation guide provides the technical foundation for building AVA's AI capabilities. Each component is designed for performance, scalability, and maintainability.
