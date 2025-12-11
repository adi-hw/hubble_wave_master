import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';

type Theme = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  showLabel?: boolean;
  variant?: 'button' | 'dropdown';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  showLabel = false,
  variant = 'button',
  className = '',
}) => {
  const { theme, isDark, setTheme, toggleTheme } = useDarkMode();

  if (variant === 'button') {
    return (
      <button
        onClick={toggleTheme}
        className={`btn-ghost btn-icon rounded-lg ${className}`}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
        {showLabel && (
          <span className="ml-2 text-sm">{isDark ? 'Light' : 'Dark'}</span>
        )}
      </button>
    );
  }

  // Dropdown variant
  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className={`relative ${className}`}>
      <div
        className="flex items-center rounded-lg p-1"
        style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
            style={{
              backgroundColor: theme === option.value ? 'var(--hw-surface)' : 'transparent',
              color: theme === option.value ? 'var(--hw-text)' : 'var(--hw-text-muted)',
              boxShadow: theme === option.value ? 'var(--hw-shadow-sm)' : 'none',
            }}
          >
            {option.icon}
            {showLabel && <span>{option.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeToggle;
