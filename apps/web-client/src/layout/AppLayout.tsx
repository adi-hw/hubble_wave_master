import React from 'react';
import { Breadcrumbs, BreadcrumbItem } from '../components/navigation/Breadcrumbs';

interface AppLayoutProps {
  title?: string;
  subtitle?: string;
  activeNavKey?: string;
  headerMeta?: React.ReactNode;
  headerActions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  showHeader?: boolean;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  title,
  subtitle,
  headerMeta,
  headerActions,
  breadcrumbs,
  showHeader = true,
  children,
}) => {
  // Determine if we should show the header (only if there's something to show besides just title)
  const hasHeaderContent = title || subtitle || headerMeta || headerActions;
  const shouldShowHeader = showHeader && hasHeaderContent;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} showHome={true} />
        )}

        {/* Page Header - Only show if there's meaningful content */}
        {shouldShowHeader && (
          <header className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {(title || subtitle || headerMeta) && (
                <div className="min-w-0">
                  {title && (
                    <div className="flex items-center gap-3">
                      <h1 className="text-xl font-semibold text-slate-900 truncate">{title}</h1>
                      {subtitle && (
                        <span className="hidden sm:inline-flex badge-neutral">{subtitle}</span>
                      )}
                    </div>
                  )}
                  {headerMeta && (
                    <p className="mt-1 text-sm text-slate-500">{headerMeta}</p>
                  )}
                </div>
              )}

              {headerActions && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {headerActions}
                </div>
              )}
            </div>
          </header>
        )}

        {/* Page Content */}
        <main className="animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};
