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

const severityStyles: Record<AuditSeverity, { bg: string; text: string }> = {
  info: { bg: 'bg-info-subtle', text: 'text-info-text' },
  warning: { bg: 'bg-warning-subtle', text: 'text-warning-text' },
  critical: { bg: 'bg-danger-subtle', text: 'text-danger-text' },
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

      const response = await identityApi.get<AuditLogsResponse>(`/audit/events?${params.toString()}`);
      setApiAvailable(true);
      setLogs(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        totalPages: response.data.totalPages,
      }));

      const logData = response.data.data || [];
      setStats({
        total: response.data.total,
        critical: logData.filter(l => l.severity === 'critical').length,
        failed: logData.filter(l => !l.success).length,
        compliance: logData.filter(l => l.complianceFlags?.length).length,
      });
    } catch (err: unknown) {
      console.error('Failed to fetch audit logs:', err);
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

      const response = await identityApi.get(`/audit/events/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-events-${new Date().toISOString().split('T')[0]}.csv`);
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (apiAvailable === false) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Audit Log
            </h1>
            <p className="text-sm mt-1 text-muted-foreground">
              View and analyze system activity and security events
            </p>
          </div>
        </div>

        <div className="rounded-xl p-12 text-center bg-card border border-border">
          <div className="h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-info-subtle">
            <Activity className="h-8 w-8 text-info-text" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-foreground">
            Audit Logging Coming Soon
          </h3>
          <p className="max-w-md mx-auto mb-4 text-muted-foreground">
            The audit logging feature is not yet configured for this instance.
            Once enabled, you'll be able to track all system activity and security events.
          </p>
          <div className="inline-block rounded-lg px-4 py-2 text-sm bg-muted text-muted-foreground">
            Contact your system administrator to enable this feature
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Audit Log
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            View and analyze system activity and security events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLogs()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:bg-muted border border-border text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-primary-foreground rounded-lg hover:opacity-90 transition-colors bg-primary"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl p-4 flex items-start gap-3 bg-danger-subtle">
          <XCircle className="h-5 w-5 text-danger-text flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-danger-text">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl p-3 bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-info-subtle">
              <Activity className="h-4 w-4 text-info-text" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {stats.total}
              </p>
              <p className="text-xs text-muted-foreground">
                Total Events
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-3 bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-danger-subtle">
              <AlertTriangle className="h-4 w-4 text-danger-text" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {stats.critical}
              </p>
              <p className="text-xs text-muted-foreground">
                Critical Events
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-3 bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-warning-subtle">
              <XCircle className="h-4 w-4 text-warning-text" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {stats.failed}
              </p>
              <p className="text-xs text-muted-foreground">
                Failed Actions
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-3 bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-purple-500/15">
              <FileText className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {stats.compliance}
              </p>
              <p className="text-xs text-muted-foreground">
                Compliance Events
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4 mb-6 bg-card border border-border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 border border-border bg-muted text-foreground"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-3 py-2 rounded-lg focus:outline-none focus:ring-2 border border-border bg-muted text-foreground"
            >
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="px-3 py-2 rounded-lg focus:outline-none focus:ring-2 border border-border bg-muted text-foreground"
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
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 rounded-lg focus:outline-none focus:ring-2 border border-border bg-muted text-foreground"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 rounded-lg focus:outline-none focus:ring-2 border border-border bg-muted text-foreground"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden bg-card border border-border">
        <div>
          {filteredLogs.map((log) => {
            const Icon = eventTypeIcons[log.eventType] || Activity;
            const isExpanded = expandedLog === log.id;
            const severityStyle = severityStyles[log.severity] || severityStyles.info;

            return (
              <div
                key={log.id}
                className="border-b border-border"
              >
                <button
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  className="w-full px-6 py-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        log.success ? 'bg-muted' : 'bg-danger-subtle'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          log.success ? 'text-muted-foreground' : 'text-danger-text'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-medium text-foreground">
                          {log.action}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${severityStyle.bg} ${severityStyle.text}`}
                        >
                          {log.severity}
                        </span>
                        {log.complianceFlags?.map((flag) => (
                          <span
                            key={flag}
                            className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-500"
                          >
                            {flag}
                          </span>
                        ))}
                        {!log.success && (
                          <span className="flex items-center gap-1 text-xs text-danger-text">
                            <XCircle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
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
                    <div className="flex-shrink-0 text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-4 pt-0">
                    <div className="ml-14 rounded-lg p-4 space-y-4 bg-muted border border-border">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                            Actor Details
                          </h4>
                          <dl className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Type:</dt>
                              <dd className="capitalize text-foreground">
                                {log.actor.type}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">ID:</dt>
                              <dd className="font-mono text-xs text-foreground">
                                {log.actor.id}
                              </dd>
                            </div>
                          </dl>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                            Resource
                          </h4>
                          <dl className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Type:</dt>
                              <dd className="capitalize text-foreground">
                                {log.resource.type}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Name:</dt>
                              <dd className="text-foreground">
                                {log.resource.name}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                          Event Details
                        </h4>
                        <pre className="text-xs rounded p-3 overflow-x-auto bg-card text-muted-foreground">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>

                      {log.userAgent && (
                        <div>
                          <h4 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                            User Agent
                          </h4>
                          <p className="text-xs font-mono text-muted-foreground">
                            {log.userAgent}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-card text-primary">
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
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2 text-foreground">
              No Events Found
            </h3>
            <p className="text-muted-foreground">
              {logs.length === 0
                ? 'No audit events have been recorded yet.'
                : 'No audit events match your current filters.'}
            </p>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} events
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted border border-border text-muted-foreground"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted border border-border text-muted-foreground"
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
