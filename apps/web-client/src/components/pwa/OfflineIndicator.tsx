import { WifiOff, Wifi } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';
import { cn } from '../../lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  showWhenOnline?: boolean;
}

export function OfflineIndicator({
  className,
  showWhenOnline = false,
}: OfflineIndicatorProps) {
  const { isOnline } = usePWA();

  if (isOnline && !showWhenOnline) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-2 px-4 py-2 rounded-full shadow-lg',
        'transition-all duration-300 ease-out',
        'md:bottom-6',
        isOnline
          ? 'bg-green-500/90 text-white'
          : 'bg-amber-500/90 text-white animate-pulse',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          <span className="text-sm font-medium">Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">You're offline</span>
        </>
      )}
    </div>
  );
}
