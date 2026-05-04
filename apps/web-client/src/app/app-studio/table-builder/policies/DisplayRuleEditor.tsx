import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
// Plan §8.1.4 — Display Rule setValue stores `action.value` literally
// (see `composeDisplay` in libs/shared-types/condition-evaluator.ts);
// no runtime interpolation pass runs over this field. Embedding the
// DataPillPicker here would save literal `{{trigger.x}}` strings into
// the database, which never resolve. Display Rule conditions still
// build typed comparisons via the property/operator/value selector,
// so dynamic bindings aren't useful in this surface.
import { useStudioCollection } from '../CollectionContext';
import {
  displayRulesApi,
  type Condition,
  type ConditionOperator,
  type DisplayAction,
  type DisplayActionKind,
  type DisplayRule,
  type SingleCondition,
} from '../../../../services/displayRules';
import { propertyApi, type PropertyDefinition } from '../../../../services/propertyApi';

interface DisplayRuleEditorProps {
  open: boolean;
  rule: DisplayRule | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const ACTION_KINDS: DisplayActionKind[] = [
  'show',
  'hide',
  'mandatory',
  'optional',
  'readonly',
  'editable',
  'setValue',
];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'greater_than', label: '>' },
  { value: 'greater_than_or_equals', label: '≥' },
  { value: 'less_than', label: '<' },
  { value: 'less_than_or_equals', label: '≤' },
  { value: 'is_null', label: 'is empty' },
  { value: 'is_not_null', label: 'is not empty' },
  { value: 'in', label: 'in (comma-list)' },
  { value: 'not_in', label: 'not in (comma-list)' },
];

const VALUELESS_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
  'is_null',
  'is_not_null',
]);

/**
 * Display Rule editor — edits a rule with N condition rows (AND'ed)
 * and N action rows. Single-level AND group only; nested OR / AND
 * trees are deferred until the shared ConditionBuilder lib lands in
 * Phase 3a (plan §12.1 calls it out as the cross-cutting component).
 *
 * Saves via createOrUpdate. The backend wraps the rows in
 * `{ and: [...] }` when persisting.
 */
