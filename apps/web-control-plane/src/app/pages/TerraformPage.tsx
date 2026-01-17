import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Loader2,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Square,
  ChevronUp,
  X,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, TerraformJob, Customer } from '../services/api';

const statusConfig = {
  pending: { color: colors.text.muted, bg: colors.glass.medium, icon: Clock, label: 'Pending' },
  running: { color: colors.info.base, bg: colors.info.glow, icon: Loader2, label: 'Running' },
  completed: { color: colors.success.base, bg: colors.success.glow, icon: CheckCircle, label: 'Completed' },
  failed: { color: colors.danger.base, bg: colors.danger.glow, icon: XCircle, label: 'Failed' },
  cancelled: { color: colors.warning.base, bg: colors.warning.glow, icon: AlertTriangle, label: 'Cancelled' },
};

const typeConfig = {
  apply: { color: colors.success.base, label: 'Apply' },
  destroy: { color: colors.danger.base, label: 'Destroy' },
  plan: { color: colors.info.base, label: 'Plan' },
  refresh: { color: colors.warning.base, label: 'Refresh' },
};

const envConfig: Record<string, { color: string; bg: string }> = {
  production: { color: colors.success.base, bg: colors.success.glow },
  staging: { color: colors.warning.base, bg: colors.warning.glow },
  dev: { color: colors.info.base, bg: colors.info.glow },
};

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TerraformPage() {
  const [searchParams] = useSearchParams();
  const instanceId = searchParams.get('instanceId') || undefined;
  const [tabValue, setTabValue] = useState(0);
  const [jobs, setJobs] = useState<TerraformJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<TerraformJob | null>(null);
  const [showNewJobDialog, setShowNewJobDialog] = useState(false);
  const [autoScroll, _setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newJobData, setNewJobData] = useState({
    customerId: '',
    environment: 'dev',
    operation: 'plan',
    version: '',
  });
  const [creatingJob, setCreatingJob] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [jobsData, customersData] = await Promise.all([
        controlPlaneApi.getTerraformJobs(instanceId ? { instanceId } : undefined),
        controlPlaneApi.getCustomers({ limit: 100 }),
      ]);
      setJobs(jobsData.data);
      if (selectedJob) {
        const updated = jobsData.data.find((job) => job.id === selectedJob.id) || null;
        setSelectedJob(updated);
      }
      setCustomers(customersData.data);
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [instanceId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (jobs.some((j) => j.status === 'running' || j.status === 'pending')) {
        const data = await controlPlaneApi.getTerraformJobs(instanceId ? { instanceId } : undefined);
        setJobs(data.data);
        if (selectedJob) {
          const updated = data.data.find((j) => j.id === selectedJob.id);
          if (updated) setSelectedJob(updated);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [jobs, selectedJob, instanceId]);

  useEffect(() => {
    if (selectedJob?.status === 'running' && autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedJob?.output, autoScroll]);

  const handleCreateJob = async () => {
    try {
      setCreatingJob(true);
      await controlPlaneApi.createTerraformJob({
        customerId: newJobData.customerId,
        environment: newJobData.environment,
        operation: newJobData.operation,
        version: newJobData.version,
      });
      setShowNewJobDialog(false);
      const data = await controlPlaneApi.getTerraformJobs();
      setJobs(data.data);
      setNewJobData({ ...newJobData, customerId: '' });
    } catch (err: any) {
      console.error('Failed to create job:', err);
    } finally {
      setCreatingJob(false);
    }
  };

  const activeJobs = jobs.filter((j) => j.status === 'running' || j.status === 'pending');
  const recentJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');
  const handleDownloadLogs = () => {
    if (!selectedJob) return;
    const lines = (selectedJob.output || []).map((log) => {
      const time = log.time ? `[${log.time}]` : '';
      return `${time} ${log.level.toUpperCase()} ${log.message}`.trim();
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `terraform-${selectedJob.id}.log`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleCancelJob = async () => {
    if (!selectedJob) return;
    const confirmed = window.confirm('Stop this Terraform operation?');
    if (!confirmed) return;
    try {
      await controlPlaneApi.cancelTerraformJob(selectedJob.id);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to cancel job:', err);
    }
  };

  const renderJobRow = (job: TerraformJob) => {
    const status = statusConfig[job.status as keyof typeof statusConfig] || { icon: Clock, color: colors.text.muted, bg: colors.glass.medium, label: job.status };
    const type = typeConfig[job.operation as keyof typeof typeConfig] || { color: colors.text.secondary, label: job.operation };
    const env = envConfig[job.environment] || { color: colors.text.secondary, bg: colors.glass.medium };
    const StatusIcon = status.icon;

    return (
      <tr
        key={job.id}
        onClick={() => setSelectedJob(job)}
        className="cursor-pointer transition-colors"
        style={{
          borderTop: `1px solid ${colors.glass.border}`,
          backgroundColor: selectedJob?.id === job.id ? colors.glass.subtle : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (selectedJob?.id !== job.id) e.currentTarget.style.backgroundColor = colors.glass.subtle;
        }}
        onMouseLeave={(e) => {
          if (selectedJob?.id !== job.id) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusIcon
              size={16}
              style={{ color: status.color }}
              className={job.status === 'running' ? 'animate-spin' : ''}
            />
            <span
              className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{ backgroundColor: status.bg, color: status.color }}
            >
              {status.label}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span
            className="px-2 py-0.5 rounded text-xs font-semibold"
            style={{ backgroundColor: colors.glass.medium, color: type.color }}
          >
            {type.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
            {job.customerCode}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className="px-2 py-0.5 rounded text-xs font-semibold capitalize"
            style={{ backgroundColor: env.bg, color: env.color }}
          >
            {job.environment}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm" style={{ color: colors.text.muted }}>{job.region || '-'}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm" style={{ color: colors.text.muted }}>{job.version || 'latest'}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm" style={{ color: colors.text.secondary }}>{formatDate(job.createdAt)}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm font-mono" style={{ color: colors.text.secondary }}>
            {formatDuration(job.duration)}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
            Terraform Console
          </h1>
          <p className="text-sm mt-1" style={{ color: colors.text.tertiary }}>
            Manage infrastructure provisioning and deployments
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowNewJobDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
            }}
          >
            <Plus size={18} />
            New Job
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: Loader2, count: jobs.filter((j) => j.status === 'running').length, label: 'Running', color: colors.info.base },
          { icon: Clock, count: jobs.filter((j) => j.status === 'pending').length, label: 'Pending', color: colors.text.muted },
          { icon: CheckCircle, count: jobs.filter((j) => j.status === 'completed').length, label: 'Completed', color: colors.success.base },
          { icon: XCircle, count: jobs.filter((j) => j.status === 'failed').length, label: 'Failed', color: colors.danger.base },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 rounded-2xl border"
            style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
          >
            <div className="flex items-center gap-3">
              <stat.icon size={24} style={{ color: stat.color }} />
              <div>
                <div className="text-xl font-bold" style={{ color: colors.text.primary }}>
                  {stat.count}
                </div>
                <div className="text-sm" style={{ color: colors.text.secondary }}>
                  {stat.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-6">
        {/* Jobs List */}
        <div
          className={`rounded-2xl border overflow-hidden ${selectedJob ? '' : 'col-span-2'}`}
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: colors.glass.border }}>
            <button
              type="button"
              onClick={() => setTabValue(0)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                color: tabValue === 0 ? colors.text.primary : colors.text.secondary,
                borderBottom: tabValue === 0 ? `2px solid ${colors.brand.primary}` : '2px solid transparent',
              }}
            >
              <Loader2 size={14} />
              Active ({activeJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setTabValue(1)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                color: tabValue === 1 ? colors.text.primary : colors.text.secondary,
                borderBottom: tabValue === 1 ? `2px solid ${colors.brand.primary}` : '2px solid transparent',
              }}
            >
              <Clock size={14} />
              History ({recentJobs.length})
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: colors.glass.subtle }}>
                  {['Status', 'Type', 'Customer', 'Env', 'Region', 'Release ID', 'Started', 'Duration'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: colors.text.tertiary }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabValue === 0
                  ? activeJobs.length === 0
                    ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8" style={{ color: colors.text.secondary }}>
                          <CheckCircle size={32} style={{ margin: '0 auto 8px', color: colors.text.muted }} />
                          No active jobs
                        </td>
                      </tr>
                    )
                    : activeJobs.map(renderJobRow)
                  : recentJobs.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8" style={{ color: colors.text.secondary }}>
                        No operation history
                      </td>
                    </tr>
                  )
                  : recentJobs.map(renderJobRow)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Job Details */}
        {selectedJob && (
          <div
            className="rounded-2xl border overflow-hidden flex flex-col"
            style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border, maxHeight: 600 }}
          >
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${colors.glass.border}`, backgroundColor: colors.glass.subtle }}
            >
              <div>
                <h3 className="text-base font-semibold" style={{ color: colors.text.primary }}>
                  Operation Details
                </h3>
                <p className="text-xs font-mono" style={{ color: colors.text.tertiary }}>
                  ID: {selectedJob.id}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="p-1.5 rounded transition-colors"
                  title="Download Logs"
                  style={{ color: colors.text.muted }}
                  onClick={handleDownloadLogs}
                >
                  <Download size={16} />
                </button>
                {selectedJob.status === 'running' && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white"
                    style={{ backgroundColor: colors.danger.base }}
                    onClick={handleCancelJob}
                  >
                    <Square size={12} />
                    Stop
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: colors.text.muted }}
                >
                  <ChevronUp size={16} />
                </button>
              </div>
            </div>

            {/* Resources */}
            <div className="p-4" style={{ borderBottom: `1px solid ${colors.glass.border}` }}>
              <span className="text-xs font-semibold" style={{ color: colors.text.muted }}>Resources</span>
              <div className="flex gap-2 mt-2">
                <span
                  className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4caf50' }}
                >
                  +{selectedJob.plan?.add || 0}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', color: '#ff9800' }}
                >
                  ~{selectedJob.plan?.change || 0}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#f44336' }}
                >
                  -{selectedJob.plan?.destroy || 0}
                </span>
              </div>
            </div>

            {/* Logs */}
            <div
              className="flex-1 p-4 overflow-auto font-mono text-xs"
              style={{ backgroundColor: '#0d1117' }}
            >
              {selectedJob.output?.map((log, index) => (
                <div key={index} className="mb-1 flex gap-4">
                  <span style={{ color: colors.text.muted, opacity: 0.5, minWidth: 120 }}>{log.time}</span>
                  <span
                    style={{
                      color:
                        log.level === 'error'
                          ? colors.danger.base
                          : log.level === 'success'
                          ? colors.success.base
                          : log.level === 'add'
                          ? colors.success.light
                          : log.level === 'destroy'
                          ? colors.danger.light
                          : log.level === 'change'
                          ? colors.warning.light
                          : colors.text.secondary,
                    }}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              {(!selectedJob.output || selectedJob.output.length === 0) && (
                <p style={{ color: colors.text.muted, fontStyle: 'italic' }}>No logs available.</p>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* New Job Dialog */}
      {showNewJobDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60">
          <div
            className="w-full max-w-md p-6 rounded-2xl border"
            style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                New Terraform Operation
              </h2>
              <button
                type="button"
                onClick={() => setShowNewJobDialog(false)}
                className="p-1.5 rounded transition-colors"
                style={{ color: colors.text.muted }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Customer
                </label>
                <select
                  value={newJobData.customerId}
                  onChange={(e) => setNewJobData({ ...newJobData, customerId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Environment
                </label>
                <select
                  value={newJobData.environment}
                  onChange={(e) => setNewJobData({ ...newJobData, environment: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="dev">Dev</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Operation Type
                </label>
                <select
                  value={newJobData.operation}
                  onChange={(e) => setNewJobData({ ...newJobData, operation: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                >
                  <option value="plan">Plan</option>
                  <option value="apply">Apply</option>
                  <option value="refresh">Refresh</option>
                  <option value="destroy">Destroy</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Platform Release ID
                </label>
                <input
                  type="text"
                  value={newJobData.version}
                  onChange={(e) => setNewJobData({ ...newJobData, version: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                  placeholder="YYYYMMDD-<git-sha>"
                />
                <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                  Use the immutable platform release id for this operation.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowNewJobDialog(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateJob}
                disabled={creatingJob || !newJobData.customerId || !newJobData.version.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
                }}
              >
                {creatingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {creatingJob ? 'Starting...' : 'Start Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TerraformPage;
