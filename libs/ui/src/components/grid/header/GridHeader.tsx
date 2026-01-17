/**
 * GridHeader - Header row component for HubbleDataGrid
 *
 * Features:
 * - Column headers with sorting indicators
 * - Column resizing
 * - Column reordering (drag-drop)
 * - Select all checkbox
 * - Sticky positioning
 */

import React, { useCallback, useState, memo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { flexRender, Header, Table, SortingState, GroupingState } from '@tanstack/react-table';
import { cn } from '../utils/cn';
import type { GridRowData, GridDensity } from '../types';

// =============================================================================
// GRID OPTIONS MENU (for select column header)
// =============================================================================

interface GridOptionsMenuProps {
  x: number;
  y: number;
  hasActiveGrouping: boolean;
  currentDensity: GridDensity;
  onClearGrouping: () => void;
  onAutoSizeAllColumns: () => void;
  onDensityChange: (density: GridDensity) => void;
  onClose: () => void;
}

const GridOptionsMenu = memo(function GridOptionsMenu({
  x,
  y,
  hasActiveGrouping,
  currentDensity,
  onClearGrouping,
  onAutoSizeAllColumns,
  onDensityChange,
  onClose,
}: GridOptionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const newX = x + rect.width > window.innerWidth ? x - rect.width : x;
      const newY = y + rect.height > window.innerHeight ? y - rect.height : y;
      setAdjustedPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
    }
  }, [x, y]);

  const densityOptions: { value: GridDensity; label: string; icon: React.ReactNode }[] = [
    {
      value: 'compact',
      label: 'Compact',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h12v1H2V3zm0 3h12v1H2V6zm0 3h12v1H2V9zm0 3h12v1H2v-1z" />
        </svg>
      ),
    },
    {
      value: 'comfortable',
      label: 'Comfortable',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h12v2H2v-2z" />
        </svg>
      ),
    },
    {
      value: 'spacious',
      label: 'Spacious',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 1h12v3H2V1zm0 5h12v3H2V6zm0 5h12v3H2v-3z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[9999]',
        'min-w-[180px]',
        'rounded-lg p-1',
        'border shadow-lg'
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-default)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Header */}
      <div
        className="px-2 py-1.5 mb-1 text-xs font-semibold truncate"
        style={{
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        Grid Options
      </div>

      {/* Menu items */}
      <div>
        {/* Density options */}
        <div
          className="px-2 py-1 text-xs font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          Row Density
        </div>
        {densityOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onDensityChange(option.value);
              onClose();
            }}
            className={cn(
              'flex items-center gap-3 px-3 py-1.5 rounded-md w-full text-left',
              'transition-colors hover:bg-[var(--bg-hover)]'
            )}
          >
            <span style={{ color: currentDensity === option.value ? 'var(--text-brand)' : 'var(--text-muted)' }}>
              {option.icon}
            </span>
            <span
              className="text-sm whitespace-nowrap"
              style={{ color: currentDensity === option.value ? 'var(--text-brand)' : 'var(--text-primary)' }}
            >
              {option.label}
            </span>
            {currentDensity === option.value && (
              <svg className="w-4 h-4 ml-auto" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--text-brand)' }}>
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
              </svg>
            )}
          </button>
        ))}

        <div className="my-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />

        {/* Auto-size all columns */}
        <button
          onClick={() => {
            onAutoSizeAllColumns();
            onClose();
          }}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left',
            'transition-colors hover:bg-[var(--bg-hover)]'
          )}
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
            <path d="M2 7h4v2H2V7zm8 0h4v2h-4V7zM1 4l2 2-2 2V4zm14 0v4l-2-2 2-2z" />
          </svg>
          <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
            Auto-size all columns
          </span>
        </button>

        {/* Clear grouping - show if there's active grouping */}
        {hasActiveGrouping && (
          <>
            <div className="my-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
            <button
              onClick={() => {
                onClearGrouping();
                onClose();
              }}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left',
                'transition-colors hover:bg-[var(--bg-hover)]'
              )}
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
                <path d="M3 3h10v2H3V3zm1 4h8v2H4V7zm1 4h6v2H5v-2z" />
                <path d="M13 1L15 3M15 1L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
              <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                Clear grouping
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// COLUMN HEADER CONTEXT MENU
// =============================================================================

interface HeaderContextMenuProps {
  x: number;
  y: number;
  columnId: string;
  columnLabel: string;
  canGroup: boolean;
  isGrouped: boolean;
  hasActiveGrouping: boolean;
  canPin: boolean;
  isPinned: false | 'left' | 'right';
  canResize: boolean;
  onGroupBy: () => void;
  onClearGrouping: () => void;
  onPinLeft: () => void;
  onPinRight: () => void;
  onUnpin: () => void;
  onAutoSizeColumn: () => void;
  onClose: () => void;
}

