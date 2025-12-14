import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Table as TableIcon,
  Kanban,
  Calendar,
  GanttChart,
  LayoutGrid,
} from 'lucide-react';
import { DataGrid, ColumnDef, PaginationState, SortState } from '../../components/data';
import { api } from '../../lib/api';

interface CollectionDefinition {
  id: string;
  code: string;
  label: string;
  labelPlural: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface PropertyDefinition {
  id: string;
  code: string;
  label: string;
  propertyType: string;
  isRequired: boolean;
  choiceList?: { value: string; label: string }[];
  referenceConfig?: {
    targetCollection: string;
    displayProperty: string;
  };
}

interface ViewDefinition {
  id: string;
  code: string;
  label: string;
  viewType: 'list' | 'board' | 'calendar' | 'timeline' | 'card';
  isDefault: boolean;
}

interface QueryResult {
  data: Record<string, unknown>[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  fields: PropertyDefinition[];
  view?: ViewDefinition;
}

const viewTypeIcons = {
  list: TableIcon,
  board: Kanban,
  calendar: Calendar,
  timeline: GanttChart,
  card: LayoutGrid,
};

export function CollectionListPage() {
  const { collectionCode } = useParams<{ collectionCode: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [collection, setCollection] = useState<CollectionDefinition | null>(null);
  const [properties, setProperties] = useState<PropertyDefinition[]>([]);
  const [views, setViews] = useState<ViewDefinition[]>([]);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Query state
  const [pagination, setPagination] = useState<PaginationState>({
    page: parseInt(searchParams.get('page') || '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
    total: 0,
  });
  const [sort, setSort] = useState<SortState[]>(() => {
    const sortParam = searchParams.get('sort');
    if (sortParam) {
      const [column, direction] = sortParam.split(':');
      return [{ column, direction: direction as 'asc' | 'desc' }];
    }
    return [];
  });
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [currentViewId, setCurrentViewId] = useState<string | null>(searchParams.get('viewId'));

  // Load schema
  useEffect(() => {
    if (collectionCode) {
      loadSchema();
    }
  }, [collectionCode]);

  // Load data when query params change
  useEffect(() => {
    if (collection) {
      loadData();
    }
  }, [collection, pagination.page, pagination.pageSize, sort, search, currentViewId]);

  async function loadSchema() {
    try {
      setLoading(true);
      const [schemaRes, viewsRes] = await Promise.all([
        api.get<{ collection: CollectionDefinition; properties: PropertyDefinition[] }>(`/data/collections/${collectionCode}/schema`),
        api.get<ViewDefinition[]>(`/metadata/views/collection/${collectionCode}`).catch(() => [] as ViewDefinition[]),
      ]);

      setCollection(schemaRes.collection);
      setProperties(schemaRes.properties);
      setViews(viewsRes || []);

      // Set default view if none selected
      if (!currentViewId && viewsRes?.length > 0) {
        const defaultView = viewsRes.find((v: ViewDefinition) => v.isDefault) || viewsRes[0];
        if (defaultView) {
          setCurrentViewId(defaultView.id);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load collection schema';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));

      if (sort.length > 0) {
        params.set('sort', JSON.stringify(sort.map((s) => ({ field: s.column, direction: s.direction }))));
      }

      if (search) {
        params.set('search', search);
      }

      if (currentViewId) {
        params.set('viewId', currentViewId);
      }

      const res = await api.get<QueryResult>(`/data/collections/${collectionCode}/data?${params}`);

      setData(res.data);
      setPagination((prev) => ({
        ...prev,
        total: res.meta.total,
      }));

      // Update URL
      setSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
        ...(sort.length > 0 && { sort: `${sort[0].column}:${sort[0].direction}` }),
        ...(search && { search }),
        ...(currentViewId && { viewId: currentViewId }),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = useCallback(() => {
    loadData();
  }, []);

  const handleRowClick = useCallback(
    (row: Record<string, unknown>) => {
      navigate(`/data/${collectionCode}/${row.id}`);
    },
    [collectionCode, navigate]
  );

  const handleCreate = useCallback(() => {
    navigate(`/data/${collectionCode}/new`);
  }, [collectionCode, navigate]);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedRows.length) return;
    if (!confirm(`Delete ${selectedRows.length} record(s)?`)) return;

    try {
      await api.post(`/data/collections/${collectionCode}/data/bulk-delete`, { ids: selectedRows });
      setSelectedRows([]);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete records');
    }
  }, [collectionCode, selectedRows]);

  // Build columns from properties
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return properties.slice(0, 8).map((prop) => ({
      id: prop.code,
      header: prop.label,
      accessor: prop.code,
      sortable: true,
      filterable: true,
      formatter: (value: unknown) => {
        if (value === null || value === undefined) return '';

        switch (prop.propertyType) {
          case 'boolean':
            return value ? 'Yes' : 'No';
          case 'date':
            return new Date(String(value)).toLocaleDateString();
          case 'datetime':
            return new Date(String(value)).toLocaleString();
          case 'choice':
            const choice = prop.choiceList?.find((c) => c.value === value);
            return choice?.label || String(value);
          case 'currency':
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
              Number(value)
            );
          case 'percent':
            return `${Number(value).toFixed(1)}%`;
          default:
            return String(value);
        }
      },
    }));
  }, [properties]);

  if (loading && !collection) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error && !collection) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: collection?.color || '#4F46E5' }}
          >
            <TableIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {collection?.labelPlural || collection?.label}
            </h1>
            {collection?.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{collection.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Selector */}
          {views.length > 0 && (
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {views.slice(0, 4).map((view) => {
                const Icon = viewTypeIcons[view.viewType] || TableIcon;
                return (
                  <button
                    key={view.id}
                    onClick={() => setCurrentViewId(view.id)}
                    title={view.label}
                    className={`p-2 rounded-md transition-colors ${
                      currentViewId === view.id
                        ? 'bg-white dark:bg-gray-700 shadow-sm'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New {collection?.label}
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-hidden">
        <DataGrid
          data={data}
          columns={columns}
          loading={loading}
          pagination={pagination}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          onPageSizeChange={(pageSize) => setPagination((prev) => ({ ...prev, pageSize, page: 1 }))}
          sort={sort}
          onSortChange={setSort}
          selectable
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
          rowKey="id"
          onRowClick={handleRowClick}
          onRowDoubleClick={handleRowClick}
          searchable
          searchPlaceholder={`Search ${collection?.labelPlural?.toLowerCase() || 'records'}...`}
          onSearch={setSearch}
          onRefresh={handleRefresh}
          bulkActions={
            selectedRows.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )
          }
          rowActions={(row) => (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate(`/data/${collectionCode}/${row.id}`)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Edit"
              >
                <Edit2 className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
