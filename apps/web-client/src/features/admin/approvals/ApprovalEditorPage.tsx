import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Plus,
  Users,
} from 'lucide-react';

interface ApprovalLevel {
  id: string;
  level: number;
  name: string;
  approverType: 'user' | 'role' | 'group' | 'manager' | 'dynamic';
  approverConfig: Record<string, any>;
  requiredCount: number;
  timeoutHours?: number;
  escalationConfig?: Record<string, any>;
}

interface ApprovalType {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  levels: ApprovalLevel[];
  allowSelfApproval: boolean;
  allowDelegation: boolean;
  requireComments: boolean;
  autoApproveOnTimeout: boolean;
  timeoutAction: 'escalate' | 'reject' | 'auto_approve' | 'notify';
  defaultTimeoutHours: number;
  notificationConfig: Record<string, any>;
  isActive: boolean;
  source: 'platform' | 'tenant';
}

const mockApprovalType: ApprovalType = {
  id: '1',
  code: 'high_value_wo_approval',
  name: 'High Value Work Order Approval',
  description: 'Multi-level approval for work orders exceeding cost threshold',
  category: 'work_order',
  levels: [
    {
      id: 'l1',
      level: 1,
      name: 'Supervisor Approval',
      approverType: 'manager',
      approverConfig: { managerLevel: 1 },
      requiredCount: 1,
      timeoutHours: 24,
    },
    {
      id: 'l2',
      level: 2,
      name: 'Department Manager',
      approverType: 'role',
      approverConfig: { roleCode: 'dept_manager' },
      requiredCount: 1,
      timeoutHours: 48,
    },
    {
      id: 'l3',
      level: 3,
      name: 'Finance Review',
      approverType: 'group',
      approverConfig: { groupCode: 'finance_approvers' },
      requiredCount: 2,
      timeoutHours: 72,
      escalationConfig: { escalateTo: 'cfo' },
    },
  ],
  allowSelfApproval: false,
  allowDelegation: true,
  requireComments: true,
  autoApproveOnTimeout: false,
  timeoutAction: 'escalate',
  defaultTimeoutHours: 48,
  notificationConfig: {
    onRequest: true,
    onApprove: true,
    onReject: true,
    onEscalate: true,
    reminderHours: [12, 24],
  },
  isActive: true,
  source: 'tenant',
};

const approverTypeLabels: Record<string, string> = {
  user: 'Specific User',
  role: 'Role',
  group: 'Group',
  manager: 'Reporting Manager',
  dynamic: 'Dynamic (Script)',
};

