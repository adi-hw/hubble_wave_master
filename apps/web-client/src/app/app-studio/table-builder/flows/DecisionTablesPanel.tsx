import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../../components/ui/Button';
import { ConfirmModal } from '../../../../components/ui/Modal';
import { useStudioCollection } from '../CollectionContext';
import {
  decisionTablesApi,
  type DecisionTable,
} from '../../../../services/decisionTables';
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
 * List + lifecycle CRUD surface for Decision Tables. Visual condition
 * editing for rows is handled inline via the existing
 * ConditionBuilder shared component once a table is opened (deeper
 * editor surface intentionally minimal here - admins manage
 * inputs/rows via the API or the inline editor pattern of
 * DisplayRules).
 */
export const DecisionTablesPanel: React.FC = () => {
  const collection = useStudioCollection();
  const navigate = useNavigate();
  const [tables, setTables] = useState<DecisionTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DecisionTable | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await decisionTablesApi.list(collection.id, true);
      setTables(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Decision Tables');
    } finally {
      setLoading(false);
    }
  }, [collection.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPublish = async (table: DecisionTable) => {
    setBusyId(table.id);
    try {
      await decisionTablesApi.publish(collection.id, table.id);
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
      await decisionTablesApi.delete(collection.id, confirmDelete.id);
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
          <h2 className="text-sm font-semibold text-foreground">Decision Tables</h2>
          <p className="text-xs text-muted-foreground">
            Typed input -&gt; row -&gt; answer matrices invoked from Flow Actions and AVA
            prompts. Typed-IO model (table / inputs / rows; answers sourced from a
            configured Collection) preserves type safety end-to-end.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            navigate(`/decision-tables/new?collectionId=${collection.id}`)
          }
        >
          <Plus size={14} />
          New table
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
            Loading tables...
          </div>
        ) : tables.length === 0 ? (
          <div className="rounded border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">No Decision Tables yet.</p>
            <p>
              Click <strong>New table</strong> to author one. Reference a published
              table from a Flow's{' '}
              <code className="rounded bg-muted px-1">MakeDecision</code> action.
            </p>
          </div>
        ) : (
          <table className="min-w-[760px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="w-24 px-3 py-2 text-center">Inputs</th>
                <th className="w-24 px-3 py-2 text-center">Hit policy</th>
                <th className="w-24 px-3 py-2 text-center">Status</th>
                <th className="w-32 px-3 py-2 text-right">Operations</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr
                  key={table.id}
                  className={`border-b border-border ${table.isActive ? '' : INACTIVE_ROW_CLASS}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{table.name}</div>
                    {table.description ? (
                      <div className="text-xs text-muted-foreground">{table.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {table.code}
                  </td>
                  <td className="w-24 px-3 py-2 text-center text-xs">
                    {table.inputs?.length ?? 0}
                  </td>
                  <td className="w-24 px-3 py-2 text-center text-xs">{table.hitPolicy}</td>
                  <td className="w-24 px-3 py-2 text-center">
                    <span
                      className={[
                        'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                        table.status === 'published'
                          ? STATUS_PILL_SUCCESS
                          : table.status === 'draft'
                          ? STATUS_PILL_PENDING
                          : STATUS_PILL_NEUTRAL,
                      ].join(' ')}
                    >
                      {table.status}
                    </span>
                  </td>
                  <td className="w-32 px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/decision-tables/${table.id}?collectionId=${collection.id}`,
                          )
                        }
                        title="Edit table"
                        className={NEUTRAL_ICON_BUTTON}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onPublish(table)}
                        disabled={table.status === 'published' || busyId === table.id}
                        title={
                          table.status === 'published'
                            ? 'Already published'
                            : 'Publish current revision'
                        }
                        className={`${NEUTRAL_ICON_BUTTON} ${DISABLED_OPACITY}`}
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(table)}
                        title="Delete table"
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
        title="Delete this Decision Table?"
        message={`Soft-delete "${confirmDelete?.name}"? Active flows that reference this table will fail until they're updated.`}
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
