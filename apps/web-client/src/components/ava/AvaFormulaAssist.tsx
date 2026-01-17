/**
 * AVA Formula Assist Component
 *
 * Provides AI-powered formula creation assistance within the formula editor.
 * Users can describe their formula needs in natural language and get generated formulas.
 */

import { useState, useCallback } from 'react';
import { avaService } from '../../services/ava.service';

interface FormulaProperty {
  name: string;
  type: string;
}

interface FormulaSuggestion {
  formula: string;
  explanation: string;
  resultType: string;
  dependencies: string[];
  cacheStrategy: string;
  cacheTtl?: number;
  examples?: Array<{ input: string; output: string }>;
  alternatives?: FormulaSuggestion[];
}

interface AvaFormulaAssistProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId?: string;
  availableProperties: FormulaProperty[];
  onAccept: (formula: string) => void;
}

export function AvaFormulaAssist({
  isOpen,
  onClose,
  collectionId,
  availableProperties,
  onAccept,
}: AvaFormulaAssistProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<FormulaSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await avaService.createFormula({
        description: input,
        context: {
          collectionId,
          availableProperties,
        },
      });

      setSuggestion({
        formula: response.formula,
        explanation: response.explanation,
        resultType: response.resultType,
        dependencies: response.dependencies,
        cacheStrategy: response.cacheStrategy,
        cacheTtl: response.cacheTtl,
        examples: response.examples,
        alternatives: response.alternatives,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate formula');
    } finally {
      setLoading(false);
    }
  }, [input, collectionId, availableProperties]);

  const handleAccept = useCallback(() => {
    if (suggestion) {
      onAccept(suggestion.formula);
      handleReset();
    }
  }, [suggestion, onAccept]);

  const handleReset = useCallback(() => {
    setInput('');
    setSuggestion(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [onClose, handleReset]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-label="Formula Assistant">
      <div className="absolute inset-0 bg-overlay/50" onClick={handleClose} />
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-xl shadow-2xl overflow-hidden">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
          <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary-foreground">
              <circle cx="12" cy="12" r="10" className="fill-primary-foreground/30" />
              <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-primary-foreground flex-1">Formula Assistant</h3>
          <button
            type="button"
            className="p-1 rounded text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={handleClose}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </header>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {!suggestion ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Describe the calculation you need in plain language:
              </p>

              <textarea
                className="w-full px-3 py-2 text-sm rounded-lg bg-muted border border-border text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Example: Calculate the number of days between order date and delivery date"
                rows={4}
                aria-label="Formula description"
              />

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
                <ul className="space-y-1">
                  {[
                    'Calculate total price with tax',
                    'Show days until due date',
                    'Concatenate first and last name',
                    'Assign priority based on amount',
                  ].map((example) => (
                    <li
                      key={example}
                      onClick={() => setInput(example)}
                      className="text-sm text-primary cursor-pointer hover:underline"
                    >
                      "{example}"
                    </li>
                  ))}
                </ul>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
                  {error}
                </div>
              )}

              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground disabled:opacity-50"
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Formula'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Generated Formula</h4>
                <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>
              </div>

              <pre className="p-3 rounded-lg bg-muted border border-border overflow-x-auto">
                <code className="text-sm text-foreground">{suggestion.formula}</code>
              </pre>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded bg-muted">
                  <span className="block text-xs text-muted-foreground">Result Type</span>
                  <span className="font-medium text-foreground">{suggestion.resultType}</span>
                </div>
                {suggestion.dependencies.length > 0 && (
                  <div className="p-2 rounded bg-muted">
                    <span className="block text-xs text-muted-foreground">Dependencies</span>
                    <span className="font-medium text-foreground">{suggestion.dependencies.join(', ')}</span>
                  </div>
                )}
                <div className="p-2 rounded bg-muted">
                  <span className="block text-xs text-muted-foreground">Cache Strategy</span>
                  <span className="font-medium text-foreground">{suggestion.cacheStrategy}</span>
                </div>
              </div>

              {suggestion.examples && suggestion.examples.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-foreground">Example Results</h5>
                  {suggestion.examples.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <code className="px-2 py-1 rounded bg-muted text-muted-foreground">{ex.input}</code>
                      <span className="text-muted-foreground">&rarr;</span>
                      <strong className="text-foreground">{ex.output}</strong>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground"
                  onClick={handleAccept}
                >
                  Use This Formula
                </button>
                <button
                  type="button"
                  className="flex-1 px-4 py-2 rounded-lg font-medium bg-muted text-foreground"
                  onClick={handleReset}
                >
                  Try Different Description
                </button>
              </div>

              {suggestion.alternatives && suggestion.alternatives.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-foreground">Alternative Approaches</h5>
                  {suggestion.alternatives.map((alt, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-muted/50 border border-border cursor-pointer hover:bg-muted"
                      onClick={() => setSuggestion(alt)}
                    >
                      <code className="text-sm text-primary">{alt.formula}</code>
                      <p className="text-xs text-muted-foreground mt-1">{alt.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="px-4 py-3 border-t border-border bg-muted/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Available properties:</span>
            <div className="flex flex-wrap gap-1">
              {availableProperties.slice(0, 5).map((prop) => (
                <span key={prop.name} className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary">
                  {prop.name}
                </span>
              ))}
              {availableProperties.length > 5 && (
                <span className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                  +{availableProperties.length - 5} more
                </span>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default AvaFormulaAssist;
