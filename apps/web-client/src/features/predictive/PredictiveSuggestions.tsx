/**
 * PredictiveSuggestions - Predictive UI Component
 * HubbleWave Platform - Phase 7
 *
 * Displays smart suggestions based on user behavior patterns.
 */

import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Search,
  FileText,
  Navigation,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassButton } from '../../components/ui/glass/GlassButton';
import { usePredictiveUI, PredictiveSuggestion } from './usePredictiveUI';

interface PredictiveSuggestionsProps {
  userId: string;
  className?: string;
  position?: 'floating' | 'inline' | 'sidebar';
  maxVisible?: number;
}

const typeIcons: Record<PredictiveSuggestion['type'], typeof ArrowRight> = {
  action: ArrowRight,
  navigation: Navigation,
  search: Search,
  report: FileText,
};

export const PredictiveSuggestions: React.FC<PredictiveSuggestionsProps> = ({
  userId,
  className,
  position = 'floating',
  maxVisible = 3,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  const { suggestions, acceptSuggestion, dismissSuggestion, clearSuggestions } =
    usePredictiveUI({
      userId,
      maxSuggestions: 5,
    });

  if (suggestions.length === 0 || isMinimized) {
    if (isMinimized && suggestions.length > 0) {
      return (
        <button
          onClick={() => setIsMinimized(false)}
          className={cn(
            'fixed bottom-4 right-4 z-40',
            'p-3 rounded-full shadow-lg',
            'bg-primary text-primary-foreground',
            'transition-transform hover:scale-105'
          )}
        >
          <Sparkles className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
            {suggestions.length}
          </span>
        </button>
      );
    }
    return null;
  }

  const visibleSuggestions = isExpanded
    ? suggestions
    : suggestions.slice(0, maxVisible);

  const containerClasses = {
    floating: 'fixed bottom-4 right-4 z-40 w-80',
    inline: 'w-full',
    sidebar: 'w-full',
  };

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden',
        'bg-card border border-border',
        'shadow-lg',
        containerClasses[position],
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-primary/10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Suggested Actions
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-primary text-primary-foreground">
            {suggestions.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {suggestions.length > maxVisible && (
            <GlassButton
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </GlassButton>
          )}
          <GlassButton
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize"
          >
            <X className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>

      <div className="divide-y divide-border">
        {visibleSuggestions.map((suggestion) => {
          const Icon = typeIcons[suggestion.type];

          return (
            <div
              key={suggestion.id}
              className="p-3 hover:bg-muted transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg flex-shrink-0 bg-muted">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {suggestion.label}
                      </p>
                      <p className="text-xs mt-0.5 text-muted-foreground">
                        {suggestion.description}
                      </p>
                    </div>
                    <button
                      onClick={() => dismissSuggestion(suggestion.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground"
                      aria-label="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1 rounded-full overflow-hidden bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${suggestion.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>

                  <div className="mt-2">
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => acceptSuggestion(suggestion)}
                    >
                      {suggestion.type === 'navigation' ? 'Go' : 'Do This'}
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </GlassButton>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {suggestions.length > 1 && (
        <div className="px-4 py-2 flex items-center justify-between border-t border-border">
          <span className="text-xs text-muted-foreground">
            Personalized for you
          </span>
          <button
            onClick={clearSuggestions}
            className="text-xs hover:underline text-muted-foreground"
          >
            Dismiss all
          </button>
        </div>
      )}
    </div>
  );
};

export default PredictiveSuggestions;
