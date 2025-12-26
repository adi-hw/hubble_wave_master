import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  preferencesService,
  UserPreferences,
  UpdateUserPreferencesDto,
  PinnedNavigationItem,
  AddPinnedItemDto,
  DensityMode,
  SidebarPosition,
  defaultPreferences,
} from '../services/preferences.service';
import { getStoredToken } from '../services/token';

// ============================================================================
// Context Types
// ============================================================================

interface UserPreferencesContextValue {
  preferences: UserPreferences | null;
  loading: boolean;
  error: string | null;
  // Main preference operations
  updatePreferences: (dto: UpdateUserPreferencesDto) => Promise<void>;
  patchPreferences: (dto: Partial<UpdateUserPreferencesDto>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  // Pinned navigation
  pinnedItems: PinnedNavigationItem[];
  addPinnedItem: (dto: AddPinnedItemDto) => Promise<void>;
  updatePinnedItem: (itemId: string, dto: { label?: string; icon?: string; position?: number }) => Promise<void>;
  removePinnedItem: (itemId: string) => Promise<void>;
  reorderPinnedItems: (order: string[]) => Promise<void>;
  // Quick actions
  setDensityMode: (mode: DensityMode) => Promise<void>;
  setSidebarPosition: (position: SidebarPosition) => Promise<void>;
  toggleSidebarCollapsed: () => Promise<void>;
  // Computed values
  densityClass: string;
  contentWidthClass: string;
}

// ============================================================================
// Context
// ============================================================================

const UserPreferencesContext = createContext<UserPreferencesContextValue | undefined>(undefined);

// ============================================================================
// Local Storage Key
// ============================================================================

const LOCAL_STORAGE_KEY = 'hw-user-preferences';

// Create full preferences from defaults (adds missing id/userId/etc for local use)
const createDefaultPrefs = (): UserPreferences => ({
  id: '',
  userId: '',
  preferenceVersion: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...defaultPreferences,
});

// ============================================================================
// Provider
// ============================================================================

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      const token = getStoredToken();

