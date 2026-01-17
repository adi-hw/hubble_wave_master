import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { PredictiveUIPanel } from './PredictiveUIPanel';
import { predictiveUIApi } from '../../../services/phase7Api';

interface PredictiveUIButtonProps {
  className?: string;
  context?: string;
}

export const PredictiveUIButton: React.FC<PredictiveUIButtonProps> = ({ className = '', context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);

  useEffect(() => {
    checkSuggestions();
    const interval = setInterval(checkSuggestions, 30000);
    return () => clearInterval(interval);
  }, [context]);

  const checkSuggestions = async () => {
    try {
      const response = await predictiveUIApi.getSuggestions(context);
      setSuggestionCount(response.suggestions.length);
    } catch (error) {
      console.error('Failed to check suggestions:', error);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors hover:bg-hover ${className}`}
        title="Smart Suggestions"
      >
        <Sparkles
          className={`h-5 w-5 ${suggestionCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}
        />
        {suggestionCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs font-medium text-primary-foreground bg-primary"
          >
            {suggestionCount > 9 ? '9+' : suggestionCount}
          </span>
        )}
      </button>
      <PredictiveUIPanel isOpen={isOpen} onClose={() => setIsOpen(false)} context={context} />
    </>
  );
};

export default PredictiveUIButton;
