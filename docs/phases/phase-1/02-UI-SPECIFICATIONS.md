# Phase 1: UI Specifications

## Design Philosophy

### Core Principles
1. **No Hardcoded Values**: Every visual property uses design tokens
2. **Theme-Agnostic Components**: Components work in any theme context
3. **Accessibility-First**: WCAG 2.1 AAA as the baseline
4. **Motion with Purpose**: Animations convey meaning, not decoration
5. **Progressive Disclosure**: Show what's needed, reveal on demand

---

## 1. Design Token System

### 1.1 Color Tokens

```css
/* Base color palette - NEVER USE DIRECTLY IN COMPONENTS */
:root {
  /* Primary palette (auto-generated from brand color) */
  --hw-color-primary-50: oklch(97% 0.01 var(--hw-brand-hue));
  --hw-color-primary-100: oklch(94% 0.03 var(--hw-brand-hue));
  --hw-color-primary-200: oklch(88% 0.06 var(--hw-brand-hue));
  --hw-color-primary-300: oklch(80% 0.10 var(--hw-brand-hue));
  --hw-color-primary-400: oklch(70% 0.14 var(--hw-brand-hue));
  --hw-color-primary-500: oklch(60% 0.16 var(--hw-brand-hue));
  --hw-color-primary-600: oklch(50% 0.14 var(--hw-brand-hue));
  --hw-color-primary-700: oklch(42% 0.12 var(--hw-brand-hue));
  --hw-color-primary-800: oklch(35% 0.10 var(--hw-brand-hue));
  --hw-color-primary-900: oklch(28% 0.08 var(--hw-brand-hue));
  --hw-color-primary-950: oklch(20% 0.06 var(--hw-brand-hue));

  /* Neutral palette */
  --hw-color-neutral-0: oklch(100% 0 0);
  --hw-color-neutral-50: oklch(98% 0.002 var(--hw-brand-hue));
  --hw-color-neutral-100: oklch(96% 0.004 var(--hw-brand-hue));
  --hw-color-neutral-200: oklch(92% 0.006 var(--hw-brand-hue));
  --hw-color-neutral-300: oklch(86% 0.008 var(--hw-brand-hue));
  --hw-color-neutral-400: oklch(70% 0.01 var(--hw-brand-hue));
  --hw-color-neutral-500: oklch(55% 0.01 var(--hw-brand-hue));
  --hw-color-neutral-600: oklch(45% 0.01 var(--hw-brand-hue));
  --hw-color-neutral-700: oklch(35% 0.01 var(--hw-brand-hue));
  --hw-color-neutral-800: oklch(25% 0.008 var(--hw-brand-hue));
  --hw-color-neutral-900: oklch(18% 0.006 var(--hw-brand-hue));
  --hw-color-neutral-950: oklch(12% 0.004 var(--hw-brand-hue));
  --hw-color-neutral-1000: oklch(0% 0 0);

  /* Semantic status colors */
  --hw-color-success-base: oklch(65% 0.18 145);
  --hw-color-warning-base: oklch(75% 0.16 80);
  --hw-color-error-base: oklch(55% 0.22 25);
  --hw-color-info-base: oklch(60% 0.16 230);
}

/* Semantic tokens - USE THESE IN COMPONENTS */
:root[data-theme="light"] {
  /* Surfaces */
  --hw-surface-page: var(--hw-color-neutral-50);
  --hw-surface-primary: var(--hw-color-neutral-0);
  --hw-surface-secondary: var(--hw-color-neutral-100);
  --hw-surface-tertiary: var(--hw-color-neutral-200);
  --hw-surface-elevated: var(--hw-color-neutral-0);
  --hw-surface-overlay: oklch(0% 0 0 / 0.5);
  --hw-surface-inverse: var(--hw-color-neutral-900);

  /* Content */
  --hw-content-primary: var(--hw-color-neutral-900);
  --hw-content-secondary: var(--hw-color-neutral-600);
  --hw-content-tertiary: var(--hw-color-neutral-500);
  --hw-content-disabled: var(--hw-color-neutral-400);
  --hw-content-inverse: var(--hw-color-neutral-0);
  --hw-content-brand: var(--hw-color-primary-600);

  /* Interactive elements */
  --hw-interactive-primary: var(--hw-color-primary-600);
  --hw-interactive-primary-hover: var(--hw-color-primary-700);
  --hw-interactive-primary-active: var(--hw-color-primary-800);
  --hw-interactive-secondary: var(--hw-color-neutral-200);
  --hw-interactive-secondary-hover: var(--hw-color-neutral-300);

  /* Borders */
  --hw-border-default: var(--hw-color-neutral-200);
  --hw-border-subtle: var(--hw-color-neutral-100);
  --hw-border-strong: var(--hw-color-neutral-400);
  --hw-border-focus: var(--hw-color-primary-500);
  --hw-border-focus-ring: oklch(from var(--hw-color-primary-500) l c h / 0.4);

  /* Status colors */
  --hw-status-success: var(--hw-color-success-base);
  --hw-status-success-subtle: oklch(from var(--hw-color-success-base) 95% 0.04 h);
  --hw-status-warning: var(--hw-color-warning-base);
  --hw-status-warning-subtle: oklch(from var(--hw-color-warning-base) 95% 0.04 h);
  --hw-status-error: var(--hw-color-error-base);
  --hw-status-error-subtle: oklch(from var(--hw-color-error-base) 95% 0.04 h);
  --hw-status-info: var(--hw-color-info-base);
  --hw-status-info-subtle: oklch(from var(--hw-color-info-base) 95% 0.04 h);
}

:root[data-theme="dark"] {
  /* Surfaces */
  --hw-surface-page: var(--hw-color-neutral-950);
  --hw-surface-primary: var(--hw-color-neutral-900);
  --hw-surface-secondary: var(--hw-color-neutral-800);
  --hw-surface-tertiary: var(--hw-color-neutral-700);
  --hw-surface-elevated: var(--hw-color-neutral-800);
  --hw-surface-overlay: oklch(0% 0 0 / 0.7);
  --hw-surface-inverse: var(--hw-color-neutral-100);

  /* Content */
  --hw-content-primary: var(--hw-color-neutral-50);
  --hw-content-secondary: var(--hw-color-neutral-300);
  --hw-content-tertiary: var(--hw-color-neutral-400);
  --hw-content-disabled: var(--hw-color-neutral-600);
  --hw-content-inverse: var(--hw-color-neutral-900);
  --hw-content-brand: var(--hw-color-primary-400);

  /* Interactive elements */
  --hw-interactive-primary: var(--hw-color-primary-500);
  --hw-interactive-primary-hover: var(--hw-color-primary-400);
  --hw-interactive-primary-active: var(--hw-color-primary-300);
  --hw-interactive-secondary: var(--hw-color-neutral-700);
  --hw-interactive-secondary-hover: var(--hw-color-neutral-600);

  /* Borders */
  --hw-border-default: var(--hw-color-neutral-700);
  --hw-border-subtle: var(--hw-color-neutral-800);
  --hw-border-strong: var(--hw-color-neutral-500);
  --hw-border-focus: var(--hw-color-primary-400);
  --hw-border-focus-ring: oklch(from var(--hw-color-primary-400) l c h / 0.4);
}

/* High contrast mode */
:root[data-high-contrast="true"] {
  --hw-content-primary: var(--hw-color-neutral-1000);
  --hw-content-secondary: var(--hw-color-neutral-800);
  --hw-border-default: var(--hw-color-neutral-600);
  --hw-border-focus: var(--hw-color-neutral-1000);
  --hw-border-focus-ring: oklch(0% 0 0 / 0.6);
}
```

