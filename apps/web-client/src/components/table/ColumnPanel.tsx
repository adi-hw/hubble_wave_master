import React, { useState, useCallback, useMemo } from 'react';
import {
  GripVertical,
  Eye,
  EyeOff,
  X,
  Check,
  RotateCcw,
  Search,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  Link2,
  FileText,
  Clock,
  Mail,
  Phone,
  Globe,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { TableColumn } from './types';

interface ColumnPanelProps {
  columns: TableColumn[];
  onChange: (cols: TableColumn[]) => void;
  onClose: () => void;
}

// Get icon for column type
const getTypeIcon = (type?: string) => {
  const t = type?.toLowerCase() || 'string';
  switch (t) {
    case 'integer':
    case 'long':
    case 'decimal':
    case 'number':
    case 'currency':
    case 'percent':
      return Hash;
    case 'date':
      return Calendar;
    case 'datetime':
    case 'time':
      return Clock;
    case 'boolean':
      return ToggleLeft;
    case 'choice':
    case 'multi_choice':
    case 'tags':
      return List;
    case 'reference':
    case 'multi_reference':
    case 'user_reference':
      return Link2;
    case 'text':
    case 'rich_text':
      return FileText;
    case 'email':
      return Mail;
    case 'phone':
      return Phone;
    case 'url':
      return Globe;
    default:
      return Type;
  }
};

// Get color for column type
const getTypeColor = (type?: string) => {
  const t = type?.toLowerCase() || 'string';
  switch (t) {
    case 'integer':
    case 'long':
    case 'decimal':
    case 'number':
    case 'currency':
    case 'percent':
      return 'text-blue-500 bg-blue-50';
    case 'date':
    case 'datetime':
    case 'time':
      return 'text-purple-500 bg-purple-50';
    case 'boolean':
      return 'text-green-500 bg-green-50';
    case 'choice':
    case 'multi_choice':
    case 'tags':
      return 'text-amber-500 bg-amber-50';
    case 'reference':
    case 'multi_reference':
    case 'user_reference':
      return 'text-pink-500 bg-pink-50';
    default:
      return 'text-slate-500 bg-slate-100';
  }
};

export const ColumnPanel: React.FC<ColumnPanelProps> = ({
  columns,
  onChange,
  onClose,
}) => {
  const [localColumns, setLocalColumns] = useState<TableColumn[]>(columns);
  const [search, setSearch] = useState('');
  const [draggedCode, setDraggedCode] = useState<string | null>(null);
  const [dragOverCode, setDragOverCode] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(true);

  const visibleColumns = useMemo(() => localColumns.filter((c) => !c.hidden), [localColumns]);
  const hiddenColumns = useMemo(() => localColumns.filter((c) => c.hidden), [localColumns]);
  const visibleCount = visibleColumns.length;
  const totalCount = localColumns.length;

  const filterMatches = useCallback(
    (col: TableColumn) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return col.label.toLowerCase().includes(term) || col.code.toLowerCase().includes(term);
    },
    [search]
  );

  const filteredVisible = useMemo(() => visibleColumns.filter(filterMatches), [visibleColumns, filterMatches]);
  const filteredHidden = useMemo(() => hiddenColumns.filter(filterMatches), [hiddenColumns, filterMatches]);

  const toggleVisibility = (code: string) => {
    setLocalColumns((prev) =>
      prev.map((c) => (c.code === code ? { ...c, hidden: !c.hidden } : c))
    );
  };

  const showAll = () => setLocalColumns((prev) => prev.map((c) => ({ ...c, hidden: false })));
  const hideAll = () => setLocalColumns((prev) => prev.map((c, i) => ({ ...c, hidden: i > 0 })));
  const reset = () => {
    setLocalColumns(columns);
    setSearch('');
  };

  // Check if there are changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(localColumns) !== JSON.stringify(columns);
  }, [localColumns, columns]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, code: string) => {
    setDraggedCode(code);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', code);
    // Add drag image styling
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragOver = (e: React.DragEvent, code: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedCode && draggedCode !== code) setDragOverCode(code);
  };

  const handleDrop = (e: React.DragEvent, targetCode: string) => {
    e.preventDefault();
    if (draggedCode && draggedCode !== targetCode) {
      setLocalColumns((prev) => {
        const newColumns = [...prev];
        const draggedIndex = newColumns.findIndex((c) => c.code === draggedCode);
        const targetIndex = newColumns.findIndex((c) => c.code === targetCode);
        if (draggedIndex !== -1 && targetIndex !== -1) {
          const [draggedItem] = newColumns.splice(draggedIndex, 1);
          newColumns.splice(targetIndex, 0, draggedItem);
        }
        return newColumns;
      });
    }
    setDraggedCode(null);
    setDragOverCode(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedCode(null);
    setDragOverCode(null);
  };

  const apply = () => {
    onChange(localColumns);
    onClose();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
            <SlidersHorizontal className="h-4 w-4 text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Manage Columns</h3>
            <p className="text-xs text-slate-500">{visibleCount} of {totalCount} visible</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search & Quick Actions */}
      <div className="px-4 py-3 space-y-3 border-b border-slate-100 bg-slate-50/50">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns..."
            className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={showAll}
            className="flex-1 h-8 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-colors"
          >
            Show all
          </button>
          <button
            type="button"
            onClick={hideAll}
            className="flex-1 h-8 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-colors"
          >
            Hide all
          </button>
          <button
            type="button"
            onClick={reset}
            className="h-8 px-3 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
            title="Reset to original"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Visible Columns */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Visible Columns
              </span>
              <span className="text-xs text-slate-400">({filteredVisible.length})</span>
            </div>
            <span className="text-[10px] text-slate-400 italic">Drag to reorder</span>
          </div>

          <div className="space-y-1.5">
            {filteredVisible.length === 0 ? (
              <div className="text-center py-8">
                <EyeOff className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No visible columns</p>
                {search && <p className="text-xs text-slate-400 mt-1">Try adjusting your search</p>}
              </div>
            ) : (
              filteredVisible.map((col, index) => {
                const TypeIcon = getTypeIcon(col.type);
                const typeColor = getTypeColor(col.type);
                const isDragOver = dragOverCode === col.code;
                const isDragging = draggedCode === col.code;

                return (
                  <div
                    key={col.code}
                    draggable
                    onDragStart={(e) => handleDragStart(e, col.code)}
                    onDragOver={(e) => handleDragOver(e, col.code)}
                    onDragLeave={() => setDragOverCode(null)}
                    onDrop={(e) => handleDrop(e, col.code)}
                    onDragEnd={handleDragEnd}
                    className={`
                      group flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-white cursor-grab active:cursor-grabbing
                      transition-all duration-150
                      ${isDragOver ? 'border-primary-400 bg-primary-50 shadow-sm scale-[1.02]' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}
                      ${isDragging ? 'opacity-50 scale-95' : ''}
                    `}
                  >
                    {/* Drag Handle */}
                    <div className="text-slate-300 group-hover:text-slate-400 transition-colors">
                      <GripVertical className="h-4 w-4" />
                    </div>

                    {/* Order Number */}
                    <span className="w-5 h-5 flex items-center justify-center text-[10px] font-medium text-slate-400 bg-slate-100 rounded">
                      {index + 1}
                    </span>

                    {/* Type Icon */}
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${typeColor}`}>
                      <TypeIcon className="h-3.5 w-3.5" />
                    </div>

                    {/* Label & Code */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{col.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{col.code}</p>
                    </div>

                    {/* Hide Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVisibility(col.code);
                      }}
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-danger-500 hover:bg-danger-50 transition-all"
                      title="Hide column"
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Hidden Columns */}
        {filteredHidden.length > 0 && (
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={() => setShowHidden(!showHidden)}
              className="flex items-center gap-2 mb-3 w-full group"
            >
              <EyeOff className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Hidden Columns
              </span>
              <span className="text-xs text-slate-400">({filteredHidden.length})</span>
              <div className="flex-1" />
              {showHidden ? (
                <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
              )}
            </button>

            {showHidden && (
              <div className="space-y-1.5">
                {filteredHidden.map((col) => {
                  const TypeIcon = getTypeIcon(col.type);
                  const typeColor = getTypeColor(col.type);

                  return (
                    <div
                      key={col.code}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 group"
                    >
                      {/* Placeholder for drag handle */}
                      <div className="w-4" />

                      {/* Type Icon */}
                      <div className={`w-6 h-6 rounded flex items-center justify-center opacity-50 ${typeColor}`}>
                        <TypeIcon className="h-3.5 w-3.5" />
                      </div>

                      {/* Label & Code */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-500 truncate">{col.label}</p>
                        <p className="text-[10px] text-slate-400 truncate">{col.code}</p>
                      </div>

                      {/* Show Button */}
                      <button
                        type="button"
                        onClick={() => toggleVisibility(col.code)}
                        className="h-7 px-2.5 flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Show
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!hasChanges}
          className={`
            px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors
            ${hasChanges
              ? 'text-white bg-primary-600 hover:bg-primary-700 shadow-sm'
              : 'text-slate-400 bg-slate-100 cursor-not-allowed'
            }
          `}
        >
          <Check className="h-4 w-4" />
          Apply Changes
        </button>
      </div>
    </div>
  );
};
