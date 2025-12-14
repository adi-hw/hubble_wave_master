import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isOnline: navigator.onLine,
    isUpdateAvailable: false,
    installPrompt: null,
  });

  // Check if app is installed (standalone mode)
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    setState((prev) => ({ ...prev, isInstalled: isStandalone }));
  }, []);

  // Handle install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setState((prev) => ({
        ...prev,
        isInstallable: true,
        installPrompt: e as BeforeInstallPromptEvent,
      }));
    };

    const handleAppInstalled = () => {
      setState((prev) => ({
        ...prev,
        isInstallable: false,
        isInstalled: true,
        installPrompt: null,
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () =>
      setState((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () =>
      setState((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle service worker updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                setState((prev) => ({ ...prev, isUpdateAvailable: true }));
              }
            });
          }
        });
      });
    }
  }, []);

  const promptInstall = useCallback(async () => {
    if (!state.installPrompt) return false;

    try {
      await state.installPrompt.prompt();
      const { outcome } = await state.installPrompt.userChoice;

      if (outcome === 'accepted') {
        setState((prev) => ({
          ...prev,
          isInstallable: false,
          installPrompt: null,
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [state.installPrompt]);

  const updateApp = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
  }, []);

  return {
    ...state,
    promptInstall,
    updateApp,
  };
}

export type { BeforeInstallPromptEvent, PWAState };
