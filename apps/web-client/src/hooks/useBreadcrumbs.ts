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
  // Studio - Schema
  {
    pattern: /^\/studio\/schema$/,
    getBreadcrumbs: () => [
      { label: 'Studio', href: '/studio/schema' },
      { label: 'Schema Builder' },
    ],
  },
  {
    pattern: /^\/studio\/schema\/new$/,
    getBreadcrumbs: () => [
      { label: 'Studio', href: '/studio/schema' },
      { label: 'Schema Builder', href: '/studio/schema' },
      { label: 'New Table' },
    ],
  },
  {
    pattern: /^\/studio\/schema\/[^/]+$/,
    getBreadcrumbs: (params) => [
      { label: 'Studio', href: '/studio/schema' },
      { label: 'Schema Builder', href: '/studio/schema' },
      { label: formatTableCode(params.tableName || 'Table') },
    ],
  },
  // Studio - Tables
  {
    pattern: /^\/studio\/tables$/,
    getBreadcrumbs: () => [
      { label: 'Studio' },
      { label: 'Tables' },
    ],
  },
  {
    pattern: /^\/studio\/tables\/[^/]+/,
    getBreadcrumbs: (params, context) => [
      { label: 'Studio' },
      { label: 'Tables', href: '/studio/tables' },
      { label: context?.tableLabel || formatTableCode(params.tableCode || 'Table') },
    ],
  },
  // Module List: /:tableCode.list
  {
    pattern: /^\/[^/]+\.list$/,
    getBreadcrumbs: (params, context) => [
      { label: context?.tableLabel || formatTableCode(params.tableCode?.replace('.list', '') || 'Records') },
    ],
  },
  // Module Create: /:tableCode.form
  {
    pattern: /^\/[^/]+\.form$/,
    getBreadcrumbs: (params, context) => {
      const tableCode = params.tableCode?.replace('.form', '') || '';
      const tableLabel = context?.tableLabel || formatTableCode(tableCode);
      return [
        { label: tableLabel, href: `/${tableCode}.list` },
        { label: 'New Record' },
      ];
    },
  },
  // Module Record: /:tableCode.form/:id
  {
    pattern: /^\/[^/]+\.form\/[^/]+$/,
    getBreadcrumbs: (params, context) => {
      const tableCode = params.tableCode?.replace('.form', '') || '';
      const tableLabel = context?.tableLabel || formatTableCode(tableCode);
      const recordLabel = context?.recordLabel || `Record ${params.id}`;
      return [
        { label: tableLabel, href: `/${tableCode}.list` },
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
