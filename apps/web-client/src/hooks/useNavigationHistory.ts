/**
 * useNavigationHistory - Contextual parent-based back navigation
 *
 * This hook provides:
 * - Logical parent navigation (not session-based history)
 * - Contextual "back" functionality that goes to the hierarchical parent
 * - Label resolution for display in UI
 *
 * Uses route hierarchy to determine the logical parent page.
 */

import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Route label mappings for display
const routeLabels: Record<string, string> = {
  '/': 'Home',
  '/home': 'Home',
  '/studio': 'Studio',
  '/studio/collections': 'Collections',
  '/collections.list': 'Collections',
  '/studio/users': 'Users',
  '/studio/users/invite': 'Invite User',
  '/studio/groups': 'Groups',
  '/studio/groups/new': 'New Group',
  '/studio/roles': 'Roles & Permissions',
  '/studio/navigation': 'Navigation',
  '/studio/localization': 'Localization',
  '/studio/sso': 'SSO Configuration',
  '/studio/ldap': 'LDAP Configuration',
  '/studio/audit': 'Audit Logs',
  '/settings': 'Settings',
  '/settings/profile': 'Profile',
  '/settings/security': 'Security',
  '/settings/themes': 'Themes',
  '/settings/mfa-setup': 'Two-Factor Auth',
  '/settings/delegations': 'Delegations',
  '/notifications': 'Notifications',
  '/automation': 'Automation Rules',
  '/process-flows': 'Process Flows',
  '/process-flows/new': 'New Process Flow',
  '/integrations': 'Integrations',
  '/integrations/api': 'API Explorer',
  '/integrations/webhooks': 'Webhooks',
  '/integrations/import-export': 'Import & Export',
  '/integrations/marketplace': 'Marketplace',
  '/ai': 'AVA',
  '/ai/query': 'Chat with AVA',
  '/ai/reports': 'AI Reports',
  '/ai/predictive-ops': 'Predictive Operations',
  '/ai/digital-twins': 'Digital Twins',
  '/ai/self-healing': 'Self-Healing',
  '/ai/docs': 'Living Documentation',
  '/ai/agile': 'Agile Development',
  '/ai/app-builder': 'App Builder',
  '/ai/upgrade': 'Upgrade Assistant',
};

// Explicit parent route mappings for logical navigation hierarchy
const parentRoutes: Record<string, string> = {
  '/studio/users': '/studio',
  '/studio/users/invite': '/studio/users',
  '/studio/groups': '/studio',
  '/studio/groups/new': '/studio/groups',
  '/studio/roles': '/studio',
  '/studio/navigation': '/studio',
  '/studio/localization': '/studio',
  '/studio/sso': '/studio',
  '/studio/ldap': '/studio',
  '/studio/audit': '/studio',
  '/studio/collections': '/studio',
  '/collections.list': '/studio',
  '/notifications': '/',
  '/automation': '/',
  '/process-flows': '/',
  '/process-flows/new': '/process-flows',
  '/settings/profile': '/settings',
  '/settings/security': '/settings',
  '/settings/themes': '/settings',
  '/settings/mfa-setup': '/settings',
  '/settings/delegations': '/settings',
  '/integrations/api': '/integrations',
  '/integrations/webhooks': '/integrations',
  '/integrations/import-export': '/integrations',
  '/integrations/marketplace': '/integrations',
  '/ai/query': '/ai',
  '/ai/reports': '/ai',
  '/ai/predictive-ops': '/ai',
  '/ai/digital-twins': '/ai',
  '/ai/self-healing': '/ai',
  '/ai/docs': '/ai',
  '/ai/agile': '/ai',
  '/ai/app-builder': '/ai',
  '/ai/upgrade': '/ai',
};

/**
 * Get a human-readable label for a path
 */
