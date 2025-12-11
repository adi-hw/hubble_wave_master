import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, CheckCircle, Clock, Users, AlertCircle, Settings } from 'lucide-react';

interface ApprovalType {
  id: string;
  code: string;
  name: string;
  targetTable?: string;
  approvalMode: 'sequential' | 'parallel' | 'any' | 'quorum' | 'hierarchical';
  slaHours?: number;
  isActive: boolean;
  pendingCount: number;
  completedCount: number;
  source: 'platform' | 'tenant';
  updatedAt: string;
}

const mockApprovalTypes: ApprovalType[] = [
  {
    id: '1',
    code: 'wo_high_cost',
    name: 'High Cost Work Order',
    targetTable: 'work_order',
    approvalMode: 'sequential',
    slaHours: 24,
    isActive: true,
    pendingCount: 5,
    completedCount: 128,
    source: 'tenant',
    updatedAt: '2024-01-12T10:00:00Z',
  },
  {
    id: '2',
    code: 'asset_disposal',
    name: 'Asset Disposal',
    targetTable: 'asset',
    approvalMode: 'hierarchical',
    slaHours: 48,
    isActive: true,
    pendingCount: 2,
    completedCount: 45,
    source: 'tenant',
    updatedAt: '2024-01-08T14:30:00Z',
  },
  {
    id: '3',
    code: 'vendor_onboarding',
    name: 'Vendor Onboarding',
    targetTable: 'vendor',
    approvalMode: 'parallel',
    slaHours: 72,
    isActive: true,
    pendingCount: 0,
    completedCount: 23,
    source: 'tenant',
    updatedAt: '2024-01-05T09:15:00Z',
  },
];

const approvalModeLabels: Record<ApprovalType['approvalMode'], string> = {
  sequential: 'Sequential',
  parallel: 'Parallel',
  any: 'Any Approver',
  quorum: 'Quorum',
  hierarchical: 'Hierarchical',
};

const approvalModeBadgeColors: Record<ApprovalType['approvalMode'], string> = {
  sequential: 'bg-blue-100 text-blue-700',
  parallel: 'bg-purple-100 text-purple-700',
  any: 'bg-green-100 text-green-700',
  quorum: 'bg-amber-100 text-amber-700',
  hierarchical: 'bg-slate-100 text-slate-700',
};

export const ApprovalsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<ApprovalType['approvalMode'] | 'all'>('all');

  const filteredTypes = mockApprovalTypes.filter((type) => {
    const matchesSearch =
      type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      type.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = filterMode === 'all' || type.approvalMode === filterMode;
    return matchesSearch && matchesMode;
  });

  const totalPending = mockApprovalTypes.reduce((sum, t) => sum + t.pendingCount, 0);
  const totalCompleted = mockApprovalTypes.reduce((sum, t) => sum + t.completedCount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Approval Types</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure approval workflows, approvers, escalation rules, and SLAs
          </p>
        </div>
        <button
          onClick={() => navigate('/studio/approvals/new')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Approval Type
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">{mockApprovalTypes.length}</div>
          <div className="text-sm text-slate-500">Approval Types</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-amber-600">{totalPending}</div>
          <div className="text-sm text-slate-500">Pending Approvals</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-green-600">{totalCompleted}</div>
          <div className="text-sm text-slate-500">Completed</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">
            {mockApprovalTypes.filter((t) => t.isActive).length}
          </div>
          <div className="text-sm text-slate-500">Active Types</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search approval types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as ApprovalType['approvalMode'] | 'all')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Modes</option>
            <option value="sequential">Sequential</option>
            <option value="parallel">Parallel</option>
            <option value="any">Any Approver</option>
            <option value="quorum">Quorum</option>
            <option value="hierarchical">Hierarchical</option>
          </select>
        </div>
      </div>

      {/* Approval Types List */}
      <div className="space-y-3">
        {filteredTypes.map((type) => (
          <div
            key={type.id}
            onClick={() => navigate(`/studio/approvals/${type.id}`)}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-primary-300 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-amber-50 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">{type.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                    <span>{type.code}</span>
                    {type.targetTable && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span>{type.targetTable}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    approvalModeBadgeColors[type.approvalMode]
                  }`}
                >
                  {approvalModeLabels[type.approvalMode]}
                </span>

                <div className="flex items-center gap-4 text-sm">
                  {type.slaHours && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="h-4 w-4" />
                      {type.slaHours}h SLA
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <Users className="h-4 w-4" />
                    {type.pendingCount} pending
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/studio/approvals/${type.id}/settings`);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTypes.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No approval types found</p>
        </div>
      )}
    </div>
  );
};
