/**
 * useGridKeyboard - Comprehensive keyboard navigation for the grid
 *
 * Keyboard Shortcuts:
 * - Arrow Up/Down: Navigate rows
 * - Arrow Left/Right: Navigate cells (when editing)
 * - Home/End: Jump to first/last row
 * - Page Up/Down: Navigate by page
 * - Enter: Open row detail / Edit cell
 * - Space: Toggle row selection
 * - Ctrl+A: Select all rows
 * - Escape: Cancel selection / Exit edit mode
 * - Tab: Move to next focusable element
 */

import { useCallback, useEffect, RefObject } from 'react';
import type { Table } from '@tanstack/react-table';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { GridRowData } from '../types';

interface UseGridKeyboardOptions<TData extends GridRowData> {
  containerRef: RefObject<HTMLElement>;
  table: Table<TData>;
  focusedRowIndex: number;
  setFocusedRowIndex: (index: number) => void;
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  rowVirtualizer?: Virtualizer<HTMLDivElement, Element>;
  totalRows?: number;
}

interface UseGridKeyboardReturn {
  focusedRowIndex: number;
  navigateToRow: (newIndex: number) => void;
}

export function useGridKeyboard<TData extends GridRowData>({
  containerRef,
  table,
  focusedRowIndex,
  setFocusedRowIndex,
  onRowClick,
  onRowDoubleClick,
  rowVirtualizer,
  totalRows,
}: UseGridKeyboardOptions<TData>): UseGridKeyboardReturn {
  const { rows } = table.getRowModel();
  const rowCount = totalRows ?? rows.length;

  // Navigate to row and scroll into view
  const navigateToRow = useCallback(
    (newIndex: number) => {
      const clampedIndex = Math.max(0, Math.min(newIndex, rowCount - 1));
      setFocusedRowIndex(clampedIndex);
      rowVirtualizer?.scrollToIndex(clampedIndex, { align: 'auto' });
    },
    [rowCount, setFocusedRowIndex, rowVirtualizer]
  );

  // Handle key down
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle if grid is focused
      if (!containerRef.current?.contains(document.activeElement)) return;

      // Ignore if in input/textarea
      const tagName = (e.target as HTMLElement).tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (focusedRowIndex === -1) {
            navigateToRow(0);
          } else {
            navigateToRow(focusedRowIndex + 1);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (focusedRowIndex === -1) {
            navigateToRow(rowCount - 1);
          } else {
            navigateToRow(focusedRowIndex - 1);
          }
          break;

        case 'Home':
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+Home - go to first row
            navigateToRow(0);
          }
          break;

        case 'End':
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+End - go to last row
            navigateToRow(rowCount - 1);
          }
          break;

        case 'PageDown':
          e.preventDefault();
          navigateToRow(focusedRowIndex + 10);
          break;

        case 'PageUp':
          e.preventDefault();
          navigateToRow(focusedRowIndex - 10);
          break;

        case 'Enter':
          e.preventDefault();
          if (focusedRowIndex >= 0 && rows[focusedRowIndex]) {
            const row = rows[focusedRowIndex].original;
            if (e.ctrlKey || e.metaKey) {
              onRowDoubleClick?.(row);
            } else {
              onRowClick?.(row);
            }
          }
          break;

        case ' ':
          e.preventDefault();
          if (focusedRowIndex >= 0 && rows[focusedRowIndex]) {
            const row = rows[focusedRowIndex];
            row.toggleSelected(!row.getIsSelected());
          }
          break;

        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            table.toggleAllRowsSelected(true);
          }
          break;

        case 'Escape':
          e.preventDefault();
          table.toggleAllRowsSelected(false);
          setFocusedRowIndex(-1);
          break;
      }
    },
    [
      containerRef,
      focusedRowIndex,
      navigateToRow,
      rows,
      rowCount,
      table,
      onRowClick,
      onRowDoubleClick,
      setFocusedRowIndex,
    ]
  );

  // Attach event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, handleKeyDown]);

  // Focus management
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Make container focusable
    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '0');
    }
  }, [containerRef]);

  return {
    focusedRowIndex,
    navigateToRow,
  };
}
