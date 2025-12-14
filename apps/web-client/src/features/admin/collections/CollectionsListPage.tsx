import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Database,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Layers,
  Settings,
  Copy,
  Trash2,
  Eye,
  FolderOpen,
  Lock,
} from 'lucide-react';
import { NoDataState, NoResultsState } from '../../../components/ui/EmptyState';

interface Collection {
  id: string;
  code: string;
  label: string;
  labelPlural?: string;
  description?: string;
  icon?: string;
  color?: string;
  storageTable: string;
  isSystem: boolean;
  isExtensible: boolean;
  isAudited: boolean;
  isVersioned: boolean;
  moduleId?: string;
  category?: string;
  tags: string[];
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const CollectionsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [includeSystem, setIncludeSystem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Fetch collections
  const fetchCollections = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (includeSystem) params.set('includeSystem', 'true');

      const response = await fetch(`/api/collections?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/collections/categories', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  useEffect(() => {
    fetchCollections();
    fetchCategories();
  }, [searchQuery, categoryFilter, includeSystem]);

  // Handle collection actions
  const handleAction = async (collectionId: string, action: string) => {
    setActionMenuOpen(null);
    try {
      switch (action) {
        case 'delete': {
          if (!window.confirm('Are you sure you want to delete this collection?')) return;
          const response = await fetch(`/api/collections/${collectionId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (response.ok) fetchCollections();
          break;
        }
        case 'publish': {
          const response = await fetch(`/api/collections/${collectionId}/publish`, {
            method: 'POST',
            credentials: 'include',
          });
          if (response.ok) fetchCollections();
          break;
        }
        case 'clone': {
          const newCode = window.prompt('Enter a code for the new collection:');
          if (!newCode) return;
          const newLabel = window.prompt('Enter a label for the new collection:');
          if (!newLabel) return;
          const response = await fetch(`/api/collections/${collectionId}/clone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code: newCode, label: newLabel }),
          });
          if (response.ok) {
            const newCollection = await response.json();
            navigate(`/studio/collections/${newCollection.id}`);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to ${action} collection:`, error);
    }
  };

  // Group collections by category
  const groupedCollections = collections.reduce((acc, coll) => {
    const category = coll.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(coll);
    return acc;
  }, {} as Record<string, Collection[]>);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Collections
          </h1>
          <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
            Define data structures for your platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCollections()}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/studio/collections/new')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Collection
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Database className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {collections.length}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Total Collections</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Eye className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {collections.filter(c => c.publishedAt).length}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Published</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {categories.length}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Categories</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Lock className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {collections.filter(c => c.isSystem).length}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">System</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, code, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              checked={includeSystem}
              onChange={(e) => setIncludeSystem(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">Show System</span>
          </label>
        </div>
      </div>

      {/* Collections Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : collections.length === 0 ? (
        searchQuery || categoryFilter !== 'all' ? (
          <NoResultsState
            query={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setCategoryFilter('all');
            }}
          />
        ) : (
          <NoDataState
            itemName="collections"
            onCreate={() => navigate('/studio/collections/new')}
          />
        )
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedCollections).map(([category, categoryCollections]) => (
            <div key={category}>
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                {category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryCollections.map((collection) => (
                  <div
                    key={collection.id}
                    className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer"
                    onClick={() => navigate(`/studio/collections/${collection.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center"
                          style={{
                            backgroundColor: collection.color
                              ? `${collection.color}20`
                              : 'var(--hw-bg-subtle)',
                          }}
                        >
                          <Layers
                            className="h-5 w-5"
                            style={{
                              color: collection.color || 'var(--hw-text-muted)',
                            }}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            {collection.label}
                            {collection.isSystem && (
                              <Lock className="h-3.5 w-3.5 text-slate-400" />
                            )}
                          </h3>
                          <code className="text-xs text-slate-500 dark:text-slate-400">
                            {collection.code}
                          </code>
                        </div>
                      </div>

                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuOpen(actionMenuOpen === collection.id ? null : collection.id);
                          }}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all"
                        >
                          <MoreHorizontal className="h-4 w-4 text-slate-500" />
                        </button>

                        {actionMenuOpen === collection.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="py-1">
                              <button
                                onClick={() => navigate(`/studio/collections/${collection.id}`)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Settings className="h-4 w-4" />
                                Edit Collection
                              </button>
                              <button
                                onClick={() => navigate(`/studio/collections/${collection.id}/properties`)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Layers className="h-4 w-4" />
                                Manage Properties
                              </button>
                              <button
                                onClick={() => handleAction(collection.id, 'clone')}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Copy className="h-4 w-4" />
                                Clone Collection
                              </button>
                              {!collection.publishedAt && (
                                <button
                                  onClick={() => handleAction(collection.id, 'publish')}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                                >
                                  <Eye className="h-4 w-4" />
                                  Publish
                                </button>
                              )}
                              {!collection.isSystem && (
                                <>
                                  <hr className="my-1 border-slate-200 dark:border-slate-700" />
                                  <button
                                    onClick={() => handleAction(collection.id, 'delete')}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {collection.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                        {collection.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {collection.isAudited && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          Audited
                        </span>
                      )}
                      {collection.isVersioned && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                          Versioned
                        </span>
                      )}
                      {collection.publishedAt && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Published
                        </span>
                      )}
                      {collection.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionsListPage;
