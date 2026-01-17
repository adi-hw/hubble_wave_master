import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Activity,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  Shield,
  CheckCircle,
  X,
  FileText,
  Loader2,
  Eye,
  Hash,
  Server,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { DiffViewer } from '../../components/ui/DiffViewer';
import api from '../../services/api';

type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'read'
  | 'export'
  | 'import'
  | 'login'
  | 'logout'
  | 'permission_change'
  | 'bulk_update'
  | 'bulk_delete';

interface AuditActor {
  id: string;
  displayName: string;
  email: string;
  type: 'user' | 'system' | 'api' | 'automation';
}

interface AuditTarget {
  collectionCode: string;
  collectionLabel: string;
  recordId: string;
  recordDisplayValue?: string;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  action: AuditAction;
  actor: AuditActor;
  target: AuditTarget;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  changedFields: string[];
  ipAddress: string;
  userAgent?: string;
  sessionId?: string;
  correlationId?: string;
  hash: string;
  previousHash: string;
  metadata?: Record<string, unknown>;
}

interface AuditEventsResponse {
  data: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface HashVerificationResult {
  valid: boolean;
  totalEvents: number;
  verifiedEvents: number;
  firstInvalidEventId?: string;
  message: string;
}

interface UserOption {
  id: string;
  displayName: string;
  email: string;
}

interface CollectionOption {
  code: string;
  label: string;
}

const actionLabels: Record<AuditAction, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  read: 'Viewed',
  export: 'Exported',
  import: 'Imported',
  login: 'Logged In',
  logout: 'Logged Out',
  permission_change: 'Permission Changed',
  bulk_update: 'Bulk Updated',
  bulk_delete: 'Bulk Deleted',
};

const actionStyles: Record<AuditAction, { bg: string; text: string; icon: React.ElementType }> = {
  create: { bg: 'bg-success-subtle', text: 'text-success-text', icon: FileText },
  update: { bg: 'bg-info-subtle', text: 'text-info-text', icon: FileText },
  delete: { bg: 'bg-danger-subtle', text: 'text-danger-text', icon: XCircle },
  read: { bg: 'bg-muted', text: 'text-muted-foreground', icon: Eye },
  export: { bg: 'bg-purple-500/10', text: 'text-purple-500', icon: Download },
  import: { bg: 'bg-purple-500/10', text: 'text-purple-500', icon: Database },
  login: { bg: 'bg-success-subtle', text: 'text-success-text', icon: User },
  logout: { bg: 'bg-warning-subtle', text: 'text-warning-text', icon: User },
  permission_change: { bg: 'bg-warning-subtle', text: 'text-warning-text', icon: Shield },
  bulk_update: { bg: 'bg-info-subtle', text: 'text-info-text', icon: Database },
  bulk_delete: { bg: 'bg-danger-subtle', text: 'text-danger-text', icon: Database },
};

