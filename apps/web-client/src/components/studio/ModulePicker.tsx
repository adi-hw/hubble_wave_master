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
          w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm outline-none transition-colors
          ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
          ${isOpen ? 'ring-2 ring-sky-500 border-sky-500' : ''}
        `}
        style={{
          backgroundColor: disabled ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          color: disabled ? 'var(--text-muted)' : 'var(--text-primary)'
        }}
      >
        {selectedModule ? (
          <>
            <span style={{ color: 'var(--text-muted)' }}>
              {selectedModule.icon ? (
                <Icon name={selectedModule.icon} className="h-4 w-4" />
              ) : (
                getTypeIcon(selectedModule.type)
              )}
            </span>
            <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{selectedModule.label}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedModule.key}</span>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="hover:opacity-80 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <>
            <Search className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            <span className="flex-1" style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
          </>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute z-50 left-0 right-0 mt-1 rounded-lg shadow-lg overflow-hidden border"
          style={{ 
            backgroundColor: 'var(--bg-elevated)', 
            borderColor: 'var(--border-default)' 
          }}
        >
          {/* Search Input */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <div 
              className="flex items-center gap-2 px-2 py-1.5 rounded-md"
              style={{ backgroundColor: 'var(--bg-surface-secondary)' }}
            >
              <Search className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
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
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text-primary)' }}
                autoComplete="off"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto">
            {filteredModules.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {search ? 'No modules found' : 'No modules available'}
              </div>
            ) : (
              Object.entries(groupedModules).map(([group, groupModules]) => (
                <div key={group}>
                  <div 
                    className="px-3 py-1.5 text-xs font-semibold uppercase"
                    style={{ 
                      color: 'var(--text-muted)', 
                      backgroundColor: 'var(--bg-surface-secondary)' 
                    }}
                  >
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
                          ${isHighlighted ? 'bg-black/5 dark:bg-white/5' : ''}
                          ${isSelected ? 'bg-sky-500/10' : ''}
                        `}
                        style={{
                            backgroundColor: isSelected ? 'var(--bg-selected)' : (isHighlighted ? 'var(--bg-hover)' : 'transparent')
                        }}
                      >
                        <span className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                          {module.icon ? (
                            <Icon name={module.icon} className="h-4 w-4" />
                          ) : (
                            getTypeIcon(module.type)
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: isSelected ? 'var(--text-brand)' : 'var(--text-primary)' }}>
                            {module.label}
                          </div>
                          {module.description && (
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {module.description}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
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
