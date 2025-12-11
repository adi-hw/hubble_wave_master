import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterGroup, FilterRule, FilterNode, isFilterGroup, generateFilterId } from './types';

const FILTER_PARAM = 'filter';
const SORT_PARAM = 'sort';
const SORT_DIR_PARAM = 'dir';
const SEARCH_PARAM = 'q';
const SEARCH_COL_PARAM = 'qcol';
const PAGE_PARAM = 'page';
const PAGE_SIZE_PARAM = 'size';

/**
 * Serialize a FilterGroup to a compact URL-safe string
 * Format: field:op:value|field:op:value (for simple filters)
 * For groups: (field:op:value&field:op:value) or (field:op:value|field:op:value)
 * & = AND, | = OR
 */
const serializeFilterNode = (node: FilterNode): string => {
  if (isFilterGroup(node)) {
    if (node.children.length === 0) return '';
    const separator = node.logic === 'AND' ? '&' : '|';
    const parts = node.children.map(serializeFilterNode).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return `(${parts.join(separator)})`;
  } else {
    // Encode the rule: field:operator:value[:value2]
    const parts = [
      encodeURIComponent(node.field),
      encodeURIComponent(node.operator),
      encodeURIComponent(node.value || ''),
    ];
    if (node.value2 !== undefined && node.value2 !== '') {
      parts.push(encodeURIComponent(node.value2));
    }
    return parts.join(':');
  }
};

/**
 * Deserialize a URL string back to a FilterGroup
 */
const deserializeFilterString = (str: string): FilterGroup => {
  const root: FilterGroup = {
    id: 'root',
    type: 'group',
    logic: 'AND',
    children: [],
  };

  if (!str || str.trim() === '') return root;

  try {
    const parseNode = (input: string): FilterNode | null => {
      input = input.trim();
      if (!input) return null;

      // Check if it's a group (starts with parenthesis)
      if (input.startsWith('(') && input.endsWith(')')) {
        const inner = input.slice(1, -1);
        // Determine logic by finding top-level separator
        let depth = 0;
        let andPositions: number[] = [];
        let orPositions: number[] = [];

        for (let i = 0; i < inner.length; i++) {
          if (inner[i] === '(') depth++;
          else if (inner[i] === ')') depth--;
          else if (depth === 0) {
            if (inner[i] === '&') andPositions.push(i);
            else if (inner[i] === '|') orPositions.push(i);
          }
        }

        // Prefer AND if both are present at top level
        const isAnd = andPositions.length > 0;
        const positions = isAnd ? andPositions : orPositions;

        if (positions.length === 0) {
          // No separator found, try parsing as single rule
          const rule = parseRule(inner);
          if (rule) return rule;
          return null;
        }

        // Split by separator positions
        const parts: string[] = [];
        let lastPos = 0;
        for (const pos of positions) {
          parts.push(inner.slice(lastPos, pos));
          lastPos = pos + 1;
        }
        parts.push(inner.slice(lastPos));

        const children = parts.map(parseNode).filter((n): n is FilterNode => n !== null);

        return {
          id: generateFilterId(),
          type: 'group',
          logic: isAnd ? 'AND' : 'OR',
          children,
        };
      }

      // Try to parse as a rule
      return parseRule(input);
    };

    const parseRule = (input: string): FilterRule | null => {
      // Split by : but respect encoded colons
      const parts = input.split(':').map(decodeURIComponent);
      if (parts.length < 2) return null;

      const [field, operator, value = '', value2] = parts;
      if (!field || !operator) return null;

      return {
        id: generateFilterId(),
        field,
        operator,
        value,
        value2: value2 || undefined,
      };
    };

    // Check if the whole string is wrapped in parentheses (group)
    if (str.startsWith('(') && str.endsWith(')')) {
      const parsed = parseNode(str);
      if (parsed && isFilterGroup(parsed)) {
        return { ...parsed, id: 'root' };
      }
    }

    // Check for top-level AND/OR separators
    let depth = 0;
    let andPositions: number[] = [];
    let orPositions: number[] = [];

    for (let i = 0; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') depth--;
      else if (depth === 0) {
        if (str[i] === '&') andPositions.push(i);
        else if (str[i] === '|') orPositions.push(i);
      }
    }

    const isAnd = andPositions.length > 0 || orPositions.length === 0;
    const positions = isAnd ? andPositions : orPositions;

    if (positions.length === 0) {
      // Single rule
      const rule = parseRule(str);
      if (rule) {
        root.children = [rule];
      }
      return root;
    }

    // Split by separator
    const parts: string[] = [];
    let lastPos = 0;
    for (const pos of positions) {
      parts.push(str.slice(lastPos, pos));
      lastPos = pos + 1;
    }
    parts.push(str.slice(lastPos));

    root.logic = isAnd ? 'AND' : 'OR';
    root.children = parts.map(parseNode).filter((n): n is FilterNode => n !== null);

    return root;
  } catch (e) {
    console.error('Failed to parse filter string:', e);
    return root;
  }
};

interface UseFilterUrlOptions {
  /** Whether to sync filters with URL (default: true) */
  enabled?: boolean;
  /** Debounce delay in ms before updating URL (default: 300) */
  debounceMs?: number;
}

