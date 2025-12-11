import { useEffect, useState } from 'react';
import { createApiClient } from '../services/api';

export interface AuthorizedFieldMeta {
  code: string;
  label: string;
  type: string;
  isSystem: boolean;
  isInternal: boolean;
  showInForms: boolean;
  showInLists: boolean;
  canRead: boolean;
  canWrite: boolean;
  maskingStrategy: 'NONE' | 'PARTIAL' | 'FULL';
}

export interface TableMetadata {
  table: {
    code: string;
    dbTableName: string;
    label: string;
  };
  fields: AuthorizedFieldMeta[];
}

// In development, use proxy path to avoid cross-origin cookie issues
const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const metadataApi = createApiClient(METADATA_API_URL);

export const useTableMetadata = (tableCode: string) => {
  const [meta, setMeta] = useState<TableMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const res = await metadataApi.get(`/metadata/tables/${tableCode}`);
        if (!cancelled) {
          setMeta(res.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('failed_to_load_metadata');
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [tableCode]);

  return { meta, loading, error };
};
