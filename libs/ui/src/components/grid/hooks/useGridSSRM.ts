/**
 * useGridSSRM - React hook for Server-Side Row Model data management
 *
 * Provides:
 * - Automatic block fetching on scroll
 * - LRU caching with configurable limits
 * - Cache invalidation on filter/sort changes
 * - Scroll velocity-based prefetching
 * - Integration with TanStack Query for background refresh
 */

import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GridDataManager, BlockFetcher } from '../ssrm/GridDataManager';
import type {
  GridRowData,
  UseGridSSRMReturn,
  BlockCacheEntry,
  SortingState,
  ColumnFiltersState,
  GroupingState,
  SSRMRequest,
  SSRMResponse,
} from '../types';

/** Count fetcher function type */
export type CountFetcher = (params: {
  collection: string;
  filters?: ColumnFiltersState;
  grouping?: GroupingState;
  globalFilter?: string;
}) => Promise<number>;

interface UseGridSSRMOptions {
  collection: string;
  enabled?: boolean;
  pageSize?: number;
  blockSize?: number;
  maxCacheBlocks?: number;
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
  grouping?: GroupingState;
  globalFilter?: string;
  fetcher?: BlockFetcher<GridRowData>;
  countFetcher?: CountFetcher;
}

/**
 * Build query string from SSRMRequest parameters
 */
