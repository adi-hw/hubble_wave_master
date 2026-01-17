import { useEffect, useMemo, useState, useCallback, useRef, FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { useThemePreferenceContext } from '../contexts/ThemePreferenceContext';
import { ThemeDefinition } from '../services/ui.service';
import { getStoredToken } from '../services/token';
import {
  Palette,
  Droplet,
  Type,
  Box,
  SlidersHorizontal,
  Sparkles,
  Check,
  Download,
  Upload,
  RotateCcw,
  Eye,
  X,
  ChevronRight,
  Layers,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Send,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ThemeConfig {
  colors?: Record<string, string>;
  glass?: Record<string, string>;
  typography?: Record<string, string>;
  spacing?: Record<string, string>;
}

// ============================================================================
// UTILITIES
// ============================================================================

function isValidColor(value: string): boolean {
  if (!value) return false;
  // Check hex
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return true;
  // Check rgba/rgb
  if (/^rgba?\(/.test(value)) return true;
  return false;
}

function getColorForPicker(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  // For rgba values, return a placeholder
  return '#888888';
}

function setNestedValue(obj: any, path: string, value: any): any {
  const result = JSON.parse(JSON.stringify(obj || {}));
  const keys = path.split('.');
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

// ============================================================================
// SECTION CONFIGURATION
// ============================================================================

const sections = [
  { id: 'presets', label: 'Presets', icon: Palette },
  { id: 'colors', label: 'Colors', icon: Droplet },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'glass', label: 'Glass', icon: Box },
  { id: 'spacing', label: 'Spacing', icon: SlidersHorizontal },
];

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const defaults = {
  colors: {
    voidPure: '#000000',
    voidDeep: '#030308',
    voidSpace: '#08080f',
    voidSurface: '#0f0f18',
    voidElevated: '#161622',
    voidOverlay: '#1e1e2e',
    primary400: '#818cf8',
    primary500: '#6366f1',
    primary600: '#4f46e5',
    accent400: '#22d3ee',
    accent500: '#06b6d4',
    accent600: '#0891b2',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  },
  glass: {
    background: 'rgba(255,255,255,0.03)',
    backgroundHover: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.08)',
    borderHover: 'rgba(255,255,255,0.15)',
    blur: '20',
  },
  typography: {
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    textMuted: '#475569',
  },
  spacing: {
    radiusSm: '6',
    radiusMd: '10',
    radiusLg: '16',
    radiusXl: '24',
  },
};

// ============================================================================
// COLOR PICKER COMPONENT
// ============================================================================

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const pickerValue = getColorForPicker(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="w-8 h-8 rounded-lg shrink-0 cursor-pointer relative overflow-hidden"
        style={{ background: value, border: '2px solid var(--glass-border)' }}
      >
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {label}
        </div>
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          if (isValidColor(e.target.value)) {
            onChange(e.target.value);
          }
        }}
        className="w-24 px-2 py-1 text-xs font-mono rounded"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-secondary)',
        }}
      />
    </div>
  );
}

// ============================================================================
// SLIDER COMPONENT
// ============================================================================

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}

function Slider({ label, value, onChange, min = 0, max = 32, unit = 'px' }: SliderProps) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </span>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded"
          style={{ background: 'var(--glass-bg)', color: 'var(--color-primary-400)' }}
        >
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-track"
      />
    </div>
  );
}

// ============================================================================
// THEME CARD COMPONENT
// ============================================================================

interface ThemeCardProps {
  theme: ThemeDefinition;
  isActive: boolean;
  onSelect: () => void;
}

function ThemeCard({ theme, isActive, onSelect }: ThemeCardProps) {
  const config = theme.config as ThemeConfig;
  const colors = config?.colors || {};

  return (
    <button
      onClick={onSelect}
      className="w-full p-3 rounded-xl text-left transition-all"
      style={{
        background: isActive ? 'rgba(99,102,241,0.15)' : 'var(--glass-bg)',
        border: `2px solid ${isActive ? 'var(--color-primary-500)' : 'var(--glass-border)'}`,
      }}
    >
      <div className="flex gap-1 mb-2">
        <div className="flex-1 h-5 rounded" style={{ background: colors.voidSurface || '#0f0f18' }} />
        <div className="w-5 h-5 rounded" style={{ background: colors.primary500 || '#6366f1' }} />
        <div className="w-5 h-5 rounded" style={{ background: colors.accent500 || '#06b6d4' }} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {theme.name}
        </span>
        {isActive && <Check size={14} style={{ color: 'var(--color-success-500)' }} />}
      </div>
    </button>
  );
}

