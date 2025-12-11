import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, FileCode, Play, Clock, AlertCircle } from 'lucide-react';

interface Script {
  id: string;
  code: string;
  name: string;
  scriptType: 'client_script' | 'server_script' | 'business_rule' | 'ui_action' | 'scheduled_job';
  executionContext: string;
  targetTable?: string;
  isActive: boolean;
  lastExecutedAt?: string;
  source: 'platform' | 'tenant';
  updatedAt: string;
}

const mockScripts: Script[] = [
  {
    id: '1',
    code: 'wo_set_defaults',
    name: 'Work Order Set Defaults',
    scriptType: 'client_script',
    executionContext: 'form_load',
    targetTable: 'work_order',
    isActive: true,
    source: 'tenant',
    updatedAt: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    code: 'asset_validate_serial',
    name: 'Asset Serial Number Validation',
    scriptType: 'business_rule',
    executionContext: 'form_save',
    targetTable: 'asset',
    isActive: true,
    lastExecutedAt: '2024-01-15T09:45:00Z',
    source: 'tenant',
    updatedAt: '2024-01-14T16:20:00Z',
  },
  {
    id: '3',
    code: 'nightly_sync',
    name: 'Nightly Data Sync',
    scriptType: 'scheduled_job',
    executionContext: 'scheduled',
    isActive: true,
    lastExecutedAt: '2024-01-15T02:00:00Z',
    source: 'tenant',
    updatedAt: '2024-01-10T08:00:00Z',
  },
];

const scriptTypeLabels: Record<Script['scriptType'], string> = {
  client_script: 'Client Script',
  server_script: 'Server Script',
  business_rule: 'Business Rule',
  ui_action: 'UI Action',
  scheduled_job: 'Scheduled Job',
};

const scriptTypeBadgeColors: Record<Script['scriptType'], string> = {
  client_script: 'bg-blue-100 text-blue-700',
  server_script: 'bg-purple-100 text-purple-700',
  business_rule: 'bg-amber-100 text-amber-700',
  ui_action: 'bg-green-100 text-green-700',
  scheduled_job: 'bg-slate-100 text-slate-700',
};

export const ScriptsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<Script['scriptType'] | 'all'>('all');

  const filteredScripts = mockScripts.filter((script) => {
    const matchesSearch =
      script.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      script.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || script.scriptType === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Scripts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage client scripts, server scripts, business rules, and scheduled jobs
          </p>
        </div>
        <button
          onClick={() => navigate('/studio/scripts/new')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Script
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search scripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as Script['scriptType'] | 'all')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Types</option>
            <option value="client_script">Client Scripts</option>
            <option value="server_script">Server Scripts</option>
            <option value="business_rule">Business Rules</option>
            <option value="ui_action">UI Actions</option>
            <option value="scheduled_job">Scheduled Jobs</option>
          </select>
        </div>
      </div>

      {/* Scripts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Script
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Target
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Last Run
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredScripts.map((script) => (
              <tr
                key={script.id}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/studio/scripts/${script.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                      <FileCode className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{script.name}</div>
                      <div className="text-sm text-slate-500">{script.code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      scriptTypeBadgeColors[script.scriptType]
                    }`}
                  >
                    {scriptTypeLabels[script.scriptType]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {script.targetTable || '-'}
                </td>
                <td className="px-4 py-3">
                  {script.isActive ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {script.lastExecutedAt ? (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(script.lastExecutedAt).toLocaleDateString()}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Run script
                    }}
                    className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                    title="Run Script"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredScripts.length === 0 && (
          <div className="px-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No scripts found</p>
          </div>
        )}
      </div>
    </div>
  );
};
