/**
 * ThemePreferenceContext - Shared Theme Preference State
 *
 * Provides centralized theme preference management so that:
 * - ThemeProvider can apply tokens to the DOM
 * - ThemeCustomizer can update preferences
 * - Both share the same state (changes in customizer are immediately reflected)
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ThemeDefinition, ThemePreference, uiService } from '../services/ui.service';

type TokenMap = Record<string, string>;

interface ResolvedTheme {
  tokens: TokenMap;
  colorScheme: 'dark' | 'light';  // The resolved color scheme based on theme + preference
}

interface ThemePreferenceContextValue {
  themes: ThemeDefinition[];
  preference: ThemePreference | null;
  resolved: ResolvedTheme;
  currentTheme: ThemeDefinition | null;  // The currently selected theme definition
  loading: boolean;
  setTheme: (themeId: string | null) => void;
  setColorScheme: (colorScheme: ThemePreference['colorScheme']) => void;
  setAutoDarkMode: (enabled: boolean) => void;
  setPreference: (updates: Partial<ThemePreference>) => Promise<void>;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | undefined>(undefined);

/**
 * Maps theme config to CSS custom property tokens.
 *
 * Both dark and light themes now apply semantic tokens to ensure consistent behavior
 * and proper cleanup when switching between themes.
 */
