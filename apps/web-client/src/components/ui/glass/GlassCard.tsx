/**
 * GlassCard - Glassmorphic Card Component
 *
 * A translucent card with backdrop blur effect for the 2070 design system.
 * Supports multiple variants: default, elevated, interactive, and stat.
 */

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../../lib/utils';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  /** Card variant */
  variant?: 'default' | 'elevated' | 'interactive' | 'stat' | 'subtle';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Whether the card has a border */
  bordered?: boolean;
  /** Whether the card is selected */
  selected?: boolean;
  /** Whether the card is disabled */
  disabled?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className,
      variant = 'default',
      padding = 'md',
      bordered = true,
      selected = false,
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = cn(
      'glass-card relative rounded-xl transition-all duration-200',
      paddingClasses[padding],
      disabled && 'opacity-50 pointer-events-none'
    );

    const variantClasses = {
      default: cn(
        'glass-surface',
        bordered && 'border border-border/30'
      ),
      elevated: cn(
        'glass-surface-elevated shadow-lg',
        bordered && 'border border-border/40'
      ),
      interactive: cn(
        'glass-surface cursor-pointer hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]',
        bordered && 'border border-border/30 hover:border-border/60'
      ),
      stat: cn(
        'glass-surface',
        bordered && 'border border-border/30'
      ),
      subtle: cn(
        'bg-transparent',
        bordered && 'border border-border/20'
      ),
    };

    const selectedClasses = selected
      ? 'ring-2 ring-primary border-primary'
      : '';

    return (
      <motion.div
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], selectedClasses, className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

/**
 * StatCard - A specialized card for displaying statistics
 */
export interface StatCardProps extends Omit<GlassCardProps, 'children' | 'variant'> {
  /** The main value to display */
  value: string | number;
  /** The label for the stat */
  label: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Trend indicator */
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  /** Loading state */
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  icon,
  trend,
  loading = false,
  className,
  ...props
}) => {
  const trendColors = {
    up: 'text-success-text',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  return (
    <GlassCard variant="stat" className={cn('min-w-[140px]', className)} {...props}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <div className="h-8 w-20 mt-1 rounded bg-muted animate-pulse" />
          ) : (
            <p className="text-2xl font-bold mt-1 text-foreground">
              {value}
            </p>
          )}
          {trend && !loading && (
            <p className={cn('text-xs font-medium mt-1', trendColors[trend.direction])}>
              {trendIcons[trend.direction]} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

/**
 * ActionCard - A card with a primary action
 */
export interface ActionCardProps extends Omit<GlassCardProps, 'children' | 'variant'> {
  /** Card title */
  title: string;
  /** Card description */
  description?: string;
  /** Icon */
  icon?: React.ReactNode;
  /** Action button text */
  actionText?: string;
  /** Action callback */
  onAction?: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon,
  actionText,
  onAction,
  className,
  ...props
}) => {
  return (
    <GlassCard
      variant="interactive"
      className={cn('group', className)}
      onClick={onAction}
      {...props}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="p-3 rounded-xl transition-colors group-hover:scale-105 bg-gradient-to-br from-primary/20 to-primary/5">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold truncate text-foreground">
            {title}
          </h4>
          {description && (
            <p className="text-sm mt-0.5 line-clamp-2 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actionText && (
          <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity text-primary">
            {actionText} →
          </span>
        )}
      </div>
    </GlassCard>
  );
};

export default GlassCard;
