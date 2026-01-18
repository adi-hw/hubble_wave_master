/**
 * ListView - Dynamic collection list page using HubbleDataGrid
 *
 * Provides a ServiceNow-style list view with URL pattern:
 * - /{collectionCode}.list - Main list view
 * - /{collectionCode}.list?filter={field}={value} - Pre-filtered list
 *
 * Features:
 * - Automatic column discovery from collection metadata
 * - SSRM for large datasets
 * - View system integration
 * - Quick filters and search
 * - Navigation to record detail page
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  HubbleDataGrid,
  GridColumn,
  GridRowData,
  SortingState,
  ColumnFiltersState,
  GroupingState,
  ColumnPinningState,
  VisibilityState,
  ColumnOrderState,
  SSRMRequest,
  SSRMResponse,
} from '@hubblewave/ui';
import { LayoutList, LayoutGrid } from 'lucide-react';
import { api } from '../lib/api';
import { getStoredToken } from '../services/token';
import { GridCardView } from '../features/data/views/GridCardView';
import { viewApi, ResolvedView } from '../services/viewApi';

// =============================================================================
// COLLECTIONS VIRTUAL COLLECTION CONFIG
// =============================================================================

/**
 * Special handling for 'collections' as a virtual collection
 * This allows /collections.list to show the collections management grid
 */
const COLLECTIONS_METADATA: CollectionMetadata = {
  id: '__collections__',
  code: 'collections',
  name: 'Collection',
  label: 'Collection',
  labelPlural: 'Collections',
  description: 'Platform collection definitions',
  icon: 'C',
  color: 'var(--color-primary-500)',
  isSystem: true,
};

const COLLECTIONS_PROPERTIES: PropertyMetadata[] = [
  {
    id: 'name',
    code: 'name',
    name: 'Name',
    label: 'Name',
    dataType: 'string',
    order: 1,
    visible: true,
    sortable: true,
    filterable: true,
    width: 200,
  },
  {
    id: 'code',
    code: 'code',
    name: 'Code',
    label: 'Code',
    dataType: 'string',
    order: 2,
    visible: true,
    sortable: true,
    filterable: true,
    width: 120,
  },
  {
    id: 'ownerType',
    code: 'ownerType',
    name: 'Type',
    label: 'Type',
    dataType: 'choice',
    order: 3,
    visible: true,
    sortable: true,
    filterable: true,
    width: 100,
    options: [
      { value: 'system', label: 'System', color: 'var(--color-danger-500)' },
      { value: 'platform', label: 'Platform', color: 'var(--color-warning-500)' },
      { value: 'custom', label: 'Custom', color: 'var(--color-success-500)' },
    ],
  },
  {
    id: 'category',
    code: 'category',
    name: 'Category',
    label: 'Category',
    dataType: 'string',
    order: 4,
    visible: true,
    sortable: true,
    filterable: true,
    width: 120,
  },
  {
    id: 'tableName',
    code: 'tableName',
    name: 'Table',
    label: 'Table',
    dataType: 'string',
    order: 5,
    visible: true,
    sortable: true,
    filterable: false,
    width: 150,
  },
  {
    id: 'description',
    code: 'description',
    name: 'Description',
    label: 'Description',
    dataType: 'string',
    order: 6,
    visible: false,
    sortable: false,
    filterable: true,
    width: 250,
  },
  {
    id: 'recordCount',
    code: 'recordCount',
    name: 'Records',
    label: 'Records',
    dataType: 'number',
    order: 7,
    visible: true,
    sortable: true,
    filterable: false,
    width: 80,
  },
  {
    id: 'propertyCount',
    code: 'propertyCount',
    name: 'Properties',
    label: 'Properties',
    dataType: 'number',
    order: 8,
    visible: true,
    sortable: true,
    filterable: false,
    width: 90,
  },
  {
    id: 'isAudited',
    code: 'isAudited',
    name: 'Audited',
    label: 'Audited',
    dataType: 'boolean',
    order: 9,
    visible: false,
    sortable: true,
    filterable: true,
    width: 80,
  },
  {
    id: 'enableVersioning',
    code: 'enableVersioning',
    name: 'Versioned',
    label: 'Versioned',
    dataType: 'boolean',
    order: 10,
    visible: false,
    sortable: true,
    filterable: true,
    width: 90,
  },
  {
    id: 'isExtensible',
    code: 'isExtensible',
    name: 'Extensible',
    label: 'Extensible',
    dataType: 'boolean',
    order: 11,
    visible: false,
    sortable: true,
    filterable: true,
    width: 90,
  },
  {
    id: 'createdAt',
    code: 'createdAt',
    name: 'Created',
    label: 'Created',
    dataType: 'datetime',
    order: 12,
    visible: false,
    sortable: true,
    filterable: false,
    width: 150,
  },
  {
    id: 'updatedAt',
    code: 'updatedAt',
    name: 'Updated',
    label: 'Updated',
    dataType: 'datetime',
    order: 13,
    visible: false,
    sortable: true,
    filterable: false,
    width: 150,
  },
];

/**
 * Check if this is the special 'collections' virtual collection
 */
function isCollectionsVirtualCollection(code: string): boolean {
  return code === 'collections';
}

// =============================================================================
// USERS VIRTUAL COLLECTION CONFIG
// =============================================================================

/**
 * Special handling for 'users' as a virtual collection
 * This allows /users.list to show the users management grid
 */
const USERS_METADATA: CollectionMetadata = {
  id: '__users__',
  code: 'users',
  name: 'User',
  label: 'User',
  labelPlural: 'Users',
  description: 'Platform user accounts',
  icon: 'U',
  color: 'var(--color-info-500)',
  tableName: 'users',
  isSystem: true,
};

