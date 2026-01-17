/**
 * useGridEditing - Hook for managing inline cell editing state
 *
 * Provides:
 * - Cell edit state management (which cell is being edited)
 * - Validation handling (sync and async)
 * - Navigation between editable cells
 * - Undo/redo support (future)
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type {
  GridRowData,
  GridColumn,
  CellEditState,
  CellEditEvent,
  CellValidationResult,
  OnCellEditComplete,
  OnCellEditCancel,
  OnCellEditStart,
  EditTrigger,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface UseGridEditingOptions<TData extends GridRowData> {
  /** Column definitions */
  columns: GridColumn<TData>[];
  /** Data rows */
  data: TData[];
  /** Enable inline editing (default: false) */
  enableEditing?: boolean;
  /** Edit trigger mode (default: 'doubleClick') */
  editTrigger?: EditTrigger;
  /** Callback when cell edit starts - return false to prevent editing */
  onCellEditStart?: OnCellEditStart<TData>;
  /** Callback when cell edit completes */
  onCellEditComplete?: OnCellEditComplete<TData>;
  /** Callback when cell edit is cancelled */
  onCellEditCancel?: OnCellEditCancel<TData>;
  /** Global validator applied to all cells (in addition to column-specific validators) */
  globalValidator?: (
    value: unknown,
    row: TData,
    column: GridColumn<TData>
  ) => CellValidationResult | Promise<CellValidationResult>;
}

