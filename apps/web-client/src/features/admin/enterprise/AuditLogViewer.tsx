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
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import identityApi from '../../../services/identityApi';

type AuditEventType =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'access'
  | 'permission_change';
type AuditSeverity = 'info' | 'warning' | 'critical';

interface AuditEntry {
  id: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  actor: {
    id: string;
    name: string;
    email: string;
    type: 'user' | 'system' | 'api';
  };
  resource: {
    type: string;
    id: string;
    name: string;
  };
  action: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
  timestamp: string;
  success: boolean;
  complianceFlags?: string[];
}

interface AuditLogsResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const eventTypeIcons: Record<AuditEventType, React.ElementType> = {
  login: User,
  logout: User,
  create: FileText,
  update: FileText,
  delete: XCircle,
  export: Download,
  access: Activity,
  permission_change: AlertTriangle,
};

const severityStyles: Record<AuditSeverity, { bg: string; color: string }> = {
  info: { bg: 'rgba(59, 130, 246, 0.15)', color: 'rgb(59, 130, 246)' },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', color: 'rgb(245, 158, 11)' },
  critical: { bg: 'rgba(239, 68, 68, 0.15)', color: 'rgb(239, 68, 68)' },
};

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [stats, setStats] = useState({ total: 0, critical: 0, failed: 0, compliance: 0 });

  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedSeverity !== 'all') params.set('severity', selectedSeverity);
      if (selectedEventType !== 'all') params.set('eventType', selectedEventType);
      if (dateRange.start) params.set('startDate', dateRange.start);
      if (dateRange.end) params.set('endDate', dateRange.end);
      params.set('page', pagination.page.toString());
      params.set('pageSize', pagination.pageSize.toString());

      const response = await identityApi.get<AuditLogsResponse>(`/audit-logs?${params.toString()}`);
      setApiAvailable(true);
      setLogs(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        totalPages: response.data.totalPages,
      }));

      // Calculate stats from response
      const logData = response.data.data || [];
      setStats({
        total: response.data.total,
        critical: logData.filter(l => l.severity === 'critical').length,
        failed: logData.filter(l => !l.success).length,
        compliance: logData.filter(l => l.complianceFlags?.length).length,
      });
    } catch (err: unknown) {
      console.error('Failed to fetch audit logs:', err);
      // Check if it's a 404 error indicating the API doesn't exist
      const axiosError = err as { response?: { status?: number } };
      if (axiosError?.response?.status === 404) {
        setApiAvailable(false);
        setError(null);
      } else {
        setApiAvailable(true);
        setError('Failed to load audit logs. Please try again.');
      }
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSeverity, selectedEventType, dateRange, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedSeverity !== 'all') params.set('severity', selectedSeverity);
      if (selectedEventType !== 'all') params.set('eventType', selectedEventType);
      if (dateRange.start) params.set('startDate', dateRange.start);
      if (dateRange.end) params.set('endDate', dateRange.end);
      params.set('format', 'csv');

      const response = await identityApi.get(`/audit-logs/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export audit logs:', err);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (selectedSeverity !== 'all' && log.severity !== selectedSeverity) return false;
    if (selectedEventType !== 'all' && log.eventType !== selectedEventType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(query) ||
        log.actor.name.toLowerCase().includes(query) ||
        log.actor.email.toLowerCase().includes(query) ||
        log.resource.name.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading && logs.length === 0 && apiAvailable === null) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--bg-primary, #6366f1)' }} />
      </div>
    );
  }

  // Show API not available state
  if (apiAvailable === false) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
              Audit Log
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted, #52525b)' }}>
              View and analyze system activity and security events
            </p>
          </div>
        </div>

        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)' }}
        >
          <div
            className="h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}
          >
            <Activity className="h-8 w-8" style={{ color: 'rgb(59, 130, 246)' }} />
          </div>
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary, #fafafa)' }}>
            Audit Logging Coming Soon
          </h3>
          <p className="max-w-md mx-auto mb-4" style={{ color: 'var(--text-muted, #52525b)' }}>
            The audit logging feature is not yet configured for this instance.
            Once enabled, you'll be able to track all system activity and security events.
          </p>
          <div
            className="inline-block rounded-lg px-4 py-2 text-sm"
            style={{ backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', color: 'var(--text-secondary, #a1a1aa)' }}
          >
            Contact your system administrator to enable this feature
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
            Audit Log
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted, #52525b)' }}>
            View and analyze system activity and security events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLogs()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:opacity-80"
            style={{ border: '1px solid var(--border-default, #2a2a3c)', color: 'var(--text-secondary, #a1a1aa)' }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
            style={{ backgroundColor: 'var(--bg-primary, #6366f1)' }}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)' }}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
              <Activity className="h-4 w-4" style={{ color: 'rgb(59, 130, 246)' }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
                {stats.total}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>
                Total Events
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)' }}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}>
              <AlertTriangle className="h-4 w-4" style={{ color: 'rgb(239, 68, 68)' }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
                {stats.critical}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>
                Critical Events
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)' }}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}>
              <XCircle className="h-4 w-4" style={{ color: 'rgb(245, 158, 11)' }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
                {stats.failed}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>
                Failed Actions
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)' }}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)' }}>
              <FileText className="h-4 w-4" style={{ color: 'rgb(147, 51, 234)' }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary, #fafafa)' }}>
                {stats.compliance}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted, #52525b)' }}>
                Compliance Events
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)' }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted, #52525b)' }} />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  border: '1px solid var(--border-default, #2a2a3c)',
                  backgroundColor: 'var(--bg-surface-secondary, #1c1c26)',
                  color: 'var(--text-primary, #fafafa)',
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" style={{ color: 'var(--text-muted, #52525b)' }} />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{
                border: '1px solid var(--border-default, #2a2a3c)',
                backgroundColor: 'var(--bg-surface-secondary, #1c1c26)',
                color: 'var(--text-primary, #fafafa)',
              }}
            >
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{
                border: '1px solid var(--border-default, #2a2a3c)',
                backgroundColor: 'var(--bg-surface-secondary, #1c1c26)',
                color: 'var(--text-primary, #fafafa)',
              }}
            >
              <option value="all">All Event Types</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="export">Export</option>
              <option value="permission_change">Permission Change</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: 'var(--text-muted, #52525b)' }} />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{
                border: '1px solid var(--border-default, #2a2a3c)',
                backgroundColor: 'var(--bg-surface-secondary, #1c1c26)',
                color: 'var(--text-primary, #fafafa)',
              }}
            />
            <span style={{ color: 'var(--text-muted, #52525b)' }}>to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{
                border: '1px solid var(--border-default, #2a2a3c)',
                backgroundColor: 'var(--bg-surface-secondary, #1c1c26)',
                color: 'var(--text-primary, #fafafa)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface, #16161d)', border: '1px solid var(--border-default, #2a2a3c)' }}>
        <div>
          {filteredLogs.map((log) => {
            const Icon = eventTypeIcons[log.eventType];
            const isExpanded = expandedLog === log.id;
            const severityStyle = severityStyles[log.severity];

            return (
              <div
                key={log.id}
                style={{ borderBottom: '1px solid var(--border-default, #2a2a3c)' }}
              >
                <button
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  className="w-full px-6 py-4 text-left hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: log.success ? 'var(--bg-surface-secondary, #1c1c26)' : 'rgba(239, 68, 68, 0.15)',
                      }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{
                          color: log.success ? 'var(--text-secondary, #a1a1aa)' : 'rgb(239, 68, 68)',
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-medium" style={{ color: 'var(--text-primary, #fafafa)' }}>
                          {log.action}
                        </p>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: severityStyle.bg, color: severityStyle.color }}
                        >
                          {log.severity}
                        </span>
                        {log.complianceFlags?.map((flag) => (
                          <span
                            key={flag}
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: 'rgb(147, 51, 234)' }}
                          >
                            {flag}
                          </span>
                        ))}
                        {!log.success && (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <XCircle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: 'var(--text-muted, #52525b)' }}>
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {log.actor.name} ({log.actor.email})
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span>•</span>
                        <span>IP: {log.ipAddress}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0" style={{ color: 'var(--text-muted, #52525b)' }}>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-4 pt-0">
                    <div
                      className="ml-14 rounded-lg p-4 space-y-4"
                      style={{ backgroundColor: 'var(--bg-surface-secondary, #1c1c26)', border: '1px solid var(--border-default, #2a2a3c)' }}
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4
                            className="text-xs font-medium uppercase tracking-wide mb-2"
                            style={{ color: 'var(--text-muted, #52525b)' }}
                          >
                            Actor Details
                          </h4>
                          <dl className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <dt style={{ color: 'var(--text-muted, #52525b)' }}>Type:</dt>
                              <dd className="capitalize" style={{ color: 'var(--text-primary, #fafafa)' }}>
                                {log.actor.type}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt style={{ color: 'var(--text-muted, #52525b)' }}>ID:</dt>
                              <dd className="font-mono text-xs" style={{ color: 'var(--text-primary, #fafafa)' }}>
                                {log.actor.id}
                              </dd>
                            </div>
                          </dl>
                        </div>
                        <div>
                          <h4
                            className="text-xs font-medium uppercase tracking-wide mb-2"
                            style={{ color: 'var(--text-muted, #52525b)' }}
                          >
                            Resource
                          </h4>
                          <dl className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <dt style={{ color: 'var(--text-muted, #52525b)' }}>Type:</dt>
                              <dd className="capitalize" style={{ color: 'var(--text-primary, #fafafa)' }}>
                                {log.resource.type}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt style={{ color: 'var(--text-muted, #52525b)' }}>Name:</dt>
                              <dd style={{ color: 'var(--text-primary, #fafafa)' }}>
                                {log.resource.name}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      <div>
                        <h4
                          className="text-xs font-medium uppercase tracking-wide mb-2"
                          style={{ color: 'var(--text-muted, #52525b)' }}
                        >
                          Event Details
                        </h4>
                        <pre
                          className="text-xs rounded p-3 overflow-x-auto"
                          style={{ backgroundColor: 'var(--bg-surface, #16161d)', color: 'var(--text-secondary, #a1a1aa)' }}
                        >
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>

                      {log.userAgent && (
                        <div>
                          <h4
                            className="text-xs font-medium uppercase tracking-wide mb-2"
                            style={{ color: 'var(--text-muted, #52525b)' }}
                          >
                            User Agent
                          </h4>
                          <p className="text-xs font-mono" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                            {log.userAgent}
                          </p>
                        </div>
                      )}

                      <div
                        className="flex items-center gap-2 pt-2"
                        style={{ borderTop: '1px solid var(--border-default, #2a2a3c)' }}
                      >
                        <button
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:opacity-80"
                          style={{ color: 'var(--bg-primary, #6366f1)' }}
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Full Record
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredLogs.length === 0 && !loading && (
          <div className="p-12 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted, #52525b)' }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary, #fafafa)' }}>
              No Events Found
            </h3>
            <p style={{ color: 'var(--text-muted, #52525b)' }}>
              {logs.length === 0
                ? 'No audit events have been recorded yet.'
                : 'No audit events match your current filters.'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderTop: '1px solid var(--border-default, #2a2a3c)' }}
          >
            <div className="text-sm" style={{ color: 'var(--text-muted, #52525b)' }}>
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} events
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
                style={{ border: '1px solid var(--border-default, #2a2a3c)', color: 'var(--text-secondary, #a1a1aa)' }}
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
                style={{ border: '1px solid var(--border-default, #2a2a3c)', color: 'var(--text-secondary, #a1a1aa)' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
