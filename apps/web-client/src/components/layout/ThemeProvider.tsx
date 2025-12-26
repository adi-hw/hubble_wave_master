/**
 * ThemeProvider - HubbleWave Theme Wrapper
 *
 * Combines CSS-based theming with optional backend-driven theme tokens.
 * Uses ThemePreferenceContext for shared state management.
 */

import React, { useEffect } from 'react';
import { ThemePreferenceProvider, useThemePreferenceContext } from '../../contexts/ThemePreferenceContext';

interface ThemeProviderProps {
  children: React.ReactNode;
}

const ThemeApplicator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolved } = useThemePreferenceContext();

  // Apply dark/light class for Tailwind and design-tokens.css
  useEffect(() => {
    const root = document.documentElement;
    const colorScheme = resolved.colorScheme;

    // Add transition class for smooth switching
    root.classList.add('theme-transitioning');

    if (colorScheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    root.dataset.theme = colorScheme;

    // Remove transition class after animation
    const timer = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 300);

    return () => clearTimeout(timer);
  }, [resolved.colorScheme]);

  // Apply backend-driven theme tokens if available
  // Track applied tokens so we can remove them when they change
  useEffect(() => {
    if (!resolved?.tokens) return;

    const root = document.documentElement;
    const appliedKeys: string[] = [];

    // Apply new tokens
    Object.entries(resolved.tokens).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/\./g, '-')}`;
      const stringValue = typeof value === 'number' ? `${value}` : String(value);
      root.style.setProperty(cssVar, stringValue);
      appliedKeys.push(cssVar);
    });

    // Cleanup: remove tokens when component unmounts or tokens change
    return () => {
      appliedKeys.forEach((cssVar) => {
        root.style.removeProperty(cssVar);
      });
    };
  }, [resolved.tokens]);

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

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <ThemePreferenceProvider>
      <ThemeApplicator>{children}</ThemeApplicator>
    </ThemePreferenceProvider>
  );
};
