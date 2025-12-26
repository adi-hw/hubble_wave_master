import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Database,
  Plus,
  RefreshCw,
  Lock,
  Building2,
  Pencil,
  LayoutGrid,
  List,
  Layers,
  ChevronDown,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import { NoDataState, NoResultsState } from '../../../components/ui/EmptyState';
import metadataApi from '../../../services/metadataApi';
import { CollectionCard } from './components/CollectionCard';

import { Collection, OwnerType, ViewMode, normalizeCollection } from './types';

export const CollectionsListPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedOwnerTypes, setSelectedOwnerTypes] = useState<OwnerType[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Toggle owner type selection (multi-select)
  const toggleOwnerType = (type: OwnerType) => {
    setSelectedOwnerTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Fetch collections
  const fetchCollections = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      // Always include system collections for complete stats
      params.set('includeSystem', 'true');
      // Request enough collections to show all (avoid pagination limiting stats)
      params.set('limit', '500');

      const response = await metadataApi.get<Collection[] | { data: Collection[] }>(
        `/collections?${params.toString()}`
      );
      // Handle both array response and wrapped { data: [...] } response
      const rawData = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
      // Normalize collection data to handle field name differences
      const normalized = rawData.map((c: Partial<Collection>) => normalizeCollection(c));
      setCollections(normalized);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await metadataApi.get<string[] | { data: string[] }>('/collections/categories');
      // Handle both array response and wrapped { data: [...] } response
      const data = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
    }
  };

  useEffect(() => {
    fetchCollections();
    fetchCategories();
  }, [searchQuery]);

  // Filter by owner types and categories (client-side filtering)
  const filteredCollections = useMemo(() => {
    return collections.filter((c) => {
      // Filter by owner types (multi-select)
      if (selectedOwnerTypes.length > 0) {
        const type = c.ownerType || (c.isSystem ? 'system' : 'custom');
        if (!selectedOwnerTypes.includes(type)) return false;
      }
      // Filter by selected categories
      if (selectedCategories.length > 0) {
        const collCategory = c.category || 'Uncategorized';
        if (!selectedCategories.includes(collCategory)) return false;
      }
      return true;
    });
  }, [collections, selectedOwnerTypes, selectedCategories]);

  // Compute stats from full collection list (before owner type filter)
  const stats = useMemo(() => {
    const systemCount = collections.filter(
      (c) => c.ownerType === 'system' || c.isSystem
    ).length;
    const platformCount = collections.filter((c) => c.ownerType === 'platform').length;
    const customCount = collections.filter(
      (c) => c.ownerType === 'custom' || (!c.ownerType && !c.isSystem)
    ).length;

    return {
      total: collections.length,
      system: systemCount,
      platform: platformCount,
      custom: customCount,
    };
  }, [collections]);

  // Handle collection actions
  const handleAction = async (collectionId: string, action: string) => {
    try {
      switch (action) {
        case 'delete': {
          if (!window.confirm('Are you sure you want to delete this collection?')) return;
          await metadataApi.delete(`/collections/${collectionId}`);
          fetchCollections();
          break;
        }
        case 'publish': {
          await metadataApi.post(`/collections/${collectionId}/publish`);
          fetchCollections();
          break;
        }
        case 'clone': {
          const newCode = window.prompt('Enter a code for the new collection:');
          if (!newCode) return;
          const newLabel = window.prompt('Enter a label for the new collection:');
          if (!newLabel) return;
          const response = await metadataApi.post<Collection>(
            `/collections/${collectionId}/clone`,
            { code: newCode, label: newLabel }
          );
          navigate(`/studio/collections/${response.data.id}`);
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to ${action} collection:`, error);
    }
  };

  // Toggle category collapse
  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Group collections by category
  const groupedCollections = useMemo(() => {
    return filteredCollections.reduce(
      (acc, coll) => {
        const category = coll.category || 'Uncategorized';
        if (!acc[category]) acc[category] = [];
        acc[category].push(coll);
        return acc;
      },
      {} as Record<string, Collection[]>
    );
  }, [filteredCollections]);

  // Sort categories with Uncategorized at the end
  const sortedCategories = useMemo(() => {
    const cats = Object.keys(groupedCollections);
    return cats.sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
  }, [groupedCollections]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Collections
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage collections and their properties
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCollections()}
            className="btn-secondary flex items-center gap-2 px-3 py-2"
            title="Refresh collections"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/studio/collections/new')}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            New Collection
          </button>
        </div>
      </div>

      {/* Stats - Multi-select filter boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Total - clears all type filters */}
        <div
          className={`rounded-xl border p-3 cursor-pointer transition-colors hover:border-[var(--border-hover)] ${
            selectedOwnerTypes.length === 0 ? 'ring-2 ring-[var(--border-focus)]' : ''
          }`}
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
          onClick={() => setSelectedOwnerTypes([])}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-primary-subtle)' }}
            >
              <Database className="h-4 w-4" style={{ color: 'var(--text-brand)' }} />
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {stats.total}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Total
              </div>
            </div>
          </div>
        </div>

        {/* System */}
        <div
          className={`rounded-xl border p-3 cursor-pointer transition-colors hover:border-[var(--border-hover)] ${
            selectedOwnerTypes.includes('system') ? 'ring-2 ring-[var(--border-focus)]' : ''
          }`}
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
          onClick={() => toggleOwnerType('system')}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-error-subtle)' }}
            >
              <Lock className="h-4 w-4" style={{ color: 'var(--text-error)' }} />
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {stats.system}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                System
              </div>
            </div>
          </div>
        </div>

        {/* Platform */}
        <div
          className={`rounded-xl border p-3 cursor-pointer transition-colors hover:border-[var(--border-hover)] ${
            selectedOwnerTypes.includes('platform') ? 'ring-2 ring-[var(--border-focus)]' : ''
          }`}
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
          onClick={() => toggleOwnerType('platform')}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-warning-subtle)' }}
            >
              <Building2 className="h-4 w-4" style={{ color: 'var(--text-warning)' }} />
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {stats.platform}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Platform
              </div>
            </div>
          </div>
        </div>

        {/* Custom */}
        <div
          className={`rounded-xl border p-3 cursor-pointer transition-colors hover:border-[var(--border-hover)] ${
            selectedOwnerTypes.includes('custom') ? 'ring-2 ring-[var(--border-focus)]' : ''
          }`}
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
          onClick={() => toggleOwnerType('custom')}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-success-subtle)' }}
            >
              <Pencil className="h-4 w-4" style={{ color: 'var(--text-success)' }} />
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {stats.custom}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Custom
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search by name, code, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full pl-10 pr-4 py-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />

          {/* Category multi-select filter */}
          <div className="relative">
            <button
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="input px-3 py-2 flex items-center gap-2 min-w-[160px]"
              style={{ textAlign: 'left' }}
            >
              <span className="flex-1 truncate">
                {selectedCategories.length === 0
                  ? 'All Categories'
                  : selectedCategories.length === 1
                    ? selectedCategories[0]
                    : `${selectedCategories.length} categories`}
              </span>
              <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            </button>
            {categoryDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setCategoryDropdownOpen(false)}
                />
                <div
                  className="absolute top-full left-0 mt-1 w-56 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
                >
                  <div className="p-2">
                    {selectedCategories.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedCategories([]);
                          setCategoryDropdownOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm rounded hover:bg-[var(--bg-hover)] flex items-center gap-2"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <X className="h-3 w-3" />
                        Clear selection
                      </button>
                    )}
                    {categories.map((cat) => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedCategories((prev) =>
                              isSelected ? prev.filter((c) => c !== cat) : [...prev, cat]
                            );
                          }}
                          className="w-full px-3 py-2 text-left text-sm rounded hover:bg-[var(--bg-hover)] flex items-center gap-2"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          <div
                            className="h-4 w-4 rounded border flex items-center justify-center"
                            style={{
                              borderColor: isSelected ? 'var(--text-brand)' : 'var(--border-default)',
                              backgroundColor: isSelected ? 'var(--bg-primary-subtle)' : 'transparent',
                            }}
                          >
                            {isSelected && <Check className="h-3 w-3" style={{ color: 'var(--text-brand)' }} />}
                          </div>
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg border transition-colors ${viewMode === 'grid' ? 'border-[var(--border-focus)]' : 'border-transparent hover:bg-[var(--bg-hover)]'}`}
              style={{
                color: viewMode === 'grid' ? 'var(--text-brand)' : 'var(--text-secondary)',
                backgroundColor: viewMode === 'grid' ? 'var(--bg-primary-subtle)' : 'transparent'
              }}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg border transition-colors ${viewMode === 'table' ? 'border-[var(--border-focus)]' : 'border-transparent hover:bg-[var(--bg-hover)]'}`}
              style={{
                color: viewMode === 'table' ? 'var(--text-brand)' : 'var(--text-secondary)',
                backgroundColor: viewMode === 'table' ? 'var(--bg-primary-subtle)' : 'transparent'
              }}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Active filter indicator */}
      {(selectedOwnerTypes.length > 0 || selectedCategories.length > 0) && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Filtering by:
          </span>
          {selectedOwnerTypes.map((type) => {
            const typeColors: Record<OwnerType, { bg: string; text: string }> = {
              system: { bg: 'var(--bg-error-subtle)', text: 'var(--text-error)' },
              platform: { bg: 'var(--bg-warning-subtle)', text: 'var(--text-warning)' },
              custom: { bg: 'var(--bg-success-subtle)', text: 'var(--text-success)' },
            };
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer"
                style={{ backgroundColor: typeColors[type].bg, color: typeColors[type].text }}
                onClick={() => toggleOwnerType(type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
                <X className="h-3 w-3 ml-1" />
              </span>
            );
          })}
          {selectedCategories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer"
              style={{ backgroundColor: 'var(--bg-surface-secondary)', color: 'var(--text-primary)' }}
              onClick={() => setSelectedCategories((prev) => prev.filter((c) => c !== cat))}
            >
              {cat}
              <X className="h-3 w-3 ml-1" />
            </span>
          ))}
        </div>
      )}

      {/* Collections Display */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filteredCollections.length === 0 ? (
        searchQuery || selectedCategories.length > 0 || selectedOwnerTypes.length > 0 ? (
          <NoResultsState
            query={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setSelectedCategories([]);
              setSelectedOwnerTypes([]);
            }}
          />
        ) : (
          <NoDataState itemName="collections" onCreate={() => navigate('/studio/collections/new')} />
        )
      ) : viewMode === 'grid' ? (
        // Grid View
        <div className="space-y-6">
          {sortedCategories.map((category) => {
            const categoryCollections = groupedCollections[category];
            const isCollapsed = collapsedCategories.has(category);

            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 mb-4 group"
                >
                  {isCollapsed ? (
                    <ChevronRight
                      className="h-4 w-4 transition-transform"
                      style={{ color: 'var(--text-tertiary)' }}
                    />
                  ) : (
                    <ChevronDown
                      className="h-4 w-4 transition-transform"
                      style={{ color: 'var(--text-tertiary)' }}
                    />
                  )}
                  <h2
                    className="text-sm font-medium uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {category}
                  </h2>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--bg-surface-secondary)', color: 'var(--text-muted)' }}
                  >
                    {categoryCollections.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryCollections.map((collection) => (
                      <CollectionCard key={collection.id} collection={collection} onAction={handleAction} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Table View
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-secondary)' }}>
                <th
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Collection
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Type
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Category
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Table
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Records
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Properties
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Features
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCollections.map((collection, index) => {
                const ownerType: OwnerType =
                  collection.ownerType || (collection.isSystem ? 'system' : 'custom');
                const ownerColors = {
                  system: { bg: 'var(--bg-error-subtle)', text: 'var(--text-error)' },
                  platform: { bg: 'var(--bg-warning-subtle)', text: 'var(--text-warning)' },
                  custom: { bg: 'var(--bg-success-subtle)', text: 'var(--text-success)' },
                };

                return (
                  <tr
                    key={collection.id}
                    className="cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                    style={{
                      borderTop: index > 0 ? '1px solid var(--border-default)' : undefined,
                    }}
                    onClick={() => navigate(`/studio/collections/${collection.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center"
                          style={{
                            backgroundColor: collection.color
                              ? `${collection.color}20`
                              : 'var(--bg-surface-secondary)',
                          }}
                        >
                          <Layers
                            className="h-4 w-4"
                            style={{ color: collection.color || 'var(--text-muted)' }}
                          />
                        </div>
                        <div
                          className="text-sm font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {collection.name || collection.label}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: ownerColors[ownerType].bg,
                          color: ownerColors[ownerType].text,
                        }}
                      >
                        {ownerType === 'system' && <Lock className="h-2.5 w-2.5" />}
                        {ownerType === 'platform' && <Building2 className="h-2.5 w-2.5" />}
                        {ownerType === 'custom' && <Pencil className="h-2.5 w-2.5" />}
                        {ownerType.charAt(0).toUpperCase() + ownerType.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {collection.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {collection.tableName || collection.storageTable}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {collection.recordCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {collection.propertyCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {collection.isAudited && (
                          <span
                            className="text-[9px] px-1 py-0.5 rounded"
                            style={{
                              backgroundColor: 'var(--bg-info-subtle)',
                              color: 'var(--text-info)',
                            }}
                            title="Audited"
                          >
                            A
                          </span>
                        )}
                        {(collection.enableVersioning || collection.isVersioned) && (
                          <span
                            className="text-[9px] px-1 py-0.5 rounded"
                            style={{
                              backgroundColor: 'var(--bg-primary-subtle)',
                              color: 'var(--text-brand)',
                            }}
                            title="Versioned"
                          >
                            V
                          </span>
                        )}
                        {collection.isExtensible && (
                          <span
                            className="text-[9px] px-1 py-0.5 rounded"
                            style={{
                              backgroundColor: 'var(--bg-success-subtle)',
                              color: 'var(--text-success)',
                            }}
                            title="Extensible"
                          >
                            E
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CollectionsListPage;
