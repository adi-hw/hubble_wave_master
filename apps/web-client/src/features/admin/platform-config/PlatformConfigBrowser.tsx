import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Database,
  Table2,
  FileCode,
  Shield,
  GitBranch,
  Bell,
  Calendar,
  Zap,
  ChevronRight,
  RefreshCw,
  Loader2,
  XCircle,
  AlertCircle,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { usePlatformConfigList } from '../hooks';
import type { PlatformConfig, ConfigType } from '../types';
import { Button } from '../../../components/ui';

const configTypeIcons: Record<ConfigType, React.ReactNode> = {
  table: <Table2 className="h-4 w-4" />,
  field: <Database className="h-4 w-4" />,
  acl: <Shield className="h-4 w-4" />,
  workflow: <GitBranch className="h-4 w-4" />,
  script: <FileCode className="h-4 w-4" />,
  approval: <CheckCircle className="h-4 w-4" />,
  notification: <Bell className="h-4 w-4" />,
  event: <Calendar className="h-4 w-4" />,
  business_rule: <Zap className="h-4 w-4" />,
};

const configTypeLabels: Record<ConfigType, string> = {
  table: 'Tables',
  field: 'Fields',
  acl: 'Access Controls',
  workflow: 'Workflows',
  script: 'Scripts',
  approval: 'Approvals',
  notification: 'Notifications',
  event: 'Events',
  business_rule: 'Business Rules',
};

