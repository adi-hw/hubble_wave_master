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
  Code,
} from 'lucide-react';

interface EventPayloadField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required: boolean;
}

interface EventDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  eventType: 'record' | 'system' | 'custom' | 'integration';
  targetTable?: string;
  triggerConditions?: Record<string, any>;
  payloadSchema: EventPayloadField[];
  isAsync: boolean;
  retryPolicy: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier: number;
  };
  isActive: boolean;
  source: 'platform' | 'tenant';
}

const mockEvent: EventDefinition = {
  id: '1',
  code: 'work_order.status_changed',
  name: 'Work Order Status Changed',
  description: 'Fired when a work order status transitions to a new value',
  category: 'work_order',
  eventType: 'record',
  targetTable: 'work_order',
  triggerConditions: {
    field: 'status',
    changed: true,
  },
  payloadSchema: [
    {
      id: 'f1',
      name: 'workOrderId',
      type: 'string',
      description: 'The ID of the work order',
      required: true,
    },
    {
      id: 'f2',
      name: 'previousStatus',
      type: 'string',
      description: 'The previous status value',
      required: true,
    },
    {
      id: 'f3',
      name: 'newStatus',
      type: 'string',
      description: 'The new status value',
      required: true,
    },
    {
      id: 'f4',
      name: 'changedBy',
      type: 'string',
      description: 'User ID who made the change',
      required: true,
    },
    {
      id: 'f5',
      name: 'changedAt',
      type: 'string',
      description: 'Timestamp of the change',
      required: true,
    },
  ],
  isAsync: true,
  retryPolicy: {
    maxRetries: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2,
  },
  isActive: true,
  source: 'platform',
};

const eventTypeLabels: Record<string, string> = {
  record: 'Record Event',
  system: 'System Event',
  custom: 'Custom Event',
  integration: 'Integration Event',
};

const fieldTypeLabels: Record<string, string> = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
  object: 'Object',
  array: 'Array',
};