export const ApprovalEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [approvalType, setApprovalType] = useState<ApprovalType>(
    isNew
      ? {
          id: '',
          code: '',
          name: '',
          description: '',
          category: 'general',
          levels: [],
          allowSelfApproval: false,
          allowDelegation: true,
          requireComments: false,
          autoApproveOnTimeout: false,
          timeoutAction: 'escalate',
          defaultTimeoutHours: 48,
          notificationConfig: {
            onRequest: true,
            onApprove: true,
            onReject: true,
            onEscalate: true,
          },
          isActive: true,
          source: 'tenant',
        }
      : mockApprovalType
  );

  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const selectedLevel = approvalType.levels.find((l) => l.id === selectedLevelId);

  const handleChange = (field: keyof ApprovalType, value: any) => {
    setApprovalType((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleAddLevel = () => {
    const newLevel: ApprovalLevel = {
      id: `level_${Date.now()}`,
      level: approvalType.levels.length + 1,
      name: `Level ${approvalType.levels.length + 1}`,
      approverType: 'role',
      approverConfig: {},
      requiredCount: 1,
      timeoutHours: approvalType.defaultTimeoutHours,
    };
    setApprovalType((prev) => ({
      ...prev,
      levels: [...prev.levels, newLevel],
    }));
    setSelectedLevelId(newLevel.id);
    setHasChanges(true);
  };

  const handleRemoveLevel = (levelId: string) => {
    setApprovalType((prev) => ({
      ...prev,
      levels: prev.levels
        .filter((l) => l.id !== levelId)
        .map((l, idx) => ({ ...l, level: idx + 1 })),
    }));
    if (selectedLevelId === levelId) {
      setSelectedLevelId(null);
    }
    setHasChanges(true);
  };

  const handleLevelChange = (levelId: string, field: keyof ApprovalLevel, value: any) => {
    setApprovalType((prev) => ({
      ...prev,
      levels: prev.levels.map((l) =>
        l.id === levelId ? { ...l, [field]: value } : l
      ),
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setHasChanges(false);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this approval type?')) {
      navigate('/studio/approvals');
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/studio/approvals')}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {isNew ? 'New Approval Type' : approvalType.name}
              </h1>
              <p className="text-sm text-slate-500">
                {approvalType.code || 'Define approval levels and rules'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>

            <button
              onClick={() => handleChange('isActive', !approvalType.isActive)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                approvalType.isActive
                  ? 'text-green-600 bg-green-50 hover:bg-green-100'
                  : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {approvalType.isActive ? (
                <ToggleRight className="h-4 w-4" />
              ) : (
                <ToggleLeft className="h-4 w-4" />
              )}
              {approvalType.isActive ? 'Active' : 'Inactive'}
            </button>

            {!isNew && (
              <button
                onClick={handleDelete}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Levels List */}
        <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-slate-900">Approval Levels</h2>
              <button
                onClick={handleAddLevel}
                className="flex items-center gap-1 px-2 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {approvalType.levels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setSelectedLevelId(level.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedLevelId === level.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        selectedLevelId === level.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {level.level}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {level.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {approverTypeLabels[level.approverType]}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {approvalType.levels.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No approval levels defined</p>
                  <p className="text-xs">Click "Add" to create your first level</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Level Details */}
        <div className="flex-1 overflow-y-auto">
          {selectedLevel ? (
            <div className="p-6 max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Level {selectedLevel.level} Configuration
                </h2>
                <button
                  onClick={() => handleRemoveLevel(selectedLevel.id)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove Level
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Level Name
                  </label>
                  <input
                    type="text"
                    value={selectedLevel.name}
                    onChange={(e) =>
                      handleLevelChange(selectedLevel.id, 'name', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Approver Type
                  </label>
                  <select
                    value={selectedLevel.approverType}
                    onChange={(e) =>
                      handleLevelChange(selectedLevel.id, 'approverType', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {Object.entries(approverTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedLevel.approverType === 'role' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Role Code
                    </label>
                    <input
                      type="text"
                      value={selectedLevel.approverConfig.roleCode || ''}
                      onChange={(e) =>
                        handleLevelChange(selectedLevel.id, 'approverConfig', {
                          ...selectedLevel.approverConfig,
                          roleCode: e.target.value,
                        })
                      }
                      placeholder="e.g., dept_manager"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}

                {selectedLevel.approverType === 'group' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Group Code
                    </label>
                    <input
                      type="text"
                      value={selectedLevel.approverConfig.groupCode || ''}
                      onChange={(e) =>
                        handleLevelChange(selectedLevel.id, 'approverConfig', {
                          ...selectedLevel.approverConfig,
                          groupCode: e.target.value,
                        })
                      }
                      placeholder="e.g., finance_approvers"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}

                {selectedLevel.approverType === 'manager' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Manager Level
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={selectedLevel.approverConfig.managerLevel || 1}
                      onChange={(e) =>
                        handleLevelChange(selectedLevel.id, 'approverConfig', {
                          ...selectedLevel.approverConfig,
                          managerLevel: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      1 = Direct manager, 2 = Skip level, etc.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Required Approvals
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={selectedLevel.requiredCount}
                      onChange={(e) =>
                        handleLevelChange(
                          selectedLevel.id,
                          'requiredCount',
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Timeout (hours)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={selectedLevel.timeoutHours || ''}
                      onChange={(e) =>
                        handleLevelChange(
                          selectedLevel.id,
                          'timeoutHours',
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      placeholder="Inherit from type"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">
                    Escalation (on timeout)
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Escalate To
                    </label>
                    <input
                      type="text"
                      value={selectedLevel.escalationConfig?.escalateTo || ''}
                      onChange={(e) =>
                        handleLevelChange(selectedLevel.id, 'escalationConfig', {
                          ...selectedLevel.escalationConfig,
                          escalateTo: e.target.value,
                        })
                      }
                      placeholder="User or role code"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a level to configure</p>
                <p className="text-sm">or add a new approval level</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">Approval Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  Basic Info
                </h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={approvalType.code}
                    onChange={(e) => handleChange('code', e.target.value)}
                    placeholder="e.g., high_value_wo_approval"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={approvalType.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={approvalType.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={approvalType.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="general">General</option>
                    <option value="work_order">Work Order</option>
                    <option value="purchase">Purchase</option>
                    <option value="asset">Asset</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              {/* Behavior */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  Behavior
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Default Timeout (hours)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={approvalType.defaultTimeoutHours}
                      onChange={(e) =>
                        handleChange('defaultTimeoutHours', parseInt(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      On Timeout
                    </label>
                    <select
                      value={approvalType.timeoutAction}
                      onChange={(e) => handleChange('timeoutAction', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="escalate">Escalate</option>
                      <option value="reject">Reject</option>
                      <option value="auto_approve">Auto Approve</option>
                      <option value="notify">Notify Only</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={approvalType.allowSelfApproval}
                      onChange={(e) => handleChange('allowSelfApproval', e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">Allow self-approval</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={approvalType.allowDelegation}
                      onChange={(e) => handleChange('allowDelegation', e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">Allow delegation</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={approvalType.requireComments}
                      onChange={(e) => handleChange('requireComments', e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">Require comments</span>
                  </label>
                </div>
              </div>

              {/* Notifications */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  Notifications
                </h3>

                <div className="space-y-3">
                  {['onRequest', 'onApprove', 'onReject', 'onEscalate'].map((key) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={approvalType.notificationConfig[key] || false}
                        onChange={(e) =>
                          handleChange('notificationConfig', {
                            ...approvalType.notificationConfig,
                            [key]: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-slate-700">
                        {key.replace('on', 'On ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalEditorPage;
