import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  FileType,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Trash2,
  RefreshCw,
  ChevronRight,
  Plus,
  Filter,
  LayoutGrid,
} from 'lucide-react';

type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';
type ExportFormat = 'csv' | 'xlsx' | 'json' | 'pdf';
type ExportSchedule = 'once' | 'daily' | 'weekly' | 'monthly';

interface ExportJob {
  id: string;
  collectionCode: string;
  collectionName: string;
  format: ExportFormat;
  status: ExportStatus;
  totalRows: number;
  processedRows: number;
  outputFileName?: string;
  outputUrl?: string;
  outputFileSize?: number;
  expiresAt?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface ExportDefinition {
  id: string;
  name: string;
  collectionCode: string;
  format: ExportFormat;
  schedule: ExportSchedule;
  columnsCount: number;
  filtersCount: number;
  isActive: boolean;
}

const mockJobs: ExportJob[] = [
  {
    id: '1',
    collectionCode: 'incident',
    collectionName: 'Incidents',
    format: 'xlsx',
    status: 'completed',
    totalRows: 1500,
    processedRows: 1500,
    outputFileName: 'incidents_export_20240115.xlsx',
    outputFileSize: 245000,
    expiresAt: '2024-01-22T10:00:00Z',
    createdAt: '2024-01-15T10:00:00Z',
    startedAt: '2024-01-15T10:01:00Z',
    completedAt: '2024-01-15T10:02:00Z',
  },
  {
    id: '2',
    collectionCode: 'asset',
    collectionName: 'Assets',
    format: 'csv',
    status: 'processing',
    totalRows: 10000,
    processedRows: 6500,
    createdAt: '2024-01-15T11:00:00Z',
    startedAt: '2024-01-15T11:01:00Z',
  },
  {
    id: '3',
    collectionCode: 'change_request',
    collectionName: 'Change Requests',
    format: 'pdf',
    status: 'failed',
    totalRows: 500,
    processedRows: 0,
    createdAt: '2024-01-14T15:00:00Z',
    startedAt: '2024-01-14T15:01:00Z',
    completedAt: '2024-01-14T15:01:30Z',
  },
];

const mockDefinitions: ExportDefinition[] = [
  { id: '1', name: 'Weekly Incident Report', collectionCode: 'incident', format: 'xlsx', schedule: 'weekly', columnsCount: 15, filtersCount: 3, isActive: true },
  { id: '2', name: 'Asset Inventory', collectionCode: 'asset', format: 'csv', schedule: 'monthly', columnsCount: 25, filtersCount: 2, isActive: true },
  { id: '3', name: 'Change Report', collectionCode: 'change_request', format: 'pdf', schedule: 'daily', columnsCount: 12, filtersCount: 5, isActive: false },
];

const statusConfig: Record<ExportStatus, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-slate-500 bg-slate-100', label: 'Pending' },
  processing: { icon: RefreshCw, color: 'text-amber-500 bg-amber-100', label: 'Processing' },
  completed: { icon: CheckCircle, color: 'text-green-500 bg-green-100', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500 bg-red-100', label: 'Failed' },
};

const formatIcons: Record<ExportFormat, React.ElementType> = {
  csv: FileText,
  xlsx: FileSpreadsheet,
  json: FileJson,
  pdf: FileType,
};

const scheduleLabels: Record<ExportSchedule, string> = {
  once: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ExportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'definitions'>('jobs');
  const [showNewExport, setShowNewExport] = useState(false);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Data Export
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Export collection data to various formats
          </p>
        </div>
        <button
          onClick={() => setShowNewExport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Export
        </button>
      </div>

      {/* Quick Export Modal */}
      {showNewExport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Quick Export
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Collection
                </label>
                <select className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                  <option value="">Select collection...</option>
                  <option value="incident">Incidents</option>
                  <option value="asset">Assets</option>
                  <option value="change_request">Change Requests</option>
                  <option value="user">Users</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Format
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['csv', 'xlsx', 'json', 'pdf'] as ExportFormat[]).map((format) => {
                    const Icon = formatIcons[format];
                    return (
                      <button
                        key={format}
                        className="flex flex-col items-center gap-1 p-3 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Icon className="h-6 w-6 text-slate-500" />
                        <span className="text-xs text-slate-600 dark:text-slate-300 uppercase">
                          {format}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4 py-2">
                <button className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                  <LayoutGrid className="h-4 w-4" />
                  Select Columns
                </button>
                <button className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                  <Filter className="h-4 w-4" />
                  Add Filters
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewExport(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                Start Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'jobs'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Export Jobs
        </button>
        <button
          onClick={() => setActiveTab('definitions')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'definitions'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Export Templates
        </button>
      </div>

      {/* Jobs Tab */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {mockJobs.map((job) => {
            const StatusIcon = statusConfig[job.status].icon;
            const FormatIcon = formatIcons[job.format];
            const progress = job.totalRows > 0 ? (job.processedRows / job.totalRows) * 100 : 0;

            return (
              <div
                key={job.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <FormatIcon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          {job.collectionName} Export
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig[job.status].color}`}>
                          <StatusIcon className={`h-3 w-3 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                          {statusConfig[job.status].label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {job.format.toUpperCase()} • {job.totalRows.toLocaleString()} rows
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(job.createdAt).toLocaleString()}
                        </span>
                        {job.outputFileSize && (
                          <span>{formatFileSize(job.outputFileSize)}</span>
                        )}
                        {job.expiresAt && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Calendar className="h-3 w-3" />
                            Expires {new Date(job.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === 'completed' && job.outputUrl && (
                      <button className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    )}
                    {job.status === 'pending' && (
                      <button className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Start">
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {job.status === 'processing' && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span>{job.processedRows.toLocaleString()} of {job.totalRows.toLocaleString()} rows</span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Definitions Tab */}
      {activeTab === 'definitions' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Collection</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Format</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Schedule</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Columns</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mockDefinitions.map((def) => (
                <tr key={def.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{def.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{def.collectionCode}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {def.format.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 text-sm">
                      <Calendar className="h-3 w-3" />
                      {scheduleLabels[def.schedule]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{def.columnsCount}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      def.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {def.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded" title="Run Now">
                        <Play className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="View Details">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
