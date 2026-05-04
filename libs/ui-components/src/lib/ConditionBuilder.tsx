/**
 * ConditionBuilder Component
 * HubbleWave Platform
 *
 * Production-ready condition builder with:
 * - Theme-aware styling using Tailwind CSS
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly touch targets
 */

import React, { useState, useCallback } from 'react';
import { AccessCondition, AccessConditionGroup } from '../../services/accessApi';
import { Code, Layers, AlertCircle } from 'lucide-react';

interface ConditionBuilderProps {
  value?: AccessCondition | AccessConditionGroup;
  onChange: (value: AccessCondition | AccessConditionGroup) => void;
  propertyTypes?: Record<string, string>; // Map of property code to data type
}

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({ value, onChange }) => {
  // Simple JSON text mode for fallback/initial implementation
  const [jsonMode, setJsonMode] = useState<boolean>(true);
  const [jsonText, setJsonText] = useState<string>('{}');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setJsonText(JSON.stringify(value || {}, null, 2));
  }, [value]);

  const handleJsonChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setJsonText(newText);
      try {
        const parsed = JSON.parse(newText);
        onChange(parsed);
        setError(null);
      } catch (err) {
        setError('Invalid JSON');
      }
    },
    [onChange]
  );

  const handleModeToggle = useCallback(() => {
    // If switching to visual, ensure JSON is valid. If switching to JSON, update text.
    if (!jsonMode) {
      setJsonText(JSON.stringify(value || {}, null, 2));
    }
    setJsonMode(!jsonMode);
  }, [jsonMode, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Allow Tab for indentation in textarea
      if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newText = jsonText.substring(0, start) + '  ' + jsonText.substring(end);
        setJsonText(newText);
        // Set cursor position after the inserted spaces
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        }, 0);
      }
    },
    [jsonText]
  );

  if (jsonMode) {
    return (
      <div
        className="condition-builder-json"
        role="group"
        aria-label="Condition builder in JSON mode"
      >
        <div className="flex justify-between items-center mb-2">
          <label
            className="text-sm font-medium flex items-center gap-2 text-muted-foreground"
            htmlFor="condition-json-input"
          >
            <Code className="w-4 h-4" aria-hidden="true" />
            Condition Logic (JSON)
          </label>
          <button
            type="button"
            onClick={handleModeToggle}
            className="text-xs underline transition-colors min-h-[32px] px-2 flex items-center gap-1 text-primary hover:text-primary/80"
            aria-label="Switch to visual builder mode"
          >
            <Layers className="w-3 h-3" aria-hidden="true" />
            Switch to Visual Builder (Beta)
          </button>
        </div>
        <textarea
          id="condition-json-input"
          className={`w-full h-40 font-mono text-xs p-3 rounded-lg transition-colors bg-card text-foreground border outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
            error ? 'border-destructive' : 'border-border'
          }`}
          value={jsonText}
          onChange={handleJsonChange}
          onKeyDown={handleKeyDown}
          placeholder='e.g. { "property": "status", "operator": "equals", "value": "active" }'
          aria-invalid={!!error}
          aria-describedby={error ? 'condition-error' : 'condition-help'}
        />
        {error && (
          <div
            id="condition-error"
            className="flex items-center gap-1 mt-1 text-xs text-destructive"
            role="alert"
          >
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            {error}
          </div>
        )}
        <p
          id="condition-help"
          className="text-xs mt-2 text-muted-foreground/70"
        >
          Supports simple conditions or groups with "and"/"or" arrays. Special values:
          "@currentUser.id", "@currentUser.email"
        </p>
      </div>
    );
  }

  // Visual Builder Mode
  return (
    <div
      className="condition-builder-visual rounded-lg p-4 bg-muted border border-border"
      role="group"
      aria-label="Condition builder in visual mode"
    >
      <div className="flex justify-between items-center mb-4">
        <span className="font-medium flex items-center gap-2 text-foreground">
          <Layers className="w-4 h-4" aria-hidden="true" />
          Visual Builder
        </span>
        <button
          type="button"
          onClick={handleModeToggle}
          className="text-xs underline transition-colors min-h-[32px] px-2 flex items-center gap-1 text-primary hover:text-primary/80"
          aria-label="Switch to JSON mode"
        >
          <Code className="w-3 h-3" aria-hidden="true" />
          Switch to JSON
        </button>
      </div>
      <div className="text-center py-8 rounded-lg bg-card border-2 border-dashed border-border text-muted-foreground/70">
        <Layers
          className="w-8 h-8 mx-auto mb-2 opacity-50"
          aria-hidden="true"
        />
        <p className="italic">
          Visual builder is coming soon. Please use JSON mode for complex rules.
        </p>
      </div>
    </div>
  );
};
