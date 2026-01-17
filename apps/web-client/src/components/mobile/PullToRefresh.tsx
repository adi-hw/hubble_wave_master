/**
 * PullToRefresh Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready pull-to-refresh with:
 * - Theme-aware styling using CSS variables
 * - Mobile-optimized touch interactions
 */

import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { usePullToRefresh } from '../../hooks/useSwipe';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  threshold?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  threshold = 80,
}: PullToRefreshProps) {
  const { isPulling, pullDistance, isRefreshing, handlers, canTriggerRefresh } =
    usePullToRefresh({
      onRefresh,
      threshold,
    });

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 180;

  return (
    <div
      className={cn('relative', className)}
      {...handlers}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          'absolute left-0 right-0 flex justify-center items-center',
          'transition-transform duration-200',
          '-top-16',
          isPulling || isRefreshing ? 'opacity-100' : 'opacity-0'
        )}
        style={{ transform: `translateY(${pullDistance}px)` }}
        aria-hidden={!isPulling && !isRefreshing}
      >
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            'bg-card shadow-lg',
            canTriggerRefresh && !isRefreshing
              ? 'border-2 border-primary'
              : 'border border-border'
          )}
        >
          <RefreshCw
            className={cn(
              'w-5 h-5',
              isRefreshing && 'animate-spin',
              canTriggerRefresh || isRefreshing
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
            style={isRefreshing ? undefined : { transform: `rotate(${rotation}deg)` }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform:
            isPulling || isRefreshing ? `translateY(${pullDistance}px)` : undefined,
          transition:
            !isPulling && !isRefreshing ? 'transform 200ms ease-out' : undefined,
        }}
      >
        {children}
      </div>

      {/* Screen reader announcement */}
      {isRefreshing && (
        <div className="sr-only" role="status" aria-live="polite">
          Refreshing content...
        </div>
      )}
    </div>
  );
}
