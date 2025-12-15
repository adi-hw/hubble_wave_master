import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import metadataApi from '../../../services/metadataApi';

interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName?: string;
  workflowCode?: string;
  triggerType?: string;
  triggerSource?: Record<string, unknown>;
  status: string;
  currentStepId?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  errorMessage?: string;
  retryCount: number;
  correlationId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: string }> = {
  pending: { color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  queued: { color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  running: { color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  waiting: { color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  paused: { color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  completed: { color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  succeeded: { color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  failed: { color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
  cancelled: { color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  timed_out: { color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
};

export function WorkflowRunsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || '');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRuns();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchRuns, 10000);
    return () => clearInterval(interval);
  }, [filterStatus]);

  const fetchRuns = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);

      const response = await metadataApi.get<WorkflowRun[] | { data: WorkflowRun[] }>(`/admin/workflows/runs?${params.toString()}`);
      // Handle both array response and wrapped { data: [...] } response
      const data = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
      setRuns(data);
    } catch (error) {
      console.error('Failed to fetch workflow runs:', error);
      setRuns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRuns();
  };

  const handleStatusFilter = (status: string) => {
    setFilterStatus(status);
    if (status) {
      setSearchParams({ status });
    } else {
      setSearchParams({});
    }
  };

  const cancelRun = async (run: WorkflowRun) => {
    if (!confirm('Are you sure you want to cancel this workflow run?')) return;

    try {
      await metadataApi.post(`/admin/workflows/runs/${run.id}/cancel`);
      fetchRuns();
    } catch (error) {
      console.error('Failed to cancel workflow run:', error);
    }
  };

  const retryRun = async (run: WorkflowRun) => {
    try {
      await metadataApi.post(`/admin/workflows/runs/${run.id}/retry`);
      fetchRuns();
    } catch (error) {
      console.error('Failed to retry workflow run:', error);
    }
  };

  const filteredRuns = runs.filter(run => {
    const matchesSearch = !search ||
      run.id.toLowerCase().includes(search.toLowerCase()) ||
      run.workflowName?.toLowerCase().includes(search.toLowerCase()) ||
      run.workflowCode?.toLowerCase().includes(search.toLowerCase()) ||
      run.correlationId?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return '-';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const duration = end - start;

    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    if (duration < 3600000) return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
    return `${Math.floor(duration / 3600000)}h ${Math.floor((duration % 3600000) / 60000)}m`;
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Workflow Runs
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor and manage workflow executions
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Status Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleStatusFilter('')}
          className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            !filterStatus
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          All
        </button>
        {Object.entries(STATUS_CONFIG).map(([status, { color, bgColor }]) => (
          <button
            key={status}
            onClick={() => handleStatusFilter(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              filterStatus === status
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : `${bgColor} ${color} hover:opacity-80`
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Search */}
      <Card>
        <div className="p-4">
          <Input
            placeholder="Search by ID, workflow name, or correlation ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
      </Card>

      {/* Runs List */}
      {filteredRuns.length === 0 ? (
        <EmptyState
          title="No workflow runs found"
          description={search || filterStatus
            ? "Try adjusting your filters"
            : "Workflow runs will appear here when workflows are executed"}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Workflow
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRuns.map(run => {
                  const statusConfig = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;

                  return (
                    <tr
                      key={run.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                      onClick={() => navigate(`/studio/workflows/runs/${run.id}`)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={statusConfig.icon} />
                          </svg>
                          {run.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {run.workflowName || run.workflowCode || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {run.id.slice(0, 8)}...
                          {run.correlationId && (
                            <span className="ml-2">corr: {run.correlationId.slice(0, 8)}...</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {run.triggerType || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {formatTime(run.startedAt || run.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                          {formatDuration(run.startedAt, run.completedAt)}
                        </span>
                        {run.retryCount > 0 && (
                          <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                            ({run.retryCount} retries)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          {['running', 'waiting', 'paused'].includes(run.status) && (
                            <button
                              onClick={() => cancelRun(run)}
                              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                              title="Cancel"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          {run.status === 'failed' && (
                            <button
                              onClick={() => retryRun(run)}
                              className="text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400"
                              title="Retry"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/studio/workflows/runs/${run.id}`)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="View Details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