const USERS_PROPERTIES: PropertyMetadata[] = [
  {
    id: 'username',
    code: 'username',
    name: 'Username',
    label: 'Username',
    dataType: 'string',
    order: 1,
    visible: true,
    sortable: true,
    filterable: true,
    width: 150,
  },
  {
    id: 'email',
    code: 'email',
    name: 'Email',
    label: 'Email',
    dataType: 'string',
    order: 2,
    visible: true,
    sortable: true,
    filterable: true,
    width: 220,
  },
  {
    id: 'firstName',
    code: 'firstName',
    name: 'First Name',
    label: 'First Name',
    dataType: 'string',
    order: 3,
    visible: true,
    sortable: true,
    filterable: true,
    width: 120,
  },
  {
    id: 'lastName',
    code: 'lastName',
    name: 'Last Name',
    label: 'Last Name',
    dataType: 'string',
    order: 4,
    visible: true,
    sortable: true,
    filterable: true,
    width: 120,
  },
  {
    id: 'status',
    code: 'status',
    name: 'Status',
    label: 'Status',
    dataType: 'choice',
    order: 5,
    visible: true,
    sortable: true,
    filterable: true,
    width: 100,
    options: [
      { value: 'active', label: 'Active', color: 'var(--color-success-500)' },
      { value: 'inactive', label: 'Inactive', color: 'var(--color-neutral-500)' },
      { value: 'pending', label: 'Pending', color: 'var(--color-warning-500)' },
      { value: 'locked', label: 'Locked', color: 'var(--color-danger-500)' },
    ],
  },
  {
    id: 'isAdmin',
    code: 'isAdmin',
    name: 'Admin',
    label: 'Admin',
    dataType: 'boolean',
    order: 6,
    visible: true,
    sortable: true,
    filterable: true,
    width: 80,
  },
  {
    id: 'lastLoginAt',
    code: 'lastLoginAt',
    name: 'Last Login',
    label: 'Last Login',
    dataType: 'datetime',
    order: 7,
    visible: true,
    sortable: true,
    filterable: false,
    width: 150,
  },
  {
    id: 'createdAt',
    code: 'createdAt',
    name: 'Created',
    label: 'Created',
    dataType: 'datetime',
    order: 8,
    visible: false,
    sortable: true,
    filterable: false,
    width: 150,
  },
];

/**
 * Check if this is the special 'users' virtual collection
 */
function isUsersVirtualCollection(code: string): boolean {
  return code === 'users';
}

// =============================================================================
// TYPES
// =============================================================================

interface CollectionMetadata {
  id: string;
  code: string;
  // Backend uses 'name' instead of 'label'
  name?: string;
  label?: string;
  labelPlural?: string;
  description?: string;
  icon?: string;
  color?: string;
  tableName?: string;
  isSystem?: boolean;
}

interface PropertyMetadata {
  id: string;
  code: string;
  // Backend sends 'name' for label
  name?: string;
  label?: string;
  description?: string;
  // Backend may use different property names for the data type
  dataType?: string;
  propertyType?: string;
  propertyTypeId?: string;
  // Config object may contain dataType for virtual properties
  config?: {
    dataType?: string;
    [key: string]: unknown;
  };
  required?: boolean;
  isRequired?: boolean;
  unique?: boolean;
  isUnique?: boolean;
  indexed?: boolean;
  isIndexed?: boolean;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string; color?: string }>;
  referenceCollection?: string;
  referenceCollectionCode?: string; // New property name from enriched endpoint
  referenceCollectionId?: string;
  referenceDisplayProperty?: string;
  order?: number;
  position?: number;
  visible?: boolean;
  isVisible?: boolean;
  sortable?: boolean;
  isSortable?: boolean;
  filterable?: boolean;
  isFilterable?: boolean;
  groupable?: boolean;
  width?: number;
  columnName?: string;
  choiceList?: Array<{ label: string; value: string; color?: string }>;
}

interface ListViewRecord extends GridRowData {
  [key: string]: unknown;
}

type ViewMode = 'list' | 'grid';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract the data type from a property (handles different backend formats)
 */
function getPropertyDataType(prop: PropertyMetadata): string {
  // Try different property paths where data type might be stored
  return (
    prop.dataType || prop.config?.dataType || prop.propertyType || 'string'
  );
}

/**
 * Get the display label for a property
 */
function getPropertyLabel(prop: PropertyMetadata): string {
  return prop.label || prop.name || prop.code;
}

/**
 * Get sort order for a property
 */
function getPropertyOrder(prop: PropertyMetadata): number {
  return prop.order ?? prop.position ?? 999;
}

/**
 * Check if property is visible
 */
function isPropertyVisible(prop: PropertyMetadata): boolean {
  if (prop.visible !== undefined) return prop.visible;
  if (prop.isVisible !== undefined) return prop.isVisible;
  return true;
}

/**
 * Check if property is sortable
 */
function isPropertySortable(prop: PropertyMetadata): boolean {
  if (prop.sortable !== undefined) return prop.sortable;
  if (prop.isSortable !== undefined) return prop.isSortable;
  return true;
}

/**
 * Check if property is filterable
 */
function isPropertyFilterable(prop: PropertyMetadata): boolean {
  if (prop.filterable !== undefined) return prop.filterable;
  if (prop.isFilterable !== undefined) return prop.isFilterable;
  return true;
}

/**
 * Get collection label (singular)
 */
function getCollectionLabel(collection: CollectionMetadata): string {
  return collection.label || collection.name || collection.code;
}

/**
 * Get collection label (plural)
 */
function getCollectionLabelPlural(collection: CollectionMetadata): string {
  if (collection.labelPlural) return collection.labelPlural;
  // Auto-pluralize from label/name
  const singular = getCollectionLabel(collection);
  // Simple pluralization - add 's' or 'es'
  if (
    singular.endsWith('s') ||
    singular.endsWith('x') ||
    singular.endsWith('ch') ||
    singular.endsWith('sh')
  ) {
    return singular + 'es';
  }
  if (
    singular.endsWith('y') &&
    !['a', 'e', 'i', 'o', 'u'].includes(singular.charAt(singular.length - 2))
  ) {
    return singular.slice(0, -1) + 'ies';
  }
  return singular + 's';
}

