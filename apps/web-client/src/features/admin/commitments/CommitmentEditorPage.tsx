import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  XCircle,
  Plus,
  Trash2,
  Settings,
} from 'lucide-react';

type CommitmentType = 'sla' | 'ola' | 'uc';
type TriggerType = 'on_create' | 'on_status_change' | 'on_assignment' | 'on_field_change' | 'manual';
type StopCondition = 'on_status_change' | 'on_resolution' | 'on_closure' | 'on_field_change' | 'manual';
type ActionType = 'notify' | 'escalate' | 'reassign' | 'update_field' | 'webhook';

interface CommitmentForm {
  name: string;
  code: string;
  type: CommitmentType;
  description: string;
  collectionCode: string;
  triggerType: TriggerType;
  stopCondition: StopCondition;
  targetMinutes: number;
  targetUnit: 'minutes' | 'hours' | 'days';
  useBusinessHours: boolean;
  businessScheduleId: string;
  holidayCalendarId: string;
  warningThresholdPercent: number;
  warningActions: Array<{ action: ActionType; config: Record<string, unknown> }>;
  breachActions: Array<{ action: ActionType; config: Record<string, unknown> }>;
  pauseConditions: Array<{ field: string; values: string[] }>;
  isActive: boolean;
}

const defaultForm: CommitmentForm = {
  name: '',
  code: '',
  type: 'sla',
  description: '',
  collectionCode: '',
  triggerType: 'on_create',
  stopCondition: 'on_resolution',
  targetMinutes: 60,
  targetUnit: 'minutes',
  useBusinessHours: true,
  businessScheduleId: '',
  holidayCalendarId: '',
  warningThresholdPercent: 75,
  warningActions: [],
  breachActions: [],
  pauseConditions: [],
  isActive: true,
};

const mockSchedules = [
  { id: '1', name: 'Standard Business Hours (9-5, M-F)' },
  { id: '2', name: '24/7 Support' },
  { id: '3', name: 'Extended Hours (8-8, M-Sa)' },
];

const mockCalendars = [
  { id: '1', name: 'US Federal Holidays' },
  { id: '2', name: 'UK Bank Holidays' },
];

const mockCollections = [
  { code: 'incident', label: 'Incident' },
  { code: 'service_request', label: 'Service Request' },
  { code: 'change_request', label: 'Change Request' },
  { code: 'problem', label: 'Problem' },
];

