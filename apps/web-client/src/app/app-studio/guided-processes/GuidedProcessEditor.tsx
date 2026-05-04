import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckSquare,
  GitBranch,
  Loader2,
  Plus,
  Save,
  Table as TableIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import {
  guidedProcessesApi,
  type CreateGuidedProcessDto,
  type GuidedActivityKind,
  type GuidedProcess,
} from '../../../services/guidedProcesses';
import {
  DESTRUCTIVE_ICON_BUTTON,
  DISABLED_OPACITY,
  NEUTRAL_ICON_BUTTON,
} from '../../../lib/styling';

type StageDraft = CreateGuidedProcessDto['stages'][number];
type ActivityDraft = StageDraft['activities'][number];

const ACTIVITY_KINDS: ReadonlyArray<{
  kind: GuidedActivityKind;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint: string;
}> = [
  {
    kind: 'manual_task',
    label: 'Manual task',
    icon: CheckSquare,
    hint: 'A checklist item the user marks complete in the Workspace runtime.',
  },
  {
    kind: 'flow',
    label: 'Process Flow',
    icon: GitBranch,
    hint: 'Triggers a Process Flow when the activity starts. Set processFlowCode.',
  },
  {
    kind: 'decision',
    label: 'Decision Table',
    icon: TableIcon,
    hint: 'Evaluates a Decision Table to choose the next branch. Set the decision table code.',
  },
];

/**
 * Plan 15.1 - Guided Process visual editor (deferred from Phase 3,
 * trigger reached at Phase 5). Authors a multi-stage playbook
 * (stages -> activities) end-to-end in the browser.
 *
 * The editor edits the structure as a single client-side draft, then
 * commits via `replaceStructure` (transactional delete + insert on
 * the backend). On save the process flips back to draft so the
 * Save -> Publish loop is consistent with every other lifecycle in
 * the platform.
 */
