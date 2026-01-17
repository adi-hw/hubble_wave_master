/**
 * NavSearch Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready navigation search with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 * - Keyboard navigation with arrow keys
 * - ARIA combobox pattern
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../Icon';
import { NavSearchResult } from '../../types/navigation';

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
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = 'nav-search-results';

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

  // Scroll selected item into view
  useEffect(() => {
    if (isOpen && listRef.current && results.length > 0) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen, results.length]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [results, selectedIndex]);

  const handleSelect = useCallback((result: NavSearchResult) => {
    if (result.route) {
      navigate(result.route);
      if (onNavigate && result.key) {
        onNavigate(result.key);
      }
    }
    setQuery('');
    setIsOpen(false);
  }, [navigate, onNavigate]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }, []);

  // Collapsed view - just show search icon
  if (collapsed) {
    return (
      <button
        onClick={() => inputRef.current?.focus()}
        className="w-full flex justify-center py-2 transition-colors min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
        aria-label="Search navigation"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative px-2 mb-3">
      {/* Search Input */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors min-h-[44px] bg-muted border ${isOpen ? 'border-primary' : 'border-border'}`}
      >
        <Search
          className="h-4 w-4 flex-shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setIsOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={results[selectedIndex] ? `search-result-${selectedIndex}` : undefined}
          aria-autocomplete="list"
          aria-label="Search navigation"
        />
        {loading && (
          <Loader2
            className="h-4 w-4 animate-spin flex-shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        {query && !loading && (
          <button
            onClick={handleClear}
            className="transition-colors p-1 rounded min-h-[32px] min-w-[32px] flex items-center justify-center text-muted-foreground hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div
          id={listId}
          ref={listRef}
          className="absolute left-2 right-2 top-full mt-1 z-50 rounded-lg overflow-hidden bg-card border border-border shadow-lg"
          role="listbox"
          aria-label="Search results"
        >
          {loading ? (
            <div className="px-4 py-3 text-sm text-center text-muted-foreground">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-center text-muted-foreground">
              {query.trim() ? 'No results found' : 'Start typing to search'}
            </div>
          ) : (
            <div className="py-1 max-h-64 overflow-y-auto">
              {results.map((result, index) => {
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={result.key}
                    id={`search-result-${index}`}
                    data-index={index}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors min-h-[44px] ${isSelected ? 'bg-muted' : 'bg-transparent'}`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {/* Icon */}
                    {result.icon && (
                      <span
                        className="flex-shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      >
                        <Icon name={result.icon} className="h-4 w-4" />
                      </span>
                    )}

                    {/* Content */}
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium truncate text-foreground">
                        {result.label}
                      </div>
                      {result.path.length > 0 && (
                        <div className="text-xs truncate flex items-center gap-1 text-muted-foreground">
                          {result.path.map((crumb, i) => (
                            <React.Fragment key={i}>
                              {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                              <span>{crumb}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Arrow indicator */}
                    {isSelected && (
                      <ChevronRight
                        className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
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
