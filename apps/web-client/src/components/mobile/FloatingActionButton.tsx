/**
 * FloatingActionButton Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready FAB with:
 * - Theme-aware styling using Tailwind CSS
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly touch targets (min 48px)
 */

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface FloatingActionButtonProps {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  className?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
}

export function FloatingActionButton({
  onClick,
  icon,
  label,
  className,
  variant = 'primary',
  size = 'md',
  position = 'bottom-right',
}: FloatingActionButtonProps) {
  const positionClasses = {
    'bottom-right': 'right-4 bottom-24 md:bottom-6',
    'bottom-center': 'left-1/2 -translate-x-1/2 bottom-24 md:bottom-6',
    'bottom-left': 'left-4 bottom-24 md:bottom-6',
  };

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  const iconSizeClasses = {
    sm: '[&>svg]:w-5 [&>svg]:h-5',
    md: '[&>svg]:w-6 [&>svg]:h-6',
    lg: '[&>svg]:w-7 [&>svg]:h-7',
  };

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg focus:ring-primary',
    secondary: 'bg-card text-foreground border border-border hover:bg-muted shadow-lg focus:ring-primary',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed z-30',
        positionClasses[position],
        sizeClasses[size],
        iconSizeClasses[size],
        variantClasses[variant],
        'rounded-full',
        'flex items-center justify-center',
        'transition-all duration-200',
        'active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
        className
      )}
      aria-label={label}
    >
      {icon}
    </button>
  );
}
