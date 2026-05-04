import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import {
  DESTRUCTIVE_ICON_BUTTON,
  DISABLED_OPACITY,
  NEUTRAL_ICON_BUTTON,
} from '../../../lib/styling';
import {
  decisionTablesApi,
  type DecisionInput,
  type DecisionInputType,
  type DecisionRow,
  type DecisionRowCondition,
  type DecisionRowOperator,
  type DecisionTable,
  type EvaluateResult,
} from '../../../services/decisionTables';

const INPUT_TYPES: ReadonlyArray<DecisionInputType> = [
  'string',
  'integer',
  'boolean',
  'choice',
  'reference',
  'date',
];

const OPERATORS: ReadonlyArray<DecisionRowOperator> = [
  'equals',
  'not_equals',
  'in',
  'not_in',
  'greater_than',
  'greater_than_or_equals',
  'less_than',
  'less_than_or_equals',
  'is_null',
  'is_not_null',
];

const HIT_POLICIES: ReadonlyArray<'first_match' | 'all_matches'> = [
  'first_match',
  'all_matches',
];

interface DraftInput {
  name: string;
  inputType: DecisionInputType;
  position: number;
}

/**
 * Plan 15.1 - Decision Table visual editor (deferred from Phase 3,
 * trigger reached at Phase 5 / 6).
 *
 * The four-entity model means three concerns:
 *  - **Table** (top metadata): name / hitPolicy / answerCollection.
 *  - **Inputs** (typed columns): authored ONCE at create-time -
 *    inputs are immutable post-create because rows reference them by
 *    id and reshuffling inputs would invalidate every row's
 *    conditions.
 *  - **Rows** (condition+answer matrices): mutable on draft tables
 *    via the dedicated row endpoints.
 *
 * On Publish the runtime evaluator promotes the draft to published
 * and freezes inputs/rows. Editing a published table flips the row
 * back to draft (the service handles that on row mutations).
 */
