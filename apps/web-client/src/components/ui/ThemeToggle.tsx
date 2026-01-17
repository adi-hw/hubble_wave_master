/**
 * ThemeToggle - Modern Theme Switcher
 *
 * A sleek, animated theme toggle supporting system/light/dark modes.
 * Designed for the HubbleWave design system.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { useThemePreference } from '../../hooks/useThemePreference';

type Theme = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  /** Show text label next to icon */
  showLabel?: boolean;
  /** Display variant */
  variant?: 'button' | 'dropdown' | 'segmented';
  /** Size of the toggle */
  size?: 'sm' | 'md';
  /** Additional className */
  className?: string;
}

const themeOptions: { value: Theme; label: string; description: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', description: 'Always use light theme', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Always use dark theme', icon: Moon },
  { value: 'system', label: 'Auto', description: 'Match your device settings', icon: Monitor },
];

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  showLabel = false,
  variant = 'button',
  size = 'md',
  className = '',
}) => {
  const { preference, resolved, setColorScheme } = useThemePreference();
  const selectedTheme: Theme = preference?.colorScheme === 'auto' ? 'system' : (preference?.colorScheme || 'system');
  const isDark = resolved.colorScheme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
  };

  if (variant === 'button') {
    return (
      <button
        onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
        className={`
          relative inline-flex items-center justify-center gap-2
          ${showLabel ? 'px-3' : sizeClasses[size]}
          rounded-lg
          transition-all duration-200
          focus:outline-none focus-visible:ring-2
          text-muted-foreground hover:bg-muted hover:text-foreground
          ${className}
        `}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="relative h-5 w-5">
          <Sun
            className={`
              ${iconSizeClasses[size]}
              absolute inset-0
              transition-all duration-300 ease-out
              ${isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}
            `}
          />
          <Moon
            className={`
              ${iconSizeClasses[size]}
              absolute inset-0
              transition-all duration-300 ease-out
              ${!isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}
            `}
          />
        </span>
        {showLabel && (
          <span className="text-sm font-medium">
            {isDark ? 'Light' : 'Dark'}
          </span>
        )}
      </button>
    );
  }

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center gap-1 p-1 rounded-xl bg-muted ${className}`}
      >
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setColorScheme(value === 'system' ? 'auto' : value)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              selectedTheme === value
                ? 'bg-card text-primary shadow-sm'
                : 'bg-transparent text-muted-foreground'
            }`}
            aria-label={`${label} theme`}
            title={`${label} theme`}
          >
            <Icon className={iconSizeClasses[size]} />
          </button>
        ))}
      </div>
    );
  }

  const CurrentIcon = isDark ? Moon : Sun;

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-center ${sizeClasses[size]} rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 text-muted-foreground hover:bg-muted hover:text-foreground`}
        aria-label="Theme options"
        aria-expanded={isOpen}
      >
        <CurrentIcon className={iconSizeClasses[size]} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-52 rounded-xl py-1 z-50 animate-scale-in bg-card border border-border shadow-lg origin-top-right"
        >
          {themeOptions.map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              onClick={() => {
                setColorScheme(value === 'system' ? 'auto' : value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                selectedTheme === value
                  ? 'bg-primary/10 text-primary'
                  : 'bg-transparent text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 text-left">
                <div className="font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">
                  {description}
                </div>
              </div>
              {selectedTheme === value && (
                <Check className="h-4 w-4 flex-shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
