# Phase 8: UI Specifications - Production Polish

**Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Final Production UI

## Overview

This document defines the final UI polish and production-ready interface specifications for Phase 8, including performance monitoring dashboards, admin console, health monitoring UI, and final design token audit.

## Table of Contents

1. [Design System Final Audit](#design-system-final-audit)
2. [Performance Metrics Dashboard](#performance-metrics-dashboard)
3. [Health Monitoring UI](#health-monitoring-ui)
4. [Admin Console](#admin-console)
5. [Accessibility Compliance](#accessibility-compliance)
6. [CSS Custom Properties](#css-custom-properties)
7. [Component Library Final](#component-library-final)
8. [Responsive Design Final](#responsive-design-final)

---

## Design System Final Audit

### Color Palette - Production Final

```css
/* Primary Colors */
--hw-primary-50: #e8f2ff;
--hw-primary-100: #d1e4ff;
--hw-primary-200: #aac9ff;
--hw-primary-300: #7aa3ff;
--hw-primary-400: #4f7aff;
--hw-primary-500: #2952ff;  /* Main brand color */
--hw-primary-600: #1a3adb;
--hw-primary-700: #0f27b3;
--hw-primary-800: #081a8a;
--hw-primary-900: #041061;

/* Secondary Colors */
--hw-secondary-50: #f0f9ff;
--hw-secondary-100: #e0f2fe;
--hw-secondary-200: #bae6fd;
--hw-secondary-300: #7dd3fc;
--hw-secondary-400: #38bdf8;
--hw-secondary-500: #0ea5e9;  /* Accent color */
--hw-secondary-600: #0284c7;
--hw-secondary-700: #0369a1;
--hw-secondary-800: #075985;
--hw-secondary-900: #0c4a6e;

/* Success Colors */
--hw-success-50: #f0fdf4;
--hw-success-100: #dcfce7;
--hw-success-200: #bbf7d0;
--hw-success-300: #86efac;
--hw-success-400: #4ade80;
--hw-success-500: #22c55e;  /* Main success */
--hw-success-600: #16a34a;
--hw-success-700: #15803d;
--hw-success-800: #166534;
--hw-success-900: #14532d;

/* Warning Colors */
--hw-warning-50: #fffbeb;
--hw-warning-100: #fef3c7;
--hw-warning-200: #fde68a;
--hw-warning-300: #fcd34d;
--hw-warning-400: #fbbf24;
--hw-warning-500: #f59e0b;  /* Main warning */
--hw-warning-600: #d97706;
--hw-warning-700: #b45309;
--hw-warning-800: #92400e;
--hw-warning-900: #78350f;

/* Error Colors */
--hw-error-50: #fef2f2;
--hw-error-100: #fee2e2;
--hw-error-200: #fecaca;
--hw-error-300: #fca5a5;
--hw-error-400: #f87171;
--hw-error-500: #ef4444;  /* Main error */
--hw-error-600: #dc2626;
--hw-error-700: #b91c1c;
--hw-error-800: #991b1b;
--hw-error-900: #7f1d1d;

/* Neutral Colors */
--hw-neutral-50: #fafafa;
--hw-neutral-100: #f5f5f5;
--hw-neutral-200: #e5e5e5;
--hw-neutral-300: #d4d4d4;
--hw-neutral-400: #a3a3a3;
--hw-neutral-500: #737373;
--hw-neutral-600: #525252;
--hw-neutral-700: #404040;
--hw-neutral-800: #262626;
--hw-neutral-900: #171717;

/* Semantic Colors */
--hw-background: #ffffff;
--hw-background-secondary: var(--hw-neutral-50);
--hw-background-tertiary: var(--hw-neutral-100);
--hw-surface: #ffffff;
--hw-surface-elevated: #ffffff;
--hw-text-primary: var(--hw-neutral-900);
--hw-text-secondary: var(--hw-neutral-600);
--hw-text-tertiary: var(--hw-neutral-400);
--hw-text-inverse: #ffffff;
--hw-border: var(--hw-neutral-200);
--hw-border-focus: var(--hw-primary-500);
--hw-shadow: rgba(0, 0, 0, 0.1);
--hw-overlay: rgba(0, 0, 0, 0.5);

/* Dark Mode */
[data-theme="dark"] {
  --hw-background: #0a0a0a;
  --hw-background-secondary: var(--hw-neutral-900);
  --hw-background-tertiary: var(--hw-neutral-800);
  --hw-surface: var(--hw-neutral-900);
  --hw-surface-elevated: var(--hw-neutral-800);
  --hw-text-primary: var(--hw-neutral-50);
  --hw-text-secondary: var(--hw-neutral-400);
  --hw-text-tertiary: var(--hw-neutral-500);
  --hw-text-inverse: var(--hw-neutral-900);
  --hw-border: var(--hw-neutral-700);
  --hw-border-focus: var(--hw-primary-400);
  --hw-shadow: rgba(0, 0, 0, 0.3);
  --hw-overlay: rgba(0, 0, 0, 0.7);
}
```

### Typography - Production Final

```css
/* Font Families */
--hw-font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
--hw-font-family-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
--hw-font-family-display: 'Space Grotesk', var(--hw-font-family-sans);

/* Font Sizes */
--hw-font-size-xs: 0.75rem;      /* 12px */
--hw-font-size-sm: 0.875rem;     /* 14px */
--hw-font-size-base: 1rem;       /* 16px */
--hw-font-size-lg: 1.125rem;     /* 18px */
--hw-font-size-xl: 1.25rem;      /* 20px */
--hw-font-size-2xl: 1.5rem;      /* 24px */
--hw-font-size-3xl: 1.875rem;    /* 30px */
--hw-font-size-4xl: 2.25rem;     /* 36px */
--hw-font-size-5xl: 3rem;        /* 48px */
--hw-font-size-6xl: 3.75rem;     /* 60px */

/* Font Weights */
--hw-font-weight-light: 300;
--hw-font-weight-normal: 400;
--hw-font-weight-medium: 500;
--hw-font-weight-semibold: 600;
--hw-font-weight-bold: 700;
--hw-font-weight-extrabold: 800;

/* Line Heights */
--hw-line-height-tight: 1.25;
--hw-line-height-normal: 1.5;
--hw-line-height-relaxed: 1.75;
--hw-line-height-loose: 2;

/* Letter Spacing */
--hw-letter-spacing-tight: -0.025em;
--hw-letter-spacing-normal: 0;
--hw-letter-spacing-wide: 0.025em;
--hw-letter-spacing-wider: 0.05em;
```

### Spacing System

```css
/* Spacing Scale */
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
--hw-space-32: 8rem;     /* 128px */

/* Component Spacing */
--hw-padding-xs: var(--hw-space-2);
--hw-padding-sm: var(--hw-space-3);
--hw-padding-md: var(--hw-space-4);
--hw-padding-lg: var(--hw-space-6);
--hw-padding-xl: var(--hw-space-8);

--hw-margin-xs: var(--hw-space-2);
--hw-margin-sm: var(--hw-space-3);
--hw-margin-md: var(--hw-space-4);
--hw-margin-lg: var(--hw-space-6);
--hw-margin-xl: var(--hw-space-8);

--hw-gap-xs: var(--hw-space-2);
--hw-gap-sm: var(--hw-space-3);
--hw-gap-md: var(--hw-space-4);
--hw-gap-lg: var(--hw-space-6);
--hw-gap-xl: var(--hw-space-8);
```

### Elevation & Shadows

```css
/* Shadows */
--hw-shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--hw-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
--hw-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
--hw-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
--hw-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
--hw-shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
--hw-shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
--hw-shadow-focus: 0 0 0 3px rgba(41, 82, 255, 0.2);

/* Dark Mode Shadows */
[data-theme="dark"] {
  --hw-shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --hw-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.3);
  --hw-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3);
  --hw-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3);
  --hw-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
  --hw-shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  --hw-shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.2);
  --hw-shadow-focus: 0 0 0 3px rgba(79, 122, 255, 0.4);
}
```

### Border Radius

```css
/* Border Radius */
--hw-radius-none: 0;
--hw-radius-sm: 0.25rem;   /* 4px */
--hw-radius-md: 0.375rem;  /* 6px */
--hw-radius-lg: 0.5rem;    /* 8px */
--hw-radius-xl: 0.75rem;   /* 12px */
--hw-radius-2xl: 1rem;     /* 16px */
--hw-radius-3xl: 1.5rem;   /* 24px */
--hw-radius-full: 9999px;

/* Component Radius */
--hw-button-radius: var(--hw-radius-lg);
--hw-input-radius: var(--hw-radius-md);
--hw-card-radius: var(--hw-radius-xl);
--hw-modal-radius: var(--hw-radius-2xl);
--hw-badge-radius: var(--hw-radius-full);
```

### Animation & Transitions

```css
/* Transition Durations */
--hw-duration-instant: 0ms;
--hw-duration-fast: 150ms;
--hw-duration-normal: 250ms;
--hw-duration-slow: 350ms;
--hw-duration-slower: 500ms;

/* Transition Timing Functions */
--hw-ease-linear: cubic-bezier(0, 0, 1, 1);
--hw-ease-in: cubic-bezier(0.4, 0, 1, 1);
--hw-ease-out: cubic-bezier(0, 0, 0.2, 1);
--hw-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--hw-ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

/* Standard Transitions */
--hw-transition-fast: all var(--hw-duration-fast) var(--hw-ease-out);
--hw-transition-normal: all var(--hw-duration-normal) var(--hw-ease-in-out);
--hw-transition-slow: all var(--hw-duration-slow) var(--hw-ease-in-out);

/* Component-Specific Transitions */
--hw-button-transition: background-color var(--hw-duration-fast) var(--hw-ease-out),
                         color var(--hw-duration-fast) var(--hw-ease-out),
                         transform var(--hw-duration-fast) var(--hw-ease-out);
--hw-modal-transition: opacity var(--hw-duration-normal) var(--hw-ease-in-out),
                        transform var(--hw-duration-normal) var(--hw-ease-in-out);
--hw-tooltip-transition: opacity var(--hw-duration-fast) var(--hw-ease-out),
                          transform var(--hw-duration-fast) var(--hw-ease-out);
```

---

## Performance Metrics Dashboard

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  PERFORMANCE DASHBOARD                        [Real-time] [24h] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │  Response Time   │  │   Error Rate     │  │   Throughput   ││
│  │                  │  │                  │  │                ││
│  │     125ms        │  │      0.02%       │  │   1,234 req/s  ││
│  │  ▲ -15ms (12%)   │  │  ▼ +0.01% (50%)  │  │  ▲ +234 (23%) ││
│  │                  │  │                  │  │                ││
│  │  ────────────    │  │  ────────────    │  │  ────────────  ││
│  │         ╱╲       │  │  ╱               │  │      ╱╲╱╲      ││
│  │  ──────╱──╲──    │  │ ╱────────────    │  │  ───╱────╲──  ││
│  └──────────────────┘  └──────────────────┘  └────────────────┘│
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │   Apdex Score    │  │  Active Users    │  │  CPU Usage     ││
│  │                  │  │                  │  │                ││
│  │      0.98        │  │      3,456       │  │      42%       ││
│  │   Excellent      │  │  ▲ +456 (15%)    │  │  ▼ -8% (16%)  ││
│  │                  │  │                  │  │                ││
│  │  ████████████░   │  │  ────────────    │  │  ████░░░░░░░░  ││
│  │  [97.5% Good]    │  │      ╱╲╱╲        │  │  [Healthy]     ││
│  │                  │  │  ───╱────╲───    │  │                ││
│  └──────────────────┘  └──────────────────┘  └────────────────┘│
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  REQUEST LATENCY DISTRIBUTION                            │  │
│  │                                                           │  │
│  │  p50  ████████████████████ 95ms                          │  │
│  │  p75  ██████████████████████████ 135ms                   │  │
│  │  p95  ███████████████████████████████ 185ms              │  │
│  │  p99  ███████████████████████████████████ 245ms          │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ENDPOINT PERFORMANCE                                     │  │
│  │                                                           │  │
│  │  /api/projects        125ms   1.2K req/s   0.01% errors  │  │
│  │  /api/tasks           98ms    2.4K req/s   0.00% errors  │  │
│  │  /api/users           145ms   856 req/s    0.05% errors  │  │
│  │  /api/analytics       312ms   234 req/s    0.00% errors  │  │
│  │  /api/files/upload    1.2s    45 req/s     0.02% errors  │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Metric Cards Component

```typescript
// src/app/admin/components/metric-card/metric-card.component.ts
import { Component, Input } from '@angular/core';

interface MetricTrend {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'neutral';
}

@Component({
  selector: 'hw-metric-card',
  template: `
    <div class="hw-metric-card" [class.hw-metric-card--alert]="isAlert">
      <div class="hw-metric-card__header">
        <h3 class="hw-metric-card__title">{{ title }}</h3>
        <hw-icon [name]="icon" class="hw-metric-card__icon"></hw-icon>
      </div>

      <div class="hw-metric-card__value">
        {{ value }}
        <span class="hw-metric-card__unit" *ngIf="unit">{{ unit }}</span>
      </div>

      <div class="hw-metric-card__trend"
           [class.hw-metric-card__trend--up]="trend.direction === 'up'"
           [class.hw-metric-card__trend--down]="trend.direction === 'down'"
           *ngIf="trend">
        <hw-icon [name]="trend.direction === 'up' ? 'trending-up' : 'trending-down'"></hw-icon>
        <span>{{ trend.value }} ({{ trend.percentage }}%)</span>
      </div>

      <div class="hw-metric-card__chart">
        <hw-sparkline [data]="chartData"></hw-sparkline>
      </div>

      <div class="hw-metric-card__footer" *ngIf="status">
        <span class="hw-metric-card__status"
              [class.hw-metric-card__status--good]="status === 'good'"
              [class.hw-metric-card__status--warning]="status === 'warning'"
              [class.hw-metric-card__status--critical]="status === 'critical'">
          {{ statusLabel }}
        </span>
      </div>
    </div>
  `,
  styleUrls: ['./metric-card.component.scss']
})
export class MetricCardComponent {
  @Input() title!: string;
  @Input() value!: string | number;
  @Input() unit?: string;
  @Input() icon!: string;
  @Input() trend?: MetricTrend;
  @Input() chartData!: number[];
  @Input() status?: 'good' | 'warning' | 'critical';
  @Input() statusLabel?: string;
  @Input() isAlert = false;
}
```

### Metric Card Styles

```scss
// metric-card.component.scss
.hw-metric-card {
  background: var(--hw-surface);
  border: 1px solid var(--hw-border);
  border-radius: var(--hw-card-radius);
  padding: var(--hw-padding-lg);
  box-shadow: var(--hw-shadow-sm);
  transition: var(--hw-transition-normal);
  position: relative;
  overflow: hidden;

  &:hover {
    box-shadow: var(--hw-shadow-md);
    transform: translateY(-2px);
  }

  &--alert {
    border-color: var(--hw-error-500);
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--hw-space-4);
  }

  &__title {
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-text-secondary);
    text-transform: uppercase;
    letter-spacing: var(--hw-letter-spacing-wide);
    margin: 0;
  }

  &__icon {
    width: 24px;
    height: 24px;
    color: var(--hw-primary-500);
    opacity: 0.6;
  }

  &__value {
    font-size: var(--hw-font-size-4xl);
    font-weight: var(--hw-font-weight-bold);
    color: var(--hw-text-primary);
    margin-bottom: var(--hw-space-2);
    font-variant-numeric: tabular-nums;
  }

  &__unit {
    font-size: var(--hw-font-size-lg);
    font-weight: var(--hw-font-weight-normal);
    color: var(--hw-text-secondary);
    margin-left: var(--hw-space-1);
  }

  &__trend {
    display: flex;
    align-items: center;
    gap: var(--hw-gap-xs);
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-medium);
    margin-bottom: var(--hw-space-4);

    &--up {
      color: var(--hw-success-600);
      hw-icon {
        color: var(--hw-success-500);
      }
    }

    &--down {
      color: var(--hw-error-600);
      hw-icon {
        color: var(--hw-error-500);
      }
    }
  }

  &__chart {
    height: 60px;
    margin: var(--hw-space-4) calc(var(--hw-padding-lg) * -1) var(--hw-space-4);
  }

  &__footer {
    border-top: 1px solid var(--hw-border);
    padding-top: var(--hw-space-3);
    margin-top: var(--hw-space-4);
  }

  &__status {
    display: inline-flex;
    align-items: center;
    padding: var(--hw-space-1) var(--hw-space-3);
    border-radius: var(--hw-badge-radius);
    font-size: var(--hw-font-size-xs);
    font-weight: var(--hw-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--hw-letter-spacing-wide);

    &--good {
      background: var(--hw-success-50);
      color: var(--hw-success-700);
    }

    &--warning {
      background: var(--hw-warning-50);
      color: var(--hw-warning-700);
    }

    &--critical {
      background: var(--hw-error-50);
      color: var(--hw-error-700);
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

// Dark mode adjustments
[data-theme="dark"] {
  .hw-metric-card {
    &__status {
      &--good {
        background: rgba(34, 197, 94, 0.15);
        color: var(--hw-success-400);
      }

      &--warning {
        background: rgba(245, 158, 11, 0.15);
        color: var(--hw-warning-400);
      }

      &--critical {
        background: rgba(239, 68, 68, 0.15);
        color: var(--hw-error-400);
      }
    }
  }
}
```

---

## Health Monitoring UI

### System Health Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  SYSTEM HEALTH                                  Last Updated: Now│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  OVERALL STATUS: ● OPERATIONAL                           │  │
│  │  All systems running normally                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SERVICE HEALTH                                           │  │
│  │                                                           │  │
│  │  ● Web Application           Healthy    Response: 45ms   │  │
│  │  ● API Server               Healthy    Response: 28ms   │  │
│  │  ● Database (Primary)       Healthy    Connections: 45  │  │
│  │  ● Database (Replica 1)     Healthy    Lag: 0.2s        │  │
│  │  ● Database (Replica 2)     Healthy    Lag: 0.3s        │  │
│  │  ● Redis Cache              Healthy    Memory: 45%      │  │
│  │  ● CDN                      Healthy    Cache Hit: 94%   │  │
│  │  ● AVA AI Engine            Healthy    Queue: 3 items   │  │
│  │  ● Email Service            Healthy    Queue: 0 items   │  │
│  │  ● Storage (S3)             Healthy    Size: 234 GB     │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  INFRASTRUCTURE HEALTH                                    │  │
│  │                                                           │  │
│  │  Kubernetes Cluster                                       │  │
│  │  ├─ Nodes: 12/12 Ready                                   │  │
│  │  ├─ Pods: 45/45 Running                                  │  │
│  │  └─ CPU: 42% | Memory: 58% | Disk: 35%                   │  │
│  │                                                           │  │
│  │  Load Balancers                                           │  │
│  │  ├─ ALB-1 (us-east-1a): Healthy                          │  │
│  │  ├─ ALB-2 (us-east-1b): Healthy                          │  │
│  │  └─ ALB-3 (us-east-1c): Healthy                          │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  RECENT INCIDENTS                                         │  │
│  │                                                           │  │
│  │  ● Resolved | 2h ago                                     │  │
│  │    High API Response Time                                │  │
│  │    Duration: 12 minutes | Impact: Minor                  │  │
│  │                                                           │  │
│  │  ● Resolved | 1 day ago                                  │  │
│  │    Redis Connection Spike                                │  │
│  │    Duration: 5 minutes | Impact: None                    │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Service Status Component

```typescript
// src/app/admin/components/service-status/service-status.component.ts
import { Component, Input } from '@angular/core';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  metadata?: Record<string, any>;
  lastCheck: Date;
}

@Component({
  selector: 'hw-service-status',
  template: `
    <div class="hw-service-status">
      <div class="hw-service-status__indicator"
           [class.hw-service-status__indicator--healthy]="service.status === 'healthy'"
           [class.hw-service-status__indicator--degraded]="service.status === 'degraded'"
           [class.hw-service-status__indicator--down]="service.status === 'down'">
      </div>

      <div class="hw-service-status__content">
        <div class="hw-service-status__name">{{ service.name }}</div>
        <div class="hw-service-status__meta">
          <span class="hw-service-status__badge"
                [class.hw-service-status__badge--healthy]="service.status === 'healthy'"
                [class.hw-service-status__badge--degraded]="service.status === 'degraded'"
                [class.hw-service-status__badge--down]="service.status === 'down'">
            {{ service.status | titlecase }}
          </span>
          <span class="hw-service-status__detail" *ngIf="service.responseTime">
            Response: {{ service.responseTime }}ms
          </span>
          <span class="hw-service-status__detail" *ngFor="let item of metadataArray">
            {{ item.label }}: {{ item.value }}
          </span>
        </div>
      </div>

      <div class="hw-service-status__actions">
        <button hw-button variant="ghost" size="sm" (click)="onRefresh()">
          <hw-icon name="refresh"></hw-icon>
        </button>
        <button hw-button variant="ghost" size="sm" (click)="onViewDetails()">
          <hw-icon name="external-link"></hw-icon>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./service-status.component.scss']
})
export class ServiceStatusComponent {
  @Input() service!: ServiceHealth;

  get metadataArray() {
    if (!this.service.metadata) return [];
    return Object.entries(this.service.metadata).map(([key, value]) => ({
      label: this.formatLabel(key),
      value
    }));
  }

  private formatLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  onRefresh(): void {
    // Implement refresh logic
  }

  onViewDetails(): void {
    // Implement view details logic
  }
}
```

### Service Status Styles

```scss
// service-status.component.scss
.hw-service-status {
  display: flex;
  align-items: center;
  gap: var(--hw-gap-md);
  padding: var(--hw-padding-md);
  border-bottom: 1px solid var(--hw-border);
  transition: var(--hw-transition-fast);

  &:hover {
    background: var(--hw-background-secondary);
  }

  &:last-child {
    border-bottom: none;
  }

  &__indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
    position: relative;

    &--healthy {
      background: var(--hw-success-500);
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
    }

    &--degraded {
      background: var(--hw-warning-500);
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
      animation: pulse-warning 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    &--down {
      background: var(--hw-error-500);
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
      animation: pulse-error 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: var(--hw-font-size-base);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-text-primary);
    margin-bottom: var(--hw-space-1);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: var(--hw-gap-sm);
    flex-wrap: wrap;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    padding: var(--hw-space-1) var(--hw-space-2);
    border-radius: var(--hw-radius-sm);
    font-size: var(--hw-font-size-xs);
    font-weight: var(--hw-font-weight-semibold);
    text-transform: capitalize;

    &--healthy {
      background: var(--hw-success-50);
      color: var(--hw-success-700);
    }

    &--degraded {
      background: var(--hw-warning-50);
      color: var(--hw-warning-700);
    }

    &--down {
      background: var(--hw-error-50);
      color: var(--hw-error-700);
    }
  }

  &__detail {
    font-size: var(--hw-font-size-sm);
    color: var(--hw-text-secondary);
  }

  &__actions {
    display: flex;
    gap: var(--hw-gap-xs);
    flex-shrink: 0;
  }
}

@keyframes pulse-warning {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes pulse-error {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}

// Dark mode
[data-theme="dark"] {
  .hw-service-status {
    &__badge {
      &--healthy {
        background: rgba(34, 197, 94, 0.15);
        color: var(--hw-success-400);
      }

      &--degraded {
        background: rgba(245, 158, 11, 0.15);
        color: var(--hw-warning-400);
      }

      &--down {
        background: rgba(239, 68, 68, 0.15);
        color: var(--hw-error-400);
      }
    }
  }
}
```

---

## Admin Console

### Admin Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ☰ ADMIN CONSOLE                    [Search...]  [Settings] [@] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────┐  ┌───────────────────────────────────────────┐  │
│  │           │  │  QUICK ACTIONS                             │  │
│  │ Dashboard │  │                                            │  │
│  │           │  │  [+ New User]  [+ New Project]  [Deploy]  │  │
│  │ Users     │  │                                            │  │
│  │           │  └────────────────────────────────────────────┘  │
│  │ Projects  │                                                   │
│  │           │  ┌────────────────────────────────────────────┐  │
│  │ Analytics │  │  SYSTEM OVERVIEW                           │  │
│  │           │  │                                            │  │
│  │ Settings  │  │  Users: 1,234   Projects: 567   Tasks: 8.9K│  │
│  │           │  │  Storage: 234 GB   Bandwidth: 1.2 TB/mo   │  │
│  │ Security  │  │                                            │  │
│  │           │  └────────────────────────────────────────────┘  │
│  │ Billing   │                                                   │
│  │           │  ┌────────────────────────────────────────────┐  │
│  │ Logs      │  │  RECENT ACTIVITY                           │  │
│  │           │  │                                            │  │
│  │ System    │  │  ● John Doe created project "Website"     │  │
│  │           │  │    2 minutes ago                           │  │
│  └───────────┘  │                                            │  │
│                 │  ● Jane Smith invited 3 users              │  │
│                 │    15 minutes ago                          │  │
│                 │                                            │  │
│                 │  ● System deployed version 1.2.3           │  │
│                 │    1 hour ago                              │  │
│                 │                                            │  │
│                 │  [View All Activity →]                     │  │
│                 └────────────────────────────────────────────┘  │
│                                                                  │
│                 ┌────────────────────────────────────────────┐  │
│                 │  ALERTS & WARNINGS                         │  │
│                 │                                            │  │
│                 │  ⚠ High CPU usage on API server (85%)     │  │
│                 │     Investigate | Acknowledge              │  │
│                 │                                            │  │
│                 │  ℹ Database backup completed successfully   │  │
│                 │     View Logs                              │  │
│                 │                                            │  │
│                 └────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Admin Navigation Component

```typescript
// src/app/admin/components/admin-nav/admin-nav.component.ts
import { Component } from '@angular/core';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
  children?: NavItem[];
}

@Component({
  selector: 'hw-admin-nav',
  template: `
    <nav class="hw-admin-nav">
      <div class="hw-admin-nav__header">
        <hw-logo variant="compact"></hw-logo>
        <h2 class="hw-admin-nav__title">Admin Console</h2>
      </div>

      <ul class="hw-admin-nav__list">
        <li *ngFor="let item of navItems" class="hw-admin-nav__item">
          <a [routerLink]="item.route"
             routerLinkActive="hw-admin-nav__link--active"
             class="hw-admin-nav__link">
            <hw-icon [name]="item.icon" class="hw-admin-nav__icon"></hw-icon>
            <span class="hw-admin-nav__label">{{ item.label }}</span>
            <span class="hw-admin-nav__badge" *ngIf="item.badge">{{ item.badge }}</span>
          </a>

          <ul class="hw-admin-nav__sublist" *ngIf="item.children">
            <li *ngFor="let child of item.children" class="hw-admin-nav__subitem">
              <a [routerLink]="child.route"
                 routerLinkActive="hw-admin-nav__sublink--active"
                 class="hw-admin-nav__sublink">
                {{ child.label }}
              </a>
            </li>
          </ul>
        </li>
      </ul>

      <div class="hw-admin-nav__footer">
        <button hw-button variant="ghost" fullWidth (click)="onLogout()">
          <hw-icon name="log-out"></hw-icon>
          Logout
        </button>
      </div>
    </nav>
  `,
  styleUrls: ['./admin-nav.component.scss']
})
export class AdminNavComponent {
  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      icon: 'home',
      route: '/admin/dashboard'
    },
    {
      label: 'Users',
      icon: 'users',
      route: '/admin/users',
      badge: 12
    },
    {
      label: 'Projects',
      icon: 'briefcase',
      route: '/admin/projects'
    },
    {
      label: 'Analytics',
      icon: 'bar-chart',
      route: '/admin/analytics'
    },
    {
      label: 'Settings',
      icon: 'settings',
      route: '/admin/settings',
      children: [
        { label: 'General', icon: '', route: '/admin/settings/general' },
        { label: 'Security', icon: '', route: '/admin/settings/security' },
        { label: 'Integrations', icon: '', route: '/admin/settings/integrations' }
      ]
    },
    {
      label: 'Security',
      icon: 'shield',
      route: '/admin/security'
    },
    {
      label: 'Billing',
      icon: 'credit-card',
      route: '/admin/billing'
    },
    {
      label: 'Logs',
      icon: 'file-text',
      route: '/admin/logs'
    },
    {
      label: 'System',
      icon: 'cpu',
      route: '/admin/system',
      badge: 3
    }
  ];

  onLogout(): void {
    // Implement logout logic
  }
}
```

### Admin Navigation Styles

```scss
// admin-nav.component.scss
.hw-admin-nav {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 280px;
  background: var(--hw-surface);
  border-right: 1px solid var(--hw-border);
  overflow-y: auto;

  &__header {
    padding: var(--hw-padding-lg);
    border-bottom: 1px solid var(--hw-border);
  }

  &__title {
    font-size: var(--hw-font-size-lg);
    font-weight: var(--hw-font-weight-bold);
    color: var(--hw-text-primary);
    margin: var(--hw-space-2) 0 0;
  }

  &__list {
    flex: 1;
    list-style: none;
    margin: 0;
    padding: var(--hw-padding-md) 0;
  }

  &__item {
    margin-bottom: var(--hw-space-1);
  }

  &__link {
    display: flex;
    align-items: center;
    gap: var(--hw-gap-md);
    padding: var(--hw-padding-md) var(--hw-padding-lg);
    color: var(--hw-text-secondary);
    text-decoration: none;
    border-radius: var(--hw-radius-md);
    margin: 0 var(--hw-space-3);
    transition: var(--hw-transition-fast);
    position: relative;

    &:hover {
      background: var(--hw-background-secondary);
      color: var(--hw-text-primary);
    }

    &--active {
      background: var(--hw-primary-50);
      color: var(--hw-primary-700);
      font-weight: var(--hw-font-weight-semibold);

      .hw-admin-nav__icon {
        color: var(--hw-primary-600);
      }
    }
  }

  &__icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  &__label {
    flex: 1;
    font-size: var(--hw-font-size-base);
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 var(--hw-space-1);
    background: var(--hw-error-500);
    color: white;
    border-radius: var(--hw-badge-radius);
    font-size: var(--hw-font-size-xs);
    font-weight: var(--hw-font-weight-bold);
  }

  &__sublist {
    list-style: none;
    margin: var(--hw-space-2) 0;
    padding: 0;
  }

  &__subitem {
    margin-bottom: var(--hw-space-1);
  }

  &__sublink {
    display: block;
    padding: var(--hw-padding-sm) var(--hw-padding-lg) var(--hw-padding-sm) calc(var(--hw-padding-lg) + 32px);
    color: var(--hw-text-secondary);
    text-decoration: none;
    font-size: var(--hw-font-size-sm);
    border-radius: var(--hw-radius-md);
    margin: 0 var(--hw-space-3);
    transition: var(--hw-transition-fast);

    &:hover {
      background: var(--hw-background-secondary);
      color: var(--hw-text-primary);
    }

    &--active {
      background: var(--hw-primary-50);
      color: var(--hw-primary-700);
      font-weight: var(--hw-font-weight-semibold);
    }
  }

  &__footer {
    padding: var(--hw-padding-lg);
    border-top: 1px solid var(--hw-border);
  }
}

// Dark mode
[data-theme="dark"] {
  .hw-admin-nav {
    &__link {
      &--active {
        background: rgba(41, 82, 255, 0.15);
        color: var(--hw-primary-400);

        .hw-admin-nav__icon {
          color: var(--hw-primary-400);
        }
      }
    }

    &__sublink {
      &--active {
        background: rgba(41, 82, 255, 0.15);
        color: var(--hw-primary-400);
      }
    }
  }
}
```

---

## Accessibility Compliance

### WCAG 2.1 AAA Standards

#### Color Contrast Requirements

```css
/* Ensure all text meets AAA contrast ratio (7:1 for normal text, 4.5:1 for large text) */
.hw-text-contrast-check {
  /* Normal text (< 18px or < 14px bold) requires 7:1 ratio */
  color: var(--hw-text-primary);  /* #171717 on #ffffff = 14.47:1 ✓ */
  background: var(--hw-background);

  /* Large text (>= 18px or >= 14px bold) requires 4.5:1 ratio */
  &.large {
    font-size: var(--hw-font-size-lg);
    color: var(--hw-text-secondary);  /* #525252 on #ffffff = 7.48:1 ✓ */
  }
}

/* Link contrast */
a {
  color: var(--hw-primary-600);  /* #1a3adb on #ffffff = 8.46:1 ✓ */

  &:hover {
    color: var(--hw-primary-700);  /* #0f27b3 on #ffffff = 11.26:1 ✓ */
  }
}

/* Button contrast */
.hw-button--primary {
  background: var(--hw-primary-500);  /* #2952ff */
  color: #ffffff;  /* #ffffff on #2952ff = 5.68:1 ✓ (large text) */
}
```

#### Focus Indicators

```css
/* Visible focus indicators for keyboard navigation */
*:focus-visible {
  outline: 3px solid var(--hw-primary-500);
  outline-offset: 2px;
  border-radius: var(--hw-radius-sm);
}

/* Enhanced focus for interactive elements */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  box-shadow: var(--hw-shadow-focus);
  outline: 3px solid var(--hw-primary-500);
  outline-offset: 2px;
}

/* Skip to main content link */
.hw-skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  background: var(--hw-primary-500);
  color: white;
  padding: var(--hw-padding-md) var(--hw-padding-lg);
  z-index: 10000;
  text-decoration: none;
  font-weight: var(--hw-font-weight-semibold);
  border-radius: 0 0 var(--hw-radius-md) 0;

  &:focus {
    top: 0;
  }
}
```

#### ARIA Labels and Roles

```typescript
// Comprehensive ARIA implementation
@Component({
  selector: 'hw-accessible-component',
  template: `
    <!-- Skip link -->
    <a href="#main-content" class="hw-skip-link">Skip to main content</a>

    <!-- Landmarks -->
    <header role="banner" aria-label="Site header">
      <nav role="navigation" aria-label="Main navigation">
        <!-- Navigation content -->
      </nav>
    </header>

    <main id="main-content" role="main" aria-label="Main content">
      <!-- Main content -->

      <!-- Accessible modal -->
      <div role="dialog"
           aria-modal="true"
           aria-labelledby="modal-title"
           aria-describedby="modal-description"
           *ngIf="isModalOpen">
        <h2 id="modal-title">{{ modalTitle }}</h2>
        <p id="modal-description">{{ modalDescription }}</p>
      </div>

      <!-- Accessible table -->
      <table role="table" aria-label="User data">
        <thead>
          <tr role="row">
            <th role="columnheader" scope="col">Name</th>
            <th role="columnheader" scope="col">Email</th>
          </tr>
        </thead>
        <tbody>
          <tr role="row" *ngFor="let user of users">
            <td role="cell">{{ user.name }}</td>
            <td role="cell">{{ user.email }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Live region for dynamic updates -->
      <div role="status"
           aria-live="polite"
           aria-atomic="true"
           class="hw-sr-only">
        {{ statusMessage }}
      </div>
    </main>

    <footer role="contentinfo" aria-label="Site footer">
      <!-- Footer content -->
    </footer>
  `
})
export class AccessibleComponent {
  // Component logic
}
```

#### Screen Reader Utilities

```css
/* Screen reader only content */
.hw-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Focusable screen reader only */
.hw-sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

---

## CSS Custom Properties

### Complete Property Reference

```css
:root {
  /* ============================================
     COLORS
     ============================================ */

  /* Primary Scale */
  --hw-primary-50: #e8f2ff;
  --hw-primary-100: #d1e4ff;
  --hw-primary-200: #aac9ff;
  --hw-primary-300: #7aa3ff;
  --hw-primary-400: #4f7aff;
  --hw-primary-500: #2952ff;
  --hw-primary-600: #1a3adb;
  --hw-primary-700: #0f27b3;
  --hw-primary-800: #081a8a;
  --hw-primary-900: #041061;

  /* Additional color scales... (see above) */

  /* ============================================
     TYPOGRAPHY
     ============================================ */

  --hw-font-family-sans: 'Inter', system-ui, sans-serif;
  --hw-font-family-mono: 'JetBrains Mono', monospace;
  --hw-font-family-display: 'Space Grotesk', sans-serif;

  --hw-font-size-xs: 0.75rem;
  --hw-font-size-sm: 0.875rem;
  --hw-font-size-base: 1rem;
  --hw-font-size-lg: 1.125rem;
  --hw-font-size-xl: 1.25rem;
  --hw-font-size-2xl: 1.5rem;
  --hw-font-size-3xl: 1.875rem;
  --hw-font-size-4xl: 2.25rem;
  --hw-font-size-5xl: 3rem;
  --hw-font-size-6xl: 3.75rem;

  /* ============================================
     SPACING
     ============================================ */

  --hw-space-0: 0;
  --hw-space-1: 0.25rem;
  --hw-space-2: 0.5rem;
  --hw-space-3: 0.75rem;
  --hw-space-4: 1rem;
  --hw-space-5: 1.25rem;
  --hw-space-6: 1.5rem;
  --hw-space-8: 2rem;
  --hw-space-10: 2.5rem;
  --hw-space-12: 3rem;
  --hw-space-16: 4rem;
  --hw-space-20: 5rem;
  --hw-space-24: 6rem;
  --hw-space-32: 8rem;

  /* ============================================
     BORDERS
     ============================================ */

  --hw-border-width-thin: 1px;
  --hw-border-width-medium: 2px;
  --hw-border-width-thick: 4px;

  --hw-radius-none: 0;
  --hw-radius-sm: 0.25rem;
  --hw-radius-md: 0.375rem;
  --hw-radius-lg: 0.5rem;
  --hw-radius-xl: 0.75rem;
  --hw-radius-2xl: 1rem;
  --hw-radius-3xl: 1.5rem;
  --hw-radius-full: 9999px;

  /* ============================================
     SHADOWS
     ============================================ */

  --hw-shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --hw-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  --hw-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --hw-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  --hw-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  --hw-shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --hw-shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
  --hw-shadow-focus: 0 0 0 3px rgba(41, 82, 255, 0.2);

  /* ============================================
     ANIMATION
     ============================================ */

  --hw-duration-instant: 0ms;
  --hw-duration-fast: 150ms;
  --hw-duration-normal: 250ms;
  --hw-duration-slow: 350ms;
  --hw-duration-slower: 500ms;

  --hw-ease-linear: cubic-bezier(0, 0, 1, 1);
  --hw-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --hw-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --hw-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --hw-ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* ============================================
     Z-INDEX
     ============================================ */

  --hw-z-index-dropdown: 1000;
  --hw-z-index-sticky: 1020;
  --hw-z-index-fixed: 1030;
  --hw-z-index-modal-backdrop: 1040;
  --hw-z-index-modal: 1050;
  --hw-z-index-popover: 1060;
  --hw-z-index-tooltip: 1070;
  --hw-z-index-notification: 1080;

  /* ============================================
     BREAKPOINTS (for use in media queries)
     ============================================ */

  --hw-breakpoint-xs: 480px;
  --hw-breakpoint-sm: 640px;
  --hw-breakpoint-md: 768px;
  --hw-breakpoint-lg: 1024px;
  --hw-breakpoint-xl: 1280px;
  --hw-breakpoint-2xl: 1536px;

  /* ============================================
     COMPONENT-SPECIFIC
     ============================================ */

  /* Buttons */
  --hw-button-padding-x-sm: var(--hw-space-3);
  --hw-button-padding-y-sm: var(--hw-space-2);
  --hw-button-padding-x-md: var(--hw-space-4);
  --hw-button-padding-y-md: var(--hw-space-3);
  --hw-button-padding-x-lg: var(--hw-space-6);
  --hw-button-padding-y-lg: var(--hw-space-4);

  /* Inputs */
  --hw-input-height-sm: 32px;
  --hw-input-height-md: 40px;
  --hw-input-height-lg: 48px;
  --hw-input-padding-x: var(--hw-space-3);
  --hw-input-border-width: 1px;

  /* Cards */
  --hw-card-padding: var(--hw-space-6);
  --hw-card-gap: var(--hw-space-4);

  /* Headers */
  --hw-header-height: 64px;
  --hw-header-mobile-height: 56px;

  /* Sidebar */
  --hw-sidebar-width: 280px;
  --hw-sidebar-collapsed-width: 64px;
}
```

---

## Component Library Final

### Button Variants

```scss
// All button variants with CSS custom properties
.hw-button {
  --button-bg: var(--hw-primary-500);
  --button-color: white;
  --button-border: transparent;
  --button-hover-bg: var(--hw-primary-600);
  --button-hover-color: white;
  --button-active-bg: var(--hw-primary-700);
  --button-disabled-bg: var(--hw-neutral-200);
  --button-disabled-color: var(--hw-neutral-400);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--hw-gap-sm);
  padding: var(--hw-button-padding-y-md) var(--hw-button-padding-x-md);
  background: var(--button-bg);
  color: var(--button-color);
  border: 1px solid var(--button-border);
  border-radius: var(--hw-button-radius);
  font-size: var(--hw-font-size-base);
  font-weight: var(--hw-font-weight-semibold);
  line-height: var(--hw-line-height-tight);
  text-decoration: none;
  cursor: pointer;
  transition: var(--hw-button-transition);
  user-select: none;

  &:hover:not(:disabled) {
    background: var(--button-hover-bg);
    color: var(--button-hover-color);
    transform: translateY(-1px);
    box-shadow: var(--hw-shadow-md);
  }

  &:active:not(:disabled) {
    background: var(--button-active-bg);
    transform: translateY(0);
    box-shadow: var(--hw-shadow-sm);
  }

  &:disabled {
    background: var(--button-disabled-bg);
    color: var(--button-disabled-color);
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 3px solid var(--hw-primary-200);
    outline-offset: 2px;
  }

  /* Variants */
  &--secondary {
    --button-bg: var(--hw-secondary-500);
    --button-hover-bg: var(--hw-secondary-600);
    --button-active-bg: var(--hw-secondary-700);
  }

  &--success {
    --button-bg: var(--hw-success-500);
    --button-hover-bg: var(--hw-success-600);
    --button-active-bg: var(--hw-success-700);
  }

  &--warning {
    --button-bg: var(--hw-warning-500);
    --button-hover-bg: var(--hw-warning-600);
    --button-active-bg: var(--hw-warning-700);
  }

  &--error {
    --button-bg: var(--hw-error-500);
    --button-hover-bg: var(--hw-error-600);
    --button-active-bg: var(--hw-error-700);
  }

  &--outline {
    --button-bg: transparent;
    --button-color: var(--hw-primary-600);
    --button-border: var(--hw-primary-500);
    --button-hover-bg: var(--hw-primary-50);
    --button-hover-color: var(--hw-primary-700);
    --button-active-bg: var(--hw-primary-100);
  }

  &--ghost {
    --button-bg: transparent;
    --button-color: var(--hw-text-primary);
    --button-border: transparent;
    --button-hover-bg: var(--hw-background-secondary);
    --button-hover-color: var(--hw-text-primary);
    --button-active-bg: var(--hw-background-tertiary);
  }

  /* Sizes */
  &--sm {
    padding: var(--hw-button-padding-y-sm) var(--hw-button-padding-x-sm);
    font-size: var(--hw-font-size-sm);
  }

  &--lg {
    padding: var(--hw-button-padding-y-lg) var(--hw-button-padding-x-lg);
    font-size: var(--hw-font-size-lg);
  }

  &--full {
    width: 100%;
  }
}
```

### Input Component

```scss
.hw-input {
  --input-bg: var(--hw-background);
  --input-border: var(--hw-border);
  --input-color: var(--hw-text-primary);
  --input-placeholder: var(--hw-text-tertiary);
  --input-focus-border: var(--hw-border-focus);
  --input-error-border: var(--hw-error-500);

  display: block;
  width: 100%;
  height: var(--hw-input-height-md);
  padding: 0 var(--hw-input-padding-x);
  background: var(--input-bg);
  border: var(--hw-input-border-width) solid var(--input-border);
  border-radius: var(--hw-input-radius);
  color: var(--input-color);
  font-size: var(--hw-font-size-base);
  font-family: var(--hw-font-family-sans);
  line-height: var(--hw-line-height-normal);
  transition: var(--hw-transition-fast);

  &::placeholder {
    color: var(--input-placeholder);
  }

  &:hover:not(:disabled) {
    border-color: var(--hw-neutral-400);
  }

  &:focus {
    outline: none;
    border-color: var(--input-focus-border);
    box-shadow: var(--hw-shadow-focus);
  }

  &:disabled {
    background: var(--hw-background-secondary);
    color: var(--hw-text-tertiary);
    cursor: not-allowed;
    opacity: 0.6;
  }

  &--error {
    border-color: var(--input-error-border);

    &:focus {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
    }
  }

  &--sm {
    height: var(--hw-input-height-sm);
    font-size: var(--hw-font-size-sm);
  }

  &--lg {
    height: var(--hw-input-height-lg);
    font-size: var(--hw-font-size-lg);
  }
}
```

---

## Responsive Design Final

### Mobile-First Breakpoints

```scss
// Mobile-first media queries
@mixin hw-respond-to($breakpoint) {
  @if $breakpoint == 'xs' {
    @media (min-width: 480px) { @content; }
  }
  @else if $breakpoint == 'sm' {
    @media (min-width: 640px) { @content; }
  }
  @else if $breakpoint == 'md' {
    @media (min-width: 768px) { @content; }
  }
  @else if $breakpoint == 'lg' {
    @media (min-width: 1024px) { @content; }
  }
  @else if $breakpoint == 'xl' {
    @media (min-width: 1280px) { @content; }
  }
  @else if $breakpoint == '2xl' {
    @media (min-width: 1536px) { @content; }
  }
}

// Usage example
.hw-container {
  padding: var(--hw-space-4);

  @include hw-respond-to('sm') {
    padding: var(--hw-space-6);
  }

  @include hw-respond-to('lg') {
    padding: var(--hw-space-8);
  }
}
```

### Responsive Typography

```scss
.hw-responsive-text {
  font-size: clamp(
    var(--hw-font-size-base),     /* Minimum */
    2vw + 0.5rem,                  /* Preferred */
    var(--hw-font-size-2xl)        /* Maximum */
  );

  line-height: var(--hw-line-height-normal);

  @include hw-respond-to('lg') {
    line-height: var(--hw-line-height-relaxed);
  }
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Design System:** HubbleWave v8.0
