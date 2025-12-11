import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Layers,
  AlertCircle,
  Check,
  ArrowUpRight,
  RotateCcw,
  Plus,
  RefreshCw,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useCustomizationList, useCustomizationMutations } from '../hooks';
import type { TenantCustomization, CustomizationType, ConfigType } from '../types';
import { Button } from '../../../components/ui';

const customizationTypeLabels: Record<CustomizationType, string> = {
  override: 'Override',
  extend: 'Extend',
  new: 'Custom',
};

const customizationTypeBadgeColors: Record<CustomizationType, string> = {
  override: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  extend: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  new: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const configTypeLabels: Record<ConfigType, string> = {
  table: 'Table',
  field: 'Field',
  acl: 'ACL',
  workflow: 'Workflow',
  script: 'Script',
  approval: 'Approval',
  notification: 'Notification',
  event: 'Event',
  business_rule: 'Business Rule',
};

export const CustomizationsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<CustomizationType | 'all'>('all');
  const [filterConfigType, setFilterConfigType] = useState<ConfigType | 'all'>('all');

  // Fetch customizations from API
  const {
    customizations,
    total,
    loading,
    error,
    refetch,
  } = useCustomizationList({
    customizationType: filterType === 'all' ? undefined : filterType,
    configType: filterConfigType === 'all' ? undefined : filterConfigType,
    active: true,
  });

  const { deleteCustomization, deleteState } = useCustomizationMutations();

  // Client-side search filter
  const filteredCustomizations = useMemo(() => {
    if (!searchQuery.trim()) return customizations;
    const lowerQuery = searchQuery.toLowerCase();
    return customizations.filter(
      (c) =>
        c.resourceKey.toLowerCase().includes(lowerQuery) ||
        c.configType.toLowerCase().includes(lowerQuery)
    );
  }, [customizations, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: customizations.length,
      overrides: customizations.filter((c) => c.customizationType === 'override').length,
      extensions: customizations.filter((c) => c.customizationType === 'extend').length,
      custom: customizations.filter((c) => c.customizationType === 'new').length,
    };
  }, [customizations]);

  const handleRevert = async (customization: TenantCustomization) => {
    if (!confirm(`Are you sure you want to revert "${customization.resourceKey}"? This will delete the customization.`)) {
      return;
    }
    const success = await deleteCustomization(customization.id);
    if (success) {
      refetch();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
            Customizations
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
            View and manage tenant-specific customizations to platform configurations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/studio/customizations/new')}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Customization
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
            {loading ? '-' : stats.total}
          </div>
          <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            Total Customizations
          </div>
        </div>
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {loading ? '-' : stats.overrides}
          </div>
          <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            Overrides
          </div>
        </div>
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {loading ? '-' : stats.extensions}
          </div>
          <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            Extensions
          </div>
        </div>
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="text-2xl font-semibold text-green-600 dark:text-green-400">
            {loading ? '-' : stats.custom}
          </div>
          <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            Custom
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          className="mb-6 p-4 rounded-xl border flex items-center gap-3"
          style={{
            backgroundColor: 'var(--hw-danger-subtle)',
            borderColor: 'var(--hw-danger)',
            color: 'var(--hw-danger)',
          }}
        >
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <div className="font-medium">Failed to load customizations</div>
            <div className="text-sm opacity-80">{error}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'var(--hw-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search customizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            style={{
              backgroundColor: 'var(--hw-surface)',
              borderColor: 'var(--hw-border)',
              color: 'var(--hw-text)',
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as CustomizationType | 'all')}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              backgroundColor: 'var(--hw-surface)',
              borderColor: 'var(--hw-border)',
              color: 'var(--hw-text)',
            }}
          >
            <option value="all">All Types</option>
            <option value="override">Overrides</option>
            <option value="extend">Extensions</option>
            <option value="new">Custom</option>
          </select>

          <select
            value={filterConfigType}
            onChange={(e) => setFilterConfigType(e.target.value as ConfigType | 'all')}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              backgroundColor: 'var(--hw-surface)',
              borderColor: 'var(--hw-border)',
              color: 'var(--hw-text)',
            }}
          >
            <option value="all">All Config Types</option>
            {Object.entries(configTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <Loader2
            className="h-8 w-8 mx-auto mb-3 animate-spin"
            style={{ color: 'var(--hw-text-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            Loading customizations...
          </p>
        </div>
      )}

      {/* Customizations List */}
      {!loading && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <table className="w-full">
            <thead>
              <tr
                className="border-b"
                style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg-subtle)' }}
              >
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Resource
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Type
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Base Version
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Status
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Updated
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomizations.map((c) => (
                <tr
                  key={c.id}
                  className="border-b cursor-pointer transition-colors hover:bg-opacity-50"
                  style={{ borderColor: 'var(--hw-border)' }}
                  onClick={() => navigate(`/studio/customizations/${c.id}`)}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = 'var(--hw-bg-subtle)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                      >
                        <Layers className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                      </div>
                      <div>
                        <div className="font-medium" style={{ color: 'var(--hw-text)' }}>
                          {c.resourceKey}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                          {configTypeLabels[c.configType] || c.configType}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        customizationTypeBadgeColors[c.customizationType]
                      }`}
                    >
                      {customizationTypeLabels[c.customizationType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--hw-text-secondary)' }}>
                    {c.basePlatformVersion || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {c.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                        <Check className="h-3.5 w-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                    <div>{new Date(c.updatedAt).toLocaleDateString()}</div>
                    <div className="text-xs">v{c.version}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/studio/customizations/${c.id}/diff`);
                        }}
                        className="p-1.5 rounded transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20"
                        style={{ color: 'var(--hw-text-muted)' }}
                        title="View Diff"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRevert(c);
                        }}
                        disabled={deleteState.loading}
                        className="p-1.5 rounded transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
                        style={{ color: 'var(--hw-text-muted)' }}
                        title="Revert to Platform Default"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCustomizations.length === 0 && !loading && (
            <div className="px-4 py-12 text-center">
              <AlertCircle
                className="h-8 w-8 mx-auto mb-3"
                style={{ color: 'var(--hw-text-muted)', opacity: 0.5 }}
              />
              <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                {searchQuery || filterType !== 'all' || filterConfigType !== 'all'
                  ? 'No customizations match your filters'
                  : 'No customizations found'}
              </p>
              {!searchQuery && filterType === 'all' && filterConfigType === 'all' && (
                <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)', opacity: 0.7 }}>
                  Create your first customization to override or extend platform configurations
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pagination info */}
      {!loading && filteredCustomizations.length > 0 && (
        <div className="mt-4 text-sm" style={{ color: 'var(--hw-text-muted)' }}>
          Showing {filteredCustomizations.length} of {total} customization
          {total !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default CustomizationsListPage;
