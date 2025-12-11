import { useEffect, useState, useCallback } from 'react';
import { createApiClient } from '../../services/api';
import type { TableMeta } from './types';

// In development, use proxy path to avoid cross-origin cookie issues
const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const metadataApi = createApiClient(METADATA_API_URL);

export const useTableMetadata = (tableCode: string) => {
  const [meta, setMeta] = useState<TableMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await metadataApi.get(`/metadata/tables/${tableCode}`);
      setMeta(res.data);
    } catch {
      setError('load_failed');
    } finally {
      setLoading(false);
    }
  }, [tableCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  return { meta, loading, error, refetch };
};
