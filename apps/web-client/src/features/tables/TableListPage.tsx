import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Plus,
  Grid3X3,
  List,
  ArrowUpDown,
  Table2,
  Globe,
  Building2,
  ChevronRight,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { createApiClient } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, NoResultsState } from '../../components/ui/EmptyState';

interface TableListItem {
  tableName: string;
  label: string;
  category: string;
  isSystem: boolean;
  isHidden: boolean;
  columnCount: number;
  description?: string;
  icon?: string;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'tableName' | 'category';
type SortOrder = 'asc' | 'desc';

const categoryColors: Record<string, { bg: string; text: string }> = {
  application: { bg: 'var(--hw-primary-subtle, rgba(14, 165, 233, 0.1))', text: 'var(--hw-primary, #0ea5e9)' },
  system: { bg: 'var(--hw-bg-subtle)', text: 'var(--hw-text-muted)' },
  workflow: { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7' },
  security: { bg: 'rgba(234, 179, 8, 0.1)', text: '#eab308' },
  notification: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' },
  event: { bg: 'rgba(99, 102, 241, 0.1)', text: '#6366f1' },
  audit: { bg: 'rgba(244, 63, 94, 0.1)', text: '#f43f5e' },
  identity: { bg: 'rgba(20, 184, 166, 0.1)', text: '#14b8a6' },
};

const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const metadataApi = createApiClient(METADATA_API_URL);

export const TableListPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<TableListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const loadTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await metadataApi.get('/studio/tables');
      const list: TableListItem[] = res.data.items ?? res.data ?? [];
      setItems(list);
    } catch (err: any) {
      console.error('Failed to load tables:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTables();
  }, []);

  const filteredAndSorted = useMemo(() => {
    let result = [...items];

    // Apply search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.tableName.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false)
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'system') {
        result = result.filter((t) => t.isSystem);
      } else {
        result = result.filter((t) => t.category === categoryFilter);
      }
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.label.localeCompare(b.label);
          break;
        case 'tableName':
          comparison = a.tableName.localeCompare(b.tableName);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [items, search, categoryFilter, sortBy, sortOrder]);

  const handleCreateTable = () => {
    navigate('/studio/tables/new');
  };

