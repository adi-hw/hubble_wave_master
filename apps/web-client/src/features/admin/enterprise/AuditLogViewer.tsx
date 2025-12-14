import React, { useState } from 'react';
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
} from 'lucide-react';

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

const mockAuditLogs: AuditEntry[] = [
  {
    id: '1',
    eventType: 'login',
    severity: 'info',
    actor: {
      id: 'u1',
      name: 'John Smith',
      email: 'john.smith@company.com',
      type: 'user',
    },
    resource: { type: 'session', id: 's1', name: 'User Session' },
    action: 'User logged in via SSO',
    details: { method: 'saml', provider: 'Corporate SAML' },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: '2024-01-15T14:30:00Z',
    success: true,
  },
  {
    id: '2',
    eventType: 'permission_change',
    severity: 'warning',
    actor: {
      id: 'u2',
      name: 'Admin User',
      email: 'admin@company.com',
      type: 'user',
    },
    resource: { type: 'user', id: 'u3', name: 'Jane Doe' },
    action: 'Elevated user permissions to Admin role',
    details: {
      previousRole: 'Editor',
      newRole: 'Admin',
      reason: 'Promotion request',
    },
    ipAddress: '10.0.0.50',
    timestamp: '2024-01-15T13:45:00Z',
    success: true,
    complianceFlags: ['SOX', 'PCI'],
  },
  {
    id: '3',
    eventType: 'export',
    severity: 'critical',
    actor: {
      id: 'u4',
      name: 'Data Analyst',
      email: 'analyst@company.com',
      type: 'user',
    },
    resource: { type: 'report', id: 'r1', name: 'Customer Data Export' },
    action: 'Exported sensitive customer data',
    details: { recordCount: 15000, format: 'csv', classification: 'pii' },
    ipAddress: '172.16.0.25',
    timestamp: '2024-01-15T12:00:00Z',
    success: true,
    complianceFlags: ['GDPR', 'HIPAA'],
  },
  {
    id: '4',
    eventType: 'login',
    severity: 'warning',
    actor: {
      id: 'u5',
      name: 'Unknown',
      email: 'unknown@external.com',
      type: 'user',
    },
    resource: { type: 'session', id: 's2', name: 'User Session' },
    action: 'Failed login attempt - Invalid credentials',
    details: { attempts: 3, lockoutTriggered: false },
    ipAddress: '203.0.113.45',
    timestamp: '2024-01-15T11:30:00Z',
    success: false,
  },
  {
    id: '5',
    eventType: 'delete',
    severity: 'critical',
    actor: {
      id: 'system',
      name: 'System',
      email: 'system@platform.local',
      type: 'system',
    },
    resource: { type: 'records', id: 'batch1', name: 'Archived Records' },
    action: 'Bulk deletion of archived records',
    details: { recordCount: 5000, retentionPolicy: '7-year', reason: 'auto' },
    ipAddress: '127.0.0.1',
    timestamp: '2024-01-15T02:00:00Z',
    success: true,
    complianceFlags: ['GDPR'],
  },
];

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

const severityColors: Record<AuditSeverity, string> = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  warning:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const AuditLogViewer: React.FC = () => {
  const [logs] = useState(mockAuditLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const filteredLogs = logs.filter((log) => {
    if (selectedSeverity !== 'all' && log.severity !== selectedSeverity)
      return false;
    if (selectedEventType !== 'all' && log.eventType !== selectedEventType)
      return false;
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

  const handleExport = () => {
    console.log('Exporting audit logs...');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Audit Log
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            View and analyze system activity and security events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {logs.length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Events
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {logs.filter((l) => l.severity === 'critical').length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Critical Events
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {logs.filter((l) => !l.success).length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Failed Actions
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {logs.filter((l) => l.complianceFlags?.length).length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Compliance Events
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            >
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
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
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
              }
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
              }
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {filteredLogs.map((log) => {
            const Icon = eventTypeIcons[log.eventType];
            const isExpanded = expandedLog === log.id;
            return (
              <div key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                <button
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  className="w-full px-6 py-4 text-left"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        log.success
                          ? 'bg-slate-100 dark:bg-slate-700'
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          log.success
                            ? 'text-slate-600 dark:text-slate-300'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {log.action}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[log.severity]}`}
                        >
                          {log.severity}
                        </span>
                        {log.complianceFlags?.map((flag) => (
                          <span
                            key={flag}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs font-medium"
                          >
                            {flag}
                          </span>
                        ))}
                        {!log.success && (
                          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <XCircle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
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
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-4 pt-0">
                    <div className="ml-14 bg-slate-50 dark:bg-slate-750 rounded-lg p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                            Actor Details
                          </h4>
                          <dl className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-slate-500 dark:text-slate-400">
                                Type:
                              </dt>
                              <dd className="text-slate-900 dark:text-white capitalize">
                                {log.actor.type}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-slate-500 dark:text-slate-400">
                                ID:
                              </dt>
                              <dd className="text-slate-900 dark:text-white font-mono text-xs">
                                {log.actor.id}
                              </dd>
                            </div>
                          </dl>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                            Resource
                          </h4>
                          <dl className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-slate-500 dark:text-slate-400">
                                Type:
                              </dt>
                              <dd className="text-slate-900 dark:text-white capitalize">
                                {log.resource.type}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-slate-500 dark:text-slate-400">
                                Name:
                              </dt>
                              <dd className="text-slate-900 dark:text-white">
                                {log.resource.name}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                          Event Details
                        </h4>
                        <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded p-3 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>

                      {log.userAgent && (
                        <div>
                          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                            User Agent
                          </h4>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                            {log.userAgent}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg">
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

        {filteredLogs.length === 0 && (
          <div className="p-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No Events Found
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              No audit events match your current filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
