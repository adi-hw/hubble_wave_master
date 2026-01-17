/**
 * AVA Core Engine Service
 * HubbleWave Platform - Phase 6
 *
 * Main orchestrator for all AVA AI capabilities.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    @InjectRepository(AVAUsageMetrics)
    private readonly metricsRepo: Repository<AVAUsageMetrics>,
    private readonly llmProvider: LLMProviderService,
  ) {}

  async chat(request: ChatRequest, userContext: UserContext): Promise<ChatResponse> {
    const startTime = Date.now();

    // Get or create conversation
    let conversation: AVAConversation;
    if (request.conversationId) {
      const existing = await this.conversationRepo.findOne({
        where: { id: request.conversationId, userId: userContext.id },
      });
      if (existing) {
        conversation = existing;
      } else {
        conversation = await this.createConversation(userContext);
      }
    } else {
      conversation = await this.createConversation(userContext);
    }

    // Save user message
    const userMessage = await this.saveMessage({
      conversationId: conversation.id,
      role: 'user' as MessageRole,
      content: request.message,
    });

    // Classify intent
    const intent = await this.classifyIntent(request.message, userContext);

    // Save intent classification
    await this.saveIntent(userMessage.id, intent);

    // Get conversation history for context
    const history = await this.getConversationHistory(conversation.id, 10);

    // Generate AI response
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

    // Save assistant message
    const assistantMessage = await this.saveMessage({
      conversationId: conversation.id,
      role: 'assistant' as MessageRole,
      content: aiResponse.content,
      tokenCount: aiResponse.usage.totalTokens,
      responseTimeMs: aiResponse.latency,
      modelUsed: aiResponse.model,
      toolCalls: aiResponse.toolCalls.length > 0 ? aiResponse.toolCalls : undefined,
    });

    // Update conversation
    await this.conversationRepo.update(conversation.id, {
      messageCount: conversation.messageCount + 2,
      lastActivityAt: new Date(),
      title: conversation.title || this.generateConversationTitle(request.message),
    });

    // Record usage metrics
    await this.recordUsageMetrics(userContext.id, aiResponse.latency, aiResponse.usage.totalTokens);

    // Generate suggestions if applicable
    const suggestions = await this.generateSuggestions(intent, userContext);

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

  async getConversations(
    userId: string,
    params: { status?: ConversationStatus; limit?: number; offset?: number } = {},
  ): Promise<{ items: AVAConversation[]; total: number }> {
    const where: Record<string, unknown> = { userId };
    if (params.status) where.status = params.status;

    const [items, total] = await this.conversationRepo.findAndCount({
      where,
      take: params.limit || 20,
      skip: params.offset || 0,
      order: { lastActivityAt: 'DESC' },
    });

    return { items, total };
  }

  async getConversation(conversationId: string, userId: string): Promise<AVAConversation | null> {
    return this.conversationRepo.findOne({
      where: { id: conversationId, userId },
    });
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

  async endConversation(conversationId: string, userId: string): Promise<void> {
    await this.conversationRepo.update(
      { id: conversationId, userId },
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

  private async createConversation(userContext: UserContext): Promise<AVAConversation> {
    const conversation = this.conversationRepo.create({
      userId: userContext.id,
      status: 'active' as ConversationStatus,
      messageCount: 0,
      lastActivityAt: new Date(),
      sessionMetadata: {
        organizationId: userContext.organizationId,
        userRole: userContext.role,
      },
    });

    return this.conversationRepo.save(conversation);
  }

  private async saveMessage(data: {
    conversationId: string;
    role: MessageRole;
    content: string;
    tokenCount?: number;
    responseTimeMs?: number;
    modelUsed?: string;
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  }): Promise<AVAMessage> {
    const message = this.messageRepo.create({
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      tokenCount: data.tokenCount,
      responseTimeMs: data.responseTimeMs,
      modelUsed: data.modelUsed,
      toolCalls: data.toolCalls as Record<string, unknown>[],
    });

    return this.messageRepo.save(message);
  }

  private async saveIntent(messageId: string, intent: IntentResult): Promise<AVAIntent> {
    const intentEntity = this.intentRepo.create({
      messageId,
      category: intent.category,
      intentName: intent.intentName,
      confidence: intent.confidence,
      detectedEntities: intent.entities,
      requiredPermissions: intent.requiredPermissions,
      isClarificationNeeded: intent.needsClarification,
      clarificationQuestion: intent.clarificationQuestion,
    });

    return this.intentRepo.save(intentEntity);
  }

  private async getConversationHistory(
    conversationId: string,
    limit: number,
  ): Promise<AVAMessage[]> {
    return this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
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

  private async generateSuggestions(
    intent: IntentResult,
    userContext: UserContext,
  ): Promise<
    Array<{
      type: SuggestionType;
      value: Record<string, unknown>;
      explanation?: string;
    }>
  > {
    const suggestions: Array<{
      type: SuggestionType;
      value: Record<string, unknown>;
      explanation?: string;
    }> = [];

    if (intent.category === 'ticket_management' && intent.intentName === 'ticket.create') {
      // Suggest common categories
      suggestions.push({
        type: 'property_value',
        value: { property: 'category', options: ['Hardware', 'Software', 'Network', 'Access'] },
        explanation: 'Common ticket categories',
      });

      // Save suggestion to DB for tracking
      await this.suggestionRepo.save({
        userId: userContext.id,
        suggestionType: 'property_value' as SuggestionType,
        targetEntity: 'ticket',
        targetField: 'category',
        suggestedValue: { options: ['Hardware', 'Software', 'Network', 'Access'] },
        confidence: 0.8,
      });
    }

    return suggestions;
  }

  private async recordUsageMetrics(
    userId: string,
    responseTimeMs: number,
    tokenCount: number,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Record response time metric
    await this.metricsRepo.save({
      userId,
      metricDate: today,
      metricType: 'response_time',
      metricValue: responseTimeMs,
      dimensions: { type: 'chat' },
    });

    // Record token usage metric
    await this.metricsRepo.save({
      userId,
      metricDate: today,
      metricType: 'token_usage',
      metricValue: tokenCount,
      dimensions: { type: 'chat' },
    });
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