/**
 * Map backend data types to grid column types
 */
function mapDataTypeToColumnType(
  dataType: string
): GridColumn<ListViewRecord>['type'] {
  const typeMap: Record<string, GridColumn<ListViewRecord>['type']> = {
    // Text types
    text: 'text',
    string: 'text',
    long_text: 'text',
    richtext: 'text',

    // Number types
    number: 'number',
    integer: 'number',
    decimal: 'number',
    float: 'number',

    // Currency & Percent
    currency: 'currency',
    percent: 'percent',
    percentage: 'percent',

    // Date/Time types
    date: 'date',
    datetime: 'datetime',
    timestamp: 'datetime',
    time: 'time',
    duration: 'duration',

    // Boolean
    boolean: 'boolean',

    // Choice/Status types
    choice: 'status',
    status: 'status',
    select: 'select',
    multi_choice: 'tags',

    // Priority
    priority: 'priority',

    // Reference types
    reference: 'reference',
    user: 'user',

    // Tags & Arrays
    tags: 'tags',
    array: 'tags',

    // Media types
    image: 'image',
    file: 'text',

    // Special types
    json: 'text',
    progress: 'progress',
    rating: 'rating',

    // Contact types
    email: 'email',
    url: 'url',
    phone: 'phone',

    // Identifiers
    uuid: 'text',
    binary: 'text',
  };

  return typeMap[dataType?.toLowerCase()] ?? 'text';
}

/**
 * Create grid columns from property metadata
 */
function createColumnsFromProperties(
  properties: PropertyMetadata[]
): GridColumn<ListViewRecord>[] {
  return properties
    .filter((p) => isPropertyVisible(p) && p.code !== 'id')
    .sort((a, b) => getPropertyOrder(a) - getPropertyOrder(b))
    .map((prop) => {
      const dataType = getPropertyDataType(prop);
      const refCollection =
        prop.referenceCollectionCode || prop.referenceCollection || prop.referenceCollectionId;

      return {
        code: prop.code,
        label: getPropertyLabel(prop),
        type: mapDataTypeToColumnType(dataType),
        width: prop.width ?? getDefaultWidth(dataType),
        sortable: isPropertySortable(prop),
        filterable: isPropertyFilterable(prop),
        groupable: prop.groupable !== false,
        resizable: true,
        pinnable: true,
        editable: true, // Enable inline editing for all columns
        options: prop.options,
        reference: refCollection
          ? {
              collection: refCollection,
              displayProperty: prop.referenceDisplayProperty ?? 'name',
            }
          : undefined,
      };
    });
}

function createColumnsFromViewLayout(
  properties: PropertyMetadata[],
  layout: Record<string, unknown>,
  fieldPermissions?: Record<string, { canRead: boolean; canWrite: boolean }>
): GridColumn<ListViewRecord>[] {
  const columns =
    (layout.columns as Array<Record<string, unknown>> | undefined) ||
    ((layout.list as Record<string, unknown> | undefined)?.columns as Array<Record<string, unknown>> | undefined) ||
    [];

  if (!Array.isArray(columns) || columns.length === 0) {
    return [];
  }

  const propertyMap = new Map(properties.map((prop) => [prop.code, prop]));

  return columns
    .map((column) => {
      const code = (column.property_code || column.code) as string | undefined;
      if (!code) {
        return null;
      }
      const permissions = fieldPermissions?.[code];
      if (permissions && permissions.canRead === false) {
        return null;
      }
      const prop = propertyMap.get(code);
      if (!prop) {
        return null;
      }
      if (column.visible === false) {
        return null;
      }

      const dataType = getPropertyDataType(prop);
      const refCollection =
        prop.referenceCollectionCode || prop.referenceCollection || prop.referenceCollectionId;

      return {
        code,
        label: (column.label as string) || getPropertyLabel(prop),
        type: mapDataTypeToColumnType(dataType),
        width: (column.width as number) ?? prop.width ?? getDefaultWidth(dataType),
        sortable: isPropertySortable(prop),
        filterable: isPropertyFilterable(prop),
        groupable: prop.groupable !== false,
        resizable: true,
        pinnable: true,
        editable: permissions ? permissions.canWrite : true,
        options: prop.options,
        reference: refCollection
          ? {
              collection: refCollection,
              displayProperty: prop.referenceDisplayProperty ?? 'name',
            }
          : undefined,
      } as GridColumn<ListViewRecord>;
    })
    .filter((column): column is GridColumn<ListViewRecord> => Boolean(column));
}

/**
 * Get default column width based on data type
 */
function getDefaultWidth(dataType: string): number {
  const widthMap: Record<string, number> = {
    text: 200,
    richtext: 300,
    string: 200,
    number: 100,
    integer: 100,
    decimal: 120,
    currency: 120,
    percent: 100,
    date: 120,
    datetime: 160,
    time: 100,
    duration: 120,
    boolean: 80,
    choice: 140,
    status: 140,
    priority: 120,
    reference: 180,
    user: 160,
    tags: 200,
    image: 100,
    progress: 150,
    uuid: 280,
    json: 200,
  };

  return widthMap[dataType?.toLowerCase()] ?? 150;
}

// =============================================================================
// COLLECTIONS SSRM FETCHERS (for virtual 'collections' collection)
// =============================================================================

/**
 * SSRM data fetcher for collections (from metadata API)
 */
