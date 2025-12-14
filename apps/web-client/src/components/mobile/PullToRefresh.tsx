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
          '-top-16'
        )}
        style={{
          transform: `translateY(${pullDistance}px)`,
          opacity: isPulling || isRefreshing ? 1 : 0,
        }}
      >
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            'bg-white dark:bg-slate-800 shadow-lg',
            'border border-slate-200 dark:border-slate-700',
            canTriggerRefresh && !isRefreshing && 'border-indigo-500'
          )}
        >
          <RefreshCw
            className={cn(
              'w-5 h-5 text-slate-500 dark:text-slate-400',
              canTriggerRefresh && !isRefreshing && 'text-indigo-600',
              isRefreshing && 'animate-spin text-indigo-600'
            )}
            style={{
              transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
            }}
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
    </div>
  );
}
