import { useEffect, useState } from 'react';
import { createApiClient } from '../services/api';

export interface AuthorizedPropertyMeta {
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

// Deprecated alias for backward compatibility
export type AuthorizedFieldMeta = AuthorizedPropertyMeta;

export interface CollectionMetadata {
  collection: {
    code: string;
    dbTableName: string;
    label: string;
  };
  properties: AuthorizedPropertyMeta[];
}

// Deprecated alias for backward compatibility
export type TableMetadata = CollectionMetadata;

// In development, use proxy path to avoid cross-origin cookie issues
const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const metadataApi = createApiClient(METADATA_API_URL);

export const useCollectionMetadata = (collectionCode: string) => {
  const [meta, setMeta] = useState<CollectionMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const res = await metadataApi.get(`/metadata/collections/${collectionCode}`);
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
  }, [collectionCode]);

  return { meta, loading, error };
};

// Deprecated alias for backward compatibility
export const useTableMetadata = useCollectionMetadata;
