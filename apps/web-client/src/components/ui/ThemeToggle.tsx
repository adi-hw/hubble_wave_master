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
          transition-all duration-200
          focus:outline-none focus-visible:ring-2
          ${className}
        `}
        style={{
          color: 'var(--text-muted)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
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
        className={`inline-flex items-center gap-1 p-1 rounded-xl ${className}`}
        style={{ backgroundColor: 'var(--bg-hover)' }}
      >
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className="p-2 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: theme === value ? 'var(--bg-surface)' : 'transparent',
              color: theme === value ? 'var(--text-brand)' : 'var(--text-muted)',
              boxShadow: theme === value ? 'var(--shadow-sm)' : 'none',
            }}
            aria-label={`${label} theme`}
            title={`${label} theme`}
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
        className={`inline-flex items-center justify-center ${sizeClasses[size]} rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2`}
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
        aria-label="Theme options"
        aria-expanded={isOpen}
      >
        <CurrentIcon className={iconSizeClasses[size]} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-52 rounded-xl py-1 z-50 animate-scale-in"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
            transformOrigin: 'top right',
          }}
        >
          {themeOptions.map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              onClick={() => {
                setTheme(value);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: theme === value ? 'var(--bg-primary-subtle)' : 'transparent',
                color: theme === value ? 'var(--text-brand)' : 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                if (theme !== value) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (theme !== value) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 text-left">
                <div className="font-medium">{label}</div>
                <div
                  className="text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {description}
                </div>
              </div>
              {theme === value && (
                <Check className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-brand)' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