const HeaderContextMenu = memo(function HeaderContextMenu({
  x,
  y,
  columnLabel,
  canGroup,
  isGrouped,
  hasActiveGrouping,
  canPin,
  isPinned,
  canResize,
  onGroupBy,
  onClearGrouping,
  onPinLeft,
  onPinRight,
  onUnpin,
  onAutoSizeColumn,
  onClose,
}: HeaderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Close on escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const newX = x + rect.width > window.innerWidth ? x - rect.width : x;
      const newY = y + rect.height > window.innerHeight ? y - rect.height : y;
      setAdjustedPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[9999]',
        'min-w-[180px]',
        'rounded-lg p-1',
        'border shadow-lg'
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-default)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Header */}
      <div
        className="px-2 py-1.5 mb-1 text-xs font-semibold truncate"
        style={{
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        {columnLabel}
      </div>

      {/* Menu items */}
      <div>
        {/* Pinning options */}
        {canPin && !isPinned && (
          <>
            <button
              onClick={() => {
                onPinLeft();
                onClose();
              }}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left',
                'transition-colors hover:bg-[var(--bg-hover)]'
              )}
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
                <path d="M2 2v12h2V2H2zm4 3v6h6V5H6zm1 1h4v4H7V6z" />
              </svg>
              <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                Pin to left
              </span>
            </button>
            <button
              onClick={() => {
                onPinRight();
                onClose();
              }}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left',
                'transition-colors hover:bg-[var(--bg-hover)]'
              )}
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
                <path d="M12 2v12h2V2h-2zM4 5v6h6V5H4zm1 1h4v4H5V6z" />
              </svg>
              <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                Pin to right
              </span>
            </button>
          </>
        )}

        {/* Unpin - show if column is pinned */}
        {isPinned && (
          <button
            onClick={() => {
              onUnpin();
              onClose();
            }}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left',
              'transition-colors hover:bg-[var(--bg-hover)]'
            )}
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
              <path d="M4 5v6h6V5H4zm1 1h4v4H5V6z" />
              <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
            <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
              Unpin column
            </span>
          </button>
        )}

        {/* Separator between pinning and grouping */}
        {(canPin || isPinned) && (canGroup || hasActiveGrouping) && (
          <div className="my-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
        )}

        {/* Group by - only show if column can be grouped and isn't already grouped */}
        {canGroup && !isGrouped && (
          <button
            onClick={() => {
              onGroupBy();
              onClose();
            }}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left',
              'transition-colors hover:bg-[var(--bg-hover)]'
            )}
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
              <path d="M2 3h12v2H2V3zm2 4h8v2H4V7zm2 4h4v2H6v-2z" />
            </svg>
            <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
              Group by
            </span>
          </button>
        )}

        {/* Ungroup - show on any column when there's an active grouping */}
        {hasActiveGrouping && (
          <button
            onClick={() => {
              onClearGrouping();
              onClose();
            }}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left',
              'transition-colors hover:bg-[var(--bg-hover)]'
            )}
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
              <path d="M3 3h10v2H3V3zm1 4h8v2H4V7zm1 4h6v2H5v-2z" />
              <path d="M13 1L15 3M15 1L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
            <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
              Ungroup
            </span>
          </button>
        )}

        {/* Separator before sizing options */}
        {((canPin || isPinned) || (canGroup || hasActiveGrouping)) && canResize && (
          <div className="my-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
        )}

        {/* Auto-size column */}
        {canResize && (
          <button
            onClick={() => {
              onAutoSizeColumn();
              onClose();
            }}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left',
              'transition-colors hover:bg-[var(--bg-hover)]'
            )}
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
              <path d="M2 7h4v2H2V7zm8 0h4v2h-4V7zM1 4l2 2-2 2V4zm14 0v4l-2-2 2-2z" />
            </svg>
            <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
              Auto-size column
            </span>
          </button>
        )}

        {/* Message when no options available */}
        {!canPin && !isPinned && !canGroup && !hasActiveGrouping && !canResize && (
          <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            No actions available
          </div>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// HEADER CELL COMPONENT
// =============================================================================

interface HeaderCellProps<TData extends GridRowData> {
  header: Header<TData, unknown>;
  enableResize: boolean;
  enableReorder: boolean;
  enablePinning: boolean;
  /** Pass sort state explicitly to trigger re-renders when sorting changes */
  sortDirection: false | 'asc' | 'desc';
  /** Current grouping state */
  grouping: GroupingState;
  /** Current density setting */
  currentDensity: GridDensity;
  /** Callback to set grouping */
  onGroupBy: (columnId: string) => void;
  /** Callback to clear grouping */
  onClearGrouping: () => void;
  /** Callback to pin column left */
  onPinLeft: (columnId: string) => void;
  /** Callback to pin column right */
  onPinRight: (columnId: string) => void;
  /** Callback to unpin column */
  onUnpin: (columnId: string) => void;
  /** Callback to auto-size column */
  onAutoSizeColumn: (columnId: string) => void;
  /** Callback to auto-size all columns */
  onAutoSizeAllColumns: () => void;
  /** Callback to change density */
  onDensityChange: (density: GridDensity) => void;
  /** Callback for column reorder via drag-drop */
  onReorder?: (sourceId: string, targetId: string, dropSide?: 'left' | 'right') => void;
  /** Calculated left offset for left-pinned columns */
  pinnedLeftOffset?: number;
  /** Calculated right offset for right-pinned columns */
  pinnedRightOffset?: number;
  /** Column size - passed explicitly to trigger re-renders on resize */
  columnSize: number;
}

const HeaderCell = memo(function HeaderCell<TData extends GridRowData>({
  header,
  enableResize,
  enableReorder,
  enablePinning,
  sortDirection,
  grouping,
  currentDensity,
  onGroupBy,
  onClearGrouping,
  onPinLeft,
  pinnedLeftOffset,
  pinnedRightOffset,
  onPinRight,
  onUnpin,
  onAutoSizeColumn,
  onAutoSizeAllColumns,
  onDensityChange,
  onReorder,
  columnSize,
}: HeaderCellProps<TData>) {
  const isResizing = header.column.getIsResizing();
  const resizeHandler = header.getResizeHandler();

  const canSort = header.column.getCanSort();
  // Use the passed-in sortDirection prop for rendering (memo-friendly)
  const isSorted = sortDirection;

  // Grouping state for this column
  const columnId = header.column.id;
  const colDef = header.column.columnDef;
  const enableGroupingMeta = (colDef as { enableGrouping?: boolean }).enableGrouping;
  const canGroup = header.column.getCanGroup?.() || enableGroupingMeta === true;
  const isGrouped = grouping.includes(columnId);

  // Pinning state for this column
  const isPinned = header.column.getIsPinned();
  const canPin = enablePinning && header.column.getCanPin?.() !== false;

  // Drag and drop state for reordering
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState<false | 'left' | 'right'>(false);
  const headerCellRef = useRef<HTMLDivElement>(null);

  // Clear drag over state when any drag operation ends globally
  // This handles cases where the drag is cancelled or dropped outside the grid
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setIsDragOver(false);
      setIsDragging(false);
    };

    document.addEventListener('dragend', handleGlobalDragEnd);
    return () => {
      document.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, []);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Track if we just finished resizing to prevent sort trigger on click
  const wasResizingRef = useRef(false);

  // Handle sort click - skip if we just finished resizing
  const handleSortClick = useCallback(() => {
    // Check if we just finished resizing - if so, skip sort and reset flag
    if (wasResizingRef.current) {
      wasResizingRef.current = false;
      return;
    }
    if (canSort) {
      // toggleSorting(undefined, false) - second param `false` means single-column sort
      // This clears any existing sort on other columns when sorting a new column
      header.column.toggleSorting(undefined, false);
    }
  }, [header.column, canSort]);

  // Handle right-click context menu
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Skip context menu for select, view, and action columns
    if (columnId === 'select' || columnId === '_view' || columnId === '_actions') return;
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, [columnId]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleGroupByClick = useCallback(() => {
    onGroupBy(columnId);
  }, [onGroupBy, columnId]);

  // Pinning handlers
  const handlePinLeft = useCallback(() => {
    onPinLeft(columnId);
  }, [onPinLeft, columnId]);

  const handlePinRight = useCallback(() => {
    onPinRight(columnId);
  }, [onPinRight, columnId]);

  const handleUnpin = useCallback(() => {
    onUnpin(columnId);
  }, [onUnpin, columnId]);

  const handleAutoSizeColumn = useCallback(() => {
    onAutoSizeColumn(columnId);
  }, [onAutoSizeColumn, columnId]);

  // Check if resize is enabled for this column
  const canResize = enableResize && header.column.getCanResize();

  // Drag handlers for column reordering
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!enableReorder || columnId === 'select' || columnId === '_view' || columnId === '_actions') {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);

    // Create custom drag image for better visual feedback
    if (headerCellRef.current) {
      const dragImage = headerCellRef.current.cloneNode(true) as HTMLElement;
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.left = '-1000px';
      dragImage.style.width = `${headerCellRef.current.offsetWidth}px`;
      dragImage.style.height = `${headerCellRef.current.offsetHeight}px`;
      dragImage.style.backgroundColor = 'var(--bg-surface)';
      dragImage.style.border = '2px solid var(--border-primary)';
      dragImage.style.borderRadius = '6px';
      dragImage.style.opacity = '0.9';
      dragImage.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);
      // Clean up after drag starts
      requestAnimationFrame(() => {
        document.body.removeChild(dragImage);
      });
    }

    setIsDragging(true);
  }, [enableReorder, columnId]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setIsDragOver(false); // Also clear drag over state when drag ends
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!enableReorder) return;
    // Don't allow dropping on select, view, or actions columns
    if (columnId === 'select' || columnId === '_view' || columnId === '_actions') return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Determine if we're on the left or right half of the header
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const side = e.clientX < midpoint ? 'left' : 'right';
    setIsDragOver(side);
  }, [enableReorder, columnId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only reset if we're actually leaving this element (not entering a child)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropSide = isDragOver;
    setIsDragOver(false);
    if (!enableReorder || !onReorder) return;
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== columnId) {
      // Pass the drop side information to help with positioning
      onReorder(sourceId, columnId, dropSide || 'right');
    }
  }, [enableReorder, onReorder, columnId, isDragOver]);

  // Get column label for context menu
  const headerContent = header.column.columnDef.header;
  const columnLabel = typeof headerContent === 'string' ? headerContent : columnId;

  // Get sort direction for ARIA attribute
  const ariaSortDirection = isSorted === 'asc' ? 'ascending' : isSorted === 'desc' ? 'descending' : 'none';

  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <div
        ref={headerCellRef}
        className={cn(
          'grid-header-cell group relative h-full',
          columnId === 'select' && 'grid-header-cell-select',
          columnId === '_view' && 'grid-header-cell-view',
          columnId === '_actions' && 'grid-header-cell-actions',
          canSort && columnId !== '_view' && 'cursor-pointer',
          isPinned && 'sticky z-20',
          enableReorder && columnId !== 'select' && columnId !== '_view' && columnId !== '_actions' && 'cursor-grab',
          isDragging && 'opacity-50 scale-95',
          isDragOver && 'bg-[var(--bg-hover)]'
        )}
        style={{
          width: columnSize,
          left: isPinned === 'left' ? pinnedLeftOffset : undefined,
          right: isPinned === 'right' ? pinnedRightOffset : undefined,
          // Background is handled by CSS classes for consistency
        }}
        onClick={(columnId !== 'select' && columnId !== '_view' && columnId !== '_actions') ? handleSortClick : undefined}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        // Drag-drop for column reordering
        draggable={enableReorder && columnId !== 'select' && columnId !== '_view' && columnId !== '_actions'}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="columnheader"
        aria-sort={canSort ? ariaSortDirection : undefined}
        aria-colindex={header.index + 1}
        data-hovered={isHovered && canSort ? 'true' : undefined}
        data-pinned={isPinned ? isPinned : undefined}
      >
      {/* Drop indicator - shows where column will be placed */}
      {isDragOver && (
        <div
          className="absolute top-0 bottom-0 w-1 z-30 pointer-events-none"
          style={{
            left: isDragOver === 'left' ? '-2px' : undefined,
            right: isDragOver === 'right' ? '-2px' : undefined,
            backgroundColor: 'var(--color-primary-500)',
            boxShadow: '0 0 8px var(--color-primary-500)',
          }}
        />
      )}
      {/* Pinned indicator - skip for select, view, and actions columns since they're always pinned */}
      {isPinned && columnId !== 'select' && columnId !== '_view' && columnId !== '_actions' && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-brand)' }}>
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            {isPinned === 'left' ? (
              <path d="M2 2v12h2V2H2z" />
            ) : (
              <path d="M12 2v12h2V2h-2z" />
            )}
          </svg>
        </span>
      )}

      {/* Header content - select, view, and actions columns render directly, others use wrapper */}
      {columnId === 'select' ? (
        // Select column: just the checkbox
        header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())
      ) : columnId === '_view' ? (
        // View column: empty header (no sort indicator, no content)
        null
      ) : columnId === '_actions' ? (
        // Actions column: grid menu button (3 dots) - aligned with row action buttons
        <button
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setContextMenu({ x: rect.left, y: rect.bottom + 4 });
          }}
          className="grid-actions-button"
          aria-label="Grid options"
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
      ) : (
        <div className={cn('flex-1 flex items-center gap-2 overflow-hidden', isPinned && 'pl-4')}>
          {/* Grouping indicator */}
          {isGrouped && (
            <span className="flex-shrink-0" style={{ color: 'var(--text-brand)' }}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 3h12v2H2V3zm2 4h8v2H4V7zm2 4h4v2H6v-2z" />
              </svg>
            </span>
          )}

          <span className="text-xs font-semibold uppercase tracking-wider truncate">
            {header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext())}
          </span>

          {/* Sort indicator */}
          {canSort && (
            <SortIndicator direction={isSorted} />
          )}

          {/* Filter indicator */}
          {header.column.getIsFiltered() && (
            <FilterIndicator />
          )}
        </div>
      )}

      {/* Resize handle */}
      {enableResize && header.column.getCanResize() && (
        <div
          className={cn(
            'grid-resize-handle absolute right-0 top-0 h-full w-2 cursor-col-resize',
            'hover:bg-[var(--grid-resize-handle)] transition-colors',
            isResizing && 'bg-[var(--grid-resize-handle-hover)]'
          )}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            // Set flag to prevent sort on mouseup/click
            wasResizingRef.current = true;
            resizeHandler(e);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            // Set flag to prevent sort on touch end
            wasResizingRef.current = true;
            resizeHandler(e);
          }}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
          draggable={false}
        />
      )}
      </div>

      {/* Context menu - rendered via portal to escape grid overflow */}
      {contextMenu && createPortal(
        columnId === '_actions' ? (
          // Grid options menu for the actions column header
          <GridOptionsMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hasActiveGrouping={grouping.length > 0}
            currentDensity={currentDensity}
            onClearGrouping={onClearGrouping}
            onAutoSizeAllColumns={onAutoSizeAllColumns}
            onDensityChange={onDensityChange}
            onClose={handleCloseContextMenu}
          />
        ) : (
          // Column-specific context menu for other columns
          <HeaderContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            columnId={columnId}
            columnLabel={columnLabel}
            canGroup={canGroup}
            isGrouped={isGrouped}
            hasActiveGrouping={grouping.length > 0}
            canPin={canPin}
            isPinned={isPinned}
            canResize={canResize}
            onGroupBy={handleGroupByClick}
            onClearGrouping={onClearGrouping}
            onPinLeft={handlePinLeft}
            onPinRight={handlePinRight}
            onUnpin={handleUnpin}
            onAutoSizeColumn={handleAutoSizeColumn}
            onClose={handleCloseContextMenu}
          />
        ),
        document.body
      )}
    </>
  );
}) as <TData extends GridRowData>(props: HeaderCellProps<TData>) => React.ReactElement;

