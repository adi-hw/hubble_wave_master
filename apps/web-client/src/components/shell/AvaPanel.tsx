/**
 * AvaPanel - AVA Chat Panel (⌘J)
 *
 * A slide-in panel for conversing with AVA, the AI assistant.
 * Features:
 * - Streaming message responses
 * - Context awareness (current page, selected records)
 * - Quick action chips
 * - Voice input (future)
 * - Markdown rendering
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  X,
  Send,
  Sparkles,
  Mic,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ChevronDown,
  Zap,
  MessageSquare,
  HelpCircle,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassButton } from '../ui/glass/GlassButton';
import { GlassAvatar } from '../ui/glass/GlassAvatar';
import { avaService } from '../../services/ava.service';

export interface AvaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: boolean;
}

interface AvaPanelProps {
  open: boolean;
  onClose: () => void;
  /** Optional context from the current page */
  context?: {
    page?: string;
    recordType?: string;
    recordId?: string;
    selectedCount?: number;
  };
}

// Quick action suggestions
const quickActions = [
  { id: 'help', label: 'How can you help me?', icon: HelpCircle },
  { id: 'workorder', label: 'Create a work order', icon: Zap },
  { id: 'search', label: 'Search for assets', icon: MessageSquare },
  { id: 'report', label: 'Generate a report', icon: Settings },
];

export const AvaPanel: React.FC<AvaPanelProps> = ({ open, onClose, context }) => {
  // useLocation available for future context-aware features
  const _location = useLocation();
  void _location; // Suppress unused warning
  const [messages, setMessages] = useState<AvaMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Track scroll position for scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom && messages.length > 2);
  }, [messages.length]);

  // Simulate sending a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: AvaMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      setIsOffline(false);

      const assistantMessage: AvaMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const data = await avaService.sendMessage({
          message: content.trim(),
          context,
        });
        const reply = (data?.message || '').trim();

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  isStreaming: false,
                  content:
                    reply ||
                    "I'm here, but I couldn't get a full response right now. Try again in a moment.",
                }
              : msg
          )
        );
      } catch (err) {
        console.error('AVA send failed', err);
        setIsOffline(true);
        // Fallback demo response
        const responses = [
          "I'm having trouble reaching AVA right now. ",
          'Here are offline tips:\n\n',
          '1. Check your network connection\n',
          '2. Try refreshing the page\n',
          '3. Use the command palette (⌘/Ctrl + K) to navigate manually\n',
        ];
        let fullContent = '';
        for (const chunk of responses) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id ? { ...msg, content: fullContent } : msg
            )
          );
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [context, isLoading]
  );

  // Handle quick action click
  const handleQuickAction = (action: (typeof quickActions)[0]) => {
    sendMessage(action.label);
  };

  // Copy message to clipboard
  const copyMessage = (message: AvaMessage) => {
    navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle textarea key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Clear conversation
  const clearConversation = () => {
    setMessages([]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          backgroundColor: 'var(--bg-overlay)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'absolute inset-y-0 right-0 w-full max-w-md flex flex-col',
          'bg-[var(--bg-surface)]',
          'border-l border-[var(--border-default)]',
          'shadow-2xl',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--gradient-brand)' }}
            >
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                AVA
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Your AI Assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <GlassButton
                variant="ghost"
                size="sm"
                iconOnly
                onClick={clearConversation}
                aria-label="Clear conversation"
              >
                <Trash2 className="h-4 w-4" />
              </GlassButton>
            )}
            <GlassButton
              variant="ghost"
              size="sm"
              iconOnly
              onClick={onClose}
              aria-label="Close AVA panel"
            >
              <X className="h-4 w-4" />
            </GlassButton>
          </div>
        </div>

        {/* Context / status Banner */}
        {isOffline && (
          <div
            className="px-4 py-2 text-xs flex items-center gap-2"
            style={{
              backgroundColor: 'var(--bg-danger-subtle)',
              color: 'var(--text-danger)',
            }}
          >
            <AlertCircle className="h-3 w-3" />
            <span>AVA is temporarily offline. Responses are using offline guidance.</span>
          </div>
        )}

        {context?.page && (
          <div
            className="px-4 py-2 text-xs flex items-center gap-2"
            style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              color: 'var(--text-muted)',
            }}
          >
            <Zap className="h-3 w-3" />
            <span>
              Context: <strong style={{ color: 'var(--text-secondary)' }}>{context.page}</strong>
              {context.selectedCount && context.selectedCount > 0 && (
                <> ({context.selectedCount} selected)</>
              )}
            </span>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'var(--gradient-brand-subtle)' }}
              >
                <Sparkles className="h-8 w-8" style={{ color: 'var(--text-brand)' }} />
              </div>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                Hi! I'm AVA
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Your AI-powered assistant. I can help you navigate the platform,
                create records, run reports, and answer questions.
              </p>

              {/* Quick Actions */}
              <div className="w-full space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
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
                        'border border-[var(--border-default)]',
                        'hover:border-[var(--border-primary)] hover:bg-[var(--bg-primary-subtle)]'
                      )}
                    >
                      <action.icon className="h-4 w-4" style={{ color: 'var(--text-brand)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--gradient-brand)' }}
                    >
                      <Sparkles className="h-4 w-4 text-white" />
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
                        message.role === 'user'
                          ? 'rounded-tr-sm'
                          : 'rounded-tl-sm'
                      )}
                      style={{
                        backgroundColor:
                          message.role === 'user'
                            ? 'var(--bg-primary)'
                            : 'var(--bg-surface-secondary)',
                        color:
                          message.role === 'user'
                            ? 'white'
                            : 'var(--text-primary)',
                      }}
                    >
                      {/* Render markdown-like content */}
                      <div
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: message.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\n/g, '<br />'),
                        }}
                      />
                      {message.isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-pulse" />
                      )}
                    </div>

                    {/* Message Actions */}
                    {message.role === 'assistant' && !message.isStreaming && (
                      <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyMessage(message)}
                          className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          aria-label="Copy message"
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => sendMessage(message.content)}
                          className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          aria-label="Regenerate response"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Timestamp */}
                    <p
                      className="text-[10px] mt-1 opacity-60"
                      style={{ color: 'var(--text-muted)' }}
                    >
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
            className="absolute bottom-24 right-4 p-2 rounded-full shadow-lg transition-all"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-muted)',
            }}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}

        {/* Input Area */}
        <div
          className="flex-shrink-0 px-4 py-3"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <div
            className="flex items-end gap-2 p-2 rounded-xl"
            style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              border: '1px solid var(--border-default)',
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AVA anything..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm py-2 px-2 max-h-32"
              style={{
                color: 'var(--text-primary)',
              }}
              disabled={isLoading}
            />
            <div className="flex items-center gap-1 pb-1">
              <GlassButton
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Voice input"
                disabled
              >
                <Mic className="h-4 w-4" />
              </GlassButton>
              <GlassButton
                variant="solid"
                size="sm"
                iconOnly
                onClick={() => sendMessage(input)}
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
          <p
            className="text-[10px] text-center mt-2"
            style={{ color: 'var(--text-muted)' }}
          >
            Press <kbd className="kbd text-[9px]">⌘J</kbd> to toggle • <kbd className="kbd text-[9px]">Enter</kbd> to send
          </p>
        </div>
      </div>
    </div>
  );
};

export default AvaPanel;
