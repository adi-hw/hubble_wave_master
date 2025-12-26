/**
 * ListView - Dynamic collection list page using HubbleDataGrid
 *
 * Provides a ServiceNow-style list view with URL pattern:
 * - /{collectionCode}.list - Main list view
 * - /{collectionCode}.list?view={viewId} - List with specific view
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
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  HubbleDataGrid,
  GridColumn,
  GridRowData,
  SortingState,
  ColumnFiltersState,
  SSRMRequest,
  SSRMResponse,
} from '@hubblewave/ui';
import { LayoutList, KanbanSquare } from 'lucide-react';
import { api } from '../lib/api';
import { getStoredToken } from '../services/token';
import { BoardView } from '../features/data/views/BoardView';

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

type ViewMode = 'list' | 'board';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract the data type from a property (handles different backend formats)
 */
function getPropertyDataType(prop: PropertyMetadata): string {
  // Try different property paths where data type might be stored
  return (
    prop.dataType ||
    prop.config?.dataType ||
    prop.propertyType ||
    'string'
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
  if (singular.endsWith('s') || singular.endsWith('x') || singular.endsWith('ch') || singular.endsWith('sh')) {
    return singular + 'es';
  }
  if (singular.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(singular.charAt(singular.length - 2))) {
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
    text: 'text',
    string: 'text',
    richtext: 'text',
    number: 'number',
    integer: 'number',
    decimal: 'number',
    float: 'number',
    currency: 'currency',
    percent: 'percent',
    date: 'date',
    datetime: 'datetime',
    timestamp: 'datetime',
    time: 'time',
    duration: 'duration',
    boolean: 'boolean',
    choice: 'status',
    status: 'status',
    priority: 'priority',
    reference: 'reference',
    user: 'user',
    tags: 'tags',
    image: 'image',
    file: 'text',
    json: 'text',
    progress: 'progress',
    uuid: 'text',
    binary: 'text',
    array: 'text',
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
      const refCollection = prop.referenceCollection || prop.referenceCollectionId;

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
// SSRM FETCHER
// =============================================================================

/**
 * Build query string from SSRMRequest parameters
 */
function buildQueryString(request: SSRMRequest): string {
  const params = new URLSearchParams();

  // Pagination - convert block-based to page-based
  const page = Math.floor(request.startRow / (request.endRow - request.startRow)) + 1;
  const pageSize = request.endRow - request.startRow;
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  // Sorting
  if (request.sorting && request.sorting.length > 0) {
    const sortStr = request.sorting
      .map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`)
      .join(',');
    params.set('sort', sortStr);
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

  // Global search
  if (request.globalFilter) {
    params.set('search', request.globalFilter);
  }

  // Grouping
  if (request.grouping && request.grouping.length > 0) {
    params.set('groupBy', request.grouping.join(','));
  }

  return params.toString();
}

/**
 * Authenticated SSRM data fetcher
 */
async function authenticatedFetcher<TData extends GridRowData>(
  request: SSRMRequest
): Promise<SSRMResponse<TData>> {
  const queryString = buildQueryString(request);
  const url = `/api/data/collections/${request.collection}/data?${queryString}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Grid query failed: ${response.statusText}`);
  }

  const result = await response.json();

  // Transform collection data API response to SSRM response format
  const total = result.meta?.total ?? result.data?.length ?? 0;
  const hasMore = result.meta?.hasNext ?? false;

  return {
    rows: result.data as TData[],
    lastRow: hasMore ? -1 : total,
  };
}

/**
 * Authenticated count fetcher
 */
async function authenticatedCountFetcher(params: {
  collection: string;
  filters?: { id: string; value: unknown }[];
  grouping?: string[];
  globalFilter?: string;
}): Promise<number> {
  const queryParams = new URLSearchParams();
  // Request minimal data, we just need the count
  queryParams.set('page', '1');
  queryParams.set('pageSize', '1');

  // Apply filters
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

  // Apply global search
  if (params.globalFilter) {
    queryParams.set('search', params.globalFilter);
  }

  // Apply grouping
  if (params.grouping && params.grouping.length > 0) {
    queryParams.set('groupBy', params.grouping.join(','));
  }

  const url = `/api/data/collections/${params.collection}/data?${queryParams.toString()}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Grid count failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.meta?.total ?? 0;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ListView() {
  const { collectionCode: rawCode } = useParams<{ collectionCode: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract collection code (remove .list suffix if present)
  const collectionCode = rawCode?.replace(/\.list$/, '') ?? '';

  // State
  const [collection, setCollection] = useState<CollectionMetadata | null>(null);
  const [properties, setProperties] = useState<PropertyMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const currentViewId = searchParams.get('view') ?? undefined;
  // Initialize view mode from URL param 'mode', default to 'list'
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('mode') as ViewMode) || 'list'
  );

  // Board Data State
  const [boardData, setBoardData] = useState<Record<string, unknown>[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);

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

  // Load board data when entering board mode
  useEffect(() => {
    if (viewMode === 'board' && collectionCode) {
      loadBoardData();
    }
  }, [viewMode, collectionCode]);

  async function loadMetadata() {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch collection schema (includes properties)
      // Uses /data/collections to route to svc-data via Vite proxy
      const schemaResponse = await api.get<{
        collection: CollectionMetadata;
        properties: PropertyMetadata[];
      }>(`/data/collections/${collectionCode}/schema`);

      setCollection(schemaResponse.collection);
      setProperties(schemaResponse.properties);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load collection metadata';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadBoardData() {
    try {
      setBoardLoading(true);
      // Fetch all data for board view (simplified for now)
      // In a real implementation, we might want pagination or specific filtering
      const response = await api.get<{ data: Record<string, unknown>[] }>(
        `/data/collections/${collectionCode}/data?pageSize=100`
      );
      setBoardData(response.data);
    } catch (err) {
      console.error('Failed to load board data', err);
    } finally {
      setBoardLoading(false);
    }
  }

  // Create columns from properties
  const columns = useMemo(() => {
    if (properties.length === 0) return [];

    // Add actions column at the end
    const dataColumns = createColumnsFromProperties(properties);

    dataColumns.push({
      code: '_actions',
      label: '',
      type: 'actions',
      width: 60,
      sortable: false,
      filterable: false,
      groupable: false,
      resizable: false,
      pinned: 'right',
      actions: [
        {
          id: 'view',
          label: 'View',
          onClick: (row) => navigate(`/${collectionCode}/${row.id}`),
        },
        {
          id: 'edit',
          label: 'Edit',
          onClick: (row) => navigate(`/${collectionCode}/${row.id}?edit=true`),
        },
        {
          id: 'delete',
          label: 'Delete',
          variant: 'danger' as const,
          onClick: async (row) => {
            const label = collection ? getCollectionLabel(collection) : 'record';
            if (confirm(`Delete this ${label}?`)) {
              try {
                await api.delete(`/data/collections/${collectionCode}/data/${row.id}`);
                // Refresh will happen via grid refetch
              } catch (err) {
                console.error('Delete failed:', err);
              }
            }
          },
        },
      ],
    });

    return dataColumns;
  }, [properties, collectionCode, collection, navigate]);

  // Event handlers
  const handleRowClick = useCallback(
    (row: ListViewRecord) => {
      navigate(`/${collectionCode}/${row.id}`);
    },
    [collectionCode, navigate]
  );

  const handleRowDoubleClick = useCallback(
    (row: ListViewRecord) => {
      navigate(`/${collectionCode}/${row.id}?edit=true`);
    },
    [collectionCode, navigate]
  );

  const handleViewChange = useCallback(
    (viewId: string | null) => {
      if (viewId) {
        setSearchParams({ view: viewId });
      } else {
        setSearchParams({});
      }
    },
    [setSearchParams]
  );

  const handleSortChange = useCallback(
    (sorting: SortingState) => {
      if (sorting.length > 0) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('sort', `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}`);
        setSearchParams(newParams);
      }
    },
    [searchParams, setSearchParams]
  );

  const handleFilterChange = useCallback(
    (filters: ColumnFiltersState) => {
      const newParams = new URLSearchParams();

      // Preserve view param
      const view = searchParams.get('view');
      if (view) newParams.set('view', view);

      // Add filters to URL
      filters.forEach((filter) => {
        if (filter.value !== undefined && filter.value !== '') {
          newParams.set(`filter.${filter.id}`, String(filter.value));
        }
      });

      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--border-primary)' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>Loading {collectionCode}...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="p-6 rounded-lg text-center max-w-md"
          style={{
            backgroundColor: 'var(--bg-danger-subtle)',
            border: '1px solid var(--border-danger)'
          }}
        >
          <h2
            className="text-lg font-semibold mb-2"
            style={{ color: 'var(--text-danger)' }}
          >
            Failed to Load Collection
          </h2>
          <p className="mb-4" style={{ color: 'var(--text-danger)' }}>{error}</p>
          <button
            onClick={loadMetadata}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--bg-danger)',
              color: 'var(--text-on-primary)'
            }}
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
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Collection Not Found
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            The collection "{collectionCode}" does not exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base,#0a0a0f)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle,rgba(255,255,255,0.08))]">
        <div className="flex items-center gap-4">
          {/* Collection icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: collection.color || '#6366f1' }}
          >
            {collection.icon ? (
              <span className="material-icons text-xl">{collection.icon}</span>
            ) : (
              getCollectionLabel(collection).charAt(0).toUpperCase()
            )}
          </div>

          {/* Collection title */}
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary,#f3f4f6)]">
              {getCollectionLabelPlural(collection)}
            </h1>
            {collection.description && (
              <p className="text-sm text-[var(--text-tertiary,#6b7280)]">
                {collection.description}
              </p>
            )}
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div
            className="flex p-1 rounded-lg border"
            style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              borderColor: 'var(--border-default)'
            }}
          >
            <button
              onClick={() => handleModeChange('list')}
              className="p-2 rounded-md transition-all"
              style={{
                backgroundColor: viewMode === 'list' ? 'var(--bg-surface)' : 'transparent',
                color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
              title="List View"
            >
              <LayoutList size={18} />
            </button>
            <button
              onClick={() => handleModeChange('board')}
              className="p-2 rounded-md transition-all"
              style={{
                backgroundColor: viewMode === 'board' ? 'var(--bg-surface)' : 'transparent',
                color: viewMode === 'board' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'board' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
              title="Board View"
            >
              <KanbanSquare size={18} />
            </button>
          </div>

          <button
            onClick={() => navigate(`/${collectionCode}/new`)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-on-primary)'
            }}
          >
            New {getCollectionLabel(collection)}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4">
        {viewMode === 'list' ? (
          <HubbleDataGrid<ListViewRecord>
            collection={collectionCode}
            columns={columns}
            viewId={currentViewId}
            onViewChange={handleViewChange}
            enableSSRM={true}
            ssrmFetcher={authenticatedFetcher}
            ssrmCountFetcher={authenticatedCountFetcher}
            pageSize={100}
            blockSize={100}
            maxCacheBlocks={50}
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
            density="comfortable"
            showToolbar={true}
            showStatusBar={true}
            showAvaBar={true}
            emptyMessage={`No ${getCollectionLabelPlural(collection).toLowerCase()} found`}
            onRowClick={handleRowClick}
            onRowDoubleClick={handleRowDoubleClick}
            onSortChange={handleSortChange}
            onFilterChange={handleFilterChange}
            ariaLabel={`${getCollectionLabelPlural(collection)} list`}
            height="100%"
            className="rounded-2xl"
          />
        ) : (
          // Board View Wrapper
          <div className="h-full rounded-2xl bg-[var(--bg-base,#0a0a0f)] overflow-hidden">
             {/* Note: passing simplified properties to BoardView */}
             <BoardView 
               data={boardData}
               properties={properties.map(p => ({
                   id: p.id,
                   code: p.code,
                   label: p.label || p.name || p.code,
                   dataType: p.dataType || p.propertyType || 'string',
                   description: p.description,
                   // Map choice list if present (BoardView uses it for grouping)
                   choiceList: p.choiceList,
               }) as any)} 
               loading={boardLoading}
               collectionCode={collectionCode}
             />
          </div>
        )}
      </div>
    </div>
  );
}

export default ListView;