function getPathLabel(path: string): string {
  // Check for exact match
  if (routeLabels[path]) {
    return routeLabels[path];
  }

  // Handle .list suffix (ServiceNow-style URLs)
  if (path.endsWith('.list')) {
    const baseName = path.replace(/^\//, '').replace(/\.list$/, '');
    // Convert to title case
    return baseName
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Handle /studio/collections/:id pattern
  const studioCollectionMatch = path.match(/^\/studio\/collections\/([^/]+)/);
  if (studioCollectionMatch) {
    return 'Collection Details';
  }

  // Handle /studio/users/:id pattern (user detail)
  const studioUserMatch = path.match(/^\/studio\/users\/([^/]+)$/);
  if (studioUserMatch && studioUserMatch[1] !== 'invite') {
    return 'User Details';
  }

  // Handle /:collection/:id pattern (record detail)
  const recordMatch = path.match(/^\/([^/.]+)\/([^/]+)$/);
  if (recordMatch) {
    const collectionName = recordMatch[1]
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return `${collectionName} Record`;
  }

  // Fallback: parse from path segments
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return 'Home';

  const lastSegment = segments[segments.length - 1];
  return lastSegment
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get the logical parent route for a given path
 */
function getParentRoute(path: string): string | null {
  // Home page has no parent
  if (path === '/' || path === '/home') {
    return null;
  }

  // Check explicit parent mappings first
  if (parentRoutes[path]) {
    return parentRoutes[path];
  }

  // Handle dynamic routes like /studio/users/:id
  const studioUserDetailMatch = path.match(/^\/studio\/users\/([^/]+)$/);
  if (studioUserDetailMatch && studioUserDetailMatch[1] !== 'invite') {
    return '/studio/users';
  }

  // Handle /studio/groups/:id pattern
  const studioGroupDetailMatch = path.match(/^\/studio\/groups\/([^/]+)$/);
  if (studioGroupDetailMatch && studioGroupDetailMatch[1] !== 'new') {
    return '/studio/groups';
  }

  // Handle /studio/collections/:id pattern
  const studioCollectionDetailMatch = path.match(/^\/studio\/collections\/([^/]+)/);
  if (studioCollectionDetailMatch) {
    return '/studio/collections';
  }

  // Handle generic /:collection/:id pattern
  const genericRecordMatch = path.match(/^\/([^/.]+)\/([^/]+)$/);
  if (genericRecordMatch) {
    return `/${genericRecordMatch[1]}`;
  }

  // Handle .list suffix routes
  if (path.endsWith('.list')) {
    return '/studio';
  }

  // Fallback: derive parent from path segments
  const segments = path.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return '/';
  }

  // Remove last segment to get parent
  segments.pop();
  const parentPath = '/' + segments.join('/');

  // If parent is a known route, return it
  if (routeLabels[parentPath] || parentRoutes[parentPath]) {
    return parentPath;
  }

  // Default to home if no valid parent found
  return '/';
}

export interface UseNavigationHistoryResult {
  /** The parent page path (if available) */
  previousPage: { path: string; label: string } | null;
  /** Whether there's a parent page to go back to */
  canGoBack: boolean;
  /** Navigate to the parent page */
  goBack: () => void;
  /** Get the label for the parent page */
  previousPageLabel: string | null;
}

export function useNavigationHistory(): UseNavigationHistoryResult {
  const location = useLocation();
  const navigate = useNavigate();

  // Compute parent route based on current path hierarchy
  const parentInfo = useMemo(() => {
    const parentPath = getParentRoute(location.pathname);
    if (!parentPath) {
      return null;
    }
    return {
      path: parentPath,
      label: getPathLabel(parentPath),
    };
  }, [location.pathname]);

  const canGoBack = parentInfo !== null;

  const goBack = useCallback(() => {
    if (parentInfo) {
      navigate(parentInfo.path);
    }
  }, [parentInfo, navigate]);

  return {
    previousPage: parentInfo,
    canGoBack,
    goBack,
    previousPageLabel: parentInfo?.label ?? null,
  };
}

export default useNavigationHistory;
