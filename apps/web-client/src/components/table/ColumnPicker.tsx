/**
 * ColumnPicker Component
 *
 * A theme-aware, accessible column customization drawer for table views.
 *
 * Theme Integration:
 * - Uses Tailwind CSS classes for all colors
 * - Supports light/dark mode theming via Tailwind
 * - Consistent with platform design tokens
 *
 * Accessibility Features:
 * - ARIA attributes for screen readers (role, aria-label, aria-modal, aria-labelledby)
 * - Focus trap to keep keyboard navigation within the drawer
 * - Keyboard navigation support (Escape to close, Enter to submit)
 * - Touch targets meet WCAG 2.1 minimum size (44x44px)
 * - Semantic HTML with proper button types
 * - Screen reader announcements for state changes
 *
 * @component
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
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

  const drawerRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!open || !drawerRef.current) return;

    const drawer = drawerRef.current;
    const focusableElements = drawer.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [open, activeTab, showSaveDialog, search]);

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

  const toggleVisibility = (code: string) => {
    setLocalColumns((prev) =>
      prev.map((c) => (c.code === code ? { ...c, hidden: !c.hidden } : c))
    );
  };

  const togglePin = (code: string, side: 'left' | 'right') => {
    setLocalColumns((prev) =>
      prev.map((c) => {
        if (c.code !== code) return c;
        return { ...c, pinned: c.pinned === side ? false : side };
      })
    );
  };

  const showAll = () => {
    setLocalColumns((prev) => prev.map((c) => ({ ...c, hidden: false })));
  };

  const hideAll = () => {
    setLocalColumns((prev) => prev.map((c, i) => ({ ...c, hidden: i > 0 })));
  };

  const reset = () => {
    setLocalColumns(columns);
    setSearch('');
  };

  const [draggedCode, setDraggedCode] = useState<string | null>(null);
  const [dragOverCode, setDragOverCode] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, code: string) => {
    setDraggedCode(code);
    e.dataTransfer.effectAllowed = 'move';
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

  const apply = () => {
    onChange(localColumns);
    setOpen(false);
  };

  const cancel = () => {
    setLocalColumns(columns);
    setSearch('');
    setOpen(false);
  };

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

  const deleteConfig = (id: string) => {
    const updated = savedConfigs.filter((c) => c.id !== id);
    setSavedConfigs(updated);
    localStorage.setItem(SAVED_COLUMNS_KEY, JSON.stringify(updated));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`
          inline-flex items-center justify-center transition-all min-h-[44px] min-w-[44px]
          ${iconOnly
            ? 'h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted'
            : 'gap-2 h-9 px-3 rounded-lg bg-card text-muted-foreground border border-border text-sm font-medium hover:bg-muted'
          }
        `}
        title="Columns"
        aria-label={`Customize table columns. ${visibleCount} of ${totalCount} visible`}
      >
        <Columns3 className="h-4 w-4" />
        {!iconOnly && (
          <>
            <span className="hidden sm:inline">Columns</span>
            <span className="text-xs text-muted-foreground">
              {visibleCount}/{totalCount}
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="column-picker-title"
        >
          <div
            className="absolute inset-0 backdrop-blur-sm animate-fade-in bg-overlay/50"
            onClick={cancel}
            aria-hidden="true"
          />

          <div
            ref={drawerRef}
            className="relative w-full max-w-lg flex flex-col animate-slide-in-right bg-card shadow-2xl"
          >
            <div className="flex-shrink-0 px-6 py-5 border-b border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2
                    id="column-picker-title"
                    className="text-xl font-semibold text-foreground"
                  >
                    Customize Columns
                  </h2>
                  <p className="text-sm mt-1 text-muted-foreground">
                    {visibleCount} of {totalCount} columns visible
                  </p>
                </div>
                <button
                  ref={firstFocusableRef}
                  type="button"
                  onClick={cancel}
                  className="min-h-[44px] min-w-[44px] h-10 w-10 flex items-center justify-center rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Close column picker"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={showAll}
                  className="min-h-[44px] h-9 px-4 text-sm font-medium rounded-lg transition-colors text-muted-foreground bg-muted hover:bg-muted/80"
                  aria-label="Show all columns"
                >
                  Show all
                </button>
                <button
                  type="button"
                  onClick={hideAll}
                  className="min-h-[44px] h-9 px-4 text-sm font-medium rounded-lg transition-colors text-muted-foreground bg-muted hover:bg-muted/80"
                  aria-label="Hide all columns except first"
                >
                  Hide all
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="min-h-[44px] h-9 px-4 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 text-muted-foreground bg-muted hover:bg-muted/80"
                  aria-label="Reset to original configuration"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>

              <div
                className="flex gap-1 p-1 rounded-xl bg-muted"
                role="tablist"
                aria-label="Column picker sections"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'columns'}
                  aria-controls="columns-panel"
                  onClick={() => setActiveTab('columns')}
                  className={`flex-1 min-h-[44px] h-10 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'columns'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Columns3 className="h-4 w-4" />
                  Columns
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'presets'}
                  aria-controls="presets-panel"
                  onClick={() => setActiveTab('presets')}
                  className={`flex-1 min-h-[44px] h-10 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'presets'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  Saved Presets
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeTab === 'columns' ? (
                <div
                  className="p-6"
                  id="columns-panel"
                  role="tabpanel"
                  aria-labelledby="columns-tab"
                >
                  <div className="relative mb-6">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search columns..."
                      className="w-full min-h-[44px] h-12 pl-12 pr-4 text-base rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary border border-border bg-muted text-foreground"
                      aria-label="Search columns by name or code"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                        Visible Columns ({visibleColumns.filter(filterMatches).length})
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        Drag to reorder
                      </span>
                    </div>
                    <div className="space-y-2" role="list" aria-label="Visible columns">
                      {visibleColumns.filter(filterMatches).length === 0 ? (
                        <div
                          className="px-4 py-8 text-sm text-center rounded-xl text-muted-foreground bg-muted"
                          role="status"
                        >
                          No visible columns match your search
                        </div>
                      ) : (
                        visibleColumns.filter(filterMatches).map((col) => (
                          <div
                            key={col.code}
                            role="listitem"
                            draggable
                            onDragStart={(e) => handleDragStart(e, col.code)}
                            onDragOver={(e) => handleDragOver(e, col.code)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.code)}
                            onDragEnd={handleDragEnd}
                            className={`group flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-move ${
                              dragOverCode === col.code
                                ? 'border-primary bg-primary/10 scale-[1.02]'
                                : `border-border bg-card ${draggedCode === col.code ? 'opacity-50' : ''}`
                            }`}
                            aria-label={`${col.label} column, ${col.pinned ? `pinned ${col.pinned}` : 'not pinned'}`}
                          >
                            <div
                              className="transition-colors text-muted-foreground group-hover:text-foreground"
                              aria-hidden="true"
                            >
                              <GripVertical className="h-5 w-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-medium truncate text-foreground">
                                  {col.label}
                                </span>
                                {col.pinned && (
                                  <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                                    Pinned {col.pinned}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm truncate text-muted-foreground">
                                {col.code}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => togglePin(col.code, 'left')}
                                className={`min-h-[44px] min-w-[44px] h-9 w-9 inline-flex items-center justify-center rounded-lg transition-colors ${
                                  col.pinned === 'left'
                                    ? 'text-primary bg-primary/10'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                                title={col.pinned === 'left' ? 'Unpin' : 'Pin left'}
                                aria-label={col.pinned === 'left' ? `Unpin ${col.label} from left` : `Pin ${col.label} to left`}
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
                                className="min-h-[44px] min-w-[44px] h-9 w-9 inline-flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                                title="Hide"
                                aria-label={`Hide ${col.label} column`}
                              >
                                <EyeOff className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {hiddenColumns.filter(filterMatches).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide mb-3 text-foreground">
                        Hidden Columns ({hiddenColumns.filter(filterMatches).length})
                      </h3>
                      <div className="space-y-2" role="list" aria-label="Hidden columns">
                        {hiddenColumns.filter(filterMatches).map((col) => (
                          <div
                            key={col.code}
                            role="listitem"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-colors border-border bg-muted"
                            aria-label={`${col.label} column, hidden`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-medium truncate text-muted-foreground">
                                {col.label}
                              </div>
                              <div className="text-sm truncate text-muted-foreground">
                                {col.code}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleVisibility(col.code)}
                              className="min-h-[44px] h-9 px-4 inline-flex items-center gap-2 text-sm font-medium rounded-lg transition-colors text-primary bg-primary/10 hover:bg-primary/20"
                              aria-label={`Show ${col.label} column`}
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
                <div
                  className="p-6"
                  id="presets-panel"
                  role="tabpanel"
                  aria-labelledby="presets-tab"
                >
                  {!showSaveDialog ? (
                    <button
                      type="button"
                      onClick={() => setShowSaveDialog(true)}
                      className="w-full min-h-[44px] h-14 flex items-center justify-center gap-3 text-base font-medium border-2 border-dashed rounded-xl transition-all mb-6 text-primary border-primary hover:bg-primary/10"
                      aria-label="Save current column configuration as preset"
                    >
                      <Layers className="h-5 w-5" />
                      Save current view as preset
                    </button>
                  ) : (
                    <div className="p-4 border-2 rounded-xl mb-6 border-border bg-muted">
                      <input
                        type="text"
                        value={configName}
                        onChange={(e) => setConfigName(e.target.value)}
                        placeholder="Preset name..."
                        className="w-full min-h-[44px] h-12 px-4 text-base rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-primary border border-border bg-card text-foreground"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveConfig();
                          if (e.key === 'Escape') setShowSaveDialog(false);
                        }}
                        aria-label="Enter preset name"
                      />
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowSaveDialog(false)}
                          className="flex-1 min-h-[44px] h-10 text-sm font-medium rounded-lg transition-colors text-muted-foreground bg-card border border-border hover:bg-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveConfig}
                          disabled={!configName.trim()}
                          className="flex-1 min-h-[44px] h-10 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          Save Preset
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3" role="list" aria-label="Saved presets">
                    {savedConfigs.length === 0 ? (
                      <div className="py-16 text-center" role="status">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-muted">
                          <Layers className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-medium text-muted-foreground">
                          No saved presets
                        </p>
                        <p className="text-sm mt-1 text-muted-foreground">
                          Save your column configuration for quick access later
                        </p>
                      </div>
                    ) : (
                      savedConfigs.map((config) => (
                        <div
                          key={config.id}
                          role="listitem"
                          className="flex items-center justify-between p-4 border-2 rounded-xl transition-all border-border hover:border-primary/50"
                        >
                          <button
                            type="button"
                            onClick={() => loadConfig(config)}
                            className="flex-1 text-left flex items-center gap-4 min-h-[44px]"
                            aria-label={`Load preset: ${config.name}`}
                          >
                            <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10">
                              <Layers className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <div className="text-base font-medium text-foreground">
                                {config.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {config.columns.filter((c) => !c.hidden).length} columns visible
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 ml-auto text-muted-foreground" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteConfig(config.id)}
                            className="min-h-[44px] min-w-[44px] h-10 w-10 inline-flex items-center justify-center rounded-lg transition-colors ml-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete"
                            aria-label={`Delete preset: ${config.name}`}
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

            <div className="flex-shrink-0 px-6 py-4 flex items-center justify-end gap-3 border-t border-border bg-muted">
              <button
                type="button"
                onClick={cancel}
                className="min-h-[44px] h-11 px-6 text-base font-medium rounded-xl transition-colors text-muted-foreground bg-card border border-border hover:bg-muted"
                aria-label="Cancel and close without saving changes"
              >
                Cancel
              </button>
              <button
                ref={lastFocusableRef}
                type="button"
                onClick={apply}
                className="min-h-[44px] h-11 px-8 text-base font-medium rounded-xl transition-colors flex items-center gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                aria-label="Apply column changes"
              >
                <Check className="h-5 w-5" />
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

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
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
};
