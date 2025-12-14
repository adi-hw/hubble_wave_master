import { useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
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

  const handleInstall = async () => {
    setIsInstalling(true);
    const success = await promptInstall();
    setIsInstalling(false);
    if (!success) {
      // User declined, dismiss for this session
      setIsDismissed(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Store in session storage so it doesn't show again this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 right-4 z-50',
        'md:left-auto md:right-6 md:bottom-6 md:max-w-sm',
        'bg-white dark:bg-slate-800 rounded-xl shadow-2xl',
        'border border-slate-200 dark:border-slate-700',
        'p-4 animate-slide-up',
        className
      )}
      role="alert"
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Install HubbleWave
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Add to your home screen for quick access and offline support.
          </p>

          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className={cn(
              'mt-3 w-full flex items-center justify-center gap-2',
              'px-4 py-2 rounded-lg font-medium text-sm',
              'bg-indigo-600 text-white hover:bg-indigo-700',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            <Download className="w-4 h-4" />
            {isInstalling ? 'Installing...' : 'Install App'}
          </button>
        </div>
      </div>
    </div>
  );
}
