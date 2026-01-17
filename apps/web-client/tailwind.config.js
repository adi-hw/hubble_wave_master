const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

const withOpacityValue = (variable) => {
  return ({ opacityValue }) => {
    if (opacityValue === undefined) {
      return `rgb(var(${variable}))`;
    }
    return `rgb(var(${variable}) / ${opacityValue})`;
  };
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    join(__dirname, '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        background: withOpacityValue('--bg-base-rgb'),
        foreground: withOpacityValue('--text-primary-rgb'),
        card: withOpacityValue('--bg-surface-rgb'),
        'card-foreground': withOpacityValue('--text-primary-rgb'),
        popover: withOpacityValue('--bg-elevated-rgb'),
        'popover-foreground': withOpacityValue('--text-primary-rgb'),
        muted: withOpacityValue('--bg-surface-secondary-rgb'),
        'muted-foreground': withOpacityValue('--text-secondary-rgb'),
        hover: withOpacityValue('--bg-hover-rgb'),
        active: withOpacityValue('--bg-active-rgb'),
        overlay: withOpacityValue('--bg-overlay-rgb'),
        backdrop: withOpacityValue('--bg-backdrop-rgb'),
        border: withOpacityValue('--border-default-rgb'),
        input: withOpacityValue('--bg-surface-rgb'),
        ring: withOpacityValue('--ring-color-rgb'),
        primary: {
          DEFAULT: withOpacityValue('--bg-primary-rgb'),
          foreground: withOpacityValue('--text-on-primary-rgb'),
          50: withOpacityValue('--color-primary-50-rgb'),
          100: withOpacityValue('--color-primary-100-rgb'),
          200: withOpacityValue('--color-primary-200-rgb'),
          300: withOpacityValue('--color-primary-300-rgb'),
          400: withOpacityValue('--color-primary-400-rgb'),
          500: withOpacityValue('--color-primary-500-rgb'),
          600: withOpacityValue('--color-primary-600-rgb'),
          700: withOpacityValue('--color-primary-700-rgb'),
          800: withOpacityValue('--color-primary-800-rgb'),
          900: withOpacityValue('--color-primary-900-rgb'),
          950: withOpacityValue('--color-primary-950-rgb'),
        },
        accent: {
          DEFAULT: withOpacityValue('--accent-rgb'),
          foreground: withOpacityValue('--accent-foreground-rgb'),
          50: withOpacityValue('--color-accent-50-rgb'),
          100: withOpacityValue('--color-accent-100-rgb'),
          200: withOpacityValue('--color-accent-200-rgb'),
          300: withOpacityValue('--color-accent-300-rgb'),
          400: withOpacityValue('--color-accent-400-rgb'),
          500: withOpacityValue('--color-accent-500-rgb'),
          600: withOpacityValue('--color-accent-600-rgb'),
          700: withOpacityValue('--color-accent-700-rgb'),
          800: withOpacityValue('--color-accent-800-rgb'),
          900: withOpacityValue('--color-accent-900-rgb'),
          950: withOpacityValue('--color-accent-950-rgb'),
        },
        destructive: {
          DEFAULT: withOpacityValue('--color-danger-500-rgb'),
          foreground: withOpacityValue('--text-on-danger-rgb'),
        },
        success: {
          DEFAULT: withOpacityValue('--color-success-500-rgb'),
          foreground: withOpacityValue('--text-on-success-rgb'),
        },
        warning: {
          DEFAULT: withOpacityValue('--color-warning-500-rgb'),
          foreground: withOpacityValue('--text-on-warning-rgb'),
        },
        danger: {
          DEFAULT: withOpacityValue('--color-danger-500-rgb'),
          foreground: withOpacityValue('--text-on-danger-rgb'),
        },
        info: {
          DEFAULT: withOpacityValue('--color-info-500-rgb'),
          foreground: withOpacityValue('--text-on-info-rgb'),
        },
        'success-subtle': withOpacityValue('--bg-success-subtle-rgb'),
        'warning-subtle': withOpacityValue('--bg-warning-subtle-rgb'),
        'danger-subtle': withOpacityValue('--bg-danger-subtle-rgb'),
        'info-subtle': withOpacityValue('--bg-info-subtle-rgb'),
        'success-text': withOpacityValue('--text-success-rgb'),
        'warning-text': withOpacityValue('--text-warning-rgb'),
        'danger-text': withOpacityValue('--text-danger-rgb'),
        'info-text': withOpacityValue('--text-info-rgb'),
        'success-border': withOpacityValue('--border-success-rgb'),
        'warning-border': withOpacityValue('--border-warning-rgb'),
        'danger-border': withOpacityValue('--border-danger-rgb'),
        'info-border': withOpacityValue('--border-info-rgb'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(0, 0, 0, 0.08), 0 4px 16px -4px rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        elevated: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        glow: '0 0 20px -5px rgba(59, 130, 246, 0.3)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
