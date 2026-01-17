/**
 * useGridGrouping - React hook for server-side grouped data management
 *
 * Provides:
 * - Fetching of grouped data with SQL GROUP BY on the server
 * - Lazy loading of group children on expansion
 * - Pagination within expanded groups
 * - Cache management for expanded groups
 */

import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GridRowData,
  GroupedRow,
  GroupedQueryResult,
  GroupChildrenResult,
  GroupExpansionState,
  GroupableRow,
  SortingState,
  ColumnFiltersState,
} from '../types';

interface UseGridGroupingOptions {
  collection: string;
  groupBy: string | null; // null = no grouping active
  enabled?: boolean;
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
  globalFilter?: string;
  childrenPageSize?: number;
  /** Optional function to get auth token for API requests */
  getAuthToken?: () => string | null;
}

interface UseGridGroupingReturn<TData extends GridRowData> {
  /** Is grouping mode active? */
  isGrouped: boolean;
  /** Flattened rows for display (groups + visible children) */
  flattenedRows: GroupableRow<TData>[];
  /** Total number of rows for virtualization */
  totalRowCount: number;
  /** Loading state for initial groups fetch */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error details */
  error: Error | null;
  /** Group expansion state */
  expansionState: GroupExpansionState;
  /** Toggle group expansion */
  toggleGroup: (groupId: string) => void;
  /** Load more children in a group */
  loadMoreChildren: (groupId: string) => void;
  /** Is a specific group loading? */
  isGroupLoading: (groupId: string) => boolean;
  /** Refetch all data */
  refetch: () => void;
  /** Group headers */
  groups: GroupedRow[];
  /** Total records across all groups */
  totalRecords: number;
}

/**
 * Fetch grouped data from server
 */
