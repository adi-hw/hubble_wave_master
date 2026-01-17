/**
 * ColumnPickerModal - Advanced Column Visibility Manager
 *
 * A futuristic, user-friendly column picker designed to handle 100s of columns.
 *
 * Features:
 * - Instant search with fuzzy matching
 * - Category grouping by column type
 * - Virtual scrolling for performance
 * - Drag-and-drop column reordering
 * - Quick actions (show all, hide all, reset)
 * - Visual column type indicators
 * - Keyboard navigation support
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Table } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../utils/cn';
import type { GridRowData, GridColumnType, VisibilityState } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ColumnPickerModalProps<TData extends GridRowData> {
  table: Table<TData>;
  onClose: () => void;
  onColumnOrderChange?: (columnOrder: string[]) => void;
}

interface ColumnInfo {
  id: string;
  label: string;
  type: GridColumnType;
  isVisible: boolean;
  description?: string;
}

interface CategoryGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  columns: ColumnInfo[];
  visibleCount: number;
}

// =============================================================================
// COLUMN TYPE ICONS & COLORS
// =============================================================================

const getColumnTypeInfo = (type: GridColumnType): { icon: React.ReactNode; color: string; label: string } => {
  const typeConfig: Record<GridColumnType, { icon: React.ReactNode; color: string; label: string }> = {
    text: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h12v2H9v8H7V5H2V3z" />
        </svg>
      ),
      color: 'var(--color-info-500)',
      label: 'Text',
    },
    number: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 3h2v10H4V3zm6 0h2v10h-2V3zM2 7h4v2H2V7zm8 0h4v2h-4V7z" />
        </svg>
      ),
      color: 'var(--color-success-500)',
      label: 'Number',
    },
    currency: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1v2H6.5C5.12 3 4 4.12 4 5.5S5.12 8 6.5 8h3c.28 0 .5.22.5.5s-.22.5-.5.5H4v2h4v2h2v-2h1.5c1.38 0 2.5-1.12 2.5-2.5S12.88 6 11.5 6h-3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5H12V3H8V1z" />
        </svg>
      ),
      color: 'var(--color-success-500)',
      label: 'Currency',
    },
    percent: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 4a2 2 0 114 0 2 2 0 01-4 0zm6 8a2 2 0 114 0 2 2 0 01-4 0zM3 13L13 3l1 1-10 10-1-1z" />
        </svg>
      ),
      color: 'var(--color-warning-500)',
      label: 'Percent',
    },
    date: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 0v2H2v12h12V2h-2V0h-2v2H6V0H4zm8 6v8H4V6h8z" />
        </svg>
      ),
      color: 'var(--color-primary-500)',
      label: 'Date',
    },
    datetime: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 0v2H2v12h12V2h-2V0h-2v2H6V0H4zm7 10H8V7h1v2h2v1z" />
        </svg>
      ),
      color: 'var(--color-primary-500)',
      label: 'Date & Time',
    },
    time: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm1 8H7V4h2v5z" />
        </svg>
      ),
      color: 'var(--color-primary-500)',
      label: 'Time',
    },
    duration: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm1 2H7v4l3 2 1-1.5-2-1.5V5z" />
        </svg>
      ),
      color: 'var(--color-accent-500)',
      label: 'Duration',
    },
    boolean: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 3h10v10H3V3zm2 2v6h6V5H5zm1 1h4v4H6V6z" />
        </svg>
      ),
      color: 'var(--color-warning-500)',
      label: 'Boolean',
    },
    status: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="6" />
        </svg>
      ),
      color: 'var(--color-info-500)',
      label: 'Status',
    },
    priority: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 14V2l10 6-10 6z" />
        </svg>
      ),
      color: 'var(--color-danger-500)',
      label: 'Priority',
    },
    user: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="4" r="3" />
          <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6H2z" />
        </svg>
      ),
      color: 'var(--color-accent-500)',
      label: 'User',
    },
    reference: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 4h4v2H4v4h2v2H2V4h2zm6 6h4v2h-4v-2zm0-6h4v2h-4V4z" />
        </svg>
      ),
      color: 'var(--color-primary-500)',
      label: 'Reference',
    },
    tags: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2l6 1 6 6-5 5-6-6-1-6zm3 2a1 1 0 100 2 1 1 0 000-2z" />
        </svg>
      ),
      color: 'var(--color-accent-500)',
      label: 'Tags',
    },
    progress: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="6" width="14" height="4" rx="2" />
          <rect x="1" y="6" width="8" height="4" rx="2" opacity="0.5" />
        </svg>
      ),
      color: 'var(--color-success-500)',
      label: 'Progress',
    },
    image: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h12v10H2V3zm2 2v6l3-3 2 2 3-4v5H4V5z" />
        </svg>
      ),
      color: 'var(--color-warning-500)',
      label: 'Image',
    },
    actions: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      ),
      color: 'var(--text-muted)',
      label: 'Actions',
    },
    select: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 5h8l-4 6-4-6z" />
        </svg>
      ),
      color: 'var(--color-primary-500)',
      label: 'Select',
    },
    rating: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1l2 4 4.5.7-3.3 3.1.8 4.5L8 11l-4 2.3.8-4.5L1.5 5.7 6 5l2-4z" />
        </svg>
      ),
      color: 'var(--color-warning-500)',
      label: 'Rating',
    },
    email: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h12v10H2V3zm1 1v8h10V4H3zm5 4l5-3v1l-5 3-5-3V5l5 3z" />
        </svg>
      ),
      color: 'var(--color-info-500)',
      label: 'Email',
    },
    url: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.5 8.5a3 3 0 014.2 0l1.8 1.8a3 3 0 01-4.2 4.2l-.9-.9.7-.7.9.9a2 2 0 002.8-2.8l-1.8-1.8a2 2 0 00-2.8 0l-.7-.7zM9.5 7.5a3 3 0 00-4.2 0l-1.8 1.8a3 3 0 004.2 4.2l.9-.9-.7-.7-.9.9a2 2 0 01-2.8-2.8l1.8-1.8a2 2 0 012.8 0l.7-.7z" />
        </svg>
      ),
      color: 'var(--color-accent-500)',
      label: 'URL',
    },
    phone: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 1h8a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm4 12a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
      ),
      color: 'var(--color-success-500)',
      label: 'Phone',
    },
    custom: {
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1 2-4z" />
        </svg>
      ),
      color: 'var(--text-muted)',
      label: 'Custom',
    },
  };

  return typeConfig[type] || typeConfig.custom;
};

// Category order for grouping
const categoryOrder: GridColumnType[] = [
  'text',
  'number',
  'currency',
  'percent',
  'date',
  'datetime',
  'time',
  'duration',
  'boolean',
  'status',
  'priority',
  'user',
  'reference',
  'tags',
  'progress',
  'image',
  'select',
  'rating',
  'email',
  'url',
  'phone',
  'actions',
  'custom',
];

// =============================================================================
// ICONS
// =============================================================================

const SearchIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7" cy="7" r="5" />
    <path d="M11 11L14 14" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4L12 12M12 4L4 12" strokeLinecap="round" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <ellipse cx="8" cy="8" rx="6" ry="4" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" />
    <path d="M3 3L13 13" strokeLinecap="round" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={cn('w-4 h-4 transition-transform duration-200', expanded && 'rotate-90')}
    viewBox="0 0 16 16"
    fill="currentColor"
  >
    <path d="M6 4l4 4-4 4V4z" />
  </svg>
);

const GripIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" opacity="0.4">
    <circle cx="5" cy="4" r="1.5" />
    <circle cx="11" cy="4" r="1.5" />
    <circle cx="5" cy="8" r="1.5" />
    <circle cx="11" cy="8" r="1.5" />
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="11" cy="12" r="1.5" />
  </svg>
);

const ReorderIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 4h10M3 8h10M3 12h10" strokeLinecap="round" />
  </svg>
);

// =============================================================================
// DRAGGABLE COLUMN ROW COMPONENT
// =============================================================================

interface DraggableColumnRowProps {
  column: ColumnInfo;
  index: number;
  onToggle: (columnId: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragOver: boolean;
}

function DraggableColumnRow({
  column,
  index,
  onToggle,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDragOver,
}: DraggableColumnRowProps) {
  const typeInfo = getColumnTypeInfo(column.type);

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer',
        'transition-all duration-150',
        'hover:bg-hover',
        isDragging && 'opacity-50 scale-95',
        isDragOver && 'border-t-2 border-primary/40'
      )}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(index);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onToggle(column.id)}
      role="checkbox"
      aria-checked={column.isVisible}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(column.id);
        }
      }}
    >
      {/* Drag handle */}
      <div
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <GripIcon />
      </div>

      {/* Checkbox */}
      <div
        className={cn(
          'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
          'border-2 transition-all duration-150',
          column.isVisible
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-border text-muted-foreground'
        )}
      >
        {column.isVisible && (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Type indicator */}
      <div
        className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center"
        style={{
          backgroundColor: `color-mix(in srgb, ${typeInfo.color} 18%, transparent)`,
          color: typeInfo.color,
        }}
        title={typeInfo.label}
      >
        {typeInfo.icon}
      </div>

      {/* Column label */}
      <span
        className={cn(
          'flex-1 text-sm truncate',
          column.isVisible ? 'text-foreground' : 'text-muted-foreground opacity-60'
        )}
      >
        {column.label}
      </span>

      {/* Visibility indicator */}
      <div className={cn('flex-shrink-0', column.isVisible ? 'text-primary' : 'text-muted-foreground')}>
        {column.isVisible ? <EyeIcon /> : <EyeOffIcon />}
      </div>
    </div>
  );
}

