/**
 * ThemeProvider - HubbleWave Theme Wrapper
 *
 * Combines CSS-based theming with optional backend-driven theme tokens.
 * Uses useDarkMode hook for system/light/dark preference management.
 */

import React, { useEffect } from 'react';
import { useThemeTokens } from '../../hooks/useThemeTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme } = useThemeTokens();
  // Initialize dark mode - this applies the theme class to <html>
  useDarkMode();

  // Apply backend-driven theme tokens if available
  useEffect(() => {
    if (!theme?.tokens) return;

    const root = document.documentElement;
    Object.entries(theme.tokens).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/\./g, '-')}`;
      const stringValue =
        typeof value === 'number' && key.startsWith('radius')
          ? `${value}px`
          : String(value);
      root.style.setProperty(cssVar, stringValue);
    });
  }, [theme]);

  // Add smooth theme transition support
  useEffect(() => {
    // Add transition styles when theme changes
    const style = document.createElement('style');
    style.textContent = `
      .theme-transitioning,
      .theme-transitioning * {
        transition: background-color 0.3s ease, border-color 0.3s ease, color 0.2s ease !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return <>{children}</>;
};
