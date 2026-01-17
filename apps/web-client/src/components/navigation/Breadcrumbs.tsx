/**
 * Breadcrumbs Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready breadcrumbs with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly touch targets
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, showHome = true }) => {
  if (items.length === 0 && !showHome) return null;

  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: 'Home', href: '/', icon: <Home className="h-4 w-4" /> }, ...items]
    : items;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center flex-wrap gap-1">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isFirst = index === 0;

          return (
            <li key={index} className="flex items-center">
              {/* Separator */}
              {!isFirst && (
                <ChevronRight
                  className="h-4 w-4 mx-1.5 flex-shrink-0 text-muted-foreground/60"
                  aria-hidden="true"
                />
              )}

              {/* Breadcrumb Item */}
              {isLast || !item.href ? (
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${isLast ? 'text-foreground' : 'text-muted-foreground'}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon && (
                    <span className={isLast ? 'text-muted-foreground' : 'text-muted-foreground/60'}>
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate max-w-[200px]">{item.label}</span>
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors group min-h-[32px] text-muted-foreground hover:text-primary"
                >
                  {item.icon && (
                    <span className="text-muted-foreground/60">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate max-w-[200px] hover:underline underline-offset-2">
                    {item.label}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Compact variant for smaller spaces
export const BreadcrumbsCompact: React.FC<BreadcrumbsProps> = ({ items, showHome = true }) => {
  if (items.length === 0 && !showHome) return null;

  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: 'Home', href: '/', icon: <Home className="h-3.5 w-3.5" /> }, ...items]
    : items;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-xs">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isFirst = index === 0;

          return (
            <li key={index} className="flex items-center">
              {!isFirst && (
                <ChevronRight
                  className="h-3 w-3 mx-1 flex-shrink-0 text-muted-foreground/60"
                  aria-hidden="true"
                />
              )}

              {isLast || !item.href ? (
                <span
                  className={`inline-flex items-center gap-1 ${isLast ? 'text-muted-foreground font-medium' : 'text-muted-foreground/60'}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon}
                  <span className="truncate max-w-[150px]">{item.label}</span>
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="inline-flex items-center gap-1 transition-colors min-h-[28px] text-muted-foreground/60 hover:text-primary"
                >
                  {item.icon}
                  <span className="truncate max-w-[150px] hover:underline">{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
