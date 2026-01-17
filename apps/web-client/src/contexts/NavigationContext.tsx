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
import {
  ResolvedNavigation,
  NavProfileSummary,
  NavSearchResult,
  NavigationContextValue,
  ResolvedNavNode,
} from '../types/navigation';

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

// Create context with default values
const NavigationContext = createContext<NavigationContextValue | null>(null);

interface NavigationProviderProps {
  children: React.ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const { auth, token } = useAuth();
  const [navigation, setNavigation] = useState<ResolvedNavigation | null>(null);
  const [profiles, setProfiles] = useState<NavProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already fetched to prevent duplicate requests
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  // Track recent navigation records to debounce
  const recentNavigationsRef = useRef<Set<string>>(new Set());

  const isAuthenticated = !!auth.user && !auth.loading;

  // Active profile from the list
  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.isActive) ?? null;
  }, [profiles]);

  /**
   * Fetch navigation for the current user
   */
  const fetchNavigation = useCallback(async (force = false) => {
    // Skip if not authenticated, already fetched (unless forced), or currently fetching
    console.log('[NavigationContext] fetchNavigation called', {
      isAuthenticated,
      force,
      hasFetched: hasFetchedRef.current,
      isFetching: isFetchingRef.current,
      hasToken: !!token,
      tokenLength: token?.length,
    });
    if (!isAuthenticated) return;
    if (!token) {
      console.warn('[NavigationContext] No token available, skipping fetch');
      return;
    }
    if (!force && hasFetchedRef.current) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Use new navigation system
      const contextTags = getContextTags();
      console.log('[NavigationContext] Fetching navigation with tags', contextTags);
      const [nav, profs] = await Promise.all([
        navigationService.getNavigation(contextTags),
        navigationService.getProfiles(),
      ]);
      setNavigation(nav);
      setProfiles(profs);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch navigation:', err);
      setError('Failed to load navigation');
      // Navigation stays null on error - no fallback
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, token]);

  // Fetch navigation on auth change
  useEffect(() => {
    fetchNavigation();
  }, [fetchNavigation]);

  // Reset fetched flag when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      hasFetchedRef.current = false;
      setNavigation(null);
      setProfiles([]);
    }
  }, [isAuthenticated]);

  /**
   * Switch to a different profile
   */
  const switchProfile = useCallback(
    async (profileId: string) => {
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
    [fetchNavigation]
  );

  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback(
    async (moduleKey: string) => {
      if (!navigation) return;

      try {
        await navigationService.toggleFavorite(moduleKey);
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
    [navigation]
  );

  /**
   * Record navigation (for recent/frequent tracking)
   * Debounced to prevent rapid-fire requests
   */
  const recordNavigation = useCallback(
    async (moduleKey: string) => {
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
    []
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
