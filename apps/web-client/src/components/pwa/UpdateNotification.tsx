/**
 * UpdateNotification Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready PWA update notification with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly touch targets
 */

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
        'rounded-xl p-4 animate-slide-down',
        'bg-primary text-primary-foreground shadow-2xl',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-primary-foreground/20"
        >
          <RefreshCw className="w-5 h-5" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Update Available</h3>
          <p className="text-sm mt-0.5 opacity-90">
            A new version of HubbleWave is ready.
          </p>
        </div>

        <button
          onClick={updateApp}
          className="flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-colors min-h-[44px] bg-card text-primary hover:bg-muted"
        >
          Update
        </button>
      </div>
    </div>
  );
}
