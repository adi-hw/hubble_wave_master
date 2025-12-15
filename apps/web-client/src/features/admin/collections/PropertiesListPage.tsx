import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  GripVertical,
  MoreHorizontal,
  Trash2,
  Copy,
  Edit3,
  RefreshCw,
  Lock,
  AlertTriangle,
  Type,
  Hash,
  Calendar,
  List,
  Link2,
  ToggleLeft,
  Paperclip,
  Code,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { NoDataState, NoResultsState } from '../../../components/ui/EmptyState';
import metadataApi from '../../../services/metadataApi';

interface Property {
  id: string;
  collectionId: string;
  code: string;
  label: string;
  description?: string;
  propertyType: string;
  storageColumn: string;
  isSystem: boolean;
  isRequired: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  isReadonly: boolean;
  isComputed: boolean;
  isInternal: boolean;
  sortOrder: number;
  groupName?: string;
  uiWidth: string;
  deprecatedAt?: string;
  deprecationMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface Collection {
  id: string;
  code: string;
  label: string;
  isSystem: boolean;
}

interface PropertyType {
  code: string;
  label: string;
  icon?: string;
  category: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  text: <Type className="h-4 w-4" />,
  string: <Type className="h-4 w-4" />,
  rich_text: <Type className="h-4 w-4" />,
  integer: <Hash className="h-4 w-4" />,
  decimal: <Hash className="h-4 w-4" />,
  currency: <Hash className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  datetime: <Calendar className="h-4 w-4" />,
  choice: <List className="h-4 w-4" />,
  multi_choice: <List className="h-4 w-4" />,
  boolean: <ToggleLeft className="h-4 w-4" />,
  reference: <Link2 className="h-4 w-4" />,
  multi_reference: <Link2 className="h-4 w-4" />,
  user: <Link2 className="h-4 w-4" />,
  attachment: <Paperclip className="h-4 w-4" />,
  script: <Code className="h-4 w-4" />,
  formula: <Code className="h-4 w-4" />,
};

export const PropertiesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: collectionId } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [draggedProperty, setDraggedProperty] = useState<string | null>(null);

  useEffect(() => {
    if (collectionId) {
      fetchCollection();
      fetchProperties();
      fetchPropertyTypes();
    } else {
      // Standalone properties page - fetch all properties
      fetchAllProperties();
      fetchPropertyTypes();
    }
  }, [collectionId]);

  const fetchCollection = async () => {
    try {
      const response = await metadataApi.get<Collection>(`/collections/${collectionId}`);
      setCollection(response.data);
    } catch (error) {
      console.error('Failed to fetch collection:', error);
    }
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await metadataApi.get<Property[] | { data: Property[] }>(`/properties/by-collection/${collectionId}`);
      // Handle both array response and wrapped { data: [...] } response
      const data = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
      setProperties(data);
    } catch (error) {
      console.error('Failed to fetch properties:', error);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProperties = async () => {
    setLoading(true);
    try {
      const response = await metadataApi.get<Property[] | { data: Property[] }>('/properties');
      // Handle both array response and wrapped { data: [...] } response
      const data = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
      setProperties(data);
    } catch (error) {
      console.error('Failed to fetch properties:', error);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyTypes = async () => {
    try {
      const response = await metadataApi.get<PropertyType[] | { data: PropertyType[] }>('/collections/property-types');
      // Handle both array response and wrapped { data: [...] } response
      const data = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
      setPropertyTypes(data);
    } catch (error) {
      console.error('Failed to fetch property types:', error);
      setPropertyTypes([]);
    }
  };

  const handleAction = async (propertyId: string, action: string) => {
    setActionMenuOpen(null);
    try {
      switch (action) {
        case 'delete': {
          if (!window.confirm('Are you sure you want to delete this property?')) return;
          await metadataApi.delete(`/properties/${propertyId}`);
          fetchProperties();
          break;
        }
        case 'deprecate': {
          const message = window.prompt('Enter deprecation message:');
          if (!message) return;
          await metadataApi.post(`/properties/${propertyId}/deprecate`, { message });
          fetchProperties();
          break;
        }
        case 'clone': {
          const newCode = window.prompt('Enter a code for the cloned property:');
          if (!newCode) return;
          await metadataApi.post(`/properties/${propertyId}/clone`, { targetCollectionId: collectionId, newCode });
          fetchProperties();
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to ${action} property:`, error);
    }
  };

  const handleDragStart = (propertyId: string) => {
    setDraggedProperty(propertyId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedProperty || draggedProperty === targetId) return;
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedProperty || draggedProperty === targetId) return;

    const draggedIndex = properties.findIndex(p => p.id === draggedProperty);
    const targetIndex = properties.findIndex(p => p.id === targetId);

    const newProperties = [...properties];
    const [removed] = newProperties.splice(draggedIndex, 1);
    newProperties.splice(targetIndex, 0, removed);

    // Update sort orders
    const orders = newProperties.map((p, idx) => ({ id: p.id, sortOrder: idx * 10 }));

    setProperties(newProperties);
    setDraggedProperty(null);

    try {
      await metadataApi.put(`/properties/by-collection/${collectionId}/reorder`, { orders });
    } catch (error) {
      console.error('Failed to reorder properties:', error);
      fetchProperties(); // Revert on error
    }
  };

  // Get unique groups
  const groups = Array.from(new Set(properties.map(p => p.groupName || 'General').filter(Boolean)));

  // Filter properties
  const filteredProperties = properties.filter(p => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!p.label.toLowerCase().includes(query) && !p.code.toLowerCase().includes(query)) {
        return false;
      }
    }
    if (groupFilter !== 'all' && (p.groupName || 'General') !== groupFilter) {
      return false;
    }
    return true;
  });

  // Group properties
  const groupedProperties = filteredProperties.reduce((acc, prop) => {
    const group = prop.groupName || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(prop);
    return acc;
  }, {} as Record<string, Property[]>);

  // Show loading only when we have collectionId and are waiting for collection data
  if (collectionId && !collection && loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const isStandalone = !collectionId;
  const pageTitle = isStandalone ? 'All Properties' : `${collection?.label || ''} Properties`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {!isStandalone && (
          <button
            onClick={() => navigate(`/studio/collections/${collectionId}`)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {pageTitle}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {properties.length} properties {isStandalone ? 'across all collections' : 'defined'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => isStandalone ? fetchAllProperties() : fetchProperties()}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {!isStandalone && (
            <Button
              variant="primary"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => navigate(`/studio/collections/${collectionId}/properties/new`)}
              disabled={collection?.isSystem}
            >
              Add Property
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search properties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {groups.length > 1 && (
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Groups</option>
            {groups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        )}
      </div>

      {/* Properties List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : filteredProperties.length === 0 ? (
        searchQuery || groupFilter !== 'all' ? (
          <NoResultsState
            query={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setGroupFilter('all');
            }}
          />
        ) : (
          <NoDataState
            itemName="properties"
            onCreate={isStandalone ? undefined : () => navigate(`/studio/collections/${collectionId}/properties/new`)}
          />
        )
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedProperties).map(([group, groupProperties]) => (
            <div key={group}>
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                {group}
              </h2>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="w-10" />
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Property
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Type
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Flags
                      </th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {groupProperties.map((property) => (
                      <tr
                        key={property.id}
                        draggable={!property.isSystem}
                        onDragStart={() => handleDragStart(property.id)}
                        onDragOver={(e) => handleDragOver(e, property.id)}
                        onDrop={() => handleDrop(property.id)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                          draggedProperty === property.id ? 'opacity-50' : ''
                        } ${property.deprecatedAt ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
                      >
                        <td className="px-2 py-3">
                          {!property.isSystem && (
                            <button className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                              <GripVertical className="h-4 w-4 text-slate-400" />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              {typeIcons[property.propertyType] || <Type className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                {property.label}
                                {property.isSystem && (
                                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                                )}
                                {property.deprecatedAt && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                )}
                              </div>
                              <code className="text-xs text-slate-500 dark:text-slate-400">
                                {property.code}
                              </code>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {propertyTypes.find(t => t.code === property.propertyType)?.label || property.propertyType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {property.isRequired && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                Required
                              </span>
                            )}
                            {property.isUnique && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                Unique
                              </span>
                            )}
                            {property.isIndexed && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                Indexed
                              </span>
                            )}
                            {property.isComputed && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400">
                                Computed
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button
                              onClick={() => setActionMenuOpen(actionMenuOpen === property.id ? null : property.id)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            >
                              <MoreHorizontal className="h-4 w-4 text-slate-500" />
                            </button>

                            {actionMenuOpen === property.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-10">
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      setActionMenuOpen(null);
                                      navigate(`/studio/collections/${collectionId}/properties/${property.id}`);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                    Edit Property
                                  </button>
                                  <button
                                    onClick={() => handleAction(property.id, 'clone')}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  >
                                    <Copy className="h-4 w-4" />
                                    Clone
                                  </button>
                                  {!property.isSystem && (
                                    <>
                                      {!property.deprecatedAt && (
                                        <button
                                          onClick={() => handleAction(property.id, 'deprecate')}
                                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                        >
                                          <AlertTriangle className="h-4 w-4" />
                                          Deprecate
                                        </button>
                                      )}
                                      <hr className="my-1 border-slate-200 dark:border-slate-700" />
                                      <button
                                        onClick={() => handleAction(property.id, 'delete')}
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertiesListPage;