function mapConfigToTokens(theme: ThemeDefinition, colorScheme: 'dark' | 'light'): TokenMap {
  const tokens: TokenMap = {};
  const config = theme.config as any;
  const colors = config?.colors || {};
  const glass = config?.glass || {};
  const spacing = config?.spacing || {};

  // Primary spectrum - these are palette tokens
  for (let i = 50; i <= 900; i = i === 50 ? 100 : i + 100) {
    const key = `primary${i}`;
    if (colors[key]) tokens[`color-primary-${i}`] = colors[key];
  }

  // Accent spectrum - these are palette tokens
  for (let i = 50; i <= 900; i = i === 50 ? 100 : i + 100) {
    const key = `accent${i}`;
    if (colors[key]) tokens[`color-accent-${i}`] = colors[key];
  }

  // Status colors - these are palette tokens
  if (colors.success) tokens['color-success-500'] = colors.success;
  if (colors.warning) tokens['color-warning-500'] = colors.warning;
  if (colors.danger) tokens['color-danger-500'] = colors.danger;
  if (colors.info) tokens['color-info-500'] = colors.info;

  // Apply semantic tokens for both light and dark themes
  // This ensures proper cleanup when switching themes
  if (colorScheme === 'dark') {
    // Dark theme semantic backgrounds
    if (colors.voidPure) tokens['bg-base'] = colors.voidDeep || colors.voidPure;
    if (colors.voidSurface) tokens['bg-surface'] = colors.voidSurface;
    if (colors.voidSpace) {
      tokens['bg-surface-secondary'] = colors.voidSpace;
      tokens['bg-hover'] = colors.voidSpace;
    }
    if (colors.voidElevated) {
      tokens['bg-surface-tertiary'] = colors.voidElevated;
      tokens['bg-elevated'] = colors.voidElevated;
      tokens['bg-active'] = colors.voidElevated;
    }
    if (colors.voidDeep) tokens['bg-sunken'] = colors.voidDeep;

    // Dark theme text colors
    if (colors.textPrimary) tokens['text-primary'] = colors.textPrimary;
    if (colors.textSecondary) tokens['text-secondary'] = colors.textSecondary;
    if (colors.textTertiary) tokens['text-tertiary'] = colors.textTertiary;
    if (colors.textMuted) {
      tokens['text-muted'] = colors.textMuted;
      tokens['text-placeholder'] = colors.textMuted;
    }
    tokens['text-inverse'] = '#0a0a0b';

    // Dark theme border colors
    if (colors.voidElevated) {
      tokens['border-default'] = colors.voidOverlay || colors.voidElevated;
      tokens['border-subtle'] = colors.voidElevated;
    }
    if (colors.voidOverlay) tokens['border-strong'] = colors.voidOverlay;

    // Brand backgrounds for dark theme
    if (colors.primary500) {
      tokens['bg-primary'] = colors.primary500;
      tokens['text-brand'] = colors.primary400 || colors.primary500;
    }
    if (colors.primary600) tokens['bg-primary-hover'] = colors.primary400 || colors.primary600;
    if (colors.accent500) {
      tokens['bg-accent'] = colors.accent500;
      tokens['text-accent'] = colors.accent400 || colors.accent500;
    }

    // Status colors for dark theme (subtle backgrounds with transparency)
    tokens['bg-danger-subtle'] = 'rgba(239, 68, 68, 0.15)';
    tokens['text-danger'] = colors.danger || '#f87171';
    tokens['bg-success-subtle'] = 'rgba(34, 197, 94, 0.15)';
    tokens['text-success'] = colors.success || '#4ade80';
    tokens['bg-warning-subtle'] = 'rgba(245, 158, 11, 0.15)';
    tokens['text-warning'] = colors.warning || '#fbbf24';
    tokens['bg-info-subtle'] = 'rgba(59, 130, 246, 0.15)';
    tokens['text-info'] = colors.info || '#60a5fa';
  } else {
    // Light theme semantic tokens - use light-appropriate values
    // These are applied to ensure proper override of any lingering dark theme values
    tokens['bg-base'] = colors.voidDeep || '#fafafa';
    tokens['bg-surface'] = colors.voidSurface || '#ffffff';
    tokens['bg-surface-secondary'] = colors.voidSpace || '#f5f5f4';
    tokens['bg-surface-tertiary'] = colors.voidElevated || '#e7e5e4';
    tokens['bg-elevated'] = colors.voidElevated || '#ffffff';
    tokens['bg-sunken'] = colors.voidDeep || '#f5f5f4';
    tokens['bg-hover'] = '#f5f5f4';  // Light hover background
    tokens['bg-active'] = '#e7e5e4';  // Light active background

    // Light theme text colors
    tokens['text-primary'] = colors.textPrimary || '#1c1917';
    tokens['text-secondary'] = colors.textSecondary || '#57534e';
    tokens['text-tertiary'] = colors.textTertiary || '#78716c';
    tokens['text-muted'] = colors.textMuted || '#a8a29e';
    tokens['text-placeholder'] = colors.textMuted || '#a8a29e';
    tokens['text-inverse'] = '#ffffff';

    // Light theme border colors
    tokens['border-default'] = '#e7e5e4';
    tokens['border-subtle'] = '#f5f5f4';
    tokens['border-strong'] = '#d6d3d1';

    // Brand backgrounds for light theme
    tokens['bg-primary'] = colors.primary600 || '#4f46e5';
    tokens['bg-primary-hover'] = colors.primary700 || '#4338ca';
    tokens['text-brand'] = colors.primary600 || '#4f46e5';
    tokens['bg-accent'] = colors.accent500 || '#06b6d4';
    tokens['text-accent'] = colors.accent600 || '#0891b2';

    // Status colors for light theme
    tokens['bg-danger-subtle'] = '#fef2f2';
    tokens['text-danger'] = '#dc2626';
    tokens['bg-success-subtle'] = '#f0fdf4';
    tokens['text-success'] = '#16a34a';
    tokens['bg-warning-subtle'] = '#fffbeb';
    tokens['text-warning'] = '#d97706';
    tokens['bg-info-subtle'] = '#eff6ff';
    tokens['text-info'] = '#2563eb';
  }

  // Glass effects - custom properties for glassmorphism
  if (glass.bg) tokens['glass-bg'] = glass.bg;
  if (glass.bgHover) tokens['glass-bg-hover'] = glass.bgHover;
  if (glass.bgActive) tokens['glass-bg-active'] = glass.bgActive;
  if (glass.border) tokens['glass-border'] = glass.border;
  if (glass.borderHover) tokens['glass-border-hover'] = glass.borderHover;
  if (glass.blur) tokens['glass-blur'] = glass.blur;

  // Spacing/radii
  if (spacing.radiusSm) tokens['radius-sm'] = spacing.radiusSm;
  if (spacing.radiusMd) tokens['radius-md'] = spacing.radiusMd;
  if (spacing.radiusLg) tokens['radius-lg'] = spacing.radiusLg;
  if (spacing.radiusXl) tokens['radius-xl'] = spacing.radiusXl;

  return tokens;
}

function getSystemColorScheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveColorScheme(
  theme: ThemeDefinition | undefined,
  pref: ThemePreference
): 'dark' | 'light' {
  // If user has explicitly set a color scheme preference, use that
  if (pref.colorScheme === 'dark') return 'dark';
  if (pref.colorScheme === 'light') return 'light';

  // If auto mode, use the theme's colorScheme if it's explicitly light/dark
  // Otherwise fall back to system preference
  if (theme?.colorScheme === 'light') return 'light';
  if (theme?.colorScheme === 'dark') return 'dark';

  // Default to system preference
  return getSystemColorScheme();
}

interface ResolveResult {
  theme: ThemeDefinition | null;
  resolved: ResolvedTheme;
}