export const AuditExplorerPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedCollectionCode, setSelectedCollectionCode] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });

  const [users, setUsers] = useState<UserOption[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [verificationStatus, setVerificationStatus] = useState<HashVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const [usersRes, collectionsRes] = await Promise.all([
        api.get<{ data: UserOption[] }>('/users', { params: { pageSize: 100 } }),
        api.get<{ data: CollectionOption[] }>('/collections', { params: { pageSize: 100 } }),
      ]);
      setUsers(usersRes.data.data || []);
      setCollections(collectionsRes.data.data || []);
    } catch {
      setUsers([]);
      setCollections([]);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedUserId) params.userId = selectedUserId;
      if (selectedCollectionCode) params.collectionCode = selectedCollectionCode;
      if (selectedAction) params.action = selectedAction;
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;

      const response = await api.get<AuditEventsResponse>('/audit/events', { params });
      setEvents(response.data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: response.data.total,
        totalPages: response.data.totalPages,
      }));
    } catch (err) {
      console.error('Failed to fetch audit events:', err);
      setError('Failed to load audit events. The audit API may not be available.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    selectedUserId,
    selectedCollectionCode,
    selectedAction,
    dateRange,
    pagination.page,
    pagination.pageSize,
  ]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string | number> = {
        format: 'csv',
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedUserId) params.userId = selectedUserId;
      if (selectedCollectionCode) params.collectionCode = selectedCollectionCode;
      if (selectedAction) params.action = selectedAction;
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;

      const response = await api.get('/audit/events', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-events-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export audit events:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleVerifyHashChain = async () => {
    setVerifying(true);
    setVerificationStatus(null);
    try {
      const response = await api.get<HashVerificationResult>('/audit/events/verify');
      setVerificationStatus(response.data);
    } catch (err) {
      console.error('Failed to verify hash chain:', err);
      setVerificationStatus({
        valid: false,
        totalEvents: 0,
        verifiedEvents: 0,
        message: 'Verification failed. The audit verification API may not be available.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleRowClick = (event: AuditEvent) => {
    setSelectedEvent(event);
    setDetailModalOpen(true);
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const clearFilters = () => {
    setSelectedUserId('');
    setSelectedCollectionCode('');
    setSelectedAction('');
    setDateRange({ start: '', end: '' });
    setSearchQuery('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters =
    selectedUserId || selectedCollectionCode || selectedAction || dateRange.start || dateRange.end;

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit Explorer</h1>
          <p className="text-sm mt-1 text-muted-foreground">
            View, search, and analyze all platform activity with tamper-evident audit trail
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleVerifyHashChain}
            disabled={verifying}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {verifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Hash className="h-4 w-4" />
            )}
            Verify Chain
          </button>
          <button
            onClick={() => fetchEvents()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border border-border text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || events.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-primary-foreground rounded-lg transition-colors bg-primary hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </button>
        </div>
      </div>

      {verificationStatus && (
        <div
          className={`mb-6 rounded-xl p-4 flex items-start gap-3 ${
            verificationStatus.valid ? 'bg-success-subtle' : 'bg-danger-subtle'
          }`}
        >
          {verificationStatus.valid ? (
            <CheckCircle className="h-5 w-5 text-success-text flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-danger-text flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`font-medium ${
                verificationStatus.valid ? 'text-success-text' : 'text-danger-text'
              }`}
            >
              {verificationStatus.valid ? 'Hash Chain Verified' : 'Hash Chain Invalid'}
            </p>
            <p
              className={`text-sm mt-1 ${
                verificationStatus.valid ? 'text-success-text/80' : 'text-danger-text/80'
              }`}
            >
              {verificationStatus.message}
              {verificationStatus.verifiedEvents > 0 &&
                ` (${verificationStatus.verifiedEvents.toLocaleString()} of ${verificationStatus.totalEvents.toLocaleString()} events verified)`}
            </p>
          </div>
          <button
            onClick={() => setVerificationStatus(null)}
            className={`p-1 rounded ${
              verificationStatus.valid
                ? 'hover:bg-success-text/10 text-success-text'
                : 'hover:bg-danger-text/10 text-danger-text'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl p-4 flex items-start gap-3 bg-danger-subtle">
          <XCircle className="h-5 w-5 text-danger-text flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-danger-text">{error}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl p-4 mb-6 bg-card border border-border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[280px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by record, user, collection..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary border border-border bg-muted text-foreground"
              />
            </div>
          </div>

          <button
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${
              hasActiveFilters
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                {
                  [selectedUserId, selectedCollectionCode, selectedAction, dateRange.start].filter(
                    Boolean
                  ).length
                }
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        {filterPanelOpen && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  <User className="h-3 w-3 inline mr-1" />
                  User
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary border border-border bg-muted text-foreground"
                >
                  <option value="">All Users</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  <Database className="h-3 w-3 inline mr-1" />
                  Collection
                </label>
                <select
                  value={selectedCollectionCode}
                  onChange={(e) => {
                    setSelectedCollectionCode(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary border border-border bg-muted text-foreground"
                >
                  <option value="">All Collections</option>
                  {collections.map((col) => (
                    <option key={col.code} value={col.code}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  <Activity className="h-3 w-3 inline mr-1" />
                  Action
                </label>
                <select
                  value={selectedAction}
                  onChange={(e) => {
                    setSelectedAction(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary border border-border bg-muted text-foreground"
                >
                  <option value="">All Actions</option>
                  {Object.entries(actionLabels).map(([action, label]) => (
                    <option key={action} value={action}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => {
                      setDateRange((prev) => ({ ...prev, start: e.target.value }));
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="flex-1 px-2 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary border border-border bg-muted text-foreground text-sm"
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => {
                      setDateRange((prev) => ({ ...prev, end: e.target.value }));
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="flex-1 px-2 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary border border-border bg-muted text-foreground text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl overflow-hidden bg-card border border-border">
        {loading && events.length === 0 ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2 text-foreground">No Events Found</h3>
            <p className="text-muted-foreground">
              {hasActiveFilters || searchQuery
                ? 'No audit events match your current filters.'
                : 'No audit events have been recorded yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Timestamp
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actor
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Action
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Target
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Changes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const actionStyle = actionStyles[event.action] || actionStyles.update;
                    const ActionIcon = actionStyle.icon;

                    return (
                      <tr
                        key={event.id}
                        onClick={() => handleRowClick(event)}
                        className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm text-foreground whitespace-nowrap">
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                event.actor.type === 'system' || event.actor.type === 'automation'
                                  ? 'bg-purple-500/10'
                                  : 'bg-primary/10'
                              }`}
                            >
                              {event.actor.type === 'system' || event.actor.type === 'automation' ? (
                                <Server className="h-3.5 w-3.5 text-purple-500" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {event.actor.displayName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {event.actor.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${actionStyle.bg} ${actionStyle.text}`}
                          >
                            <ActionIcon className="h-3 w-3" />
                            {actionLabels[event.action]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {event.target.collectionLabel}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {event.target.recordDisplayValue || event.target.recordId}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {event.changedFields.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {event.changedFields.slice(0, 3).map((field) => (
                                <span
                                  key={field}
                                  className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground"
                                >
                                  {field}
                                </span>
                              ))}
                              {event.changedFields.length > 3 && (
                                <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                                  +{event.changedFields.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                  {pagination.total.toLocaleString()} events
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted border border-border"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <span className="text-sm text-foreground px-2">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted border border-border"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedEvent(null);
        }}
        title="Audit Event Details"
        size="xl"
        icon={<FileText className="h-5 w-5" />}
      >
        {selectedEvent && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                    Event Information
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Event ID:</dt>
                      <dd className="font-mono text-xs text-foreground">{selectedEvent.id}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Timestamp:</dt>
                      <dd className="text-foreground">
                        {formatTimestamp(selectedEvent.timestamp)}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center">
                      <dt className="text-muted-foreground">Action:</dt>
                      <dd>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            actionStyles[selectedEvent.action]?.bg
                          } ${actionStyles[selectedEvent.action]?.text}`}
                        >
                          {actionLabels[selectedEvent.action]}
                        </span>
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">IP Address:</dt>
                      <dd className="font-mono text-xs text-foreground">
                        {selectedEvent.ipAddress}
                      </dd>
                    </div>
                    {selectedEvent.correlationId && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Correlation ID:</dt>
                        <dd className="font-mono text-xs text-foreground truncate max-w-[180px]">
                          {selectedEvent.correlationId}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                    Actor
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Name:</dt>
                      <dd className="text-foreground">{selectedEvent.actor.displayName}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Email:</dt>
                      <dd className="text-foreground">{selectedEvent.actor.email}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Type:</dt>
                      <dd className="capitalize text-foreground">{selectedEvent.actor.type}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                    Target
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Collection:</dt>
                      <dd className="text-foreground">{selectedEvent.target.collectionLabel}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Collection Code:</dt>
                      <dd className="font-mono text-xs text-foreground">
                        {selectedEvent.target.collectionCode}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Record ID:</dt>
                      <dd className="font-mono text-xs text-foreground">
                        {selectedEvent.target.recordId}
                      </dd>
                    </div>
                    {selectedEvent.target.recordDisplayValue && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Display Value:</dt>
                        <dd className="text-foreground truncate max-w-[180px]">
                          {selectedEvent.target.recordDisplayValue}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                    Hash Chain
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Current Hash:</dt>
                      <dd className="font-mono text-xs text-foreground truncate max-w-[180px]">
                        {selectedEvent.hash}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Previous Hash:</dt>
                      <dd className="font-mono text-xs text-foreground truncate max-w-[180px]">
                        {selectedEvent.previousHash || '(genesis)'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {selectedEvent.changedFields.length > 0 && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                  Changed Fields
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedEvent.changedFields.map((field) => (
                    <span
                      key={field}
                      className="px-2.5 py-1 rounded-lg text-sm bg-muted text-foreground"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(selectedEvent.beforeState || selectedEvent.afterState) && (
              <DiffViewer
                oldValue={selectedEvent.beforeState as Record<string, unknown> | undefined}
                newValue={selectedEvent.afterState as Record<string, unknown> | undefined}
                title="State Changes"
                oldLabel="Before"
                newLabel="After"
                showModeToggle
                expandedByDefault
              />
            )}

            {selectedEvent.userAgent && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                  User Agent
                </h4>
                <p className="text-xs font-mono p-3 rounded-lg bg-muted text-muted-foreground break-all">
                  {selectedEvent.userAgent}
                </p>
              </div>
            )}

            {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                  Additional Metadata
                </h4>
                <pre className="text-xs font-mono p-3 rounded-lg bg-muted text-muted-foreground overflow-x-auto">
                  {JSON.stringify(selectedEvent.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditExplorerPage;
