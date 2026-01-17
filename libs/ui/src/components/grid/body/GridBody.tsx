/**
 * GridBody - Virtualized body component for HubbleDataGrid
 *
 * Features:
 * - Row virtualization for 60fps scrolling with 20M+ records
 * - Row selection with visual feedback
 * - Row focus tracking for keyboard navigation
 * - Loading placeholder rows
 * - Group row support
 * - **Pinned columns** - rendered in separate absolutely positioned containers
 *   so they stay fixed while the main content scrolls horizontally
 */

import React, { memo, useCallback } from 'react';
import { VirtualItem } from '@tanstack/react-virtual';
import { flexRender, Row, Table, Cell } from '@tanstack/react-table';
import { cn } from '../utils/cn';
import { getCellRenderer } from '../cells';
import { InlineEditCell } from '../cells/InlineEditCell';
import {
  isGroupRow,
  type GridRowData,
  type GridColumn,
  type GridDensity,
  type BlockCacheEntry,
  type GroupableRow,
  type GroupedRow,
  type GroupExpansionState,
  type RowAction,
  type CellEditState,
} from '../types';
import { createPortal } from 'react-dom';

// =============================================================================
// ROW ACTIONS MENU (for grouped mode)
// =============================================================================

interface RowActionsMenuProps<TData> {
  row: TData;
  actions: RowAction<TData>[];
}

