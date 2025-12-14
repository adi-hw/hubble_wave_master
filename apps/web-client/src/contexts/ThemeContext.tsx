/**
 * ThemeContext - HubbleWave Theme Management
 *
 * Provides system/light/dark theme switching with:
 * - Automatic system preference detection
 * - LocalStorage persistence
 * - Smooth theme transitions
 * - Theme toggle component integration
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** The user's preference: system, light, or dark */
  mode: ThemeMode;
  /** The actual applied theme after resolving system preference */
  resolvedTheme: ResolvedTheme;
  /** Set the theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark (skips system) */
  toggle: () => void;
  /** Whether the current resolved theme is dark */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'hw-theme-mode';

/**
 * Get the system color scheme preference
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Get the stored theme preference
 */
function getStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

/**
 * Resolve the actual theme from the mode
 */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
}

/**
 * Apply theme to the document
 */
function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;

  // Add transition class for smooth theme switching
  root.classList.add('theme-transitioning');

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Remove transition class after animation
  setTimeout(() => {
    root.classList.remove('theme-transitioning');
  }, 300);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default mode if none stored */
  defaultMode?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'system',
}) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    // Try to get stored preference, fall back to default
    return getStoredMode() || defaultMode;
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(mode)
  );

  // Update resolved theme when mode changes
  useEffect(() => {
    const resolved = resolveTheme(mode);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [mode]);

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme: ResolvedTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(newTheme);
      applyTheme(newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode]);

  // Apply initial theme on mount
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const toggle = useCallback(() => {
    setModeState((current) => {
      const next = resolveTheme(current) === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      setMode,
      toggle,
      isDark: resolvedTheme === 'dark',
    }),
    [mode, resolvedTheme, setMode, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook for components that only need the resolved theme
 */
export function useResolvedTheme(): ResolvedTheme {
  return useTheme().resolvedTheme;
}

/**
 * Hook for components that only need to know if dark mode is active
 */
export function useIsDark(): boolean {
  return useTheme().isDark;
}

export default ThemeContext;
