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
} from 'lucide-react';
import { WorkflowDesigner, WorkflowStep, WorkflowConnection } from '../components/WorkflowDesigner';

interface Workflow {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: 'approval' | 'automation' | 'notification' | 'integration';
  triggerType: 'record_event' | 'schedule' | 'manual' | 'api';
  triggerConfig: Record<string, any>;
  steps: WorkflowStep[];
  connections: WorkflowConnection[];
  isActive: boolean;
  source: 'platform' | 'tenant';
}

const mockWorkflow: Workflow = {
  id: '1',
  code: 'wo_approval_flow',
  name: 'Work Order Approval',
  description: 'Approval workflow for high-cost work orders',
  category: 'approval',
  triggerType: 'record_event',
  triggerConfig: {
    table: 'work_order',
    events: ['insert', 'update'],
    condition: { field: 'estimated_cost', operator: 'gt', value: 1000 },
  },
  steps: [
    {
      id: 'start',
      type: 'start',
      name: 'Start',
      config: {},
      position: { x: 200, y: 50 },
    },
    {
      id: 'check_cost',
      type: 'condition',
      name: 'Check Cost',
      config: { expression: { field: 'estimated_cost', operator: 'gt', value: 5000 } },
      position: { x: 200, y: 170 },
    },
    {
      id: 'manager_approval',
      type: 'create_approval',
      name: 'Manager Approval',
      config: { approvalType: 'manager', message: 'Please review this work order' },
      position: { x: 80, y: 290 },
    },
    {
      id: 'director_approval',
      type: 'create_approval',
      name: 'Director Approval',
      config: { approvalType: 'director', message: 'High value work order requires director approval' },
      position: { x: 320, y: 290 },
    },
    {
      id: 'end',
      type: 'end',
      name: 'End',
      config: {},
      position: { x: 200, y: 420 },
    },
  ],
  connections: [
    { from: 'start', to: 'check_cost' },
    { from: 'check_cost', to: 'manager_approval', label: 'false' },
    { from: 'check_cost', to: 'director_approval', label: 'true' },
    { from: 'manager_approval', to: 'end' },
    { from: 'director_approval', to: 'end' },
  ],
  isActive: true,
  source: 'tenant',
};

export const WorkflowEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [workflow, setWorkflow] = useState<Workflow>(
    isNew
      ? {
          id: '',
          code: '',
          name: '',
          description: '',
          category: 'automation',
          triggerType: 'record_event',
          triggerConfig: {},
          steps: [],
          connections: [],
          isActive: true,
          source: 'tenant',
        }
      : mockWorkflow
  );

  const [selectedStepId, setSelectedStepId] = useState<string | undefined>(undefined);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const selectedStep = workflow.steps.find((s) => s.id === selectedStepId);

  const handleSelectStep = (stepId: string | null) => {
    setSelectedStepId(stepId ?? undefined);
  };

  const handleChange = (field: keyof Workflow, value: any) => {
    setWorkflow((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleStepsChange = (steps: WorkflowStep[]) => {
    setWorkflow((prev) => ({ ...prev, steps }));
    setHasChanges(true);
  };

  const handleConnectionsChange = (connections: WorkflowConnection[]) => {
    setWorkflow((prev) => ({ ...prev, connections }));
    setHasChanges(true);
  };

  const handleStepConfigChange = (stepId: string, config: Record<string, any>) => {
    setWorkflow((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId ? { ...s, config: { ...s.config, ...config } } : s
      ),
    }));
    setHasChanges(true);
  };

  const handleStepNameChange = (stepId: string, name: string) => {
    setWorkflow((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, name } : s)),
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
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      navigate('/studio/workflows');
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/studio/workflows')}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {isNew ? 'New Workflow' : workflow.name}
              </h1>
              <p className="text-sm text-slate-500">
                {workflow.code || 'Configure workflow trigger and steps'}
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
              onClick={() => handleChange('isActive', !workflow.isActive)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                workflow.isActive
                  ? 'text-green-600 bg-green-50 hover:bg-green-100'
                  : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {workflow.isActive ? (
                <ToggleRight className="h-4 w-4" />
              ) : (
                <ToggleLeft className="h-4 w-4" />
              )}
              {workflow.isActive ? 'Active' : 'Inactive'}
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
        {/* Designer */}
        <WorkflowDesigner
          steps={workflow.steps}
          onStepsChange={handleStepsChange}
          connections={workflow.connections}
          onConnectionsChange={handleConnectionsChange}
          selectedStepId={selectedStepId}
          onSelectStep={handleSelectStep}
          className="flex-1"
        />

        {/* Step Properties Panel */}
        {selectedStep && (
          <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-900">Step Properties</h3>
                <button
                  onClick={() => handleSelectStep(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Step Name
                </label>
                <input
                  type="text"
                  value={selectedStep.name}
                  onChange={(e) => handleStepNameChange(selectedStep.id, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Step Type
                </label>
                <input
                  type="text"
                  value={selectedStep.type}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Configuration (JSON)
                </label>
                <textarea
                  value={JSON.stringify(selectedStep.config, null, 2)}
                  onChange={(e) => {
                    try {
                      const config = JSON.parse(e.target.value);
                      handleStepConfigChange(selectedStep.id, config);
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Workflow Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Workflow Code
                </label>
                <input
                  type="text"
                  value={workflow.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                  placeholder="e.g., wo_approval_flow"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={workflow.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={workflow.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={workflow.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="approval">Approval</option>
                    <option value="automation">Automation</option>
                    <option value="notification">Notification</option>
                    <option value="integration">Integration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Trigger Type
                  </label>
                  <select
                    value={workflow.triggerType}
                    onChange={(e) => handleChange('triggerType', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="record_event">Record Event</option>
                    <option value="schedule">Scheduled</option>
                    <option value="manual">Manual</option>
                    <option value="api">API</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
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

export default WorkflowEditorPage;
