/**
 * Sync Dashboard Page
 * HubbleWave Platform - Phase 5
 *
 * Monitor and manage data synchronization jobs.
 */

import { useState } from 'react';
import { GlassCard } from '../../components/ui/glass/GlassCard';

type SyncStatus = 'running' | 'success' | 'failed' | 'paused' | 'scheduled';
type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';

interface SyncJob {
  id: string;
  name: string;
  connectorType: string;
  connectorName: string;
  direction: SyncDirection;
  status: SyncStatus;
  lastRun: Date | null;
  nextRun: Date | null;
  recordsProcessed: number;
  recordsFailed: number;
  duration: number;
  schedule: string;
}

interface SyncRun {
  id: string;
  jobId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: SyncStatus;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: string[];
}

const MOCK_SYNC_JOBS: SyncJob[] = [
  {
    id: 'sync-1',
    name: 'Salesforce Accounts Sync',
    connectorType: 'salesforce',
    connectorName: 'Salesforce Production',
    direction: 'bidirectional',
    status: 'success',
    lastRun: new Date(Date.now() - 3600000),
    nextRun: new Date(Date.now() + 3600000),
    recordsProcessed: 1234,
    recordsFailed: 2,
    duration: 45,
    schedule: '0 * * * *',
  },
  {
    id: 'sync-2',
    name: 'Jira Issues Sync',
    connectorType: 'jira',
    connectorName: 'Jira Cloud',
    direction: 'inbound',
    status: 'running',
    lastRun: new Date(Date.now() - 1800000),
    nextRun: null,
    recordsProcessed: 567,
    recordsFailed: 0,
    duration: 0,
    schedule: '*/30 * * * *',
  },
  {
    id: 'sync-3',
    name: 'ServiceNow Incidents',
    connectorType: 'servicenow',
    connectorName: 'ServiceNow Dev',
    direction: 'bidirectional',
    status: 'failed',
    lastRun: new Date(Date.now() - 7200000),
    nextRun: new Date(Date.now() + 1800000),
    recordsProcessed: 0,
    recordsFailed: 0,
    duration: 5,
    schedule: '0 */2 * * *',
  },
];

const MOCK_SYNC_RUNS: SyncRun[] = [
  {
    id: 'run-1',
    jobId: 'sync-1',
    startedAt: new Date(Date.now() - 3600000),
    completedAt: new Date(Date.now() - 3555000),
    status: 'success',
    recordsProcessed: 1234,
    recordsCreated: 45,
    recordsUpdated: 189,
    recordsFailed: 2,
    errors: ['Duplicate key constraint for record #567'],
  },
  {
    id: 'run-2',
    jobId: 'sync-1',
    startedAt: new Date(Date.now() - 7200000),
    completedAt: new Date(Date.now() - 7150000),
    status: 'success',
    recordsProcessed: 1230,
    recordsCreated: 12,
    recordsUpdated: 218,
    recordsFailed: 0,
    errors: [],
  },
];