interface FilterUrlState {
  filterGroup: FilterGroup;
  search: string;
  searchColumn: string | null;
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

interface UseFilterUrlReturn {
  /** Initial state from URL */
  initialState: FilterUrlState;
  /** Update URL with current filter state */
  updateUrl: (state: Partial<FilterUrlState>) => void;
  /** Get a shareable URL with current filters */
  getShareableUrl: (state: FilterUrlState) => string;
  /** Copy shareable URL to clipboard */
  copyShareableUrl: (state: FilterUrlState) => Promise<boolean>;
}

/**
 * Hook to sync table filter state with URL parameters
 * Enables sharing filtered views via URL
 */
export const useFilterUrl = (options: UseFilterUrlOptions = {}): UseFilterUrlReturn => {
  const { enabled = true, debounceMs = 300 } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Parse initial state from URL
  const getInitialState = useCallback((): FilterUrlState => {
    const filterStr = searchParams.get(FILTER_PARAM) || '';
    const searchStr = searchParams.get(SEARCH_PARAM) || '';
    const searchCol = searchParams.get(SEARCH_COL_PARAM) || null;
    const sortBy = searchParams.get(SORT_PARAM) || null;
    const sortDir = (searchParams.get(SORT_DIR_PARAM) as 'asc' | 'desc') || 'asc';
    const page = parseInt(searchParams.get(PAGE_PARAM) || '1', 10) || 1;
    const pageSize = parseInt(searchParams.get(PAGE_SIZE_PARAM) || '10', 10) || 10;

    return {
      filterGroup: deserializeFilterString(filterStr),
      search: searchStr,
      searchColumn: searchCol,
      sortBy,
      sortDir,
      page,
      pageSize,
    };
  }, [searchParams]);

  // Update URL with debounce
  const updateUrl = useCallback(
    (state: Partial<FilterUrlState>) => {
      if (!enabled) return;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setSearchParams((prev) => {
          const newParams = new URLSearchParams(prev);

          // Update filter
          if (state.filterGroup !== undefined) {
            const filterStr = serializeFilterNode(state.filterGroup);
            if (filterStr) {
              newParams.set(FILTER_PARAM, filterStr);
            } else {
              newParams.delete(FILTER_PARAM);
            }
          }

          // Update search
          if (state.search !== undefined) {
            if (state.search) {
              newParams.set(SEARCH_PARAM, state.search);
            } else {
              newParams.delete(SEARCH_PARAM);
            }
          }

          // Update search column
          if (state.searchColumn !== undefined) {
            if (state.searchColumn) {
              newParams.set(SEARCH_COL_PARAM, state.searchColumn);
            } else {
              newParams.delete(SEARCH_COL_PARAM);
            }
          }

          // Update sort
          if (state.sortBy !== undefined) {
            if (state.sortBy) {
              newParams.set(SORT_PARAM, state.sortBy);
            } else {
              newParams.delete(SORT_PARAM);
            }
          }

          if (state.sortDir !== undefined) {
            if (state.sortDir !== 'asc') {
              newParams.set(SORT_DIR_PARAM, state.sortDir);
            } else {
              newParams.delete(SORT_DIR_PARAM);
            }
          }

          // Update pagination
          if (state.page !== undefined) {
            if (state.page > 1) {
              newParams.set(PAGE_PARAM, String(state.page));
            } else {
              newParams.delete(PAGE_PARAM);
            }
          }

          if (state.pageSize !== undefined) {
            if (state.pageSize !== 10) {
              newParams.set(PAGE_SIZE_PARAM, String(state.pageSize));
            } else {
              newParams.delete(PAGE_SIZE_PARAM);
            }
          }

          return newParams;
        }, { replace: true });
      }, debounceMs);
    },
    [enabled, debounceMs, setSearchParams]
  );

  // Generate shareable URL
  const getShareableUrl = useCallback((state: FilterUrlState): string => {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Clear existing filter params
    params.delete(FILTER_PARAM);
    params.delete(SEARCH_PARAM);
    params.delete(SEARCH_COL_PARAM);
    params.delete(SORT_PARAM);
    params.delete(SORT_DIR_PARAM);
    params.delete(PAGE_PARAM);
    params.delete(PAGE_SIZE_PARAM);

    // Add current state
    const filterStr = serializeFilterNode(state.filterGroup);
    if (filterStr) params.set(FILTER_PARAM, filterStr);
    if (state.search) params.set(SEARCH_PARAM, state.search);
    if (state.searchColumn) params.set(SEARCH_COL_PARAM, state.searchColumn);
    if (state.sortBy) params.set(SORT_PARAM, state.sortBy);
    if (state.sortDir !== 'asc') params.set(SORT_DIR_PARAM, state.sortDir);
    if (state.page > 1) params.set(PAGE_PARAM, String(state.page));
    if (state.pageSize !== 10) params.set(PAGE_SIZE_PARAM, String(state.pageSize));

    return url.toString();
  }, []);

  // Copy to clipboard
  const copyShareableUrl = useCallback(async (state: FilterUrlState): Promise<boolean> => {
    try {
      const url = getShareableUrl(state);
      await navigator.clipboard.writeText(url);
      return true;
    } catch (e) {
      console.error('Failed to copy URL:', e);
      return false;
    }
  }, [getShareableUrl]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    initialState: getInitialState(),
    updateUrl,
    getShareableUrl,
    copyShareableUrl,
  };
};

// Export serialization functions for testing/reuse
export { serializeFilterNode, deserializeFilterString };
