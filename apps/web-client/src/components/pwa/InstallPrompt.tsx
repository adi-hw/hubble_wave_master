/**
 * InstallPrompt Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready PWA install prompt with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly touch targets
 */

import { useState, useCallback } from 'react';
import { Download, X, Smartphone, Loader2 } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';
import { cn } from '../../lib/utils';

interface InstallPromptProps {
  className?: string;
}

export function InstallPrompt({ className }: InstallPromptProps) {
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Don't show if already installed, not installable, or dismissed
  if (isInstalled || !isInstallable || isDismissed) return null;

  const handleInstall = useCallback(async () => {
    setIsInstalling(true);
    const success = await promptInstall();
    setIsInstalling(false);
    if (!success) {
      // User declined, dismiss for this session
      setIsDismissed(true);
    }
  }, [promptInstall]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    // Store in session storage so it doesn't show again this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  }, []);

  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 right-4 z-50',
        'md:left-auto md:right-6 md:bottom-6 md:max-w-sm',
        'rounded-xl p-4 animate-slide-up',
        'bg-card border border-border shadow-2xl',
        className
      )}
      role="alert"
      aria-labelledby="install-prompt-title"
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-2 rounded-full transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center text-muted-foreground hover:bg-muted"
        aria-label="Dismiss install prompt"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
          <Smartphone
            className="w-6 h-6 text-primary"
            aria-hidden="true"
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3
            id="install-prompt-title"
            className="font-semibold text-foreground"
          >
            Install HubbleWave
          </h3>
          <p className="text-sm mt-0.5 text-muted-foreground">
            Add to your home screen for quick access and offline support.
          </p>

          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className={cn(
              'mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors min-h-[44px]',
              isInstalling
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90'
            )}
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Installing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" aria-hidden="true" />
                Install App
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
