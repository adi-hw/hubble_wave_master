/**
 * GlassButton - Glassmorphic Button Component
 *
 * A modern button with translucent effects and micro-animations.
 * Supports multiple variants: solid, glass, ghost, outline.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: 'solid' | 'glass' | 'ghost' | 'outline' | 'danger' | 'success' | 'accent';
  /** Button size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether it's an icon-only button */
  iconOnly?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Full width */
  fullWidth?: boolean;
}

const sizeClasses = {
  xs: 'h-7 px-2 text-xs gap-1',
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-base gap-2',
  xl: 'h-12 px-6 text-base gap-2.5',
};

const iconOnlySizes = {
  xs: 'h-7 w-7',
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
};

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      className,
      variant = 'solid',
      size = 'md',
      iconOnly = false,
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = cn(
      'inline-flex items-center justify-center font-medium rounded-lg',
      'transition-all duration-150 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:pointer-events-none',
      'active:scale-[0.98]',
      iconOnly ? iconOnlySizes[size] : sizeClasses[size],
      fullWidth && 'w-full'
    );

    const variantClasses = {
      solid: cn(
        'text-white shadow-sm',
        'bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-accent-500)]',
        'hover:from-[var(--color-primary-600)] hover:to-[var(--color-accent-600)]',
        'hover:shadow-[var(--shadow-primary)]',
        'focus-visible:ring-[var(--color-primary-500)]'
      ),
      glass: cn(
        'glass-surface',
        'border border-white/20 dark:border-white/10',
        'text-[var(--text-primary)]',
        'hover:bg-white/20 dark:hover:bg-white/10',
        'hover:border-white/30 dark:hover:border-white/15',
        'focus-visible:ring-[var(--color-primary-500)]'
      ),
      ghost: cn(
        'bg-transparent',
        'text-[var(--text-secondary)]',
        'hover:bg-[var(--bg-hover)]',
        'hover:text-[var(--text-primary)]',
        'focus-visible:ring-[var(--color-primary-500)]'
      ),
      outline: cn(
        'bg-transparent',
        'border border-[var(--border-primary)]',
        'text-[var(--text-brand)]',
        'hover:bg-[var(--bg-primary-subtle)]',
        'focus-visible:ring-[var(--color-primary-500)]'
      ),
      danger: cn(
        'text-white shadow-sm',
        'bg-[var(--bg-danger)]',
        'hover:bg-[var(--color-danger-600)]',
        'hover:shadow-[0_4px_14px_-3px_rgba(239,68,68,0.35)]',
        'focus-visible:ring-[var(--color-danger-500)]'
      ),
      success: cn(
        'text-white shadow-sm',
        'bg-[var(--bg-success)]',
        'hover:bg-[var(--color-success-600)]',
        'focus-visible:ring-[var(--color-success-500)]'
      ),
      accent: cn(
        'text-white shadow-sm',
        'bg-[var(--bg-accent)]',
        'hover:bg-[var(--bg-accent-hover)]',
        'hover:shadow-[var(--shadow-accent)]',
        'focus-visible:ring-[var(--color-accent-500)]'
      ),
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], className)}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {!iconOnly && children && <span className="opacity-0">{children}</span>}
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

GlassButton.displayName = 'GlassButton';

/**
 * IconButton - A specialized icon-only button
 */
export interface IconButtonProps extends Omit<GlassButtonProps, 'iconOnly' | 'leftIcon' | 'rightIcon'> {
  /** The icon to display */
  icon: React.ReactNode;
  /** Accessible label */
  'aria-label': string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, ...props }, ref) => {
    return (
      <GlassButton ref={ref} iconOnly className={className} {...props}>
        {icon}
      </GlassButton>
    );
  }
);

IconButton.displayName = 'IconButton';

export default GlassButton;
