/**
 * AvaSuggestionsModal
 * HubbleWave Platform - Phase 3
 *
 * Modal for smart type detection using AVA to analyze sample data.
 */

import React, { useState } from 'react';
import { Sparkles, CheckCircle, Loader2, X } from 'lucide-react';
import { propertyApi } from '../../../services/propertyApi';

interface AvaSuggestionsModalProps {
  open: boolean;
  collectionId: string;
  onClose: () => void;
  onApply: (suggestion: { dataType: string; formatOptions?: Record<string, unknown> }) => void;
}

export const AvaSuggestionsModal: React.FC<AvaSuggestionsModalProps> = ({
  open,
  collectionId,
  onClose,
  onApply,
}) => {
  const [samples, setSamples] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    dataType: string;
    confidence: number;
    formatOptions?: Record<string, unknown>;
  } | null>(null);

  const handleAnalyze = async () => {
    if (!samples.trim()) return;

    setLoading(true);
    try {
      const sampleList = samples.split('\n').filter((s) => s.trim());
      const detection = await propertyApi.detectType(collectionId, sampleList);
      setResult(detection);
    } catch (error) {
      console.error('Failed to detect type', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply({
        dataType: result.dataType,
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
            Paste some sample data (one per line) and AVA will detect the best property type
            for you.
          </p>

          <textarea
            rows={6}
            placeholder={`e.g.\n$12,500\n$450.00\n$1,200`}
            value={samples}
            onChange={(e) => {
              setSamples(e.target.value);
              setResult(null);
            }}
            className="w-full px-3 py-2 rounded border text-sm font-mono resize-none bg-muted border-border text-foreground"
          />

          {loading && (
            <div className="flex justify-center p-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {result && (
            <div className="flex items-start gap-3 p-3 rounded border bg-success-subtle border-success-border">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-success-text" />
              <div className="flex-1">
                <p className="font-medium text-sm text-success-text">
                  Detected: <strong>{result.dataType}</strong>
                </p>
                <p className="text-xs text-success-text">
                  Confidence: {Math.round(result.confidence * 100)}%
                </p>
              </div>
              <button
                type="button"
                onClick={handleApply}
                className="px-3 py-1 text-sm rounded transition-colors hover:opacity-80 bg-success text-success-foreground"
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
            disabled={!samples.trim() || loading}
            className="px-4 py-2 text-sm rounded transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground"
          >
            Analyze
          </button>
        </div>
      </div>
    </div>
  );
};