function RowActionsMenu<TData>({ row, actions }: RowActionsMenuProps<TData>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState<{ top: number; left: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Filter out hidden actions
  const visibleActions = actions.filter((action) => !action.hidden?.(row));

  // Close menu when clicking outside
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 160;
      const menuHeight = visibleActions.length * 36 + 8;

      let left = rect.right + 4;
      let top = rect.top;

      if (left + menuWidth > window.innerWidth - 16) {
        left = rect.left - menuWidth - 4;
      }

      if (left < 16) {
        left = Math.max(16, rect.left);
        top = rect.bottom + 4;
      }

      if (top + menuHeight > window.innerHeight - 16) {
        top = Math.max(16, window.innerHeight - menuHeight - 16);
      }

      if (top < 16) {
        top = 16;
      }

      setMenuPosition({ top, left });
    }
    setIsOpen(!isOpen);
  };

  const handleActionClick = (action: RowAction<TData>, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!action.disabled?.(row)) {
      action.onClick(row);
      setIsOpen(false);
    }
  };

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="grid-actions-button"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="grid-actions-menu"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            zIndex: 9999,
          }}
          role="menu"
        >
          {visibleActions.map((action) => {
            const isDisabled = action.disabled?.(row) ?? false;
            return (
              <button
                key={action.id}
                onClick={(e) => handleActionClick(action, e)}
                disabled={isDisabled}
                className={cn(
                  'grid-actions-menu-item',
                  action.variant === 'danger' && 'grid-actions-menu-item-danger',
                  action.variant === 'primary' && 'grid-actions-menu-item-primary',
                  isDisabled && 'grid-actions-menu-item-disabled'
                )}
                role="menuitem"
              >
                {action.icon && <span className="grid-actions-menu-icon">{action.icon}</span>}
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// =============================================================================
// ROW CHECKBOX
// =============================================================================

interface RowCheckboxProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (event: unknown) => void;
}

// RowCheckbox - kept for future use with row selection column
const _RowCheckbox = memo(function RowCheckbox({
  checked,
  disabled,
  onChange,
}: RowCheckboxProps) {
  return (
    <div className="flex items-center justify-center w-12">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-[var(--grid-checkbox-size)] h-[var(--grid-checkbox-size)]',
          'rounded border-2 border-[var(--grid-border)]',
          'bg-transparent cursor-pointer',
          'checked:bg-[var(--primary-500)] checked:border-[var(--primary-500)]',
          'focus:ring-2 focus:ring-[var(--primary-500)] focus:ring-offset-0',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        aria-label="Select row"
      />
    </div>
  );
});
void _RowCheckbox;

// =============================================================================
// DATA ROW
// =============================================================================

interface DataRowProps<TData extends GridRowData> {
  row: Row<TData>;
  virtualRow: VirtualItem;
  isFocused: boolean;
  isSelected: boolean;
  columns: GridColumn<TData>[];
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  /** Reference cell click handler */
  onReferenceClick?: (referenceInfo: {
    collection: string;
    recordId: string;
    columnCode: string;
    displayValue: string;
    row: TData;
  }) => void;
  density: GridDensity;
  /** Column pinning state - passed to trigger re-renders on pin changes */
  columnPinning?: { left?: string[]; right?: string[] };
  /** Column sizing state - passed to trigger re-renders on resize */
  columnSizing?: Record<string, number>;
  /** Column order state - passed to trigger re-renders on reorder */
  columnOrder?: string[];
  /** Horizontal scroll position - used to position pinned columns with transform */
  scrollLeft?: number;
  // ─────────────────────────────────────────────────────────────────────────────
  // INLINE EDITING PROPS
  // ─────────────────────────────────────────────────────────────────────────────
  /** Current cell edit state */
  editState?: CellEditState | null;
  /** Check if a column is editable */
  isColumnEditable?: (columnCode: string) => boolean;
  /** Callback when cell editing completes */
  onCellEditComplete?: (rowId: string, columnCode: string, newValue: unknown) => void;
  /** Callback when cell editing is cancelled */
  onCellEditCancel?: () => void;
  /** Callback to start editing a cell */
  onCellEditStart?: (rowId: string, columnCode: string, cellElement?: HTMLElement) => void;
  /** Callback for navigating to next/prev cell */
  onCellNavigate?: (direction: 'next' | 'prev' | 'up' | 'down') => void;
}

// Custom comparison for DataRow - only re-render when essential props change
function dataRowPropsAreEqual<TData extends GridRowData>(
  prevProps: DataRowProps<TData>,
  nextProps: DataRowProps<TData>
): boolean {
  // Always re-render if selection or focus changed
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isFocused !== nextProps.isFocused) return false;

  // Re-render if position changed (virtualization)
  if (prevProps.virtualRow.start !== nextProps.virtualRow.start) return false;
  if (prevProps.virtualRow.size !== nextProps.virtualRow.size) return false;
  if (prevProps.virtualRow.index !== nextProps.virtualRow.index) return false;

  // Re-render if row data changed (by id)
  if (prevProps.row.id !== nextProps.row.id) return false;

  // Re-render if scroll position changed (for pinned column positioning)
  if (prevProps.scrollLeft !== nextProps.scrollLeft) return false;

  // Re-render if column pinning changed
  const prevPinning = prevProps.columnPinning;
  const nextPinning = nextProps.columnPinning;
  if (prevPinning !== nextPinning) {
    // Deep compare pinning arrays
    const prevLeft = prevPinning?.left?.join(',') ?? '';
    const nextLeft = nextPinning?.left?.join(',') ?? '';
    const prevRight = prevPinning?.right?.join(',') ?? '';
    const nextRight = nextPinning?.right?.join(',') ?? '';
    if (prevLeft !== nextLeft || prevRight !== nextRight) return false;
  }

  // Re-render if column sizing changed (for resize to work on rows)
  if (prevProps.columnSizing !== nextProps.columnSizing) return false;

  // Re-render if column order changed
  const prevOrder = prevProps.columnOrder?.join(',') ?? '';
  const nextOrder = nextProps.columnOrder?.join(',') ?? '';
  if (prevOrder !== nextOrder) return false;

  // Re-render if edit state changed for this row
  const prevEditState = prevProps.editState;
  const nextEditState = nextProps.editState;
  const rowId = nextProps.row.original.id;

  // Check if this row is involved in editing
  const prevIsEditingThisRow = prevEditState?.rowId === rowId;
  const nextIsEditingThisRow = nextEditState?.rowId === rowId;

  if (prevIsEditingThisRow || nextIsEditingThisRow) {
    // If edit state is different, re-render
    if (prevEditState?.rowId !== nextEditState?.rowId) return false;
    if (prevEditState?.columnCode !== nextEditState?.columnCode) return false;
    if (prevEditState?.validationError !== nextEditState?.validationError) return false;
    if (prevEditState?.isValidating !== nextEditState?.isValidating) return false;
  }

  // Skip checking columns, callbacks - they rarely change and are expensive to compare
  return true;
}

/**
 * Options for rendering a cell with editing support
 */
interface RenderCellOptions<TData extends GridRowData> {
  cell: Cell<TData, unknown>;
  columns: GridColumn<TData>[];
  row: Row<TData>;
  virtualRow: VirtualItem;
  isSelected: boolean;
  isFocused: boolean;
  isSelectColumn: boolean;
  onReferenceClick?: (referenceInfo: {
    collection: string;
    recordId: string;
    columnCode: string;
    displayValue: string;
    row: TData;
  }) => void;
  // Editing props
  editState?: CellEditState | null;
  isColumnEditable?: (columnCode: string) => boolean;
  onCellEditComplete?: (rowId: string, columnCode: string, newValue: unknown) => void;
  onCellEditCancel?: () => void;
  onCellEditStart?: (rowId: string, columnCode: string, cellElement?: HTMLElement) => void;
  onCellNavigate?: (direction: 'next' | 'prev' | 'up' | 'down') => void;
}

/**
 * Renders a single cell with proper styling, event handling, and editing support
 */
function renderCell<TData extends GridRowData>(
  options: RenderCellOptions<TData>
): React.ReactNode {
  const {
    cell,
    columns,
    row,
    virtualRow,
    isSelected,
    isFocused,
    isSelectColumn,
    onReferenceClick,
    editState,
    isColumnEditable,
    onCellEditComplete,
    onCellEditCancel,
    onCellEditStart,
    onCellNavigate,
  } = options;

  // Skip editing for select column
  if (isSelectColumn) {
    return flexRender(cell.column.columnDef.cell, cell.getContext());
  }

  const column = columns.find((c) => c.code === cell.column.id);

  if (!column) {
    // Fallback: use TanStack's flexRender for custom cell definitions
    return flexRender(cell.column.columnDef.cell, cell.getContext());
  }

  // Check if editing is enabled for this column
  const isEditable = isColumnEditable?.(column.code) ?? false;
  const rowId = row.original.id;
  const isEditing = editState?.rowId === rowId && editState?.columnCode === column.code;

  // If editing is enabled, use InlineEditCell
  if (isEditable || isEditing) {
    const handleEditComplete = (newValue: unknown) => {
      onCellEditComplete?.(rowId, column.code, newValue);
    };

    const handleEditCancel = () => {
      onCellEditCancel?.();
    };

    const handleCellClick = (cellElement: HTMLElement) => {
      // This is handled by double-click by default, but click is used for some triggers
      void cellElement;
    };

    const handleCellDoubleClick = (cellElement: HTMLElement) => {
      if (!isEditing && isEditable) {
        onCellEditStart?.(rowId, column.code, cellElement);
      }
    };

    return (
      <InlineEditCell
        value={cell.getValue()}
        column={column}
        row={row.original}
        rowIndex={virtualRow.index}
        isSelected={isSelected}
        isFocused={isFocused}
        onReferenceClick={onReferenceClick}
        editState={isEditing ? editState : null}
        isEditing={isEditing}
        isEditable={isEditable}
        onEditComplete={handleEditComplete}
        onEditCancel={handleEditCancel}
        onNavigate={onCellNavigate}
        onCellClick={handleCellClick}
        onCellDoubleClick={handleCellDoubleClick}
      />
    );
  }

  // Not editable - use standard cell renderer
  if (column.renderCell) {
    return column.renderCell(cell.getValue(), row.original);
  }

  const CellRenderer = getCellRenderer<TData>(column.type);
  return (
    <CellRenderer
      value={cell.getValue()}
      column={column}
      row={row.original}
      rowIndex={virtualRow.index}
      isSelected={isSelected}
      isFocused={isFocused}
      onReferenceClick={onReferenceClick}
    />
  );
}

const DataRow = memo(function DataRow<TData extends GridRowData>({
  row,
  virtualRow,
  isFocused,
  isSelected,
  columns,
  onRowClick,
  onRowDoubleClick,
  onReferenceClick,
  density: _density,
  columnPinning: _columnPinning,
  columnSizing: _columnSizing,
  columnOrder: _columnOrder,
  scrollLeft: _scrollLeft,
  // Editing props
  editState,
  isColumnEditable,
  onCellEditComplete,
  onCellEditCancel,
  onCellEditStart,
  onCellNavigate,
}: DataRowProps<TData>) {
  void _density;
  void _columnPinning; // Used only to trigger re-renders when pinning changes
  void _columnSizing; // Used only to trigger re-renders when sizing changes
  void _columnOrder; // Used only to trigger re-renders when column order changes
  void _scrollLeft; // Kept for API compatibility

  const handleClick = useCallback(() => {
    onRowClick?.(row.original);
  }, [row.original, onRowClick]);

  const handleDoubleClick = useCallback(() => {
    onRowDoubleClick?.(row.original);
  }, [row.original, onRowDoubleClick]);

  // Get visible cells and categorize by pinning
  const visibleCells = row.getVisibleCells();
  const leftPinnedCells = visibleCells.filter((cell) => cell.column.getIsPinned() === 'left');
  const rightPinnedCells = visibleCells.filter((cell) => cell.column.getIsPinned() === 'right');
  const unpinnedCells = visibleCells.filter((cell) => !cell.column.getIsPinned());

  // Calculate cumulative positions for left-pinned columns
  let leftOffset = 0;
  const leftPositions: Record<string, number> = {};
  leftPinnedCells.forEach((cell) => {
    leftPositions[cell.id] = leftOffset;
    leftOffset += cell.column.getSize();
  });
  const leftPinnedWidth = leftOffset;

  // Calculate cumulative positions for right-pinned columns (from right edge)
  let rightOffset = 0;
  const rightPositions: Record<string, number> = {};
  // Process right-pinned cells in reverse order so rightmost column has position 0
  [...rightPinnedCells].reverse().forEach((cell) => {
    rightPositions[cell.id] = rightOffset;
    rightOffset += cell.column.getSize();
  });
  const rightPinnedWidth = rightOffset;

  // Calculate total width for the row
  const unpinnedWidth = unpinnedCells.reduce((sum, cell) => sum + cell.column.getSize(), 0);
  const totalRowWidth = leftPinnedWidth + unpinnedWidth + rightPinnedWidth;

  // Get row background color for pinned cells - use OPAQUE backgrounds to cover scrolling content
  const getRowBgColor = () => {
    if (isSelected) return 'var(--grid-row-selected-bg)';
    if (isFocused) return 'var(--grid-row-focused-bg)';
    // Pinned cells need opaque background - use grid-bg instead of semi-transparent alt-bg
    return 'var(--grid-bg)';
  };

  // Common render options for cells
  const getCellRenderOptions = (cell: Cell<TData, unknown>, isSelectColumn: boolean): RenderCellOptions<TData> => ({
    cell,
    columns,
    row,
    virtualRow,
    isSelected,
    isFocused,
    isSelectColumn,
    onReferenceClick,
    editState,
    isColumnEditable,
    onCellEditComplete,
    onCellEditCancel,
    onCellEditStart,
    onCellNavigate,
  });

  return (
    <div
      className={cn(
        'grid-row absolute left-0'
      )}
      style={{
        top: virtualRow.start,
        height: virtualRow.size,
        width: totalRowWidth,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      role="row"
      aria-rowindex={virtualRow.index + 1}
      aria-selected={isSelected}
      data-selected={isSelected}
      data-focused={isFocused}
      data-row-index={virtualRow.index}
    >
      {/* Left-pinned cells - use sticky positioning */}
      {leftPinnedCells.map((cell) => {
        const isSelectColumn = cell.column.id === 'select';
        const isViewColumn = cell.column.id === '_view';
        const isActionsColumn = cell.column.id === '_actions';

        return (
          <div
            key={cell.id}
            className={cn(
              'grid-cell h-full sticky',
              isSelectColumn && 'grid-cell-select',
              isViewColumn && 'grid-cell-view',
              isActionsColumn && 'grid-cell-actions'
            )}
            style={{
              width: cell.column.getSize(),
              left: leftPositions[cell.id],
              zIndex: 20,
              backgroundColor: getRowBgColor(),
              flexShrink: 0,
            }}
            onClick={(isSelectColumn || isViewColumn || isActionsColumn) ? (e) => e.stopPropagation() : undefined}
            role="gridcell"
            aria-colindex={cell.column.getIndex() + 1}
            data-pinned="left"
          >
            {renderCell(getCellRenderOptions(cell, isSelectColumn || isViewColumn || isActionsColumn))}
          </div>
        );
      })}

      {/* Unpinned cells - flow naturally after pinned cells */}
      {unpinnedCells.map((cell) => (
        <div
          key={cell.id}
          className="grid-cell h-full"
          style={{
            width: cell.column.getSize(),
            flexShrink: 0,
          }}
          role="gridcell"
          aria-colindex={cell.column.getIndex() + 1}
        >
          {renderCell(getCellRenderOptions(cell, false))}
        </div>
      ))}

      {/* Right-pinned cells - use sticky positioning from right */}
      {rightPinnedCells.map((cell) => (
        <div
          key={cell.id}
          className="grid-cell h-full sticky"
          style={{
            width: cell.column.getSize(),
            right: rightPositions[cell.id],
            zIndex: 20,
            backgroundColor: getRowBgColor(),
            flexShrink: 0,
          }}
          role="gridcell"
          aria-colindex={cell.column.getIndex() + 1}
          data-pinned="right"
        >
          {renderCell(getCellRenderOptions(cell, false))}
        </div>
      ))}
    </div>
  );
}, dataRowPropsAreEqual) as <TData extends GridRowData>(props: DataRowProps<TData>) => React.ReactElement;

// =============================================================================
// GROUP ROW
// =============================================================================

interface GroupRowProps<TData extends GridRowData> {
  row: Row<TData>;
  virtualRow: VirtualItem;
  depth: number;
}

const GroupRow = memo(function GroupRow<TData extends GridRowData>({
  row,
  virtualRow,
  depth,
}: GroupRowProps<TData>) {
  const isExpanded = row.getIsExpanded();

  return (
    <div
      className="grid-row-group absolute left-0 w-full"
      style={{
        top: virtualRow.start,
        height: virtualRow.size,
        paddingLeft: `calc(${depth} * var(--grid-group-indent) + var(--grid-cell-padding-x))`,
      }}
      onClick={() => row.toggleExpanded()}
      role="row"
      aria-rowindex={virtualRow.index + 1}
      aria-expanded={isExpanded}
      aria-level={depth + 1}
    >
      {/* Expand/collapse icon */}
      <span
        className={cn(
          'flex-shrink-0 w-[var(--grid-expand-icon-size)] h-[var(--grid-expand-icon-size)]',
          'flex items-center justify-center mr-2',
          'transition-transform duration-200',
          isExpanded && 'rotate-90'
        )}
      >
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M4 2L10 6L4 10V2Z" />
        </svg>
      </span>

      {/* Group label */}
      <span className="font-semibold text-[var(--grid-cell-color)]">
        {row.groupingValue as string}
      </span>

      {/* Row count */}
      <span className="ml-2 text-[var(--grid-cell-muted-color)] text-sm">
        ({row.subRows.length})
      </span>
    </div>
  );
}) as <TData extends GridRowData>(props: GroupRowProps<TData>) => React.ReactElement;

// =============================================================================
// SERVER-SIDE GROUP ROW
// =============================================================================

interface ServerGroupRowProps {
  group: GroupedRow;
  virtualRow: VirtualItem;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: () => void;
  totalWidth: number;
}

const ServerGroupRow = memo(function ServerGroupRow({
  group,
  virtualRow,
  isExpanded,
  isLoading,
  onToggle,
  totalWidth,
}: ServerGroupRowProps) {
  return (
    <div
      className="grid-row-group absolute left-0"
      style={{
        top: virtualRow.start,
        height: virtualRow.size,
        width: totalWidth,
        paddingLeft: `calc(${group.__depth} * var(--grid-group-indent, 24px) + var(--grid-cell-padding-x, 12px))`,
      }}
      onClick={onToggle}
      role="row"
      aria-rowindex={virtualRow.index + 1}
      aria-expanded={isExpanded}
      aria-level={group.__depth + 1}
    >
      {/* Expand/collapse icon */}
      <span
        className={cn(
          'flex-shrink-0 w-[var(--grid-expand-icon-size,16px)] h-[var(--grid-expand-icon-size,16px)]',
          'flex items-center justify-center mr-2',
          'transition-transform duration-200',
          isExpanded && 'rotate-90'
        )}
      >
        {isLoading ? (
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6" cy="6" r="4" opacity="0.25" />
            <path d="M6 2C3.79 2 2 3.79 2 6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M4 2L10 6L4 10V2Z" />
          </svg>
        )}
      </span>

      {/* Group label */}
      <span className="font-semibold text-[var(--grid-cell-color)]">
        {group.__groupLabel}
      </span>

      {/* Row count */}
      <span className="ml-2 text-[var(--grid-cell-muted-color)] text-sm">
        ({group.__childCount.toLocaleString()})
      </span>

      {/* Aggregations preview (if available) */}
      {group.__aggregations && Object.keys(group.__aggregations).length > 0 && (
        <span className="ml-4 text-[var(--grid-cell-muted-color)] text-xs flex gap-3">
          {Object.entries(group.__aggregations).slice(0, 3).map(([field, aggs]) => (
            <span key={field}>
              {field}: {aggs.sum !== undefined ? `Σ${aggs.sum.toLocaleString()}` : ''}
              {aggs.avg !== undefined ? ` μ${aggs.avg.toFixed(1)}` : ''}
            </span>
          ))}
        </span>
      )}
    </div>
  );
});

// =============================================================================
// SERVER-SIDE GROUP CHILD ROW (for children loaded under a group)
// =============================================================================

interface ServerGroupChildRowProps<TData extends GridRowData> {
  data: TData;
  virtualRow: VirtualItem;
  isFocused: boolean;
  isSelected: boolean;
  columns: GridColumn<TData>[];
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  onToggleSelection?: (rowId: string) => void;
  /** Reference cell click handler */
  onReferenceClick?: (referenceInfo: {
    collection: string;
    recordId: string;
    columnCode: string;
    displayValue: string;
    row: TData;
  }) => void;
  density: GridDensity;
  depth: number;
  visibleColumns: { id: string; getSize: () => number; getIsPinned: () => string | false; getStart: (position?: 'left' | 'right' | 'center') => number; getIndex: () => number }[];
  /** Horizontal scroll position - used to position pinned columns with transform */
  scrollLeft: number;
  /** Row actions for the 3-dots menu */
  rowActions?: RowAction<TData>[];
}

const ServerGroupChildRow = memo(function ServerGroupChildRow<TData extends GridRowData>({
  data,
  virtualRow,
  isFocused,
  isSelected,
  columns,
  onRowClick,
  onRowDoubleClick,
  onToggleSelection,
  onReferenceClick,
  density: _density,
  depth: _depth,
  visibleColumns,
  scrollLeft: _scrollLeft,
  rowActions,
}: ServerGroupChildRowProps<TData>) {
  void _density;
  void _depth; // Kept for future use (indentation based on group depth)
  void _scrollLeft; // Kept for API compatibility

  const handleClick = useCallback(() => {
    onRowClick?.(data);
  }, [data, onRowClick]);

  const handleDoubleClick = useCallback(() => {
    onRowDoubleClick?.(data);
  }, [data, onRowDoubleClick]);

  // Get row ID for selection
  const rowId = String((data as Record<string, unknown>).id ?? (data as Record<string, unknown>).sys_id ?? (data as Record<string, unknown>)._id ?? '');

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (rowId && onToggleSelection) {
      onToggleSelection(rowId);
    }
  }, [rowId, onToggleSelection]);

  // Categorize columns by pinning
  const leftPinnedCols = visibleColumns.filter((col) => col.getIsPinned() === 'left');
  const rightPinnedCols = visibleColumns.filter((col) => col.getIsPinned() === 'right');
  const unpinnedCols = visibleColumns.filter((col) => !col.getIsPinned());

  // Calculate cumulative positions for left-pinned columns
  let leftOffset = 0;
  const leftPositions: Record<string, number> = {};
  leftPinnedCols.forEach((col) => {
    leftPositions[col.id] = leftOffset;
    leftOffset += col.getSize();
  });
  const leftPinnedWidth = leftOffset;

  // Calculate cumulative positions for right-pinned columns (from right edge)
  let rightOffset = 0;
  const rightPositions: Record<string, number> = {};
  [...rightPinnedCols].reverse().forEach((col) => {
    rightPositions[col.id] = rightOffset;
    rightOffset += col.getSize();
  });
  const rightPinnedWidth = rightOffset;

  // Total row width
  const totalRowWidth = leftPinnedWidth + unpinnedCols.reduce((sum, col) => sum + col.getSize(), 0) + rightPinnedWidth;

  // Get row background color for pinned cells - use OPAQUE backgrounds to cover scrolling content
  const getRowBgColor = () => {
    if (isSelected) return 'var(--grid-row-selected-bg)';
    if (isFocused) return 'var(--grid-row-focused-bg)';
    // Pinned cells need opaque background - use grid-bg instead of semi-transparent alt-bg
    return 'var(--grid-bg)';
  };

  return (
    <div
      className={cn(
        'grid-row absolute left-0'
      )}
      style={{
        top: virtualRow.start,
        height: virtualRow.size,
        width: totalRowWidth,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      role="row"
      aria-rowindex={virtualRow.index + 1}
      aria-selected={isSelected}
      data-selected={isSelected}
      data-focused={isFocused}
      data-row-index={virtualRow.index}
    >
      {/* Left-pinned cells - use sticky positioning */}
      {leftPinnedCols.map((col) => {
        const column = columns.find((c) => c.code === col.id);
        const value = (data as Record<string, unknown>)[col.id];
        const isSelectColumn = col.id === 'select';
        const isViewColumn = col.id === '_view';
        const isActionsColumn = col.id === '_actions';

        return (
          <div
            key={col.id}
            className={cn(
              'grid-cell h-full sticky',
              isSelectColumn && 'grid-cell-select',
              isViewColumn && 'grid-cell-view',
              isActionsColumn && 'grid-cell-actions'
            )}
            style={{
              width: col.getSize(),
              left: leftPositions[col.id],
              zIndex: 20,
              backgroundColor: getRowBgColor(),
              flexShrink: 0,
            }}
            onClick={(isSelectColumn || isViewColumn || isActionsColumn) ? (e) => e.stopPropagation() : undefined}
            role="gridcell"
            aria-colindex={col.getIndex() + 1}
            data-pinned="left"
          >
            {isSelectColumn ? (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                onClick={handleCheckboxClick}
                aria-label="Select row"
              />
            ) : isActionsColumn && rowActions && rowActions.length > 0 ? (
              <RowActionsMenu row={data} actions={rowActions} />
            ) : column?.renderCell ? (
              column.renderCell(value, data)
            ) : column ? (
              (() => {
                const CellRenderer = getCellRenderer<TData>(column.type);
                return (
                  <CellRenderer
                    value={value}
                    column={column}
                    row={data}
                    rowIndex={virtualRow.index}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    onReferenceClick={onReferenceClick}
                  />
                );
              })()
            ) : (
              <span className="text-[var(--grid-cell-color)] truncate">
                {String(value ?? '')}
              </span>
            )}
          </div>
        );
      })}

      {/* Unpinned cells - flow naturally after pinned cells */}
      {unpinnedCols.map((col) => {
        const column = columns.find((c) => c.code === col.id);
        const value = (data as Record<string, unknown>)[col.id];

        return (
          <div
            key={col.id}
            className="grid-cell h-full"
            style={{
              width: col.getSize(),
              flexShrink: 0,
            }}
            role="gridcell"
            aria-colindex={col.getIndex() + 1}
          >
            {column?.renderCell ? (
              column.renderCell(value, data)
            ) : column ? (
              (() => {
                const CellRenderer = getCellRenderer<TData>(column.type);
                return (
                  <CellRenderer
                    value={value}
                    column={column}
                    row={data}
                    rowIndex={virtualRow.index}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    onReferenceClick={onReferenceClick}
                  />
                );
              })()
            ) : (
              <span className="text-[var(--grid-cell-color)] truncate">
                {String(value ?? '')}
              </span>
            )}
          </div>
        );
      })}

      {/* Right-pinned cells - use sticky positioning from right */}
      {rightPinnedCols.map((col) => {
        const column = columns.find((c) => c.code === col.id);
        const value = (data as Record<string, unknown>)[col.id];

        return (
          <div
            key={col.id}
            className="grid-cell h-full sticky"
            style={{
              width: col.getSize(),
              right: rightPositions[col.id],
              zIndex: 20,
              backgroundColor: getRowBgColor(),
              flexShrink: 0,
            }}
            role="gridcell"
            aria-colindex={col.getIndex() + 1}
            data-pinned="right"
          >
            {column?.renderCell ? (
              column.renderCell(value, data)
            ) : column ? (
              (() => {
                const CellRenderer = getCellRenderer<TData>(column.type);
                return (
                  <CellRenderer
                    value={value}
                    column={column}
                    row={data}
                    rowIndex={virtualRow.index}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    onReferenceClick={onReferenceClick}
                  />
                );
              })()
            ) : (
              <span className="text-[var(--grid-cell-color)] truncate">
                {String(value ?? '')}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}) as <TData extends GridRowData>(props: ServerGroupChildRowProps<TData>) => React.ReactElement;

// =============================================================================
// LOADING PLACEHOLDER
// =============================================================================

interface LoadingPlaceholderProps {
  virtualRow: VirtualItem;
  columnCount: number;
}

const LoadingPlaceholder = memo(function LoadingPlaceholder({
  virtualRow,
  columnCount,
}: LoadingPlaceholderProps) {
  return (
    <div
      className="grid-row grid-row-loading absolute left-0 w-full"
      style={{
        top: virtualRow.start,
        height: virtualRow.size,
      }}
      role="row"
      aria-busy="true"
    >
      {Array.from({ length: columnCount }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-4 mx-4 rounded bg-[var(--glass-bg)] animate-pulse"
        />
      ))}
    </div>
  );
});

// =============================================================================
// GRID BODY COMPONENT
// =============================================================================

interface GridBodyProps<TData extends GridRowData> {
  table: Table<TData>;
  virtualRows: VirtualItem[];
  totalHeight: number;
  focusedRowIndex: number;
  windowStart?: number;
  columns: GridColumn<TData>[];
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  /** Reference cell click handler */
  onReferenceClick?: (referenceInfo: {
    collection: string;
    recordId: string;
    columnCode: string;
    displayValue: string;
    row: TData;
  }) => void;
  density: GridDensity;
  loadedBlocks?: Map<number, BlockCacheEntry<TData>>;
  blockSize?: number;
  // Row selection state - passed explicitly to trigger re-renders on selection change
  rowSelection?: Record<string, boolean>;
  // Column sizing state - passed explicitly to trigger re-renders on resize
  columnSizing?: Record<string, number>;
  // Column order state - passed explicitly to trigger re-renders on reorder/pin
  columnOrder?: string[];
  // Column visibility state - passed explicitly to trigger re-renders on visibility changes
  columnVisibility?: Record<string, boolean>;
  // Column pinning state - passed explicitly to trigger re-renders on pin changes
  columnPinning?: { left?: string[]; right?: string[] };
  // Scroll position - used to position pinned columns with transform
  scrollLeft?: number;
  // Server-side grouping props
  isGrouped?: boolean;
  groupedRows?: GroupableRow<TData>[];
  expansionState?: GroupExpansionState;
  onToggleGroup?: (groupId: string) => void;
  onLoadMoreChildren?: (groupId: string) => void;
  isGroupLoading?: (groupId: string) => boolean;
  groupByField?: string | null;
  // Row actions for 3-dots menu
  rowActions?: RowAction<TData>[];
  // ─────────────────────────────────────────────────────────────────────────────
  // INLINE EDITING PROPS
  // ─────────────────────────────────────────────────────────────────────────────
  /** Current cell edit state */
  editState?: CellEditState | null;
  /** Check if a column is editable */
  isColumnEditable?: (columnCode: string) => boolean;
  /** Callback when cell editing completes */
  onCellEditComplete?: (rowId: string, columnCode: string, newValue: unknown) => void;
  /** Callback when cell editing is cancelled */
  onCellEditCancel?: () => void;
  /** Callback to start editing a cell */
  onCellEditStart?: (rowId: string, columnCode: string, cellElement?: HTMLElement) => void;
  /** Callback for navigating to next/prev cell */
  onCellNavigate?: (direction: 'next' | 'prev' | 'up' | 'down') => void;
}

export const GridBody = memo(function GridBody<TData extends GridRowData>({
  table,
  virtualRows,
  totalHeight,
  focusedRowIndex,
  windowStart = 0,
  columns,
  onRowClick,
  onRowDoubleClick,
  onReferenceClick,
  density,
  loadedBlocks,
  blockSize = 100,
  // Row selection state - used to trigger re-renders on selection change and for grouped mode
  rowSelection,
  // Column sizing state - passed to DataRow to trigger re-renders on resize
  columnSizing,
  // Column order state - passed to DataRow to trigger re-renders on reorder
  columnOrder,
  // Column visibility state - passed to trigger re-renders on visibility changes
  columnVisibility: _columnVisibility,
  // Column pinning state - passed to DataRow to trigger re-renders on pin changes
  columnPinning,
  // Scroll position for pinned column positioning
  scrollLeft = 0,
  // Server-side grouping props
  isGrouped = false,
  groupedRows = [],
  expansionState = {},
  onToggleGroup,
  onLoadMoreChildren: _onLoadMoreChildren,
  isGroupLoading,
  groupByField: _groupByField,
  // Row actions
  rowActions,
  // Inline editing props
  editState,
  isColumnEditable,
  onCellEditComplete,
  onCellEditCancel,
  onCellEditStart,
  onCellNavigate,
}: GridBodyProps<TData>) {
  void _groupByField;
  void _onLoadMoreChildren; // Will be used for "Load More" button in expanded groups
  void _columnVisibility; // Used to trigger re-renders on visibility changes
  // columnSizing, columnOrder, and columnPinning are passed to DataRow to trigger re-renders
  const { rows } = table.getRowModel();
  const visibleColumns = table.getVisibleLeafColumns();

  // Calculate total width for group rows
  const totalWidth = visibleColumns.reduce((sum, col) => sum + col.getSize(), 0);

  // Check if a row is loaded
  const isRowLoaded = useCallback(
    (rowIndex: number): boolean => {
      if (!loadedBlocks || loadedBlocks.size === 0) return true; // Not using SSRM
      const blockIndex = Math.floor(rowIndex / blockSize);
      return loadedBlocks.has(blockIndex);
    },
    [loadedBlocks, blockSize]
  );

  // Get row data for a virtual row (non-grouped mode)
  const getRowData = useCallback(
    (virtualRow: VirtualItem): Row<TData> | null => {
      const relativeIndex = virtualRow.index - windowStart;
      if (relativeIndex < 0 || relativeIndex >= rows.length) return null;
      return rows[relativeIndex] ?? null;
    },
    [rows, windowStart]
  );

  // Toggle row selection for grouped mode
  const handleToggleSelection = useCallback((rowId: string) => {
    const currentSelection = table.getState().rowSelection;
    const isCurrentlySelected = currentSelection[rowId] ?? false;
    table.setRowSelection({
      ...currentSelection,
      [rowId]: !isCurrentlySelected,
    });
  }, [table]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVER-SIDE GROUPED MODE RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  if (isGrouped && groupedRows.length > 0) {
    // Sort visible columns: left-pinned first, then unpinned, then right-pinned
    const leftPinnedCols = visibleColumns.filter((col) => col.getIsPinned() === 'left');
    const unpinnedCols = visibleColumns.filter((col) => !col.getIsPinned());
    const rightPinnedCols = visibleColumns.filter((col) => col.getIsPinned() === 'right');
    const sortedVisibleColumns = [...leftPinnedCols, ...unpinnedCols, ...rightPinnedCols];

    return (
      <div
        className="relative"
        style={{ height: totalHeight, minWidth: totalWidth }}
        role="rowgroup"
      >
        {virtualRows.map((virtualRow) => {
          const rowData = groupedRows[virtualRow.index];

          if (!rowData) {
            return (
              <LoadingPlaceholder
                key={virtualRow.key}
                virtualRow={virtualRow}
                columnCount={visibleColumns.length}
              />
            );
          }

          // Check if this is a group header
          if (isGroupRow(rowData)) {
            const group = rowData as GroupedRow;
            const groupState = expansionState[group.__groupId];
            const isExpanded = groupState?.isExpanded ?? false;
            const isLoading = isGroupLoading?.(group.__groupId) ?? false;

            return (
              <ServerGroupRow
                key={virtualRow.key}
                group={group}
                virtualRow={virtualRow}
                isExpanded={isExpanded}
                isLoading={isLoading}
                onToggle={() => onToggleGroup?.(group.__groupId)}
                totalWidth={totalWidth}
              />
            );
          }

          // This is a data row (child of an expanded group)
          // Find which group this child belongs to by looking backwards
          let parentGroup: GroupedRow | null = null;
          for (let i = virtualRow.index - 1; i >= 0; i--) {
            const potentialParent = groupedRows[i];
            if (potentialParent && isGroupRow(potentialParent)) {
              parentGroup = potentialParent as GroupedRow;
              break;
            }
          }

          // Get row ID for selection state
          const dataRecord = rowData as Record<string, unknown>;
          const rowId = String(dataRecord.id ?? dataRecord.sys_id ?? dataRecord._id ?? '');
          const isRowSelected = rowId ? (rowSelection?.[rowId] ?? false) : false;

          return (
            <ServerGroupChildRow
              key={virtualRow.key}
              data={rowData as TData}
              virtualRow={virtualRow}
              isFocused={virtualRow.index === focusedRowIndex}
              isSelected={isRowSelected}
              columns={columns}
              onRowClick={onRowClick}
              onRowDoubleClick={onRowDoubleClick}
              onToggleSelection={handleToggleSelection}
              onReferenceClick={onReferenceClick}
              density={density}
              depth={parentGroup?.__depth ?? 0}
              visibleColumns={sortedVisibleColumns}
              scrollLeft={scrollLeft}
              rowActions={rowActions}
            />
          );
        })}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STANDARD MODE RENDERING (non-grouped or client-side grouped)
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div
      className="relative"
      style={{ height: totalHeight, minWidth: totalWidth }}
      role="rowgroup"
    >
      {virtualRows.map((virtualRow) => {
        const row = getRowData(virtualRow);
        const isLoaded = isRowLoaded(virtualRow.index);

        // Show loading placeholder if row data not loaded
        if (!row || !isLoaded) {
          return (
            <LoadingPlaceholder
              key={virtualRow.key}
              virtualRow={virtualRow}
              columnCount={visibleColumns.length}
            />
          );
        }

        // Render group row (client-side grouping)
        if (row.getIsGrouped()) {
          return (
            <GroupRow
              key={virtualRow.key}
              row={row}
              virtualRow={virtualRow}
              depth={row.depth}
            />
          );
        }

        // Render data row
        return (
          <DataRow
            key={virtualRow.key}
            row={row}
            virtualRow={virtualRow}
            isFocused={virtualRow.index === focusedRowIndex}
            isSelected={row.getIsSelected()}
            columns={columns}
            onRowClick={onRowClick}
            onRowDoubleClick={onRowDoubleClick}
            onReferenceClick={onReferenceClick}
            density={density}
            columnPinning={columnPinning}
            columnSizing={columnSizing}
            columnOrder={columnOrder}
            scrollLeft={scrollLeft}
            // Inline editing props
            editState={editState}
            isColumnEditable={isColumnEditable}
            onCellEditComplete={onCellEditComplete}
            onCellEditCancel={onCellEditCancel}
            onCellEditStart={onCellEditStart}
            onCellNavigate={onCellNavigate}
          />
        );
      })}
    </div>
  );
}) as <TData extends GridRowData>(props: GridBodyProps<TData>) => React.ReactElement;