async function collectionsFetcher<TData extends GridRowData>(
  request: SSRMRequest
): Promise<SSRMResponse<TData>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Metadata API with server-side params (supports sorting via query params)
  const params = new URLSearchParams();
  params.set('includeSystem', 'true');
  params.set('limit', String(request.endRow - request.startRow));
  params.set('offset', String(request.startRow));

  if (request.globalFilter) {
    params.set('search', request.globalFilter);
  }

  // Backend uses sortBy and sortOrder (not sort param)
  if (request.sorting && request.sorting.length > 0) {
    const sort = request.sorting[0];
    // Map frontend column IDs to backend sort field names
    const sortFieldMap: Record<string, string> = {
      name: 'label',
      code: 'code',
      ownerType: 'ownerType',
      category: 'category',
      tableName: 'tableName',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    };
    const sortBy = sortFieldMap[sort.id] || sort.id;
    params.set('sortBy', sortBy);
    params.set('sortOrder', sort.desc ? 'desc' : 'asc');
  }

  if (request.filters && request.filters.length > 0) {
    const filterObj: Record<string, unknown> = {};
    request.filters.forEach((f) => {
      if (f.value !== undefined && f.value !== '') {
        filterObj[f.id] = f.value;
      }
    });
    if (Object.keys(filterObj).length > 0) {
      params.set('filters', JSON.stringify(filterObj));
    }
  }

  if (request.grouping && request.grouping.length > 0) {
    params.set('groupBy', request.grouping.join(','));
  }

  const url = `/api/metadata/collections?${params.toString()}&t=${Date.now()}`;

  const response = await fetch(
    url,
    {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(`Collections fetch failed: ${response.statusText}`);
  }

  const result = await response.json();
  const rawData = Array.isArray(result) ? result : result.data ?? [];
  const rows = rawData.map((c: Record<string, unknown>) => ({
    ...c,
    id: c.id,
    name: c.name || c.label || c.code,
    ownerType: c.ownerType || (c.isSystem ? 'system' : 'custom'),
  }));

  return {
    rows: rows as TData[],
    lastRow:
      rows.length < request.endRow - request.startRow
        ? request.startRow + rows.length
        : -1,
  };
}

/**
 * Count fetcher for collections
 */
async function collectionsCountFetcher(params: {
  collection: string;
  filters?: { id: string; value: unknown }[];
  grouping?: string[];
  globalFilter?: string;
}): Promise<number> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const queryParams = new URLSearchParams();
  queryParams.set('includeSystem', 'true');
  queryParams.set('limit', '1');

  if (params.globalFilter) {
    queryParams.set('search', params.globalFilter);
  }

  // Filters (for count)
  if (params.filters && params.filters.length > 0) {
    const filterObj: Record<string, unknown> = {};
    params.filters.forEach((f) => {
      if (f.value !== undefined && f.value !== '') {
        filterObj[f.id] = f.value;
      }
    });
    if (Object.keys(filterObj).length > 0) {
      queryParams.set('filters', JSON.stringify(filterObj));
    }
  }

  // Grouping (for count)
  if (params.grouping && params.grouping.length > 0) {
    queryParams.set('groupBy', params.grouping.join(','));
  }

  const response = await fetch(
    `/api/metadata/collections?${queryParams.toString()}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );

  if (!response.ok) {
    return 0;
  }

  const result = await response.json();
  // If meta.total exists, use it; otherwise count from array
  if (result.meta?.total !== undefined) {
    return result.meta.total;
  }

  // Fallback: fetch all to count (not ideal but works)
  const countParams = new URLSearchParams();
  countParams.set('includeSystem', 'true');
  countParams.set('limit', '500'); // Increase limit to ensure we catch most
  
  // Apply filters/search to fallback count as well
  if (params.globalFilter) countParams.set('search', params.globalFilter);
  if (params.filters && params.filters.length > 0) {
     const filterObj: Record<string, unknown> = {};
      params.filters.forEach((f) => {
        if (f.value !== undefined && f.value !== '') {
          filterObj[f.id] = f.value;
        }
      });
      if (Object.keys(filterObj).length > 0) {
        countParams.set('filters', JSON.stringify(filterObj));
      }
  }

  const countResponse = await fetch(
    `/api/metadata/collections?${countParams.toString()}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );

  if (!countResponse.ok) return 0;

  const countResult = await countResponse.json();
  const data = Array.isArray(countResult)
    ? countResult
    : countResult.data ?? [];
  return data.length;
}

// =============================================================================
// USERS SSRM FETCHERS (for virtual 'users' collection)
// =============================================================================

/**
 * SSRM data fetcher for users (from auth API)
 */
async function usersFetcher<TData extends GridRowData>(
  request: SSRMRequest
): Promise<SSRMResponse<TData>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Auth API with server-side params
  const params = new URLSearchParams();
  params.set('limit', String(request.endRow - request.startRow));
  params.set('offset', String(request.startRow));

  if (request.globalFilter) {
    params.set('search', request.globalFilter);
  }

  // Sorting
  if (request.sorting && request.sorting.length > 0) {
    const sort = request.sorting[0];
    params.set('sortBy', sort.id);
    params.set('sortOrder', sort.desc ? 'desc' : 'asc');
  }

  // Filters
  if (request.filters && request.filters.length > 0) {
    const filterObj: Record<string, unknown> = {};
    request.filters.forEach((f) => {
      if (f.value !== undefined && f.value !== '') {
        filterObj[f.id] = f.value;
      }
    });
    if (Object.keys(filterObj).length > 0) {
      params.set('filters', JSON.stringify(filterObj));
    }
  }

  const url = `/api/auth/users?${params.toString()}&t=${Date.now()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Users fetch failed: ${response.statusText}`);
  }

  const result = await response.json();
  const rawData = Array.isArray(result) ? result : result.data ?? result.users ?? [];
  const rows = rawData.map((u: Record<string, unknown>) => ({
    ...u,
    id: u.id,
    // Map status from isActive if not present
    status: u.status || (u.isActive ? 'active' : 'inactive'),
  }));

  return {
    rows: rows as TData[],
    lastRow:
      rows.length < request.endRow - request.startRow
        ? request.startRow + rows.length
        : -1,
  };
}

