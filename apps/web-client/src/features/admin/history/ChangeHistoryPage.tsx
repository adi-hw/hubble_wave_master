import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  History,
  User,
  Clock,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  XCircle,
  Calendar,
} from 'lucide-react';
import { useConfigHistoryList, useConfigHistoryMutations } from '../hooks';
import type { ConfigChangeHistory, ChangeType, ConfigType } from '../types';
import { Button, DiffViewer } from '../../../components/ui';

const changeTypeLabels: Record<ChangeType, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  restore: 'Restored',
  rollback: 'Rolled Back',
};

const changeTypeBadgeColors: Record<ChangeType, string> = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  restore: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  rollback: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
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

export const ChangeHistoryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ConfigType | 'all'>('all');
  const [filterChangeType, setFilterChangeType] = useState<ChangeType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  // Fetch history from API
  const {
    history,
    total,
    loading,
    error,
    refetch,
    loadMore,
    hasMore,
  } = useConfigHistoryList({
    configType: filterType === 'all' ? undefined : filterType,
    changeType: filterChangeType === 'all' ? undefined : filterChangeType,
    fromDate: dateRange.from,
    toDate: dateRange.to,
    limit: 50,
  });

  const { rollback, rollbackState } = useConfigHistoryMutations();

  // Client-side search filter
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const lowerQuery = searchQuery.toLowerCase();
    return history.filter(
      (h) =>
        h.resourceKey.toLowerCase().includes(lowerQuery) ||
        h.changedBy?.toLowerCase().includes(lowerQuery)
    );
  }, [history, searchQuery]);

  const handleRollback = async (change: ConfigChangeHistory) => {
    const reason = prompt('Enter a reason for the rollback (optional):');
    if (reason === null) return; // User cancelled

    const success = await rollback(change.id, reason || undefined);
    if (success) {
      refetch();
    }
  };

  // Group history by date
  const groupedHistory = useMemo(() => {
    const groups = new Map<string, ConfigChangeHistory[]>();
    filteredHistory.forEach((entry) => {
      const date = new Date(entry.changedAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const existing = groups.get(date) || [];
      groups.set(date, [...existing, entry]);
    });
    return groups;
  }, [filteredHistory]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
            Change History
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
            View and rollback configuration changes across the platform
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
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
            <div className="font-medium">Failed to load change history</div>
            <div className="text-sm opacity-80">{error}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'var(--hw-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search by resource or user..."
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
            onChange={(e) => setFilterType(e.target.value as ConfigType | 'all')}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              backgroundColor: 'var(--hw-surface)',
              borderColor: 'var(--hw-border)',
              color: 'var(--hw-text)',
            }}
          >
            <option value="all">All Types</option>
            {Object.entries(configTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={filterChangeType}
            onChange={(e) => setFilterChangeType(e.target.value as ChangeType | 'all')}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              backgroundColor: 'var(--hw-surface)',
              borderColor: 'var(--hw-border)',
              color: 'var(--hw-text)',
            }}
          >
            <option value="all">All Changes</option>
            {Object.entries(changeTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
          <input
            type="date"
            value={dateRange.from || ''}
            onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value || undefined }))}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              backgroundColor: 'var(--hw-surface)',
              borderColor: 'var(--hw-border)',
              color: 'var(--hw-text)',
            }}
            placeholder="From"
          />
          <span style={{ color: 'var(--hw-text-muted)' }}>to</span>
          <input
            type="date"
            value={dateRange.to || ''}
            onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value || undefined }))}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              backgroundColor: 'var(--hw-surface)',
              borderColor: 'var(--hw-border)',
              color: 'var(--hw-text)',
            }}
            placeholder="To"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && history.length === 0 && (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <Loader2
            className="h-8 w-8 mx-auto mb-3 animate-spin"
            style={{ color: 'var(--hw-text-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            Loading change history...
          </p>
        </div>
      )}

      {/* Timeline */}
      {!loading || history.length > 0 ? (
        <div className="space-y-6">
          {Array.from(groupedHistory.entries()).map(([date, entries]) => (
            <div key={date}>
              <div
                className="text-sm font-medium mb-3 flex items-center gap-2"
                style={{ color: 'var(--hw-text-muted)' }}
              >
                <Calendar className="h-4 w-4" />
                {date}
              </div>
              <div className="space-y-3">
                {entries.map((change) => (
                  <div
                    key={change.id}
                    className="rounded-xl border overflow-hidden"
                    style={{
                      backgroundColor: 'var(--hw-surface)',
                      borderColor: 'var(--hw-border)',
                    }}
                  >
                    <div
                      className="p-4 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === change.id ? null : change.id)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'var(--hw-bg-subtle)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                          >
                            <History
                              className="h-5 w-5"
                              style={{ color: 'var(--hw-text-muted)' }}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium" style={{ color: 'var(--hw-text)' }}>
                                {change.resourceKey}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  changeTypeBadgeColors[change.changeType]
                                }`}
                              >
                                {changeTypeLabels[change.changeType]}
                              </span>
                            </div>
                            <div
                              className="flex items-center gap-3 text-sm mt-0.5"
                              style={{ color: 'var(--hw-text-muted)' }}
                            >
                              <span>
                                {configTypeLabels[change.configType] || change.configType}
                              </span>
                              <span style={{ color: 'var(--hw-border)' }}>|</span>
                              <span className="capitalize">
                                {change.changeSource.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            {change.changedBy ? (
                              <div
                                className="flex items-center gap-2 text-sm"
                                style={{ color: 'var(--hw-text-secondary)' }}
                              >
                                <User className="h-3.5 w-3.5" />
                                {change.changedBy}
                              </div>
                            ) : (
                              <span
                                className="text-sm"
                                style={{ color: 'var(--hw-text-muted)' }}
                              >
                                System
                              </span>
                            )}
                            <div
                              className="flex items-center gap-1.5 text-xs mt-0.5"
                              style={{ color: 'var(--hw-text-muted)' }}
                            >
                              <Clock className="h-3 w-3" />
                              {new Date(change.changedAt).toLocaleTimeString()}
                            </div>
                          </div>

                          {change.isRollbackable && !change.rolledBackAt && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRollback(change);
                              }}
                              disabled={rollbackState.loading}
                              className="p-2 rounded-lg transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20"
                              style={{ color: 'var(--hw-text-muted)' }}
                              title="Rollback"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}

                          {expandedId === change.id ? (
                            <ChevronUp
                              className="h-5 w-5"
                              style={{ color: 'var(--hw-text-muted)' }}
                            />
                          ) : (
                            <ChevronDown
                              className="h-5 w-5"
                              style={{ color: 'var(--hw-text-muted)' }}
                            />
                          )}
                        </div>
                      </div>

                      {change.changeReason && (
                        <p
                          className="mt-2 text-sm ml-14"
                          style={{ color: 'var(--hw-text-muted)' }}
                        >
                          "{change.changeReason}"
                        </p>
                      )}

                      {change.rolledBackAt && (
                        <div
                          className="mt-2 ml-14 text-xs flex items-center gap-1"
                          style={{ color: 'var(--hw-warning)' }}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Rolled back on {new Date(change.rolledBackAt).toLocaleString()}
                          {change.rolledBackBy && ` by ${change.rolledBackBy}`}
                        </div>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {expandedId === change.id && (
                      <div
                        className="px-4 pb-4 pt-0 border-t"
                        style={{
                          borderColor: 'var(--hw-border)',
                          backgroundColor: 'var(--hw-bg-subtle)',
                        }}
                      >
                        {(change.previousValue || change.newValue) && (
                          <div className="mt-4">
                            <DiffViewer
                              oldValue={change.previousValue}
                              newValue={change.newValue}
                              diff={change.diff}
                              oldLabel="Previous"
                              newLabel="New"
                              title="Configuration Changes"
                            />
                          </div>
                        )}

                        {!change.previousValue && !change.newValue && (
                          <div
                            className="mt-4 text-sm text-center py-4"
                            style={{ color: 'var(--hw-text-muted)' }}
                          >
                            No detailed change data available
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Empty State */}
      {!loading && filteredHistory.length === 0 && (
        <div
          className="rounded-xl border px-4 py-12 text-center"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <AlertCircle
            className="h-8 w-8 mx-auto mb-3"
            style={{ color: 'var(--hw-text-muted)', opacity: 0.5 }}
          />
          <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            {searchQuery || filterType !== 'all' || filterChangeType !== 'all'
              ? 'No changes match your filters'
              : 'No change history found'}
          </p>
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={loadMore} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}

      {/* Pagination info */}
      {!loading && filteredHistory.length > 0 && (
        <div className="mt-4 text-sm" style={{ color: 'var(--hw-text-muted)' }}>
          Showing {filteredHistory.length} of {total} change{total !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default ChangeHistoryPage;
