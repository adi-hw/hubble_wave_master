/**
 * Grid Overlay Components
 *
 * - LoadingOverlay: Full grid loading state
 * - EmptyState: No data message
 * - ErrorState: Error display with retry
 */

import React, { memo } from 'react';
import { cn } from '../utils/cn';

// =============================================================================
// LOADING OVERLAY
// =============================================================================

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export const LoadingOverlay = memo(function LoadingOverlay({
  message = 'Loading data...',
  className,
}: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-8',
        className
      )}
    >
      {/* Spinner */}
      <div className="relative w-12 h-12 mb-4">
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            'border-2 border-[var(--glass-border)]'
          )}
        />
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            'border-2 border-transparent border-t-[var(--primary-400)]',
            'animate-spin'
          )}
        />
      </div>

      {/* Message */}
      <p className="text-sm text-[var(--grid-cell-muted-color)]">{message}</p>
    </div>
  );
});

// =============================================================================
// SKELETON ROWS
// =============================================================================

interface SkeletonRowsProps {
  count?: number;
  columns?: number;
  className?: string;
}

export const SkeletonRows = memo(function SkeletonRows({
  count = 10,
  columns = 5,
  className,
}: SkeletonRowsProps) {
  return (
    <div className={cn('space-y-0', className)}>
      {Array.from({ length: count }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            'flex items-center h-12',
            'border-b border-[var(--grid-cell-border)]',
            'animate-pulse'
          )}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="flex-1 flex items-center px-4"
            >
              <div
                className={cn(
                  'h-4 rounded',
                  'bg-[var(--glass-bg)]',
                  colIndex === 0 ? 'w-24' : colIndex === 1 ? 'w-32' : 'w-20'
                )}
                style={{
                  animationDelay: `${(rowIndex * columns + colIndex) * 50}ms`,
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  message?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState = memo(function EmptyState({
  message = 'No records found',
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-8',
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-16 h-16 mb-4 rounded-full',
          'bg-[var(--glass-bg)] flex items-center justify-center',
          'text-[var(--grid-cell-muted-color)]'
        )}
      >
        {icon ?? (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-4" />
            <path d="M12 12v9" />
            <path d="M9 18l3 3 3-3" />
          </svg>
        )}
      </div>

      {/* Message */}
      <h3 className="text-lg font-medium text-[var(--grid-cell-color)] mb-1">
        {message}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-[var(--grid-cell-muted-color)] text-center max-w-md mb-4">
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'px-4 py-2 rounded-lg',
            'bg-[var(--primary-500)] text-white',
            'text-sm font-medium',
            'hover:bg-[var(--primary-600)]',
            'transition-colors'
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
});

// =============================================================================
// ERROR STATE
// =============================================================================

interface ErrorStateProps {
  error?: Error | string | null;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState = memo(function ErrorState({
  error,
  message = 'Failed to load data',
  onRetry,
  className,
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-8',
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-16 h-16 mb-4 rounded-full',
          'bg-[var(--priority-critical)]/10 flex items-center justify-center',
          'text-[var(--priority-critical)]'
        )}
      >
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <circle cx="12" cy="16" r="1" fill="currentColor" />
        </svg>
      </div>

      {/* Message */}
      <h3 className="text-lg font-medium text-[var(--grid-cell-color)] mb-1">
        {message}
      </h3>

      {/* Error details */}
      {errorMessage && (
        <p className="text-sm text-[var(--grid-cell-muted-color)] text-center max-w-md mb-4">
          {errorMessage}
        </p>
      )}

      {/* Retry button */}
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-[var(--glass-bg)] border border-[var(--glass-border)]',
            'text-sm font-medium text-[var(--grid-cell-color)]',
            'hover:bg-[var(--glass-bg-hover)]',
            'transition-colors'
          )}
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 8C2 4.68629 4.68629 2 8 2C10.3304 2 12.3445 3.36474 13.2891 5.33333" />
            <path d="M14 8C14 11.3137 11.3137 14 8 14C5.66963 14 3.65551 12.6353 2.71094 10.6667" />
            <path d="M14 2V5.33333H10.6667" />
            <path d="M2 14V10.6667H5.33333" />
          </svg>
          Try Again
        </button>
      )}
    </div>
  );
});

// =============================================================================
// COLUMN RESIZE INDICATOR
// =============================================================================

interface ColumnResizeIndicatorProps {
  isResizing: boolean;
  left: number;
  height: number;
}

export const ColumnResizeIndicator = memo(function ColumnResizeIndicator({
  isResizing,
  left,
  height,
}: ColumnResizeIndicatorProps) {
  if (!isResizing) return null;

  return (
    <div
      className={cn(
        'absolute top-0 w-0.5',
        'bg-[var(--grid-resize-handle)]',
        'pointer-events-none z-50'
      )}
      style={{
        left,
        height,
      }}
    />
  );
});
