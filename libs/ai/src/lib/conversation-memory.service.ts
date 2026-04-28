import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AVAConversation, AVAMessage as AVAMessageEntity } from '@hubblewave/instance-db';
import { AVAMessage, AVAContext } from './ava.service';

/**
 * Conversation Memory Service
 * Manages conversation history and context for AVA using normalized TypeORM entities
 */

export interface Conversation {
  id: string;
  userId: string;
  organizationId: string;
  title?: string;
  status: 'active' | 'completed' | 'abandoned' | 'escalated';
  messages: AVAMessage[];
  context: Partial<AVAContext>;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ConversationMemoryService {
  // In-memory cache for active conversations
  private conversations: Map<string, Conversation> = new Map();

  // Maximum messages to keep in memory per conversation
  private readonly MAX_MESSAGES_IN_MEMORY = 50;

  // Maximum conversations to keep in memory per user
  private readonly MAX_CONVERSATIONS_PER_USER = 10;

  /**
   * Get repository for AVAConversation entity
   */
  private getConversationRepo(dataSource: DataSource): Repository<AVAConversation> {
    return dataSource.getRepository(AVAConversation);
  }

  /**
   * Get repository for AVAMessage entity
   */
  private getMessageRepo(dataSource: DataSource): Repository<AVAMessageEntity> {
    return dataSource.getRepository(AVAMessageEntity);
  }

  /**
   * Start a new conversation
   */
  async startConversation(
    dataSource: DataSource,
    userId: string,
    organizationId: string,
    context?: Partial<AVAContext>
  ): Promise<Conversation> {
    this.requireOrganizationId(organizationId);
    const conversationRepo = this.getConversationRepo(dataSource);
    const now = new Date();

    const conversationEntity = conversationRepo.create({
      userId,
      organizationId,
      status: 'active',
      messageCount: 0,
      lastActivityAt: now,
      sessionMetadata: context ? { initialContext: context } : undefined,
    });

    const saved = await conversationRepo.save(conversationEntity);

    const conversation: Conversation = {
      id: saved.id,
      userId: saved.userId,
      organizationId: saved.organizationId ?? organizationId,
      title: saved.title,
      status: saved.status,
      messages: [],
      context: context || {},
      messageCount: 0,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };

    // Cache in memory keyed by id+org so cross-tenant cache lookups miss.
    this.conversations.set(this.cacheKey(organizationId, saved.id), conversation);
    this.pruneUserConversations(organizationId, userId);

    return conversation;
  }

  /**
   * Get a conversation by ID with its messages
   */
  async getConversation(
    dataSource: DataSource,
    conversationId: string,
    organizationId: string,
    userId: string,
  ): Promise<Conversation | null> {
    this.requireOrganizationId(organizationId);
    const cacheKey = this.cacheKey(organizationId, conversationId);
    if (this.conversations.has(cacheKey)) {
      const cached = this.conversations.get(cacheKey)!;
      if (cached.userId !== userId) {
        return null;
      }
      return cached;
    }

    const conversationRepo = this.getConversationRepo(dataSource);
    const messageRepo = this.getMessageRepo(dataSource);

    const conversationEntity = await conversationRepo.findOne({
      where: { id: conversationId, organizationId, userId },
    });

    if (!conversationEntity) {
      return null;
    }

    // Load messages
    const messageEntities = await messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });

