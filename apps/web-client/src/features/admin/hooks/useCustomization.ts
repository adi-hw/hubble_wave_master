import { useState, useEffect, useCallback } from 'react';
import { customizationApi } from '../services/admin-config.service';
import type {
  InstanceCustomization,
  CreateCustomizationDto,
  UpdateCustomizationDto,
  ListResponse,
  ConfigListFilters,
  PlatformConfig,
} from '../types';

interface UseCustomizationListOptions extends ConfigListFilters {
  enabled?: boolean;
}

interface UseCustomizationListReturn {
  customizations: InstanceCustomization[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to list instance customizations with optional filters
 */
export function useCustomizationList(
  options: UseCustomizationListOptions = {}
): UseCustomizationListReturn {
  const { configType, customizationType, active, enabled = true } = options;
  const [customizations, setCustomizations] = useState<InstanceCustomization[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomizations = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);
      const response: ListResponse<InstanceCustomization> = await customizationApi.list({
        configType,
        customizationType,
        active,
      });
      setCustomizations(response.data);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customizations');
    } finally {
      setLoading(false);
    }
  }, [configType, customizationType, active, enabled]);

  useEffect(() => {
    fetchCustomizations();
  }, [fetchCustomizations]);

  return {
    customizations,
    total,
    loading,
    error,
    refetch: fetchCustomizations,
  };
}

interface UseCustomizationOptions {
  enabled?: boolean;
}

interface UseCustomizationReturn {
  customization: InstanceCustomization | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get a single customization by ID
 */
export function useCustomization(
  id: string | null,
  options: UseCustomizationOptions = {}
): UseCustomizationReturn {
  const { enabled = true } = options;
  const [customization, setCustomization] = useState<InstanceCustomization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomization = useCallback(async () => {
    if (!enabled || !id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await customizationApi.get(id);
      setCustomization(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customization');
    } finally {
      setLoading(false);
    }
  }, [id, enabled]);

  useEffect(() => {
    fetchCustomization();
  }, [fetchCustomization]);

  return {
    customization,
    loading,
    error,
    refetch: fetchCustomization,
  };
}

interface UseCustomizationVersionHistoryReturn {
  versions: InstanceCustomization[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get version history for a customization
 */
export function useCustomizationVersionHistory(
  configType: string,
  resourceKey: string,
  options: UseCustomizationOptions = {}
): UseCustomizationVersionHistoryReturn {
  const { enabled = true } = options;
  const [versions, setVersions] = useState<InstanceCustomization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!enabled || !configType || !resourceKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await customizationApi.getVersionHistory(configType, resourceKey);
      setVersions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  }, [configType, resourceKey, enabled]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return {
    versions,
    loading,
    error,
    refetch: fetchVersions,
  };
}

interface UseCompareWithPlatformReturn {
  comparison: {
    customization: InstanceCustomization;
    platformConfig: PlatformConfig;
    diff: any[];
  } | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to compare a customization with its platform config
 */
export function useCompareWithPlatform(
  customizationId: string | null,
  options: UseCustomizationOptions = {}
): UseCompareWithPlatformReturn {
  const { enabled = true } = options;
  const [comparison, setComparison] = useState<UseCompareWithPlatformReturn['comparison']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    if (!enabled || !customizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await customizationApi.compareWithPlatform(customizationId);
      setComparison(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare with platform config');
    } finally {
      setLoading(false);
    }
  }, [customizationId, enabled]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  return {
    comparison,
    loading,
    error,
    refetch: fetchComparison,
  };
}

interface MutationState {
  loading: boolean;
  error: string | null;
}

interface UseCustomizationMutationsReturn {
  createCustomization: (data: CreateCustomizationDto) => Promise<InstanceCustomization | null>;
  updateCustomization: (id: string, data: UpdateCustomizationDto) => Promise<InstanceCustomization | null>;
  deleteCustomization: (id: string) => Promise<boolean>;
  createState: MutationState;
  updateState: MutationState;
  deleteState: MutationState;
}

/**
 * Hook for customization mutations (create, update, delete)
 */
export function useCustomizationMutations(): UseCustomizationMutationsReturn {
  const [createState, setCreateState] = useState<MutationState>({ loading: false, error: null });
  const [updateState, setUpdateState] = useState<MutationState>({ loading: false, error: null });
  const [deleteState, setDeleteState] = useState<MutationState>({ loading: false, error: null });

  const createCustomization = useCallback(
    async (data: CreateCustomizationDto): Promise<InstanceCustomization | null> => {
      try {
        setCreateState({ loading: true, error: null });
        const result = await customizationApi.create(data);
        setCreateState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to create customization';
        setCreateState({ loading: false, error });
        return null;
      }
    },
    []
  );

  const updateCustomization = useCallback(
    async (id: string, data: UpdateCustomizationDto): Promise<InstanceCustomization | null> => {
      try {
        setUpdateState({ loading: true, error: null });
        const result = await customizationApi.update(id, data);
        setUpdateState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to update customization';
        setUpdateState({ loading: false, error });
        return null;
      }
    },
    []
  );

  const deleteCustomization = useCallback(async (id: string): Promise<boolean> => {
    try {
      setDeleteState({ loading: true, error: null });
      const result = await customizationApi.delete(id);
      setDeleteState({ loading: false, error: null });
      return result.success;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to delete customization';
      setDeleteState({ loading: false, error });
      return false;
    }
  }, []);

  return {
    createCustomization,
    updateCustomization,
    deleteCustomization,
    createState,
    updateState,
    deleteState,
  };
}
