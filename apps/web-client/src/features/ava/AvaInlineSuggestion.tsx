/**
 * AvaInlineSuggestion - Inline AVA Suggestions
 * HubbleWave Platform - Phase 6
 *
 * Displays contextual AVA suggestions inline within forms and data views.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Lightbulb,
  X,
  ChevronRight,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassButton } from '../../components/ui/glass/GlassButton';

export type SuggestionType = 'value' | 'action' | 'correction' | 'insight' | 'recommendation';

export interface InlineSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description?: string;
  value?: string | number | boolean;
  confidence: number;
  action?: () => void | Promise<void>;
  metadata?: Record<string, unknown>;
}

interface AvaInlineSuggestionProps {
  /** Field or context identifier */
  fieldId?: string;
  /** Collection ID for context */
  collectionId?: string;
  /** Record data for context */
  recordData?: Record<string, unknown>;
  /** Whether to auto-fetch suggestions */
  autoFetch?: boolean;
  /** Callback when a suggestion is applied */
  onApply?: (suggestion: InlineSuggestion) => void;
  /** Callback when a suggestion is dismissed */
  onDismiss?: (suggestion: InlineSuggestion) => void;
  /** Custom CSS classes */
  className?: string;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Position of the suggestion */
  position?: 'top' | 'bottom' | 'inline';
}

const typeConfig: Record<SuggestionType, { icon: typeof Sparkles; colorClass: string; label: string }> = {
  value: { icon: Sparkles, colorClass: 'text-primary', label: 'Suggested Value' },
  action: { icon: ChevronRight, colorClass: 'text-success-text', label: 'Recommended Action' },
  correction: { icon: RefreshCw, colorClass: 'text-warning-text', label: 'Correction' },
  insight: { icon: Lightbulb, colorClass: 'text-info-text', label: 'Insight' },
  recommendation: { icon: Check, colorClass: 'text-foreground', label: 'Recommendation' },
};

export const AvaInlineSuggestion: React.FC<AvaInlineSuggestionProps> = ({
  fieldId,
  collectionId,
  recordData,
  autoFetch = true,
  onApply,
  onDismiss,
  className,
  compact = false,
  position = 'bottom',
}) => {
  const [suggestions, setSuggestions] = useState<InlineSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>({});

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!fieldId && !collectionId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/ava/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId,
          collectionId,
          recordData,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fieldId, collectionId, recordData]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchSuggestions();
    }
  }, [autoFetch, fetchSuggestions]);

  // Apply suggestion
  const handleApply = async (suggestion: InlineSuggestion) => {
    if (suggestion.action) {
      await suggestion.action();
    }
    if (onApply) {
      onApply(suggestion);
    }
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  };

  // Dismiss suggestion
  const handleDismiss = (suggestion: InlineSuggestion) => {
    if (onDismiss) {
      onDismiss(suggestion);
    }
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  };

  // Submit feedback
  const handleFeedback = async (suggestion: InlineSuggestion, isPositive: boolean) => {
    try {
      await fetch('/api/ava/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId: suggestion.id,
          feedbackType: isPositive ? 'positive' : 'negative',
        }),
      });
      setFeedbackGiven((prev) => ({ ...prev, [suggestion.id]: true }));
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  if (suggestions.length === 0 && !isLoading) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 flex-wrap', className)}>
        {suggestions.slice(0, 3).map((suggestion) => {
          const config = typeConfig[suggestion.type];
          const Icon = config.icon;

          return (
            <button
              key={suggestion.id}
              onClick={() => handleApply(suggestion)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-full',
                'text-xs font-medium',
                'border border-border',
                'hover:border-primary hover:bg-primary/10',
                'transition-colors',
                config.colorClass
              )}
            >
              <Icon className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{suggestion.title}</span>
              <X
                className="h-3 w-3 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss(suggestion);
                }}
              />
            </button>
          );
        })}
        {suggestions.length > 3 && (
          <span className="text-xs text-muted-foreground">
            +{suggestions.length - 3} more
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden',
        'border border-border',
        'bg-card',
        position === 'top' && 'mb-2',
        position === 'bottom' && 'mt-2',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground">
            AVA Suggestions
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            {suggestions.length}
          </span>
        </div>
        <GlassButton
          variant="ghost"
          size="sm"
          iconOnly
          onClick={fetchSuggestions}
          disabled={isLoading}
          aria-label="Refresh suggestions"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
        </GlassButton>
      </div>

      {/* Suggestions List */}
      <div className="divide-y divide-border/50">
        {suggestions.map((suggestion) => {
          const config = typeConfig[suggestion.type];
          const Icon = config.icon;
          const isExpanded = expandedId === suggestion.id;

          return (
            <div key={suggestion.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg flex-shrink-0 bg-muted">
                  <Icon className={cn('h-4 w-4', config.colorClass)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {suggestion.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {config.label} - {Math.round(suggestion.confidence * 100)}% confident
                      </p>
                    </div>
                    <button
                      onClick={() => handleDismiss(suggestion)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {suggestion.description && (
                    <p
                      className={cn(
                        'text-xs mt-1 text-muted-foreground',
                        !isExpanded && 'line-clamp-2'
                      )}
                    >
                      {suggestion.description}
                    </p>
                  )}

                  {suggestion.value !== undefined && (
                    <div className="mt-2 px-2 py-1 rounded text-xs font-mono bg-muted text-foreground">
                      {String(suggestion.value)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-2">
                    <GlassButton
                      variant="solid"
                      size="sm"
                      onClick={() => handleApply(suggestion)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Apply
                    </GlassButton>
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                    >
                      {isExpanded ? 'Less' : 'More'}
                    </GlassButton>
                    {!feedbackGiven[suggestion.id] && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => handleFeedback(suggestion, true)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                          aria-label="Helpful"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleFeedback(suggestion, false)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                          aria-label="Not helpful"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AvaInlineSuggestion;
