/**
 * ModulePicker Component
 *
 * Search and select modules for navigation items.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Package, Link as LinkIcon, LayoutDashboard, FileText, Settings } from 'lucide-react';
import { Icon } from '../Icon';

export interface ModuleOption {
  key: string;
  label: string;
  description?: string;
  icon?: string;
  type: string;
  applicationKey?: string;
}

interface ModulePickerProps {
  value?: string;
  onChange: (moduleKey: string | undefined) => void;
  modules: ModuleOption[];
  disabled?: boolean;
  placeholder?: string;
}

const getTypeIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'list':
      return <FileText className="h-4 w-4" />;
    case 'dashboard':
      return <LayoutDashboard className="h-4 w-4" />;
    case 'url':
      return <LinkIcon className="h-4 w-4" />;
    case 'form':
    case 'record':
      return <FileText className="h-4 w-4" />;
    case 'custom':
      return <Settings className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
};

export const ModulePicker: React.FC<ModulePickerProps> = ({
  value,
  onChange,
  modules,
  disabled = false,
  placeholder = 'Select a module...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get selected module
  const selectedModule = value ? modules.find((m) => m.key === value) : undefined;

  // Filter modules based on search
  const filteredModules = modules.filter((m) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return (
      m.key.toLowerCase().includes(searchLower) ||
      m.label.toLowerCase().includes(searchLower) ||
      m.description?.toLowerCase().includes(searchLower) ||
      m.applicationKey?.toLowerCase().includes(searchLower)
    );
  });

  // Group modules by application
  const groupedModules = filteredModules.reduce((acc, module) => {
    const group = module.applicationKey || 'Other';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(module);
    return acc;
  }, {} as Record<string, ModuleOption[]>);

  // Flatten for keyboard navigation
  const flattenedModules = filteredModules;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, flattenedModules.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flattenedModules[highlightedIndex]) {
            onChange(flattenedModules[highlightedIndex].key);
            setIsOpen(false);
            setSearch('');
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearch('');
          break;
      }
    },
    [flattenedModules, highlightedIndex, onChange]
  );

  const handleSelect = (moduleKey: string) => {
    onChange(moduleKey);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(true);
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        }}
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-left text-sm outline-none transition-colors
          ${disabled ? 'cursor-not-allowed opacity-60 bg-muted text-muted-foreground' : 'cursor-pointer bg-card text-foreground'}
          ${isOpen ? 'ring-2 ring-sky-500 border-info-border' : ''}
        `}
      >
        {selectedModule ? (
          <>
            <span className="text-muted-foreground">
              {selectedModule.icon ? (
                <Icon name={selectedModule.icon} className="h-4 w-4" />
              ) : (
                getTypeIcon(selectedModule.type)
              )}
            </span>
            <span className="flex-1 truncate text-foreground">{selectedModule.label}</span>
            <span className="text-xs text-muted-foreground">{selectedModule.key}</span>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground hover:opacity-80 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-muted-foreground">{placeholder}</span>
          </>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-lg shadow-lg overflow-hidden border border-border bg-card"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search modules..."
                className="flex-1 bg-transparent outline-none text-sm text-foreground"
                autoComplete="off"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-muted-foreground hover:opacity-80"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto">
            {filteredModules.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                {search ? 'No modules found' : 'No modules available'}
              </div>
            ) : (
              Object.entries(groupedModules).map(([group, groupModules]) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground bg-muted">
                    {group}
                  </div>
                  {groupModules.map((module) => {
                    const globalIndex = flattenedModules.indexOf(module);
                    const isHighlighted = globalIndex === highlightedIndex;
                    const isSelected = module.key === value;

                    return (
                      <button
                        key={module.key}
                        type="button"
                        onClick={() => handleSelect(module.key)}
                        onMouseEnter={() => setHighlightedIndex(globalIndex)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                          ${isHighlighted && !isSelected ? 'bg-muted/50' : ''}
                          ${isSelected ? 'bg-primary/10' : ''}
                        `}
                      >
                        <span className="flex-shrink-0 text-muted-foreground">
                          {module.icon ? (
                            <Icon name={module.icon} className="h-4 w-4" />
                          ) : (
                            getTypeIcon(module.type)
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {module.label}
                          </div>
                          {module.description && (
                            <div className="text-xs truncate text-muted-foreground">
                              {module.description}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-mono flex-shrink-0 text-muted-foreground">
                          {module.key}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModulePicker;
