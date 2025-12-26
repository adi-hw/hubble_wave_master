/**
 * GlassBadge - Glassmorphic Badge Component
 *
 * A modern badge with translucent effects for status indicators.
 */

import React from 'react';
import { cn } from '../../../lib/utils';

export interface GlassBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Badge variant */
  variant?: 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** Badge style */
  styleType?: 'subtle' | 'solid' | 'outline' | 'dot';
  /** Badge size */
  size?: 'sm' | 'md' | 'lg';
  /** Optional icon */
  icon?: React.ReactNode;
  /** Whether the badge is removable */
  removable?: boolean;
  /** Callback when remove is clicked */
  onRemove?: () => void;
}

const sizeClasses = {
  sm: 'h-5 px-1.5 text-[10px] gap-0.5',
  md: 'h-[22px] px-2 text-xs gap-1',
  lg: 'h-6 px-2.5 text-sm gap-1.5',
};

const variantStyles = {
  primary: {
    subtle: 'bg-[var(--bg-primary-subtle)] text-[var(--text-brand)]',
    solid: 'bg-[var(--bg-primary)] text-white',
    outline: 'border border-[var(--border-primary)] text-[var(--text-brand)]',
    dot: 'bg-[var(--bg-primary)]',
  },
  accent: {
    subtle: 'bg-[var(--bg-accent-subtle)] text-[var(--text-accent)]',
    solid: 'bg-[var(--bg-accent)] text-white',
    outline: 'border border-[var(--border-accent)] text-[var(--text-accent)]',
    dot: 'bg-[var(--bg-accent)]',
  },
  success: {
    subtle: 'bg-[var(--bg-success-subtle)] text-[var(--text-success)]',
    solid: 'bg-[var(--bg-success)] text-white',
    outline: 'border border-[var(--border-success)] text-[var(--text-success)]',
    dot: 'bg-[var(--bg-success)]',
  },
  warning: {
    subtle: 'bg-[var(--bg-warning-subtle)] text-[var(--text-warning)]',
    solid: 'bg-[var(--bg-warning)] text-white',
    outline: 'border border-[var(--border-warning)] text-[var(--text-warning)]',
    dot: 'bg-[var(--bg-warning)]',
  },
  danger: {
    subtle: 'bg-[var(--bg-danger-subtle)] text-[var(--text-danger)]',
    solid: 'bg-[var(--bg-danger)] text-white',
    outline: 'border border-[var(--border-danger)] text-[var(--text-danger)]',
    dot: 'bg-[var(--bg-danger)]',
  },
  info: {
    subtle: 'bg-[var(--bg-info-subtle)] text-[var(--text-info)]',
    solid: 'bg-[var(--bg-info)] text-white',
    outline: 'border border-[var(--border-info)] text-[var(--text-info)]',
    dot: 'bg-[var(--bg-info)]',
  },
  neutral: {
    subtle: 'bg-[var(--bg-surface-secondary)] text-[var(--text-tertiary)]',
    solid: 'bg-[var(--color-neutral-500)] text-white',
    outline: 'border border-[var(--border-default)] text-[var(--text-tertiary)]',
    dot: 'bg-[var(--color-neutral-400)]',
  },
};

export const GlassBadge: React.FC<GlassBadgeProps> = ({
  className,
  variant = 'primary',
  styleType = 'subtle',
  size = 'md',
  icon,
  removable = false,
  onRemove,
  children,
  ...props
}) => {
  if (styleType === 'dot') {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5', className)}
        {...props}
      >
        <span
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            variantStyles[variant].dot
          )}
        />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {children}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        sizeClasses[size],
        variantStyles[variant][styleType],
        className
      )}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      {removable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="flex-shrink-0 -mr-0.5 ml-0.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Remove"
        >
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 3L9 9M9 3L3 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
};

/**
 * NotificationBadge - A badge for notification counts
 */
export interface NotificationBadgeProps {
  count: number;
  max?: number;
  showZero?: boolean;
  className?: string;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  max = 99,
  showZero = false,
  className,
}) => {
  if (count === 0 && !showZero) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5',
        'text-[10px] font-bold rounded-full',
        'bg-[var(--bg-danger)] text-white',
        className
      )}
    >
      {displayCount}
    </span>
  );
};

/**
 * StatusBadge - A badge for status indicators
 */
export interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'away' | 'idle';
  label?: string;
  showLabel?: boolean;
}

const statusConfig = {
  online: { color: 'bg-[var(--bg-success)]', label: 'Online' },
  offline: { color: 'bg-[var(--color-neutral-400)]', label: 'Offline' },
  busy: { color: 'bg-[var(--bg-danger)]', label: 'Busy' },
  away: { color: 'bg-[var(--bg-warning)]', label: 'Away' },
  idle: { color: 'bg-[var(--color-neutral-400)]', label: 'Idle' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showLabel = true,
}) => {
  const config = statusConfig[status];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full', config.color)} />
      {showLabel && (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {label || config.label}
        </span>
      )}
    </span>
  );
};

export default GlassBadge;