// =============================================================================
// SORT INDICATOR
// =============================================================================

interface SortIndicatorProps {
  direction: false | 'asc' | 'desc';
}

const SortIndicator = memo(function SortIndicator({ direction }: SortIndicatorProps) {
  return (
    <span
      className="flex-shrink-0 transition-all duration-150"
      style={{
        opacity: direction ? 1 : 0.3,
        color: direction ? 'var(--text-brand)' : 'var(--text-muted)',
      }}
    >
      {direction === 'asc' ? (
        <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 2L10 8H2L6 2Z" />
        </svg>
      ) : direction === 'desc' ? (
        <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 10L2 4H10L6 10Z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 group-hover:opacity-60" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 2L9 5H3L6 2ZM6 10L3 7H9L6 10Z" />
        </svg>
      )}
    </span>
  );
});

// =============================================================================
// FILTER INDICATOR
// =============================================================================

const FilterIndicator = memo(function FilterIndicator() {
  return (
    <span className="flex-shrink-0 text-[var(--primary-400)]">
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
        <path d="M1 2H11L7 6.5V10L5 11V6.5L1 2Z" />
      </svg>
    </span>
  );
});

// =============================================================================
// SELECT ALL CHECKBOX
// =============================================================================

interface SelectAllCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const SelectAllCheckbox = memo(function SelectAllCheckbox({
  checked,
  indeterminate,
  onToggle,
  disabled,
}: SelectAllCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={() => {}} // Controlled component - state managed externally
      onClick={handleClick}
      disabled={disabled}
      aria-label="Select all rows"
    />
  );
});

