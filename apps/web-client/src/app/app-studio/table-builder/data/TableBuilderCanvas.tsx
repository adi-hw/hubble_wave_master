import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Loader2, Plus, RotateCcw, Save, Sparkles, Upload } from 'lucide-react';
import { useStudioCollection } from '../CollectionContext';
import { useTableBuilder } from './hooks/useTableBuilder';
import { useInheritedProperties } from './hooks/useInheritedProperties';
import { CollectionMetaPanel } from './CollectionMetaPanel';
import { InheritancePanel } from './InheritancePanel';
import { InheritedPropertyRow } from './InheritedPropertyRow';
import { PropertyRow } from './PropertyRow';
import { RelationshipConfigurator } from './RelationshipConfigurator';
import { SchemaPreview } from './SchemaPreview';
import { PublishConfirmDialog } from './PublishConfirmDialog';
import { isIncompleteReference, toPropertyCode, type PropertyDraft } from './types';
import { schemaService } from '../../../../services/schema';
import { PropertyEditor } from '../../../../features/admin/properties';
import { AvaSuggestionsModal } from '../../../../features/admin/properties/AvaSuggestionsModal';
import { propertyApi, type PropertyDefinition } from '../../../../services/propertyApi';
import { DISABLED_OPACITY } from '../../../../lib/styling';

interface TableBuilderCanvasProps {
  /** Optional: notify the TableBuilder shell when the Collection record
   *  has been mutated (e.g. label changed) so its header re-fetches. */
  onCollectionChanged?: () => void;
}

const tableHeaderClass =
  'sticky top-0 z-10 border-b border-border bg-card text-xs font-medium uppercase tracking-wide text-muted-foreground';

/**
 * The Data tab's primary surface. Combines collection metadata (top
 * panel) and properties (inline-editable rows below) into a single
 * spreadsheet-like grid.
 *
 * Slice B1 ships:
 * - Inline edit of label, code (new rows only), type (new rows only),
 *   required, unique, readonly flags.
 * - Up/down reorder; deletion with soft-mark (deletes flush on save).
 * - "Add property" toolbar action; "Smart Detect" wired to the existing
 *   AVA type-detection modal; "Edit advanced" opens the existing
 *   PropertyEditor modal for choice lists, references, and validation
 *   rules.
 * - Bottom save bar with dirty count, Save All, Discard.
 *
 * Deferred to subsequent B-slices:
 * - Drag-to-reorder (B1.5 if demand warrants; up/down works today).
 * - Inheritance panel and parent property indicator (B2).
 * - Schema preview pane (B2).
 * - Spreadsheet record sub-tab (B3, ADR-16).
 * - Publish-preview integration (B4, ADR-17).
 */
