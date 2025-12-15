const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    join(__dirname, '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      // ============================================
      // COLORS - Using CSS Variables from design-tokens.css
      // ============================================
      colors: {
        // Background colors
        background: {
          DEFAULT: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          'surface-secondary': 'var(--bg-surface-secondary)',
          'surface-tertiary': 'var(--bg-surface-tertiary)',
          elevated: 'var(--bg-elevated)',
          sunken: 'var(--bg-sunken)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
          selected: 'var(--bg-selected)',
          'selected-hover': 'var(--bg-selected-hover)',
          disabled: 'var(--bg-disabled)',
        },

        // Border colors
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
          hover: 'var(--border-hover)',
          focus: 'var(--border-focus)',
          disabled: 'var(--border-disabled)',
        },

        // Text colors
        foreground: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-muted)',
          placeholder: 'var(--text-placeholder)',
          disabled: 'var(--text-disabled)',
          inverse: 'var(--text-inverse)',
        },

        // Primary brand
        primary: {
          DEFAULT: 'var(--bg-primary)',
          hover: 'var(--bg-primary-hover)',
          active: 'var(--bg-primary-active)',
          subtle: 'var(--bg-primary-subtle)',
          foreground: 'var(--text-on-primary)',
          text: 'var(--text-brand)',
          border: 'var(--border-primary)',
          // Raw palette for gradients
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
          950: 'var(--color-primary-950)',
        },

        // Accent
        accent: {
          DEFAULT: 'var(--bg-accent)',
          hover: 'var(--bg-accent-hover)',
          subtle: 'var(--bg-accent-subtle)',
          foreground: 'var(--text-on-accent)',
          text: 'var(--text-accent)',
          border: 'var(--border-accent)',
          // Raw palette
          50: 'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
          950: 'var(--color-accent-950)',
        },

        // Status colors
        success: {
          DEFAULT: 'var(--bg-success)',
          subtle: 'var(--bg-success-subtle)',
          foreground: 'var(--text-on-success)',
          text: 'var(--text-success)',
          border: 'var(--border-success)',
          50: 'var(--color-success-50)',
          100: 'var(--color-success-100)',
          200: 'var(--color-success-200)',
          300: 'var(--color-success-300)',
          400: 'var(--color-success-400)',
          500: 'var(--color-success-500)',
          600: 'var(--color-success-600)',
          700: 'var(--color-success-700)',
          800: 'var(--color-success-800)',
          900: 'var(--color-success-900)',
        },

        warning: {
          DEFAULT: 'var(--bg-warning)',
          subtle: 'var(--bg-warning-subtle)',
          foreground: 'var(--text-on-warning)',
          text: 'var(--text-warning)',
          border: 'var(--border-warning)',
          50: 'var(--color-warning-50)',
          100: 'var(--color-warning-100)',
          200: 'var(--color-warning-200)',
          300: 'var(--color-warning-300)',
          400: 'var(--color-warning-400)',
          500: 'var(--color-warning-500)',
          600: 'var(--color-warning-600)',
          700: 'var(--color-warning-700)',
          800: 'var(--color-warning-800)',
          900: 'var(--color-warning-900)',
        },

        danger: {
          DEFAULT: 'var(--bg-danger)',
          subtle: 'var(--bg-danger-subtle)',
          foreground: 'var(--text-on-danger)',
          text: 'var(--text-danger)',
          border: 'var(--border-danger)',
          50: 'var(--color-danger-50)',
          100: 'var(--color-danger-100)',
          200: 'var(--color-danger-200)',
          300: 'var(--color-danger-300)',
          400: 'var(--color-danger-400)',
          500: 'var(--color-danger-500)',
          600: 'var(--color-danger-600)',
          700: 'var(--color-danger-700)',
          800: 'var(--color-danger-800)',
          900: 'var(--color-danger-900)',
        },

        info: {
          DEFAULT: 'var(--bg-info)',
          subtle: 'var(--bg-info-subtle)',
          foreground: 'var(--text-on-info)',
          text: 'var(--text-info)',
          border: 'var(--border-info)',
          50: 'var(--color-info-50)',
          100: 'var(--color-info-100)',
          200: 'var(--color-info-200)',
          300: 'var(--color-info-300)',
          400: 'var(--color-info-400)',
          500: 'var(--color-info-500)',
          600: 'var(--color-info-600)',
          700: 'var(--color-info-700)',
          800: 'var(--color-info-800)',
          900: 'var(--color-info-900)',
        },

        // Neutral palette
        neutral: {
          25: 'var(--color-neutral-25)',
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
          950: 'var(--color-neutral-950)',
        },

        // Diff colors
        diff: {
          'add-bg': 'var(--diff-add-bg)',
          'add-text': 'var(--diff-add-text)',
          'remove-bg': 'var(--diff-remove-bg)',
          'remove-text': 'var(--diff-remove-text)',
          'change-bg': 'var(--diff-change-bg)',
          'change-text': 'var(--diff-change-text)',
        },

        // Code colors
        code: {
          bg: 'var(--code-bg)',
          text: 'var(--code-text)',
          comment: 'var(--code-comment)',
          keyword: 'var(--code-keyword)',
          string: 'var(--code-string)',
          number: 'var(--code-number)',
          function: 'var(--code-function)',
          variable: 'var(--code-variable)',
          operator: 'var(--code-operator)',
        },
      },

      // ============================================
      // TYPOGRAPHY
      // ============================================
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
      },

      fontSize: {
        '2xs': ['var(--text-2xs)', { lineHeight: 'var(--leading-normal)' }],
        xs: ['var(--text-xs)', { lineHeight: 'var(--leading-normal)' }],
        sm: ['var(--text-sm)', { lineHeight: 'var(--leading-normal)' }],
        base: ['var(--text-base)', { lineHeight: 'var(--leading-normal)' }],
        md: ['var(--text-md)', { lineHeight: 'var(--leading-normal)' }],
        lg: ['var(--text-lg)', { lineHeight: 'var(--leading-snug)' }],
        xl: ['var(--text-xl)', { lineHeight: 'var(--leading-snug)' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-tight)' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
        '4xl': ['var(--text-4xl)', { lineHeight: 'var(--leading-tight)' }],
        '5xl': ['var(--text-5xl)', { lineHeight: 'var(--leading-none)' }],
        '6xl': ['var(--text-6xl)', { lineHeight: 'var(--leading-none)' }],
      },

      lineHeight: {
        none: 'var(--leading-none)',
        tight: 'var(--leading-tight)',
        snug: 'var(--leading-snug)',
        normal: 'var(--leading-normal)',
        relaxed: 'var(--leading-relaxed)',
        loose: 'var(--leading-loose)',
      },

      letterSpacing: {
        tighter: 'var(--tracking-tighter)',
        tight: 'var(--tracking-tight)',
        normal: 'var(--tracking-normal)',
        wide: 'var(--tracking-wide)',
        wider: 'var(--tracking-wider)',
        widest: 'var(--tracking-widest)',
      },

      // ============================================
      // SPACING
      // ============================================
      spacing: {
        'px': 'var(--space-px)',
        '0.5': 'var(--space-0-5)',
        '1': 'var(--space-1)',
        '1.5': 'var(--space-1-5)',
        '2': 'var(--space-2)',
        '2.5': 'var(--space-2-5)',
        '3': 'var(--space-3)',
        '3.5': 'var(--space-3-5)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '7': 'var(--space-7)',
        '8': 'var(--space-8)',
        '9': 'var(--space-9)',
        '10': 'var(--space-10)',
        '11': 'var(--space-11)',
        '12': 'var(--space-12)',
        '14': 'var(--space-14)',
        '16': 'var(--space-16)',
        '20': 'var(--space-20)',
        '24': 'var(--space-24)',
        '28': 'var(--space-28)',
        '32': 'var(--space-32)',
        // Layout dimensions
        'sidebar': 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
        'header': 'var(--header-height)',
        'bottom-nav': 'var(--bottom-nav-height)',
      },

      // ============================================
      // BORDER RADIUS
      // ============================================
      borderRadius: {
        none: 'var(--radius-none)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: 'var(--radius-full)',
      },

      // ============================================
      // SHADOWS
      // ============================================
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        inner: 'var(--shadow-inner)',
        primary: 'var(--shadow-primary)',
        accent: 'var(--shadow-accent)',
        none: 'none',
      },

      // ============================================
      // TRANSITIONS
      // ============================================
      transitionDuration: {
        '0': 'var(--duration-instant)',
        '75': 'var(--duration-75)',
        '100': 'var(--duration-100)',
        '150': 'var(--duration-150)',
        '200': 'var(--duration-200)',
        '300': 'var(--duration-300)',
        '500': 'var(--duration-500)',
        '700': 'var(--duration-700)',
        '1000': 'var(--duration-1000)',
      },

      transitionTimingFunction: {
        DEFAULT: 'var(--ease-out)',
        linear: 'var(--ease-linear)',
        in: 'var(--ease-in)',
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        bounce: 'var(--ease-bounce)',
        spring: 'var(--ease-spring)',
        smooth: 'var(--ease-smooth)',
      },

      // ============================================
      // Z-INDEX
      // ============================================
      zIndex: {
        deep: 'var(--z-deep)',
        base: 'var(--z-base)',
        elevated: 'var(--z-elevated)',
        sticky: 'var(--z-sticky)',
        header: 'var(--z-header)',
        sidebar: 'var(--z-sidebar)',
        dropdown: 'var(--z-dropdown)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        tooltip: 'var(--z-tooltip)',
        toast: 'var(--z-toast)',
        spotlight: 'var(--z-spotlight)',
        max: 'var(--z-max)',
      },

      // ============================================
      // MAX-WIDTH (Content containers)
      // ============================================
      maxWidth: {
        content: 'var(--content-max-width)',
        'content-narrow': 'var(--content-max-width-narrow)',
        'content-wide': 'var(--content-max-width-wide)',
        'modal-sm': 'var(--modal-width-sm)',
        'modal-md': 'var(--modal-width-md)',
        'modal-lg': 'var(--modal-width-lg)',
        'modal-xl': 'var(--modal-width-xl)',
        toast: 'var(--toast-max-width)',
        tooltip: 'var(--tooltip-max-width)',
      },

      // ============================================
      // WIDTH/HEIGHT (Component sizes)
      // ============================================
      width: {
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
        'sidebar-mobile': 'var(--sidebar-width-mobile)',
      },

      height: {
        header: 'var(--header-height)',
        'header-mobile': 'var(--header-height-mobile)',
        'bottom-nav': 'var(--bottom-nav-height)',
        'btn-xs': 'var(--btn-height-xs)',
        'btn-sm': 'var(--btn-height-sm)',
        'btn-md': 'var(--btn-height-md)',
        'btn-lg': 'var(--btn-height-lg)',
        'btn-xl': 'var(--btn-height-xl)',
        'input-sm': 'var(--input-height-sm)',
        'input-md': 'var(--input-height-md)',
        'input-lg': 'var(--input-height-lg)',
        'table-row': 'var(--table-row-height)',
        'table-header': 'var(--table-header-height)',
        'dropdown-item': 'var(--dropdown-item-height)',
        tab: 'var(--tab-height)',
      },

      // ============================================
      // ANIMATIONS & KEYFRAMES
      // ============================================
      animation: {
        'fade-in': 'fadeIn var(--duration-200) var(--ease-out)',
        'fade-out': 'fadeOut var(--duration-200) var(--ease-out)',
        'slide-up': 'slideUp var(--duration-300) var(--ease-out)',
        'slide-down': 'slideDown var(--duration-300) var(--ease-out)',
        'slide-left': 'slideLeft var(--duration-300) var(--ease-out)',
        'slide-right': 'slideRight var(--duration-300) var(--ease-out)',
        'scale-in': 'scaleIn var(--duration-200) var(--ease-spring)',
        'scale-out': 'scaleOut var(--duration-150) var(--ease-in)',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'bounce-soft': 'bounceSoft 0.5s ease-in-out',
        shimmer: 'shimmer 2s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      // ============================================
      // BACKGROUND IMAGE (Gradients)
      // ============================================
      backgroundImage: {
        'gradient-brand': 'var(--gradient-brand)',
        'gradient-brand-hover': 'var(--gradient-brand-hover)',
        'gradient-brand-subtle': 'var(--gradient-brand-subtle)',
        'gradient-brand-vertical': 'var(--gradient-brand-vertical)',
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-primary-subtle': 'var(--gradient-primary-subtle)',
        'gradient-accent': 'var(--gradient-accent)',
        'gradient-accent-subtle': 'var(--gradient-accent-subtle)',
        'gradient-success': 'var(--gradient-success)',
        'gradient-warning': 'var(--gradient-warning)',
        'gradient-danger': 'var(--gradient-danger)',
        'gradient-info': 'var(--gradient-info)',
        'gradient-surface': 'var(--gradient-surface)',
        'gradient-glow': 'var(--gradient-glow)',
        'gradient-spotlight': 'var(--gradient-spotlight)',
      },

      // ============================================
      // RING (Focus states)
      // ============================================
      ringColor: {
        DEFAULT: 'var(--ring-color)',
        primary: 'var(--color-primary-500)',
        accent: 'var(--color-accent-500)',
        danger: 'var(--color-danger-500)',
      },

      ringOffsetColor: {
        DEFAULT: 'var(--ring-offset-color)',
      },

      ringOffsetWidth: {
        DEFAULT: 'var(--ring-offset)',
      },

      ringWidth: {
        DEFAULT: 'var(--ring-width)',
      },
    },
  },
  plugins: [],
};
