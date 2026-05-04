import { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import type { ColumnDef } from '../../../components/data/DataGrid';

export interface CollectionProperty {
  id: string;
  code: string;
  label?: string;
  name?: string;
  type?: string;
  position?: number;
}

export interface CollectionSchema {
  collection: { id: string; code: string; name: string; tableName?: string };
  properties: CollectionProperty[];
}

/**
 * Matches `GridFilterOperator` in svc-data's grid-query.service.ts.
 * Panels build filter clauses using these operators so the grid
 * endpoint validates them without translation.
 */
export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'empty'
  | 'notEmpty';

export interface FilterClause {
  column: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface UseCollectionRecordsOptions {
  collectionCode: string;
  pageSize?: number;
  filters?: FilterClause[];
}

export interface UseCollectionRecordsResult {
  rows: Array<Record<string, unknown>>;
  columns: ColumnDef<Record<string, unknown>>[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches a collection's schema + records for embedding in workspace
 * panels. Reuses the same RLS-respecting endpoints the runtime
 * ListView page uses:
 *
 *   GET  /api/data/collections/:code/schema   → properties for column derivation
 *   POST /api/data/grid/query                 → { collection, startRow, endRow, filters? }
 *
 * The axios `api` client is mounted at baseURL `/api/data`, so
 * paths inside the hook drop the leading `/data/` segment. The
 * grid body shape matches `GridQueryRequest` (collection /
 * startRow / endRow), not the legacy `tableName / page / pageSize`
 * shape — the latter silently returned an empty result.
 */
export const useCollectionRecords = ({
  collectionCode,
  pageSize = 25,
  filters,
}: UseCollectionRecordsOptions): UseCollectionRecordsResult => {
  const [schema, setSchema] = useState<CollectionSchema | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!collectionCode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const schemaRes = await api.get<CollectionSchema>(
          `/data/collections/${collectionCode}/schema`,
        );
        if (cancelled) return;
        setSchema(schemaRes.data);

        const queryRes = await api.post<{ rows: Array<Record<string, unknown>> }>(
          '/data/grid/query',
          {
            collection: collectionCode,
            startRow: 0,
            endRow: pageSize,
            filters: filters ?? [],
          },
        );
        if (cancelled) return;
        setRows(queryRes.data?.rows ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load records');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Filters changes intentionally trigger a refetch via JSON
    // serialization — primitive equality wouldn't match for inline
    // arrays the panel passes from props.
  }, [collectionCode, pageSize, JSON.stringify(filters ?? [])]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const props = schema?.properties ?? [];
    return props
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map<ColumnDef<Record<string, unknown>>>((prop) => ({
        id: prop.code,
        header: prop.label ?? prop.name ?? prop.code,
        accessor: (row) => row[prop.code],
        sortable: true,
      }));
  }, [schema]);

  return { rows, columns, loading, error };
};