### 1.2 Typography Tokens

```css
:root {
  /* Font families */
  --hw-font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --hw-font-family-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

  /* Font sizes - fluid typography */
  --hw-font-size-xs: clamp(0.7rem, 0.65rem + 0.25vw, 0.75rem);
  --hw-font-size-sm: clamp(0.8rem, 0.75rem + 0.25vw, 0.875rem);
  --hw-font-size-md: clamp(0.9rem, 0.85rem + 0.25vw, 1rem);
  --hw-font-size-lg: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --hw-font-size-xl: clamp(1.1rem, 1rem + 0.5vw, 1.25rem);
  --hw-font-size-2xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
  --hw-font-size-3xl: clamp(1.5rem, 1.25rem + 1.25vw, 1.875rem);
  --hw-font-size-4xl: clamp(1.875rem, 1.5rem + 1.875vw, 2.25rem);
  --hw-font-size-5xl: clamp(2.25rem, 1.75rem + 2.5vw, 3rem);

  /* Font weights */
  --hw-font-weight-normal: 400;
  --hw-font-weight-medium: 500;
  --hw-font-weight-semibold: 600;
  --hw-font-weight-bold: 700;

  /* Line heights */
  --hw-line-height-tight: 1.25;
  --hw-line-height-normal: 1.5;
  --hw-line-height-relaxed: 1.75;

  /* Letter spacing */
  --hw-letter-spacing-tight: -0.02em;
  --hw-letter-spacing-normal: 0;
  --hw-letter-spacing-wide: 0.02em;
  --hw-letter-spacing-wider: 0.05em;
}

/* Typography presets - USE THESE */
.hw-text-heading-1 {
  font-family: var(--hw-font-family-primary);
  font-size: var(--hw-font-size-5xl);
  font-weight: var(--hw-font-weight-bold);
  line-height: var(--hw-line-height-tight);
  letter-spacing: var(--hw-letter-spacing-tight);
}

.hw-text-heading-2 {
  font-family: var(--hw-font-family-primary);
  font-size: var(--hw-font-size-4xl);
  font-weight: var(--hw-font-weight-semibold);
  line-height: var(--hw-line-height-tight);
}

.hw-text-heading-3 {
  font-family: var(--hw-font-family-primary);
  font-size: var(--hw-font-size-3xl);
  font-weight: var(--hw-font-weight-semibold);
  line-height: var(--hw-line-height-tight);
}

.hw-text-heading-4 {
  font-family: var(--hw-font-family-primary);
  font-size: var(--hw-font-size-2xl);
  font-weight: var(--hw-font-weight-semibold);
  line-height: var(--hw-line-height-normal);
}

.hw-text-body {
  font-family: var(--hw-font-family-primary);
  font-size: var(--hw-font-size-md);
  font-weight: var(--hw-font-weight-normal);
  line-height: var(--hw-line-height-normal);
}

.hw-text-body-sm {
  font-family: var(--hw-font-family-primary);
  font-size: var(--hw-font-size-sm);
  font-weight: var(--hw-font-weight-normal);
  line-height: var(--hw-line-height-normal);
}

.hw-text-caption {
  font-family: var(--hw-font-family-primary);
  font-size: var(--hw-font-size-xs);
  font-weight: var(--hw-font-weight-normal);
  line-height: var(--hw-line-height-normal);
  letter-spacing: var(--hw-letter-spacing-wide);
}

.hw-text-label {
  font-family: var(--hw-font-family-primary);
  font-size: var(--hw-font-size-sm);
  font-weight: var(--hw-font-weight-medium);
  line-height: var(--hw-line-height-normal);
}

.hw-text-code {
  font-family: var(--hw-font-family-mono);
  font-size: var(--hw-font-size-sm);
  line-height: var(--hw-line-height-relaxed);
}
```

