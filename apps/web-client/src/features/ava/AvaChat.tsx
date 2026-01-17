/**
 * AvaChat - Main AVA Chat Component
 * HubbleWave Platform - Phase 6
 *
 * Reusable chat component for AVA interactions.
 * Features streaming responses, suggestions, and feedback.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Zap,
  HelpCircle,
  MessageSquare,
  Settings,
  Lightbulb,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassButton } from '../../components/ui/glass/GlassButton';
import { GlassAvatar } from '../../components/ui/glass/GlassAvatar';
import { GlassModal } from '../../components/ui/glass/GlassModal';
import { useAva, AvaMessage, AvaSuggestion, AvaContext, AvaAction, AvaSource, AvaCard } from './useAva';

/**
 * Safely render markdown-like text
 */
const SafeMarkdownText: React.FC<{ content: string }> = ({ content }) => {
  const rendered = useMemo(() => {
    if (!content) return null;
    const lines = content.split('\n');

    return lines.map((line, lineIndex) => {
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let partIndex = 0;

      // Match **bold** patterns
      const boldRegex = /\*\*(.*?)\*\*/g;
      let match;

      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(
            <span key={`text-${lineIndex}-${partIndex++}`}>
              {line.slice(lastIndex, match.index)}
            </span>
          );
        }
        parts.push(
          <strong key={`bold-${lineIndex}-${partIndex++}`}>{match[1]}</strong>
        );
        lastIndex = boldRegex.lastIndex;
      }

      if (lastIndex < line.length) {
        parts.push(
          <span key={`text-${lineIndex}-${partIndex++}`}>
            {line.slice(lastIndex)}
          </span>
        );
      }

      if (parts.length === 0) {
        parts.push(<span key={`line-${lineIndex}`}>{line}</span>);
      }

      return (
        <React.Fragment key={`line-${lineIndex}`}>
          {parts}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  }, [content]);

  return <>{rendered}</>;
};

const quickActions = [
  { id: 'help', label: 'How can you help me?', icon: HelpCircle },
  { id: 'workorder', label: 'Create a work order', icon: Zap },
  { id: 'search', label: 'Search for assets', icon: MessageSquare },
  { id: 'report', label: 'Generate a report', icon: Settings },
];

export interface AvaChatProps {
  /** Custom CSS classes */
  className?: string;
  /** Context for AVA */
  context?: AvaContext;
  /** Full page mode (vs embedded) */
  fullPage?: boolean;
  /** Callback when suggestion is applied */
  onSuggestionApply?: (suggestion: AvaSuggestion) => void;
  /** Show the header */
  showHeader?: boolean;
  /** Placeholder text for input */
  placeholder?: string;
}

type AvaPreviewResult = {
  previewId: string;
  requiresApproval: boolean;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changes?: Array<{ field: string; before: unknown; after: unknown }>;
};

export const AvaChat: React.FC<AvaChatProps> = ({
  className,
  context,
  fullPage = false,
  onSuggestionApply,
  showHeader = true,
  placeholder = 'Ask AVA anything...',
}) => {
  const navigate = useNavigate();
  const {
    messages,
    isLoading,
    suggestions,
    conversationId,
    sendMessage,
    clearConversation,
    retryLastMessage,
    provideFeedback,
    applySuggestion,
    dismissSuggestion,
  } = useAva({ context, onSuggestion: onSuggestionApply });

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'positive' | 'negative'>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAction, setPreviewAction] = useState<AvaAction | null>(null);
  const [previewResult, setPreviewResult] = useState<AvaPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Track scroll for scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom && messages.length > 2);
  }, [messages.length]);

  // Handle quick action
  const handleQuickAction = (action: (typeof quickActions)[0]) => {
    sendMessage(action.label);
  };

  // Copy message
  const copyMessage = (message: AvaMessage) => {
    navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle feedback
  const handleFeedback = async (message: AvaMessage, type: 'positive' | 'negative') => {
    await provideFeedback(message.id, type);
    setFeedbackGiven((prev) => ({ ...prev, [message.id]: type }));
  };

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
      setInput('');
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: AvaSuggestion) => {
    const action = suggestion.metadata?.action as AvaAction | undefined;
    if (action) {
      handleActionSuggestion(action);
      dismissSuggestion(suggestion.id);
      return;
    }

    applySuggestion(suggestion);
    if (onSuggestionApply) {
      onSuggestionApply(suggestion);
    }
    if (suggestion.type === 'query' || suggestion.type === 'correction') {
      sendMessage(suggestion.text);
    }
  };

  const handleActionSuggestion = async (action: AvaAction) => {
    setPreviewError(null);

    if (action.type === 'navigate') {
      await executeAction(action, undefined, true);
      return;
    }

    setPreviewAction(action);
    setPreviewOpen(true);
    setIsPreviewLoading(true);
    setPreviewResult(null);

    try {
      const { lastUserMessage, lastAssistantMessage } = getConversationContext(messages);
      const response = await fetch('/api/ava/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userMessage: lastUserMessage,
          avaResponse: lastAssistantMessage,
          conversationId,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        const errorMessage =
          typeof errorPayload?.message === 'string'
            ? errorPayload.message
            : `Preview failed (${response.status})`;
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as AvaPreviewResult;
      setPreviewResult(data);
    } catch (err) {
      setPreviewError((err as Error).message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (isExecuting) return;
    setPreviewOpen(false);
    setPreviewAction(null);
    setPreviewResult(null);
    setPreviewError(null);
  };

  const executeAction = async (
    action: AvaAction,
    previewId?: string,
    approved?: boolean,
  ) => {
    setIsExecuting(true);
    setPreviewError(null);
    try {
      const response = await fetch('/api/ava/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          previewId,
          approved,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        const errorMessage =
          typeof errorPayload?.message === 'string'
            ? errorPayload.message
            : `Execution failed (${response.status})`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result?.redirectUrl) {
        navigate(result.redirectUrl);
      } else if (action.type === 'navigate') {
        navigate(action.target);
      }

      if (previewOpen) {
        closePreview();
      }
    } catch (err) {
      setPreviewError((err as Error).message);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col',
        fullPage ? 'h-full' : 'h-[500px]',
        'bg-card',
        'rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary/80">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                AVA
              </h2>
              <p className="text-xs text-muted-foreground">
                Your AI Assistant
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={clearConversation}
              aria-label="Clear conversation"
            >
              Clear
            </GlassButton>
          )}
        </div>
      )}

      {/* Context banner */}
      {context?.page && (
        <div className="px-4 py-2 text-xs flex items-center gap-2 bg-muted text-muted-foreground">
          <Zap className="h-3 w-3" />
          <span>
            Context: <strong className="text-muted-foreground">{context.page}</strong>
            {context.selectedRecords && context.selectedRecords.length > 0 && (
              <> ({context.selectedRecords.length} selected)</>
            )}
          </span>
        </div>
      )}

      {/* Active Suggestions */}
      {suggestions.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto bg-warning-subtle">
          <Lightbulb className="h-4 w-4 flex-shrink-0 text-warning-text" />
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
                'border border-border text-muted-foreground',
                'hover:border-primary hover:bg-primary/10',
                'transition-colors'
              )}
            >
              {suggestion.text}
            </button>
          ))}
          <button
            onClick={() => suggestions.forEach((s) => dismissSuggestion(s.id))}
            className="p-1 rounded text-muted-foreground hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4"
        onScroll={handleScroll}
        role="log"
        aria-label="Chat messages with AVA"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              Hi! I'm AVA
            </h3>
            <p className="text-sm mb-6 text-muted-foreground">
              Your AI-powered assistant. I can help you navigate the platform,
              create records, run reports, and answer questions.
            </p>

            <div className="w-full space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Try asking:
              </p>
              <div className="grid gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-left',
                      'transition-colors',
                      'border border-border',
                      'hover:border-primary hover:bg-primary/10'
                    )}
                  >
                    <action.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {/* Avatar */}
                {message.role === 'assistant' ? (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary to-primary/80">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                ) : (
                  <GlassAvatar size="sm" fallback="You" />
                )}

                {/* Message Content */}
                <div
                  className={cn(
                    'max-w-[80%] group',
                    message.role === 'user' ? 'text-right' : 'text-left'
                  )}
                >
                  <div
                    className={cn(
                      'inline-block px-4 py-2.5 rounded-2xl text-sm',
                      message.role === 'user' ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-muted text-foreground',
                      message.error && 'border border-destructive'
                    )}
                  >
                    <div className="whitespace-pre-wrap">
                      <SafeMarkdownText content={message.content} />
                    </div>
                    {message.isStreaming && (
                      <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-pulse" />
                    )}
                  </div>

                  {/* Message Actions */}
                  {message.role === 'assistant' && !message.isStreaming && (
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyMessage(message)}
                        className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                        aria-label="Copy message"
                      >
                        {copiedId === message.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={retryLastMessage}
                        className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                        aria-label="Regenerate response"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <div className="w-px h-3 mx-1 bg-border" />
                      <button
                        onClick={() => handleFeedback(message, 'positive')}
                        className={cn(
                          'p-1 rounded hover:bg-muted transition-colors',
                          feedbackGiven[message.id] === 'positive' ? 'text-success-text' : 'text-muted-foreground'
                        )}
                        aria-label="Helpful"
                        disabled={!!feedbackGiven[message.id]}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(message, 'negative')}
                        className={cn(
                          'p-1 rounded hover:bg-muted transition-colors',
                          feedbackGiven[message.id] === 'negative' ? 'text-danger-text' : 'text-muted-foreground'
                        )}
                        aria-label="Not helpful"
                        disabled={!!feedbackGiven[message.id]}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Intent Badge */}
                  {message.intent && (
                    <p className="text-[10px] mt-1 text-muted-foreground">
                      Intent: {message.intent}
                    </p>
                  )}

                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Sources
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {message.sources.map((source) => (
                          <button
                            key={`${source.type}-${source.id}`}
                            onClick={() => {
                              const url = buildSourceUrl(source);
                              if (url) {
                                navigate(url);
                              }
                            }}
                            className={cn(
                              'px-2 py-1 rounded-full text-[11px]',
                              'border border-border bg-muted/40 text-muted-foreground',
                              'hover:border-primary hover:text-foreground hover:bg-primary/10',
                              'transition-colors'
                            )}
                          >
                            {source.title || `${source.type}/${source.id}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.cards && message.cards.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {message.cards.map((card) => (
                        <div
                          key={card.code}
                          className="rounded-xl border border-border bg-muted/30 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {getCardTitle(card)}
                              </p>
                              {getCardSubtitle(card) && (
                                <p className="text-xs text-muted-foreground">
                                  {getCardSubtitle(card)}
                                </p>
                              )}
                            </div>
                          </div>

                          {getCardSummary(card) && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {getCardSummary(card)}
                            </p>
                          )}

                          {getCardFields(card).length > 0 && (
                            <div className="mt-3 grid gap-2">
                              {getCardFields(card).map((field) => (
                                <div
                                  key={`${card.code}-${field.label}`}
                                  className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-3 py-2"
                                >
                                  <span className="text-xs text-muted-foreground">
                                    {field.label}
                                  </span>
                                  <span className="text-xs font-semibold text-foreground">
                                    {formatPreviewValue(field.value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {getCardActions(card).length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {getCardActions(card).map((action) => (
                                <GlassButton
                                  key={`${card.code}-${action.type}-${action.target}`}
                                  size="sm"
                                  variant={action.type === 'navigate' ? 'ghost' : 'solid'}
                                  onClick={() => handleActionSuggestion(action)}
                                >
                                  {action.label}
                                </GlassButton>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-[10px] mt-1 opacity-60 text-muted-foreground">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-4 p-2 rounded-full shadow-lg transition-all z-10 bg-card border border-border text-muted-foreground hover:bg-muted"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border">
        <div className="flex items-end gap-2 p-2 rounded-xl bg-muted border border-border">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Message to AVA"
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm py-2 px-2 max-h-32 text-foreground placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <div className="flex items-center gap-1 pb-1">
            <GlassButton
              variant="solid"
              size="sm"
              iconOnly
              onClick={() => {
                sendMessage(input);
                setInput('');
              }}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </GlassButton>
          </div>
        </div>
        <p className="text-[10px] text-center mt-2 text-muted-foreground">
          Press <kbd className="kbd text-[9px]">Enter</kbd> to send
        </p>
      </div>

      <GlassModal
        open={previewOpen}
        onClose={closePreview}
        title={previewAction ? `Preview: ${previewAction.label}` : 'Preview'}
        description={
          previewAction
            ? `Review the changes before ${previewAction.type} on ${previewAction.target}.`
            : undefined
        }
        size="lg"
        footer={
          previewAction && (
            <>
              <GlassButton
                variant="ghost"
                onClick={closePreview}
                disabled={isExecuting}
              >
                Cancel
              </GlassButton>
              <GlassButton
                variant="solid"
                onClick={() =>
                  previewAction &&
                  executeAction(previewAction, previewResult?.previewId, true)
                }
                loading={isExecuting}
                disabled={isPreviewLoading || !previewResult}
              >
                {previewResult?.requiresApproval ? 'Approve & Execute' : 'Execute'}
              </GlassButton>
            </>
          )
        }
      >
        {previewError && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {previewError}
          </div>
        )}
        {isPreviewLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing preview...
          </div>
        )}
        {!isPreviewLoading && previewResult && (
          <div className="space-y-4 text-sm text-muted-foreground">
            {previewResult.changes && previewResult.changes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Changes</p>
                <div className="space-y-2">
                  {previewResult.changes.map((change) => (
                    <div
                      key={change.field}
                      className="rounded-lg border border-border bg-muted/40 px-3 py-2"
                    >
                      <div className="text-xs font-semibold text-foreground">
                        {change.field}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Before: {formatPreviewValue(change.before)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        After: {formatPreviewValue(change.after)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p>No field changes detected for this action.</p>
            )}
          </div>
        )}
      </GlassModal>
    </div>
  );
};

function getConversationContext(messages: AvaMessage[]) {
  const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user')?.content;
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((msg) => msg.role === 'assistant' && !msg.error)?.content;

  return { lastUserMessage, lastAssistantMessage };
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unavailable]';
  }
}

function buildSourceUrl(source: AvaSource): string | null {
  switch (source.type) {
    case 'knowledge_article':
      return `/knowledge/${source.id}`;
    case 'catalog_item':
      return `/catalog/${source.id}`;
    case 'user':
      return `/admin/users/${source.id}`;
    case 'collection':
      return `/admin/collections/${source.id}`;
    default:
      if (source.id.includes(':')) {
        const [collection, id] = source.id.split(':');
        return `/data/${collection}/${id}`;
      }
      return `/data/${source.id}`;
  }
}

type AvaCardField = { label: string; value: unknown };

function getCardTitle(card: AvaCard): string {
  const layout = card.layout || {};
  const title = typeof layout['title'] === 'string' ? layout['title'] : null;
  return title || card.name;
}

function getCardSubtitle(card: AvaCard): string | null {
  const layout = card.layout || {};
  const subtitle = typeof layout['subtitle'] === 'string' ? layout['subtitle'] : null;
  return subtitle || (card.description ?? null);
}

function getCardSummary(card: AvaCard): string | null {
  const layout = card.layout || {};
  const summary = typeof layout['summary'] === 'string' ? layout['summary'] : null;
  return summary || null;
}

function getCardFields(card: AvaCard): AvaCardField[] {
  const layout = card.layout || {};
  const fields = normalizeFields(layout['fields']);
  if (fields.length > 0) {
    return fields;
  }
  const sections = Array.isArray(layout['sections']) ? layout['sections'] : [];
  const sectionFields = sections.flatMap((section) => normalizeFields(section?.['fields']));
  return sectionFields;
}

function normalizeFields(fieldsValue: unknown): AvaCardField[] {
  if (!Array.isArray(fieldsValue)) {
    return [];
  }
  return fieldsValue
    .map((field) => {
      if (!field || typeof field !== 'object') {
        return null;
      }
      const label = typeof (field as Record<string, unknown>)['label'] === 'string'
        ? ((field as Record<string, unknown>)['label'] as string)
        : null;
      const value = (field as Record<string, unknown>)['value'];
      if (!label) {
        return null;
      }
      return { label, value };
    })
    .filter((field): field is AvaCardField => field !== null);
}

function getCardActions(card: AvaCard): AvaAction[] {
  const actions: AvaAction[] = [];
  const bindings = card.actionBindings || {};

  const direct = bindings['actions'];
  if (Array.isArray(direct)) {
    direct.forEach((item) => {
      if (isAvaAction(item)) {
        actions.push(item);
      }
    });
  }

  const primary = bindings['primary'];
  if (isAvaAction(primary)) {
    actions.push(primary);
  }

  const secondary = bindings['secondary'];
  if (Array.isArray(secondary)) {
    secondary.forEach((item) => {
      if (isAvaAction(item)) {
        actions.push(item);
      }
    });
  }

  return actions;
}

function isAvaAction(value: unknown): value is AvaAction {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  const type = record['type'];
  const label = record['label'];
  const target = record['target'];
  if (typeof type !== 'string' || typeof label !== 'string' || typeof target !== 'string') {
    return false;
  }
  return ['navigate', 'create', 'update', 'execute'].includes(type);
}

export default AvaChat;