/**
 * Count fetcher for users
 */
async function usersCountFetcher(params: {
  collection: string;
  filters?: { id: string; value: unknown }[];
  grouping?: string[];
  globalFilter?: string;
}): Promise<number> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const queryParams = new URLSearchParams();
  queryParams.set('limit', '1');

  if (params.globalFilter) {
    queryParams.set('search', params.globalFilter);
  }

  // Filters
  if (params.filters && params.filters.length > 0) {
    const filterObj: Record<string, unknown> = {};
    params.filters.forEach((f) => {
      if (f.value !== undefined && f.value !== '') {
        filterObj[f.id] = f.value;
      }
    });
    if (Object.keys(filterObj).length > 0) {
      queryParams.set('filters', JSON.stringify(filterObj));
    }
  }

  const response = await fetch(
    `/api/auth/users?${queryParams.toString()}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );

  if (!response.ok) {
    return 0;
  }

  const result = await response.json();
  // If meta.total or total exists, use it
  if (result.meta?.total !== undefined) {
    return result.meta.total;
  }
  if (result.total !== undefined) {
    return result.total;
  }

  // Fallback: fetch all to count
  const countParams = new URLSearchParams();
  countParams.set('limit', '500');
  if (params.globalFilter) countParams.set('search', params.globalFilter);

  const countResponse = await fetch(
    `/api/auth/users?${countParams.toString()}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );

  if (!countResponse.ok) return 0;

  const countResult = await countResponse.json();
  const data = Array.isArray(countResult)
    ? countResult
    : countResult.data ?? countResult.users ?? [];
  return data.length;
}

// =============================================================================
// SSRM FETCHER - Uses proper offset-based grid query endpoint
// =============================================================================

/**
 * Build grid query request body from SSRMRequest
 * Uses the POST /api/grid/query endpoint which accepts startRow/endRow directly
 */
function buildGridQueryBody(request: SSRMRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    collection: request.collection,
    startRow: request.startRow,
    endRow: request.endRow,
  };

  // Sorting - transform to grid API format
  if (request.sorting && request.sorting.length > 0) {
    body.sorting = request.sorting.map((s) => ({
      column: s.id,
      direction: s.desc ? 'desc' : 'asc',
    }));
  }

  // Filters - transform to grid API format
  if (request.filters && request.filters.length > 0) {
    body.filters = request.filters
      .filter((f) => f.value !== undefined && f.value !== '')
      .map((f) => ({
        column: f.id,
        operator: 'contains', // Default to contains for simple text filters
        value: f.value,
      }));
  }

  // Global search
  if (request.globalFilter) {
    body.globalFilter = request.globalFilter;
  }

  // Grouping
  if (request.grouping && request.grouping.length > 0) {
    body.grouping = {
      columns: request.grouping,
    };
  }

  return body;
}

/**
 * Authenticated SSRM data fetcher using offset-based grid query endpoint
 */
