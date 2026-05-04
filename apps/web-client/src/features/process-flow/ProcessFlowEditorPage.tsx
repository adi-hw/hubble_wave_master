/**
 * ProcessFlowEditorPage
 * HubbleWave Platform - Phase 4
 *
 * Visual process flow designer page with step configuration.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import { FlowStudio, type ProcessFlowStep, type ProcessFlowConnection } from '../admin/components/FlowStudio';
import { FlowTestRunner } from './FlowTestRunner';
import { DataPillButton } from '../../components/data-pill/DataPillButton';
import { useDataPillCategories } from '../../components/data-pill/useDataPillCategories';
import {
  processFlowsService,
  type ProcessFlowDefinition,
  type SaveProcessFlowDefinitionBody,
} from '../../services/process-flows.service';

const triggerTypes = [
  { value: 'record_created', label: 'When Record is Created' },
  { value: 'record_updated', label: 'When Record is Updated' },
  { value: 'property_changed', label: 'When Property Changes' },
  { value: 'scheduled', label: 'On Schedule' },
  { value: 'manual', label: 'Manually Triggered' },
  { value: 'ava_initiated', label: 'AVA-Initiated (tool dispatch)' },
  { value: 'metric_threshold', label: 'On Metric Threshold' },
  { value: 'service_catalog', label: 'Service Catalog Submission' },
  { value: 'webhook', label: 'Inbound Webhook (REST trigger)' },
];

const formatStepType = (value: string): string =>
  value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');

const toFlowCode = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

type PersistedProcessFlowStep = Partial<ProcessFlowStep> & {
  config?: Record<string, unknown> & {
    actionType?: unknown;
    actionConfig?: unknown;
  };
};

const denormalizeCanvasSteps = (nodes: unknown[] | undefined): ProcessFlowStep[] =>
  (nodes ?? []).map((node) => {
    const step = node as PersistedProcessFlowStep;
    const actionType = typeof step.config?.actionType === 'string' ? step.config.actionType : null;
    const actionConfig =
      step.config?.actionConfig && typeof step.config.actionConfig === 'object'
        ? (step.config.actionConfig as Record<string, unknown>)
        : {};

    if (step.type === 'action' && actionType) {
      return {
        ...(step as ProcessFlowStep),
        type: actionType,
        config: actionConfig,
      };
    }

    return step as ProcessFlowStep;
  });

export const ProcessFlowEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === 'new';
  // When the editor is opened from a collection-scoped surface (App
  // Studio Flows tab), the panel passes ?collectionId=… so the new
  // flow saves bound to that collection and reappears in the panel.
  const initialCollectionId = searchParams.get('collectionId') ?? '';

  const [processFlow, setProcessFlow] = useState<ProcessFlowDefinition | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeEdited, setCodeEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<string>('manual');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [collectionId, setCollectionId] = useState<string>(initialCollectionId);

  const [steps, setSteps] = useState<ProcessFlowStep[]>([]);
  const [connections, setConnections] = useState<ProcessFlowConnection[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [testRunnerOpen, setTestRunnerOpen] = useState(false);
  const [showStepConfig, setShowStepConfig] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // useCallback with cancellation: on rapid id-to-id navigation, the
  // previous fetch resolves into the second navigation's state without
  // this guard. The cleanup flips `cancelled` so a late-arriving
  // response from the previous id is dropped.
  const fetchProcessFlow = useCallback(
    async (processFlowId: string, isCancelled: () => boolean = () => false) => {
      setLoading(true);
      try {
        const data = await processFlowsService.get(processFlowId);
        if (isCancelled()) return;
        setProcessFlow(data);
        setName(data.name);
        setCode(data.code);
        setCodeEdited(true);
        setDescription(data.description || '');
        setTriggerType(data.triggerType);
        setTriggerConfig({
          ...(data.triggerConditions ? { conditions: data.triggerConditions } : {}),
          ...(data.triggerSchedule ? { schedule: data.triggerSchedule } : {}),
          ...(data.triggerFilter ? { filter: data.triggerFilter } : {}),
        });
        setCollectionId(data.collectionId || '');
        setSteps(denormalizeCanvasSteps(data.canvas?.nodes));
        // Existing flows authored against an earlier connection shape
        // may carry { from, to } — translate to { fromNode, toNode }
        // on load so the editor and engine see one consistent shape.
        const rawConnections = (data.canvas?.connections || []) as Array<
          Partial<ProcessFlowConnection> & { from?: string; to?: string }
        >;
        setConnections(
          rawConnections
            .map((c) => ({
              fromNode: c.fromNode ?? c.from ?? '',
              toNode: c.toNode ?? c.to ?? '',
              label: c.label,
            }))
            .filter((c) => c.fromNode && c.toNode),
        );
      } catch (err) {
        if (isCancelled()) return;
        const msg = err instanceof Error ? err.message : 'Failed to load process flow';
        setError(msg);
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    if (!isNew && id) {
      void fetchProcessFlow(id, () => cancelled);
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
    return () => {
      cancelled = true;
    };
  }, [id, isNew, fetchProcessFlow]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (isNew && !codeEdited) {
      setCode(toFlowCode(value));
    }
    setHasChanges(true);
  };

  const handleCodeChange = (value: string) => {
    setCode(toFlowCode(value));
    setCodeEdited(true);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) {
      return;
    }

    setSaving(true);
    try {
    const payload: SaveProcessFlowDefinitionBody = {
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

      const savedProcessFlow = isNew
        ? await processFlowsService.create(payload)
        : await processFlowsService.update(id!, payload);
      setHasChanges(false);
      setProcessFlow(savedProcessFlow);

      if (isNew) {
        navigate(`/process-flows/${savedProcessFlow.id}`, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save process flow';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !id) return;

    try {
      await processFlowsService.delete(id);
      navigate('/process-flows');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete process flow';
      setError(msg);
    }
  };

  const handleToggleActive = async () => {
    if (isNew || !processFlow) return;

    try {
      const updated = processFlow.isActive
        ? await processFlowsService.deactivate(id!)
        : await processFlowsService.activate(id!);
      setProcessFlow({ ...processFlow, isActive: updated.isActive });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle active state';
      setError(msg);
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
  const selectedStepType = selectedStep?.type ?? '';
  const isSelectedStepType = (...types: string[]) => types.includes(selectedStepType);

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
    <div className="flex h-[calc(100vh-8rem)] min-h-[680px] min-w-0 flex-col overflow-hidden bg-background">
      {error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive-text"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-destructive-text hover:opacity-80"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <button
            onClick={() => navigate('/process-flows')}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-hover"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              aria-label="Process Flow Name"
              placeholder="Process Flow Name"
              className="w-full min-w-0 bg-transparent text-lg font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
            />
            <p className="text-sm text-muted-foreground">
              {isNew ? 'New Process Flow' : `Code: ${code}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:justify-end">
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

          {!isNew ? (
            <GlassButton
              onClick={() => setTestRunnerOpen(true)}
              variant="ghost"
              size="sm"
              disabled={saving}
              title="Run the flow against mock input - dry-run by default"
            >
              <Play className="h-4 w-4 mr-1" />
              Test
            </GlassButton>
          ) : null}

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
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {!isNew && id ? (
          <FlowTestRunner
            flowId={id}
            flowCode={code}
            open={testRunnerOpen}
            onClose={() => setTestRunnerOpen(false)}
          />
        ) : null}
        {/* Designer */}
        <FlowStudio
          steps={steps}
          onStepsChange={handleStepsChange}
          connections={connections}
          onConnectionsChange={handleConnectionsChange}
          selectedStepId={selectedStepId ?? undefined}
          onSelectStep={(id) => {
            setSelectedStepId(id);
            if (id) setShowStepConfig(true);
          }}
          className="min-h-0 flex-1"
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
                  {formatStepType(selectedStep.type)}
                </p>
              </div>

              {/* Type-specific configuration */}
              {isSelectedStepType('condition') && (
                <ConditionConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('wait') && (
                <WaitConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('SendNotification', 'send_email', 'send_notification') && (
                <NotificationConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('UpdateRecord', 'update_record') && (
                <UpdateRecordConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('CreateRecord', 'create_record') && (
                <CreateRecordConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('CreateApproval', 'create_approval') && (
                <ApprovalConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('DeleteRecord', 'delete_record', 'LookUpRecord', 'lookup_record') && (
                <RecordReferenceConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('MakeDecision', 'make_decision') && (
                <MakeDecisionConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('HTTPRequest', 'http_request') && (
                <HttpRequestConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('CallFlowModule', 'call_flow_module') && (
                <CallFlowModuleConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('RunAVAPrompt', 'run_ava_prompt') && (
                <RunAvaPromptConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('SetFieldValue', 'set_field_value') && (
                <SetFieldValueConfig
                  config={selectedStep.config}
                  onChange={(config) => updateSelectedStep({ config })}
                />
              )}

              {isSelectedStepType('WaitForApproval', 'wait_for_approval') && (
                <WaitForApprovalConfig
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
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter process flow name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Process Flow Code
              </label>
              <GlassInput
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
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

          {triggerType === 'webhook' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Webhook secret
                </label>
                <div className="flex gap-2">
                  <GlassInput
                    value={
                      (((triggerConfig.conditions as Record<string, unknown> | undefined)
                        ?.webhookSecret as string) || '')
                    }
                    onChange={(e) => {
                      const conditions = {
                        ...((triggerConfig.conditions as Record<string, unknown> | undefined) ?? {}),
                        webhookSecret: e.target.value,
                      };
                      setTriggerConfig({ ...triggerConfig, conditions });
                    }}
                    placeholder="A long random string the caller sends as X-Webhook-Secret"
                  />
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Generate a 256-bit secret using the platform Web
                      // Crypto API. The caller stores this once at
                      // creation time and shares it out-of-band with
                      // the integration that will hit the webhook.
                      const bytes = new Uint8Array(32);
                      crypto.getRandomValues(bytes);
                      const secret = Array.from(bytes)
                        .map((b) => b.toString(16).padStart(2, '0'))
                        .join('');
                      const conditions = {
                        ...((triggerConfig.conditions as Record<string, unknown> | undefined) ??
                          {}),
                        webhookSecret: secret,
                      };
                      setTriggerConfig({ ...triggerConfig, conditions });
                    }}
                  >
                    Generate
                  </GlassButton>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Required. <code>WorkflowWebhookController</code> rejects calls without a
                  matching <code>X-Webhook-Secret</code> header. Without this set, the
                  webhook flow can publish but cannot be triggered.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Endpoint
                </label>
                <code className="block rounded border border-border bg-muted px-2 py-1 font-mono text-xs">
                  POST /api/workflows/webhook/{code || '<flow-code>'}/trigger
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  Caller sends the webhook secret as <code>X-Webhook-Secret</code> and a
                  JSON body that the engine surfaces as <code>{'{{trigger.body}}'}</code>
                  to the flow.
                </p>
              </div>
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
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Condition Expression
      </label>
      <textarea
        value={(config.expression as string) || ''}
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
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Wait Type
      </label>
      <select
        value={(config.waitType as string) || 'duration'}
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
            value={(config.durationValue as number) || 1}
            onChange={(e) =>
              onChange({ ...config, durationValue: parseInt(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Unit</label>
          <select
            value={(config.durationUnit as string) || 'hours'}
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

// Catalog: SendNotification → { templateCode, recipientUserId, data? }.
const NotificationConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Template Code
      </label>
      <GlassInput
        value={(config.templateCode as string) || ''}
        onChange={(e) => onChange({ ...config, templateCode: e.target.value })}
        placeholder="notification_template_code"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Recipient (user UUID)
      </label>
      <GlassInput
        value={(config.recipientUserId as string) || ''}
        onChange={(e) => onChange({ ...config, recipientUserId: e.target.value })}
        placeholder="00000000-0000-0000-0000-000000000000"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Single user UUID. Use a sequence of notification steps (or a future
        bulk-notification action) for multi-recipient delivery.
      </p>
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Data (JSON)
      </label>
      <textarea
        value={(config.data as string) || ''}
        onChange={(e) => onChange({ ...config, data: e.target.value })}
        rows={4}
        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
        placeholder='{"recordId": "{{recordId}}"}'
      />
    </div>
  </div>
);

// Internal shape for the editor's key/value rows. The runtime
// catalog requires `values: { propertyCode: value, ... }` as a flat
// object, so we render rows for ergonomics and assemble the object
// on every change.
interface PropertyRow {
  key: string;
  value: string;
}

const propertyRowsFromValues = (values: unknown): PropertyRow[] => {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return [];
  return Object.entries(values as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value ?? ''),
  }));
};

const valuesFromPropertyRows = (rows: PropertyRow[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const { key, value } of rows) {
    if (!key) continue;
    out[key] = value;
  }
  return out;
};

interface ValueRowsEditorProps {
  rows: PropertyRow[];
  onChange: (rows: PropertyRow[]) => void;
}

const ValueRowsEditor: React.FC<ValueRowsEditorProps> = ({ rows, onChange }) => (
  <div>
    {rows.map((row, idx) => (
      <div key={idx} className="flex gap-2 mb-2">
        <GlassInput
          value={row.key}
          onChange={(e) => {
            const next = [...rows];
            next[idx] = { ...row, key: e.target.value };
            onChange(next);
          }}
          placeholder="propertyCode"
          className="flex-1"
        />
        <GlassInput
          value={row.value}
          onChange={(e) => {
            const next = [...rows];
            next[idx] = { ...row, value: e.target.value };
            onChange(next);
          }}
          placeholder="Value or {{binding}}"
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => onChange(rows.filter((_, i) => i !== idx))}
          className="p-2 text-danger-text hover:bg-danger-subtle rounded"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ))}
    <button
      type="button"
      onClick={() => onChange([...rows, { key: '', value: '' }])}
      className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
    >
      <Plus className="h-4 w-4" />
      Add value
    </button>
  </div>
);

// Catalog: UpdateRecord → { collectionCode, recordId, values }.
const UpdateRecordConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const rows = propertyRowsFromValues(config.values);
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Collection code
        </label>
        <GlassInput
          value={(config.collectionCode as string) || ''}
          onChange={(e) => onChange({ ...config, collectionCode: e.target.value })}
          placeholder="work_orders"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Record id
        </label>
        <GlassInput
          value={(config.recordId as string) || ''}
          onChange={(e) => onChange({ ...config, recordId: e.target.value })}
          placeholder="{{trigger.recordId}}"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Values
        </label>
        <ValueRowsEditor
          rows={rows}
          onChange={(next) => onChange({ ...config, values: valuesFromPropertyRows(next) })}
        />
      </div>
    </div>
  );
};

// Catalog: CreateRecord → { collectionCode, values }.
const CreateRecordConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const rows = propertyRowsFromValues(config.values);
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Collection code
        </label>
        <GlassInput
          value={(config.collectionCode as string) || ''}
          onChange={(e) => onChange({ ...config, collectionCode: e.target.value })}
          placeholder="work_orders"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Values
        </label>
        <ValueRowsEditor
          rows={rows}
          onChange={(next) => onChange({ ...config, values: valuesFromPropertyRows(next) })}
        />
      </div>
    </div>
  );
};

// Catalog: CreateApproval → { subject, description?, assigneeUserIds: uuid[] }.
// approvalType / dueDays remain as additional config consumed by the
// engine's approval-node lifecycle (sequential vs parallel,
// SLA timer); they're not part of the action's typed I/O contract
// but they ARE persisted on the canvas alongside the catalog inputs.
const ApprovalConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const assigneeIds = Array.isArray(config.assigneeUserIds)
    ? (config.assigneeUserIds as string[]).join(', ')
    : '';
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Subject
        </label>
        <GlassInput
          value={(config.subject as string) || ''}
          onChange={(e) => onChange({ ...config, subject: e.target.value })}
          placeholder="Review work order before close"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Description (optional)
        </label>
        <textarea
          value={(config.description as string) || ''}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Assignee user IDs
        </label>
        <GlassInput
          value={assigneeIds}
          onChange={(e) =>
            onChange({
              ...config,
              assigneeUserIds: e.target.value
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean),
            })
          }
          placeholder="uuid_1, uuid_2"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Comma-separated UUIDs. Each becomes one Approval row routed to the
          named user.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Approval Type
        </label>
        <select
          value={(config.approvalType as string) || 'sequential'}
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
          Due in (days, optional)
        </label>
        <GlassInput
          type="number"
          value={(config.dueDays as number) || ''}
          onChange={(e) => onChange({ ...config, dueDays: parseInt(e.target.value) || undefined })}
          placeholder="Days until due"
        />
      </div>
    </div>
  );
};

// Catalog: DeleteRecord and LookUpRecord both take { collectionCode, recordId }.
const RecordReferenceConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Collection code
      </label>
      <GlassInput
        value={(config.collectionCode as string) || ''}
        onChange={(e) => onChange({ ...config, collectionCode: e.target.value })}
        placeholder="work_orders"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Record id
      </label>
      <GlassInput
        value={(config.recordId as string) || ''}
        onChange={(e) => onChange({ ...config, recordId: e.target.value })}
        placeholder="{{trigger.recordId}}"
      />
    </div>
  </div>
);

/**
 * Stores `value` as the parsed JSON object when the text is valid,
 * or as the raw string (so the user can keep typing through an
 * invalid intermediate state). The runtime engine's interpolateObject
 * recurses into objects to resolve {{path}} bindings per leaf — that
 * preserves the underlying type (a number stays a number); when the
 * value is still a string, interpolation runs on the whole document
 * and types collapse to strings. Object form is the better path
 * whenever we can get there.
 */
const commitJsonField = (raw: string): unknown => {
  if (raw.trim() === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const renderJsonField = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
};

// Catalog: MakeDecision → { tableCode, inputs: json }.
const MakeDecisionConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Decision Table code
      </label>
      <GlassInput
        value={(config.tableCode as string) || ''}
        onChange={(e) => onChange({ ...config, tableCode: e.target.value })}
        placeholder="risk_score_table"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Code of a published Decision Table on this collection.
      </p>
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Inputs (JSON)
      </label>
      <textarea
        value={renderJsonField(config.inputs)}
        onChange={(e) => onChange({ ...config, inputs: commitJsonField(e.target.value) })}
        rows={6}
        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm font-mono"
        placeholder='{"tier": "{{record.tier}}", "amount": 1500}'
      />
      <p className="text-xs text-muted-foreground mt-1">
        Map of input name -&gt; value. Bindings (<code>{'{{record.field}}'}</code>) resolve at
        runtime against the trigger record and prior step outputs.
      </p>
    </div>
  </div>
);

// Catalog: HTTPRequest → { connectorCode, method, path, body? }.
const HttpRequestConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Connector code
      </label>
      <GlassInput
        value={(config.connectorCode as string) || ''}
        onChange={(e) => onChange({ ...config, connectorCode: e.target.value })}
        placeholder="weather_api"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Code of a registered HTTP Connector. Authenticated connectors require
        Vault-backed authenticated connectors are not available yet.
      </p>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Method</label>
        <select
          value={(config.method as string) || 'GET'}
          onChange={(e) => onChange({ ...config, method: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-foreground mb-1">Path</label>
        <GlassInput
          value={(config.path as string) || ''}
          onChange={(e) => onChange({ ...config, path: e.target.value })}
          placeholder="/v1/forecast"
        />
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Body (JSON, optional)
      </label>
      <textarea
        value={renderJsonField(config.body)}
        onChange={(e) => onChange({ ...config, body: commitJsonField(e.target.value) })}
        rows={4}
        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm font-mono"
      />
    </div>
  </div>
);

// Catalog: CallFlowModule -> { flowCode, inputs? }.
const CallFlowModuleConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Flow module code
      </label>
      <GlassInput
        value={(config.flowCode as string) || ''}
        onChange={(e) => onChange({ ...config, flowCode: e.target.value })}
        placeholder="notify_owner"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Inputs (JSON, optional)
      </label>
      <textarea
        value={renderJsonField(config.inputs)}
        onChange={(e) => onChange({ ...config, inputs: commitJsonField(e.target.value) })}
        rows={4}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm text-foreground"
        placeholder='{"recordId": "{{trigger.recordId}}"}'
      />
    </div>
  </div>
);

// Catalog: RunAVAPrompt -> { promptCode, inputs? }.
const RunAvaPromptConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        AVA prompt code
      </label>
      <GlassInput
        value={(config.promptCode as string) || ''}
        onChange={(e) => onChange({ ...config, promptCode: e.target.value })}
        placeholder="summarize_request"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Inputs (JSON, optional)
      </label>
      <textarea
        value={renderJsonField(config.inputs)}
        onChange={(e) => onChange({ ...config, inputs: commitJsonField(e.target.value) })}
        rows={4}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm text-foreground"
        placeholder='{"summary": "{{trigger.short_description}}"}'
      />
    </div>
  </div>
);

/**
 * Catalog: SetFieldValue → { collectionCode, recordId, propertyCode, value }.
 * Use this over UpdateRecord when only one property changes — the
 * runtime is a touch faster (no values-payload validation pass) and
 * the canvas reads more clearly.
 */
const SetFieldValueConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  // Plan §8.1.4 — DataPillPicker surfaces the same Trigger / User /
  // System taxonomy here that Form Builder default-value editor and
  // Automation Rule conditions use. The button next to "Record id"
  // and "Value" inserts the canonical {trigger.x} / {user.id} /
  // {system.now} tokens authors otherwise have to type by hand.
  const pillCategories = useDataPillCategories({ triggerProperties: [] });
  const insertAt = (key: 'recordId' | 'value', token: string) => {
    const current = (config[key] as string | undefined) ?? '';
    onChange({ ...config, [key]: `${current}${token}` });
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Collection code
        </label>
        <GlassInput
          value={(config.collectionCode as string) || ''}
          onChange={(e) => onChange({ ...config, collectionCode: e.target.value })}
          placeholder="work_orders"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Record id
        </label>
        <div className="flex gap-2">
          <GlassInput
            value={(config.recordId as string) || ''}
            onChange={(e) => onChange({ ...config, recordId: e.target.value })}
            placeholder="{{trigger.recordId}}"
          />
          <DataPillButton
            categories={pillCategories}
            onSelect={(token) => insertAt('recordId', token)}
            title="Insert variable into Record id"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Property code
        </label>
        <GlassInput
          value={(config.propertyCode as string) || ''}
          onChange={(e) => onChange({ ...config, propertyCode: e.target.value })}
          placeholder="priority"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Value (JSON)
        </label>
        <div className="flex gap-2">
          <textarea
            value={renderJsonField(config.value)}
            onChange={(e) => onChange({ ...config, value: commitJsonField(e.target.value) })}
            rows={3}
            className="flex-1 px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm font-mono"
            placeholder='"high"'
          />
          <DataPillButton
            categories={pillCategories}
            onSelect={(token) => insertAt('value', `"${token}"`)}
            title="Insert variable into Value"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Literal JSON OR a binding (<code>{'"{{stepOutputs.x.priority}}"'}</code>).
          Strings need surrounding quotes; numbers and booleans don't.
        </p>
      </div>
    </div>
  );
};

/**
 * Catalog: WaitForApproval → { approvalId }. Pairs with a prior
 * CreateApproval step — its output approvalId binds here. The
 * runtime parks the flow until the approval resolves (approved /
 * rejected), then surfaces `decision` and `comment` as step outputs.
 */
const WaitForApprovalConfig: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Approval id
      </label>
      <GlassInput
        value={(config.approvalId as string) || ''}
        onChange={(e) => onChange({ ...config, approvalId: e.target.value })}
        placeholder="{{stepOutputs.create_approval_1.approvalId}}"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Bind to the <code>approvalId</code> output of a prior CreateApproval
        step. Outputs <code>decision</code> (approved / rejected) and{' '}
        <code>comment</code> are available to downstream steps.
      </p>
    </div>
  </div>
);

export default ProcessFlowEditorPage;
