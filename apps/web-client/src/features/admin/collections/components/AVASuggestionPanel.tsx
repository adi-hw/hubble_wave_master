import React from 'react';
import { Sparkles, Check, Database, Palette, Layers, MessageSquare } from 'lucide-react';
import { Button } from '../../../../components/ui/Button'; // Verify path


interface AVASuggestion {
  field: string;
  value: any;
  label: string;
  reason?: string;
}

interface AVASuggestionPanelProps {
  suggestions: AVASuggestion[];
  onAccept: (suggestion: AVASuggestion) => void;
  onAcceptAll: () => void;
  loading?: boolean;
}

export const AVASuggestionPanel: React.FC<AVASuggestionPanelProps> = ({
  suggestions,
  onAccept,
  onAcceptAll,
  loading = false,
}) => {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface-secondary)',
        border: '1px solid var(--color-accent-500)',
      }}
    >
      <div
        className="p-4 flex items-center gap-2"
        style={{
          borderBottom: '1px solid var(--bg-accent-subtle)',
          background: 'var(--bg-accent-subtle)',
        }}
      >
        <Sparkles className="h-5 w-5" style={{ color: 'var(--color-accent-500)' }} />
        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>AVA Suggestions</h3>
      </div>

      <div className="p-4">
        {loading ? (
           <div className="space-y-3 animate-pulse">
             <div className="h-10 rounded" style={{ backgroundColor: 'var(--bg-surface-tertiary)' }}></div>
             <div className="h-10 rounded" style={{ backgroundColor: 'var(--bg-surface-tertiary)' }}></div>
             <div className="h-10 rounded" style={{ backgroundColor: 'var(--bg-surface-tertiary)' }}></div>
           </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p>Start typing a name to get AI suggestions...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.field}-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {suggestion.field === 'icon' && <Layers className="h-4 w-4" />}
                      {suggestion.field === 'color' && <Palette className="h-4 w-4" />}
                      {suggestion.field === 'category' && <Database className="h-4 w-4" />}
                      {['code', 'labelPlural'].includes(suggestion.field) && <MessageSquare className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {suggestion.label}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {typeof suggestion.value === 'string' ? suggestion.value : 'Updated setting'}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAccept(suggestion)}
                    style={{ color: 'var(--color-accent-500)' }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="accent"
              className="w-full"
              onClick={onAcceptAll}
            >
              Apply All Suggestions
            </Button>

            <div className="pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Based on your input, I've detected similar collections:
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}> Suppliers (89%)</span>
                </p>
                <div className="mt-2 flex gap-2">
                    <input
                        className="input flex-1 text-xs"
                        placeholder="Ask AVA a question..."
                    />
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