// =============================================================================
// SIMPLE COLUMN ROW (for category view - no drag)
// =============================================================================

interface ColumnRowProps {
  column: ColumnInfo;
  onToggle: (columnId: string) => void;
}

function ColumnRow({ column, onToggle }: ColumnRowProps) {
  const typeInfo = getColumnTypeInfo(column.type);

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer',
        'transition-all duration-150',
        'hover:bg-hover'
      )}
      onClick={() => onToggle(column.id)}
      role="checkbox"
      aria-checked={column.isVisible}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(column.id);
        }
      }}
    >
      {/* Checkbox */}
      <div
        className={cn(
          'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
          'border-2 transition-all duration-150',
          column.isVisible
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-border text-muted-foreground'
        )}
      >
        {column.isVisible && (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Type indicator */}
      <div
        className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center"
        style={{
          backgroundColor: `color-mix(in srgb, ${typeInfo.color} 18%, transparent)`,
          color: typeInfo.color,
        }}
        title={typeInfo.label}
      >
        {typeInfo.icon}
      </div>

      {/* Column label */}
      <span
        className={cn(
          'flex-1 text-sm truncate',
          column.isVisible ? 'text-foreground' : 'text-muted-foreground opacity-60'
        )}
      >
        {column.label}
      </span>

      {/* Visibility indicator */}
      <div className={cn('flex-shrink-0', column.isVisible ? 'text-primary' : 'text-muted-foreground')}>
        {column.isVisible ? <EyeIcon /> : <EyeOffIcon />}
      </div>
    </div>
  );
}

