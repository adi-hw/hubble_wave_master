import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { propertyApi, type PropertyDefinition } from '../../../../../services/propertyApi';
import {
  fromPropertyDefinition,
  toPropertyCode,
  type PropertyDraft,
  type RowEntry,
  type RowStatus,
} from '../types';

interface UseTableBuilderArgs {
  collectionId: string;
}

interface UseTableBuilderResult {
  rows: RowEntry[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Set of mutated row keys, used to colour the save bar. */
  dirtyCount: number;
  refresh: () => Promise<void>;
  addRow: (defaults?: Partial<PropertyDraft>) => string;
  updateRow: (localKey: string, patch: Partial<PropertyDraft>) => void;
  deleteRow: (localKey: string) => void;
  reorder: (localKey: string, direction: 'up' | 'down') => void;
  saveAll: () => Promise<void>;
  /**
   * Reset local edits and reload from server. Used by "Discard" in the
   * save bar.
   */
  discard: () => Promise<void>;
}

type RowUpdater = RowEntry[] | ((current: RowEntry[]) => RowEntry[]);

/**
 * UUID per local row. crypto.randomUUID is available in every browser
 * we target plus Node's web-crypto polyfill, and it sidesteps the
 * dev-mode HMR drift a module-level counter would have.
 */
const nextLocalKey = (): string => crypto.randomUUID();

const draftsEqual = (a: PropertyDraft, b: PropertyDraft): boolean =>
  a.code === b.code &&
  a.label === b.label &&
  a.dataType === b.dataType &&
  JSON.stringify(a.config ?? {}) === JSON.stringify(b.config ?? {}) &&
  a.isRequired === b.isRequired &&
  a.isUnique === b.isUnique &&
  a.isReadonly === b.isReadonly &&
  a.displayOrder === b.displayOrder &&
  (a.referenceCollectionId ?? null) === (b.referenceCollectionId ?? null) &&
  (a.referenceDisplayProperty ?? null) === (b.referenceDisplayProperty ?? null);

const computeStatus = (entry: RowEntry): RowStatus => {
  if (entry.status === 'deleted') return 'deleted';
  if (!entry.baseline) return 'new';
  return draftsEqual(entry.draft, entry.baseline) ? 'clean' : 'dirty';
};

const blankDraft = (order: number, defaults?: Partial<PropertyDraft>): PropertyDraft => ({
  code: '',
  label: '',
  dataType: 'text',
  isRequired: false,
  isUnique: false,
  isReadonly: false,
  isSystem: false,
  displayOrder: order,
  referenceCollectionId: null,
  referenceDisplayProperty: null,
  ...defaults,
});

/**
 * Central state hook for the visual TableBuilder Data tab. Holds the
 * editable PropertyDraft array, tracks per-row dirty status, and
 * exposes the operations the canvas wires to its toolbar and rows.
 *
 * Save semantics: every mutation stays local until `saveAll` flushes
 * the diff to svc-metadata. Reorder is persisted in the same call as
 * field edits, so admins see one save action regardless of what they
 * touched. ADR-5 makes those edits create draft revisions on the
 * backend; the UI surfaces a published-vs-draft indicator in a later
 * slice once the publish-preview endpoint (ADR-17) ships.
 */
export const useTableBuilder = ({ collectionId }: UseTableBuilderArgs): UseTableBuilderResult => {
  const [rows, setRowsState] = useState<RowEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rowsRef = useRef<RowEntry[]>([]);
  const aliveRef = useRef(true);

  const setRows = useCallback((updater: RowUpdater) => {
    const nextRows = typeof updater === 'function' ? updater(rowsRef.current) : updater;
    rowsRef.current = nextRows;
    setRowsState(nextRows);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await propertyApi.list(collectionId);
      const sorted = [...result.data].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
      );
      const next: RowEntry[] = sorted.map((def: PropertyDefinition, idx: number) => {
        const draft = fromPropertyDefinition(def, idx);
        return {
          draft,
          baseline: { ...draft },
          status: 'clean',
          localKey: def.id ?? nextLocalKey(),
        };
      });
      if (aliveRef.current) setRows(next);
    } catch (err) {
      if (aliveRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load properties');
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [collectionId, setRows]);

  useEffect(() => {
    void load();
  }, [load]);

  const addRow = useCallback((defaults?: Partial<PropertyDraft>): string => {
    const localKey = nextLocalKey();
    setRows((prev) => {
      const order = prev.length;
      return [
        ...prev,
        {
          draft: blankDraft(order, defaults),
          baseline: null,
          status: 'new',
          localKey,
        },
      ];
    });
    return localKey;
  }, [setRows]);

  const updateRow = useCallback((localKey: string, patch: Partial<PropertyDraft>) => {
    setRows((prev) =>
      prev.map((entry) => {
        if (entry.localKey !== localKey) return entry;
        const nextDraft: PropertyDraft = { ...entry.draft, ...patch };
        const nextEntry: RowEntry = {
          ...entry,
          draft: nextDraft,
        };
        nextEntry.status = computeStatus(nextEntry);
        return nextEntry;
      }),
    );
  }, [setRows]);

  const deleteRow = useCallback((localKey: string) => {
    setRows((prev) => {
      const target = prev.find((r) => r.localKey === localKey);
      if (!target) return prev;
      if (!target.baseline) {
        return prev.filter((r) => r.localKey !== localKey);
      }
      return prev.map((entry) =>
        entry.localKey === localKey ? { ...entry, status: 'deleted' as RowStatus } : entry,
      );
    });
  }, [setRows]);

  const reorder = useCallback((localKey: string, direction: 'up' | 'down') => {
    setRows((prev) => {
      const visible = prev.filter((r) => r.status !== 'deleted');
      const idx = visible.findIndex((r) => r.localKey === localKey);
      if (idx < 0) return prev;
      const swapWith = direction === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= visible.length) return prev;
      const a = visible[idx];
      const b = visible[swapWith];
      return prev.map((entry) => {
        if (entry.localKey === a.localKey) {
          const nextDraft = { ...entry.draft, displayOrder: b.draft.displayOrder };
          const nextEntry: RowEntry = { ...entry, draft: nextDraft };
          nextEntry.status = computeStatus(nextEntry);
          return nextEntry;
        }
        if (entry.localKey === b.localKey) {
          const nextDraft = { ...entry.draft, displayOrder: a.draft.displayOrder };
          const nextEntry: RowEntry = { ...entry, draft: nextDraft };
          nextEntry.status = computeStatus(nextEntry);
          return nextEntry;
        }
        return entry;
      });
    });
  }, [setRows]);

  const saveAll = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const snapshot = rowsRef.current;

      for (const entry of snapshot) {
        if (entry.status === 'deleted' && entry.draft.id) {
          await propertyApi.delete(collectionId, entry.draft.id);
        }
      }

      for (const entry of snapshot) {
        if (entry.status === 'new') {
          const label = entry.draft.label.trim();
          const code = toPropertyCode(entry.draft.code || label);
          if (!label && !code) continue;
          if (!label) {
            throw new Error('New properties need a label before saving.');
          }
          if (!code) {
            throw new Error(`"${label}" needs a code with at least one letter or number.`);
          }
          await propertyApi.create(collectionId, {
            code,
            label,
            dataType: entry.draft.dataType,
            config: entry.draft.config,
            isRequired: entry.draft.isRequired,
            isUnique: entry.draft.isUnique,
            isReadonly: entry.draft.isReadonly,
            referenceCollectionId: entry.draft.referenceCollectionId ?? undefined,
            referenceDisplayProperty: entry.draft.referenceDisplayProperty ?? undefined,
          });
        }
      }

      for (const entry of snapshot) {
        if (entry.status === 'dirty' && entry.draft.id) {
          await propertyApi.update(collectionId, entry.draft.id, {
            label: entry.draft.label,
            isRequired: entry.draft.isRequired,
            isUnique: entry.draft.isUnique,
            isReadonly: entry.draft.isReadonly,
            referenceCollectionId: entry.draft.referenceCollectionId ?? undefined,
            referenceDisplayProperty: entry.draft.referenceDisplayProperty ?? undefined,
          });
        }
      }

      const orderPayload = snapshot
        .filter((entry) => entry.status !== 'deleted' && entry.draft.id)
        .map((entry) => ({
          id: entry.draft.id as string,
          displayOrder: entry.draft.displayOrder,
        }));
      if (orderPayload.length > 0) {
        await propertyApi.reorder(collectionId, orderPayload);
      }

      await load();
    } catch (err) {
      if (aliveRef.current) {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
      throw err;
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  }, [collectionId, load]);

  const discard = useCallback(async () => {
    await load();
  }, [load]);

  const refresh = load;

  const dirtyCount = useMemo(
    () => rows.filter((entry) => entry.status !== 'clean').length,
    [rows],
  );

  return {
    rows,
    loading,
    saving,
    error,
    dirtyCount,
    refresh,
    addRow,
    updateRow,
    deleteRow,
    reorder,
    saveAll,
    discard,
  };
};