export const CommitmentEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<CommitmentForm>(defaultForm);
  const [activeTab, setActiveTab] = useState<'general' | 'timing' | 'actions' | 'advanced'>('general');

  const handleSave = () => {
    console.log('Saving commitment:', form);
    navigate('/admin/commitments');
  };

  const updateForm = (field: keyof CommitmentForm, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addWarningAction = () => {
    setForm((prev) => ({
      ...prev,
      warningActions: [...prev.warningActions, { action: 'notify', config: {} }],
    }));
  };

  const addBreachAction = () => {
    setForm((prev) => ({
      ...prev,
      breachActions: [...prev.breachActions, { action: 'notify', config: {} }],
    }));
  };

  const removeWarningAction = (index: number) => {
    setForm((prev) => ({
      ...prev,
      warningActions: prev.warningActions.filter((_, i) => i !== index),
    }));
  };

  const removeBreachAction = (index: number) => {
    setForm((prev) => ({
      ...prev,
      breachActions: prev.breachActions.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/commitments')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {isNew ? 'New Commitment' : 'Edit Commitment'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isNew
                ? 'Create a new SLA, OLA, or UC definition'
                : `Editing ${form.name || 'commitment'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/commitments')}
            className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        {[
          { id: 'general', label: 'General', icon: Settings },
          { id: 'timing', label: 'Timing', icon: Clock },
          { id: 'actions', label: 'Actions', icon: Play },
          { id: 'advanced', label: 'Advanced', icon: AlertTriangle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="e.g., P1 Response Time"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Code *
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => updateForm('code', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="e.g., p1_response"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Type *
              </label>
              <select
                value={form.type}
                onChange={(e) => updateForm('type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              >
                <option value="sla">SLA - Service Level Agreement</option>
                <option value="ola">OLA - Operational Level Agreement</option>
                <option value="uc">UC - Underpinning Contract</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Collection
              </label>
              <select
                value={form.collectionCode}
                onChange={(e) => updateForm('collectionCode', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              >
                <option value="">Select collection...</option>
                {mockCollections.map((col) => (
                  <option key={col.code} value={col.code}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              rows={3}
              placeholder="Describe when this commitment applies..."
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => updateForm('isActive', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            </label>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Active
            </span>
          </div>
        </div>
      )}

      {/* Timing Tab */}
      {activeTab === 'timing' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Target Time *
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={form.targetMinutes}
                onChange={(e) => updateForm('targetMinutes', parseInt(e.target.value))}
                min={1}
                className="w-32 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
              <select
                value={form.targetUnit}
                onChange={(e) => updateForm('targetUnit', e.target.value)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Warning Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                value={form.warningThresholdPercent}
                onChange={(e) => updateForm('warningThresholdPercent', parseInt(e.target.value))}
                min={50}
                max={95}
                step={5}
                className="flex-1"
              />
              <span className="w-16 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                {form.warningThresholdPercent}%
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Warning will be triggered when {form.warningThresholdPercent}% of target time has elapsed
            </p>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.useBusinessHours}
                  onChange={(e) => updateForm('useBusinessHours', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
              </label>
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Use Business Hours
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Time is calculated using business schedule and excludes holidays
                </p>
              </div>
            </div>

            {form.useBusinessHours && (
              <div className="grid grid-cols-2 gap-6 pl-14">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Business Schedule
                  </label>
                  <select
                    value={form.businessScheduleId}
                    onChange={(e) => updateForm('businessScheduleId', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  >
                    <option value="">Select schedule...</option>
                    {mockSchedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Holiday Calendar
                  </label>
                  <select
                    value={form.holidayCalendarId}
                    onChange={(e) => updateForm('holidayCalendarId', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  >
                    <option value="">Select calendar...</option>
                    {mockCalendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Trigger When
                </label>
                <select
                  value={form.triggerType}
                  onChange={(e) => updateForm('triggerType', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                >
                  <option value="on_create">Record Created</option>
                  <option value="on_status_change">Status Changed</option>
                  <option value="on_assignment">Assigned to User/Group</option>
                  <option value="on_field_change">Field Changed</option>
                  <option value="manual">Manual Start</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Stop When
                </label>
                <select
                  value={form.stopCondition}
                  onChange={(e) => updateForm('stopCondition', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                >
                  <option value="on_resolution">Resolved</option>
                  <option value="on_closure">Closed</option>
                  <option value="on_status_change">Status Changed</option>
                  <option value="on_field_change">Field Changed</option>
                  <option value="manual">Manual Stop</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Tab */}
      {activeTab === 'actions' && (
        <div className="space-y-6">
          {/* Warning Actions */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Warning Actions
                </h3>
              </div>
              <button
                onClick={addWarningAction}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
              >
                <Plus className="h-4 w-4" />
                Add Action
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Actions to execute when the warning threshold is reached
            </p>

            {form.warningActions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                No warning actions configured
              </div>
            ) : (
              <div className="space-y-3">
                {form.warningActions.map((action, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-750 rounded-lg"
                  >
                    <select
                      value={action.action}
                      onChange={(e) => {
                        const newActions = [...form.warningActions];
                        newActions[index] = { ...action, action: e.target.value as ActionType };
                        updateForm('warningActions', newActions);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    >
                      <option value="notify">Send Notification</option>
                      <option value="escalate">Escalate</option>
                      <option value="reassign">Reassign</option>
                      <option value="update_field">Update Field</option>
                      <option value="webhook">Call Webhook</option>
                    </select>
                    <button
                      onClick={() => removeWarningAction(index)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Breach Actions */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Breach Actions
                </h3>
              </div>
              <button
                onClick={addBreachAction}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
              >
                <Plus className="h-4 w-4" />
                Add Action
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Actions to execute when the commitment is breached
            </p>

            {form.breachActions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                No breach actions configured
              </div>
            ) : (
              <div className="space-y-3">
                {form.breachActions.map((action, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-750 rounded-lg"
                  >
                    <select
                      value={action.action}
                      onChange={(e) => {
                        const newActions = [...form.breachActions];
                        newActions[index] = { ...action, action: e.target.value as ActionType };
                        updateForm('breachActions', newActions);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    >
                      <option value="notify">Send Notification</option>
                      <option value="escalate">Escalate</option>
                      <option value="reassign">Reassign</option>
                      <option value="update_field">Update Field</option>
                      <option value="webhook">Call Webhook</option>
                    </select>
                    <button
                      onClick={() => removeBreachAction(index)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Advanced Tab */}
      {activeTab === 'advanced' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            Pause Conditions
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Define conditions when the commitment clock should pause (e.g., when status is "On Hold")
          </p>

          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Pause className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p>No pause conditions configured</p>
            <button className="mt-3 flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg mx-auto">
              <Plus className="h-4 w-4" />
              Add Pause Condition
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