export interface UseGridEditingReturn<TData extends GridRowData> {
  /** Current cell being edited (null if not editing) */
  editState: CellEditState | null;
  /** Whether any cell is currently being edited */
  isEditing: boolean;
  /** Start editing a cell */
  startEditing: (rowId: string, columnCode: string, initialValue?: unknown) => void;
  /** Complete editing with a new value */
  completeEditing: (newValue: unknown) => Promise<boolean>;
  /** Cancel editing and revert to original value */
  cancelEditing: () => void;
  /** Update the current value during editing (for controlled inputs) */
  updateEditValue: (value: unknown) => void;
  /** Navigate to next/prev/up/down editable cell */
  navigateToCell: (direction: 'next' | 'prev' | 'up' | 'down') => void;
  /** Check if a specific cell is currently being edited */
  isCellEditing: (rowId: string, columnCode: string) => boolean;
  /** Check if a column is editable */
  isColumnEditable: (columnCode: string) => boolean;
  /** Get editable columns in order */
  editableColumns: GridColumn<TData>[];
  /** Handle cell click based on edit trigger */
  handleCellClick: (row: TData, column: GridColumn<TData>, rowIndex: number) => void;
  /** Handle cell double-click based on edit trigger */
  handleCellDoubleClick: (row: TData, column: GridColumn<TData>, rowIndex: number) => void;
  /** Handle keyboard events for edit navigation */
  handleKeyDown: (event: React.KeyboardEvent, row: TData, column: GridColumn<TData>, rowIndex: number) => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useGridEditing<TData extends GridRowData>(
  options: UseGridEditingOptions<TData>
): UseGridEditingReturn<TData> {
  const {
    columns,
    data,
    enableEditing = false,
    editTrigger = 'doubleClick',
    onCellEditStart,
    onCellEditComplete,
    onCellEditCancel,
    globalValidator,
  } = options;

  // Edit state
  const [editState, setEditState] = useState<CellEditState | null>(null);

  // Track if validation is in progress
  const validationInProgress = useRef(false);

  // Memoize editable columns
  const editableColumns = useMemo(() => {
    return columns.filter((col) => col.editable !== false && col.type !== 'actions');
  }, [columns]);

  // Check if a column is editable
  const isColumnEditable = useCallback(
    (columnCode: string): boolean => {
      if (!enableEditing) return false;
      const column = columns.find((col) => col.code === columnCode);
      if (!column) return false;
      // Column must have editable explicitly set to true, OR have a type that's editable by default
      return column.editable === true;
    },
    [columns, enableEditing]
  );

  // Find row by ID
  const findRowById = useCallback(
    (rowId: string): TData | undefined => {
      return data.find((row) => row.id === rowId);
    },
    [data]
  );

  // Find row index by ID
  const findRowIndexById = useCallback(
    (rowId: string): number => {
      return data.findIndex((row) => row.id === rowId);
    },
    [data]
  );

  // Check if a specific cell is being edited
  const isCellEditing = useCallback(
    (rowId: string, columnCode: string): boolean => {
      return editState?.rowId === rowId && editState?.columnCode === columnCode;
    },
    [editState]
  );

  // Start editing a cell
  const startEditing = useCallback(
    (rowId: string, columnCode: string, initialValue?: unknown) => {
      if (!enableEditing) return;
      if (!isColumnEditable(columnCode)) return;

      const row = findRowById(rowId);
      const column = columns.find((col) => col.code === columnCode);

      if (!row || !column) return;

      // Get the value from the row
      const value = initialValue !== undefined ? initialValue : (row as Record<string, unknown>)[columnCode];

      // Call onCellEditStart callback - if it returns false, prevent editing
      if (onCellEditStart) {
        const result = onCellEditStart(row, column, value);
        if (result === false) return;
      }

      setEditState({
        rowId,
        columnCode,
        originalValue: value,
        currentValue: value,
        isValidating: false,
        validationError: undefined,
      });
    },
    [enableEditing, isColumnEditable, findRowById, columns, onCellEditStart]
  );

  // Update the current edit value
  const updateEditValue = useCallback((value: unknown) => {
    setEditState((prev) =>
      prev ? { ...prev, currentValue: value, validationError: undefined } : null
    );
  }, []);

  // Validate a value
  const validateValue = useCallback(
    async (
      value: unknown,
      row: TData,
      column: GridColumn<TData>
    ): Promise<CellValidationResult> => {
      // Run column-specific validator
      if (column.validator) {
        const result = await Promise.resolve(column.validator(value, row, column));
        if (!result.isValid) return result;
      }

      // Run global validator
      if (globalValidator) {
        const result = await Promise.resolve(globalValidator(value, row, column));
        if (!result.isValid) return result;
      }

      return { isValid: true };
    },
    [globalValidator]
  );

  // Complete editing with a new value
  const completeEditing = useCallback(
    async (newValue: unknown): Promise<boolean> => {
      if (!editState) return false;
      if (validationInProgress.current) return false;

      const row = findRowById(editState.rowId);
      const column = columns.find((col) => col.code === editState.columnCode);

      if (!row || !column) {
        setEditState(null);
        return false;
      }

      // Skip if value hasn't changed
      if (newValue === editState.originalValue) {
        setEditState(null);
        return true;
      }

      // Run validation
      validationInProgress.current = true;
      setEditState((prev) => (prev ? { ...prev, isValidating: true } : null));

      try {
        const validationResult = await validateValue(newValue, row, column);

        if (!validationResult.isValid) {
          setEditState((prev) =>
            prev
              ? {
                  ...prev,
                  isValidating: false,
                  validationError: validationResult.errorMessage,
                }
              : null
          );
          validationInProgress.current = false;
          return false;
        }

        // Call onCellEditComplete callback
        if (onCellEditComplete) {
          const event: CellEditEvent<TData> = {
            row,
            column,
            oldValue: editState.originalValue,
            newValue,
            rowIndex: findRowIndexById(editState.rowId),
          };

          await Promise.resolve(onCellEditComplete(event));
        }

        setEditState(null);
        validationInProgress.current = false;
        return true;
      } catch (error) {
        setEditState((prev) =>
          prev
            ? {
                ...prev,
                isValidating: false,
                validationError: error instanceof Error ? error.message : 'Validation failed',
              }
            : null
        );
        validationInProgress.current = false;
        return false;
      }
    },
    [editState, findRowById, findRowIndexById, columns, validateValue, onCellEditComplete]
  );

  // Cancel editing
  const cancelEditing = useCallback(() => {
    if (!editState) return;

    const row = findRowById(editState.rowId);
    const column = columns.find((col) => col.code === editState.columnCode);

    if (row && column && onCellEditCancel) {
      onCellEditCancel(row, column);
    }

    setEditState(null);
  }, [editState, findRowById, columns, onCellEditCancel]);

  // Navigate to next/prev/up/down editable cell
  const navigateToCell = useCallback(
    (direction: 'next' | 'prev' | 'up' | 'down') => {
      if (!editState) return;

      const currentRowIndex = findRowIndexById(editState.rowId);
      const currentColumnIndex = editableColumns.findIndex(
        (col) => col.code === editState.columnCode
      );

      if (currentRowIndex === -1 || currentColumnIndex === -1) return;

      let newRowIndex = currentRowIndex;
      let newColumnIndex = currentColumnIndex;

      switch (direction) {
        case 'next':
          newColumnIndex++;
          if (newColumnIndex >= editableColumns.length) {
            newColumnIndex = 0;
            newRowIndex++;
          }
          break;
        case 'prev':
          newColumnIndex--;
          if (newColumnIndex < 0) {
            newColumnIndex = editableColumns.length - 1;
            newRowIndex--;
          }
          break;
        case 'up':
          newRowIndex--;
          break;
        case 'down':
          newRowIndex++;
          break;
      }

      // Clamp row index
      if (newRowIndex < 0 || newRowIndex >= data.length) {
        return; // Don't wrap around rows
      }

      const newRow = data[newRowIndex];
      const newColumn = editableColumns[newColumnIndex];

      if (newRow && newColumn && !newColumn.skipOnTab) {
        startEditing(newRow.id, newColumn.code);
      }
    },
    [editState, findRowIndexById, editableColumns, data, startEditing]
  );

  // Handle cell click based on edit trigger
  const handleCellClick = useCallback(
    (row: TData, column: GridColumn<TData>, _rowIndex: number) => {
      if (editTrigger === 'click' && isColumnEditable(column.code)) {
        startEditing(row.id, column.code);
      }
    },
    [editTrigger, isColumnEditable, startEditing]
  );

  // Handle cell double-click based on edit trigger
  const handleCellDoubleClick = useCallback(
    (row: TData, column: GridColumn<TData>, _rowIndex: number) => {
      if (editTrigger === 'doubleClick' && isColumnEditable(column.code)) {
        startEditing(row.id, column.code);
      }
    },
    [editTrigger, isColumnEditable, startEditing]
  );

  // Handle keyboard events for edit navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, row: TData, column: GridColumn<TData>, _rowIndex: number) => {
      // If not in edit mode, check for edit triggers
      if (!editState) {
        if (
          (editTrigger === 'f2' && event.key === 'F2') ||
          (editTrigger === 'enter' && event.key === 'Enter')
        ) {
          if (isColumnEditable(column.code)) {
            event.preventDefault();
            startEditing(row.id, column.code);
          }
        }
        return;
      }

      // In edit mode, keyboard handling is done by the editor components
    },
    [editState, editTrigger, isColumnEditable, startEditing]
  );

  return {
    editState,
    isEditing: editState !== null,
    startEditing,
    completeEditing,
    cancelEditing,
    updateEditValue,
    navigateToCell,
    isCellEditing,
    isColumnEditable,
    editableColumns,
    handleCellClick,
    handleCellDoubleClick,
    handleKeyDown,
  };
}

export default useGridEditing;
