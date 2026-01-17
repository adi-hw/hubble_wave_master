/**
 * useAva - React Hook for AVA Interactions
 * HubbleWave Platform - Phase 6
 *
 * Provides AVA chat functionality, conversation management,
 * and smart suggestion handling.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface AvaMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: boolean;
  intent?: string;
  entities?: Record<string, string>;
  suggestions?: AvaSuggestion[];
  sources?: AvaSource[];
  cards?: AvaCard[];
}

export interface AvaSuggestion {
  id: string;
  type: 'action' | 'navigation' | 'query' | 'correction';
  text: string;
  confidence: number;
  action?: () => void;
  metadata?: Record<string, unknown>;
}

export interface AvaSource {
  type: string;
  id: string;
  title: string;
  relevance: number;
}

export interface AvaCard {
  code: string;
  name: string;
  description?: string | null;
  layout: Record<string, unknown>;
  actionBindings?: Record<string, unknown>;
}

export interface AvaAction {
  type: 'navigate' | 'create' | 'update' | 'execute';
  label: string;
  target: string;
  params?: Record<string, unknown>;
}

export interface AvaConversation {
  id: string;
  title: string;
  messages: AvaMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AvaContext {
  page?: string;
  collectionId?: string;
  recordId?: string;
  selectedRecords?: string[];
  viewId?: string;
  userId?: string;
}

interface UseAvaOptions {
  context?: AvaContext;
  conversationId?: string;
  onSuggestion?: (suggestion: AvaSuggestion) => void;
}

interface UseAvaReturn {
  messages: AvaMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
  suggestions: AvaSuggestion[];
  sendMessage: (content: string) => Promise<void>;
  clearConversation: () => void;
  retryLastMessage: () => Promise<void>;
  provideFeedback: (messageId: string, type: 'positive' | 'negative', comment?: string) => Promise<void>;
  applySuggestion: (suggestion: AvaSuggestion) => void;
  dismissSuggestion: (suggestionId: string) => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useAva(options: UseAvaOptions = {}): UseAvaReturn {
  const { context, onSuggestion } = options;
  const [messages, setMessages] = useState<AvaMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(options.conversationId || null);
  const [suggestions, setSuggestions] = useState<AvaSuggestion[]>([]);
  const lastUserMessageRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);
      lastUserMessageRef.current = content.trim();

      const userMessage: AvaMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const assistantMessageId = generateId();
      const assistantMessage: AvaMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/ava/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content.trim(),
            conversationId,
            context,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.statusText}`);
        }

        const data = await response.json();

        // Update conversation ID if new
        if (data.conversationId && !conversationId) {
          setConversationId(data.conversationId);
        }

        const responseSuggestions = normalizeSuggestions(data);

        const responseSources = normalizeSources(data);
        const responseCards = normalizeCards(data);

        // Update the assistant message with the response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: data.message || 'I processed your request.',
                  isStreaming: false,
                  intent: data.intent,
                  entities: data.entities,
                  suggestions: responseSuggestions,
                  sources: responseSources,
                  cards: responseCards,
                }
              : msg
          )
        );

        // Update suggestions
        if (responseSuggestions.length > 0) {
          setSuggestions(responseSuggestions);
          if (onSuggestion && responseSuggestions[0]) {
            onSuggestion(responseSuggestions[0]);
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        console.error('AVA chat error:', err);
        setError((err as Error).message);

        // Provide fallback response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: "I'm having trouble connecting right now. Please try again in a moment.",
                  isStreaming: false,
                  error: true,
                }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [context, conversationId, isLoading, onSuggestion]
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setSuggestions([]);
    setError(null);
    lastUserMessageRef.current = '';
  }, []);

  const retryLastMessage = useCallback(async () => {
    if (!lastUserMessageRef.current || isLoading) return;

    // Remove the last assistant message (the failed one)
    setMessages((prev) => {
      const lastIndex = prev.length - 1;
      if (prev[lastIndex]?.role === 'assistant') {
        return prev.slice(0, lastIndex);
      }
      return prev;
    });

    // Also remove the last user message so sendMessage can re-add it
    setMessages((prev) => {
      const lastIndex = prev.length - 1;
      if (prev[lastIndex]?.role === 'user') {
        return prev.slice(0, lastIndex);
      }
      return prev;
    });

    await sendMessage(lastUserMessageRef.current);
  }, [isLoading, sendMessage]);

  const provideFeedback = useCallback(
    async (messageId: string, type: 'positive' | 'negative', comment?: string) => {
      try {
        await fetch('/api/ava/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            conversationId,
            feedbackType: type,
            comment,
          }),
        });
      } catch (err) {
        console.error('Failed to submit feedback:', err);
      }
    },
    [conversationId]
  );

  const applySuggestion = useCallback(
    (suggestion: AvaSuggestion) => {
      if (suggestion.action) {
        suggestion.action();
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    },
    []
  );

  const dismissSuggestion = useCallback((suggestionId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
  }, []);

  return {
    messages,
    isLoading,
    error,
    conversationId,
    suggestions,
    sendMessage,
    clearConversation,
    retryLastMessage,
    provideFeedback,
    applySuggestion,
    dismissSuggestion,
  };
}

function normalizeSuggestions(response: Record<string, unknown>): AvaSuggestion[] {
  const suggestedActions = response.suggestedActions as AvaAction[] | undefined;
  if (suggestedActions && Array.isArray(suggestedActions)) {
    return suggestedActions.map((action) => ({
      id: generateId(),
      type: action.type === 'navigate' ? 'navigation' : 'action',
      text: action.label,
      confidence: action.type === 'navigate' ? 0.8 : 0.9,
      metadata: { action },
    }));
  }

  const suggestions = response.suggestions as AvaSuggestion[] | undefined;
  if (suggestions && Array.isArray(suggestions)) {
    return suggestions;
  }

  return [];
}

function normalizeSources(response: Record<string, unknown>): AvaSource[] {
  const sources = response.sources as AvaSource[] | undefined;
  if (!sources || !Array.isArray(sources)) {
    return [];
  }
  return sources.map((source) => ({
    type: source.type,
    id: source.id,
    title: source.title,
    relevance: source.relevance,
  }));
}

function normalizeCards(response: Record<string, unknown>): AvaCard[] {
  const cards = response.cards as AvaCard[] | undefined;
  if (!cards || !Array.isArray(cards)) {
    return [];
  }
  return cards.map((card) => ({
    code: card.code,
    name: card.name,
    description: card.description ?? null,
    layout: card.layout || {},
    actionBindings: card.actionBindings || {},
  }));
}

export default useAva;
