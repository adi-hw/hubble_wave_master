import { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  Zap,
  ChevronRight,
  X,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
} from 'lucide-react';
import {
  predictiveUIApi,
  UISuggestion,
} from '../../../services/phase7Api';

interface PredictiveUIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string;
}

const suggestionTypeStyles: Record<string, { bg: string; text: string }> = {
  shortcut: { bg: 'bg-primary/10', text: 'text-primary' },
  navigation: { bg: 'bg-info-subtle', text: 'text-info-text' },
  action: { bg: 'bg-success-subtle', text: 'text-success-text' },
  data: { bg: 'bg-warning-subtle', text: 'text-warning-text' },
};

export const PredictiveUIPanel: React.FC<PredictiveUIPanelProps> = ({
  isOpen,
  onClose,
  context,
}) => {
  const [suggestions, setSuggestions] = useState<UISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<UISuggestion | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
  }, [isOpen, context]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const response = await predictiveUIApi.getSuggestions(context);
      setSuggestions(response.suggestions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = async (suggestion: UISuggestion) => {
    try {
      await predictiveUIApi.applySuggestion(suggestion.id);
      loadSuggestions();
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    }
  };

  const handleDismissSuggestion = async (suggestion: UISuggestion) => {
    try {
      await predictiveUIApi.dismissSuggestion(suggestion.id);
      setSuggestions(suggestions.filter(s => s.id !== suggestion.id));
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
    }
  };

  const handleProvideFeedback = async (suggestionId: string, helpful: boolean) => {
    try {
      await predictiveUIApi.provideFeedback(suggestionId, helpful);
    } catch (error) {
      console.error('Failed to provide feedback:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-4 top-20 w-96 rounded-2xl shadow-xl overflow-hidden z-40 bg-card border border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">
            Smart Suggestions
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadSuggestions} className="p-1.5 rounded hover:bg-muted">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-20 rounded-lg animate-pulse bg-muted"
              />
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="p-8 text-center">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-foreground">
              No suggestions right now
            </p>
            <p className="text-sm mt-1 text-muted-foreground">
              Keep working and we'll learn your patterns
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {suggestions.map((suggestion) => {
              const typeStyle = suggestionTypeStyles[suggestion.type] || suggestionTypeStyles.action;

              return (
                <div
                  key={suggestion.id}
                  className={`p-3 rounded-lg transition-all cursor-pointer ${
                    selectedSuggestion?.id === suggestion.id
                      ? 'bg-muted'
                      : 'bg-background hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedSuggestion(
                    selectedSuggestion?.id === suggestion.id ? null : suggestion
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded shrink-0 ${typeStyle.bg}`}>
                      <Zap className={`h-4 w-4 ${typeStyle.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {suggestion.title}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs capitalize ${typeStyle.bg} ${typeStyle.text}`}>
                          {suggestion.type}
                        </span>
                      </div>
                      <p className="text-xs line-clamp-2 text-muted-foreground">
                        {suggestion.description}
                      </p>
                      {suggestion.confidence && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3" />
                          <span>{Math.round(suggestion.confidence * 100)}% confidence</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-transform text-muted-foreground ${
                        selectedSuggestion?.id === suggestion.id ? 'rotate-90' : ''
                      }`}
                    />
                  </div>

                  {selectedSuggestion?.id === suggestion.id && (
                    <div className="mt-3 pt-3 border-t border-border">
                      {suggestion.reasoning && (
                        <p className="text-xs mb-3 text-muted-foreground">
                          <span className="font-medium">Why: </span>
                          {suggestion.reasoning}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApplySuggestion(suggestion); }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Apply
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDismissSuggestion(suggestion); }}
                          className="px-3 py-1.5 rounded text-sm bg-muted text-muted-foreground hover:bg-muted/80"
                        >
                          Dismiss
                        </button>
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleProvideFeedback(suggestion.id, true); }}
                            className="p-1.5 rounded hover:bg-muted"
                            title="Helpful"
                          >
                            <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleProvideFeedback(suggestion.id, false); }}
                            className="p-1.5 rounded hover:bg-muted"
                            title="Not helpful"
                          >
                            <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Suggestions are based on your usage patterns and preferences
        </p>
      </div>
    </div>
  );
};

export default PredictiveUIPanel;