  const toggleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const stats = useMemo(() => {
    return {
      total: items.length,
      application: items.filter((t) => t.category === 'application' && !t.isSystem).length,
      system: items.filter((t) => t.isSystem).length,
    };
  }, [items]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-32 rounded bg-slate-200 animate-pulse" />
            <div className="h-4 w-64 rounded bg-slate-100 animate-pulse mt-2" />
          </div>
          <div className="h-9 w-28 rounded bg-slate-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card variant="default" padding="lg" className="border-red-200 bg-red-50/50">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-red-100">
              <Database className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-red-900">Failed to load tables</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadTables}
                leftIcon={<RefreshCw className="h-4 w-4" />}
                className="mt-4"
              >
                Try again
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--hw-text)' }}>
            Tables
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
            Manage your data models, fields, and access control
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleCreateTable}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          New Table
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="default" padding="md" className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCategoryFilter('all')}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--hw-primary-subtle)' }}>
              <Database className="h-5 w-5" style={{ color: 'var(--hw-primary)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--hw-text)' }}>{stats.total}</p>
              <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>Total Tables</p>
            </div>
          </div>
        </Card>
        <Card variant="default" padding="md" className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCategoryFilter('application')}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--hw-success-subtle, rgba(34, 197, 94, 0.1))' }}>
              <Building2 className="h-5 w-5" style={{ color: 'var(--hw-success, #22c55e)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--hw-text)' }}>{stats.application}</p>
              <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>Application Tables</p>
            </div>
          </div>
        </Card>
        <Card variant="default" padding="md" className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCategoryFilter('system')}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--hw-warning-subtle, rgba(234, 179, 8, 0.1))' }}>
              <Globe className="h-5 w-5" style={{ color: 'var(--hw-warning, #eab308)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--hw-text)' }}>{stats.system}</p>
              <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>System Tables</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search tables by name, code, or database table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              showSearch
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center rounded-lg p-1" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-white/50'
              }`}
              style={{ color: categoryFilter === 'all' ? 'var(--hw-text)' : 'var(--hw-text-muted)' }}
            >
              All
            </button>
            <button
              onClick={() => setCategoryFilter('application')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                categoryFilter === 'application'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-white/50'
              }`}
              style={{ color: categoryFilter === 'application' ? 'var(--hw-text)' : 'var(--hw-text-muted)' }}
            >
              Application
            </button>
            <button
              onClick={() => setCategoryFilter('system')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                categoryFilter === 'system'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-white/50'
              }`}
              style={{ color: categoryFilter === 'system' ? 'var(--hw-text)' : 'var(--hw-text-muted)' }}
            >
              System
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSort(sortBy)}
            leftIcon={<ArrowUpDown className="h-4 w-4" />}
          >
            Sort by {sortBy}
          </Button>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg p-1" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
              }`}
              title="Grid view"
            >
              <Grid3X3 className="h-4 w-4" style={{ color: viewMode === 'grid' ? 'var(--hw-text)' : 'var(--hw-text-muted)' }} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
              }`}
              title="List view"
            >
              <List className="h-4 w-4" style={{ color: viewMode === 'list' ? 'var(--hw-text)' : 'var(--hw-text-muted)' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No tables yet"
          description="Tables define the structure of your data. Create your first table to start building your application."
          actionLabel="Create Table"
          onAction={handleCreateTable}
          variant="create"
        />
      ) : filteredAndSorted.length === 0 ? (
        <NoResultsState
          query={search}
          onClear={() => {
            setSearch('');
            setCategoryFilter('all');
          }}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSorted.map((table) => (
            <TableCard key={table.tableName} table={table} />
          ))}
        </div>
      ) : (
        <Card variant="default" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold cursor-pointer hover:bg-black/5 transition-colors"
                    style={{ color: 'var(--hw-text-muted)' }}
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortBy === 'name' && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold cursor-pointer hover:bg-black/5 transition-colors"
                    style={{ color: 'var(--hw-text-muted)' }}
                    onClick={() => toggleSort('tableName')}
                  >
                    <div className="flex items-center gap-1">
                      Table Name
                      {sortBy === 'tableName' && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--hw-text-muted)' }}>
                    Columns
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold cursor-pointer hover:bg-black/5 transition-colors"
                    style={{ color: 'var(--hw-text-muted)' }}
                    onClick={() => toggleSort('category')}
                  >
                    <div className="flex items-center gap-1">
                      Category
                      {sortBy === 'category' && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--hw-text-muted)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((table, index) => (
                  <tr
                    key={table.tableName}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    style={{ borderTop: index > 0 ? '1px solid var(--hw-border-subtle)' : undefined }}
                    onClick={() => navigate(`/studio/tables/${table.tableName}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
                          <Table2 className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                        </div>
                        <span className="font-medium text-sm" style={{ color: 'var(--hw-text)' }}>
                          {table.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--hw-bg-subtle)', color: 'var(--hw-text-secondary)' }}>
                        {table.tableName}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                        {table.columnCount} columns
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={table.isSystem ? 'warning' : 'success'}
                        size="sm"
                        style={categoryColors[table.category] ? {
                          backgroundColor: categoryColors[table.category].bg,
                          color: categoryColors[table.category].text,
                        } : undefined}
                      >
                        {table.category.charAt(0).toUpperCase() + table.category.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/studio/tables/${table.tableName}`);
                        }}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// Table Card Component for Grid View
const TableCard: React.FC<{ table: TableListItem }> = ({ table }) => {
  const navigate = useNavigate();
  const colors = categoryColors[table.category] || categoryColors.application;

  return (
    <Card
      variant="interactive"
      padding="none"
      className="group cursor-pointer overflow-hidden"
      onClick={() => navigate(`/studio/tables/${table.tableName}`)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
            <Table2 className="h-5 w-5" style={{ color: 'var(--hw-primary)' }} />
          </div>
          <Badge
            variant={table.isSystem ? 'warning' : 'success'}
            size="sm"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {table.category.charAt(0).toUpperCase() + table.category.slice(1)}
          </Badge>
        </div>

        <div className="mt-3">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--hw-text)' }}>
            {table.label}
          </h3>
          <code
            className="text-xs mt-1 block truncate"
            style={{ color: 'var(--hw-text-muted)' }}
          >
            {table.tableName}
          </code>
        </div>

        <div
          className="mt-3 pt-3 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--hw-border-subtle)' }}
        >
          <span className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
            {table.columnCount} columns
          </span>
          <ChevronRight
            className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
            style={{ color: 'var(--hw-text-muted)' }}
          />
        </div>
      </div>
    </Card>
  );
};

export default TableListPage;
