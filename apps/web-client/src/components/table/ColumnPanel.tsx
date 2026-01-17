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

const getTypeClasses = (type?: string): { iconClass: string; bgClass: string } => {
  const t = type?.toLowerCase() || 'string';
  switch (t) {
    case 'integer':
    case 'long':
    case 'decimal':
    case 'number':
    case 'currency':
    case 'percent':
      return { iconClass: 'text-info-text', bgClass: 'bg-info-subtle' };
    case 'date':
    case 'datetime':
    case 'time':
      return { iconClass: 'text-primary', bgClass: 'bg-primary/10' };
    case 'boolean':
      return { iconClass: 'text-success-text', bgClass: 'bg-success-subtle' };
    case 'choice':
    case 'multi_choice':
    case 'tags':
      return { iconClass: 'text-warning-text', bgClass: 'bg-warning-subtle' };
    case 'reference':
    case 'multi_reference':
    case 'user_reference':
      return { iconClass: 'text-primary', bgClass: 'bg-primary/10' };
    default:
      return { iconClass: 'text-muted-foreground', bgClass: 'bg-muted' };
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

  const hasChanges = useMemo(() => {
    return JSON.stringify(localColumns) !== JSON.stringify(columns);
  }, [localColumns, columns]);

  const handleDragStart = (e: React.DragEvent, code: string) => {
    setDraggedCode(code);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', code);
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

  const handleDragEnd = () => {
    setDraggedCode(null);
    setDragOverCode(null);
  };

  const apply = () => {
    onChange(localColumns);
    onClose();
  };

  return (
    <div className="h-full flex flex-col bg-card" role="dialog" aria-labelledby="column-panel-title">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10"
            aria-hidden="true"
          >
            <SlidersHorizontal className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 id="column-panel-title" className="text-sm font-semibold text-foreground">Manage Columns</h3>
            <p className="text-xs text-muted-foreground">{visibleCount} of {totalCount} visible</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground min-w-[44px] min-h-[44px]"
          aria-label="Close column panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3 border-b border-border bg-muted/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns..."
            className="input w-full h-9 pl-9 pr-3 text-sm"
            aria-label="Search columns"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground min-w-[44px] min-h-[44px]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={showAll}
            className="btn btn-secondary flex-1 h-8 text-xs min-h-[44px]"
            aria-label="Show all columns"
          >
            Show all
          </button>
          <button
            type="button"
            onClick={hideAll}
            className="btn btn-secondary flex-1 h-8 text-xs min-h-[44px]"
            aria-label="Hide all columns except first"
          >
            Hide all
          </button>
          <button
            type="button"
            onClick={reset}
            className="h-8 px-3 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted min-w-[44px] min-h-[44px]"
            title="Reset to original"
            aria-label="Reset to original configuration"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Visible Columns
              </span>
              <span className="text-xs text-muted-foreground">({filteredVisible.length})</span>
            </div>
            <span className="text-[10px] italic text-muted-foreground">Drag to reorder</span>
          </div>

          <div className="space-y-1.5" role="list" aria-label="Visible columns">
            {filteredVisible.length === 0 ? (
              <div className="text-center py-8">
                <EyeOff className="h-8 w-8 mx-auto mb-2 text-border" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">No visible columns</p>
                {search && <p className="text-xs mt-1 text-muted-foreground">Try adjusting your search</p>}
              </div>
            ) : (
              filteredVisible.map((col, index) => {
                const TypeIcon = getTypeIcon(col.type);
                const typeClasses = getTypeClasses(col.type);
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
                    role="listitem"
                    aria-grabbed={isDragging}
                    aria-label={`${col.label} column, position ${index + 1}`}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all duration-150 ${
                      isDragOver
                        ? 'bg-primary/10 border-primary scale-[1.02]'
                        : isDragging
                        ? 'bg-card border-border opacity-50 scale-95'
                        : 'bg-card border-border'
                    }`}
                  >
                    <div className="transition-colors text-border">
                      <GripVertical className="h-4 w-4" aria-label="Drag handle" />
                    </div>

                    <span
                      className="w-5 h-5 flex items-center justify-center text-[10px] font-medium rounded text-muted-foreground bg-muted"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>

                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center ${typeClasses.iconClass} ${typeClasses.bgClass}`}
                      aria-hidden="true"
                    >
                      <TypeIcon className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">{col.label}</p>
                      <p className="text-[10px] truncate text-muted-foreground">{col.code}</p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVisibility(col.code);
                      }}
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-md transition-all text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-w-[44px] min-h-[44px]"
                      title="Hide column"
                      aria-label={`Hide ${col.label} column`}
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {filteredHidden.length > 0 && (
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={() => setShowHidden(!showHidden)}
              className="flex items-center gap-2 mb-3 w-full group min-h-[44px]"
              aria-expanded={showHidden}
              aria-controls="hidden-columns-list"
              aria-label={`${showHidden ? 'Collapse' : 'Expand'} hidden columns section`}
            >
              <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Hidden Columns
              </span>
              <span className="text-xs text-muted-foreground">({filteredHidden.length})</span>
              <div className="flex-1" />
              {showHidden ? (
                <ChevronDown className="h-4 w-4 transition-colors text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4 transition-colors text-muted-foreground" aria-hidden="true" />
              )}
            </button>

            {showHidden && (
              <div id="hidden-columns-list" className="space-y-1.5" role="list" aria-label="Hidden columns">
                {filteredHidden.map((col) => {
                  const TypeIcon = getTypeIcon(col.type);
                  const typeClasses = getTypeClasses(col.type);

                  return (
                    <div
                      key={col.code}
                      role="listitem"
                      aria-label={`${col.label} column, hidden`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed group border-border bg-muted"
                    >
                      <div className="w-4" aria-hidden="true" />

                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center opacity-50 ${typeClasses.iconClass} ${typeClasses.bgClass}`}
                        aria-hidden="true"
                      >
                        <TypeIcon className="h-3.5 w-3.5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate text-foreground">{col.label}</p>
                        <p className="text-[10px] truncate text-muted-foreground">{col.code}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleVisibility(col.code)}
                        className="h-7 px-2.5 flex items-center gap-1 text-xs font-medium rounded-md transition-colors text-primary bg-primary/10 hover:bg-primary/20 min-w-[44px] min-h-[44px]"
                        aria-label={`Show ${col.label} column`}
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

      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/50 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary min-h-[44px]"
          aria-label="Cancel changes and close"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!hasChanges}
          className="btn btn-primary flex items-center gap-2 min-h-[44px]"
          aria-label="Apply column changes"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Apply Changes
        </button>
      </div>
    </div>
  );
};