### 1.3 Spacing Tokens

```css
:root {
  /* Base unit: 4px */
  --hw-space-0: 0;
  --hw-space-1: 0.25rem;   /* 4px */
  --hw-space-2: 0.5rem;    /* 8px */
  --hw-space-3: 0.75rem;   /* 12px */
  --hw-space-4: 1rem;      /* 16px */
  --hw-space-5: 1.25rem;   /* 20px */
  --hw-space-6: 1.5rem;    /* 24px */
  --hw-space-8: 2rem;      /* 32px */
  --hw-space-10: 2.5rem;   /* 40px */
  --hw-space-12: 3rem;     /* 48px */
  --hw-space-16: 4rem;     /* 64px */
  --hw-space-20: 5rem;     /* 80px */
  --hw-space-24: 6rem;     /* 96px */

  /* Semantic spacing */
  --hw-spacing-inline-xs: var(--hw-space-1);
  --hw-spacing-inline-sm: var(--hw-space-2);
  --hw-spacing-inline-md: var(--hw-space-3);
  --hw-spacing-inline-lg: var(--hw-space-4);

  --hw-spacing-block-xs: var(--hw-space-1);
  --hw-spacing-block-sm: var(--hw-space-2);
  --hw-spacing-block-md: var(--hw-space-4);
  --hw-spacing-block-lg: var(--hw-space-6);
  --hw-spacing-block-xl: var(--hw-space-8);

  /* Component-specific */
  --hw-spacing-card-padding: var(--hw-space-4);
  --hw-spacing-input-padding-x: var(--hw-space-3);
  --hw-spacing-input-padding-y: var(--hw-space-2);
  --hw-spacing-button-padding-x: var(--hw-space-4);
  --hw-spacing-button-padding-y: var(--hw-space-2);
}
```

