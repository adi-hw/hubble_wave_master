import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../../components/ui/Button';
import { ConfirmModal } from '../../../../components/ui/Modal';
import { useStudioCollection } from '../CollectionContext';
import {
  guidedProcessesApi,
  type GuidedProcess,
} from '../../../../services/guidedProcesses';
import {
  DISABLED_OPACITY,
  STATUS_PILL_NEUTRAL,
  STATUS_PILL_PENDING,
  STATUS_PILL_SUCCESS,
  DESTRUCTIVE_ICON_BUTTON,
  INACTIVE_ROW_CLASS,
  NEUTRAL_ICON_BUTTON,
} from '../../../../lib/styling';

/**
 * List + lifecycle CRUD surface for Guided Processes (Playbooks).
 * Runtime experience lives inside Workspace record pages (Phase 5);
 * this panel is the metadata management view.
 */
export const GuidedProcessesPanel: React.FC = () => {
  const collection = useStudioCollection();
  const navigate = useNavigate();
  const [processes, setProcesses] = useState<GuidedProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GuidedProcess | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await guidedProcessesApi.list(collection.id, true);
      setProcesses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Guided Processes');
    } finally {
      setLoading(false);
    }
  }, [collection.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPublish = async (process: GuidedProcess) => {
    setBusyId(process.id);
    try {
      await guidedProcessesApi.publish(collection.id, process.id);
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
      await guidedProcessesApi.delete(collection.id, confirmDelete.id);
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
          <h2 className="text-sm font-semibold text-foreground">Guided Processes</h2>
          <p className="text-xs text-muted-foreground">
            Multi-stage playbooks runtime users follow on a record. Each stage
            organizes activities - flows, manual tasks, or decisions.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate(`/guided-processes/new?collectionId=${collection.id}`)}
        >
          <Plus size={14} />
          New process
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
            Loading processes...
          </div>
        ) : processes.length === 0 ? (
          <div className="rounded border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">No Guided Processes yet.</p>
            <p>
              Click <strong>New process</strong> to author a playbook (stages -&gt;
              activities). Once published, the Workspace runtime renders the
              playbook on records of this Collection.
            </p>
          </div>
        ) : (
          <table className="min-w-[720px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="w-24 px-3 py-2 text-center">Stages</th>
                <th className="w-24 px-3 py-2 text-center">Status</th>
                <th className="w-32 px-3 py-2 text-right">Operations</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((process) => (
                <tr
                  key={process.id}
                  className={`border-b border-border ${process.isActive ? '' : INACTIVE_ROW_CLASS}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{process.name}</div>
                    {process.description ? (
                      <div className="text-xs text-muted-foreground">{process.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {process.code}
                  </td>
                  <td className="w-24 px-3 py-2 text-center text-xs">
                    {process.stages?.length ?? 0}
                  </td>
                  <td className="w-24 px-3 py-2 text-center">
                    <span
                      className={[
                        'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                        process.status === 'published'
                          ? STATUS_PILL_SUCCESS
                          : process.status === 'draft'
                          ? STATUS_PILL_PENDING
                          : STATUS_PILL_NEUTRAL,
                      ].join(' ')}
                    >
                      {process.status}
                    </span>
                  </td>
                  <td className="w-32 px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/guided-processes/${process.id}?collectionId=${collection.id}`,
                          )
                        }
                        title="Edit process"
                        className={NEUTRAL_ICON_BUTTON}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onPublish(process)}
                        disabled={process.status === 'published' || busyId === process.id}
                        title={
                          process.status === 'published'
                            ? 'Already published'
                            : 'Publish'
                        }
                        className={`${NEUTRAL_ICON_BUTTON} ${DISABLED_OPACITY}`}
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(process)}
                        title="Delete process"
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
        title="Delete this Guided Process?"
        message={`Soft-delete "${confirmDelete?.name}"? Records in active stages of this process will keep their progress but no new instances can start.`}
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
