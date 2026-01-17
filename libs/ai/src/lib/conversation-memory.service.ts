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
    context?: Partial<AVAContext>
  ): Promise<Conversation> {
    const conversationRepo = this.getConversationRepo(dataSource);
    const now = new Date();

    const conversationEntity = conversationRepo.create({
      userId,
      status: 'active',
      messageCount: 0,
      lastActivityAt: now,
      sessionMetadata: context ? { initialContext: context } : undefined,
    });

    const saved = await conversationRepo.save(conversationEntity);

    const conversation: Conversation = {
      id: saved.id,
      userId: saved.userId,
      title: saved.title,
      status: saved.status,
      messages: [],
      context: context || {},
      messageCount: 0,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };

    // Cache in memory
    this.conversations.set(saved.id, conversation);
    this.pruneUserConversations(userId);

    return conversation;
  }

  /**
   * Get a conversation by ID with its messages
   */
  async getConversation(
    dataSource: DataSource,
    conversationId: string
  ): Promise<Conversation | null> {
    // Check cache first
    if (this.conversations.has(conversationId)) {
      return this.conversations.get(conversationId)!;
    }

    const conversationRepo = this.getConversationRepo(dataSource);
    const messageRepo = this.getMessageRepo(dataSource);

    const conversationEntity = await conversationRepo.findOne({
      where: { id: conversationId },
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
      title: conversationEntity.title,
      status: conversationEntity.status,
      messages,
      context: (conversationEntity.sessionMetadata?.['initialContext'] as Partial<AVAContext>) || {},
      messageCount: conversationEntity.messageCount,
      createdAt: conversationEntity.createdAt,
      updatedAt: conversationEntity.updatedAt,
      metadata: conversationEntity.sessionMetadata,
    };

    // Cache for future use
    this.conversations.set(conversationId, conversation);

    return conversation;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    dataSource: DataSource,
    conversationId: string,
    message: AVAMessage
  ): Promise<void> {
    const conversationRepo = this.getConversationRepo(dataSource);
    const messageRepo = this.getMessageRepo(dataSource);

    // Create message entity
    const messageEntity = messageRepo.create({
      conversationId,
      role: message.role,
      content: message.content,
    });

    await messageRepo.save(messageEntity);

    // Update conversation
    const conversationEntity = await conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversationEntity) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

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
    let cachedConversation = this.conversations.get(conversationId);
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

      this.conversations.set(conversationId, cachedConversation);
    }
  }

  /**
   * Get recent conversations for a user
   */
  async getUserConversations(
    dataSource: DataSource,
    userId: string,
    limit = 20
  ): Promise<ConversationSummary[]> {
    const conversationRepo = this.getConversationRepo(dataSource);
    const messageRepo = this.getMessageRepo(dataSource);

    const conversations = await conversationRepo.find({
      where: { userId },
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
    limit = 10
  ): Promise<AVAMessage[]> {
    const conversation = await this.getConversation(dataSource, conversationId);
    if (!conversation) return [];

    return conversation.messages.slice(-limit);
  }

  /**
   * Update conversation context
   */
  async updateContext(
    dataSource: DataSource,
    conversationId: string,
    context: Partial<AVAContext>
  ): Promise<void> {
    const conversationRepo = this.getConversationRepo(dataSource);

    const conversationEntity = await conversationRepo.findOne({
      where: { id: conversationId },
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
    const cachedConversation = this.conversations.get(conversationId);
    if (cachedConversation) {
      cachedConversation.context = { ...cachedConversation.context, ...context };
      cachedConversation.updatedAt = new Date();
      this.conversations.set(conversationId, cachedConversation);
    }
  }

  /**
   * Delete a conversation and its messages
   */
  async deleteConversation(
    dataSource: DataSource,
    conversationId: string
  ): Promise<void> {
    const conversationRepo = this.getConversationRepo(dataSource);
    const messageRepo = this.getMessageRepo(dataSource);

    // Remove from cache
    this.conversations.delete(conversationId);

    // Delete messages first (cascade should handle this, but explicit for safety)
    await messageRepo.delete({ conversationId });

    // Delete conversation
    await conversationRepo.delete({ id: conversationId });
  }

  /**
   * Clear all conversations for a user
   */
  async clearUserConversations(
    dataSource: DataSource,
    userId: string
  ): Promise<number> {
    const conversationRepo = this.getConversationRepo(dataSource);
    const messageRepo = this.getMessageRepo(dataSource);

    // Get user's conversations
    const conversations = await conversationRepo.find({
      where: { userId },
      select: ['id'],
    });

    const conversationIds = conversations.map((c) => c.id);

    // Remove from cache
    for (const id of conversationIds) {
      this.conversations.delete(id);
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
    const result = await conversationRepo.delete({ userId });

    return result.affected || 0;
  }

  /**
   * Search conversations by content
   */
  async searchConversations(
    dataSource: DataSource,
    userId: string,
    query: string,
    limit = 10
  ): Promise<ConversationSummary[]> {
    const conversationRepo = this.getConversationRepo(dataSource);

    // Search in conversation titles
    const conversations = await conversationRepo
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
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
    conversationId: string
  ): Promise<void> {
    const conversationRepo = this.getConversationRepo(dataSource);

    await conversationRepo.update(
      { id: conversationId },
      { status: 'completed' }
    );

    // Update cache
    const cachedConversation = this.conversations.get(conversationId);
    if (cachedConversation) {
      cachedConversation.status = 'completed';
      this.conversations.set(conversationId, cachedConversation);
    }
  }

  /**
   * Escalate conversation to a user
   */
  async escalateConversation(
    dataSource: DataSource,
    conversationId: string,
    escalateTo: string,
    reason: string
  ): Promise<void> {
    const conversationRepo = this.getConversationRepo(dataSource);

    await conversationRepo.update(
      { id: conversationId },
      {
        status: 'escalated',
        escalatedTo: escalateTo,
        escalationReason: reason,
      }
    );

    // Update cache
    const cachedConversation = this.conversations.get(conversationId);
    if (cachedConversation) {
      cachedConversation.status = 'escalated';
      this.conversations.set(conversationId, cachedConversation);
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
   * Prune old conversations from cache for a user
   */
  private pruneUserConversations(userId: string): void {
    const userConversations: [string, Conversation][] = [];

    for (const [id, conv] of this.conversations) {
      if (conv.userId === userId) {
        userConversations.push([id, conv]);
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
}