export const DisplayRuleEditor: React.FC<DisplayRuleEditorProps> = ({
  open,
  rule,
  onClose,
  onSaved,
}) => {
  const collection = useStudioCollection();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [conditions, setConditions] = useState<SingleCondition[]>([]);
  const [actions, setActions] = useState<DisplayAction[]>([]);
  const [properties, setProperties] = useState<PropertyDefinition[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (rule) {
      setName(rule.name);
      setDescription(rule.description ?? '');
      setPriority(rule.priority);
      setIsActive(rule.isActive);
      setConditions(extractAndConditions(rule.condition));
      setActions(rule.actions ?? []);
    } else {
      setName('');
      setDescription('');
      setPriority(100);
      setIsActive(true);
      setConditions([]);
      setActions([]);
    }
  }, [open, rule]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPropertiesLoading(true);
    propertyApi
      .list(collection.id)
      .then((res) => {
        if (!cancelled) setProperties(res.data);
      })
      .catch(() => {
        if (!cancelled) setProperties([]);
      })
      .finally(() => {
        if (!cancelled) setPropertiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, collection.id]);

  const propertyOptions = useMemo(
    () => properties.map((p) => ({ code: p.code, label: p.label })),
    [properties],
  );

  const canSave =
    name.trim().length > 0 && actions.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const dto = {
      name: name.trim(),
      description: description.trim() || undefined,
      condition: buildConditionPayload(conditions),
      actions,
      priority,
      isActive,
    };
    try {
      if (rule) {
        await displayRulesApi.update(collection.id, rule.id, dto);
      } else {
        await displayRulesApi.create(collection.id, dto);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rule ? `Edit "${rule.name}"` : 'New Display Rule'}
      description="Conditions are AND'ed. Actions apply when all conditions match."
      size="xl"
      scrollable
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" />
                Saving
              </>
            ) : rule ? (
              'Save changes'
            ) : (
              'Create rule'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Hide escalation_contact unless urgent"
            />
          </Field>
          <Field label="Priority">
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
              className={inputClass}
            />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="Optional human description"
            />
          </Field>
          <Field label="Active" className="md:col-span-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              <span>Rule applies on form load + Property change</span>
            </label>
          </Field>
        </div>

        <ConditionsBuilder
          conditions={conditions}
          onChange={setConditions}
          properties={propertyOptions}
          propertiesLoading={propertiesLoading}
        />

        <ActionsBuilder
          actions={actions}
          onChange={setActions}
          properties={propertyOptions}
          propertiesLoading={propertiesLoading}
        />

        {error ? (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

const inputClass =
  'w-full rounded border border-border bg-card px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none';

const Field: React.FC<{
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ label, required, className = '', children }) => (
  <div className={className}>
    <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
      {label}
      {required ? <span className="ml-1 text-destructive">*</span> : null}
    </label>
    {children}
  </div>
);

const ConditionsBuilder: React.FC<{
  conditions: SingleCondition[];
  onChange: (next: SingleCondition[]) => void;
  properties: { code: string; label: string }[];
  propertiesLoading: boolean;
}> = ({ conditions, onChange, properties, propertiesLoading }) => {
  const addRow = () =>
    onChange([
      ...conditions,
      { property: properties[0]?.code ?? '', operator: 'equals', value: '' },
    ]);
  const updateRow = (index: number, patch: Partial<SingleCondition>) =>
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const removeRow = (index: number) =>
    onChange(conditions.filter((_, i) => i !== index));

  return (
    <section className="rounded border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">When (all of)</h3>
          <p className="text-xs text-muted-foreground">
            All conditions must match. Empty list = always true.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addRow} disabled={propertiesLoading}>
          <Plus size={14} />
          Add condition
        </Button>
      </header>
      <div className="space-y-2 p-3">
        {conditions.length === 0 ? (
          <div className="text-xs text-muted-foreground">No conditions - rule is always active.</div>
        ) : (
          conditions.map((c, i) => {
            const valueless = VALUELESS_OPERATORS.has(c.operator);
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  className={`${inputClass} w-1/3`}
                  value={c.property}
                  onChange={(e) => updateRow(i, { property: e.target.value })}
                >
                  {properties.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label} ({p.code})
                    </option>
                  ))}
                </select>
                <select
                  className={`${inputClass} w-44`}
                  value={c.operator}
                  onChange={(e) =>
                    updateRow(i, { operator: e.target.value as ConditionOperator })
                  }
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                {valueless ? (
                  <span className="flex-1 text-xs italic text-muted-foreground">
                    (no value required)
                  </span>
                ) : (
                  <input
                    type="text"
                    className={`${inputClass} flex-1`}
                    value={String(c.value ?? '')}
                    onChange={(e) => updateRow(i, { value: e.target.value })}
                    placeholder="Value"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  title="Remove condition"
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-rose-100 hover:text-rose-700"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

const ActionsBuilder: React.FC<{
  actions: DisplayAction[];
  onChange: (next: DisplayAction[]) => void;
  properties: { code: string; label: string }[];
  propertiesLoading: boolean;
}> = ({ actions, onChange, properties, propertiesLoading }) => {
  const addRow = () =>
    onChange([
      ...actions,
      { propertyCode: properties[0]?.code ?? '', action: 'hide' },
    ]);
  const updateRow = (index: number, patch: Partial<DisplayAction>) =>
    onChange(actions.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  const removeRow = (index: number) =>
    onChange(actions.filter((_, i) => i !== index));

  return (
    <section className="rounded border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Then</h3>
          <p className="text-xs text-muted-foreground">
            Apply these actions to fields when the conditions hold.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addRow} disabled={propertiesLoading}>
          <Plus size={14} />
          Add action
        </Button>
      </header>
      <div className="space-y-2 p-3">
        {actions.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            At least one action is required to save the rule.
          </div>
        ) : (
          actions.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                className={`${inputClass} w-1/3`}
                value={a.propertyCode}
                onChange={(e) => updateRow(i, { propertyCode: e.target.value })}
              >
                {properties.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label} ({p.code})
                  </option>
                ))}
              </select>
              <select
                className={`${inputClass} w-36`}
                value={a.action}
                onChange={(e) =>
                  updateRow(i, { action: e.target.value as DisplayActionKind })
                }
              >
                {ACTION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              {a.action === 'setValue' ? (
                <input
                  type="text"
                  className={`${inputClass} flex-1`}
                  value={String(a.value ?? '')}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder="Literal value to set"
                />
              ) : (
                <span className="flex-1 text-xs italic text-muted-foreground">
                  (no value required)
                </span>
              )}
              <button
                type="button"
                onClick={() => removeRow(i)}
                title="Remove action"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-rose-100 hover:text-rose-700"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

const extractAndConditions = (
  cond: Condition | Record<string, unknown> | null | undefined,
): SingleCondition[] => {
  if (!cond) return [];
  const c = cond as Condition;
  if ('and' in c && Array.isArray(c.and)) {
    return c.and
      .filter((x): x is SingleCondition => 'property' in x && 'operator' in x);
  }
  if ('property' in c && 'operator' in c) return [c as SingleCondition];
  return [];
};

const buildConditionPayload = (conditions: SingleCondition[]): Condition => {
  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { and: conditions };
};
