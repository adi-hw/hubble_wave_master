import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../../components/ui/Button';
import { ConfirmModal } from '../../../../components/ui/Modal';
import { useStudioCollection } from '../CollectionContext';
import {
  processFlowsService,
  type ProcessFlowDefinition,
} from '../../../../services/process-flows.service';
import {
  DISABLED_OPACITY,
  STATUS_PILL_NEUTRAL,
  STATUS_PILL_PENDING,
  STATUS_PILL_SUCCESS,
  DESTRUCTIVE_ICON_BUTTON,
  INACTIVE_ROW_CLASS,
  NEUTRAL_ICON_BUTTON,
} from '../../../../lib/styling';

const TRIGGER_LABELS: Record<string, string> = {
  record_created: 'On create',
  record_updated: 'On update',
  property_changed: 'Property change',
  scheduled: 'Scheduled',
  manual: 'Manual',
};

/**
 * Collection-scoped Process Flows surface for App Studio. Lists
 * ProcessFlowDefinition artifacts attached to the active collection
 * and exposes their ADR-5 lifecycle (publish / delete). The visual
 * editor is the existing global Process Flow Designer at
 * /process-flows/:id.
 */
export const ProcessFlowsPanel: React.FC = () => {
  const collection = useStudioCollection();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<ProcessFlowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProcessFlowDefinition | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await processFlowsService.list({ collectionId: collection.id });
      setFlows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Process Flows');
    } finally {
      setLoading(false);
    }
  }, [collection.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPublish = async (flow: ProcessFlowDefinition) => {
    setBusyId(flow.id);
    try {
      await processFlowsService.publish(flow.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await processFlowsService.delete(confirmDelete.id);
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
          <h2 className="text-sm font-semibold text-foreground">Process Flows</h2>
          <p className="text-xs text-muted-foreground">
            Visual flows that execute on this collection's record events. Composed
            of typed Action steps from the platform's built-in catalog.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate(`/process-flows/new?collectionId=${collection.id}`)}
          title="Create a new Process Flow (opens the visual designer)"
        >
          <Plus size={14} />
          New flow
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
            Loading flows...
          </div>
        ) : flows.length === 0 ? (
          <div className="rounded border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">No Process Flows yet.</p>
            <p>
              Create a flow to automate work on this collection. Flows compose
              actions from the built-in catalog (CreateRecord, UpdateRecord,
              SendNotification, MakeDecision, ...).
            </p>
          </div>
        ) : (
          <table className="min-w-[760px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="w-32 px-3 py-2 text-center">Trigger</th>
                <th className="w-24 px-3 py-2 text-center">Runs</th>
                <th className="w-24 px-3 py-2 text-center">Status</th>
                <th className="w-32 px-3 py-2 text-right">Operations</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr
                  key={flow.id}
                  className={`border-b border-border ${flow.isActive ? '' : INACTIVE_ROW_CLASS}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{flow.name}</div>
                    {flow.description ? (
                      <div className="text-xs text-muted-foreground">{flow.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {flow.code}
                  </td>
                  <td className="w-32 px-3 py-2 text-center text-xs text-muted-foreground">
                    {TRIGGER_LABELS[flow.triggerType] ?? flow.triggerType}
                  </td>
                  <td className="w-24 px-3 py-2 text-center text-xs text-muted-foreground">
                    {flow.executionCount ?? 0}
                  </td>
                  <td className="w-24 px-3 py-2 text-center">
                    <span
                      className={[
                        'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                        flow.status === 'published'
                          ? STATUS_PILL_SUCCESS
                          : flow.status === 'draft'
                          ? STATUS_PILL_PENDING
                          : STATUS_PILL_NEUTRAL,
                      ].join(' ')}
                    >
                      {flow.status}
                    </span>
                  </td>
                  <td className="w-32 px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/process-flows/${flow.id}?collectionId=${collection.id}`)}
                        title="Open in visual designer"
                        className={NEUTRAL_ICON_BUTTON}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onPublish(flow)}
                        disabled={flow.status === 'published' || busyId === flow.id}
                        title={
                          flow.status === 'published'
                            ? 'Already published'
                            : 'Publish current revision'
                        }
                        className={`${NEUTRAL_ICON_BUTTON} ${DISABLED_OPACITY}`}
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(flow)}
                        title="Delete flow"
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
        title="Delete this Process Flow?"
        message={`Soft-delete "${confirmDelete?.name}"? Records mid-execution will continue to completion, but no new instances can start.`}
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
