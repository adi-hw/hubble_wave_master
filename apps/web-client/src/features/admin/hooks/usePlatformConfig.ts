import { useState, useEffect, useCallback } from 'react';
import { platformConfigApi } from '../services/admin-config.service';
import type { PlatformConfig, ListResponse } from '../types';

interface UsePlatformConfigListOptions {
  type?: string;
  version?: string;
  enabled?: boolean;
}

interface UsePlatformConfigListReturn {
  configs: PlatformConfig[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to list platform configurations with optional filters
 */
export function usePlatformConfigList(
  options: UsePlatformConfigListOptions = {}
): UsePlatformConfigListReturn {
  const { type, version, enabled = true } = options;
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);
      const response: ListResponse<PlatformConfig> = await platformConfigApi.list({
        type,
        version,
      });
      setConfigs(response.data);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform configurations');
    } finally {
      setLoading(false);
    }
  }, [type, version, enabled]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return {
    configs,
    total,
    loading,
    error,
    refetch: fetchConfigs,
  };
}

interface UsePlatformConfigOptions {
  enabled?: boolean;
}

interface UsePlatformConfigReturn {
  config: PlatformConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get a single platform configuration by type and resource key
 */
export function usePlatformConfig(
  configType: string,
  resourceKey: string,
  options: UsePlatformConfigOptions = {}
): UsePlatformConfigReturn {
  const { enabled = true } = options;
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!enabled || !configType || !resourceKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await platformConfigApi.get(configType, resourceKey);
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform configuration');
    } finally {
      setLoading(false);
    }
  }, [configType, resourceKey, enabled]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    loading,
    error,
    refetch: fetchConfig,
  };
}

interface UseConfigTypesReturn {
  configTypes: string[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get all available config types
 */
export function useConfigTypes(): UseConfigTypesReturn {
  const [configTypes, setConfigTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await platformConfigApi.getConfigTypes();
      setConfigTypes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config types');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigTypes();
  }, [fetchConfigTypes]);

  return {
    configTypes,
    loading,
    error,
    refetch: fetchConfigTypes,
  };
}
