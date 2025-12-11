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
    <div className="flex items-center justify-between px-4 py-2.5 bg-primary-600 text-white animate-slide-down">
      {/* Left side - Selection info */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClearSelection}
          className="p-1.5 hover:bg-primary-500 rounded-lg transition-colors"
          title="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">
          {selectedCount} of {totalCount} selected
        </span>
      </div>

      {/* Right side - Bulk actions */}
      <div className="flex items-center gap-2">
        {onBulkUpdate && (
          <button
            type="button"
            onClick={onBulkUpdate}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
          >
            <Edit3 className="h-4 w-4" />
            <span>Update</span>
          </button>
        )}

        {onBulkExport && (
          <button
            type="button"
            onClick={onBulkExport}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        )}

        {onBulkDelete && (
          <button
            type="button"
            onClick={onBulkDelete}
            className="flex items-center gap-2 px-3 py-1.5 bg-danger-500/80 hover:bg-danger-500 rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 className="h-4 w-4" />
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
