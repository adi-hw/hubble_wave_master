import { RefreshCw } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';
import { cn } from '../../lib/utils';

interface UpdateNotificationProps {
  className?: string;
}

export function UpdateNotification({ className }: UpdateNotificationProps) {
  const { isUpdateAvailable, updateApp } = usePWA();

  if (!isUpdateAvailable) return null;

  return (
    <div
      className={cn(
        'fixed top-4 left-4 right-4 z-50',
        'md:left-auto md:right-6 md:max-w-sm',
        'bg-indigo-600 text-white rounded-xl shadow-2xl',
        'p-4 animate-slide-down',
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
          <RefreshCw className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Update Available</h3>
          <p className="text-sm text-indigo-100 mt-0.5">
            A new version of HubbleWave is ready.
          </p>
        </div>

        <button
          onClick={updateApp}
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm',
            'bg-white text-indigo-600 hover:bg-indigo-50',
            'transition-colors'
          )}
        >
          Update
        </button>
      </div>
    </div>
  );
}
