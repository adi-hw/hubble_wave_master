/**
 * AvaFeedbackButton - Quick Feedback Component
 * HubbleWave Platform - Phase 6
 *
 * Floating button for quick AVA feedback collection.
 */

import React, { useState } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  X,
  Send,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassButton } from '../../components/ui/glass/GlassButton';

type FeedbackType = 'positive' | 'negative' | null;

interface AvaFeedbackButtonProps {
  /** The message or suggestion ID to provide feedback for */
  targetId: string;
  /** Type of target (message, suggestion, prediction) */
  targetType: 'message' | 'suggestion' | 'prediction';
  /** Current user's context */
  context?: Record<string, unknown>;
  /** Callback after feedback is submitted */
  onSubmit?: (feedback: { type: FeedbackType; comment?: string }) => void;
  /** Custom CSS classes */
  className?: string;
  /** Compact mode (icons only) */
  compact?: boolean;
  /** Show comment form option */
  allowComment?: boolean;
}

export const AvaFeedbackButton: React.FC<AvaFeedbackButtonProps> = ({
  targetId,
  targetType,
  context,
  onSubmit,
  className,
  compact = false,
  allowComment = true,
}) => {
  const [selectedType, setSelectedType] = useState<FeedbackType>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleFeedback = async (type: FeedbackType) => {
    if (submitted) return;
    setSelectedType(type);

    if (!allowComment || type === 'positive') {
      await submitFeedback(type);
    } else {
      setShowComment(true);
    }
  };

  const submitFeedback = async (type: FeedbackType, feedbackComment?: string) => {
    setIsSubmitting(true);
    try {
      await fetch('/api/ava/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId,
          targetType,
          feedbackType: type,
          comment: feedbackComment,
          context,
        }),
      });

      setSubmitted(true);
      if (onSubmit) {
        onSubmit({ type, comment: feedbackComment });
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setIsSubmitting(false);
      setShowComment(false);
    }
  };

  const handleSubmitWithComment = () => {
    submitFeedback(selectedType, comment);
  };

  if (submitted) {
    return (
      <div
        className={cn('inline-flex items-center gap-1.5 text-xs text-success-text', className)}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  if (showComment) {
    return (
      <div
        className={cn(
          'p-3 rounded-lg',
          'border border-[var(--border-default)]',
          'bg-[var(--bg-surface)]',
          className
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground">
            What could be better?
          </span>
          <button
            onClick={() => {
              setShowComment(false);
              setSelectedType(null);
            }}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional feedback..."
          className={cn(
            'w-full px-2 py-1.5 rounded text-sm resize-none text-foreground',
            'bg-[var(--bg-surface-secondary)]',
            'border border-[var(--border-default)]',
            'focus:outline-none focus:border-[var(--border-primary)]'
          )}
          rows={2}
        />
        <div className="flex items-center justify-end gap-2 mt-2">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => submitFeedback(selectedType)}
            disabled={isSubmitting}
          >
            Skip
          </GlassButton>
          <GlassButton
            variant="solid"
            size="sm"
            onClick={handleSubmitWithComment}
            disabled={isSubmitting}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            Submit
          </GlassButton>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn('inline-flex items-center gap-1', className)}>
        <button
          onClick={() => handleFeedback('positive')}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            selectedType === 'positive'
              ? 'bg-[var(--bg-success-subtle)] text-[var(--text-success)]'
              : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'
          )}
          disabled={isSubmitting}
          aria-label="Helpful"
        >
          <ThumbsUp className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleFeedback('negative')}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            selectedType === 'negative'
              ? 'bg-[var(--bg-danger-subtle)] text-[var(--text-danger)]'
              : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'
          )}
          disabled={isSubmitting}
          aria-label="Not helpful"
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 p-2 rounded-lg',
        'border border-[var(--border-subtle)]',
        'bg-[var(--bg-surface-secondary)]',
        className
      )}
    >
      <span className="text-xs text-muted-foreground">
        Was this helpful?
      </span>
      <button
        onClick={() => handleFeedback('positive')}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
          selectedType === 'positive'
            ? 'bg-[var(--bg-success-subtle)] text-[var(--text-success)]'
            : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
        )}
        disabled={isSubmitting}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        Yes
      </button>
      <button
        onClick={() => handleFeedback('negative')}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
          selectedType === 'negative'
            ? 'bg-[var(--bg-danger-subtle)] text-[var(--text-danger)]'
            : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
        )}
        disabled={isSubmitting}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        No
      </button>
      {allowComment && (
        <button
          onClick={() => setShowComment(true)}
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-muted-foreground"
          aria-label="Add comment"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default AvaFeedbackButton;
