import React, { useEffect } from 'react';
import { useThemeTokens } from '../../hooks/useThemeTokens';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme, loading } = useThemeTokens();

  useEffect(() => {
    if (!theme) return;

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

  if (loading && !theme) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        Loading theme...
      </div>
    );
  }

  return <>{children}</>;
};
