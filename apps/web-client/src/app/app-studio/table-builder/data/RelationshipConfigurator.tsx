import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { schemaService, type CollectionDefinition } from '../../../../services/schema';
import { propertyApi, type PropertyDefinition } from '../../../../services/propertyApi';

interface RelationshipConfiguratorProps {
  open: boolean;
  /** Property the user is configuring; null when modal is closed. */
  propertyLabel?: string;
  initialReferenceCollectionId?: string | null;
  initialReferenceDisplayProperty?: string | null;
  /** Optional: ids the picker must exclude (typically the current
   *  Collection - references back to self are valid but uncommon
   *  during initial setup). */
  excludeCollectionIds?: string[];
  onClose: () => void;
  onSave: (config: {
    referenceCollectionId: string;
    referenceDisplayProperty: string;
  }) => void;
}

const labelClass = 'mb-1 block text-xs uppercase tracking-wide text-muted-foreground';
const inputClass =
  'w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none';
const collectionLabel = (collection: CollectionDefinition): string =>
  collection.label ?? collection.name ?? collection.code;

/**
 * Configures the target side of a `reference`-typed property: which
 * Collection the row points to, and which property of that Collection
 * is displayed in the reference picker.
 *
 * Filter expressions (referenceFilter) are deliberately omitted from
 * Slice B3 - they require the shared ConditionBuilder which is itself
 * being repurposed in Phase 2 (Display Rules). Filters land in the same
 * slice as the ConditionBuilder shared component to avoid a fork.
 */
export const RelationshipConfigurator: React.FC<RelationshipConfiguratorProps> = ({
  open,
  propertyLabel,
  initialReferenceCollectionId,
  initialReferenceDisplayProperty,
  excludeCollectionIds = [],
  onClose,
  onSave,
}) => {
  const [collections, setCollections] = useState<CollectionDefinition[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    initialReferenceCollectionId ?? '',
  );

  const [targetProperties, setTargetProperties] = useState<PropertyDefinition[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const [displayProperty, setDisplayProperty] = useState<string>(
    initialReferenceDisplayProperty ?? '',
  );

  useEffect(() => {
    if (!open) return;
    setSelectedCollectionId(initialReferenceCollectionId ?? '');
    setDisplayProperty(initialReferenceDisplayProperty ?? '');
    setSearch('');
  }, [open, initialReferenceCollectionId, initialReferenceDisplayProperty]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCollectionsLoading(true);
    setCollectionsError(null);
    schemaService
      .getCollections({ includeSystem: false })
      .then((list) => {
        if (cancelled) return;
        setCollections(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setCollectionsError(
          err instanceof Error ? err.message : 'Failed to load collections',
        );
      })
      .finally(() => {
        if (!cancelled) setCollectionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selectedCollectionId) {
      setTargetProperties([]);
      return;
    }
    let cancelled = false;
    setPropertiesLoading(true);
    setPropertiesError(null);
    propertyApi
      .list(selectedCollectionId)
      .then((res) => {
        if (cancelled) return;
        setTargetProperties(res.data);
        if (!displayProperty && res.data.length > 0) {
          const codeProp = res.data.find((p) => p.code === 'name' || p.code === 'label');
          setDisplayProperty(codeProp?.code ?? res.data[0].code);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setPropertiesError(
          err instanceof Error ? err.message : 'Failed to load target properties',
        );
      })
      .finally(() => {
        if (!cancelled) setPropertiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedCollectionId, displayProperty]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return collections.filter((c) => {
      if (excludeCollectionIds.includes(c.id)) return false;
      if (!q) return true;
      const label = collectionLabel(c).toLowerCase();
      return (
        label.includes(q) || c.code.toLowerCase().includes(q)
      );
    });
  }, [collections, search, excludeCollectionIds]);

  const canSave = !!selectedCollectionId && !!displayProperty;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      referenceCollectionId: selectedCollectionId,
      referenceDisplayProperty: displayProperty,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configure reference"
      description={
        propertyLabel
          ? `Pick the target Collection for "${propertyLabel}".`
          : 'Pick the target Collection for this reference.'
      }
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save reference
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Target Collection</label>
          <div className="relative mb-2">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              className={`${inputClass} pl-9`}
              placeholder="Search Collections by label or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-56 overflow-auto rounded border border-border bg-card">
            {collectionsLoading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                Loading Collections...
              </div>
            ) : collectionsError ? (
              <div className="px-3 py-3 text-sm text-destructive">{collectionsError}</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                No matching Collections.
              </div>
            ) : (
              filtered.map((c) => {
                const selected = c.id === selectedCollectionId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCollectionId(c.id);
                      setDisplayProperty('');
                    }}
                    className={[
                      'flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0',
                      selected
                        ? 'bg-primary/10 text-foreground'
                        : 'text-foreground hover:bg-muted',
                    ].join(' ')}
                  >
                    <span>
                      <span className="block">{collectionLabel(c)}</span>
                      <span className="block text-xs text-muted-foreground">
                        <span className="font-mono">{c.code}</span>
                        {c.category ? ` | ${c.category}` : ''}
                      </span>
                    </span>
                    {selected ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        Selected
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div>
          <label className={labelClass}>Display property</label>
          <p className="mb-2 text-xs text-muted-foreground">
            The property of the target Collection shown when a record is referenced -
            for example, a User reference might display the user&apos;s name rather than
            the row id.
          </p>
          {selectedCollectionId ? (
            propertiesLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                Loading target properties...
              </div>
            ) : propertiesError ? (
              <div className="text-sm text-destructive">{propertiesError}</div>
            ) : targetProperties.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Target Collection has no properties yet.
              </div>
            ) : (
              <select
                className={inputClass}
                value={displayProperty}
                onChange={(e) => setDisplayProperty(e.target.value)}
              >
                <option value="" disabled>
                  Select a property...
                </option>
                {targetProperties.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.label} ({p.code})
                  </option>
                ))}
              </select>
            )
          ) : (
            <div className="text-sm text-muted-foreground">
              Select a target Collection first.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