      if (!token) {
        // Not logged in - use local storage or defaults
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            // Merge with defaults to ensure all fields exist
            setPreferences({ ...createDefaultPrefs(), ...parsed });
          } catch {
            // Invalid stored data, use defaults
            setPreferences(createDefaultPrefs());
          }
        } else {
          // No stored data, use defaults
          setPreferences(createDefaultPrefs());
        }
        setLoading(false);
        return;
      }

      try {
        const prefs = await preferencesService.getPreferences();
        setPreferences(prefs);
        // Also store in local storage for offline access
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prefs));
      } catch (err) {
        console.warn('Failed to load preferences from server:', err);
        // Try to use local storage as fallback
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setPreferences({ ...createDefaultPrefs(), ...parsed });
          } catch {
            // Use defaults as last resort
            setPreferences(createDefaultPrefs());
            setError('Failed to load preferences');
          }
        } else {
          // Use defaults as last resort
          setPreferences(createDefaultPrefs());
        }
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Apply preferences to document
  useEffect(() => {
    if (!preferences) return;

    const root = document.documentElement;

    // Apply density mode
    root.setAttribute('data-density', preferences.densityMode);

    // Apply accessibility settings
    if (preferences.accessibility.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    if (preferences.accessibility.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (preferences.accessibility.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }

    // Apply sidebar position
    root.setAttribute('data-sidebar-position', preferences.sidebarPosition);
    root.setAttribute('data-sidebar-collapsed', String(preferences.sidebarCollapsed));

    // Apply content width
    root.setAttribute('data-content-width', preferences.contentWidth);

  }, [preferences]);

  // Update preferences
  const updatePreferences = useCallback(async (dto: UpdateUserPreferencesDto) => {
    const token = getStoredToken();

    if (!token) {
      // Not logged in - update local storage only
      setPreferences(prev => {
        const updated = { ...prev, ...dto } as UserPreferences;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      return;
    }

    try {
      const updated = await preferencesService.updatePreferences(dto);
      setPreferences(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to update preferences:', err);
      throw err;
    }
  }, []);

  // Patch preferences (partial update)
  const patchPreferences = useCallback(async (dto: Partial<UpdateUserPreferencesDto>) => {
    const token = getStoredToken();

    if (!token) {
      setPreferences(prev => {
        const updated = { ...prev, ...dto } as UserPreferences;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      return;
    }

    try {
      const updated = await preferencesService.patchPreferences(dto);
      setPreferences(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to patch preferences:', err);
      throw err;
    }
  }, []);

  // Reset preferences
  const resetPreferences = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setPreferences(null);
      return;
    }

    try {
      const reset = await preferencesService.resetPreferences();
      setPreferences(reset);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reset));
    } catch (err) {
      console.error('Failed to reset preferences:', err);
      throw err;
    }
  }, []);

  // Pinned navigation operations
  const addPinnedItem = useCallback(async (dto: AddPinnedItemDto) => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const items = await preferencesService.addPinnedItem(dto);
      setPreferences(prev => prev ? { ...prev, pinnedNavigation: items } : null);
    } catch (err) {
      console.error('Failed to add pinned item:', err);
      throw err;
    }
  }, []);

  const updatePinnedItem = useCallback(async (itemId: string, dto: { label?: string; icon?: string; position?: number }) => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const items = await preferencesService.updatePinnedItem(itemId, dto);
      setPreferences(prev => prev ? { ...prev, pinnedNavigation: items } : null);
    } catch (err) {
      console.error('Failed to update pinned item:', err);
      throw err;
    }
  }, []);

  const removePinnedItem = useCallback(async (itemId: string) => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const items = await preferencesService.removePinnedItem(itemId);
      setPreferences(prev => prev ? { ...prev, pinnedNavigation: items } : null);
    } catch (err) {
      console.error('Failed to remove pinned item:', err);
      throw err;
    }
  }, []);

  const reorderPinnedItems = useCallback(async (order: string[]) => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const items = await preferencesService.reorderPinnedItems(order);
      setPreferences(prev => prev ? { ...prev, pinnedNavigation: items } : null);
    } catch (err) {
      console.error('Failed to reorder pinned items:', err);
      throw err;
    }
  }, []);

  // Quick actions
  const setDensityMode = useCallback(async (mode: DensityMode) => {
    const token = getStoredToken();

    if (!token) {
      setPreferences(prev => {
        const updated = { ...prev, densityMode: mode } as UserPreferences;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      return;
    }

    try {
      const updated = await preferencesService.setDensityMode(mode);
      setPreferences(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to set density mode:', err);
      throw err;
    }
  }, []);

  const setSidebarPosition = useCallback(async (position: SidebarPosition) => {
    const token = getStoredToken();

    if (!token) {
      setPreferences(prev => {
        const updated = { ...prev, sidebarPosition: position } as UserPreferences;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      return;
    }

    try {
      const updated = await preferencesService.setSidebarPosition(position);
      setPreferences(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to set sidebar position:', err);
      throw err;
    }
  }, []);

  const toggleSidebarCollapsed = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      setPreferences(prev => {
        const updated = { ...prev, sidebarCollapsed: !prev?.sidebarCollapsed } as UserPreferences;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      return;
    }

    try {
      const updated = await preferencesService.toggleSidebarCollapsed();
      setPreferences(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to toggle sidebar via API, using local fallback:', err);
      // Fallback: update local state even if API fails
      setPreferences(prev => {
        const updated = { ...prev, sidebarCollapsed: !prev?.sidebarCollapsed } as UserPreferences;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      // Don't throw - allow UI to update even if server sync fails
    }
  }, []);

  // Computed values
  const densityClass = useMemo(() => {
    const mode = preferences?.densityMode || defaultPreferences.densityMode;
    switch (mode) {
      case 'compact': return 'density-compact';
      case 'spacious': return 'density-spacious';
      default: return 'density-comfortable';
    }
  }, [preferences?.densityMode]);

  const contentWidthClass = useMemo(() => {
    const width = preferences?.contentWidth || defaultPreferences.contentWidth;
    switch (width) {
      case 'narrow': return 'max-w-4xl mx-auto';
      case 'wide': return 'max-w-7xl mx-auto';
      default: return 'w-full';
    }
  }, [preferences?.contentWidth]);

  const pinnedItems = useMemo(() => {
    return preferences?.pinnedNavigation || [];
  }, [preferences?.pinnedNavigation]);

  const value = useMemo<UserPreferencesContextValue>(() => ({
    preferences,
    loading,
    error,
    updatePreferences,
    patchPreferences,
    resetPreferences,
    pinnedItems,
    addPinnedItem,
    updatePinnedItem,
    removePinnedItem,
    reorderPinnedItems,
    setDensityMode,
    setSidebarPosition,
    toggleSidebarCollapsed,
    densityClass,
    contentWidthClass,
  }), [
    preferences,
    loading,
    error,
    updatePreferences,
    patchPreferences,
    resetPreferences,
    pinnedItems,
    addPinnedItem,
    updatePinnedItem,
    removePinnedItem,
    reorderPinnedItems,
    setDensityMode,
    setSidebarPosition,
    toggleSidebarCollapsed,
    densityClass,
    contentWidthClass,
  ]);

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
}

// ============================================================================
// Re-export types
// ============================================================================

export type {
  UserPreferences,
  UpdateUserPreferencesDto,
  PinnedNavigationItem,
  AddPinnedItemDto,
  DensityMode,
  SidebarPosition,
  NotificationPreferences,
  AccessibilitySettings,
  TablePreferences,
  DashboardPreferences,
} from '../services/preferences.service';
