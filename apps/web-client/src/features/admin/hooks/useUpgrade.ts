import { useState, useEffect, useCallback } from 'react';
import { upgradeApi } from '../services/admin-config.service';
import type {
  UpgradeManifest,
  InstanceUpgradeImpact,
  UpgradeAnalysis,
  ListResponse,
  ResolutionStrategy,
} from '../types';

interface UseUpgradeManifestsOptions {
  fromVersion?: string;
  enabled?: boolean;
}

interface UseUpgradeManifestsReturn {
  manifests: UpgradeManifest[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to list available upgrade manifests
 */
export function useUpgradeManifests(
  options: UseUpgradeManifestsOptions = {}
): UseUpgradeManifestsReturn {
  const { fromVersion, enabled = true } = options;
  const [manifests, setManifests] = useState<UpgradeManifest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManifests = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);
      const response: ListResponse<UpgradeManifest> = await upgradeApi.listManifests({
        fromVersion,
      });
      setManifests(response.data);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load upgrade manifests');
    } finally {
      setLoading(false);
    }
  }, [fromVersion, enabled]);

  useEffect(() => {
    fetchManifests();
  }, [fetchManifests]);

  return {
    manifests,
    total,
    loading,
    error,
    refetch: fetchManifests,
  };
}

interface UseUpgradeManifestOptions {
  enabled?: boolean;
}

interface UseUpgradeManifestReturn {
  manifest: UpgradeManifest | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get a single upgrade manifest
 */
export function useUpgradeManifest(
  manifestId: string | null,
  options: UseUpgradeManifestOptions = {}
): UseUpgradeManifestReturn {
  const { enabled = true } = options;
  const [manifest, setManifest] = useState<UpgradeManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManifest = useCallback(async () => {
    if (!enabled || !manifestId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await upgradeApi.getManifest(manifestId);
      setManifest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load upgrade manifest');
    } finally {
      setLoading(false);
    }
  }, [manifestId, enabled]);

  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  return {
    manifest,
    loading,
    error,
    refetch: fetchManifest,
  };
}

interface UseUpgradeImpactsReturn {
  impacts: InstanceUpgradeImpact[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get upgrade impacts for a manifest
 */
export function useUpgradeImpacts(
  manifestId: string | null,
  options: UseUpgradeManifestOptions = {}
): UseUpgradeImpactsReturn {
  const { enabled = true } = options;
  const [impacts, setImpacts] = useState<InstanceUpgradeImpact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchImpacts = useCallback(async () => {
    if (!enabled || !manifestId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response: ListResponse<InstanceUpgradeImpact> = await upgradeApi.getImpacts(manifestId);
      setImpacts(response.data);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load upgrade impacts');
    } finally {
      setLoading(false);
    }
  }, [manifestId, enabled]);

  useEffect(() => {
    fetchImpacts();
  }, [fetchImpacts]);

  return {
    impacts,
    total,
    loading,
    error,
    refetch: fetchImpacts,
  };
}

interface UseCurrentVersionReturn {
  version: string | null;
  appliedAt: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get current platform version
 */
export function useCurrentVersion(): UseCurrentVersionReturn {
  const [version, setVersion] = useState<string | null>(null);
  const [appliedAt, setAppliedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersion = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await upgradeApi.getCurrentVersion();
      setVersion(data.version);
      setAppliedAt(data.appliedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load current version');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  return {
    version,
    appliedAt,
    loading,
    error,
    refetch: fetchVersion,
  };
}

interface MutationState {
  loading: boolean;
  error: string | null;
}

interface UseUpgradeMutationsReturn {
  analyzeImpact: (manifestId: string) => Promise<UpgradeAnalysis | null>;
  resolveImpact: (
    impactId: string,
    resolution: {
      choice: ResolutionStrategy;
      customValue?: Record<string, any>;
      notes?: string;
    }
  ) => Promise<InstanceUpgradeImpact | null>;
  previewMerge: (
    impactId: string,
    strategy: ResolutionStrategy
  ) => Promise<{ mergedValue: Record<string, any> } | null>;
  applyUpgrade: (manifestId: string) => Promise<{ success: boolean; appliedAt: string } | null>;
  analyzeState: MutationState;
  resolveState: MutationState;
  previewState: MutationState;
  applyState: MutationState;
}

/**
 * Hook for upgrade mutations (analyze, resolve, preview, apply)
 */
export function useUpgradeMutations(): UseUpgradeMutationsReturn {
  const [analyzeState, setAnalyzeState] = useState<MutationState>({ loading: false, error: null });
  const [resolveState, setResolveState] = useState<MutationState>({ loading: false, error: null });
  const [previewState, setPreviewState] = useState<MutationState>({ loading: false, error: null });
  const [applyState, setApplyState] = useState<MutationState>({ loading: false, error: null });

  const analyzeImpact = useCallback(async (manifestId: string): Promise<UpgradeAnalysis | null> => {
    try {
      setAnalyzeState({ loading: true, error: null });
      const result = await upgradeApi.analyzeImpact(manifestId);
      setAnalyzeState({ loading: false, error: null });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to analyze upgrade impact';
      setAnalyzeState({ loading: false, error });
      return null;
    }
  }, []);

  const resolveImpact = useCallback(
    async (
      impactId: string,
      resolution: {
        choice: ResolutionStrategy;
        customValue?: Record<string, any>;
        notes?: string;
      }
    ): Promise<InstanceUpgradeImpact | null> => {
      try {
        setResolveState({ loading: true, error: null });
        const result = await upgradeApi.resolveImpact(impactId, resolution);
        setResolveState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to resolve impact';
        setResolveState({ loading: false, error });
        return null;
      }
    },
    []
  );

  const previewMerge = useCallback(
    async (
      impactId: string,
      strategy: ResolutionStrategy
    ): Promise<{ mergedValue: Record<string, any> } | null> => {
      try {
        setPreviewState({ loading: true, error: null });
        const result = await upgradeApi.previewMerge(impactId, strategy);
        setPreviewState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to preview merge';
        setPreviewState({ loading: false, error });
        return null;
      }
    },
    []
  );

  const applyUpgrade = useCallback(
    async (manifestId: string): Promise<{ success: boolean; appliedAt: string } | null> => {
      try {
        setApplyState({ loading: true, error: null });
        const result = await upgradeApi.applyUpgrade(manifestId);
        setApplyState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to apply upgrade';
        setApplyState({ loading: false, error });
        return null;
      }
    },
    []
  );

  return {
    analyzeImpact,
    resolveImpact,
    previewMerge,
    applyUpgrade,
    analyzeState,
    resolveState,
    previewState,
    applyState,
  };
}
