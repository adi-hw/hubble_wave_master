/**
 * NavSearch Component
 *
 * Inline search for navigation items.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../Icon';
import { NavSearchResult } from '../../types/navigation-v2';

interface NavSearchProps {
  onSearch: (query: string) => NavSearchResult[];
  onNavigate?: (moduleKey: string) => void;
  collapsed?: boolean;
  placeholder?: string;
}

export const NavSearch: React.FC<NavSearchProps> = ({
  onSearch,
  onNavigate,
  collapsed = false,
  placeholder = 'Search...',
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NavSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const searchResults = onSearch(searchQuery);
        setResults(searchResults);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [onSearch]
  );

  // Handle query change with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim()) {
      setIsOpen(true);
      debounceRef.current = setTimeout(() => {
        performSearch(query);
      }, 200);
    } else {
      setResults([]);
      setIsOpen(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

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
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (result: NavSearchResult) => {
    if (result.route) {
      navigate(result.route);
      if (onNavigate && result.key) {
        onNavigate(result.key);
      }
    }
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Collapsed view - just show search icon
  if (collapsed) {
    return (
      <button
        onClick={() => inputRef.current?.focus()}
        className="w-full flex justify-center py-2 text-slate-400 hover:text-slate-600 transition-colors"
        title="Search navigation"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative px-2 mb-3">
      {/* Search Input */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors"
        style={{
          backgroundColor: 'var(--hw-bg-subtle, #f8fafc)',
          borderColor: isOpen ? 'var(--hw-primary, #0ea5e9)' : 'var(--hw-border, #e2e8f0)',
        }}
      >
        <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setIsOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: 'var(--hw-text, #1e293b)' }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div
          className="absolute left-2 right-2 top-full mt-1 z-50 rounded-lg shadow-lg border overflow-hidden"
          style={{
            backgroundColor: 'var(--hw-surface, white)',
            borderColor: 'var(--hw-border, #e2e8f0)',
          }}
        >
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              {query.trim() ? 'No results found' : 'Start typing to search'}
            </div>
          ) : (
            <div className="py-1 max-h-64 overflow-y-auto">
              {results.map((result, index) => {
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={result.key}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors
                      ${isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}
                    `}
                  >
                    {/* Icon */}
                    {result.icon && (
                      <span className="flex-shrink-0 text-slate-400">
                        <Icon name={result.icon} className="h-4 w-4" />
                      </span>
                    )}

                    {/* Content */}
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {result.label}
                      </div>
                      {result.path.length > 0 && (
                        <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                          {result.path.map((crumb, i) => (
                            <React.Fragment key={i}>
                              {i > 0 && <ChevronRight className="h-3 w-3" />}
                              <span>{crumb}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    {isSelected && (
                      <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NavSearch;
