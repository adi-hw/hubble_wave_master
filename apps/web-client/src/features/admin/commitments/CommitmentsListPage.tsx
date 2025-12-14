import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Plus,
  Search,
  Filter,
  MoreVertical,
  AlertTriangle,
  CheckCircle,
  Timer,
  Calendar,
  Settings,
} from 'lucide-react';

type CommitmentType = 'sla' | 'ola' | 'uc';

interface CommitmentDefinition {
  id: string;
  name: string;
  code: string;
  type: CommitmentType;
  description?: string;
  collectionCode?: string;
  targetMinutes: number;
  warningThresholdPercent: number;
  useBusinessHours: boolean;
  isActive: boolean;
  metrics: {
    totalTracked: number;
    complianceRate: number;
    avgResolutionMinutes: number;
  };
}

const mockDefinitions: CommitmentDefinition[] = [
  {
    id: '1',
    name: 'P1 Response Time',
    code: 'p1_response',
    type: 'sla',
    description: 'Critical incident initial response time',
    collectionCode: 'incident',
    targetMinutes: 15,
    warningThresholdPercent: 75,
    useBusinessHours: false,
    isActive: true,
    metrics: { totalTracked: 245, complianceRate: 94.5, avgResolutionMinutes: 12 },
  },
  {
    id: '2',
    name: 'P1 Resolution Time',
    code: 'p1_resolution',
    type: 'sla',
    description: 'Critical incident resolution time',
    collectionCode: 'incident',
    targetMinutes: 240,
    warningThresholdPercent: 80,
    useBusinessHours: false,
    isActive: true,
    metrics: { totalTracked: 245, complianceRate: 87.2, avgResolutionMinutes: 198 },
  },
  {
    id: '3',
    name: 'P2 Response Time',
    code: 'p2_response',
    type: 'sla',
    description: 'High priority incident initial response',
    collectionCode: 'incident',
    targetMinutes: 60,
    warningThresholdPercent: 75,
    useBusinessHours: true,
    isActive: true,
    metrics: { totalTracked: 892, complianceRate: 96.8, avgResolutionMinutes: 42 },
  },
  {
    id: '4',
    name: 'Change Request Review',
    code: 'change_review',
    type: 'ola',
    description: 'Internal review of change requests',
    collectionCode: 'change_request',
    targetMinutes: 480,
    warningThresholdPercent: 80,
    useBusinessHours: true,
    isActive: true,
    metrics: { totalTracked: 156, complianceRate: 91.0, avgResolutionMinutes: 320 },
  },
  {
    id: '5',
    name: 'Service Request Fulfillment',
    code: 'sr_fulfillment',
    type: 'sla',
    description: 'Standard service request completion',
    collectionCode: 'service_request',
    targetMinutes: 1440,
    warningThresholdPercent: 75,
    useBusinessHours: true,
    isActive: false,
    metrics: { totalTracked: 0, complianceRate: 0, avgResolutionMinutes: 0 },
  },
];

const typeLabels: Record<CommitmentType, string> = {
  sla: 'SLA',
  ola: 'OLA',
  uc: 'UC',
};

const typeColors: Record<CommitmentType, string> = {
  sla: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  ola: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  uc: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

export const CommitmentsListPage: React.FC = () => {
  const [definitions] = useState(mockDefinitions);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredDefinitions = definitions.filter((def) => {
    if (filterType !== 'all' && def.type !== filterType) return false;
    if (filterStatus === 'active' && !def.isActive) return false;
    if (filterStatus === 'inactive' && def.isActive) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        def.name.toLowerCase().includes(query) ||
        def.code.toLowerCase().includes(query) ||
        def.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Commitments (SLA/OLA)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure and monitor service level agreements and operational level agreements
          </p>
        </div>
        <Link
          to="/admin/commitments/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Commitment
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {definitions.filter((d) => d.isActive).length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Active Commitments
              </p>
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
                {Math.round(
                  definitions
                    .filter((d) => d.isActive && d.metrics.totalTracked > 0)
                    .reduce((sum, d) => sum + d.metrics.complianceRate, 0) /
                    definitions.filter((d) => d.isActive && d.metrics.totalTracked > 0).length || 0
                )}%
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Avg Compliance
              </p>
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
                {definitions.filter((d) => d.type === 'sla').length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">SLAs</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Timer className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {definitions.filter((d) => d.type === 'ola').length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">OLAs</p>
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
                placeholder="Search commitments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="sla">SLA</option>
              <option value="ola">OLA</option>
              <option value="uc">UC</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Definitions List */}
      <div className="space-y-4">
        {filteredDefinitions.map((definition) => (
          <div
            key={definition.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                  definition.isActive
                    ? 'bg-indigo-100 dark:bg-indigo-900/30'
                    : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                  <Clock className={`h-6 w-6 ${
                    definition.isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/admin/commitments/${definition.id}`}
                      className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {definition.name}
                    </Link>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[definition.type]}`}>
                      {typeLabels[definition.type]}
                    </span>
                    {definition.isActive ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <span className="w-2 h-2 bg-slate-400 rounded-full" />
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {definition.description}
                  </p>
                  <div className="flex items-center gap-6 mt-3 text-sm">
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <Timer className="h-4 w-4" />
                      Target: {formatDuration(definition.targetMinutes)}
                    </span>
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <AlertTriangle className="h-4 w-4" />
                      Warning at {definition.warningThresholdPercent}%
                    </span>
                    {definition.useBusinessHours && (
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        <Calendar className="h-4 w-4" />
                        Business Hours
                      </span>
                    )}
                    {definition.collectionCode && (
                      <span className="text-slate-500 dark:text-slate-400">
                        Collection: {definition.collectionCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <Settings className="h-5 w-5" />
                </button>
                <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Metrics */}
            {definition.isActive && definition.metrics.totalTracked > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Tracked</p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-white">
                      {definition.metrics.totalTracked.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Compliance Rate</p>
                    <p className={`text-xl font-semibold ${
                      definition.metrics.complianceRate >= 95
                        ? 'text-green-600'
                        : definition.metrics.complianceRate >= 85
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}>
                      {definition.metrics.complianceRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Avg Resolution</p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-white">
                      {formatDuration(definition.metrics.avgResolutionMinutes)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredDefinitions.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Clock className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No Commitments Found
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            No commitment definitions match your search criteria.
          </p>
        </div>
      )}
    </div>
  );
};
