import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { BreadcrumbItem } from '../components/navigation/Breadcrumbs';

// Context for breadcrumb generation
interface BreadcrumbContext {
  tableLabel?: string;
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

// Format table code to a readable label (e.g., "asset_types" -> "Asset Types")
const formatTableCode = (code: string): string => {
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
  // Studio - Collections
  {
    pattern: /^\/studio\/collections$/,
    getBreadcrumbs: () => [
      { label: 'Studio' },
      { label: 'Collections' },
    ],
  },
  {
    pattern: /^\/studio\/collections\/[^/]+/,
    getBreadcrumbs: (params, context) => [
      { label: 'Studio' },
      { label: 'Collections', href: '/studio/collections' },
      { label: context?.tableLabel || formatTableCode(params.collectionCode || params.id || 'Collection') },
    ],
  },
  // Data Engine - Collection Data Pages
  {
    pattern: /^\/data\/[^/]+$/,
    getBreadcrumbs: (params, context) => [
      { label: context?.tableLabel || formatTableCode(params.collectionCode || 'Records') },
    ],
  },
  {
    pattern: /^\/data\/[^/]+\/[^/]+$/,
    getBreadcrumbs: (params, context) => {
      const collectionCode = params.collectionCode || '';
      const collectionLabel = context?.tableLabel || formatTableCode(collectionCode);
      const recordLabel = context?.recordLabel || `Record ${params.recordId}`;
      return [
        { label: collectionLabel, href: `/data/${collectionCode}` },
        { label: recordLabel },
      ];
    },
  },
];

interface UseBreadcrumbsOptions {
  tableLabel?: string;
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
          tableLabel: options.tableLabel,
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
        label: formatTableCode(segment),
        href: isLast ? undefined : href,
      };
    });
  }, [location.pathname, params, options.tableLabel, options.recordLabel]);
};

// Export utility function for manual breadcrumb creation
export { formatTableCode };
