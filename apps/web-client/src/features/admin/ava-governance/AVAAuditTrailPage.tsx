import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Bot,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Navigation,
  Plus,
  Edit,
  Trash2,
  Zap,
} from 'lucide-react';

type AVAActionType = 'create' | 'update' | 'delete' | 'execute' | 'navigate';
type AVAActionStatus = 'pending' | 'completed' | 'failed' | 'reverted' | 'rejected';

interface AVAAuditEntry {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  conversationId?: string;
  userMessage?: string;
  avaResponse?: string;
  actionType: AVAActionType;
  status: AVAActionStatus;
  actionLabel: string;
  actionTarget: string;
  targetCollection?: string;
  targetRecordId?: string;
  targetDisplayValue?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  isRevertible: boolean;
  revertedAt?: string;
  revertedBy?: string;
  revertReason?: string;
  errorMessage?: string;
  durationMs?: number;
  createdAt: string;
  completedAt?: string;
}

interface AuditStats {
  totalActions: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  revertedCount: number;
  failedCount: number;
}

const actionTypeIcons: Record<AVAActionType, React.ElementType> = {
  navigate: Navigation,
  create: Plus,
  update: Edit,
  delete: Trash2,
  execute: Zap,
};

const statusColors: Record<AVAActionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  reverted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  rejected: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const statusIcons: Record<AVAActionStatus, React.ElementType> = {
  pending: Clock,
  completed: CheckCircle,
  failed: XCircle,
  reverted: RotateCcw,
  rejected: AlertTriangle,
};

