/**
 * UIScriptsPage
 * HubbleWave Platform - Phase 3
 *
 * Page for managing client-side UI scripts that run in the browser.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Play,
  RefreshCw,
  Send,
  Table2,
  Code,
  Loader2,
  AlertCircle,
  Info,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import metadataApi from '../../../services/metadataApi';

type ClientScriptTrigger = 'onLoad' | 'onChange' | 'onSubmit' | 'onCellEdit';

interface ClientScript {
  id: string;
  name: string;
  description?: string;
  collectionId: string;
  formId?: string;
  trigger: ClientScriptTrigger;
  watchProperty?: string;
  conditionType: string;
  condition?: Record<string, unknown>;
  actions: unknown[];
  executionOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const TRIGGER_ICONS: Record<ClientScriptTrigger, React.ReactNode> = {
  onLoad: <Play className="w-4 h-4" />,
  onChange: <RefreshCw className="w-4 h-4" />,
  onSubmit: <Send className="w-4 h-4" />,
  onCellEdit: <Table2 className="w-4 h-4" />,
};

const TRIGGER_LABELS: Record<ClientScriptTrigger, string> = {
  onLoad: 'On Load',
  onChange: 'On Change',
  onSubmit: 'On Submit',
  onCellEdit: 'On Cell Edit',
};

const TRIGGER_DESCRIPTIONS: Record<ClientScriptTrigger, string> = {
  onLoad: 'Runs when the form or record is loaded',
  onChange: 'Runs when a specific property value changes',
  onSubmit: 'Runs before the form is submitted',
  onCellEdit: 'Runs when a cell is edited in the grid view',
};

const getTriggerClasses = (trigger: ClientScriptTrigger): string => {
  switch (trigger) {
    case 'onLoad':
      return 'border-primary text-primary';
    case 'onChange':
      return 'border-purple-600 text-purple-600';
    case 'onSubmit':
      return 'border-success-border text-success-text';
    case 'onCellEdit':
      return 'border-warning-border text-warning-text';
    default:
      return 'border-muted-foreground text-muted-foreground';
  }
};

interface ScriptEditorState {
  open: boolean;
  script?: ClientScript;
  isNew: boolean;
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: 'sm' | 'md';
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'h-4 w-7' : 'h-5 w-9';
  const thumbSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const translate = size === 'sm' ? 'translate-x-3' : 'translate-x-4';

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`toggle-track ${sizeClasses} ${checked ? 'toggle-track-on' : ''}`}
      >
        <span
          className={`toggle-thumb inline-block ${thumbSize} transform ${
            checked ? translate : 'translate-x-0.5'
          }`}
        />
      </button>
      {label && (
        <span className="text-sm text-foreground">
          {label}
        </span>
      )}
    </label>
  );
};

export const UIScriptsPage: React.FC = () => {
  const { id: collectionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [scripts, setScripts] = useState<ClientScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<ScriptEditorState>({ open: false, isNew: true });
  const [deleteConfirm, setDeleteConfirm] = useState<ClientScript | null>(null);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTrigger, setFormTrigger] = useState<ClientScriptTrigger>('onLoad');
  const [formWatchProperty, setFormWatchProperty] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formOrder, setFormOrder] = useState(100);
  const [saving, setSaving] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);

  const loadScripts = useCallback(async () => {
    if (!collectionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await metadataApi.get<ClientScript[]>(
        `/collections/${collectionId}/scripts`
      );
      setScripts(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to load scripts', err);
      setError('Failed to load UI scripts. The API may not be available yet.');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const handleCreate = () => {
    setFormName('');
    setFormDescription('');
    setFormTrigger('onLoad');
    setFormWatchProperty('');
    setFormIsActive(true);
    setFormOrder(100);
    setEditor({ open: true, isNew: true });
  };

  const handleEdit = (script: ClientScript) => {
    setFormName(script.name);
    setFormDescription(script.description || '');
    setFormTrigger(script.trigger);
    setFormWatchProperty(script.watchProperty || '');
    setFormIsActive(script.isActive);
    setFormOrder(script.executionOrder);
    setEditor({ open: true, script, isNew: false });
  };

  const handleCloseEditor = () => {
    setEditor({ open: false, isNew: true });
    setTriggerOpen(false);
  };

  const handleSave = async () => {
    if (!collectionId || !formName.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name: formName,
        description: formDescription || undefined,
        trigger: formTrigger,
        watchProperty: formTrigger === 'onChange' ? formWatchProperty : undefined,
        isActive: formIsActive,
        executionOrder: formOrder,
        conditionType: 'always',
        actions: editor.script?.actions || [],
      };

      if (editor.isNew) {
        await metadataApi.post(`/collections/${collectionId}/scripts`, payload);
      } else if (editor.script) {
        await metadataApi.put(
          `/collections/${collectionId}/scripts/${editor.script.id}`,
          payload
        );
      }
      handleCloseEditor();
      loadScripts();
    } catch (err) {
      console.error('Failed to save script', err);
      setError('Failed to save UI script. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!collectionId || !deleteConfirm) return;

    try {
      await metadataApi.delete(`/collections/${collectionId}/scripts/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      loadScripts();
    } catch (err) {
      console.error('Failed to delete script', err);
      setError('Failed to delete UI script. Please try again.');
    }
  };

  const handleToggleActive = async (script: ClientScript) => {
    if (!collectionId) return;
    try {
      await metadataApi.put(`/collections/${collectionId}/scripts/${script.id}`, {
        isActive: !script.isActive,
      });
      loadScripts();
    } catch (err) {
      console.error('Failed to toggle script', err);
    }
  };

  if (!collectionId) return null;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(`/studio/collections/${collectionId}`)}
          className="flex items-center gap-2 text-sm mb-4 transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Collection
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold mb-2 text-foreground">
              UI Scripts
            </h1>
            <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={() => navigate('/studio/collections')}
                className="transition-colors text-muted-foreground hover:text-foreground"
              >
                Collections
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
              <button
                type="button"
                onClick={() => navigate(`/studio/collections/${collectionId}`)}
                className="transition-colors text-muted-foreground hover:text-foreground"
              >
                {collectionId.slice(0, 8)}...
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
              <span className="text-foreground">UI Scripts</span>
            </nav>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New Script
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 mb-4 rounded border bg-info-subtle border-info-border text-info-text">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span className="text-sm">
          UI Scripts run in the browser to provide dynamic form behavior. Use them to show/hide
          fields, set default values, validate input, or display messages based on user actions.
        </span>
      </div>

      {error && (
        <div className="flex items-center justify-between p-3 mb-4 rounded border bg-warning-subtle border-warning-border text-warning-text">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 rounded hover:bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-lg border bg-card border-border">
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </div>
      )}

      {!loading && scripts.length === 0 && (
        <div className="rounded-lg border bg-card border-border">
          <div className="flex flex-col items-center py-8">
            <Code className="w-12 h-12 mb-4 text-muted-foreground/50" />
            <p className="mb-1 text-muted-foreground">
              No UI scripts configured
            </p>
            <p className="text-sm text-center max-w-sm mb-4 text-muted-foreground/50">
              UI Scripts let you add dynamic behavior to forms - show/hide fields based on values,
              set defaults, validate input, and more.
            </p>
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Create First Script
            </button>
          </div>
        </div>
      )}

      {!loading && scripts.length > 0 && (
        <div className="rounded-lg border overflow-hidden bg-card border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted border-border">
                <th className="p-3 text-left font-semibold text-muted-foreground">
                  Name
                </th>
                <th className="p-3 text-left font-semibold text-muted-foreground">
                  Trigger
                </th>
                <th className="p-3 text-left font-semibold text-muted-foreground">
                  Watch Property
                </th>
                <th className="p-3 text-center font-semibold text-muted-foreground">
                  Order
                </th>
                <th className="p-3 text-center font-semibold text-muted-foreground">
                  Active
                </th>
                <th className="p-3 text-right font-semibold text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((script) => (
                <tr
                  key={script.id}
                  className="border-b transition-colors border-border hover:bg-hover"
                >
                  <td className="p-3">
                    <div className="font-medium text-foreground">
                      {script.name}
                    </div>
                    {script.description && (
                      <div className="text-xs text-muted-foreground/50">
                        {script.description}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded ${getTriggerClasses(script.trigger)}`}
                      title={TRIGGER_DESCRIPTIONS[script.trigger]}
                    >
                      {TRIGGER_ICONS[script.trigger]}
                      {TRIGGER_LABELS[script.trigger]}
                    </span>
                  </td>
                  <td className="p-3">
                    {script.trigger === 'onChange' && script.watchProperty ? (
                      <code className="text-xs font-mono text-foreground">
                        {script.watchProperty}
                      </code>
                    ) : (
                      <span className="text-muted-foreground/50">{'\u2014'}</span>
                    )}
                  </td>
                  <td className="p-3 text-center text-foreground">
                    {script.executionOrder}
                  </td>
                  <td className="p-3 text-center">
                    <ToggleSwitch
                      checked={script.isActive}
                      onChange={() => handleToggleActive(script)}
                      size="sm"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(script)}
                        className="p-1.5 rounded transition-colors text-muted-foreground hover:bg-hover"
                        aria-label="Edit script"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(script)}
                        className="p-1.5 rounded transition-colors text-destructive hover:bg-danger-subtle"
                        aria-label="Delete script"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-overlay/50" onClick={handleCloseEditor} aria-hidden="true" />
          <div
            className="relative w-full max-w-md rounded-lg shadow-xl bg-card"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editor.isNew ? 'Create UI Script' : 'Edit UI Script'}
              </h2>
              <button
                type="button"
                onClick={handleCloseEditor}
                className="p-1 rounded text-muted-foreground hover:bg-hover"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  autoFocus
                  placeholder="e.g., Show warranty fields when type is Equipment"
                  className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                />
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  Script Name *
                </label>
              </div>

              <div className="relative">
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What does this script do?"
                  className="w-full px-3 py-2 rounded border text-sm resize-none bg-muted border-border text-foreground"
                />
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  Description
                </label>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTriggerOpen(!triggerOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                >
                  <span>{TRIGGER_LABELS[formTrigger]}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${triggerOpen ? 'rotate-180' : ''}`} />
                </button>
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  Trigger
                </label>
                {triggerOpen && (
                  <div className="absolute z-10 w-full mt-1 rounded border shadow-lg bg-card border-border">
                    {(['onLoad', 'onChange', 'onSubmit', 'onCellEdit'] as ClientScriptTrigger[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setFormTrigger(t);
                          setTriggerOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-hover"
                      >
                        <div className="font-medium">{TRIGGER_LABELS[t]}</div>
                        <div className="text-xs text-muted-foreground/50">
                          {TRIGGER_DESCRIPTIONS[t]}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {formTrigger === 'onChange' && (
                <div className="relative">
                  <input
                    type="text"
                    value={formWatchProperty}
                    onChange={(e) => setFormWatchProperty(e.target.value)}
                    placeholder="e.g., asset_type"
                    className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                  />
                  <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                    Watch Property
                  </label>
                  <span className="text-xs mt-1 block text-muted-foreground/50">
                    The property code to watch for changes
                  </span>
                </div>
              )}

              <div className="relative">
                <input
                  type="number"
                  value={formOrder}
                  onChange={(e) => setFormOrder(parseInt(e.target.value) || 100)}
                  className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                />
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  Execution Order
                </label>
                <span className="text-xs mt-1 block text-muted-foreground/50">
                  Lower numbers run first (default: 100)
                </span>
              </div>

              <ToggleSwitch checked={formIsActive} onChange={setFormIsActive} label="Active" />

              <div className="flex items-start gap-2 p-3 rounded border bg-info-subtle border-info-border text-info-text">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="text-xs">
                  After creating the script, you can configure actions like show/hide fields, set
                  values, make fields required, or show messages.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="px-4 py-2 text-sm rounded border transition-colors border-border text-foreground hover:bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="px-4 py-2 text-sm rounded transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-overlay/50" onClick={() => setDeleteConfirm(null)} aria-hidden="true" />
          <div
            className="relative w-full max-w-sm rounded-lg shadow-xl bg-card"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                Delete UI Script
              </h2>
            </div>
            <div className="p-4">
              <p className="text-foreground">
                Are you sure you want to delete the script "{deleteConfirm.name}"? This action
                cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm rounded border transition-colors border-border text-foreground hover:bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-sm rounded transition-colors bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
