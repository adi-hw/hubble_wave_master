import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AVAMessage, AVAContext } from './ava.service';

/**
 * Conversation Memory Service
 * Manages conversation history and context for AVA
 */

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  messages: AVAMessage[];
  context: Partial<AVAContext>;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ConversationMemoryService {
  private readonly logger = new Logger(ConversationMemoryService.name);

  // In-memory cache for active conversations
  private conversations: Map<string, Conversation> = new Map();

  // Maximum messages to keep in memory per conversation
  private readonly MAX_MESSAGES_IN_MEMORY = 50;

  // Maximum conversations to keep in memory per user
  private readonly MAX_CONVERSATIONS_PER_USER = 10;

  /**
   * Initialize conversation tables for a tenant
   */
  async initializeTenantConversations(dataSource: DataSource): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS ava_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          title VARCHAR(500),
          messages JSONB DEFAULT '[]',
          context JSONB DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_ava_conversations_user_id
        ON ava_conversations (user_id)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_ava_conversations_updated_at
        ON ava_conversations (updated_at DESC)
      `);

      this.logger.log('Conversation tables initialized');
    } catch (error) {
      this.logger.error('Failed to initialize conversation tables', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Start a new conversation
   */
  async startConversation(
    dataSource: DataSource,
    userId: string,
    context?: Partial<AVAContext>
  ): Promise<Conversation> {
    const id = crypto.randomUUID();
    const now = new Date();

    const conversation: Conversation = {
      id,
      userId,
      messages: [],
      context: context || {},
      createdAt: now,
      updatedAt: now,
    };

    // Save to database
    await dataSource.query(
      `INSERT INTO ava_conversations (id, user_id, context, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, userId, JSON.stringify(context || {}), now, now]
    );

    // Cache in memory
    this.conversations.set(id, conversation);
    this.pruneUserConversations(userId);

    return conversation;
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(
    dataSource: DataSource,
    conversationId: string
  ): Promise<Conversation | null> {
    // Check cache first
    if (this.conversations.has(conversationId)) {
      return this.conversations.get(conversationId)!;
    }

    // Load from database
    const rows = await dataSource.query(
      `SELECT * FROM ava_conversations WHERE id = $1`,
      [conversationId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const conversation: Conversation = {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      messages: row.messages || [],
      context: row.context || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      metadata: row.metadata,
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
    let conversation = await this.getConversation(dataSource, conversationId);

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Add message
    conversation.messages.push(message);
    conversation.updatedAt = new Date();

    // Prune old messages if necessary
    if (conversation.messages.length > this.MAX_MESSAGES_IN_MEMORY) {
      conversation.messages = conversation.messages.slice(-this.MAX_MESSAGES_IN_MEMORY);
    }

    // Generate title from first user message if not set
    if (!conversation.title && message.role === 'user') {
      conversation.title = this.generateTitle(message.content);
    }

    // Update cache
    this.conversations.set(conversationId, conversation);

    // Save to database
    await dataSource.query(
      `UPDATE ava_conversations
       SET messages = $1, title = $2, updated_at = $3
       WHERE id = $4`,
      [
        JSON.stringify(conversation.messages),
        conversation.title,
        conversation.updatedAt,
        conversationId,
      ]
    );
  }

  /**
   * Get recent conversations for a user
   */
  async getUserConversations(
    dataSource: DataSource,
    userId: string,
    limit = 20
  ): Promise<ConversationSummary[]> {
    const rows = await dataSource.query(
      `SELECT id, title, messages, created_at, updated_at
       FROM ava_conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return rows.map((row: { id: string; title?: string; messages: AVAMessage[]; created_at: string; updated_at: string }) => {
      const messages = row.messages || [];
      const lastMessage = messages.length > 0
        ? messages[messages.length - 1].content.substring(0, 100)
        : '';

      return {
        id: row.id,
        title: row.title || 'New conversation',
        messageCount: messages.length,
        lastMessage,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    });
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
    const conversation = await this.getConversation(dataSource, conversationId);
    if (!conversation) return;

    conversation.context = { ...conversation.context, ...context };
    conversation.updatedAt = new Date();

    this.conversations.set(conversationId, conversation);

    await dataSource.query(
      `UPDATE ava_conversations SET context = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(conversation.context), conversation.updatedAt, conversationId]
    );
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(
    dataSource: DataSource,
    conversationId: string
  ): Promise<void> {
    this.conversations.delete(conversationId);
    await dataSource.query(
      `DELETE FROM ava_conversations WHERE id = $1`,
      [conversationId]
    );
  }

  /**
   * Clear all conversations for a user
   */
  async clearUserConversations(
    dataSource: DataSource,
    userId: string
  ): Promise<number> {
    // Remove from cache
    for (const [id, conv] of this.conversations) {
      if (conv.userId === userId) {
        this.conversations.delete(id);
      }
    }

    // Delete from database
    const result = await dataSource.query(
      `DELETE FROM ava_conversations WHERE user_id = $1`,
      [userId]
    );

    return result[1] || 0;
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
    const rows = await dataSource.query(
      `SELECT id, title, messages, created_at, updated_at
       FROM ava_conversations
       WHERE user_id = $1
         AND (title ILIKE $2 OR messages::text ILIKE $2)
       ORDER BY updated_at DESC
       LIMIT $3`,
      [userId, `%${query}%`, limit]
    );

    return rows.map((row: { id: string; title?: string; messages: AVAMessage[]; created_at: string; updated_at: string }) => ({
      id: row.id,
      title: row.title || 'New conversation',
      messageCount: (row.messages || []).length,
      lastMessage: '',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
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