async function authenticatedFetcher<TData extends GridRowData>(
  request: SSRMRequest
): Promise<SSRMResponse<TData>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const body = buildGridQueryBody(request);

  const response = await fetch('/api/data/grid/query', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Grid query failed: ${response.statusText}`);
  }

  const result = await response.json();

  // Grid API returns { rows: [], lastRow: number }
  return {
    rows: result.rows as TData[],
    lastRow: result.lastRow,
  };
}

/**
 * Authenticated count fetcher using grid count endpoint
 */
async function authenticatedCountFetcher(params: {
  collection: string;
  filters?: { id: string; value: unknown }[];
  grouping?: string[];
  globalFilter?: string;
}): Promise<number> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Build count request body
  const body: Record<string, unknown> = {
    collection: params.collection,
  };

  // Filters - transform to grid API format
  if (params.filters && params.filters.length > 0) {
    body.filters = params.filters
      .filter((f) => f.value !== undefined && f.value !== '')
      .map((f) => ({
        column: f.id,
        operator: 'contains',
        value: f.value,
      }));
  }

  // Global search
  if (params.globalFilter) {
    body.globalFilter = params.globalFilter;
  }

  // Grouping
  if (params.grouping && params.grouping.length > 0) {
    body.grouping = {
      columns: params.grouping,
    };
  }

  const response = await fetch('/api/data/grid/count', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Grid count failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.count ?? 0;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ListView() {
  const { collectionCode: rawCode } = useParams<{ collectionCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract collection code (remove .list suffix if present)
  const collectionCode = rawCode?.replace(/\.list$/, '') ?? '';

  // State
  const [collection, setCollection] = useState<CollectionMetadata | null>(null);
  const [properties, setProperties] = useState<PropertyMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resolvedView, setResolvedView] = useState<ResolvedView | null>(null);
  // Initialize view mode from URL param 'mode', default to 'list'
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('mode') as ViewMode) || 'list'
  );

  // Parse initial grid state from URL params
  const initialGridState = useMemo(() => {
    // Parse sorting: ?sort=field:asc or ?sort=field:desc
    const sortParam = searchParams.get('sort');
    let initialSorting: SortingState = [];
    if (sortParam) {
      const [field, dir] = sortParam.split(':');
      if (field) {
        initialSorting = [{ id: field, desc: dir === 'desc' }];
      }
    }

    // Parse grouping: ?group=field1,field2
    const groupParam = searchParams.get('group');
    let initialGrouping: GroupingState = [];
    if (groupParam) {
      initialGrouping = groupParam.split(',').filter(Boolean);
    }

    // Parse filters: ?filter.field=operator:value
    const initialFilters: ColumnFiltersState = [];
    searchParams.forEach((value, key) => {
      if (key.startsWith('filter.')) {
        const field = key.replace('filter.', '');
        // Value format is "operator:filterValue" or just "filterValue" (equals implied)
        const colonIndex = value.indexOf(':');
        if (colonIndex > 0) {
          const operator = value.substring(0, colonIndex);
          const filterValue = value.substring(colonIndex + 1);
          initialFilters.push({ id: field, value: { operator, value: filterValue } });
        } else {
          initialFilters.push({ id: field, value });
        }
      }
    });

    // Parse global filter (search): ?q=searchTerm
    const initialGlobalFilter = searchParams.get('q') ?? '';

    // Parse column pinning: ?pinned=field1:left,field2:right
    const pinParam = searchParams.get('pinned');
    let initialColumnPinning: ColumnPinningState = { left: [], right: [] };
    if (pinParam) {
      const leftPinned: string[] = [];
      const rightPinned: string[] = [];
      pinParam.split(',').forEach((part) => {
        const [col, side] = part.split(':');
        if (col && side === 'left') {
          leftPinned.push(col);
        } else if (col && side === 'right') {
          rightPinned.push(col);
        }
      });
      initialColumnPinning = { left: leftPinned, right: rightPinned };
    }

    return {
      initialSorting,
      initialGrouping,
      initialFilters,
      initialGlobalFilter,
      initialColumnPinning,
    };
  }, []); // Only parse once on mount - URL changes handled by handlers

  // Grid View Data State
  const [gridData, setGridData] = useState<Record<string, unknown>[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  // Track current filters for grid view
  const [currentFilters, setCurrentFilters] = useState<ColumnFiltersState>(initialGridState.initialFilters);
  const [currentSorting, setCurrentSorting] = useState<SortingState>(initialGridState.initialSorting);
  const [currentGlobalFilter, _setCurrentGlobalFilter] = useState<string>(initialGridState.initialGlobalFilter);
  void _setCurrentGlobalFilter; // Reserved for future use

  // Update URL when view mode changes
  useEffect(() => {
    const mode = searchParams.get('mode') as ViewMode;
    if (mode && mode !== viewMode) {
      setViewMode(mode);
    }
  }, [searchParams]);

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    const newParams = new URLSearchParams(searchParams);
    if (mode === 'list') {
      newParams.delete('mode');
    } else {
      newParams.set('mode', mode);
    }
    setSearchParams(newParams);
  };

  // Load collection metadata
  useEffect(() => {
    if (!collectionCode) {
      setError('Collection code is required');
      setIsLoading(false);
      return;
    }

    loadMetadata();
  }, [collectionCode]);

  useEffect(() => {
    if (!collectionCode) {
      setResolvedView(null);
      return;
    }
    let active = true;
    viewApi
      .resolve({ kind: 'list', collection: collectionCode, route: location.pathname })
      .then((view) => {
        if (active) {
          setResolvedView(view);
        }
      })
      .catch((err) => {
        if (active) {
          console.warn('List view resolution failed', err);
          setResolvedView(null);
        }
      });
    return () => {
      active = false;
    };
  }, [collectionCode, location.pathname]);

  // Load grid data when entering grid mode or when filters change
  useEffect(() => {
    if (viewMode === 'grid' && collectionCode) {
      loadGridData();
    }
  }, [viewMode, collectionCode, currentFilters, currentSorting, currentGlobalFilter]);

  async function loadMetadata() {
    try {
      setIsLoading(true);
      setError(null);

      // Special handling for 'collections' virtual collection
      if (isCollectionsVirtualCollection(collectionCode)) {
        setCollection(COLLECTIONS_METADATA);
        setProperties(COLLECTIONS_PROPERTIES);
        return;
      }

      // Special handling for 'users' virtual collection
      if (isUsersVirtualCollection(collectionCode)) {
        setCollection(USERS_METADATA);
        setProperties(USERS_PROPERTIES);
        return;
      }

      // Fetch collection schema (includes properties)
      // Uses /data/collections to route to svc-data via Vite proxy
      const schemaResponse = await api.get<{
        collection: CollectionMetadata;
        properties: PropertyMetadata[];
      }>(`/data/collections/${collectionCode}/schema`);

      setCollection(schemaResponse.collection);
      setProperties(schemaResponse.properties);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load collection metadata';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadGridData() {
    try {
      setGridLoading(true);

      // Build query params with filters
      const params = new URLSearchParams();
      params.set('pageSize', '200'); // Load more for grid view

      // Add sorting (format: field:direction,field:direction)
      if (currentSorting.length > 0) {
        const sortParam = currentSorting.map(s => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',');
        params.set('sort', sortParam);
      }

      // Add global filter/search (backend expects 'search' not 'q')
      if (currentGlobalFilter) {
        params.set('search', currentGlobalFilter);
      }

      // Add column filters as JSON array (backend expects 'filters' as array of FilterCondition)
      // FilterCondition: { field: string, operator: string, value: unknown }
      if (currentFilters.length > 0) {
        const filtersArr: Array<{ field: string; operator: string; value: unknown }> = [];
        currentFilters.forEach(filter => {
          if (filter.value != null && filter.value !== '') {
            const filterValue = filter.value as Record<string, unknown>;
            if (typeof filter.value === 'object' && 'operator' in filterValue) {
              // Already has operator specified
              filtersArr.push({
                field: filter.id,
                operator: filterValue.operator as string,
                value: filterValue.value,
              });
            } else {
              // Default to 'contains' for text/string searches
              filtersArr.push({
                field: filter.id,
                operator: 'contains',
                value: filter.value,
              });
            }
          }
        });
        if (filtersArr.length > 0) {
          params.set('filters', JSON.stringify(filtersArr));
        }
      }

      const url = `/data/collections/${collectionCode}/data?${params.toString()}`;
      console.log('Loading grid data from:', url);
      const response = await api.get<{ data: Record<string, unknown>[]; meta: unknown }>(url);
      console.log('Grid data response:', response);
      setGridData(response.data);
    } catch (err) {
      console.error('Failed to load grid data', err);
      // Log more details about the error
      if (err instanceof Error) {
        console.error('Error details:', err.message, err.stack);
      }
    } finally {
      setGridLoading(false);
    }
  }

  // Check if this is a virtual collection
  const isCollections = isCollectionsVirtualCollection(collectionCode);
  const isUsers = isUsersVirtualCollection(collectionCode);

  // Create columns from properties
  const columns = useMemo(() => {
    if (properties.length === 0) return [];
    const fieldPermissions = resolvedView?.fieldPermissions;
    const readableProperties = fieldPermissions
      ? properties.filter((prop) => fieldPermissions[prop.code]?.canRead !== false)
      : properties;
    if (resolvedView?.layout) {
      const viewColumns = createColumnsFromViewLayout(
        readableProperties,
        resolvedView.layout,
        fieldPermissions
      );
      if (viewColumns.length > 0) {
        return viewColumns;
      }
    }
    return createColumnsFromProperties(readableProperties);
  }, [properties, resolvedView]);

  // Row actions for the 3-dots menu
  const rowActions = useMemo(() => {
    if (isCollections) {
      return [
        {
          id: 'view',
          label: 'View',
          onClick: (row: ListViewRecord) => navigate(`/studio/collections/${row.id}`),
        },
        {
          id: 'edit',
          label: 'Edit',
          onClick: (row: ListViewRecord) => navigate(`/studio/collections/${row.id}`),
        },
      ];
    } else if (isUsers) {
      return [
        {
          id: 'view',
          label: 'View',
          onClick: (row: ListViewRecord) => navigate(`/studio/users/${row.id}`),
        },
        {
          id: 'edit',
          label: 'Edit',
          onClick: (row: ListViewRecord) => navigate(`/studio/users/${row.id}`),
        },
      ];
    } else {
      return [
        {
          id: 'view',
          label: 'View',
          onClick: (row: ListViewRecord) => navigate(`/${collectionCode}/${row.id}`),
        },
        {
          id: 'edit',
          label: 'Edit',
          onClick: (row: ListViewRecord) =>
            navigate(`/${collectionCode}/${row.id}?edit=true`),
        },
        {
          id: 'delete',
          label: 'Delete',
          variant: 'danger' as const,
          onClick: async (row: ListViewRecord) => {
            const label = collection
              ? getCollectionLabel(collection)
              : 'record';
            if (confirm(`Delete this ${label}?`)) {
              try {
                await api.delete(
                  `/data/collections/${collectionCode}/data/${row.id}`
                );
                // Refresh will happen via grid refetch
              } catch (err) {
                console.error('Delete failed:', err);
              }
            }
          },
        },
      ];
    }
  }, [collectionCode, collection, navigate, isCollections, isUsers]);

  // Event handlers - different navigation for virtual collections
  const handleRowClick = useCallback(
    (row: Record<string, unknown>) => {
      const id = row.id as string;
      if (isCollections) {
        navigate(`/studio/collections/${id}`);
      } else if (isUsers) {
        navigate(`/studio/users/${id}`);
      } else {
        navigate(`/${collectionCode}/${id}`);
      }
    },
    [collectionCode, navigate, isCollections, isUsers]
  );

  // Handle reference cell click - navigate to the referenced record
  const handleReferenceClick = useCallback(
    (referenceInfo: {
      collection: string;
      recordId: string;
      columnCode: string;
      displayValue: string;
      row: ListViewRecord;
    }) => {
      // Navigate to the referenced record
      navigate(`/${referenceInfo.collection}/${referenceInfo.recordId}`);
    },
    [navigate]
  );

  const handleSortChange = useCallback(
    (sorting: SortingState) => {
      // Update local state for grid view
      setCurrentSorting(sorting);

      const newParams = new URLSearchParams(searchParams);
      if (sorting.length > 0) {
        newParams.set(
          'sort',
          `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}`
        );
      } else {
        newParams.delete('sort');
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handleFilterChange = useCallback(
    (filters: ColumnFiltersState) => {
      // Update local state for grid view
      setCurrentFilters(filters);

      const newParams = new URLSearchParams(searchParams);

      // Remove all existing filter.* params
      const keysToDelete: string[] = [];
      newParams.forEach((_, key) => {
        if (key.startsWith('filter.')) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => newParams.delete(key));

      // Add new filters to URL
      filters.forEach((filter) => {
        if (filter.value !== undefined && filter.value !== '') {
          newParams.set(`filter.${filter.id}`, String(filter.value));
        }
      });

      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handleGroupChange = useCallback(
    (grouping: GroupingState) => {
      const newParams = new URLSearchParams(searchParams);
      if (grouping.length > 0) {
        newParams.set('group', grouping.join(','));
      } else {
        newParams.delete('group');
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handleColumnPinningChange = useCallback(
    (columnPinning: ColumnPinningState) => {
      const newParams = new URLSearchParams(searchParams);

      // Store left pinned columns (excluding system columns like select and _actions)
      const leftPinned = (columnPinning.left ?? []).filter(
        (col) => col !== 'select' && col !== '_actions'
      );
      const rightPinned = columnPinning.right ?? [];

      if (leftPinned.length > 0 || rightPinned.length > 0) {
        const pinningValue = [
          ...leftPinned.map((col) => `${col}:left`),
          ...rightPinned.map((col) => `${col}:right`),
        ].join(',');
        newParams.set('pinned', pinningValue);
      } else {
        newParams.delete('pinned');
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handleColumnVisibilityChange = useCallback(
    (columnVisibility: VisibilityState) => {
      const newParams = new URLSearchParams(searchParams);

      // Only store hidden columns (visible=false)
      const hiddenColumns = Object.entries(columnVisibility)
        .filter(([, visible]) => visible === false)
        .map(([col]) => col);

      if (hiddenColumns.length > 0) {
        newParams.set('hidden', hiddenColumns.join(','));
      } else {
        newParams.delete('hidden');
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handleColumnReorder = useCallback(
    (columnOrder: ColumnOrderState) => {
      const newParams = new URLSearchParams(searchParams);

      // Filter out system columns and store custom order
      const customOrder = columnOrder.filter(
        (col) => col !== 'select' && col !== '_actions'
      );

      // Only store if there's a custom order (more than just default columns)
      if (customOrder.length > 0) {
        newParams.set('columns', customOrder.join(','));
      } else {
        newParams.delete('columns');
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  // Navigate to new record - moved here to ensure hooks are called consistently
  const handleAdd = useCallback(() => {
    if (isCollectionsVirtualCollection(collectionCode)) {
      navigate('/studio/collections/new');
    } else if (isUsersVirtualCollection(collectionCode)) {
      navigate('/studio/users/invite');
    } else {
      navigate(`/${collectionCode}/new`);
    }
  }, [navigate, collectionCode]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">
            Loading {collectionCode}...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="p-6 rounded-lg text-center max-w-md bg-destructive/10 border border-destructive">
          <h2 className="text-lg font-semibold mb-2 text-destructive">
            Failed to Load Collection
          </h2>
          <p className="mb-4 text-destructive">
            {error}
          </p>
          <button
            onClick={loadMetadata}
            className="px-4 py-2 rounded-lg transition-colors bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No collection found
  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-foreground">
            Collection Not Found
          </h2>
          <p className="text-muted-foreground">
            The collection "{collectionCode}" does not exist.
          </p>
        </div>
      </div>
    );
  }

  // Get the storage table name (use tableName if available, otherwise collection name)
  const storageTableName = collection.tableName || getCollectionLabel(collection);

  // View toggle component for toolbar custom actions
  const viewToggle = (
    <div className="flex p-0.5 rounded-lg mr-2 bg-muted border border-border">
      <button
        onClick={() => handleModeChange('list')}
        className={`p-1.5 rounded-md transition-all ${
          viewMode === 'list'
            ? 'bg-card text-foreground shadow-sm'
            : 'bg-transparent text-muted-foreground'
        }`}
        title="List View"
      >
        <LayoutList size={16} />
      </button>
      <button
        onClick={() => handleModeChange('grid')}
        className={`p-1.5 rounded-md transition-all ${
          viewMode === 'grid'
            ? 'bg-card text-foreground shadow-sm'
            : 'bg-transparent text-muted-foreground'
        }`}
        title="Grid View"
      >
        <LayoutGrid size={16} />
      </button>
    </div>
  );

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-background">
      {/* Main Content - No external header, toolbar handles everything */}
      {/* Use flex layout with explicit height constraints for proper grid sizing */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
        {viewMode === 'list' ? (
            <HubbleDataGrid<ListViewRecord>
              collection={collectionCode}
              columns={columns}
              enableSSRM={true}
            ssrmFetcher={
              isCollections
                ? collectionsFetcher
                : isUsers
                ? usersFetcher
                : authenticatedFetcher
            }
            ssrmCountFetcher={
              isCollections
                ? collectionsCountFetcher
                : isUsers
                ? usersCountFetcher
                : authenticatedCountFetcher
            }
            getAuthToken={getStoredToken}
            pageSize={25}
            blockSize={100}
            maxCacheBlocks={50}
            // Initial state from URL params
            initialSorting={initialGridState.initialSorting}
            initialFilters={initialGridState.initialFilters}
            initialGrouping={initialGridState.initialGrouping}
            initialGlobalFilter={initialGridState.initialGlobalFilter}
            initialColumnPinning={initialGridState.initialColumnPinning}
            enableSorting={true}
            enableFiltering={true}
            enableGrouping={true}
            enableRowSelection={true}
            enableMultiRowSelection={true}
            enableColumnResize={true}
            enableColumnReorder={true}
            enableColumnPinning={true}
            enableExport={true}
            enableSearch={true}
            enableAva={true}
            enableEditing={true}
            editTrigger="doubleClick"
            density="comfortable"
            showToolbar={true}
            showStatusBar={true}
            showAvaBar={true}
            toolbarTitle={storageTableName}
            onAdd={handleAdd}
            toolbarCustomActions={viewToggle}
            emptyMessage={`No ${getCollectionLabelPlural(
              collection
            ).toLowerCase()} found`}
            onRowView={handleRowClick}
            onRowClick={handleRowClick}
            rowActions={rowActions}
            onSortChange={handleSortChange}
            onFilterChange={handleFilterChange}
            onGroupChange={handleGroupChange}
            onColumnReorder={handleColumnReorder}
            onColumnPinningChange={handleColumnPinningChange}
            onColumnVisibilityChange={handleColumnVisibilityChange}
            onReferenceClick={handleReferenceClick}
            ariaLabel={`${getCollectionLabelPlural(collection)} list`}
            className="flex-1 min-h-0 rounded-2xl h-full max-h-full"
          />
        ) : (
          // Grid Card View
          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden bg-card h-full">
            <GridCardView
              data={gridData}
              properties={properties.map(
                (p) =>
                  ({
                    id: p.id,
                    code: p.code,
                    label: p.label || p.name || p.code,
                    name: p.name,
                    dataType: p.dataType || p.propertyType || 'string',
                    propertyType: p.propertyType,
                    description: p.description,
                    options: p.options,
                    choiceList: p.choiceList,
                  } as any)
              )}
              loading={gridLoading}
              collectionCode={collectionCode}
              onRowClick={handleRowClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ListView;
