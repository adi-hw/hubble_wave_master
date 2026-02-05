/**
 * Service Worker Registration
 *
 * Handles service worker lifecycle including:
 * - Registration
 * - Update detection
 * - Update prompts
 */

export interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Register the service worker
 */
export async function registerServiceWorker(
  config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) {
    // Service workers not supported in this browser
    return undefined;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });

    swRegistration = registration;

    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New update available - notify via callback
            config.onUpdate?.(registration);
          } else {
            // Content cached for offline use - notify via callback
            config.onSuccess?.(registration);
          }
        }
      };
    };

    return registration;
  } catch {
    // Service worker registration failed - app continues without SW
    return undefined;
  }
}

/**
 * Unregister all service workers
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
    return true;
  } catch {
    // Service worker unregistration failed
    return false;
  }
}

/**
 * Send a message to the service worker
 */
export function sendMessageToSW(message: Record<string, unknown>): void {
  if (swRegistration?.active) {
    swRegistration.active.postMessage(message);
  }
}

/**
 * Skip waiting and activate new service worker
 */
export function skipWaitingAndActivate(): void {
  sendMessageToSW({ type: 'SKIP_WAITING' });
  window.location.reload();
}

/**
 * Cache specific URLs
 */
export function cacheUrls(urls: string[]): void {
  sendMessageToSW({ type: 'CACHE_URLS', urls });
}

/**
 * Clear API cache
 */
export function clearApiCache(): void {
  sendMessageToSW({ type: 'CLEAR_CACHE' });
}

/**
 * Check if app is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Setup online/offline event listeners
 */
export function setupNetworkListeners(config: ServiceWorkerConfig): () => void {
  const handleOnline = () => {
    config.onOnline?.();
  };

  const handleOffline = () => {
    config.onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Request persistent storage (for important data)
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    return navigator.storage.persist();
  }
  return false;
}

/**
 * Get storage estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return null;
}
