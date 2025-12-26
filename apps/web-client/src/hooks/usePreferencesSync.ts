/**
 * usePreferencesSync hook
 *
 * Handles cross-device synchronization of user preferences.
 * Uses a unique device ID and version tracking to detect and sync changes.
 */

import { useEffect, useCallback, useRef } from 'react';
import { preferencesService, UserPreferences } from '../services/preferences.service';
import { getStoredToken } from '../services/token';

// ============================================================================
// Constants
// ============================================================================

const DEVICE_ID_KEY = 'hw-device-id';
const SYNC_INTERVAL = 60000; // 1 minute
const SYNC_ENABLED_KEY = 'hw-preferences-sync-enabled';

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate or retrieve a unique device ID
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate a unique device ID using crypto API if available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = crypto.randomUUID();
    } else {
      // Fallback for older browsers
      deviceId = 'device-' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

/**
 * Get device name for display purposes
 */
function getDeviceName(): string {
  const ua = navigator.userAgent;

  // Try to determine device type
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'iOS Device';
  } else if (/Android/.test(ua)) {
    return 'Android Device';
  } else if (/Windows/.test(ua)) {
    return 'Windows PC';
  } else if (/Macintosh|MacIntel|MacPPC|Mac68K/.test(ua)) {
    return 'Mac';
  } else if (/Linux/.test(ua)) {
    return 'Linux PC';
  }

  return 'Unknown Device';
}

// ============================================================================
// Types
// ============================================================================

interface SyncState {
  lastSyncedVersion: number | null;
  lastSyncedAt: Date | null;
  isSyncing: boolean;
  error: string | null;
}

interface UsePreferencesSyncOptions {
  enabled?: boolean;
  interval?: number;
  onSyncComplete?: (preferences: UserPreferences) => void;
  onSyncError?: (error: Error) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function usePreferencesSync(options: UsePreferencesSyncOptions = {}) {
  const {
    enabled = true,
    interval = SYNC_INTERVAL,
    onSyncComplete,
    onSyncError,
  } = options;

  const syncStateRef = useRef<SyncState>({
    lastSyncedVersion: null,
    lastSyncedAt: null,
    isSyncing: false,
    error: null,
  });

  const deviceId = getDeviceId();
  const deviceName = getDeviceName();

  /**
   * Check if there are new preferences on the server
   */
  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    const token = getStoredToken();
    if (!token) return false;

    try {
      const versionInfo = await preferencesService.getPreferenceVersion();
      const currentVersion = syncStateRef.current.lastSyncedVersion;

      return currentVersion !== null && versionInfo.version > currentVersion;
    } catch (err) {
      console.warn('Failed to check for preference updates:', err);
      return false;
    }
  }, []);

  /**
   * Sync preferences with the server
   */
  const syncPreferences = useCallback(async (): Promise<UserPreferences | null> => {
    const token = getStoredToken();
    if (!token) return null;

    if (syncStateRef.current.isSyncing) {
      return null;
    }

    syncStateRef.current.isSyncing = true;
    syncStateRef.current.error = null;

    try {
      const result = await preferencesService.syncPreferences(
        deviceId,
        syncStateRef.current.lastSyncedVersion ?? undefined
      );

      syncStateRef.current.lastSyncedVersion = result.currentVersion;
      syncStateRef.current.lastSyncedAt = new Date();

      if (result.hasChanges && onSyncComplete) {
        onSyncComplete(result.preferences);
      }

      return result.preferences;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sync failed');
      syncStateRef.current.error = error.message;

      if (onSyncError) {
        onSyncError(error);
      }

      return null;
    } finally {
      syncStateRef.current.isSyncing = false;
    }
  }, [deviceId, onSyncComplete, onSyncError]);

  /**
   * Force a full sync
   */
  const forceSync = useCallback(async () => {
    syncStateRef.current.lastSyncedVersion = null;
    return syncPreferences();
  }, [syncPreferences]);

  // Set up periodic sync
  useEffect(() => {
    if (!enabled) return;

    const token = getStoredToken();
    if (!token) return;

    // Initial sync
    syncPreferences();

    // Set up interval for periodic sync
    const intervalId = setInterval(() => {
      syncPreferences();
    }, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, interval, syncPreferences]);

  // Handle visibility change - sync when tab becomes visible
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Small delay to avoid race conditions
        setTimeout(() => {
          checkForUpdates().then((hasUpdates) => {
            if (hasUpdates) {
              syncPreferences();
            }
          });
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, checkForUpdates, syncPreferences]);

  // Handle online/offline events
  useEffect(() => {
    if (!enabled) return;

    const handleOnline = () => {
      // Sync when coming back online
      syncPreferences();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, syncPreferences]);

  return {
    deviceId,
    deviceName,
    syncPreferences,
    forceSync,
    checkForUpdates,
    getSyncState: () => ({ ...syncStateRef.current }),
  };
}

/**
 * Check if sync is enabled globally
 */
export function isSyncEnabled(): boolean {
  const stored = localStorage.getItem(SYNC_ENABLED_KEY);
  return stored !== 'false'; // Default to enabled
}

/**
 * Set sync enabled state
 */
export function setSyncEnabled(enabled: boolean): void {
  localStorage.setItem(SYNC_ENABLED_KEY, String(enabled));
}

/**
 * Get device information
 */
export function getDeviceInfo() {
  return {
    id: getDeviceId(),
    name: getDeviceName(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    online: navigator.onLine,
  };
}