### 1.4 Shadow Tokens

```css
:root {
  --hw-shadow-xs: 0 1px 2px oklch(0% 0 0 / 0.05);
  --hw-shadow-sm: 0 1px 3px oklch(0% 0 0 / 0.1), 0 1px 2px oklch(0% 0 0 / 0.06);
  --hw-shadow-md: 0 4px 6px oklch(0% 0 0 / 0.1), 0 2px 4px oklch(0% 0 0 / 0.06);
  --hw-shadow-lg: 0 10px 15px oklch(0% 0 0 / 0.1), 0 4px 6px oklch(0% 0 0 / 0.05);
  --hw-shadow-xl: 0 20px 25px oklch(0% 0 0 / 0.1), 0 10px 10px oklch(0% 0 0 / 0.04);
  --hw-shadow-2xl: 0 25px 50px oklch(0% 0 0 / 0.25);

  /* Inset shadows */
  --hw-shadow-inner: inset 0 2px 4px oklch(0% 0 0 / 0.06);

  /* Focus ring */
  --hw-shadow-focus: 0 0 0 3px var(--hw-border-focus-ring);
}

/* Dark mode shadows */
:root[data-theme="dark"] {
  --hw-shadow-xs: 0 1px 2px oklch(0% 0 0 / 0.2);
  --hw-shadow-sm: 0 1px 3px oklch(0% 0 0 / 0.3), 0 1px 2px oklch(0% 0 0 / 0.2);
  --hw-shadow-md: 0 4px 6px oklch(0% 0 0 / 0.3), 0 2px 4px oklch(0% 0 0 / 0.2);
  --hw-shadow-lg: 0 10px 15px oklch(0% 0 0 / 0.3), 0 4px 6px oklch(0% 0 0 / 0.15);
  --hw-shadow-xl: 0 20px 25px oklch(0% 0 0 / 0.3), 0 10px 10px oklch(0% 0 0 / 0.15);
}
```

### 1.5 Border Radius Tokens

```css
:root {
  --hw-radius-none: 0;
  --hw-radius-sm: 0.25rem;   /* 4px */
  --hw-radius-md: 0.5rem;    /* 8px */
  --hw-radius-lg: 0.75rem;   /* 12px */
  --hw-radius-xl: 1rem;      /* 16px */
  --hw-radius-2xl: 1.5rem;   /* 24px */
  --hw-radius-full: 9999px;

  /* Component-specific */
  --hw-radius-button: var(--hw-radius-md);
  --hw-radius-input: var(--hw-radius-md);
  --hw-radius-card: var(--hw-radius-lg);
  --hw-radius-modal: var(--hw-radius-xl);
  --hw-radius-badge: var(--hw-radius-full);
  --hw-radius-avatar: var(--hw-radius-full);
}
```

### 1.6 Animation Tokens

```css
:root {
  /* Durations */
  --hw-duration-instant: 0ms;
  --hw-duration-fast: 100ms;
  --hw-duration-normal: 200ms;
  --hw-duration-slow: 300ms;
  --hw-duration-slower: 500ms;

  /* Easing functions */
  --hw-ease-linear: linear;
  --hw-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --hw-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --hw-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --hw-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --hw-ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* Presets */
  --hw-transition-colors: color var(--hw-duration-fast) var(--hw-ease-out),
                          background-color var(--hw-duration-fast) var(--hw-ease-out),
                          border-color var(--hw-duration-fast) var(--hw-ease-out);
  --hw-transition-opacity: opacity var(--hw-duration-normal) var(--hw-ease-out);
  --hw-transition-transform: transform var(--hw-duration-normal) var(--hw-ease-out);
  --hw-transition-all: all var(--hw-duration-normal) var(--hw-ease-out);
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  :root {
    --hw-duration-fast: 0ms;
    --hw-duration-normal: 0ms;
    --hw-duration-slow: 0ms;
    --hw-duration-slower: 0ms;
  }
}
```

