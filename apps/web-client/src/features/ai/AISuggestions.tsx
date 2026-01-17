import { useState, useEffect } from 'react';
import { Lightbulb, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AISuggestionsProps {
  context: string;
  type: 'next_action' | 'related_content' | 'similar_issues';
  onSuggestionClick?: (suggestion: string) => void;
  className?: string;
  limit?: number;
  autoLoad?: boolean;
}

const typeLabels = {
  next_action: 'Suggested Actions',
  related_content: 'Related Content',
  similar_issues: 'Similar Issues',
};

export function AISuggestions({
  context,
  type,
  onSuggestionClick,
  className,
  limit = 3,
  autoLoad = true,
}: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    if (!context.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/chat/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, type, limit }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } else {
        setError('Failed to load suggestions');
      }
    } catch {
      setError('AI service unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad && context) {
      fetchSuggestions();
    }
  }, [context, type, autoLoad]);

  if (!context) return null;

  return (
    <div
      className={cn(
        'bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h4 className="font-medium text-indigo-900 dark:text-indigo-100">
            {typeLabels[type]}
          </h4>
        </div>
        <button
          onClick={fetchSuggestions}
          disabled={isLoading}
          className="p-1.5 rounded-lg hover:bg-primary/10 text-primary disabled:opacity-50"
          title="Refresh suggestions"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {isLoading && suggestions.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : error ? (
        <p className="text-sm text-primary/70 py-2">
          {error}
        </p>
      ) : suggestions.length > 0 ? (
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick?.(suggestion)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left',
                'bg-card',
                'border border-primary/30',
                'hover:border-primary/50',
                'text-sm text-foreground',
                'transition-colors'
              )}
            >
              <span className="flex-1">{suggestion}</span>
              <ChevronRight className="w-4 h-4 text-primary/70 flex-shrink-0" />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-primary/70 py-2">
          No suggestions available
        </p>
      )}
    </div>
  );
}
