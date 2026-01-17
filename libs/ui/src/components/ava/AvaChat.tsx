import React, { useRef, useEffect, useMemo, useState } from 'react';
import { 
  Send, 
  Sparkles, 
  Mic, 
  Loader2, 
  Copy, 
  Check, 
  RefreshCw, 
  User, 
  ChevronDown 
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
export interface AvaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: boolean;
}

export interface QuickAction {
  id: string;
  label: string;
  icon?: React.ElementType;
}

export interface AvaChatProps {
  messages: AvaMessage[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  isOffline?: boolean;
  userDisplayName?: string;
  quickActions?: QuickAction[];
  onQuickAction?: (action: QuickAction) => void;
  onClearConversation?: () => void;
}

// --- Internal Components ---

const SafeMarkdownText: React.FC<{ content: string }> = ({ content }) => {
  const rendered = useMemo(() => {
    if (!content) return null;
    const lines = content.split('\n');
    return lines.map((line, lineIndex) => {
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let partIndex = 0;
      const boldRegex = /\*\*(.*?)\*\*/g;
      let match;

      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(<span key={`text-${lineIndex}-${partIndex++}`}>{line.slice(lastIndex, match.index)}</span>);
        }
        parts.push(<strong key={`bold-${lineIndex}-${partIndex++}`}>{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }

      if (lastIndex < line.length) {
        parts.push(<span key={`text-${lineIndex}-${partIndex++}`}>{line.slice(lastIndex)}</span>);
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

// --- Main Component ---

export const AvaChat: React.FC<AvaChatProps> = ({
  messages,
  onSendMessage,
  isLoading = false,
  isOffline = false,
  userDisplayName = 'User',
  quickActions = [],
  onQuickAction,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom && messages.length > 2);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  const copyMessage = (message: AvaMessage) => {
    navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl">
      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-primary/10 ring-1 ring-primary/20 shadow-[0_0_30px_-5px_rgba(var(--primary-rgb),0.3)]">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-foreground tracking-tight">
              Hi! I'm AVA
            </h3>
            <p className="text-sm mb-8 text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Your AI-powered assistant. I can help you navigate, analyze data, and automate tasks.
            </p>

            {/* Quick Actions */}
            {quickActions.length > 0 && (
              <div className="w-full max-w-sm space-y-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 text-center">
                  Try asking
                </p>
                <div className="grid gap-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => onQuickAction?.(action)}
                      className={cn(
                        'group flex items-center gap-3 px-4 py-3 rounded-xl text-left',
                        'transition-all duration-200',
                        'border border-border/50 bg-muted/30',
                        'hover:border-primary/50 hover:bg-primary/5 hover:shadow-md'
                      )}
                    >
                      {action.icon ? (
                        <action.icon className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
                      )}
                      <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3 animate-in slide-in-from-bottom-2 duration-300',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {/* Avatar */}
                {message.role === 'assistant' ? (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 shadow-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                ) : (
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-muted border border-border"
                    aria-label={userDisplayName}
                    title={userDisplayName}
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                {/* Message Content */}
                <div
                  className={cn(
                    'max-w-[85%] relative group',
                    message.role === 'user' ? 'text-right' : 'text-left'
                  )}
                >
                  <div
                    className={cn(
                      'inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm',
                      message.role === 'user'
                        ? 'rounded-tr-sm bg-primary text-primary-foreground'
                        : 'rounded-tl-sm bg-muted/80 backdrop-blur-sm border border-border/50 text-foreground'
                    )}
                  >
                    <div className="whitespace-pre-wrap">
                      <SafeMarkdownText content={message.content} />
                    </div>
                    {message.isStreaming && (
                      <span className="inline-flex gap-0.5 ml-2 items-center">
                        <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1 h-1 rounded-full bg-current animate-bounce" />
                      </span>
                    )}
                  </div>

                  {/* Message Actions */}
                  {message.role === 'assistant' && !message.isStreaming && (
                    <div className="flex items-center gap-1 mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyMessage(message)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Copy"
                      >
                        {copiedId === message.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() => onSendMessage(message.content)} 
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Regenerate"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  
                  {/* Timestamp */}
                   <p className="text-[10px] mt-1 opacity-40 text-muted-foreground font-medium px-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Scroll Button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 p-2 rounded-full shadow-lg bg-background border border-border text-foreground hover:bg-muted transition-all z-10 animate-in fade-in zoom-in"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-border/40 bg-card/30 backdrop-blur-md">
        <div className={cn(
          "flex items-end gap-2 p-2 rounded-xl border transition-all duration-200",
          "bg-background/50 focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/30",
          "border-border/60 focus-within:border-primary/50"
        )}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm py-2 px-2 max-h-32 text-foreground placeholder:text-muted-foreground/60"
            disabled={isLoading || isOffline}
          />
          <div className="flex items-center gap-1 pb-1">
             <button
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              disabled
              title="Voice Input (Coming Soon)"
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isOffline}
              className={cn(
                "p-2 rounded-lg transition-all duration-200",
                input.trim() && !isLoading 
                  ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:scale-105" 
                  : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        {isOffline ? (
           <p className="text-[10px] text-center mt-2 text-destructive font-medium flex items-center justify-center gap-1">
             <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
             Offline Mode
           </p>
        ) : (
          <p className="text-[10px] text-center mt-2 text-muted-foreground/60 font-medium">
             AI can make mistakes. Verify important info.
          </p>
        )}
      </div>
    </div>
  );
};