function resolveTheme(themes: ThemeDefinition[], pref: ThemePreference): ResolveResult {
  const byId = new Map(themes.map((t) => [t.id, t]));
  let base = pref.themeId ? byId.get(pref.themeId) : undefined;
  if (!base) base = themes.find((t) => t.isDefault) || themes[0];
  if (!base) return { theme: null, resolved: { tokens: {}, colorScheme: getSystemColorScheme() } };

  // Resolve color scheme first, as it affects which tokens to apply
  const colorScheme = resolveColorScheme(base, pref);

  // Map tokens based on the resolved color scheme
  const tokens = mapConfigToTokens(base, colorScheme);

  // Apply custom overrides
  const overrides = (pref.customOverrides as any)?.colors || {};
  if (overrides.primary500) tokens['color-primary-500'] = overrides.primary500 as string;
  if (overrides.accent500) tokens['color-accent-500'] = overrides.accent500 as string;

  return { theme: base, resolved: { tokens, colorScheme } };
}

interface ThemePreferenceProviderProps {
  children: React.ReactNode;
}

export const ThemePreferenceProvider: React.FC<ThemePreferenceProviderProps> = ({ children }) => {
  const [themes, setThemes] = useState<ThemeDefinition[]>([]);
  const [pref, setPref] = useState<ThemePreference | null>(null);
  const [resolved, setResolved] = useState<ResolvedTheme>({ tokens: {}, colorScheme: 'dark' });
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        // Fetch themes first (doesn't require auth)
        const themeList = await uiService.getThemes();
        if (!isMounted) return;
        setThemes(themeList);

        // Try to fetch preference (requires auth, may fail if not logged in)
        let preference: ThemePreference | null = null;
        try {
          preference = await uiService.getThemePreference();
        } catch {
          // If preference fails (e.g., 401), use default theme
          console.debug('Could not load theme preference, using default theme');
        }

        if (!isMounted) return;

        // Create a default preference if none loaded
        if (!preference) {
          const defaultTheme = themeList.find((t) => t.isDefault) || themeList[0];
          preference = {
            userId: '',
            themeId: defaultTheme?.id || null,
            autoDarkMode: true,
            colorScheme: 'auto',
            customOverrides: {},
          };
        }

        setPref(preference);
        const result = resolveTheme(themeList, preference);
        setResolved(result.resolved);
        setCurrentTheme(result.theme);
      } catch (err) {
        console.warn('Failed to load themes', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const setPreference = useCallback(async (updates: Partial<ThemePreference>) => {
    setPref((currentPref) => {
      if (!currentPref) return currentPref;

      // Optimistically update local state immediately
      const optimisticPref = { ...currentPref, ...updates };

      // Update resolved tokens synchronously
      setThemes((currentThemes) => {
        const result = resolveTheme(currentThemes, optimisticPref);
        setResolved(result.resolved);
        setCurrentTheme(result.theme);
        return currentThemes;
      });

      // Try to persist to backend (may fail if not logged in)
      uiService.updateThemePreference(optimisticPref)
        .then((saved) => {
          setPref(saved);
          setThemes((currentThemes) => {
            const result = resolveTheme(currentThemes, saved);
            setResolved(result.resolved);
            setCurrentTheme(result.theme);
            return currentThemes;
          });
        })
        .catch((err) => {
          console.debug('Could not save theme preference to backend:', err);
          // Keep the optimistic update - theme is applied locally
        });

      return optimisticPref;
    });
  }, []);

  const setTheme = useCallback((themeId: string | null) => {
    // When selecting a new theme, reset colorScheme to 'auto' so the theme's
    // own colorScheme is respected (e.g., light theme becomes light)
    setPreference({ themeId, colorScheme: 'auto' });
  }, [setPreference]);

  const setColorScheme = useCallback((colorScheme: ThemePreference['colorScheme']) => {
    setPreference({ colorScheme });
  }, [setPreference]);

  const setAutoDarkMode = useCallback((enabled: boolean) => {
    setPreference({ autoDarkMode: enabled });
  }, [setPreference]);

  const value = useMemo<ThemePreferenceContextValue>(() => ({
    themes,
    preference: pref,
    resolved,
    currentTheme,
    loading,
    setTheme,
    setColorScheme,
    setAutoDarkMode,
    setPreference,
  }), [themes, pref, resolved, currentTheme, loading, setTheme, setColorScheme, setAutoDarkMode, setPreference]);

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
};

/**
 * Hook to access theme preference context
 */
export function useThemePreferenceContext(): ThemePreferenceContextValue {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error('useThemePreferenceContext must be used within a ThemePreferenceProvider');
  }
  return context;
}

export default ThemePreferenceContext;
