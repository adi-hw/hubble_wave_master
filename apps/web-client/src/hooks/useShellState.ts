import { useCallback, useMemo, useState } from 'react';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

type SidebarPosition = 'left' | 'right';
type Density = 'compact' | 'comfortable' | 'spacious';

/**
 * useShellState - Hook for managing shell UI state
 *
 * This hook integrates with UserPreferencesContext for persistent settings
 * (sidebar position, density, collapsed state) while managing transient state
 * (mobile sidebar open) locally.
 */
export function useShellState() {
  const {
    preferences,
    toggleSidebarCollapsed,
    setSidebarPosition: setPreferencesSidebarPosition,
    setDensityMode: setPreferencesDensity,
  } = useUserPreferences();

  // Transient state - not persisted
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Derived values from preferences
  const sidebarCollapsed = preferences?.sidebarCollapsed ?? false;
  const sidebarPosition: SidebarPosition = preferences?.sidebarPosition ?? 'left';
  const density: Density = preferences?.densityMode ?? 'comfortable';

  const setSidebarCollapsed = useCallback(
    async (collapsed: boolean) => {
      // Only toggle if current state differs
      if (sidebarCollapsed !== collapsed) {
        await toggleSidebarCollapsed();
      }
    },
    [sidebarCollapsed, toggleSidebarCollapsed]
  );

  const toggleSidebar = useCallback(
    async () => {
      await toggleSidebarCollapsed();
    },
    [toggleSidebarCollapsed]
  );

  const setSidebarPosition = useCallback(
    async (position: SidebarPosition) => {
      await setPreferencesSidebarPosition(position);
    },
    [setPreferencesSidebarPosition]
  );

  const openMobileSidebar = useCallback(
    () => setMobileSidebarOpen(true),
    []
  );

  const closeMobileSidebar = useCallback(
    () => setMobileSidebarOpen(false),
    []
  );

  const setDensity = useCallback(
    async (newDensity: Density) => {
      await setPreferencesDensity(newDensity);
    },
    [setPreferencesDensity]
  );

  return useMemo(
    () => ({
      sidebarCollapsed,
      sidebarPosition,
      mobileSidebarOpen,
      density,
      setSidebarCollapsed,
      toggleSidebar,
      setSidebarPosition,
      openMobileSidebar,
      closeMobileSidebar,
      setDensity,
    }),
    [
      sidebarCollapsed,
      sidebarPosition,
      mobileSidebarOpen,
      density,
      setSidebarCollapsed,
      toggleSidebar,
      setSidebarPosition,
      openMobileSidebar,
      closeMobileSidebar,
      setDensity,
    ]
  );
}

