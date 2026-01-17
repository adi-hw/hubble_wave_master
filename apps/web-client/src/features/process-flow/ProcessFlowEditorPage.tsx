/**
 * ProcessFlowEditorPage
 * HubbleWave Platform - Phase 4
 *
 * Visual process flow designer page with step configuration.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  Play,
  Pause,
  ArrowLeft,
  Settings,
  X,
  Check,
  Trash2,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { GlassButton } from '../../components/ui/glass/GlassButton';
import { GlassInput } from '../../components/ui/glass/GlassInput';
import { GlassModal } from '../../components/ui/glass/GlassModal';
import { ProcessFlowDesigner, ProcessFlowStep, ProcessFlowConnection } from '../admin/components/ProcessFlowDesigner';

interface ProcessFlowDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  triggerType: 'record_created' | 'record_updated' | 'property_changed' | 'scheduled' | 'manual';
  triggerConditions?: Record<string, unknown>;
  triggerSchedule?: string;
  triggerFilter?: Record<string, unknown>;
  collectionId?: string;
  canvas: {
    nodes: ProcessFlowStep[];
    connections: ProcessFlowConnection[];
  };
  maxRetries: number;
  retryDelaySeconds: number;
  version: number;
}

const triggerTypes = [
  { value: 'record_created', label: 'When Record is Created' },
  { value: 'record_updated', label: 'When Record is Updated' },
  { value: 'property_changed', label: 'When Property Changes' },
  { value: 'scheduled', label: 'On Schedule' },
  { value: 'manual', label: 'Manually Triggered' },
];

export const ProcessFlowEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [processFlow, setProcessFlow] = useState<ProcessFlowDefinition | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [, setHasChanges] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<string>('manual');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [collectionId, setCollectionId] = useState<string>('');

  const [steps, setSteps] = useState<ProcessFlowStep[]>([]);
  const [connections, setConnections] = useState<ProcessFlowConnection[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showStepConfig, setShowStepConfig] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      fetchProcessFlow(id);
    } else {
      const startStep: ProcessFlowStep = {
        id: 'start_1',
        type: 'start',
        name: 'Start',
        config: {},
        position: { x: 200, y: 50 },
      };
      setSteps([startStep]);
    }
  }, [id, isNew]);

  const fetchProcessFlow = async (processFlowId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/workflows/definitions/${processFlowId}`);
      if (!response.ok) throw new Error('Failed to fetch process flow');
      const data = await response.json();
      setProcessFlow(data);
      setName(data.name);
      setCode(data.code);
      setDescription(data.description || '');
      setTriggerType(data.triggerType);
      setTriggerConfig({
        ...(data.triggerConditions ? { conditions: data.triggerConditions } : {}),
        ...(data.triggerSchedule ? { schedule: data.triggerSchedule } : {}),
        ...(data.triggerFilter ? { filter: data.triggerFilter } : {}),
      });
      setCollectionId(data.collectionId || '');
      setSteps(data.canvas?.nodes || []);
      setConnections(data.canvas?.connections || []);
    } catch (error) {
      console.error('Error fetching process flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        code,
        description,
        triggerType,
        triggerConditions: triggerConfig.conditions as Record<string, unknown> | undefined,
        triggerSchedule: triggerConfig.schedule as string | undefined,
        triggerFilter: triggerConfig.filter as Record<string, unknown> | undefined,
        collectionId: collectionId || undefined,
        canvas: {
          nodes: steps,
          connections,
        },
      };

      const url = isNew
        ? '/api/workflows/definitions'
        : `/api/workflows/definitions/${id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save process flow');

      const savedProcessFlow = await response.json();
      setHasChanges(false);

      if (isNew) {
        navigate(`/process-flows/${savedProcessFlow.id}`, { replace: true });
      }
    } catch (error) {
      console.error('Error saving process flow:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !id) return;

    try {
      const response = await fetch(`/api/workflows/definitions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete process flow');
      navigate('/process-flows');
    } catch (error) {
      console.error('Error deleting process flow:', error);
    }
  };

  const handleToggleActive = async () => {
    if (isNew || !processFlow) return;

    try {
      const endpoint = processFlow.isActive
        ? `/api/workflows/definitions/${id}/deactivate`
        : `/api/workflows/definitions/${id}/activate`;

      const response = await fetch(endpoint, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to toggle process flow');

      const updated = await response.json();
      setProcessFlow({ ...processFlow, isActive: updated.isActive });
    } catch (error) {
      console.error('Error toggling process flow:', error);
    }
  };

  const handleStepsChange = useCallback((newSteps: ProcessFlowStep[]) => {
    setSteps(newSteps);
    setHasChanges(true);
  }, []);

  const handleConnectionsChange = useCallback((newConnections: ProcessFlowConnection[]) => {
    setConnections(newConnections);
    setHasChanges(true);
  }, []);

  const selectedStep = steps.find((s) => s.id === selectedStepId);

  const updateSelectedStep = (updates: Partial<ProcessFlowStep>) => {
    if (!selectedStepId) return;
    setSteps(
      steps.map((s) => (s.id === selectedStepId ? { ...s, ...updates } : s))
    );
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/process-flows')}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-hover"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Process Flow Name"
              className="text-lg font-semibold text-foreground bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              {isNew ? 'New Process Flow' : `Code: ${code}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isNew && processFlow && (
            <>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  processFlow.isActive
                    ? 'bg-success-subtle text-success-text'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {processFlow.isActive ? 'Active' : 'Inactive'}
              </span>
              <GlassButton
                onClick={handleToggleActive}
                variant="ghost"
                size="sm"
              >
                {processFlow.isActive ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Activate
                  </>
                )}
              </GlassButton>
            </>
          )}

          <GlassButton
            onClick={() => setShowSettings(true)}
            variant="ghost"
            size="sm"
          >
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </GlassButton>

          <GlassButton
            onClick={handleSave}
            variant="solid"
            size="sm"
            disabled={saving || !name.trim() || !code.trim()}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Save
              </>
            )}
          </GlassButton>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Designer */}
        <ProcessFlowDesigner
          steps={steps}
          onStepsChange={handleStepsChange}
          connections={connections}
          onConnectionsChange={handleConnectionsChange}
          selectedStepId={selectedStepId ?? undefined}
          onSelectStep={(id) => {
            setSelectedStepId(id);
            if (id) setShowStepConfig(true);
          }}
          className="flex-1"
        />

        {/* Step Configuration Panel */}
        {showStepConfig && selectedStep && (
          <div className="w-80 flex-shrink-0 bg-card border-l border-border overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-medium text-foreground">
                Configure Step
              </h3>
              <button
                onClick={() => setShowStepConfig(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Step Name
                </label>
                <GlassInput
                  value={selectedStep.name}
                  onChange={(e) => updateSelectedStep({ name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Step Type
                </label>
                <p className="text-sm text-muted-foreground capitalize">
                  {selectedStep.type.replace('_', ' ')}
                </p>
              </div>

              {/* Type-specific configuration */}
              {selectedStep.type === 'condition' && (
                <ConditionConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {selectedStep.type === 'wait' && (
                <WaitConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {selectedStep.type === 'send_email' && (
                <NotificationConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {selectedStep.type === 'send_notification' && (
                <NotificationConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {selectedStep.type === 'update_record' && (
                <UpdateRecordConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {selectedStep.type === 'create_approval' && (
                <ApprovalConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <GlassModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Process Flow Settings"
        size="lg"
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Process Flow Name
              </label>
              <GlassInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter process flow name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Process Flow Code
              </label>
              <GlassInput
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="process_flow_code"
                disabled={!isNew}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary-500"
              placeholder="Describe what this process flow does..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Trigger Type
            </label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary-500"
            >
              {triggerTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {triggerType === 'scheduled' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Schedule (Cron Expression)
              </label>
              <GlassInput
                value={(triggerConfig.schedule as string) || ''}
                onChange={(e) =>
                  setTriggerConfig({ ...triggerConfig, schedule: e.target.value })
                }
                placeholder="0 0 * * *"
              />
              <p className="text-xs text-muted-foreground mt-1">
                e.g., "0 0 * * *" for daily at midnight
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-border">
            {!isNew && (
              <GlassButton
                variant="danger"
                onClick={() => {
                  setShowSettings(false);
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Process Flow
              </GlassButton>
            )}
            <div className="flex gap-3 ml-auto">
              <GlassButton variant="ghost" onClick={() => setShowSettings(false)}>
                Cancel
              </GlassButton>
              <GlassButton variant="solid" onClick={() => setShowSettings(false)}>
                <Check className="h-4 w-4 mr-2" />
                Apply
              </GlassButton>
            </div>
          </div>
        </div>
      </GlassModal>

      {/* Delete Confirmation */}
      <GlassModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Process Flow"
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 p-4 bg-danger-subtle rounded-lg mb-4">
            <AlertTriangle className="h-5 w-5 text-danger-text" />
            <p className="text-sm text-danger-text">
              This action cannot be undone.
            </p>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Are you sure you want to delete this process flow? All instances and history
            will be permanently removed.
          </p>
          <div className="flex justify-end gap-3">
            <GlassButton variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </GlassButton>
            <GlassButton variant="danger" onClick={handleDelete}>
              Delete
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

// Step Configuration Components

const ConditionConfig: React.FC<{
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Condition Expression
      </label>
      <textarea
        value={config.expression || ''}
        onChange={(e) => onChange({ ...config, expression: e.target.value })}
        rows={3}
        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm font-mono"
        placeholder="record.status === 'approved'"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Use JavaScript expressions. Access record data via the `record` object.
      </p>
    </div>
  </div>
);

const WaitConfig: React.FC<{
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Wait Type
      </label>
      <select
        value={config.waitType || 'duration'}
        onChange={(e) => onChange({ ...config, waitType: e.target.value })}
        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
      >
        <option value="duration">Duration</option>
        <option value="until_date">Until Date</option>
        <option value="until_condition">Until Condition</option>
      </select>
    </div>

    {config.waitType === 'duration' && (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Value</label>
          <GlassInput
            type="number"
            value={config.durationValue || 1}
            onChange={(e) =>
              onChange({ ...config, durationValue: parseInt(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Unit</label>
          <select
            value={config.durationUnit || 'hours'}
            onChange={(e) => onChange({ ...config, durationUnit: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>
    )}
  </div>
);

const NotificationConfig: React.FC<{
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Template Code
      </label>
      <GlassInput
        value={config.templateCode || ''}
        onChange={(e) => onChange({ ...config, templateCode: e.target.value })}
        placeholder="notification_template_code"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Recipients
      </label>
      <GlassInput
        value={config.recipients || ''}
        onChange={(e) => onChange({ ...config, recipients: e.target.value })}
        placeholder="user_id_1, user_id_2"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Data (JSON)
      </label>
      <textarea
        value={config.data || ''}
        onChange={(e) => onChange({ ...config, data: e.target.value })}
        rows={4}
        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
        placeholder='{"recordId": "{{recordId}}"}'
      />
    </div>
  </div>
);

const UpdateRecordConfig: React.FC<{
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Properties to Update
      </label>
      {(config.properties || []).map((property: { key: string; value: string }, idx: number) => (
        <div key={idx} className="flex gap-2 mb-2">
          <GlassInput
            value={property.key}
            onChange={(e) => {
              const properties = [...(config.properties || [])];
              properties[idx] = { ...property, key: e.target.value };
              onChange({ ...config, properties });
            }}
            placeholder="Property name"
            className="flex-1"
          />
          <GlassInput
            value={property.value}
            onChange={(e) => {
              const properties = [...(config.properties || [])];
              properties[idx] = { ...property, value: e.target.value };
              onChange({ ...config, properties });
            }}
            placeholder="Value"
            className="flex-1"
          />
          <button
            onClick={() => {
              const properties = (config.properties || []).filter((_: any, i: number) => i !== idx);
              onChange({ ...config, properties });
            }}
            className="p-2 text-danger-text hover:bg-danger-subtle rounded"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => {
          const properties = [...(config.properties || []), { key: '', value: '' }];
          onChange({ ...config, properties });
        }}
        className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
      >
        <Plus className="h-4 w-4" />
        Add Property
      </button>
    </div>
  </div>
);

const ApprovalConfig: React.FC<{
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Approvers
      </label>
      <GlassInput
        value={config.approvers || ''}
        onChange={(e) => onChange({ ...config, approvers: e.target.value })}
        placeholder="User IDs or ${record.manager_id}"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Comma-separated user IDs or dynamic expressions
      </p>
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Approval Type
      </label>
      <select
        value={config.approvalType || 'sequential'}
        onChange={(e) => onChange({ ...config, approvalType: e.target.value })}
        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
      >
        <option value="sequential">Sequential (one after another)</option>
        <option value="parallel_any">Parallel - Any (first to respond)</option>
        <option value="parallel_all">Parallel - All (everyone must approve)</option>
      </select>
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Due Date (optional)
      </label>
      <GlassInput
        type="number"
        value={config.dueDays || ''}
        onChange={(e) => onChange({ ...config, dueDays: parseInt(e.target.value) || undefined })}
        placeholder="Days until due"
      />
    </div>
  </div>
);

export default ProcessFlowEditorPage;
