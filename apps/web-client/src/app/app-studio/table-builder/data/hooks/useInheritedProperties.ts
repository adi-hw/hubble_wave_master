import { useEffect, useRef, useState } from 'react';
import { propertyApi } from '../../../../../services/propertyApi';
import { schemaService, type CollectionDefinition } from '../../../../../services/schema';
import { fromPropertyDefinition, type PropertyDraft } from '../types';

interface UseInheritedPropertiesArgs {
  collectionId: string;
  extendsCollectionId: string | null | undefined;
}

export interface InheritedProperty {
  parent: { id: string; code: string; label: string };
  draft: PropertyDraft;
}

interface UseInheritedPropertiesResult {
  parent: CollectionDefinition | null;
  rows: InheritedProperty[];
  loading: boolean;
  error: string | null;
}

/**
 * Resolves the immediate parent Collection (if any) and its properties
 * for read-only display above the editable property grid.
 *
 * Slice B2 traverses one level only — multi-level chains are valid in
 * the schema (a parent can have its own parent) but rendering the full
 * chain is left for a follow-up slice once we have a real customer with
 * a 3-deep chain. Single-level keeps the UI uncluttered today.
 */
export const useInheritedProperties = ({
  extendsCollectionId,
}: UseInheritedPropertiesArgs): UseInheritedPropertiesResult => {
  const [parent, setParent] = useState<CollectionDefinition | null>(null);
  const [rows, setRows] = useState<InheritedProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!extendsCollectionId) {
      setParent(null);
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [parentRecord, propertiesResponse] = await Promise.all([
          schemaService.getCollection(extendsCollectionId),
          propertyApi.list(extendsCollectionId),
        ]);
        if (cancelled || !aliveRef.current) return;
        setParent(parentRecord);
        const sorted = [...propertiesResponse.data].sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
        );
        setRows(
          sorted.map((def, idx) => ({
            parent: {
              id: parentRecord.id,
              code: parentRecord.code,
              label: parentRecord.label ?? parentRecord.name ?? parentRecord.code,
            },
            draft: fromPropertyDefinition(def, idx),
          })),
        );
      } catch (err) {
        if (cancelled || !aliveRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load inherited properties');
        setParent(null);
        setRows([]);
      } finally {
        if (!cancelled && aliveRef.current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [extendsCollectionId]);

  return { parent, rows, loading, error };
};
