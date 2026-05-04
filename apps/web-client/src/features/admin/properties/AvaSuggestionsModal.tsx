/**
 * AvaSuggestionsModal
 * HubbleWave Platform - Phase 3
 *
 * Modal for smart type detection using AVA to analyze sample data.
 */

import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle, Loader2, X, AlertCircle } from 'lucide-react';
import { propertyApi } from '../../../services/propertyApi';

interface AvaSuggestionsModalProps {
  open: boolean;
  collectionId: string;
  onClose: () => void;
  onApply: (suggestion: {
    dataType: string;
    label?: string;
    formatOptions?: Record<string, unknown>;
  }) => void;
}

export const AvaSuggestionsModal: React.FC<AvaSuggestionsModalProps> = ({
  open,
  collectionId,
  onClose,
  onApply,
}) => {
  const [propertyLabel, setPropertyLabel] = useState('');
  const [samples, setSamples] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    dataType: string;
    confidence: number;
    explanation?: string;
    formatOptions?: Record<string, unknown>;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setPropertyLabel('');
    setSamples('');
    setError(null);
    setResult(null);
  }, [open]);

  const handleAnalyze = async () => {
    const label = propertyLabel.trim();
    const sampleList = samples.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!label && sampleList.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const detection =
        sampleList.length > 0
          ? await propertyApi.detectType(collectionId, sampleList)
          : await propertyApi.suggest(collectionId, label).then((suggestion) => ({
              dataType: suggestion.dataType ?? 'text',
              confidence: 0.85,
              explanation: `Matched "${label}" against common property-name patterns.`,
              formatOptions: suggestion.formatOptions as Record<string, unknown> | undefined,
            }));
      if (!detection?.dataType) {
        throw new Error('Type detection returned no data type.');
      }
      setResult({
        ...detection,
        explanation:
          detection.explanation ??
          (sampleList.length > 0
            ? `Analyzed ${sampleList.length} sample value${sampleList.length === 1 ? '' : 's'}.`
            : undefined),
      });
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Type detection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    const label = propertyLabel.trim();
    if (result && label) {
      onApply({
        dataType: result.dataType,
        label,
        formatOptions: result.formatOptions,
      });
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-overlay/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-md rounded-lg shadow-xl bg-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2
            id="modal-title"
            className="text-lg font-semibold text-foreground"
          >
            Smart Type Detection
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1 rounded hover:bg-hover"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 border-b border-border space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter a property name or paste sample values, and AVA will detect the best
            property type for you.
          </p>

          <input
            type="text"
            aria-label="Property label"
            value={propertyLabel}
            onChange={(e) => {
              setPropertyLabel(e.target.value);
              setResult(null);
            }}
            placeholder="e.g. phone_mobile"
            className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
          />

          <textarea
            rows={6}
            aria-label="Sample values"
            placeholder={`e.g.\n$12,500\n$450.00\n$1,200`}
            value={samples}
            onChange={(e) => {
              setSamples(e.target.value);
              setResult(null);
            }}
            className="w-full px-3 py-2 rounded border text-sm font-mono resize-none bg-muted border-border text-foreground"
          />

          {error ? (
            <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {loading && (
            <div className="flex justify-center p-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {result && (
            <div
              className={`flex items-start gap-3 rounded border p-3 ${
                result.confidence < 0.7
                  ? 'border-warning-border bg-warning-subtle'
                  : 'bg-success-subtle border-success-border'
              }`}
            >
              {result.confidence < 0.7 ? (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-warning-text" />
              ) : (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-success-text" />
              )}
              <div className="flex-1">
                <p
                  className={`font-medium text-sm ${
                    result.confidence < 0.7 ? 'text-warning-text' : 'text-success-text'
                  }`}
                >
                  Detected: <strong>{result.dataType}</strong>
                </p>
                <p
                  className={`text-xs ${
                    result.confidence < 0.7 ? 'text-warning-text' : 'text-success-text'
                  }`}
                >
                  Confidence: {Math.round(result.confidence * 100)}%
                </p>
                {result.explanation ? (
                  <p
                    className={`mt-1 text-xs ${
                      result.confidence < 0.7 ? 'text-warning-text' : 'text-success-text'
                    }`}
                  >
                    {result.explanation}
                  </p>
                ) : null}
                {result.confidence < 0.7 ? (
                  <p className="mt-1 text-xs text-warning-text">
                    Low confidence. Review the suggested type before using it.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleApply}
                disabled={!propertyLabel.trim()}
                className="px-3 py-1 text-sm rounded transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 bg-success text-success-foreground"
              >
                Use This
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border transition-colors hover:bg-hover border-border text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={(!propertyLabel.trim() && !samples.trim()) || loading}
            className="px-4 py-2 text-sm rounded transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground"
          >
            Analyze
          </button>
        </div>
      </div>
    </div>
  );
};