function buildQueryString(request: SSRMRequest): string {
  const params = new URLSearchParams();

  // Pagination - convert block-based to page-based
  const page = Math.floor(request.startRow / (request.endRow - request.startRow)) + 1;
  const pageSize = request.endRow - request.startRow;
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  // Sorting
  if (request.sorting && request.sorting.length > 0) {
    const sortStr = request.sorting
      .map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`)
      .join(',');
    params.set('sort', sortStr);
  }

  // Filters
  if (request.filters && request.filters.length > 0) {
    const filterObj: Record<string, unknown> = {};
    request.filters.forEach((f) => {
      if (f.value !== undefined && f.value !== '') {
        filterObj[f.id] = f.value;
      }
    });
    if (Object.keys(filterObj).length > 0) {
      params.set('filters', JSON.stringify(filterObj));
    }
  }

  // Global search
  if (request.globalFilter) {
    params.set('search', request.globalFilter);
  }

  // Grouping
  if (request.grouping && request.grouping.length > 0) {
    params.set('groupBy', request.grouping.join(','));
  }

  return params.toString();
}

// Default API fetcher - uses collection data API
const defaultFetcher = async <TData extends GridRowData>(
  request: SSRMRequest
): Promise<SSRMResponse<TData>> => {
  const queryString = buildQueryString(request);
  const url = `/api/data/collections/${request.collection}/data?${queryString}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Grid query failed: ${response.statusText}`);
  }

  const result = await response.json();

  // Transform collection data API response to SSRM response format
  // lastRow: -1 means more rows available, otherwise it's the total row count
  const total = result.meta?.total ?? result.data?.length ?? 0;
  const hasMore = result.meta?.hasNext ?? false;

  return {
    rows: result.data as TData[],
    lastRow: hasMore ? -1 : total,
  };
};

// Default count fetcher - uses collection data API with minimal page size
const fetchCount = async (params: {
  collection: string;
  filters?: ColumnFiltersState;
  grouping?: GroupingState;
  globalFilter?: string;
}): Promise<number> => {
  const queryParams = new URLSearchParams();
  // Request minimal data, we just need the count
  queryParams.set('page', '1');
  queryParams.set('pageSize', '1');

  // Apply filters
  if (params.filters && params.filters.length > 0) {
    const filterObj: Record<string, unknown> = {};
    params.filters.forEach((f) => {
      if (f.value !== undefined && f.value !== '') {
        filterObj[f.id] = f.value;
      }
    });
    if (Object.keys(filterObj).length > 0) {
      queryParams.set('filters', JSON.stringify(filterObj));
    }
  }

  // Apply global search
  if (params.globalFilter) {
    queryParams.set('search', params.globalFilter);
  }

  // Apply grouping
  if (params.grouping && params.grouping.length > 0) {
    queryParams.set('groupBy', params.grouping.join(','));
  }

  const url = `/api/data/collections/${params.collection}/data?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Grid count failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.meta?.total ?? 0;
};

export function useGridSSRM<TData extends GridRowData = GridRowData>({
  collection,
  enabled = true,
  pageSize: _pageSize = 100,
  blockSize = 100,
  maxCacheBlocks = 100,
  sorting,
  columnFilters,
  grouping,
  globalFilter,
  fetcher,
  countFetcher,
}: UseGridSSRMOptions): UseGridSSRMReturn<TData> {
  void _pageSize;
  const queryClient = useQueryClient();
  const [loadedBlocksVersion, setLoadedBlocksVersion] = useState(0);
  // Use a counter ref to track concurrent fetches accurately
  const fetchingCountRef = useRef(0);
  const [isFetchingBlocks, setIsFetchingBlocks] = useState(false);
  const [blockError, setBlockError] = useState<Error | null>(null);

  // Helper to increment/decrement fetch counter and update state
  const incrementFetching = useCallback(() => {
    fetchingCountRef.current += 1;
    setIsFetchingBlocks(true);
  }, []);

  const decrementFetching = useCallback(() => {
    fetchingCountRef.current = Math.max(0, fetchingCountRef.current - 1);
    if (fetchingCountRef.current === 0) {
      setIsFetchingBlocks(false);
    }
  }, []);

  // Stable reference to data manager
  const dataManagerRef = useRef<GridDataManager<TData> | null>(null);

  // Initialize data manager
  useEffect(() => {
    if (!enabled) return;

    const actualFetcher = (fetcher ?? defaultFetcher) as BlockFetcher<TData>;

    dataManagerRef.current = new GridDataManager<TData>(
      {
        collection,
        blockSize,
        maxCacheBlocks,
        sorting,
        filters: columnFilters,
        grouping,
        globalFilter,
      },
      actualFetcher
    );

    return () => {
      dataManagerRef.current?.destroy();
      dataManagerRef.current = null;
    };
  }, [collection, blockSize, maxCacheBlocks, enabled, fetcher]);

  // Synchronously update config during render when dependencies change
  // This ensures the config is updated BEFORE any effects run
  const configVersionRef = useRef<string | null>(null);
  const currentConfigKey = JSON.stringify({ sorting, columnFilters, grouping, globalFilter });

  if (dataManagerRef.current && configVersionRef.current !== currentConfigKey) {
    dataManagerRef.current.updateConfig({
      sorting,
      filters: columnFilters,
      grouping,
      globalFilter,
    });
    configVersionRef.current = currentConfigKey;
  }

  // Trigger re-render when config changes (to update loadedBlocks)
  useEffect(() => {
    setLoadedBlocksVersion((v) => v + 1);
  }, [sorting, columnFilters, grouping, globalFilter]);

  // Use custom count fetcher or default
  const actualCountFetcher = countFetcher ?? fetchCount;

  // Fetch total count (separate query for efficiency)
  const countQuery = useQuery({
    queryKey: ['grid-count', collection, columnFilters, grouping, globalFilter],
    queryFn: () =>
      actualCountFetcher({
        collection,
        filters: columnFilters,
        grouping,
        globalFilter,
      }),
    enabled,
    staleTime: 30_000, // 30 seconds
  });

  // Get rows for visible range
  const getRows = useCallback(
    async (startRow: number, endRow: number): Promise<TData[]> => {
      if (!dataManagerRef.current) {
        return [];
      }
      incrementFetching();
      try {
        const rows = await dataManagerRef.current.getRows(startRow, endRow);
        setLoadedBlocksVersion((v) => v + 1);
        setBlockError(null);
        return rows;
      } catch (err) {
        setBlockError(err as Error);
        throw err;
      } finally {
        decrementFetching();
      }
    },
    [incrementFetching, decrementFetching]
  );

  // Update scroll position for velocity tracking
  const updateScrollPosition = useCallback((position: number) => {
    dataManagerRef.current?.updateScrollPosition(position);
  }, []);

  // Fetch specific block (for virtualization callback)
  const fetchBlock = useCallback(
    (blockIndex: number) => {
      if (!dataManagerRef.current) return;

      const startRow = blockIndex * blockSize;
      const endRow = (blockIndex + 1) * blockSize;

      // Fire and forget
      incrementFetching();
      dataManagerRef.current
        .getRows(startRow, endRow)
        .then(() => {
          setLoadedBlocksVersion((v) => v + 1);
          setBlockError(null);
        })
        .catch((err) => {
          setBlockError(err as Error);
          console.error(err);
        })
        .finally(() => decrementFetching());
    },
    [blockSize, incrementFetching, decrementFetching]
  );

  // Invalidate and refetch
  const refetch = useCallback(() => {
    dataManagerRef.current?.invalidateCache();
    queryClient.invalidateQueries({ queryKey: ['grid-count', collection] });
    setLoadedBlocksVersion((v) => v + 1);
  }, [queryClient, collection]);

  // Get loaded blocks map for UI indicators
  const loadedBlocks = useMemo(() => {
    // This dependency ensures we recalculate when blocks change
    void loadedBlocksVersion;
    return dataManagerRef.current?.getLoadedBlocks() ?? new Map<number, BlockCacheEntry<TData>>();
  }, [loadedBlocksVersion]);

  const estimatedRowCount =
    countQuery.data ??
    dataManagerRef.current?.lastKnownTotalRows ??
    0;

  return {
    data: [] as TData[], // Data is fetched on-demand, not stored here
    totalRowCount: estimatedRowCount,
    isLoading: countQuery.isLoading || isFetchingBlocks,
    isError: countQuery.isError || !!blockError,
    error: (countQuery.error as Error) ?? blockError,
    isFetchingBlocks,
    blockError,
    refetch,
    getRows,
    fetchBlock,
    updateScrollPosition,
    loadedBlocks,
    stats: dataManagerRef.current?.getStats(),
  };
}