export const EventEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [event, setEvent] = useState<EventDefinition>(
    isNew
      ? {
          id: '',
          code: '',
          name: '',
          description: '',
          category: 'custom',
          eventType: 'custom',
          payloadSchema: [],
          isAsync: true,
          retryPolicy: {
            maxRetries: 3,
            retryDelayMs: 1000,
            backoffMultiplier: 2,
          },
          isActive: true,
          source: 'tenant',
        }
      : mockEvent
  );

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'schema' | 'conditions' | 'sample'>('schema');

  const selectedField = event.payloadSchema.find((f) => f.id === selectedFieldId);

  const handleChange = (field: keyof EventDefinition, value: any) => {
    setEvent((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleAddField = () => {
    const newField: EventPayloadField = {
      id: `field_${Date.now()}`,
      name: '',
      type: 'string',
      required: false,
    };
    setEvent((prev) => ({
      ...prev,
      payloadSchema: [...prev.payloadSchema, newField],
    }));
    setSelectedFieldId(newField.id);
    setHasChanges(true);
  };

  const handleRemoveField = (fieldId: string) => {
    setEvent((prev) => ({
      ...prev,
      payloadSchema: prev.payloadSchema.filter((f) => f.id !== fieldId),
    }));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
    setHasChanges(true);
  };

  const handleFieldChange = (fieldId: string, field: keyof EventPayloadField, value: any) => {
    setEvent((prev) => ({
      ...prev,
      payloadSchema: prev.payloadSchema.map((f) =>
        f.id === fieldId ? { ...f, [field]: value } : f
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
    if (window.confirm('Are you sure you want to delete this event?')) {
      navigate('/studio/events');
    }
  };

  const generateSamplePayload = () => {
    const sample: Record<string, any> = {};
    event.payloadSchema.forEach((field) => {
      switch (field.type) {
        case 'string':
          sample[field.name] = 'sample_value';
          break;
        case 'number':
          sample[field.name] = 123;
          break;
        case 'boolean':
          sample[field.name] = true;
          break;
        case 'object':
          sample[field.name] = {};
          break;
        case 'array':
          sample[field.name] = [];
          break;
      }
    });
    return JSON.stringify(sample, null, 2);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/studio/events')}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">
                  {isNew ? 'New Event' : event.name}
                </h1>
                {event.source === 'platform' && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                    Platform
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {event.code || 'Define event payload and conditions'}
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
              onClick={() => handleChange('isActive', !event.isActive)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                event.isActive
                  ? 'text-green-600 bg-green-50 hover:bg-green-100'
                  : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {event.isActive ? (
                <ToggleRight className="h-4 w-4" />
              ) : (
                <ToggleLeft className="h-4 w-4" />
              )}
              {event.isActive ? 'Active' : 'Inactive'}
            </button>

            {!isNew && event.source !== 'platform' && (
              <button
                onClick={handleDelete}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || event.source === 'platform'}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 px-6 bg-white border-b border-slate-200">
        <div className="flex gap-6">
          {[
            { id: 'schema', label: 'Payload Schema' },
            { id: 'conditions', label: 'Trigger Conditions' },
            { id: 'sample', label: 'Sample Payload' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'schema' && (
          <div className="h-full flex">
            {/* Fields List */}
            <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-medium text-slate-900">Payload Fields</h2>
                  {event.source !== 'platform' && (
                    <button
                      onClick={handleAddField}
                      className="flex items-center gap-1 px-2 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {event.payloadSchema.map((field) => (
                    <button
                      key={field.id}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedFieldId === field.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 truncate">
                            {field.name || '(unnamed)'}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>{fieldTypeLabels[field.type]}</span>
                            {field.required && (
                              <span className="text-amber-600">Required</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}

                  {event.payloadSchema.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No payload fields defined</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Field Details */}
            <div className="flex-1 overflow-y-auto">
              {selectedField ? (
                <div className="p-6 max-w-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">Field Configuration</h2>
                    {event.source !== 'platform' && (
                      <button
                        onClick={() => handleRemoveField(selectedField.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove Field
                      </button>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Field Name
                      </label>
                      <input
                        type="text"
                        value={selectedField.name}
                        onChange={(e) =>
                          handleFieldChange(selectedField.id, 'name', e.target.value)
                        }
                        disabled={event.source === 'platform'}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Type
                      </label>
                      <select
                        value={selectedField.type}
                        onChange={(e) =>
                          handleFieldChange(selectedField.id, 'type', e.target.value)
                        }
                        disabled={event.source === 'platform'}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                      >
                        {Object.entries(fieldTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={selectedField.description || ''}
                        onChange={(e) =>
                          handleFieldChange(selectedField.id, 'description', e.target.value)
                        }
                        disabled={event.source === 'platform'}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                      />
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedField.required}
                        onChange={(e) =>
                          handleFieldChange(selectedField.id, 'required', e.target.checked)
                        }
                        disabled={event.source === 'platform'}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-slate-700">Required field</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <div className="text-center">
                    <Code className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Select a field to configure</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'conditions' && (
          <div className="p-6 max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Trigger Conditions</h2>
            <p className="text-sm text-slate-500 mb-6">
              Define when this event should fire. Leave empty to fire on all changes.
            </p>

            {event.eventType === 'record' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Target Table
                  </label>
                  <input
                    type="text"
                    value={event.targetTable || ''}
                    onChange={(e) => handleChange('targetTable', e.target.value)}
                    disabled={event.source === 'platform'}
                    placeholder="e.g., work_order"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Condition Expression (JSON)
                  </label>
                  <textarea
                    value={JSON.stringify(event.triggerConditions || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const conditions = JSON.parse(e.target.value);
                        handleChange('triggerConditions', conditions);
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    disabled={event.source === 'platform'}
                    rows={8}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {event.eventType !== 'record' && (
              <div className="bg-slate-50 rounded-lg p-4 text-center text-slate-500">
                <p>
                  Trigger conditions are only available for record events.
                  {event.eventType === 'system' && ' System events are triggered by the platform.'}
                  {event.eventType === 'custom' && ' Custom events are triggered programmatically.'}
                  {event.eventType === 'integration' &&
                    ' Integration events are triggered by external systems.'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sample' && (
          <div className="p-6 max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Sample Payload</h2>
            <p className="text-sm text-slate-500 mb-6">
              This is an example of what the event payload will look like.
            </p>

            <div className="bg-slate-900 rounded-lg p-4 overflow-auto">
              <pre className="text-green-400 font-mono text-sm">{generateSamplePayload()}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Event Settings</h2>
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
                  Event Code
                </label>
                <input
                  type="text"
                  value={event.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                  disabled={event.source === 'platform'}
                  placeholder="e.g., work_order.status_changed"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={event.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  disabled={event.source === 'platform'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={event.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  disabled={event.source === 'platform'}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={event.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    disabled={event.source === 'platform'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  >
                    <option value="work_order">Work Order</option>
                    <option value="asset">Asset</option>
                    <option value="inventory">Inventory</option>
                    <option value="user">User</option>
                    <option value="system">System</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Event Type
                  </label>
                  <select
                    value={event.eventType}
                    onChange={(e) => handleChange('eventType', e.target.value)}
                    disabled={event.source === 'platform'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  >
                    {Object.entries(eventTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Retry Policy</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Max Retries
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={event.retryPolicy.maxRetries}
                      onChange={(e) =>
                        handleChange('retryPolicy', {
                          ...event.retryPolicy,
                          maxRetries: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Delay (ms)
                    </label>
                    <input
                      type="number"
                      min={100}
                      value={event.retryPolicy.retryDelayMs}
                      onChange={(e) =>
                        handleChange('retryPolicy', {
                          ...event.retryPolicy,
                          retryDelayMs: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Backoff
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={0.5}
                      value={event.retryPolicy.backoffMultiplier}
                      onChange={(e) =>
                        handleChange('retryPolicy', {
                          ...event.retryPolicy,
                          backoffMultiplier: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={event.isAsync}
                  onChange={(e) => handleChange('isAsync', e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Process asynchronously</span>
              </label>
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

export default EventEditorPage;