export const TableBuilderCanvas: React.FC<TableBuilderCanvasProps> = ({
  onCollectionChanged,
}) => {
  const collection = useStudioCollection();
  const builder = useTableBuilder({ collectionId: collection.id });
  const inherited = useInheritedProperties({
    collectionId: collection.id,
    extendsCollectionId: collection.extendsCollectionId,
  });
  const {
    rows,
    loading,
    saving,
    error,
    dirtyCount,
    addRow,
    updateRow,
    deleteRow,
    reorder,
    saveAll,
    discard,
    refresh,
  } = builder;

  const [editingProperty, setEditingProperty] = useState<PropertyDefinition | null>(null);
  const [avaOpen, setAvaOpen] = useState(false);
  const [schemaPreviewOpen, setSchemaPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [configuringRowKey, setConfiguringRowKey] = useState<string | null>(null);
  const [collectionLabels, setCollectionLabels] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    schemaService
      .getCollections({ includeSystem: true })
      .then((list) => {
        if (cancelled) return;
        setCollectionLabels(new Map(list.map((c) => [c.id, c.label ?? c.name ?? c.code])));
      })
      .catch(() => {
        if (cancelled) return;
        setCollectionLabels(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRows = rows.filter((r) => r.status !== 'deleted');
  const allRowsForIndex = rows;
  const configuringEntry = useMemo(
    () => rows.find((r) => r.localKey === configuringRowKey) ?? null,
    [rows, configuringRowKey],
  );
  const incompleteReferenceCount = visibleRows.filter((r) =>
    isIncompleteReference(r.draft),
  ).length;

  const onOpenAdvanced = useCallback(
    async (propertyId: string) => {
      try {
        const property = await propertyApi.get(collection.id, propertyId);
        setEditingProperty(property);
      } catch {
        setEditingProperty(null);
      }
    },
    [collection.id],
  );

  const onAdvancedSaved = useCallback(() => {
    setEditingProperty(null);
    void refresh();
  }, [refresh]);

  const onAvaApply = useCallback(
    (suggestion: { dataType: string; label?: string; formatOptions?: Record<string, unknown> }) => {
      const label = suggestion.label?.trim() ?? '';
      const defaults: Partial<PropertyDraft> = {
        dataType: suggestion.dataType,
        label,
        code: toPropertyCode(label),
        config: suggestion.formatOptions ?? {},
      };
      addRow(defaults);
      setAvaOpen(false);
    },
    [addRow],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CollectionMetaPanel onSaved={() => onCollectionChanged?.()} />

      <InheritancePanel
        parent={inherited.parent}
        inheritedCount={inherited.rows.length}
        loading={inherited.loading}
        error={inherited.error}
      />

      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Properties</h2>
          <p className="text-xs text-muted-foreground">
            {visibleRows.length} {visibleRows.length === 1 ? 'own property' : 'own properties'}
            {inherited.rows.length > 0 ? ` | ${inherited.rows.length} inherited` : ''} |
            edits stay local until you save.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setSchemaPreviewOpen(true)}
            disabled={dirtyCount > 0 || incompleteReferenceCount > 0}
            className={`inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted ${DISABLED_OPACITY}`}
            title={
              dirtyCount > 0
                ? 'Save your changes before previewing schema'
                : incompleteReferenceCount > 0
                ? 'Configure all reference targets before previewing schema'
                : 'Preview the DDL svc-metadata would run on next deploy'
            }
          >
            <Database size={14} />
            Preview schema
          </button>
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            disabled={dirtyCount > 0 || incompleteReferenceCount > 0}
            className={`inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted ${DISABLED_OPACITY}`}
            title={
              dirtyCount > 0
                ? 'Save your changes before publishing'
                : incompleteReferenceCount > 0
                ? 'Configure all reference targets before publishing'
                : 'Publish current draft - opens an impact-aware confirm dialog'
            }
          >
            <Upload size={14} />
            Publish
          </button>
          <button
            type="button"
            onClick={() => setAvaOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Sparkles size={14} />
            Smart Detect
          </button>
          <button
            type="button"
            onClick={() => addRow()}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:opacity-90"
          >
            <Plus size={14} />
            Add property
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center gap-2 px-6 py-10 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Loading properties...
          </div>
        ) : error ? (
          <div className="m-6 rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : visibleRows.length === 0 && inherited.rows.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">
            <p className="mb-3">This Collection has no properties yet.</p>
            <button
              type="button"
              onClick={() => addRow()}
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:opacity-90"
            >
              <Plus size={14} />
              Add the first property
            </button>
          </div>
        ) : (
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead>
              <tr className={tableHeaderClass}>
                <th className="w-10 px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Label</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="w-56 px-3 py-2 text-left">Type</th>
                <th className="w-20 px-3 py-2 text-center">Required</th>
                <th className="w-20 px-3 py-2 text-center">Unique</th>
                <th className="w-28 px-3 py-2 text-left">Status</th>
                <th className="w-32 px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inherited.rows.map((row, idx) => (
                <InheritedPropertyRow
                  key={`inherited-${row.draft.id ?? idx}`}
                  row={row}
                  index={idx}
                />
              ))}
              {allRowsForIndex.map((entry, idx) => {
                const visibleIndex = visibleRows.indexOf(entry);
                if (visibleIndex < 0 && entry.status !== 'deleted') return null;
                return (
                  <PropertyRow
                    key={entry.localKey}
                    entry={entry}
                    index={visibleIndex < 0 ? idx : visibleIndex}
                    total={visibleRows.length}
                    referenceTargetLabel={
                      entry.draft.referenceCollectionId
                        ? collectionLabels.get(entry.draft.referenceCollectionId)
                        : undefined
                    }
                    onUpdate={(patch) => updateRow(entry.localKey, patch)}
                    onDelete={() => deleteRow(entry.localKey)}
                    onReorder={(direction) => reorder(entry.localKey, direction)}
                    onOpenAdvanced={() => {
                      if (entry.draft.id) void onOpenAdvanced(entry.draft.id);
                    }}
                    onConfigureReference={() => setConfiguringRowKey(entry.localKey)}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {dirtyCount > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="text-sm text-foreground">
            <span className="font-medium">{dirtyCount}</span>{' '}
            {dirtyCount === 1 ? 'unsaved change' : 'unsaved changes'}
            {incompleteReferenceCount > 0 ? (
              <span className="ml-2 inline-flex rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-text">
                {incompleteReferenceCount} incomplete reference
                {incompleteReferenceCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => void discard()}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted ${DISABLED_OPACITY}`}
            >
              <RotateCcw size={14} />
              Discard
            </button>
            <button
              type="button"
              onClick={() => void saveAll()}
              disabled={saving || incompleteReferenceCount > 0}
              title={
                incompleteReferenceCount > 0
                  ? 'Configure all reference targets before saving'
                  : undefined
              }
              className={`inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:opacity-90 ${DISABLED_OPACITY}`}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save changes
            </button>
          </div>
        </div>
      ) : null}

      <PropertyEditor
        open={!!editingProperty}
        collectionId={collection.id}
        property={editingProperty ?? undefined}
        onClose={() => setEditingProperty(null)}
        onSave={onAdvancedSaved}
      />

      <AvaSuggestionsModal
        open={avaOpen}
        collectionId={collection.id}
        onClose={() => setAvaOpen(false)}
        onApply={onAvaApply}
      />

      <SchemaPreview
        open={schemaPreviewOpen}
        collectionCode={collection.code}
        collectionLabel={collection.name}
        onClose={() => setSchemaPreviewOpen(false)}
        onDeployed={() => {
          onCollectionChanged?.();
          void refresh();
        }}
      />

      <PublishConfirmDialog
        open={publishOpen}
        collectionId={collection.id}
        collectionLabel={collection.name}
        onClose={() => setPublishOpen(false)}
        onPublished={() => {
          onCollectionChanged?.();
          void refresh();
        }}
      />

      <RelationshipConfigurator
        open={!!configuringEntry}
        propertyLabel={configuringEntry?.draft.label}
        initialReferenceCollectionId={configuringEntry?.draft.referenceCollectionId}
        initialReferenceDisplayProperty={configuringEntry?.draft.referenceDisplayProperty}
        excludeCollectionIds={[collection.id]}
        onClose={() => setConfiguringRowKey(null)}
        onSave={(config) => {
          if (configuringRowKey) {
            updateRow(configuringRowKey, {
              referenceCollectionId: config.referenceCollectionId,
              referenceDisplayProperty: config.referenceDisplayProperty,
            });
          }
          setConfiguringRowKey(null);
        }}
      />
    </div>
  );
};