    const messages: AVAMessage[] = messageEntities
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt,
      }));

    const conversation: Conversation = {
      id: conversationEntity.id,
      userId: conversationEntity.userId,
      organizationId: conversationEntity.organizationId ?? organizationId,
      title: conversationEntity.title,
      status: conversationEntity.status,
      messages,
      context: (conversationEntity.sessionMetadata?.['initialContext'] as Partial<AVAContext>) || {},
      messageCount: conversationEntity.messageCount,
      createdAt: conversationEntity.createdAt,
      updatedAt: conversationEntity.updatedAt,
      metadata: conversationEntity.sessionMetadata,
    };

    this.conversations.set(cacheKey, conversation);

    return conversation;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    dataSource: DataSource,
    conversationId: string,
    organizationId: string,
    userId: string,
    message: AVAMessage
  ): Promise<void> {
    this.requireOrganizationId(organizationId);
    const conversationRepo = this.getConversationRepo(dataSource);
    const messageRepo = this.getMessageRepo(dataSource);

    // Verify the conversation exists and belongs to the (org, user) tuple
    // before any write. This is the single source of truth for "is this
    // conversation visible to this caller?".
    const conversationEntity = await conversationRepo.findOne({
      where: { id: conversationId, organizationId, userId },
    });

    if (!conversationEntity) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Create message entity
    const messageEntity = messageRepo.create({
      conversationId,
      role: message.role,
      content: message.content,
    });

    await messageRepo.save(messageEntity);

    // Generate title from first user message if not set
    let newTitle = conversationEntity.title;
    if (!newTitle && message.role === 'user') {
      newTitle = this.generateTitle(message.content);
    }

    conversationEntity.messageCount = (conversationEntity.messageCount || 0) + 1;
    conversationEntity.lastActivityAt = new Date();
    if (newTitle) {
      conversationEntity.title = newTitle;
    }

    await conversationRepo.save(conversationEntity);

    // Update cache
    const cacheKey = this.cacheKey(organizationId, conversationId);
    const cachedConversation = this.conversations.get(cacheKey);
    if (cachedConversation) {
      cachedConversation.messages.push(message);
      cachedConversation.updatedAt = new Date();
      cachedConversation.messageCount = conversationEntity.messageCount;
      if (newTitle) {
        cachedConversation.title = newTitle;
      }

      // Prune old messages if necessary
      if (cachedConversation.messages.length > this.MAX_MESSAGES_IN_MEMORY) {
        cachedConversation.messages = cachedConversation.messages.slice(-this.MAX_MESSAGES_IN_MEMORY);
      }

      this.conversations.set(cacheKey, cachedConversation);
    }
  }

  /**
   * Get recent conversations for a user
   */
  async getUserConversations(
    dataSource: DataSource,
    userId: string,
    organizationId: string,
    limit = 20
  ): Promise<ConversationSummary[]> {
    this.requireOrganizationId(organizationId);
    const conversationRepo = this.getConversationRepo(dataSource);
    const messageRepo = this.getMessageRepo(dataSource);

    const conversations = await conversationRepo.find({
      where: { userId, organizationId },
      order: { updatedAt: 'DESC' },
      take: limit,
    });

    const summaries: ConversationSummary[] = [];

    for (const conv of conversations) {
      // Get last message
      const lastMessageEntity = await messageRepo.findOne({
        where: { conversationId: conv.id },
        order: { createdAt: 'DESC' },
      });

      summaries.push({
        id: conv.id,
        title: conv.title || 'New conversation',
        messageCount: conv.messageCount || 0,
        lastMessage: lastMessageEntity?.content?.substring(0, 100) || '',
        status: conv.status,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      });
    }

    return summaries;
  }

  /**
   * Get conversation history for context
   */
  async getConversationHistory(
    dataSource: DataSource,
    conversationId: string,
    organizationId: string,
    userId: string,
    limit = 10
  ): Promise<AVAMessage[]> {
    const conversation = await this.getConversation(
      dataSource,
      conversationId,
      organizationId,
      userId,
    );
    if (!conversation) return [];

    return conversation.messages.slice(-limit);
  }

  /**
   * Update conversation context
   */
  async updateContext(
    dataSource: DataSource,
    conversationId: string,
    organizationId: string,
    userId: string,
    context: Partial<AVAContext>
  ): Promise<void> {
    this.requireOrganizationId(organizationId);
    const conversationRepo = this.getConversationRepo(dataSource);

    const conversationEntity = await conversationRepo.findOne({
      where: { id: conversationId, organizationId, userId },
    });

    if (!conversationEntity) return;

    const existingMetadata = conversationEntity.sessionMetadata || {};
    const existingContext = (existingMetadata['initialContext'] as Partial<AVAContext>) || {};

    conversationEntity.sessionMetadata = {
      ...existingMetadata,
      initialContext: { ...existingContext, ...context },
    };

    await conversationRepo.save(conversationEntity);

    // Update cache
    const cacheKey = this.cacheKey(organizationId, conversationId);
    const cachedConversation = this.conversations.get(cacheKey);
    if (cachedConversation) {
      cachedConversation.context = { ...cachedConversation.context, ...context };
      cachedConversation.updatedAt = new Date();
      this.conversations.set(cacheKey, cachedConversation);
    }
  }

  /**
   * Delete a conversation and its messages
   */
  async deleteConversation(
    dataSource: DataSource,
    conversationId: string,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    this.requireOrganizationId(organizationId);
    const conversationRepo = this.getConversationRepo(dataSource);
    const messageRepo = this.getMessageRepo(dataSource);

    // Verify ownership and tenant scope before deletion. We do this at the
    // service so the cache invalidation and cascade match exactly one row.
    const owned = await conversationRepo.findOne({
      where: { id: conversationId, organizationId, userId },
      select: ['id'],
    });
    if (!owned) {
      return;
    }

    this.conversations.delete(this.cacheKey(organizationId, conversationId));

    // Delete messages first (cascade should handle this, but explicit for safety)
    await messageRepo.delete({ conversationId });

    // Delete conversation
    await conversationRepo.delete({ id: conversationId, organizationId, userId });
  }

  /**
   * Clear all conversations for a user
   */
  async clearUserConversations(
    dataSource: DataSource,
    userId: string,
    organizationId: string,
  ): Promise<number> {
    this.requireOrganizationId(organizationId);
    const conversationRepo = this.getConversationRepo(dataSource);
    const messageRepo = this.getMessageRepo(dataSource);

    // Get user's conversations
    const conversations = await conversationRepo.find({
      where: { userId, organizationId },
      select: ['id'],
    });

    const conversationIds = conversations.map((c) => c.id);

    // Remove from cache
    for (const id of conversationIds) {
      this.conversations.delete(this.cacheKey(organizationId, id));
    }

    // Delete messages for all conversations
    if (conversationIds.length > 0) {
      await messageRepo
        .createQueryBuilder()
        .delete()
        .where('conversation_id IN (:...ids)', { ids: conversationIds })
        .execute();
    }

    // Delete conversations
    const result = await conversationRepo.delete({ userId, organizationId });

    return result.affected || 0;
  }

  /**
   * Search conversations by content
   */
  async searchConversations(
    dataSource: DataSource,
    userId: string,
    organizationId: string,
    query: string,
    limit = 10
  ): Promise<ConversationSummary[]> {
    this.requireOrganizationId(organizationId);
    const conversationRepo = this.getConversationRepo(dataSource);

    // Search in conversation titles
    const conversations = await conversationRepo
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.organization_id = :organizationId', { organizationId })
      .andWhere('(c.title ILIKE :query OR c.context_summary ILIKE :query)', {
        query: `%${query}%`
      })
      .orderBy('c.updated_at', 'DESC')
      .take(limit)
      .getMany();

    return conversations.map((conv) => ({
      id: conv.id,
      title: conv.title || 'New conversation',
      messageCount: conv.messageCount || 0,
      lastMessage: '',
      status: conv.status,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));
  }

  /**
   * Mark conversation as completed
   */
  async completeConversation(
    dataSource: DataSource,
    conversationId: string,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    this.requireOrganizationId(organizationId);
    const conversationRepo = this.getConversationRepo(dataSource);

    await conversationRepo.update(
      { id: conversationId, organizationId, userId },
      { status: 'completed' }
    );

    // Update cache
    const cacheKey = this.cacheKey(organizationId, conversationId);
    const cachedConversation = this.conversations.get(cacheKey);
    if (cachedConversation) {
      cachedConversation.status = 'completed';
      this.conversations.set(cacheKey, cachedConversation);
    }
  }

  /**
   * Escalate conversation to a user
   */
  async escalateConversation(
    dataSource: DataSource,
    conversationId: string,
    organizationId: string,
    userId: string,
    escalateTo: string,
    reason: string
  ): Promise<void> {
    this.requireOrganizationId(organizationId);
    const conversationRepo = this.getConversationRepo(dataSource);

    await conversationRepo.update(
      { id: conversationId, organizationId, userId },
      {
        status: 'escalated',
        escalatedTo: escalateTo,
        escalationReason: reason,
      }
    );

    // Update cache
    const cacheKey = this.cacheKey(organizationId, conversationId);
    const cachedConversation = this.conversations.get(cacheKey);
    if (cachedConversation) {
      cachedConversation.status = 'escalated';
      this.conversations.set(cacheKey, cachedConversation);
    }
  }

  /**
   * Generate a title from the first message
   */
  private generateTitle(content: string): string {
    // Take first 50 chars and clean up
    let title = content.substring(0, 50).trim();

    // Remove trailing incomplete words
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > 20 && lastSpace < title.length - 1) {
      title = title.substring(0, lastSpace);
    }

    // Add ellipsis if truncated
    if (content.length > 50) {
      title += '...';
    }

    return title;
  }

  /**
   * Prune old conversations from cache for a (org, user) tuple.
   */
  private pruneUserConversations(organizationId: string, userId: string): void {
    const userConversations: [string, Conversation][] = [];

    for (const [key, conv] of this.conversations) {
      if (conv.userId === userId && conv.organizationId === organizationId) {
        userConversations.push([key, conv]);
      }
    }

    // Sort by updatedAt and remove oldest if over limit
    if (userConversations.length > this.MAX_CONVERSATIONS_PER_USER) {
      userConversations.sort((a, b) =>
        b[1].updatedAt.getTime() - a[1].updatedAt.getTime()
      );

      for (let i = this.MAX_CONVERSATIONS_PER_USER; i < userConversations.length; i++) {
        this.conversations.delete(userConversations[i][0]);
      }
    }
  }

  /**
   * Build a cache key that is impossible to collide across tenants. We never
   * key purely on conversationId because in any deployment that shares a
   * process across instances the cached object would be visible to all of them.
   */
  private cacheKey(organizationId: string, conversationId: string): string {
    return `${organizationId}::${conversationId}`;
  }

  private requireOrganizationId(organizationId: string): void {
    if (!organizationId || typeof organizationId !== 'string' || !organizationId.trim()) {
      throw new Error('organizationId is required for conversation memory operations');
    }
  }
}
