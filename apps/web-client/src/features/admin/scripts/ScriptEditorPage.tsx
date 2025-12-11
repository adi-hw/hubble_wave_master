import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Play,
  Clock,
  History,
  Settings,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { PageHeader } from '../components/Breadcrumb';
import { ScriptEditor } from '../components/ScriptEditor';

interface Script {
  id: string;
  code: string;
  name: string;
  description?: string;
  scriptType: 'client_script' | 'server_script' | 'business_rule' | 'ui_action' | 'scheduled_job';
  executionContext: string;
  targetTable?: string;
  targetField?: string;
  scriptContent: string;
  scriptLanguage: 'javascript' | 'typescript';
  executionOrder: number;
  isAsync: boolean;
  timeoutMs: number;
  conditionExpression?: Record<string, any>;
  isActive: boolean;
  isSystem: boolean;
  source: 'platform' | 'tenant';
  createdAt: string;
  updatedAt: string;
}

const mockScript: Script = {
  id: '1',
  code: 'wo_set_defaults',
  name: 'Work Order Set Defaults',
  description: 'Sets default values when a new work order form is loaded',
  scriptType: 'client_script',
  executionContext: 'form_load',
  targetTable: 'work_order',
  scriptContent: `// Work Order Set Defaults
// This script runs when the form loads

function onLoad(form, record) {
  // Set default priority
  if (!record.priority) {
    form.setValue('priority', 'medium');
  }

  // Set default status for new records
  if (record.isNewRecord) {
    form.setValue('status', 'draft');
    form.setValue('assigned_to', getCurrentUser().id);
  }

  // Make certain fields read-only based on status
  if (record.status === 'closed') {
    form.setReadOnly(['priority', 'assigned_to', 'description'], true);
  }
}

// Register the handler
registerOnLoad(onLoad);
`,
  scriptLanguage: 'javascript',
  executionOrder: 100,
  isAsync: false,
  timeoutMs: 5000,
  isActive: true,
  isSystem: false,
  source: 'tenant',
  createdAt: '2024-01-10T09:00:00Z',
  updatedAt: '2024-01-15T14:30:00Z',
};

const scriptTypeOptions = [
  { value: 'client_script', label: 'Client Script' },
  { value: 'server_script', label: 'Server Script' },
  { value: 'business_rule', label: 'Business Rule' },
  { value: 'ui_action', label: 'UI Action' },
  { value: 'scheduled_job', label: 'Scheduled Job' },
];

const executionContextOptions: Record<string, { value: string; label: string }[]> = {
  client_script: [
    { value: 'form_load', label: 'Form Load' },
    { value: 'form_save', label: 'Form Save' },
    { value: 'field_change', label: 'Field Change' },
    { value: 'form_submit', label: 'Form Submit' },
  ],
  server_script: [
    { value: 'before_insert', label: 'Before Insert' },
    { value: 'after_insert', label: 'After Insert' },
    { value: 'before_update', label: 'Before Update' },
    { value: 'after_update', label: 'After Update' },
    { value: 'before_delete', label: 'Before Delete' },
    { value: 'after_delete', label: 'After Delete' },
  ],
  business_rule: [
    { value: 'validation', label: 'Validation' },
    { value: 'calculation', label: 'Calculation' },
    { value: 'auto_populate', label: 'Auto Populate' },
  ],
  ui_action: [
    { value: 'button_click', label: 'Button Click' },
    { value: 'menu_action', label: 'Menu Action' },
  ],
  scheduled_job: [
    { value: 'scheduled', label: 'Scheduled' },
  ],
};

export const ScriptEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [script, setScript] = useState<Script>(
    isNew
      ? {
          id: '',
          code: '',
          name: '',
          description: '',
          scriptType: 'client_script',
          executionContext: 'form_load',
          targetTable: '',
          scriptContent: '// Enter your script here\n',
          scriptLanguage: 'javascript',
          executionOrder: 100,
          isAsync: false,
          timeoutMs: 5000,
          isActive: true,
          isSystem: false,
          source: 'tenant',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : mockScript
  );

  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'settings' | 'logs'>('editor');

  const handleChange = (field: keyof Script, value: any) => {
    setScript((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    // TODO: API call to save
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setHasChanges(false);
  };

  const handleTest = async () => {
    // Simulate test execution
    await new Promise((r) => setTimeout(r, 1000));
    return {
      success: true,
      output: { message: 'Script executed successfully', duration: '45ms' },
    };
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this script?')) {
      // TODO: API call to delete
      navigate('/studio/scripts');
    }
  };

  const handleToggleActive = () => {
    handleChange('isActive', !script.isActive);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title={isNew ? 'New Script' : script.name}
        subtitle={script.code || 'Configure script properties and code'}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/studio/scripts')}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {!isNew && (
              <>
                <button
                  onClick={handleToggleActive}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    script.isActive
                      ? 'text-green-600 bg-green-50 hover:bg-green-100'
                      : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  {script.isActive ? (
                    <ToggleRight className="h-4 w-4" />
                  ) : (
                    <ToggleLeft className="h-4 w-4" />
                  )}
                  {script.isActive ? 'Active' : 'Inactive'}
                </button>

                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
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
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
        {[
          { id: 'editor', label: 'Editor', icon: Play },
          { id: 'settings', label: 'Settings', icon: Settings },
          { id: 'logs', label: 'Execution Logs', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Editor Tab */}
      {activeTab === 'editor' && (
        <div className="space-y-6">
          {/* Quick Settings */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Script Code
              </label>
              <input
                type="text"
                value={script.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder="e.g., wo_set_defaults"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={script.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Script name"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Type
              </label>
              <select
                value={script.scriptType}
                onChange={(e) => handleChange('scriptType', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {scriptTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Execution Context
              </label>
              <select
                value={script.executionContext}
                onChange={(e) => handleChange('executionContext', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {(executionContextOptions[script.scriptType] || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Code Editor */}
          <ScriptEditor
            value={script.scriptContent}
            onChange={(value) => handleChange('scriptContent', value)}
            language={script.scriptLanguage}
            height="500px"
            onSave={handleSave}
            onTest={handleTest}
          />
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={script.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Target Table
              </label>
              <input
                type="text"
                value={script.targetTable || ''}
                onChange={(e) => handleChange('targetTable', e.target.value)}
                placeholder="e.g., work_order"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Execution Order
              </label>
              <input
                type="number"
                value={script.executionOrder}
                onChange={(e) => handleChange('executionOrder', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Lower numbers execute first
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Timeout (ms)
              </label>
              <input
                type="number"
                value={script.timeoutMs}
                onChange={(e) => handleChange('timeoutMs', parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={script.isAsync}
                  onChange={(e) => handleChange('isAsync', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Run asynchronously
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-7">
                Script will run in the background without blocking the UI
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Execution History
            </h3>
            <p className="text-sm text-slate-500">
              View past executions, performance metrics, and error logs
            </p>
            <p className="text-xs text-slate-400 mt-4">
              No execution logs available for this script
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptEditorPage;
