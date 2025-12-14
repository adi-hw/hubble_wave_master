import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LayoutList,
  Plus,
  MoreHorizontal,
  Table,
  Kanban,
  Calendar,
  GanttChart,
  LayoutGrid,
  GitBranch,
  Star,
  Trash2,
  Eye,
  User,
  Users,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface ViewDefinition {
  id: string;
  collectionId: string;
  code: string;
  label: string;
  description?: string;
  viewType: 'list' | 'board' | 'calendar' | 'timeline' | 'card' | 'hierarchy';
  isDefault: boolean;
  isSystem: boolean;
  isPersonal: boolean;
  ownerId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CollectionDefinition {
  id: string;
  code: string;
  label: string;
  icon?: string;
  color?: string;
}

const viewTypeConfig = {
  list: { icon: Table, label: 'List', color: 'text-blue-500' },
  board: { icon: Kanban, label: 'Board', color: 'text-purple-500' },
  calendar: { icon: Calendar, label: 'Calendar', color: 'text-green-500' },
  timeline: { icon: GanttChart, label: 'Timeline', color: 'text-orange-500' },
  card: { icon: LayoutGrid, label: 'Card', color: 'text-pink-500' },
  hierarchy: { icon: GitBranch, label: 'Hierarchy', color: 'text-cyan-500' },
};

export function ViewsListPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [views, setViews] = useState<ViewDefinition[]>([]);
  const [collection, setCollection] = useState<CollectionDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'shared' | 'personal'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (collectionId) {
      loadData();
    }
  }, [collectionId]);

  async function loadData() {
    try {
      setLoading(true);
      const [viewsRes, collectionRes] = await Promise.all([
        api.get<ViewDefinition[]>(`/metadata/views/collection/${collectionId}`),
        api.get<CollectionDefinition>(`/metadata/collections/${collectionId}`),
      ]);
      setViews(viewsRes);
      setCollection(collectionRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load views');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(viewId: string) {
    if (!confirm('Are you sure you want to delete this view?')) return;
    try {
      await api.delete(`/metadata/views/${viewId}`);
      setViews(views.filter((v) => v.id !== viewId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete view');
    }
  }

  async function handleSetDefault(viewId: string) {
    try {
      await api.put(`/metadata/views/${viewId}`, { isDefault: true });
      setViews(
        views.map((v) => ({
          ...v,
          isDefault: v.id === viewId ? true : v.viewType === views.find((x) => x.id === viewId)?.viewType ? false : v.isDefault,
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    }
  }

  const filteredViews = views.filter((v) => {
    if (filter === 'shared' && v.isPersonal) return false;
    if (filter === 'personal' && !v.isPersonal) return false;
    if (typeFilter !== 'all' && v.viewType !== typeFilter) return false;
    return true;
  });

  const groupedViews = filteredViews.reduce(
    (acc, view) => {
      const type = view.viewType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(view);
      return acc;
    },
    {} as Record<string, ViewDefinition[]>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: collection?.color || '#4F46E5' }}
          >
            <LayoutList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Views for {collection?.label}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure how data is displayed and organized
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/admin/collections/${collectionId}/views/new`)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New View
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['all', 'shared', 'personal'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === f
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'shared' ? 'Shared' : 'Personal'}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <option value="all">All Types</option>
          {Object.entries(viewTypeConfig).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>

        <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {filteredViews.length} view{filteredViews.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Views by Type */}
      {Object.entries(groupedViews).length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <LayoutList className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No views found</p>
          <button
            onClick={() => navigate(`/admin/collections/${collectionId}/views/new`)}
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Create your first view
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(viewTypeConfig).map(([type, config]) => {
            const typeViews = groupedViews[type];
            if (!typeViews?.length) return null;

            const Icon = config.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-5 h-5 ${config.color}`} />
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    {config.label} Views
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({typeViews.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {typeViews.map((view) => (
                    <ViewCard
                      key={view.id}
                      view={view}
                      config={config}
                      menuOpen={menuOpenId === view.id}
                      onMenuToggle={() => setMenuOpenId(menuOpenId === view.id ? null : view.id)}
                      onEdit={() => navigate(`/admin/collections/${collectionId}/views/${view.id}`)}
                      onDelete={() => handleDelete(view.id)}
                      onSetDefault={() => handleSetDefault(view.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ViewCardProps {
  view: ViewDefinition;
  config: { icon: any; label: string; color: string };
  menuOpen: boolean;
  onMenuToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

function ViewCard({
  view,
  config,
  menuOpen,
  onMenuToggle,
  onEdit,
  onDelete,
  onSetDefault,
}: ViewCardProps) {
  const Icon = config.icon;

  return (
    <div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors cursor-pointer group"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 ${config.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900 dark:text-white">{view.label}</h3>
              {view.isDefault && (
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{view.code}</p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle();
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Edit View
              </button>
              {!view.isDefault && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDefault();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Star className="w-4 h-4" />
                  Set as Default
                </button>
              )}
              {!view.isSystem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {view.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {view.description}
        </p>
      )}

      <div className="flex items-center gap-2 text-xs">
        {view.isSystem && (
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            System
          </span>
        )}
        {view.isPersonal ? (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
            <User className="w-3 h-3" />
            Personal
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
            <Users className="w-3 h-3" />
            Shared
          </span>
        )}
      </div>
    </div>
  );
}