// =============================================================================
// CATEGORY SECTION COMPONENT
// =============================================================================

interface CategorySectionProps {
  category: CategoryGroup;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleColumn: (columnId: string) => void;
  onToggleAll: (visible: boolean) => void;
}

function CategorySection({
  category,
  isExpanded,
  onToggleExpand,
  onToggleColumn,
  onToggleAll,
}: CategorySectionProps) {
  const visibleCount = category.columns.filter((c) => c.isVisible).length;
  const totalCount = category.columns.length;

  if (totalCount === 0) return null;

  const allVisible = visibleCount === totalCount;
  const someVisible = visibleCount > 0 && visibleCount < totalCount;

  return (
    <div className="mb-2">
      {/* Category header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer',
          'transition-colors duration-150',
          'hover:bg-hover'
        )}
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <ChevronIcon expanded={isExpanded} />

        {/* Category icon */}
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{
            backgroundColor: `color-mix(in srgb, ${getColumnTypeInfo(category.id as GridColumnType).color} 14%, transparent)`,
            color: getColumnTypeInfo(category.id as GridColumnType).color,
          }}
        >
          {category.icon}
        </div>

        {/* Category label */}
        <span className="flex-1 text-sm font-medium text-foreground">
          {category.label}
        </span>

        {/* Count badge */}
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {visibleCount}/{totalCount}
        </span>

        {/* Toggle all button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleAll(!allVisible);
          }}
          title={allVisible ? 'Hide all in category' : 'Show all in category'}
          className={cn(
            'btn-ghost btn-icon btn-xs',
            allVisible && 'text-primary',
            someVisible && !allVisible && 'text-foreground',
            !someVisible && !allVisible && 'text-muted-foreground'
          )}
        >
          {allVisible ? <EyeIcon /> : someVisible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>

      {/* Column list */}
      {isExpanded && (
        <div className="ml-6 mt-1 space-y-0.5">
          {category.columns.map((column) => (
            <ColumnRow key={column.id} column={column} onToggle={onToggleColumn} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FLAT COLUMN LIST WITH DRAG AND DROP
// =============================================================================

interface FlatColumnListProps {
  columns: ColumnInfo[];
  onToggle: (columnId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  parentRef: React.RefObject<HTMLDivElement | null>;
  enableDrag: boolean;
}

function FlatColumnList({ columns, onToggle, onReorder, parentRef, enableDrag }: FlatColumnListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      onReorder(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, onReorder]);

  // Use virtualization for large lists
  const rowVirtualizer = useVirtualizer({
    count: columns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  // For small lists (< 50), render without virtualization for better drag experience
  if (columns.length < 50 && enableDrag) {
    return (
      <div className="space-y-0.5">
        {columns.map((column, index) => (
          <DraggableColumnRow
            key={column.id}
            column={column}
            index={index}
            onToggle={onToggle}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            isDragging={dragIndex === index}
            isDragOver={dragOverIndex === index && dragIndex !== index}
          />
        ))}
      </div>
    );
  }

  // For larger lists or when drag is disabled, use virtualization
  return (
    <div
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const column = columns[virtualRow.index];
        return (
          <div
            key={column.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ColumnRow column={column} onToggle={onToggle} />
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ColumnPickerModal<TData extends GridRowData>({
  table,
  onClose,
  onColumnOrderChange,
}: ColumnPickerModalProps<TData>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'categories' | 'reorder'>('categories');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set(categoryOrder));
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Get current state from table
  const currentVisibility = table.getState().columnVisibility;
  const currentColumnOrder = table.getState().columnOrder;

  // Get all columns with current visibility state, respecting column order
  const allColumns = useMemo(() => {
    const leafColumns = table.getAllLeafColumns().filter((col) => col.id !== 'select' && col.id !== '_actions');

    // If there's a custom column order, sort by it
    const orderedColumns =
      currentColumnOrder.length > 0
        ? [...leafColumns].sort((a, b) => {
            const aIndex = currentColumnOrder.indexOf(a.id);
            const bIndex = currentColumnOrder.indexOf(b.id);
            // If not in order array, put at end
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          })
        : leafColumns;

    return orderedColumns.map((col): ColumnInfo => {
      const columnDef = col.columnDef as { meta?: { type?: GridColumnType; description?: string } };
      const header = col.columnDef.header;
      const isVisible = currentVisibility[col.id] !== false;
      return {
        id: col.id,
        label: typeof header === 'string' ? header : col.id,
        type: columnDef.meta?.type || 'text',
        isVisible,
        description: columnDef.meta?.description,
      };
    });
  }, [table, currentVisibility, currentColumnOrder]);

  // Filter columns by search
  const filteredColumns = useMemo(() => {
    let result = allColumns;

    // In reorder mode, only show visible columns
    if (viewMode === 'reorder' && !searchQuery) {
      result = result.filter((col) => col.isVisible);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (col) =>
          col.label.toLowerCase().includes(query) ||
          col.id.toLowerCase().includes(query) ||
          col.type.toLowerCase().includes(query)
      );
    }

    return result;
  }, [allColumns, searchQuery, viewMode]);

  // Group columns by type (only for category view)
  const categoryGroups = useMemo((): CategoryGroup[] => {
    const groups = new Map<string, ColumnInfo[]>();

    for (const col of filteredColumns) {
      const type = col.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(col);
    }

    return categoryOrder
      .filter((type) => groups.has(type))
      .map((type) => {
        const columns = groups.get(type)!;
        const typeInfo = getColumnTypeInfo(type);
        return {
          id: type,
          label: typeInfo.label,
          icon: typeInfo.icon,
          columns,
          visibleCount: columns.filter((c) => c.isVisible).length,
        };
      });
  }, [filteredColumns]);

  // Stats
  const visibleCount = allColumns.filter((c) => c.isVisible).length;
  const totalCount = allColumns.length;

  // Handlers
  const handleToggleColumn = useCallback(
    (columnId: string) => {
      const column = table.getColumn(columnId);
      if (column) {
        column.toggleVisibility();
      }
    },
    [table]
  );

  const handleToggleCategoryColumns = useCallback(
    (categoryId: string, visible: boolean) => {
      const category = categoryGroups.find((g) => g.id === categoryId);
      if (category) {
        const newVisibility: VisibilityState = { ...currentVisibility };
        category.columns.forEach((col) => {
          newVisibility[col.id] = visible;
        });
        table.setColumnVisibility(newVisibility);
      }
    },
    [table, categoryGroups, currentVisibility]
  );

  const handleShowAll = useCallback(() => {
    table.toggleAllColumnsVisible(true);
  }, [table]);

  const handleHideAll = useCallback(() => {
    table.toggleAllColumnsVisible(false);
  }, [table]);

  const handleToggleCategoryExpand = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      // Get the visible columns being reordered
      const visibleColumns = allColumns.filter((col) => col.isVisible);

      // Create new visible order
      const newVisibleOrder = [...visibleColumns.map((c) => c.id)];
      const [removed] = newVisibleOrder.splice(fromIndex, 1);
      newVisibleOrder.splice(toIndex, 0, removed);

      // Merge back with hidden columns (hidden columns keep their relative positions)
      const hiddenColumns = allColumns.filter((col) => !col.isVisible).map((c) => c.id);
      const newOrder = [...newVisibleOrder, ...hiddenColumns];

      // Update table column order
      table.setColumnOrder(newOrder);

      // Notify parent if callback provided
      onColumnOrderChange?.(newOrder);
    },
    [allColumns, table, onColumnOrderChange]
  );

  // Determine if searching
  const isSearching = searchQuery.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg',
          'rounded-2xl overflow-hidden',
          'shadow-2xl',
          'flex flex-col',
          'bg-card border border-border'
        )}
        style={{
          maxHeight: 'min(80vh, 700px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="2" y="2" width="6" height="16" rx="1" />
                  <rect x="10" y="2" width="8" height="16" rx="1" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Column Visibility
                </h2>
                <p className="text-sm text-muted-foreground">
                  {visibleCount} of {totalCount} columns visible
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-ghost btn-icon btn-sm"
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted border border-border text-muted-foreground">
            <SearchIcon />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search columns..."
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="btn-ghost btn-icon btn-xs"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 2L10 10M10 2L2 10" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Quick actions bar */}
        <div className="flex-shrink-0 flex items-center gap-2 px-5 py-3 border-b border-border">
          <button
            onClick={handleShowAll}
            className="btn-secondary btn-xs gap-1.5"
          >
            <EyeIcon />
            Show All
          </button>
          <button
            onClick={handleHideAll}
            className="btn-secondary btn-xs gap-1.5"
          >
            <EyeOffIcon />
            Hide All
          </button>

          <div className="flex-1" />

          {/* View mode toggle */}
          {!isSearching && (
            <button
              onClick={() => setViewMode(viewMode === 'categories' ? 'reorder' : 'categories')}
              className={cn(
                'btn-secondary btn-xs gap-1.5',
                viewMode === 'reorder' && 'bg-primary/10 text-primary border-primary/30'
              )}
              title={viewMode === 'categories' ? 'Switch to reorder mode' : 'Switch to category view'}
            >
              <ReorderIcon />
              {viewMode === 'reorder' ? 'Reordering' : 'Reorder'}
            </button>
          )}

          <span className="text-xs text-muted-foreground">
            {filteredColumns.length} {filteredColumns.length === 1 ? 'column' : 'columns'}
            {searchQuery && ' found'}
          </span>
        </div>

        {/* Column list */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
          {filteredColumns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="w-12 h-12 mb-3 text-muted-foreground"
                viewBox="0 0 48 48"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="20" cy="20" r="14" />
                <path d="M30 30L42 42" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium text-foreground">
                No columns found
              </p>
              <p className="text-xs mt-1 text-muted-foreground">
                Try a different search term
              </p>
            </div>
          ) : isSearching || viewMode === 'reorder' ? (
            <>
              {viewMode === 'reorder' && !isSearching && (
                <div
                  className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-primary/10 text-primary"
                >
                  <GripIcon />
                  <span className="text-xs">
                    Drag to reorder visible columns ({filteredColumns.length} of {totalCount})
                  </span>
                </div>
              )}
              <FlatColumnList
                columns={filteredColumns}
                onToggle={handleToggleColumn}
                onReorder={handleReorder}
                parentRef={scrollRef}
                enableDrag={viewMode === 'reorder' && !isSearching}
              />
            </>
          ) : (
            categoryGroups.map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                isExpanded={expandedCategories.has(category.id)}
                onToggleExpand={() => handleToggleCategoryExpand(category.id)}
                onToggleColumn={handleToggleColumn}
                onToggleAll={(visible) => handleToggleCategoryColumns(category.id, visible)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-t border-border bg-muted">
          <div className="flex items-center gap-2">
            {/* Progress bar */}
            <div className="w-24 h-1.5 rounded-full overflow-hidden bg-border">
              <div
                className="h-full rounded-full transition-all duration-300 bg-primary"
                style={{
                  width: `${totalCount > 0 ? (visibleCount / totalCount) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {totalCount > 0 ? Math.round((visibleCount / totalCount) * 100) : 0}% visible
            </span>
          </div>
          <button
            onClick={onClose}
            className="btn-primary btn-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
