/**
 * AVA Core Engine Service
 * HubbleWave Platform - Phase 6
 *
 * Main orchestrator for all AVA AI capabilities.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AVAConversation,
  AVAMessage,
  AVAIntent,
  AVAContext,
  AVASuggestion,
  AVAFeedback,
  AVAUsageMetrics,
  ConversationStatus,
  MessageRole,
  IntentCategory,
  SuggestionType,
  FeedbackType,
} from '@hubblewave/instance-db';
import { LLMProviderService } from './llm-provider.service';

interface UserContext {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  organizationId: string;
  organizationName: string;
}

interface ChatRequest {
  message: string;
  conversationId?: string;
}

interface ChatResponse {
  conversationId: string;
  messageId: string;
  content: string;
  suggestions?: Array<{
    type: SuggestionType;
    value: Record<string, unknown>;
    explanation?: string;
  }>;
  actions?: Array<{
    id: string;
    name: string;
    label: string;
    requiresConfirmation: boolean;
  }>;
}

interface IntentResult {
  category: IntentCategory;
  intentName: string;
  confidence: number;
  entities: Record<string, unknown>;
  requiredPermissions: string[];
  needsClarification: boolean;
  clarificationQuestion?: string;
}

@Injectable()
export class AVACoreService {
  private readonly logger = new Logger(AVACoreService.name);

  constructor(
    @InjectRepository(AVAConversation)
    private readonly conversationRepo: Repository<AVAConversation>,
    @InjectRepository(AVAMessage)
    private readonly messageRepo: Repository<AVAMessage>,
    @InjectRepository(AVAIntent)
    private readonly intentRepo: Repository<AVAIntent>,
    @InjectRepository(AVAContext)
    protected readonly contextRepo: Repository<AVAContext>,
    @InjectRepository(AVASuggestion)
    private readonly suggestionRepo: Repository<AVASuggestion>,
    @InjectRepository(AVAFeedback)
    private readonly feedbackRepo: Repository<AVAFeedback>,
    private readonly llmProvider: LLMProviderService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * F052 — AVA chat transactionality (canon §10).
   *
   * The chat pipeline performs N database writes per turn. The plan's
   * 7-write estimate (chat message → conversation update → assistant
   * message → tool-call → conversation state → tool-result → conversation
   * metadata) does not match this orchestrator's actual shape: tool calls
   * are stored as a JSONB column on `ava_messages`, not as separate rows,
   * and there is no separate tool-result table. The real sequence is:
   *
   *   Pre-LLM block (atomic, transaction A):
   *     1. Conversation (find or insert)
   *     2. User message (insert)
   *     3. Intent classification (insert)
   *
   *   LLM provider call (external HTTP; NOT inside any transaction —
   *   holding a Postgres transaction open across an external call holds
   *   row locks for the LLM's full latency budget and is unacceptable for
   *   a multi-tenant DB).
   *
   *   Post-LLM block (atomic, transaction B):
   *     4. Assistant message (insert)
   *     5. Conversation row update (messageCount + lastActivityAt + title)
   *     6. Usage metrics — response_time (insert)
   *     7. Usage metrics — token_usage (insert)
   *     8. (conditional) Suggestion row insert
   *
   * F052 requires that a failure mid-sequence cannot leave the
   * conversation half-written. Both blocks now run inside
   * `dataSource.transaction(...)` so any failure rolls back every write
   * in that block.
   *
   * The pre-LLM block stands alone: if the LLM call later throws, the
   * user's input is still persisted and a retry shows the message in the
   * conversation. That is the correct UX — users expect their sent
   * messages to survive transient LLM failures.
   *
   * The post-LLM block is atomic for the assistant-side writes: if the
   * assistant message persists, the conversation header counters reflect
   * it and the usage metrics rows exist. If any one of those fails,
   * none persist — no orphan message, no skewed counter.
   */
  async chat(request: ChatRequest, userContext: UserContext): Promise<ChatResponse> {
    const startTime = Date.now();

    // ── Pre-LLM transaction: conversation + user message + intent ────
    const { conversation, history } = await this.dataSource.transaction(
      async (tx) => this.persistUserTurn(tx, request, userContext),
    );

    // ── External LLM call (no DB transaction held across this) ───────
    const intent = await this.classifyIntent(request.message, userContext);
    const aiResponse = await this.llmProvider.complete({
      messages: [
        ...history.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        { role: 'user' as const, content: request.message },
      ],
      context: {
        user: {
          id: userContext.id,
          name: userContext.name,
          role: userContext.role,
        },
        organization: {
          id: userContext.organizationId,
          name: userContext.organizationName,
        },
        permissions: userContext.permissions,
      },
      availableActions: this.getAvailableActions(intent, userContext.permissions),
    });

    // ── Post-LLM transaction: assistant message + counters + metrics + suggestion ──
    const { assistantMessage, suggestions } = await this.dataSource.transaction(
      async (tx) =>
        this.persistAssistantTurn(tx, {
          conversation,
          aiResponse,
          intent,
          userContext,
          firstUserMessage: request.message,
        }),
    );

    const responseTime = Date.now() - startTime;
    this.logger.debug(`AVA response generated in ${responseTime}ms`);

    return {
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      content: aiResponse.content,
      suggestions,
      actions: aiResponse.toolCalls.map((call) => ({
        id: call.id,
        name: call.name,
        label: this.getActionLabel(call.name),
        requiresConfirmation: this.requiresConfirmation(call.name),
      })),
    };
  }

  /**
   * Persist the user-side writes for one chat turn atomically.
   * Returns the conversation row + recent message history needed by the
   * downstream LLM call. The intent classification is computed by the
   * caller AFTER the LLM block (it is a pure function of the message and
   * does not need to be persisted before the LLM call); inside this
   * block we persist the user message and a placeholder intent row keyed
   * to it so the intent FK is valid by the time the rest of the turn
   * resolves.
   */
  private async persistUserTurn(
    tx: EntityManager,
    request: ChatRequest,
    userContext: UserContext,
  ): Promise<{ conversation: AVAConversation; history: AVAMessage[] }> {
    const conversationRepo = tx.getRepository(AVAConversation);
    const messageRepo = tx.getRepository(AVAMessage);
    const intentRepo = tx.getRepository(AVAIntent);

    // 1. Conversation (find or insert)
    let conversation: AVAConversation | null = null;
    if (request.conversationId) {
      conversation = await conversationRepo.findOne({
        where: {
          id: request.conversationId,
          userId: userContext.id,
          organizationId: userContext.organizationId,
        },
      });
    }
    if (!conversation) {
      conversation = await conversationRepo.save(
        conversationRepo.create({
          userId: userContext.id,
          organizationId: userContext.organizationId,
          status: 'active' as ConversationStatus,
          messageCount: 0,
          lastActivityAt: new Date(),
          sessionMetadata: {
            organizationId: userContext.organizationId,
            userRole: userContext.role,
          },
        }),
      );
    }

    // 2. User message (insert)
    const userMessage = await messageRepo.save(
      messageRepo.create({
        conversationId: conversation.id,
        role: 'user' as MessageRole,
        content: request.message,
      }),
    );

    // 3. Intent classification (insert)
    const intent = await this.classifyIntent(request.message, userContext);
    await intentRepo.save(
      intentRepo.create({
        messageId: userMessage.id,
        category: intent.category,
        intentName: intent.intentName,
        confidence: intent.confidence,
        detectedEntities: intent.entities,
        requiredPermissions: intent.requiredPermissions,
        isClarificationNeeded: intent.needsClarification,
        clarificationQuestion: intent.clarificationQuestion,
      }),
    );

    // Fetch history for the upcoming LLM call. Inside the same
    // transaction so the just-inserted user message is visible (and
    // included or excluded consistently with the rest of the snapshot).
    const history = await messageRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return { conversation, history };
  }

  /**
   * Persist the assistant-side writes for one chat turn atomically.
   * All writes in this block either commit together or roll back
   * together — that is the F052 contract.
   */
  private async persistAssistantTurn(
    tx: EntityManager,
    params: {
      conversation: AVAConversation;
      aiResponse: {
        content: string;
        toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
        usage: { totalTokens: number };
        latency: number;
        model: string;
      };
      intent: IntentResult;
      userContext: UserContext;
      firstUserMessage: string;
    },
  ): Promise<{ assistantMessage: AVAMessage; suggestions: ChatResponse['suggestions'] }> {
    const messageRepo = tx.getRepository(AVAMessage);
    const conversationRepo = tx.getRepository(AVAConversation);
    const metricsRepo = tx.getRepository(AVAUsageMetrics);
    const suggestionRepo = tx.getRepository(AVASuggestion);

    const { conversation, aiResponse, intent, userContext, firstUserMessage } = params;

    // 4. Assistant message (insert)
    const assistantMessage = await messageRepo.save(
      messageRepo.create({
        conversationId: conversation.id,
        role: 'assistant' as MessageRole,
        content: aiResponse.content,
        tokenCount: aiResponse.usage.totalTokens,
        responseTimeMs: aiResponse.latency,
        modelUsed: aiResponse.model,
        toolCalls:
          aiResponse.toolCalls.length > 0
            ? (aiResponse.toolCalls as Record<string, unknown>[])
            : undefined,
      }),
    );

    // 5. Conversation row update
    await conversationRepo.update(conversation.id, {
      messageCount: conversation.messageCount + 2,
      lastActivityAt: new Date(),
      title: conversation.title || this.generateConversationTitle(firstUserMessage),
    });

    // 6 + 7. Usage metrics (response_time + token_usage)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await metricsRepo.save(
      metricsRepo.create({
        userId: userContext.id,
        metricDate: today,
        metricType: 'response_time',
        metricValue: aiResponse.latency,
        dimensions: { type: 'chat' },
      }),
    );
    await metricsRepo.save(
      metricsRepo.create({
        userId: userContext.id,
        metricDate: today,
        metricType: 'token_usage',
        metricValue: aiResponse.usage.totalTokens,
        dimensions: { type: 'chat' },
      }),
    );

    // 8. Suggestion (conditional)
    const suggestions: ChatResponse['suggestions'] = [];
    if (intent.category === 'ticket_management' && intent.intentName === 'ticket.create') {
      suggestions.push({
        type: 'property_value',
        value: { property: 'category', options: ['Hardware', 'Software', 'Network', 'Access'] },
        explanation: 'Common ticket categories',
      });
      await suggestionRepo.save(
        suggestionRepo.create({
          userId: userContext.id,
          suggestionType: 'property_value' as SuggestionType,
          targetEntity: 'ticket',
          targetField: 'category',
          suggestedValue: { options: ['Hardware', 'Software', 'Network', 'Access'] },
          confidence: 0.8,
        }),
      );
    }

    return { assistantMessage, suggestions };
  }

  async getConversations(
    userId: string,
    organizationId: string,
    params: { status?: ConversationStatus; limit?: number; offset?: number } = {},
  ): Promise<{ items: AVAConversation[]; total: number }> {
    const where: Record<string, unknown> = { userId, organizationId };
    if (params.status) where.status = params.status;

    const [items, total] = await this.conversationRepo.findAndCount({
      where,
      take: params.limit || 20,
      skip: params.offset || 0,
      order: { lastActivityAt: 'DESC' },
    });

    return { items, total };
  }

  async getConversation(
    conversationId: string,
    userId: string,
    organizationId: string,
  ): Promise<AVAConversation | null> {
    return this.conversationRepo.findOne({
      where: { id: conversationId, userId, organizationId },
    });
  }

  async getMessagesForConversation(
    conversationId: string,
    userId: string,
    organizationId: string,
    params: { limit?: number; offset?: number } = {},
  ): Promise<{ items: AVAMessage[]; total: number }> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, userId, organizationId },
      select: ['id'],
    });
    if (!conversation) {
      return { items: [], total: 0 };
    }
    return this.getMessages(conversationId, params);
  }

  async getMessages(
    conversationId: string,
    params: { limit?: number; offset?: number } = {},
  ): Promise<{ items: AVAMessage[]; total: number }> {
    const [items, total] = await this.messageRepo.findAndCount({
      where: { conversationId },
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { createdAt: 'ASC' },
    });

    return { items, total };
  }

  async endConversation(
    conversationId: string,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await this.conversationRepo.update(
      { id: conversationId, userId, organizationId },
      { status: 'completed' as ConversationStatus },
    );
  }

  async submitFeedback(
    messageId: string,
    userId: string,
    feedback: { type: FeedbackType; rating?: number; comment?: string },
  ): Promise<AVAFeedback> {
    const feedbackEntry = this.feedbackRepo.create({
      userId,
      messageId,
      feedbackType: feedback.type,
      rating: feedback.rating,
      comment: feedback.comment,
    });

    return this.feedbackRepo.save(feedbackEntry);
  }

  async getSuggestions(
    userId: string,
    context: { entity?: string; property?: string },
  ): Promise<AVASuggestion[]> {
    const query = this.suggestionRepo
      .createQueryBuilder('suggestion')
      .where('suggestion.user_id = :userId', { userId })
      .andWhere('suggestion.is_accepted IS NULL')
      .orderBy('suggestion.created_at', 'DESC')
      .take(5);

    if (context.entity) {
      query.andWhere('suggestion.target_entity = :entity', { entity: context.entity });
    }
    if (context.property) {
      query.andWhere('suggestion.target_field = :property', { property: context.property });
    }

    return query.getMany();
  }

  async respondToSuggestion(
    suggestionId: string,
    userId: string,
    response: { accepted: boolean; feedback?: string },
  ): Promise<void> {
    await this.suggestionRepo.update(
      { id: suggestionId, userId },
      {
        isAccepted: response.accepted,
        userFeedback: response.feedback,
        respondedAt: new Date(),
      },
    );
  }

  async getUsageStats(
    userId?: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<{
    totalConversations: number;
    totalMessages: number;
    averageResponseTime: number;
    averageMessagesPerConversation: number;
    topIntents: Array<{ intent: string; count: number }>;
  }> {
    const conversationQuery = this.conversationRepo.createQueryBuilder('conv');
    const messageQuery = this.messageRepo.createQueryBuilder('msg');

    if (userId) {
      conversationQuery.where('conv.user_id = :userId', { userId });
    }

    if (dateRange) {
      conversationQuery.andWhere('conv.created_at BETWEEN :start AND :end', dateRange);
    }

    const totalConversations = await conversationQuery.getCount();

    // Get message stats with join to get conversation user filter
    const messageStats = await messageQuery
      .leftJoin('msg.conversation', 'conv')
      .where(userId ? 'conv.user_id = :userId' : '1=1', { userId })
      .select('COUNT(*)', 'count')
      .addSelect('AVG(msg.response_time_ms)', 'avgResponseTime')
      .getRawOne();

    // Get top intents
    const topIntents = await this.intentRepo
      .createQueryBuilder('intent')
      .select('intent.intent_name', 'intent')
      .addSelect('COUNT(*)', 'count')
      .groupBy('intent.intent_name')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalConversations,
      totalMessages: parseInt(messageStats?.count || '0'),
      averageResponseTime: parseFloat(messageStats?.avgResponseTime || '0'),
      averageMessagesPerConversation:
        totalConversations > 0
          ? parseInt(messageStats?.count || '0') / totalConversations
          : 0,
      topIntents: topIntents.map((t) => ({
        intent: t.intent,
        count: parseInt(t.count),
      })),
    };
  }

  private async classifyIntent(
    message: string,
    _userContext: UserContext,
  ): Promise<IntentResult> {
    const lowerMessage = message.toLowerCase();

    // Simple rule-based intent classification
    if (
      lowerMessage.includes('create') &&
      (lowerMessage.includes('ticket') || lowerMessage.includes('issue'))
    ) {
      return {
        category: 'ticket_management',
        intentName: 'ticket.create',
        confidence: 0.9,
        entities: this.extractEntities(message, 'ticket'),
        requiredPermissions: ['ticket.create'],
        needsClarification: false,
      };
    }

    if (
      (lowerMessage.includes('show') ||
        lowerMessage.includes('list') ||
        lowerMessage.includes('find')) &&
      lowerMessage.includes('ticket')
    ) {
      return {
        category: 'ticket_management',
        intentName: 'ticket.search',
        confidence: 0.85,
        entities: this.extractEntities(message, 'ticket'),
        requiredPermissions: ['ticket.read'],
        needsClarification: false,
      };
    }

    if (lowerMessage.includes('asset')) {
      return {
        category: 'asset_management',
        intentName: 'asset.search',
        confidence: 0.8,
        entities: this.extractEntities(message, 'asset'),
        requiredPermissions: ['asset.read'],
        needsClarification: false,
      };
    }

    if (
      lowerMessage.includes('help') ||
      lowerMessage.includes('what can you do') ||
      lowerMessage.includes('?')
    ) {
      return {
        category: 'system',
        intentName: 'system.help',
        confidence: 0.95,
        entities: {},
        requiredPermissions: [],
        needsClarification: false,
      };
    }

    if (
      lowerMessage.includes('hello') ||
      lowerMessage.includes('hi') ||
      lowerMessage.includes('hey')
    ) {
      return {
        category: 'system',
        intentName: 'system.greeting',
        confidence: 0.99,
        entities: {},
        requiredPermissions: [],
        needsClarification: false,
      };
    }

    return {
      category: 'unknown',
      intentName: 'unknown',
      confidence: 0.5,
      entities: {},
      requiredPermissions: [],
      needsClarification: true,
      clarificationQuestion: "I'm not sure what you're looking for. Could you be more specific?",
    };
  }

  private extractEntities(
    message: string,
    _entityType: string,
  ): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    // Extract ticket IDs
    const ticketMatch = message.match(/(?:INC|SR|CHG|PRB)-\d+/i);
    if (ticketMatch) {
      entities.ticketId = ticketMatch[0].toUpperCase();
    }

    // Extract priorities
    if (message.toLowerCase().includes('critical')) {
      entities.priority = 'critical';
    } else if (message.toLowerCase().includes('high')) {
      entities.priority = 'high';
    } else if (message.toLowerCase().includes('medium')) {
      entities.priority = 'medium';
    } else if (message.toLowerCase().includes('low')) {
      entities.priority = 'low';
    }

    // Extract status
    if (message.toLowerCase().includes('open')) {
      entities.status = 'open';
    } else if (message.toLowerCase().includes('closed')) {
      entities.status = 'closed';
    } else if (message.toLowerCase().includes('in progress')) {
      entities.status = 'in_progress';
    }

    return entities;
  }

  private getAvailableActions(
    intent: IntentResult,
    userPermissions: string[],
  ): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    required?: string[];
  }> {
    const actions: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
      required?: string[];
    }> = [];

    if (
      intent.category === 'ticket_management' &&
      userPermissions.includes('ticket.create')
    ) {
      actions.push({
        name: 'create_ticket',
        description: 'Create a new support ticket',
        parameters: {
          title: { type: 'string', description: 'Ticket title' },
          description: { type: 'string', description: 'Ticket description' },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
          },
          category: { type: 'string', description: 'Ticket category' },
        },
        required: ['title', 'description'],
      });
    }

    if (
      intent.category === 'ticket_management' &&
      userPermissions.includes('ticket.read')
    ) {
      actions.push({
        name: 'search_tickets',
        description: 'Search for tickets',
        parameters: {
          query: { type: 'string', description: 'Search query' },
          status: { type: 'string', description: 'Filter by status' },
          priority: { type: 'string', description: 'Filter by priority' },
          assignee: { type: 'string', description: 'Filter by assignee' },
        },
      });
    }

    return actions;
  }

  private generateConversationTitle(firstMessage: string): string {
    // Generate a title from the first message
    const truncated =
      firstMessage.length > 50 ? firstMessage.substring(0, 47) + '...' : firstMessage;
    return truncated;
  }

  private getActionLabel(actionName: string): string {
    const labels: Record<string, string> = {
      create_ticket: 'Create Ticket',
      search_tickets: 'Search Tickets',
      update_ticket: 'Update Ticket',
      close_ticket: 'Close Ticket',
      search_assets: 'Search Assets',
      allocate_asset: 'Allocate Asset',
    };
    return labels[actionName] || actionName;
  }

  private requiresConfirmation(actionName: string): boolean {
    const confirmationRequired = [
      'create_ticket',
      'update_ticket',
      'close_ticket',
      'allocate_asset',
      'delete_record',
    ];
    return confirmationRequired.includes(actionName);
  }
}
