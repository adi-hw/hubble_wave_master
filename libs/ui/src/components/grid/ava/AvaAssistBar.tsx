/**
 * AvaAssistBar - Displays AVA insights and quick actions above the grid
 *
 * Features:
 * - Animated entrance/exit
 * - Priority-based insight ordering
 * - Quick action buttons
 * - Dismissible with memory
 * - Glassmorphic 2070 aesthetic
 */

import { memo } from 'react';
import { cn } from '../utils/cn';
import type { AvaInsight, AvaAction, AvaGridCommand } from '../types';

// =============================================================================
// INSIGHT ICONS
// =============================================================================

const SparklesIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0L9.5 5.5L15 7L9.5 8.5L8 14L6.5 8.5L1 7L6.5 5.5L8 0Z" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1L15 14H1L8 1ZM8 5V9M8 11V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </svg>
);

const LightbulbIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1C5.239 1 3 3.239 3 6C3 8.063 4.336 9.826 6.2 10.543V12H9.8V10.543C11.664 9.826 13 8.063 13 6C13 3.239 10.761 1 8 1ZM6 13V14H10V13H6Z" />
  </svg>
);

const ZapIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
    <path d="M9 1L3 9H8L7 15L13 7H8L9 1Z" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 4L12 12M12 4L4 12" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2L8 6L4 10" />
  </svg>
);

// =============================================================================
// ACTION BUTTON
// =============================================================================

interface ActionButtonProps {
  action: AvaAction;
  onAction: (command: AvaGridCommand) => void;
}

const ActionButton = memo(function ActionButton({ action, onAction }: ActionButtonProps) {
  const handleClick = () => {
    onAction(action.command);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-1 px-3 py-1.5 rounded-lg',
        'text-xs font-medium transition-all duration-150',
        action.variant === 'primary'
          ? 'bg-[var(--primary-500)] text-white hover:bg-[var(--primary-600)]'
          : action.variant === 'danger'
          ? 'bg-[var(--priority-critical)]/10 text-[var(--priority-critical)] hover:bg-[var(--priority-critical)]/20'
          : 'bg-[var(--grid-ava-action-bg)] text-[var(--grid-ava-text-color)] hover:bg-[var(--grid-ava-action-hover)]'
      )}
    >
      {action.label}
      <ChevronRightIcon />
    </button>
  );
});

// =============================================================================
// INSIGHT ICON
// =============================================================================

function getInsightIcon(type: AvaInsight['type']) {
  switch (type) {
    case 'warning':
      return <AlertTriangleIcon />;
    case 'suggestion':
      return <LightbulbIcon />;
    case 'action':
      return <ZapIcon />;
    default:
      return <SparklesIcon />;
  }
}

// =============================================================================
// AVA ASSIST BAR
// =============================================================================

interface AvaAssistBarProps {
  insights: AvaInsight[];
  onAction: (command: AvaGridCommand) => void;
  onDismiss: (insightId: string) => void;
  className?: string;
}

export const AvaAssistBar = memo(function AvaAssistBar({
  insights,
  onAction,
  onDismiss,
  className,
}: AvaAssistBarProps) {
  // Show highest priority insight
  const activeInsight = insights[0];

  if (!activeInsight) return null;

  const InsightIcon = getInsightIcon(activeInsight.type);

  return (
    <div
      className={cn(
        'overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-4 px-4 py-3',
          'bg-[var(--grid-ava-bar-bg)]',
          'border-b border-[var(--grid-ava-bar-border)]'
        )}
        style={{
          boxShadow: 'var(--grid-ava-glow)',
        }}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 p-2 rounded-lg',
            'bg-[var(--grid-ava-action-bg)]',
            'text-[var(--grid-ava-text-color)]'
          )}
        >
          {InsightIcon}
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--grid-ava-text-color)] truncate">
            {activeInsight.message}
          </p>
        </div>

        {/* Actions */}
        {activeInsight.actions && activeInsight.actions.length > 0 && (
          <div className="flex items-center gap-2">
            {activeInsight.actions.map((action) => (
              <ActionButton key={action.id} action={action} onAction={onAction} />
            ))}
          </div>
        )}

        {/* Dismiss */}
        <button
          onClick={() => onDismiss(activeInsight.id)}
          className={cn(
            'flex-shrink-0 p-1.5 rounded-lg',
            'text-[var(--grid-ava-text-color)] opacity-60',
            'hover:opacity-100 hover:bg-[var(--grid-ava-action-bg)]',
            'transition-all duration-150'
          )}
          aria-label="Dismiss insight"
        >
          <XIcon />
        </button>

        {/* Insight count indicator */}
        {insights.length > 1 && (
          <div className="flex-shrink-0 text-xs text-[var(--grid-ava-text-color)] opacity-60">
            +{insights.length - 1} more
          </div>
        )}
      </div>
    </div>
  );
});
