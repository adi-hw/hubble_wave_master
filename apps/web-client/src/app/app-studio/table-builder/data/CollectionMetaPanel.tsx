import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { schemaService } from '../../../../services/schema';
import { useStudioCollection } from '../CollectionContext';

interface CollectionMetaPanelProps {
  /** Called after a successful save so the parent can refresh the
   *  collection record (status badge, updated timestamps). */
  onSaved: () => void;
}

const labelClass = 'text-xs uppercase tracking-wide text-muted-foreground';
const inputClass =
  'w-full rounded border border-border bg-card px-2 py-1 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Top-of-canvas section that exposes the Collection's label and
 * description for inline editing. The Collection code is immutable after
 * creation (storage table is keyed by it) and is rendered read-only.
 *
 * Edits commit on blur via PUT /collections/:id; svc-metadata creates a
 * draft revision per ADR-5 (Slice C1 already wired this), so changes
 * here participate in the same draft/publish flow as property edits.
 */
export const CollectionMetaPanel: React.FC<CollectionMetaPanelProps> = ({ onSaved }) => {
  const collection = useStudioCollection();
  const [label, setLabel] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? '');
  const [savingField, setSavingField] = useState<'label' | 'description' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = async (field: 'label' | 'description', value: string) => {
    if (field === 'label' && value === collection.name) return;
    if (field === 'description' && value === (collection.description ?? '')) return;
    setSavingField(field);
    setError(null);
    try {
      await schemaService.updateCollection(collection.id, { [field]: value });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      if (field === 'label') setLabel(collection.name);
      else setDescription(collection.description ?? '');
    } finally {
      setSavingField(null);
    }
  };

  return (
    <section className="border-b border-border bg-muted/40 px-6 py-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass}>Collection name</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="text"
              className={inputClass}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => void commit('label', label)}
              disabled={savingField === 'label'}
              placeholder="Display label"
            />
            {savingField === 'label' ? (
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>

        <div>
          <label className={labelClass}>Code</label>
          <div className="mt-1">
            <input
              type="text"
              className={`${inputClass} font-mono`}
              value={collection.code}
              readOnly
              disabled
              title="Code is immutable after the Collection is created"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="text"
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => void commit('description', description)}
              disabled={savingField === 'description'}
              placeholder="What is this Collection for?"
            />
            {savingField === 'description' ? (
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
    </section>
  );
};
