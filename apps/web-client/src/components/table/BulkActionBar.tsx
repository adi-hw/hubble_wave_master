/**
 * BulkActionBar Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready bulk action bar with:
 * - Theme-aware styling using Tailwind CSS
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 */

import React from 'react';
import { X, Edit3, Trash2, Download } from 'lucide-react';
import { TableColumn } from './types';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onBulkUpdate?: () => void;
  onBulkDelete?: () => void;
  onBulkExport?: () => void;
  columns?: TableColumn[];
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  onClearSelection,
  onBulkUpdate,
  onBulkDelete,
  onBulkExport,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 animate-slide-down bg-primary text-primary-foreground"
      role="toolbar"
      aria-label={`Bulk actions for ${selectedCount} selected items`}
    >
      {/* Left side - Selection info */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClearSelection}
          className="p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center bg-primary-foreground/10 hover:bg-primary-foreground/20"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="text-sm font-medium">
          {selectedCount} of {totalCount} selected
        </span>
      </div>

      {/* Right side - Bulk actions */}
      <div className="flex items-center gap-2" role="group" aria-label="Bulk action buttons">
        {onBulkUpdate && (
          <button
            type="button"
            onClick={onBulkUpdate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] bg-primary-foreground/10 hover:bg-primary-foreground/20"
          >
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            <span>Update</span>
          </button>
        )}

        {onBulkExport && (
          <button
            type="button"
            onClick={onBulkExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] bg-primary-foreground/10 hover:bg-primary-foreground/20"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Export</span>
          </button>
        )}

        {onBulkDelete && (
          <button
            type="button"
            onClick={onBulkDelete}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Delete</span>
          </button>
        )}
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-down {
          animation: slide-down 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};
