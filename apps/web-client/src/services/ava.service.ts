/**
 * AVA Service - API Client for AVA Interactions
 * HubbleWave Platform - Phase 6
 */

import aiApi from './aiApi';

export interface AvaMessageRequest {
  message: string;
  conversationId?: string;
  context?: Record<string, unknown>;
}

export interface AvaMessageResponse {
  message: string;
  conversationId?: string;
  intent?: string;
  entities?: Record<string, string>;
  suggestions?: AvaSuggestionResponse[];
}

export interface AvaSuggestionResponse {
  id: string;
  type: 'action' | 'navigation' | 'query' | 'correction';
  text: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface AvaConversation {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AvaConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
  entities?: Record<string, string>;
}

export interface AvaFeedbackRequest {
  targetId: string;
  targetType: 'message' | 'suggestion' | 'prediction';
  feedbackType: 'positive' | 'negative';
  comment?: string;
  context?: Record<string, unknown>;
}

export interface AvaSuggestionsRequest {
  fieldId?: string;
  collectionId?: string;
  recordData?: Record<string, unknown>;
}

export interface AvaSuggestionsResponse {
  suggestions: AvaSuggestionResponse[];
}

export interface CreateFormulaRequest {
  description: string;
  context?: {
    collectionId?: string;
    availableProperties?: Array<{ name: string; type: string }>;
  };
}

export interface CreateFormulaResponse {
  formula: string;
  explanation: string;
  resultType: string;
  dependencies: string[];
  cacheStrategy: string;
  cacheTtl?: number;
  examples?: Array<{ input: string; output: string }>;
  alternatives?: CreateFormulaResponse[];
}

export const avaService = {
  /**
   * Send a chat message to AVA
   */
  async sendMessage(payload: AvaMessageRequest): Promise<AvaMessageResponse> {
    const res = await aiApi.post<AvaMessageResponse>('/ava/chat', payload);
    return res.data;
  },

  /**
   * List all conversations
   */
  async listConversations(): Promise<AvaConversation[]> {
    const res = await aiApi.get<AvaConversation[]>('/ava/conversations');
    return res.data;
  },

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(conversationId: string): Promise<AvaConversationMessage[]> {
    const res = await aiApi.get<AvaConversationMessage[]>(
      `/ava/conversations/${conversationId}/messages`
    );
    return res.data;
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await aiApi.delete(`/ava/conversations/${conversationId}`);
  },

  /**
   * Submit feedback for AVA response
   */
  async submitFeedback(payload: AvaFeedbackRequest): Promise<void> {
    await aiApi.post('/ava/feedback', payload);
  },

  /**
   * Get inline suggestions for a field or record
   */
  async getSuggestions(payload: AvaSuggestionsRequest): Promise<AvaSuggestionsResponse> {
    const res = await aiApi.post<AvaSuggestionsResponse>('/ava/suggestions', payload);
    return res.data;
  },

  /**
   * Dismiss a suggestion
   */
  async dismissSuggestion(suggestionId: string): Promise<void> {
    await aiApi.post(`/ava/suggestions/${suggestionId}/dismiss`);
  },

  /**
   * Apply a suggestion
   */
  async applySuggestion(suggestionId: string): Promise<void> {
    await aiApi.post(`/ava/suggestions/${suggestionId}/apply`);
  },

  /**
   * Generate a formula from natural language description
   */
  async createFormula(payload: CreateFormulaRequest): Promise<CreateFormulaResponse> {
    const res = await aiApi.post<CreateFormulaResponse>('/ava/formula', payload);
    return res.data;
  },

  /**
   * Transform text using AI (Summarize, Improve, etc.)
   */
  async transformText(payload: { text: string; instruction: string; context?: any }): Promise<{ text: string }> {
    const res = await aiApi.post<{ text: string }>('/ava/transform', payload);
    return res.data;
  },
};

export default avaService;
