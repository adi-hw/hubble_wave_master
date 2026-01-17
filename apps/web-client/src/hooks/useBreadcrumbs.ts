import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { BreadcrumbItem } from '../components/navigation/Breadcrumbs';

// Context for breadcrumb generation
interface BreadcrumbContext {
  collectionLabel?: string;
  recordLabel?: string;
}

// Route configuration for generating breadcrumbs
interface RouteConfig {
  pattern: RegExp;
  getBreadcrumbs: (
    params: Record<string, string | undefined>,
    context?: BreadcrumbContext
  ) => BreadcrumbItem[];
}

// Format collection code to a readable label (e.g., "asset_types" -> "Asset Types")
const formatCollectionCode = (code: string): string => {
  return code
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

// Route configurations
const routeConfigs: RouteConfig[] = [
  // Home
  {
    pattern: /^\/$/,
    getBreadcrumbs: () => [],
  },
  {
    pattern: /^\/home$/,
    getBreadcrumbs: () => [],
  },
  // Collections List View (ServiceNow-style URL: /collections.list)
  {
    pattern: /^\/collections\.list$/,
    getBreadcrumbs: () => [
      { label: 'Studio', href: '/studio' },
      { label: 'Collections' },
    ],
  },
  // Generic List View for other collections (e.g., /work_orders.list)
  {
    pattern: /^\/([^/.]+)\.list$/,
    getBreadcrumbs: (params, context) => {
      // Extract collection code from the URL (remove .list suffix)
      const collectionCode = params['*']?.replace(/\.list$/, '') || params.collectionCode || '';
      return [
        { label: context?.collectionLabel || formatCollectionCode(collectionCode) },
      ];
    },
  },
  // Studio - Collections
  {
    pattern: /^\/studio\/collections$/,
    getBreadcrumbs: () => [
      { label: 'Studio' },
      { label: 'Collections' },
    ],
  },
  // Studio - Collection Editor/Details
  {
    pattern: /^\/studio\/collections\/[^/]+/,
    getBreadcrumbs: (params, context) => [
      { label: 'Studio', href: '/studio' },
      { label: 'Collections', href: '/collections.list' },
      { label: context?.collectionLabel || formatCollectionCode(params.collectionCode || params.id || 'Collection') },
    ],
  },
  {
    pattern: /^\/studio\/localization$/,
    getBreadcrumbs: () => [
      { label: 'Studio', href: '/studio' },
      { label: 'Localization' },
    ],
  },
  // Data Engine - Collection Data Pages
  {
    pattern: /^\/data\/[^/]+$/,
    getBreadcrumbs: (params, context) => [
      { label: context?.collectionLabel || formatCollectionCode(params.collectionCode || 'Records') },
    ],
  },
  {
    pattern: /^\/data\/[^/]+\/[^/]+$/,
    getBreadcrumbs: (params, context) => {
      const collectionCode = params.collectionCode || '';
      const collectionLabel = context?.collectionLabel || formatCollectionCode(collectionCode);
      const recordLabel = context?.recordLabel || `Record ${params.recordId}`;
      return [
        { label: collectionLabel, href: `/data/${collectionCode}` },
        { label: recordLabel },
      ];
    },
  },
];

interface UseBreadcrumbsOptions {
  collectionLabel?: string;
  recordLabel?: string;
}

export const useBreadcrumbs = (options: UseBreadcrumbsOptions = {}): BreadcrumbItem[] => {
  const location = useLocation();
  const params = useParams();

  return useMemo(() => {
    const path = location.pathname;

    // Find matching route config
    for (const config of routeConfigs) {
      if (config.pattern.test(path)) {
        return config.getBreadcrumbs(params, {
          collectionLabel: options.collectionLabel,
          recordLabel: options.recordLabel,
        });
      }
    }

    // Default fallback - generate from path segments
    const segments = path.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/');
      const isLast = index === segments.length - 1;
      return {
        label: formatCollectionCode(segment),
        href: isLast ? undefined : href,
      };
    });
  }, [location.pathname, params, options.collectionLabel, options.recordLabel]);
};

// Export utility function for manual breadcrumb creation
export { formatCollectionCode };
