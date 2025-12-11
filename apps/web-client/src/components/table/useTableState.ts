import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterRule, FilterGroup, FilterNode, isFilterGroup, TableColumn } from './types';

export const useTableState = (initialColumns: TableColumn[]) => {
  const [columns, setColumns] = useState<TableColumn[]>(initialColumns);
  const [search, setSearch] = useState('');
  const [searchColumn, setSearchColumn] = useState<string | null>(null); // null = search all columns
  // Store the full nested filter structure
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({
    id: 'root',
    type: 'group',
    logic: 'AND',
    children: [],
  });
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const applyAll = useCallback(
    (rows: any[]) => {
      const visibleCols = columns.filter((c) => !c.hidden).map((c) => c.code);
      const normalize = (val: any) =>
        val === null || val === undefined ? '' : String(val).toLowerCase();

      // Helper for date comparisons
      const parseDate = (value: any): Date | null => {
        if (!value) return null;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      };

      const getStartOfDay = (date: Date): Date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const getEndOfDay = (date: Date): Date => {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
      };

      const today = getStartOfDay(new Date());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const getStartOfWeek = (date: Date): Date => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const getStartOfMonth = (date: Date): Date => {
        const d = new Date(date);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const matchesRule = (row: any, rule: FilterRule): boolean => {
        if (!rule.field) return true;
        const raw = row.attributes?.[rule.field] ?? row[rule.field];
        const val = normalize(raw);
        const target = normalize(rule.value);

        switch (rule.operator) {
          // Text operators
          case 'equals':
            return val === target;
          case 'not_equals':
            return val !== target;
          case 'contains':
            return val.includes(target);
          case 'not_contains':
            return !val.includes(target);
          case 'starts_with':
            return val.startsWith(target);
          case 'ends_with':
            return val.endsWith(target);

          // Number operators
          case 'greater_than':
            return parseFloat(val) > parseFloat(target);
          case 'less_than':
            return parseFloat(val) < parseFloat(target);
          case 'greater_or_equal':
            return parseFloat(val) >= parseFloat(target);
          case 'less_or_equal':
            return parseFloat(val) <= parseFloat(target);

          // Common operators
          case 'is_empty':
            return !val || val.trim() === '';
          case 'is_not_empty':
            return Boolean(val && val.trim() !== '');

          // Boolean operators
          case 'is_true':
            return val === 'true' || val === '1' || val === 'yes';
          case 'is_false':
            return val === 'false' || val === '0' || val === 'no' || val === '';

          // Date operators
          case 'before': {
            const rowDate = parseDate(raw);
            const targetDate = parseDate(rule.value);
            if (!rowDate || !targetDate) return false;
            return rowDate < targetDate;
          }
          case 'after': {
            const rowDate = parseDate(raw);
            const targetDate = parseDate(rule.value);
            if (!rowDate || !targetDate) return false;
            return rowDate > targetDate;
          }
          case 'on_or_before': {
            const rowDate = parseDate(raw);
            const targetDate = parseDate(rule.value);
            if (!rowDate || !targetDate) return false;
            return rowDate <= getEndOfDay(targetDate);
          }
          case 'on_or_after': {
            const rowDate = parseDate(raw);
            const targetDate = parseDate(rule.value);
            if (!rowDate || !targetDate) return false;
            return rowDate >= getStartOfDay(targetDate);
          }
          case 'today': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const rowDay = getStartOfDay(rowDate);
            return rowDay.getTime() === today.getTime();
          }
          case 'yesterday': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const rowDay = getStartOfDay(rowDate);
            return rowDay.getTime() === yesterday.getTime();
          }
          case 'this_week': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const startOfWeek = getStartOfWeek(today);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            return rowDate >= startOfWeek && rowDate <= endOfWeek;
          }
          case 'last_week': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const startOfThisWeek = getStartOfWeek(today);
            const startOfLastWeek = new Date(startOfThisWeek);
            startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
            const endOfLastWeek = new Date(startOfThisWeek);
            endOfLastWeek.setMilliseconds(-1);
            return rowDate >= startOfLastWeek && rowDate <= endOfLastWeek;
          }
          case 'this_month': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const startOfMonth = getStartOfMonth(today);
            const endOfMonth = new Date(startOfMonth);
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);
            endOfMonth.setMilliseconds(-1);
            return rowDate >= startOfMonth && rowDate <= endOfMonth;
          }
          case 'last_month': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const startOfThisMonth = getStartOfMonth(today);
            const startOfLastMonth = new Date(startOfThisMonth);
            startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);
            const endOfLastMonth = new Date(startOfThisMonth);
            endOfLastMonth.setMilliseconds(-1);
            return rowDate >= startOfLastMonth && rowDate <= endOfLastMonth;
          }
          case 'last_7_days': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return rowDate >= sevenDaysAgo && rowDate <= new Date();
          }
          case 'last_30_days': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return rowDate >= thirtyDaysAgo && rowDate <= new Date();
          }
          case 'last_90_days': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const ninetyDaysAgo = new Date(today);
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            return rowDate >= ninetyDaysAgo && rowDate <= new Date();
          }
          case 'tomorrow': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const rowDay = getStartOfDay(rowDate);
            return rowDay.getTime() === tomorrow.getTime();
          }
          case 'next_week': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const startOfThisWeek = getStartOfWeek(today);
            const startOfNextWeek = new Date(startOfThisWeek);
            startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);
            const endOfNextWeek = new Date(startOfNextWeek);
            endOfNextWeek.setDate(endOfNextWeek.getDate() + 6);
            endOfNextWeek.setHours(23, 59, 59, 999);
            return rowDate >= startOfNextWeek && rowDate <= endOfNextWeek;
          }
          case 'next_month': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const startOfThisMonth = getStartOfMonth(today);
            const startOfNextMonth = new Date(startOfThisMonth);
            startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1);
            const endOfNextMonth = new Date(startOfNextMonth);
            endOfNextMonth.setMonth(endOfNextMonth.getMonth() + 1);
            endOfNextMonth.setMilliseconds(-1);
            return rowDate >= startOfNextMonth && rowDate <= endOfNextMonth;
          }
          case 'this_year': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
            return rowDate >= startOfYear && rowDate <= endOfYear;
          }
          case 'last_year': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
            const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
            return rowDate >= startOfLastYear && rowDate <= endOfLastYear;
          }
          case 'next_7_days': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const now = new Date();
            const sevenDaysFromNow = new Date(today);
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
            sevenDaysFromNow.setHours(23, 59, 59, 999);
            return rowDate >= now && rowDate <= sevenDaysFromNow;
          }
          case 'next_30_days': {
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const now = new Date();
            const thirtyDaysFromNow = new Date(today);
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            thirtyDaysFromNow.setHours(23, 59, 59, 999);
            return rowDate >= now && rowDate <= thirtyDaysFromNow;
          }
          case 'between': {
            const rowDate = parseDate(raw);
            const startDate = parseDate(rule.value);
            const endDate = parseDate(rule.value2);
            if (!rowDate || !startDate || !endDate) return false;
            return rowDate >= getStartOfDay(startDate) && rowDate <= getEndOfDay(endDate);
          }
          case 'relative_past': {
            // Value stored as "N:unit" e.g., "7:days", "2:weeks", "1:months"
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const [numStr, unit] = String(rule.value).split(':');
            const num = parseInt(numStr, 10);
            if (isNaN(num)) return false;

            const pastDate = new Date();
            switch (unit) {
              case 'weeks':
                pastDate.setDate(pastDate.getDate() - num * 7);
                break;
              case 'months':
                pastDate.setMonth(pastDate.getMonth() - num);
                break;
              case 'days':
              default:
                pastDate.setDate(pastDate.getDate() - num);
                break;
            }
            return rowDate >= pastDate && rowDate <= new Date();
          }
          case 'relative_future': {
            // Value stored as "N:unit" e.g., "7:days", "2:weeks", "1:months"
            const rowDate = parseDate(raw);
            if (!rowDate) return false;
            const [numStr, unit] = String(rule.value).split(':');
            const num = parseInt(numStr, 10);
            if (isNaN(num)) return false;

            const now = new Date();
            const futureDate = new Date();
            switch (unit) {
              case 'weeks':
                futureDate.setDate(futureDate.getDate() + num * 7);
                break;
              case 'months':
                futureDate.setMonth(futureDate.getMonth() + num);
                break;
              case 'days':
              default:
                futureDate.setDate(futureDate.getDate() + num);
                break;
            }
            return rowDate >= now && rowDate <= futureDate;
          }

          default:
            return val.includes(target);
        }
      };

      // Recursively evaluate filter nodes (rules and groups)
      const matchesNode = (row: any, node: FilterNode): boolean => {
        if (isFilterGroup(node)) {
          // It's a group - apply logic to children
          if (node.children.length === 0) return true;
          if (node.logic === 'AND') {
            return node.children.every(child => matchesNode(row, child));
          } else {
            return node.children.some(child => matchesNode(row, child));
          }
        } else {
          // It's a rule
          return matchesRule(row, node);
        }
      };

      let filtered = rows.filter((row) => {
        // Search across columns (all visible or specific column)
        if (search.trim()) {
          const s = search.toLowerCase();
          let match: boolean;

          if (searchColumn) {
            // Search in specific column only
            match = normalize(row.attributes?.[searchColumn] ?? row[searchColumn]).includes(s);
          } else {
            // Search across all visible columns
            match = visibleCols.some((code) =>
              normalize(row.attributes?.[code] ?? row[code]).includes(s)
            );
          }

          if (!match) return false;
        }

        // Apply nested filter logic
        return matchesNode(row, filterGroup);
      });

      if (sortBy) {
        const get = (row: any) => {
          const raw = row.attributes?.[sortBy] ?? row[sortBy];
          if (raw === null || raw === undefined) return '';
          if (typeof raw === 'number') return raw;
          if (typeof raw === 'string') return raw.toLowerCase();
          if (Array.isArray(raw)) return raw.join(', ').toLowerCase();
          return String(raw).toLowerCase();
        };
        filtered = [...filtered].sort((a, b) => {
          const va = get(a);
          const vb = get(b);
          if (va < vb) return sortDir === 'asc' ? -1 : 1;
          if (va > vb) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }

      return filtered;
    },
    [columns, filterGroup, search, searchColumn, sortBy, sortDir]
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => !c.hidden),
    [columns]
  );

  return {
    columns,
    setColumns,
    visibleColumns,
    search,
    setSearch,
    searchColumn,
    setSearchColumn,
    filterGroup,
    setFilterGroup,
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
    applyAll,
  };
};
