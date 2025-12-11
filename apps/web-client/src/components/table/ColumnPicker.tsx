import React, { useEffect, useState, useCallback } from 'react';
import {
  Columns3,
  GripVertical,
  Eye,
  EyeOff,
  Pin,
  PinOff,
  Search,
  X,
  Check,
  RotateCcw,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { TableColumn } from './types';

interface ColumnPickerProps {
  columns: TableColumn[];
  onChange: (cols: TableColumn[]) => void;
  iconOnly?: boolean;
}

// Saved column configurations
const SAVED_COLUMNS_KEY = 'eam_saved_columns';

interface SavedConfig {
  id: string;
  name: string;
  columns: TableColumn[];
  createdAt: string;
}

export const ColumnPicker: React.FC<ColumnPickerProps> = ({
  columns,
  onChange,
  iconOnly = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [localColumns, setLocalColumns] = useState<TableColumn[]>(columns);
  const [activeTab, setActiveTab] = useState<'columns' | 'presets'>('columns');
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [configName, setConfigName] = useState('');

  // Load saved configs
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_COLUMNS_KEY);
      if (saved) {
        setSavedConfigs(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    setLocalColumns(columns);
  }, [columns]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  const visibleColumns = localColumns.filter((c) => !c.hidden);
  const hiddenColumns = localColumns.filter((c) => c.hidden);
  const visibleCount = visibleColumns.length;
  const totalCount = localColumns.length;

  const filterMatches = useCallback(
    (col: TableColumn) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        col.label.toLowerCase().includes(term) ||
        col.code.toLowerCase().includes(term)
      );
    },
    [search]
  );

  // Toggle column visibility
  const toggleVisibility = (code: string) => {
    setLocalColumns((prev) =>
      prev.map((c) => (c.code === code ? { ...c, hidden: !c.hidden } : c))
    );
  };

  // Toggle pin
  const togglePin = (code: string, side: 'left' | 'right') => {
    setLocalColumns((prev) =>
      prev.map((c) => {
        if (c.code !== code) return c;
        return { ...c, pinned: c.pinned === side ? false : side };
      })
    );
  };

  // Show all columns
  const showAll = () => {
    setLocalColumns((prev) => prev.map((c) => ({ ...c, hidden: false })));
  };

  // Hide all columns (except first)
  const hideAll = () => {
    setLocalColumns((prev) => prev.map((c, i) => ({ ...c, hidden: i > 0 })));
  };

  // Reset to original
  const reset = () => {
    setLocalColumns(columns);
    setSearch('');
  };

  // Drag and drop handlers - use column code instead of index for reliability
  const [draggedCode, setDraggedCode] = useState<string | null>(null);
  const [dragOverCode, setDragOverCode] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, code: string) => {
    setDraggedCode(code);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox
    e.dataTransfer.setData('text/plain', code);
  };

  const handleDragOver = (e: React.DragEvent, code: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedCode !== null && draggedCode !== code) {
      setDragOverCode(code);
    }
  };

  const handleDragLeave = () => {
    setDragOverCode(null);
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

  // Apply changes
  const apply = () => {
    onChange(localColumns);
    setOpen(false);
  };

  // Cancel changes
  const cancel = () => {
    setLocalColumns(columns);
    setSearch('');
    setOpen(false);
  };

  // Save configuration
  const saveConfig = () => {
    if (!configName.trim()) return;
    const newConfig: SavedConfig = {
      id: Date.now().toString(),
      name: configName.trim(),
      columns: localColumns,
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedConfigs, newConfig];
    setSavedConfigs(updated);
    localStorage.setItem(SAVED_COLUMNS_KEY, JSON.stringify(updated));
    setConfigName('');
    setShowSaveDialog(false);
  };

  // Load configuration
  const loadConfig = (config: SavedConfig) => {
    const configMap = new Map(config.columns.map((c) => [c.code, c]));
    setLocalColumns((prev) =>
      prev.map((col) => {
        const saved = configMap.get(col.code);
        if (saved) {
          return { ...col, hidden: saved.hidden, pinned: saved.pinned };
        }
        return col;
      })
    );
  };

  // Delete configuration
  const deleteConfig = (id: string) => {
    const updated = savedConfigs.filter((c) => c.id !== id);
    setSavedConfigs(updated);
    localStorage.setItem(SAVED_COLUMNS_KEY, JSON.stringify(updated));
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`
          inline-flex items-center justify-center transition-all
          ${iconOnly
            ? 'h-8 w-8 rounded-md text-slate-500 hover:text-slate-700 hover:bg-white hover:shadow-sm'
            : 'gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }
        `}
        title="Columns"
      >
        <Columns3 className="h-4 w-4" />
        {!iconOnly && (
          <>
            <span className="hidden sm:inline">Columns</span>
            <span className="text-xs text-slate-400">
              {visibleCount}/{totalCount}
            </span>
          </>
        )}
      </button>

      {/* Full-screen Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
            onClick={cancel}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-5 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Customize Columns</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {visibleCount} of {totalCount} columns visible
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancel}
                  className="h-10 w-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={showAll}
                  className="h-9 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Show all
                </button>
                <button
                  type="button"
                  onClick={hideAll}
                  className="h-9 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Hide all
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="h-9 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('columns')}
                  className={`flex-1 h-10 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'columns'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Columns3 className="h-4 w-4" />
                  Columns
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('presets')}
                  className={`flex-1 h-10 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'presets'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  Saved Presets
                </button>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'columns' ? (
                <div className="p-6">
                  {/* Search */}
                  <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search columns..."
                      className="w-full h-12 pl-12 pr-4 text-base border border-slate-200 rounded-xl bg-slate-50 placeholder:text-slate-400 focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-100 focus:outline-none transition-all"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Visible Columns */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                        Visible Columns ({visibleColumns.filter(filterMatches).length})
                      </h3>
                      <span className="text-xs text-slate-400">Drag to reorder</span>
                    </div>
                    <div className="space-y-2">
                      {visibleColumns.filter(filterMatches).length === 0 ? (
                        <div className="px-4 py-8 text-sm text-slate-500 text-center bg-slate-50 rounded-xl">
                          No visible columns match your search
                        </div>
                      ) : (
                        visibleColumns.filter(filterMatches).map((col) => (
                          <div
                            key={col.code}
                            draggable
                            onDragStart={(e) => handleDragStart(e, col.code)}
                            onDragOver={(e) => handleDragOver(e, col.code)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.code)}
                            onDragEnd={handleDragEnd}
                            className={`
                              group flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-move
                              ${
                                dragOverCode === col.code
                                  ? 'border-primary-400 bg-primary-50 scale-[1.02]'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                              }
                              ${draggedCode === col.code ? 'opacity-50' : ''}
                            `}
                          >
                            {/* Drag Handle */}
                            <div className="text-slate-300 group-hover:text-slate-400 transition-colors">
                              <GripVertical className="h-5 w-5" />
                            </div>

                            {/* Column Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-medium text-slate-900 truncate">
                                  {col.label}
                                </span>
                                {col.pinned && (
                                  <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                                    Pinned {col.pinned}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-400 truncate">{col.code}</div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => togglePin(col.code, 'left')}
                                className={`h-9 w-9 inline-flex items-center justify-center rounded-lg transition-colors ${
                                  col.pinned === 'left'
                                    ? 'text-primary-600 bg-primary-100'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                                title={col.pinned === 'left' ? 'Unpin' : 'Pin left'}
                              >
                                {col.pinned === 'left' ? (
                                  <PinOff className="h-4 w-4" />
                                ) : (
                                  <Pin className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleVisibility(col.code)}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                                title="Hide"
                              >
                                <EyeOff className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Hidden Columns */}
                  {hiddenColumns.filter(filterMatches).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
                        Hidden Columns ({hiddenColumns.filter(filterMatches).length})
                      </h3>
                      <div className="space-y-2">
                        {hiddenColumns.filter(filterMatches).map((col) => (
                          <div
                            key={col.code}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-medium text-slate-500 truncate">
                                {col.label}
                              </div>
                              <div className="text-sm text-slate-400 truncate">{col.code}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleVisibility(col.code)}
                              className="h-9 px-4 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                              Show
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Presets Tab */
                <div className="p-6">
                  {/* Save Current */}
                  {!showSaveDialog ? (
                    <button
                      type="button"
                      onClick={() => setShowSaveDialog(true)}
                      className="w-full h-14 flex items-center justify-center gap-3 text-base font-medium text-primary-600 border-2 border-dashed border-primary-200 rounded-xl hover:bg-primary-50 hover:border-primary-300 transition-all mb-6"
                    >
                      <Layers className="h-5 w-5" />
                      Save current view as preset
                    </button>
                  ) : (
                    <div className="p-4 border-2 border-slate-200 rounded-xl bg-slate-50 mb-6">
                      <input
                        type="text"
                        value={configName}
                        onChange={(e) => setConfigName(e.target.value)}
                        placeholder="Preset name..."
                        className="w-full h-12 px-4 text-base border border-slate-200 rounded-xl bg-white placeholder:text-slate-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none mb-3"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveConfig();
                          if (e.key === 'Escape') setShowSaveDialog(false);
                        }}
                      />
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowSaveDialog(false)}
                          className="flex-1 h-10 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveConfig}
                          disabled={!configName.trim()}
                          className="flex-1 h-10 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
                        >
                          Save Preset
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Saved Presets */}
                  <div className="space-y-3">
                    {savedConfigs.length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                          <Layers className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-lg font-medium text-slate-700">No saved presets</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Save your column configuration for quick access later
                        </p>
                      </div>
                    ) : (
                      savedConfigs.map((config) => (
                        <div
                          key={config.id}
                          className="flex items-center justify-between p-4 border-2 border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all"
                        >
                          <button
                            type="button"
                            onClick={() => loadConfig(config)}
                            className="flex-1 text-left flex items-center gap-4"
                          >
                            <div className="h-12 w-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                              <Layers className="h-6 w-6 text-primary-600" />
                            </div>
                            <div>
                              <div className="text-base font-medium text-slate-900">
                                {config.name}
                              </div>
                              <div className="text-sm text-slate-500">
                                {config.columns.filter((c) => !c.hidden).length} columns visible
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-400 ml-auto" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteConfig(config.id)}
                            className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors ml-3"
                            title="Delete"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={cancel}
                className="h-11 px-6 text-base font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                className="h-11 px-8 text-base font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-sm transition-colors flex items-center gap-2"
              >
                <Check className="h-5 w-5" />
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};
