import React from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Link2, Settings2, Trash2 } from 'lucide-react';
import { PropertyTypeSelector } from './PropertyTypeSelector';
import { isIncompleteReference, toPropertyCode, type RowEntry } from './types';

interface PropertyRowProps {
  entry: RowEntry;
  index: number;
  total: number;
  /**
   * Optional human label for the configured reference target. Resolved
   * by the canvas from its in-memory Collection list and passed in so
   * the row can render "→ {label}" without each row re-fetching.
   */
  referenceTargetLabel?: string;
  onUpdate: (patch: Partial<RowEntry['draft']>) => void;
  onDelete: () => void;
  onReorder: (direction: 'up' | 'down') => void;
  onOpenAdvanced: () => void;
  onConfigureReference: () => void;
}

const STATUS_BADGE: Record<RowEntry['status'], string | null> = {
  clean: null,
  dirty: 'Edited',
  new: 'New',
  deleted: 'Deleted',
};

const STATUS_TONE: Record<RowEntry['status'], string> = {
  clean: '',
  dirty: 'bg-amber-100 text-amber-800 border-amber-200',
  new: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  deleted: 'bg-rose-100 text-rose-800 border-rose-200',
};

const inputClass =
  'w-full rounded border border-border bg-card px-2 py-1 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

/**
 * One row of the spreadsheet-like property grid. Edits patch through
 * onUpdate so the parent canvas can compute the dirty count and drive
 * the save bar.
 *
 * System-managed properties (`isSystem` true) are read-only inline —
 * users open advanced settings via the gear button if the editor
 * permits modification, never via a direct grid edit.
 */
export const PropertyRow: React.FC<PropertyRowProps> = ({
  entry,
  index,
  total,
  referenceTargetLabel,
  onUpdate,
  onDelete,
  onReorder,
  onOpenAdvanced,
  onConfigureReference,
}) => {
  const { draft, status } = entry;
  const isDeleted = status === 'deleted';
  const isSystem = draft.isSystem;
  const codeEditable = !draft.id && !isSystem;
  const badge = STATUS_BADGE[status];
  const isReference = draft.dataType === 'reference';
  const referenceIncomplete = isIncompleteReference(draft);
  const handleLabelChange = (label: string) => {
    const patch: Partial<RowEntry['draft']> = { label };
    const previousGeneratedCode = toPropertyCode(draft.label);
    if (codeEditable && (!draft.code.trim() || draft.code === previousGeneratedCode)) {
      patch.code = toPropertyCode(label);
    }
    onUpdate(patch);
  };

  return (
    <tr
      className={[
        'border-b border-border align-middle',
        isDeleted ? 'opacity-50 line-through' : '',
        status === 'new' ? 'bg-emerald-50/50' : '',
        status === 'dirty' ? 'bg-amber-50/40' : '',
      ].join(' ')}
    >
      <td className="w-10 px-3 py-2 text-xs text-muted-foreground">{index + 1}</td>

      <td className="px-3 py-2">
        <input
          type="text"
          className={inputClass}
          value={draft.label}
          placeholder="Property label"
          disabled={isDeleted || isSystem}
          onChange={(e) => handleLabelChange(e.target.value)}
        />
      </td>

      <td className="px-3 py-2">
        <input
          type="text"
          className={`${inputClass} font-mono`}
          value={draft.code}
          placeholder="property_code"
          disabled={!codeEditable || isDeleted}
          onChange={(e) => onUpdate({ code: toPropertyCode(e.target.value) })}
        />
      </td>

      <td className="w-56 px-3 py-2">
        <PropertyTypeSelector
          value={draft.dataType}
          onChange={(next) => onUpdate({ dataType: next })}
          disabled={isDeleted || isSystem || !!draft.id}
        />
        {isReference ? (
          <button
            type="button"
            onClick={onConfigureReference}
            disabled={isDeleted}
            className={[
              'mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors',
              referenceIncomplete
                ? 'bg-warning-subtle text-warning-text hover:opacity-90'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
              isDeleted ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
            title={
              referenceIncomplete
                ? 'Reference target is required before saving'
                : 'Edit reference target'
            }
          >
            {referenceIncomplete ? <AlertCircle size={11} /> : <Link2 size={11} />}
            {referenceIncomplete
              ? 'Configure target'
              : `-> ${referenceTargetLabel ?? 'Configured'}`}
          </button>
        ) : null}
      </td>

      <td className="w-20 px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={draft.isRequired}
          disabled={isDeleted || isSystem}
          onChange={(e) => onUpdate({ isRequired: e.target.checked })}
          aria-label="Required"
          className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
        />
      </td>

      <td className="w-20 px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={draft.isUnique}
          disabled={isDeleted || isSystem}
          onChange={(e) => onUpdate({ isUnique: e.target.checked })}
          aria-label="Unique"
          className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
        />
      </td>

      <td className="w-28 px-3 py-2">
        {badge ? (
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}
          >
            {badge}
          </span>
        ) : null}
      </td>

      <td className="w-32 px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onReorder('up')}
            disabled={isDeleted || index === 0}
            title="Move up"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => onReorder('down')}
            disabled={isDeleted || index === total - 1}
            title="Move down"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            onClick={onOpenAdvanced}
            disabled={isDeleted || !draft.id}
            title="Advanced settings"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Settings2 size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleted || isSystem}
            title={isSystem ? 'System properties cannot be deleted' : 'Delete property'}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-rose-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};