export const DecisionTableEditor: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ collectionCode: string; id: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !params.id || params.id === 'new';
  const collectionId = searchParams.get('collectionId') ?? '';

  const [table, setTable] = useState<DecisionTable | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft form state (binds to either a new table or an existing one's editable surface).
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hitPolicy, setHitPolicy] = useState<'first_match' | 'all_matches'>('first_match');
  const [answerCollectionCode, setAnswerCollectionCode] = useState('');
  const [draftInputs, setDraftInputs] = useState<DraftInput[]>([
    { name: 'input_1', inputType: 'string', position: 0 },
  ]);

  const [rowEditor, setRowEditor] = useState<{
    mode: 'create' | 'edit';
    row: DecisionRow | DraftRowState;
  } | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const load = useCallback(async () => {
    if (isNew || !params.id) return;
    if (!collectionId) {
      setError('Missing collectionId - open from the Collection Flows tab.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetched = await decisionTablesApi.get(collectionId, params.id);
      setTable(fetched);
      setCode(fetched.code);
      setName(fetched.name);
      setDescription(fetched.description ?? '');
      setHitPolicy(fetched.hitPolicy);
      setAnswerCollectionCode(fetched.answerCollectionCode ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Decision Table');
    } finally {
      setLoading(false);
    }
  }, [collectionId, isNew, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!collectionId) {
      setError('Missing collectionId - open from the Collection Flows tab.');
      return;
    }
    if (!code.trim() || !name.trim()) {
      setError('Code and name are required.');
      return;
    }
    if (draftInputs.length === 0 || draftInputs.some((i) => !i.name.trim())) {
      setError('At least one input is required, and every input must have a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await decisionTablesApi.create(collectionId, {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        hitPolicy,
        answerCollectionCode: answerCollectionCode.trim() || undefined,
        inputs: draftInputs.map((i, idx) => ({
          name: i.name.trim(),
          inputType: i.inputType,
          position: idx,
        })),
      });
      navigate(`/decision-tables/${created.id}?collectionId=${collectionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const onSaveMetadata = async () => {
    if (!table || !collectionId) return;
    setSaving(true);
    setError(null);
    try {
      await decisionTablesApi.update(collectionId, table.id, {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        hitPolicy,
        answerCollectionCode: answerCollectionCode.trim() || undefined,
      } as never);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    if (!table || !collectionId) return;
    setSaving(true);
    setError(null);
    try {
      await decisionTablesApi.publish(collectionId, table.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setSaving(false);
    }
  };

  const onUpsertRow = async (rowState: DraftRowState) => {
    if (!table || !collectionId) return;
    setSaving(true);
    setError(null);
    try {
      const dto = {
        position: rowState.position,
        conditions: rowState.conditions,
        answerLiteral: rowState.answerLiteral,
        answerRecordId: rowState.answerRecordId || null,
        description: rowState.description,
        isActive: rowState.isActive,
      };
      if (rowState.id) {
        await decisionTablesApi.updateRow(collectionId, table.id, rowState.id, dto);
      } else {
        await decisionTablesApi.createRow(collectionId, table.id, dto);
      }
      setRowEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Row save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDeleteRow = async (rowId: string) => {
    if (!table || !collectionId) return;
    setSaving(true);
    setError(null);
    try {
      await decisionTablesApi.deleteRow(collectionId, table.id, rowId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Row delete failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 size={14} className="mr-2 animate-spin" />
        Loading Decision Table...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-muted/10">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={NEUTRAL_ICON_BUTTON}
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {isNew ? 'New Decision Table' : table?.name}
            </h1>
            {!isNew && table ? (
              <p className="text-xs text-muted-foreground">
                <code>{table.code}</code> | {table.status} | {table.inputs?.length ?? 0} inputs |{' '}
                {table.rows?.length ?? 0} rows
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isNew ? (
            <Button size="sm" onClick={() => void onCreate()} disabled={saving}>
              <Save size={14} />
              Create table
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTestOpen(true)}
                disabled={saving || !table?.inputs?.length}
              >
                <Play size={14} />
                Test
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onSaveMetadata()} disabled={saving}>
                <Save size={14} />
                Save
              </Button>
              <Button
                size="sm"
                onClick={() => void onPublish()}
                disabled={saving || table?.status === 'published'}
                title={table?.status === 'published' ? 'Already published' : 'Publish current draft'}
              >
                <Upload size={14} />
                Publish
              </Button>
            </>
          )}
        </div>
      </header>

      {error ? (
        <div className="m-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex-1 overflow-auto px-6 py-4">
        {/* Metadata section */}
        <section className="mb-6 grid grid-cols-2 gap-4 rounded border border-border bg-card p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!isNew}
              className={`w-full rounded border border-border bg-card px-2 py-1 text-sm ${DISABLED_OPACITY}`}
              placeholder="risk_score_table"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
              placeholder="Risk score lookup"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Hit policy</label>
            <select
              value={hitPolicy}
              onChange={(e) => setHitPolicy(e.target.value as 'first_match' | 'all_matches')}
              className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
            >
              {HIT_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Answer collection (optional)
            </label>
            <input
              value={answerCollectionCode}
              onChange={(e) => setAnswerCollectionCode(e.target.value)}
              className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
              placeholder="risk_levels"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              When set, rows reference a record from this collection (answerRecordId).
              Otherwise rows return a literal JSON answer.
            </p>
          </div>
        </section>

        {/* Inputs section */}
        <section className="mb-6 rounded border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Inputs</h2>
            {isNew ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraftInputs((prev) => [
                    ...prev,
                    { name: `input_${prev.length + 1}`, inputType: 'string', position: prev.length },
                  ])
                }
              >
                <Plus size={12} /> Add input
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Inputs are immutable after the table is created.
              </span>
            )}
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-1 text-left">Position</th>
                <th className="px-2 py-1 text-left">Name</th>
                <th className="px-2 py-1 text-left">Type</th>
                {isNew ? <th className="w-12" /> : null}
              </tr>
            </thead>
            <tbody>
              {(isNew ? draftInputs : table?.inputs ?? []).map((input, idx) => (
                <tr key={(input as DecisionInput).id ?? idx} className="border-b border-border">
                  <td className="px-2 py-1 text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="px-2 py-1">
                    {isNew ? (
                      <input
                        value={input.name}
                        onChange={(e) =>
                          setDraftInputs((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)),
                          )
                        }
                        className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="font-medium text-foreground">{input.name}</span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {isNew ? (
                      <select
                        value={input.inputType}
                        onChange={(e) =>
                          setDraftInputs((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, inputType: e.target.value as DecisionInputType } : p,
                            ),
                          )
                        }
                        className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
                      >
                        {INPUT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        {input.inputType}
                      </span>
                    )}
                  </td>
                  {isNew ? (
                    <td className="w-12 px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setDraftInputs((prev) => prev.filter((_, i) => i !== idx))
                        }
                        disabled={draftInputs.length <= 1}
                        className={`${DESTRUCTIVE_ICON_BUTTON} ${DISABLED_OPACITY}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Rows section - only shown after table exists */}
        {!isNew && table ? (
          <section className="rounded border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Rows</h2>
              <Button
                size="sm"
                onClick={() =>
                  setRowEditor({
                    mode: 'create',
                    row: emptyDraftRow(table, (table.rows?.length ?? 0) + 1),
                  })
                }
              >
                <Plus size={12} /> Add row
              </Button>
            </div>
            {(table.rows ?? []).length === 0 ? (
              <div className="rounded border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                No rows yet. Add one above to start matching.
              </div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="w-16 px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Conditions</th>
                    <th className="px-2 py-1 text-left">Answer</th>
                    <th className="w-20 px-2 py-1 text-center">Active</th>
                    <th className="w-20 px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {(table.rows ?? [])
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((row) => (
                      <tr key={row.id} className="border-b border-border">
                        <td className="px-2 py-1 text-xs text-muted-foreground">{row.position}</td>
                        <td className="px-2 py-1">
                          {row.conditions.length === 0 ? (
                            <span className="text-xs italic text-muted-foreground">
                              (always matches)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {row.conditions.map((c, idx) => {
                                const input = table.inputs?.find((i) => i.id === c.inputId);
                                return (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                                  >
                                    <span className="font-medium">{input?.name ?? '?'}</span>
                                    <span className="text-muted-foreground">{c.operator}</span>
                                    {c.operator !== 'is_null' && c.operator !== 'is_not_null' ? (
                                      <span className="font-mono">
                                        {JSON.stringify(c.value)}
                                      </span>
                                    ) : null}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1 font-mono text-xs">
                          {row.answerRecordId ? (
                            <span>-&gt; record {row.answerRecordId.slice(0, 8)}...</span>
                          ) : (
                            <span>{JSON.stringify(row.answerLiteral)}</span>
                          )}
                        </td>
                        <td className="w-20 px-2 py-1 text-center text-xs">
                          {row.isActive ? 'Yes' : 'No'}
                        </td>
                        <td className="w-20 px-2 py-1">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setRowEditor({
                                  mode: 'edit',
                                  row: rowToDraft(row),
                                })
                              }
                              className={NEUTRAL_ICON_BUTTON}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDeleteRow(row.id)}
                              className={DESTRUCTIVE_ICON_BUTTON}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}
      </div>

      {/* Row editor modal */}
      {rowEditor && table ? (
        <RowEditorModal
          row={rowEditor.row as DraftRowState}
          inputs={table.inputs ?? []}
          hasAnswerCollection={!!table.answerCollectionCode}
          onCancel={() => setRowEditor(null)}
          onSave={(r) => void onUpsertRow(r)}
          saving={saving}
        />
      ) : null}

      {/* Test runner modal */}
      {testOpen && table ? (
        <TestRunnerModal
          collectionId={collectionId}
          table={table}
          onClose={() => setTestOpen(false)}
        />
      ) : null}
    </div>
  );
};

interface DraftRowState {
  id?: string;
  position: number;
  conditions: DecisionRowCondition[];
  answerLiteral?: unknown;
  answerRecordId?: string;
  description?: string;
  isActive: boolean;
}

const emptyDraftRow = (table: DecisionTable, position: number): DraftRowState => ({
  position,
  conditions: (table.inputs ?? []).map((input) => ({
    inputId: input.id,
    operator: 'equals' as DecisionRowOperator,
    value: '',
  })),
  answerLiteral: '',
  isActive: true,
});

const rowToDraft = (row: DecisionRow): DraftRowState => ({
  id: row.id,
  position: row.position,
  conditions: row.conditions.map((c) => ({ ...c })),
  answerLiteral: row.answerLiteral,
  answerRecordId: row.answerRecordId ?? undefined,
  description: row.description ?? undefined,
  isActive: row.isActive,
});

interface RowEditorProps {
  row: DraftRowState;
  inputs: DecisionInput[];
  hasAnswerCollection: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (row: DraftRowState) => void;
}

const RowEditorModal: React.FC<RowEditorProps> = ({
  row,
  inputs,
  hasAnswerCollection,
  saving,
  onCancel,
  onSave,
}) => {
  const [draft, setDraft] = useState<DraftRowState>(row);
  const [literalText, setLiteralText] = useState(() =>
    draft.answerLiteral === undefined ? '' : JSON.stringify(draft.answerLiteral),
  );
  const [literalError, setLiteralError] = useState<string | null>(null);

  const updateCondition = (inputId: string, patch: Partial<DecisionRowCondition>) => {
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c) =>
        c.inputId === inputId ? { ...c, ...patch } : c,
      ),
    }));
  };

  const onCommit = () => {
    if (!hasAnswerCollection) {
      try {
        const parsed = literalText.trim() === '' ? null : JSON.parse(literalText);
        onSave({ ...draft, answerLiteral: parsed, answerRecordId: undefined });
        return;
      } catch (err) {
        setLiteralError(err instanceof Error ? err.message : 'Invalid JSON');
        return;
      }
    }
    onSave(draft);
  };

  return (
    <Modal open={true} onClose={onCancel} title={draft.id ? 'Edit row' : 'New row'} size="lg">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Position</label>
            <input
              type="number"
              value={draft.position}
              onChange={(e) => setDraft((p) => ({ ...p, position: Number(e.target.value) }))}
              className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Row is active
            </label>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">Conditions</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            All conditions are AND'ed together. Set operator <code>is_null</code> /{' '}
            <code>is_not_null</code> to skip the value.
          </p>
          <div className="space-y-2">
            {inputs.map((input) => {
              const cond =
                draft.conditions.find((c) => c.inputId === input.id) ??
                ({
                  inputId: input.id,
                  operator: 'equals' as DecisionRowOperator,
                  value: '',
                } satisfies DecisionRowCondition);
              const skipValue =
                cond.operator === 'is_null' || cond.operator === 'is_not_null';
              return (
                <div
                  key={input.id}
                  className="grid grid-cols-[1fr_auto_2fr] items-center gap-2 rounded border border-border p-2"
                >
                  <div>
                    <div className="text-sm font-medium">{input.name}</div>
                    <div className="text-xs text-muted-foreground">{input.inputType}</div>
                  </div>
                  <select
                    value={cond.operator}
                    onChange={(e) =>
                      updateCondition(input.id, {
                        operator: e.target.value as DecisionRowOperator,
                      })
                    }
                    className="rounded border border-border bg-card px-2 py-1 text-sm"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  {skipValue ? (
                    <span className="text-xs italic text-muted-foreground">no value</span>
                  ) : (
                    <input
                      value={String(cond.value ?? '')}
                      onChange={(e) =>
                        updateCondition(input.id, {
                          value: coerceConditionValue(input.inputType, e.target.value),
                        })
                      }
                      className="rounded border border-border bg-card px-2 py-1 text-sm"
                      placeholder={`${input.inputType} value`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">Answer</h3>
          {hasAnswerCollection ? (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Answer record id (in the table's answer collection)
              </label>
              <input
                value={draft.answerRecordId ?? ''}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, answerRecordId: e.target.value || undefined }))
                }
                className="w-full rounded border border-border bg-card px-2 py-1 text-sm font-mono"
                placeholder="uuid"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Literal answer (JSON)
              </label>
              <textarea
                value={literalText}
                onChange={(e) => {
                  setLiteralText(e.target.value);
                  setLiteralError(null);
                }}
                rows={3}
                className="w-full rounded border border-border bg-card px-2 py-1 text-sm font-mono"
                placeholder='"high" or {"priority": "P1"}'
              />
              {literalError ? (
                <p className="mt-1 text-xs text-destructive">{literalError}</p>
              ) : null}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Description (optional)
          </label>
          <input
            value={draft.description ?? ''}
            onChange={(e) =>
              setDraft((p) => ({ ...p, description: e.target.value || undefined }))
            }
            className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={onCommit} disabled={saving}>
            <Save size={14} />
            Save row
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const coerceConditionValue = (inputType: DecisionInputType, raw: string): unknown => {
  if (inputType === 'integer') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (inputType === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
  }
  return raw;
};

interface TestRunnerProps {
  collectionId: string;
  table: DecisionTable;
  onClose: () => void;
}

const TestRunnerModal: React.FC<TestRunnerProps> = ({ collectionId, table, onClose }) => {
  const inputs = table.inputs ?? [];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(inputs.map((i) => [i.name, ''])),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EvaluateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputsAsTyped = useMemo(
    () =>
      Object.fromEntries(
        inputs.map((i) => [i.name, coerceConditionValue(i.inputType, values[i.name] ?? '')]),
      ),
    [inputs, values],
  );

  const onRun = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Editor-only evaluator that skips the published-status gate;
      // every row/metadata edit flips a published table back to
      // draft, so the runtime `evaluate` would refuse the table the
      // author is mid-edit on.
      const r = await decisionTablesApi.evaluateDraft(collectionId, table.id, inputsAsTyped);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluate failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Test Decision Table" size="md">
      <div className="space-y-4 p-4">
        <p className="text-xs text-muted-foreground">
          Provide one value per input and run the published evaluator. Strings stay as
          strings; integers parse to numbers; booleans accept{' '}
          <code>true</code> / <code>false</code>.
        </p>
        <div className="space-y-2">
          {inputs.map((i) => (
            <div key={i.id} className="grid grid-cols-[1fr_2fr] items-center gap-2">
              <label className="text-sm">
                {i.name} <span className="text-xs text-muted-foreground">({i.inputType})</span>
              </label>
              <input
                value={values[i.name] ?? ''}
                onChange={(e) => setValues((p) => ({ ...p, [i.name]: e.target.value }))}
                className="rounded border border-border bg-card px-2 py-1 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => void onRun()} disabled={busy}>
            <Play size={14} />
            {busy ? 'Running...' : 'Run'}
          </Button>
        </div>

        {error ? (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="rounded border border-border bg-muted/30 p-3 text-sm">
            <div className="mb-2 font-medium">
              {result.matched ? 'Matched' : 'No match'}
              {result.matched && result.rowPosition !== undefined ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  row {result.rowPosition}
                </span>
              ) : null}
            </div>
            <pre className="overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
