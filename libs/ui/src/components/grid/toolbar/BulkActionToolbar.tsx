/**
 * BulkActionToolbar - Toolbar displayed when rows are selected
 *
 * Provides:
 * - Selection count display
 * - Bulk action buttons (edit, delete, export, etc.)
 * - Clear selection button
 */

import React, { memo, useCallback, useState } from 'react';
import { cn } from '../utils/cn';
import type { GridRowData, BulkAction } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface BulkActionToolbarProps<TData extends GridRowData> {
  /** Number of selected rows */
  selectedCount: number;
  /** Selected row data */
  selectedRows: TData[];
  /** Available bulk actions */
  bulkActions?: BulkAction<TData>[];
  /** Callback to clear selection */
  onClearSelection: () => void;
  /** Custom class name */
  className?: string;
}

// =============================================================================
// CONFIRMATION DIALOG
// =============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = memo(function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative z-10 bg-card border border-border rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="text-sm text-muted-foreground mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              variant === 'danger' && 'bg-danger text-danger-foreground hover:bg-danger/90',
              variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
              variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

// =============================================================================
// DEFAULT ICONS
// =============================================================================

const TrashIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 4h12M5.5 4V2.5a1 1 0 011-1h3a1 1 0 011 1V4M13 4v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 13V4" />
    <path d="M6.5 7v5M9.5 7v5" strokeLinecap="round" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M11.5 2.5l2 2M2 14l1-4L12 1l2 2L5 12l-4 1z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ExportIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 2V10M8 2L5 5M8 2L11 5" />
    <path d="M2 10V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V10" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4L12 12M12 4L4 12" strokeLinecap="round" />
  </svg>
);

// =============================================================================
// BULK ACTION TOOLBAR
// =============================================================================

export const BulkActionToolbar = memo(function BulkActionToolbar<TData extends GridRowData>({
  selectedCount,
  selectedRows,
  bulkActions = [],
  onClearSelection,
  className,
}: BulkActionToolbarProps<TData>) {
  const [confirmAction, setConfirmAction] = useState<BulkAction<TData> | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Handle action click
  const handleActionClick = useCallback((action: BulkAction<TData>) => {
    if (action.requiresConfirmation) {
      setConfirmAction(action);
    } else {
      executeAction(action);
    }
  }, []);

  // Execute the action
  const executeAction = useCallback(async (action: BulkAction<TData>) => {
    setIsExecuting(true);
    try {
      await action.onAction(selectedRows);
    } finally {
      setIsExecuting(false);
      setConfirmAction(null);
    }
  }, [selectedRows]);

  // Handle confirmation
  const handleConfirm = useCallback(() => {
    if (confirmAction) {
      executeAction(confirmAction);
    }
  }, [confirmAction, executeAction]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setConfirmAction(null);
  }, []);

  // Get icon for action
  const getActionIcon = (action: BulkAction<TData>) => {
    if (action.icon) return action.icon;

    // Default icons based on action id
    if (action.id === 'delete' || action.id === 'remove') return <TrashIcon />;
    if (action.id === 'edit' || action.id === 'update') return <EditIcon />;
    if (action.id === 'export') return <ExportIcon />;

    return null;
  };

  // Get button variant classes
  const getVariantClasses = (variant?: 'primary' | 'secondary' | 'danger') => {
    switch (variant) {
      case 'danger':
        return 'text-danger-text hover:bg-danger/10';
      case 'primary':
        return 'text-primary hover:bg-primary/10';
      default:
        return 'text-foreground hover:bg-muted';
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-2 border-b',
          'bg-primary/5 border-primary/20',
          className
        )}
        role="toolbar"
        aria-label="Bulk actions toolbar"
      >
        {/* Selection count */}
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {selectedCount > 99 ? '99+' : selectedCount}
          </span>
          <span className="text-sm font-medium text-foreground">
            {selectedCount === 1 ? '1 row selected' : `${selectedCount} rows selected`}
          </span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Bulk actions */}
        <div className="flex items-center gap-1">
          {bulkActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              disabled={isExecuting}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                'border border-transparent',
                getVariantClasses(action.variant),
                isExecuting && 'opacity-50 cursor-not-allowed'
              )}
              title={action.label}
            >
              {getActionIcon(action)}
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear selection */}
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <CloseIcon />
          <span>Clear</span>
        </button>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={`Confirm ${confirmAction?.label ?? 'Action'}`}
        message={confirmAction?.confirmationMessage ?? `Are you sure you want to ${confirmAction?.label.toLowerCase()} ${selectedCount} ${selectedCount === 1 ? 'row' : 'rows'}?`}
        confirmLabel={confirmAction?.label}
        variant={confirmAction?.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}) as <TData extends GridRowData>(props: BulkActionToolbarProps<TData>) => React.ReactElement | null;

export default BulkActionToolbar;
