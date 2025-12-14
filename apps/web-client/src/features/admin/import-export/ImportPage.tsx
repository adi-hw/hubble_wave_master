import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileJson,
  FileText,
  Play,
  Pause,
  XCircle,
  CheckCircle,
  Clock,
  Settings,
  Trash2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

type ImportStatus = 'draft' | 'validating' | 'ready' | 'processing' | 'completed' | 'failed' | 'cancelled';
type ImportFormat = 'csv' | 'xlsx' | 'json' | 'xml';

interface ImportJob {
  id: string;
  collectionCode: string;
  collectionName: string;
  fileName: string;
  format: ImportFormat;
  status: ImportStatus;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  skipCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface ImportDefinition {
  id: string;
  name: string;
  collectionCode: string;
  format: ImportFormat;
  action: 'insert' | 'update' | 'upsert';
  isActive: boolean;
}

const mockJobs: ImportJob[] = [
  {
    id: '1',
    collectionCode: 'incident',
    collectionName: 'Incidents',
    fileName: 'incidents_jan2024.xlsx',
    format: 'xlsx',
    status: 'completed',
    totalRows: 1500,
    processedRows: 1500,
    successCount: 1485,
    errorCount: 10,
    skipCount: 5,
    createdAt: '2024-01-15T10:00:00Z',
    startedAt: '2024-01-15T10:01:00Z',
    completedAt: '2024-01-15T10:05:00Z',
  },
  {
    id: '2',
    collectionCode: 'asset',
    collectionName: 'Assets',
    fileName: 'asset_inventory.csv',
    format: 'csv',
    status: 'processing',
    totalRows: 5000,
    processedRows: 2340,
    successCount: 2340,
    errorCount: 0,
    skipCount: 0,
    createdAt: '2024-01-15T11:00:00Z',
    startedAt: '2024-01-15T11:01:00Z',
  },
  {
    id: '3',
    collectionCode: 'user',
    collectionName: 'Users',
    fileName: 'users_export.json',
    format: 'json',
    status: 'failed',
    totalRows: 200,
    processedRows: 45,
    successCount: 40,
    errorCount: 5,
    skipCount: 0,
    createdAt: '2024-01-14T15:00:00Z',
    startedAt: '2024-01-14T15:01:00Z',
    completedAt: '2024-01-14T15:02:00Z',
  },
];

const mockDefinitions: ImportDefinition[] = [
  { id: '1', name: 'Weekly Incident Import', collectionCode: 'incident', format: 'xlsx', action: 'upsert', isActive: true },
  { id: '2', name: 'Asset Bulk Update', collectionCode: 'asset', format: 'csv', action: 'update', isActive: true },
  { id: '3', name: 'User Onboarding', collectionCode: 'user', format: 'json', action: 'insert', isActive: false },
];

const statusConfig: Record<ImportStatus, { icon: React.ElementType; color: string; label: string }> = {
  draft: { icon: FileText, color: 'text-slate-500 bg-slate-100', label: 'Draft' },
  validating: { icon: RefreshCw, color: 'text-blue-500 bg-blue-100', label: 'Validating' },
  ready: { icon: Play, color: 'text-indigo-500 bg-indigo-100', label: 'Ready' },
  processing: { icon: RefreshCw, color: 'text-amber-500 bg-amber-100', label: 'Processing' },
  completed: { icon: CheckCircle, color: 'text-green-500 bg-green-100', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500 bg-red-100', label: 'Failed' },
  cancelled: { icon: Pause, color: 'text-slate-500 bg-slate-100', label: 'Cancelled' },
};

const formatIcons: Record<ImportFormat, React.ElementType> = {
  csv: FileText,
  xlsx: FileSpreadsheet,
  json: FileJson,
  xml: FileText,
};

export const ImportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'definitions'>('jobs');
  const [showUpload, setShowUpload] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    // Handle file upload
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Data Import
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Import data from external files into your collections
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Upload className="h-4 w-4" />
          New Import
        </button>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Import Data
            </h2>

            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                Drag and drop your file here, or{' '}
                <button className="text-indigo-600 hover:underline">browse</button>
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Supported formats: CSV, XLSX, JSON, XML
              </p>
            </div>

            {/* Or use template */}
            <div className="mt-6">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Or use a saved import template:
              </p>
              <select className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                <option value="">Select a template...</option>
                {mockDefinitions.filter(d => d.isActive).map(def => (
                  <option key={def.id} value={def.id}>{def.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowUpload(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                Continue
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
          Import Jobs
        </button>
        <button
          onClick={() => setActiveTab('definitions')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'definitions'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Import Templates
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
                          {job.fileName}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig[job.status].color}`}>
                          <StatusIcon className={`h-3 w-3 ${job.status === 'processing' || job.status === 'validating' ? 'animate-spin' : ''}`} />
                          {statusConfig[job.status].label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {job.collectionName} • {job.format.toUpperCase()} • {job.totalRows.toLocaleString()} rows
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(job.createdAt).toLocaleString()}
                        </span>
                        {job.status === 'completed' && (
                          <>
                            <span className="text-green-600">
                              {job.successCount.toLocaleString()} imported
                            </span>
                            {job.errorCount > 0 && (
                              <span className="text-red-600">
                                {job.errorCount} errors
                              </span>
                            )}
                            {job.skipCount > 0 && (
                              <span className="text-amber-600">
                                {job.skipCount} skipped
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === 'ready' && (
                      <button className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Start">
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {job.status === 'processing' && (
                      <button className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Cancel">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" title="Settings">
                      <Settings className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {(job.status === 'processing' || job.status === 'validating') && (
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
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Action</th>
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
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 capitalize">{def.action}</td>
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
                    <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      <ChevronRight className="h-4 w-4" />
                    </button>
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
