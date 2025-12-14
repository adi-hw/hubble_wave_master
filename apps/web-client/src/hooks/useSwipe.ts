import { useState, useCallback, useRef, TouchEvent } from 'react';

interface SwipeState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

interface SwipeOptions {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export function useSwipe(options: SwipeOptions = {}): SwipeHandlers {
  const {
    threshold = 50,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
  } = options;

  const swipeRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });

  const onTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    swipeRef.current.startX = touch.clientX;
    swipeRef.current.startY = touch.clientY;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    swipeRef.current.endX = touch.clientX;
    swipeRef.current.endY = touch.clientY;
  }, []);

  const onTouchEnd = useCallback(() => {
    const { startX, startY, endX, endY } = swipeRef.current;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine if this is a horizontal or vertical swipe
    if (absX > absY && absX > threshold) {
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    } else if (absY > absX && absY > threshold) {
      if (deltaY > 0) {
        onSwipeDown?.();
      } else {
        onSwipeUp?.();
      }
    }

    // Reset
    swipeRef.current = { startX: 0, startY: 0, endX: 0, endY: 0 };
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

// Hook for pull-to-refresh functionality
interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

interface PullToRefreshState {
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
}

export function usePullToRefresh(options: PullToRefreshOptions) {
  const { onRefresh, threshold = 80, maxPull = 120 } = options;

  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
  });

  const startY = useRef(0);
  const canPull = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    // Only enable pull-to-refresh when at top of scroll
    const scrollTop =
      document.documentElement.scrollTop || document.body.scrollTop;
    canPull.current = scrollTop === 0;

    if (canPull.current) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!canPull.current || state.isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0) {
        // Pulling down
        const pullDistance = Math.min(diff * 0.5, maxPull);
        setState((prev) => ({ ...prev, isPulling: true, pullDistance }));

        // Prevent default scrolling while pulling
        if (diff > 10) {
          e.preventDefault();
        }
      }
    },
    [maxPull, state.isRefreshing]
  );

  const onTouchEnd = useCallback(async () => {
    if (!state.isPulling) return;

    if (state.pullDistance >= threshold) {
      setState((prev) => ({ ...prev, isRefreshing: true, pullDistance: 60 }));

      try {
        await onRefresh();
      } finally {
        setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
      }
    } else {
      setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
    }
  }, [state.isPulling, state.pullDistance, threshold, onRefresh]);

  return {
    ...state,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    canTriggerRefresh: state.pullDistance >= threshold,
  };
}
