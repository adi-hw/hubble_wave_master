import { useState, useEffect, useCallback } from 'react';
import { historyApi } from '../services/admin-config.service';
import type { ConfigChangeHistory, ListResponse, HistoryListFilters } from '../types';

interface UseConfigHistoryListOptions extends HistoryListFilters {
  enabled?: boolean;
}

interface UseConfigHistoryListReturn {
  history: ConfigChangeHistory[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

/**
 * Hook to list config change history with optional filters and pagination
 */
export function useConfigHistoryList(
  options: UseConfigHistoryListOptions = {}
): UseConfigHistoryListReturn {
  const {
    configType,
    resourceKey,
    changeType,
    changedBy,
    fromDate,
    toDate,
    limit = 20,
    offset: initialOffset = 0,
    enabled = true,
  } = options;

  const [history, setHistory] = useState<ConfigChangeHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(initialOffset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(
    async (reset = false) => {
      if (!enabled) return;

      try {
        setLoading(true);
        setError(null);
        const currentOffset = reset ? 0 : offset;
        const response: ListResponse<ConfigChangeHistory> = await historyApi.list({
          configType,
          resourceKey,
          changeType,
          changedBy,
          fromDate,
          toDate,
          limit,
          offset: currentOffset,
        });

        if (reset) {
          setHistory(response.data);
          setOffset(0);
        } else {
          setHistory((prev) => [...prev, ...response.data]);
        }
        setTotal(response.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load config history');
      } finally {
        setLoading(false);
      }
    },
    [configType, resourceKey, changeType, changedBy, fromDate, toDate, limit, offset, enabled]
  );

  const loadMore = useCallback(async () => {
    if (loading || history.length >= total) return;
    setOffset((prev) => prev + limit);
  }, [loading, history.length, total, limit]);

  // Fetch when offset changes
  useEffect(() => {
    if (offset > 0) {
      fetchHistory(false);
    }
  }, [offset]);

  // Initial fetch and refetch on filter change
  useEffect(() => {
    setOffset(0);
    fetchHistory(true);
  }, [configType, resourceKey, changeType, changedBy, fromDate, toDate, enabled]);

  return {
    history,
    total,
    loading,
    error,
    refetch: () => fetchHistory(true),
    loadMore,
    hasMore: history.length < total,
  };
}

interface UseConfigHistoryEntryOptions {
  enabled?: boolean;
}

interface UseConfigHistoryEntryReturn {
  entry: ConfigChangeHistory | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get a single config history entry
 */
export function useConfigHistoryEntry(
  id: string | null,
  options: UseConfigHistoryEntryOptions = {}
): UseConfigHistoryEntryReturn {
  const { enabled = true } = options;
  const [entry, setEntry] = useState<ConfigChangeHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntry = useCallback(async () => {
    if (!enabled || !id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await historyApi.get(id);
      setEntry(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history entry');
    } finally {
      setLoading(false);
    }
  }, [id, enabled]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  return {
    entry,
    loading,
    error,
    refetch: fetchEntry,
  };
}

interface MutationState {
  loading: boolean;
  error: string | null;
}

interface UseConfigHistoryMutationsReturn {
  rollback: (id: string, reason?: string) => Promise<boolean>;
  rollbackState: MutationState;
}

/**
 * Hook for config history mutations (rollback)
 */
export function useConfigHistoryMutations(): UseConfigHistoryMutationsReturn {
  const [rollbackState, setRollbackState] = useState<MutationState>({
    loading: false,
    error: null,
  });

  const rollback = useCallback(async (id: string, reason?: string): Promise<boolean> => {
    try {
      setRollbackState({ loading: true, error: null });
      const result = await historyApi.rollback(id, reason);
      setRollbackState({ loading: false, error: null });
      return result.success;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to rollback configuration';
      setRollbackState({ loading: false, error });
      return false;
    }
  }, []);

  return {
    rollback,
    rollbackState,
  };
}

/**
 * Hook to get grouped history by date
 */
export function useGroupedConfigHistory(
  options: UseConfigHistoryListOptions = {}
): {
  groupedHistory: Map<string, ConfigChangeHistory[]>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { history, loading, error, refetch } = useConfigHistoryList(options);

  const groupedHistory = history.reduce((groups, entry) => {
    const date = new Date(entry.changedAt).toLocaleDateString();
    const existing = groups.get(date) || [];
    groups.set(date, [...existing, entry]);
    return groups;
  }, new Map<string, ConfigChangeHistory[]>());

  return {
    groupedHistory,
    loading,
    error,
    refetch,
  };
}
