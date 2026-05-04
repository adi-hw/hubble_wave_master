import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { ConfirmModal } from '../../../../components/ui/Modal';
import { useStudioCollection } from '../CollectionContext';
import {
  displayRulesApi,
  type DisplayRule,
} from '../../../../services/displayRules';
import { DisplayRuleEditor } from './DisplayRuleEditor';
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
 * Plan 7.3 Display Rules editor - list and CRUD for the active
 * Collection. New / edit opens DisplayRuleEditor in a modal; Publish
 * flips the rule's currentRevision to published; Delete soft-deletes
 * (sets isActive=false + status=deprecated).
 */
export const DisplayRulesPanel: React.FC = () => {
  const collection = useStudioCollection();
  const [rules, setRules] = useState<DisplayRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DisplayRule | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DisplayRule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await displayRulesApi.list(collection.id, {
        includeInactive: true,
        includeDrafts: true,
      });
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Display Rules');
    } finally {
      setLoading(false);
    }
  }, [collection.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreateClick = () => {
    setEditing(null);
    setShowEditor(true);
  };

  const onEditClick = (rule: DisplayRule) => {
    setEditing(rule);
    setShowEditor(true);
  };

  const onPublishClick = async (rule: DisplayRule) => {
    setBusyId(rule.id);
    setError(null);
    try {
      await displayRulesApi.publish(collection.id, rule.id);
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
      await displayRulesApi.delete(collection.id, confirmDelete.id);
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
          <h2 className="text-sm font-semibold text-foreground">Display Rules</h2>
          <p className="text-xs text-muted-foreground">
            Conditional show / hide / mandatory / readonly / setValue actions applied
            on form load and on Property change.
          </p>
        </div>
        <Button size="sm" onClick={onCreateClick}>
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
            <p className="mb-2 font-medium text-foreground">No Display Rules yet.</p>
            <p>
              Create your first rule to conditionally show, hide, or require Properties when
              specific record state holds.
            </p>
          </div>
        ) : (
          <table className="min-w-[720px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="w-20 px-3 py-2 text-center">Priority</th>
                <th className="w-24 px-3 py-2 text-center">Actions</th>
                <th className="w-24 px-3 py-2 text-center">Status</th>
                <th className="w-44 px-3 py-2 text-right">Operations</th>
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
                  <td className="w-20 px-3 py-2 text-center font-mono text-xs">
                    {rule.priority}
                  </td>
                  <td className="w-24 px-3 py-2 text-center text-xs text-muted-foreground">
                    {rule.actions.length}
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
                  <td className="w-44 px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEditClick(rule)}
                        title="Edit rule"
                        className={NEUTRAL_ICON_BUTTON}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onPublishClick(rule)}
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

      <DisplayRuleEditor
        open={showEditor}
        rule={editing}
        onClose={() => setShowEditor(false)}
        onSaved={async () => {
          setShowEditor(false);
          await load();
        }}
      />

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete this Display Rule?"
        message={`Delete "${confirmDelete?.name}"? This soft-deletes the rule (isActive=false). Active forms stop applying it on next reload.`}
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