// =============================================================================
// GRID HEADER COMPONENT
// =============================================================================

interface GridHeaderProps<TData extends GridRowData> {
  table: Table<TData>;
  enableColumnResize?: boolean;
  enableColumnReorder?: boolean;
  enableColumnPinning?: boolean;
  /** Pass sorting state explicitly to trigger re-renders when sorting changes */
  sorting?: SortingState;
  /** Pass grouping state explicitly to trigger re-renders when grouping changes */
  grouping?: GroupingState;
  /** Pass column pinning state explicitly to trigger re-renders when pinning changes */
  columnPinning?: { left?: string[]; right?: string[] };
  /** Pass column sizing state explicitly to trigger re-renders when sizing changes */
  columnSizing?: Record<string, number>;
  /** Pass column order state explicitly to trigger re-renders when order changes */
  columnOrder?: string[];
  /** Pass column visibility state explicitly to trigger re-renders when visibility changes */
  columnVisibility?: Record<string, boolean>;
  /** Reference to the scroll container for auto-scroll during drag */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  /** Callback to auto-size a column based on content */
  onAutoSizeColumn?: (columnId: string) => void;
  /** Callback to auto-size all columns */
  onAutoSizeAllColumns?: () => void;
  /** Current density setting */
  density?: GridDensity;
  /** Callback to change density */
  onDensityChange?: (density: GridDensity) => void;
  /** Width of the vertical scrollbar in the body - used to add spacer for scroll alignment */
  scrollbarWidth?: number;
}

