/**
 * Breadcrumbs - Navigation Breadcrumb Component
 *
 * Auto-generates breadcrumb navigation from the current route.
 * Supports:
 * - Route-based auto-generation
 * - Custom breadcrumb overrides
 * - Truncation for deep paths
 * - Click navigation
 * - Contextual "Back" button using navigation history
 */

import React, { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Home, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigationHistory } from '../../hooks/useNavigationHistory';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  /** Custom breadcrumb items (overrides auto-generation) */
  items?: BreadcrumbItem[];
  /** Maximum items to show before truncating */
  maxItems?: number;
  /** Whether to show home icon */
  showHome?: boolean;
  /** Custom home path */
  homePath?: string;
  /** Whether to show the contextual back button */
  showBackButton?: boolean;
  /** Additional class name */
  className?: string;
}

// Route label mappings (preserving proper capitalization and terminology)
const routeLabels: Record<string, string> = {
  home: 'Home',
  assets: 'Assets',
  'work-orders': 'Work Orders',
  locations: 'Locations',
  parts: 'Parts',
  reports: 'Reports',
  studio: 'Studio',
  settings: 'Settings',
  admin: 'Admin',
  collections: 'Collections',
  views: 'Views',
  'process-flows': 'Process Flows',
  automations: 'Automation Rules',
  automation: 'Automation Rules',
  flows: 'Flows',
  scripts: 'Scripts',
  events: 'Events',
  notifications: 'Notifications',
  users: 'Users',
  groups: 'Groups',
  roles: 'Roles & Permissions',
  permissions: 'Permissions',
  profile: 'Profile',
  appearance: 'Appearance',
  security: 'Security',
  new: 'New',
  edit: 'Edit',
  details: 'Details',
  portal: 'Service Portal',
  catalog: 'Catalog',
  requests: 'Requests',
  'my-items': 'My Items',
  knowledge: 'Knowledge Base',
  approvals: 'Approvals',
  dashboard: 'Dashboard',
  invite: 'Invite',
  // SSO, LDAP, MFA with proper capitalization
  sso: 'SSO Configuration',
  ldap: 'LDAP Configuration',
  'mfa-setup': 'Two-Factor Auth',
  // API and integrations
  api: 'API Explorer',
  integrations: 'Integrations',
  webhooks: 'Webhooks',
  'import-export': 'Import & Export',
  marketplace: 'Marketplace',
  // AI/AVA section with proper naming
  ai: 'AVA',
  query: 'Chat with AVA',
  'predictive-ops': 'Predictive Operations',
  'digital-twins': 'Digital Twins',
  'self-healing': 'Self-Healing',
  docs: 'Living Documentation',
  agile: 'Agile Development',
  'app-builder': 'App Builder',
  upgrade: 'Upgrade Assistant',
  // Audit
  audit: 'Audit Logs',
  navigation: 'Navigation',
  localization: 'Localization',
  themes: 'Themes',
  delegations: 'Delegations',
};

// Parse segment into label
const parseSegment = (segment: string): string => {
  // Handle ServiceNow-style .list suffix (e.g., "collections.list" -> "Collections")
  if (segment.endsWith('.list')) {
    const baseName = segment.replace(/\.list$/, '');
    // Check if the base name has a known label
    if (routeLabels[baseName]) {
      return routeLabels[baseName];
    }
    // Convert to title case
    return baseName
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Check for known routes
  if (routeLabels[segment]) {
    return routeLabels[segment];
  }

  // Check for UUID-like patterns (record IDs)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return segment.slice(0, 8) + '...';
  }

  // Check for numeric IDs
  if (/^\d+$/.test(segment)) {
    return `#${segment}`;
  }

  // Convert kebab-case to Title Case
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  maxItems = 4,
  showHome = true,
  homePath = '/',
  showBackButton = true,
  className,
}) => {
  const location = useLocation();
  const { canGoBack, goBack, previousPageLabel } = useNavigationHistory();

  // Never show back button on home page
  const isHomePage = location.pathname === '/' || location.pathname === '/home';
  const shouldShowBack = showBackButton && canGoBack && !isHomePage;

  // Generate breadcrumbs from route
  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    if (items) return items;

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [];

    if (showHome) {
      crumbs.push({
        label: 'Home',
        path: homePath,
        icon: <Home className="h-3.5 w-3.5" />,
      });
    }

    // Special handling for /collections.list - show as Studio > Collections
    if (pathSegments.length === 1 && pathSegments[0] === 'collections.list') {
      crumbs.push({
        label: 'Studio',
        path: '/studio',
      });
      crumbs.push({
        label: 'Collections',
        path: undefined,
      });
      return crumbs;
    }

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      crumbs.push({
        label: parseSegment(segment),
        path: isLast ? undefined : currentPath,
      });
    });

    return crumbs;
  }, [items, location.pathname, showHome, homePath]);

  // Truncate if needed
  const displayBreadcrumbs = useMemo(() => {
    if (breadcrumbs.length <= maxItems) {
      return breadcrumbs;
    }

    // Keep first, last 2, and add ellipsis
    const first = breadcrumbs[0];
    const last = breadcrumbs.slice(-2);
    const truncated: BreadcrumbItem[] = [
      first,
      { label: '...', path: undefined },
      ...last,
    ];

    return truncated;
  }, [breadcrumbs, maxItems]);

  // Don't render if only home breadcrumb and no back button
  if (displayBreadcrumbs.length <= 1 && !canGoBack) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-2 text-sm', className)}
    >
      {/* Contextual Back Button */}
      {shouldShowBack && (
        <button
          onClick={goBack}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md',
            'transition-colors hover:bg-muted',
            'text-xs font-medium text-muted-foreground'
          )}
          title={`Back to ${previousPageLabel}`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      )}

      {/* Separator between back button and breadcrumbs */}
      {shouldShowBack && displayBreadcrumbs.length > 1 && (
        <div className="h-4 w-px bg-border" />
      )}

      <ol className="flex items-center gap-1">
        {displayBreadcrumbs.map((crumb, index) => {
          const isLast = index === displayBreadcrumbs.length - 1;
          const isEllipsis = crumb.label === '...';

          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              )}

              {isEllipsis ? (
                <span className="px-1.5 py-0.5 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </span>
              ) : crumb.path ? (
                <Link
                  to={crumb.path}
                  className={cn(
                    'flex items-center gap-1.5 px-1.5 py-0.5 rounded-md',
                    'transition-colors hover:bg-muted text-muted-foreground'
                  )}
                >
                  {crumb.icon}
                  <span className="hidden sm:inline">{crumb.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    'flex items-center gap-1.5 px-1.5 py-0.5 font-medium',
                    isLast && 'truncate max-w-[200px]',
                    isLast ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  title={crumb.label}
                >
                  {crumb.icon}
                  <span>{crumb.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

/**
 * PageHeader - A header with breadcrumbs and title
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};

export default Breadcrumbs;
