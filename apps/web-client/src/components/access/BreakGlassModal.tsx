/**
 * BreakGlassModal Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready emergency access modal with:
 * - Theme-aware styling using Tailwind CSS
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 * - Proper focus management
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { accessApi } from '../../services/accessApi';
import { AlertTriangle, X, Loader2, Shield } from 'lucide-react';

interface BreakGlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  collectionId: string;
  recordId?: string;
}

export const BreakGlassModal: React.FC<BreakGlassModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  collectionId,
  recordId,
}) => {
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, loading, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (justification.length < 10) {
        setError('Justification must be at least 10 characters.');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        await accessApi.requestBreakGlass(
          collectionId,
          'emergency',
          justification,
          recordId
        );
        onSuccess();
        onClose();
      } catch (err: any) {
        console.error('Break glass failed', err);
        setError(err.response?.data?.message || 'Failed to request access.');
      } finally {
        setLoading(false);
      }
    },
    [justification, collectionId, recordId, onSuccess, onClose]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !loading) {
        onClose();
      }
    },
    [loading, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/50"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-xl shadow-xl bg-card border border-border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="break-glass-title"
        aria-describedby="break-glass-description"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-destructive/10 border-b border-border rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive">
              <Shield
                className="w-5 h-5 text-destructive-foreground"
                aria-hidden="true"
              />
            </div>
            <h2
              id="break-glass-title"
              className="text-lg font-bold text-destructive"
            >
              Emergency Access Required
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-muted ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-3 p-3 rounded-lg mb-4 bg-warning-subtle border border-warning-border">
            <AlertTriangle
              className="w-5 h-5 flex-shrink-0 mt-0.5 text-warning-text"
              aria-hidden="true"
            />
            <p
              id="break-glass-description"
              className="text-sm text-foreground"
            >
              You are attempting to access protected information. This action will be
              audited and logged. Please provide a justification for this emergency
              access ("Break Glass").
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                className="block text-sm font-medium mb-2 text-muted-foreground"
                htmlFor="justification-input"
              >
                Justification{' '}
                <span className="text-destructive" aria-label="required">
                  *
                </span>
              </label>
              <textarea
                ref={textareaRef}
                id="justification-input"
                className={`w-full h-24 p-3 rounded-lg text-sm transition-colors bg-card text-foreground border outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  error ? 'border-destructive' : 'border-border'
                }`}
                placeholder="Explain why you need access to this data..."
                value={justification}
                onChange={(e) => {
                  setJustification(e.target.value);
                  if (error && e.target.value.length >= 10) {
                    setError(null);
                  }
                }}
                required
                aria-invalid={!!error}
                aria-describedby={error ? 'justification-error' : undefined}
              />
              {error && (
                <p
                  id="justification-error"
                  className="mt-1 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors min-h-[44px] bg-transparent text-foreground border border-border hover:bg-muted ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors min-h-[44px] flex items-center gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 ${
                  loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Requesting...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" aria-hidden="true" />
                    Break Glass & Access
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