export const GridHeader = memo(function GridHeader<TData extends GridRowData>({
  table,
  enableColumnResize = true,
  enableColumnReorder = false,
  enableColumnPinning = true,
  sorting: _sorting, // Used only to trigger re-renders
  grouping: _grouping, // Used only to trigger re-renders
  columnPinning: _columnPinning, // Used only to trigger re-renders
  columnSizing: _columnSizing, // Used only to trigger re-renders
  columnOrder: _columnOrder, // Used only to trigger re-renders
  columnVisibility: _columnVisibility, // Used only to trigger re-renders
  scrollContainerRef,
  onAutoSizeColumn,
  onAutoSizeAllColumns,
  density = 'comfortable',
  onDensityChange,
  scrollbarWidth = 0,
}: GridHeaderProps<TData>) {
  void _sorting; // Silence unused variable warning - prop exists for memo invalidation
  void _grouping; // Silence unused variable warning - prop exists for memo invalidation
  void _columnPinning; // Silence unused variable warning - prop exists for memo invalidation
  void _columnSizing; // Silence unused variable warning - prop exists for memo invalidation
  void _columnOrder; // Silence unused variable warning - prop exists for memo invalidation
  void _columnVisibility; // Silence unused variable warning - prop exists for memo invalidation
  const headerGroups = table.getHeaderGroups();
  const currentGrouping = table.getState().grouping;

  // Auto-scroll during column drag
  const autoScrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoScroll = useCallback((direction: 'left' | 'right') => {
    if (autoScrollIntervalRef.current) return; // Already scrolling
    if (!scrollContainerRef?.current) return;

    const scrollSpeed = 8; // pixels per frame
    autoScrollIntervalRef.current = setInterval(() => {
      if (!scrollContainerRef?.current) return;
      const scrollAmount = direction === 'left' ? -scrollSpeed : scrollSpeed;
      scrollContainerRef.current.scrollLeft += scrollAmount;
    }, 16); // ~60fps
  }, [scrollContainerRef]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  // Clean up auto-scroll on unmount
  useEffect(() => {
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };
  }, []);

  // Handle drag over the header row for auto-scroll
  const handleHeaderRowDragOver = useCallback((e: React.DragEvent) => {
    if (!enableColumnReorder || !scrollContainerRef?.current) return;

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const edgeThreshold = 80; // pixels from edge to trigger scroll

    const distanceFromLeft = e.clientX - containerRect.left;
    const distanceFromRight = containerRect.right - e.clientX;

    if (distanceFromLeft < edgeThreshold && container.scrollLeft > 0) {
      // Near left edge and can scroll left
      startAutoScroll('left');
    } else if (distanceFromRight < edgeThreshold &&
               container.scrollLeft < container.scrollWidth - container.clientWidth) {
      // Near right edge and can scroll right
      startAutoScroll('right');
    } else {
      stopAutoScroll();
    }
  }, [enableColumnReorder, scrollContainerRef, startAutoScroll, stopAutoScroll]);

  const handleHeaderRowDragLeave = useCallback(() => {
    stopAutoScroll();
  }, [stopAutoScroll]);

  const handleHeaderRowDragEnd = useCallback(() => {
    stopAutoScroll();
  }, [stopAutoScroll]);

  // Grouping handlers
  const handleGroupBy = useCallback((columnId: string) => {
    if (currentGrouping.includes(columnId)) {
      // Toggle off - remove from grouping
      table.setGrouping([]);
    } else {
      // Set as the single grouped column (server-side grouping only supports one)
      table.setGrouping([columnId]);
    }
  }, [table, currentGrouping]);

  const handleClearGrouping = useCallback(() => {
    table.setGrouping([]);
  }, [table]);

  // Pinning handlers - ensure 'select' column stays first in left pinned
  // Also reorder columns so pinned columns appear in correct visual position
  const handlePinLeft = useCallback((columnId: string) => {
    const currentPinning = table.getState().columnPinning;
    const currentOrder = table.getState().columnOrder;
    const allColumns = table.getAllLeafColumns().map(c => c.id);
    const order = currentOrder.length > 0 ? [...currentOrder] : [...allColumns];

    const leftPinned = currentPinning.left || [];
    const rightPinned = currentPinning.right || [];

    // Skip if already pinned left
    if (leftPinned.includes(columnId)) return;

    // Remove from right if it was there
    const newRight = rightPinned.filter(id => id !== columnId);

    // Build new left pinned array - ensure 'select' is always first
    const newLeft = [...leftPinned.filter(id => id !== columnId && id !== 'select')];
    if (leftPinned.includes('select') || order.includes('select')) {
      newLeft.unshift('select');
    }
    // Add the new column at the end of left pinned
    newLeft.push(columnId);

    // Reorder columns: move pinned column to position after existing left-pinned columns
    // Remove the column from current position
    const columnCurrentIndex = order.indexOf(columnId);
    if (columnCurrentIndex !== -1) {
      order.splice(columnCurrentIndex, 1);
    }

    // Find the correct insertion position - after all other left-pinned columns
    // We need to find where the last left-pinned column (excluding our new one) is
    let insertPosition = 0;
    const otherLeftPinned = newLeft.filter(id => id !== columnId);
    otherLeftPinned.forEach(pinnedId => {
      const idx = order.indexOf(pinnedId);
      if (idx !== -1 && idx >= insertPosition) {
        insertPosition = idx + 1;
      }
    });

    // Insert at the calculated position
    order.splice(insertPosition, 0, columnId);

    table.setColumnOrder(order);
    table.setColumnPinning({ left: newLeft, right: newRight });
  }, [table]);

  const handlePinRight = useCallback((columnId: string) => {
    const currentPinning = table.getState().columnPinning;
    const currentOrder = table.getState().columnOrder;
    const allColumns = table.getAllLeafColumns().map(c => c.id);
    const order = currentOrder.length > 0 ? [...currentOrder] : [...allColumns];

    const leftPinned = currentPinning.left || [];
    const rightPinned = currentPinning.right || [];

    // Skip if already pinned right
    if (rightPinned.includes(columnId)) return;

    // Remove from left if it was there (but keep 'select')
    const newLeft = leftPinned.filter(id => id !== columnId);

    // Add to right pinned
    const newRight = [...rightPinned.filter(id => id !== columnId), columnId];

    // Reorder: move the column to the end (before _actions if present)
    const columnCurrentIndex = order.indexOf(columnId);
    if (columnCurrentIndex !== -1) {
      order.splice(columnCurrentIndex, 1);
    }
    // Insert before _actions if it exists, otherwise at end
    const actionsIndex = order.indexOf('_actions');
    if (actionsIndex !== -1) {
      order.splice(actionsIndex, 0, columnId);
    } else {
      order.push(columnId);
    }

    table.setColumnOrder(order);
    table.setColumnPinning({ left: newLeft, right: newRight });
  }, [table]);

  const handleUnpin = useCallback((columnId: string) => {
    // Don't allow unpinning 'select' column
    if (columnId === 'select') return;

    const currentPinning = table.getState().columnPinning;
    const newLeft = (currentPinning.left || []).filter(id => id !== columnId);
    const newRight = (currentPinning.right || []).filter(id => id !== columnId);
    table.setColumnPinning({ left: newLeft, right: newRight });
    // Note: We don't reorder on unpin - user can manually reorder if needed
  }, [table]);

  // Auto-size column handler
  const handleAutoSizeColumn = useCallback((columnId: string) => {
    if (onAutoSizeColumn) {
      onAutoSizeColumn(columnId);
    }
  }, [onAutoSizeColumn]);

  // Auto-size all columns handler
  const handleAutoSizeAllColumns = useCallback(() => {
    if (onAutoSizeAllColumns) {
      onAutoSizeAllColumns();
    }
  }, [onAutoSizeAllColumns]);

  // Density change handler
  const handleDensityChange = useCallback((newDensity: GridDensity) => {
    if (onDensityChange) {
      onDensityChange(newDensity);
    }
  }, [onDensityChange]);

  // Column reorder handler - improved with drop side awareness
  const handleReorder = useCallback((sourceId: string, targetId: string, dropSide?: 'left' | 'right') => {
    const currentOrder = table.getState().columnOrder;
    const allColumns = table.getAllLeafColumns().map(c => c.id);

    // Use existing order or create from all columns
    const order = currentOrder.length > 0 ? [...currentOrder] : [...allColumns];

    const sourceIndex = order.indexOf(sourceId);
    let targetIndex = order.indexOf(targetId);

    if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
      // Remove source from its position
      order.splice(sourceIndex, 1);

      // Recalculate target index after removal (it may have shifted)
      targetIndex = order.indexOf(targetId);

      // Determine insertion position based on drop side
      // If dropping on right side, insert after the target
      const insertIndex = dropSide === 'right' ? targetIndex + 1 : targetIndex;

      // Insert at the calculated position
      order.splice(insertIndex, 0, sourceId);
      table.setColumnOrder(order);
    }
  }, [table]);

  // Calculate total width for proper horizontal scrolling
  const totalWidth = table.getVisibleLeafColumns().reduce((sum, col) => sum + col.getSize(), 0);

  // Pre-calculate offsets for all pinned columns
  const calculatePinnedOffsets = (headers: Header<TData, unknown>[]) => {
    const leftOffsets: Record<string, number> = {};
    const rightOffsets: Record<string, number> = {};

    // Calculate left offsets
    let leftOffset = 0;
    headers.forEach((h) => {
      if (h.column.getIsPinned() === 'left') {
        leftOffsets[h.id] = leftOffset;
        leftOffset += h.getSize();
      }
    });

    // Calculate right offsets (from right edge, in reverse order)
    let rightOffset = 0;
    [...headers].reverse().forEach((h) => {
      if (h.column.getIsPinned() === 'right') {
        rightOffsets[h.id] = rightOffset;
        rightOffset += h.getSize();
      }
    });

    return { leftOffsets, rightOffsets };
  };

  // For single header group (most common case), render directly
  // For multiple header groups, we'd need nested rows
  const headerGroup = headerGroups[0];
  if (!headerGroup) return null;

  // Sort headers: left-pinned first, then unpinned, then right-pinned
  const leftPinnedHeaders = headerGroup.headers.filter((h) => h.column.getIsPinned() === 'left');
  const unpinnedHeaders = headerGroup.headers.filter((h) => !h.column.getIsPinned());
  const rightPinnedHeaders = headerGroup.headers.filter((h) => h.column.getIsPinned() === 'right');
  const sortedHeaders = [...leftPinnedHeaders, ...unpinnedHeaders, ...rightPinnedHeaders];

  const { leftOffsets, rightOffsets } = calculatePinnedOffsets(sortedHeaders);

  return (
    <div
      className="grid-header-row"
      role="row"
      style={{ minWidth: totalWidth + scrollbarWidth }}
      onDragOver={handleHeaderRowDragOver}
      onDragLeave={handleHeaderRowDragLeave}
      onDragEnd={handleHeaderRowDragEnd}
      onDrop={handleHeaderRowDragEnd}
    >
      {sortedHeaders.map((header) => (
        <HeaderCell
          key={header.id}
          header={header}
          enableResize={enableColumnResize}
          enableReorder={enableColumnReorder}
          enablePinning={enableColumnPinning}
          sortDirection={header.column.getIsSorted()}
          grouping={currentGrouping}
          currentDensity={density}
          onGroupBy={handleGroupBy}
          onClearGrouping={handleClearGrouping}
          onPinLeft={handlePinLeft}
          onPinRight={handlePinRight}
          onUnpin={handleUnpin}
          onAutoSizeColumn={handleAutoSizeColumn}
          onAutoSizeAllColumns={handleAutoSizeAllColumns}
          onDensityChange={handleDensityChange}
          onReorder={handleReorder}
          pinnedLeftOffset={leftOffsets[header.id]}
          pinnedRightOffset={rightOffsets[header.id]}
          columnSize={header.getSize()}
        />
      ))}
      {/* Spacer element to account for body's vertical scrollbar width */}
      {scrollbarWidth > 0 && (
        <div
          className="grid-header-scrollbar-spacer"
          style={{
            width: scrollbarWidth,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}) as <TData extends GridRowData>(props: GridHeaderProps<TData>) => React.ReactElement;
