import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, GitBranch, Pause, Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface Workflow {
  id: string;
  code: string;
  name: string;
  category: 'approval' | 'automation' | 'notification' | 'integration';
  triggerType: 'record_event' | 'schedule' | 'manual' | 'api';
  targetTable?: string;
  isActive: boolean;
  lastRunAt?: string;
  runCount: number;
  source: 'platform' | 'tenant';
  updatedAt: string;
}

const mockWorkflows: Workflow[] = [
  {
    id: '1',
    code: 'wo_approval_flow',
    name: 'Work Order Approval',
    category: 'approval',
    triggerType: 'record_event',
    targetTable: 'work_order',
    isActive: true,
    lastRunAt: '2024-01-15T14:30:00Z',
    runCount: 156,
    source: 'tenant',
    updatedAt: '2024-01-10T09:00:00Z',
  },
  {
    id: '2',
    code: 'asset_maintenance_reminder',
    name: 'Asset Maintenance Reminder',
    category: 'notification',
    triggerType: 'schedule',
    targetTable: 'asset',
    isActive: true,
    lastRunAt: '2024-01-15T08:00:00Z',
    runCount: 45,
    source: 'tenant',
    updatedAt: '2024-01-08T11:30:00Z',
  },
  {
    id: '3',
    code: 'inventory_sync',
    name: 'Inventory External Sync',
    category: 'integration',
    triggerType: 'schedule',
    isActive: false,
    runCount: 0,
    source: 'tenant',
    updatedAt: '2024-01-05T16:00:00Z',
  },
];

const categoryLabels: Record<Workflow['category'], string> = {
  approval: 'Approval',
  automation: 'Automation',
  notification: 'Notification',
  integration: 'Integration',
};

const categoryBadgeColors: Record<Workflow['category'], string> = {
  approval: 'bg-amber-100 text-amber-700',
  automation: 'bg-blue-100 text-blue-700',
  notification: 'bg-green-100 text-green-700',
  integration: 'bg-purple-100 text-purple-700',
};

const triggerLabels: Record<Workflow['triggerType'], string> = {
  record_event: 'Record Event',
  schedule: 'Scheduled',
  manual: 'Manual',
  api: 'API',
};

export const WorkflowsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<Workflow['category'] | 'all'>('all');

  const filteredWorkflows = mockWorkflows.filter((workflow) => {
    const matchesSearch =
      workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workflow.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || workflow.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Workflows</h1>
          <p className="text-sm text-slate-500 mt-1">
            Design and manage automated workflows for approvals, notifications, and integrations
          </p>
        </div>
        <button
          onClick={() => navigate('/studio/workflows/new')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Workflow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">{mockWorkflows.length}</div>
          <div className="text-sm text-slate-500">Total Workflows</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-green-600">
            {mockWorkflows.filter((w) => w.isActive).length}
          </div>
          <div className="text-sm text-slate-500">Active</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">
            {mockWorkflows.reduce((sum, w) => sum + w.runCount, 0)}
          </div>
          <div className="text-sm text-slate-500">Total Runs</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">
            {mockWorkflows.filter((w) => w.category === 'approval').length}
          </div>
          <div className="text-sm text-slate-500">Approval Flows</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as Workflow['category'] | 'all')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Categories</option>
            <option value="approval">Approval</option>
            <option value="automation">Automation</option>
            <option value="notification">Notification</option>
            <option value="integration">Integration</option>
          </select>
        </div>
      </div>

      {/* Workflows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkflows.map((workflow) => (
          <div
            key={workflow.id}
            onClick={() => navigate(`/studio/workflows/${workflow.id}`)}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-primary-300 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <GitBranch className="h-5 w-5 text-slate-600" />
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  categoryBadgeColors[workflow.category]
                }`}
              >
                {categoryLabels[workflow.category]}
              </span>
            </div>

            <h3 className="font-medium text-slate-900 mb-1">{workflow.name}</h3>
            <p className="text-sm text-slate-500 mb-3">{workflow.code}</p>

            <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
              <span>{triggerLabels[workflow.triggerType]}</span>
              {workflow.targetTable && (
                <>
                  <span className="text-slate-300">|</span>
                  <span>{workflow.targetTable}</span>
                </>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {workflow.isActive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <Pause className="h-3.5 w-3.5" />
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                {workflow.runCount} runs
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredWorkflows.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No workflows found</p>
        </div>
      )}
    </div>
  );
};