export function SyncDashboardPage() {
  const [selectedJob, setSelectedJob] = useState<SyncJob | null>(null);
  const [, setShowCreateModal] = useState(false);

  const getStatusClasses = (status: SyncStatus): { bg: string; text: string } => {
    const classes: Record<SyncStatus, { bg: string; text: string }> = {
      running: { bg: 'bg-info-subtle', text: 'text-info-text' },
      success: { bg: 'bg-success-subtle', text: 'text-success-text' },
      failed: { bg: 'bg-danger-subtle', text: 'text-danger-text' },
      paused: { bg: 'bg-muted', text: 'text-muted-foreground' },
      scheduled: { bg: 'bg-warning-subtle', text: 'text-warning-text' },
    };
    return classes[status];
  };

  const getStatusLabel = (status: SyncStatus): string => {
    const labels: Record<SyncStatus, string> = {
      running: 'Running',
      success: 'Success',
      failed: 'Failed',
      paused: 'Paused',
      scheduled: 'Scheduled',
    };
    return labels[status];
  };

  const getDirectionIcon = (direction: SyncDirection): string => {
    const icons: Record<SyncDirection, string> = {
      inbound: '←',
      outbound: '→',
      bidirectional: '↔',
    };
    return icons[direction];
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatRelativeTime = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const overallStats = {
    totalJobs: MOCK_SYNC_JOBS.length,
    activeJobs: MOCK_SYNC_JOBS.filter((j) => j.status === 'running').length,
    successRate: 85,
    recordsSynced: MOCK_SYNC_JOBS.reduce((acc, j) => acc + j.recordsProcessed, 0),
  };

  return (
    <div className="sync-dashboard">
      <header className="page-header">
        <div>
          <h1 className="page-title">Sync Dashboard</h1>
          <p className="page-description">Monitor and manage data synchronization jobs</p>
        </div>
        <button className="button button--primary" onClick={() => setShowCreateModal(true)}>
          + New Sync Job
        </button>
      </header>

      <div className="stats-grid">
        <GlassCard className="stat-card">
          <div className="stat-icon stat-icon--blue">⚡</div>
          <div className="stat-content">
            <span className="stat-value">{overallStats.totalJobs}</span>
            <span className="stat-label">Total Sync Jobs</span>
          </div>
        </GlassCard>
        <GlassCard className="stat-card">
          <div className="stat-icon stat-icon--green">●</div>
          <div className="stat-content">
            <span className="stat-value">{overallStats.activeJobs}</span>
            <span className="stat-label">Currently Running</span>
          </div>
        </GlassCard>
        <GlassCard className="stat-card">
          <div className="stat-icon stat-icon--purple">✓</div>
          <div className="stat-content">
            <span className="stat-value">{overallStats.successRate}%</span>
            <span className="stat-label">Success Rate (24h)</span>
          </div>
        </GlassCard>
        <GlassCard className="stat-card">
          <div className="stat-icon stat-icon--orange">↔</div>
          <div className="stat-content">
            <span className="stat-value">{overallStats.recordsSynced.toLocaleString()}</span>
            <span className="stat-label">Records Synced (24h)</span>
          </div>
        </GlassCard>
      </div>

      <div className="dashboard-content">
        <GlassCard className="jobs-list-card">
          <div className="card-header">
            <h2>Sync Jobs</h2>
            <div className="filter-group">
              <select className="filter-select">
                <option>All Status</option>
                <option>Running</option>
                <option>Success</option>
                <option>Failed</option>
              </select>
              <select className="filter-select">
                <option>All Connectors</option>
                <option>Salesforce</option>
                <option>Jira</option>
                <option>ServiceNow</option>
              </select>
            </div>
          </div>

          <div className="jobs-list">
            {MOCK_SYNC_JOBS.map((job) => (
              <div
                key={job.id}
                className={`job-item ${selectedJob?.id === job.id ? 'job-item--selected' : ''}`}
                onClick={() => setSelectedJob(job)}
              >
                <div className="job-main">
                  <div className="job-info">
                    <span className="job-name">{job.name}</span>
                    <span className="job-connector">{job.connectorName}</span>
                  </div>
                  <div className="job-meta">
                    <span
                      className={`status-badge ${getStatusClasses(job.status).bg} ${getStatusClasses(job.status).text}`}
                    >
                      {job.status === 'running' && <span className="pulse-dot"></span>}
                      {getStatusLabel(job.status)}
                    </span>
                    <span className="direction-badge">{getDirectionIcon(job.direction)}</span>
                  </div>
                </div>
                <div className="job-stats">
                  <div className="job-stat">
                    <span className="job-stat-label">Last Run</span>
                    <span className="job-stat-value">
                      {job.lastRun ? formatRelativeTime(job.lastRun) : 'Never'}
                    </span>
                  </div>
                  <div className="job-stat">
                    <span className="job-stat-label">Records</span>
                    <span className="job-stat-value">{job.recordsProcessed.toLocaleString()}</span>
                  </div>
                  <div className="job-stat">
                    <span className="job-stat-label">Duration</span>
                    <span className="job-stat-value">
                      {job.status === 'running' ? 'In progress' : formatDuration(job.duration)}
                    </span>
                  </div>
                </div>
                <div className="job-actions">
                  <button
                    className="action-button"
                    title={job.status === 'running' ? 'Pause' : 'Run Now'}
                  >
                    {job.status === 'running' ? '⏸' : '▶'}
                  </button>
                  <button className="action-button" title="Configure">
                    ⚙
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="job-details-card">
          {selectedJob ? (
            <>
              <div className="detail-header">
                <h2>{selectedJob.name}</h2>
                <div className="detail-actions">
                  <button className="button button--secondary button--sm">Edit</button>
                  <button className="button button--primary button--sm">Run Now</button>
                </div>
              </div>

              <div className="detail-section">
                <h3>Configuration</h3>
                <div className="config-grid">
                  <div className="config-item">
                    <span className="config-label">Connector</span>
                    <span className="config-value">{selectedJob.connectorName}</span>
                  </div>
                  <div className="config-item">
                    <span className="config-label">Direction</span>
                    <span className="config-value">
                      {getDirectionIcon(selectedJob.direction)} {selectedJob.direction}
                    </span>
                  </div>
                  <div className="config-item">
                    <span className="config-label">Schedule</span>
                    <span className="config-value">{selectedJob.schedule} (Every hour)</span>
                  </div>
                  <div className="config-item">
                    <span className="config-label">Next Run</span>
                    <span className="config-value">
                      {selectedJob.nextRun
                        ? selectedJob.nextRun.toLocaleTimeString()
                        : 'Not scheduled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Recent Runs</h3>
                <div className="runs-list">
                  {MOCK_SYNC_RUNS.filter((r) => r.jobId === selectedJob.id).map((run) => (
                    <div key={run.id} className="run-item">
                      <div className="run-header">
                        <span
                          className={`status-badge ${getStatusClasses(run.status).bg} ${getStatusClasses(run.status).text}`}
                        >
                          {getStatusLabel(run.status)}
                        </span>
                        <span className="run-time">{formatRelativeTime(run.startedAt)}</span>
                      </div>
                      <div className="run-stats">
                        <span className="run-stat">
                          <strong>{run.recordsProcessed}</strong> processed
                        </span>
                        <span className="run-stat run-stat--success">
                          <strong>{run.recordsCreated}</strong> created
                        </span>
                        <span className="run-stat run-stat--info">
                          <strong>{run.recordsUpdated}</strong> updated
                        </span>
                        {run.recordsFailed > 0 && (
                          <span className="run-stat run-stat--error">
                            <strong>{run.recordsFailed}</strong> failed
                          </span>
                        )}
                      </div>
                      {run.errors.length > 0 && (
                        <div className="run-errors">
                          {run.errors.map((err, i) => (
                            <div key={i} className="error-item">
                              {err}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>Select a sync job to view details</p>
            </div>
          )}
        </GlassCard>
      </div>

      <style>{`
        .sync-dashboard {
          padding: 2rem;
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .page-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
          color: var(--text-primary);
        }

        .page-description {
          color: var(--text-secondary);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }

        .stat-icon--blue { background: var(--bg-info-subtle); color: var(--text-info); }
        .stat-icon--green { background: var(--bg-success-subtle); color: var(--text-success); }
        .stat-icon--purple { background: var(--bg-primary-subtle); color: var(--text-brand); }
        .stat-icon--orange { background: var(--bg-warning-subtle); color: var(--text-warning); }

        .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .dashboard-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .jobs-list-card, .job-details-card {
          padding: 1.5rem;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .card-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .filter-group {
          display: flex;
          gap: 0.5rem;
        }

        .filter-select {
          padding: 0.5rem;
          border: 1px solid var(--border-default);
          border-radius: 6px;
          font-size: 0.875rem;
          background: var(--bg-surface);
          color: var(--text-primary);
        }

        .jobs-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .job-item {
          padding: 1rem;
          border: 1px solid var(--border-default);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          background: var(--bg-surface);
        }

        .job-item:hover {
          border-color: var(--border-primary);
          background: var(--bg-hover);
        }

        .job-item--selected {
          border-color: var(--border-primary);
          background: var(--bg-primary-subtle);
        }

        .job-main {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .job-name {
          display: block;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .job-connector {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .job-meta {
          display: flex;
          gap: 0.5rem;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          background: currentColor;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .direction-badge {
          padding: 0.25rem 0.5rem;
          background: var(--bg-surface-secondary);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .job-stats {
          display: flex;
          gap: 1.5rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border-subtle);
        }

        .job-stat-label {
          display: block;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .job-stat-value {
          font-weight: 500;
        }

        .job-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .action-button {
          padding: 0.5rem;
          border: 1px solid var(--border-default);
          border-radius: 6px;
          background: var(--bg-surface);
          cursor: pointer;
          color: var(--text-secondary);
        }

        .action-button:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .detail-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .detail-actions {
          display: flex;
          gap: 0.5rem;
        }

        .detail-section {
          margin-bottom: 1.5rem;
        }

        .detail-section h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .config-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .config-item {
          padding: 0.75rem;
          background: var(--bg-surface-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
        }

        .config-label {
          display: block;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-bottom: 0.25rem;
        }

        .config-value {
          font-weight: 500;
        }

        .runs-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .run-item {
          padding: 1rem;
          background: var(--bg-surface-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
        }

        .run-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .run-time {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .run-stats {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .run-stat {
          font-size: 0.875rem;
        }

        .run-stat--success { color: var(--text-success); }
        .run-stat--info { color: var(--text-info); }
        .run-stat--error { color: var(--text-danger); }

        .run-errors {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border-subtle);
        }

        .error-item {
          font-size: 0.875rem;
          color: var(--text-danger);
          padding: 0.5rem;
          background: var(--bg-danger-subtle);
          border: 1px solid var(--border-danger);
          border-radius: 4px;
        }

        .no-selection {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: var(--text-secondary);
        }

        .button {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
        }

        .button--sm {
          padding: 0.5rem 1rem;
        }

        .button--primary {
          background: var(--gradient-brand);
          color: var(--text-on-primary);
          box-shadow: var(--shadow-primary);
        }

        .button--primary:hover {
          background: var(--gradient-brand-hover);
        }

        .button--secondary {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
        }

        .button--secondary:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