async function fetchGroupedData(params: {
  collection: string;
  groupBy: string;
  sorting?: SortingState;
  filters?: ColumnFiltersState;
  globalFilter?: string;
  getAuthToken?: () => string | null;
}): Promise<GroupedQueryResult> {
  const queryParams = new URLSearchParams();
  queryParams.set('groupBy', params.groupBy);

  // Apply sorting
  if (params.sorting && params.sorting.length > 0) {
    const sortStr = params.sorting
      .map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`)
      .join(',');
    queryParams.set('sort', sortStr);
  }

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

  const url = `/api/data/collections/${params.collection}/data/grouped?${queryParams.toString()}`;

  // Build headers with optional auth token
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const token = params.getAuthToken?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Grouped query failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch children for a specific group
 */
async function fetchGroupChildren<TData extends GridRowData>(params: {
  collection: string;
  groupBy: string;
  groupValue: unknown;
  page?: number;
  pageSize?: number;
  sorting?: SortingState;
  filters?: ColumnFiltersState;
  globalFilter?: string;
  getAuthToken?: () => string | null;
}): Promise<GroupChildrenResult<TData>> {
  const queryParams = new URLSearchParams();
  queryParams.set('groupBy', params.groupBy);

  // Handle null/undefined group values specially
  if (params.groupValue === null || params.groupValue === undefined) {
    queryParams.set('groupValue', 'null');
  } else if (typeof params.groupValue === 'object') {
    queryParams.set('groupValue', JSON.stringify(params.groupValue));
  } else {
    queryParams.set('groupValue', String(params.groupValue));
  }

  if (params.page) {
    queryParams.set('page', String(params.page));
  }
  if (params.pageSize) {
    queryParams.set('pageSize', String(params.pageSize));
  }

  // Apply sorting
  if (params.sorting && params.sorting.length > 0) {
    const sortStr = params.sorting
      .map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`)
      .join(',');
    queryParams.set('sort', sortStr);
  }

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

  const url = `/api/data/collections/${params.collection}/data/group-children?${queryParams.toString()}`;

  // Build headers with optional auth token
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const token = params.getAuthToken?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Group children query failed: ${response.statusText}`);
  }

  return response.json();
}

export function useGridGrouping<TData extends GridRowData = GridRowData>({
  collection,
  groupBy,
  enabled = true,
  sorting,
  columnFilters,
  globalFilter,
  childrenPageSize = 50,
  getAuthToken,
}: UseGridGroupingOptions): UseGridGroupingReturn<TData> {
  const queryClient = useQueryClient();
  const [expansionState, setExpansionState] = useState<GroupExpansionState>({});

  // Track groups that are currently loading children
  const loadingGroupsRef = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState(0);

  const isGrouped = !!groupBy && enabled;

  // Keys for tracking changes
  const sortingKey = JSON.stringify(sorting);
  const filtersKey = JSON.stringify(columnFilters);
  const prevSortingKey = useRef(sortingKey);
  const prevFiltersKey = useRef(filtersKey);
  const prevGlobalFilter = useRef(globalFilter);
  // Use ref to track expansion state without causing re-renders in the effect
  const expansionStateRef = useRef(expansionState);
  expansionStateRef.current = expansionState;

  // Fetch grouped data
  const groupsQuery = useQuery({
    queryKey: ['grid-grouped', collection, groupBy, sorting, columnFilters, globalFilter],
    queryFn: () =>
      fetchGroupedData({
        collection,
        groupBy: groupBy!,
        sorting,
        filters: columnFilters,
        globalFilter,
        getAuthToken,
      }),
    enabled: isGrouped,
    staleTime: 30_000,
  });

  const groups = groupsQuery.data?.groups ?? [];
  const totalRecords = groupsQuery.data?.totalRecords ?? 0;

  // Store groups in a ref for use in effect without causing re-triggers
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  // Refetch children for expanded groups when sorting, filters, or globalFilter changes
  useEffect(() => {
    const sortingChanged = prevSortingKey.current !== sortingKey;
    const filtersChanged = prevFiltersKey.current !== filtersKey;
    const globalFilterChanged = prevGlobalFilter.current !== globalFilter;

    if (!sortingChanged && !filtersChanged && !globalFilterChanged) {
      return;
    }

    // Update refs immediately
    prevSortingKey.current = sortingKey;
    prevFiltersKey.current = filtersKey;
    prevGlobalFilter.current = globalFilter;

    // Get list of currently expanded group IDs from ref (not state, to avoid dependency loop)
    const currentExpansionState = expansionStateRef.current;
    const expandedGroupIds = Object.entries(currentExpansionState)
      .filter(([, state]) => state.isExpanded && state.children && state.children.length > 0)
      .map(([groupId]) => groupId);

    if (expandedGroupIds.length === 0) return;

    // Refetch children for all expanded groups in parallel
    // Keep showing old data until all new data is ready to minimize flicker
    const refetchChildren = async () => {
      const currentGroups = groupsRef.current;

      // Build list of groups to refetch
      const groupsToRefetch = expandedGroupIds
        .map((groupId) => {
          const group = currentGroups.find((g) => g.__groupId === groupId);
          return group ? { groupId, group } : null;
        })
        .filter((item): item is { groupId: string; group: GroupedRow } => item !== null);

      if (groupsToRefetch.length === 0) return;

      // Fetch all children in parallel
      const fetchPromises = groupsToRefetch.map(async ({ groupId, group }) => {
        try {
          const result = await fetchGroupChildren<TData>({
            collection,
            groupBy: groupBy!,
            groupValue: group.__groupValue,
            page: 1,
            pageSize: childrenPageSize,
            sorting,
            filters: columnFilters,
            globalFilter,
            getAuthToken,
          });
          return { groupId, result, error: null };
        } catch (error) {
          console.error('Failed to refetch group children:', error);
          return { groupId, result: null, error };
        }
      });

      // Wait for all fetches to complete
      const results = await Promise.all(fetchPromises);

      // Update all states in a single batch
      setExpansionState((prev) => {
        const updated = { ...prev };
        for (const { groupId, result } of results) {
          if (result) {
            updated[groupId] = {
              isExpanded: true,
              children: result.data,
              totalChildren: result.meta.total,
              loadedPage: result.meta.page,
              hasMore: result.meta.hasNext,
              isLoading: false,
            };
          } else {
            // Keep existing children on error, just clear loading state
            updated[groupId] = {
              ...updated[groupId],
              isLoading: false,
            };
          }
        }
        return updated;
      });
    };

    refetchChildren();
  }, [sortingKey, filtersKey, globalFilter, collection, groupBy, childrenPageSize, sorting, columnFilters, getAuthToken]);

  // Toggle group expansion
  const toggleGroup = useCallback(
    async (groupId: string) => {
      const currentState = expansionState[groupId];
      const isCurrentlyExpanded = currentState?.isExpanded ?? false;

      if (isCurrentlyExpanded) {
        // Collapse - just toggle the flag
        setExpansionState((prev) => ({
          ...prev,
          [groupId]: {
            ...prev[groupId],
            isExpanded: false,
          },
        }));
      } else {
        // Expand - load children if not already loaded
        const group = groups.find((g) => g.__groupId === groupId);
        if (!group) return;

        if (currentState?.children?.length) {
          // Children already loaded, just expand
          setExpansionState((prev) => ({
            ...prev,
            [groupId]: {
              ...prev[groupId],
              isExpanded: true,
            },
          }));
        } else {
          // Need to fetch children
          loadingGroupsRef.current.add(groupId);
          setExpansionState((prev) => ({
            ...prev,
            [groupId]: {
              isExpanded: true,
              children: [],
              totalChildren: group.__childCount,
              loadedPage: 0,
              hasMore: true,
              isLoading: true,
            },
          }));
          forceUpdate((n) => n + 1);

          try {
            const result = await fetchGroupChildren<TData>({
              collection,
              groupBy: groupBy!,
              groupValue: group.__groupValue,
              page: 1,
              pageSize: childrenPageSize,
              sorting,
              filters: columnFilters,
              globalFilter,
              getAuthToken,
            });

            setExpansionState((prev) => ({
              ...prev,
              [groupId]: {
                isExpanded: true,
                children: result.data,
                totalChildren: result.meta.total,
                loadedPage: result.meta.page,
                hasMore: result.meta.hasNext,
                isLoading: false,
              },
            }));
          } catch (error) {
            console.error('Failed to load group children:', error);
            setExpansionState((prev) => ({
              ...prev,
              [groupId]: {
                ...prev[groupId],
                isLoading: false,
              },
            }));
          } finally {
            loadingGroupsRef.current.delete(groupId);
            forceUpdate((n) => n + 1);
          }
        }
      }
    },
    [expansionState, groups, collection, groupBy, childrenPageSize, sorting, columnFilters, globalFilter, getAuthToken]
  );

  // Load more children for a group
  const loadMoreChildren = useCallback(
    async (groupId: string) => {
      const currentState = expansionState[groupId];
      if (!currentState?.isExpanded || !currentState.hasMore || currentState.isLoading) {
        return;
      }

      const group = groups.find((g) => g.__groupId === groupId);
      if (!group) return;

      loadingGroupsRef.current.add(groupId);
      setExpansionState((prev) => ({
        ...prev,
        [groupId]: {
          ...prev[groupId],
          isLoading: true,
        },
      }));
      forceUpdate((n) => n + 1);

      try {
        const nextPage = currentState.loadedPage + 1;
        const result = await fetchGroupChildren<TData>({
          collection,
          groupBy: groupBy!,
          groupValue: group.__groupValue,
          page: nextPage,
          pageSize: childrenPageSize,
          sorting,
          filters: columnFilters,
          globalFilter,
          getAuthToken,
        });

        setExpansionState((prev) => ({
          ...prev,
          [groupId]: {
            isExpanded: true,
            children: [...prev[groupId].children, ...result.data],
            totalChildren: result.meta.total,
            loadedPage: result.meta.page,
            hasMore: result.meta.hasNext,
            isLoading: false,
          },
        }));
      } catch (error) {
        console.error('Failed to load more children:', error);
        setExpansionState((prev) => ({
          ...prev,
          [groupId]: {
            ...prev[groupId],
            isLoading: false,
          },
        }));
      } finally {
        loadingGroupsRef.current.delete(groupId);
        forceUpdate((n) => n + 1);
      }
    },
    [expansionState, groups, collection, groupBy, childrenPageSize, sorting, columnFilters, globalFilter, getAuthToken]
  );

  // Check if a group is loading
  const isGroupLoading = useCallback(
    (groupId: string) => {
      return loadingGroupsRef.current.has(groupId) || expansionState[groupId]?.isLoading === true;
    },
    [expansionState]
  );

  // Build flattened rows for display
  const flattenedRows = useMemo((): GroupableRow<TData>[] => {
    if (!isGrouped || !groups.length) {
      return [];
    }

    const rows: GroupableRow<TData>[] = [];

    for (const group of groups) {
      // Add group header
      rows.push(group);

      // Add expanded children
      const state = expansionState[group.__groupId];
      if (state?.isExpanded && state.children) {
        for (const child of state.children as TData[]) {
          rows.push(child);
        }
        // Add "load more" indicator row if needed
        // This could be handled in the renderer instead
      }
    }

    return rows;
  }, [isGrouped, groups, expansionState]);

  // Calculate total row count for virtualization
  const totalRowCount = useMemo(() => {
    if (!isGrouped) return 0;

    let count = groups.length; // Group headers

    // Add expanded children counts
    for (const group of groups) {
      const state = expansionState[group.__groupId];
      if (state?.isExpanded) {
        count += state.children?.length ?? 0;
      }
    }

    return count;
  }, [isGrouped, groups, expansionState]);

  // Refetch everything
  const refetch = useCallback(() => {
    // Clear expansion state
    setExpansionState({});
    // Invalidate query
    queryClient.invalidateQueries({ queryKey: ['grid-grouped', collection] });
  }, [queryClient, collection]);

  return {
    isGrouped,
    flattenedRows,
    totalRowCount,
    isLoading: groupsQuery.isLoading,
    isError: groupsQuery.isError,
    error: groupsQuery.error as Error | null,
    expansionState,
    toggleGroup,
    loadMoreChildren,
    isGroupLoading,
    refetch,
    groups,
    totalRecords,
  };
}