const configTypeColors: Record<ConfigType, string> = {
  table: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  field: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  acl: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  workflow: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  script: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approval: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  notification: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  event: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  business_rule: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export const PlatformConfigBrowser: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ConfigType | 'all'>('all');
  const [selectedConfig, setSelectedConfig] = useState<PlatformConfig | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch platform configurations
  const { configs, total, loading, error, refetch } = usePlatformConfigList({
    type: filterType === 'all' ? undefined : filterType,
  });

  // Client-side search filter
  const filteredConfigs = useMemo(() => {
    if (!searchQuery.trim()) return configs;
    const lowerQuery = searchQuery.toLowerCase();
    return configs.filter(
      (c) =>
        c.resourceKey.toLowerCase().includes(lowerQuery) ||
        c.configType.toLowerCase().includes(lowerQuery) ||
        c.description?.toLowerCase().includes(lowerQuery)
    );
  }, [configs, searchQuery]);

  // Group configs by type
  const groupedConfigs = useMemo(() => {
    const groups: Record<string, PlatformConfig[]> = {};
    for (const config of filteredConfigs) {
      if (!groups[config.configType]) {
        groups[config.configType] = [];
      }
      groups[config.configType].push(config);
    }
    return groups;
  }, [filteredConfigs]);

  // Stats by type
  const stats = useMemo(() => {
    const typeStats: Record<string, number> = {};
    for (const config of configs) {
      typeStats[config.configType] = (typeStats[config.configType] || 0) + 1;
    }
    return typeStats;
  }, [configs]);

  const handleCopyResourceKey = async (resourceKey: string, id: string) => {
    try {
      await navigator.clipboard.writeText(resourceKey);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const handleCreateCustomization = (config: PlatformConfig) => {
    navigate(`/studio/customizations/new?type=${config.configType}&key=${config.resourceKey}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
            Platform Configuration
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
            Browse the platform's default configuration schema and base settings
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
        </div>
      </div>

      {/* Stats by Type */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3 mb-6">
        {Object.entries(configTypeLabels).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type ? 'all' : (type as ConfigType))}
            className={`rounded-xl border p-3 text-center transition-all ${
              filterType === type
                ? 'ring-2 ring-primary-500 border-primary-500'
                : ''
            }`}
            style={{
              backgroundColor: 'var(--hw-surface)',
              borderColor: filterType === type ? 'var(--hw-primary)' : 'var(--hw-border)',
            }}
          >
            <div
              className={`h-8 w-8 rounded-lg mx-auto mb-2 flex items-center justify-center ${
                configTypeColors[type as ConfigType]
              }`}
            >
              {configTypeIcons[type as ConfigType]}
            </div>
            <div className="text-lg font-semibold" style={{ color: 'var(--hw-text)' }}>
              {loading ? '-' : stats[type] || 0}
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--hw-text-muted)' }}>
              {label}
            </div>
          </button>
        ))}
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
            <div className="font-medium">Failed to load platform configurations</div>
            <div className="text-sm opacity-80">{error}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'var(--hw-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search configurations..."
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

        {filterType !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterType('all')}
          >
            Clear Filter
            <XCircle className="h-4 w-4 ml-1" />
          </Button>
        )}

        <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
          {loading ? 'Loading...' : `${filteredConfigs.length} of ${total} configurations`}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Config List */}
        <div className="flex-1">
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
                Loading platform configurations...
              </p>
            </div>
          )}

          {!loading && filteredConfigs.length === 0 && (
            <div
              className="rounded-xl border p-12 text-center"
              style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
            >
              <AlertCircle
                className="h-8 w-8 mx-auto mb-3"
                style={{ color: 'var(--hw-text-muted)', opacity: 0.5 }}
              />
              <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                {searchQuery || filterType !== 'all'
                  ? 'No configurations match your filters'
                  : 'No platform configurations found'}
              </p>
            </div>
          )}

          {!loading &&
            Object.entries(groupedConfigs).map(([type, typeConfigs]) => (
              <div key={type} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`h-6 w-6 rounded flex items-center justify-center ${
                      configTypeColors[type as ConfigType]
                    }`}
                  >
                    {configTypeIcons[type as ConfigType]}
                  </div>
                  <h2 className="font-medium" style={{ color: 'var(--hw-text)' }}>
                    {configTypeLabels[type as ConfigType] || type}
                  </h2>
                  <span
                    className="text-sm px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--hw-bg-subtle)', color: 'var(--hw-text-muted)' }}
                  >
                    {typeConfigs.length}
                  </span>
                </div>

                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
                >
                  {typeConfigs.map((config, index) => (
                    <div
                      key={config.id}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                        index !== typeConfigs.length - 1 ? 'border-b' : ''
                      } ${selectedConfig?.id === config.id ? 'ring-2 ring-inset ring-primary-500' : ''}`}
                      style={{ borderColor: 'var(--hw-border)' }}
                      onClick={() => setSelectedConfig(config)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'var(--hw-bg-subtle)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div>
                          <div className="font-medium truncate" style={{ color: 'var(--hw-text)' }}>
                            {config.resourceKey}
                          </div>
                          {config.description && (
                            <div
                              className="text-sm truncate max-w-md"
                              style={{ color: 'var(--hw-text-muted)' }}
                            >
                              {config.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                            v{config.platformVersion}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                            Schema {config.schemaVersion}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyResourceKey(config.resourceKey, config.id);
                          }}
                          className="p-1.5 rounded transition-colors"
                          style={{ color: 'var(--hw-text-muted)' }}
                          title="Copy Resource Key"
                        >
                          {copiedId === config.id ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>

                        <ChevronRight
                          className="h-4 w-4"
                          style={{ color: 'var(--hw-text-muted)' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Detail Panel */}
        {selectedConfig && (
          <div
            className="w-96 flex-shrink-0 rounded-xl border sticky top-6 self-start max-h-[calc(100vh-8rem)] overflow-auto"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            <div
              className="p-4 border-b sticky top-0"
              style={{
                borderColor: 'var(--hw-border)',
                backgroundColor: 'var(--hw-surface)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      configTypeColors[selectedConfig.configType]
                    }`}
                  >
                    {configTypeIcons[selectedConfig.configType]}
                  </div>
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--hw-text)' }}>
                      {selectedConfig.resourceKey}
                    </h3>
                    <div className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                      {configTypeLabels[selectedConfig.configType]}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedConfig(null)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Metadata */}
              <div>
                <h4
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Metadata
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--hw-text-muted)' }}>Platform Version</span>
                    <span style={{ color: 'var(--hw-text)' }}>{selectedConfig.platformVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--hw-text-muted)' }}>Schema Version</span>
                    <span style={{ color: 'var(--hw-text)' }}>{selectedConfig.schemaVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--hw-text-muted)' }}>Created</span>
                    <span style={{ color: 'var(--hw-text)' }}>
                      {new Date(selectedConfig.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {selectedConfig.description && (
                    <div className="pt-2">
                      <span style={{ color: 'var(--hw-text-muted)' }}>Description</span>
                      <p className="mt-1" style={{ color: 'var(--hw-text)' }}>
                        {selectedConfig.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Config Data Preview */}
              <div>
                <h4
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Configuration Data
                </h4>
                <pre
                  className="p-3 rounded-lg text-xs overflow-auto max-h-64"
                  style={{
                    backgroundColor: 'var(--hw-bg-subtle)',
                    color: 'var(--hw-text)',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  }}
                >
                  {JSON.stringify(selectedConfig.configData, null, 2)}
                </pre>
              </div>

              {/* Checksum */}
              <div>
                <h4
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Checksum
                </h4>
                <code
                  className="text-xs px-2 py-1 rounded break-all"
                  style={{ backgroundColor: 'var(--hw-bg-subtle)', color: 'var(--hw-text-muted)' }}
                >
                  {selectedConfig.checksum}
                </code>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t" style={{ borderColor: 'var(--hw-border)' }}>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleCreateCustomization(selectedConfig)}
                >
                  Create Customization
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlatformConfigBrowser;
