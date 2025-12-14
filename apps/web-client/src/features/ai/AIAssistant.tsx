import { useState, useRef, useEffect, FormEvent } from 'react';
import {
  Send,
  X,
  Maximize2,
  Minimize2,
  Loader2,
  FileText,
  ExternalLink,
  RefreshCw,
  MessageCircle,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// AVA Branding
const AVA_BRANDING = {
  name: 'AVA',
  fullName: 'AI Virtual Assistant',
  tagline: 'Your intelligent HubbleWave assistant',
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#ec4899',
  },
};

interface MessageAction {
  type: 'navigate' | 'create' | 'update' | 'execute';
  label: string;
  target: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    type: string;
    id: string;
    title?: string;
    relevance: number;
  }>;
  actions?: MessageAction[];
  timestamp: Date;
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleSize?: () => void;
  isExpanded?: boolean;
  className?: string;
}

// AVA Avatar Component
function AVAAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div
      className={cn(
        sizeClasses[size],
        'rounded-xl flex items-center justify-center',
        'bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500',
        'shadow-lg shadow-indigo-500/25'
      )}
    >
      <span className="text-white font-bold text-xs">
        {size === 'lg' ? 'AVA' : 'A'}
      </span>
    </div>
  );
}

export function AIAssistant({
  isOpen,
  onClose,
  onToggleSize,
  isExpanded = false,
  className,
}: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    try {
      // Use AVA streaming endpoint
      const response = await fetch('/api/ai/ava/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let sources: Message['sources'] = [];
      let actions: Message['actions'] = [];
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.startsWith('data:'));

        for (const line of lines) {
          const data = line.replace('data: ', '').trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            if (event.type === 'conversationId') {
              setConversationId(event.data);
            } else if (event.type === 'sources') {
              sources = event.data;
            } else if (event.type === 'actions') {
              actions = event.data;
            } else if (event.type === 'chunk') {
              fullContent += event.data;
              setStreamingContent(fullContent);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullContent,
        sources,
        actions,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          "I apologize, but I'm having trouble connecting right now. Please try again in a moment, or check if the AI service is available.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleActionClick = (action: MessageAction) => {
    if (action.type === 'navigate') {
      window.location.href = action.target;
    }
    // Other action types would be handled here
  };

  const clearChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col',
        'bg-white dark:bg-slate-900 rounded-2xl shadow-2xl',
        'border border-slate-200 dark:border-slate-700',
        isExpanded
          ? 'inset-4 md:inset-8'
          : 'bottom-4 right-4 w-[420px] h-[600px] md:bottom-6 md:right-6',
        className
      )}
    >
      {/* Header with AVA Branding */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-pink-500/5">
        <div className="flex items-center gap-3">
          <AVAAvatar size="md" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {AVA_BRANDING.name}
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-full font-medium">
                AI
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {AVA_BRANDING.tagline}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            title="New conversation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onToggleSize && (
            <button
              onClick={onToggleSize}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <AVAAvatar size="lg" />
            <h4 className="font-semibold text-slate-900 dark:text-white mt-4">
              Hi! I'm {AVA_BRANDING.name}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {AVA_BRANDING.fullName} - here to help you navigate HubbleWave.
            </p>
            <div className="mt-6 space-y-2 w-full max-w-xs">
              <button
                onClick={() => setInput('Show me my open incidents')}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-indigo-500" />
                Show me my open incidents
                <ChevronRight className="w-4 h-4 ml-auto text-slate-400" />
              </button>
              <button
                onClick={() => setInput('How do I submit a service request?')}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <Zap className="w-4 h-4 text-violet-500" />
                How do I submit a service request?
                <ChevronRight className="w-4 h-4 ml-auto text-slate-400" />
              </button>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && <AVAAvatar size="sm" />}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5',
                message.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
              )}
            >
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>

              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Sources:
                  </p>
                  <div className="space-y-1">
                    {message.sources.map((source, index) => (
                      <a
                        key={index}
                        href={`/${source.type.replace('_', '-')}/${source.id}`}
                        className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <FileText className="w-3 h-3" />
                        {source.title || source.id}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Actions */}
              {message.actions && message.actions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Quick Actions:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {message.actions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleActionClick(action)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                      >
                        {action.label}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {streamingContent && (
          <div className="flex gap-3 justify-start">
            <AVAAvatar size="sm" />
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
              <p className="whitespace-pre-wrap text-sm">{streamingContent}</p>
              <span className="inline-block w-2 h-4 bg-gradient-to-r from-indigo-500 to-violet-500 animate-pulse rounded-sm ml-1" />
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingContent && (
          <div className="flex gap-3 justify-start">
            <AVAAvatar size="sm" />
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AVA anything..."
            className={cn(
              'flex-1 resize-none rounded-xl px-4 py-2.5',
              'bg-slate-100 dark:bg-slate-800',
              'border border-transparent focus:border-indigo-500',
              'text-slate-900 dark:text-white placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
              'min-h-[44px] max-h-[120px] text-sm'
            )}
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex-shrink-0 w-11 h-11 rounded-xl',
              'bg-gradient-to-r from-indigo-600 to-violet-600 text-white',
              'flex items-center justify-center',
              'hover:from-indigo-700 hover:to-violet-700',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all shadow-lg shadow-indigo-500/25'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-2">
          Powered by {AVA_BRANDING.fullName}
        </p>
      </form>
    </div>
  );
}
