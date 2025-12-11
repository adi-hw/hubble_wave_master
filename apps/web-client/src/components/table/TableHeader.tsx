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
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-slate-100 overflow-visible">
      {/* Left side - Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {title && (
          <h2 className="text-lg font-semibold text-slate-900 truncate">
            {title}
          </h2>
        )}
      </div>

      {/* Right side - All action buttons grouped together */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Tool buttons group */}
        <div className="flex items-center bg-slate-100/80 rounded-xl p-1 gap-0.5 flex-shrink-0">
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
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white hover:shadow-sm transition-all"
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
                    className="h-8 flex items-center gap-1 pl-2.5 pr-1.5 rounded-l-lg bg-white border-r border-slate-200 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-sm"
                    title="Select column to search"
                  >
                    <span className="max-w-[80px] truncate">{selectedColumnLabel}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>

                  {/* Column Dropdown Menu */}
                  {showColumnSelector && (
                    <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[160px] max-h-[280px] overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          onSearchColumnChange(null);
                          setShowColumnSelector(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                          searchColumn === null
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex-1 text-left">All Columns</span>
                        {searchColumn === null && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="h-px bg-slate-100 my-1" />
                      {searchableColumns.map((col) => (
                        <button
                          key={col.code}
                          type="button"
                          onClick={() => {
                            onSearchColumnChange(col.code);
                            setShowColumnSelector(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                            searchColumn === col.code
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
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
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    placeholder={searchColumn ? `Search in ${selectedColumnLabel}...` : 'Search all columns...'}
                    autoFocus
                    className="w-full h-8 pl-8 pr-7 rounded-r-lg border-0 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-200 focus:outline-none shadow-sm"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        onSearchChange('');
                        searchInputRef.current?.querySelector('input')?.focus();
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Columns Button */}
          <button
            type="button"
            onClick={() => onPanelChange(activePanel === 'columns' ? 'none' : 'columns')}
            className={`
              h-8 w-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0
              ${activePanel === 'columns'
                ? 'bg-primary-600 text-white shadow-sm'
                : visibleColumnCount < totalColumnCount
                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white hover:shadow-sm'
              }
            `}
            title={`Columns (${visibleColumnCount}/${totalColumnCount})`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {/* Share Button */}
          {onShare && (
            <button
              type="button"
              onClick={handleShare}
              className={`
                h-8 w-8 flex items-center justify-center rounded-lg transition-all
                ${shareCopied
                  ? 'bg-success-100 text-success-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white hover:shadow-sm'
                }
              `}
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
                className={`
                  h-8 w-8 flex items-center justify-center rounded-lg transition-all
                  ${showExportMenu
                    ? 'bg-primary-100 text-primary-600'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white hover:shadow-sm'
                  }
                `}
                title="Export"
              >
                <Download className="h-4 w-4" />
              </button>

              {/* Export Dropdown Menu */}
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[160px]">
                  <div className="px-3 py-1.5 border-b border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Export as
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExport('xlsx')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                  >
                    <FileDown className="h-4 w-4 text-blue-600" />
                    <span>CSV (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('pdf')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-red-600" />
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
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white hover:shadow-sm transition-all"
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
            className="h-8 w-8 flex items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-700 shadow-sm transition-all"
            title="Add New"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