export const GuidedProcessEditor: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !params.id || params.id === 'new';
  const collectionId = searchParams.get('collectionId') ?? '';

  const [process, setProcess] = useState<GuidedProcess | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stages, setStages] = useState<StageDraft[]>([
    { name: 'Stage 1', activities: [{ name: 'First task', kind: 'manual_task' }] },
  ]);

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
      const fetched = await guidedProcessesApi.get(collectionId, params.id);
      setProcess(fetched);
      setCode(fetched.code);
      setName(fetched.name);
      setDescription(fetched.description ?? '');
      setStages(
        (fetched.stages ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            name: s.name,
            description: s.description ?? undefined,
            position: s.position,
            visibilityCondition: s.visibilityCondition ?? null,
            activities: (s.activities ?? [])
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((a) => ({
                name: a.name,
                description: a.description ?? undefined,
                position: a.position,
                kind: a.kind,
                processFlowCode: a.processFlowCode ?? null,
                requiredCondition: a.requiredCondition ?? null,
              })),
          })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Guided Process');
    } finally {
      setLoading(false);
    }
  }, [collectionId, isNew, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const validate = (): string | null => {
    if (!code.trim()) return 'Code is required.';
    if (!name.trim()) return 'Name is required.';
    if (stages.length === 0) return 'At least one stage is required.';
    for (const [si, s] of stages.entries()) {
      if (!s.name.trim()) return `Stage ${si + 1} is missing a name.`;
      if (!s.activities || s.activities.length === 0)
        return `Stage "${s.name}" must have at least one activity.`;
      for (const [ai, a] of s.activities.entries()) {
        if (!a.name.trim())
          return `Activity ${ai + 1} in "${s.name}" is missing a name.`;
        if (a.kind === 'flow' && !a.processFlowCode?.trim())
          return `Activity "${a.name}" (flow) needs processFlowCode.`;
        if (a.kind === 'decision' && !a.processFlowCode?.trim())
          return `Activity "${a.name}" (decision) needs the decision table code.`;
      }
    }
    return null;
  };

  const onCreate = async () => {
    if (!collectionId) {
      setError('Missing collectionId - open from the Collection Flows tab.');
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await guidedProcessesApi.create(collectionId, {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        stages: stages.map((s, idx) => ({
          ...s,
          position: idx,
          activities: s.activities.map((a, aidx) => ({ ...a, position: aidx })),
        })),
      });
      navigate(`/guided-processes/${created.id}?collectionId=${collectionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const onSaveStructure = async () => {
    if (!process || !collectionId) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Save top-level fields first (name/description), then the structure.
      await guidedProcessesApi.update(collectionId, process.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      await guidedProcessesApi.replaceStructure(
        collectionId,
        process.id,
        stages.map((s, idx) => ({
          ...s,
          position: idx,
          activities: s.activities.map((a, aidx) => ({ ...a, position: aidx })),
        })),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    if (!process || !collectionId) return;
    setSaving(true);
    setError(null);
    try {
      await guidedProcessesApi.publish(collectionId, process.id);
      await load();
    } catch (err) {
      // Publish surfaces the dependency-validation message body when present.
      const msg = err instanceof Error ? err.message : 'Publish failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const moveStage = (idx: number, dir: -1 | 1) => {
    const next = [...stages];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setStages(next);
  };

  const moveActivity = (stageIdx: number, actIdx: number, dir: -1 | 1) => {
    const next = [...stages];
    const stage = { ...next[stageIdx], activities: [...next[stageIdx].activities] };
    const target = actIdx + dir;
    if (target < 0 || target >= stage.activities.length) return;
    [stage.activities[actIdx], stage.activities[target]] = [
      stage.activities[target],
      stage.activities[actIdx],
    ];
    next[stageIdx] = stage;
    setStages(next);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 size={14} className="mr-2 animate-spin" />
        Loading Guided Process...
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
              {isNew ? 'New Guided Process' : process?.name}
            </h1>
            {!isNew && process ? (
              <p className="text-xs text-muted-foreground">
                <code>{process.code}</code> | {process.status} | {stages.length} stages
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isNew ? (
            <Button size="sm" onClick={() => void onCreate()} disabled={saving}>
              <Save size={14} />
              Create
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => void onSaveStructure()} disabled={saving}>
                <Save size={14} />
                Save
              </Button>
              <Button
                size="sm"
                onClick={() => void onPublish()}
                disabled={saving || process?.status === 'published'}
                title={
                  process?.status === 'published'
                    ? 'Already published'
                    : 'Publish - referenced flows / decision tables must already be published'
                }
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
              placeholder="incident_intake"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
              placeholder="Incident Intake"
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
        </section>

        {/* Stages */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Stages</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setStages((prev) => [
                  ...prev,
                  {
                    name: `Stage ${prev.length + 1}`,
                    activities: [{ name: 'New activity', kind: 'manual_task' }],
                  },
                ])
              }
            >
              <Plus size={12} /> Add stage
            </Button>
          </div>

          <div className="space-y-3">
            {stages.map((stage, sIdx) => (
              <div key={sIdx} className="rounded border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Stage {sIdx + 1}
                  </span>
                  <input
                    value={stage.name}
                    onChange={(e) =>
                      setStages((prev) =>
                        prev.map((s, i) => (i === sIdx ? { ...s, name: e.target.value } : s)),
                      )
                    }
                    className="flex-1 rounded border border-border bg-card px-2 py-1 text-sm font-medium"
                    placeholder="Stage name"
                  />
                  <button
                    type="button"
                    onClick={() => moveStage(sIdx, -1)}
                    disabled={sIdx === 0}
                    className={`rounded p-1 text-muted-foreground hover:bg-muted ${DISABLED_OPACITY}`}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStage(sIdx, 1)}
                    disabled={sIdx === stages.length - 1}
                    className={`rounded p-1 text-muted-foreground hover:bg-muted ${DISABLED_OPACITY}`}
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setStages((prev) => prev.filter((_, i) => i !== sIdx))
                    }
                    disabled={stages.length <= 1}
                    className={`${DESTRUCTIVE_ICON_BUTTON} ${DISABLED_OPACITY}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <textarea
                  value={stage.description ?? ''}
                  onChange={(e) =>
                    setStages((prev) =>
                      prev.map((s, i) =>
                        i === sIdx ? { ...s, description: e.target.value || undefined } : s,
                      ),
                    )
                  }
                  rows={1}
                  placeholder="Stage description (optional)"
                  className="mb-3 w-full rounded border border-border bg-card px-2 py-1 text-xs"
                />

                <div className="space-y-2 pl-4">
                  {stage.activities.map((activity, aIdx) => (
                    <ActivityRow
                      key={aIdx}
                      activity={activity}
                      stageIdx={sIdx}
                      actIdx={aIdx}
                      total={stage.activities.length}
                      onChange={(patch) =>
                        setStages((prev) =>
                          prev.map((s, i) =>
                            i === sIdx
                              ? {
                                  ...s,
                                  activities: s.activities.map((a, ai) =>
                                    ai === aIdx ? { ...a, ...patch } : a,
                                  ),
                                }
                              : s,
                          ),
                        )
                      }
                      onMove={(dir) => moveActivity(sIdx, aIdx, dir)}
                      onRemove={() =>
                        setStages((prev) =>
                          prev.map((s, i) =>
                            i === sIdx
                              ? { ...s, activities: s.activities.filter((_, ai) => ai !== aIdx) }
                              : s,
                          ),
                        )
                      }
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setStages((prev) =>
                        prev.map((s, i) =>
                          i === sIdx
                            ? {
                                ...s,
                                activities: [
                                  ...s.activities,
                                  {
                                    name: 'New activity',
                                    kind: 'manual_task' as GuidedActivityKind,
                                  },
                                ],
                              }
                            : s,
                        ),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus size={12} /> Add activity
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

interface ActivityRowProps {
  activity: ActivityDraft;
  stageIdx: number;
  actIdx: number;
  total: number;
  onChange: (patch: Partial<ActivityDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

const ActivityRow: React.FC<ActivityRowProps> = ({
  activity,
  actIdx,
  total,
  onChange,
  onMove,
  onRemove,
}) => {
  const meta = ACTIVITY_KINDS.find((k) => k.kind === activity.kind);
  const Icon = meta?.icon;
  const codeFieldLabel =
    activity.kind === 'flow'
      ? 'Process Flow code'
      : activity.kind === 'decision'
        ? 'Decision Table code'
        : null;

  return (
    <div className="rounded border border-border bg-muted/20 p-2">
      <div className="flex items-start gap-2">
        {Icon ? <Icon size={14} className="mt-1.5 text-muted-foreground" /> : null}
        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={activity.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="rounded border border-border bg-card px-2 py-1 text-sm"
              placeholder="Activity name"
            />
            <select
              value={activity.kind}
              onChange={(e) =>
                onChange({
                  kind: e.target.value as GuidedActivityKind,
                  processFlowCode: undefined,
                })
              }
              className="rounded border border-border bg-card px-2 py-1 text-sm"
            >
              {ACTIVITY_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          {codeFieldLabel ? (
            <input
              value={activity.processFlowCode ?? ''}
              onChange={(e) =>
                onChange({ processFlowCode: e.target.value || null })
              }
              className="w-full rounded border border-border bg-card px-2 py-1 text-xs font-mono"
              placeholder={codeFieldLabel}
            />
          ) : null}
          <div className="text-xs text-muted-foreground">{meta?.hint}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={actIdx === 0}
            className={`rounded p-1 text-muted-foreground hover:bg-muted ${DISABLED_OPACITY}`}
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={actIdx === total - 1}
            className={`rounded p-1 text-muted-foreground hover:bg-muted ${DISABLED_OPACITY}`}
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total <= 1}
            className={`${DESTRUCTIVE_ICON_BUTTON} ${DISABLED_OPACITY}`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
