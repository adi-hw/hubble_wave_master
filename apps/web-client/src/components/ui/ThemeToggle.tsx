/**
 * ThemeToggle - Modern Theme Switcher
 *
 * A sleek, animated theme toggle supporting system/light/dark modes.
 * Designed for the HubbleWave design system.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';

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

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  showLabel = false,
  variant = 'button',
  size = 'md',
  className = '',
}) => {
  const { theme, isDark, setTheme, toggleTheme } = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
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

  // Size classes
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
  };

  // Simple toggle button with smooth animation
  if (variant === 'button') {
    return (
      <button
        onClick={toggleTheme}
        className={`
          relative inline-flex items-center justify-center gap-2
          ${showLabel ? 'px-3' : sizeClasses[size]}
          rounded-lg
          text-slate-500 hover:text-slate-700
          dark:text-slate-400 dark:hover:text-slate-200
          hover:bg-slate-100 dark:hover:bg-slate-800
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50
          ${className}
        `}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="relative h-5 w-5">
          {/* Sun icon - shown in dark mode */}
          <Sun
            className={`
              ${iconSizeClasses[size]}
              absolute inset-0
              transition-all duration-300 ease-out
              ${isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}
            `}
          />
          {/* Moon icon - shown in light mode */}
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

  // Segmented control variant
  if (variant === 'segmented') {
    return (
      <div
        className={`
          inline-flex items-center gap-1 p-1 rounded-xl
          bg-slate-100 dark:bg-slate-800
          ${className}
        `}
      >
        {themeOptions.map(({ value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${theme === value
                ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }
            `}
            aria-label={`${value} theme`}
            title={`${value.charAt(0).toUpperCase() + value.slice(1)} theme`}
          >
            <Icon className={iconSizeClasses[size]} />
          </button>
        ))}
      </div>
    );
  }

  // Dropdown variant
  const CurrentIcon = isDark ? Moon : Sun;

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center justify-center
          ${sizeClasses[size]} rounded-lg
          text-slate-500 hover:text-slate-700
          dark:text-slate-400 dark:hover:text-slate-200
          hover:bg-slate-100 dark:hover:bg-slate-800
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50
        `}
        aria-label="Theme options"
        aria-expanded={isOpen}
      >
        <CurrentIcon className={iconSizeClasses[size]} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
            absolute right-0 mt-2 w-40
            bg-white dark:bg-slate-800
            border border-slate-200 dark:border-slate-700
            rounded-xl shadow-elevated
            py-1 z-50
            animate-scale-in
          "
          style={{ transformOrigin: 'top right' }}
        >
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => {
                setTheme(value);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-3 py-2
                text-sm transition-colors
                ${theme === value
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{label}</span>
              {theme === value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
