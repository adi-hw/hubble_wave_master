import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  Server,
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, AuditLog } from '../services/api';

const categoryConfig: Record<string, { icon: any; color: string; label: string }> = {
  auth: { icon: Shield, color: colors.info.base, label: 'Authentication' },
  customer: { icon: User, color: colors.brand.primary, label: 'Customer' },
  instance: { icon: Server, color: colors.cyan.base, label: 'Instance' },
  system: { icon: Settings, color: colors.warning.base, label: 'System' },
  settings: { icon: Settings, color: colors.text.secondary, label: 'Settings' },
  license: { icon: Layers, color: colors.success.base, label: 'License' },
  terraform: { icon: Layers, color: colors.brand.secondary, label: 'Terraform' },
};

const severityConfig: Record<string, { icon: any; color: string; bg: string }> = {
  info: { icon: Info, color: colors.info.base, bg: colors.info.glow },
  warning: { icon: AlertTriangle, color: colors.warning.base, bg: colors.warning.glow },
  error: { icon: XCircle, color: colors.danger.base, bg: colors.danger.glow },
  critical: { icon: XCircle, color: colors.danger.base, bg: colors.danger.glow },
  success: { icon: CheckCircle, color: colors.success.base, bg: colors.success.glow },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatAction(action: string): string {
  return action
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .join(' > ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ info: 0, success: 0, warning: 0, error: 0 });

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await controlPlaneApi.getAuditLogs();
      setLogs(data.data);

      const newStats = { info: 0, success: 0, warning: 0, error: 0 };
      data.data.forEach((l) => {
        const k = l.severity === 'critical' ? 'error' : l.severity;
        if (k in newStats) newStats[k as keyof typeof newStats]++;
      });
      setStats(newStats);

      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !log.eventType.toLowerCase().includes(searchLower) &&
          !log.actor.toLowerCase().includes(searchLower) &&
          !log.target.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      if (categoryFilter !== 'all' && log.targetType !== categoryFilter) {
        return false;
      }

      if (severityFilter !== 'all' && log.severity !== severityFilter) {
        return false;
      }

      return true;
    });
  }, [logs, search, categoryFilter, severityFilter]);

  const paginatedLogs = filteredLogs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage);

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Action', 'Category', 'Severity', 'Actor', 'Target', 'Description'].join(','),
      ...filteredLogs.map((log) =>
        [
          log.createdAt,
          log.eventType,
          log.targetType,
          log.severity,
          log.actor,
          log.target,
          `"${log.description}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const clearFilters = () => {
    setCategoryFilter('all');
    setSeverityFilter('all');
    setDateRange('7d');
    setSearch('');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: colors.text.primary }}>
          Audit Logs
        </h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div
        className="rounded-2xl border mb-6"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        <div className="p-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: colors.text.muted }}
              />
              <input
                type="text"
                placeholder="Search by action, actor, or resource..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm"
                style={{
                  backgroundColor: colors.glass.medium,
                  borderColor: colors.glass.border,
                  color: colors.text.primary,
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: showFilters ? colors.brand.primary : 'transparent',
                borderColor: showFilters ? colors.brand.primary : colors.glass.border,
                border: '1px solid',
                color: showFilters ? '#fff' : colors.text.secondary,
              }}
            >
              <Filter size={16} />
              Filters
            </button>
          </div>

          {/* Collapsible Filters */}
          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: showFilters ? '200px' : '0' }}
          >
            <div
              className="mt-4 pt-4 grid grid-cols-4 gap-4"
              style={{ borderTop: `1px solid ${colors.glass.border}` }}
            >
              <div>
                <label className="block text-xs mb-1.5" style={{ color: colors.text.muted }}>
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                >
                  <option value="all">All Categories</option>
                  <option value="auth">Authentication</option>
                  <option value="customer">Customer</option>
                  <option value="instance">Instance</option>
                  <option value="system">System</option>
                  <option value="settings">Settings</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: colors.text.muted }}>
                  Severity
                </label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                >
                  <option value="all">All Severities</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: colors.text.muted }}>
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                >
                  <option value="1h">Last Hour</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ color: colors.text.secondary }}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: Info, label: 'Info Events', value: stats.info, color: colors.info.base, bg: colors.info.glow },
          { icon: CheckCircle, label: 'Success Events', value: stats.success, color: colors.success.base, bg: colors.success.glow },
          { icon: AlertTriangle, label: 'Warnings', value: stats.warning, color: colors.warning.base, bg: colors.warning.glow },
          { icon: XCircle, label: 'Errors', value: stats.error, color: colors.danger.base, bg: colors.danger.glow },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 rounded-2xl border"
            style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg" style={{ backgroundColor: stat.bg }}>
                <stat.icon size={20} style={{ color: stat.color }} />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: colors.text.primary }}>
                  {stat.value}
                </div>
                <div className="text-xs" style={{ color: colors.text.tertiary }}>
                  {stat.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Logs Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: colors.glass.subtle }}>
                {['', 'Timestamp', 'Event', 'Target Type', 'Severity', 'Actor', 'Target'].map((h, i) => (
                  <th
                    key={h || i}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: colors.text.tertiary, width: i === 0 ? '40px' : 'auto' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.brand.primary }} />
                      <span style={{ color: colors.text.secondary }}>Loading logs...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: colors.danger.base }}>
                    {error}
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: colors.text.secondary }}>
                    No logs found
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const category = categoryConfig[log.targetType] || {
                    icon: Info,
                    color: colors.text.secondary,
                    label: log.targetType,
                  };
                  const severity = severityConfig[log.severity] || {
                    icon: Info,
                    color: colors.text.secondary,
                    bg: colors.glass.medium,
                  };
                  const CategoryIcon = category.icon;
                  const SeverityIcon = severity.icon;
                  const isExpanded = expandedRow === log.id;

                  return (
                    <tr key={log.id}>
                      <td colSpan={7} className="p-0">
                        {/* Main Row */}
                        <div
                          className="flex items-center cursor-pointer transition-colors px-4 py-3"
                          style={{ borderBottom: `1px solid ${colors.glass.border}` }}
                          onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.glass.subtle)}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div style={{ width: '40px' }}>
                            <button type="button" className="p-1" style={{ color: colors.text.muted }}>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                          <div className="flex-1 grid grid-cols-6 gap-4 items-center">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} style={{ color: colors.text.muted }} />
                              <span
                                className="text-sm font-mono"
                                style={{ color: colors.text.secondary }}
                              >
                                {formatDate(log.createdAt)}
                              </span>
                            </div>
                            <div>
                              <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                                {formatAction(log.eventType)}
                              </span>
                            </div>
                            <div>
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium capitalize"
                                style={{ backgroundColor: colors.glass.medium, color: category.color }}
                              >
                                <CategoryIcon size={12} />
                                {category.label}
                              </span>
                            </div>
                            <div>
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium capitalize"
                                style={{ backgroundColor: severity.bg, color: severity.color }}
                              >
                                <SeverityIcon size={12} />
                                {log.severity}
                              </span>
                            </div>
                            <div title={log.actorType}>
                              <span className="text-sm" style={{ color: colors.text.secondary }}>
                                {log.actor}
                              </span>
                            </div>
                            <div>
                              <span className="text-sm" style={{ color: colors.text.secondary }}>
                                {log.target}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        <div
                          className="overflow-hidden transition-all duration-200"
                          style={{ maxHeight: isExpanded ? '500px' : '0' }}
                        >
                          <div
                            className="p-4 mx-4 my-2 rounded-lg"
                            style={{ backgroundColor: colors.glass.subtle }}
                          >
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <span className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                                  Description
                                </span>
                                <span className="text-sm" style={{ color: colors.text.secondary }}>
                                  {log.description}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                                  Metadata
                                </span>
                                <pre
                                  className="text-xs p-2 rounded overflow-auto font-mono"
                                  style={{
                                    backgroundColor: colors.glass.medium,
                                    color: colors.text.secondary,
                                  }}
                                >
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: `1px solid ${colors.glass.border}` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: colors.text.secondary }}>
              Rows per page:
            </span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              className="px-2 py-1 rounded border text-sm"
              style={{
                backgroundColor: colors.glass.medium,
                borderColor: colors.glass.border,
                color: colors.text.primary,
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: colors.text.secondary }}>
              {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, filteredLogs.length)} of{' '}
              {filteredLogs.length}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
                className="p-1.5 rounded transition-colors disabled:opacity-50"
                style={{ color: colors.text.secondary }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded transition-colors disabled:opacity-50"
                style={{ color: colors.text.secondary }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditPage;
