/**
 * NavigationContext
 *
 * Provides navigation state to all components in the app.
 * This ensures navigation is fetched once and shared across components,
 * preventing duplicate API calls and state resets on route changes.
 */

import React, { createContext, useContext, useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { navigationService } from '../services/navigation.service';
import { uiService } from '../services/ui.service';
import {
  ResolvedNavigation,
  NavProfileSummary,
  NavSearchResult,
  NavigationContextValue,
  LegacyNavigationResponse,
  ResolvedNavNode,
} from '../types/navigation-v2';

// Feature flag for V2 navigation
const NAVIGATION_V2_ENABLED = import.meta.env.VITE_NAVIGATION_V2_ENABLED === 'true';

// Context tags based on device/environment
const getContextTags = (): string[] => {
  const tags: string[] = [];

  // Device detection
  if (window.innerWidth < 768) {
    tags.push('mobile');
  } else if (window.innerWidth < 1024) {
    tags.push('tablet');
  } else {
    tags.push('desktop');
  }

  // Environment
  if (import.meta.env.MODE === 'development') {
    tags.push('dev');
  }

  return tags;
};

/**
 * Convert legacy navigation to V2 format
 */
const convertLegacyNavigation = (legacy: LegacyNavigationResponse): ResolvedNavigation => {
  const nodes: ResolvedNavNode[] = legacy.sections.map((section) => ({
    key: `section-${section.name.toLowerCase().replace(/\s+/g, '-')}`,
    type: 'group' as const,
    label: section.name,
    children: section.items.map((item) => ({
      key: item.code,
      type: 'module' as const,
      label: item.label,
      icon: item.icon,
      route: item.path ?? `/${item.code}.list`,
      moduleKey: item.code,
    })),
  }));

  return {
    profileId: 'legacy',
    profileName: 'Default',
    nodes,
    favorites: [],
    recentModules: [],
    smartGroups: {
      favorites: [],
      recent: [],
      frequent: [],
    },
    resolvedAt: new Date().toISOString(),
  };
};

/**
 * Fallback navigation for immediate display while loading
 */
const fallbackNavigation: ResolvedNavigation = {
  profileId: 'fallback',
  profileName: 'Default',
  nodes: [
    {
      key: 'studio',
      type: 'group',
      label: 'Studio',
      children: [
        { key: 'studio-dashboard', type: 'module', label: 'Dashboard', icon: 'LayoutDashboard', route: '/studio' },
        { key: 'tables', type: 'module', label: 'Tables', icon: 'Database', route: '/studio/tables' },
        { key: 'scripts', type: 'module', label: 'Scripts', icon: 'FileCode', route: '/studio/scripts' },
      ],
    },
  ],
  favorites: [],
  recentModules: [],
  smartGroups: {
    favorites: [],
    recent: [],
    frequent: [],
  },
  resolvedAt: new Date().toISOString(),
};

// Create context with default values
const NavigationContext = createContext<NavigationContextValue | null>(null);

interface NavigationProviderProps {
  children: React.ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const { auth } = useAuth();
  const [navigation, setNavigation] = useState<ResolvedNavigation | null>(fallbackNavigation);
  const [profiles, setProfiles] = useState<NavProfileSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already fetched to prevent duplicate requests
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  // Track recent navigation records to debounce
  const recentNavigationsRef = useRef<Set<string>>(new Set());

  const isAuthenticated = !!auth.user && !auth.loading;
  const isV2 = NAVIGATION_V2_ENABLED;

  // Active profile from the list
  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.isActive) ?? null;
  }, [profiles]);

  /**
   * Fetch navigation (V2 or legacy)
   */
  const fetchNavigation = useCallback(async (force = false) => {
    // Skip if not authenticated, already fetched (unless forced), or currently fetching
    if (!isAuthenticated) return;
    if (!force && hasFetchedRef.current) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      if (isV2) {
        // Use new navigation system
        const contextTags = getContextTags();
        const [nav, profs] = await Promise.all([
          navigationService.getNavigation(contextTags),
          navigationService.getProfiles(),
        ]);
        setNavigation(nav);
        setProfiles(profs);
      } else {
        // Use legacy navigation and convert
        const legacyNav = await uiService.getNavigation();
        setNavigation(convertLegacyNavigation(legacyNav));
        setProfiles([
          {
            id: 'legacy',
            name: 'Default',
            isActive: true,
            isDefault: true,
            isLocked: true,
          },
        ]);
      }
      hasFetchedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch navigation:', err);
      setError('Failed to load navigation');
      // Keep fallback navigation on error
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, isV2]);

  // Fetch navigation on auth change
  useEffect(() => {
    fetchNavigation();
  }, [fetchNavigation]);

  // Reset fetched flag when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      hasFetchedRef.current = false;
      setNavigation(fallbackNavigation);
      setProfiles([]);
    }
  }, [isAuthenticated]);

  /**
   * Switch to a different profile
   */
  const switchProfile = useCallback(
    async (profileId: string) => {
      if (!isV2) return;

      try {
        await navigationService.switchProfile(profileId);
        // Update local state optimistically
        setProfiles((prev) =>
          prev.map((p) => ({
            ...p,
            isActive: p.id === profileId,
          }))
        );
        // Force refresh navigation for new profile
        hasFetchedRef.current = false;
        await fetchNavigation(true);
      } catch (err) {
        console.error('Failed to switch profile:', err);
        throw err;
      }
    },
    [isV2, fetchNavigation]
  );

  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback(
    async (moduleKey: string) => {
      if (!navigation) return;

      try {
        if (isV2) {
          await navigationService.toggleFavorite(moduleKey);
        }
        // Update local state optimistically
        setNavigation((prev) => {
          if (!prev) return prev;

          const favorites = prev.favorites || [];
          const isFavorite = favorites.includes(moduleKey);

          return {
            ...prev,
            favorites: isFavorite
              ? favorites.filter((k) => k !== moduleKey)
              : [...favorites, moduleKey],
          };
        });
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
        throw err;
      }
    },
    [isV2, navigation]
  );

  /**
   * Record navigation (for recent/frequent tracking)
   * Debounced to prevent rapid-fire requests
   */
  const recordNavigation = useCallback(
    async (moduleKey: string) => {
      if (!isV2) return;

      // Debounce: skip if same module was recorded in last 5 seconds
      if (recentNavigationsRef.current.has(moduleKey)) {
        return;
      }

      // Add to recent navigations and remove after 5 seconds
      recentNavigationsRef.current.add(moduleKey);
      setTimeout(() => {
        recentNavigationsRef.current.delete(moduleKey);
      }, 5000);

      try {
        // Fire and forget - don't wait for response
        navigationService.recordNavigation(moduleKey).catch((err) => {
          console.warn('Failed to record navigation:', err);
        });
      } catch (err) {
        // Silently ignore errors - this is non-critical
      }
    },
    [isV2]
  );

  /**
   * Search navigation (synchronous local search)
   */
  const searchNavigation = useCallback(
    (query: string): NavSearchResult[] => {
      // Simple client-side search
      if (!navigation) return [];

      const results: NavSearchResult[] = [];
      const searchLower = query.toLowerCase();

      const searchNodes = (nodes: ResolvedNavNode[], parentPath: string[] = []) => {
        for (const node of nodes) {
          if (node.label.toLowerCase().includes(searchLower)) {
            results.push({
              key: node.key,
              label: node.label,
              icon: node.icon,
              route: node.route,
              type: node.type,
              path: parentPath,
              score: node.label.toLowerCase().startsWith(searchLower) ? 100 : 50,
            });
          }
          if (node.children) {
            searchNodes(node.children, [...parentPath, node.label]);
          }
          if (node.smartGroupItems) {
            searchNodes(node.smartGroupItems, [...parentPath, node.label]);
          }
        }
      };

      searchNodes(navigation.nodes);
      return results.sort((a, b) => b.score - a.score).slice(0, 20);
    },
    [navigation]
  );

  /**
   * Refresh navigation (force fetch)
   */
  const refresh = useCallback(async () => {
    hasFetchedRef.current = false;
    await fetchNavigation(true);
  }, [fetchNavigation]);

  const value: NavigationContextValue = {
    nav: navigation,
    navigation,
    loading,
    error,
    profiles,
    activeProfile,
    switchProfile,
    toggleFavorite,
    recordNavigation,
    searchNavigation,
    refresh,
    isV2,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

/**
 * Hook to access navigation context
 */
export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

// Re-export for backward compatibility
export { useNavigation as useNavigationV2 };