// ============================================================================
// LIVE PREVIEW COMPONENT
// ============================================================================

interface LivePreviewProps {
  config: ThemeConfig;
}

function LivePreview({ config }: LivePreviewProps) {
  const c = config.colors || {};
  const g = config.glass || {};
  const t = config.typography || {};
  const s = config.spacing || {};

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: c.voidSurface || '#0f0f18', border: `1px solid ${g.border || 'rgba(255,255,255,0.08)'}` }}
    >
      <div
        className="px-3 py-2 flex items-center gap-1.5"
        style={{ background: c.voidDeep || '#030308', borderBottom: `1px solid ${g.border || 'rgba(255,255,255,0.08)'}` }}
      >
        <div className="w-2 h-2 rounded-full" style={{ background: '#ff5f57' }} />
        <div className="w-2 h-2 rounded-full" style={{ background: '#febc2e' }} />
        <div className="w-2 h-2 rounded-full" style={{ background: '#28c840' }} />
      </div>
      <div className="p-4">
        <h4 className="text-base font-semibold mb-1" style={{ color: t.textPrimary || '#f8fafc' }}>
          Dashboard
        </h4>
        <p className="text-xs mb-3" style={{ color: t.textSecondary || '#94a3b8' }}>
          Live preview of your theme
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div
            className="p-2"
            style={{
              background: g.background || 'rgba(255,255,255,0.03)',
              borderRadius: `${s.radiusMd || 10}px`,
              border: `1px solid ${g.border || 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <div className="text-xs" style={{ color: t.textTertiary || '#64748b' }}>Users</div>
            <div className="text-lg font-bold" style={{ color: c.primary500 || '#6366f1' }}>2,847</div>
          </div>
          <div
            className="p-2"
            style={{
              background: g.background || 'rgba(255,255,255,0.03)',
              borderRadius: `${s.radiusMd || 10}px`,
              border: `1px solid ${g.border || 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <div className="text-xs" style={{ color: t.textTertiary || '#64748b' }}>CPU</div>
            <div className="text-lg font-bold" style={{ color: c.accent500 || '#06b6d4' }}>45%</div>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            className="px-3 py-1.5 text-xs font-medium text-primary-foreground"
            style={{
              background: `linear-gradient(135deg, ${c.primary500 || '#6366f1'}, ${c.accent500 || '#06b6d4'})`,
              borderRadius: `${s.radiusSm || 6}px`,
              border: 'none',
            }}
          >
            Primary
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium"
            style={{
              background: g.background || 'rgba(255,255,255,0.03)',
              borderRadius: `${s.radiusSm || 6}px`,
              border: `1px solid ${g.border || 'rgba(255,255,255,0.08)'}`,
              color: t.textSecondary || '#94a3b8',
            }}
          >
            Secondary
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {[
            { label: 'OK', color: c.success || '#10b981', Icon: CheckCircle },
            { label: 'Warn', color: c.warning || '#f59e0b', Icon: AlertTriangle },
            { label: 'Error', color: c.danger || '#ef4444', Icon: XCircle },
            { label: 'Info', color: c.info || '#3b82f6', Icon: AlertCircle },
          ].map(({ label, color, Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: `${color}20`,
                color,
                borderRadius: `${s.radiusSm || 6}px`,
              }}
            >
              <Icon size={10} />
              {label}
            </span>
          ))}
        </div>

        {/* AVA Preview */}
        <div
          className="p-2 flex items-center gap-2"
          style={{
            background: `${c.accent500 || '#06b6d4'}15`,
            borderRadius: `${s.radiusSm || 6}px`,
            border: `1px solid ${c.accent500 || '#06b6d4'}30`,
          }}
        >
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${c.accent400 || '#22d3ee'}, ${c.accent600 || '#0891b2'})` }}
          >
            <Sparkles size={12} color="#fff" />
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: c.accent400 || '#22d3ee' }}>AVA</div>
            <div className="text-[10px]" style={{ color: t.textTertiary || '#64748b' }}>Ready to help</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AVA ASSISTANT COMPONENT
// ============================================================================

interface AvaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AvaAssistantProps {
  currentTheme: ThemeDefinition | null;
  onApplySuggestion?: (config: Partial<ThemeConfig>) => void;
}

function AvaAssistant({ currentTheme, onApplySuggestion: _onApplySuggestion }: AvaAssistantProps) {
  void _onApplySuggestion; // Reserved for future AVA-driven theme suggestions
  const [messages, setMessages] = useState<AvaMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickSuggestions = [
    'Make my theme more accessible',
    'Suggest colors for a calm night theme',
    'Help me create a professional look',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await sendMessage(input.trim());
  };

  const sendMessage = async (message: string) => {
    const userMessage: AvaMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    // Add context about theme customization
    const contextMessage = `I'm currently customizing themes in HubbleWave. My current theme is "${currentTheme?.name || 'Void Dark'}". ${message}`;

    try {
      // Use /api/ai/ava which proxies to svc-ava on port 3004
      const token = getStoredToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/ai/ava/chat/stream', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          message: contextMessage,
          conversationId,
          context: {
            page: 'theme-customizer',
            activity: 'customizing-theme',
            currentTheme: currentTheme?.name,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('AVA API error:', response.status, errorText);
        if (response.status === 401) {
          throw new Error('Please log in to use AVA');
        }
        throw new Error(`AVA service error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
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
            } else if (event.type === 'chunk') {
              fullContent += event.data;
              setStreamingContent(fullContent);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      const assistantMessage: AvaMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage: AvaMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errMsg.includes('log in')
          ? errMsg
          : `I couldn't connect to the AI service. Make sure svc-ava is running on port 3004.\n\nError: ${errMsg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', maxHeight: '400px' }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(99,102,241,0.1))',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-primary-500))' }}
          >
            <Sparkles size={14} color="#fff" />
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>AVA</div>
            <div className="text-[10px]" style={{ color: 'var(--color-accent-400)' }}>
              {isLoading ? 'Thinking...' : 'Theme Assistant'}
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="New conversation"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
        {messages.length === 0 && !streamingContent && (
          <div className="space-y-1.5">
            {quickSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                disabled={isLoading}
                className="w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)',
                }}
              >
                <ChevronRight size={12} style={{ color: 'var(--color-accent-500)' }} />
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[90%] rounded-lg px-3 py-2 text-xs"
              style={{
                background: message.role === 'user'
                  ? 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))'
                  : 'var(--glass-bg-hover)',
                color: message.role === 'user' ? '#fff' : 'var(--text-primary)',
                border: message.role === 'assistant' ? '1px solid var(--glass-border)' : 'none',
              }}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {streamingContent && (
          <div className="flex justify-start">
            <div
              className="max-w-[90%] rounded-lg px-3 py-2 text-xs"
              style={{
                background: 'var(--glass-bg-hover)',
                color: 'var(--text-primary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <p className="whitespace-pre-wrap">{streamingContent}</p>
              <span
                className="inline-block w-1.5 h-3 rounded-sm ml-0.5 animate-pulse"
                style={{ background: 'var(--color-accent-500)' }}
              />
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingContent && (
          <div className="flex justify-start">
            <div
              className="rounded-lg px-3 py-2"
              style={{ background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)' }}
            >
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-accent-500)', animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-primary-500)', animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-accent-500)', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-2 shrink-0" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AVA about themes..."
            disabled={isLoading}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-primary-500))' }}
          >
            {isLoading ? (
              <Loader2 size={14} color="#fff" className="animate-spin" />
            ) : (
              <Send size={14} color="#fff" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// IMPORT MODAL
// ============================================================================

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (config: ThemeConfig) => void;
}

function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [json, setJson] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleImport = () => {
    try {
      const parsed = JSON.parse(json);

      // Handle both export formats:
      // 1. Direct config: { colors: {...}, glass: {...}, ... }
      // 2. Wrapped format: { config: { colors: {...}, ... }, customOverrides: {...} }
      let configToImport: ThemeConfig;

      if (parsed.config && typeof parsed.config === 'object') {
        // Wrapped format - merge config with customOverrides
        configToImport = { ...parsed.config };
        if (parsed.customOverrides) {
          if (parsed.customOverrides.colors) {
            configToImport.colors = { ...configToImport.colors, ...parsed.customOverrides.colors };
          }
          if (parsed.customOverrides.glass) {
            configToImport.glass = { ...configToImport.glass, ...parsed.customOverrides.glass };
          }
          if (parsed.customOverrides.typography) {
            configToImport.typography = { ...configToImport.typography, ...parsed.customOverrides.typography };
          }
          if (parsed.customOverrides.spacing) {
            configToImport.spacing = { ...configToImport.spacing, ...parsed.customOverrides.spacing };
          }
        }
      } else if (parsed.colors || parsed.glass || parsed.typography || parsed.spacing) {
        // Direct config format
        configToImport = parsed;
      } else {
        throw new Error('Invalid theme format');
      }

      onImport(configToImport);
      onClose();
      setJson('');
      setError('');
    } catch (e) {
      setError('Invalid JSON format. Please paste a valid theme configuration.');
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{ background: 'var(--void-surface)', border: '1px solid var(--glass-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Import Theme</h3>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <textarea
            value={json}
            onChange={(e) => { setJson(e.target.value); setError(''); }}
            placeholder="Paste theme JSON here..."
            rows={8}
            className="w-full p-3 rounded-lg font-mono text-xs resize-none"
            style={{
              background: 'var(--glass-bg)',
              border: `1px solid ${error ? 'var(--color-danger-500)' : 'var(--glass-border)'}`,
              color: 'var(--text-primary)',
            }}
          />
          {error && <p className="text-xs mt-2" style={{ color: 'var(--color-danger-500)' }}>{error}</p>}
        </div>
        <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--glass-border)' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport}>Import</Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ThemeCustomizerPage() {
  const {
    themes,
    preference,
    currentTheme,
    loading,
    setTheme,
    setPreference,
  } = useThemePreferenceContext();

  const [activeSection, setActiveSection] = useState('presets');
  const [customOverrides, setCustomOverrides] = useState<ThemeConfig>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Merged config for preview
  const mergedConfig = useMemo<ThemeConfig>(() => {
    const base = (currentTheme?.config as ThemeConfig) || {};
    return {
      colors: { ...defaults.colors, ...base.colors, ...customOverrides.colors },
      glass: { ...defaults.glass, ...base.glass, ...customOverrides.glass },
      typography: { ...defaults.typography, ...base.typography, ...customOverrides.typography },
      spacing: { ...defaults.spacing, ...base.spacing, ...customOverrides.spacing },
    };
  }, [currentTheme, customOverrides]);

  // Load existing overrides
  useEffect(() => {
    if (preference?.customOverrides) {
      setCustomOverrides(preference.customOverrides as ThemeConfig);
    }
  }, [preference]);

  const updateOverride = useCallback((path: string, value: string | number) => {
    const val = typeof value === 'number' ? String(value) : value;
    setCustomOverrides((prev) => setNestedValue(prev, path, val));
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    try {
      await setPreference({ customOverrides });
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  const handleReset = () => {
    setCustomOverrides({});
    setHasChanges(true);
  };

  const handleExport = () => {
    // Export just the customizations in a simple format that can be re-imported
    const exportData: ThemeConfig = {
      colors: { ...mergedConfig.colors },
      glass: { ...mergedConfig.glass },
      typography: { ...mergedConfig.typography },
      spacing: { ...mergedConfig.spacing },
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = (config: ThemeConfig) => {
    // Import as custom overrides
    setCustomOverrides(config);
    setHasChanges(true);
  };

  const handleSelectTheme = async (themeId: string) => {
    setCustomOverrides({});
    setHasChanges(false);
    await setTheme(themeId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--void-deep)' }}>
        <div className="text-center">
          <Palette size={32} className="mx-auto mb-3 animate-pulse" style={{ color: 'var(--color-primary-500)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading themes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--void-deep)' }}>
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--glass-border)' }}
      >
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Theme Customizer</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            Personalize your HubbleWave experience
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload size={12} />
            Import
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            {copied ? <Check size={12} /> : <Download size={12} />}
            {copied ? 'Copied!' : 'Export'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleReset}>
            <RotateCcw size={12} />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
            <Check size={12} />
            Save
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex" style={{ height: 'calc(100vh - 65px)' }}>
        {/* Sidebar */}
        <nav className="w-48 p-4 shrink-0" style={{ borderRight: '1px solid var(--glass-border)' }}>
          <div className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    background: isActive ? 'var(--glass-bg-hover)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <Icon size={16} style={{ color: isActive ? 'var(--color-primary-400)' : 'var(--text-tertiary)' }} />
                  {section.label}
                </button>
              );
            })}
          </div>

          {/* Current Theme Info */}
          <div className="mt-6 p-3 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Active Theme
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {currentTheme?.name || 'Void Dark'}
            </div>
            {hasChanges && (
              <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: 'var(--color-warning-500)' }}>
                <AlertCircle size={10} />
                Unsaved changes
              </div>
            )}
          </div>
        </nav>

        {/* Editor Panel */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeSection === 'presets' && (
            <div>
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Preset Themes
              </h2>
              {themes.length === 0 ? (
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                  <AlertCircle size={24} className="mx-auto mb-2" style={{ color: 'var(--color-warning-500)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No themes available</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {themes.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      isActive={theme.id === currentTheme?.id}
                      onSelect={() => handleSelectTheme(theme.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'colors' && (
            <div>
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Colors</h2>

              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    <Layers size={12} /> Void Palette
                  </h3>
                  <ColorPicker label="Pure" value={mergedConfig.colors?.voidPure || ''} onChange={(v) => updateOverride('colors.voidPure', v)} />
                  <ColorPicker label="Deep" value={mergedConfig.colors?.voidDeep || ''} onChange={(v) => updateOverride('colors.voidDeep', v)} />
                  <ColorPicker label="Space" value={mergedConfig.colors?.voidSpace || ''} onChange={(v) => updateOverride('colors.voidSpace', v)} />
                  <ColorPicker label="Surface" value={mergedConfig.colors?.voidSurface || ''} onChange={(v) => updateOverride('colors.voidSurface', v)} />
                  <ColorPicker label="Elevated" value={mergedConfig.colors?.voidElevated || ''} onChange={(v) => updateOverride('colors.voidElevated', v)} />
                  <ColorPicker label="Overlay" value={mergedConfig.colors?.voidOverlay || ''} onChange={(v) => updateOverride('colors.voidOverlay', v)} />
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    <Palette size={12} /> Brand Colors
                  </h3>
                  <ColorPicker label="Primary 400" value={mergedConfig.colors?.primary400 || ''} onChange={(v) => updateOverride('colors.primary400', v)} />
                  <ColorPicker label="Primary 500" value={mergedConfig.colors?.primary500 || ''} onChange={(v) => updateOverride('colors.primary500', v)} />
                  <ColorPicker label="Primary 600" value={mergedConfig.colors?.primary600 || ''} onChange={(v) => updateOverride('colors.primary600', v)} />

                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 mt-6 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    <Sparkles size={12} /> Accent (AVA)
                  </h3>
                  <ColorPicker label="Accent 400" value={mergedConfig.colors?.accent400 || ''} onChange={(v) => updateOverride('colors.accent400', v)} />
                  <ColorPicker label="Accent 500" value={mergedConfig.colors?.accent500 || ''} onChange={(v) => updateOverride('colors.accent500', v)} />
                  <ColorPicker label="Accent 600" value={mergedConfig.colors?.accent600 || ''} onChange={(v) => updateOverride('colors.accent600', v)} />
                </div>
              </div>

              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 mt-8" style={{ color: 'var(--text-muted)' }}>
                Semantic Colors
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <ColorPicker label="Success" value={mergedConfig.colors?.success || ''} onChange={(v) => updateOverride('colors.success', v)} />
                <ColorPicker label="Warning" value={mergedConfig.colors?.warning || ''} onChange={(v) => updateOverride('colors.warning', v)} />
                <ColorPicker label="Danger" value={mergedConfig.colors?.danger || ''} onChange={(v) => updateOverride('colors.danger', v)} />
                <ColorPicker label="Info" value={mergedConfig.colors?.info || ''} onChange={(v) => updateOverride('colors.info', v)} />
              </div>
            </div>
          )}

          {activeSection === 'typography' && (
            <div>
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Typography</h2>
              <div className="max-w-md">
                <ColorPicker label="Primary Text" value={mergedConfig.typography?.textPrimary || ''} onChange={(v) => updateOverride('typography.textPrimary', v)} />
                <ColorPicker label="Secondary Text" value={mergedConfig.typography?.textSecondary || ''} onChange={(v) => updateOverride('typography.textSecondary', v)} />
                <ColorPicker label="Tertiary Text" value={mergedConfig.typography?.textTertiary || ''} onChange={(v) => updateOverride('typography.textTertiary', v)} />
                <ColorPicker label="Muted Text" value={mergedConfig.typography?.textMuted || ''} onChange={(v) => updateOverride('typography.textMuted', v)} />
              </div>
            </div>
          )}

          {activeSection === 'glass' && (
            <div>
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Glass Effects</h2>
              <div className="max-w-md">
                <ColorPicker label="Background" value={mergedConfig.glass?.background || ''} onChange={(v) => updateOverride('glass.background', v)} />
                <ColorPicker label="Background Hover" value={mergedConfig.glass?.backgroundHover || ''} onChange={(v) => updateOverride('glass.backgroundHover', v)} />
                <ColorPicker label="Border" value={mergedConfig.glass?.border || ''} onChange={(v) => updateOverride('glass.border', v)} />
                <ColorPicker label="Border Hover" value={mergedConfig.glass?.borderHover || ''} onChange={(v) => updateOverride('glass.borderHover', v)} />
                <Slider
                  label="Blur Amount"
                  value={parseInt(mergedConfig.glass?.blur || '20')}
                  onChange={(v) => updateOverride('glass.blur', v)}
                  min={0}
                  max={40}
                />
              </div>
            </div>
          )}

          {activeSection === 'spacing' && (
            <div>
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Border Radius</h2>
              <div className="max-w-md">
                <Slider label="Small" value={parseInt(mergedConfig.spacing?.radiusSm || '6')} onChange={(v) => updateOverride('spacing.radiusSm', v)} min={0} max={16} />
                <Slider label="Medium" value={parseInt(mergedConfig.spacing?.radiusMd || '10')} onChange={(v) => updateOverride('spacing.radiusMd', v)} min={0} max={24} />
                <Slider label="Large" value={parseInt(mergedConfig.spacing?.radiusLg || '16')} onChange={(v) => updateOverride('spacing.radiusLg', v)} min={0} max={32} />
                <Slider label="Extra Large" value={parseInt(mergedConfig.spacing?.radiusXl || '24')} onChange={(v) => updateOverride('spacing.radiusXl', v)} min={0} max={48} />
              </div>
            </div>
          )}
        </main>

        {/* Preview Panel */}
        <aside className="w-80 p-4 shrink-0 overflow-y-auto" style={{ borderLeft: '1px solid var(--glass-border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Eye size={14} style={{ color: 'var(--text-tertiary)' }} />
            <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Live Preview</h3>
          </div>
          <LivePreview config={mergedConfig} />
          <div className="mt-4">
            <AvaAssistant currentTheme={currentTheme} />
          </div>
        </aside>
      </div>

      <ImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImport={handleImport} />

      <style>{`
        .slider-track {
          background: var(--glass-border);
        }
        .slider-track::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          background: var(--color-primary-500);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(99,102,241,0.4);
        }
        .slider-track::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: var(--color-primary-500);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(99,102,241,0.4);
        }
      `}</style>
    </div>
  );
}
