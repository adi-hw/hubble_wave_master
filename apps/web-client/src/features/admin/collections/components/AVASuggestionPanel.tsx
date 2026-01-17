import React from 'react';
import { Sparkles, Check, Database, Palette, Layers, MessageSquare } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';


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
    <div className="rounded-xl overflow-hidden bg-muted border border-primary">
      <div className="p-4 flex items-center gap-2 border-b border-primary/20 bg-primary/10">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">AVA Suggestions</h3>
      </div>

      <div className="p-4">
        {loading ? (
           <div className="space-y-3 animate-pulse">
             <div className="h-10 rounded bg-muted-foreground/20"></div>
             <div className="h-10 rounded bg-muted-foreground/20"></div>
             <div className="h-10 rounded bg-muted-foreground/20"></div>
           </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <p>Start typing a name to get AI suggestions...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.field}-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">
                      {suggestion.field === 'icon' && <Layers className="h-4 w-4" />}
                      {suggestion.field === 'color' && <Palette className="h-4 w-4" />}
                      {suggestion.field === 'category' && <Database className="h-4 w-4" />}
                      {['code', 'labelPlural'].includes(suggestion.field) && <MessageSquare className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {suggestion.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {typeof suggestion.value === 'string' ? suggestion.value : 'Updated setting'}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAccept(suggestion)}
                    className="text-primary"
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

            <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                    Based on your input, I've detected similar collections:
                    <span className="font-medium text-foreground"> Suppliers (89%)</span>
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