---

## 2. Component Specifications

### 2.1 Button Component

```tsx
// Component API
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: string;      // Icon token
  rightIcon?: string;     // Icon token
  children: React.ReactNode;
  onClick?: () => void;
}

// Styling (uses only tokens)
const buttonStyles = {
  base: `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--hw-spacing-inline-sm);
    font-family: var(--hw-font-family-primary);
    font-weight: var(--hw-font-weight-medium);
    border-radius: var(--hw-radius-button);
    transition: var(--hw-transition-colors);
    cursor: pointer;

    &:focus-visible {
      outline: none;
      box-shadow: var(--hw-shadow-focus);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,

  variants: {
    primary: `
      background: var(--hw-interactive-primary);
      color: var(--hw-content-inverse);
      border: 1px solid transparent;

      &:hover:not(:disabled) {
        background: var(--hw-interactive-primary-hover);
      }

      &:active:not(:disabled) {
        background: var(--hw-interactive-primary-active);
      }
    `,
    secondary: `
      background: var(--hw-interactive-secondary);
      color: var(--hw-content-primary);
      border: 1px solid var(--hw-border-default);

      &:hover:not(:disabled) {
        background: var(--hw-interactive-secondary-hover);
        border-color: var(--hw-border-strong);
      }
    `,
    ghost: `
      background: transparent;
      color: var(--hw-content-primary);
      border: 1px solid transparent;

      &:hover:not(:disabled) {
        background: var(--hw-interactive-secondary);
      }
    `,
    danger: `
      background: var(--hw-status-error);
      color: var(--hw-content-inverse);
      border: 1px solid transparent;

      &:hover:not(:disabled) {
        background: oklch(from var(--hw-status-error) calc(l - 0.05) c h);
      }
    `,
  },

  sizes: {
    sm: `
      height: 2rem;
      padding: 0 var(--hw-space-3);
      font-size: var(--hw-font-size-sm);
    `,
    md: `
      height: 2.5rem;
      padding: 0 var(--hw-space-4);
      font-size: var(--hw-font-size-md);
    `,
    lg: `
      height: 3rem;
      padding: 0 var(--hw-space-6);
      font-size: var(--hw-font-size-lg);
    `,
  },
};
```

### 2.2 Input Component

```tsx
interface InputProps {
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  size: 'sm' | 'md' | 'lg';
  variant: 'outlined' | 'filled' | 'flushed';
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorMessage?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

const inputStyles = {
  wrapper: `
    display: flex;
    flex-direction: column;
    gap: var(--hw-spacing-block-xs);
  `,

  label: `
    color: var(--hw-content-secondary);
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-medium);
  `,

  inputWrapper: `
    display: flex;
    align-items: center;
    gap: var(--hw-spacing-inline-sm);
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-input);
    transition: var(--hw-transition-colors);

    &:focus-within {
      border-color: var(--hw-border-focus);
      box-shadow: var(--hw-shadow-focus);
    }

    &[data-error="true"] {
      border-color: var(--hw-status-error);
    }

    &[data-disabled="true"] {
      background: var(--hw-surface-secondary);
      opacity: 0.6;
    }
  `,

  input: `
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--hw-content-primary);
    font-family: var(--hw-font-family-primary);
    font-size: var(--hw-font-size-md);

    &::placeholder {
      color: var(--hw-content-tertiary);
    }
  `,

  helperText: `
    color: var(--hw-content-tertiary);
    font-size: var(--hw-font-size-xs);
  `,

  errorText: `
    color: var(--hw-status-error);
    font-size: var(--hw-font-size-xs);
  `,
};
```

### 2.3 Data Table Component

```tsx
interface DataTableProps<T> {
  // Data
  data: T[];
  columns: ColumnDefinition<T>[];

  // Selection
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (ids: string[]) => void;

  // Sorting
  sortable?: boolean;
  defaultSort?: { column: string; direction: 'asc' | 'desc' };
  onSort?: (column: string, direction: 'asc' | 'desc') => void;

