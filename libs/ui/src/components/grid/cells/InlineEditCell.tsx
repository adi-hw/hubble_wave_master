/**
 * InlineEditCell - Wrapper component that handles inline editing for grid cells
 *
 * This component wraps regular cell renderers and switches to an editor when
 * the cell is in edit mode. It handles:
 * - Detecting edit mode via editState prop
 * - Rendering the appropriate editor based on column type
 * - Fallback to read-only cell when not editing
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../utils/cn';
import { getCellRenderer } from '../cells';
import { getCellEditor, hasDefaultEditor } from '../editors';
import type {
  CellRendererProps,
  CellEditorProps,
  CellEditState,
  GridRowData,
  GridColumn,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface InlineEditCellProps<TData extends GridRowData = GridRowData>
  extends CellRendererProps<TData> {
  /** Current edit state (null if not in edit mode) */
  editState: CellEditState | null;
  /** Whether this specific cell is being edited */
  isEditing: boolean;
  /** Whether this column is editable */
  isEditable: boolean;
  /** Callback when editing is complete */
  onEditComplete: (newValue: unknown) => void;
  /** Callback when editing is cancelled */
  onEditCancel: () => void;
  /** Callback for navigating to next/prev cell */
  onNavigate?: (direction: 'next' | 'prev' | 'up' | 'down') => void;
  /** Callback when cell is clicked (for edit trigger) */
  onCellClick?: (cellElement: HTMLElement) => void;
  /** Callback when cell is double-clicked (for edit trigger) */
  onCellDoubleClick?: (cellElement: HTMLElement) => void;
}

// =============================================================================
// EDITABLE CELL WRAPPER
// =============================================================================

/**
 * Wrapper for cells that shows an edit indicator on hover
 */
const EditableCellWrapper = memo(function EditableCellWrapper({
  children,
  isEditable,
  onClick,
  onDoubleClick,
}: {
  children: React.ReactNode;
  isEditable: boolean;
  onClick?: (cellElement: HTMLElement) => void;
  onDoubleClick?: (cellElement: HTMLElement) => void;
}) {
  if (!isEditable) {
    return <>{children}</>;
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Find the parent grid-cell element
    const cellElement = e.currentTarget.closest('.grid-cell') as HTMLElement;
    if (cellElement) {
      onClick?.(cellElement);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Find the parent grid-cell element
    const cellElement = e.currentTarget.closest('.grid-cell') as HTMLElement;
    if (cellElement) {
      onDoubleClick?.(cellElement);
    }
  };

  return (
    <div
      className={cn(
        'group/editcell relative w-full h-full flex items-center overflow-hidden',
        'cursor-text'
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {children}
      {/* Edit indicator on hover */}
      <div
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2',
          'opacity-0 group-hover/editcell:opacity-60',
          'transition-opacity duration-150',
          'pointer-events-none'
        )}
      >
        <svg
          className="w-3 h-3 text-primary"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M11.5 2.5l2 2M2 14l1-4L12 1l2 2L5 12l-4 1z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
});

// =============================================================================
// INLINE EDIT CELL COMPONENT
// =============================================================================

export const InlineEditCell = memo(function InlineEditCell<TData extends GridRowData>({
  value,
  column,
  row,
  rowIndex,
  isSelected,
  isFocused,
  onReferenceClick,
  editState,
  isEditing,
  isEditable,
  onEditComplete,
  onEditCancel,
  onNavigate,
  onCellClick,
  onCellDoubleClick,
}: InlineEditCellProps<TData>) {
  // Handle edit completion
  const handleComplete = useCallback(
    (newValue: unknown) => {
      onEditComplete(newValue);
    },
    [onEditComplete]
  );

  // Handle edit cancellation
  const handleCancel = useCallback(() => {
    onEditCancel();
  }, [onEditCancel]);

  // If this cell is in edit mode, render the editor
  if (isEditing && editState) {
    // Common editor props
    const editorProps: CellEditorProps<TData> = {
      value: editState.currentValue,
      column,
      row,
      rowIndex,
      onComplete: handleComplete,
      onCancel: handleCancel,
      onNavigate,
      autoFocus: true,
      validationError: editState.validationError,
      isValidating: editState.isValidating,
    };

    // Wrapper for positioning - The parent grid-cell is already relative
    // We return a fragment because EditorWrapper is absolutely positioned within the cell
    const EditorContainer = ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    );

    // Check for custom editor in column definition
    if (column.renderEditor) {
      return <EditorContainer>{column.renderEditor(editorProps)}</EditorContainer>;
    }

    // Check for custom editor component
    if (column.editor) {
      const EditorComponent = column.editor;
      return (
        <EditorContainer>
          <EditorComponent {...editorProps} />
        </EditorContainer>
      );
    }

    // Use default editor based on column type
    const DefaultEditor = getCellEditor<TData>(column.type);
    if (DefaultEditor) {
      return (
        <EditorContainer>
          <DefaultEditor {...editorProps} />
        </EditorContainer>
      );
    }

    // Fallback: no editor available, render read-only
  }

  // Not in edit mode - render the regular cell
  // Check for custom cell renderer
  if (column.renderCell) {
    return (
      <EditableCellWrapper
        isEditable={isEditable}
        onClick={onCellClick}
        onDoubleClick={onCellDoubleClick}
      >
        {column.renderCell(value, row)}
      </EditableCellWrapper>
    );
  }

  // Use default cell renderer based on column type
  const CellRenderer = getCellRenderer<TData>(column.type);
  return (
    <EditableCellWrapper
      isEditable={isEditable}
      onClick={onCellClick}
      onDoubleClick={onCellDoubleClick}
    >
      <CellRenderer
        value={value}
        column={column}
        row={row}
        rowIndex={rowIndex}
        isSelected={isSelected}
        isFocused={isFocused}
        onReferenceClick={onReferenceClick}
      />
    </EditableCellWrapper>
  );
}) as <TData extends GridRowData>(props: InlineEditCellProps<TData>) => React.ReactElement;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a column type supports inline editing
 */
export function isColumnTypeEditable(type: string): boolean {
  // These types don't support inline editing
  const nonEditableTypes = ['actions', 'image'];
  return !nonEditableTypes.includes(type);
}

/**
 * Check if a column has an editor available (custom or default)
 */
export function columnHasEditor<TData extends GridRowData>(
  column: GridColumn<TData>
): boolean {
  if (column.editor) return true;
  if (column.renderEditor) return true;
  return hasDefaultEditor(column.type);
}

export default InlineEditCell;
