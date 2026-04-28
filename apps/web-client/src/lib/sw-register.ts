/**
 * Service Worker Messaging
 *
 * The service worker itself is registered by VitePWA via `virtual:pwa-register`.
 * This module exposes message and lifecycle helpers used by the app shell —
 * notably `sendMessageToSW` which the auth flow uses to post CLEAR_USER_CACHE
 * on logout.
 */

export interface ServiceWorkerConfig {
  onOffline?: () => void;
  onOnline?: () => void;
}

/**
 * Send a message to the active service worker. Resolves to no-op when no SW
 * controls the page (e.g. first load before activation, browser without SW).
 */
export function sendMessageToSW(message: Record<string, unknown>): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  const controller = navigator.serviceWorker.controller;
  if (controller) {
    controller.postMessage(message);
  }
}

/**
 * Ask the waiting worker to skip waiting and reload the page so the new
 * version takes over.
 */
export function skipWaitingAndActivate(): void {
  sendMessageToSW({ type: 'SKIP_WAITING' });
  window.location.reload();
}

/**
 * Clear the API cache. Used by manual "refresh data" actions.
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