export const AVAAuditTrailPage: React.FC = () => {
  const [entries, setEntries] = useState<AVAAuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [revertingId, setRevertingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditTrail();
    fetchStats();
  }, [selectedStatus, selectedActionType, dateRange]);

  const fetchAuditTrail = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedActionType !== 'all') params.append('actionType', selectedActionType);
      if (dateRange.start) params.append('fromDate', dateRange.start);
      if (dateRange.end) params.append('toDate', dateRange.end);
      params.append('limit', '50');

      const response = await fetch(`/api/ava/admin/audit?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (error) {
      console.error('Failed to fetch audit trail:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/ava/admin/audit/stats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleRevert = async (entryId: string) => {
    if (!confirm('Are you sure you want to revert this action? This will restore the previous state.')) {
      return;
    }

    setRevertingId(entryId);
    try {
      const response = await fetch(`/api/ava/admin/audit/${entryId}/revert`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Admin initiated revert' }),
      });
      const result = await response.json();
      if (result.success) {
        fetchAuditTrail();
        fetchStats();
      } else {
        alert(`Revert failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Revert failed:', error);
      alert('Failed to revert action');
    } finally {
      setRevertingId(null);
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['ID', 'User', 'Action Type', 'Status', 'Label', 'Target', 'Collection', 'Created At'].join(','),
      ...entries.map(e => [
        e.id,
        e.userName || e.userId,
        e.actionType,
        e.status,
        `"${e.actionLabel}"`,
        `"${e.actionTarget}"`,
        e.targetCollection || '',
        e.createdAt,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ava-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredEntries = entries.filter((entry) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        entry.actionLabel.toLowerCase().includes(query) ||
        entry.userName?.toLowerCase().includes(query) ||
        entry.actionTarget.toLowerCase().includes(query) ||
        entry.targetCollection?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              AVA Audit Trail
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Track and manage all actions performed by AVA
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchAuditTrail(); fetchStats(); }}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
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
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {stats.totalActions}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Actions</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {stats.byStatus['completed'] || 0}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Completed</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {stats.failedCount}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Failed</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {stats.revertedCount}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Reverted</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {stats.byStatus['rejected'] || 0}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Rejected</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="reverted">Reverted</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            >
              <option value="all">All Action Types</option>
              <option value="navigate">Navigate</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="execute">Execute</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Entries List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-8 w-8 mx-auto text-slate-400 animate-spin mb-4" />
            <p className="text-slate-500 dark:text-slate-400">Loading audit trail...</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredEntries.map((entry) => {
              const ActionIcon = actionTypeIcons[entry.actionType];
              const StatusIcon = statusIcons[entry.status];
              const isExpanded = expandedEntry === entry.id;

              return (
                <div key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                  <button
                    onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                    className="w-full px-6 py-4 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        entry.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                        entry.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30' :
                        entry.status === 'reverted' ? 'bg-purple-100 dark:bg-purple-900/30' :
                        'bg-slate-100 dark:bg-slate-700'
                      }`}>
                        <ActionIcon className={`h-5 w-5 ${
                          entry.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                          entry.status === 'failed' ? 'text-red-600 dark:text-red-400' :
                          entry.status === 'reverted' ? 'text-purple-600 dark:text-purple-400' :
                          'text-slate-600 dark:text-slate-300'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {entry.actionLabel}
                          </p>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${statusColors[entry.status]}`}>
                            <StatusIcon className="h-3 w-3" />
                            {entry.status}
                          </span>
                          {entry.isRevertible && entry.status === 'completed' && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs font-medium">
                              Revertible
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {entry.userName || entry.userId}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                          {entry.durationMs && (
                            <>
                              <span>•</span>
                              <span>{entry.durationMs}ms</span>
                            </>
                          )}
                          {entry.targetCollection && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-xs">{entry.targetCollection}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {entry.isRevertible && entry.status === 'completed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRevert(entry.id); }}
                            disabled={revertingId === entry.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg disabled:opacity-50"
                          >
                            <RotateCcw className={`h-4 w-4 ${revertingId === entry.id ? 'animate-spin' : ''}`} />
                            Revert
                          </button>
                        )}
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
                        {entry.userMessage && (
                          <div>
                            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                              User Request
                            </h4>
                            <p className="text-sm text-slate-700 dark:text-slate-300 bg-blue-50 dark:bg-blue-900/20 rounded p-3">
                              "{entry.userMessage}"
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                              Action Details
                            </h4>
                            <dl className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <dt className="text-slate-500 dark:text-slate-400">Target:</dt>
                                <dd className="text-slate-900 dark:text-white font-mono text-xs">{entry.actionTarget}</dd>
                              </div>
                              {entry.targetCollection && (
                                <div className="flex justify-between">
                                  <dt className="text-slate-500 dark:text-slate-400">Collection:</dt>
                                  <dd className="text-slate-900 dark:text-white">{entry.targetCollection}</dd>
                                </div>
                              )}
                              {entry.targetRecordId && (
                                <div className="flex justify-between">
                                  <dt className="text-slate-500 dark:text-slate-400">Record ID:</dt>
                                  <dd className="text-slate-900 dark:text-white font-mono text-xs">{entry.targetRecordId}</dd>
                                </div>
                              )}
                            </dl>
                          </div>
                          {entry.revertedAt && (
                            <div>
                              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                Revert Information
                              </h4>
                              <dl className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <dt className="text-slate-500 dark:text-slate-400">Reverted At:</dt>
                                  <dd className="text-slate-900 dark:text-white">{new Date(entry.revertedAt).toLocaleString()}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-slate-500 dark:text-slate-400">Reverted By:</dt>
                                  <dd className="text-slate-900 dark:text-white">{entry.revertedBy}</dd>
                                </div>
                                {entry.revertReason && (
                                  <div className="flex justify-between">
                                    <dt className="text-slate-500 dark:text-slate-400">Reason:</dt>
                                    <dd className="text-slate-900 dark:text-white">{entry.revertReason}</dd>
                                  </div>
                                )}
                              </dl>
                            </div>
                          )}
                        </div>

                        {entry.errorMessage && (
                          <div>
                            <h4 className="text-xs font-medium text-red-500 uppercase tracking-wide mb-2">
                              Error Message
                            </h4>
                            <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded p-3">
                              {entry.errorMessage}
                            </p>
                          </div>
                        )}

                        {(entry.beforeData || entry.afterData) && (
                          <div className="grid grid-cols-2 gap-4">
                            {entry.beforeData && Object.keys(entry.beforeData).length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                  Before Data
                                </h4>
                                <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded p-3 overflow-x-auto">
                                  {JSON.stringify(entry.beforeData, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.afterData && Object.keys(entry.afterData).length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                  After Data
                                </h4>
                                <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded p-3 overflow-x-auto">
                                  {JSON.stringify(entry.afterData, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && filteredEntries.length === 0 && (
          <div className="p-12 text-center">
            <Bot className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No Actions Found
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              No AVA actions match your current filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
