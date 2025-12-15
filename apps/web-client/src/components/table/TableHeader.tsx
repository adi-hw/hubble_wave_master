import React, { useState, useRef, useEffect } from 'react';
import { Search, RefreshCw, Plus, X, SlidersHorizontal, Share2, Check, Download, FileSpreadsheet, FileText, FileDown, ChevronDown } from 'lucide-react';
import { TableColumn } from './types';
import { ExportFormat } from './useTableExport';

interface TableHeaderProps {
  title?: string;
  columns: TableColumn[];
  onColumnsChange: (cols: TableColumn[]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchColumn: string | null; // null means search all columns
  onSearchColumnChange: (column: string | null) => void;
  filterCount?: number;
  onRefresh?: () => void;
  onCreateNew?: () => void;
  onShare?: () => Promise<boolean>;
  onExport?: (format: ExportFormat) => void;
  activePanel: 'none' | 'filter' | 'columns';
  onPanelChange: (panel: 'none' | 'filter' | 'columns') => void;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  title,
  columns,
  search,
  onSearchChange,
  searchColumn,
  onSearchColumnChange,
  onRefresh,
  onCreateNew,
  onShare,
  onExport,
  activePanel,
  onPanelChange,
}) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const searchInputRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const columnSelectorRef = useRef<HTMLDivElement>(null);
  const isSearchActive = searchFocused || search.length > 0;

  // Get searchable columns (visible columns that can be searched)
  const searchableColumns = columns.filter((c) => !c.hidden);
  const selectedColumnLabel = searchColumn
    ? columns.find((c) => c.code === searchColumn)?.label || 'All Columns'
    : 'All Columns';

  const visibleColumnCount = columns.filter((c) => !c.hidden).length;
  const totalColumnCount = columns.length;

  // Handle share button click
  const handleShare = async () => {
    if (!onShare) return;
    const success = await onShare();
    if (success) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  // Handle export
  const handleExport = (format: ExportFormat) => {
    if (onExport) {
      onExport(format);
    }
    setShowExportMenu(false);
  };

  // Handle click outside to collapse search, export menu, and column selector
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(e.target as Node)) {
        setShowColumnSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 overflow-visible"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Left side - Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {title && (
          <h2 className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
        )}
      </div>

      {/* Right side - All action buttons grouped together */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Tool buttons group */}
        <div
          className="flex items-center rounded-xl p-1 gap-0.5 flex-shrink-0"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          {/* Expandable Search with Column Selector */}
          <div
            ref={searchInputRef}
            className={`
              relative flex items-center transition-all duration-300 ease-out
              ${isSearchActive ? 'w-64 sm:w-80' : 'w-8'}
            `}
          >
            {!isSearchActive ? (
              <button
                type="button"
                onClick={() => {
                  setSearchFocused(true);
                  setTimeout(() => searchInputRef.current?.querySelector('input')?.focus(), 50);
                }}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-all"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            ) : (
              <div className="relative w-full flex items-center">
                {/* Column Selector Dropdown */}
                <div ref={columnSelectorRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="h-8 flex items-center gap-1 pl-2.5 pr-1.5 rounded-l-lg text-xs transition-colors shadow-sm"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderRight: '1px solid var(--border-default)',
                      color: 'var(--text-secondary)',
                    }}
                    title="Select column to search"
                  >
                    <span className="max-w-[80px] truncate">{selectedColumnLabel}</span>
                    <ChevronDown className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                  </button>

                  {/* Column Dropdown Menu */}
                  {showColumnSelector && (
                    <div
                      className="absolute left-0 top-full mt-1 z-50 rounded-lg py-1 min-w-[160px] max-h-[280px] overflow-y-auto"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        boxShadow: 'var(--shadow-xl)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSearchColumnChange(null);
                          setShowColumnSelector(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                        style={{
                          backgroundColor: searchColumn === null ? 'var(--bg-primary-subtle)' : 'transparent',
                          color: searchColumn === null ? 'var(--text-brand)' : 'var(--text-secondary)',
                        }}
                      >
                        <span className="flex-1 text-left">All Columns</span>
                        {searchColumn === null && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="h-px my-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
                      {searchableColumns.map((col) => (
                        <button
                          key={col.code}
                          type="button"
                          onClick={() => {
                            onSearchColumnChange(col.code);
                            setShowColumnSelector(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                          style={{
                            backgroundColor: searchColumn === col.code ? 'var(--bg-primary-subtle)' : 'transparent',
                            color: searchColumn === col.code ? 'var(--text-brand)' : 'var(--text-secondary)',
                          }}
                        >
                          <span className="flex-1 text-left truncate">{col.label}</span>
                          {searchColumn === col.code && <Check className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    placeholder={searchColumn ? `Search in ${selectedColumnLabel}...` : 'Search all columns...'}
                    autoFocus
                    className="input w-full h-8 pl-8 pr-7 rounded-l-none rounded-r-lg border-0 text-sm shadow-sm"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        onSearchChange('');
                        searchInputRef.current?.querySelector('input')?.focus();
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-5 mx-0.5" style={{ backgroundColor: 'var(--border-default)' }} />

          {/* Columns Button */}
          <button
            type="button"
            onClick={() => onPanelChange(activePanel === 'columns' ? 'none' : 'columns')}
            className="h-8 w-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
            style={{
              backgroundColor: activePanel === 'columns'
                ? 'var(--bg-primary)'
                : visibleColumnCount < totalColumnCount
                  ? 'var(--bg-warning-subtle)'
                  : 'transparent',
              color: activePanel === 'columns'
                ? 'white'
                : visibleColumnCount < totalColumnCount
                  ? 'var(--text-warning)'
                  : 'var(--text-muted)',
            }}
            title={`Columns (${visibleColumnCount}/${totalColumnCount})`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {/* Share Button */}
          {onShare && (
            <button
              type="button"
              onClick={handleShare}
              className="h-8 w-8 flex items-center justify-center rounded-lg transition-all"
              style={{
                backgroundColor: shareCopied ? 'var(--bg-success-subtle)' : 'transparent',
                color: shareCopied ? 'var(--text-success)' : 'var(--text-muted)',
              }}
              title={shareCopied ? 'Link copied!' : 'Share filtered view'}
            >
              {shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            </button>
          )}

          {/* Export Button with Dropdown */}
          {onExport && (
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-all"
                style={{
                  backgroundColor: showExportMenu ? 'var(--bg-primary-subtle)' : 'transparent',
                  color: showExportMenu ? 'var(--text-brand)' : 'var(--text-muted)',
                }}
                title="Export"
              >
                <Download className="h-4 w-4" />
              </button>

              {/* Export Dropdown Menu */}
              {showExportMenu && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg py-1 min-w-[160px]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-xl)',
                  }}
                >
                  <div className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Export as
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExport('xlsx')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary-subtle)';
                      e.currentTarget.style.color = 'var(--text-brand)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <FileSpreadsheet className="h-4 w-4" style={{ color: 'var(--text-success)' }} />
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary-subtle)';
                      e.currentTarget.style.color = 'var(--text-brand)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <FileDown className="h-4 w-4" style={{ color: 'var(--text-brand)' }} />
                    <span>CSV (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('pdf')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary-subtle)';
                      e.currentTarget.style.color = 'var(--text-brand)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <FileText className="h-4 w-4" style={{ color: 'var(--text-danger)' }} />
                    <span>PDF (.pdf)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Refresh Button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="h-8 w-8 flex items-center justify-center rounded-lg transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Add button - separate with primary styling */}
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            className="btn btn-primary h-8 w-8 flex items-center justify-center rounded-xl"
            title="Add New"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