  // Pagination
  paginated?: boolean;
  pageSize?: number;
  currentPage?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;

  // Display
  density: 'compact' | 'comfortable' | 'spacious';
  stickyHeader?: boolean;
  virtualScroll?: boolean;

  // Actions
  onRowClick?: (row: T) => void;
  rowActions?: RowAction<T>[];
  bulkActions?: BulkAction[];

  // Empty state
  emptyState?: React.ReactNode;

  // Loading
  loading?: boolean;
}

const tableStyles = {
  container: `
    width: 100%;
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg);
    overflow: hidden;
  `,

  header: `
    display: grid;
    background: var(--hw-surface-secondary);
    border-bottom: 1px solid var(--hw-border-default);

    &[data-sticky="true"] {
      position: sticky;
      top: 0;
      z-index: var(--hw-z-sticky);
    }
  `,

  headerCell: `
    padding: var(--hw-space-3) var(--hw-space-4);
    color: var(--hw-content-secondary);
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-semibold);
    text-align: left;
    user-select: none;

    &[data-sortable="true"] {
      cursor: pointer;

      &:hover {
        background: var(--hw-surface-tertiary);
      }
    }
  `,

  row: `
    display: grid;
    border-bottom: 1px solid var(--hw-border-subtle);
    transition: var(--hw-transition-colors);

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: var(--hw-surface-secondary);
    }

    &[data-selected="true"] {
      background: oklch(from var(--hw-interactive-primary) l c h / 0.1);
    }
  `,

  cell: `
    padding: var(--hw-space-3) var(--hw-space-4);
    color: var(--hw-content-primary);
    font-size: var(--hw-font-size-sm);
    display: flex;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  densities: {
    compact: {
      headerCell: `padding: var(--hw-space-2) var(--hw-space-3);`,
      cell: `padding: var(--hw-space-2) var(--hw-space-3);`,
    },
    comfortable: {
      headerCell: `padding: var(--hw-space-3) var(--hw-space-4);`,
      cell: `padding: var(--hw-space-3) var(--hw-space-4);`,
    },
    spacious: {
      headerCell: `padding: var(--hw-space-4) var(--hw-space-5);`,
      cell: `padding: var(--hw-space-4) var(--hw-space-5);`,
    },
  },
};
```

---

## 3. Page Layouts

### 3.1 Workspace Shell

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Header                                                      [AVA] [User]│
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Logo   Global Search                         Notifications  Avatar  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├────────────┬────────────────────────────────────────────────────────────┤
│            │ Breadcrumbs: Home > Collections > Incidents                │
│  Sidebar   ├────────────────────────────────────────────────────────────┤
│            │                                                            │
│ ┌────────┐ │                    Main Content                           │
│ │ Nav    │ │                                                            │
│ │ Items  │ │  ┌────────────────────────────────────────────────────┐   │
│ │        │ │  │                                                    │   │
│ │        │ │  │           Page Content Area                       │   │
│ │        │ │  │                                                    │   │
│ │        │ │  │                                                    │   │
│ │        │ │  └────────────────────────────────────────────────────┘   │
│ │        │ │                                                            │
│ └────────┘ │                                                            │
├────────────┴────────────────────────────────────────────────────────────┤
│ AVA Panel (collapsible, right side)                                     │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ How can I help?                                          [Minimize] │ │
│ │                                                                     │ │
│ │ [Chat messages...]                                                  │ │
│ │                                                                     │ │
│ │ [Input field]                                              [Send]  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Collection View Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Page Header                                                             │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [Icon] Incidents                                [+ New] [⋮ Actions] │ │
│ │ 1,234 records • Last updated 5 min ago                              │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ Toolbar                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Views: [All ▼]  Filters: [+ Add]  [🔍 Search]         [📊][📋][📅] │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ Filter Bar (when filters applied)                                       │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Priority = High [×]  Assigned to = Me [×]         [Clear all]      │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ Data Table                                                              │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ □ Number ↕     Short Description          Priority   Status   Owner│ │
│ ├─────────────────────────────────────────────────────────────────────┤ │
│ │ □ INC0001234   Server down in datacenter  ● High     Open     John │ │
│ │ □ INC0001235   Email not syncing          ○ Medium   Working  Jane │ │
│ │ □ INC0001236   VPN connection issues      ○ Low      Pending  Bob  │ │
│ │ ...                                                                 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ Pagination                                                              │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Showing 1-50 of 1,234     [< Prev]  1  2  3  ...  25  [Next >]     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Record Detail Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Record Header                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ← Back                                                              │ │
│ │ INC0001234: Server down in datacenter                               │ │
│ │ Status: ● Open    Priority: ● High    Updated: 5 min ago            │ │
│ │                                           [Edit] [Actions ▼]        │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────┬─────────────────────────────┤
│ Main Content (2/3)                        │ Sidebar (1/3)               │
│ ┌───────────────────────────────────────┐ │ ┌─────────────────────────┐ │
│ │ Tabs: [Details] [Activity] [Related] │ │ │ Quick Info              │ │
│ └───────────────────────────────────────┘ │ │ ─────────────────────── │ │
│                                           │ │ Number: INC0001234      │ │
│ ┌───────────────────────────────────────┐ │ │ Created: Jan 15, 2024   │ │
│ │ Section: Basic Information            │ │ │ Created by: John Doe    │ │
│ │ ─────────────────────────────────────│ │ │ Category: Hardware      │ │
│ │ Short Description                     │ │ └─────────────────────────┘ │
│ │ Server down in datacenter             │ │                             │
│ │                                       │ │ ┌─────────────────────────┐ │
│ │ Description                           │ │ │ Related Records         │ │
│ │ The main production server...         │ │ │ ─────────────────────── │ │
│ └───────────────────────────────────────┘ │ │ • Problem PRB0001       │ │
│                                           │ │ • Change CHG0045        │ │
│ ┌───────────────────────────────────────┐ │ │ • CI: SRV-PROD-01       │ │
│ │ Section: Assignment                   │ │ └─────────────────────────┘ │
│ │ ─────────────────────────────────────│ │                             │
│ │ Assigned to: Jane Smith               │ │ ┌─────────────────────────┐ │
│ │ Assignment group: IT Support          │ │ │ Activity                │ │
│ └───────────────────────────────────────┘ │ │ ─────────────────────── │ │
│                                           │ │ • John added a comment  │ │
│                                           │ │   5 min ago             │ │
│                                           │ │ • Status changed        │ │
│                                           │ │   10 min ago            │ │
│                                           │ └─────────────────────────┘ │
└───────────────────────────────────────────┴─────────────────────────────┘
```

---

## 4. Responsive Breakpoints

```css
:root {
  /* Breakpoint values */
  --hw-breakpoint-xs: 0;
  --hw-breakpoint-sm: 640px;
  --hw-breakpoint-md: 768px;
  --hw-breakpoint-lg: 1024px;
  --hw-breakpoint-xl: 1280px;
  --hw-breakpoint-2xl: 1536px;

  /* Container max widths */
  --hw-container-sm: 640px;
  --hw-container-md: 768px;
  --hw-container-lg: 1024px;
  --hw-container-xl: 1280px;
  --hw-container-2xl: 1536px;
}

/* Media query helpers */
@custom-media --mobile (max-width: 767px);
@custom-media --tablet (min-width: 768px) and (max-width: 1023px);
@custom-media --desktop (min-width: 1024px);
@custom-media --large-desktop (min-width: 1280px);
```

---

## 5. Accessibility Requirements

### 5.1 Color Contrast
- Normal text: minimum 4.5:1 contrast ratio
- Large text (18px+ or 14px+ bold): minimum 3:1 contrast ratio
- UI components and graphics: minimum 3:1 contrast ratio

### 5.2 Focus Indicators
- All interactive elements must have visible focus states
- Focus ring uses `--hw-shadow-focus` token
- Focus must be visible in all themes including high contrast

### 5.3 Keyboard Navigation
- All functionality accessible via keyboard
- Logical tab order following visual layout
- Skip links for main content
- Escape key closes modals/dropdowns
- Arrow keys for menu navigation

### 5.4 Screen Reader Support
- Semantic HTML elements
- ARIA labels for icons and decorative elements
- Live regions for dynamic content updates
- Proper heading hierarchy
- Form labels and error associations

### 5.5 Motion Preferences
- Respect `prefers-reduced-motion`
- Provide alternatives to animation-dependent interactions
- No flashing content (seizure risk)
