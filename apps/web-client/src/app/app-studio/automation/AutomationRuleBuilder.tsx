import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Upload, Power, PowerOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ConfirmModal } from '../../../components/ui/Modal';
import { useStudioCollection } from '../table-builder/CollectionContext';
import { automationApi, type Automation } from '../../../services/automationApi';
import {
  DISABLED_OPACITY,
  STATUS_PILL_NEUTRAL,
  STATUS_PILL_PENDING,
  STATUS_PILL_SUCCESS,
  DESTRUCTIVE_ICON_BUTTON,
  INACTIVE_ROW_CLASS,
  NEUTRAL_ICON_BUTTON,
} from '../../../lib/styling';

const TIMING_LABEL: Record<string, string> = {
  before: 'Before',
  after: 'After',
  async: 'Async',
};

/**
 * Plan 9.2 - collection-scoped Automation Rules surface inside App
 * Studio. Mirrors the lifecycle of the sibling Phase 3 panels
 * (ProcessFlowsPanel / DecisionTablesPanel / GuidedProcessesPanel):
 * list, publish, toggle active, deprecate, delete. The visual rule
 * editor itself reuses the existing AutomationEditorPage at
 * /admin/automations/:id; that page is reached via the row's edit
 * button so a delegated editor is never routed to the admin
 * Workspace root.
 */
export const AutomationRuleBuilder: React.FC = () => {
  const collection = useStudioCollection();
  const navigate = useNavigate();
  const [rules, setRules] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Automation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await automationApi.getAutomations(collection.id, true);
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Automation Rules');
    } finally {
      setLoading(false);
    }
  }, [collection.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPublish = async (rule: Automation) => {
    setBusyId(rule.id);
    try {
      await automationApi.publishAutomation(rule.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusyId(null);
    }
  };

  const onToggle = async (rule: Automation) => {
    setBusyId(rule.id);
    try {
      await automationApi.toggleActive(rule.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await automationApi.deleteAutomation(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Automation Rules</h2>
          <p className="text-xs text-muted-foreground">
            Server-side, declarative rules that fire synchronously on record
            events. Five canonical actions: SetField, CreateRecord, FireEvent,
            CallFlow, Abort.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate(`/studio/collections/${collection.id}/automations/new`)}
          title="Create a new Automation Rule"
        >
          <Plus size={14} />
          New rule
        </Button>
      </div>

      {error ? (
        <div className="m-6 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Loading rules...
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">No Automation Rules yet.</p>
            <p>
              Create a rule to enforce data invariants or trigger downstream
              work whenever this collection's records change.
            </p>
          </div>
        ) : (
          <table className="min-w-[760px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="w-28 px-3 py-2 text-center">Timing</th>
                <th className="w-24 px-3 py-2 text-center">Order</th>
                <th className="w-24 px-3 py-2 text-center">Status</th>
                <th className="w-24 px-3 py-2 text-center">Active</th>
                <th className="w-40 px-3 py-2 text-right">Operations</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={`border-b border-border ${rule.isActive ? '' : INACTIVE_ROW_CLASS}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{rule.name}</div>
                    {rule.description ? (
                      <div className="text-xs text-muted-foreground">{rule.description}</div>
                    ) : null}
                  </td>
                  <td className="w-28 px-3 py-2 text-center text-xs text-muted-foreground">
                    {TIMING_LABEL[rule.triggerTiming] ?? rule.triggerTiming}
                  </td>
                  <td className="w-24 px-3 py-2 text-center text-xs text-muted-foreground">
                    {rule.executionOrder}
                  </td>
                  <td className="w-24 px-3 py-2 text-center">
                    <span
                      className={[
                        'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                        rule.status === 'published'
                          ? STATUS_PILL_SUCCESS
                          : rule.status === 'draft'
                          ? STATUS_PILL_PENDING
                          : STATUS_PILL_NEUTRAL,
                      ].join(' ')}
                    >
                      {rule.status}
                    </span>
                  </td>
                  <td className="w-24 px-3 py-2 text-center text-xs">
                    {rule.isActive ? (
                      <span className="text-emerald-700">on</span>
                    ) : (
                      <span className="text-muted-foreground">off</span>
                    )}
                  </td>
                  <td className="w-40 px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/studio/collections/${collection.id}/automations/${rule.id}`)}
                        title="Edit rule"
                        className={NEUTRAL_ICON_BUTTON}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onPublish(rule)}
                        disabled={rule.status === 'published' || busyId === rule.id}
                        title={
                          rule.status === 'published'
                            ? 'Already published'
                            : 'Publish current revision'
                        }
                        className={`${NEUTRAL_ICON_BUTTON} ${DISABLED_OPACITY}`}
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggle(rule)}
                        disabled={busyId === rule.id || (!rule.isActive && rule.status !== 'published')}
                        title={
                          rule.isActive
                            ? 'Deactivate'
                            : rule.status !== 'published'
                            ? 'Publish before activating'
                            : 'Activate'
                        }
                        className={`${NEUTRAL_ICON_BUTTON} ${DISABLED_OPACITY}`}
                      >
                        {rule.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(rule)}
                        title="Delete rule"
                        className={DESTRUCTIVE_ICON_BUTTON}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete this Automation Rule?"
        message={`Delete "${confirmDelete?.name}"? Existing audit log entries are preserved; the rule will no longer fire on any future data event.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={busyId === confirmDelete?.id}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
};
